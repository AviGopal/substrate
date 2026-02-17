# Cochange Learning Integration - Testing Plan

**Date**: 2026-02-16  
**Purpose**: Validate that all 3 major activity templates correctly predict cochanges, track accuracy, and send data to backend for learning  
**Status**: Ready for execution

---

## Testing Objectives

### Primary Goals
1. ✅ Verify cochange predictions appear in design documents (early task)
2. ✅ Verify cochange accuracy tracking appears in summary documents (late task)
3. ✅ Verify backend receives structured outcome data with `cochangeAccuracy`
4. ✅ Verify pattern consistency across all 3 templates
5. ✅ Identify any bugs or missing integrations

### Success Criteria
- All 3 templates generate predictions in design docs
- All 3 templates calculate accuracy in summary docs
- OpenCode CLI extracts accuracy correctly (lines 544-547 in activity.ts)
- Backend API receives outcomes with cochange data
- Cochange accuracy is between 0-100% (valid calculation)

---

## Test Suite Overview

### Template Coverage
| Template | Test Scenario | Files Involved | Expected Cochanges |
|----------|---------------|----------------|-------------------|
| **fix-bug-complete** | Null pointer bug in auth | `src/auth.ts` | session.ts, auth-utils.ts, users.ts |
| **add-feature-complete** | User avatar upload | `src/api/users.ts` | storage.ts, validation.ts, users.test.ts |
| **refactor-component-complete** | Extract auth logic | `src/services/user-service.ts` | auth-service.ts, user-service.test.ts |

---

## Test Environment Setup

### Prerequisites

1. **Project structure** (create minimal test workspace):
```bash
mkdir -p test-cochange-learning/src/{auth,api,services}
mkdir -p test-cochange-learning/tests
```

2. **Test files** (create simple TypeScript files):
- `src/auth.ts` - Simple auth function with null pointer bug
- `src/api/users.ts` - User API handler
- `src/services/user-service.ts` - User service with complex logic

3. **Git initialization**:
```bash
cd test-cochange-learning
git init
git config user.name "Test User"
git config user.email "test@example.com"
```

4. **Metabob initialization** (if not already done):
```bash
opencode mcp call initialize_cpg
```

---

## Test Case 1: fix-bug-complete

### Scenario
Fix a null pointer exception in authentication code.

### Setup Files

**src/auth.ts** (with intentional bug):
```typescript
export interface User {
  id: string;
  name: string;
  email: string;
}

export function getUserProfile(user: User): { name: string; email: string } {
  // BUG: No null check - crashes if user is null
  return {
    name: user.name,
    email: user.email
  };
}

export function authenticate(email: string, password: string): User | null {
  // Simplified auth logic
  if (email && password === "test123") {
    return { id: "1", name: "Test User", email };
  }
  return null;
}
```

**src/auth-utils.ts**:
```typescript
import { User } from './auth';

export function validateEmail(email: string): boolean {
  return email.includes('@');
}

export function hashPassword(password: string): string {
  return `hashed_${password}`;
}
```

**tests/auth.test.ts** (basic test):
```typescript
import { getUserProfile, authenticate } from '../src/auth';

describe('Auth', () => {
  it('should authenticate valid user', () => {
    const user = authenticate('test@example.com', 'test123');
    expect(user).toBeDefined();
  });

  // This test will fail initially (null pointer)
  it('should handle null user gracefully', () => {
    const profile = getUserProfile(null as any);
    expect(profile).toEqual({ name: 'Unknown', email: null });
  });
});
```

### Test Execution

```bash
opencode activity run fix-bug-complete \
  --bug_description="Application crashes with 'Cannot read property name of null' when getUserProfile is called with null user object" \
  --error_message="TypeError: Cannot read property 'name' of null at getUserProfile (auth.ts:7)" \
  --affected_files="src/auth.ts"
```

### Expected Outcomes

**Task 0 (analyze-and-locate)**:
- ✅ `BUG_ANALYSIS.md` created
- ✅ Contains section: `### Predicted Cochanges`
- ✅ Lists predicted files (e.g., auth-utils.ts, session.ts, users.ts)
- ✅ Stores predictions for later comparison

**Task 1 (implement-fix)**:
- ✅ Adds null check to `getUserProfile`
- ✅ `FIX_IMPLEMENTATION.md` created

**Task 2 (test-fix)**:
- ✅ Tests pass
- ✅ `TEST_RESULTS.md` created

**Task 3 (document-and-close)**:
- ✅ `BUG_FIX_SUMMARY.md` created
- ✅ Contains section: `### Related Files Analysis`
- ✅ Contains pattern: `Cochange accuracy: XX%`
- ✅ Compares predicted vs actual changes
- ✅ Explains accuracy percentage

**Backend Integration**:
- ✅ OpenCode CLI extracts `cochangeAccuracy` from `BUG_FIX_SUMMARY.md`
- ✅ Outcome sent to backend with comparison data
- ✅ Backend receives structured JSON with `cochangeAccuracy` field

### Verification Steps

```bash
# 1. Check design document has predictions
cat BUG_ANALYSIS.md | grep -A 10 "Predicted Cochanges"

# 2. Check summary document has accuracy
cat BUG_FIX_SUMMARY.md | grep -A 10 "Related Files Analysis"
cat BUG_FIX_SUMMARY.md | grep "Cochange accuracy:"

# 3. Extract actual changes
git diff --name-only HEAD~1 HEAD

# 4. Check backend received data (if backend available)
opencode activity outcomes --last 1 --json | jq '.comparison.cochangeAccuracy'
```

---

## Test Case 2: add-feature-complete

### Scenario
Add user avatar upload feature with image validation.

### Setup Files

**src/api/users.ts** (minimal user API):
```typescript
export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export async function getUser(id: string): Promise<UserProfile> {
  return {
    id,
    name: "Test User",
    email: "test@example.com"
  };
}

export async function updateUser(id: string, data: Partial<UserProfile>): Promise<UserProfile> {
  return {
    id,
    ...data,
    email: data.email || "test@example.com"
  } as UserProfile;
}
```

**src/storage.ts** (will be needed for uploads):
```typescript
export interface UploadResult {
  url: string;
  size: number;
}

export async function uploadFile(file: Buffer, path: string): Promise<UploadResult> {
  // Placeholder
  return {
    url: `/uploads/${path}`,
    size: file.length
  };
}
```

### Test Execution

```bash
opencode activity run add-feature-complete \
  --feature_name="user-avatar-upload" \
  --feature_description="Allow users to upload profile avatar images with validation (max 5MB, jpg/png/webp only)" \
  --requirements="Max file size: 5MB, Formats: jpg, png, webp, Store in /uploads/avatars/, Return download URL" \
  --acceptance_criteria="Valid files upload successfully, invalid files rejected with clear errors, download URLs are accessible"
```

### Expected Outcomes

**Task 0 (design-feature)**:
- ✅ `FEATURE_DESIGN.md` created
- ✅ Contains section: `### Predicted Cochanges`
- ✅ Lists predicted files (e.g., users.ts, storage.ts, validation.ts)
- ✅ Stores predictions with reasoning

**Task 1 (implement-feature)**:
- ✅ Implements avatar upload logic
- ✅ Adds validation
- ✅ Integrates with storage

**Task 2 (test-feature)**:
- ✅ Tests pass
- ✅ Covers success, error, edge cases

**Task 3 (document-and-annotate)**:
- ✅ `FEATURE_SUMMARY.md` created
- ✅ Contains section: `### Related Files Analysis`
- ✅ Contains pattern: `Cochange accuracy: XX%`
- ✅ Documents correctly predicted files
- ✅ Documents missed predictions
- ✅ Documents false positives

**Backend Integration**:
- ✅ Outcome includes cochangeAccuracy
- ✅ Structured comparison data sent

### Verification Steps

```bash
# Check design predictions
cat FEATURE_DESIGN.md | grep -A 10 "Predicted Cochanges"

# Check summary accuracy
cat FEATURE_SUMMARY.md | grep -A 15 "Related Files Analysis"
cat FEATURE_SUMMARY.md | grep "Cochange accuracy:"

# Verify actual changes
git log --oneline -1
git diff --name-only HEAD~1 HEAD
```

---

## Test Case 3: refactor-component-complete

### Scenario
Extract authentication logic from user service into separate auth service.

### Setup Files

**src/services/user-service.ts** (god class with auth logic mixed in):
```typescript
import { User } from '../auth';

export class UserService {
  // Mixing concerns: auth + user management
  
  async authenticate(email: string, password: string): Promise<User | null> {
    // Auth logic (should be in AuthService)
    if (this.validateCredentials(email, password)) {
      return this.loadUser(email);
    }
    return null;
  }
  
  private validateCredentials(email: string, password: string): boolean {
    // Validation logic (should be in AuthService)
    return email.includes('@') && password.length > 6;
  }
  
  async loadUser(email: string): Promise<User> {
    // User loading (belongs here)
    return {
      id: "1",
      name: "Test",
      email
    };
  }
  
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    // User update (belongs here)
    const user = await this.loadUser(data.email || "");
    return { ...user, ...data };
  }
}
```

### Test Execution

```bash
opencode activity run refactor-component-complete \
  --file_path="src/services/user-service.ts" \
  --component_name="UserService" \
  --refactoring_goal="Extract authentication logic into separate AuthService for better separation of concerns" \
  --refactoring_reason="UserService violates single responsibility principle. Auth logic is mixed with user management, making it hard to test and maintain."
```

### Expected Outcomes

**Task 0 (analyze-impact)**:
- ✅ `REFACTORING_PLAN.md` created
- ✅ Uses `metabob_analyze_change_impact` to find dependents
- ✅ Uses `metabob_suggest_related_changes` to predict cochanges
- ✅ Contains section: `### Predicted Cochanges`
- ✅ Lists predicted files (auth-service.ts, user-service.test.ts, etc.)
- ✅ Higher `top_k: 10` for wider refactoring scope

**Task 1 (implement-refactoring)**:
- ✅ Extracts auth methods to AuthService
- ✅ Updates UserService to use AuthService
- ✅ Maintains backward compatibility

**Task 2 (test-and-validate)**:
- ✅ Tests pass
- ✅ Validates dependents

**Task 3 (document-and-annotate)**:
- ✅ `REFACTORING_SUMMARY.md` created
- ✅ Contains section: `### Related Files Analysis`
- ✅ Contains pattern: `Cochange accuracy: XX%`
- ✅ Four-part structure:
  1. Metabob annotations
  2. Cochange accuracy
  3. Key components
  4. Summary

**Backend Integration**:
- ✅ Outcome includes cochangeAccuracy
- ✅ Comparison shows predicted vs actual

### Verification Steps

```bash
# Check plan predictions
cat REFACTORING_PLAN.md | grep -A 10 "Predicted Cochanges"

# Check summary accuracy
cat REFACTORING_SUMMARY.md | grep -A 15 "Related Files Analysis"
cat REFACTORING_SUMMARY.md | grep "Cochange accuracy:"

# Verify refactoring
ls -la src/services/
cat src/services/auth-service.ts
git diff --name-only HEAD~1 HEAD
```

---

## Pattern Consistency Validation

### Verify Consistent Structure Across All Templates

For each template, verify:

1. **Early task has prediction section**:
   - `### Predicted Cochanges` present in design/analysis doc
   - Lists files with reasoning
   - Stores for later comparison

2. **Late task has accuracy section**:
   - `### Related Files Analysis` present in summary doc
   - Contains `Cochange accuracy: XX%` pattern
   - Lists correctly predicted files
   - Lists missed predictions
   - Lists false positives
   - Explains accuracy calculation

3. **Backend data structure**:
   - `expectation.predictedCochanges: string[]`
   - `result.actualFiles: string[]`
   - `comparison.cochangeAccuracy: number`
   - `comparison.missedComponents: string[]`

---

## Backend Learning Verification

### Check Backend Receives Data

If backend is available, verify learning loop:

```bash
# 1. Check last 3 activity outcomes
opencode activity outcomes --last 3 --json | jq '.'

# 2. Extract cochange accuracy for each template
opencode activity outcomes --template fix-bug-complete --last 5 --json | \
  jq '.[] | {template: .templateId, accuracy: .comparison.cochangeAccuracy}'

opencode activity outcomes --template add-feature-complete --last 5 --json | \
  jq '.[] | {template: .templateId, accuracy: .comparison.cochangeAccuracy}'

opencode activity outcomes --template refactor-component-complete --last 5 --json | \
  jq '.[] | {template: .templateId, accuracy: .comparison.cochangeAccuracy}'

# 3. Check Thompson Sampling scores (if backend API available)
curl -s http://localhost:3000/api/v2/activity/metrics | jq '.templates[] | {id, alpha, beta, ucb}'
```

### Verify Template Evolution

After multiple executions with varying accuracy:

1. **Low accuracy (< 50%)** should trigger variant commissioning
2. **High accuracy (> 80%)** should reinforce current template
3. **Backend should route tasks** to best-performing variants

---

## Manual Testing Checklist

### Before Testing
- [ ] Templates are in correct location (`*.json` in project root)
- [ ] Git is initialized in test workspace
- [ ] Metabob CPG is initialized (or will handle gracefully)
- [ ] Test files are created with intentional issues

### During Testing - Per Template
- [ ] Activity runs without errors
- [ ] Agent follows all task guidance
- [ ] Design document created with predictions
- [ ] Implementation completes
- [ ] Tests pass
- [ ] Summary document created with accuracy
- [ ] All required patterns present
- [ ] No forbidden patterns present
- [ ] Cochange accuracy is valid percentage (0-100%)

### After Testing - Cross-Template
- [ ] All 3 templates follow same pattern
- [ ] Accuracy calculation is consistent
- [ ] Backend receives data (if available)
- [ ] Documentation is complete

---

## Troubleshooting Guide

### Issue: No predictions in design document

**Symptom**: `### Predicted Cochanges` section missing or empty

**Diagnosis**:
```bash
# Check if metabob_suggest_related_changes was called
cat BUG_ANALYSIS.md | grep -i "suggest_related_changes"
cat FEATURE_DESIGN.md | grep -i "predict"
```

**Fix**:
- Verify guidance includes: `"Use metabob_suggest_related_changes to predict cochanges"`
- Verify prompt has prediction section
- Verify validation requires: `"### Predicted Cochanges"`

### Issue: No accuracy in summary document

**Symptom**: `Cochange accuracy:` pattern missing

**Diagnosis**:
```bash
# Check if accuracy section exists
cat BUG_FIX_SUMMARY.md | grep -i "accuracy"
cat FEATURE_SUMMARY.md | grep -i "cochange"
```

**Fix**:
- Verify guidance includes Metabob tool usage
- Verify prompt has "Part 2: Check Related Files and Cochange Accuracy"
- Verify validation requires: `"Cochange accuracy:"`

### Issue: Invalid accuracy percentage

**Symptom**: Accuracy is >100%, negative, or NaN

**Diagnosis**:
```bash
# Extract accuracy value
cat *_SUMMARY.md | grep "Cochange accuracy:" | sed 's/.*: \([0-9.]*\)%.*/\1/'
```

**Fix**:
- Check agent calculation logic in summary
- Verify predicted files count is non-zero
- Ensure agent handles edge case: no predictions → accuracy is 0%

### Issue: Backend not receiving data

**Symptom**: `opencode activity outcomes` returns empty or missing `cochangeAccuracy`

**Diagnosis**:
```bash
# Check if OpenCode CLI extracts correctly
opencode activity outcomes --last 1 --verbose
```

**Fix**:
- Verify `activity.ts` lines 544-547 are present
- Check summary document has correct pattern
- Verify MCP layer is forwarding to backend
- Check backend API is running and accessible

---

## Success Metrics

### Quantitative Metrics
- **Test Completion**: 3/3 templates tested successfully
- **Prediction Success**: 100% of executions generate predictions
- **Accuracy Tracking**: 100% of executions calculate accuracy
- **Backend Integration**: 100% of outcomes sent to backend (if available)
- **Pattern Consistency**: All templates follow same structure

### Qualitative Metrics
- **Agent Understanding**: Agent correctly uses Metabob tools
- **Documentation Quality**: Design and summary docs are complete
- **Accuracy Calculation**: Percentages are valid and explained
- **Learning Potential**: System can learn from outcomes over time

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Document test results in `COCHANGE_LEARNING_TEST_RESULTS.md`
2. Create usage guide for template authors
3. Monitor accuracy trends over multiple executions
4. Set up dashboard for cochange accuracy metrics
5. Expand to remaining templates

### If Tests Fail ❌
1. Document failures in detail
2. Identify root cause (template, agent, backend)
3. Fix issues in templates
4. Re-validate JSON and patterns
5. Re-test until passing

### Long-Term Monitoring
1. Track accuracy trends per template (week over week)
2. Monitor backend variant commissioning
3. Check Thompson Sampling routing decisions
4. Analyze which templates improve fastest
5. Identify patterns that work well vs poorly

---

## Summary

This testing plan provides comprehensive validation of the cochange learning integration across all 3 major activity templates. Successful execution proves:

1. ✅ Templates predict cochanges early
2. ✅ Templates track accuracy late
3. ✅ Backend receives structured learning data
4. ✅ Pattern is consistent and reusable
5. ✅ System can learn and improve over time

**Estimated Testing Time**: 2-3 hours for all 3 templates  
**Prerequisites**: Test workspace, git, basic TypeScript files  
**Risk Level**: Low - testing in isolated environment

---

**Ready to execute**: All test cases defined, verification steps documented, troubleshooting guide provided.
