# Phase 3 — Closed-loop learning and verification

## Why

Phase 1 made the substrate able to see; Phase 2 made it able to author. Neither phase closed the loop. The substrate still requires an operator to hand-build the `recurringPatternCluster` and there is no behavioural verification of authored templates after they execute. Phase 3 closes the loop: detect recurring patterns autonomously, route verification by authored-activity output-shape, and refine on disagreement traces. This phase ships the transfer-test target — substrate identifies a recurring `(observation_signature, action_signature, post_observation_signature)` triple, mints a candidate activity, and beats uniform-random on next-occurrence prediction with no operator-curated scenario JSON anywhere.

## What changes

- Ship `detect-recurring-pattern` as a trace-store query + windowed-clustering activity. Default trigger threshold `n_occurrences ≥ 5`. Emits `recurringPatternCluster` impulses including contrast examples and an `n_concept_citations_available` field that the Phase 2 drafter consults.
- Ship `predict-and-verify` with verifier routing by authored-activity output-shape signature: `intentLabel` → behavioural-continuation verifier (observed continuation in `consistency_set`); `trajectoryPrediction` → sequence-match verifier (observed next-N signatures match prediction within horizon); `assistanceAction` → state-change verifier (observed post-signature matches `expected_post_signature`). Mixed candidates run all applicable verifiers and require AND-conjunction.
- Ship `refine-on-disagreement` as a lifecycle subscriber on `prediction_disagreement` traces. Consumes the sub-case and dispatches `draft-activity-from-pattern` for variant authorship; plugs into the existing `propagateCreditAlongChain` for parent-child credit flow.
- Populate the three `prediction_disagreement` sub-cases (`intent_inconsistency`, `trajectory_divergence`, `action_no_effect`) reserved by Phase 1. Wire posterior treatment per the umbrella discipline: `action_no_effect` = β=1.0; `intent_inconsistency` and `trajectory_divergence` = β=0.5.
- Register the Layer-2/3/4 shape vocabulary (`intentLabel`, `trajectoryPrediction`, `assistanceAction`) so substrate-authored activities can declare them as outputs.

## Out of scope

- Domain-specific (Obsidian-specific) trajectory predictors. Those activities are *authored by* the Phase 2 drafter running on Phase 1 events; this phase only ships the verifier infrastructure they plug into.
- Display-channel siblings — control extension, perception, host-peer, failure-mode extensions.
- Cross-substrate federation of substrate-authored Obsidian activities.
- Replacement of `draft-gap-closing-activity`.

## Dependencies

- **Phase 1** (`2026-06-01-obsidian-observe-and-experiment`) — supplies the `prediction_disagreement` schema slot and the observation read path the pattern detector queries.
- **Phase 2** (`2026-06-01-substrate-permissive-activity-authoring`) — supplies the drafter, the comprehensibility-check resolver, and the registration-time invariants. Phase 3's refiner dispatches the Phase 2 drafter.
- **Existing `propagateCreditAlongChain`** at `repos/metabob-activity-api/src/services/posterior-update.ts:386-392` — Phase 3 plugs in, does not rewrite.
- **`2026-05-30-info-gain-bonus-on-success`** — success-discount composed against by the refine loop.

## Risk

- **Pattern over-fitting.** A cluster of 5 noise-similar episodes triggers a useless drafter run. Mitigation: contrast examples are required for emission; clusters with no contrast are suppressed.
- **Verifier false-positive on coincidence.** Observed continuation matches the `consistency_set` by chance. Mitigation: Thompson posterior absorbs the false signal slowly; aggregate behaviour over a 7-day window is the transfer-test gate, not single-episode outcomes.
- **Refine loop divergence.** Repeated disagreement on the same pattern produces an unbounded variant explosion. Mitigation: refiner inherits the Phase 2 `max_composition_depth ≤ 16` invariant; refined candidates are still gated by `comprehensibility_check` and registration invariants.
- **Posterior treatment miscalibrated.** β=0.5 for guess-wrong and β=1.0 for action-no-effect mirrors the `2026-05-31-display-failure-mode-extensions` confidence-tier scaling; if that scaling shifts, this phase inherits the recalibration.

## Companion concepts

- `concept_uXRPTRZPCKFS` — observation feedback loops as the closure mechanism.
- `concept_rwfsb7WB5JXL` — failure-mode taxonomy; this phase populates the three `prediction_disagreement` sub-cases reserved by Phase 1.
- `concept__W9s8nA3YbDO` — comprehensibility floor that authored variants still must clear.
- `concept_Q3lwHwujiwkj` — verifier-routing-by-output-shape as the dynamic-behavioural-consistency analogue of static registration invariants.
- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern`; the refine-on-disagreement loop is its direct realisation.
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate`; the pattern detector's signature-stability discipline.

## Related openspecs

- `archive/2026-06-01-2026-06-01-obsidian-meta-skill-prototype/` — the umbrella proposal.
- `openspec/specs/obsidian-meta-skill-prototype/spec.md` — durable parent spec; this phase installs the Phase-3 verifier-refiner requirements and the transfer-test exit criteria as live capability.
- `2026-06-01-obsidian-observe-and-experiment/` — Phase 1 prerequisite.
- `2026-06-01-substrate-permissive-activity-authoring/` — Phase 2 prerequisite.
- `2026-05-31-display-failure-mode-extensions/` — posterior-treatment confidence-tier scaling this phase mirrors.
