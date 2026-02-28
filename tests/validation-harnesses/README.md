# Validation Harnesses

This directory contains validation harnesses for architectural specifications and enforcement tasks.

## Overview

Validation harnesses are automated tests that verify architectural boundaries and specification compliance without requiring LLM assistance. They:

1. Load components/applications
2. Feed in test inputs
3. Capture actual outputs
4. Compare against expected outputs
5. Return PASS/FAIL results

## Available Harnesses

### thompson-sampling-in-rpc-api-only-harness.ts

Validates that Thompson Sampling logic has been removed from OpenCode and properly delegated to metabob-rpc-api.

**Architectural Boundary**: ML and probabilistic selection logic belongs in metabob-rpc-api, NOT metabob-opencode.

**Validation Checks**:
- ✓ No forbidden patterns (betaSample, performThompsonSampling, Gamma sampling, Box-Muller transforms)
- ✓ RpcHttpClient utility exists
- ✓ TemplateSelector refactored to use RPC API
- ✓ RPC API endpoint available (optional, requires running RPC API)

**Usage**:
```bash
# Basic validation (local checks only)
npx tsx thompson-sampling-in-rpc-api-only-harness.ts /path/to/metabob-opencode

# With RPC API endpoint check
npx tsx thompson-sampling-in-rpc-api-only-harness.ts /path/to/metabob-opencode --check-rpc

# Custom RPC API URL
METABOB_RPC_API_URL=http://localhost:8000 npx tsx thompson-sampling-in-rpc-api-only-harness.ts /path/to/metabob-opencode --check-rpc
```

**Expected Output**:
```
================================================================================
VALIDATION RESULT: PASS ✓
================================================================================

Successes:
  ✓ No forbidden Thompson Sampling patterns found in OpenCode
  ✓ RpcHttpClient utility exists
  ✓ TemplateSelector properly refactored to use RPC API

Detailed Check Results:
  Forbidden Patterns: PASS
  RPC Client Exists: PASS
  Template Selector Refactored: PASS
```

## Test Cases

Test cases are stored as impulses with the format:
- **ID**: validation-{spec-name}-case-N
- **Type**: memo
- **Content**: {input: X, expectedOutput: Y}

These are historical and can be run without LLM involvement.

## Creating New Harnesses

1. Create harness file: `tests/validation-harnesses/{spec-name}-harness.ts`
2. Export `runValidation(input) => {pass: boolean, actual, expected}`
3. Define test cases as impulses
4. Document in this README
5. Create impulse for harness file:
   - ID: harness-{spec-name}
   - Type: file
   - Pointer: tests/validation-harnesses/{spec-name}-harness.ts
   - Budget: 2000 tokens

## Running All Harnesses

```bash
# Run all validation harnesses
for harness in tests/validation-harnesses/*-harness.ts; do
  npx tsx "$harness" /path/to/repo
done
```

## CI/CD Integration

Validation harnesses should be run:
- Before deploying architectural changes
- As part of pre-commit hooks for specification enforcement
- In CI/CD pipelines to prevent regressions
- After major refactoring to verify compliance

## Troubleshooting

If a harness fails:
1. Review the violations output
2. Check the detailed check results
3. Read the enforcement summary for the specification
4. Compare current state with trace analysis
5. Re-run enforcement if needed
