# PLAN

## Remaining Issues

- [ ] GitHub Actions deprecations
  - update third-party actions still warning on Node 20 deprecation
- [ ] Dataprep remote performance
  - investigate the remaining delta on true `year/full` remote runs
  - keep the post-merge option `SCW prebaked dataprep image` as a separate follow-up, not in the current workstream

## Current Workstream

### CI/CD artifact contract and dependency DAG

Reference specs:

- [SPEC_EVOL_011_CI_ARTIFACT_CONTRACT](spec/SPEC_EVOL_011_CI_ARTIFACT_CONTRACT.md)
- [SPEC_EVOL_012_CD_ARTIFACT_DAG](spec/SPEC_EVOL_012_CD_ARTIFACT_DAG.md)

### Exec

- [ ] Restore the artifact invalidation contract
  - [x] add `VERSION` to `packages/dataprep-backend/tagfiles.version`
  - [x] create `packages/deces-dataprep/tagfiles.version`
  - [x] make the dataprep snapshot hash consume `packages/deces-dataprep/tagfiles.version`
- [x] Replace YAML artifact globs with inline `tagfiles.version` outputs
  - [x] define `artifact_matchid_backend`
  - [x] define `artifact_matchid_frontend`
  - [x] define `artifact_deces_backend`
  - [x] define `artifact_deces_ui`
  - [x] define `artifact_dataprep_snapshot`
  - [x] define `integration_stack`
- [x] Rewire CI on top of those outputs
  - [x] keep component jobs
  - [x] trigger component jobs on explicit `artifact_*` dependencies plus `integration_stack`
  - [x] express the deces chain through existing job conditions
- [x] Rewire CD into explicit `ensure-*` jobs
  - [x] ensure `matchid-backend` before dataprep snapshot production
  - [x] ensure `deces-backend` and `deces-ui` before deploy
  - [x] reduce deploy `needs` to runtime dependencies only
- [ ] Extend the same artifact/DAG model to `release-prod`
  - [x] align prod dataprep auto/full decision with the same inline `tagfiles.version` contract
  - [ ] split `release-prod` into explicit `ensure-*` style stages
    - [ ] introduce `ensure-matchid-backend-image-prod`
    - [ ] introduce `ensure-prod-snapshot`
    - [ ] introduce `deploy-prod`
    - [ ] keep metadata publication as a terminal stage after successful deploy
    - [ ] remove the remaining monolithic branch logic from `release-prod.yml`
  - [ ] validate `release-prod` on the same artifact contract
    - [ ] `deces-ui` only does not force prod dataprep full
    - [ ] `deces-backend` only does not force prod dataprep full
    - [ ] `dataprep-backend` forces prod dataprep full
    - [ ] `deces-dataprep` forces prod dataprep full
    - [ ] workflow-only changes keep the expected `integration` semantics without fake artifact invalidation

### Validation Matrix

- [x] `packages/tools/**` only
- [x] `packages/dataprep-backend/**` only
- [x] `packages/deces-dataprep/**` only
- [x] `packages/deces-backend/**` only
- [x] `packages/deces-ui/**` only
- [x] workflow files only
- [x] combined `dataprep-backend + deces-dataprep`

### UAT

- [ ] Gate: present the final artifact invalidation contract based on `tagfiles.version`
- [ ] Gate: present the final CI integration contract and the final CD DAG
- [ ] Gate: present the validation matrix results before rollout to `main`
