## Approach

Two-line-of-code fix with a return-type change. No new components, no new hooks. The pattern for parsing `wsUrl` from vessel response content already exists in `GoalSubmissionPanel`; it gets moved into `useTrajectoryExecution` alongside the existing `executionId` extraction.

## Changes

### `useTrajectoryExecution.ts`

**Add wsUrl parsing** alongside existing executionId regex:

```ts
// near the top of the file (or inline in submitTrajectory)
function parseWsUrl(content: string): string | undefined {
  return content.match(/wsUrl:\s*(\S+)/)?.[1];
}
```

**Change `submitTrajectory` return type**:

```ts
// Before
submitTrajectory: (activities: TrajectoryActivity[], goal?: string) => Promise<string>

// After
submitTrajectory: (activities: TrajectoryActivity[], goal?: string) => Promise<{ executionId: string; wsUrl?: string }>
```

**Return both values** from the resolved content:

```ts
// Before
const match = content.match(/executionId:\s*(\S+)/);
const resolvedId = match?.[1] ?? null;
if (!resolvedId) throw new Error('Response did not include an executionId');
return resolvedId;

// After
const match = content.match(/executionId:\s*(\S+)/);
const resolvedId = match?.[1] ?? null;
if (!resolvedId) throw new Error('Response did not include an executionId');
return { executionId: resolvedId, wsUrl: parseWsUrl(content) };
```

### `GoalSubmissionPanel.tsx`

**Destructure in `handleRunTrajectory`**:

```ts
// Before
const executionId = await submitTrajectory(activities, goalText.trim() || undefined);
success = true;
onExecutionStarted(executionId);

// After
const { executionId, wsUrl } = await submitTrajectory(activities, goalText.trim() || undefined);
success = true;
onExecutionStarted(executionId, wsUrl);
```

## Data Flow

```
User clicks "run trajectory"
→ GoalSubmissionPanel.handleRunTrajectory
  → useTrajectoryExecution.submitTrajectory(activities, goal)
    → POST to vessel endpoint (or activity-api fallback)
    → parse executionId + wsUrl from response content
    → return { executionId, wsUrl }
  → onExecutionStarted(executionId, wsUrl)  ← wsUrl now propagated
    → setActiveExecutionId(id)
    → setActiveWsUrl(url ?? null)           ← vessel WS now wired
→ useTrajectoryExecution(executionId, activeWsUrl)
  → useWebSocket: connects to vessel-provided ws:// URL
→ live events stream from vessel
```

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useTrajectoryExecution.ts` | Add `parseWsUrl`, change return type, return `{ executionId, wsUrl }` |
| `src/components/trajectory/GoalSubmissionPanel.tsx` | Destructure + forward wsUrl |
| `src/hooks/useTrajectoryExecution.test.ts` | New: wsUrl extraction unit test |
