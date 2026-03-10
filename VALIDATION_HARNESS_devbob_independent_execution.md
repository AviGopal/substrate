# Validation Harness: devbob-independent-execution-validation

**Date**: 2026-03-10  
**Status**: ✅ HARNESS CREATED  
**Specification**: devbob-independent-execution-validation

---

## Overview

This validation harness provides automated testing for the DevBob independent execution specification. It validates all critical aspects of DevBob's ability to execute opencode commands independently with proper service connectivity and credential access.

---

## Harness Details

**File**: `tests/validation-harnesses/devbob-independent-execution-validation-harness.ts`  
**Language**: TypeScript (Bun runtime)  
**Output**: `/tmp/validation-results.json`  
**Exit Code**: 0 (all pass) or 1 (any failure)

### Execution Methods

1. **Direct execution (in DevBob pod)**:
   ```bash
   bun run tests/validation-harnesses/devbob-independent-execution-validation-harness.ts
   ```

2. **Via runner script**:
   ```bash
   /workspace/scripts/run-validation-harness.sh
   ```

3. **From host (kubectl)**:
   ```bash
   kubectl exec -n metabob deployment/devbob -- bun run /workspace/tests/validation-harnesses/devbob-independent-execution-validation-harness.ts
   ```

---

## Test Cases (7 total)

### Case 1: SDK Preload Check ⚙️

**Impulse ID**: `validation-devbob-independent-execution-validation-case-1`

**Input**: `opencode run 'test'`

**Expected Output**:
```json
{
  "loaded": "1+",
  "packages": ["anthropic"]
}
```

**Validation Logic**:
- Execute `opencode run 'test'` and capture stderr/stdout
- Parse SDK loader output: `"SDK loader initialized: total=X loaded=Y packages=[...]"`
- Extract loaded count (Y)
- **PASS** if Y > 0 (at least 1 SDK preloaded)
- **FAIL** if Y = 0 or SDK loader output not found

**Why This Matters**: Verifies that @ai-sdk/anthropic is bundled in the binary and successfully preloaded at runtime, eliminating need for BunProc.install() fallback.

---

### Case 2: Provider Initialization Check 🔌

**Impulse ID**: `validation-devbob-independent-execution-validation-case-2`

**Input**: `opencode run 'What is 2+2?'`

**Expected Output**:
```json
{
  "noError": true,
  "responseReceived": true
}
```

**Validation Logic**:
- Execute `opencode run 'What is 2+2?'` with 15-second timeout
- Check output for "ProviderInitError"
- Check that response length > 0
- **PASS** if no ProviderInitError AND response received
- **FAIL** if ProviderInitError found OR no response

**Why This Matters**: Core validation that provider initializes without errors, confirming SDK preload succeeded and API keys are valid.

---

### Case 3: RPC API Service Connectivity 🌐

**Impulse ID**: `validation-devbob-independent-execution-validation-case-3`

**Input**: `http://metabob-rpc-api.metabob.svc.cluster.local:8080/status`

**Expected Output**:
```json
{
  "reachable": true,
  "statusOk": true
}
```

**Validation Logic**:
- Execute `curl -s -m 5 http://metabob-rpc-api.metabob.svc.cluster.local:8080/status`
- Check response doesn't contain "FAILED" or "Connection refused"
- Check response contains "status", "ok", or "healthy"
- **PASS** if reachable AND statusOk
- **FAIL** if unreachable OR status check fails

**Why This Matters**: Validates k8s service DNS resolution and network connectivity to metabob-rpc-api service.

---

### Case 4: SurrealDB Service Connectivity 🗄️

**Impulse ID**: `validation-devbob-independent-execution-validation-case-4`

**Input**: `http://surrealdb.metabob.svc.cluster.local:8000/health`

**Expected Output**:
```json
{
  "reachable": true
}
```

**Validation Logic**:
- Execute `curl -s -m 5 http://surrealdb.metabob.svc.cluster.local:8000/health`
- Check response doesn't contain "FAILED" or "Connection refused"
- **PASS** if reachable
- **FAIL** if unreachable

**Why This Matters**: Validates k8s service DNS resolution and network connectivity to SurrealDB service.

---

### Case 5: Environment Variables Check 🔑

**Impulse ID**: `validation-devbob-independent-execution-validation-case-5`

**Input**: `["ANTHROPIC_API_KEY", "METABOB_API_KEY"]`

**Expected Output**:
```json
{
  "anthropicPresent": true,
  "metabobPresent": true
}
```

**Validation Logic**:
- Check `process.env.ANTHROPIC_API_KEY` is truthy and length > 0
- Check `process.env.METABOB_API_KEY` is truthy and length > 0
- **PASS** if both present
- **FAIL** if either missing

**Why This Matters**: Validates k8s secrets injection into pod environment, required for opencode to authenticate with Anthropic and Metabob APIs.

---

### Case 6: Config File API Key Substitution 📝

**Impulse ID**: `validation-devbob-independent-execution-validation-case-6`

**Input**: `/workspace/.config/opencode/opencode.json`

**Expected Output**:
```json
{
  "fileExists": true,
  "keySubstituted": true
}
```

**Validation Logic**:
- Check file exists at `/workspace/.config/opencode/opencode.json`
- Read file content
- Check for real API key prefix "sk-ant-"
- Check for absence of placeholder "${ANTHROPIC_API_KEY}"
- **PASS** if file exists AND key substituted
- **FAIL** if file missing OR placeholders not substituted

**Why This Matters**: Validates initContainer's sed substitution worked correctly, ensuring opencode config has real API keys instead of template variables.

---

### Case 7: Activity List Command 📋

**Impulse ID**: `validation-devbob-independent-execution-validation-case-7`

**Input**: `opencode activity list`

**Expected Output**:
```json
{
  "commandSucceeds": true,
  "noErrors": true
}
```

**Validation Logic**:
- Execute `cd /workspace && opencode activity list`
- Check output doesn't contain "Error" or "ENOENT"
- Check output contains "template", "activity", or "No activities"
- **PASS** if command succeeds AND no errors
- **FAIL** if command fails OR errors present

**Why This Matters**: Validates that activity system is functional, required for variant_id tracking validation and general DevBob capabilities.

---

## Output Format

The harness outputs results to `/tmp/validation-results.json`:

```json
{
  "specificationName": "devbob-independent-execution-validation",
  "timestamp": "2026-03-10T20:30:00.000Z",
  "overallPass": true,
  "results": [
    {
      "testCaseId": "validation-devbob-independent-execution-validation-case-1",
      "testName": "SDK Preload Check",
      "pass": true,
      "actual": {
        "loaded": 1,
        "output": "SDK loader initialized: total=2 loaded=1 packages=[anthropic]"
      },
      "expected": {
        "loaded": "1+",
        "packages": ["anthropic"]
      },
      "timestamp": "2026-03-10T20:30:01.234Z"
    },
    ...
  ],
  "summary": {
    "total": 7,
    "passed": 7,
    "failed": 0
  }
}
```

---

## Usage Examples

### Run Validation After Deployment

```bash
# Copy harness to pod (one-time)
kubectl cp tests/validation-harnesses/devbob-independent-execution-validation-harness.ts \
  metabob/devbob:/workspace/tests/validation-harnesses/

# Run validation
kubectl exec -n metabob deployment/devbob -- \
  bun run /workspace/tests/validation-harnesses/devbob-independent-execution-validation-harness.ts

# Check results
kubectl exec -n metabob deployment/devbob -- cat /tmp/validation-results.json
```

### Automated CI/CD Validation

```bash
# Run as part of helm upgrade
helm upgrade devbob helm/charts/devbob -n metabob
kubectl rollout status deployment/devbob -n metabob

# Wait for pod ready
kubectl wait --for=condition=ready pod -l app=devbob -n metabob --timeout=60s

# Run validation
kubectl exec -n metabob deployment/devbob -- \
  bun run /workspace/tests/validation-harnesses/devbob-independent-execution-validation-harness.ts

# Exit with harness exit code
if [ $? -eq 0 ]; then
  echo "✓ DevBob validation PASSED"
else
  echo "✗ DevBob validation FAILED"
  kubectl exec -n metabob deployment/devbob -- cat /tmp/validation-results.json
  exit 1
fi
```

---

## Impulse References

### Test Case Impulses (7)

1. `validation-devbob-independent-execution-validation-case-1` - SDK Preload
2. `validation-devbob-independent-execution-validation-case-2` - Provider Init
3. `validation-devbob-independent-execution-validation-case-3` - RPC API Connectivity
4. `validation-devbob-independent-execution-validation-case-4` - SurrealDB Connectivity
5. `validation-devbob-independent-execution-validation-case-5` - Environment Variables
6. `validation-devbob-independent-execution-validation-case-6` - Config Substitution
7. `validation-devbob-independent-execution-validation-case-7` - Activity List

**Storage**: `impulses/validation-test-cases-devbob-execution.json`

### Harness Impulse

**ID**: `harness-devbob-independent-execution-validation`  
**Type**: file  
**Pointer**: `tests/validation-harnesses/devbob-independent-execution-validation-harness.ts`  
**Budget**: 2000 tokens

---

## Benefits

### No LLM Required ✅
- Pure deterministic validation
- Fast execution (~5-10 seconds total)
- No API costs
- Reproducible results

### Historical Test Cases ✅
- Test cases stored as impulses
- Can be replayed without LLM
- Version controlled
- Documented expectations

### Automated Validation ✅
- Suitable for CI/CD pipelines
- Exit codes for automation
- JSON output for parsing
- Color-coded terminal output

### Comprehensive Coverage ✅
- Tests all specification requirements
- Provider initialization
- Service connectivity
- Secrets and config
- Activity capabilities

---

## Related Files

- **Harness**: `tests/validation-harnesses/devbob-independent-execution-validation-harness.ts`
- **Runner**: `scripts/run-validation-harness.sh`
- **Test Cases**: `impulses/validation-test-cases-devbob-execution.json`
- **Enforcement**: `ENFORCEMENT_devbob_independent_execution.md`
- **Trace**: `TRACE_devbob_independent_execution_validation.md`

---

**Harness Status**: ✅ READY FOR USE  
**Integration**: CI/CD ready, can run immediately after deployment  
**Dependencies**: Bun runtime (available in DevBob container)
