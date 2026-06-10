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
grep -Fq 'name: FORCE_RESTORE' "$rendered"
grep -Fq 'value: .matchid-restore-state' "$rendered"
grep -Fq 'rename_pattern' "$rendered"
grep -Fq '_aliases' "$rendered"
grep -Fq 'wait_for_status=green' "$rendered"
if grep -Fq 'XDELETE "$ES_URL/$ES_INDEX"' "$rendered"; then
  echo "restore must not delete the live ES_INDEX before restoring a replacement" >&2
  exit 1
fi
grep -Fq 'name: STORAGE_ACCESS_KEY' "$rendered"
grep -Fq 'name: STORAGE_SECRET_KEY' "$rendered"
grep -Fq 'value: fichier-des-personnes-decedees-elasticsearch' "$rendered"
grep -Fq '\"readonly\":true' "$rendered"
awk '
  $1 == "kind:" { kind=$2 }
  $1 == "name:" && $2 == "redis" && kind == "StatefulSet" { found=1 }
  END { exit(found ? 0 : 1) }
' "$rendered" || {
  echo "prod Redis must render as a StatefulSet" >&2
  exit 1
}
if awk '
  $1 == "kind:" { kind=$2 }
  $1 == "name:" && $2 == "redis" && kind == "Deployment" { found=1 }
  END { exit(found ? 0 : 1) }
' "$rendered"; then
  echo "prod Redis must not render as a Deployment" >&2
  exit 1
fi
grep -Fq 'volumeClaimTemplates:' "$rendered"
grep -Fq 'name: redis-data' "$rendered"
grep -Fq 'claimName: deces-backend-data' "$rendered"
grep -Fq 'name: deces-backend-data' "$rendered"
grep -Fq 'name: restore-proofs' "$rendered"
grep -Fq 'name: backup-proofs' "$rendered"
grep -Fq 'name: deces-proofs-storage' "$rendered"
grep -Fq 'name: PROOFS_BUCKET' "$rendered"
grep -Fq 'name: PROOFS_GIT_BRANCH' "$rendered"
grep -Fq 'name: RCLONE_CONFIG_S3_ACCESS_KEY_ID' "$rendered"
grep -Fq 'name: RCLONE_CONFIG_S3_SECRET_ACCESS_KEY' "$rendered"
grep -Fq "rclone copy \"\$source\" /data/proofs --checksum --ignore-existing --fast-list --include '*.json' --exclude '*'" "$rendered"
grep -Fq 'local proofs JSON already present; skipping initial bucket restore' "$rendered"
grep -Fq 'rclone copy /data/proofs "$target"' "$rendered"
grep -Fq -- '--ignore-existing' "$rendered"
grep -Fq 'no proofs JSON restored from $source' "$rendered"
grep -Fq 'Smoke proofs storage' "$repo_root/.github/workflows/release-prod.yml"
grep -Fq 'proofs_json_count=' "$repo_root/.github/workflows/release-prod.yml"
