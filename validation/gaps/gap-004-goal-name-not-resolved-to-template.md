---
gap_id: gap-004
category: missing_idiom
severity: substantive
observed_first: 2026-05-24T03:40:59Z
last_observed: 2026-05-24T03:41:21Z
recurring_count: 3
bridge_path: ribosome (substrate to learn "goal text containing template name → invoke that template") + concept-extraction (template-name→template-id mapping)
---

# Gap 004 — Goal naming a template doesn't trigger that template; substrate cannot self-describe the fallthrough

## Observation

Two consecutive goal_resolve traces (03:40:59Z, 03:41:21Z) named specific templates explicitly in their goal text:
- `"run coverage-tick to measure topology coverage and emit a coverageReport"`
- `"run the topology discovery chain: call coverage-tick, substrate-health-tick, and probe-reachable-unlearned to advance the coverage map"`

These templates EXIST in the registry — confirmed by querying `/v2/activities/templates`:
- `activity:⟨development-vessel:coverage-tick⟩`
- `activity:⟨development-vessel:substrate-health-tick⟩`
- `activity:⟨development-vessel:probe-reachable-unlearned⟩`

But in the 50-trace window covering both executions, **NONE of these templates appear in the executed activities**. What ran instead:

```
_goal_resolve:                  2 (both FAILED)
goal-processing-activity-driven: 3 (all success — the goal pipeline)
improvise:                       3 (all success — fallthrough path)
slot-binding:                    9 (all success — binding attempts)
validator-dispatch:             21 (all success)
ribosome-extract:                9 (all success — lifecycle hook)
startup:health-check:            3 (background)
```

The pattern across both executions:
1. goal-processing-activity-driven receives the goal
2. slot-binding attempts to bind to the named template
3. Binding fails (the named template isn't selected by the recommendation tier)
4. Substrate falls through to `improvise`
5. improvise succeeds (it always succeeds — it generates *something*)
6. ribosome-extract fires as lifecycle hook on the successful improvise
7. goal_resolve sees the goal-as-stated wasn't achieved → marks status=failure
8. **No failure_mode populated** (gap-003)

## Attempted description (substrate-side only)

The substrate has the data:
- Goal text contained "coverage-tick" as a literal substring
- A template with id ending in "coverage-tick" exists
- The recommendation/binding tier didn't connect the two
- Substrate fell through to improvise

What the substrate CANNOT explain from its own knowledge:
- Why "goal text mentions X" didn't translate to "run template X"
- Whether this is intended behavior or a regression
- Whether the embedding.status="disabled" (observed in the activity-api `/health` response) is causally related

This is a STRUCTURAL gap: the substrate has the pieces (template registered; goal text contains template name) but no idiom for "literal name match → recommend" as a recommendation path. The recommendation system uses Thompson posteriors over `(template_id, signature)` — but with no historical traces of coverage-tick succeeding, the posteriors are uniform (or absent), and dense semantic search is disabled (`embedding.status: disabled` in this substrate; F-V58 fix in 1.20.9 but local image apparently doesn't have the model bundled).

## Knowledge used

### Substrate-side:
- Trace breakdown by template (from /v2/activities/execution-traces)
- Template registry contents (from /v2/activities/templates)
- Goal text content (from trace metadata.goal_message)
- activity-api /health output (embedding.status: disabled)

### Operator-side gaps:
- **`missing_idiom` (substantive)**: substrate has no "literal-name-match recommendation" idiom. The CORE_IDIOMS.md doc lists Thompson selection on (key, problem-class), but doesn't enumerate "literal name match" as a recommendation tier. Without dense semantic search active OR a literal-name fallback, the substrate cannot bridge goal-text→template-id when the template is new (Thompson posteriors absent)
- **`claim_incorrect` (substantive)**: `embedding.status: disabled` on this local substrate (F-V58 was supposed to be fixed in 1.20.9 per CLAUDE.md, but local image embedding.status shows disabled). The dense-search path that Phase 18.5 enabled is non-functional in this substrate.

## Verdict

`description_completed_within_substrate_knowledge: false`
`gap_severity: substantive`

This is the substrate failing to compose a basic capability (goal → named-template-invocation) that the operator implicitly assumed worked.

## Coordination

- **dev**: 
  1. The boredom-fired goals are not invoking the named templates. Goal "run coverage-tick" runs goal-processing-activity-driven + improvise instead.
  2. embedding.status="disabled" in this local substrate (despite CLAUDE.md claiming 1.20.9 fixed F-V58). Either the local image lacks the model directory, OR a different env config issue.
  3. Without dense search, AND with new templates having no Thompson posteriors, the recommendation tier has no signal to find coverage-tick from the goal text.

- **audit**:
  1. Confirm `embedding.status="disabled"` is observed at runtime by querying activity-api `/health` inside the container.
  2. Confirm whether the `EMBEDDING_MODEL_DIR` env or the bundled model files exist in the substrate container's activity-api workspace.
  3. Confirm whether Thompson posteriors exist for coverage-tick, substrate-health-tick, probe-reachable-unlearned (likely empty since no prior successful executions).

- **my role**: this pattern recurs every boredom firing. Will watch for whether dev's fixes (or substrate improvisation eventually producing successful coverage-tick executions and seeding posteriors) close the gap.
