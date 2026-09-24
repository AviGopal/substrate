# Makefile — developer wrapper over the launch manifest
#
# Setup commands live in one place: README § Installation (sequence G is this
# wrapper). This file is not a second lane. Target `up` runs that page's
# sequence against a locally built tag: build (only when REBUILD=1 or the tag is
# absent; needs host bun), compose against the root manifest and .env, the
# in-container verdict at WAIT_LEVEL (non-zero unless it passes), then the client
# config from substrate-connect (CONNECT_WRITE=1 writes it).
#
# INPUTS are the manifest's install inputs (SUBSTRATE_NAME, SUBSTRATE_PORT_PREFIX,
# DISCOVERY_ENDPOINT + METABOB_API_KEY, a provider key, PROFILE, PUBLIC_IP,
# SUBSTRATE_GIT_PAT + SUBSTRATE_REPO_OWNER), read by compose itself from the root
# .env, the make command line, or the environment. This file reads nothing else:
# no client config file, no CLI credential cache, no other container's settings to
# fill an unset input. Every derivation (role, endpoints, key requirement) runs in
# the image; container, volume and port names come from the manifest's own
# interpolation, which this file asks for (`compose config`) and never recomputes.
#
# Targets: up, stop, recreate (replaces the container, volumes kept; refuses a
# changed identity, port or volume unless ADOPT=1, and a port check it cannot
# run unless SKIP_PORT_CHECK=1). Knobs: REBUILD, WAIT_LEVEL (a keyless spoke
# waits for `served`: `usable` needs an arm), CONNECT_WRITE, ADOPT, COMPOSE.
#
# DEPRECATED, still honoured with a warning:
#   LIVE_NAME=<n>     -> the exact-name aliases for container <n> and volumes
#                        <n>-workspace/<n>-surreal (substrate-live keeps the
#                        default volumes), so a fleet made by the old make lane is
#                        adopted as-is. Replacement: SUBSTRATE_NAME.
#   PORT_OFFSET=<n>   -> SUBSTRATE_PORT_PREFIX = 18 + n/1000 (n a multiple of 1000).
#
# Everything a RUNNING fleet does ships in the image and names its instance in
# the command itself:
#
#   docker exec <container> substrate-status | substrate-connect | substrate-key …
#   docker exec <container> vessel-ctl status | restart <v> | logs <v> | sync <v>
#   docker exec <container> vessel-ctl install <v> | uninstall <v> | list | apply
#
# Do not reintroduce a wrapper here for something the image ships, and do not add
# a recipe that declares a port, volume, grace period or healthcheck: those facts
# live in the manifest, and every copy of them has drifted.

IMAGE := ghcr.io/avigopal/substrate
TAG   := dev
REPO_ROOT := $(abspath $(CURDIR)/../..)

# The compose implementation. `docker compose` (v2) and podman-compose both read
# ./docker-compose.yml and ./.env from the working directory when run there, so
# every compose call below runs IN the repo root — the same directory, the same
# files, and therefore the same inputs as the install page.
COMPOSE ?= docker compose
COMPOSE_IN_ROOT = cd '$(REPO_ROOT)' && $(COMPOSE)

# The verdict level `up` waits for. usable = a baked known-answer goal reached.
WAIT_LEVEL ?= usable

# SHUTDOWN IS A DRAIN, NOT A KILL. Matches the manifest's stop_grace_period:
# vessels drain for up to 240s, SurrealDB inherits systemd's 90s default to flush
# RocksDB. Lower it deliberately, never by forgetting.
STOP_TIMEOUT ?= 360

# ── Deprecated inputs ─────────────────────────────────────────────────────────
# Each maps onto the manifest's own names and is exported so compose interpolates
# it. A deprecated name that contradicts its replacement stops here, before any
# container is touched; the image's configuration funnel re-checks the names it
# receives and refuses a partial or conflicting set before its first write.
ifneq ($(strip $(LIVE_NAME)),)
$(warning [substrate] LIVE_NAME is deprecated; SUBSTRATE_NAME replaces it (container <name>-live, volumes <name>-workspace, <name>-surreal))
ifneq ($(strip $(SUBSTRATE_CONTAINER)),)
ifneq ($(strip $(SUBSTRATE_CONTAINER)),$(strip $(LIVE_NAME)))
$(error [substrate] LIVE_NAME=$(LIVE_NAME) conflicts with SUBSTRATE_CONTAINER=$(SUBSTRATE_CONTAINER); set only SUBSTRATE_NAME)
endif
endif
# LIVE_NAME=<n> names volumes <n>-workspace/<n>-surreal (substrate-live: the
# default fleet's), so the only SUBSTRATE_NAME consistent with it is <n> itself
# (substrate, for substrate-live). The image refuses any other pair at boot —
# after compose has created the container — so it stops here instead.
ifneq ($(strip $(SUBSTRATE_NAME)),)
ifneq ($(strip $(SUBSTRATE_NAME)),$(strip $(LIVE_NAME)))
ifneq ($(strip $(SUBSTRATE_NAME))|$(strip $(LIVE_NAME)),substrate|substrate-live)
$(error [substrate] LIVE_NAME=$(LIVE_NAME) conflicts with SUBSTRATE_NAME=$(SUBSTRATE_NAME); set only SUBSTRATE_NAME)
endif
endif
endif
export SUBSTRATE_CONTAINER := $(strip $(LIVE_NAME))
ifeq ($(strip $(LIVE_NAME)),substrate-live)
export WORKSPACE_VOLUME := substrate-workspace
export SURREAL_VOLUME   := substrate-surreal
else
export WORKSPACE_VOLUME := $(strip $(LIVE_NAME))-workspace
export SURREAL_VOLUME   := $(strip $(LIVE_NAME))-surreal
endif
endif

ifneq ($(strip $(PORT_OFFSET)),)
ifneq ($(strip $(PORT_OFFSET)),0)
$(warning [substrate] PORT_OFFSET is deprecated; SUBSTRATE_PORT_PREFIX replaces it (PORT_OFFSET=n is prefix 18 + n/1000))
ifeq ($(shell echo '$(PORT_OFFSET)' | grep -Ex '[0-9]+'),)
$(error [substrate] PORT_OFFSET='$(PORT_OFFSET)' is not a non-negative integer)
endif
ifneq ($(shell expr '$(PORT_OFFSET)' % 1000),0)
$(error [substrate] PORT_OFFSET=$(PORT_OFFSET) is not a multiple of 1000; set SUBSTRATE_PORT_PREFIX instead (prefix 24 publishes 24080, 24100, ...))
endif
_PREFIX_FROM_OFFSET := $(shell expr 18 + '$(PORT_OFFSET)' / 1000)
ifneq ($(strip $(SUBSTRATE_PORT_PREFIX)),)
ifneq ($(strip $(SUBSTRATE_PORT_PREFIX)),$(_PREFIX_FROM_OFFSET))
$(error [substrate] PORT_OFFSET=$(PORT_OFFSET) (prefix $(_PREFIX_FROM_OFFSET)) conflicts with SUBSTRATE_PORT_PREFIX=$(SUBSTRATE_PORT_PREFIX); set only SUBSTRATE_PORT_PREFIX)
endif
endif
export SUBSTRATE_PORT_PREFIX := $(_PREFIX_FROM_OFFSET)
endif
endif

# A TAG given on the make command line builds a different local tag, so compose
# must run that tag. Otherwise the local build tag IS the manifest's default image
# and nothing needs to be passed.
ifeq ($(origin TAG),command line)
export SUBSTRATE_IMAGE := $(IMAGE):$(TAG)
endif

# ── Name resolution: ask the manifest ─────────────────────────────────────────
# Sets C (container), WS and SR (the two volume names) from `compose config`, the
# manifest's own interpolation of the current inputs. `cfg_env NAME` reads the
# value the manifest will pass for NAME.
RESOLVE = cfg=$$($(COMPOSE_IN_ROOT) config 2>/dev/null) || { \
	    echo "[substrate] ERROR: '$(COMPOSE) config' failed in $(REPO_ROOT)." >&2; \
	    echo "[substrate]   Run it there to see why (compose missing, or a malformed .env)." >&2; exit 1; }; \
	  C=$$(printf '%s\n' "$$cfg" | sed -nE 's/^ +container_name: *//p' | head -1 | tr -d "\"'"); \
	  WS=$$(printf '%s\n' "$$cfg" | awk '/^  substrate-workspace:/{f=1;next} f&&/^ +name:/{sub(/^ +name: */,"");print;exit}' | tr -d "\"'"); \
	  SR=$$(printf '%s\n' "$$cfg" | awk '/^  substrate-surreal:/{f=1;next} f&&/^ +name:/{sub(/^ +name: */,"");print;exit}' | tr -d "\"'"); \
	  cfg_env() { printf '%s\n' "$$cfg" | sed -nE "s/^ +$$1: *//p" | head -1 | sed -E "s/^'(.*)'$$/\1/; s/^\"(.*)\"$$/\1/"; }; \
	  [ -n "$$C" ] || { echo "[substrate] ERROR: the manifest named no container_name." >&2; exit 1; }; \
	  _ln='$(strip $(LIVE_NAME))'; _sn=$$(cfg_env SUBSTRATE_NAME); \
	  if [ -n "$$_ln" ] && [ -n "$$_sn" ] && [ "$$_sn" != "$$_ln" ] && [ "$$_sn|$$_ln" != "substrate|substrate-live" ]; then \
	    echo "[substrate] ERROR: LIVE_NAME=$$_ln conflicts with SUBSTRATE_NAME=$$_sn (from $(REPO_ROOT)/.env); set only SUBSTRATE_NAME. Nothing was touched." >&2; exit 1; \
	  fi

# A container the manifest created carries its `substrate.launch-manifest` label.
# One without it — a plain `docker run`, or another compose file that happens to
# use the same container or project name — was not created from this manifest,
# and `up` must never let compose recreate it by accident.
MANIFEST_OWNED = [ "$$(docker inspect -f '{{index .Config.Labels "substrate.launch-manifest"}}' "$$C" 2>/dev/null)" = "1" ]

# "<container-port> <host-port>" per port: MANIFEST_PORTS from `compose config`
# (the short `- [ip:]host:container` form podman-compose prints, or the long
# form's `target:`/`published:` keys docker compose prints); CONTAINER_PORTS from
# the bindings an existing container (running or stopped) was created with.
MANIFEST_PORTS = printf '%s\n' "$$cfg" | tr -d "\"'" | awk ' \
	  /^ +- / { t = "" } \
	  /^ +- ([0-9.]+:)?[0-9]+:[0-9]+(\/[a-z]+)?$$/ { s = $$0; sub(/^ +- /, "", s); sub(/\/[a-z]+$$/, "", s); \
	    n = split(s, a, ":"); print a[n], a[n-1]; next } \
	  /^ +target: / { t = $$2 } \
	  /^ +published: / { print t, $$2 }' | sort -u
CONTAINER_PORTS = { docker inspect -f '{{range $$k, $$v := .HostConfig.PortBindings}}{{range $$v}}{{$$k}} {{.HostPort}}{{println}}{{end}}{{end}}' "$$C" 2>/dev/null || true; } \
	  | awk 'NF == 2 { sub(/\/[a-z]+$$/, "", $$1); print $$1, $$2 }' | sort -u

# Busy-port preflight: every host port the manifest publishes must be free,
# apart from the ones $$C holds now, BEFORE the old container is removed — a bind
# failure after the removal leaves the node down. A check that cannot run is not
# a pass: without ss, netstat or lsof it refuses unless SKIP_PORT_CHECK=1.
PORT_PREFLIGHT = held=$$($(CONTAINER_PORTS) | awk '{print $$2}'); \
	  if command -v ss >/dev/null 2>&1; then listening=$$(ss -ltnH 2>/dev/null | awk '{print $$4}'); \
	  elif command -v netstat >/dev/null 2>&1; then listening=$$(netstat -ltn 2>/dev/null | awk 'NR > 2 {print $$4}'); \
	  elif command -v lsof >/dev/null 2>&1; then listening=$$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 {print $$9}'); \
	  elif [ "$(SKIP_PORT_CHECK)" = "1" ]; then listening=""; echo "[recreate] WARNING: no ss, netstat or lsof — only ports other containers publish were checked (SKIP_PORT_CHECK=1)" >&2; \
	  else echo "[recreate] ERROR: no ss, netstat or lsof here, so the host-port check cannot run; install one or pass SKIP_PORT_CHECK=1. Nothing was stopped." >&2; exit 1; fi; \
	  listening="$$listening $$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | awk -v c="$$C" '$$1 != c' | grep -oE ':[0-9]+->' | tr -d ':>-')"; \
	  listening=$$(printf '%s\n' $$listening | sed -E 's/.*[:.]([0-9]+)$$/\1/' | grep -E '^[0-9]+$$' | sort -u); \
	  busy=""; for p in $$($(MANIFEST_PORTS) | awk '{print $$2}'); do \
	    if printf '%s\n' $$listening | grep -qx "$$p" && ! printf '%s\n' $$held | grep -qx "$$p"; then busy="$$busy $$p"; fi; \
	  done; \
	  if [ -n "$$busy" ]; then echo "[recreate] ERROR: host port(s) already held by something else:$$busy. Set SUBSTRATE_PORT_PREFIX (or RELAY_PORT) in $(REPO_ROOT)/.env. Nothing was stopped." >&2; exit 1; fi

# Launch identity that decides what a container IS: role, selection and anchor.
# Adopting a container made outside the manifest re-creates it from the manifest's
# inputs; any of these that differ would silently turn a spoke into a standalone
# (or the reverse), so `recreate` refuses on a difference unless ADOPT=1.
IDENTITY_NAMES := PROFILE ENABLED_ROLES ENABLED_VESSELS ENABLED_EXTRA_VESSELS DISABLED_VESSELS \
                  DISCOVERY_ENDPOINT HUB_DISCOVERY_URL ACTIVITY_API_ENDPOINT IDENTITY_VESSEL_URL \
                  PEER_DISCOVERY_ENDPOINTS FED_SUBSTRATE_ID RELAY_MULTIADDR PUBLIC_IP

# Only REAL targets belong here. A deleted target left in .PHONY does not error —
# make reports "Nothing to be done" and EXITS 0, so a removed command silently
# SUCCEEDS doing nothing. Deleted names must fail loudly with "No rule to make
# target".
.PHONY: build build-obsidian clean clean-live image migrate-state-to-volumes preflight-submodules recreate stop stop-live up validate-build verdict

# Disable make's built-in suffix rules. Without this, `make vessel-ctl` matches
# the built-in `%: %.sh` rule against vessel-ctl.sh, runs `cat vessel-ctl.sh
# >vessel-ctl`, and EXITS 0 — a nonexistent target silently succeeding.
.SUFFIXES:

# Submodule preflight: the Dockerfile `COPY repos/...` stages fail minutes into
# the build if the git submodules were never checked out. Fail fast with the
# remedy instead.
preflight-submodules:
	@if [ ! -f $(REPO_ROOT)/repos/discovery-vessel/package.json ]; then \
	  echo "[preflight] ERROR: git submodules not checked out (repos/discovery-vessel/package.json missing)."; \
	  echo "[preflight] remedy: git submodule update --init --recursive"; \
	  exit 1; \
	fi

# Fast preflight: assert every containerized vessel is build-valid (file: deps
# resolve, frozen lockfiles are in sync, imports match dependency keys).
validate-build: preflight-submodules
	@command -v bun >/dev/null 2>&1 || { \
	  echo "[preflight] ERROR: bun is not on PATH — 'make build' needs it on the HOST."; \
	  echo "[preflight] This step runs before docker, so the image's own bun cannot serve it."; \
	  echo "[preflight] remedy: install bun (curl -fsSL https://bun.sh/install | bash),"; \
	  echo "[preflight]          or add an existing one to PATH, then re-run."; \
	  exit 1; \
	}
	bun $(CURDIR)/validate-build.ts

# --target base is load-bearing: without it docker builds the LAST stage
# (substrate-obsidian), silently making :dev and :obsidian the same image.
build: validate-build
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    --target base \
	    -t $(IMAGE):$(TAG) \
	    $(CURDIR)/../..

# substrate-obsidian flavour: base fleet + in-container Obsidian desktop served
# over noVNC. It runs from the same manifest: SUBSTRATE_IMAGE=$(IMAGE):obsidian,
# with the noVNC port and shm size in a compose override file.
OBSIDIAN_TAG := obsidian
build-obsidian:
	docker build -f $(CURDIR)/../../Dockerfile.substrate \
	    --target substrate-obsidian \
	    -t $(IMAGE):$(OBSIDIAN_TAG) \
	    $(CURDIR)/../..

# Build only when asked, or when the local tag is absent.
image:
	@if [ "$(REBUILD)" = "1" ]; then $(MAKE) --no-print-directory build; \
	elif ! docker image inspect $(IMAGE):$(TAG) >/dev/null 2>&1; then \
	  echo "[up] $(IMAGE):$(TAG) is not present locally — building it (REBUILD=1 forces a rebuild)"; \
	  $(MAKE) --no-print-directory build; \
	fi

# ── up: build-if-asked -> compose up -d -> verdict -> connect ─────────────────
# A container the manifest did not create (a plain `docker run`, or another
# compose project) is never replaced here: it is left running, or started if it
# was stopped, and `make recreate` is how it is adopted into the manifest.
up: image
	@if [ -f '$(CURDIR)/.env' ] && ! cmp -s '$(CURDIR)/.env' '$(REPO_ROOT)/.env'; then \
	  echo "[up] WARNING: $(CURDIR)/.env is NOT read — compose runs in $(REPO_ROOT) and reads $(REPO_ROOT)/.env only. Move its inputs there." >&2; \
	fi
	@$(RESOLVE); \
	if docker inspect "$$C" >/dev/null 2>&1 && ! $(MANIFEST_OWNED); then \
	  if [ "$$(docker inspect -f '{{.State.Running}}' "$$C")" = "true" ]; then \
	    echo "[up] $$C is running but was not created from the manifest — leaving it untouched."; \
	  else \
	    echo "[up] $$C exists, stopped, and was not created from the manifest — starting it unchanged."; \
	    docker start "$$C" >/dev/null; \
	  fi; \
	  echo "[up]   Its settings are the ones it was created with; .env and command-line inputs do not reach it."; \
	  echo "[up]   Adopt it (drain, remove, recreate from the manifest; volumes $$WS + $$SR kept): make -C scripts/substrate recreate"; \
	else \
	  echo "[up] $(COMPOSE) up -d  (container $$C, volumes $$WS + $$SR)"; \
	  $(COMPOSE_IN_ROOT) up -d || exit $$?; \
	fi
	@$(MAKE) --no-print-directory verdict

# The verdict gates `up`. `unknown` never counts as a pass: an image without the
# verdict command cannot say whether the fleet reached a goal, so `up` fails and
# says so rather than reporting a readiness it never measured.
verdict:
	@$(RESOLVE); \
	if ! docker exec "$$C" sh -c 'command -v substrate-status' >/dev/null 2>&1; then \
	  echo "[up] ERROR: the image in $$C has no substrate-status — the readiness verdict is unknown, and unknown never passes." >&2; \
	  echo "[up]   Pull or build an image that ships it (REBUILD=1). The legacy matrix is still available," >&2; \
	  echo "[up]   as a diagnostic only: docker exec $$C substrate-ready" >&2; \
	  exit 1; \
	fi; \
	docker exec "$$C" substrate-status --wait $(WAIT_LEVEL) || exit $$?; \
	if [ "$(CONNECT_WRITE)" = "1" ]; then \
	  dest="$${METABOB_CONFIG_PATH:-$$HOME/.metabob/config.json}"; \
	  mkdir -p "$$(dirname "$$dest")"; \
	  docker exec "$$C" substrate-connect > "$$dest.new" || { rm -f "$$dest.new"; exit 1; }; \
	  if [ -f "$$dest" ]; then cp "$$dest" "$$dest.bak"; echo "[up] previous client config kept at $$dest.bak"; fi; \
	  mv "$$dest.new" "$$dest"; echo "[up] client config written to $$dest"; \
	else \
	  docker exec "$$C" substrate-connect || exit $$?; \
	  echo "[up] To install the client config above:  docker exec $$C substrate-connect > ~/.metabob/config.json"; \
	  echo "[up]   (or re-run with CONNECT_WRITE=1; METABOB_CONFIG_PATH overrides the location)"; \
	fi

# Replace the container from the manifest, keeping both named volumes.
#
# What must not change silently on a recreate, compared before anything is
# stopped, each refused unless ADOPT=1 accepts it:
#   - the launch identity (role, selection, anchor) of a container the manifest
#     did not create — a recreate that forgets a spoke's role brings it back as
#     a standalone that looks healthier than before;
#   - a host port any container port is published on now — a fleet made with a
#     port offset would otherwise come back on the default block;
#   - the volumes mounted at /workspace and /var/lib/surrealdb — other names
#     mean a fresh, empty learning state.
# Then the host ports the new container publishes must be free (PORT_PREFLIGHT),
# so a bind failure cannot follow the removal.
recreate: image
	@$(RESOLVE); \
	if docker inspect "$$C" >/dev/null 2>&1; then \
	  diffs=""; \
	  if ! $(MANIFEST_OWNED); then \
	    old=$$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$$C"); \
	    for n in $(IDENTITY_NAMES); do \
	      o=$$(printf '%s\n' "$$old" | sed -n "s/^$$n=//p" | head -1); m=$$(cfg_env "$$n"); \
	      [ "$$o" = "$$m" ] || diffs="$$diffs\n  $$n: container='$$o' manifest='$$m'"; \
	    done; \
	  fi; \
	  new_ports=$$($(MANIFEST_PORTS)); \
	  for cport_hp in $$($(CONTAINER_PORTS) | tr ' ' '='); do \
	    cport=$${cport_hp%%=*}; hp=$${cport_hp#*=}; \
	    nhp=$$(printf '%s\n' "$$new_ports" | awk -v c="$$cport" '$$1 == c {print $$2; exit}'); \
	    [ "$$hp" = "$$nhp" ] || diffs="$$diffs\n  port $$cport: container publishes host $$hp, manifest would publish '$$nhp'"; \
	  done; \
	  _dp=$$($(CONTAINER_PORTS) | awk '$$1 == "8100" {print $$2; exit}'); \
	  case "$$_dp" in *100) [ "$$_dp" = "$$(printf '%s\n' "$$new_ports" | awk '$$1 == "8100" {print $$2; exit}')" ] \
	    || diffs="$$diffs\n  (SUBSTRATE_PORT_PREFIX=$${_dp%100} reproduces this container's port block; RELAY_PORT keeps a relay port)";; esac; \
	  for pair in /workspace=$$WS /var/lib/surrealdb=$$SR; do \
	    dst=$${pair%%=*}; want=$${pair#*=}; \
	    have=$$(docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$$dst\"}}{{.Name}}{{end}}{{end}}" "$$C"); \
	    [ "$$have" = "$$want" ] || diffs="$$diffs\n  volume at $$dst: container='$$have' manifest='$$want'"; \
	  done; \
	  if [ -n "$$diffs" ] && [ "$(ADOPT)" != "1" ]; then \
	    echo "[recreate] ERROR: recreating $$C from the manifest would change it:" >&2; \
	    printf '%b\n' "$$diffs" >&2; \
	    echo "[recreate]   Put the container's values in $(REPO_ROOT)/.env (or on this command line), or pass ADOPT=1 to accept the change." >&2; \
	    echo "[recreate]   Nothing was stopped or removed." >&2; \
	    exit 1; \
	  fi; \
	  [ -z "$$diffs" ] || { echo "[recreate] ADOPT=1 — accepting:" >&2; printf '%b\n' "$$diffs" >&2; }; \
	  $(PORT_PREFLIGHT); \
	  echo "[recreate] draining $$C (up to $(STOP_TIMEOUT)s); volumes $$WS + $$SR are kept"; \
	  docker stop -t $(STOP_TIMEOUT) "$$C" >/dev/null || exit $$?; \
	  docker rm "$$C" >/dev/null || exit $$?; \
	else \
	  $(PORT_PREFLIGHT); \
	fi; \
	$(COMPOSE_IN_ROOT) up -d --force-recreate || exit $$?
	@$(MAKE) --no-print-directory verdict

# One-time migration: copy legacy HOST state dirs (./workspace, ./surreal-data
# beside this file) into the named volumes the manifest resolves. Stop the
# container first so SurrealDB has flushed; the host dirs are left intact as a
# backup. Idempotent re-run wipes + recopies the volumes.
WORKSPACE    := $(CURDIR)/workspace
SURREAL_DATA := $(CURDIR)/surreal-data
migrate-state-to-volumes:
	@$(RESOLVE); \
	if [ "$$(docker inspect -f '{{.State.Running}}' "$$C" 2>/dev/null)" = "true" ]; then \
	  echo "[migrate] ERROR: stop $$C first (make -C scripts/substrate stop) so SurrealDB flushes"; exit 1; \
	fi; \
	docker volume create "$$SR" >/dev/null; docker volume create "$$WS" >/dev/null; \
	docker run --rm --entrypoint bash \
	    -v $(SURREAL_DATA):/src-surreal:ro \
	    -v $(WORKSPACE):/src-workspace:ro \
	    -v "$$SR":/dst-surreal \
	    -v "$$WS":/dst-workspace \
	    $(IMAGE):$(TAG) -c 'set -e; \
	      find /dst-surreal -mindepth 1 -delete; find /dst-workspace -mindepth 1 -delete; \
	      cp -a /src-surreal/. /dst-surreal/; cp -a /src-workspace/. /dst-workspace/; \
	      echo "[migrate] surreal CURRENT=$$(cat /dst-surreal/data.db/CURRENT 2>/dev/null)"; \
	      echo "[migrate] done — host dirs left intact as backup"'

# "Before restarting anything, check nothing is mid-flight": goal-host advertises
# `in_flight` on /health, so report it; the drain below does the waiting. This is
# a REPORT, not a gate — a busy substrate must still be stoppable.
#
# Ask the engine which host port this container publishes for goal-host rather
# than computing it: `docker port` knows the true mapping whichever way the
# container was created.
#
# `docker stop -t`, not `compose stop`: it drains a container the manifest did
# not create exactly as it drains one it did.
stop-live:
	@$(RESOLVE); \
	_gp=$$(docker port "$$C" 8210/tcp 2>/dev/null | head -1 | sed -nE 's/.*:([0-9]+)$$/\1/p'); \
	_inflight=""; \
	[ -n "$$_gp" ] && _inflight=$$(curl -s --max-time 5 http://localhost:$$_gp/health 2>/dev/null \
	    | sed -nE 's/.*"in_flight":([0-9]+).*/\1/p'); \
	if [ -n "$$_inflight" ] && [ "$$_inflight" -gt 0 ] 2>/dev/null; then \
	  echo "[stop] $$_inflight execution(s) in flight — the drain below waits for them"; \
	elif [ -n "$$_inflight" ]; then \
	  echo "[stop] nothing in flight"; \
	else \
	  echo "[stop] could not read in-flight count (goal-host not answering) — proceeding"; \
	fi; \
	echo "[stop] draining $$C (up to $(STOP_TIMEOUT)s — vessels drain to 240s, SurrealDB flushes RocksDB)"; \
	docker stop -t $(STOP_TIMEOUT) "$$C" || exit $$?; \
	echo "[stop] $$C stopped; volumes $$WS + $$SR retained"

# Removes the CONTAINER, never the volumes. `docker rm -f` sends SIGKILL with no
# grace period, so a running container is drained first.
#
# NO $(MAKE) IN THIS RECIPE, deliberately. GNU make EXECUTES any recipe line that
# references $(MAKE) even under `make -n`, so a sub-make call sharing a logical
# line with `docker rm -f` turns a dry run into a SIGKILL of the running fleet.
# The drain is therefore inline. The same rule holds for every recipe here: a
# line that mutates a container never mentions $(MAKE).
clean-live:
	@$(RESOLVE); \
	if [ "$$(docker inspect -f '{{.State.Running}}' "$$C" 2>/dev/null)" = "true" ]; then \
	  echo "[clean] $$C is running — draining first, up to $(STOP_TIMEOUT)s (docker rm -f would SIGKILL it)"; \
	  docker stop -t $(STOP_TIMEOUT) "$$C" >/dev/null || exit $$?; \
	fi; \
	docker rm -f "$$C" 2>/dev/null || true; \
	echo "[clean] container removed; volumes $$WS + $$SR retained"

stop: stop-live

clean: clean-live

# There is NO `make vessel-ctl` passthrough, no sync-/restart-/logs- targets and
# no UI bridge: run the in-image tools against the container by name, e.g.
#   docker exec <container> vessel-ctl <verb> [args]
# The stateful UI is published by the manifest; it needs no sidecar.
