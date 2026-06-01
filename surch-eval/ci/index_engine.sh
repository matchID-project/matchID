#!/bin/bash
# Indexation chronometree d'UN moteur (es|surch), corpus reel deja restaure dans
# ES (`deces`). Isolation : ce script tourne dans le job dedie au moteur, l'AUTRE
# moteur n'est PAS resident -> pas de contention CPU.
#
# - ENGINE=es    : dump `deces` (ES) -> bulk index frais `deces_bench` (ES), time.
# - ENGINE=surch : dump `deces` (ES) -> bulk `deces` (Surch), time. (Surch sert
#   ensuite l'artillery.)
# Bulk SERIE, aucune lecture concurrente (bug concurrence Surch documente cote surch).
set -euo pipefail
ENGINE=${ENGINE:?ENGINE=es|surch}
ES=${ES_URL:-http://elasticsearch:9200}
SU=${SURCH_URL:-http://surch:9200}
OUT=${OUT_DIR:-/ci/reports}; mkdir -p "$OUT"
EXPECTED_COUNT=${EXPECTED_COUNT:-}
SCROLL_SIZE=${SCROLL_SIZE:-${BULK_DOCS_PER_CHUNK:-10000}}
TMP_DIR=$(mktemp -d)
schema="matchid.surch_eval.indexation.v2"
docs=0
count=0
source_count=0
chunks=0
bulk_s=0
total_s=0
total_t0=0
dump_s=0
bulk_failures=0

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

elapsed() {
  awk -v a="$1" -v b="$2" 'BEGIN { printf "%.9f", b - a }'
}

add_float() {
  awk -v a="$1" -v b="$2" 'BEGIN { printf "%.9f", a + b }'
}

write_result() {
  local verdict="$1" failure="${2:-}"
  local measured_total_s="$total_s"
  if awk -v total="$measured_total_s" -v start="$total_t0" 'BEGIN { exit !(total == 0 && start > 0) }'; then
    measured_total_s=$(elapsed "$total_t0" "$(date +%s.%N)")
  fi
  dump_s=$(awk -v total="$measured_total_s" -v bulk="$bulk_s" 'BEGIN { d = total - bulk; if (d < 0) d = 0; printf "%.9f", d }')
  if [ "$total_s" = "0" ]; then
    total_s="$measured_total_s"
  fi
  jq -n \
    --arg schema "$schema" \
    --arg engine "$ENGINE" \
    --arg target_index "${TIDX:-}" \
    --arg expected "$EXPECTED_COUNT" \
    --arg verdict "$verdict" \
    --arg failure "$failure" \
    --argjson docs "$docs" \
    --argjson count "$count" \
    --argjson source_count "$source_count" \
    --argjson chunks "$chunks" \
    --argjson bulk_s "$bulk_s" \
    --argjson total_s "$total_s" \
    --argjson dump_s "$dump_s" \
    --argjson bulk_failures "$bulk_failures" \
    '{
      schema: $schema,
      engine: $engine,
      target_index: $target_index,
      expected_count: (if ($expected | test("^[0-9]+$")) then ($expected | tonumber) else null end),
      source_count: $source_count,
      docs: $docs,
      count: $count,
      chunks: $chunks,
      bulk_s: $bulk_s,
      total_s: $total_s,
      dump_s: $dump_s,
      docs_per_second: (if $bulk_s > 0 then ($docs / $bulk_s) else null end),
      count_matches_docs: ($count == $docs),
      expected_count_matches: (if ($expected | test("^[0-9]+$")) then (($expected | tonumber) == $docs and ($expected | tonumber) == $count) else null end),
      bulk_failures: $bulk_failures,
      verdict: $verdict,
      failure: (if $failure == "" then null else $failure end)
    }' | tee "$OUT/indexation-$ENGINE.json"
}

fail_result() {
  local message="$1"
  trap - ERR
  write_result "fail" "$message"
  exit 1
}

on_err() {
  local line="$1"
  fail_result "script_error_line_${line}"
}
trap 'on_err $LINENO' ERR

case "$ENGINE" in
  es|surch) ;;
  *) fail_result "invalid_engine" ;;
esac

# mapping reel depuis ES
if [ -n "$EXPECTED_COUNT" ]; then
  case "$EXPECTED_COUNT" in
    *[!0-9]*) fail_result "expected_count_not_integer" ;;
  esac
fi
case "$SCROLL_SIZE" in
  ''|*[!0-9]*) fail_result "scroll_size_not_integer" ;;
esac

MAP=$(curl -fsS "$ES/deces/_mapping" | jq '.deces.mappings')
source_count=$(curl -fsS "$ES/deces/_count" | jq '.count')

if [ "$ENGINE" = "surch" ]; then
  TARGET="$SU"; TIDX="deces"
  ANA=$(curl -fsS "$ES/deces/_settings" | jq '.deces.settings.index.analysis | del(.tokenizer.edge_tokenizer2) | del(.analyzer.autocomplete_analyzer)')
  jq -n --argjson m "$MAP" --argjson a "$ANA" '{settings:{analysis:$a}, mappings:$m}' > "$OUT/create-$ENGINE.json"
else
  TARGET="$ES"; TIDX="deces_bench"
  ANA=$(curl -fsS "$ES/deces/_settings" | jq '.deces.settings.index.analysis')
  jq -n --argjson m "$MAP" --argjson a "$ANA" '{settings:{index:{number_of_replicas:0,refresh_interval:"30s"},analysis:$a}, mappings:$m}' > "$OUT/create-$ENGINE.json"
fi

curl -s -XDELETE "$TARGET/$TIDX" >/dev/null 2>&1
curl -fsS -XPUT "$TARGET/$TIDX" -H 'Content-Type: application/json' --data-binary @"$OUT/create-$ENGINE.json" >/dev/null

total_t0=$(date +%s.%N)
resp=$(curl -fsS "$ES/deces/_search?scroll=10m&size=$SCROLL_SIZE" -H 'Content-Type: application/json' -d '{"query":{"match_all":{}},"sort":["_doc"]}')
while :; do
  sid=$(printf '%s' "$resp" | jq -r '._scroll_id')
  n=$(printf '%s' "$resp" | jq '.hits.hits|length')
  [ "$n" -eq 0 ] && break
  chunks=$((chunks + 1))
  chunk="$TMP_DIR/dc_${chunks}.ndjson"
  printf '%s' "$resp" | jq -rc '.hits.hits[] | ({index:{_id:._id}}), ._source' > "$chunk"
  lines=$(wc -l < "$chunk")
  [ $((lines % 2)) -eq 0 ] || fail_result "odd_ndjson_lines_chunk_${chunks}"
  chunk_docs=$((lines / 2))
  docs=$((docs + chunk_docs))
  bulk_t0=$(date +%s.%N)
  set +e
  http_code=$(curl -sS -o "$OUT/bulk-response-$ENGINE-$chunks.json" -w '%{http_code}' -XPOST "$TARGET/$TIDX/_bulk" -H 'Content-Type: application/x-ndjson' --data-binary @"$chunk")
  curl_rc=$?
  set -e
  bulk_t1=$(date +%s.%N)
  bulk_dt=$(elapsed "$bulk_t0" "$bulk_t1")
  bulk_s=$(add_float "$bulk_s" "$bulk_dt")
  if [ "$curl_rc" -ne 0 ]; then
    bulk_failures=$((bulk_failures + 1))
    fail_result "bulk_curl_${curl_rc}_chunk_${chunks}"
  fi
  if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
    bulk_failures=$((bulk_failures + 1))
    fail_result "bulk_http_${http_code}_chunk_${chunks}"
  fi
  if ! jq -e '.errors == false' "$OUT/bulk-response-$ENGINE-$chunks.json" >/dev/null; then
    bulk_failures=$((bulk_failures + 1))
    fail_result "bulk_errors_chunk_${chunks}"
  fi
  rm -f "$chunk" "$OUT/bulk-response-$ENGINE-$chunks.json"
  resp=$(curl -fsS "$ES/_search/scroll" -H 'Content-Type: application/json' -d "{\"scroll\":\"10m\",\"scroll_id\":\"$sid\"}")
done
curl -fsS -XPOST "$TARGET/$TIDX/_refresh" >/dev/null
total_t1=$(date +%s.%N)
total_s=$(elapsed "$total_t0" "$total_t1")
count=$(curl -fsS "$TARGET/$TIDX/_count" | jq .count)
[ "$ENGINE" = "es" ] && curl -s -XDELETE "$TARGET/$TIDX" >/dev/null 2>&1   # bench index jetable

[ "$docs" -eq "$source_count" ] || fail_result "source_docs_mismatch"
[ "$docs" -eq "$count" ] || fail_result "docs_count_mismatch"
if [ -n "$EXPECTED_COUNT" ]; then
  [ "$docs" -eq "$EXPECTED_COUNT" ] || fail_result "docs_expected_count_mismatch"
  [ "$count" -eq "$EXPECTED_COUNT" ] || fail_result "count_expected_count_mismatch"
fi

write_result "pass" ""
