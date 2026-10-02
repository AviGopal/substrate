# Goal→target-shape inference seeds the walk (capability-matched selection)

**Date:** 2026-06-25
**Vessel:** goal-host-vessel (the shape-graph walk)
**Stage:** SPEC (root-caused live — see evidence)
**Lever:** 4 (emergent keystone). Surfaced by the end-to-end demonstration after levers 1-3 landed. This is what makes a natural-language goal actually route to the genuine producers levers 1-2 build.

## Problem (root-caused live 2026-06-25)

A natural-language goal dispatched through `/run-goal` (the MCP / boredom / agent surface) with only `{ goal }` selects an **irrelevant high-Thompson-score template** and fails hollow. Live evidence:

- Goal "examine discovery-vessel/src/index.ts, find top-3 code-quality risks" → walk selected `learned-auto-bridge-obsidian-write-note` (an internal-tick obsidian bridge with high α) → failed. The genuine producer (`auto-bridge-problem_detection`, built by levers 1-2) was never selected. Forcing it via `targetTemplateId` DID select it and it produced 3 real risks — so the producer works; **selection routing is the gap.**

**Root cause** (`repos/goal-host-vessel/src/index.ts`):
- The walk's target set is `const target = new Set(opts.expectedOutputShapes ?? [])` (L901). `expectedOutputShapes` is populated ONLY from `body.expected_output_shapes` (L2586). A natural-language goal provides none → `target.size === 0`.
- With `target.size === 0` the walk runs in **opportunistic "no-target" mode** (L902-904 comment: "With NO target, never short-circuit … walk opportunistically (progress-driven)"). It picks the highest-scoring *feasible* producer each step. With no target shape, **`advancesTarget` / scaffold-exclusion / capability-matching have nothing to anchor to** — so the rich internal-tick bridges (obsidian-write, etc.) win on raw Thompson score, irrespective of goal relevance.

This is why: (a) levers 1-2's genuine producers exist but are not selected on real goals; (b) lever 3's reputation penalty is inert — without per-goal target competition there is no gamed-signature contest to damp; (c) measured mesh coverage stays ~0.286 and the "working set is internal ticks" (operator finding 2026-06-22). The walk is a shape-graph backward-chainer **with no entry point into the lattice** for free-text goals.

## Key insight: the mechanism already exists

`verifyGoalReached(goal, producedShapes, …)` (L518) is an LLM judge that, given the goal, already infers `completion_shapes` — the shapes characterising goal completion. It runs *after* execution as the reach-gate. **Move that inference to the FRONT of the walk** to seed `expectedOutputShapes` when the caller gave none. The reach-gate's post-hoc shape inference becomes the walk's goal→target-shape **router**. Same model, same vessel, one extra call at entry (cached per goal_hash).

## Change (DEV scope, goal-host-vessel)

1. **New `inferGoalTargetShapes(goal, knownShapes)`** (goal-host-vessel): an LLM call (reuse the `LLM_VESSEL_ENDPOINT` / haiku pattern of `verifyGoalReached`) that returns the 1-3 output impulse shapes whose production would satisfy the goal. CONSTRAIN the model to the **known producible-shape vocabulary** (fetch the producible shapes from activity-api `discover-by-shapes` / the template registry's output_shapes union, passed in the prompt) so it returns REAL backward-chainable shapes, not hallucinated ones. Deterministic-ish: cache by `goal_hash` (the same hash used for `goal_execution_paths`) to avoid repeat calls across retries/re-dispatches.
2. **Seed the walk** in BOTH dispatch surfaces (async `/run-goal` ~L2586 and sync `/resolve` ~L1495/1525): when `expectedOutputShapes` is empty AND no `targetTemplateId`, call `inferGoalTargetShapes`, and pass the result as `expectedOutputShapes` into the walk. An explicit `expected_output_shapes` or `targetTemplateId` from the caller always wins (no override).
3. **Guards:** if inference fails / returns nothing / LLM down → fall back to the CURRENT opportunistic behavior (don't regress; the walk still runs, just untargeted). Log `{goal_hash, inferred_target_shapes}` so routing is observable.
4. Constrain inferred targets to shapes that have at least one producer OR a live resolver (so the walk can actually reach them — and where it can't, the existing leaf→authoring escalation (L553+) files a scope-narrowed capability gap, which is the *correct* behavior: a goal needing an unbuilt shape now DEMANDS that producer via gap_to_feature → author_producer, lever 2).

## Why this is the keystone (answers the operator's design questions)

- **How the system chooses what to do:** backward-chain from *inferred goal-target shapes* instead of opportunistically running the highest-scoring tick. Selection becomes goal-directed.
- **Exploring the shape lattice:** the inferred target shape is the lattice **entry point**; the walk explores backward-producer edges from it. Goals become the demand signal that drives lattice traversal (and, via leaf→authoring escalation, lattice *expansion* exactly where goals need it).
- **Avoiding bad approaches as much as learning good ones:** a target re-enables `notScaffold` + `advancesTarget` + the `isHollowScaffold` exclusion (L967-1153) — the walk can now *reject* the irrelevant obsidian bridge because it doesn't advance the target. Without a target those guards are dead code. This is the structural complement to lever 3 (damp gamed signatures) and the reach-gate (reject hollow post-hoc): lever 4 prevents the bad approach from being *selected at all*.
- **Orthogonal reuse (future activities/vessels/resolvers):** the same goal→shape inference is what lets the substrate, when given "make X better," map X to the shape family it touches and backward-chain the relevant producers/validators — the routing primitive generalizes from running activities to improving them.

## Out of scope

- Replacing the opportunistic mode entirely (keep it as the no-inference fallback).
- Reach-gate strictness calibration (separate concern; tracked as the demonstration's secondary finding — the gate held a substantive 3-risk analysis HOLLOW for missing line numbers).
- A deterministic (non-LLM) goal→shape classifier (could come later via the embedding recommender; LLM inference is the cheap correct interim and reuses the existing reach-verifier pattern).

## Verification

- `bun run lint` (tsc + shape-dispatch) + `bun test` green incl. a unit test for `inferGoalTargetShapes` (mock the LLM endpoint; assert it returns constrained known shapes and caches by goal_hash; assert empty/failed inference → no targets, opportunistic fallback).
- **Live (the demonstration):** re-dispatch "examine repos/discovery-vessel/src/index.ts and find the top 3 code-quality risks" with ONLY `{goal}`. Assert the walk log shows `inferred_target_shapes` ⊇ {problem_detection or code_quality}, and the walk **selects `auto-bridge-problem_detection` (or another genuine analysis producer), NOT obsidian-write**. Reaching vs HOLLOW then depends on producer richness / reach-gate calibration (secondary), but the ROUTING must now be capability-matched.
- Regression: a dispatch WITH explicit `targetTemplateId` or `expected_output_shapes` is unchanged.

## Risk

Low-moderate. One extra LLM call per fresh goal (cached by goal_hash; haiku; ~1s). Fails open to current behavior. The only behavior change is that untargeted natural-language goals become goal-directed — which is the intent. Deploy: goal-host runs from source; `docker cp` + `systemctl restart goal-host-vessel`.
