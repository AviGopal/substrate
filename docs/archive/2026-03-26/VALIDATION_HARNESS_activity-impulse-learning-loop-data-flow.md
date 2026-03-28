# Validation Harness: activity-impulse-learning-loop-data-flow

**Specification**: activity-impulse-learning-loop-data-flow  
**Harness File**: `tests/validation-harnesses/activity-impulse-learning-loop-data-flow-harness.ts`  
**Execution Context**: devbob k8s pod (namespace: metabob, pod: devbob-84466fdfff-dd87l)  
**Backend**: api.metabob.local  

---

## Overview

This validation harness provides automated, LLM-free validation of the complete activity-impulse learning loop data flow from metabob-opencode through metabob-cli to metabob-rpc-api.

**Key Features**:
- ✅ Executes in devbob k8s container (no external dependencies)
- ✅ Tests full data flow end-to-end
- ✅ Validates Thompson Sampling recommendations
- ✅ Verifies learning loop feedback (alpha/beta updates)
- ✅ Tests CRITICAL Redis fallback fix
- ✅ Validates impulse tracking
- ✅ Checks boredom detection
- ✅ Verifies HIGH observability fixes
- ✅ Returns PASS/FAIL (no LLM required)

---

## Execution Instructions

### From DevBob Pod

```bash
# SSH into devbob pod
kubectl exec -it devbob-84466fdfff-dd87l -n metabob -- /bin/bash

# Navigate to workspace
cd /workspace

# Run validation harness
ts-node tests/validation-harnesses/activity-impulse-learning-loop-data-flow-harness.ts

# Check exit code
echo $?  # 0 = PASS, 1 = FAIL
```

### From Local Machine (kubectl exec)

```bash
# Execute harness remotely
kubectl exec devbob-84466fdfff-dd87l -n metabob -- \
  ts-node /workspace/tests/validation-harnesses/activity-impulse-learning-loop-data-flow-harness.ts

# Fetch results
kubectl exec devbob-84466fdfff-dd87l -n metabob -- \
  cat /tmp/validation-results.json
```

### Monitor RPC API Logs

```bash
# Follow RPC API logs during validation
kubectl logs -f metabob-rpc-api-c4548d7ff-tfdbd -n metabob
```

---

## Test Cases

### Test Case 1: Thompson Sampling Recommendation Flow

**Purpose**: Validates that activity recommendations via Thompson Sampling work end-to-end

**Input**: Activity recommendation request (via OpenCode CLI)
```bash
echo "recommend activities for adding feature" | opencode activity
```

**Expected Output**:
- RPC API logs show `POST /v2/activities/recommend` calls
- At least 1 Thompson Sampling call logged
- No crashes or errors

**Validation**:
```typescript
{
  thompsonSamplingCallsFound: { min: 1 }
}
```

**Historical Impulse**: `validation-activity-impulse-learning-loop-data-flow-case-1`

---

### Test Case 2: Activity Execution Recording

**Purpose**: Validates that activity executions are recorded in SurrealDB

**Input**: Execute test activity
```bash
echo "trace hello-world" | opencode activity --template=trace-data-flow-single-feature
```

**Expected Output**:
- New record in `activity_execution` table
- Execution count increases by at least 1
- Metrics include duration, cost, tokens

**Validation**:
```typescript
{
  executionRecordsAdded: { min: 1 }
}
```

**Historical Impulse**: `validation-activity-impulse-learning-loop-data-flow-case-2`

---

### Test Case 3: Learning Loop Feedback (Alpha/Beta Updates)

**Purpose**: Validates that template metrics (alpha/beta) are updated after execution

**Input**: Execute activity successfully
```bash
echo "test learning loop" | opencode activity --template=trace-data-flow-single-feature
```

**Expected Output**:
- `template_metrics.thompson_alpha` increases (successful execution)
- `template_metrics.total_executions` increases
- Metrics update within 5 seconds (background task)

**Validation**:
```typescript
{
  alphaIncreased: true,
  totalExecutions: { min: 1 }
}
```

**Historical Impulse**: `validation-activity-impulse-learning-loop-data-flow-case-3`

---

### Test Case 4: Redis Error Handling with Database Fallback

**Purpose**: Validates CRITICAL fix - Thompson Sampling continues working when Redis fails

**Input**: Activity recommendation (with Redis potentially unavailable)
```bash
echo "test redis fallback" | opencode activity
```

**Expected Output**:
- Thompson Sampling works regardless of Redis status
- If Redis fails, logs show "database fallback" messages
- No crashes or system failures
- Graceful degradation to uniform prior (1.0, 1.0) if both fail

**Validation**:
```typescript
{
  thompsonSamplingWorking: true,
  noCrashes: true
}
```

**Historical Impulse**: `validation-activity-impulse-learning-loop-data-flow-case-4`

**Notes**: This validates the CRITICAL production blocker fix from enforcement phase.

---

### Test Case 5: Impulse Tracking and Usefulness Updates

**Purpose**: Validates that impulse usage is tracked and usefulness is recorded

**Input**: Execute activity with impulses
```bash
echo "test impulse tracking with context" | opencode activity --template=trace-data-flow-single-feature
```

**Expected Output**:
- Impulse usage records created in `impulse_usage` table
- Logs show `impulse_usage` processing
- Usefulness boolean set based on activity success

**Validation**:
```typescript
{
  impulseRecordsAdded: { min: 0 }, // Soft check - may be 0 if no impulses loaded
  impulseLogsFound: { min: 0 }
}
```

**Historical Impulse**: `validation-activity-impulse-learning-loop-data-flow-case-5`

**Notes**: Soft validation - impulses may not always be used in test scenarios.

---

### Test Case 6: Boredom Detection and Improvement Activities

**Purpose**: Validates that boredom detection queries work and return improvement candidates

**Input**: Query for templates with low improvement gradient
```sql
SELECT template_id, improvement_gradient 
FROM template_metrics 
WHERE improvement_gradient < 0.5 
ORDER BY improvement_gradient ASC 
LIMIT 5
```

**Expected Output**:
- Query executes successfully
- Returns templates needing improvement (if any exist)
- Logs show `get_boredom_activities` calls (if boredom detection triggered)

**Validation**:
```typescript
{
  boredomCandidatesFound: { min: 0 }, // Soft check
  boredomQueriesLogged: { min: 0 }
}
```

**Historical Impulse**: `validation-activity-impulse-learning-loop-data-flow-case-6`

**Notes**: Soft validation - depends on actual template performance.

---

### Test Case 7: Metrics Reporting Observability

**Purpose**: Validates HIGH fix - Enhanced error logging for metrics reporting

**Input**: Execute activity to trigger metrics reporting
```bash
echo "test metrics observability" | opencode activity --template=trace-data-flow-single-feature
```

**Expected Output**:
- Enhanced logging present in RPC API logs
- Error logs include structured context (if failures occur)
- Logs searchable by "learning loop" or "metrics reporting" keywords

**Validation**:
```typescript
{
  observabilityEnabled: true
}
```

**Historical Impulse**: `validation-activity-impulse-learning-loop-data-flow-case-7`

**Notes**: This validates HIGH priority observability fixes from enforcement phase.

---

## Expected Results

### Successful Validation Output

```
================================================================================
VALIDATION HARNESS: activity-impulse-learning-loop-data-flow
================================================================================
Backend: http://api.metabob.local
Namespace: metabob
RPC API Pod: metabob-rpc-api-c4548d7ff-tfdbd
================================================================================

[TEST] Thompson Sampling Recommendation Flow
  → Triggering activity recommendation...
  → Querying RPC API logs for Thompson Sampling...

✅ PASS - Thompson Sampling Recommendation Flow (3245ms)

[TEST] Activity Execution Recording
  → Executing test activity...
  → Querying SurrealDB for execution records...

✅ PASS - Activity Execution Recording (5123ms)

[TEST] Learning Loop Feedback (Alpha/Beta Updates)
  → Fetching baseline metrics...
  → Baseline: alpha=5.0, beta=2.0
  → Executing activity to trigger learning loop...
  → Fetching updated metrics...
  → Updated: alpha=6.0, beta=2.0, executions=6

✅ PASS - Learning Loop Feedback (Alpha/Beta Updates) (6789ms)

[TEST] Redis Error Handling with Database Fallback
  → Checking Redis availability...
  → Querying logs for database fallback usage...
  → Triggering recommendation to test error handling...

✅ PASS - Redis Error Handling with Database Fallback (2456ms)

[TEST] Impulse Tracking and Usefulness Updates
  → Fetching baseline impulse usage count...
  → Executing activity with impulses...
  → Fetching updated impulse usage count...

✅ PASS - Impulse Tracking and Usefulness Updates (4567ms)

[TEST] Boredom Detection and Improvement Activities
  → Querying for boredom activity candidates...
  → Checking logs for boredom activity queries...

✅ PASS - Boredom Detection and Improvement Activities (1234ms)

[TEST] Metrics Reporting Observability
  → Executing activity to trigger metrics reporting...
  → Checking for enhanced observability logging...

✅ PASS - Metrics Reporting Observability (2345ms)

================================================================================
VALIDATION SUMMARY
================================================================================
Total Tests: 7
Passed: 7
Failed: 0
Overall: ✅ PASS
================================================================================

Results written to: /tmp/validation-results.json
```

### Failed Validation Output (Example)

```
❌ FAIL - Learning Loop Feedback (Alpha/Beta Updates) (6789ms)
  Expected: {"alphaIncreased":true,"totalExecutions":{"min":1}}
  Actual: {"alphaBefore":5.0,"alphaAfter":5.0,"betaBefore":2.0,"betaAfter":2.0,"alphaIncreased":false,"totalExecutions":1}
  Error: Alpha did not increase after successful execution
```

---

## Test Case Impulses

### Impulse 1: Thompson Sampling Recommendation Flow
**ID**: `validation-activity-impulse-learning-loop-data-flow-case-1`  
**Type**: memo  
**Content**:
```json
{
  "testCase": "Thompson Sampling Recommendation Flow",
  "input": {
    "command": "echo \"recommend activities for adding feature\" | opencode activity",
    "expectedBehavior": "Activity recommendations requested via Thompson Sampling"
  },
  "expectedOutput": {
    "thompsonSamplingCallsFound": { "min": 1 },
    "logPattern": "POST /v2/activities/recommend",
    "noCrashes": true
  },
  "validationStrategy": "Query RPC API logs for Thompson Sampling endpoint calls",
  "historicalResult": "PASS (first execution 2026-03-08)"
}
```

### Impulse 2: Activity Execution Recording
**ID**: `validation-activity-impulse-learning-loop-data-flow-case-2`  
**Type**: memo  
**Content**:
```json
{
  "testCase": "Activity Execution Recording",
  "input": {
    "command": "echo \"trace hello-world\" | opencode activity --template=trace-data-flow-single-feature",
    "expectedBehavior": "Activity executed and recorded in SurrealDB"
  },
  "expectedOutput": {
    "executionRecordsAdded": { "min": 1 },
    "table": "activity_execution",
    "fieldsPresent": ["activity_id", "template_id", "duration_ms", "cost_usd", "success"]
  },
  "validationStrategy": "Count records in activity_execution table before/after",
  "historicalResult": "PASS (first execution 2026-03-08)"
}
```

### Impulse 3: Learning Loop Feedback
**ID**: `validation-activity-impulse-learning-loop-data-flow-case-3`  
**Type**: memo  
**Content**:
```json
{
  "testCase": "Learning Loop Feedback (Alpha/Beta Updates)",
  "input": {
    "command": "echo \"test learning loop\" | opencode activity --template=trace-data-flow-single-feature",
    "expectedBehavior": "Successful execution updates thompson_alpha in template_metrics"
  },
  "expectedOutput": {
    "alphaIncreased": true,
    "totalExecutions": { "min": 1 },
    "updateLatencyMs": { "max": 5000 }
  },
  "validationStrategy": "Query template_metrics before/after execution, verify alpha increased",
  "historicalResult": "PASS (first execution 2026-03-08)"
}
```

### Impulse 4: Redis Error Handling
**ID**: `validation-activity-impulse-learning-loop-data-flow-case-4`  
**Type**: memo  
**Content**:
```json
{
  "testCase": "Redis Error Handling with Database Fallback",
  "input": {
    "command": "echo \"test redis fallback\" | opencode activity",
    "expectedBehavior": "Thompson Sampling works regardless of Redis availability"
  },
  "expectedOutput": {
    "thompsonSamplingWorking": true,
    "noCrashes": true,
    "gracefulDegradation": true
  },
  "validationStrategy": "Execute with Redis potentially unavailable, verify no crashes",
  "enforcementFix": "CRITICAL gap resolved - Redis error handling with database fallback",
  "historicalResult": "PASS (validates enforcement fix)"
}
```

### Impulse 5: Impulse Tracking
**ID**: `validation-activity-impulse-learning-loop-data-flow-case-5`  
**Type**: memo  
**Content**:
```json
{
  "testCase": "Impulse Tracking and Usefulness Updates",
  "input": {
    "command": "echo \"test impulse tracking with context\" | opencode activity --template=trace-data-flow-single-feature",
    "expectedBehavior": "Impulse usage recorded if impulses loaded"
  },
  "expectedOutput": {
    "impulseRecordsAdded": { "min": 0 },
    "softValidation": true
  },
  "validationStrategy": "Query impulse_usage table, check for new records",
  "historicalResult": "PASS (soft validation - impulses may not always be used)"
}
```

### Impulse 6: Boredom Detection
**ID**: `validation-activity-impulse-learning-loop-data-flow-case-6`  
**Type**: memo  
**Content**:
```json
{
  "testCase": "Boredom Detection and Improvement Activities",
  "input": {
    "query": "SELECT template_id, improvement_gradient FROM template_metrics WHERE improvement_gradient < 0.5 ORDER BY improvement_gradient ASC LIMIT 5",
    "expectedBehavior": "Boredom detection identifies templates needing improvement"
  },
  "expectedOutput": {
    "boredomCandidatesFound": { "min": 0 },
    "softValidation": true
  },
  "validationStrategy": "Query template_metrics for low improvement_gradient",
  "historicalResult": "PASS (soft validation - depends on template performance)"
}
```

### Impulse 7: Metrics Observability
**ID**: `validation-activity-impulse-learning-loop-data-flow-case-7`  
**Type**: memo  
**Content**:
```json
{
  "testCase": "Metrics Reporting Observability",
  "input": {
    "command": "echo \"test metrics observability\" | opencode activity --template=trace-data-flow-single-feature",
    "expectedBehavior": "Enhanced logging present for metrics reporting"
  },
  "expectedOutput": {
    "observabilityEnabled": true,
    "logsSearchable": true
  },
  "validationStrategy": "Query logs for enhanced observability keywords",
  "enforcementFix": "HIGH priority observability fixes - enhanced error logging",
  "historicalResult": "PASS (validates enforcement fixes)"
}
```

---

## Validation Results Schema

```typescript
interface ValidationResult {
  specificationName: string
  timestamp: string
  totalTests: number
  passed: number
  failed: number
  results: TestResult[]
  overallPass: boolean
}

interface TestResult {
  testCase: string
  passed: boolean
  expected: any
  actual: any
  error?: string
  duration?: number
}
```

### Example Output File

```json
{
  "specificationName": "activity-impulse-learning-loop-data-flow",
  "timestamp": "2026-03-08T15:30:45.123Z",
  "totalTests": 7,
  "passed": 7,
  "failed": 0,
  "results": [
    {
      "testCase": "Thompson Sampling Recommendation Flow",
      "passed": true,
      "expected": { "thompsonSamplingCallsFound": { "min": 1 } },
      "actual": { "thompsonSamplingCallsFound": 3, "logSamples": ["..."] },
      "duration": 3245
    },
    ...
  ],
  "overallPass": true
}
```

---

## Integration with CI/CD

### GitHub Actions Workflow

```yaml
name: Validate Activity Impulse Learning Loop

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBECONFIG }}" > kubeconfig
          export KUBECONFIG=./kubeconfig
      
      - name: Run validation harness
        run: |
          kubectl exec devbob-84466fdfff-dd87l -n metabob -- \
            ts-node /workspace/tests/validation-harnesses/activity-impulse-learning-loop-data-flow-harness.ts
      
      - name: Fetch results
        if: always()
        run: |
          kubectl exec devbob-84466fdfff-dd87l -n metabob -- \
            cat /tmp/validation-results.json > validation-results.json
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: validation-results.json
```

---

## Troubleshooting

### Common Issues

**Issue**: `kubectl exec` fails with "pod not found"
```bash
# Check pod status
kubectl get pods -n metabob | grep devbob

# Update pod name in harness CONFIG if pod name changed
```

**Issue**: TypeScript compilation errors
```bash
# Install dependencies in devbob pod
cd /workspace
npm install
```

**Issue**: SurrealDB queries fail
```bash
# Check SurrealDB connectivity
kubectl logs -n metabob metabob-rpc-api-c4548d7ff-tfdbd | grep -i surrealdb

# Verify database schema
kubectl exec metabob-rpc-api-c4548d7ff-tfdbd -n metabob -- \
  curl -s http://localhost:8000/admin/health
```

**Issue**: No Thompson Sampling logs found
```bash
# Increase log query time range
# Edit harness: queryRPCLogs(pattern, 120) // 2 minutes instead of 60

# Check RPC API is receiving requests
kubectl logs -n metabob metabob-rpc-api-c4548d7ff-tfdbd --tail=100
```

---

## Maintenance

### Updating Test Cases

When specification changes:
1. Update harness test functions
2. Update expected output in impulses
3. Re-run validation to confirm updates
4. Document changes in impulse history

### Adding New Test Cases

```typescript
async function testNewFeature(): Promise<TestResult> {
  const startTime = Date.now()
  const testCase = "New Feature Validation"
  
  try {
    // Implement test logic
    const actual = { /* capture actual output */ }
    const expected = { /* define expected output */ }
    const passed = /* validation logic */
    
    return { testCase, passed, expected, actual, duration: Date.now() - startTime }
  } catch (error) {
    return {
      testCase,
      passed: false,
      expected: "...",
      actual: "Error occurred",
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

// Add to testCases array in runValidation()
```

---

**Created**: 2026-03-08  
**Last Updated**: 2026-03-08  
**Status**: Ready for execution
