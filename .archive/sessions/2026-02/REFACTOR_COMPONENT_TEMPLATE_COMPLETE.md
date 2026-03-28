# Refactor Component Complete - Activity Template

## Overview

**Template ID**: `refactor-component-complete`  
**Category**: `refactor`  
**Tasks**: 4 (analyze-impact → implement-refactoring → test-and-validate → document-and-annotate)  
**Status**: ✓ Production Ready

## Purpose

Comprehensive component refactoring workflow with:
- Impact analysis using Metabob dependency tracking
- Incremental implementation with quality gates
- Comprehensive testing and validation
- Full documentation and knowledge capture

## Task Graph

```
analyze-impact (16000 tokens)
    ↓
implement-refactoring (16000 tokens)
    ↓
test-and-validate (14000 tokens)
    ↓
document-and-annotate (12000 tokens)
```

**Total token budget**: 58,000 tokens

## Task Breakdown

### Task 1: analyze-impact
**Agent**: general  
**Tokens**: 16,000  
**Retry**: 3 attempts (progressive-context)

**Responsibilities**:
- Use `metabob_analyze_change_impact` to find all dependents
- Use `metabob_search_codebase_issues` to find existing problems
- Assess risk level (Low/Medium/High/Critical)
- Review current implementation and design intent
- Plan refactoring approach with phases
- Document in REFACTORING_PLAN.md

**Validation**:
- Required: REFACTORING_PLAN.md with all sections
- Must include real dependency counts (no placeholders)
- Must assess concrete risk level
- Must have detailed testing strategy

**Forbidden**:
- TODO, TBD, FIXME placeholders
- Generic placeholders like "X files", "path/to/"

### Task 2: implement-refactoring
**Agent**: general  
**Tokens**: 16,000  
**Retry**: 4 attempts (progressive-context)

**Responsibilities**:
- Follow REFACTORING_PLAN.md phases incrementally
- Fix HIGH priority Metabob issues during refactoring
- Maintain backward compatibility (or provide migration)
- Keep tests passing throughout
- Reduce complexity and improve code quality
- Document in REFACTORING_IMPLEMENTATION.md

**Validation**:
- Required: REFACTORING_IMPLEMENTATION.md
- TypeScript compiles with no errors
- All existing tests pass
- No console.log statements
- No `any` types (or justified)

**Quality Checks**:
- `npm run typecheck` must pass
- `npm test` must pass

### Task 3: test-and-validate
**Agent**: test  
**Tokens**: 14,000  
**Retry**: 3 attempts (progressive-context)

**Responsibilities**:
- Write regression tests (ensure old behavior works)
- Write integration tests (ensure dependents work)
- Test edge cases and error scenarios
- Run full test suite
- Validate TypeScript compilation
- Check code quality metrics
- Document in TEST_VALIDATION_REPORT.md

**Validation**:
- Required: Test files and TEST_VALIDATION_REPORT.md
- All tests must pass (100%)
- No skipped tests (it.skip, describe.skip)
- Validation checklist fully checked

**Quality Checks**:
- `npm test` must pass
- `npm run typecheck` must pass

### Task 4: document-and-annotate
**Agent**: general  
**Tokens**: 12,000  
**Retry**: 2 attempts (simple)

**Responsibilities**:
- Use `metabob_annotate_component` on refactored component
- Use `metabob_mark_problem_complete` for fixed issues
- Use `metabob_suggest_related_changes` for co-change patterns
- Create comprehensive REFACTORING_SUMMARY.md
- Provide migration guide if API changed
- Document lessons learned

**Validation**:
- Required: REFACTORING_SUMMARY.md
- All Metabob annotations must be added
- No placeholders (TODO, TBD, [To be filled])
- Design decisions documented with rationale
- Lessons learned are specific and actionable

## Variables

### Required Variables
1. **file_path** (string): Path to file containing component to refactor
2. **component_name** (string): Name of function/class/component to refactor
3. **refactoring_goal** (string): What to achieve (e.g., "Reduce complexity", "Extract reusable logic")

### Optional Variables
4. **refactoring_reason** (string): Why refactoring is needed (e.g., "Hard to test", "Frequent bugs")

## Metabob Integration

### Tools Used

**Task 1 (analyze-impact)**:
- `metabob_analyze_change_impact` - Find all dependents and impact radius
- `metabob_search_codebase_issues` - Find existing issues in component
- `metabob_list_file_components` - List all components in file

**Task 2 (implement-refactoring)**:
- `metabob_mark_problem_complete` - Mark fixed issues
- `metabob_annotate_component` - Document refactored component

**Task 4 (document-and-annotate)**:
- `metabob_annotate_component` - Final documentation
- `metabob_mark_problem_complete` - Complete issue resolutions
- `metabob_suggest_related_changes` - Find co-change patterns

### Learning Capture

The template captures detailed metrics for continuous improvement:

**Task 1 Metrics**:
- dependency_count: Number of dependent components found
- issues_found: Number of Metabob issues found
- risk_level: Assessed risk level
- metabob_tools_used: Which tools were effective

**Task 2 Metrics**:
- files_changed: Number of files modified
- complexity_reduction: Percentage reduction in complexity
- issues_fixed: Number of Metabob issues resolved
- breaking_changes: Number of breaking API changes

**Task 3 Metrics**:
- tests_added: Number of new tests
- test_pass_rate: Percentage passing (should be 100%)
- dependents_validated: Number validated
- coverage_change: Change in test coverage

**Task 4 Metrics**:
- annotations_added: Number of Metabob annotations
- migration_guide_provided: Was migration guide provided
- related_changes_found: Number of related files
- documentation_completeness: All sections complete

## Example Usage

### Example 1: Refactor Complex Function

```typescript
activity({
  activityId: "refactor-component-complete",
  variables: {
    file_path: "src/services/user-service.ts",
    component_name: "processUserRegistration",
    refactoring_goal: "Reduce complexity by extracting validation, notification, and database logic",
    refactoring_reason: "Function has cyclomatic complexity of 25, hard to test, frequent bugs"
  },
  reason: "Improve maintainability of registration logic"
})
```

**Expected Outcome**:
- Function refactored into 5 smaller functions
- Complexity reduced from 25 to 8
- Test coverage increased
- All dependents still work

### Example 2: Extract Class

```typescript
activity({
  activityId: "refactor-component-complete",
  variables: {
    file_path: "src/controllers/api-controller.ts",
    component_name: "ApiController",
    refactoring_goal: "Extract authentication, validation, and response formatting into separate classes",
    refactoring_reason: "800 lines, violates single responsibility, difficult to maintain"
  },
  reason: "Apply single responsibility principle"
})
```

**Expected Outcome**:
- ApiController split into 4 focused classes
- Each class under 200 lines
- Improved testability
- Clear separation of concerns

## Quality Gates

### Pre-Checks
- `git status --short` - Show current changes

### Post-Checks
- `npm run typecheck || tsc --noEmit` - TypeScript validation
- `npm test` - All tests must pass

### Quality Gates
1. **no-typescript-errors**: TypeScript must compile cleanly
2. **tests-passing**: All tests must pass

## Composition

### Standalone
✓ Yes - Can be used independently

### Composes With

**Follow-up**: `add-feature-complete`
- After refactoring, add new features leveraging improved architecture
- Example: "Refactor user service for extensibility, then add new user features"

**Prerequisite**: `fix-bug-complete`
- Fix critical bugs before refactoring to understand issues
- Example: "Fix critical bugs, then refactor to prevent similar issues"

## Success Criteria

### Overall Success
- ✓ All 4 tasks complete successfully
- ✓ TypeScript compiles with no errors
- ✓ All tests passing (100%)
- ✓ Code quality metrics improved
- ✓ All dependents validated and working
- ✓ Comprehensive documentation created

### Quality Improvements
- ✓ Cyclomatic complexity reduced
- ✓ Code duplication eliminated
- ✓ Type safety improved (no `any` types)
- ✓ Test coverage maintained or improved
- ✓ HIGH priority Metabob issues resolved

### Documentation Complete
- ✓ REFACTORING_PLAN.md
- ✓ REFACTORING_IMPLEMENTATION.md
- ✓ TEST_VALIDATION_REPORT.md
- ✓ REFACTORING_SUMMARY.md
- ✓ Migration guide (if API changed)
- ✓ Metabob annotations added

## Validation Report

### ✓ All Self-Validation Checks Passed

1. **JSON Syntax**: ✓ Valid
2. **Task Count**: ✓ 4 tasks (within 3-7 range, preferred 3-5)
3. **Task Dependencies**: ✓ Linear graph matches design
4. **Validation Config**: ✓ All tasks have requiredFiles, patterns, commands
5. **Retry Config**: ✓ All tasks have maxAttempts, strategy, fallback
6. **Token Budget**: ✓ All within 8000-16000 range (12K-16K)
7. **Schema Compliance**: ✓ All required fields present
8. **Variables**: ✓ Properly defined with descriptions
9. **Metabob Integration**: ✓ 6 Metabob tools used across tasks
10. **Documentation**: ✓ All 4 required documents specified

## Files Created

1. **refactor-component-complete.json** - Complete ActivityTemplate
2. **REFACTOR_COMPONENT_TEMPLATE_COMPLETE.md** - This documentation

## Next Steps

### To Use This Template

```bash
# Register the template
opencode activity register refactor-component-complete.json

# Use the template
opencode activity run refactor-component-complete \
  --file_path "src/services/auth.ts" \
  --component_name "authenticateUser" \
  --refactoring_goal "Extract validation and token generation" \
  --refactoring_reason "Function is 200 lines, hard to test"
```

### To Test This Template

```bash
# Test with a real component
opencode activity run refactor-component-complete \
  --file_path "repos/metabob-opencode/packages/opencode/src/utils/helpers.ts" \
  --component_name "processFileContent" \
  --refactoring_goal "Extract file reading, parsing, and transformation logic"
```

## Related Documentation

- **TASK_GRAPH_DESIGN.md** - Original task graph design
- **ActivityTemplate.CreateOptions** - Schema specification
- **add-rest-endpoint-v2.json** - Reference example template
- **fix-bug-complete.json** - Reference bugfix template

## Template Metadata

- **Created**: 2024-02-15
- **Version**: 1.0.0
- **Generation**: 1
- **Author**: TEMPLATE_AUTHOR_HUMAN
- **Evolution**: EVOLUTION_REASON_MANUAL
- **Status**: Production Ready ✓
