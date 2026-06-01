#!/bin/bash
# Decompose the deces search latency: time 3 query shapes on the SAME name pairs
# to pinpoint where the per-query time goes, before optimising the wrong thing.
#   - match : single `match NOM`            -> analysis(1) + 1 posting list + score
#   - bool  : `bool.must[match PRENOM, match NOM]` (conjunction, no min_score/fs)
#   - full  : function_score + min_score:0 + track_total_hits + sort (real query)
# bool-minus-match = conjunction cost ; full-minus-bool = function_score/min_score/
# track_total_hits/sort overhead. Emits decompose-<engine>.json.
set -u
ENGINE=${ENGINE:?ENGINE=es|surch}
URL=${ENGINE_URL:?ENGINE_URL=http://host:9200}
IDX=${ES_INDEX:-deces}
NAMES=${NAMES:-/names/clients_test.csv}
OUT=${OUT_DIR:-/ci/reports}; mkdir -p "$OUT"
REQUESTS=${REQUESTS:-1500}
WORKERS=${WORKERS:-4}

# build the three body files from real (first,last) pairs
F_MATCH="$(mktemp)"; F_BOOL="$(mktemp)"; F_FULL="$(mktemp)"
awk -F';' -v n="$REQUESTS" -v fm="$F_MATCH" -v fb="$F_BOOL" -v ff="$F_FULL" '
  NR==1 { next }
  { first=tolower($6); last=tolower($1); gsub(/"/,"",first); gsub(/"/,"",last);
    if (first=="" || last=="") next; pairs[++c]=first "\t" last }
  END {
    if (c==0) exit 1;
    for (i=0;i<n;i++){ split(pairs[(i%c)+1], p, "\t"); f=p[1]; l=p[2];
      printf "{\"query\":{\"match\":{\"NOM\":\"%s\"}},\"size\":20}\n", l > fm;
      printf "{\"query\":{\"bool\":{\"must\":[{\"match\":{\"PRENOM\":\"%s\"}},{\"match\":{\"NOM\":\"%s\"}}]}},\"size\":20}\n", f, l > fb;
      printf "{\"min_score\":0,\"track_total_hits\":true,\"query\":{\"bool\":{\"must\":[{\"function_score\":{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"minimum_should_match\":2,\"should\":[{\"match\":{\"PRENOM\":\"%s\"}},{\"match\":{\"NOM\":\"%s\"}}]}}]}}}}]}},\"sort\":[{\"_score\":\"desc\"}],\"size\":20}\n", f, l > ff;
    }
  }' "$NAMES" || { echo "no names in $NAMES"; exit 1; }

time_shape() {           # $1=label  $2=bodyfile  -> echoes "label p50 p95 p99 max"
  local label="$1" bf="$2" d; d="$(mktemp -d)"
  head -30 "$bf" | while read -r b; do curl -s -o /dev/null -m 30 -XPOST "$URL/$IDX/_search" -H 'Content-Type: application/json' -d "$b"; done
  split -n l/$WORKERS "$bf" "$d/c."
  for c in "$d"/c.*; do
    ( while IFS= read -r b; do curl -s -o /dev/null -m 30 -w '%{http_code} %{time_total}\n' -XPOST "$URL/$IDX/_search" -H 'Content-Type: application/json' -d "$b"; done < "$c" ) >> "$d/out" &
  done; wait
  awk -v lbl="$label" '
    { if($1=="200"){a[++n]=$2*1000} else {e++} }
    END { if(n==0){printf "\"%s\":{\"requests\":0,\"errors\":%d}", lbl, e+0; exit}
      for(i=1;i<=n;i++)for(j=i+1;j<=n;j++)if(a[j]<a[i]){t=a[i];a[i]=a[j];a[j]=t}
      printf "\"%s\":{\"req\":%d,\"errors\":%d,\"p50\":%.1f,\"p95\":%.1f,\"p99\":%.1f,\"max\":%.1f}", lbl, n, e+0, a[int(n*0.5)], a[int(n*0.95)], a[int(n*0.99)], a[n] }' "$d/out"
  rm -rf "$d"
}

echo "decomposing $ENGINE ($URL) over $REQUESTS reqs x 3 shapes"
{ printf '{"engine":"%s",' "$ENGINE"
  time_shape match "$F_MATCH"; printf ','
  time_shape bool  "$F_BOOL";  printf ','
  time_shape full  "$F_FULL"
  printf '}\n'; } | tee "$OUT/decompose-$ENGINE.json"
rm -f "$F_MATCH" "$F_BOOL" "$F_FULL"
