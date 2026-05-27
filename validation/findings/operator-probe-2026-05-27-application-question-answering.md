---
agent: operator
generated_at: 2026-05-27T03:30:00Z
trigger: operator-dispatched probe — "fill out the Disrupt 2026 Startup Battlefield 200 application"
substrate: localhost:18080 (substrate-live, uptime 40h, activity-api 1.20.9, goal-host-vessel 0.1.0)
dispatch_id: 868209c1-43bf-4c39-b416-d6fdf648199a
execution_id: exec_zlmgjlge
related: percolation_2026_05_26_lift_criteria_state, S.4a, F-094 cold-start
provenance: unverified
provenance_note: |
  Per audit F-131 (reclassified MEDIUM in inv-055, 2026-05-27): this file is
  not backed by a git commit from the operator's signed identity. The
  `agent: operator` claim is the file's self-description, not a verifiable
  provenance signal. Substrate processes can produce any file with any
  frontmatter.

  The substantive observations in this file (Disrupt-application produced
  no `answeredApplication` shape; refusal pathway missing at the time) are
  internally consistent with substrate behavior observed independently in
  iter 2-14. The refusal-guard work that followed (commits 0e64843, dfbc587)
  is correct regardless of authorship.

  Going forward, operator probes should be committed via the operator's
  signed identity (avigopal.aero@gmail.com) — not the substrate's devbob
  identity — to establish durable provenance. See validation/findings/README.md.
---

# Operator Probe — Capability Gap: Document-Question-Answering

## Probe

Operator submitted a real-world unstructured task: answer ~60 questions across 9 sections (POC info, company info, product details, videos, market, traction, financials, team, founders, nomination source) from the Disrupt 2026 Startup Battlefield 200 application form. Goal text framed as decomposition + retrieve + compose + verify + assemble. Expected output shapes: `answeredApplication`, `questionImpulse`, `answerImpulse`. Goal body included a verbatim summary of all required fields with conditional dependencies.

Dispatch path: `POST http://localhost:18210/run-goal` with operator API key, payload at `/tmp/disrupt-goal.json` (138 fields enumerated).

## Result

Goal **completed** with `status: success` in 107s. No errors raised. Trace `exec_zlmgjlge` recorded normally.

**However**: Thompson Sampling selected `activity:⟨development-vessel:probe-reachable-unlearned⟩` — a topology-discovery probe template — not anything that consumes a document or produces answers.

Trace contents:
- Task 1: `get_report` → `reachable_unlearned_report` resolver → produced `dev:reachable_unlearned_report_ku8ugk45` (internal topology impulse, unrelated to the goal)
- Task 2: `recommend` → `activity_recommend` resolver → produced `dev:activity_recommend_j8m85cnj`
- `cost_usd: 0`, `tokens_input: 0`, `tokens_output: 0`
- Zero questions extracted, zero answers produced, the document body was never read by any resolver

The substrate **silently succeeded at the wrong task**.

## Root cause

Three compounding gaps:

1. **No shape coverage.** The catalogue contains no producer for `answeredApplication`, `questionImpulse`, or `answerImpulse`. `expected_output_shapes` filter matched zero templates, so the recommender fell back to its prior-on-everything posterior.

2. **No semantic resolver for goal text.** Once a template is selected, task execution is template-driven; the goal body string is not consumed by any resolver. The goal text only influences ranking — not execution.

3. **Thompson posterior is dominated by topology probes.** `probe-reachable-unlearned` and its siblings have accumulated α from continuous boredom-loop execution (matches S.4a finding in `percolation_2026_05_26_lift_criteria_state.md`: "boredom goals[2]+[6] dispatch wrong templates"). With no semantically-matching candidates, the highest-α generic template wins.

## What's missing

Minimal seed templates for the document-QA pipeline would let the binding layer decompose this goal correctly:

- `extract-questions` — input: `document` → output: `questionImpulse[]` (LLM-resolver; question boundaries + expected-answer-shape inference are semantic)
- `compose-answer` — input: `questionImpulse + context` → output: `answerImpulse` (LLM-resolver for synthesis; deterministic for factual lookup against known shapes)
- `verify-answer` — input: `answerImpulse + questionImpulse` → output: `validation_result` (shape/length/constraint check; cite-evidence for citation-required questions)
- `assemble-answers` — input: `answerImpulse[]` → output: `answeredApplication` (deterministic; keyed by question id)

Plus a `document` ingest resolver and a `requires-operator-input` shape for fields with no substrate-side producer (POC name/email, founder names, financials).

## Closure-property observation

This probe surfaces a **refusal gap** relevant to the S2→S3 push-away criterion (IAL §27.S.6). The expected mature behavior is:

> Selector refuses dispatch with cited evidence: "no producer for shape `answeredApplication`; recommend seeding `extract-questions` + `compose-answer` + `assemble-answers`; or supply `targetTemplateId`."

Current behavior is "select highest-α template and run it." The substrate has no mechanism to recognize "the highest-α candidate has output shapes disjoint from the requested output shapes" as a refusal-worthy condition. This is structurally adjacent to the documented S.4a issue (boredom selecting validator-dispatch 74% regardless of goal) — both stem from the selector treating low-fit candidates as acceptable when better candidates don't exist.

Reasonable forward path: **add a guard in template selection** that emits a `human_in_the_loop_required` impulse (or an `unresolvable_goal` failure_mode) when the highest-scoring template's `output_shapes ∩ expected_output_shapes = ∅`. This is cheaper than seeding the QA pipeline and exercises the push-away closure property directly.

## Suggested next steps (priority order)

1. **Cheap, high-value**: Add the disjoint-output-shapes refusal guard in `activity_recommend`. Emits a structured failure rather than a confident wrong answer. Closes a small but real gap in S2→S3.
2. **Medium**: Seed the four document-QA templates above into `development-vessel` so future operator probes of this kind have somewhere to land. Acts as a regression test for goal decomposition.
3. **Adjacent**: Investigate why `expected_output_shapes` didn't already act as a hard pre-Thompson filter (per CLAUDE.md "expected_output_shapes filter for shape-compatible variants") — the activity-api supports this on `/v2/activities/recommend`, but the goal-host path may not propagate it correctly.

## Verification

```bash
# Reproduce
API_KEY=$(grep '"apiKey"' ~/.metabob/config.json | head -1 | sed 's/.*"apiKey": "//; s/",.*//')
curl -s -X POST http://localhost:18210/run-goal \
  -H "Authorization: ApiKey $API_KEY" \
  -H "Content-Type: application/json" \
  --data @/tmp/disrupt-goal.json
# → {"dispatchId":"...","status":"running"}

# Poll
curl -s "http://localhost:18210/executions/<dispatchId>" -H "Authorization: ApiKey $API_KEY"
# → status:completed; selectedTemplateId: activity:⟨development-vessel:probe-reachable-unlearned⟩

# Inspect trace
curl -s "http://localhost:18080/v2/activities/execution-traces/<executionId>" \
  -H "Authorization: ApiKey $API_KEY" | python3 -m json.tool
# → success=true, two topology-discovery tasks, document body never consumed
```

Goal payload preserved at `/tmp/disrupt-goal.json` (will not survive container restart; copy into `validation/probes/` if needed for replay).
