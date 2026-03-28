# Validate Code Quality Activity Template

## Overview

**ID**: `validate-code-quality`  
**Category**: `tool`  
**Tasks**: 3  
**Metabob Integration**: Enabled  

Comprehensive code quality validation workflow using Metabob tools to search for issues, analyze impact, verify fixes, and annotate components.

## Task Graph

```
search-and-prioritize (Task 1)
    ↓
verify-and-fix (Task 2)
    ↓
annotate-and-document (Task 3)
```

## Tasks

### Task 1: search-and-prioritize
- **Agent**: general
- **Dependencies**: None
- **Token Budget**: 12,000
- **Retry**: 2 attempts (progressive-context)
- **Validation**: 8 required patterns, 6 forbidden patterns
- **Output**: QUALITY_VALIDATION_REPORT.md

**Purpose**: Search for code quality issues using Metabob and create prioritized fix plan

**Key Actions**:
- Call `metabob_get_priority_issues()` for AI-guided priorities
- Call `metabob_search_codebase_issues()` to find specific patterns
- Call `metabob_analyze_change_impact()` to assess dependencies
- Classify issues by severity (HIGH/MEDIUM/LOW)
- Create prioritized fix plan with risk assessment

### Task 2: verify-and-fix
- **Agent**: general
- **Dependencies**: search-and-prioritize
- **Token Budget**: 16,000
- **Retry**: 3 attempts (progressive-context)
- **Validation**: 5 required patterns, 6 forbidden patterns + test commands
- **Output**: Updated QUALITY_VALIDATION_REPORT.md with fix status

**Purpose**: Verify issues and implement fixes with validation

**Key Actions**:
- Read fix plan from QUALITY_VALIDATION_REPORT.md
- Fix HIGH severity issues first
- Call `metabob_analyze_change_impact()` before modifying components
- Call `metabob_mark_problem_complete()` after each fix
- Run tests, typecheck, and linting
- Call `metabob_search_codebase_issues()` to verify no regressions
- Call `metabob_suggest_related_changes()` for co-change patterns

### Task 3: annotate-and-document
- **Agent**: general
- **Dependencies**: verify-and-fix
- **Token Budget**: 14,000
- **Retry**: 2 attempts (progressive-context)
- **Validation**: 9 required patterns, 8 forbidden patterns
- **Output**: QUALITY_IMPROVEMENT_SUMMARY.md

**Purpose**: Annotate fixed components and create quality summary

**Key Actions**:
- Call `metabob_annotate_component()` for 3-5 key components
- Focus annotations on WHY (design decisions), not WHAT
- Document root causes and solutions
- Create prevention recommendations
- Generate metrics and next steps

## Variables

### Optional Variables
- `search_pattern` (string): Specific pattern to search for (e.g., "SQL injection")
- `file_path` (string): Specific file to validate (e.g., "src/auth/login.ts")
- `component_name` (string): Specific component to validate (e.g., "UserService.authenticate")

## Metabob Integration

### Tools Used
1. **metabob_get_priority_issues**: Get AI-guided priorities from work context
2. **metabob_search_codebase_issues**: Search for issues by semantic pattern
3. **metabob_list_file_components**: List components in a file
4. **metabob_analyze_change_impact**: Check dependencies before changes
5. **metabob_mark_problem_complete**: Document fix resolutions
6. **metabob_suggest_related_changes**: Find co-change patterns
7. **metabob_annotate_component**: Document design decisions

### Integration Points
- **Task 1**: Search and prioritize using Metabob
- **Task 2**: Impact analysis and resolution tracking
- **Task 3**: Component annotation for future reference

## Validation Strategy

### Task 1 Validation
- QUALITY_VALIDATION_REPORT.md must exist
- Must contain all required sections
- No placeholders ([count], [Description], etc.)
- Specific file:line locations required
- Severity classification required

### Task 2 Validation
- Fix status section in report
- Resolution documentation for each fix
- No debugging code (console.log, debugger)
- Tests, typecheck, and lint commands run
- No placeholders

### Task 3 Validation
- QUALITY_IMPROVEMENT_SUMMARY.md must exist
- All sections complete with real data
- No placeholders
- Prevention recommendations present
- Next steps documented

## Usage Examples

### Example 1: Security Audit
```typescript
activity({
  activityId: "validate-code-quality",
  variables: {
    search_pattern: "security vulnerabilities OR SQL injection OR XSS"
  },
  reason: "Audit codebase for security issues"
})
```

### Example 2: Component Validation
```typescript
activity({
  activityId: "validate-code-quality",
  variables: {
    file_path: "src/auth/login.ts",
    component_name: "UserService.authenticate"
  },
  reason: "Validate authentication component quality"
})
```

### Example 3: General Quality Sweep
```typescript
activity({
  activityId: "validate-code-quality",
  variables: {},
  reason: "General quality validation sweep"
})
```

## Output Artifacts

1. **QUALITY_VALIDATION_REPORT.md**: Prioritized list of issues with fix plan
2. **QUALITY_IMPROVEMENT_SUMMARY.md**: Summary of fixes, annotations, and metrics
3. **Metabob Annotations**: 3-5 components annotated with design decisions
4. **Resolution Records**: Fixes documented in Metabob

## Success Criteria

- All HIGH severity issues fixed or documented
- No regressions introduced
- All tests pass
- Type checking clean
- 3-5 components annotated
- Prevention recommendations provided
- Complete documentation artifacts

## Self-Validation Results

✓ JSON is valid  
✓ Task count: 3 (within 3-7 range)  
✓ All tasks have validation  
✓ All tasks have retry  
✓ Dependencies form valid DAG  
✓ Token budgets appropriate (12k-16k)  

## Registration

To register this template:

```bash
# Using register_activity_template tool
register_activity_template({
  file_path: "validate-code-quality.json",
  validate_only: false
})
```

Or using CLI:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
# Registration command here
```
