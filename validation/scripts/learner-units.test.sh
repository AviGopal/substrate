#!/usr/bin/env bash
# records, walk and described-shape are baked units now, not dynamic (vessel-ctl) ones:
#   1. each baked unit runs what render-unit.sh rendered from its former vessels.manifest.json entry (the fixture
#      learner-units-manifest-entries.json), directive for directive: the same env (records' data dir, every port and
#      id), workdir, start, stop and restart, so a node moving from the rendered unit to the baked one keeps its store;
#   2. placement: records is role "learner" (profiles hub and standalone), walk and described-shape role "walker"
#      (standalone only): the hub gets records alone, a spoke none of the three;
#   3. installed-replay: a member still in the manifest is restored, one now baked is retired (its /etc copy removed,
#      dropped from installed.json), one in neither is skipped, and no outcome fails the run;
#   4. the entrypoint's call of the replay, with the replay absent, logs and carries on.
#   5. walk and described-shape wait (bounded, never failing the start) for records to answer /health.
#
# usage: validation/scripts/learner-units.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
S="$ROOT/scripts/substrate"
T="$(mktemp -d "${TMPDIR:-/tmp}/learner-units.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
directives() { grep -vE '^[[:space:]]*(#|$)' "$1" | sed 's/[[:space:]]*$//'; }

# ── 1. the baked units run what the rendered ones ran ─────────────────────────
for v in records-vessel walk-vessel described-shape-vessel; do
  env -i PATH="$PATH" MITOSIS_RUNTIME_DIR=/vessels bash "$S/render-unit.sh" "$v" "$ROOT/validation/scripts/fixtures/learner-units-manifest-entries.json" > "$T/$v.rendered" 2>"$T/$v.err" \
    || { bad "$v: render-unit failed on the fixture: $(head -c 200 "$T/$v.err")"; continue; }
  if diff <(directives "$T/$v.rendered") <(directives "$S/units/$v.service") > "$T/$v.diff"; then
    ok "$v: the baked unit's directives are the rendered unit's"
  else
    bad "$v: the baked unit differs from the rendered one: $(head -c 400 "$T/$v.diff")"
  fi
done
grep -qx 'Environment=RECORDS_DATA_DIR=/workspace/substrate/records-vessel' "$S/units/records-vessel.service" \
  && ok "records keeps its data dir" || bad "records' data dir is not /workspace/substrate/records-vessel"

# ── 2. placement ─────────────────────────────────────────────────────────────
INV="$S/vessels.inventory.json"
role() { jq -r --arg u "$1.service" '.vessels[] | select(.unit == $u) | "\(.role) \(.manifest // false)"' "$INV"; }
[ "$(role records-vessel)" = "learner false" ] && [ "$(role walk-vessel)" = "walker false" ] && [ "$(role described-shape-vessel)" = "walker false" ] \
  && ok "records is learner, walk and described-shape walker, none dynamic" || bad "roles: records '$(role records-vessel)', walk '$(role walk-vessel)', ds '$(role described-shape-vessel)'"
jq -e '(.roles.hub | index("learner")) and (.roles.full | index("learner")) and (.roles.full | index("walker")) and ((.roles.hub | index("walker")) | not) and ((.roles.spoke | index("learner")) | not) and ((.roles.spoke | index("walker")) | not)' "$INV" >/dev/null \
  && ok "learner is in hub and full, walker in full only, neither in spoke" || bad "role groups do not place learner and walker as intended"
jq -e '[.vessels[] | .name] | (index("records-vessel") or index("walk-vessel") or index("described-shape-vessel")) | not' "$S/vessels.manifest.json" >/dev/null \
  && ok "none of the three is a dynamic (vessels.manifest.json) vessel any more" || bad "vessels.manifest.json still names one of the three"
selected() { # profile -> the three's units apply-inventory keeps selected, sorted
  local out; out="$(cd "$ROOT" && env -i PATH="$PATH" HOME="$T" VESSELS_INVENTORY="$INV" PROFILE="$1" DRY_RUN=1 bash "$S/apply-inventory.sh" 2>&1)"
  for u in described-shape-vessel.service records-vessel.service walk-vessel.service; do
    printf '%s' "$out" | grep -qE "(would disable|masked whatever the selection\)): $u\$" || echo "$u"
  done | tr '\n' ' '
}
[ "$(selected hub)" = "records-vessel.service " ] && ok "PROFILE=hub selects records alone" || bad "PROFILE=hub selects: $(selected hub)"
[ "$(selected standalone)" = "described-shape-vessel.service records-vessel.service walk-vessel.service " ] && ok "PROFILE=standalone selects all three" || bad "PROFILE=standalone selects: $(selected standalone)"
[ "$(selected spoke)" = "" ] && ok "PROFILE=spoke selects none of them" || bad "PROFILE=spoke selects: $(selected spoke)"

# ── 3. installed-replay ──────────────────────────────────────────────────────
F="$T/fleet"; E="$T/etc"; L="$T/lib"; mkdir -p "$F" "$E/multi-user.target.wants" "$L"
printf '{"vessels":[{"name":"dyn-vessel"}]}\n' > "$F/vessels.manifest.json"
printf '{"installed":["dyn-vessel","records-vessel","ghost-vessel","off-vessel"]}\n' > "$F/installed.json"
printf '[Unit]\n' > "$L/records-vessel.service"
printf '[Unit]\n' > "$E/records-vessel.service"; ln -sf ../records-vessel.service "$E/multi-user.target.wants/records-vessel.service"
printf '#!/bin/sh\necho "[Unit]" > "%s/$2.service"\n' "$E" > "$T/vessel-ctl"; chmod +x "$T/vessel-ctl"
OUT="$(FLEET_DIR="$F" VESSELS_MANIFEST="$F/vessels.manifest.json" SYSTEMD_ETC_DIR="$E" SYSTEMD_LIB_DIR="$L" VESSEL_CTL="$T/vessel-ctl" DISABLED_VESSELS=off-vessel bash "$S/installed-replay.sh" 2>&1)"; RC=$?
[ "$RC" = 0 ] && ok "[MUST-FAIL] a replay holding a name no longer in the manifest exits 0 (never stops a boot)" || bad "the replay exited $RC: $OUT"
[ -f "$E/dyn-vessel.service" ] && [ -L "$E/multi-user.target.wants/dyn-vessel.service" ] && ok "a member still in the manifest is restored and wanted" || bad "dyn-vessel not restored: $OUT"
[ ! -e "$E/records-vessel.service" ] && [ ! -L "$E/multi-user.target.wants/records-vessel.service" ] && ok "[MUST-FAIL] a member now baked has its /etc copy and wants link removed" || bad "records' /etc copy or wants link is still there"
[ "$(jq -c '.installed' "$F/installed.json")" = '["dyn-vessel","ghost-vessel","off-vessel"]' ] && ok "the baked member is dropped from installed.json, the others kept" || bad "installed.json is now $(jq -c '.installed' "$F/installed.json")"
grep -q "ghost-vessel is in neither" <<<"$OUT" && grep -q "off-vessel is in DISABLED_VESSELS" <<<"$OUT" && ok "a name in neither is skipped with a line; DISABLED_VESSELS still outranks the record" || bad "skip lines missing: $OUT"

# ── 4. the entrypoint's call, with no replay installed ───────────────────────
GUARD="$(awk '/^# The replay itself is installed-replay.sh/{p=1} p{print} p && /^fi$/{exit}' "$S/entrypoint.sh")"
[ -n "$GUARD" ] || bad "the entrypoint's replay call was not found"
GOUT="$(bash -euo pipefail -c "FLEET_DIR=$F; $(printf '%s' "$GUARD" | sed "s|/usr/local/bin/installed-replay|$T/absent-installed-replay|g"); echo reached-unit-start" 2>&1)"; GRC=$?
[ "$GRC" = 0 ] && grep -q reached-unit-start <<<"$GOUT" && grep -q "no installed-replay in this image" <<<"$GOUT" \
  && ok "[MUST-FAIL] with the replay absent the entrypoint says so and carries on" || bad "the entrypoint's call with no replay: rc $GRC, $GOUT"

# ── 5. walk and described-shape wait for records to serve, boundedly ─────────
# records is Type=simple: After= orders after its process starts, not after it listens. Each waits for records'
# /health (the port records' unit sets), at most 30 tries, and starts whatever the answer: no Requires= on records.
RPORT="$(sed -n 's/^Environment=RECORDS_PORT=\([0-9][0-9]*\)$/\1/p' "$S/units/records-vessel.service")"
for v in walk-vessel described-shape-vessel; do
  W="$S/units/$v.service.d/45-wait-for-records.conf"
  [ -f "$W" ] || { bad "$v has no wait-for-records drop-in"; continue; }
  PRE="$(sed -n 's/^ExecStartPre=//p' "$W")"
  [ "${PRE:0:1}" = "-" ] && ok "$v: the wait can never fail the start (leading '-')" || bad "$v: the wait's ExecStartPre can fail the start"
  grep -q "127.0.0.1:$RPORT/health" <<<"$PRE" && ok "$v: it polls records' own port ($RPORT)" || bad "$v: it does not poll records' port $RPORT: $PRE"
  ! grep -rqE '^Requires=.*records-vessel' "$S/units/$v.service" "$S/units/$v.service.d" && ok "$v: no Requires= on records" || bad "$v requires records"
  # Run it against a records that never answers and one that answers on the third try (curl and sleep stubbed).
  CMD="$(sed -n "s/^-\/bin\/sh -c '\(.*\)'$/\1/p" <<<"$PRE")"
  mkdir -p "$T/bin.$v"; printf '#!/bin/sh\nexit 0\n' > "$T/bin.$v/sleep"
  printf '#!/bin/sh\nn=$(cat "%s" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "%s"; [ -n "${UP_AT:-}" ] && [ "$n" -ge "$UP_AT" ]\n' "$T/n.$v" "$T/n.$v" > "$T/bin.$v/curl"
  chmod +x "$T/bin.$v/sleep" "$T/bin.$v/curl"
  rm -f "$T/n.$v"; OUT="$(PATH="$T/bin.$v:$PATH" sh -c "$CMD" 2>&1)"; RC=$?
  [ "$RC" = 0 ] && [ "$(cat "$T/n.$v")" = 30 ] && grep -q "starting anyway" <<<"$OUT" \
    && ok "[MUST-FAIL] $v: records never answering ends the wait after 30 tries, saying so, exit 0" || bad "$v: never-answering records: rc $RC, tries $(cat "$T/n.$v" 2>/dev/null), $OUT"
  rm -f "$T/n.$v"; OUT="$(UP_AT=3 PATH="$T/bin.$v:$PATH" sh -c "$CMD" 2>&1)"; RC=$?
  [ "$RC" = 0 ] && [ "$(cat "$T/n.$v")" = 3 ] && [ -z "$OUT" ] && ok "$v: records answering on the third try ends the wait there" || bad "$v: answering records: rc $RC, tries $(cat "$T/n.$v" 2>/dev/null), $OUT"
done

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
