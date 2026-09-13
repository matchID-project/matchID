#!/usr/bin/env bash

set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
subject="$root_dir/deploy/k8s/scripts/recover-stuck-statefulset.sh"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cat > "$tmp_dir/kubectl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

case "$*" in
  *" get pod elasticsearch-0 -o jsonpath="*)
    printf '%s\t%s' "$POD_REVISION" "$POD_READY"
    ;;
  *" get pod elasticsearch-0")
    ;;
  *" get statefulset elasticsearch -o jsonpath="*)
    printf '5\t5\t%s' "$DESIRED_REVISION"
    ;;
  *" delete pod elasticsearch-0")
    printf 'delete\n' >> "$KUBECTL_TEST_LOG"
    ;;
  *)
    echo "unexpected kubectl call: $*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "$tmp_dir/kubectl"

export PATH="$tmp_dir:$PATH"
export KUBECTL_TEST_LOG="$tmp_dir/calls"

assert_deleted() {
  local pod_revision="$1"
  local pod_ready="$2"

  : > "$KUBECTL_TEST_LOG"
  DESIRED_REVISION=new POD_REVISION="$pod_revision" POD_READY="$pod_ready" \
    bash "$subject" matchid-dev elasticsearch >/dev/null
  grep -qx delete "$KUBECTL_TEST_LOG"
}

assert_not_deleted() {
  local pod_revision="$1"
  local pod_ready="$2"

  : > "$KUBECTL_TEST_LOG"
  DESIRED_REVISION=new POD_REVISION="$pod_revision" POD_READY="$pod_ready" \
    bash "$subject" matchid-dev elasticsearch >/dev/null
  test ! -s "$KUBECTL_TEST_LOG"
}

assert_deleted old False
assert_not_deleted new False
assert_not_deleted old True

echo "recover-stuck-statefulset tests passed"
