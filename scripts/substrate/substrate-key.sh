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
#   join <name> [scopes] [days]       mint a key for a joining node and print ONE join
#                                     token (this fleet's advertised discovery endpoint +
#                                     the key) and the command the joiner runs
#   jwt [role] [expires_seconds]      mint a Bearer JWT (dashboard / admin flows)
#   list                              list issued keys for the substrate org
#   revoke <key_id>                   revoke a key
#   bootstrap-admin                   recover admin when SUBSTRATE_ADMIN_KEY is empty
#
# Auth model: the operator's METABOB_API_KEY (from /etc/substrate/env) resolves
# to the substrate org and authenticates the mint request itself; /v1/jwt/generate
# binds the minted token's org_id and user_id to that key's own identity, so the
# key can only mint for itself. The resulting admin JWT is presented to the
# admin-only /v1/keys/* endpoints.
# apikey_cfg KEY: the curl config line that carries an ApiKey, for `curl -K <(apikey_cfg "$K")` or
# `apikey_cfg "$K" | curl -K -`. The key never reaches argv (printf is a builtin), so no process listing shows it.
apikey_cfg() { [ -n "${1:-}" ] && printf 'header = "Authorization: ApiKey %s"\n' "$1"; return 0; }

set -euo pipefail

set -a; source /etc/substrate/env 2>/dev/null || true; set +a
# The trust-root secrets this CLI needs (SUBSTRATE_ADMIN_KEY, API_KEY_SECRET) are not in
# the shared env, which every unit loads: they live in the operator/bootstrap file that
# secrets-manifest.json scopes them to. No vessel unit loads it.
set -a; source /etc/substrate/private/admin.env 2>/dev/null || true; set +a
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

SECRETS_FILE="${SECRETS_FILE:-/workspace/.substrate-private/substrate-secrets}"

# Round-trip an admin-scoped mint into SUBSTRATE_ADMIN_KEY.
#
# WHY THIS EXISTS. /v1/keys/issue returns the plaintext exactly ONCE and stores
# only a SHA-256 hash. Until this was added, nothing wrote an admin-scoped mint
# back to disk: SUBSTRATE_ADMIN_KEY — the credential the SEC-5 role gate reads —
# was populated by exactly one code path, seed-identity.ts's genuine-first-boot
# branch. So a key minted through THIS surface did not update THIS surface's own
# credential.
#
# What that cost, measured on syzygy.host 2026-08-26: an active `substrate-admin`
# key (read,write,admin) minted 2026-07-16 — fifteen days after that substrate's
# first boot, so not by the seeder — with SUBSTRATE_ADMIN_KEY empty in both files.
# The plaintext existed exactly once, in the HTTP response on someone's terminal,
# and was never persisted. When SEC-5 landed, `issue`, `list` and `revoke` all
# began failing with "requires admin entitlement" and there was no way back: the
# only credential that could mint a replacement was the one that had been lost.
#
# Quoting differs per file and is NOT cosmetic: /etc/substrate/env is `source`d
# (values double-quoted), while gen-env.sh's persisted_secret() reads
# .substrate-secrets with `cut -d= -f2-`, so a quoted value there would be
# recovered WITH its quotes and silently corrupt the key.
# The env-format targets are the files secrets-manifest.json scopes SUBSTRATE_ADMIN_KEY
# to (private/admin.env + each consumer unit's private/env.d file) — never the shared /etc/substrate/env.
admin_key_files() {
  local m
  for m in /usr/local/share/substrate/secrets-manifest.json "$(dirname "$0")/secrets-manifest.json"; do
    [[ -f "$m" ]] || continue
    jq -r '(.unit_file // "private/env.d/{unit}.env") as $t | .secrets.SUBSTRATE_ADMIN_KEY as $e
           | ([$e.units[]? as $u | "/etc/substrate/" + ($t | sub("\\{unit\\}"; $u))]
              + (if (($e.scripts // []) | length) > 0 then ["/etc/substrate/" + (.admin_file // "private/admin.env")] else [] end))[]' "$m" && return 0
  done
  echo /etc/substrate/private/admin.env
}
persist_admin_key() { # $1=key
  local k="$1" f line t
  for f in $(admin_key_files) "$SECRETS_FILE"; do
    [[ -f "$f" ]] || continue
    if [[ "$f" == "$SECRETS_FILE" ]]; then line="SUBSTRATE_ADMIN_KEY=$k"; else line="SUBSTRATE_ADMIN_KEY=\"$k\""; fi
    t="${f}.tmp.$$"
    # Rewrite through a temp file and mv: the units read these paths, and an
    # in-place sed -i would swap the inode underneath a concurrent reader.
    { grep -v '^SUBSTRATE_ADMIN_KEY=' "$f" || true; echo "$line"; } > "$t"
    chmod 600 "$t" 2>/dev/null || true
    mv -f "$t" "$f"
  done
  echo "[substrate-key] persisted SUBSTRATE_ADMIN_KEY to its scoped files ($(admin_key_files | tr '\n' ' ')) and $SECRETS_FILE" >&2
}

# True when a comma-separated scope list contains `admin`. Matched on exact list
# elements so a key named e.g. "admin-tools" with scopes read,write never counts.
has_admin_scope() { # $1=comma-separated scopes
  case ",$1," in *,admin,*) return 0 ;; *) return 1 ;; esac
}

mint_jwt() { # $1=role $2=expires_seconds
  local j role="${1:-admin}" key="$METABOB_API_KEY"
  # An admin/owner-role JWT requires an admin-scoped credential once
  # /v1/jwt/generate gates the requested role by caller entitlement (else any
  # read/write key could mint itself an admin token). SUBSTRATE_ADMIN_KEY carries
  # admin and shares this org/user with METABOB_API_KEY (read/write only), so the
  # tenant-binding check still passes. Fall back to METABOB_API_KEY when unset.
  case "$role" in admin|owner) key="${SUBSTRATE_ADMIN_KEY:-$METABOB_API_KEY}";; esac
  j=$(curl -s "$IDENTITY/v1/jwt/generate" -H "Content-Type: application/json" \
        -K <(apikey_cfg "$key") \
        -d "{\"user_id\":\"$USER_ID\",\"org_id\":\"$ORG_ID\",\"role\":\"$role\",\"expires_in_seconds\":${2:-900}}")
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
    # An admin-scoped mint is the substrate's own mint credential, not just
    # another peer key — persist it so this surface keeps working across the
    # next boot. See persist_admin_key() for the incident this prevents.
    if has_admin_scope "$scopes"; then persist_admin_key "$key"; fi
    echo "The full key is shown ONCE and never stored — save it now." >&2
    echo "$key"
    ;;

  join)
    # One input for a joiner. The endpoint is the one this fleet ADVERTISES (its own
    # /bootstrap: DISCOVERY_PUBLIC_URL, or PUBLIC_IP and the published port prefix), so
    # no port is typed by a human or written into any launcher. Token format, versioned
    # so a joiner can refuse one it does not understand:
    #   sj1.<base64url of "<discovery endpoint>\n<api key>">
    name="${1:-}"; [[ -n "$name" ]] || die "usage: substrate-key join <name> [scopes] [expires_days]"
    disc="$(curl -s -m 10 "${DISCOVERY_LOCAL_URL:-http://127.0.0.1:8100}/bootstrap" | jq -r '.discovery_endpoint // empty')"
    [[ -n "$disc" ]] || die "this fleet advertises no public discovery endpoint (/bootstrap discovery_endpoint is empty): a hub needs PUBLIC_IP (install with --profile hub --public-ip <address>)"
    case "$disc" in *://127.*|*://localhost*) die "this fleet advertises a loopback discovery endpoint ($disc); a joiner elsewhere cannot use it — set PUBLIC_IP" ;; esac
    key="$("$0" issue "$name" "${2:-read,write}" ${3:+"$3"})" || die "key issuance failed"
    token="sj1.$(printf '%s\n%s' "$disc" "$key" | base64 -w0 | tr '+/' '-_' | tr -d '=')"
    echo "Join token for '$name' (endpoint $disc). It carries the key: give it only to that node's operator." >&2
    echo "The joiner runs:" >&2
    echo "  docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | SUBSTRATE_JOIN='$token' sh" >&2
    echo "$token"
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

  bootstrap-admin)
    # Recover key management on a substrate that holds no admin plaintext.
    #
    # Reachable only from inside the container: identity-vessel refuses this
    # endpoint unless the request arrives on loopback AND presents API_KEY_SECRET,
    # which lives in root-only /etc/substrate/private/admin.env (secrets-manifest.json). Anyone who can satisfy both
    # already owns the box — this routes that existing authority through an
    # audited, logged path instead of a hand-forged admin JWT.
    #
    # Additive: it mints a NEW admin key and never revokes an existing one. An
    # orphaned admin row whose plaintext was lost cannot be distinguished from
    # one an operator still holds, so revoking is the operator's call, not this
    # script's.
    [[ -n "${API_KEY_SECRET:-}" ]] || die "API_KEY_SECRET not set — cannot prove in-container root"
    if [[ -n "${SUBSTRATE_ADMIN_KEY:-}" ]]; then
      echo "[substrate-key] SUBSTRATE_ADMIN_KEY is already set; nothing to bootstrap." >&2
      echo "[substrate-key] To mint an ADDITIONAL admin key, use: substrate-key issue <name> read,write,admin" >&2
      exit 0
    fi
    resp=$(curl -s "$IDENTITY/v1/keys/bootstrap-admin" -H "Content-Type: application/json" \
             -K <(apikey_cfg "$METABOB_API_KEY") \
             -d "{\"bootstrap_secret\":\"$API_KEY_SECRET\",\"name\":\"substrate-admin-bootstrap\"}")
    key=$(echo "$resp" | jq -r '.data.key // empty')
    [[ -n "$key" ]] || die "bootstrap failed: $resp"
    persist_admin_key "$key"
    echo "$resp" | jq -r '"key_id     : " + .data.key_id' >&2
    echo "[substrate-key] admin recovered. Restart consumers that cache it if needed." >&2
    echo "$key"
    ;;

  *)
    sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
