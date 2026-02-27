# Validation Test Case 6: Clear Error Messages

## Purpose
Verify that the pre-push hook provides clear, actionable error messages with file paths and error descriptions.

## Input
```json
{
  "testCase": "case-6-clear-messages",
  "repository": "metabob-opencode",
  "scenario": "type-error",
  "errorCode": "const missingType = \"inferred\";\nconst typeMismatch: number = \"string\";\nexport { missingType, typeMismatch };"
}
```

## Expected Output
```json
{
  "hookExecuted": true,
  "typecheckRan": true,
  "errorsDetected": true,
  "pushBlocked": true,
  "exitCode": 1,
  "errorMessage": "Type checking failed with TypeScript errors",
  "executionTime": 5000
}
```

## Validation Logic
1. Create test repository with simple type errors
2. Attempt to push changes
3. Verify pre-push hook executes
4. Verify error message includes:
   - File path (src/index.ts)
   - Line number
   - Error description
   - Bypass instructions (git push --no-verify)
5. Confirm error output is human-readable and actionable

## Business Impact
This test ensures developers receive clear feedback on what went wrong and how to fix it, reducing debugging time.
