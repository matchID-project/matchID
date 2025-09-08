# Makefile for deces-ui
# Frontend and nginx services management

# Frontend basic configuration variables
export FRONTEND_DEV_HOST = frontend-development
export FRONTEND_DEV_PORT = ${PORT}

# Nginx configuration variables
export NGINX_PATH = ${FRONTEND_PATH}/nginx
export NGINX_TIMEOUT = 30
export NGINX_CSP=default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval' static.cloudflareinsights.com ajax.cloudflare.com www.googletagmanager.com fundingchoicesmessages.google.com www.google.com www.google.ca analytics.google.com www.google-analytics.com pagead2.googlesyndication.com partner.googleadservices.com tpc.googlesyndication.com www.googletagservices.com adservice.google.com adservice.google.fr;style-src https: 'self' 'unsafe-inline';font-src 'self' data:;img-src 'self' matchid.io a.basemaps.cartocdn.com b.basemaps.cartocdn.com c.basemaps.cartocdn.com upload.wikimedia.org pagead2.googlesyndication.com www.google-analytics.com stats.g.doubleclick.net www.google.fr;connect-src 'self' www.data.gouv.fr cloudflareinsights.com www.google-analytics.com analytics.google.com csi.gstatic.com region1.analytics.google.com stats.g.doubleclick.net pagead2.googlesyndication.com; frame-src 'self' matchid.io www.google.com google.com googleads.g.doubleclick.net tpc.googlesyndication.com

# Build files configuration variables
export DC_BUILD_FRONTEND = ${FRONTEND_PATH}/docker-compose-build.yml
export DC_RUN_NGINX_FRONTEND = ${FRONTEND_PATH}/docker-compose.yml
export BUILD_DIR=${APP_PATH}/${APP}-build
export FILE_FRONTEND_APP_VERSION = $(APP)-$(APP_VERSION)-frontend.tar.gz
export FILE_FRONTEND_DIST_APP_VERSION = $(APP)-$(APP_VERSION)-frontend-dist.tar.gz
export FILE_FRONTEND_DIST_LATEST_VERSION = $(APP)-latest-frontend-dist.tar.gz

# Test configuration variables
export TEST_HOST=nginx
export MITM_URL=/mitm/mitm.html
export THEME_DNUM=0

# API and rate limiting configuration variables
export API_SEARCH_LIMIT_RATE?=1r/s
export API_SEARCH_USER_BURST?=30 nodelay
export API_SEARCH_GLOBAL_LIMIT_RATE?=20r/s
export API_SEARCH_GLOBAL_BURST?=400 nodelay
export API_BULK_SUBMIT_LIMIT_RATE?=4r/m
export API_BULK_SUBMIT_BURST?=4 nodelay
export API_MISC_LIMIT_RATE?=2r/s
export API_MISC_USER_BURST?=7 nodelay
export API_MISC_GLOBAL_LIMIT_RATE?=5r/s
export API_MISC_GLOBAL_BURST?=40 nodelay
export API_AGG_LIMIT_RATE?=30r/m
export API_AGG_USER_BURST?=15 nodelay
export API_AGG_GLOBAL_LIMIT_RATE?=1r/s
export API_AGG_GLOBAL_BURST?=15 nodelay
export API_DOWNLOAD_LIMIT_RATE?=30r/m
export API_USER_SCOPE?=http_x_forwarded_for
export API_READ_TIMEOUT?=3600
export API_SEND_TIMEOUT?=1200
export API_MAX_BODY?=100m

# API test configuration variables
export API_TEST_PATH = ${API_PATH}/api/v1/search
export API_TEST_JSON_PATH=response
export API_TEST_REQUEST={"fuzzy":"false","sort":[{"score":"desc"}],"page":1,"size":20,"scroll":"1m","firstName":"jean"}

# Google Analytics configuration variables
export GOOGLE_ANALYTICS_ID=
export GOOGLE_ADSENSE_ID=

# A/B testing configuration variables
export AB_THRESHOLD=100

# Frontend targets
frontend-update:
	@cd ${FRONTEND_PATH}; git pull ${GIT_ORIGIN} ${GIT_BRANCH}

frontend-dev: clean-frontend
ifneq "$(commit)" "$(lastcommit)"
	@echo docker-compose up ${APP} frontend for dev after new commit ${APP_VERSION}
	${DC} -f ${FRONTEND_PATH}/docker-compose-dev.yml up -d
	@echo "${commit}" > ${FRONTEND_PATH}/.lastcommit
else
	@echo docker-compose up ${APP} frontend for dev
	${DC} -f  ${FRONTEND_PATH}/docker-compose-dev.yml up -d
endif

frontend-dev-stop:
	${DC} -f ${FRONTEND_PATH}/docker-compose-dev.yml down

frontend-check-build:
	${DC} -f $(DC_BUILD_FRONTEND) config -q

frontend-build-dist: ${FRONTEND_PATH}/$(FILE_FRONTEND_APP_VERSION) frontend-check-build
	@echo building ${APP} frontend in ${FRONTEND_PATH}
	${DC} -f $(DC_BUILD_FRONTEND) build $(DC_BUILD_ARGS)

frontend-build: network frontend-build-dist $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION)

frontend-clean-dist:
	@rm -rf ${FRONTEND_PATH}/$(FILE_FRONTEND_APP_VERSION) > /dev/null 2>&1 || true

frontend-clean-dist-archive:
	@rm -rf ${FRONTEND_PATH}/$(FILE_FRONTEND_DIST_APP_VERSION) > /dev/null 2>&1 || true
	@rm -rf ${NGINX_PATH}/$(FILE_FRONTEND_DIST_APP_VERSION) > /dev/null 2>&1 || true

frontend-stop:
	${DC} -f ${FRONTEND_PATH}/docker-compose.yml down

frontend:
	@echo docker-compose up ${APP_GROUP} ${APP}
	@echo DATAGOUV PROXY: ${DATAGOUV_RESOURCES_PROXY}, RW: ${DATAGOUV_RESOURCES_REWRITE_PATH}
	${DC} -f ${DC_RUN_NGINX_FRONTEND} up -d
	@timeout=${NGINX_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (curl -s --fail -XGET localhost:${PORT} > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo "waiting for nginx to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; exit $$ret

frontend-test: smtp

# Nginx targets
nginx-check-build:
	${DC} -f $(DC_RUN_NGINX_FRONTEND) config -q

nginx-build: $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION) nginx-check-build
	@echo building ${APP} nginx
	cp $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION) ${NGINX_PATH}/
	${DC} -f ${DC_RUN_NGINX_FRONTEND} build $(DC_BUILD_ARGS)

# Utility targets
rollup-clean:
	@rm -rf public/build public/sw.js* public/workbox*

build-dir:
	@if [ ! -d "$(BUILD_DIR)" ] ; then mkdir -p $(BUILD_DIR) ; fi

build-dir-clean:
	@if [ -d "$(BUILD_DIR)" ] ; then (rm -rf $(BUILD_DIR) > /dev/null 2>&1) ; fi

${FRONTEND_PATH}/$(FILE_FRONTEND_APP_VERSION):
	( cd ${FRONTEND_PATH} && tar -zcvf $(FILE_FRONTEND_APP_VERSION) --exclude ${APP}.tar.gz \
		.eslintrc.js \
		rollup.config.js \
        src \
        public )

$(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION): build-dir
	${DC} -f $(DC_BUILD_FRONTEND) run -T --rm frontend-build tar czf - $$(basename /$(APP)/public) -C $$(dirname /$(APP)/public) > $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION)
	cp $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION) $(BUILD_DIR)/$(FILE_FRONTEND_DIST_LATEST_VERSION)
	if [ -f $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION) ]; then ls -alsrt  $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION) && sha1sum $(BUILD_DIR)/$(FILE_FRONTEND_DIST_APP_VERSION) ; fi
	if [ -f $(BUILD_DIR)/$(FILE_FRONTEND_DIST_LATEST_VERSION) ]; then ls -alsrt  $(BUILD_DIR)/$(FILE_FRONTEND_DIST_LATEST_VERSION) && sha1sum $(BUILD_DIR)/$(FILE_FRONTEND_DIST_LATEST_VERSION) ; fi

