# Activity Execution Recording Validation Harness

This validation harness tests the complete Activity Execution Recording and Metrics Feedback Loop specification.

## Purpose

Verifies that activity executions are correctly recorded to the database and that template metrics are updated with execution data, enabling the learning system to function properly.

## Test Cases

### Case 1: Single Successful Execution
- **Input:** Execute 1 successful activity
- **Expected:** 
  - 1 execution record in database
  - template_metrics.total_executions = 1
  - template_metrics.success_rate = 1.0
  - Thompson alpha = 2.0, beta = 1.0

### Case 2: Multiple Successful Executions
- **Input:** Execute 3 successful activities
- **Expected:**
  - 3 execution records in database
  - template_metrics.total_executions = 3
  - template_metrics.success_rate = 1.0
  - Thompson alpha = 4.0, beta = 1.0

### Case 3: Mixed Success/Failure
- **Input:** Execute 4 activities (3 success, 1 failure)
- **Expected:**
  - 4 execution records in database
  - template_metrics.total_executions = 4
  - template_metrics.success_rate = 0.75
  - Thompson alpha = 4.0, beta = 2.0

## Requirements

- metabob-rpc-api running at http://localhost:8000 (or METABOB_RPC_API_URL)
- SurrealDB accessible to rpc-api
- Backend /api/v1/learning-loop/executions endpoint functional

## Usage

### Run all tests

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun tests/validation-harnesses/execution-recording-harness.ts
```

### Run with custom backend URL

```bash
METABOB_RPC_API_URL=http://custom-backend:8000 bun tests/validation-harnesses/execution-recording-harness.ts
```

## Expected Output

```
🚀 Starting Activity Execution Recording Validation Harness
   Backend URL: http://localhost:8000
   Test cases: 3

🔍 Checking backend connectivity...
   ✅ Backend is accessible

📋 Running test case: Single successful execution recorded
   Template ID: execution-recording-test-template
   ⏳ Recording execution 1/1 (success=true)...
   ✅ Recorded 1 executions
   📊 Found 1 execution records in database
   📈 Template metrics: { total: 1, successful: 1, successRate: 1, alpha: 2, beta: 1 }
   ✅ PASS: Single successful execution recorded

📋 Running test case: Multiple successful executions aggregate correctly
   ...
   ✅ PASS: Multiple successful executions aggregate correctly

📋 Running test case: Mixed success/failure executions calculate correct success_rate
   ...
   ✅ PASS: Mixed success/failure executions calculate correct success_rate

================================================================================
📊 VALIDATION SUMMARY
================================================================================
Total test cases: 3
Passed: 3 ✅
Failed: 0 ❌
Success rate: 100.0%
================================================================================

✅ ALL VALIDATIONS PASSED

🎉 Activity Execution Recording and Metrics Feedback Loop is working correctly!
```

## Troubleshooting

### Backend not accessible

```
❌ Backend is not accessible: Error: fetch failed

💡 Make sure metabob-rpc-api is running:
   docker-compose up metabob-rpc-api
   OR
   kubectl port-forward svc/metabob-rpc-api 8000:8000
```

**Solution:** Start the backend service and verify it's accessible at the configured URL.

### Execution records not found

If execution records are not being created:
1. Check that template-metrics-client.ts is using HTTP POST (not MCP tool)
2. Verify METABOB_RPC_API_URL environment variable is set correctly
3. Check backend logs for errors during POST /api/v1/learning-loop/executions

### Metrics not updated

If template_metrics shows 0 executions:
1. Verify insert_execution() is being called successfully
2. Check that update_metrics_after_execution() is running
3. Query SurrealDB directly to see if data is present:
   ```bash
   curl http://localhost:8000/api/v1/learning-loop/metrics/execution-recording-test-template
   ```

## Integration with CI/CD

Add to pre-push quality gates:

```bash
#!/bin/bash
echo "Running execution recording validation..."
bun tests/validation-harnesses/execution-recording-harness.ts
if [ $? -ne 0 ]; then
  echo "❌ Execution recording validation failed"
  exit 1
fi
```

## Related Documents

- `ENFORCEMENT_ACTIVITY_EXECUTION_RECORDING.md` - Enforcement documentation
- `TRACE_ACTIVITY_EXECUTION_RECORDING.md` - Trace analysis
- `SESSION_METRICS_DATABASE_STATUS.md` - Original problem analysis

## Test Data Cleanup

The harness creates test execution records with template_id = "execution-recording-test-template". These can be cleaned up manually if needed:

```bash
# Query test records
curl http://localhost:8000/api/v1/learning-loop/executions?template_id=execution-recording-test-template

# Delete via backend API (if endpoint exists)
# Otherwise, clean up directly in SurrealDB
```

## Success Criteria

✅ All 3 test cases pass  
✅ Execution records created in activity_execution table  
✅ Template metrics updated with correct values  
✅ Success rate calculated correctly  
✅ Thompson sampling parameters updated  
✅ No errors during execution recording

## Next Steps

After validation passes:
1. Deploy changes to production
2. Monitor real activity executions
3. Verify learning system adapts based on execution data
4. Set up alerts for execution recording failures
