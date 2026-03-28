# RPC API Client-Server Dataflow Alignment Validation Harness

## Purpose

Validates that the RPC API serves data in the format clients (metabob-opencode, dashboard) actually expect. Tests complete request → processing → response cycles from the client's perspective.

## What It Tests

### P0 Changes (Must Pass)
1. **Quality Score Endpoint** - GET `/v2/activities/templates/{id}/quality-score`
   - New endpoint added to enforce architectural boundary
   - Returns 0-100 score with breakdown (success, cost, duration, documentation)
   - Validates schema matches client expectations

2. **Execution Schema Tolerance** - POST `/api/v1/learning-loop/executions`
   - API accepts minimal data (only activity_id, duration, success, cost, tokens)
   - API fills in missing fields (template_id, started_at, completed_at)
   - Backward compatible with complete payloads

3. **Template ID Extraction**
   - API extracts template_id from activity_id pattern: `act_{template}_{timestamp}`
   - Example: `act_create-activity_20260303` → `template_id="create-activity"`

### Regression Tests (Must Not Break)
4. **Thompson Sampling** - POST `/v2/activities/templates/{id}/select`
   - Existing endpoint must still work after changes
   - Returns template with Thompson Sampling metadata (alpha, beta, sample)

### Component Validations
5. **Quality Score Components**
   - Breakdown components sum to total score
   - Each component within valid range (success: 0-40, cost: 0-20, duration: 0-20, docs: 0-20)

6. **Backward Compatibility**
   - Complete payloads with all fields (including impulses) still accepted
   - No regression in existing functionality

## Prerequisites

1. **RPC API Server Running**
   ```bash
   # From repos/metabob-rpc-api
   python -m uvicorn server.main:app --host 0.0.0.0 --port 8081 --reload
   ```

2. **SurrealDB Initialized**
   ```bash
   # Make sure SurrealDB is running and schema applied
   surreal start --log trace --user root --pass root memory
   ```

3. **Redis Running**
   ```bash
   redis-server
   ```

4. **Templates Registered** (Optional - tests handle 404 gracefully)
   ```bash
   # Bootstrap at least one template for full validation
   # Tests will pass with 404 for missing templates
   ```

## Running the Harness

### Quick Run
```bash
export METABOB_RPC_API_URL=http://localhost:8081
cd tests/validation-harnesses
npx ts-node rpc-api-client-dataflow-alignment-harness.ts
```

### With Custom API URL
```bash
export METABOB_RPC_API_URL=http://devbob-rpc-api:8081
export METABOB_LEARNING_LOOP_URL=http://devbob-rpc-api:8081
npx ts-node rpc-api-client-dataflow-alignment-harness.ts
```

## Expected Output

### Full Pass (6/6)
```
🧪 Starting RPC API Client-Server Dataflow Alignment Validation

Test 1: Quality Score Endpoint Schema...
Test 2: Execution Reporting - Minimal Data...
Test 3: Execution Reporting - Complete Data...
Test 4: Template ID Extraction...
Test 5: Quality Score Components...
Test 6: Thompson Sampling (Regression)...

================================================================================
📊 VALIDATION SUMMARY: 6/6 tests passed (0 failed)
================================================================================

✅ Test 1: Quality Score Endpoint Schema Validation
   Quality score: 85.5, Success rate: 0.95

✅ Test 2: Execution Reporting - Minimal Data (Schema Tolerance)
   API accepted minimal data, execution_id: exec_abc123

✅ Test 3: Execution Reporting - Complete Data (Backward Compatibility)
   API accepted complete data including impulses, execution_id: exec_def456

✅ Test 4: Template ID Extraction from Activity ID Pattern
   API extracted template_id from pattern: act_create-activity_1234567890

✅ Test 5: Quality Score Components Breakdown Validation
   Valid breakdown: {"success":38.0,"cost":15.0,"duration":18.0,"documentation":20.0}

✅ Test 6: Thompson Sampling Endpoint (Regression Test)
   Thompson Sampling working: alpha=2.5, beta=1.2
```

### Acceptable Partial Pass (4/6 with template 404s)
```
📊 VALIDATION SUMMARY: 4/6 tests passed (2 failed)

✅ Test 1: Quality Score Endpoint Schema Validation
   Endpoint exists, template not yet executed

✅ Test 2: Execution Reporting - Minimal Data (Schema Tolerance)
   API accepted minimal data, execution_id: exec_abc123

✅ Test 3: Execution Reporting - Complete Data (Backward Compatibility)
   API accepted complete data including impulses, execution_id: exec_def456

✅ Test 4: Template ID Extraction from Activity ID Pattern
   API extracted template_id from pattern: act_create-activity_1234567890

✅ Test 5: Quality Score Components Breakdown Validation
   Endpoint exists, template not yet executed

✅ Test 6: Thompson Sampling Endpoint (Regression Test)
   Endpoint exists, template not yet registered
```

Tests 2-4 MUST pass. Tests 1, 5, 6 may return 404 if templates not yet registered.

## Validation Coverage

### ✅ Covered
- Quality score endpoint exists and returns correct schema
- API accepts minimal execution data (schema tolerance)
- API accepts complete execution data (backward compatibility)
- Template ID extraction from activity_id pattern
- Quality score component validation (sum and ranges)
- Thompson Sampling regression test

### ❌ Not Covered (Future Work)
- Multi-tenant isolation (X-Org-Id, X-Project-Id headers) - not yet implemented
- POST /v2/activities/search-similar - not yet implemented (P2)
- Dashboard template fetching - requires full dashboard setup
- Deprecated client-side logic verification - requires OpenCode instrumentation

## Troubleshooting

### "Connection refused" errors
- Ensure RPC API server is running on correct port
- Check METABOB_RPC_API_URL environment variable

### "Template not found" (404) on all tests
- Expected for new systems without templates registered
- Tests 2-4 should still pass (they don't require existing templates)

### "Schema validation failed"
- Indicates actual API response doesn't match expected schema
- Check server logs for errors
- Verify database schema is up-to-date

### Tests timing out
- Increase timeout if running on slow systems
- Check database connectivity (SurrealDB, Redis)

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Integration with CI/CD

```yaml
# .github/workflows/rpc-api-validation.yml
- name: Run RPC API Dataflow Validation
  run: |
    export METABOB_RPC_API_URL=http://localhost:8081
    npx ts-node tests/validation-harnesses/rpc-api-client-dataflow-alignment-harness.ts
```

## Maintenance

This harness validates the enforcement of specification `rpc-api-client-dataflow-alignment`. If the specification changes, update:

1. Test cases in harness file
2. Expected schemas
3. This README

Last updated: 2026-03-03
