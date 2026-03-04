# Validation Harness: dynamic-activity-creation-with-trailblazing-pass3

## Overview

This validation harness tests the **Pass 3** implementation of the dynamic activity creation system with trailblazing functionality. It performs **static code analysis** to verify that all code-level requirements are correctly implemented.

**No LLM required** - All tests are deterministic and repeatable.

## Test Coverage

### 10 Test Cases

| # | Test Case | Status | Description |
|---|-----------|--------|-------------|
| 1 | Meta-template detection | ✅ PASS | isMetaTemplate() identifies 4 variants |
| 2 | Auto-trailblazing enablement | ✅ PASS | Conservative limits (1.0/5.0/3) |
| 3 | Context injection | ⚠️ PARTIAL | Backend query + impulse creation |
| 4 | Lifecycle hooks | ✅ PASS | Priorities 10 (memory) and 15 (rec) |
| 5 | Backend sync | ✅ PASS | Activity.save → metabob_activity_save |
| 6 | Bootstrap templates | ⚠️ PARTIAL | 15 templates, 3 meta-templates |
| 7 | No filesystem dependency | ⚠️ PARTIAL | MCP-only, no fs access |
| 8 | Observability checkpoints | ✅ PASS | Log statements present |
| 9 | MCP registration timeout | ✅ PASS | 15000ms timeout |
| 10 | Trailblazing executor | ✅ PASS | Retry loop + AI recovery |

**Pass Rate**: 7/10 (70%)

## Usage

### Run the harness

```bash
bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass3-harness.ts
```

### Exit codes

- `0` - All tests pass
- `1` - One or more tests fail

### Output format

```
🧪 Running Pass 3 validation harness...
📋 Total test cases: 10

⏳ Running Meta-template detection...
✅ PASS: Meta-template detection

⏳ Running Auto-trailblazing enablement...
✅ PASS: Auto-trailblazing enablement

...

============================================================
📊 Validation Results: ✅ PASS or ❌ FAIL
   Total: 10
   Passed: X
   Failed: Y
============================================================
```

## Test Cases Detail

### Case 1: Meta-template detection

**Tests**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Validates**:
- `isMetaTemplate()` function exists
- Identifies 4 meta-template variants:
  - `create-activity`
  - `create-activity-self-contained`
  - `evolve-activity-self-contained`
  - `debug-activity-self-contained`

**Expected Output**:
```json
{
  "hasIsMetaTemplate": true,
  "metaTemplateIds": ["create-activity", "create-activity-self-contained", ...],
  "allPresent": true
}
```

### Case 2: Auto-trailblazing enablement

**Tests**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Validates**:
- Auto-enable check: `ActivityTemplate.isMetaTemplate()`
- Log statement: `"auto-enabling trailblazing for meta-template"`
- Conservative limits:
  - `maxCostPerTask: 1.0`
  - `maxTotalCost: 5.0`
  - `maxRecoveryAttempts: 3`

**Expected Output**:
```json
{
  "hasAutoEnableCheck": true,
  "hasAutoEnableLog": true,
  "hasConservativeLimits": true,
  "limits": { "maxCostPerTask": 1.0, "maxTotalCost": 5.0, "maxRecoveryAttempts": 3 }
}
```

### Case 3: Context injection

**Tests**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Validates**:
- Context injection check for meta-templates
- Backend query: `TemplateServiceClient.searchSimilarActivities()`
- Impulse creation: `SessionMemory.addImpulse()`
- Top 3 limit

**Expected Output**:
```json
{
  "hasContextInjection": true,
  "queriesBackend": true,
  "createsImpulse": true,
  "limitTopThree": true
}
```

### Case 4: Lifecycle hooks

**Tests**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`

**Validates**:
- `memory-management` hook (priority 10)
- `activity-recommendation-injection` hook (priority 15)
- `manage-session-memory` activity execution

**Expected Output**:
```json
{
  "memoryManagementHook": { "registered": true, "priority": 10, "executesActivity": true },
  "activityRecommendationHook": { "registered": true, "priority": 15 }
}
```

### Case 5: Backend sync

**Tests**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Validates**:
- Calls `metabob_activity_save` MCP tool
- Checks client availability
- Logs sync success
- Warns if unavailable

**Expected Output**:
```json
{
  "callsMetabobActivitySave": true,
  "checksClientAvailability": true,
  "logsSync": true,
  "warnsIfUnavailable": true
}
```

### Case 6: Bootstrap templates

**Tests**: `templates/bootstrap/` directory

**Validates**:
- `create-activity-self-contained.json` exists
- `debug-activity-self-contained.json` exists
- `evolve-activity-self-contained.json` exists
- Total templates ≥ 15

**Expected Output**:
```json
{
  "createActivityExists": true,
  "debugActivityExists": true,
  "evolveActivityExists": true,
  "totalTemplates": "≥15"
}
```

### Case 7: No filesystem dependency

**Tests**: Meta-template JSON files

**Validates**:
- Debug activity uses `activity_error_inspector` MCP tool
- Evolve activity uses `search_activities` or `get_activity_template` MCP tools
- No `fs.`, `readFile`, `writeFile`, `readdir` calls

**Expected Output**:
```json
{
  "debugUsesMCP": true,
  "evolveUsesMCP": true,
  "debugUsesFilesystem": false,
  "evolveUsesFilesystem": false
}
```

### Case 8: Observability checkpoints

**Tests**: Activity tool and Activity.save()

**Validates**:
- Log: `"auto-enabling trailblazing for meta-template"`
- Log: `"injecting similar activity context"`
- Log: `"synced activity to backend"`

**Expected Output**:
```json
{
  "hasMetaTemplateDetectionLog": true,
  "hasContextInjectionLog": true,
  "hasBackendSyncLog": true
}
```

### Case 9: MCP registration timeout

**Tests**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts`

**Validates**:
- `registerTemplate()` method exists
- Timeout set to 15000ms

**Expected Output**:
```json
{
  "hasRegisterTemplateMethod": true,
  "timeout": 15000
}
```

### Case 10: Trailblazing executor

**Tests**: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`

**Validates**:
- `executeTaskWithTrailblazing()` method exists
- Retry loop with `maxRecoveryAttempts`
- `ContinuationGenerator` usage
- Cost budgets: `maxCostPerTask`, `maxTotalCost`

**Expected Output**:
```json
{
  "hasExecuteMethod": true,
  "hasRetryLoop": true,
  "hasContinuationGenerator": true,
  "respectsCostBudgets": true
}
```

## Known Issues

### Failed Tests (3/10)

1. **Case 3: Context injection** - Pattern detection may be too strict
2. **Case 6: Bootstrap templates** - Template files may not exist yet
3. **Case 7: No filesystem dependency** - May have false positives

These failures are expected and represent gaps that need to be addressed before Pass 3 is complete.

## CI/CD Integration

### Add to pre-push hook

```bash
#!/bin/bash
echo "Running Pass 3 validation..."
bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass3-harness.ts
if [ $? -ne 0 ]; then
  echo "❌ Pass 3 validation failed. Fix issues before pushing."
  exit 1
fi
echo "✅ Pass 3 validation passed"
```

### Add to GitHub Actions

```yaml
name: Pass 3 Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Run Pass 3 validation
        run: bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass3-harness.ts
```

## Maintenance

### When to update

Update this harness when:
- New meta-templates are added
- Trailblazing configuration changes
- Lifecycle hooks are added/modified
- Backend sync architecture changes
- MCP tool signatures change

### How to add test cases

1. Add new test function in harness:
   ```typescript
   async function testNewFeature(): Promise<ValidationResult> {
     // Implementation
   }
   ```

2. Add to validation cases array:
   ```typescript
   validationCases.push({
     id: "case-11",
     name: "New feature",
     test: testNewFeature
   })
   ```

3. Update test cases JSON file with expected output

4. Update this README with test case details

## References

- **Trace Analysis**: `TRACE_dynamic-activity-creation-with-trailblazing-pass3.json`
- **Enforcement Summary**: `ENFORCEMENT_SUMMARY_pass3.json`
- **Test Cases**: `dynamic-activity-creation-with-trailblazing-pass3-test-cases.json`
- **Specification**: Dynamic activity creation with trailblazing (Pass 3)

## Contact

For issues or questions about this harness, refer to the specification documentation or the trace analysis.
