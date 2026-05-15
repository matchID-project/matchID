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

.PHONY: help k3d-up k3d-down apply-local apply-poc port-forward logs status

help:
	@echo "matchID k8s — local k3s scaffold"
	@echo ""
	@echo "  make k3d-up           Create a k3d cluster '$(CLUSTER_NAME)' with NodePort mappings"
	@echo "  make k3d-down         Tear the k3d cluster down"
	@echo "  make apply-local      kubectl apply -k overlays/local/  (k3d / k3s-local)"
	@echo "  make apply-poc        kubectl apply -k overlays/poc/    (Scaleway Kapsule poc)"
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

apply-local:
	kubectl --context $(KUBE_CTX) apply -k overlays/local/

apply-poc:
	@if [ -z "$$KUBECONFIG" ]; then \
	  echo "ERROR: KUBECONFIG not set. Run: export KUBECONFIG=\$$(scw k8s kubeconfig get poc | grep KUBECONFIG | cut -d= -f2)"; \
	  exit 1; \
	fi
	kubectl apply -k overlays/poc/

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
