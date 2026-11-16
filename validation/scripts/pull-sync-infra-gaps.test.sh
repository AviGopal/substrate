#!/usr/bin/env bash
# Gaps that record an event in the deployment (a runtime tree pull-sync found collapsed or overwrote, a unit namespace
# that could reach the scoped-secret directory) are shown, never worked (scripts/substrate/substrate-pull-sync.sh
# INFRA_GAPS, emit_infra_gap, carry_infra_gaps; the USER: infra gaps are marked, not offered to the walk):
#   (a) emit_infra_gap writes the gap walkable false and infra true;
#   (b) carry_infra_gaps gives each open row of those ids that says nothing of walkable one row more, marked; never a
#       failing-test gap, another id, or a closed one; a second tick writes nothing;
#   (c) records unreadable: nothing written, said;
#   (d) every emit of those ids goes through emit_infra_gap, with the id from the one list.
# usage: validation/scripts/pull-sync-infra-gaps.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  grep -E '^INFRA_GAP[A-Z_]*=' "$SCRIPT"
  for f in shape_route gap_resolve dev_resolve emit_gap emit_infra_gap carry_infra_gaps; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^carry_infra_gaps()' "$T/fns.sh" && grep -q '^emit_infra_gap()' "$T/fns.sh" && grep -q '^INFRA_GAPS=' "$T/fns.sh" \
  || { echo "FAIL - could not extract INFRA_GAPS, emit_infra_gap and carry_infra_gaps"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; WRITES="$T/writes.txt"; DOWN=""
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY=""
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    record_read) if [ -n "$DOWN" ]; then printf '{"error":"down"}'; else jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS"; fi ;;
    record_write)
      local n row; n="$(jq length "$ROWS")"
      row="$(printf '%s' "$d" | jq -c --argjson n "$n" '.pointer as $p | $p.row + {id: ("row-" + ($n | tostring)), seq: ($n + 1), writer: $p.writer, role: $p.role}')"
      jq -c --argjson r "$row" '. + [$r]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
      echo "$row" >> "$WRITES"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
gap() { # gap_id status [extra json]
  jq -cn --arg id "$1" --arg st "$2" --argjson x "${3:-{\}}" '{shape: "gap", gap_id: $id, status: $st, category: "c", summary: "s", writer: "pull-sync", role: "detector", meta: {}} + $x'
}
reset() { printf '%s\n' "$@" | jq -s -c 'to_entries | map(.value + {id: ("r" + (.key | tostring)), seq: (.key + 1)})' > "$ROWS"; : > "$WRITES"; : > "$LOG"; }
latest() { jq -c --arg id "$1" '[.[] | select(.shape == "gap" and .gap_id == $id)] | sort_by(.seq) | last' "$ROWS"; }

reset
emit_infra_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"$INFRA_GAP_TRUNCATED-x\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"s\",\"status\":\"open\"}}}}"
if latest "runtime-source-truncated-x" | jq -e '.walkable == false and .infra == true and .status == "open"' >/dev/null; then
  ok "(a) a new truncation gap is written walkable false, infra true: shown, never a root"
else bad "(a) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

reset "$(gap runtime-source-truncated-x open)" "$(gap pull-sync-drift-quarantined-y open)" "$(gap secret-mask-probe-leak open)" \
  "$(gap failing-test-x-src-a-test-ts-gen-assert open '{"repo":"x"}')" "$(gap pull-sync-test-regression-x open)" \
  "$(gap runtime-source-truncated-z closed)" "$(gap pull-sync-drift-quarantined-w open '{"walkable":false,"infra":true}')"
carry_infra_gaps
marked="$(jq -s -c 'map(select(.walkable == false and .infra == true) | .gap_id) | sort' "$WRITES")"
if [ "$marked" = '["pull-sync-drift-quarantined-y","runtime-source-truncated-x","secret-mask-probe-leak"]' ] && [ "$(wc -l < "$WRITES")" = 3 ] \
  && [ "$(latest failing-test-x-src-a-test-ts-gen-assert | jq -r '.walkable // "none"')" = none ] \
  && [ "$(latest pull-sync-test-regression-x | jq -r '.walkable // "none"')" = none ] \
  && [ "$(latest runtime-source-truncated-z | jq -r '.status')" = closed ]; then
  # the store drops a row equal to the latest, so the carry itself must not send one: nothing marked again, said or written
  : > "$WRITES"; : > "$LOG"; carry_infra_gaps
  if [ ! -s "$WRITES" ] && ! grep -q "infrastructure event" "$LOG"; then ok "(b) each open row of those ids is marked once; failing-test, other ids and closed gaps untouched; a second tick marks nothing"
  else bad "(b) second tick wrote $(cat "$WRITES")"; fi
else bad "(b) marked=$marked writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

reset "$(gap runtime-source-truncated-x open)"; DOWN=1
carry_infra_gaps
if [ ! -s "$WRITES" ] && grep -q "records unreadable" "$LOG"; then ok "(c) records unreadable: nothing written, said"
else bad "(c) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
DOWN=""

plain="$(grep -nE 'emit_gap .*(runtime-source-truncated|pull-sync-drift-quarantined|secret-mask-probe)-|INFRA_GAP_(TRUNCATED|DRIFT|MASK)-' "$SCRIPT" | grep -v 'emit_infra_gap' || true)"
sites="$(grep -cE 'emit_infra_gap .*\$INFRA_GAP_(TRUNCATED|DRIFT|MASK)-' "$SCRIPT")"
if [ -z "$plain" ] && [ "$sites" = 3 ]; then ok "(d) every emit of those ids goes through emit_infra_gap, its id from the list (3 sites)"
else bad "(d) sites=$sites plain: $plain"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - deployment events are shown as gaps, never worked as code"; exit 0; }
echo "$FAILS FAILED"; exit 1
