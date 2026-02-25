# Validation Harnesses

This directory contains automated validation harnesses for testing specifications without requiring LLM intervention.

## Purpose

Validation harnesses are deterministic test scripts that:
1. Load the application/component
2. Feed in test inputs
3. Capture actual outputs
4. Compare against expected outputs
5. Return PASS/FAIL results

## Integration Flow Sidebar - Concurrent Activities Harness

**File**: `integration-flow-sidebar-concurrent-activities-harness.ts`

**Specification**: Validates the sidebar's ability to display concurrent activities and their children across ACP contexts with accurate metrics.

### Test Coverage

1. **Tree Structure Validation**
   - Root node count
   - Total node count
   - Maximum tree depth
   - Parent-child link count

2. **Status Indicators**
   - Executing activity count (→ indicator)
   - Completed activity count (✓ indicator)
   - Failed activity count (✗ indicator)

3. **Concurrent Execution**
   - Detection of concurrent children (2+ executing)
   - Concurrent badge display
   - Concurrent count accuracy

4. **Aggregated Metrics**
   - Total cost aggregation
   - Token utilization aggregation
   - Root vs children cost breakdown

5. **ACP Child Resolution**
   - Child activities resolved from ACP agent sessions
   - Proper linking to parent activities

### Test Cases

#### Case 1: Basic Concurrent Activities
- 1 parent activity (executing)
- 3 child activities (2 executing, 1 done)
- 2 ACP-delegated children (backend, frontend agents)
- Expected: Concurrent execution detected, tree depth = 1

#### Case 2: High Concurrency
- 1 parent activity (executing)
- 5 child activities (4 executing, 1 done)
- 2 ACP-delegated children
- Expected: High concurrent count (4), proper aggregation

#### Case 3: Mixed Status with Failure
- 1 parent activity (executing)
- 3 child activities (1 executing, 1 done, 1 failed)
- No ACP delegation
- Expected: No concurrent execution (only 1 executing), failed indicator shown

### Usage

```bash
# Run all validation tests
npx tsx tests/validation-harnesses/integration-flow-sidebar-concurrent-activities-harness.ts

# Import and use programmatically
import { runValidation, runAllTests } from './integration-flow-sidebar-concurrent-activities-harness'

const result = await runValidation(testInput)
console.log(result.pass ? 'PASS' : 'FAIL')
console.log(result.errors)
```

### Output Format

```typescript
{
  pass: boolean,
  actual: {
    treeStructure: { rootNodes, totalNodes, maxDepth, parentChildLinks },
    statusIndicators: { executing, done, failed },
    concurrentExecution: { detected, concurrentCount },
    aggregatedMetrics: { totalCost, totalTokens, rootCost, childrenCost },
    acpChildren: { resolved, linkedToParent }
  },
  expected: { /* same structure */ },
  errors: string[]
}
```

## Creating New Harnesses

1. Create a new TypeScript file in this directory
2. Export `runValidation(input) => { pass, actual, expected, errors }`
3. Define test cases with input/expectedOutput pairs
4. Store test cases as impulses for historical replay
5. Create a harness impulse pointing to the file

### Template

```typescript
export interface ValidationInput {
  // Define input structure
}

export interface ValidationOutput {
  pass: boolean
  actual: any
  expected: any
  errors: string[]
}

export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  // 1. Setup test environment
  // 2. Execute test
  // 3. Capture outputs
  // 4. Compare against expected
  // 5. Return result
}
```

## Best Practices

1. **Deterministic**: Tests should produce the same results every time
2. **Isolated**: Clean up test data after execution
3. **Fast**: Tests should complete in seconds
4. **Clear Errors**: Provide specific error messages for failures
5. **Tolerances**: Use small tolerances for floating-point comparisons
6. **Backward Compatible**: Support graceful fallback for missing features
