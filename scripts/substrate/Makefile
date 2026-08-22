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
# raw contract); seeding + readiness + diagnosis run in-container.
#
# ─────────────────────────────────────────────────────────────────────────────
# THIS MAKEFILE IS THE BOOTSTRAP TIER ONLY: build, up, recreate, stop, clean —
# the things that must happen BEFORE a container exists to be talked to.
#
# Everything a RUNNING fleet does is `vessel-ctl`, which ships in the image:
#
#   docker exec <container> vessel-ctl status | restart <v> | logs <v> | sync <v>
#   docker exec <container> vessel-ctl install <v> | uninstall <v> | list
#   docker exec <container> vessel-ctl apply | drift
#   docker exec <container> substrate-doctor | substrate-ready | substrate-key …
#
# This Makefile used to carry ~40 hand-enumerated restart-/logs-/sync-<vessel>
# targets covering 11 of 65 units, plus wrappers around every in-image tool.
# Two surfaces for one job is how they drift: `health` probed hardcoded 18xxx
# ports while claiming to honour LIVE_NAME, so on a multi-instance host it
# reported a DIFFERENT fleet than the one you named. They are deleted, not
# deprecated. Do not reintroduce a wrapper here for something the image ships —
# the in-image tool works over ssh, on a hub, and in a container you did not
# build, and it names its instance in the command itself.
# ─────────────────────────────────────────────────────────────────────────────
#
# Two container flavours:
#   substrate       — interactive / ephemeral dev container (port 8080)
#   substrate-live  — persistent development substrate (port 18080)

IMAGE        := ghcr.io/avigopal/substrate
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


# LLM provider credentials — read from environment first, then ~/.metabob/config.json.
# A standalone or hub needs one local provider key. A federated spoke inherits
# its hub's LLM capability and therefore needs no local provider key.
ANTHROPIC_API_KEY ?= $(shell jq -r '.providers.anthropic.apiKey // empty' $(HOME)/.metabob/config.json 2>/dev/null || true)
OPENAI_API_KEY    ?= $(shell jq -r '.providers.openai.apiKey // empty'    $(HOME)/.metabob/config.json 2>/dev/null || true)
OPENAI_BASE_URL   ?= $(shell jq -r '.providers.openai.baseUrl // empty'   $(HOME)/.metabob/config.json 2>/dev/null || true)
LLM_DEFAULT_MODEL ?= $(shell jq -r '.providers.openai.model // empty'     $(HOME)/.metabob/config.json 2>/dev/null || true)

# OpenAI-wire completion providers (llm-resolver-vessel OPENAI_WIRE_PROVIDERS).
# These are the failover ladder BELOW anthropic: when the anthropic key goes
# credit-dead the resolver walks chutes -> groq -> mistral -> openrouter/gemini,
# and de-advertises llm_completion entirely if every lane is cold. gen-env.sh
# already resolves (:177-181), emits (:269-273) and persists (:494) all five —
# the ONLY missing link was that the docker run recipes below never passed them,
# so the ladder could never have a rung even when the operator supplied a key.
# Declared with ?= so `make up GROQ_API_KEY=…` and a plain env var both work.
CHUTES_API_KEY     ?=
OPENROUTER_API_KEY ?=
GOOGLE_API_KEY     ?=
GROQ_API_KEY       ?=
MISTRAL_API_KEY    ?=
# RunPod Serverless — same ladder, same failure mode if a recipe forgets to pass
# them. ENDPOINT_ID is not a secret but is load-bearing: llm-resolver-vessel
# registers the arm only when it is set, so dropping it silently removes the lane.
RUNPOD_API_KEY        ?=
RUNPOD_ENDPOINT_ID    ?=
RUNPOD_MODELS         ?=
RUNPOD_COST_PER_MTOK  ?=

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
# ENABLED_EXTRA_VESSELS and PROFILE were carried by RECREATE_CARRY and read by
# apply-inventory, but declared nowhere and passed by no recipe — so the additive
# selection knob had NO delivery path on the make lane at all, and `recreate`
# carried them into a recipe that dropped them. Compose was the only lane that
# ever delivered PROFILE. config-surface-probe.sh now reports both.
ENABLED_EXTRA_VESSELS ?=
PROFILE ?=
PEER_DISCOVERY_ENDPOINTS ?=
DISCOVERY_ENDPOINT ?=
ACTIVITY_API_ENDPOINT ?=
METABOB_ENDPOINT ?=
METABOB_API_KEY ?=
IDENTITY_VESSEL_URL ?=
IDENTITY_ENDPOINT ?=
SURREALDB_URL ?=
REDIS_URL ?=

# ── Point-and-go spoke UX ────────────────────────────────────────────────────
# 1) make up API_KEY=<hub-issued> DISCOVERY_ENDPOINT=http://<hub>:18100
#    That is the WHOLE second-command step: a spoke boot with HUB_DISCOVERY_URL
#    set now AUTO-enables federation-transport-vessel at boot (entrypoint.sh) and
#    gen-env.sh auto-assigns a unique FED_SUBSTRATE_ID + FED_VESSEL_ID.
# 2) (OPTIONAL override) docker exec <container> spoke-federate <container> <unique-id> [<relay-multiaddr>]
#    Only needed to PIN a specific substrate id or run the hub-side collision
#    check (see spoke-federate.sh) — NOT a required step. The auto-enable at
#    boot already stands the transport up.
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
# ★ KEEP THE PORT THE OPERATOR SUPPLIED. This block used to take only the HOST
# and hardcode :18100/:18080/:18101, so a hub published on any other port was
# unjoinable — and on a host running several substrates the spoke silently
# joined whichever fleet occupied 18100, presenting later as an inexplicable
# 401 from a key the "wrong" hub never issued. Measured: DISCOVERY_ENDPOINT
# =http://172.17.0.1:23100 produced HUB_DISCOVERY_URL=http://172.17.0.1:18100.
# A deployment shifts the whole 18xxx block by one PORT_OFFSET, so the offset is
# recoverable from the discovery port: offset = port - 18100, applied to the
# siblings. Below the block (a proxy on 443, a tunnel on 8443) is not offset
# arithmetic — keep the supplied hub port, leave the siblings conventional, and
# let the explicit ACTIVITY_API_ENDPOINT / IDENTITY_VESSEL_URL overrides win.
# gen-env.sh carries the same rule for the raw `docker run` path; both layers
# need it, because this one blanks CONTAINER_DISCOVERY_ENDPOINT and gen-env
# therefore never sees the endpoint on the make path.
# NOTE FOR EDITORS: keep `case`, `$$(( ))` and any bare `)` OUT of these $(shell)
# bodies. Make parses parentheses before the shell ever sees them, so a `case`
# arm silently truncates the command and the port comes out as fragments of the
# case statement itself. Use sed | grep | expr with if/then/fi only.
DISCOVERY_PORT := $(shell echo '$(DISCOVERY_ENDPOINT)' | sed -E 's#^[a-z]+://##; s#^[^:/]*##; s#^:##; s#/.*##' | grep -E '^[0-9]+$$' || echo 18100)
# 47534 == 65535 - 18101, so the highest derived sibling still fits in a port.
# This bound MUST match gen-env.sh's exactly — same rule, two launch paths. They
# briefly disagreed (65535 vs 47534) and a discovery port above 47534 then
# derived different siblings depending on which path you launched through.
PORT_BLOCK_OFF := $(shell if [ '$(DISCOVERY_PORT)' -ge 18100 ] && [ '$(DISCOVERY_PORT)' -le 47534 ]; then expr '$(DISCOVERY_PORT)' - 18100; else echo 0; fi)
# Preserve the scheme: hardcoding http:// silently downgraded a TLS-fronted hub,
# keeping the port and losing the encryption — a failure that looks like success.
DISCOVERY_SCHEME := $(shell echo '$(DISCOVERY_ENDPOINT)' | sed -nE 's#^([a-z]+)://.*#\1#p' | grep -E '^[a-z]+$$' || echo http)
HUB_DISCOVERY_URL := $(DISCOVERY_SCHEME)://$(DISCOVERY_HOST):$(DISCOVERY_PORT)
ACTIVITY_API_ENDPOINT := $(if $(strip $(ACTIVITY_API_ENDPOINT)),$(ACTIVITY_API_ENDPOINT),$(DISCOVERY_SCHEME)://$(DISCOVERY_HOST):$(shell expr 18080 + '$(PORT_BLOCK_OFF)'))
IDENTITY_VESSEL_URL := $(if $(strip $(IDENTITY_VESSEL_URL)),$(IDENTITY_VESSEL_URL),$(DISCOVERY_SCHEME)://$(DISCOVERY_HOST):$(shell expr 18101 + '$(PORT_BLOCK_OFF)'))
CONTAINER_DISCOVERY_ENDPOINT :=
endif
endif

# A spoke inherits LLM capability from its hub, so it does not need a local
# provider credential. Standalone containers retain the local-key requirement.
FEDERATED_SPOKE := $(strip $(DISCOVERY_ENDPOINT) $(HUB_DISCOVERY_URL))
# These inputs change a container's immutable Docker configuration. `up` may
# safely resume a stopped container only when no such override was supplied.
# EXPORTED, NOT INTERPOLATED.
#
# Every recipe below passes these with a bare `-e VAR` (docker reads the value
# from the recipe's environment) instead of `-e VAR="$(VAR)"`. The interpolated
# form expanded the operator's real 108-char Anthropic key and 40-char GitHub
# token into the recipe TEXT, so `make -n up` printed both in cleartext — and an
# `@` prefix does NOT fix that, because `make -n` prints @-prefixed lines too.
# `export` keeps the delivered value identical, including when it is empty.
export ANTHROPIC_API_KEY OPENAI_API_KEY CHUTES_API_KEY OPENROUTER_API_KEY
export GOOGLE_API_KEY GROQ_API_KEY MISTRAL_API_KEY RUNPOD_API_KEY
export GITHUB_TOKEN SUBSTRATE_GIT_PAT API_KEY_SECRET METABOB_API_KEY

LAUNCH_OVERRIDES := $(strip $(API_KEY) $(METABOB_API_KEY) $(DISCOVERY_ENDPOINT) $(HUB_DISCOVERY_URL) $(FED_SUBSTRATE_ID) $(RELAY_MULTIADDR) $(ENABLED_ROLES) $(ENABLED_VESSELS) $(DISABLED_VESSELS) $(PEER_DISCOVERY_ENDPOINTS) $(ACTIVITY_API_ENDPOINT) $(IDENTITY_VESSEL_URL) $(IDENTITY_ENDPOINT) $(SURREALDB_URL) $(REDIS_URL))

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
HUMAN_SURFACE_VESSEL_SRC := $(REPO_ROOT)/repos/human-surface-vessel
OBSIDIAN_VESSEL_SRC := $(REPO_ROOT)/repos/obsidian-vessel


# Submodule preflight: the Dockerfile `COPY repos/...` stages fail minutes into
# the build if the git submodules were never checked out. Fail fast (<1s) with
# the exact remedy instead. Grounded on a real submodule file (discovery-vessel's
# package.json); its absence means `git submodule update --init` was never run.
# Only REAL targets belong here. A deleted target left in .PHONY does not
# error — make reports "Nothing to be done" and EXITS 0, so every removed
# command silently SUCCEEDS doing nothing. `make doctor` on a broken fleet
# would print nothing and return 0, which reads as a pass. Deleted names
# must fail loudly with "No rule to make target".
# Disable make's built-in suffix rules.
#
# Without this, `make vessel-ctl` matches the built-in `%: %.sh` rule against
# vessel-ctl.sh, runs `cat vessel-ctl.sh >vessel-ctl`, and EXITS 0 — a
# documented-but-nonexistent target silently succeeding, which is the same
# defect class as the .PHONY names that used to print "Nothing to be done".
# Verified: deleting the passthrough absorber alone does NOT close it; the bare
# form `make -n vessel-ctl` still copies the script and returns 0.
.SUFFIXES:

.PHONY: build build-obsidian clean clean-live clone-vessel-repos migrate-state-to-volumes preflight-submodules recreate run run-detach run-live run-live-obsidian stop stop-live ui-bridge-down ui-bridge-status ui-bridge-up up validate-build

preflight-submodules:
	@if [ ! -f $(REPO_ROOT)/repos/discovery-vessel/package.json ]; then \
	  echo "[preflight] ERROR: git submodules not checked out (repos/discovery-vessel/package.json missing)."; \
	  echo "[preflight] remedy: git submodule update --init --recursive"; \
	  exit 1; \
	fi

# Fast preflight: assert every containerized vessel is build-valid (file: deps
# resolve, frozen lockfiles are in sync, imports match dependency keys). Catches
# the namespace-migration breakages that only surface inside the image build.
validate-build: preflight-submodules
	bun $(CURDIR)/validate-build.ts

# --target base is load-bearing: without it docker builds the LAST stage
# (substrate-obsidian), silently making :dev and :obsidian the same image.
build: validate-build
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    --target base \
	    -t $(IMAGE):$(TAG) \
	    $(CURDIR)/../..

# substrate-obsidian flavour: base fleet + in-container Obsidian desktop served
# over noVNC. Tagged ghcr.io/avigopal/substrate:obsidian.
OBSIDIAN_TAG := obsidian
build-obsidian:
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    --target substrate-obsidian \
	    -t $(IMAGE):$(OBSIDIAN_TAG) \
	    $(CURDIR)/../..

run:
	@if [ -z "$${ANTHROPIC_API_KEY}" ] && [ -z "$${OPENAI_API_KEY}" ]; then \
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
	    -e ANTHROPIC_API_KEY \
	    -e OPENAI_API_KEY \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e CHUTES_API_KEY \
	    -e OPENROUTER_API_KEY \
	    -e GOOGLE_API_KEY \
	    -e GROQ_API_KEY \
	    -e MISTRAL_API_KEY \
	    -e RUNPOD_API_KEY \
	    -e RUNPOD_ENDPOINT_ID="$(RUNPOD_ENDPOINT_ID)" \
	    -e RUNPOD_MODELS="$(RUNPOD_MODELS)" \
	    -e RUNPOD_COST_PER_MTOK="$(RUNPOD_COST_PER_MTOK)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN \
	    -p 8080:8080 \
	    -p 8090:8090 \
	    -v $(WORKSPACE):/workspace \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)

run-detach:
	@if [ -z "$${ANTHROPIC_API_KEY}" ] && [ -z "$${OPENAI_API_KEY}" ]; then \
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
	    -e ANTHROPIC_API_KEY \
	    -e OPENAI_API_KEY \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e CHUTES_API_KEY \
	    -e OPENROUTER_API_KEY \
	    -e GOOGLE_API_KEY \
	    -e GROQ_API_KEY \
	    -e MISTRAL_API_KEY \
	    -e RUNPOD_API_KEY \
	    -e RUNPOD_ENDPOINT_ID="$(RUNPOD_ENDPOINT_ID)" \
	    -e RUNPOD_MODELS="$(RUNPOD_MODELS)" \
	    -e RUNPOD_COST_PER_MTOK="$(RUNPOD_COST_PER_MTOK)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN \
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
#     -p 18250:8250 -p 18260:8260 -p 18270:8270 \
#     --tmpfs /run --tmpfs /run/lock ghcr.io/avigopal/substrate:dev
#
# `make up` wraps that with: build-if-missing, start-or-create, readiness wait,
# old-image seed fallback, IDE config, doctor. A stopped container can be resumed
# only without new launch settings; use `make recreate` to apply changed settings
# while retaining its named volumes. REBUILD=1 forces an image build.
up:
	@docker image inspect $(IMAGE):$(TAG) >/dev/null 2>&1 || $(MAKE) build
	@if [ "$(REBUILD)" = "1" ]; then $(MAKE) build; fi
	@if docker ps --format '{{.Names}}' | grep -qx "$(LIVE_NAME)"; then \
	  echo "[up] $(LIVE_NAME) already running"; \
	elif docker ps -a --format '{{.Names}}' | grep -qx "$(LIVE_NAME)"; then \
	  if [ -n "$(LAUNCH_OVERRIDES)" ]; then \
	    echo "[up] ERROR: $(LIVE_NAME) is stopped and supplied launch settings would be ignored."; \
	    echo "[up] Recreate it without deleting named volumes:"; \
	    echo "  make -C scripts/substrate recreate <the same settings>"; \
	    exit 1; \
	  fi; \
	  echo "[up] starting existing container $(LIVE_NAME)"; docker start $(LIVE_NAME) >/dev/null; \
	else \
	  $(MAKE) run-live; \
	fi
	@echo "[up] waiting for fleet readiness (up to 240s)..."
	@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-ready.sh --timeout 240 || true
	@if [ "$(LIVE_NAME)" = "substrate-live" ]; then \
	  $(CURDIR)/configure-local.sh >/dev/null 2>&1 && echo "[up] ~/.metabob/config.json updated (operator IDE convenience)" || echo "[up] configure-local skipped"; \
	else \
	  echo "[up] secondary container ($(LIVE_NAME)) — leaving ~/.metabob/config.json untouched"; \
	fi
	@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-doctor.sh

# Replace the container while preserving its named workspace and datastore
# volumes, so supplied Docker launch settings are applied deterministically.
# RECREATE MUST CARRY THE OLD CONTAINER'S IDENTITY FORWARD, OR IT CHANGES WHAT THE BOX IS.
#
# ENABLED_ROLES / DISABLED_VESSELS / PROFILE are launch-time arguments (`ENABLED_ROLES ?=`)
# that nothing persists. They decide which units this deployment runs — i.e. whether it is a
# hub, a spoke, or a full standalone. `recreate` removes the container and re-runs, so any of
# them not re-supplied on the command line is silently dropped and the box comes back as the
# documented default: every unit enabled.
#
# Measured 2026-08-18. A `make recreate` issued to add a port mapping converted a SPOKE into a
# standalone substrate: ENABLED_ROLES went from "spoke" to empty, apply-inventory stopped
# masking the store roles, surrealdb and activity-api un-masked, goal-host's endpoints moved
# from the hub to 127.0.0.1, and federation-transport went inactive. The fleet looked HEALTHIER
# afterwards — a local store answering in 8ms instead of a saturated hub — which is precisely
# why the change went unnoticed. An unintended reconfiguration that improves the symptoms is
# the hardest kind to catch.
#
# `up` already refuses to start a stopped container when LAUNCH_OVERRIDES would be ignored.
# The same hazard on the recreate path had no guard at all: the settings were not ignored, they
# were forgotten. So read them off the container BEFORE removing it and pass them back through.
# Explicit values on the command line still win, so an intentional role change works as before.
# The names `recreate` must carry forward. DERIVED FROM ONE LIST, deliberately:
# an earlier version hand-enumerated three of them while LAUNCH_OVERRIDES
# declared fifteen, and the two drifted. What that cost: recreating a SPOKE kept
# ENABLED_ROLES=spoke (which masks surrealdb and activity-api) while silently
# resetting DISCOVERY_ENDPOINT to loopback — leaving the container with no local
# trace store AND no hub, looking healthy. PORT_OFFSET is included because port
# mappings are immutable container config that a bare `up` cannot restore.
RECREATE_CARRY := API_KEY METABOB_API_KEY DISCOVERY_ENDPOINT HUB_DISCOVERY_URL \
                  FED_SUBSTRATE_ID RELAY_MULTIADDR ENABLED_ROLES ENABLED_VESSELS \
                  DISABLED_VESSELS ENABLED_EXTRA_VESSELS PROFILE \
                  PEER_DISCOVERY_ENDPOINTS ACTIVITY_API_ENDPOINT \
                  IDENTITY_VESSEL_URL IDENTITY_ENDPOINT SURREALDB_URL REDIS_URL

# Carried SEPARATELY, because for these the EMPTY value is the meaningful one.
#
# A UI-only spoke is launched with ANTHROPIC_API_KEY="" on purpose — it resolves
# models on its hub and is documented to need no provider key. `recreate` then
# refilled it from the operator's own ~/.metabob/config.json (via the `?=` at the
# top of this file) and the real 108-char key landed in the spoke's PERSISTED
# secrets file, surviving every later recreate. Measured on a UI-only spoke:
# ANTHROPIC_API_KEY len=0 before recreate, len=108 after.
#
# The loop above cannot carry these, because it skips empty values — so the
# deliberate blank looks identical to "not set" and the fallback wins. These are
# carried by PRESENCE instead: if the old container had the variable at all, its
# value is carried forward verbatim, empty included.
RECREATE_CARRY_PRESENT := ANTHROPIC_API_KEY OPENAI_API_KEY OPENAI_BASE_URL \
                          LLM_DEFAULT_MODEL CHUTES_API_KEY OPENROUTER_API_KEY \
                          GOOGLE_API_KEY GROQ_API_KEY MISTRAL_API_KEY RUNPOD_API_KEY

recreate:
	@if docker ps -a --format '{{.Names}}' | grep -qx "$(LIVE_NAME)"; then \
	  ENVDUMP=$$(docker inspect $(LIVE_NAME) --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null); \
	  CARRY=""; SHOWN=""; \
	  for _v in $(RECREATE_CARRY); do \
	    _prev=$$(printf '%s\n' "$$ENVDUMP" | sed -n "s/^$$_v=//p" | head -1); \
	    _cur=$$(eval printf '%s' "\$${$$_v}"); \
	    _use="$${_cur:-$$_prev}"; \
	    if [ -n "$$_use" ]; then \
	      CARRY="$$CARRY $$_v=$$_use"; \
	      case "$$_v" in *KEY*|*SECRET*|*PAT*) SHOWN="$$SHOWN $$_v=<set>";; *) SHOWN="$$SHOWN $$_v=$$_use";; esac; \
	    fi; \
	  done; \
	  for _v in $(RECREATE_CARRY_PRESENT); do \
	    _cur=$$(eval printf '%s' "\$${$$_v}"); \
	    if [ -n "$$_cur" ]; then \
	      CARRY="$$CARRY $$_v=$$_cur"; SHOWN="$$SHOWN $$_v=<set>"; \
	    elif printf '%s\n' "$$ENVDUMP" | grep -q "^$$_v="; then \
	      _prev=$$(printf '%s\n' "$$ENVDUMP" | sed -n "s/^$$_v=//p" | head -1); \
	      CARRY="$$CARRY $$_v=$$_prev"; \
	      if [ -n "$$_prev" ]; then SHOWN="$$SHOWN $$_v=<set>"; else SHOWN="$$SHOWN $$_v=<empty,carried>"; fi; \
	    fi; \
	  done; \
	  PREV_8080=$$(docker inspect $(LIVE_NAME) --format '{{range $$p, $$c := .HostConfig.PortBindings}}{{$$p}}={{range $$c}}{{.HostPort}}{{end}} {{end}}' 2>/dev/null | tr ' ' '\n' | sed -n 's#^8080/tcp=##p' | head -1); \
	  PREV_OFFSET=""; \
	  if [ -n "$$PREV_8080" ]; then PREV_OFFSET=$$(expr $$PREV_8080 - 8080 - 10000 2>/dev/null || echo ""); fi; \
	  if [ -n "$(PORT_OFFSET)" ] && [ "$(PORT_OFFSET)" != "0" ] && [ -n "$$PREV_OFFSET" ] && [ "$(PORT_OFFSET)" != "$$PREV_OFFSET" ]; then \
	    echo "[recreate] ERROR: PORT_OFFSET=$(PORT_OFFSET) conflicts with the existing container's mapping (offset $$PREV_OFFSET, host 8080 -> $$PREV_8080)."; \
	    echo "[recreate]   Port mappings are immutable container config. To change the offset, remove the container first:"; \
	    echo "[recreate]     docker rm -f $(LIVE_NAME)    # volumes, and therefore learning state, are preserved"; \
	    exit 1; \
	  fi; \
	  USE_OFFSET="$(PORT_OFFSET)"; \
	  if [ "$$USE_OFFSET" = "0" ] && [ -n "$$PREV_OFFSET" ]; then USE_OFFSET="$$PREV_OFFSET"; fi; \
	  if [ -n "$$SHOWN" ]; then echo "[recreate] carrying forward launch identity:$$SHOWN PORT_OFFSET=$$USE_OFFSET"; \
	  else echo "[recreate] previous container carried no launch identity — recreating as the default (all units enabled)"; fi; \
	  echo "[recreate] removing $(LIVE_NAME); named volumes are preserved"; \
	  docker rm -f $(LIVE_NAME) >/dev/null; \
	  $(MAKE) up PORT_OFFSET="$$USE_OFFSET" $$CARRY; \
	else \
	  $(MAKE) up; \
	fi

# Fleet readiness matrix (host wrapper; in-container: /usr/local/bin/substrate-ready)
# Deep diagnosis incl. surreal-auth drift, seeded-key validity, hollow registry,
# failed units. `docker exec <container> substrate-doctor` also dispatches a goal end-to-end.
# ── substrate-live container (persistent, host ports 18080/18090/18100) ─────
# Primary target for all local development iteration.
# Run once; use `vessel-ctl sync|restart <vessel>` to hot-reload vessels without rebuild.

run-live:
	@if [ -z "$(FEDERATED_SPOKE)" ] && [ -z "$${ANTHROPIC_API_KEY}" ] && [ -z "$${OPENAI_API_KEY}" ]; then \
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
	    -e ANTHROPIC_API_KEY \
	    -e OPENAI_API_KEY \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e CHUTES_API_KEY \
	    -e OPENROUTER_API_KEY \
	    -e GOOGLE_API_KEY \
	    -e GROQ_API_KEY \
	    -e MISTRAL_API_KEY \
	    -e RUNPOD_API_KEY \
	    -e RUNPOD_ENDPOINT_ID="$(RUNPOD_ENDPOINT_ID)" \
	    -e RUNPOD_MODELS="$(RUNPOD_MODELS)" \
	    -e RUNPOD_COST_PER_MTOK="$(RUNPOD_COST_PER_MTOK)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN \
	    -e SUBSTRATE_GIT_PAT \
	    -e SUBSTRATE_REPO_OWNER="$(SUBSTRATE_REPO_OWNER)" \
	    -e API_KEY_SECRET \
	    -e ALLOW_INSECURE_API_KEY_SECRET="$(ALLOW_INSECURE_API_KEY_SECRET)" \
	    -e SUBSTRATE_ROOT="/workspace/git/super-repo" \
	    -e ENABLED_ROLES="$(ENABLED_ROLES)" \
	    -e ENABLED_VESSELS="$(ENABLED_VESSELS)" \
	    -e DISABLED_VESSELS="$(DISABLED_VESSELS)" \
	    -e ENABLED_EXTRA_VESSELS="$(ENABLED_EXTRA_VESSELS)" \
	    -e PROFILE="$(PROFILE)" \
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
	    -e METABOB_API_KEY \
	    -p $(call hp,18080):8080 \
	    -p $(call hp,18090):8090 \
	    -p $(call hp,18100):8100 \
	    -p $(call hp,18101):8101 \
	    -p $(call hp,18210):8210 \
	    -p $(call hp,18250):8250 \
	    -p $(call hp,18260):8260 \
	    -p $(call hp,18270):8270 \
	    -p $(call hp,18310):8310 \
	    -v $(WORKSPACE_VOLUME):/workspace \
	    -v $(SURREAL_VOLUME):/var/lib/surrealdb \
	    --tmpfs /run \
	    --tmpfs /run/lock \
	    $(IMAGE):$(TAG)
	@echo "[run-live] $(LIVE_NAME) started — activity-api on :$(call hp,18080), development-vessel on :$(call hp,18090), discovery-vessel on :$(call hp,18100), goal-host-vessel on :$(call hp,18210), analysis-vessel on :$(call hp,18250), concept-db on :$(call hp,18260), stateful-ui-vessel on :$(call hp,18270), human-surface-vessel on :$(call hp,18310)"
	@echo "[run-live] State on named volumes $(SURREAL_VOLUME) + $(WORKSPACE_VOLUME) (host-detached); only the repo is bind-mounted (ro) for sync-* hot-reload"
	@echo "[run-live] Internal secrets auto-generated and persisted to workspace/.substrate-secrets"
	@echo "[run-live] Wait ~15s for services to start, then: make -C scripts/substrate seed-live"

# Same as run-live but boots the substrate-obsidian image: the full fleet PLUS
# an in-container Obsidian desktop, with the GUI exposed over noVNC on host
# :16080. Reuses the substrate-live container name so every sync-/restart-/
# health- target keeps working unchanged. Requires `make build-obsidian` first.
run-live-obsidian:
	@if [ -z "$(FEDERATED_SPOKE)" ] && [ -z "$${ANTHROPIC_API_KEY}" ] && [ -z "$${OPENAI_API_KEY}" ]; then \
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
	    -e ANTHROPIC_API_KEY \
	    -e OPENAI_API_KEY \
	    -e OPENAI_BASE_URL="$(OPENAI_BASE_URL)" \
	    -e CHUTES_API_KEY \
	    -e OPENROUTER_API_KEY \
	    -e GOOGLE_API_KEY \
	    -e GROQ_API_KEY \
	    -e MISTRAL_API_KEY \
	    -e RUNPOD_API_KEY \
	    -e RUNPOD_ENDPOINT_ID="$(RUNPOD_ENDPOINT_ID)" \
	    -e RUNPOD_MODELS="$(RUNPOD_MODELS)" \
	    -e RUNPOD_COST_PER_MTOK="$(RUNPOD_COST_PER_MTOK)" \
	    -e LLM_DEFAULT_MODEL="$(LLM_DEFAULT_MODEL)" \
	    -e GITHUB_TOKEN \
	    -e SUBSTRATE_GIT_PAT \
	    -e SUBSTRATE_REPO_OWNER="$(SUBSTRATE_REPO_OWNER)" \
	    -e API_KEY_SECRET \
	    -e ALLOW_INSECURE_API_KEY_SECRET="$(ALLOW_INSECURE_API_KEY_SECRET)" \
	    -e SUBSTRATE_ROOT="/workspace/git/super-repo" \
	    -e ENABLED_ROLES="$(ENABLED_ROLES)" \
	    -e ENABLED_VESSELS="$(ENABLED_VESSELS)" \
	    -e DISABLED_VESSELS="$(DISABLED_VESSELS)" \
	    -e ENABLED_EXTRA_VESSELS="$(ENABLED_EXTRA_VESSELS)" \
	    -e PROFILE="$(PROFILE)" \
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
	    -e METABOB_API_KEY \
	    -p 18080:8080 \
	    -p 18090:8090 \
	    -p 18100:8100 \
	    -p 18101:8101 \
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
# ── Key / token surface ─────────────────────────────────────────────────────
# Key issuance runs INSIDE the container (identity-vessel is internal-only):
#
#   docker exec <container> substrate-key show
#   docker exec <container> substrate-key issue my-peer read,write 30
#   docker exec <container> substrate-key list
#   docker exec <container> substrate-key revoke <key-id>
#
# The make wrappers these six variables fed were deleted; the variables were
# read by nothing else.

# Every probe must describe the instance named by LIVE_NAME. The four
# host-port probes below hardcoded 18080/18100/18090/18250, honouring neither
# LIVE_NAME nor PORT_OFFSET — so on a host running more than one substrate this
# target reported whichever fleet happened to own 18080, mixed line-by-line with
# `docker exec $(LIVE_NAME)` output from the correct one. A health report naming
# the wrong instance is worse than no report. $(call hp,…) applies PORT_OFFSET
# exactly as run-live does when it publishes these same ports.
# Autonomy KPI view. MUST run ON THE HOST. The collector writes the metrics JSONL
# into the /workspace docker VOLUME (host filesystem can't see it directly), so
# the viewer reaches it via `docker exec <container> cat /workspace/...`. That
# docker-exec read only works where `docker` exists — i.e. the HOST. Running it
# IN-CONTAINER (the prior approach) silently failed: `docker` isn't installed in
# the container, the volume read errored, and the viewer fell back to the STALE
# host bind-mount cache — falsely reporting STALE / 850m-old data while the
# collector was healthy (root-caused 2026-06-19). The viewer is a pure renderer
# (no DB/API creds needed); SUBSTRATE_CONTAINER points it at the live volume.
# READ-ONLY performance view: honest reach (verification-label corpus) vs
# self-reported reach (goal-host dispatches), the law-7 gap triple with the
# expiry-vs-repair close decomposition, and a topology census (shapes, vessel
# units, federated LLM arms, graded templates). Host-run: it curls the
# host-mapped ports and shells into the container for the unit census.
# SHUTDOWN IS A DRAIN, NOT A KILL.
#
# `docker stop` defaults to a 10-SECOND grace period, then SIGKILL. The fleet is
# configured for far longer: goal-host and development-vessel drain for up to
# 240s (GOAL_HOST_DRAIN_MS / VESSEL_DRAIN_MS), and surrealdb.service declares no
# TimeoutStopSec at all, so it inherits systemd's 90s default to flush RocksDB.
#
# A bare `docker stop` therefore kills mid-flight work AND cuts the datastore off
# before it flushes — on a volume that holds every trace, posterior, and gap the
# system has ever learned. This file's own migrate-state-to-volumes target has
# always said `docker stop -t 30`; the stop target it points operators at did not.
#
# STOP_TIMEOUT covers the longest drain (240s) plus systemd's own shutdown of the
# remaining units. Lower it deliberately, never by forgetting.
STOP_TIMEOUT ?= 300

# "Before restarting anything, check nothing is mid-flight" was an instruction with
# no way to carry it out: nothing reported in-flight work, so the operator guessed.
# goal-host has advertised `in_flight` on /health all along — precisely so a
# restarter does not have to. Report it; the drain below then does the waiting.
# This is a REPORT, not a gate: a busy substrate must still be stoppable, and the
# dispatch host is almost never idle under the autonomous loop.
stop-live:
	@_inflight=$$(curl -s --max-time 5 http://localhost:$(call hp,18210)/health 2>/dev/null \
	    | sed -nE 's/.*"in_flight":([0-9]+).*/\1/p'); \
	  if [ -n "$$_inflight" ] && [ "$$_inflight" -gt 0 ] 2>/dev/null; then \
	    echo "[stop] $$_inflight execution(s) in flight — the drain below waits for them"; \
	  elif [ -n "$$_inflight" ]; then \
	    echo "[stop] nothing in flight"; \
	  else \
	    echo "[stop] could not read in-flight count (goal-host not answering) — proceeding"; \
	  fi
	@echo "[stop] draining $(LIVE_NAME) (up to $(STOP_TIMEOUT)s — vessels drain to 240s, SurrealDB flushes RocksDB)"
	docker stop -t $(STOP_TIMEOUT) $(LIVE_NAME)
	@echo "[stop] $(LIVE_NAME) stopped; named volumes retained"

# Removes the CONTAINER, never the volumes. `docker rm -f` sends SIGKILL with no
# grace period whatsoever, so a running container must be drained first rather
# than force-removed — the -f is for a container that is already stopped.
clean-live:
	@if [ "$$(docker inspect -f '{{.State.Running}}' $(LIVE_NAME) 2>/dev/null)" = "true" ]; then \
	  echo "[clean] $(LIVE_NAME) is running — draining first (docker rm -f would SIGKILL it)"; \
	  $(MAKE) --no-print-directory stop-live; \
	fi
	docker rm -f $(LIVE_NAME) 2>/dev/null || true
	@echo "[clean] container removed; volumes $(SURREAL_VOLUME) + $(WORKSPACE_VOLUME) retained"

# ── ephemeral dev container (port 8080) ─────────────────────────────────────

# Seed operator-side memory files into the substrate's memory store.
# Run once after seed-live. Pass DEV_VESSEL_ENDPOINT to write via HTTP
# (requires substrate running); omit to write directly to workspace/memory/.
# health targets the substrate-live container (18080 ports).
stop: stop-live

clean: clean-live

# ── Substrate-only iteration (substrate-live container) ──────────────────────

# Sync development-vessel source into the running container then restart it.
# Sync local-tools-vessel source into the running container then restart it.
# Sync llm-resolver-vessel source into the running container then restart it.
# Sync goal-host-vessel source into the running container then restart it.
# Copies the whole src tree, not a single file. This target used to cp only
# src/index.ts, so every module beside it was silently left at its old version
# while the target still printed "source synced" and the restart reported
# active. Measured 2026-08-09: a fix landed in src/goal-file-resolution.ts
# deployed green and was verifiably absent from the live tree afterwards.
# `docker cp <dir>/. <dest>` copies directory CONTENTS, so new files appear and
# existing ones are overwritten in place.
# Sync light-dispatch-vessel into the running container then restart it.
# Stateless oneshot dispatcher (openspec 2026-06-03 Stage 2.B). Port 8250.
# Sync boredom-vessel source into the running container then trigger a manual run.
# Sync ribosome-vessel source into the running container then restart it.
# Sync concept-db source into the running container then restart it.
# `docker cp <src>/src <container>:/vessels/x/src` nests into x/src/src when
# the destination exists. Wipe the target first so the copy lands cleanly.
# Sync stateful-ui-vessel source into the running container.
# Also installs the systemd unit on first sync (idempotent).
# human-surface-vessel — the human-facing surface, port 8310 (host 18310).
#
# !! CLOBBER WARNING — READ BEFORE USING sync-/restart-* ON ANY VESSEL !!
# `sync-` docker-cp's from the OPERATOR'S working tree. It has been observed
# DESTROYING substrate-authored commits: the substrate lands a commit in its own
# in-container clone, the operator runs `make restart-<vessel>`, and the copy
# from the host tree overwrites the vessel's source with the operator's older
# state. The SAFE source is the container's own clone, /workspace/git/vessels/
# (or /workspace/git/super-repo for $REPO_ROOT-workdir vessels — which is where
# this vessel's manifest workdir points). For a vessel-ctl-installed instance the
# safe refresh is an in-container ff-pull of that clone plus a unit restart, never
# a docker cp:
#     docker exec $(LIVE_NAME) git -C /workspace/git/super-repo pull --ff-only
#     docker exec $(LIVE_NAME) systemctl restart human-surface-vessel.service
# Use the targets below only for a host-side edit you know is newer, and
# md5-compare against the container copy first.
#
# Modelled on stateful-ui-vessel (NOT analysis-vessel): human-surface-vessel is
# not baked into the image, so /vessels/human-surface-vessel does not exist and
# a src-only copy would leave the unit with no package.json and no deps.
# The static unit is installed only if nothing already occupies
# /etc/systemd/system — a vessel-ctl install renders its own unit there (pointing
# at the super-repo clone per the manifest workdir), and overwriting it would
# silently repoint the running vessel at the docker-cp'd tree instead.
# obsidian-vessel: the Obsidian plugin built IN the substrate (substrate-obsidian
# flavour only). Dev loop is edit → sync → rebuild → reload Obsidian. The vault's
# plugin files are symlinks to /vessels/obsidian-vessel build artifacts, so a
# rebuild updates them in place. Restarting obsidian-desktop reloads the plugin
# WITHOUT tearing down the display (obsidian-xorg), so the noVNC session survives.
# `docker cp <src>/src <container>:/vessels/x/src` nests when the dest exists —
# wipe first so the copy lands cleanly.
# -----------------------------------------------------------------------------

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
# There is NO `make vessel-ctl` passthrough. Run the tool in the container:
#   docker exec <container> vessel-ctl <verb> [args]
# The absorber that used to live here advertised `vessel-ctl enable`, a verb
# vessel-ctl does not have — and the command never reached it anyway: make's
# built-in `%: %.sh` rule matched vessel-ctl.sh, copied it, and exited 0. See
# the .SUFFIXES: below, which is what actually closes that.

# Sync a dynamic vessel: ff-pull its in-container clone, mirror into the live
# runtime, restart (all in-container; no host source involved).