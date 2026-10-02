#!/usr/bin/env bash
# render-llm-arms.sh — materialize the LLM-resolver arm fleet from a declarative
# list (scripts/substrate/llm-arms.json, or the LLM_ARMS env override), instead
# of hand-authored per-provider .service files.
#
# Operator ask #7 (ratified 2026-07-19): "one provider per unit, but nothing
# hardcoded — in the hub setup we should be able to configure that multiple
# start, and adding new vessels should be simple regardless of where they are so
# long as they are in the same discovery."
#
# For each arm {id, model, provider, port} this renders:
#   * $ENV_DIR/llm-<id>.env       — the single-provider pin (LLM_DEFAULT_MODEL +
#                                    LLM_PINNED_PROVIDER), so the arm's quota ==
#                                    its provider's quota and it de-advertises
#                                    cleanly when that provider cools.
#   * $UNIT_DIR/llm-<id>.service  — one systemd unit, PORT/VESSEL_ID pinned,
#                                    guarded by ExecCondition on the provider key
#                                    (keyless host => clean skip, law 11).
#
# It does NOT enable/start units or reference host paths — the caller (entrypoint
# / apply step) enables the rendered set. Override output dirs for testing:
#   UNIT_DIR=/tmp/u ENV_DIR=/tmp/e ARMS_FILE=./scripts/substrate/llm-arms.json \
#     bash scripts/substrate/render-llm-arms.sh
set -euo pipefail

ARMS_FILE="${ARMS_FILE:-/usr/local/share/substrate/llm-arms.json}"
[ -f "$ARMS_FILE" ] || ARMS_FILE="$(dirname "$0")/llm-arms.json"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
ENV_DIR="${ENV_DIR:-/etc/substrate}"
VESSEL_RUNTIME="${VESSEL_RUNTIME:-/vessels/llm-resolver-vessel}"
BUN="${BUN_BIN:-/root/.bun/bin/bun}"

command -v jq >/dev/null 2>&1 || { echo "render-llm-arms: jq missing" >&2; exit 1; }

# The arm list: LLM_ARMS env (a JSON array) wins over the file, so a hub/deploy
# can reconfigure the fleet without editing a tracked file.
if [ -n "${LLM_ARMS:-}" ]; then
  arms_json="$(printf '%s' "$LLM_ARMS" | jq -c '.')" \
    || { echo "render-llm-arms: LLM_ARMS is not valid JSON" >&2; exit 1; }
else
  arms_json="$(jq -c '.arms' "$ARMS_FILE")"
fi
key_map="$(jq -c '.provider_key_env // {}' "$ARMS_FILE")"

mkdir -p "$UNIT_DIR" "$ENV_DIR"

count="$(printf '%s' "$arms_json" | jq 'length')"
i=0
while [ "$i" -lt "$count" ]; do
  arm="$(printf '%s' "$arms_json" | jq -c ".[$i]")"
  id="$(printf '%s' "$arm" | jq -r '.id')"
  model="$(printf '%s' "$arm" | jq -r '.model')"
  provider="$(printf '%s' "$arm" | jq -r '.provider')"
  port="$(printf '%s' "$arm" | jq -r '.port')"
  key_var="$(printf '%s' "$key_map" | jq -r --arg p "$provider" '.[$p] // empty')"
  i=$((i + 1))

  if [ -z "$id" ] || [ -z "$model" ] || [ -z "$provider" ] || [ -z "$port" ]; then
    echo "render-llm-arms: skipping malformed arm: $arm" >&2; continue
  fi
  if [ -z "$key_var" ]; then
    echo "render-llm-arms: unknown provider '$provider' (no key var in provider_key_env) — skipping arm '$id'" >&2
    continue
  fi

  # Single-provider pin. LLM_PINNED_PROVIDER is the shape the resolver reads to
  # gate quota/advertisement to exactly this provider (llm-resolver T8), so the
  # arm de-advertises when THIS provider cools rather than silently serving via
  # a sibling provider. Keys stay in /etc/substrate/env; the pin selects one.
  {
    printf '# rendered by render-llm-arms.sh — arm %s (%s / %s)\n' "$id" "$model" "$provider"
    printf 'LLM_DEFAULT_MODEL=%s\n' "$model"
    printf 'LLM_PINNED_PROVIDER=%s\n' "$provider"
  } > "$ENV_DIR/llm-$id.env"
  chmod 600 "$ENV_DIR/llm-$id.env" 2>/dev/null || true

  cat > "$UNIT_DIR/llm-$id.service" <<UNIT
[Unit]
Description=llm-resolver-$id ($model via $provider — rendered from llm-arms.json)
After=activity-api.service discovery-vessel.service identity-vessel.service
Wants=activity-api.service

[Service]
Type=simple
# Location independence (law 11): materialize this arm ONLY where its provider
# credential lives. ExecCondition (not ExecStartPre) makes an absent key a clean
# SKIP, not a failure, so the same image runs everywhere and the arm appears
# wherever $key_var is present — no per-role config, no dead arm in the pool.
ExecCondition=/bin/sh -c 'grep -Eq "^$key_var=[^=]*[A-Za-z0-9]" /etc/substrate/env'
EnvironmentFile=/etc/substrate/env
# The per-arm pin loads AFTER /etc/substrate/env (which sets a shared
# LLM_DEFAULT_MODEL), so this arm's model/provider win. Leading dash = optional.
EnvironmentFile=-$ENV_DIR/llm-$id.env
Environment=PORT=$port
Environment=HOST=127.0.0.1
Environment=LLM_RESOLVER_VESSEL_ID=llm-resolver-$id
WorkingDirectory=$VESSEL_RUNTIME
ExecStart=$BUN $VESSEL_RUNTIME/src/index.ts
# Stateless LLM proxy: a hung upstream call must not hold the stop job for the
# 90s default; 15s is generous for a clean discovery deregister.
TimeoutStopSec=15
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

  echo "render-llm-arms: rendered arm '$id' -> $UNIT_DIR/llm-$id.service (port $port, gated on $key_var)"
done

echo "render-llm-arms: $count arm(s) processed"
