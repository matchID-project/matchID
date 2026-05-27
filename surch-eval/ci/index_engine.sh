#!/bin/bash
# Indexation chronometree d'UN moteur (es|surch), corpus reel deja restaure dans
# ES (`deces`). Isolation : ce script tourne dans le job dedie au moteur, l'AUTRE
# moteur n'est PAS resident -> pas de contention CPU.
#
# - ENGINE=es    : dump `deces` (ES) -> bulk index frais `deces_bench` (ES), time.
# - ENGINE=surch : dump `deces` (ES) -> bulk `deces` (Surch), time. (Surch sert
#   ensuite l'artillery.)
# Bulk SERIE, aucune lecture concurrente (bug concurrence Surch documente cote surch).
set -u
ENGINE=${ENGINE:?ENGINE=es|surch}
ES=${ES_URL:-http://elasticsearch:9200}
SU=${SURCH_URL:-http://surch:9200}
OUT=${OUT_DIR:-/ci/reports}; mkdir -p "$OUT"
DUMP=/tmp/deces.ndjson

# mapping reel depuis ES
MAP=$(curl -s "$ES/deces/_mapping" | jq '.deces.mappings')
# 1) dump ES deces -> bulk ndjson (action sans _index ; l'URL fixe la cible)
: > "$DUMP"
resp=$(curl -s "$ES/deces/_search?scroll=10m&size=10000" -H 'Content-Type: application/json' -d '{"query":{"match_all":{}},"sort":["_doc"]}')
while :; do
  sid=$(printf '%s' "$resp" | jq -r '._scroll_id'); n=$(printf '%s' "$resp" | jq '.hits.hits|length')
  [ "$n" -eq 0 ] && break
  printf '%s' "$resp" | jq -rc '.hits.hits[] | ({index:{_id:._id}}), ._source' >> "$DUMP"
  resp=$(curl -s "$ES/_search/scroll" -H 'Content-Type: application/json' -d "{\"scroll\":\"10m\",\"scroll_id\":\"$sid\"}")
done
docs=$(( $(wc -l < "$DUMP") / 2 )); rm -f /tmp/dc_*; split -l 20000 "$DUMP" /tmp/dc_

if [ "$ENGINE" = "surch" ]; then
  TARGET="$SU"; TIDX="deces"
  ANA=$(curl -s "$ES/deces/_settings" | jq '.deces.settings.index.analysis | del(.tokenizer.edge_tokenizer2) | del(.analyzer.autocomplete_analyzer)')
  jq -n --argjson m "$MAP" --argjson a "$ANA" '{settings:{analysis:$a}, mappings:$m}' > "$OUT/create-$ENGINE.json"
else
  TARGET="$ES"; TIDX="deces_bench"
  ANA=$(curl -s "$ES/deces/_settings" | jq '.deces.settings.index.analysis')
  jq -n --argjson m "$MAP" --argjson a "$ANA" '{settings:{index:{number_of_replicas:0,refresh_interval:"30s"},analysis:$a}, mappings:$m}' > "$OUT/create-$ENGINE.json"
fi

curl -s -XDELETE "$TARGET/$TIDX" >/dev/null 2>&1
curl -s -XPUT "$TARGET/$TIDX" -H 'Content-Type: application/json' --data-binary @"$OUT/create-$ENGINE.json" >/dev/null

T0=$(date +%s.%N)
for c in /tmp/dc_*; do curl -s -o /dev/null -XPOST "$TARGET/$TIDX/_bulk" -H 'Content-Type: application/x-ndjson' --data-binary @"$c"; done
T1=$(date +%s.%N)
curl -s -XPOST "$TARGET/$TIDX/_refresh" >/dev/null
BULK_S=$(echo "$T1 - $T0" | bc); CNT=$(curl -s "$TARGET/$TIDX/_count" | jq .count)
[ "$ENGINE" = "es" ] && curl -s -XDELETE "$TARGET/$TIDX" >/dev/null 2>&1   # bench index jetable

printf '{"engine":"%s","docs":%s,"bulk_s":%s,"count":%s}\n' "$ENGINE" "$docs" "$BULK_S" "$CNT" | tee "$OUT/indexation-$ENGINE.json"
rm -f /tmp/dc_* "$DUMP"
