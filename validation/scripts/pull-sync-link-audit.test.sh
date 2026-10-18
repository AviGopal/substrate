#!/usr/bin/env bash
# pull-sync-link-audit.test.sh: a consumer's node_modules copy of a shared package is relinked to the shared build.
#
# The shared-package fan-out (scripts/substrate/substrate-pull-sync.sh, 2c) swaps the package's dist and assumes
# every consumer's node_modules entry resolves into it. A regular-file COPY does not: measured, a consumer's
# dist/engine.js stayed weeks old under green health while dist/index.js matched. shared_package_link_audit runs
# every tick and relinks such an entry to bun's per-file link layout. This drives the real link_entry_state,
# shared_package_relink, shared_package_link_audit and tree_digest with systemctl, the restart helpers, healthy and
# emit_gap stubbed, over a temp RUNTIME_DIR holding ias-executor-ts (built dist) and goal-host-vessel (its consumer):
#   (a) MUST-FAIL  a stale regular-file copy -> the canonical symlink layout, the old copy kept under
#                  .ias-executor-ts.stale-<UTC>, the consumer restarted exactly once, counted relinked
#   (b) CONTROL    a correct per-file link layout -> untouched, no restart, "ok"
#   (c) MUST-FAIL  a broken entry (dist is a regular file; root reads anything, so "unreadable" is a broken shape)
#                  -> refused, emit_gap with the stable id per (consumer, package), no restart, entry untouched
#   (d) MUST-FAIL  the shared build absent -> refused, same stable id, no restart
#   (e) MUST-FAIL  in-flight work on the consumer -> NOT restarted, nothing touched, deferred and logged; the next
#                  quiet tick relinks and restarts it once
#   (f) MUST-FAIL  at the deferral cap the audit drains (quiesce_drain); a drain that does not reach 0 still does
#                  not restart and touches nothing
#   (g) CONTROL    a copy whose bytes equal the shared build -> relinked, no restart (it already runs those bytes)
#   (h) MUST-FAIL  unhealthy after the restart -> the old copy is restored, restarted again, refused + gap; the next
#                  tick refuses on the same build without another restart
#   (i)            a link layout missing a newly built file is relinked
#   (j)            an open probe window defers with nothing touched and does not count toward the drain cap
# Red on the parent: the functions do not exist there, so extraction fails.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:-$HERE/../../scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/link-audit.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

for fn in tree_digest link_entry_state shared_package_relink shared_package_link_audit; do
  sed -n "/^$fn() {/,/^}/p" "$SCRIPT" >> "$T/fn.sh"
  grep -q "^$fn() {" "$T/fn.sh" || { echo "FAIL - could not extract $fn from $SCRIPT"; exit 1; }
done

RUNTIME_DIR="$T/rt"; MARKER_DIR="$T/markers"; STAGGER_SECONDS=0; PULLSYNC_T0="$(date +%s)"
PKG=ias-executor-ts; C=goal-host-vessel; NAME=@avigopal/ias-executor-ts
E="$RUNTIME_DIR/$C/node_modules/$NAME"; GAP_ID="pull-sync-link-audit-refused-$C-$PKG"
log() { echo "$*" >> "$T/log"; }
emit_gap() { echo "$1" >> "$T/gaps"; }
systemctl() { echo "systemctl $*" >> "$T/calls"; return 0; }
sleep() { :; }
vessel_unit() { case "$1" in "$PKG") echo "" ;; *) echo "$1.service" ;; esac; }
health_port() { echo 19001; }
healthy() { [ "$(cat "$T/healthy")" = 1 ]; }
restart_breadcrumb() { :; }
restart_siblings() { echo "siblings $1" >> "$T/calls"; }
restart_age_defer() { # driven by $T/inflight
  RA_INFLIGHT="$(cat "$T/inflight")"; RA_DEFER=0; RA_PROBE=0; RA_WHY=""
  [ "$RA_INFLIGHT" -gt 0 ] && { RA_DEFER=1; RA_WHY="$RA_INFLIGHT in flight, oldest 1000ms < ceiling"; }
  [ -e "$T/probe" ] && { RA_DEFER=1; RA_PROBE=1; RA_WHY="probe window open on this node"; }
  return 0
}
quiesce_drain() { echo "drain $1" >> "$T/calls"; QD_WHY="still 1 in flight (stub)"; return "$(cat "$T/drain_rc")"; }
# shellcheck disable=SC1091
. "$T/fn.sh"

setup() { # fresh runtime: built shared package + consumer package.json, no entry yet
  rm -rf "$T/rt" "$T/markers"; mkdir -p "$T/rt/$PKG/dist/adapters" "$T/rt/$C" "$T/markers"
  : > "$T/log"; : > "$T/calls"; : > "$T/gaps"; rm -f "$T/probe"; echo 0 > "$T/inflight"; echo 1 > "$T/healthy"; echo 1 > "$T/drain_rc"
  printf '{"name":"%s","scripts":{"build":"tsc"}}\n' "$NAME" > "$T/rt/$PKG/package.json"
  echo 'export * from "./engine.js";' > "$T/rt/$PKG/dist/index.js"
  echo 'export const engine = "new";' > "$T/rt/$PKG/dist/engine.js"
  echo 'export const a = 1;' > "$T/rt/$PKG/dist/adapters/index.js"
  printf '{"name":"%s","dependencies":{"%s":"file:%s/%s"}}\n' "$C" "$NAME" "$RUNTIME_DIR" "$PKG" > "$T/rt/$C/package.json"
  mkdir -p "$E"; ln -s "$RUNTIME_DIR/$PKG/package.json" "$E/package.json"
}
links() { mkdir -p "$E/dist/adapters"; for f in index.js engine.js adapters/index.js; do ln -s "$RUNTIME_DIR/$PKG/dist/$f" "$E/dist/$f"; done; }
copy() { cp -a "$RUNTIME_DIR/$PKG/dist" "$E/dist"; [ "${1:-stale}" = stale ] && echo 'export const engine = "weeks old";' > "$E/dist/engine.js"; return 0; }
restarts() { grep -c "^systemctl restart $C.service$" "$T/calls"; }
layout() { (cd "$E" && find . -printf '%p %y %l\n' | LC_ALL=C sort); }
stale_dirs() { find "$RUNTIME_DIR/$C/node_modules/@avigopal" -maxdepth 1 -name ".$PKG.stale-*" | wc -l; }
canonical() { for f in index.js engine.js adapters/index.js; do [ -L "$E/dist/$f" ] && [ "$(readlink "$E/dist/$f")" = "$RUNTIME_DIR/$PKG/dist/$f" ] || return 1; done; }
tick() { : > "$T/calls"; shared_package_link_audit; }

# (a) stale regular-file copy
setup; copy stale; tick
canonical && ok "(a) a regular-file copy becomes the canonical per-file link layout" || bad "(a) the copy was not relinked: $(layout | tr '\n' ';')"
S="$(find "$RUNTIME_DIR/$C/node_modules/@avigopal" -maxdepth 1 -name ".$PKG.stale-*" | head -1)"
[ -n "$S" ] && [ -f "$S/dist/engine.js" ] && [ ! -L "$S/dist/engine.js" ] && grep -q 'weeks old' "$S/dist/engine.js" \
  && ok "(a) the old copy is preserved under node_modules/@avigopal/.$PKG.stale-<UTC>" || bad "(a) the old copy was not preserved (stale dir '${S:-none}')"
[ "$(restarts)" = 1 ] && ok "(a) the consumer is restarted exactly once" || bad "(a) restarts: $(restarts) (want 1)"
grep -q "^link-audit: $C $NAME relinked" "$T/log" && [ "$LA_RELINKED" = 1 ] && jq -e '.relinked == 1' "$MARKER_DIR/link-audit.json" >/dev/null 2>&1 \
  && ok "(a) logged 'link-audit: ... relinked', counted, and recorded in link-audit.json" || bad "(a) no relinked line/counter: $(tr '\n' ';' < "$T/log")"

# (b) correct link layout
setup; links; before="$(layout)"; tick
[ "$(layout)" = "$before" ] && [ "$(stale_dirs)" = 0 ] && ok "(b) control: a correct link layout is untouched" || bad "(b) control: the link layout changed"
[ "$(restarts)" = 0 ] && ok "(b) control: no restart" || bad "(b) control: restarted $(restarts) time(s)"
grep -q "^link-audit: $C $NAME ok$" "$T/log" && [ "$LA_OK" = 1 ] && ok "(b) control: logged ok and counted" || bad "(b) control: no ok line"

# (c) broken entry: dist is a regular file
setup; echo junk > "$E/dist"; before="$(layout)"; tick
grep -q "\"id\":\"$GAP_ID\"" "$T/gaps" && ok "(c) a broken entry files the gap with the stable id $GAP_ID" || bad "(c) no gap with id $GAP_ID: $(cat "$T/gaps")"
[ "$(restarts)" = 0 ] && [ "$(layout)" = "$before" ] && ok "(c) no restart, entry untouched" || bad "(c) restarted or touched"
grep -q "^link-audit: $C $NAME refused" "$T/log" && [ "$LA_REFUSED" = 1 ] && ok "(c) logged refused and counted" || bad "(c) no refused line"

# (d) shared build absent
setup; copy stale; rm -f "$RUNTIME_DIR/$PKG/dist/index.js"; before="$(layout)"; tick
grep -q "\"id\":\"$GAP_ID\"" "$T/gaps" && grep -q "refused — the shared build" "$T/log" && ok "(d) an absent shared build is refused with the stable gap id" || bad "(d) not refused: $(tr '\n' ';' < "$T/log")"
[ "$(restarts)" = 0 ] && [ "$(layout)" = "$before" ] && ok "(d) no restart, entry untouched" || bad "(d) restarted or touched"

# (e) in-flight work defers; the next quiet tick takes it
setup; copy stale; echo 1 > "$T/inflight"; before="$(layout)"; tick
[ "$(restarts)" = 0 ] && ok "(e) a consumer with work in flight is NOT restarted this tick" || bad "(e) restarted under in-flight work"
[ "$(layout)" = "$before" ] && ok "(e) nothing is touched under the running process" || bad "(e) the entry changed while deferred"
grep -q "^link-audit: $C $NAME deferred" "$T/log" && [ "$LA_DEFERRED" = 1 ] && ok "(e) the deferral is logged and counted" || bad "(e) no deferred line"
echo 0 > "$T/inflight"; : > "$T/log"; tick
canonical && [ "$(restarts)" = 1 ] && ok "(e) the next quiet tick relinks and restarts it once" || bad "(e) quiet tick: restarts $(restarts), canonical=$(canonical && echo y || echo n)"

# (f) at the cap: drain; a drain that does not reach 0 does not restart
setup; copy stale; echo 1 > "$T/inflight"; echo 3 > "$MARKER_DIR/$C.link-audit-$PKG.deferrals"; before="$(layout)"; tick
grep -q "^drain $C$" "$T/calls" && ok "(f) at the deferral cap the audit closes admission and drains" || bad "(f) no drain at the cap"
[ "$(restarts)" = 0 ] && [ "$(layout)" = "$before" ] && ok "(f) an undrained consumer is still not restarted, entry untouched" || bad "(f) restarted into in-flight work after the drain"
echo 0 > "$T/drain_rc"; tick
canonical && [ "$(restarts)" = 1 ] && ok "(f) a drain that reaches 0 lets the relink and one restart through" || bad "(f) drained: restarts $(restarts)"

# (g) identical bytes: relink, no restart
setup; copy same; tick
canonical && [ "$(restarts)" = 0 ] && [ "$(stale_dirs)" = 1 ] && ok "(g) control: a byte-identical copy is relinked without a restart" || bad "(g) control: restarts $(restarts), canonical=$(canonical && echo y || echo n)"

# (h) unhealthy after the restart: restore, refuse, and do not loop
setup; copy stale; echo 0 > "$T/healthy"; tick
[ -f "$E/dist/engine.js" ] && [ ! -L "$E/dist/engine.js" ] && grep -q 'weeks old' "$E/dist/engine.js" && [ "$(stale_dirs)" = 0 ] \
  && ok "(h) unhealthy: the old copy is restored in place" || bad "(h) the old copy was not restored: $(layout | tr '\n' ';')"
[ "$(restarts)" = 2 ] && grep -q "\"id\":\"$GAP_ID\"" "$T/gaps" && ok "(h) restarted again onto the old copy and refused with the gap" || bad "(h) restarts $(restarts), gaps: $(cat "$T/gaps")"
: > "$T/gaps"; tick
[ "$(restarts)" = 0 ] && grep -q "\"id\":\"$GAP_ID\"" "$T/gaps" && ok "(h) the next tick on the same build refuses without another restart" || bad "(h) looped: restarts $(restarts)"

# (i) a link layout missing a newly built file
setup; links; echo 'export const n = 1;' > "$RUNTIME_DIR/$PKG/dist/new.js"; tick
[ -L "$E/dist/new.js" ] && canonical && ok "(i) a link layout missing a newly built file is relinked" || bad "(i) the new file was not linked"

# (j) probe window: deferred, untouched, not counted toward the drain
setup; copy stale; : > "$T/probe"; before="$(layout)"; tick
[ "$(restarts)" = 0 ] && [ "$(layout)" = "$before" ] && grep -q "^link-audit: $C $NAME deferred" "$T/log" && [ ! -e "$MARKER_DIR/$C.link-audit-$PKG.deferrals" ] \
  && ok "(j) a probe window defers with nothing touched and no deferral counted" || bad "(j) probe window: restarts $(restarts), deferrals $(cat "$MARKER_DIR/$C.link-audit-$PKG.deferrals" 2>/dev/null)"

[ "$FAILS" = 0 ] && { echo "all link-audit cases pass"; exit 0; }
echo "$FAILS case(s) failed"; exit 1
