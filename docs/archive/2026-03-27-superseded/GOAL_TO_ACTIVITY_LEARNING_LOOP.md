# Goal → Activity Learning Loop Design

**Date**: 2026-03-20  
**Objective**: Design the self-development loop where goals create activities that are validated and registered for reuse  
**Status**: Architecture Design

---

## Vision

When a user sends a **goal** to minibob:
1. Minibob executes tasks to accomplish the goal
2. **Captures** the tasks, tools, validations, and outputs
3. **Assembles** them into a reusable activity template
4. **Validates** the template matches learned patterns
5. **Registers** the template with execution metrics
6. **Tracks** the template as the "first successful execution"

This creates a **self-improving system**: Every goal completion produces a reusable activity template for future similar goals.

---

## Current State Analysis

### What Minibob Has ✅

1. **GoalProcessor** (`src/goal-processor.ts`)
   - Parses user goals
   - Gets activity recommendations from backend (Thompson Sampling)
   - Executes activities until goal complete
   - Tracks executions and metrics

2. **ActivityExecutor** (`src/activity.ts`)
   - Executes activity templates
   - Runs tasks sequentially with dependencies
   - Calls tools (bash, read, write, edit, etc.)
   - Creates impulses for context sharing
   - Tracks task results, tokens, cost, duration

3. **Tool System** (`src/tools.ts`)
   - `search_activities`: Find existing templates
   - `create_activity_goal_seeking`: Create new template (requires `onCreateActivity` callback)
   - `impulse_create`: Create impulses
   - `bash`, `read`, `write`, `edit`: File operations

4. **Impulse Store** (`src/impulse.ts`)
   - Create and store impulses
   - Load impulses by ID
   - Format impulses for LLM context
   - Store activity outputs as impulses

### What's Missing ❌

1. **Goal → Activity Recording**
   - No automatic capture of tasks during goal execution
   - No assembly of executed tasks into template format
   - No validation against learned patterns

2. **Template Generation from Execution**
   - `create_activity_goal_seeking` requires manual template definition
   - No automatic extraction of:
     - Task prompts (what the LLM actually did)
     - Tool calls (what commands were run)
     - Validations (what files/patterns were created)
     - Variables (what inputs were provided)

3. **First Execution Registration**
   - Templates registered without execution history
   - No "this template has succeeded once" guarantee
   - No learning from first execution metrics

4. **Pattern Learning**
   - No comparison against similar activities
   - No validation of template structure
   - No style/format consistency checks

---

## Target Architecture

### Phase 1: Goal Execution with Recording

```
User sends goal: "Create dependency graph for refactoring"
    ↓
GoalProcessor receives goal
    ↓
[NEW] Start recording mode
    ↓
Execute tasks to accomplish goal (using existing ActivityExecutor)
    ↓
[NEW] Capture execution trace:
    - Task prompts sent to LLM
    - Tool calls made
    - Files created
    - Validations passed
    - Variables used
    - Tokens/cost/duration
    ↓
Goal complete: SUCCESS ✅
    ↓
[NEW] Execution trace → Activity Template
    ↓
[NEW] Validate template structure
    ↓
[NEW] Register template with first execution metrics
    ↓
Template available for reuse
```

### Phase 2: Pattern-Based Validation

```
Template assembled from execution
    ↓
[NEW] Search similar activities (by category, goal keywords)
    ↓
[NEW] Extract patterns:
    - Common task structures
    - Validation conventions
    - Variable naming patterns
    - Prompt formatting styles
    ↓
[NEW] Validate new template matches patterns:
    - Task order makes sense
    - Validations are comprehensive
    - Variables are well-named
    - Prompts are clear
    ↓
If validation fails: Flag for review
If validation passes: Register with confidence
```

### Phase 3: Continuous Improvement

```
Template registered with first execution
    ↓
Template used for similar goals
    ↓
Track success/failure across executions
    ↓
[NEW] Learn from failures:
    - Extract error patterns
    - Suggest template improvements
    - Create retry strategies
    ↓
[NEW] Update template based on learnings
    ↓
[NEW] Version template (v1 → v2)
```

---

## Implementation Plan

### Step 1: Add Execution Trace Recording

**File**: `repos/minibob/src/activity.ts`

**Add to ActivityExecution type**:
```typescript
export interface ActivityExecution {
  // ... existing fields
  executionTrace?: ExecutionTrace  // NEW
}

export interface ExecutionTrace {
  /** Tasks executed with full context */
  tasks: ExecutedTask[]
  /** Impulses created during execution */
  impulsesCreated: string[]
  /** Files modified */
  filesModified: string[]
  /** Goal that triggered this execution (if any) */
  goalContext?: {
    goal: string
    intent: string
    context: Record<string, unknown>
  }
}

export interface ExecutedTask {
  /** Task ID from template */
  id: string
  /** Actual prompt sent to LLM (after variable substitution) */
  actualPrompt: string
  /** Tools called during task */
  toolCalls: ToolCall[]
  /** LLM response */
  response: string
  /** Validation results */
  validationResults: {
    requiredFiles: { path: string; exists: boolean }[]
    requiredPatterns: { pattern: string; found: boolean }[]
    forbiddenPatterns: { pattern: string; found: boolean }[]
  }
  /** Task result (success/failure) */
  result: TaskResult
}

export interface ToolCall {
  tool: string
  params: Record<string, unknown>
  result: {
    success: boolean
    output?: string
    error?: string
  }
}
```

**Enable recording in ActivityExecutor**:
```typescript
export interface ExecutorConfig {
  // ... existing fields
  recordExecutionTrace?: boolean  // NEW: Enable trace recording
}

export class ActivityExecutor {
  private executionTrace: ExecutionTrace | null = null

  async execute(options: ExecuteOptions): Promise<ActivityExecution> {
    if (this.config.recordExecutionTrace) {
      this.executionTrace = {
        tasks: [],
        impulsesCreated: [],
        filesModified: [],
        goalContext: options.goalContext,  // Pass from GoalProcessor
      }
    }

    // ... existing execution logic

    // Before each task execution:
    if (this.executionTrace) {
      const executedTask = await this.executeTaskWithTrace(task, variables)
      this.executionTrace.tasks.push(executedTask)
    }

    // ... rest of execution

    return {
      // ... existing fields
      executionTrace: this.executionTrace,
    }
  }

  private async executeTaskWithTrace(
    task: ActivityTask,
    variables: Record<string, unknown>
  ): Promise<ExecutedTask> {
    const actualPrompt = this.substituteVariables(task.prompt.template, variables)
    const toolCalls: ToolCall[] = []

    // Wrap tool handlers to capture calls
    const tracingToolHandlers = this.wrapToolHandlersForTracing(toolCalls)

    // Execute task with tracing handlers
    const result = await this.executeTask(task, variables, tracingToolHandlers)

    // Validate and capture results
    const validationResults = await this.validateTask(task, this.config.workingDirectory)

    return {
      id: task.id,
      actualPrompt,
      toolCalls,
      response: result.output,
      validationResults,
      result,
    }
  }
}
```

### Step 2: Template Assembly from Execution Trace

**File**: `repos/minibob/src/template-generator.ts` (NEW)

```typescript
/**
 * Generate activity template from execution trace
 */
export function assembleTemplateFromExecution(
  execution: ActivityExecution,
  templateName: string,
  category: string
): ActivityTemplate {
  if (!execution.executionTrace) {
    throw new Error("Execution trace not available")
  }

  const trace = execution.executionTrace

  // Extract tasks from trace
  const tasks: ActivityTask[] = trace.tasks.map((executedTask, index) => ({
    id: `task-${index + 1}`,
    subagent: "general",
    description: inferTaskDescription(executedTask),
    dependencies: index > 0 ? [`task-${index}`] : [],
    prompt: {
      template: executedTask.actualPrompt,
      maxTokens: executedTask.result.tokens?.input || 16000,
      compressionStrategy: "filter",
    },
    validation: {
      requiredFiles: executedTask.validationResults.requiredFiles
        .filter(f => f.exists)
        .map(f => f.path),
      requiredPatterns: executedTask.validationResults.requiredPatterns
        .filter(p => p.found)
        .map(p => p.pattern),
      forbiddenPatterns: executedTask.validationResults.forbiddenPatterns
        .filter(p => !p.found)
        .map(p => p.pattern),
    },
    retry: {
      maxAttempts: 2,
      strategy: "simple",
    },
  }))

  // Extract variables from tool calls and goal context
  const variables = extractVariablesFromTrace(trace)

  return {
    name: templateName,
    description: trace.goalContext?.goal || "Activity generated from successful execution",
    category,
    tasks,
    variables,
    metadata: {
      generatedFrom: "execution",
      sourceExecutionId: execution.id,
      firstExecutionMetrics: {
        duration: execution.duration,
        cost: execution.cost,
        tokens: execution.tokens,
        status: execution.status,
      },
    },
  }
}

function inferTaskDescription(executedTask: ExecutedTask): string {
  // Extract intent from prompt
  const prompt = executedTask.actualPrompt
  const lines = prompt.split("\n")
  
  // Look for "Your task:" or similar markers
  const taskLine = lines.find(l => l.match(/your task|objective|goal/i))
  if (taskLine) {
    return taskLine.replace(/.*:\s*/i, "").trim()
  }

  // Fallback: summarize tool calls
  const tools = executedTask.toolCalls.map(tc => tc.tool).join(", ")
  return `Execute task using: ${tools}`
}

function extractVariablesFromTrace(trace: ExecutionTrace): ActivityVariable[] {
  const variables: Record<string, unknown> = {}

  // Extract from goal context
  if (trace.goalContext?.context) {
    Object.assign(variables, trace.goalContext.context)
  }

  // Extract from tool calls (e.g., file paths, descriptions)
  for (const task of trace.tasks) {
    for (const toolCall of task.toolCalls) {
      if (toolCall.tool === "write" && toolCall.params.path) {
        variables.outputFile = toolCall.params.path
      }
      // ... extract other patterns
    }
  }

  // Convert to ActivityVariable format
  return Object.entries(variables).map(([name, value]) => ({
    name,
    type: typeof value,
    required: true,
    description: `Extracted from execution: ${name}`,
    default: value,
  }))
}
```

### Step 3: Pattern-Based Validation

**File**: `repos/minibob/src/template-validator.ts` (NEW)

```typescript
/**
 * Validate template against learned patterns
 */
export async function validateTemplateStructure(
  template: ActivityTemplate,
  searchActivities: (category: string) => Promise<ActivityTemplate[]>
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Find similar activities for pattern learning
  const similarActivities = await searchActivities(template.category)

  // Validate task structure
  for (const task of template.tasks) {
    // Check task dependencies are valid
    for (const dep of task.dependencies || []) {
      if (!template.tasks.find(t => t.id === dep)) {
        errors.push(`Task ${task.id} depends on non-existent task: ${dep}`)
      }
    }

    // Check prompt quality
    if (task.prompt.template.length < 100) {
      warnings.push(`Task ${task.id} has very short prompt (< 100 chars)`)
    }

    // Check validations exist
    if (!task.validation?.requiredFiles?.length && 
        !task.validation?.requiredPatterns?.length) {
      warnings.push(`Task ${task.id} has no validations`)
    }
  }

  // Learn patterns from similar activities
  const patterns = extractPatternsFromTemplates(similarActivities)

  // Check if new template follows patterns
  if (patterns.commonTaskOrder && !matchesTaskOrder(template, patterns.commonTaskOrder)) {
    warnings.push("Task order differs from common pattern")
  }

  if (patterns.commonValidations && !usesCommonValidations(template, patterns.commonValidations)) {
    warnings.push("Validations differ from common pattern")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    patternsMatched: patterns,
  }
}

interface LearnedPatterns {
  commonTaskOrder: string[]
  commonValidations: {
    requiredFiles: string[]
    requiredPatterns: string[]
  }
  commonVariableNames: string[]
}

function extractPatternsFromTemplates(templates: ActivityTemplate[]): LearnedPatterns {
  // Analyze templates to extract common patterns
  const taskOrders = templates.map(t => t.tasks.map(task => task.id))
  const validations = templates.flatMap(t => t.tasks.map(task => task.validation))
  
  return {
    commonTaskOrder: findMostCommonOrder(taskOrders),
    commonValidations: aggregateValidations(validations),
    commonVariableNames: extractCommonVariableNames(templates),
  }
}
```

### Step 4: Goal-to-Activity Integration

**File**: `repos/minibob/src/goal-processor.ts` (MODIFY)

```typescript
export class GoalProcessor {
  async processGoal(
    goalMessage: string,
    context: Record<string, unknown>,
    options: {
      maxActivities?: number
      maxCost?: number
      recordAsTemplate?: boolean  // NEW: Enable template generation
      templateName?: string  // NEW: Name for generated template
    }
  ): Promise<GoalResult> {
    const goal = this.parseGoal(goalMessage, context)

    // Enable execution tracing if recording as template
    if (options.recordAsTemplate) {
      this.executor.config.recordExecutionTrace = true
    }

    const executions: ActivityExecution[] = []
    let completed = false

    // Execute activities until goal complete
    while (!completed && executions.length < (options.maxActivities || 5)) {
      // Get recommendation from backend
      const recommendation = await this.getRecommendation(goal, executions)

      // Load and execute template
      const template = await loadTemplateFromMCPOrLocal(recommendation.templateId)
      const execution = await this.executor.execute({
        template,
        variables: recommendation.variables,
        reason: goal.intent,
        goalContext: { goal: goal.message, intent: goal.intent, context },  // NEW
      })

      executions.push(execution)

      // Check if goal is complete
      completed = await this.checkGoalCompletion(goal, executions)
    }

    // NEW: Generate template from execution if requested
    if (options.recordAsTemplate && completed && executions.length > 0) {
      const lastExecution = executions[executions.length - 1]
      if (lastExecution.executionTrace) {
        const newTemplate = assembleTemplateFromExecution(
          lastExecution,
          options.templateName || `Generated: ${goal.intent}`,
          goal.type
        )

        // Validate template
        const validation = await validateTemplateStructure(
          newTemplate,
          (category) => this.searchActivities(category)
        )

        if (validation.valid) {
          // Register template
          await this.registerTemplate(newTemplate)
          console.log(`✅ Template "${newTemplate.name}" registered successfully`)
        } else {
          console.warn(`⚠️ Template validation warnings:`, validation.warnings)
          // Still register, but flag for review
          newTemplate.metadata.validationWarnings = validation.warnings
          await this.registerTemplate(newTemplate)
        }
      }
    }

    return {
      goal,
      executions,
      completed,
      completionReason: completed ? "Goal achieved" : "Max activities reached",
      totalDuration: executions.reduce((sum, e) => sum + e.duration, 0),
      totalCost: executions.reduce((sum, e) => sum + e.cost, 0),
      totalTokens: {
        input: executions.reduce((sum, e) => sum + e.tokens.input, 0),
        output: executions.reduce((sum, e) => sum + e.tokens.output, 0),
      },
    }
  }

  private async registerTemplate(template: ActivityTemplate): Promise<void> {
    // Save to local templates directory
    const templatePath = `${this.workingDirectory}/templates/${template.name.toLowerCase().replace(/\s+/g, "-")}.json`
    await Bun.write(templatePath, JSON.stringify(template, null, 2))

    // Register with MCP backend (if available)
    if (isMCPEnabled()) {
      const client = getMCPClient()
      await client.registerTemplate(template)
    }
  }
}
```

---

## Usage Example

### Before (Manual Template Creation)

```bash
# 1. Write template JSON manually
cat > templates/my-activity.json <<EOF
{
  "name": "My Activity",
  "tasks": [...]
}
EOF

# 2. Test execution
bun run index.ts run templates/my-activity.json

# 3. If fails, manually edit template and retry
# 4. Eventually register after many iterations
```

**Problems**:
- Manual template writing is error-prone
- No guarantee template works before registration
- No learning from execution

### After (Goal-Driven Template Generation)

```bash
# 1. Send goal with recording enabled
bun run index.ts goal \
  --message "Create dependency graph for refactoring" \
  --record-as-template "Dependency Graph Generator" \
  --context files="repos/metabob-opencode"

# Minibob executes tasks to accomplish goal
# Captures execution trace
# Assembles template from trace
# Validates against patterns
# Registers template with first execution metrics

# Output:
# ✅ Goal complete in 139s
# ✅ Template "Dependency Graph Generator" registered
# ✅ First execution: 100% success, $0.55 cost
# Template available at: templates/dependency-graph-generator.json
```

**Benefits**:
- Template generated from successful execution
- Guaranteed to work (first execution succeeded)
- Learned from actual tool usage
- Validated against existing patterns

---

## Next Goal to Send to Minibob

### Goal Message

```
Implement the goal-to-activity learning loop in minibob:

1. Add execution trace recording to ActivityExecutor:
   - Capture task prompts (after variable substitution)
   - Capture tool calls with parameters and results
   - Capture validation results
   - Capture goal context (if executing from goal)

2. Create template-generator.ts:
   - Function to assemble activity template from execution trace
   - Extract tasks with actual prompts used
   - Extract validations from successful checks
   - Extract variables from tool calls and context
   - Add metadata: generatedFrom, firstExecutionMetrics

3. Create template-validator.ts:
   - Function to validate template structure
   - Learn patterns from similar activities
   - Check task dependencies are valid
   - Check prompt quality (length, clarity)
   - Check validations exist
   - Compare against learned patterns

4. Modify GoalProcessor to enable recording:
   - Add recordAsTemplate option to processGoal
   - Enable execution tracing when recording
   - After successful goal completion, generate template
   - Validate template against patterns
   - Register template locally and with MCP backend

Context:
- Working directory: /home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob
- Files to modify: src/activity.ts, src/goal-processor.ts
- Files to create: src/template-generator.ts, src/template-validator.ts
- Goal: Enable self-improvement loop where every successful goal creates a reusable activity

Expected output:
- Modified source files with new functionality
- New modules for template generation and validation
- Updated types.ts with new interfaces
- Test execution showing template generation from goal
```

### Context Variables

```json
{
  "workingDirectory": "/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob",
  "filesToModify": [
    "src/activity.ts",
    "src/goal-processor.ts",
    "src/types.ts"
  ],
  "filesToCreate": [
    "src/template-generator.ts",
    "src/template-validator.ts"
  ]
}
```

---

## Success Criteria

After implementing this, we should be able to:

1. **Run a goal with recording**:
   ```bash
   bun run index.ts goal --record "Map dependencies for refactoring"
   ```

2. **See execution trace captured**:
   ```
   [Goal] Executing task 1/1
   [Trace] Capturing tool call: bash
   [Trace] Capturing tool call: write
   [Trace] Validating: DEPENDENCY_GRAPH.json exists ✓
   ```

3. **See template generated**:
   ```
   [Template] Assembling from execution trace
   [Template] Extracted 1 task, 2 tool calls, 1 validation
   [Validator] Checking against 5 similar activities
   [Validator] Pattern match: 80% (2 warnings)
   ```

4. **See template registered**:
   ```
   ✅ Template "Map Dependencies for Refactoring" registered
   Location: templates/map-dependencies-for-refactoring.json
   First execution: SUCCESS, 139s, $0.55
   Ready for reuse
   ```

5. **Use generated template**:
   ```bash
   bun run index.ts run templates/map-dependencies-for-refactoring.json \
     --var targetRepo="repos/another-project"
   ```

---

## Benefits

1. **Zero-Shot Template Creation**: Goals create templates automatically
2. **Guaranteed Working Templates**: First execution must succeed before registration
3. **Pattern Learning**: New templates validated against existing successful patterns
4. **Continuous Improvement**: Each execution refines understanding of what works
5. **Self-Development**: Minibob improves itself by creating reusable workflows

---

## Conclusion

This design enables **true self-development**: Minibob learns from every goal execution and creates reusable activities. The learning loop ensures quality (validation) and practicality (first execution succeeded).

**Ready to implement**: Next goal message above can be sent to minibob to bootstrap this capability.
