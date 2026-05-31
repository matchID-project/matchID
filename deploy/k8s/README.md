# matchID on Kubernetes — local k3s + PoC overlays

Experimental k8s manifests for matchID. Wired into CI via
`.github/workflows/k8s-smoke.yml` (k3d-local smoke on push/PR, dispatch-only
Kapsule PoC smoke). Can also be driven by hand on a local k3d cluster or
against the `poc` Kapsule cluster owned by `rhanka/poc-k8s`.

## Environment tiers (target topology)

| Tier        | Cluster                                     | Overlay                  | Lifecycle                                     |
| ----------- | ------------------------------------------- | ------------------------ | --------------------------------------------- |
| **CI**      | k3s in GH Actions (or k3d if a local runner is free) | `overlays/local`         | Ephemeral per job — bring up, smoke, tear down |
| **Dev**     | Scaleway Kapsule `poc` (shared, fr-par-2)   | `overlays/poc`           | Long-running tenant, namespace `matchid`      |
| **Prod**    | Dedicated cluster (TBD — not Kapsule `poc`) | `overlays/prod` (future) | Stable, separate IaC stack                    |

Local k3d runs are convenient when the laptop has headroom; CI falls back to
k3s when local is saturated. `overlays/local` is shared between both — it just
needs a working k3s/k3d.

## Layout

```
deploy/k8s/
├── base/                  # vendor-agnostic manifests (Deployments, Services, ES STS)
├── overlays/
│   ├── local/             # k3d / k3s-local: NodePort, hostPath PV, no nodeSelector
│   └── poc/               # Scaleway Kapsule `poc`: nodeSelector pool=burst, scw-bssd PVC, IngressRoute
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

## PoC cluster flow

Once the matchID tenant lands in `rhanka/poc-k8s` (see
`requests/matchid.md` on branch `request/matchid-onboarding`) :

```bash
export KUBECONFIG=$(scw k8s kubeconfig get poc | grep KUBECONFIG | cut -d= -f2)
kubectl apply -k deploy/k8s/overlays/poc/
kubectl -n matchid wait --for=condition=available --timeout=5m deploy/deces-backend deploy/deces-ui
```

The `poc` overlay assumes :

- a `burst` node-pool labelled `pool=burst` with toleration
  `pool=burst:NoSchedule` (provisioned by `poc-k8s/Makefile::pool-burst`),
- a `scw-bssd` StorageClass for ES persistence,
- a `traefik` IngressRoute CRD on the cluster (default on Kapsule),
- the `matchid` Namespace + ResourceQuota + LimitRange already applied
  by the poc-k8s repo from `tenants/matchid/00-namespace.yaml`.

## What's not yet wired

- **TLS / cert-manager** — the `IngressRoute` references TLS via
  `cert-manager.io/cluster-issuer: letsencrypt-prod` but the issuer
  is provisioned out of band by the poc-k8s repo. To be amended once
  the issuer lands.
- **OIDC auth** — matchID OTP / SMTP flow not wired yet. The
  Deployment env block carries placeholders pointing at the future
  `mail.matchid.io` Brevo→Scaleway TEM relay.
- **Surch swap** — the long-term plan is to drop the ES StatefulSet
  and point `deces-backend` at the surch tenant's `surch-api` Service.
  Blocked on the DSL inventory in `EXPERIMENT_SURCH.md`.
- **CI/CD** — no `.github/workflows/k8s-*.yml` yet. The poc-k8s
  intake assumes a future `experiment/k8s` workflow doing
  `kubectl apply -k …/overlays/poc/`.
- **Secrets** — backend secrets (`BACKEND_TOKEN_KEY`, SMTP creds,
  etc.) declared as `envFrom: secretRef` but the Secret itself is
  out-of-tree; provision via `kubectl create secret generic
  deces-backend-secrets --from-env-file=.env.k8s`.
- **Dataprep** — `deces-dataprep` (the INSEE ingest job) is not
  manifested yet; it's a one-shot Job that should live alongside
  the ES StatefulSet but we want to land the read path first.

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
