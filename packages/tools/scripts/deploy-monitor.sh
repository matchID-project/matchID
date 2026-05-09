#!/usr/bin/env bash
set -euo pipefail

NEW_RELIC_REGION="${NEW_RELIC_REGION:-EU}"
MONITOR_APT_GRACE_SECONDS="${MONITOR_APT_GRACE_SECONDS:-30}"

require_env() {
	local name="$1"
	if [ -z "${!name:-}" ]; then
		echo "error: ${name} is required" >&2
		exit 1
	fi
}

restart_unattended_upgrades() {
	sudo systemctl start unattended-upgrades >/dev/null 2>&1 || true
}

install_newrelic() {
	echo "Installing New Relic CLI and integrations"
	curl -fsSL https://download.newrelic.com/install/newrelic-cli/scripts/install.sh | bash
	sudo env \
		HTTPS_PROXY="${HTTPS_PROXY:-}" \
		NEW_RELIC_API_KEY="${NEW_RELIC_API_KEY}" \
		NEW_RELIC_ACCOUNT_ID="${NEW_RELIC_ACCOUNT_ID}" \
		NEW_RELIC_REGION="${NEW_RELIC_REGION}" \
		/usr/local/bin/newrelic install -y

	local discovered="/etc/newrelic-infra/logging.d/discovered.yml"
	if sudo test -e "${discovered}" && ! sudo test -s "${discovered}"; then
		echo "Disabling empty New Relic log discovery config"
		sudo mv "${discovered}" "${discovered}.disabled"
	fi

	sudo systemctl enable newrelic-infra
	sudo systemctl restart newrelic-infra
	sudo systemctl is-active --quiet newrelic-infra
	echo "New Relic Installed"
}

install_fluentbit() {
	echo "Installing Fluent Bit"
	curl -fsSL https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh
	sudo install -m 0644 /tmp/fluent-bit.conf /etc/fluent-bit/fluent-bit.conf
	if [ -s /tmp/plugins.conf ]; then
		sudo install -m 0644 /tmp/plugins.conf /etc/fluent-bit/plugins.conf
	fi
	echo 'HOME=/root' | sudo tee /etc/default/fluent-bit >/dev/null
	sudo systemctl daemon-reload
	sudo systemctl enable fluent-bit
	sudo systemctl restart fluent-bit
	sudo systemctl is-active --quiet fluent-bit
	echo "Fluent-bit installed"
}

require_env NEW_RELIC_API_KEY
require_env NEW_RELIC_ACCOUNT_ID

trap restart_unattended_upgrades EXIT
sudo systemctl stop unattended-upgrades >/dev/null 2>&1 || true
sleep "${MONITOR_APT_GRACE_SECONDS}"

install_newrelic 2>&1 | tee "${HOME}/.install-newrelic.log"
install_fluentbit 2>&1 | tee "${HOME}/.install-fluentbit.log"
echo "Monitor installed"
