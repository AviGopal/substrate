# Makefile — substrate container lifecycle
#
# Required env vars (export or pass inline):
#   JWT_SECRET        — shared HMAC secret for all vessel JWTs
#   SURREAL_PASS      — SurrealDB root password
#   METABOB_API_KEY   — API key for inter-vessel auth
#   ANTHROPIC_API_KEY — LLM provider key for minibob

IMAGE   := metabob/substrate
TAG     := dev
WORKSPACE := $(shell pwd)/workspace

# Vessel source roots (relative to repo root, two levels up)
REPO_ROOT := $(CURDIR)/../..
DEV_VESSEL_SRC := $(REPO_ROOT)/repos/development-vessel
LOCAL_TOOLS_SRC := $(REPO_ROOT)/repos/local-tools-vessel
LLM_VESSEL_SRC := $(REPO_ROOT)/repos/llm-resolver-vessel
GOAL_HOST_SRC := $(REPO_ROOT)/repos/goal-host-vessel
BOREDOM_VESSEL_SRC := $(REPO_ROOT)/repos/boredom-vessel
RIBOSOME_VESSEL_SRC := $(REPO_ROOT)/repos/ribosome-vessel

.PHONY: build run logs-all logs-minibob logs-activity-api logs-development-vessel \
        logs-local-tools-vessel logs-llm-resolver-vessel logs-bootstrap-seeder \
        logs-goal-host-vessel logs-boredom-vessel logs-ribosome-vessel \
        status shell stop clean \
        sync-development-vessel restart-development-vessel \
        sync-local-tools-vessel restart-local-tools-vessel \
        sync-llm-resolver-vessel restart-llm-resolver-vessel \
        sync-goal-host-vessel restart-goal-host-vessel \
        sync-boredom-vessel trigger-boredom-vessel \
        sync-ribosome-vessel restart-ribosome-vessel

build:
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    -t $(IMAGE):$(TAG) \
	    $(CURDIR)/../..

run:
	@mkdir -p $(WORKSPACE)
	docker run --rm -it \
	    --name substrate \
	    -e JWT_SECRET="$(JWT_SECRET)" \
	    -e SURREAL_PASS="$(SURREAL_PASS)" \
	    -e METABOB_API_KEY="$(METABOB_API_KEY)" \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -p 8080:8080 \
	    -p 8090:8090 \
	    -p 8200:8200 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)

run-detach:
	@mkdir -p $(WORKSPACE)
	docker run -d \
	    --name substrate \
	    -e JWT_SECRET="$(JWT_SECRET)" \
	    -e SURREAL_PASS="$(SURREAL_PASS)" \
	    -e METABOB_API_KEY="$(METABOB_API_KEY)" \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -p 8080:8080 \
	    -p 8090:8090 \
	    -p 8200:8200 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)

logs-all:
	docker exec substrate journalctl -f

logs-minibob:
	docker exec substrate journalctl -fu minibob.service

logs-activity-api:
	docker exec substrate journalctl -fu activity-api.service

logs-development-vessel:
	docker exec substrate journalctl -fu development-vessel.service

logs-local-tools-vessel:
	docker exec substrate journalctl -fu local-tools-vessel.service

logs-llm-resolver-vessel:
	docker exec substrate journalctl -fu llm-resolver-vessel.service

logs-bootstrap-seeder:
	docker exec substrate journalctl -u bootstrap-seeder.service --no-pager

logs-goal-host-vessel:
	docker exec substrate journalctl -fu goal-host-vessel.service

logs-boredom-vessel:
	docker exec substrate journalctl -u boredom-vessel.service --no-pager

logs-ribosome-vessel:
	docker exec substrate journalctl -fu ribosome-vessel.service

logs-surrealdb:
	docker exec substrate journalctl -fu surrealdb.service

status:
	docker exec substrate systemctl status --no-pager \
	    surrealdb valkey discovery-vessel identity-vessel activity-api minibob development-vessel local-tools-vessel llm-resolver-vessel goal-host-vessel bootstrap-seeder boredom-vessel.timer ribosome-vessel

shell:
	docker exec -it substrate bash

health:
	@echo "=== activity-api ===" && curl -s http://localhost:8080/health | jq '{version,status}'
	@echo "=== discovery-vessel ===" && curl -s http://localhost:8100/health | jq '{status}'
	@echo "=== development-vessel ===" && curl -s http://localhost:8090/health | jq .
	@echo "=== local-tools-vessel ===" && curl -s http://localhost:8230/health | jq .
	@echo "=== llm-resolver-vessel ===" && curl -s http://localhost:8220/health | jq .
	@echo "=== goal-host-vessel ===" && curl -s http://localhost:8210/health | jq .
	@echo "=== ribosome-vessel ===" && curl -s http://localhost:8240/health | jq .

stop:
	docker stop substrate

clean: stop
	docker rm -f substrate 2>/dev/null || true

# ── Substrate-only iteration (substrate-live container) ──────────────────────

# Sync development-vessel source into the running container then restart it.
# Use this instead of docker cp + systemctl restart manually.
sync-development-vessel:
	docker cp $(DEV_VESSEL_SRC)/src/config.ts substrate-live:/vessels/development-vessel/src/config.ts
	docker cp $(DEV_VESSEL_SRC)/src/index.ts substrate-live:/vessels/development-vessel/src/index.ts
	docker cp $(DEV_VESSEL_SRC)/src/routes/impulses.ts substrate-live:/vessels/development-vessel/src/routes/impulses.ts
	@for f in $(DEV_VESSEL_SRC)/src/resolvers/*.ts; do \
	    docker cp $$f substrate-live:/vessels/development-vessel/src/resolvers/$$(basename $$f); \
	done
	@for f in $(DEV_VESSEL_SRC)/src/seed/*.ts; do \
	    docker cp $$f substrate-live:/vessels/development-vessel/src/seed/$$(basename $$f); \
	done
	@docker exec substrate-live mkdir -p /vessels/development-vessel/src/observers
	@for f in $(DEV_VESSEL_SRC)/src/observers/*.ts; do \
	    docker cp $$f substrate-live:/vessels/development-vessel/src/observers/$$(basename $$f); \
	done
	@echo "[sync] development-vessel source synced to substrate-live"

restart-development-vessel: sync-development-vessel
	docker exec substrate-live systemctl restart development-vessel.service
	@sleep 2
	@docker exec substrate-live systemctl is-active development-vessel.service | grep -q active && echo "[restart] development-vessel active" || echo "[restart] ERROR: development-vessel not active"

# Sync local-tools-vessel source into the running container then restart it.
sync-local-tools-vessel:
	docker cp $(LOCAL_TOOLS_SRC)/src/index.ts substrate-live:/vessels/local-tools-vessel/src/index.ts
	@echo "[sync] local-tools-vessel source synced to substrate-live"

restart-local-tools-vessel: sync-local-tools-vessel
	docker exec substrate-live systemctl restart local-tools-vessel.service
	@sleep 2
	@docker exec substrate-live systemctl is-active local-tools-vessel.service | grep -q active && echo "[restart] local-tools-vessel active" || echo "[restart] ERROR: local-tools-vessel not active"

# Sync llm-resolver-vessel source into the running container then restart it.
sync-llm-resolver-vessel:
	docker cp $(LLM_VESSEL_SRC)/src/index.ts substrate-live:/vessels/llm-resolver-vessel/src/index.ts
	@echo "[sync] llm-resolver-vessel source synced to substrate-live"

restart-llm-resolver-vessel: sync-llm-resolver-vessel
	docker exec substrate-live systemctl restart llm-resolver-vessel.service
	@sleep 2
	@docker exec substrate-live systemctl is-active llm-resolver-vessel.service | grep -q active && echo "[restart] llm-resolver-vessel active" || echo "[restart] ERROR: llm-resolver-vessel not active"

# Sync goal-host-vessel source into the running container then restart it.
sync-goal-host-vessel:
	docker cp $(GOAL_HOST_SRC)/src/index.ts substrate-live:/vessels/goal-host-vessel/src/index.ts
	@echo "[sync] goal-host-vessel source synced to substrate-live"

restart-goal-host-vessel: sync-goal-host-vessel
	docker exec substrate-live systemctl restart goal-host-vessel.service
	@sleep 2
	@docker exec substrate-live systemctl is-active goal-host-vessel.service | grep -q active && echo "[restart] goal-host-vessel active" || echo "[restart] ERROR: goal-host-vessel not active"

# Sync boredom-vessel source into the running container then trigger a manual run.
sync-boredom-vessel:
	docker cp $(BOREDOM_VESSEL_SRC)/src/index.ts substrate-live:/vessels/boredom-vessel/src/index.ts
	@echo "[sync] boredom-vessel source synced to substrate-live"

trigger-boredom-vessel: sync-boredom-vessel
	docker exec substrate-live systemctl start boredom-vessel.service
	@sleep 3
	@docker exec substrate-live journalctl -u boredom-vessel.service --no-pager -n 10

# Sync ribosome-vessel source into the running container then restart it.
sync-ribosome-vessel:
	docker cp $(RIBOSOME_VESSEL_SRC)/src/index.ts substrate-live:/vessels/ribosome-vessel/src/index.ts
	@echo "[sync] ribosome-vessel source synced to substrate-live"

restart-ribosome-vessel: sync-ribosome-vessel
	docker exec substrate-live systemctl restart ribosome-vessel.service
	@sleep 2
	@docker exec substrate-live systemctl is-active ribosome-vessel.service | grep -q active && echo "[restart] ribosome-vessel active" || echo "[restart] ERROR: ribosome-vessel not active"
