# Validation Harnesses

This directory contains deterministic validation harnesses for enforced specifications.

## Purpose

Validation harnesses are **historical tests** that verify specifications remain enforced over time. They:

1. **Load the component** under test
2. **Feed test inputs** (stored as impulses)
3. **Capture actual outputs**
4. **Compare against expected outputs** (also stored as impulses)
5. **Return PASS/FAIL** without LLM inference

## Structure

Each harness follows this pattern:

```
tests/validation-harnesses/
├── [spec-name]-harness.ts          # Main harness file
├── [spec-name]-cases/              # Test case definitions (optional)
│   ├── case-1.json
│   ├── case-2.json
│   └── case-N.json
└── README.md                        # This file
```

## Running Harnesses

### Run a specific harness:
```bash
bun test tests/validation-harnesses/non-blocking-instrumentation-harness.ts
```

### Run all harnesses:
```bash
bun test tests/validation-harnesses/
```

## Available Harnesses

### non-blocking-instrumentation-harness.ts

**Specification**: Activity instrumentation must never block execution or cause failures if backend unavailable.

**Test Cases**:
- Case 1: Backend returns 500 errors
- Case 2: MCP client throws errors
- Case 3: MCP client unavailable
- Case 4: Backend timeouts

**Expected Behavior**: All cases should result in completed activity status with graceful degradation logs.

### activity-state-transformation-tracking-harness.ts

**Specification**: All activity executions must track complete state transformations from instructional to functional state (PHASE_2_INSTRUMENTATION_DESIGN.md commit 1091779).

**Test Cases**:
- Case 1: Hello World Minimal - Single-task activity with basic variable
- Case 2: Multi-Task Activity - Multiple tasks to verify state tracking across tasks
- Case 3: Backend Unavailable - Verifies non-blocking design

**Expected Behavior**: 
- POST to `/api/v1/activity-execution/content` with template_definition, variable_bindings, initial_state, reason
- POST to `/api/v1/activity-execution/tasks` for each task with state_before
- PATCH to `/api/v1/activity-execution/tasks/:id` after task completion with state_after, state_delta, validation_results
- Execution continues successfully even if backend unavailable (non-blocking)

### impulse-usage-tracking-harness.ts

**Specification**: All task executions must track impulse loading and creation to learn optimal context strategies (commit 1091779).

**Test Cases**:
- Case 1: Activity with impulses - Verifies impulsesLoaded array is non-empty, contextRatio calculated
- Case 2: Activity creating impulses - Verifies impulsesCreated array is populated
- Case 3: Context ratio calculation - Verifies contextRatio = impulseTokens / totalInputTokens

**Expected Behavior**:
- `impulses_loaded`: array of impulse IDs (non-empty when impulses used)
- `impulses_created`: array of new impulse IDs (may be empty)
- `context_ratio`: number between 0 and 1 (context tokens / total tokens)
- `tokens`: breakdown object with {input, output, cache} fields

**Learning System Impact**: Enables tracking of impulse load frequency, token consumption, cost attribution, and context efficiency to optimize context strategies.

## Creating New Harnesses

When enforcing a new specification:

1. Create `[spec-name]-harness.ts` file
2. Define test cases with expected inputs/outputs
3. Implement `runValidation(testCase)` function
4. Store test cases as impulses (optional, for large datasets)
5. Add Bun test integration
6. Document in this README

## Test Case Impulses

Test cases can be stored as impulses for:
- Version control of expected behaviors
- Sharing test cases across sessions
- Historical tracking of specification changes
- Lazy loading of large test datasets

Impulse format:
```json
{
  "id": "validation-[spec-name]-case-N",
  "type": "memo",
  "pointer": {
    "type": "memo",
    "content": {
      "input": { ... },
      "expectedOutput": { ... }
    }
  },
  "budget": 2000
}
```

## Maintenance

- Run harnesses in CI/CD pipeline before merging changes
- Update harnesses when specifications evolve
- Add new test cases when edge cases are discovered
- Archive obsolete harnesses (don't delete - historical record)
