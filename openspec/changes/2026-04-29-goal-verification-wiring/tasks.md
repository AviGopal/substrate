# Tasks: Goal Verification Wiring

**Change ID**: `2026-04-29-goal-verification-wiring`

Tasks are ordered by dependency. Items within a numbered group can be done in parallel.

---

## Group 1: Minibob — `verifyWithEvidence` enrichment gate (D1)

### T1.1 — Resolve open question: `GoalEnrichment.requiredCapabilities` vocabulary

Before implementing the capability gate, audit what the `enrich_goal` LLM task actually returns in `requiredCapabilities`. Sample 5–10 real `goal_enrichment` impulses from canary traces (query `POST /v2/impulses/resolve` with `type: activityExecutionTrace`) and record the vocabulary used. If the vocabulary is too loose for deterministic matching, document this in design.md §D6 Q3 before proceeding to T1.2.

**File**: `openspec/changes/2026-04-29-goal-verification-wiring/design.md`
**Acceptance**: Q3 in §D6 updated with findings (vocabulary is usable OR not usable with reason).

---

### T1.2 — Add capability normalization lookup table

In `repos/minibob/src/resolvers/goal-verification-resolver.ts`, add a private static map `CAPABILITY_TO_TOOLS`:

```typescript
private static readonly CAPABILITY_TO_TOOLS: Record<string, string[]> = {
  'read': ['read', 'bash', 'file'],
  'read file': ['read', 'bash', 'file'],
  'write': ['write', 'edit', 'file'],
  'write file': ['write', 'edit', 'file'],
  'write explanation': ['write', 'edit', 'file'],
  'bash': ['bash'],
  'run command': ['bash'],
  'git': ['git'],
  'commit': ['git'],
  // extend as needed after T1.1
};
```

**File**: `repos/minibob/src/resolvers/goal-verification-resolver.ts`
**Acceptance**: Map exists; `bun run typecheck` passes.

---

### T1.3 — Implement Gate 1 (capability intersection check)

In `verifyWithEvidence()`, after `evidence[]` is populated and before the `hasErrors` branch, add:

```typescript
if (goalEnrichment?.requiredCapabilities && goalEnrichment.requiredCapabilities.length > 0) {
  const required = new Set(goalEnrichment.requiredCapabilities.map(c => c.toLowerCase()));
  const toolsNorm = new Set(executionFacts.toolsUsed.map(t => t.toLowerCase()));
  // expand required to tool-name equivalents
  const expandedRequired = new Set(
    [...required].flatMap(cap => GoalVerificationResolver.CAPABILITY_TO_TOOLS[cap] ?? [cap])
  );
  const overlap = [...expandedRequired].filter(t => toolsNorm.has(t));
  if (overlap.length === 0) {
    return {
      achieved: false,
      confidence: 0.8,
      method: 'evidence_based',
      reasoning: `Required capabilities [${[...required].join(', ')}] not covered by tools used [${executionFacts.toolsUsed.join(', ')}]`,
      evidence,
      remainingGaps: [`Missing required capabilities: ${[...required].join(', ')}`],
    };
  }
}
```

**File**: `repos/minibob/src/resolvers/goal-verification-resolver.ts`
**Acceptance**: Unit tests pass for the cases listed in design.md §D1.

---

### T1.4 — Implement Gate 2 (category-based mutation check)

In `verifyWithEvidence()`, after Gate 1, add:

```typescript
if (goalEnrichment?.category === 'mutation' && filesTouched === 0) {
  return {
    achieved: false,
    confidence: 0.85,
    method: 'evidence_based',
    reasoning: "Goal category 'mutation' requires at least one file to be modified, but no files were created, modified, or deleted",
    evidence,
    remainingGaps: ["Goal category 'mutation' requires file changes"],
  };
}
```

**File**: `repos/minibob/src/resolvers/goal-verification-resolver.ts`
**Acceptance**: Unit test covering `category: 'mutation'` with zero filesTouched passes.

---

### T1.5 — Tests for enrichment gates

Add to `repos/minibob/src/resolvers/__tests__/goal-verification-resolver.test.ts` (or equivalent test file — check where tests currently live):

- Test: `verifyWithEvidence` with `goalEnrichment.requiredCapabilities: ['write explanation']`, `executionFacts.toolsUsed: ['bash']` → `achieved: false`, confidence 0.8
- Test: `verifyWithEvidence` with `goalEnrichment.category: 'mutation'`, filesTouched = 0 → `achieved: false`, confidence 0.85
- Test: `verifyWithEvidence` with `goalEnrichment` present but empty `requiredCapabilities` → falls through to existing heuristic, no regression
- Test: `verifyWithEvidence` with no `goalEnrichment` → no change (backward-compatible)

**File**: test file in `repos/minibob/src/resolvers/`
**Acceptance**: `bun test` passes with new test cases.

---

## Group 2: Workbench — `GoalCompletionBar` trace reality (D2)

### T2.1 — Audit `trajectoryStore` for impulseShapeMap

Read `repos/workbench/src/stores/trajectoryStore.ts` and determine whether a shape→impulseId mapping is available. Record findings and resolve design.md §D6 Q1.

**File**: `openspec/changes/2026-04-29-goal-verification-wiring/design.md`
**Acceptance**: Q1 in §D6 updated with findings.

---

### T2.2 — Add `impulseShapeMap` to `trajectoryStore` if missing

If the audit in T2.1 finds no shape→impulseId mapping, add:

```typescript
impulseShapeMap: Map<string, string[]>; // shape -> impulse IDs that carry that shape
```

Populate it in the WS event handler for `impulse.resolved` events (alongside the existing `impulseContentMap` population). Each event payload carries `{ shape, ... }` and the impulse ID from which `impulseContentMap` is keyed.

**File**: `repos/workbench/src/stores/trajectoryStore.ts`
**Acceptance**: Store field exists and is populated from WS events. `bun run typecheck` passes.

---

### T2.3 — Implement `calculateShapePresenceFromTrace()`

Add a new helper function in `repos/workbench/src/components/trajectory/GoalCompletionBar.tsx`:

```typescript
function calculateShapePresenceFromTrace(
  impulseShapeMap: Map<string, string[]>,     // shape -> impulse IDs
  impulseContentMap: Map<string, ImpulseContent>, // impulse ID -> content
  expectedShapes: string[]
): { present: string[]; missing: string[] }
```

A shape is "present" if `impulseShapeMap.get(shape)` returns a non-empty array AND at least one of those impulse IDs has a content body with `body` that is non-empty and `> 50 bytes` (raw JSON.stringify length).

**File**: `repos/workbench/src/components/trajectory/GoalCompletionBar.tsx`
**Acceptance**: Function implemented. Unit tests in `GoalCompletionBar.test.tsx` cover the cases in design.md §D2.

---

### T2.4 — Add `mode` prop and wire trace-mode path

Add `mode`, `impulseShapeMap`, and `impulseContentMap` props to `GoalCompletionBarProps` as specified in design.md §D2. In the component body, dispatch to `calculateShapePresenceFromTrace` when `mode === 'trace'` and the required maps are provided, else fall through to the existing `calculateShapePresence`.

**File**: `repos/workbench/src/components/trajectory/GoalCompletionBar.tsx`
**Acceptance**: Props accepted. `mode='compose'` (default) behavior unchanged.

---

### T2.5 — Pass trace props from `TrajectoryEditorPage`

In `TrajectoryEditorPage.tsx`, when `loadedTrace !== null`, pass `mode="trace"` and the impulse maps from `trajectoryStore` to `GoalCompletionBar`.

**File**: `repos/workbench/src/pages/TrajectoryEditorPage.tsx`
**Acceptance**: In trace mode, GoalCompletionBar shows actual impulse presence, not template declarations. Verified manually against a loaded trace.

---

## Group 3: Workbench — Stagnation detection (D3)

### T3.1 — Implement `detectStagnation()`

Add `detectStagnation` to `repos/workbench/src/lib/state-space.ts` as specified in design.md §D3. Export both `StagnationResult` type and `detectStagnation` function.

**File**: `repos/workbench/src/lib/state-space.ts`
**Acceptance**: Function exported. No changes to existing exports.

---

### T3.2 — Tests for `detectStagnation()`

Add to the existing `state-space.test.ts` (check where it lives — likely `repos/workbench/src/lib/__tests__/` or similar):

- Three consecutive copies of the same template → `reason: 'same_template_repeated'`
- Three columns producing shapes unrelated to `goalShapes` → `reason: 'no_goal_shape_advance'`
- Two consecutive same templates (below threshold) → `isStagnating: false`
- Empty `goalShapes` → signal 2 not triggered, function does not throw

**Acceptance**: `bun test` passes with new test cases. Existing `detectCycles` tests unchanged.

---

### T3.3 — Surface stagnation badge in `TrajectoryEditorPage`

Call `detectStagnation(activities, expectedShapes)` alongside `detectCycles`. If `isStagnating`, render an amber badge near the goal completion bar:

```
⚠ Stagnating: same template repeated 3× (no goal progress)
```

Badge should be dismissible (click to hide for the session).

**File**: `repos/workbench/src/pages/TrajectoryEditorPage.tsx`
**Acceptance**: Badge appears when stagnation is detected. Does not appear when activities are diverse or making goal progress.

---

## Group 4: Workbench — Human verdict wire (D4)

### T4.1 — Resolve open question: `activity_variant_id` mapping

Read `repos/workbench/src/pages/TrajectoryEditorPage.tsx` and `repos/workbench/src/stores/trajectoryStore.ts` to determine what ID is available when the ↑/↓ buttons are clicked. Resolve design.md §D6 Q2.

**Acceptance**: Q2 in §D6 updated.

---

### T4.2 — Add `humanVerdictOverrides` to `trajectoryStore`

Add field and actions:

```typescript
humanVerdictOverrides: Map<string, 'useful' | 'not_useful'>;
setHumanVerdict: (activityId: string, verdict: 'useful' | 'not_useful') => void;
```

**File**: `repos/workbench/src/stores/trajectoryStore.ts`
**Acceptance**: Field and action exist. `bun run typecheck` passes.

---

### T4.3 — Wire ↑/↓ buttons to store and impulse-relevance POST

In `RelevanceFeedbackRow` in `ShapeProvenanceTree.tsx`:

1. Replace `console.warn` with `useTrajectoryStore(state => state.setHumanVerdict)(activityId, 'useful' | 'not_useful')`.
2. Also fire `POST /v2/activities/impulse-relevance` for each shape in `shapes[]`:
   ```json
   { "activity_variant_id": "<resolved-id>", "impulse_shape": "<shape>", "delta": { "alpha": 1, "beta": 0 } }
   ```
   Use `apiClient` (already imported in other workbench components). Fire-and-forget with error logging.

**File**: `repos/workbench/src/components/trajectory/ShapeProvenanceTree.tsx`
**Acceptance**: Clicking ↑ writes to store and fires the POST. POST failure does not crash UI. Existing button appearance unchanged.

---

### T4.4 — Reflect human overrides in completion display

In `TrajectoryEditorPage`, after computing `completionPercentage` for `GoalCompletionBar`, check `humanVerdictOverrides`:

- If any shape-producing activity has `'not_useful'` override → downgrade display from green to amber, add tooltip "Human marked one or more activities as not useful".
- This is a display-only change; do not modify `expectedShapes` or `completionPercentage` value.

**File**: `repos/workbench/src/pages/TrajectoryEditorPage.tsx`
**Acceptance**: Amber display appears after clicking ↓ on an activity. Green display unaffected when no overrides.

---

## Group 5: Activity-API — Oracle corpus (D5)

### T5.1 — Add `goal_verification_labels` migration

Create migration file (next available number after 094, check `repos/metabob-activity-api/scripts/migrations/`) with:

```sql
DEFINE TABLE goal_verification_labels SCHEMAFULL PERMISSIONS
  FOR select WHERE org_id = $token.org_id
  FOR create WHERE org_id = $token.org_id
  FOR update NONE
  FOR delete NONE;

DEFINE FIELD OVERWRITE org_id ON goal_verification_labels TYPE string;
DEFINE FIELD OVERWRITE goal ON goal_verification_labels TYPE string;
DEFINE FIELD OVERWRITE execution_id ON goal_verification_labels TYPE string;
DEFINE FIELD OVERWRITE activity_id ON goal_verification_labels TYPE string;
DEFINE FIELD OVERWRITE verdict ON goal_verification_labels TYPE string
  ASSERT $value IN ['achieved', 'not_achieved', 'partial'];
DEFINE FIELD OVERWRITE confidence ON goal_verification_labels TYPE float;
DEFINE FIELD OVERWRITE notes ON goal_verification_labels TYPE option<string>;
DEFINE FIELD OVERWRITE labeler ON goal_verification_labels TYPE string
  ASSERT $value IN ['human', 'automated'];
DEFINE FIELD OVERWRITE created_at ON goal_verification_labels TYPE datetime DEFAULT time::now();
```

**File**: `repos/metabob-activity-api/sql/migrations/101-goal-verification-labels.surql` (current highest is 100)
**Acceptance**: Migration runs without error against canary SurrealDB. Table created.

---

### T5.2 — Implement `goal_verification_label_write` resolver

In `repos/metabob-activity-api/src/routes/impulses.ts` (or the appropriate resolver registration file), add `goal_verification_label_write` as a write resolver:

- Accepts `{ goal, execution_id, activity_id, verdict, confidence, notes?, labeler }` as payload
- Inserts into `goal_verification_labels` table
- Returns the created record ID

Follow the existing pattern used by other `_write` resolvers (e.g. `activityFeedback_write`).

**File**: `repos/metabob-activity-api/src/routes/impulses.ts` (check exact location)
**Acceptance**: `POST /v2/impulses/resolve` with `type: goal_verification_label_write` creates a record. `bun test` passes.

---

### T5.3 — Wire oracle write from ShapeProvenanceTree (optional, after T4.3)

After D4 (T4.3) is implemented, extend `handleUp` / `handleDown` in `RelevanceFeedbackRow` to also fire a `goal_verification_label_write` resolver call when `executionId` is available from `trajectoryStore`. Label with `labeler: 'human'` and `verdict: achieved` (for ↑) or `not_achieved` (for ↓).

**File**: `repos/workbench/src/components/trajectory/ShapeProvenanceTree.tsx`
**Acceptance**: Clicking ↑/↓ creates a `goal_verification_labels` record in canary DB (verify via SurrealDB query).

---

### T5.4 — Wire automated oracle write from `verifyWithEvidence` (optional)

When enrichment gates in `verifyWithEvidence` (T1.3, T1.4) produce a verdict with `confidence >= 0.8`, emit a `goal_verification_label` impulse into the activity's output pool:

```typescript
{
  id: `gvl_${executionId}_${Date.now()}`,
  pointer: { type: 'memo', content: JSON.stringify({ goal, execution_id: executionId, verdict: result.achieved ? 'achieved' : 'not_achieved', confidence: result.confidence, labeler: 'automated' }) },
  metadata: { shape: 'goal_verification_label' },
}
```

The MCP backend will pick this up and persist it via the `goal_verification_label_write` resolver when activity-api's impulse-resolution path is invoked.

**Note**: This is advisory — the goal_verification_label impulse is emitted but only written to the DB if the impulse reaches the backend. No new network call is made from minibob.

**File**: `repos/minibob/src/resolvers/goal-verification-resolver.ts` (in `createResultImpulse` or alongside it)
**Acceptance**: High-confidence verdicts produce an additional `goal_verification_label` impulse. Existing `goal_verification` impulse unchanged.

---

## Ordering and Dependencies

```
T1.1 → T1.2 → T1.3 → T1.4 → T1.5
T2.1 → T2.2 → T2.3 → T2.4 → T2.5
T3.1 → T3.2 → T3.3
T4.1 → T4.2 → T4.3 → T4.4
T5.1 → T5.2 → T5.3 (depends on T4.3) → T5.4 (depends on T1.3)
```

Groups 1–4 are independent and can be worked in parallel. Group 5 depends on DB migration (T5.1) before API work (T5.2), and T5.3 depends on T4.3 being complete.

---

## Resolved

- **T1.1** RESOLVED — design.md §D6 Q3 updated: vocabulary is usable, maps cleanly to tool names. See design.md §D6 item 3.
- **T1.2** RESOLVED — `CAPABILITY_TO_TOOLS` static map added to `GoalVerificationResolver` class.
- **T1.3** RESOLVED — Gate 1 (capability intersection check) implemented in `verifyWithEvidence()`.
- **T1.4** RESOLVED — Gate 2 (category-based mutation check) implemented in `verifyWithEvidence()`.
- **T1.5** RESOLVED — 4 new test cases added to `goal-verification-resolver.test.ts`; all 20 tests pass.
- **T2.1** RESOLVED — `impulseShapeMap` exists as `Map<string, string>` (impulse ID → shape name). Reverse mapping was absent; added as `shapeToImpulseIds`. design.md §D6 Q1 updated.
- **T2.2** RESOLVED — `shapeToImpulseIds: Map<string, string[]>` added to store + `addShapeImpulseId` action. `setImpulseShape` now populates both forward and reverse indices atomically.
- **T2.3** RESOLVED — `calculateShapePresenceFromTrace` exported from `GoalCompletionBar.tsx`. 50-byte stub threshold; truncated-only stubs rejected.
- **T2.4** RESOLVED — `mode`, `shapeToImpulseIds`, `impulseContentMap`, `notUsefulActivityIds` props added. Compose-mode path unchanged.
- **T2.5** RESOLVED — `TrajectoryEditorPage` passes `mode="trace"` + maps when `loadedTrace !== null`. `notUsefulActivityIds` derived from `humanVerdictOverrides`.
- **T3.1** RESOLVED — `detectStagnation` + `StagnationResult` exported from `state-space.ts`. `detectCycles` unchanged.
- **T3.2** RESOLVED — 8 new tests in `state-space.test.ts`; all 49 tests pass.
- **T3.3** RESOLVED — amber dismissible stagnation badge added to `TrajectoryEditorPage` below GoalCompletionBar area; resets on activities length change.
- **T4.1** RESOLVED — `activityId` in `RelevanceFeedbackRow` is trajectory instance UUID; `templateId` (= `activity.template.id`) is the correct backend ID for impulse-relevance POST. design.md §D6 Q2 updated. `RelevanceFeedbackRow` now accepts both props.
- **T4.2** RESOLVED — `humanVerdictOverrides: Map<string, 'useful' | 'not_useful'>` + `setHumanVerdict` action added to store.
- **T4.3** RESOLVED — `console.warn` stubs replaced with `setHumanVerdict` + fire-and-forget `POST /v2/activities/impulse-relevance` per shape. Errors caught and logged; UI unaffected.
- **T4.4** RESOLVED — `notUsefulActivityIds` prop on `GoalCompletionBar` triggers amber border + "human: not useful" label on present shapes. `completionPercentage` value unchanged.
- **T5.1** RESOLVED — `sql/migrations/101-goal-verification-labels.surql` created with SCHEMAFULL table, org-scoped PERMISSIONS, field assertions on verdict/labeler, and two composite indexes. `init-database.ts` auto-discovers migration files; no manual registration needed.
- **T5.2** RESOLVED — `goal_verification_label_write` case added to `src/routes/impulses.ts` (after `compositionEdge_write`, before destructive resolvers block). Writes directly to `goal_verification_labels` via `executeAsAuth` with org_id scoping. Shape `goal_verification_label` added to `src/config.ts` advertised shapes list. 8 unit tests added in `src/routes/impulses-goal-verification-label.test.ts`; all pass. `bun run typecheck` and `bun test` (new tests) pass.

## RESOLVED status markers

Mark tasks `RESOLVED` here as they complete, with the commit hash that landed the fix.
