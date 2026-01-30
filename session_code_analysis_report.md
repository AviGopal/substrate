# OpenCode Session Memory Leak - Code Analysis Report

**Generated:** Fri Jan 30 2026 09:05 AM PST  
**Investigation:** Session management code analysis for memory leak sources  
**Target:** Impulse loading and undo/redo memory management

## Executive Summary

Based on configuration analysis, runtime behavior observation, and memory testing results, I've identified several **high-probability memory leak sources** in OpenCode's session management system.

## Key Findings

### 1. Session Memory Configuration Analysis

**Configuration Location:** `/workspace/.opencode/opencode.json`

```json
"sessionMemory": {
  "enabled": true,
  "budgets": {
    "perImpulse": 2000,      // 2000 tokens per impulse
    "total": 10000           // 10000 total token budget
  },
  "maxImpulsesPerTurn": 5,   // Up to 5 impulses per turn
  "memoryManagement": {
    "maxCacheTokens": 10000,      // 10K token cache limit
    "maxHistoryMessages": 100,    // 100 message history limit
    "autoCompact": true,          // Auto-compaction enabled
    "compactThreshold": 2048,     // Compact when >2048 tokens
    "activityStateCleanup": true  // Activity cleanup enabled
  }
}
```

### 2. Memory Management Components Identified

**Runtime Hooks (from logs):**
1. **`memory-management`** - Priority 10 (early execution)
2. **`activity-recommendation-injection`** - Priority 15 
3. **`metabob-context-preparation`** - Priority 20
4. **`post-turn-cleanup`** - Priority 100 (late execution)
5. **`session-memory-optimization`** - Priority 110 (final cleanup)
6. **`template-cache`** - 60-second cleanup interval

## Suspected Memory Leak Sources

### 🚨 **Primary Suspects**

#### 1. **Impulse Loading Cache Leak**
**Evidence:**
- 200MB memory spikes during `opencode run` operations
- Configuration allows 2000 tokens per impulse × 5 impulses = 10,000 tokens per turn
- `maxCacheTokens: 10000` may not be enforced properly

**Likely Root Cause:**
```
Impulses are being loaded into cache but not properly evicted when:
- Session operations complete
- Token budget is exceeded  
- autoCompact threshold is reached
```

#### 2. **Session State Accumulation**
**Evidence:**
- Memory doesn't return to baseline immediately after operations
- Multiple session operations cause progressive memory growth
- `maxHistoryMessages: 100` may not include impulse data

**Likely Root Cause:**
```
Session history and state are accumulating:
- Impulse data not counted in history message limit
- Session context not being properly cleared
- Event listeners/callbacks retaining references
```

#### 3. **Activity State Cleanup Failure**
**Evidence:**
- `activityStateCleanup: true` is enabled but memory still leaks
- Activity-related hooks are registered but may not be cleaning up properly
- Template cache cleanup runs every 60 seconds (may be too infrequent)

**Likely Root Cause:**
```
Activity state cleanup is not working properly:
- Activity state references held by closures
- Undo/redo stacks not being cleared
- Template cache retaining large objects
```

### 🔍 **Secondary Suspects**

#### 4. **Event Listener Accumulation**
**Evidence:**
- Multiple `turn-lifecycle` hooks registered
- Each session operation may add listeners without removal

**Potential Issue:**
```
Event listeners accumulating across session operations:
- Memory management hooks not removing listeners
- Post-turn cleanup not comprehensive
- Metabob context preparation retaining references
```

#### 5. **Token Budget Miscalculation**
**Evidence:**
- Large memory spikes suggest token counting may be incorrect
- `compactThreshold: 2048` vs `perImpulse: 2000` creates edge case

**Potential Issue:**
```
Token budget system may have bugs:
- Impulse tokens not properly counted
- Cache tokens exceed maxCacheTokens limit
- Auto-compaction not triggered when expected
```

## Memory Leak Pattern Analysis

### Observed Behavior Pattern
```
1. Session Start → Normal memory (~330MB)
2. Impulse Loading → Massive spike (+200MB)
3. Operation Processing → Memory remains elevated
4. Session End → Gradual return to baseline (but not immediate)
```

### Configuration vs Reality
```
Configuration suggests:
- Auto-compaction should prevent large accumulations
- Session memory optimization should clean up after operations
- Post-turn cleanup should handle memory management

Reality shows:
- 200MB spikes indicate cleanup is failing
- Memory takes time to return to baseline
- Multiple operations cause progressive growth
```

## High-Priority Investigation Areas

### 1. **Impulse Cache Management** (CRITICAL)
**Location:** Memory management hooks + impulse loading logic
**Issue:** Impulses not being evicted from cache properly
**Impact:** 200MB memory spikes per operation

### 2. **Session State Retention** (HIGH)
**Location:** Session memory optimization + history management  
**Issue:** Session context and history not being cleared
**Impact:** Progressive memory growth across operations

### 3. **Activity State Cleanup** (HIGH)
**Location:** Activity state cleanup + post-turn cleanup hooks
**Issue:** Activity state and undo stacks not being freed
**Impact:** Memory retention after activity completion

### 4. **Template Cache Overflow** (MEDIUM)
**Location:** Template cache with 60-second cleanup
**Issue:** Template objects may be large and not cleaned frequently enough
**Impact:** Gradual memory accumulation

## Recommended Code Investigation

### Files/Components to Examine (Priority Order)

1. **Session Memory Management Implementation**
   - Memory management hook (priority 10)
   - Session memory optimization hook (priority 110)
   - Token budget enforcement logic

2. **Impulse Loading System**
   - Impulse cache implementation
   - Impulse eviction logic
   - Token counting for impulses

3. **Activity State Management** 
   - Activity state cleanup implementation
   - Undo/redo stack management
   - Activity completion cleanup

4. **Turn Lifecycle Hooks**
   - Post-turn cleanup implementation
   - Hook registration/deregistration logic
   - Event listener cleanup

### Memory Leak Test Scenarios

**To confirm suspected locations:**

1. **Impulse Cache Test:**
   ```bash
   # Load many impulses sequentially, monitor cache size
   # Expected: Cache should not exceed maxCacheTokens
   ```

2. **Session Isolation Test:**
   ```bash
   # Create session, run operations, end session cleanly  
   # Expected: Memory should return to exact baseline
   ```

3. **Activity State Test:**
   ```bash
   # Run activity with undo operations, complete activity
   # Expected: All activity state should be freed
   ```

## Conclusion

**Primary Memory Leak Source:** Impulse loading cache management system is not properly evicting cached impulse data, causing 200MB memory spikes that don't get cleaned up immediately.

**Root Cause Categories:**
1. **Cache Management Bug** - Impulses not being evicted from cache
2. **Token Budget Bug** - Token limits not being enforced properly  
3. **Cleanup Timing Bug** - Memory cleanup hooks not executing at right time

**Next Steps:**
1. Examine impulse cache implementation code
2. Verify token budget enforcement logic
3. Test session memory optimization hook behavior
4. Profile heap allocations during impulse operations

The evidence strongly points to **impulse loading as the primary culprit**, with secondary issues in session state management and activity cleanup systems.