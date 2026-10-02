#!/usr/bin/env bash
# J8: the fixture corpus belongs to the ACCEPTED version (H2). The classifier
# (scripts/substrate/gate/candidate.sh, run from accepted/) judges each gate candidate:
#   must fail   a candidate EDITING an accepted fixture -> verdict widening, an
#               authority_widening gap, NO promote.request (the 6ac1aa6 class)
#   must fail   a candidate REMOVING one, or dropping a gate_paths / fixture_paths glob from
#               gate-policy.json -> widening likewise
#   must fail   a candidate whose body does not parse -> shadow refused, gate_candidate_refused
#   control     a candidate ADDING a fixture -> shadow pass on the accepted corpus -> soaks N
#               ticks -> promote.request -> the runner promotes -> the fixture is in accepted/
#   also        a commit touching no gate path -> verdict none
# usage: validation/scripts/gate-j8-fixture-edit.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
FX=validation/scripts/gate/fixtures

judge() { # -> verdict output in $T/cand.txt
  bash "$G/accepted/scripts/substrate/gate/candidate.sh" --gate-dir "$G" --super "$T/super" \
    --candidate "$(git -C "$T/super" rev-parse HEAD)" > "$T/cand.txt" 2>&1
}
fresh() { gt_repo "${1:-1}"; gt_runner tick; [ "$RC" = 0 ] || { bad "bootstrap exit $RC"; show; }; A0="$(cat "$G/accepted.sha")"; }
no_request() { [ ! -e "$G/promote.request" ]; }
shows() { sed 's/^/    /' "$T/cand.txt" | tail -8; }

fresh; echo "# edited" >> "$T/seed/$FX/parses.sh"; gt_push "edit fixture" >/dev/null; judge
grep -q '^verdict widening.*parses.sh (accepted fixture edited or removed)' "$T/cand.txt" && ok "edit: classified widening" || { bad "edit: not widening"; shows; }
grep -q '^GAP .*"category":"authority_widening"' "$T/cand.txt" && ok "edit: authority_widening gap" || bad "edit: no widening gap"
no_request && ok "edit: no promote.request" || bad "edit: promote.request written"
jq -e 'select(.kind=="candidate_widening") | (.reason|test("parses.sh")) and (.at|length>0)' "$G/notices.jsonl" >/dev/null 2>&1 \
  && ok "edit: a candidate_widening notice in the gate's own store" || bad "edit: no notice in notices.jsonl"
judge; [ "$(grep -c candidate_widening "$G/notices.jsonl")" = 1 ] && ok "edit: re-judged next tick, noticed once" || bad "edit: $(grep -c candidate_widening "$G/notices.jsonl") notices for one widening"

fresh; git -C "$T/seed" rm -q "$FX/parses.sh"; mkdir -p "$T/seed/$FX"; echo '#!/usr/bin/env bash' > "$T/seed/$FX/other.sh"; gt_push "remove fixture" >/dev/null; judge
grep -q '^verdict widening' "$T/cand.txt" && no_request && ok "remove (even with an add): widening, no request" || { bad "remove: not widening"; shows; }

fresh; jq '.gate_paths -= ["validation/scripts/*"]' "$T/seed/scripts/substrate/gate/gate-policy.json" > "$T/p" && mv "$T/p" "$T/seed/scripts/substrate/gate/gate-policy.json"
gt_push "drop a gate glob" >/dev/null; judge
grep -q "^verdict widening.*drops gate_paths entry 'validation/scripts/\*'" "$T/cand.txt" && no_request && ok "policy drops a gate glob: widening" || { bad "policy glob drop: not widening"; shows; }

fresh; printf '#!/usr/bin/env bash\nif then fi\n' > "$T/seed/scripts/substrate/substrate-pull-sync.sh"; gt_push "unparseable" >/dev/null; judge
grep -q '^verdict refused.*shadow' "$T/cand.txt" && grep -q '"category":"gate_candidate_refused"' "$T/cand.txt" && no_request \
  && ok "unparseable body: shadow refused, gap, no request" || { bad "unparseable: not refused"; shows; }

fresh; echo "x" > "$T/seed/docs/other.md"; gt_push "not a gate path" >/dev/null; judge
grep -q '^verdict none' "$T/cand.txt" && no_request && ok "non-gate change: verdict none" || { bad "non-gate: $(cat "$T/cand.txt")"; }
fresh; echo "x" > "$T/seed/scripts/substrate/deploy-hub-pull.sh"; gt_push "explicit non-root path" >/dev/null; judge
grep -q '^verdict none' "$T/cand.txt" && no_request && ok "a listed non_root_paths file: verdict none (the exclusion applies)" || { bad "non-root: $(cat "$T/cand.txt")"; }
fresh; echo "x" > "$T/seed/scripts/substrate/render-secret-scope.sh"; gt_push "root glue" >/dev/null; judge
grep -q 'gate paths changed.*render-secret-scope.sh' "$T/cand.txt" && ok "root glue (render-secret-scope.sh) is a gate path" || { bad "render-secret-scope.sh not gated"; shows; }
fresh; jq '.non_root_paths += ["scripts/substrate/render-secret-scope.sh"]' "$T/seed/scripts/substrate/gate/gate-policy.json" > "$T/p" && mv "$T/p" "$T/seed/scripts/substrate/gate/gate-policy.json"
gt_push "add an exclusion" >/dev/null; judge
grep -q "^verdict widening.*adds non_root_paths entry 'scripts/substrate/render-secret-scope.sh'" "$T/cand.txt" && no_request && ok "policy ADDS a non-root exclusion: widening" || { bad "added exclusion: not widening"; shows; }

# control: an ADDED fixture -> soak 2 -> promote; the fixture joins the corpus on promotion
fresh 2; printf '#!/usr/bin/env bash\n# kind: known-valid\nexit 0\n' > "$T/seed/$FX/added.sh"; C="$(gt_push "add fixture")"; judge
grep -q '^verdict soaking.*1/2' "$T/cand.txt" && no_request && ok "add: shadow pass, soaking 1/2" || { bad "add: not soaking"; shows; }
judge
grep -q '^verdict promote' "$T/cand.txt" && [ "$(jq -r .sha "$G/promote.request" 2>/dev/null)" = "$C" ] && ok "add: second pass writes promote.request for the candidate" || { bad "add: no request"; shows; }
jq -e --arg f "$A0" '.from_sha==$f and (.verdict_trace_id|startswith("shadow:"))' "$G/promote.request" >/dev/null && ok "add: the request carries from_sha and a verdict id" || bad "add: request body $(cat "$G/promote.request")"
[ ! -e "$G/accepted/$FX/added.sh" ] && ok "add: not in the corpus before promotion" || bad "add: joined the corpus early"
gt_runner tick
[ "$(cat "$G/accepted.sha")" = "$C" ] && [ -f "$G/accepted/$FX/added.sh" ] && ok "add: promoted; the fixture is in accepted/" || { bad "add: not promoted"; show; }
done_tests
