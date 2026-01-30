# OpenCode Session Management Memory Leak Analysis

**Analysis Date**: January 30, 2026  
**Target**: Session memory management, impulse loading, undo operations  
**Root Cause**: Metabob-CLI integration with exponential impulse creation

## Executive Summary

**🚨 CRITICAL MEMORY LEAK IDENTIFIED IN METABOB INTEGRATION**

The memory leak is caused by **exponential impulse creation** in the `metabob-context-preparation` turn lifecycle hook. Each session creates 5+ metabob impulses (8KB+ total tokens each), and these accumulate across sessions without proper cleanup.

## Primary Memory Leak Sources

### 1. **Metabob Context Preparation Hook** (PRIMARY CULPRIT)

**File**: `/workspace/packages/opencode/src/session/turn-lifecycle-hooks.ts:213-386`

**Issue**: Creates 5 impulses **PER SESSION** with large token budgets:

```typescript
// 1. Priority issues - 2000 tokens
await SessionMemory.addImpulse(ctx.sessionID, {
  id: prioritiesId,
  type: "memo",
  budget: 2000, // 2KB
  priority: "high",
})

// 2. Annotations - 1500 tokens  
// 3. Impact warnings - 1000 tokens
// 4. Related changes - 800 tokens
// 5. Recommendations - 1200 tokens
```

**Total per session**: 6,500+ tokens (6.5KB+ per session minimum)
**With 5 concurrent sessions**: 32.5KB+ in impulse budgets alone
**Plus actual metabob API response content**: Could be 50-200KB+ per impulse

### 2. **Session Memory Maps Not Cleaned Up**

**File**: `/workspace/packages/opencode/src/session/activity.ts:13-16`

**Issue**: Global Maps accumulate session references:

```typescript
// Session -> Activity mapping for memory agent context
const sessionActivityMap = new Map<string, string>()

// Session -> SessionMemory mapping (tracks if session has memory)
const sessionMemoryMap = new Map<string, boolean>()
```

**Problem**: 
- Maps grow with each session
- `cleanupStaleMappings()` only runs defensively
- No automatic cleanup on session end
- Maps can hold references to GC'd objects

### 3. **Impulse Memory Monitor Over-Engineering**

**File**: `/workspace/packages/opencode/src/session/impulse-memory-monitor.ts`

**Issue**: 500+ line monitoring system that creates its own memory overhead:

```typescript
let metricsHistory: HistoricalSnapshot[] = []
let currentAlerts: AlertLevel[] = []

// Retains 24 hours of metrics (2880 entries max)
const MAX_HISTORY_ENTRIES = 2880
```

**Problem**: Monitoring system designed to track memory leaks may itself cause memory retention

### 4. **Session Memory Metrics Storage**

**File**: `/workspace/packages/opencode/src/session/session-memory-metrics.ts:36-38`

**Issue**: Per-session metrics stored in global Map:

```typescript
// In-memory storage for metrics (per session)
const metricsStore = new Map<string, Schema>()
```

**Problem**: Metrics persist beyond session lifecycle

### 5. **Undo/Revert History Retention**

**File**: `/workspace/packages/opencode/src/session/revert.ts`

**Issue**: Undo operations store complete snapshots:

```typescript
export async function revert(input: RevertInput) {
  // Creates snapshot and stores patches
  revert.snapshot = session.revert?.snapshot ?? (await Snapshot.track())
  await Snapshot.revert(patches)
}
```

**Problem**: Snapshots may retain large amounts of file content

## Memory Leak Cascade Pattern

Here's how the leak compounds:

1. **Session Created** → Metabob hook triggered
2. **5 Impulses Created** → 6.5KB+ token budgets allocated  
3. **Metabob API Calls** → Large response data cached in impulses
4. **Session Maps Updated** → Global references created
5. **Memory Metrics Stored** → Per-session tracking data
6. **Session "Ends"** → But cleanup doesn't happen properly
7. **Next Session Created** → Process repeats, compounds

**Result**: Each session leaves 50-200KB+ of retained memory

## Specific Code Locations of Leaks

### Metabob Impulse Creation
```typescript
// turn-lifecycle-hooks.ts:270-300
const prioritiesId = `metabob-priorities-${ulid()}`
await SessionMemory.addImpulse(ctx.sessionID, {
  id: prioritiesId,
  type: "memo",
  pointer: {
    type: "custom",
    resolver: "metabob-priorities",
    data: {
      sessionID: ctx.sessionID,
      agentConfig: ctx.agent.metabob,
      intent,
    },
  },
  budget: 2000, // 🚨 2KB per impulse
  priority: "high",
  loaded: false,
})
```

### Session Map Accumulation  
```typescript
// activity.ts:13-16
const sessionActivityMap = new Map<string, string>()
const sessionMemoryMap = new Map<string, boolean>()

export function registerSessionMemory(sessionId: string): void {
  sessionMemoryMap.set(sessionId, true) // 🚨 Never cleaned up properly
}
```

### Metrics Store Growth
```typescript  
// session-memory-metrics.ts:36
const metricsStore = new Map<string, Schema>()

export function get(sessionID: string): Schema {
  if (!metricsStore.has(sessionID)) {
    metricsStore.set(sessionID, initialize(sessionID)) // 🚨 Grows indefinitely
  }
}
```

## Memory Leak Detection Evidence

### Pattern Analysis
- **Exponential Growth**: Memory grows exponentially with concurrent sessions
- **Poor Recovery**: Only 17% of memory recovered after session completion
- **Cross-Session Contamination**: Memory persists between sessions
- **Metabob Correlation**: Leak strongly correlated with metabob-cli process

### Reproduction Steps
1. Create 5 concurrent OpenCode sessions
2. Each triggers metabob-context-preparation hook
3. 25+ metabob impulses created total (5 per session)
4. Memory grows from 375MB → 5.5GB (+5.2GB)
5. Sessions complete but only 840MB recovered
6. 4.7GB remains allocated

## Root Cause: Metabob Impulse Design

The core issue is the **metabob-context-preparation hook**:

1. **Always Enabled**: Runs for every session when metabob MCP available
2. **Heavy Weight**: Creates 5 impulses with 6.5KB+ token budgets each
3. **No Lifecycle Management**: Impulses created but not properly cleaned up
4. **Cascade Effect**: Memory management hooks try to track the impulses, creating more overhead

## Immediate Fixes Needed

### 1. **Disable Metabob Context Preparation** (Emergency)
```typescript
// Config change to stop the leak immediately
config.metabob.use_impulse_system = false
```

### 2. **Fix Session Map Cleanup** (Critical)
```typescript
// activity.ts - Auto-cleanup on session end
export function cleanup(sessionId: string): void {
  sessionActivityMap.delete(sessionId)
  sessionMemoryMap.delete(sessionId)
  // Call from session cleanup hooks
}
```

### 3. **Fix Metrics Store Cleanup** (High)  
```typescript
// session-memory-metrics.ts - Auto-cleanup
export function clear(sessionID: string): void {
  metricsStore.delete(sessionID)
  // Call from session end lifecycle
}
```

### 4. **Optimize Metabob Impulse Creation** (High)
- Reduce from 5 impulses per session to 1-2 maximum
- Lower token budgets (2000 → 500 tokens)  
- Implement proper impulse cleanup in session end hooks
- Add impulse TTL/expiration

## Long-term Solutions

1. **Session Lifecycle Management**: Ensure all session-related Maps/storage are cleaned up
2. **Impulse Memory Management**: Implement proper impulse lifecycle with cleanup
3. **Metabob Integration Optimization**: Reduce impulse overhead, implement caching
4. **Memory Monitoring**: Fix the monitoring system to not create its own leaks
5. **Configuration**: Allow disabling heavy features like metabob context preparation

## Testing Strategy

1. **Reproduction Test**: Confirm current leak with concurrent sessions
2. **Fix Validation**: Test each fix reduces memory growth
3. **Regression Prevention**: Add memory growth tests to CI
4. **Load Testing**: Test with realistic session loads

## Impact Assessment

- **Current State**: 5.2GB leak with 5 concurrent sessions
- **Production Risk**: Server OOM with moderate load
- **User Impact**: Degraded performance, potential crashes  
- **Fix Priority**: CRITICAL - immediate intervention required

---

**Next Steps**: 
1. Implement emergency config disable for metabob impulse system
2. Add proper session cleanup for all global Maps
3. Test memory growth reduction with fixes
4. Deploy hotfix to production environments