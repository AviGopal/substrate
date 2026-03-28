# CPG Co-Change Integration Analysis - Quick Summary

## 🎯 Insertion Point: Line 1239

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`
**Function**: `executeTask()`
**Context**: After validation passes, before returning task result

```typescript
// Line 1232-1248
const validation = await validateTaskResult(task, result, mergedVariables, sessionID)

if (!validation.passed) {
  const failedChecks = validation.checks.filter((c: any) => !c.passed)
  throw new Error(`Validation failed: ${JSON.stringify(failedChecks)}`)
}

// 🎯 INSERT CO-CHANGE ANALYSIS HERE (Line 1239)

return {
  startedAt,
  completedAt,
  duration: completedAt - startedAt,
  tokens: result.tokens,
  cost: result.cost,
  validation,
}
```

---

## 📊 Data Structures Available

### 1. Extract Changed Files
```typescript
import { SessionContext } from "./context"

const changedFiles = SessionContext.getModifiedFiles(sessionID, {
  maxAge: 3600000,
  onlyWrites: true
})
```

### 2. Query Co-Changed Files
```typescript
// Already imported: import { MetabobCLI } from "../util/metabob"

const relatedFiles = await MetabobCLI.suggestRelatedChanges(changedFiles, {
  top_k: 5
})

// Returns:
[{
  file_path: string,
  cochange_score: number,         // 0-1
  total_issues: number,
  high_severity_issues: number,
  critical_issues: number,
  recommendation: string
}]
```

### 3. Access Activity Object
```typescript
// Available in scope as _activity parameter
_activity.id                    // Activity ID
_activity.templateId            // Template ID
_activity.impulses              // Impulse registry
await Activity.save(_activity)  // Save changes
```

### 4. Task Format (for follow-ups)
```typescript
const followUpTask: ActivityTemplate.Task = {
  id: string,
  subagent: "general",
  description: string,
  dependencies: [task.id],       // Depend on current task
  prompt: {
    template: string,            // Handlebars template
    maxTokens: number,
    compressionStrategy: string,
    variables: Array<{
      name: string,
      type: string,
      required: boolean,
      description: string
    }>
  },
  validation: {
    requiredFiles: string[],
    requiredPatterns: string[],
    forbiddenPatterns: string[],
    commands: Array<{
      name: string,
      command: string,
      required: boolean
    }>
  },
  retry: {
    maxAttempts: number,
    strategy: string
  },
  complexity: "simple" | "moderate" | "complex"
}
```

---

## 🔧 Implementation Steps

### Step 1: Add Import
```typescript
// At top of template-executor.ts
import { SessionContext } from "./context"
```

### Step 2: Insert Analysis Code at Line 1239
```typescript
try {
  // Extract changed files
  const changedFiles = SessionContext.getModifiedFiles(sessionID, {
    maxAge: 3600000,
    onlyWrites: true,
  })

  if (changedFiles.length > 0) {
    // Query co-changes
    const relatedFiles = await MetabobCLI.suggestRelatedChanges(changedFiles, {
      top_k: 5,
    })

    // Add follow-up tasks for high-priority co-changes
    for (const cochange of relatedFiles) {
      if (cochange.cochange_score >= 0.7 && cochange.total_issues > 0) {
        // Create and add follow-up task
        // (See full code in insertion guide)
      }
    }
  }
} catch (error) {
  log.warn("co-change analysis failed", { error })
}
```

### Step 3: Test
```bash
# Create test activity
opencode activity --template test-template --variables '{}'

# Verify follow-up tasks added
opencode activity-status | grep "cochange-review-"
```

---

## ⚠️ Key Considerations

### Activity.tasks Field Issue
The `Activity.Info` schema does **NOT** have a `tasks` field by default. Options:

1. **Add to template dynamically** (requires template mutation)
2. **Create follow-up impulses** instead of tasks (lighter weight)
3. **Add tasks field to Activity.Info** schema (requires migration)

**Recommended**: Start with **impulse approach** for Phase 1, then graduate to tasks.

### Fail Gracefully
```typescript
try {
  // co-change analysis
} catch (error) {
  // Don't fail task if analysis fails
  log.warn("co-change analysis failed, continuing", { error })
}
```

---

## 📈 Success Metrics

- ✅ Co-change analysis runs on >90% of completions
- ✅ Analysis completes in <500ms
- ✅ 20% reduction in regression bugs (4 week measurement)
- ✅ <5% false positive rate

---

## 🚀 Rollout Phases

1. **Phase 1**: Silent mode (log only, no tasks) - Week 1
2. **Phase 2**: Impulse mode (suggestions, not forced) - Week 2
3. **Phase 3**: Task mode (automatic follow-ups) - Week 3+

---

## 📝 Next Actions

1. Review full insertion guide: `CPG_COCHANGE_INTEGRATION_INSERTION_GUIDE.md`
2. Implement insertion at line 1239
3. Add SessionContext import
4. Test with simple template
5. Deploy in silent mode first
6. Monitor metrics
7. Tune thresholds
8. Roll out to all activities

---

**Document Version**: 1.0  
**Created**: 2026-02-19  
**Status**: Ready for Implementation
