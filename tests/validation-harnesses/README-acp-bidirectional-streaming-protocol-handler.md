# Validation Harness: ACP Bidirectional Streaming Protocol Handler

## Overview

This validation harness ensures the `/acp/stream` endpoint in `server.ts` properly handles bidirectional streaming for the Agent Client Protocol without ReadableStream locking errors.

## Specification

The ACP Bidirectional Streaming Protocol Handler must:

1. ✅ Accept streaming request body without locking
2. ✅ Create acpInput ReadableStream from request body
3. ✅ Create acpOutput WritableStream to response
4. ✅ Pass streams to ndJsonStream and AgentSideConnection
5. ✅ Process initialize request successfully
6. ✅ Handle subsequent prompt requests
7. ✅ Maintain connection until client closes
8. ✅ No 'ReadableStream is locked' errors

## Files

- **Harness**: `acp-bidirectional-streaming-protocol-handler-harness.ts`
- **Test Cases**: `acp-bidirectional-streaming-protocol-handler-test-cases.json`
- **Test Script**: `../../repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts`
- **README**: This file

## Test Cases

### Case 1: Localhost Connection
**Impulse ID**: `validation-acp-bidirectional-streaming-protocol-handler-case-1`

**Input**:
- DevBob URL: `http://localhost:8080/acp/stream`
- Prompt: "Echo back exactly: ACP TCP transport is working!"
- Timeout: 15 seconds

**Expected Output**:
- HTTP 200 response
- Initialize succeeds with serverInfo
- Session created with sessionId
- Prompt executes
- Agent responds with text
- No ReadableStream errors
- No connection closed errors
- Success message displayed

### Case 2: Kubernetes Service DNS
**Impulse ID**: `validation-acp-bidirectional-streaming-protocol-handler-case-2`

**Input**:
- DevBob URL: `http://devbob.metabob.svc.cluster.local:8080/acp/stream`
- Prompt: "Simple response test"
- Timeout: 15 seconds

**Expected Output**: Same as Case 1

## Validation Strategy

### Approach
Output-based validation without LLM inference:
1. Execute test-acp-tcp-transport.ts
2. Capture stdout/stderr
3. Fetch DevBob pod logs via kubectl
4. Parse output for success/failure markers
5. Compare against expected criteria
6. Return PASS/FAIL verdict

### Success Criteria
All of the following must be true:
- ✅ Test script exits with code 0
- ✅ HTTP 200 status in output
- ✅ "✓ Initialized:" message present
- ✅ "✓ Session created:" message present
- ✅ "✓ Prompt sent" message present
- ✅ Response text received (not "(no text received)")
- ✅ "SUCCESS: ACP TCP transport is working!" displayed
- ✅ No "ReadableStream is locked" in output or logs
- ✅ No "connection closed" errors in output or logs

### Failure Analysis
If test fails, harness reports:
- Test exit code
- HTTP status (if available)
- Which steps succeeded/failed
- All error messages from stdout/stderr
- Relevant DevBob pod log entries
- Specific criterion that failed

## Prerequisites

### DevBob Deployment
```bash
# Ensure DevBob is running
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Expected output: devbob pod in Running state
```

### Port Forwarding (for localhost tests)
```bash
# Forward local port to DevBob
kubectl port-forward -n metabob svc/devbob 8080:8080 &
```

### kubectl Access
The harness requires kubectl access to fetch logs:
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=50
```

### Test Script
The test script must exist at:
```
repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts
```

## Usage

### Run All Test Cases
```bash
cd tests/validation-harnesses
bun run acp-bidirectional-streaming-protocol-handler-harness.ts
```

### Run Specific Test Case
```typescript
import { runValidation } from "./acp-bidirectional-streaming-protocol-handler-harness"

const testCase = {
  impulseId: "validation-acp-bidirectional-streaming-protocol-handler-case-1",
  input: {
    devbobUrl: "http://localhost:8080/acp/stream",
    testPrompt: "Echo back exactly: ACP TCP transport is working!",
    timeout: 15000
  },
  expectedOutput: {
    httpStatus: 200,
    hasServerInfo: true,
    hasSessionId: true,
    hasResponse: true,
    noStreamErrors: true,
    successMessage: "SUCCESS: ACP TCP transport is working!"
  }
}

const result = await runValidation(testCase)
console.log(result.pass ? "✅ PASS" : "❌ FAIL")
```

## Output

### Console Output
```
🧪 Running ACP Bidirectional Streaming Protocol Handler Validation
   Test Case: validation-acp-bidirectional-streaming-protocol-handler-case-1
   Target: http://localhost:8080/acp/stream

📋 Step 1: Executing ACP TCP transport test...
   Exit code: 0

📋 Step 2: Fetching DevBob pod logs...
   Retrieved 47 log lines

📋 Step 3: Analyzing results...

================================================================================
📊 VALIDATION RESULTS
================================================================================
Status: ✅ PASS
Timestamp: 2026-03-10T02:30:15.123Z

Expected vs Actual:
  HTTP Status: 200 → 200
  Initialize: true → true
  Session Created: true → true
  Prompt Executed: true → true
  Response Received: true → true
  Test Completed: true → true
  ReadableStream Error: false → false
  Connection Closed Error: false → false
================================================================================

💾 Results saved to: validation-results-acp-streaming-case-1.json
```

### JSON Output
```json
{
  "pass": true,
  "actual": {
    "httpStatus": 200,
    "initializeSucceeded": true,
    "sessionCreated": true,
    "promptExecuted": true,
    "responseReceived": true,
    "testCompleted": true,
    "readableStreamError": false,
    "connectionClosedError": false,
    "devbobLogs": ["INFO ACP stream initializing", "..."],
    "errorMessages": []
  },
  "expected": {
    "httpStatus": 200,
    "initializeSucceeded": true,
    "sessionCreated": true,
    "promptExecuted": true,
    "responseReceived": true,
    "testCompleted": true,
    "readableStreamError": false,
    "connectionClosedError": false
  },
  "testOutput": "...",
  "timestamp": "2026-03-10T02:30:15.123Z"
}
```

## Debugging

### Test Fails with "connection refused"
Check DevBob pod status and port forwarding:
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
kubectl port-forward -n metabob svc/devbob 8080:8080
```

### Test Fails with "ReadableStream is locked"
This indicates the fix has not been applied or deployed:
```bash
# Check if fix is in code
cd repos/metabob-opencode
git log --oneline | grep "explicit getReader"

# Rebuild and redeploy
cd packages/opencode && bun run build
docker build -f ../../docker/devbob.Dockerfile -t devbob:latest .
helmfile -e local -l app=devbob apply
```

### Test Fails with timeout
Increase timeout in test case or check DevBob logs:
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=100
```

### Cannot fetch logs
Ensure kubectl is configured and has access:
```bash
kubectl config current-context
kubectl auth can-i list pods -n metabob
```

## Integration with CI/CD

### Pre-deployment Validation
Run before deploying DevBob:
```bash
#!/bin/bash
# Pre-deployment check
cd tests/validation-harnesses
bun run acp-bidirectional-streaming-protocol-handler-harness.ts

if [ $? -ne 0 ]; then
  echo "❌ ACP streaming validation failed - deployment blocked"
  exit 1
fi

echo "✅ ACP streaming validation passed - proceeding with deployment"
```

### Post-deployment Verification
Run after deploying new DevBob version:
```bash
# Wait for pod to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=devbob -n metabob --timeout=60s

# Run validation
cd tests/validation-harnesses
bun run acp-bidirectional-streaming-protocol-handler-harness.ts
```

## Related Documentation

- **Trace Analysis**: `TRACE_ACP_BIDIRECTIONAL_STREAMING_PROTOCOL_HANDLER.md`
- **Enforcement Summary**: `ENFORCEMENT_ACP_BIDIRECTIONAL_STREAMING_PROTOCOL_HANDLER.md`
- **Test Script**: `repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts`
- **ACP Blocker Analysis**: `ACP_TCP_BLOCKER_ANALYSIS.md`

## Maintenance

### Updating Test Cases
Edit `acp-bidirectional-streaming-protocol-handler-test-cases.json` to add/modify test cases.

### Updating Expected Output
If specification changes, update `expectedOutput` in test cases.

### Adding New Validation Criteria
Modify the `analyzeResults()` function in the harness to check additional conditions.

## Impulse Storage

Test cases are stored as impulses for historical reference and reuse:

```typescript
// Impulse ID format
validation-acp-bidirectional-streaming-protocol-handler-case-{N}

// Impulse Type
memo

// Budget
2000 tokens per test case

// Content
{ input: {...}, expectedOutput: {...} }
```

## Success Metrics

- **Pass Rate**: 100% (both test cases must pass)
- **Execution Time**: < 15 seconds per test case
- **False Positives**: 0 (strict output matching)
- **False Negatives**: 0 (comprehensive error checking)

## Troubleshooting Checklist

- [ ] DevBob pod is running
- [ ] Port forwarding is active (for localhost tests)
- [ ] kubectl has access to metabob namespace
- [ ] test-acp-tcp-transport.ts exists
- [ ] Fix has been applied (commit 5a424d04)
- [ ] DevBob image has been rebuilt with fix
- [ ] DevBob deployment has been updated
- [ ] No network connectivity issues

## Contact

For issues or questions about this validation harness:
- Review trace analysis: `TRACE_ACP_BIDIRECTIONAL_STREAMING_PROTOCOL_HANDLER.md`
- Check enforcement summary: `ENFORCEMENT_ACP_BIDIRECTIONAL_STREAMING_PROTOCOL_HANDLER.md`
- Examine test script: `test-acp-tcp-transport.ts`
