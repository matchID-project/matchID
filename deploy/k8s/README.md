# matchID on Kubernetes - local k3s, dev and prod overlays

Experimental k8s manifests for matchID. Wired into CI via
`.github/workflows/k8s-smoke.yml` (k3d-local smoke on push/PR/manual
dispatch). Can also be driven by hand on a local k3d cluster or against the
Kapsule tenants owned by `rhanka/poc-k8s`.

## Environment tiers (target topology)

| Tier        | Cluster                                     | Overlay                  | Lifecycle                                     |
| ----------- | ------------------------------------------- | ------------------------ | --------------------------------------------- |
| **CI**      | k3s in GH Actions (or k3d if a local runner is free) | `overlays/local`         | Ephemeral per job — bring up, smoke, tear down |
| **Dev**     | Scaleway Kapsule `poc` (shared, fr-par-2)   | `overlays/dev`           | Long-running tenant, namespace `matchid-dev`  |
| **Prod**    | Scaleway Kapsule prod tenant                | `overlays/prod`          | Stable release runtime, namespace `matchid-prod` |

`test.deces.matchid.io` is retired as a CD target. Prod validation now happens
inside `.github/workflows/release-prod.yml` before traffic cutover.

Local k3d runs are convenient when the laptop has headroom; CI falls back to
k3s when local is saturated. `overlays/local` is shared between both — it just
needs a working k3s/k3d.

## Layout

```
deploy/k8s/
├── base/                  # vendor-agnostic manifests (Deployments, Services, ES STS)
├── overlays/
│   ├── local/             # k3d / k3s-local: NodePort, hostPath PV, no nodeSelector
│   ├── poc/               # legacy single-namespace PoC smoke overlay
│   ├── dev/               # matchid-dev: 24/7 dev endpoint
│   ├── prod/              # matchid-prod: release-prod runtime
│   └── test/              # retired matchid-test overlay kept for historical reference
└── local/                 # alias overlay used by the `apply-local` Make target
```

`base/` declares the four workloads :

| Workload          | Image                                                | Port  | Notes                                    |
| ----------------- | ---------------------------------------------------- | ----- | ---------------------------------------- |
| deces-backend     | `matchid/deces-backend:latest`                       | 8080  | Node.js API, talks to ES via `ES_URL`    |
| deces-ui          | `matchid/deces-ui:latest`                            | 8083  | Nginx reverse-proxy + static UI          |
| elasticsearch     | `docker.elastic.co/elasticsearch/elasticsearch:8.6.1`| 9200  | single-node, dev profile, JVM -Xmx512m   |
| redis             | `redis:alpine`                                       | 6379  | BullMQ broker for bulk/proof jobs        |

ES version aligned with the rest of the repo (`ES_VERSION=8.6.1` in
`packages/deces-infra/Makefile`, `packages/deces-dataprep/Makefile`,
`packages/dataprep-backend/Makefile`). Reconciliation with the poc-k8s
heap budget is M1 follow-up.

## Local flow (recommended: k3d)

`k3d` runs k3s inside Docker — fastest path on a dev box, no host changes.

**Prerequisites :**

- **Docker** + **kubectl** + **k3d** installed and on `PATH`.
- ≥ **15% free space on `/`** (or wherever `/var/lib/docker` lives). Below
  that, k3s's kubelet sets the `DiskPressure` taint on the node and no Pod
  can be scheduled — `kubectl describe node …` will show the taint, and
  every workload sits in `Pending`. Free disk (`docker system prune -af`,
  prune dataprep snapshots) then `make k3d-down && make k3d-up`.

```bash
# one-shot install
brew install k3d                                          # macOS
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash  # linux

# spin up + apply
make -C deploy/k8s k3d-up
make -C deploy/k8s apply-local
make -C deploy/k8s port-forward                           # http://localhost:8083 → deces-ui
```

Alternative (host-mode k3s, requires root):

```bash
curl -sfL https://get.k3s.io | sh -                        # systemd service `k3s`
sudo k3s kubectl apply -k deploy/k8s/overlays/local/
```

## Kapsule tenant flow

Once the `matchid-dev` and `matchid-prod` tenants land in `rhanka/k8s-ops`
(see `requests/matchid.md`):

```bash
export KUBECONFIG=/path/to/matchid-dev.kubeconfig
kubectl apply -k deploy/k8s/overlays/dev/
kubectl -n matchid-dev wait --for=condition=available --timeout=10m deploy/deces-backend deploy/deces-ui

export KUBECONFIG=/path/to/matchid-prod.kubeconfig
make -C deploy/k8s prod-secrets NAMESPACE=matchid-prod
make -C deploy/k8s prod-restore-secrets NAMESPACE=matchid-prod SNAPSHOT_NAME=<snapshot>
kubectl apply -k deploy/k8s/overlays/prod/
```

The `dev` and `prod` overlays assume:

- `matchid-dev` and `matchid-prod` namespaces, quotas and NetworkPolicies are
  owned by the poc-k8s/k8s-ops repo,
- prod workloads target the Scaleway-managed pool label
  `k8s.scaleway.com/pool-name=matchid`,
- a `scw-bssd` StorageClass for ES persistence,
- Traefik standard `Ingress` with `ingressClassName: traefik`,
- cert-manager `letsencrypt-prod` ClusterIssuer.

The legacy `overlays/poc` remains for old manual smokes against namespace
`matchid`; it is still burst-only and now scales Redis to 0 at rest too.

## K8s CD

`.github/workflows/cd.yml` owns the automatic dev application deploy:
after the `deces-backend` and `deces-ui` image jobs finish, `deploy-dev-k8s`
applies `overlays/dev/` to `matchid-dev` and smokes
`dev.deces.matchid.io`. The legacy VM deploy for `dev-deces.matchid.io` is no
longer part of CI.

`.github/workflows/cd-k8s.yml` remains available for dev K8s manifest changes
and manual dev deploys with tenant-scoped kubeconfigs:

- `KUBE_CONFIG_DATA_DEV` for `matchid-dev`.

On `main` pushes touching `deploy/k8s` or the K8s workflow itself,
`cd-k8s.yml` deploys `overlays/dev/` with image tags resolved from the repo
artifact versions. Manual dispatch targets `dev`.

`.github/workflows/release-prod.yml` owns prod. It keeps prod tag resolution
and snapshot production, then deploys `overlays/prod/` with
`KUBE_CONFIG_DATA_PROD`, applies backend/mail/logging/seed/Elasticsearch S3
secrets, restores the selected snapshot, smokes `/healthcheck` through Traefik,
cuts the Cloudflare `deces.matchid.io` A record over to `TRAEFIK_LB_IP_PROD`
in DNS-only mode, and verifies S3/New Relic log delivery before the release job
passes.

Prod DNS cutover uses `CDN_DNS_TOKEN` with Cloudflare `Zone:DNS:Edit` and
`Zone:Read` on `matchid.io`; `CDN_TOKEN` is kept for cache purge.

The prod Elasticsearch StatefulSet keeps data on a Scaleway block storage PVC.
The restore Job is idempotent: it records the restored `SNAPSHOT_NAME` in
`.matchid-restore-state`, skips when the PVC already contains the requested
snapshot, and refuses to replace a different indexed snapshot unless
`FORCE_RESTORE=true`. Full prod releases set `FORCE_RESTORE=true`; deploy-only
releases keep the existing index.

`.github/workflows/dataprep-monthly.yml` owns the monthly INSEE refresh. It runs
the existing remote dataprep producer, captures the new snapshot metadata, then
deploys the refreshed snapshot through `overlays/prod/` with the same K8s
secrets, health checks, certificate wait and S3/New Relic log verification as
the release workflow. It compares with the latest monthly metadata when
available, falling back to the latest release metadata, and only forces the ES
restore when the snapshot name changes.

## Dev log forwarding

`overlays/dev` includes a `matchid-log-forwarder` Fluent Bit DaemonSet on the
default Kapsule pool. It tails `/var/log/containers/*_matchid-dev_*.log`,
excludes its own pod logs, and forwards dev logs to:

- Scaleway Object Storage:
  `s3://<LOG_S3_BUCKET>/<LOG_S3_PREFIX>/YYYYMMDD/YYYYMMDD-HHMM_<uuid>.jsonl`
- New Relic EU Log API with `service.name=deces-matchid-dev`,
  `environment=dev` and `k8s.namespace.name=matchid-dev`.

Create or refresh the K8s Secret from local `artifacts`/env before applying the
dev overlay:

```bash
export KUBECONFIG=/path/to/matchid-dev.kubeconfig
make -C deploy/k8s log-forwarder-secrets NAMESPACE=matchid-dev
kubectl apply -k deploy/k8s/overlays/dev/
```

The Make target derives `LOG_S3_BUCKET` and `LOG_S3_PREFIX` from `LOG_BUCKET`
(`matchid-backups/deces-ui/log` becomes
`s3://matchid-backups/deces-ui/log/k8s/matchid-dev/...`). It uses
`TOOLS_STORAGE_ACCESS_KEY`/`TOOLS_STORAGE_SECRET_KEY` by default, matching the
legacy VM monitoring path, and falls back to `STORAGE_ACCESS_KEY`/
`STORAGE_SECRET_KEY` if the tools credentials are not present.

## What's not yet wired

- **OIDC auth** — matchID OTP / SMTP flow is wired through the
  `deces-backend-secrets` Secret. K8s uses `K8S_SMTP_PORT=2587` by default
  because standard SMTP ports `25`/`465`/`587` are blocked from the Kapsule pod
  network; override it explicitly only after re-testing TCP from a backend pod.
- **Surch swap** — the long-term plan is to drop the ES StatefulSet
  and point `deces-backend` at the surch tenant's `surch-api` Service.
  Blocked on the DSL inventory in `EXPERIMENT_SURCH.md`.
- **Secrets** — backend secrets (`BACKEND_TOKEN_KEY`, SMTP creds,
  etc.) are declared as `envFrom: secretRef`; `make -C deploy/k8s apply-dev`
  applies `deces-backend-secrets` first from local root `artifacts`/environment
  values. Prod uses `make -C deploy/k8s prod-secrets` plus
  `prod-restore-secrets` from release workflow secrets.
- **Dataprep runtime** — `deces-dataprep` still runs on the existing remote
  dataprep producer path from CI. The prod consumer side is K8s: monthly
  refreshes restore the produced snapshot into the prod ES StatefulSet instead
  of provisioning a GP1-XS app VM.

## Resource sizing

Aligned with the poc-k8s intake (`requests/matchid.md`) :

| Pod            | CPU req / limit | RAM req / limit | Notes                       |
| -------------- | --------------- | --------------- | --------------------------- |
| deces-backend  | 100m / 500m     | 256Mi / 512Mi   | single replica              |
| deces-ui       | 50m  / 200m     | 64Mi  / 128Mi   | single replica              |
| elasticsearch  | 250m / 1500m    | 512Mi / 1Gi     | dev profile, 512m heap      |
| redis          | 25m  / 100m     | 32Mi  / 192Mi   | BullMQ broker, no eviction  |

Totals : **425m / 2300m CPU, 864Mi / 1856Mi RAM**. Quota tuning per
overlay is part of M1 (see `K8S_READINESS_AUDIT.md`).
