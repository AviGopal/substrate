# Validation Plan: Activity Lifecycle Logging & Session Tracking Fix

## Status: Ready for Manual Validation

## Background

Successfully deployed all fixes to Kubernetes:
1. ✅ **305a9ab6**: Added 8 lifecycle log points
2. ✅ **dab595c1**: Fixed trailblazing path session tracking
3. ✅ **a7810fcd**: Fixed deterministic path session tracking
4. ✅ **c38a83f0**: Fixed LLM path session tracking
5. ✅ **4092d72d**: Fixed health endpoint (deployment fix)

## Deployment Status

- **Pod**: `devbob-75f7469fc4-s5btc`
- **Status**: 1/1 Running ✅
- **Health**: OK (responds in 0-1ms)
- **Image**: devbob:latest (SHA: 873e8ac2a1435f947273451875e58c495df49e8b)
- **Namespace**: metabob
- **Context**: docker-desktop

## Validation Steps

### 1. Access DevBob Pod

```bash
# Port-forward to devbob
kubectl port-forward -n metabob svc/devbob 8080:8080

# Or exec into pod
kubectl exec -it -n metabob devbob-75f7469fc4-s5btc -- /bin/bash
```

### 2. Execute Test Activity

```bash
# Inside pod or via HTTP API
opencode activity execute manage-session-memory \
  --variables '{"maxMemoryMB":100,"compressionRatio":0.7,"analysisDepth":3}' \
  --reason "Validate session tracking fix"
```

### 3. Expected Results

#### Session Tracking (FIX VERIFICATION)
```typescript
// Should see in output:
sessionsSpawned.length === 5  // Not 0
```

#### Task Completion Logs
```
[LIFECYCLE:TASK_COMPLETED] activityID=... taskID=task-1 status=completed
[LIFECYCLE:TASK_COMPLETED] activityID=... taskID=task-2 status=completed
[LIFECYCLE:TASK_COMPLETED] activityID=... taskID=task-3 status=completed
[LIFECYCLE:TASK_COMPLETED] activityID=... taskID=task-4 status=completed
[LIFECYCLE:TASK_COMPLETED] activityID=... taskID=task-5 status=completed
```

#### Correctness Verdict
```typescript
{
  verdict: "correct",  // Not "incorrect"
  confidence: > 0.5,
  reasoning: "All 5 sessions tracked successfully"
}
```

### 4. Verification Queries

```bash
# Check logs for lifecycle events
kubectl logs -n metabob devbob-75f7469fc4-s5btc | grep "LIFECYCLE:TASK_COMPLETED" | wc -l
# Expected: 5

# Check logs for session tracking
kubectl logs -n metabob devbob-75f7469fc4-s5btc | grep "sessionsSpawned"
# Expected: length: 5

# Check logs for correctness verdict
kubectl logs -n metabob devbob-75f7469fc4-s5btc | grep "verdict"
# Expected: "correct"
```

## Fix Details

### Root Cause (LLM Path)
File: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
Lines: 2996-2997

**Before** (incorrect):
```typescript
const sessionID = taskResult.metadata?.sessionId ?? null
```

**After** (correct):
```typescript
const sessionID = scope.get(Session)?.id ?? null
```

**Why**: 
- LLM execution path (~80% of activities) doesn't set `taskResult.metadata.sessionId`
- Session ID must come from `scope.get(Session)?.id` instead
- Matches deterministic and trailblazing paths

### All Execution Paths Fixed

| Path | Usage | Fix Commit | Status |
|------|-------|-----------|---------|
| Trailblazing | ~10% | dab595c1 | ✅ Fixed |
| Deterministic | ~10% | a7810fcd | ✅ Fixed |
| **LLM** | **~80%** | **c38a83f0** | **✅ Fixed** |

## Success Criteria

- [ ] Activity executes without errors
- [ ] 5/5 tasks complete successfully
- [ ] `sessionsSpawned.length === 5` (not 0)
- [ ] 5 `[LIFECYCLE:TASK_COMPLETED]` logs present
- [ ] Correctness verdict = "correct"
- [ ] Confidence > 0.5

## Known Limitations

- ACP TCP transport not yet fully functional
- Manual validation required (exec into pod or use HTTP API)
- No automated test harness deployed

## Next Steps After Validation

1. If validation passes:
   - Push commits to remote
   - Create PR for review
   - Document in changelog

2. If validation fails:
   - Check specific error in logs
   - Verify correct image is running (`docker images devbob:latest`)
   - Re-check fix in source code

## Related Documents

- `DEPLOYMENT_SUCCESS_HEALTH_FIX.md` - Deployment details
- `RUNTIME_VALIDATION_RESULTS_FRESH_SESSION.md` - Original validation showing partial fix
- `FINAL_GAP_ANALYSIS.md` - Root cause analysis for LLM path
- `VALIDATION_STATUS_FINAL.md` - Complete fix status before deployment
