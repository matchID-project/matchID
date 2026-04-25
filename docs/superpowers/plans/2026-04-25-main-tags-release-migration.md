# Main And Tags Release Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** migrer le monorepo du schema `dev/master` vers `main + tags prod`, avec deploiement auto preprod sur `main` et release prod pilotee par `prod/v*`, tout en conservant le switch reseau actuel `nginx-conf-apply`.

**Architecture:** la migration est decoupee en trois sous-projets. Ce plan ne couvre que le sous-projet 1, c'est-a-dire la refonte des workflows racine et des variables de branche/release pour supporter `main` et les tags prod sans encore implementer le dataprep mensuel. Le dataprep mensuel et la gouvernance GitHub live restent dans des plans suivants, pour garder des commits petits et testables.

**Tech Stack:** GitHub Actions, GNU Make, shell, Changesets (Node, prepare only), version file Python, deploy-remote existant.

---

## Scope

Ce plan couvre uniquement:

- remplacement des references `dev` / `master` par `main` et `prod/v*` dans les workflows racine;
- introduction d'un contrat de release explicite dans les Makefiles racine;
- preparation du terrain pour `changesets` et `packages/dataprep-backend/VERSION`;
- conservation du switch `nginx-conf-apply` / bastion sur le chemin de publication.

Ce plan ne couvre pas:

- le dataprep mensuel auto-redeploy;
- la suppression live des branches GitHub et protections;
- la bascule de secrets ou de rulesets live;
- le cleanup final.

## Files

**Create:**
- `packages/dataprep-backend/VERSION`
- `.changeset/README.md`
- `.github/workflows/release-prod.yml`

**Modify:**
- `Makefile`
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`
- `packages/deces-backend/Makefile`
- `packages/dataprep-backend/Makefile`
- `packages/dataprep-frontend/Makefile`
- `spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md`
- `PLAN.md`

**Verify:**
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`
- `.github/workflows/release-prod.yml`
- `Makefile`
- `packages/deces-backend/Makefile`
- `packages/dataprep-backend/Makefile`
- `packages/dataprep-frontend/Makefile`

### Task 1: Normalize Branch And Release Variables

**Files:**
- Modify: `Makefile`
- Modify: `packages/deces-backend/Makefile`
- Modify: `packages/dataprep-backend/Makefile`
- Modify: `packages/dataprep-frontend/Makefile`

- [x] **Step 1: Replace branch-name assumptions with explicit main/release variables**

Update the root `Makefile` to stop encoding production in `master` and preprod in `dev`. Introduce these variables near the current `GIT_BRANCH` / `GIT_BRANCH_MASTER` block:

```make
export GIT_BRANCH ?= $(or ${GITHUB_HEAD_REF},$(shell git rev-parse --abbrev-ref HEAD 2>/dev/null | sed 's/^HEAD$$/detached-head/'))
export GIT_BRANCH_MAIN ?= main
export RELEASE_TAG_PREFIX ?= prod/v
export DEPLOY_TARGET ?=
export PREPROD_APP_DNS ?= dev-${APP_DNS}
```

Replace checks that currently infer prod from `GIT_BRANCH == master` with explicit logic:

```make
ifeq (${DEPLOY_TARGET},prod)
  APP_DNS_TARGET := ${APP_DNS}
else
  APP_DNS_TARGET := ${PREPROD_APP_DNS}
endif
```

- [x] **Step 2: Replace legacy branch constants in package Makefiles**

Patch the package Makefiles so they no longer hardcode `master` or `dev` as the only branch identities:

```make
export GIT_BRANCH_MAIN ?= main
export GIT_BRANCH_RELEASE ?= ${GIT_BRANCH_MAIN}
```

For `packages/dataprep-frontend/Makefile`, replace:

```make
export GIT_BRANCH=dev
export GIT_BACKEND_BRANCH=dev
```

with overridable defaults:

```make
export GIT_BRANCH ?= main
export GIT_BACKEND_BRANCH ?= ${GIT_BRANCH}
```

For `packages/dataprep-backend/Makefile`, replace:

```make
export GIT_BRANCH_MASTER=master
export GIT_FRONTEND_BRANCH:=$(shell [ "${GIT_BRANCH}" = "${GIT_BRANCH_MASTER}" ] && echo -n "${GIT_BRANCH_MASTER}" || echo -n dev)
```

with:

```make
export GIT_BRANCH_MAIN ?= main
export GIT_FRONTEND_BRANCH ?= ${GIT_BRANCH}
```

- [x] **Step 3: Add a non-destructive verification target for release resolution**

Add a helper target to the root `Makefile`:

```make
release-context:
	@echo GIT_BRANCH=${GIT_BRANCH}
	@echo DEPLOY_TARGET=${DEPLOY_TARGET}
	@echo RELEASE_TAG_PREFIX=${RELEASE_TAG_PREFIX}
	@echo APP_DNS_TARGET=${APP_DNS_TARGET}
```

Expected usage:

```bash
make release-context GIT_BRANCH=main DEPLOY_TARGET=dev
make release-context GIT_BRANCH=detached-head DEPLOY_TARGET=prod
```

- [x] **Step 4: Verify Makefile parsing and release-context output**

Run:

```bash
make release-context GIT_BRANCH=main DEPLOY_TARGET=dev
make release-context GIT_BRANCH=main DEPLOY_TARGET=prod
make -C packages/deces-backend -qp GIT_BRANCH=main >/dev/null
make -C packages/dataprep-backend version GIT_BRANCH=main
make -C packages/dataprep-frontend version GIT_BRANCH=main GIT_BACKEND_BRANCH=main
```

Expected:

- all commands exit `0`;
- no remaining forced `master` / `dev` assumption is printed by these paths;
- `release-context` prints `main` and the requested `DEPLOY_TARGET`.
- `release-context` resolves `APP_DNS_TARGET=dev-deces.matchid.io` in preprod and `APP_DNS_TARGET=deces.matchid.io` in prod.

- [x] **Step 5: Commit**

```bash
git add Makefile packages/deces-backend/Makefile packages/dataprep-backend/Makefile packages/dataprep-frontend/Makefile
git commit -m "refactor: normalize main and release branch variables"
```

### Task 2: Refactor CI For `main`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Update CI triggers to main only**

Change the workflow header from:

```yaml
on:
  pull_request:
    branches:
      - dev
      - master
  push:
    branches:
      - dev
      - master
```

to:

```yaml
on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main
```

- [x] **Step 2: Preserve existing job names and path logic**

Do not rename the existing CI job names in this task. Keep:

- `Detect changed areas`
- `build docker swift`
- `dataprep-backend pull request test`
- `dataprep-frontend pull request test`
- `deces-backend build docker image and tests`
- `deces-dataprep locally`
- `deces-ui pull request test`

The only CI behavior change in this task is the branch target.

- [x] **Step 3: Verify workflow syntax**

Run:

```bash
node --check <(cat <<'EOF'
const fs = require('fs');
const yaml = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
if (!yaml.includes('branches:\n      - main')) process.exit(1);
EOF
)
```

Then run:

```bash
rg -n "dev|master" .github/workflows/ci.yml
```

Expected:

- only intentional residual references remain, if any;
- no trigger block still targets `dev` or `master`.

- [x] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: target main branch"
```

### Task 3: Split CD Into Main Push And Prod Tag Release

**Files:**
- Modify: `.github/workflows/cd.yml`
- Create: `.github/workflows/release-prod.yml`

- [x] **Step 0: Sanitize tag-derived app versions for Docker-safe release tags**

Before introducing `prod/v*` tags in workflows, sanitize tag-derived
`APP_VERSION` values in the root and package `Makefile`s so `/` never leaks
into Docker tags or release artifacts. This prerequisite is validated by
preserving current `make version` outputs and by checking that
`prod/v2026.04.25.1-2-g123abcd` becomes `prod-v2026.04.25.1-2-g123abcd`.

- [x] **Step 0.b: Allow explicit dataprep/data version injection for prod reuse**

Add `DATAPREP_VERSION_OVERRIDE` and `DATA_VERSION_OVERRIDE` to the root
`Makefile` so a prod tag release can redeploy with an already published
snapshot, without recomputing `.dataprep.sha1` / `.data.sha1` from newer source
inputs at deploy time.

- [x] **Step 1: Change cd.yml to serve main only**

Change the trigger block in `.github/workflows/cd.yml` so it becomes the preprod workflow:

```yaml
on:
  repository_dispatch:
    types: [data-update]
  push:
    branches:
      - main
  workflow_dispatch:
```

Remove `master` branch push handling from this workflow.

- [x] **Step 2: Rewrite branch-sensitive conditions in cd.yml**

Replace every `refs/heads/dev` condition with `refs/heads/main` when the intent is preprod.

Replace every `refs/heads/master` condition with either:

- removal from `cd.yml`, or
- transfer to the future `release-prod.yml` if it is prod-specific.

Specific sections to rewrite:

- `dataprep-small`
- `dataprep-year`
- `dataprep-full`
- `deploy`

After this task, `cd.yml` must implement:

- `push main` -> preprod deploy + dev snapshots;
- `workflow_dispatch` on `main` -> manual preprod actions only;
- no prod release path.

- [x] **Step 3: Create release-prod.yml for prod tags**

Create `.github/workflows/release-prod.yml` with:

```yaml
name: Release Prod

on:
  push:
    tags:
      - 'prod/v*'
  workflow_dispatch:
    inputs:
      prod_tag:
        description: Prod tag to release
        required: true
        type: string
```

The workflow must:

- checkout the tagged ref;
- verify the tag commit is reachable from `main`;
- publish the required app images for that ref;
- decide whether the dataprep stack changed;
- if yes, run prod dataprep full;
- if no, reuse the current prod snapshot;
- call `make deploy-remote` with `DEPLOY_TARGET=prod`.

Do not implement the monthly schedule in this task.

- [x] **Step 4: Preserve the current network publication mechanism**

Ensure `release-prod.yml` uses the existing switch sequence:

```text
remote-test-api-in-vpc -> nginx-conf-apply -> remote-test-api -> cdn-cache-purge
```

Do not add CDN record switching.

- [x] **Step 5: Verify workflow files**

Run:

```bash
rg -n "refs/heads/dev|refs/heads/master|branches:\n      - dev|branches:\n      - master" .github/workflows/cd.yml .github/workflows/release-prod.yml
```

Then inspect:

```bash
sed -n '1,220p' .github/workflows/cd.yml
sed -n '1,240p' .github/workflows/release-prod.yml
```

Expected:

- `cd.yml` only targets `main`;
- `release-prod.yml` only targets `prod/v*` tags or manual dispatch;
- no prod behavior remains hidden in `push main`.

- [x] **Step 6: Commit**

```bash
git add .github/workflows/cd.yml .github/workflows/release-prod.yml
git commit -m "cd: split main preprod and prod tag release"
```

### Task 4: Prepare Versioning Inputs

**Files:**
- Create: `packages/dataprep-backend/VERSION`
- Create: `.changeset/README.md`
- Modify: `spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md`
- Modify: `PLAN.md`

- [x] **Step 1: Add dataprep-backend version file**

Create `packages/dataprep-backend/VERSION` with an initial value matching the currently documented stream, for example:

```text
0.3.0
```

Use the exact current semantic base already implied by upstream package naming if a more precise value is available during implementation.

- [x] **Step 2: Add repository-local changesets guidance**

Create `.changeset/README.md` with a short project-local contract:

```md
# Changesets

This monorepo uses Changesets for Node packages:

- `packages/deces-ui`
- `packages/deces-backend`
- `packages/dataprep-frontend`

Do not edit package versions manually in feature PRs.
Do not use Changesets for `packages/dataprep-backend`.
Use `packages/dataprep-backend/VERSION` for the Python backend semantic version.
```

- [x] **Step 3: Align spec and plan with the first executable slice**

Update `spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md` and `PLAN.md` to note:

- `release-prod.yml` now carries prod tag release;
- monthly dataprep remains open;
- `changesets` integration is prepared but not yet executed end-to-end.

- [x] **Step 4: Verify files**

Run:

```bash
test -s packages/dataprep-backend/VERSION
test -s .changeset/README.md
rg -n "release-prod.yml|changesets|packages/dataprep-backend/VERSION" spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md PLAN.md .changeset/README.md
```

Expected:

- all files exist and are non-empty;
- spec and plan mention the exact new artifacts.

- [ ] **Step 5: Commit**

```bash
git add packages/dataprep-backend/VERSION .changeset/README.md spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md PLAN.md
git commit -m "docs: prepare main and tags versioning inputs"
```

### Task 5: Final Verification Of Slice 1

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/cd.yml`
- Verify: `.github/workflows/release-prod.yml`
- Verify: `Makefile`
- Verify: `packages/deces-backend/Makefile`
- Verify: `packages/dataprep-backend/Makefile`
- Verify: `packages/dataprep-frontend/Makefile`

- [ ] **Step 1: Run branch/reference grep across the touched surface**

Run:

```bash
rg -n "\\bdev\\b|\\bmaster\\b" .github/workflows Makefile packages/deces-backend/Makefile packages/dataprep-backend/Makefile packages/dataprep-frontend/Makefile
```

Expected:

- only intentional residual references remain;
- every residual reference is explainable as legacy package behavior outside slice 1 or as test fixture/doc text.

- [ ] **Step 2: Run workflow and Makefile smoke checks**

Run:

```bash
make release-context GIT_BRANCH=main DEPLOY_TARGET=dev
make release-context GIT_BRANCH=detached-head DEPLOY_TARGET=prod
```

And:

```bash
rg -n "prod/v\\*" .github/workflows/release-prod.yml
rg -n "branches:\n      - main" .github/workflows/ci.yml .github/workflows/cd.yml
```

Expected:

- release-context succeeds for both invocations;
- `release-prod.yml` matches `prod/v*`;
- `ci.yml` and `cd.yml` target `main`.

- [ ] **Step 3: Update PLAN.md checkboxes for the slice actually completed**

Tick only the lines that are materially closed by Tasks 1-4:

- `Remplacer dev par main ...`
- `Definir et appliquer la convention de tags ...` only if implemented in workflow and docs;
- `Introduire une source de version ...` only if `VERSION` is created and wired enough to count;
- `Refondre ci.yml et cd.yml ...` only if both workflows are actually migrated.

Do not tick:

- monthly dataprep proof;
- live GitHub governance reconfiguration;
- branch deletion.

- [ ] **Step 4: Commit**

```bash
git add PLAN.md
git commit -m "docs: checkpoint slice 1 main and tags migration"
```

---

## Follow-up Plans Needed After This One

1. `dataprep-monthly-prod-redeploy`
2. `github-governance-main-tags-cutover`
3. `changesets-release-prep-and-package-tags`
