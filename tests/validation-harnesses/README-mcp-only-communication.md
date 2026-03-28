# Validation Harness: MCP-Only Communication

**Specification**: metabob-opencode must ONLY communicate via metabob-cli MCP server, never direct HTTP to backend

**Status**: ✅ VALIDATED (5/5 tests passed)

**Harness File**: `mcp-only-communication-harness.ts`

---

## Overview

This validation harness performs static code analysis to verify that the MCP-Only Communication architectural principle is enforced in the metabob-opencode codebase. It checks that all backend communication routes through the MCP layer instead of making direct HTTP calls.

## Test Cases

### Case 1: No Direct HTTP to Backend

**ID**: `validation-mcp-only-communication-case-1`

**Description**: Verify no direct `fetch()` calls to `METABOB_RPC_API_URL` except in Thompson Sampling client

**Test**:
- Search for `METABOB_RPC_API_URL` in codebase
- Filter out acceptable exception (`util/rpc-http-client.ts`)
- Expect 0 violations

**Result**: ✅ PASS
- Found 4 total matches
- 0 violations (4 acceptable in rpc-http-client.ts)

---

### Case 2: No Wrong Tool Name

**ID**: `validation-mcp-only-communication-case-2`

**Description**: Verify no code uses wrong tool name `metabob_post_activity_result` (correct: `post_activity_result`)

**Test**:
- Search for `metabob_post_activity_result` in codebase
- Filter out comments (documentation OK)
- Expect 0 code violations

**Result**: ✅ PASS
- Found 1 total match
- 0 code violations (1 in comments documenting historical issue)

---

### Case 3: TemplateMetricsClient Uses MCP Tool

**ID**: `validation-mcp-only-communication-case-3`

**Description**: Verify `TemplateMetricsClient.reportExecution()` uses correct MCP tool `post_activity_result`

**Test**:
- Check `session/template-metrics-client.ts` for `post_activity_result`
- Expect matches found (tool is used)

**Result**: ✅ PASS
- Found 5 matches of required pattern

---

### Case 4: BoredomManager Uses Abstraction

**ID**: `validation-mcp-only-communication-case-4`

**Description**: Verify `BoredomManager` uses `TemplateMetricsClient.reportExecution()` abstraction

**Test**:
- Check `session/boredom-manager.ts` for `TemplateMetricsClient.reportExecution`
- Expect matches found (abstraction is used)

**Result**: ✅ PASS
- Found 1 match of required pattern

---

### Case 5: Acceptable Exception

**ID**: `validation-mcp-only-communication-case-5`

**Description**: Verify acceptable exception for Thompson Sampling exists

**Test**:
- Check `util/rpc-http-client.ts` for `METABOB_RPC_API_URL`
- Expect matches found (exception documented)

**Result**: ✅ PASS
- Confirmed exception file exists with 4 matches

---

## Running the Harness

### Manual Execution

```bash
cd tests/validation-harnesses
bun run mcp-only-communication-harness.ts
```

### Expected Output

```
🔍 Running MCP-Only Communication Validation Harness...

Testing: validation-mcp-only-communication-case-1
  Type: no-direct-http
  ✅ PASS - Found 4 total matches, 0 violations (4 acceptable)

Testing: validation-mcp-only-communication-case-2
  Type: no-wrong-tool-name
  ✅ PASS - Found 1 total matches, 0 code violations (1 in comments)

Testing: validation-mcp-only-communication-case-3
  Type: uses-mcp-abstraction
  File: session/template-metrics-client.ts
  ✅ PASS - Found 5 matches of required pattern

Testing: validation-mcp-only-communication-case-4
  Type: uses-mcp-abstraction
  File: session/boredom-manager.ts
  ✅ PASS - Found 1 matches of required pattern

Testing: validation-mcp-only-communication-case-5
  Type: acceptable-exception
  File: util/rpc-http-client.ts
  ✅ PASS - Confirmed exception file exists with 4 matches

============================================================
Summary: 5/5 tests passed
✅ MCP-Only Communication specification VALIDATED
============================================================
```

### Exit Codes

- `0` - All tests passed (specification validated)
- `1` - One or more tests failed (specification violated)

---

## Architecture Verified

### Data Flow

**Correct (VALIDATED)**:
```
opencode → MCP → metabob-cli → metabob-rpc-api
```

**Incorrect (PREVENTED)**:
```
opencode → direct HTTP → metabob-rpc-api  ❌
```

### Key Components

1. **TemplateMetricsClient.reportExecution()**
   - ✅ Uses `callMCPTool('post_activity_result', ...)`
   - ✅ No direct HTTP calls
   - ✅ Correct tool name

2. **BoredomManager**
   - ✅ Uses `TemplateMetricsClient.reportExecution()` abstraction
   - ✅ No direct MCP client access
   - ✅ No wrong tool name

3. **Acceptable Exception**
   - ✅ `rpc-http-client.ts` for Thompson Sampling
   - ✅ Documented use case
   - ✅ Different architectural layer (ML real-time decision)

---

## Impulse References

### Test Case Impulses

- `validation-mcp-only-communication-case-1` - No direct HTTP
- `validation-mcp-only-communication-case-2` - No wrong tool name
- `validation-mcp-only-communication-case-3` - TemplateMetricsClient uses MCP
- `validation-mcp-only-communication-case-4` - BoredomManager uses abstraction
- `validation-mcp-only-communication-case-5` - Acceptable exception

### Harness Impulse

- `harness-mcp-only-communication` - Points to this harness file

---

## Validation Strategy

### Static Analysis Checks

1. **Pattern Matching**: Use `grep` to search for architectural violations
2. **Exception Filtering**: Filter out acceptable files/patterns
3. **Comment Filtering**: Distinguish code violations from documentation
4. **Positive Verification**: Verify required patterns exist

### No Runtime Execution Required

All validation is performed through static code analysis:
- No application startup needed
- No dependencies required
- Fast execution (~1 second)
- Deterministic results

### Historical Test Cases

Test cases are stored as JSON impulses and can be run repeatedly without LLM:
- `test-cases/mcp-only-communication-case-1.json`
- `test-cases/mcp-only-communication-case-2.json`
- `test-cases/mcp-only-communication-case-3.json`
- `test-cases/mcp-only-communication-case-4.json`
- `test-cases/mcp-only-communication-case-5.json`

---

## Related Documentation

- **Trace**: `TRACE_MCP_ONLY_COMMUNICATION.md` - Analysis of current vs desired state
- **Enforcement**: `ENFORCEMENT_MCP_ONLY_COMMUNICATION.md` - Changes applied to enforce spec
- **Validation**: This document - Verification that spec is enforced

---

## Maintenance

### When to Re-run

Run this harness after any changes to:
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`
- `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`
- Any file that makes backend API calls

### Updating Test Cases

If architectural requirements change:
1. Update test case JSON files in `test-cases/`
2. Update `TEST_CASES` array in harness file
3. Update expected outputs
4. Re-run validation

### Adding New Checks

To add a new validation check:
1. Add test case to `TEST_CASES` array
2. Add JSON file to `test-cases/` directory
3. Implement check logic in `validateCase()` function
4. Update this README

---

## Integration

### CI/CD Pipeline

Add to pre-commit or pre-push hooks:

```bash
#!/bin/bash
cd tests/validation-harnesses
bun run mcp-only-communication-harness.ts || {
  echo "❌ MCP-Only Communication specification violated!"
  exit 1
}
```

### Regression Testing

Include in test suite:

```json
{
  "scripts": {
    "test:architecture": "bun run tests/validation-harnesses/mcp-only-communication-harness.ts",
    "test:all": "npm run test:architecture && npm run test:unit && npm run test:integration"
  }
}
```

---

## Troubleshooting

### Test Failures

**Case 1 fails (direct HTTP found)**:
- Check for new `fetch()` calls to backend
- Verify `METABOB_RPC_API_URL` only in `rpc-http-client.ts`
- Use `callMCPTool()` instead of direct HTTP

**Case 2 fails (wrong tool name in code)**:
- Check for `metabob_post_activity_result` in code (not comments)
- Correct tool name is `post_activity_result` (no `metabob_` prefix)
- Update to use correct tool name

**Case 3 fails (no MCP tool in template-metrics-client)**:
- Verify `callMCPTool('post_activity_result')` exists in file
- Check if file was renamed or moved
- Ensure `post_activity_result` string is present

**Case 4 fails (no abstraction in boredom-manager)**:
- Verify `TemplateMetricsClient.reportExecution()` call exists
- Check if boredom-manager was refactored
- Ensure abstraction layer is used

**Case 5 fails (exception missing)**:
- Verify `rpc-http-client.ts` still exists
- Check if Thompson Sampling was removed/refactored
- Update acceptable exceptions if architecture changed

---

## Summary

**Status**: ✅ VALIDATED

**Specification**: MCP-Only Communication is enforced

**Test Results**: 5/5 tests passed

**Architectural Boundary**: Clean separation maintained (opencode → MCP → cli → backend)

**Maintenance**: Re-run after changes to backend communication code
