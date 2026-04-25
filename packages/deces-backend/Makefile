SHELL := /bin/bash

export APP = deces-backend
export APP_BACKEND ?= ${APP}
export APP_GROUP = matchID
export APP_PATH ?= $(shell pwd)
export BACKEND_PATH ?= ${APP_PATH}
export INFRA_PATH ?= $(abspath ${BACKEND_PATH}/../deces-infra)
export MONOREPO_ROOT ?= $(abspath ${BACKEND_PATH}/../..)
# Canonical tools live in the sibling monorepo package, not in a local backend/tools clone.
export TOOLS_PATH ?= $(abspath ${BACKEND_PATH}/../tools)
export APP_DNS?=deces.matchid.io
export APP_VERSION	:= $(shell (git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null) | sed 's#[^A-Za-z0-9_.-]#-#g')
export USE_TTY := $(shell test -t 1 && USE_TTY="-t")

# make options
export MAKEBIN = $(shell which make)
export MAKE = ${MAKEBIN} --no-print-directory -s

# docker compose
export DC ?= docker compose
export DC_FILE=${BACKEND_PATH}/docker-compose
export DC_BACKEND=${DC} -f $(DC_FILE).yml
export DC_PREFIX := $(shell echo ${APP_BACKEND} | tr '[:upper:]' '[:lower:]' | tr '_' '-')
export DC_NETWORK := $(shell echo ${APP_BACKEND} | tr '[:upper:]' '[:lower:]')

# elasticsearch defaut configuration
export API_PATH = deces

# BACKEND dir
export API_PATH = deces
export BACKEND_PROXY_PATH=/${API_PATH}/api/v1
export BACKEND_PORT=8080
export BACKEND_HOST=backend
export API_SSL?=1
export APP_URL?=http$([ "$API_SSL" == 1 ] && echo "s" || echo "")://${APP_DNS}
export API_EMAIL?=contact@matchid.io
export BACKEND_TOKEN_USER?=matchid.project@gmail.com
export BACKEND_TOKEN_KEY?=$(shell openssl rand -base64 16)
export BACKEND_TOKEN_PASSWORD?=$(shell openssl rand -base64 16)
export NPM_REGISTRY = $(shell echo $$NPM_REGISTRY )
export NPM_VERBOSE ?= 1
export REDIS_DATA=${DATA_DIR}/redisdata
export BULK_TIMEOUT = 600
export BACKEND_TIMEOUT ?= 90
export BACKEND_JOB_CONCURRENCY = 6
export BACKEND_CHUNK_CONCURRENCY = 3
export BACKEND_TMP_MAX = 150 # number of requests before ban
export BACKEND_TMP_DURATION = 14400 # duration of ban in seconds after exceeding number of max request
export BACKEND_TMP_WINDOW = 86400 # seconds before reset of request count
export BACKEND_TMPFILE_PERSISTENCE = 3600000
#export SMTP_TLS_SELFSIGNED=true #if SMTP SSL & self signed
export SMTP_HOST?=smtp
export SMTP_PORT?=1025
export MAILDEV_UI_PORT?=1080
export BACKEND_TEST_SCRIPT?=test
export SMTP_USER?=${API_EMAIL}
export SMTP_PWD?=$(shell echo $$RANDOM )

# Backupdir
export BACKUP_DIR = ${APP_PATH}/backup
export DATAPREP_VERSION_FILE = ${APP_PATH}/.dataprep.sha1
export DATA_VERSION_FILE = ${APP_PATH}/.data.sha1
export FILES_TO_PROCESS?=deces-([0-9]{4}|2020-m[0-9]{2}).txt.gz
export FILES_TO_PROCESS_TEST=deces-2020-m01.txt.gz
export FILES_TO_PROCESS_DEV=deces-2020-m[0-1][0-9].txt.gz
export REPOSITORY_BUCKET?=fichier-des-personnes-decedees-elasticsearch
export REPOSITORY_BUCKET_DEV=fichier-des-personnes-decedees-elasticsearch-dev

export DC_IMAGE_NAME=${DC_PREFIX}
export GIT_BRANCH ?= $(or ${GITHUB_HEAD_REF},$(shell git rev-parse --abbrev-ref HEAD 2>/dev/null | sed 's/^HEAD$$/detached-head/'))
export GIT_BRANCH_MAIN ?= main
export GIT_BRANCH_RELEASE ?= ${GIT_BRANCH_MAIN}
export DOCKER_USERNAME=matchid
export DOCKER_PASSWORD
export STORAGE_ACCESS_KEY
export STORAGE_SECRET_KEY
export DATASET=fichier-des-personnes-decedees
export STORAGE_BUCKET=${DATASET}
export AWS=${APP_PATH}/aws

export DATA_DIR ?= $(if $(wildcard ${MONOREPO_ROOT}/packages/deces-backend),${MONOREPO_ROOT}/data,${BACKEND_PATH}/data)
export COMMUNES_JSON=${DATA_DIR}/communes.json
export DISPOSABLE_MAIL=${DATA_DIR}/disposable-mail.txt
export DB_JSON=${DATA_DIR}/userDB.json
export PROOFS=$(abspath ${DATA_DIR}/proofs)
export JOBS=$(abspath ${DATA_DIR}/jobs)

export DATAGOUV_CATALOG_URL = https://www.data.gouv.fr/api/1/datasets/${DATASET}/
export DATAGOUV_RESOURCES_URL = https://static.data.gouv.fr/resources/${DATASET}
export DATAGOUV_PROXY_PATH = /${API_PATH}/api/v0/getDataGouvFile

export WIKIDATA_SRC= ${BACKEND_PATH}/tests/wikidata_dead_french.csv
export WIKIDATA_LINKS=${DATA_DIR}/wikidata.json

# test artillery
export PERF=${BACKEND_PATH}/tests/performance
export PERF_SCENARIO_V1=${PERF}/scenarios/test-backend-v1.yml
export PERF_REPORTS=${PERF}/reports/
export PERF_NAMES=${BACKEND_PATH}/tests/clients_test.csv
export PERF_UTILS=${PERF}/scenarios/utils

-include ${TOOLS_PATH}/artifacts.SCW
export SCW_REGION?=fr-par
export SCW_ENDPOINT?=s3.fr-par.scw.cloud
dummy		    := $(shell touch artifacts)
include ./artifacts

ifeq ($(abspath $(CURDIR)),$(abspath $(BACKEND_PATH)))
config:
	@${MAKE} -C ${TOOLS_PATH} config
endif




# DOCKER

docker-push-backend:
	@make -C ${TOOLS_PATH} docker-push DC_IMAGE_NAME=${DC_IMAGE_NAME} APP_VERSION=${APP_VERSION}

docker-check-backend:
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

docker-save-backend:
	@docker save -o deces-backend.tar ${DOCKER_USERNAME}/deces-backend:${APP_VERSION}

docker-load-backend:
	@docker load -i deces-backend.tar

#############
#  Backend  #
#############

# build
backend-build-image: ${WIKIDATA_LINKS} ${COMMUNES_JSON} ${DISPOSABLE_MAIL} ${DB_JSON} ${PROOFS} ${JOBS}
	export EXEC_ENV=production; ${DC_BACKEND} build backend

backend-build-all: network backend-build-image

deploy-dependencies: config
	@${MAKE} -C ${INFRA_PATH} elasticsearch-restore-async \
		DATAPREP_VERSION_FILE=${MONOREPO_ROOT}/.dataprep.sha1 \
		DATA_VERSION_FILE=${MONOREPO_ROOT}/.data.sha1 ${MAKEOVERRIDES}
	@${MAKE} docker-check-backend ${MAKEOVERRIDES}
	@${MAKE} ${BACKEND_PATH}/tests/clients_test.csv ${MAKEOVERRIDES}
	@${MAKE} -C ${INFRA_PATH} elasticsearch-index-readiness ${MAKEOVERRIDES}

# production mode
backend-start: backend-redis backend-smtp
	@echo docker-compose up backend for production ${VERSION}
	@export EXEC_ENV=production; ${DC_BACKEND} up -d 2>&1 | grep -v orphan
	@timeout=${BACKEND_TIMEOUT} ; ret=1 ;\
		until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do\
			(docker exec -i ${USE_TTY} ${APP_BACKEND} curl -s --fail -X GET http://localhost:${BACKEND_PORT}/deces/api/v1/version > /dev/null) ;\
			ret=$$? ;\
			if [ "$$ret" -ne "0" ] ; then\
				echo -e "try still $$timeout seconds to start backend before timeout" ;\
			fi ;\
			((timeout--)); sleep 1 ;\
		done ;\
	echo -e "backend started in $$((BACKEND_TIMEOUT - timeout)) seconds"; exit $$ret

backend-stop:
	@echo docker-compose down backend for production ${VERSION}
	@export EXEC_ENV=production; ${DC_BACKEND} down --remove-orphans
	@${MAKE} proofs-umount

backend-test:
	@echo Testing API parameters
	@docker exec -i ${USE_TTY} ${APP_BACKEND} /bin/sh /deces-backend/tests/test_query_params.sh

db-json-fake:
	@mkdir -p $(dir ${DB_JSON})
	echo '{"user1@gmail.com": "7cd61af92058569476e9d91fea601ba85fa02258b6263cfa188c15957f4752f3"}' > ${DB_JSON}

backend-test-reset: backend-redis ${JOBS}
	@find ${JOBS} -type f -name '*.enc' -delete
	@export EXEC_ENV=development; ${DC_BACKEND} -f ${DC_FILE}-dev-backend.yml stop backend > /dev/null 2>&1 || true
	@docker exec -i ${USE_TTY} ${APP}-redis redis-cli FLUSHALL > /dev/null

backend-test-vitest: db-json-fake backend-smtp backend-test-reset ${BACKEND_PATH}/tests/clients_test.csv
	@echo Testing API with vitest tests
	@if [ ! -f "${BACKEND_PATH}/src/routes/routes.ts" ]; then export EXEC_ENV=development; \
		export BACKEND_LOG_LEVEL=error; \
		${DC_BACKEND} -f ${DC_FILE}-dev-backend.yml run --rm backend npm run tsoa --verbose;fi
	@export EXEC_ENV=development; export BACKEND_LOG_LEVEL=error; \
		${DC_BACKEND} -f ${DC_FILE}-dev-backend.yml run --rm backend npm run ${BACKEND_TEST_SCRIPT} --verbose

${BACKEND_PATH}/tests/clients_test.csv:
	curl -L https://github.com/matchID-project/examples/raw/master/data/clients_test.csv -o ${BACKEND_PATH}/tests/clients_test.csv

# test artillery
test-perf-v1:
	make -C ${TOOLS_PATH} test-api-generic PERF_SCENARIO=${PERF_SCENARIO_V1} PERF_TEST_ENV=api-perf PERF_REPORTS=${PERF_REPORTS} DC_NETWORK=${DC_NETWORK} PERF_NAMES=${PERF_NAMES};

backend-perf-clinic:
	@echo Start API in clinic mode
	@export EXEC_ENV=production; export BACKEND_LOG_LEVEL=debug; \
		${DC_BACKEND} run -v ${BACKEND_PATH}/clinic:/${APP_BACKEND}/clinic/ -d -e BACKEND_TMP_MAX='100000' --rm --name deces-backend --use-aliases backend /bin/sh -c "apk --no-cache add npm && npm install clinic && NO_INSIGHT=true ./node_modules/.bin/clinic doctor -- node dist/index.js && mkdir -p clinic && cp -r /${APP_BACKEND}/.clinic/* /${APP_BACKEND}/clinic"
	@timeout=${BULK_TIMEOUT} ; ret=1 ;\
		until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do\
			(docker exec -i ${USE_TTY} `docker ps -l --format "{{.Names}}" --filter name=deces-backend` curl -s --fail -X GET http://localhost:${BACKEND_PORT}/deces/api/v1/version > /dev/null) ;\
			ret=$$? ;\
			if [ "$$ret" -ne "0" ] ; then\
				echo -e "try still $$timeout seconds to start backend before timeout" ;\
			fi ;\
			((timeout--)); sleep 1 ;\
		done ;\
	echo -e "backend started in $$((BULK_TIMEOUT - timeout)) seconds"; exit $$ret

backend-perf-clinic-stop:
	@echo Stop backend development container
	@docker exec `docker ps -l --format "{{.Names}}" --filter name=deces-backend` /bin/sh -c "kill -INT \`pidof node\`"
	@docker logs --tail 5 `docker ps -l --format "{{.Names}}" --filter name=deces-backend` -f
	@ls -R ${BACKEND_PATH}/clinic

# development mode
backend-dev: ${WIKIDATA_LINKS} ${COMMUNES_JSON} ${DISPOSABLE_MAIL} ${DB_JSON} ${PROOFS} ${JOBS} backend-redis backend-smtp
	@echo docker-compose up backend for dev
	@export EXEC_ENV=development;\
		${DC_BACKEND} -f ${DC_FILE}-dev-backend.yml up --build -d --force-recreate 2>&1 | grep -v orphan
	@timeout=${BACKEND_TIMEOUT} ; ret=1 ;\
		until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do\
			(curl --noproxy '*' -s --fail -X GET "http://localhost:${BACKEND_PORT}/deces/api/v1/version" > /dev/null) ;\
			ret=$$? ;\
			if [ "$$ret" -ne "0" ] ; then\
				echo -e "try still $$timeout seconds to start backend-dev before timeout" ;\
			fi ;\
			((timeout--)); sleep 1 ;\
		done ;\
	echo -e "backend-dev started in $$((BACKEND_TIMEOUT - timeout)) seconds"; exit $$ret

backend-dev-stop:
	@export EXEC_ENV=development; ${DC_BACKEND} -f ${DC_FILE}-dev-backend.yml down

backend-dev-ps:
	@export EXEC_ENV=development; ${DC_BACKEND} -f ${DC_FILE}-dev-backend.yml ps

backend-dev-logs:
	@export EXEC_ENV=development; ${DC_BACKEND} -f ${DC_FILE}-dev-backend.yml logs --tail=200 backend

backend-dev-test: backend-dev
	@echo Testing API parameters
	@docker exec -i ${USE_TTY} ${APP_BACKEND}-development sh /deces-backend/tests/test_query_params.sh


# download wikidata test data
${WIKIDATA_SRC}:
	@echo "downloading wikidata set of died french people...";\
	(curl -s -f -G 'https://query.wikidata.org/sparql'      --header "Accept: text/csv"       --data-urlencode query="\
		select ?person  ?personLabel ?firstnameLabel ?id ?lastnameLabel ?birthdateLabel ?birthplaceLabel ?citizenshipLabel ?diedLabel where {\
		?person wdt:P27 wd:Q142.\
		?person wdt:P734 ?lastname.\
		?person wdt:P735 ?firstname.\
		?person wdt:P569 ?birthdate.\
		?person wdt:P27 ?citizenship.\
		?person wdt:P19 ?birthplace.\
                OPTIONAL {?person wdt:P9058 ?id.}\
		?person wdt:P570 ?died;\
		FILTER((?died >= '1970-01-01T00:00:00Z'^^xsd:dateTime)  )\
		service wikibase:label { bd:serviceParam wikibase:language '[AUTO_LANGUAGE],en'. }\
		}\
		" | sed 's/T00:00:00Z//g;s|http://www.wikidata.org/entity/||;' > ${WIKIDATA_SRC}) \
		&& echo "done!"

${WIKIDATA_LINKS}:
	@set -euo pipefail; \
	echo "downloading wikidata and wikipedia links";\
	mkdir -p ${DATA_DIR};\
	attempts=5; ret=1; \
	while [ "$$attempts" -gt 0 ]; do \
		TMP_WIKIDATA_JSON=$$(mktemp "${DATA_DIR}/wikidata.XXXXXX.json"); \
		if curl --retry 5 --retry-all-errors -sS -f -G 'https://query.wikidata.org/sparql' --header "Accept: application/json" --data-urlencode query="\
			select ?sitelink ?person ?personDescription ?img ?id where {\
				?person wdt:P9058 ?id.\
				OPTIONAL { ?person wdt:P18 ?img. }\
				OPTIONAL { ?sitelink schema:isPartOf <https://fr.wikipedia.org/>;\
				  schema:about ?person;}\
				service wikibase:label { bd:serviceParam wikibase:language '[AUTO_LANGUAGE],fr'. }\
			}" |\
			jq -ce '[ .results.bindings[] | {wikidata: .person.value, label: .personDescription.value, wikimedia: .img.value, wikipedia: .sitelink.value, id: .id.value} | with_entries( select( .value != null )) ]' \
			> "$$TMP_WIKIDATA_JSON"; then \
			mv "$$TMP_WIKIDATA_JSON" ${WIKIDATA_LINKS}; \
			ret=0; \
			break; \
		fi; \
		rm -f "$$TMP_WIKIDATA_JSON"; \
		attempts=$$((attempts - 1)); \
		if [ "$$attempts" -gt 0 ]; then echo "retrying wikidata links download ($$attempts left)"; sleep 5; fi; \
	done; \
	exit $$ret

wikidata-src: ${WIKIDATA_SRC}

wikidata-links: ${WIKIDATA_LINKS}

communes-pull-datagouv:
	@echo "preparing communes geo data"
	@which ogr2ogr > /dev/null || sudo apt-get install gdal-bin
	@curl --retry 5 -L -l 'https://www.data.gouv.fr/fr/datasets/r/0e117c06-248f-45e5-8945-0e79d9136165' -o communes-20220101.zip
	@echo "finish downloading"
	@unzip -o  communes-20220101.zip  -d communes-20220101
	@ogr2ogr -f GeoJSON -s_srs EPSG:26917 -t_srs EPSG:4326 communes-20220101.json communes-20220101/communes-20220101.shp -simplify 0.001
	@rm -rf communes-20220101
	@mv communes-20220101.json ${COMMUNES_JSON}

communes-push: communes-pull-datagouv
	@make -C ${TOOLS_PATH} storage-push\
		FILE=${COMMUNES_JSON}\
		STORAGE_BUCKET=${STORAGE_BUCKET} STORAGE_ACCESS_KEY=${STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${STORAGE_SECRET_KEY};\

${COMMUNES_JSON}: config
	@echo "downloading communes geo data"
	@make -C ${TOOLS_PATH} storage-pull\
		FILE=communes.json DATA_DIR=$(abspath ${DATA_DIR})\
		STORAGE_BUCKET=${STORAGE_BUCKET} STORAGE_ACCESS_KEY=${STORAGE_ACCESS_KEY} STORAGE_SECRET_KEY=${STORAGE_SECRET_KEY};

communes-pull: ${COMMUNES_JSON}

communes: communes-pull

${DISPOSABLE_MAIL}: config
	@echo "preparing disposable mail resources"
	@curl --retry 5 -L -l 'https://raw.githubusercontent.com/unkn0w/disposable-email-domain-list/main/domains.txt' -o ${DISPOSABLE_MAIL}.tmp1
	@curl --retry 5 -L -l 'https://gist.githubusercontent.com/adamloving/4401361/raw/e81212c3caecb54b87ced6392e0a0de2b6466287/temporary-email-address-domains' -o ${DISPOSABLE_MAIL}.tmp2
	@curl --retry 5 -L -l 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt' -o ${DISPOSABLE_MAIL}.tmp3
	@curl --retry 5 -L -l 'https://raw.githubusercontent.com/FGRibreau/mailchecker/master/list.txt' -o ${DISPOSABLE_MAIL}.tmp4
	@cat ${DISPOSABLE_MAIL}.tmp1 ${DISPOSABLE_MAIL}.tmp2 ${DISPOSABLE_MAIL}.tmp3 ${DISPOSABLE_MAIL}.tmp4 | sort | uniq > ${DISPOSABLE_MAIL}
	@rm ${DISPOSABLE_MAIL}.tmp1 ${DISPOSABLE_MAIL}.tmp2 ${DISPOSABLE_MAIL}.tmp3 ${DISPOSABLE_MAIL}.tmp4

disposable-mail: ${DISPOSABLE_MAIL}

${PROOFS}:
	mkdir -p ${PROOFS}

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
	@pkill -f "make .*proofs-backu[p]" > /dev/null 2>&1 || true

${JOBS}:
	mkdir -p ${JOBS}

${DB_JSON}:
	@mkdir -p $(dir ${DB_JSON})
	@echo "initiating void db";\
	echo '{}' > ${DB_JSON}

db-json: ${DB_JSON}

backend-redis:
	@${MAKE} -C ${INFRA_PATH} redis

backend-redis-stop:
	@${MAKE} -C ${INFRA_PATH} redis-stop

backend-smtp:
	@${MAKE} -C ${INFRA_PATH} smtp

backend-smtp-stop:
	@${MAKE} -C ${INFRA_PATH} smtp-stop
