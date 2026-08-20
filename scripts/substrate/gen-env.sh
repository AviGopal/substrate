#!/bin/bash
# gen-env.sh — write /etc/substrate/env from container environment variables.
# Sourced by every systemd unit via EnvironmentFile=/etc/substrate/env.
#
# LLM provider — at least one key must be set:
#   ANTHROPIC_API_KEY   — Anthropic Claude (default / preferred)
#   OPENAI_API_KEY      — OpenAI-compatible (OpenAI, Ollama, Groq, Together, vLLM, …)
#   OPENAI_BASE_URL     — override base URL for non-OpenAI endpoints (optional)
#   LLM_DEFAULT_MODEL   — override default model (optional; defaults to claude-sonnet-4-6)
#
# JWT_SECRET and SURREAL_PASS are generated internally if not provided.
# METABOB_API_KEY is a bootstrap value replaced by identity-vessel after seeding.
set -euo pipefail

# A SPOKE (DISCOVERY_ENDPOINT names a REMOTE hub) inherits LLM capability from the
# hub's arms through discovery — it needs NO local provider key. Only a root/standalone
# (self/loopback/unset discovery) requires one. This makes the point-and-go contract
# literal: {DISCOVERY_ENDPOINT, API_KEY} alone boots a spoke. (Detected here, before the
# full role inference below, since this guard runs first.)
# HUB_DISCOVERY_URL is consulted alongside DISCOVERY_ENDPOINT, and it has to be.
# The Makefile's federated-spoke path DELIBERATELY blanks CONTAINER_DISCOVERY_ENDPOINT
# so local vessels register with the spoke's own registry rather than being repointed
# at the hub — the hub URL reaches the container as HUB_DISCOVERY_URL instead. Two
# correct decisions then contradicted each other here: a spoke arrived with an EMPTY
# DISCOVERY_ENDPOINT, was classified root/standalone, and was refused for having no
# LLM key — the one thing a spoke is explicitly not required to carry. The container
# died ~300ms in, before a single unit started.
#
# HUB_DISCOVERY_URL is the authoritative spoke signal on that path; this guard simply
# never looked at it, while the same file reads it further down, after the exit.
_llmkey_disc_host="$(printf '%s' "${DISCOVERY_ENDPOINT:-}" | sed -E 's#^[a-z]+://##; s#[:/].*##')"
_llmkey_hub_host="$(printf '%s' "${HUB_DISCOVERY_URL:-}" | sed -E 's#^[a-z]+://##; s#[:/].*##')"
case "$_llmkey_disc_host" in
  ""|127.0.0.1|localhost|0.0.0.0|::1|"$(hostname 2>/dev/null)") _is_spoke=0 ;;  # root/standalone
  *) _is_spoke=1 ;;                                                              # remote hub -> spoke
esac
case "$_llmkey_hub_host" in
  ""|127.0.0.1|localhost|0.0.0.0|::1|"$(hostname 2>/dev/null)") : ;;
  *) _is_spoke=1 ;;                                # a named hub is a spoke, whatever DISCOVERY_ENDPOINT says
esac
# NOTE: the guard itself now runs AFTER the persisted-secret fallback below —
# see "_llm_key_guard" near the provider-secret resolution. Testing the raw
# environment here declared a container dead while a perfectly good key sat in
# /workspace/.substrate-secrets, which is exactly the round-trip the docs
# promise ("a docker rm + recreate *without* -e retains them"). The spoke
# discrimination is computed here because the values it reads are inputs, but
# the decision is deferred until the effective key is known.
_llm_guard_needed="$_is_spoke"

# Internal secrets — per-field precedence: explicit env > persisted volume
# secret > fresh random. Persisted values are grep-extracted field-by-field
# (never `source`d — see the SUBSTRATE_GIT_PAT comment below for why).
#
# The old logic consulted /workspace/.substrate-secrets ONLY when
# METABOB_API_KEY was absent from the environment. A container recreate that
# passed -e METABOB_API_KEY therefore regenerated SURREAL_PASS at random while
# the surreal datastore on the persisted volume kept the ORIGINAL root
# password (SurrealDB 2.x ignores --user/--pass once a root user exists in the
# datastore) — every vessel's DB auth then failed until manual recovery
# (observed live 2026-07-02). Each secret now independently falls back to the
# persisted value, so a warm volume always wins over a fresh random.
# SUBSTRATE_ROOT is defaulted HERE, before anything expands it.
#
# It is referenced inside the /etc/substrate/env heredoc far below, and this
# script runs under `set -u`. While its only assignment lived after that
# heredoc, every launch that did not pass -e SUBSTRATE_ROOT aborted with
# "SUBSTRATE_ROOT: unbound variable" before writing any env at all — the
# container exited 1 within seconds.
#
# That was not a corner case. The Makefile's run targets pass it explicitly, so
# the `make up` path always worked; the raw `docker run` path never did. The
# raw path is the one the README presents as the canonical checkout-free quick
# start, and it fails identically on the PUBLISHED image (verified 2026-08-08).
# The value below is exactly what the Makefile passes, so both paths agree.
SUBSTRATE_ROOT="${SUBSTRATE_ROOT:-/workspace/git/super-repo}"

SECRETS_FILE="/workspace/.substrate-secrets"

# ── PROVENANCE ───────────────────────────────────────────────────────────────
# Record WHERE each value came from, so an operator can ask "did my -e win, and
# if not, what beat it?" — the question nothing in this system could answer.
#
# Why it is needed at all: the entrypoint sources the generated env file into
# its own environment, so /proc/1/environ (the obvious place to look) reports
# THIS SCRIPT'S OUTPUT back as if it were the operator's input. A value that was
# silently overridden is indistinguishable from one that was honoured. That
# single blind spot is the shape of most configuration bugs found here:
# supplied, discarded, no error.
#
# Generalises the SURREAL_PASS_SOURCE pattern already used below.
PROVENANCE_FILE="/etc/substrate/env.provenance"
# FILE-backed, not a shell variable. persisted_secret is always called as
# $(persisted_secret X), and a subshell cannot write to its parent's variables —
# an accumulator string would come back silently empty, which is precisely the
# class of bug this instrument exists to expose. Appending to a file works from
# any depth.
PROV_TMP="${TMPDIR:-/tmp}/.gen-env-provenance.$$"
: > "$PROV_TMP"
prov() { # prov <NAME> <env|persisted|generated|derived|hardcoded>
  printf '%s=%s\n' "$1" "$2" >> "$PROV_TMP"
}

# Snapshot which names arrived in the RUN environment, before any resolution
# overwrites them. This is the only moment the distinction is observable.
_ENV_SUPPLIED=""
for _n in ANTHROPIC_API_KEY OPENAI_API_KEY OPENAI_BASE_URL GOOGLE_API_KEY GROQ_API_KEY \
          MISTRAL_API_KEY CHUTES_API_KEY OPENROUTER_API_KEY RUNPOD_API_KEY \
          VLLM_BASE_URL VLLM_MODELS VLLM_API_KEY VLLM_ENDPOINTS \
          METABOB_API_KEY API_KEY_SECRET SURREAL_PASS JWT_SECRET SUBSTRATE_GIT_PAT \
          DISCOVERY_ENDPOINT HUB_DISCOVERY_URL ACTIVITY_API_ENDPOINT IDENTITY_VESSEL_URL \
          FED_SUBSTRATE_ID RELAY_MULTIADDR PEER_DISCOVERY_ENDPOINTS PUBLIC_IP \
          ENABLED_ROLES ENABLED_VESSELS DISABLED_VESSELS ENABLED_EXTRA_VESSELS PROFILE \
          LLM_ARMS LLM_DEFAULT_MODEL MITOSIS_DIRECT_PUSH; do
  if [[ -n "${!_n:-}" ]]; then _ENV_SUPPLIED="${_ENV_SUPPLIED} ${_n}"; fi
done

persisted_secret() {
  local _v=""
  [[ -f "$SECRETS_FILE" ]] && _v="$(grep -m1 "^$1=" "$SECRETS_FILE" | cut -d= -f2- || true)"
  # Attribute at the point of resolution: if this function is being consulted at
  # all, the caller's ${VAR:-…} found the environment empty.
  if [[ -n "$_v" ]]; then prov "$1" persisted; fi
  printf '%s' "$_v"
}

JWT_SECRET="${JWT_SECRET:-$(persisted_secret JWT_SECRET)}"
# Additive vessel selection (kept ON TOP of ENABLED_ROLES by apply-inventory) —
# e.g. a hub deployed with ENABLED_ROLES=hub that should also run a single
# compute-role vessel like development-vessel. Persisted in the secrets store so
# it survives a bare restart/recreate without a redeploy.
ENABLED_EXTRA_VESSELS="${ENABLED_EXTRA_VESSELS:-$(persisted_secret ENABLED_EXTRA_VESSELS)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
# Federation substrate id — unique per substrate in the hub namespace, minted
# once and persisted (a fresh id each boot would churn the hub registry). Only
# load-bearing for a spoke; harmless on a root. Point-and-go: never an operator
# input, so a raw `docker run -e DISCOVERY_ENDPOINT=<hub>` self-federates.
FED_SUBSTRATE_ID="${FED_SUBSTRATE_ID:-$(persisted_secret FED_SUBSTRATE_ID)}"
FED_SUBSTRATE_ID="${FED_SUBSTRATE_ID:-spoke-$(openssl rand -hex 4)}"
# Transport peer identity — derived from the substrate id so the libp2p keypair is
# substrate-unique (spoke-federate.sh set this by hand; now it falls out of boot).
FED_VESSEL_ID="${FED_VESSEL_ID:-federation-transport-vessel@${FED_SUBSTRATE_ID}}"

SURREAL_PASS_SOURCE="provided"
if [[ -z "${SURREAL_PASS:-}" ]]; then
  SURREAL_PASS="$(persisted_secret SURREAL_PASS)"
  if [[ -z "$SURREAL_PASS" ]]; then
    SURREAL_PASS="$(openssl rand -hex 16)"
    SURREAL_PASS_SOURCE="generated"
  fi
fi
# Drift guard: a freshly-generated SURREAL_PASS against an EXISTING datastore
# can never authenticate (the datastore keeps its original root user). Warn
# loudly so the failure mode is diagnosable from the boot log, not from 980
# downstream "problem with authentication" errors.
if [[ "$SURREAL_PASS_SOURCE" == "generated" ]] && [[ -e /var/lib/surrealdb/data.db ]]; then
  echo "[gen-env] WARNING: generated a fresh SURREAL_PASS but /var/lib/surrealdb/data.db already exists." >&2
  echo "[gen-env] WARNING: SurrealDB ignores --pass once a root user exists — DB auth WILL fail." >&2
  echo "[gen-env] WARNING: restore the original SURREAL_PASS (env or /workspace/.substrate-secrets) or reset the datastore root user." >&2
fi

# API key signing secret: the HMAC key identity-vessel uses to sign AND verify
# every `mb-` API key. If unset, identity-vessel falls back to a PUBLIC hardcoded
# default ('dev-secret-change-in-production') — anyone could forge keys, and two
# substrates that both fall back share one trust space (the shared-API_KEY_SECRET
# federation hazard). Give each substrate its own secret and round-trip it so
# issued keys keep validating across restarts.
API_KEY_SECRET="${API_KEY_SECRET:-$(persisted_secret API_KEY_SECRET)}"
if [[ -z "$API_KEY_SECRET" ]]; then
  if [[ -e /var/lib/surrealdb/data.db ]]; then
    # Existing datastore, no persisted secret → its keys were signed with the
    # legacy public default. Generating a fresh secret now would invalidate every
    # already-issued key. Fall back to the legacy public default ONLY if the
    # operator explicitly opts in; otherwise FAIL CLOSED — a forgeable trust space
    # (and shared-secret federation hazard) must never come up silently.
    if [[ "${ALLOW_INSECURE_API_KEY_SECRET:-}" == "1" ]]; then
      API_KEY_SECRET="dev-secret-change-in-production"
      echo "[gen-env] WARNING: no persisted API_KEY_SECRET on an existing datastore — using the INSECURE legacy default (ALLOW_INSECURE_API_KEY_SECRET=1)." >&2
      echo "[gen-env] WARNING: keys are forgeable until you set a strong API_KEY_SECRET and re-issue them." >&2
    else
      echo "[gen-env] ERROR: no persisted API_KEY_SECRET on an existing datastore." >&2
      echo "[gen-env] ERROR: falling back to the legacy public default ('dev-secret-change-in-production') would make every issued key forgeable, and two substrates that both fall back would share one trust space (the shared-API_KEY_SECRET federation hazard)." >&2
      echo "[gen-env] ERROR: refusing to boot insecure. Fix: set a strong API_KEY_SECRET (e.g. 'openssl rand -hex 32'), persist it to /workspace/.substrate-secrets, and re-issue keys." >&2
      echo "[gen-env] ERROR: to keep the legacy insecure behavior for an existing deployment, set ALLOW_INSECURE_API_KEY_SECRET=1." >&2
      exit 1
    fi
  else
    API_KEY_SECRET="$(openssl rand -hex 32)"
  fi
fi

# Dual-secret rotation window (identity-vessel validation.ts): a presented key is
# accepted if it validates against API_KEY_SECRET *or* any comma-separated secret
# in API_KEY_SECRET_PREVIOUS. EXPLICIT / persisted opt-in ONLY — never
# auto-derived. (History: a transitional auto-bridge to 'dev-secret-change-in-
# production' was added 2026-07-23 when a strong API_KEY_SECRET had been persisted
# AFTER the fleet keys were issued under the legacy public default and never
# re-issued — a clean recreate then failed every signature. That was resolved at
# the ROOT by RE-SIGNING the fleet key under the strong secret (persisted
# METABOB_API_KEY now matches the persisted strong API_KEY_SECRET, so a clean boot
# validates with no bridge), and the legacy dev-default is now REJECTED. Auto-
# deriving the bridge again would re-open acceptance of forgeable legacy keys, so
# it is retired. Set API_KEY_SECRET_PREVIOUS explicitly only for a deliberate
# secret rotation, and drop it once all keys are re-issued.)
API_KEY_SECRET_PREVIOUS="${API_KEY_SECRET_PREVIOUS:-$(persisted_secret API_KEY_SECRET_PREVIOUS)}"

# Bootstrap key: used only for the initial identity-vessel signup call.
# After seed-identity.ts runs, vessels use the HMAC keys it issues.
# Stored in /workspace/.substrate-secrets so restarts reuse the same value.
METABOB_API_KEY="${METABOB_API_KEY:-$(persisted_secret METABOB_API_KEY)}"

# ★ A SPOKE MUST NOT MINT ITS OWN JOIN CREDENTIAL.
#
# The generator below is correct for a root/standalone substrate: it is the
# bootstrap value identity-vessel replaces after seeding, so a random one is
# fine. For a SPOKE it is actively harmful — the whole point of
# METABOB_API_KEY on a join is that the HUB issued it. Falling through to
# openssl produced a spoke that booted green, passed every readiness check,
# and then failed hub auth at first contact, with nothing at setup time saying
# why. .env.example calls this variable "REQUIRED ... THIS is what joins the
# group"; omitting it was silently survivable, which is the worst combination.
#
# Fail closed, and name the fix. `_is_spoke` is computed at the top of this
# file from DISCOVERY_ENDPOINT / HUB_DISCOVERY_URL.
if [[ "$_is_spoke" = "1" && -z "${METABOB_API_KEY:-}" ]]; then
  echo "[gen-env] ERROR: this container is configured as a SPOKE (a remote hub is set) but no hub-issued credential was supplied." >&2
  echo "[gen-env]   Set METABOB_API_KEY to the key the HUB issued for this spoke." >&2
  echo "[gen-env]   Mint one on the hub with: make -C scripts/substrate issue-key NAME=<this-spoke>" >&2
  echo "[gen-env]   Refusing to generate one locally: a self-minted key is not a member of the hub's identity group," >&2
  echo "[gen-env]   so the spoke would boot healthy and then fail every federated call with 401." >&2
  exit 1
fi

METABOB_API_KEY="${METABOB_API_KEY:-$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)}"

# Optional per-vessel keys — fall back to METABOB_API_KEY if unset (D4)
LOCAL_TOOLS_VESSEL_API_KEY="${LOCAL_TOOLS_VESSEL_API_KEY:-${METABOB_API_KEY}}"
GOAL_HOST_VESSEL_API_KEY="${GOAL_HOST_VESSEL_API_KEY:-${METABOB_API_KEY}}"
RIBOSOME_VESSEL_API_KEY="${RIBOSOME_VESSEL_API_KEY:-${METABOB_API_KEY}}"
CONCEPT_DB_API_KEY="${CONCEPT_DB_API_KEY:-${METABOB_API_KEY}}"

# Self-admin key: the read/write/admin mint credential seed-identity.ts issues
# after signup (the key operators and the keyctl CLI use to manage this keyspace
# — issue/revoke/list). gen-env NEVER generates it (identity-vessel mints it),
# but it MUST be round-tripped here so a container recreate — which rewrites
# .substrate-secrets — does not wipe it. Empty on first boot; set after seeding.
SUBSTRATE_ADMIN_KEY="${SUBSTRATE_ADMIN_KEY:-$(persisted_secret SUBSTRATE_ADMIN_KEY)}"

# Self-development push credential (container-side direct push to AviGopal repos).
# Fine-grained PAT (Contents:R/W). Comes from the environment (compose/run) or
# the persisted secrets file; reused across restarts. Empty = self-push disabled.
# NB: this block (and the persisted-secrets heredoc below) must round-trip the
# PAT, else gen-env would wipe an operator-supplied PAT on the next restart.
#
# Extract ONLY the SUBSTRATE_GIT_PAT field rather than `source`ing the whole
# file: sourcing re-imports every var the file declares (JWT_SECRET,
# SURREAL_PASS, METABOB_API_KEY, ...), silently clobbering an operator-supplied
# override (e.g. a hub-issued METABOB_API_KEY passed at `docker run` time) back
# to whatever was last persisted on the volume — the two never diverge in the
# common case, so this went unnoticed until an override actually needed to
# stick. It also meant a stale/malformed line anywhere else in that file (e.g.
# a historical unquoted SUBSTRATE_GIT_AUTHOR_NAME) would run as a command here.
SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT:-$(persisted_secret SUBSTRATE_GIT_PAT)}"
SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT:-}"
SUBSTRATE_GIT_AUTHOR_NAME="${SUBSTRATE_GIT_AUTHOR_NAME:-Substrate Autonomous}"
SUBSTRATE_GIT_AUTHOR_EMAIL="${SUBSTRATE_GIT_AUTHOR_EMAIL:-substrate-autonomous@substrate.local}"

# LLM / provider credentials — durable pass-through secrets. Precedence matches
# the internal secrets above: explicit env (docker run -e) > persisted volume
# (/workspace/.substrate-secrets) > empty. Persisting them means a container
# RECREATE that does NOT re-pass -e KEY keeps the provider working (the same
# regression that bit SURREAL_PASS on 2026-07-02). To add a new provider (e.g. a
# second OpenAI-wire service like chutes), add its *_API_KEY in the THREE marked
# provider-secret spots: (1) here, (2) the /etc/substrate/env heredoc, (3) the
# persisted-secrets heredoc — one line each, matching the explicit idiom this
# file deliberately uses instead of sourcing/looping.
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(persisted_secret ANTHROPIC_API_KEY)}"
OPENAI_API_KEY="${OPENAI_API_KEY:-$(persisted_secret OPENAI_API_KEY)}"
OPENAI_BASE_URL="${OPENAI_BASE_URL:-$(persisted_secret OPENAI_BASE_URL)}"
CHUTES_API_KEY="${CHUTES_API_KEY:-$(persisted_secret CHUTES_API_KEY)}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-$(persisted_secret OPENROUTER_API_KEY)}"
GOOGLE_API_KEY="${GOOGLE_API_KEY:-$(persisted_secret GOOGLE_API_KEY)}"
GROQ_API_KEY="${GROQ_API_KEY:-$(persisted_secret GROQ_API_KEY)}"
MISTRAL_API_KEY="${MISTRAL_API_KEY:-$(persisted_secret MISTRAL_API_KEY)}"
VLLM_BASE_URL="${VLLM_BASE_URL:-$(persisted_secret VLLM_BASE_URL)}"
VLLM_MODELS="${VLLM_MODELS:-$(persisted_secret VLLM_MODELS)}"
VLLM_API_KEY="${VLLM_API_KEY:-$(persisted_secret VLLM_API_KEY)}"
VLLM_ENDPOINTS="${VLLM_ENDPOINTS:-$(persisted_secret VLLM_ENDPOINTS)}"

# ★ THE LLM-KEY GUARD, deferred to here so it tests the EFFECTIVE key.
#
# It used to sit ~165 lines above, before the persisted_secret fallbacks that
# immediately precede it. The consequence: a container recreated without -e
# died at boot — "No LLM provider key found" — while a valid key sat in
# /workspace/.substrate-secrets and the docs advertised that exact round-trip
# as a guarantee. The guard was reading the operator's input when the thing
# that matters is what the resolution produced.
#
# `_llm_guard_needed` is computed above (0 = root/standalone, 1 = spoke),
# because the spoke discrimination reads DISCOVERY_ENDPOINT / HUB_DISCOVERY_URL,
# which are inputs. Only the DECISION is deferred.
if [[ "$_llm_guard_needed" = "0" && -z "${ANTHROPIC_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "[gen-env] ERROR: No LLM provider key found." >&2
  echo "[gen-env]   A root/standalone substrate needs one; a spoke inherits LLM arms from its hub." >&2
  echo "[gen-env]   Set ANTHROPIC_API_KEY (or OPENAI_API_KEY + OPENAI_BASE_URL) via -e / compose / make." >&2
  echo "[gen-env]   Checked: the run environment AND persisted values in /workspace/.substrate-secrets." >&2
  echo "[gen-env]   To run as a spoke instead, set HUB_DISCOVERY_URL to your hub's discovery endpoint." >&2
  exit 1
fi
# RunPod Serverless. RUNPOD_ENDPOINT_ID is not a secret but must round-trip the
# same way: llm-resolver-vessel registers the arm only when it is present, so
# losing it on a container recreate silently un-registers the lane. MODELS and
# COST_PER_MTOK are optional overrides — the vessel has defaults for both.
RUNPOD_API_KEY="${RUNPOD_API_KEY:-$(persisted_secret RUNPOD_API_KEY)}"
RUNPOD_ENDPOINT_ID="${RUNPOD_ENDPOINT_ID:-$(persisted_secret RUNPOD_ENDPOINT_ID)}"
RUNPOD_MODELS="${RUNPOD_MODELS:-$(persisted_secret RUNPOD_MODELS)}"
RUNPOD_COST_PER_MTOK="${RUNPOD_COST_PER_MTOK:-$(persisted_secret RUNPOD_COST_PER_MTOK)}"

# Endpoint aliases — resolve BEFORE the heredoc so every inner reference is a
# bound variable. Previously the alias defaults nested unguarded expansions
# (e.g. \${DISCOVERY_VESSEL_ENDPOINT:-\${DISCOVERY_ENDPOINT}}) INSIDE the
# heredoc: under `set -u` a bare `docker run` without the Makefile's dozen
# empty -e passthroughs died with "DISCOVERY_ENDPOINT: unbound variable" —
# a hidden host/Makefile coupling in what must be a pure docker-run contract
# (surfaced 2026-07-02 by the first from-scratch container test).
DISCOVERY_ENDPOINT="${DISCOVERY_ENDPOINT:-http://127.0.0.1:8100}"
# Point-and-go role inference (docs/FEDERATION.md, point-and-go join contract):
# a container is handed exactly {DISCOVERY_ENDPOINT, API_KEY}. If DISCOVERY_ENDPOINT
# names a REMOTE host (not loopback/self), THIS container is a SPOKE of that
# network — derive the hub, activity-api, identity, and peering from the one
# endpoint, and keep the spoke's OWN vessels registering into its LOCAL discovery
# (federation-transport mirrors local capability to the hub; discovery peers back
# for hub producers). Previously this derivation lived ONLY in the Makefile, so a
# raw `docker run -e DISCOVERY_ENDPOINT=<hub>` never peered (the split-brain).
# CRITIC-GUARD: remote => spoke; self/loopback => root. An UNREACHABLE remote is
# still a spoke (federation retries), NEVER a self-promoted root (that would fork
# identity/registry). Root election is self-referential discovery only.
_disc_host="$(printf '%s' "$DISCOVERY_ENDPOINT" | sed -E 's#^[a-z]+://##; s#[:/].*##')"
_self_host="$(hostname 2>/dev/null || true)"
case "$_disc_host" in
  ""|127.0.0.1|localhost|0.0.0.0|::1|"$_self_host")
    : ;; # root / standalone — discovery is self/loopback; no hub, no peering
  *)
    # remote hub => spoke. Derive everything from the single endpoint host.
    HUB_DISCOVERY_URL="${HUB_DISCOVERY_URL:-http://${_disc_host}:18100}"
    ACTIVITY_API_ENDPOINT="${ACTIVITY_API_ENDPOINT:-http://${_disc_host}:18080}"
    IDENTITY_VESSEL_URL="${IDENTITY_VESSEL_URL:-http://${_disc_host}:18101}"
    IDENTITY_ENDPOINT="${IDENTITY_ENDPOINT:-$IDENTITY_VESSEL_URL}"
    ENABLED_ROLES="${ENABLED_ROLES:-spoke}"
    # the spoke's own vessels register into its LOCAL discovery, not the hub
    DISCOVERY_ENDPOINT="http://127.0.0.1:8100"
    ;;
esac
DISCOVERY_VESSEL_ENDPOINT="${DISCOVERY_VESSEL_ENDPOINT:-$DISCOVERY_ENDPOINT}"
ACTIVITY_API_ENDPOINT="${ACTIVITY_API_ENDPOINT:-http://127.0.0.1:8080}"
ACTIVITY_API_URL="${ACTIVITY_API_URL:-$ACTIVITY_API_ENDPOINT}"
PRODUCER_DISCOVERY_ENDPOINT="${PRODUCER_DISCOVERY_ENDPOINT:-$ACTIVITY_API_ENDPOINT}"
METABOB_ENDPOINT="${METABOB_ENDPOINT:-$ACTIVITY_API_ENDPOINT}"
IDENTITY_VESSEL_URL="${IDENTITY_VESSEL_URL:-http://127.0.0.1:8101}"
IDENTITY_ENDPOINT="${IDENTITY_ENDPOINT:-$IDENTITY_VESSEL_URL}"
# Federated-spoke identity (docs/FEDERATION.md): the hub discovery this
# substrate mirrors its capability surface into, and the relay + unique
# substrate id the federation-transport-vessel uses. Empty on a plain local
# substrate; set by `make up DISCOVERY_ENDPOINT=<hub>` (spoke auto-derivation)
# and consumed by vessel-ctl'd dynamic vessels via /etc/substrate/env.
HUB_DISCOVERY_URL="${HUB_DISCOVERY_URL:-}"
FED_SUBSTRATE_ID="${FED_SUBSTRATE_ID:-}"
RELAY_MULTIADDR="${RELAY_MULTIADDR:-}"

# Discovery peer fan-out: a spoke that knows its hub must also SEE the hub's
# producers, or federation is one-way (spoke rows visible at the hub, hub rows
# invisible at the spoke). Default the peer list to the hub discovery and union
# the results; both stay overridable and empty on a plain local substrate.
# Operator passthrough: an explicitly provided PEER_DISCOVERY_ENDPOINTS (comma-
# separated) is honored AND persisted, so a HUB/root — whose HUB_DISCOVERY_URL
# is empty and which therefore has no resolve-time fan-out by default — can be
# pointed at its spokes' discoveries and survive a container recreate without
# re-passing -e. Precedence: explicit env > persisted explicit > hub derivation
# > empty. Only the EXPLICIT value is persisted (never the hub-derived one, so
# re-pointing DISCOVERY_ENDPOINT at a new hub is never shadowed by a stale pin).
PEER_DISCOVERY_ENDPOINTS_EXPLICIT="${PEER_DISCOVERY_ENDPOINTS:-$(persisted_secret PEER_DISCOVERY_ENDPOINTS)}"
PEER_DISCOVERY_ENDPOINTS="${PEER_DISCOVERY_ENDPOINTS_EXPLICIT:-${HUB_DISCOVERY_URL}}"
PEER_FANOUT_MODE="${PEER_FANOUT_MODE:-union}"

mkdir -p /workspace
cat > /etc/substrate/env <<EOF
# Generated by gen-env.sh — do not edit manually
# Values are double-quoted so entries containing spaces (e.g. the git author
# name "Substrate Autonomous") source cleanly via 'set -a && . /etc/substrate/env'.
# Unquoted, SUBSTRATE_GIT_AUTHOR_NAME=Substrate Autonomous runs 'Autonomous'
# as a command ("command not found") and mis-sets the author to just "Substrate".
# (NB backticks are FORBIDDEN in this heredoc — <<EOF is unquoted, so a backtick
# span in a comment EXECUTES at generation time.)
JWT_SECRET="${JWT_SECRET}"
SURREAL_PASS="${SURREAL_PASS}"
API_KEY_SECRET="${API_KEY_SECRET}"
API_KEY_SECRET_PREVIOUS="${API_KEY_SECRET_PREVIOUS:-}"
METABOB_API_KEY="${METABOB_API_KEY}"
SUBSTRATE_ADMIN_KEY="${SUBSTRATE_ADMIN_KEY:-}"
# LLM provider credentials — at least one must be non-empty (validated above).
# (2) provider-secret spot — resolved (env>persisted>empty) just above.
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_BASE_URL="${OPENAI_BASE_URL:-}"
CHUTES_API_KEY="${CHUTES_API_KEY:-}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"
GROQ_API_KEY="${GROQ_API_KEY:-}"
MISTRAL_API_KEY="${MISTRAL_API_KEY:-}"
RUNPOD_API_KEY="${RUNPOD_API_KEY:-}"
RUNPOD_ENDPOINT_ID="${RUNPOD_ENDPOINT_ID:-}"
RUNPOD_MODELS="${RUNPOD_MODELS:-}"
RUNPOD_COST_PER_MTOK="${RUNPOD_COST_PER_MTOK:-}"
# Self-hosted vLLM. docker-compose.yml has declared these four under a six-line
# explanatory comment since they were added, but this file never emitted them —
# and systemd units inherit nothing from the container env (53 units carry
# EnvironmentFile=/etc/substrate/env, none carries PassEnvironment). The
# resolver reads process.env.VLLM_*, so the documented configuration produced
# no arm and no error. Emitting them here is what makes the compose block real.
VLLM_BASE_URL="${VLLM_BASE_URL:-}"
VLLM_MODELS="${VLLM_MODELS:-}"
VLLM_API_KEY="${VLLM_API_KEY:-}"
VLLM_ENDPOINTS="${VLLM_ENDPOINTS:-}"
# The autonomous edit-landing kill switch. goal-host reads it (three call
# sites), but nothing emitted it, so an operator setting it in .env or -e
# changed nothing — a kill switch that cannot be pulled. Unset leaves
# goal-host's own default in force; set 0 to route edit intent to intent-only.
ROUTE_EDIT_INTENT_TO_COMPOSE="${ROUTE_EDIT_INTENT_TO_COMPOSE:-}"
LLM_DEFAULT_MODEL="${LLM_DEFAULT_MODEL:-}"
# Substrate root inside the container = the container-native super-repo clone.
# The container is unmoored from the host filesystem: no host repo bind. Every
# tick unit references its script as \${SUBSTRATE_ROOT}/scripts/substrate/...
# and the substrate keeps the clone current by pulling origin/dev itself.
#
# DEFAULTED, not left empty, and defaulted EARLY — see the assignment near the
# top of this file. This line is now only a no-op re-affirmation kept for
# readability. It used to be the sole assignment, which made the documented
# checkout-free launch impossible: the env heredoc above expands
# ${SUBSTRATE_ROOT} roughly thirty lines BEFORE this point, and gen-env runs
# under `set -u`, so any `docker run` that did not pass -e SUBSTRATE_ROOT died
# with "SUBSTRATE_ROOT: unbound variable" before writing a single line of env.
# The Makefile's run targets pass it explicitly, so the make path always worked
# and the raw path never did — including the README's own quick-start command,
# verified against the PUBLISHED image on 2026-08-08.
SUBSTRATE_ROOT="${SUBSTRATE_ROOT:-/workspace/git/super-repo}"
# Workspace root for file/dir resolvers (fs_list, fs_read, shell CWD) — law 11
# (location independence): every vessel must resolve a relative path ("docs") to
# the SAME place regardless of where its process runs. Anchor it to the container
# super-repo clone (SUBSTRATE_ROOT). Previously WORKSPACE_ROOT was set ad-hoc
# outside gen-env, so a regenerate silently dropped it and file-path resolution
# fell back to each vessel's process.cwd() (the fs_list "0 files in docs" bug).
WORKSPACE_ROOT="${WORKSPACE_ROOT:-${SUBSTRATE_ROOT}}"
# Writable run-dir for the timer SCRIPTS (self-activation, 2026-06-26). The tick
# units' run-dir.conf drop-ins reference their script as
# \${SUBSTRATE_RUN_DIR}/<name>.ts. substrate-active-scripts-seed.service copies
# the (boot-fresh, read-only) bind scripts into this writable volume dir at boot;
# the development-vessel activate_substrate_script resolver then overwrites a copy
# in place to make a substrate-authored new version live on the NEXT timer firing,
# with NO container restart. Defaulted here so a recreate is self-activation-capable
# even if the value wasn't passed in.
SUBSTRATE_RUN_DIR="${SUBSTRATE_RUN_DIR:-/workspace/active-scripts}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT}"
SUBSTRATE_GIT_AUTHOR_NAME="${SUBSTRATE_GIT_AUTHOR_NAME}"
SUBSTRATE_GIT_AUTHOR_EMAIL="${SUBSTRATE_GIT_AUTHOR_EMAIL}"

# Self-alteration cutover: direct-push mode. With the writable vessel clones
# (setup-git-push.sh) + SUBSTRATE_GIT_PAT credential helper in place, the
# vessel-mitosis-cutover resolver commits+pushes the authored change to
# origin/dev of the vessel clone, then mirrors the staged files into the live
# /vessels/<vessel> runtime and restarts the unit. Without these three knobs
# the cutover only records an intent that nothing here consumes (the host repo
# bind mount is read-only) — i.e. authored fixes never land.
#   MITOSIS_DIRECT_PUSH=1        — enable commit+push+mirror instead of intent
#   MITOSIS_RUNTIME_DIR=/vessels — live runtime: also the freshness-check root,
#                                  so the gate hashes the same file apply-proposal
#                                  patched (kills the base_sha path-mismatch livelock)
#   MITOSIS_PUSH_CLONE_DIR       — where setup-git-push put the per-vessel clones
MITOSIS_DIRECT_PUSH=${MITOSIS_DIRECT_PUSH:-1}
MITOSIS_RUNTIME_DIR=${MITOSIS_RUNTIME_DIR:-/vessels}
MITOSIS_PUSH_CLONE_DIR=${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}
LOCAL_TOOLS_VESSEL_API_KEY=${LOCAL_TOOLS_VESSEL_API_KEY}
GOAL_HOST_VESSEL_API_KEY=${GOAL_HOST_VESSEL_API_KEY}
RIBOSOME_VESSEL_API_KEY=${RIBOSOME_VESSEL_API_KEY}
CONCEPT_DB_API_KEY=${CONCEPT_DB_API_KEY}

# Substrate internal: allow all localhost calls to bypass identity-vessel rate limiting
RATE_LIMIT_ALLOWLIST_IPS=127.0.0.1,unknown

# Infrastructure. Overridable (default unchanged: in-container localhost) so a
# compute-only vessel subset — no local "store" role, see vessels.inventory.json's
# "spoke" role group — can point at a remote substrate's store instead of the
# one baked into this container.
SURREALDB_URL="${SURREALDB_URL:-http://127.0.0.1:8000}"
SURREALDB_NAMESPACE=activity-system
SURREALDB_DATABASE=learning_loop
SURREALDB_USERNAME=root
SURREALDB_PASSWORD=${SURREAL_PASS}
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"

# Vessel endpoints. Overridable per-vessel (default unchanged: in-container
# localhost) so a compute-only vessel subset can point its "control"/"api" roles
# at a remote hub instead of localhost — the missing half of running "any subset
# of vessels, within or between containers/hosts" (the shared-namespace spoke
# pattern in docs/FEDERATION.md). Previously these were hardcoded literals that
# silently ignored any operator-supplied override.
#
# Each concept below has drifted into TWO+ historical env-var names across the
# fleet (confirmed by grepping every vessel's src/ for process.env.*DISCOVERY*
# and process.env.*ACTIVITY_API* — 2026-07-02): local-tools-vessel/analysis-vessel
# read DISCOVERY_ENDPOINT; goal-host/llm-resolver/ribosome/concept-db/analysis/
# stateful-ui read DISCOVERY_VESSEL_ENDPOINT; concept-db/analysis-vessel also read
# ACTIVITY_API_URL alongside ACTIVITY_API_ENDPOINT; goal-host additionally reads
# PRODUCER_DISCOVERY_ENDPOINT for its forward-producer walk (defaults to the same
# vessel as ACTIVITY_API_ENDPOINT unless deliberately split). All aliases for a
# given concept are set to the SAME value here so one override reaches every
# vessel regardless of which historical name it happens to read.
# (Values resolved above the heredoc — bound-variable contract under set -u.)
DISCOVERY_ENDPOINT="${DISCOVERY_ENDPOINT}"
DISCOVERY_VESSEL_ENDPOINT="${DISCOVERY_VESSEL_ENDPOINT}"
ACTIVITY_API_ENDPOINT="${ACTIVITY_API_ENDPOINT}"
ACTIVITY_API_URL="${ACTIVITY_API_URL}"
PRODUCER_DISCOVERY_ENDPOINT="${PRODUCER_DISCOVERY_ENDPOINT}"
# METABOB_ENDPOINT and ACTIVITY_API_ENDPOINT name the same vessel (activity-api)
# under two historical aliases; defaulted one from the other so overriding
# ACTIVITY_API_ENDPOINT alone is sufficient.
METABOB_ENDPOINT="${METABOB_ENDPOINT}"
IDENTITY_VESSEL_URL="${IDENTITY_VESSEL_URL}"
IDENTITY_ENDPOINT="${IDENTITY_ENDPOINT}"

# Federation (empty unless this substrate is a spoke of a hub)
HUB_DISCOVERY_URL="${HUB_DISCOVERY_URL}"
FED_SUBSTRATE_ID="${FED_SUBSTRATE_ID}"
FED_VESSEL_ID="${FED_VESSEL_ID}"
RELAY_MULTIADDR="${RELAY_MULTIADDR}"
PEER_DISCOVERY_ENDPOINTS="${PEER_DISCOVERY_ENDPOINTS}"
PEER_FANOUT_MODE="${PEER_FANOUT_MODE}"

# Dense search (F-V58 fix — must point to directory containing model.onnx + vocab.txt)
EMBEDDING_MODEL_DIR=/vessels/activity-api/src/assets/models/all-MiniLM-L6-v2

# M1 embedding-conditioned Thompson prior (concept_vugylIHzIMvk).
# When true, posterior-update.ts looks up per-cell embeddings from concept-db
# and routes prior seeding through computeEmbeddingConditionedPrior. Falls
# back to the concept-neighbor empirical-Bayes path on any miss.
EMBEDDING_PRIOR_ENABLED=true

# M1 continuous-training observer (concept_KKwxHmPfEMSY). Opt-in: when true,
# activity-api spawns an in-process broadcaster subscriber that buffers
# eligible (variant, signature) cells from task.completed events and re-fits
# θ_α/θ_β into embedding_prior_weights on count or time threshold. Default
# off — Layer 1 (systemd m1-trainer.timer) handles the periodic re-fit; turn
# this on for sub-15min responsiveness once it's been load-tested.
EMBEDDING_PRIOR_OBSERVER_ENABLED=false

# Trace-retention sweep (src/services/trace-retention.ts). Bounds the
# activity_execution_traces store so the lifecycle flooders (validator-dispatch,
# slot-binding) don't re-bloat it past ~100K rows (the O(rows) trace-read hot
# path gates the learning loop). Keeps ALL traces < 2h old plus a uniform-random
# 2000-row sample of each cold (activity_id,status) stratum; deletes in bounded
# 1000-row batches every 30min. Reviewed via dry-run 2026-06-21 before enabling
# (one-off sweep removed 108,564 rows: 265K->160K, CPU flat throughout).
TRACE_RETENTION_ENABLED=true
TRACE_RETENTION_DRY_RUN=false
# Per-stratum caps for the continuous sweep. Defaults are 2000/2000; the store
# had drifted to ~218K rows / ~13G (many auto-discovered strata x 2000), which
# pushes SurrealDB's working set past the 22G MemoryHigh / 26G MemoryMax cgroup
# budget and drives the ~hourly OOM-restart. Tighten successes hard (cheap,
# redundant) but keep failures generous (rarer, higher debug value).
TRACE_RETENTION_DEFAULT_SUCCESS_CAP=600
TRACE_RETENTION_DEFAULT_FAILURE_CAP=2000
# Episodic reconcile (reconcile_trace_store, fired condition-driven by
# trace-store-health-check -> trace_store_health_observer on cap overage).
# Global hard bound + a SHORT full-history window. 14d of full history at the
# ~30s trace cadence is itself a bloat source; 3d keeps ample recent debugging
# context. All Thompson posteriors (variant_performance_metrics /
# context_thompson_scores / activity_metrics) are stored separately and updated
# incrementally at ingest, so pruning cold traces loses NO learned state.
# Raised 40000->150000 (operator decision 2026-07-22): the per-stratum sweep
# legitimately retains ~108K across 1000+ activity_ids, so a 40K global cap
# could never clear — the health observer alarmed on a global count the
# per-stratum enforcer never bounded. The global-ceiling valve below now
# enforces THIS number (globalCeiling defaults to TRACE_STORE_CAP), so SENSE ==
# ENFORCE at 150K: keeps all current traces, bounds future growth.
TRACE_STORE_CAP=150000
# Global-ceiling reservoir valve (trace-retention.ts): after the per-stratum
# sweep, prune oldest-beyond-ceiling so the store's TOTAL size is bounded to the
# number the health observer senses. Defaults its ceiling to TRACE_STORE_CAP.
TRACE_RETENTION_GLOBAL_CEILING_ENABLED=true
TRACE_STORE_HOT_WINDOW_DAYS=3
TRACE_STORE_RESERVOIR_PER_ACTIVITY=25
# DELETE batch width — the re-test trace-retention.ts asks for in its own words:
# "Re-test batch=1 on a QUIET table before drawing a conclusion from that sample."
#
# Why now (2026-08-16). The valve has been committing ZERO rows per cycle against a
# 150K ceiling while the surplus grew monotonically (294,970 -> 295,625 -> 296,430):
# it selects 25 ids, issues the DELETE, and times out at 300s every time. Two things
# make batch=1 the right next probe rather than more analysis:
#   1. The prior batch=1 sample was CONTAMINATED — a unique index was rebuilding
#      concurrently during it, so it neither confirmed nor refuted. The note says so
#      and asks for the clean re-test.
#   2. I hypothesised the current failure was a phase lock with REBUILD INDEX and was
#      REFUTED by my own first test: the DELETE ran 13:41:38 -> timed out 13:45:44
#      with no rebuild running anywhere in the window. So the table IS quiet in the
#      sense the note meant, and the re-test is now meaningful.
# The comparison is also sharper than when the note was written: batch 25 now achieves
# 0 rows/cycle against the 3.52 s/row that same note records as its best measurement.
#
# This is a PROBE, not a settled default. It is rendered here rather than applied as a
# systemd drop-in so it travels the normal deploy path and is visible in git. Read ONE
# sweep after it lands: a non-zero delete count means statement width was the lever and
# this line stays; another timeout confirms by elimination that the cost is in the
# storage engine's delete path for this table, which is a design question
# (partitioning, a different retention substrate, or not storing this volume) and NOT
# tunable here — in which case revert this line rather than keep tuning.
# REVERTED to the code default after measuring BOTH halves (2026-08-16, same session).
# batch=1 genuinely made each statement cheap — 239ms vs 3,155ms for a 25-id DELETE, and the
# 25-id form timed out often enough to commit ZERO. That much is settled and vindicates the
# threshold reading in trace-retention.ts.
#
# But cheap-per-statement is not cheap-in-aggregate. At batch=1 the sweep issues ~25x the
# statements, and 19 minutes in, the hub had 320 queries in flight, mean latency 17.7s (from
# 180ms), p50 33.7s, 8,469 of 10,484 queries slow, max back at the 300s timeout, load average
# 13.4 — while the ceiling valve had still not been reached and the row count had not fallen.
# The DELETE cost moved from the statement into the queue.
#
# So the honest result is: statement width is real, AND batch=1 is not the fix on a store this
# size under live ingest. The remaining lever is the design question the note below already
# names (partitioning, a different retention substrate, or not storing this volume), not a
# batch number. Leaving the value unset so the code default (25) applies; the measurement is
# preserved here so nobody re-runs it.
# TRACE_RETENTION_DELETE_BATCH=1

# Obsidian plugin endpoint (2026-06-22). The obsidian-vessel plugin runs IN the
# single-container substrate (obsidian-desktop.service) and serves on
# 127.0.0.1:27182. The obsidian resolvers (behavior-scan, reflect, deliver-assist,
# verify-output, request-scan, feedback-scan) default to host.docker.internal:27183
# — a leftover from when Obsidian ran on the operator's HOST — which is DOWN here,
# so the operator-modeling + assist loop was silently starved (modeled:0). Point
# them at the live in-container plugin so the feedback loop can actually read events
# and write back.
OBSIDIAN_PLUGIN_ENDPOINT=http://127.0.0.1:27182
EOF

chmod 600 /etc/substrate/env
echo "[gen-env] wrote /etc/substrate/env"

# Per-model llm-resolver siblings (llm-resolver-opus / -haiku) pin a distinct
# model each. LLM_DEFAULT_MODEL lives in /etc/substrate/env (shared), which is
# applied AFTER a unit's Environment= lines and silently overrides them — so the
# per-vessel override MUST come from a LATER EnvironmentFile (a drop-in). These
# files back the drop-ins in units/llm-resolver-{opus,haiku}.service.d/. The
# vessel_id==model arm is what the goal-host LLM router learns over per task type.
printf 'LLM_DEFAULT_MODEL=%s\n' "${LLM_OPUS_MODEL:-claude-opus-4-8}"          > /etc/substrate/llm-opus.env
printf 'LLM_DEFAULT_MODEL=%s\n' "${LLM_HAIKU_MODEL:-claude-haiku-4-5-20251001}" > /etc/substrate/llm-haiku.env
printf 'LLM_DEFAULT_MODEL=%s\n' "${LLM_GOOGLE_MODEL:-gemini-2.5-flash}"          > /etc/substrate/llm-google.env
chmod 600 /etc/substrate/llm-opus.env /etc/substrate/llm-haiku.env /etc/substrate/llm-google.env
echo "[gen-env] wrote per-model llm-resolver env files (opus, haiku, google)"

# Pass through vessel-subset selection + fork owner so units (setup-git-push) and
# apply-inventory read them from the EnvironmentFile. Absent vars stay absent
# (apply-inventory defaults to "keep everything").
{
  echo "SUBSTRATE_REPO_OWNER=${SUBSTRATE_REPO_OWNER:-AviGopal}"
  [ -n "${ENABLED_ROLES:-}" ]       && echo "ENABLED_ROLES=${ENABLED_ROLES}"
  [ -n "${ENABLED_EXTRA_VESSELS:-}" ] && echo "ENABLED_EXTRA_VESSELS=${ENABLED_EXTRA_VESSELS}"
  [ -n "${ENABLED_VESSELS:-}" ]     && echo "ENABLED_VESSELS=${ENABLED_VESSELS}"
  [ -n "${DISABLED_VESSELS:-}" ]    && echo "DISABLED_VESSELS=${DISABLED_VESSELS}"
  [ -n "${SUBSTRATE_BIND_HOST:-}" ] && echo "SUBSTRATE_BIND_HOST=${SUBSTRATE_BIND_HOST}"
  # Public reachability, threaded through so discovery's GET /bootstrap can hand a
  # client the PUBLIC identity + discovery URLs (not loopback) to point at.
  PUB="${PUBLIC_IP:-${FED_PUBLIC_IP:-}}"
  if [ -n "$PUB" ]; then
    echo "PUBLIC_IP=${PUB}"
    echo "DISCOVERY_PUBLIC_URL=${DISCOVERY_PUBLIC_URL:-http://${PUB}:${DISCOVERY_PUBLIC_PORT:-18100}}"
    echo "IDENTITY_PUBLIC_URL=${IDENTITY_PUBLIC_URL:-http://${PUB}:${IDENTITY_PUBLIC_PORT:-18101}}"
  fi
} >> /etc/substrate/env

# Persist generated secrets to workspace so restarts reuse the same values.
# This file is bind-mounted from the host at /workspace.
#
# Written to a TEMP file and merged below — never straight over the real one.
# The bare overwrite this replaces took the hub down on 2026-08-08: the live file
# had been written by an older revision of the list, so it carried
# FEDERATION_SIGNING_SECRET and FEDERATION_PEER_AUTH_MODE (absent here) while
# LACKING API_KEY_SECRET (present here since). API_KEY_SECRET therefore existed
# only in the running container's process env, and the hub had been unable to
# boot from its own volumes for about a week — a latent failure that any
# recreate, redeploy, or host reboot would have hit. Nothing detected it, because
# nothing ever restarted the container (the same blind spot as the restart
# breakage found earlier the same day).
#
# The list on this heredoc is a MOVING TARGET across revisions, so "list every
# durable secret here" is a rule that cannot hold by inspection — it fails
# silently and only at the next boot. Merge instead: keys this run knows about
# win, and any key already persisted that this revision has never heard of is
# carried through untouched.
_SECRETS_TMP="$(mktemp)"
cat > "$_SECRETS_TMP" <<SECRETS
# Substrate internal secrets — auto-generated on first run, reused on restart.
# DO NOT commit this file. Add workspace/.substrate-secrets to .gitignore.
JWT_SECRET=${JWT_SECRET}
SURREAL_PASS=${SURREAL_PASS}
API_KEY_SECRET=${API_KEY_SECRET}
FED_SUBSTRATE_ID=${FED_SUBSTRATE_ID}
METABOB_API_KEY=${METABOB_API_KEY}
SUBSTRATE_ADMIN_KEY=${SUBSTRATE_ADMIN_KEY:-}
SUBSTRATE_GIT_PAT=${SUBSTRATE_GIT_PAT}
# (3) provider-secret spot — round-trip provider keys so a container recreate
# without -e keeps them. NB: this heredoc OVERWRITES the file, so every durable
# secret MUST be listed here or it is lost on the next gen-env run.
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_BASE_URL=${OPENAI_BASE_URL:-}
CHUTES_API_KEY=${CHUTES_API_KEY:-}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
GOOGLE_API_KEY=${GOOGLE_API_KEY:-}
GROQ_API_KEY=${GROQ_API_KEY:-}
MISTRAL_API_KEY=${MISTRAL_API_KEY:-}
RUNPOD_API_KEY=${RUNPOD_API_KEY:-}
RUNPOD_ENDPOINT_ID=${RUNPOD_ENDPOINT_ID:-}
RUNPOD_MODELS=${RUNPOD_MODELS:-}
RUNPOD_COST_PER_MTOK=${RUNPOD_COST_PER_MTOK:-}
VLLM_BASE_URL=${VLLM_BASE_URL:-}
VLLM_MODELS=${VLLM_MODELS:-}
VLLM_API_KEY=${VLLM_API_KEY:-}
VLLM_ENDPOINTS=${VLLM_ENDPOINTS:-}
# Operator-explicit discovery peer list (hub-side resolve fan-out). Only the
# explicit value round-trips; a hub-derived spoke default is re-derived each run.
PEER_DISCOVERY_ENDPOINTS=${PEER_DISCOVERY_ENDPOINTS_EXPLICIT:-}
SECRETS

# Merge: carry through any key the OLD file has that this revision never emits,
# so a secret written by a different revision of the list above survives. Keys
# this run does emit always win, including deliberate blanks. Comments and blank
# lines come from the freshly generated side only.
if [[ -f /workspace/.substrate-secrets ]]; then
  _known="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$_SECRETS_TMP" | tr -d '=' || true)"
  _carried=0
  while IFS= read -r _line; do
    case "$_line" in ''|'#'*) continue ;; esac
    _k="${_line%%=*}"
    [[ "$_k" == "$_line" ]] && continue                       # no '=' — not a field
    [[ ! "$_k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && continue     # not a shell-safe name
    if ! printf '%s\n' "$_known" | grep -qx "$_k"; then
      printf '%s\n' "$_line" >> "$_SECRETS_TMP"
      _carried=$((_carried + 1))
      echo "[gen-env] carried over unrecognised persisted secret: $_k" >&2
    fi
  done < /workspace/.substrate-secrets
  # Keep one generation of history: this is the only copy of anything the merge
  # mishandles, and it costs nothing.
  cp -p /workspace/.substrate-secrets /workspace/.substrate-secrets.prev 2>/dev/null || true
  chmod 600 /workspace/.substrate-secrets.prev 2>/dev/null || true
  [[ "$_carried" -gt 0 ]] && echo "[gen-env] merged $_carried secret(s) this revision does not emit" >&2
fi

# Install atomically, so an interrupted write cannot leave a truncated file that
# the next boot reads as "this secret was never persisted".
chmod 600 "$_SECRETS_TMP"
mv -f "$_SECRETS_TMP" /workspace/.substrate-secrets
chmod 600 /workspace/.substrate-secrets
echo "[gen-env] persisted secrets to /workspace/.substrate-secrets"

# ── Emit the provenance record ───────────────────────────────────────────────
# One line per variable: NAME=<source>. `substrate-config` renders this next to
# the resolved values so "did my -e win?" is answerable in one command.
#
# Anything named in the run environment is attributed `env` and OVERWRITES a
# `persisted` note: ${VAR:-…} only consults the fallback when the environment
# was empty, so an env-supplied value provably won.
{
  echo "# Provenance of /etc/substrate/env, written by gen-env.sh at boot."
  echo "# source: env=operator-supplied | persisted=/workspace/.substrate-secrets"
  echo "#         generated=minted this boot | derived=computed from another value"
  echo "# Absent from this file = a hardcoded literal in gen-env.sh."
  {
    sort -u "$PROV_TMP" 2>/dev/null || true
    for _n in $_ENV_SUPPLIED; do printf '%s=env\n' "$_n"; done
  } | awk -F= '
      { src[$1] = ($2 == "env" ? "env" : (src[$1] == "env" ? "env" : $2)) }
      END { for (k in src) print k "=" src[k] }
    ' | sort
  echo "SURREAL_PASS=${SURREAL_PASS_SOURCE:-unknown}"
} > "$PROVENANCE_FILE" 2>/dev/null || true
chmod 644 "$PROVENANCE_FILE" 2>/dev/null || true
rm -f "$PROV_TMP" 2>/dev/null || true
echo "[gen-env] wrote provenance to $PROVENANCE_FILE"
