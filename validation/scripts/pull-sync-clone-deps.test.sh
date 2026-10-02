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
#       are still judged (a new attributable failure is refused); blind and ungated only
#       when no test file loads; candidate-only load error -> not excluded
#   (e) a file: dependency whose target is missing -> no install, gap, NOT converged
#   (f) a file: dependency on a present sibling clone -> installed
#   (g) an install that rewrites the tracked bun.lock is restored
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
  sed -n '/^clone_deps_install() {/,/^}/p' "$SCRIPT"
  sed -n '/^clone_deps_gap() {/,/^}/p' "$SCRIPT"
  sed -n '/^ensure_clone_deps() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
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
    jq -r '[(.dependencies // {}), (.devDependencies // {})] | add // {} | keys[]' package.json | while read -r n; do mkdir -p "node_modules/\$n"; done
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
# no test file loads at all -> blind, ungated, baseline untouched
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
grep -q 'GAP .*unresolvable-modules' "$CALLS" && ok "(d4) gap filed" || bad "(d4) no gap"
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(d4) converges ungated" || bad "(d4) did not converge"
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

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
