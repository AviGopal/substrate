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
#   3. while the unit still shows the run before ours (the same invocation id) and its restart job is pending, its old
#      success is not taken for ours; with no job pending, the rerun was dropped: a gap (job_dropped), and the wait ends; a restart that could not be queued is a gap at once; a run that finished well
#      -> no gap; one that failed -> one open gap naming the blob; the same failure next tick -> none new; a newer blob
#      that fails -> filed again under the same id (it replaces the last); a run that then finishes well -> the
#      detector's closing row, and the marker is gone; a failure after that close -> a new id with recurrence_of; a
#      row the store did not take (open or closing) -> not marked done, written again next tick.
# That a seed run again writes nothing new is walk-owner-seed-request-due.test.sh (l).
# Must-fail: with apply_reseeded_seeds' body emptied, case 2 fails; with check_seed_applies' gap filing removed, case 3;
# with the invocation-id wait, the recurrence id or the write check removed, their cases fail.
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
        case "$p" in ActiveState) get "$u" active ;; Result) get "$u" result ;; InvocationID) get "$u" inv ;; Job) get "$u" job ;; esac ;;
  reset-failed) : ;;
  restart) [ -e "$st/$3.norestart" ] && exit 1 ;;
esac
exit 0
STUB
chmod +x "$T/systemctl"
export STUB_ST="$T/st" STUB_CALLS="$T/calls" PULLSYNC_SYSTEMCTL="$T/systemctl"
mkdir -p "$STUB_ST" "$T/markers" "$T/run" "$T/units"
MARKER_DIR="$T/markers"; PULLSYNC_RUN_DIR="$T/run"
cp "$ROOT/scripts/substrate/walk-owner-seed.ts" "$T/run/"
log() { echo "$*" >> "$T/log"; }
# The store's answer: taken, unless $T/lose is present (a write the store did not take).
emit_gap_checked() { [ -e "$T/lose" ] && return 1; echo "$1" >> "$T/gaps"; }
. "$T/fn.sh"
reset_run() { : > "$T/log"; : > "$T/calls"; : > "$T/gaps"; }
gaps() { jq -c '.impulse.pointer.gap | {status, blob: .classification_metadata.blob}' "$T/gaps" 2>/dev/null; }
gapids() { jq -r '.impulse.pointer.gap | "\(.id) \(.status) \(.recurrence_of // "-")"' "$T/gaps" 2>/dev/null; }

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
read -r b blob inv < "$T/markers/seed-apply.walk-owner-seed.service"
[ "$b" = walk-owner-seed.ts ] && [ "$blob" = "$(git hash-object "$T/run/walk-owner-seed.ts")" ] && ok "the run is marked with the script and its blob" || bad "marker: $b $blob"
echo disabled > "$STUB_ST/walk-owner-seed.service.enabled"; rm -f "$T/markers"/seed-apply.*
reset_run; apply_reseeded_seeds walk-owner-seed.ts
! grep -q restart "$T/calls" && grep -q "not enabled here" "$T/log" && ok "a seed not enabled here is left alone, and that is said" || bad "disabled seed: $(tr '\n' '|' < "$T/calls")"
echo enabled > "$STUB_ST/walk-owner-seed.service.enabled"

# ── 3. whether it worked ─────────────────────────────────────────────────────
# The queued restart has not begun: the unit still shows the last run (id inv-old), which ended well.
rm -f "$T/markers"/seed-apply.*; echo inv-old > "$STUB_ST/walk-owner-seed.service.inv"; echo 7 > "$STUB_ST/walk-owner-seed.service.job"
echo active > "$STUB_ST/walk-owner-seed.service.active"; echo success > "$STUB_ST/walk-owner-seed.service.result"
reset_run; apply_reseeded_seeds walk-owner-seed.ts; check_seed_applies
[ -e "$T/markers/seed-apply.walk-owner-seed.service" ] && ! grep -q "applied" "$T/log" && [ ! -s "$T/gaps" ] \
  && ok "[MUST-FAIL] the run before ours, still shown, is not taken for ours: no 'applied', marker kept" || bad "old run read as ours: $(tr '\n' '|' < "$T/log")"
# Its restart job still pending on the next tick: still waiting.
reset_run; check_seed_applies
[ -e "$T/markers/seed-apply.walk-owner-seed.service" ] && [ ! -s "$T/gaps" ] && ok "the run before ours, its restart job pending: still waiting" || bad "pending job: $(gaps)"
rm -f "$STUB_ST/walk-owner-seed.service.job"
echo inv-new > "$STUB_ST/walk-owner-seed.service.inv"; reset_run; check_seed_applies
grep -q "applied" "$T/log" && [ ! -e "$T/markers/seed-apply.walk-owner-seed.service" ] && ok "once the unit shows a newer run that ended well: applied" || bad "new run: $(tr '\n' '|' < "$T/log")"
# A unit that had not run this boot (no invocation id before ours), its restart job still queued, shows inactive: waits.
rm -f "$T/markers"/seed-apply.* "$T/markers"/seed-gap-id.*; : > "$STUB_ST/walk-owner-seed.service.inv"; echo 9 > "$STUB_ST/walk-owner-seed.service.job"
echo inactive > "$STUB_ST/walk-owner-seed.service.active"; echo success > "$STUB_ST/walk-owner-seed.service.result"
reset_run; apply_reseeded_seeds walk-owner-seed.ts; check_seed_applies
[ -e "$T/markers/seed-apply.walk-owner-seed.service" ] && [ ! -s "$T/gaps" ] && ok "[MUST-FAIL] never run this boot, its job queued, inactive: waits (not read as a failure)" || bad "queued first run: $(gaps)"
rm -f "$STUB_ST/walk-owner-seed.service.job"
# The job dropped without running: the same run shown and no job pending. A gap, and the wait ends.
rm -f "$T/markers"/seed-apply.* "$T/markers"/seed-gap-id.*; echo inv-old > "$STUB_ST/walk-owner-seed.service.inv"
reset_run; apply_reseeded_seeds walk-owner-seed.ts; check_seed_applies
[ "$(jq -r '.impulse.pointer.gap | "\(.status) \(.classification_metadata.result)"' "$T/gaps" 2>/dev/null)" = "open job_dropped" ] && [ ! -e "$T/markers/seed-apply.walk-owner-seed.service" ] \
  && ok "[MUST-FAIL] the rerun's job dropped (same run, no job pending): a gap, and the wait ends" || bad "dropped job: gaps $(cat "$T/gaps"); markers $(ls "$T/markers")"
rm -f "$T/markers"/seed-gap-id.*
# A restart that could not be queued: a gap at once, and no marker that a stale state could read as applied.
: > "$STUB_ST/walk-owner-seed.service.norestart"; rm -f "$T/markers"/seed-apply.*; reset_run; apply_reseeded_seeds walk-owner-seed.ts
[ "$(jq -r '.impulse.pointer.gap | "\(.status) \(.classification_metadata.result)"' "$T/gaps" 2>/dev/null)" = "open not-queued" ] && [ ! -e "$T/markers/seed-apply.walk-owner-seed.service" ] \
  && ok "[MUST-FAIL] a restart that could not be queued: a gap at once, no marker" || bad "not queued: gaps $(cat "$T/gaps"); markers $(ls "$T/markers")"
rm -f "$STUB_ST/walk-owner-seed.service.norestart" "$T/markers"/seed-apply.* "$T/markers"/seed-gap-id.*   # each case below starts with no gap
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
[ "$ids" = "pull-sync-seed-not-applied-walk-owner-seed.service" ] && ok "one gap id while it was open" || bad "gap ids: $ids"
# A failure after the close is a recurrence: a new id naming the closed one.
mark b3; state failed exit-code; reset_run; check_seed_applies
R="$(gapids)"
case "$R" in "pull-sync-seed-not-applied-walk-owner-seed.service-r"*" open pull-sync-seed-not-applied-walk-owner-seed.service") ok "[MUST-FAIL] a failure after the close: a new id with recurrence_of the closed one" ;;
  *) bad "recurrence: $R" ;; esac
# A write the store did not take marks nothing done: the next tick writes it again.
state active success; : > "$T/lose"; reset_run; check_seed_applies
[ ! -s "$T/gaps" ] && [ -e "$T/markers/seed-apply.walk-owner-seed.service" ] && ok "a closing row not taken: the marker stays" || bad "lost close: markers $(ls "$T/markers")"
rm -f "$T/lose"; reset_run; check_seed_applies
case "$(gapids)" in "pull-sync-seed-not-applied-walk-owner-seed.service-r"*" closed -") [ ! -e "$T/markers/seed-apply.walk-owner-seed.service" ] && ok "[MUST-FAIL] next tick the closing row is written again, and taken" || bad "marker left after the retry" ;;
  *) bad "retried close: $(gapids)" ;; esac
mark b4; state failed exit-code; : > "$T/lose"; reset_run; check_seed_applies
[ ! -e "$T/markers/seed-apply.walk-owner-seed.service.gap" ] && ok "an open row not taken: not marked filed" || bad "lost open marked filed"
rm -f "$T/lose"; reset_run; check_seed_applies
[ "$(gaps)" = '{"status":"open","blob":"b4"}' ] && ok "[MUST-FAIL] next tick the open row is written again" || bad "retried open: $(gaps)"

# THE SCRIPT'S ORDER. pull-sync runs top to bottom, so a seed function called at top level before its definition line
# does not exist yet ("command not found", the HEAD-moved reseed's first form). Every top-level call of each seed
# function comes after its definition.
order_ok=1
for fn in apply_reseeded_seeds check_seed_applies; do
  def="$(grep -n "^$fn() {" "$SCRIPT" | head -1 | cut -d: -f1)"
  first="$(grep -nE "(^|[[:space:];&|])$fn( |\$|$)" "$SCRIPT" | grep -v "^$def:" | grep -vE ':[[:space:]]*#' | head -1 | cut -d: -f1)"
  [ -n "$def" ] && [ -n "$first" ] && [ "$first" -gt "$def" ] || { order_ok=0; echo "  $fn: defined at ${def:-?}, first called at ${first:-?}"; }
done
[ "$order_ok" = 1 ] && ok "[MUST-FAIL] each seed function is called only after the line that defines it" || bad "a seed function is called before it exists"

# A GATED NODE: acceptance comes on a tick with no HEAD move, through reseed_run_dir_on_promote. It must collect the
# scripts whose accepted copy changed (RESEEDED_SEEDS), so the seed is run again; an accept that changes no seed collects
# nothing.
sed -n "/^reseed_run_dir_on_promote() {/,/^}/p" "$SCRIPT" > "$T/promote.sh"
. "$T/promote.sh"
A="$T/accepted"; G="$T/gate"; mkdir -p "$A/scripts/substrate" "$G"
cp "$T/run/walk-owner-seed.ts" "$A/scripts/substrate/walk-owner-seed.ts"; echo "// other" > "$A/scripts/substrate/other.ts"
cp "$A/scripts/substrate/other.ts" "$T/run/other.ts"
PULLSYNC_ACCEPTED_DIR="$A"; PULLSYNC_GATE_DIR="$G"; RUN_DIR="$T/run"
printf '%040d\n' 1 > "$G/accepted.sha"; RESEEDED_SEEDS=""; reseed_run_dir_on_promote
[ -z "$(echo $RESEEDED_SEEDS)" ] && ok "an accept that changes no seed collects nothing" || bad "unchanged accept collected: $RESEEDED_SEEDS"
echo "// accepted change" >> "$A/scripts/substrate/walk-owner-seed.ts"
printf '%040d\n' 2 > "$G/accepted.sha"; RESEEDED_SEEDS=""; reseed_run_dir_on_promote
[ "$(echo $RESEEDED_SEEDS)" = "walk-owner-seed.ts" ] && cmp -s "$A/scripts/substrate/walk-owner-seed.ts" "$T/run/walk-owner-seed.ts" \
  && ok "[MUST-FAIL] a gated accept that changes the seed collects it (and copies it), so the seed is run again" || bad "gated accept: '$RESEEDED_SEEDS'"
RESEEDED_SEEDS=""; reseed_run_dir_on_promote
[ -z "$(echo $RESEEDED_SEEDS)" ] && ok "the same accepted sha again: nothing collected" || bad "repeat accept collected: $RESEEDED_SEEDS"
# and what is collected is run: the same apply the HEAD-moved reseed feeds
state active success; mark b0; reset_run; apply_reseeded_seeds walk-owner-seed.ts
grep -q "restart" "$T/calls" 2>/dev/null && ok "the collected seed is run again by apply_reseeded_seeds" || bad "collected seed not run: $(cat "$T/calls" 2>/dev/null)"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
