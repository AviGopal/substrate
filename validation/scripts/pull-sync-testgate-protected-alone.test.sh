#!/usr/bin/env bash
# pull-sync's test gate must judge PROTECTED judge tests ALONE, not by the newly-failing diff
# (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice). Runs the script's own
# gate slice against a temp vessel clone with `bun` stubbed: `bun test` (whole suite) prints the
# canned full-suite output; `bun test <file>` prints the canned output for that file run alone.
# No network.
#
# The lane may tighten arming but never loosen it, and that rests on the gate seeing the protected
# judge tests (the test files autonomyScope.excluded_paths lists for the vessel, e.g.
# development-vessel's system-authored-gap-checks.test.ts) go red. Measured 2026-10-05: that file is
# ORDER-POLLUTED, red inside one full run and green alone, on an unchanged sha. When it is already red
# in the full run at base, a real loosening shows the SAME failure names at base and tip, so the
# name-set gate reads "no newly-failing test" and converges: the protection silently fails.
#
#   (a) MUST-FAIL: protected file red in the full run at base AND tip (polluted), and red ALONE at the
#       candidate (a real loosening) -> HELD (not converged), the file named in the refusal
#   (b) control: an unrelated candidate whose protected files are green alone -> converges
#   (c) pure pollution: red in the full run, GREEN alone -> converges (pollution alone never holds)
#   (d) a protected file deleted at the candidate -> HELD (removing a judge test is a loosening)
#   (e) a protected file whose alone run yields no countable result -> HELD, never a pass
#   (f) the scope file unreadable -> HELD (the protected set is unknown)
#   (g) a vessel with no protected test files -> converges, and no alone run happens
#   (h) a green-looking summary with a nonzero exit -> HELD (the exit code is part of "green")
#   (i) a countable summary that ran zero tests (0 pass / 0 fail, rc 0) -> HELD (green needs >=1 pass)
#   (j) the scrubbed environment those runs use sets MITOSIS_RUNTIME_DIR / PARKED_LANDINGS_DIR under its
#       throwaway root, so a suite never falls back to the live /vessels tree
#       (pull-sync-scrubbed-env-runtime-root.check.sh, run here as one case)
#
# usage: validation/scripts/pull-sync-testgate-protected-alone.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, awk, sed.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── the code under test, taken from the script itself ─────────────────────────
{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  echo 'run_gate() {'
  echo 'for v in "$VESSEL"; do'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"'
  echo 'done'
  echo '}'
} > "$T/fns.sh"
grep -q 'testgate-refusals' "$T/fns.sh" || { echo "FAIL - could not extract the test-gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }
ensure_clone_deps() { return 0; }

mkdir -p "$T/bin" "$T/stub"
# bun test            -> $S/full (the whole suite, same at every ref: the pollution is order, not code)
# bun test <file>     -> $S/alone-<basename> and exit $S/alone-<basename>.rc (default 1 when no stub)
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = test ] || exit 0
shift
if [ \$# -eq 0 ]; then cat "\$S/full"; exit 1; fi
b="\$(basename "\$1")"
echo "ALONE \$b" >> "$T/alone-calls.txt"
[ -f "\$1" ] || { echo "error: file not found \$1"; exit 1; }
if [ -f "\$S/alone-\$b" ]; then cat "\$S/alone-\$b"; exit "\$(cat "\$S/alone-\$b.rc" 2>/dev/null || echo 0)"; fi
exit 1
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

VESSEL=development-vessel
GTR_NODE=node1
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"
d="$CLONE_DIR/$VESSEL/"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
PF=test/resolvers/system-authored-gap-checks.test.ts
PNAME='(fail) system-authored gap checks > arms only on an importing assertion-red test'
# The full suite at base AND tip: the protected test is red in both (order pollution), plus one old failure.
FULL="(pass) a > works
(fail) old > one
$PNAME
 5 pass
 2 fail"
GREEN_ALONE="(pass) system-authored gap checks > arms only on an importing assertion-red test
 9 pass
 0 fail"
RED_ALONE="$PNAME
 8 pass
 1 fail"

scope() { # write the scope fixture: the protected path listed for this vessel (plus a non-test src path)
  jq -n --arg p "repos/$VESSEL/$PF" '{autonomyScope:{excluded_paths:[$p,"repos/development-vessel/src/resolvers/scope-earn-in.ts","repos/other-vessel/test/x.test.ts"]}}' > "$PROTECTED_SCOPE_FILE"
}
setup() { # base commit pinned as last-good; the stored baseline already holds the polluted name
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/stub"/* "$T/alone-calls.txt"
  mkdir -p "$d/src" "$d/test/resolvers" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  echo 'test("p", () => {});' > "$d/$PF"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  printf '%s\n' "$FULL" > "$T/stub/full"
  printf '%s\n%s\n' '(fail) old > one' "$PNAME" | sort > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "2 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  scope
  synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0
}
alone() { printf '%s\n' "$2" > "$T/stub/alone-$(basename "$1")"; echo "$3" > "$T/stub/alone-$(basename "$1").rc"; }
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }

# ── (a) MUST-FAIL: polluted at base+tip, red alone at the candidate -> HELD ──────
setup
echo 'export const x = 2; // loosens the guarded import check' > "$d/src/x.ts"; g commit -am loosen
alone "$PF" "$RED_ALONE" 1
tick
converged && bad "(a) a loosening masked by order pollution was CONVERGED (protected test red alone at the candidate)" || ok "(a) masked loosening HELD"
grep -qF "$(basename "$PF")" "$LOG" && grep -qi 'protected' "$LOG" && ok "(a) the refusal names the protected file" || bad "(a) refusal does not name the protected file (log: $(tr '\n' '|' < "$LOG" | cut -c1-500))"
grep -qx "ALONE $(basename "$PF")" "$T/alone-calls.txt" 2>/dev/null && ok "(a) the protected file ran in its own process" || bad "(a) the protected file was never run alone"

# ── (b) control: unrelated candidate, protected green alone -> converges ─────────
setup
echo 'export const y = 3;' > "$d/src/y.ts"; g add -A; g commit -m unrelated
alone "$PF" "$GREEN_ALONE" 0
tick
converged && ok "(b) an unrelated candidate with protected files green alone converges" || bad "(b) the control did not converge (log: $(tr '\n' '|' < "$LOG" | cut -c1-500))"

# ── (c) pure pollution: red in the full run, green alone -> converges ────────────
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am benign
alone "$PF" "$GREEN_ALONE" 0
tick
converged && ok "(c) pure order pollution (red in the full run, green alone) does not hold" || bad "(c) pollution alone held the candidate (log: $(tr '\n' '|' < "$LOG" | cut -c1-500))"

# ── (d) protected file deleted at the candidate -> HELD ──────────────────────────
setup
g rm -q "$PF"; g commit -m 'drop the judge test'
tick
converged && bad "(d) deleting a protected judge test was CONVERGED" || ok "(d) a deleted protected test HOLDS"

# ── (e) alone run with no countable result -> HELD ───────────────────────────────
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am crash
alone "$PF" "Segmentation fault" 139
tick
converged && bad "(e) an uncountable alone run was read as a pass" || ok "(e) an uncountable alone run HOLDS"

# ── (h) a green-looking summary with a nonzero exit (an afterAll throw, say) -> HELD
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am afterall
alone "$PF" "$GREEN_ALONE
error: afterAll hook threw" 1
tick
converged && bad "(h) a nonzero exit behind a green summary was read as a pass" || ok "(h) a nonzero exit HOLDS even with 0 named failures"

# ── (i) a countable summary that ran ZERO tests (0 pass / 0 fail, rc 0) -> HELD
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am emptied
alone "$PF" " 0 pass
 0 fail" 0
tick
converged && bad "(i) a protected file that ran zero tests was read as green" || ok "(i) zero tests run alone HOLDS (green needs >=1 pass)"

# ── (f) scope file unreadable -> HELD ────────────────────────────────────────────
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am noscope
alone "$PF" "$GREEN_ALONE" 0
rm -f "$PROTECTED_SCOPE_FILE"
tick
converged && bad "(f) an unreadable protected set was read as 'nothing protected'" || ok "(f) an unreadable scope file HOLDS"

# ── (g) a vessel with no protected test files -> converges, no alone run ─────────
setup
jq -n '{autonomyScope:{excluded_paths:["repos/other-vessel/test/x.test.ts"]}}' > "$PROTECTED_SCOPE_FILE"
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am none
tick
converged && ok "(g) a vessel with no protected tests converges" || bad "(g) a vessel with no protected tests was held (log: $(tr '\n' '|' < "$LOG" | cut -c1-500))"
[ ! -s "$T/alone-calls.txt" ] && ok "(g) no alone run when nothing is protected" || bad "(g) ran alone: $(tr '\n' ' ' < "$T/alone-calls.txt")"

# ── (j) the scrubbed environment every alone run uses points the runtime root under its throwaway root ──
# Its own check (controls: the minimal env is otherwise unchanged and env -i still drops a caller's variable).
bash "$(dirname "$0")/pull-sync-scrubbed-env-runtime-root.check.sh" "$SCRIPT" > "$T/scrub" 2>&1 < /dev/null \
  && ok "(j) the scrubbed-env runtime-root check passes ($(grep -c '^ok' "$T/scrub") cases)" \
  || { bad "(j) the scrubbed-env runtime-root check: $(grep -c '^FAIL' "$T/scrub") failing"; grep '^FAIL' "$T/scrub" | sed 's/^/     /'; }

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
