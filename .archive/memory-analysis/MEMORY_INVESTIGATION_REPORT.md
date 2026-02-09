# Memory Investigation Report - metabob-opencode

**Date**: 2026-02-08  
**Investigated Process**: PID 1125740 (later 907409)  
**Status**: CRITICAL MEMORY LEAK IDENTIFIED

## Executive Summary

Discovered a **catastrophic memory leak** in the running metabob-opencode process with a growth rate of **1.5-2.2 GB/minute** (~85-130 GB/hour). Process was consuming memory at an exponential rate, reaching 2.5 GB in just 12 minutes before terminating.

## Memory Growth Timeline

| Time | RSS (MB) | Growth Rate | Threads | Status |
|------|----------|-------------|---------|--------|
| 22:30 | ~400 | Initial | 28 | Process started |
| 22:31 | 1,438 | ~1000 MB/min | 45 | Rapid growth began |
| 22:32 | 1,790 | N/A | 30 | Monitoring started |
| 22:32:20 | 2,174 | 2,267 MB/min | 28 | 🚨 Critical |
| 22:32:30 | 2,416 | 1,455 MB/min | 28 | 🚨 Critical |
| 22:32:40 | 2,660 | 1,460 MB/min | 36 | 🚨 Critical |
| 22:33+ | 2,538 | N/A | - | Terminated |

**Maximum Observed Growth Rate**: 2,267 MB/minute (132.86 GB/hour)

## Process Characteristics

### Original High-Memory Process (PID 907409)
- **Runtime**: 6 hours
- **Physical RAM**: 39.2 GB
- **Swap Usage**: 30.9 GB  
- **Total Memory Footprint**: **~70 GB**
- **Virtual Memory**: 155 GB
- **Heap Size**: 140 GB
- **Threads**: 28
- **CPU Usage**: 21%
- **File Descriptors**: 73 (normal)

### Recent Process (PID 1125740)
- **Runtime**: 12 minutes
- **Physical RAM**: 2.5 GB
- **Growth Rate**: 1.5-2.2 GB/min
- **Threads**: 28-45 (fluctuating)
- **CPU Usage**: 123-159%

## Root Cause Analysis

### Identified Issues

#### 1. Unbounded Map/Set Accumulation (HIGH PRIORITY)

**Location**: `repos/metabob-opencode/packages/opencode/src/session/context.ts`

**Problem**: Global Maps tracking session data without proper cleanup for active sessions:

```typescript
// Lines 10-39
const recentFiles = new Map<string, { files: Set<string>, lastUpdate: number }>()
const modifiedFiles = new Map<string, { files: Map<string, ...>, lastUpdate: number }>()
const currentPrompts = new Map<string, string>()
const sessionMetadata = new Map<string, { issuesSeen: Set<string>, ... }>()
```

**Issue**: These Maps grow unbounded for active sessions. Cleanup only runs every 5 minutes and only removes sessions older than 2 hours. An active session that runs for hours will accumulate unlimited data.

**Impact**:
- File paths accumulate in `recentFiles.files` Set
- Modified file tracking grows in `modifiedFiles.files` Map
- Issue tracking grows in `sessionMetadata.issuesSeen` Set
- Prompt strings stored in `currentPrompts`

#### 2. Message History Accumulation

**Location**: `repos/metabob-opencode/packages/opencode/src/session/message-v2.ts`

**Problem**: Messages are streamed but all accessed messages are tracked:

```typescript
// Line 748 in prompt.ts
for (const msg of msgs) {
  trackMessageAccess(msg.info.id)
}
```

**Issue**: Long-running sessions accumulate thousands of messages. Even with compaction, the tracking structures grow.

#### 3. Impulse Cache Growth

**Location**: `repos/metabob-opencode/packages/opencode/src/session/session-memory-manager.ts`

**Problem**: Impulse cache with limits but no aggressive cleanup:

```typescript
// Lines 24-29
private impulseCache = new Map<string, {
  impulse: ActivityTemplate.Impulse
  lastAccessed: number
  sessionIds: Set<string>
  tokenCount: number
}>()
```

**Config**: 
- `maxImpulseCache`: 1000 items
- `impulseMaxIdleMs`: 10 minutes
- `cleanupIntervalMs`: 5 minutes

**Issue**: Active sessions keep impulses alive, preventing cleanup. Cache can hold 1000 impulses × (token content size), potentially GBs of data.

#### 4. Metabob CLI Integration

**Observation**: metabob-cli process (PID 818114) running at 103% CPU during memory spike.

**Hypothesis**: Repeated Metabob API calls (issue search, annotations, impact analysis) create response objects that are not being garbage collected. Each call might be adding to an in-memory cache without bounds.

#### 5. LSP Integration (Pyright)

**Observation**: Pyright language server using 433 MB RAM and 31.9% CPU.

**Hypothesis**: Language server diagnostics and file analysis results being cached without limits.

## Concurrent Process Analysis

During investigation, found 79 files in codebase using `new Map` or `new Set`, indicating widespread use of in-memory caching.

## Immediate Fixes Required

### Priority 1: Active Session Cleanup (context.ts)

```typescript
// Add max size limits for active sessions
const MAX_FILES_PER_SESSION = 1000
const MAX_ISSUES_PER_SESSION = 500
const MAX_PROMPT_LENGTH = 10000

export function trackFileAccess(sessionID: string, filePath: string) {
  const s = state()
  let session = s.recentFiles.get(sessionID)
  
  if (!session) {
    session = { files: new Set(), lastUpdate: Date.now() }
    s.recentFiles.set(sessionID, session)
  }
  
  // CRITICAL FIX: Enforce max size
  if (session.files.size >= MAX_FILES_PER_SESSION) {
    // Remove oldest entries (FIFO)
    const files = Array.from(session.files)
    files.slice(0, 100).forEach(f => session.files.delete(f))
  }
  
  session.files.add(filePath)
  session.lastUpdate = Date.now()
}
```

### Priority 2: Aggressive Session Metadata Cleanup

```typescript
// In getSessionMetadata()
export function getSessionMetadata(sessionID: string): SessionMetadata {
  const s = state()
  let metadata = s.sessionMetadata.get(sessionID)
  
  if (!metadata) {
    metadata = {
      issuesSeen: new Set(),
      analysesDone: new Set(),
      patternsAsked: new Set(),
      lastUpdated: Date.now(),
    }
    s.sessionMetadata.set(sessionID, metadata)
  }
  
  // CRITICAL FIX: Limit Set sizes
  if (metadata.issuesSeen.size > MAX_ISSUES_PER_SESSION) {
    const issues = Array.from(metadata.issuesSeen)
    metadata.issuesSeen = new Set(issues.slice(-MAX_ISSUES_PER_SESSION))
  }
  
  return metadata
}
```

### Priority 3: More Frequent Cleanup

```typescript
// In context.ts line 377
// Change from 5 minutes to 1 minute for active monitoring
setInterval(() => {
  cleanup()
}, 60 * 1000) // Every 1 minute

// Also add emergency cleanup at memory thresholds
setInterval(() => {
  const stats = getMemoryStats()
  if (stats.estimatedMemoryKB > 500000) { // 500 MB
    log.warn("Memory pressure detected, forcing aggressive cleanup")
    cleanup(300000) // Clean sessions older than 5 minutes
  }
}, 30 * 1000) // Check every 30 seconds
```

### Priority 4: Message Access Tracking with LRU

The `trackMessageAccess()` function needs an LRU cache with max size:

```typescript
// In prompt.ts - add LRU with max 10000 entries
const messageAccessCache = new Map<string, number>()
const MAX_MESSAGE_TRACKING = 10000

function trackMessageAccess(messageId: string) {
  if (messageAccessCache.size >= MAX_MESSAGE_TRACKING) {
    // Remove oldest 20%
    const entries = Array.from(messageAccessCache.entries())
      .sort(([,a], [,b]) => a - b)
    entries.slice(0, Math.floor(MAX_MESSAGE_TRACKING * 0.2))
      .forEach(([id]) => messageAccessCache.delete(id))
  }
  messageAccessCache.set(messageId, Date.now())
}
```

### Priority 5: Impulse Cache Hard Limits

```typescript
// In session-memory-manager.ts
public registerImpulse(...) {
  // Before adding new impulse, check hard limit
  if (this.impulseCache.size >= this.config.maxImpulseCache) {
    // Force removal of oldest impulses
    const sorted = Array.from(this.impulseCache.entries())
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)
    
    const toRemove = Math.floor(this.config.maxImpulseCache * 0.2)
    sorted.slice(0, toRemove).forEach(([id]) => {
      this.impulseCache.delete(id)
    })
  }
  // ... rest of function
}
```

## Monitoring Recommendations

### Add Memory Monitoring Endpoint

```typescript
// In server.ts
app.get("/debug/memory", async (c) => {
  const sessionContext = SessionContext.getMemoryStats()
  const memoryManager = SessionMemoryManager.getInstance()
  
  return c.json({
    process: {
      rss: process.memoryUsage().rss / 1024 / 1024,
      heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
      heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
      external: process.memoryUsage().external / 1024 / 1024,
    },
    sessionContext,
    uptime: process.uptime(),
  })
})
```

### Add Automatic Restart on Memory Threshold

```typescript
// In index.ts or main entry
setInterval(() => {
  const usage = process.memoryUsage()
  const rssMB = usage.rss / 1024 / 1024
  
  if (rssMB > 10000) { // 10 GB
    log.error("Memory threshold exceeded, initiating graceful shutdown", { rssMB })
    process.exit(1) // Let process manager restart
  }
}, 60 * 1000)
```

## Testing Recommendations

1. **Load Test**: Run a session for 4+ hours with continuous activity
2. **Monitor**: Track `SessionContext.getMemoryStats()` every minute
3. **Verify**: Ensure cleanup actually removes old data
4. **Stress Test**: Multiple concurrent sessions (10+) with heavy file access

## Prevention Strategies

### Code Review Checklist

- [ ] All `new Map()` have maximum size limits
- [ ] All `new Set()` have maximum size limits
- [ ] Cleanup functions run at appropriate intervals
- [ ] Emergency cleanup triggers at memory thresholds
- [ ] WeakMap/WeakSet used where possible for auto-cleanup
- [ ] LRU caching for any unbounded access patterns

### Architectural Improvements

1. **Use WeakMap for session tracking** where possible
2. **Implement LRU caching** for all access tracking
3. **Add circuit breakers** for external API calls (Metabob, LSP)
4. **Implement backpressure** when memory exceeds thresholds
5. **Add memory profiling** in development builds

## Related Files

- `repos/metabob-opencode/packages/opencode/src/session/context.ts` - Primary issue
- `repos/metabob-opencode/packages/opencode/src/session/session-memory-manager.ts` - Impulse cache
- `repos/metabob-opencode/packages/opencode/src/session/message-v2.ts` - Message tracking
- `repos/metabob-opencode/packages/opencode/src/session/prompt.ts` - Message access tracking
- `repos/metabob-opencode/packages/opencode/src/file/time.ts` - File time tracking
- `repos/metabob-opencode/packages/opencode/src/server/server.ts` - Add monitoring endpoint

## Conclusion

The memory leak is caused by **unbounded accumulation in global Maps** tracking session state. Active sessions never trigger cleanup, allowing unlimited growth. The 1.5-2.2 GB/minute growth rate suggests an **active operation** (likely involving Metabob API calls or LSP queries) is creating thousands of objects per second without cleanup.

**Critical Action**: Implement hard limits on all Map/Set sizes immediately. Add memory monitoring and automatic cleanup thresholds.

**Timeline**:
- Priority 1-2 fixes: Implement today
- Priority 3-5 fixes: Implement this week
- Monitoring: Add immediately
- Testing: Before next production deployment
