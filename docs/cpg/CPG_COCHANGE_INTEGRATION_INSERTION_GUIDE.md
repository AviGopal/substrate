# CPG Co-Change Integration: Insertion Guide

## Executive Summary

This guide provides the exact insertion point and implementation details for **CPG Quick Win #1: Activity-Driven Co-Change Workflow**. After a task completes successfully, the system will query metabob for co-changed files with existing issues and dynamically add follow-up review tasks.

**Expected Impact**: 20% reduction in regression bugs, improved code consistency across co-changed files.

---

## Insertion Point

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Line Number**: **1238** (immediately after validation passes, before returning task result)

**Context**: Inside the `executeTask()` function, after validation succeeds but before returning the task execution result.

```typescript
// Line 1232-1248 (Current code)
    // Validate result
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

## Why This Location?

1. **After successful execution**: Task has completed (`result` available)
2. **After validation**: We know task succeeded and produced valid output
3. **Before returning**: Can modify activity before task completion is recorded
4. **Activity object available**: `_activity` is in scope (passed as parameter)
5. **Session ID available**: `sessionID` contains the completed task's session
6. **Template available**: `task` object has task metadata

---

## Data Structures

### 1. Task Result Format

```typescript
// executeTask() returns this structure
{
  startedAt: number,           // Timestamp when task started
  completedAt: number,         // Timestamp when task completed
  duration: number,            // Duration in milliseconds
  tokens: {
    input: number,
    output: number,
    cache: number
  },
  cost: number,               // Cost in dollars
  validation: {
    passed: boolean,
    checks: Array<any>
  }
}
```

### 2. Activity.Info Format

```typescript
// activity object structure (from Activity.Info schema)
interface Activity.Info {
  id: string
  templateId?: string
  tasks?: Array<any>           // ⚠️ Not in base schema, may need to add
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  status: "setup" | "executing" | "completing" | "done" | "failed"
  // ... many other fields
}
```

**⚠️ Important**: The `Activity.Info` schema does NOT have a `tasks` field by default. You'll need to either:
- Add dynamic tasks to `activity.impulses` as task impulses
- Store follow-up tasks in a separate field (e.g., `activity.followUpTasks`)
- Modify template to accept dynamic task injection

### 3. ActivityTemplate.Task Format

```typescript
// Task structure (from ActivityTemplate schema)
interface Task {
  id: string
  subagent: string               // "general", "plan", etc.
  description: string            // Brief task description
  dependencies: string[]         // Task IDs this depends on
  prompt: {
    template: string             // Handlebars template
    maxTokens: number
    compressionStrategy: string
    variables: Array<{
      name: string
      type: string
      required: boolean
      description: string
    }>
  }
  validation: {
    requiredFiles: string[]
    requiredPatterns: string[]
    forbiddenPatterns: string[]
    commands: Array<{
      name: string
      command: string
      required: boolean
    }>
  }
  retry: {
    maxAttempts: number
    strategy: string
    fallbackPrompt?: string
  }
  complexity?: "simple" | "moderate" | "complex"
}
```

---

## How to Extract Changed Files

### Method 1: From SessionID (Recommended)

```typescript
import { SessionContext } from "../session/context"

// Get files modified during task execution
const changedFiles = SessionContext.getModifiedFiles(sessionID, {
  maxAge: 3600000,      // 1 hour
  onlyWrites: true      // Only files written, not just read
})

log.debug("extracted changed files from session", {
  sessionID,
  taskId: task.id,
  fileCount: changedFiles.length,
  files: changedFiles
})
```

### Method 2: From Activity Work Artifacts

```typescript
// If activity captures work artifacts (from activity complete flow)
const changedFiles = _activity.workArtifacts?.filesChanged || []
```

### Method 3: Git Diff (Fallback)

```typescript
// Parse git diff if session tracking unavailable
const diff = await Bun.$`git diff --name-only ${_activity.baseCommit} HEAD`.text()
const changedFiles = diff.trim().split('\n').filter(f => f.length > 0)
```

---

## Sample Implementation Code

```typescript
// 🎯 INSERT AT LINE 1239 in template-executor.ts

// After validation passes, analyze co-changes and add follow-up tasks
try {
  log.debug("starting co-change analysis", {
    taskId: task.id,
    activityId: _activity.id,
    sessionID,
  })

  // Step 1: Extract changed files from task execution
  const { SessionContext } = await import("./context")
  const changedFiles = SessionContext.getModifiedFiles(sessionID, {
    maxAge: 3600000,
    onlyWrites: true,
  })

  if (changedFiles.length === 0) {
    log.debug("no changed files detected, skipping co-change analysis", {
      taskId: task.id,
    })
  } else {
    log.debug("extracted changed files for co-change analysis", {
      taskId: task.id,
      fileCount: changedFiles.length,
      files: changedFiles.slice(0, 5), // Log first 5 for brevity
    })

    // Step 2: Query metabob for co-changed files with issues
    const relatedFiles = await MetabobCLI.suggestRelatedChanges(changedFiles, {
      top_k: 5, // Limit to top 5 co-changed files
    })

    if (relatedFiles.length === 0) {
      log.debug("no co-changed files with issues found", { taskId: task.id })
    } else {
      log.info("found co-changed files with issues", {
        taskId: task.id,
        relatedCount: relatedFiles.length,
        files: relatedFiles.map(f => ({
          path: f.file_path,
          cochangeScore: f.cochange_score,
          issues: f.total_issues,
        })),
      })

      // Step 3: Generate follow-up task for each high-priority co-change
      for (const cochange of relatedFiles) {
        // Only add tasks for files with high co-change score and issues
        if (cochange.cochange_score >= 0.7 && cochange.total_issues > 0) {
          const followUpTaskId = `cochange-review-${task.id}-${Date.now()}`
          
          const followUpTask: ActivityTemplate.Task = {
            id: followUpTaskId,
            subagent: "general",
            description: `Review co-changed file: ${cochange.file_path}`,
            dependencies: [task.id], // Depends on current task
            prompt: {
              template: `# Co-Change Follow-Up Review

The file **{{file_path}}** frequently changes together with files modified in task {{parent_task_id}}.

**Co-Change Score**: {{cochange_score}} (0-1 scale)
**Existing Issues**: {{total_issues}} total, {{high_severity_issues}} high severity
**Recommendation**: {{recommendation}}

## Your Task

Review this file for:
1. Consistency with changes made in the parent task
2. Resolution of existing high-severity issues if related
3. Potential regression bugs from not updating this file

Fix any inconsistencies or related issues you find. Document your analysis.`,
              maxTokens: 8000,
              compressionStrategy: "filter",
              variables: [
                {
                  name: "file_path",
                  type: "string",
                  required: true,
                  description: "Path to co-changed file",
                },
                {
                  name: "parent_task_id",
                  type: "string",
                  required: true,
                  description: "ID of parent task that triggered this review",
                },
                {
                  name: "cochange_score",
                  type: "number",
                  required: true,
                  description: "Co-change correlation score",
                },
                {
                  name: "total_issues",
                  type: "number",
                  required: true,
                  description: "Total issues in file",
                },
                {
                  name: "high_severity_issues",
                  type: "number",
                  required: true,
                  description: "High severity issues",
                },
                {
                  name: "recommendation",
                  type: "string",
                  required: true,
                  description: "Metabob recommendation",
                },
              ],
            },
            validation: {
              requiredFiles: [cochange.file_path],
              requiredPatterns: [],
              forbiddenPatterns: [],
              commands: [],
            },
            retry: {
              maxAttempts: 2,
              strategy: "simple",
            },
            complexity: "simple",
          }

          // Step 4: Add task to template dynamically
          // ⚠️ NOTE: This assumes template is mutable. May need alternative approach.
          const template = await TemplateRepository.get(_activity.templateId!)
          if (template) {
            template.tasks.push(followUpTask)
            
            log.info("added co-change follow-up task", {
              taskId: followUpTaskId,
              parentTaskId: task.id,
              filePath: cochange.file_path,
              cochangeScore: cochange.cochange_score,
              issues: cochange.total_issues,
            })
          }
        }
      }
    }
  }
} catch (error) {
  // Don't fail task if co-change analysis fails
  log.warn("co-change analysis failed, continuing task execution", {
    taskId: task.id,
    error: (error as Error).message,
  })
}
```

---

## Integration Points

### Required Imports

```typescript
// At top of template-executor.ts (already present)
import { MetabobCLI } from "../util/metabob"  // ✅ Already imported
import { TemplateRepository } from "./activity-template-repository"  // ✅ Already imported

// New import needed
import { SessionContext } from "./context"  // ⚠️ Add this import
```

### Metabob Utility Functions

**Already Available**:
- `MetabobCLI.suggestRelatedChanges(changedFiles, options)` - Get co-changed files with issues
- `MetabobCLI.isAvailable()` - Check if metabob is available
- `MetabobCLI.formatIssueContext(issues)` - Format issues for context

**Function Signature**:
```typescript
async function suggestRelatedChanges(
  changedFiles: string[],
  options?: { top_k?: number }
): Promise<Array<{
  file_path: string
  cochange_score: number          // 0-1, higher = stronger correlation
  total_issues: number
  high_severity_issues: number
  critical_issues: number
  recommendation: string
}>>
```

---

## Alternative Approaches

### Option 1: Impulse-Based Follow-Up (Lighter Weight)

Instead of dynamically adding tasks, create follow-up impulses:

```typescript
// Add follow-up impulse instead of task
const impulse: ActivityTemplate.Impulse.Schema = {
  id: `cochange-${task.id}-${cochange.file_path}`,
  type: "cochange-suggestion",
  pointer: {
    type: "memo",
    content: `Co-changed file: ${cochange.file_path}\nScore: ${cochange.cochange_score}\nIssues: ${cochange.total_issues}`,
    source: "cpg-cochange",
  },
  budget: 2000,
}

await Activity.addImpulses(_activity.id, { [impulse.id]: impulse })
```

**Pros**: 
- Doesn't modify template
- Agent can see suggestions in context
- Lightweight, no execution overhead

**Cons**:
- No automatic review, requires agent action
- Less proactive

### Option 2: Post-Activity Follow-Up

Instead of injecting during task execution, run co-change analysis in activity completion hook:

```typescript
// In activity-complete.ts or similar
export async function analyzeCoChanges(activity: Activity.Info) {
  // Aggregate all changed files from activity
  const allChangedFiles = activity.workArtifacts?.filesChanged || []
  
  // Query co-changes
  const related = await MetabobCLI.suggestRelatedChanges(allChangedFiles)
  
  // Create follow-up activity or report
  // ...
}
```

**Pros**:
- Simpler, doesn't touch task execution flow
- Can analyze entire activity holistically

**Cons**:
- Less immediate feedback
- Harder to link to specific tasks

---

## Testing Strategy

### Unit Test

```typescript
// test-cochange-integration.ts
import { TemplateExecutor } from "./template-executor"
import { MetabobCLI } from "../util/metabob"
import { SessionContext } from "./context"

describe("Co-Change Integration", () => {
  it("should add follow-up tasks for co-changed files", async () => {
    // Mock SessionContext.getModifiedFiles
    const mockChangedFiles = ["src/auth.ts", "src/login.ts"]
    jest.spyOn(SessionContext, "getModifiedFiles").mockReturnValue(mockChangedFiles)
    
    // Mock MetabobCLI.suggestRelatedChanges
    const mockCoChanges = [{
      file_path: "src/session.ts",
      cochange_score: 0.85,
      total_issues: 3,
      high_severity_issues: 1,
      critical_issues: 0,
      recommendation: "Review for consistency"
    }]
    jest.spyOn(MetabobCLI, "suggestRelatedChanges").mockResolvedValue(mockCoChanges)
    
    // Execute template
    const result = await TemplateExecutor.execute({
      templateId: "test-template",
      variables: { test: "value" },
    })
    
    // Assert follow-up task was added
    expect(result.tasks).toContainEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^cochange-review-/),
        description: expect.stringContaining("session.ts"),
      })
    )
  })
})
```

### Integration Test

```bash
#!/bin/bash
# test-cochange-workflow.sh

# Create test template with co-change integration
echo "Creating test activity..."
opencode activity --template test-auth-refactor --variables '{"target":"auth.ts"}'

# Verify follow-up tasks were created
echo "Checking for co-change tasks..."
opencode activity-status | grep "cochange-review-"

# Execute follow-up tasks
echo "Executing co-change reviews..."
opencode activity-continue
```

---

## Monitoring & Metrics

### Log Events

```typescript
// Key log events to emit
log.info("co-change-analysis-started", { taskId, activityId, changedFileCount })
log.info("co-change-results", { taskId, relatedFileCount, avgCochangeScore })
log.info("co-change-task-added", { taskId, followUpTaskId, filePath, score })
log.warn("co-change-analysis-failed", { taskId, error })
```

### Metrics to Track

- **Co-change analysis rate**: % of tasks that trigger analysis
- **Follow-up task rate**: % of analyses that add tasks
- **Co-change score distribution**: Histogram of scores
- **Regression reduction**: Compare bug rates before/after
- **False positive rate**: % of follow-ups that find no issues

---

## Rollout Plan

### Phase 1: Silent Mode (Week 1)
- Enable co-change analysis
- Log results but don't add tasks
- Validate accuracy of predictions

### Phase 2: Impulse Mode (Week 2)
- Create follow-up impulses (not tasks)
- Agent sees suggestions but not forced to act
- Measure engagement

### Phase 3: Task Mode (Week 3+)
- Add follow-up tasks dynamically
- Monitor regression bug rates
- Tune thresholds (cochange_score >= 0.7)

---

## Configuration

### Environment Variables

```bash
# Enable/disable co-change integration
CPG_COCHANGE_ENABLED=true

# Minimum co-change score to trigger follow-up
CPG_COCHANGE_MIN_SCORE=0.7

# Minimum issues to trigger follow-up
CPG_COCHANGE_MIN_ISSUES=1

# Maximum follow-up tasks per activity
CPG_COCHANGE_MAX_TASKS=5
```

### Config Schema

```typescript
// In opencode.json or config
{
  "metabob": {
    "cochange": {
      "enabled": true,
      "min_score": 0.7,
      "min_issues": 1,
      "max_follow_up_tasks": 5,
      "mode": "task" | "impulse" | "silent"
    }
  }
}
```

---

## Risk Mitigation

### Risk 1: Too Many Follow-Ups
**Mitigation**: Cap at 5 follow-ups per activity, sort by score+issues

### Risk 2: False Positives
**Mitigation**: High threshold (0.7), require existing issues, allow skip

### Risk 3: Performance Impact
**Mitigation**: Async analysis, fail gracefully, cache results

### Risk 4: Template Mutation
**Mitigation**: Clone template before modifying, or use impulse approach

---

## Success Criteria

✅ **Technical**:
- Co-change analysis runs on >90% of task completions
- Analysis completes in <500ms
- No task failures due to co-change errors

✅ **Product**:
- 20% reduction in regression bugs (measured over 4 weeks)
- 10% increase in co-changed file consistency
- <5% false positive rate (follow-ups that find nothing)

✅ **Developer Experience**:
- Follow-up tasks are actionable (not noise)
- Clear explanation of why file needs review
- Can skip follow-up without penalty

---

## Next Steps

1. **Implement insertion** at line 1239 of template-executor.ts
2. **Add SessionContext import** at top of file
3. **Test with simple template** (2-3 tasks, known co-changes)
4. **Validate metabob integration** works end-to-end
5. **Add configuration** for thresholds and mode
6. **Deploy in silent mode** first (log only)
7. **Monitor metrics** for 1 week before enabling tasks
8. **Tune thresholds** based on false positive rate
9. **Roll out to all activities** if metrics look good

---

## Questions & Answers

**Q: What if metabob is unavailable?**
A: Analysis fails gracefully with warning log. Task still succeeds.

**Q: What if no files changed?**
A: Analysis skips, no follow-ups added. Normal flow continues.

**Q: Can agent skip follow-up tasks?**
A: Yes, tasks are added with `complexity: "simple"` and can be skipped.

**Q: What if co-change score is low but issues are high?**
A: Currently requires BOTH high score AND issues. Can tune this.

**Q: How to prevent duplicate follow-ups?**
A: Check existing tasks before adding, or dedupe by file path.

**Q: What about circular co-changes?**
A: Use task dependencies to prevent cycles. Follow-ups depend on parent.

---

## References

- **MetabobCLI.suggestRelatedChanges**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:L200`
- **SessionContext.getModifiedFiles**: `repos/metabob-opencode/packages/opencode/src/session/context.ts:L125`
- **Activity.Info schema**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:L152`
- **ActivityTemplate.Task schema**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- **Template execution flow**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts:L66`

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-19  
**Author**: OpenCode Analysis Agent  
**Status**: Ready for Implementation
