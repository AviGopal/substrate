# Validation Harness: dynamic-activity-creation-with-trailblazing-validation

**Impulse ID**: harness-dynamic-activity-creation-with-trailblazing-validation  
**Type**: file  
**Budget**: 2000 tokens  
**File**: tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-validation-harness.ts

---

## Purpose

Validates the complete end-to-end implementation of dynamic-activity-creation-with-trailblazing-validation specification, including:

- Phase 1: Infrastructure (isMetaTemplate function)
- Phase 2b: Similar activity context injection
- Phase 3: Auto-enable trailblazing logic
- Phase 4: Template JSON file updates
- Integration: All components working together

## Validation Strategy

The harness performs 6 test categories:

### Test 1: isMetaTemplate() Function
- Verifies function exists in activity-template.ts
- Checks for all 3 meta-template IDs:
  - create-activity-self-contained
  - evolve-activity-self-contained
  - debug-activity-self-contained

### Test 2: Auto-Enable Trailblazing Logic (Phase 3)
- Verifies auto-enable code in activity.ts
- Checks for `isMetaTemplate()` check
- Validates conservative limits ($1/task, $5 total)

### Test 3: Phase 2b Context Injection
- Verifies Phase 2b comment and code in activity.ts (lines 990-1067)
- Checks for `searchSimilarActivities()` call
- Validates impulse creation with `similar-activities-` prefix
- Confirms SessionMemory import

### Test 4: Template JSON Files
- Checks existence of all 4 template JSON files:
  - create-activity-self-contained-v2.json
  - create-activity-v2-simplified.json
  - evolve-activity-self-contained.json
  - debug-activity-self-contained.json
- Validates trailblazing configuration in each:
  - `enabled: true`
  - `maxCostPerTask: 1.0`
  - `maxTotalCost: 5.0`
  - `maxRecoveryAttempts: 3`

### Test 5: Integration Tests (Optional)
- Runs `turn-lifecycle-integration.test.ts`
- Expects 6/6 tests passing
- Validates no regressions from Phase 2b changes

### Test 6: Template Runtime Accessibility
- Maps template IDs to file paths
- Verifies files exist and are accessible
- Confirms templates can be loaded at runtime

## Usage

### Command Line
```bash
# Run with default template (create-activity-self-contained)
bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-validation-harness.ts

# Run with specific template
bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-validation-harness.ts evolve-activity-self-contained

# Run with integration tests
bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-validation-harness.ts create-activity-self-contained --run-tests
```

### Programmatic
```typescript
import { runValidation } from "./dynamic-activity-creation-with-trailblazing-validation-harness"

const result = await runValidation({
  templateId: "create-activity-self-contained",
  checkImplementation: true,
  runIntegrationTests: false
})

console.log(result.pass ? "✅ PASS" : "❌ FAIL")
console.log(`Errors: ${result.errors.length}`)
```

## Success Criteria

The harness returns `pass: true` if:
- All 3 meta-templates recognized by `isMetaTemplate()`
- Auto-enable trailblazing logic present
- Phase 2b context injection present
- All 4 template JSON files exist with correct trailblazing config
- No errors in error array
- (Optional) Integration tests pass (6/6)

## Output Format

```json
{
  "pass": true/false,
  "actual": {
    "isMetaTemplateCheck": {
      "createActivity": boolean,
      "evolveActivity": boolean,
      "debugActivity": boolean
    },
    "autoEnableLogic": {
      "present": boolean,
      "location": string
    },
    "phase2bInjection": {
      "present": boolean,
      "location": string
    },
    "templateJsonFiles": {
      "createActivitySelfContained": {
        "exists": boolean,
        "hasTrailblazingConfig": boolean,
        "config": object
      },
      // ... 3 more templates
    },
    "integrationTests": {
      "executed": boolean,
      "passed": boolean,
      "totalTests": number,
      "passedTests": number
    },
    "runtimeValidation": {
      "templateExists": boolean,
      "templateId": string
    }
  },
  "expected": { /* ... */ },
  "errors": string[]
}
```

## Test Cases

The harness validates against 4 test case impulses:

1. **validation-dynamic-activity-creation-with-trailblazing-validation-case-1**
   - Input: create-activity-self-contained
   - Expected: All checks pass

2. **validation-dynamic-activity-creation-with-trailblazing-validation-case-2**
   - Input: evolve-activity-self-contained
   - Expected: All checks pass, parent context references exist

3. **validation-dynamic-activity-creation-with-trailblazing-validation-case-3**
   - Input: debug-activity-self-contained
   - Expected: All checks pass, recovery task generation exists

4. **validation-dynamic-activity-creation-with-trailblazing-validation-case-4**
   - Input: create-activity-self-contained with integration tests
   - Expected: 6/6 integration tests pass

## Implementation Notes

- **Non-LLM**: Harness uses only file system checks and code parsing (no LLM calls)
- **Fast**: Completes in <1 second without integration tests
- **Deterministic**: Same input always produces same output
- **Isolated**: No side effects, safe to run multiple times
- **Historical**: Test cases stored as impulses for repeatability

## Related Files

- **Trace Impulse**: `trace-dynamic-activity-creation-with-trailblazing-validation`
- **Enforcement Impulse**: `enforcement-dynamic-activity-creation-with-trailblazing-validation`
- **Test Cases**: `validation-dynamic-activity-creation-with-trailblazing-validation-case-{1-4}`

## Exit Codes

- `0`: All validations passed
- `1`: At least one validation failed
