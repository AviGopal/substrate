# Validation Harness: dynamic-activity-creation-with-trailblazing

## Overview

This validation harness tests the implementation of the dynamic-activity-creation-with-trailblazing specification. It verifies that meta-templates (create-activity, evolve-activity, debug-activity) have trailblazing auto-enabled with conservative cost limits.

## Quick Start

```bash
# Run all validation tests
node tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-harness.js

# Expected output: 4 PASS, 0 FAIL
```

## Test Cases

### Case 1: create-activity-self-contained
**Impulse**: `validation-dynamic-activity-creation-with-trailblazing-case-1`

**Input**:
- Template ID: `create-activity-self-contained`
- Variables: `{}`

**Expected Output**:
- `trailblazingEnabled`: `true`
- `costLimits.maxCostPerTask`: `1.0`
- `costLimits.maxTotalCost`: `5.0`
- `isMetaTemplate`: `true`

**Validation Checks**:
1. ✅ `isMetaTemplate('create-activity-self-contained')` returns true
2. ✅ Auto-enable logic present in activity.ts
3. ✅ Conservative cost limits set ($1/task, $5 total)
4. ✅ activityExecution impulse type exists
5. ✅ searchSimilarActivities() API exists
6. ✅ Impulse resolver handles activityExecution case

---

### Case 2: evolve-activity-self-contained
**Impulse**: `validation-dynamic-activity-creation-with-trailblazing-case-2`

**Input**:
- Template ID: `evolve-activity-self-contained`
- Variables: `{}`

**Expected Output**:
- `trailblazingEnabled`: `true`
- `costLimits.maxCostPerTask`: `1.0`
- `costLimits.maxTotalCost`: `5.0`
- `isMetaTemplate`: `true`

**Validation Checks**:
1. ✅ `isMetaTemplate('evolve-activity-self-contained')` returns true
2. ✅ Auto-enable logic present in activity.ts
3. ✅ Conservative cost limits set ($1/task, $5 total)
4. ✅ activityExecution impulse type exists
5. ✅ searchSimilarActivities() API exists
6. ✅ Impulse resolver handles activityExecution case

---

### Case 3: debug-activity-self-contained
**Impulse**: `validation-dynamic-activity-creation-with-trailblazing-case-3`

**Input**:
- Template ID: `debug-activity-self-contained`
- Variables: `{}`

**Expected Output**:
- `trailblazingEnabled`: `true`
- `costLimits.maxCostPerTask`: `1.0`
- `costLimits.maxTotalCost`: `5.0`
- `isMetaTemplate`: `true`

**Validation Checks**:
1. ✅ `isMetaTemplate('debug-activity-self-contained')` returns true
2. ✅ Auto-enable logic present in activity.ts
3. ✅ Conservative cost limits set ($1/task, $5 total)
4. ✅ activityExecution impulse type exists
5. ✅ searchSimilarActivities() API exists
6. ✅ Impulse resolver handles activityExecution case

---

### Case 4: regular-template (Negative Test)
**Impulse**: `validation-dynamic-activity-creation-with-trailblazing-case-4`

**Input**:
- Template ID: `add-rest-endpoint`
- Variables: `{}`

**Expected Output**:
- `trailblazingEnabled`: `false`
- `isMetaTemplate`: `false`
- Infrastructure exists but NOT activated

**Validation Checks**:
1. ✅ `isMetaTemplate('add-rest-endpoint')` returns false
2. ✅ Auto-enable logic present but not triggered
3. ✅ Infrastructure exists but inactive for regular templates

---

## Validation Strategy

The harness performs **static analysis** of the codebase to verify implementation without executing activities (which would require LLM calls). This makes validation:

- ✅ **Fast**: Runs in <1 second
- ✅ **Deterministic**: No LLM variability
- ✅ **Repeatable**: Can run in CI/CD
- ✅ **No Cost**: No API calls

### Validation Checks

#### 1. isMetaTemplate() Utility
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

Verifies:
- Function exists and is exported
- Returns true for 3 meta-templates
- Returns false for regular templates

```typescript
export function isMetaTemplate(templateId: string): boolean {
  const metaTemplateIds = [
    "create-activity-self-contained",
    "evolve-activity-self-contained", 
    "debug-activity-self-contained",
  ]
  return metaTemplateIds.includes(templateId)
}
```

#### 2. Auto-Enable Trailblazing Logic
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

Verifies:
- Auto-enable comment and logic present
- Calls `ActivityTemplate.isMetaTemplate()`
- Sets conservative cost limits

```typescript
// Auto-enable trailblazing for meta-templates
let trailblazingOptions = params.trailblazing
if (ActivityTemplate.isMetaTemplate(template.id) && !trailblazingOptions?.enabled) {
  trailblazingOptions = {
    enabled: true,
    maxRecoveryAttempts: 3,
    maxCostPerTask: 1.0,
    maxTotalCost: 5.0,
    ...trailblazingOptions,
  }
}
```

#### 3. activityExecution Impulse Type
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

Verifies:
- Type definition exists in Impulse.Pointer union
- Zod schema exists with correct fields

```typescript
| { type: "activityExecution"; templateId: string; executionId?: string; limit?: number }
```

#### 4. searchSimilarActivities() API
**File**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts`

Verifies:
- Function is exported and async
- Has correct parameter signature
- Returns typed array with execution data

```typescript
export async function searchSimilarActivities(
  templateId: string,
  variables: Record<string, unknown>,
  limit: number = 3,
): Promise<Array<{...}>>
```

#### 5. Impulse Resolver Case
**File**: `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`

Verifies:
- Case handler exists for activityExecution
- Returns placeholder content (until backend ready)

```typescript
case "activityExecution": {
  // Returns placeholder until backend API implemented
}
```

---

## Results

### Current Status: ✅ ALL TESTS PASS

```
================================================================================
Final Results: 4 PASS, 0 FAIL
================================================================================
```

### Components Validated

| Component | Status | Notes |
|-----------|--------|-------|
| isMetaTemplate() | ✅ PASS | Correctly identifies 3 meta-templates |
| Auto-enable logic | ✅ PASS | Present with conservative limits |
| activityExecution type | ✅ PASS | Type and schema exist |
| searchSimilarActivities() | ✅ PASS | API stub exists |
| Impulse resolver | ✅ PASS | Case handler exists |

---

## Integration with Enforcement

This validation harness verifies the changes made in:
- **Impulse**: `enforcement-dynamic-activity-creation-with-trailblazing`
- **Commits**: 
  - `repos/metabob-opencode`: `4ad7ba28` (feat: Enable dynamic activity creation)
  - Main repo: `d6e7c10` (docs: Add trace and enforcement impulses)

---

## Future Enhancements

### Phase 2b: Lifecycle Hook Validation
Once lifecycle hooks are implemented, add validation for:
- Activity context injection hook registration
- Similar activity data injection
- Impulse creation during hook execution

### Phase 4: Template Validation
Once templates are updated, add validation for:
- Template JSON has `trailblazing: {enabled: true}`
- Template JSON has appropriate `impulse_refs`

### Phase 5: Backend API Validation
Once backend API is implemented, add validation for:
- POST /v2/activities/search-similar endpoint exists
- Returns execution history with patterns
- Similarity scoring works correctly

---

## Troubleshooting

### Test Failures

If tests fail, check:

1. **File Not Found**: Ensure you're running from repo root
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob
   node tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-harness.js
   ```

2. **Checks Fail**: Review the diagnostic output to see which specific check failed
   - Each test prints detailed diagnostics
   - Compare actual vs expected values

3. **Code Reverted**: Verify enforcement commits are present
   ```bash
   cd repos/metabob-opencode
   git log --oneline -1  # Should show 4ad7ba28
   ```

---

## References

- **Specification**: `impulses/trace-dynamic-activity-creation-with-trailblazing.md`
- **Enforcement**: `impulses/enforcement-dynamic-activity-creation-with-trailblazing.md`
- **Trace Summary**: `TRACE_DYNAMIC_ACTIVITY_CREATION_COMPLETE.md`
