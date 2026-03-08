# Validation Harnesses

This directory contains validation harnesses for end-to-end testing of specifications.

## Activity Recommendation and Learning Loop

**Specification**: Activity Recommendation and Learning Loop End-to-End Validation

### Files

- `activity-recommendation-learning-loop-harness.ts` - TypeScript validation harness
- `activity-recommendation-learning-loop-harness.sh` - Shell script validation harness

### Test Cases

1. **Recommendation Endpoint** - Verifies POST /v2/activities/recommend returns Thompson Sampling results
2. **Execution Recording** - Verifies execution results are recorded via learning loop API
3. **Metrics Update** - Verifies alpha/beta values update after execution
4. **Graceful Degradation** - Verifies fallback behavior when backend unavailable

### Running in devbob Container

```bash
# 1. Exec into devbob container
kubectl exec -it deployment/devbob-agent -n devbob -- bash

# 2. Run shell harness
bash tests/validation-harnesses/activity-recommendation-learning-loop-harness.sh

# OR run TypeScript harness
ts-node tests/validation-harnesses/activity-recommendation-learning-loop-harness.ts
```

### Running Locally

```bash
# Set backend URL
export BACKEND_URL=http://api.metabob.local

# Run shell harness
bash tests/validation-harnesses/activity-recommendation-learning-loop-harness.sh

# OR run TypeScript harness
ts-node tests/validation-harnesses/activity-recommendation-learning-loop-harness.ts
```

### Expected Output

```
===========================================
Activity Recommendation and Learning Loop
End-to-End Validation Harness
===========================================

Backend URL: http://api.metabob.local
Test Task: Add REST endpoint for user management
Category: feature

Test 1: Call recommendation endpoint...
✅ PASS: Recommendation endpoint returns success status
✅ PASS: Recommendation count is between 1 and 5
✅ PASS: First recommendation has template_id
✅ PASS: First recommendation has selection_metadata
✅ PASS: Selection method is thompson_sampling
✅ PASS: Selection metadata has alpha > 0
✅ PASS: Selection metadata has beta > 0
✅ PASS: Sample value is between 0 and 1

Test 2: Simulate activity execution and record result...
✅ PASS: Execution recorded successfully
✅ PASS: Execution ID returned

Test 3: Verify metrics updated in recommendations...
✅ PASS: Metrics updated (alpha changed or ranking changed)

===========================================
Test Summary
===========================================
Passed: 11
Failed: 0

✅ ALL TESTS PASSED
===========================================
```

### Validation Impulses

Test case definitions are stored as impulses:
- `impulses/validation-activity-recommendation-learning-loop-case-1.json`
- `impulses/validation-activity-recommendation-learning-loop-case-2.json`
- `impulses/validation-activity-recommendation-learning-loop-case-3.json`
- `impulses/validation-activity-recommendation-learning-loop-case-4.json`

These impulses contain:
- Input data for each test case
- Expected output structure
- Validation criteria
- Historical test data (can be run without LLM)

### Harness Impulse

The harness itself is tracked as an impulse:
- `impulses/harness-activity-recommendation-learning-loop.json`

This allows the validation harness to be:
- Versioned and tracked
- Loaded by other tools
- Executed programmatically
- Referenced in activity templates

### Integration with CI/CD

```yaml
# Example GitHub Actions workflow
name: Validate Learning Loop
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run validation harness
        run: |
          export BACKEND_URL=${{ secrets.BACKEND_URL }}
          bash tests/validation-harnesses/activity-recommendation-learning-loop-harness.sh
```

### Programmatic Usage (TypeScript)

```typescript
import { runValidation } from './activity-recommendation-learning-loop-harness';

async function main() {
  const result = await runValidation({
    backendUrl: 'http://api.metabob.local',
    taskDescription: 'Add REST endpoint for user management',
    category: 'feature',
    limit: 5,
  });

  console.log(`Tests Passed: ${result.testsPassed}`);
  console.log(`Tests Failed: ${result.testsFailed}`);
  console.log(`Overall: ${result.pass ? 'PASS' : 'FAIL'}`);

  if (!result.pass) {
    console.log('Failed tests:');
    result.testResults
      .filter((t) => !t.pass)
      .forEach((t) => {
        console.log(`  - ${t.name}: ${t.message}`);
      });
  }

  process.exit(result.pass ? 0 : 1);
}

main();
```

### Troubleshooting

**Error: Connection refused**
- Verify backend is running: `curl http://api.metabob.local/health`
- Check network connectivity to backend
- Ensure DNS resolves api.metabob.local

**Error: 404 Not Found on /v2/activities/recommend**
- Verify backend deployment includes the recommend endpoint
- Check backend logs: `kubectl logs deployment/metabob-rpc-api -n metabob`
- Ensure latest code is deployed

**Error: Metrics not updating**
- Background processing may take longer than 2 seconds
- Check SurrealDB connectivity
- Verify learning loop endpoint is functioning: `curl http://api.metabob.local/api/v1/learning-loop/health`

### Manual Validation

For manual validation in devbob container:

```bash
# 1. Test recommendation endpoint
curl -X POST http://api.metabob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Add REST endpoint for user management",
    "category": "feature",
    "limit": 5
  }' | jq '.'

# 2. Record execution
curl -X POST http://api.metabob.local/api/v1/learning-loop/executions \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "test_exec_12345",
    "template_id": "[template_id_from_step_1]",
    "started_at": "2026-03-07T20:00:00Z",
    "duration_ms": 5000,
    "success": true,
    "tokens": {"input": 1000, "output": 500, "cache": 200},
    "cost": 0.05,
    "impulses_used": [],
    "component_changes": []
  }' | jq '.'

# 3. Call recommendations again and verify metrics changed
curl -X POST http://api.metabob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Add REST endpoint for user management",
    "category": "feature",
    "limit": 5
  }' | jq '.'
```
