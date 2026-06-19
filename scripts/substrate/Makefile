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
# State now lives in DOCKER-MANAGED NAMED VOLUMES, not host bind mounts, so the
# substrate's filesystem is detached from this host (container-independent;
# self-persistence increment). The two volumes carry all learning state:
#   substrate-surreal   -> /var/lib/surrealdb  (traces, Thompson posteriors, concept graph)
#   substrate-workspace -> /workspace          (memoryNote store, git clones, .substrate-secrets, snapshots)
# The image declares VOLUME ["/workspace","/var/lib/surrealdb"]; we name them so
# they survive `docker rm` and can be backed up / moved off-host independently.
SURREAL_VOLUME   := substrate-surreal
WORKSPACE_VOLUME := substrate-workspace
# Legacy HOST paths — retained only as the migration source / offline backup
# (host-detach migrated their contents into the named volumes above). No longer
# mounted into the live container.
WORKSPACE    := $(shell pwd)/workspace
SURREAL_DATA := $(shell pwd)/surreal-data
LIVE_NAME    := substrate-live

# Vessels with @avigopal/ias-executor-ts as a `file:` dep. Bun copies dist
# physically per-consumer rather than symlinking, so rebuilds of the
# canonical package don't propagate. sync-ias-executor-ts pushes the new
# dist into every consumer's node_modules path inside the container.
IAS_CONSUMERS := goal-host-vessel ribosome-vessel boredom-vessel development-vessel local-tools-vessel llm-resolver-vessel analysis-vessel

# ANTHROPIC_API_KEY — load from environment or existing ~/.metabob/config.json
ANTHROPIC_API_KEY ?= $(shell jq -r '.providers.anthropic.apiKey // empty' $(HOME)/.metabob/config.json 2>/dev/null || true)

# GITHUB_TOKEN — load from environment, fall back to gh CLI's cached auth.
# Used by gh_repo_create resolver + gh_pr_create when authoring substrate-
# authored repos and PRs. Optional — when absent, gh_repo_create returns
# structuredError with detail "no GITHUB_TOKEN", and substrate can still
# author into existing repos via SSH-key-backed git push (which doesn't
# need this env var).
GITHUB_TOKEN ?= $(shell gh auth token 2>/dev/null || true)

# Vessel source roots (relative to repo root, two levels up)
REPO_ROOT := $(CURDIR)/../..
DEV_VESSEL_SRC := $(REPO_ROOT)/repos/development-vessel
LOCAL_TOOLS_SRC := $(REPO_ROOT)/repos/local-tools-vessel
LLM_VESSEL_SRC := $(REPO_ROOT)/repos/llm-resolver-vessel
GOAL_HOST_SRC := $(REPO_ROOT)/repos/goal-host-vessel
LIGHT_DISPATCH_SRC := $(REPO_ROOT)/repos/light-dispatch-vessel
BOREDOM_VESSEL_SRC := $(REPO_ROOT)/repos/boredom-vessel
RIBOSOME_VESSEL_SRC := $(REPO_ROOT)/repos/ribosome-vessel
CONCEPT_DB_SRC := $(REPO_ROOT)/repos/concept-db
ANALYSIS_VESSEL_SRC := $(REPO_ROOT)/repos/analysis-vessel
STATEFUL_UI_VESSEL_SRC := $(REPO_ROOT)/repos/stateful-ui-vessel
OBSIDIAN_VESSEL_SRC := $(REPO_ROOT)/repos/obsidian-vessel

.PHONY: autonomy-status validate-build build build-obsidian run run-detach run-live run-live-obsidian migrate-state-to-volumes seed-live import-memory health health-live \
        logs-all logs-activity-api logs-development-vessel \
        logs-local-tools-vessel logs-llm-resolver-vessel logs-bootstrap-seeder \
        logs-goal-host-vessel logs-boredom-vessel logs-ribosome-vessel logs-concept-db \
        logs-analysis-vessel \
        status status-live shell shell-live stop stop-live clean clean-live \
        sync-development-vessel restart-development-vessel \
        sync-local-tools-vessel restart-local-tools-vessel \
        sync-llm-resolver-vessel restart-llm-resolver-vessel \
        sync-goal-host-vessel restart-goal-host-vessel \
        sync-light-dispatch-vessel restart-light-dispatch-vessel \
        sync-boredom-vessel trigger-boredom-vessel \
        sync-ribosome-vessel restart-ribosome-vessel \
        sync-concept-db restart-concept-db \
        sync-analysis-vessel restart-analysis-vessel \
        sync-stateful-ui-vessel restart-stateful-ui-vessel \
        sync-obsidian-vessel restart-obsidian-vessel \
        sync-ias-executor-ts \
        ui-bridge-up ui-bridge-down ui-bridge-status

# Fast preflight: assert every containerized vessel is build-valid (file: deps
# resolve, frozen lockfiles are in sync, imports match dependency keys). Catches
# the namespace-migration breakages that only surface inside the image build.
validate-build:
	bun $(CURDIR)/validate-build.ts

build: validate-build
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    -t $(IMAGE):$(TAG) \
	    $(CURDIR)/../..

# substrate-obsidian flavour: base fleet + in-container Obsidian desktop served
# over noVNC. Tagged metabob/substrate:obsidian.
OBSIDIAN_TAG := obsidian
build-obsidian:
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    --target substrate-obsidian \
	    -t $(IMAGE):$(OBSIDIAN_TAG) \
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
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
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
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
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
	@docker volume create $(SURREAL_VOLUME) >/dev/null
	@docker volume create $(WORKSPACE_VOLUME) >/dev/null
	docker run -d \
	    --name $(LIVE_NAME) \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
	    -e SUBSTRATE_GIT_PAT="$(SUBSTRATE_GIT_PAT)" \
	    -p 18080:8080 \
	    -p 18090:8090 \
	    -p 18100:8100 \
	    -p 18210:8210 \
	    -p 18250:8250 \
	    -p 18260:8260 \
	    -p 18270:8270 \
	    -v $(WORKSPACE_VOLUME):/workspace \
	    -v $(SURREAL_VOLUME):/var/lib/surrealdb \
	    -v $(REPO_ROOT):$(REPO_ROOT):ro \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)
	@echo "[run-live] substrate-live started — activity-api on :18080, development-vessel on :18090, discovery-vessel on :18100, goal-host-vessel on :18210, analysis-vessel on :18250, concept-db on :18260, stateful-ui-vessel on :18270"
	@echo "[run-live] State on named volumes $(SURREAL_VOLUME) + $(WORKSPACE_VOLUME) (host-detached); only the repo is bind-mounted (ro) for sync-* hot-reload"
	@echo "[run-live] Internal secrets auto-generated and persisted to workspace/.substrate-secrets"
	@echo "[run-live] Wait ~15s for services to start, then: make -C scripts/substrate seed-live"

# Same as run-live but boots the substrate-obsidian image: the full fleet PLUS
# an in-container Obsidian desktop, with the GUI exposed over noVNC on host
# :16080. Reuses the substrate-live container name so every sync-/restart-/
# health- target keeps working unchanged. Requires `make build-obsidian` first.
run-live-obsidian:
	@if [ -z "$(ANTHROPIC_API_KEY)" ]; then \
	  echo "[substrate] ERROR: ANTHROPIC_API_KEY is required."; \
	  echo "  Pass inline:  make run-live-obsidian ANTHROPIC_API_KEY=sk-ant-..."; \
	  echo "  Or add to:    ~/.metabob/config.json .providers.anthropic.apiKey"; \
	  exit 1; \
	fi
	@docker volume create $(SURREAL_VOLUME) >/dev/null
	@docker volume create $(WORKSPACE_VOLUME) >/dev/null
	docker run -d \
	    --name $(LIVE_NAME) \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
	    -e SUBSTRATE_GIT_PAT="$(SUBSTRATE_GIT_PAT)" \
	    -p 18080:8080 \
	    -p 18090:8090 \
	    -p 18100:8100 \
	    -p 18210:8210 \
	    -p 18250:8250 \
	    -p 18260:8260 \
	    -p 18270:8270 \
	    -p 16080:6080 \
	    -v $(WORKSPACE_VOLUME):/workspace \
	    -v $(SURREAL_VOLUME):/var/lib/surrealdb \
	    -v $(REPO_ROOT):$(REPO_ROOT):ro \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    --shm-size=512m \
	    $(IMAGE):$(OBSIDIAN_TAG)
	@echo "[run-live-obsidian] substrate-live (obsidian flavour) started."
	@echo "[run-live-obsidian] Fleet ports as run-live; Obsidian GUI at http://localhost:16080/vnc.html"
	@echo "[run-live-obsidian] Wait ~20s, then: make -C scripts/substrate seed-live"

# One-time migration: copy legacy HOST state dirs into the named volumes. Run
# this ONCE when moving an existing host-bind substrate onto detached volumes.
# Stop the container first so SurrealDB has flushed; the host dirs are left
# intact as a backup. Idempotent re-run wipes + recopies the volumes.
migrate-state-to-volumes:
	@docker volume create $(SURREAL_VOLUME) >/dev/null
	@docker volume create $(WORKSPACE_VOLUME) >/dev/null
	@if docker ps --filter name=$(LIVE_NAME) --filter status=running -q | grep -q .; then \
	  echo "[migrate] ERROR: stop $(LIVE_NAME) first (docker stop -t 30 $(LIVE_NAME)) so SurrealDB flushes"; exit 1; \
	fi
	docker run --rm --entrypoint bash \
	    -v $(SURREAL_DATA):/src-surreal:ro \
	    -v $(WORKSPACE):/src-workspace:ro \
	    -v $(SURREAL_VOLUME):/dst-surreal \
	    -v $(WORKSPACE_VOLUME):/dst-workspace \
	    $(IMAGE):$(TAG) -c 'set -e; \
	      find /dst-surreal -mindepth 1 -delete; find /dst-workspace -mindepth 1 -delete; \
	      cp -a /src-surreal/. /dst-surreal/; cp -a /src-workspace/. /dst-workspace/; \
	      echo "[migrate] surreal CURRENT=$$(cat /dst-surreal/data.db/CURRENT 2>/dev/null)"; \
	      echo "[migrate] done — host dirs left intact as backup"'

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
	@echo "=== analysis-vessel ===" && curl -s http://localhost:18250/health | jq .

status-live:
	docker exec $(LIVE_NAME) systemctl status --no-pager \
	    surrealdb valkey discovery-vessel identity-vessel activity-api development-vessel local-tools-vessel llm-resolver-vessel goal-host-vessel bootstrap-seeder boredom-vessel.timer m1-trainer.timer ribosome-vessel concept-db analysis-vessel

# Autonomy KPI view. MUST run ON THE HOST. The collector writes the metrics JSONL
# into the /workspace docker VOLUME (host filesystem can't see it directly), so
# the viewer reaches it via `docker exec <container> cat /workspace/...`. That
# docker-exec read only works where `docker` exists — i.e. the HOST. Running it
# IN-CONTAINER (the prior approach) silently failed: `docker` isn't installed in
# the container, the volume read errored, and the viewer fell back to the STALE
# host bind-mount cache — falsely reporting STALE / 850m-old data while the
# collector was healthy (root-caused 2026-06-19). The viewer is a pure renderer
# (no DB/API creds needed); SUBSTRATE_CONTAINER points it at the live volume.
autonomy-status:
	@SUBSTRATE_CONTAINER=$(LIVE_NAME) bun $(dir $(lastword $(MAKEFILE_LIST)))autonomy-status.ts

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

logs-m1-trainer:
	docker exec $(LIVE_NAME) journalctl -u m1-trainer.service --no-pager

trigger-m1-trainer:
	docker exec $(LIVE_NAME) systemctl start m1-trainer.service
	@sleep 2
	@docker exec $(LIVE_NAME) journalctl -u m1-trainer.service --no-pager -n 20

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

# Sync light-dispatch-vessel into the running container then restart it.
# Stateless oneshot dispatcher (openspec 2026-06-03 Stage 2.B). Port 8250.
sync-light-dispatch-vessel:
	docker exec $(LIVE_NAME) mkdir -p /vessels/light-dispatch-vessel/src
	docker cp $(LIGHT_DISPATCH_SRC)/package.json $(LIVE_NAME):/vessels/light-dispatch-vessel/package.json
	docker cp $(LIGHT_DISPATCH_SRC)/tsconfig.json $(LIVE_NAME):/vessels/light-dispatch-vessel/tsconfig.json
	docker cp $(LIGHT_DISPATCH_SRC)/src/index.ts $(LIVE_NAME):/vessels/light-dispatch-vessel/src/index.ts
	docker cp $(CURDIR)/units/light-dispatch-vessel.service $(LIVE_NAME):/etc/systemd/system/light-dispatch-vessel.service
	docker cp $(CURDIR)/light-dispatch-healthcheck.sh $(LIVE_NAME):/usr/local/bin/light-dispatch-healthcheck
	docker exec $(LIVE_NAME) chmod +x /usr/local/bin/light-dispatch-healthcheck
	docker cp $(CURDIR)/units/light-dispatch-healthcheck.service $(LIVE_NAME):/etc/systemd/system/light-dispatch-healthcheck.service
	docker cp $(CURDIR)/units/light-dispatch-healthcheck.timer $(LIVE_NAME):/etc/systemd/system/light-dispatch-healthcheck.timer
	docker exec $(LIVE_NAME) systemctl daemon-reload
	docker exec $(LIVE_NAME) systemctl enable light-dispatch-vessel.service 2>/dev/null || true
	docker exec $(LIVE_NAME) systemctl enable --now light-dispatch-healthcheck.timer 2>/dev/null || true
	@echo "[sync] light-dispatch-vessel source + unit + liveness watchdog synced to substrate-live"

restart-light-dispatch-vessel: sync-light-dispatch-vessel
	docker exec $(LIVE_NAME) systemctl restart light-dispatch-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active light-dispatch-vessel.service | grep -q active && echo "[restart] light-dispatch-vessel active" || echo "[restart] ERROR: light-dispatch-vessel not active"

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
# `docker cp <src>/src <container>:/vessels/x/src` nests into x/src/src when
# the destination exists. Wipe the target first so the copy lands cleanly.
sync-concept-db:
	docker exec $(LIVE_NAME) rm -rf /vessels/concept-db/src
	docker cp $(CONCEPT_DB_SRC)/src $(LIVE_NAME):/vessels/concept-db/src
	@echo "[sync] concept-db source synced to substrate-live"

restart-concept-db: sync-concept-db
	docker exec $(LIVE_NAME) systemctl restart concept-db.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active concept-db.service | grep -q active && echo "[restart] concept-db active" || echo "[restart] ERROR: concept-db not active"

logs-analysis-vessel:
	docker exec $(LIVE_NAME) journalctl -fu analysis-vessel.service

sync-analysis-vessel:
	docker exec $(LIVE_NAME) rm -rf /vessels/analysis-vessel/src
	docker cp $(ANALYSIS_VESSEL_SRC)/src $(LIVE_NAME):/vessels/analysis-vessel/src
	@echo "[sync] analysis-vessel source synced to substrate-live"

restart-analysis-vessel: sync-analysis-vessel
	docker exec $(LIVE_NAME) systemctl restart analysis-vessel.service
	@sleep 2
	@docker exec $(LIVE_NAME) systemctl is-active analysis-vessel.service | grep -q active && echo "[restart] analysis-vessel active" || echo "[restart] ERROR: analysis-vessel not active"

# Sync stateful-ui-vessel source into the running container.
# Also installs the systemd unit on first sync (idempotent).
sync-stateful-ui-vessel:
	docker exec $(LIVE_NAME) mkdir -p /vessels/stateful-ui-vessel/src
	docker cp $(STATEFUL_UI_VESSEL_SRC)/package.json $(LIVE_NAME):/vessels/stateful-ui-vessel/package.json
	docker cp $(STATEFUL_UI_VESSEL_SRC)/tsconfig.json $(LIVE_NAME):/vessels/stateful-ui-vessel/tsconfig.json
	docker cp $(STATEFUL_UI_VESSEL_SRC)/src $(LIVE_NAME):/vessels/stateful-ui-vessel/
	docker cp $(REPO_ROOT)/scripts/substrate/units/stateful-ui-vessel.service $(LIVE_NAME):/etc/systemd/system/stateful-ui-vessel.service
	docker exec $(LIVE_NAME) bash -c 'cd /vessels/stateful-ui-vessel && bun install --silent 2>&1 | tail -3'
	docker exec $(LIVE_NAME) systemctl daemon-reload
	docker exec $(LIVE_NAME) systemctl enable stateful-ui-vessel.service 2>/dev/null || true
	@echo "[sync] stateful-ui-vessel synced + unit installed"

restart-stateful-ui-vessel: sync-stateful-ui-vessel
	docker exec $(LIVE_NAME) systemctl restart stateful-ui-vessel.service
	@sleep 3
	@docker exec $(LIVE_NAME) systemctl is-active stateful-ui-vessel.service | grep -q active && echo "[restart] stateful-ui-vessel active" || echo "[restart] ERROR: stateful-ui-vessel not active"

# obsidian-vessel: the Obsidian plugin built IN the substrate (substrate-obsidian
# flavour only). Dev loop is edit → sync → rebuild → reload Obsidian. The vault's
# plugin files are symlinks to /vessels/obsidian-vessel build artifacts, so a
# rebuild updates them in place. Restarting obsidian-desktop reloads the plugin
# WITHOUT tearing down the display (obsidian-xorg), so the noVNC session survives.
# `docker cp <src>/src <container>:/vessels/x/src` nests when the dest exists —
# wipe first so the copy lands cleanly.
sync-obsidian-vessel:
	docker exec $(LIVE_NAME) rm -rf /vessels/obsidian-vessel/src /vessels/obsidian-vessel/styles
	docker cp $(OBSIDIAN_VESSEL_SRC)/src $(LIVE_NAME):/vessels/obsidian-vessel/src
	docker cp $(OBSIDIAN_VESSEL_SRC)/styles $(LIVE_NAME):/vessels/obsidian-vessel/styles
	docker cp $(OBSIDIAN_VESSEL_SRC)/esbuild.config.mjs $(LIVE_NAME):/vessels/obsidian-vessel/esbuild.config.mjs
	docker cp $(OBSIDIAN_VESSEL_SRC)/manifest.json $(LIVE_NAME):/vessels/obsidian-vessel/manifest.json
	@echo "[sync] obsidian-vessel source synced to substrate-live"

restart-obsidian-vessel: sync-obsidian-vessel
	docker exec $(LIVE_NAME) bash -c 'cd /vessels/obsidian-vessel && bun esbuild.config.mjs production'
	docker exec $(LIVE_NAME) systemctl restart obsidian-desktop.service
	@sleep 3
	@docker exec $(LIVE_NAME) systemctl is-active obsidian-desktop.service | grep -q active && echo "[restart] obsidian-desktop active (plugin reloaded; refresh noVNC if needed)" || echo "[restart] ERROR: obsidian-desktop not active"

# -----------------------------------------------------------------------------
# ias-executor-ts: rebuild dist on host and push into every consumer vessel's
# node_modules path inside the container. Bun's `file:` resolver makes a
# physical copy of dist per consumer rather than a symlink, so a host rebuild
# of ias-executor-ts does NOT propagate without this target.
#
# Usage:
#   make -C scripts/substrate sync-ias-executor-ts                  # all consumers
#   make -C scripts/substrate sync-ias-executor-ts RESTART=1        # restart each consumer's systemd unit too
#
# Consumers list lives at the top of this Makefile (IAS_CONSUMERS).
# -----------------------------------------------------------------------------
IAS_SRC := $(REPO_ROOT)/repos/ias-executor-ts

sync-ias-executor-ts:
	@echo "[ias] building dist on host…"
	@cd $(IAS_SRC) && bun run build >/dev/null
	@echo "[ias] pushing dist → /vessels/ias-executor-ts/dist"
	docker exec $(LIVE_NAME) rm -rf /vessels/ias-executor-ts/dist
	docker cp $(IAS_SRC)/dist $(LIVE_NAME):/vessels/ias-executor-ts/dist
	@for v in $(IAS_CONSUMERS); do \
	  target=/vessels/$$v/node_modules/@avigopal/ias-executor-ts/dist; \
	  if docker exec $(LIVE_NAME) test -d /vessels/$$v/node_modules/@avigopal/ias-executor-ts; then \
	    echo "[ias] pushing dist → $$target"; \
	    docker exec $(LIVE_NAME) rm -rf $$target; \
	    docker cp $(IAS_SRC)/dist $(LIVE_NAME):$$target; \
	  else \
	    echo "[ias] skip $$v (no @avigopal/ias-executor-ts in node_modules)"; \
	  fi; \
	done
	@if [ "$(RESTART)" = "1" ]; then \
	  for v in $(IAS_CONSUMERS); do \
	    if docker exec $(LIVE_NAME) systemctl list-unit-files $$v.service >/dev/null 2>&1; then \
	      echo "[ias] restarting $$v.service"; \
	      docker exec $(LIVE_NAME) systemctl restart $$v.service || echo "[ias] WARN: $$v restart failed"; \
	    fi; \
	  done; \
	fi
	@echo "[ias] sync complete"

# -----------------------------------------------------------------------------
# UI bridge: alpine/socat sidecar that publishes host port 18270 to the
# substrate-live container's internal port 8270 (stateful-ui-vessel).
#
# Why a sidecar instead of `docker run -p`? Adding a published port to a
# running container requires recreation, which destroys the in-memory state
# the substrate has been accumulating. The sidecar attaches to the docker
# bridge network, reaches substrate-live by its bridge IP, and publishes
# 18270 to the host — without touching substrate-live itself.
#
# Runs with --restart unless-stopped, so it survives docker daemon restarts.
# Operator opens http://localhost:18270/ — the substrate's face.
BRIDGE_NAME := stateful-ui-bridge
.PHONY: ui-bridge-up ui-bridge-down ui-bridge-status

ui-bridge-up:
	@docker rm -f $(BRIDGE_NAME) >/dev/null 2>&1 || true
	@CONTAINER_IP=$$(docker inspect $(LIVE_NAME) --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'); \
	if [ -z "$$CONTAINER_IP" ]; then echo "[ui-bridge-up] ERROR: substrate-live has no bridge IP — is it running?"; exit 1; fi; \
	echo "[ui-bridge-up] target: $$CONTAINER_IP:8270"; \
	docker run -d --name $(BRIDGE_NAME) --restart unless-stopped \
	  -p 18270:18270 alpine/socat:latest \
	  TCP-LISTEN:18270,reuseaddr,fork TCP:$$CONTAINER_IP:8270 >/dev/null
	@sleep 2
	@docker ps --filter name=$(BRIDGE_NAME) --format '[ui-bridge-up] {{.Names}} {{.Status}} {{.Ports}}'
	@curl -sf --max-time 4 http://localhost:18270/health >/dev/null && echo "[ui-bridge-up] http://localhost:18270/ reachable" || echo "[ui-bridge-up] WARNING: bridge up but vessel not reachable"

ui-bridge-down:
	@docker rm -f $(BRIDGE_NAME) >/dev/null 2>&1 && echo "[ui-bridge-down] removed" || echo "[ui-bridge-down] not running"

ui-bridge-status:
	@docker ps -a --filter name=$(BRIDGE_NAME) --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' || echo "(none)"
	@curl -sf --max-time 3 http://localhost:18270/health 2>&1 | head -1 || echo "[ui-bridge-status] vessel unreachable via host:18270"

# -----------------------------------------------------------------------------
# Writable vessel repo clones for substrate-managed publication.
#
# The substrate publishes artifacts (commits + PRs) via the
# `publish-substrate-authored-artifact` activity. The activity's variables
# (`cwd`, `owner`, `repo`, `target_path`, …) are vessel-agnostic — only the
# defaults change per repo. To author against an individual vessel repo
# (e.g. AviGopal/development-vessel), the substrate needs a writable clone
# with an HTTPS-with-token remote at /workspace/git/vessels/<vessel>/.
#
# These clones live under WORKSPACE (bind-mounted to /workspace inside the
# substrate container) and are gitignored from the super-repo. Run once per
# operator machine; re-running is a no-op if the clone already exists.
#
# Add a new vessel by appending another `if [ ! -d … ]; then git clone …; fi`
# block below. Only vessels with their OWN GitHub remote need a clone;
# vessels that live directly in the super-repo (e.g. goal-host-vessel,
# llm-resolver-vessel) are reached via /workspace/git/super-repo/repos/<v>/.
# -----------------------------------------------------------------------------
clone-vessel-repos:
	@command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI required"; exit 1; }
	@mkdir -p $(WORKSPACE)/git/vessels
	@GH_TOKEN_VAL=$$(gh auth token); \
	if [ ! -d $(WORKSPACE)/git/vessels/development-vessel/.git ]; then \
	  echo "[clone] development-vessel → $(WORKSPACE)/git/vessels/development-vessel"; \
	  git clone --no-recurse-submodules \
	    "https://x-access-token:$$GH_TOKEN_VAL@github.com/AviGopal/development-vessel.git" \
	    $(WORKSPACE)/git/vessels/development-vessel; \
	  git -C $(WORKSPACE)/git/vessels/development-vessel config user.email "substrate-live@substrate.local"; \
	  git -C $(WORKSPACE)/git/vessels/development-vessel config user.name "substrate-live"; \
	else \
	  echo "[clone] development-vessel already present (skipping)"; \
	fi
	@echo "[clone] vessel-repo clones ready; substrate can publish via cwd=/workspace/git/vessels/<vessel>"
