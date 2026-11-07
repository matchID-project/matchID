#!/usr/bin/env bash
#
# Verify a deces deploy on a namespace whose Deployments are scaled to zero by
# the platform KEDA HTTP add-on (HTTPScaledObject, min 0 / max 1).
#
# KEDA owns the replica count there: an idle Deployment is deactivated to 0
# seconds after CI scales it up, so a pod port-forward or a
# `wait --for=condition=Available` cannot prove the deploy. Instead:
#   1. check the Deployment templates carry the expected image tags,
#   2. wait for the rollout of whatever replicas KEDA currently wants,
#   3. smoke through the public host: the request goes through the KEDA
#      interceptor, which wakes the Deployment (cold start ~10-30 s) from the
#      template applied in step 1.

set -euo pipefail

namespace="${1:?namespace is required}"
hostname="${2:?public hostname is required}"
backend_tag="${3:?deces-backend image tag is required}"
ui_tag="${4:?deces-ui image tag is required}"

attempts="${SMOKE_ATTEMPTS:-6}"
retry_delay="${SMOKE_RETRY_DELAY:-10}"
request_timeout="${SMOKE_REQUEST_TIMEOUT:-120}"
rollout_timeout="${ROLLOUT_TIMEOUT:-10m}"

check_template_image() {
  local deployment="$1"
  local expected="$2"
  local actual

  actual="$(
    kubectl -n "$namespace" get deployment "$deployment" \
      -o jsonpath="{.spec.template.spec.containers[?(@.name==\"$deployment\")].image}"
  )"
  if [ "$actual" != "$expected" ]; then
    echo "Deployment $deployment runs image '$actual', expected '$expected'" >&2
    return 1
  fi
  echo "Deployment $deployment template image: $actual"
}

smoke() {
  local path="$1"
  local url="https://$hostname$path"
  local body
  local attempt

  body="$(mktemp)"
  for attempt in $(seq 1 "$attempts"); do
    if curl -fsS -o "$body" -m "$request_timeout" \
      -w "$url -> %{http_code} in %{time_total}s\n" "$url"; then
      head -c 300 "$body"
      echo
      rm -f "$body"
      return 0
    fi
    echo "Smoke attempt $attempt/$attempts on $url failed" >&2
    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$retry_delay"
    fi
  done
  rm -f "$body"
  echo "$url did not answer after $attempts attempts" >&2
  return 1
}

check_template_image deces-backend "matchid/deces-backend:$backend_tag"
check_template_image deces-ui "matchid/deces-ui:$ui_tag"

for deployment in deces-backend deces-ui; do
  kubectl -n "$namespace" rollout status "deployment/$deployment" \
    --timeout="$rollout_timeout"
done

smoke /deces/api/v1/readiness
smoke /
