#!/usr/bin/env bash
set -euo pipefail

makefile="${1:-packages/tools/Makefile}"

fail() {
  printf 'current instance publish check failed: %s\n' "$1" >&2
  exit 1
}

content="$(cat "$makefile")"

grep -q 'CURRENT_SCW_SERVER_ID=$$(cat ${CLOUD_SERVER_ID_FILE} 2>/dev/null || true)' <<<"$content" \
  || fail "tagged host resolution does not read the current SCW server id"

grep -q 'select(.id == $$current)' <<<"$content" \
  || fail "tagged host resolution does not prefer the current SCW server"

grep -q -- '--arg current "$$CURRENT_SCW_SERVER_ID"' <<<"$content" \
  || fail "SCW jq filters do not receive the current server id"

grep -q '(.id != $$current)' <<<"$content" \
  || fail "invalid cleanup does not exclude the current SCW server"

grep -q 'test-current-instance-publish:' <<<"$content" \
  || fail "Makefile target for current instance publish test is missing"

printf 'current instance publish check: ok\n'
