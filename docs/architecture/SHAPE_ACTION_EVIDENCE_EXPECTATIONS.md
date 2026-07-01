# Shape→Action→Evidence Expectations

> **What this document is.** A set of falsifiable expectations the substrate holds about its
> own shape→action→evidence mapping, written where the closure loop can see them
> (docs-align-scan watches `docs/**`). Each claim names its metric, floor, source, and
> measurement window, plus a **Status** line that is updated only from measurements. A claim
> whose Status contradicts reality is documentation drift — the docs-as-expectation loop
> (docs-align-scan → `doc_drift_fix`) is expected to flag it. Verification of these claims is
> the acceptance surface of
> `openspec/changes/2026-07-01-shape-action-evidence-closure-proof/`.
>
> **Convention:** `Status: expected — not yet measured` means the claim's window has not
> opened (the enabling change has not landed); this is not drift. `Status: measured — <value>
> (<date>)` is a factual claim about the recorded measurement and IS falsifiable against the
> named source.

## The condition being proven

The substrate consistently works on tasks that improve its ability to map **shapes → action →
evidence**: every natural-language goal gets a shape-lattice entry point, walks toward it,
passes the reach gate, records evidence keyed by state signature, and the substrate's own
authored commits measurably improve this loop — including on the implicit human channel
(obsidian-vessel), where the human's observed interaction is the verification signal and
unmet interaction-expectations are real failures.

## Claim 1 — Target-shape seeding rate

**Expectation:** ≥ 0.8 of fresh natural-language goals dispatched via goal-host `/run-goal`
(no explicit `expected_output_shapes`, no `targetTemplateId`) carry non-empty
`inferred_target_shapes` in the walk log.
**Source:** goal-host journal (`journalctl -u goal-host-vessel | grep inferred_target_shapes`)
over the dispatch count in the same window; `goal_execution_paths` rows for the same goals.
**Window:** 7 days after the goal-target-shape-inference change lands (workstream B).
**Status:** expected — not yet measured (B not landed; structurally 0 before B).

## Claim 2 — Reach rate rises, hollow completions decline

**Expectation:** reach-gated success fraction of completed dispatches ≥ pre-B baseline
+ 15 points; hollow completions (`status=completed` with empty `completion_shapes`) declining
week-over-week.
**Source:** `goal_execution_paths.success` grouping; hydrated `goal_status` produced-shape
views; baseline recorded in the umbrella change's design.md evidence table.
**Window:** 7 days post-B vs the pre-B baseline window.
**Status:** expected — not yet measured (baseline pending C1).

## Claim 3 — Frontier closure velocity

**Expectation:** the `learning_mode` frontier (shapes necessary ∧ not available) is
non-increasing while the shape vocabulary grows, and every frontier shape that closes has a
reach-gated producing trace (not a hollow mint).
**Source:** development-vessel `learning_mode` resolver output (frontier size per snapshot);
`shape_closure_demand` queue depth; producing traces via `goal_execution_paths` /
execution-trace reads.
**Window:** rolling 7 days, evaluated at C2.
**Status:** expected — not yet measured.

## Claim 4 — Signature discrimination

**Expectation:** `context_thompson_scores.n_observations` growth is concentrated
(non-uniform across signatures), posterior-mean spread per template is non-flat, and
selection entropy on repeated identical goals decreases.
**Source:** `context_thompson_scores` distribution; `autonomy-status.ts` kappa spread;
development-vessel `selection-entropy` resolver per success-bucket.
**Window:** rolling 7 days, evaluated at C2.
**Status:** expected — not yet measured.

## Claim 5 — Coverage-matrix fill

**Expectation:** stratified-harness cells below the success floor decrease run-over-run, and
≥ 1 cell is flagged `closing` by the second run.
**Source:** `validation/baselines/2026-07-01-stratified.json` (run 1) vs the C2 re-run report;
`compare-reports.ts --stratified`.
**Window:** the C1 baseline → C2 re-run pair.
**Status:** expected — not yet measured (baseline pending C1).

## Claim 6 — Substrate-authored improvement commits

**Expectation:** ≥ 1 substrate-authored commit lands on `origin/dev` with no operator
intervention, causally tied to a measured delta in Claims 1–5 (the commit's change is the
enabling mechanism of the delta, verified by before/after measurement around its landing).
"Just firing" — a landing with no measured delta — does not satisfy this claim.
**Source:** `git log origin/dev` filtered by the substrate git author, cross-referenced to
mitosis-cutover traces and the evidence table.
**Window:** duration of the umbrella change.
**Status:** expected — not yet measured.

## Claim 7 — Human-interaction closure (implicit channel)

**Expectation:** (a) human interaction episodes are durable, solicitation-attributed evidence
(each episode traceable to the substrate output that solicited it); (b) solicitation→response
rate and novel-episode-class rate are measured and non-declining; (c) unmet
interaction-expectations are recorded as failures (verifier_negative-style β on the
soliciting activity), never silently dropped — **we fail when we cannot reliably get the
human to interact in ways we expect or that generate novelty**; (d) ≥ 1 substrate-authored
obsidian-vessel change whose post-deploy interaction metrics beat its pre-deploy baseline
window. Expectations are scored only when the operator-presence bit (environmental state
signature `op`) was set during the horizon — an absent human is not a surface failure.
**Source:** G1 episode records + `interactionExpectation` verdicts (workstream G);
`obsidian-behavior-scan` `forward_model_strength` trend; obsidian-vessel git history ×
interaction metrics.
**Window:** 14 days after G2 lands.
**Status:** expected — not yet measured (G1/G2 not landed).

## Standing invariants (falsifiable now)

These are claims about the present system that the closure loop can verify immediately:

- The reach gate (`verifyGoalReached`, goal-host) runs after execution and β-penalises hollow
  completions; reward is reaching the goal, not exit status.
- Failed traces receive a failure-conditioned `repair_signature` (signature version `1f`,
  migration 153) at ingest.
- Per-`(signature, template)` posterior deltas write through to cluster posteriors (D4), and
  cold leaves (n < 5) read the cluster posterior unless the cluster is contaminated
  (success-rate spread > 0.4) (D5).
- Successor-feature cells (ψ, discounted shape-occupancy) are learned at trace ingest and
  blended into recommend ranking when enabled.
- The learner self-tunes: `learning_policy` recomputes `TD_LAMBDA` / `YIELD_FLOOR` from live
  posterior statistics and `learning_policy_writeback` actuates them via `/v2/tuning-params`.
- Only `discovery-vessel` and `identity-vessel` are protected from substrate-authored cutover;
  obsidian-vessel is substrate-modifiable.
