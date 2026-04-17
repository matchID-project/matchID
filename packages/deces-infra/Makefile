# Makefile for deces-infra
# Infrastructure services management (elasticsearch, redis, etc.)

SHELL=/bin/bash

# Infrastructure-specific variables
export INFRA_PATH ?= $(shell pwd)
export MONOREPO_ROOT ?= $(abspath ${INFRA_PATH}/../..)
export DC ?= docker compose
export DC_NETWORK ?= matchid
export APP_GROUP ?= matchID
export APP_BACKEND ?= deces-backend
export DATA_DIR ?= $(abspath ${INFRA_PATH}/../../data)
export DATAPREP_VERSION_FILE ?= ${MONOREPO_ROOT}/.dataprep.sha1
export DATA_VERSION_FILE ?= ${MONOREPO_ROOT}/.data.sha1
export SCW_REGION ?= fr-par
export SCW_ENDPOINT ?= s3.fr-par.scw.cloud

# Elasticsearch configuration variables
export ES_HOST ?= elasticsearch
export ES_PORT ?= 9200
export ES_TIMEOUT ?= 60
export ES_RESTORE_TIMEOUT ?= 480
export ES_INDEX ?= deces
export ES_MAX_RESULTS ?= 10000
export ES_DATA ?= ${DATA_DIR}/esdata
export ES_NODES ?= 1
export ES_MEM ?= 512m
export ES_MMAP_DISABLED ?= false
export ES_UID ?= $(shell id -u)
export ES_GID ?= 0
export ES_JAVA_OPTS=$(strip -Xms${ES_MEM} -Xmx${ES_MEM} $(if $(filter true,$(ES_MMAP_DISABLED)),-Dnode.store.allow_mmap=false))
export ES_VERSION = 8.6.1
export ES_BACKUP_BASENAME := esdata
export ES_MEM_KUBE?=$(shell echo -n ${ES_MEM} | sed 's/\s*m/Mi/')
export REDIS_DATA ?= ${DATA_DIR}/redisdata
export REDIS_TIMEOUT ?= 30
export MAILDEV_UI_PORT ?= 1080
export ES_EXPORT_CONTAINER ?= deces-elasticsearch
export ES_COUNT_FILE ?=
export ES_SAMPLE_FILE ?=
export ES_SAMPLE_SIZE ?= 1000
export ES_SAMPLE_SEED ?= 424242
export BACKUP_TIMEOUT ?= 1800

# Elasticsearch targets
elasticsearch-stop:
	@echo docker-compose down matchID elasticsearch
	@if [ -f "${INFRA_PATH}/docker-compose-elasticsearch.yml" ]; then ${DC} -f ${INFRA_PATH}/docker-compose-elasticsearch.yml down;fi

elasticsearch-repository-creds: elasticsearch-start
	@if [ ! -f "elasticsearch-repository-plugin" ]; then\
		echo installing elasticsearch repository plugin;\
		docker exec -i ${USE_TTY} deces-elasticsearch sh -c \
			"echo ${STORAGE_ACCESS_KEY} | bin/elasticsearch-keystore add --stdin --force s3.client.default.access_key";\
		docker exec -i ${USE_TTY} deces-elasticsearch sh -c \
			"echo ${STORAGE_SECRET_KEY} | bin/elasticsearch-keystore add --stdin --force s3.client.default.secret_key";\
		docker restart deces-elasticsearch;\
		timeout=${ES_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} deces-elasticsearch curl -s --fail -XGET localhost:9200/ > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ;\
		echo; touch elasticsearch-repository-creds ; exit $$ret;\
	fi;

elasticsearch-repository-config: elasticsearch-repository-creds
	@echo ensuring elasticsearch repository ${APP_GROUP} in s3 bucket ${REPOSITORY_BUCKET} && \
	docker exec -i ${USE_TTY} deces-elasticsearch \
		curl -s -XPUT "localhost:9200/_snapshot/${APP_GROUP}" -H 'Content-Type: application/json' \
		-d '{"type": "s3","settings": {"bucket": "${REPOSITORY_BUCKET}","client": "default","region": "${SCW_REGION}","endpoint": "${SCW_ENDPOINT}","path_style_access": true,"protocol": "https"}}' \
		| grep -q '"acknowledged":true' && touch elasticsearch-repository-config

elasticsearch-freeze: elasticsearch-local
	@docker exec -i ${USE_TTY} deces-elasticsearch \
		curl -s -XPUT "localhost:9200/${ES_INDEX}/_settings" -H 'Content-Type: application/json' \
			-d '{"index":{"blocks.write": true}}' | grep -q '"acknowledged":true' \
	&& echo "index ${ES_INDEX} frozen" \
	|| (echo "index ${ES_INDEX} freeze failed" && exit 1)

elasticsearch-repository-backup: elasticsearch-repository-config elasticsearch-freeze
	@if [ -z "${ES_BACKUP_NAME}" ]; then\
		echo "ES_BACKUP_NAME is required";\
		exit 1;\
	fi
	@STATUS=$$(docker exec -i ${USE_TTY} deces-elasticsearch curl -s -o /dev/null -w '%{http_code}' -XDELETE "localhost:9200/_snapshot/${APP_GROUP}/${ES_BACKUP_NAME}");\
	if [ "$$STATUS" = "200" ]; then\
		echo "snapshot ${ES_BACKUP_NAME} deleted from elasticsearch repository";\
	elif [ "$$STATUS" != "404" ]; then\
		echo "snapshot ${ES_BACKUP_NAME} delete failed with HTTP $$STATUS";\
		exit 1;\
	fi
	@docker exec -i ${USE_TTY} deces-elasticsearch \
		curl -s -XPUT "localhost:9200/_snapshot/${APP_GROUP}/${ES_BACKUP_NAME}" -H 'Content-Type: application/json'\
			-d '{"indices": "${ES_INDEX}", "ignore_unavailable": true, "include_global_state": false}' \
	| grep -q '{"accepted":true}';\
	if [ "$$?" -ne "0" ]; then\
		echo "snapshot ${ES_BACKUP_NAME} creation failed";\
		exit 1;\
	fi;\
	echo -n "creating snapshot ${ES_BACKUP_NAME} in elasticsearch repository";\
	timeout=${BACKUP_TIMEOUT} ; ret=1 ; dot_count=0 ;\
	until [ "$$timeout" -le 0 -o "$$ret" -eq "0" ] ; do\
		docker exec -i ${USE_TTY} deces-elasticsearch \
			curl -s -XGET "localhost:9200/_snapshot/${APP_GROUP}/${ES_BACKUP_NAME}"\
		| grep -q '"state":"SUCCESS"';\
		ret=$$? ;\
		if [ "$$ret" -ne "0" ]; then\
			echo -en "." ;\
			((dot_count++));\
			if [ "$$dot_count" -gt "10" ]; then\
				echo -en "\rwaiting for snapshot ${ES_BACKUP_NAME} to complete $$timeout" ;\
				dot_count=0;\
			fi;\
		fi;\
		((timeout--)); ((timeout--)); sleep 2;\
	done ; echo ;\
	if [ "$$ret" -ne "0" ]; then\
		echo "snapshot ${ES_BACKUP_NAME} creation failed";\
		exit $$ret;\
	fi;\
	echo "snapshot ${ES_BACKUP_NAME} created in elasticsearch repository"

elasticsearch-repository-delete: elasticsearch-repository-config
	@STATUS=$$(docker exec -i ${USE_TTY} deces-elasticsearch curl -s -o /dev/null -w '%{http_code}' -XDELETE "localhost:9200/_snapshot/${APP_GROUP}/${ES_BACKUP_NAME}");\
	if [ "$$STATUS" = "200" ] || [ "$$STATUS" = "404" ]; then\
		echo "snapshot ${ES_BACKUP_NAME} deleted or absent from elasticsearch repository";\
	else\
		echo "snapshot ${ES_BACKUP_NAME} delete failed with HTTP $$STATUS";\
		exit 1;\
	fi

elasticsearch-repository-list: elasticsearch-repository-config
	@docker exec -i ${USE_TTY} deces-elasticsearch \
		curl -s -XGET "localhost:9200/_snapshot/${APP_GROUP}/_all" \
	| jq -r '.snapshots[].snapshot'

elasticsearch-restore: elasticsearch-repository-config
	@\
	if [ -z "${ES_BACKUP_NAME}" ]; then\
		${MAKE} -C ${MONOREPO_ROOT} ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE} ${MAKEOVERRIDES};\
		DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
		DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
		ES_BACKUP_NAME=${ES_BACKUP_BASENAME}_$${DATAPREP_VERSION}_$${DATA_VERSION};\
	else\
		ES_BACKUP_NAME=${ES_BACKUP_NAME};\
	fi;\
	echo restoring snapshot $${ES_BACKUP_NAME} from elasticsearch repository;\
	(\
		docker exec -i ${USE_TTY} deces-elasticsearch \
			curl -s -XPOST localhost:9200/_snapshot/${APP_GROUP}/$${ES_BACKUP_NAME}/_restore?wait_for_completion=true -H 'Content-Type: application/json'\
			-d '{"indices": "${ES_INDEX}","ignore_unavailable": true,"include_global_state": false}' \
		> /dev/null 2>&1\
	) && echo "snapshot $${ES_BACKUP_NAME} restored from elasticsearch repository" && touch elasticsearch-restore

elasticsearch-restore-async: elasticsearch-repository-config
	@\
	if [ -z "${ES_BACKUP_NAME}" ]; then\
		${MAKE} -C ${MONOREPO_ROOT} ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE} ${MAKEOVERRIDES};\
		DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
		DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
		ES_BACKUP_NAME=${ES_BACKUP_BASENAME}_$${DATAPREP_VERSION}_$${DATA_VERSION};\
	else\
		ES_BACKUP_NAME=${ES_BACKUP_NAME};\
	fi;\
	echo restoring snapshot $${ES_BACKUP_NAME} from elasticsearch repository;\
	STATUS=$$(\
		docker exec -i ${USE_TTY} deces-elasticsearch \
			curl -s --fail -w '%{http_code}' -XPOST localhost:9200/_snapshot/${APP_GROUP}/$${ES_BACKUP_NAME}/_restore -H 'Content-Type: application/json'\
			-d '{"indices": "${ES_INDEX}","ignore_unavailable": true,"include_global_state": false}' \
	) && (echo "snapshot $${ES_BACKUP_NAME} restore initiated from elasticsearch repository" && touch elasticsearch-repository-restore) || (echo "snapshot $${ES_BACKUP_NAME} restore from elasticsearch repository failed with error $$STATUS" && echo  && exit 1)

elasticsearch-clean: elasticsearch-stop
	@rm -rf elasticsearch-repository-* ${ES_DATA} > /dev/null 2>&1 || true

elasticsearch-start: infra-network vm_max
	@echo docker-compose up matchID elasticsearch with ${ES_NODES} nodes
	@if docker ps --format '{{.Names}}' | grep -qx 'deces-elasticsearch'; then\
		echo "reusing running elasticsearch deces-elasticsearch";\
	else\
		(if [ ! -d ${ES_DATA}/node1 ]; then mkdir -p ${ES_DATA}/node1 ; chmod 2775 ${ES_DATA}/node1/. ; chown $(shell id -u):$(shell id -g) ${ES_DATA}/node1/. ; fi);\
		${DC} -f ${INFRA_PATH}/docker-compose-elasticsearch.yml up -d;\
	fi

elasticsearch-local: elasticsearch-start
	@timeout=${ES_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} deces-elasticsearch curl -s --fail -XGET localhost:9200/ > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch API to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; if [ "$$ret" -ne "0" ] ; then ${MAKE} --no-print-directory -C ${INFRA_PATH} elasticsearch-debug-info ; fi ; exit $$ret

elasticsearch-debug-info:
	@echo "elasticsearch status:"
	@docker ps -a --filter "name=^/deces-elasticsearch$$" --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'
	@if docker inspect deces-elasticsearch > /dev/null 2>&1; then\
		echo "elasticsearch inspect:";\
		docker inspect -f 'status={{.State.Status}} exit={{.State.ExitCode}} restarting={{.State.Restarting}} oomkilled={{.State.OOMKilled}} error={{.State.Error}} restart_count={{.RestartCount}}' deces-elasticsearch;\
		echo "elasticsearch recent logs:";\
		docker logs --tail=200 deces-elasticsearch || true;\
	fi

elasticsearch-check: elasticsearch-restore
	@timeout=${ES_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} deces-elasticsearch curl -s --fail -XGET localhost:9200/ > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch API to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; exit $$ret

elasticsearch: elasticsearch-check

elasticsearch-index-readiness:
	@timeout=${ES_RESTORE_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} deces-elasticsearch curl -s --fail -XGET localhost:9200/_cat/indices | grep -q green > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch index to be ready $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; exit $$ret

elasticsearch-index-delete: elasticsearch-local
	@STATUS=$$(docker exec -i ${USE_TTY} deces-elasticsearch curl -s -o /dev/null -w '%{http_code}' -XDELETE localhost:9200/${ES_INDEX});\
	if [ "$$STATUS" = "200" ] || [ "$$STATUS" = "404" ]; then\
		echo "index ${ES_INDEX} deleted or absent";\
	else\
		echo "failed to delete index ${ES_INDEX} (HTTP $$STATUS)";\
		exit 1;\
	fi

elasticsearch-index-delete-local:
	@STATUS=$$(docker exec -i ${USE_TTY} deces-elasticsearch curl -s -o /dev/null -w '%{http_code}' -XDELETE localhost:9200/${ES_INDEX});\
	if [ "$$STATUS" = "200" ] || [ "$$STATUS" = "404" ]; then\
		echo "index ${ES_INDEX} deleted or absent";\
	else\
		echo "failed to delete index ${ES_INDEX} (HTTP $$STATUS)";\
		exit 1;\
	fi

elasticsearch-index-export: elasticsearch-local
	@if [ -z "${ES_COUNT_FILE}" ] || [ -z "${ES_SAMPLE_FILE}" ]; then\
		echo "ES_COUNT_FILE and ES_SAMPLE_FILE are required";\
		exit 1;\
	fi
	@python3 ${MONOREPO_ROOT}/scripts/export_es_index_snapshot.py \
		--container ${ES_EXPORT_CONTAINER} \
		--index ${ES_INDEX} \
		--count-file ${ES_COUNT_FILE} \
		--sample-file ${ES_SAMPLE_FILE} \
		--sample-size ${ES_SAMPLE_SIZE} \
		--seed ${ES_SAMPLE_SEED}

# Utility targets
vm_max:
	@sysctl vm.max_map_count | awk '($$NF >= 262144){print "ok"}' | grep -q 'ok' ||  sudo sysctl -w vm.max_map_count=262144

infra-network:
	@docker network create ${DC_NETWORK_OPT} ${DC_NETWORK} 2> /dev/null; true

redis-stop:
	@echo docker-compose down matchID redis
	@if [ -f "${INFRA_PATH}/docker-compose-redis.yml" ]; then ${DC} -f ${INFRA_PATH}/docker-compose-redis.yml down;fi
	@docker rm -f ${APP_BACKEND}-redis > /dev/null 2>&1 || true

redis: infra-network
	@echo docker-compose up matchID redis
	@mkdir -p ${REDIS_DATA}
	@docker rm -f ${APP_BACKEND}-redis > /dev/null 2>&1 || true
	${DC} -f ${INFRA_PATH}/docker-compose-redis.yml up -d
	@timeout=${REDIS_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do \
		(docker exec -i ${USE_TTY} ${APP_BACKEND}-redis redis-cli PING 2> /dev/null | grep -q PONG) ; \
		ret=$$? ; \
		if [ "$$ret" -ne "0" ] ; then \
			echo -en "\rwaiting for redis to start $$timeout" ; \
		fi ; \
		((timeout--)); sleep 1 ; \
	done ; echo ; exit $$ret

smtp-stop:
	@echo docker-compose down matchID smtp
	@if [ -f "${INFRA_PATH}/docker-compose-smtp.yml" ]; then ${DC} -f ${INFRA_PATH}/docker-compose-smtp.yml down;fi
	@docker rm -f deces-smtp-fake > /dev/null 2>&1 || true

smtp: infra-network
	@echo docker-compose up matchID smtp
	@docker rm -f deces-smtp-fake > /dev/null 2>&1 || true
	${DC} -f ${INFRA_PATH}/docker-compose-smtp.yml up -d
