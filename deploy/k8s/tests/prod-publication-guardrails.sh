#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
release_workflow="$repo_root/.github/workflows/release-prod.yml"
monthly_workflow="$repo_root/.github/workflows/dataprep-monthly.yml"

fail() {
  echo "$*" >&2
  exit 1
}

if sed -n '1,24p' "$release_workflow" | grep -Eq '^[[:space:]]*push:'; then
  fail "release-prod must not be triggered by prod tag push; the final tag is created after successful publication"
fi

grep -Fq 'group: prod-release' "$release_workflow" ||
  fail "release-prod must use a single global prod-release concurrency group"

grep -Fq 'release_kind:' "$release_workflow" ||
  fail "release-prod must expose release_kind"
grep -Fq -- '- app_and_data' "$release_workflow" ||
  fail "release-prod must support app_and_data"
grep -Fq -- '- data_only' "$release_workflow" ||
  fail "release-prod must support data_only"
grep -Fq -- '- rollback' "$release_workflow" ||
  fail "release-prod must support rollback"

if grep -Fq -- '- deploy_only' "$release_workflow" || grep -Fq -- '- full_and_deploy' "$release_workflow"; then
  fail "release-prod must not keep legacy deploy_only/full_and_deploy modes"
fi

grep -Fq "vYYYY.MM.DD.N" "$release_workflow" ||
  fail "release-prod must strictly validate vYYYY.MM.DD.N tags"

grep -Fq 'git tag -a "$FINAL_PROD_TAG"' "$release_workflow" ||
  fail "release-prod must create the annotated final prod tag after smokes"

grep -Fq "if: needs.release-context.outputs.release_kind == 'app_and_data'" "$release_workflow" ||
  fail "runtime secrets must be limited to app_and_data"
grep -Fq 'make -C deploy/k8s prod-runtime-secrets' "$release_workflow" ||
  fail "runtime secret application must use prod-runtime-secrets"
grep -Fq "deploy-prod.result == 'success'" "$release_workflow" ||
  fail "release metadata must depend on a successful deploy-prod job"
grep -Fq "needs.ensure-prod-snapshot.result == 'success'" "$release_workflow" ||
  fail "deploy-prod must run when snapshot selection succeeds even if dataprep image job is skipped"

if grep -Fq 'make -C deploy/k8s prod-secrets' "$release_workflow"; then
  fail "release-prod must not call broad prod-secrets"
fi

if grep -Eq 'rollout status deploy/redis|wait .*deploy/redis' "$release_workflow"; then
  fail "release-prod must wait on statefulset/redis, not deploy/redis"
fi
grep -Fq 'statefulset/redis' "$release_workflow" ||
  fail "release-prod must wait on statefulset/redis"

grep -Fq 'healthcheck readiness version' "$release_workflow" ||
  fail "release-prod smokes must include readiness"
grep -Fq 'healthcheck readiness version' "$release_workflow" ||
  fail "release-prod smokes must include version"
grep -Fq 'redis-cli ping' "$release_workflow" ||
  fail "release-prod smokes must include Redis"
grep -Fq 'public_version_json=' "$release_workflow" ||
  fail "release-prod metadata must persist public /version output"

if grep -Eq '^[[:space:]]{2}deploy-prod-k8s:' "$monthly_workflow"; then
  fail "dataprep-monthly must not deploy prod directly"
fi
grep -Fq "cron: '3 */4 * * *'" "$monthly_workflow" ||
  fail "dataprep-monthly must scan every 4 hours"
grep -Fq 'SNAPSHOT_NAME=$(make artifact-version-dataprep-snapshot FILES_TO_PROCESS="${DATAPREP_FILES_TO_PROCESS_PROD}"' "$monthly_workflow" ||
  fail "dataprep-monthly metadata must use the prod file pattern explicitly"
if grep -Fq 'Deploy deces.matchid.io' "$monthly_workflow" || grep -Fq 'make deploy-remote' "$monthly_workflow"; then
  fail "dataprep-monthly must not use the legacy VM deploy path"
fi
if grep -Fq 'make -C deploy/k8s prod-secrets' "$monthly_workflow"; then
  fail "dataprep-monthly must not apply prod runtime secrets"
fi
grep -Fq 'gh workflow run release-prod.yml' "$monthly_workflow" ||
  fail "dataprep-monthly must delegate publication to release-prod"
grep -Fq 'gh run watch "${release_run_id}" --exit-status' "$monthly_workflow" ||
  fail "dataprep-monthly must wait for the dispatched release-prod run"
grep -Fq 'release_kind=data_only' "$monthly_workflow" ||
  fail "dataprep-monthly must dispatch release-prod in data_only mode"
