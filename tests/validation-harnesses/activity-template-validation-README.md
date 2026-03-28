# Activity Template Validation Harness

## Purpose
Validates that the `activity-template-validation` specification is correctly implemented:
- Templates are validated before registration
- Broken templates are rejected with error messages
- Broken templates are NOT in storage after rejection

## Test Cases

### Case 1: Valid Template Registration
**Input**: Valid template with `validate_before_register=true` and proper `test_variables`

**Expected Output**:
- Registration succeeds
- Template metrics: `executions=1`, `successRate=1.0`
- Template exists in storage

**Rationale**: Valid templates should pass validation and be registered with initial success metrics.

### Case 2: Broken Template Registration
**Input**: Broken template with missing required files and `validate_before_register=true`

**Expected Output**:
- Registration fails with error message
- Error contains "Template validation failed"
- Template NOT in storage after failure

**Rationale**: Broken templates should fail validation, be removed from storage, and throw detailed error.

## Usage

### Run All Tests
```bash
cd tests/validation-harnesses
bun run activity-template-validation-harness.ts
```

### Programmatic Usage
```typescript
import { runValidation, runAllValidations, TEST_CASES } from "./activity-template-validation-harness"

// Run single test
const result = await runValidation(TEST_CASES[0])
console.log(result.pass ? "PASS" : "FAIL")

// Run all tests
const { passed, failed, results } = await runAllValidations()
```

## Output Format
```json
{
  "pass": true,
  "caseId": "validation-activity-template-validation-case-1",
  "actual": {
    "success": true,
    "executions": 1,
    "successRate": 1.0,
    "templateInStorage": true
  },
  "expected": {
    "success": true,
    "executions": 1,
    "successRate": 1.0,
    "templateInStorage": true
  }
}
```

## Exit Codes
- `0`: All tests passed
- `1`: One or more tests failed

## Integration with CI/CD
Add to your test suite:
```yaml
- name: Run validation harnesses
  run: bun run tests/validation-harnesses/activity-template-validation-harness.ts
```

## Related Documentation
- `docs/data-flows/activity-template-validation-before-registration-flow.md` - Flow documentation
- `repos/metabob-opencode/ACTIVITY_TEMPLATE_VALIDATION.md` - Feature specification
- `/tmp/trace-activity-template-validation.json` - Trace analysis
- `/tmp/enforcement-activity-template-validation.json` - Enforcement summary
