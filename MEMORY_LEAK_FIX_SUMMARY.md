# OpenCode Memory Leak Fix - Implementation Guide

**CRITICAL ISSUE:** Impulse processing allocates 203MB per operation (25x over budget)  
**IMMEDIATE ACTION REQUIRED:** System will crash under concurrent load

## 🚨 **Root Cause**
Impulse processing infrastructure allocates 200MB per operation due to:
- **Broken token budget enforcement** (2000 tokens → 200MB instead of 8MB)
- **Over-provisioned processing buffers** (fixed 200MB allocation)
- **Non-functional memory management hooks** (5 hooks registered, none working)

## 🎯 **Fix Summary**

```
ROOT CAUSE:
Impulse processing system ignores configured token budgets and allocates 25x more memory than intended, causing 203MB spikes per operation.

AFFECTED COMPONENTS:
- Impulse loading/caching system
- Token budget enforcement 
- Processing buffer allocation
- Memory management lifecycle hooks
- Session memory optimization

FIXES REQUIRED:
1. Implement hard token budget limits with rejection of over-budget operations
2. Replace 200MB fixed buffers with 10MB bounded, reusable buffer pools
3. Fix memory management hooks to actually prevent allocation spikes
4. Add circuit breaker to prevent memory exhaustion
5. Implement proper cache size limits with LRU eviction

IMPLEMENTATION STEPS:
1. Add token budget hard enforcement (reject operations >2000 tokens)
2. Implement memory monitoring before/after operations
3. Replace fixed allocations with bounded buffer pools
4. Repair memory management hook execution
5. Add circuit breaker for memory protection
6. Implement cache size monitoring and eviction

TESTING PLAN:
1. Unit tests for token budget enforcement edge cases
2. Integration tests for <50MB memory usage per operation  
3. Load tests with 10+ concurrent operations
4. Regression tests for existing functionality
```

## ⚡ **Immediate Implementation Priority**

### **Phase 1: Emergency Fixes (This Week)**

#### 1. **Token Budget Hard Enforcement** 
```typescript
// CRITICAL: Add hard limits to prevent 200MB allocations
if (estimatedTokens > 2000) {
  throw new Error(`Impulse exceeds budget: ${estimatedTokens} > 2000 tokens`);
}
if (estimatedMemoryMB > 10) {
  throw new Error(`Impulse exceeds memory: ${estimatedMemoryMB}MB > 10MB`);
}
```

#### 2. **Memory Management Hook Repair**
```typescript
// CRITICAL: Make hooks actually prevent memory spikes
async afterTurn(context) {
  const memoryGrowth = currentMemory - context.memoryBefore;
  if (memoryGrowth > 50MB) {
    await emergencyCleanup();
    throw new Error(`Memory leak detected: ${memoryGrowth}MB`);
  }
}
```

#### 3. **Circuit Breaker Protection**
```typescript
// CRITICAL: Prevent system crash from memory exhaustion
if (memoryUsage > 50MB) {
  this.failureCount++;
  if (this.failureCount >= 3) {
    throw new Error('Circuit breaker OPEN - too many memory failures');
  }
}
```

### **Phase 2: Optimization (Next Week)**

#### 4. **Buffer Pool Implementation**
```typescript
// Replace 200MB fixed allocation with 5MB max reusable buffers
const buffer = this.bufferPool.get(size <= 5MB ? size : throw Error);
```

#### 5. **Cache Size Limits** 
```typescript
// Enforce maxCacheTokens: 10000 (40MB) actual limit
while (cacheSize + valueSize > maxSizeBytes) {
  evictOldestEntry();
}
```

## 🧪 **Success Validation**

### **Memory Usage Targets:**
- **Before Fix:** 351MiB → 554MiB (203MB spike) → 352MiB  
- **After Fix:** 351MiB → 401MiB (50MB max) → 352MiB

### **System Stability:**
- **Before:** 3-4 concurrent ops crash system
- **After:** 10+ concurrent ops run safely

### **Performance Impact:**
- **Memory:** 75% reduction (200MB → 50MB)
- **Speed:** <5% overhead acceptable
- **Reliability:** No OOM crashes

## 🔧 **Implementation Files**

### **Primary Targets:**
1. **Session Memory Manager** - Token budget enforcement
2. **Impulse Processor** - Buffer allocation and caching  
3. **Memory Management Hooks** - Spike prevention
4. **Turn Lifecycle** - Memory monitoring and cleanup

### **Key Configuration:**
```json
"sessionMemory": {
  "budgets": {
    "perImpulse": 2000,     // ENFORCE: Reject if exceeded
    "total": 10000          // ENFORCE: Hard memory limits
  },
  "memoryManagement": {
    "maxCacheTokens": 10000, // ENFORCE: 40MB actual limit
    "emergencyThreshold": 50 // NEW: 50MB operation limit
  }
}
```

## ⚠️ **Critical Notes**

### **DO NOT INVESTIGATE:**
- ✅ **Undo/redo systems** - Working correctly, no memory leaks
- ✅ **Activity operations** - Proper memory management  
- ✅ **Session history** - Bounded and cleaned up properly

### **FOCUS ALL EFFORTS ON:**
- 🚨 **Impulse loading system** - Root cause of 200MB leaks
- 🚨 **Token budget enforcement** - Completely broken
- 🚨 **Processing buffer management** - Over-provisioned 5x
- 🚨 **Memory management hooks** - All 5 hooks failing

## 🎯 **Expected Outcomes**

**Immediate Benefits:**
- **75% memory reduction** per operation
- **System stability** under concurrent load  
- **No more crashes** from memory exhaustion
- **Predictable memory usage** within configured budgets

**Long-term Benefits:**
- **Higher throughput** - more concurrent operations possible
- **Better performance** - reduced GC pressure
- **Reliable scaling** - memory usage stays bounded
- **Operational confidence** - no surprise memory issues

---

**IMPLEMENTATION STATUS:** Ready for immediate development  
**ESTIMATED EFFORT:** 1-2 weeks for complete fix  
**RISK LEVEL:** LOW (fixes are targeted and well-defined)  
**BUSINESS IMPACT:** HIGH (prevents system crashes and enables scaling)