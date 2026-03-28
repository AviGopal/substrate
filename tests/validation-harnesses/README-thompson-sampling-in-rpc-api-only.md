# Thompson Sampling Architectural Boundary Validation Harness

**Specification**: `thompson-sampling-in-rpc-api-only`

## Overview

This validation harness verifies the architectural boundary: **Thompson Sampling (Beta distribution variant selection) must ONLY exist in metabob-rpc-api. metabob-opencode must delegate to the RPC API endpoint.**

## Validation Strategy

The harness performs **static code analysis** without requiring:
- Runtime execution
- LLM inference
- External dependencies

It searches for ML implementation keywords and verifies the architectural contract through grep-based pattern matching.

## Test Cases

### Test Case 1: No ML Implementation in OpenCode
**Impulse ID**: `validation-thompson-sampling-in-rpc-api-only-case-1`

Searches `repos/metabob-opencode/packages/opencode/src/**/*.ts` for:
- `thompson`
- `beta`
- `betavariate`
- `sample_beta`
- `sampleBeta`
- `Math.random` (with alpha/beta context)

**Allowed References**:
- Type definitions (e.g., `thompsonSampling?: { ... }`)
- Metadata fields (e.g., `alpha: number`, `beta: number`)
- Comments and documentation
- Result fields from RPC API responses

**Expected Result**: 0 matches (only metadata references allowed)

### Test Case 2: RPC API Has Thompson Sampling Implementation
**Impulse ID**: `validation-thompson-sampling-in-rpc-api-only-case-2`

Verifies `repos/metabob-rpc-api/server/actions/activity.py` contains:
- `def sample_beta(alpha, beta)`
- `def select_variant_thompson_sampling()`
- `random.betavariate(alpha, beta)`

**Expected Result**: All 3 functions found

### Test Case 3: RPC API Exposes Template Selection Endpoint
**Impulse ID**: `validation-thompson-sampling-in-rpc-api-only-case-3`

Verifies `repos/metabob-rpc-api/server/routes/activity.py` contains:
- Route: `POST /v2/activities/templates/{activity_id}/select`
- Handler: `select_variant_thompson_sampling`

**Expected Result**: Both route and handler found

### Test Case 4: OpenCode Delegates to RPC API
**Impulse ID**: `validation-thompson-sampling-in-rpc-api-only-case-4`

Verifies `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`:
- Has RPC delegation: `RpcHttpClient.selectTemplateVariant()`
- NO forbidden patterns: `Math.random`, `betavariate`, `sampleBeta`, `sample_beta`

**Expected Result**: Delegation found, no forbidden patterns

## Usage

### Quick Run (Bash)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bash tests/validation-harnesses/run-thompson-sampling-validation.sh
```

**Exit Codes**:
- `0`: All validations passed
- `1`: One or more validations failed

### TypeScript Harness (Advanced)
```bash
npx ts-node tests/validation-harnesses/run-thompson-sampling-validation.ts
```

This loads the full harness with detailed results and saves JSON output to:
`tests/validation-harnesses/validation-results-thompson-sampling.json`

## Files

### Harness Implementation
- `thompson-sampling-in-rpc-api-only-harness.ts` - TypeScript validation harness
- `run-thompson-sampling-validation.sh` - Bash runner script (recommended)
- `run-thompson-sampling-validation.ts` - TypeScript runner script

### Test Case Definitions
- `test-cases/thompson-sampling-case-1.json` - No ML keywords in opencode
- `test-cases/thompson-sampling-case-2.json` - RPC API has Thompson Sampling
- `test-cases/thompson-sampling-case-3.json` - RPC API exposes endpoint
- `test-cases/thompson-sampling-case-4.json` - OpenCode delegates to RPC API

### Results
- `validation-results-thompson-sampling.json` - Latest validation results

## Harness Impulse

**Impulse ID**: `harness-thompson-sampling-in-rpc-api-only`
**Type**: `file`
**Pointer**: `tests/validation-harnesses/thompson-sampling-in-rpc-api-only-harness.ts`
**Budget**: 2000 tokens

This impulse can be loaded by downstream tasks to access the validation harness without re-scanning the codebase.

## Integration with CI/CD

Add to pre-push hooks or CI pipeline:
```bash
# .git/hooks/pre-push or .github/workflows/validate.yml
bash tests/validation-harnesses/run-thompson-sampling-validation.sh || {
  echo "❌ Thompson Sampling architectural boundary violated!"
  echo "   ML logic must reside ONLY in metabob-rpc-api"
  exit 1
}
```

## Interpretation of Results

### ✅ All Validations Passed
The Thompson Sampling architectural boundary is correctly enforced:
- No local ML implementation in metabob-opencode
- Thompson Sampling exists in metabob-rpc-api
- RPC API endpoint is accessible
- OpenCode delegates via HTTP

### ❌ Validation Failed

**Test 1 Failed**: ML implementation found in opencode
- **Action**: Remove Beta sampling logic from opencode
- **Reference**: Architectural spec requires delegation to RPC API

**Test 2 Failed**: Missing Thompson Sampling in RPC API
- **Action**: Implement `sample_beta()` and `select_variant_thompson_sampling()` in rpc-api
- **Reference**: `repos/metabob-rpc-api/server/actions/activity.py`

**Test 3 Failed**: Missing RPC API endpoint
- **Action**: Add POST route in `repos/metabob-rpc-api/server/routes/activity.py`
- **Expected**: `POST /v2/activities/templates/{activity_id}/select`

**Test 4 Failed**: OpenCode not delegating to RPC API
- **Action**: Add `RpcHttpClient.selectTemplateVariant()` call in template-selector.ts
- **Remove**: Any local `Math.random`, `betavariate`, or `sampleBeta` implementations

## Historical Context

This harness validates the architectural refactoring that moved Thompson Sampling from metabob-opencode to metabob-rpc-api. The boundary enforcement ensures:

1. **Separation of Concerns**: ML logic in rpc-api, execution logic in opencode
2. **Easier Testing**: ML algorithms can be tested independently
3. **Scalability**: RPC API can be scaled separately for ML workloads
4. **Maintainability**: ML changes don't require opencode redeployment

## Related Specifications

- `trace-thompson-sampling-in-rpc-api-only` - Trace impulse with component analysis
- `enforcement-thompson-sampling-in-rpc-api-only` - Enforcement summary
- `TRACE_thompson-sampling-in-rpc-api-only.json` - Full trace data
- `ENFORCEMENT_thompson-sampling-in-rpc-api-only.json` - Enforcement report
