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

.PHONY: build run logs-all logs-minibob logs-activity-api logs-development-vessel \
        status shell stop clean \
        sync-development-vessel restart-development-vessel

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

logs-surrealdb:
	docker exec substrate journalctl -fu surrealdb.service

status:
	docker exec substrate systemctl status --no-pager \
	    surrealdb valkey discovery-vessel identity-vessel activity-api minibob development-vessel

shell:
	docker exec -it substrate bash

health:
	@echo "=== activity-api ===" && curl -s http://localhost:8080/health | jq '{version,status}'
	@echo "=== discovery-vessel ===" && curl -s http://localhost:8100/health | jq '{status}'
	@echo "=== development-vessel ===" && curl -s http://localhost:8090/health | jq .

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
