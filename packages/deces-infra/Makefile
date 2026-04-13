# Makefile for deces-infra
# Infrastructure services management (elasticsearch, redis, etc.)

# Infrastructure-specific variables
export INFRA_PATH ?= $(shell pwd)
export DC ?= docker compose
export DC_NETWORK ?= matchid
export APP_BACKEND ?= deces-backend
export DATA_DIR ?= $(abspath ${INFRA_PATH}/../../data)

# Elasticsearch configuration variables
export ES_HOST = elasticsearch
export ES_PORT = 9200
export ES_TIMEOUT = 60
export ES_RESTORE_TIMEOUT = 480
export ES_INDEX = deces
export ES_MAX_RESULTS = 10000
export ES_DATA = ${DATA_DIR}/esdata
export ES_NODES = 1
export ES_MEM = 512m
export ES_JAVA_OPTS=-Xms${ES_MEM} -Xmx${ES_MEM}
export ES_VERSION = 8.6.1
export ES_BACKUP_BASENAME := esdata
export ES_MEM_KUBE?=$(shell echo -n ${ES_MEM} | sed 's/\s*m/Mi/')
export REDIS_DATA ?= ${DATA_DIR}/redisdata
export MAILDEV_UI_PORT ?= 1080

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
	@if [ ! -f "elasticsearch-repository-config" ]; then\
		echo creating elasticsearch repository ${APP_GROUP} in s3 bucket ${REPOSITORY_BUCKET} && \
		docker exec -i ${USE_TTY} deces-elasticsearch \
			curl -s -XPUT "localhost:9200/_snapshot/${APP_GROUP}" -H 'Content-Type: application/json' \
			-d '{"type": "s3","settings": {"bucket": "${REPOSITORY_BUCKET}","client": "default","region": "${SCW_REGION}","endpoint": "${SCW_ENDPOINT}","path_style_access": true,"protocol": "https"}}' \
			| grep -q '"acknowledged":true' && touch elasticsearch-repository-config;\
	fi

elasticsearch-restore: elasticsearch-repository-config ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	ES_BACKUP_NAME=${ES_BACKUP_BASENAME}_$${DATAPREP_VERSION}_$${DATA_VERSION};\
	echo restoring snapshot $${ES_BACKUP_NAME} from elasticsearch repository;\
	(\
		docker exec -i ${USE_TTY} deces-elasticsearch \
			curl -s -XPOST localhost:9200/_snapshot/${APP_GROUP}/$${ES_BACKUP_NAME}/_restore?wait_for_completion=true -H 'Content-Type: application/json'\
			-d '{"indices": "${ES_INDEX}","ignore_unavailable": true,"include_global_state": false}' \
		> /dev/null 2>&1\
	) && echo "snapshot $${ES_BACKUP_NAME} restored from elasticsearch repository" && touch elasticsearch-restore

elasticsearch-restore-async: elasticsearch-repository-config ${DATAPREP_VERSION_FILE} ${DATA_VERSION_FILE}
	@\
	DATAPREP_VERSION=$$(cat ${DATAPREP_VERSION_FILE});\
	DATA_VERSION=$$(cat ${DATA_VERSION_FILE});\
	ES_BACKUP_NAME=${ES_BACKUP_BASENAME}_$${DATAPREP_VERSION}_$${DATA_VERSION};\
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
	@(if [ ! -d ${ES_DATA}/node1 ]; then mkdir -p ${ES_DATA}/node1 ; chmod 2775 ${ES_DATA}/node1/. ; chown $(shell id -u):$(shell id -g) ${ES_DATA}/node1/. ; fi)
	${DC} -f ${INFRA_PATH}/docker-compose-elasticsearch.yml up -d

elasticsearch-local: elasticsearch-start
	@timeout=${ES_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} deces-elasticsearch curl -s --fail -XGET localhost:9200/ > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch API to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; exit $$ret

elasticsearch-check: elasticsearch-restore
	@timeout=${ES_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} deces-elasticsearch curl -s --fail -XGET localhost:9200/ > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch API to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; exit $$ret

elasticsearch: elasticsearch-check

elasticsearch-index-readiness:
	@timeout=${ES_RESTORE_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} deces-elasticsearch curl -s --fail -XGET localhost:9200/_cat/indices | grep -q green > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch index to be ready $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; exit $$ret

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

smtp-stop:
	@echo docker-compose down matchID smtp
	@if [ -f "${INFRA_PATH}/docker-compose-smtp.yml" ]; then ${DC} -f ${INFRA_PATH}/docker-compose-smtp.yml down;fi
	@docker rm -f deces-smtp-fake > /dev/null 2>&1 || true

smtp: infra-network
	@echo docker-compose up matchID smtp
	@docker rm -f deces-smtp-fake > /dev/null 2>&1 || true
	${DC} -f ${INFRA_PATH}/docker-compose-smtp.yml up -d
