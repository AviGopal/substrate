# Makefile — substrate container lifecycle
#
# Only one credential is required from the operator:
#   ANTHROPIC_API_KEY — LLM provider key for llm-resolver-vessel
#
# All other secrets (JWT_SECRET, SURREAL_PASS, METABOB_API_KEY) are generated
# automatically on first run and persisted to workspace/.substrate-secrets so
# restarts reuse the same values without operator input.
#
# Quick start:
#   make -C scripts/substrate run-live ANTHROPIC_API_KEY=sk-ant-...
#   make -C scripts/substrate seed-live
#   scripts/substrate/configure-local.sh
#
# Two container flavours:
#   substrate       — interactive / ephemeral dev container (port 8080)
#   substrate-live  — persistent development substrate (port 18080)
#                     All substrate-only iteration targets use substrate-live.

IMAGE        := metabob/substrate
TAG          := dev
WORKSPACE    := $(shell pwd)/workspace
LIVE_NAME    := substrate-live

# ANTHROPIC_API_KEY — load from environment or existing ~/.metabob/config.json
ANTHROPIC_API_KEY ?= $(shell jq -r '.providers.anthropic.apiKey // empty' $(HOME)/.metabob/config.json 2>/dev/null || true)

# Vessel source roots (relative to repo root, two levels up)
REPO_ROOT := $(CURDIR)/../..
DEV_VESSEL_SRC := $(REPO_ROOT)/repos/development-vessel
LOCAL_TOOLS_SRC := $(REPO_ROOT)/repos/local-tools-vessel
LLM_VESSEL_SRC := $(REPO_ROOT)/repos/llm-resolver-vessel
GOAL_HOST_SRC := $(REPO_ROOT)/repos/goal-host-vessel
BOREDOM_VESSEL_SRC := $(REPO_ROOT)/repos/boredom-vessel
RIBOSOME_VESSEL_SRC := $(REPO_ROOT)/repos/ribosome-vessel
CONCEPT_DB_SRC := $(REPO_ROOT)/repos/concept-db
ANALYSIS_VESSEL_SRC := $(REPO_ROOT)/repos/analysis-vessel

.PHONY: build run run-detach run-live seed-live import-memory health health-live \
        logs-all logs-activity-api logs-development-vessel \
        logs-local-tools-vessel logs-llm-resolver-vessel logs-bootstrap-seeder \
        logs-goal-host-vessel logs-boredom-vessel logs-ribosome-vessel logs-concept-db \
        logs-analysis-vessel \
        status status-live shell shell-live stop stop-live clean clean-live \
        sync-development-vessel restart-development-vessel \
        sync-local-tools-vessel restart-local-tools-vessel \
        sync-llm-resolver-vessel restart-llm-resolver-vessel \
        sync-goal-host-vessel restart-goal-host-vessel \
        sync-boredom-vessel trigger-boredom-vessel \
        sync-ribosome-vessel restart-ribosome-vessel \
        sync-concept-db restart-concept-db \
        sync-analysis-vessel restart-analysis-vessel

build:
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    -t $(IMAGE):$(TAG) \
	    $(CURDIR)/../..

run:
	@if [ -z "$(ANTHROPIC_API_KEY)" ]; then \
	  echo "[substrate] ERROR: ANTHROPIC_API_KEY is required. Pass it inline or add it to ~/.metabob/config.json"; \
	  exit 1; \
	fi
	@mkdir -p $(WORKSPACE)
	docker run --rm -it \
	    --name substrate \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -p 8080:8080 \
	    -p 8090:8090 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)

run-detach:
	@if [ -z "$(ANTHROPIC_API_KEY)" ]; then \
	  echo "[substrate] ERROR: ANTHROPIC_API_KEY is required. Pass it inline or add it to ~/.metabob/config.json"; \
	  exit 1; \
	fi
	@mkdir -p $(WORKSPACE)
	docker run -d \
	    --name substrate \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -p 8080:8080 \
	    -p 8090:8090 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)

# ── substrate-live container (persistent, host ports 18080/18090/18100) ─────
# Primary target for all local development iteration.
# Run once; use sync-*/restart-* targets to hot-reload vessels without rebuild.

run-live:
	@if [ -z "$(ANTHROPIC_API_KEY)" ]; then \
	  echo "[substrate] ERROR: ANTHROPIC_API_KEY is required."; \
	  echo "  Pass inline:  make run-live ANTHROPIC_API_KEY=sk-ant-..."; \
	  echo "  Or add to:    ~/.metabob/config.json .providers.anthropic.apiKey"; \
	  exit 1; \
	fi
	@mkdir -p $(WORKSPACE)
	docker run -d \
	    --name $(LIVE_NAME) \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -p 18080:8080 \
	    -p 18090:8090 \
	    -p 18100:8100 \
	    -p 18210:8210 \
	    -p 18260:8260 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)
	@echo "[run-live] substrate-live started — activity-api on :18080, development-vessel on :18090, discovery-vessel on :18100, goal-host-vessel on :18210, concept-db on :18260"
	@echo "[run-live] Internal secrets auto-generated and persisted to workspace/.substrate-secrets"
	@echo "[run-live] Wait ~15s for services to start, then: make -C scripts/substrate seed-live"

# Seed identity and API keys into a freshly started substrate-live container.
seed-live:
	docker exec $(LIVE_NAME) bash -c 'set -a; source /etc/substrate/env; set +a; bun /vessels/seed-identity.ts'
	@echo "[seed-live] Identity seeded. Run: scripts/substrate/configure-local.sh"

health-live:
	@echo "=== activity-api ===" && curl -s http://localhost:18080/health | jq '{version,status}'
	@echo "=== discovery-vessel ===" && curl -s http://localhost:18100/health | jq '{status}'
	@echo "=== development-vessel ===" && curl -s http://localhost:18090/health | jq .
	@echo "=== local-tools-vessel (internal) ===" && docker exec $(LIVE_NAME) curl -s http://localhost:8230/health | jq .
	@echo "=== llm-resolver-vessel (internal) ===" && docker exec $(LIVE_NAME) curl -s http://localhost:8220/health | jq .
	@echo "=== goal-host-vessel (internal) ===" && docker exec $(LIVE_NAME) curl -s http://localhost:8210/health | jq .
	@echo "=== ribosome-vessel (internal) ===" && docker exec $(LIVE_NAME) curl -s http://localhost:8240/health | jq .
	@echo "=== concept-db (internal) ===" && docker exec $(LIVE_NAME) curl -s http://localhost:8260/health | jq '{status,service}'
	@echo "=== analysis-vessel (internal) ===" && docker exec $(LIVE_NAME) curl -s http://localhost:8250/health | jq .

status-live:
	docker exec $(LIVE_NAME) systemctl status --no-pager \
	    surrealdb valkey discovery-vessel identity-vessel activity-api development-vessel local-tools-vessel llm-resolver-vessel goal-host-vessel bootstrap-seeder boredom-vessel.timer ribosome-vessel concept-db analysis-vessel

shell-live:
	docker exec -it $(LIVE_NAME) bash

stop-live:
	docker stop $(LIVE_NAME)

clean-live:
	docker rm -f $(LIVE_NAME) 2>/dev/null || true

# ── ephemeral dev container (port 8080) ─────────────────────────────────────

logs-all:
	docker exec $(LIVE_NAME) journalctl -f

logs-activity-api:
	docker exec $(LIVE_NAME) journalctl -fu activity-api.service

logs-development-vessel:
	docker exec $(LIVE_NAME) journalctl -fu development-vessel.service

logs-local-tools-vessel:
	docker exec $(LIVE_NAME) journalctl -fu local-tools-vessel.service

logs-llm-resolver-vessel:
	docker exec $(LIVE_NAME) journalctl -fu llm-resolver-vessel.service

logs-bootstrap-seeder:
	docker exec $(LIVE_NAME) journalctl -u bootstrap-seeder.service --no-pager

logs-goal-host-vessel:
	docker exec $(LIVE_NAME) journalctl -fu goal-host-vessel.service

logs-boredom-vessel:
	docker exec $(LIVE_NAME) journalctl -u boredom-vessel.service --no-pager

logs-ribosome-vessel:
	docker exec $(LIVE_NAME) journalctl -fu ribosome-vessel.service

logs-concept-db:
	docker exec $(LIVE_NAME) journalctl -fu concept-db.service

logs-surrealdb:
	docker exec $(LIVE_NAME) journalctl -fu surrealdb.service

status: status-live

shell: shell-live

# Seed operator-side memory files into the substrate's memory store.
# Run once after seed-live. Pass DEV_VESSEL_ENDPOINT to write via HTTP
# (requires substrate running); omit to write directly to workspace/memory/.
import-memory:
	WORKSPACE_DIR=$(WORKSPACE) bun $(CURDIR)/import-operator-memory.ts

# health targets the substrate-live container (18080 ports).
health: health-live

stop: stop-live

clean: clean-live

# ── Substrate-only iteration (substrate-live container) ──────────────────────

# Sync development-vessel source into the running container then restart it.
sync-development-vessel:
	docker cp $(DEV_VESSEL_SRC)/src/config.ts $(LIVE_NAME):/vessels/development-vessel/src/config.ts
	docker cp $(DEV_VESSEL_SRC)/src/index.ts $(LIVE_NAME):/vessels/development-vessel/src/index.ts
	docker cp $(DEV_VESSEL_SRC)/src/routes/impulses.ts $(LIVE_NAME):/vessels/development-vessel/src/routes/impulses.ts
	@for f in $(DEV_VESSEL_SRC)/src/resolvers/*.ts; do \
	    docker cp $$f $(LIVE_NAME):/vessels/development-vessel/src/resolvers/$$(basename $$f); \
	done
	@for f in $(DEV_VESSEL_SRC)/src/seed/*.ts; do \
	    docker cp $$f $(LIVE_NAME):/vessels/development-vessel/src/seed/$$(basename $$f); \
	done
	@docker exec $(LIVE_NAME) mkdir -p /vessels/development-vessel/src/observers
	@for f in $(DEV_VESSEL_SRC)/src/observers/*.ts; do \
	    docker cp $$f $(LIVE_NAME):/vessels/development-vessel/src/observers/$$(basename $$f); \
	done
	@echo "[sync] development-vessel source synced to substrate-live"

restart-development-vessel: sync-development-vessel
	docker exec $(LIVE_NAME) systemctl restart development-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active development-vessel.service | grep -q active && echo "[restart] development-vessel active" || echo "[restart] ERROR: development-vessel not active"

# Sync local-tools-vessel source into the running container then restart it.
sync-local-tools-vessel:
	docker cp $(LOCAL_TOOLS_SRC)/src/index.ts $(LIVE_NAME):/vessels/local-tools-vessel/src/index.ts
	@echo "[sync] local-tools-vessel source synced to substrate-live"

restart-local-tools-vessel: sync-local-tools-vessel
	docker exec $(LIVE_NAME) systemctl restart local-tools-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active local-tools-vessel.service | grep -q active && echo "[restart] local-tools-vessel active" || echo "[restart] ERROR: local-tools-vessel not active"

# Sync llm-resolver-vessel source into the running container then restart it.
sync-llm-resolver-vessel:
	docker cp $(LLM_VESSEL_SRC)/src/index.ts $(LIVE_NAME):/vessels/llm-resolver-vessel/src/index.ts
	@echo "[sync] llm-resolver-vessel source synced to substrate-live"

restart-llm-resolver-vessel: sync-llm-resolver-vessel
	docker exec $(LIVE_NAME) systemctl restart llm-resolver-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active llm-resolver-vessel.service | grep -q active && echo "[restart] llm-resolver-vessel active" || echo "[restart] ERROR: llm-resolver-vessel not active"

# Sync goal-host-vessel source into the running container then restart it.
sync-goal-host-vessel:
	docker cp $(GOAL_HOST_SRC)/src/index.ts $(LIVE_NAME):/vessels/goal-host-vessel/src/index.ts
	@echo "[sync] goal-host-vessel source synced to substrate-live"

restart-goal-host-vessel: sync-goal-host-vessel
	docker exec $(LIVE_NAME) systemctl restart goal-host-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active goal-host-vessel.service | grep -q active && echo "[restart] goal-host-vessel active" || echo "[restart] ERROR: goal-host-vessel not active"

# Sync boredom-vessel source into the running container then trigger a manual run.
sync-boredom-vessel:
	docker cp $(BOREDOM_VESSEL_SRC)/src/index.ts $(LIVE_NAME):/vessels/boredom-vessel/src/index.ts
	@echo "[sync] boredom-vessel source synced to substrate-live"

trigger-boredom-vessel: sync-boredom-vessel
	docker exec $(LIVE_NAME) systemctl start boredom-vessel.service
	@sleep 3
	@docker exec $(LIVE_NAME) journalctl -u boredom-vessel.service --no-pager -n 10

# Sync ribosome-vessel source into the running container then restart it.
sync-ribosome-vessel:
	docker cp $(RIBOSOME_VESSEL_SRC)/src/index.ts $(LIVE_NAME):/vessels/ribosome-vessel/src/index.ts
	@echo "[sync] ribosome-vessel source synced to substrate-live"

restart-ribosome-vessel: sync-ribosome-vessel
	docker exec $(LIVE_NAME) systemctl restart ribosome-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active ribosome-vessel.service | grep -q active && echo "[restart] ribosome-vessel active" || echo "[restart] ERROR: ribosome-vessel not active"

# Sync concept-db source into the running container then restart it.
sync-concept-db:
	docker cp $(CONCEPT_DB_SRC)/src $(LIVE_NAME):/vessels/concept-db/src
	@echo "[sync] concept-db source synced to substrate-live"

restart-concept-db: sync-concept-db
	docker exec $(LIVE_NAME) systemctl restart concept-db.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active concept-db.service | grep -q active && echo "[restart] concept-db active" || echo "[restart] ERROR: concept-db not active"

logs-analysis-vessel:
	docker exec $(LIVE_NAME) journalctl -fu analysis-vessel.service

sync-analysis-vessel:
	docker cp $(ANALYSIS_VESSEL_SRC)/src $(LIVE_NAME):/vessels/analysis-vessel/src
	@echo "[sync] analysis-vessel source synced to substrate-live"

restart-analysis-vessel: sync-analysis-vessel
	docker exec $(LIVE_NAME) systemctl restart analysis-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active analysis-vessel.service | grep -q active && echo "[restart] analysis-vessel active" || echo "[restart] ERROR: analysis-vessel not active"
