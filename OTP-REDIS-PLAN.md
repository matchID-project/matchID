# Mini-plan — OTP in Redis + Redis resilience (matchID/deces)

Branch: `feat/otp-redis` from `main` (`6f77a852`, pre-OTP clean).
Source of truth for the work that was rolled back: tag `backup/main-otp-resilient-20260528`.
Original simpler OTP (green on dev 2026-05-25): commits `7b2e2893`, `9572f60d`, `8e96ce54`.

## Goals
1. OTP stored in Redis with TTL (multi-pod safe).
2. Redis self-recovers; backend does NOT need a manual bounce after a Redis blip.
3. k8s-friendly (REDIS_HOST/PORT env, static liveness).
4. Single Redis connection source of truth (no OTP-vs-BullMQ host divergence).

## Root cause of the failed deploys (established)
NOT the code (local repro: image boots, `/healthcheck` 200). Cause = issue **#49**
(proxy → Scaleway Gateway migration) degrading the SSH/probe transport, plus `/version`
probe depending on ES on a 2 GB VM. **Do not deploy to dev until #49 is resolved/bypassed**
— otherwise failures are un-diagnosable (no bastion SSH, deploy dies before fluent-bit logs).

## Keep / fix / drop (vs backup tag)
KEEP: `src/redis.ts` (single source), `src/mail.ts` (OTP+TTL), `auth.controller.ts`,
`index.ts` (logRedisTarget), `processStream.ts`+`job.controller.ts` (BullMQ→bullmqConnection
+ removeOnComplete/removeOnFail = real fix for "Redis fills up"), `package.json`, specs.
FIX: compose `--maxmemory-policy volatile-lru` → **noeviction** (BullMQ requires it).
DROP: autoheal sidecar (restart:always + k8s livenessProbe later), `--appendonly yes` (OTP ephemeral).
SEPARATE: CD-resilience fixes (#73: bounded SSH/probe, container-IP /healthcheck probe,
publish-only-current-instance, incremental `docker logs` on probe failure) → own branch/PR.

## CD mechanics (learned the hard way — do not repeat)
- Backend image publishes ONLY on `push` to main with a backend `tagfiles.version` file changed,
  OR `workflow_dispatch dataprep_scope=all` (FORBIDDEN: triggers heavy dataprep-year).
- `[skip ci]` ANYWHERE in the commit message (incl. body) skips the publish CD.
- `deploy-dev` needs the image to already exist. So: merge WITHOUT [skip ci] → push CD publishes + deploys.
- Never a `Co-authored-by: Claude` trailer in this repo.

## Steps
- [ ] 1. Build `feat/otp-redis`: minimal keep-set + noeviction. (no deploy)
- [ ] 2. Verify LOCALLY: `make backend-test-vitest`; run published-shape image with REDIS_HOST,
        BACKEND_CHUNK_CONCURRENCY=3, BACKEND_JOB_CONCURRENCY=6, noeviction Redis →
        assert `server started` + `/healthcheck 200` + NO eviction warning.
- [ ] 3. Open PR (CI runs; DO NOT merge yet — merge triggers deploy, blocked on #49).
- [ ] 4. Separate branch/PR for CD-resilience (#73 re-derivation + incremental log dump).
- [ ] 5. BLOCK: resolve/bypass #49 (or console fallback for VM forensics).
- [ ] 6. Merge CD-fixes (no [skip ci]) → verify.
- [ ] 7. Merge OTP (no [skip ci]) → push CD publishes image + deploys dev → verify /healthcheck
        + real OTP round-trip; check no duplicate dev VM (blue-green quirk).
- [ ] 8. Prod via tag/release: dataprep_scope=none, never 3rd UI server, never touch prod VM.

## Instrumentation (so we don't fly blind)
- Incremental `docker logs --tail 50` every N failed probe attempts (not only at end — the
  outer timeout killed the SSH session before the end-dump ran).
- Ship backend/redis/dmesg logs to S3 BEFORE the probe (use rclone/scw, never aws CLI).
- dmesg/free -m/journalctl -k capture to settle the OOM question.
