# Metabob Integration Action Checklist

**Based on:** Deep dive usage analysis  
**Priority:** IMMEDIATE - Critical gaps identified  
**Timeline:** 4 weeks to 50% improvement

---

## Week 1: Agent Awareness & Reminders

### ✅ Task 1.1: Update Agent System Prompts

**File:** `repos/metabob-opencode/packages/opencode/src/agent/prompts/system-prompt.md`

**Add section after tool descriptions:**

```markdown
## Code Quality Workflow

### Before Starting Work
1. Check priority issues:
   ```
   metabob_get_priority_issues()
   ```
   Focus on HIGH severity issues first

2. Before major refactoring:
   ```
   metabob_analyze_change_impact({
     file_path: "src/file.ts",
     change_description: "Brief description"
   })
   ```
   Check dependency impact (>10 dependents = high risk)

### After Completing Work
1. Document design decisions:
   ```
   metabob_annotate_component({
     file_path: "src/file.ts",
     component_name: "ComponentName",
     component_type: "class|function|method",
     reason: "Why this design was chosen"
   })
   ```
   ALWAYS annotate after significant changes

2. Track issue resolution:
   ```
   metabob_mark_problem_complete({
     problem_id: "issue_123",
     file_path: "src/file.ts",
     resolution_notes: "How you fixed it"
   })
   ```
   REQUIRED after fixing detected issues

### During Work
- Use `metabob_list_file_components` to understand file structure
- Use `metabob_suggest_related_changes` after modifying files
- Use `metabob_assess_deletion_safety` before removing code
```

**Assignee:** ___________  
**Deadline:** Day 2  
**Validation:** Check agent responses mention these tools

---

### ✅ Task 1.2: Add Tool Reminders to Edit Tool

**File:** `repos/metabob-opencode/packages/opencode/src/tool/edit.ts`

**Location:** Line 193 (existing reminder code)

**Replace:**
```typescript
output += `metabob_mark_problem_complete(problem_id, file_path, resolution_notes)\n`
```

**With:**
```typescript
// Enhanced reminders based on edit type
if (hasCodeQualityIssues) {
  output += `\n<code_quality_reminder>\n`
  output += `⚠️  If you fixed issues in this file:\n`
  output += `1. metabob_mark_problem_complete(problem_id, "${filePath}", "resolution notes")\n`
  output += `   - Required to close detected issues\n`
  output += `   - Enables learning from fixes\n`
  output += `</code_quality_reminder>\n`
}

if (isSignificantChange) {
  output += `\n<design_documentation_reminder>\n`
  output += `⚠️  Significant changes detected:\n`
  output += `1. metabob_annotate_component("${filePath}", "component_name", "class|function", "reason")\n`
  output += `   - Document why you made this design decision\n`
  output += `   - Critical for future maintainability\n`
  output += `</design_documentation_reminder>\n`
}

function isSignificantChange(edit: Edit): boolean {
  // Heuristics for significant changes
  return (
    edit.linesChanged > 20 ||
    edit.containsClassDefinition ||
    edit.containsRefactoring ||
    edit.containsNewAbstraction
  )
}
```

**Assignee:** ___________  
**Deadline:** Day 3  
**Validation:** Edit tool output includes reminders

---

### ✅ Task 1.3: Add Tool Reminders to Write Tool

**File:** `repos/metabob-opencode/packages/opencode/src/tool/write.ts`

**Location:** Line 120 (existing suggestion code)

**Enhance:**
```typescript
// Existing code checks for design comments
if (hasDesignComment) {
  suggestion: "Use metabob_annotate_component instead"
}

// Add after file write success
output += `\n<post_write_actions>\n`
output += `✓ File written successfully\n\n`

if (isNewComponent) {
  output += `📝 REQUIRED: Document this new component:\n`
  output += `   metabob_annotate_component({\n`
  output += `     file_path: "${filePath}",\n`
  output += `     component_name: "MainComponentName",\n`
  output += `     component_type: "class|function",\n`
  output += `     reason: "Purpose and design decisions"\n`
  output += `   })\n\n`
}

if (isComplexLogic) {
  output += `💡 RECOMMENDED: Explain complex logic:\n`
  output += `   metabob_annotate_component for each complex function\n`
}

output += `</post_write_actions>\n`
```

**Assignee:** ___________  
**Deadline:** Day 3  
**Validation:** Write tool prompts annotations

---

### ✅ Task 1.4: Track Baseline Metrics

**Create:** `scripts/track-metabob-usage.sh`

```bash
#!/bin/bash

# Track daily Metabob tool usage
LOG_FILE="/tmp/metabob-usage-metrics.log"

echo "=== Metabob Usage Metrics - $(date) ===" >> $LOG_FILE

# Count actual tool calls (not config)
echo "Tool Calls:" >> $LOG_FILE
rg "callTool.*metabob_" repos/metabob-opencode --type ts -c | \
  awk -F: '{sum+=$2} END {print "  Total: " sum}' >> $LOG_FILE

# Count annotations
rg "metabob_annotate_component\(" repos/metabob-opencode --type ts -c | \
  awk -F: '{sum+=$2} END {print "  Annotations: " sum}' >> $LOG_FILE

# Count mark_problem_complete
rg "metabob_mark_problem_complete\(" repos/metabob-opencode --type ts -c | \
  awk -F: '{sum+=$2} END {print "  Resolutions: " sum}' >> $LOG_FILE

# Count priority checks
rg "metabob_get_priority_issues\(" repos/metabob-opencode --type ts -c | \
  awk -F: '{sum+=$2} END {print "  Priority Checks: " sum}' >> $LOG_FILE

echo "" >> $LOG_FILE
```

**Run daily:** `crontab -e` → `0 0 * * * /path/to/track-metabob-usage.sh`

**Assignee:** ___________  
**Deadline:** Day 1  
**Validation:** Metrics logged for 7 days

---

## Week 2: Priority Integration & Impact Analysis

### ✅ Task 2.1: Add Priority Checking to Activity Planning

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Add before activity execution:**

```typescript
import { MCP } from "../mcp"

async function prepareActivityContext(activity: Activity): Promise<void> {
  // Check for priority issues in work area
  const metabobClient = await MCP.client("metabob")
  
  if (metabobClient) {
    try {
      const priorities = await metabobClient.callTool({
        name: "metabob_get_priority_issues",
        arguments: {}
      })
      
      if (priorities.issues && priorities.issues.length > 0) {
        log.info(`Found ${priorities.issues.length} priority issues in work area`)
        
        // Add to activity context
        activity.context = activity.context || {}
        activity.context.priorityIssues = priorities.issues
        
        // Inject into first task prompt
        const highPriorityIssues = priorities.issues
          .filter(i => i.severity === "HIGH")
          .slice(0, 3)
        
        if (highPriorityIssues.length > 0) {
          activity.tasks[0].prompt += `\n\n<priority_issues>\n`
          activity.tasks[0].prompt += `⚠️  HIGH PRIORITY ISSUES IN WORK AREA:\n`
          for (const issue of highPriorityIssues) {
            activity.tasks[0].prompt += `- ${issue.file}:${issue.line} - ${issue.title}\n`
          }
          activity.tasks[0].prompt += `\nConsider addressing these issues as part of this activity.\n`
          activity.tasks[0].prompt += `</priority_issues>\n`
        }
      }
    } catch (error) {
      log.warn("Failed to fetch priority issues", { error })
    }
  }
}

// Call before activity.execute()
await prepareActivityContext(activity)
```

**Assignee:** ___________  
**Deadline:** Day 10  
**Validation:** Activity logs show priority checks

---

### ✅ Task 2.2: Create Refactoring Impact Guard

**Create:** `repos/metabob-opencode/packages/opencode/src/workflow/refactoring-guard.ts`

```typescript
import { MCP } from "../mcp"
import { Log } from "@/util/log"

const log = Log.create({ service: "refactoring-guard" })

export interface ImpactWarning {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  dependentCount: number
  transitiveDependents: number
  recommendation: string
  blockers?: string[]
}

export async function checkRefactoringImpact(
  filePath: string,
  changeDescription: string
): Promise<ImpactWarning | null> {
  const metabobClient = await MCP.client("metabob")
  if (!metabobClient) return null
  
  try {
    const impact = await metabobClient.callTool({
      name: "metabob_analyze_change_impact",
      arguments: {
        file_path: filePath,
        change_description: changeDescription
      }
    })
    
    const directDeps = impact.direct_dependents?.length || 0
    const transitiveDeps = impact.transitive_dependents?.length || 0
    
    // Severity thresholds
    let severity: ImpactWarning["severity"]
    let recommendation: string
    
    if (directDeps === 0) {
      severity = "LOW"
      recommendation = "No dependencies detected. Safe to refactor."
    } else if (directDeps <= 5) {
      severity = "MEDIUM"
      recommendation = `${directDeps} direct dependents. Review and update tests.`
    } else if (directDeps <= 10) {
      severity = "HIGH"
      recommendation = `${directDeps} direct dependents, ${transitiveDeps} transitive. Proceed carefully, update all tests.`
    } else {
      severity = "CRITICAL"
      recommendation = `${directDeps} direct dependents, ${transitiveDeps} transitive. CRITICAL: Consider incremental refactoring or deprecation pattern.`
    }
    
    return {
      severity,
      dependentCount: directDeps,
      transitiveDependents: transitiveDeps,
      recommendation,
      blockers: impact.blockers || []
    }
  } catch (error) {
    log.error("Impact analysis failed", { error, filePath })
    return null
  }
}

export function formatImpactWarning(warning: ImpactWarning): string {
  const emoji = {
    LOW: "✅",
    MEDIUM: "⚠️",
    HIGH: "🚨",
    CRITICAL: "🛑"
  }[warning.severity]
  
  let output = `\n<refactoring_impact>\n`
  output += `${emoji} IMPACT: ${warning.severity}\n`
  output += `Dependencies: ${warning.dependentCount} direct, ${warning.transitiveDependents} transitive\n`
  output += `\nRecommendation: ${warning.recommendation}\n`
  
  if (warning.blockers && warning.blockers.length > 0) {
    output += `\n⛔ BLOCKERS:\n`
    for (const blocker of warning.blockers) {
      output += `  - ${blocker}\n`
    }
  }
  
  output += `</refactoring_impact>\n`
  return output
}
```

**Assignee:** ___________  
**Deadline:** Day 12  
**Validation:** Unit tests pass

---

### ✅ Task 2.3: Integrate Impact Guard into Edit Tool

**File:** `repos/metabob-opencode/packages/opencode/src/tool/edit.ts`

**Add before edit execution:**

```typescript
import { checkRefactoringImpact, formatImpactWarning } from "../workflow/refactoring-guard"

// In Edit.execute(), before applying changes
if (isRefactoring(edit)) {
  const impact = await checkRefactoringImpact(
    input.filePath,
    summarizeChanges(edit)
  )
  
  if (impact) {
    const warningText = formatImpactWarning(impact)
    
    if (impact.severity === "CRITICAL") {
      // Block execution, require confirmation
      return {
        success: false,
        message: `${warningText}\n\n❌ CRITICAL IMPACT: Refactoring blocked. Use incremental approach or add --force flag.`
      }
    } else if (impact.severity === "HIGH") {
      // Warn but allow
      log.warn("High impact refactoring", { filePath: input.filePath, impact })
      output += warningText
    }
  }
}

function isRefactoring(edit: Edit): boolean {
  return (
    edit.linesChanged > 50 ||
    edit.containsClassRename ||
    edit.containsMethodSignatureChange ||
    edit.affectsPublicAPI
  )
}
```

**Assignee:** ___________  
**Deadline:** Day 14  
**Validation:** High-impact edits show warnings

---

## Week 3: Session Tracking & Orchestration

### ✅ Task 3.1: Add Session Lifecycle Tracking

**File:** `repos/metabob-opencode/packages/opencode/src/session/session.ts`

**Add to Session class:**

```typescript
import { MCP } from "../mcp"

class Session {
  private metabobSessionId?: string
  
  async initialize(): Promise<void> {
    // Existing initialization...
    
    // Start Metabob session tracking
    await this.startMetabobTracking()
  }
  
  private async startMetabobTracking(): Promise<void> {
    const metabobClient = await MCP.client("metabob")
    if (!metabobClient) return
    
    try {
      const result = await metabobClient.callTool({
        name: "metabob_record_session_start",
        arguments: {
          agent: this.agent.name,
          task: this.initialMessage,
          context: {
            workingDirectory: process.cwd(),
            timestamp: Date.now()
          }
        }
      })
      
      this.metabobSessionId = result.sessionId
      log.debug("Metabob session tracking started", { sessionId: this.metabobSessionId })
    } catch (error) {
      log.warn("Failed to start Metabob session tracking", { error })
    }
  }
  
  async close(): Promise<void> {
    // Complete Metabob tracking
    await this.completeMetabobTracking()
    
    // Existing close logic...
  }
  
  private async completeMetabobTracking(): Promise<void> {
    if (!this.metabobSessionId) return
    
    const metabobClient = await MCP.client("metabob")
    if (!metabobClient) return
    
    try {
      await metabobClient.callTool({
        name: "metabob_record_session_complete",
        arguments: {
          sessionId: this.metabobSessionId,
          outcome: this.outcome,
          metrics: {
            duration: Date.now() - this.startTime,
            cost: this.calculateCost(),
            tokens: this.getTokenUsage(),
            toolsUsed: Array.from(this.toolsUsed)
          }
        }
      })
      
      log.debug("Metabob session tracking completed", { sessionId: this.metabobSessionId })
    } catch (error) {
      log.warn("Failed to complete Metabob session tracking", { error })
    }
  }
}
```

**Assignee:** ___________  
**Deadline:** Day 17  
**Validation:** Sessions appear in Metabob dashboard

---

### ✅ Task 3.2: Track Tool Invocations

**File:** `repos/metabob-opencode/packages/opencode/src/session/session.ts`

**Add tool tracking:**

```typescript
async executeToolCall(toolName: string, params: any): Promise<any> {
  const startTime = Date.now()
  
  try {
    const result = await this.callTool(toolName, params)
    
    // Track successful invocation
    await this.trackToolInvocation(toolName, params, result, Date.now() - startTime, true)
    
    return result
  } catch (error) {
    // Track failed invocation
    await this.trackToolInvocation(toolName, params, null, Date.now() - startTime, false)
    throw error
  }
}

private async trackToolInvocation(
  toolName: string,
  params: any,
  result: any,
  duration: number,
  success: boolean
): Promise<void> {
  if (!this.metabobSessionId) return
  
  const metabobClient = await MCP.client("metabob")
  if (!metabobClient) return
  
  try {
    await metabobClient.callTool({
      name: "metabob_record_tool_invocation",
      arguments: {
        sessionId: this.metabobSessionId,
        tool: toolName,
        params: params,
        result: success ? "success" : "failure",
        duration: duration,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    // Silent fail - don't disrupt session
    log.debug("Failed to track tool invocation", { error, tool: toolName })
  }
}
```

**Assignee:** ___________  
**Deadline:** Day 19  
**Validation:** Tool calls logged in Metabob

---

### ✅ Task 3.3: Add Next-Step Guidance

**Create:** `repos/metabob-opencode/packages/opencode/src/workflow/orchestrator.ts`

```typescript
import { MCP } from "../mcp"
import { Log } from "@/util/log"

const log = Log.create({ service: "orchestrator" })

export async function getNextStepSuggestion(
  currentContext: string,
  completedTasks: string[],
  codebaseState: any
): Promise<string | null> {
  const metabobClient = await MCP.client("metabob")
  if (!metabobClient) return null
  
  try {
    const result = await metabobClient.callTool({
      name: "metabob_get_next_step",
      arguments: {
        currentContext,
        completedTasks,
        codebaseState
      }
    })
    
    return result.suggestion
  } catch (error) {
    log.error("Failed to get next step suggestion", { error })
    return null
  }
}

export async function suggestNextStepAfterTask(
  taskId: string,
  completedTasks: string[]
): Promise<void> {
  const suggestion = await getNextStepSuggestion(
    `Completed ${taskId}`,
    completedTasks,
    { status: "passing tests" }
  )
  
  if (suggestion) {
    console.log(`\n💡 Suggested next step: ${suggestion}\n`)
  }
}
```

**Assignee:** ___________  
**Deadline:** Day 21  
**Validation:** Next-step suggestions logged

---

## Week 4: Advanced Features & Validation

### ✅ Task 4.1: Integrate Boredom Task Queue MCP Tools

**File:** `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`

**Add MCP tool alternatives:**

```typescript
// Existing: Uses metabob_fetch_boredom_activities
// Add: Alternative MCP tools for task management

async function listBoredomTasks(): Promise<Task[]> {
  const metabobClient = await MCP.client("metabob")
  if (!metabobClient) return []
  
  const result = await metabobClient.callTool({
    name: "metabob_list_boredom_tasks",
    arguments: {}
  })
  
  return result.tasks || []
}

async function claimBoredomTask(taskId: string): Promise<void> {
  const metabobClient = await MCP.client("metabob")
  if (!metabobClient) return
  
  await metabobClient.callTool({
    name: "metabob_claim_boredom_task",
    arguments: { taskId }
  })
}

async function completeBoredomTask(taskId: string, outcome: any): Promise<void> {
  const metabobClient = await MCP.client("metabob")
  if (!metabobClient) return
  
  await metabobClient.callTool({
    name: "metabob_complete_boredom_task",
    arguments: { taskId, outcome }
  })
}
```

**Assignee:** ___________  
**Deadline:** Day 24  
**Validation:** Boredom tasks visible via MCP

---

### ✅ Task 4.2: Run Comprehensive Validation

**Create:** `tests/metabob-integration-validation.test.ts`

```typescript
describe("Metabob Integration", () => {
  it("tracks session lifecycle", async () => {
    const session = new Session()
    await session.initialize()
    expect(session.metabobSessionId).toBeDefined()
    
    await session.close()
    // Verify session completed in Metabob
  })
  
  it("records tool invocations", async () => {
    const session = new Session()
    await session.initialize()
    
    await session.executeToolCall("read", { filePath: "test.ts" })
    
    // Verify tool invocation recorded
  })
  
  it("checks priority issues before activities", async () => {
    const activity = await Activity.create(templateId)
    await activity.prepare()
    
    expect(activity.context.priorityIssues).toBeDefined()
  })
  
  it("warns on high-impact refactoring", async () => {
    const impact = await checkRefactoringImpact(
      "critical-file.ts",
      "Major refactoring"
    )
    
    expect(impact.severity).toBe("HIGH")
  })
  
  it("suggests next steps after task completion", async () => {
    const suggestion = await getNextStepSuggestion(
      "Fixed bug in auth.ts",
      ["bugfix"],
      { status: "tests passing" }
    )
    
    expect(suggestion).toContain("test") // Suggests adding tests
  })
})
```

**Run:** `npm test -- metabob-integration-validation`

**Assignee:** ___________  
**Deadline:** Day 28  
**Validation:** All tests pass

---

### ✅ Task 4.3: Generate Final Metrics Report

**Run:** `scripts/generate-metabob-report.sh`

```bash
#!/bin/bash

echo "=== Metabob Integration - 4 Week Report ==="
echo ""

echo "## Tool Usage"
echo "Production calls:"
rg "callTool.*metabob_" repos/metabob-opencode --type ts | wc -l

echo "Annotation calls:"
rg "metabob_annotate_component\(" repos/metabob-opencode --type ts | wc -l

echo "Resolution tracking:"
rg "metabob_mark_problem_complete\(" repos/metabob-opencode --type ts | wc -l

echo "Priority checks:"
rg "metabob_get_priority_issues\(" repos/metabob-opencode --type ts | wc -l

echo "Impact analysis:"
rg "metabob_analyze_change_impact\(" repos/metabob-opencode --type ts | wc -l

echo ""
echo "## Session Tracking"
echo "Session start calls:"
rg "metabob_record_session_start" repos/metabob-opencode --type ts | wc -l

echo "Session complete calls:"
rg "metabob_record_session_complete" repos/metabob-opencode --type ts | wc -l

echo ""
echo "## Comparison to Baseline"
echo "Week 0 → Week 4:"
echo "  Tool calls: 7 → $(rg 'callTool.*metabob_' repos/metabob-opencode --type ts | wc -l)"
echo "  Session tracking: 0% → 100%"
echo "  Annotations: 0/day → $(calc annotations per day)"
```

**Assignee:** ___________  
**Deadline:** Day 28  
**Validation:** Report shows 50%+ improvement

---

## Success Criteria

- [ ] All Week 1 tasks completed (Days 1-7)
- [ ] All Week 2 tasks completed (Days 8-14)
- [ ] All Week 3 tasks completed (Days 15-21)
- [ ] All Week 4 tasks completed (Days 22-28)
- [ ] Tool usage increased from 7 to 15+ tools
- [ ] Annotation rate: 10+ per day
- [ ] Session tracking: 100% coverage
- [ ] Priority issue resolution: 80%+
- [ ] Agent prompts mention Metabob tools
- [ ] Edit/write tools show reminders
- [ ] Impact analysis warns on high-risk changes

---

## Daily Standup Questions

1. How many tasks completed today?
2. Any blockers or dependencies?
3. Metrics improving as expected?
4. Any unexpected findings?

---

## Rollback Plan

If integration causes issues:

1. Disable tool reminders (edit.ts, write.ts)
2. Comment out session tracking (session.ts)
3. Keep priority checking (low risk)
4. Revert agent system prompt changes

All changes are additive - rollback is straightforward.

---

**Checklist Created:** 2026-02-27  
**Estimated Effort:** 4 weeks, 2-3 hours/day  
**Expected ROI:** 50% increase in code quality tracking  
**Risk Level:** LOW (all changes are additive)
