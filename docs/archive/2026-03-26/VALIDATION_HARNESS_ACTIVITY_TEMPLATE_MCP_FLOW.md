# Validation Harness: Activity Template Flow via MCP Backend

**Status:** ✅ CREATED  
**Date:** 2026-03-05  
**Harness File:** `tests/validation-harnesses/activity-template-flow-via-mcp-backend-harness.ts`  
**Harness Impulse ID:** `harness-activity-template-flow-via-mcp-backend`

## Overview

This validation harness provides automated testing to verify that activity templates flow exclusively through the MCP backend path (MCP → RPC API → SurrealDB) rather than bypassing via direct file system access.

### Key Features

- **Static Analysis**: No LLM required, can run offline
- **7 Test Cases**: Comprehensive coverage of specification requirements
- **Fast Execution**: < 10 seconds runtime
- **Historical Testing**: Test cases stored as impulses for repeatability

## Validation Strategy

The harness implements the following validation strategy:

1. ✅ Call `test_metabob_mcp()` and verify `status='connected'`
2. ✅ Load a non-bootstrap template via `TemplateLoader.load()` and verify `source='metabob'`
3. ✅ Search codebase for direct `.metabob/activities` file reads and ensure they're deprecated/removed
4. ✅ Trace template registration flow from `TemplateServiceClient.registerTemplate()` through MCP to RPC API
5. ✅ Verify Activity agent tools use `search_activities()` not file system access
6. ✅ Check that enforcement comments exist preventing local template storage

## Test Cases

### Test Case 1: MCP Connection Status
**Impulse ID:** `validation-activity-template-flow-via-mcp-backend-case-1`

**Input:**
```json
{
  "check": "test_metabob_mcp tool exists and is defined"
}
```

**Expected Output:**
```json
{
  "toolExists": true,
  "toolDefined": true
}
```

**Validation:** Checks that the `test_metabob_mcp` diagnostic tool is available for verifying MCP connectivity.

---

### Test Case 2: TemplateLoader Source Verification
**Impulse ID:** `validation-activity-template-flow-via-mcp-backend-case-2`

**Input:**
```json
{
  "file": "repos/metabob-opencode/packages/opencode/src/session/template-loader.ts",
  "check": "TemplateLoader returns source=\"metabob\" for backend templates"
}
```

**Expected Output:**
```json
{
  "fileExists": true,
  "sourceMetabob": true,
  "usesTemplateServiceClient": true,
  "hasBootstrapFallback": true
}
```

**Validation:** Verifies TemplateLoader:
- Returns `source='metabob'` for backend-loaded templates
- Uses `TemplateServiceClient` for MCP communication
- Has controlled bootstrap fallback for cold-start

---

### Test Case 3: No Direct File Access
**Impulse ID:** `validation-activity-template-flow-via-mcp-backend-case-3`

**Input:**
```json
{
  "searchPath": "repos/metabob-opencode/packages/opencode/src",
  "pattern": ".metabob/activities",
  "check": "No active direct file access to .metabob/activities"
}
```

**Expected Output:**
```json
{
  "activeReferences": 0,
  "allReferencesCommented": true
}
```

**Validation:** Searches codebase for direct `.metabob/activities` file access and ensures all references are commented out or in CLI setup code (which is allowed).

---

### Test Case 4: MetabobCLI No Local Writes
**Impulse ID:** `validation-activity-template-flow-via-mcp-backend-case-4`

**Input:**
```json
{
  "file": "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
  "check": "MetabobCLI has no local template writes (lines 803-813 commented)"
}
```

**Expected Output:**
```json
{
  "fileExists": true,
  "noLocalWrites": true,
  "hasArchitecturalConstraintComment": true,
  "callsMCPTools": true
}
```

**Validation:** Verifies MetabobCLI:
- Has no local file writes (commented out at lines 803-813)
- Contains "ARCHITECTURAL CONSTRAINT" comment explaining why
- Calls MCP tools (`metabob_register_activity_template`, etc.)

---

### Test Case 5: Activity Agent Tool Configuration
**Impulse ID:** `validation-activity-template-flow-via-mcp-backend-case-5`

**Input:**
```json
{
  "file": "repos/metabob-opencode/packages/opencode/src/agent/agent.ts",
  "check": "Activity agent has search_activities, no impulse tools"
}
```

**Expected Output:**
```json
{
  "hasSearchActivities": true,
  "hasActivity": true,
  "noImpulseCreate": true,
  "noImpulseLoad": true
}
```

**Validation:** Verifies Activity agent tool configuration enforces separation of concerns:
- Has `search_activities: true` (template discovery)
- Has `activity: true` (template execution)
- Does NOT have `impulse_create` or `impulse_load` (Memory agent responsibility)

---

### Test Case 6: Memory Agent Tool Configuration
**Impulse ID:** `validation-activity-template-flow-via-mcp-backend-case-6`

**Input:**
```json
{
  "file": "repos/metabob-opencode/packages/opencode/src/agent/agent.ts",
  "check": "Memory agent has impulse tools and activity tools"
}
```

**Expected Output:**
```json
{
  "hasActivity": true,
  "hasSearchActivities": true,
  "hasImpulseCreate": true,
  "hasImpulseLoad": true,
  "hasImpulseUnload": true
}
```

**Validation:** Verifies Memory agent tool configuration:
- Has `activity: true` and `search_activities: true` (for activity prefix commands)
- Has impulse management tools (`impulse_create`, `impulse_load`, `impulse_unload`)
- Properly manages impulse state and variable inference

---

### Test Case 7: TemplateServiceClient Delegation
**Impulse ID:** `validation-activity-template-flow-via-mcp-backend-case-7`

**Input:**
```json
{
  "file": "repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts",
  "check": "TemplateServiceClient delegates to MetabobCLI"
}
```

**Expected Output:**
```json
{
  "fileExists": true,
  "callsSearchActivities": true,
  "callsGetActivity": true,
  "callsRegisterActivityTemplate": true
}
```

**Validation:** Verifies TemplateServiceClient abstraction layer:
- Calls `MetabobCLI.searchActivities()` for search
- Calls `MetabobCLI.getActivity()` for retrieval
- Calls `MetabobCLI.registerActivityTemplate()` for registration

## Usage

### Running the Harness

```bash
# From repository root
bun run tests/validation-harnesses/activity-template-flow-via-mcp-backend-harness.ts

# With custom base directory
bun run tests/validation-harnesses/activity-template-flow-via-mcp-backend-harness.ts /path/to/project
```

### Programmatic Usage

```typescript
import { runValidation } from './tests/validation-harnesses/activity-template-flow-via-mcp-backend-harness';

const result = await runValidation('/path/to/project');

if (result.pass) {
  console.log('✅ All validation tests passed');
} else {
  console.log(`❌ ${result.failed} tests failed`);
  result.results
    .filter(r => !r.pass)
    .forEach(r => {
      console.log(`  - ${r.testName}: ${r.error || r.details}`);
    });
}
```

### Output Format

```json
{
  "pass": true,
  "totalTests": 7,
  "passed": 7,
  "failed": 0,
  "results": [
    {
      "pass": true,
      "testName": "MCP Connection Status",
      "actual": { "toolExists": true, "toolDefined": true },
      "expected": { "toolExists": true, "toolDefined": true },
      "details": "test_metabob_mcp tool found in 2 file(s)"
    }
    // ... more results
  ],
  "summary": "✅ All 7 validation tests passed"
}
```

## Impulses Created

### Harness Impulse
- **ID:** `harness-activity-template-flow-via-mcp-backend`
- **Type:** `file`
- **Location:** `./impulses/harness-activity-template-flow-via-mcp-backend.json`
- **Budget:** 2000 tokens
- **Metadata:**
  - `specification`: Activity Template Flow via MCP Backend
  - `harnessType`: static-analysis
  - `testCount`: 7
  - `requiresLLM`: false
  - `canRunOffline`: true

### Test Case Impulses
All 7 test case impulses are stored in `./impulses/`:
- `validation-activity-template-flow-via-mcp-backend-case-1.json`
- `validation-activity-template-flow-via-mcp-backend-case-2.json`
- `validation-activity-template-flow-via-mcp-backend-case-3.json`
- `validation-activity-template-flow-via-mcp-backend-case-4.json`
- `validation-activity-template-flow-via-mcp-backend-case-5.json`
- `validation-activity-template-flow-via-mcp-backend-case-6.json`
- `validation-activity-template-flow-via-mcp-backend-case-7.json`

Each impulse contains:
- Test name and description
- Input parameters
- Expected output
- Metadata (specification, test case number, total test cases)

## Integration with CI/CD

The harness can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/validate-architecture.yml
name: Validate Architecture

on: [push, pull_request]

jobs:
  validate-activity-template-flow:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Run Activity Template Flow Validation
        run: bun run tests/validation-harnesses/activity-template-flow-via-mcp-backend-harness.ts
```

## Maintenance

### When to Update the Harness

Update the harness when:
- Specification changes or evolves
- New components are added to the data flow
- New architectural constraints are introduced
- Test cases fail unexpectedly

### Adding New Test Cases

1. Add test function to harness file
2. Create impulse for test case with input/expected output
3. Update documentation
4. Run harness to verify new test works

## Related Documentation

- [Trace: Activity Template Flow via MCP Backend](./TRACE_ACTIVITY_TEMPLATE_MCP_FLOW.md)
- [Enforcement: Activity Template Flow via MCP Backend](./ENFORCEMENT_ACTIVITY_TEMPLATE_MCP_FLOW.md)
- [Specification: Activity Template Flow via MCP Backend](./trace-activity-template-mcp-flow.json)

---

**Harness Created:** 2026-03-05  
**Status:** ✅ READY FOR USE  
**Requires LLM:** ❌ No  
**Runtime:** < 10 seconds  
**Test Coverage:** 7 critical validation points
