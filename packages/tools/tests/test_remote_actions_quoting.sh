#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
QUOTE_ARGV="${ROOT_DIR}/scripts/shell-quote-argv.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT

MAKEFILE="${TMP_DIR}/Makefile"
cat > "${MAKEFILE}" <<'MAKEFILE'
print:
	@printf 'GOALS=<%s> TITLE=<%s>\n' '$(MAKECMDGOALS)' '$(SLACK_TITLE)'

full:
	@echo FULL_TARGET_EXECUTED
MAKEFILE

unquoted_output=$(sh -c "make -s -f '${MAKEFILE}' print SLACK_TITLE=deces-dataprep - full")
if ! printf '%s\n' "${unquoted_output}" | grep -q 'GOALS=<print full>'; then
	echo "expected unquoted remote command to create a parasite full target" >&2
	printf '%s\n' "${unquoted_output}" >&2
	exit 1
fi
if ! printf '%s\n' "${unquoted_output}" | grep -q 'FULL_TARGET_EXECUTED'; then
	echo "expected unquoted remote command to execute the parasite full target" >&2
	printf '%s\n' "${unquoted_output}" >&2
	exit 1
fi

remote_cmd=$(bash "${QUOTE_ARGV}" make -s -f "${MAKEFILE}" print "SLACK_TITLE=deces-dataprep - full")
quoted_output=$(sh -c "${remote_cmd}")
if ! printf '%s\n' "${quoted_output}" | grep -q 'GOALS=<print> TITLE=<deces-dataprep - full>'; then
	echo "expected quoted remote command to preserve SLACK_TITLE and avoid parasite targets" >&2
	printf '%s\n' "${quoted_output}" >&2
	exit 1
fi
if printf '%s\n' "${quoted_output}" | grep -q 'FULL_TARGET_EXECUTED'; then
	echo "quoted remote command unexpectedly executed the parasite full target" >&2
	printf '%s\n' "${quoted_output}" >&2
	exit 1
fi

echo "remote-actions quoting: ok"
