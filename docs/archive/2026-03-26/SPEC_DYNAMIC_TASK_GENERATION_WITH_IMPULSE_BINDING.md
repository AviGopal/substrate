# Specification: Dynamic Task Generation with Impulse Binding

## Problem Statement

**Current State**: Goal-seeking activity creation (`create_activity_goal_seeking`) generates ALL tasks upfront via a single LLM call, then executes them sequentially. This violates the principle of "guaranteed runnable" activities because:

1. **Upfront Planning Fragility**: LLM must predict entire task graph without seeing intermediate results
2. **No Adaptive Generation**: Later tasks cannot adapt based on what actually worked in earlier tasks
3. **Missing Context Flow**: No automatic impulse creation/binding between tasks
4. **Manual Variable Wiring**: Developer must manually specify all variable dependencies
5. **Lower Success Rate**: First execution often fails because planning assumptions don't match reality

**Desired State**: Activities should be built **dynamically** during execution, where:

1. **Progressive Generation**: Start with 1-2 initial tasks, execute, then generate next tasks
2. **Trailblazing Integration**: Each task executes via trailblazing, allowing continuation prompts
3. **Automatic Impulse Binding**: Outputs become impulses, automatically bound as variables
4. **Context Continuity**: Each task receives previous results as typed impulse variables
5. **Higher Success Rate**: Adaptive generation based on actual execution results

## Architecture Gap Analysis

### Current Flow (Broken)

```
User invokes create_activity_goal_seeking(goal)
  ↓
generatePlan() → LLM decomposition (SINGLE CALL)
  ↓
Returns: Complete task DAG with N tasks
  ↓
planToTemplate() → Convert all tasks to template
  ↓
Register template
  ↓
Execute template (tasks run sequentially)
  ↓
Problem: No inter-task context flow, no adaptive generation
```

### Desired Flow (Fixed)

```
User invokes create_activity_goal_seeking(goal)
  ↓
generateInitialSkeleton() → LLM generates 1-2 starter tasks only
  ↓
Returns: Minimal skeleton with first tasks
  ↓
FOR EACH task execution:
  ├─ Execute task via trailblazing
  ├─ Capture outputs as impulses (scripts, tests, artifacts, logs)
  ├─ Bind impulses as variables for next tasks
  ├─ LLM proposes next task(s) based on results
  ├─ Inject new tasks into template
  └─ Repeat until goal achieved
  ↓
Finalize template with all generated tasks + impulse bindings
  ↓
Register complete template
  ↓
Template is immediately runnable with impulse resolution
```

## Component Changes Required

### 1. GoalSeekingPlanner (`goal-seeking-planner.ts`)

**Current**:
```typescript
export async function generatePlan(params: {
  goalDescription: string
  // ... other params
}): Promise<Plan> {
  // Decomposes goal into ALL sub-goals upfront
  const decomposition = await decomposeGoal(...)
  
  const tasks: Plan["tasks"] = []
  for (const subGoal of decomposition.subGoals) {
    tasks.push({ /* static task */ })
  }
  
  return { goalDescription, tasks, metadata }
}
```

**Required**:
```typescript
export async function generateInitialSkeleton(params: {
  goalDescription: string
  // ... other params
}): Promise<{ initialTasks: Plan["tasks"], context: SkeletonContext }> {
  // Generate only 1-2 starter tasks
  const initialDecomposition = await decomposeGoalPartial({
    goalDescription,
    maxInitialTasks: 2,
    returnEarly: true
  })
  
  return {
    initialTasks: initialDecomposition.tasks,
    context: {
      goal: goalDescription,
      pendingSubGoals: initialDecomposition.pendingSubGoals,
      variables: params.variables
    }
  }
}

export async function proposeNextTasks(params: {
  context: SkeletonContext
  completedTasks: ExecutedTask[]
  capturedImpulses: Impulse[]
}): Promise<{ nextTasks: Plan["tasks"], complete: boolean }> {
  // LLM analyzes completed work and proposes next steps
  const continuationPrompt = buildContinuationPrompt({
    goal: params.context.goal,
    completedTasks: params.completedTasks,
    capturedImpulses: params.capturedImpulses,
    pendingSubGoals: params.context.pendingSubGoals
  })
  
  const proposal = await llmProposal(continuationPrompt)
  
  return {
    nextTasks: proposal.tasks,
    complete: proposal.goalAchieved
  }
}
```

### 2. TrailblazingExecutor (`trailblazing-executor.ts`)

**Current**: Only handles failure recovery

**Required**: Add impulse capture and continuation support

```typescript
export async function executeTaskWithImpulseCapture(params: {
  task: ActivityTemplate.Task
  variables: Record<string, unknown>
  sessionID: string
  // ... other params
}): Promise<{
  result: TaskResult
  capturedImpulses: Impulse[]  // NEW
  proposedNextTasks?: Plan["tasks"]  // NEW
}> {
  // Execute task
  const result = await executeTaskWithTrailblazing(params)
  
  // Capture outputs as impulses
  const impulses = await captureTaskOutputsAsImpulses({
    sessionID: params.sessionID,
    taskId: params.task.id,
    executionResult: result
  })
  
  // Check if LLM proposed continuation tasks
  const proposedTasks = extractProposedTasksFromSession(params.sessionID)
  
  return { result, capturedImpulses: impulses, proposedNextTasks: proposedTasks }
}

async function captureTaskOutputsAsImpulses(params: {
  sessionID: string
  taskId: string
  executionResult: TaskResult
}): Promise<Impulse[]> {
  const impulses: Impulse[] = []
  
  // Scan session for tool outputs
  const session = await Session.load(params.sessionID)
  const messages = session.messages
  
  for (const msg of messages) {
    for (const toolCall of msg.toolCalls || []) {
      // Capture bash outputs
      if (toolCall.name === 'bash') {
        impulses.push(createImpulse({
          type: 'bashOutput',
          taskId: params.taskId,
          command: toolCall.input.command,
          output: toolCall.output,
          exitCode: toolCall.metadata?.exitCode
        }))
      }
      
      // Capture written files
      if (toolCall.name === 'write') {
        impulses.push(createImpulse({
          type: 'file',
          taskId: params.taskId,
          path: toolCall.input.filePath,
          content: toolCall.input.content
        }))
      }
      
      // Capture test results
      if (toolCall.name === 'bash' && toolCall.input.command.includes('test')) {
        impulses.push(createImpulse({
          type: 'testResults',
          taskId: params.taskId,
          command: toolCall.input.command,
          output: toolCall.output,
          exitCode: toolCall.metadata?.exitCode,
          passed: toolCall.metadata?.exitCode === 0
        }))
      }
      
      // Capture activity outputs
      if (toolCall.name === 'activity') {
        impulses.push(createImpulse({
          type: 'activityOutput',
          taskId: params.taskId,
          activityId: toolCall.input.templateId,
          result: toolCall.output
        }))
      }
    }
  }
  
  // Create summary impulse
  impulses.push(createImpulse({
    type: 'taskSummary',
    taskId: params.taskId,
    success: params.executionResult.success,
    duration: params.executionResult.duration,
    cost: params.executionResult.cost,
    keyOutputs: impulses.map(i => i.id)
  }))
  
  return impulses
}
```

### 3. CreateActivityGoalSeekingTool (`create-activity-goal-seeking.ts`)

**Current**: Calls `generatePlan()` once, converts to template, registers

**Required**: Orchestrate progressive task generation

```typescript
async execute(params, ctx) {
  const {
    goalDescription,
    templateName,
    category,
    variables = {},
    impulseRefs = [],
    constraints = {},
    registerToBackend = true,
  } = params

  log.info("creating activity template with progressive task generation", {
    goal: goalDescription.slice(0, 100),
    templateName,
    category
  })

  // Phase 1: Generate initial skeleton (1-2 tasks)
  const { initialTasks, context } = await GoalSeekingPlanner.generateInitialSkeleton({
    goalDescription,
    category,
    variables,
    impulseRefs,
    constraints,
    sessionID: ctx.sessionID,
    abortSignal: ctx.abort
  })

  log.info("generated initial skeleton", {
    taskCount: initialTasks.length,
    tasks: initialTasks.map(t => t.id)
  })

  // Phase 2: Progressive task execution and generation
  const allTasks: Plan["tasks"] = [...initialTasks]
  const allImpulses: Impulse[] = []
  const completedTasks: ExecutedTask[] = []
  
  let complete = false
  let iterationCount = 0
  const maxIterations = constraints.maxTasks ?? 10
  
  while (!complete && iterationCount < maxIterations) {
    iterationCount++
    
    log.info("iteration", {
      iteration: iterationCount,
      pendingTasks: allTasks.length - completedTasks.length,
      completedTasks: completedTasks.length
    })
    
    // Find next task to execute (first uncompleted task)
    const nextTask = allTasks.find(t => !completedTasks.some(c => c.id === t.id))
    
    if (!nextTask) {
      log.info("no pending tasks, execution complete")
      break
    }
    
    // Execute task with impulse capture
    const { result, capturedImpulses, proposedNextTasks } = 
      await TrailblazingExecutor.executeTaskWithImpulseCapture({
        task: convertPlanTaskToTemplateTask(nextTask),
        variables: buildTaskVariables(variables, allImpulses),
        sessionID: ctx.sessionID,
        abortSignal: ctx.abort,
        trailblazingOptions: {
          enabled: true,
          maxCostPerTask: constraints.maxCostPerTask ?? 1.0,
          maxTotalCost: constraints.maxCost ?? 5.0,
          maxRecoveryAttempts: 3
        }
      })
    
    // Record completion
    completedTasks.push({
      id: nextTask.id,
      result,
      impulses: capturedImpulses
    })
    
    allImpulses.push(...capturedImpulses)
    
    log.info("task completed", {
      taskId: nextTask.id,
      success: result.success,
      impulsesCreated: capturedImpulses.length
    })
    
    // Check if task failed and no recovery possible
    if (!result.success) {
      log.error("task failed without recovery", {
        taskId: nextTask.id,
        error: result.finalError
      })
      throw new Error(`Task ${nextTask.id} failed: ${result.finalError}`)
    }
    
    // Phase 3: Propose next tasks based on results
    const { nextTasks, complete: goalComplete } = 
      await GoalSeekingPlanner.proposeNextTasks({
        context,
        completedTasks,
        capturedImpulses: allImpulses
      })
    
    if (goalComplete) {
      log.info("goal achieved, no more tasks needed")
      complete = true
      break
    }
    
    if (nextTasks.length > 0) {
      log.info("injecting proposed tasks", {
        count: nextTasks.length,
        tasks: nextTasks.map(t => t.id)
      })
      
      // Add proposed tasks with impulse bindings
      for (const newTask of nextTasks) {
        // Bind impulses as variables
        newTask.impulseRefs = allImpulses.map(i => i.id)
        newTask.variables = {
          ...newTask.variables,
          ...bindImpulsesAsVariables(allImpulses, newTask.id)
        }
        
        allTasks.push(newTask)
      }
    }
  }
  
  if (iterationCount >= maxIterations) {
    log.warn("max iterations reached, finalizing template", {
      iterations: iterationCount,
      completedTasks: completedTasks.length
    })
  }
  
  // Phase 4: Convert progressive execution into template
  log.info("converting execution history to template", {
    totalTasks: allTasks.length,
    totalImpulses: allImpulses.length
  })
  
  const template = await convertExecutionToTemplate({
    goalDescription,
    templateName,
    category,
    tasks: allTasks,
    impulses: allImpulses,
    completedTasks
  })
  
  log.info("template created", {
    templateId: template.id,
    taskCount: template.tasks.length,
    impulseCount: allImpulses.length
  })
  
  // Phase 5: Register to backend
  if (registerToBackend) {
    await TemplateRepository.save(template, ["metabob"])
    log.info("template registered to backend")
  }
  
  // Phase 6: Generate output report
  return generateCreationReport({
    template,
    executionHistory: completedTasks,
    impulses: allImpulses
  })
}
```

### 4. Impulse System Enhancements

**New Impulse Types**:

```typescript
// repos/metabob-opencode/packages/opencode/src/session/impulse.ts

export type ImpulseType = 
  | 'file'
  | 'bashOutput'
  | 'testResults'      // NEW
  | 'activityOutput'
  | 'taskSummary'      // NEW
  | 'scriptArtifact'   // NEW
  | 'memo'
  | 'metabobIssue'
  | 'custom'

export interface TestResultsImpulse {
  type: 'testResults'
  taskId: string
  command: string
  output: string
  exitCode: number
  passed: boolean
  testCount?: number
  failedTests?: string[]
}

export interface TaskSummaryImpulse {
  type: 'taskSummary'
  taskId: string
  success: boolean
  duration: number
  cost: number
  keyOutputs: string[]  // Impulse IDs
}

export interface ScriptArtifactImpulse {
  type: 'scriptArtifact'
  taskId: string
  path: string
  content: string
  executable: boolean
  purpose: string
}
```

**Variable Binding Utility**:

```typescript
function bindImpulsesAsVariables(
  impulses: Impulse[],
  taskId: string
): Record<string, unknown> {
  const bindings: Record<string, unknown> = {}
  
  // Group impulses by type
  const byType = groupBy(impulses, i => i.type)
  
  // Bind bash outputs
  if (byType.bashOutput) {
    bindings.previousCommands = byType.bashOutput.map(i => ({
      command: i.command,
      output: i.output,
      exitCode: i.exitCode
    }))
  }
  
  // Bind test results
  if (byType.testResults) {
    bindings.testResults = byType.testResults.map(i => ({
      command: i.command,
      passed: i.passed,
      output: i.output
    }))
    bindings.allTestsPassed = byType.testResults.every(i => i.passed)
  }
  
  // Bind file artifacts
  if (byType.file) {
    bindings.createdFiles = byType.file.map(i => i.path)
  }
  
  // Bind script artifacts
  if (byType.scriptArtifact) {
    bindings.generatedScripts = byType.scriptArtifact.map(i => ({
      path: i.path,
      purpose: i.purpose
    }))
  }
  
  // Bind activity outputs
  if (byType.activityOutput) {
    bindings.activityResults = byType.activityOutput.map(i => ({
      activityId: i.activityId,
      result: i.result
    }))
  }
  
  // Bind task summaries
  if (byType.taskSummary) {
    const lastTask = byType.taskSummary[byType.taskSummary.length - 1]
    bindings.previousTaskSuccess = lastTask.success
    bindings.previousTaskDuration = lastTask.duration
  }
  
  return bindings
}
```

## Validation Strategy

### Test Scenario: Build-Test-Deploy Pipeline

**Goal**: "Create a build-test-deploy pipeline activity"

**Expected Execution Flow**:

1. **Iteration 1**: Generate initial tasks
   - Task 1: "Build Docker image"
   - Task 2: "Run unit tests"

2. **Execute Task 1**: Build Docker image
   - Output: `docker build` logs
   - Impulse created: `bashOutput` with build logs
   - Impulse created: `scriptArtifact` with Dockerfile path
   - Variable bindings: `{{imageName}}`, `{{buildLogs}}`

3. **Propose Next Tasks**: Based on successful build
   - LLM sees: Build succeeded, image created
   - Proposes: Task 3 "Run integration tests with built image"
   - Variable binding: `{{imageName}}` from Task 1

4. **Execute Task 2**: Run unit tests
   - Output: Test results
   - Impulse created: `testResults` with pass/fail
   - Variable bindings: `{{testsPassed}}`, `{{failedTests}}`

5. **Propose Next Tasks**: Based on test results
   - LLM sees: Tests passed, image built
   - Proposes: Task 4 "Deploy to staging with health checks"
   - Variable bindings: `{{imageName}}`, `{{testResults}}`

6. **Execute Task 3**: Integration tests
   - Uses `{{imageName}}` from Task 1
   - Output: Integration test results
   - Impulse created: `testResults`

7. **Propose Next Tasks**: Based on integration results
   - LLM sees: All tests passed
   - Proposes: Task 5 "Deploy to staging"
   - Variable bindings: `{{imageName}}`, `{{allTestsPassed}}`

8. **Execute Task 4**: Deploy to staging
   - Uses `{{imageName}}` and `{{allTestsPassed}}`
   - Output: Deployment logs, health check results
   - Impulse created: `bashOutput` with kubectl logs

9. **Goal Complete**: LLM determines goal achieved
   - All tasks executed successfully
   - Pipeline is complete and functional

10. **Template Registration**:
    - Template has 5 tasks (dynamically generated)
    - Each task has impulse bindings for previous results
    - Template is immediately runnable with impulse resolution

### Validation Harness

```typescript
// tests/validation-harnesses/dynamic-task-generation-validation.ts

import { create_activity_goal_seeking } from '../src/tool/create-activity-goal-seeking'

async function validateDynamicTaskGeneration() {
  console.log("=== Validating Dynamic Task Generation ===\n")
  
  // Test 1: Initial skeleton is minimal
  console.log("Test 1: Verify initial skeleton has 1-2 tasks only")
  const result = await create_activity_goal_seeking({
    goalDescription: "Create a build-test-deploy pipeline",
    templateName: "Build-Test-Deploy Pipeline",
    category: "infrastructure",
    constraints: {
      maxTasks: 10,
      preferComposition: true
    }
  })
  
  // Extract execution metadata
  const executionLog = result.metadata.executionLog
  const iterations = executionLog.iterations
  
  console.log(`✓ Iterations: ${iterations.length}`)
  console.log(`✓ Initial tasks: ${iterations[0].tasks.length}`)
  
  if (iterations[0].tasks.length > 2) {
    throw new Error("Initial skeleton should have ≤2 tasks")
  }
  
  // Test 2: Tasks are generated progressively
  console.log("\nTest 2: Verify tasks generated progressively")
  for (let i = 1; i < iterations.length; i++) {
    const prevTaskCount = iterations[i-1].totalTasks
    const currTaskCount = iterations[i].totalTasks
    
    if (currTaskCount > prevTaskCount) {
      console.log(`✓ Iteration ${i}: Added ${currTaskCount - prevTaskCount} new tasks`)
    }
  }
  
  // Test 3: Impulses captured for each task
  console.log("\nTest 3: Verify impulses captured")
  const allImpulses = result.metadata.impulses
  console.log(`✓ Total impulses: ${allImpulses.length}`)
  console.log(`✓ Types: ${Object.keys(groupBy(allImpulses, i => i.type))}`)
  
  // Test 4: Variable bindings created
  console.log("\nTest 4: Verify variable bindings")
  const template = result.template
  for (const task of template.tasks) {
    if (task.variables && Object.keys(task.variables).length > 0) {
      console.log(`✓ Task ${task.id}: ${Object.keys(task.variables).length} variables bound`)
    }
  }
  
  // Test 5: Template is runnable
  console.log("\nTest 5: Verify template is runnable")
  // Execute the generated template
  const { activity } = await import('../src/tool/activity')
  const execution = await activity({
    templateId: template.id,
    variables: {},
    reason: "Validating generated template"
  })
  
  if (execution.success) {
    console.log("✓ Template executed successfully")
  } else {
    throw new Error("Generated template failed to execute")
  }
  
  console.log("\n=== All Tests Passed ===")
}
```

## Success Criteria

1. ✅ **Progressive Generation**: Activities start with ≤2 tasks, add more during execution
2. ✅ **Impulse Capture**: Every task output becomes an impulse (bash, files, tests, artifacts)
3. ✅ **Variable Binding**: Each task can reference previous results via impulse variables
4. ✅ **Adaptive Planning**: LLM proposes next tasks based on actual execution results
5. ✅ **Context Continuity**: `{{previousTask.output}}`, `{{testResults.passed}}`, etc. work
6. ✅ **Higher Success Rate**: First execution succeeds because tasks adapt to reality
7. ✅ **Immediate Runnability**: Generated templates can be executed without modification

## Benefits

### Before (Current System)
- ❌ All tasks generated upfront without seeing results
- ❌ No context flow between tasks
- ❌ Manual variable wiring required
- ❌ First execution often fails
- ❌ Rigid plan cannot adapt

### After (This Specification)
- ✅ Tasks generated progressively based on results
- ✅ Automatic context flow via impulse bindings
- ✅ Variables auto-wired from previous outputs
- ✅ Higher first-run success rate
- ✅ Adaptive plan responds to execution reality

## Implementation Priority

1. **Phase 1** (Core): Impulse capture and binding utilities
2. **Phase 2** (Critical): Progressive task generation in GoalSeekingPlanner
3. **Phase 3** (Integration): Update CreateActivityGoalSeekingTool orchestration
4. **Phase 4** (Validation): Build and run validation harness
5. **Phase 5** (Deployment): Deploy and test in devbob K8s environment

## Related Specifications

- `dynamic-activity-creation-with-trailblazing-pass4`: Provides trailblazing infrastructure
- `activity-impulse-learning-loop-execution-validation`: Provides impulse system infrastructure
- `trace-enforce-validate-loop`: Provides validation framework

This specification builds on the trailblazing infrastructure but **completes the missing piece**: actual dynamic task generation with impulse-based context flow.
