# Correctness Validation Debug Session

## Date
February 17, 2026

## Status
🔍 **DEBUGGING IN PROGRESS** - Evidence fields not appearing in saved activities

## What We Did

### 1. Implemented Phase 1.2 Fix ✅
- Added helper functions to activity.ts:
  - `getSessionMessageCount()` - Count messages in a session  
  - `getSessionToolCallCount()` - Count tool calls in a session
  
- Added session tracking after TaskTool.execute():
  - Extract sessionID from `taskResult.metadata.sessionId`
  - Record in `executionEvidence.sessionsSpawned`
  - Save activity with updated evidence
  - Added debug logging

- **Commit**: `0ac8ada0` - "fix(activity): Phase 1.2 - Move session tracking to correct execution path"

### 2. Testing Revealed Problem ❌
- Ran `ultra-simple-test` activity
- Inspected activity storage file
- **Result**: NO evidence fields present!
  - Missing: `executionEvidence`
  - Missing: `workArtifacts` 
  - Missing: `correctnessVerdict`

### 3. Investigation & Debug Logging
Added extensive debug logging to track field lifecycle:

**Activity.create()** (line 427):
```typescript
log.info("created activity", { 
  id, directory,
  hasExecutionEvidence: !!activity.executionEvidence,
  hasWorkArtifacts: !!activity.workArtifacts,
})
```

**Activity.save()** (line 442):
```typescript
log.debug("saving activity", {
  id,
  hasExecutionEvidence: !!cleanedActivity.executionEvidence,
  sessionsSpawnedCount: cleanedActivity.executionEvidence?.sessionsSpawned?.length ?? -1,
})
```

**Final save** in activity.ts (line 749):
```typescript
log.info("FINAL SAVE CHECK", {
  activityId, hasExecEvidence, hasWorkArtifacts, hasVerdict,
  sessionsCount: activity.executionEvidence?.sessionsSpawned?.length ?? -1,
})
```

- **Commits**: 
  - `7b7f03df` - "debug: Add logging to track evidence field lifecycle"
  - `46c37b76` - "debug: Add critical debug logging before final Activity.save()"

## Current Hypothesis

**Hypothesis 1**: Fields are initialized in Activity.create() but somehow lost before Activity.save()

**Hypothesis 2**: JSON.stringify() is stripping optional fields (DISPROVEN - manual test showed it works)

**Hypothesis 3**: cleanImpulsesForStorage() is stripping fields (UNLIKELY - uses spread operator `{...activity}`)

**Hypothesis 4**: Activity object is being reloaded from storage between create and save (NO EVIDENCE - no Activity.load() calls found)

## Evidence Collected

### Schema Definition ✅
```typescript
executionEvidence: z.object({...}).optional()
workArtifacts: z.object({...}).optional()
correctnessVerdict: z.object({...}).optional()
```

### Initialization Code ✅
```typescript
const activity: Info = {
  ...
  executionEvidence: { sessionsSpawned: [], toolCalls: [] },
  workArtifacts: { filesChanged: [], commitsMade: [] },
  correctnessVerdict: undefined,
}
```

### JSON Serialization Test ✅
Manual test confirmed JSON.stringify() preserves these fields correctly.

### Storage.write() ✅
Simple implementation: `Bun.write(target, JSON.stringify(content, null, 2))`
No transformation or Zod parsing.

### cleanImpulsesForStorage() ✅
Returns: `{ ...activity, impulses: cleanedImpulses }`
Preserves all fields via spread operator.

## Next Steps

1. **Run test activity with debug logs**
2. **Check logs for**:
   - "created activity" - verify fields exist at creation
   - "saving activity" - verify fields exist before storage write
   - "FINAL SAVE CHECK" - verify fields exist before final save
   - "tracked session" - verify session tracking code runs

3. **Possible outcomes**:
   - **If fields exist in logs but not in file**: Storage layer issue
   - **If fields missing from "created activity"**: TypeScript/initialization issue  
   - **If "tracked session" never appears**: Session tracking not running
   - **If fields in "saving activity" but not "FINAL SAVE CHECK"**: Lost between saves

## Files Modified

- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
  - Session tracking code (~48 lines)
  - Debug logging (3 locations)

- `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
  - Debug logging in create() and save()

## Test Command

```bash
# Use activity tool in session
activity({
  templateId: "ultra-simple-test",
  variables: {},
  reason: "Debug test for evidence collection"
})

# Then inspect:
ls -lt ~/.local/share/opencode/storage/activity/ | head -1
cat ~/.local/share/opencode/storage/activity/act_<latest>.json

# Check for fields:
node /tmp/test-evidence.js
```

## Key Insight

The root cause from previous session (evidence code in wrong location) was PARTIALLY fixed:
- ✅ Session tracking moved to activity.ts
- ✅ Code compiles successfully
- ❌ Evidence fields still not appearing in saved files

**New mystery**: Why are fields not persisting despite being initialized?

## Session End Status

**Status**: Debugging in progress  
**Next session**: Run test with debug logs and analyze output to pinpoint where fields are lost.
