#!/usr/bin/env bash
set -euo pipefail

makefile="${1:-packages/tools/Makefile}"

fail() {
  printf 'remote ssh timeout check failed: %s\n' "$1" >&2
  exit 1
}

content="$(cat "$makefile")"

grep -q '^SSH_CONNECT_TIMEOUT = 5$' <<<"$content" \
  || fail "SSH_CONNECT_TIMEOUT default is missing"

grep -q 'SSHOPTS=.*-o ConnectTimeout=${SSH_CONNECT_TIMEOUT}' <<<"$content" \
  || fail "SSHOPTS does not bound SSH connect/banner wait"

grep -q 'SSHOPTS=.*-o ConnectionAttempts=1' <<<"$content" \
  || fail "SSHOPTS does not disable repeated SSH connection attempts"

grep -q 'cmd: ssh ${SSHOPTS}' <<<"$content" \
  || fail "verbose wait-ssh command does not reflect SSHOPTS"

if grep -q 'cmd: ssh ${SSHOPTS} -o ConnectTimeout=1' <<<"$content"; then
  fail "verbose wait-ssh command still advertises stale ConnectTimeout=1"
fi

printf 'remote ssh timeout check: ok\n'
