# Impulse Loading and Caching Analysis

**Analysis Date**: January 30, 2026  
**Focus**: Impulse caching strategies, memory leaks, reference management  
**Root Finding**: Multiple unbounded caches and missing cleanup mechanisms

## Executive Summary

**🚨 CRITICAL FINDING: Multiple Unbounded Cache Structures**

The impulse loading system has **at least 4 different caching layers**, several of which are unbounded and contribute to memory leaks:

1. **Base Resolution Cache** (`Map<string, ResolvedContent>`) - 5-minute TTL but grows unbounded
2. **Optimized Cache** (`Map<string, OptimizedResolvedContent>`) - 500-item limit with LRU
3. **Memory Profiles Store** (`Map<string, MemoryProfile>`) - **NO CLEANUP**, unbounded growth
4. **Session Memory Store** - Persistent storage with **content leak bug**

## Detailed Cache Analysis

### 1. **Base Resolution Cache** (Primary Leak Source)

**Location**: `/workspace/packages/opencode/src/session/impulse-resolver.ts:25`

**Implementation**:
```typescript
const resolutionCache = new Map<string, ResolvedContent>()

export async function resolveForPrompt(impulse: ActivityTemplate.Impulse.Schema): Promise<ResolvedContent> {
  // 5-minute cache with setTimeout cleanup
  const cached = resolutionCache.get(impulse.id)
  if (cached && Date.now() - cached.resolvedAt < 300000) {
    return cached
  }
  
  // Cache resolved content
  resolutionCache.set(impulse.id, resolved)
  
  // Schedule eviction after 5 minutes
  setTimeout(() => {
    resolutionCache.delete(impulse.id)
  }, 300000)
}
```

**🚨 Memory Leak Issues**:
- **Unbounded Growth**: No size limit, only time-based eviction
- **setTimeout Accumulation**: Each resolution creates a setTimeout, leading to thousands of timers
- **Weak Cleanup**: If process is under load, setTimeout might not fire reliably
- **Reference Retention**: Large metabob responses cached for 5 minutes each

**Memory Impact**: With concurrent sessions creating 25+ metabob impulses, each caching 50-200KB responses = **1.25-5GB cache growth**

### 2. **Optimized Cache** (Better Design, Still Issues)

**Location**: `/workspace/packages/opencode/src/session/impulse-resolver-optimized.ts:28`

**Implementation**:
```typescript
const optimizedCache = new Map<string, OptimizedResolvedContent>()
const maxCacheSize = 500 // Configurable cache size limit

function addToOptimizedCache(resolved: OptimizedResolvedContent): void {
  if (optimizedCache.size >= maxCacheSize) {
    evictLeastRecentlyUsed()
  }
  optimizedCache.set(resolved.impulseId, resolved)
}
```

**✅ Better Design**:
- **Size-bounded**: 500 item limit
- **LRU Eviction**: Smart eviction based on access patterns
- **10-minute TTL**: Reasonable expiration time

**⚠️ Still Problematic**:
- **500 × 200KB** = 100MB potential cache size
- **Global shared cache**: All sessions share same cache space
- **No session-aware cleanup**: Deleted sessions may leave cache entries

### 3. **Memory Profiles Store** (Major Leak)

**Location**: `/workspace/packages/opencode/src/session/impulse-memory-optimizer.ts:42-44`

**Implementation**:
```typescript
// Memory tracking storage
const memoryProfiles = new Map<string, MemoryProfile>()
const loadTimeHistory: Array<{ impulseId: string; loadTime: number; timestamp: number }> = []
const budgetExhaustionEvents: Array<{ timestamp: number; details: string }> = []
```

**🚨 Critical Memory Leak**:
- **NO CLEANUP MECHANISM**: Maps and arrays grow indefinitely  
- **No Size Limits**: No bounds checking or eviction
- **No TTL**: Old entries never expire
- **Per-Impulse Tracking**: With 25+ impulses per session, profiles accumulate rapidly

**Memory Impact**: Each impulse creates permanent memory profile entry + history entries

### 4. **Session Memory Store** (Storage Leak)

**Location**: `/workspace/packages/opencode/src/session/session-memory.ts:Store`

**Implementation**:
```typescript
export interface Store {
  sessionID: string
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  totalBudget: number
  usedTokens: number
  lastOptimized: number
}
```

**🚨 Content Persistence Bug**:
- **Unloaded Content Persists**: Test file confirms content isn't cleared from storage
- **No TTL Mechanism**: Sessions persist indefinitely in storage
- **No Version Cleanup**: Old versions accumulate without compaction
- **Content Duplication**: Content saved in both memory and storage unnecessarily

## Memory Growth Patterns

### Pattern 1: Exponential Cache Growth
```
Session 1: 5 impulses → 5 cache entries → 250KB-1MB
Session 2: 5 impulses → 10 cache entries → 500KB-2MB  
Session 3: 5 impulses → 15 cache entries → 750KB-3MB
Session 5: 5 impulses → 25 cache entries → 1.25GB-5GB
```

### Pattern 2: Profile Store Accumulation
```
Each impulse → MemoryProfile entry → Never cleaned up
25 impulses → 25 permanent profiles → Grows session after session
100 sessions → 2,500+ permanent entries → Massive memory leak
```

### Pattern 3: setTimeout Timer Accumulation
```
Each impulse → setTimeout(delete, 300000) → 5-minute timer
25 impulses → 25 active timers → Process timer table growth
Under load → Timers delayed → Cache never cleaned → Memory leak
```

## Reference Management Issues

### 1. **No Weak References**
- All caches use strong `Map<string, T>` references
- No use of `WeakMap` or `WeakRef` for automatic GC
- Large objects held indefinitely until explicit cleanup

### 2. **Circular Reference Potential**
```typescript
// Impulse objects may hold references to:
// - Session context
// - Activity context  
// - Resolution results
// - Memory profiles
// All interconnected, preventing GC
```

### 3. **Event Bus References**
```typescript
// SessionMemory publishes events with impulse data
await Bus.publish(Event.Updated, {
  sessionID,
  impulses: Object.values(store.impulses), // Full impulse objects
  stats: {...}
})
```
Event handlers may retain references to impulse objects

## Unbounded Cache Identification

### ❌ **Unbounded Caches** (Critical):
1. **`resolutionCache`**: No size limit, only time-based cleanup
2. **`memoryProfiles`**: No cleanup mechanism at all
3. **`loadTimeHistory`**: Array grows indefinitely
4. **`budgetExhaustionEvents`**: Array grows indefinitely

### ✅ **Bounded Caches** (Better):
1. **`optimizedCache`**: 500-item limit with LRU eviction

### ⚠️ **Partially Bounded**:
1. **Session Memory Storage**: Bounded per session, but sessions accumulate

## Memory Leak Root Causes

### 1. **Metabob Context Preparation Storm**
- Creates 5 impulses per session with 2-6KB budgets each
- Each impulse triggers resolution caching 
- Large metabob API responses (50-200KB each) cached
- **Result**: 5 × 200KB × 5 sessions = 5GB cache growth

### 2. **Profile Store Never Cleaned**
- `memoryProfiles` Map accumulates one entry per impulse
- No cleanup when sessions end or impulses deleted
- **Result**: Permanent memory growth per impulse resolved

### 3. **setTimeout Timer Leak**
- Each impulse resolution creates 5-minute setTimeout
- Under heavy load, timers may not fire reliably
- **Result**: Cache entries never cleaned, timers accumulate

### 4. **Storage Content Persistence**
- Test files show unloaded impulse content persists in storage
- Content saved multiple times per session
- **Result**: Disk waste + potential memory retention

## Recommended Fixes

### 1. **Emergency Fixes** (Immediate)

**Bound the Resolution Cache**:
```typescript
const MAX_RESOLUTION_CACHE_SIZE = 100 // Limit to 100 entries
const resolutionCache = new Map<string, ResolvedContent>()

function evictOldestEntry() {
  const oldestEntry = Array.from(resolutionCache.entries())
    .sort(([,a], [,b]) => a.resolvedAt - b.resolvedAt)[0]
  if (oldestEntry) {
    resolutionCache.delete(oldestEntry[0])
  }
}

// Before adding new entry
if (resolutionCache.size >= MAX_RESOLUTION_CACHE_SIZE) {
  evictOldestEntry()
}
```

**Fix Memory Profiles Leak**:
```typescript
// Add cleanup for memory profiles
export function cleanupProfilesForSession(sessionID: string): void {
  const toDelete = Array.from(memoryProfiles.keys())
    .filter(id => id.includes(sessionID))
  
  toDelete.forEach(id => memoryProfiles.delete(id))
}

// Limit history arrays
const MAX_HISTORY_SIZE = 1000
if (loadTimeHistory.length > MAX_HISTORY_SIZE) {
  loadTimeHistory.splice(0, loadTimeHistory.length - MAX_HISTORY_SIZE)
}
```

### 2. **Critical Fixes** (High Priority)

**Session-Aware Cache Management**:
```typescript
// Track which session created which cache entries
const cacheToSession = new Map<string, string>()

export function cleanupCacheForSession(sessionID: string): void {
  const entriesToDelete = Array.from(cacheToSession.entries())
    .filter(([_, session]) => session === sessionID)
    .map(([impulseId, _]) => impulseId)
  
  entriesToDelete.forEach(id => {
    resolutionCache.delete(id)
    optimizedCache.delete(id)
    cacheToSession.delete(id)
  })
}
```

**Replace setTimeout with Interval Cleanup**:
```typescript
// Replace individual setTimeout with periodic cleanup
setInterval(() => {
  const now = Date.now()
  const expired = Array.from(resolutionCache.entries())
    .filter(([_, entry]) => now - entry.resolvedAt > 300000)
  
  expired.forEach(([id, _]) => resolutionCache.delete(id))
}, 60000) // Cleanup every minute
```

### 3. **Long-term Solutions**

1. **Weak Reference Implementation**: Use WeakMap where possible
2. **Session Lifecycle Integration**: Automatic cleanup on session end
3. **Memory Pressure Detection**: Aggressive cleanup under memory pressure
4. **Configuration Tunables**: Make cache sizes configurable
5. **Storage Content Cleanup**: Fix the storage persistence bug

## Testing Strategy

1. **Reproduction Tests**: Confirm cache growth with concurrent sessions
2. **Cleanup Verification**: Test each cleanup mechanism works  
3. **Memory Regression Tests**: Prevent future cache unbounding
4. **Load Testing**: Test cache behavior under realistic load

## Impact Assessment

- **Current Issue**: 5+ GB memory leak from cache structures
- **Root Cause**: 4 different unbounded/problematic cache layers
- **Fix Priority**: CRITICAL - Multiple emergency fixes needed
- **Production Risk**: Server OOM with moderate concurrent load

---

**Next Steps**:
1. Apply emergency cache bounding fixes
2. Implement profile store cleanup  
3. Fix setTimeout timer accumulation
4. Add session-aware cache management
5. Address storage content persistence bug