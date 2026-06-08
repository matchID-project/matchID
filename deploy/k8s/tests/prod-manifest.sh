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
grep -Fq 'name: matchid-log-forwarder' "$rendered"
grep -Fq 'Path              /var/log/containers/*_matchid-prod_*.log' "$rendered"
grep -Fq 'Record service.name deces-matchid-prod' "$rendered"
grep -Fq 'Record environment prod' "$rendered"
grep -Fq 'Record k8s.namespace.name matchid-prod' "$rendered"
grep -Fq 'Host              log-api.eu.newrelic.com' "$rendered"
grep -Fq 'name: elasticsearch-restore' "$rendered"
grep -Fq 'name: SNAPSHOT_NAME' "$rendered"
grep -Fq 'name: STORAGE_ACCESS_KEY' "$rendered"
grep -Fq 'name: STORAGE_SECRET_KEY' "$rendered"
grep -Fq 'value: fichier-des-personnes-decedees-elasticsearch' "$rendered"
