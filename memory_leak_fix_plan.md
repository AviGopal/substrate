# OpenCode Memory Leak Fix Plan

**Investigation Complete:** Fri Jan 30 2026 09:30 AM PST  
**Root Cause Identified:** Impulse processing infrastructure over-allocation  
**Fix Priority:** CRITICAL - System unstable under concurrent load

## 📊 **Findings Summary**

### Root Cause of Memory Leak
**Primary Issue:** Impulse processing system allocates **203MB of temporary memory** per operation due to:
1. **Broken token budget enforcement** - 2000 token limit (8MB) ignored, 200MB allocated
2. **Over-provisioned processing buffers** - Fixed 200MB infrastructure allocation
3. **Failed memory management hooks** - 5 hooks registered but non-functional
4. **Cache size limit bypass** - maxCacheTokens (40MB) exceeded by 5x

### Which Operations Trigger It
- ✅ **Impulse Loading** (`opencode run`) - **MAJOR LEAK** (203MB spikes)
- ✅ **Session operations** with impulse processing - **MAJOR LEAK**
- ❌ **Undo/Redo operations** - **NO LEAK** (systems working correctly)
- ❌ **Activity operations** - **NO LEAK** (proper memory management)

### Memory Growth Pattern
- **Type:** Temporary over-allocation (not unbounded accumulation)
- **Pattern:** 203MB spike → returns to baseline after operation
- **Risk:** 3-4 concurrent operations could exceed 2GB heap limit
- **Trigger:** Every `opencode run` command or impulse processing operation

---

## 🎯 **Fix Plan**

```
ROOT CAUSE:
Impulse processing infrastructure allocates 25x more memory than configured token budgets due to broken enforcement, over-provisioned buffers, and failed memory management hooks.

AFFECTED COMPONENTS:
- Impulse loading and caching system
- Token budget enforcement mechanism  
- Processing buffer management
- Memory management lifecycle hooks
- Session memory optimization system

FIXES REQUIRED:
1. Implement hard memory limits with token budget enforcement
2. Replace over-provisioned buffers with efficient, reusable memory pools
3. Repair memory management hooks to actually prevent over-allocation
4. Add real-time memory monitoring and circuit breakers
5. Implement proper cache eviction with size limits

IMPLEMENTATION STEPS:
1. Add memory allocation monitoring and logging
2. Implement token budget hard limits (reject operations exceeding budget)
3. Replace fixed 200MB allocations with dynamic, bounded buffers
4. Fix memory management hook execution and effectiveness
5. Add circuit breakers for memory exhaustion prevention
6. Implement cache size monitoring and LRU eviction

TESTING PLAN:
1. Unit tests for token budget enforcement under various scenarios
2. Integration tests for memory usage during impulse operations
3. Load tests with concurrent operations to verify memory limits
4. Regression tests to ensure existing functionality remains intact
```

---

## 🔧 **Detailed Implementation Plan**

### **Phase 1: Immediate Fixes (Critical)**

#### 1.1 **Token Budget Hard Enforcement**

**Problem:** 2000 token limit ignored, 200MB allocated instead of 8MB

**Fix Implementation:**
```typescript
// Add to session memory manager
class ImpulseMemoryManager {
  private tokenBudget: number = 2000; // From config
  private maxMemoryMB: number = 10;   // Hard limit: 10MB per impulse
  
  async loadImpulse(impulseData: any): Promise<void> {
    const estimatedTokens = this.estimateTokens(impulseData);
    const estimatedMemoryMB = estimatedTokens * 4 / (1024 * 1024);
    
    // HARD ENFORCEMENT
    if (estimatedTokens > this.tokenBudget) {
      throw new Error(`Impulse exceeds token budget: ${estimatedTokens} > ${this.tokenBudget}`);
    }
    
    if (estimatedMemoryMB > this.maxMemoryMB) {
      throw new Error(`Impulse exceeds memory limit: ${estimatedMemoryMB}MB > ${this.maxMemoryMB}MB`);
    }
    
    // Monitor actual allocation
    const beforeMemory = process.memoryUsage().heapUsed;
    await this.processImpulse(impulseData);
    const afterMemory = process.memoryUsage().heapUsed;
    const actualMB = (afterMemory - beforeMemory) / (1024 * 1024);
    
    if (actualMB > this.maxMemoryMB * 1.5) { // 50% tolerance
      console.warn(`Memory allocation exceeded expected: ${actualMB}MB > ${this.maxMemoryMB}MB`);
    }
  }
}
```

#### 1.2 **Replace Over-Provisioned Buffers**

**Problem:** 200MB fixed allocation per operation

**Fix Implementation:**
```typescript
// Replace large fixed buffers with efficient pools
class MemoryEfficientProcessor {
  private bufferPool: Map<string, Buffer[]> = new Map();
  private maxBufferSize: number = 5 * 1024 * 1024; // 5MB max per buffer
  
  getBuffer(size: number): Buffer {
    if (size > this.maxBufferSize) {
      throw new Error(`Buffer size ${size} exceeds maximum ${this.maxBufferSize}`);
    }
    
    const key = this.getBufferKey(size);
    let pool = this.bufferPool.get(key);
    
    if (!pool) {
      pool = [];
      this.bufferPool.set(key, pool);
    }
    
    return pool.pop() || Buffer.alloc(size);
  }
  
  returnBuffer(buffer: Buffer): void {
    const key = this.getBufferKey(buffer.length);
    const pool = this.bufferPool.get(key);
    if (pool && pool.length < 10) { // Max 10 buffers per size
      pool.push(buffer);
    }
  }
  
  private getBufferKey(size: number): string {
    // Round to nearest power of 2 for efficient pooling
    const rounded = Math.pow(2, Math.ceil(Math.log2(size)));
    return `buffer_${rounded}`;
  }
}
```

#### 1.3 **Fix Memory Management Hooks**

**Problem:** 5 registered hooks don't prevent 200MB spikes

**Fix Implementation:**
```typescript
// Repair memory management hook
class MemoryManagementHook {
  private memoryThreshold: number = 50 * 1024 * 1024; // 50MB threshold
  
  async beforeTurn(context: TurnContext): Promise<void> {
    const beforeMemory = process.memoryUsage().heapUsed;
    context.metadata.memoryBefore = beforeMemory;
    
    // Check if we're approaching limits
    if (beforeMemory > this.memoryThreshold * 3) { // 150MB warning
      console.warn(`High memory usage before turn: ${beforeMemory / (1024*1024)}MB`);
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  async afterTurn(context: TurnContext): Promise<void> {
    const afterMemory = process.memoryUsage().heapUsed;
    const beforeMemory = context.metadata.memoryBefore;
    const deltaMemory = afterMemory - beforeMemory;
    
    // CRITICAL: Reject if memory growth is excessive
    if (deltaMemory > this.memoryThreshold) {
      console.error(`Turn memory growth exceeded limit: ${deltaMemory / (1024*1024)}MB`);
      
      // Force cleanup
      await this.emergencyCleanup(context);
      
      // Reject operation if still over limit
      const finalMemory = process.memoryUsage().heapUsed;
      if (finalMemory - beforeMemory > this.memoryThreshold) {
        throw new Error(`Memory leak detected: ${(finalMemory - beforeMemory) / (1024*1024)}MB growth`);
      }
    }
  }
  
  private async emergencyCleanup(context: TurnContext): Promise<void> {
    // Clear caches
    if (context.cache) {
      context.cache.clear();
    }
    
    // Clear buffers
    if (context.buffers) {
      context.buffers.forEach(buffer => buffer.fill(0));
      context.buffers.length = 0;
    }
    
    // Force GC
    if (global.gc) {
      global.gc();
    }
  }
}
```

### **Phase 2: Enhanced Memory Management (High Priority)**

#### 2.1 **Implement Cache Size Monitoring**

**Problem:** maxCacheTokens (40MB) exceeded by 5x

**Fix Implementation:**
```typescript
class BoundedImpulseCache {
  private cache: Map<string, any> = new Map();
  private cacheSize: number = 0;
  private maxSizeBytes: number;
  private maxTokens: number;
  
  constructor(config: { maxCacheTokens: number }) {
    this.maxTokens = config.maxCacheTokens;
    this.maxSizeBytes = config.maxCacheTokens * 4; // 4 bytes per token
  }
  
  set(key: string, value: any): void {
    const valueSize = this.estimateSize(value);
    
    // Enforce hard limits
    if (valueSize > this.maxSizeBytes) {
      throw new Error(`Value too large: ${valueSize} > ${this.maxSizeBytes}`);
    }
    
    // Evict if necessary
    while (this.cacheSize + valueSize > this.maxSizeBytes && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }
    
    this.cache.set(key, value);
    this.cacheSize += valueSize;
  }
  
  delete(key: string): boolean {
    const value = this.cache.get(key);
    if (value) {
      this.cacheSize -= this.estimateSize(value);
      return this.cache.delete(key);
    }
    return false;
  }
  
  private estimateSize(obj: any): number {
    // Simple size estimation - replace with more accurate method
    return JSON.stringify(obj).length * 2; // Rough estimate
  }
}
```

#### 2.2 **Add Circuit Breaker for Memory Protection**

**Fix Implementation:**
```typescript
class MemoryCircuitBreaker {
  private isOpen: boolean = false;
  private failureCount: number = 0;
  private maxFailures: number = 3;
  private resetTimeout: number = 60000; // 60 seconds
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      throw new Error('Circuit breaker is OPEN - too many memory failures');
    }
    
    const beforeMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await operation();
      
      // Check memory growth
      const afterMemory = process.memoryUsage().heapUsed;
      const growth = afterMemory - beforeMemory;
      
      if (growth > 50 * 1024 * 1024) { // 50MB limit
        this.recordFailure();
        throw new Error(`Operation exceeded memory limit: ${growth / (1024*1024)}MB`);
      }
      
      // Success - reset failure count
      this.failureCount = 0;
      return result;
      
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.maxFailures) {
      this.isOpen = true;
      setTimeout(() => {
        this.isOpen = false;
        this.failureCount = 0;
      }, this.resetTimeout);
    }
  }
}
```

### **Phase 3: Monitoring and Observability (Medium Priority)**

#### 3.1 **Add Memory Usage Monitoring**

**Fix Implementation:**
```typescript
class MemoryMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  recordOperation(operation: string, memoryUsage: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const history = this.metrics.get(operation)!;
    history.push(memoryUsage);
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
    
    // Alert on anomalies
    if (memoryUsage > 50 * 1024 * 1024) { // 50MB threshold
      console.warn(`High memory usage for ${operation}: ${memoryUsage / (1024*1024)}MB`);
    }
  }
  
  getAverageUsage(operation: string): number {
    const history = this.metrics.get(operation) || [];
    if (history.length === 0) return 0;
    
    return history.reduce((a, b) => a + b, 0) / history.length;
  }
  
  generateReport(): string {
    const report = [];
    report.push('=== MEMORY USAGE REPORT ===');
    
    for (const [operation, history] of this.metrics.entries()) {
      const avg = this.getAverageUsage(operation);
      const max = Math.max(...history);
      const min = Math.min(...history);
      
      report.push(`${operation}:`);
      report.push(`  Average: ${(avg / (1024*1024)).toFixed(2)}MB`);
      report.push(`  Max: ${(max / (1024*1024)).toFixed(2)}MB`);
      report.push(`  Min: ${(min / (1024*1024)).toFixed(2)}MB`);
      report.push(`  Samples: ${history.length}`);
    }
    
    return report.join('\n');
  }
}
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**

```typescript
describe('Memory Management Fixes', () => {
  test('Token budget enforcement prevents over-allocation', async () => {
    const manager = new ImpulseMemoryManager();
    const largeImpulse = 'x'.repeat(10000); // Large impulse
    
    await expect(manager.loadImpulse(largeImpulse))
      .rejects.toThrow('exceeds token budget');
  });
  
  test('Buffer pool reuses memory efficiently', () => {
    const processor = new MemoryEfficientProcessor();
    const buffer1 = processor.getBuffer(1024);
    processor.returnBuffer(buffer1);
    const buffer2 = processor.getBuffer(1024);
    
    expect(buffer2).toBe(buffer1); // Should reuse
  });
  
  test('Cache respects size limits', () => {
    const cache = new BoundedImpulseCache({ maxCacheTokens: 1000 });
    const largeValue = 'x'.repeat(5000); // Exceeds limit
    
    expect(() => cache.set('key', largeValue))
      .toThrow('Value too large');
  });
});
```

### **Integration Tests**

```typescript
describe('Memory Leak Prevention', () => {
  test('Impulse operations stay within memory limits', async () => {
    const beforeMemory = process.memoryUsage().heapUsed;
    
    // Run impulse operation
    await runImpulseOperation('test impulse data');
    
    const afterMemory = process.memoryUsage().heapUsed;
    const growth = afterMemory - beforeMemory;
    
    expect(growth).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  });
  
  test('Circuit breaker prevents memory exhaustion', async () => {
    const breaker = new MemoryCircuitBreaker();
    
    // Try multiple memory-intensive operations
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.execute(() => memoryIntensiveOperation());
      } catch (error) {
        // Expected after too many failures
      }
    }
    
    // Circuit should be open
    await expect(breaker.execute(() => normalOperation()))
      .rejects.toThrow('Circuit breaker is OPEN');
  });
});
```

### **Load Tests**

```bash
# Concurrent operation test
for i in {1..10}; do
  opencode run "Load test operation $i" &
done
wait

# Memory should not exceed 2GB total
docker stats devbob-opencode --no-stream
```

---

## ⚡ **Performance Impact Analysis**

### **Memory vs. Speed Trade-offs**

#### **Positive Impacts:**
- ✅ **Reduced GC pressure** - Less memory allocation means fewer garbage collection cycles
- ✅ **Better cache locality** - Smaller memory footprint improves cache performance
- ✅ **Higher concurrency** - More operations can run simultaneously within memory limits
- ✅ **System stability** - No more OOM crashes or memory exhaustion

#### **Potential Performance Costs:**
- ⚠️ **Buffer pool overhead** - Small overhead for buffer management (~1-2%)
- ⚠️ **Memory monitoring** - Tracking and logging adds minimal overhead (~0.5%)
- ⚠️ **Cache eviction** - LRU eviction may cause some cache misses (~2-3% for heavy cache users)

#### **Acceptable Performance Limits:**
- **Memory per operation:** 50MB maximum (vs. current 200MB)
- **Processing overhead:** <5% additional CPU usage
- **Cache hit rate:** >90% maintained with proper sizing

### **Overall Performance Impact:**
**NET POSITIVE** - Memory efficiency improvements will outweigh small overheads

---

## 🎯 **Implementation Priority**

### **Phase 1: Critical Fixes (Week 1)**
1. ✅ Token budget hard enforcement
2. ✅ Memory management hook repairs  
3. ✅ Circuit breaker implementation
4. ✅ Basic monitoring

### **Phase 2: Optimization (Week 2)**
1. ✅ Buffer pool implementation
2. ✅ Cache size limits and eviction
3. ✅ Enhanced monitoring

### **Phase 3: Validation (Week 3)**
1. ✅ Comprehensive testing
2. ✅ Load testing and validation
3. ✅ Performance tuning

---

## 🔍 **Success Criteria**

### **Memory Usage Goals:**
- **Per Operation:** <50MB (vs. current 200MB)
- **Concurrent Operations:** Support 10+ simultaneous operations
- **Memory Recovery:** Return to baseline within 5 seconds
- **System Stability:** No OOM crashes under normal load

### **Performance Goals:**
- **Operation Speed:** <5% performance impact
- **Cache Efficiency:** >90% cache hit rate
- **Memory Efficiency:** 75% reduction in memory usage
- **System Reliability:** 99.9% uptime under load

**This comprehensive fix plan addresses all identified memory leak sources while maintaining system performance and ensuring long-term stability.**