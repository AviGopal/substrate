# Validation Harness: template-loading-persistence

**Created**: 2026-03-07  
**Specification**: template-loading-persistence  
**Status**: ✅ COMPLETE

---

## Overview

Automated validation harness for testing the `template-loading-persistence` specification without LLM involvement. Tests that activity templates persist in SurrealDB and are accessible after Redis cache is cleared.

---

## Validation Strategy

**Core Flow**: Clear Redis → Query API → Verify Templates Returned

**7-Step Validation Process**:

1. ✅ Create test template (writes to SurrealDB + Redis cache)
2. ✅ Verify template exists in SurrealDB
3. ✅ Verify template cached in Redis
4. ✅ Clear Redis cache (FLUSHDB)
5. ✅ Load template via API (triggers SurrealDB fallback)
6. ✅ Verify template loaded successfully (HTTP 200)
7. ✅ Verify Redis cache repopulated automatically

---

## Files Created

### 1. Validation Harness

**File**: `tests/validation-harnesses/template-loading-persistence-harness.ts`

**Size**: ~500 lines of TypeScript

**Features**:
- Standalone CLI execution
- Programmatic API for integration
- Environment variable configuration
- Detailed error reporting
- kubectl integration for K8s checks
- HTTP API integration for template operations

**Usage**:
```bash
# CLI
tsx tests/validation-harnesses/template-loading-persistence-harness.ts

# With environment variables
TEMPLATE_NAME="My Test" RPC_API_URL="http://localhost:8000" \
  tsx tests/validation-harnesses/template-loading-persistence-harness.ts

# Programmatic
import { runValidation } from './template-loading-persistence-harness';
const result = await runValidation({ templateName: 'Test', ... });
```

---

### 2. Test Case Impulses

**Test Case 1**: `impulses/validation-template-loading-persistence-case-1.json`
- **Name**: Basic Template Persistence
- **Input**: Single template with default settings
- **Expected**: All 7 validation steps pass

**Test Case 2**: `impulses/validation-template-loading-persistence-case-2.json`
- **Name**: TTL Expiration Recovery
- **Input**: Template with TTL expiration test
- **Expected**: Cache repopulates after TTL expires

**Test Case 3**: `impulses/validation-template-loading-persistence-case-3.json`
- **Name**: Multiple Templates Persistence
- **Input**: 5 templates created and tested
- **Expected**: All templates persist and load correctly

---

### 3. Harness Impulse

**File**: `impulses/harness-template-loading-persistence.json`

**Type**: file

**Budget**: 2000 tokens

**Pointer**: `tests/validation-harnesses/template-loading-persistence-harness.ts`

**Metadata**:
- Specification reference
- Validation strategy
- Test case links
- Usage examples
- Dependencies
- Output format

---

### 4. Documentation

**File**: `tests/validation-harnesses/README.md`

**Contents**:
- Harness purpose and strategy
- Usage instructions (CLI, programmatic, CI/CD)
- Environment variables reference
- Output format specification
- Prerequisites checklist
- Troubleshooting guide
- Related documentation links

---

## Output Format

```json
{
  "specificationName": "template-loading-persistence",
  "harnessFile": "tests/validation-harnesses/template-loading-persistence-harness.ts",
  "testCases": [
    {
      "impulseId": "validation-template-loading-persistence-case-1",
      "input": "sample input",
      "expectedOutput": "expected result"
    }
  ],
  "harnessImpulseId": "harness-template-loading-persistence"
}
```

---

## Validation Results Format

### Success (PASS)

```json
{
  "pass": true,
  "actual": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": true,
    "existsInRedisAfterClear": true,
    "cacheRepopulated": true
  },
  "expected": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": true,
    "existsInRedisAfterClear": true,
    "cacheRepopulated": true
  },
  "details": "✅ PASS: Template loading persistence validated successfully."
}
```

### Failure (FAIL)

```json
{
  "pass": false,
  "actual": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": false,
    "existsInRedisAfterClear": false,
    "cacheRepopulated": false
  },
  "expected": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": true,
    "existsInRedisAfterClear": true,
    "cacheRepopulated": true
  },
  "details": "❌ FAIL: Template loading persistence validation failed",
  "errors": [
    "Failed to load template after cache clear: HTTP 404: Template not found",
    "Redis cache not repopulated after template load"
  ]
}
```

---

## Running the Harness

### Quick Start

```bash
# 1. Ensure K8s cluster is running
kubectl get pods | grep -E "(redis|surreal|rpc-api)"

# 2. Run validation harness
cd /home/avi/documents/work/exp-repo/metabob-devbob
tsx tests/validation-harnesses/template-loading-persistence-harness.ts

# 3. Check exit code
echo $?  # 0 = PASS, 1 = FAIL
```

### With Custom Configuration

```bash
# Custom template name and category
TEMPLATE_NAME="Production Validation Test" \
TEMPLATE_CATEGORY="infrastructure" \
RPC_API_URL="http://metabob-rpc-api:8000" \
  tsx tests/validation-harnesses/template-loading-persistence-harness.ts
```

### CI/CD Integration

```yaml
# .github/workflows/validate.yml
- name: Run template persistence validation
  run: |
    tsx tests/validation-harnesses/template-loading-persistence-harness.ts
  env:
    RPC_API_URL: http://localhost:8000
    KUBECTL_CONTEXT: kind-test-cluster
```

---

## Prerequisites

### Runtime Dependencies

- ✅ Node.js v18+
- ✅ TypeScript (`tsx` or `ts-node`)
- ✅ `kubectl` CLI (for K8s access)
- ✅ `curl` (for HTTP requests)

### K8s Resources

- ✅ Redis pod (`deployment/redis`) - Running
- ✅ SurrealDB pod (`deployment/surreal`) - Running
- ✅ RPC API pod (any label with `app=rpc-api`) - Running

### Network Access

- ✅ Access to RPC API (HTTP on port 8000)
- ✅ Access to K8s cluster (kubectl configured)
- ✅ Network connectivity between harness and K8s services

---

## Validation Steps Breakdown

### Step 1: Create Test Template

**Action**: POST `/v2/activities/templates`

**Verification**:
- HTTP 201 Created response
- Response contains `variant_id`

**On Failure**:
- Check RPC API logs: `kubectl logs -l app=rpc-api --tail=50`
- Verify API accessibility: `curl http://localhost:8000/`

---

### Step 2: Verify SurrealDB Persistence

**Action**: `kubectl exec deployment/surreal -- surreal sql "SELECT * FROM activity_template WHERE variant_id = '{id}'"`

**Verification**:
- Query returns 1 record
- Record contains correct template data

**On Failure**:
- Check SurrealDB pod: `kubectl get pods | grep surreal`
- Verify connectivity: `kubectl exec deployment/surreal -- surreal sql "INFO FOR DB"`

---

### Step 3: Verify Redis Cache

**Action**: `kubectl exec deployment/redis -- redis-cli EXISTS "activity:template:{id}"`

**Verification**:
- Returns `1` (key exists)

**On Failure**:
- Check Redis pod: `kubectl get pods | grep redis`
- Verify connectivity: `kubectl exec deployment/redis -- redis-cli PING`

---

### Step 4: Clear Redis Cache

**Action**: `kubectl exec deployment/redis -- redis-cli FLUSHDB`

**Verification**:
- DBSIZE returns `0`
- All keys deleted

**On Failure**:
- Manually clear: `kubectl exec deployment/redis -- redis-cli FLUSHDB`
- Verify: `kubectl exec deployment/redis -- redis-cli DBSIZE`

---

### Step 5: Load Template After Cache Clear

**Action**: GET `/v2/activities/templates/{id}`

**Verification**:
- HTTP 200 OK response
- Response contains full template data

**On Failure**:
- Check logs for cache miss: `kubectl logs -l app=rpc-api --tail=50 | grep "cache miss"`
- Verify SurrealDB still has template (Step 2)

---

### Step 6: Verify Cache Repopulation

**Action**: `kubectl exec deployment/redis -- redis-cli EXISTS "activity:template:{id}"`

**Verification**:
- Returns `1` (key exists again)
- TTL is ~3600s (1 hour)

**On Failure**:
- Check logs for cache write: `kubectl logs -l app=rpc-api --tail=50 | grep "cached"`
- Verify Redis is writable: `kubectl exec deployment/redis -- redis-cli SET test 123`

---

### Step 7: Verify Logs (Optional)

**Action**: `kubectl logs -l app=rpc-api --tail=100 | grep -E "(Template cache miss|loading from SurrealDB)"`

**Verification**:
- Logs contain "Template cache miss for {id}"
- Logs contain "loading from SurrealDB" or "cached from SurrealDB"

**Note**: This step is a warning, not a hard failure (logs might have rolled over)

---

## Exit Codes

| Code | Meaning | Details |
|------|---------|---------|
| `0` | ✅ PASS | All validation steps passed |
| `1` | ❌ FAIL | One or more validation steps failed |

---

## Troubleshooting

### Common Issues

#### 1. Template Creation Fails (HTTP 500)

**Symptoms**:
- Step 1 fails
- Error: "Failed to create template: HTTP 500"

**Solutions**:
- Check RPC API logs: `kubectl logs -l app=rpc-api --tail=100`
- Verify SurrealDB is running: `kubectl get pods | grep surreal`
- Check SurrealDB connection in RPC API logs

---

#### 2. Template Not in SurrealDB

**Symptoms**:
- Step 2 fails
- Error: "Template not found in SurrealDB after creation"

**Solutions**:
- Verify template was created: Check RPC API logs for "✅ Template written to SurrealDB"
- Manually query SurrealDB: `kubectl exec deployment/surreal -- surreal sql "SELECT * FROM activity_template"`
- Check for SurrealDB write errors in RPC API logs

---

#### 3. Template Not in Redis Cache

**Symptoms**:
- Step 3 fails
- Error: "Template not found in Redis cache after creation"

**Solutions**:
- Check if Redis is running: `kubectl get pods | grep redis`
- Verify Redis is writable: `kubectl exec deployment/redis -- redis-cli SET test 123`
- Check RPC API logs for cache write warnings

---

#### 4. Redis Cache Clear Fails

**Symptoms**:
- Step 4 fails
- Error: "Failed to clear Redis cache" or "Redis cache not empty after FLUSHDB"

**Solutions**:
- Manually clear: `kubectl exec deployment/redis -- redis-cli FLUSHDB`
- Check Redis pod status: `kubectl get pods | grep redis`
- Verify kubectl has access: `kubectl exec deployment/redis -- redis-cli PING`

---

#### 5. Template Load Fails After Cache Clear

**Symptoms**:
- Step 5 fails
- Error: "Failed to load template after cache clear: HTTP 404"

**Solutions**:
- **THIS IS THE CRITICAL FAILURE** - indicates the specification is NOT working
- Verify template still exists in SurrealDB (Step 2)
- Check RPC API logs for cache miss handling
- Verify cache-aside pattern is implemented correctly in `activity.py:get_template_by_id()`
- This failure means the bug is NOT fixed

---

#### 6. Cache Not Repopulated

**Symptoms**:
- Step 6 fails
- Error: "Redis cache not repopulated after template load"

**Solutions**:
- Check RPC API logs for cache write after SurrealDB load
- Verify Redis is writable: `kubectl exec deployment/redis -- redis-cli SET test 123`
- Check for cache write errors in logs

---

## Related Artifacts

### Documentation
- `TRACE_TEMPLATE_LOADING_PERSISTENCE.md` - Component trace analysis
- `ENFORCEMENT_TEMPLATE_LOADING_PERSISTENCE.md` - Enforcement summary with manual test scenarios
- `tests/validation-harnesses/README.md` - Harness usage guide

### Impulses
- `trace-template-loading-persistence` (5000 tokens) - Trace analysis
- `enforcement-template-loading-persistence` (3000 tokens) - Enforcement summary
- `harness-template-loading-persistence` (2000 tokens) - Harness metadata
- `validation-template-loading-persistence-case-1` - Test case 1
- `validation-template-loading-persistence-case-2` - Test case 2
- `validation-template-loading-persistence-case-3` - Test case 3

### Code References
- Backend Cache-Aside: `repos/metabob-rpc-api/server/actions/activity.py:290-366`
- Persistence Layer: `repos/metabob-rpc-api/server/db/operations/template_data.py:67-92`
- Write Path: `repos/metabob-rpc-api/server/actions/activity.py:369-524`

---

## Success Criteria

✅ **All criteria must be met for PASS**:

1. Template created successfully (HTTP 201)
2. Template exists in SurrealDB after creation
3. Template cached in Redis after creation
4. Redis cache cleared successfully (DBSIZE = 0)
5. **Template loads successfully after cache clear (HTTP 200)** ← CRITICAL
6. Redis cache repopulated after load (EXISTS = 1)
7. TTL set correctly (~3600s)
8. Logs show cache miss → SurrealDB fallback (optional)

**The most critical check is #5**: If template does NOT load after Redis clear, the specification is BROKEN and the bug is NOT fixed.

---

## Conclusion

The validation harness provides **automated, LLM-free testing** of the `template-loading-persistence` specification. It can be run:

- ✅ **Manually** for ad-hoc testing
- ✅ **In CI/CD** for automated regression testing
- ✅ **Pre-deployment** for validation before release
- ✅ **Post-deployment** for smoke testing in production

**No LLM needed** - the harness returns deterministic PASS/FAIL results based purely on system behavior.

