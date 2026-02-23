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
