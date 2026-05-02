# Design: Goal Verification Wiring

**Change ID**: `2026-04-29-goal-verification-wiring`

---

## D1: `verifyWithEvidence` Enrichment Gate

### Current State

`verifyWithEvidence` in `repos/minibob/src/resolvers/goal-verification-resolver.ts` (line ~814) receives `goalEnrichment: GoalEnrichment | undefined` but never reads it. The heuristic only counts `filesTouched`, `toolsUsed`, `commandsRun`, and `outputSummary`. Any execution that touches a file returns `{ achieved: true, confidence: 0.75 }`.

`GoalEnrichment` (from `src/types.ts`) carries:
- `category: string` — e.g. `"mutation"`, `"exploration"`, `"documentation"`, `"analysis"`
- `requiredCapabilities: string[]` — e.g. `["read file", "write explanation"]`
- `successCriteria: string[]` — e.g. `["impulse.ts content explained", "output is structured markdown"]`
- `clarifiedIntent: string`
- `expectedOutcomes: string[]`

### Decision

Add two deterministic gates before the file-count heuristic, applied only when `goalEnrichment` is present (backward-compatible):

**Gate 1: Capability intersection check**

```
required = new Set(goalEnrichment.requiredCapabilities.map(c => c.toLowerCase()))
used = new Set(executionFacts.toolsUsed.map(t => t.toLowerCase()))
// plus infer from commandsRun: bash commands imply "bash", write tool implies "write file", etc.

overlap = intersection(required, used)
```

If `required` is non-empty and `overlap` is empty, mark `achieved: false` with `confidence: 0.8` and surface the missing capabilities in `remainingGaps`. If overlap is partial (some but not all required capabilities covered), reduce confidence to 0.55.

Capability normalization: map `goalEnrichment.requiredCapabilities` strings to tool names via a small lookup table:
- `"read file"` / `"read"` → `"read"`, `"bash"`, `"file"`
- `"write"` / `"write file"` / `"write explanation"` → `"write"`, `"edit"`, `"file"`
- `"bash"` / `"run command"` → `"bash"`
- `"git"` / `"commit"` → `"git"`

This lookup is intentionally coarse — the goal is to catch the "hello world instead of documentation" class of false positive, not to enforce exhaustive tool matching.

**Gate 2: Category-based mutation check**

If `goalEnrichment.category === "mutation"` and `filesTouched === 0`, mark `achieved: false` with `confidence: 0.85` and `remainingGaps: ["Goal category 'mutation' requires at least one file to be modified"]`.

For `category === "documentation"` or `category === "exploration"`, do not require file mutations — these categories may satisfy via output only.

**Implementation location**: `verifyWithEvidence()` method, immediately after `evidence[]` is populated and before the file-count branch. Both gates short-circuit with early return.

**Tests**: Add to `goal-verification-resolver.test.ts`:
- `verifyWithEvidence` with `goalEnrichment.requiredCapabilities: ["write explanation"]` + facts with only `toolsUsed: ["bash"]` → `achieved: false`
- `verifyWithEvidence` with `goalEnrichment.category: "mutation"` + `filesTouched: 0` → `achieved: false`
- `verifyWithEvidence` with `goalEnrichment` present but empty capability list → no change in behavior (backward-compatible)

---

## D2: `GoalCompletionBar` Trace Reality

### Current State

`calculateShapePresence()` in `GoalCompletionBar.tsx` uses `activity.template.output_shapes` (declared types) to compute completion. This is a compose-mode approximation: it answers "if these activities complete successfully, will the goal be satisfied?" rather than "has the goal been satisfied by the current execution?"

### Decision

Add a mode parameter: `GoalCompletionBar` keeps the current declarative check as the **compose mode** default. In **trace mode** (when a loaded execution trace is available), switch to checking actual produced impulse shapes from the execution.

The execution-aware check should use `impulseContentMap` (already present in `trajectoryStore` as of v0.7.0) and `taskImpulseIds` (available from the trace's `tasks[].output_impulse_ids`):

```typescript
function calculateShapePresenceFromTrace(
  impulseContentMap: Map<string, ImpulseContent>,
  taskImpulseIds: Map<string, { output: string[] }>,
  expectedShapes: string[]
): { present: string[]; missing: string[] }
```

For each expected shape, a shape is "present" if at least one impulse in `impulseContentMap` has `shape === <expectedShape>` AND its content is non-empty (not `{ truncated: true }` with no summary, and not a stub file content like `< 50 bytes`).

The 50-byte threshold for stub detection is intentionally loose — this is meant to catch "hello world" files, not enforce quality. A future oracle corpus (D5) can tighten this.

**Props change** to `GoalCompletionBar`:

```typescript
export interface GoalCompletionBarProps {
  activities: TrajectoryActivity[];
  expectedShapes: string[];
  mode?: 'compose' | 'trace';                    // NEW: default 'compose'
  impulseContentMap?: Map<string, ImpulseContent>; // NEW: required when mode='trace'
  taskImpulseIds?: Map<string, { output: string[] }>; // NEW: required when mode='trace'
  onExpectedShapesChange?: (shapes: string[]) => void;
  onFindProducer?: (shape: string) => void;
  className?: string;
}
```

`TrajectoryEditorPage.tsx` passes `mode="trace"` when `loadedTrace !== null` and passes `impulseContentMap` and `taskImpulseIds` from `trajectoryStore`.

**Open question**: `impulseContentMap` is keyed by impulse ID, but we need to know which impulse IDs carry which shapes. The `impulse.resolved` WS event payload (as of T5.5) carries `{ shape, taskId, body }`. The `trajectoryStore.impulseContentMap` currently stores bodies keyed by impulse ID. Shape→impulseId mapping may need a parallel `impulseShapeMap: Map<string, string>` field in `trajectoryStore` populated from WS events. Confirm whether this map already exists before implementing.

**Tests**: Add tests for `calculateShapePresenceFromTrace` in isolation:
- Empty `impulseContentMap` → all expected shapes missing
- `impulseContentMap` with a `documentation` shape entry with non-empty body → `documentation` present
- `impulseContentMap` with a `documentation` shape entry with body `"hello world"` (< 50 bytes) → `documentation` missing

---

## D3: Stagnation Detection

### Current State

`detectCycles()` in `repos/workbench/src/lib/state-space.ts` classifies any shape-set growth as "productive". The code comment explicitly notes this is intentional. There is no check for template identity across consecutive columns, nor for goal-shape relevance of newly added shapes.

### Decision

Add a new exported function `detectStagnation()` alongside `detectCycles()`. Keep `detectCycles()` unchanged to avoid breaking callers.

```typescript
export interface StagnationResult {
  isStagnating: boolean;
  reason: 'same_template_repeated' | 'no_goal_shape_advance' | null;
  /** Column index where stagnation begins */
  stagnationStartColumn: number | null;
  /** Number of consecutive non-advancing steps */
  stagnationDepth: number;
}

export function detectStagnation(
  activities: TrajectoryActivity[],
  goalShapes: string[],   // required output shapes for the goal
  threshold: number = 3   // consecutive non-advancing steps before stagnation
): StagnationResult
```

Two stagnation signals:

**Signal 1: Same-template repeated** — If the same `template.id` appears in `threshold` or more consecutive columns (or same column, multiple rows), return `reason: 'same_template_repeated'`.

**Signal 2: No goal-shape advance** — If no activity across the last `threshold` columns has produced a shape that is in `goalShapes`, return `reason: 'no_goal_shape_advance'`. This requires `goalShapes` to be non-empty; skip this check if `goalShapes.length === 0`.

**UI surface**: In `TrajectoryEditorPage.tsx`, call `detectStagnation(activities, expectedShapes)` alongside the existing `detectCycles()` call. If `isStagnating`, display a warning badge near the goal completion bar: `"Stagnating: [reason]"` in amber.

**Tests**: Add to `state-space.test.ts`:
- Three consecutive copies of the same template → `reason: 'same_template_repeated'`
- Three columns producing shapes unrelated to `goalShapes` → `reason: 'no_goal_shape_advance'`
- Two consecutive same templates (below threshold) → `isStagnating: false`
- Empty `goalShapes` → signal 2 not triggered

---

## D4: Human Verdict Wire

### Current State

`RelevanceFeedbackRow` in `repos/workbench/src/components/trajectory/ShapeProvenanceTree.tsx` has ↑/↓ buttons that `console.warn` the intent but do nothing. The comment says: "TODO F-NN-B: POST /v2/activities/impulse-relevance".

The verification badge (showing whether the goal was achieved) is computed from `verify_goal_result` impulse content. There is no mechanism to override it with a human signal.

### Decision

Wire the ↑/↓ buttons in `RelevanceFeedbackRow` to two places:

**Step 1: trajectoryStore field**

Add a `humanVerdictOverrides: Map<string, 'useful' | 'not_useful'>` field to `trajectoryStore` (keyed by `activityId`). `handleUp` sets this to `'useful'`, `handleDown` sets it to `'not_useful'`.

**Step 2: POST impulse-relevance**

Replace the `console.warn` calls with a POST to `POST /v2/activities/impulse-relevance` with:
```json
{
  "activity_variant_id": "<activityId>",
  "impulse_shape": "<shape>",    // one call per shape in shapes[]
  "delta": { "alpha": 1, "beta": 0 }   // for ↑
}
```
Use `alpha: 0, beta: 1` for ↓. If the request fails, log a warning but do not block UI state update (store update is optimistic).

**Step 3: Verification badge override**

In `TrajectoryEditorPage`, when computing the goal completion display, check `humanVerdictOverrides`. If any activity in the trajectory has a `not_useful` override, degrade the completion confidence display (amber instead of green). If all shape-producing activities have `useful` overrides, upgrade confidence display. This is a UI-only signal — it does not write back to `goal_verification` impulses.

**Not in scope**: Modifying the backend `goal_verification` impulse after the fact. The override is advisory and session-scoped. A future change can persist it via a `goal_verification_label` write (see D5).

**Open question**: The current `POST /v2/activities/impulse-relevance` endpoint signature uses `activity_variant_id` (not `activity_id`). Confirm that workbench-visible activity IDs correspond to variant IDs or whether a lookup is needed before sending.

---

## D5: Oracle Corpus

### Current State

There is no mechanism to store labeled `(goal, execution, verdict)` triples for future calibration of the verification heuristics. The `impulse_resolutions` table and `activityExecutionTrace` shape both store facts, but not ground-truth human verdicts.

### Decision

Define a new impulse shape `goal_verification_label` and a corresponding write path.

**Shape contract**:

```typescript
interface GoalVerificationLabel {
  goal: string;                    // raw goal text
  execution_id: string;            // which execution this labels
  activity_id: string;             // which activity template ran
  verdict: 'achieved' | 'not_achieved' | 'partial';
  confidence: number;              // 0.0–1.0 human-assessed confidence
  notes?: string;                  // free-form reasoning
  labeler: 'human' | 'automated'; // how this label was produced
  created_at: string;              // ISO timestamp
}
```

**Write path**: Expose `goal_verification_label_write` as a new resolver via `POST /v2/impulses/resolve` in `activity-api`. The resolver inserts into a new `goal_verification_labels` table with no PERMISSIONS restriction beyond org scoping (labels are not sensitive — they improve learning).

**Where labels come from**:
1. **Human ↑/↓ in ShapeProvenanceTree** (from D4): when a user clicks ↑/↓ with `executionId` and `activityId` known, also fire a `goal_verification_label_write` resolver call. This creates a durable oracle entry alongside the transient session-store override.
2. **`verifyWithEvidence` high-confidence verdicts**: when the enrichment gates (D1) produce `confidence >= 0.8`, the resolver can optionally emit a `goal_verification_label` impulse automatically (`labeler: 'automated'`). This creates a growing corpus of machine-labeled examples that can be reviewed later.

**Migration**: Add a new SurrealDB migration for the `goal_verification_labels` table with `DEFINE TABLE goal_verification_labels SCHEMAFULL PERMISSIONS FOR select WHERE org_id = $token.org_id`. The migration should follow the existing migration numbering scheme (currently highest is 100, so the next is 101). Migration files live under `repos/metabob-activity-api/sql/migrations/`.

**No training loop yet**: This change only stores labels. Using them to retrain or calibrate the heuristics is deferred. The value now is building a corpus.

---

## D6: Open Questions

1. **`impulseShapeMap` in `trajectoryStore`** (affects D2): RESOLVED (T2.1, 2026-04-29). The store has `impulseShapeMap: Map<string, string>` (impulse ID → shape name). This is the REVERSE direction from what `calculateShapePresenceFromTrace` needs. A parallel `shapeToImpulseIds: Map<string, string[]>` field must be added (shape → list of impulse IDs). The `impulseContentMap` is keyed by impulse ID and its value type is `unknown`. The existing `impulseShapeMap` already present is sufficient to derive the reverse mapping at read time, but a dedicated `shapeToImpulseIds` field avoids O(N) scans on every render.

2. **`activity_variant_id` vs `activity_id` in impulse-relevance** (affects D4): RESOLVED (T4.1, 2026-04-29). The `RelevanceFeedbackRow` component receives `activityId` which is `TrajectoryActivity.id` — a locally-generated UUID (`activity-TIMESTAMP-RANDOM`). This is NOT a backend template ID. The correct ID to use in `POST /v2/activities/impulse-relevance` is `activity.template.id` (the string template ID, e.g. "hello-world-minimal"). The `ShapeProvenanceTree` maps producer IDs to activities, and `activity.id === producer` (trajectory instance UUID). The `template.id` must be looked up from `activity.template.id`. In `RelevanceFeedbackRow`, the `activityId` prop should be interpreted as the trajectory instance ID; we need a companion `templateId` prop (the `activity.template.id`) to send to the backend.

3. **`goalEnrichment.requiredCapabilities` population** (affects D1): **RESOLVED (T1.1, 2026-04-29)** — Vocabulary is usable and maps cleanly to tool names. The enrichment prompt in `goal-enrichment-resolver.ts` explicitly instructs the LLM to use "ONLY capabilities needed for the literal request" with examples like `"read file"`, `"write explanation"`, `"bash"`. The `inferExpectedOutputShapes` function already maps `caps.has("file_write") / "write"` etc., confirming the capability strings align with the CAPABILITY_TO_TOOLS lookup table. The gate is a no-op only when the LLM returns an empty `requiredCapabilities` array (the safe fallback — gate is skipped and existing heuristics apply). No controlled-vocabulary enforcement needed at this stage.

4. **`GoalCompletionBar` in compose mode with no goalPathRecs** (affects D2): When `goalPathRecs` is empty (no backend data), `expectedShapes` comes entirely from `inferExpectedShapes()` keyword matching. The `GoalCompletionBar` stays in compose mode. Confirm this is the right default — there's an argument for hiding the bar entirely when no backend data is available, to avoid false reassurance.

5. **50-byte stub threshold** (affects D2): The "< 50 bytes → not substantive" heuristic is arbitrary. Consider making it configurable via an environment variable or a component prop so it can be tuned without a code change.
