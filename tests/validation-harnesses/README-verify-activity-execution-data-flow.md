# Validation Harness: Verify Activity Execution Data Flow to Backend

## Purpose

This validation harness tests the complete data flow from activity completion to database storage, ensuring that:

1. Activity execution metrics are reported from `Activity.complete()`
2. MCP tool `metabob_post_activity_result` exists and is callable
3. MCP client `metabob` is properly configured
4. Backend API is accessible and functioning
5. SurrealDB is running and accessible
6. Execution data successfully reaches the database
7. variant_id is populated when applicable

## Components Tested

### Data Flow Path
```
Activity.complete() 
  → TemplateMetricsClient.reportExecution()
  → MCP tool 'metabob_post_activity_result'
  → Backend POST /api/v1/learning-loop/executions
  → Background task _process_execution_background()
  → insert_execution()
  → SurrealDB activity_executions table
```

### Infrastructure Components
- **MCP Server**: metabob-cli MCP server with activity template tools
- **Backend API**: metabob-rpc-api running on http://localhost:8081
- **Database**: SurrealDB pod in Kubernetes namespace 'metabob'

## Usage

### Run All Tests
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
npm run test:validation:activity-execution
# or
tsx tests/validation-harnesses/verify-activity-execution-data-flow-harness.ts
```

### Run Single Test
```typescript
import { runValidation } from './tests/validation-harnesses/verify-activity-execution-data-flow-harness';

const result = await runValidation({
  activityId: 'test-001',
  templateId: 'my-template',
  success: true,
  durationMs: 1000,
  cost: 0.01
});

console.log(result.pass ? 'PASS' : 'FAIL');
console.log(result.details);
```

## Test Cases

### Test Case 1: Basic Execution (No Variant)
- **Input**: activity_id, template_id, success, duration_ms, cost
- **Expected**: All infrastructure checks pass, execution posted, database record created
- **Validates**: Basic data flow without variant tracking

### Test Case 2: Execution with Variant
- **Input**: Same as Test 1 + variant_id
- **Expected**: variant_id field populated in database record
- **Validates**: Variant tracking for Thompson Sampling

### Test Case 3: Failed Execution
- **Input**: Same as Test 1 with success=false
- **Expected**: Failure recorded correctly in database
- **Validates**: Failure tracking for learning loop

### Test Case 4: Infrastructure Check
- **Input**: Minimal data with skipDatabaseCheck=true
- **Expected**: All infrastructure components accessible
- **Validates**: Environment setup without database writes

## Expected Outputs

### Success Scenario
```json
{
  "pass": true,
  "actual": {
    "mcpToolExists": true,
    "mcpClientConfigured": true,
    "backendAccessible": true,
    "databaseAccessible": true,
    "executionPosted": true,
    "databaseRecord": {
      "found": true,
      "success": true,
      "logs": ["[EXECUTION] Scheduled...", "[BACKGROUND] Successfully..."]
    }
  },
  "details": [
    "[1] MCP tool exists: PASS",
    "[2] MCP client configured: PASS",
    "[3] Backend accessible: PASS",
    "[4] SurrealDB accessible: PASS",
    "[5] Execution posted: PASS",
    "[6] Database record found: PASS",
    "[VALIDATION PASS]"
  ],
  "errors": []
}
```

### Failure Scenario (Backend Down)
```json
{
  "pass": false,
  "actual": {
    "mcpToolExists": true,
    "mcpClientConfigured": true,
    "backendAccessible": false,
    "databaseAccessible": true,
    "executionPosted": false,
    "databaseRecord": null
  },
  "details": [
    "[1] MCP tool exists: PASS",
    "[2] MCP client configured: PASS",
    "[3] Backend accessible: FAIL",
    "[VALIDATION FAIL]"
  ],
  "errors": [
    "Backend not accessible at http://localhost:8081"
  ]
}
```

## Debugging Failed Tests

### MCP Tool Missing
- **Error**: `MCP tool missing in metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
- **Fix**: Ensure `metabob_post_activity_result` function exists in activity_template_tools.py
- **Check**: `grep -n "metabob_post_activity_result" repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

### MCP Client Not Configured
- **Error**: `MCP client not configured in .opencode/opencode.json`
- **Fix**: Add `mcp.metabob` configuration with `enabled: true` and `METABOB_API_URL`
- **Check**: `cat repos/metabob-opencode/.opencode/opencode.json | jq .mcp.metabob`

### Backend Not Accessible
- **Error**: `Backend not accessible at http://localhost:8081`
- **Fix**: Start port-forward: `kubectl port-forward -n metabob svc/metabob-rpc-api 8081:8080`
- **Check**: `curl http://localhost:8081/`

### SurrealDB Not Running
- **Error**: `SurrealDB pod not running or not ready`
- **Fix**: Check pod status: `kubectl get pods -n metabob -l app=surrealdb`
- **Check**: Ensure pod is Running and Ready

### Execution Posted But No Database Record
- **Error**: `Background task failed: 401 Unauthorized`
- **Fix**: This indicates SurrealDB auth expiration - restart backend or switch to WebSocket
- **Check**: `kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 | grep "401\|BACKGROUND"`

## Integration with CI/CD

This harness can be integrated into CI/CD pipelines for regression testing:

```yaml
# .github/workflows/validate-activity-execution.yml
name: Validate Activity Execution Data Flow

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup infrastructure
        run: |
          # Start backend, database, MCP server
      - name: Run validation harness
        run: npm run test:validation:activity-execution
      - name: Upload results
        if: failure()
        uses: actions/upload-artifact@v2
        with:
          name: validation-results
          path: tests/validation-harnesses/*.log
```

## Maintenance

When updating the data flow:
1. Update the harness to check new components
2. Add new test cases for new scenarios
3. Update expected outputs if schemas change
4. Document breaking changes in this README

## Related Documentation

- [Activity Execution Data Flow Specification](../../ACTIVITY_EXECUTION_DATA_FLOW_SPEC.md)
- [Trace Analysis](../../trace-activity-execution-data-flow.json)
- [Enforcement Summary](../../enforcement-activity-execution-data-flow.json)
