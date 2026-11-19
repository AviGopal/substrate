#!/usr/bin/env bash
# The gate's widening rule (H2) is stated once, in scripts/substrate/gate/widening.sh, and the classifier asks it.
# widening.sh, between a base and a head of a scratch super-repo, judged by the BASE's policy:
#   must fail   an accepted fixture edited, or removed -> widening (exit 1), naming the path
#   must fail   the head's policy dropping a gate_paths or a fixture_paths entry, adding a non_root_paths entry, lowering
#               soak_ticks.default, raising soak_ticks.max, not being a JSON object, or missing -> widening
#   must fail   the head's own policy never judges the head: a head that also calls an edit ordinary is still a widening
#   must fail   with a gate manifest, a path its "!" globs exclude, or no glob names, is not judged as a fixture
#   must fail   an unreadable base policy, or a base or head that is no commit -> cannot judge (exit 2), never "none"
#   control     a fixture added, a gate_paths entry added, the soak floor raised, a non-gate file changed -> none (exit 0)
# candidate.sh, run from a scratch accepted gate (gate-test-lib):
#   must fail   no widening.sh beside it, or an accepted policy it cannot read -> verdict refused, a
#               gate_candidate_refused gap, no promote.request (never judged as having no widening)
#   control     an edited fixture -> verdict widening, with the same reason text as before the rule moved
#   control     an edited fixture the accepted manifest's "!" glob excludes, beside a body edit -> judged, but not a
#               widening (the manifest is passed on)
# usage: validation/scripts/gate-widening.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
W="$GT_ROOT/scripts/substrate/gate/widening.sh"
FX=validation/scripts/gate/fixtures
PREL=scripts/substrate/gate/gate-policy.json

# ── widening.sh on its own ──
R="$T/w"; git init -q -b dev "$R"; mkdir -p "$R/scripts/substrate/gate" "$R/$FX" "$R/docs"
cp "$GT_ROOT/$PREL" "$R/$PREL"
echo "echo ok" > "$R/$FX/one.sh"; echo "echo ok" > "$R/$FX/two.sh"; echo "a doc" > "$R/docs/a.md"
g "$R" add -A; g "$R" commit -m base; BASE="$(git -C "$R" rev-parse HEAD)"
cp "$R/$PREL" "$T/base-policy.json"
head_with() { # <label> <commands run in $R> -> HEAD sha of a branch off BASE with that change
  git -C "$R" checkout -q -B "h-$1" "$BASE"; (cd "$R" && eval "$2"); g "$R" add -A; g "$R" commit -m "$1" --allow-empty
  git -C "$R" rev-parse HEAD
}
wide() { # <head> [args...] -> RC and OUT
  local h="$1"; shift
  OUT="$(bash "$W" --policy "$T/base-policy.json" --super "$R" --base "$BASE" --head "$h" "$@" 2>&1)"; RC=$?
}
pol() { jq "$1" "$R/$PREL" > "$R/p.tmp" && mv "$R/p.tmp" "$R/$PREL"; }

wide "$(head_with edit "echo '# edited' >> $FX/one.sh")"
[ "$RC" = 1 ] && grep -qx "M $FX/one.sh (accepted fixture edited or removed)" <<<"$OUT" && ok "[MUST-FAIL] an edited fixture is a widening, named" || bad "edit: rc $RC, $OUT"
wide "$(head_with remove "rm $FX/two.sh")"
[ "$RC" = 1 ] && grep -qx "D $FX/two.sh (accepted fixture edited or removed)" <<<"$OUT" && ok "[MUST-FAIL] a removed fixture is a widening" || bad "remove: rc $RC, $OUT"
for c in "gate_paths|.gate_paths -= [\"validation/scripts/*\"]|drops gate_paths entry 'validation/scripts/\\*'" \
         "fixture_paths|.fixture_paths = []|drops fixture_paths entry 'validation/scripts/gate/fixtures/\\*'" \
         "non_root|.non_root_paths += [\"scripts/substrate/x.sh\"]|adds non_root_paths entry 'scripts/substrate/x.sh'" \
         "soak-floor|.soak_ticks.default = 0|lowers soak_ticks.default 1 -> 0" \
         "soak-cap|.soak_ticks.max = 99|raises soak_ticks.max 12 -> 99" \
         "soak-type|.soak_ticks.default = \"1\"|lowers soak_ticks.default 1 -> 1"; do
  IFS='|' read -r label expr want <<<"$c"
  wide "$(head_with "$label" "pol '$expr'")"
  [ "$RC" = 1 ] && grep -q "^$PREL $want" <<<"$OUT" && ok "[MUST-FAIL] the head's policy: $label is a widening" || bad "$label: rc $RC, $OUT"
done
wide "$(head_with notjson "echo '[1]' > $PREL")"
[ "$RC" = 1 ] && grep -q "is not a JSON object" <<<"$OUT" && ok "[MUST-FAIL] a head policy that is not a JSON object is a widening" || bad "not json: rc $RC, $OUT"
wide "$(head_with nopolicy "rm $PREL")"
[ "$RC" = 1 ] && grep -q "drops gate_paths entry" <<<"$OUT" && ok "[MUST-FAIL] a head with no policy drops every entry: a widening" || bad "no policy: rc $RC, $OUT"
wide "$(head_with selfjudge "pol '.classifier.fixture_ordinary_status = [\"A\",\"M\"]'; echo '# edited' >> $FX/one.sh")"
[ "$RC" = 1 ] && grep -q "M $FX/one.sh" <<<"$OUT" && ok "[MUST-FAIL] the head's own policy never makes its edit ordinary (the base's is read)" || bad "self-judge: rc $RC, $OUT"

H="$(head_with manifest "echo '# edited' >> $FX/one.sh")"
jq -n --arg f "$FX/one.sh" '{gate_paths:["validation/scripts/*", ("!" + $f)]}' > "$T/m-excl.json"
wide "$H" --gate-manifest "$T/m-excl.json"
[ "$RC" = 0 ] && ok "[MUST-FAIL] with a manifest, a fixture its \"!\" glob excludes is not judged" || bad "manifest exclusion: rc $RC, $OUT"
jq -n '{gate_paths:["scripts/substrate/*"]}' > "$T/m-narrow.json"
wide "$H" --gate-manifest "$T/m-narrow.json"
[ "$RC" = 0 ] && ok "[MUST-FAIL] with a manifest, a path no gate glob names is not judged" || bad "manifest narrow: rc $RC, $OUT"
jq -n '{gate_paths:["validation/scripts/*"]}' > "$T/m-wide.json"
wide "$H" --gate-manifest "$T/m-wide.json"
[ "$RC" = 1 ] && ok "with a manifest naming it, the edited fixture is a widening" || bad "manifest names it: rc $RC, $OUT"

wide "$(head_with add "echo 'echo ok' > $FX/three.sh")"
[ "$RC" = 0 ] && [ -z "$OUT" ] && ok "a fixture added is not a widening (exit 0, nothing said)" || bad "add: rc $RC, $OUT"
wide "$(head_with grow "pol '.gate_paths += [\"packages/*\"] | .soak_ticks.default = 2'")"
[ "$RC" = 0 ] && ok "a gate_paths entry added and the soak floor raised are not a widening" || bad "grow: rc $RC, $OUT"
wide "$(head_with doc "echo more >> docs/a.md")"
[ "$RC" = 0 ] && ok "a change outside the gate is not a widening" || bad "doc: rc $RC, $OUT"

echo '{"gate' > "$T/broken.json"
OUT="$(bash "$W" --policy "$T/broken.json" --super "$R" --base "$BASE" --head "$H" 2>&1)"; RC=$?
[ "$RC" = 2 ] && ok "[MUST-FAIL] an unreadable base policy cannot be judged (exit 2)" || bad "broken base policy: rc $RC, $OUT"
OUT="$(bash "$W" --policy "$T/base-policy.json" --super "$R" --base "$BASE" --head 0123456789abcdef0123456789abcdef01234567 2>&1)"; RC=$?
[ "$RC" = 2 ] && ok "[MUST-FAIL] a head that is no commit cannot be judged (exit 2)" || bad "no head: rc $RC, $OUT"
OUT="$(bash "$W" --policy "$T/base-policy.json" --super "$R" --base 0123456789abcdef0123456789abcdef01234567 --head "$H" 2>&1)"; RC=$?
[ "$RC" = 2 ] && ok "[MUST-FAIL] a base that is no commit cannot be judged (exit 2)" || bad "no base: rc $RC, $OUT"

# ── candidate.sh asks it, from the accepted gate ──
judge() { # -> verdict output in $T/cand.txt
  bash "$G/accepted/scripts/substrate/gate/candidate.sh" --gate-dir "$G" --super "$T/super" \
    --candidate "$(git -C "$T/super" rev-parse HEAD)" > "$T/cand.txt" 2>&1
}
fresh() { gt_repo 1; gt_runner tick; [ "$RC" = 0 ] || { bad "bootstrap exit $RC"; show; }; }
no_request() { [ ! -e "$G/promote.request" ]; }
shows() { sed 's/^/    /' "$T/cand.txt" | tail -8; }

fresh; echo "# edited" >> "$T/seed/$FX/parses.sh"; gt_push "edit fixture" >/dev/null; judge
grep -q "^verdict widening .*: M $FX/parses.sh (accepted fixture edited or removed); \$" "$T/cand.txt" \
  && ok "candidate: an edited fixture is classified widening, the reason as before" || { bad "candidate edit: not widening"; shows; }

fresh; echo "# edited" >> "$T/seed/$FX/parses.sh"; echo "# body edit" >> "$T/seed/scripts/substrate/substrate-pull-sync.sh"
gt_push "edit fixture and body" >/dev/null
jq --arg f "$FX/parses.sh" '.gate_paths += ["!" + $f]' "$G/accepted/MANIFEST.json" > "$T/m.json" && cp "$T/m.json" "$G/accepted/MANIFEST.json"; judge
grep -q '^verdict ' "$T/cand.txt" && ! grep -q '^verdict widening' "$T/cand.txt" && ! grep -q 'parses.sh (accepted fixture' "$T/cand.txt" \
  && ok "candidate: a fixture the accepted manifest's \"!\" glob excludes is not judged (the manifest is passed on)" || { bad "candidate: manifest exclusion not passed on"; shows; }

fresh; echo "# edited" >> "$T/seed/$FX/parses.sh"; gt_push "edit fixture" >/dev/null
rm -f "$G/accepted/scripts/substrate/gate/widening.sh"; judge
grep -q '^verdict refused .*the widening check could not judge it' "$T/cand.txt" && grep -q '^GAP .*"category":"gate_candidate_refused"' "$T/cand.txt" && no_request \
  && ok "[MUST-FAIL] candidate: with no widening.sh beside it, the candidate is refused, never judged as having no widening" || { bad "candidate without widening.sh"; shows; }

fresh; echo "# body edit" >> "$T/seed/scripts/substrate/substrate-pull-sync.sh"; gt_push "body edit" >/dev/null
echo '{"gate' > "$G/accepted/$PREL"; judge
grep -q '^verdict refused .*the widening check could not judge it' "$T/cand.txt" && no_request \
  && ok "[MUST-FAIL] candidate: an accepted policy it cannot read refuses the candidate" || { bad "candidate with broken accepted policy"; shows; }

done_tests
