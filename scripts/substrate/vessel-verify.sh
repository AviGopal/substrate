#!/usr/bin/env bash
# vessel-verify.sh — generalized per-vessel build/test verify gate (#3).
#
# Runs INSIDE substrate-live. Given a vessel name (and optional explicit dir, e.g.
# a staged *-mitosis-* candidate), runs whatever checks the vessel's package.json
# defines (typecheck / lint / build / test) and emits a JSON verdict. FAVORABLE
# iff every PRESENT check passes; UNFAVORABLE if any fails; REFUSE if the dir or
# scripts are absent.
#
# WHY: today the substrate's mitosis cutover gates on a dev-vessel-scoped typecheck.
# To develop ANY vessel via activities (S1→S2), the evaluate/cutover path needs a
# uniform "does this change build + pass tests?" gate that works for every vessel
# regardless of which checks that vessel happens to define. This is that gate —
# the substrate's evaluate resolver can shell out to it via the bash resolver, and
# operators can run it directly to verify a staged candidate before cutover.
#
#   docker exec substrate-live bash scripts/substrate/vessel-verify.sh goal-host-vessel
#   docker exec substrate-live bash .../vessel-verify.sh goal-host-vessel /vessels/goal-host-vessel-mitosis-<ts>
#
# Exit: 0 FAVORABLE, 1 UNFAVORABLE, 2 REFUSE. JSON verdict on stdout (logs to stderr).
set -uo pipefail

VESSEL="${1:?usage: vessel-verify.sh <vessel> [dir]}"
DIR="${2:-/vessels/$VESSEL}"
BUN="${BUN:-/root/.bun/bin/bun}"
TIMEOUT_S="${VERIFY_TIMEOUT_S:-240}"

emit_refuse() { echo "{\"vessel\":\"$VESSEL\",\"dir\":\"$DIR\",\"verdict\":\"REFUSE\",\"reason\":\"$1\"}"; exit 2; }

[ -d "$DIR" ] || emit_refuse "dir not found: $DIR"
[ -f "$DIR/package.json" ] || emit_refuse "no package.json in $DIR"
cd "$DIR" || emit_refuse "cannot cd $DIR"

# Discover which of the canonical checks this vessel defines, in run order.
SCRIPTS="$("$BUN" -e 'try{const s=require("./package.json").scripts||{};process.stdout.write(["typecheck","lint","build","test"].filter(k=>s[k]).join(" "))}catch(e){process.exit(3)}' 2>/dev/null)"
[ -z "$SCRIPTS" ] && emit_refuse "no typecheck/lint/build/test scripts defined"

declare -A RESULT
VERDICT="FAVORABLE"
for c in $SCRIPTS; do
  if timeout "$TIMEOUT_S" "$BUN" run "$c" >"/tmp/vv-$VESSEL-$c.log" 2>&1; then
    RESULT[$c]="pass"; echo "[vessel-verify] $VESSEL/$c PASS" >&2
  else
    RESULT[$c]="fail"; VERDICT="UNFAVORABLE"
    echo "[vessel-verify] $VESSEL/$c FAIL (tail: $(tail -1 "/tmp/vv-$VESSEL-$c.log" 2>/dev/null))" >&2
  fi
done

CHECKS="$(for c in $SCRIPTS; do printf '"%s":"%s",' "$c" "${RESULT[$c]}"; done | sed 's/,$//')"
echo "{\"vessel\":\"$VESSEL\",\"dir\":\"$DIR\",\"checks\":{$CHECKS},\"verdict\":\"$VERDICT\",\"ran\":\"$SCRIPTS\"}"
[ "$VERDICT" = "FAVORABLE" ] && exit 0 || exit 1
