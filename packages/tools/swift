#!/usr/bin/env bash
tty="-t $(tty &>/dev/null && echo "-i")"

docker run --rm $tty \
		-v "$HOME:$HOME" \
		--env HTTP_PROXY=${http_proxy}\
		--env HTTPS_PROXY=${https_proxy}\
		--env OS_AUTH_URL=${OS_AUTH_URL}\
		--env OS_SWIFT_URL=${OS_SWIFT_URL}\
		--env OS_IDENTITY_API_VERSION=${OS_IDENTITY_API_VERSION}\
		--env OS_REGION_NAME=${OS_REGION_NAME}\
		--env OS_USER_DOMAIN_NAME=${OS_USER_DOMAIN_NAME}\
		--env OS_PROJECT_DOMAIN_NAME=${OS_PROJECT_DOMAIN_NAME}\
		--env OS_TENANT_ID=${OS_TENANT_ID}\
		--env OS_TENANT_NAME=${OS_TENANT_NAME}\
		--env OS_USERNAME=${OS_USERNAME}\
		--env OS_PASSWORD=${OS_PASSWORD}\
		--env OS_SWIFT_ID=${OS_SWIFT_ID}\
		matchid/swift "$@"
