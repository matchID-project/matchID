#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="$(mktemp)"
ERR_FILE="$(mktemp)"
STUB_DIR=""
trap 'rm -f "${OUT_FILE}" "${ERR_FILE}"; if [[ -n "${STUB_DIR}" ]]; then rm -rf "${STUB_DIR}"; fi' EXIT

if ! make -pn -C "${ROOT_DIR}" deploy-remote \
  GIT_BRANCH=master \
  DEPLOY_DELETE_OLD=false \
  SCW_SECRET_TOKEN=dummy \
  SCW_PROJECT_ID=dummy \
  SCW_IMAGE_ID=dummy \
  STORAGE_ACCESS_KEY=dummy \
  STORAGE_SECRET_KEY=dummy \
  TOOLS_STORAGE_ACCESS_KEY=dummy \
  TOOLS_STORAGE_SECRET_KEY=dummy \
  LOG_BUCKET=dummy \
  LOG_DB_BUCKET=dummy \
  STATS_BUCKET=dummy \
  PROOFS_BUCKET=dummy \
  BACKEND_TOKEN_KEY=dummy \
  BACKEND_TOKEN_PASSWORD=dummy \
  NGINX_HOST=dummy \
  NGINX_USER=dummy \
  CDN_TOKEN=dummy \
  CDN_ZONE_ID=dummy \
  NEW_RELIC_INGEST_KEY=dummy \
  NEW_RELIC_API_KEY=dummy \
  NEW_RELIC_ACCOUNT_ID=dummy \
  > "${OUT_FILE}" \
  2> "${ERR_FILE}"; then
  cat "${ERR_FILE}" >&2
  exit 1
fi

deploy_remote_line="$(awk '/^deploy-remote:/ { print; exit }' "${OUT_FILE}")"

if [[ "${deploy_remote_line}" == *"deploy-delete-old"* ]]; then
  echo "deploy-remote must not depend on deploy-delete-old when DEPLOY_DELETE_OLD=false" >&2
  echo "${deploy_remote_line}" >&2
  exit 1
fi

if [[ "${deploy_remote_line}" != *"deploy-remote-prod-instance-limit"* ]]; then
  echo "prod deploy must check the prod instance limit before ordering a server" >&2
  echo "${deploy_remote_line}" >&2
  exit 1
fi

if ! awk '
  /if \[\[ \( "\$\{GITHUB_EVENT_NAME\}" == "workflow_dispatch" && "\$\{DEPLOY_TARGET\}" == "prod" \) \]\]/ {
    in_prod = 1
  }
  in_prod && /make deploy-remote/ {
    in_make = 1
  }
  in_make && /DEPLOY_DELETE_OLD=false/ {
    found = 1
  }
  in_make && /^          fi$/ {
    exit
  }
  END {
    exit found ? 0 : 1
  }
' "${ROOT_DIR}/.github/workflows/cd.yml"; then
  echo "prod workflow dispatch must pass DEPLOY_DELETE_OLD=false to deploy-remote" >&2
  exit 1
fi

STUB_DIR="$(mktemp -d)"
cat > "${STUB_DIR}/curl" <<'EOF'
#!/usr/bin/env bash
case "${FAKE_SCW_SERVER_SET:-one}" in
  one)
    cat <<'JSON'
{"servers":[{"name":"matchid-deces-ui-master","tags":["master","current"],"state":"running"},{"name":"matchid-deces-ui-dev","tags":["dev","current"],"state":"running"}]}
JSON
    ;;
  two)
    cat <<'JSON'
{"servers":[{"name":"matchid-deces-ui-master","tags":["master","current"],"state":"running"},{"name":"matchid-deces-ui-master","tags":["master","previous"],"state":"running"}]}
JSON
    ;;
  *)
    echo "unsupported FAKE_SCW_SERVER_SET=${FAKE_SCW_SERVER_SET}" >&2
    exit 1
    ;;
esac
EOF
chmod +x "${STUB_DIR}/curl"

PATH="${STUB_DIR}:${PATH}" \
FAKE_SCW_SERVER_SET=one \
make -s -C "${ROOT_DIR}" deploy-remote-prod-instance-limit \
  GIT_BRANCH=master \
  DEPLOY_DELETE_OLD=false \
  SCW_SECRET_TOKEN=dummy \
  SCW_API=https://example.invalid \
  > "${OUT_FILE}"

if ! grep -q "prod deploy instance limit ok: 1/2 matchid-deces-ui-master servers" "${OUT_FILE}"; then
  echo "prod instance limit should allow a second preserved prod server" >&2
  cat "${OUT_FILE}" >&2
  exit 1
fi

if PATH="${STUB_DIR}:${PATH}" \
  FAKE_SCW_SERVER_SET=two \
  make -s -C "${ROOT_DIR}" deploy-remote-prod-instance-limit \
    GIT_BRANCH=master \
    DEPLOY_DELETE_OLD=false \
    SCW_SECRET_TOKEN=dummy \
    SCW_API=https://example.invalid \
    > "${OUT_FILE}" 2> "${ERR_FILE}"; then
  echo "prod instance limit must refuse creating a third preserved prod server" >&2
  cat "${OUT_FILE}" >&2
  exit 1
fi

if ! grep -q "refusing prod deploy: 2 matchid-deces-ui-master servers already exist" "${OUT_FILE}"; then
  echo "prod instance limit failure message is missing expected server count" >&2
  cat "${OUT_FILE}" >&2
  cat "${ERR_FILE}" >&2
  exit 1
fi
