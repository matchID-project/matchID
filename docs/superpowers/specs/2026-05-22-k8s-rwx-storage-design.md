# K8s RWX Storage Design

Date: 2026-05-22

## Decision

Use Scaleway File Storage RWX as the first Kubernetes persistence target for
runtime files that are currently local to `deces-backend`, while keeping state
and durable archives in the stores that fit those responsibilities:

- `JOBS`: RWX-mounted filesystem for bulk upload inputs and encrypted outputs.
- `PROOFS`: RWX-mounted filesystem for correction JSON files and PDFs.
- Redis: shared state, coordination, rate limits, OTP, job stop flags, and job
  metadata.
- S3/Object Storage: backups, retention, exports, logs, and Elasticsearch /
  dataprep snapshots.
- Elasticsearch data: keep on block storage or replace through the Surch track;
  do not put ES data on RWX File Storage.

This is the selected Option B: pragmatic convergence first, without pretending
RWX is a database or a snapshot repository.

## Problem

The Kubernetes readiness audit identifies two file-backed runtime surfaces that
break under pod restart or multi-replica routing:

- `$JOBS`: bulk `.in.enc` and `.out.enc` files are written and read by the
  backend job flow.
- `$PROOFS`: user correction JSON files and uploaded PDFs are written under a
  filesystem tree that is also scanned by backend code.

Keeping these paths on pod-local disk makes results and proofs disappear when a
pod is replaced. Moving everything immediately to S3 would be cleaner long term
for some flows, but it requires larger application refactors. RWX gives the
Kubernetes migration a smaller step: preserve filesystem semantics while making
the backing store shared and restart-resilient.

## Architecture

Add one RWX PersistentVolumeClaim for backend runtime files in the `poc` and
future `dev` overlays. Mount it into the backend pod at a stable path, then
derive:

- `JOBS=/var/lib/matchid/jobs`
- `PROOFS=/var/lib/matchid/proofs`

The initial implementation can use one PVC with two subdirectories. If
operational needs diverge, split into two PVCs later:

- `jobs-rwx`: high churn, short retention, cleanup-heavy.
- `proofs-rwx`: lower churn, longer retention, user-facing durability.

The API and any future dedicated worker Deployment must mount the same PVC at
the same path. Redis remains the source of truth for whether a job is stopped,
which input/output path belongs to a job, and which cleanup/retry action is
pending.

## Data Flow

Bulk upload:

1. API receives the uploaded file.
2. API writes encrypted input to `$JOBS/<jobId>.in.enc` on RWX storage.
3. API records metadata in Redis, including job id, input path, status, and
   timestamps.
4. Worker reads input from RWX storage and writes `$JOBS/<jobId>.out.enc`.
5. Worker updates Redis with completion state and output metadata.
6. API serves result download from RWX storage.
7. Cleanup deletes expired job files and clears Redis metadata.

Proof / correction upload:

1. API writes correction JSON and PDFs under `$PROOFS/<recordId>/`.
2. Backend refresh strategy is made explicit: either reload on demand, watch the
   RWX tree, or move correction indexing into a small Redis-backed invalidation
   path.
3. Backup sync copies proofs to S3 on a scheduled or event-driven basis.

## Failure Handling

RWX mount unavailable:

- Backend startup/readiness should fail if `JOBS` or `PROOFS` is not writable.
- Pods should not accept bulk uploads while the mount is unavailable.

Pod restart during bulk processing:

- Files remain on RWX storage.
- Redis job metadata decides whether the job can be retried, resumed, or marked
  failed.
- A graceful shutdown path should stop accepting new work and let in-flight jobs
  drain when possible.

RWX data loss or corruption:

- `JOBS` is recoverable only within its retention window; outputs can be
  regenerated if input and job metadata remain valid.
- `PROOFS` must be backed up to S3 because it is user-facing durable data.

Concurrent pods:

- Filesystem paths are shared, but coordination must not rely on files alone.
- Redis owns locks, stop flags, status, retries, and cleanup markers.

## Kubernetes Scope

First target:

- `deploy/k8s/overlays/poc`
- later `dev` long-lived overlay when the platform contract is stable

Required manifest changes:

- Add Scaleway RWX StorageClass/PVC wiring for File Storage.
- Mount the PVC in `deces-backend`.
- Set backend env vars for `JOBS` and `PROOFS`.
- Add startup/readiness checks for writable paths.
- Keep local/k3d using hostPath or local PVC equivalent for smoke tests.

Do not change production storage until the POC has passed restart and cleanup
tests.

## Out Of Scope

- Moving OTP, rate limits, ban IP, stop flags, and job metadata into files.
- Running Elasticsearch data on RWX File Storage.
- Replacing S3 snapshots or dataprep artifact publication.
- Solving the current `dataprep year remote-all` SSH failure.
- Full Surch replacement of Elasticsearch.

## Validation

POC acceptance checks:

- Backend pod starts only when RWX mount is writable.
- Bulk upload survives backend pod restart before processing.
- Bulk result survives backend pod restart after processing.
- A second backend or worker pod can read files written by the first pod.
- `PROOFS` writes survive pod restart.
- Cleanup removes expired `JOBS` files without touching `PROOFS`.
- Redis remains the only state/coordination source for job metadata.
- S3 backup path for `PROOFS` is tested before any production use.

Non-goals for the first spike:

- Multi-zone durability guarantees.
- Full production cutover.
- New application-level S3 file API.

## Rollout Plan

1. Prototype RWX PVC in `poc` overlay.
2. Mount it in `deces-backend` and wire `JOBS` / `PROOFS`.
3. Add writeability probes and smoke checks.
4. Run restart tests for API and future worker topology.
5. Add Redis-backed bulk metadata before scaling workers.
6. Add S3 backup/retention for `PROOFS`.
7. Reassess whether `JOBS` should stay RWX or move partly to S3 after the
   worker split is complete.

## Open Risks

- Scaleway File Storage is in public beta; availability and performance must be
  validated before production dependence.
- RWX preserves filesystem semantics, including possible contention and cleanup
  races; Redis coordination is mandatory.
- `updatedFields` currently loads from `PROOFS` at startup, so multi-pod
  correctness still needs a reload/invalidation design.
- The CD `dataprep year` path still depends on a VM over SSH and failed after
  the PR #59 merge; that is a separate reliability track.
