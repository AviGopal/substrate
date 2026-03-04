# Validation Harness: Dynamic Activity Lifecycle with Trailblazing (Pass 3)

## Purpose

Validates the fixes applied in Pass 3 for the dynamic-activity-lifecycle-with-trailblazing specification.

## Fixes Validated

1. **Template ID Mismatch Fix**: `ActivityTemplate.isMetaTemplate()` now includes `'create-activity'` (not just `-self-contained` variants)
2. **MCP Timeout Fix**: Registration timeout increased from 5s to 15s for K8s environments

## Usage

### Local Code Validation Only (No K8s Required)

```bash
npx tsx tests/validation-harnesses/dynamic-activity-lifecycle-with-trailblazing-pass3-harness.ts --skip-k8s
```

This will:
- ✅ Verify code changes in source files
- ✅ Validate isMetaTemplate() implementation
- ✅ Check timeout values
- ⏭️ Skip K8s integration tests

### Full Integration Validation (Requires K8s)

```bash
npx tsx tests/validation-harnesses/dynamic-activity-lifecycle-with-trailblazing-pass3-harness.ts
```

This will:
- ✅ Verify code changes in source files
- ✅ Validate isMetaTemplate() implementation
- ✅ Check K8s pods (devbob, surrealdb)
- ✅ Execute create-activity in devbob pod
- ✅ Verify trailblazing auto-enabled
- ✅ Verify context injection
- ✅ Verify template registration
- ✅ Query SurrealDB for persistence

## Test Cases

See `dynamic-activity-lifecycle-with-trailblazing-pass3-test-cases.json` for expected inputs and outputs.

### Case 1: Local Code Validation
- **Input**: `skipK8sValidation: true`
- **Expected**: Code fixes verified, no K8s tests

### Case 2: Full K8s Integration
- **Input**: `skipK8sValidation: false`
- **Expected**: All validations pass including integration tests

### Case 3: MCP Registration Timeout
- **Input**: Executes activity with template registration
- **Expected**: Registration completes within 15s (not timeout)

## Validation Strategy

### 1. Code Trace Validation
- Reads `activity-template.ts` and checks `isMetaTemplate()` function
- Verifies `"create-activity"` is in metaTemplateIds array
- Reads `template-service-client.ts` and checks timeout value
- Verifies timeout is >= 15000ms

### 2. Unit Test Validation
- Analyzes code to confirm `isMetaTemplate('create-activity')` will return true
- No actual TypeScript compilation required

### 3. Backend Validation
- Checks if devbob pod exists in K8s
- Checks if SurrealDB pod exists in K8s
- Queries SurrealDB schema for activity tables

### 4. Integration Test Validation
- Executes `opencode activity --template create-activity` in devbob pod
- Captures output and searches for:
  - `"auto-enabling trailblazing"` (confirms Fix 1 works)
  - `"injecting similar activity context"` (confirms Fix 1 works)
  - `"registerTemplate completed"` (confirms Fix 2 works)
- Extracts activity ID from output
- Measures registration time (should be < 15s)

## Success Criteria

### Minimum (Local Only)
- ✅ `isMetaTemplate()` includes `"create-activity"`
- ✅ Timeout value is 15000ms or higher
- ✅ Code analysis confirms fix applied

### Full (K8s Integration)
- ✅ All minimum criteria
- ✅ Logs show "auto-enabling trailblazing for meta-template"
- ✅ Logs show "injecting similar activity context for meta-template"
- ✅ Template registration completes within 15s
- ✅ SurrealDB contains activity_template record

## Output

Results are written to `validation-results-pass3.json` with:
- `pass`: boolean (true if all validations passed)
- `timestamp`: ISO 8601 timestamp
- `actual`: Actual validation results
- `expected`: Expected validation results

Exit code:
- `0`: All validations passed
- `1`: One or more validations failed

## Example Output

```
================================================================================
Validation Harness: Dynamic Activity Lifecycle with Trailblazing (Pass 3)
================================================================================

1. Code Trace Validation...
✅ isMetaTemplate() includes "create-activity" (without -self-contained suffix)
✅ isMetaTemplate() still includes "create-activity-self-contained"
✅ isMetaTemplate() still includes "evolve-activity-self-contained"
✅ isMetaTemplate() still includes "debug-activity-self-contained"
✅ MCP registration timeout is 15000ms (>= 15000ms)

2. Unit Test Validation...
✅ Code analysis confirms isMetaTemplate("create-activity") will return true

3. Backend Validation...
Skipped K8s validation (skipK8sValidation=true)

4. Integration Test...
Skipped integration test (skipK8sValidation=true)

================================================================================
Result: ✅ PASS
================================================================================
```

## Related Files

- **Harness**: `dynamic-activity-lifecycle-with-trailblazing-pass3-harness.ts`
- **Test Cases**: `dynamic-activity-lifecycle-with-trailblazing-pass3-test-cases.json`
- **Trace Analysis**: `/tmp/trace-analysis-pass3.json`
- **Enforcement Summary**: `ENFORCEMENT_COMPLETE_pass3.md`

## Next Steps After Validation

1. If local validation passes but K8s integration fails:
   - Build and deploy updated code to devbob pod
   - Run full integration test again

2. If K8s integration passes:
   - Document results in VALIDATION_RESULTS_pass3.json
   - Update PASS4_FINAL_OUTCOME.md with Pass 3 completion
   - Create PR with fixes

3. If any validation fails:
   - Review failure details in validation-results-pass3.json
   - Fix issues and re-run harness
