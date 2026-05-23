## Why

Three sibling specs land the architectural primitives for an activity-driven impulse-binding loop:

- `2026-04-26-impulse-binding-selection-layer` — slot-binding lifecycle event, `impulse_pool_selection` and `producer_selection` resolvers, slot-binding meta-activity, workbench shape-slot primitive.
- `2026-04-26-shape-provider-goal-creation` — recursive shape provisioning via the `create-shape-provider-goal` activity, `endpoint_output_shapes` field on `goal_execution_paths`.
- `2026-04-26-validators-and-failure-modes` — validators-as-activities with `output_shapes: ["validation_result"]`, the `failure_mode` taxonomy, validator-dispatch meta-activity.

Together these primitives form **the impulse-activity loop**: a fully activity-driven path from goal dispatch through binding, execution, validation, and recursive escalation, with learning signals updating Thompson params at each step.

This change is the **integration spec**. It is drafted incrementally as the three sibling specs are implemented. Each implementation phase produces concrete evidence — a working canary trace, a learning-loop update, an end-to-end goal execution — that feeds back into this change's `design.md`.

## What Changes

This change introduces no new primitives. It:

- Defines the **success criteria** for the integrated loop (below).
- Drives **end-to-end validation against canary** (`activity.metabob.com`) at each implementation milestone.
- Tracks **learnings** that emerge during implementation — design refinements, contract clarifications, tooling gaps — that may seed an additional sibling for the canonical-composition synthesis (LLM-skill template pattern, tools-as-impulses convention, MiniBob self-registered lifecycle bootstrap).
- Captures **dogfood evidence**: goals dispatched, traces inspected, validators firing, learning parameters updating, all observable on the canary.

## Success criteria

The integrated impulse-activity loop is considered complete when, against canary:

1. **Goals regularly succeed and successes are verified correct** — measurable via `goal_verification` traces on `activity.metabob.com` showing `passed: true` with positive evidence.
2. **Failed goals attempt success by appending a new activity** — measurable via `failure_mode.type === "verifier_negative"` traces followed by `create-shape-provider-goal` dispatches that converge on success.
3. **MiniBob operates solely off connected-vessel resolvers** — production goals do not require any embedded template; embedded templates exist only as bootstrap.
4. **The impulse-activity system creates improved, specified, better-wired activities via the executor** — measurable via the ribosome pattern emitting new activity templates whose Thompson α/β converges above embedded-template baselines.
5. **Activities compose using all MiniBob features** — measurable via composition graphs that traverse pool selection, producer selection, validators, and shape-provider escalation in a single goal-resolution trace.
6. **Activity reuse rate trends upward and improvise-share trends downward** — measurable via the `activity-reuse-validation-harness` weekly report. The system getting better at finding the right activity is the empirical signature of topology learning. Phase 18 makes this property observable.
7. **Lift — the substrate sustains its own topology-discovery loop without external developer input.** Operationalised as foundation §33's **Convergence**: three consecutive `convergenceReport` impulses (Phase 27, derived from the topology-discovery-loop spec) showing strict monotonic decrease in the Reachable+Unlearned and Unknown cells, and strict monotonic increase in Reachable+Learned, all driven by non-human triggers. This is the integrated loop's terminal success criterion. Criteria 1–6 describe a system that works; criterion 7 describes a system that works on itself.

## Lift and hand-over

Criterion 7 above is not a stretch goal — it is the **explicit hand-over condition** for this entire integration spec. When `lift_candidate=true` holds for three consecutive `convergenceReport` impulses produced from natural substrate activity (no human in the trigger path), human-driven development of the substrate is intended to step back. Subsequent topology refinement is performed by the substrate itself: the six topology-discovery activities measure their own state, the observer fires probes against measured gaps, ribosome extracts learned templates, and Thompson posteriors update. The IAL is finished when this hand-over actually happens; until then, the IAL remains an open project.

Phase 27 below formalises the hand-over condition and the **pre-lift readiness checklist** — the explicit set of substrate properties that must already be in place so that the post-lift substrate has everything it needs to continue without human intervention. The checklist is not aspirational; each item maps to a concrete sub-spec or a measurable canary observation.

## Topology creation as a core property

The system's topology — the activity graph, its composition edges, and the edge weights — is created and refined entirely through the loop this change orchestrates. Every successful execution adds to a Thompson posterior; every successful improvise extracts a new activity node via ribosome; every composition chain registers an edge with a learned success rate. There is no separate authoring path that produces topology — topology *is* the residue of the learning loop.

This means the loop's quality determines the topology's quality. If posterior updates are noisy (binary on failure regardless of cause), if credit assignment terminates at the leaf (orchestrator activities never accumulate evidence), or if retrieval signals are too thin (only name+description BM25), the topology that emerges is impoverished — even when the rest of the system is correct. Phase 18 closes these gaps so the topology that the loop creates is rich enough to learn from.

## Capabilities

### New Capabilities

- `impulse-activity-loop-validation` — end-to-end validation procedure executed against canary at each phase, with documented expected traces and acceptance criteria.
- `impulse-activity-loop-design-evolution` — a `design.md` that grows incrementally as implementation reveals refinements; learnings archived back into individual sibling specs as appropriate.
- `activity-api-connection-pooling` (added 2026-05-01) — per-process LRU of authenticated SurrealDB sessions in metabob-activity-api, surfaced from Phase 8 validation runs that exposed the connect/auth handshake-per-query as the throughput bottleneck blocking goal completion. See Phase 12 in `design.md` and `specs/activity-api-connection-pooling/spec.md`.
- `tags-fts-index` (added 2026-05-06) — third FTS index on `activity.tags`, weighted between `name` and `description`. Bridges hierarchical-classifier intent (`bugfix.auth.tokens`) that BM25-on-name and dense embeddings both miss. Phase 18.
- `failure-mode-stratified-updates` (added 2026-05-06) — replace the binary β increment on failure with a structured update keyed on `failure_mode.type`. Wires the existing taxonomy into the posterior-update path. Phase 18.
- `composition-chain-credit-propagation` (added 2026-05-06) — γ-discounted backward propagation of α/β updates through `composition_chain` ancestors. Closes the credit-assignment gap that today only credits the leaf activity for a multi-step success. Phase 18.
- `activity-reuse-validation-harness` (added 2026-05-06) — versioned 20-prompt benchmark suite measuring MRR, reuse rate, improvise-share, and Thompson CI widths over time. Replaces ad-hoc validation runs with a longitudinal report. Phase 18.
- `recommendation-validation-v2` (added 2026-05-06) — two-metric harness split (search-MRR vs recommend-MRR), behavioral health signals (improvise health, resolver coverage, reuse trajectory, recommendation executability), corrected benchmark anchored to the Thompson pool rather than the double-prefix wrapped namespace, composition-chain credit integration test (18.4.7), and weekly CI workflow. Addresses the measurement gap where Phase 18's harness conflated retrieval quality with Thompson ranking and had no visibility into whether the system was improvising correctly, providing resolvers as tools, or accumulating topology. Full spec: `openspec/changes/2026-05-06-recommendation-validation-v2/`. Phase 19.
- `shape-dispatch-agreement-check` (added 2026-05-17) — per-vessel static check (build-time) plus runtime probe (startup) that enforces TYPESCRIPT_VESSEL_TEMPLATE.md Invariant 2: every entry in `config.discovery.shapes` has a matching `case '<shape>':` in `src/routes/impulses.ts`, and every dispatch case is either advertised or annotated `// @shape-dispatch:private`. Surfaces orphan handlers and unhandled advertised shapes with file:line diagnostics; on divergence the vessel refuses to register the broken shapes and emits a `verifier_negative` self-trace so vessel-side divergence stops manifesting as Thompson β drift on the caller. Applied to activity-api, concept-db, discovery-vessel, identity-vessel, and the ias-executor-ts forge-template path. Full spec: `openspec/changes/2026-05-17-shape-dispatch-agreement/`. Phase 23.
- `state-space-signature` + `conditional-thompson-keying` (added 2026-05-17) — versioned, deterministic hash over `(sorted shape multiset, sorted (shape, producedBy?) tuples, sorted missing-shape set, signature_version)`; recommend handler reads `context_thompson_scores` keyed by `(template_id, signature)` with a sampling-floor fallback to `variant_performance_metrics`; write path emits α/β to both rows. Makes Thompson posteriors context-conditional rather than aggregated across heterogeneous binding contexts, and corrects the Phase 18.4 chain-credit wiring so each ancestor's update uses the **ancestor's** state-space signature at its own binding time (not the leaf's). Substrate already exists (`computeContextBucket` at `repos/metabob-activity-api/src/utils/session-context.ts:115-129`; `context_thompson_scores` write path at `posterior-update.ts:220-286`) but is dormant — the read path never queries it. Full spec: `openspec/changes/2026-05-17-state-space-signature-thompson-keying/`. Phase 24.
- `stratified-goal-generator-harness` (added 2026-05-17) — stratified goal generator (`validation/scripts/goal-generator.ts`) keyed on shape-signature novelty, decomposition depth, topology-gap band (Scenarios A/B/C/D from Phase 22), and adversarial-perturbation seed; coverage matrix across difficulty bands; reuse efficiency weighted by cost; optimality-gap tracking; per-prompt refinement-event detection; decision-record completeness; multi-witness disagreement for false-positive resistance. Additive to Phase 19 — the curated v2 benchmark continues to run; the new harness runs alongside on **generated** prompts and emits a separate report stream so the topology-universality claim can be measured rather than inferred from a fixed prompt set. Scenario D coverage is gated on Phase 22 forge completion. Full spec: `openspec/changes/2026-05-17-stratified-goal-generator-harness/`. Phase 25.
- `chain-credit-ancestor-signature-fix` (added 2026-05-18) — preventive hotfix in `propagateCreditAlongChain` (`repos/metabob-activity-api/src/lib/posterior-update.ts:303-371`): replace the single leaf `context_bucket` destructured at line 308 and passed to every ancestor at line 369 with a per-ancestor recomputation via the existing `computeContextBucket`. The bug is currently dormant because `applyOutcomeToPosteriors` hardcodes `context_bucket: null` at `posterior-update.ts:464`; ships ahead of state-space-signature activating the conditional-write path so the larger spec lands on a correct substrate. Lives under the v0 `computeContextBucket` API and is cleanly subsumed when v1 signature lands. Full spec: `openspec/changes/2026-05-18-chain-credit-ancestor-signature-fix/`. Phase 24.
- `shape-dispatch-divergence-cleanup` (added 2026-05-18) — small cleanup landing alongside the shape-dispatch lint: identity-vessel trim of unused `apiKey`/`jwtToken` advertised shapes (zero external callers — every caller uses `shape: "authentication"`); `shape-dispatch.config.json` mapping `authentication → [apiKey, session]` at the identity-vessel root; concept-db `tests/write-shapes.test.ts:585` assertion inversion to match the already-cleaned `config.ts`. Activity-api orphans and concept-db `conceptUpkeepAuditLog` are already resolved in-tree as of the 2026-05-18 re-audit (410-Gone stubs with `// @shape-dispatch:private` annotations at `src/routes/impulses.ts:1415, 1434`; `conceptUpkeepAuditLog` removed from `concept-db/src/config.ts:203-206`). Full spec: `openspec/changes/2026-05-18-shape-dispatch-divergence-cleanup/`. Phase 23.

## Impact

This change orchestrates the three sibling specs but introduces no source-code changes of its own. All concrete edits live in the sibling specs. Canary deployments and validation runs are coordinated here.

## Dependencies

- `2026-04-26-impulse-binding-selection-layer`
- `2026-04-26-shape-provider-goal-creation`
- `2026-04-26-validators-and-failure-modes`

A potential additional sibling — `canonical-goal-resolution-composition` — may emerge from learnings during implementation. It is currently out of scope; flagged in `design.md` as a probable next change.
