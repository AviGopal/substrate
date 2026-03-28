# Impulse Usage Tracking - Trace Analysis

**Specification**: `impulse-usage-tracking`  
**Status**: ⚠️ PARTIALLY IMPLEMENTED  
**Traced**: 2026-02-23  
**Impulse ID**: `trace-impulse-usage-tracking`

---

## Executive Summary

### Specification Description
All task executions must track impulse loading and creation to learn optimal context strategies. Records:
- `impulses_loaded` (array of impulse IDs)
- `impulses_created` (array of new impulse IDs)  
- `context_ratio` (context tokens / total tokens) per task

This enables the learning system to understand what context is useful for task success.

### Expected Behavior
Every task execution PATCHes `/api/v1/tasks/:id` with:
- `impulses_loaded`: Non-empty array when impulses used
- `impulses_created`: Array when new impulses created
- `context_ratio`: Number between 0-1 representing context efficiency

### Current State vs Desired State

#### ✅ What's Working
1. Backend receives `impulses_loaded` and `impulses_created` arrays
2. Impulse IDs are correctly tracked during task execution
3. State delta computation detects newly created impulses
4. UsageStats schema is defined in `ActivityTemplate.Impulse`

#### ❌ What's Broken
1. **CRITICAL**: Local `usageStats` never updated (loadCount, totalCost, totalTokens always 0)
2. **HIGH**: `context_ratio` not calculated or sent to backend
3. **HIGH**: `tokens` sent as single number instead of `{input, output, cache}` breakdown
4. **MEDIUM**: UI shows empty impulse usage (filtered out because loadCount is 0)

---

## Component Analysis

### Component 1: Impulse Loading
**File**: `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts`  
**Lines**: 71-129  
**Component**: `loadImpulsesForTask`

**Current Behavior**:
- Loads impulses in parallel using `ImpulseResolver`
- Updates `activityImpulses` dict with loaded content
- **DOES NOT** update `usageStats`

**Desired Behavior**:
- After loading each impulse, update:
  - `usageStats.loadCount++`
  - `usageStats.totalTokens += tokenCount`
  - Set `firstAccessedAt`/`lastAccessedAt` timestamps

**Gap**: CRITICAL - Missing usageStats update after line 98

**Fix Location**: After line 98: `activityImpulses[impulseIds[i]] = loadedImpulses[i]!`

**Fix Code**:
```typescript
const loadedImpulse = loadedImpulses[i]!
loadedImpulse.usageStats ??= { loadCount: 0, totalCost: 0, totalTokens: 0 }
loadedImpulse.usageStats.loadCount++
loadedImpulse.usageStats.totalTokens += loadedImpulse.tokenCount || 0
loadedImpulse.usageStats.firstAccessedAt ??= Date.now()
loadedImpulse.usageStats.lastAccessedAt = Date.now()
activityImpulses[impulseIds[i]] = loadedImpulse
```

---

### Component 2: Created Impulse Initialization
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines**: 2557-2561  
**Component**: Task execution loop (after state delta)

**Current Behavior**:
- Detects newly created impulses via set difference
- **DOES NOT** initialize `usageStats` for new impulses

**Desired Behavior**:
- After detecting created impulses, initialize `usageStats` with:
  - `loadCount: 0`
  - `totalCost: 0`
  - `totalTokens: 0`
  - Timestamps

**Gap**: MEDIUM - Missing usageStats initialization

**Fix Location**: After line 2561 (after computing `impulsesCreated` array)

**Fix Code**:
```typescript
for (const impulseId of impulsesCreated) {
  const impulse = _activity.impulses[impulseId]
  if (impulse) {
    impulse.usageStats = {
      loadCount: 0,
      totalCost: 0,
      totalTokens: 0,
      firstAccessedAt: Date.now(),
      lastAccessedAt: Date.now()
    }
  }
}
```

---

### Component 3: Context Ratio Calculation
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines**: 2567-2577  
**Component**: Backend reporting (`reportExecutionStep`)

**Current Behavior**:
- Reports: `executionId`, `stepOrder`, `success`, `durationMs`, `cost`, `tokens` (as number), `impulsesLoaded`, `impulsesCreated`
- **DOES NOT** send `context_ratio`
- **DOES NOT** update local `usageStats` after backend report

**Desired Behavior**:
- Calculate `context_ratio = impulse_tokens / total_input_tokens`
- Send to backend
- After backend report, update local `usageStats.totalCost` for each impulse

**Gap**: HIGH - Missing `context_ratio` calculation and local `usageStats.totalCost` update

**Fix Location**: Before line 2567 (before `reportExecutionStep` call)

**Fix Code (context_ratio)**:
```typescript
const impulseTokens = (task.impulseReferences || [])
  .map(id => _activity.impulses[id]?.tokenCount || 0)
  .reduce((sum, t) => sum + t, 0)
const contextRatio = tokens.input > 0 ? impulseTokens / tokens.input : 0
```

---

### Component 4: Local UsageStats Update (Dual-Write)
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines**: 2577 (after `reportExecutionStep`)  
**Component**: Local usageStats update

**Current Behavior**:
- **DOES NOT** update local `usageStats` after backend report completes

**Desired Behavior**:
- After backend report, distribute task cost across used impulses
- Update `usageStats.totalCost`

**Gap**: HIGH - Missing dual-write pattern (backend updated, local not updated)

**Fix Location**: After line 2577 (after `reportExecutionStep` call, inside try block)

**Fix Code**:
```typescript
const costPerImpulse = cost / Math.max(task.impulseReferences?.length || 0, 1)
for (const impulseId of task.impulseReferences || []) {
  const impulse = _activity.impulses[impulseId]
  if (impulse?.usageStats) {
    impulse.usageStats.totalCost += costPerImpulse
  }
}
await Activity.save(_activity)
```

---

### Component 5: Backend Reporting Function
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`  
**Lines**: 907-969  
**Component**: `reportExecutionStep` function

**Current Behavior**:
- Accepts `tokens` as `number`
- **DOES NOT** accept `context_ratio` parameter

**Desired Behavior**:
- Accept `tokens` as `{input, output, cache}` breakdown
- Accept `context_ratio` parameter
- Send both to backend

**Gap**: HIGH - Missing `context_ratio` parameter, incorrect `tokens` type

**Fix Location**: Line 914 (function parameter type)

**Fix Code**:
```typescript
// Change parameter type:
tokens: { input: number; output: number; cache: number }
contextRatio?: number

// Update MCP call:
tokens: {
  input: stepData.tokens.input,
  output: stepData.tokens.output,
  cache: stepData.tokens.cache
},
context_ratio: stepData.contextRatio
```

---

### Component 6: Session State Aggregation
**File**: `repos/metabob-opencode/packages/opencode/src/session/session-state.ts`  
**Lines**: 726-775 (estimated)  
**Component**: Impulse usage aggregation

**Current Behavior**:
- Reads `usageStats` from impulses
- Aggregates across activities
- Filters out impulses with `loadCount=0` (which is everything!)

**Desired Behavior**:
- Should work correctly once upstream components write to `usageStats`

**Gap**: LOW - No gap, just depends on upstream fixes

**Fix**: None needed - will work once upstream components fixed

---

## Data Flow

```
Task Start
  ↓
loadImpulsesForTask [UPDATE usageStats.loadCount] ← FIX HERE (Component 1)
  ↓
Execute Task
  ↓
Compute State Delta [INIT usageStats for new impulses] ← FIX HERE (Component 2)
  ↓
Calculate context_ratio ← FIX HERE (Component 3)
  ↓
reportExecutionStep to backend [SEND context_ratio] ← FIX HERE (Component 5)
  ↓
Update local usageStats.totalCost ← FIX HERE (Component 4)
  ↓
Save Activity
  ↓
Aggregate Session State (Component 6)
  ↓
Display in UI
```

---

## Gap Summary

### Critical Gaps (Block Specification)
1. **usageStats never updated during impulse loading** (task-execution-shared.ts:98)

### High Priority Gaps (Specification Incomplete)
1. **context_ratio not calculated or sent** (activity.ts:2567)
2. **Local usageStats.totalCost not updated after backend report** (activity.ts:2577)
3. **tokens sent as number instead of breakdown** (metabob.ts:914)

### Medium Priority Gaps (Degrades Quality)
1. **usageStats not initialized for newly created impulses** (activity.ts:2561)

### Low Priority Gaps
None

---

## Implementation Plan

### Phase 1: Fix Critical UsageStats Update
**Files**: `task-execution-shared.ts`

**Changes**:
- After line 98, update `usageStats` for loaded impulse before storing in `activityImpulses` dict

**Impact**: Enables `loadCount` and `totalTokens` tracking

---

### Phase 2: Add Context Ratio Calculation
**Files**: `activity.ts`, `metabob.ts`

**Changes**:
1. Calculate `context_ratio` before `reportExecutionStep`
2. Add `contextRatio` parameter to `reportExecutionStep` function
3. Send `context_ratio` to backend via MCP

**Impact**: Enables learning system to measure impulse effectiveness

---

### Phase 3: Implement Dual-Write Pattern
**Files**: `activity.ts`

**Changes**:
1. After `reportExecutionStep`, update local `usageStats.totalCost`
2. Initialize `usageStats` for newly created impulses

**Impact**: Enables UI to show correct impulse usage metrics

---

### Phase 4: Fix Tokens Type
**Files**: `metabob.ts`, `activity.ts`

**Changes**:
1. Change `tokens` parameter from `number` to `{input, output, cache}`
2. Update call site to pass tokens breakdown instead of sum

**Impact**: Enables backend to distinguish prompt costs from generation costs

---

## Test Strategy

### Unit Tests
- Test `loadImpulsesForTask` updates `usageStats` correctly
- Test `context_ratio` calculation with various impulse/token ratios
- Test `usageStats` initialization for newly created impulses

### Integration Tests
- Test full activity execution with impulse tracking
- Test session state aggregation shows correct usage metrics
- Test UI displays impulse usage correctly

### End-to-End Tests
- Run activity with impulses, verify backend receives `context_ratio`
- Run activity, verify UI shows non-zero `loadCount`/`totalCost`/`totalTokens`

---

## Success Criteria

1. ✅ `usageStats.loadCount` increments each time impulse is loaded
2. ✅ `usageStats.totalTokens` accumulates correctly
3. ✅ `usageStats.totalCost` distributed across used impulses
4. ✅ `context_ratio` calculated and sent to backend (0-1 range)
5. ✅ UI displays non-empty impulse usage list with correct metrics
6. ✅ Backend receives `tokens` as `{input, output, cache}` breakdown

---

## References

1. **Data Flow Documentation**: `docs/data-flows/impulse-usage-tracking-flow.md`
   - Comprehensive data flow analysis from `trace-data-flow-single-feature` activity

2. **Original Commit**: `1091779`
   - Emphasized tracking impulse usage to learn optimal context strategies

3. **Related Components**:
   - `src/session/task-execution-shared.ts` - Impulse loading
   - `src/tool/activity.ts` - Activity execution orchestration
   - `src/util/metabob.ts` - Backend integration
   - `src/session/session-state.ts` - State aggregation
   - `src/session/activity-template.ts` - Schema definitions

---

## Impulse Metadata

```json
{
  "id": "trace-impulse-usage-tracking",
  "type": "specificationTrace",
  "pointer": {
    "type": "file",
    "path": "TRACE_IMPULSE_USAGE_TRACKING.json"
  },
  "budget": 5000,
  "priority": "high",
  "createdAt": "2026-02-23"
}
```

This impulse will be used by downstream validation and enforcement tasks to:
- Validate current implementation against specification
- Enforce missing components
- Track compliance status
- Generate test cases
- Create implementation tasks

---

**End of Trace Analysis**
