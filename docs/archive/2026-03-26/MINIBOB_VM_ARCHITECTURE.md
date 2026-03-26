# MiniBob VM Architecture

## Core Question: What IS MiniBob?

MiniBob is a **virtual machine that executes activities** (structured LLM+tool programs). Activities are to MiniBob what bytecode is to the JVM or instructions are to a CPU.

## Current Implementation Analysis

### The VM Core (What Actually Executes)

```typescript
class ActivityExecutor {
  // VM State
  private llm: LLMClient                    // Execution engine
  private toolHandlers: ToolHandlers        // System calls
  private config: ExecutorConfig            // VM configuration

  // Execution Entry Point
  async execute(options: ExecuteOptions): Promise<ActivityExecution> {
    // 1. Load "program" (activity template)
    // 2. Create impulses (context/memory)
    // 3. Execute tasks (instructions) in order
    // 4. Return execution result
  }
}
```

### Control Flow: How Activities Execute

```
execute(template, variables)
    ↓
1. Create Impulses (context injection)
    │ - Load referenced data
    │ - Format for LLM consumption
    │
2. Sort Tasks (dependency resolution)
    │ - Topological sort by dependencies
    │ - Ensures correct execution order
    │
3. Execute Tasks Sequentially
    │
    ├─ For each task:
    │   │
    │   ├─ Phase 1: Input State Capture
    │   │   - Snapshot files available
    │   │   - Record environment
    │   │   - Capture impulse IDs
    │   │   - Hash file states
    │   │
    │   ├─ Phase 2: Prompt Construction
    │   │   - Substitute {{impulse:id}} placeholders
    │   │   - Interpolate {{variable}} values
    │   │   - Add impulse context
    │   │   - Add retry error context (if retrying)
    │   │
    │   ├─ Phase 3: LLM Execution with Tools
    │   │   - Build messages [system, user]
    │   │   - Call llm.completeWithTools()
    │   │   - LLM decides which tools to call
    │   │   - Execute tools through handlers
    │   │   - Return final response
    │   │
    │   ├─ Phase 4: Output State Capture
    │   │   - Detect files created/modified/deleted
    │   │   - Extract exit codes and errors
    │   │   - Hash final file states
    │   │   - Build state transition record
    │   │
    │   ├─ Phase 5: Create Output Impulses
    │   │   - Store task output as impulse
    │   │   - Make available to next tasks
    │   │
    │   └─ Phase 6: Retry on Failure (if configured)
    │       - Check task.retry.maxAttempts
    │       - Re-execute with error context
    │       - Abort if still fails
    │
4. Complete Execution
    │ - Calculate metrics (duration, cost, tokens)
    │ - Report to backend (if MCP enabled)
    │ - Store execution trace
    │ - Return ActivityExecution result
```

### Task Execution: The Core Loop

```typescript
async executeTask(task, variables, impulses) {
  // 1. BUILD PROMPT
  prompt = task.prompt.template
  prompt = substituteImpulses(prompt, impulses)   // {{impulse:id}} → content
  prompt = interpolate(prompt, variables)         // {{varName}} → value
  prompt = addImpulseContext(prompt, impulses)   // Prepend impulse data

  // 2. CALL LLM WITH TOOLS
  messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ]

  result = await llm.completeWithTools(messages, tools)
  // LLM generates response, calling tools as needed
  // Tools execute and return results
  // LLM continues until task complete

  // 3. RETURN RESULT
  return {
    taskId: task.id,
    status: "completed" | "failed",
    output: result.content,
    tokens: result.usage,
    toolCalls: [...],
    error: ...
  }
}
```

### Activity Composition: How Activities Call Activities

Activities can compose via the `activity` tool:

```json
{
  "tasks": [
    {
      "id": "delegate-subtask",
      "prompt": {
        "template": "Use the activity tool to run 'analyze-code' activity"
      }
    }
  ]
}
```

**When LLM calls the `activity` tool**:

```typescript
// In tool handler: onActivityExecute
async (templateId, variables, reason) => {
  // 1. Load child template
  const template = await loadTemplateFromMCPOrLocal(templateId)

  // 2. Create ISOLATED executor (prevent context accumulation)
  const isolatedConfig = {
    workingDirectory: config.workingDirectory,
    model: config.model,
    // NO parent context, NO accumulated state
    maxNestingDepth: parent.maxNestingDepth - 1
  }

  // 3. Check nesting depth (prevent infinite recursion)
  if (maxNestingDepth <= 0) {
    return { error: "Max nesting depth reached" }
  }

  // 4. Execute child activity
  const nestedExecutor = new ActivityExecutor(isolatedConfig)
  const result = await nestedExecutor.execute({
    template,
    variables,
    parentActivityId: this.currentActivityId
  })

  // 5. Record composition (for learning)
  await mcp.recordComposition({
    parentActivityId,
    childActivityId,
    success: result.status === "completed"
  })

  // 6. Return SUMMARY only (prevent full trace accumulation)
  return {
    id: result.id,
    status: result.status,
    summary: "Activity completed" // NOT full result
  }
}
```

**Key Design Decisions**:
- ✅ **Context Isolation**: Child activities don't inherit parent context
- ✅ **Depth Limiting**: Max 3 levels of nesting (configurable)
- ✅ **Summary Only**: Only summary returned, not full trace
- ✅ **Composition Tracking**: Backend learns which activities work together

### The Three Ontological States in Execution

```
VESSEL (Activity Template)
    ↓
    template.json loaded into memory
    ↓
BECOMING (Task Execution)
    ↓
    For each task:
    - Input state captured
    - Prompt built with impulses + variables
    - LLM + tools execute
    - State transitions recorded
    - Output state captured
    ↓
INSTANCE (Execution Result)
    ↓
    ActivityExecution {
      id, templateId, status,
      taskResults: [...],
      metrics: { duration, cost, tokens },
      executionTrace: { inputState, outputState, toolCalls }
    }
    ↓
    Stored in backend
    ↓
LEARNING LOOP
    ↓
    Thompson Sampling learns which templates work best
    Ribosome extracts new templates from successful executions
    ↓
NEW VESSEL (Improved Template)
```

## What Should Be in the VM?

### Minimal VM Core (~4,800 LOC)

**1. Activity Executor** (`src/activity.ts`)
- Load activity templates
- Execute tasks with dependency resolution
- Capture input/output state
- Handle retries and errors
- Report to backend
- **Complexity**: ~1,500 LOC

**2. Tool System** (`src/tools.ts`)
- Define tool interface (ToolDefinition, ToolHandler)
- Built-in tools: bash, read, write, edit, git, glob, grep
- Tool registration and execution
- **Complexity**: ~900 LOC

**3. LLM Client** (`src/llm.ts`)
- LLMClient interface
- Anthropic client implementation
- OpenAI client implementation
- Tool calling integration
- **Complexity**: ~600 LOC

**4. Impulse System** (`src/impulse.ts`)
- Impulse store (in-memory registry)
- Load/unload impulses
- Format for context injection
- Local resolution (memo, file)
- **Complexity**: ~400 LOC

**5. MCP Client** (`src/mcp.ts`)
- Connect to backend
- Register templates
- Report executions
- Store traces
- Resolve remote impulses
- **Complexity**: ~800 LOC

**6. Type Definitions** (`src/types.ts`)
- ActivityTemplate, ActivityTask
- Impulse, ImpulsePointer
- Message, CompletionOptions
- ToolDefinition, ToolHandler
- **Complexity**: ~300 LOC

**7. Config System** (`src/config.ts`)
- Load configuration
- Generate manifest
- Environment variables
- **Complexity**: ~300 LOC

**Total Core**: ~4,800 LOC

### What Should Be Activities (NOT in VM)

All of these should be activity templates that run ON the VM:

**1. Understanding System** (1,022 LOC → activity templates)
- `templates/explore-codebase.json`
- `templates/diagnose-problem.json`
- `templates/analyze-architecture.json`

**2. Goal Processing** (457 LOC → activity template)
- `templates/process-goal.json`
  - Query backend for similar goals
  - Recommend activities
  - Execute chosen activity

**3. Search-First Executor** (662 LOC → activity template)
- `templates/search-and-execute.json`
  - Decompose goal into steps
  - Search for existing activities
  - Delegate or execute inline
  - Summarize results

**4. Improvisation** (670 LOC → activity template)
- `templates/improvise-goal.json`
  - Iterative LLM decision-making
  - Record all steps
  - Extract template on success

**5. Template Generation** (123 LOC → activity template)
- `templates/extract-template.json`
  - Analyze execution trace
  - Identify task boundaries
  - Extract prompt patterns
  - Create ActivityTemplate

### Why These Should Be Activities

1. **Discoverable**: Users can find and understand them
2. **Modifiable**: Users can edit the approach
3. **Versionable**: Multiple variants can compete
4. **Composable**: Activities can call other activities
5. **Learnable**: Thompson Sampling optimizes automatically
6. **Minimal VM**: VM stays focused on core execution

## Improvisation as an Activity

Instead of `src/improviser.ts` (670 LOC), we have:

```json
{
  "id": "improvise-goal",
  "name": "Improvise Solution to Goal",
  "category": "tool",
  "tasks": [
    {
      "id": "loop-until-done",
      "description": "Iteratively work toward goal using LLM + tools",
      "prompt": {
        "template": "Goal: {{goal}}\n\nWork step-by-step to achieve this goal.\n\nFor each step:\n1. Think about what to do next\n2. Use ONE tool (bash, read, write, edit, git)\n3. Observe the result\n4. Decide if goal is achieved\n\nOutput format:\n```json\n{\n  \"thought\": \"what I'm thinking\",\n  \"tool\": \"tool_name\",\n  \"params\": {...},\n  \"goal_achieved\": true/false\n}\n```\n\nContinue until goal_achieved = true or you're stuck.",
        "variables": [
          {"name": "goal", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "extract-template",
      "description": "Extract reusable template from successful improvisation",
      "prompt": {
        "template": "Review the execution trace from the previous task.\n\nCreate an ActivityTemplate JSON that captures the approach:\n- Identify logical task boundaries\n- Extract prompt patterns\n- Parameterize variables\n- Add validation criteria\n\nOutput the complete template as JSON."
      }
    }
  ]
}
```

**How This Works**:

1. **No custom code in VM** - Just uses standard activity execution
2. **LLM does the loop** - Prompt instructs LLM to continue until done
3. **Tools available** - LLM can call any tool
4. **Trace captured** - VM records everything automatically
5. **Template extraction** - Second task analyzes first task's trace

**Benefits**:
- VM doesn't need to know about improvisation
- Users can modify the improvisation approach
- Multiple improvisation strategies can compete
- Thompson Sampling learns which works best

## The VM Instruction Set

Activities are "programs" and tasks are "instructions". What's the instruction set?

### 1. Task Execution
```json
{
  "id": "task-1",
  "description": "What to accomplish",
  "prompt": {
    "template": "Instructions for LLM",
    "variables": [...]
  }
}
```
**Semantics**: Execute prompt with LLM+tools, return result

### 2. Variable Interpolation
```json
{
  "prompt": {
    "template": "Analyze {{filePath}} for {{pattern}}"
  }
}
```
**Semantics**: Replace {{name}} with variable value

### 3. Impulse Injection
```json
{
  "prompt": {
    "template": "Review this code:\n{{impulse:errorFile}}"
  }
}
```
**Semantics**: Load impulse content and substitute

### 4. Tool Calling
```
LLM decides: "I need to read the file"
→ Calls read tool
→ Gets file content
→ Continues reasoning
```
**Semantics**: LLM can call any registered tool

### 5. Dependency Ordering
```json
{
  "tasks": [
    {"id": "analyze", "dependencies": []},
    {"id": "fix", "dependencies": ["analyze"]},
    {"id": "test", "dependencies": ["fix"]}
  ]
}
```
**Semantics**: Tasks execute in topological order

### 6. Activity Composition
```
LLM decides: "I need to delegate to another activity"
→ Calls activity tool with templateId
→ Child activity executes
→ Returns summary
```
**Semantics**: Nested execution with isolated context

### 7. Retry Policy
```json
{
  "retry": {
    "maxAttempts": 3,
    "strategy": "exponential-backoff"
  }
}
```
**Semantics**: Re-execute on failure with error context

### 8. Output Impulses
```json
{
  "outputImpulses": ["analysisResult", "recommendations"]
}
```
**Semantics**: Store task output as impulse for downstream tasks

## Questions to Answer

### 1. Should improvisation be in the VM or an activity?

**Option A: In VM** (current implementation)
- ✅ Available immediately
- ✅ Easier to implement initially
- ❌ Adds complexity to VM
- ❌ Not discoverable or modifiable
- ❌ Single implementation (no variants)

**Option B: As Activity** (proposed)
- ✅ Keeps VM minimal
- ✅ Discoverable and modifiable
- ✅ Multiple strategies can compete
- ✅ Users can create variants
- ❌ Requires careful prompt design
- ❌ LLM must handle the loop logic

**Recommendation**: **Option B** - Make it an activity, aligned with VM vision

### 2. What's the VM's responsibility?

**VM responsibilities**:
- Execute activity templates
- Manage tools and LLM calls
- Handle impulse injection
- Track state transitions
- Report to backend

**NOT VM responsibilities**:
- Decide HOW to achieve goals (that's the activity's job)
- Implement specific strategies (understanding, goal processing, etc.)
- Multi-step reasoning patterns (that's in the prompts)

### 3. How do we handle loops in activities?

**Current options**:

**Option 1: LLM-driven loop** (via prompt instruction)
```
"Continue calling tools until goal is achieved. Output goal_achieved: true when done."
```
- LLM decides when to stop
- VM just executes the single task
- Task might be long-running

**Option 2: Multi-task loop** (via activity composition)
```json
{
  "tasks": [
    {"id": "step-1"},
    {"id": "check"},
    {"id": "step-2", "dependencies": ["check"]},
    ...
  ]
}
```
- Each iteration is a task
- VM orchestrates the sequence
- Limited by pre-defined steps

**Option 3: Recursive activity** (activity calls itself)
```
Task → Checks if done → If not, calls same activity again → Repeat
```
- Depth limited by maxNestingDepth
- Each iteration tracked separately
- Natural loop structure

**Recommendation**: **Option 1** for improvisation (LLM-driven), **Option 2** for structured workflows

### 4. How does template extraction work?

**Current approach** (built into VM):
- Custom code analyzes ImprovisationTrace
- Extracts task boundaries
- Generates ActivityTemplate

**Activity-based approach**:
```json
{
  "id": "extract-template",
  "tasks": [
    {
      "id": "analyze-trace",
      "description": "Review execution trace and identify patterns",
      "prompt": {
        "template": "{{impulse:executionTrace}}\n\nAnalyze this execution and create an ActivityTemplate..."
      }
    }
  ]
}
```

- LLM analyzes the trace
- Generates template JSON
- VM just stores the result

**Benefits**:
- No custom code in VM
- Users can modify extraction logic
- Multiple extraction strategies possible

## Proposed Refactoring Plan

### Phase 1: Extract Understanding System

Move from VM code to activities:
- Delete `src/understanding/` (1,022 LOC)
- Create `templates/explore-codebase.json`
- Create `templates/diagnose-problem.json`
- Create `templates/analyze-architecture.json`

### Phase 2: Extract Goal Processing

Move from VM code to activities:
- Delete `src/goal-processor.ts` (457 LOC)
- Create `templates/process-goal.json`

### Phase 3: Extract Search-First Executor

Move from VM code to activities:
- Delete `src/search-first-executor.ts` (662 LOC)
- Create `templates/search-and-execute.json`

### Phase 4: Extract Improvisation

Move from VM code to activities:
- Delete `src/improviser.ts` (670 LOC)
- Delete `src/template-extractor.ts` (220 LOC)
- Create `templates/improvise-goal.json`
- Create `templates/extract-template.json`

### Phase 5: Extract Template Generator

Move from VM code to activities:
- Delete `src/template-generator.ts` (123 LOC)
- Functionality absorbed into `templates/extract-template.json`

### Result

**Before**: 9,145 LOC in VM
**After**: ~4,800 LOC in VM + activity templates

**VM becomes pure execution environment**:
- Loads programs (activity templates)
- Executes instructions (tasks with LLM+tools)
- Reports results (to backend)
- Nothing more

**Everything else is discoverable, modifiable, composable activities**.

## Next Steps

1. **Validate the approach**: Does this align with your VM vision?
2. **Design activity templates**: Create `improvise-goal.json` and `extract-template.json`
3. **Test viability**: Can LLM handle loop logic in prompts effectively?
4. **Refactor gradually**: Start with one system (improvisation or understanding)
5. **Measure impact**: Compare VM size, discoverability, flexibility

Would you like me to create the activity template versions of improvisation and template extraction to demonstrate how this would work?
