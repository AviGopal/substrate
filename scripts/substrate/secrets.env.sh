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
# MERGE, NEVER TRUNCATE. This file has TWO writers — gen-env.sh persists a much
# larger set (API_KEY_SECRET, FED_SUBSTRATE_ID, SUBSTRATE_ADMIN_KEY, every
# provider key, PEER_DISCOVERY_ENDPOINTS), and this script persists six. Both
# used `cat >`, so whichever ran last silently destroyed the other's keys.
#
# What that cost: API_KEY_SECRET vanished from the persisted file. gen-env
# refuses to boot when it finds an EXISTING DATASTORE and no persisted
# API_KEY_SECRET — correctly, since the datastore's keys were signed with a
# secret it can no longer produce. So the container came up fine for as long as
# it kept running and could NOT BE RESTARTED. Observed 2026-08-08 on a spoke
# that had been healthy for hours: `docker start` -> "refusing to boot
# insecure", exit 1. A substrate without a local datastore never trips the check
# and stays unaffected, which is why this hid.
#
# gen-env's own heredoc carries the warning "every durable secret MUST be listed
# here or it is lost". The durable fix is not a longer list in two places — it is
# to stop truncating. Preserve every key we do not manage.
if [[ "${SECRETS_PERSIST:-1}" == "1" ]]; then
  umask 077
  mkdir -p "$(dirname "$SECRETS_FILE")" 2>/dev/null || true
  _tmp="${SECRETS_FILE}.tmp.$$"
  {
    echo "# Substrate secrets — auto-generated on first run, reused on restart. DO NOT commit."
    # Keys this script owns, always current.
    echo "JWT_SECRET=${JWT_SECRET}"
    echo "SURREAL_PASS=${SURREAL_PASS}"
    echo "METABOB_API_KEY=${METABOB_API_KEY}"
    echo "SUBSTRATE_GIT_PAT=${SUBSTRATE_GIT_PAT}"
    echo "FEDERATION_SIGNING_SECRET=${FEDERATION_SIGNING_SECRET}"
    echo "FEDERATION_PEER_AUTH_MODE=${FEDERATION_PEER_AUTH_MODE}"
    # Every OTHER key already persisted, carried through untouched. Comments are
    # dropped deliberately: the header above replaces them, and a stale comment
    # about a key another writer has since changed is worse than none.
    if [[ -f "$SECRETS_FILE" ]]; then
      grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$SECRETS_FILE" 2>/dev/null | grep -vE \
        '^(JWT_SECRET|SURREAL_PASS|METABOB_API_KEY|SUBSTRATE_GIT_PAT|FEDERATION_SIGNING_SECRET|FEDERATION_PEER_AUTH_MODE)=' \
        || true
    fi
  } > "$_tmp"
  chmod 600 "$_tmp" 2>/dev/null || true
  mv -f "$_tmp" "$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE" 2>/dev/null || true
fi
