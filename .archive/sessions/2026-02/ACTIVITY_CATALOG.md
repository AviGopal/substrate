# Activity Catalog

**Last Updated**: February 12, 2026  
**Status**: Active Templates Ready for Use

---

## Quick Reference

| Activity | Category | Duration | Cost | When to Use |
|----------|----------|----------|------|-------------|
| **add-rest-endpoint** | feature | ~3 min | $0.25 | Adding REST API endpoints |
| **fix-security-bug** | bugfix | ~4 min | $0.30 | Fixing security vulnerabilities |
| **safe-refactor** | refactor | ~5 min | $0.35 | Refactoring with change impact analysis |
| **activity-create-v2** | infrastructure | ~5 min | $0.35 | Creating new activity templates |
| **jiggle-documentation** | refactor | ~4 min | $0.30 | Organizing and cleaning docs |

---

## Feature Activities

### add-rest-endpoint-v1

**Add REST API endpoints with validation, error handling, and tests**

**Use When**:
- Adding new API endpoints
- Creating REST routes
- Need automatic validation and testing

**What It Does**:
1. Analyzes existing API patterns in your codebase
2. Checks change impact using Metabob
3. Implements endpoint with proper validation
4. Writes comprehensive tests (happy path, validation, errors, auth)
5. Runs tests to verify
6. Documents the endpoint

**Usage**:
```javascript
activity({
  activityId: "add-rest-endpoint-v1",
  variables: {
    method: "POST",
    path: "/api/users",
    description: "Create a new user account",
    request_schema: {
      name: "string",
      email: "string",
      password: "string"
    },
    response_schema: {
      id: "string",
      name: "string",
      email: "string",
      created_at: "datetime"
    }
  },
  reason: "Add user registration endpoint"
})
```

**Expected Outcome**:
- New endpoint implemented following codebase patterns
- Request/response validation added
- Error handling (400, 404, 500)
- Comprehensive test coverage
- API documentation updated
- Metabob annotation added

**Metabob Integration**:
- `metabob_analyze_change_impact` - Check dependencies
- `metabob_suggest_related_changes` - Find related files
- `metabob_annotate_component` - Document design decisions

---

## Bugfix Activities

### fix-security-bug-v1

**Fix security vulnerabilities with root cause analysis and prevention**

**Use When**:
- Security vulnerability identified
- SQL injection, XSS, CSRF, auth bypass, etc.
- Need comprehensive fix with prevention

**What It Does**:
1. Searches for similar security issues using Metabob
2. Analyzes root cause (the WHY)
3. Implements security fix following best practices
4. Checks for similar vulnerable patterns elsewhere
5. Writes attack vector and regression tests
6. Runs security tests to verify fix
7. Documents fix and prevention measures

**Usage**:
```javascript
activity({
  activityId: "fix-security-bug-v1",
  variables: {
    vulnerability_type: "SQL injection",
    affected_file: "src/database/users.ts",
    affected_component: "getUserByEmail",
    severity: "high"
  },
  reason: "Fix SQL injection in user lookup"
})
```

**Expected Outcome**:
- Vulnerability fixed using best practices (parameterized queries, escaping, etc.)
- Similar patterns identified and fixed
- Attack vector tests added
- Regression tests prevent future issues
- Root cause documented
- Prevention recommendations provided

**Metabob Integration**:
- `metabob_search_codebase_issues` - Find similar security issues
- `metabob_list_file_components` - Get exact component names
- `metabob_annotate_component` - Document security fix
- `metabob_mark_problem_complete` - Mark issue resolved

**Security Types Supported**:
- SQL Injection - Parameterized queries
- XSS - Output escaping, CSP headers
- CSRF - Token validation, SameSite cookies
- Auth Bypass - Proper auth/authz checks
- General - Input validation, principle of least privilege

---

## Refactor Activities

### safe-refactor-v1

**Refactor code safely with change impact analysis and testing**

**Use When**:
- Code needs refactoring
- Improving readability, performance, or maintainability
- Want to avoid breaking changes

**What It Does**:
1. Analyzes change impact using Metabob (dependency count, risk)
2. Identifies files that co-change with the target
3. Reads and analyzes current implementation
4. Creates incremental refactoring plan (3-7 steps)
5. Executes refactoring step by step (testing after each)
6. Updates dependent files
7. Runs full test suite
8. Documents refactoring with Metabob annotation

**Usage**:
```javascript
activity({
  activityId: "safe-refactor-v1",
  variables: {
    target_file: "src/auth/authentication.ts",
    target_component: "validateToken",  // optional
    refactor_goal: "improve readability and reduce complexity",
    refactor_type: "extract functions and simplify logic"
  },
  reason: "Simplify authentication logic"
})
```

**Expected Outcome**:
- Code refactored following best practices
- All tests still pass (no regressions)
- Dependent files updated
- Change impact assessed (risk: high/medium/low)
- Co-change patterns identified
- Improvements quantified (if possible)
- Refactoring documented

**Metabob Integration**:
- `metabob_list_file_components` - Get exact component names
- `metabob_analyze_change_impact` - Assess risk (dependency count, depth)
- `metabob_assess_deletion_safety` - Check if code can be removed
- `metabob_suggest_related_changes` - Find co-change patterns
- `metabob_annotate_component` - Document refactoring decisions

**Refactor Types Supported**:
- Extract function - Pull out duplicated/complex code
- Simplify logic - Reduce nesting, early returns
- Rename - Improve naming clarity
- Performance - Optimize algorithms
- General improvement - Multiple refactorings

---

## Infrastructure Activities

### activity-create-v2

**Create, validate, test, and register new activity templates**

**Use When**:
- Creating new activity templates
- Formalizing successful interaction patterns
- Self-hosting (creating activities via activities)

**What It Does**:
1. Identifies interaction pattern to formalize
2. Defines activity scope and success criteria
3. Designs task steps with dependencies
4. Creates activity JSON following schema
5. Validates schema using `register_activity_template`
6. Test executes the template
7. Creates template summary documentation

**Usage**:
```javascript
activity({
  activityId: "activity-create-v2",
  variables: {
    source_pattern: "Pattern of analyzing code, making changes, testing",
    activity_name: "Deploy to Production",
    activity_id: "deploy-production-v1",
    target_category: "infrastructure",
    test_variables: {
      environment: "staging"
    }
  },
  reason: "Formalize deployment workflow as activity"
})
```

**Expected Outcome**:
- New activity template created
- Schema validated (passes V2 schema checks)
- Template tested with dummy data
- Template registered to backend
- Summary documentation created
- Ready for use

---

### jiggle-documentation

**Systematically organize, update, and clean documentation**

**Use When**:
- Documentation is disorganized
- Old docs need cleanup
- Want to percolate recent info backwards

**What It Does**:
- Analyzes docs by modification date
- Identifies obsolete candidates
- Percolates recent info backwards
- Deletes outdated docs
- Creates consolidated docs

**Usage**:
```javascript
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    recentDays: 30,
    mediumDays: 90,
    obsoleteDays: 180
  },
  reason: "Clean up project documentation"
})
```

---

## Deprecated Templates (Do Not Use)

### ⚠️ activity-create.json (V1)
**Superseded by**: activity-create-v2.json  
**Reason**: V1 schema, missing features

### ⚠️ activity-debug.json (V1)
**Superseded by**: `activity_error_inspector` tool  
**Reason**: Tool provides better diagnostics

### ⚠️ bug-fix.json (V1)
**Superseded by**: fix-security-bug-v1 (for security) or enhance for general bugs  
**Reason**: V1 schema, less comprehensive

### ⚠️ code-analysis.json (V1)
**Superseded by**: Metabob tools (`metabob_search_codebase_issues`)  
**Reason**: Direct tool usage is more flexible

### ⚠️ refactor.json (V1)
**Superseded by**: safe-refactor-v1  
**Reason**: V1 schema, missing change impact analysis

### ⚠️ boredom-task-processor.json (V1)
**Reason**: Experimental, not production-ready

---

## Pending Templates (Coming Soon)

### feature-impl-v2 (In Development)
General feature implementation workflow
- Migrating from V1 to V2 schema
- Adding Metabob integration

### activity-evolve-v2 (In Development)
Variant evolution from successful executions
- Critical for Phase 3 (self-improvement)
- Migrating from V1 to V2 schema

### bug-fix-general-v1 (Planned)
General bug fixes (non-security)
- Based on bug-fix.json
- Full V2 schema with Metabob integration

---

## Template Selection Guide

### Adding Functionality
→ Use **add-rest-endpoint** for API endpoints  
→ Use **feature-impl-v2** (coming soon) for general features

### Fixing Issues
→ Use **fix-security-bug** for security vulnerabilities  
→ Use **bug-fix-general** (coming soon) for general bugs

### Improving Code
→ Use **safe-refactor** for code improvements  
→ Use **jiggle-documentation** for doc cleanup

### Meta (Creating Activities)
→ Use **activity-create-v2** to create new templates  
→ Use **activity-evolve** (coming soon) for variant evolution

---

## Understanding Activity Output

All activities create markdown files documenting their work:

### Common Output Files
- `*_ANALYSIS.md` - Analysis and findings
- `*_PLAN.md` - Execution plan
- `*_IMPLEMENTATION.md` - What was implemented
- `*_LOG.md` - Step-by-step execution log
- `*_RESULTS.md` - Test results and outcomes
- `*_SUMMARY.md` - Final summary and metrics

### Reading Activity Results
1. Check for ✅ or ❌ in activity output
2. Read SUMMARY file for quick overview
3. Review LOG file for detailed execution
4. Check RESULTS file for test outcomes
5. Use Metabob annotations for long-term context

---

## Best Practices

### When Using Activities

1. **Provide Context**: Give clear descriptions and requirements
2. **Review Output**: Always review generated code and tests
3. **Check Tests**: Ensure tests pass before committing
4. **Use Metabob**: Let activities use Metabob tools for better quality
5. **Iterate**: If activity fails, review error and retry with adjusted variables

### Variable Guidelines

- **Be Specific**: "Add user registration with email validation" > "Add user stuff"
- **Provide Schemas**: Include request/response schemas when known
- **Set Expectations**: Use severity, refactor_goal, etc. to guide behavior
- **Use Defaults**: Many variables have sensible defaults

### When NOT to Use Activities

- **Exploration**: Activities are for known patterns, not open-ended exploration
- **Very Simple Tasks**: One-liner changes are faster manually
- **Unique Situations**: Activities work best for common patterns
- **Learning**: If you want to understand the code deeply, do it manually first

---

## Getting Help

### Activity Fails
1. Check `ACTIVITY_EXECUTION_GUIDE.md` for troubleshooting
2. Use `activity_error_inspector` tool to diagnose
3. Review validation errors carefully
4. Adjust variables and retry

### Template Doesn't Fit
1. Check if another template is better
2. Modify variables to guide behavior
3. Consider creating custom template via `activity-create-v2`

### Report Issues
- File issues at project repository
- Include activity ID, variables, and error message
- Attach relevant output files

---

## Advanced Usage

### Chaining Activities

```javascript
// Create endpoint
activity({
  activityId: "add-rest-endpoint-v1",
  variables: { method: "POST", path: "/api/users", ... },
  reason: "Add user endpoint"
})

// Then refactor for performance
activity({
  activityId: "safe-refactor-v1",
  variables: {
    target_file: "src/api/users.ts",
    refactor_goal: "optimize database queries",
    refactor_type: "performance"
  },
  reason: "Optimize new endpoint"
})
```

### Custom Variables

Many templates accept optional variables for customization:
- `severity` - Control priority (critical, high, medium, low)
- `refactor_type` - Guide refactoring approach
- `test_variables` - Provide test data
- `request_schema` / `response_schema` - Define API contracts

### Metabob Integration

All activities integrate with Metabob:
- **Search**: Find similar issues before starting
- **Impact**: Analyze change impact before modifying
- **Annotate**: Document design decisions for future
- **Mark Complete**: Track issue resolution

---

**Need More Templates?**

Use `activity-create-v2` to formalize your own successful interaction patterns into reusable templates!

---

**Feedback & Contributions**

Help improve activities:
- Report bugs and failures
- Suggest new templates
- Share successful patterns
- Contribute template enhancements

---

*For technical details, see ACTIVITY_EVOLUTION_EXECUTION_REPORT.md*  
*For system architecture, see EVOLUTION_TARGET_STATE.md*  
*For troubleshooting, see ACTIVITY_EXECUTION_GUIDE.md*
