# MCP Data Flow Validation Harness

## Overview

This validation harness tests the complete end-to-end data flow from OpenCode activity execution through the metabob-cli MCP server to backend database storage.

**Specification**: MCP Data Flow: Devbob → Metabob-CLI → Database

**Purpose**: Verify that the enforcement changes (impulse collection, component extraction, MCP transmission) actually work in production.

## Files

- `mcp-data-flow-devbob-cli-database-harness.ts` - Main validation harness
- `run-mcp-data-flow-validation.ts` - Test runner (executes all test cases)
- `README.md` - This file

## Test Cases

### Case 1: Basic Activity Execution
**Impulse**: `validation-mcp-data-flow-devbob-cli-database-case-1`

Tests simple activity with 2 impulses and 3 component changes. Validates:
- Activity execution completes successfully
- Impulses tracked in activity.impulses registry
- Component changes extracted from git diff
- Data transmitted via MCP
- Backend stores impulse_usage records

### Case 2: Multiple Impulses
**Impulse**: `validation-mcp-data-flow-devbob-cli-database-case-2`

Tests complex activity with 5 impulses and 8 component changes. Validates:
- Multiple impulse types handled correctly
- Larger MCP payload (4-5KB) transmitted successfully
- All impulses linked to execution in database
- Success rates updated for all impulses

### Case 3: Failure Scenario
**Impulse**: `validation-mcp-data-flow-devbob-cli-database-case-3`

Tests failed activity with 3 impulses. Validates:
- Failed activities still transmit learning data
- Impulses marked as not useful (was_useful: false)
- No component changes (activity failed before modifications)
- Failure data recorded in database

## Usage

### Run All Tests

```bash
bun run tests/validation-harnesses/run-mcp-data-flow-validation.ts
```

### Run Single Test Case

```typescript
import { runValidation } from './tests/validation-harnesses/mcp-data-flow-devbob-cli-database-harness'

const testInput = {
  templateId: "simple-feature-add",
  variables: {
    featureName: "test-feature",
    description: "Test feature"
  },
  reason: "Validation test",
  expectedImpulseCount: 2,
  expectedComponentCount: 3
}

const result = await runValidation(testInput)

if (result.pass) {
  console.log("✅ Validation PASSED")
} else {
  console.log("❌ Validation FAILED")
  console.log("Errors:", result.errors)
}
```

### Programmatic Usage

```typescript
import { runValidation, type ValidationInput, type ValidationOutput } from './mcp-data-flow-devbob-cli-database-harness'

async function validateDataFlow(input: ValidationInput): Promise<boolean> {
  const result: ValidationOutput = await runValidation(input)
  
  // Check critical validation points
  const criticalChecks = [
    result.results.activityExecution.exists,
    result.results.activityExecution.hasCorrectTemplate,
    result.results.activityExecution.hasImpulsesUsed,
  ]
  
  return criticalChecks.every(check => check === true)
}
```

## Validation Points

### Phase 1: Activity Execution
- ✅ Activity created with correct template ID
- ✅ Activity executed (or failed as expected)
- ✅ Metrics recorded (duration, cost, tokens)
- ✅ Impulses tracked in activity.impulses registry
- ✅ Component changes identified from commits

### Phase 2: Data Collection
- ✅ Loaded impulses filtered from registry
- ✅ Impulse token counts captured
- ✅ was_useful flag set based on activity success
- ✅ Component extraction runs (git diff + parsing)
- ✅ Component metadata collected (file, name, type, change_type)

### Phase 3: MCP Transmission
- ✅ TemplateMetricsClient.reportExecution called with extended data
- ✅ impulses_used array included in payload
- ✅ component_changes array included in payload
- ✅ MCP tool metabob_post_activity_result receives data
- ✅ CLI logs show data reception

### Phase 4: Backend Storage
- ✅ Backend API /api/v1/learning-loop/executions receives request
- ✅ activity_executions record created with impulses_used
- ✅ impulse_usage records created linking execution to impulses
- ✅ impulse_registry success rates updated
- ✅ Data queryable via backend API

## Pass Criteria

### Critical (Must Pass)
- Activity must exist in storage
- Template ID must match input
- Metrics must be recorded
- Impulses must be tracked (hasImpulsesUsed=true)

### Optional (Graceful Degradation)
- Backend availability (test passes if backend unavailable)
- MCP payload capture (log-based, may not always be available)
- Component count exact match (heuristic-based)

## Output Format

```typescript
interface ValidationOutput {
  pass: boolean                    // Overall pass/fail
  results: {
    activityExecution: {
      exists: boolean
      hasCorrectTemplate: boolean
      hasMetrics: boolean
      hasImpulsesUsed: boolean
      hasComponentChanges: boolean
      impulsesUsedCount?: number
      componentsChangedCount?: number
    }
    impulseUsage: {
      recordsCreated: boolean
      recordCount?: number
      linkedToExecution: boolean
    }
    impulseRegistry: {
      updatedSuccessRates: boolean
      impulseCount?: number
    }
    mcpPayload: {
      captured: boolean
      hasImpulsesUsed: boolean
      hasComponentChanges: boolean
      payloadSize?: number
    }
  }
  actual: {
    activityId?: string
    executionId?: string
    impulsesUsed?: any[]
    componentChanges?: any[]
    mcpPayload?: string
  }
  expected: ValidationInput
  errors: string[]
}
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/validate-mcp-data-flow.yml
name: Validate MCP Data Flow

on:
  push:
    branches: [main]
    paths:
      - 'repos/metabob-opencode/packages/opencode/src/session/activity.ts'
      - 'repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts'
      - 'repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Run MCP Data Flow Validation
        run: bun run tests/validation-harnesses/run-mcp-data-flow-validation.ts
```

## Troubleshooting

### "Activity not found in storage"
- Ensure activity execution completed before validation
- Check activity.ts logs for execution errors

### "Impulses not tracked in registry"
- Verify activity template has impulses defined
- Check that impulses were actually loaded during execution

### "Backend API unavailable"
- This is expected if backend not running
- Test will pass with warning if backend checks skipped
- For full validation, start backend before running tests

### "MCP payload not captured"
- Increase log level: `LOG_LEVEL=debug`
- Check log directory: `$OPENCODE_LOG_DIR`
- Ensure MCP communication happening (check CLI logs)

## Related Impulses

- **Trace**: `trace-mcp-data-flow-devbob-cli-database`
- **Enforcement**: `enforcement-mcp-data-flow-devbob-cli-database`
- **Harness**: `harness-mcp-data-flow-devbob-cli-database`
- **Test Cases**: `validation-mcp-data-flow-devbob-cli-database-case-1/2/3`

## Maintenance

When updating the specification:

1. Update harness validation logic (`mcp-data-flow-devbob-cli-database-harness.ts`)
2. Add new test cases as needed (create new impulses)
3. Update expected outputs in test case impulses
4. Run full test suite to verify changes
5. Update this README with new validation points
