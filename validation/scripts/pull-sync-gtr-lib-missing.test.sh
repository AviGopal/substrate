#!/usr/bin/env bash
# A pull-sync tick that cannot load its tracked-red predicate (scripts/substrate/lib/gap-tracked-red.sh)
# is a LOUD NO-OP, never a silently strict gate (substrate-pull-sync.sh, "TRACKED-RED LIB MISSING").
# Runs the WHOLE script (fixed paths rewritten to temp dirs; systemctl, curl and mirror-to-live stubbed
# to record calls) against a vessel one commit behind its origin and a super-repo already converged.
#
#   missing   lib beside the script: absent; share copy: absent; the super-repo origin carries none.
#             Two ticks: nothing restarted, mirrored, fetched into the runtime, baselined or installed
#             (runtime tree, vessel clone, baseline dir, units and bin byte-identical; zero
#             `systemctl restart`, zero MIRROR); no TEST REGRESSION; one log line per tick; exactly
#             one gap id (pull-sync-gap-tracked-red-lib-missing-<node>), severity high, node and
#             first_seen set; the second write is a BUMP (same id, same first_seen, missing_ticks 2)
#   control   the image's share copy present: the same tick converges (mirror + restart), no
#             missing line, and the gap left by the missing ticks is CLOSED (lib_loads_again)
#   heal      only the super-repo origin carries the lib: SELF-CONVERGE FIRST installs it into
#             the share dir and the tick converges
#
# usage: validation/scripts/pull-sync-gtr-lib-missing.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq. No root, no live state: every path is a temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
LIB="$(dirname "$SCRIPT")/lib/gap-tracked-red.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
show() { sed 's/^/    /' "$T/out.txt" | tail -20; }

# The script under test, fixed paths moved into the temp tree. It runs from $T/ps/, so the
# body-relative candidate is $T/ps/lib/ (absent unless a leg puts it there).
mkdir -p "$T/ps"
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" \
    -e "s#/usr/lib/systemd/system#$T/unit#g" -e "s#/etc/substrate#$T/etc#g" \
    -e "s#/workspace#$T/ws#g" "$SCRIPT" > "$T/ps/substrate-pull-sync.sh"

# Stubs: every lifecycle call is recorded; curl records each POSTed body and answers 200.
mkdir -p "$T/stub"
CALLS="$T/calls.txt"; POSTS="$T/posts.jsonl"
cat > "$T/stub/systemctl" <<EOF
#!/usr/bin/env bash
echo "systemctl \$*" >> "$CALLS"
case "\$1" in is-active) exit 0 ;; is-enabled) echo enabled ;; esac
exit 0
EOF
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
echo "curl" >> "$CALLS"
while [ \$# -gt 0 ]; do [ "\$1" = -d ] && { printf '%s\n' "\$2" >> "$POSTS"; shift; }; shift; done
printf '{}\n200'
EOF
chmod +x "$T/stub/"*

V=demo-vessel
setup() { # share-lib(0|1) origin-lib(0|1)
  rm -rf "$T/ws" "$T/rt" "$T/o" "$T/seed" "$T/bin" "$T/share" "$T/unit" "$T/etc" "$T/ps/lib"; : > "$CALLS"; : > "$POSTS"
  mkdir -p "$T/ws/git/vessels" "$T/ws/.last-good" "$T/ws/.pull-sync" "$T/ws/.test-baseline" "$T/rt/$V" "$T/o" "$T/bin" "$T/share" "$T/unit" "$T/etc"
  echo "baseline-sentinel" > "$T/ws/.test-baseline/$V"
  [ "$1" = 1 ] && { mkdir -p "$T/share/lib"; cp "$LIB" "$T/share/lib/"; }
  cat > "$T/bin/mirror-to-live" <<EOF
#!/usr/bin/env bash
echo "MIRROR \$1" >> "$CALLS"
rm -rf "$T/rt/\$1/src"; cp -r "\$2/\$1/src" "$T/rt/\$1/src"
EOF
  chmod +x "$T/bin/mirror-to-live"
  printf '{"vessels":[{"repo":"%s","unit":"%s.service"}]}\n' "$V" "$V" > "$T/share/vessels.inventory.json"
  # vessel: one commit behind origin
  git init -q --bare "$T/o/$V.git"; git -C "$T/o/$V.git" symbolic-ref HEAD refs/heads/dev
  mkdir -p "$T/seed/$V/src"; echo 'export const x = 1;' > "$T/seed/$V/src/x.ts"
  git -C "$T/seed/$V" init -q -b dev; g "$T/seed/$V" add -A; g "$T/seed/$V" commit -m base
  g "$T/seed/$V" remote add origin "$T/o/$V.git"; g "$T/seed/$V" push origin dev
  VBASE="$(git -C "$T/seed/$V" rev-parse HEAD)"
  git clone -q --branch dev "$T/o/$V.git" "$T/ws/git/vessels/$V"
  cp -r "$T/seed/$V/src" "$T/rt/$V/src"; echo "$VBASE" > "$T/ws/.last-good/$V"
  echo 'export const x = 2;' > "$T/seed/$V/src/x.ts"; g "$T/seed/$V" commit -am advance; g "$T/seed/$V" push origin dev
  # super-repo: already converged; its committed pull-sync IS the running one (no re-exec)
  git init -q --bare "$T/o/super.git"; git -C "$T/o/super.git" symbolic-ref HEAD refs/heads/dev
  mkdir -p "$T/seed/super/scripts/substrate"
  cp "$T/ps/substrate-pull-sync.sh" "$T/seed/super/scripts/substrate/substrate-pull-sync.sh"
  [ "$2" = 1 ] && { mkdir -p "$T/seed/super/scripts/substrate/lib"; cp "$LIB" "$T/seed/super/scripts/substrate/lib/"; }
  git -C "$T/seed/super" init -q -b dev; g "$T/seed/super" add -A; g "$T/seed/super" commit -m base
  g "$T/seed/super" remote add origin "$T/o/super.git"; g "$T/seed/super" push origin dev
  git clone -q --branch dev "$T/o/super.git" "$T/ws/git/super-repo"
  git -C "$T/ws/git/super-repo" rev-parse HEAD > "$T/ws/.pull-sync/super-repo.sha"
  cp "$T/ps/substrate-pull-sync.sh" "$T/bin/substrate-pull-sync"
}
# A PASSING test-gate runner (the gate is not what this test is about; a gate that did not measure
# never promotes, so the budget-0 bypass this test used to take now defers instead of converging).
mkdir -p "$T/gatebun"; printf '#!/usr/bin/env bash\ncase "$1" in test) printf "(pass) stub > ok\\n 1 pass\\n 0 fail\\n"; exit 0 ;; install) mkdir -p node_modules; exit 0 ;; esac\nexit 0\n' > "$T/gatebun/bun"; chmod +x "$T/gatebun/bun"
run() {
  ( unset SUBSTRATE_UPDATE_CHANNEL PULLSYNC_REEXECED PULLSYNC_T0 PULLSYNC_SUPER_FETCH_OK PULLSYNC_SELF_DIR PULLSYNC_SHARE_DIR
    env PATH="$T/stub:$PATH" MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" \
      SUPER_REPO_DIR="$T/ws/git/super-repo" STAGGER_SECONDS=0 BUN_BIN="$T/gatebun/bun" DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 \
      TEST_BASELINE_DIR="$T/ws/.test-baseline" timeout 120 bash "$T/ps/substrate-pull-sync.sh" > "$T/out.txt" 2>&1 ); RC=$?
}
# Everything a converging tick could change, minus the missing-lib markers themselves.
snap() {
  ( cd "$T" && find rt unit bin share ws/.test-baseline ws/.last-good ws/.pull-sync -type f ! -name 'gap-tracked-red-lib-missing.*' 2>/dev/null \
      | LC_ALL=C sort | xargs -r sha256sum )
  git -C "$T/ws/git/vessels/$V" rev-parse HEAD origin/dev 2>/dev/null
  git -C "$T/ws/git/super-repo" rev-parse HEAD 2>/dev/null
}
gaps() { jq -c 'select(.impulse.pointer.type? == "substrateGap_write") | .impulse.pointer.gap | select(.id | startswith("pull-sync-gap-tracked-red-lib-missing-"))' "$POSTS" 2>/dev/null; }

# ── missing: two no-op ticks, one bumped gap ───────────────────────────────────
setup 0 0
BEFORE="$(snap)"
run; RC1=$RC; cp "$T/out.txt" "$T/out1.txt"
run; RC2=$RC
AFTER="$(snap)"
[ "$RC1" = 0 ] && [ "$RC2" = 0 ] && ok "missing: both ticks exit 0" || { bad "missing: exits $RC1 $RC2"; show; }
[ "$BEFORE" = "$AFTER" ] && ok "missing: runtime, units, bin, share, baselines, last-good, markers and clones unchanged" \
  || { bad "missing: the tick changed state"; diff <(printf '%s\n' "$BEFORE") <(printf '%s\n' "$AFTER") | sed 's/^/    /' | head; }
grep -q 'systemctl restart' "$CALLS" && bad "missing: a unit was restarted" || ok "missing: zero restart calls"
grep -q '^MIRROR' "$CALLS" && bad "missing: mirror-to-live ran" || ok "missing: zero mirrors"
[ "$(cat "$T/ws/.test-baseline/$V")" = baseline-sentinel ] && ok "missing: zero baseline writes" || bad "missing: the baseline was written"
cat "$T/out1.txt" "$T/out.txt" | grep -q 'TEST REGRESSION' && bad "missing: a TEST REGRESSION was reported" || ok "missing: no TEST REGRESSION"
[ "$(grep -c 'TRACKED-RED LIB MISSING' "$T/out1.txt")" = 1 ] && [ "$(grep -c 'TRACKED-RED LIB MISSING' "$T/out.txt")" = 1 ] \
  && ok "missing: one TRACKED-RED LIB MISSING line per tick" || { bad "missing: not one line per tick"; show; }
G="$(gaps)"
[ "$(printf '%s\n' "$G" | grep -c .)" = 2 ] && ok "missing: two writes (one per tick)" || bad "missing: $(printf '%s\n' "$G" | grep -c .) writes"
[ "$(printf '%s\n' "$G" | jq -r .id | sort -u | grep -c .)" = 1 ] && ok "missing: exactly one gap id: $(printf '%s\n' "$G" | jq -r .id | head -1)" || bad "missing: ids $(printf '%s\n' "$G" | jq -r .id | sort -u | tr '\n' ' ')"
NODE="$(hostname 2>/dev/null || cat /proc/sys/kernel/hostname 2>/dev/null)"; NODE="${NODE:-${HOSTNAME:-unknown}}"
[ "$(printf '%s\n' "$G" | jq -r .id | head -1)" = "pull-sync-gap-tracked-red-lib-missing-$(printf '%s' "$NODE" | tr -c 'A-Za-z0-9._-' '-')" ] && [ "$NODE" != unknown ] && ok "missing: the id is stable per node" || bad "missing: id is not per node"
printf '%s\n' "$G" | jq -e -s 'all(.severity == "high" and .status == "open" and (.classification_metadata.node | length > 0) and (.classification_metadata.first_seen | length > 0))' >/dev/null \
  && ok "missing: high severity, open, node and first_seen set" || bad "missing: fields wrong: $G"
printf '%s\n' "$G" | jq -e -s '.[0].classification_metadata.first_seen == .[1].classification_metadata.first_seen and .[0].classification_metadata.missing_ticks == 1 and .[1].classification_metadata.missing_ticks == 2' >/dev/null \
  && ok "missing: the second write is a bump (first_seen kept, missing_ticks 1 -> 2)" || bad "missing: not a bump: $G"

# ── control: the share copy present (the image's), after those two missing ticks ──
mkdir -p "$T/share/lib"; cp "$LIB" "$T/share/lib/"; : > "$POSTS"; : > "$CALLS"
run
grep -q 'TRACKED-RED LIB MISSING' "$T/out.txt" && bad "control: still missing" || ok "control: the predicate loads"
grep -q "^MIRROR $V" "$CALLS" && grep -q "systemctl restart $V.service" "$CALLS" && ok "control: the vessel converges (mirror + restart)" || { bad "control: no convergence"; show; }
[ "$(git -C "$T/ws/git/vessels/$V" rev-parse HEAD)" != "$VBASE" ] && ok "control: the vessel clone advanced" || bad "control: the vessel clone did not advance"
gaps | jq -e -s 'length == 1 and .[0].status == "closed" and .[0].closed_reason == "lib_loads_again"' >/dev/null \
  && ok "control: the missing-lib gap is closed (lib_loads_again)" || bad "control: gap not closed: $(gaps)"
[ ! -e "$T/ws/.pull-sync/gap-tracked-red-lib-missing.first_seen" ] && ok "control: first_seen cleared for the next episode" || bad "control: first_seen marker remains"

# ── heal: only the super-repo carries the lib; SELF-CONVERGE FIRST installs it ─────
setup 0 1
run
cmp -s "$T/share/lib/gap-tracked-red.sh" "$LIB" && ok "heal: the lib is installed into the share dir" || { bad "heal: not installed"; show; }
grep -q 'TRACKED-RED LIB MISSING' "$T/out.txt" && bad "heal: still missing" || ok "heal: no missing line"
grep -q "^MIRROR $V" "$CALLS" && ok "heal: the tick converges" || { bad "heal: no convergence"; show; }
[ -z "$(gaps)" ] && ok "heal: no missing-lib gap written" || bad "heal: a gap was written"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
