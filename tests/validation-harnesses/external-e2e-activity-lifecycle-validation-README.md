# External E2E Activity Lifecycle Validation Harness

**Specification**: `external-e2e-activity-lifecycle-validation`  
**File**: `tests/validation-harnesses/external-e2e-activity-lifecycle-validation-harness.ts`

---

## Overview

This harness validates the **complete activity lifecycle** using only external tools (black-box testing):

1. **Template Storage**: Query SurrealDB to verify templates exist
2. **Template Execution**: Execute template via compiled OpenCode binary
3. **Execution Storage**: Query SurrealDB to verify execution recorded
4. **Log Analysis**: Check logs for errors and lifecycle events

**No code access required** - uses only compiled binary and DB CLI.

---

## Test Phases

### Phase 1: Template Storage Verification

**Goal**: Prove templates can be stored in database

**Method**:
```bash
surreal sql --conn <url> --user <user> --pass <pass> \
  --ns <ns> --db <db> --json \
  'SELECT * FROM activity_template LIMIT 10'
```

**Validates**:
- At least 1 template exists
- Template has required fields: `id`, `name`, `category`, `tasks`

**Pass Criteria**: Templates found with valid structure

---

### Phase 2: Template Execution + Storage Verification

**Goal**: Prove templates can be executed and executions are recorded

**Method**:
```bash
# Execute template
./opencode activity <template-id> --variables '{}' --reason 'E2E test'

# Query execution record
surreal sql 'SELECT * FROM activity_execution WHERE template_id = "<id>" ORDER BY created_at DESC LIMIT 1'
```

**Validates**:
- Template executes via CLI
- Execution record exists in database
- Execution has required fields: `id`, `template_id`, `status`
- Template ID matches

**Pass Criteria**: Execution record found with matching template_id

---

### Phase 3: Log Analysis

**Goal**: Verify system tracks lifecycle correctly

**Method**:
```bash
grep -i error validation.log
grep -i "activity.*start" validation.log
```

**Validates**:
- Low error count (<= 5)
- Lifecycle indicators present

**Pass Criteria**: Clean logs with lifecycle events

---

## Usage

### Programmatic Usage

```typescript
import { runValidation } from './external-e2e-activity-lifecycle-validation-harness';

const input = {
  testCaseId: 'my-test',
  description: 'Test description',
  surrealUrl: 'http://localhost:8000',
  surrealUser: 'root',
  surrealPass: 'root',
  surrealNs: 'metabob',
  surrealDb: 'devbob',
  opencodeBin: 'repos/metabob-opencode/dist/opencode-linux-x64/bin/opencode',
  expectedTemplateCount: 1,
  expectedExecutionFields: ['id', 'template_id', 'status']
};

const result = await runValidation(input);

if (result.pass) {
  console.log('✅ Validation passed');
} else {
  console.log('❌ Validation failed');
  console.log('Errors:', result.errors);
}
```

---

### CLI Usage

**Run with default settings**:
```bash
npx ts-node tests/validation-harnesses/external-e2e-activity-lifecycle-validation-harness.ts
```

**Run with environment variables**:
```bash
export SURREAL_URL=http://localhost:8000
export SURREAL_USER=root
export SURREAL_PASS=root
export SURREAL_NS=metabob
export SURREAL_DB=devbob

npx ts-node tests/validation-harnesses/external-e2e-activity-lifecycle-validation-harness.ts
```

---

### Using Test Cases

**Test Case 1: Basic validation**
```bash
./scripts/run-validation-harness.sh case-1
```

**Test Case 2: K8s environment**
```bash
./scripts/run-validation-harness.sh case-2
```

**Test Case 3: Strict validation**
```bash
./scripts/run-validation-harness.sh case-3
```

---

## Test Cases

Test cases are stored as impulses in `impulses/validation-external-e2e-activity-lifecycle-validation-case-*.json`

### Case 1: Basic Lifecycle
- Default local settings
- Minimal field checks
- Expects >= 1 template

### Case 2: K8s Environment
- DevBob k8s environment
- Custom DB connection
- Expects >= 5 templates

### Case 3: Strict Validation
- Comprehensive field checks
- Zero error tolerance
- All execution fields verified

---

## Output Format

```typescript
{
  pass: boolean,              // Overall pass/fail
  actual: {
    phase1: {
      templateCount: number,
      selectedTemplate?: { id, name, category },
      hasRequiredFields: boolean
    },
    phase2: {
      executionRecordFound: boolean,
      executionHasRequiredFields: boolean,
      templateIdMatches: boolean
    },
    phase3: {
      errorCount: number,
      hasLifecycleIndicators: boolean
    }
  },
  expected: {
    phase1: { minTemplateCount, requiredFields },
    phase2: { executionExists, requiredFields },
    phase3: { maxErrors, hasLifecycleIndicators }
  },
  errors: string[],           // All errors encountered
  evidence: string[],         // Evidence collected
  timestamp: string           // ISO timestamp
}
```

---

## Success Criteria

**Overall Pass**: 2/3 phases must pass

**Phase 1 Pass**:
- At least 1 template found
- Template has required fields

**Phase 2 Pass**:
- Execution record found
- Execution has required fields
- Template ID matches

**Phase 3 Pass**:
- Error count <= 5
- (Lifecycle indicators optional - may be in different logs)

---

## External Tools Used

1. **Compiled OpenCode binary** (`opencode`)
   - No dev code access
   - Only compiled distribution

2. **SurrealDB CLI** (`surreal sql`)
   - Direct database queries
   - No code instrumentation

3. **Standard shell tools**
   - `grep` for log analysis
   - `jq` for JSON parsing

---

## Integration with CI/CD

```yaml
# .github/workflows/e2e-validation.yml
name: E2E Activity Lifecycle Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build OpenCode
        run: |
          cd repos/metabob-opencode
          bun install
          bun run build
      
      - name: Run E2E Validation
        run: |
          ./scripts/run-validation-harness.sh case-1
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: validation-results
          path: test-results/external-e2e-validation/
```

---

## Troubleshooting

### "No templates found in database"

**Cause**: Database is empty or not accessible

**Solution**:
1. Check SurrealDB is running: `surreal version`
2. Verify connection details
3. Check database has templates: `surreal sql 'SELECT * FROM activity_template'`

---

### "OpenCode binary not found"

**Cause**: OpenCode not built or wrong path

**Solution**:
1. Build OpenCode: `cd repos/metabob-opencode && bun run build`
2. Verify binary exists: `ls repos/metabob-opencode/dist/opencode-linux-x64/bin/opencode`

---

### "Execution record not found"

**Cause**: Execution may not have reached DB yet (async) or failed

**Solution**:
1. Check CLI output for errors
2. Wait a few seconds and query again
3. Check backend API logs

---

## Extending the Harness

### Add New Test Case

1. Create impulse:
```json
{
  "testCaseId": "validation-external-e2e-activity-lifecycle-validation-case-4",
  "type": "memo",
  "input": { ... },
  "expectedOutput": { ... }
}
```

2. Run test case:
```bash
./scripts/run-validation-harness.sh case-4
```

---

### Add New Validation Phase

1. Add phase function:
```typescript
async function phase4_customValidation(input: ValidationInput): Promise<PhaseResult> {
  // Your validation logic
}
```

2. Update `runValidation()` to call new phase

3. Update `ValidationOutput` type with phase4 results

---

## References

- **Specification**: `TRACE_ANALYSIS_external-e2e-activity-lifecycle-validation.md`
- **Enforcement Summary**: `ENFORCEMENT_SUMMARY_external-e2e-activity-lifecycle-validation.md`
- **Harness Impulse**: `impulses/harness-external-e2e-activity-lifecycle-validation.json`
- **Test Cases**: `impulses/validation-external-e2e-activity-lifecycle-validation-case-*.json`

---

**Last Updated**: 2026-03-18  
**Status**: ✅ Ready for use
