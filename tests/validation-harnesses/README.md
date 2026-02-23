# Validation Harnesses

This directory contains validation harnesses for testing specifications without requiring LLM execution.

## Purpose

Validation harnesses are:
- **Deterministic**: Same input always produces same output
- **Fast**: No LLM calls, just pure computation
- **Historical**: Test cases stored as impulses can be rerun anytime
- **Regression-proof**: Catches bugs when specifications are changed

## Structure

Each harness follows this pattern:

```typescript
// 1. Define types matching the implementation
interface Input { ... }
interface Expected { ... }

// 2. Mirror the transformation logic
function transform(input: Input): Output { ... }

// 3. Define test cases
export const testCases: ValidationCase[] = [...]

// 4. Validation function
export function runValidation(testCase): {pass, actual, expected, errors}

// 5. Bun test suite
describe("Feature Name", () => { ... })
```

## Running Tests

```bash
# Run specific harness
bun test ./tests/validation-harnesses/activity-progress-tracking-data-flow-harness.ts

# Run all harnesses
bun test tests/validation-harnesses/
```

## Creating New Harnesses

Use the trace-enforce-validate loop:

1. **Trace**: Document current vs desired behavior
2. **Enforce**: Apply code changes to close gaps
3. **Validate**: Create harness to prevent regression

Example workflow:
```bash
# 1. Trace the specification
opencode activity trace-data-flow-single-feature \
  --spec "my-feature-data-flow" \
  --output trace-my-feature.impulse

# 2. Enforce the specification
opencode activity enforce-specification \
  --spec "my-feature-data-flow" \
  --trace trace-my-feature.impulse

# 3. Create validation harness
opencode activity create-validation-harness \
  --spec "my-feature-data-flow" \
  --output tests/validation-harnesses/my-feature-harness.ts
```

## Harnesses

### activity-progress-tracking-data-flow-harness.ts

**Purpose**: Validates activity progress tracking transformations

**What it tests**:
- Prompt counting (committed/executing = current progress)
- Percentage calculation with Math.round()
- Elapsed time calculation and formatting
- Progress bar rendering
- Edge cases (0%, 100%, fractional percentages, skipped tasks)

**Test cases**: 7 cases covering all transformations

**Run**: `bun test ./tests/validation-harnesses/activity-progress-tracking-data-flow-harness.ts`

**Status**: ✅ All 7 tests passing

## Test Case Impulses

Each test case is also stored as an impulse for historical reference:

- `validation-activity-progress-tracking-data-flow-case-1`: Spec example (3/5 tasks, 204s)
- `validation-activity-progress-tracking-data-flow-case-2`: Fractional % round up (66.666% → 67%)
- `validation-activity-progress-tracking-data-flow-case-3`: Fractional % round down (33.333% → 33%)
- `validation-activity-progress-tracking-data-flow-case-4`: Zero progress
- `validation-activity-progress-tracking-data-flow-case-5`: 100% complete
- `validation-activity-progress-tracking-data-flow-case-6`: Long-running with hours
- `validation-activity-progress-tracking-data-flow-case-7`: Skipped tasks excluded

These impulses can be loaded and executed without LLM for regression testing.
