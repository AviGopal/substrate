#!/usr/bin/env bash
# pull-sync-scrubbed-env-state-defaults.test.sh: scrubbed_env (scripts/substrate/substrate-pull-sync.sh) must point EVERY
# state default the code under test names (`process.env.X ?? "/workspace/..."`) under its throwaway root, derived from the
# tree at call time, and must FLAG any live state file that moves during a scrubbed run. Without it, suites
# credit the live close-oracle calibration and gap-class posteriors (fixture classes at very high alpha), because
# env -i drops each X and the test process writes the compiled-in /workspace default.
#
#   pull-sync-scrubbed-env-state-defaults.test.sh [path/to/substrate-pull-sync.sh]
#
# Must-fail: a file default named in the tree's src (both `.X ??` and `["X"] ||` forms) is set under the root with its
# parent created; the vessel-side default resolves under the root; a live file the run touches is recorded in the ledger.
# Controls: /workspace/git/* is not redirected (named exception); a default named only in a TEST file is not scanned;
# the explicit runtime directories still win; a run that touches nothing records nothing. The ledger's READER files one
# gap per (file, day), each line once. Nothing outside the temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/ps-scrub-state.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT" > "$T/fn.sh"
if [ -s "$T/fn.sh" ] && bash -n "$T/fn.sh" 2>/dev/null; then ok "scrubbed_env extracts and parses"; else bad "scrubbed_env extracts and parses"; fi
# shellcheck source=/dev/null
. "$T/fn.sh"

TREE="$T/tree"; mkdir -p "$TREE/src/judge" "$TREE/test"
cat > "$TREE/src/judge/credit.ts" <<'TS'
const POSTERIOR = process.env["FAKE_POSTERIOR_PATH"] ?? "/workspace/fake-posteriors.json";
export const ledger = () => process.env.FAKE_LEDGER_PATH || '/workspace/deep/dir/fake-ledger.jsonl';
const CLONES = process.env.FAKE_CLONE_ROOT ?? "/workspace/git/vessels";
const PARKED = process.env.PARKED_LANDINGS_DIR ?? "/workspace/parked-landings";
const HARD = "/workspace/fake-hardcoded.json";
TS
cat > "$TREE/src/judge/credit.test.ts" <<'TS'
const ONLY_IN_TEST = process.env.FAKE_TEST_ONLY_PATH ?? "/workspace/test-only.json";
TS
LIVE="$T/live"; mkdir -p "$LIVE"; echo '{}' > "$LIVE/fake-posteriors.json"; echo '{}' > "$LIVE/fake-hardcoded.json"
LEDGER="$T/ledger.jsonl"
R="$T/root"; mkdir -p "$R"
( cd "$TREE" && PULL_SYNC_LIVE_ROOT="$LIVE" PULL_SYNC_LIVE_STATE_LEDGER="$LEDGER" scrubbed_env "$R" env ) > "$T/plain.out" 2>&1
( cd "$TREE" && PULL_SYNC_LIVE_ROOT="$LIVE" PULL_SYNC_LIVE_STATE_LEDGER="$LEDGER" scrubbed_env "$R" sh -c 'echo "P=${FAKE_POSTERIOR_PATH:-/workspace/fake-posteriors.json}"' ) > "$T/resolved.out" 2>&1
val() { sed -n "s/^$1=//p" "$2" | head -1; }

# ── must-fail ────────────────────────────────────────────────────────────────
[ "$(val FAKE_POSTERIOR_PATH "$T/plain.out")" = "$R/ws/fake-posteriors.json" ] && ok "the [\"X\"] ?? file default is under the root" || bad "the [\"X\"] ?? file default is under the root (got '$(val FAKE_POSTERIOR_PATH "$T/plain.out")')"
[ "$(val FAKE_LEDGER_PATH "$T/plain.out")" = "$R/ws/deep/dir/fake-ledger.jsonl" ] && ok "the .X || file default is under the root" || bad "the .X || file default is under the root (got '$(val FAKE_LEDGER_PATH "$T/plain.out")')"
[ -d "$R/ws/deep/dir" ] && ok "a redirected file's parent directory exists (a write lands in temp, it does not fail)" || bad "a redirected file's parent directory exists"
case "$(val P "$T/resolved.out")" in "$R"/*) ok "the vessel-side default resolves under the root";; *) bad "the vessel-side default resolves under the root (got '$(val P "$T/resolved.out")')";; esac
rm -f "$LEDGER"
( cd "$TREE" && PULL_SYNC_LIVE_ROOT="$LIVE" PULL_SYNC_LIVE_STATE_LEDGER="$LEDGER" scrubbed_env "$R" sh -c "sleep 0.05; echo x >> '$LIVE/fake-hardcoded.json'" ) > "$T/touch.out" 2>&1
[ -s "$LEDGER" ] && grep -q '"path":"'"$LIVE"'/fake-hardcoded.json"' "$LEDGER" && ok "a live file a run writes (a hard-coded path, no env name) is recorded in the ledger" || bad "a live file a run writes is recorded in the ledger ($(cat "$LEDGER" 2>/dev/null | head -c 200))"
grep -q "LIVE STATE MOVED" "$T/touch.out" && ok "the move is also reported on stderr" || bad "the move is also reported on stderr"

# ── controls ─────────────────────────────────────────────────────────────────
[ -z "$(val FAKE_CLONE_ROOT "$T/plain.out")" ] && ok "a /workspace/git/* default is not redirected (named exception)" || bad "a /workspace/git/* default is not redirected (got '$(val FAKE_CLONE_ROOT "$T/plain.out")')"
[ -z "$(val FAKE_TEST_ONLY_PATH "$T/plain.out")" ] && ok "a default named only in a test file is not scanned" || bad "a default named only in a test file is not scanned"
[ "$(val PARKED_LANDINGS_DIR "$T/plain.out")" = "$R/parked-landings" ] && ok "an explicit runtime directory still wins over the derived one" || bad "an explicit runtime directory still wins (got '$(val PARKED_LANDINGS_DIR "$T/plain.out")')"
[ "$(val WORKSPACE_ROOT "$T/plain.out")" = "$R" ] && ok "WORKSPACE_ROOT is the throwaway root" || bad "WORKSPACE_ROOT is the throwaway root"
rm -f "$LEDGER"
( cd "$TREE" && PULL_SYNC_LIVE_ROOT="$LIVE" PULL_SYNC_LIVE_STATE_LEDGER="$LEDGER" scrubbed_env "$R" true ) > /dev/null 2>&1
[ ! -s "$LEDGER" ] && ok "a run that touches nothing records nothing" || bad "a run that touches nothing records nothing ($(head -c 200 "$LEDGER"))"
( cd "$TREE" && scrubbed_env "$R" sh -c 'exit 7' ) > /dev/null 2>&1; [ $? -eq 7 ] && ok "the command's exit status is returned" || bad "the command's exit status is returned"

# ── the ledger's READER (live_state_moves_report): one gap per (file, day), each line reported once ─────────────────
sed -n '/^live_state_moves_report() {/,/^}/p' "$SCRIPT" > "$T/rd.sh"
if [ -s "$T/rd.sh" ] && bash -n "$T/rd.sh" 2>/dev/null; then ok "live_state_moves_report extracts and parses"; else bad "live_state_moves_report extracts and parses"; fi
# shellcheck source=/dev/null
. "$T/rd.sh"
EMITTED="$T/emitted.jsonl"; : > "$EMITTED"
emit_gap() { printf '%s\n' "$1" >> "$EMITTED"; }; log() { :; }
MARKER_DIR="$T/markers"; mkdir -p "$MARKER_DIR"
export PULL_SYNC_LIVE_STATE_LEDGER="$T/moves.jsonl"
{ echo '{"at":"2026-10-17T03:00:00Z","path":"/workspace/a.json","cwd":"/t/one"}'
  echo '{"at":"2026-10-17T04:00:00Z","path":"/workspace/a.json","cwd":"/t/two"}'
  echo '{"at":"2026-10-17T04:30:00Z","path":"/workspace/b.jsonl","cwd":"/t/one"}'
  echo '{"at":"2026-10-18T00:10:00Z","path":"/workspace/a.json","cwd":"/t/one"}'; } > "$PULL_SYNC_LIVE_STATE_LEDGER"
live_state_moves_report
n="$(grep -c . "$EMITTED")"
[ "$n" = 3 ] && ok "one gap per (file, day): 3 groups from 4 lines" || bad "one gap per (file, day) (got $n)"
grep -q '"id":"a-live-state-file-moved-during-a-scrubbed-suite-run-a-json-20261017"' "$EMITTED" && ok "the id names the file and the day" || bad "the id names the file and the day ($(head -c 300 "$EMITTED"))"
grep -q '"count":2' "$EMITTED" && ok "a group carries its count" || bad "a group carries its count"
grep -q '"detected_at":"2026-10-17T03:00:00Z"' "$EMITTED" && ok "detected_at is the group's first move" || bad "detected_at is the group's first move"
: > "$EMITTED"; live_state_moves_report
[ ! -s "$EMITTED" ] && ok "CONTROL: a second tick with no new lines files nothing" || bad "CONTROL: a second tick with no new lines files nothing"
echo '{"at":"2026-10-18T01:00:00Z","path":"/workspace/c.json","cwd":"/t/x"}' >> "$PULL_SYNC_LIVE_STATE_LEDGER"; live_state_moves_report
[ "$(grep -c . "$EMITTED")" = 1 ] && grep -q 'c-json-20261018' "$EMITTED" && ok "CONTROL: only the newly appended line is reported" || bad "CONTROL: only the newly appended line is reported ($(head -c 300 "$EMITTED"))"
rm -f "$PULL_SYNC_LIVE_STATE_LEDGER"; : > "$EMITTED"; live_state_moves_report
[ ! -s "$EMITTED" ] && ok "CONTROL: no ledger, nothing filed" || bad "CONTROL: no ledger, nothing filed"

echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
