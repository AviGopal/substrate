#!/usr/bin/env bash
# secrets-manifest-one-copy.test.sh: a committed secrets-manifest.json reaches $SHARE_DIR in one pull-sync tick, so
# every reader of the manifest reads the same bytes (pre-commit glue test).
#
# THE SPLIT THIS CLOSES. Per-tick unit convergence (converge_units) renders the scoped env files with the STAGED
# render-secret-scope.sh, which reads the manifest beside itself first: the committed copy. Everything else reads
# /usr/local/share/substrate/secrets-manifest.json: gen-env at boot, render-unit for a vessel install, the mask probe,
# and seed-identity (which reads that path FIRST). That copy was baked by the image and never converged in place,
# because its coverage entry was "none", so a committed manifest change reached unit convergence but not boot or
# identity seeding. Its entry is now level behaviour (the corpus fixture substrate-key-admin-persist.sh notices it),
# so converge_fleet_defs' gen-env-dependency loop installs it on the same tick.
#
# Runs the script's own converge_units / converge_fleet_defs against a scratch super-repo holding the candidate's
# real secrets-manifest.json and real coverage map, with destinations rewritten to temp dirs (no root):
#   MUST-FAIL  after one tick $SHARE_DIR/secrets-manifest.json is byte-identical to the committed manifest;
#   MUST-FAIL  a committed manifest change (with its proof refreshed, as coverage-refresh-behaviour-blobs.sh does)
#              is at $SHARE_DIR after the next tick, identical to the staged copy converge_units read;
#   CONTROL    an unchanged manifest is not rewritten on a later tick (same inode, no "converged" line);
#   CONTROL    a committed manifest change whose proof was NOT refreshed stays as installed (the gate still holds);
#   CONTROL    every reader resolves the manifest to the staged copy or to $SHARE_DIR, and no other path.
# The loop restarts no unit and regenerates no env: a running vessel sees a scope change at its next unit
# convergence or restart. The fixture edits only the manifest's _comment field (no secret name, no value).
# Fixture words from a 5-word draw (2026-10-29T22:49:14Z: starving strangle anything drizzly ravage).
#
# usage: validation/scripts/secrets-manifest-one-copy.test.sh [path/to/super-repo root]
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$ROOT/scripts/substrate/substrate-pull-sync.sh"
MF="$ROOT/scripts/substrate/secrets-manifest.json"; CM="$ROOT/scripts/substrate/gate/coverage.json"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

export PULLSYNC_UNIT_DIR="$T/dst/unit" PULLSYNC_BIN_DIR="$T/dst/bin" PULLSYNC_SHARE_DIR="$T/dst/share" FLEET_DIR="$T/dst/fleet"
mkdir -p "$PULLSYNC_UNIT_DIR" "$PULLSYNC_BIN_DIR" "$PULLSYNC_SHARE_DIR"
{
  sed -n '/^COV_STATE=unloaded;/,/^cov_skip() {.*}$/p' "$SCRIPT"
  awk '/^# INSTALL ONLY WHAT IS COMMITTED\./{on=1} on{print} on && /^stage_committed_glue\(\) \{/{f=1} f && /^}/{exit}' "$SCRIPT"
  sed -n '/^converge_units() {/,/^}/p' "$SCRIPT"
  sed -n '/^converge_fleet_defs() {/,/^}/p' "$SCRIPT"
} | sed -e "s#/usr/lib/systemd/system#\$PULLSYNC_UNIT_DIR#g" -e "s#/usr/local/bin#\$PULLSYNC_BIN_DIR#g" -e "s#/usr/local/share/substrate#\$PULLSYNC_SHARE_DIR#g" > "$T/fns.sh"
GAPS="$T/gaps.jsonl"; LOG="$T/log.txt"; : > "$GAPS"; : > "$LOG"
log() { echo "$*" >> "$LOG"; }
emit_gap() { printf '%s\n' "$1" >> "$GAPS"; }
systemctl() { :; }
BRANCH=dev
# shellcheck disable=SC1090
source "$T/fns.sh"
trap 'rm -rf "$T"' EXIT

g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
SHARED="$PULLSYNC_SHARE_DIR/secrets-manifest.json"
tick() { : > "$LOG"; converge_units "$S"; converge_fleet_defs "$S"; }
staged() { git -C "$S" show HEAD:scripts/substrate/secrets-manifest.json; }
# The committing operator's refresh (coverage-refresh-behaviour-blobs.sh recomputes src_blob for a changed src).
refresh_proof() { local b; b="$(git -C "$S" hash-object scripts/substrate/secrets-manifest.json)"
  jq --arg b "$b" '.paths["/usr/local/share/substrate/secrets-manifest.json"].src_blob = $b' "$S/scripts/substrate/gate/coverage.json" > "$T/cm" \
    && mv "$T/cm" "$S/scripts/substrate/gate/coverage.json"; }
comment_to() { jq --arg c "$1" '._comment = $c' "$S/scripts/substrate/secrets-manifest.json" > "$T/mf" && mv "$T/mf" "$S/scripts/substrate/secrets-manifest.json"; }

S="$T/super"; mkdir -p "$S/scripts/substrate/gate"
cp "$MF" "$S/scripts/substrate/secrets-manifest.json"; cp "$CM" "$S/scripts/substrate/gate/coverage.json"
git -C "$S" init -q -b dev; g "$S" add -A; g "$S" commit -m base

# 1. MUST-FAIL: one tick installs the committed manifest at $SHARE_DIR.
tick
if [ -f "$SHARED" ] && cmp -s "$SHARED" <(staged); then ok "after one tick \$SHARE_DIR holds the committed manifest, byte for byte"
else bad "after one tick \$SHARE_DIR holds the committed manifest ($(grep -m1 'secrets-manifest' "$LOG" || echo 'no install line'))"; fi

# 2. MUST-FAIL: a committed change (proof refreshed) reaches $SHARE_DIR on the next tick, identical to the staged copy.
comment_to "starving strangle: a drizzly ravage of anything"; refresh_proof; g "$S" commit -am change
tick
if cmp -s "$SHARED" <(staged) && grep -q '"starving strangle' "$SHARED"; then ok "a committed manifest change is at \$SHARE_DIR after the next tick, identical to the staged copy"
else bad "a committed manifest change is at \$SHARE_DIR after the next tick ($(grep -m1 'secrets-manifest' "$LOG" || echo 'no install line'))"; fi

# 3. CONTROL: an unchanged manifest is not rewritten.
ino="$(stat -c %i "$SHARED" 2>/dev/null)"
tick
if [ "$(stat -c %i "$SHARED" 2>/dev/null)" = "$ino" ] && ! grep -q 'converged secrets-manifest.json' "$LOG"; then ok "an unchanged manifest is not rewritten on a later tick (same inode, no converged line)"
else bad "an unchanged manifest is not rewritten on a later tick"; fi

# 4. CONTROL: a change whose proof was not refreshed stays as installed.
before="$(cat "$SHARED")"
comment_to "anything drizzly, unrefreshed"; g "$S" commit -am unrefreshed
tick
if [ "$(cat "$SHARED")" = "$before" ] && grep -q 'NOT converged scripts/substrate/secrets-manifest.json' "$LOG"; then ok "a change whose behaviour proof was not refreshed is not installed (the coverage gate holds)"
else bad "a change whose behaviour proof was not refreshed is not installed"; fi

# 5. CONTROL: every reader resolves the manifest to the staged copy or to $SHARE_DIR, and no other path.
SS="$ROOT/scripts/substrate"
grep -qF 'for _m in "$_here/secrets-manifest.json" /usr/local/share/substrate/secrets-manifest.json; do' "$SS/render-secret-scope.sh" \
  && ok "render-secret-scope reads the manifest beside itself, then \$SHARE_DIR" || bad "render-secret-scope reads the manifest beside itself, then \$SHARE_DIR"
grep -qF 'for _m in "$_here/secrets-manifest.json" /usr/local/share/substrate/secrets-manifest.json; do' "$SS/secret-mask-probe.sh" \
  && ok "secret-mask-probe reads the manifest beside itself, then \$SHARE_DIR" || bad "secret-mask-probe reads the manifest beside itself, then \$SHARE_DIR"
grep -qF 'for (const m of ["/usr/local/share/substrate/secrets-manifest.json", `${import.meta.dir}/secrets-manifest.json`])' "$SS/seed-identity.ts" \
  && ok "seed-identity reads \$SHARE_DIR first" || bad "seed-identity reads \$SHARE_DIR first"
grep -qF '[ -f "$SECRETS_MANIFEST" ] || SECRETS_MANIFEST=/usr/local/share/substrate/secrets-manifest.json' "$SS/render-unit.sh" \
  && ok "render-unit falls back to \$SHARE_DIR" || bad "render-unit falls back to \$SHARE_DIR"

echo
[ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
