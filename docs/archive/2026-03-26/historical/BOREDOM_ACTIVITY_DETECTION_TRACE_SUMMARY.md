# Boredom Activity Detection Mechanism - Trace Summary

## Executive Summary

The Boredom Activity Detection Mechanism in OpenCode uses **convention-based markers** rather than explicit schema fields to identify boredom activities. Detection works through five mechanisms operating together, but there are critical gaps in validation, consistency, and persistence.

**Key Finding**: No persistent `isBoredom` field exists in the `Activity.Info` schema. Detection relies entirely on string-based markers (title prefix, branch name) that are set by convention but not enforced by schema validation.

---

## Specification Overview

**Name**: Boredom Activity Detection Mechanism

**Purpose**: Enable OpenCode to detect when a boredom activity is running for:
1. User visibility (stats command)
2. System coordination (prevent concurrent execution)
3. Activity tracking (distinguish autonomous vs user-initiated work)
4. Metrics reporting (Learning Loop feedback)

**Expected Behavior**: Boredom activities should be detectable through:
1. Activity title prefix `[BOREDOM]` or `[MANUAL BOREDOM]`
2. BoredomManager.isExecutingBoredomActivity flag
3. BoredomManager.getStatus() API
4. Activity.reason field containing boredom context
5. Activity branch `boredom-activity`
6. Stats command real-time display

---

## Component Analysis

### 1. checkIdleAndExecute() - Entry Point

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:156-197`

**Current Behavior**:
- Timer-based polling (30-second intervals)
- Checks if session idle (5+ minutes since last user activity)
- Fetches prioritized boredom activities from backend via MCP
- Executes highest priority activity

**Desired Behavior**:
- Should set all detection markers consistently
- Should validate marker consistency before and after execution

**Gap**:
- No validation that markers are set consistently
- Debug `[EVIDENCE_TEST]` prefix interferes with title detection (activity.ts:443)
- No persistent `isBoredom` field in Activity.Info schema
- No tracking of boredom activity lineage

---

### 2. executeBoredomActivity() - Core Orchestrator

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:250-373`

**Current Behavior**:
- Creates activity with `[BOREDOM]` title prefix
- Sets `branch: "boredom-activity"`
- Populates `reason` field with backend explanation
- Sets `isExecutingBoredomActivity` flag (in-memory)
- Executes template via `executeActivityInline()`
- Reports results to backend via MCP

**Desired Behavior**:
- All boredom activities should have consistent detection markers
- Should be identifiable post-execution via persistent field

**Gap**:
- Failed activities left in `"setup"` status (orphaned)
- No cleanup on failure (no status update to `"failed"`)
- No persistent `isBoredom` boolean field
- Manual boredom activities don't set branch name consistently

---

### 3. Activity.create() - Factory & Persistence

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:388-456`

**Current Behavior**:
- Creates activity with provided `branch` and `title`
- **Adds `[EVIDENCE_TEST]` prefix** at line 443 (debug code)
- Persists immediately to storage
- Publishes `Activity.Event.Created` event

**Desired Behavior**:
- Should preserve detection markers without interference
- Optionally enforce `isBoredom` field via schema validation

**Gap**:
- **Critical Bug**: Debug code adds `[EVIDENCE_TEST]` prefix breaking boredom detection
  - Result: `activity.title` becomes `"[EVIDENCE_TEST] [BOREDOM] ..."` 
  - String matching for `startsWith('[BOREDOM]')` fails
- No schema validation for boredom markers
- No `isBoredom` field in Activity.Info

**Fix Required**: Remove or conditionalize line 443:
```typescript
// Before (BREAKS DETECTION):
activity.title = `[EVIDENCE_TEST] ${activity.title}`

// After (RECOMMENDED):
if (process.env.DEBUG_EVIDENCE) {
  activity.title = `[EVIDENCE_TEST] ${activity.title}`
}
```

---

### 4. triggerBoredomMode() - Manual Trigger

**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts:580-660`

**Current Behavior**:
- CLI command `opencode stats --trigger-boredom`
- Fetches boredom activities from backend
- User selects activity interactively
- Creates new session with `[MANUAL BOREDOM]` title prefix
- **Does NOT set `branch: "boredom-activity"`** (uses default session branch)

**Desired Behavior**:
- Should set same markers as auto-executed boredom activities for consistency

**Gap**:
- **Inconsistency**: Manual boredom activities don't set `branch: "boredom-activity"`
- No unified marker injection function
- Distinction between auto vs manual lost (only title prefix differs)

**Fix Required**: Update stats.ts:636:
```typescript
// Before (INCONSISTENT):
const session = await Session.createNext({
  title: `[MANUAL BOREDOM] ${selectedActivity.template_id}`,
  directory: process.cwd(),
})

// After (CONSISTENT):
const session = await Session.createNext({
  title: `[MANUAL BOREDOM] ${selectedActivity.template_id}`,
  directory: process.cwd(),
  branch: "boredom-activity",  // ← Add this
})
```

---

### 5. getBoredomStatus() - Real-Time Status API

**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts:390-426`

**Current Behavior**:
- Exposes `BoredomStatus` interface:
  ```typescript
  {
    isMonitoring: boolean        // Is session being monitored?
    isIdle: boolean              // Is session currently idle?
    isExecutingBoredom: boolean  // Is boredom activity running?
    currentActivity?: string     // Activity ID if executing
    idleTimeMs?: number          // How long idle
    availableBoredomTasks?: number
  }
  ```
- Used by stats command for real-time display
- Read-only API (no mutations)

**Desired Behavior**:
- Should provide real-time detection status for running activities

**Gap**:
- Works correctly for runtime detection ✅
- No historical tracking (cannot query past boredom activities)
- Status lost on process restart (in-memory only)

---

### 6. BoredomManager.ManagerInstance - State Tracking

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:45-52`

**Current Behavior**:
- In-memory state per session:
  ```typescript
  {
    sessionID: string
    lastActivityTime: number
    isExecutingBoredomActivity: boolean  // ← Detection flag
    currentActivity?: { activityId, abortController }
    intervalHandle?: NodeJS.Timeout
  }
  ```
- Stored in `Map<string, ManagerInstance>`

**Desired Behavior**:
- Should track runtime execution state
- Should prevent concurrent boredom activities

**Gap**:
- **Memory Leak**: Sessions never cleaned up from Map (Issue #7)
- State lost on restart (no persistence)
- No timeout on activity execution (could hang forever)

**Fix Required**: Add cleanup in `stopMonitoring()`:
```typescript
export function stopMonitoring(sessionID: string): void {
  const manager = sessionManagers.get(sessionID)
  if (manager?.intervalHandle) {
    clearInterval(manager.intervalHandle)
  }
  sessionManagers.delete(sessionID)  // ← Add this to prevent leak
}
```

---

## Detection Mechanisms Summary

### 1. Title Prefix Detection

**Marker**: `[BOREDOM]` or `[MANUAL BOREDOM]`

**Location**: `Activity.title` field

**Current State**: ⚠️ **BROKEN by debug code**
- Debug code at activity.ts:443 adds `[EVIDENCE_TEST]` prefix
- Resulting title: `"[EVIDENCE_TEST] [BOREDOM] ..."`
- String matching `activity.title.startsWith('[BOREDOM]')` fails

**Validation**: None (string matching only, no schema enforcement)

**Recommendation**: Remove debug code or make conditional

---

### 2. Branch Name Detection

**Marker**: `"boredom-activity"`

**Location**: `Activity.branch` field

**Current State**: ⚠️ **INCONSISTENT**
- Auto-executed boredom: Sets `branch: "boredom-activity"` ✅
- Manual boredom: Uses default session branch ❌

**Validation**: None (convention-based, no schema enforcement)

**Usage**:
```typescript
const isAutoBoredom = activity.branch === "boredom-activity"
```

**Recommendation**: Update manual boredom to set consistent branch name

---

### 3. Reason Field Context Injection

**Marker**: `activity.reason = boredomActivity.reason`

**Location**: `Activity.reason` field (optional string)

**Current State**: ✅ **WORKS**
- Populated from backend API response
- Example: `"Template 'debug-auth-failures' has 35% success rate..."`

**Validation**: None (just descriptive text, not a boolean flag)

**Recommendation**: Keep as-is (provides useful context)

---

### 4. Runtime Flag

**Marker**: `isExecutingBoredomActivity: boolean`

**Location**: `BoredomManager.ManagerInstance` (in-memory only)

**Current State**: ✅ **WORKS for runtime detection**
- Prevents concurrent boredom activity execution
- Checked before starting new boredom activity
- Exposed via `getStatus()` API for stats display

**Validation**: Single source of truth for runtime state

**Gap**: Not persisted to database (lost on process restart)

**Recommendation**: Keep for runtime detection, add persistent field for historical tracking

---

### 5. Stats API Exposure

**Marker**: `BoredomStatus` interface

**Location**: `BoredomManager.getStatus()` / `getAllStatus()`

**Current State**: ✅ **WORKS correctly**

**Type**:
```typescript
interface BoredomStatus {
  isMonitoring: boolean
  isIdle: boolean
  isExecutingBoredom: boolean
  currentActivity?: string
  idleTimeMs?: number
  availableBoredomTasks?: number
}
```

**Recommendation**: Keep as-is (works correctly for real-time status)

---

### 6. Persistent Field (MISSING)

**Marker**: `Activity.Info.isBoredom` (does not exist)

**Location**: Activity.Info schema

**Current State**: ❌ **MISSING**
- No persistent field in schema
- Cannot query or filter boredom activities post-execution
- Must rely on string matching title/branch

**Gap**: Critical for historical tracking and filtering

**Recommendation**: Add to schema:
```typescript
export namespace Activity {
  export const Info = z.object({
    // ... existing fields
    isBoredom: z.boolean().optional(),  // ← Add this
    initiatedBy: z.enum(["user", "boredom-auto", "boredom-manual"]).optional(),  // ← Optional: Track lineage
  })
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOREDOM DETECTION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

  User Activity                Session Lifecycle
       │                             │
       │                             │
       ├─ User sends message ────────┼─ trackActivity()
       │                             │   └─ Reset lastActivityTime
       │                             │
       │                             ├─ Session created
       │                             │   └─ startMonitoring()
       │                             │       └─ setInterval(30s) ───┐
       │                             │                               │
       │                             │                               ▼
       │                             │                  ┌────────────────────┐
       │                             │                  │  checkIdleAndExecute │
       │                             │                  └────────────────────┘
       │                             │                               │
       │                             │                               ├─ isIdle?
       │                             │                               │   └─ Check lastActivityTime
       │                             │                               │
       │                             │                               ├─ Fetch boredom activities
       │                             │                               │   └─ MCP: metabob_fetch_boredom_activities
       │                             │                               │
       │                             │                               ├─ Select top priority
       │                             │                               │
       │                             │                               ▼
       │                             │                  ┌────────────────────────┐
       │                             │                  │ executeBoredomActivity │
       │                             │                  └────────────────────────┘
       │                             │                               │
       │                             │                               ├─ Set markers:
       │                             │                               │   • title: "[BOREDOM] ..."
       │                             │                               │   • branch: "boredom-activity"
       │                             │                               │   • reason: "..."
       │                             │                               │   • isExecutingBoredomActivity = true
       │                             │                               │
       │                             │                               ├─ Execute activity
       │                             │                               │   └─ executeActivityInline()
       │                             │                               │
       │                             │                               ├─ Report results
       │                             │                               │   └─ MCP: metabob_post_activity_result
       │                             │                               │
       │                             │                               └─ isExecutingBoredomActivity = false
       │                             │
       │                             ├─ Session closed
       │                             │   └─ stopMonitoring()
       │                             │       └─ clearInterval()
       │                             │
       ▼                             ▼
```

---

## Validation Gaps & Recommendations

### Gap 1: No isBoredom Field in Schema (HIGH PRIORITY)

**Issue**: Cannot query or filter boredom activities after execution completes

**Impact**: 
- Historical tracking impossible
- Filtering in UI/reports requires string matching
- No reliable way to distinguish boredom vs user activities post-execution

**Recommendation**: Add persistent field to schema:
```typescript
export const Info = z.object({
  // ... existing fields
  isBoredom: z.boolean().optional(),
  initiatedBy: z.enum(["user", "boredom-auto", "boredom-manual"]).optional(),
})
```

**Implementation**:
1. Add fields to Activity.Info schema
2. Set in `executeBoredomActivity()`: `activity.isBoredom = true`
3. Set in `triggerBoredomMode()`: `activity.isBoredom = true`
4. Add migration to update existing activities (optional)

---

### Gap 2: Debug Prefix Breaks Detection (HIGH PRIORITY)

**Issue**: `[EVIDENCE_TEST]` prefix added at activity.ts:443 breaks title detection

**Impact**: 
- `activity.title.startsWith('[BOREDOM]')` returns false
- Boredom activities undetectable via title matching
- Manual validation/enforcement tools will fail

**Current Code**:
```typescript
// activity.ts:443
activity.title = `[EVIDENCE_TEST] ${activity.title}`
```

**Recommendation**: Remove or conditionalize:
```typescript
// Option 1: Remove entirely (RECOMMENDED)
// Remove line 443

// Option 2: Make conditional (if debugging needed)
if (process.env.DEBUG_EVIDENCE) {
  activity.title = `[EVIDENCE_TEST] ${activity.title}`
}
```

---

### Gap 3: Manual Boredom Inconsistent with Auto (MEDIUM PRIORITY)

**Issue**: Manual boredom activities don't set `branch: "boredom-activity"`

**Impact**:
- Inconsistent detection logic
- Cannot reliably distinguish auto vs manual via branch alone
- Branch-based filtering misses manual boredom activities

**Recommendation**: Update stats.ts:636:
```typescript
const session = await Session.createNext({
  title: `[MANUAL BOREDOM] ${selectedActivity.template_id}`,
  directory: process.cwd(),
  branch: "boredom-activity",  // ← Add this
})
```

---

### Gap 4: No Schema Enforcement of Markers (MEDIUM PRIORITY)

**Issue**: Could create activities with `[BOREDOM]` title but no branch, or vice versa

**Impact**: Data inconsistency, unreliable detection

**Recommendation**: Add validation function:
```typescript
function validateBoredomMarkers(activity: Activity.Info): void {
  const hasPrefix = activity.title.includes('[BOREDOM]')
  const hasBranch = activity.branch === 'boredom-activity'
  const hasFlag = activity.isBoredom === true
  
  // All markers should be consistent
  if (hasPrefix && !hasBranch) {
    throw new Error('Activity with [BOREDOM] prefix must use boredom-activity branch')
  }
  if (hasBranch && !hasPrefix) {
    throw new Error('Activity on boredom-activity branch must have [BOREDOM] prefix')
  }
  if (hasFlag && (!hasPrefix || !hasBranch)) {
    throw new Error('Activity with isBoredom=true must have consistent markers')
  }
}
```

Call in:
- `Activity.create()` after marker injection
- `Activity.save()` before persistence

---

### Gap 5: No Cleanup of Failed Activities (MEDIUM PRIORITY)

**Issue**: Storage fills with orphaned activities in `"setup"` status

**Impact**: 
- Disk space waste
- Misleading metrics (appear as incomplete activities)
- Debugging confusion

**Recommendation**: Update boredom-manager.ts catch block:
```typescript
catch (error) {
  log.error("Boredom activity execution failed", { error })
  activity.status = "failed"  // ← Add this
  activity.error = error.message  // ← Add this
  await Activity.save(activity)  // ← Add this
} finally {
  manager.isExecutingBoredomActivity = false
}
```

---

### Gap 6: No Memory Cleanup (MEDIUM PRIORITY)

**Issue**: Sessions never cleaned up from `sessionManagers` Map (memory leak)

**Impact**: Long-running processes accumulate sessions, increasing memory usage

**Recommendation**: Update stopMonitoring():
```typescript
export function stopMonitoring(sessionID: string): void {
  const manager = sessionManagers.get(sessionID)
  if (manager?.intervalHandle) {
    clearInterval(manager.intervalHandle)
  }
  sessionManagers.delete(sessionID)  // ← Add this
}
```

---

## Recommended Detection Logic

### Current State (Unreliable)

```typescript
// CURRENT (BROKEN by debug code)
function isBoredomActivity(activity: Activity.Info): boolean {
  return activity.title.startsWith('[BOREDOM]') || activity.title.startsWith('[MANUAL BOREDOM]')
  // ↑ FAILS due to [EVIDENCE_TEST] prefix
}
```

### Recommended (Multi-Method)

```typescript
function isBoredomActivity(activity: Activity.Info): boolean {
  // Method 1: Persistent field (RECOMMENDED if added to schema)
  if (activity.isBoredom === true) {
    return true
  }
  
  // Method 2: Title prefix (fallback, works if debug code removed)
  if (activity.title.includes('[BOREDOM]')) {
    return true
  }
  
  // Method 3: Branch name (auto-executed only, not manual)
  if (activity.branch === 'boredom-activity') {
    return true
  }
  
  return false
}
```

---

## Code Quality Issues Identified

### HIGH Severity

1. **Bug: Debug prefix breaks detection** (activity.ts:443)
   - Impact: Boredom activities undetectable via title matching
   - Fix: Remove or conditionalize `[EVIDENCE_TEST]` prefix

2. **Resource Leak: Sessions never cleaned up** (boredom-manager.ts:45-52)
   - Impact: Memory leak in long-running processes
   - Fix: Delete sessions from Map in `stopMonitoring()`

### MEDIUM Severity

3. **Data Consistency: Failed activities orphaned** (boredom-manager.ts:250-373)
   - Impact: Storage fills with incomplete activities
   - Fix: Update status to "failed" in catch block

4. **Inconsistency: Manual boredom missing branch** (stats.ts:636)
   - Impact: Detection logic inconsistent
   - Fix: Add `branch: "boredom-activity"` to manual trigger

---

## Architectural Boundaries

### 1. Repository Boundary: metabob-opencode ↔ metabob-cli (MCP)

- **Type**: Repository Boundary
- **Coupling**: Loose (MCP protocol)
- **Resilience**: Graceful degradation on failure
- **Gaps**: No versioning, no retry logic, no circuit breaker

### 2. Layer Boundary: BoredomManager ↔ Activity Service

- **Type**: Layer Boundary
- **Coupling**: Medium (typed interface)
- **Resilience**: Try-catch with finally block
- **Gaps**: Orphaned activities on failure, no status update

### 3. Event Boundary: Activity ↔ Event Bus

- **Type**: Event Boundary (pub/sub)
- **Coupling**: Loose (pub/sub pattern)
- **Resilience**: Non-blocking publish
- **Gaps**: Subscriber errors crash other subscribers

### 4. Data Store Boundary: Storage ↔ File System

- **Type**: Data Store Boundary
- **Coupling**: Tight (direct fs dependency)
- **Resilience**: Error propagation
- **Gaps**: No optimistic locking, no distributed support

---

## Next Steps for Validation & Enforcement

### Phase 1: Fix Critical Bugs (Immediate)

1. Remove debug `[EVIDENCE_TEST]` prefix (activity.ts:443)
2. Add memory cleanup in `stopMonitoring()` (boredom-manager.ts)
3. Update failed activity status (boredom-manager.ts catch block)

### Phase 2: Add Persistent Field (Short-term)

1. Add `isBoredom` field to Activity.Info schema
2. Set field in `executeBoredomActivity()` and `triggerBoredomMode()`
3. Update detection logic to use persistent field first

### Phase 3: Enforce Consistency (Medium-term)

1. Add validation function `validateBoredomMarkers()`
2. Call validation in `Activity.create()` and `Activity.save()`
3. Update manual boredom to set consistent markers

### Phase 4: Create Validation Harness (Long-term)

1. Scan all activities in storage
2. Identify inconsistencies (title without branch, etc.)
3. Report validation failures
4. Optionally auto-fix inconsistencies

---

## Related Documentation

Generated by trace-data-flow-single-feature activity:

1. **BOREDOM_DETECTION_MECHANISM_TRACE.md** - Entry points and flow
2. **BOREDOM_DETECTION_COMPONENT_ANNOTATIONS.md** - Component design decisions
3. **BOREDOM_DETECTION_ARCHITECTURAL_BOUNDARIES.md** - Integration points and resilience
4. **BOREDOM_DETECTION_DATA_TRANSFORMATIONS.md** - Data flow transformations
5. **BOREDOM_ACTIVITY_DEPENDENCY_CHAIN.md** - CPG dependency analysis
6. **BOREDOM_DETECTION_CODE_QUALITY_ISSUES.md** - Code quality findings

---

## Impulse Summary

**Impulse ID**: `trace-boredom-activity-detection-mechanism`

**Type**: `templateDefinition`

**Budget**: 5000 tokens

**Content**: Full trace analysis (this document + JSON data structure)

**Usage**: 
- Downstream validation tasks can load this impulse
- Enforcement tasks can reference detection logic
- Template improvements can use architectural insights

---

## Conclusion

The Boredom Activity Detection Mechanism uses **convention-based markers** (title prefix, branch name, reason field, runtime flag) rather than explicit schema enforcement. This approach works for runtime detection but has critical gaps:

1. **No persistent field** for post-execution identification
2. **Debug code breaks detection** via title prefix
3. **Inconsistent markers** between auto and manual boredom
4. **No validation** to enforce marker consistency
5. **No cleanup** of failed activities

**Recommended Priority**:
1. Fix critical bugs (debug prefix, memory leak) - **IMMEDIATE**
2. Add persistent `isBoredom` field - **SHORT-TERM**
3. Enforce consistency (validation, manual boredom markers) - **MEDIUM-TERM**
4. Create validation harness - **LONG-TERM**
