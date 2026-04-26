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
export APP_MONOREPO = matchID
export DATASET=fichier-des-personnes-decedees
export APP_GROUP = matchID
export APP_PATH := $(shell pwd)
export APP_DNS?=deces.matchid.io
export PREPROD_APP_DNS ?= dev-${APP_DNS}
export API_EMAIL?=contact@matchid.io
export FRONTEND_PATH := ${APP_PATH}/packages/${APP_FRONTEND}
export BACKEND_PATH := ${APP_PATH}/packages/${APP_BACKEND}
export TOOLS_PATH := ${APP_PATH}/packages/${APP_TOOLS}
export DATAPREP_PATH := ${APP_PATH}/packages/${APP_DATAPREP}
export REMOTE_MONOREPO_PATH = ${APP_GROUP}/${APP_MONOREPO}
export REMOTE_MONOREPO_TOOLS_PATH = ${REMOTE_MONOREPO_PATH}/packages/${APP_TOOLS}
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
export ES_MEM ?= 512m
export ES_TIMEOUT ?= 120

export DC_NETWORK := $(shell echo ${APP_GROUP} | tr '[:upper:]' '[:lower:]')
export DC_BUILD_ARGS = --pull --no-cache
export DC := docker compose
export GIT ?= $(shell which git || echo git)
export ALLOW_MAKE_GIT_COMMIT ?= false
export GIT_ORIGIN=origin
export GIT_BRANCH ?= $(or ${GITHUB_HEAD_REF},$(shell git rev-parse --abbrev-ref HEAD 2>/dev/null | sed 's/^HEAD$$/detached-head/'))
export GIT_BRANCH_MAIN ?= main
export RELEASE_TAG_PREFIX ?= v
export DEPLOY_TARGET ?=
export GIT_ROOT = https://github.com/matchID-project
export REMOTE_DEPLOY_BRANCH ?= ${GIT_BRANCH}
export PACKAGE_VERSIONS_SCRIPT = ${APP_PATH}/scripts/package_versions.py
export APP_URL?=https://${APP_DNS}
export API_SSL?=1
export APP_NODES=1
export KUBE_NAMESPACE:=$(shell echo -n ${APP_GROUP}-${APP_FRONTEND}-${GIT_BRANCH} | tr '[:upper:]' '[:lower:]' | tr '_/' '-')
export KUBE_DIR=${FRONTEND_PATH}/k8s
export KUBECONFIG=${HOME}/.kube/config

export PROOFS=${DATA_DIR}/proofs
export MONITOR_DIR = ${APP_FRONTEND}/log/instances/${APP_GROUP}-${APP_FRONTEND}-${GIT_BRANCH}

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
export DATAPREP_VERSION_OVERRIDE ?=
export DATA_VERSION_OVERRIDE ?=
export DATA_VERSION_SOURCE ?= storage
export DATA_VERSION_INPUT_DIR ?=
export FILES_TO_PROCESS?=deces-((19[7-9][0-9]|20(0[0-9]|1[0-9]|2[0-4]))|202[56]-m(0[1-9]|1[0-2]))\.txt\.gz
export FILES_TO_PROCESS_TEST=deces-2020-m01.txt.gz
export FILES_TO_PROCESS_DEV=deces-2020-m[0-1][0-9].txt.gz
export ARTIFACT_RECIPE_RUN_MARKER ?= /tmp/matchid-artifact.recipe-run
export ARTIFACT_S3_PULL_MARKER ?= /tmp/matchid-artifact.s3-pull
export PLAYWRIGHT_VERSION ?= 1.59.1
export REPOSITORY_BUCKET?=fichier-des-personnes-decedees-elasticsearch
export REPOSITORY_BUCKET_DEV=fichier-des-personnes-decedees-elasticsearch-dev

export STORAGE_BUCKET=${DATASET}
export SCW_VOLUME_SIZE=20000000000
export SCW_VOLUME_TYPE=l_ssd
export SSHKEY_PRIVATE ?= ${HOME}/.ssh/id_rsa_${APP_GROUP}

#prebuild image with docker and nginx-node-elasticsearch docker images
export SCW_IMAGE_ID=d48f33cd-127d-4315-be8e-083978c9be63

-include ${TOOLS_PATH}/artifacts.SCW
dummy		    := $(shell touch artifacts)
include ./artifacts

export STORAGE_ACCESS_KEY_B64:=$(shell echo -n ${STORAGE_ACCESS_KEY} | openssl base64)
export STORAGE_SECRET_KEY_B64:=$(shell echo -n ${STORAGE_SECRET_KEY} | openssl base64)

git_ref_raw         := $(shell git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || cat VERSION 2>/dev/null)
git_ref_safe        := $(shell printf '%s' "$(git_ref_raw)" | sed 's#[^A-Za-z0-9_.-]#-#g')
commit              := $(git_ref_safe)
tag                 := $(shell printf '%s' "$(git_ref_raw)" | sed 's/-.*//' | sed 's#[^A-Za-z0-9_.-]#-#g')
lastcommit          := $(shell touch .lastcommit && cat .lastcommit)
date                := $(shell date -I)

export APP_VERSION ?= $(shell env -u APP_VERSION -u MAKEFLAGS -u MFLAGS ${MAKEBIN} --no-print-directory -s -C ${FRONTEND_PATH} version 2>/dev/null | awk '{print $$NF}')
export DECES_BACKEND_APP_VERSION ?= $(shell env -u APP_VERSION -u DECES_BACKEND_APP_VERSION -u MAKEFLAGS -u MFLAGS ${MAKEBIN} --no-print-directory -s -C ${BACKEND_PATH} version 2>/dev/null | awk '{print $$NF}')

ifeq (${DEPLOY_TARGET},prod)
export APP_DNS_TARGET ?= ${APP_DNS}
else
export APP_DNS_TARGET ?= ${PREPROD_APP_DNS}
endif


export DOCKER_USERNAME=matchid

include /etc/os-release

# Include deces-* Makefile
-include ${FRONTEND_PATH}/Makefile
-include ${INFRA_PATH}/Makefile
-include ${BACKEND_PATH}/Makefile

version:
	@echo ${APP_VERSION}

release-context:
	@echo GIT_BRANCH=${GIT_BRANCH}
	@echo REMOTE_DEPLOY_BRANCH=${REMOTE_DEPLOY_BRANCH}
	@echo DEPLOY_TARGET=${DEPLOY_TARGET}
	@echo RELEASE_TAG_PREFIX=${RELEASE_TAG_PREFIX}
	@echo APP_DNS_TARGET=${APP_DNS_TARGET}

config-minimal:
	@if [ ! -d "${TOOLS_PATH}" ];then\
		echo "missing tools package at ${TOOLS_PATH}";\
		exit 1;\
	fi

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

export DOCKER_PULL_RETRIES ?= 3
docker-check:
	@if [ ! -f ".${DOCKER_USERNAME}-${DC_IMAGE_NAME}:${APP_VERSION}" ]; then\
		(\
			(docker image inspect ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION} > /dev/null 2>&1)\
			&& touch .${DOCKER_USERNAME}-${DC_IMAGE_NAME}:${APP_VERSION}\
		)\
		||\
		(\
			attempts=${DOCKER_PULL_RETRIES}; ret=1; \
			until [ "$$attempts" -le 0 -o "$$ret" -eq "0" ]; do \
				docker pull ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION} > /dev/null 2>&1; \
				ret=$$?; \
				if [ "$$ret" -ne "0" ]; then echo "retrying docker pull for ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION} ($$attempts left)"; fi; \
				((attempts--)); sleep 5; \
			done; \
			[ "$$ret" -eq "0" ] && touch .${DOCKER_USERNAME}-${DC_IMAGE_NAME}:${APP_VERSION}\
		)\
		|| (echo no previous build found for ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION} && exit 1);\
	fi;

docker-login:
	@if [ -n "${DOCKER_PASSWORD}" ]; then \
		${MAKE} -C ${TOOLS_PATH} docker-login DOCKER_USERNAME=${DOCKER_USERNAME} ${MAKEOVERRIDES}; \
	fi

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


backend-docker-check:
	@${MAKE} docker-check DC_IMAGE_NAME=deces-backend APP_VERSION=${DECES_BACKEND_APP_VERSION} GIT_BRANCH=${GIT_BRANCH}

backend: backend-docker-check proofs-mount elasticsearch-index-readiness
	@${MAKE} -C ${BACKEND_PATH} backend-start APP=deces-backend DC_NETWORK=${DC_NETWORK} APP_VERSION=${DECES_BACKEND_APP_VERSION} GIT_BRANCH=${GIT_BRANCH}\
		APP_URL=${APP_URL} API_EMAIL=${API_EMAIL} API_SSL=${API_SSL}\
		BACKEND_JOB_CONCURRENCY=${BACKEND_JOB_CONCURRENCY} BACKEND_CHUNK_CONCURRENCY=${BACKEND_CHUNK_CONCURRENCY}\
		BACKEND_TOKEN_USER=${BACKEND_TOKEN_USER} BACKEND_TOKEN_KEY=${BACKEND_TOKEN_KEY} BACKEND_TOKEN_PASSWORD=${BACKEND_TOKEN_PASSWORD}\
		BACKEND_TMP_MAX=${BACKEND_TMP_MAX} BACKEND_TMP_DURATION=${BACKEND_TMP_DURATION} BACKEND_TMP_WINDOW=${BACKEND_TMP_WINDOW}

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
	@echo all components started

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

ifneq (${DATAPREP_VERSION_OVERRIDE},)
${DATAPREP_VERSION_FILE}: FORCE
	@printf '%s\n' "${DATAPREP_VERSION_OVERRIDE}" > ${DATAPREP_VERSION_FILE}
else
${DATAPREP_VERSION_FILE}: ${DATAPREP_PATH}/Makefile ${DATAPREP_PATH}/projects/deces-dataprep/recipes/deces_dataprep.yml ${DATAPREP_PATH}/projects/deces-dataprep/datasets/deces_index.yml
	@cat ${DATAPREP_PATH}/Makefile\
		${DATAPREP_PATH}/projects/deces-dataprep/recipes/deces_dataprep.yml\
		${DATAPREP_PATH}/projects/deces-dataprep/datasets/deces_index.yml\
	| sha1sum | awk '{print $1}' | cut -c-8 > ${DATAPREP_VERSION_FILE}
endif

dataprep-version: ${DATAPREP_VERSION_FILE}
	@cat ${DATAPREP_VERSION_FILE}

ifneq (${DATA_VERSION_OVERRIDE},)
${DATA_VERSION_FILE}: FORCE
	@printf '%s\n' "${DATA_VERSION_OVERRIDE}" > ${DATA_VERSION_FILE}
else ifeq (${DATA_VERSION_SOURCE},local)
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
	@env -u APP_VERSION -u DECES_BACKEND_APP_VERSION -u MAKEFLAGS -u MFLAGS ${MAKEBIN} --no-print-directory -s -C ${BACKEND_PATH} version | awk '{print $$NF}'

artifact-version-deces-ui:
	@env -u APP_VERSION -u MAKEFLAGS -u MFLAGS ${MAKEBIN} --no-print-directory -s -C ${FRONTEND_PATH} version | awk '{print $$NF}'

artifact-version-dataprep-snapshot: ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@echo esdata_$$(cat ${DATAPREP_VERSION_FILE})_$$(cat ${DATA_VERSION_FILE})

artifact-versions:
	@echo "matchid-backend: $$(${MAKE} artifact-version-dataprep-backend)"
	@echo "matchid-frontend: $$(${MAKE} artifact-version-dataprep-frontend)"
	@echo "deces-backend: $$(${MAKE} artifact-version-deces-backend)"
	@echo "deces-ui: $$(${MAKE} artifact-version-deces-ui)"
	@echo "snapshot: $$(${MAKE} artifact-version-dataprep-snapshot)"

package-version:
	@if [ -z "${PACKAGE}" ]; then\
		echo "PACKAGE is required";\
		exit 1;\
	fi
	@python3 ${PACKAGE_VERSIONS_SCRIPT} --root ${APP_PATH} get --package "${PACKAGE}"

package-version-set:
	@if [ -z "${PACKAGE}" ] || [ -z "${VERSION}" ]; then\
		echo "PACKAGE and VERSION are required";\
		exit 1;\
	fi
	@python3 ${PACKAGE_VERSIONS_SCRIPT} --root ${APP_PATH} set --package "${PACKAGE}" --version "${VERSION}"

package-version-deces-ui:
	@${MAKE} package-version PACKAGE=deces-ui

package-version-deces-backend:
	@${MAKE} package-version PACKAGE=deces-backend

package-version-dataprep-frontend:
	@${MAKE} package-version PACKAGE=dataprep-frontend

package-version-dataprep-backend:
	@${MAKE} package-version PACKAGE=dataprep-backend

package-versions:
	@python3 ${PACKAGE_VERSIONS_SCRIPT} --root ${APP_PATH} list

artifact-produce-dataprep-snapshot:
	@rm -f ${ARTIFACT_RECIPE_RUN_MARKER} ${ARTIFACT_S3_PULL_MARKER}
	@${MAKE} -C ${DATAPREP_PATH} config ${MAKEOVERRIDES}
	@${MAKE} -C ${APP_PATH}/packages/dataprep-backend backend-build ${MAKEOVERRIDES}
	@${MAKE} dataprep-run \
		DATAPREP_BACKEND_LOCAL_TARGET=backend \
		DATAPREP_BACKEND_LOCAL_STOP_TARGET=backend-stop \
		RECIPE_RUN_MARKER=${ARTIFACT_RECIPE_RUN_MARKER} \
		S3_PULL_MARKER=${ARTIFACT_S3_PULL_MARKER} \
		${MAKEOVERRIDES}

artifact-publish-dataprep-snapshot:
	@ES_BACKUP_NAME=$$(${MAKE} artifact-version-dataprep-snapshot ${MAKEOVERRIDES} | tail -1); \
	${MAKE} -C ${INFRA_PATH} elasticsearch-repository-backup \
		ES_INDEX=deces ES_BACKUP_NAME=$${ES_BACKUP_NAME} ${MAKEOVERRIDES}

artifact-restore-dataprep-snapshot:
	@${MAKE} elasticsearch-restore ${MAKEOVERRIDES}

show-env:
	@for var in STORAGE_ACCESS_KEY STORAGE_SECRET_KEY TOOLS_STORAGE_ACCESS_KEY TOOLS_STORAGE_SECRET_KEY LOG_BUCKET LOG_DB_BUCKET STATS_BUCKET PROOFS_BUCKET REPOSITORY_BUCKET MONITOR_BUCKET; do \
		if [ -n "$${!var}" ]; then \
			echo "$$var=<set>"; \
		else \
			echo "$$var=<unset>"; \
		fi; \
	done

deploy-local: config show-env stats-background elasticsearch-restore-async docker-login frontend-docker-check up local-test-api

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
	@export BACKEND_APP_VERSION=${DECES_BACKEND_APP_VERSION};\
	cat ${KUBE_DIR}/backend.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","` | kubectl apply -f -

deploy-k8s-frontend: deploy-k8s-namespace
	@echo $@
	@cat ${KUBE_DIR}/frontend.yaml | envsubst `env | sed "s/=.*//;s/^/$$/" | tr "\n" ","` | kubectl apply -f -

deploy-remote-instance: config-minimal ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@\
	BACKEND_APP_VERSION=${DECES_BACKEND_APP_VERSION};\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-config\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$${BACKEND_APP_VERSION}-data:$${DATAPREP_VERSION}-$${DATA_VERSION}\
		APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=deces-ui\
		GIT_ROOT=${GIT_ROOT} REMOTE_TOOLS_REPOSITORY=${APP_MONOREPO} REMOTE_TOOLS_BRANCH=${REMOTE_DEPLOY_BRANCH}\
		REMOTE_TOOLS_PATH=${REMOTE_MONOREPO_PATH} REMOTE_TOOLS_MAKE_PATH=${REMOTE_MONOREPO_TOOLS_PATH}\
		REMOTE_APP_REPOSITORY=${APP_MONOREPO} REMOTE_APP_BRANCH=${REMOTE_DEPLOY_BRANCH}\
		REMOTE_APP_PATH=${REMOTE_MONOREPO_PATH} REMOTE_APP_MAKE_PATH=${REMOTE_MONOREPO_PATH}\
		SCW_IMAGE_ID=${SCW_IMAGE_ID} SCW_VOLUME_SIZE=${SCW_VOLUME_SIZE} SCW_VOLUME_TYPE=${SCW_VOLUME_TYPE} \
		GIT_BRANCH=${GIT_BRANCH} ${MAKEOVERRIDES}

deploy-remote-services:
	@\
	BACKEND_APP_VERSION=${DECES_BACKEND_APP_VERSION};\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-deploy remote-actions\
		APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=deces-ui\
		BACKEND_APP_VERSION=$${BACKEND_APP_VERSION} DATAPREP_VERSION=$${DATAPREP_VERSION} DATA_VERSION=$${DATA_VERSION}\
		ACTIONS=deploy-local GIT_BRANCH=${GIT_BRANCH}\
		GIT_ROOT=${GIT_ROOT} REMOTE_TOOLS_REPOSITORY=${APP_MONOREPO} REMOTE_TOOLS_BRANCH=${REMOTE_DEPLOY_BRANCH}\
		REMOTE_TOOLS_PATH=${REMOTE_MONOREPO_PATH} REMOTE_TOOLS_MAKE_PATH=${REMOTE_MONOREPO_TOOLS_PATH}\
		REMOTE_APP_REPOSITORY=${APP_MONOREPO} REMOTE_APP_BRANCH=${REMOTE_DEPLOY_BRANCH}\
		REMOTE_APP_PATH=${REMOTE_MONOREPO_PATH} REMOTE_APP_MAKE_PATH=${REMOTE_MONOREPO_PATH}\
		TOOLS_STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY}\
		TOOLS_STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY}\
		LOG_BUCKET=${LOG_BUCKET} LOG_DB_BUCKET=${LOG_DB_BUCKET} STATS_BUCKET=${STATS_BUCKET} PROOFS_BUCKET=${PROOFS_BUCKET}\
		BACKEND_TOKEN_KEY=${BACKEND_TOKEN_KEY} BACKEND_TOKEN_PASSWORD=${BACKEND_TOKEN_PASSWORD}\
		DOCKER_PASSWORD=${DOCKER_PASSWORD}\
		${MAKEOVERRIDES}

deploy-remote-publish:
	@NGINX_HOST_EFFECTIVE="${NGINX_HOST}";\
	NGINX_USER_EFFECTIVE="${NGINX_USER}";\
	if [ -z "$$NGINX_HOST_EFFECTIVE" ]; then NGINX_HOST_EFFECTIVE="${NGINX_HOST_RESOLVED}"; fi;\
	if [ -z "$$NGINX_USER_EFFECTIVE" ]; then NGINX_USER_EFFECTIVE="${NGINX_USER_RESOLVED}"; fi;\
	if [ -z "$$NGINX_HOST_EFFECTIVE" -o -z "$$NGINX_USER_EFFECTIVE" ];then\
		echo "can't deploy without NGINX_HOST and NGINX_USER";\
		exit 1;\
	fi;\
	BACKEND_APP_VERSION=${DECES_BACKEND_APP_VERSION};\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-test-api-in-vpc nginx-conf-apply remote-test-api\
		NGINX_HOST=$$NGINX_HOST_EFFECTIVE NGINX_USER=$$NGINX_USER_EFFECTIVE\
		APP=${APP_FRONTEND} APP_VERSION=${APP_VERSION} GIT_BRANCH=${GIT_BRANCH} PORT=${PORT}\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$${BACKEND_APP_VERSION}-data:$${DATAPREP_VERSION}-$${DATA_VERSION}\
		API_TEST_PATH=${API_TEST_PATH} API_TEST_JSON_PATH=${API_TEST_JSON_PATH} API_TEST_DATA='${API_TEST_REQUEST}'\
		${MAKEOVERRIDES} APP_DNS=${APP_DNS_TARGET}

deploy-delete-old: ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@\
	BACKEND_APP_VERSION=${DECES_BACKEND_APP_VERSION};\
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

DEPLOY_REMOTE_REQUIRED_VARS = \
	APP_DNS \
	GIT_BRANCH \
	REPOSITORY_BUCKET \
	STORAGE_ACCESS_KEY \
	STORAGE_SECRET_KEY \
	TOOLS_STORAGE_ACCESS_KEY \
	TOOLS_STORAGE_SECRET_KEY \
	LOG_BUCKET \
	LOG_DB_BUCKET \
	STATS_BUCKET \
	PROOFS_BUCKET \
	BACKEND_TOKEN_KEY \
	BACKEND_TOKEN_PASSWORD \
	SCW_SECRET_TOKEN \
	SCW_PROJECT_ID \
	SCW_IMAGE_ID \
	NGINX_HOST \
	NGINX_USER \
	CDN_TOKEN \
	CDN_ZONE_ID \
	NEW_RELIC_INGEST_KEY \
	NEW_RELIC_API_KEY \
	NEW_RELIC_ACCOUNT_ID

DEPLOY_REMOTE_OPTIONAL_VARS = \
	MONITOR_BUCKET

export $(DEPLOY_REMOTE_REQUIRED_VARS) $(DEPLOY_REMOTE_OPTIONAL_VARS)

deploy-remote-preflight: config-minimal
	@missing=0; \
	for var in ${DEPLOY_REMOTE_REQUIRED_VARS}; do \
		if [ -z "$${!var}" ]; then \
			echo "missing $$var"; \
			missing=1; \
		fi; \
	done; \
	if [ "$$missing" -ne 0 ]; then exit 1; fi; \
	if [ "${DEPLOY_TARGET}" != "prod" ]; then \
		if [ "${GIT_BRANCH}" != "dev" ]; then \
			echo "GIT_BRANCH=${GIT_BRANCH} is not the expected preprod runtime label dev"; \
			exit 1; \
		fi; \
		if [ "${REMOTE_DEPLOY_BRANCH}" != "${GIT_BRANCH_MAIN}" ]; then \
			echo "REMOTE_DEPLOY_BRANCH=${REMOTE_DEPLOY_BRANCH} is not the expected preprod git ref ${GIT_BRANCH_MAIN}"; \
			exit 1; \
		fi; \
		if [ "${REPOSITORY_BUCKET}" != "${REPOSITORY_BUCKET_DEV}" ]; then \
			echo "REPOSITORY_BUCKET=${REPOSITORY_BUCKET} is not preprod bucket ${REPOSITORY_BUCKET_DEV}"; \
			exit 1; \
		fi; \
	else \
		if [ "${GIT_BRANCH}" != "master" ]; then \
			echo "GIT_BRANCH=${GIT_BRANCH} is not the expected prod runtime label master"; \
			exit 1; \
		fi; \
	fi; \
	if [ "${DEPLOY_TARGET}" != "prod" ] && [ "${REMOTE_DEPLOY_BRANCH}" != "${GIT_BRANCH}" ] && [ "${REMOTE_DEPLOY_BRANCH}" != "${GIT_BRANCH_MAIN}" ]; then \
		echo "warning remote deploy branch ${REMOTE_DEPLOY_BRANCH} differs from deploy branch ${GIT_BRANCH}"; \
	fi; \
	if [ ! -f "${SSHKEY_PRIVATE}" ]; then \
		echo "missing SSH key ${SSHKEY_PRIVATE}"; \
		exit 1; \
	fi; \
	for var in ${DEPLOY_REMOTE_OPTIONAL_VARS}; do \
		if [ -z "$${!var}" ]; then \
			echo "warning missing optional $$var"; \
		fi; \
	done; \
	echo "deploy-remote preflight ok for ${APP_DNS_TARGET}"

deploy-remote: config-minimal deploy-remote-instance deploy-remote-services deploy-remote-publish deploy-cdn-purge-cache deploy-delete-old deploy-monitor

deploy-docker-pull-base: deploy-remote-instance
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=node:12.14.0-slim
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=nginx:alpine
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=docker.elastic.co/elasticsearch/elasticsearch:${ES_VERSION}
	@${MAKE} -C ${TOOLS_PATH} remote-docker-pull DOCKER_IMAGE=redis:alpine


update-base-image: deploy-remote-instance deploy-docker-pull-base
	@BACKEND_APP_VERSION=${DECES_BACKEND_APP_VERSION}; \
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
	if [ "$$ALLOW_MAKE_GIT_COMMIT" = "true" ]; then\
		${GIT} add Makefile && ${GIT} commit -m 'chore: update SCW_IMAGE_ID';\
	else\
		echo "SCW_IMAGE_ID updated in Makefile; review and commit manually";\
	fi

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
