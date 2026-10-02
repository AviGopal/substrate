#!/usr/bin/env bash
# An UNHEALTHY convergence really puts the last-good tree back in the runtime
# (scripts/substrate/substrate-pull-sync.sh, the revert after mirror+restart).
#
# The revert used to `git checkout PREV_GOOD -- .` in the clone and then call
# mirror-to-live, whose first act is `reset --hard HEAD`: the checkout was
# discarded, HEAD (the unhealthy code) was mirrored again, and the log line and
# the pull-sync-unhealthy gap both said "reverted". So this test asserts the
# CONTENT of the runtime, never the log line — the log is what lied.
#
# Runs the WHOLE substrate-pull-sync.sh (paths rewritten to temp dirs; systemctl,
# curl and sleep stubbed) with the REAL mirror-to-live.sh, against a temp remote
# whose new commit is unhealthy: the curl stub answers /health 200 only while the
# runtime holds the last-good source.
#
#   (a) after the unhealthy path the runtime content hash equals PREV_GOOD's tree
#       (src/, a file the bad commit deleted is back, one it added is gone, the
#       tracked ui/dist is the old bundle)
#   (b) the clone is back on its branch at HEAD, clean, with no leftover worktree
#   (c) "reverted" is logged only with the content verified, the re-check after
#       the revert restart reports healthy, and no revert-failed gap is filed
#   (d) the next tick holds the verified revert: no re-mirror of the unhealthy
#       HEAD, the runtime stays on PREV_GOOD (no mirror/revert bounce)
#   (e) a mirror that exits 0 but ships HEAD anyway (the historic lie) is caught:
#       revert-failed gap filed with a stable id, "revert FAILED" logged, never
#       "reverted to"
#   (f) the revert lands but the unit stays unhealthy and inactive (a dependency
#       is down): the next tick does not re-mirror the failed commit, restart, or
#       halt the run — both trees already failed
#
# usage: validation/scripts/pull-sync-unhealthy-revert.test.sh [repo-root]
# Needs bash, git, jq, tar, md5sum. No root, no live state: every path is a temp dir.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$ROOT/scripts/substrate/substrate-pull-sync.sh"
MIRROR="$ROOT/scripts/substrate/mirror-to-live.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }

# ── the script under test, its fixed paths moved into the temp tree ─────────────
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" \
    -e "s#/usr/lib/systemd/system#$T/unit#g" -e "s#/etc/substrate#$T/etc#g" \
    -e "s#/workspace#$T/ws#g" "$SCRIPT" > "$T/pull-sync.sh"
# the hash pull-sync itself uses, to compute what each tree SHOULD hash to
{ sed -n '/^tracked_output_dirs() {/,/^}/p' "$SCRIPT"; sed -n '/^content_hash() {/,/^}/p' "$SCRIPT"; } > "$T/fns.sh"
# shellcheck disable=SC1090
source "$T/fns.sh"

V=demo-vessel
R="$T/rt/$V"; CL="$T/ws/git/vessels/$V"
CALLS="$T/calls.txt"; OUT="$T/out.txt"

# ── stubs: lifecycle calls recorded, health follows the runtime's content ───────
mkdir -p "$T/stub" "$T/bin" "$T/share" "$T/unit" "$T/etc"
cat > "$T/stub/systemctl" <<EOF
#!/usr/bin/env bash
echo "systemctl \$*" >> "$CALLS"
case "\$1" in is-active) [ -e "$T/unit-down" ] && exit 3; exit 0 ;; is-enabled) echo enabled ;; esac
exit 0
EOF
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
echo "curl \$*" >> "$CALLS"
case "\$*" in
  */health*) [ ! -e "$T/dep-down" ] && grep -q 'x = 1' "$R/src/x.ts" 2>/dev/null && printf 200 || printf 503; exit 0 ;;
esac
exit 7
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/stub/sleep"
# the REAL mirror-to-live behind a recording wrapper
cp "$MIRROR" "$T/real-mirror.sh"
cat > "$T/mirror-wrapper" <<EOF
#!/usr/bin/env bash
echo "MIRROR \$*" >> "$CALLS"
exec bash "$T/real-mirror.sh" "\$@"
EOF
# the historic lie: exits 0, ignores any ref, ships the clone's HEAD
cat > "$T/lying-mirror" <<EOF
#!/usr/bin/env bash
echo "MIRROR \$*" >> "$CALLS"
git -C "\$2/\$1" reset -q --hard HEAD
rm -rf "$R/src"; cp -r "\$2/\$1/src" "$R/src"
exit 0
EOF
chmod +x "$T/stub/"* "$T/mirror-wrapper" "$T/lying-mirror"
printf '{"vessels":[{"repo":"%s","unit":"%s.service","health_port":"18999"}]}\n' "$V" "$V" > "$T/share/vessels.inventory.json"

# ── fixture: last-good base live, origin one (unhealthy) commit ahead ───────────
setup() { # mirror-binary
  rm -rf "$T/ws" "$T/rt" "$T/o" "$T/seed" "$T/expect" "$T/dep-down" "$T/unit-down"; : > "$CALLS"
  cp "$1" "$T/bin/mirror-to-live"
  mkdir -p "$T/ws/git/vessels" "$T/ws/.last-good" "$R" "$T/o"
  git init -q --bare "$T/o/$V.git"; git -C "$T/o/$V.git" symbolic-ref HEAD refs/heads/dev
  S="$T/seed/$V"; mkdir -p "$S/src" "$S/sql" "$S/ui/dist/assets"
  echo 'export const x = 1;' > "$S/src/x.ts"
  echo 'export const keep = true;' > "$S/src/old.ts"
  echo 'DEFINE TABLE t;' > "$S/sql/schema.surql"
  echo '<script src="/assets/a.js"></script>' > "$S/ui/dist/index.html"
  echo "console.log('a')" > "$S/ui/dist/assets/a.js"
  git -C "$S" init -q -b dev; g "$S" add -A; g "$S" commit -m base
  g "$S" remote add origin "$T/o/$V.git"; g "$S" push origin dev
  VBASE="$(git -C "$S" rev-parse HEAD)"
  git clone -q --branch dev "$T/o/$V.git" "$CL"
  # the runtime as a past healthy tick left it: base mirrored, base pinned
  MITOSIS_RUNTIME_DIR="$T/rt" bash "$MIRROR" "$V" "$T/ws/git/vessels" >/dev/null 2>&1
  echo "$VBASE" > "$T/ws/.last-good/$V"
  # what PREV_GOOD's tree hashes to, from an independent checkout of it
  git clone -q "$T/o/$V.git" "$T/expect"; git -C "$T/expect" checkout -q "$VBASE"
  EXPECT_HASH="$(content_hash "$T/expect")"
  [ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] || { echo "FAIL - fixture: base runtime does not hash as base"; exit 1; }
  # the bad commit: x changes (unhealthy), old.ts deleted, new.ts added, new bundle
  echo 'export const x = 2;' > "$S/src/x.ts"; rm "$S/src/old.ts"
  echo 'export const added = true;' > "$S/src/new.ts"
  rm "$S/ui/dist/assets/a.js"; echo "console.log('b')" > "$S/ui/dist/assets/b.js"
  echo '<script src="/assets/b.js"></script>' > "$S/ui/dist/index.html"
  g "$S" add -A; g "$S" commit -m unhealthy; g "$S" push origin dev
  VNEW="$(git -C "$S" rev-parse HEAD)"
}
run() {
  ( unset SUBSTRATE_UPDATE_CHANNEL
    PATH="$T/stub:$PATH" MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" \
    SUPER_REPO_DIR="$T/ws/git/no-super-repo" STAGGER_SECONDS=0 GATE_BUDGET_SECONDS=0 DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 \
    timeout 120 bash "$T/pull-sync.sh" > "$OUT" 2>&1 ); RC=$?
}
show() { sed 's/^/    /' "$OUT" | grep -v '^    $' | tail -25; }

# ── (a)-(c) the unhealthy path with the real mirror ─────────────────────────────
setup "$T/mirror-wrapper"; run
grep -q "UNHEALTHY after mirror+restart" "$OUT" || { bad "fixture: the unhealthy path never ran (rc=$RC)"; show; }
grep -q "^MIRROR $V .*$VBASE" "$CALLS" && ok "(a) the revert asks mirror-to-live for PREV_GOOD" || bad "(a) the revert did not pass PREV_GOOD to mirror-to-live"
[ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] && ok "(a) the runtime content hash equals PREV_GOOD's tree" \
  || { bad "(a) the runtime is NOT PREV_GOOD's tree after the revert"; diff -r -x node_modules "$T/expect/src" "$R/src" | sed 's/^/    /'; }
grep -q 'x = 1' "$R/src/x.ts" 2>/dev/null && [ -f "$R/src/old.ts" ] && [ ! -e "$R/src/new.ts" ] \
  && ok "(a) src/: the bad edit undone, the deleted file back, the added file gone" || bad "(a) src/ still carries the unhealthy commit"
[ -f "$R/ui/dist/assets/a.js" ] && [ ! -e "$R/ui/dist/assets/b.js" ] && grep -q a.js "$R/ui/dist/index.html" \
  && ok "(a) the tracked ui/dist is the last-good bundle" || bad "(a) ui/dist is not the last-good bundle"
[ "$(git -C "$CL" symbolic-ref -q HEAD)" = refs/heads/dev ] && [ "$(git -C "$CL" rev-parse HEAD)" = "$VNEW" ] \
  && ok "(b) the clone is on dev at HEAD" || bad "(b) the clone is at $(git -C "$CL" rev-parse --abbrev-ref HEAD) $(git -C "$CL" rev-parse HEAD)"
[ -z "$(git -C "$CL" status --porcelain)" ] && ok "(b) the clone is clean" || bad "(b) the clone is dirty: $(git -C "$CL" status --porcelain | tr '\n' ' ')"
[ "$(git -C "$CL" worktree list | wc -l)" = 1 ] && ok "(b) no worktree left behind" || bad "(b) worktrees left: $(git -C "$CL" worktree list | tr '\n' ';')"
grep -q "reverted to ${VBASE:0:10}.*verified" "$OUT" && ok "(c) the revert is logged as verified" || { bad "(c) no verified revert line"; show; }
grep -q 'revert FAILED' "$OUT" && bad "(c) a real revert was logged FAILED" || ok "(c) nothing claims the revert failed"
grep -q 'pull-sync-revert-failed' "$CALLS" && bad "(c) a revert-failed gap was filed for a good revert" || ok "(c) no revert-failed gap"
grep -q "reverted and healthy" "$OUT" && ok "(c) the re-check after the revert restart reports healthy" || bad "(c) no post-revert health verdict"
grep -q "pull-sync-unhealthy-$V" "$CALLS" && ok "(c) the unhealthy gap is still filed" || bad "(c) no pull-sync-unhealthy gap"

# ── (d) the next tick holds the revert ─────────────────────────────────────────
: > "$CALLS"; run
grep -q "^MIRROR" "$CALLS" && bad "(d) the next tick re-mirrored (bounce): $(grep '^MIRROR' "$CALLS" | tr '\n' ';')" || ok "(d) the next tick does not re-mirror the unhealthy HEAD"
[ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] && ok "(d) the runtime stays on PREV_GOOD" || bad "(d) the runtime left PREV_GOOD on the next tick"
grep -q "systemctl restart $V.service" "$CALLS" && bad "(d) the next tick restarted the unit" || ok "(d) no restart on the next tick"
grep -q "drift-quarantine" "$CALLS" && bad "(d) the revert tree was quarantined as foreign" || ok "(d) the revert tree is not quarantined"

# ── (e) forced mismatch: a mirror that ships HEAD anyway ───────────────────────
setup "$T/lying-mirror"; run
gap="$(grep -o "\"id\":\"pull-sync-revert-failed-$V\"" "$CALLS" | head -1)"
[ -n "$gap" ] && ok "(e) the mismatch files gap pull-sync-revert-failed-$V" || { bad "(e) no revert-failed gap"; show; }
grep -q "revert FAILED" "$OUT" && ok "(e) the log says revert FAILED" || bad "(e) the log does not say revert FAILED"
grep -q "reverted to" "$OUT" && bad "(e) the log claims a revert that did not happen" || ok "(e) no 'reverted to' claim"
grep "pull-sync-unhealthy-$V" "$CALLS" | grep -q "reverted to" && bad "(e) the unhealthy gap claims a revert" || ok "(e) the unhealthy gap does not claim a revert"
[ "$(git -C "$CL" symbolic-ref -q HEAD)" = refs/heads/dev ] && [ "$(git -C "$CL" rev-parse HEAD)" = "$VNEW" ] \
  && ok "(e) the clone is on dev at HEAD" || bad "(e) the clone was left elsewhere"

# ── (f) both trees unhealthy: no per-tick bounce ───────────────────────────────
setup "$T/mirror-wrapper"; : > "$T/dep-down"; run
[ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] && ok "(f) the revert still lands" || bad "(f) the revert did not land"
grep -q "STILL UNHEALTHY" "$OUT" && ok "(f) the post-revert re-check says still unhealthy" || bad "(f) no still-unhealthy verdict"
grep "pull-sync-unhealthy-$V" "$CALLS" | grep -q "unhealthy after the revert restart" && ok "(f) the gap carries the post-revert verdict" || bad "(f) the gap lacks the post-revert verdict"
: > "$T/unit-down"; : > "$CALLS"; run
grep -q "^MIRROR" "$CALLS" && bad "(f) the next tick re-mirrored the failed commit" || ok "(f) the next tick does not re-mirror"
grep -q "systemctl restart $V.service" "$CALLS" && bad "(f) the next tick restarted the sick unit" || ok "(f) no restart on the next tick"
grep -q "UNHEALTHY after mirror+restart" "$OUT" && bad "(f) the next tick halted the run again" || ok "(f) the run is not halted again"
[ "$(content_hash "$R" "$T/expect")" = "$EXPECT_HASH" ] && ok "(f) the runtime stays on PREV_GOOD" || bad "(f) the runtime left PREV_GOOD"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
