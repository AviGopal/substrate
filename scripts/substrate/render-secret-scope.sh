#!/usr/bin/env bash
# render-secret-scope.sh — render the trust-root secrets into the files only their
# consumers load, as declared by secrets-manifest.json.
#
# WHY. /etc/substrate/env is loaded by every unit, so a secret written there sits in
# every vessel's process env — including development-vessel, where autonomously
# landed code runs. The manifest names each secret's consumers; this script writes
#   <env-dir>/env.d/<unit>.env   for every unit consumer (the unit loads it, no '-')
#   <env-dir>/admin.env          for script consumers (bootstrap tier, operator CLI)
# and nothing else.
#
# ONE STABLE DIRECTORY. Every file above lives under <env-dir>/<private_dir>
# (manifest; "private"), root 0700. Units run as root, so modes stop nothing; what
# keeps a unit away from these files is InaccessiblePaths= on THAT DIRECTORY
# (units/service.d/05-secret-dir-out-of-reach.conf, every unit but the declared
# writers). A mask on a FILE binds the inode the path named when the unit started,
# and this script replaces files by rename, so a file-level mask goes stale at the
# first render and the unit reads the live file (measured 10-02: inode inside the
# vessel == inode outside). A directory overmount does not care what happens inside
# it. So this script creates the directory once (mkdir, never -p over a symlink),
# only ever chmods it in place, and never removes, renames or recreates it; a
# directory that is not a real directory is refused.
#
# MIGRATION from the flat layout (<env-dir>/admin.env, <env-dir>/env.d/*.env) runs on
# every invocation: a flat file whose private counterpart is absent is MOVED in
# (rename: its values travel, nothing is re-derived). --retire-legacy then removes
# each flat file; one that an installed unit still names in EnvironmentFile= becomes
# a symlink into the private directory instead, so that unit keeps loading it (the
# manager reads it before namespacing) while the content stays behind the mask. Every file the manifest implies is ALWAYS written, empty values
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
#   --migrate-store-only  establish the persisted store's directory and migrate a flat
#                   store into it, then exit (gen-env runs this before its first write).
#   --retire-legacy afterwards remove the flat-layout files (see MIGRATION). pull-sync
#                   passes it only on its post-converge call, so a unit that still
#                   names a flat path is never left without its file mid-tick.
#
# Prints names and file paths only, never a value. Writes are temp + rename, 0600.
set -euo pipefail

_here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST=""
ENV_DIR="/etc/substrate"
STORE=""            # default: the manifest's store_dir/store_file
LEGACY_STORE="-"    # default: the manifest's legacy_store, only when --store is not given
MIGRATE_STORE_ONLY=0
PEER_FILE="${PEER_CREDENTIALS_FILE:-/workspace/.peer-credentials}"
MODE="values"
STRIP=0
RETIRE=0
UNIT_DIRS="/etc/systemd/system /run/systemd/system /usr/lib/systemd/system /lib/systemd/system"
while [ $# -gt 0 ]; do
  case "$1" in
    --manifest)  MANIFEST="$2"; shift 2 ;;
    --env-dir)   ENV_DIR="$2"; shift 2 ;;
    --store)     STORE="$2"; shift 2 ;;
    --legacy-store) LEGACY_STORE="$2"; shift 2 ;;
    --migrate-store-only) MIGRATE_STORE_ONLY=1; shift ;;
    --peer-file) PEER_FILE="$2"; shift 2 ;;
    --mode)      MODE="$2"; shift 2 ;;
    --strip-shared) STRIP=1; shift ;;
    --retire-legacy) RETIRE=1; shift ;;
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

# ── the persisted store's stable directory ──────────────────────────────────
# Same rule as the private directory below, in the workspace volume (the store must
# survive a recreate). A flat-layout store at legacy_store is a REGULAR file only when a
# writer that predates this layout produced it (an older image, a not-yet-converged
# script), so it is the newest copy: it is moved in over the directory's copy (rename,
# values travel) and the flat path becomes a symlink again. The symlink stays: images
# that predate the move still find the store through it, and a masked process that
# follows it lands in the masked directory.
_store_rel_link() { # <flat path> <real path>: atomic relative symlink
  local _rel; _rel="$(realpath -m --relative-to="$(dirname "$1")" "$2")"
  ln -sfn "$_rel" "$1.tmp.$$" && mv -Tf "$1.tmp.$$" "$1"
}
if [ -z "$STORE" ]; then
  _sd="$(jq -r '.store_dir // empty' "$MANIFEST")"; _sf="$(jq -r '.store_file // empty' "$MANIFEST")"
  [ -n "$_sd" ] && [ -n "$_sf" ] || { echo "[secret-scope] ERROR: $MANIFEST must name store_dir and store_file" >&2; exit 1; }
  STORE="$_sd/$_sf"
  [ "$LEGACY_STORE" = "-" ] && LEGACY_STORE="$(jq -r '.legacy_store // empty' "$MANIFEST")"
fi
[ "$LEGACY_STORE" = "-" ] && LEGACY_STORE=""
# Only the steps that own the store migrate it: gen-env's --migrate-store-only (before
# its first write) and recover mode (pull-sync, every tick). Values mode never reads it.
[ "$MIGRATE_STORE_ONLY" = 1 ] || [ "$MODE" = recover ] || LEGACY_STORE=""
if [ -n "$LEGACY_STORE" ]; then
  _sdir="$(dirname "$STORE")"
  if [ -L "$_sdir" ] || { [ -e "$_sdir" ] && [ ! -d "$_sdir" ]; }; then
    echo "[secret-scope] ERROR: $_sdir exists and is not a real directory; refusing to keep the secrets store behind it" >&2; exit 1
  fi
  if [ ! -d "$_sdir" ]; then
    mkdir -p "$(dirname "$_sdir")"; (umask 077; mkdir -p -m 0700 "$_sdir")
    echo "[secret-scope] created $_sdir (0700)"
  fi
  chmod 0700 "$_sdir"
  for _sfx in "" ".prev"; do
    _old="$LEGACY_STORE$_sfx"; _new="$STORE$_sfx"
    if [ -f "$_old" ] && [ ! -L "$_old" ]; then
      mv -f "$_old" "$_new"; chmod 600 "$_new"
      _store_rel_link "$_old" "$_new"
      echo "[secret-scope] moved store $_old -> $_new (flat path kept as a symlink)"
    elif [ -e "$_new" ] && [ ! -e "$_old" ] && [ ! -L "$_old" ]; then
      _store_rel_link "$_old" "$_new"
    fi
  done
fi
[ "$MIGRATE_STORE_ONLY" = 1 ] && exit 0

SHARED="$ENV_DIR/env"
PRIVATE_REL="$(jq -r '.private_dir // empty' "$MANIFEST")"
UNIT_TMPL="$(jq -r '.unit_file // empty' "$MANIFEST")"
ADMIN_REL="$(jq -r '.admin_file // empty' "$MANIFEST")"
[ -n "$PRIVATE_REL" ] && [ -n "$UNIT_TMPL" ] && [ -n "$ADMIN_REL" ] \
  || { echo "[secret-scope] ERROR: $MANIFEST must name private_dir, unit_file and admin_file" >&2; exit 1; }
case "$PRIVATE_REL" in /*|*..*|*/*) echo "[secret-scope] ERROR: private_dir must be one plain directory name" >&2; exit 1 ;; esac
case "$UNIT_TMPL" in "$PRIVATE_REL"/*) ;; *) echo "[secret-scope] ERROR: unit_file ($UNIT_TMPL) is outside private_dir ($PRIVATE_REL): it would not be masked" >&2; exit 1 ;; esac
case "$ADMIN_REL" in "$PRIVATE_REL"/*) ;; *) echo "[secret-scope] ERROR: admin_file ($ADMIN_REL) is outside private_dir ($PRIVATE_REL): it would not be masked" >&2; exit 1 ;; esac
PRIVATE="$ENV_DIR/$PRIVATE_REL"
ADMIN_FILE="$ENV_DIR/$ADMIN_REL"
unit_file() { printf '%s/%s' "$ENV_DIR" "${UNIT_TMPL//\{unit\}/$1}"; }

# ── the stable private directory ─────────────────────────────────────────────
# Created once; afterwards only chmod'ed in place (same inode). Never removed,
# renamed or recreated here or anywhere else (validation/scripts/secret-dir-mask.test.sh).
if [ -L "$PRIVATE" ] || { [ -e "$PRIVATE" ] && [ ! -d "$PRIVATE" ]; }; then
  echo "[secret-scope] ERROR: $PRIVATE exists and is not a real directory; refusing to write secrets through it" >&2; exit 1
fi
if [ ! -d "$PRIVATE" ]; then
  mkdir -p "$ENV_DIR"
  mkdir -p -m 0700 "$PRIVATE"
  echo "[secret-scope] created $PRIVATE (0700)"
fi
chmod 0700 "$PRIVATE"

# ── migration from the flat layout ───────────────────────────────────────────
# legacy-path: the flat layout this replaces. Read here only to move it in / retire it.
LEGACY_ADMIN="$ENV_DIR/admin.env"            # legacy-path
LEGACY_UNIT_DIR="$ENV_DIR/env.d"             # legacy-path
legacy_pairs() { # prints "<flat path>\t<private path>" for every flat file present
  [ -e "$LEGACY_ADMIN" ] || [ -L "$LEGACY_ADMIN" ] && printf '%s\t%s\n' "$LEGACY_ADMIN" "$ADMIN_FILE"
  local f
  for f in "$LEGACY_UNIT_DIR"/*.env; do
    [ -e "$f" ] || [ -L "$f" ] || continue
    printf '%s\t%s\n' "$f" "$(unit_file "$(basename "$f" .env)")"
  done
  return 0
}
flat_link() { # <flat path> <private path>: atomically make the flat path a relative symlink
  local _rel; _rel="$(realpath -m --relative-to="$(dirname "$1")" "$2")"
  ln -sfn "$_rel" "$1.tmp.$$" && mv -Tf "$1.tmp.$$" "$1"
}
umask 077
while IFS=$'\t' read -r _old _new; do
  [ -n "$_old" ] || continue
  [ -f "$_old" ] && [ ! -L "$_old" ] || continue          # a symlink is already migrated
  [ -e "$_new" ] && continue                              # the private copy is authoritative
  mkdir -p "$(dirname "$_new")"
  mv -f "$_old" "$_new"                                   # same filesystem: a rename, values travel
  chmod 600 "$_new"
  # The flat path never disappears mid-tick: until --retire-legacy (after the units
  # converge) it is a symlink to the moved file, so a unit still naming it loads it.
  flat_link "$_old" "$_new"
  echo "[secret-scope] moved $_old -> $_new"
done < <(legacy_pairs)

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
# Everything under the private directory is root-only. ($ENV_DIR itself is left as it is.)
find "$PRIVATE" -mindepth 1 -type d -exec chmod 700 {} + 2>/dev/null || true

# ── retire the flat layout ───────────────────────────────────────────────────
# Each flat file is removed, unless an installed unit file or drop-in still names it
# in EnvironmentFile= (an /etc shadow rendered before this layout, say): then it
# becomes a relative symlink to its private counterpart, so that unit still starts
# and loads it, while a process inside a masked namespace that follows the link
# lands in the masked directory.
if [ "$RETIRE" = 1 ]; then
  while IFS=$'\t' read -r _old _new; do
    [ -n "$_old" ] || continue
    if [ ! -e "$_new" ]; then echo "[secret-scope] kept $_old: no private counterpart $_new to point at" >&2; continue; fi
    _incont="/etc/substrate/${_old#"$ENV_DIR"/}"            # what a unit would name
    _ref=""
    for _d in $UNIT_DIRS; do
      [ -d "$_d" ] || continue
      _ref="$( { grep -rlsE "^[[:space:]]*EnvironmentFile[[:space:]]*=[[:space:]]*-?$_incont[[:space:]]*\$" "$_d" 2>/dev/null || true; } | head -n1)"
      [ -n "$_ref" ] && break
    done
    if [ -n "$_ref" ]; then
      [ -L "$_old" ] || flat_link "$_old" "$_new"
      echo "[secret-scope] kept $_old as a symlink into $PRIVATE_REL (still named by $_ref)"
    else
      rm -f "$_old"
      echo "[secret-scope] retired $_old (removed)"
    fi
  done < <(legacy_pairs)
  rmdir "$LEGACY_UNIT_DIR" 2>/dev/null || true             # only when nothing is left in it
fi

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
