# Proposal: Goal Verification Wiring

**Change ID**: `2026-04-29-goal-verification-wiring`
**Status**: Draft
**Date**: 2026-04-29

---

## Problem Statement

Goal satisfaction checking has a false-positive problem that corrupts the Thompson Sampling signal. The concrete symptom: a goal "explain impulse.ts" was marked **100% complete** because *Hello World Minimal* ran and produced a `documentation` shape, even though it merely wrote a trivial test file with no substantive content about impulse.ts.

Four independent failure modes compound each other:

### FM-1: `verifyWithEvidence` ignores `goalEnrichment`

`GoalVerificationResolver.verifyWithEvidence()` (line ~814 in `goal-verification-resolver.ts`) receives `goalEnrichment` as a parameter but never reads it. The function signature is:

```typescript
private verifyWithEvidence(
  goal: string,
  goalEnrichment: GoalEnrichment | undefined,
  executionFacts: ExecutionFacts,
): GoalVerificationResult
```

The function body ignores `goalEnrichment` entirely and falls through to a pure file/tool-count heuristic. `GoalEnrichment` carries `requiredCapabilities`, `category`, and `successCriteria` — all of which could gate false positives:
- A goal enriched with `requiredCapabilities: ["read file", "write explanation"]` should fail if the execution only used `bash` or wrote a hello-world file.
- A goal with `category: "mutation"` should fail if no files were modified.
- `successCriteria` strings are never checked against output content.

### FM-2: `GoalCompletionBar` checks declared template types, not trace reality

`calculateShapePresence()` in `GoalCompletionBar.tsx` iterates `activity.template.output_shapes` (the template's *declared* output shape types) to determine completion:

```typescript
for (const activity of activities) {
  for (const shape of activity.template.output_shapes || []) {
    producedShapes.add(shape);
  }
}
```

This means any activity that *declares* it can produce `documentation` marks that shape as present — regardless of whether it actually produced one in the current execution, or whether the content is substantive. An activity with `output_shapes: ["documentation"]` that writes a one-line stub is counted as satisfying a "write detailed documentation" goal.

The `expectedShapes` fed to `GoalCompletionBar` come from `inferExpectedShapes(goalText)` in `goal-inference.ts`, which uses keyword matching on the goal string. "explain impulse.ts" matches the `explain` keyword and infers `documentation`. The bar then shows 100% because `Hello World Minimal` declares `documentation` in its template.

### FM-3: Loop detector fires "productive" for semantic stagnation

`detectCycles()` in `state-space.ts` classifies any accumulated shape-set growth as "productive":

```typescript
if (
  current.shapes.size > earlier.shapes.size &&
  earlierArr.every((s) => current.shapes.has(s))
) {
  return { hasCycle: true, cycleType: 'productive', ... };
}
```

The comment in the code notes: "any activity that produces at least one new shape will make the current snapshot a strict superset of the initial one — triggering a 'productive' cycle detection. This is intentional." But this creates a false sense of progress: if the same irrelevant template runs 5 times in a row, each adding one shape that is unrelated to the goal, the detector continues reporting "productive" and never raises a stagnation signal. There is no check for whether the template is different from the previous one, nor whether the newly-added shapes advance the goal's required shapes.

### FM-4: Decision chain invisible in UI

The goal-processing tasks `enrich_goal`, `recommend_activity`, and `select_variant` in `goal-processing-activity-driven.json` do each declare `outputShapes`:
- `enrich_goal`: `outputShapes: ["goal_enrichment"]`
- `recommend_activity`: `outputShapes: ["activity_recommendations"]`
- `select_variant`: `outputShapes: ["variant_selection_result"]`

However, the `GoalCompletionBar` and the trajectory `computeAvailableShapes` state-space only count shapes from activities **in the current trajectory canvas**, not from meta-activities that execute behind the scenes. When `goal-processing-activity-driven` runs as the dispatch container, its intermediate shapes (`goal_enrichment`, `activity_recommendations`, `variant_selection_result`) are invisible to the trajectory canvas because the trajectory does not include the goal-processing activity as a visible authored node.

The deeper issue: `TrajectoryEditorPage` computes `availableShapes` as `activities.flatMap(a => a.template.output_shapes || [])` (line ~233), where `activities` is the user-authored trajectory list. Goal-processing shapes produced in the background execution are not in this list. This means the decision chain — enrichment verdict, recommendation scores, variant selected — is opaque even in live mode. A user cannot see why a particular activity was chosen.

---

## Scope

This change covers five wiring fixes:

1. **`verifyWithEvidence` enrichment gate** — use `goalEnrichment` fields as deterministic gates in the evidence-based verifier (FM-1).
2. **`GoalCompletionBar` trace reality** — check actual produced impulse content presence (via `impulseContentMap` or `taskImpulseIds`) rather than template declarations (FM-2).
3. **Stagnation detection** — detect same-template-repeated or same-shape-stagnation patterns, separate from the existing cycle detector (FM-3).
4. **Human verdict wire** — connect `ShapeProvenanceTree` ↑/↓ buttons to a store field that can override automated `goal_verification` verdict; make the decision chain visible in the trajectory canvas (FM-4).
5. **Oracle corpus** — define how labeled `(goal, execution, verdict)` triples get stored for future calibration (addresses corrupted Thompson signal from FM-1/FM-2).

**Out of scope**:
- Changing the Thompson Sampling algorithm itself.
- Adding LLM calls to the evidence-based verification path.
- Rewriting `goal-processing-activity-driven.json` task flow.
- Any auth or security changes.

---

## Success Criteria

1. A goal "explain impulse.ts" followed by an activity that writes a hello-world test file with `output_shapes: ["documentation"]` no longer results in `achieved: true` from `verifyWithEvidence`.
2. `GoalCompletionBar` shows 0% completion when no execution has run (compose mode, no trace loaded), even if template declarations cover the expected shapes.
3. A trajectory where the same template appears 3+ consecutive times with no goal-shape advancement triggers a stagnation indicator in the UI.
4. Clicking ↑ or ↓ on an activity in `ShapeProvenanceTree` writes to `trajectoryStore` and can override the automated verification badge shown in the trajectory header.
5. A new `goal_verification_label` impulse shape is defined and writable via `POST /v2/impulses/resolve`, allowing labeled oracle examples to be stored.
6. All existing unit tests for `detectCycles`, `calculateShapePresence`, and `GoalVerificationResolver` pass (no regression).
