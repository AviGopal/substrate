## 1. useTrajectoryExecution — wsUrl extraction and return type

- [x] 1.1 Add `parseWsUrl(content: string): string | undefined` helper in `useTrajectoryExecution.ts` (same pattern as GoalSubmissionPanel's inline regex)
- [x] 1.2 Change `submitTrajectory` return type from `Promise<string>` to `Promise<{ executionId: string; wsUrl?: string }>`
- [x] 1.3 In `submitTrajectory`, replace `return resolvedId` with `return { executionId: resolvedId, wsUrl: parseWsUrl(content) }`

## 2. GoalSubmissionPanel — forward wsUrl

- [x] 2.1 In `handleRunTrajectory`, destructure `{ executionId, wsUrl }` from the `submitTrajectory` result instead of treating it as a plain string
- [x] 2.2 Pass `wsUrl` as second argument to `onExecutionStarted(executionId, wsUrl)`

## 3. Tests

- [x] 3.1 Add unit test: `submitTrajectory` resolves with `{ executionId, wsUrl }` when vessel response includes `wsUrl: <url>` in content
- [x] 3.2 Add unit test: `submitTrajectory` resolves with `{ executionId, wsUrl: undefined }` when response content has no wsUrl

## 4. Typecheck and Smoke

- [x] 4.1 Run `npx tsc --noEmit` in `repos/workbench` — zero new errors
- [x] 4.2 Run `npx vitest run` in `repos/workbench` — no regressions (200 passing vs 192 baseline, 78 failing unchanged)
