# Bootstrap Template Filepath Compliance - Validation Harness

## Specification

Bootstrap templates in metabob-opencode must only reference filepaths that are either:
1. Built into the Docker image at build time
2. Provided via metabob-cli's MCP server
3. Embedded in the metabob-opencode binary/distribution

**Problem Fixed:** The previous implementation used hardcoded filepath `'../../../../../metabob-proto/activities/bootstrap'` which only works in development monorepo and breaks in production environments (Docker containers, standalone binaries, client devices).

**Solution Implemented:** Embedded templates in binary using Bun's asset import system, eliminating filesystem dependency entirely.

## Validation Strategy

**Type:** external-test

This harness validates the fix by running actual code against expected behavior without requiring LLM intervention. All test cases are deterministic with predefined expected outputs.

## Test Cases

### Test Case 1: Embedded Template Loading
**Input:** Load all bootstrap templates using `BootstrapTemplates.loadAll()`

**Expected Output:**
- Success: true
- Template count: 6
- Template IDs: create-activity, debug-activity-self-contained, evolve-activity-self-contained, manage-session-memory, trace-data-flow-single-feature, trace-enforce-validate-loop
- Source: embedded-imports

**Validates:** Templates load successfully from embedded imports without filesystem access

### Test Case 2: No Filesystem Dependencies
**Input:** Analyze bootstrap-templates.ts source code

**Expected Output:**
- No old path references: true
- Has embedded imports: true
- No filesystem reads: true

**Validates:** Source code doesn't contain problematic filepath patterns or filesystem operations

### Test Case 3: Template Structure Validation
**Input:** Load and validate all template structures

**Expected Output:**
- All templates valid: true
- Required fields present: true (id, name, description)
- Tasks non-empty: true

**Validates:** All templates have complete, well-formed structure

### Test Case 4: Production Environment Simulation
**Input:** Load templates when metabob-proto doesn't exist

**Expected Output:**
- Load success without metabob-proto: true
- No filesystem errors: true

**Validates:** Templates work in production deployments where metabob-proto repository doesn't exist

### Test Case 5: Performance Improvement
**Input:** Measure template loading time

**Expected Output:**
- Load time under 100ms: true
- No filesystem I/O: true

**Validates:** Embedded templates load faster than previous filesystem-based approach

## Usage

### Run Validation Harness

```bash
# Using the runner script
./tests/validation-harnesses/run-bootstrap-template-filepath-compliance-validation.sh

# Or directly with bun
bun run tests/validation-harnesses/bootstrap-template-filepath-compliance-harness.ts
```

### Expected Output

```
Running bootstrap-template-filepath-compliance validation harness...

=== Validation Results ===

✅ PASS: test-1-embedded-loading
✅ PASS: test-2-no-filesystem-deps
✅ PASS: test-3-structure-validation
✅ PASS: test-4-production-simulation
✅ PASS: test-5-performance

=== Summary ===
Total Tests: 5
Passed: 5
Failed: 0
Pass Rate: 100%

Overall: ✅ PASS
```

### Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

## Files

- **Harness:** `bootstrap-template-filepath-compliance-harness.ts`
- **Runner:** `run-bootstrap-template-filepath-compliance-validation.sh`
- **Test Cases (Impulses):**
  - `impulses/validation-bootstrap-template-filepath-compliance-case-1.json`
  - `impulses/validation-bootstrap-template-filepath-compliance-case-2.json`
  - `impulses/validation-bootstrap-template-filepath-compliance-case-3.json`
  - `impulses/validation-bootstrap-template-filepath-compliance-case-4.json`
  - `impulses/validation-bootstrap-template-filepath-compliance-case-5.json`
- **Harness Impulse:** `impulses/harness-bootstrap-template-filepath-compliance.json`

## Implementation Details

### Components Under Test

1. **bootstrap-templates.ts** (Primary)
   - Embedded template imports
   - loadAll() function
   - Template validation

2. **activity-template.ts** (Secondary)
   - Immutable save function

3. **template-service-client.ts** (Secondary)
   - MCP registration with timeout

### Validation Coverage

- ✅ Embedded template loading functionality
- ✅ Filesystem independence
- ✅ Template structure completeness
- ✅ Production environment compatibility
- ✅ Performance characteristics
- ✅ No breaking changes to API

### Environment Requirements

- **Runtime:** Bun v1.0+
- **Location:** Must run from metabob-devbob repository root
- **Dependencies:** metabob-opencode submodule must be present

## Maintenance

### Adding New Test Cases

1. Add test function to harness file
2. Create impulse JSON in `impulses/` directory
3. Update `runValidation()` to include new test
4. Update this README with test case details

### Modifying Expected Outputs

If the specification changes:
1. Update expected outputs in test case impulse files
2. Update corresponding test functions in harness
3. Re-run validation to verify changes

## Troubleshooting

### Harness Fails to Load Module

**Error:** Cannot find module 'bootstrap-templates.ts'

**Solution:** Ensure you're running from repository root and metabob-opencode submodule exists

### Template Count Mismatch

**Error:** Expected 6 templates, got N

**Solution:** Check if bootstrap template files exist in `repos/metabob-opencode/packages/opencode/src/session/templates/`

### Performance Test Fails

**Error:** Load time exceeds 100ms

**Solution:** This may indicate filesystem I/O is still occurring. Verify embedded imports are being used.

## Related Documentation

- **Trace:** `impulses/trace-bootstrap-template-filepath-compliance.json`
- **Enforcement:** `impulses/enforcement-bootstrap-template-filepath-compliance.json`
- **Data Flow:** `docs/data-flows/bootstrap-template-filepath-compliance-flow.md`
- **Component Annotations:** `COMPONENT_ANNOTATIONS_bootstrap-template-filepath-compliance.md`
