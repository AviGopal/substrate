# Boredom Activity Detection Mechanism - Entry Points & Flow

## Executive Summary

The Boredom Activity Detection Mechanism is an autonomous system that detects idle OpenCode sessions and auto-executes improvement activities. Detection occurs through **multiple mechanisms** working together:

1. **Title Prefix Detection**: `[BOREDOM]` or `[MANUAL BOREDOM]` in activity titles
2. **Branch Name Detection**: `branch: "boredom-activity"` for auto-executed activities
3. **Reason Field Injection**: Activity `reason` field populated with boredom context
4. **Status Flag**: `isExecutingBoredomActivity` boolean in BoredomManager
5. **Stats API Integration**: Real-time boredom status exposed via stats command

**Key Finding**: There is **NO dedicated `is_boredom` field** in `Activity.Info` schema. Detection relies on **convention-based markers** (title prefix, branch name) rather than explicit database fields.

---

## Entry Point 1: Automatic Idle Detection (Primary Flow)

### File: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`

#### Entry Function: `checkIdleAndExecute()`
- **Line**: 156-197
- **Trigger**: Timer-based (30-second intervals)
- **Input Type**: `ManagerInstance` (session metadata)
- **Detection Logic**:
  ```typescript
  function isIdle(manager: ManagerInstance): boolean {
    const idleTime = Date.now() - manager.lastActivityTime
    return idleTime >= IDLE_THRESHOLD_MS // 5 minutes
  }
  ```

#### Execution Flow:
```
Entry Point: boredom-manager.ts:156
Function: checkIdleAndExecute()
Input Type: ManagerInstance { sessionID, lastActivityTime, isExecutingBoredomActivity }
Trigger: setInterval (30s) → checkIdleAndExecute()

Flow:
1. Check if session idle (5+ min since lastActivityTime)
2. Fetch boredom activities from backend API (fetchBoredomActivities:210)
3. Select highest priority activity
4. Execute via executeBoredomActivity(250-373)
5. Report results back to backend
```

#### Detection Markers Set During Execution:

**1. Title Prefix** (Line 291):
```typescript
const activity = await Activity.create({
  title: `[BOREDOM] ${template.name}`,  // ← DETECTION MARKER
  branch: "boredom-activity",           // ← DETECTION MARKER
  ...
})
```

**2. Reason Field** (Line 296):
```typescript
activity.reason = boredomActivity.reason  // ← Context injection
```

**3. Status Flag** (Line 189-195):
```typescript
manager.isExecutingBoredomActivity = true  // ← Runtime flag
await executeBoredomActivity(manager, topActivity)
manager.isExecutingBoredomActivity = false
```

---

## Entry Point 2: Manual Trigger (CLI Command)

### File: `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts`

#### Entry Function: `triggerBoredomMode()`
- **Line**: 580-660
- **Trigger**: CLI flag `--trigger-boredom`
- **Input Type**: User selection via interactive prompts
- **HTTP Method**: N/A (local execution)

#### Execution Flow:
```
Entry Point: stats.ts:580
Function: triggerBoredomMode()
Input Type: User selection from BoredomActivity[]
Trigger: CLI command with --trigger-boredom flag

Flow:
1. Fetch boredom activities from backend (metabob_fetch_boredom_activities)
2. Display interactive selection menu
3. User confirms activity
4. Create new session with title: `[MANUAL BOREDOM] ${template_id}`
5. Execute activity in new session
```

#### Detection Markers Set:

**Title Prefix** (Line 636):
```typescript
const session = await Session.createNext({
  title: `[MANUAL BOREDOM] ${selectedActivity.template_id}`,  // ← DETECTION MARKER
  directory: process.cwd(),
})
```

**Note**: Manual boredom does **NOT** set `branch: "boredom-activity"` (uses default session branch).

---

## Entry Point 3: Session Lifecycle Integration Points

### File: `repos/metabob-opencode/packages/opencode/src/session/index.ts`

#### Integration Point 1: Session Creation (Line 259)
```typescript
Entry Point: session/index.ts:259
Function: Session.create() → Session.Event.Created
Input Type: Session.Info
Trigger: Session creation event

BoredomManager.startMonitoring(result.id)
```

#### Integration Point 2: Session Deletion (Line 401)
```typescript
Entry Point: session/index.ts:401
Function: Session.Event.Closed
Input Type: sessionID (string)
Trigger: Session close event

BoredomManager.stopMonitoring(sessionID)
```

---

## Entry Point 4: Activity Tracking (Idle Timer Reset)

### File: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`

#### Integration Point: User Message Creation (Line 1215)
```typescript
Entry Point: prompt.ts:1215
Function: createUserMessage()
Input Type: PromptInput
Trigger: User sends message to session

BoredomManager.trackActivity(input.sessionID)
```

**Effect**: Resets `lastActivityTime` to prevent boredom trigger while user is active.

---

## Entry Point 5: Real-Time Status Display

### File: `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts`

#### API Functions: `getBoredomStatus()` (Line 390-426)
```typescript
Entry Point: stats.ts:390
Function: getBoredomStatus()
Input Type: None
Trigger: `opencode stats` command
Output Type: BoredomStatus {
  isMonitoring: boolean,
  isIdle: boolean,
  isExecutingBoredom: boolean,
  currentActivity?: string,
  idleTimeMs?: number,
  availableBoredomTasks?: number
}
```

#### Display Logic (Line 501-520):
```typescript
// Boredom Status Panel
console.log(renderRow("Monitoring", boredomStatus.isMonitoring ? "✓ Active" : "○ Inactive"))
console.log(renderRow("Status", boredomStatus.isIdle ? "💤 Idle" : "⚡ Active"))

if (boredomStatus.isExecutingBoredom && boredomStatus.currentActivity) {
  console.log(renderRow("Current Task", boredomStatus.currentActivity))
}
```

---

## Detection Mechanisms Summary

### 1. Title Prefix Detection

**Markers**:
- `[BOREDOM]` - Auto-executed activities
- `[MANUAL BOREDOM]` - Manually triggered activities

**Location**: `Activity.title` field

**Usage**:
- Set during activity creation (boredom-manager.ts:291, stats.ts:636)
- **NOT validated** in Activity schema (just a string field)
- Detection must use string matching: `activity.title.includes('[BOREDOM]')`

---

### 2. Branch Name Detection

**Marker**: `branch: "boredom-activity"`

**Location**: `Activity.branch` field

**Usage**:
- Set only for **auto-executed** boredom activities (boredom-manager.ts:289)
- Manual boredom activities use default session branch
- Can be used to distinguish auto vs manual: 
  ```typescript
  const isAutoBoredom = activity.branch === "boredom-activity"
  ```

---

### 3. Reason Field Context Injection

**Marker**: `activity.reason = boredomActivity.reason`

**Location**: `Activity.reason` field (optional string)

**Content Example**:
```
"Template 'debug-auth-failures' has 35% success rate with 12 failures in last 
3 days. Analyzing failure patterns could improve reliability."
```

**Usage**:
- Populated from backend API response (boredom-manager.ts:296)
- Provides human-readable context for why activity was selected
- **NOT a boolean flag** - just descriptive text

---

### 4. Status Flag (Runtime Only)

**Marker**: `isExecutingBoredomActivity: boolean`

**Location**: `BoredomManager.ManagerInstance` (in-memory only)

**Usage**:
- Prevents concurrent boredom activity execution
- Checked before starting new boredom activity (boredom-manager.ts:158)
- Exposed via `getStatus()` API for stats display
- **NOT persisted** to database (lost on process restart)

---

### 5. Stats API Exposure

**Entry Point**: `BoredomManager.getStatus()` / `getAllStatus()`

**Type**: `BoredomStatus` interface (stats.ts:55-62)

**Fields**:
```typescript
interface BoredomStatus {
  isMonitoring: boolean        // Is session being monitored?
  isIdle: boolean              // Is session currently idle?
  isExecutingBoredom: boolean  // Is boredom activity running?
  currentActivity?: string     // Activity ID if executing
  idleTimeMs?: number          // How long idle
  availableBoredomTasks?: number
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

## Gap Analysis: Current vs Desired Behavior

### Current Detection Capabilities

✅ **Working**:
1. Title prefix `[BOREDOM]` reliably set during auto-execution
2. Branch name `boredom-activity` set for auto-executed activities
3. Reason field populated with backend context
4. Runtime flag `isExecutingBoredomActivity` tracks live execution
5. Stats command displays real-time boredom status

❌ **Gaps**:
1. **No database field** for `is_boredom` flag in `Activity.Info` schema
2. **No persistent marker** distinguishing boredom vs normal activities after execution
3. **No validation** enforcing title prefix consistency
4. **Manual boredom activities** don't set `branch: "boredom-activity"` (inconsistent)
5. **No tracking** of boredom activity lineage (which activities were spawned from boredom vs user request)

---

### Validation Requirements (Based on User Request)

**User Goal**: "Systematic trace of how OpenCode detects when a boredom activity is running"

**Current State**:
- ✅ **Detection during execution**: `isExecutingBoredomActivity` flag works
- ✅ **Detection via title**: String matching `[BOREDOM]` works
- ✅ **Detection via branch**: Checking `branch === "boredom-activity"` works (auto only)
- ❌ **Detection after completion**: No persistent field in database
- ❌ **Validation enforcement**: No schema enforcement of markers

**Recommended Detection Logic** (for validation/enforcement):
```typescript
function isBoredomActivity(activity: Activity.Info): boolean {
  // Method 1: Title prefix (most reliable)
  if (activity.title.startsWith('[BOREDOM]') || activity.title.startsWith('[MANUAL BOREDOM]')) {
    return true
  }
  
  // Method 2: Branch name (auto-executed only)
  if (activity.branch === 'boredom-activity') {
    return true
  }
  
  // Method 3: Reason field heuristic (less reliable)
  if (activity.reason?.includes('success rate') || activity.reason?.includes('failure patterns')) {
    return true  // Likely boredom-generated reason
  }
  
  return false
}
```

---

## Enforcement Task Requirements

### For Systematic Validation:

**Task 1: Add Database Field** (if needed for enforcement)
- Add `Activity.Info.isBoredom: boolean` field to schema (activity.ts:200-356)
- Set during activity creation in boredom-manager.ts:291
- Persist to storage for post-execution detection

**Task 2: Validation Enforcement**
- Validate that title prefix matches `isBoredom` flag
- Enforce `branch: "boredom-activity"` for auto-executed activities
- Add schema constraint: `isBoredom = true` → title must start with `[BOREDOM]` or `[MANUAL BOREDOM]`

**Task 3: Manual Boredom Consistency**
- Fix manual boredom to set `branch: "boredom-activity"` (stats.ts:636)
- Or distinguish with `branch: "manual-boredom-activity"`

**Task 4: Metrics & Tracking**
- Track boredom activity count in stats
- Display boredom activities separately in dashboard
- Filter activities by `isBoredom` flag in activity list

---

## Related Files & Components

### Core Implementation Files:
1. `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` (Primary)
2. `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts` (CLI + Manual Trigger)
3. `repos/metabob-opencode/packages/opencode/src/session/activity.ts` (Schema)
4. `repos/metabob-opencode/packages/opencode/src/session/index.ts` (Lifecycle)
5. `repos/metabob-opencode/packages/opencode/src/session/prompt.ts` (Activity Tracking)

### Backend API Integration:
1. `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py` (Backend Types)
2. MCP Tools:
   - `metabob_fetch_boredom_activities` (Fetch prioritized work)
   - `metabob_post_activity_result` (Report execution results)

### Test Files (Documentation):
1. `test-boredom-idle-detection.ts` (Idle detection tests)
2. `test-activity-reset-idle-timer.ts` (Activity tracking tests)
3. `test-session-lifecycle-boredom.ts` (Lifecycle integration tests)
4. `test-boredom-idle-in-docker.ts` (Container integration tests)

---

## Conclusion

**Key Findings**:
1. Boredom detection is **convention-based** (title prefix, branch name) not **schema-enforced**
2. Detection works reliably during execution via `isExecutingBoredomActivity` flag
3. Post-execution detection requires string matching on `title` or `branch` fields
4. No persistent database field for `is_boredom` flag (gap for validation/enforcement)

**Next Steps for Enforcement**:
1. Decide if persistent `isBoredom` flag needed (vs relying on conventions)
2. Implement validation logic to detect inconsistencies
3. Add enforcement constraints to prevent mismarked activities
4. Update manual boredom flow for consistency with auto-executed flow
