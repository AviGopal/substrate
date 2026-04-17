# Backend Integration Tests - Summary

## Overview

Comprehensive validation test suite for MiniBob's unified execution path integration with `activity.metabob.com`.

## What Was Created

### 1. Test Suite (`backend-integration.test.ts`)

Bun test suite with 20+ tests covering:

- **Thompson Sampling Integration**
  - Activity recommendation queries
  - Resolver execution traces

- **Trace Submission**
  - Multi-resolver execution traces
  - Composition edge recording
  - State snapshot capture

- **Template Management**
  - Ribosome template extraction
  - Template registration
  - Recommendation integration

- **State Space Navigation**
  - State transition recording
  - Similar-state queries

- **Impulse Relevance Tracking**
  - Impulse usage metrics
  - Learning optimization

- **Tool Usage Patterns**
  - Tool argument recording
  - Pattern recommendations

- **Error Handling**
  - Authentication failures
  - Network errors

### 2. Compatibility Checker (`check-backend-compatibility.ts`)

Standalone script that validates:

- Backend health endpoint
- Authentication with API key
- All required endpoints exist:
  - `/v2/activities/recommend`
  - `/v2/activities/execution-traces`
  - `/v2/activities/composition`
  - `/v2/impulses/resolve`
  - `/v2/activities/templates`
  - `/v2/activities/impulse-relevance`
  - `/v2/activities/tool-usage`
- Response format compatibility
- Rate limiting headers

### 3. Trace Format Validator (`validate-trace-format.ts`)

Validates execution traces include:

- Resolver invocations (name, duration, inputs, outputs)
- Impulse state snapshots (before, after)
- Composition metadata
- State transitions
- Thompson Sampling context
- Budget tracking
- Git state

### 4. Monitoring Dashboard (`trace-dashboard.html`)

Interactive HTML dashboard with:

- Summary statistics (executions, success rate, duration, templates)
- Recent executions table
- Resolver usage statistics
- Thompson Sampling scores
- State space navigation data
- Auto-refresh every 30 seconds

### 5. Documentation (`INTEGRATION_VALIDATION_REPORT.md`)

Complete documentation covering:

- Test suite architecture
- Expected trace format
- Common issues and solutions
- CI/CD integration examples
- Metrics and monitoring guidelines

## Quick Start

### Run All Tests

```bash
cd repos/minibob/sandbox
export METABOB_API_KEY="your-api-key"
bun test backend-integration.test.ts
```

### Check Backend Compatibility

```bash
bun run check-backend-compatibility.ts
```

### Validate a Trace

```bash
bun run validate-trace-format.ts trace.json
```

### Open Monitoring Dashboard

```bash
open trace-dashboard.html
# Enter API key when prompted
```

## Integration with CI/CD

Add to deployment pipeline:

```yaml
- name: Validate Backend Integration
  run: |
    cd repos/minibob
    bun run sandbox/check-backend-compatibility.ts
    bun test sandbox/backend-integration.test.ts
  env:
    METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
    METABOB_ENDPOINT: https://activity.metabob.com
```

## Key Metrics

### Success Criteria

- **Trace Submission Rate:** 100%
- **Resolver Coverage:** > 80% of tasks
- **Thompson Sampling Convergence:** < 20 executions
- **State Tracking Coverage:** > 90%

### Monitor in Dashboard

- Success rate trend (should increase)
- Resolver distribution (should favor deterministic)
- Average duration (should decrease)
- Template diversity (should grow)

## Test Coverage

| Category | Tests | Coverage |
|----------|-------|----------|
| Thompson Sampling | 2 | Recommendations, trace updates |
| Trace Submission | 3 | Multi-resolver, composition, state |
| Template Management | 2 | Registration, recommendations |
| State Navigation | 2 | Transitions, similar-state |
| Impulse Relevance | 2 | Metrics, learning |
| Tool Patterns | 2 | Recording, recommendations |
| Error Handling | 2 | Auth failures, network errors |
| Health Check | 2 | Connectivity, version |

## Expected Trace Format

```json
{
  "id": "exec_123",
  "templateId": "template_id",
  "status": "completed",
  "metrics": {
    "duration": 1000,
    "cost": 0.01,
    "totalTokens": { "input": 100, "output": 50 }
  },
  "stateSignature": "state_hash",
  "gitState": { "branch": "main", "commit": "abc123", "dirty": false },
  "executionTrace": {
    "tasks": [{
      "id": "task1",
      "result": {
        "status": "success",
        "metadata": { "resolver": "bash" }
      }
    }],
    "beforeSnapshot": { "timestamp": 123, "files": {} },
    "afterSnapshot": { "timestamp": 456, "files": {} },
    "stateDelta": { "created": [], "modified": [], "deleted": [] }
  }
}
```

## Troubleshooting

### Tests Fail with 401

**Cause:** Invalid API key

**Solution:**
```bash
echo $METABOB_API_KEY  # Verify key is set
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates
```

### Trace Validation Fails

**Cause:** Missing required metadata

**Solution:** Ensure traces include:
- `metadata.resolver` in task results
- `beforeSnapshot` and `afterSnapshot` in trace
- `stateSignature` in execution
- `metrics` with duration/cost/tokens

### Dashboard Shows No Data

**Cause:** API key not configured

**Solution:**
1. Open dashboard in browser
2. Enter API key when prompted
3. Key is saved in localStorage
4. Refresh to reload data

## Next Steps

1. **Run tests locally** to validate your environment
2. **Check backend compatibility** before deploying
3. **Validate traces** from recent executions
4. **Monitor dashboard** for ongoing health
5. **Integrate with CI/CD** for automated validation

## Files Created

```
sandbox/
├── backend-integration.test.ts          (20+ tests)
├── check-backend-compatibility.ts       (compatibility checker)
├── validate-trace-format.ts             (trace validator)
├── trace-dashboard.html                 (monitoring dashboard)
├── INTEGRATION_VALIDATION_REPORT.md     (complete docs)
└── BACKEND_INTEGRATION_TESTS_SUMMARY.md (this file)
```

## Success Validation

All tests passing indicates:

✓ Backend API is reachable and responsive
✓ Authentication works correctly
✓ All required endpoints exist
✓ Trace format is compatible
✓ Thompson Sampling is integrated
✓ Resolver metrics are captured
✓ State space navigation works
✓ Composition learning is enabled

## Documentation

For complete details, see:
- `INTEGRATION_VALIDATION_REPORT.md` - Full test documentation
- `README.md` - Sandbox overview with validation environment
- Test files include inline documentation

## Support

If tests fail or compatibility issues are found:

1. Check environment variables are set correctly
2. Verify backend health: `curl https://activity.metabob.com/health`
3. Review test output for specific error messages
4. Consult `INTEGRATION_VALIDATION_REPORT.md` troubleshooting section
5. Check backend logs if you have access

---

**Status:** Ready for validation
**Last Updated:** 2026-04-16
**MiniBob Version:** Compatible with unified execution path
**Backend Endpoint:** https://activity.metabob.com
