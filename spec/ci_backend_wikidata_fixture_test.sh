#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CI_FILE="${ROOT_DIR}/.github/workflows/ci.yml"
FIXTURE_FILE="${ROOT_DIR}/packages/deces-backend/tests/smoke-wikidata.json"

if ! grep -q "VhfumwT3QnUq" "${FIXTURE_FILE}" || ! grep -q "Q3102639" "${FIXTURE_FILE}"; then
  echo "backend smoke wikidata fixture must cover server.spec.ts id link expectation" >&2
  exit 1
fi

assert_seeded_backend_build() {
  local job_name="$1"
  local build_step_pattern="$2"

  if ! awk -v job_name="${job_name}" -v build_step_pattern="${build_step_pattern}" '
    $0 ~ "^  " job_name ":" {
      in_job = 1
    }
    in_job && /name: Seed backend smoke wikidata fixture/ {
      saw_seed = 1
    }
    in_job && /cp packages\/deces-backend\/tests\/smoke-wikidata.json/ {
      saw_copy = 1
    }
    in_job && /DATA_DIR=data .*backend-build-image/ {
      saw_relative_data_dir = 1
    }
    in_job && /DATA_DIR=\$\{GITHUB_WORKSPACE\}\/packages\/deces-backend\/data .*backend-build-image/ {
      exit 1
    }
    in_job && $0 ~ build_step_pattern {
      saw_build = 1
      if (!saw_seed || !saw_copy) {
        exit 1
      }
    }
    in_job && /^  [a-zA-Z0-9_-]+:/ && $0 !~ "^  " job_name ":" {
      exit
    }
    END {
      exit (saw_seed && saw_copy && saw_build && saw_relative_data_dir) ? 0 : 1
    }
  ' "${CI_FILE}"; then
    echo "CI job ${job_name} must seed smoke wikidata fixture before backend-build-image" >&2
    exit 1
  fi
}

assert_seeded_backend_build "deces-backend-build" "name: Build backend image"
assert_seeded_backend_build "deces-ui-pull-request-test" "name: Build backend image for deploy-local"
