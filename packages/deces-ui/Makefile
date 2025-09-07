# Makefile for deces-ui
# Frontend and nginx services management

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

