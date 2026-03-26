# Activity Replay and State Architecture

**Last Updated**: February 19, 2026  
**Status**: ✅ Comprehensive Analysis

---

## Overview

This document explains how OpenCode:
1. **Replays activities** from specific tasks
2. **Records state** before and after each task
3. **Measures consistency** between template variants
4. **Maintains functionality** across executions
5. **Enables metabob-opencode** to get the information during execution

---

## 1. How We Replay Activities

### Activity Replay Tool (`activity-replay.ts`)

**Purpose**: Resume failed activities from specific tasks without re-running successful steps

**Key Features**:
- Load original activity and template from storage
- Determine starting task (failed task or user-specified)
- Create new replay activity with inherited impulses
- Execute remaining tasks in dependency order
- Track skipped vs executed tasks

### Replay Process

```typescript
// File: repos/metabob-opencode/packages/opencode/src/tool/activity-replay.ts

activity_replay({
  activityId: "act_abc123",           // Original activity
  startFromTask: "task-3",            // Resume from here
  overrideVariables: { ... },         // Override variables
  skipValidation: false               // Run validation checks
})
```

**What happens**:

1. **Load Original Activity** (lines 46-54)
   - Read Activity.Info from storage
   - Verify activity has template
   - Load template used by original activity

2. **Create Replay Activity** (lines 88-113)
   - Clone directory, branch, baseCommit from original
   - Inherit impulses from original (line 111)
   - Link back to parent via `parentActivityId` (line 108)
   - Set status to "executing"

3. **Execute From Starting Point** (lines 273-568)
   - Topological sort for dependency order (lines 632-667)
   - Skip tasks before starting point (marked as "skipped")
   - Execute remaining tasks sequentially
   - Stop on first failure

4. **Track Progress** (lines 308-314)
   ```typescript
   taskResults: Array<{
     taskId: string
     status: "skipped" | "in_progress" | "completed" | "failed"
     attempts: number
     duration?: number
     cost?: number
   }>
   ```

---

## 2. How We Record Instructional and Functional State

### Instructional State (Template + Variables)

**Stored in**: `Activity.Info` schema

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/activity.ts

interface Activity.Info {
  // Instructional state (what was requested)
  templateId: string              // Template used
  templateVersion: number         // Template version
  variables: Record<string, unknown>  // Input variables
  reason: string                  // Why this activity
  
  // Execution plan
  impulses: Record<string, Impulse>  // Context requirements
  callingSessionId: string        // Who invoked this
}
```

**Recorded at**: Activity creation (Activity.create)

**Purpose**: 
- Recreate exact execution context
- Enable replay with modified variables
- Track template evolution over time

### Functional State (Execution Evidence)

**Stored in**: Multiple evidence layers in Activity.Info

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/activity.ts (lines 255-336)

interface Activity.Info {
  // Layer 1: Execution Evidence (what happened)
  executionEvidence?: {
    sessionsSpawned: Array<{
      sessionID: string
      taskId: string
      agentType: string
      startTime: number
      endTime: number
      messageCount: number
      toolCallCount: number
    }>
    toolCalls: Array<{
      sessionID: string
      tool: string
      timestamp: number
    }>
  }
  
  // Layer 2: Validation Evidence (correctness checks)
  validationEvidence?: {
    executed: boolean
    timestamp: number
    requiredFiles: Array<{
      file: string
      exists: boolean
      createdByActivity: boolean
    }>
    commands: Array<{
      name: string
      command: string
      exitCode: number
      passed: boolean
      duration: number
    }>
    overallPassed: boolean
  }
  
  // Layer 3: Work Artifacts (what was produced)
  workArtifacts?: {
    filesChanged: string[]
    commitsMade: string[]
  }
  
  // Layer 4: Agent Decisions (reasoning trace)
  agentDecisions: Array<{
    step: number
    taskId: string
    context: string
    decision: string
    reasoning: string
    outcome: "success" | "failure" | "partial" | "pending"
    timestamp: number
  }>
  
  // Layer 5: Correctness Verdict (computed quality)
  correctnessVerdict?: {
    computed: boolean
    verdict: "correct" | "suspicious" | "incorrect" | "unknown"
    confidence: number
    issues: Array<{
      severity: "critical" | "warning" | "info"
      category: string
      message: string
    }>
  }
}
```

**Recorded at**: Each task execution

**Collection Points**:
1. **Session creation** - Activity.registerSession() (line 27)
2. **Tool execution** - Captured in executionEvidence.toolCalls
3. **Task completion** - Session metrics extracted (extractMetricsFromSession)
4. **Validation** - Pre/post checks recorded in validationEvidence
5. **Commit creation** - Git artifacts tracked in workArtifacts

### State Recording Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Activity Execution with State Capture           │
└─────────────────────────────────────────────────────────┘

BEFORE Task Execution:
├─ Record instructional state (template, variables, impulses)
├─ Initialize executionEvidence.sessionsSpawned = []
├─ Run pre-flight validation (if configured)
└─ Log agentDecisions (context, reasoning)

DURING Task Execution:
├─ Track sessions spawned (sessionID, taskId, agentType)
├─ Capture tool calls (tool name, timestamp)
├─ Record agent decisions (step, decision, reasoning)
├─ Monitor impulses loaded/created
└─ Measure tokens, cost, duration

AFTER Task Execution:
├─ Extract session metrics (tokens, cost, duration)
├─ Run post-execution validation (if configured)
├─ Record work artifacts (files changed, commits made)
├─ Update executionEvidence with completion data
├─ Compute correctness verdict (if enabled)
└─ Report to learning system (metabob-rpc-api)
```

---

## 3. How We Measure Consistency Between Variants

### Variant System

**Template Variants**: Alternative implementations of the same template

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/activity-template.ts

interface ActivityTemplate.Schema {
  id: string                    // Unique template ID
  version: {
    variant_hash: string        // Stable variant identifier
    generation: number          // Iteration count
    full_version: string        // variant_hash-generation
  }
  genealogy: {
    parent_id?: string          // Parent template (if variant)
    variant_ids: string[]       // Known variants of this template
  }
}
```

### A/B Testing System (`template-selector.ts`)

**Purpose**: Route executions between stable and candidate variants

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/template-selector.ts

// Thompson Sampling for variant selection
select({
  templateId: "add-feature",
  allocation: { stable: 0.7, candidate: 0.3 }  // Traffic split
})

// Returns:
{
  selectedId: "add-feature-v2",  // Which variant was selected
  variant: "candidate",          // stable or candidate
  template: { ... }              // Full template
}
```

### Consistency Measurement

**Metrics Collected per Variant**:

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts

interface TemplateMetrics {
  template_id: string
  executions: number              // Total executions
  success_rate: number            // 0.0 to 1.0
  avg_cost: number                // USD
  avg_duration: number            // milliseconds
  avg_tokens?: {
    input: number
    output: number
    cache: number
  }
}
```

**Consistency Dimensions**:

1. **Functional Consistency** (Do both variants succeed?)
   - Success rate comparison
   - Validation pass rates
   - Correctness verdict distribution

2. **Performance Consistency** (Do both variants perform similarly?)
   - Average cost (should be within ±20%)
   - Average duration (should be within ±30%)
   - Token usage patterns

3. **Behavioral Consistency** (Do both variants behave the same?)
   - Files modified (should overlap >80%)
   - Components touched (same critical components)
   - Validation commands passed (same checks)

4. **Quality Consistency** (Do both variants maintain quality?)
   - Metabob issues resolved
   - Test pass rates
   - Code quality metrics

### Promotion Decision

**Backend Service**: metabob-rpc-api handles variant promotion

```python
# File: repos/metabob-rpc-api/server/routes/v2_activities.py

# Statistical significance test
if candidate.executions >= 20 and candidate.success_rate > stable.success_rate + 0.05:
    return "PROMOTE"  # Candidate is significantly better
elif candidate.executions >= 50 and candidate.success_rate < stable.success_rate - 0.10:
    return "PRUNE"    # Candidate is significantly worse
else:
    return "KEEP_TESTING"  # Need more data
```

---

## 4. How We Maintain Functionality

### Pre-Flight Validation

**Before Task Execution**:

```typescript
// File: repos/metabob-opencode/packages/opencode/src/tool/activity-replay.ts (lines 410-419)

async function runPreFlightValidation(task, variables) {
  // Check required files exist
  if (task.validation?.preChecks?.requiredFiles) {
    for (const file of requiredFiles) {
      const interpolated = interpolatePrompt(file, variables)
      if (!await Bun.file(interpolated).exists()) {
        throw new Error(`Required file not found: ${interpolated}`)
      }
    }
  }
  
  // Run pre-flight commands
  if (task.validation?.preChecks?.commands) {
    await runValidationCommands(preChecks.commands, task.id)
  }
}
```

### Post-Execution Validation

**After Task Execution**:

```typescript
// File: repos/metabob-opencode/packages/opencode/src/tool/activity-replay.ts (lines 490-499)

async function runPostExecutionValidation(task, variables) {
  // Check required files exist
  if (task.validation?.postChecks?.requiredFiles) {
    for (const file of requiredFiles) {
      if (!await Bun.file(file).exists()) {
        throw new Error(`Expected file not created: ${file}`)
      }
    }
  }
  
  // Run post-execution commands (tests)
  if (task.validation?.postChecks?.commands) {
    await runValidationCommands(postChecks.commands, task.id)
  }
}
```

### Correctness Verification

**Compute Verdict After Activity**:

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/activity-correctness.ts

function computeCorrectnessVerdict(activity: Activity.Info): CorrectnessVerdict {
  // Check execution evidence
  const sessionsSpawned = activity.executionEvidence?.sessionsSpawned?.length || 0
  const toolCalls = activity.executionEvidence?.toolCalls?.length || 0
  
  // Check validation evidence
  const validationPassed = activity.validationEvidence?.overallPassed || false
  
  // Check work artifacts
  const filesChanged = activity.workArtifacts?.filesChanged?.length || 0
  const commitsMade = activity.workArtifacts?.commitsMade?.length || 0
  
  // Compute verdict
  if (!sessionsSpawned || !toolCalls) {
    return { verdict: "suspicious", confidence: 0.3, issues: [...] }
  }
  
  if (!validationPassed) {
    return { verdict: "incorrect", confidence: 0.8, issues: [...] }
  }
  
  if (filesChanged === 0 && commitsMade === 0) {
    return { verdict: "suspicious", confidence: 0.5, issues: [...] }
  }
  
  return { verdict: "correct", confidence: 0.9, issues: [] }
}
```

### Retry Mechanism (Trailblazing)

**When Validation Fails**:

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts

// Generate recovery steps dynamically
async function executeWithTrailblazing(template, activity, config) {
  for (const task of template.tasks) {
    let attempts = 0
    let success = false
    
    while (!success && attempts < config.maxRecoveryAttempts) {
      try {
        await executeTask(task)
        await runValidation(task)
        success = true
      } catch (error) {
        // Generate recovery prompt
        const recoveryPrompt = await generateRecoveryPrompt(task, error)
        await executeTask({ ...task, prompt: recoveryPrompt })
        attempts++
      }
    }
    
    if (!success) throw new Error("Task failed after retries")
  }
  
  // Create variant with learned recovery steps
  if (attempts > 0) {
    await createTemplateVariant(template, activity)
  }
}
```

---

## 5. How metabob-opencode Gets Information During Execution

### Architecture: Three-Tier System

```
┌────────────────────────────────────────────────────────────┐
│                    metabob-rpc-api                         │
│  • Stores templates, execution records                     │
│  • Thompson Sampling (variant selection)                   │
│  • Learning system (alpha/beta updates)                    │
└────────────────────────────────────────────────────────────┘
                          ▲
                          │ MCP calls
                          │
┌────────────────────────────────────────────────────────────┐
│                     metabob-cli                            │
│  • Orchestrates execution (step-by-step)                   │
│  • Maintains in-flight state (ActivityExecution)           │
│  • Generates trailblazing steps                            │
└────────────────────────────────────────────────────────────┘
                          ▲
                          │ MCP tools
                          │
┌────────────────────────────────────────────────────────────┐
│                   metabob-opencode                         │
│  • Executes LLM sessions                                   │
│  • Runs tool calls (bash, edit, read, etc.)               │
│  • Reports execution metrics                               │
└────────────────────────────────────────────────────────────┘
```

### Data Flow During Activity Execution

**Step-by-Step Communication**:

```typescript
// File: repos/metabob-opencode/packages/opencode/src/util/metabob.ts

// 1. START ACTIVITY (line 953)
MetabobCLI.startActivityExecution({
  activityId: "act_xyz",
  templateId: "add-feature",
  variantId: "add-feature-v2",  // Selected by backend
  sessionId: "ses_123",
  variables: { feature: "auth" },
  impulses: [...]               // Context loaded
})

// CLI creates ActivityExecution state
// Backend selects variant via Thompson Sampling


// 2. REPORT EXECUTION STEP (line 876)
MetabobCLI.reportExecutionStep({
  executionId: "act_xyz",
  stepOrder: 0,                 // Task index
  success: true,
  output: null,
  durationMs: 5000,
  cost: 0.02,
  tokens: 1500,
  impulsesLoaded: ["file-xyz"],
  impulsesCreated: ["memo-abc"]
})

// CLI advances current_step_index
// Backend records step metrics


// 3. COMPLETE ACTIVITY
TemplateMetricsClient.reportExecution({
  activity_id: "act_xyz",
  template_id: "add-feature-v2",
  success: true,
  duration: 45000,
  cost: 0.15,
  tokens: { input: 5000, output: 2000, cache: 1000 }
})

// Backend updates learning (alpha/beta)
// Backend recommends promotion (if candidate outperforms)
```

### Information Available to metabob-opencode

**During Execution**:

1. **Template Content** (one task at a time)
   - Task prompt (interpolated)
   - Required impulses
   - Validation commands
   - Tool access

2. **Context (Impulses)**
   - Loaded impulses (files, annotations, metabob issues)
   - Previous task outputs
   - Activity variables
   - Session memory

3. **Execution State** (read-only)
   - Current task index
   - Previous task results
   - Accumulated metrics

**After Execution**:

1. **Full Activity.Info** (persisted to storage)
   - All evidence layers
   - Complete execution trace
   - Validation results
   - Correctness verdict

2. **Metrics Aggregation**
   - Per-task metrics
   - Total cost/duration/tokens
   - Success/failure status

---

## 6. Key Architectural Patterns

### Pattern 1: Evidence-Based Correctness

**Philosophy**: Trust execution traces, not assumptions

```typescript
// Don't assume success from status alone
if (activity.status === "done") {
  // NOT sufficient!
}

// Verify with evidence
if (
  activity.status === "done" &&
  activity.executionEvidence?.sessionsSpawned.length > 0 &&
  activity.validationEvidence?.overallPassed === true &&
  activity.workArtifacts?.filesChanged.length > 0
) {
  // NOW we trust it
}
```

### Pattern 2: Replay with Inheritance

**Philosophy**: Preserve context, override decisions

```typescript
// Replay activity
const replayActivity = {
  ...originalActivity,
  
  // Inherited (preserved)
  impulses: originalActivity.impulses,      // Same context
  directory: originalActivity.directory,    // Same workspace
  branch: originalActivity.branch,          // Same branch
  
  // Overridden (changed)
  variables: { ...original, ...override },  // Modified inputs
  status: "executing",                      // Reset state
  parentActivityId: originalActivity.id     // Link to original
}
```

### Pattern 3: Incremental State Capture

**Philosophy**: Record at each checkpoint, not just end

```typescript
// Task execution loop
for (const task of tasks) {
  const startState = captureState(activity)  // BEFORE
  
  await executeTask(task)
  
  const endState = captureState(activity)    // AFTER
  
  recordTransition(startState, endState)     // DIFF
}
```

### Pattern 4: Variant Consistency Measurement

**Philosophy**: Compare outcomes, not implementations

```typescript
// Don't compare:
- Template prompt text
- Task ordering (if dependencies allow)
- Variable names

// DO compare:
- Success rates (functional consistency)
- Files modified (behavioral consistency)
- Cost/duration (performance consistency)
- Validation pass rates (quality consistency)
```

---

## 7. Data Structures

### Activity.Info (Full Schema)

See `repos/metabob-opencode/packages/opencode/src/session/activity.ts` lines 152-342

**Key Fields for State Management**:
- `executionEvidence` - What happened during execution
- `validationEvidence` - Correctness checks performed
- `workArtifacts` - Files/commits produced
- `agentDecisions` - Reasoning trace
- `correctnessVerdict` - Computed quality assessment
- `parentActivityId` - Link to original (if replay)

### ExecutionEvidence Structure

```typescript
executionEvidence: {
  sessionsSpawned: [
    {
      sessionID: "ses_123",
      taskId: "task-1",
      agentType: "general",
      startTime: 1708300000,
      endTime: 1708300500,
      messageCount: 15,
      toolCallCount: 8
    }
  ],
  toolCalls: [
    {
      sessionID: "ses_123",
      tool: "bash",
      timestamp: 1708300050
    },
    {
      sessionID: "ses_123",
      tool: "edit",
      timestamp: 1708300100
    }
  ]
}
```

### ValidationEvidence Structure

```typescript
validationEvidence: {
  executed: true,
  timestamp: 1708300600,
  requiredFiles: [
    {
      file: "src/feature.ts",
      exists: true,
      createdByActivity: true
    }
  ],
  commands: [
    {
      name: "unit tests",
      command: "bun test",
      exitCode: 0,
      passed: true,
      duration: 1500
    }
  ],
  overallPassed: true
}
```

---

## 8. Use Cases

### Use Case 1: Debug Failed Activity

**Scenario**: Activity failed at task 3 of 5

```bash
# 1. Fix the issue (code, template, or environment)
# 2. Replay from failed task

activity_replay({
  activityId: "act_failed123",
  startFromTask: "task-3"  # Skip successful tasks 1-2
})
```

**Benefits**:
- Save tokens by not re-running successful tasks
- Preserve context from original execution
- Iterative debugging workflow

### Use Case 2: Compare Template Variants

**Scenario**: Test candidate variant against stable

```bash
# Execute with A/B testing enabled
activity({
  templateId: "add-feature",  # System selects variant
  variables: { feature: "auth" }
})

# Backend tracks metrics per variant
# After 20+ executions per variant, backend recommends promotion
```

**Measured**:
- Success rate difference
- Cost/performance difference
- Behavioral consistency

### Use Case 3: Ensure Quality with Validation

**Scenario**: Prevent incorrect activities from completing

```json
{
  "validation": {
    "postChecks": {
      "requiredFiles": ["src/feature.ts", "test/feature.test.ts"],
      "commands": [
        { "name": "unit tests", "command": "bun test" },
        { "name": "type check", "command": "tsc --noEmit" }
      ]
    }
  }
}
```

**Result**:
- Activity marked as failed if validation fails
- `validationEvidence.overallPassed = false`
- `correctnessVerdict.verdict = "incorrect"`

### Use Case 4: Audit Activity Execution

**Scenario**: Understand what an activity actually did

```typescript
const activity = await Activity.load("act_xyz")

// Check execution evidence
console.log("Sessions spawned:", activity.executionEvidence.sessionsSpawned.length)
console.log("Tool calls:", activity.executionEvidence.toolCalls.length)

// Check validation evidence
console.log("Validation passed:", activity.validationEvidence.overallPassed)

// Check work artifacts
console.log("Files changed:", activity.workArtifacts.filesChanged)
console.log("Commits made:", activity.workArtifacts.commitsMade)

// Check correctness verdict
console.log("Verdict:", activity.correctnessVerdict.verdict)
console.log("Confidence:", activity.correctnessVerdict.confidence)
```

---

## 9. Related Systems

### Impulse System

**Purpose**: Lazy-loaded context for activities

**Integration**:
- Activities declare context requirements
- Impulses loaded before task execution
- Impulse metadata enriches variables
- Impulse usage tracked per step

**See**: `IMPULSE_QUICK_REFERENCE.md`

### Memory Agent

**Purpose**: Automatic context preparation before turns

**Integration**:
- Runs before main agent (turn lifecycle hook)
- Creates impulses based on user intent
- Loads context within budget constraints
- Optimizes if budget pressure detected

**See**: `MEMORY_AGENT_ARCHITECTURE_VERIFIED.md`

### Trailblazing System

**Purpose**: Dynamic recovery when validation fails

**Integration**:
- Detects validation failures
- Generates recovery prompts
- Executes recovery steps
- Creates template variants with learned fixes

**See**: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`

---

## 10. Key Takeaways

### For Activity Replay

✅ **State is fully preserved** - Impulses, context, workspace  
✅ **Selective execution** - Skip successful tasks, run remaining  
✅ **Override capability** - Change variables while preserving context  
✅ **Evidence-based** - Track what actually ran, not just assumptions  

### For State Recording

✅ **Multi-layer evidence** - Execution, validation, artifacts, decisions, verdict  
✅ **Before/after capture** - Record state at each checkpoint  
✅ **Immutable traces** - Evidence is append-only  
✅ **Queryable** - All evidence accessible via Activity.Info  

### For Variant Consistency

✅ **Statistical measurement** - Compare success rates, costs, durations  
✅ **Behavioral comparison** - Files modified, components touched  
✅ **Functional comparison** - Validation pass rates, test results  
✅ **Automated promotion** - Backend recommends based on data  

### For Functionality Maintenance

✅ **Pre-flight validation** - Check requirements before execution  
✅ **Post-execution validation** - Verify outputs after execution  
✅ **Correctness computation** - Assess quality from evidence  
✅ **Automatic recovery** - Trailblazing generates fix steps  

### For Information Flow

✅ **Three-tier architecture** - Backend (storage), CLI (orchestration), OpenCode (execution)  
✅ **Incremental delivery** - One step at a time, not full template  
✅ **Evidence reporting** - OpenCode reports what happened  
✅ **Learning system** - Backend updates from outcomes  

---

## 11. Files to Explore

### Activity Replay
- `repos/metabob-opencode/packages/opencode/src/tool/activity-replay.ts` - Replay implementation
- `repos/metabob-opencode/packages/opencode/test/tool/activity-replay.test.ts` - Replay tests

### State Recording
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts` - Activity.Info schema
- `repos/metabob-opencode/packages/opencode/src/session/activity-correctness.ts` - Verdict computation

### Variant System
- `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts` - A/B testing
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts` - Metrics types

### Information Flow
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - MCP client calls
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - Orchestration logic
- `repos/metabob-rpc-api/server/routes/v2_activities.py` - Backend endpoints

---

## Questions Answered

1. ✅ **How can we replay activities?**  
   → `activity_replay` tool loads original activity, creates replay with inherited impulses, executes from specified task

2. ✅ **How do we record instructional state before/after each task?**  
   → Activity.Info stores templateId, variables, impulses (instructional) + executionEvidence, validationEvidence, workArtifacts (functional)

3. ✅ **How do we record functional state before/after each task?**  
   → Multi-layer evidence: sessions spawned, tool calls, validation results, files changed, commits made, agent decisions

4. ✅ **How can we use this to measure consistency between variants?**  
   → Compare success rates, cost/duration, files modified, validation pass rates across stable vs candidate variants

5. ✅ **How can we maintain functionality in an activity this way?**  
   → Pre-flight validation (requirements), post-execution validation (tests), correctness computation (evidence), trailblazing (recovery)

6. ✅ **How does metabob-opencode get the information during activity execution?**  
   → Three-tier: Backend (storage+learning) ↔ CLI (orchestration) ↔ OpenCode (execution). OpenCode calls MCP tools to start, report steps, complete

7. ✅ **What is our architecture?**  
   → Orchestrator-executor split: CLI orchestrates (step-by-step delivery), OpenCode executes (LLM+tools), Backend stores (templates+metrics+learning)

---

**END OF DOCUMENT**
