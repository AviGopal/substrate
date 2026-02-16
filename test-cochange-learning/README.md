# Cochange Learning Test Workspace

This is a minimal test workspace for validating the cochange learning integration.

## Purpose

Validate that activity templates:
1. Predict cochanges early (Task 0)
2. Track accuracy late (Task 3)
3. Send data to backend for learning

## Test Scenarios

### fix-bug-complete
- **Bug**: Null pointer in `getUserProfile`
- **Expected cochanges**: auth-utils.ts, session.ts, users.ts

### add-feature-complete
- **Feature**: User avatar upload
- **Expected cochanges**: storage.ts, validation.ts, users.test.ts

### refactor-component-complete
- **Refactoring**: Extract auth logic from UserService
- **Expected cochanges**: auth-service.ts, user-service.test.ts

## Usage

```bash
# Run test
opencode activity run fix-bug-complete \
  --bug_description="getUserProfile crashes with null user" \
  --affected_files="src/auth.ts"
```

## Verification

Check design document:
```bash
cat BUG_ANALYSIS.md | grep -A 10 "Predicted Cochanges"
```

Check summary document:
```bash
cat BUG_FIX_SUMMARY.md | grep -A 10 "Cochange accuracy"
```
