# Make targets for the matchID k8s scaffold.
# Intentionally minimal — no cross-talk with the root Makefile, no
# tags/version logic. Drive locally with:
#   make -C deploy/k8s k3d-up
#   make -C deploy/k8s apply-local
#   make -C deploy/k8s port-forward

CLUSTER_NAME ?= matchid
KUBE_CTX     ?= k3d-$(CLUSTER_NAME)
NAMESPACE    ?= matchid
UI_LOCAL_PORT ?= 8083
BACKEND_LOCAL_PORT ?= 8080
ROOT_DIR := $(abspath ../..)

-include $(ROOT_DIR)/packages/tools/artifacts.SCW
-include $(ROOT_DIR)/artifacts

API_EMAIL ?= contact@matchid.io
BACKEND_TOKEN_USER ?= matchid.project@gmail.com
K8S_SMTP_PORT ?= 2587
REPOSITORY_BUCKET ?= fichier-des-personnes-decedees-elasticsearch
FORCE_RESTORE ?= false

BACKEND_SECRET_NAME ?= deces-backend-secrets
BACKEND_SECRET_REQUIRED_KEYS := \
	API_EMAIL \
	BACKEND_TOKEN_KEY \
	BACKEND_TOKEN_PASSWORD \
	BACKEND_TOKEN_USER \
	SMTP_HOST \
	SMTP_PORT \
	SMTP_USER \
	SMTP_PWD
BACKEND_SECRET_KEYS := \
	$(BACKEND_SECRET_REQUIRED_KEYS) \
	SMTP_TLS_SELFSIGNED

LOG_FORWARDER_SECRET_NAME ?= matchid-log-forwarder-secrets
LOG_STORAGE_ACCESS_KEY ?= $(if $(TOOLS_STORAGE_ACCESS_KEY),$(TOOLS_STORAGE_ACCESS_KEY),$(STORAGE_ACCESS_KEY))
LOG_STORAGE_SECRET_KEY ?= $(if $(TOOLS_STORAGE_SECRET_KEY),$(TOOLS_STORAGE_SECRET_KEY),$(STORAGE_SECRET_KEY))
LOG_BUCKET_PATH := $(patsubst %/,%,$(LOG_BUCKET))
LOG_S3_BUCKET ?= $(word 1,$(subst /, ,$(LOG_BUCKET_PATH)))
LOG_S3_PREFIX_BASE := $(if $(findstring /,$(LOG_BUCKET_PATH)),$(patsubst $(LOG_S3_BUCKET)/%,%,$(LOG_BUCKET_PATH)),)
LOG_S3_PREFIX ?= $(if $(LOG_S3_PREFIX_BASE),$(LOG_S3_PREFIX_BASE)/k8s/$(NAMESPACE),k8s/$(NAMESPACE))
LOG_FORWARDER_SECRET_REQUIRED_KEYS := \
	LOG_BUCKET \
	LOG_STORAGE_ACCESS_KEY \
	LOG_STORAGE_SECRET_KEY \
	NEW_RELIC_INGEST_KEY

PROOFS_STORAGE_SECRET_NAME ?= deces-proofs-storage
PROOFS_GIT_BRANCH ?= main
PROOFS_STORAGE_ACCESS_KEY ?= $(if $(TOOLS_STORAGE_ACCESS_KEY),$(TOOLS_STORAGE_ACCESS_KEY),$(STORAGE_ACCESS_KEY))
PROOFS_STORAGE_SECRET_KEY ?= $(if $(TOOLS_STORAGE_SECRET_KEY),$(TOOLS_STORAGE_SECRET_KEY),$(STORAGE_SECRET_KEY))
PROOFS_STORAGE_SECRET_REQUIRED_KEYS := \
	PROOFS_BUCKET \
	PROOFS_STORAGE_ACCESS_KEY \
	PROOFS_STORAGE_SECRET_KEY
PROOFS_STORAGE_SECRET_KEYS := \
	$(PROOFS_STORAGE_SECRET_REQUIRED_KEYS) \
	PROOFS_GIT_BRANCH

USERDB_SECRET_NAME ?= deces-backend-userdb
USERDB_SECRET_REQUIRED_KEYS := \
	DECES_BACKEND_USERDB_JSON

ELASTICSEARCH_S3_SECRET_NAME ?= elasticsearch-s3-secrets
ELASTICSEARCH_RESTORE_SECRET_NAME ?= elasticsearch-restore-secrets
ELASTICSEARCH_S3_SECRET_REQUIRED_KEYS := \
	STORAGE_ACCESS_KEY \
	STORAGE_SECRET_KEY
ELASTICSEARCH_RESTORE_SECRET_REQUIRED_KEYS := \
	SNAPSHOT_NAME \
	STORAGE_ACCESS_KEY \
	STORAGE_SECRET_KEY \
	REPOSITORY_BUCKET
ELASTICSEARCH_RESTORE_SECRET_KEYS := \
	$(ELASTICSEARCH_RESTORE_SECRET_REQUIRED_KEYS) \
	FORCE_RESTORE

PROD_SECRET_REQUIRED_KEYS := \
	$(BACKEND_SECRET_REQUIRED_KEYS) \
	$(LOG_FORWARDER_SECRET_REQUIRED_KEYS) \
	$(PROOFS_STORAGE_SECRET_REQUIRED_KEYS) \
	$(USERDB_SECRET_REQUIRED_KEYS) \
	$(ELASTICSEARCH_S3_SECRET_REQUIRED_KEYS)

export $(BACKEND_SECRET_KEYS) $(LOG_FORWARDER_SECRET_REQUIRED_KEYS) $(PROOFS_STORAGE_SECRET_KEYS) $(USERDB_SECRET_REQUIRED_KEYS) $(ELASTICSEARCH_S3_SECRET_REQUIRED_KEYS) $(ELASTICSEARCH_RESTORE_SECRET_KEYS) LOG_S3_BUCKET LOG_S3_PREFIX

.PHONY: help k3d-up k3d-down backend-secrets-preflight backend-secrets log-forwarder-secrets-preflight log-forwarder-secrets proofs-storage-secrets-preflight proofs-storage-secrets userdb-seed-secret-preflight userdb-seed-secret elasticsearch-s3-secrets-preflight elasticsearch-s3-secrets prod-runtime-secrets-preflight prod-runtime-secrets prod-restore-preflight prod-restore-secrets prod-secrets-preflight prod-secrets apply-local apply-poc apply-dev apply-prod apply-test port-forward logs status

help:
	@echo "matchID k8s — local k3s scaffold"
	@echo ""
	@echo "  make k3d-up           Create a k3d cluster '$(CLUSTER_NAME)' with NodePort mappings"
	@echo "  make k3d-down         Tear the k3d cluster down"
	@echo "  make backend-secrets  Apply $(BACKEND_SECRET_NAME) from root artifacts/env and restart backend"
	@echo "  make log-forwarder-secrets  Apply $(LOG_FORWARDER_SECRET_NAME) from root artifacts/env"
	@echo "  make proofs-storage-secrets  Apply $(PROOFS_STORAGE_SECRET_NAME) for proofs restore/backup"
	@echo "  make userdb-seed-secret  Apply $(USERDB_SECRET_NAME) from DECES_BACKEND_USERDB_JSON"
	@echo "  make prod-restore-secrets  Apply Elasticsearch restore snapshot/storage secrets"
	@echo "  make prod-runtime-secrets  Apply prod runtime secrets that restart backend/log forwarder"
	@echo "  make prod-secrets     Apply all prod runtime + ES storage secrets for matchid-prod"
	@echo "  make apply-local      kubectl apply -k overlays/local/  (k3d / k3s-local)"
	@echo "  make apply-poc        kubectl apply -k overlays/poc/    (Scaleway Kapsule poc)"
	@echo "  make apply-dev        kubectl apply -k overlays/dev/    (namespace matchid-dev)"
	@echo "  make apply-prod       kubectl apply -k overlays/prod/   (namespace matchid-prod)"
	@echo "  make apply-test       kubectl apply -k overlays/test/   (namespace matchid-test, 0 at rest)"
	@echo "  make port-forward     Port-forward UI:$(UI_LOCAL_PORT) and backend:$(BACKEND_LOCAL_PORT)"
	@echo "  make logs             Tail logs from all matchid pods"
	@echo "  make status           Show namespace, pods, services, PVCs"

k3d-up:
	@command -v k3d >/dev/null 2>&1 || { \
	  echo "k3d not installed. Install:"; \
	  echo "  curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"; \
	  exit 1; }
	k3d cluster create $(CLUSTER_NAME) \
	  --port "$(UI_LOCAL_PORT):30083@loadbalancer" \
	  --port "$(BACKEND_LOCAL_PORT):30080@loadbalancer" \
	  --wait

k3d-down:
	k3d cluster delete $(CLUSTER_NAME)

backend-secrets-preflight:
	@missing=0; \
	for var in $(BACKEND_SECRET_REQUIRED_KEYS); do \
	  eval "value=\$${$${var}-}"; \
	  if [ -z "$$value" ]; then \
	    echo "missing $$var"; \
	    missing=1; \
	  fi; \
	done; \
	exit $$missing

backend-secrets: backend-secrets-preflight
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for $(NAMESPACE)"; \
	  exit 1; \
	fi
	@tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$tmp"' EXIT; \
	for var in $(BACKEND_SECRET_KEYS); do \
	  if [ "$$var" = "SMTP_PORT" ] && [ -n "$(K8S_SMTP_PORT)" ]; then \
	    value="$(K8S_SMTP_PORT)"; \
	  else \
	    eval "value=\$${$${var}-}"; \
	  fi; \
	  printf '%s' "$$value" > "$$tmp/$$var"; \
	done; \
	kubectl -n "$(NAMESPACE)" create secret generic "$(BACKEND_SECRET_NAME)" \
	  $(foreach var,$(BACKEND_SECRET_KEYS),--from-file=$(var)="$$tmp/$(var)") \
	  --dry-run=client -o yaml | kubectl apply -f -; \
	if kubectl -n "$(NAMESPACE)" get deploy/deces-backend >/dev/null 2>&1; then \
	  kubectl -n "$(NAMESPACE)" rollout restart deploy/deces-backend; \
	fi

log-forwarder-secrets-preflight:
	@missing=0; \
	for var in $(LOG_FORWARDER_SECRET_REQUIRED_KEYS); do \
	  eval "value=\$${$${var}-}"; \
	  if [ -z "$$value" ]; then \
	    echo "missing $$var"; \
	    missing=1; \
	  fi; \
	done; \
	if [ -z "$$LOG_S3_BUCKET" ]; then \
	  echo "missing LOG_S3_BUCKET"; \
	  missing=1; \
	fi; \
	if [ -z "$$LOG_S3_PREFIX" ]; then \
	  echo "missing LOG_S3_PREFIX"; \
	  missing=1; \
	fi; \
	exit $$missing

log-forwarder-secrets: log-forwarder-secrets-preflight
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for $(NAMESPACE)"; \
	  exit 1; \
	fi
	@tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$tmp"' EXIT; \
	printf '%s' "$$LOG_S3_BUCKET" > "$$tmp/LOG_S3_BUCKET"; \
	printf '%s' "$$LOG_S3_PREFIX" > "$$tmp/LOG_S3_PREFIX"; \
	printf '%s' "$$LOG_STORAGE_ACCESS_KEY" > "$$tmp/AWS_ACCESS_KEY_ID"; \
	printf '%s' "$$LOG_STORAGE_SECRET_KEY" > "$$tmp/AWS_SECRET_ACCESS_KEY"; \
	printf '%s' "$$NEW_RELIC_INGEST_KEY" > "$$tmp/NEW_RELIC_INGEST_KEY"; \
	kubectl -n "$(NAMESPACE)" create secret generic "$(LOG_FORWARDER_SECRET_NAME)" \
	  --from-file=LOG_S3_BUCKET="$$tmp/LOG_S3_BUCKET" \
	  --from-file=LOG_S3_PREFIX="$$tmp/LOG_S3_PREFIX" \
	  --from-file=AWS_ACCESS_KEY_ID="$$tmp/AWS_ACCESS_KEY_ID" \
	  --from-file=AWS_SECRET_ACCESS_KEY="$$tmp/AWS_SECRET_ACCESS_KEY" \
	  --from-file=NEW_RELIC_INGEST_KEY="$$tmp/NEW_RELIC_INGEST_KEY" \
	  --dry-run=client -o yaml | kubectl apply -f -; \
	if kubectl -n "$(NAMESPACE)" get ds/matchid-log-forwarder >/dev/null 2>&1; then \
	  kubectl -n "$(NAMESPACE)" rollout restart ds/matchid-log-forwarder; \
	fi

proofs-storage-secrets-preflight:
	@missing=0; \
	for var in $(PROOFS_STORAGE_SECRET_REQUIRED_KEYS); do \
	  eval "value=\$${$${var}-}"; \
	  if [ -z "$$value" ]; then \
	    echo "missing $$var"; \
	    missing=1; \
	  fi; \
	done; \
	exit $$missing

proofs-storage-secrets: proofs-storage-secrets-preflight
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for $(NAMESPACE)"; \
	  exit 1; \
	fi
	@tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$tmp"' EXIT; \
	for var in $(PROOFS_STORAGE_SECRET_KEYS); do \
	  eval "value=\$${$${var}-}"; \
	  printf '%s' "$$value" > "$$tmp/$$var"; \
	done; \
	kubectl -n "$(NAMESPACE)" create secret generic "$(PROOFS_STORAGE_SECRET_NAME)" \
	  $(foreach var,$(PROOFS_STORAGE_SECRET_KEYS),--from-file=$(var)="$$tmp/$(var)") \
	  --dry-run=client -o yaml | kubectl apply -f -

userdb-seed-secret-preflight:
	@missing=0; \
	for var in $(USERDB_SECRET_REQUIRED_KEYS); do \
	  eval "value=\$${$${var}-}"; \
	  if [ -z "$$value" ]; then \
	    echo "missing $$var"; \
	    missing=1; \
	  fi; \
	done; \
	if [ "$$missing" -eq 0 ]; then \
	  printf '%s' "$$DECES_BACKEND_USERDB_JSON" | jq -e 'type == "object" and length > 0 and all(.[]; type == "string" and length > 0)' >/dev/null || { \
	    echo "invalid DECES_BACKEND_USERDB_JSON"; \
	    missing=1; \
	  }; \
	fi; \
	exit $$missing

userdb-seed-secret: userdb-seed-secret-preflight
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for $(NAMESPACE)"; \
	  exit 1; \
	fi
	@tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$tmp"' EXIT; \
	printf '%s' "$$DECES_BACKEND_USERDB_JSON" > "$$tmp/userDB.json"; \
	kubectl -n "$(NAMESPACE)" create secret generic "$(USERDB_SECRET_NAME)" \
	  --from-file=userDB.json="$$tmp/userDB.json" \
	  --dry-run=client -o yaml | kubectl apply -f -; \
	if kubectl -n "$(NAMESPACE)" get deploy/deces-backend >/dev/null 2>&1; then \
	  kubectl -n "$(NAMESPACE)" rollout restart deploy/deces-backend; \
	fi

elasticsearch-s3-secrets-preflight:
	@missing=0; \
	for var in $(ELASTICSEARCH_S3_SECRET_REQUIRED_KEYS); do \
	  eval "value=\$${$${var}-}"; \
	  if [ -z "$$value" ]; then \
	    echo "missing $$var"; \
	    missing=1; \
	  fi; \
	done; \
	exit $$missing

elasticsearch-s3-secrets: elasticsearch-s3-secrets-preflight
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for $(NAMESPACE)"; \
	  exit 1; \
	fi
	@tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$tmp"' EXIT; \
	printf '%s' "$$STORAGE_ACCESS_KEY" > "$$tmp/STORAGE_ACCESS_KEY"; \
	printf '%s' "$$STORAGE_SECRET_KEY" > "$$tmp/STORAGE_SECRET_KEY"; \
	kubectl -n "$(NAMESPACE)" create secret generic "$(ELASTICSEARCH_S3_SECRET_NAME)" \
	  --from-file=STORAGE_ACCESS_KEY="$$tmp/STORAGE_ACCESS_KEY" \
	  --from-file=STORAGE_SECRET_KEY="$$tmp/STORAGE_SECRET_KEY" \
	  --dry-run=client -o yaml | kubectl apply -f -

prod-restore-preflight:
	@missing=0; \
	for var in $(ELASTICSEARCH_RESTORE_SECRET_REQUIRED_KEYS); do \
	  eval "value=\$${$${var}-}"; \
	  if [ -z "$$value" ]; then \
	    echo "missing $$var"; \
	    missing=1; \
	  fi; \
	done; \
	exit $$missing

prod-restore-secrets: NAMESPACE = matchid-prod
prod-restore-secrets: prod-restore-preflight elasticsearch-s3-secrets
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for $(NAMESPACE)"; \
	  exit 1; \
	fi
	@tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$tmp"' EXIT; \
	printf '%s' "$$SNAPSHOT_NAME" > "$$tmp/SNAPSHOT_NAME"; \
	printf '%s' "$$STORAGE_ACCESS_KEY" > "$$tmp/STORAGE_ACCESS_KEY"; \
	printf '%s' "$$STORAGE_SECRET_KEY" > "$$tmp/STORAGE_SECRET_KEY"; \
	printf '%s' "$$FORCE_RESTORE" > "$$tmp/FORCE_RESTORE"; \
	kubectl -n "$(NAMESPACE)" create secret generic "$(ELASTICSEARCH_RESTORE_SECRET_NAME)" \
	  --from-file=SNAPSHOT_NAME="$$tmp/SNAPSHOT_NAME" \
	  --from-file=STORAGE_ACCESS_KEY="$$tmp/STORAGE_ACCESS_KEY" \
	  --from-file=STORAGE_SECRET_KEY="$$tmp/STORAGE_SECRET_KEY" \
	  --from-file=FORCE_RESTORE="$$tmp/FORCE_RESTORE" \
	  --dry-run=client -o yaml | kubectl apply -f -

prod-runtime-secrets-preflight: backend-secrets-preflight log-forwarder-secrets-preflight proofs-storage-secrets-preflight userdb-seed-secret-preflight

prod-runtime-secrets: NAMESPACE = matchid-prod
prod-runtime-secrets: backend-secrets log-forwarder-secrets proofs-storage-secrets userdb-seed-secret

prod-secrets-preflight: prod-runtime-secrets-preflight elasticsearch-s3-secrets-preflight

prod-secrets: NAMESPACE = matchid-prod
prod-secrets: prod-runtime-secrets elasticsearch-s3-secrets

apply-local:
	kubectl --context $(KUBE_CTX) apply -k overlays/local/

apply-poc:
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set. Run: export KUBECONFIG=\$$(scw k8s kubeconfig get poc | grep KUBECONFIG | cut -d= -f2)"; \
	  exit 1; \
	fi
	kubectl apply -k overlays/poc/

apply-dev: NAMESPACE = matchid-dev
apply-dev: backend-secrets log-forwarder-secrets
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for matchid-dev tenant"; \
	  exit 1; \
	fi
	kubectl apply -k overlays/dev/

apply-prod: NAMESPACE = matchid-prod
apply-prod: prod-secrets
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for matchid-prod tenant"; \
	  exit 1; \
	fi
	kubectl apply -k overlays/prod/

apply-test: NAMESPACE = matchid-test
apply-test: backend-secrets
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set for matchid-test tenant"; \
	  exit 1; \
	fi
	kubectl apply -k overlays/test/

port-forward:
	@echo "deces-ui  → http://localhost:$(UI_LOCAL_PORT)"
	@echo "deces-api → http://localhost:$(BACKEND_LOCAL_PORT)"
	@kubectl --context $(KUBE_CTX) -n $(NAMESPACE) port-forward svc/deces-ui $(UI_LOCAL_PORT):8083 & \
	kubectl --context $(KUBE_CTX) -n $(NAMESPACE) port-forward svc/deces-backend $(BACKEND_LOCAL_PORT):8080 ; \
	wait

logs:
	kubectl --context $(KUBE_CTX) -n $(NAMESPACE) logs -l app.kubernetes.io/part-of=matchid --all-containers=true --tail=200 -f

status:
	@echo "--- namespace ---"
	@kubectl --context $(KUBE_CTX) get ns $(NAMESPACE)
	@echo ""
	@echo "--- pods ---"
	@kubectl --context $(KUBE_CTX) -n $(NAMESPACE) get pods -o wide
	@echo ""
	@echo "--- services ---"
	@kubectl --context $(KUBE_CTX) -n $(NAMESPACE) get svc
	@echo ""
	@echo "--- pvcs ---"
	@kubectl --context $(KUBE_CTX) -n $(NAMESPACE) get pvc
