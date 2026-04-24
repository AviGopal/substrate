# Code-Level Tracing Implementation Summary

## What We've Accomplished

### 1. ✅ Runtime Trace Analysis Activity Created

**File**: `repos/minibob/activities/analysis/analyze-runtime-traces.json`

- Analyzes existing runtime trace files from `runtime-traces/` directory
- Generates comprehensive reports on:
  - Resolver usage frequency and performance
  - Activity execution patterns
  - Performance bottlenecks
  - Cost optimization opportunities
  - Code usage insights

**Successfully ran** and generated detailed analysis report!

### 2. ✅ Analysis Report Generated

**File**: `runtime-trace-analysis-report.md`

**Key Findings from 6 Traces**:
- **Tool latency averaging 9.7 seconds** - major bottleneck
- **100% activity completion rate** - stable system
- **50% bash tool success rate** - whitelist restrictions
- **Heavy tool usage in startup** vs pure LLM in goal processing
- **curl and env commands blocked** - security policy working

**Actionable Insights**:
1. Fix curl-based health checks (blocked by whitelist)
2. Optimize tool resolver latency (9.7s average)
3. Implement caching for repeated config reads
4. Different optimization strategies for startup vs goal processing

### 3. ✅ Code-Level Instrumentation Framework

**File**: `src/code-tracing.ts` (742 lines)

**Architecture**:
```typescript
// Wrap any function to track execution
const tracedFn = withCodeTracing(
  'functionName',
  'src/file.ts',
  'module',
  originalFunction
);

// Automatically records:
// - Latency (ms)
// - Success/failure
// - Input shapes (string, object, array<T>)
// - Output shapes
// - Call stack
// - Exception details
```

**Features Implemented**:
- ✅ Function wrapping with `withCodeTracing()`
- ✅ Decorator support `@Traced()` for TypeScript classes
- ✅ Configurable sampling (0-100%)
- ✅ Shape inference (input → output tracking)
- ✅ Call stack capture
- ✅ Exception handling
- ✅ Analysis functions (`analyzeCodeUsage()`)

### 4. ✅ Design Document Created

**File**: `CODE_INSTRUMENTATION_DESIGN.md`

**Comprehensive 3-phase plan**:
- **Phase 1**: Basic instrumentation (Week 1)
- **Phase 2**: AST transformation for automatic instrumentation (Week 2)
- **Phase 3**: Learning loop and optimization (Week 3)

**Key Concepts**:
- Treat code functions as resolvers
- Track impulse transformations through codebase
- Learn usage patterns, performance, reliability
- Enable self-optimizing code

### 5. ✅ Demo Created

**File**: `examples/code-instrumentation-demo.ts`

Demonstrates:
- How to instrument functions
- Simulated application workflow
- Usage pattern analysis
- Performance profiling

## Current Status

### What Works
- ✅ Runtime trace collection (6 traces captured)
- ✅ Trace analysis activity execution
- ✅ Report generation with actionable insights
- ✅ Code instrumentation framework (core)
- ✅ Shape inference system
- ✅ Sampling configuration

### What Needs Implementation

#### 1. Complete Runtime Tracer Integration

**Issue**: `getCodeExecutionTraces()` method not implemented

**Fix** (in `src/runtime-tracing.ts`):
```typescript
export class RuntimeActivityTracer {
  private codeTraces: CodeExecutionTrace[] = [];

  // Add method to store code traces
  recordCodeTrace(trace: CodeExecutionTrace) {
    this.codeTraces.push(trace);
  }

  // Add getter for analysis
  getCodeExecutionTraces(): CodeExecutionTrace[] {
    return this.codeTraces;
  }
}
```

#### 2. Persist Code Traces to Storage

Currently traces are in-memory only. Need to:
- Save to `runtime-traces/code_*.json`
- Batch writes for performance
- Respect sampling rate

#### 3. Instrument Core Functions

**High-value targets** (from trace analysis):
```typescript
// src/tools.ts - Most frequently called
export const bashTool = withCodeTracing(
  'bashTool',
  'src/tools.ts',
  'tools',
  bashToolRaw
);

// src/impulse.ts - Critical path
export const loadImpulse = withCodeTracing(
  'loadImpulse',
  'src/impulse.ts',
  'impulse',
  loadImpulseRaw
);

// src/activity.ts - Activity execution
export const executeActivity = withCodeTracing(
  'executeActivity',
  'src/activity.ts',
  'activity',
  executeActivityRaw
);
```

#### 4. Backend Schema Extension

Extend SurrealDB schema to store code-level traces:
```sql
DEFINE TABLE code_execution AS
  SELECT *,
    code_metadata.function_name AS function_name,
    code_metadata.file_path AS file_path,
    code_metadata.input_shapes AS input_shapes,
    code_metadata.output_shapes AS output_shapes
  FROM impulse_resolutions
  WHERE resolver_id CONTAINS ':';
```

## Usage Pattern Learning - The Vision

### Current: Activity-Level Learning
```
Activity A → Thompson Sampling → Learn success rate
```

### Future: Code-Level Learning
```
Function A (string) → Function B (object) → Function C (array)
    ↓                      ↓                      ↓
 Track usage          Track perf            Track reliability
    ↓                      ↓                      ↓
Learn patterns → Optimize hot paths → Generate activities
```

### Example Learning Loop

**Step 1: Collect Traces** (1 week)
```
processAuth called 1,247 times
  Avg latency: 45ms
  Success rate: 99.2%
  Input: string → Output: object<token,expires>
  Called by: handleUserRequest (1,247x)
```

**Step 2: Analyze Patterns**
```sql
-- Find hot functions
SELECT function_name, COUNT(*) FROM code_execution
GROUP BY function_name
ORDER BY COUNT(*) DESC;

-- Find slow functions
SELECT function_name, AVG(latency_ms)
WHERE AVG(latency_ms) > 100;

-- Find unreliable functions
SELECT function_name,
  (COUNT(CASE WHEN success=false END) / COUNT(*)) as failure_rate
WHERE failure_rate > 0.05;
```

**Step 3: Generate Optimization Activities**
```json
{
  "id": "optimize-processAuth",
  "goal": "Optimize processAuth - called 1,247x, avg 45ms",
  "impulses": [
    { "type": "file", "path": "src/auth.ts" },
    { "type": "codeExecutionTraceList", "functionName": "processAuth" }
  ],
  "expectedOutcomes": [
    "Reduce latency to <20ms",
    "Maintain 99%+ success rate",
    "Consider caching for repeated calls"
  ]
}
```

**Step 4: Thompson Sampling for Code Variants**
```typescript
// Original implementation
async function processAuthV1(userId: string) { ... }

// Optimized with caching
async function processAuthV2(userId: string) {
  const cached = cache.get(userId);
  if (cached) return cached;
  // ...
}

// A/B test both via Thompson Sampling
// Learn which performs better in production
```

## Next Steps (Recommended Order)

### Phase 1: Complete Integration (1-2 days)

1. **Add `getCodeExecutionTraces()` to RuntimeActivityTracer**
   ```bash
   # Edit src/runtime-tracing.ts
   # Add method as shown above
   ```

2. **Persist code traces to disk**
   ```typescript
   // In RuntimeActivityTracer
   async flushCodeTraces() {
     const file = `runtime-traces/code_${Date.now()}.json`;
     await Bun.write(file, JSON.stringify(this.codeTraces, null, 2));
     this.codeTraces = [];
   }
   ```

3. **Instrument 3-5 critical functions**
   - Start with most-called: `bashTool`, `loadImpulse`
   - Run for 1 day to collect data

### Phase 2: Analysis & Optimization (3-5 days)

4. **Create code usage analysis activity**
   ```json
   {
     "id": "analyze-code-usage",
     "tasks": [
       "Load code execution traces",
       "Compute hot functions (>100 calls)",
       "Identify slow functions (>100ms avg)",
       "Find unreliable functions (>5% failure)",
       "Generate optimization recommendations"
     ]
   }
   ```

5. **Run analysis, identify top 3 optimization targets**

6. **Create optimization activities** for targets

### Phase 3: Self-Optimization Loop (ongoing)

7. **Implement Thompson Sampling for code variants**
   - Test optimized versions against originals
   - Learn which performs better
   - Automatically promote winners

8. **Expand instrumentation gradually**
   - Start with 5-10 functions
   - Scale to 50-100 over time
   - Use 1% sampling in production

## Success Metrics

Track these to measure impact:

1. **Code coverage by traces**
   - % of functions instrumented
   - % of code paths executed in traces

2. **Optimization ROI**
   - Latency improvements from optimizations
   - Cost reductions from better code paths

3. **Discovery rate**
   - Dead code identified
   - Bottlenecks discovered
   - Error patterns found

4. **Self-improvement velocity**
   - Number of auto-generated optimization activities
   - Success rate of optimizations
   - Time from trace → insight → optimization

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    MiniBob Code                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Function A  →  Function B  →  Function C               │
│      │              │              │                     │
│      ├─ Traced ─────┼─ Traced ─────┼─ Traced           │
│      │              │              │                     │
│      ▼              ▼              ▼                     │
│  ┌────────────────────────────────────┐                 │
│  │   Code Execution Traces            │                 │
│  │   - latency_ms                     │                 │
│  │   - success/failure                │                 │
│  │   - input_shapes → output_shapes   │                 │
│  │   - call_stack                     │                 │
│  └────────────────────────────────────┘                 │
│                    │                                     │
└────────────────────┼─────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Analysis Activities   │
         ├───────────────────────┤
         │ - analyze-code-usage  │
         │ - find-bottlenecks    │
         │ - detect-dead-code    │
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Optimization Activities│
         ├───────────────────────┤
         │ - optimize-hot-path   │
         │ - cache-computation   │
         │ - refactor-reliable   │
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Thompson Sampling     │
         ├───────────────────────┤
         │ A/B test variants     │
         │ Learn best approach   │
         │ Auto-promote winners  │
         └───────────────────────┘
                     │
                     ▼
             Self-Optimizing
                 Code!
```

## Benefits Realized

### Already Working
- ✅ **Visibility**: Know which resolvers are used (bash 12x, read 2x)
- ✅ **Performance insights**: Identified 9.7s tool latency bottleneck
- ✅ **Reliability metrics**: 100% activity success, 50% bash tool success
- ✅ **Cost tracking**: $0.16 avg for goal processing
- ✅ **Actionable reports**: Generated markdown with specific recommendations

### Coming Soon (After Phase 1)
- 📊 **Function-level metrics**: Know which functions are hot/slow/unreliable
- 🎯 **Optimization targets**: Data-driven prioritization
- 🔄 **Continuous improvement**: Automated optimization activities
- 🧪 **A/B testing**: Thompson Sampling for code variants
- 🗑️ **Dead code elimination**: Remove unused functions with confidence

## Conclusion

We've built the foundation for **self-optimizing code**. MiniBob can now:
1. ✅ Analyze its own execution traces
2. ✅ Generate insights about code usage
3. ✅ Identify optimization opportunities
4. 🔨 (Soon) Automatically generate optimization activities
5. 🔨 (Soon) Learn which code variants perform best

This is the activity model applied to code itself - treating functions as resolvers that transform impulses, enabling continuous learning and improvement.

**Next Action**: Complete Phase 1 integration (add `getCodeExecutionTraces()`) and instrument 5 critical functions.
