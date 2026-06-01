#!/usr/bin/env bash
set -euo pipefail

ENGINE=${1:?engine}
CONTAINER=${2:?container}
OUT=${3:?out}
INTERVAL=${4:-1}

mkdir -p "$(dirname "$OUT")"
samples=0
peak_mib=0
final_mib=0
wrote=0

to_mib() {
  awk -v s="$1" 'BEGIN {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
    n = s + 0
    if (s ~ /KiB$/) n = n / 1024
    else if (s ~ /MiB$/) n = n
    else if (s ~ /GiB$/) n = n * 1024
    else if (s ~ /TiB$/) n = n * 1024 * 1024
    else if (s ~ /kB$/) n = n / 1000
    else if (s ~ /MB$/) n = n
    else if (s ~ /GB$/) n = n * 1000
    else if (s ~ /B$/) n = n / 1024 / 1024
    printf "%.1f", n
  }'
}

greater_than() {
  awk -v a="$1" -v b="$2" 'BEGIN { exit !(a > b) }'
}

write_json() {
  [ "$wrote" -eq 0 ] || return 0
  wrote=1
  jq -n \
    --arg schema "matchid.surch_eval.rss.v1" \
    --arg engine "$ENGINE" \
    --arg container "$CONTAINER" \
    --argjson samples "$samples" \
    --argjson peak_mib "$peak_mib" \
    --argjson final_mib "$final_mib" \
    '{schema:$schema,engine:$engine,container:$container,samples:$samples,peak_mib:$peak_mib,final_mib:$final_mib}'
}

finish() {
  if [ "$wrote" -eq 0 ]; then
    write_json > "$OUT"
  fi
  exit 0
}
trap finish INT TERM EXIT

while :; do
  raw=$(docker stats --no-stream --format '{{.MemUsage}}' "$CONTAINER" 2>/dev/null | awk '{print $1}' || true)
  if [ -n "$raw" ]; then
    mib=$(to_mib "$raw")
    final_mib="$mib"
    samples=$((samples + 1))
    if greater_than "$mib" "$peak_mib"; then
      peak_mib="$mib"
    fi
  fi
  sleep "$INTERVAL"
done
