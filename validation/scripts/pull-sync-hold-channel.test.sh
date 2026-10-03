#!/usr/bin/env bash
# SUBSTRATE_UPDATE_CHANNEL=hold converges NOTHING (openspec staged-fleet-rollout,
# task 3): a fresh node from a published image keeps running that image until it is
# told otherwise. Runs the WHOLE substrate-pull-sync.sh (a copy whose fixed paths are
# rewritten to temp dirs; systemctl, curl and mirror-to-live stubbed to record calls)
# against temp git remotes with one new vessel commit and one new super-repo commit.
#
#   hold     no fetch, no clone advance, no mirror, no restart, no super-repo or
#            self-reinstall; channel.json records channel, ref:null, the live
#            super-repo and per-vessel SHAs (last-good, else the image's baked
#            revision — never the clone), at, ref_missing:false; one log line; exit 0
#   unset    the control: converges exactly as before (clone advances, mirror,
#            restart, pull-sync reinstalls itself and re-executes the tick on the
#            pulled copy) and writes no channel.json
#
# usage: validation/scripts/pull-sync-hold-channel.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq. No root, no live state: every path is a temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }

# ── the script under test, its fixed paths moved into the temp tree ─────────────
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" \
    -e "s#/usr/lib/systemd/system#$T/unit#g" -e "s#/etc/substrate#$T/etc#g" \
    -e "s#/workspace#$T/ws#g" "$SCRIPT" > "$T/pull-sync.sh"

# ── stubs: every lifecycle call is recorded, none acts outside $T ───────────────
mkdir -p "$T/stub" "$T/bin" "$T/share" "$T/unit" "$T/etc"
# The image ships the tracked-red predicate (Dockerfile.substrate: scripts/substrate/lib/ -> share/lib);
# without it every tick is a TRACKED-RED LIB MISSING no-op (pull-sync-gtr-lib-missing.test.sh).
mkdir -p "$T/share/lib" && cp "$(dirname "$SCRIPT")/lib/gap-tracked-red.sh" "$T/share/lib/"
CALLS="$T/calls.txt"
cat > "$T/stub/systemctl" <<EOF
#!/usr/bin/env bash
echo "systemctl \$*" >> "$CALLS"
case "\$1" in is-active) exit 0 ;; is-enabled) echo enabled ;; esac
exit 0
EOF
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
echo "curl" >> "$CALLS"
exit 7
EOF
cat > "$T/bin/mirror-to-live" <<EOF
#!/usr/bin/env bash
echo "MIRROR \$1" >> "$CALLS"
rm -rf "$T/rt/\$1/src"; cp -r "\$2/\$1/src" "$T/rt/\$1/src"
EOF
chmod +x "$T/stub/"* "$T/bin/mirror-to-live"

# ── fixture: a vessel and the super-repo, each one commit behind its origin ─────
V=demo-vessel
setup() {
  rm -rf "$T/ws" "$T/rt" "$T/o" "$T/seed"; : > "$CALLS"
  mkdir -p "$T/ws/git/vessels" "$T/ws/.last-good" "$T/rt/$V" "$T/rt/baked-vessel/src" "$T/o"
  # vessel origin: base, then a src change
  git init -q --bare "$T/o/$V.git"; git -C "$T/o/$V.git" symbolic-ref HEAD refs/heads/dev
  mkdir -p "$T/seed/$V/src"; echo 'export const x = 1;' > "$T/seed/$V/src/x.ts"
  git -C "$T/seed/$V" init -q -b dev; g "$T/seed/$V" add -A; g "$T/seed/$V" commit -m base
  g "$T/seed/$V" remote add origin "$T/o/$V.git"; g "$T/seed/$V" push origin dev
  VBASE="$(git -C "$T/seed/$V" rev-parse HEAD)"
  git clone -q --branch dev "$T/o/$V.git" "$T/ws/git/vessels/$V"
  cp -r "$T/seed/$V/src" "$T/rt/$V/src"; echo "$VBASE" > "$T/ws/.last-good/$V"
  echo 'export const x = 2;' > "$T/seed/$V/src/x.ts"; g "$T/seed/$V" commit -am advance; g "$T/seed/$V" push origin dev
  VNEW="$(git -C "$T/seed/$V" rev-parse HEAD)"
  # super-repo origin: base, then a new pull-sync and a new unit
  git init -q --bare "$T/o/super.git"; git -C "$T/o/super.git" symbolic-ref HEAD refs/heads/dev
  mkdir -p "$T/seed/super/scripts/substrate/units"
  printf '#!/usr/bin/env bash\necho base pull-sync\n' > "$T/seed/super/scripts/substrate/substrate-pull-sync.sh"
  git -C "$T/seed/super" init -q -b dev; g "$T/seed/super" add -A; g "$T/seed/super" commit -m base
  g "$T/seed/super" remote add origin "$T/o/super.git"; g "$T/seed/super" push origin dev
  SBASE="$(git -C "$T/seed/super" rev-parse HEAD)"
  git clone -q --branch dev "$T/o/super.git" "$T/ws/git/super-repo"
  # The new pull-sync is a REAL one (the script under test plus a marker line): the tick
  # that pulls it re-executes on it (SELF-CONVERGE FIRST), so a stub here would stop the run.
  { cat "$T/pull-sync.sh"; echo '# NEW pull-sync from dev'; } > "$T/seed/super/scripts/substrate/substrate-pull-sync.sh"
  printf '[Unit]\nDescription=new\n' > "$T/seed/super/scripts/substrate/units/new.service"
  g "$T/seed/super" add -A; g "$T/seed/super" commit -m advance; g "$T/seed/super" push origin dev
  # the image: its revision, its baked vessel revisions, the pull-sync it installed
  echo imagerev0001 > "$T/etc/image-revision"
  printf 'baked-vessel=bakedsha0002\n%s=imagesha0003\n' "$V" > "$T/share/vessel-revisions"
  echo 'export const b = 1;' > "$T/rt/baked-vessel/src/b.ts"
  printf '#!/usr/bin/env bash\necho image pull-sync\n' > "$T/bin/substrate-pull-sync"
  cp "$T/bin/substrate-pull-sync" "$T/image-pull-sync"
}
run() { # channel (empty = unset)
  ( unset SUBSTRATE_UPDATE_CHANNEL; [ -n "$1" ] && export SUBSTRATE_UPDATE_CHANNEL="$1"
    PATH="$T/stub:$PATH" MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" \
    SUPER_REPO_DIR="$T/ws/git/super-repo" STAGGER_SECONDS=0 GATE_BUDGET_SECONDS=0 DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 \
    timeout 120 bash "$T/pull-sync.sh" > "$T/out.txt" 2>&1 ); RC=$?
}
REC="$T/ws/.pull-sync/channel.json"

# ── hold ────────────────────────────────────────────────────────────────────────
setup; run hold
[ "$RC" = 0 ] && ok "hold: exits 0" || bad "hold: exit $RC"
[ "$(git -C "$T/ws/git/vessels/$V" rev-parse HEAD)" = "$VBASE" ] && ok "hold: the vessel clone does not advance" || bad "hold: the vessel clone advanced"
[ "$(git -C "$T/ws/git/vessels/$V" rev-parse origin/dev)" = "$VBASE" ] && ok "hold: the vessel clone is not even fetched" || bad "hold: the vessel clone was fetched"
grep -q '^MIRROR' "$CALLS" && bad "hold: mirror-to-live ran" || ok "hold: nothing is mirrored"
grep -q 'systemctl restart' "$CALLS" && bad "hold: a unit was restarted" || ok "hold: nothing is restarted"
grep -q 'x = 1' "$T/rt/$V/src/x.ts" && ok "hold: the runtime keeps the code it runs" || bad "hold: the runtime changed"
[ "$(git -C "$T/ws/git/super-repo" rev-parse HEAD)" = "$SBASE" ] && ok "hold: the super-repo clone does not advance" || bad "hold: the super-repo clone advanced"
cmp -s "$T/bin/substrate-pull-sync" "$T/image-pull-sync" && ok "hold: pull-sync does not reinstall itself" || bad "hold: pull-sync reinstalled itself from the super-repo"
[ ! -e "$T/unit/new.service" ] && ok "hold: no unit converges" || bad "hold: a unit was converged"
grep -q 're-executing this tick' "$T/out.txt" && bad "hold: pull-sync re-executed itself" || ok "hold: no self re-exec"
if jq -e . "$REC" >/dev/null 2>&1; then
  ok "hold: channel.json is written and parses"
  jq -e '.channel == "hold" and .ref == null and .ref_missing == false' "$REC" >/dev/null && ok "hold: channel hold, ref null, ref_missing false" || bad "hold: channel/ref/ref_missing wrong: $(cat "$REC")"
  jq -e '.sha == "imagerev0001"' "$REC" >/dev/null && ok "hold: super-repo sha is the image revision (no last-good)" || bad "hold: super-repo sha wrong: $(jq -c .sha "$REC")"
  jq -e --arg b "$VBASE" '.vessels["demo-vessel"] == $b' "$REC" >/dev/null && ok "hold: a mirrored vessel records its last-good sha, not the clone's" || bad "hold: demo-vessel sha wrong: $(jq -c .vessels "$REC")"
  jq -e '.vessels["baked-vessel"] == "bakedsha0002"' "$REC" >/dev/null && ok "hold: an unmirrored vessel records the image's baked revision" || bad "hold: baked-vessel sha wrong: $(jq -c .vessels "$REC")"
  jq -e '(.at | type) == "string" and (.at | length) > 0' "$REC" >/dev/null && ok "hold: at is set" || bad "hold: at missing"
else
  bad "hold: no parseable $REC"
fi
[ "$(grep -c 'update channel hold' "$T/out.txt")" = 1 ] && [ "$(grep -c '\[pull-sync' "$T/out.txt")" = 1 ] && ok "hold: logs exactly one line" || { bad "hold: log is not one line:"; sed 's/^/    /' "$T/out.txt"; }
echo hold-old-super > "$T/ws/.last-good/super-repo"; run hold
jq -e '.sha == "hold-old-super"' "$REC" >/dev/null 2>&1 && ok "hold: a super-repo last-good outranks the image revision" || bad "hold: super-repo last-good ignored"

# ── control: unset converges as before ──────────────────────────────────────────
setup; run ""
[ "$(git -C "$T/ws/git/vessels/$V" rev-parse HEAD)" = "$VNEW" ] && ok "unset: the vessel clone advances to origin/dev" || { bad "unset: the vessel clone did not advance"; sed 's/^/    /' "$T/out.txt" | tail -20; }
grep -q "^MIRROR $V" "$CALLS" && ok "unset: the vessel is mirrored" || bad "unset: no mirror"
grep -q "systemctl restart $V.service" "$CALLS" && ok "unset: the vessel is restarted" || bad "unset: no restart"
[ "$(git -C "$T/ws/git/super-repo" rev-parse HEAD)" != "$SBASE" ] && ok "unset: the super-repo clone advances" || bad "unset: the super-repo clone did not advance"
grep -q 'NEW pull-sync from dev' "$T/bin/substrate-pull-sync" && ok "unset: pull-sync reinstalls itself from dev (as before)" || bad "unset: pull-sync did not reinstall itself"
grep -q 're-executing this tick' "$T/out.txt" && ok "unset: the tick re-executed on the pulled pull-sync" || bad "unset: no self re-exec"
[ ! -e "$REC" ] && ok "unset: no channel.json (canary behaviour unchanged)" || bad "unset: channel.json written on canary"
grep -q 'update channel hold' "$T/out.txt" && bad "unset: logged a hold" || ok "unset: no hold line"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
