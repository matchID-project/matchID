#!/usr/bin/env bash
set -euo pipefail

makefile="${1:-packages/deces-backend/Makefile}"

target="$(
  awk '
    /^backend-start:/ { inside = 1; print; next }
    inside && /^[^[:space:]#][^:]*:/ { exit }
    inside { print }
  ' "${makefile}"
)"

fail() {
  printf 'backend-start probe check failed: %s\n' "$1" >&2
  exit 1
}

[[ "${target}" == *"timeout --kill-after=2s 5s docker exec"* ]] || fail "docker exec readiness probe is not hard-kill bounded"
[[ "${target}" == *"--connect-timeout 2"* ]] || fail "curl probe is missing a connect timeout"
[[ "${target}" == *"--max-time 4"* ]] || fail "curl probe is missing a total timeout"
[[ "${target}" == *'started=$$(date +%s)'* ]] || fail "startup loop does not record wall-clock start time"
[[ "${target}" == *'deadline=$$((started + BACKEND_TIMEOUT))'* ]] || fail "startup loop is not bounded by wall-clock deadline"
[[ "${target}" != *'timeout=${BACKEND_TIMEOUT}'* ]] || fail "startup loop still treats retry count as elapsed seconds"
[[ "${target}" == *"/deces/api/v1/healthcheck"* ]] || fail "startup probe must use healthcheck, not a version endpoint backed by Elasticsearch"
[[ "${target}" != *"/deces/api/v1/version"* ]] || fail "startup probe still depends on the version endpoint"
[[ "${target}" == *"docker logs --tail 200 \${APP_BACKEND}"* ]] || fail "backend logs are not dumped on startup failure"

printf 'backend-start probe check: ok\n'
