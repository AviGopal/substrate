#!/usr/bin/env bash
# render-secret-scope.sh — render the trust-root secrets into the files only their
# consumers load, as declared by secrets-manifest.json.
#
# WHY. /etc/substrate/env is loaded by every unit, so a secret written there sits in
# every vessel's process env — including development-vessel, where autonomously
# landed code runs. The manifest names each secret's consumers; this script writes
#   <env-dir>/env.d/<unit>.env   for every unit consumer (the unit loads it, no '-')
#   <env-dir>/admin.env          for script consumers (bootstrap tier, operator CLI)
# and nothing else. Every file the manifest implies is ALWAYS written, empty values
# included, so a consumer unit never fails on a missing file and a later writer
# (seed-identity, substrate-key) always has a file to upsert into.
#
# Modes:
#   --mode values   (gen-env, boot) each value is taken from this process's
#                   environment exactly as gen-env resolved it, empty included.
#   --mode recover  (pull-sync, live node) no resolver ran; each value is recovered
#                   from, in order: the scoped files already rendered, the shared env
#                   (a node booted before this split still holds them there), the
#                   persisted store. Never invents or mints a value.
#   --strip-shared  (recover only) afterwards remove a name from the shared env, but
#                   only once every consumer unit installed on this node is verified
#                   to load its scoped file — otherwise the consumer would lose it.
#
# Prints names and file paths only, never a value. Writes are temp + rename, 0600.
set -euo pipefail

_here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST=""
ENV_DIR="/etc/substrate"
STORE="/workspace/.substrate-secrets"
PEER_FILE="${PEER_CREDENTIALS_FILE:-/workspace/.peer-credentials}"
MODE="values"
STRIP=0
UNIT_DIRS="/etc/systemd/system /run/systemd/system /usr/lib/systemd/system /lib/systemd/system"
while [ $# -gt 0 ]; do
  case "$1" in
    --manifest)  MANIFEST="$2"; shift 2 ;;
    --env-dir)   ENV_DIR="$2"; shift 2 ;;
    --store)     STORE="$2"; shift 2 ;;
    --peer-file) PEER_FILE="$2"; shift 2 ;;
    --mode)      MODE="$2"; shift 2 ;;
    --strip-shared) STRIP=1; shift ;;
    --unit-dirs) UNIT_DIRS="$2"; shift 2 ;;
    *) echo "[secret-scope] unknown argument: $1" >&2; exit 2 ;;
  esac
done
if [ -z "$MANIFEST" ]; then
  for _m in "$_here/secrets-manifest.json" /usr/local/share/substrate/secrets-manifest.json; do
    [ -f "$_m" ] && { MANIFEST="$_m"; break; }
  done
fi
[ -f "$MANIFEST" ] || { echo "[secret-scope] ERROR: no secrets manifest (looked beside this script and in /usr/local/share/substrate)" >&2; exit 1; }
case "$MODE" in values|recover) ;; *) echo "[secret-scope] ERROR: --mode must be values or recover" >&2; exit 2 ;; esac
[ "$STRIP" = 1 ] && [ "$MODE" != recover ] && { echo "[secret-scope] ERROR: --strip-shared is a recover-mode step" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "[secret-scope] ERROR: jq is required" >&2; exit 1; }
jq -e '.secrets | type == "object"' "$MANIFEST" >/dev/null || { echo "[secret-scope] ERROR: $MANIFEST has no .secrets object" >&2; exit 1; }

SHARED="$ENV_DIR/env"
UNIT_TMPL="$(jq -r '.unit_file // "env.d/{unit}.env"' "$MANIFEST")"
ADMIN_FILE="$ENV_DIR/$(jq -r '.admin_file // "admin.env"' "$MANIFEST")"
unit_file() { printf '%s/%s' "$ENV_DIR" "${UNIT_TMPL//\{unit\}/$1}"; }

_esc() { printf '%s' "${1-}" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

# Read NAME from an env-format file by sourcing it in a clean shell (the files are
# ours and root-only; sourcing is how every consumer reads them).
_from_envfile() { # <file> <NAME>
  [ -f "$1" ] || return 0
  env -i sh -c 'set -a; . "$1" >/dev/null 2>&1; eval "printf %s \"\${$2:-}\""' _ "$1" "$2" 2>/dev/null || true
}
# Read NAME from the persisted store the way gen-env's persisted_secret does:
# verbatim after '=', one surrounding pair of double quotes stripped.
_from_store() { # <file> <NAME>
  local v=""
  [ -f "$1" ] && v="$(grep -m1 "^$2=" "$1" | cut -d= -f2- || true)"
  if [ ${#v} -ge 2 ] && [ "${v:0:1}" = '"' ] && [ "${v: -1}" = '"' ]; then v="${v:1:${#v}-2}"; fi
  printf '%s' "$v"
}

# ── which names go to which files ────────────────────────────────────────────
declare -A FILE_NAMES=()   # file -> space-separated names
declare -A NAME_UNITS=()   # name -> space-separated consumer units
declare -A NAME_FILES=()   # name -> space-separated files
add() { # <file> <name> <unit-or-empty>
  case " ${FILE_NAMES[$1]:-} " in *" $2 "*) ;; *) FILE_NAMES[$1]="${FILE_NAMES[$1]:-} $2" ;; esac
  case " ${NAME_FILES[$2]:-} " in *" $1 "*) ;; *) NAME_FILES[$2]="${NAME_FILES[$2]:-} $1" ;; esac
  [ -n "$3" ] && NAME_UNITS[$2]="${NAME_UNITS[$2]:-} $3"
  return 0
}
# Every consumer file exists even if nothing lands in it.
for _u in $(jq -r '[.secrets[].units[]?, .patterns[]?.units[]?] | unique | .[]' "$MANIFEST"); do FILE_NAMES[$(unit_file "$_u")]="${FILE_NAMES[$(unit_file "$_u")]:-}"; done
FILE_NAMES[$ADMIN_FILE]="${FILE_NAMES[$ADMIN_FILE]:-}"

FIXED_NAMES="$(jq -r '.secrets | keys[]' "$MANIFEST")"
for _n in $FIXED_NAMES; do
  for _u in $(jq -r --arg n "$_n" '.secrets[$n].units[]?' "$MANIFEST"); do add "$(unit_file "$_u")" "$_n" "$_u"; done
  [ "$(jq -r --arg n "$_n" '(.secrets[$n].scripts // []) | length' "$MANIFEST")" -gt 0 ] && add "$ADMIN_FILE" "$_n" ""
done

# Value lookup, per mode.
lookup() { # <NAME>
  local n="$1" v="" f
  if [ "$MODE" = values ]; then printf '%s' "${!n-}"; return 0; fi
  for f in ${NAME_FILES[$n]:-}; do v="$(_from_envfile "$f" "$n")"; [ -n "$v" ] && { printf '%s' "$v"; return 0; }; done
  v="$(_from_envfile "$SHARED" "$n")"; [ -n "$v" ] && { printf '%s' "$v"; return 0; }
  _from_store "$STORE" "$n"
}

# Pattern names (peer keys): drawn from the map named by names_from. An empty value
# is skipped rather than written: the consumer treats an absent key as "use the
# default credential", and gen-env has already warned about it.
PATTERN_NAMES=""
_np="$(jq '.patterns // [] | length' "$MANIFEST")"
for ((_i = 0; _i < _np; _i++)); do
  _src="$(jq -r ".patterns[$_i].names_from" "$MANIFEST")"
  _re="$(jq -r ".patterns[$_i].match" "$MANIFEST")"
  _ex=" $(jq -r ".patterns[$_i].exclude // [] | join(\" \")" "$MANIFEST") "
  _map="$(lookup "$_src")"
  [ -n "$_map" ] || _map="$(_from_store "$PEER_FILE" "$_src")"
  for _pair in ${_map//,/ }; do
    _pn="${_pair#*=}"
    [[ "$_pn" =~ $_re ]] || continue
    case "$_ex" in *" $_pn "*) continue ;; esac
    _pv=""
    if [ "$MODE" = recover ]; then   # its own scoped files first, as for fixed names
      for _u in $(jq -r ".patterns[$_i].units[]?" "$MANIFEST"); do
        [ -n "$_pv" ] || _pv="$(_from_envfile "$(unit_file "$_u")" "$_pn")"
      done
    fi
    [ -n "$_pv" ] || _pv="$(lookup "$_pn")"
    [ "$MODE" = recover ] && [ -z "$_pv" ] && _pv="$(_from_store "$PEER_FILE" "$_pn")"
    [ -n "$_pv" ] || continue
    printf -v "PV_$_pn" '%s' "$_pv"
    PATTERN_NAMES="$PATTERN_NAMES $_pn"
    for _u in $(jq -r ".patterns[$_i].units[]?" "$MANIFEST"); do add "$(unit_file "$_u")" "$_pn" "$_u"; done
    [ "$(jq -r ".patterns[$_i].scripts // [] | length" "$MANIFEST")" -gt 0 ] && add "$ADMIN_FILE" "$_pn" ""
  done
done

# ── render ───────────────────────────────────────────────────────────────────
declare -A VAL=()
for _n in $FIXED_NAMES; do VAL[$_n]="$(lookup "$_n")"; done
for _n in $PATTERN_NAMES; do _pvn="PV_$_n"; VAL[$_n]="${!_pvn}"; done

umask 077
for _f in "${!FILE_NAMES[@]}"; do
  mkdir -p "$(dirname "$_f")"
  _t="$(mktemp "$_f.tmp.XXXXXX")"
  {
    echo "# Generated by render-secret-scope.sh from secrets-manifest.json — do not edit."
    echo "# Scoped secrets: loaded only by the consumers the manifest names."
    for _n in $(printf '%s\n' ${FILE_NAMES[$_f]} | sort -u); do
      printf '%s="%s"\n' "$_n" "$(_esc "${VAL[$_n]-}")"
    done
  } > "$_t"
  chmod 600 "$_t"
  if ! env -i sh -c 'set -a; . "$1"' _ "$_t" >/dev/null 2>&1; then
    rm -f "$_t"; echo "[secret-scope] ERROR: rendered $_f does not parse; left the old file in place" >&2; exit 1
  fi
  mv -f "$_t" "$_f"
  _set=""; for _n in ${FILE_NAMES[$_f]}; do [ -n "${VAL[$_n]-}" ] && _set="$_set $_n"; done
  echo "[secret-scope] wrote $_f (set:${_set:- none})"
done
# env.d holds nothing but scoped secrets: root-only. ($ENV_DIR itself is left as it is.)
[ -d "$ENV_DIR/env.d" ] && chmod 700 "$ENV_DIR/env.d" 2>/dev/null || true

# ── recover-mode: take the scoped names out of the shared env ─────────────────
if [ "$STRIP" = 1 ] && [ -f "$SHARED" ]; then
  _eff_unit() { # first unit file systemd would load for <unit>.service
    local d; for d in $UNIT_DIRS; do [ -f "$d/$1.service" ] && { printf '%s' "$d/$1.service"; return 0; }; done; return 1
  }
  _strip=""
  for _n in $FIXED_NAMES $PATTERN_NAMES; do
    _ok=1
    for _u in ${NAME_UNITS[$_n]:-}; do
      _uf="$(_eff_unit "$_u")" || continue      # not installed on this node: nothing to break
      # Units name the in-container path, whatever --env-dir this run renders into.
      _want="/etc/substrate/${UNIT_TMPL//\{unit\}/$_u}"
      grep -qx "EnvironmentFile=$_want" "$_uf" || { _ok=0; echo "[secret-scope] kept $_n in the shared env: $_uf does not load $_want yet" >&2; }
    done
    [ "$_ok" = 1 ] && grep -q "^$_n=" "$SHARED" && _strip="$_strip $_n"
  done
  if [ -n "$_strip" ]; then
    _t="$(mktemp "$SHARED.tmp.XXXXXX")"
    _re="^($(printf '%s\n' $_strip | paste -sd'|'))="
    grep -vE "$_re" "$SHARED" > "$_t" || true
    chmod 600 "$_t"; mv -f "$_t" "$SHARED"
    echo "[secret-scope] removed from the shared env:$_strip (running units keep their env until restarted)"
  fi
fi
