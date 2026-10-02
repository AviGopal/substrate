# Shape→Action→Evidence Closure Proof

**Date:** 2026-07-01
**Vessels:** goal-host-vessel, development-vessel, activity-api, obsidian-vessel (+ validation harness)
**Stage:** UMBRELLA (sequencing + acceptance surface for six coupled workstreams)
**Operator intent:** "Set our expectations and help the system develop itself into this condition. We must prove that it can and does work on tasks that improve its ability to interact and map shapes to action and evidence."

## Problem

The substrate has all the pieces of a shape→action→evidence loop — shape-graph walk, reach gate, per-goal learning, state-conditioned Thompson, cluster pooling, self-tuning learner — but the proof that it *works on tasks that improve this mapping* is not yet establishable, for five concrete reasons:

1. **No lattice entry point.** NL goals arrive with `target.size===0`, so the walk runs opportunistic and the closure machinery (`advancesTarget`, `isHollowScaffold` exclusion) is dead code (root-caused in `2026-06-25-goal-target-shape-inference`).
2. **The proof instrument is unfinished.** The stratified goal harness (40/44) is designed exactly as the "arbitrary scale" measurement (decomposition-depth axis, coverage matrix, optimality gap) but its trend flags and detectors aren't done, and no committed baseline exists to measure against.
3. **Substrate-authored landings are not yet trustworthy.** The cutover verify gate is semantically blind (`typecheck=clean ≠ gap fixed`; hollow landing demonstrated 2026-06-25), so "the system improved itself" claims can be hollow.
4. **Expectations are not machine-visible.** The condition we want to prove is not written anywhere docs-align-scan watches, so the closure loop cannot keep score on it. Worse, `SUBSTRATE_AS_MDP/DEC` still model the binary success bit — wrong expectations the loop will keep flagging.
5. **The implicit human channel produces no gated evidence.** Obsidian interactions are in-memory, pull-only, unattributed to the substrate outputs that solicited them; there is no expectation → verify → learn loop on the interaction surface, and no path for the system to modify obsidian-vessel to improve its interaction/novelty rate. We rely on explicit buttons, which is exactly the reliance the operator wants dropped: **we should fail when we can't reliably get the human to interact in ways we expect or that generate novelty**, because outside episode/shape space we cannot model interaction validity.

## Change (six workstreams, one acceptance surface)

- **A — Expectations.** `docs/architecture/SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md`: seven falsifiable claims (metric/floor/source/window) that docs-align-scan watches. Fold reach-gated reward, `goal_execution_paths`, successor features, and D4/D5 cluster pooling into `SUBSTRATE_AS_MDP.md`/`SUBSTRATE_AS_DEC.md` (fold-in, not supersession banners); close the `SUBSTRATE_AS_SOFTWARE.md` §6 admission; reconcile `2026-06-04-learning-rate-7-successor-features` tasks against the code that already landed.
- **B — Closure keystone via the substrate's own loop.** Drive `2026-06-25-goal-target-shape-inference` through `substrateGap_write` → `gap_to_feature` → `feature_compose` → mitosis cutover → `origin/dev` (target_vessel: goal-host-vessel, anchored, scope-narrowed). Operator fallback time-boxed at 3 substrate attempts / 48h.
- **C — Proof instrument.** Finish the 4 open harness tasks (G3.3.1, G4.1.2, G4.1.3, G7.3.1); commit a pre-B baseline (`validation/baselines/2026-07-01-stratified.json`); re-run post-B.
- **D — Consumption seams.** D1: consume `'1f'` repair signatures in the recommend path (flag `REPAIR_SIGNATURE_CONSUME`, OFF). D2: info-gain α-bonus (`2026-05-30-info-gain-bonus-on-success`) — substrate-dispatch candidate. D3: novelty producer as a filed capability gap (`noveltyImpulse`, target dev-vessel) with operator-wired consumption.
- **E — Reliability guards.** E1 (before B): semantic cutover gate per `2026-06-25-semantic-cutover-verification-gate`, default ON; revert the known hollow patch. E2: cross-signature reputation penalty per `2026-06-25-cross-signature-reputation-penalty`, flag OFF until B is measured.
- **G — Implicit human-interaction closure.** G1: episodes become durable, solicitation-attributed evidence (obsidian-vessel `solicitation_id` stamping + dev-vessel collector). G2: `interactionExpectation` impulses gated after a horizon — unmet → verifier_negative β on the soliciting activity; met-without-novelty → low info-yield; met-with-novelty → full credit; operator-presence guard so an absent human is never a surface failure. G4: repeated unmet expectations file `interaction_surface_gap` (target obsidian-vessel; NOT protected) → the substrate authors its own surface changes, reach-gated by post-deploy interaction metrics.

## Why this ordering

E1 and the C baseline land **before** B because B is the first substrate-authored commit the proof counts: without E1 the landing could be hollow; without the baseline the improvement is unmeasurable. Flag discipline (E2/D1 land OFF, flips staggered post-measurement) keeps B's causal attribution clean. G runs parallel to B (different vessels) but G4 waits for G2's failure evidence — surface self-modification must be driven by measured interaction failures, not speculation.

## Acceptance

Every claim in `SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md` measured true within its window, **and** docs-align-scan reports zero drift against that doc — the closure loop itself certifies the expectations held. Includes ≥1 substrate-authored commit on `origin/dev` causally tied to a measured delta (criterion 6) and the interaction-closure loop live with failures recorded (criterion 7). "Just firing" does not count.

## Out of scope

- Flipping `CROSS_SIG_REPUTATION_PENALTY` / `REPAIR_SIGNATURE_CONSUME` permanently (measured flips are in scope; permanence is a follow-up decision).
- The larger learning-rate series (IDS M5, hierarchical clustering M8) — sequenced after this proof.
- Pattern-miner event hooks and workbench novelty badging (read-side polish).
- Federation-scale interaction surfaces (single-substrate, single-human proof first).
