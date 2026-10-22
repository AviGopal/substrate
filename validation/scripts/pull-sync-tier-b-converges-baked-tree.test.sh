#!/usr/bin/env bash
# The baked super-repo tree the federation units run from converges in place from the ACCEPTED gate
# (scripts/substrate/substrate-pull-sync.sh: converge_tier_b and its tierb_* helpers; in-place-image-convergence 2.4).
#
# The failure it pins: the transport and relay run the IMAGE BAKE (/usr/local/share/substrate/super-repo/...), and
# nothing converged that tree, so an accepted transport or relay fix ran nowhere until a recreate, and a restart
# reloaded the old file while reading as success (913bc251, measured on the hub 2026-10-18T02:39:35Z).
#
# converge_tier_b, taken from the script itself, runs against a scratch accepted gate, a scratch baked tree and a
# scratch vessels manifest. systemctl, healthy, the probe window, the gap writer and sleep are stubbed and recorded;
# a restart stamps the unit's start time unless the case says it never comes back.
#   (a) a transport-only change converges: the baked file equals the accepted one, the transport restarts once, the
#       relay does not, CONVERGED is logged and the record names the accepted sha
#   (b) image-owned files are untouched (node_modules, package.json, bun.lock), a file accepted/ lacks is kept,
#       a mode change and a symlink converge as git records them
#   (c) CONTROL: the same tick again, with the tree now equal: nothing restarts, nothing is staged, state current
#   (d) a relay.ts change restarts the relay (no health port: active, and started after the swap)
#   (e) a transport that does not come back healthy: last-good is restored byte for byte, a file the swap added
#       is removed again, the transport restarts a second time, the tick counts failed, one gap is filed and the
#       tree is refused
#   (f) the refused tree is not tried again on the next tick (no restart, no swap)
#   (g) a unit whose start time does not move after the restart (it never reloaded) is NOT converged: restored
#   (g2) a unit whose start rewrites a file it loads (the tree on disk no longer hashes to accepted) is NOT converged
#   (h) an ungated tick (no accepted gate) converges nothing
#   (i) held, untouched: the coverage map names no tier_b fixture; and it names one the accepted corpus lacks
#   (j) held, untouched: the accepted relay dependencies differ from the ones the image installed
#   (k) held, untouched: a probe window is open on the node
#   (l) a unit that is not active, or that systemd runs from another tree, is not restarted; the tree converges
# a restart that did not happen is still owed (the tree on disk already equals accepted):
#   (n) a unit left owed by a tick that swapped and was killed before the restart is restarted on the next tick
#   (o) a unit whose loaded set moved on disk under it (its start is the recorded one, its hash is not) is restarted,
#       and the record then names its new start; with the record matching, (c) is the control (no restart)
#   (p) such a restart that does not come back ready: failed and filed, nothing restored (nothing was swapped), and
#       the next tick does not bounce it again
# structure:
#   (m) converge_tier_b runs at top level every tick, after converge_fleet_defs, and the done line reports tier_b
#
# usage: validation/scripts/pull-sync-tier-b-converges-baked-tree.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap '[ -n "${KEEP_T:-}" ] || rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
finish() { [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }; }

{ sed -n '/^unit_start_epoch() {/,/^}/p' "$SCRIPT"; sed -n '/^TIERB_DST=/,/^converge_tier_b() {/p' "$SCRIPT" | sed '$d'
  sed -n '/^converge_tier_b() {/,/^}/p' "$SCRIPT"; } > "$T/fns.sh"
if ! grep -q '^converge_tier_b() {' "$T/fns.sh" || ! grep -q '^tierb_restore() {' "$T/fns.sh"; then
  bad "substrate-pull-sync.sh has no converge_tier_b (with tierb_restore): nothing converges the baked tree the federation units run from"
  finish
fi

ACCSHA=0123456789abcdef0123456789abcdef01234567
mk() { # <dir>: an accepted gate ($1/acc), a baked tree ($1/baked/scripts/substrate), a fleet manifest, a unit state dir
  local d="$1" A="$1/acc/scripts/substrate" B="$1/baked/scripts/substrate"
  mkdir -p "$A/federation-relay" "$A/gate" "$A/units" "$1/acc/validation/scripts/gate/fixtures" "$B" "$d/fleet" "$d/sys" "$d/mk"
  printf '{"sha":"%s"}\n' "$ACCSHA" > "$d/acc/MANIFEST.json"
  echo 'echo fixture' > "$1/acc/validation/scripts/gate/fixtures/federation-relay-large-frames.sh"
  jq -n '{tier_b: {fixtures: ["federation-relay-large-frames.sh"]}, paths: {}}' > "$A/gate/coverage.json"
  printf "import { createLibp2p } from 'libp2p'\nconsole.log('relay v1')\n" > "$A/federation-relay/relay.ts"
  printf "import { decideIngress } from './ingress-auth'\nimport x from 'libp2p'\nconsole.log('server v1')\n" > "$A/federation-relay/federation-transport-server.ts"
  printf "export const decideIngress = () => 'v2'\n" > "$A/federation-relay/ingress-auth.ts"
  jq -n '{name: "r", dependencies: {libp2p: "^3", "@avigopal/libp2p-federation-transport": "file:../../../repos/x"}}' > "$A/federation-relay/package.json"
  echo 'lock from git' > "$A/federation-relay/bun.lock"
  printf '[Service]\nExecStart=/bin/true\n' > "$A/units/x.service"
  printf '#!/bin/sh\necho tool\n' > "$A/tool.sh"; chmod 755 "$A/tool.sh"
  ln -s ../../docker-compose.yml "$A/docker-compose.yml"
  # The bake: an older ingress-auth, tool.sh without its exec bit, a regular file where git has a symlink, the
  # image-rewritten package.json and lock, node_modules, and a host-only script accepted/ excludes.
  cp -a "$A/." "$B/"
  printf "export const decideIngress = () => 'v1'\n" > "$B/federation-relay/ingress-auth.ts"
  chmod 644 "$B/tool.sh"
  rm -f "$B/docker-compose.yml"; echo 'not a link' > "$B/docker-compose.yml"
  jq 'del(.dependencies["@avigopal/libp2p-federation-transport"])' "$A/federation-relay/package.json" > "$B/federation-relay/package.json"
  echo 'lock the image wrote' > "$B/federation-relay/bun.lock"
  mkdir -p "$B/federation-relay/node_modules/libp2p"; echo 'module.exports = 1' > "$B/federation-relay/node_modules/libp2p/index.js"
  echo 'host only' > "$B/deploy-hub-pull.sh"
  jq -n --arg w "$B/federation-relay" '{vessels: [
    {name: "federation-relay", workdir: $w, exec: "relay.ts", health_port: null},
    {name: "federation-transport-vessel", workdir: $w, exec: "federation-transport-server.ts", health_port: 8401},
    {name: "other-vessel", workdir: "$REPO_ROOT/repos/other", exec: "src/index.ts"}]}' > "$d/fleet/vessels.manifest.json"
  for u in federation-relay federation-transport-vessel; do
    echo active > "$d/sys/$u.service.state"; echo "$B/federation-relay" > "$d/sys/$u.service.wd"
    echo $(( $(date +%s) - 1000 )) > "$d/sys/$u.service.start"
  done
  echo 1 > "$d/sys/healthy"; echo 1 > "$d/sys/reload"; echo NONE > "$d/sys/probe"
}
run() { # <dir> [ungated]: one tick of converge_tier_b; prints "<TIERB_STATE> <failed>", logs to $d/log
  local d="$1"
  ( . "$T/fns.sh"
    S="$d/sys"
    systemctl() {
      case "$1" in
        is-active) [ "$(cat "$S/$2.state" 2>/dev/null)" = active ] ;;
        restart) echo "$2" >> "$S/restarts"; [ "$(cat "$S/reload")" = 1 ] && date +%s > "$S/$2.start"
                 [ -s "$S/clobber" ] && echo "// rewritten at start" >> "$(cat "$S/clobber")"; return 0 ;;
        show) case "$3" in
                WorkingDirectory) cat "$S/$5.wd" 2>/dev/null ;;
                ActiveEnterTimestamp) [ -f "$S/$5.start" ] && echo "@$(cat "$S/$5.start")" ;;
              esac ;;
      esac
    }
    healthy() { [ "$(cat "$S/healthy")" = 1 ]; }
    probe_window_open() { [ "$(cat "$S/probe")" = OPEN ] && { PW_WHY="probe window w1"; return 0; }; return 1; }
    log() { echo "$*" >> "$d/log"; }
    emit_gap() { echo "$1" >> "$d/gaps"; }
    restart_breadcrumb() { :; }
    sleep() { :; }
    TIERB_DST="$d/baked/scripts/substrate"; TIERB_WORK="$d/work"; MARKER_DIR="$d/mk"; FLEET_DIR="$d/fleet"
    STAGGER_SECONDS=0; failed=0; PULLSYNC_ACCEPTED_DIR="$d/acc"; [ "${2:-}" = ungated ] && PULLSYNC_ACCEPTED_DIR=""
    converge_tier_b
    echo "$TIERB_STATE $failed" )
}
blob() { git hash-object --no-filters "$1"; }
restarts() { [ -f "$1/sys/restarts" ] || { echo 0; return; }; grep -cx "$2" "$1/sys/restarts"; }
same() { cmp -s "$1" "$2"; }

# (a) + (b) + (c)
D="$T/a"; mk "$D"; A="$D/acc/scripts/substrate"; B="$D/baked/scripts/substrate"
cp "$B/federation-relay/package.json" "$T/pkg.before"; cp "$B/federation-relay/bun.lock" "$T/lock.before"
r="$(run "$D")"
if [ "$r" = "converged 0" ] && same "$A/federation-relay/ingress-auth.ts" "$B/federation-relay/ingress-auth.ts" \
   && [ "$(restarts "$D" federation-transport-vessel.service)" = 1 ] && [ "$(restarts "$D" federation-relay.service)" = 0 ] \
   && grep -q "tier-b: CONVERGED $B to accepted $ACCSHA" "$D/log" && [ "$(jq -r .accepted_sha "$D/mk/tier-b.json")" = "$ACCSHA" ]; then
  ok "(a) a transport-only change converges: file installed, the transport restarted once, the relay not, CONVERGED recorded"
else bad "(a) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts" 2>/dev/null); log: $(tail -3 "$D/log" 2>/dev/null | tr '\n' ' ')"; fi
if same "$T/pkg.before" "$B/federation-relay/package.json" && same "$T/lock.before" "$B/federation-relay/bun.lock" \
   && [ -f "$B/federation-relay/node_modules/libp2p/index.js" ] && [ -f "$B/deploy-hub-pull.sh" ] \
   && [ -x "$B/tool.sh" ] && [ "$(readlink "$B/docker-compose.yml")" = ../../docker-compose.yml ]; then
  ok "(b) image-owned files untouched, a file accepted/ lacks kept, the mode and the symlink converged"
else bad "(b) image-owned or extra files changed, or mode/symlink not converged (x=$([ -x "$B/tool.sh" ] && echo y || echo n) link=$(readlink "$B/docker-compose.yml"))"; fi
: > "$D/sys/restarts"
r="$(run "$D")"
if [ "$r" = "current 0" ] && [ ! -s "$D/sys/restarts" ] && [ ! -d "$D/work/stage" ]; then
  ok "(c) CONTROL: an unchanged tree restarts nothing and stages nothing (state current)"
else bad "(c) unchanged tree: got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts")"; fi

# (d)
D="$T/d"; mk "$D"; A="$D/acc/scripts/substrate"; B="$D/baked/scripts/substrate"
cp "$A/federation-relay/ingress-auth.ts" "$B/federation-relay/ingress-auth.ts"
printf "import { createLibp2p } from 'libp2p'\nconsole.log('relay v0')\n" > "$B/federation-relay/relay.ts"
r="$(run "$D")"
if [ "$r" = "converged 0" ] && [ "$(restarts "$D" federation-relay.service)" = 1 ] && [ "$(restarts "$D" federation-transport-vessel.service)" = 0 ] \
   && same "$A/federation-relay/relay.ts" "$B/federation-relay/relay.ts"; then
  ok "(d) a relay.ts change restarts the relay only, which converges by start time and state"
else bad "(d) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts" 2>/dev/null)"; fi

# (e) + (f)
D="$T/e"; mk "$D"; A="$D/acc/scripts/substrate"; B="$D/baked/scripts/substrate"
echo "export const added = 1" > "$A/federation-relay/new-module.ts"
printf "import { decideIngress } from './ingress-auth'\nimport { added } from './new-module'\nconsole.log('server v2')\n" > "$A/federation-relay/federation-transport-server.ts"
cp "$B/federation-relay/ingress-auth.ts" "$T/e-ingress.before"; cp "$B/federation-relay/federation-transport-server.ts" "$T/e-server.before"
echo 0 > "$D/sys/healthy"
r="$(run "$D")"
if [ "$r" = "restored 1" ] && same "$T/e-ingress.before" "$B/federation-relay/ingress-auth.ts" \
   && same "$T/e-server.before" "$B/federation-relay/federation-transport-server.ts" && [ ! -e "$B/federation-relay/new-module.ts" ] \
   && [ "$(restarts "$D" federation-transport-vessel.service)" = 2 ] && [ "$(restarts "$D" federation-relay.service)" = 0 ] \
   && [ "$(grep -c '"pull-sync-tier-b-convergence-refused"' "$D/gaps" 2>/dev/null)" = 1 ] && [ -s "$D/mk/tier-b.refused" ]; then
  ok "(e) not healthy: last-good restored byte for byte, the added file removed, restarted again, failed, one gap, refused"
else bad "(e) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts" 2>/dev/null); new-module present: $([ -e "$B/federation-relay/new-module.ts" ] && echo y || echo n); log: $(tail -2 "$D/log" | tr '\n' ' ')"; fi
: > "$D/sys/restarts"; echo 1 > "$D/sys/healthy"
r="$(run "$D")"
if [ "$r" = "refused 0" ] && [ ! -s "$D/sys/restarts" ] && same "$T/e-server.before" "$B/federation-relay/federation-transport-server.ts"; then
  ok "(f) the refused tree is not tried again on the next tick"
else bad "(f) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts")"; fi

# (g)
D="$T/g"; mk "$D"; B="$D/baked/scripts/substrate"
cp "$B/federation-relay/ingress-auth.ts" "$T/g-ingress.before"; echo 0 > "$D/sys/reload"
r="$(run "$D")"
if [ "$r" = "restored 1" ] && same "$T/g-ingress.before" "$B/federation-relay/ingress-auth.ts" && ! grep -q 'CONVERGED' "$D/log"; then
  ok "(g) a unit whose start time did not move after the restart is not converged: restored"
else bad "(g) got '$r'; log: $(tail -2 "$D/log" | tr '\n' ' ')"; fi

# (g2)
D="$T/g2"; mk "$D"; B="$D/baked/scripts/substrate"
echo "$B/federation-relay/ingress-auth.ts" > "$D/sys/clobber"
r="$(run "$D")"
if [ "$r" = "restored 1" ] && ! grep -q 'CONVERGED' "$D/log" && grep -q 'loads [0-9a-f]*, not the accepted' "$D/log"; then
  ok "(g2) a unit whose start rewrote a file it loads is not converged: restored"
else bad "(g2) got '$r'; log: $(tail -2 "$D/log" | tr '\n' ' ')"; fi

# (h)
D="$T/h"; mk "$D"; B="$D/baked/scripts/substrate"; cp "$B/federation-relay/ingress-auth.ts" "$T/h.before"
r="$(run "$D" ungated)"
if [ "$r" = "ungated 0" ] && same "$T/h.before" "$B/federation-relay/ingress-auth.ts" && [ ! -s "$D/sys/restarts" ]; then
  ok "(h) an ungated tick converges nothing"
else bad "(h) got '$r'"; fi

held_untouched() { # <case> <dir> <log-pattern>
  local r; r="$(run "$2")"
  if [ "$r" = "held 0" ] && same "$T/held.before" "$2/baked/scripts/substrate/federation-relay/ingress-auth.ts" \
     && [ ! -s "$2/sys/restarts" ] && grep -q "$3" "$2/log"; then ok "$1"
  else bad "$1: got '$r'; log: $(tail -1 "$2/log" 2>/dev/null)"; fi
}
# (i)
D="$T/i1"; mk "$D"; cp "$D/baked/scripts/substrate/federation-relay/ingress-auth.ts" "$T/held.before"
jq '.tier_b.fixtures = []' "$D/acc/scripts/substrate/gate/coverage.json" > "$T/c.json" && mv "$T/c.json" "$D/acc/scripts/substrate/gate/coverage.json"
held_untouched "(i) held, untouched: the coverage map names no tier_b fixture" "$D" 'names no behaviour fixture'
D="$T/i2"; mk "$D"; rm -f "$D/acc/validation/scripts/gate/fixtures/federation-relay-large-frames.sh"
held_untouched "(i) held, untouched: the named fixture is not in the accepted corpus" "$D" 'is not in the accepted corpus'
# (j)
D="$T/j"; mk "$D"
jq '.dependencies["@libp2p/new"] = "^1"' "$D/acc/scripts/substrate/federation-relay/package.json" > "$T/p.json" && mv "$T/p.json" "$D/acc/scripts/substrate/federation-relay/package.json"
held_untouched "(j) held, untouched: the accepted relay dependencies differ from the image's" "$D" 'that change needs an image'
# (k)
D="$T/k"; mk "$D"; echo OPEN > "$D/sys/probe"
held_untouched "(k) held, untouched: a probe window is open" "$D" 'probe window w1 is open'

# (l)
D="$T/l"; mk "$D"; A="$D/acc/scripts/substrate"; B="$D/baked/scripts/substrate"
printf "import { createLibp2p } from 'libp2p'\nconsole.log('relay v0')\n" > "$B/federation-relay/relay.ts"
echo inactive > "$D/sys/federation-relay.service.state"; echo /workspace/git/super-repo/scripts/substrate/federation-relay > "$D/sys/federation-transport-vessel.service.wd"
r="$(run "$D")"
if [ "$r" = "converged 0" ] && [ ! -s "$D/sys/restarts" ] && same "$A/federation-relay/relay.ts" "$B/federation-relay/relay.ts" \
   && same "$A/federation-relay/ingress-auth.ts" "$B/federation-relay/ingress-auth.ts" && grep -q 'federation-transport-vessel.service runs /workspace/git' "$D/log"; then
  ok "(l) an inactive unit and one run from another tree are not restarted; the tree converges"
else bad "(l) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts" 2>/dev/null)"; fi

equalize() { # <dir>: make the baked tree equal to accepted (image-owned files aside)
  local A="$1/acc/scripts/substrate" B="$1/baked/scripts/substrate"
  cp "$A/federation-relay/ingress-auth.ts" "$B/federation-relay/ingress-auth.ts"; chmod 755 "$B/tool.sh"
  rm -f "$B/docker-compose.yml"; ln -s ../../docker-compose.yml "$B/docker-compose.yml"
}
# (n)
D="$T/n"; mk "$D"; equalize "$D"; echo federation-transport-vessel.service > "$D/mk/tier-b.owed"
r="$(run "$D")"
if [ "$r" = "converged 0" ] && [ "$(restarts "$D" federation-transport-vessel.service)" = 1 ] && [ "$(restarts "$D" federation-relay.service)" = 0 ] \
   && [ ! -s "$D/mk/tier-b.owed" ] && grep -q 'owed a restart' "$D/log"; then
  ok "(n) a restart owed by an interrupted tick is taken on the next one, and the debt cleared"
else bad "(n) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts" 2>/dev/null); owed: $(cat "$D/mk/tier-b.owed" 2>/dev/null)"; fi
# (o)
D="$T/o"; mk "$D"; equalize "$D"; st0="$(cat "$D/sys/federation-transport-vessel.service.start")"
jq -n --argjson st "$st0" '{tree_hash: "old", units: [{unit: "federation-transport-vessel.service", started_epoch: $st, loaded_hash: "not-what-is-on-disk"}]}' > "$D/mk/tier-b.json"
r="$(run "$D")"
if [ "$r" = "converged 0" ] && [ "$(restarts "$D" federation-transport-vessel.service)" = 1 ] && grep -q 'changed on disk under the running unit' "$D/log" \
   && [ "$(jq -r '.units[] | select(.unit == "federation-transport-vessel.service") | .started_epoch' "$D/mk/tier-b.json")" != "$st0" ]; then
  ok "(o) bytes that moved under a running unit restart it; the record names its new start"
else bad "(o) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts" 2>/dev/null); log: $(tail -2 "$D/log" | tr '\n' ' ')"; fi
# (p)
D="$T/p"; mk "$D"; equalize "$D"; B="$D/baked/scripts/substrate"; cp "$B/federation-relay/ingress-auth.ts" "$T/p.before"
st0="$(cat "$D/sys/federation-transport-vessel.service.start")"
jq -n --argjson st "$st0" '{tree_hash: "old", units: [{unit: "federation-transport-vessel.service", started_epoch: $st, loaded_hash: "not-what-is-on-disk"}]}' > "$D/mk/tier-b.json"
echo 0 > "$D/sys/healthy"
r="$(run "$D")"
if [ "$r" = "unready 1" ] && same "$T/p.before" "$B/federation-relay/ingress-auth.ts" && [ "$(restarts "$D" federation-transport-vessel.service)" = 1 ] \
   && grep -q '"pull-sync-tier-b-unit-unready-after-owed-restart"' "$D/gaps" && [ ! -e "$D/mk/tier-b.refused" ]; then
  ok "(p) an owed restart that is not ready: failed and filed, nothing restored"
else bad "(p) got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts" 2>/dev/null); log: $(tail -2 "$D/log" | tr '\n' ' ')"; fi
: > "$D/sys/restarts"; r="$(run "$D")"
[ "$r" = "current 0" ] && [ ! -s "$D/sys/restarts" ] && ok "(p) the next tick does not bounce it again" || bad "(p) next tick: got '$r'; restarts: $(tr '\n' ' ' < "$D/sys/restarts")"

# (m)
awk '/^converge_fleet_defs "/{f=1} f && /^converge_tier_b$/{print "after"; exit}' "$SCRIPT" | grep -q after \
  && grep -q 'tier_b=\$TIERB_STATE' "$SCRIPT" \
  && ok "(m) converge_tier_b runs every tick after converge_fleet_defs; the done line reports tier_b" \
  || bad "(m) converge_tier_b is not called at top level after converge_fleet_defs, or the done line lacks tier_b"

finish
