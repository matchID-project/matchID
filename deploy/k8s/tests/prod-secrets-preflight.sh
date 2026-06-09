#!/usr/bin/env bash
set -euo pipefail

make -C deploy/k8s prod-secrets-preflight NAMESPACE=matchid-prod \
  API_EMAIL=contact@matchid.io \
  BACKEND_TOKEN_KEY=token-key \
  BACKEND_TOKEN_PASSWORD=token-password \
  BACKEND_TOKEN_USER=matchid.project@gmail.com \
  SMTP_HOST=smtp.tem.scaleway.com \
  SMTP_PORT=2587 \
  SMTP_USER=smtp-user \
  SMTP_PWD=smtp-password \
  LOG_BUCKET=matchid-backups/deces-ui/log \
  LOG_STORAGE_ACCESS_KEY=storage-key \
  LOG_STORAGE_SECRET_KEY=storage-secret \
  PROOFS_BUCKET=matchid-backups/deces-ui/proofs \
  PROOFS_GIT_BRANCH=master \
  PROOFS_STORAGE_ACCESS_KEY=proofs-storage-key \
  PROOFS_STORAGE_SECRET_KEY=proofs-storage-secret \
  STORAGE_ACCESS_KEY=es-storage-key \
  STORAGE_SECRET_KEY=es-storage-secret \
  NEW_RELIC_INGEST_KEY=nr-ingest \
  DECES_BACKEND_USERDB_JSON='{"user@example.com":"hash"}'
