# matchID Kubernetes Readiness Audit

**Audit Date:** 2026-05-16  
**Branch:** experiment/k8s  
**Scope:** Architectural patterns that break under Kubernetes (stateless pods, ephemeral filesystems, horizontal scaling, rolling updates)

---

## Executive Summary

Audit identified **8 P0 findings** (block even 1-replica deployment), **6 P1 findings** (block scaling >1), and **4 P2 findings** (nice-to-have). The three most critical issues are:

1. **OTP in-memory store** (`mail.ts:60`) — loses all OTPs on pod restart or cross-pod routing
2. **Rate-limiting via IP-based maps** (`authentification.ts:4-5`) — routing to different pods bypasses bans
3. **Job state tracking in arrays** (`processStream.ts:57-60`) — lost on pod restart, breaks bulk operations

Blocking issues concentrate in:
- `packages/deces-backend/src/` (in-memory state)
- `packages/deces-backend/src/processStream.ts` (file I/O, job tracking)
- Nginx config (`ip_hash` sticky sessions)
- Elasticsearch (single-node, no HA)

---

## P0 Findings (Blocks 1-replica or deployment stability)

### 1. OTP Store — In-Memory Ephemeral State

**Location:** `packages/deces-backend/src/mail.ts:60`

```typescript
const OTP: Record<string, OTPEntry> = {};
```

**Why it breaks:** OTP codes and rate-limit counters live only in pod RAM. Pod restart = all OTPs lost. With 2+ replicas, user OTP sent to pod-A; cross-pod routing sends validation to pod-B → mismatch.

**Proposed Fix:** Move to Redis (shared ephemeral store) or DB (persistent). Use `ioredis` library. Store structure: `otp:{email}` → `{code, lastSendTime, recentSendCount}`. TTL: 6 hours.  
**Effort:** M (requires schema, middleware integration)  
**Priority:** P0 (breaks 2-replica auth flow immediately)

---

### 2. IP-Based Rate Limiting & Ban Tracking

**Location:** `packages/deces-backend/src/authentification.ts:4-5, 19-36`

```typescript
const bannedIP: any = {};
const toBeBannedIP: any = {};
```

**Why it breaks:** Tracks request counts per IP in memory. Pod restart clears bans. With load balancer, same IP hits different pods → no shared rate-limit state → bypass ban.

**Proposed Fix:** Move to Redis with pattern `ratelimit:{ip}` (counter with TTL 1h) and `banned:{ip}` (TTL 4h). Requires replacing setTimeout with Redis key expiry.  
**Effort:** M (refactor auth middleware, handle Redis failures gracefully)  
**Priority:** P0 (trivial abuse vector once scaled)

---

### 3. Job State Arrays in Memory

**Location:** `packages/deces-backend/src/processStream.ts:57-60`

```typescript
const stopJob: string[] = [];
const stopJobReason: StopJobReason[] = [];
const inputsArray: JobInput[] = [];
```

**Why it breaks:** Tracks which jobs are stopped and where input files are. Pod restart = arrays lost. BullMQ queue survives on Redis, but job metadata (stop state, input file paths) lives only in pod RAM → resuming job on different pod fails.

**Proposed Fix:** Persist stop flags and file metadata in Redis (`job:{id}:stopped`, `job:{id}:inputFile`). Replace arrays with Redis hashes.  
**Effort:** M (refactor ProcessStream worker, add Redis checks before file ops)  
**Priority:** P0 (bulk jobs fail mysteriously on restart)

---

### 4. Filesystem as Primary Job Storage

**Location:** `packages/deces-backend/src/processStream.ts:177, 473, 539, 543`

```typescript
fs.createWriteStream(`${process.env.JOBS}/${jobId}.out.enc`)
fs.createWriteStream(`${process.env.JOBS}/${jobId}.in.enc`)
fs.statSync(`${process.env.JOBS}/${jobId}.out.enc`)
fs.createReadStream(`${process.env.JOBS}/${jobId}.out.enc`)
```

**Why it breaks:** Encrypted job files (.in.enc, .out.enc) written to `$JOBS` env-var path. In K8s, no PVC = ephemeral emptyDir → files lost on pod restart, blocking result retrieval. With PVC, shared mount required, but init container must ensure mount readiness.

**Proposed Fix:** Use PVC for `$JOBS` directory (ReadWriteOnce or ReadWriteMany). Add init-container to verify mount. Or: stream results directly to S3/MinIO, skip local FS.  
**Effort:** M (PVC requires StatefulSet; S3 requires credentials + SDK)  
**Priority:** P0 (job results inaccessible after pod restart)

---

### 5. Proofs Directory as Runtime State

**Location:** `packages/deces-backend/src/controllers/search.controller.ts:394-405`, `updatedIds.ts:33-43`

```typescript
const dir = `${process.env.PROOFS}/${id as string}`;
fs.readFileSync(jsonFile, 'utf8')
```

**Why it breaks:** User-submitted proofs (PDFs) and update JSONs written to `$PROOFS`. No PVC = lost on restart. Loaded once at startup into `updatedFields` global, so new proofs uploaded during runtime aren't visible until reload.

**Proposed Fix:** Use PVC for `$PROOFS` (ReadWriteMany if multi-replica). Add file-watcher or reload mechanism. Or: store proofs in DB/S3.  
**Effort:** M (PVC + init-container, or DB schema redesign)  
**Priority:** P0 (user corrections lost, uploaded proofs inaccessible)

---

### 6. Cached Version Info — Stale on Restart

**Location:** `packages/deces-backend/src/controllers/status.controller.ts:11-14`

```typescript
let uniqRecordsCount: number;
let lastDataset: string;
let lastRecordDate: string;
let updateDate: string;
```

**Why it breaks:** Cached once at first request, never refreshed. Pod restart re-caches. Across replicas, each pod has different cached values → inconsistent API responses.

**Proposed Fix:** Move to Redis cache or query ES every time (performance tradeoff). Or: accept replicas returning different values (document eventual-consistency contract).  
**Effort:** S (add Redis getter or remove cache logic)  
**Priority:** P0 (API consistency, though not data loss)

---

### 7. Updated Records Loaded Once at Module Load

**Location:** `packages/deces-backend/src/updatedIds.ts:31-44`

```typescript
const rawData: any = {};
const jsonFiles = walk(`${process.env.PROOFS}`)
export const updatedFields: any = Object.keys(rawData).length ? rawData : {};
```

**Why it breaks:** Walked from disk at startup. Any proofs added post-startup won't appear in API until pod restart. No multi-pod sync mechanism.

**Proposed Fix:** Add file watcher (chokidar) to hot-reload `updatedFields` on file change, or query DB on-demand.  
**Effort:** M (add watcher + thread-safe updates)  
**Priority:** P0 (real-time data loss for user submissions)

---

### 8. Elasticsearch Single-Node, No HA

**Location:** `packages/deces-backend/src/elasticsearch.ts:5`, `deploy/k8s/base/elasticsearch.statefulset.yaml`

```typescript
const config: ClientOptions = {
  node: 'http://elasticsearch:9200',
};
```

**Why it breaks:** Single node. Pod failure = data unavailable. No replication, no failover. Current StatefulSet has `replicas: 1`.

**Proposed Fix:** Scale ES to 3-node cluster (StatefulSet replicas: 3), configure master/data roles, add persistent volume per node.  
**Effort:** L (complex configuration, requires PV provisioning, monitoring)  
**Priority:** P0 (data availability SLA)

---

## P1 Findings (Blocks scaling >1 replica)

### 1. Sticky Session via Nginx ip_hash

**Location:** `packages/tools/nginx/matchid-deces-ui-dev-upstream.conf:2`

```nginx
upstream matchid-deces-ui-dev {
  ip_hash;
  server 51.158.99.108:8083;
}
```

**Why it breaks:** Production K8s uses load balancer (not nginx upstream). `ip_hash` tied to old SCW setup. With >1 backend replica and session state (login, upload chunks), client needs sticky routing. K8s requires Session Affinity at Service level or JWT (stateless).

**Proposed Fix:** Remove `ip_hash` from nginx. Use K8s Service `sessionAffinity: ClientIP` (coarse-grained) or move to JWT-only auth (stateless).  
**Effort:** S (if JWT-based auth already in place; else M for session migration)  
**Priority:** P1 (multi-pod routing will randomly fail upload/login)

---

### 2. Nginx Config Bake-In of Env Variables

**Location:** `packages/deces-ui/nginx/nginx-run.template` (all `<PLACEHOLDER>` vars)

```nginx
limit_req_zone $<API_USER_SCOPE> zone=app:10m rate=30r/s;
...
add_header Content-Security-Policy "<NGINX_CSP>";
```

**Why it breaks:** Entrypoint script should template-substitute `<API_USER_SCOPE>`, `<NGINX_CSP>`, etc. at pod start. If vars are baked at build-time, changing them requires rebuild.

**Proposed Fix:** Add entrypoint.sh that `envsubst` on `nginx-run.template` → write to `/etc/nginx/nginx.conf` before starting nginx. Pass templated file as ConfigMap.  
**Effort:** S (shell script + Dockerfile CMD change)  
**Priority:** P1 (config changes require rebuild+push, slow feedback)

---

### 3. BullMQ Queue Persistence Tied to Redis Host

**Location:** `packages/deces-backend/src/processStream.ts:61-71`

```typescript
const jobQueue = new Queue('jobs', {
  connection: { host: 'redis' }
});
const chunkQueue = new Queue('chunks', {
  connection: { host: 'redis' }
});
```

**Why it breaks:** Hardcoded `host: 'redis'` assumes K8s Service named `redis`. No fallback. If Redis pod restarts slowly, job queue is stuck.

**Proposed Fix:** Use env var `REDIS_HOST` (default 'redis'), add startup check (readiness probe) for Redis availability.  
**Effort:** XS (one-line change)  
**Priority:** P1 (intermittent failures if Redis becomes unreachable)

---

### 4. No Request Timeout/Cancellation for Long Jobs

**Location:** `packages/deces-backend/src/processStream.ts:159-231` (processCsv)

**Why it breaks:** Large file processing can take hours. No timeout mechanism. Rolling update kills pods → job left orphaned (BullMQ will retry on next poll). Chunk Worker has no circuit-breaker.

**Proposed Fix:** Add `job.progress()` heartbeat, set BullMQ job timeout, add graceful shutdown handler to mark in-progress jobs for retry.  
**Effort:** M (integrate job heartbeat, signal handlers)  
**Priority:** P1 (rolling updates will orphan long jobs)

---

### 5. No Kubernetes Probes Configuration

**Location:** `deploy/k8s/base/deces-backend.deployment.yaml:50-63` (readiness/liveness OK, but no startup probe)

**Why it breaks:** Deployment has readiness/liveness but no startup probe. If backend takes >60s to become ready (e.g., Elasticsearch slow to connect), liveness probe kills pod before it's ready.

**Proposed Fix:** Add `startupProbe` with high `failureThreshold` (e.g., 30 * 10s = 300s tolerance).  
**Effort:** XS (YAML field addition)  
**Priority:** P1 (slow startups trigger crash loop)

---

### 6. No Resource Requests for Workers

**Location:** `packages/deces-backend/src/processStream.ts:269-287` (Worker inline, no K8s Job abstraction)

**Why it breaks:** Chunk worker created as background process in Deployment, not K8s Job/CronJob. Consumes resources untracked. No separate scaling. If worker crashes, Deployment pod restart, but long-running job is lost.

**Proposed Fix:** Move chunk/job processing to separate K8s Job or long-running Deployment with worker-specific resources. Or: use Lambda/Knative for serverless scaling.  
**Effort:** L (refactor worker model, K8s Job integration)  
**Priority:** P1 (resource starvation, no observability)

---

## P2 Findings (Nice-to-have, non-blocking)

### 1. User Database File Persistence

**Location:** `packages/deces-backend/src/userDB.ts` (assumed file-based, not verified in read)

**Why it breaks:** If user DB is file-based (`DB_JSON=data/userDB.json`), no PVC = data lost. If it's real DB, this is non-issue.

**Proposed Fix:** Verify and document userDB backing store. If file-based, use PVC or migrate to Postgres.  
**Effort:** S (once clarified)  
**Priority:** P2 (user accounts relatively stable, but good hygiene)

---

### 2. Logging to File Only

**Location:** `packages/deces-backend/src/logger.ts` (console output, but loggerStream used throughout)

**Why it breaks:** Winston logs to console (OK). But code calls `loggerStream.write()` directly in many places. If `loggerStream` is a file transport, logs lost on pod restart. Missing central logging.

**Proposed Fix:** Use Winston file + syslog/ELK sink. Or: remove file logging, use stdout only (K8s native).  
**Effort:** S (Winston config change + remove file transport)  
**Priority:** P2 (debugging harder, but audit logs recoverable from ES)

---

### 3. No Graceful Shutdown for File Streams

**Location:** `packages/deces-backend/src/processStream.ts` (streams piped, but no SIGTERM handler)

**Why it breaks:** Pod receives SIGTERM during stream processing. No drain/cancel logic. Partial file writes. Not data-loss in bulk (BullMQ will retry), but messy.

**Proposed Fix:** Add process-level SIGTERM handler to gracefully cancel in-flight streams.  
**Effort:** S (signal handler + stream.destroy() calls)  
**Priority:** P2 (mitigated by BullMQ retry, but cleaner)

---

### 4. Encryption IV Reuse

**Location:** `packages/deces-backend/src/processStream.ts:52`

```typescript
const encryptioniv = crypto.randomBytes(16);
```

**Why it breaks:** IV generated once per pod start, reused for all job encryptions. Same IV + same key = weak. Pod restart generates new IV, but old files can't decrypt.

**Proposed Fix:** Generate unique IV per job, store in metadata (or derive from job ID). Use authenticated encryption (aes-256-gcm, not cbc).  
**Effort:** M (crypto refactor)  
**Priority:** P2 (security concern, not K8s-specific)

---

## Summary Table

| P0 | 8 | OTP store, rate-limit maps, job arrays, JOBS FS, PROOFS FS, cached version, updated records, ES single-node |
|----|------|---|
| P1 | 6 | Sticky sessions, nginx config bake-in, Redis hardcoding, job timeouts, no startup probe, no worker Jobs |
| P2 | 4 | User DB, logging, stream shutdown, IV reuse |

**Total effort to K8s-ready:** ~6-8 weeks (assuming 1 dev, parallelizable into P0 = 2 weeks + P1 = 2 weeks + P2 = 1 week).

---

## Recommended Sequencing

1. **Week 1-2 (P0 Data Loss):** OTP → Redis, rate-limit → Redis, job arrays → Redis, JOBS/PROOFS → PVC or S3, ES → 3-node cluster.
2. **Week 2-3 (P1 Scaling):** Sticky sessions (Service affinity), nginx entrypoint, Redis env vars, startup probe.
3. **Week 3+ (P1 Robustness):** Job timeouts, worker isolation, stream graceful shutdown.
4. **P2:** Logging, encryption, user DB.

---

## Out of Scope

- Surch swap (covered by EXPERIMENT_SURCH.md)
- TLS / cert-manager wiring
- Helm vs Kustomize debate
- Performance tuning

---

**Audit completed by:** Claude AI  
**Branch:** experiment/k8s
