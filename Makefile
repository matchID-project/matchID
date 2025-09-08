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
export APP = deces-ui
export APP_FRONTEND = deces-ui
export APP_BACKEND = deces-backend
export APP_TOOLS = tools
export APP_DATAPREP = deces-dataprep
export DATASET=fichier-des-personnes-decedees
export APP_GROUP = matchID
export APP_PATH := $(shell pwd)
export APP_DNS?=deces.matchid.io
export API_EMAIL?=matchid.project@gmail.com
export FRONTEND_PATH := ${APP_PATH}/packages/${APP_FRONTEND}
export BACKEND_PATH := ${APP_PATH}/packages/${APP_BACKEND}
export TOOLS_PATH := ${APP_PATH}/packages/${APP_TOOLS}
export DATAPREP_PATH := ${APP_PATH}/packages/${APP_DATAPREP}
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
export BACKEND_PORT=8080
export BACKEND_HOST=backend
export BACKEND_JOB_CONCURRENCY=6
export BACKEND_CHUNK_CONCURRENCY=3
export BACKEND_TMP_MAX = 150 # number of requests before ban
export BACKEND_TMP_DURATION = 14400 # duration of ban in seconds after exceeding number of max request
export BACKEND_TMP_WINDOW = 86400 # seconds before reset of request count
#export BACKEND_LOG_LEVEL=error
export BACKEND_TOKEN_USER?=${API_EMAIL}
export BACKEND_TOKEN_KEY?=$(shell openssl rand -base64 16)
export BACKEND_TOKEN_PASSWORD?=$(shell openssl rand -base64 16)
#export SMTP_TLS_SELFSIGNED=true #if need self signed smtp relay
export SMTP_HOST=smtp
export SMTP_PORT?=1025
export SMTP_USER?=${API_EMAIL}
export SMTP_PWD?=$(shell echo $$RANDOM )
export API_PATH = deces
export BACKEND_PROXY_PATH=/${API_PATH}/api/v1
export API_TIMEOUT = 45

export DC_PREFIX := $(shell echo ${APP} | tr '[:upper:]' '[:lower:]' | tr '_' '-')
export DC_IMAGE_NAME = ${DC_PREFIX}
export DC_NETWORK := $(shell echo ${APP} | tr '[:upper:]' '[:lower:]')
export DC_BUILD_ARGS = --pull --no-cache
export DC := docker compose
export GIT_ORIGIN=origin
export GIT_BRANCH ?= $(shell git branch | grep '*' | awk '{print $$2}')
export GIT_BRANCH_MASTER = master
export GIT_ROOT = https://github.com/matchID-project
export APP_URL?=https://${APP_DNS}
export API_SSL?=1
export APP_NODES=1
export KUBE_NAMESPACE:=$(shell echo -n ${APP_GROUP}-${APP}-${GIT_BRANCH} | tr '[:upper:]' '[:lower:]' | tr '_/' '-')
export KUBE_DIR=${FRONTEND_PATH}/k8s
export KUBECONFIG=${HOME}/.kube/config
export ES_MEM_KUBE?=$(shell echo -n ${ES_MEM} | sed 's/\s*m/Mi/')

export PROOFS=${DATA_DIR}/proofs
export MONITOR_DIR = ${APP}/log/instances/${APP_GROUP}-${APP}-${GIT_BRANCH}

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

# elasticsearch defaut configuration
export ES_HOST = elasticsearch
export ES_PORT = 9200
export ES_TIMEOUT = 60
export ES_RESTORE_TIMEOUT = 480
export ES_INDEX = deces
export ES_MAX_RESULTS = 10000
export DATA_DIR = ${APP_PATH}/data
export ES_DATA = ${DATA_DIR}/esdata
export ES_NODES = 1
export ES_MEM = 512m
export ES_JAVA_OPTS=-Xms${ES_MEM} -Xmx${ES_MEM}
export ES_VERSION = 8.6.1
export ES_BACKUP_BASENAME := esdata
export DATAPREP_VERSION_FILE = ${APP_PATH}/.dataprep.sha1
export DATA_VERSION_FILE = ${APP_PATH}/.data.sha1
export FILES_TO_PROCESS?=deces-([0-9]{4}|2025-m[0-9]{2}).txt.gz
export FILES_TO_PROCESS_TEST=deces-2020-m01.txt.gz # reference for test env
export FILES_TO_PROCESS_DEV=deces-2020-m[0-1][0-9].txt.gz # reference for preprod env
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

export VERSION := $(shell cat tagfiles.version | xargs -I '{}' find {} -type f -not -name '*.tar.gz'  | sort | xargs cat | sha1sum - | sed 's/\(......\).*/\1/')

commit              := $(shell git describe --tags || cat VERSION )
tag                 := $(shell git describe --tags | sed 's/-.*//')
lastcommit          := $(shell touch .lastcommit && cat .lastcommit)
date                := $(shell date -I)

export APP_VERSION :=  ${tag}-${VERSION}


export DOCKER_USERNAME=matchid

include /etc/os-release

# Include deces-* Makefile
-include ${FRONTEND_PATH}/Makefile
-include ${INFRA_PATH}/Makefile
#-include ${BACKEND_PATH}/Makefile

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

clean-frontend: rollup-clean build-dir-clean frontend-clean-dist frontend-clean-dist-archive

clean-backend:
	@${MAKE} -C ${BACKEND_PATH} clean-local

clean-remote:
	@${MAKE} -C ${TOOLS_PATH} remote-clean ${MAKEOVERRIDES} > /dev/null 2>&1 || true

clean-config:
	@rm -rf elasticsearch-repository-* > /dev/null 2>&1 || true

clean-local: clean-data clean-frontend clean-backend clean-config

clean: clean-remote clean-local

docker-push:
	@${MAKE} -C ${TOOLS_PATH} docker-push DC_IMAGE_NAME=${DC_IMAGE_NAME} APP_VERSION=${APP_VERSION} ${MAKEOVERRIDES}

docker-pull:
	docker pull ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION}

docker-check:
	@if [ ! -f ".${DOCKER_USERNAME}-${DC_IMAGE_NAME}:${APP_VERSION}" ]; then\
		(\
			(docker image inspect ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION} > /dev/null 2>&1)\
			&& touch .${DOCKER_USERNAME}-${DC_IMAGE_NAME}:${APP_VERSION}\
		)\
		||\
		(\
			(docker pull ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION} > /dev/null 2>&1)\
			&& touch .${DOCKER_USERNAME}-${DC_IMAGE_NAME}:${APP_VERSION}\
		)\
		|| (echo no previous build found for ${DOCKER_USERNAME}/${DC_IMAGE_NAME}:${APP_VERSION} && exit 1);\
	fi;

network-stop:
	docker network rm ${DC_NETWORK}

network: config
	@docker network create ${DC_NETWORK_OPT} ${DC_NETWORK} 2> /dev/null; true

backend-dev:
	@echo docker-compose up backend dev
	@${MAKE} -C ${BACKEND_PATH} dev TOOLS_PATH=${TOOLS_PATH} DATA_DIR=${DATA_DIR} DC_NETWORK=${DC_NETWORK} GIT_BRANCH=${GIT_BRANCH}\
		APP_URL=http://localhost:${PORT} API_EMAIL=${API_EMAIL} API_SSL=${API_SSL}\
		BACKEND_JOB_CONCURRENCY=${BACKEND_JOB_CONCURRENCY} BACKEND_CHUNK_CONCURRENCY=${BACKEND_CHUNK_CONCURRENCY}\
		BACKEND_TOKEN_USER=${BACKEND_TOKEN_USER} BACKEND_TOKEN_KEY=${BACKEND_TOKEN_KEY} BACKEND_TOKEN_PASSWORD=${BACKEND_TOKEN_PASSWORD}\
		BACKEND_TMP_MAX=${BACKEND_TMP_MAX} BACKEND_TMP_DURATION=${BACKEND_TMP_DURATION} BACKEND_TMP_WINDOW=${BACKEND_TMP_WINDOW}

backend-dev-stop:
	@${MAKE} -C ${BACKEND_PATH} dev-stop TOOLS_PATH=${TOOLS_PATH} DC_NETWORK=${DC_NETWORK} GIT_BRANCH=${GIT_BRANCH}

backend-clean-version:
	rm backend-version

backend-docker-check: backend-config
	@BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	${MAKE} docker-check DC_IMAGE_NAME=deces-backend APP_VERSION=$$BACKEND_APP_VERSION GIT_BRANCH=${GIT_BRANCH}

backend: backend-config backend-docker-check proofs-mount elasticsearch-index-readiness
	@BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	${MAKE} -C ${BACKEND_PATH} backend-start APP=deces-backend DC_NETWORK=${DC_NETWORK} APP_VERSION=$$BACKEND_APP_VERSION GIT_BRANCH=${GIT_BRANCH}\
		APP_URL=${APP_URL} API_EMAIL=${API_EMAIL} API_SSL=${API_SSL}\
                BACKEND_JOB_CONCURRENCY=${BACKEND_JOB_CONCURRENCY} BACKEND_CHUNK_CONCURRENCY=${BACKEND_CHUNK_CONCURRENCY}\
                BACKEND_TOKEN_USER=${BACKEND_TOKEN_USER} BACKEND_TOKEN_KEY=${BACKEND_TOKEN_KEY} BACKEND_TOKEN_PASSWORD=${BACKEND_TOKEN_PASSWORD}\
                BACKEND_TMP_MAX=${BACKEND_TMP_MAX} BACKEND_TMP_DURATION=${BACKEND_TMP_DURATION} BACKEND_TMP_WINDOW=${BACKEND_TMP_WINDOW}

backend-stop:
	@BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	${MAKE} -C ${BACKEND_PATH} backend-stop DC_NETWORK=${DC_NETWORK} APP_VERSION=$$BACKEND_APP_VERSION GIT_BRANCH=${GIT_BRANCH}
	@make proofs-umount

# Frontend targets are now defined in packages/deces-ui/Makefile

dev: network frontend-stop elasticsearch backend-dev frontend-dev

dev-stop: frontend-dev-stop backend-dev-stop elasticsearch-stop

build: clean-frontend frontend-build nginx-build

# Frontend and nginx targets are now defined in packages/deces-ui/Makefile

stop: frontend-stop backend-stop elasticsearch-stop
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


${DATAPREP_VERSION_FILE}:
	@cat ${DATAPREP_PATH}/Makefile\
		${DATAPREP_PATH}/projects/deces-dataprep/recipes/deces_dataprep.yml\
		${DATAPREP_PATH}/projects/deces-dataprep/datasets/deces_index.yml\
	| sha1sum | awk '{print $1}' | cut -c-8 > ${DATAPREP_VERSION_FILE}

${DATA_VERSION_FILE}:
	@${MAKE} -C ${TOOLS_PATH} catalog-tag CATALOG_TAG=${DATA_VERSION_FILE}\
		DATAGOUV_DATASET=${DATASET} STORAGE_BUCKET=${STORAGE_BUCKET}\
		STORAGE_ACCESS_KEY=${STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${STORAGE_SECRET_KEY}\
		FILES_PATTERN='${FILES_TO_PROCESS}'

show-env:
	env | egrep 'STORAGE|BUCKET'

deploy-local: config show-env stats-background elasticsearch-restore-async docker-check up local-test-api

smtp:
	@${MAKE} -C ${BACKEND_PATH} smtp DC_NETWORK=${DC_NETWORK}

smtp-stop:
	@${MAKE} -C ${BACKEND_PATH} smtp-stop

# Frontend targets are now defined in packages/deces-ui/Makefile
	PLAYWRIGHT_VERSION=$$(curl -s https://mcr.microsoft.com/v2/playwright/tags/list | jq -r '.tags | map(select(test("^v[0-9]+\\.[0-9]+\\.[0-9]+$$"))) | .[]' | sort -V | tail -1 | sed 's/^v//') ${DC} -f ${FRONTEND_PATH}/docker-compose-test.yml run ui-test sh -c "yarn install && node runAllTests.js"

backend-test:
	@${MAKE} -C ${BACKEND_PATH} backend-test

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

deploy-remote-instance: config-minimal backend-config ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@\
	BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-config\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$${BACKEND_APP_VERSION}-data:$${DATAPREP_VERSION}-$${DATA_VERSION}\
		APP=${APP} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=${DC_PREFIX}\
		SCW_IMAGE_ID=${SCW_IMAGE_ID} SCW_VOLUME_SIZE=${SCW_VOLUME_SIZE} SCW_VOLUME_TYPE=${SCW_VOLUME_TYPE} \
		GIT_BRANCH=${GIT_BRANCH} ${MAKEOVERRIDES}

deploy-remote-services:
	@\
	BACKEND_APP_VERSION=$(shell cd ${BACKEND_PATH} && git describe --tags);\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	${MAKE} -C ${TOOLS_PATH} remote-deploy remote-actions\
		APP=${APP} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=${DC_PREFIX}\
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
		APP=${APP} APP_VERSION=${APP_VERSION} GIT_BRANCH=${GIT_BRANCH} PORT=${PORT}\
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
		APP=${APP} APP_VERSION=${APP_VERSION} DC_IMAGE_NAME=${DC_PREFIX}\
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
		GIT_BRANCH=${GIT_BRANCH} APP=${APP} APP_VERSION=${APP_VERSION}\
		CLOUD_TAG=ui:${APP_VERSION}-backend:$$BACKEND_APP_VERSION\
		DC_IMAGE_NAME=${DC_PREFIX};
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

${PROOFS}:
	@mkdir -p ${PROOFS}

proofs-restore: ${PROOFS}
	@if [ -n "${PROOFS_BUCKET}" ];then\
		echo restoring proofs data;\
		${MAKE} -C ${TOOLS_PATH} storage-sync-pull STORAGE_BUCKET=${PROOFS_BUCKET}/${GIT_BRANCH} DATA_DIR=${PROOFS} \
			RCLONE_OPTS="--checksum" RCLONE_SYNC="copy"\
			STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY};\
	fi

proofs-backup: ${PROOFS}
	@if [ -n "${PROOFS_BUCKET}" ];then\
		${MAKE} -C ${TOOLS_PATH} storage-sync-push STORAGE_BUCKET=${PROOFS_BUCKET}/${GIT_BRANCH} DATA_DIR=${PROOFS} \
			RCLONE_OPTS="--checksum" RCLONE_SYNC="copy"\
			STORAGE_ACCESS_KEY=${TOOLS_STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${TOOLS_STORAGE_SECRET_KEY};\
	fi;

proofs-mount:
	@if [ -n "${PROOFS_BUCKET}" ];then\
		((make proofs-restore && while (true); do  make proofs-backup;sleep 30;done) > .proofs-backup 2>&1 &);\
	fi;

proofs-umount:
	@ps -elf | grep "make proofs-backup" | awk '{print $$4}'  | head -1 | xargs kill || echo -n
