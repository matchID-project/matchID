#!/usr/bin/env bash
# matchid-dev deces Deployments are scaled by the platform KEDA HTTP add-on:
# the dev overlay must leave their replica count to KEDA.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

kubectl kustomize "$repo_root/deploy/k8s/overlays/dev" > "$rendered"

# Print "<kind>/<name> replicas" for every rendered object that sets
# spec.replicas (two-space indent under a top-level `spec:`).
with_replicas="$(
  awk '
    /^---/ { kind = ""; name = ""; in_spec = 0; next }
    /^kind: / { kind = $2 }
    /^metadata:/ { in_meta = 1; next }
    in_meta && /^  name: / { name = $2; in_meta = 0 }
    /^[^ ]/ && !/^metadata:/ { in_meta = 0 }
    /^spec:/ { in_spec = 1; next }
    /^[^ ]/ { in_spec = 0 }
    in_spec && /^  replicas: / { print kind "/" name " replicas" }
  ' "$rendered"
)"

for deployment in deces-backend deces-ui; do
  grep -Fq "name: $deployment" "$rendered"
  if grep -Fxq "Deployment/$deployment replicas" <<< "$with_replicas"; then
    echo "Deployment $deployment must not set replicas in the dev overlay (KEDA owns it)" >&2
    exit 1
  fi
done

# Stateful dependencies are not HTTP-wakeable and stay always on.
grep -Fxq 'StatefulSet/elasticsearch replicas' <<< "$with_replicas"
grep -Fxq 'StatefulSet/redis replicas' <<< "$with_replicas"

echo "dev scale-to-zero manifest tests passed"
