#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

kubectl kustomize "$repo_root/deploy/k8s/overlays/prod" > "$rendered"

grep -Fq 'namespace: matchid-prod' "$rendered"
grep -Fq 'host: deces.matchid.io' "$rendered"
grep -Fq 'value: deces.matchid.io' "$rendered"
grep -Fq 'value: https://deces.matchid.io' "$rendered"
grep -Fq 'name: deces-backend-secrets' "$rendered"
grep -Fq 'secretName: deces-backend-userdb' "$rendered"
grep -Fq 'mountPath: /run/secrets/deces-backend/userDB.json' "$rendered"
grep -Fq 'k8s.scaleway.com/pool-name: matchid' "$rendered"
