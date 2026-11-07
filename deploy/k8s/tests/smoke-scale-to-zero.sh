#!/usr/bin/env bash

set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
subject="$root_dir/deploy/k8s/scripts/smoke-scale-to-zero.sh"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cat > "$tmp_dir/kubectl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

case "$*" in
  *" get deployment deces-backend -o jsonpath="*)
    printf '%s' "$BACKEND_IMAGE"
    ;;
  *" get deployment deces-ui -o jsonpath="*)
    printf '%s' "$UI_IMAGE"
    ;;
  *" rollout status deployment/"*)
    args="$*"
    printf 'rollout %s\n' "${args##* rollout status }" >> "$TEST_LOG"
    ;;
  *)
    echo "unexpected kubectl call: $*" >&2
    exit 1
    ;;
esac
EOF

# Fails the first $CURL_FAILURES calls (cold scale-from-zero), then succeeds.
cat > "$tmp_dir/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

count="$(cat "$CURL_COUNT" 2>/dev/null || echo 0)"
count=$((count + 1))
echo "$count" > "$CURL_COUNT"
url="${*: -1}"
printf 'curl %s\n' "$url" >> "$TEST_LOG"
if [ "$count" -le "$CURL_FAILURES" ]; then
  exit 28
fi
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    out="$2"
  fi
  shift
done
printf '{"msg":"OK"}' > "$out"
EOF
chmod +x "$tmp_dir/kubectl" "$tmp_dir/curl"

export PATH="$tmp_dir:$PATH"
export TEST_LOG="$tmp_dir/calls"
export CURL_COUNT="$tmp_dir/curl-count"
export SMOKE_RETRY_DELAY=0
export SMOKE_ATTEMPTS=3

run_subject() {
  : > "$TEST_LOG"
  rm -f "$CURL_COUNT"
  bash "$subject" matchid-dev dev.deces.matchid.io 1.0.0-abc 0.4.0-def >/dev/null 2>&1
}

# Nominal: both rollouts awaited, readiness smoked through the public host
# after one cold-start failure, then the UI.
BACKEND_IMAGE=matchid/deces-backend:1.0.0-abc UI_IMAGE=matchid/deces-ui:0.4.0-def \
  CURL_FAILURES=1 run_subject
grep -qx 'rollout deployment/deces-backend --timeout=10m' "$TEST_LOG"
grep -qx 'rollout deployment/deces-ui --timeout=10m' "$TEST_LOG"
[ "$(grep -c '^curl https://dev.deces.matchid.io/deces/api/v1/readiness$' "$TEST_LOG")" -eq 2 ]
grep -qx 'curl https://dev.deces.matchid.io/' "$TEST_LOG"

# A template still on another image fails before any rollout or smoke.
if BACKEND_IMAGE=matchid/deces-backend:old UI_IMAGE=matchid/deces-ui:0.4.0-def \
  CURL_FAILURES=0 run_subject; then
  echo "expected failure on image mismatch" >&2
  exit 1
fi
! grep -q '^rollout\|^curl' "$TEST_LOG"

# A host that never answers fails after SMOKE_ATTEMPTS tries.
if BACKEND_IMAGE=matchid/deces-backend:1.0.0-abc UI_IMAGE=matchid/deces-ui:0.4.0-def \
  CURL_FAILURES=99 run_subject; then
  echo "expected failure when the public host never answers" >&2
  exit 1
fi
[ "$(grep -c '^curl ' "$TEST_LOG")" -eq 3 ]

echo "smoke-scale-to-zero tests passed"
