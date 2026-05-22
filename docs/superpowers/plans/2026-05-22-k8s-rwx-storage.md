# K8s RWX Storage Implementation Plan

Date: 2026-05-22

## Goal

Wire the first Kubernetes runtime filesystem for `deces-backend` so bulk job
files and proof uploads are no longer pod-local when running on Kubernetes.

## Context

- Design decision is documented in
  `docs/superpowers/specs/2026-05-22-k8s-rwx-storage-design.md`.
- `JOBS` and `PROOFS` are filesystem paths used by the backend at runtime.
- Redis remains the state and coordination store.
- Elasticsearch data stays on `ReadWriteOnce` block storage.
- The current PoC cluster exposes only `scw-bssd` / `sbs-*` block
  StorageClasses; File Storage RWX is not installed yet.

## Steps

1. Add a backend runtime `PersistentVolumeClaim` in the k8s base with
   `ReadWriteMany`.
2. Mount that claim in `deces-backend` at `/var/lib/matchid`.
3. Set `JOBS=/var/lib/matchid/jobs` and
   `PROOFS=/var/lib/matchid/proofs`.
4. Add an init container and readiness guard so the backend does not accept
   traffic unless both runtime paths are writable.
5. Add a local hostPath `ReadWriteMany` PV and PVC patch for k3d/k3s smoke.
6. Add a PoC PVC patch that requires the platform-provided `matchid-rwx`
   StorageClass, backed by Scaleway File Storage.
7. Update k8s docs with the new storage contract and current PoC blocker.
8. Validate manifest rendering for local and PoC overlays.

## Validation

- `kubectl kustomize deploy/k8s/overlays/local`
- `kubectl kustomize deploy/k8s/overlays/poc`
- Check rendered `deces-backend` has the PVC mount, env vars, init container,
  and readiness guard.
- Check rendered PoC PVC requests `ReadWriteMany` and `matchid-rwx`.
