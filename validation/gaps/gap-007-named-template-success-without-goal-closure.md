---
gap_id: gap-007
category: missing_idiom
severity: substantive
observed_first: 2026-05-24T17:16:52Z
last_observed: 2026-05-24T19:56:50Z
recurring_count: 6
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

## Iteration 10 UPDATE (2026-05-24T20:20Z)

### Pattern recurs on substrate-health-tick

Same gap-007 pattern observed on the second named template:
- 2026-05-24T19:56:50Z: 3× substrate-health-tick invoked, all **success**
- 2026-05-24T19:56:59Z (9 seconds later): goal_resolve **failure**, failure_mode=null
- composition_chain empty on substrate-health-tick traces (same as coverage-tick)

Two named templates now exhibit the same broken-recognition pattern. Both succeed; both fail to close their parent goal_resolve. Total observed: 6 successful named-template invocations across 2 templates, 0 goal closures.

### Auditor F-037 cross-corroboration

Auditor's iter-010 (2026-05-24T17:24Z) independently identified what they call **F-037: Thompson posteriors disconnect from execution outcomes**:

> coverage-tick now reports 68 executions / 60 successful — but `success_rate=0` and `thompson_alpha=beta=1` (uniform prior, unchanged). Data is flowing in but posteriors aren't moving.

This is the SAME structural finding at a different observation layer. The disconnect manifests as:

| Symptom | Where observed | Finding |
|---|---|---|
| goal_resolve marks failure despite named-template success | trace-level | gap-007 (my finding) |
| composition_chain empty on named templates | trace-level | gap-007 (my finding) |
| Thompson posteriors don't update from successful executions | metrics-level | auditor F-037 |
| 68 executions / 60 successful → `success_rate=0` | metrics-level | auditor F-037 |

**One root cause, three symptoms.** The substrate has the components (template registry stable, embedding healthy, named templates being invoked) but the SIGNAL PROPAGATION from execution-outcome → posterior-update → goal-closure is broken across the entire chain.

### Why this matters for lift

Per IAL §27.S.4a: `coverageReport.coverage_progress=true` for 3 consecutive emissions. The coverage progresses only if:
1. coverage-tick invocations succeed → produces coverageReport (works now)
2. Thompson posteriors track which goals are advancing topology (broken per F-037)
3. coverage_progress boolean reflects monotonic cell-count advance (cells still [0,0,0,0])

The substrate is running but the learning machinery is dead-on-arrival. Without posterior updates, the substrate's selection mechanism cannot prefer the templates that DO produce useful work. Boredom timer continues to fire identical goals because Thompson hasn't learned that these particular templates' success is meaningful.

### Updated severity and bridge

**Severity remains substantive but elevated in scope** — this is now a 2-symptom pattern (gap-007 + F-037) representing a single load-bearing structural disconnect. Will become BLOCKING for §27.S.4a if not resolved.

**Bridge path**:
1. Repair composition_chain propagation on named-template invocations
2. Repair goal_resolve verification step to consume inner-success signals
3. Repair Thompson posterior update path (per F-037: `success_rate=0` with 60/68 success is structurally impossible if updates are landing)

Any one of these three is a single-component fix. All three failing together suggests a deeper integration issue between activity-api's trace ingestion and the posterior/chain/verification pipeline.
