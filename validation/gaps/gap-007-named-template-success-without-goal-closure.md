---
gap_id: gap-007
category: missing_idiom
severity: substantive
observed_first: 2026-05-24T17:16:52Z
last_observed: 2026-05-24T17:28:05Z
recurring_count: 1
bridge_path: composition_chain repair + goal-resolve verification step that consumes inner success signals
---

# Gap 007 — Named template invoked successfully but parent goal_resolve still marks failure

## Observation (post-embedding-fix, post-cache-fix)

Dev's commits stabilized two structural issues:
- `b129695` + `93cd621`: activity-api cache fix → registry stable at 18 templates (verified 3 sequential queries return 18)
- F-V58 / EMBEDDING_MODEL_DIR fix: `/health.checks.embedding.status` now reads `"healthy"` (was `"disabled"` across iterations 1-7)

These changes restored two preconditions for gap-004 closure (name-to-template binding via dense search). And indeed — **coverage-tick is now being invoked**:

| Time | Event | Status |
|---|---|---|
| 2026-05-24T17:16:52.173Z | `activity:⟨development-vessel:coverage-tick⟩` invoked | success |
| 2026-05-24T17:16:52.190Z | `activity:⟨development-vessel:coverage-tick⟩` invoked | success |
| 2026-05-24T17:16:52.497Z | `activity:⟨development-vessel:coverage-tick⟩` invoked | success |
| 2026-05-24T17:17:00.294Z | `_goal_resolve` completed (8s after coverage-tick) | **failure** |

The goal text: `"run the topology discovery chain: call coverage-tick, substrate-health-tick, and probe-reachable-unlearned to advance the coverage map"`

Same pattern persists 11 minutes later:
- 2026-05-24T17:28:05.175Z: `_goal_resolve` failure (with `failure_mode: null`)

## Attempted description (substrate-side only)

The substrate has the data:
- 3 successful coverage-tick invocations occurred at exactly 17:16:52Z (cluster)
- Each coverage-tick trace has `composition_chain: []` (empty array — not linked to a parent)
- A goal_resolve trace at 17:17:00Z, ~8 seconds later, marks status=failure
- The goal_resolve's goal_message names coverage-tick explicitly
- failure_mode field is null (gap-003 still active)

What the substrate CANNOT explain:
1. **Why goal_resolve marks failure when coverage-tick (named in the goal) successfully ran 8 seconds before its completion?**
2. **Why coverage-tick's composition_chain is empty?** If coverage-tick ran in response to the goal, it should be linked via composition_chain to the parent goal_resolve. Empty chain means it wasn't dispatched as the goal's child.

Two possible interpretations the substrate cannot distinguish:
- (A) coverage-tick ran independently (perhaps via slot-binding / improvise / some other path) and the goal_resolve verifier doesn't see the connection
- (B) coverage-tick ran as the goal's child but the composition_chain wasn't populated (a chain-propagation bug)

In either case, the substrate doesn't have the idiom to bridge **"a named template ran successfully somewhere in the system" → "the goal asking for that template's invocation was achieved"**.

## Knowledge used

### Substrate-side:
- All 4 traces (3 coverage-tick + 1 goal_resolve at 17:17Z) from /v2/activities/execution-traces
- Goal text content from metadata
- Composition chain field (empty on coverage-tick traces)
- Time-window comparison (8 second gap)

### Operator-side gaps:
- **`missing_idiom` (substantive)**: substrate has no "named-template-success-implies-goal-closure" idiom. The goal_resolve verifier checks something narrower than "did the named template succeed?" — likely either "did THIS execution's child chain include success of the named template" (broken because chain is empty) or "did the goal-text-match return non-null" (something deeper)
- **`missing_pattern`**: composition_chain empty on coverage-tick traces suggests chain-propagation is broken. The Phase 18.4 chain-credit propagation work was supposed to ensure ancestors get α/β. With empty chains, chain-credit cannot propagate.

## Verdict

`description_completed_within_substrate_knowledge: false`
`gap_severity: substantive`

The substrate now has the components (coverage-tick template, dense search, registry stability) but lacks the connecting idiom — the goal-resolve layer's verification step doesn't recognize success of named-template invocations.

This means **gap-004 is partially closed but gap-003 root cause remains open**: name-to-template binding works (coverage-tick IS being invoked), but goal-success-recognition doesn't connect.

## Coordination

- **dev**: Inspect goal_resolve verification logic. When a goal-text names a template and that template successfully ran during the goal_resolve's execution window, the goal_resolve should either mark success OR populate failure_mode with a specific classification (e.g., `verifier_negative` with context explaining why the named-template success was insufficient). Currently it marks failure silently.

- **dev**: Inspect composition_chain propagation for coverage-tick invocations. Empty chain means chain-credit can't propagate posteriors. Even if the goal_resolve is "correctly" marking failure, the inner coverage-tick success isn't being credited to the goal-processing-activity-driven template's posterior.

- **audit**: Please verify at runtime:
  1. Whether coverage-tick traces actually have composition_chain (this might be a query/serialization issue)
  2. Whether goal_resolve has access to the coverage-tick traces during its verification step
  3. Whether goal_resolve.verifyWithEvidence (per CLAUDE.md mention) is firing for these goals

- **my role**: continue narration. If gap-007 pattern recurs across the next 2-3 boredom firings with same structure (coverage-tick success + goal_resolve failure), that's a structural recurring finding worth elevating.
