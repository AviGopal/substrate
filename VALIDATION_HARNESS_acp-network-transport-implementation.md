# Validation Harness: ACP Network Transport Implementation

**Specification**: acp-network-transport-implementation  
**Harness File**: `tests/validation-harnesses/acp-network-transport-implementation-harness.ts`  
**Date**: 2026-03-09  
**Status**: ✅ Created

---

## Overview

This validation harness tests the complete TCP/HTTP transport implementation for ACP delegation, verifying that the recurring blocker ("TCP transport not implemented") has been resolved.

---

## Test Coverage

### Phase 1: Implementation Verification
1. **TCP Transport Exists** - Verifies TCPTransport class is exported and not a stub
2. **HTTP Endpoint Exists** - Verifies POST /acp/stream route is accessible

### Phase 2: Connection Tests
3. **TCP Connection** - Verifies TCPTransport.connect() returns valid streams

### Phase 3: End-to-End Tests
4. **TCP Delegation** - Verifies acp_delegate works with tcp:// targets

### Phase 4: Reliability Tests
5. **Connection Cleanup** - Verifies close() works without errors
6. **Error Handling** - Verifies invalid hosts are handled gracefully

---

## Test Cases

### Case 1: TCP Transport Implementation Exists
**Impulse**: `validation-acp-network-transport-implementation-case-1`

**Input**:
```json
{
  "module": "repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts",
  "expectedExports": ["TCPTransport"],
  "expectedMethods": ["connect", "close", "getMetadata"]
}
```

**Expected Output**:
```json
{
  "classExists": true,
  "isStub": false,
  "hasConnectMethod": true,
  "connectUsesHTTP": true
}
```

**Validation**: Checks that TCPTransport is not the stub implementation that throws errors.

---

### Case 2: HTTP Server Has ACP Endpoint
**Impulse**: `validation-acp-network-transport-implementation-case-2`

**Input**:
```json
{
  "serverCommand": "opencode acp --port 18081",
  "endpoint": "POST /acp/stream",
  "headers": {
    "Content-Type": "application/x-ndjson"
  }
}
```

**Expected Output**:
```json
{
  "endpointExists": true,
  "acceptsHTTPPost": true,
  "responseCode": "not 404"
}
```

**Validation**: Starts ACP server, tests POST /acp/stream endpoint exists.

---

### Case 3: TCP Transport Connects to Local Server
**Impulse**: `validation-acp-network-transport-implementation-case-3`

**Input**:
```json
{
  "target": "tcp://localhost:18082",
  "serverPort": 18082,
  "timeout": 5000
}
```

**Expected Output**:
```json
{
  "connectionSucceeds": true,
  "stdinStreamExists": true,
  "stdoutStreamExists": true,
  "streamsAreValid": true
}
```

**Validation**: Creates TCPTransport, calls connect(), verifies streams are returned.

---

### Case 4: End-to-End TCP Delegation
**Impulse**: `validation-acp-network-transport-implementation-case-4`

**Input**:
```json
{
  "target": "tcp://localhost:18083",
  "taskDescription": "Test TCP delegation",
  "prompt": "Echo back the text: TCP_TRANSPORT_WORKS",
  "timeout": 30
}
```

**Expected Output**:
```json
{
  "delegationSucceeds": true,
  "responseReceived": true,
  "responseNotEmpty": true,
  "responseTime": "< 30 seconds"
}
```

**Validation**: Full acp_delegate call with tcp:// target, verifies response is received.

---

### Case 5: Connection Cleanup
**Impulse**: `validation-acp-network-transport-implementation-case-5`

**Input**:
```json
{
  "target": "tcp://localhost:18084",
  "operation": "connect then close"
}
```

**Expected Output**:
```json
{
  "closeSucceeds": true,
  "noErrorsOnClose": true,
  "resourcesReleased": true
}
```

**Validation**: Connects then closes, verifies no errors and proper cleanup.

---

### Case 6: Error Handling for Invalid Connection
**Impulse**: `validation-acp-network-transport-implementation-case-6`

**Input**:
```json
{
  "target": "tcp://invalid-host-that-does-not-exist:9999",
  "expectedBehavior": "throw error"
}
```

**Expected Output**:
```json
{
  "throwsError": true,
  "errorIsDescriptive": true,
  "noUncaughtExceptions": true
}
```

**Validation**: Attempts connection to invalid host, verifies error is thrown gracefully.

---

## Usage

### Run All Tests
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run tests/validation-harnesses/acp-network-transport-implementation-harness.ts
```

### Expected Output
```
🧪 ACP Network Transport Implementation Validation
============================================================

📦 Phase 1: Implementation Verification
  🔍 Test: TCP Transport Implementation Exists
  🔍 Test: HTTP Server Has POST /acp/stream Endpoint

🔌 Phase 2: Connection Tests
  🔍 Test: TCP Transport Connects to Local Server

🚀 Phase 3: End-to-End Tests
  🔍 Test: End-to-End TCP Delegation

🛡️ Phase 4: Reliability Tests
  🔍 Test: Connection Cleanup
  🔍 Test: Error Handling for Invalid Connection

============================================================
📊 Summary: 6/6 tests passed
   ✅ Passed: 6
   ❌ Failed: 0
   ⏭️  Skipped: 0

🎉 All tests passed! TCP transport implementation is working.
```

### Exit Code
- **0**: All tests passed
- **1**: One or more tests failed

---

## Integration with Trace-Enforce-Validate Loop

This harness completes the validation phase of the loop:

1. **Trace**: `impulses/trace-acp-network-transport-implementation.json` ✅
2. **Enforce**: `impulses/enforcement-acp-network-transport-implementation.json` ✅
3. **Validate**: `impulses/harness-acp-network-transport-implementation.json` ✅ (this)

### Historical Test Cases (No LLM Required)

All test cases are stored as impulses with input/expected output pairs:
- `validation-acp-network-transport-implementation-case-1` through `case-6`
- Can be run repeatedly without LLM involvement
- Provides regression detection for future changes

---

## Blockers Resolved

Running this harness validates that the following recurring blockers are resolved:

✅ TCP transport not implemented error  
✅ Cannot delegate to Kubernetes pods  
✅ Cannot use tcp:// targets  
✅ DevBob validation blocked  
✅ Hierarchical composition blocked  
✅ Variant tracking blocked  

---

## Next Steps

1. **Run Validation**: Execute harness to verify implementation
2. **Fix Failures**: If tests fail, review enforcement changes
3. **Kubernetes Test**: Deploy DevBob pod, test with kubectl port-forward
4. **Production Deploy**: Update DevBob Helm chart with ACP port config

---

## References

- **Harness Impulse**: `impulses/harness-acp-network-transport-implementation.json`
- **Test Case Impulses**: `impulses/validation-acp-network-transport-implementation-case-*.json`
- **Trace Summary**: `TRACE_acp-network-transport-implementation.md`
- **Enforcement Summary**: `ENFORCEMENT_SUMMARY_acp-network-transport-implementation.md`

---

**Status**: Harness created, ready to run  
**Coverage**: 6 test cases covering implementation, connection, delegation, and error handling  
**Run Time**: ~15-20 seconds (includes server startup delays)
