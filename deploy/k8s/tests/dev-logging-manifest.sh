#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

kubectl kustomize "$repo_root/deploy/k8s/overlays/dev" > "$rendered"

grep -Fq 'kind: DaemonSet' "$rendered"
grep -Fq 'name: matchid-log-forwarder' "$rendered"
grep -Fq 'name: matchid-log-forwarder-config' "$rendered"
grep -Fq 'Path              /var/log/containers/*_matchid-dev_*.log' "$rendered"
grep -Fq 'Exclude_Path      /var/log/containers/matchid-log-forwarder*_matchid-dev_*.log' "$rendered"
grep -Fq 'Name              s3' "$rendered"
grep -Fq 'bucket            ${LOG_S3_BUCKET}' "$rendered"
grep -Fq 's3_key_format     /${LOG_S3_PREFIX}/%Y%m%d/%Y%m%d-%H%M_$UUID.jsonl' "$rendered"
grep -Fq 'Name              http' "$rendered"
grep -Fq 'Host              log-api.eu.newrelic.com' "$rendered"
grep -Fq 'Api-Key ${NEW_RELIC_INGEST_KEY}' "$rendered"
grep -Fq 'secretKeyRef:' "$rendered"
grep -Fq 'name: matchid-log-forwarder-secrets' "$rendered"
