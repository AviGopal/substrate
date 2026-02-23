# Impulse Usage Tracking - Enforcement Complete

**Specification**: `impulse-usage-tracking`  
**Status**: ✅ ENFORCED  
**Date**: 2026-02-23  
**Impulse ID**: `enforcement-impulse-usage-tracking`

---

## Executive Summary

Successfully enforced the impulse-usage-tracking specification by closing **5 gaps** across **3 files**. All code changes applied, TypeScript compilation successful with zero errors.

### What Was Fixed

1. ✅ **CRITICAL**: Local usageStats now updated during impulse loading
2. ✅ **HIGH**: context_ratio now calculated and sent to backend
3. ✅ **HIGH**: Dual-write pattern implemented for local usageStats.totalCost
4. ✅ **HIGH**: tokens now sent as breakdown {input, output, cache}
5. ✅ **MEDIUM**: usageStats initialized for newly created impulses

### Learning System Impact

The learning system can now:
- Track which impulses are loaded most frequently (loadCount)
- Measure token consumption per impulse (totalTokens)
- Attribute costs to specific impulses (totalCost)
- Calculate context efficiency (context_ratio)
- Learn optimal context strategies (high success + low context_ratio)

---

## Changes Applied

### Phase 1: Critical UsageStats Update

**File**: `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts`  
**Component**: `loadImpulsesForTask`  
**Lines**: 95-100 (modified)

**Change Made**:
Added usageStats tracking after loading each impulse:
```typescript
const loadedImpulse = loadedImpulses[i]!

// Track impulse usage statistics for learning system
loadedImpulse.usageStats ??= {
  loadCount: 0,
  totalCost: 0,
  totalTokens: 0,
}
loadedImpulse.usageStats.loadCount++
loadedImpulse.usageStats.totalTokens += loadedImpulse.tokenCount || 0
loadedImpulse.usageStats.firstAccessedAt ??= Date.now()
loadedImpulse.usageStats.lastAccessedAt = Date.now()

activityImpulses[impulseIds[i]] = loadedImpulse
```

**Reason**: Enables the learning system to track HOW MANY times each impulse is loaded and HOW MUCH token budget it consumes. Without this, the system cannot learn which impulses are heavily used vs rarely used.

**Impact**: Low risk - local mutation before storing. Enables downstream UI and aggregation.

---

### Phase 2: Context Ratio Calculation

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Component**: `Backend reporting (reportExecutionStep)`  
**Lines**: 2577-2582 (inserted before reportExecutionStep call)

**Change Made**:
Added context_ratio calculation:
```typescript
// Calculate context_ratio for learning system (what % of tokens were impulse context)
const impulseTokens = (task.impulseReferences || [])
  .map((id) => _activity.impulses[id]?.tokenCount || 0)
  .reduce((sum, t) => sum + t, 0)
const contextRatio = tokens.input > 0 ? impulseTokens / tokens.input : 0
```

**Reason**: This is THE KEY METRIC for context optimization. A high context_ratio with high success rate means impulses are valuable. A high context_ratio with low success rate means we're wasting tokens on unhelpful context.

**Impact**: Low risk - pure calculation from existing data.

---

### Phase 2: Token Breakdown

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Component**: `Backend reporting (reportExecutionStep call)`  
**Lines**: 2584-2593 (modified)

**Change Made**:
Changed tokens from sum to breakdown:
```typescript
await MetabobCLI.reportExecutionStep({
  executionId: _activity.id,
  stepOrder,
  success: true,
  output: null,
  durationMs: duration,
  cost,
  tokens: {
    input: tokens.input,
    output: tokens.output,
    cache: tokens.cache || 0,
  },
  contextRatio,
  impulsesLoaded: task.impulseReferences || [],
  impulsesCreated,
})
```

**Reason**: Backend needs breakdown to distinguish prompt costs (input) from generation costs (output) and cached token savings (cache).

**Impact**: Medium risk - changes API contract, but backend already expects this format.

---

### Phase 3: UsageStats Initialization for Created Impulses

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Component**: `Task execution loop (after state delta)`  
**Lines**: 2557-2575 (inserted after line 2561)

**Change Made**:
Initialize usageStats for newly created impulses:
```typescript
// Initialize usageStats for newly created impulses
for (const impulseId of impulsesCreated) {
  const impulse = _activity.impulses[impulseId]
  if (impulse) {
    impulse.usageStats = {
      loadCount: 0,
      totalCost: 0,
      totalTokens: 0,
      firstAccessedAt: Date.now(),
      lastAccessedAt: Date.now(),
    }
  }
}
```

**Reason**: Ensures all impulses have usageStats structure initialized. Created impulses are outputs of task execution (e.g., analysis results).

**Impact**: Low risk - prevents null pointer errors in UI.

---

### Phase 3: Dual-Write Pattern

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Component**: `Local usageStats update (after backend report)`  
**Lines**: 2595-2604 (inserted after reportExecutionStep)

**Change Made**:
Update local usageStats after backend report:
```typescript
// Update local usageStats with cost attribution (dual-write pattern)
const costPerImpulse =
  cost / Math.max(task.impulseReferences?.length || 0, 1)
for (const impulseId of task.impulseReferences || []) {
  const impulse = _activity.impulses[impulseId]
  if (impulse?.usageStats) {
    impulse.usageStats.totalCost += costPerImpulse
  }
}
await Activity.save(_activity)
```

**Reason**: Implements dual-write so local state matches backend state. Enables cost attribution: which impulses are expensive vs cheap?

**Impact**: Low risk - updates local state after backend success.

---

### Phase 4: Function Signature Update

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`  
**Component**: `reportExecutionStep function signature`  
**Lines**: 907-917 (modified)

**Change Made**:
Updated function signature:
```typescript
export async function reportExecutionStep(stepData: {
  executionId: string
  stepOrder: number
  success: boolean
  output?: string | null
  durationMs: number
  cost: number
  tokens: {
    input: number
    output: number
    cache: number
  }
  contextRatio?: number
  impulsesLoaded: string[]
  impulsesCreated: string[]
}): Promise<boolean>
```

**Reason**: Function signature must match actual usage. Backend expects token breakdown.

**Impact**: Medium risk - changes signature, but we updated the only caller.

---

### Phase 4: MCP Call Update

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`  
**Component**: `reportExecutionStep MCP call`  
**Lines**: 929-943 (modified)

**Change Made**:
Updated backend payload:
```typescript
const result = await callMCPTool("report_execution_step", {
  execution_id: stepData.executionId,
  step_order: stepData.stepOrder,
  success: stepData.success,
  output: stepData.output,
  duration_ms: stepData.durationMs,
  cost: stepData.cost,
  tokens: {
    input: stepData.tokens.input,
    output: stepData.tokens.output,
    cache: stepData.tokens.cache,
  },
  context_ratio: stepData.contextRatio,
  impulses_loaded: stepData.impulsesLoaded,
  impulses_created: stepData.impulsesCreated,
})
```

**Reason**: Backend API expects tokens breakdown and context_ratio.

**Impact**: Low risk - backend already expects this format.

---

## Data Flow Verification

### Before Enforcement
```
Task Start
  → loadImpulsesForTask [❌ DOES NOT update usageStats]
  → Execute Task
  → Compute State Delta [❌ DOES NOT init usageStats for new impulses]
  → [❌ DOES NOT calculate context_ratio]
  → reportExecutionStep [❌ DOES NOT send context_ratio, wrong tokens format]
  → [❌ DOES NOT update local usageStats.totalCost]
  → Save Activity [❌ NO changes to save]
  → Aggregate Session State → Display in UI [❌ Shows zeros]
```

### After Enforcement
```
Task Start
  → loadImpulsesForTask [✅ NOW UPDATES usageStats.loadCount]
  → Execute Task
  → Compute State Delta [✅ NOW INITS usageStats for new impulses]
  → Calculate context_ratio [✅ NOW CALCULATED]
  → reportExecutionStep [✅ NOW SENDS context_ratio and tokens breakdown]
  → Update local usageStats.totalCost [✅ NOW UPDATES via dual-write]
  → Save Activity [✅ NOW PERSISTS changes]
  → Aggregate Session State → Display in UI [✅ WILL SHOW metrics]
```

---

## Gaps Closed

### Critical (1)
- ✅ usageStats updated during impulse loading (task-execution-shared.ts:98)

### High (3)
- ✅ context_ratio calculated and sent (activity.ts:2567)
- ✅ Local usageStats.totalCost updated after backend report (activity.ts:2577)
- ✅ tokens sent as breakdown instead of number (metabob.ts:914)

### Medium (1)
- ✅ usageStats initialized for newly created impulses (activity.ts:2561)

### Low (0)
- ✅ No gaps (session-state.ts works once upstream fixed)

---

## Build Status

✅ **SUCCESS** - TypeScript compilation completed with zero errors

---

## Testing Recommendations

1. **Unit Tests**:
   - Test `loadImpulsesForTask` updates usageStats correctly
   - Test context_ratio calculation with various impulse/token ratios
   - Test usageStats initialization for newly created impulses

2. **Integration Tests**:
   - Run activity with impulses and verify usageStats.loadCount increments
   - Verify context_ratio is calculated correctly (0-1 range)
   - Check UI displays non-zero loadCount, totalTokens, totalCost

3. **End-to-End Tests**:
   - Verify backend receives tokens breakdown and context_ratio
   - Test that newly created impulses have initialized usageStats
   - Verify dual-write: local state matches backend state

---

## Learning System Impact

### Enabled Capabilities
1. **Track which impulses are loaded most frequently** (loadCount)
2. **Measure token consumption per impulse** (totalTokens)
3. **Attribute costs to specific impulses** (totalCost)
4. **Calculate context efficiency** (context_ratio)
5. **Learn optimal context strategies** (high success + low context_ratio)
6. **Identify expensive impulses** (high totalCost)
7. **Optimize token budgets** based on actual usage

### Business Value
1. **Reduce token costs** by learning which context is actually useful
2. **Improve success rates** by identifying effective impulse combinations
3. **Enable template evolution** based on real usage data
4. **Provide visibility** into context usage patterns for developers
5. **Support data-driven decisions** about context selection

---

## References

- **Trace Impulse**: `trace-impulse-usage-tracking`
- **Specification**: `impulse-usage-tracking` from commit 1091779
- **Data Flow Diagram**: `docs/data-flows/impulse-usage-tracking-flow.md`

---

**End of Enforcement Summary**
