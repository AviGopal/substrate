# Vessel System Fixes - Implementation Plan

## Problem Summary

We successfully proved the vessel concept works, but identified critical issues:

1. **Thompson Sampling recommends wrong templates** - "test-tool-calling" for file edit goal
2. **Goal completion detection is naive** - Just checks if last activity succeeded, doesn't verify actual goal
3. **LLM hallucination not prevented** - Says "success" even when file unchanged

---

## Fix 1: Objective Goal Completion Verification

### Current Problem
```typescript
// goal-processor.ts line 479-482
if (lastExecution.status === "completed") {
  return { complete: true, reason: "Activity completed successfully" }
}
```

**Issue:** Trusts activity status without verifying actual outcome.

### Solution: Add Verification Step

```typescript
isGoalComplete(goal: Goal, executions: ActivityExecution[]): { complete: boolean; reason: string } {
  if (executions.length === 0) {
    return { complete: false, reason: "No activities executed yet" }
  }

  const lastExecution = executions[executions.length - 1]
  
  if (lastExecution.status === "failed") {
    return { complete: false, reason: "Last activity failed" }
  }

  if (lastExecution.status === "completed") {
    // NEW: Verify goal actually achieved
    const verification = this.verifyGoalAchievement(goal, executions)
    
    if (verification.verified) {
      return { complete: true, reason: verification.reason }
    } else {
      return { complete: false, reason: `Activity succeeded but goal not achieved: ${verification.reason}` }
    }
  }

  return { complete: false, reason: "Activity still in progress" }
}

// NEW METHOD
private verifyGoalAchievement(goal: Goal, executions: ActivityExecution[]): { verified: boolean; reason: string } {
  // Check goal-specific success criteria
  
  // For file modification goals
  if (goal.intent.includes('change') || goal.intent.includes('modify') || goal.intent.includes('edit')) {
    // Check if any files were actually modified
    const filesModified = executions.reduce((sum, exec) => sum + (exec.metrics?.filesModified || 0), 0)
    
    if (filesModified === 0) {
      return { verified: false, reason: "No files were modified" }
    }
    
    // TODO: Could add more specific checks based on goal.context.files
    return { verified: true, reason: `${filesModified} files modified` }
  }
  
  // For test goals
  if (goal.intent.includes('test')) {
    // Check if tests were run
    const hasTestOutput = executions.some(exec => 
      exec.taskResults?.some(tr => tr.result?.includes('test') || tr.result?.includes('pass'))
    )
    
    if (!hasTestOutput) {
      return { verified: false, reason: "No test execution detected" }
    }
    
    return { verified: true, reason: "Tests executed" }
  }
  
  // Default: trust activity status (but log warning)
  console.warn("[GoalProcessor] No specific verification for goal type:", goal.type)
  return { verified: true, reason: "Activity completed (no verification available)" }
}
```

---

## Fix 2: Better Template Recommendation

### Current Problem
Backend Thompson Sampling doesn't understand goal semantics well enough.

### Short-term Solution: Fallback Templates

Add a fallback mechanism that provides known-good templates for common goal patterns:

```typescript
// goal-processor.ts - in getRecommendations()

async getRecommendations(goal: Goal, loadedImpulseIds: string[] = [], limit: number = 3): Promise<ActivityRecommendation[]> {
  // Try backend first
  const backendRecs = await this.getBackendRecommendations(goal, loadedImpulseIds, limit)
  
  // If backend recommendations exist, use them
  if (backendRecs.length > 0) {
    return backendRecs
  }
  
  // FALLBACK: Use hardcoded known-good templates for common patterns
  console.warn("[GoalProcessor] No backend recommendations, using fallback templates")
  return this.getFallbackTemplates(goal, limit)
}

private getFallbackTemplates(goal: Goal, limit: number): ActivityRecommendation[] {
  const fallbacks: ActivityRecommendation[] = []
  
  // File modification goals
  if (goal.intent.match(/change|modify|edit|update.*file/i)) {
    fallbacks.push({
      templateId: 'simple-file-edit', // Create this template
      selectionMetadata: { source: 'fallback', confidence: 0.8 },
      variables: goal.context || {}
    })
  }
  
  // Testing goals
  if (goal.intent.match(/test|verify/i)) {
    fallbacks.push({
      templateId: 'run-tests',
      selectionMetadata: { source: 'fallback', confidence: 0.7 },
      variables: goal.context || {}
    })
  }
  
  // Code analysis goals
  if (goal.intent.match(/analyze|explore|find/i)) {
    fallbacks.push({
      templateId: 'explore-codebase',
      selectionMetadata: { source: 'fallback', confidence: 0.9 },
      variables: goal.context || {}
    })
  }
  
  return fallbacks.slice(0, limit)
}
```

### Long-term Solution: Improve Backend

The backend needs better semantic understanding:
- Embedding-based similarity search on goal intent
- Better category matching (tool vs feature vs bugfix)
- Learn from failed recommendations (penalize templates that don't achieve goal)

---

## Fix 3: Create Reliable Template Library

### Templates to Create

1. **simple-file-edit.json** - Edit files with specific string replacements
2. **add-function.json** - Add new function to existing file  
3. **fix-syntax-error.json** - Fix TypeScript/JavaScript syntax errors
4. **run-tests.json** - Execute test suite and report results
5. **explore-codebase.json** - Search and analyze code

Store in: `repos/minibob/templates/core/`

### Template Structure

```json
{
  "id": "simple-file-edit",
  "name": "Simple File Edit",
  "category": "tool",
  "description": "Edit a file by replacing specific strings",
  "variables": [
    {
      "name": "filePath",
      "type": "string",
      "required": true
    },
    {
      "name": "changes",
      "type": "array",
      "description": "Array of {oldString, newString} pairs"
    }
  ],
  "tasks": [
    {
      "id": "read-file",
      "description": "Read the target file",
      "prompt": {
        "template": "Read file: {{filePath}}\n\nUse: read({ filePath: \"{{filePath}}\" })",
        "variables": ["filePath"]
      }
    },
    {
      "id": "apply-changes",
      "description": "Apply each change",
      "prompt": {
        "template": "Apply these changes to {{filePath}}:\n\n{{changes}}\n\nFor each change, use:\nedit({ filePath: \"{{filePath}}\", oldString: \"...\", newString: \"...\" })",
        "variables": ["filePath", "changes"]
      }
    },
    {
      "id": "verify",
      "description": "Verify changes applied",
      "prompt": {
        "template": "Read the file again and verify all changes were applied:\nread({ filePath: \"{{filePath}}\" })",
        "variables": ["filePath"]
      },
      "validation": {
        "requiredToolCalls": ["read"],
        "minimumToolCalls": 1
      }
    }
  ],
  "successCriteria": {
    "filesModified": { "min": 1 },
    "requiredTools": ["edit", "read"]
  }
}
```

---

## Implementation Order

### Phase 1: Objective Verification (Today)
1. ✅ Add `verifyGoalAchievement()` method to GoalProcessor
2. ✅ Update `isGoalComplete()` to use verification
3. ✅ Test with file modification goal
4. ✅ Verify hallucination no longer possible

### Phase 2: Fallback Templates (Today)
1. ✅ Add `getFallbackTemplates()` method
2. ✅ Update `getRecommendations()` to use fallbacks
3. ✅ Create 3-5 core templates
4. ✅ Test goal processor uses correct template

### Phase 3: Backend Improvement (Later)
1. ⏳ Add semantic similarity to recommendation API
2. ⏳ Track template effectiveness per goal type
3. ⏳ Penalize templates that don't achieve goals

---

## Testing Plan

### Test 1: Verify Goal Completion Check
```bash
cd repos/minibob
# Run test that should FAIL verification
# Activity succeeds but doesn't modify file
# Expect: complete=false, reason="No files were modified"
```

### Test 2: Verify Fallback Templates
```bash
# Goal: "Edit file test.ts to change X to Y"
# Expect: Uses simple-file-edit template (not test-tool-calling)
# Expect: File actually modified
# Expect: Verification passes
```

### Test 3: End-to-End Vessel Test
```bash
bun run test-vessel-first-attempt.ts
# With fixes, should now PASS
```

---

## Success Criteria

✅ GoalProcessor doesn't hallucinate success  
✅ File edit goals use file-edit templates  
✅ Verification catches when goal not achieved  
✅ test-vessel-first-attempt.ts passes  
✅ Cost <$1 per goal execution  

---

## Files to Modify

1. `repos/minibob/src/goal-processor.ts` - Add verification & fallbacks
2. `repos/minibob/templates/core/simple-file-edit.json` - Create template
3. `repos/minibob/test-vessel-first-attempt.ts` - Update to use goal processor

---

## Next Steps

1. Implement Fix 1 (verification)
2. Test verification works
3. Implement Fix 2 (fallbacks)
4. Create core templates
5. Run full test suite
6. Document success
