# Activity Template Usage Guide
**Quick reference for using production templates**

---

## How to Use Templates

### 1. Search for Templates
```javascript
search_activities({ 
  query: "feature implementation",
  category: "feature",
  verbose: true 
})
```

### 2. Execute Template
```javascript
activity({
  activityId: "template-id-here",
  variables: {
    // Required and optional variables
  },
  reason: "Clear explanation of why this work is needed"
})
```

---

## Production Templates Quick Reference

### Fixing Bugs 🐛

**Template**: `bugfix-747eac05` - Fix Bug Complete  
**When**: You have a reported bug or issue  
**Time**: ~20-30 minutes  
**Cost**: ~$0.03-0.05

```javascript
activity({
  activityId: "bugfix-747eac05",
  variables: {
    bug_description: "Application crashes when user clicks logout button while on profile page",
    error_message: "TypeError: Cannot read property 'name' of null at getUserProfile (user.ts:45)",  // optional
    steps_to_reproduce: "1. Log in\n2. Navigate to profile\n3. Click logout\n4. App crashes",  // optional
    affected_files: "src/user.ts, src/components/Profile.tsx"  // optional
  },
  reason: "Fix critical logout crash affecting production users"
})
```

**What it does**:
1. ✅ Searches for similar bugs with Metabob
2. ✅ Analyzes root cause (not just symptoms)
3. ✅ Implements minimal focused fix
4. ✅ Writes regression tests + edge cases
5. ✅ Annotates fixed components with Metabob
6. ✅ Creates comprehensive bug fix summary

**Output Files**:
- `BUG_ANALYSIS.md` - Root cause and similar issues
- `FIX_IMPLEMENTATION.md` - What changed and why
- `TEST_RESULTS.md` - Test coverage and results
- `BUG_FIX_SUMMARY.md` - Complete summary

---

### Adding Features ✨

#### Option A: General Feature (Broad)

**Template**: `feature-4fd97715` - Add Feature Complete  
**When**: Implementing any new feature  
**Time**: ~30-40 minutes  
**Cost**: ~$0.04-0.06

```javascript
activity({
  activityId: "feature-4fd97715",
  variables: {
    feature_name: "User Avatar Upload",
    feature_description: "Allow users to upload profile pictures with validation and storage",
    requirements: "Max 5MB, jpg/png/webp only, store in /uploads/avatars/",  // optional
    acceptance_criteria: "Users can upload, preview, and save avatars. Invalid files show clear error messages."  // optional
  },
  reason: "Users have requested ability to customize profile pictures"
})
```

**What it does**:
1. ✅ Analyzes codebase patterns for similar features
2. ✅ Designs feature architecture
3. ✅ Implements with proper types and error handling
4. ✅ Writes unit + integration tests
5. ✅ Creates documentation
6. ✅ Annotates components with Metabob

**Output Files**:
- `FEATURE_DESIGN.md` - Architecture and patterns
- `FEATURE_IMPLEMENTATION.md` - Implementation details
- `TEST_RESULTS.md` - Test coverage
- `FEATURE_DOCUMENTATION.md` - User-facing docs

#### Option B: REST Endpoint (Specialized)

**Template**: `feature-fdb6afae` - Add REST Endpoint V2  
**When**: Adding REST API endpoints specifically  
**Time**: ~15-25 minutes (faster!)  
**Cost**: ~$0.02-0.04

```javascript
activity({
  activityId: "feature-fdb6afae",
  variables: {
    endpoint_description: "Retrieve user profile information by user ID",
    endpoint_path: "/api/users/:id/profile",
    http_method: "GET",
    request_schema: "{}",  // optional - for POST/PUT/PATCH
    response_schema: "{ id: number, name: string, email: string, avatar: string | null }"  // optional
  },
  reason: "Frontend needs API to fetch user profile data"
})
```

**What it does**:
1. ✅ Designs endpoint schema and handler
2. ✅ Implements with validation
3. ✅ Writes API tests (unit + integration + E2E)

**Output Files**:
- `ENDPOINT_DESIGN.md` - Schema and handler design
- `ENDPOINT_IMPLEMENTATION.md` - Implementation notes
- `API_TEST_RESULTS.md` - Test results

**Choose this when**: You're adding REST API endpoints and want faster execution.

---

### Refactoring Code ♻️

**Template**: `refactor-364e6dac` - Refactor Component Complete  
**When**: Code needs improvement (complexity, maintainability, performance)  
**Time**: ~35-50 minutes  
**Cost**: ~$0.05-0.08

```javascript
activity({
  activityId: "refactor-364e6dac",
  variables: {
    file_path: "src/services/authentication.ts",
    component_name: "AuthService.validateUser",
    refactoring_goal: "Reduce complexity from cyclomatic complexity 25 to < 10",
    refactoring_reason: "Method is hard to test and has multiple bugs. Needs simplification."  // optional
  },
  reason: "Authentication logic is overly complex and causing maintenance issues"
})
```

**What it does**:
1. ✅ Analyzes change impact with `metabob_analyze_change_impact`
2. ✅ Assesses risk level (Low/Medium/High/Critical)
3. ✅ Lists all dependent components
4. ✅ Implements incremental refactoring
5. ✅ Ensures no regressions
6. ✅ Documents improvements

**Output Files**:
- `REFACTORING_PLAN.md` - Impact analysis and strategy
- `REFACTORING_IMPLEMENTATION.md` - Changes made
- `REFACTORING_TESTS.md` - Regression test results
- `REFACTORING_SUMMARY.md` - Complete summary

**Risk Assessment**:
- **Low**: 0-5 direct dependents
- **Medium**: 6-15 direct dependents
- **High**: 16+ direct dependents
- **Critical**: Core infrastructure

---

### Creating Templates 🏗️

**Template**: `infrastructure-780003ca` - Create Activity Template  
**When**: Building new reusable workflows  
**Time**: ~10-15 minutes  
**Cost**: ~$0.01-0.02

```javascript
activity({
  activityId: "infrastructure-780003ca",
  variables: {
    templateName: "Deploy Application",  // optional
    templateId: "deploy-app-complete",   // optional
    category: "infrastructure"           // optional
  },
  reason: "Create reusable deployment workflow template"
})
```

**What it does**:
1. ✅ Studies high-quality example templates
2. ✅ Designs task dependency graph
3. ✅ Writes ActivityTemplate JSON
4. ✅ Registers with Metabob backend
5. ✅ Verifies template is discoverable

**Output Files**:
- Task graph visualization
- Complete ActivityTemplate JSON
- Registration confirmation

**Self-hosting**: This template can create more templates! 🔄

---

## Template Selection Decision Tree

```
Need to do work?
│
├─ Fixing a bug? → Use `bugfix-747eac05`
│
├─ Adding new functionality?
│  │
│  ├─ REST API endpoint? → Use `feature-fdb6afae` (faster)
│  │
│  └─ Other feature? → Use `feature-4fd97715` (general)
│
├─ Improving existing code? → Use `refactor-364e6dac`
│
└─ Creating new workflow? → Use `infrastructure-780003ca`
```

---

## Variable Best Practices

### Required vs Optional
- **Required variables**: Must be provided, template fails without them
- **Optional variables**: Provide additional context, improve quality

### Writing Good Descriptions

**Bug Descriptions** (bugfix template):
```
❌ Bad:  "It's broken"
✅ Good: "Application crashes with TypeError when user logs out from profile page"
```

**Feature Descriptions** (feature templates):
```
❌ Bad:  "Add upload"
✅ Good: "Allow users to upload profile pictures with file type validation (jpg/png/webp) and size limits (max 5MB)"
```

**Refactoring Goals** (refactor template):
```
❌ Bad:  "Make it better"
✅ Good: "Reduce cyclomatic complexity from 25 to < 10 by extracting helper functions"
```

---

## Common Issues & Solutions

### Issue: Template Execution Hangs
**Solution**: Check backend logs, verify session token is valid
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/status
```

### Issue: Variables Rejected
**Solution**: Check variable names match template exactly
```javascript
// Wrong
variables: { description: "..." }

// Right
variables: { feature_description: "..." }
```

### Issue: Search Returns Empty
**Solution**: Use direct template ID (search is inconsistent)
```javascript
// Instead of searching, use known ID directly
activity({ activityId: "bugfix-747eac05", ... })
```

### Issue: Not Sure Which Template to Use
**Solution**: Use general templates (they work for everything)
- General bugfix: `bugfix-747eac05`
- General feature: `feature-4fd97715`
- General refactor: `refactor-364e6dac`

---

## Execution Monitoring

### During Execution
Templates will report progress:
```
[Task 1/4] Analyze and locate root cause
  ✓ Metabob search: 3 similar issues found
  ✓ Root cause identified: Missing null check
  ✓ Analysis complete (duration: 45s)

[Task 2/4] Implement fix
  ✓ Fix applied: Added null safety
  ✓ Typecheck passed
  ✓ Implementation complete (duration: 38s)
```

### After Execution
Review output:
```javascript
// Execution summary
{
  status: "completed",
  duration: "623.5s",
  cost: "$0.0428",
  tasks: [
    { id: "analyze-and-locate", status: "✅", duration: "45s" },
    { id: "implement-fix", status: "✅", duration: "38s" },
    { id: "test-fix", status: "✅", duration: "89s" },
    { id: "document-and-close", status: "✅", duration: "32s" }
  ]
}
```

---

## Template Comparison Matrix

| Template | Category | Tasks | Time | Cost | Best For |
|----------|----------|-------|------|------|----------|
| `bugfix-747eac05` | Bugfix | 4 | 20-30m | $0.03-0.05 | Any bug or issue |
| `feature-4fd97715` | Feature | 4 | 30-40m | $0.04-0.06 | General features |
| `feature-fdb6afae` | Feature | 3 | 15-25m | $0.02-0.04 | REST endpoints |
| `refactor-364e6dac` | Refactor | 4 | 35-50m | $0.05-0.08 | Code improvement |
| `infrastructure-780003ca` | Infra | 4 | 10-15m | $0.01-0.02 | New templates |

---

## Advanced Usage

### Chaining Templates
Execute multiple templates in sequence:

```javascript
// 1. Add feature
activity({ activityId: "feature-4fd97715", ... })

// 2. Refactor if needed
activity({ activityId: "refactor-364e6dac", ... })

// 3. Fix any issues found
activity({ activityId: "bugfix-747eac05", ... })
```

### Template Variants (Thompson Sampling)
Backend automatically selects best variant based on performance:

```javascript
// Both requests use "feature" category
// Backend may choose different template variants

activity({ activityId: "feature-4fd97715", ... })  // General (4 tasks)
// vs
activity({ activityId: "feature-fdb6afae", ... })  // REST specialized (3 tasks)

// System learns which performs better for different scenarios
```

### Custom Variables
Templates accept optional variables for additional context:

```javascript
activity({
  activityId: "bugfix-747eac05",
  variables: {
    bug_description: "Login fails",
    error_message: "AuthError: Invalid token",     // Optional but helpful
    steps_to_reproduce: "1. Clear cookies\n2. Login",  // Optional but helpful
    affected_files: "src/auth/login.ts"            // Optional but helpful
  },
  reason: "Critical: Blocks all users from logging in"
})
```

---

## Tips for Success

### 1. Provide Rich Context
More detail = better results:
- Include error messages if available
- Provide reproduction steps
- List suspected files
- Explain why (not just what)

### 2. Let Templates Do Their Job
Templates use best practices:
- ✅ Trust Metabob integration
- ✅ Trust validation patterns
- ✅ Trust testing strategies
- ❌ Don't try to pre-implement solutions

### 3. Review Output Files
Templates create documentation:
- Read analysis files for insights
- Review implementation notes
- Check test results
- Learn from summaries

### 4. Use Appropriate Template
Match template to task:
- Bugfix for bugs (not feature template)
- Feature for new functionality (not bugfix)
- Refactor for improvements (not feature)

### 5. Monitor Execution
Watch for issues:
- Task failures (retry mechanisms help)
- Long duration (normal for complex work)
- Cost overruns (rare, but check)

---

## Getting Help

### Check Template Details
```javascript
search_activities({ 
  query: "template-name",
  verbose: true  // Shows variables and task details
})
```

### View Template Source
```bash
# Templates stored as JSON files
cat fix-bug-complete.json | jq '.tasks[].description'
```

### Backend Status
```bash
curl http://localhost:8080/status
```

### Session Token
```bash
python3 scripts/create_session_state.py
```

---

## Summary

**5 Production Templates Ready**:
1. Fix bugs: `bugfix-747eac05`
2. Add features (general): `feature-4fd97715`
3. Add REST endpoints: `feature-fdb6afae`
4. Refactor code: `refactor-364e6dac`
5. Create templates: `infrastructure-780003ca`

**Average Execution**:
- Time: 10-40 minutes
- Cost: $0.01-0.06
- Quality: Comprehensive with tests + docs

**Next**: Execute templates on real work and let the system learn! 🚀
