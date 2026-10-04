#!/usr/bin/env bash
# pull-sync satisfies the vessel CLONE's node_modules before its test gate, and a
# module the parent cannot resolve either makes the gate blind instead of a shared
# count (scripts/substrate/substrate-pull-sync.sh: ensure_clone_deps,
# unresolved_modules, and the "3-pre. TEST GATE" slice). Runs the script's own gate
# slice against a temp clone with `bun` stubbed: `install` records the call and
# creates the declared packages; `test` prints canned output (the parent worktree
# gets its own). No network, no root.
#
#   (a) clone node_modules lacks a declared dep -> install runs, BEFORE the suite
#   (b) up to date (marker matches) -> no install; no marker + deps present -> adopted
#   (c) install fails -> gap filed, v not converged this tick, node_modules restored,
#       the moved-aside copy never sits inside the clone
#   (h) the candidate manifest's postinstall never runs and the unit's env is not visible
#   (i) a failed manifest is not retried within the backoff (still not converged);
#       a changed manifest or an expired backoff retries
#   (d) parent AND candidate "Cannot find module" -> one gap naming it; those files are
#       excluded from the unnamed count (no refusal, no 10->11 trap) while loaded files
#       are still judged (a new attributable failure is refused); when no test file loads
#       the gate is blind and v is HELD; candidate-only load error -> not excluded
#   (e) a file: dependency whose target is missing -> no install, gap, NOT converged
#   (f) a file: dependency on a present sibling clone -> installed
#   (g) an install that rewrites the tracked bun.lock is restored
#   (j) a file: dependency whose target HEAD or built dist moved reinstalls the dependant
#       although its own package.json/bun.lock did not change, and the installed copy is
#       the target's current build (a stale directory copy is replaced, not kept);
#       unchanged target -> no reinstall; a missing marker with a file: dep -> install
#   (k) a converged shared package's clone dist is made current from the runtime build
#       (refresh_clone_dependants) and its file: dependants are refreshed; non-file:
#       clones untouched; no copy when last-good != the clone HEAD or dist is tracked;
#       a dependant (or the package itself) with a young authoring marker is skipped that
#       tick; a tick whose budget cannot fit one more install defers the rest (logged);
#       a file: spec with a trailing slash is still discovered;
#       called from the no-op branch and after a credited fan-out
#   (l) a file: dependency whose package main / exported dist is MISSING is unsatisfied: the
#       sibling clone is built (`bun run build` there, its own deps installed first) BEFORE the
#       dependant's install and the suite, the dependant's copy then carries the dist, and the
#       gate is not blind (converges, no BLIND/ENVIRONMENT line)
#   (l2) the build fails -> fail closed: a gap naming the package, no install, no suite, NOT
#       converged; a sibling with no build script fails closed the same way
#   (l3) control: a sibling that HAS its dist is not built and installs unchanged
#   (l4) an installed copy without the dist (marker current) is unsatisfied and reinstalled
#
# usage: validation/scripts/pull-sync-clone-deps.test.sh [path/to/substrate-pull-sync.sh]
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
  sed -n '/^clone_dep_missing() {/,/^}/p' "$SCRIPT"
  sed -n '/^file_dep_unbuilt() {/,/^}/p' "$SCRIPT"
  sed -n '/^build_file_dep() {/,/^}/p' "$SCRIPT"
  sed -n '/^tree_digest() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_file_deps() {/,/^}/p' "$SCRIPT"
  sed -n '/^file_dep_identity() {/,/^}/p' "$SCRIPT"
  sed -n '/^young_authoring_marker() {/,/^}/p' "$SCRIPT"
  sed -n '/^sync_clone_dist() {/,/^}/p' "$SCRIPT"
  sed -n '/^refresh_clone_dependants() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_deps_install() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_deps_gap() {/,/^}/p' "$SCRIPT"
  sed -n '/^ensure_clone_deps() {/,/^}/p' "$SCRIPT"
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
declare -F ensure_clone_deps >/dev/null || bad "ensure_clone_deps is not defined in the script"
declare -F unresolved_modules >/dev/null || bad "unresolved_modules is not defined in the script"
grep -q 'ensure_clone_deps "\$v" "\$d"' "$T/fns.sh" || bad "the test-gate slice does not call ensure_clone_deps"

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }

# bun stub: run_suite runs under `env -i`, so its knobs are files, not env vars.
mkdir -p "$T/bin" "$T/stub"
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
case "\$1" in
  install)
    echo "INSTALL \$PWD \$*" >> "$CALLS"
    echo "INSTALL-ENV \${SECRET_PROBE:-unset}" >> "$CALLS"
    ls -d node_modules.* 2>/dev/null | sed 's/^/ASIDE-IN-CLONE /' >> "$CALLS"
    case " \$* " in *" --ignore-scripts "*) ;; *) pi="\$(jq -r '.scripts.postinstall // empty' package.json)"; [ -n "\$pi" ] && sh -c "\$pi" ;; esac
    [ -f "\$S/install-dirties-lock" ] && echo "# rewritten" >> bun.lock
    [ -f "\$S/install-fails" ] && { echo "error: simulated registry failure"; exit 1; }
    mkdir -p node_modules
    jq -r '[(.dependencies // {}), (.devDependencies // {})] | add // {} | to_entries[] | "\(.key)\t\(.value)"' package.json | while IFS=\$'\t' read -r n spec; do
      case "\$spec" in file:*) [ -e "node_modules/\$n" ] || { mkdir -p "\$(dirname "node_modules/\$n")"; cp -a "\${spec#file:}" "node_modules/\$n"; } ;; *) mkdir -p "node_modules/\$n" ;; esac
    done
    exit 0 ;;
  run)
    [ "\$2" = build ] || exit 0
    echo "BUILD \$PWD" >> "$CALLS"
    [ -f "\$S/build-fails" ] && { echo "error TS2307: simulated build failure"; exit 2; }
    jq -e '.scripts.build' package.json >/dev/null 2>&1 || { echo 'error: Script not found "build"'; exit 1; }
    mkdir -p dist/adapters; echo 'exports.v = 1;' > dist/index.js; echo 'exports.a = 1;' > dist/adapters/index.js
    exit 0 ;;
  test)
    if [ -f ./.is-clone ]; then echo "TEST clone" >> "$CALLS"; cat "\$S/clone-out"
    elif [ "\$(git rev-parse HEAD)" = "\$(cat "\$S/parent-sha")" ]; then echo "TEST worktree-parent" >> "$CALLS"; cat "\$S/parent-out"
    else echo "TEST worktree-candidate" >> "$CALLS"; cat "\$S/clone-out"; fi
    exit 1 ;;
esac
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

VESSEL=demo-vessel
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; TMPDIR="$T/tmp"
d="$CLONE_DIR/$VESSEL/"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
CLEAN_OUT='(pass) a > works
 5 pass
 0 fail'
LOADERR_OUT="# Unhandled error between tests
error: Cannot find module '@avigopal/ias-executor-ts' from '/x/src/index.ts'
(pass) a > works
 5 pass
 1 fail
 1 errors"

setup() { # $1 = dependencies JSON object
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/tmp" "$T/stub"/*
  mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$TMPDIR"
  printf '{"name":"demo","dependencies":%s,"devDependencies":{"typescript":"5.0.0"}}\n' "$1" > "$d/package.json"
  echo 'lockfileVersion = 1' > "$d/bun.lock"
  echo 'export const x = 1;' > "$d/src/x.ts"
  printf 'node_modules\nnode_modules.pullsync-prev\n.is-clone\n' > "$d/.gitignore"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$T/stub/parent-sha"
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am change
  touch "$d/.is-clone"
  mkdir -p "$d/node_modules/typescript"
  printf '%s\n' "$CLEAN_OUT" > "$T/stub/clone-out"; printf '%s\n' "$CLEAN_OUT" > "$T/stub/parent-out"
  : > "$CALLS"; : > "$LOG"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0 CLONE_DEPS_RETRY_BACKOFF_SECONDS
}
run() { HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate; }
line_of() { grep -n "$1" "$CALLS" | head -1 | cut -d: -f1; }

# ── (a) a declared dependency is missing from the clone ────────────────────────
setup '{"left-pad":"1.0.0"}'
run
I="$(line_of '^INSTALL')"; S="$(line_of '^TEST clone')"
[ -n "$I" ] && ok "(a) bun install ran in the clone" || bad "(a) no install although left-pad is missing from node_modules"
grep -q "^INSTALL ${d%/} install --silent --no-save" "$CALLS" && ok "(a) install runs in the clone dir with --silent --no-save" || bad "(a) install not run in the clone with --silent --no-save: $(grep '^INSTALL' "$CALLS")"
[ -n "$I" ] && [ -n "$S" ] && [ "$I" -lt "$S" ] && ok "(a) install precedes the suite" || bad "(a) install did not precede the suite (install=$I suite=$S)"
[ -d "$d/node_modules/left-pad" ] && ok "(a) the dependency is present afterwards" || bad "(a) dependency still missing"
[ -s "$MARKER_DIR/$VESSEL.clone-deps" ] && ok "(a) the clone-deps marker is recorded" || bad "(a) no clone-deps marker"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(a) converges" || bad "(a) did not converge"

# ── (b) up to date: no install ─────────────────────────────────────────────────
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/left-pad"
cat "$d/package.json" "$d/bun.lock" | md5sum | cut -d' ' -f1 > "$MARKER_DIR/$VESSEL.clone-deps"
run
grep -q '^INSTALL' "$CALLS" && bad "(b) installed although node_modules satisfies the manifest" || ok "(b) up-to-date clone: no install"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(b) converges" || bad "(b) did not converge"
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/left-pad"
run
grep -q '^INSTALL' "$CALLS" && bad "(b2) a missing marker with every dep present triggered a reinstall" || ok "(b2) missing marker + deps present: adopted, no install"
[ -s "$MARKER_DIR/$VESSEL.clone-deps" ] && ok "(b2) marker adopted" || bad "(b2) marker not written on adoption"
# manifest change since the last install -> install
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/left-pad"; echo stale-hash > "$MARKER_DIR/$VESSEL.clone-deps"
run
grep -q '^INSTALL' "$CALLS" && ok "(b3) package.json/bun.lock changed since the last install: installs" || bad "(b3) manifest change did not trigger an install"

# ── (c) install fails: gap, no convergence ─────────────────────────────────────
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/keepme"; touch "$T/stub/install-fails"
run
grep -q 'GAP .*pull-sync-clone-deps-install-failed-demo-vessel' "$CALLS" && ok "(c) install failure files a gap" || bad "(c) install failure filed no gap"
grep -q "^CONVERGED" "$CALLS" && bad "(c) converged although the clone install failed" || ok "(c) no convergence this tick"
grep -q '^TEST' "$CALLS" && bad "(c) the suite ran over an unsatisfied node_modules" || ok "(c) the suite did not run"
[ "$skipped" = 1 ] && ok "(c) counted as skipped" || bad "(c) skipped=$skipped"
[ -d "$d/node_modules/keepme" ] && ok "(c) the previous node_modules is restored after a failed clean retry" || bad "(c) the working node_modules was destroyed"
grep -q 'simulated registry failure' "$CALLS" && ok "(c) the gap carries the install output" || bad "(c) the gap does not carry the install error"
[ "$(grep -c '^INSTALL ' "$CALLS")" = 2 ] && ok "(c) in-place then one clean retry" || bad "(c) install calls: $(grep -c '^INSTALL ' "$CALLS")"
grep -q '^ASIDE-IN-CLONE' "$CALLS" && bad "(c) the moved-aside node_modules sat inside the clone during the retry" || ok "(c) the moved-aside node_modules is outside the clone"
ls -d "$d"node_modules.* >/dev/null 2>&1 && bad "(c) a node_modules.* leftover is in the clone" || ok "(c) no node_modules.* leftover in the clone"

# ── (h) M1: the candidate manifest's lifecycle scripts never run, env is scrubbed ─
setup '{"left-pad":"1.0.0"}'
python3 - "$d/package.json" "$T/pwned" <<'PY'
import json,sys; p=json.load(open(sys.argv[1])); p["scripts"]={"postinstall":"echo ${SECRET_PROBE:-unset} > %s" % sys.argv[2]}; json.dump(p,open(sys.argv[1],"w"))
PY
g commit -am postinstall; git -C "$d" rev-parse HEAD~1 > "$T/stub/parent-sha"
export SECRET_PROBE=leaked-secret
run
unset SECRET_PROBE
grep -q '^INSTALL ' "$CALLS" && ok "(h) install ran" || bad "(h) install did not run"
[ -e "$T/pwned" ] && bad "(h) the candidate's postinstall RAN pre-gate (wrote $(cat "$T/pwned"))" || ok "(h) the candidate's postinstall did not run"
grep -q '^INSTALL .*--ignore-scripts' "$CALLS" && ok "(h) install passes --ignore-scripts" || bad "(h) install without --ignore-scripts"
grep -q '^INSTALL-ENV unset' "$CALLS" && ok "(h) the unit's environment is not visible to the install" || bad "(h) install saw the unit env: $(grep '^INSTALL-ENV' "$CALLS")"
rm -f "$T/pwned"

# ── (i) M2: a failed manifest backs off ────────────────────────────────────────
setup '{"left-pad":"1.0.0"}'
touch "$T/stub/install-fails"
run; : > "$CALLS"; : > "$LOG"; skipped=0
run
grep -q '^INSTALL ' "$CALLS" && bad "(i) the same failed manifest was retried within the backoff" || ok "(i) same failed manifest: no install within the backoff"
grep -q 'install suppressed (same manifest failed at' "$LOG" && ok "(i) suppression is logged" || bad "(i) no 'install suppressed' log line"
grep -q '^CONVERGED' "$CALLS" && bad "(i) converged while suppressed" || ok "(i) still not converged while suppressed"
[ "$skipped" = 1 ] && ok "(i) counted as skipped" || bad "(i) skipped=$skipped"
: > "$CALLS"; CLONE_DEPS_RETRY_BACKOFF_SECONDS=0 run
grep -q '^INSTALL ' "$CALLS" && ok "(i) an expired backoff retries" || bad "(i) no retry after the backoff expired"
: > "$CALLS"; unset CLONE_DEPS_RETRY_BACKOFF_SECONDS
echo '# changed' >> "$d/bun.lock"
run
grep -q '^INSTALL ' "$CALLS" && ok "(i) a changed bun.lock retries" || bad "(i) no retry after the manifest changed"

# ── (d) unresolvable module at parent AND candidate: excluded, not a shared count ─
# The hub trap: the stored baseline carried load failures as a count; a new test file
# importing the same unresolvable module raised it and a correct commit was refused.
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/left-pad"
printf '%s\n' "$LOADERR_OUT" > "$T/stub/clone-out"; printf '%s\n' "$LOADERR_OUT" > "$T/stub/parent-out"
printf '(fail) old > one\n' > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
run
N="$(grep -c 'GAP .*pull-sync-testgate-unresolvable-modules-demo-vessel' "$CALLS")"
[ "$N" = 1 ] && ok "(d) exactly one unresolvable-modules gap" || bad "(d) unresolvable-modules gaps filed: $N"
grep 'GAP .*unresolvable-modules' "$CALLS" | grep -q '@avigopal/ias-executor-ts' && ok "(d) the gap names the module" || bad "(d) the gap does not name the module"
grep -q '^TEST worktree-parent' "$CALLS" && ok "(d) the parent was measured under identical conditions" || bad "(d) the parent was not measured"
grep -q 'pull-sync-test-regression' "$CALLS" && bad "(d) a shared load failure was charged to the commit (refused)" || ok "(d) no refusal for a load failure the parent shares"
grep -q 'TEST GATE BLIND' "$LOG" && bad "(d) went fully blind although tests loaded" || ok "(d) not blind: files that loaded are still gated"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(d) converges" || bad "(d) did not converge"
[ "$(awk '{print $3}' "$TEST_BASELINE_DIR/$VESSEL")" = 0 ] && ok "(d) excluded load failures are not written into the baseline's unnamed count" || bad "(d) baseline unnamed count: $(cat "$TEST_BASELINE_DIR/$VESSEL")"
# shared load failure + a NEW named failure attributable to the commit -> still refused
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/left-pad"
printf '%s\n(fail) new > broke\n 5 pass\n 2 fail\n' "$(printf '%s\n' "$LOADERR_OUT" | grep -vE '^ *[0-9]+ (pass|fail|errors)')" > "$T/stub/clone-out"
printf '%s\n' "$LOADERR_OUT" > "$T/stub/parent-out"
printf '(fail) old > one\n' > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
run
grep -q 'GAP .*pull-sync-test-regression-demo-vessel' "$CALLS" && ok "(d3) a new attributable failure in a loaded file is still refused" || bad "(d3) the loaded files were not judged"
grep -q "^CONVERGED" "$CALLS" && bad "(d3) converged over an attributable regression" || ok "(d3) not converged"
# no test file loads at all -> blind: HELD (environment gap), baseline untouched
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/left-pad"
NOLOAD="error: Cannot find module '@avigopal/ias-executor-ts' from '/x/src/index.ts'
error: Cannot find module '@avigopal/ias-executor-ts' from '/x/src/index.ts'
 0 pass
 2 fail"
printf '%s\n' "$NOLOAD" > "$T/stub/clone-out"; printf '%s\n' "$NOLOAD" > "$T/stub/parent-out"
printf '(fail) old > one\n' > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
run
grep -q 'TEST GATE BLIND' "$LOG" && ok "(d4) nothing loads: logged blind" || bad "(d4) nothing loaded but not blind"
grep -q 'GAP .*pull-sync-testgate-environment-' "$CALLS" && ok "(d4) the environment gap is filed" || bad "(d4) no environment gap"
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(d4) a gate that measured nothing converged (ungated)" || ok "(d4) held, not converged: a gate that did not measure never promotes"
[ "$(cat "$TEST_BASELINE_DIR/$VESSEL")" = "1 5 0" ] && ok "(d4) baseline untouched" || bad "(d4) baseline rewritten: $(cat "$TEST_BASELINE_DIR/$VESSEL")"
# candidate-only: the commit introduced it -> not excluded
setup '{"left-pad":"1.0.0"}'
mkdir -p "$d/node_modules/left-pad"
printf '%s\n' "$LOADERR_OUT" > "$T/stub/clone-out"
run
grep -q 'unresolvable-modules' "$CALLS" && bad "(d2) a candidate-only load error was excluded" || ok "(d2) candidate-only load error is not excluded (the gates judge the commit)"

# ── (e) M3: file: dependency whose target is missing -> fail closed ────────────
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
run
grep -q '^INSTALL' "$CALLS" && bad "(e) installed against a missing file: target" || ok "(e) no install against a missing file: target"
grep -q 'GAP .*pull-sync-clone-dep-target-missing-demo-vessel' "$CALLS" && ok "(e) gap filed for the missing target" || bad "(e) no gap for the missing file: target"
grep -q '^TEST' "$CALLS" && bad "(e) the suite ran" || ok "(e) suite not run"
grep -q "^CONVERGED" "$CALLS" && bad "(e) converged ungated over an unsatisfiable manifest" || ok "(e) fail closed: not converged"
[ "$skipped" = 1 ] && ok "(e) counted as skipped" || bad "(e) skipped=$skipped"

# ── (f) file: dependency on a present sibling clone ────────────────────────────
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
mkdir -p "$CLONE_DIR/ias-executor-ts"
run
grep -q '^INSTALL' "$CALLS" && ok "(f) present sibling clone: installs" || bad "(f) no install although the sibling exists"
grep -q 'target-missing' "$CALLS" && bad "(f) filed target-missing for a present sibling" || ok "(f) no target-missing gap"

# ── (g) a lockfile rewrite by the install is restored ──────────────────────────
setup '{"left-pad":"1.0.0"}'
touch "$T/stub/install-dirties-lock"
run
[ -z "$(git -C "$d" status --porcelain -- bun.lock package.json)" ] && ok "(g) tracked bun.lock restored after install" || bad "(g) clone left dirty: $(git -C "$d" status --porcelain)"

# ── (j) a file: dependency's target moved: reinstall although the manifest did not ─
# Measured 2026-10-03: goal-host's clone held a directory copy of ias-executor-ts from
# August while the sibling clone had moved on, because the marker hashed only the
# dependant's own package.json/bun.lock.
DEP="$CLONE_DIR/ias-executor-ts"
mk_dep() { # build a sibling clone with a committed src and an untracked dist
  mkdir -p "$DEP/src" "$DEP/dist"
  printf '{"name":"@avigopal/ias-executor-ts","version":"0.1.1","main":"./dist/index.js","scripts":{"build":"tsc"}}\n' > "$DEP/package.json"
  printf 'dist/\nnode_modules/\n' > "$DEP/.gitignore"
  echo 'export const v = 1;' > "$DEP/src/index.ts"; echo 'exports.v = 1;' > "$DEP/dist/index.js"
  git -C "$DEP" init -q -b dev; git -C "$DEP" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$DEP" -c user.name=t -c user.email=t@t commit -qm base
}
IDX="$d/node_modules/@avigopal/ias-executor-ts/dist/index.js"
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
mk_dep
run
grep -q '^INSTALL' "$CALLS" && ok "(j0) first install with a file: dependency" || bad "(j0) no first install"
: > "$CALLS"; : > "$LOG"
run
grep -q '^INSTALL' "$CALLS" && bad "(j1) control: unchanged file: dependency reinstalled" || ok "(j1) control: unchanged file: dependency -> no reinstall"
# the dependency's dist is rebuilt (HEAD unchanged): dependant's manifest is untouched
echo 'exports.v = 2; exports.consumedProvenance = 1;' > "$DEP/dist/index.js"
: > "$CALLS"; : > "$LOG"
run
grep -q '^INSTALL' "$CALLS" && ok "(j2) a rebuilt file: dependency dist triggers a reinstall" || bad "(j2) rebuilt file: dependency dist did NOT trigger a reinstall (manifest-only marker)"
grep -q consumedProvenance "$IDX" 2>/dev/null && ok "(j2) the installed copy is the current build (stale copy replaced)" || bad "(j2) the installed copy is still stale: $(cat "$IDX" 2>/dev/null)"
[ -z "$(git -C "$d" status --porcelain -- package.json bun.lock)" ] && ok "(j2) dependant manifest unchanged" || bad "(j2) dependant manifest modified"
# the dependency's HEAD moves (dist not yet rebuilt)
echo 'export const v = 3;' > "$DEP/src/index.ts"; git -C "$DEP" -c user.name=t -c user.email=t@t commit -qam move
: > "$CALLS"; : > "$LOG"
run
grep -q '^INSTALL' "$CALLS" && ok "(j3) a moved file: dependency HEAD triggers a reinstall" || bad "(j3) moved file: dependency HEAD did NOT trigger a reinstall"
: > "$CALLS"; : > "$LOG"
run
grep -q '^INSTALL' "$CALLS" && bad "(j4) control: reinstalled again with nothing changed" || ok "(j4) control: settled after the reinstall"
# a stale directory copy and NO marker: cannot be dated, so it is reinstalled, not adopted
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
mk_dep; mkdir -p "$(dirname "$IDX")"; echo 'exports.v = 0; // august' > "$IDX"
run
grep -q '^INSTALL' "$CALLS" && ok "(j5) missing marker + file: dependency: installs (a copy cannot be dated)" || bad "(j5) a stale file: copy was adopted without a marker"
grep -q 'exports.v = 1' "$IDX" 2>/dev/null && ok "(j5) the stale copy was replaced" || bad "(j5) stale copy kept: $(cat "$IDX" 2>/dev/null)"

# ── (k) the shared package's CLONE dist follows its runtime build ──────────────
RUNTIME_DIR="$T/runtime"; LAST_GOOD_DIR="$T/lastgood"
vessel_unit() { :; }
k_setup() {
  setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
  rm -rf "$RUNTIME_DIR" "$LAST_GOOD_DIR"; mkdir -p "$RUNTIME_DIR/ias-executor-ts/dist" "$LAST_GOOD_DIR"
  mk_dep
  cp "$DEP/package.json" "$RUNTIME_DIR/ias-executor-ts/package.json"
  echo 'exports.v = 9; exports.consumedProvenance = 1;' > "$RUNTIME_DIR/ias-executor-ts/dist/index.js"
  git -C "$DEP" rev-parse HEAD > "$LAST_GOOD_DIR/ias-executor-ts"
  # an unrelated clone with no file: dependency, deliberately unsatisfied
  mkdir -p "$CLONE_DIR/other-vessel"; printf '{"name":"o","dependencies":{"left-pad":"1.0.0"}}\n' > "$CLONE_DIR/other-vessel/package.json"
  # demo-vessel already installed against the OLD dist
  run; : > "$CALLS"; : > "$LOG"
}
if declare -F refresh_clone_dependants >/dev/null; then
  k_setup
  refresh_clone_dependants ias-executor-ts "$DEP/"
  cmp -s "$DEP/dist/index.js" "$RUNTIME_DIR/ias-executor-ts/dist/index.js" && ok "(k1) clone dist made current from the runtime build" || bad "(k1) clone dist still stale: $(cat "$DEP/dist/index.js")"
  grep -q "^INSTALL ${CLONE_DIR}/demo-vessel " "$CALLS" && ok "(k1) the file: dependant's clone was reinstalled" || bad "(k1) dependant not reinstalled: $(cat "$CALLS")"
  grep -q consumedProvenance "$IDX" 2>/dev/null && ok "(k1) the dependant resolves the current build" || bad "(k1) dependant still resolves stale: $(cat "$IDX" 2>/dev/null)"
  grep -q "^INSTALL ${CLONE_DIR}/other-vessel" "$CALLS" && bad "(k2) a clone with no file: dependency on the package was touched" || ok "(k2) control: non-file: clone untouched"
  [ -z "$(git -C "$DEP" status --porcelain)" ] && ok "(k1) the package clone's tree stays clean (dist ignored, no stage left)" || bad "(k1) package clone dirty: $(git -C "$DEP" status --porcelain)"
  : > "$CALLS"
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q '^INSTALL' "$CALLS" && bad "(k3) control: an already-current dist reinstalled dependants" || ok "(k3) control: current dist -> no reinstall"
  # (k8) budget: an exhausted tick installs nothing and says so; with budget left it refreshes
  k_setup; GATE_T0=$(( $(date +%s) - 10000 ))
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q '^INSTALL' "$CALLS" && bad "(k8) installed with the tick budget exhausted" || ok "(k8) budget exhausted: no install"
  grep -q 'ias-executor-ts: clone dependant refresh deferred to next tick — tick budget left' "$LOG" && ok "(k8) deferral logged" || bad "(k8) no deferral log: $(cat "$LOG")"
  GATE_T0=$(date +%s); : > "$LOG"
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q "^INSTALL ${CLONE_DIR}/demo-vessel " "$CALLS" && ok "(k8) control: budget left -> refreshed" || bad "(k8) not refreshed with budget left"
  grep -q 'deferred to next tick' "$LOG" && bad "(k8) deferred with budget left" || ok "(k8) control: no deferral with budget left"
  unset GATE_T0
  # (k9) a trailing slash in the file: spec is still a dependant
  k_setup
  printf '{"name":"slash","dependencies":{"@avigopal/ias-executor-ts":"file:../ias-executor-ts/"}}\n' > "$CLONE_DIR/slash-vessel/package.json" 2>/dev/null \
    || { mkdir -p "$CLONE_DIR/slash-vessel"; printf '{"name":"slash","dependencies":{"@avigopal/ias-executor-ts":"file:../ias-executor-ts/"}}\n' > "$CLONE_DIR/slash-vessel/package.json"; }
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q "^INSTALL ${CLONE_DIR}/slash-vessel " "$CALLS" && ok "(k9) file:../pkg/ (trailing slash) is discovered" || bad "(k9) trailing-slash dependant missed"
  rm -rf "$CLONE_DIR/slash-vessel"
  # (k10) a live authoring marker on the PACKAGE itself: its clone dist is not swapped
  k_setup; AUTHORING_MARKER_DIR="$T/authoring"; mkdir -p "$AUTHORING_MARKER_DIR"
  echo '{"pid":1}' > "$AUTHORING_MARKER_DIR/feature_compose-ias-executor-ts.json"
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q 'exports.v = 1' "$DEP/dist/index.js" && ok "(k10) live marker on the package: clone dist not swapped" || bad "(k10) swapped the package dist under a live draft"
  grep -q '^INSTALL' "$CALLS" && bad "(k10) dependants refreshed although the dist was held" || ok "(k10) no dependant install while held"
  rm -f "$AUTHORING_MARKER_DIR"/*.json
  refresh_clone_dependants ias-executor-ts "$DEP/"
  cmp -s "$DEP/dist/index.js" "$RUNTIME_DIR/ias-executor-ts/dist/index.js" && ok "(k10) marker gone: swapped on the next call" || bad "(k10) not swapped once the marker cleared"
  # a dependant with a young authoring marker is not refreshed under its draft
  k_setup; AUTHORING_MARKER_DIR="$T/authoring"; mkdir -p "$AUTHORING_MARKER_DIR"
  echo '{"pid":1}' > "$AUTHORING_MARKER_DIR/feature_compose-demo-vessel.json"
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q '^INSTALL' "$CALLS" && bad "(k7) reinstalled a dependant under a live authoring marker" || ok "(k7) live authoring marker on the dependant: not reinstalled this tick"
  rm -f "$AUTHORING_MARKER_DIR"/*.json
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q "^INSTALL ${CLONE_DIR}/demo-vessel " "$CALLS" && ok "(k7) marker gone: refreshed on the next call" || bad "(k7) not refreshed once the marker cleared"
  # last-good != clone HEAD: the runtime dist is not the clone's build -> no copy
  k_setup; echo stale-head > "$LAST_GOOD_DIR/ias-executor-ts"
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q 'exports.v = 1' "$DEP/dist/index.js" && ok "(k4) last-good != clone HEAD: clone dist not overwritten" || bad "(k4) copied a runtime dist built from another HEAD"
  # a tracked dist belongs to git
  k_setup; git -C "$DEP" -c user.name=t -c user.email=t@t add -f dist >/dev/null; git -C "$DEP" -c user.name=t -c user.email=t@t commit -qm track
  git -C "$DEP" rev-parse HEAD > "$LAST_GOOD_DIR/ias-executor-ts"
  refresh_clone_dependants ias-executor-ts "$DEP/"
  grep -q 'exports.v = 1' "$DEP/dist/index.js" && ok "(k5) tracked dist: left to git" || bad "(k5) overwrote a tracked dist"
else
  bad "(k) refresh_clone_dependants is not defined in the script"
fi
NOOP="$(awk '/^  if \[ "\$CLONE_HASH" = "\$RUNTIME_HASH" \]; then/{on=1} on{print} on && /re-running fan-out/{exit}' "$SCRIPT")"
printf '%s' "$NOOP" | grep -q 'refresh_clone_dependants "\$v" "\$d"' && ok "(k6) called from the no-op (already converged) branch" || bad "(k6) not called from the no-op branch"
grep -B2 -A2 'echo "\$HEAD" > "\$LAST_GOOD_DIR/\$v"; rm -f "\$MARKER_DIR/\$v.fanout-fail"; log "\$v: fan-out healthy' "$SCRIPT" | grep -q 'refresh_clone_dependants "\$v" "\$d"' && ok "(k6) called after a credited fan-out" || bad "(k6) not called after a credited fan-out"


# ── (l) a file: dependency with no built output is built before the gate ──────
UB="$CLONE_DIR/ias-executor-ts"
mk_unbuilt() { # a sibling clone whose dist (main + ./adapters export) is untracked and absent
  rm -rf "$UB"; mkdir -p "$UB/src"
  printf '%s\n' '{"name":"@avigopal/ias-executor-ts","version":"0.1.1","main":"./dist/index.js","exports":{".":{"types":"./dist/index.d.ts","import":"./dist/index.js"},"./adapters":{"import":"./dist/adapters/index.js"}},"scripts":{"build":"tsc"},"devDependencies":{"typescript":"5.0.0"}}' > "$UB/package.json"
  [ "${1:-}" = nobuild ] && jq 'del(.scripts)' "$UB/package.json" > "$UB/p.json" && mv "$UB/p.json" "$UB/package.json"
  printf 'dist/\nnode_modules/\n' > "$UB/.gitignore"; echo 'export const v = 1;' > "$UB/src/index.ts"
  git -C "$UB" init -q -b dev; git -C "$UB" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$UB" -c user.name=t -c user.email=t@t commit -qm base
}
ADP="$d/node_modules/@avigopal/ias-executor-ts/dist/adapters/index.js"
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
mk_unbuilt
run
grep -q "^BUILD $UB\$" "$CALLS" && ok "(l) the unbuilt sibling is built in its clone" || bad "(l) the sibling with no dist was not built (calls: $(tr '\n' ' ' < "$CALLS" | cut -c1-300))"
grep -q "^INSTALL $UB " "$CALLS" && [ "$(line_of "^INSTALL $UB ")" -lt "$(line_of '^BUILD')" ] && ok "(l) the sibling's own dependencies are installed before its build" || bad "(l) the sibling's dependencies were not installed before its build"
[ -n "$(line_of '^BUILD')" ] && [ "$(line_of '^BUILD')" -lt "$(line_of "^INSTALL ${d%/} ")" ] && [ "$(line_of "^INSTALL ${d%/} ")" -lt "$(line_of '^TEST')" ] \
  && ok "(l) build, then the dependant's install, then the suite" || bad "(l) order is not build < dependant install < suite (calls: $(tr '\n' ' ' < "$CALLS" | cut -c1-300))"
[ -s "$ADP" ] && ok "(l) the dependant's copy carries dist/adapters" || bad "(l) the dependant's copy has no dist/adapters/index.js"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ! grep -q 'TEST GATE BLIND' "$LOG" && ok "(l) the gate is not blind: converged" || bad "(l) not converged, or the gate was blind (log: $(grep -a 'BLIND\|UNBUILT\|unbuilt\|FAILED' "$LOG" | tr '\n' '|' | cut -c1-300))"
grep -q 'clone-dep-unbuilt' "$CALLS" && bad "(l) an unbuilt gap although the build succeeded" || ok "(l) no unbuilt gap"
# ── (l2) the build fails: fail closed with a gap naming the package ──
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
mk_unbuilt; touch "$T/stub/build-fails"
run
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(l2) converged over an unbuilt file: dependency" || ok "(l2) build failed: not converged"
grep -q '^TEST' "$CALLS" && bad "(l2) the suite ran over an unbuilt dependency" || ok "(l2) no suite over an unbuilt dependency"
grep 'GAP .*clone-dep-unbuilt' "$CALLS" | grep -q '@avigopal/ias-executor-ts' && ok "(l2) a gap names the package" || bad "(l2) no clone-dep-unbuilt gap naming @avigopal/ias-executor-ts (calls: $(grep -a '^GAP' "$CALLS" | cut -c1-200))"
grep -q "^INSTALL ${d%/} " "$CALLS" && bad "(l2) the dependant was installed with an empty copy" || ok "(l2) the dependant was not installed with an empty copy"
rm -f "$T/stub/build-fails"
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
mk_unbuilt nobuild
run
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(l2) converged over a sibling with no build script" || ok "(l2) no build script: not converged"
grep -q 'GAP .*clone-dep-unbuilt' "$CALLS" && ok "(l2) no build script: gap filed" || bad "(l2) no build script: no gap"
# ── (l3) control: the sibling has its dist ──
setup '{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}'
mk_unbuilt; mkdir -p "$UB/dist/adapters"; echo 'exports.v = 1;' > "$UB/dist/index.js"; echo 'exports.a = 1;' > "$UB/dist/adapters/index.js"; echo 'export {};' > "$UB/dist/index.d.ts"
run
grep -q '^BUILD' "$CALLS" && bad "(l3) a built sibling was rebuilt" || ok "(l3) control: a built sibling is not rebuilt"
grep -q "^INSTALL ${d%/} " "$CALLS" && grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(l3) control: installs and converges as before" || bad "(l3) control: no install or no convergence"
# ── (l4) the installed copy lost its dist while the marker is current ──
: > "$CALLS"; : > "$LOG"
rm -rf "$d/node_modules/@avigopal/ias-executor-ts/dist"
run
grep -q "^INSTALL ${d%/} " "$CALLS" && ok "(l4) a copy without its dist is unsatisfied: reinstalled" || bad "(l4) a copy without its dist was accepted (no reinstall)"
[ -s "$ADP" ] && ok "(l4) the reinstalled copy carries the dist" || bad "(l4) the copy still has no dist"
echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
