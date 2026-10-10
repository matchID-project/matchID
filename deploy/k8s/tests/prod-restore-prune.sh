#!/usr/bin/env bash
set -euo pipefail

# Behavioural test for prune_stale_indices() in the prod elasticsearch-restore Job.
#
# Regression guard for the 2026-09-14 incident: three full copies of the deces
# index (45.5 GB) had accumulated on a 59 GB volume because the restore Job never
# removed the index it superseded. The next monthly restore would have run out of
# disk. The function is extracted from the *rendered* prod overlay and exercised
# against a stubbed Elasticsearch, so the test covers what actually ships.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

kubectl kustomize "$repo_root/deploy/k8s/overlays/prod" > "$workdir/rendered.yaml"
# Plain text extraction, no YAML parser: kustomize renders the Job script as a
# block scalar, so the function is the indented block from its definition to the
# closing brace at the same indentation.
awk '
  !found && match($0, /^ *prune_stale_indices\(\) \{$/) { found = 1; indent = RLENGTH - length("prune_stale_indices() {") }
  found { print substr($0, indent + 1) }
  found && $0 == sprintf("%" indent "s}", "") { exit }
' "$workdir/rendered.yaml" > "$workdir/prune_fn.sh"
[ "$(tail -n 1 "$workdir/prune_fn.sh" 2>/dev/null)" = "}" ] || {
  echo "prune_stale_indices() not found in the rendered restore Job" >&2
  exit 1
}
sed 's/^ *//' "$workdir/rendered.yaml" > "$workdir/script-lines.txt"

# The prune must run only after the alias switch has been verified and the marker
# written, otherwise a failed switch would delete the index still serving traffic.
grep -A1 '^write_marker$' "$workdir/script-lines.txt" | grep -q '^prune_stale_indices$' || {
  echo "prune_stale_indices must run immediately after write_marker" >&2
  exit 1
}
# When the requested snapshot is already live, the restore is skipped; the prune
# still runs there so copies left by earlier restores get cleared.
grep -A2 'from $SNAPSHOT_NAME; skipping restore"$' "$workdir/script-lines.txt" | grep -q '^prune_stale_indices$' || {
  echo "prune_stale_indices must run when the restore is skipped for a live snapshot" >&2
  exit 1
}

cat > "$workdir/harness.sh" <<'EOF'
set -eu
ES_URL="http://es"; ES_INDEX="deces"; TARGET_INDEX="deces-esdata_new"
DELETED="$(mktemp)"

# Stubbed Elasticsearch: _cat/aliases and _cat/indices answer from $ALIASED and
# $INDICES; DELETE records the index, or fails for the one named by $FAIL_ON.
curl() {
  _url=""; _del=0
  for a in "$@"; do
    case "$a" in -XDELETE) _del=1 ;; http://*) _url="$a" ;; esac
  done
  if [ "$_del" = 1 ]; then
    case "$_url" in *"$FAIL_ON") return 22 ;; esac
    echo "${_url##*/}" >> "$DELETED"; return 0
  fi
  case "$_url" in
    *_cat/aliases*) printf '%s\n' $ALIASED ;;
    *_cat/indices*) printf '%s\n' $INDICES ;;
  esac
}
. "$1"

run() {
  : > "$DELETED"; ALIASED="$2"; INDICES="$3"; FAIL_ON="${4:-__none__}"
  got="$(prune_stale_indices >/dev/null 2>&1; sort "$DELETED" | tr '\n' ' ' | sed 's/ $//')"
  if [ "$got" = "$5" ]; then
    echo "  ok  $1"
  else
    echo "  FAIL  $1: pruned [$got], expected [$5]" >&2
    exit 1
  fi
}

echo "prune_stale_indices:"
# The incident itself: two superseded copies alongside the freshly restored one.
run "prunes superseded copies, keeps the target" \
  "deces-esdata_new" "deces-esdata_old1 deces-esdata_old2 deces-esdata_new" "" \
  "deces-esdata_old1 deces-esdata_old2"
run "no-op when only the target exists" \
  "deces-esdata_new" "deces-esdata_new" "" ""
# Defensive: never delete something the alias still resolves to, whatever the cause.
run "keeps an index still serving the alias" \
  "deces-esdata_new deces-esdata_old1" "deces-esdata_old1 deces-esdata_new" "" ""
run "never prunes the target, even when the alias points elsewhere" \
  "deces-esdata_other" "deces-esdata_old1 deces-esdata_other deces-esdata_new" "" \
  "deces-esdata_old1"
# Without the alias, live indices cannot be told apart: prune nothing.
run "skips the prune when the alias cannot be read" \
  "" "deces-esdata_old1 deces-esdata_new" "" ""
run "no-op on an empty index list" \
  "deces-esdata_new" "" "" ""
# Best-effort: the restore already succeeded, a failed prune must not fail the Job.
run "survives a failing delete and prunes the rest" \
  "deces-esdata_new" "deces-esdata_old1 deces-esdata_old2 deces-esdata_new" "old1" \
  "deces-esdata_old2"
EOF

sh "$workdir/harness.sh" "$workdir/prune_fn.sh"
echo "prod restore prune: all scenarios passed"
