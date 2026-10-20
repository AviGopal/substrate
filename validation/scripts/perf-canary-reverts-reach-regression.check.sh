#!/usr/bin/env bash
# perf-canary-reverts-reach-regression.check.sh: a vessel change that is live on a node is judged by its EFFECT, not
# only by /health. A convergence whose unit answers /health 200 but whose reach verdict says the change made goals
# fail more is put back on last-good, as an unhealthy one is today.
# Gap: post-install-vessel-change-not-judged-by-effect-no-reach-rollback.
#
# Not a *.test.sh: it is committed red (check first), before the fix, and an intended-red check stays out of the
# glue corpus. Once the fix lands green, a glue test runs it.
#
# Runs the WHOLE substrate-pull-sync.sh (paths rewritten to temp dirs; systemctl, curl and sleep stubbed) with the
# REAL mirror-to-live.sh, against a temp remote one commit ahead of the vessel's last-good pin (the harness of
# pull-sync-unhealthy-revert.test.sh):
#   CONTROL    the new commit fails /health -> the runtime is back on last-good's tree (green today)
#   MUST-FAIL  the new commit answers /health 200, and a reach verdict for it, asked through discovery as the
#              existing shapes performance_reach_gate or perf_canary_resolve, answers not reached -> the runtime is
#              back on last-good's tree. Red today: pull-sync asks for no reach verdict, so the regression stays live.
#   ATTRIBUTION the must-fail run asked for a reach verdict at all (else "not reverted" is not attributable to a
#              verdict that was ignored); today it asks none, which is the defect.
# The contract is by effect (the runtime's content hash), not by which caller runs the canary: pull-sync may resolve
# the reach gate itself or dispatch perf_canary_resolve (development-vessel); either must leave last-good's tree live.
# usage: validation/scripts/perf-canary-reverts-reach-regression.check.sh [repo-root]
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$ROOT/scripts/substrate/substrate-pull-sync.sh"; MIRROR="$ROOT/scripts/substrate/mirror-to-live.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" -e "s#/usr/lib/systemd/system#$T/unit#g" \
    -e "s#/etc/substrate#$T/etc#g" -e "s#/workspace#$T/ws#g" "$SCRIPT" > "$T/pull-sync.sh"
{ sed -n '/^tracked_output_dirs() {/,/^}/p' "$SCRIPT"; sed -n '/^content_hash() {/,/^}/p' "$SCRIPT"; } > "$T/fns.sh"
# shellcheck disable=SC1090
source "$T/fns.sh"
V=demo-vessel; R="$T/rt/$V"; CL="$T/ws/git/vessels/$V"; CALLS="$T/calls.txt"; OUT="$T/out.txt"
mkdir -p "$T/stub" "$T/bin" "$T/share/lib" "$T/unit" "$T/etc"; cp "$(dirname "$SCRIPT")/lib/gap-tracked-red.sh" "$T/share/lib/"
cat > "$T/stub/systemctl" <<EOF
#!/usr/bin/env bash
echo "systemctl \$*" >> "$CALLS"; case "\$1" in is-active) exit 0 ;; is-enabled) echo enabled ;; esac; exit 0
EOF
# /health: 200 always in the reach case; in the control case only while the runtime holds last-good (x = 1).
# A resolve naming performance_reach_gate or perf_canary_resolve answers NOT reached while the runtime holds the new
# commit (x = 2), reached once it is back on last-good.
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
echo "curl \$*" >> "$CALLS"
body=""; [ ! -t 0 ] && body="\$(cat 2>/dev/null)"
case "\$*" in
  */health*) if [ -e "$T/health-always" ] || grep -q 'x = 1' "$R/src/x.ts" 2>/dev/null; then printf 200; else printf 503; fi; exit 0 ;;
esac
if printf '%s %s' "\$*" "\$body" | grep -qE 'performance_reach_gate|perf_canary_resolve'; then
  echo "REACH-ASKED" >> "$CALLS"
  if grep -q 'x = 2' "$R/src/x.ts" 2>/dev/null; then printf '{"success":true,"body":{"reached":false,"verdict":"regressed","reason":"reach fell on the known-answer set"}}\n'
  else printf '{"success":true,"body":{"reached":true}}\n'; fi
  exit 0
fi
exit 7
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/stub/sleep"; cp "$MIRROR" "$T/bin/mirror-to-live"; chmod +x "$T/stub/"*
printf '{"vessels":[{"repo":"%s","unit":"%s.service","health_port":"18999"}]}\n' "$V" "$V" > "$T/share/vessels.inventory.json"
mkdir -p "$T/gatebun"; printf '#!/usr/bin/env bash\ncase "$1" in test) printf "(pass) stub > ok\\n 1 pass\\n 0 fail\\n"; exit 0 ;; install) mkdir -p node_modules; exit 0 ;; esac\nexit 0\n' > "$T/gatebun/bun"; chmod +x "$T/gatebun/bun"
setup() { # last-good base live, origin one commit ahead (x = 2)
  rm -rf "$T/ws" "$T/rt" "$T/o" "$T/seed" "$T/expect" "$T/health-always"; : > "$CALLS"
  mkdir -p "$T/ws/git/vessels" "$T/ws/.last-good" "$R" "$T/o"
  git init -q --bare "$T/o/$V.git"; git -C "$T/o/$V.git" symbolic-ref HEAD refs/heads/dev
  S="$T/seed/$V"; mkdir -p "$S/src"; echo 'export const x = 1;' > "$S/src/x.ts"
  git -C "$S" init -q -b dev; g "$S" add -A; g "$S" commit -m base; g "$S" remote add origin "$T/o/$V.git"; g "$S" push origin dev
  VBASE="$(git -C "$S" rev-parse HEAD)"; git clone -q --branch dev "$T/o/$V.git" "$CL"
  MITOSIS_RUNTIME_DIR="$T/rt" bash "$MIRROR" "$V" "$T/ws/git/vessels" >/dev/null 2>&1; echo "$VBASE" > "$T/ws/.last-good/$V"
  git clone -q "$T/o/$V.git" "$T/expect"; git -C "$T/expect" checkout -q "$VBASE"; EXPECT_HASH="$(content_hash "$T/expect")"
  echo 'export const x = 2;' > "$S/src/x.ts"; g "$S" add -A; g "$S" commit -m change; g "$S" push origin dev
}
run() {
  ( unset SUBSTRATE_UPDATE_CHANNEL
    PATH="$T/stub:$PATH" MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" SUPER_REPO_DIR="$T/ws/git/no-super-repo" \
    STAGGER_SECONDS=0 BUN_BIN="$T/gatebun/bun" DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 timeout 120 bash "$T/pull-sync.sh" > "$OUT" 2>&1 ); RC=$?
}
# CONTROL
setup; run
[ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] && ok "control: a change that fails /health is reverted to last-good" \
  || { bad "control: an unhealthy change was not reverted (rc $RC)"; tail -15 "$OUT" | sed 's/^/    /'; }
# MUST-FAIL
setup; : > "$T/health-always"; run
grep -q 'x = 2' "$R/src/x.ts" 2>/dev/null || [ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] \
  || { bad "fixture: the healthy change never went live (rc $RC)"; tail -15 "$OUT" | sed 's/^/    /'; }
grep -q REACH-ASKED "$CALLS" && ok "attribution: a reach verdict was asked for the live change" \
  || bad "attribution: no reach verdict was asked for the live change (performance_reach_gate / perf_canary_resolve never resolved)"
[ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] && ok "a /health-200 change whose reach verdict is 'not reached' is reverted to last-good" \
  || bad "a /health-200 change whose reach verdict is 'not reached' is reverted to last-good (the regression is still live)"
echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
