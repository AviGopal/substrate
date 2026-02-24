# Activity Composition Quick Reference

**Date:** 2026-02-22  
**Purpose:** Practical guide for composing activities instead of reimplementing logic

---

## Core Principle

> **Compose activities, don't recreate them. Measure everything.**

**Why?**
- Each activity invocation is measured independently
- Boredom system optimizes individual activities
- Well-practiced activities evolve toward deterministic execution
- Reusability reduces development time and cost

---

## Available Activities for Composition

### Bootstrap Templates (Always Available)

| Activity ID | Purpose | When to Use |
|-------------|---------|-------------|
| `create-activity` | Create new activity templates | Creating new workflows |
| `debug-activity-self-contained` | Debug failed executions | Activity execution fails |
| `evolve-activity-self-contained` | Optimize templates via metrics | Improving activity performance |
| `manage-session-memory` | Pre-turn memory management | Session context optimization |
| **`trace-data-flow-single-feature`** | Map data flows through features | Before modifying any feature |
| **`trace-enforce-validate-loop`** | Enforce specs with validation | All code changes |

### Other Templates (If Available)

| Activity ID | Purpose | When to Use |
|-------------|---------|-------------|
| `implement-activity-cochange-workflow` | CPG co-change analysis | Finding related files before changes |
| `implement-cpg-test-selection` | CPG-based test selection | Optimizing test runs |
| `propagate-change-through-flow` | Ripple changes via data flow | After modifying feature |
| `debug-activity-execution-failure` | Deep dive on failures | Complex activity debugging |

---

## Composition Patterns

### Pattern 1: Basic Loop Usage (Most Common)

**Use Case:** Any code change (feature, bug fix, refactor)

```typescript
// In your activity task prompt:
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'my-feature',
    specificationDescription: 'What the code should do',
    expectedBehavior: 'Expected outcomes',
    validationStrategy: 'How to test it'
  },
  reason: 'Enforce my-feature specification with validation'
})

// Wait for completion
// Read outputs:
impulse_load({ id: 'trace-my-feature', reason: 'Get traced implementation' })
impulse_load({ id: 'harness-my-feature', reason: 'Get validation harness' })
impulse_load({ id: 'validation-results-my-feature', reason: 'Get test results' })
```

**Outputs:**
- Code changes applied and annotated
- Validation harness created
- All tests passed
- Impulses for measurements

---

### Pattern 2: Trace First, Then Enforce

**Use Case:** Complex features needing detailed understanding first

```typescript
// Task 1: Trace current implementation
activity({
  templateId: 'trace-data-flow-single-feature',
  variables: {
    featureName: 'user-authentication'
  },
  reason: 'Map current auth implementation before adding OAuth'
})

// Read trace output
const trace = impulse_load({ id: 'trace-user-authentication' })

// Task 2: Enforce new specification
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'oauth-integration',
    specificationDescription: 'Add OAuth provider support to existing auth',
    expectedBehavior: 'Users can login via Google/GitHub OAuth',
    validationStrategy: 'Test harness: OAuth flow → JWT token generated'
  },
  reason: 'Add OAuth to existing auth with validation'
})
```

**When to use:**
- Large features with complex existing implementations
- Need detailed data flow diagram
- Multiple specifications to enforce sequentially

---

### Pattern 3: CPG-Enhanced Development

**Use Case:** Changes that might affect related files

```typescript
// Task 1: Analyze co-change patterns
activity({
  templateId: 'implement-activity-cochange-workflow',
  variables: {
    targetFile: 'src/payment.ts'
  },
  reason: 'Identify related files before modifying payment logic'
})

// Read co-change results
const cochanges = impulse_load({ id: 'cochange-payment' })

// Task 2: Enforce specification with co-change awareness
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'payment-validation',
    specificationDescription: `Add validation to payment flow. Related files: ${cochanges.relatedFiles.join(', ')}`,
    expectedBehavior: 'Payment amount validated before processing',
    validationStrategy: 'Test harness: negative amount → error, valid amount → success'
  },
  reason: 'Add payment validation with co-change awareness'
})

// Task 3: Propagate validation through flow
activity({
  templateId: 'propagate-change-through-flow',
  variables: {
    changeDescription: 'Payment validation added',
    affectedFiles: cochanges.relatedFiles
  },
  reason: 'Ensure validation ripples through payment flow'
})
```

**When to use:**
- Modifying core components with many dependencies
- Changes that typically affect multiple files together
- Need to ensure consistency across related code

---

### Pattern 4: Iterative Enforcement (Multiple Specifications)

**Use Case:** Enforcing multiple related specifications

```typescript
// Specification 1: Authentication
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'jwt-authentication',
    specificationDescription: 'Users authenticate with JWT tokens',
    expectedBehavior: 'POST /auth/login returns JWT',
    validationStrategy: 'Test harness: login → JWT returned, JWT verified'
  },
  reason: 'Enforce JWT authentication'
})

// Specification 2: Authorization (depends on auth)
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'role-based-authorization',
    specificationDescription: 'Protected routes check user roles',
    expectedBehavior: 'Admin routes require admin role, user routes require user role',
    validationStrategy: 'Test harness: admin access with user role → 403, admin access with admin role → 200'
  },
  reason: 'Enforce RBAC on top of JWT auth'
})

// Specification 3: Session management (depends on auth + authz)
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'session-timeout',
    specificationDescription: 'Sessions expire after 1 hour of inactivity',
    expectedBehavior: 'JWT tokens expire after 1 hour',
    validationStrategy: 'Test harness: wait 61 minutes → token rejected, use token before 60 minutes → accepted'
  },
  reason: 'Enforce session timeout on auth system'
})
```

**When to use:**
- Building complex features with multiple requirements
- Each specification depends on previous ones
- Need isolated validation for each specification

---

### Pattern 5: Meta-Level Composition (Creating Activities)

**Use Case:** Creating new activity templates

```typescript
// Task 1: Design activity template
// ... design logic ...

// Task 2: Use loop to enforce template pattern
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'migration-activity-template',
    specificationDescription: 'Migration activity must trace schema, enforce changes, validate with rollback',
    expectedBehavior: 'Activity creates migration, applies it, validates schema, creates rollback harness',
    validationStrategy: 'Test harness: execute migration activity → schema matches → rollback succeeds'
  },
  reason: 'Enforce migration activity pattern'
})

// Task 3: Register template
register_activity_template({
  file_path: '/tmp/migration-activity.json',
  register_with_metabob: true
})
```

**When to use:**
- Creating new activity templates
- Enforcing patterns at meta-level
- Ensuring activity templates follow best practices

---

### Pattern 6: Debug and Evolve

**Use Case:** Improving failing or underperforming activities

```typescript
// Task 1: Debug failure
activity({
  templateId: 'debug-activity-self-contained',
  variables: {
    activityId: 'act_xyz123' // Failed activity execution
  },
  reason: 'Understand why payment-processing activity failed'
})

// Read debug output
const debugReport = impulse_load({ id: 'debug-act_xyz123' })

// Task 2: Evolve template based on learnings
activity({
  templateId: 'evolve-activity-self-contained',
  variables: {
    templateId: 'trace-enforce-validate-loop',
    improvementFocus: 'payment-specific validation patterns from debug report'
  },
  reason: 'Optimize loop for payment domain based on failure analysis'
})
```

**When to use:**
- Activity execution fails
- Success rate below 80%
- Cost higher than expected
- Duration longer than expected

---

## Calling Activities from Activity Templates

### In Task Prompts

**Syntax:**
```typescript
activity({
  templateId: 'activity-id-here',
  variables: {
    var1: 'value1',
    var2: '{{templateVariable}}' // Can reference parent activity variables
  },
  reason: 'Why executing this sub-activity'
})
```

**Full Example in JSON:**
```json
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Enforce specification using loop",
      "prompt": {
        "template": "Use trace-enforce-validate-loop to enforce {{featureName}} specification.\n\nInvoke the activity:\n\nactivity({\n  templateId: 'trace-enforce-validate-loop',\n  variables: {\n    specificationName: '{{featureName}}',\n    specificationDescription: '{{featureDescription}}',\n    expectedBehavior: '{{expectedBehavior}}',\n    validationStrategy: '{{validationStrategy}}'\n  },\n  reason: 'Enforce {{featureName}} specification with deterministic validation'\n})\n\nWait for the activity to complete.\n\nRead the outputs:\n- Load trace: impulse_load({ id: 'trace-{{featureName}}' })\n- Load enforcement: impulse_load({ id: 'enforcement-{{featureName}}' })\n- Load harness: impulse_load({ id: 'harness-{{featureName}}' })\n- Load validation results: impulse_load({ id: 'validation-results-{{featureName}}' })\n\nVerify all validations passed. If any failed, analyze failures and re-enforce."
      }
    }
  ]
}
```

---

## Best Practices

### DO ✅

1. **Compose existing activities**
   ```typescript
   // Good
   activity({ templateId: 'trace-data-flow-single-feature', ... })
   ```

2. **Use loop for all code changes**
   ```typescript
   // Good
   activity({ templateId: 'trace-enforce-validate-loop', ... })
   ```

3. **Read sub-activity outputs**
   ```typescript
   // Good
   impulse_load({ id: 'trace-my-feature', reason: 'Access traced data' })
   ```

4. **Provide clear reasons**
   ```typescript
   // Good
   reason: 'Enforce payment validation to prevent negative amounts'
   ```

5. **Chain activities for complex workflows**
   ```typescript
   // Good
   activity({ templateId: 'trace-data-flow-single-feature', ... })
   // Then use trace output in next activity
   activity({ templateId: 'trace-enforce-validate-loop', ... })
   ```

### DON'T ❌

1. **Don't reimplement tracing logic**
   ```typescript
   // Bad - reimplements trace-data-flow
   "Use grep and read tools to map the implementation..."
   
   // Good - composes existing activity
   activity({ templateId: 'trace-data-flow-single-feature', ... })
   ```

2. **Don't skip validation**
   ```typescript
   // Bad - no validation harness
   "Make code changes and commit"
   
   // Good - uses loop to create harness
   activity({ templateId: 'trace-enforce-validate-loop', ... })
   ```

3. **Don't ignore sub-activity outputs**
   ```typescript
   // Bad - calls activity but doesn't use outputs
   activity({ ... })
   "Done!"
   
   // Good - reads and processes outputs
   activity({ ... })
   const trace = impulse_load({ id: 'trace-...' })
   // Use trace data in next steps
   ```

4. **Don't use generic reasons**
   ```typescript
   // Bad
   reason: 'Run activity'
   
   // Good
   reason: 'Trace payment flow to identify validation gaps before enforcement'
   ```

---

## Measuring Activity Composition

### What Gets Measured

**Per Activity Invocation:**
- Cost ($ for LLM API calls)
- Duration (wall-clock time)
- Success/failure
- Tool calls made
- Sub-activities invoked
- Impulses created

**Per Template:**
- Average cost across all executions
- Average duration
- Success rate (%)
- Common failure modes
- Optimization opportunities

### Using Metrics for Optimization

**Boredom system uses metrics to:**
1. Identify underperforming activities
2. Suggest improvements (token budgets, prompt clarity, task dependencies)
3. Create template variants
4. Deploy via genealogy system
5. Compare variant performance

**Result:** Activities get cheaper and faster over time.

---

## Common Scenarios

### Scenario 1: "Add a feature"

```typescript
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'feature-name',
    specificationDescription: 'What the feature does',
    expectedBehavior: 'Feature outcomes',
    validationStrategy: 'How to test'
  },
  reason: 'Add feature with validation'
})
```

### Scenario 2: "Fix a bug"

```typescript
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'bug-fix-name',
    specificationDescription: 'What should happen instead of bug',
    expectedBehavior: 'Correct behavior',
    validationStrategy: 'Regression test to prevent bug from returning'
  },
  reason: 'Fix bug with regression prevention'
})
```

### Scenario 3: "Refactor code"

```typescript
// Step 1: Trace current implementation
activity({
  templateId: 'trace-data-flow-single-feature',
  variables: { featureName: 'code-to-refactor' },
  reason: 'Map current implementation before refactoring'
})

// Step 2: Enforce refactoring pattern
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'refactoring-pattern',
    specificationDescription: 'Apply pattern (e.g., dependency injection)',
    expectedBehavior: 'Same behavior, better structure',
    validationStrategy: 'All existing tests pass after refactoring'
  },
  reason: 'Refactor with behavior preservation validation'
})
```

### Scenario 4: "Understand existing code"

```typescript
activity({
  templateId: 'trace-data-flow-single-feature',
  variables: {
    featureName: 'complex-feature'
  },
  reason: 'Map implementation to understand how feature works'
})

// Outputs:
// - Data flow diagram (mermaid)
// - Component annotations
// - Documentation
```

### Scenario 5: "Create new activity template"

```typescript
// Use create-activity bootstrap template
activity({
  templateId: 'create-activity',
  variables: {
    templateName: 'My New Activity',
    templateDescription: 'What it does',
    category: 'feature',
    templateId: 'my-new-activity'
  },
  reason: 'Create reusable activity template for recurring workflow'
})
```

---

## Troubleshooting

### Issue: "Sub-activity not found"

**Error:** `Activity template 'xyz' not found`

**Solution:**
```typescript
// Check available activities
search_activities({ verbose: true })

// Use exact template ID from results
activity({ templateId: 'exact-id-from-search', ... })
```

### Issue: "Can't access sub-activity outputs"

**Error:** `Impulse 'trace-xyz' not found`

**Solution:**
```typescript
// Wait for activity to complete before loading impulse
activity({ ... }) // This blocks until complete

// Then load impulse
impulse_load({ id: 'trace-xyz', reason: '...' })
```

### Issue: "Sub-activity failed"

**Error:** `Activity execution failed`

**Solution:**
```typescript
// Debug the failed activity
activity({
  templateId: 'debug-activity-self-contained',
  variables: { activityId: 'act_failed_id' },
  reason: 'Debug failed sub-activity execution'
})

// Read debug report for insights
impulse_load({ id: 'debug-act_failed_id' })
```

---

## Summary

**Key Takeaways:**

1. ✅ **Always use trace-enforce-validate-loop for code changes**
2. ✅ **Compose existing activities instead of reimplementing logic**
3. ✅ **Read sub-activity outputs via impulse_load**
4. ✅ **Provide clear reasons for activity invocations**
5. ✅ **Chain activities for complex workflows**
6. ✅ **Measure everything - boredom system optimizes based on metrics**

**Benefits:**

- **Reusability** - Don't recreate, compose
- **Measurement** - Every invocation measured independently
- **Optimization** - Boredom system improves activities over time
- **Determinism** - Well-practiced activities evolve toward zero LLM calls
- **Cost efficiency** - Activities get cheaper as they mature

---

**Status:** ✅ Quick reference complete  
**Usage:** Refer to this guide when creating or executing activities  
**Goal:** 80%+ of development uses activity composition
