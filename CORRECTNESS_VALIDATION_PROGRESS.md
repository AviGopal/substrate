# Correctness Validation Implementation Progress

**Started**: February 17, 2026  
**Status**: Phase 1.1 Complete ✅

---

## Implementation Phases

### ✅ Phase 1.1: Schema Enhancement (COMPLETE)

**Goal**: Add optional fields to Activity.Info for evidence collection

**Changes Made**:
- File: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- Lines added: 96
- Breaking changes: None (all fields optional)

**New Fields**:
1. `executionEvidence` - Track sessions spawned and tool calls
2. `validationEvidence` - Log validation command execution
3. `workArtifacts` - Record files changed and commits
4. `correctnessVerdict` - Computed verdict with confidence score

**Commit**: `06f0effb` - Phase 1.1: Add optional correctness validation fields to Activity.Info

**Testing**: TypeScript compiles successfully (no new errors)

---

### 🔄 Phase 1.2: Session Tracking (IN PROGRESS)

**Goal**: Track session creation and tool calls during activity execution

**Files to Modify**:
1. `activity.ts` - Track sessions when spawned
2. `template-executor.ts` - Record tool calls
3. `task-execution-shared.ts` - Hook into execution

**Changes Needed** (minimal):
```typescript
// In activity.ts executeTask()
const sessionID = await Session.create(...)

// NEW: Track session
activity.executionEvidence!.sessionsSpawned.push({
  sessionID,
  taskId: task.id,
  agentType: task.agent,
  startTime: Date.now(),
  endTime: 0,  // Will be updated
  messageCount: 0,
  toolCallCount: 0
})
```

**Strategy**: Add 3-5 lines at existing hook points (non-invasive)

---

### ⏳ Phase 1.3: Validation Logging (PENDING)

**Goal**: Log validation command execution and results

**File to Modify**:
- `task-execution-shared.ts` in `runValidationCommands()`

**Changes Needed** (minimal):
```typescript
// In runValidationCommands()
const startTime = Date.now()
const proc = Bun.spawn(...)
const exitCode = await proc.exited

// NEW: Log validation result
if (activity.validationEvidence) {
  activity.validationEvidence.commands.push({
    name: cmd.name,
    command: cmd.command,
    exitCode,
    passed: exitCode === 0,
    duration: Date.now() - startTime
  })
}
```

**Strategy**: Add logging inside existing loop (5-10 lines)

---

### ⏳ Phase 1.4: File Change Tracking (PENDING)

**Goal**: Record files changed during activity execution

**File to Modify**:
- `activity.ts` after activity completes

**Changes Needed** (minimal):
```typescript
// After activity completes, before save
if (activity.workArtifacts) {
  const diff = await ActivityGit.getDiff(activity.baseCommit, "HEAD")
  activity.workArtifacts.filesChanged = parseFilesFromDiff(diff)
  activity.workArtifacts.commitsMade = activity.commits.map(c => c.sha)
}
```

**Strategy**: Add at completion hook (10-15 lines)

---

### ⏳ Phase 1.5: Correctness Verdict Computer (PENDING)

**Goal**: Compute verdict from collected evidence

**New File**:
- `activity-correctness.ts` (separate module)

**Function**:
```typescript
export function computeCorrectnessVerdict(activity: Activity.Info): CorrectnessVerdict {
  // 8 checks from design
  // Returns: verdict, confidence, issues[]
}
```

**Integration**:
```typescript
// In activity.ts before final save
activity.correctnessVerdict = computeCorrectnessVerdict(activity)
```

**Strategy**: New file, single function call from activity.ts

---

### ⏳ Phase 1.6: Testing (PENDING)

**Goal**: Verify system works with ground truth activity

**Test Plan**:
1. Re-run ultra-simple-test activity
2. Check: `executionEvidence.sessionsSpawned.length`
3. Check: `validationEvidence.executed`
4. Check: `correctnessVerdict.verdict`
5. Expected: `verdict === "suspicious"` (no sessions spawned)

---

## Code Impact Summary

**Total Files Modified**: 3-4
- `activity.ts` - Main schema and tracking hooks
- `task-execution-shared.ts` - Validation logging
- `activity-correctness.ts` - NEW (verdict computer)
- `template-executor.ts` - Optional (if session hooks needed)

**Total Lines Added**: ~200-250 lines
- Schema: 96 lines ✅
- Session tracking: ~30 lines
- Validation logging: ~40 lines
- File change tracking: ~30 lines
- Verdict computer: ~100 lines

**Breaking Changes**: None (all changes backward compatible)

---

## Risk Assessment

### Low Risk ✅
- All new fields optional
- Existing activities load without changes
- Compilation successful
- No performance impact (evidence collection is lightweight)

### Medium Risk ⚠️
- Need to test with real activity execution
- Verdict algorithm assumptions need validation
- Evidence collection might miss edge cases

### Mitigation Strategy
- Incremental rollout (one phase at a time)
- Test each phase before proceeding
- Graceful handling of missing evidence
- Backward compatibility maintained

---

## Next Session Plan

1. **Implement Phase 1.2**: Session tracking
   - Identify exact hook points in activity.ts
   - Add 3-5 lines to track sessions
   - Test: Check sessionsSpawned array populated

2. **Implement Phase 1.3**: Validation logging
   - Modify runValidationCommands()
   - Add validation results to evidence
   - Test: Check validation commands logged

3. **Quick Test**: Run ultra-simple-test
   - Verify evidence is being collected
   - Check for any errors or issues
   - Proceed to Phase 1.4 if successful

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Schema enhanced (DONE)
- ⏳ Session tracking working
- ⏳ Validation logging working
- ⏳ File changes captured
- ⏳ Verdict computed
- ⏳ Ground truth activity shows `verdict: "suspicious"`

### System-Level Success:
- Silent failures detected (correctness verdict catches them)
- Diagnostic tools can show what happened
- Confidence scores guide manual review
- No false positives on known-good activities

---

**Current Status**: Phase 1.1 complete, ready for Phase 1.2  
**Estimated Time to Complete**: 2-3 more phases (1-2 hours)  
**Next Step**: Implement session tracking in activity execution
