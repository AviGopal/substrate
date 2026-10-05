#!/usr/bin/env bash
# A TRACKED build output (human-surface-vessel's ui/dist — committed on purpose,
# since nothing rebuilds on pull) reaches the runtime, and a change to it alone
# is seen, mirrored atomically, and owes no restart.
#
# Runs the REAL mirror-to-live.sh against a temp clone/runtime pair, plus
# content_hash/tracked_output_dirs and the mirror -> restart slice extracted
# from substrate-pull-sync.sh (systemctl stubbed to record calls).
#
#   (a) a ui/dist-only difference makes the clone and runtime hashes differ
#   (b) mirror-to-live swaps ui/dist in: new asset present, the asset the commit
#       deleted gone, every asset index.html names exists, no stage/prev left,
#       an untracked file in the clone's ui/dist neither carried nor counted as
#       drift; hashes then equal
#   (c) one byte changed in a live asset is drift (hashes differ)
#   (d) a ui/dist-only range is mirrored and does NOT restart the unit
#   (e) a ui/dist + src range restarts
#   (f) root dist/ (the package build pull-sync owns) is not tracked output and
#       a range touching it restarts
#   (g) a repo with no tracked output hashes exactly as before (no fleet re-mirror)
#   (h) both scripts' tracked_output_dirs agree
#   (i) identity-vessel's shape: the clone tracks scripts/ that the image never copied, and
#       package.json names file:../../packages/<pkg> (rewritten for the runtime). Before a mirror the
#       hashes differ (the drift heal's "content drift"); ONE real mirror makes them equal, so the next
#       tick sees no drift and owes no restore/restart; the deploy-rewritten package.json is not hashed.
#
# usage: validation/scripts/pull-sync-tracked-dist-mirror.test.sh [repo-root]
# Needs bash, git, awk, sed, tar. No root: every path is a temp dir.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$ROOT/scripts/substrate/substrate-pull-sync.sh"
MIRROR="$ROOT/scripts/substrate/mirror-to-live.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── the code under test, taken from the scripts themselves ─────────────────────
{
  sed -n '/^tracked_output_dirs() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash_nontest() {/,/^}/p' "$SCRIPT"
  echo 'run_slice() {'
  echo 'for v in "$VESSEL"; do'
  awk '/^  PREV_GOOD="\$\(cat "\$LAST_GOOD_DIR\/\$v"/{on=1} on{print} on && /^  echo "\$HEAD" > "\$LAST_GOOD_DIR\/\$v"$/{exit}' "$SCRIPT"
  echo 'done'
  echo '}'
} | sed -e "s#/usr/local/bin/mirror-to-live#mirror_real#g" > "$T/fns.sh"
grep -q 'mirror_real' "$T/fns.sh" || { echo "FAIL - could not extract the mirror->restart slice"; exit 1; }
sed -n '/^tracked_output_dirs() {/,/^}/p' "$MIRROR" | sed 's/^tracked_output_dirs()/mirror_tracked_output_dirs()/' > "$T/mfns.sh"

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
mirror_real() { echo "MIRROR $1" >> "$CALLS"; MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$1" "$2" >> "$LOG" 2>&1; }
systemctl() {
  case "$1" in
    is-active) return 0 ;;
    is-enabled) echo enabled ;;
    restart) echo "RESTART $2" >> "$CALLS" ;;
    *) : ;;
  esac
}
vessel_unit() { echo "$1.service"; }
health_port() { :; }
healthy() { return 0; }
restart_age_defer() { RA_INFLIGHT=""; RA_OLDEST=""; RA_DEFER=0; RA_WHY=""; }
restart_breadcrumb() { :; }
restart_siblings() { echo "SIBLINGS $1" >> "$CALLS"; }
# shellcheck disable=SC1090
source "$T/fns.sh"; source "$T/mfns.sh"

VESSEL=demo-vessel
CLONE_DIR="$T/clones"; RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; LAST_GOOD_DIR="$T/lastgood"
DEFERRAL_LOG="$T/deferrals.jsonl"; BRANCH=dev; STAGGER_SECONDS=0; CLONE_HASH=c1; RUNTIME_HASH=r1
d="$CLONE_DIR/$VESSEL/"; R="$RUNTIME_DIR/$VESSEL"; MARKER="$MARKER_DIR/$VESSEL.sha"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
bundle() { # name -> a ui/dist whose index.html names assets/<name>.js
  rm -rf "$d/ui/dist"; mkdir -p "$d/ui/dist/assets"
  echo "<script src=\"/assets/$1.js\"></script>" > "$d/ui/dist/index.html"
  echo "console.log('$1')" > "$d/ui/dist/assets/$1.js"
}
setup() { # base commit (bundle OLD) pinned as last-good, runtime = that commit
  rm -rf "$T/clones" "$T/runtime" "$T/marker" "$T/lastgood"
  mkdir -p "$d/src" "$R" "$MARKER_DIR" "$LAST_GOOD_DIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  bundle index-OLD
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  cp -r "$d/src" "$R/src"; mkdir -p "$R/ui"; cp -r "$d/ui/dist" "$R/ui/dist"
  : > "$CALLS"; : > "$LOG"; synced=0; failed=0; skipped=0
}
run() { HEAD="$(git -C "$d" rev-parse HEAD)"; run_slice; }
hc() { content_hash "$1" "$d" 2>/dev/null; }

# ── (a) a ui/dist-only commit is visible to the hash ───────────────────────────
setup
bundle index-NEW; g add -A; g commit -m ui
[ "$(hc "$d")" != "$(hc "$R")" ] && ok "(a) a ui/dist-only difference changes the hash" || bad "(a) clone and runtime hash equal although ui/dist differs"

# ── (b) the real mirror swaps ui/dist in ───────────────────────────────────────
echo stray > "$d/ui/dist/untracked.txt"   # untracked: must not ship
MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$VESSEL" "$CLONE_DIR" > "$T/m.out" 2>&1 \
  && ok "(b) mirror-to-live exits 0" || { bad "(b) mirror-to-live failed"; cat "$T/m.out"; }
[ -f "$R/ui/dist/assets/index-NEW.js" ] && ok "(b) the new asset is live" || bad "(b) the new asset did not reach the runtime"
[ ! -e "$R/ui/dist/assets/index-OLD.js" ] && ok "(b) the asset the commit deleted is gone" || bad "(b) the deleted asset still sits in the runtime"
ref="$(sed -n 's#.*src="/\([^"]*\)".*#\1#p' "$R/ui/dist/index.html")"
[ -n "$ref" ] && [ -f "$R/ui/dist/$ref" ] && ok "(b) live index.html names an asset that exists ($ref)" || bad "(b) live index.html names a missing asset ('$ref')"
[ ! -e "$R/ui/.dist.stage" ] && [ ! -e "$R/ui/.dist.prev" ] && ok "(b) no .dist.stage/.dist.prev left behind" || bad "(b) stage/prev left behind"
[ ! -e "$R/ui/dist/untracked.txt" ] && ok "(b) an untracked clone file is not shipped" || bad "(b) an untracked clone file was shipped"
[ "$(hc "$d")" = "$(hc "$R")" ] && ok "(b) after the mirror the hashes are equal, an untracked clone file notwithstanding" || bad "(b) hashes still differ after the mirror"

# ── (c) one byte in a live asset is drift ──────────────────────────────────────
printf 'x' >> "$R/ui/dist/assets/index-NEW.js"
[ "$(hc "$d")" != "$(hc "$R")" ] && ok "(c) one byte changed in a live asset is drift" || bad "(c) a modified live asset hashes equal to the clone"

# ── (d) ui/dist-only range: mirrored, no restart ───────────────────────────────
setup
bundle index-NEW; g add -A; g commit -m ui
run
grep -q "^MIRROR $VESSEL" "$CALLS" && ok "(d) a ui/dist-only range is mirrored" || bad "(d) not mirrored"
[ -f "$R/ui/dist/assets/index-NEW.js" ] && ok "(d) and the new bundle is live" || bad "(d) the new bundle is not live after the slice"
grep -q '^RESTART' "$CALLS" && bad "(d) a ui/dist-only range restarted the unit (it serves the files from disk)" || ok "(d) a ui/dist-only range does not restart the unit"
[ "$(cat "$LAST_GOOD_DIR/$VESSEL")" = "$HEAD" ] && ok "(d) last-good advances to HEAD" || bad "(d) last-good did not advance"

# ── (e) ui/dist + src: restarts ────────────────────────────────────────────────
setup
bundle index-NEW; echo 'export const x = 2;' > "$d/src/x.ts"; g add -A; g commit -m both
run
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(e) a ui/dist + src range restarts" || bad "(e) a range with src did not restart"

# ── (f) root dist/ is code, not tracked output ─────────────────────────────────
setup
mkdir -p "$d/dist"; echo 'module.exports=1' > "$d/dist/index.js"; g add -A; g commit -m rootdist
[ -z "$(tracked_output_dirs "$d" | grep -x dist)" ] && ok "(f) root dist/ is not tracked output" || bad "(f) root dist/ was treated as tracked output"
run
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(f) a range touching root dist/ restarts" || bad "(f) a root dist/ change skipped the restart"

# ── (g) no tracked output: hash identical to the src/sql/scripts formula ───────
rm -rf "$T/plain"; mkdir -p "$T/plain/src"; echo 'export const p = 1;' > "$T/plain/src/p.ts"
git -C "$T/plain" init -q; git -C "$T/plain" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$T/plain" -c user.name=t -c user.email=t@t commit -qm p
old="$(cd "$T/plain" && find src sql scripts -type f \( -name '*.ts' -o -name '*.json' -o -name '*.surql' -o -name '*.sh' \) -not -path '*/node_modules/*' 2>/dev/null | sort | xargs -r md5sum | md5sum | cut -d' ' -f1)"
[ "$(content_hash "$T/plain" 2>/dev/null)" = "$old" ] && ok "(g) a repo without tracked output hashes as before" || bad "(g) the hash changed for a repo with no tracked output (would re-mirror the fleet)"

# ── (h) the copy side and the hash side read the same dirs ─────────────────────
setup
mkdir -p "$d/pkg/web/dist" "$d/src/dist"; echo a > "$d/pkg/web/dist/a.js"; echo b > "$d/src/dist/b.js"; g add -A; g commit -m more
want="$(printf 'pkg/web/dist\nui/dist')"
[ "$(tracked_output_dirs "$d" 2>/dev/null)" = "$want" ] && ok "(h) pull-sync lists ui/dist + pkg/web/dist (not src/dist)" || bad "(h) pull-sync tracked_output_dirs = '$(tracked_output_dirs "$d" 2>/dev/null | tr '\n' ' ')'"
[ "$(mirror_tracked_output_dirs "$d" 2>/dev/null)" = "$want" ] && ok "(h) mirror-to-live lists the same dirs" || bad "(h) mirror-to-live tracked_output_dirs disagrees"

# ── (i) a clone-only scripts/ is drift exactly once: one mirror settles it ─────
rm -rf "$T/clones" "$T/runtime"; mkdir -p "$d/src" "$d/scripts/git-hooks" "$R/src"
echo 'export const i = 1;' > "$d/src/index.ts"; echo 'echo key' > "$d/scripts/generate-api-key.sh"
echo 'export {};' > "$d/scripts/generate-bootstrap-key.ts"; echo '# hooks' > "$d/scripts/git-hooks/README.md"
printf '%s\n' '{"name":"iv","dependencies":{"@x/vdc":"file:../../packages/vdc"}}' > "$d/package.json"
git -C "$d" init -q -b dev; g add -A; g commit -m base
cp "$d/src/index.ts" "$R/src/index.ts"
sed "s|file:\.\./\.\./packages/|file:$RUNTIME_DIR/packages/|g; s|file:\.\./|file:$RUNTIME_DIR/|g" "$d/package.json" > "$R/package.json"
[ "$(hc "$d")" != "$(hc "$R")" ] && ok "(i) a clone-only scripts/ reads as drift before the mirror" || bad "(i) no drift although the runtime lacks scripts/"
MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$VESSEL" "$CLONE_DIR" > "$T/mi.out" 2>&1 && ok "(i) mirror-to-live exits 0" || { bad "(i) mirror-to-live failed"; cat "$T/mi.out"; }
[ "$(hc "$d")" = "$(hc "$R")" ] && ok "(i) one mirror settles it: the next tick sees no drift (no restore, no restart)" || bad "(i) hashes still differ after the mirror — the drift heal would restore+restart every tick"
grep -q 'package.json changed' "$T/mi.out" && bad "(i) the runtime-rewritten package.json read as a dependency change" || ok "(i) the rewritten package.json is not a dependency change"
before="$(hc "$R")"; printf '%s\n' '{"name":"iv","dependencies":{"@x/vdc":"file:/elsewhere/vdc"}}' > "$R/package.json"
[ "$(hc "$R")" = "$before" ] && ok "(i) a deploy-rewritten package.json is not hashed as drift" || bad "(i) package.json is hashed: a deploy rewrite reads as drift"
echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
