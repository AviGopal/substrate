#!/usr/bin/env bash
# pull-sync installs a glue path only when the coverage map proves it at level BEHAVIOUR on that exact blob
# (scripts/substrate/substrate-pull-sync.sh: cov_ready / cov_allows / cov_skip and every glue install site).
# in-place-image-convergence 1.3; user ruling 2026-10-19 "Build 1.3 by 10-20T18:00Z".
#
# converge_units, taken from the script itself, is run against a scratch stage and unit dir (systemctl, the gap
# writer and the stage are stubbed and recorded):
#   (a) CONTROL: a unit whose entry is behaviour on its blob converges as today
#   (b) a parse-level unit is LEFT AS BAKED (the installed bytes are unchanged) and named in a skip line
#   (c) a behaviour unit whose proof is for another blob (stale) is left as baked, and the line says to re-earn it
#   (d) the skips are counted (COV_SKIPPED)
#   (e) a map that is not JSON: NO unit is installed, a REFUSED line, and one gap pull-sync-coverage-map-unreadable
#   (f) the refusal is filed once a tick, not once per call
#   (g) a missing map: refused the same way
#   (h) a map with an empty paths object: refused (no paths is not "everything covered")
# structure (every other glue install site asks the map; vessel convergence does not):
#   (i) each install site named below carries a cov_allows guard
#   (j) mirror-to-live's vessel convergence call sites do not consult the map (vessel code keeps converging)
#   (k) the tick's done line reports coverage_skipped and coverage_map
# the dated exemption (user ruling via qa 2026-10-19: the units' exemption lapses at its own date, not at deploy):
#   (l) a parse-level unit listed in converges_today_exempt with a FUTURE expires converges as today, and the map
#       load names the exemption as in force
#   (m) the same unit with a PAST expires is left as baked (must-fail for an exemption that never lapses)
#   (n) a malformed expires counts as expired (an exemption fails closed)
#
# usage: validation/scripts/pull-sync-installs-only-covered-paths.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{ sed -n '/^COV_STATE=unloaded;/,/^cov_skip() {.*}$/p' "$SCRIPT"; sed -n '/^converge_units() {/,/^}/p' "$SCRIPT"; } > "$T/fns.sh"
grep -q '^cov_allows() {' "$T/fns.sh" && grep -q '^converge_units() {' "$T/fns.sh" \
  || { echo "FAIL - could not extract the coverage helpers and converge_units from $SCRIPT"; exit 1; }

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
    echo "$COV_SKIPPED" > "$d/skipped" ) 2>/dev/null
}
same() { cmp -s "$1" "$2"; }

# (a)-(d)
D="$T/one"; mkstage "$D"; map "$D" behaviour parse 0; run "$D"
same "$D/units/covered.service" "$D/stage/scripts/substrate/units/covered.service" \
  && grep -q 'units: converged covered.service' "$D/log" && ok "(a) control: a behaviour-proven unit converges as today" || bad "(a) the covered unit did not converge: $(cat "$D/log" 2>/dev/null | tr '\n' '|')"
grep -q 'Description=uncovered baked' "$D/units/uncovered.service" \
  && grep -q 'coverage: NOT converged scripts/substrate/units/uncovered.service (level parse): it stays as baked' "$D/log" \
  && ok "(b) a parse-level unit is left as baked and named" || bad "(b) uncovered: $(grep uncovered "$D/log" | head -2 | tr '\n' '|')"
grep -q 'Description=stale baked' "$D/units/stale.service" && grep -q 'stale.service (its behaviour proof is for blob 000000000000.*re-earn' "$D/log" \
  && ok "(c) a stale behaviour proof leaves the unit as baked and says to re-earn it" || bad "(c) stale: $(grep stale "$D/log" | head -2 | tr '\n' '|')"
[ "$(cat "$D/skipped")" = 2 ] && ok "(d) two skips are counted" || bad "(d) COV_SKIPPED=$(cat "$D/skipped")"
[ ! -s "$D/gaps" ] && ok "(d') a valid map files no gap" || bad "(d') a gap was filed for a valid map"

# (e)(f) a map that is not JSON, two calls in one tick
D="$T/bad"; mkstage "$D"; echo '{"paths": not json' > "$D/stage/scripts/substrate/gate/coverage.json"; run "$D" 2
n_new=$(grep -l ' new' "$D/units/"*.service 2>/dev/null | wc -l)
[ "$n_new" = 0 ] && grep -q 'coverage: !!! REFUSED' "$D/log" && ok "(e) an unreadable map: no unit installed, refused by name" || bad "(e) $n_new unit(s) installed; log: $(head -3 "$D/log" | tr '\n' '|')"
[ "$(grep -c 'pull-sync-coverage-map-unreadable' "$D/gaps" 2>/dev/null)" = 1 ] && ok "(f) the refusal files one gap a tick" || bad "(f) gaps: $(grep -c . "$D/gaps" 2>/dev/null)"
# (g) missing map
D="$T/missing"; mkstage "$D"; run "$D"
[ "$(grep -l ' new' "$D/units/"*.service 2>/dev/null | wc -l)" = 0 ] && grep -q 'coverage: !!! REFUSED' "$D/log" && ok "(g) a missing map is refused the same way" || bad "(g) missing map: $(head -2 "$D/log" | tr '\n' '|')"
# (h) empty paths
D="$T/empty"; mkstage "$D"; echo '{"paths": {}}' > "$D/stage/scripts/substrate/gate/coverage.json"; run "$D"
[ "$(grep -l ' new' "$D/units/"*.service 2>/dev/null | wc -l)" = 0 ] && grep -q 'REFUSED' "$D/log" && ok "(h) an empty paths object is refused, not read as all-covered" || bad "(h) empty paths: $(head -2 "$D/log" | tr '\n' '|')"

# (l)(m)(n) the dated exemption
D="$T/exfut"; mkstage "$D"; map "$D" behaviour parse 0 2999-12-31; run "$D"
same "$D/units/uncovered.service" "$D/stage/scripts/substrate/units/uncovered.service" \
  && grep -q 'converges_today_exempt is in force through 2999-12-31: its 1 path' "$D/log" \
  && ok "(l) an unexpired exemption converges its parse-level unit as today, and says so" || bad "(l) future exemption: $(grep -E 'uncovered|exempt' "$D/log" | head -3 | tr '\n' '|')"
D="$T/expast"; mkstage "$D"; map "$D" behaviour parse 0 2000-01-01; run "$D"
grep -q 'Description=uncovered baked' "$D/units/uncovered.service" && grep -q 'converges_today_exempt expired (2000-01-01)' "$D/log" \
  && ok "(m) an expired exemption leaves its unit as baked" || bad "(m) past exemption: $(grep -E 'uncovered|exempt' "$D/log" | head -3 | tr '\n' '|')"
D="$T/exbad"; mkstage "$D"; map "$D" behaviour parse 0 "next week"; run "$D"
grep -q 'Description=uncovered baked' "$D/units/uncovered.service" \
  && ok "(n) a malformed expires counts as expired" || bad "(n) malformed expires installed the unit"

# (i) every glue install site asks the map
for site in 'scripts/substrate/$_cf_from" "$_cf_src/$_cf_from"' 'scripts/substrate/substrate-pull-sync.sh "$_ps_src"' \
            'scripts/substrate/secrets.env.sh "$_cf_src/secrets.env.sh"' 'scripts/substrate/$f" "$_cf_git"' \
            'scripts/substrate/lib/gap-tracked-red.sh "$_se_lib_from"' 'scripts/substrate/${_se_pair%%:*}" "$_se_from"' \
            'scripts/substrate/substrate-pull-sync.sh "$_se_src/substrate-pull-sync.sh"' \
            'scripts/substrate/$(basename "$_rd_f")" "$_rd_f"' 'scripts/substrate/gate/gate-runner.sh "$_gr_src"'; do
  grep -qF "cov_allows $site" "$SCRIPT" || grep -qF "cov_allows \"$site" "$SCRIPT" || { bad "(i) no cov_allows guard for: $site"; continue; }
done
[ "$FAILS" = 0 ] && ok "(i) every glue install site carries a cov_allows guard"
# (j) vessel convergence does not consult the map
if grep -nE 'mirror-to-live "\$v"' "$SCRIPT" | grep -q 'cov_'; then bad "(j) a mirror-to-live vessel call consults the coverage map"
else ok "(j) mirror-to-live vessel convergence does not consult the coverage map"; fi
grep -q 'coverage_skipped=\$COV_SKIPPED coverage_map=\$COV_STATE' "$SCRIPT" && ok "(k) the done line reports coverage_skipped and coverage_map" || bad "(k) no coverage summary in the done line"

[ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
