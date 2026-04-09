# camelCase Enforcement for Template Generation

## Summary

Updated MiniBob's template generation and validation code to consistently produce and enforce camelCase field names instead of snake_case. This ensures all generated templates match the TypeScript type definitions and backend API expectations.

## Changes Made

### 1. Fixed `cli/doctor/fix.ts` (Lines 327-340)

**BEFORE:** Incorrectly converted camelCase TO snake_case
```typescript
// Fix retry field naming (camelCase to snake_case)
if (task.retry) {
  const retry = task.retry
  if (retry.maxAttempts !== undefined && retry.max_attempts === undefined) {
    retry.max_attempts = retry.maxAttempts  // WRONG DIRECTION
    delete retry.maxAttempts
  }
}
```

**AFTER:** Correctly converts snake_case TO camelCase
```typescript
// Fix retry field naming (snake_case to camelCase)
if (task.retry) {
  const retry = task.retry as any
  if (retry.max_attempts !== undefined && retry.maxAttempts === undefined) {
    retry.maxAttempts = retry.max_attempts  // CORRECT DIRECTION
    delete retry.max_attempts
  }
}

// Also added fixes for:
// - prompt.maxTokens (from max_tokens)
// - prompt.compressionStrategy (from compression_strategy)
// - validation.requiredFiles (from required_files)
// - validation.requiredPatterns (from required_patterns)
// - validation.forbiddenPatterns (from forbidden_patterns)
```

### 2. Updated `cli/doctor/validation.ts` (Lines 148-156)

**BEFORE:** Error messages referenced snake_case field names
```typescript
const maxAttempts = task.retry.max_attempts ?? task.retry.maxAttempts
// ...
field: `${taskPath}.retry.max_attempts`,  // WRONG
message: `Task ${index + 1}: retry.max_attempts must be...`  // WRONG
```

**AFTER:** Error messages reference camelCase field names
```typescript
const maxAttempts = task.retry.maxAttempts ?? (task.retry as any).max_attempts
// ...
field: `${taskPath}.retry.maxAttempts`,  // CORRECT
message: `Task ${index + 1}: retry.maxAttempts must be...`  // CORRECT
```

### 3. Enhanced `schema-validator.ts` (Line 26)

Added missing field to the snake_case detection map:
```typescript
const SNAKE_CASE_FIELDS: Record<string, string> = {
  // ... existing fields ...
  compression_strategy: "compressionStrategy",  // ADDED
}
```

### 4. Added Validation to `template-generator.ts`

Imported schema validator:
```typescript
import { assertValidTemplate } from "./schema-validator"
```

Added validation before returning template (Line 538-540):
```typescript
// Validate template before returning (catch snake_case early)
assertValidTemplate(template)

return template
```

Fixed type error (Line 516):
```typescript
generatedFrom: "execution" as const,  // Added 'as const' for literal type
```

### 5. Added Validation to `template-extractor.ts`

Imported schema validator and added validation calls in:
- `extractTemplateFromImprovisation()` (Line 88-90)
- `extractAttemptTemplate()` (Line 547-549)

Both now validate templates before returning:
```typescript
// Validate template before returning (catch snake_case early)
assertValidTemplate(template)

return template
```

## Field Name Mappings

All template generation now enforces these camelCase field names:

| snake_case (WRONG)        | camelCase (CORRECT)      |
|---------------------------|--------------------------|
| `max_tokens`              | `maxTokens`              |
| `compression_strategy`    | `compressionStrategy`    |
| `max_attempts`            | `maxAttempts`            |
| `required_files`          | `requiredFiles`          |
| `required_patterns`       | `requiredPatterns`       |
| `forbidden_patterns`      | `forbiddenPatterns`      |

## Validation Flow

1. **Template Generation**: `template-generator.ts` and `template-extractor.ts` now call `assertValidTemplate()` before returning
2. **Early Detection**: Schema validator catches snake_case fields immediately with helpful error messages
3. **Auto-Correction**: `cli/doctor/fix.ts` can auto-correct existing templates with snake_case fields
4. **Type Safety**: TypeScript types already enforce camelCase at compile time

## Testing

Created comprehensive test suite in `test/template-camelcase.test.ts`:

- ✅ Verifies generated templates use camelCase
- ✅ Confirms no snake_case fields in output
- ✅ Tests schema validator catches snake_case errors
- ✅ Validates correct camelCase templates pass validation

All tests pass:
```
 3 pass
 0 fail
 30 expect() calls
```

## Migration Path for Existing Templates

If you have templates with snake_case fields, use the doctor command:

```bash
cd repos/minibob
bun run src/cli/doctor/check.ts path/to/template.json
bun run src/cli/doctor/fix.ts path/to/template.json
```

The fix command will automatically convert all snake_case fields to camelCase.

## Impact

- **Template Generation**: All newly generated templates use camelCase consistently
- **Validation**: Early detection prevents snake_case fields from reaching the backend
- **Backward Compatibility**: MCP compatibility shims in `mcp.ts` still accept both forms (read-only)
- **Error Messages**: Clear guidance when snake_case fields are detected

## Files Modified

1. `repos/minibob/src/template-generator.ts` - Added validation, fixed type error
2. `repos/minibob/src/template-extractor.ts` - Added validation
3. `repos/minibob/src/schema-validator.ts` - Added compression_strategy mapping
4. `repos/minibob/src/cli/doctor/fix.ts` - Fixed conversion direction, added all field conversions
5. `repos/minibob/src/cli/doctor/validation.ts` - Updated error messages to camelCase
6. `repos/minibob/test/template-camelcase.test.ts` - New comprehensive test suite

## Future Work

Consider:
- Deprecating snake_case compatibility shims in `mcp.ts` after migration period
- Adding linter rules to catch snake_case in template JSON files
- Backend API validation to reject snake_case templates
