# Validation Harnesses

This directory contains validation harnesses for architectural specifications.

## Purpose

Validation harnesses are **deterministic, LLM-free tests** that verify architectural boundaries and specifications. They:
- Load application/component code
- Perform static or dynamic analysis
- Return PASS/FAIL based on objective criteria
- Can be run repeatedly without LLM invocation

## Structure

Each harness follows this pattern:

```
<spec-name>-harness.ts
  ├── ValidationCase interface (input + expectedOutput)
  ├── ValidationResult interface (pass/fail + actual vs expected)
  ├── runValidation(testCase) => ValidationResult
  └── CLI execution (if run directly)
```

## Available Harnesses

### metrics-calculation-in-rpc-api-only-harness.ts

**Specification:** Metrics calculations must exist ONLY in metabob-rpc-api, not in metabob-opencode.

**Validation Strategy:** Static analysis of `template-metrics-client.ts` to verify:
- No calculation logic (arithmetic operations: `/`, `*`, `Math.*`)
- No Redis writes (`redis.set`, `redis.hset`)
- No JSON file writes
- Only contains client code (MCP calls, logging, error handling)

**Run:**
```bash
npx tsx tests/validation-harnesses/metrics-calculation-in-rpc-api-only-harness.ts
```

**Expected Output:**
```
Test Case 1: template-metrics-client.ts has no calculations
✅ PASS - File is a thin HTTP client with no calculations

Total: 1 | Passed: 1 | Failed: 0
```

## Adding New Harnesses

1. **Create harness file:** `<spec-name>-harness.ts`
2. **Define test cases:** Input + expected output
3. **Implement validation logic:** Static or runtime analysis
4. **Add CLI execution:** For standalone testing
5. **Document in this README**

## Integration with Trace-Enforce-Validate Loop

Harnesses are created during the **VALIDATE** phase of the trace-enforce-validate loop:

1. **TRACE:** Understand current implementation → create trace impulse
2. **ENFORCE:** Apply changes to close gaps → create enforcement impulse
3. **VALIDATE:** Create harness to verify spec → create harness impulse

Harnesses persist as regression tests - they can be run anytime to verify the specification remains enforced.

## Impulse Integration

Each harness is stored as an impulse for cross-agent access:

```typescript
impulse_create({
  id: "harness-<spec-name>",
  type: "file",
  pointer: {
    type: "file",
    path: "tests/validation-harnesses/<spec-name>-harness.ts"
  },
  budget: 2000
})
```

Test cases are also stored as impulses:

```typescript
impulse_create({
  id: "validation-<spec-name>-case-1",
  type: "memo",
  pointer: {
    type: "memo",
    content: {
      input: {...},
      expectedOutput: {...}
    }
  },
  budget: 500
})
```

## Benefits

- ✅ **Deterministic:** Same input always produces same output
- ✅ **Fast:** No LLM invocation, runs in milliseconds
- ✅ **Regression-safe:** Can be run in CI/CD to prevent regressions
- ✅ **Historical:** Test cases are frozen snapshots of expected behavior
- ✅ **Cross-agent:** Impulses allow agents to share validation logic
