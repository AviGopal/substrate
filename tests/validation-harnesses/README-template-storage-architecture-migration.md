# Template Storage Architecture Migration - Validation Harness

## Overview

This validation harness verifies that the architectural constraint "templates should be stored and retrieved from backend via MCP, not stored locally on client machines" has been properly enforced throughout the codebase.

## Architectural Constraint

**Specification**: Template Storage Architecture Migration

**Goal**: Client machines should retrieve activity templates from backend via metabob-cli MCP instead of storing them locally (except cache).

**Architecture**:
```
metabob-opencode (template-agnostic)
  → metabob-cli (MCP client)
  → backend (template storage + learning)
```

**Core Requirements**:
1. No local template storage (except cache)
2. Templates retrieved from backend via MCP only
3. Embedded bootstrap templates for cold-start
4. No local file writes during registration
5. Backend is single source of truth

## Validation Strategy

The harness performs two types of validation:

### 1. Filesystem Validation
- Checks that local template storage directories do NOT exist
- Verifies no files in `~/.local/share/opencode/storage/activity-template/`
- Verifies no files in `.metabob/activities/`

### 2. Code Analysis Validation
- Static analysis of source files
- Pattern matching for forbidden and required code patterns
- Component-level validation of enforcement

## Test Cases

### Case 1: No Local Template Storage Directories
**Type**: Filesystem  
**Validates**: Local storage directories removed  
**Pass Criteria**: Neither directory exists

### Case 2: ActivityTemplate.save() Does Not Write to Storage
**Type**: Code Analysis  
**File**: `activity-template.ts`  
**Validates**: No `Storage.write(['activity-template'])` calls  
**Pass Criteria**: Forbidden patterns not found

### Case 3: ActivityTemplate.load() Only Reads Embedded Bootstrap
**Type**: Code Analysis  
**File**: `activity-template.ts`  
**Validates**: 
- No `Storage.read(['activity-template'])` calls
- Has `BootstrapTemplates.isBootstrap` check
- Has `BootstrapTemplates.loadAll` call  
**Pass Criteria**: No storage reads AND bootstrap check present

### Case 4: TemplateLoader.save() Rejects backend='local'
**Type**: Code Analysis  
**File**: `template-loader.ts`  
**Validates**: Throws error for `backend === 'local'`  
**Pass Criteria**: Error throw pattern found

### Case 5: TemplateLoader.load() No Local Storage Fallback
**Type**: Code Analysis  
**File**: `template-loader.ts`  
**Validates**: 
- No `ActivityTemplate.load(id)` for non-bootstrap
- Has `BOOTSTRAP_TEMPLATES.has(id)` check  
**Pass Criteria**: No local fallback AND bootstrap check present

### Case 6: BootstrapTemplates.registerAll() Does Not Save Locally
**Type**: Code Analysis  
**File**: `bootstrap-templates.ts`  
**Validates**: No `ActivityTemplate.save(template)` calls  
**Pass Criteria**: Forbidden patterns not found

### Case 7: MetabobCLI.registerActivityTemplate() Does Not Write Files
**Type**: Code Analysis  
**File**: `metabob.ts`  
**Validates**: No `Bun.write(templatePath)` or file write calls  
**Pass Criteria**: Forbidden patterns not found

### Case 8: TemplateRepository.save() Rejects backend='local'
**Type**: Code Analysis  
**File**: `activity-template-repository.ts`  
**Validates**: Throws error for `backend === 'local'`  
**Pass Criteria**: Error throw pattern found

### Case 9: Bootstrap Templates Embedded in Binary
**Type**: Code Analysis  
**File**: `bootstrap-templates.ts`  
**Validates**: 
- `EMBEDDED_TEMPLATES` object exists
- Contains core templates (create-activity, debug-activity, evolve-activity)  
**Pass Criteria**: Embedded templates present with core set

## Files

### Harness Implementation
- **File**: `template-storage-architecture-migration-harness.ts`
- **Type**: TypeScript (Bun runtime)
- **Exports**: 
  - `runValidation(input): TestResult`
  - `runAllValidations(testCases): Promise<Summary>`

### Test Cases
- **File**: `/tmp/validation-test-cases.json`
- **Format**: JSON array of test case definitions
- **Count**: 9 test cases

### Runner Script
- **File**: `run-template-storage-architecture-migration-validation.sh`
- **Type**: Bash script
- **Usage**: `./run-template-storage-architecture-migration-validation.sh`

## Running the Validation

### Option 1: Using Runner Script (Recommended)
```bash
cd tests/validation-harnesses
./run-template-storage-architecture-migration-validation.sh
```

### Option 2: Direct Execution
```bash
cd tests/validation-harnesses
bun run template-storage-architecture-migration-harness.ts
```

### Option 3: Programmatic Usage
```typescript
import { runValidation, runAllValidations } from "./template-storage-architecture-migration-harness"

// Run single test
const result = runValidation({
  testType: "codeAnalysis",
  operation: "checkNoStorageWrites",
  file: "repos/metabob-opencode/packages/opencode/src/session/activity-template.ts",
  component: "save",
  forbiddenPatterns: ["Storage.write\\([\"']activity-template[\"']"]
})

console.log(result.pass ? "✅ PASS" : "❌ FAIL")
console.log(result.message)
```

## Expected Output

### Success Output
```
🔍 Template Storage Architecture Migration - Validation Harness

================================================================================

🧪 Running: No local template storage directory created
   ✅ PASS: No local template storage directories found

🧪 Running: ActivityTemplate.save() does not write to Storage
   ✅ PASS: save() does not write to Storage

🧪 Running: ActivityTemplate.load() only reads embedded bootstrap
   ✅ PASS: load() only reads embedded bootstrap

... (remaining test cases)

================================================================================

📊 Validation Summary:
   ✅ Passed: 9/9
   ❌ Failed: 0/9

✅ Validation PASSED - all architectural constraints enforced
```

### Failure Output
```
🧪 Running: ActivityTemplate.save() does not write to Storage
   ❌ FAIL: save() contains Storage.write() calls

Details:
{
  "hasStorageWrites": true,
  "forbiddenMatches": [
    {
      "pattern": "Storage.write\\([\"']activity-template[\"']",
      "count": 1
    }
  ]
}

... (remaining test cases)

================================================================================

📊 Validation Summary:
   ✅ Passed: 8/9
   ❌ Failed: 1/9

❌ Validation FAILED - architectural constraint violations detected
```

## Integration with CI/CD

Add to pre-push git hook or CI pipeline:

```bash
# .git/hooks/pre-push or .github/workflows/validate.yml

echo "Running Template Storage Architecture Migration validation..."

cd tests/validation-harnesses
if ! ./run-template-storage-architecture-migration-validation.sh; then
    echo "❌ Template storage architecture constraints violated!"
    echo "   Review changes to ensure backend-only template storage."
    exit 1
fi

echo "✅ Template storage architecture validation passed"
```

## Impulse References

### Harness Impulse
- **ID**: `harness-template-storage-architecture-migration`
- **Type**: file
- **File**: `tests/validation-harnesses/template-storage-architecture-migration-harness.ts`
- **Budget**: 2000 tokens

### Test Case Impulses
- **Pattern**: `validation-template-storage-architecture-migration-case-{N}`
- **Type**: memo
- **Count**: 9 test cases
- **Budget**: 500 tokens each

## Maintenance

### Adding New Test Cases

1. Update `/tmp/validation-test-cases.json`:
```json
{
  "testCases": [
    {
      "id": "validation-template-storage-architecture-migration-case-10",
      "name": "New validation case",
      "input": {
        "testType": "codeAnalysis",
        "operation": "checkSomething",
        "file": "path/to/file.ts",
        "forbiddenPatterns": ["pattern"]
      },
      "expectedOutput": {
        "hasSomething": false
      }
    }
  ]
}
```

2. Regenerate impulses:
```bash
bun run /tmp/create-validation-impulses.ts
```

3. Re-run validation

### Updating Validation Logic

Modify `template-storage-architecture-migration-harness.ts`:
- Add new operation types in `validateCodeAnalysisTest()`
- Add new test types in `runValidation()`
- Update pass/fail logic for new operations

## Success Criteria

✅ **All 9 test cases pass**
✅ **No local template storage directories**
✅ **No Storage.write(['activity-template']) calls**
✅ **No Storage.read(['activity-template']) calls (except bootstrap check)**
✅ **TemplateLoader/Repository reject backend='local'**
✅ **Bootstrap templates embedded, not saved locally**
✅ **No file writes to .metabob/activities/**
✅ **Embedded bootstrap templates contain core set**

## Related Documentation

- Trace Analysis: `trace-template-storage-architecture-migration`
- Enforcement Summary: `enforcement-template-storage-architecture-migration`
- Specification: Template Storage Architecture Migration
- Architecture: Backend-only template storage via MCP

## Troubleshooting

### Harness Fails to Execute
- Ensure Bun is installed: `bun --version`
- Check file permissions: `chmod +x template-storage-architecture-migration-harness.ts`
- Verify test cases file exists: `ls -l /tmp/validation-test-cases.json`

### False Positives
- Check pattern regex syntax in test cases
- Verify file paths are relative to project root
- Review component extraction logic for edge cases

### False Negatives
- Ensure enforcement changes were saved
- Check that code analysis patterns match actual code
- Verify filesystem checks use expanded paths

## Contact

For issues or questions about this validation harness, refer to:
- Specification: Template Storage Architecture Migration
- Trace impulse: `trace-template-storage-architecture-migration`
- Enforcement impulse: `enforcement-template-storage-architecture-migration`
