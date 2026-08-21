#!/bin/bash
# substrate-key — operator surface for API keys and JWTs.
#
# Runs INSIDE the substrate container, against the loopback address of the
# local identity-vessel. Deployments that front a remote admin client publish
# identity on a host port too; this script does not depend on that either way.
# From the host, run it through the container:
#   docker exec <container> substrate-key show
#   docker exec <container> substrate-key issue <name> [scopes] [expires_days]
#   docker exec <container> substrate-key jwt [role] [expires_seconds]
#   docker exec <container> substrate-key list
#   docker exec <container> substrate-key revoke <key-id>
#
# Subcommands:
#   show                              print the substrate operator API key
#   whoami                            print the operator identity (org, user, scopes)
#   issue <name> [scopes] [days]      mint a new API key (external peer / spoke / vessel)
#   jwt [role] [expires_seconds]      mint a Bearer JWT (dashboard / admin flows)
#   list                              list issued keys for the substrate org
#   revoke <key_id>                   revoke a key
#
# Auth model: the operator's METABOB_API_KEY (from /etc/substrate/env) resolves
# to the substrate org and authenticates the mint request itself; /v1/jwt/generate
# binds the minted token's org_id and user_id to that key's own identity, so the
# key can only mint for itself. The resulting admin JWT is presented to the
# admin-only /v1/keys/* endpoints.
set -euo pipefail

set -a; source /etc/substrate/env 2>/dev/null || true; set +a
IDENTITY="${IDENTITY_VESSEL_URL:-http://127.0.0.1:8101}"

die() { echo "[substrate-key] ERROR: $*" >&2; exit 1; }

[[ -n "${METABOB_API_KEY:-}" ]] || die "METABOB_API_KEY not set (is /etc/substrate/env present?)"
curl -sf "$IDENTITY/health" >/dev/null || die "identity-vessel not reachable at $IDENTITY"

resolve_identity() {
  local v
  v=$(curl -s "$IDENTITY/v1/keys/validate" -H "Content-Type: application/json" \
        -d "{\"api_key\":\"$METABOB_API_KEY\"}")
  ORG_ID=$(echo "$v" | jq -r '.data.org_id // empty')
  USER_ID=$(echo "$v" | jq -r '.data.user_id // empty')
  [[ -n "$ORG_ID" && -n "$USER_ID" ]] || die "operator key did not validate: $v"
}

mint_jwt() { # $1=role $2=expires_seconds
  local j
  j=$(curl -s "$IDENTITY/v1/jwt/generate" -H "Content-Type: application/json" \
        -H "Authorization: ApiKey $METABOB_API_KEY" \
        -d "{\"user_id\":\"$USER_ID\",\"org_id\":\"$ORG_ID\",\"role\":\"${1:-admin}\",\"expires_in_seconds\":${2:-900}}")
  JWT=$(echo "$j" | jq -r '.data.token // empty')
  [[ -n "$JWT" ]] || die "JWT generation failed: $j"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  show)
    echo "$METABOB_API_KEY"
    ;;

  whoami)
    curl -s "$IDENTITY/v1/keys/validate" -H "Content-Type: application/json" \
      -d "{\"api_key\":\"$METABOB_API_KEY\"}" | jq '.data'
    ;;

  issue)
    name="${1:-}"; [[ -n "$name" ]] || die "usage: substrate-key issue <name> [scopes] [expires_days]"
    scopes="${2:-read,write}"
    days="${3:-}"
    scopes_json=$(echo "$scopes" | jq -Rc 'split(",")')
    resolve_identity
    mint_jwt admin 300
    body="{\"user_id\":\"$USER_ID\",\"org_id\":\"$ORG_ID\",\"scopes\":$scopes_json,\"name\":\"$name\""
    if [[ -n "$days" ]]; then body+=",\"expires_in_days\":$days"; fi
    body+="}"
    resp=$(curl -s "$IDENTITY/v1/keys/issue" -H "Content-Type: application/json" \
             -H "Authorization: Bearer $JWT" -d "$body")
    key=$(echo "$resp" | jq -r '.data.key // empty')
    [[ -n "$key" ]] || die "key issuance failed: $resp"
    echo "$resp" | jq -r '"key_id     : " + .data.key_id, "expires_at : " + (.data.expires_at // "never")' >&2
    echo "The full key is shown ONCE and never stored — save it now." >&2
    echo "$key"
    ;;

  jwt)
    role="${1:-admin}"
    secs="${2:-900}"
    resolve_identity
    mint_jwt "$role" "$secs"
    echo "$JWT"
    ;;

  list)
    resolve_identity
    mint_jwt admin 300
    curl -s "$IDENTITY/v1/keys" -H "Authorization: Bearer $JWT" \
      | jq -r '.data.keys[] | [.key_id, .status, (.scopes|join("+")), (.name // "-"), (.expires_at // "never")] | @tsv' \
      | awk -F'\t' '{printf "%-26s %-10s %-16s %-20s %s\n",$1,$2,$3,$4,$5}' || die "key list failed"
    ;;

  revoke)
    key_id="${1:-}"; [[ -n "$key_id" ]] || die "usage: substrate-key revoke <key_id>"
    resolve_identity
    mint_jwt admin 300
    curl -s "$IDENTITY/v1/keys/revoke" -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT" -d "{\"key_id\":\"$key_id\"}" | jq -c '.'
    ;;

  *)
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
