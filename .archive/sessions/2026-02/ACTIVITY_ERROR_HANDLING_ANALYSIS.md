# Activity System Error Handling Analysis

## Current Architecture

### Error Flow Overview

```
Activity Execution Flow:
1. Variable Validation (activity.ts:321-331)
2. Template Loading (activity.ts:304-311)
3. Context Gathering (activity.ts:412-445)
4. Task Execution (activity.ts:521-676)
   ├─ Pre-flight Validation (activity.ts:716-742)
   ├─ Tool Validation (activity.ts:684-708)
   ├─ Agent Execution (activity.ts:1301-1594)
   └─ Post-execution Validation (activity.ts:750-791)
5. Activity Completion (activity.ts:579-586, 648-666)
```

### Key Error Handling Points

#### 1. **Variable Validation** (activity.ts:113-255)
- **Location**: `validateTemplateVariables()`
- **What it catches**:
  - Missing required variables
  - Unexpected variables (with fuzzy matching suggestions)
- **Error surfacing**: ✅ **Excellent**
  - Detailed error messages with descriptions
  - Fuzzy matching suggestions for typos
  - Shows expected vs provided variables
- **Example**:
  ```typescript
  throw new Error(validationResult.errorMessage)
  // ❌ Activity variable validation failed for template "add-feature"
  // 
  // Missing required variables:
  //   - featureName: Name of the feature to add
  // 
  // Unexpected variables (not defined in template):
  //   - featureNam (did you mean "featureName"?)
  ```

#### 2. **Template Loading** (activity.ts:304-311)
- **Location**: `TemplateRepository.get()`
- **What it catches**: Template not found
- **Error surfacing**: ✅ **Good**
  - Clear message with actionable guidance
  - Suggests using `search_activities` tool
- **Example**:
  ```typescript
  throw new Error(
    `Activity template "${params.templateId}" not found. ` +
    `Use search_activities tool to see available templates.`
  )
  ```

#### 3. **Context Gathering** (activity.ts:412-445)
- **Location**: `SessionMemoryAgent.gatherContext()`
- **What it catches**: Memory agent failures
- **Error surfacing**: ⚠️ **Partial**
  - Error message includes root cause
  - No structured error type
  - No pre-flight check for memory agent availability
- **Example**:
  ```typescript
  throw new Error(`Context gathering failed: ${error.message}`)
  ```

#### 4. **Pre-flight Validation** (activity.ts:716-742)
- **Location**: `runPreFlightValidation()`
- **What it catches**:
  - Required files missing
  - Pre-flight command failures
- **Error surfacing**: ✅ **Good**
  - Clear message with file path
  - Command output included in error
- **Gap**: Pre-flight checks run DURING task execution, not before activity starts
- **Example**:
  ```typescript
  throw new Error(`Pre-flight validation failed: required file not found: ${interpolated}`)
  ```

#### 5. **Tool Validation** (activity.ts:684-708)
- **Location**: `validateTaskTools()`
- **What it catches**: Missing tools for agent
- **Error surfacing**: ✅ **Excellent**
  - Lists missing vs available tools
  - Shows exact opencode.json config needed
- **Example**:
  ```typescript
  throw new Error(
    `Task "task-1" requires tools that are not available:\n` +
    `  Missing: bash, read\n` +
    `  Available: task, activity\n` +
    `\n` +
    `To fix this, update the "general" agent configuration in opencode.json`
  )
  ```

#### 6. **Git Status** (prompts-runner.ts:97-100)
- **Location**: `setupActivity()`
- **What it catches**: Dirty working tree
- **Error surfacing**: ✅ **Good**
  - Clear actionable message
- **Gap**: Only checked for prompts-runner, NOT for activity tool
- **Example**:
  ```typescript
  throw new Error("Working tree has uncommitted changes. Commit or stash them first.")
  ```

#### 7. **Post-execution Validation** (activity.ts:750-791)
- **Location**: `runPostExecutionValidation()`
- **What it catches**:
  - Required output files missing
  - Validation command failures
- **Error surfacing**: ✅ **Good**
  - Clear message with file path
  - Command output included
- **Example**:
  ```typescript
  throw new Error(`Post-execution validation failed: required file not found: ${interpolated}`)
  ```

#### 8. **Activity Completion** (activity.ts:648-666)
- **Location**: `catch` block in `activity.execute()`
- **What it catches**: Any unhandled errors
- **Error surfacing**: ✅ **Good**
  - Error stored in activity.error and activity.errorStack
  - Activity status set to "failed"
  - Activity saved before throwing
- **Example**:
  ```typescript
  activity.error = error instanceof Error ? error.message : String(error)
  activity.errorStack = error instanceof Error ? error.stack : undefined
  await Activity.save(activity)
  throw error // Re-throw so tool returns error to user
  ```

---

## Error Transparency Gaps

### 1. **Git Status Not Checked for Activity Tool** ❌
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Current Behavior**:
- Activity tool does NOT check git status before execution
- Only prompts-runner checks working tree cleanliness
- Activity may fail mid-execution with git errors

**Location**: None (missing check)

**Should Check At**:
- Line 342 (before creating branch)
- OR Line 298 (before any execution starts)

**Impact**:
- Activity executes, creates activity record, then fails
- Wastes tokens and time
- Leaves orphaned activity records

**Proposed Fix**:
```typescript
// activity.ts:298 (in execute() method)
// Check git status BEFORE creating activity
const isClean = await ActivityGit.isWorkingTreeClean()
if (!isClean) {
  throw new Error(
    "Cannot start activity: working tree has uncommitted changes. " +
    "Commit or stash them first, then retry."
  )
}
```

---

### 2. **Template Loading Errors Not Structured** ⚠️
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Current Behavior**:
- Template loading uses generic error string
- No structured error type for "template not found" vs "template invalid"

**Location**: Line 307-311

**Current Code**:
```typescript
if (!template) {
  throw new Error(
    `Activity template "${params.templateId}" not found. ` +
    `Use search_activities tool to see available templates.`
  )
}
```

**Impact**:
- Error inspector cannot classify error type
- No differentiation between "not found" and "load failure"

**Proposed Fix**:
```typescript
export class ActivityError extends Error {
  constructor(
    message: string,
    public readonly type: 'validation' | 'template' | 'git' | 'execution' | 'timeout',
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ActivityError'
  }
}

// Usage:
if (!template) {
  throw new ActivityError(
    `Activity template "${params.templateId}" not found. ` +
    `Use search_activities tool to see available templates.`,
    'template',
    { templateId: params.templateId }
  )
}
```

---

### 3. **Pre-flight Checks Not Shown in Output** ❌
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Current Behavior**:
- Pre-flight validation happens silently
- No feedback to user about what checks passed/failed
- Only fails with error if check fails

**Location**: Line 1343-1351 (inside task execution loop)

**Impact**:
- User doesn't know what validations ran
- No transparency into what was checked
- Hard to debug when checks fail

**Proposed Fix**:
Add pre-flight check results to activity output metadata:

```typescript
// Before line 488 (ctx.metadata() call)
const preFlightChecks = await runPreFlightChecksForActivity(template, variables)

ctx.metadata({
  title: params.description || template.name,
  metadata: {
    sessionId: sessionID,
    templateId: template.id,
    status: "executing",
    taskCount: template.tasks?.length ?? 0,
    preFlightChecks: {
      gitStatus: preFlightChecks.gitStatus,
      requiredFiles: preFlightChecks.requiredFiles,
      validationCommands: preFlightChecks.validationCommands,
    }
  },
})
```

---

### 4. **Activity Error Inspector Missing Pre-task Failures** ❌
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity-error-inspector.ts`

**Current Behavior**:
- Only analyzes session-level errors (task execution failures)
- Does NOT detect:
  - Variable validation failures
  - Template loading failures
  - Context gathering failures
  - Git status failures
- These errors happen BEFORE any session is created

**Location**: Line 185-260 (only checks activity.sessionIDs)

**Root Cause**:
```typescript
// analyzeActivityErrors() only loops over sessionIDs
for (const sessionId of activity.sessionIDs) {
  // ... analyze session errors
}

// If activity fails before creating any sessions, taskErrors = []
```

**Impact**:
- Error inspector reports "No Errors Found" for pre-task failures
- User gets: "The activity failed but no specific task errors were detected"
- Misleading diagnosis

**Proposed Fix**:
```typescript
async function analyzeActivityErrors(options: {...}): Promise<ErrorReport> {
  const taskErrors: TaskError[] = []

  // NEW: Check for pre-task failures (before any sessions created)
  if (activity.status === 'failed' && activity.sessionIDs.length === 0) {
    // Activity failed before creating any sessions
    // Check activity.error field for pre-task errors
    if (activity.error) {
      taskErrors.push({
        taskId: 'pre-task-validation',
        taskDescription: 'Activity Setup',
        sessionId: 'none',
        error: {
          type: classifyError(activity.error),
          message: activity.error,
          stack: activity.errorStack,
        },
        context: {
          agent: 'none',
          prompt: 'Pre-task validation failed before execution',
          variables: activity.variables,
        },
        attempts: 1,
        cost: 0,
        duration: activity.stats.duration,
      })
    }
  }

  // Existing session-level error analysis...
  for (const sessionId of activity.sessionIDs) {
    // ...
  }

  return { activity, template, taskErrors, summary }
}
```

---

### 5. **Context Gathering Errors Not Pre-validated** ⚠️
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Current Behavior**:
- Context gathering starts AFTER activity record created
- No check if memory agent is available
- No check if Metabob is connected (if using metabob resolvers)

**Location**: Line 412-445

**Impact**:
- Activity fails mid-execution if memory agent unavailable
- No early warning about missing dependencies

**Proposed Pre-flight Check**:
```typescript
// Before line 412 (context gathering)
if (template.contextRequirements && template.contextRequirements.length > 0) {
  // Check if memory agent is available
  const memoryAgent = await Agent.get('memory')
  if (!memoryAgent) {
    throw new ActivityError(
      'Memory agent required for context gathering but not configured. ' +
      'Add memory agent to opencode.json agents section.',
      'validation',
      { requirements: template.contextRequirements }
    )
  }

  // Check if Metabob is required and available
  const requiresMetabob = template.contextRequirements.some(
    req => req.hint?.includes('metabob') || req.hint?.includes('code quality')
  )
  if (requiresMetabob && !(await MetabobCLI.isAvailable())) {
    throw new ActivityError(
      'Template requires Metabob integration but Metabob is not available. ' +
      'Configure Metabob CLI or use a different template.',
      'validation',
      { requirements: template.contextRequirements }
    )
  }
}
```

---

## Proposed Improvements for Sprint 1

### 1. **Add Structured Error Types** (Priority: HIGH)

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity-errors.ts` (NEW)

**Implementation**:
```typescript
export class ActivityError extends Error {
  constructor(
    message: string,
    public readonly type: 'validation' | 'template' | 'git' | 'execution' | 'timeout' | 'context',
    public readonly context?: Record<string, unknown>,
    public readonly recoverable: boolean = false
  ) {
    super(message)
    this.name = 'ActivityError'
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
      stack: this.stack,
    }
  }
}

export class ValidationError extends ActivityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'validation', context, true)
    this.name = 'ValidationError'
  }
}

export class TemplateError extends ActivityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'template', context, true)
    this.name = 'TemplateError'
  }
}

export class GitError extends ActivityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'git', context, true)
    this.name = 'GitError'
  }
}

export class ContextError extends ActivityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'context', context, false)
    this.name = 'ContextError'
  }
}
```

**Usage in activity.ts**:
```typescript
// Line 307-311: Replace generic Error with TemplateError
if (!template) {
  throw new TemplateError(
    `Activity template "${params.templateId}" not found. ` +
    `Use search_activities tool to see available templates.`,
    { templateId: params.templateId }
  )
}

// Line 330: Replace generic Error with ValidationError
throw new ValidationError(validationResult.errorMessage, {
  missing: validationResult.missing,
  unexpected: validationResult.unexpected,
})

// Line 438: Replace generic Error with ContextError
throw new ContextError(`Context gathering failed: ${error.message}`, {
  requirements: template.contextRequirements,
})
```

**Testing**:
- Unit tests for each error class
- Integration test: trigger each error type and verify classification

---

### 2. **Add Pre-flight Activity Checks** (Priority: HIGH)

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Implementation**:
```typescript
// NEW: Add after line 331 (variable validation)
async function runActivityPreFlightChecks(
  template: ActivityTemplate.Schema,
  variables: Record<string, unknown>
): Promise<{
  gitStatus: { clean: boolean; uncommittedFiles?: string[] }
  memoryAgent: { available: boolean; agentName?: string }
  metabob: { required: boolean; available: boolean }
  validation: { passed: boolean; errors: string[] }
}> {
  const checks = {
    gitStatus: { clean: true },
    memoryAgent: { available: true },
    metabob: { required: false, available: false },
    validation: { passed: true, errors: [] as string[] },
  }

  // 1. Check git status
  const isClean = await ActivityGit.isWorkingTreeClean()
  if (!isClean) {
    const status = await ActivityGit.getStatus() // NEW method to get uncommitted files
    checks.gitStatus = { clean: false, uncommittedFiles: status.uncommittedFiles }
    throw new GitError(
      'Cannot start activity: working tree has uncommitted changes. ' +
      'Commit or stash them first, then retry.',
      { uncommittedFiles: status.uncommittedFiles }
    )
  }

  // 2. Check memory agent availability (if context requirements exist)
  if (template.contextRequirements && template.contextRequirements.length > 0) {
    const memoryAgent = await Agent.get('memory')
    if (!memoryAgent) {
      checks.memoryAgent = { available: false }
      throw new ContextError(
        'Memory agent required for context gathering but not configured. ' +
        'Add memory agent to opencode.json agents section.',
        { requirements: template.contextRequirements }
      )
    }
    checks.memoryAgent = { available: true, agentName: memoryAgent.name }
  }

  // 3. Check Metabob availability (if required by context requirements)
  const requiresMetabob = template.contextRequirements?.some(
    req => req.hint?.includes('metabob') || req.hint?.includes('code quality')
  ) ?? false
  checks.metabob.required = requiresMetabob
  checks.metabob.available = await MetabobCLI.isAvailable()

  if (requiresMetabob && !checks.metabob.available) {
    throw new ContextError(
      'Template requires Metabob integration but Metabob is not available. ' +
      'Configure Metabob CLI or use a different template.',
      { requirements: template.contextRequirements }
    )
  }

  // 4. Run template-level validation commands (if any)
  if (template.validation?.preChecks?.commands) {
    try {
      await runValidationCommands(template.validation.preChecks.commands, 'activity-pre-flight')
    } catch (error) {
      checks.validation = { passed: false, errors: [error.message] }
      throw new ValidationError(
        `Activity pre-flight validation failed: ${error.message}`,
        { commands: template.validation.preChecks.commands }
      )
    }
  }

  return checks
}

// Add to execute() method after line 331:
const preFlightResults = await runActivityPreFlightChecks(template, params.variables)
log.info('activity pre-flight checks passed', { checks: preFlightResults })
```

**Surface in Output**:
```typescript
// Line 487-497: Add pre-flight results to metadata
ctx.metadata({
  title: params.description || template.name,
  metadata: {
    sessionId: sessionID,
    templateId: template.id,
    templateVersion: template.version,
    status: "executing",
    taskCount: template.tasks?.length ?? 0,
    preFlightChecks: preFlightResults, // NEW
  },
})
```

**Testing**:
- Test dirty git tree rejection
- Test missing memory agent rejection
- Test Metabob unavailable rejection
- Test validation command failure

---

### 3. **Fix Activity Error Inspector for Pre-task Failures** (Priority: HIGH)

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity-error-inspector.ts`

**Implementation**:
```typescript
// Line 179: Modify analyzeActivityErrors() to detect pre-task failures
async function analyzeActivityErrors(options: {
  activity: Activity.Info
  template?: ActivityTemplate.Schema
  includeSessionLogs: boolean
  includeToolCalls: boolean
  maxMessagesPerTask: number
}): Promise<ErrorReport> {
  const { activity, template, includeSessionLogs, includeToolCalls, maxMessagesPerTask } = options

  const taskErrors: TaskError[] = []

  // NEW: Check for pre-task failures (errors before any sessions created)
  if (activity.status === 'failed' && activity.error) {
    // Check if error occurred before task execution (no sessions created yet)
    if (activity.sessionIDs.length === 0) {
      log.info('detected pre-task failure', {
        activityId: activity.id,
        error: activity.error,
      })

      taskErrors.push({
        taskId: 'pre-task-setup',
        taskDescription: 'Activity Setup and Validation',
        sessionId: 'none',
        error: {
          type: classifyError(activity.error),
          message: activity.error,
          stack: activity.errorStack,
        },
        context: {
          agent: 'activity-tool',
          prompt: 'Pre-task validation and setup phase',
          variables: activity.variables,
        },
        attempts: 1,
        cost: 0,
        duration: activity.stats.duration || 0,
      })

      // Return early - no need to analyze sessions if none were created
      return {
        activity,
        template,
        taskErrors,
        summary: {
          totalTasks: template?.tasks.length || 1,
          failedTasks: 1,
          failureRate: 1.0,
          totalCost: 0,
          totalDuration: activity.stats.duration || 0,
        },
      }
    }
  }

  // Existing session-level error analysis...
  for (const sessionId of activity.sessionIDs) {
    // ... (keep existing code)
  }

  return { activity, template, taskErrors, summary }
}
```

**Update Error Classification**:
```typescript
// Line 296: Enhance classifyError() to detect structured error types
function classifyError(errorMessage: string): "validation" | "execution" | "timeout" | "template" | "git" | "context" | "unknown" {
  const lower = errorMessage.toLowerCase()

  // Check for structured error type indicators
  if (lower.includes('validationerror') || lower.includes('variable validation failed')) {
    return 'validation'
  }
  if (lower.includes('templateerror') || lower.includes('template') && lower.includes('not found')) {
    return 'template'
  }
  if (lower.includes('giterror') || lower.includes('working tree') || lower.includes('uncommitted changes')) {
    return 'git'
  }
  if (lower.includes('contexterror') || lower.includes('context gathering failed')) {
    return 'context'
  }

  // Existing classification logic...
  if (lower.includes("validation") || lower.includes("required") || lower.includes("forbidden")) {
    return "validation"
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "timeout"
  }
  if (lower.includes("command") || lower.includes("failed") || lower.includes("error")) {
    return "execution"
  }

  return "unknown"
}
```

**Testing**:
- Create activity with invalid variables → verify inspector detects it
- Create activity with missing template → verify inspector detects it
- Create activity with dirty git tree → verify inspector detects it
- Create activity with missing context → verify inspector detects it

---

### 4. **Comprehensive Testing** (Priority: HIGH)

**File**: `repos/metabob-opencode/packages/opencode/test/activity-error-handling.test.ts` (NEW)

**Implementation**:
```typescript
import { describe, it, expect, beforeEach } from "bun:test"
import { Activity } from "../src/session/activity"
import { ActivityTool } from "../src/tool/activity"
import { ActivityErrorInspectorTool } from "../src/tool/activity-error-inspector"
import { TemplateRepository } from "../src/session/activity-template-repository"
import { ActivityGit } from "../src/session/activity-git"
import { Agent } from "../src/agent/agent"

describe("Activity Error Handling", () => {
  describe("Pre-flight Validation", () => {
    it("should reject dirty git tree", async () => {
      // Setup: Create uncommitted changes
      await createUncommittedFile("test.txt")

      // Execute: Try to create activity
      const activityTool = await ActivityTool.init()
      const result = activityTool.execute({
        templateId: "simple-test",
        variables: {},
        reason: "Test pre-flight git check",
      }, mockContext())

      // Assert: Should fail with GitError
      await expect(result).rejects.toThrow(GitError)
      await expect(result).rejects.toThrow("working tree has uncommitted changes")

      // Cleanup
      await revertUncommittedChanges()
    })

    it("should reject missing required variables", async () => {
      const activityTool = await ActivityTool.init()
      const result = activityTool.execute({
        templateId: "add-feature",
        variables: { featureNam: "test" }, // Typo in variable name
        reason: "Test variable validation",
      }, mockContext())

      await expect(result).rejects.toThrow(ValidationError)
      await expect(result).rejects.toThrow("featureName")
      await expect(result).rejects.toThrow('did you mean "featureName"')
    })

    it("should reject template not found", async () => {
      const activityTool = await ActivityTool.init()
      const result = activityTool.execute({
        templateId: "non-existent-template",
        variables: {},
        reason: "Test template loading",
      }, mockContext())

      await expect(result).rejects.toThrow(TemplateError)
      await expect(result).rejects.toThrow("not found")
      await expect(result).rejects.toThrow("search_activities")
    })

    it("should reject missing memory agent when required", async () => {
      // Setup: Remove memory agent
      await Agent.remove("memory")

      const activityTool = await ActivityTool.init()
      const result = activityTool.execute({
        templateId: "template-with-context-requirements",
        variables: {},
        reason: "Test context gathering pre-flight",
      }, mockContext())

      await expect(result).rejects.toThrow(ContextError)
      await expect(result).rejects.toThrow("Memory agent required")

      // Cleanup: Restore memory agent
      await Agent.restore("memory")
    })
  })

  describe("Activity Error Inspector", () => {
    it("should detect variable validation failure", async () => {
      // Setup: Create failed activity with variable error
      const activity = await createFailedActivity({
        error: "Activity variable validation failed for template \"add-feature\"\n\nMissing required variables:\n  - featureName",
        sessionIDs: [], // No sessions created
      })

      // Execute: Inspect errors
      const inspector = await ActivityErrorInspectorTool.init()
      const result = await inspector.execute({
        activityId: activity.id,
      }, mockContext())

      // Assert: Should detect pre-task failure
      expect(result.metadata.errorCount).toBe(1)
      expect(result.output).toContain("Activity Setup")
      expect(result.output).toContain("validation")
      expect(result.output).toContain("featureName")
    })

    it("should detect template not found error", async () => {
      const activity = await createFailedActivity({
        error: 'Activity template "non-existent" not found',
        sessionIDs: [],
      })

      const inspector = await ActivityErrorInspectorTool.init()
      const result = await inspector.execute({
        activityId: activity.id,
      }, mockContext())

      expect(result.metadata.errorCount).toBe(1)
      expect(result.output).toContain("template")
      expect(result.output).toContain("not found")
    })

    it("should detect git status error", async () => {
      const activity = await createFailedActivity({
        error: "Cannot start activity: working tree has uncommitted changes",
        sessionIDs: [],
      })

      const inspector = await ActivityErrorInspectorTool.init()
      const result = await inspector.execute({
        activityId: activity.id,
      }, mockContext())

      expect(result.metadata.errorCount).toBe(1)
      expect(result.output).toContain("git")
      expect(result.output).toContain("uncommitted changes")
    })

    it("should detect context gathering failure", async () => {
      const activity = await createFailedActivity({
        error: "Context gathering failed: Memory agent not available",
        sessionIDs: [],
      })

      const inspector = await ActivityErrorInspectorTool.init()
      const result = await inspector.execute({
        activityId: activity.id,
      }, mockContext())

      expect(result.metadata.errorCount).toBe(1)
      expect(result.output).toContain("context")
      expect(result.output).toContain("Memory agent")
    })

    it("should detect task execution failure", async () => {
      // Existing behavior - task fails with error
      const activity = await createFailedActivity({
        error: "Task validation failed",
        sessionIDs: ["sess_123"], // Session created
      })

      const inspector = await ActivityErrorInspectorTool.init()
      const result = await inspector.execute({
        activityId: activity.id,
      }, mockContext())

      expect(result.metadata.errorCount).toBe(1)
      expect(result.output).toContain("execution")
    })
  })
})
```

---

## Summary

### Current State
✅ **Strong error handling** for:
- Variable validation (with fuzzy matching)
- Tool validation (with config suggestions)
- Post-execution validation
- Task-level failures

⚠️ **Partial error handling** for:
- Context gathering (errors caught but not pre-validated)
- Template loading (generic error messages)

❌ **Missing error handling** for:
- Git status (not checked for activity tool)
- Pre-flight activity checks (no activity-level validation)
- Pre-task failure detection (error inspector misses them)

### Sprint 1 Deliverables

1. **Structured Error Types** (2-3 hours)
   - Create `ActivityError` base class
   - Create specialized error types: `ValidationError`, `TemplateError`, `GitError`, `ContextError`
   - Update all `throw new Error()` calls to use structured types
   - Test error classification

2. **Pre-flight Activity Checks** (3-4 hours)
   - Add git status check before activity creation
   - Add memory agent availability check
   - Add Metabob availability check (if required)
   - Add activity-level validation commands
   - Surface pre-flight results in metadata
   - Test all pre-flight scenarios

3. **Fix Activity Error Inspector** (2-3 hours)
   - Detect pre-task failures (activity.error + no sessions)
   - Enhance error classification with structured types
   - Update recommendations based on error type
   - Test pre-task error detection

4. **Comprehensive Testing** (3-4 hours)
   - Unit tests for each error type
   - Integration tests for pre-flight checks
   - Error inspector tests for all scenarios
   - End-to-end activity failure scenarios

**Total Estimated Time**: 10-14 hours

### Benefits
- ✅ Activities fail fast with clear, actionable errors
- ✅ No wasted tokens on doomed executions
- ✅ Error inspector accurately diagnoses ALL failure types
- ✅ Users get transparent feedback about validation checks
- ✅ Structured errors enable better error recovery and retry logic
