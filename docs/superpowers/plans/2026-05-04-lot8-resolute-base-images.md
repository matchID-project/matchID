# Lot 8 Resolute Base Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SCW remote bootstrap to Ubuntu 26.04 Resolute Raccoon and prove new base images before opening any PR.

**Architecture:** Keep `remote-config` as the single common bootstrap path. Modernize only the shared `docker-install` target, then create and validate two base images: one for `dataprep-backend` and one for the `deces-ui` integration stack. No production release tag, PR, or merge is allowed before the smoke tests and small remote run pass.

**Tech Stack:** GNU Make, Scaleway Instance API, Ubuntu 26.04 Resolute Raccoon, Docker Engine apt repository, Docker Compose plugin with a `docker-compose` compatibility wrapper.

---

### Task 1: Common SCW Bootstrap Defaults

**Files:**
- Modify: `Makefile`
- Modify: `packages/deces-dataprep/Makefile`
- Modify: `packages/tools/artifacts.SCW`

- [ ] Replace the default SCW base image with Ubuntu 26.04 Resolute Raccoon SBS image `98c9d356-4857-4566-ab57-af554a0086fe`.
- [ ] Use generated dataprep-backend reference image `b60d3767-7daa-4f1a-b908-8604134333c2` after smoke validation.
- [ ] Use `SCW_VOLUME_TYPE=sbs_volume` for the Resolute SBS image.
- [ ] Keep existing variables overrideable from command line and `artifacts`.
- [ ] Keep `SCW_VOLUME_TYPE` explicitly propagated wherever remote dataprep/deploy instances are launched: `ci.yml`, `cd.yml`, `release-prod.yml`, and `dataprep-monthly.yml`.
- [ ] Account for the `sbs_15k` contract change: existing workflows used a volume-type environment variable, but current Instance API rejects `volumes.0.volume_type=sbs_15k`; 15k must be represented through the current SBS/IOPS contract rather than by silently dropping the variable.
- [ ] Snapshot `sbs_volume` roots with the Block Storage snapshot API/CLI before creating the Instance image; the resulting image root volume is `sbs_snapshot`.
- [ ] Remove application checkouts before snapshot with a remote `sync` after deletion, and delete detached SBS volumes during cleanup.
- [ ] Disable the unreachable Scaleway Ubuntu PPA before Docker apt bootstrap, otherwise `apt-get update` can block on `ppa.launchpadcontent.net`.

Validation:

```bash
make -n deploy-remote-instance SCW_IMAGE_ID=98c9d356-4857-4566-ab57-af554a0086fe SCW_VOLUME_TYPE=sbs_volume
make -C packages/deces-dataprep -n remote-config SCW_IMAGE_ID=98c9d356-4857-4566-ab57-af554a0086fe SCW_VOLUME_TYPE=sbs_volume
rg -n 'SCW_VOLUME_TYPE|DATAPREP_SCW_VOLUME_TYPE' .github/workflows/ci.yml .github/workflows/cd.yml .github/workflows/release-prod.yml .github/workflows/dataprep-monthly.yml
make -C packages/tools -n SCW-instance-snapshot SCW_VOLUME_TYPE=sbs_volume SCW_ZONE=fr-par-1 SCW_PROJECT_ID=dummy SCW_SECRET_TOKEN=dummy
make -C packages/tools -n remote-cmd REMOTE_CMD="rm -rf matchID && sync" CLOUD_SSHOPTS="-J ubuntu@bastion -o IdentitiesOnly=yes"
```

Expected: both dry runs pass Make parsing and show the Resolute image/volume values in remote-config calls.
Dataprep-backend reference image smoke: `b60d3767-7daa-4f1a-b908-8604134333c2` booted with no application checkout, Docker/Compose, rclone, recode, and the expected Docker image cache.

### Task 2: Modern Docker Install Target

**Files:**
- Modify: `packages/tools/Makefile`

- [ ] Replace `apt-key` and `add-apt-repository` with Docker's official `/etc/apt/keyrings/docker.asc` + `/etc/apt/sources.list.d/docker.sources` flow.
- [ ] Install `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin`.
- [ ] Preserve the existing Make contract by installing `/usr/local/bin/docker-compose` as a wrapper around `docker compose` when no standalone `docker-compose` exists.
- [ ] Keep the RPM path unchanged.

Validation:

```bash
make -C packages/tools -n config-init
```

Expected: Make parsing succeeds and the DEB Docker path uses `docker.sources`, not `apt-key`.

### Task 3: Add Explicit Base Image Build Targets

**Files:**
- Modify: `Makefile`
- Modify: `packages/deces-dataprep/Makefile`

- [ ] Add a root target for the `deces-ui` integration stack base image. It must use the common `remote-config`, pre-pull the stack base images, smoke-test Docker/Compose/rclone, snapshot, create the image, and clean the remote server.
- [ ] Add a `packages/deces-dataprep` target for the `dataprep-backend` base image. It must use the common `remote-config`, pre-pull `python:3.9-slim-bullseye`, `docker.elastic.co/elasticsearch/elasticsearch:${ES_VERSION}`, and the current `matchid/matchid-backend:${APP_VERSION}`, smoke-test Docker/Compose/rclone/recode, snapshot, create the image, and clean the remote server.
- [ ] Both targets must default to `ALLOW_MAKE_GIT_COMMIT=false` and only print the produced image ID unless explicitly overridden.

Validation:

```bash
make -n dataprep-backend-base-image
make -C packages/deces-dataprep -n dataprep-backend-base-image
```

Expected: dry runs show `remote-config`, pre-pulls, smoke, snapshot, image creation, and `remote-clean` in that order.

### Task 4: Remote Proof Before PR

**Files:**
- No additional file changes.

- [ ] Run a canary remote config on Ubuntu 26.04 with `GIT_BRANCH=test-resolute-remote-config`.
- [ ] Confirm on the remote host: `lsb_release -a`, `docker version`, `docker compose version`, `docker-compose version`, `rclone version`.
- [ ] Publish the `dataprep-backend` base image from the target.
- [ ] Run a small dataprep with `FILES_TO_PROCESS=deces-2020-m01.txt.gz` using that image.
- [ ] Publish the `deces-ui` integration stack base image from the target.
- [ ] Run a deploy-dev smoke using that image.
- [ ] Verify no `matchid-*test-resolute*` SCW instance remains running after each attempt.

Gate:

```bash
scw instance server list zone=fr-par-1 -o json | jq -r '.[] | select(.name | test("test-resolute")) | [.id,.name,.state] | @tsv'
```

Expected: no output after cleanup.

### Task 5: PR Gate

**Files:**
- No additional file changes.

- [ ] Present the image IDs, smoke logs summary, small dataprep duration, deploy-dev smoke status, and cleanup verification.
- [ ] Open PR only after explicit user approval.
- [ ] Do not create any prod tag in this lot.
