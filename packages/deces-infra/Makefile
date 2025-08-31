# Makefile for deces-infra
# Infrastructure services management (elasticsearch, redis, etc.)

# Infrastructure-specific variables
# INFRA_PATH is defined in the main Makefile

# Elasticsearch targets
elasticsearch-stop:
	@echo docker-compose down matchID elasticsearch
	@if [ -f "${INFRA_PATH}/docker-compose-elasticsearch.yml" ]; then ${DC} -f ${INFRA_PATH}/docker-compose-elasticsearch.yml down;fi

elasticsearch-repository-creds: elasticsearch-start
	@if [ ! -f "elasticsearch-repository-plugin" ]; then\
		echo installing elasticsearch repository plugin;\
		docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch sh -c \
			"echo ${STORAGE_ACCESS_KEY} | bin/elasticsearch-keystore add --stdin --force s3.client.default.access_key";\
		docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch sh -c \
			"echo ${STORAGE_SECRET_KEY} | bin/elasticsearch-keystore add --stdin --force s3.client.default.secret_key";\
		docker restart ${DC_PREFIX}-elasticsearch;\
		timeout=${ES_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch curl -s --fail -XGET localhost:9200/ > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ;\
		echo; touch elasticsearch-repository-creds ; exit $$ret;\
	fi;

elasticsearch-repository-config: elasticsearch-repository-creds
	@if [ ! -f "elasticsearch-repository-config" ]; then\
		echo creating elasticsearch repository ${APP_GROUP} in s3 bucket ${REPOSITORY_BUCKET} && \
		docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch \
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
		docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch \
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
		docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch \
			curl -s --fail -w '%{http_code}' -XPOST localhost:9200/_snapshot/${APP_GROUP}/$${ES_BACKUP_NAME}/_restore -H 'Content-Type: application/json'\
			-d '{"indices": "${ES_INDEX}","ignore_unavailable": true,"include_global_state": false}' \
	) && (echo "snapshot $${ES_BACKUP_NAME} restore initiated from elasticsearch repository" && touch elasticsearch-repository-restore) || (echo "snapshot $${ES_BACKUP_NAME} restore from elasticsearch repository failed with error $$STATUS" && echo  && exit 1)

elasticsearch-clean: elasticsearch-stop
	@rm -rf elasticsearch-repository-* ${ES_DATA} > /dev/null 2>&1 || true

elasticsearch-start: network vm_max
	@echo docker-compose up matchID elasticsearch with ${ES_NODES} nodes
	@(if [ ! -d ${ES_DATA}/node1 ]; then mkdir -p ${ES_DATA}/node1 ; chmod 2775 ${ES_DATA}/node1/. ; chown $(shell id -u):$(shell id -g) ${ES_DATA}/node1/. ; fi)
	${DC} -f ${INFRA_PATH}/docker-compose-elasticsearch.yml up -d

elasticsearch-check: elasticsearch-restore
	@timeout=${ES_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch curl -s --fail -XGET localhost:9200/ > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch API to start $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; exit $$ret

elasticsearch: elasticsearch-check

elasticsearch-index-readiness:
	@timeout=${ES_RESTORE_TIMEOUT} ; ret=1 ; until [ "$$timeout" -le 0 -o "$$ret" -eq "0"  ] ; do (docker exec -i ${USE_TTY} ${DC_PREFIX}-elasticsearch curl -s --fail -XGET localhost:9200/_cat/indices | grep -q green > /dev/null) ; ret=$$? ; if [ "$$ret" -ne "0" ] ; then echo -en "\rwaiting for elasticsearch index to be ready $$timeout" ; fi ; ((timeout--)); sleep 1 ; done ; echo ; exit $$ret

# Utility targets
vm_max:
	@sysctl vm.max_map_count | awk '($$NF >= 262144){print "ok"}' | grep -q 'ok' ||  sudo sysctl -w vm.max_map_count=262144

