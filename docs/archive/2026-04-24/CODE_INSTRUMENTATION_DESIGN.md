# Code-Level Instrumentation Design

## Vision

Treat code execution as resolvers in the activity model, enabling MiniBob to learn:
- Which functions/modules are used most frequently
- How impulses transform through the codebase (input → output)
- Success rates and reliability metrics per code unit
- Performance characteristics (latency, cost)
- Composition patterns (which functions call which)

This enables **self-optimizing code** through continuous learning from execution traces.

## Architecture

### 1. Code as Resolvers

Every function becomes a resolver that transforms impulses:

```typescript
// Before: Regular function
async function processAuth(userId: string): Promise<AuthToken> {
  // ... implementation
}

// After: Instrumented as resolver
async function processAuth(userId: string): Promise<AuthToken> {
  return withCodeTracing('processAuth', 'auth.ts', async () => {
    const inputImpulse = createImpulse({
      pointer: { type: 'memo', content: JSON.stringify({ userId }) },
      metadata: { shape: 'user_id', functionName: 'processAuth' }
    });

    // ... implementation
    const result = /* actual work */;

    const outputImpulse = createImpulse({
      pointer: { type: 'memo', content: JSON.stringify(result) },
      metadata: { shape: 'auth_token', functionName: 'processAuth' }
    });

    recordTransformation(inputImpulse, outputImpulse, 'processAuth');
    return result;
  });
}
```

### 2. Instrumentation Levels

**Level 1: Automatic AST Instrumentation**
- Parse TypeScript files
- Inject tracing at function boundaries
- Minimal performance overhead
- Transparent to developers

**Level 2: Manual Instrumentation**
- Explicit `@Traced()` decorators
- Custom impulse shape definitions
- Fine-grained control

**Level 3: Runtime Profiling**
- Sample-based profiling (configurable rate)
- Hot path identification
- Dynamic optimization

### 3. Trace Schema Extension

Extend existing `ImpulseResolution` schema:

```typescript
interface CodeExecutionTrace extends ImpulseResolution {
  // Existing fields
  impulse_id: string;
  resolver_id: string;  // Now includes function name
  resolver_tier: string;
  vessel_id: string;
  latency_ms: number;
  cost_usd: number;

  // NEW: Code-level metadata
  code_metadata: {
    file_path: string;           // Source file
    function_name: string;        // Function name
    line_number: number;          // Where defined
    module: string;               // Module/package
    call_stack: string[];         // Call chain
    input_shapes: string[];       // Impulse shapes consumed
    output_shapes: string[];      // Impulse shapes produced
    branch_coverage?: number;     // % of branches hit
    exception?: {                 // If threw exception
      type: string;
      message: string;
      stack: string;
    };
  };
}
```

## Implementation Plan

### Phase 1: Basic Instrumentation (Week 1)

**Goal**: Track function-level execution

```typescript
// src/code-instrumentation.ts

export function withCodeTracing<T>(
  functionName: string,
  filePath: string,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = getRuntimeTracer();
  if (!tracer.isEnabled()) return fn();

  const startTime = Date.now();
  const inputSnapshot = captureInputs(fn);

  try {
    const result = await fn();
    const latency = Date.now() - startTime;

    tracer.recordCodeExecution({
      resolver_id: `${filePath}:${functionName}`,
      resolver_tier: 'deterministic',
      latency_ms: latency,
      cost_usd: 0,
      success: true,
      code_metadata: {
        file_path: filePath,
        function_name: functionName,
        input_shapes: inferShapes(inputSnapshot),
        output_shapes: inferShapes(result),
      }
    });

    return result;
  } catch (error) {
    tracer.recordCodeExecution({
      // ... record failure
    });
    throw error;
  }
}
```

### Phase 2: AST Transformation (Week 2)

**Goal**: Automatic instrumentation via build step

```typescript
// scripts/instrument-code.ts

import ts from 'typescript';

function instrumentFunction(node: ts.FunctionDeclaration): ts.FunctionDeclaration {
  // Wrap function body with tracing
  const original = node.body;
  const instrumented = ts.factory.createBlock([
    ts.factory.createReturnStatement(
      ts.factory.createCallExpression(
        ts.factory.createIdentifier('withCodeTracing'),
        undefined,
        [
          ts.factory.createStringLiteral(node.name.text),
          ts.factory.createStringLiteral(__filename),
          ts.factory.createArrowFunction(
            undefined, undefined, [], undefined,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            original
          )
        ]
      )
    )
  ]);

  return ts.factory.updateFunctionDeclaration(
    node,
    node.decorators,
    node.modifiers,
    node.asteriskToken,
    node.name,
    node.typeParameters,
    node.parameters,
    node.type,
    instrumented
  );
}
```

### Phase 3: Learning Loop (Week 3)

**Goal**: Optimize code based on traces

```typescript
// Analysis queries

// 1. Most frequently called functions
SELECT
  code_metadata.function_name,
  code_metadata.file_path,
  COUNT(*) as call_count,
  AVG(latency_ms) as avg_latency,
  SUM(cost_usd) as total_cost
FROM impulse_resolutions
WHERE resolver_tier = 'deterministic'
GROUP BY code_metadata.function_name, code_metadata.file_path
ORDER BY call_count DESC
LIMIT 100;

// 2. Slowest functions (optimization targets)
SELECT
  code_metadata.function_name,
  AVG(latency_ms) as avg_latency,
  MAX(latency_ms) as max_latency,
  COUNT(*) as call_count
FROM impulse_resolutions
WHERE resolver_tier = 'deterministic'
GROUP BY code_metadata.function_name
HAVING AVG(latency_ms) > 100
ORDER BY avg_latency DESC;

// 3. Most unreliable functions
SELECT
  code_metadata.function_name,
  COUNT(CASE WHEN success = false THEN 1 END) as failures,
  COUNT(*) as total,
  (COUNT(CASE WHEN success = false THEN 1 END) * 100.0 / COUNT(*)) as failure_rate
FROM impulse_resolutions
WHERE resolver_tier = 'deterministic'
GROUP BY code_metadata.function_name
HAVING failure_rate > 5
ORDER BY failure_rate DESC;
```

## Usage Analysis Examples

### Example 1: Find Dead Code

```typescript
// Query functions never called in traces
const allFunctions = await parseCodebase('src/');
const calledFunctions = await queryTraces(`
  SELECT DISTINCT code_metadata.function_name
  FROM impulse_resolutions
`);

const deadCode = allFunctions.filter(
  fn => !calledFunctions.includes(fn.name)
);

console.log('Dead code candidates:', deadCode);
```

### Example 2: Optimize Hot Paths

```typescript
// Find functions called > 1000 times
const hotFunctions = await queryTraces(`
  SELECT
    code_metadata.function_name,
    code_metadata.file_path,
    COUNT(*) as calls,
    AVG(latency_ms) as avg_latency
  FROM impulse_resolutions
  GROUP BY code_metadata.function_name, code_metadata.file_path
  HAVING calls > 1000
  ORDER BY calls * avg_latency DESC
`);

// Generate optimization activities
for (const fn of hotFunctions) {
  await createActivity({
    name: `optimize-${fn.function_name}`,
    goal: `Optimize ${fn.function_name} - called ${fn.calls} times, avg ${fn.avg_latency}ms`,
    impulses: [
      { type: 'file', path: fn.file_path },
      { type: 'executionTraceList', filters: { functionName: fn.function_name } }
    ]
  });
}
```

### Example 3: Detect Impulse Transformation Patterns

```typescript
// Find common impulse transformation chains
const patterns = await queryTraces(`
  WITH transforms AS (
    SELECT
      code_metadata.function_name,
      code_metadata.input_shapes,
      code_metadata.output_shapes
    FROM impulse_resolutions
  )
  SELECT
    input_shapes,
    function_name,
    output_shapes,
    COUNT(*) as frequency
  FROM transforms
  GROUP BY input_shapes, function_name, output_shapes
  ORDER BY frequency DESC
  LIMIT 50
`);

// Learn: "file + error_log → bug_report" is common
// Optimize: Create deterministic template for this pattern
```

## Performance Considerations

### 1. Sampling Strategy
- **Production**: 1% sample rate (1 in 100 calls traced)
- **Development**: 100% (all calls traced)
- **Hot functions**: Adaptive sampling (reduce rate for frequently-called)

### 2. Overhead Budget
- **Target**: < 5% performance overhead
- **Mechanism**:
  - Fast path checks (tracer enabled?)
  - Lazy serialization (only on sample)
  - Async writes (don't block execution)

### 3. Storage
- **Local**: Circular buffer (keep last 10,000 traces)
- **Backend**: Compress and batch upload
- **Retention**: 30 days hot, 1 year cold storage

## Benefits

### 1. Automatic Refactoring
- Dead code elimination based on actual usage
- Function inlining for hot paths
- Cache expensive computations

### 2. Reliability Improvements
- Identify brittle functions (high failure rate)
- Generate test cases from real execution traces
- Detect error patterns

### 3. Performance Optimization
- Profile-guided optimization
- Identify expensive operations
- Suggest architectural improvements

### 4. Thompson Sampling for Code
- Learn which implementations work best
- A/B test code variants in production
- Continuous improvement loop

## Example Activity: Code Optimization

```json
{
  "id": "optimize-hot-function",
  "name": "Optimize High-Usage Function",
  "tasks": [
    {
      "id": "analyze_usage",
      "description": "Analyze function usage patterns from traces",
      "impulses": ["executionTraceList"],
      "prompt": {
        "template": "Analyze execution traces for {{functionName}}. Identify:\n1. Input patterns (what shapes flow in)\n2. Output patterns (what shapes flow out)\n3. Common failure modes\n4. Performance characteristics"
      }
    },
    {
      "id": "suggest_optimization",
      "description": "Suggest optimization strategies",
      "impulses": ["file", "usage_analysis"],
      "prompt": {
        "template": "Based on usage patterns, suggest optimizations for {{functionName}}:\n1. Can we cache results?\n2. Can we batch operations?\n3. Can we use a faster algorithm?\n4. Can we make it deterministic?"
      }
    },
    {
      "id": "implement_optimization",
      "description": "Implement the optimization",
      "impulses": ["file", "optimization_strategy"],
      "resolver": "code_transformer",
      "config": {
        "preserveSemantics": true,
        "addTests": true
      }
    }
  ]
}
```

## Next Steps

1. **Implement `withCodeTracing()` utility** (1 day)
2. **Instrument critical paths** in `src/activity.ts`, `src/impulse.ts` (1 day)
3. **Create analysis activity** to query traces (1 day)
4. **Run for 1 week** collecting data
5. **Generate first optimization report** showing usage patterns
6. **Iterate**: Use learnings to optimize MiniBob itself

This creates a **self-improving feedback loop** where MiniBob learns from its own execution and optimizes itself.
