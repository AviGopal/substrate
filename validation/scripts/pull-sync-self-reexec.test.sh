#!/usr/bin/env bash
# The tick that pulls a commit runs that commit's pull-sync (scripts/substrate/
# substrate-pull-sync.sh, SELF-CONVERGE FIRST), and converge_units refuses a unit whose
# required EnvironmentFile is absent. Gap: pull-sync-converges-new-units-before-the-new-
# script-renders-the-files-they-require.
#
# Replays 10-02 / 3b7b31b9: the INSTALLED pull-sync is an OLD one (the script under
# test with its secret renderer cut out); the super-repo's origin is one commit ahead
# with the NEW pull-sync (the script under test), a render-secret-scope.sh that writes
# env.d/new.env, and units/new.service, which loads that file without '-'. Runs the
# WHOLE script (fixed paths rewritten to temp dirs; systemctl and curl stubbed to
# record calls) from the installed path, as systemd does.
#
#   replay      one tick: the old script installs the new one and re-executes on it;
#               the new script renders new.env and installs new.service
#   no re-exec  PULLSYNC_REEXECED=1 preset (the old behaviour: the tick finishes on the
#               old code): new.service is REFUSED (not installed, logged, gap filed with
#               a stable id), an optional ('-') EnvironmentFile unit still installs
#   no loop     an `install` that never writes a byte-identical copy: the tick
#               re-executes exactly once, says it will not again, and terminates
#   hold        SUBSTRATE_UPDATE_CHANNEL=hold: no fetch, no self-update, no re-exec,
#               no unit
#
# usage: validation/scripts/pull-sync-self-reexec.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq. No root, no live state: every path is a temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
show() { sed 's/^/    /' "$T/out.txt" | tail -25; }

# ── NEW = the script under test with its fixed paths moved into the temp tree ──
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" \
    -e "s#/usr/lib/systemd/system#$T/unit#g" -e "s#/etc/substrate#$T/etc#g" \
    -e "s#/workspace#$T/ws#g" "$SCRIPT" > "$T/new.sh"
# OLD = the same, without the secret renderer (what the node ran before 3b7b31b9)
sed -e 's#^  _cu_rss="\$_cu_root/scripts/substrate/render-secret-scope.sh"$#  _cu_rss=/nonexistent/render-secret-scope.sh#' "$T/new.sh" > "$T/old.sh"
cmp -s "$T/new.sh" "$T/old.sh" && { echo "FAIL - could not derive the OLD script (renderer line not found)"; exit 1; }

# ── stubs ───────────────────────────────────────────────────────────────────────
mkdir -p "$T/stub" "$T/mangle"
CALLS="$T/calls.txt"
cat > "$T/stub/systemctl" <<EOF
#!/usr/bin/env bash
echo "systemctl \$*" >> "$CALLS"
case "\$1" in is-active) exit 3 ;; is-enabled) echo enabled ;; esac
exit 0
EOF
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
echo "curl \$*" >> "$CALLS"
exit 7
EOF
# The no-loop leg: an install that never lands a byte-identical pull-sync.
REAL_INSTALL="$(type -P install)"
cat > "$T/mangle/install" <<EOF
#!/usr/bin/env bash
"$REAL_INSTALL" "\$@" || exit \$?
case "\${@: -1}" in *substrate-pull-sync.new) echo '# mangled by the test install' >> "\${@: -1}" ;; esac
EOF
chmod +x "$T/stub/"* "$T/mangle/install"

# ── fixture: the super-repo one commit behind its origin ────────────────────────
setup() {
  rm -rf "$T/ws" "$T/o" "$T/seed" "$T/bin" "$T/unit" "$T/etc" "$T/share"; : > "$CALLS"
  mkdir -p "$T/ws/git/vessels" "$T/ws/.last-good" "$T/ws/.pull-sync" "$T/rt" "$T/o" "$T/bin" "$T/unit" "$T/etc" "$T/share"
  # The image ships the tracked-red predicate (Dockerfile.substrate: scripts/substrate/lib/ -> share/lib);
  # without it every tick is a TRACKED-RED LIB MISSING no-op (pull-sync-gtr-lib-missing.test.sh).
  mkdir -p "$T/share/lib" && cp "$(dirname "$SCRIPT")/lib/gap-tracked-red.sh" "$T/share/lib/"
  echo 'SHARED=1' > "$T/etc/env"   # the render precondition: this node has a shared env
  git init -q --bare "$T/o/super.git"; git -C "$T/o/super.git" symbolic-ref HEAD refs/heads/dev
  mkdir -p "$T/seed/super/scripts/substrate/units"
  cp "$T/old.sh" "$T/seed/super/scripts/substrate/substrate-pull-sync.sh"
  git -C "$T/seed/super" init -q -b dev; g "$T/seed/super" add -A; g "$T/seed/super" commit -m base
  g "$T/seed/super" remote add origin "$T/o/super.git"; g "$T/seed/super" push origin dev
  SBASE="$(git -C "$T/seed/super" rev-parse HEAD)"
  git clone -q --branch dev "$T/o/super.git" "$T/ws/git/super-repo"
  # The base is already converged (no first-convergence "all" refresh in this test).
  echo "$SBASE" > "$T/ws/.pull-sync/super-repo.sha"
  # origin advances: the new pull-sync, its renderer, a consumer unit and an optional one
  cp "$T/new.sh" "$T/seed/super/scripts/substrate/substrate-pull-sync.sh"
  cat > "$T/seed/super/scripts/substrate/render-secret-scope.sh" <<'EOF'
#!/usr/bin/env bash
d=""; while [ $# -gt 0 ]; do [ "$1" = --env-dir ] && d="$2"; shift; done
mkdir -p "$d/env.d" && : > "$d/env.d/new.env"
EOF
  printf '[Unit]\nDescription=new consumer\n[Service]\nEnvironmentFile=%s\nEnvironmentFile=%s\nExecStart=/bin/true\n' \
    "$T/etc/env" "$T/etc/env.d/new.env" > "$T/seed/super/scripts/substrate/units/new.service"
  printf '[Unit]\nDescription=optional\n[Service]\nEnvironmentFile=-%s\nExecStart=/bin/true\n' \
    "$T/etc/env.d/optional.env" > "$T/seed/super/scripts/substrate/units/optional.service"
  g "$T/seed/super" add -A; g "$T/seed/super" commit -m advance; g "$T/seed/super" push origin dev
  SNEW="$(git -C "$T/seed/super" rev-parse HEAD)"
  # the node runs the OLD pull-sync, installed where systemd's ExecStart names it
  install -m 0755 "$T/old.sh" "$T/bin/substrate-pull-sync"
}
run() { # extra-path [VAR=value ...]
  local pre="$1"; shift
  ( unset SUBSTRATE_UPDATE_CHANNEL PULLSYNC_REEXECED PULLSYNC_T0 PULLSYNC_SUPER_FETCH_OK
    env PATH="$pre$T/stub:$PATH" MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" \
      SUPER_REPO_DIR="$T/ws/git/super-repo" STAGGER_SECONDS=0 GATE_BUDGET_SECONDS=0 DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 \
      "$@" timeout 120 bash "$T/bin/substrate-pull-sync" > "$T/out.txt" 2>&1 ); RC=$?
}
GAP_ID='pull-sync-unit-envfile-missing-new-service'

# ── replay: one tick converges on the new script ────────────────────────────────
setup; run ""
[ "$RC" = 0 ] && ok "replay: exits 0" || { bad "replay: exit $RC"; show; }
[ "$(git -C "$T/ws/git/super-repo" rev-parse HEAD)" = "$SNEW" ] && ok "replay: the super-repo clone advanced" || bad "replay: the super-repo clone did not advance"
[ "$(grep -c 're-executing this tick' "$T/out.txt")" = 1 ] && ok "replay: the tick re-executed on the pulled pull-sync, once" || { bad "replay: no single re-exec"; show; }
cmp -s "$T/bin/substrate-pull-sync" "$T/new.sh" && ok "replay: the new pull-sync is installed" || bad "replay: the installed pull-sync is not the new one"
[ -f "$T/etc/env.d/new.env" ] && ok "replay: the new script rendered env.d/new.env" || { bad "replay: env.d/new.env was not rendered"; show; }
cmp -s "$T/unit/new.service" "$T/seed/super/scripts/substrate/units/new.service" && ok "replay: new.service is installed" || { bad "replay: new.service not installed"; show; }
grep -q 'REFUSED' "$T/out.txt" && bad "replay: a unit was refused" || ok "replay: no unit refused"
grep -q "$GAP_ID" "$CALLS" && bad "replay: a missing-envfile gap was filed" || ok "replay: no missing-envfile gap"
grep -q 'NOT re-executing again' "$T/out.txt" && bad "replay: the re-exec'd tick thought it was still stale" || ok "replay: the re-exec'd tick runs the committed copy"

# ── no re-exec: the unit guard alone keeps the unit out ─────────────────────────
setup; run "" PULLSYNC_REEXECED=1
grep -q 're-executing this tick' "$T/out.txt" && bad "no re-exec: it re-executed anyway" || ok "no re-exec: the tick finishes on the old code"
[ ! -e "$T/etc/env.d/new.env" ] && ok "no re-exec: the old code renders nothing" || bad "no re-exec: env.d/new.env exists (fixture does not replay the bug)"
[ ! -e "$T/unit/new.service" ] && ok "no re-exec: new.service is NOT installed" || bad "no re-exec: new.service installed without its EnvironmentFile"
grep -q "REFUSED new.service .*env.d/new.env" "$T/out.txt" && ok "no re-exec: the refusal is logged with the missing path" || { bad "no re-exec: no refusal logged"; show; }
grep -q "\"id\":\"$GAP_ID\"" "$CALLS" && ok "no re-exec: gap $GAP_ID filed" || bad "no re-exec: no gap with the stable id"
cmp -s "$T/unit/optional.service" "$T/seed/super/scripts/substrate/units/optional.service" && ok "no re-exec: a '-' EnvironmentFile unit still installs" || bad "no re-exec: the optional unit was not installed"
# The refusal is per tick, not a latch: once the file exists the unit installs.
mkdir -p "$T/etc/env.d"; : > "$T/etc/env.d/new.env"; run "" PULLSYNC_REEXECED=1
[ -f "$T/unit/new.service" ] && ok "no re-exec: once the file exists the unit installs" || bad "no re-exec: still refused with the file present"

# ── no loop: a copy that never matches re-executes once ─────────────────────────
setup; run "$T/mangle:"
[ "$RC" != 124 ] && ok "no loop: the tick terminates (exit $RC)" || bad "no loop: timed out"
[ "$(grep -c 're-executing this tick' "$T/out.txt")" = 1 ] && ok "no loop: exactly one re-exec" || { bad "no loop: $(grep -c 're-executing this tick' "$T/out.txt") re-execs"; show; }
grep -q 'NOT re-executing again' "$T/out.txt" && ok "no loop: the second pass says it will not re-exec again" || { bad "no loop: no refusal line"; show; }

# ── hold: no self-update, no re-exec, no unit ───────────────────────────────────
setup; run "" SUBSTRATE_UPDATE_CHANNEL=hold
[ "$RC" = 0 ] && ok "hold: exits 0" || bad "hold: exit $RC"
cmp -s "$T/bin/substrate-pull-sync" "$T/old.sh" && ok "hold: the installed pull-sync is untouched" || bad "hold: pull-sync self-updated"
grep -q 're-executing' "$T/out.txt" && bad "hold: re-executed" || ok "hold: no re-exec"
[ "$(git -C "$T/ws/git/super-repo" rev-parse origin/dev)" = "$SBASE" ] && ok "hold: the super-repo is not even fetched" || bad "hold: the super-repo was fetched"
[ ! -e "$T/unit/new.service" ] && [ ! -e "$T/unit/optional.service" ] && ok "hold: no unit converges" || bad "hold: a unit converged"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
