#!/usr/bin/env bash
# pull-sync-seed-apply.test.sh: a seed change the gate accepted takes effect without a person.
#
# A seed is a oneshot unit that stays active once run, over a script in the active-scripts run-dir (walk-owner-seed
# writes the rows the walk reads). pull-sync's reseed copied an accepted change there and nothing ran it again, so it
# changed nothing until someone started the unit by hand. substrate-pull-sync.sh's apply_reseeded_seeds runs each seed
# again when the reseed copied anything, and check_seed_applies says, as a gap, a run that did not finish well. Over a
# stub systemctl and the REAL unit files:
#   1. the seeds are read from the unit files: exactly walk-owner-seed.service, its ExecStart as written
#      (${SUBSTRATE_RUN_DIR}/walk-owner-seed.ts, never expanded); a timer tick's oneshot, a unit naming a run-dir script
#      only inside a quoted string, and one naming it only in a comment, are not seeds;
#   2. nothing copied -> nothing run; something copied (the seed's script, or the inventory it reads) -> each enabled
#      seed reset and run again, without blocking; a disabled one is left alone, and says so;
#   3. a run that finished well -> no gap; one that failed -> one open gap naming the blob; the same failure next tick
#      -> none new; a newer blob that fails -> filed again under the same id (it replaces the last); a run that then
#      finishes well -> the detector's closing row, and the marker is gone.
# That a seed run again writes nothing new is walk-owner-seed-request-due.test.sh (l).
# Must-fail: with apply_reseeded_seeds' body emptied, case 2 fails; with check_seed_applies' gap filing removed, case 3.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/../.."
SCRIPT="$ROOT/scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/seed-apply.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

for fn in seed_units seed_script apply_reseeded_seeds seed_gap check_seed_applies; do
  sed -n "/^$fn() {/,/^}/p" "$SCRIPT" >> "$T/fn.sh"
  grep -q "^$fn() {" "$T/fn.sh" || { echo "FAIL - could not extract $fn"; exit 1; }
done

# Stub systemctl over a state dir: $T/st/<unit>.{enabled,active,result}; calls logged to $T/calls.
cat > "$T/systemctl" <<'STUB'
#!/usr/bin/env bash
st="$STUB_ST"; echo "$*" >> "$STUB_CALLS"
get() { cat "$st/$1.$2" 2>/dev/null; }
case "$1" in
  is-enabled) get "$2" enabled ;;
  show) u="$2"; shift 2; p=""
        while [ $# -gt 0 ]; do case "$1" in -p) p="$2"; shift 2;; *) shift;; esac; done
        case "$p" in ActiveState) get "$u" active ;; Result) get "$u" result ;; esac ;;
  reset-failed|restart) : ;;
esac
exit 0
STUB
chmod +x "$T/systemctl"
export STUB_ST="$T/st" STUB_CALLS="$T/calls" PULLSYNC_SYSTEMCTL="$T/systemctl"
mkdir -p "$STUB_ST" "$T/markers" "$T/run" "$T/units"
MARKER_DIR="$T/markers"; PULLSYNC_RUN_DIR="$T/run"
cp "$ROOT/scripts/substrate/walk-owner-seed.ts" "$T/run/"
log() { echo "$*" >> "$T/log"; }
emit_gap() { echo "$1" >> "$T/gaps"; }
. "$T/fn.sh"
reset_run() { : > "$T/log"; : > "$T/calls"; : > "$T/gaps"; }
gaps() { jq -c '.impulse.pointer.gap | {status, blob: .classification_metadata.blob}' "$T/gaps" 2>/dev/null; }

# ── 1. which units are seeds ─────────────────────────────────────────────────
cp "$ROOT"/scripts/substrate/units/*.service "$T/units/"
cat > "$T/units/quoted-mention.service" <<'U'
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'echo ${SUBSTRATE_RUN_DIR}/walk-owner-seed.ts'
U
cat > "$T/units/comment-mention.service" <<'U'
[Service]
Type=oneshot
RemainAfterExit=yes
# ExecStart=/root/.bun/bin/bun ${SUBSTRATE_RUN_DIR}/walk-owner-seed.ts
ExecStart=/bin/true
U
export PULLSYNC_UNIT_DIR="$T/units"
S="$(seed_units | tr '\n' ' ')"
[ "$S" = "walk-owner-seed.service " ] && ok "[MUST-FAIL] the seeds read from the real unit files are exactly walk-owner-seed (its \${SUBSTRATE_RUN_DIR} as written)" \
  || bad "seeds found: '$S'"
[ "$(seed_script walk-owner-seed.service)" = "walk-owner-seed.ts" ] && ok "its script is walk-owner-seed.ts" || bad "seed_script: '$(seed_script walk-owner-seed.service)'"
grep -q 'ExecStart=.*\${SUBSTRATE_RUN_DIR}/walk-owner-seed.ts' "$ROOT/scripts/substrate/units/walk-owner-seed.service" \
  && ok "the real unit still runs it through \${SUBSTRATE_RUN_DIR} (what the match is written for)" || bad "walk-owner-seed.service no longer runs \${SUBSTRATE_RUN_DIR}/walk-owner-seed.ts"

# ── 2. running them again ────────────────────────────────────────────────────
echo enabled > "$STUB_ST/walk-owner-seed.service.enabled"
reset_run; apply_reseeded_seeds
[ ! -s "$T/calls" ] && ok "nothing copied: nothing run" || bad "nothing copied, yet: $(cat "$T/calls")"
reset_run; apply_reseeded_seeds vessels.inventory.json
grep -qx "reset-failed walk-owner-seed.service" "$T/calls" && grep -qx "restart --no-block walk-owner-seed.service" "$T/calls" \
  && ok "[MUST-FAIL] the inventory copied: walk-owner-seed reset and run again, without blocking" || bad "calls: $(tr '\n' '|' < "$T/calls")"
! grep -qE "restart .*(quoted-mention|comment-mention)" "$T/calls" && ok "a unit that only mentions the script is not run" || bad "a mention was run: $(tr '\n' '|' < "$T/calls")"
read -r b blob < "$T/markers/seed-apply.walk-owner-seed.service"
[ "$b" = walk-owner-seed.ts ] && [ "$blob" = "$(git hash-object "$T/run/walk-owner-seed.ts")" ] && ok "the run is marked with the script and its blob" || bad "marker: $b $blob"
echo disabled > "$STUB_ST/walk-owner-seed.service.enabled"; rm -f "$T/markers"/seed-apply.*
reset_run; apply_reseeded_seeds walk-owner-seed.ts
! grep -q restart "$T/calls" && grep -q "not enabled here" "$T/log" && ok "a seed not enabled here is left alone, and that is said" || bad "disabled seed: $(tr '\n' '|' < "$T/calls")"
echo enabled > "$STUB_ST/walk-owner-seed.service.enabled"

# ── 3. whether it worked ─────────────────────────────────────────────────────
mark() { printf 'walk-owner-seed.ts %s\n' "$1" > "$T/markers/seed-apply.walk-owner-seed.service"; }
state() { echo "$1" > "$STUB_ST/walk-owner-seed.service.active"; echo "$2" > "$STUB_ST/walk-owner-seed.service.result"; }
mark b1; state active success; reset_run; check_seed_applies
[ ! -s "$T/gaps" ] && [ ! -e "$T/markers/seed-apply.walk-owner-seed.service" ] && ok "finished well, nothing filed: no gap, marker cleared" || bad "success: $(gaps)"
mark b1; state activating ""; reset_run; check_seed_applies
[ ! -s "$T/gaps" ] && [ -e "$T/markers/seed-apply.walk-owner-seed.service" ] && ok "still running: waits for the next tick" || bad "running: $(gaps)"
state failed exit-code; reset_run; check_seed_applies
[ "$(gaps)" = '{"status":"open","blob":"b1"}' ] && ok "[MUST-FAIL] a failed run: one open gap naming the blob" || bad "failure: $(gaps)"
reset_run; check_seed_applies
[ ! -s "$T/gaps" ] && ok "the same failure next tick: nothing new" || bad "refiled: $(gaps)"
mark b2; reset_run; check_seed_applies
[ "$(gaps)" = '{"status":"open","blob":"b2"}' ] && ok "a newer blob that fails: filed again (same id, replacing the last)" || bad "new blob: $(gaps)"
state active success; reset_run; check_seed_applies
[ "$(gaps)" = '{"status":"closed","blob":"b2"}' ] && [ ! -e "$T/markers/seed-apply.walk-owner-seed.service" ] && [ ! -e "$T/markers/seed-apply.walk-owner-seed.service.gap" ] \
  && ok "[MUST-FAIL] then finished well: the detector's closing row, markers gone" || bad "closing: $(gaps)"
ids="$(jq -r '.impulse.pointer.gap.id' "$T/gaps" 2>/dev/null | sort -u)"
[ "$ids" = "pull-sync-seed-not-applied-walk-owner-seed.service" ] && ok "one gap id per unit" || bad "gap ids: $ids"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
