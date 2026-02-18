# fix-bug-complete.json Template Validation Report

## ✓ Self-Validation Results

### JSON Structure
- ✓ Valid JSON syntax
- ✓ Conforms to ActivityTemplate.CreateOptions schema

### Task Configuration
- **Task Count**: 4 (within 3-7 range, prefer 3-5 ✓)
- **All tasks have validation**: true ✓
- **All tasks have retry**: true ✓

### Task Details

| Task ID | Max Tokens | Retry Attempts | Retry Strategy | Required Files | Validation Patterns |
|---------|-----------|----------------|----------------|----------------|---------------------|
| analyze-and-locate | 14,000 | 3 | progressive-context | BUG_ANALYSIS.md | 5 required, 5 forbidden |
| implement-fix | 16,000 | 4 | progressive-context | FIX_IMPLEMENTATION.md | 4 required, 6 forbidden |
| test-fix | 14,000 | 3 | progressive-context | Test files + TEST_RESULTS.md | 6 required, 6 forbidden |
| document-and-close | 12,000 | 2 | simple | BUG_FIX_SUMMARY.md | 6 required, 6 forbidden |

**Total Token Budget**: 56,000 tokens

### Task Dependencies (Graph)

```
analyze-and-locate (root)
    ↓
implement-fix
    ↓
test-fix
    ↓
document-and-close
```

**Dependency Chain**: Linear (sequential) - matches requirements ✓

### Validation Patterns

#### Task 1: analyze-and-locate
**Required**:
- `## Bug Analysis`
- `### Root Cause`
- `\*\*File\*\*:`
- `\*\*Why it happens\*\*:`
- `### Fix Approach`

**Forbidden**:
- `TODO`, `TBD`, `FIXME`, `path/to/`, `PLACEHOLDER`

#### Task 2: implement-fix
**Required**:
- `## Fix Implementation`
- `### Files Modified`
- `### Changes Made`
- `### Root Cause Addressed`

**Forbidden**:
- `console\.log\(`, `\bany\b`, `TODO`, `FIXME`, `HACK`, `PLACEHOLDER`

#### Task 3: test-fix
**Required**:
- `describe\(`, `it\(`, `expect\(`
- `## Test Results`
- `### New Tests Added`
- `✓` (checkmark)

**Forbidden**:
- `it\.skip`, `describe\.skip`, `xit\(`, `xdescribe\(`, `TODO in test`, `FIXME`

#### Task 4: document-and-close
**Required**:
- `## Bug Fix Summary`
- `### Root Cause`
- `### Fix Applied`
- `### Testing`
- `### Lessons Learned`
- `### Verification Checklist`

**Forbidden**:
- `TODO`, `TBD`, `FIXME`, `PLACEHOLDER`, `\[description\]`, `\[explanation\]`

### Retry Configuration

| Task | Max Attempts | Strategy | Fallback Prompt |
|------|-------------|----------|-----------------|
| analyze-and-locate | 3 | progressive-context | ✓ Detailed guidance |
| implement-fix | 4 | progressive-context | ✓ Common issues addressed |
| test-fix | 3 | progressive-context | ✓ Testing checklist |
| document-and-close | 2 | simple | ✓ Documentation requirements |

### Integration Configuration

**Pre-checks**:
- `git status --short`

**Post-checks**:
- TypeScript type checking
- Test suite execution

**Quality Gates**:
- No TypeScript errors

### Metabob Integration

- ✓ Enabled for learning
- ✓ Target context: 5000 tokens
- ✓ Annotation strategy: key-components
- ✓ Uses `metabob_search_codebase_issues` in task 1
- ✓ Uses `metabob_mark_problem_complete` in task 4
- ✓ Uses `metabob_annotate_component` in task 4

### Template Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| bug_description | string | Yes | Bug behavior and symptoms |
| error_message | string | No | Error message or stack trace |
| steps_to_reproduce | string | No | Steps to reproduce |
| affected_files | string | No | Suspected files (comma-separated) |

### Examples Provided

1. **Null Pointer Exception Fix** - Complete workflow example
2. **Off-by-One Array Bug** - Edge case example

### Composition

**Standalone**: Yes ✓

**Composes with**:
- `add-feature-complete` (complement)
- `refactor-component` (follow-up)

### Learning Configuration

- ✓ Enabled with detailed capture strategy
- ✓ 4 feedback points (one per task)
- ✓ Metrics tracked per task
- ✓ Improvement hints provided

## ✓ All Validation Checks Passed

The template is ready for registration and use.

## Template Features

### Comprehensive Bug Fix Workflow
1. **Analysis Phase**: Search for similar issues, identify root cause
2. **Implementation Phase**: Fix root cause with minimal changes
3. **Testing Phase**: Regression tests + verification
4. **Documentation Phase**: Metabob annotations + summary

### Defensive Design
- Progressive context retry strategies
- Comprehensive validation patterns
- Forbidden patterns prevent common mistakes
- Token budgets appropriate per task (12K-16K)

### Metabob Integration
- Searches for similar issues at start
- Marks problems complete at end
- Annotates fixed components
- Learns from past fixes

### Quality Assurance
- TypeScript checking
- Test execution
- No debug code (console.log forbidden)
- No skipped tests
- Complete documentation required

## Usage Example

```typescript
activity({
  activityId: "fix-bug-complete",
  variables: {
    bug_description: "App crashes when user is null",
    error_message: "TypeError: Cannot read property 'name' of null",
    steps_to_reproduce: "1. Logout\n2. Navigate to /profile\n3. Crash",
    affected_files: "src/user.ts"
  },
  reason: "Fix null pointer crash in user profile"
})
```

## Next Steps

1. Register template: `register_activity_template({ file_path: "fix-bug-complete.json" })`
2. Test with real bug fix
3. Monitor execution and adjust based on learning data
