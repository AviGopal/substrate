# Makefile — substrate container lifecycle
#
# LLM provider — supply ONE of the following (or both; Anthropic is preferred):
#
#   Anthropic (default):
#     ANTHROPIC_API_KEY=sk-ant-...
#     Auto-read from ~/.metabob/config.json (.providers.anthropic.apiKey) if set.
#
#   OpenAI-compatible (OpenAI, Ollama, Groq, Together AI, LM Studio, vLLM, …):
#     OPENAI_API_KEY=sk-...          # or "ollama" / "lm-studio" / any placeholder
#     OPENAI_BASE_URL=http://...     # omit for api.openai.com; required for local models
#     LLM_DEFAULT_MODEL=gpt-4o      # optional — overrides claude-sonnet-4-6 default
#     Auto-read from ~/.metabob/config.json (.providers.openai.{apiKey,baseUrl,model}).
#
#   Examples:
#     make run-live ANTHROPIC_API_KEY=sk-ant-...
#     make run-live OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 LLM_DEFAULT_MODEL=llama3.2
#     make run-live OPENAI_API_KEY=sk-... LLM_DEFAULT_MODEL=gpt-4o
#
# All other secrets (JWT_SECRET, SURREAL_PASS, METABOB_API_KEY) are generated
# automatically on first run and persisted to workspace/.substrate-secrets so
# restarts reuse the same values without operator input.
#
# Quick start (one command — build/start/seed/verify are all handled):
#   make -C scripts/substrate up ANTHROPIC_API_KEY=sk-ant-...
# The system itself needs only `docker run` (see the `up` target header for the
# raw contract); seeding + readiness + diagnosis run in-container. The legacy
# 3-step (run-live / seed-live / configure-local.sh) still works unchanged.
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
# Volumes follow the container name so a second substrate (e.g. a spoke next
# to substrate-live) gets its own state; the default name keeps the historical
# volume names for existing installs. (LIVE_NAME is defined here, before the
# conditional, because ifeq evaluates at parse time.)
LIVE_NAME ?= substrate-live
ifeq ($(LIVE_NAME),substrate-live)
SURREAL_VOLUME   := substrate-surreal
WORKSPACE_VOLUME := substrate-workspace
else
SURREAL_VOLUME   := $(LIVE_NAME)-surreal
WORKSPACE_VOLUME := $(LIVE_NAME)-workspace
endif
# Legacy HOST paths — retained only as the migration source / offline backup
# (host-detach migrated their contents into the named volumes above). No longer
# mounted into the live container.
WORKSPACE    := $(shell pwd)/workspace
SURREAL_DATA := $(shell pwd)/surreal-data

# Vessels with @avigopal/ias-executor-ts as a `file:` dep. Bun copies dist
# physically per-consumer rather than symlinking, so rebuilds of the
# canonical package don't propagate. sync-ias-executor-ts pushes the new
# dist into every consumer's node_modules path inside the container.
IAS_CONSUMERS := goal-host-vessel ribosome-vessel boredom-vessel development-vessel local-tools-vessel llm-resolver-vessel analysis-vessel

# LLM provider credentials — read from environment first, then ~/.metabob/config.json.
# At least one of ANTHROPIC_API_KEY or OPENAI_API_KEY must be set.
ANTHROPIC_API_KEY ?= $(shell jq -r '.providers.anthropic.apiKey // empty' $(HOME)/.metabob/config.json 2>/dev/null || true)
OPENAI_API_KEY    ?= $(shell jq -r '.providers.openai.apiKey // empty'    $(HOME)/.metabob/config.json 2>/dev/null || true)
OPENAI_BASE_URL   ?= $(shell jq -r '.providers.openai.baseUrl // empty'   $(HOME)/.metabob/config.json 2>/dev/null || true)
LLM_DEFAULT_MODEL ?= $(shell jq -r '.providers.openai.model // empty'     $(HOME)/.metabob/config.json 2>/dev/null || true)

# GITHUB_TOKEN — load from environment, fall back to gh CLI's cached auth.
# Used by gh_repo_create resolver + gh_pr_create when authoring substrate-
# authored repos and PRs. Optional — when absent, gh_repo_create returns
# structuredError with detail "no GITHUB_TOKEN", and substrate can still
# author into existing repos via SSH-key-backed git push (which doesn't
# need this env var).
GITHUB_TOKEN ?= $(shell gh auth token 2>/dev/null || true)

# Vessel-subset topology + remote-endpoint overrides — durable support for
# running any subset of vessels, within or between containers/hosts. Empty by
# default: apply-inventory.sh treats unset/empty ENABLED_*/DISABLED_* as "keep
# everything", and gen-env.sh treats unset/empty endpoint vars as "use this
# container's own localhost vessel" — so nothing changes unless you set one.
#   ENABLED_ROLES=hub|spoke|full (or a role-GROUP alias from vessels.inventory.json)
#   ENABLED_VESSELS=unit,unit    explicit allow-list; overrides ENABLED_ROLES
#   DISABLED_VESSELS=unit,unit   always off, even if selected above
#   PEER_DISCOVERY_ENDPOINTS=http://host:18100[,http://host2:18100]  discovery peer fan-out
#   DISCOVERY_ENDPOINT / ACTIVITY_API_ENDPOINT / IDENTITY_VESSEL_URL / IDENTITY_ENDPOINT
#     point a compute-only spoke's control-plane calls at a remote hub instead
#     of this container's own discovery-vessel/activity-api/identity-vessel
#   SURREALDB_URL / REDIS_URL   point a compute-only spoke at a remote store
#   METABOB_API_KEY             a hub-issued key so this substrate's vessels land
#                                in the hub's org_id namespace instead of minting
#                                their own bootstrap key (unset = auto-generated
#                                locally, as before)
#
# Example — compute-only spoke joining a remote hub's namespace:
#   make run-live ANTHROPIC_API_KEY=... ENABLED_ROLES=spoke \
#     DISCOVERY_ENDPOINT=http://<hub-ip>:18100 ACTIVITY_API_ENDPOINT=http://<hub-ip>:18080 \
#     IDENTITY_VESSEL_URL=http://<hub-ip>:18101 METABOB_API_KEY=<hub-issued-key>
ENABLED_ROLES ?=
ENABLED_VESSELS ?=
DISABLED_VESSELS ?=
PEER_DISCOVERY_ENDPOINTS ?=
DISCOVERY_ENDPOINT ?=
ACTIVITY_API_ENDPOINT ?=
METABOB_ENDPOINT ?=
METABOB_API_KEY ?=
IDENTITY_VESSEL_URL ?=
IDENTITY_ENDPOINT ?=
SURREALDB_URL ?=
REDIS_URL ?=

# ── Two-command spoke UX ─────────────────────────────────────────────────────
# 1) make up API_KEY=<hub-issued> ANTHROPIC_API_KEY=<key> DISCOVERY_ENDPOINT=http://<hub>:18100
# 2) make vessel-ctl enable federation-transport-vessel FED_SUBSTRATE_ID=<unique-id> [RELAY_MULTIADDR=<addr>]
#
# API_KEY is the operator-facing alias for METABOB_API_KEY. A hub
# DISCOVERY_ENDPOINT with NO explicit ENABLED_ROLES implies a FEDERATED SPOKE:
# local registry + compute here, hub store/identity derived from the discovery
# host (fleet port convention 18080/18101). The hub URL reaches the container
# as HUB_DISCOVERY_URL — deliberately NOT as DISCOVERY_ENDPOINT, which would
# repoint every vessel's own registration away from the spoke's local registry
# (the federation-transport-vessel mirrors local capability to the hub instead).
# Passing ENABLED_ROLES explicitly keeps the old thin-spoke passthrough intact.
API_KEY ?=
ifneq ($(strip $(API_KEY)),)
METABOB_API_KEY := $(API_KEY)
endif
HUB_DISCOVERY_URL ?=
FED_SUBSTRATE_ID ?=
RELAY_MULTIADDR ?=
CONTAINER_DISCOVERY_ENDPOINT := $(DISCOVERY_ENDPOINT)
ifneq ($(strip $(DISCOVERY_ENDPOINT)),)
ifeq ($(strip $(ENABLED_ROLES)),)
ENABLED_ROLES := spoke
DISCOVERY_HOST := $(shell echo '$(DISCOVERY_ENDPOINT)' | sed -E 's#^[a-z]+://##; s#[:/].*##')
HUB_DISCOVERY_URL := http://$(DISCOVERY_HOST):18100
ACTIVITY_API_ENDPOINT := $(if $(strip $(ACTIVITY_API_ENDPOINT)),$(ACTIVITY_API_ENDPOINT),http://$(DISCOVERY_HOST):18080)
IDENTITY_VESSEL_URL := $(if $(strip $(IDENTITY_VESSEL_URL)),$(IDENTITY_VESSEL_URL),http://$(DISCOVERY_HOST):18101)
CONTAINER_DISCOVERY_ENDPOINT :=
endif
endif

# Host-port offset so a second substrate coexists with substrate-live
# (e.g. PORT_OFFSET=10000 → 28080/28100/28210/…). 0 = historical defaults.
PORT_OFFSET ?= 0
hp = $(shell expr $(1) + $(PORT_OFFSET))

# Vessel source roots (relative to repo root, two levels up)
REPO_ROOT := $(abspath $(CURDIR)/../..)
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

.PHONY: up ready doctor autonomy-status validate-build build build-obsidian run run-detach run-live run-live-obsidian migrate-state-to-volumes seed-live import-memory install-host-sync health health-live \
        ensure-key-tool show-key whoami issue-key issue-jwt list-keys revoke-key \
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

# --target base is load-bearing: without it docker builds the LAST stage
# (substrate-obsidian), silently making :dev and :obsidian the same image.
build: validate-build
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    --target base \
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
	@if [ -z "$(ANTHROPIC_API_KEY)" ] && [ -z "$(OPENAI_API_KEY)" ]; then \
	  echo "[substrate] ERROR: No LLM provider key found."; \
	  echo "  Anthropic:  make run ANTHROPIC_API_KEY=sk-ant-..."; \
	  echo "  OpenAI:     make run OPENAI_API_KEY=sk-..."; \
	  echo "  Ollama:     make run OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 LLM_DEFAULT_MODEL=llama3.2"; \
	  echo "  Or set .providers.anthropic.apiKey / .providers.openai.apiKey in ~/.metabob/config.json"; \
	  exit 1; \
	fi
	@mkdir -p $(WORKSPACE)
	docker run --rm -it \
	    --name substrate \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -e OPENAI_API_KEY="$(OPENAI_API_KEY)" \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
	    -p 8080:8080 \
	    -p 8090:8090 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)

run-detach:
	@if [ -z "$(ANTHROPIC_API_KEY)" ] && [ -z "$(OPENAI_API_KEY)" ]; then \
	  echo "[substrate] ERROR: No LLM provider key found."; \
	  echo "  Anthropic:  make run-detach ANTHROPIC_API_KEY=sk-ant-..."; \
	  echo "  OpenAI:     make run-detach OPENAI_API_KEY=sk-..."; \
	  echo "  Or set .providers.anthropic.apiKey / .providers.openai.apiKey in ~/.metabob/config.json"; \
	  exit 1; \
	fi
	@mkdir -p $(WORKSPACE)
	docker run -d \
	    --name substrate \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -e OPENAI_API_KEY="$(OPENAI_API_KEY)" \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
	    -p 8080:8080 \
	    -p 8090:8090 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)

# ── One-command launch (convenience wrapper over the self-contained contract) ─
# The SYSTEM's launch contract is just `docker run` — seeding
# (identity-seeder.service), readiness (substrate-ready.service + image
# HEALTHCHECK) and diagnosis (substrate-doctor) all run IN-CONTAINER; no host
# step below is load-bearing. Equivalent raw contract on any docker host:
#
#   docker run -d --privileged --name substrate-live \
#     -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
#     -e ANTHROPIC_API_KEY=sk-ant-... \
#     -p 18080:8080 -p 18090:8090 -p 18100:8100 -p 18210:8210 \
#     --tmpfs /run --tmpfs /run/lock metabob/substrate:dev
#
# `make up` wraps that with: build-if-missing, start-or-create, readiness wait,
# old-image seed fallback, IDE config, doctor. REBUILD=1 forces an image build.
up:
	@docker image inspect $(IMAGE):$(TAG) >/dev/null 2>&1 || $(MAKE) build
	@if [ "$(REBUILD)" = "1" ]; then $(MAKE) build; fi
	@if docker ps --format '{{.Names}}' | grep -qx "$(LIVE_NAME)"; then \
	  echo "[up] $(LIVE_NAME) already running"; \
	elif docker ps -a --format '{{.Names}}' | grep -qx "$(LIVE_NAME)"; then \
	  echo "[up] starting existing container $(LIVE_NAME)"; docker start $(LIVE_NAME) >/dev/null; \
	else \
	  $(MAKE) run-live; \
	fi
	@echo "[up] waiting for fleet readiness (up to 240s)..."
	@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-ready.sh --timeout 240 || true
	@if ! docker exec $(LIVE_NAME) test -x /usr/local/bin/reseed-restart 2>/dev/null; then \
	  echo "[up] image predates identity-seeder — running seed-live fallback (idempotent)"; \
	  $(MAKE) seed-live || true; \
	fi
	@if [ "$(LIVE_NAME)" = "substrate-live" ]; then \
	  $(CURDIR)/configure-local.sh >/dev/null 2>&1 && echo "[up] ~/.metabob/config.json updated (operator IDE convenience)" || echo "[up] configure-local skipped"; \
	else \
	  echo "[up] secondary container ($(LIVE_NAME)) — leaving ~/.metabob/config.json untouched"; \
	fi
	@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-doctor.sh

# Fleet readiness matrix (host wrapper; in-container: /usr/local/bin/substrate-ready)
ready:
	@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-ready.sh --once

# Deep diagnosis incl. surreal-auth drift, seeded-key validity, hollow registry,
# failed units. `make doctor SMOKE=1` also dispatches a goal end-to-end.
doctor:
	@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-doctor.sh $(if $(filter 1,$(SMOKE)),--smoke,)

# ── substrate-live container (persistent, host ports 18080/18090/18100) ─────
# Primary target for all local development iteration.
# Run once; use sync-*/restart-* targets to hot-reload vessels without rebuild.

run-live:
	@if [ -z "$(ANTHROPIC_API_KEY)" ] && [ -z "$(OPENAI_API_KEY)" ]; then \
	  echo "[substrate] ERROR: No LLM provider key found. Provide at least one:"; \
	  echo "  Anthropic:  make run-live ANTHROPIC_API_KEY=sk-ant-..."; \
	  echo "  OpenAI:     make run-live OPENAI_API_KEY=sk-..."; \
	  echo "  Ollama:     make run-live OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 LLM_DEFAULT_MODEL=llama3.2"; \
	  echo "  Or set .providers.anthropic.apiKey / .providers.openai.apiKey in ~/.metabob/config.json"; \
	  exit 1; \
	fi
	@docker volume create $(SURREAL_VOLUME) >/dev/null
	@docker volume create $(WORKSPACE_VOLUME) >/dev/null
	docker run -d \
	    --name $(LIVE_NAME) \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -e OPENAI_API_KEY="$(OPENAI_API_KEY)" \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
	    -e SUBSTRATE_GIT_PAT="$(SUBSTRATE_GIT_PAT)" \
	    -e SUBSTRATE_ROOT="/workspace/git/super-repo" \
	    -e ENABLED_ROLES="$(ENABLED_ROLES)" \
	    -e ENABLED_VESSELS="$(ENABLED_VESSELS)" \
	    -e DISABLED_VESSELS="$(DISABLED_VESSELS)" \
	    -e PEER_DISCOVERY_ENDPOINTS="$(PEER_DISCOVERY_ENDPOINTS)" \
	    -e DISCOVERY_ENDPOINT="$(CONTAINER_DISCOVERY_ENDPOINT)" \
	    -e HUB_DISCOVERY_URL="$(HUB_DISCOVERY_URL)" \
	    -e FED_SUBSTRATE_ID="$(FED_SUBSTRATE_ID)" \
	    -e RELAY_MULTIADDR="$(RELAY_MULTIADDR)" \
	    -e ACTIVITY_API_ENDPOINT="$(ACTIVITY_API_ENDPOINT)" \
	    -e METABOB_ENDPOINT="$(METABOB_ENDPOINT)" \
	    -e IDENTITY_VESSEL_URL="$(IDENTITY_VESSEL_URL)" \
	    -e IDENTITY_ENDPOINT="$(IDENTITY_ENDPOINT)" \
	    -e SURREALDB_URL="$(SURREALDB_URL)" \
	    -e REDIS_URL="$(REDIS_URL)" \
	    -e METABOB_API_KEY="$(METABOB_API_KEY)" \
	    -p $(call hp,18080):8080 \
	    -p $(call hp,18090):8090 \
	    -p $(call hp,18100):8100 \
	    -p $(call hp,18210):8210 \
	    -p $(call hp,18250):8250 \
	    -p $(call hp,18260):8260 \
	    -p $(call hp,18270):8270 \
	    -v $(WORKSPACE_VOLUME):/workspace \
	    -v $(SURREAL_VOLUME):/var/lib/surrealdb \
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
	@if [ -z "$(ANTHROPIC_API_KEY)" ] && [ -z "$(OPENAI_API_KEY)" ]; then \
	  echo "[substrate] ERROR: No LLM provider key found. Provide at least one:"; \
	  echo "  Anthropic:  make run-live-obsidian ANTHROPIC_API_KEY=sk-ant-..."; \
	  echo "  OpenAI:     make run-live-obsidian OPENAI_API_KEY=sk-..."; \
	  echo "  Or set .providers.anthropic.apiKey / .providers.openai.apiKey in ~/.metabob/config.json"; \
	  exit 1; \
	fi
	@docker volume create $(SURREAL_VOLUME) >/dev/null
	@docker volume create $(WORKSPACE_VOLUME) >/dev/null
	docker run -d \
	    --name $(LIVE_NAME) \
	    --privileged \
	    -e ANTHROPIC_API_KEY="$(ANTHROPIC_API_KEY)" \
	    -e OPENAI_API_KEY="$(OPENAI_API_KEY)" \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN="$(GITHUB_TOKEN)" \
	    -e SUBSTRATE_GIT_PAT="$(SUBSTRATE_GIT_PAT)" \
	    -e SUBSTRATE_ROOT="/workspace/git/super-repo" \
	    -e ENABLED_ROLES="$(ENABLED_ROLES)" \
	    -e ENABLED_VESSELS="$(ENABLED_VESSELS)" \
	    -e DISABLED_VESSELS="$(DISABLED_VESSELS)" \
	    -e PEER_DISCOVERY_ENDPOINTS="$(PEER_DISCOVERY_ENDPOINTS)" \
	    -e DISCOVERY_ENDPOINT="$(CONTAINER_DISCOVERY_ENDPOINT)" \
	    -e HUB_DISCOVERY_URL="$(HUB_DISCOVERY_URL)" \
	    -e FED_SUBSTRATE_ID="$(FED_SUBSTRATE_ID)" \
	    -e RELAY_MULTIADDR="$(RELAY_MULTIADDR)" \
	    -e ACTIVITY_API_ENDPOINT="$(ACTIVITY_API_ENDPOINT)" \
	    -e METABOB_ENDPOINT="$(METABOB_ENDPOINT)" \
	    -e IDENTITY_VESSEL_URL="$(IDENTITY_VESSEL_URL)" \
	    -e IDENTITY_ENDPOINT="$(IDENTITY_ENDPOINT)" \
	    -e SURREALDB_URL="$(SURREALDB_URL)" \
	    -e REDIS_URL="$(REDIS_URL)" \
	    -e METABOB_API_KEY="$(METABOB_API_KEY)" \
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

# ── Key / token surface ─────────────────────────────────────────────────────
# Human-friendly wrappers around the in-container `substrate-key` tool
# (identity-vessel is internal-only, so issuance must run inside the container).
# On images that predate the baked tool, the script is copied in first.
#
#   make show-key                                  print the operator API key
#   make issue-key NAME=my-peer [SCOPES=read,write] [EXPIRES_DAYS=30]
#   make issue-jwt [ROLE=admin] [EXPIRES_SECONDS=900]
#   make list-keys
#   make revoke-key KEY_ID=key_xxx
NAME ?=
SCOPES ?= read,write
EXPIRES_DAYS ?=
ROLE ?= admin
EXPIRES_SECONDS ?= 900
KEY_ID ?=

ensure-key-tool:
	@docker exec $(LIVE_NAME) test -x /usr/local/bin/substrate-key 2>/dev/null || \
	  { echo "[keys] baking substrate-key into running container (image predates it)"; \
	    docker cp $(CURDIR)/substrate-key.sh $(LIVE_NAME):/usr/local/bin/substrate-key; \
	    docker exec $(LIVE_NAME) chmod +x /usr/local/bin/substrate-key; }

show-key: ensure-key-tool
	@docker exec $(LIVE_NAME) substrate-key show

whoami: ensure-key-tool
	@docker exec $(LIVE_NAME) substrate-key whoami

issue-key: ensure-key-tool
	@test -n "$(NAME)" || { echo "usage: make issue-key NAME=<key-name> [SCOPES=read,write] [EXPIRES_DAYS=30]"; exit 1; }
	@docker exec $(LIVE_NAME) substrate-key issue "$(NAME)" "$(SCOPES)" "$(EXPIRES_DAYS)"

issue-jwt: ensure-key-tool
	@docker exec $(LIVE_NAME) substrate-key jwt "$(ROLE)" "$(EXPIRES_SECONDS)"

list-keys: ensure-key-tool
	@docker exec $(LIVE_NAME) substrate-key list

revoke-key: ensure-key-tool
	@test -n "$(KEY_ID)" || { echo "usage: make revoke-key KEY_ID=key_xxx (find ids via make list-keys)"; exit 1; }
	@docker exec $(LIVE_NAME) substrate-key revoke "$(KEY_ID)"

# Render the host-side systemd unit templates (*.service.in) with the real repo
# root and install them under ~/.config/systemd/user/, alongside the (path-free)
# .timer units. systemd does not expand env vars or relative paths in unit-file
# locations, so the absolute ExecStart/WorkingDirectory must be baked in here.
USER_SYSTEMD_DIR := $(HOME)/.config/systemd/user
install-host-sync:
	@mkdir -p "$(USER_SYSTEMD_DIR)"
	sed 's#@SUBSTRATE_ROOT@#$(REPO_ROOT)#g' $(CURDIR)/host-sync-poller.service.in > "$(USER_SYSTEMD_DIR)/host-sync-poller.service"
	sed 's#@SUBSTRATE_ROOT@#$(REPO_ROOT)#g' $(CURDIR)/host-pull-sync.service.in   > "$(USER_SYSTEMD_DIR)/host-pull-sync.service"
	ln -sf $(CURDIR)/host-sync-poller.timer "$(USER_SYSTEMD_DIR)/host-sync-poller.timer"
	ln -sf $(CURDIR)/host-pull-sync.timer   "$(USER_SYSTEMD_DIR)/host-pull-sync.timer"
	systemctl --user daemon-reload
	@echo "[install-host-sync] Installed. Enable with:"
	@echo "  systemctl --user enable --now host-sync-poller.timer host-pull-sync.timer"

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
	docker exec $(LIVE_NAME) rm -rf /vessels/obsidian-vessel/src
	docker cp $(OBSIDIAN_VESSEL_SRC)/src $(LIVE_NAME):/vessels/obsidian-vessel/src
	docker cp $(OBSIDIAN_VESSEL_SRC)/styles.css $(LIVE_NAME):/vessels/obsidian-vessel/styles.css
	docker cp $(OBSIDIAN_VESSEL_SRC)/esbuild.config.mjs $(LIVE_NAME):/vessels/obsidian-vessel/esbuild.config.mjs
	docker cp $(OBSIDIAN_VESSEL_SRC)/manifest.json $(LIVE_NAME):/vessels/obsidian-vessel/manifest.json
	docker cp $(OBSIDIAN_VESSEL_SRC)/package.json $(LIVE_NAME):/vessels/obsidian-vessel/package.json
	docker cp $(OBSIDIAN_VESSEL_SRC)/tsconfig.json $(LIVE_NAME):/vessels/obsidian-vessel/tsconfig.json
	docker exec $(LIVE_NAME) mkdir -p /vessels/obsidian-vessel/sidecar
	docker cp $(OBSIDIAN_VESSEL_SRC)/sidecar/federation-sidecar.ts $(LIVE_NAME):/vessels/obsidian-vessel/sidecar/federation-sidecar.ts
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
# Fork override: set SUBSTRATE_REPO_OWNER=<your-org> to clone vessels from your fork.
SUBSTRATE_REPO_OWNER ?= AviGopal
clone-vessel-repos:
	@command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI required"; exit 1; }
	@mkdir -p $(WORKSPACE)/git/vessels
	@GH_TOKEN_VAL=$$(gh auth token); \
	if [ ! -d $(WORKSPACE)/git/vessels/development-vessel/.git ]; then \
	  echo "[clone] development-vessel → $(WORKSPACE)/git/vessels/development-vessel"; \
	  git clone --no-recurse-submodules \
	    "https://x-access-token:$$GH_TOKEN_VAL@github.com/$(SUBSTRATE_REPO_OWNER)/development-vessel.git" \
	    $(WORKSPACE)/git/vessels/development-vessel; \
	  git -C $(WORKSPACE)/git/vessels/development-vessel config user.email "substrate-live@substrate.local"; \
	  git -C $(WORKSPACE)/git/vessels/development-vessel config user.name "substrate-live"; \
	else \
	  echo "[clone] development-vessel already present (skipping)"; \
	fi
	@echo "[clone] vessel-repo clones ready; substrate can publish via cwd=/workspace/git/vessels/<vessel>"

# ── General vessel install / uninstall (driven by vessels.manifest.json) ──────
# One method to add/remove a DYNAMIC vessel (federation, future) from the substrate
# container, reusing the unit-install pattern + the single secrets place (secrets.env.sh).
# Operator-runnable AND activity-dispatchable (the substrate calls vessel-ctl.sh via
# local-tools-vessel's shell resolver). Works against any --container (basis for remote).
# Passthrough UX (two-command spoke setup, command 2):
#   make vessel-ctl enable federation-transport-vessel FED_SUBSTRATE_ID=<unique-id> [RELAY_MULTIADDR=<addr>]
#   make vessel-ctl enable|disable <any-manifest-vessel>
# The extra words on the command line are absorbed by a no-op rule below.
VC_ARGS := $(filter-out vessel-ctl,$(MAKECMDGOALS))
.PHONY: vessel-ctl
vessel-ctl:
	@action="$(word 1,$(VC_ARGS))"; vessel="$(word 2,$(VC_ARGS))"; \
	test -n "$$action" && test -n "$$vessel" || { echo "usage: make vessel-ctl enable|disable <vessel> [FED_SUBSTRATE_ID=<id>] [RELAY_MULTIADDR=<addr>]"; exit 2; }; \
	case "$$action:$$vessel" in \
	  enable:federation-transport-vessel) \
	    test -n "$(FED_SUBSTRATE_ID)" || { echo "FED_SUBSTRATE_ID=<unique-id> required (unique per substrate; e.g. ben-windows-spoke)"; exit 2; }; \
	    $(CURDIR)/spoke-federate.sh $(LIVE_NAME) "$(FED_SUBSTRATE_ID)" "$(RELAY_MULTIADDR)" ;; \
	  enable:*)  $(CURDIR)/vessel-ctl.sh install "$$vessel" --container $(LIVE_NAME) ;; \
	  disable:*) $(CURDIR)/vessel-ctl.sh uninstall "$$vessel" --container $(LIVE_NAME) ;; \
	  *) echo "unknown vessel-ctl action '$$action' (enable|disable)"; exit 2 ;; \
	esac
ifneq ($(filter vessel-ctl,$(MAKECMDGOALS)),)
.PHONY: $(VC_ARGS)
$(VC_ARGS):
	@:
endif

.PHONY: list-vessels install-vessel uninstall-vessel
list-vessels:
	@$(CURDIR)/vessel-ctl.sh list --container $(LIVE_NAME)
install-vessel:
	@test -n "$(VESSEL)" || { echo "usage: make install-vessel VESSEL=<name>"; exit 1; }
	@$(CURDIR)/vessel-ctl.sh install $(VESSEL) --container $(LIVE_NAME)
uninstall-vessel:
	@test -n "$(VESSEL)" || { echo "usage: make uninstall-vessel VESSEL=<name>"; exit 1; }
	@$(CURDIR)/vessel-ctl.sh uninstall $(VESSEL) --container $(LIVE_NAME)

# Sync a dynamic vessel: ff-pull its in-container clone, mirror into the live
# runtime, restart (all in-container; no host source involved).
.PHONY: sync-vessel
sync-vessel:
	@test -n "$(VESSEL)" || { echo "usage: make sync-vessel VESSEL=<name>"; exit 1; }
	@$(CURDIR)/vessel-ctl.sh sync $(VESSEL) --container $(LIVE_NAME)
