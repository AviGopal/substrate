# Broadcaster Per-Task Impulse Grouping

> **Status:** ✅ Implemented (2026-04-25)
> **Companion changes (all landed):**
> - `3d537c8` (minibob) — `serializeTasksForTrace` emits `input_impulse_ids` / `output_impulse_ids` per task.
> - `2a7984e` (activity-api) — `normalizePersistedTask` writes those fields into `activity_execution_traces.tasks[*]`.
> - `003f477` (activity-api) — `executionTraceWithSignatures` reads them as canonical snake_case.
> - **NEW (2026-04-25):** `extractTaskImpulseIds` helper added to `execution-traces.ts`; `TaskCompletedMessage` extended with `input_impulse_ids` and `output_impulse_ids` fields in `websocket/types.ts`; broadcaster now emits per-task impulse arrays on `task.completed` events.
>
> The three legs are now complete: minibob serializes, activity-api persists and broadcasts, and consumers (concept-db, workbench) receive the data via both REST and WebSocket.

## Problem

The persistence path now correctly preserves per-task impulse grouping. The broadcast path does not.

When activity-api stores an execution trace (`POST /v2/activities/execution-traces`), it does two things in `src/routes/execution-traces.ts`:

1. **Persist** — runs `body.execution_trace.tasks.map(normalizePersistedTask)` (line ~771 / ~1075). Result: `tasks[].input_impulse_ids` and `tasks[].output_impulse_ids` are stored on the row. ✓
2. **Broadcast** — iterates the same `body.execution_trace.tasks` array (line ~1117–1173) and emits `task.started`, `tool.call`, and `task.completed` WebSocket events. Result: each event payload is built from the same source object as persistence, but the broadcaster's payload constructor (line ~1159) only reads:
   - `task_id`
   - `task_index`
   - `success` (from `task.result?.status === 'success'`)
   - `duration_ms`
   - `completed_at`
   - `error`

The per-task impulse arrays are right there on `task` (minibob already serialized them), but the broadcaster doesn't copy them into the event data. So:

- Concept-db's `ExecutionObserver.handleTaskCompleted` (`repos/concept-db/src/services/execution-observer.ts:364`) calls `buildUsageRequestsFromTaskCompleted`, which reads `data.impulse_resolutions` — never populated — and returns `[]`. Result: zero passive `recordUsage` writes from live events. The observer is wired correctly but starves on broadcast data.
- Workbench's `useTrajectoryExecution` (`repos/workbench/src/hooks/useTrajectoryExecution.ts:33,140,152`) already declares `output_impulse_ids: string[]` and `input_impulse_ids?: string[]` on its `TaskCompletedEvent` shape and uses them to populate `realizedImpulseIds` and per-task shape contributions. Today it receives `undefined` for these fields and silently no-ops the realized-impulses path.

The fix is small: the broadcaster source already has the data; we just need to copy it into the payload (and extend the type so consumers know it's there). No schema change, no new endpoint, no new emit site.

### Why this matters

Without the fix:
- **Cooccurrence learning is post-hoc only.** The cooccurrence extractor reads from persisted traces (`executionTraceWithSignatures`), so it eventually sees the data. Live concept-usage signal via the observer is dead. That's a real loss for any "learn from in-flight executions" surface.
- **Workbench's realized-impulses panel can't render correctly during a live run.** It only fills in after the page refreshes and re-reads from REST, defeating the live monitor's purpose.

## Constraints

1. **Wire-additive only.** Existing consumers must not break. Fields are optional on the wire; absent → consumers fall back to current behavior.
2. **Match persistence canonical naming.** Persisted shape is snake_case (`input_impulse_ids`, `output_impulse_ids`). Don't introduce a third spelling.
3. **Catchup must not regress.** The 1000-event in-memory `eventHistory` is replayed on reconnect. Whatever we emit going forward replays correctly. Pre-fix events in history naturally lack the fields — that's fine; they predate the fields and consumers already tolerate absence.
4. **No new emit sites.** This is a payload extension, not a new event type. `task.completed` is the right carrier; `tool.call` and `task.started` don't need it.
5. **No coupling change to minibob.** Minibob already emits the fields; broadcaster just needs to forward them. If a future minibob doesn't send them, broadcaster emits empty arrays (same as today).

## Recommended Design

### Data flow today (just the broadcast path)

```
minibob serializeTasksForTrace
    → POST /v2/activities/execution-traces  (body.execution_trace.tasks[*])
        → execution-traces.ts:1117  for-loop over tasks
            → broadcaster.emit({type:'task.completed', data:{…}})  ← strips per-task impulse arrays
                → WS broadcast
                    → concept-db ExecutionObserver  (sees no impulse_resolutions; no-ops)
                    → workbench useTrajectoryExecution  (sees no output_impulse_ids; no-ops)
```

The minibob-emitted `task` object already has `input_impulse_ids` and `output_impulse_ids` in canonical snake_case (per `serializeTasksForTrace` lines 183–186 and the wire shape at line 253–254). The broadcaster's loop sees the exact same array that `normalizePersistedTask` sees one block earlier. The fix is one block of three lines per emit site.

### Naming decision: snake_case

Survey of `broadcaster.ts` payloads (`src/websocket/types.ts:13–95`):

| Event | Field examples |
|---|---|
| `execution_started` | `execution_id`, `variant_id`, `pod_name` |
| `execution_completed` | `execution_id`, `duration_ms`, `cost`, `completed_at` |
| `task.started` | `execution_id`, `task_id`, `task_index`, `started_at` |
| `task.completed` | `execution_id`, `task_id`, `task_index`, `duration_ms`, `completed_at` |
| `tool.call` | `execution_id`, `task_id`, `tool_name`, `resolver_tier`, `latency_ms`, `cost_usd` |

The broadcaster is uniformly snake_case. `input_impulse_ids` / `output_impulse_ids` match this convention **and** match the persistence side. This is the correct call: a single canonical name across persistence, read-resolver, and live broadcast.

(Note: workbench's `useTrajectoryExecution.ts` mixes camelCase for some fields and snake_case for the impulse-id arrays — that file is the consumer, and its impulse-id field names are already snake_case, so it Just Works. The few camelCase fields there belong to other event types.)

### Recommended payload extension

`task.completed`:

```ts
{
  type: 'task.completed',
  sequence: <number>,
  timestamp: <iso>,
  data: {
    execution_id: string,
    task_id: string,
    task_index: number,
    success: boolean,
    duration_ms: number,
    completed_at: string,
    error?: string,

    // NEW — per-task impulse grouping. Always emitted as arrays
    // (possibly empty). Symmetric with persisted tasks[*] shape.
    input_impulse_ids: string[],
    output_impulse_ids: string[],
  }
}
```

Both fields **always present, always arrays** (possibly empty). This avoids the "is undefined the same as []?" question on the consumer side. Persistence does the same thing via `normalizePersistedTask`.

`task.started` and `tool.call` do **not** carry these fields. Rationale:
- `task.started` fires before resolution; output impulse IDs aren't known yet, and input impulse IDs are duplicated on `task.completed` anyway. Adding them to `task.started` would invite consumers to use the in-flight-incomplete data as canonical and forget to update on completion.
- `tool.call` is per-tool-invocation, not per-task — wrong granularity.

### `RuntimeExecutionTrace` extension

`runtime-tracing.ts` is a separate code path (HTTP middleware tracing inside activity-api itself, not minibob's activity execution). It builds traces from request context, not from minibob payloads. Per-task impulse grouping is **not relevant** to it — a `RuntimeActivityContext` represents one HTTP request and aggregates resolutions to execution scope, not task scope (it has no concept of multiple tasks).

**Decision:** leave `RuntimeExecutionTrace` unchanged. The original prompt asks to "update the type to carry per-task input/output impulse IDs," but inspection shows this type does not represent multi-task minibob executions; it represents single-request runtime tracing. Extending it would add fields that have no source and no consumer. If we later want runtime traces to support multi-task semantics, that's a separate change.

What we **do** need a type for is the `data` payload of `task.completed`. That lives in `src/websocket/types.ts:69–81`. That's where the additive change happens.

### Observer-side (concept-db)

The observer is **wired but not consuming the right field**. Concretely:

- `TaskCompletedEvent.data` (line 41–55) declares `impulse_resolutions?: ImpulseResolutionLike[]` as the optional extension point.
- `buildUsageRequestsFromTaskCompleted` (line 139) reads `data.impulse_resolutions` and runs it through `extractConceptRefs` to find concept IDs.
- `extractConceptRefs` (line 93) inspects `r.concept_id`, `r.shape === 'concept'`, `r.impulse_id` prefixes.

But the broadcaster's `task.completed` does not and will not emit `impulse_resolutions` per-task — that's an execution-scoped array (resolution events have their own tier/vessel/latency tracking and are emitted as separate `tool.call` / a future `impulse.resolved` event). What the broadcaster will emit is `input_impulse_ids` / `output_impulse_ids`: bare ID arrays.

So the observer needs a small adapter: when `input_impulse_ids` or `output_impulse_ids` is present, treat each ID as an `ImpulseResolutionLike` with `impulse_id: id` and run the existing `extractConceptRefs` over the synthesized list. This keeps `extractConceptRefs` as the single source of truth for concept-ID detection.

Concretely:

```ts
// In execution-observer.ts handleTaskCompleted, before buildUsageRequestsFromTaskCompleted:
const synthesized: ImpulseResolutionLike[] = [
  ...(event.data.input_impulse_ids ?? []).map(id => ({ impulse_id: id })),
  ...(event.data.output_impulse_ids ?? []).map(id => ({ impulse_id: id })),
  ...(event.data.impulse_resolutions ?? []),  // preserve future extension point
];
// then pass synthesized through extractConceptRefs
```

Add `input_impulse_ids?: string[]` and `output_impulse_ids?: string[]` to the `TaskCompletedEvent.data` declaration. Keep `impulse_resolutions?` for forward compatibility (a richer event might emit both).

### Workbench (no broadcaster-side change)

`useTrajectoryExecution.ts:33` already has `output_impulse_ids: string[]` declared as **required** on its `TaskCompletedEvent` shape, and reads `input_impulse_ids` defensively at line 152. So workbench is already coded for the post-fix wire format and will start populating its realized-impulses set as soon as activity-api emits the fields.

`LiveExecutionMonitor.tsx` does not consume per-task impulse IDs — it only tracks counts, durations, costs, and status. No change needed.

(Consideration: the `output_impulse_ids: string[]` in `useTrajectoryExecution.ts` is **non-optional** — if events arrive without the field, the line `data.output_impulse_ids.length > 0` will throw. This is a latent bug from the workbench side, but the safest fix here is on the broadcaster side: always emit the field as `[]` if absent. Persistence and the broadcaster will both guarantee non-undefined arrays going forward.)

## Implementation Outline

### Repo: `metabob-activity-api`

**1. `src/websocket/types.ts`** — extend `TaskCompletedMessage.data`:

```ts
export interface TaskCompletedMessage extends WebSocketMessage {
  type: 'task.completed';
  sequence: number;
  data: {
    execution_id: string;
    task_id: string;
    task_index: number;
    success: boolean;
    duration_ms: number;
    completed_at: string;
    error?: string;
    // NEW: per-task impulse grouping. Always present (possibly empty).
    // Symmetric with `tasks[*].input_impulse_ids` / `output_impulse_ids` on
    // the persisted row. See docs/specs/broadcaster-per-task-grouping.md.
    input_impulse_ids: string[];
    output_impulse_ids: string[];
  };
}
```

**2. `src/routes/execution-traces.ts`** — extend the `task.completed` payload (around line 1159). Reuse the same field-priority logic that `normalizePersistedTask` uses:

```ts
// Before broadcasting task.completed, derive the impulse-id arrays the same
// way normalizePersistedTask does — so the broadcast and persisted shape
// stay perfectly symmetric.
const inputImpulseIds: string[] = Array.isArray(task?.input_impulse_ids)
  ? task.input_impulse_ids
  : Array.isArray(task?.inputImpulseIds)
    ? task.inputImpulseIds
    : Array.isArray(task?.inputState?.impulses)
      ? task.inputState.impulses
      : [];
const outputImpulseIds: string[] = Array.isArray(task?.output_impulse_ids)
  ? task.output_impulse_ids
  : Array.isArray(task?.outputImpulseIds)
    ? task.outputImpulseIds
    : Array.isArray(task?.outputState?.impulses)
      ? task.outputState.impulses
      : [];

broadcaster.emit({
  type: 'task.completed',
  timestamp: new Date().toISOString(),
  data: {
    execution_id: trace.execution_id,
    task_id: taskId,
    task_index: taskIndex,
    success: taskSuccess,
    duration_ms: task.duration || task.duration_ms || 0,
    completed_at: new Date().toISOString(),
    error: taskSuccess ? undefined : (task.result?.error || task.error),
    input_impulse_ids: inputImpulseIds,
    output_impulse_ids: outputImpulseIds,
  },
});
```

**Refactoring opportunity (recommended):** the impulse-ID extraction logic is now duplicated between `normalizePersistedTask` and the broadcaster. Extract a single pure helper:

```ts
// In a new src/lib/task-impulse-ids.ts (or alongside normalizePersistedTask):
export function extractTaskImpulseIds(task: any): {
  input_impulse_ids: string[];
  output_impulse_ids: string[];
} { /* … same logic … */ }
```

Then call it from both `normalizePersistedTask` and the broadcaster loop. This keeps the two leg shapes synchronized when the read order (snake_case → camelCase → state container) needs to evolve.

**3. Catchup behavior** — `eventHistory` stores already-emitted messages by reference. Once we start emitting the new fields, every newly-stored event has them. Pre-fix events in `eventHistory` (rolling 1000-event ring) lack the fields and will be replayed without them. Acceptable: replayed-pre-fix events have the same shape they had at emit time, and consumers already tolerate absence (with the workbench-side caveat noted above — fixed by guaranteeing arrays at emit time going forward, but pre-fix events in history at deploy time will still be missing them; given the 1000-event window, they roll out in seconds-to-minutes under any non-trivial load).

**Decision:** no catchup-protocol change. "Fields present on new events only" is correct. Don't retro-mutate `eventHistory` entries — it has no benefit and introduces a TOCTOU surface.

**4. Tests** (`src/routes/execution-traces.test.ts` — extend, don't duplicate):
   - Wire-shape test: feed the route a fixture trace (the same one used in the persistence test), assert that `broadcaster.emit` is called with `task.completed` data containing the expected `input_impulse_ids` and `output_impulse_ids`. Mock the broadcaster module.
   - Empty-arrays test: feed a task with no impulse references; assert event data contains `input_impulse_ids: []` and `output_impulse_ids: []` (not undefined, not missing).
   - Field-priority test: snake_case → camelCase → `inputState.impulses` fallback, mirroring the persistence test cases.
   - Symmetry test: assert that the persisted `tasks[i]` and the broadcast `task.completed.data` for the same task carry identical `input_impulse_ids` and `output_impulse_ids` arrays.

### Repo: `concept-db`

**1. `src/services/execution-observer.ts`** — extend `TaskCompletedEvent.data`:

```ts
export interface TaskCompletedEvent {
  type: 'task.completed';
  sequence?: number;
  data: {
    execution_id: string;
    task_id: string;
    task_index?: number;
    success: boolean;
    duration_ms?: number;
    completed_at?: string;
    error?: string;
    activity_id?: string;
    impulse_resolutions?: ImpulseResolutionLike[];
    // NEW: bare impulse-ID arrays from the broadcaster's per-task grouping.
    input_impulse_ids?: string[];
    output_impulse_ids?: string[];
  };
}
```

**2. `buildUsageRequestsFromTaskCompleted`** — synthesize `ImpulseResolutionLike[]` from the bare ID arrays before extracting concept refs:

```ts
export function buildUsageRequestsFromTaskCompleted(
  event: TaskCompletedEvent,
): RecordUsageRequest[] {
  const { data } = event;
  if (!data) return [];

  // Normalize the broadcaster's bare-ID arrays into the same
  // ImpulseResolutionLike shape extractConceptRefs expects.
  const synthesized: ImpulseResolutionLike[] = [
    ...(data.input_impulse_ids ?? []).map(id => ({ impulse_id: id })),
    ...(data.output_impulse_ids ?? []).map(id => ({ impulse_id: id })),
    ...(data.impulse_resolutions ?? []),
  ];

  const conceptIds = extractConceptRefs(synthesized);
  if (conceptIds.length === 0) return [];

  const outcome: Outcome = data.success ? 'success' : 'failure';
  return conceptIds.map((concept_id) => ({
    concept_id,
    trace_id: data.execution_id,
    activity_id: data.activity_id,
    task_id: data.task_id,
    outcome,
  }));
}
```

**3. Tests** (`src/services/execution-observer.test.ts`):
   - Given a `task.completed` event with `output_impulse_ids: ['concept:c1', 'memo:m1']` and a `recordUsage` spy, assert that `recordUsage` is called once with `concept_id: 'c1'`.
   - Given an event with both `input_impulse_ids` and `output_impulse_ids` containing concept refs, assert deduplication via `extractConceptRefs`'s existing `Set` behavior.
   - Given an event with neither field present and no `impulse_resolutions`, assert `recordUsage` is not called (preserves current behavior).
   - Given an event with both bare arrays AND `impulse_resolutions`, assert all sources are merged and de-duplicated.

### Repo: `workbench`

**No code change required.** `useTrajectoryExecution.ts` already declares the fields and consumes them. The contract is already symmetric on this side.

**Optional hardening (recommended but out-of-scope for this spec):** make `TaskCompletedEvent.output_impulse_ids` optional (`output_impulse_ids?: string[]`) in `useTrajectoryExecution.ts:33` and guard with `?? []` at line 140. This protects against any future event source that drops the field. Could be a one-liner follow-up PR.

### Repo: `activity-dashboard`

**Confirm no change needed.** `grep "task.completed"` returned no hits in `repos/activity-dashboard/`. The dashboard is not currently a consumer of fine-grained task events; it consumes `execution_started` / `execution_completed` / `template_updated`. No-op.

## Test Plan

### Unit (per repo)

| Repo | File | What |
|---|---|---|
| activity-api | `src/routes/execution-traces.test.ts` | Mock `broadcaster.emit`; assert `task.completed.data.input_impulse_ids` and `output_impulse_ids` populated correctly (snake_case priority, camelCase fallback, `inputState.impulses` fallback, empty-array default). |
| activity-api | `src/routes/execution-traces.test.ts` (symmetry) | Round-trip: same task fixture → assert persisted shape and broadcast shape carry identical impulse-ID arrays. |
| concept-db | `src/services/execution-observer.test.ts` | `buildUsageRequestsFromTaskCompleted` extracts concept IDs from `input_impulse_ids` / `output_impulse_ids`; preserves existing `impulse_resolutions` path; merges all sources. |
| workbench | (existing tests) | No new test required; existing `LiveExecutionMonitor.test.tsx` and `useTrajectoryExecution` tests should still pass — but verify by running. |

### Integration

End-to-end smoke test (could be one Vitest in activity-api or a small script under `scripts/`):

1. Spin up activity-api (test mode, in-memory broadcaster).
2. Open a WebSocket subscriber, authenticate.
3. POST a fixture execution trace where one task has `input_impulse_ids: ['concept:c1']` and `output_impulse_ids: ['concept:c2']`.
4. Assert: subscriber receives a `task.completed` event whose `data.input_impulse_ids === ['concept:c1']` and `data.output_impulse_ids === ['concept:c2']`.
5. Assert: persisted row's `tasks[0].input_impulse_ids` equals the broadcast's `data.input_impulse_ids` (cross-leg symmetry).

### Canary validation

1. Push to `dev`. CI deploys to canary.
2. Run a real minibob execution against `https://activity.metabob.com` that resolves at least one concept-shape impulse (e.g., a goal-driven activity that pulls a goal concept from concept-db).
3. From a local `wscat` (or workbench page open):
   - Subscribe to `wss://activity.metabob.com/ws`, authenticate.
   - Confirm `task.completed` events carry non-empty `input_impulse_ids` / `output_impulse_ids` for tasks that actually touched impulses.
4. From concept-db logs: confirm `[Observer] Recorded passive usage` lines fire on `task.completed` (currently they never do — that's the smoking gun this fix resolves).

## Open Questions

1. **Should `task.started` carry `input_impulse_ids`?** Counter-argument: at task-start time, the input impulses are known (they're the task's declared inputs), so emitting them earlier could let consumers light up "consumed impulses" UI before completion. Counter-counter-argument: `task.completed` carries them anyway, and the latency between started→completed is small. **Recommended: no for now.** Add later if a UI surface needs it.

2. **Should we emit a separate `impulse.resolved` event?** Workbench already speculatively handles `impulse.resolved` (`useTrajectoryExecution.ts:36–47, 154–183`) with fields `impulseId`, `resolverTier`, `vesselId`, `shape`, `taskId`, `resolver`, `latency_ms`, `cost_usd`. That's per-resolution, not per-task — different granularity from this spec. **Out of scope.** Track separately as a future event type. The per-task arrays we add here are the lighter signal that's correct enough for cooccurrence and realized-impulse UI.

3. **Does the dual-write paradigm path (`execution-traces.ts:1178+`) also need the broadcast hook?** The broadcast happens before the dual-write block, so it's already fired by the time paradigm-write runs. No change.

4. **Should we emit `input_impulse_ids` / `output_impulse_ids` on `execution_completed` too?** Currently `execution_completed.data` carries only execution-scoped totals. Adding aggregate input/output impulse arrays could be useful, but the per-task arrays are strictly more informative (consumers can fold them up). **Out of scope.**

5. **What happens to existing `eventHistory` entries already in the ring at deploy time?** They lack the new fields. Catchup replays them as-is. Consumers tolerate absence. Within ~1000 events of normal canary load, they're naturally evicted. **Decision: do nothing.** No retro-mutation.

6. **Should the broadcaster guarantee `input_impulse_ids: []` on `task.completed` events that come from a future minibob version that doesn't send the fields?** Yes — the extraction logic in step 2 above defaults to `[]` when no source is found. This shields downstream consumers (workbench in particular) from undefined. Persistence does the same.
