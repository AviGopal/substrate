#!/usr/bin/env bash
# pull-sync-installs-uncovered-paths-from-accepted-so-the-exem.check.sh: the row's own check for gap
# pull-sync-installs-uncovered-paths-from-accepted-so-the-exemption-expiry-leaves-no-behaviour-gate-on-them.
#
# pull-sync installed every glue path (units, tooling, the active-scripts run-dir) whatever the coverage map said, so
# once the dated exemption expired nothing gated the uncovered paths. Expected (in-place-image-convergence 1.3):
# pull-sync installs only the paths a behaviour fixture covers on that exact blob; uncovered paths stay as baked and
# converge by image only.
#
#   MUST-FAIL (b): a parse-level unit is LEFT AS BAKED (its installed bytes are unchanged)
#   MUST-FAIL (m): a parse-level unit listed in converges_today_exempt with a PAST expires is left as baked
#   CONTROL   (a): a unit whose entry is behaviour on its blob converges as today
#
# converge_units (and the coverage helpers, where the script has them) is taken from the script with sed and run
# against a scratch stage and unit dir, with systemctl, the gap writer and the stage stubbed; the script itself is
# never run. Cases reused from pull-sync-installs-only-covered-paths.test.sh.
#
#   pull-sync-installs-uncovered-paths-from-accepted-so-the-exem.check.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, sed, cmp.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/ps-covered.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# The coverage helpers are taken when present; converge_units must be there, or the check cannot run.
{ sed -n '/^COV_STATE=unloaded;/,/^cov_skip() {.*}$/p' "$SCRIPT"; sed -n '/^converge_units() {/,/^}/p' "$SCRIPT"; } > "$T/fns.sh"
grep -q '^converge_units() {' "$T/fns.sh" || { echo "FAIL - could not extract converge_units from $SCRIPT"; exit 1; }

mkstage() { # <dir>: a stage with three unit files and a baked unit dir holding older copies of all three
  local d="$1"; mkdir -p "$d/stage/scripts/substrate/units" "$d/stage/scripts/substrate/gate" "$d/units" "$d/env"
  for u in covered uncovered stale; do
    printf '[Unit]\nDescription=%s new\n[Service]\nExecStart=/bin/true\n' "$u" > "$d/stage/scripts/substrate/units/$u.service"
    printf '[Unit]\nDescription=%s baked\n[Service]\nExecStart=/bin/true\n' "$u" > "$d/units/$u.service"
  done
}
map() { # <dir> <level-of-covered> <level-of-uncovered> <stale-blob-ok:0|1>
  local d="$1" bc bu bs
  bc="$(git hash-object "$d/stage/scripts/substrate/units/covered.service")"; bu="$(git hash-object "$d/stage/scripts/substrate/units/uncovered.service")"
  bs="0000000000000000000000000000000000000000"; [ "$4" = 1 ] && bs="$(git hash-object "$d/stage/scripts/substrate/units/stale.service")"
  jq -n --arg bc "$bc" --arg bu "$bu" --arg bs "$bs" --arg lc "$2" --arg lu "$3" '{paths: {
    "/usr/lib/systemd/system/covered.service":   {src: "scripts/substrate/units/covered.service",   src_blob: $bc, level: $lc},
    "/usr/lib/systemd/system/uncovered.service": {src: "scripts/substrate/units/uncovered.service", src_blob: $bu, level: $lu},
    "/usr/lib/systemd/system/stale.service":     {src: "scripts/substrate/units/stale.service",     src_blob: $bs, level: "behaviour"}}}' \
    > "$d/stage/scripts/substrate/gate/coverage.json"
  if [ -n "${5:-}" ]; then # <expires>: list the uncovered unit in converges_today_exempt
    jq --arg e "$5" '.converges_today_exempt = {reason: "test", owner_gap: "test", expires: $e, paths: ["/usr/lib/systemd/system/uncovered.service"]}' \
      "$d/stage/scripts/substrate/gate/coverage.json" > "$d/m.json" && mv "$d/m.json" "$d/stage/scripts/substrate/gate/coverage.json"
  fi
}
run() { # <dir> [calls]: run converge_units N times in one "tick"; logs to $d/log, gaps to $d/gaps
  local d="$1" n="${2:-1}"
  ( UNIT_DIR="$d/units"; PULLSYNC_SECRET_ENV_DIR="$d/env"; PULLSYNC_GLUE_STAGE="$d/stage"
    log() { printf '%s\n' "$*" >> "$d/log"; }
    emit_gap() { printf '%s\n' "$1" >> "$d/gaps"; }
    stage_committed_glue() { PULLSYNC_GLUE_STAGE="$d/stage"; return 0; }
    systemctl() { return 0; }
    . "$T/fns.sh"
    for _ in $(seq 1 "$n"); do converge_units /nonexistent; done
    echo "${COV_SKIPPED:-0}" > "$d/skipped" ) 2>/dev/null
}
same() { cmp -s "$1" "$2"; }

# (a) control, (b) must-fail
D="$T/one"; mkstage "$D"; map "$D" behaviour parse 0; run "$D"
same "$D/units/covered.service" "$D/stage/scripts/substrate/units/covered.service" \
  && ok "(a) control: a behaviour-proven unit converges as today" || bad "(a) the covered unit did not converge: $(tr '\n' '|' < "$D/log" 2>/dev/null)"
grep -q 'Description=uncovered baked' "$D/units/uncovered.service" \
  && ok "(b) a parse-level unit is left as baked" || bad "(b) the parse-level unit was installed: $(grep uncovered "$D/log" 2>/dev/null | head -2 | tr '\n' '|')"

# (m) must-fail: an expired exemption does not keep a parse-level unit converging
D="$T/expast"; mkstage "$D"; map "$D" behaviour parse 0 2000-01-01; run "$D"
grep -q 'Description=uncovered baked' "$D/units/uncovered.service" \
  && ok "(m) an expired exemption leaves its unit as baked" || bad "(m) the unit under an expired exemption was installed: $(grep -E 'uncovered|exempt' "$D/log" 2>/dev/null | head -3 | tr '\n' '|')"

[ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
