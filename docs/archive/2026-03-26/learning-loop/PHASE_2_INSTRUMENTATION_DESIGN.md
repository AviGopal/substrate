# Phase 2: Activity Execution Instrumentation Design

**Date**: 2026-02-23  
**Goal**: Capture complete activity execution context for learning, replay, evolution, and merging

## Core Principle: State Transformation Tracking

**Key Insight**: Activities transform **instructional state** (what we want) into **functional state** (what exists).

- **Instructional State**: Template + Variables + Reason + Context
- **Functional State**: May be code, data, configuration, infrastructure, or any other system state
- **Transformation Process**: Sequence of tasks that bridge instructional → functional

To enable activity evolution, we must capture:
1. **Initial State**: What existed before (functional state snapshot)
2. **Instructions**: What we wanted to achieve (template + variables)
3. **Process**: How we tried to achieve it (task sequence + decisions)
4. **Outcome**: What actually changed (functional state delta)
5. **Context**: Why and under what conditions (reason + environment)

This enables us to:
- **Fix**: Replay with corrected steps
- **Evolve**: Improve templates based on what actually worked
- **Merge**: Combine similar workflows that achieve the same outcome
- **Split**: Separate complex workflows into composable primitives
- **Learn**: Convert fuzzy workflows into reliable, validatable outcomes

---

## Architecture Overview

### Data Model: Three Layers

```
Layer 1: EXECUTION RECORD (what happened)
  ├─ activity_execution: High-level metrics
  └─ activity_content: Complete execution context

Layer 2: TASK TRACKING (how it happened)
  ├─ task_execution: Individual task records
  └─ task_artifacts: Outputs, files, impulses per task

Layer 3: CONVERSATION CONTEXT (why decisions were made)
  ├─ session_transcript: Full conversation per task
  └─ tool_calls: Detailed tool execution log
```

### What Makes This Different From Traditional Logging

**Traditional logging**: "User created file X, modified function Y"  
**Our approach**: "To achieve Z (instructional), we transformed state A→B via tasks T1,T2 (process), resulting in delta D (functional)"

This enables:
- Pattern detection: "These 5 different templates all achieve the same state transformation"
- Workflow evolution: "This template used to need 7 tasks, but we learned it only needs 3"
- Failure analysis: "This state transformation always fails when condition C is present"
- Automatic merging: "Template A and B can be merged because they're functionally equivalent"

---

## Implementation Plan

### 1. Activity Content Capture (Start of Execution)

**When**: Activity execution begins (before first task)  
**Where**: `src/agent/activity/activity-executor.ts` → `executeActivity()`

**What to Capture**:
```typescript
{
  execution_id: "exec_abc123_timestamp",
  variant_id: "template-variant-hash",
  activity_id: "template-name",
  
  // INSTRUCTIONAL STATE
  template_definition: {
    name: "...",
    description: "...",
    category: "...",
    tasks: [...],  // Full task sequence
    validation: {...},
    retry: {...}
  },
  
  variable_bindings: {
    // Actual values provided
    "featureName": "user authentication",
    "files": ["src/auth.ts"],
    ...
  },
  
  reason: "User requested ability to authenticate users with JWT tokens",
  
  // INITIAL FUNCTIONAL STATE SNAPSHOT
  initial_state: {
    git_branch: "main",
    git_commit: "abc123...",
    working_directory: "/path/to/project",
    modified_files: [],  // Clean state
    impulse_ids: ["imp_1", "imp_2"],  // Context impulses
    metabob_issues: [...]  // Pre-existing issues in scope
  },
  
  // ENVIRONMENT CONTEXT
  environment: {
    opencode_version: "1.0.0",
    node_version: "20.0.0",
    platform: "linux",
    cwd: "/project"
  },
  
  started_at: "2026-02-23T10:30:00Z"
}
```

**Purpose**: 
- Enables perfect replay (we know exactly what was requested and the starting state)
- Enables template evolution (we can analyze which variable combinations succeed/fail)
- Enables merging (we can detect when different templates solve the same problem)

### 2. Task Execution Tracking (During Execution)

**When**: Each task starts/completes  
**Where**: `src/agent/activity/activity-executor.ts` → `executeTask()`

**What to Capture**:

#### Task Start:
```typescript
{
  task_execution_id: "task_exec_abc123",
  execution_id: "exec_abc123_timestamp",  // Parent activity
  task_id: "task-1",
  task_index: 0,
  
  task_definition: {
    id: "task-1",
    description: "Implement authentication logic",
    prompt: {
      template: "Create JWT auth in {{file}}",
      variables: {...},
      maxTokens: 8000
    },
    dependencies: [],
    retry: {...}
  },
  
  // STATE BEFORE TASK
  state_before: {
    git_diff: "",  // Or actual diff if files changed by previous task
    impulse_count: 5,
    file_states: {
      "src/auth.ts": {
        exists: false,
        lines: 0,
        hash: null
      }
    }
  },
  
  started_at: "2026-02-23T10:30:15Z",
  status: "running"
}
```

#### Task Complete:
```typescript
{
  task_execution_id: "task_exec_abc123",
  
  // OUTCOME
  status: "success" | "failed" | "skipped",
  success: true,
  
  // STATE AFTER TASK (FUNCTIONAL STATE DELTA)
  state_after: {
    git_diff: "...",  // Actual changes made
    files_created: ["src/auth.ts", "src/auth.test.ts"],
    files_modified: ["src/index.ts"],
    files_deleted: [],
    impulse_ids_created: ["imp_auth_design"],
    tool_calls_count: 15
  },
  
  // VALIDATION RESULTS
  validation: {
    required_files_exist: true,
    required_patterns_match: true,
    forbidden_patterns_absent: true,
    commands_passed: {
      "npm test": {success: true, output: "..."},
      "npm run build": {success: true, output: "..."}
    }
  },
  
  // PERFORMANCE
  duration_ms: 45000,
  tokens_used: {input: 6000, output: 800, cache: 200},
  cost_usd: 0.05,
  
  // ERROR TRACKING
  error_type: null,
  error_message: null,
  retry_count: 0,
  
  completed_at: "2026-02-23T10:31:00Z"
}
```

**Purpose**:
- Track what each task actually did (functional state transformation)
- Enable granular replay (replay from specific failed task)
- Enable task-level learning (which tasks are most error-prone?)
- Enable workflow optimization (which tasks are redundant?)

### 3. Session Transcript Storage (Conversation Context)

**When**: After each task completes  
**Where**: `src/agent/activity/activity-executor.ts` → after session ends

**What to Capture**:
```typescript
{
  task_execution_id: "task_exec_abc123",
  
  // FULL CONVERSATION
  messages: [
    {
      role: "system",
      content: "You are the general agent...",
      timestamp: "2026-02-23T10:30:15Z"
    },
    {
      role: "user", 
      content: "Create JWT authentication in src/auth.ts...",
      timestamp: "2026-02-23T10:30:15Z"
    },
    {
      role: "assistant",
      content: "I'll implement JWT authentication...",
      timestamp: "2026-02-23T10:30:16Z",
      tool_calls: [...]
    },
    ...
  ],
  
  // TOOL EXECUTION LOG
  tool_calls: [
    {
      tool: "write",
      arguments: {filePath: "src/auth.ts", content: "..."},
      result: "success",
      timestamp: "2026-02-23T10:30:20Z"
    },
    {
      tool: "bash",
      arguments: {command: "npm test"},
      result: {exit_code: 0, output: "..."},
      timestamp: "2026-02-23T10:30:45Z"
    }
  ],
  
  // DECISION POINTS
  key_decisions: [
    {
      decision: "Chose JWT over session cookies",
      reasoning: "User requirements specified stateless auth",
      alternatives_considered: ["sessions", "OAuth"],
      timestamp: "2026-02-23T10:30:25Z"
    }
  ]
}
```

**Purpose**:
- Understand why agent made specific decisions
- Learn from successful reasoning patterns
- Debug failures by seeing thought process
- Extract decision-making patterns for template evolution

### 4. Task Artifacts Storage (Concrete Outputs)

**When**: Task completes successfully  
**Where**: `src/agent/activity/activity-executor.ts` → after validation

**What to Capture**:
```typescript
{
  task_execution_id: "task_exec_abc123",
  
  artifacts: [
    {
      type: "file",
      path: "src/auth.ts",
      content_hash: "sha256:abc123...",
      size_bytes: 2048,
      lines: 80,
      content_preview: "import jwt from 'jsonwebtoken'..." // First 500 chars
    },
    {
      type: "impulse",
      impulse_id: "imp_auth_design",
      pointer_type: "memo",
      budget: 2000,
      content_preview: "Authentication Design:\n- JWT tokens..."
    },
    {
      type: "test_output",
      command: "npm test",
      exit_code: 0,
      output: "All tests passed (15/15)",
      duration_ms: 3000
    },
    {
      type: "git_commit",
      commit_hash: "def456...",
      message: "feat: Add JWT authentication",
      files_changed: 3
    }
  ]
}
```

**Purpose**:
- Reference artifacts when replaying
- Analyze output patterns across executions
- Detect when tasks produce similar artifacts (merging candidates)
- Enable artifact-based validation

---

## Instrumentation Points in Code

### Point 1: Activity Start (activity-executor.ts)

```typescript
async executeActivity(template, variables, reason) {
  const executionId = generateExecutionId();
  const variantId = hashVariant(template, variables);
  
  // 🎯 INSTRUMENTATION: Capture initial state
  const activityContent = {
    execution_id: executionId,
    variant_id: variantId,
    activity_id: template.name,
    template_definition: template,
    variable_bindings: variables,
    reason: reason,
    initial_state: await captureInitialState(),
    environment: captureEnvironment(),
    started_at: new Date().toISOString()
  };
  
  // 💾 WRITE: Store activity content
  await this.storeActivityContent(activityContent);
  
  // Continue with execution...
  for (const task of template.tasks) {
    await this.executeTask(executionId, task, ...);
  }
}
```

### Point 2: Task Start (activity-executor.ts)

```typescript
async executeTask(executionId, task, taskIndex) {
  const taskExecutionId = generateTaskExecutionId();
  
  // 🎯 INSTRUMENTATION: Capture state before task
  const stateBefore = await captureCurrentState();
  
  const taskExecution = {
    task_execution_id: taskExecutionId,
    execution_id: executionId,
    task_id: task.id,
    task_index: taskIndex,
    task_definition: task,
    state_before: stateBefore,
    started_at: new Date().toISOString(),
    status: "running"
  };
  
  // 💾 WRITE: Record task start
  await this.recordTaskStart(taskExecution);
  
  // Execute task...
  const result = await this.runTask(task);
  
  // Continue to task completion...
}
```

### Point 3: Task Complete (activity-executor.ts)

```typescript
async executeTask(executionId, task, taskIndex) {
  // ... task execution ...
  
  // 🎯 INSTRUMENTATION: Capture state after task
  const stateAfter = await captureCurrentState();
  const stateDelta = computeDelta(stateBefore, stateAfter);
  
  // 🎯 INSTRUMENTATION: Run validation
  const validationResults = await this.validateTask(task, stateAfter);
  
  // 🎯 INSTRUMENTATION: Capture session transcript
  const transcript = await this.captureSessionTranscript(sessionId);
  
  // 🎯 INSTRUMENTATION: Collect artifacts
  const artifacts = await this.collectTaskArtifacts(stateDelta);
  
  const taskUpdate = {
    task_execution_id: taskExecutionId,
    status: result.success ? "success" : "failed",
    success: result.success,
    state_after: stateAfter,
    state_delta: stateDelta,
    validation: validationResults,
    duration_ms: Date.now() - startTime,
    tokens_used: result.tokens,
    cost_usd: result.cost,
    error_type: result.error?.type,
    error_message: result.error?.message,
    retry_count: result.retryCount,
    completed_at: new Date().toISOString()
  };
  
  // 💾 WRITE: Update task execution
  await this.updateTaskExecution(taskUpdate);
  
  // 💾 WRITE: Store transcript
  await this.storeSessionTranscript(taskExecutionId, transcript);
  
  // 💾 WRITE: Store artifacts
  await this.storeTaskArtifacts(taskExecutionId, artifacts);
}
```

### Point 4: Activity Complete (activity-executor.ts)

```typescript
async executeActivity(template, variables, reason) {
  // ... all tasks executed ...
  
  // 🎯 INSTRUMENTATION: Compute overall success
  const allTasksSucceeded = taskResults.every(t => t.success);
  
  // 🎯 INSTRUMENTATION: Capture final state
  const finalState = await captureCurrentState();
  const totalDelta = computeDelta(initialState, finalState);
  
  const executionSummary = {
    execution_id: executionId,
    variant_id: variantId,
    success: allTasksSucceeded,
    cost_usd: taskResults.reduce((sum, t) => sum + t.cost, 0),
    duration_ms: Date.now() - startTime,
    tokens_input: taskResults.reduce((sum, t) => sum + t.tokens.input, 0),
    tokens_output: taskResults.reduce((sum, t) => sum + t.tokens.output, 0),
    tokens_cache: taskResults.reduce((sum, t) => sum + t.tokens.cache, 0),
    completed_at: new Date().toISOString()
  };
  
  // 💾 WRITE: Record execution (dual-write to Redis + SurrealDB)
  await this.recordExecution(executionSummary);
}
```

---

## State Capture Functions

### captureInitialState()

```typescript
async captureInitialState(): Promise<StateSnapshot> {
  const git = await getGitInfo();
  const files = await getModifiedFiles();
  const impulses = await getLoadedImpulses();
  const issues = await getMetabobIssuesInScope();
  
  return {
    git_branch: git.branch,
    git_commit: git.commit,
    git_dirty: files.length > 0,
    working_directory: process.cwd(),
    modified_files: files,
    impulse_ids: impulses.map(i => i.id),
    metabob_issue_count: issues.length,
    timestamp: new Date().toISOString()
  };
}
```

### captureCurrentState()

```typescript
async captureCurrentState(): Promise<StateSnapshot> {
  // Same as captureInitialState() but called at different times
  return captureInitialState();
}
```

### computeDelta()

```typescript
function computeDelta(before: StateSnapshot, after: StateSnapshot): StateDelta {
  const filesBefore = new Set(before.modified_files);
  const filesAfter = new Set(after.modified_files);
  
  return {
    files_created: [...filesAfter].filter(f => !filesBefore.has(f)),
    files_modified: [...filesAfter].filter(f => filesBefore.has(f)),
    files_deleted: [...filesBefore].filter(f => !filesAfter.has(f)),
    git_diff: await getGitDiff(),
    impulses_created: after.impulse_ids.filter(id => 
      !before.impulse_ids.includes(id)
    ),
    commit_made: before.git_commit !== after.git_commit,
    new_commit_hash: before.git_commit !== after.git_commit ? 
      after.git_commit : null
  };
}
```

---

## Storage Functions (API Calls)

### storeActivityContent()

```typescript
async storeActivityContent(content: ActivityContent) {
  // POST to /v2/activities/content
  await fetch(`${API_URL}/v2/activities/content`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(content)
  });
}
```

### recordTaskStart()

```typescript
async recordTaskStart(taskExecution: TaskExecutionStart) {
  // POST to /v2/activities/tasks
  await fetch(`${API_URL}/v2/activities/tasks`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(taskExecution)
  });
}
```

### updateTaskExecution()

```typescript
async updateTaskExecution(update: TaskExecutionUpdate) {
  // PATCH to /v2/activities/tasks/:id
  await fetch(`${API_URL}/v2/activities/tasks/${update.task_execution_id}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(update)
  });
}
```

---

## Benefits of This Design

### 1. Perfect Replay
- We have initial state, instructions, and every intermediate state
- Can replay from any task in the sequence
- Can modify variables/template and re-run with same starting state

### 2. Template Evolution
- Analyze which task sequences work best for given transformations
- Identify redundant tasks that can be removed
- Detect when multiple templates achieve same outcome → merge candidates

### 3. Workflow Learning
- Convert "fuzzy" manual workflows into reliable templates
- Extract patterns from successful executions
- Build library of state transformations

### 4. Failure Analysis
- See exact state when failure occurred
- Understand why validation failed
- Identify environmental factors that cause failures

### 5. Activity Composition
- Detect when task sequences can be split into reusable sub-activities
- Identify common prefixes/suffixes across templates
- Build composable activity primitives

### 6. Cross-Domain Learning
- Same instrumentation works for code, data, infrastructure, etc.
- Learn state transformation patterns regardless of domain
- Transfer knowledge across different functional state types

---

## Implementation Order

### Sprint 1: Core Instrumentation (This Phase)
1. ✅ Schema ready (activity_content, task_execution tables)
2. ⏭️ Implement state capture functions
3. ⏭️ Add instrumentation points in activity-executor
4. ⏭️ Create API endpoints for storage
5. ⏭️ Test with simple activity execution

### Sprint 2: Rich Context (Next Phase)
1. Add session transcript storage
2. Add task artifacts tracking
3. Implement state delta computation
4. Add decision point extraction

### Sprint 3: Learning & Evolution (Future)
1. Build analysis tools for execution data
2. Implement template merging detection
3. Create workflow optimization suggestions
4. Build activity evolution tools

---

## Success Criteria

**We know Phase 2 is complete when:**
1. ✅ Every activity execution stores complete context in SurrealDB
2. ✅ Every task execution tracked with state before/after
3. ✅ Can query all executions for a given template variant
4. ✅ Can retrieve complete execution context for replay
5. ✅ Validation results stored for failure analysis
6. ✅ Test activity execution produces complete instrumentation data

---

**Next**: Implement core instrumentation in activity-executor.ts
