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

if [[ -z "${ANTHROPIC_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "[gen-env] ERROR: No LLM provider key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." >&2
  exit 1
fi

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
SECRETS_FILE="/workspace/.substrate-secrets"
persisted_secret() {
  [[ -f "$SECRETS_FILE" ]] && grep -m1 "^$1=" "$SECRETS_FILE" | cut -d= -f2- || true
}

JWT_SECRET="${JWT_SECRET:-$(persisted_secret JWT_SECRET)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

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
    # already-issued key. Keep the legacy default so those keys still validate,
    # but warn loudly: this substrate is insecure until the secret is rotated.
    API_KEY_SECRET="dev-secret-change-in-production"
    echo "[gen-env] WARNING: no persisted API_KEY_SECRET on an existing datastore — using the INSECURE legacy default." >&2
    echo "[gen-env] WARNING: keys are forgeable until you set a strong API_KEY_SECRET and re-issue them." >&2
  else
    API_KEY_SECRET="$(openssl rand -hex 32)"
  fi
fi

# Bootstrap key: used only for the initial identity-vessel signup call.
# After seed-identity.ts runs, vessels use the HMAC keys it issues.
# Stored in /workspace/.substrate-secrets so restarts reuse the same value.
METABOB_API_KEY="${METABOB_API_KEY:-$(persisted_secret METABOB_API_KEY)}"
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
SUBSTRATE_GIT_AUTHOR_EMAIL="${SUBSTRATE_GIT_AUTHOR_EMAIL:-substrate-autonomous@metabob.com}"

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

# Endpoint aliases — resolve BEFORE the heredoc so every inner reference is a
# bound variable. Previously the alias defaults nested unguarded expansions
# (e.g. \${DISCOVERY_VESSEL_ENDPOINT:-\${DISCOVERY_ENDPOINT}}) INSIDE the
# heredoc: under `set -u` a bare `docker run` without the Makefile's dozen
# empty -e passthroughs died with "DISCOVERY_ENDPOINT: unbound variable" —
# a hidden host/Makefile coupling in what must be a pure docker-run contract
# (surfaced 2026-07-02 by the first from-scratch container test).
DISCOVERY_ENDPOINT="${DISCOVERY_ENDPOINT:-http://127.0.0.1:8100}"
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
PEER_DISCOVERY_ENDPOINTS="${PEER_DISCOVERY_ENDPOINTS:-${HUB_DISCOVERY_URL}}"
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
LLM_DEFAULT_MODEL="${LLM_DEFAULT_MODEL:-}"
# Substrate root inside the container = the container-native super-repo clone
# (/workspace/git/super-repo, passed in via -e SUBSTRATE_ROOT). The container
# is unmoored from the host filesystem: no host repo bind. Every tick unit
# references its script as \${SUBSTRATE_ROOT}/scripts/substrate/... and the
# substrate keeps the clone current by pulling origin/dev itself. Empty here
# means SUBSTRATE_ROOT was not passed — units will fail loudly rather than
# read a stale hardcoded path.
SUBSTRATE_ROOT="${SUBSTRATE_ROOT:-}"
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
# the cutover falls back to host-sync-intent mode (which no-ops here, since the
# host repo bind mount is read-only) — i.e. authored fixes never land.
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
TRACE_STORE_CAP=40000
TRACE_STORE_HOT_WINDOW_DAYS=3
TRACE_STORE_RESERVOIR_PER_ACTIVITY=25

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
  [ -n "${ENABLED_VESSELS:-}" ]     && echo "ENABLED_VESSELS=${ENABLED_VESSELS}"
  [ -n "${DISABLED_VESSELS:-}" ]    && echo "DISABLED_VESSELS=${DISABLED_VESSELS}"
  [ -n "${SUBSTRATE_BIND_HOST:-}" ] && echo "SUBSTRATE_BIND_HOST=${SUBSTRATE_BIND_HOST}"
} >> /etc/substrate/env

# Persist generated secrets to workspace so restarts reuse the same values.
# This file is bind-mounted from the host at /workspace.
cat > /workspace/.substrate-secrets <<SECRETS
# Substrate internal secrets — auto-generated on first run, reused on restart.
# DO NOT commit this file. Add workspace/.substrate-secrets to .gitignore.
JWT_SECRET=${JWT_SECRET}
SURREAL_PASS=${SURREAL_PASS}
API_KEY_SECRET=${API_KEY_SECRET}
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
SECRETS
chmod 600 /workspace/.substrate-secrets
echo "[gen-env] persisted secrets to /workspace/.substrate-secrets"
