# Main Tags Runtime Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aligner les workflows racine sur `main` et les tags `v*` tout en conservant strictement les labels runtime historiques `GIT_BRANCH=dev/master` dans tous les artefacts de deploiement.

**Architecture:** les workflows GitHub portent les refs Git reelles (`main` ou `v*`), mais les appels `make deploy-remote*` continuent d'injecter `GIT_BRANCH=dev` pour la preprod et `GIT_BRANCH=master` pour la prod. Le deploy preprod doit etre retarde apres `dataprep small` puis `dataprep year` des qu'un changement touche `tools`, `deces-dataprep` ou `dataprep-backend`.

**Tech Stack:** GitHub Actions, GNU Make, shell, YAML, deploy-remote existant.

---

## Scope

Ce plan couvre:

- alignement de `release-prod.yml` sur `v*`;
- preservation stricte de `GIT_BRANCH=dev/master` dans les appels de deploiement;
- ordonnancement `small -> year -> deploy preprod` pour les changements data;
- mise a jour du plan et de la spec en support.

Ce plan ne couvre pas:

- le workflow mensuel `dataprep-monthly.yml`;
- la suppression live de `master`;
- les cibles `make` de bump de versions par package.

## Files

**Modify:**
- `.github/workflows/cd.yml`
- `.github/workflows/release-prod.yml`
- `spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md`
- `PLAN.md`

**Verify:**
- `.github/workflows/cd.yml`
- `.github/workflows/release-prod.yml`

### Task 1: Align Prod Release Trigger To `v*`

**Files:**
- Modify: `.github/workflows/release-prod.yml`

- [ ] **Step 1: Replace `prod/v*` with `v*` in workflow triggers and validations**

Update the workflow header and tag guards:

```yaml
on:
  push:
    tags:
      - 'v*'
```

and:

```bash
case "${PROD_TAG}" in
  v*) ;;
  *)
    echo "invalid prod tag ${PROD_TAG}"
    exit 1
    ;;
esac
```

- [ ] **Step 2: Update previous-tag lookup to match `v*`**

Use:

```bash
PREVIOUS_PROD_TAG="$(git tag --list 'v*' --sort=-creatordate | grep -Fxv "${PROD_TAG}" | head -n 1)"
```

Expected behavior:

- current prod release uses `v2026.04.25.1`;
- previous release lookup ignores the current tag itself.

- [ ] **Step 3: Run static verification**

Run:

```bash
python -c "import yaml, pathlib; yaml.safe_load(pathlib.Path('.github/workflows/release-prod.yml').read_text())"
rg -n "prod/v\\*|prod/v" .github/workflows/release-prod.yml
rg -n "tags:" .github/workflows/release-prod.yml
```

Expected:

- YAML loads successfully;
- no remaining `prod/v*` trigger or validation remains.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release-prod.yml
git commit -m "cd: align prod release tags on v*"
```

### Task 2: Preserve Runtime Labels In Deploy Workflows

**Files:**
- Modify: `.github/workflows/cd.yml`
- Modify: `.github/workflows/release-prod.yml`

- [ ] **Step 1: Force preprod deploys to keep `GIT_BRANCH=dev`**

In `.github/workflows/cd.yml`, ensure the deploy job passes:

```bash
make deploy-remote-preflight \
  GIT_BRANCH=dev \
  DEPLOY_TARGET=dev \
  REMOTE_DEPLOY_BRANCH=main
```

and:

```bash
make deploy-remote \
  GIT_BRANCH=dev \
  DEPLOY_TARGET=dev \
  REMOTE_DEPLOY_BRANCH=main
```

The checkout/build ref remains `main`; only the runtime label stays `dev`.

- [ ] **Step 2: Force prod deploys to keep `GIT_BRANCH=master`**

In `.github/workflows/release-prod.yml`, ensure the deploy steps pass:

```bash
make deploy-remote-preflight \
  GIT_BRANCH=master \
  DEPLOY_TARGET=prod \
  REMOTE_DEPLOY_BRANCH="${PROD_TAG}"
```

and:

```bash
make deploy-remote \
  GIT_BRANCH=master \
  DEPLOY_TARGET=prod \
  REMOTE_DEPLOY_BRANCH="${PROD_TAG}"
```

- [ ] **Step 3: Verify no deploy path leaks `GIT_BRANCH=main` to runtime**

Run:

```bash
rg -n "deploy-remote|deploy-remote-preflight|GIT_BRANCH=" .github/workflows/cd.yml .github/workflows/release-prod.yml
```

Expected:

- preprod deploy calls use `GIT_BRANCH=dev`;
- prod deploy calls use `GIT_BRANCH=master`;
- build and dataprep steps may still use `main` or `${PROD_TAG}` as Git refs where intended.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/cd.yml .github/workflows/release-prod.yml
git commit -m "cd: preserve runtime branch labels"
```

### Task 3: Gate Preprod Deploy Behind Dataprep Refresh

**Files:**
- Modify: `.github/workflows/cd.yml`

- [ ] **Step 1: Extend change detection for the preprod deploy gate**

Ensure the deploy job depends on dataprep refresh when paths include:

```text
packages/tools/**
packages/deces-dataprep/**
packages/dataprep-backend/**
```

while `packages/dataprep-frontend/**` alone must not force a `deces-ui` deploy.

- [ ] **Step 2: Add explicit job dependency order**

Set the deploy job `needs` so that:

```yaml
needs:
  - detect
  - deces-backend
  - deces-ui
  - dataprep-small
  - dataprep-year
```

Then gate its `if:` so it runs only when:

- `deces-ui` or `deces-backend` changed directly; or
- `tools`, `deces-dataprep`, or `dataprep-backend` changed and both dataprep jobs succeeded.

- [ ] **Step 3: Verify dataprep-frontend alone does not deploy preprod**

Run:

```bash
rg -n "dataprep-frontend|deploy" .github/workflows/cd.yml
python -c "import yaml, pathlib; yaml.safe_load(pathlib.Path('.github/workflows/cd.yml').read_text())"
```

Expected:

- `dataprep-frontend` remains scoped to its own build/publication path;
- deploy job logic references only the intended change groups.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/cd.yml
git commit -m "cd: gate preprod deploy behind dataprep refresh"
```

### Task 4: Update Planning Docs

**Files:**
- Modify: `spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md`
- Modify: `PLAN.md`

- [ ] **Step 1: Record the final versioning decisions**

Make sure the spec states:

```text
- prod tag is manual and named `v*`
- no extra release-prep commit after merge
- package versions live in the merged PR commit
- Node package versions are orchestrated by `make`
- `packages/dataprep-backend/VERSION` is accepted as transitional truth
- monthly dataprep failure is alert-only
```

- [ ] **Step 2: Align lot 9 checklist**

Make sure `PLAN.md` reflects:

```text
- `push tag v*`
- manual prod tag after UAT
- keep `GIT_BRANCH=dev/master` in deployment artifacts
- `small -> year -> deploy` for tools/dataprep/dataprep-backend changes
```

- [ ] **Step 3: Verify doc consistency**

Run:

```bash
rg -n "prod/v\\*|release-prep|changeset version|manual prod tag|GIT_BRANCH=dev/master|small|year" spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md PLAN.md
git diff --check spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md PLAN.md
```

Expected:

- no stale `prod/v*` remains in the target model;
- no release-prep-after-merge rule remains;
- no whitespace errors.

- [ ] **Step 4: Commit**

```bash
git add spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md PLAN.md
git commit -m "docs: align main tags runtime label contract"
```

### Task 5: End-To-End Static Verification

**Files:**
- Verify: `.github/workflows/cd.yml`
- Verify: `.github/workflows/release-prod.yml`
- Verify: `spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md`
- Verify: `PLAN.md`

- [ ] **Step 1: Run verification commands**

Run:

```bash
python -c "import yaml, pathlib; [yaml.safe_load(pathlib.Path(p).read_text()) for p in ['.github/workflows/cd.yml','.github/workflows/release-prod.yml']]"
rg -n "prod/v\\*|prod/v" .github/workflows spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md PLAN.md
rg -n "GIT_BRANCH=main" .github/workflows/cd.yml .github/workflows/release-prod.yml
git diff --check
```

Expected:

- both workflows load successfully;
- no remaining target-model `prod/v*` references in touched files;
- no deploy path still uses `GIT_BRANCH=main`;
- `git diff --check` is clean.

- [ ] **Step 2: Commit final slice checkpoint**

```bash
git add .github/workflows/cd.yml .github/workflows/release-prod.yml spec/SPEC_EVOL_010_VERSIONNING_RELEASE_MAIN_TAG.md PLAN.md
git commit -m "docs: checkpoint runtime label cutover slice"
```
