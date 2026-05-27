#!/bin/bash
# Indexation chronométrée corpus réel : ES (source, déjà monté + restauré par
# `make deploy-dependencies`) -> Surch, et -> index ES frais, pour comparer.
#
# Validé LOCALEMENT à petite/série échelle (cf. surch-eval/README.md : Surch 426s
# vs ES 834s sur 1,36M). En CI il faut adapter les endpoints réseau (ci-dessous
# via des conteneurs curl/jq sur le réseau matchID — À AJUSTER selon le runner).
#
# IMPORTANT : bulk SÉRIE, sans lecture concurrente. Un bug de concurrence Surch
# (search/_count pendant un bulk soutenu -> hang) est documenté côté surch
# (docs/wp-a-perf-followups-concurrent-bulk-search-stall.md). Ne PAS interroger
# Surch pendant le bulk.
set -u
ES=${ES_URL:-http://elasticsearch:9200}     # ES baseline (corpus restauré)
SU=${SURCH_URL:-http://surch:9200}           # Surch
IDX=${ES_INDEX:-deces}
OUT=${OUT_DIR:-surch-eval/ci/reports}; mkdir -p "$OUT"
DUMP=/tmp/deces-real.bulk.ndjson

# 0) mapping réel depuis ES -> créer l'index Surch (edge_ngram inutilisé retiré ;
#    Surch >= main 5061b88 supporte short/byte).
MAP=$(curl -s "$ES/$IDX/_mapping" | jq ".\"$IDX\".mappings")
ANA=$(curl -s "$ES/$IDX/_settings" | jq ".\"$IDX\".settings.index.analysis | del(.tokenizer.edge_tokenizer2) | del(.analyzer.autocomplete_analyzer)")
jq -n --argjson m "$MAP" --argjson a "$ANA" '{settings:{analysis:$a}, mappings:$m}' > "$OUT/surch-create.json"
curl -s -XDELETE "$SU/$IDX" >/dev/null 2>&1
curl -s -XPUT "$SU/$IDX" -H 'Content-Type: application/json' --data-binary @"$OUT/surch-create.json" >/dev/null

# 1) dump ES -> bulk ndjson (action sans _index ; l'URL fixe la cible). UNTIMED.
: > "$DUMP"
resp=$(curl -s "$ES/$IDX/_search?scroll=10m&size=10000" -H 'Content-Type: application/json' -d '{"query":{"match_all":{}},"sort":["_doc"]}')
while :; do
  sid=$(printf '%s' "$resp" | jq -r '._scroll_id'); n=$(printf '%s' "$resp" | jq '.hits.hits|length')
  [ "$n" -eq 0 ] && break
  printf '%s' "$resp" | jq -rc '.hits.hits[] | ({index:{_id:._id}}), ._source' >> "$DUMP"
  resp=$(curl -s "$ES/_search/scroll" -H 'Content-Type: application/json' -d "{\"scroll\":\"10m\",\"scroll_id\":\"$sid\"}")
done
docs=$(( $(wc -l < "$DUMP") / 2 )); rm -f /tmp/dc_*; split -l 20000 "$DUMP" /tmp/dc_

# 2) SURCH bulk SÉRIE chronométré (aucune lecture concurrente)
S0=$(date +%s.%N); for c in /tmp/dc_*; do curl -s -o /dev/null -XPOST "$SU/$IDX/_bulk" -H 'Content-Type: application/x-ndjson' --data-binary @"$c"; done; S1=$(date +%s.%N)
curl -s -XPOST "$SU/$IDX/_refresh" >/dev/null
SURCH_S=$(echo "$S1 - $S0" | bc); SURCH_CNT=$(curl -s "$SU/$IDX/_count" | jq .count)

# 3) ES bulk SÉRIE chronométré dans un index frais
curl -s -XDELETE "$ES/${IDX}_bulk" >/dev/null 2>&1
curl -s -XPUT "$ES/${IDX}_bulk" -H 'Content-Type: application/json' --data-binary @"$OUT/surch-create.json" >/dev/null 2>&1 \
  || curl -s -XPUT "$ES/${IDX}_bulk" >/dev/null
E0=$(date +%s.%N); for c in /tmp/dc_*; do curl -s -o /dev/null -XPOST "$ES/${IDX}_bulk/_bulk" -H 'Content-Type: application/x-ndjson' --data-binary @"$c"; done; E1=$(date +%s.%N)
curl -s -XPOST "$ES/${IDX}_bulk/_refresh" >/dev/null
ES_S=$(echo "$E1 - $E0" | bc); ES_CNT=$(curl -s "$ES/${IDX}_bulk/_count" | jq .count)

printf '{"docs":%s,"surch_bulk_s":%s,"surch_count":%s,"es_bulk_s":%s,"es_count":%s}\n' \
  "$docs" "$SURCH_S" "$SURCH_CNT" "$ES_S" "$ES_CNT" | tee "$OUT/indexation.json"
rm -f /tmp/dc_* "$DUMP"
