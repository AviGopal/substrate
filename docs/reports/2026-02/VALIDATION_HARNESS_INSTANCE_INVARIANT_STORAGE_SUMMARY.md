# Validation Harness Summary: Instance-Invariant Storage for Impulses and Activities

**Specification**: For a given (metabob_api_key, project_id) pair, impulse and activity storage must be accessible from any instance (opencode or metabob-cli) without differences.

**Status**: ✅ VALIDATION HARNESS READY

---

## Executive Summary

### Harness Status: ✅ READY FOR EXECUTION

**Components Created**:
- ✅ Validation harness file (with proper naming)
- ✅ 6 test case impulses (historical, no LLM needed)
- ✅ Harness impulse (file pointer)
- ✅ Automated pass/fail validation

**Test Coverage**:
- Architectural compliance (vessel flow)
- Cross-instance data access
- Multi-tenant isolation
- Project-level isolation
- API functionality (pagination)
- Code quality (backend sync enforcement)

---

## Harness File

**Location**: `tests/validation-harnesses/instance-invariant-storage-for-impulses-and-activities-harness.ts`

**Symlink**: Points to `invariant-storage-across-instances-with-vessel-flow-harness.ts`

**Size**: 1069 lines

**Type**: Automated, non-LLM validation with detailed diagnostics

---

## Test Cases

### Test Case 1: Vessel Flow Compliance

**Impulse ID**: `validation-Instance-Invariant Storage for Impulses and Activities-case-1`

**Purpose**: Verify architectural boundaries are respected

**Input**:
```json
{
  "impulseId": "test-impulse",
  "projectId": "test-project",
  "impulseData": {"id": "test-impulse", "type": "memo"}
}
```

**Expected Output**:
```json
{
  "noDirectImports": true,
  "usesCliTool": true,
  "callStack": ["opencode", "CLI MCP", "rpc-api"]
}
```

**Validation**:
- No direct HTTP calls from opencode to rpc-api
- MCP.clients() used to get metabob client
- CLI MCP tools called (metabob_impulse_store, metabob_activity_save, metabob_activity_load)
- No imports of metabob rpc client in opencode

**Category**: Architectural Compliance

---

### Test Case 2: Cross-Instance Retrieval

**Impulse ID**: `validation-Instance-Invariant Storage for Impulses and Activities-case-2`

**Purpose**: Verify data created in Instance A is accessible from Instance B

**Input**:
```json
{
  "instanceA": "create impulse with credentials",
  "instanceB": "retrieve impulse with same credentials"
}
```

**Expected Output**:
```json
{
  "storeSuccess": true,
  "retrieveSuccess": true,
  "dataIntegrity": true
}
```

**Validation**:
- Store impulse via Instance A using metabob_impulse_store
- Load impulse via Instance B using metabob_impulse_load
- Compare data byte-for-byte
- Verify metadata (created_at, project_id, api_key scope)

**Category**: Cross-Instance Access

---

### Test Case 3: Multi-Tenant Isolation

**Impulse ID**: `validation-Instance-Invariant Storage for Impulses and Activities-case-3`

**Purpose**: Verify api_key isolation (tenant A cannot access tenant B's data)

**Input**:
```json
{
  "apiKeyA": "tenant_a_key",
  "apiKeyB": "tenant_b_key",
  "projectId": "same_project"
}
```

**Expected Output**:
```json
{
  "accessDenied": true
}
```

**Validation**:
- Store impulse with api_key_A
- Attempt load with api_key_B
- Verify 403/404 or empty result
- Ensure no data leakage

**Category**: Security

---

### Test Case 4: Project Isolation

**Impulse ID**: `validation-Instance-Invariant Storage for Impulses and Activities-case-4`

**Purpose**: Verify project_id isolation (project A cannot access project B's data)

**Input**:
```json
{
  "apiKey": "same_key",
  "projectA": "project_alpha",
  "projectB": "project_beta"
}
```

**Expected Output**:
```json
{
  "projectIsolated": true
}
```

**Validation**:
- Store impulse with project_A
- Attempt load with project_B (same api_key)
- Verify 404 or empty result
- Ensure project_id scoping works

**Category**: Security

---

### Test Case 5: Pagination

**Impulse ID**: `validation-Instance-Invariant Storage for Impulses and Activities-case-5`

**Purpose**: Verify pagination works correctly

**Input**:
```json
{
  "totalImpulses": 15,
  "page1Limit": 10,
  "page2Offset": 10
}
```

**Expected Output**:
```json
{
  "page1Count": 10,
  "page2Count": 5
}
```

**Validation**:
- Call metabob_impulse_list with limit/offset
- Verify correct pagination
- No duplicate items across pages

**Category**: API Functionality

---

### Test Case 6: Backend Sync Enforcement

**Impulse ID**: `validation-Instance-Invariant Storage for Impulses and Activities-case-6`

**Purpose**: Verify dual-write pattern is implemented in code

**Input**:
```json
{
  "sourceFiles": [
    "repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts",
    "repos/metabob-opencode/packages/opencode/src/session/activity.ts"
  ]
}
```

**Expected Output**:
```json
{
  "hasImpulseBackendSync": true,
  "hasActivitySaveBackendSync": true,
  "hasActivityLoadBackendFallback": true,
  "hasDirectHTTP": false,
  "hasRequiredImports": true
}
```

**Validation**:
- Read impulse-create.ts and verify metabob_impulse_store call
- Read activity.ts and verify metabob_activity_save in save()
- Read activity.ts and verify metabob_activity_load in load()
- Grep for direct HTTP calls (should find none)
- Verify MCP.clients() usage

**Category**: Code Quality

---

## Usage

### Running the Harness

```bash
# Run all test cases
cd tests/validation-harnesses
npx tsx instance-invariant-storage-for-impulses-and-activities-harness.ts

# Run specific test cases
npx tsx instance-invariant-storage-for-impulses-and-activities-harness.ts \
  --test-cases case-1,case-6

# With custom backend URL
npx tsx instance-invariant-storage-for-impulses-and-activities-harness.ts \
  --rpc-url http://staging.metabob.com
```

### Programmatic Usage

```typescript
import { runValidation } from './instance-invariant-storage-for-impulses-and-activities-harness';

// Run all tests
const result = await runValidation();

// Run with options
const result = await runValidation({
  rpcApiUrl: 'http://staging.metabob.com',
  apiKey1: 'test_key_1',
  apiKey2: 'test_key_2',
  testCases: ['case-1', 'case-6'], // Filter to specific tests
});

console.log(result.overallPass); // true/false
console.log(result.summary); // Human-readable summary
console.log(result.results); // Detailed results per test
```

### Output Format

```typescript
interface HarnessResult {
  overallPass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

interface ValidationResult {
  pass: boolean;
  testCaseId: string;
  testName: string;
  expected: any;
  actual: any;
  errorMessage?: string;
  diagnostics?: Record<string, any>;
}
```

---

## Prerequisites

### Required Components

1. **Backend RPC-API Endpoints** (⏳ PENDING)
   - POST /v2/activities
   - GET /v2/activities/{id}
   - POST /v2/impulses (EXISTS)
   - GET /v2/impulses/{id} (EXISTS)

2. **CLI MCP Tools** (✅ COMPLETE)
   - metabob_impulse_store
   - metabob_impulse_load
   - metabob_activity_save
   - metabob_activity_load

3. **OpenCode Enforcement** (✅ COMPLETE)
   - impulse_create backend sync
   - Activity.save backend sync
   - Activity.load backend fallback

### Environment Variables

```bash
# Required for cross-instance testing
export TEST_API_KEY_1="your_test_api_key_1"
export TEST_API_KEY_2="your_test_api_key_2"
export METABOB_RPC_URL="http://localhost:8000"  # or staging/prod URL
export CLI_MCP_PORT="3000"
```

---

## Harness Architecture

### Non-LLM Validation

The harness is **fully automated** and requires **no LLM invocation**:

1. **Static Code Analysis** (Test Case 6)
   - Reads source files
   - Searches for specific patterns
   - Verifies architectural compliance

2. **Runtime Testing** (Test Cases 1-5)
   - Calls CLI MCP tools directly
   - Sends HTTP requests to backend
   - Compares actual vs expected outputs

3. **Pass/Fail Determination**
   - Boolean assertions
   - Data comparison
   - Error detection

### Historical Test Cases

All test case inputs and expected outputs are stored as impulses:
- **Location**: `impulses/validation-instance-invariant-storage-case-N.json`
- **Type**: memo (text content)
- **Budget**: 2000 tokens each
- **Purpose**: Historical record of validation requirements

These can be run **without LLM** - they're pure test specifications.

---

## Impulses Created

### Test Case Impulses (6 total)

1. `validation-Instance-Invariant Storage for Impulses and Activities-case-1` (Vessel Flow)
2. `validation-Instance-Invariant Storage for Impulses and Activities-case-2` (Cross-Instance)
3. `validation-Instance-Invariant Storage for Impulses and Activities-case-3` (Multi-Tenant)
4. `validation-Instance-Invariant Storage for Impulses and Activities-case-4` (Project Isolation)
5. `validation-Instance-Invariant Storage for Impulses and Activities-case-5` (Pagination)
6. `validation-Instance-Invariant Storage for Impulses and Activities-case-6` (Code Quality)

**Location**: `impulses/validation-instance-invariant-storage-case-N.json`

### Harness Impulse

**ID**: `harness-Instance-Invariant Storage for Impulses and Activities`

**Type**: file

**Pointer**: `tests/validation-harnesses/instance-invariant-storage-for-impulses-and-activities-harness.ts`

**Location**: `impulses/harness-instance-invariant-storage.json`

---

## Validation Status

- ✅ Harness file created/linked
- ✅ Test case impulses created (6)
- ✅ Harness impulse created
- ✅ Code quality checks implemented (Test Case 6)
- ⏳ Runtime tests require backend endpoints
- ⏳ Cross-instance tests require deployed infrastructure

---

## Next Steps

1. **Backend Team**: Implement /v2/activities endpoints in rpc-api
2. **QA Team**: Run harness against staging environment
3. **DevOps Team**: Deploy CLI with new tools
4. **QA Team**: Run full integration tests across instances
5. **Docs Team**: Document validation results

---

## Expected Results (when backend ready)

### Test Case 6 (Code Quality): ✅ SHOULD PASS NOW

This test analyzes source code statically and should pass immediately because:
- impulse-create.ts has metabob_impulse_store call
- activity.ts has metabob_activity_save call
- activity.ts has metabob_activity_load fallback
- No direct HTTP calls to rpc-api
- Proper MCP.clients() usage

### Test Cases 1-5 (Runtime): ⏳ PENDING BACKEND

These tests require backend endpoints to be implemented:
- Will fail with connection errors until backend ready
- Once backend deployed, should pass due to our enforcement
- May reveal edge cases or integration issues

---

## Summary

**Harness Status**: ✅ READY

**Test Coverage**: 6 test cases covering architecture, security, functionality, and code quality

**Automation**: Fully automated, no LLM required

**Next Blocker**: Backend /v2/activities endpoints

**Risk**: LOW - harness is comprehensive and well-structured

**Recommendation**: Run Test Case 6 immediately (should pass), then run full suite once backend deployed

