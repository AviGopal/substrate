#!/usr/bin/env bash
# secrets.env.sh — THE single place to declare substrate secrets.
#
# One file, one rule: every secret is `VAR="${VAR:-<default-or-generated>}"` — read
# from the ENVIRONMENT first (compose/run -e, or an already-sourced .substrate-secrets),
# falling back to a generated/declared default. To add a new secret, add ONE line here.
#
# Consumed two ways:
#   1. `gen-env.sh` sources this, so every declared secret flows into /etc/substrate/env
#      (which every systemd unit reads via EnvironmentFile=/etc/substrate/env) and is
#      persisted to /workspace/.substrate-secrets (survives container restart).
#   2. `vessel-ctl.sh` sources this when installing a vessel, so a vessel's declared
#      `secrets` are guaranteed present + persisted at install time.
#
# This file is SAFE to commit — it declares NAMES + non-secret defaults, never real
# secret VALUES (those come from the environment / the persisted .substrate-secrets).
set -a  # export everything declared below

SECRETS_FILE="${SECRETS_FILE:-/workspace/.substrate-secrets}"
[[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE" || true

# ── LLM provider (operator-supplied; at least one required) ───────────────────
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_BASE_URL="${OPENAI_BASE_URL:-}"
LLM_DEFAULT_MODEL="${LLM_DEFAULT_MODEL:-}"

# ── Substrate-internal (auto-generated if absent; persisted + reused) ─────────
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
SURREAL_PASS="${SURREAL_PASS:-$(openssl rand -hex 16)}"
METABOB_API_KEY="${METABOB_API_KEY:-$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)}"

# ── Self-development git push (optional; empty disables container-side push) ───
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT:-}"

# ── Federation / libp2p (the secrets that were previously appended ad-hoc and
#    LOST on restart — now declared + persisted here) ──────────────────────────
# Shared HMAC secret used to sign cross-substrate resolve requests + foreign-provenance
# traces. Generated once per fleet; the SAME value must be set on every peer substrate.
FEDERATION_SIGNING_SECRET="${FEDERATION_SIGNING_SECRET:-$(openssl rand -hex 32)}"
FEDERATION_PEER_AUTH_MODE="${FEDERATION_PEER_AUTH_MODE:-hmac}"

set +a

# ── Persist back so a restart reuses the same generated values ────────────────
# Only the substrate-internal + federation secrets are persisted (operator-supplied
# LLM/git creds come from the run environment each boot; we don't want to bake them).
if [[ "${SECRETS_PERSIST:-1}" == "1" ]]; then
  umask 077
  mkdir -p "$(dirname "$SECRETS_FILE")" 2>/dev/null || true
  cat > "$SECRETS_FILE" <<PERSIST
# Substrate secrets — auto-generated on first run, reused on restart. DO NOT commit.
JWT_SECRET=${JWT_SECRET}
SURREAL_PASS=${SURREAL_PASS}
METABOB_API_KEY=${METABOB_API_KEY}
SUBSTRATE_GIT_PAT=${SUBSTRATE_GIT_PAT}
FEDERATION_SIGNING_SECRET=${FEDERATION_SIGNING_SECRET}
FEDERATION_PEER_AUTH_MODE=${FEDERATION_PEER_AUTH_MODE}
PERSIST
  chmod 600 "$SECRETS_FILE" 2>/dev/null || true
fi
