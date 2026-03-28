# BoredomManager Data Transformations Analysis

**Feature:** BoredomManager idle detection and auto-execution system  
**Purpose:** Document all data transformations in the flow chain with business logic and validation rules  
**Date:** 2026-02-21

---

## Transformation 1: Session Creation → BoredomManager Initialization

**Component Flow:** `Session.Event.Created` → `BoredomManager.startMonitoring()`

**What:**
- Extract `sessionID` from bus event payload
- Create `ManagerInstance` data structure
- Initialize idle tracking state
- Start periodic idle check timer

**Type Conversion:**
```typescript
// INPUT: Session.Event.Created payload
{
  info: Session.Info = {
    id: string                    // sessionID
    directory: string
    branch: string
    status: "active" | "archived" | ...
    createdAt: number
    updatedAt: number
    ...
  }
}

// OUTPUT: ManagerInstance
{
  sessionID: string                    // From event.info.id
  lastActivityTime: number             // Date.now()
  boredomTimer: NodeJS.Timeout         // setInterval handle
  currentActivity: undefined           // No activity initially
  isIdle: false                        // Active initially
}
```

**Business Logic:**
1. **Idle detection starts immediately** - Timer begins on session creation
2. **Initial state is "active"** - User just started session, not idle
3. **Polling interval: 1 minute** - Balance between responsiveness and overhead
4. **Session isolation** - Each session has independent idle tracking

**Why:**
- **Business Requirement:** System should proactively improve itself when idle
- **Constraint:** Must not interfere with active user sessions
- **Alternative:** Could start monitoring on first user message, but that misses sessions that are created but never used

**Validations:**
- ✅ `sessionID` must be valid Identifier (Zod validated in bus event)
- ✅ Session must exist in storage
- ⚠️ No validation that session is still active (cleanup needed on session deletion)

**Side Effects:**
- Creates `NodeJS.Timeout` timer (resource allocation)
- Stores `ManagerInstance` in module-level Map (memory allocation)
- Timer fires every 60 seconds (CPU overhead)

---

## Transformation 2: User Message → Activity Timestamp Update

**Component Flow:** `SessionPrompt.prompt()` → `BoredomManager.trackActivity()`

**What:**
- Extract `sessionID` from prompt input
- Update `lastActivityTime` to current timestamp
- Cancel running boredom activity if exists
- Reset idle state flag

**Type Conversion:**
```typescript
// INPUT: SessionPrompt.PromptInput
{
  sessionID: string
  agent?: string
  parts: Array<{
    type: "text" | "image" | "tool_result"
    text?: string
    ...
  }>
  noReply?: boolean
  ...
}

// OUTPUT: ManagerInstance (mutated)
{
  sessionID: string
  lastActivityTime: number             // UPDATED to Date.now()
  boredomTimer: NodeJS.Timeout
  currentActivity: undefined           // CLEARED if was running
  isIdle: false                        // RESET to false
}
```

**Business Logic:**
1. **Text extraction for context** - Filter parts with `type === "text"`, join with space
2. **Timestamp precision** - Uses `Date.now()` (milliseconds since epoch)
3. **Activity cancellation** - If `isIdle && currentActivity`, abort the activity
4. **Session touch** - Updates `session.updatedAt` for last activity tracking

**Why:**
- **Business Requirement:** User activity should prevent boredom activities from running
- **Constraint:** Activity cancellation must be graceful (wait for current task to finish)
- **Alternative:** Could use debouncing (only track if >1 min since last), but simpler to track every message

**Validations:**
- ✅ `sessionID` must exist in `sessionManagers` Map
- ✅ `parts` array must have at least one element (implicit)
- ⚠️ No validation that user message is meaningful (could be empty string)

**Side Effects:**
- Calls `AbortController.abort()` if boredom activity running (propagates abort signal)
- Updates session's `updatedAt` timestamp in storage
- Stores prompt text in `SessionContext` for intent analysis

---

## Transformation 3: Idle State Check → Boredom Activity List

**Component Flow:** `BoredomManager.checkIdleAndExecute()` → `MCP.getClient()` → `metabob_fetch_boredom_activities`

**What:**
- Calculate idle duration: `Date.now() - lastActivityTime`
- Compare against threshold (5 minutes = 300,000 ms)
- Fetch prioritized activities from backend via MCP
- Parse JSON response and sort by priority

**Type Conversion:**
```typescript
// INPUT: Idle state check
{
  sessionID: string
  idleTime: number                      // Date.now() - lastActivityTime
  threshold: 300_000                    // 5 minutes in milliseconds
}

// MCP TOOL CALL: metabob_fetch_boredom_activities
{
  max_activities: 5
  priority_threshold: 0.5
  exclude_recent_hours: 24
}

// OUTPUT: BoredomActivity[]
[
  {
    activity_type: "improve-template" | "debug-failures" | "optimize-performance"
    priority: number                    // 0.0-1.5 (higher = more important)
    template_id: string                 // e.g., "fix-type-errors"
    improvement_gradient: number        // 0.0-1.0 (learning rate)
    reason: string                      // Human-readable explanation
    estimated_effort: string            // e.g., "5-15 min"
    metrics: {
      success_rate: number              // 0.0-1.0
      avg_cost: number                  // USD
      avg_duration_ms: number
      execution_count: number
      failure_patterns: Array<{
        task_id: string
        count: number
        error_category: string
        last_seen: string               // ISO 8601 timestamp
      }>
      performance_trends: {
        duration: "improving" | "stable" | "degrading"
        cost: "improving" | "stable" | "degrading"
        success_rate: "improving" | "stable" | "degrading"
      }
      last_execution: {
        activity_id: string
        timestamp: string               // ISO 8601
        success: boolean
        duration_ms: number
        cost: number
        error?: string
      }
    }
  },
  ...
]
```

**Business Logic:**
1. **Priority calculation (backend):**
   - Base priority = `improvement_gradient * (1 - success_rate)`
   - Boost if template used frequently (`execution_count > 50`)
   - Penalty if recent execution failed (`last_execution.success === false`)
   - Penalty if recently executed (`exclude_recent_hours` filter)

2. **Activity type selection (backend):**
   - `improve-template`: Success rate < 80% or performance degrading
   - `debug-failures`: Failure patterns detected (>3 failures in last week)
   - `optimize-performance`: Duration/cost increasing trend

3. **Sorting (frontend):**
   - Sort descending by `priority` field
   - Select highest priority activity (index 0)

**Why:**
- **Business Requirement:** System should work on highest-impact improvements first
- **Constraint:** Limited compute budget (don't run low-priority work during idle time)
- **Alternative:** Could use round-robin or random selection, but priority-based maximizes improvement

**Validations:**
- ✅ `idleTime >= IDLE_THRESHOLD_MS` before making MCP call
- ✅ `!isIdle` to prevent duplicate executions
- ✅ MCP client must be configured (`MCP.getClient("metabob")` returns non-null)
- ✅ Response must be valid JSON with `activities` array
- ⚠️ No validation that activities are still relevant (template might have been deleted)

**Side Effects:**
- HTTP request to Metabob backend MCP server
- Reads from activity execution history database (backend)
- Calculates metrics and trends (backend CPU)
- Caches result for 5 minutes (backend optimization)

---

## Transformation 4: BoredomActivity → Activity Execution

**Component Flow:** `BoredomManager.executeBoredomActivity()` → `executeActivityInline()`

**What:**
- Extract template_id from activity
- Create variables from activity.metrics
- Create AbortController for cancellation
- Execute activity inline (no child session)

**Type Conversion:**
```typescript
// INPUT: BoredomActivity (highest priority)
{
  activity_type: "improve-template"
  priority: 0.85
  template_id: "fix-type-errors"
  improvement_gradient: 0.6
  reason: "Template has 60% success rate, frequently fails on task-2"
  estimated_effort: "10-15 min"
  metrics: {
    success_rate: 0.60
    avg_cost: 0.45
    avg_duration_ms: 720000
    execution_count: 120
    failure_patterns: [
      {
        task_id: "task-2",
        count: 48,
        error_category: "TypeValidationError",
        last_seen: "2026-02-20T15:30:00Z"
      }
    ],
    ...
  }
}

// EXTRACT VARIABLES:
{
  template_id: "fix-type-errors"           // From activity.template_id
  success_rate: 0.60                       // From activity.metrics.success_rate
  failure_task_id: "task-2"                // From failure_patterns[0].task_id
  error_category: "TypeValidationError"    // From failure_patterns[0].error_category
  execution_count: 120                     // From activity.metrics.execution_count
}

// CREATE ABORT CONTROLLER:
{
  activityId: "pending"                    // Placeholder until execution starts
  abortController: AbortController {
    signal: AbortSignal {
      aborted: false
      onabort: null
    }
  }
}

// CALL executeActivityInline():
{
  templateId: "fix-type-errors"
  variables: { success_rate, failure_task_id, ... }
  parentSessionID: string
  reason: "Template has 60% success rate, frequently fails on task-2"
  parentMessageID: "boredom-system"
  abortSignal: AbortSignal                 // NEW PARAMETER (not yet implemented)
}
```

**Business Logic:**
1. **Variable extraction rules:**
   - `template_id` → directly from `activity.template_id`
   - Metrics → flatten `activity.metrics` into template variables
   - Failure patterns → extract first pattern for troubleshooting context

2. **Cancellation mechanism:**
   - Store `abortController` in `manager.currentActivity`
   - If user returns → call `abortController.abort()`
   - AbortSignal propagates through execution chain
   - TemplateExecutor checks signal before each task

3. **Execution context:**
   - No child session created (executes in parent session)
   - Impulses created directly in parent session's instructional state
   - Activity tracking via `Activity.Info` (status, metrics, etc.)

**Why:**
- **Business Requirement:** Boredom activities should improve templates based on failure data
- **Constraint:** Must be cancellable immediately when user returns
- **Alternative:** Could create child session (isolation), but impulses wouldn't be visible to parent

**Validations:**
- ✅ Template exists: `TemplateRepository.get(templateId)` returns non-null
- ✅ Variables match template schema: `validateTemplateVariables()` checks required fields
- ✅ Variables have correct types: Zod validation in template definition
- ⚠️ No validation that failure patterns are still reproducible

**Side Effects:**
- Creates `Activity.Info` record in storage
- Links activity to session: `session.activityId = activity.id`
- Registers session mapping: `Activity.registerSession(sessionID, activityId)`
- Creates AbortController (memory allocation)

---

## Transformation 5: Template Variables → Validated Variables

**Component Flow:** `executeActivityInline()` → `validateTemplateVariables()`

**What:**
- Collect expected variables from all template tasks
- Check for missing required variables
- Check for unexpected variables (fuzzy matching)
- Build detailed error message if validation fails

**Type Conversion:**
```typescript
// INPUT: Template + Provided Variables
{
  template: ActivityTemplate.Schema {
    tasks: [
      {
        prompt: {
          variables: [
            { name: "success_rate", type: "number", required: true, description: "..." },
            { name: "failure_task_id", type: "string", required: true, description: "..." },
            { name: "error_category", type: "string", required: false, description: "..." }
          ]
        }
      }
    ]
  },
  providedVariables: {
    success_rate: 0.60,
    failure_task_id: "task-2",
    error_category: "TypeValidationError"
  }
}

// OUTPUT: ValidationResult
{
  valid: true,
  missing: [],
  unexpected: [],
  errorMessage: ""
}

// OR (if validation fails):
{
  valid: false,
  missing: [
    { name: "failure_task_id", description: "Task ID that failed most often" }
  ],
  unexpected: [
    { name: "failureTaskId", suggestion: "failure_task_id" }  // Fuzzy match
  ],
  errorMessage: "❌ Activity variable validation failed for template \"Fix Type Errors\"\n\n..."
}
```

**Business Logic:**
1. **Variable collection:**
   - Iterate all tasks
   - Extract `task.prompt.variables` arrays
   - Merge into Map (keep `required=true` if any task requires it)

2. **Backward compatibility:**
   - If template has NO variables defined → allow ANY variables
   - This prevents breaking existing templates without variable definitions

3. **Fuzzy matching:**
   - Calculate Levenshtein distance between provided and expected names
   - Suggest best match if similarity > 60% (threshold)
   - Example: "failureTaskId" → suggests "failure_task_id"

4. **Error message formatting:**
   - Include template name for context
   - List missing variables with descriptions
   - List unexpected variables with suggestions
   - Show expected variable names for reference

**Why:**
- **Business Requirement:** Prevent runtime errors from missing/misspelled variables
- **Constraint:** Template variables must match across all tasks
- **Alternative:** Could validate at template registration time, but runtime validation catches dynamic issues

**Validations:**
- ✅ All required variables are provided
- ✅ All provided variables are expected
- ✅ Variable names match exactly (case-sensitive)
- ⚠️ No validation of variable VALUES (types, ranges, formats)

**Side Effects:**
- None (pure function, no mutations or I/O)
- Throws `ActivityValidationError` if validation fails

---

## Transformation 6: ExecutionOptions → Activity.Info Record

**Component Flow:** `Activity.create()`

**What:**
- Generate unique activity ID
- Initialize activity tracking record
- Set default values for all stats fields
- Save to storage and broadcast creation event

**Type Conversion:**
```typescript
// INPUT: CreateOptions
{
  directory: string                     // process.cwd()
  branch: string                        // "lifecycle-hook"
  baseCommit: string                    // "HEAD"
  title: string                         // template.name
  todos?: Todo.Info[]                   // Optional task list
}

// OUTPUT: Activity.Info
{
  id: string                            // Generated: "act_xyz123"
  directory: string
  branch: string
  baseCommit: string
  title: string                         // Prefixed with "[EVIDENCE_TEST]" (debug marker)
  status: "setup"                       // Initial status
  todos: Todo.Info[]                    // Empty array if not provided
  prompts: []                           // Empty initially
  agentsUsed: []                        // Empty initially
  sessionIDs: []                        // Empty initially
  commits: []                           // Empty initially
  startedAt: number                     // Date.now()
  stats: {
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 }
    },
    cost: {
      total: 0,
      perPrompt: []
    },
    metabob: {
      enabled: false,
      issuesResolved: 0,
      issuesAdded: 0,
      totalParticipations: 0,
      totalContextTokens: 0
    },
    duration: 0
  },
  impulses: {},                         // Empty initially
  agentDecisions: [],                   // Empty initially
  acpAgents: [],                        // Empty initially
  executionEvidence: {
    sessionsSpawned: [],
    toolCalls: []
  },
  validationEvidence: undefined,        // Populated during validation
  workArtifacts: {
    filesChanged: [],
    commitsMade: []
  },
  correctnessVerdict: undefined         // Computed at end
}
```

**Business Logic:**
1. **ID generation:**
   - Uses `generateID()` function (likely UUID or timestamp-based)
   - Prefix: "act_" for activity IDs

2. **Status lifecycle:**
   - `setup` → Initial state (just created)
   - `executing` → Activity is running
   - `done` → Completed successfully
   - `failed` → Completed with errors
   - `cancelled` → User interrupted

3. **Evidence tracking:**
   - `executionEvidence` tracks sessions spawned and tools called
   - `validationEvidence` populated when validation commands run
   - `workArtifacts` tracks files changed and commits made
   - `correctnessVerdict` computed from evidence (suspicious, correct, incorrect)

4. **Metrics initialization:**
   - All counters start at 0
   - Arrays start empty
   - Timestamps use `Date.now()` (milliseconds)

**Why:**
- **Business Requirement:** Track all activity executions for metrics and debugging
- **Constraint:** Must be queryable by ID, template, session, status
- **Alternative:** Could use in-memory tracking, but persistence enables analysis across sessions

**Validations:**
- ✅ `directory` must be valid path (no validation currently)
- ✅ `branch` must be git branch name (no validation currently)
- ✅ `baseCommit` should be git SHA (no validation currently)
- ⚠️ No validation that git repo exists or is clean

**Side Effects:**
- Writes `Activity.Info` to storage: `Storage.write(["activity", id], activity)`
- Broadcasts `Activity.Event.Created` bus event
- Allocates storage space (~2-10 KB per activity)

---

## Transformation 7: Template Execution → ExecutionResult

**Component Flow:** `TemplateExecutor.executeTemplate()` → Task Execution Loop

**What:**
- Execute tasks in dependency order
- Prompt LLM for each task with interpolated variables
- Collect execution metrics (tokens, cost, duration)
- Run validation commands
- Aggregate results into ExecutionResult

**Type Conversion:**
```typescript
// INPUT: ExecutionOptions
{
  template: ActivityTemplate.Schema {
    tasks: [
      {
        id: "task-1",
        subagent: "general",
        description: "Analyze failure patterns",
        dependencies: [],
        prompt: {
          template: "Analyze why {{template_id}} fails on {{failure_task_id}}...",
          maxTokens: 8000,
          compressionStrategy: "filter",
          variables: [...]
        },
        validation: {
          requiredFiles: ["ANALYSIS.md"],
          requiredPatterns: [],
          forbiddenPatterns: [],
          commands: []
        },
        retry: {
          maxAttempts: 3,
          strategy: "simple"
        }
      },
      ...
    ]
  },
  activity: Activity.Info,
  variables: { template_id: "fix-type-errors", ... },
  sessionID: string,
  abortSignal: AbortSignal,
  model: Provider.Model,
  options: { onStatusUpdate, parentSessionID }
}

// TASK EXECUTION (for each task):
1. Interpolate variables: "Analyze why fix-type-errors fails on task-2..."
2. Call SessionPrompt.prompt() with interpolated text
3. Wait for LLM response
4. Extract metrics from session
5. Run validation commands
6. Check abort signal

// OUTPUT: ExecutionResult
{
  activityId: string,
  success: boolean,                     // All tasks completed && validations passed
  tasks: [
    {
      taskId: "task-1",
      status: "completed",              // "completed" | "failed" | "executing" | "pending"
      attempts: 1,
      startedAt: 1708516200000,
      completedAt: 1708516380000,
      duration: 180000,                 // milliseconds
      tokens: {
        input: 15000,
        output: 3000,
        cache: 5000
      },
      cost: 0.15,                       // USD
      validation: {
        passed: true,
        checks: [
          { file: "ANALYSIS.md", exists: true }
        ]
      },
      error: undefined
    },
    ...
  ],
  totalDuration: 720000,                // Sum of all task durations
  totalCost: 0.45,                      // Sum of all task costs
  totalTokens: {
    input: 50000,
    output: 12000,
    cache: 18000
  }
}
```

**Business Logic:**
1. **Dependency resolution:**
   - Build task graph from `dependencies` arrays
   - Execute in topological order (breadth-first)
   - Parallel execution for independent tasks

2. **Variable interpolation:**
   - Replace `{{variable_name}}` with actual values
   - Supports nested paths: `{{metrics.success_rate}}`
   - Throws error if variable not found

3. **Retry logic:**
   - On failure: retry up to `maxAttempts` times
   - Strategy `simple`: retry immediately
   - Strategy `exponential`: wait 2^n seconds before retry
   - Track `attempts` counter in task execution

4. **Validation:**
   - Check required files exist after task execution
   - Search for required patterns in files (regex)
   - Ensure forbidden patterns NOT present
   - Run validation commands (exit code 0 = pass)

5. **Cancellation:**
   - Check `abortSignal.aborted` before EACH task
   - If aborted: stop execution, mark remaining tasks as "pending"
   - Set `activity.status = "cancelled"`

**Why:**
- **Business Requirement:** Activity execution must be reliable, observable, and cancellable
- **Constraint:** Tasks may depend on previous tasks' outputs (order matters)
- **Alternative:** Could execute all tasks in parallel, but dependencies require sequential execution

**Validations:**
- ✅ Task dependencies are acyclic (no circular dependencies)
- ✅ All required files created after task execution
- ✅ Required patterns found in generated files
- ✅ Forbidden patterns NOT found in generated files
- ✅ Validation commands exit with code 0
- ⚠️ No validation that LLM output is semantically correct

**Side Effects:**
- Calls LLM API (tokens consumed, cost incurred)
- Creates files in workspace (file system writes)
- May create git commits (git operations)
- Updates `Activity.Info` after each task
- Broadcasts `Activity.Event.Updated` after each task

---

## Transformation 8: ExecutionResult → Template Metrics Update

**Component Flow:** `executeActivityInline()` → `TemplateRepository.updateMetrics()`

**What:**
- Calculate incremental averages for template metrics
- Update success rate, duration, cost, tokens
- Use exponential moving average (EMA) formula
- Save updated metrics to storage and backend

**Type Conversion:**
```typescript
// INPUT: ExecutionResult + Current Template Metrics
{
  result: {
    success: true,
    totalDuration: 720000,              // 12 minutes
    totalCost: 0.45,                    // USD
    totalTokens: {
      input: 50000,
      output: 12000,
      cache: 18000
    }
  },
  template: {
    id: "fix-type-errors",
    executions: 120,
    successRate: 0.60,
    avgDuration: 650000,                // 10.8 minutes
    avgCost: 0.42,
    avgTokens: {
      input: 48000,
      output: 11000,
      cache: 16000
    }
  }
}

// CALCULATION:
newExecutions = 120 + 1 = 121

// Incremental average formula: new_avg = old_avg + (new_value - old_avg) / n
newSuccessRate = 0.60 + ((1 - 0.60) / 121) = 0.60 + 0.0033 = 0.6033
newAvgDuration = 650000 + ((720000 - 650000) / 121) = 650000 + 578 = 650578
newAvgCost = 0.42 + ((0.45 - 0.42) / 121) = 0.42 + 0.00025 = 0.42025
newAvgTokens.input = 48000 + ((50000 - 48000) / 121) = 48000 + 16.5 = 48016.5

// OUTPUT: Updated Template Metrics
{
  executions: 121,
  successRate: 0.6033,
  avgDuration: 650578,
  avgCost: 0.42025,
  avgTokens: {
    input: 48016,
    output: 11008,
    cache: 16016
  }
}
```

**Business Logic:**
1. **Incremental average formula:**
   - `new_avg = old_avg + (new_value - old_avg) / new_count`
   - More efficient than storing all values and recalculating
   - Equivalent to: `new_avg = (old_avg * old_count + new_value) / new_count`

2. **Success rate calculation:**
   - Treat success as 1, failure as 0
   - Apply same incremental average formula
   - Result is percentage of successful executions (0.0-1.0)

3. **Metrics persistence:**
   - Update local storage: `TemplateRepository.updateLocal()`
   - Update backend via MCP: `metabob_post_activity_result()`
   - Backend recalculates improvement_gradient based on new metrics

4. **Rounding:**
   - Token counts rounded to integers
   - Cost rounded to 5 decimal places (USD)
   - Duration kept as integer milliseconds

**Why:**
- **Business Requirement:** Template metrics enable priority calculation for boredom activities
- **Constraint:** Can't store all execution data (memory/storage limits)
- **Alternative:** Could use exponential moving average (weights recent executions more), but simple average is simpler

**Validations:**
- ✅ `executions` counter increments by 1
- ✅ Success rate stays in range [0.0, 1.0]
- ✅ Average values don't overflow (TypeScript number is 64-bit float)
- ⚠️ No validation that metrics are semantically meaningful

**Side Effects:**
- Writes updated template to local storage
- Calls MCP tool: `metabob_post_activity_result`
- Backend updates PostgreSQL database
- Backend recalculates improvement_gradient and priority
- Backend may trigger new boredom activity recommendations

---

## Transformation 9: Activity Completion → Backend Result Report

**Component Flow:** `BoredomManager.executeBoredomActivity()` → `metabob_post_activity_result`

**What:**
- Extract final metrics from completed activity
- Format result for backend API
- Call MCP tool to report result
- Update improvement_gradient based on outcome

**Type Conversion:**
```typescript
// INPUT: Completed Activity
{
  activity: Activity.Info {
    id: "act_xyz123",
    templateId: "fix-type-errors",
    status: "done",                     // or "failed" or "cancelled"
    stats: {
      duration: 720000,
      cost: { total: 0.45 },
      tokens: {
        input: 50000,
        output: 12000,
        cache: { read: 18000 }
      }
    },
    error: undefined,                   // or error message if failed
    completedAt: 1708516380000
  },
  result: {
    success: true,
    activityId: "act_xyz123"
  }
}

// MCP TOOL CALL: metabob_post_activity_result
{
  activityId: "act_xyz123",
  result: {
    success: true,
    duration: 720000,                   // milliseconds
    cost: 0.45,                         // USD
    tokens: {
      input: 50000,
      output: 12000,
      cache: 18000
    },
    errors: undefined                   // or [activity.error] if failed
  }
}

// OUTPUT: Backend Response
{
  success: true,
  metrics_updated: true,
  improvement_gradient: 0.65,           // Updated from 0.60
  next_priority: 0.88                   // Recalculated priority
}
```

**Business Logic:**
1. **Result extraction:**
   - If `activity.status === "done"` → `success: true`
   - If `activity.status === "failed"` → `success: false`, include `error`
   - If `activity.status === "cancelled"` → `success: false`, errors: ["Cancelled by user"]

2. **Backend gradient update (backend logic):**
   ```python
   # If execution succeeded:
   new_gradient = old_gradient + learning_rate * (1.0 - old_gradient)
   
   # If execution failed:
   new_gradient = old_gradient - learning_rate * old_gradient
   
   # Learning rate typically 0.1-0.2
   ```

3. **Priority recalculation (backend):**
   ```python
   priority = improvement_gradient * (1 - success_rate)
   
   # Boost if frequently used:
   if execution_count > 50:
       priority *= 1.2
   
   # Penalty if recent failure:
   if last_execution.success == False:
       priority *= 0.8
   ```

4. **Cancellation reporting:**
   - Report as failure with special error message
   - Backend doesn't penalize gradient for cancellations
   - Preserves learning from partial work done

**Why:**
- **Business Requirement:** Backend needs to know which improvements are working
- **Constraint:** Must report all executions (success, failure, cancelled)
- **Alternative:** Could batch reports (performance), but real-time enables immediate priority updates

**Validations:**
- ✅ `activityId` must match activity that was executed
- ✅ `duration` must be non-negative
- ✅ `cost` must be non-negative
- ✅ `tokens` must be non-negative integers
- ⚠️ No validation that activity actually executed (could be fake data)

**Side Effects:**
- HTTP request to Metabob backend MCP server
- Backend updates `activity_executions` table (PostgreSQL)
- Backend updates `activity_templates` table (metrics)
- Backend recalculates `boredom_activities` view (priorities)
- Backend may send notification if template now high-priority

---

## Transformation 10: Cancellation Trigger → Activity Abort

**Component Flow:** `BoredomManager.trackActivity()` → `AbortController.abort()` → `TemplateExecutor` checks

**What:**
- Detect user activity while boredom activity running
- Call `abort()` on stored AbortController
- Propagate AbortSignal through execution chain
- Gracefully stop execution and clean up

**Type Conversion:**
```typescript
// INPUT: User returns (new message)
{
  sessionID: string,
  manager: ManagerInstance {
    isIdle: true,                       // Was idle
    currentActivity: {
      activityId: "act_xyz123",
      abortController: AbortController {
        signal: AbortSignal {
          aborted: false                // Not yet aborted
        }
      }
    }
  }
}

// ABORT CALL:
manager.currentActivity.abortController.abort()

// SIGNAL STATE CHANGE:
AbortSignal {
  aborted: true,                        // NOW TRUE
  reason: undefined,                    // Optional abort reason
  onabort: [Function]                   // Event handler called
}

// EXECUTION CHAIN CHECKS (in TemplateExecutor):
// Before each task:
if (abortSignal?.aborted) {
  throw new AbortError("Activity cancelled by user")
}

// OUTPUT: Activity State
{
  activity: Activity.Info {
    status: "cancelled",                // Changed from "executing"
    completedAt: Date.now(),
    error: "Activity cancelled by user"
  },
  manager: ManagerInstance {
    isIdle: false,                      // Reset to active
    currentActivity: undefined          // Cleared
  }
}
```

**Business Logic:**
1. **Abort detection:**
   - Check `isIdle && currentActivity` before updating `lastActivityTime`
   - If true: user returned while boredom activity running
   - Call `abortController.abort()` to signal cancellation

2. **Signal propagation:**
   - `AbortSignal` is passed through function calls
   - Each component checks `abortSignal.aborted` before proceeding
   - TemplateExecutor checks before EACH task (not just at start)

3. **Graceful shutdown:**
   - Current task finishes (don't interrupt LLM mid-generation)
   - Remaining tasks marked as "pending"
   - Activity state saved with `status: "cancelled"`
   - Report cancellation to backend

4. **Cleanup:**
   - Clear `manager.currentActivity` to release memory
   - Don't clear `lastActivityTime` (preserve for next idle check)
   - Activity remains in storage (for debugging and metrics)

**Why:**
- **Business Requirement:** User activity must immediately stop boredom work
- **Constraint:** Can't force-kill LLM API call (must wait for response)
- **Alternative:** Could use timeout (risk incomplete work), but AbortSignal is standard pattern

**Validations:**
- ✅ `currentActivity` exists before calling `abort()`
- ✅ `abortSignal` is checked before each task
- ⚠️ No validation that abort is handled correctly (trust execution chain)

**Side Effects:**
- Sets `abortSignal.aborted = true` (state mutation)
- Calls `onabort` event handlers (if registered)
- Throws `AbortError` in execution chain (exception flow)
- Updates `Activity.Info` with cancelled status
- Reports cancellation to backend via MCP

---

## Summary of Key Transformations

### Data Type Changes:
1. **Session.Info → ManagerInstance** - Extract session ID, initialize idle state
2. **PromptInput → Timestamp** - Extract session ID, update activity time
3. **Idle Duration → BoredomActivity[]** - Fetch from backend, sort by priority
4. **BoredomActivity → ExecutionInput** - Extract template ID and variables
5. **Template + Variables → ValidationResult** - Check required fields, fuzzy match
6. **CreateOptions → Activity.Info** - Generate ID, initialize stats
7. **Template + Activity → ExecutionResult** - Execute tasks, collect metrics
8. **ExecutionResult → Template Metrics** - Update averages incrementally
9. **Activity + Result → Backend Report** - Format for MCP API call
10. **User Activity → Abort Signal** - Cancel running boredom activity

### Critical Validations:
- ✅ Session exists before monitoring
- ✅ Idle threshold (5 min) before fetching activities
- ✅ Template variables match schema
- ✅ All required variables provided
- ✅ Task dependencies are acyclic
- ✅ Validation commands pass
- ⚠️ No validation that activities are semantically correct

### Key Side Effects:
- Creates NodeJS.Timeout (periodic idle check)
- HTTP requests to Metabob backend MCP
- Calls LLM API (tokens consumed, cost incurred)
- Creates files and git commits
- Updates PostgreSQL database (backend)
- Propagates AbortSignal (cancellation)

---

## Business Requirements Satisfied

1. **Idle Detection (5 min)** - Transformation 2 & 3
2. **Priority-Based Execution** - Transformation 3 (sorting by priority)
3. **Cancellation on User Return** - Transformation 2 & 10
4. **Metrics Reporting** - Transformation 8 & 9
5. **Improvement Gradient Learning** - Transformation 9 (backend update)

---

## Technical Constraints Enforced

1. **Session Isolation** - Each session has separate ManagerInstance
2. **Cancellation Graceful** - AbortSignal checked before each task
3. **Metrics Persistence** - All executions saved to storage
4. **Variable Validation** - Required fields checked before execution
5. **Resource Cleanup** - Timers cleared, activity state reset

---

## Alternative Approaches Considered

1. **Debouncing** - Could track activity only if >1 min since last, but simpler to track every message
2. **Child Session** - Could execute in child session, but impulses wouldn't be visible to parent
3. **Exponential Moving Average** - Could weight recent executions more, but simple average is simpler
4. **Force-Kill** - Could terminate LLM call immediately, but graceful is safer
5. **Batch Reporting** - Could batch metrics updates, but real-time enables immediate priority adjustments

