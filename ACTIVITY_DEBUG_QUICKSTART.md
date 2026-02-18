# Activity Debugging Quick Start Guide

**Status:** ✅ All features described here are IMPLEMENTED and WORKING  
**Last Updated:** 2026-02-18

---

## 🚀 Quick Start: Debug a Failed Activity

### Scenario: Your activity just failed

```typescript
// Step 1: Inspect the failure (automatic - finds most recent)
activity_error_inspector({
  includeSessionLogs: true,
  includeToolCalls: true,
  maxMessagesPerTask: 20
})
```

**Output:**
```markdown
# Activity Error Report

**Activity:** Fix Authentication Bug
**Status:** failed
**Template:** fix-bug-complete

## Summary
- Failed Tasks: 1/4 (25%)
- Cost: $0.023
- Duration: 45s

## Task: implement-fix

**Error Type:** validation
**Message:** Required file not found: test/auth.test.ts

**Tool Calls:**
- ✅ read (2.1s) - File contents loaded
- ✅ edit (0.3s) - Edit successful
- ❌ bash (5.2s) - Command failed: bun test
  Exit code: 1

**Session Log (last 5 messages):**
🤖 "I'll add null checks to validateToken..."
👤 "Test failed: TypeError: Cannot read property..."

## 💡 Recommendations
1. Create missing test file: test/auth.test.ts
2. Or update validation to check for existing test location
```

---

### Step 2: Fix the Issue

Based on the error report, fix the problem:

**Option A: Fix the code**
```bash
# Create missing test file
touch test/auth.test.ts
# Add tests...
```

**Option B: Fix the template**
```json
// Edit template JSON: fix-bug-complete.json
{
  "validation": {
    "requiredFiles": [
      "test/**/*.test.ts"  // Changed from specific path
    ]
  }
}
```

**Option C: Fix the environment**
```bash
# Commit changes if WORKING_TREE_DIRTY error
git add .
git commit -m "WIP: Authentication fixes"
```

---

### Step 3: Replay from Failure Point

```typescript
// Resume from first failed task (automatic)
activity_replay({
  activityId: "act_abc123",
  skipValidation: false
})

// OR: Start from specific task
activity_replay({
  activityId: "act_abc123",
  startFromTask: "task-3"
})

// OR: Override variables
activity_replay({
  activityId: "act_abc123",
  overrideVariables: {
    "testFile": "test/unit/auth.test.ts"  // Fix incorrect path
  }
})

// OR: Skip validation for faster iteration
activity_replay({
  activityId: "act_abc123",
  skipValidation: true  // Use during debugging
})
```

---

## 🎯 Common Scenarios

### Scenario 1: Budget Too Small

**Error:**
```
⚠️ Impulse 'fileContext' was truncated (4500/4000 tokens)
Task failed: Agent couldn't see the error location
```

**Fix:**
```json
// Edit template: my-template.json
{
  "contextRequirements": [
    {
      "key": "fileContext",
      "budgetRange": [3000, 6000]  // Increased from [2000, 4000]
    }
  ]
}
```

**Then replay:**
```typescript
activity_replay({ activityId: "act_xyz" })
```

---

### Scenario 2: Missing Context

**Error:**
```
Task failed: Could not find related authentication logic
Analysis incomplete due to missing session.ts context
```

**Fix using co-change analysis:**
```typescript
// Step 1: Find related files
metabob_suggest_related_changes({
  changed_files: ["src/auth.ts"],
  top_k: 5
})
// Output: { file: "src/session.ts", score: 0.85, ... }

// Step 2: Add to template
{
  "contextRequirements": [
    {
      "key": "authContext",
      "hint": "auth.ts and related authentication files",
      "budgetRange": [3000, 6000]
    },
    {
      "key": "sessionContext",
      "hint": "session.ts (co-changes with auth.ts at 85%)",
      "budgetRange": [2000, 4000]
    }
  ]
}
```

---

### Scenario 3: Validation Failed

**Error:**
```
Post-execution validation failed:
  requiredPattern not found: "\"success\": true"
```

**Fix:**
```json
// Option A: Fix validation pattern
{
  "validation": {
    "requiredPatterns": ["success.*true"]  // More flexible regex
  }
}

// Option B: Remove overly strict validation
{
  "validation": {
    "requiredPatterns": [],  // Remove if not critical
    "commands": [
      { "name": "test", "command": "bun test", "required": true }
    ]
  }
}
```

---

### Scenario 4: Git State Issues

**Error:**
```
Pre-task failure: WORKING_TREE_DIRTY
Activity blocked: 3 uncommitted files
```

**Fix:**
```bash
# Option A: Commit changes
git add .
git commit -m "WIP: Work in progress"

# Option B: Stash changes
git stash

# Option C: Configure template to allow dirty state
# (Not recommended for most cases)
```

---

## 🧠 Advanced: Template Improvement with Annotations

### After Successfully Fixing

```typescript
// 1. Mark the problem as resolved
metabob_mark_problem_complete({
  problem_id: "issue-auth-123",
  file_path: "src/auth.ts",
  resolution_notes: `
    Fixed null pointer in validateToken by adding explicit check.
    
    Root cause: Missing validation when token from expired session.
    
    Approach: Added null/undefined check before token.split().
    Alternative considered: Optional chaining rejected because we need
    explicit error message for debugging.
    
    Applied same pattern to refreshToken() for consistency.
    
    Tests: Added 3 new cases (null, undefined, malformed tokens).
  `
})

// 2. Annotate key components (3-5 max, focus on WHY)
metabob_annotate_component({
  file_path: "src/auth.ts",
  component_name: "validateToken",
  component_type: "function",
  reason: `
    Validates JWT tokens with explicit error handling.
    
    Design decision: Explicit null checks over optional chaining
    because we need detailed error messages for security audit logs.
    
    Constraint: Must maintain backward compatibility with existing
    token format (JWT with custom claims).
    
    Pattern: Applied to all token-handling functions for consistency.
  `
})

// 3. Check for related issues
metabob_suggest_related_changes({
  changed_files: ["src/auth.ts"]
})
// Review suggested files for similar issues

// 4. Verify work area is clean
metabob_get_priority_issues()
// Should return empty array if all issues addressed
```

---

## 📊 Template Performance Analysis (Manual)

Since automated analytics don't exist yet, here's how to analyze manually:

```typescript
// Get all activities for a template
const activities = await Activity.list()
const forTemplate = activities.filter(a => a.templateId === "fix-bug-complete")

// Calculate metrics
const metrics = {
  totalRuns: forTemplate.length,
  successes: forTemplate.filter(a => a.status === "done").length,
  failures: forTemplate.filter(a => a.status === "failed").length,
  successRate: forTemplate.filter(a => a.status === "done").length / forTemplate.length,
  
  avgCost: forTemplate.reduce((sum, a) => sum + (a.cost?.total ?? 0), 0) / forTemplate.length,
  avgDuration: forTemplate.reduce((sum, a) => sum + (a.stats?.duration ?? 0), 0) / forTemplate.length,
  
  totalCost: forTemplate.reduce((sum, a) => sum + (a.cost?.total ?? 0), 0)
}

console.log(`Template: fix-bug-complete
  Success Rate: ${(metrics.successRate * 100).toFixed(1)}%
  Avg Cost: $${metrics.avgCost.toFixed(4)}
  Avg Duration: ${(metrics.avgDuration / 1000).toFixed(1)}s
  Total Cost: $${metrics.totalCost.toFixed(2)}
`)

// Find common failure patterns
const failures = forTemplate.filter(a => a.status === "failed")
for (const failure of failures) {
  // Use activity_error_inspector to analyze each
  console.log(`\nAnalyzing failure: ${failure.id}`)
  await activity_error_inspector({ activityId: failure.id })
}
```

---

## 🎨 Creating Impulse-Aware Templates

### Example: Bug Fix Template with Full Impulse Integration

```json
{
  "name": "Fix Bug with Smart Context",
  "category": "bugfix",
  
  "contextRequirements": [
    {
      "key": "bugReport",
      "hint": "Bug description, error message, stack trace",
      "impulseTypes": ["memo", "file", "metabobIssue"],
      "required": true,
      "budgetRange": [1000, 3000]
    },
    {
      "key": "errorContext",
      "hint": "Files and components related to the error (use metabob_suggest_related_changes to identify)",
      "impulseTypes": ["file", "component"],
      "required": true,
      "budgetRange": [3000, 6000]
    },
    {
      "key": "designContext",
      "hint": "Previous design decisions and patterns (from metabob_annotate_component history)",
      "impulseTypes": ["metabobAnnotation"],
      "required": false,
      "budgetRange": [800, 1500]
    }
  ],
  
  "tasks": [
    {
      "id": "diagnose",
      "impulseReferences": ["bugReport", "errorContext", "designContext"],
      "prompt": {
        "template": "# Diagnose Bug\n\n## Bug Report\n{{bugReport}}\n\n{{#if bugReport.truncated}}\n⚠️ Bug report truncated to {{bugReport.tokens}}/{{bugReport.budget}} tokens.\nFocus on error message and stack trace at top.\n{{/if}}\n\n## Error Context ({{errorContext.tokens}} tokens)\n{{errorContext}}\n\n{{#if designContext.loaded}}\n## Design Context\nPrevious decisions:\n{{designContext}}\n{{else}}\nNo design context available. Infer patterns from code.\n{{/if}}\n\n## Your Task\nDiagnose the root cause and output:\n```json\n{\n  \"rootCause\": \"...\",\n  \"location\": { \"file\": \"...\", \"line\": 123 },\n  \"fixStrategy\": \"...\"\n}\n```",
        "maxTokens": 8000
      }
    },
    
    {
      "id": "implement-fix",
      "dependencies": ["diagnose"],
      "impulseReferences": ["errorContext"],
      "prompt": {
        "template": "# Implement Fix\n\n## Diagnosis\n{{diagnosis}}\n\n## Code Context\n{{errorContext}}\n\n{{#if errorContext.truncated}}\n⚠️ Context truncated. Focus on {{diagnosis.location.file}}:{{diagnosis.location.line}}\n{{/if}}\n\n## Your Task\n1. Apply fix at identified location\n2. Add tests\n3. Verify no regressions\n\nOutput implementation details as JSON.",
        "maxTokens": 12000,
        "variables": [
          { "name": "diagnosis", "type": "string", "required": true }
        ]
      },
      "validation": {
        "commands": [
          { "name": "test", "command": "bun test", "required": true }
        ]
      }
    }
  ]
}
```

### Using the Template

```typescript
// 1. Create impulses (manual or via memory agent)
impulse_create({
  id: "bugReport",
  type: "memo",
  pointer: {
    type: "memo",
    content: "User reports: Cannot login after password reset. Error: 'token.split is not a function'"
  },
  budget: 2000
})

// 2. Execute activity (impulses auto-created from contextRequirements)
activity({
  templateId: "fix-bug-with-smart-context",
  variables: {
    errorFile: "src/auth.ts"
  },
  reason: "Fix authentication bug after password reset"
})

// 3. If failure, inspect and replay
activity_error_inspector({})
activity_replay({ activityId: "act_xyz" })

// 4. After success, annotate
metabob_annotate_component({
  file_path: "src/auth.ts",
  component_name: "validateToken",
  component_type: "function",
  reason: "Added null check because password reset flow can pass undefined token..."
})
```

---

## 🔧 Template Evolution Workflow (Manual)

Since `evolve-activity-template` doesn't exist yet:

### Process

1. **Analyze Failures**
   ```typescript
   activity_error_inspector({ activityId: "act_failed" })
   ```

2. **Identify Pattern**
   - Budget too small? Increase `budgetRange`
   - Missing context? Add `contextRequirements`
   - Wrong validation? Update `validation` rules
   - Task ordering? Adjust `dependencies`

3. **Create New Version**
   ```json
   // Copy existing template: fix-bug-v1.json → fix-bug-v2.json
   {
     "name": "Fix Bug v2",
     "parentTemplateId": "fix-bug-v1",  // Link to parent
     "evolutionReason": "FAILURE_RECOVERY",
     "evolutionNotes": "Increased budget after repeated truncation in task 2. Added session.ts to context based on co-change analysis (85% correlation).",
     
     "contextRequirements": [
       {
         "key": "errorContext",
         "budgetRange": [4000, 8000]  // Increased from [2000, 4000]
       }
     ]
   }
   ```

4. **Register New Version**
   ```typescript
   register_activity_template({
     file_path: "/path/to/fix-bug-v2.json"
   })
   ```

5. **Test New Version**
   ```typescript
   activity({
     templateId: "fix-bug-v2",
     variables: { ... }
   })
   ```

6. **Compare Performance**
   ```typescript
   // Manual comparison (no tool yet)
   const v1 = await Activity.list().filter(a => a.templateId === "fix-bug-v1")
   const v2 = await Activity.list().filter(a => a.templateId === "fix-bug-v2")
   
   console.log(`V1: ${v1.successRate}% success, $${v1.avgCost}`)
   console.log(`V2: ${v2.successRate}% success, $${v2.avgCost}`)
   ```

---

## 📝 Cheat Sheet

### Debug Commands
```typescript
// Find and inspect most recent failure
activity_error_inspector({})

// Inspect specific activity
activity_error_inspector({ activityId: "act_xyz" })

// Replay from failure
activity_replay({ activityId: "act_xyz" })

// Replay with overrides
activity_replay({
  activityId: "act_xyz",
  overrideVariables: { file: "src/new-path.ts" }
})
```

### Context Analysis
```typescript
// Find related files (co-change)
metabob_suggest_related_changes({
  changed_files: ["src/auth.ts"]
})

// Search for similar issues
metabob_search_codebase_issues("authentication error")

// Get priority issues in current work area
metabob_get_priority_issues()

// Analyze change impact
metabob_analyze_change_impact({
  file_path: "src/auth.ts",
  component_name: "validateToken"
})
```

### Annotation (After Success)
```typescript
// Mark problem resolved
metabob_mark_problem_complete({
  problem_id: "issue-123",
  file_path: "src/auth.ts",
  resolution_notes: "Detailed explanation..."
})

// Annotate component
metabob_annotate_component({
  file_path: "src/auth.ts",
  component_name: "validateToken",
  component_type: "function",
  reason: "WHY it exists, alternatives considered, constraints..."
})
```

---

## ✅ What Works Today

- ✅ **activity_error_inspector** - Full error analysis with logs and tool calls
- ✅ **activity_replay** - Resume from failure with inherited impulses
- ✅ **Impulse system** - contextRequirements, impulseReferences, metadata variables
- ✅ **Metabob tools** - All 8 tools (search, annotate, co-change, etc.)
- ✅ **Template genealogy** - Version tracking and evolution support
- ✅ **Example template** - fix-bug-with-impulses.json shows all patterns

## ⚠️ What's Manual

- ⚠️ **Template evolution** - Edit JSON files manually (no automation yet)
- ⚠️ **Performance analysis** - Script metrics manually (no aggregation tool)
- ⚠️ **Budget optimization** - Calculate adjustments manually (no suggestions)

## 🚧 What's Missing

- ❌ **evolve-activity-template** - Automated template improvement activity
- ❌ **analyze-template-performance** - Automated metrics aggregation
- ❌ **impulse_optimize_budgets** - Budget suggestion tool

---

**Full Details:** See `ACTIVITY_DEBUG_IMPLEMENTATION_STATUS.md`

**Example Template:** `repos/metabob-opencode/packages/opencode/templates/built-in/fix-bug-with-impulses.json`
