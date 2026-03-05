# Validation Harness: Clean Environment Activity Execution End-to-End

**Specification**: Clean Environment Activity Execution End-to-End  
**Harness File**: `tests/validation-harnesses/clean-environment-activity-execution-end-to-end-harness.ts`  
**Harness Impulse ID**: `harness-Clean Environment Activity Execution End-to-End`  
**Created**: 2026-03-04  
**Runtime**: < 10 seconds (static analysis + mocks, no LLM)

---

## Overview

This validation harness verifies that a fresh opencode + metabob-cli installation in a clean environment can discover, retrieve, execute, and report learning data for any activity template stored in the metabob-rpc-api database **without direct file system access** to `.metabob/activities`.

### Architecture Validated

- **Activity Agent**: Template selection and variable inference from impulses (managed by Memory agent)
- **Memory Agent**: Impulse management (NO impulse_* tools visible to Activity agent)
- **Template Discovery**: MCP backend (metabob-cli → rpc-api → SurrealDB)
- **Learning Data**: Flows back to database for recommendations

---

## Test Cases (8 Total)

### Test Case 1: Activity Agent Config Excludes Impulse Tools ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-1`

**Input**:
```json
{
  "agentConfigPath": "repos/metabob-opencode/packages/opencode/src/agent/agent.ts",
  "agentName": "activity"
}
```

**Expected Output**:
```json
{
  "hasSearchActivities": true,
  "hasGetActivityTemplate": true,
  "hasActivity": true,
  "noImpulseCreate": true,
  "noImpulseLoad": true,
  "noImpulseUnload": true,
  "noReadAccessToMetabobActivities": true
}
```

**What It Validates**:
- Activity agent has `search_activities`, `get_activity_template`, and `activity` tools
- Activity agent does NOT have `impulse_create`, `impulse_load`, or `impulse_unload` tools
- Activity agent does NOT have read access to `.metabob/activities` directory
- Enforces separation of concerns: Activity agent focuses on template selection, not impulse management

---

### Test Case 2: Memory Agent Config Has Activity Tools ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-2`

**Input**:
```json
{
  "agentConfigPath": "repos/metabob-opencode/packages/opencode/src/agent/agent.ts",
  "agentName": "memory"
}
```

**Expected Output**:
```json
{
  "hasActivity": true,
  "hasSearchActivities": true,
  "hasGetActivityTemplate": true,
  "hasImpulseCreate": true,
  "hasImpulseLoad": true,
  "hasImpulseUnload": true
}
```

**What It Validates**:
- Memory agent has BOTH activity tools AND impulse management tools
- Memory agent can manage impulse lifecycle (create, load, unload)
- Memory agent can discover and execute activities (search_activities, activity)
- Confirms that Memory agent is the coordination layer between impulses and activities

---

### Test Case 3: TemplateLoader Retrieves from MCP Not Filesystem ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-3`

**Input**:
```json
{
  "templateLoaderPath": "repos/metabob-opencode/packages/opencode/src/session/template-loader.ts"
}
```

**Expected Output**:
```json
{
  "usesTemplateServiceClient": true,
  "returnsSourceMetabob": true,
  "hasBootstrapFallback": true,
  "noDirectFileReads": true,
  "hasStrictBackendMode": true
}
```

**What It Validates**:
- TemplateLoader uses `TemplateServiceClient` for MCP communication
- Returns `source='metabob'` for templates loaded from backend
- Has bootstrap fallback for cold-start scenarios
- NO direct file reads from `.metabob/activities` directory
- Enforces `strictBackend` mode to fail fast if MCP unavailable

---

### Test Case 4: TemplateServiceClient Calls MCP Methods Not Local Files ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-4`

**Input**:
```json
{
  "clientPath": "repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts"
}
```

**Expected Output**:
```json
{
  "callsMetabobCLISearchActivities": true,
  "callsMetabobCLIGetActivity": true,
  "callsMetabobCLIRegisterTemplate": true,
  "noDirectFileReads": true,
  "noDirectFileWrites": true
}
```

**What It Validates**:
- TemplateServiceClient delegates to `MetabobCLI.searchActivities()`
- TemplateServiceClient delegates to `MetabobCLI.getActivity()`
- TemplateServiceClient delegates to `MetabobCLI.registerActivityTemplate()`
- NO direct file reads or writes
- Pure MCP delegation layer

---

### Test Case 5: MetabobCLI Lines 803-813 Remain Commented (No Local Writes) ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-5`

**Input**:
```json
{
  "metabobCLIPath": "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
  "lineRange": "803-813"
}
```

**Expected Output**:
```json
{
  "hasArchitecturalConstraintComment": true,
  "localWritesCommented": true,
  "callsMCPRegisterTool": true,
  "noActiveFileWrites": true
}
```

**What It Validates**:
- Lines 803-813 have architectural constraint comment
- Local file writes are commented out
- Calls MCP tool `metabob_register_activity_template`
- NO active file writes to `.metabob/activities` anywhere in file
- Critical enforcement point: Templates saved ONLY to backend via MCP

---

### Test Case 6: Integration Flow - Search → Retrieve → Execute → Learning Data POST ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-6`

**Input**:
```json
{
  "activityPath": "repos/metabob-opencode/packages/opencode/src/session/activity.ts"
}
```

**Expected Output**:
```json
{
  "activityCompleteReportsMetrics": true,
  "activityFailReportsMetrics": true,
  "callsTemplateMetricsClient": true,
  "includesImpulseUsage": true,
  "includesComponentChanges": true,
  "verifiesMetricsWritten": true
}
```

**What It Validates**:
- `Activity.complete()` reports execution metrics
- `Activity.fail()` reports failure metrics
- Calls `TemplateMetricsClient.reportExecution()`
- Includes impulse usage data in metrics
- Includes component changes in metrics
- Verifies metrics were written (closes Instructional vs Functional gap)
- Full learning loop: execution data flows back to database

---

### Test Case 7: RPC-API /activities Routes Handle Template CRUD + Metrics ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-7`

**Input**:
```json
{
  "rpcApiPath": "repos/metabob-rpc-api"
}
```

**Expected Output**:
```json
{
  "routeFilesFound": true,
  "hasSearchEndpoint": true,
  "hasGetEndpoint": true,
  "hasCreateEndpoint": true,
  "hasMetricsEndpoint": true
}
```

**What It Validates**:
- RPC-API has `/activities` route files
- Has GET endpoint for searching/listing templates
- Has GET endpoint for retrieving specific templates
- Has POST endpoint for creating/registering templates
- Has POST endpoint for metrics/execution data
- Backend supports full CRUD + learning data flow

---

### Test Case 8: Bootstrap Scenario - Empty .metabob/ Can Discover Templates ✅

**Impulse ID**: `validation-Clean Environment Activity Execution End-to-End-case-8`

**Input**:
```json
{
  "bootstrapPath": "repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts",
  "loaderPath": "repos/metabob-opencode/packages/opencode/src/session/template-loader.ts"
}
```

**Expected Output**:
```json
{
  "bootstrapFileExists": true,
  "hasBootstrapTemplates": true,
  "hasBootstrapFallbackInLoader": true,
  "bootstrapExceptionDocumented": true
}
```

**What It Validates**:
- Bootstrap templates file exists
- Contains embedded bootstrap templates
- TemplateLoader has bootstrap fallback mechanism
- Bootstrap exception is documented (cold-start capability)
- Clean environment can bootstrap from embedded templates when MCP unavailable

---

## Usage

### Run Validation Harness

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun tests/validation-harnesses/clean-environment-activity-execution-end-to-end-harness.ts
```

### Expected Output

```
🔍 Running Validation Harness: Clean Environment Activity Execution End-to-End

Running: Test Case 1...
✅ PASS

Running: Test Case 2...
✅ PASS

...

═══════════════════════════════════════════════════════════
✅ All 8 validation tests passed
   Passed: 8/8
   Failed: 0/8
═══════════════════════════════════════════════════════════
```

### Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

---

## Integration with CI/CD

Add to CI/CD pipeline to prevent regressions:

```yaml
# .github/workflows/validation.yml
- name: Run Clean Environment Validation
  run: |
    bun tests/validation-harnesses/clean-environment-activity-execution-end-to-end-harness.ts
  timeout-minutes: 1
```

---

## Maintenance

### When to Update This Harness

1. **Agent configuration changes**: Update test cases 1 and 2
2. **Template loading architecture changes**: Update test cases 3, 4, 5
3. **Metrics reporting changes**: Update test case 6
4. **RPC-API endpoint changes**: Update test case 7
5. **Bootstrap mechanism changes**: Update test case 8

### Adding New Test Cases

1. Create impulse file: `impulses/validation-Clean-Environment-Activity-Execution-End-to-End-case-N.json`
2. Add test function to harness: `testCaseN_YourTestName()`
3. Add to test array in `runValidation()`
4. Update this documentation

---

## Impulse Files

All test case impulses and harness impulse are stored in `impulses/`:

- `harness-Clean-Environment-Activity-Execution-End-to-End.json` - Harness metadata
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-1.json` - Test case 1
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-2.json` - Test case 2
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-3.json` - Test case 3
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-4.json` - Test case 4
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-5.json` - Test case 5
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-6.json` - Test case 6
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-7.json` - Test case 7
- `validation-Clean-Environment-Activity-Execution-End-to-End-case-8.json` - Test case 8

---

## Related Documentation

- `TRACE_CLEAN_ENVIRONMENT_ACTIVITY_EXECUTION.md` - Trace analysis
- `ENFORCEMENT_CLEAN_ENVIRONMENT_ACTIVITY_EXECUTION.md` - Enforcement summary
- `ARCHITECTURE.md` - Overall architecture documentation
- `repos/metabob-opencode/docs/ACTIVITY_CLIENT_INTERACTION_GUIDE.md` - Activity MCP flow

---

## Summary

This validation harness provides **automated, fast (< 10 sec), non-LLM validation** that the Clean Environment Activity Execution End-to-End specification is properly implemented and enforced. All tests use static analysis or mocked components to ensure:

1. ✅ Activity agent excludes impulse_* tools
2. ✅ Memory agent has both activity and impulse tools
3. ✅ TemplateLoader uses MCP backend
4. ✅ TemplateServiceClient delegates to MetabobCLI
5. ✅ MetabobCLI has no local file writes
6. ✅ Integration flow complete with metrics verification
7. ✅ RPC-API has complete /activities routes
8. ✅ Bootstrap scenario supported for cold-start

**Status**: ✅ Ready for CI/CD integration and regression testing
