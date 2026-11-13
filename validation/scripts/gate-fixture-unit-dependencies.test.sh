#!/usr/bin/env bash
# gate-fixture-unit-dependencies.test.sh: unit-dependencies.sh notices a service that a one-shot job's failure or rerun
# would stop, so the drop-ins that order a vessel behind a seeder can earn level BEHAVIOUR in the coverage map.
#   (a) CONTROL: the committed tree passes unit-dependencies.sh
#   (b) must-fail (qa): walk-vessel's 40-after-owner-seed.conf with Wants= rewritten to Requires= -> RED, naming
#       walk-vessel.service and walk-owner-seed.service (the walk went dead after a seeder rerun under Requires=)
#   (c) must-fail: the same for described-shape-vessel, a unit render-unit.sh writes at boot (here only as its
#       drop-in directory)
#   (d) must-fail: BindsTo=, PartOf= and Requisite= on a one-shot job are refused like Requires=
#   (e) a later empty Requires= resets the list, as systemd does: the same mutant plus a reset drop-in passes
#   (f) a hard dependency on a long-running service stays allowed (records-vessel PartOf= discovery, as committed)
#   (h) must-fail (qa C1): '  Requires = <job>' with the whitespace systemd ignores is refused
#   (i) must-fail: a job named on a continued line (trailing backslash) is refused
#   (j) must-fail: a job named by its Alias= is refused
#   (k) a name without its suffix passes: systemd refuses it as a dependency ("Invalid argument"), so nothing stops
#   (g) the mutation spelling is the one image-coverage-map.check.sh's mutate() replays, and its mutant hashes to the
#       mutated_blob the coverage map records for both drop-ins
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/validation/scripts/gate/fixtures/unit-dependencies.sh"
CM="$ROOT/scripts/substrate/gate/coverage.json"
T="$(mktemp -d "${TMPDIR:-/tmp}/unitdeps.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
U=scripts/substrate/units
HOW='rewrite Wants= to Requires='
mk() { rm -rf "$T/c"; mkdir -p "$T/c/scripts"; cp -a "$ROOT/scripts/substrate" "$T/c/scripts/"; }
run() { CANDIDATE_DIR="$T/c" bash "$FX" > "$T/out" 2>&1; }
mutate() { sed 's#^\([[:space:]]*\)Wants\([[:space:]]*=\)#\1Requires\2#' "$1"; }   # as check.sh replays "$HOW"

mk; run && ok "(a) control: the committed units pass unit-dependencies.sh" || { bad "(a) control failed: $(head -3 "$T/out")"; echo "$FAILS failure(s)"; exit 1; }

for v in walk-vessel described-shape-vessel; do
  f="$U/$v.service.d/40-after-owner-seed.conf"; tag=b; [ "$v" = described-shape-vessel ] && tag=c
  mk; mutate "$ROOT/$f" > "$T/m"; cp "$T/m" "$T/c/$f"
  if ! run && grep -q "FAIL - $v.service: Requires=walk-owner-seed.service" "$T/out"; then ok "($tag) $v with Requires= on the seeder is refused by name"
  else bad "($tag) $v with Requires= on the seeder was not refused: $(head -2 "$T/out")"; fi
done

for key in BindsTo PartOf Requisite; do
  mk; f="$U/walk-vessel.service.d/40-after-owner-seed.conf"; sed "s#^Wants=#$key=#" "$ROOT/$f" > "$T/c/$f"
  if ! run && grep -q "FAIL - walk-vessel.service: $key=walk-owner-seed.service" "$T/out"; then ok "(d) $key= on a one-shot job is refused"
  else bad "(d) $key= on a one-shot job was not refused: $(head -2 "$T/out")"; fi
done

mk; f="$U/walk-vessel.service.d/40-after-owner-seed.conf"; mutate "$ROOT/$f" > "$T/c/$f"
printf '[Unit]\nRequires=\n' > "$T/c/$U/walk-vessel.service.d/45-reset.conf"
run && ok "(e) a later empty Requires= resets the list" || bad "(e) the reset was not honoured: $(head -2 "$T/out")"

mk; grep -q '^PartOf=discovery-vessel.service' "$ROOT/$U/records-vessel.service.d/50-restart-with-deps.conf" && run \
  && ok "(f) PartOf= on long-running services stays allowed" || bad "(f) a hard dependency on a long-running service was refused"

D="$U/described-shape-vessel.service.d"
mk; printf '[Unit]\n  Requires = walk-owner-seed.service  \n' > "$T/c/$D/60-x.conf"
if ! run && grep -q "FAIL - described-shape-vessel.service: Requires=walk-owner-seed.service" "$T/out"; then ok "(h) '  Requires = <job>' (whitespace systemd ignores) is refused"
else bad "(h) the spaced form was not refused: $(head -2 "$T/out")"; fi
mk; printf '[Unit]\nRequires=discovery-vessel.service \\\n    walk-owner-seed.service\n' > "$T/c/$D/60-x.conf"
if ! run && grep -q "FAIL - described-shape-vessel.service: Requires=walk-owner-seed.service" "$T/out"; then ok "(i) a job named on a continued line (trailing backslash) is refused"
else bad "(i) the continued line was not refused: $(head -2 "$T/out")"; fi
mk; printf '[Install]\nAlias=owner-rows.service\n' > "$T/c/$U/walk-owner-seed.service.d/60-alias.conf"
printf '[Unit]\nPartOf=owner-rows.service\n' > "$T/c/$D/60-x.conf"
if ! run && grep -q "FAIL - described-shape-vessel.service: PartOf=owner-rows.service" "$T/out"; then ok "(j) a job named by its Alias= is refused"
else bad "(j) the alias was not refused: $(head -2 "$T/out")"; fi
mk; printf '[Unit]\nRequires=walk-owner-seed\n' > "$T/c/$D/60-x.conf"
run && ok "(k) a name without its suffix passes: systemd refuses it as a dependency (Invalid argument)" || bad "(k) a suffix-less name was refused: $(head -2 "$T/out")"

grep -qF "'$HOW') sed 's#^\\([[:space:]]*\\)Wants\\([[:space:]]*=\\)#\\1Requires\\2#' \"\$2\" ;;" "$ROOT/validation/scripts/image-coverage-map.check.sh" \
  && ok "(g) image-coverage-map.check.sh replays '$HOW' with the same sed" || bad "(g) image-coverage-map.check.sh has no '$HOW' mutation with this sed"
for v in walk-vessel described-shape-vessel; do
  f="$U/$v.service.d/40-after-owner-seed.conf"; mutate "$ROOT/$f" > "$T/m"
  # Both sides must be read: with no jq or no git, two empty strings would compare equal and pass.
  want=$(jq -r --arg s "$f" '[.paths[]|select(.src==$s)][0].evidence.mutated_blob // empty' "$CM")
  got=$(git hash-object "$T/m" 2>/dev/null)
  [ -n "$want" ] && [ -n "$got" ] && [ "$got" = "$want" ] && ok "(g) the $v mutant hashes to the recorded mutated_blob" \
    || bad "(g) the $v mutant hashes to '${got:0:12}', the map records '${want:0:12}' (empty: not read)"
done
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
