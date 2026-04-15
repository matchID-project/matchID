##############################################
# WARNING : THIS FILE SHOULDN'T BE TOUCHED   #
#    FOR ENVIRONNEMENT CONFIGURATION         #
# CONFIGURABLE VARIABLES SHOULD BE OVERRIDED #
# IN THE 'artifacts' FILE, AS NOT COMMITTED  #
##############################################

SHELL=/bin/bash

export USE_TTY := $(shell test -t 1 && USE_TTY="-t")

export OS_TYPE := $(shell cat /etc/os-release | grep -E '^NAME=' | sed 's/^.*debian.*$$/DEB/I;s/^.*ubuntu.*$$/DEB/I;s/^.*fedora.*$$/RPM/I;s/.*centos.*$$/RPM/I;')

#search-ui
export PORT=8083

#make binary and options
export MAKEBIN = $(shell which make || echo make)
export MAKE = ${MAKEBIN} --no-print-directory -s

#base paths
export APP = deces
export APP_FRONTEND = deces-ui
export APP_BACKEND = deces-backend
export APP_TOOLS = tools
export APP_DATAPREP = deces-dataprep
export DATASET=fichier-des-personnes-decedees
export APP_GROUP = matchID
export APP_PATH := $(shell pwd)
export APP_DNS?=deces.matchid.io
export API_EMAIL?=contact@matchid.io
export FRONTEND_PATH := ${APP_PATH}/packages/${APP_FRONTEND}
export BACKEND_PATH := ${APP_PATH}/packages/${APP_BACKEND}
export TOOLS_PATH := ${APP_PATH}/packages/${APP_TOOLS}
export DATAPREP_PATH := ${APP_PATH}/packages/${APP_DATAPREP}
export DATAPREP_PROJECT_NAME ?= deces-dataprep
export DATAPREP_PROJECT_SOURCE_PATH ?= ${DATAPREP_PATH}/projects/${DATAPREP_PROJECT_NAME}
export INFRA_PATH = ${APP_PATH}/packages/deces-infra
# export LOG_BUCKET = s3bucket/override/me
# export STATS_BUCKET = s3bucket/override/me
# export LOG_DB_BUCKET = s3bucket/override/me
# export PROOFS_BUCKET = s3bucket/override/me
# export MONITOR_BUCKET = s3bucket/override/me
export LOG_DIR = ${FRONTEND_PATH}/log/mirror
export LOG_DB_DIR = ${FRONTEND_PATH}/log/db
export STATS_SCRIPTS = ${FRONTEND_PATH}/stats/src
export STATS_UPDATE_DAYS = 35
export STATS = ${FRONTEND_PATH}/stats/public
# Backend configuration variables are now defined in packages/deces-backend/Makefile
# SMTP configuration variables are now defined in packages/deces-backend/Makefile
export API_TIMEOUT = 45
export MAILDEV_UI_PORT ?= 37343
export BACKEND_TIMEOUT ?= 180
export ES_MEM ?= 1024m
export ES_TIMEOUT ?= 120

export DC_NETWORK := $(shell echo ${APP_GROUP} | tr '[:upper:]' '[:lower:]')
export DC_BUILD_ARGS = --pull --no-cache
export DC := docker compose
export GIT_ORIGIN=origin
export GIT_BRANCH ?= $(or ${GITHUB_HEAD_REF},$(shell git rev-parse --abbrev-ref HEAD 2>/dev/null | sed 's/^HEAD$$/detached-head/'))
export GIT_BRANCH_MASTER = master
export GIT_ROOT = https://github.com/matchID-project
export APP_URL?=https://${APP_DNS}
export API_SSL?=1
export APP_NODES=1
export KUBE_NAMESPACE:=$(shell echo -n ${APP_GROUP}-${APP_FRONTEND}-${GIT_BRANCH} | tr '[:upper:]' '[:lower:]' | tr '_/' '-')
export KUBE_DIR=${FRONTEND_PATH}/k8s
export KUBECONFIG=${HOME}/.kube/config

export PROOFS=${DATA_DIR}/proofs
export MONITOR_DIR = ${APP_FRONTED}/log/instances/${APP_GROUP}-${APP_FRONTEND}-${GIT_BRANCH}

# backup dir
export BACKUP_DIR = ${APP_PATH}/backup

# datagouv paths for downloading files
export DATAGOUV_PROXY_PATH = /${API_PATH}/api/v0/getDataGouvFile
export DATAGOUV_CATALOG_URL = https://www.data.gouv.fr/api/1/datasets/${DATASET}/
export DATAGOUV_RESOURCES_HOST = https://static.data.gouv.fr
export DATAGOUV_RESOURCES_PATH = resources/${DATASET}
export DATAGOUV_RESOURCES_URL = ${DATAGOUV_RESOURCES_HOST}/${DATAGOUV_RESOURCES_PATH}
export DATAGOUV_RESOURCES_PROXY = $(shell echo ${http_proxy} | sed 's|^$$|${DATAGOUV_RESOURCES_HOST}|;')
export DATAGOUV_RESOURCES_REWRITE_PATH := $(shell echo ${DATAGOUV_RESOURCES_HOST}/${DATAGOUV_RESOURCES_PATH} | sed 's|^${DATAGOUV_RESOURCES_PROXY}||')

# data configuration
export DATA_DIR = ${APP_PATH}/data
export DATAPREP_VERSION_FILE = ${APP_PATH}/.dataprep.sha1
export DATA_VERSION_FILE = ${APP_PATH}/.data.sha1
export DATA_VERSION_SOURCE ?= storage
export DATA_VERSION_INPUT_DIR ?=
export FILES_TO_PROCESS?=deces-((19[7-9][0-9]|20(0[0-9]|1[0-9]|2[0-4]))|202[56]-m(0[1-9]|1[0-2]))\.txt\.gz
export FILES_TO_PROCESS_TEST=deces-2020-m01.txt.gz # reference for test env
export FILES_TO_PROCESS_DEV=deces-2020-m[0-1][0-9].txt.gz # reference for preprod env
export SMOKE_FILES_TO_PROCESS ?= deces-2020.txt.gz
export SMOKE_DATA_VERSION_INPUT_DIR ?= /tmp/matchid-smoke-upload
export SMOKE_RECIPE_RUN_MARKER ?= /tmp/matchid-smoke.recipe-run
export SMOKE_S3_PULL_MARKER ?= /tmp/matchid-smoke.s3-pull
export SMOKE_TOOLS_DATA_DIR ?= /tmp/matchid-tools-smoke
export SMOKE_BACKEND_DATA_DIR ?= /tmp/matchid-backend-smoke
export SMOKE_ES_MEM ?= 512m
export SMOKE_ES_MMAP_DISABLED ?= true
export PLAYWRIGHT_VERSION ?= 1.59.1
export REPOSITORY_BUCKET?=fichier-des-personnes-decedees-elasticsearch
export REPOSITORY_BUCKET_DEV=fichier-des-personnes-decedees-elasticsearch-dev # reference for non-prod env

export STORAGE_BUCKET=${DATASET}
export SCW_VOLUME_SIZE=20000000000
export SCW_VOLUME_TYPE=l_ssd

#prebuild image with docker and nginx-node-elasticsearch docker images
export SCW_IMAGE_ID=d48f33cd-127d-4315-be8e-083978c9be63

-include ${TOOLS_PATH}/artifacts.SCW
dummy		    := $(shell touch artifacts)
include ./artifacts

export STORAGE_ACCESS_KEY_B64:=$(shell echo -n ${STORAGE_ACCESS_KEY} | openssl base64)
export STORAGE_SECRET_KEY_B64:=$(shell echo -n ${STORAGE_SECRET_KEY} | openssl base64)

commit              := $(shell git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || cat VERSION 2>/dev/null)
tag                 := $(shell (git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null) | sed 's/-.*//')
lastcommit          := $(shell touch .lastcommit && cat .lastcommit)
date                := $(shell date -I)

export APP_VERSION := $(shell git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)


export DOCKER_USERNAME=matchid

include /etc/os-release

# Include deces-* Makefile
-include ${FRONTEND_PATH}/Makefile
-include ${INFRA_PATH}/Makefile
-include ${BACKEND_PATH}/Makefile

version:
	@echo ${APP_VERSION}

config-stats: geolite-city
	@if [ -z "$(wildcard /usr/lib/*/perl*/*/Date/Pcalc)" ] || \
		[ -z "$(wildcard /usr/lib/*/perl*/*/JSON/XS)" ] || \
		[ -z "$(wildcard /usr/lib/*/perl*/*/MaxMind/DB)" ]; then\
		if [ "${OS_TYPE}" = "DEB" ]; then\
			sudo apt-get install -yqq libdate-calc-perl libjson-xs-perl libmaxmind-db-reader-perl libmaxmind-db-reader-xs-perl libgeoip2-perl; true;\
		fi;\
		if [ "${OS_TYPE}" = "RPM" ]; then\
			sudo yum install -y perl-Date-Calc perl-Geo-IP perl-JSON-XS perl-Digest-SHA; true;\
		fi;\
	fi

config:
	# this proc relies on matchid/tools and works both local and remote
	@(which make > /dev/null 2>&1) || sudo apt-get install make
	@make -C ${TOOLS_PATH} config;
	@touch config && touch ${BACKEND_PATH}/config

clean-data: elasticsearch-clean backup-dir-clean
	@rm -rf ${DATA_VERSION_FILE} ${DATAPREP_VERSION_FILE}\
		${DATA_VERSION_FILE}.list > /dev/null 2>&1 || true

# clean-backend:
# 	@${MAKE} -C ${BACKEND_PATH} clean-backend

clean-remote:
	@${MAKE} -C ${TOOLS_PATH} remote-clean ${MAKEOVERRIDES} > /dev/null 2>&1 || true

clean-config-elasticsearch:
	@rm -rf elasticsearch-repository-* > /dev/null 2>&1 || true

clean-config: clean-config-elasticsearch
	@rm -rf config > /dev/null 2>&1 || true

clean-local: clean-data clean-frontend clean-config

clean: clean-remote clean-local

network-stop:
	docker network rm ${DC_NETWORK}

network: config
	@docker network create ${DC_NETWORK_OPT} ${DC_NETWORK} 2> /dev/null; true

# backend-dev:
# 	@echo docker-compose up backend dev
# 	@${MAKE} -C ${BACKEND_PATH} backend-dev TOOLS_PATH=${TOOLS_PATH} DATA_DIR=${DATA_DIR} DC_NETWORK=${DC_NETWORK} GIT_BRANCH=${GIT_BRANCH}\
# 		APP_URL=http://localhost:${PORT} API_EMAIL=${API_EMAIL} API_SSL=${API_SSL}

# backend-dev-stop:
# 	@${MAKE} -C ${BACKEND_PATH} dev-stop TOOLS_PATH=${TOOLS_PATH} DC_NETWORK=${DC_NETWORK} GIT_BRANCH=${GIT_BRANCH}


# backend-docker-check:
# 	@BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
# 	${MAKE} docker-check DC_IMAGE_NAME=deces-backend APP_VERSION=$$BACKEND_APP_VERSION GIT_BRANCH=${GIT_BRANCH}

# backend: backend-docker-check proofs-mount elasticsearch-index-readiness
# 	@BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
# 	${MAKE} -C ${BACKEND_PATH} backend-start APP=deces-backend DC_NETWORK=${DC_NETWORK} APP_VERSION=$$BACKEND_APP_VERSION GIT_BRANCH=${GIT_BRANCH}\
# 		APP_URL=${APP_URL} API_EMAIL=${API_EMAIL} API_SSL=${API_SSL}

# backend-stop:
# 	@BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
# 	${MAKE} -C ${BACKEND_PATH} backend-stop DC_NETWORK=${DC_NETWORK} APP_VERSION=$$BACKEND_APP_VERSION GIT_BRANCH=${GIT_BRANCH}
# 	@make proofs-umount

# Frontend targets are now defined in packages/deces-ui/Makefile

dev: network frontend-stop elasticsearch-local backend-dev frontend-dev

dev-stop: frontend-dev-stop backend-dev-stop smtp-stop redis-stop elasticsearch-stop

dataprep-dev:
	@${MAKE} -C ${DATAPREP_PATH} dev ${MAKEOVERRIDES}

dataprep-dev-stop:
	@${MAKE} -C ${DATAPREP_PATH} dev-stop ${MAKEOVERRIDES}

dataprep-run:
	@${MAKE} -C ${DATAPREP_PATH} backend-clean-logs ${MAKEOVERRIDES}
	@${MAKE} -C ${DATAPREP_PATH} recipe-run ${MAKEOVERRIDES}
	@${MAKE} -C ${DATAPREP_PATH} watch-run ${MAKEOVERRIDES}

dataprep-data-tag:
	@${MAKE} -C ${DATAPREP_PATH} data-tag ${MAKEOVERRIDES}

build: clean-frontend frontend-build nginx-build

# Frontend and nginx targets are now defined in packages/deces-ui/Makefile

stop: frontend-stop backend-stop smtp-stop redis-stop elasticsearch-stop
	@echo all components stopped

start: elasticsearch backend frontend
	@sleep 2 && docker-compose logs

log:
	@${MAKE} -C ${TOOLS_PATH} docker-logs-to-API ${MAKEOVERRIDES} &

backup-dir:
	@if [ ! -d "$(BACKUP_DIR)" ] ; then mkdir -p $(BACKUP_DIR) ; fi

backup-dir-clean:
	@if [ -d "$(BACKUP_DIR)" ] ; then (rm -rf $(BACKUP_DIR) > /dev/null 2>&1 || true) ; fi

# Elasticsearch targets are now defined in packages/deces-infra/Makefile

up: start

down: stop

restart: down up


FORCE:

${DATAPREP_VERSION_FILE}: ${DATAPREP_PATH}/Makefile ${DATAPREP_PATH}/projects/deces-dataprep/recipes/deces_dataprep.yml ${DATAPREP_PATH}/projects/deces-dataprep/datasets/deces_index.yml
	@cat ${DATAPREP_PATH}/Makefile\
		${DATAPREP_PATH}/projects/deces-dataprep/recipes/deces_dataprep.yml\
		${DATAPREP_PATH}/projects/deces-dataprep/datasets/deces_index.yml\
	| sha1sum | awk '{print $1}' | cut -c-8 > ${DATAPREP_VERSION_FILE}

dataprep-version: ${DATAPREP_VERSION_FILE}
	@cat ${DATAPREP_VERSION_FILE}

ifeq (${DATA_VERSION_SOURCE},local)
${DATA_VERSION_FILE}: FORCE
	@if [ -z "${DATA_VERSION_INPUT_DIR}" ]; then\
		echo "DATA_VERSION_INPUT_DIR is required when DATA_VERSION_SOURCE=local";\
		exit 1;\
	fi
	@MATCHED_FILES=$$(mktemp /tmp/matchid-data-version.XXXXXX); \
	find "${DATA_VERSION_INPUT_DIR}" -maxdepth 1 -type f 2> /dev/null | sed 's|^.*/||' | egrep '^${FILES_TO_PROCESS}$$' | sort > $$MATCHED_FILES; \
	if [ ! -s "$$MATCHED_FILES" ]; then\
		rm -f "$$MATCHED_FILES";\
		echo "no local data files matched ${FILES_TO_PROCESS} in ${DATA_VERSION_INPUT_DIR}";\
		exit 1;\
	fi; \
	cat "$$MATCHED_FILES" | sha1sum | awk '{print $$1}' | cut -c-8 > ${DATA_VERSION_FILE}; \
	rm -f "$$MATCHED_FILES"
else
${DATA_VERSION_FILE}: FORCE
	@${MAKE} -C ${TOOLS_PATH} catalog-tag CATALOG_TAG=${DATA_VERSION_FILE}\
		DATAGOUV_DATASET=${DATASET} STORAGE_BUCKET=${STORAGE_BUCKET}\
		STORAGE_ACCESS_KEY=${STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${STORAGE_SECRET_KEY}\
		FILES_PATTERN='${FILES_TO_PROCESS}'
endif

data-version: ${DATA_VERSION_FILE}
	@cat ${DATA_VERSION_FILE}

artifact-version-dataprep-backend:
	@${MAKE} -C ${APP_PATH}/packages/dataprep-backend version | awk '{print $$NF}'

artifact-version-dataprep-frontend:
	@${MAKE} -C ${APP_PATH}/packages/dataprep-frontend version | awk '{print $$NF}'

artifact-version-deces-backend:
	@echo ${APP_VERSION}

artifact-version-deces-ui:
	@echo ${APP_VERSION}

artifact-version-dataprep-snapshot: ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@echo esdata_$$(cat ${DATAPREP_VERSION_FILE})_$$(cat ${DATA_VERSION_FILE})

artifact-versions:
	@echo "matchid-backend: $$(${MAKE} artifact-version-dataprep-backend)"
	@echo "matchid-frontend: $$(${MAKE} artifact-version-dataprep-frontend)"
	@echo "deces-backend: $$(${MAKE} artifact-version-deces-backend)"
	@echo "deces-ui: $$(${MAKE} artifact-version-deces-ui)"
	@echo "snapshot: $$(${MAKE} artifact-version-dataprep-snapshot)"

artifact-build-dataprep-backend:
	@${MAKE} -C ${DATAPREP_PATH} config ${MAKEOVERRIDES}
	@${MAKE} -C ${APP_PATH}/packages/dataprep-backend backend-build ${MAKEOVERRIDES}

artifact-publish-dataprep-backend:
	@${MAKE} -C ${APP_PATH}/packages/dataprep-backend backend-docker-push ${MAKEOVERRIDES}

artifact-build-dataprep-frontend:
	@${MAKE} -C ${DATAPREP_PATH} config frontend-config ${MAKEOVERRIDES}
	@${MAKE} -C ${APP_PATH}/packages/dataprep-frontend build ${MAKEOVERRIDES}

artifact-publish-dataprep-frontend:
	@${MAKE} -C ${APP_PATH}/packages/dataprep-frontend frontend-docker-push ${MAKEOVERRIDES}

artifact-build-legacy-package:
	@${MAKE} -C ${DATAPREP_PATH} config frontend-config ${MAKEOVERRIDES}
	@${MAKE} -C ${APP_PATH}/packages/dataprep-backend package ${MAKEOVERRIDES}

artifact-publish-legacy-package:
	@${MAKE} -C ${APP_PATH}/packages/dataprep-backend package-publish ${MAKEOVERRIDES}

artifact-build-deces-backend:
	@set -e; \
	TMP_DATA_DIR='${BACKEND_PATH}/.artifact-build-context/data'; \
	rm -rf '${BACKEND_PATH}/.artifact-build-context'; \
	mkdir -p "$$TMP_DATA_DIR"; \
	cp '${COMMUNES_JSON}' "$$TMP_DATA_DIR/communes.json"; \
	cp '${DISPOSABLE_MAIL}' "$$TMP_DATA_DIR/disposable-mail.txt"; \
	cp '${WIKIDATA_LINKS}' "$$TMP_DATA_DIR/wikidata.json"; \
	DATA_DIR=.artifact-build-context/data \
	NPM_AUDIT_DRY_RUN=true \
	${MAKE} -C ${BACKEND_PATH} backend-build-image ${MAKEOVERRIDES}; \
	rm -rf '${BACKEND_PATH}/.artifact-build-context'

artifact-publish-deces-backend:
	@${MAKE} -C ${BACKEND_PATH} docker-push-backend ${MAKEOVERRIDES}

artifact-build-deces-ui:
	@${MAKE} network ${MAKEOVERRIDES}
	@APP=${APP_FRONTEND} ${MAKE} -C ${FRONTEND_PATH} frontend-build-dist ${MAKEOVERRIDES}
	@APP=${APP_FRONTEND} ${MAKE} -C ${FRONTEND_PATH} nginx-build ${MAKEOVERRIDES}

artifact-publish-deces-ui:
	@${MAKE} -C ${FRONTEND_PATH} frontend-docker-push ${MAKEOVERRIDES}

artifact-produce-dataprep-snapshot:
	@${MAKE} dataprep-run ${MAKEOVERRIDES}

artifact-publish-dataprep-snapshot:
	@DATAPREP_VERSION=$$(${MAKE} artifact-version-dataprep-snapshot | sed 's/^esdata_//;s/_.*$$//'); \
	DATA_VERSION=$$(${MAKE} data-version ${MAKEOVERRIDES}); \
	ES_BACKUP_NAME=esdata_$${DATAPREP_VERSION}_$${DATA_VERSION}; \
	${MAKE} -C ${INFRA_PATH} elasticsearch-repository-backup \
		ES_INDEX=deces ES_BACKUP_NAME=$${ES_BACKUP_NAME} ${MAKEOVERRIDES}

artifact-restore-dataprep-snapshot:
	@${MAKE} elasticsearch-restore ${MAKEOVERRIDES}

smoke-tools:
	@${MAKE} -C ${TOOLS_PATH} tools-smoke \
		DATAGOUV_DATASET=${DATASET} \
		DATA_DIR=${SMOKE_TOOLS_DATA_DIR} \
		CATALOG_TAG=${SMOKE_TOOLS_DATA_DIR}/${DATASET}.tag \
		${MAKEOVERRIDES}

smoke-dataprep-run:
	${MAKE} -C ${DATAPREP_PATH} datagouv-to-upload \
		DATAGOUV_UPLOAD_DIR=${SMOKE_DATA_VERSION_INPUT_DIR} \
		FILES_TO_SYNC='fichier-opposition-deces-.*.csv(.gz)?|${SMOKE_FILES_TO_PROCESS:.gz=}' \
		FILES_TO_PROCESS='${SMOKE_FILES_TO_PROCESS}' \
		${MAKEOVERRIDES}; \
	${MAKE} dataprep-run \
		FILES_TO_PROCESS='${SMOKE_FILES_TO_PROCESS}' \
		DATAGOUV_CONNECTOR=upload \
		UPLOAD=${SMOKE_DATA_VERSION_INPUT_DIR} \
		DATA_VERSION_SOURCE=local \
		DATA_VERSION_INPUT_DIR=${SMOKE_DATA_VERSION_INPUT_DIR} \
		ES_MEM=${SMOKE_ES_MEM} \
		ES_MMAP_DISABLED=${SMOKE_ES_MMAP_DISABLED} \
		RECIPE_RUN_MARKER=${SMOKE_RECIPE_RUN_MARKER} \
		S3_PULL_MARKER=${SMOKE_S3_PULL_MARKER} \
		${MAKEOVERRIDES}

smoke-dataprep-clean:
	@${MAKE} dataprep-dev-stop RECIPE_RUN_MARKER=${SMOKE_RECIPE_RUN_MARKER} S3_PULL_MARKER=${SMOKE_S3_PULL_MARKER} ${MAKEOVERRIDES} >/dev/null 2>&1 || true
	@rm -f ${SMOKE_RECIPE_RUN_MARKER} ${SMOKE_S3_PULL_MARKER}
	@rm -rf ${SMOKE_DATA_VERSION_INPUT_DIR}

smoke-dataprep:
	@set -e; \
	trap '${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES} >/dev/null 2>&1 || true' EXIT; \
	${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES}; \
	${MAKE} smoke-dataprep-run ${MAKEOVERRIDES}

smoke-backend:
	@set -e; \
	cleanup() { \
		${MAKE} backend-dev-stop >/dev/null 2>&1 || true; \
		${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES} >/dev/null 2>&1 || true; \
	}; \
	trap cleanup EXIT; \
	rm -rf ${SMOKE_BACKEND_DATA_DIR}; \
	${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES}; \
	${MAKE} smoke-dataprep-run ${MAKEOVERRIDES}; \
	DATA_DIR=${SMOKE_BACKEND_DATA_DIR} MAILDEV_UI_PORT=${MAILDEV_UI_PORT} ${MAKE} config communes wikidata-links disposable-mail backend-dev ${MAKEOVERRIDES}; \
	${MAKE} smoke-backend-api ${MAKEOVERRIDES}

smoke-backend-api:
	@${MAKE} -C ${TOOLS_PATH} local-test-api \
		PORT=${BACKEND_PORT} \
		API_TEST_PATH='deces/api/v1/search?deathDate=2020&firstName=Ana&fuzzy=false' \
		API_TEST_JSON_PATH='response.total > 0 and ([.response.persons[].name.first[0] | contains("Ana")] | all)' \
		${MAKEOVERRIDES}
	@${MAKE} -C ${TOOLS_PATH} local-test-api \
		PORT=${BACKEND_PORT} \
		API_TEST_PATH='deces/api/v1/search' \
		API_TEST_DATA='{"deathDate":"2020","firstName":"Ana","fuzzy":"false"}' \
		API_TEST_JSON_PATH='response.total > 0 and ([.response.persons[].name.first[0] | contains("Ana")] | all)' \
		${MAKEOVERRIDES}

smoke-ui:
	@set -e; \
	cleanup() { \
		${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES} >/dev/null 2>&1 || true; \
		${MAKE} dev-stop >/dev/null 2>&1 || true; \
	}; \
	trap cleanup EXIT; \
	cleanup; \
	${MAKE} smoke-dataprep-run ${MAKEOVERRIDES}; \
	${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES}; \
	${MAKE} dev ES_MEM=${SMOKE_ES_MEM} ES_MMAP_DISABLED=${SMOKE_ES_MMAP_DISABLED} ${MAKEOVERRIDES}; \
	PLAYWRIGHT_VERSION=${PLAYWRIGHT_VERSION} MAILDEV_UI_PORT=${MAILDEV_UI_PORT} ${MAKE} frontend-test ${MAKEOVERRIDES}

smoke-e2e:
	@set -e; \
	cleanup() { \
		${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES} >/dev/null 2>&1 || true; \
		${MAKE} dev-stop >/dev/null 2>&1 || true; \
	}; \
	trap cleanup EXIT; \
	cleanup; \
	${MAKE} smoke-dataprep-run ${MAKEOVERRIDES}; \
	${MAKE} smoke-dataprep-clean ${MAKEOVERRIDES}; \
	${MAKE} dev ES_MEM=${SMOKE_ES_MEM} ES_MMAP_DISABLED=${SMOKE_ES_MMAP_DISABLED} ${MAKEOVERRIDES}; \
	${MAKE} smoke-backend-api ${MAKEOVERRIDES}; \
	PLAYWRIGHT_VERSION=${PLAYWRIGHT_VERSION} MAILDEV_UI_PORT=${MAILDEV_UI_PORT} ${MAKE} frontend-test ${MAKEOVERRIDES}

show-env:
	env | egrep 'STORAGE|BUCKET'

deploy-local: config show-env stats-background elasticsearch-restore-async docker-check up local-test-api

# smtp:
# 	@${MAKE} -C ${BACKEND_PATH} smtp DC_NETWORK=${DC_NETWORK}

# smtp-stop:
# 	@${MAKE} -C ${BACKEND_PATH} smtp-stop

# backend-test:
# 	@${MAKE} -C ${BACKEND_PATH} backend-test

local-test-api:
	@timeout=${API_TIMEOUT} ;\
	ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do \
		(${MAKE} -C ${TOOLS_PATH} local-test-api \
			PORT=${PORT} \
			API_TEST_PATH=${API_TEST_PATH} API_TEST_JSON_PATH=${API_TEST_JSON_PATH} API_TEST_DATA='${API_TEST_REQUEST}'\
			${MAKEOVERRIDES} 2>&1 | grep ': ok' ); \
		ret=$$? ;\
		if [ "$$ret" -ne "0" ] ; then echo "waiting for API to start $$timeout" ; fi ;\
		((timeout--)); sleep 1 ; \
	done ; \
	exit $$ret

deploy-k8s-cluster-local:
	@if ! (which k3s > /dev/null 2>&1); then\
		(curl -sfL https://get.k3s.io | sh - 2>&1 |\
			awk 'BEGIN{s=0}{printf "\r☸️  Installing k3s (" s++ "/16)"}') && echo -e "\r\033[2K☸️   Installed k3s";\
	fi;\
	mkdir -p ~/.kube;\
	KUBECONFIG=${HOME}/.kube/config-local-k3s.yaml;\
	sudo cp /etc/rancher/k3s/k3s.yaml $${KUBECONFIG};\
	sudo chown ${USER} $${KUBECONFIG};\
	cp $${KUBECONFIG} ${KUBECONFIG}

deploy-k8s: deploy-k8s-elasticsearch deploy-k8s-redis deploy-k8s-backend deploy-k8s-frontend

deploy-k8s-namespace:
	@echo $@;\
	cat ${KUBE_DIR}/namespace.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","`;\
	(cat ${KUBE_DIR}/namespace.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","` | kubectl apply -f -) && touch $@

deploy-k8s-elasticsearch: deploy-k8s-namespace ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@echo $@
	@DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	export ES_BACKUP_NAME=${ES_BACKUP_BASENAME}_$${DATAPREP_VERSION}_$${DATA_VERSION};\
	echo SCW_REGION=${SCW_REGION} SCW_ENDPOINT=${SCW_ENDPOINT} SCW_BUCKET=${REPOSITORY_BUCKET};\
	cat ${KUBE_DIR}/elasticsearch.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","` | kubectl apply -f -

deploy-k8s-redis: deploy-k8s-namespace
	@echo $@
	@cat ${KUBE_DIR}/redis.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","` | kubectl apply -f -

deploy-k8s-backend: deploy-k8s-namespace
	@echo $@
	@export BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	cat ${KUBE_DIR}/backend.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","` | kubectl apply -f -

deploy-k8s-frontend: deploy-k8s-namespace
	@echo $@
	@cat ${KUBE_DIR}/frontend.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","` | kubectl apply -f -

deploy-remote-instance: config-minimal ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@\
	BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-config\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$${BACKEND_APP_VERSION}-data:$${DATAPREP_VERSION}-$${DATA_VERSION}\
		APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=deces-ui\
		SCW_IMAGE_ID=${SCW_IMAGE_ID} SCW_VOLUME_SIZE=${SCW_VOLUME_SIZE} SCW_VOLUME_TYPE=${SCW_VOLUME_TYPE} \
		GIT_BRANCH=${GIT_BRANCH} ${MAKEOVERRIDES}

deploy-remote-services:
	@\
	BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-deploy remote-actions\
		APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=deces-ui\
		BACKEND_APP_VERSION=$${BACKEND_APP_VERSION} DATAPREP_VERSION=$${DATAPREP_VERSION} DATA_VERSION=$${DATA_VERSION}\
		ACTIONS=deploy-local GIT_BRANCH=${GIT_BRANCH}\
		TOOLS_STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY}\
		TOOLS_STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY}\
		LOG_BUCKET=${LOG_BUCKET} LOG_DB_BUCKET=${LOG_DB_BUCKET} STATS_BUCKET=${STATS_BUCKET} PROOFS_BUCKET=${PROOFS_BUCKET}\
		BACKEND_TOKEN_KEY=${BACKEND_TOKEN_KEY} BACKEND_TOKEN_PASSWORD=${BACKEND_TOKEN_PASSWORD}\
		${MAKEOVERRIDES}

deploy-remote-publish:
	@if [ -z "${NGINX_HOST}" -o -z "${NGINX_USER}" ];then\
		(echo "can't deploy without NGINX_HOST and NGINX_USER" && exit 1);\
	fi;
	@if [ "${GIT_BRANCH}" == "${GIT_BRANCH_MASTER}" ];then\
		APP_DNS=${APP_DNS};\
	else\
		APP_DNS="${GIT_BRANCH}-${APP_DNS}";\
	fi;\
	BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-test-api-in-vpc nginx-conf-apply remote-test-api\
		APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION} GIT_BRANCH=${GIT_BRANCH} PORT=${PORT}\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$${BACKEND_APP_VERSION}-data:$${DATAPREP_VERSION}-$${DATA_VERSION}\
		APP_DNS=$$APP_DNS API_TEST_PATH=${API_TEST_PATH} API_TEST_JSON_PATH=${API_TEST_JSON_PATH} API_TEST_DATA='${API_TEST_REQUEST}'\
		${MAKEOVERRIDES}

deploy-delete-old: ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@\
	BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} cloud-instance-down-invalid\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$${BACKEND_APP_VERSION}-data:$${DATAPREP_VERSION}-$${DATA_VERSION}\
		APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=deces-ui\
		GIT_BRANCH=${GIT_BRANCH} ${MAKEOVERRIDES}

deploy-monitor:
	@${MAKE} -C ${TOOLS_PATH} remote-install-monitor\
		MONITOR_BUCKET=${MONITOR_BUCKET} MONITOR_DIR=${MONITOR_DIR}\
		STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY}\
		NEW_RELIC_INGEST_KEY=${NEW_RELIC_INGEST_KEY} NEW_RELIC_API_KEY=${NEW_RELIC_API_KEY} NEW_RELIC_ACCOUNT_ID=${NEW_RELIC_ACCOUNT_ID}\
		${MAKEOVERRIDES}

deploy-cdn-purge-cache:
	@${MAKE} -C ${TOOLS_PATH} cdn-cache-purge

deploy-remote: config-minimal deploy-remote-instance deploy-remote-services deploy-remote-publish deploy-cdn-purge-cache deploy-delete-old deploy-monitor

deploy-docker-pull-base: deploy-remote-instance
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=node:12.14.0-slim
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=nginx:alpine
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=docker.elastic.co/elasticsearch/elasticsearch:${ES_VERSION}
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=redis:alpine


update-base-image: deploy-remote-instance deploy-docker-pull-base
	@BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags); \
	${MAKE} -C ${TOOLS_PATH} remote-cmd REMOTE_CMD="sync"; \
	${MAKE} -C ${TOOLS_PATH} remote-cmd REMOTE_CMD="rm -rf ${APP_GROUP}"; \
	sleep 5;\
	${MAKE} -C ${TOOLS_PATH} SCW-instance-snapshot \
		GIT_BRANCH=${GIT_BRANCH} APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION}\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$$BACKEND_APP_VERSION\
		DC_IMAGE_NAME=deces-ui;
	${MAKE} -C ${TOOLS_PATH} SCW-instance-image \
		CLOUD_APP=nner;\
	SCW_IMAGE_ID=$$(cat ${TOOLS_PATH}/cloud/SCW.image.id)/;\
	cat ${APP_PATH}/Makefile | sed "s/^export SCW_IMAGE_ID=.*/export SCW_IMAGE_ID=$${SCW_IMAGE_ID}" \
		> ${APP_PATH}/Makefile.tmp && mv ${APP_PATH}/Makefile.tmp ${APP_PATH}/Makefile;\
	${MAKE} -C ${TOOLS_PATH} remote-clean;\
	git add Makefile && git commit -m '⬆️  update SCW_IMAGE_ID'

${LOG_DIR}:
	@mkdir -p ${LOG_DIR};

logs-restore: ${LOG_DIR}
	@echo sync ${LOG_BUCKET} to ${LOG_DIR};\
	${MAKE} -C ${TOOLS_PATH} storage-sync-pull\
		RCLONE_OPTS="--checksum" RCLONE_SYNC="copy"\
		STORAGE_BUCKET=${LOG_BUCKET} DATA_DIR=${LOG_DIR}\
		STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY};

${LOG_DB_DIR}:
	@mkdir -p ${LOG_DB_DIR};

/usr/local/share/GeoLite2/GeoLite2-City.mmdb:
	@echo downloading and installing GeoLite2-City.mmdb
	@mkdir -p ${APP_PATH}/data
	@sudo mkdir -p /usr/local/share/GeoLite2/
	@curl -s "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MMDB_TOKEN}&suffix=tar.gz" > ${APP_PATH}/data/geolite.tar.gz
	@sudo tar xzf ${APP_PATH}/data/geolite.tar.gz -C /usr/local/share/GeoLite2/ --strip-components=1

geolite-city: /usr/local/share/GeoLite2/GeoLite2-City.mmdb

stats-db-restore: ${LOG_DB_DIR}
	@mkdir -p ${LOG_DB_DIR};\
	echo sync ${LOG_DB_BUCKET} to ${LOG_DB_DIR};\
	${MAKE} -C ${TOOLS_PATH} storage-sync-pull\
		RCLONE_OPTS="--checksum" RCLONE_SYNC="copy"\
		STORAGE_BUCKET=${LOG_DB_BUCKET} DATA_DIR=${LOG_DB_DIR}\
		STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY};
	touch log-db

stats-db-backup: ${LOG_DB_DIR}
	@echo sync ${LOG_DB_DIR} to ${LOG_DB_BUCKET};\
	${MAKE} -C ${TOOLS_PATH} storage-sync-push\
		RCLONE_OPTS="--checksum" RCLONE_SYNC="copy"\
		STORAGE_BUCKET=${LOG_DB_BUCKET} DATA_DIR=${LOG_DB_DIR}\
		STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY};

${STATS}:
	@mkdir -p ${STATS};

stats-backup: ${STATS}
	@echo sync ${STATS} to ${STATS_BUCKET};\
	${MAKE} -C ${TOOLS_PATH} storage-sync-push\
		RCLONE_OPTS="--checksum" RCLONE_SYNC="copy"\
		STORAGE_BUCKET=${STATS_BUCKET} DATA_DIR=${STATS}\
		STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY};

stats-restore: ${STATS}
	@echo sync ${STATS_BUCKET} to ${STATS};\
	${MAKE} -C ${TOOLS_PATH} storage-sync-pull\
		RCLONE_OPTS="--checksum" RCLONE_SYNC="copy"\
		STORAGE_BUCKET=${STATS_BUCKET} DATA_DIR=${STATS}\
		STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY};

stats-full: config-stats ${STATS} logs-restore
	@\
		rm -rf ${LOG_DB_DIR} && mkdir -p ${LOG_DB_DIR};\
		(zcat -f `ls -tr ${LOG_DIR}/access*gz` ${LOG_DIR}/access.log | ${STATS_SCRIPTS}/parseLogs.pl);\
		make stats-catalog stats-db-backup stats-backup;

stats-update: config-stats ${STATS} stats-restore stats-db-restore logs-restore
	@\
		zcat -f `ls -tr ${LOG_DIR}/access.log.*gz | tail -${STATS_UPDATE_DAYS}` ${LOG_DIR}/access.log | ${STATS_SCRIPTS}/parseLogs.pl;

stats-live: config-stats ${STATS} stats-restore logs-restore
	@cat ${LOG_DIR}/access.log | ${STATS_SCRIPTS}/parseLogs.pl day

stats-catalog: ${STATS}
	@ls ${STATS} | grep -v catalog | perl -e '@list=<>;print "[\n".join(",\n",map{chomp;s/.json//;"  \"$$_\""} (grep {/.json/} @list))."\n]\n"' >  ${STATS}/catalog.json

stats-background:
	@((sleep 180;while (true); do make stats-live;sleep 300;done) > .stats-live 2>&1 &)

# ${PROOFS}:
# 	@mkdir -p ${PROOFS}
