#!/usr/bin/env bash
set -u

ENGINE=${ENGINE:?ENGINE=es|surch}
OUT=${OUT_DIR:-surch-eval/ci/reports}
SUMMARY_ENGINE="$OUT/summary-$ENGINE.md"
SUMMARY="$OUT/summary.md"
mkdir -p "$OUT"

json_value() {
  local file="$1" expr="$2" fallback="${3:-n/a}"
  if [ -s "$file" ]; then
    jq -r "$expr // \"$fallback\"" "$file" 2>/dev/null || printf '%s\n' "$fallback"
  else
    printf '%s\n' "$fallback"
  fi
}

idx="$OUT/indexation-$ENGINE.json"
rss="$OUT/rss-$ENGINE.json"
lat="$OUT/latency-$ENGINE.json"
dec="$OUT/decompose-$ENGINE.json"

{
  echo "# surch-eval perf summary ($ENGINE)"
  echo
  echo "## Configuration"
  echo
  echo "- files_to_process: ${FILES_TO_PROCESS:-n/a}"
  echo "- repository_bucket: ${REPOSITORY_BUCKET:-n/a}"
  echo "- es_backup_name: ${ES_BACKUP_NAME:-n/a}"
  echo "- expected_count: ${EXPECTED_COUNT:-n/a}"
  echo "- runner_label: ${RUNNER_LABEL:-n/a}"
  echo "- probe_workers: ${PROBE_WORKERS:-n/a}"
  echo
  echo "## Indexation"
  echo
  echo "- verdict: $(json_value "$idx" '.verdict')"
  echo "- failure: $(json_value "$idx" '.failure')"
  echo "- docs/count/expected: $(json_value "$idx" '.docs') / $(json_value "$idx" '.count') / $(json_value "$idx" '.expected_count')"
  echo "- bulk_s / total_s / dump_s: $(json_value "$idx" '.bulk_s') / $(json_value "$idx" '.total_s') / $(json_value "$idx" '.dump_s')"
  echo "- docs_per_second: $(json_value "$idx" '.docs_per_second')"
  echo "- chunks: $(json_value "$idx" '.chunks')"
  echo
  echo "## RSS"
  echo
  echo "- container: $(json_value "$rss" '.container')"
  echo "- peak_mib / final_mib / samples: $(json_value "$rss" '.peak_mib') / $(json_value "$rss" '.final_mib') / $(json_value "$rss" '.samples')"
  echo
  echo "## Engine Latency"
  echo
  echo "- requests/errors: $(json_value "$lat" '.requests') / $(json_value "$lat" '.errors')"
  echo "- p50/p95/p99/max ms: $(json_value "$lat" '.p50_ms') / $(json_value "$lat" '.p95_ms') / $(json_value "$lat" '.p99_ms') / $(json_value "$lat" '.max_ms')"
  echo
  echo "## Decompose"
  echo
  echo "- match p50/p95/p99/max: $(json_value "$dec" '.match.p50') / $(json_value "$dec" '.match.p95') / $(json_value "$dec" '.match.p99') / $(json_value "$dec" '.match.max')"
  echo "- bool p50/p95/p99/max: $(json_value "$dec" '.bool.p50') / $(json_value "$dec" '.bool.p95') / $(json_value "$dec" '.bool.p99') / $(json_value "$dec" '.bool.max')"
  echo "- full p50/p95/p99/max: $(json_value "$dec" '.full.p50') / $(json_value "$dec" '.full.p95') / $(json_value "$dec" '.full.p99') / $(json_value "$dec" '.full.max')"
} > "$SUMMARY_ENGINE"

cp "$SUMMARY_ENGINE" "$SUMMARY"
