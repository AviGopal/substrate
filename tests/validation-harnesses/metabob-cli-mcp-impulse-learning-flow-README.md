# Validation Harness: Metabob CLI MCP Impulse Learning Flow

## Overview

This validation harness verifies that all impulse learning and activity execution data flows through the CLI MCP layer, enforcing the architectural boundary:

```
opencode → CLI MCP → rpc-api → SurrealDB
```

**Key Requirement**: All communication must flow through MCP tools. No direct HTTP calls to rpc-api from opencode.

## Specification

**Specification ID**: `metabob-cli-mcp-impulse-learning-flow`

**Expected Behavior**:
1. `recordTurnLearning()` must use `callMCPTool('record_turn_learning')` - NO direct HTTP
2. `startActivityExecution()` must use `callMCPTool('activity/start')`
3. `reportExecutionStep()` must use `callMCPTool('report_execution_step')`
4. CLI MCP `tools.py` must implement all three MCP tools
5. No direct `fetch()` calls to rpc-api in opencode learning code
6. FAISS template results must convert to impulses

## Validation Cases

### Case 1: recordTurnLearning uses MCP
- **File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- **Check**: Function contains `callMCPTool` and NOT `fetch(url`
- **Expected**: `hasMCPCall=true, hasDirectFetch=false`

### Case 2: No direct HTTP in learning code
- **Files**: `impulse-learning.ts`, `metabob.ts`
- **Check**: No matches for `fetch.*learning-loop`, `fetch.*record-turn`, `fetch.*api/v1/learning`
- **Expected**: 0 matches

### Case 3: record_turn_learning MCP tool exists
- **File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
- **Check**: Has `@mcp.tool` decorator and `async def record_turn_learning(`
- **Expected**: Both present

### Case 4: startActivityExecution uses MCP
- **File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- **Check**: Function contains `callMCPTool` and `'activity/start'`
- **Expected**: Both present

### Case 5: reportExecutionStep uses MCP
- **File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- **Check**: Function contains `callMCPTool` and `'report_execution_step'`
- **Expected**: Both present

### Case 6: CLI MCP forwards to rpc-api
- **File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
- **Check**: `record_turn_learning` function contains `/api/v1/learning-loop/record-turn`
- **Expected**: Endpoint present

## Usage

### Command Line

```bash
# From project root
npx ts-node tests/validation-harnesses/metabob-cli-mcp-impulse-learning-flow-harness.ts

# Or with direct execution (after chmod +x)
./tests/validation-harnesses/metabob-cli-mcp-impulse-learning-flow-harness.ts
```

### Programmatic

```typescript
import { runValidation } from './tests/validation-harnesses/metabob-cli-mcp-impulse-learning-flow-harness'

const result = await runValidation()

if (result.overallPass) {
  console.log("✓ All validations passed")
} else {
  console.error(`✗ ${result.summary.failed} validations failed`)
  process.exit(1)
}
```

### Exit Codes

- `0`: All validations passed
- `1`: One or more validations failed

## Integration with Trace-Enforce-Validate Loop

This harness completes the cycle:

1. **Trace**: `trace-metabob-cli-mcp-impulse-learning-flow` identified architectural violation
2. **Enforce**: `enforcement-metabob-cli-mcp-impulse-learning-flow` fixed the code
3. **Validate**: This harness verifies the fix is correct

### Related Impulses

- **Trace Impulse**: `trace-metabob-cli-mcp-impulse-learning-flow`
- **Enforcement Impulse**: `enforcement-metabob-cli-mcp-impulse-learning-flow`
- **Harness Impulse**: `harness-metabob-cli-mcp-impulse-learning-flow`
- **Test Cases**: `validation-metabob-cli-mcp-impulse-learning-flow-case-N` (N=1-6)

## Output Format

```
================================================================================
Validation Harness: Metabob CLI MCP Impulse Learning Flow
================================================================================

Running: Case 1: recordTurnLearning uses MCP
  ✓ PASS: recordTurnLearning uses callMCPTool (COMPLIANT)

Running: Case 2: No direct HTTP in learning code
  ✓ PASS: No direct HTTP calls to rpc-api learning endpoints (COMPLIANT)

Running: Case 3: record_turn_learning MCP tool exists
  ✓ PASS: record_turn_learning MCP tool exists in CLI (COMPLIANT)

Running: Case 4: startActivityExecution uses MCP
  ✓ PASS: startActivityExecution uses callMCPTool('activity/start') (COMPLIANT)

Running: Case 5: reportExecutionStep uses MCP
  ✓ PASS: reportExecutionStep uses callMCPTool('report_execution_step') (COMPLIANT)

Running: Case 6: CLI MCP forwards to rpc-api
  ✓ PASS: CLI MCP tool forwards to /api/v1/learning-loop/record-turn (COMPLIANT)

================================================================================
Summary
================================================================================
Total:  6
Passed: 6
Failed: 0

Overall: ✓ PASS
================================================================================
```

## Technical Details

- **Type**: Static code analysis
- **LLM Required**: No
- **Execution Time**: ~1-2 seconds
- **Dependencies**: Node.js, TypeScript, fs module
- **Side Effects**: None (read-only analysis)

## Maintenance

When updating the specification:

1. Update test case expectations in the harness
2. Update corresponding impulse documents
3. Run harness to verify changes
4. Document any new validation requirements

## Related Files

- **Harness**: `tests/validation-harnesses/metabob-cli-mcp-impulse-learning-flow-harness.ts`
- **Test Cases**: `/tmp/validation-test-cases-metabob-cli-mcp-impulse-learning-flow.json`
- **Trace Analysis**: `/tmp/trace-metabob-cli-mcp-impulse-learning-flow.json`
- **Enforcement Summary**: `/tmp/enforcement-metabob-cli-mcp-impulse-learning-flow.json`
