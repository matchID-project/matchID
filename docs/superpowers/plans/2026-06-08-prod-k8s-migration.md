# Prod K8s Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `deces.matchid.io` production deployment from the legacy VM release path to Kubernetes, with all secrets, seed data, logging, New Relic, mail, snapshot restore, validation, and `test.deces.matchid.io` retirement handled in one migration.

**Architecture:** Keep the current release workflow responsibilities for tag resolution, image version resolution, and prod snapshot production. Replace only the final prod runtime deployment path with a K8s overlay and K8s Make targets that apply all required secrets before rendering manifests. Run prod K8s behind Traefik and validate it before moving public traffic away from the legacy VM.

**Tech Stack:** GitHub Actions, Kubernetes/Kustomize, Scaleway Kapsule, Scaleway Object Storage S3, Elasticsearch snapshot repository, Fluent Bit, New Relic EU Log API, cert-manager, Traefik, Make.

---

## File Structure

- Create `deploy/k8s/overlays/prod/kustomization.yaml`: prod namespace and resource composition.
- Create `deploy/k8s/overlays/prod/deces-backend.prod.yaml`: prod backend DNS, secret mounts, seed mount, resource sizing, node pool.
- Create `deploy/k8s/overlays/prod/deces-ui.prod.yaml`: prod UI resource sizing and node pool.
- Create `deploy/k8s/overlays/prod/elasticsearch.prod.yaml`: prod ES resource sizing, PVC size, node pool.
- Create `deploy/k8s/overlays/prod/redis.prod.yaml`: prod Redis resource sizing and node pool.
- Create `deploy/k8s/overlays/prod/ingress.prod.yaml`: `deces.matchid.io` Ingress and TLS.
- Create `deploy/k8s/overlays/prod/log-forwarder.configmap.yaml`: prod Fluent Bit config.
- Create `deploy/k8s/overlays/prod/log-forwarder.daemonset.yaml`: prod Fluent Bit DaemonSet.
- Create `deploy/k8s/overlays/prod/elasticsearch-restore.job.yaml`: one-shot restore job manifest template.
- Modify `deploy/k8s/Makefile`: add prod preflight, seed secret, log forwarder target reuse, snapshot/restore secret helpers.
- Create `deploy/k8s/tests/prod-manifest.sh`: render assertions for prod overlay.
- Modify `.github/workflows/release-prod.yml`: replace legacy VM `deploy-prod` implementation with K8s deploy while keeping snapshot metadata.
- Modify `.github/workflows/cd-k8s.yml`: remove `test` target after prod migration is verified.
- Modify `deploy/k8s/README.md`: document prod K8s deploy and rollback.

## Required GitHub Secrets

Backend and mail:
`API_EMAIL`, `BACKEND_TOKEN_KEY`, `BACKEND_TOKEN_PASSWORD`, `BACKEND_TOKEN_USER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PWD`, `SMTP_TLS_SELFSIGNED`.

User/API-key seed:
`DECES_BACKEND_USERDB_JSON`.

Kubernetes:
`KUBE_CONFIG_DATA_PROD`.

Storage and snapshots:
`STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `TOOLS_STORAGE_ACCESS_KEY`, `TOOLS_STORAGE_SECRET_KEY`, `LOG_BUCKET`, `LOG_DB_BUCKET`, `STATS_BUCKET`, `PROOFS_BUCKET`.

New Relic and logs:
`NEW_RELIC_INGEST_KEY`, `NEW_RELIC_API_KEY`, `NEW_RELIC_ACCOUNT_ID`.

CDN cutover and purge:
`CDN_TOKEN`, `CDN_ZONE_ID`.

Legacy SSH secrets remain only for rollback until VM retirement:
`SSH_PRIVATE_KEY`, `NGINX_HOST`, `NGINX_USER`, `BASTION_HOST`, `BASTION_USER`.

---

### Task 1: Add Prod Overlay and Render Test

**Files:**
- Create: `deploy/k8s/overlays/prod/kustomization.yaml`
- Create: `deploy/k8s/overlays/prod/deces-backend.prod.yaml`
- Create: `deploy/k8s/overlays/prod/deces-ui.prod.yaml`
- Create: `deploy/k8s/overlays/prod/elasticsearch.prod.yaml`
- Create: `deploy/k8s/overlays/prod/redis.prod.yaml`
- Create: `deploy/k8s/overlays/prod/ingress.prod.yaml`
- Create: `deploy/k8s/tests/prod-manifest.sh`

- [ ] **Step 1: Write the failing render test**

Create `deploy/k8s/tests/prod-manifest.sh`:

```bash
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
grep -Fq 'name: deces-backend-userdb' "$rendered"
grep -Fq 'mountPath: /run/secrets/deces-backend/userDB.json' "$rendered"
grep -Fq 'k8s.scaleway.com/pool-name: matchid' "$rendered"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bash deploy/k8s/tests/prod-manifest.sh
```

Expected: FAIL because `deploy/k8s/overlays/prod` does not exist yet.

- [ ] **Step 3: Add the prod overlay**

Create prod overlay files by copying the test overlay structure and changing namespace/host to prod. `deces-backend.prod.yaml` must set `DB_JSON=/run/secrets/deces-backend/userDB.json` and mount `deces-backend-userdb` as a file at that path. It must also set `APP_DNS=deces.matchid.io` and `APP_URL=https://deces.matchid.io`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
bash deploy/k8s/tests/prod-manifest.sh
kubectl kustomize deploy/k8s/overlays/prod >/tmp/matchid-prod-rendered.yaml
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add deploy/k8s/overlays/prod deploy/k8s/tests/prod-manifest.sh
git commit -m "feat(k8s): add prod overlay"
```

### Task 2: Add Complete Prod Secret Targets

**Files:**
- Modify: `deploy/k8s/Makefile`
- Create: `deploy/k8s/tests/prod-secrets-preflight.sh`

- [ ] **Step 1: Write failing secret preflight test**

Create `deploy/k8s/tests/prod-secrets-preflight.sh`:

```bash
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
  NEW_RELIC_INGEST_KEY=nr-ingest \
  DECES_BACKEND_USERDB_JSON='{"user@example.com":"hash"}'
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bash deploy/k8s/tests/prod-secrets-preflight.sh
```

Expected: FAIL because `prod-secrets-preflight` is not implemented.

- [ ] **Step 3: Implement Make targets**

Modify `deploy/k8s/Makefile`:

- Add `USERDB_SECRET_NAME ?= deces-backend-userdb`.
- Add `PROD_SECRET_REQUIRED_KEYS` with every backend, mail, logging, and seed key.
- Add `userdb-seed-secret-preflight`.
- Add `userdb-seed-secret` that creates Secret `deces-backend-userdb` with key `userDB.json`.
- Add `prod-secrets-preflight` depending on backend, log forwarder, and userdb preflights.
- Add `prod-secrets` depending on `backend-secrets log-forwarder-secrets userdb-seed-secret`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
bash deploy/k8s/tests/prod-secrets-preflight.sh
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add deploy/k8s/Makefile deploy/k8s/tests/prod-secrets-preflight.sh
git commit -m "feat(k8s): add prod secret preflight"
```

### Task 3: Add Prod Log Forwarder

**Files:**
- Create: `deploy/k8s/overlays/prod/log-forwarder.configmap.yaml`
- Create: `deploy/k8s/overlays/prod/log-forwarder.daemonset.yaml`
- Modify: `deploy/k8s/overlays/prod/kustomization.yaml`
- Modify: `deploy/k8s/tests/prod-manifest.sh`

- [ ] **Step 1: Extend failing render test**

Add assertions to `deploy/k8s/tests/prod-manifest.sh`:

```bash
grep -Fq 'name: matchid-log-forwarder' "$rendered"
grep -Fq 'Path              /var/log/containers/*_matchid-prod_*.log' "$rendered"
grep -Fq 'Record service.name deces-matchid-prod' "$rendered"
grep -Fq 'Record environment prod' "$rendered"
grep -Fq 'Record k8s.namespace.name matchid-prod' "$rendered"
grep -Fq 'Host              log-api.eu.newrelic.com' "$rendered"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bash deploy/k8s/tests/prod-manifest.sh
```

Expected: FAIL because the prod log forwarder is not in the overlay.

- [ ] **Step 3: Add prod Fluent Bit resources**

Copy dev log forwarder resources to prod and change:

- tail path namespace from `matchid-dev` to `matchid-prod`;
- `service.name` from `deces-matchid-dev` to `deces-matchid-prod`;
- `environment` from `dev` to `prod`;
- namespace attribute from `matchid-dev` to `matchid-prod`;
- node selector pool remains `matchid`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
bash deploy/k8s/tests/prod-manifest.sh
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add deploy/k8s/overlays/prod deploy/k8s/tests/prod-manifest.sh
git commit -m "feat(k8s): forward prod logs"
```

### Task 4: Add Elasticsearch Restore Job Path

**Files:**
- Create: `deploy/k8s/overlays/prod/elasticsearch-restore.job.yaml`
- Modify: `deploy/k8s/Makefile`
- Modify: `.github/workflows/release-prod.yml`

- [ ] **Step 1: Add restore manifest assertion**

Add to `deploy/k8s/tests/prod-manifest.sh`:

```bash
grep -Fq 'name: elasticsearch-restore' "$rendered"
grep -Fq 'name: SNAPSHOT_NAME' "$rendered"
grep -Fq 'name: STORAGE_ACCESS_KEY' "$rendered"
grep -Fq 'name: STORAGE_SECRET_KEY' "$rendered"
grep -Fq 'value: fichier-des-personnes-decedees-elasticsearch' "$rendered"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bash deploy/k8s/tests/prod-manifest.sh
```

Expected: FAIL because the restore job is absent.

- [ ] **Step 3: Add restore job**

Create a Kubernetes Job that waits for `elasticsearch:9200`, configures repository `matchid`, restores `$SNAPSHOT_NAME`, waits for completion, and verifies `deces` index count is greater than 0.

- [ ] **Step 4: Add Make helper**

Add `prod-restore-preflight` checking `SNAPSHOT_NAME`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, and `REPOSITORY_BUCKET`.

- [ ] **Step 5: Run verification**

Run:

```bash
bash deploy/k8s/tests/prod-manifest.sh
SNAPSHOT_NAME=esdata_example STORAGE_ACCESS_KEY=x STORAGE_SECRET_KEY=y REPOSITORY_BUCKET=fichier-des-personnes-decedees-elasticsearch make -C deploy/k8s prod-restore-preflight NAMESPACE=matchid-prod
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add deploy/k8s/overlays/prod/elasticsearch-restore.job.yaml deploy/k8s/Makefile deploy/k8s/tests/prod-manifest.sh
git commit -m "feat(k8s): add prod elasticsearch restore job"
```

### Task 5: Switch Release Prod Deploy Job to K8s

**Files:**
- Modify: `.github/workflows/release-prod.yml`

- [ ] **Step 1: Add workflow structure checks**

Run:

```bash
rg -n 'KUBE_CONFIG_DATA_PROD|prod-secrets|overlays/prod|deploy-remote' .github/workflows/release-prod.yml
```

Expected before implementation: no `KUBE_CONFIG_DATA_PROD`, no `prod-secrets`, and `deploy-remote` still present.

- [ ] **Step 2: Replace legacy deploy implementation**

Modify the `deploy-prod` job so it:

- uses `KUBE_CONFIG_DATA_PROD`;
- applies `make -C deploy/k8s prod-secrets NAMESPACE=matchid-prod`;
- renders `deploy/k8s/overlays/prod` with image tags from `release-context`;
- applies manifests with `kubectl apply -f`;
- deletes any previous `job/elasticsearch-restore`;
- applies the restore Job with `SNAPSHOT_NAME` from `ensure-prod-snapshot`;
- waits for restore completion;
- waits for Redis, ES, backend, and UI;
- smokes readiness through Traefik with Host `deces.matchid.io`;
- queries New Relic and S3 after generating one readiness hit.

- [ ] **Step 3: Verify workflow no longer calls VM deploy**

Run:

```bash
rg -n 'make deploy-remote|deploy-remote-preflight|Install deploy SSH key' .github/workflows/release-prod.yml
```

Expected: no matches in the `deploy-prod` job.

- [ ] **Step 4: Verify shell and render tests**

Run:

```bash
bash deploy/k8s/tests/prod-manifest.sh
bash deploy/k8s/tests/prod-secrets-preflight.sh
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release-prod.yml deploy/k8s
git commit -m "ci: deploy prod release to k8s"
```

### Task 6: Retire `test.deces.matchid.io`

**Files:**
- Modify: `.github/workflows/cd-k8s.yml`
- Modify: `.github/workflows/k8s-smoke.yml`
- Modify: `deploy/k8s/README.md`

- [ ] **Step 1: Remove test target from CD**

Remove `test` from `cd-k8s.yml` workflow dispatch choices and target resolution. Keep local smoke unchanged.

- [ ] **Step 2: Remove Kapsule test smoke**

Remove the `smoke-poc`/`matchid-test` path from `k8s-smoke.yml`, keeping local k3s smoke.

- [ ] **Step 3: Document retirement**

Update `deploy/k8s/README.md` to state that `test.deces.matchid.io` is retired and prod validation happens through release-prod K8s pre-cutover smoke.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/cd-k8s.yml .github/workflows/k8s-smoke.yml deploy/k8s/README.md
git commit -m "chore(k8s): retire test deces target"
```

### Task 7: Live Prod Cutover and Verification

**Files:**
- No repo file changes unless the cluster or DNS source of truth requires a manifest update.

- [ ] **Step 1: Dispatch release-prod on a prod tag**

Run:

```bash
gh workflow run release-prod.yml --ref main -f prod_tag=<prod-tag> -f release_mode=deploy_only
gh run watch <run-id> --exit-status
```

Expected: release-prod completes successfully and deploys `matchid-prod`.

- [ ] **Step 2: Verify K8s runtime before traffic**

Run:

```bash
kubectl -n matchid-prod get pods -o wide
kubectl -n matchid-prod rollout status deploy/deces-backend --timeout=10m
kubectl -n matchid-prod rollout status deploy/deces-ui --timeout=10m
kubectl -n matchid-prod rollout status statefulset/elasticsearch --timeout=10m
```

Expected: all workloads ready.

- [ ] **Step 3: Verify app behavior**

Run readiness through Traefik with `Host: deces.matchid.io`, then verify:

- admin login works with `BACKEND_TOKEN_USER`/`BACKEND_TOKEN_PASSWORD`;
- OTP mail is received from the configured SMTP provider;
- one historical user API key from `DECES_BACKEND_USERDB_JSON` authenticates;
- one `/deces/api/v1/search` request returns a valid response.

- [ ] **Step 4: Verify logs**

Expected evidence:

- S3 object under `s3://matchid-backups/deces-ui/log/k8s/matchid-prod/YYYYMMDD/...`;
- New Relic count greater than 0 for `service.name='deces-matchid-prod'` and `k8s.namespace.name='matchid-prod'`.

- [ ] **Step 5: Cut over traffic**

Move `deces.matchid.io` DNS or proxy routing to the K8s Traefik load balancer, then purge CDN.

- [ ] **Step 6: Keep rollback available**

Keep the legacy VM and proxy route intact until prod K8s has passed at least one full business-day observation window. Rollback is DNS/proxy route back to legacy VM.

- [ ] **Step 7: Remove legacy runtime**

After observation window, delete legacy prod VM resources and any `test.deces.matchid.io` DNS record still present.

---

## Self-Review

- Spec coverage: dev CD status, prod K8s migration, release workflow pivot, all secrets, logs, New Relic, mail, seed/user API keys, test retirement, validation, and rollback are covered.
- Placeholder scan: this plan avoids implementation placeholders and names exact files, commands, and required secret keys.
- Type consistency: namespace `matchid-prod`, host `deces.matchid.io`, service name `deces-matchid-prod`, seed Secret `deces-backend-userdb`, and backend Secret `deces-backend-secrets` are used consistently.
