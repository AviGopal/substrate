#!/usr/bin/env bash
# pull-sync installs a vessel clone's NESTED packages (a sub-directory with its own package.json and lockfile,
# e.g. human-surface-vessel's ui/) before its test gate, and the parent/candidate overlay sees them too
# (scripts/substrate/substrate-pull-sync.sh: ensure_clone_nested_deps, run_suite_at, the "3-pre. TEST GATE"
# slice). The clone install only ever installed the vessel root, so every test resolving a dependency that
# only the nested package declares failed to LOAD at the parent and the candidate alike: human-surface-vessel
# was held "TEST GATE BLIND — ENVIRONMENT" and its DOM tests were never measured.
#
# Runs the script's own gate slice against a temp fixture clone with a REAL bun. The nested dependency is a
# local file: package inside the fixture, so no registry is reached; HOME is a temp dir, so bun's cache and
# config stay out of the real home. Nothing reaches /vessels, /workspace or a live service.
#
#   (n1) must-fail: a test that resolves a dependency declared ONLY in ui/package.json, the way
#        human-surface's DOM tests do (Bun.resolveSync(spec, "ui/src/") at module top level): the nested
#        package is installed with --frozen-lockfile --ignore-scripts under the scrubbed env, the test loads
#        and is graded (pass), no "Cannot find package" and no TEST GATE BLIND line, and the vessel converges.
#        A second tick with nothing changed does not reinstall.
#   (n2) overlay fairness: the candidate breaks the nested-dependent test; the parent worktree resolves it
#        too (its ui/node_modules is linked like the root one), so the failure is attributable and refused.
#   (n3) control: a vessel with no nested package behaves as before (no nested install, converges).
#   (n4) a scanned nested package that is NOT declared is logged as such and not installed; a package.json
#        plus lockfile under dist/ or node_modules/ (the root's or a nested one's) is never reported; the
#        declared one is still installed.
#   (n5) a lockfile that does not match ui/package.json fails LOUDLY: logged, gap filed, suite not run, NOT
#        converged; it never resolves fresh, and the lockfile is left as committed.
#   (n6) a declared nested package without a lockfile fails closed (a frozen install is impossible).
#   (n7) the nested package's own postinstall never runs (same --ignore-scripts policy as the root install).
#
# usage: validation/scripts/pull-sync-clone-nested-deps.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, awk, sed and bun (skips loudly without bun).
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

REAL_BUN="${GLUE_TESTS_BUN:-$(command -v bun 2>/dev/null || true)}"
if [ -z "$REAL_BUN" ] || [ ! -x "$REAL_BUN" ]; then echo "SKIP - bun not found: this harness runs a real bun install and bun test"; exit 0; fi

# ── the code under test, taken from the script itself ─────────────────────────
{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_dep_missing() {/,/^}/p' "$SCRIPT"
  sed -n '/^file_dep_unbuilt() {/,/^}/p' "$SCRIPT"
  sed -n '/^build_file_dep() {/,/^}/p' "$SCRIPT"
  sed -n '/^tree_digest() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_file_deps() {/,/^}/p' "$SCRIPT"
  sed -n '/^file_dep_identity() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_deps_install() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_deps_gap() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_shared_packages() {/,/^}/p' "$SCRIPT"
  sed -n '/^ensure_clone_deps() {/,/^}/p' "$SCRIPT"
  sed -n '/^ensure_clone_nested_deps() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  echo 'run_gate() {'
  echo 'for v in "$VESSEL"; do'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"'
  echo 'done'
  echo '}'
} > "$T/fns.sh"
# shellcheck disable=SC1090
source "$T/fns.sh"
declare -F ensure_clone_nested_deps >/dev/null && ok "ensure_clone_nested_deps is defined in the script" \
  || bad "ensure_clone_nested_deps is defined in the script"
grep -q 'ensure_clone_nested_deps "\$v" "\$d"' "$T/fns.sh" && ok "the test-gate slice calls ensure_clone_nested_deps" \
  || bad "the test-gate slice calls ensure_clone_nested_deps"

CALLS="$T/calls.txt"; LOG="$T/log.txt"; RUNS="$T/runs"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }

# bun wrapper: the real bun, with every install recorded and every test run's output kept (one file per run,
# with the directory and HEAD it ran at). Paths are baked in: the gate runs bun under env -i.
mkdir -p "$T/bin" "$RUNS" "$T/home"
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
case "\$1" in
  install) echo "INSTALL \$PWD \$*" >> "$CALLS"; exec "$REAL_BUN" "\$@" ;;
  test)
    n="\$(date +%s%N)"
    { echo "PWD \$PWD"; echo "HEAD \$(git rev-parse HEAD 2>/dev/null)"; } > "$RUNS/\$n.meta"
    "$REAL_BUN" "\$@" > "$RUNS/\$n.out" 2>&1; rc=\$?
    cat "$RUNS/\$n.out"; exit \$rc ;;
  *) exec "$REAL_BUN" "\$@" ;;
esac
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"
export HOME="$T/home"   # scrubbed_env passes HOME through: bun's cache and config stay in the temp dir

VESSEL=demo-vessel
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
d="$CLONE_DIR/$VESSEL/"
INV="$T/inventory.json"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }

UI_TEST='import { expect, test } from "bun:test";
// Resolved exactly as human-surface'"'"'s DOM tests resolve react: from the nested package'"'"'s src, at load time.
const uiSrc = new URL("../ui/src/", import.meta.url).pathname;
const dep = require(Bun.resolveSync("nested-dep", uiSrc));
test("nested > resolves its own dependency", () => { expect(dep.answer).toBe(42); });'
ROOT_TEST='import { expect, test } from "bun:test";
test("root > works", () => { expect(1).toBe(1); });'

# mkpkg <dir> <name> <deps-json> [scripts-json]: a package.json, its lockfile from a NON-frozen install of
# file: dependencies only (offline), and no node_modules left behind.
mkpkg() {
  mkdir -p "$1"
  printf '{"name":"%s","private":true,"dependencies":%s%s}\n' "$2" "$3" "${4:+,\"scripts\":$4}" > "$1/package.json"
  (cd "$1" && "$REAL_BUN" install --silent --ignore-scripts >/dev/null 2>&1) || bad "fixture: lockfile generation failed in $1"
  [ -f "$1/bun.lock" ] || bad "fixture: no bun.lock generated in $1"
  rm -rf "$1/node_modules"
}

# setup <nested:0|1> [declared-json]: the fixture clone. Root package (no dependencies; its node_modules is
# present, so the root install is adopted), a local file: package under vendor/, optionally a nested ui/
# package depending on it, and one test resolving it from ui/src. Parent commit, then a candidate commit.
setup() {
  local nested="$1" declared="${2:-[\"ui\"]}"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$RUNS"
  mkdir -p "$d/src" "$d/test" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR" "$RUNS"
  printf '{"name":"demo","private":true}\n' > "$d/package.json"
  mkdir -p "$d/vendor/nested-dep"
  echo '{"name":"nested-dep","version":"1.0.0","main":"index.js"}' > "$d/vendor/nested-dep/package.json"
  echo 'module.exports = { answer: 42 };' > "$d/vendor/nested-dep/index.js"
  echo 'export const x = 1;' > "$d/src/x.ts"
  if [ "$nested" = 1 ]; then
    mkpkg "$d/ui" demo-ui '{"nested-dep":"file:../vendor/nested-dep"}'
    mkdir -p "$d/ui/src"; echo 'export {};' > "$d/ui/src/index.ts"
    printf '%s\n' "$UI_TEST" > "$d/test/ui.test.ts"
  else
    printf '%s\n' "$ROOT_TEST" > "$d/test/root.test.ts"
  fi
  printf 'node_modules\n' > "$d/.gitignore"
  printf '{"vessels":[{"unit":"%s.service","repo":"%s","nested_packages":%s}]}\n' "$VESSEL" "$VESSEL" "$declared" > "$INV"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am change
  mkdir -p "$d/node_modules"
  : > "$CALLS"; : > "$LOG"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0 CLONE_DEPS_RETRY_BACKOFF_SECONDS
}
run() { HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate; }
# The output of every suite run so far, concatenated, ANSI stripped. Callers capture it before grepping:
# under pipefail, `grep -q` closing the pipe early would fail the producer with SIGPIPE.
all_runs() { cat "$RUNS"/*.out 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g'; }
# The output of the runs made at <sha> in a pull-sync worktree (the overlay), ANSI stripped.
worktree_runs_at() {
  local m
  for m in "$RUNS"/*.meta; do
    [ -f "$m" ] || continue
    grep -q '^PWD .*/pullsync-base-' "$m" && grep -qx "HEAD $1" "$m" && sed 's/\x1b\[[0-9;]*m//g' "${m%.meta}.out"
  done
}

# ── (n1) must-fail: the nested dependency resolves, the test is graded, the gate is not blind ──
setup 1
run
grep -q "^INSTALL ${d}ui install .*--frozen-lockfile" "$CALLS" && ok "(n1) bun install ran in ui/ with --frozen-lockfile" \
  || bad "(n1) bun install ran in ui/ with --frozen-lockfile (installs: $(grep '^INSTALL' "$CALLS" | tr '\n' '|'))"
grep -q "^INSTALL ${d}ui install .*--ignore-scripts" "$CALLS" && ok "(n1) the nested install passes --ignore-scripts, like the root install" \
  || bad "(n1) the nested install passes --ignore-scripts, like the root install"
[ -e "$d/ui/node_modules/nested-dep/index.js" ] && ok "(n1) ui/node_modules holds the nested dependency" || bad "(n1) ui/node_modules holds the nested dependency"
grep -q "nested package ui" "$LOG" && ok "(n1) the nested install is logged by directory" || bad "(n1) the nested install is logged by directory"
printf '%s\n' "$(all_runs)" | grep -q "Cannot find package 'nested-dep'" && bad "(n1) the suite resolves nested-dep (it printed Cannot find package)" \
  || ok "(n1) the suite resolves nested-dep (no Cannot find package)"
printf '%s\n' "$(all_runs)" | grep -qE '^\(pass\) nested > resolves its own dependency|✓ nested > resolves its own dependency' \
  && ok "(n1) the nested-dependent test ran and was graded (pass)" || bad "(n1) the nested-dependent test ran and was graded (pass)"
grep -q 'TEST GATE BLIND' "$LOG" && bad "(n1) no TEST GATE BLIND line ($(grep -m1 'TEST GATE BLIND' "$LOG" | cut -c1-160))" \
  || ok "(n1) no TEST GATE BLIND line"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(n1) converges" || bad "(n1) converges"
grep -q 'unresolvable-modules\|testgate-environment' "$CALLS" && bad "(n1) no unresolvable-module or environment gap" || ok "(n1) no unresolvable-module or environment gap"
[ -z "$(git -C "$d" status --porcelain 2>/dev/null)" ] && ok "(n1) the clone's tracked tree is clean afterwards" \
  || bad "(n1) the clone's tracked tree is clean afterwards ($(git -C "$d" status --porcelain | tr '\n' ' '))"
: > "$CALLS"; : > "$LOG"; skipped=0
run
grep -q "^INSTALL ${d}ui " "$CALLS" && bad "(n1) an up-to-date nested package is not reinstalled on the next tick" \
  || ok "(n1) an up-to-date nested package is not reinstalled on the next tick"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(n1) the next tick converges too" || bad "(n1) the next tick converges too"

# ── (n2) overlay fairness: the parent worktree resolves the nested dependency like the candidate ──
# A root test too, so both overlay runs have passes (an overlay run with none is unusable by design).
setup 1
printf '%s\n' "$ROOT_TEST" > "$d/test/root.test.ts"; g add -A; g commit -m "a root test"
P_SHA="$(git -C "$d" rev-parse HEAD)"
sed -i 's/toBe(42)/toBe(43)/' "$d/test/ui.test.ts"; g commit -am "break the nested-dependent test"
printf '(fail) old > one\n' > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 2 0" > "$TEST_BASELINE_DIR/$VESSEL"
run
WT_PARENT="$(worktree_runs_at "$P_SHA")"
printf '%s\n' "$WT_PARENT" | grep -q . && ok "(n2) the overlay measured the parent in a worktree" || bad "(n2) the overlay measured the parent in a worktree"
printf '%s\n' "$WT_PARENT" | grep -q "Cannot find package 'nested-dep'" && bad "(n2) the parent worktree resolves nested-dep (its ui/node_modules is linked)" \
  || ok "(n2) the parent worktree resolves nested-dep (its ui/node_modules is linked)"
printf '%s\n' "$WT_PARENT" | grep -qE '^\(pass\) nested > resolves its own dependency|✓ nested > resolves its own dependency' \
  && ok "(n2) the nested-dependent test passes at the parent worktree" || bad "(n2) the nested-dependent test passes at the parent worktree"
grep -q 'overlay comparison .* 1 attributable to this commit' "$LOG" && ok "(n2) the overlay attributes the one new failure to the commit" \
  || bad "(n2) the overlay attributes the one new failure to the commit ($(grep -m1 'overlay' "$LOG" | cut -c1-200))"
grep -q "GAP .*pull-sync-test-regression-$VESSEL" "$CALLS" && ok "(n2) the regression in the nested-dependent test is refused" \
  || bad "(n2) the regression in the nested-dependent test is refused"
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(n2) a regressed candidate does not converge" || ok "(n2) a regressed candidate does not converge"

# ── (n3) control: no nested package, behaviour unchanged ──
setup 0 '[]'
run
grep -q "^INSTALL " "$CALLS" && bad "(n3) control: no install at all (root node_modules satisfies, nothing nested)" \
  || ok "(n3) control: no install at all (root node_modules satisfies, nothing nested)"
grep -qi 'nested' "$LOG" && bad "(n3) control: no nested-package log line ($(grep -mi1 nested "$LOG" | cut -c1-160))" || ok "(n3) control: no nested-package log line"
printf '%s\n' "$(all_runs)" | grep -qE '^\(pass\) root > works|✓ root > works' && ok "(n3) control: the root suite runs" || bad "(n3) control: the root suite runs"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(n3) control: converges" || bad "(n3) control: converges"
# The same vessel absent from the inventory (or no inventory at all) is the same control.
setup 0 '[]'; INV="$T/no-such-inventory.json"
run
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(n3) control: no inventory file, still converges" || bad "(n3) control: no inventory file, still converges"
INV="$T/inventory.json"

# ── (n4) a scanned nested package that is not declared: logged, not installed ──
setup 1
mkpkg "$d/widgets" demo-widgets '{"nested-dep":"file:../vendor/nested-dep"}'
mkdir -p "$d/ui/dist/bundled"; echo '{"name":"bundled"}' > "$d/ui/dist/bundled/package.json"; : > "$d/ui/dist/bundled/bun.lock"
mkdir -p "$d/ui/node_modules/stale"; echo '{"name":"stale"}' > "$d/ui/node_modules/stale/package.json"; : > "$d/ui/node_modules/stale/bun.lock"
# An installed dependency in the ROOT node_modules that ships its own lockfile (depth 2, like ui/).
mkdir -p "$d/node_modules/shipped-lock"; echo '{"name":"shipped-lock"}' > "$d/node_modules/shipped-lock/package.json"; : > "$d/node_modules/shipped-lock/bun.lock"
g add -A; g commit -m "add an undeclared nested package"
run
grep -q 'nested package widgets .*NOT declared' "$LOG" && ok "(n4) the undeclared nested package widgets is logged as NOT declared" \
  || bad "(n4) the undeclared nested package widgets is logged as NOT declared"
[ -e "$d/widgets/node_modules" ] && bad "(n4) the undeclared nested package is not installed" || ok "(n4) the undeclared nested package is not installed"
grep -q "^INSTALL ${d}widgets " "$CALLS" && bad "(n4) no install ran in widgets/" || ok "(n4) no install ran in widgets/"
grep -qE 'nested package (ui/dist|ui/node_modules|node_modules)' "$LOG" && bad "(n4) package.json under dist/ or node_modules/ is never reported" \
  || ok "(n4) package.json under dist/ or node_modules/ is never reported"
[ -e "$d/ui/node_modules/nested-dep/index.js" ] && ok "(n4) the declared nested package ui is still installed" || bad "(n4) the declared nested package ui is still installed"

# ── (n5) a lockfile that does not match its package.json fails loudly ──
setup 1
LOCK_BEFORE="$(md5sum < "$d/ui/bun.lock")"
jq '.dependencies["other-dep"] = "file:../vendor/nested-dep"' "$d/ui/package.json" > "$T/pj" && mv "$T/pj" "$d/ui/package.json"
g commit -am "declare a dependency without updating the lockfile"
run
grep -q "CLONE NESTED DEPENDENCY INSTALL FAILED" "$LOG" && ok "(n5) a frozen-lockfile mismatch is logged as a failed nested install" \
  || bad "(n5) a frozen-lockfile mismatch is logged as a failed nested install"
grep -q "GAP .*pull-sync-clone-nested-deps-install-failed-$VESSEL" "$CALLS" && ok "(n5) a gap is filed" || bad "(n5) a gap is filed"
grep 'GAP .*clone-nested-deps-install-failed' "$CALLS" | grep -q 'lockfile is frozen' && ok "(n5) the gap carries bun's frozen-lockfile error" \
  || bad "(n5) the gap carries bun's frozen-lockfile error"
[ "$(ls "$RUNS"/*.out 2>/dev/null | wc -l)" = 0 ] && ok "(n5) the suite did not run" || bad "(n5) the suite did not run"
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(n5) not converged this tick" || ok "(n5) not converged this tick"
[ -e "$d/ui/node_modules/other-dep" ] && bad "(n5) the install never resolved fresh" || ok "(n5) the install never resolved fresh"
[ "$(md5sum < "$d/ui/bun.lock")" = "$LOCK_BEFORE" ] && ok "(n5) ui/bun.lock is left as committed" || bad "(n5) ui/bun.lock is left as committed"

# ── (n6) a declared nested package with no lockfile fails closed ──
setup 1
git -C "$d" rm -q ui/bun.lock >/dev/null 2>&1; g commit -m "drop the nested lockfile"
run
grep -q "GAP .*pull-sync-clone-nested-deps-install-failed-$VESSEL" "$CALLS" && ok "(n6) a declared nested package without a lockfile files a gap" \
  || bad "(n6) a declared nested package without a lockfile files a gap"
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(n6) not converged without a lockfile" || ok "(n6) not converged without a lockfile"
grep -q "^INSTALL ${d}ui " "$CALLS" && bad "(n6) no unfrozen install is attempted" || ok "(n6) no unfrozen install is attempted"

# ── (n7) the nested package's own lifecycle scripts never run ──
setup 1
jq --arg p "$T/pwned" '.scripts = {postinstall: ("echo ran > " + $p), preinstall: ("echo ran > " + $p)}' "$d/ui/package.json" > "$T/pj" && mv "$T/pj" "$d/ui/package.json"
g commit -am "a nested postinstall"
run
[ -e "$d/ui/node_modules/nested-dep/index.js" ] && ok "(n7) the nested package installed" || bad "(n7) the nested package installed"
[ -e "$T/pwned" ] && bad "(n7) the nested package's preinstall/postinstall did not run" || ok "(n7) the nested package's preinstall/postinstall did not run"

echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
