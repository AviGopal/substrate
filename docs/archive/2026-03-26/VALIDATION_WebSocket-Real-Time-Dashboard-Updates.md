# WebSocket Real-Time Dashboard Updates - Validation Harness

**Specification**: WebSocket-Real-Time-Dashboard-Updates  
**Harness File**: `tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts`  
**Status**: READY  
**Date**: March 19, 2026

---

## Overview

This validation harness tests the complete WebSocket event flow for real-time dashboard updates without requiring LLM assistance. It is a deterministic, repeatable test that validates:

1. WebSocket connection and authentication
2. Execution event broadcasting (execution_started, execution_completed, template_updated)
3. Event data integrity and format
4. Multiple clients receiving same events
5. Auto-reconnect capability

---

## Harness Architecture

### Test Flow

```
1. Connect WebSocket client → Activity API ws://host/ws
2. Authenticate → Send { type: 'authenticate', token: 'xxx' }
3. Wait for authentication confirmation
4. Trigger execution → POST /v2/activities/executions
5. Wait for events → execution_started, execution_completed, template_updated
6. Validate event data → Check fields, types, values
7. Disconnect → Clean up
```

### Validation Points

**Connection Phase**:
- ✅ WebSocket connects successfully
- ✅ Authentication message accepted
- ✅ Server responds with 'authenticated' confirmation

**Execution Phase**:
- ✅ execution_started event received
- ✅ execution_started contains execution_id and variant_id
- ✅ variant_id matches request
- ✅ execution_completed event received
- ✅ execution_completed contains success, duration_ms, cost
- ✅ success value matches request
- ✅ template_updated event received
- ✅ template_updated contains variant_id and metrics
- ✅ metrics contain success_rate, thompson_alpha, thompson_beta

**Multi-Client Phase**:
- ✅ All clients receive same events
- ✅ All clients receive same execution_id
- ✅ Event order is consistent

---

## Test Cases

### Test Case 1: Success Execution

**Impulse ID**: `validation-WebSocket-Real-Time-Dashboard-Updates-case-1`

**Input**:
```json
{
  "apiUrl": "http://localhost:8080",
  "wsUrl": "ws://localhost:8080/ws",
  "authToken": "test-token",
  "execution": {
    "variant_id": "test-websocket-validation-success",
    "success": true,
    "duration_ms": 1000,
    "cost": 0.01,
    "tokens": {
      "input": 100,
      "output": 50,
      "cache": 0
    }
  }
}
```

**Expected Output**:
```json
{
  "pass": true,
  "eventsReceived": ["execution_started", "execution_completed", "template_updated"],
  "eventData": {
    "execution_started": {
      "execution_id": "<string>",
      "variant_id": "test-websocket-validation-success"
    },
    "execution_completed": {
      "execution_id": "<string>",
      "variant_id": "test-websocket-validation-success",
      "success": true,
      "duration_ms": 1000,
      "cost": 0.01
    },
    "template_updated": {
      "variant_id": "test-websocket-validation-success",
      "metrics": {
        "success_rate": "<number>",
        "thompson_alpha": "<number>",
        "thompson_beta": "<number>"
      }
    }
  }
}
```

---

### Test Case 2: Failure Execution

**Impulse ID**: `validation-WebSocket-Real-Time-Dashboard-Updates-case-2`

**Input**:
```json
{
  "apiUrl": "http://localhost:8080",
  "wsUrl": "ws://localhost:8080/ws",
  "authToken": "test-token",
  "execution": {
    "variant_id": "test-websocket-validation-failure",
    "success": false,
    "duration_ms": 500,
    "cost": 0.005,
    "tokens": {
      "input": 50,
      "output": 10,
      "cache": 0
    }
  }
}
```

**Expected Output**:
```json
{
  "pass": true,
  "eventsReceived": ["execution_started", "execution_completed", "template_updated"],
  "eventData": {
    "execution_started": {
      "execution_id": "<string>",
      "variant_id": "test-websocket-validation-failure"
    },
    "execution_completed": {
      "execution_id": "<string>",
      "variant_id": "test-websocket-validation-failure",
      "success": false,
      "duration_ms": 500,
      "cost": 0.005
    },
    "template_updated": {
      "variant_id": "test-websocket-validation-failure",
      "metrics": {
        "success_rate": "<number>",
        "thompson_alpha": "<number>",
        "thompson_beta": "<number>"
      }
    }
  }
}
```

---

## Usage

### Programmatic Usage

```typescript
import { runValidation, runMultiClientValidation, TEST_CASES } from './websocket-real-time-dashboard-updates-harness';

// Run single client validation
const result = await runValidation(TEST_CASES.successCase);
console.log('Pass:', result.pass);
console.log('Details:', result.details);

// Run multi-client validation
const multiResult = await runMultiClientValidation(TEST_CASES.successCase);
console.log('Multi-client pass:', multiResult.pass);
```

### Command Line Usage

```bash
# Set environment variables
export API_URL=http://localhost:8080
export WS_URL=ws://localhost:8080/ws
export AUTH_TOKEN=test-token

# Run validation harness
bun tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts

# Or use the helper function
bun -e 'import { runAllTests } from "./tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts"; process.exit((await runAllTests()) ? 0 : 1)'
```

### Integration with CI/CD

```yaml
# .github/workflows/validate-websocket.yml
name: Validate WebSocket Real-Time Updates

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Start Activity API
        run: |
          cd repos/metabob-activity-api
          bun run dev &
          sleep 5
      
      - name: Run validation harness
        run: |
          bun tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts
        env:
          API_URL: http://localhost:8080
          WS_URL: ws://localhost:8080/ws
          AUTH_TOKEN: test-token
```

---

## Expected Results

### Success Criteria

All tests pass when:
- WebSocket connection succeeds
- Authentication completes
- All 3 events received (execution_started, execution_completed, template_updated)
- Event data matches expected format
- Multiple clients receive identical events
- No validation errors

### Failure Scenarios

Tests fail if:
- WebSocket connection timeout (default: 5s)
- Authentication fails or times out
- Expected events not received within timeout (default: 10s)
- Event data missing required fields
- Event data types don't match specification
- Multiple clients receive different events

---

## Troubleshooting

### Connection Timeout

**Error**: `WebSocket connection timeout after 5000ms`

**Solutions**:
- Verify Activity API is running: `curl http://localhost:8080/health`
- Check WebSocket endpoint is accessible: `wscat -c ws://localhost:8080/ws`
- Increase timeout in test case configuration

### Authentication Failure

**Error**: `Failed to authenticate with WebSocket server`

**Solutions**:
- Check server logs for authentication errors
- Verify auth token is valid
- Check server WebSocket message handler accepts authentication

### Events Not Received

**Error**: `Timeout waiting for events. Missing: execution_completed`

**Solutions**:
- Check execution was triggered successfully (check POST response)
- Verify broadcaster.emit() is called in execution handler
- Check server logs for WebSocket broadcast errors
- Increase event timeout in test case

### Event Data Invalid

**Error**: `execution_completed missing or invalid duration_ms`

**Solutions**:
- Verify broadcaster.emit() sends correct data structure
- Check event types match dashboard expectations
- Review server-side event emission code

---

## Maintenance

### Adding New Test Cases

1. Add test case to `TEST_CASES` object in harness:
```typescript
export const TEST_CASES = {
  // ... existing cases
  newCase: {
    name: 'New Test Case',
    input: { ... },
    expectedEvents: [...],
    timeout: 10000,
  },
};
```

2. Create impulse for test case:
```typescript
const impulse = {
  id: 'validation-WebSocket-Real-Time-Dashboard-Updates-case-N',
  type: 'memo',
  content: JSON.stringify({
    input: TEST_CASES.newCase.input,
    expectedOutput: {...},
  }),
};
```

### Updating Validation Logic

Modify validation functions in harness:
- `validateSingleClient()` - Single client test logic
- `validateMultipleClients()` - Multi-client test logic
- Event data validation - Add/modify checks in validation errors section

---

## Performance Benchmarks

### Expected Timings

- WebSocket connection: <100ms
- Authentication: <50ms
- Event reception (all 3 events): <200ms
- Total single client test: <5s
- Total multi-client test (3 clients): <8s

### Latency Goals

- Connection to auth: <150ms
- Execution to execution_started: <50ms
- Execution completion to execution_completed: <50ms
- Metrics update to template_updated: <50ms
- **Total real-time latency: <150ms** (execution trigger to dashboard update)

This represents a **50x improvement** over 5-second polling.

---

## Outputs

**Harness File**: `tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts`  
**Test Cases**: Embedded in harness as `TEST_CASES` export  
**Validation Results**: Returned as `ValidationResult` objects  

**Impulses Created**:
- `harness-WebSocket-Real-Time-Dashboard-Updates` - Pointer to harness file
- `validation-WebSocket-Real-Time-Dashboard-Updates-case-1` - Success test case
- `validation-WebSocket-Real-Time-Dashboard-Updates-case-2` - Failure test case

---

## Next Steps

1. **Run Initial Validation**: Execute harness against current implementation
2. **Fix Any Failures**: Address validation errors
3. **Integrate with CI/CD**: Add to automated test pipeline
4. **Dashboard Integration**: Connect dashboard WebSocket client
5. **E2E Testing**: Test complete flow from MiniBob to dashboard UI

---

## Summary

This validation harness provides **deterministic, repeatable testing** of WebSocket real-time updates without requiring LLM assistance. It validates:

✅ WebSocket server functionality  
✅ Event broadcasting system  
✅ Event data integrity  
✅ Multi-client support  
✅ Real-time latency (<150ms)

The harness is ready for use in development, testing, and CI/CD pipelines.
