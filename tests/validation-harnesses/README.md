# GAP-9 Validation Harness

## Overview

This directory contains validation harnesses for automated testing of GAP-9 specifications without requiring LLM intervention.

## GAP-9 Deployment JWT Fix & E2E Validation Harness

**File**: `GAP-9-deployment-jwt-fix-and-e2e-validation-harness.ts`

### Purpose

Validates the complete GAP-9 multi-tenant learning loop implementation:
1. JWT_SECRET_KEY configuration (86 chars from ConfigMap)
2. RPC API pod health (no crash-loop)
3. CLI activity submission via API key
4. Dashboard query returns activities with org_id isolation

### Usage

#### Basic Usage (Default Configuration)
```bash
npx tsx tests/validation-harnesses/GAP-9-deployment-jwt-fix-and-e2e-validation-harness.ts
```

#### Custom Configuration
```bash
npx tsx tests/validation-harnesses/GAP-9-deployment-jwt-fix-and-e2e-validation-harness.ts \
  <namespace> \
  <configMapName> \
  <deploymentName> \
  <expectedJWTLength> \
  <testScriptPath> \
  <run-playwright|skip-playwright>
```

**Example**:
```bash
npx tsx tests/validation-harnesses/GAP-9-deployment-jwt-fix-and-e2e-validation-harness.ts \
  metabob \
  universal-config \
  metabob-rpc-api \
  86 \
  ./final_test.sh \
  skip-playwright
```

#### With Playwright Tests
```bash
npx tsx tests/validation-harnesses/GAP-9-deployment-jwt-fix-and-e2e-validation-harness.ts \
  metabob universal-config metabob-rpc-api 86 ./final_test.sh run-playwright
```

### Output

The harness outputs results to:
- Console (formatted with ✅/❌ indicators)
- JSON file: `/tmp/gap9-validation-result.json`

**Exit Codes**:
- `0` - All validations passed
- `1` - One or more validations failed

### Validation Steps

1. **JWT Config Validation** - Checks JWT_SECRET_KEY exists as top-level ConfigMap key
2. **JWT Length Validation** - Verifies JWT_SECRET_KEY is >= 86 characters
3. **Pod Health Validation** - Ensures RPC API pods are Running with no JWT errors
4. **E2E Test (final_test.sh)** - Validates complete data flow (4 steps)
5. **Playwright Test** (optional) - UI validation at app.metabob.local

### Example Output

```
🔍 Starting GAP-9 Validation Harness...

[1/5] Validating JWT_SECRET_KEY in ConfigMap...
  ✅ JWT_SECRET_KEY present as top-level key

[2/5] Validating JWT_SECRET_KEY length...
  ✅ Length: 86 (expected: >=86)

[3/5] Validating RPC API pod health...
  ✅ Running with successful startup

[4/5] Running final_test.sh (GAP-9 E2E validation)...
  ✅ All 4 steps passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ GAP-9 Validation PASSED - All checks successful
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Results written to: /tmp/gap9-validation-result.json
```

### Programmatic Usage

```typescript
import { runValidation } from './tests/validation-harnesses/GAP-9-deployment-jwt-fix-and-e2e-validation-harness';

const result = runValidation({
  namespace: 'metabob',
  configMapName: 'universal-config',
  deploymentName: 'metabob-rpc-api',
  expectedJWTLength: 86,
  testScriptPath: './final_test.sh',
  skipPlaywright: true
});

if (result.pass) {
  console.log('✅ Validation passed:', result.summary);
} else {
  console.error('❌ Validation failed:', result.summary);
  console.error('Details:', result.results);
}
```

### Test Cases

#### Test Case 1: JWT Configuration
**Input**: `{ namespace: "metabob", configMapName: "universal-config", expectedJWTLength: 86 }`  
**Expected**: JWT_SECRET_KEY present as top-level key with 86 characters

#### Test Case 2: Pod Health
**Input**: `{ namespace: "metabob", deploymentName: "metabob-rpc-api" }`  
**Expected**: Pods Running with successful startup, no JWT CRITICAL errors

#### Test Case 3: E2E Data Flow
**Input**: `{ testScriptPath: "./final_test.sh" }`  
**Expected**: All 4 steps passed (user registration, API key creation, activity posting, dashboard query)

### Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Run GAP-9 Validation
  run: |
    npx tsx tests/validation-harnesses/GAP-9-deployment-jwt-fix-and-e2e-validation-harness.ts
  continue-on-error: false
```

### Troubleshooting

**Issue**: JWT_SECRET_KEY not found in ConfigMap  
**Fix**: Run `kubectl apply -f /tmp/universal-config-patch.yaml` to add top-level key

**Issue**: Pod health check fails with JWT errors  
**Fix**: Ensure deployment has JWT_SECRET_KEY environment variable with valueFrom configMapKeyRef

**Issue**: final_test.sh fails  
**Fix**: Check RPC API logs for detailed error messages, verify SurrealDB connection

### Historical Test Data

Test case impulses are stored as:
- `validation-GAP-9-deployment-jwt-fix-and-e2e-validation-case-1`
- `validation-GAP-9-deployment-jwt-fix-and-e2e-validation-case-2`
- `validation-GAP-9-deployment-jwt-fix-and-e2e-validation-case-3`

These can be used for regression testing without LLM involvement.

### Maintenance

To update test expectations, modify the test case JSON files in `/tmp/test-case-*.json` and recreate the impulses.
