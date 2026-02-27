# Validation Test Case 4: Multiple Type Errors

## Purpose
Verify that the pre-push hook correctly handles multiple TypeScript type errors in a single file.

## Input
```json
{
  "testCase": "case-4-multiple-errors",
  "repository": "metabob-dashboard",
  "scenario": "type-error",
  "errorCode": "const a: number = \"string\";\nconst b: string = 123;\nconst c: boolean = \"not a boolean\";\n\nfunction wrong(x: number): string {\n  return x;\n}\n\nclass BadClass {\n  prop: number = \"not a number\";\n}"
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
1. Create test repository with multiple intentional type errors (5+ errors)
2. Attempt to push changes
3. Verify pre-push hook executes
4. Verify typecheck detects all errors
5. Confirm push is blocked
6. Verify error messages list all detected issues

## Business Impact
This test ensures that complex files with multiple issues are properly validated, preventing batches of bugs from reaching production.
