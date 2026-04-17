# Backend Integration Validation Report

This document describes the validation test suite for MiniBob's unified execution path integration with `activity.metabob.com`.

## Overview

The backend integration tests validate that the unified execution path correctly integrates with the production backend for:

1. **Thompson Sampling queries** - Activity recommendations with learning metrics
2. **Trace submission** - Execution traces with resolver metrics
3. **Template storage** - Ribosome-extracted templates
4. **Composition edge recording** - Activity composition learning
5. **Impulse relevance tracking** - Impulse usage optimization
6. **State space navigation** - Similar-state execution discovery

## Test Files

### 1. Backend Integration Test Suite

**File:** `sandbox/backend-integration.test.ts`

Comprehensive Bun test suite validating all backend integration points.

**Test Groups:**

#### A. Thompson Sampling Integration
- `Activity recommendation query works` - Verifies recommendation endpoint returns valid Thompson Sampling scores
- `Resolver execution creates traces` - Ensures resolver-based executions submit traces correctly

#### B. Trace Submission
- `Unified path traces include all resolvers` - Validates multi-resolver traces
- `Composition edges recorded` - Checks parent-child activity relationships
- `Impulse state snapshots captured` - Verifies before/after state tracking

#### C. Template Management
- `Ribosome extraction submits templates` - Tests template registration
- `Template appears in recommendations after registration` - Validates Thompson Sampling integration

#### D. State Space Navigation
- `State transitions recorded` - Checks state signature and delta tracking
- `Similar state queries work` - Validates state-based execution matching

#### E. Impulse Relevance Tracking
- `Impulse usage metrics recorded` - Tests impulse relevance API
- `Impulse relevance affects recommendations` - Validates learning integration

#### F. Tool Usage Patterns
- `Tool argument patterns recorded` - Tests tool usage tracking
- `Tool recommendations based on patterns` - Validates learned patterns

#### G. Error Handling
- `Invalid API key returns 401` - Authentication failure handling
- `Network errors are handled gracefully` - Connection failure handling

#### H. Health Check
- `Backend health endpoint responds` - Basic connectivity check
- `Backend version information available` - Version compatibility check

**Running the Tests:**

```bash
cd repos/minibob
bun test sandbox/backend-integration.test.ts
```

**Requirements:**
- `METABOB_API_KEY` environment variable
- `METABOB_ENDPOINT` (optional, defaults to https://activity.metabob.com)

### 2. Backend Compatibility Checker

**File:** `sandbox/check-backend-compatibility.ts`

Standalone script that validates backend API compatibility.

**Checks Performed:**

1. **Environment** - Validates required environment variables
2. **Connectivity** - Tests health endpoint
3. **Authentication** - Verifies API key works
4. **Required Endpoints** - Checks all critical endpoints exist:
   - `/v2/activities/recommend` (Thompson Sampling)
   - `/v2/activities/execution-traces` (trace submission)
   - `/v2/activities/composition` (composition edges)
   - `/v2/impulses/resolve` (impulse resolution)
   - `/v2/activities/templates` (template list)
   - `/v2/activities/impulse-relevance` (impulse relevance)
   - `/v2/activities/tool-usage` (tool usage)
5. **Response Format** - Validates response structures
6. **Version Compatibility** - Checks backend version
7. **Rate Limiting** - Inspects rate limit headers

**Running:**

```bash
cd repos/minibob
bun run sandbox/check-backend-compatibility.ts
```

**Exit Codes:**
- `0` - All checks passed
- `1` - Critical checks failed

### 3. Trace Format Validator

**File:** `sandbox/validate-trace-format.ts`

Validates that execution traces include all required metadata for backend integration.

**Validations:**

1. **Resolver Invocations** - Checks resolver metadata in tasks
2. **Impulse State Snapshots** - Validates before/after snapshots
3. **Composition Metadata** - Checks composition chain and depth
4. **State Transitions** - Validates stateDelta structure
5. **Thompson Sampling Context** - Ensures metrics for learning
6. **Budget Tracking** - Validates impulse budget data
7. **Git State** - Checks git repository metadata

**Usage:**

```bash
# Validate from file
bun run sandbox/validate-trace-format.ts trace.json

# Validate from stdin
cat trace.json | bun run sandbox/validate-trace-format.ts --stdin
```

**Output:**
- Lists all validation errors and warnings
- Shows detailed breakdown of trace metadata
- Exit code 0 = valid, 1 = invalid

### 4. Monitoring Dashboard

**File:** `sandbox/trace-dashboard.html`

Interactive HTML dashboard for real-time trace monitoring.

**Features:**

1. **Summary Stats**
   - Total executions
   - Success rate (24h)
   - Average duration
   - Active template count

2. **Recent Executions**
   - Execution ID
   - Template name
   - Status badge
   - Duration
   - Resolvers used
   - Timestamp

3. **Resolver Statistics**
   - Execution count per resolver
   - Success rate
   - Average duration
   - Progress visualization

4. **Thompson Sampling Scores**
   - Template name
   - Alpha/Beta values
   - Success rate
   - Total executions
   - Confidence level

5. **State Space Navigation**
   - State signatures
   - Git branch
   - Available shapes
   - File changes (created/modified/deleted)

**Usage:**

1. Open `trace-dashboard.html` in browser
2. Enter your `METABOB_API_KEY` when prompted
3. Dashboard auto-refreshes every 30 seconds

**Filters:**
- Status (all/completed/failed)
- Time range (1h/24h/7d/30d)

## Integration Testing Workflow

### Pre-Deployment Validation

Before deploying to canary:

```bash
# 1. Check backend compatibility
bun run sandbox/check-backend-compatibility.ts

# 2. Run integration tests
bun test sandbox/backend-integration.test.ts

# 3. Validate sample trace
bun run sandbox/validate-trace-format.ts sample-trace.json
```

### Post-Deployment Validation

After canary deployment:

```bash
# 1. Verify canary health
curl https://activity.metabob.com/health

# 2. Run integration tests against canary
METABOB_ENDPOINT=https://activity.metabob.com bun test sandbox/backend-integration.test.ts

# 3. Monitor traces in dashboard
open sandbox/trace-dashboard.html
```

### Continuous Monitoring

```bash
# Watch for trace format issues
watch -n 60 'bun run sandbox/check-backend-compatibility.ts'
```

## Expected Trace Format

Example of a valid execution trace:

```json
{
  "id": "exec_123",
  "templateId": "test-template",
  "status": "completed",
  "variables": {},
  "impulses": [
    {
      "id": "impulse1",
      "pointer": { "type": "file", "path": "test.ts" },
      "budget": 1000,
      "priority": "high",
      "loaded": true,
      "tokenCount": 850,
      "createdAt": 1234567890
    }
  ],
  "taskResults": [
    {
      "taskId": "task1",
      "status": "completed",
      "output": "test output",
      "metadata": {
        "resolver": "bash",
        "outputImpulses": []
      }
    }
  ],
  "startedAt": 1234567890,
  "completedAt": 1234567900,
  "metrics": {
    "duration": 10000,
    "cost": 0.05,
    "totalTokens": { "input": 500, "output": 200 }
  },
  "stateSignature": "state_abc123",
  "gitState": {
    "branch": "main",
    "commit": "abc123def456",
    "dirty": false,
    "changedFiles": [],
    "stagedFiles": [],
    "unstagedFiles": []
  },
  "executionTrace": {
    "tasks": [
      {
        "id": "task1",
        "description": "Test task",
        "actualPrompt": "test prompt",
        "toolCalls": [],
        "response": "test output",
        "result": {
          "status": "success",
          "metadata": { "resolver": "bash" }
        }
      }
    ],
    "impulsesCreated": [],
    "filesModified": ["test.ts"],
    "beforeSnapshot": {
      "timestamp": 1234567890,
      "workingDirectory": "/test",
      "files": {},
      "availableShapes": ["file"]
    },
    "afterSnapshot": {
      "timestamp": 1234567900,
      "workingDirectory": "/test",
      "files": {},
      "availableShapes": ["file", "bash_output"]
    },
    "stateDelta": {
      "created": [],
      "modified": ["test.ts"],
      "deleted": [],
      "totalChanges": 1
    }
  }
}
```

## Common Issues

### Issue: Authentication Failure

**Symptom:** Tests fail with 401 Unauthorized

**Solution:**
```bash
# Verify API key is set
echo $METABOB_API_KEY

# Test API key manually
curl -H "Authorization: ApiKey $METABOB_API_KEY" https://activity.metabob.com/v2/activities/templates
```

### Issue: Missing Resolver Metadata

**Symptom:** Trace validation fails with "Task has no resolver metadata"

**Solution:** Ensure all tasks have `metadata.resolver` field:

```typescript
taskResults: [{
  taskId: "task1",
  status: "completed",
  metadata: {
    resolver: "bash"  // Required
  }
}]
```

### Issue: Missing State Snapshots

**Symptom:** Trace validation warns about missing snapshots

**Solution:** Enable state tracking in activity execution:

```typescript
executionTrace: {
  beforeSnapshot: captureStateSnapshot(),
  afterSnapshot: captureStateSnapshot(),
  stateDelta: computeStateDelta(before, after)
}
```

### Issue: Thompson Sampling Not Learning

**Symptom:** Template success rate doesn't improve over time

**Solution:**
1. Verify traces are being submitted: Check logs for "Stored execution trace"
2. Check template has initial Thompson scores: `initialAlpha` and `initialBeta`
3. Verify execution status is being recorded correctly

## Metrics and Monitoring

### Key Metrics

1. **Trace Submission Rate**
   - Target: 100% of executions
   - Alert: < 95%

2. **Resolver Coverage**
   - Target: > 80% tasks use resolvers
   - Alert: < 50%

3. **Thompson Sampling Convergence**
   - Target: Success rate stabilizes after 10 executions
   - Alert: High variance after 20 executions

4. **State Tracking Coverage**
   - Target: 100% of executions have state snapshots
   - Alert: < 90%

### Dashboard Metrics

Monitor in `trace-dashboard.html`:

- **Success Rate Trend** - Should increase over time
- **Resolver Distribution** - Should favor deterministic resolvers
- **Average Duration** - Should decrease as learning improves
- **Template Diversity** - Active template count should grow

## CI/CD Integration

Add to deployment pipeline:

```yaml
# .github/workflows/deploy-canary.yml
- name: Validate Backend Integration
  run: |
    bun run sandbox/check-backend-compatibility.ts
    bun test sandbox/backend-integration.test.ts
  env:
    METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
    METABOB_ENDPOINT: https://activity.metabob.com
```

## Future Enhancements

1. **Real-time Trace Streaming** - WebSocket-based dashboard updates
2. **Composition Graph Visualization** - Interactive activity composition graph
3. **Thompson Sampling Simulator** - Predict template selection before execution
4. **State Space Clustering** - Visualize similar execution states
5. **Automated Regression Detection** - Alert on success rate drops

## Conclusion

This validation suite ensures the unified execution path correctly integrates with the backend learning system. All tests should pass before promoting to production.

**Critical Requirements:**
- Thompson Sampling updates from execution results
- Resolver metrics captured in traces
- State space navigation data recorded
- Composition edges tracked for multi-activity executions

**Success Criteria:**
- All integration tests pass
- Backend compatibility check succeeds
- Trace format validation shows no errors
- Dashboard shows increasing success rates over time
