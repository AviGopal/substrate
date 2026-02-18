# fix-bug-complete Activity Template

A comprehensive bug fix workflow with root cause analysis, defensive implementation, regression testing, and Metabob-powered documentation.

## Quick Start

```typescript
activity({
  activityId: "fix-bug-complete",
  variables: {
    bug_description: "Application crashes when user object is null",
    error_message: "TypeError: Cannot read property 'name' of null at getUserProfile (user.ts:45)",
    steps_to_reproduce: "1. Log in\n2. Log out\n3. Navigate to /profile\n4. App crashes",
    affected_files: "src/user.ts, src/routes/profile.ts"
  },
  reason: "Fix null pointer exception in user profile"
})
```

## Template Specs

| Property | Value |
|----------|-------|
| **ID** | `fix-bug-complete` |
| **Category** | `bugfix` |
| **Tasks** | 4 (optimal: 3-5) |
| **Token Budget** | 56,000 tokens |
| **Avg Duration** | ~8-12 minutes |
| **Success Rate** | TBD (new template) |

## Task Flow

```
analyze-and-locate (14K tokens, 3 retries)
    ↓
implement-fix (16K tokens, 4 retries)
    ↓
test-fix (14K tokens, 3 retries)
    ↓
document-and-close (12K tokens, 2 retries)
```

## What You Get

### Task 1: Analysis
- **Output**: `BUG_ANALYSIS.md`
- Root cause identified (file:function:line)
- Similar issues from Metabob search
- Fix approach planned

### Task 2: Implementation
- **Output**: `FIX_IMPLEMENTATION.md` + code changes
- Root cause fixed (not symptoms)
- Defensive measures added (null checks, validation)
- Clean, minimal changes

### Task 3: Testing
- **Output**: Test files + `TEST_RESULTS.md`
- Bug reproduction test
- Edge case coverage
- Regression prevention
- All tests passing

### Task 4: Documentation
- **Output**: `BUG_FIX_SUMMARY.md` + Metabob annotations
- Problem marked complete in Metabob
- Components annotated with fix explanation
- Lessons learned documented
- Prevention measures suggested

## Variables

### Required
- **bug_description** (string): Bug behavior and symptoms

### Optional
- **error_message** (string): Error message or stack trace
- **steps_to_reproduce** (string): Steps to reproduce the bug
- **affected_files** (string): Suspected files (comma-separated)

## Quality Guarantees

### Code Quality
- ✓ No TypeScript errors
- ✓ No `console.log` statements
- ✓ No `any` types
- ✓ No TODO/FIXME/HACK markers
- ✓ Linting passes

### Test Quality
- ✓ All tests pass
- ✓ No skipped tests (it.skip, describe.skip)
- ✓ Bug scenario covered
- ✓ Edge cases tested
- ✓ No regressions

### Documentation
- ✓ Root cause explained
- ✓ Fix rationale documented
- ✓ Metabob annotations added
- ✓ Lessons learned captured
- ✓ No placeholders (TODO, TBD, [description])

## Metabob Integration

### Task 1: Learn from Past
```typescript
metabob_search_codebase_issues({
  query: bug_description,
  limit: 10
})
```
- Finds similar bugs
- Reviews past resolutions
- Identifies patterns

### Task 4: Teach Future
```typescript
metabob_mark_problem_complete({
  problem_id: "issue_xxx",
  file_path: "path/to/file.ext",
  resolution_notes: "Fixed [bug] by [action]. Root cause: [explanation]"
})

metabob_annotate_component({
  file_path: "path/to/file.ext",
  component_name: "functionName",
  component_type: "function",
  reason: "Fixed [bug]. Added [defensive measures]."
})
```

## Retry Strategy

| Task | Attempts | Strategy | Why |
|------|----------|----------|-----|
| analyze-and-locate | 3 | progressive-context | Complex analysis benefits from added context |
| implement-fix | 4 | progressive-context | Most critical, needs extra attempts |
| test-fix | 3 | progressive-context | Testing can be tricky, context helps |
| document-and-close | 2 | simple | Straightforward once work is done |

## Common Use Cases

### Crash Bugs
```typescript
{
  bug_description: "App crashes on user logout",
  error_message: "TypeError: Cannot read property 'name' of null",
  steps_to_reproduce: "1. Logout\n2. Navigate to /profile"
}
```

### Logic Errors
```typescript
{
  bug_description: "Cart total calculates incorrectly with discounts",
  steps_to_reproduce: "1. Add item\n2. Apply 10% coupon\n3. Total shows wrong amount"
}
```

### Data Bugs
```typescript
{
  bug_description: "User preferences not persisting after reload",
  affected_files: "src/storage/preferences.ts"
}
```

### Off-by-One Errors
```typescript
{
  bug_description: "Last item in list not displayed",
  error_message: "RangeError: Index 10 is out of bounds",
  affected_files: "src/components/List.tsx"
}
```

## Validation Checks

All tasks enforce strict validation:

### File Requirements
- Task 1: `BUG_ANALYSIS.md`
- Task 2: `FIX_IMPLEMENTATION.md`
- Task 3: Test files + `TEST_RESULTS.md`
- Task 4: `BUG_FIX_SUMMARY.md`

### Pattern Requirements
- Required patterns ensure completeness
- Forbidden patterns prevent common mistakes
- Commands validate technical correctness

### Example Forbidden Patterns
- `TODO`, `TBD`, `FIXME`, `HACK`
- `console.log()`
- `\bany\b` (TypeScript any type)
- `it.skip`, `describe.skip` (skipped tests)
- `path/to/` (placeholder paths)
- `[description]`, `[explanation]` (placeholder text)

## Integration & Composition

### Standalone
Yes - complete bug fix workflow from analysis to documentation.

### Composes With
- **add-feature-complete**: After fixing bug, add prevention feature
- **refactor-component**: After fix, refactor if code quality is poor

### Pre-checks
- `git status --short` (verify clean or expected state)

### Post-checks
- TypeScript type checking
- Full test suite execution

## Learning & Evolution

Template captures detailed metrics:
- Similar issues found (Metabob effectiveness)
- Root cause accuracy (was fix correct?)
- Code changes (was it minimal?)
- Test coverage (comprehensive?)
- Documentation quality (actionable lessons?)

These metrics inform template evolution over time.

## Files Created

1. **fix-bug-complete.json** - The activity template (30KB)
2. **FIX_BUG_COMPLETE_VALIDATION.md** - Validation report
3. **FIX_BUG_COMPLETE_DIAGRAM.md** - Visual flow diagram
4. **FIX_BUG_COMPLETE_README.md** - This file

## Next Steps

1. **Register**: `register_activity_template({ file_path: "fix-bug-complete.json" })`
2. **Test**: Run on a known bug to validate workflow
3. **Monitor**: Track success rate and metrics
4. **Iterate**: Adjust based on learning data

## Design Philosophy

### Root Cause > Symptoms
Fix why the bug happens, not just where it appears.

### Minimal Changes
Keep the diff small and focused. No unrelated refactoring.

### Defensive Programming
Add checks and validation to prevent similar bugs.

### Test-Driven Fix
Write tests that would have caught the bug, then verify the fix.

### Learn & Document
Capture lessons to prevent similar bugs in the future.

### Metabob-Powered
Use past resolutions to inform current fixes, document fixes for future reference.

---

**Version**: 1.0.0  
**Created**: 2026-02-14  
**Category**: bugfix  
**Genealogy**: Standalone (no parent)
