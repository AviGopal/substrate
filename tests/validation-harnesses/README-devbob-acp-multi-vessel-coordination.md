# Validation Harness: DevBob ACP Multi-Vessel Coordination

## Overview

This validation harness tests the complete data flow for distributed multi-agent coordination across DevBob vessels using the Agent Client Protocol (ACP). It validates enforcement changes made to ensure security, reliability, and correctness without requiring LLM evaluation.

**Specification:** `devbob-acp-multi-vessel-coordination`  
**Harness File:** `tests/validation-harnesses/devbob-acp-multi-vessel-coordination-harness.ts`  
**Test Type:** Input-Output Dependency Validation (Historical, Reproducible)

---

## What This Harness Tests

### Enforcement Changes Validated

1. **SQL Injection Protection (CRITICAL)**
   - Input validation in `vessel/bootstrap.ts`
   - Rejects malicious vessel names, pod IPs, and ports
   - Prevents database corruption

2. **Vessel Registry Integrity (FUNCTIONAL)**
   - All 3 vessels registered with correct ACP endpoints
   - Status tracking and heartbeat mechanisms
   - Service discovery functionality

3. **Basic Impulse Sharing (FUNCTIONAL)**
   - Parent agent creates and shares impulses
   - Remote agent receives and resolves impulse pointers
   - Computation uses shared data correctly

4. **Docker Exec Retry Logic (RELIABILITY)** *(Planned)*
   - Transient failures trigger retry with exponential backoff
   - Max 3 attempts with proper delays
   - Success after 1-2 retries

5. **Version Negotiation (SECURITY)** *(Planned)*
   - Protocol version mismatch detection
   - Fast-fail with clear error messages
   - Incompatible versions prevented

6. **Permission Timeout (RELIABILITY)** *(Planned)*
   - 30-second timeout on permission requests
   - Auto-reject on timeout
   - No indefinite hangs

7. **Nested Delegation Chain (FUNCTIONAL)** *(Planned)*
   - parent → devbob-0 → devbob-1 coordination
   - Impulse synchronization across hops
   - Result propagation

8. **Token Budget Preservation (FUNCTIONAL)** *(Planned)*
   - Impulse metadata preserved during serialization
   - Token budgets and priorities maintained
   - Pointer-only serialization efficiency

---

## Test Cases

### Case 1: Basic Impulse Sharing

**Impulse ID:** `validation-devbob-acp-multi-vessel-coordination-case-1`  
**Type:** Functional

**Input:**
```json
{
  "impulseData": { "value1": 42, "value2": 58 },
  "operation": "sum",
  "target": "docker://devbob-0"
}
```

**Expected Output:**
```json
{
  "success": true,
  "result": 100,
  "impulseResolved": true,
  "remoteSessionCreated": true
}
```

**Validation Logic:**
- Creates test impulse with structured data
- Delegates to devbob-0 with `shareImpulses` parameter
- Verifies remote agent resolves and computes correctly
- Confirms result = value1 + value2

---

### Case 2: Vessel Registry Integrity

**Impulse ID:** `validation-devbob-acp-multi-vessel-coordination-case-2`  
**Type:** Functional

**Input:**
```json
{
  "expectedVessels": ["devbob-0", "devbob-1", "devbob-2"],
  "surrealdbEndpoint": "localhost:8000"
}
```

**Expected Output:**
```json
{
  "success": true,
  "vessels": [
    { "vessel_name": "devbob-0", "acp_endpoint": "devbob-0.devbob-headless:3000", "status": "running" },
    { "vessel_name": "devbob-1", "acp_endpoint": "devbob-1.devbob-headless:3000", "status": "running" },
    { "vessel_name": "devbob-2", "acp_endpoint": "devbob-2.devbob-headless:3000", "status": "running" }
  ]
}
```

**Validation Logic:**
- Queries SurrealDB vessel_registry table
- Checks all 3 vessels are registered
- Verifies ACP endpoints match expected format
- Confirms status is "running"

---

### Case 3: SQL Injection Prevention

**Impulse ID:** `validation-devbob-acp-multi-vessel-coordination-case-3`  
**Type:** Security (CRITICAL)

**Input:**
```json
{
  "maliciousVesselName": "devbob-0'; DELETE FROM vessel_registry; --",
  "pod_ip": "10.1.0.63",
  "acp_port": 3000
}
```

**Expected Output:**
```json
{
  "success": false,
  "error": "Invalid vessel_name format",
  "registrationAttempted": false,
  "sqlInjectionPrevented": true
}
```

**Validation Logic:**
- Attempts to register vessel with malicious SQL in name
- Validates input is rejected before query construction
- Confirms no database operation attempted
- Ensures SQL injection is prevented

---

## Running the Harness

### Prerequisites

1. **Runtime:** Bun (v1.0+)
2. **DevBob Infrastructure:**
   - devbob-0 container running
   - devbob-1 container running
   - devbob-2 container running
3. **SurrealDB:** Accessible at `localhost:8000` (or set `SURREAL_HOST`)

### Execution Commands

**Run all tests:**
```bash
bun run tests/validation-harnesses/devbob-acp-multi-vessel-coordination-harness.ts
```

**Run single test case:**
```bash
bun run tests/validation-harnesses/devbob-acp-multi-vessel-coordination-harness.ts \
  --case validation-devbob-acp-multi-vessel-coordination-case-1
```

**Make executable and run:**
```bash
chmod +x tests/validation-harnesses/devbob-acp-multi-vessel-coordination-harness.ts
./tests/validation-harnesses/devbob-acp-multi-vessel-coordination-harness.ts
```

---

## Output Format

### Success Example

```
🧪 DevBob ACP Multi-Vessel Coordination Validation Harness
======================================================================

📋 Test 1: Basic Impulse Sharing
✅ PASS (1234ms)

📋 Test 2: Vessel Registry Integrity
✅ PASS (567ms)

📋 Test 3: SQL Injection Prevention
✅ PASS (12ms)

======================================================================
📊 Summary: 3/3 tests passed
✅ ALL TESTS PASSED
```

### Failure Example

```
🧪 DevBob ACP Multi-Vessel Coordination Validation Harness
======================================================================

📋 Test 1: Basic Impulse Sharing
❌ FAIL (1234ms)
   Error: devbob-0 container not running

📋 Test 2: Vessel Registry Integrity
✅ PASS (567ms)

📋 Test 3: SQL Injection Prevention
✅ PASS (12ms)

======================================================================
📊 Summary: 2/3 tests passed
❌ SOME TESTS FAILED
```

### JSON Output

```json
{
  "overallPass": true,
  "totalTests": 3,
  "passed": 3,
  "failed": 0,
  "results": [
    {
      "pass": true,
      "testCase": "case-1-basic-impulse-sharing",
      "actual": { "containerAvailable": true },
      "expected": { "success": true, "result": 100, "impulseResolved": true },
      "duration": 1234
    }
  ],
  "timestamp": "2026-02-27T00:00:00.000Z"
}
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run DevBob ACP Validation
  run: |
    # Start infrastructure
    kubectl apply -f k8s/devbob-statefulset.yaml
    kubectl wait --for=condition=ready pod/devbob-0 --timeout=120s
    
    # Run validation harness
    bun run tests/validation-harnesses/devbob-acp-multi-vessel-coordination-harness.ts
    
    # Check exit code
    if [ $? -ne 0 ]; then
      echo "❌ Validation failed"
      exit 1
    fi
```

### Pre-Push Hook

```bash
#!/bin/bash
# .git/hooks/pre-push

echo "Running DevBob ACP validation..."
bun run tests/validation-harnesses/devbob-acp-multi-vessel-coordination-harness.ts

if [ $? -ne 0 ]; then
  echo "❌ Validation failed. Push aborted."
  exit 1
fi

echo "✅ Validation passed. Proceeding with push."
```

---

## Troubleshooting

### Container Not Running

**Error:** `devbob-0 container not running`

**Solution:**
```bash
docker ps | grep devbob
# If not running:
kubectl apply -f k8s/devbob-statefulset.yaml
kubectl wait --for=condition=ready pod/devbob-0
```

### SurrealDB Connection Failed

**Error:** `Failed to query vessel registry`

**Solution:**
```bash
# Check SurrealDB is accessible
curl http://localhost:8000/health

# Set environment variables if using non-default values
export SURREAL_HOST=localhost
export SURREAL_PORT=8000
export SURREAL_USER=root
export SURREAL_PASS=root
```

### SQL Injection Test Fails

**Error:** `Validation accepted malicious input`

**Solution:**
- Ensure enforcement changes are applied in `vessel/bootstrap.ts`
- Check that input validation regex is correct: `/^[a-zA-Z0-9\-_]+$/`
- Verify commit `cc1118cd` is deployed

---

## Historical Test Cases (No LLM Required)

All test cases are stored as impulses:

- `impulses/validation-devbob-acp-multi-vessel-coordination-case-1.json`
- `impulses/validation-devbob-acp-multi-vessel-coordination-case-2.json`
- `impulses/validation-devbob-acp-multi-vessel-coordination-case-3.json`

These cases are **historical** and **reproducible** - they can be run at any time without LLM evaluation. Pass/fail is determined by automated comparison of actual vs expected outputs.

---

## Future Enhancements

Planned test cases (not yet implemented):

1. **Docker Retry Logic Test** - Simulate container failure, verify retry
2. **Version Negotiation Test** - Connect incompatible versions, verify rejection
3. **Permission Timeout Test** - Simulate host hang, verify 30s timeout
4. **Nested Delegation Test** - parent → devbob-0 → devbob-1 chain
5. **Token Budget Preservation Test** - Verify impulse metadata synchronization

---

## Related Documentation

- [Enforcement Summary](../../ENFORCEMENT_SUMMARY_DEVBOB_ACP_MULTI_VESSEL_COORDINATION.md)
- [Trace Documentation](../../docs/data-flows/devbob-acp-multi-vessel-coordination-flow.md)
- [Enforcement Impulse](../../impulses/enforcement-devbob-acp-multi-vessel-coordination.json)
- [Harness Impulse](../../impulses/harness-devbob-acp-multi-vessel-coordination.json)

---

## Success Criteria

- ✅ All test cases have historical input-output pairs
- ✅ No LLM required for validation
- ✅ Reproducible across environments
- ✅ Exit code 0 on success, 1 on failure
- ✅ JSON output for programmatic consumption
- ✅ Human-readable console output
- ✅ Integration with CI/CD pipelines

**Status:** ✅ Harness Ready for Execution
