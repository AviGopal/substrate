# Phase 2 — Substrate permissive activity authoring (the meta-skill)

## Why

Phase 1 produced an observation substrate but no new activities. The substrate's only authoring template today is `draft-gap-closing-activity` — a substitution engine keyed on operator-curated scenario JSON. Phase 2 ships the actual meta-skill: an LLM-backed general drafter that takes a `recurringPatternCluster` (hand-built at this phase, auto-detected in Phase 3), the resolver vocabulary, the activity vocabulary, and the Phase 1 `actionEffectModel` catalogue, and authors an arbitrary-structure activity with declared shapes, citations, and composition rationales. The permissive scope demands a different validation regime — registration-time invariants for unsatisfiable inputs / circular composition / depth, plus a comprehensibility check ensuring the authored template remains readable.

## What changes

- Ship `draft-activity-from-pattern` as the new general drafter (iterative two-step prompt: prune vocabulary, then draft against pruned set). Emits `authoredActivityCandidate` impulses carrying declared shapes, provenance, citations, and per-compose-task rationales.
- Ship `comprehensibility_check` resolver as a sibling of `convergent_validity_check` from iter-088. Reads a template body without its self-description, asks a second-provider LLM to explain it, computes a 0..1 score, refuses promotion below the configured floor (default 0.6).
- Install permissive-scope registration-time invariants in the template registration path: (a) every declared `inputShape` has at least one known producer or is marked `seedable`, (b) every compose-dispatch reference resolves to an existing activity, (c) `max_composition_depth ≤ 16` (extends the parent-execution depth-16 guard), (d) every compose-dispatch task carries a `composition_rationale`, (e) `authored_from_pattern.pattern_id` resolves.
- Encode the comprehensibility discipline as hard requirements inside the drafter prompt with worked examples: self-describing names, substantive descriptions, citations to substrate concept ids, explicit composition rationales (essential / replaceable / accidental), provenance markers (`authored_from_pattern`).
- Periodic re-check: every 7 days, `comprehensibility_check` re-runs against each authored template using a different model provider when available.

## Out of scope

- Auto-detection of which pattern clusters to author for — Phase 3 ships `detect-recurring-pattern`. Phase 2 accepts a hand-built `recurringPatternCluster` as input.
- Verifier routing by authored-activity type — Phase 3 (`predict-and-verify`).
- Closed-loop refinement on disagreement traces — Phase 3 (`refine-on-disagreement`).
- Replacement of `draft-gap-closing-activity` — the scenario-driven analytical drafter stays; this phase adds an orthogonal general drafter.

## Dependencies

- **Phase 1** (`2026-06-01-obsidian-observe-and-experiment`) — Phase 2 reads `actionEffectModel` and the Layer-0/1 shape registrations as drafter inputs.
- **Existing `convergent_validity_check` resolver (iter-088)** — `comprehensibility_check` shares its pre-runtime LLM-verification scaffolding.
- **`2026-05-30-trace-to-concept-mining`** — supplies the contrast-example read path the drafter draws from.
- **Existing template registration path** in `repos/metabob-activity-api/src/routes/activities.ts` — Phase 2 extends, does not rewrite.

## Risk

- **Permissive scope ↔ infinite-loop compositions.** Mitigation: `max_composition_depth` budget enforced at registration time and propagated through `ExecuteOptions` at runtime.
- **Unsatisfiable `inputShapes` on authored templates.** Mitigation: producer-or-seedable check at registration; rejection emits `verifier_negative.activity_registration_invariant`.
- **Compose references to non-existent activities.** Mitigation: existence check at registration.
- **Drafter context-budget overrun** with full resolver + activity vocabulary. Mitigation: iterative pruning step before the draft step; `markdown_split_sections` exists and is used.
- **Model-specific bait** — an authored template that one LLM reads correctly but another misreads. Mitigation: comprehensibility re-checks rotate model providers.
- **Self-describing-name regex too restrictive.** Mitigation: regex rejects only single-character and unprintable names; longer descriptive names pass freely.

## Companion concepts

- `concept_uXRPTRZPCKFS` — instrumented observation grounds the drafter's contrast-example construction.
- `concept_rwfsb7WB5JXL` — failure-mode taxonomy; `verifier_negative.authoring_discipline_violation` and `verifier_negative.comprehensibility_below_floor` are added sub-cases here.
- `concept__W9s8nA3YbDO` — comprehensibility-as-load-bearing for substrate maintenance under LLM-mediated reading.
- `concept_Q3lwHwujiwkj` — registration-time invariants as a permissive-scope safety net.
- `concept_RYl73llSCGfc` + `concept_6RwK5H5F28hT` — `service_oom_cascade_scan` exemplar of the citation form the drafter is trained to emit.

## Related openspecs

- `archive/2026-06-01-2026-06-01-obsidian-meta-skill-prototype/` — the umbrella proposal.
- `openspec/specs/obsidian-meta-skill-prototype/spec.md` — the durable parent spec; this phase installs the drafter / discipline / registration-invariant requirements as live capability.
- `2026-06-01-obsidian-observe-and-experiment/` — Phase 1 prerequisite.
- `2026-06-01-closed-loop-learning-and-verification/` — Phase 3 consumer of the drafter.
- iter-088 `convergent_validity_check` resolver — direct sibling pattern for `comprehensibility_check`.
