# ACP Protocol Complete Handshake and Message Exchange - Validation Harness

## Overview

This validation harness tests the complete ACP (Agent Client Protocol) handshake and message exchange flow between a client and the DevBob server.

## What It Validates

### Client-Side Flow
1. ✅ HTTP POST to `/acp/stream` succeeds (200 OK)
2. ✅ Initialize request sent and response received
3. ✅ Session creation request/response
4. ✅ Prompt request and agent response
5. ✅ No timeout errors (< 10s total)
6. ✅ No connection errors

### Server-Side Flow (via logs)
1. ✅ "ACP stream initializing" logged
2. ✅ "initialize" request processed
3. ✅ "new session" request processed
4. ✅ "prompt" request processed
5. ✅ Responses written to stream

## Files

- **acp-protocol-complete-handshake-and-message-exchange-harness.ts** - Main validation script
- **acp-protocol-complete-handshake-test-cases.json** - Historical test cases (no LLM needed)
- **acp-protocol-complete-handshake-README.md** - This file

## Usage

### Run All Validations
```bash
bun run tests/validation-harnesses/acp-protocol-complete-handshake-and-message-exchange-harness.ts
```

### Run Specific Test Case
```typescript
import { runValidation } from "./acp-protocol-complete-handshake-and-message-exchange-harness"

const result = await runValidation({ testCase: 0 })
console.log(result.pass ? "PASS" : "FAIL")
```

### Programmatic Usage
```typescript
const result = await runValidation()

if (result.pass) {
  console.log("✅ Validation passed")
  console.log(`Duration: ${result.actual.duration}ms`)
} else {
  console.log("❌ Validation failed")
  result.failures.forEach(f => console.log(`  - ${f}`))
}
```

## Expected Output

### Success Case
```
🧪 Running validation: validation-acp-protocol-complete-handshake-and-message-exchange-case-1
   Target: http://localhost:8080/acp/stream
   Timeout: 60000ms

🧪 Testing ACP TCP Transport to DevBob
   ✓ Response status: 200 OK

📋 Step 1: Initialize ACP connection
   ✓ Initialized: OpenCode v1.0.0

📋 Step 2: Create new session
   ✓ Session created: ses_abc123

📋 Step 3: Send prompt
   ✓ Prompt sent

✅ Test Results:
   Response text: ACP TCP transport is working!
   Tools called: (none)
   Has error: false

🎉 SUCCESS: ACP TCP transport is working!

================================================================================
📊 VALIDATION RESULTS
================================================================================

✅ Pass: true
⏱️  Duration: 4521ms
🔢 Exit Code: 0

📝 Expected Steps:
   ✅ Initialize ACP connection
   ✅ Create new session
   ✅ Send prompt
   ✅ SUCCESS: ACP TCP transport is working!

🔍 Server Logs (DevBob):
ACP stream initializing
initialize request received
new session created
prompt processing
response sent

📦 Metadata:
   Timestamp: 2026-03-10T03:00:00.000Z
   Test File: repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts
   DevBob Pod: devbob-cfd5c6cb-hgmpc
```

### Failure Case (Before Fix)
```
🧪 Running validation: validation-acp-protocol-complete-handshake-and-message-exchange-case-1

🧪 Testing ACP TCP Transport to DevBob
   ✓ Response status: 200 OK

📋 Step 1: Initialize ACP connection
   (hangs for 12 seconds)
   ❌ Timeout error

================================================================================
📊 VALIDATION RESULTS
================================================================================

✅ Pass: false
⏱️  Duration: 12034ms
🔢 Exit Code: 1

❌ Failures (3):
   1. Missing steps in output: Initialize ACP connection, Create new session, Send prompt
   2. Test took too long: 12034ms (max: 10000ms)
   3. Timeout errors detected in output

📝 Expected Steps:
   ❌ Initialize ACP connection
   ❌ Create new session
   ❌ Send prompt
   ❌ SUCCESS: ACP TCP transport is working!

🔍 Server Logs (DevBob):
ACP stream initializing
(no further logs - deadlock occurred)
```

## Test Cases

### Case 1: Complete Protocol Flow
- **Input**: Standard prompt "Echo back exactly: ACP TCP transport is working!"
- **Expected**: All steps complete, success message, < 10s duration
- **Validates**: Full handshake, session creation, prompt execution

### Case 2: Fast Initialization (Regression Test)
- **Input**: Simple prompt "Return immediately"
- **Expected**: Initialize completes in < 2s
- **Validates**: No deadlock on initialize (regression test for || vs ?? bug)

## Debugging

### If Test Times Out
1. Check DevBob is running: `kubectl get pods -n metabob -l app.kubernetes.io/name=devbob`
2. Check DevBob logs: `kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=50`
3. Verify /acp/stream endpoint: `curl -X POST http://localhost:8080/acp/stream -H "Content-Type: application/x-ndjson"`

### If Initialize Hangs
- **Root cause**: Self-referential SDK call deadlock (fixed in commit ba859b42)
- **Symptom**: Test hangs at "Initialize ACP connection" for 12+ seconds
- **Fix**: Ensure `providedModel ?? (await defaultModel({ sdk }))` uses `??` not `||`

### If Connection Refused
- Port-forward DevBob: `kubectl port-forward -n metabob svc/devbob 8080:8080`
- Check service: `kubectl get svc -n metabob devbob`

## Integration

### CI/CD Pipeline
```yaml
- name: Validate ACP Protocol
  run: |
    bun run tests/validation-harnesses/acp-protocol-complete-handshake-and-message-exchange-harness.ts
  timeout-minutes: 2
```

### Pre-Deployment Gate
```bash
#!/bin/bash
set -e
echo "Running ACP protocol validation..."
bun run tests/validation-harnesses/acp-protocol-complete-handshake-and-message-exchange-harness.ts
echo "✅ ACP protocol validation passed"
```

## Maintenance

### Adding New Test Cases
1. Edit `acp-protocol-complete-handshake-test-cases.json`
2. Add new case with unique `impulseId`
3. Specify input, expectedOutput, and validation criteria
4. Run harness to verify

### Updating Expected Behavior
1. Modify `expectedOutput` in test case JSON
2. Update this README if behavior changes
3. Commit with clear explanation of why expectations changed

## Related Documentation

- [ACP Protocol Specification](https://github.com/agentclientprotocol/spec)
- [Trace Analysis](../../ACP_TRANSPORT_DISCOVERY.md)
- [Fix Commit](../../../repos/metabob-opencode/.git/logs/HEAD) - ba859b42
