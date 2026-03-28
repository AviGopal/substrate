# Fix Recommendations

Based on the execution analysis of `act_mmbwcb81_dd331205160df377`, the root cause is a **session tracking inconsistency** where the activity framework's `executionEvidence` tracking failed to record session spawning and tool calls, even though the work was completed successfully.

## Immediate Fixes (Apply Now)

### Fix 1: Ensure executionEvidence is Always Initialized on Load

**Problem**: When an activity is loaded from storage (backend or local), the `executionEvidence` field may be missing if the activity was created by an older version of the code or loaded from a backend that doesn't include this field.

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Location**: After line 555 in the `load()` function, before returning the activity

**Change**: Add defensive initialization for missing fields:

```typescript
// Line ~555, after loading activity and before cache warming
if (!activity) {
  throw localError
}

// NEW CODE: Ensure executionEvidence exists (defensive initialization)
if (!activity.executionEvidence) {
  log.warn("activity loaded without executionEvidence, initializing", {
    activityId: id,
    source: "load",
  })
  activity.executionEvidence = {
    sessionsSpawned: [],
    toolCalls: [],
  }
}

// NEW CODE: Ensure workArtifacts exists
if (!activity.workArtifacts) {
  log.warn("activity loaded without workArtifacts, initializing", {
    activityId: id,
    source: "load",
  })
  activity.workArtifacts = {
    filesChanged: [],
    commitsMade: [],
  }
}

// If activity has session IDs, warm SessionMemory cache from storage
// ... (existing code continues)
```

**Why**: This ensures that even if an activity is loaded from storage without these fields (due to schema evolution or backend inconsistencies), the tracking structures are always present. The current code at line 1241 of `template-executor.ts` checks `if (_activity.executionEvidence)` - if this field is missing, tracking silently fails.

---

### Fix 2: Track Session Creation Immediately When Spawned

**Problem**: Sessions are added to `sessionsSpawned` only AFTER task execution completes (line 1252 in template-executor.ts). If the task fails or is interrupted, the session is never recorded.

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Location**: In `executeTask` function, BEFORE calling `executeViaSubagent` (around line 1228)

**Change**: Track session spawning at the START of execution, not just at completion:

```typescript
// Line ~1228, BEFORE executeViaSubagent call
log.debug("executing task via subagent", {
  taskId: task.id,
  subagent: task.subagent,
  // ... existing log fields
})

// NEW CODE: Track session spawn at START (not just at end)
if (_activity.executionEvidence) {
  const existingSession = _activity.executionEvidence.sessionsSpawned.find(s => s.sessionID === sessionID)
  
  if (!existingSession) {
    _activity.executionEvidence.sessionsSpawned.push({
      sessionID,
      taskId: task.id,
      agentType: task.subagent,
      startTime: startedAt,
      endTime: undefined, // Will be updated on completion
      messageCount: 0,    // Will be updated on completion
      toolCallCount: 0,   // Will be updated on completion
    })
    
    // Save immediately so correctness validation sees the session
    await Activity.save(_activity)
    
    log.debug("tracked session spawn at start", {
      sessionID,
      taskId: task.id,
      agentType: task.subagent,
    })
  }
}

// Execute via subagent (in the provided session with optional parent context)
const result = await executeViaSubagent(
  // ... existing call
)
```

**Why**: This ensures sessions are tracked even if task execution fails or is interrupted. The current code only tracks sessions at completion (line 1252), which means if a task fails, crashes, or is cancelled, the session never gets recorded in `sessionsSpawned`, leading to the "no-work" false negative.

---

### Fix 3: Remove Conditional Check for executionEvidence (Make it Mandatory)

**Problem**: The code at line 1241 checks `if (_activity.executionEvidence)` before tracking. This makes tracking optional, which can fail silently.

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Location**: Line 1241 in `executeTask` function

**Change**: Replace conditional check with assertion:

```typescript
// Line ~1238, after executeViaSubagent completes
const completedAt = Date.now()

// OLD CODE (line 1241):
// if (_activity.executionEvidence) {
//   // Track session execution...
// }

// NEW CODE: Assert executionEvidence exists (fail fast if missing)
if (!_activity.executionEvidence) {
  const error = new Error("Activity missing executionEvidence field - this is a critical bug")
  log.error("missing executionEvidence", {
    activityId: _activity.id,
    taskId: task.id,
    sessionID,
  })
  throw error
}

// Track session execution for correctness validation (now guaranteed to exist)
const existingSession = _activity.executionEvidence.sessionsSpawned.find(s => s.sessionID === sessionID)

if (existingSession) {
  // Update existing session with completion info
  existingSession.endTime = completedAt
  existingSession.messageCount = await getSessionMessageCount(sessionID)
  existingSession.toolCallCount = await getSessionToolCallCount(sessionID)
} else {
  // This should not happen if Fix 2 is applied, but keep as fallback
  log.warn("session not found in sessionsSpawned at completion, adding now", {
    sessionID,
    taskId: task.id,
  })
  _activity.executionEvidence.sessionsSpawned.push({
    sessionID,
    taskId: task.id,
    agentType: task.subagent,
    startTime: startedAt,
    endTime: completedAt,
    messageCount: await getSessionMessageCount(sessionID),
    toolCallCount: await getSessionToolCallCount(sessionID),
  })
}

// Track individual tool calls... (rest of existing code)
```

**Why**: Failing fast with a clear error message is better than silently skipping tracking. This makes the bug visible immediately rather than manifesting as a false "no-work" failure later in correctness validation.

---

### Fix 4: Improve Correctness Validation Error Messages

**Problem**: The error "No agent sessions spawned" is misleading when sessions exist in `sessionIDs` but not in `executionEvidence.sessionsSpawned`. This makes debugging harder.

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-correctness.ts`

**Location**: Around the line that checks `sessionsSpawned.length`

**Change**: Cross-reference multiple sources of truth:

```typescript
// Find the code that generates "no-work" category error
const sessionsSpawned = activity.executionEvidence?.sessionsSpawned?.length || 0

if (sessionsSpawned === 0) {
  // NEW CODE: Check for tracking inconsistency
  const sessionIDsCount = activity.sessionIDs?.length || 0
  
  if (sessionIDsCount > 0) {
    // Tracking bug: sessions exist but weren't tracked
    issues.push({
      severity: "critical",
      category: "tracking-bug",
      message: `Session tracking inconsistency: ${sessionIDsCount} sessions in sessionIDs but ${sessionsSpawned} in executionEvidence.sessionsSpawned. This indicates a bug in the activity framework's session tracking.`
    })
  } else {
    // Original check: truly no sessions
    issues.push({
      severity: "critical",
      category: "no-work",
      message: "No agent sessions spawned - activity may not have done any work"
    })
  }
}
```

**Why**: This distinguishes between "no work was done" (user issue) vs. "work was done but tracking failed" (system bug), making root cause analysis much easier.

---

### Fix 5: Add Schema Migration for Existing Activities

**Problem**: Activities created before `executionEvidence` was added may not have this field, causing crashes or silent failures when loaded.

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Location**: In the `Info` schema definition (add migration helper)

**Change**: Add a migration function that normalizes loaded activities:

```typescript
// Add near the Activity.Info schema definition
export function migrateActivitySchema(activity: any): Info {
  // Ensure executionEvidence exists
  if (!activity.executionEvidence) {
    activity.executionEvidence = {
      sessionsSpawned: [],
      toolCalls: [],
    }
  }
  
  // Ensure workArtifacts exists
  if (!activity.workArtifacts) {
    activity.workArtifacts = {
      filesChanged: [],
      commitsMade: [],
    }
  }
  
  // Ensure correctnessVerdict is undefined if not computed
  if (!activity.correctnessVerdict) {
    activity.correctnessVerdict = undefined
  }
  
  return activity as Info
}

// Then update load() function to use migration:
export async function load(id: string): Promise<Info> {
  // ... existing load code ...
  
  if (!activity) {
    throw localError
  }
  
  // NEW CODE: Migrate schema before using activity
  activity = migrateActivitySchema(activity)
  
  // ... rest of existing code (cache warming, etc.)
}
```

**Why**: Ensures backward compatibility with activities created by older code versions. Prevents crashes and silent tracking failures when loading legacy activities.

---

## Template Improvements (For Next Version)

### Improvement 1: Add Validation Step to Check File Contents

**Current Issue**: The template validates that files exist (`requiredFiles`) and that patterns exist in the file (`requiredPatterns`), but if validation isn't executed due to tracking failure, the success is not recognized.

**Enhancement**: Add explicit validation commands that return exit code 0 on success:

```json
{
  "validation": {
    "requiredFiles": [
      "/tmp/activity-template-{{templateId}}/REQUIREMENTS.md"
    ],
    "requiredPatterns": [
      {
        "pattern": "## Workflow Steps",
        "description": "Requirements must include workflow steps section"
      }
    ],
    "commands": [
      {
        "command": "test -f /tmp/activity-template-{{templateId}}/REQUIREMENTS.md",
        "expected_exit_code": 0,
        "description": "REQUIREMENTS.md file must exist"
      },
      {
        "command": "grep -q '## Workflow Steps' /tmp/activity-template-{{templateId}}/REQUIREMENTS.md",
        "expected_exit_code": 0,
        "description": "File must contain Workflow Steps section"
      }
    ]
  }
}
```

**Benefit**: Command-based validation runs independently of tracking and provides explicit pass/fail signals.

---

### Improvement 2: Add Health Check Task at Start

**Enhancement**: Add a no-op "health check" task at the beginning that just verifies the activity framework is working:

```json
{
  "id": "verify-framework",
  "subagent": "general",
  "description": "Verify activity framework is operational",
  "dependencies": [],
  "prompt": {
    "template": "Write the text 'Framework operational' to /tmp/activity-template-{{templateId}}/HEALTH.txt",
    "maxTokens": 1000,
    "variables": []
  },
  "validation": {
    "requiredFiles": ["/tmp/activity-template-{{templateId}}/HEALTH.txt"],
    "requiredPatterns": [{"pattern": "Framework operational"}],
    "commands": []
  }
}
```

**Benefit**: If this simple task fails, it indicates a framework problem rather than a template problem, making diagnosis faster.

---

### Improvement 3: Reduce Dependence on Internal Tracking

**Enhancement**: Instead of relying on `executionEvidence` for validation, use file system artifacts as the source of truth:

- After each task, write a marker file: `/tmp/activity-template-{{templateId}}/.task-{{taskId}}-complete`
- Validation checks for existence of these marker files
- If markers exist but `executionEvidence` is empty, it's clearly a tracking bug, not a work failure

**Benefit**: Decouples work verification from framework internals, making activities more resilient to tracking bugs.

---

## System Fixes (Infrastructure Level)

### Fix 6: Add Activity Framework Integration Tests

**Problem**: The tracking bug wasn't caught before deployment because there are no tests that verify `executionEvidence` is populated correctly.

**File**: Create new test file `repos/metabob-opencode/packages/opencode/src/session/__tests__/activity-tracking.test.ts`

**Test Cases**:

```typescript
import { describe, test, expect } from "bun:test"
import { Activity } from "../activity"
import { TemplateExecutor } from "../template-executor"

describe("Activity Execution Tracking", () => {
  test("executionEvidence.sessionsSpawned is populated", async () => {
    const template = {
      id: "test-template",
      name: "Test Template",
      tasks: [
        {
          id: "task-1",
          subagent: "general",
          prompt: { template: "Write 'hello' to /tmp/test.txt" },
          validation: { requiredFiles: ["/tmp/test.txt"] },
        },
      ],
    }
    
    const result = await TemplateExecutor.execute({
      templateId: template.id,
      variables: {},
    })
    
    const activity = await Activity.load(result.activityId)
    
    expect(activity.executionEvidence).toBeDefined()
    expect(activity.executionEvidence.sessionsSpawned.length).toBeGreaterThan(0)
    expect(activity.sessionIDs.length).toBe(activity.executionEvidence.sessionsSpawned.length)
  })
  
  test("executionEvidence.toolCalls is populated", async () => {
    // Similar test checking tool calls are tracked
  })
  
  test("activity.sessionIDs matches executionEvidence.sessionsSpawned", async () => {
    // Verify consistency between the two tracking mechanisms
  })
  
  test("activity created with Activity.create has executionEvidence", async () => {
    const activity = await Activity.create({
      directory: process.cwd(),
      branch: "test",
      baseCommit: "HEAD",
      title: "Test Activity",
    })
    
    expect(activity.executionEvidence).toBeDefined()
    expect(activity.executionEvidence.sessionsSpawned).toEqual([])
    expect(activity.executionEvidence.toolCalls).toEqual([])
  })
  
  test("activity loaded from storage has executionEvidence", async () => {
    // Create activity, save, reload, verify fields preserved
  })
})
```

**Benefit**: Catches tracking bugs in CI/CD before deployment, preventing false negatives in production.

---

### Fix 7: Add Runtime Invariant Checks

**Problem**: The tracking inconsistency went unnoticed until correctness validation ran at the end.

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Location**: Add checks at key points during execution

**Change**: Add assertions that fail fast when invariants are violated:

```typescript
// Add helper function at top of file
function assertActivityInvariants(activity: Activity.Info, context: string) {
  if (!activity.executionEvidence) {
    throw new Error(`${context}: activity missing executionEvidence`)
  }
  
  if (!activity.workArtifacts) {
    throw new Error(`${context}: activity missing workArtifacts`)
  }
  
  // Check consistency between tracking mechanisms
  const sessionIdCount = activity.sessionIDs.length
  const spawnedCount = activity.executionEvidence.sessionsSpawned.length
  
  if (sessionIdCount > spawnedCount) {
    log.warn(`${context}: tracking inconsistency detected`, {
      activityId: activity.id,
      sessionIDs: sessionIdCount,
      sessionsSpawned: spawnedCount,
    })
  }
}

// Call after key operations:
// - After creating activity
// - After loading activity
// - After completing each task
// - Before starting validation
```

**Benefit**: Catches tracking bugs immediately when they occur, not hours later during validation, making debugging much easier.

---

## Testing Strategy

### Test 1: Verify Fix 1 (Defensive Initialization)

**Test**: Load an old activity JSON that lacks `executionEvidence` field

**Steps**:
1. Create activity JSON manually without `executionEvidence`
2. Save to storage
3. Call `Activity.load(id)`
4. Verify `activity.executionEvidence` is initialized

**Expect**: Activity loads successfully with `executionEvidence` initialized to empty arrays, no crashes.

---

### Test 2: Verify Fix 2 (Track Session at Start)

**Test**: Simulate task failure after session spawn

**Steps**:
1. Create template with task that throws error
2. Execute template
3. Check activity record after failure

**Expect**: `executionEvidence.sessionsSpawned` contains the session even though task failed.

---

### Test 3: Verify Fix 3 (Fail Fast on Missing executionEvidence)

**Test**: Force a scenario where `executionEvidence` is missing

**Steps**:
1. Temporarily remove defensive initialization from Fix 1
2. Load activity without `executionEvidence`
3. Try to execute task

**Expect**: Clear error thrown immediately: "Activity missing executionEvidence field - this is a critical bug"

---

### Test 4: Verify Fix 4 (Better Error Messages)

**Test**: Create activity with session in `sessionIDs` but not in `executionEvidence`

**Steps**:
1. Create activity, add session ID manually to `sessionIDs`
2. Don't add to `executionEvidence.sessionsSpawned`
3. Run correctness validation

**Expect**: Error message: "Session tracking inconsistency: 1 sessions in sessionIDs but 0 in executionEvidence"

---

### Test 5: End-to-End Success Case

**Test**: Run the exact same template/variables that failed before

**Steps**:
1. Apply all fixes
2. Execute template with variables:
   - templateName: "Push PR and Deploy Pipeline"
   - templateId: "push-pr-and-deploy-pipeline"
   - category: "infrastructure"
3. Check activity status

**Expect**: 
- Activity status: "completed" (not "failed")
- `executionEvidence.sessionsSpawned.length` equals `sessionIDs.length`
- `executionEvidence.toolCalls.length` > 0
- Correctness validation passes
- All 4 tasks complete successfully

---

## Priority Order

**Critical (Do Immediately)**:
1. Fix 1 - Defensive initialization (prevents crashes)
2. Fix 2 - Track sessions at start (fixes false negatives)
3. Fix 5 - Schema migration (backward compatibility)

**High (Do Soon)**:
1. Fix 3 - Fail fast on missing fields (better debugging)
2. Fix 4 - Better error messages (easier diagnosis)
3. Fix 6 - Integration tests (prevent regressions)

**Medium (Do Next Sprint)**:
1. Fix 7 - Runtime invariant checks (proactive detection)
2. Improvement 1 - Better template validation
3. Improvement 3 - Reduce tracking dependence

**Low (Nice to Have)**:
1. Improvement 2 - Health check tasks

---

## Validation Checklist

After applying fixes, verify:

- [ ] Existing activities load without errors
- [ ] New activities have `executionEvidence` initialized
- [ ] Sessions tracked in both `sessionIDs` and `executionEvidence.sessionsSpawned`
- [ ] Tool calls recorded in `executionEvidence.toolCalls`
- [ ] Correctness validation passes for successful activities
- [ ] Error messages distinguish between tracking bugs and actual failures
- [ ] Integration tests pass in CI/CD
- [ ] Re-run failed activity `act_mmbwcb81_dd331205160df377` successfully

---

## Root Cause Summary

The bug occurred because:

1. **Schema Evolution Gap**: `executionEvidence` was added to the schema but not defensively initialized when loading old activities
2. **Late Tracking**: Sessions were tracked AFTER completion, not at spawn time, so failures left no evidence
3. **Silent Failure**: Conditional check `if (executionEvidence)` made tracking optional, failing silently
4. **Misleading Errors**: Validation error "no-work" didn't distinguish between "no work done" vs "work done but not tracked"

The fix strategy:

1. **Defensive Programming**: Always initialize required fields, never assume they exist
2. **Eager Tracking**: Track events when they happen, not when they complete
3. **Fail Fast**: Make required fields mandatory, throw errors immediately when missing
4. **Better Observability**: Clear error messages that point to root cause
5. **Test Coverage**: Catch these bugs in CI/CD before production

These fixes will prevent this entire class of tracking bugs from causing false negatives in the future.
