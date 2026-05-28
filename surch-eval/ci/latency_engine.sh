#!/bin/bash
# Engine-to-engine deces search-latency probe — replays the REAL deces-backend
# query shape directly against <engine>/deces/_search, with NO Node backend in
# the path (the artillery-via-backend numbers are confounded by the backend +
# the 2-vCPU runner). One engine per matrix job, so no cross-engine contention.
#
# The query body is exactly what deces-backend emits for a (firstName,lastName)
# search (captured via a socat proxy in the surch-eval investigation):
#   bool.must[ function_score{ query: bool.must[
#     bool{ minimum_should_match:2, should:[match PRENOM, match NOM] } ] } ]
#   + min_score:0, track_total_hits:true, sort:[{_score:desc}], size:20
#
# Names come from the deces-backend perf fixture clients_test.csv
# (Nom;matchid_id;Pays;Lieu;Date;Prenom), the same names the artillery test uses.
#
# Output: surch-eval/ci/reports/latency-<engine>.json with p50/p95/p99/max (ms),
# requests, errors. Absolute numbers are still 2-vCPU-runner-bound, but the
# engine-to-engine RELATIVE (Surch vs ES, same script, isolated jobs) is clean.
set -u
ENGINE=${ENGINE:?ENGINE=es|surch}
URL=${ENGINE_URL:?ENGINE_URL=http://host:9200}
IDX=${ES_INDEX:-deces}
NAMES=${NAMES:-/names/clients_test.csv}
OUT=${OUT_DIR:-/ci/reports}; mkdir -p "$OUT"
REQUESTS=${REQUESTS:-2000}
WORKERS=${WORKERS:-4}

# Build REQUESTS query bodies from real (Prenom, Nom) pairs (cycled), one JSON
# body per line into a work file, lowercased like the backend does.
QF="$(mktemp)"
awk -F';' -v n="$REQUESTS" '
  NR==1 { next }                        # skip header
  { first=tolower($6); last=tolower($1);
    gsub(/"/,"",first); gsub(/"/,"",last);
    if (first=="" || last=="") next;
    pairs[++c]=first "\t" last }
  END {
    if (c==0) exit 1;
    for (i=0;i<n;i++){ split(pairs[(i%c)+1], p, "\t");
      printf "{\"min_score\":0,\"track_total_hits\":true,\"query\":{\"bool\":{\"must\":[{\"function_score\":{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"minimum_should_match\":2,\"should\":[{\"match\":{\"PRENOM\":\"%s\"}},{\"match\":{\"NOM\":\"%s\"}}]}}]}}}}]}},\"sort\":[{\"_score\":\"desc\"}],\"size\":20}\n", p[1], p[2] }
  }' "$NAMES" > "$QF" || { echo "no names in $NAMES"; exit 1; }

total=$(wc -l < "$QF")
echo "replaying $total deces queries against $ENGINE ($URL), $WORKERS workers"

# warm up (let the engine JIT/cache settle) — 50 queries, untimed
head -50 "$QF" | while read -r body; do
  curl -s -o /dev/null -m 30 -XPOST "$URL/$IDX/_search" -H 'Content-Type: application/json' -d "$body"
done

# timed replay: split across workers, each curls its chunk and prints time_total(s)
SAMP="$(mktemp -d)"
split -n l/$WORKERS "$QF" "$SAMP/c."
for c in "$SAMP"/c.*; do
  ( while IFS= read -r body; do
      curl -s -o /dev/null -m 30 -w '%{http_code} %{time_total}\n' \
        -XPOST "$URL/$IDX/_search" -H 'Content-Type: application/json' -d "$body"
    done < "$c" ) >> "$SAMP/out" &
done
wait

# percentiles in a POSIX-safe awk pass (busybox awk has no asort)
awk -v engine="$ENGINE" '
  { code=$1; t=$2*1000;
    if (code=="200") { a[++n]=t; sum+=t } else { err++ } }
  END {
    if (n==0) { printf "{\"engine\":\"%s\",\"requests\":0,\"errors\":%d}\n", engine, err+0; exit }
    for (i=1;i<=n;i++) for (j=i+1;j<=n;j++) if (a[j]<a[i]) { tmp=a[i]; a[i]=a[j]; a[j]=tmp }
    p50=a[int(n*0.50)]; p95=a[int(n*0.95)]; p99=a[int(n*0.99)]; mx=a[n]; mn=a[1];
    printf "{\"engine\":\"%s\",\"requests\":%d,\"errors\":%d,\"min_ms\":%.1f,\"p50_ms\":%.1f,\"p95_ms\":%.1f,\"p99_ms\":%.1f,\"max_ms\":%.1f,\"mean_ms\":%.1f}\n", engine, n, err+0, mn, p50, p95, p99, mx, sum/n
  }' "$SAMP/out" | tee "$OUT/latency-$ENGINE.json"

rm -rf "$QF" "$SAMP"
