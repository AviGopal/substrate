# Validation Harness: Enable Hot-Reload for MCP Clients in Development Mode

**Specification**: Enable Hot-Reload for MCP Clients in Development Mode  
**Harness File**: `repos/metabob-opencode/packages/opencode/tests/validation-harnesses/mcp-hot-reload-harness.ts`  
**Integration Test**: `repos/metabob-opencode/packages/opencode/tests/validation-harnesses/mcp-hot-reload-integration-test.ts`  
**Created**: 2026-03-09  

---

## Overview

This validation harness provides automated testing for the MCP hot-reload feature implementation. It validates that:
1. MCP clients can be reloaded without restarting the entire opencode session
2. The reload functionality is integrated with config reload
3. The CLI command exists and is functional
4. State management works correctly before and after reload

---

## Test Cases

### Test Case 1: MCP.reload() Function Exists
**Impulse**: `validation-mcp-hot-reload-case-1`  
**Input**: None  
**Expected Output**:
```json
{
  "reloadExists": true,
  "reloadType": "function"
}
```
**Validation**: Checks if `MCP.reload` is defined and is a function type

---

### Test Case 2: MCP.reload() Return Structure
**Impulse**: `validation-mcp-hot-reload-case-2`  
**Input**: `await MCP.reload()`  
**Expected Output**:
```json
{
  "hasSuccess": true,
  "hasClients": true,
  "hasErrors": true,
  "successType": "boolean",
  "clientsType": "object",
  "errorsType": "array"
}
```
**Validation**: Verifies reload returns `{success: boolean, clients: object, errors: array}`

---

### Test Case 3: MCP.reload() Idempotency
**Impulse**: `validation-mcp-hot-reload-case-3`  
**Input**: Call reload twice: `await MCP.reload(); await MCP.reload()`  
**Expected Output**:
```json
{
  "firstCallSuccess": true,
  "secondCallSuccess": true,
  "bothCompleted": true
}
```
**Validation**: Verifies reload can be called multiple times without errors

---

### Test Case 4: CLI Command Exists
**Impulse**: `validation-mcp-hot-reload-case-4`  
**Input**: Check `cli/cmd/mcp.ts` file  
**Expected Output**:
```json
{
  "hasReloadCommand": true,
  "hasReloadExport": true,
  "hasReloadInBuilder": true
}
```
**Validation**: Verifies `McpReloadCommand` exists and is registered in CLI builder

---

### Test Case 5: Config Reload Integration
**Impulse**: `validation-mcp-hot-reload-case-5`  
**Input**: Check `config/reload.ts` file  
**Expected Output**:
```json
{
  "importsMCP": true,
  "callsReload": true
}
```
**Validation**: Verifies config reload imports MCP and calls `MCP.reload()`

---

### Test Case 6: MCP State Management
**Impulse**: `validation-mcp-hot-reload-case-6`  
**Input**: `await MCP.state(); await MCP.reload(); await MCP.state()`  
**Expected Output**:
```json
{
  "state1Exists": true,
  "state1HasClients": true,
  "state1HasStatus": true,
  "state2Exists": true,
  "state2HasClients": true,
  "state2HasStatus": true
}
```
**Validation**: Verifies MCP state structure before and after reload

---

## Usage

### Running the Validation Harness

#### From Code:
```typescript
import { runValidation } from './tests/validation-harnesses/mcp-hot-reload-harness'

const result = await runValidation()

console.log(`Pass: ${result.pass}`)
console.log(`Passed: ${result.summary.passed}/${result.summary.total}`)
console.log(`Failed: ${result.summary.failed}`)

for (const testResult of result.results) {
  console.log(`${testResult.pass ? '✓' : '✗'} ${testResult.testCase}`)
}
```

#### From CLI:
```bash
cd repos/metabob-opencode/packages/opencode
ts-node tests/validation-harnesses/mcp-hot-reload-harness.ts
```

Expected output:
```
=== MCP Hot-Reload Validation Harness ===

Total Tests: 6
Passed: 6
Failed: 0

✓ PASS: MCP.reload() function exists
✓ PASS: MCP.reload() returns correct structure
✓ PASS: MCP.reload() idempotency
✓ PASS: CLI command exists
✓ PASS: Config reload integration
✓ PASS: MCP state management

Overall: ✓ PASS
```

---

## Integration Test

### Running the Integration Test

The integration test simulates the real-world end-to-end scenario:

```bash
cd repos/metabob-opencode/packages/opencode
ts-node tests/validation-harnesses/mcp-hot-reload-integration-test.ts
```

**Test Steps**:
1. Get initial MCP state
2. Call `MCP.reload()` for the first time
3. Verify state after first reload
4. Call `MCP.reload()` again (simulates vessel restart)
5. Verify state after second reload
6. Verify config reload integration

Expected output:
```
=== MCP Hot-Reload Integration Test ===

Scenario: MCP Hot-Reload End-to-End
Total Steps: 6
Passed: 6
Failed: 0

✓ Get initial MCP state
  Details: { hasClients: true, hasStatus: true, clientCount: 1 }
✓ First MCP.reload() call
  Details: { success: true, clientCount: 1, errorCount: 0 }
✓ Verify state after first reload
  Details: { hasClients: true, hasStatus: true, clientCount: 1 }
✓ Second MCP.reload() call (simulate vessel restart)
  Details: { success: true, clientCount: 1, errorCount: 0 }
✓ Verify state after second reload
  Details: { hasClients: true, hasStatus: true, clientCount: 1 }
✓ Verify config reload integration
  Details: { hasMCPReload: true }

Overall: ✓ PASS
```

---

## Manual Validation Steps

For complete validation, perform these manual steps:

### 1. Setup
```bash
# Start opencode with metabob-cli as MCP vessel
cd repos/metabob-cli
npm run vessel

# In another terminal, start opencode
cd repos/metabob-opencode
npm run dev
```

### 2. Test Initial Connection
```bash
# In opencode session
test_metabob_mcp
```

Expected: Connection successful, tools listed

### 3. Modify metabob-cli Code
```typescript
// Add logging to metabob-cli/src/tools/search_activities.ts
console.log("[RELOAD TEST] search_activities called")
```

### 4. Restart metabob-cli Vessel
```bash
# Stop and restart the vessel
cd repos/metabob-cli
npm run vessel
```

### 5. Reload MCP Clients in opencode
```bash
# In opencode session
opencode mcp reload
```

Expected output:
```
○  Reload MCP Clients

◆  Reloading MCP clients...
│
◇  MCP reload complete
│
◇  All MCP clients reloaded successfully
│
◆  Client Status:
│  ✓ metabob: Connected
│
◇  ✓ Reload successful
```

### 6. Verify New Behavior
```bash
# Call the tool and check for new logging
metabob_search_activities { "query": "", "limit": 5 }
```

Expected: New logging "[RELOAD TEST] search_activities called" appears in metabob-cli output

### 7. Verify No Session Disruption
- Check that the opencode session is still active
- Verify no errors in logs
- Confirm other tools still work

---

## Validation Criteria

### Must Pass
- ✅ All 6 unit tests pass
- ✅ All 6 integration test steps pass
- ✅ Manual test shows new behavior after reload
- ✅ No session disruption during reload
- ✅ Logs show connection close/reopen messages

### Optional (Future Enhancements)
- ⚠️ Safety checks prevent reload during active operations
- ⚠️ Automatic reload on vessel restart detection
- ⚠️ Generic MCP health check for all clients (not just Metabob)

---

## Troubleshooting

### Test Failure: "MCP.reload() function does not exist"
**Cause**: Implementation not applied  
**Fix**: Ensure `MCP.reload()` function was added to `src/mcp/index.ts` (lines 217-307)

### Test Failure: "McpReloadCommand not found"
**Cause**: CLI command not registered  
**Fix**: Ensure `McpReloadCommand` added to `src/cli/cmd/mcp.ts` and registered in builder

### Test Failure: "Config reload does not call MCP.reload()"
**Cause**: Integration not complete  
**Fix**: Ensure `MCP.reload()` call added to `src/config/reload.ts` after `Instance.dispose()`

### Manual Test: New behavior not seen after reload
**Cause**: Vessel not restarted or client not reconnected  
**Possible Fixes**:
1. Verify vessel restarted: Check vessel terminal for restart logs
2. Check reload logs: Look for "reloaded mcp client" messages
3. Verify config: Ensure MCP vessel configured correctly in opencode.json
4. Check connection: Run `test_metabob_mcp` to verify connection status

---

## Files Created

1. **Harness File**: `repos/metabob-opencode/packages/opencode/tests/validation-harnesses/mcp-hot-reload-harness.ts` (340 lines)
2. **Integration Test**: `repos/metabob-opencode/packages/opencode/tests/validation-harnesses/mcp-hot-reload-integration-test.ts` (180 lines)
3. **Test Case Impulses**:
   - `impulses/validation-mcp-hot-reload-case-1.json`
   - `impulses/validation-mcp-hot-reload-case-2.json`
   - `impulses/validation-mcp-hot-reload-case-3.json`
   - `impulses/validation-mcp-hot-reload-case-4.json`
   - `impulses/validation-mcp-hot-reload-case-5.json`
   - `impulses/validation-mcp-hot-reload-case-6.json`
4. **Harness Impulse**: `impulses/harness-mcp-hot-reload.json`

---

## Summary

**Total Test Cases**: 6  
**Total Integration Steps**: 6  
**Manual Validation Steps**: 7  
**Automated**: ✅ Yes (no LLM needed)  
**Historical**: ✅ Yes (test cases stored as impulses)  
**Status**: Ready for execution  

---

**Validation Status**: ✅ HARNESS COMPLETE  
**Ready for**: Automated and Manual Testing  

