# MCP Activity and Impulse System Tool Call Enforcement - Validation Harness

**Harness**: `mcp-activity-impulse-tool-call-enforcement-harness.ts`  
**Specification**: MCP Activity and Impulse System Tool Call Enforcement  
**Created**: 2026-03-03

## Purpose

Validates that MCP tools for activities, impulses, and learning systems are properly invoked during normal devbob operations. Tests the enforcement changes that prevent silent degradation when MCP backend is unavailable.

## Enforcement Changes Validated

1. **Activity Execution Backend Reporting** - `log.debug` → `log.warn` for visibility
2. **Impulse Backend Sync Failures** - `log.warn` → `log.error` for actionability
3. **Strict Backend Enforcement** - `strictBackend` option prevents silent fallback
4. **MCP Health Check** - New `healthCheck()` function for observability

## Test Cases

### 1. MCP Client Connectivity
**Purpose**: Verify metabob MCP client can connect to metabob-cli server  
**Expected**: Health check returns "healthy" or "degraded" with client status  
**Validates**: MCP.healthCheck() function works correctly

### 2. MCP Tools Registration
**Purpose**: Verify metabob MCP tools are registered and available to LLM  
**Expected**: At least 4 metabob tools registered (search_activities, get_activity_template, register_activity_template, impulse_store)  
**Validates**: MCP tools integration layer

### 3. Activity Execution Backend Reporting
**Purpose**: Verify activity execution reports to backend via MCP  
**Expected**: Backend reporting failures logged at WARN level (not DEBUG)  
**Validates**: Enforcement change in activity.ts:877

### 4. Impulse Backend Sync
**Purpose**: Verify impulse creation attempts backend sync via MCP  
**Expected**: Backend sync failures logged at ERROR level (not WARN)  
**Validates**: Enforcement change in impulse-create.ts:157

### 5. Strict Backend Enforcement
**Purpose**: Verify strictBackend mode throws clear errors instead of silent fallback  
**Expected**: Clear error message mentioning "strict backend mode", no silent fallback  
**Validates**: Enforcement logic in template-loader.ts

### 6. MCP Health Check Function
**Purpose**: Verify the new healthCheck() function works correctly  
**Expected**: Valid structure with `overall` and `clients` fields  
**Validates**: MCP.healthCheck() implementation in mcp/index.ts:300

## Running the Harness

```bash
# From project root
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Run the validation harness
bun tests/validation-harnesses/mcp-activity-impulse-tool-call-enforcement-harness.ts

# Or run programmatically
bun << 'EOF'
import { runValidation } from './tests/validation-harnesses/mcp-activity-impulse-tool-call-enforcement-harness.ts'
const result = await runValidation()
console.log(result.pass ? "PASS ✅" : "FAIL ❌")
EOF
```

## Expected Output

```
🔍 Running MCP Activity and Impulse System Tool Call Enforcement Validation
================================================================================

📋 Running: testMCPConnectivity
✅ PASS: MCP Client Connectivity
   Details: MCP health: healthy. Clients: metabob

📋 Running: testMCPToolsRegistration
✅ PASS: MCP Tools Registration
   Details: Found 8 metabob tools

📋 Running: testActivityBackendReporting
✅ PASS: Activity Execution Backend Reporting
   Details: Found backend reporting logs

📋 Running: testImpulseBackendSync
✅ PASS: Impulse Backend Sync
   Details: Found error-level backend sync logging

📋 Running: testStrictBackendEnforcement
✅ PASS: Strict Backend Enforcement
   Details: Enforcement working correctly

📋 Running: testHealthCheckFunction
✅ PASS: MCP Health Check Function
   Details: Health check returned valid structure: true

================================================================================
📊 Validation Summary
================================================================================
Total Tests: 6
Passed: 6 ✅
Failed: 0 ❌
Pass Rate: 100.0%

🎯 Overall Result: ✅ PASS
```

## Troubleshooting

### MCP Client Connectivity fails
- Check that `opencode.json` has MCP configuration for metabob
- Verify metabob-cli MCP server is running: `ps aux | grep metabob-cli`
- Check network connectivity to MCP server

### MCP Tools Registration fails
- Ensure metabob-cli MCP server is running and accessible
- Check MCP server logs for errors
- Verify MCP client configuration in opencode.json

### Backend Reporting fails
- Check that enforcement changes are in place (commit 8a88b061)
- Verify logs show WARN level for activity failures (not DEBUG)
- Ensure logging infrastructure is working

### Impulse Backend Sync fails
- Check that enforcement changes are in place
- Verify logs show ERROR level for sync failures (not WARN)
- Confirm error messages include impact and hint fields

### Strict Backend Enforcement fails
- Verify TemplateLoader has strictBackend option
- Check that strictBackend enforcement logic throws errors
- Ensure error messages are clear and actionable

### Health Check fails
- Ensure MCP.healthCheck() function is implemented
- Verify return type matches expected structure
- Check that function tests all configured clients

## Integration with CI/CD

Add to `.github/workflows/validation.yml`:

```yaml
- name: Run MCP Tool Call Enforcement Validation
  run: |
    bun tests/validation-harnesses/mcp-activity-impulse-tool-call-enforcement-harness.ts
  env:
    METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
```

Or add to pre-deployment checks:

```bash
#!/bin/bash
echo "Running MCP enforcement validation..."
bun tests/validation-harnesses/mcp-activity-impulse-tool-call-enforcement-harness.ts
if [ $? -ne 0 ]; then
  echo "❌ MCP enforcement validation failed"
  exit 1
fi
echo "✅ MCP enforcement validation passed"
```

## Related Artifacts

### Impulses
- **Trace**: `trace-mcp-activity-impulse-tool-call-enforcement`
- **Enforcement**: `enforcement-mcp-activity-impulse-tool-call-enforcement`
- **Harness**: `harness-mcp-activity-impulse-tool-call-enforcement`
- **Test Cases**: `validation-mcp-activity-impulse-tool-call-enforcement-case-1` through `case-6`

### Files
- **Harness**: `tests/validation-harnesses/mcp-activity-impulse-tool-call-enforcement-harness.ts`
- **Activity Tool**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (line 877)
- **Impulse Tool**: `repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts` (line 157)
- **Template Loader**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
- **MCP Module**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts` (line 300)

### Commit
- **Hash**: 8a88b061
- **Message**: "Enforce MCP Activity and Impulse System Tool Call patterns"

## Validation History

| Date | Result | Notes |
|------|--------|-------|
| 2026-03-03 | ⏳ Pending | Initial harness creation |

## Next Steps

1. Run harness in development environment
2. Verify all tests pass
3. Add to CI/CD pipeline
4. Monitor in production
5. Update enforcement based on findings
