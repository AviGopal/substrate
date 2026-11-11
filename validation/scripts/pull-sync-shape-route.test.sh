#!/usr/bin/env bash
# pull-sync addresses what it reads and writes BY SHAPE through discovery (scripts/substrate/substrate-pull-sync.sh
# shape_route, dev_resolve, tuning_param). development-vessel and activity-api left the image, and the fixed ports it
# used for them answered nothing, so gap writes, the probe-window read and tuning reads failed with no line saying so.
# Runs the script's own functions with curl stubbed as discovery.
#   (a) nothing serves the shape: the call is not made, dev_resolve fails as an unreachable store did, and one line per
#       tick names the shape, however many calls ask for it;
#   (b) a producer serves it: the pointer goes by shape to discovery's /resolve;
#   (c) discovery does not answer: treated as not served and named; no fixed endpoint (:8090, :8080) is ever called;
#   (d) nothing serves tuning_param: the default is used, with the reason no_producer.
# usage: validation/scripts/pull-sync-shape-route.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  sed -n '/^shape_route() {/,/^}/p' "$SCRIPT"
  sed -n '/^gap_resolve() {/,/^}/p' "$SCRIPT"
  sed -n '/^dev_resolve() {/,/^}/p' "$SCRIPT"
  sed -n '/^tuning_param() {/,/^}/p' "$SCRIPT"
} > "$T/fns.sh"
grep -q 'vesselCapability' "$T/fns.sh" && grep -q '^dev_resolve()' "$T/fns.sh" && grep -q '^tuning_param()' "$T/fns.sh" \
  || { echo "FAIL - could not extract shape_route, dev_resolve and tuning_param"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
CALLS="$T/calls.txt"
DISCOVERY=http://discovery.test; DEFERRAL_LOG="$T/deferrals.jsonl"; TP_FALLBACK_SEEN=" "; SR_ROUTE=""
export METABOB_API_KEY=""
# curl as discovery: the capability probe answers per $CAP (a vessel list, an empty one, or nothing); anything else
# answers {"ok":true} and, for -w, a 200 status line.
curl() {
  cat > /dev/null
  local args="$*"; printf '%s\n' "$args" >> "$CALLS"
  case "$args" in
    *vesselCapability*) [ "$CAP" = none ] || printf '%s' "$CAP" ;;
    *'%{http_code}'*) printf '{"ok":true}\n200' ;;
    *) printf '{"ok":true}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
fresh() { SHAPE_ROUTES=" "; TP_FALLBACK_SEEN=" "; : > "$LOG"; : > "$CALLS"; }

fresh; CAP='{"content":{"vessels":[]}}'
dev_resolve '{"impulse":{"pointer":{"type":"poolImpulse","status":"open"}}}' --max-time 5 > "$T/out1"; rc1=$?
dev_resolve '{"impulse":{"pointer":{"type":"poolImpulse","id":"g1"}}}' --max-time 5 > "$T/out2"; rc2=$?
if [ "$rc1" = 7 ] && [ "$rc2" = 7 ] && [ ! -s "$T/out1" ] && [ "$(grep -vc vesselCapability "$CALLS")" = 0 ] \
  && [ "$(grep -c vesselCapability "$CALLS")" = 1 ] \
  && [ "$(grep -c 'no producer serves poolImpulse' "$LOG")" = 1 ]; then
  ok "(a) nothing serves the shape: no call made, failed as unreachable, named once per tick"
else bad "(a) rc=$rc1/$rc2 calls=$(tr '\n' '|' < "$CALLS") log=$(tr '\n' '|' < "$LOG")"; fi

fresh; CAP='{"content":{"vessels":[{"vesselId":"v"}]}}'
dev_resolve '{"impulse":{"pointer":{"type":"poolImpulse","status":"open"}}}' --max-time 5 > /dev/null
if grep -q 'http://discovery.test/resolve' "$CALLS" && grep -q '{"pointer":{"type":"poolImpulse","status":"open"}}' "$CALLS" \
  && ! grep -q 'dev.test' "$CALLS"; then
  ok "(b) a served shape goes by shape through discovery's /resolve"
else bad "(b) calls=$(tr '\n' '|' < "$CALLS")"; fi

fresh; CAP=none
dev_resolve '{"impulse":{"type":"maintenanceLease","name":"change_window"}}' --max-time 5 > /dev/null; rc=$?
tuning_param pull_sync.some_bound 42
if [ "$rc" = 7 ] && [ "$(grep -vc vesselCapability "$CALLS")" = 0 ] && ! grep -q '8090\|8080\|tuning-params\|impulses/resolve' "$CALLS" \
  && grep -q 'discovery did not answer for maintenanceLease' "$LOG" && [ "$TP_VALUE" = 42 ]; then
  ok "(c) discovery silent: not served, named, and no fixed endpoint called"
else bad "(c) rc=$rc calls=$(tr '\n' '|' < "$CALLS") log=$(tr '\n' '|' < "$LOG")"; fi

fresh; CAP='{"content":{"vessels":[]}}'
tuning_param pull_sync.some_bound 42
if [ "$TP_VALUE" = 42 ] && grep -q 'no_producer' "$LOG" "$DEFERRAL_LOG" 2>/dev/null && ! grep -q 'tuning-params' "$CALLS"; then
  ok "(d) nothing serves tuning_param: the default, with the reason no_producer"
else bad "(d) TP_VALUE=$TP_VALUE log=$(tr '\n' '|' < "$LOG") calls=$(tr '\n' '|' < "$CALLS")"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - pull-sync addresses its shapes through discovery and names what nothing serves"; exit 0; }
echo "$FAILS FAILED"; exit 1
