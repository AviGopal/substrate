#!/usr/bin/env bash
# pull-sync installs only COMMITTED glue (scripts/substrate/substrate-pull-sync.sh,
# stage_committed_glue). Runs the script's own converge_units / converge_fleet_defs
# against a temp super-repo whose working tree carries the 10-01 breach — an
# uncommitted edit of scripts/substrate/substrate-pull-sync.sh — plus a planted
# untracked unit and a local commit that origin does not have.
#
# usage: validation/scripts/pull-sync-committed-glue.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, tar. No root: destinations are temp dirs.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()   { echo "ok   - $*"; }
bad()  { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
same() { cmp -s "$1" "$2" && ok "$3" || bad "$3"; }

# ── the functions under test, taken from the script itself ──────────────────────
# Destinations are rewritten to temp dirs the same way for any version of the
# script, so a parent without the PULLSYNC_*_DIR seams is measured identically.
export PULLSYNC_UNIT_DIR="$T/dst/unit" PULLSYNC_BIN_DIR="$T/dst/bin" PULLSYNC_SHARE_DIR="$T/dst/share" FLEET_DIR="$T/dst/fleet"
mkdir -p "$PULLSYNC_UNIT_DIR" "$PULLSYNC_BIN_DIR" "$PULLSYNC_SHARE_DIR"
{
  awk '/^# INSTALL ONLY WHAT IS COMMITTED\./{on=1} on{print} on && /^stage_committed_glue\(\) \{/{f=1} f && /^}/{exit}' "$SCRIPT"
  sed -n '/^converge_units() {/,/^}/p' "$SCRIPT"
  sed -n '/^converge_fleet_defs() {/,/^}/p' "$SCRIPT"
} | sed -e "s#/usr/lib/systemd/system#\$PULLSYNC_UNIT_DIR#g" -e "s#/usr/local/bin#\$PULLSYNC_BIN_DIR#g" -e "s#/usr/local/share/substrate#\$PULLSYNC_SHARE_DIR#g" > "$T/fns.sh"
GAPS="$T/gaps.jsonl"; LOG="$T/log.txt"; : > "$GAPS"; : > "$LOG"
log() { echo "$*" >> "$LOG"; }
emit_gap() { printf '%s\n' "$1" >> "$GAPS"; }
systemctl() { :; }
BRANCH=dev
# shellcheck disable=SC1090
source "$T/fns.sh"
trap 'rm -rf "$T"' EXIT   # the sourced block may install its own EXIT trap

g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
COMMITTED_PS='#!/usr/bin/env bash
echo committed pull-sync'
mk_super() { # dir
  mkdir -p "$1/scripts/substrate/units"
  printf '%s\n' "$COMMITTED_PS" > "$1/scripts/substrate/substrate-pull-sync.sh"
  printf 'echo committed gen-env\n' > "$1/scripts/substrate/gen-env.sh"
  printf '[Unit]\nDescription=committed\n' > "$1/scripts/substrate/units/foo.service"
  git -C "$1" init -q -b dev; g "$1" add -A; g "$1" commit -m base
}
reset_dst() { rm -rf "$T/dst"; mkdir -p "$PULLSYNC_UNIT_DIR" "$PULLSYNC_BIN_DIR" "$PULLSYNC_SHARE_DIR"; echo old > "$PULLSYNC_BIN_DIR/substrate-pull-sync"; echo old > "$PULLSYNC_BIN_DIR/gen-env"; : > "$GAPS"; : > "$LOG"; }

# ── 1. the breach: dirty tracked pull-sync + planted untracked unit ─────────────
S="$T/super"; mk_super "$S"; reset_dst
printf '#!/usr/bin/env bash\necho UNCOMMITTED walk edit\n' > "$S/scripts/substrate/substrate-pull-sync.sh"
printf '[Unit]\nDescription=planted\n' > "$S/scripts/substrate/units/planted.service"
converge_units "$S"; converge_fleet_defs "$S"
git -C "$S" show HEAD:scripts/substrate/substrate-pull-sync.sh > "$T/want-ps"
same "$PULLSYNC_BIN_DIR/substrate-pull-sync" "$T/want-ps" "a dirty tracked substrate-pull-sync.sh is NOT installed; the committed copy is"
grep -q UNCOMMITTED "$PULLSYNC_BIN_DIR/substrate-pull-sync" && bad "the uncommitted edit reached the bin dir" || ok "the uncommitted edit never reaches the bin dir"
same "$PULLSYNC_UNIT_DIR/foo.service" "$S/scripts/substrate/units/foo.service" "a clean committed unit still converges"
[ -e "$PULLSYNC_UNIT_DIR/planted.service" ] && bad "an untracked planted unit was installed" || ok "an untracked planted unit is not installed"
grep -q '"id":"pull-sync-uncommitted-glue-scripts-substrate-substrate-pull-sync-sh"' "$GAPS" && ok "divergence gap filed for the dirty script" || bad "no divergence gap for the dirty script"
grep -q 'planted-service' "$GAPS" && ok "divergence gap filed for the planted unit" || bad "no divergence gap for the planted unit"
grep -q 'DIVERGENCE' "$LOG" && ok "divergence is logged" || bad "divergence not logged"
grep -q 'UNCOMMITTED' "$S/scripts/substrate/substrate-pull-sync.sh" && ok "the working tree is left alone (reported, not discarded)" || bad "the working tree was modified"

# ── 2. a local commit origin does not have is not a landing ─────────────────────
O="$T/origin.git"; git init -q --bare "$O"; S2="$T/super2"; mk_super "$S2"
g "$S2" remote add origin "$O"; g "$S2" push origin dev; g "$S2" fetch origin; reset_dst
printf 'echo LOCAL-COMMIT gen-env\n' > "$S2/scripts/substrate/gen-env.sh"; g "$S2" commit -am local
converge_fleet_defs "$S2"
grep -q 'LOCAL-COMMIT' "$PULLSYNC_BIN_DIR/gen-env" && bad "an unpushed local commit was installed" || ok "an unpushed local commit is not installed"
grep -q 'committed gen-env' "$PULLSYNC_BIN_DIR/gen-env" && ok "origin/dev's copy is installed instead" || bad "origin/dev's copy was not installed"
grep -q 'pull-sync-uncommitted-glue-scripts-substrate"' "$GAPS" && ok "divergence gap filed for the local commit" || bad "no gap for the local commit"

# ── 3. no git checkout: install nothing ────────────────────────────────────────
N="$T/notgit"; mkdir -p "$N/scripts/substrate/units"; printf 'echo plain\n' > "$N/scripts/substrate/substrate-pull-sync.sh"; reset_dst
converge_units "$N"; converge_fleet_defs "$N"
grep -q plain "$PULLSYNC_BIN_DIR/substrate-pull-sync" && bad "a non-git tree was installed" || ok "a non-git tree installs nothing"

# ── 4. no install in the script reads the working tree ─────────────────────────
if grep -nE '(install|cp)( -[a-z]+)* [0-9]* *"?\$(\{)?(SUPER_DIR|_cu_super|_cf_super)(\})?"?/scripts' "$SCRIPT"; then bad "an install/cp still reads the super-repo working tree (lines above)"; else ok "no install/cp reads the super-repo working tree"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
