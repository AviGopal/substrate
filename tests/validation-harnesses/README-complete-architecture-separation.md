# Validation Harness: Complete Architecture Separation

## Overview

This validation harness validates the three-component architecture has clean separation:
- **metabob-opencode**: Execution + Coordination (ZERO ML logic)
- **metabob-cli**: Data Collection + Enrichment + Gateway (ZERO ML logic)
- **metabob-rpc-api**: ML Training + Metrics + Storage (ALL ML logic)

## Files

1. **complete-architecture-separation-harness.ts** - Main validation harness (10 test cases)
2. **run-complete-architecture-separation-validation.ts** - Runner script with results output
3. **impulses/harness-complete-architecture-separation.json** - Harness impulse
4. **impulses/validation-complete-architecture-separation-cases.json** - Test cases impulse

## Test Cases

### 1. Zero ML Keywords in metabob-opencode
- **Strategy:** Grep search for ML keywords
- **Pattern:** `thompson|beta_distribution|sampleBeta|sampleGamma|pattern_extraction`
- **Expected:** 0 matches (only metadata references allowed)

### 2. Zero Training Logic in metabob-cli
- **Strategy:** Grep search for training keywords
- **Pattern:** `train|fit_model|sampleBeta|sampleGamma`
- **Expected:** 0 matches

### 3. All Thompson Sampling in metabob-rpc-api
- **Strategy:** Grep search for Thompson Sampling keywords
- **Pattern:** `select_variant_thompson_sampling|thompson_alpha|thompson_beta`
- **Expected:** ≥40 matches (all ML logic in RPC API)

### 4. Data Flow via HTTP (CLI → RPC API)
- **Strategy:** Grep search for HTTP client usage
- **Pattern:** `http://localhost:8080|METABOB_RPC_API_URL|rpc.*api`
- **Expected:** ≥40 matches (CLI proxies to RPC API)

### 5. thompson-sampler.ts File Deleted
- **Strategy:** File existence check
- **File:** `repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler.ts`
- **Expected:** File does not exist

### 6. template-selector.ts Delegates to RPC API
- **Strategy:** File content validation
- **File:** `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
- **Expected:** Contains delegation comments and RPC API endpoint references

### 7. activity.ts Has No Thompson Sampling Calculations
- **Strategy:** File content validation (forbidden patterns)
- **File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- **Expected:** Does not contain Beta distribution calculations

### 8. MCP Tools in CLI are Pure Proxies
- **Strategy:** File content validation (required pattern)
- **File:** `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
- **Expected:** ≥5 occurrences of `call_api` (proxy pattern)

### 9. RPC API Has select_variant_thompson_sampling Endpoint
- **Strategy:** File content validation
- **File:** `repos/metabob-rpc-api/server/actions/activity.py`
- **Expected:** Contains Thompson Sampling implementation

### 10. SurrealDB Schema Has Required Tables
- **Strategy:** Schema validation
- **File:** `initialize-surrealdb-schema.sql`
- **Expected:** Contains `activity_execution`, `template_metrics`, `activity_template` tables

## Usage

### Direct Execution
```bash
npx tsx tests/validation-harnesses/complete-architecture-separation-harness.ts
```

### Via Runner (with results file)
```bash
npx tsx tests/validation-harnesses/run-complete-architecture-separation-validation.ts
```

Output: `tests/validation-harnesses/validation-results-complete-architecture-separation.json`

### Exit Codes
- **0**: All tests passed
- **1**: At least one test failed

## Features

✅ **No LLM Required** - Pure static analysis and file checks
✅ **Deterministic** - Same input always produces same output
✅ **Historical** - Can be run anytime without external dependencies
✅ **Fast** - Completes in seconds
✅ **Comprehensive** - Validates at multiple levels (code, API, schema)

## Validation Strategy

1. **Grep searches** - Find ML keywords in each repo
2. **API contracts** - Verify opencode calls rpc-api endpoints, not local logic
3. **SurrealDB schema** - Verify all required tables exist
4. **File existence** - Verify thompson-sampler.ts deleted
5. **Content validation** - Verify delegation comments and patterns

## Expected Results

All 10 test cases should pass after architecture separation enforcement:

```
Running Complete Architecture Separation Validation Harness...
================================================================================

Running: opencode-ml-keywords...
  Result: ✅ PASS
  Reason: Zero ML keywords found in opencode (only metadata references)

Running: cli-training-logic...
  Result: ✅ PASS
  Reason: Zero training logic found in CLI

Running: rpc-api-thompson-sampling...
  Result: ✅ PASS
  Reason: Found 41 Thompson Sampling references in RPC API (all ML logic correctly located)

Running: data-flow-http...
  Result: ✅ PASS
  Reason: Found 44 HTTP calls to RPC API (CLI correctly acts as gateway)

Running: thompson-sampler-deleted...
  Result: ✅ PASS
  Reason: thompson-sampler.ts correctly deleted from opencode

Running: template-selector-delegation...
  Result: ✅ PASS
  Reason: template-selector.ts correctly delegates Thompson Sampling to RPC API

Running: activity-no-thompson-calculations...
  Result: ✅ PASS
  Reason: activity.ts correctly has no Thompson Sampling calculations

Running: mcp-tools-proxy...
  Result: ✅ PASS
  Reason: MCP tools correctly use call_api proxy (XX occurrences)

Running: rpc-api-endpoint...
  Result: ✅ PASS
  Reason: RPC API correctly implements select_variant_thompson_sampling

Running: surrealdb-schema...
  Result: ✅ PASS
  Reason: SurrealDB schema has all required tables

================================================================================

Validation Summary:
  Total: 10
  Passed: 10
  Failed: 0
  Overall: ✅ PASS
================================================================================
```

## Troubleshooting

### Test Case 1 Fails (ML keywords found in opencode)
- Check for new ML code added to opencode
- Verify `thompson-sampler.ts` is deleted
- Check `activity.ts` for Beta distribution calculations

### Test Case 3 Fails (Thompson Sampling not in RPC API)
- Verify `repos/metabob-rpc-api/server/actions/activity.py` exists
- Check for `select_variant_thompson_sampling` function

### Test Case 5 Fails (thompson-sampler.ts still exists)
- Run enforcement step to delete the file
- Verify git commit applied correctly

### Test Case 6 Fails (template-selector.ts missing delegation)
- Check `template-selector.ts` for RPC API delegation comments
- Verify refactoring completed correctly

### Test Case 10 Fails (SurrealDB schema missing tables)
- Check `initialize-surrealdb-schema.sql` exists
- Verify table definitions present

## Related Documents

- **Trace:** `impulses/trace-complete-architecture-separation.json`
- **Enforcement:** `impulses/enforcement-complete-architecture-separation.json`
- **Summary:** `ENFORCEMENT_COMPLETE_ARCHITECTURE_SEPARATION.md`

## Maintenance

This harness should be run:
1. **After enforcement** - Verify changes applied correctly
2. **Before deployment** - Ensure architecture compliance
3. **In CI/CD** - Automated regression testing
4. **After codebase changes** - Catch architectural drift

## License

Part of the metabob-devbob project.
