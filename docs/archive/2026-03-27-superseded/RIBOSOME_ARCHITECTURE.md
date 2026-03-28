# Ribosome Architecture: Self-Replicating Activity System

**Date**: 2026-03-20  
**Concept**: Activities that create activities, task by task  
**Analogy**: Ribosome (protein that creates proteins, amino acid by amino acid)

---

## Core Insight

**Activities are the universal unit of work.** Just as ribosomes create proteins (including other ribosomes) by assembling amino acids, we create activities by assembling tasks, guided by LLM instructions.

**Key Principle**: The LLM is a **text-to-text mapper** that generates:
1. **First execution**: Instructions (prompts) + Output (code, data, files)
2. **Subsequent executions**: Only output (instructions reused, LLM optional)

---

## The Ribosome Analogy

### Biology: Ribosome Creating Proteins

```
mRNA (instructions) → Ribosome → Amino Acids → Protein
                         ↓
                    (Ribosome itself is a protein)
```

**Key Properties**:
- Ribosome is both the **creator** and the **created**
- mRNA provides **instructions** for assembly
- Each amino acid is added **one at a time**
- Result is a functional protein (which might be another ribosome)

### Minibob: Activity Creating Activities

```
Goal (instructions) → ActivityExecutor → Tasks → Activity Template
                           ↓
                   (ActivityExecutor executes activities)
```

**Key Properties**:
- ActivityExecutor executes activities (including "create activity" activities)
- Goal provides **instructions** for assembly
- Each task is executed **one at a time**
- Result is a functional activity template (which might create more activities)

---

## Architecture Layers

### Layer 0: LLM (Text-to-Text Mapper)

```
Input Text → LLM → Output Text
```

**Role**: Conceptual mapper, arbitrary text transformation
- Generates instructions (prompts) from goals
- Generates output (code, data) from prompts
- **Should be minimized** for efficiency
- **Required** for creative/generative tasks (code generation, novel solutions)

### Layer 1: Task Execution

```
Task Prompt + Tools → LLM → Tool Calls → Output
```

**Role**: Execute a single unit of work
- Prompt tells LLM what to do
- LLM decides which tools to call
- Tools execute (bash, read, write, edit)
- Output produced and validated

**LLM Usage**: Required for first execution, optional for subsequent
- **First time**: LLM generates tool calls from prompt
- **Subsequent times**: Replay tool calls from trace (no LLM needed if deterministic)

### Layer 2: Activity Execution

```
Activity Template → Task 1 → Task 2 → ... → Task N → Output
```

**Role**: Orchestrate multiple tasks
- Load template (instructions for all tasks)
- Execute tasks sequentially with dependencies
- Aggregate outputs
- Validate final result

**LLM Usage**: Per-task, minimized via recorded traces

### Layer 3: Activity Generation (The Ribosome)

```
Goal → Activity Executor (meta-activity) → Task-by-Task Assembly → New Activity Template
```

**Role**: Create new activities from goals
- Parse goal into task sequence
- Execute each task while recording
- Capture: prompts, tool calls, validations, outputs
- Assemble trace into reusable template

**LLM Usage**: 
- First execution: Generate prompts and outputs
- Subsequent executions: Reuse prompts, optionally replay tool calls

### Layer 4: Self-Improvement Loop

```
Activity Template → Execute → Learn → Improve → New Template Version
```

**Role**: Evolve activities over time
- Track execution metrics (success rate, duration, cost)
- Identify failure patterns
- Generate improved versions
- Version templates (v1 → v2 → v3)

**LLM Usage**: Only for generating improvements (analyzing failures, suggesting fixes)

---

## The Ribosome Activity: `create-activity-from-goal`

This is the **self-replicating activity** - the ribosome that creates activities.

### Template Structure

```json
{
  "name": "Create Activity From Goal",
  "description": "Meta-activity that creates new activity templates from goal execution traces",
  "category": "meta",
  "tasks": [
    {
      "id": "task-1-parse-goal",
      "description": "Parse goal into intent, context, and constraints",
      "prompt": {
        "template": "Parse this goal: {{goal}}\n\nExtract:\n1. Intent (what to accomplish)\n2. Context (files, variables, constraints)\n3. Expected output type\n\nOutput JSON: {intent, context, outputType}"
      }
    },
    {
      "id": "task-2-generate-task-sequence",
      "description": "Generate sequence of tasks to accomplish goal",
      "prompt": {
        "template": "Create task sequence for: {{intent}}\n\nContext: {{context}}\n\nOutput: Array of task descriptions with dependencies"
      }
    },
    {
      "id": "task-3-execute-task-sequence",
      "description": "Execute each task while recording tool calls",
      "prompt": {
        "template": "Execute task: {{taskDescription}}\n\nRecord all tool calls and outputs.\n\nGoal: {{intent}}"
      },
      "validation": {
        "requiredPatterns": ["goal accomplished", "success"]
      }
    },
    {
      "id": "task-4-assemble-template",
      "description": "Assemble execution trace into activity template",
      "prompt": {
        "template": "Create activity template from execution trace:\n\nTasks: {{executedTasks}}\nTool calls: {{toolCalls}}\nValidations: {{validationResults}}\n\nOutput: ActivityTemplate JSON"
      }
    },
    {
      "id": "task-5-validate-and-register",
      "description": "Validate template structure and register for reuse",
      "prompt": {
        "template": "Validate template: {{template}}\n\nCheck:\n1. All tasks have valid dependencies\n2. Prompts are clear\n3. Validations are comprehensive\n4. Matches patterns from category: {{category}}\n\nIf valid, register to templates directory."
      },
      "validation": {
        "requiredFiles": ["templates/{{templateName}}.json"]
      }
    }
  ]
}
```

### Execution Flow

```
User: "Create dependency graph for refactoring"
    ↓
ActivityExecutor.execute(create-activity-from-goal, { goal: "..." })
    ↓
Task 1: Parse goal → {intent: "map dependencies", context: {...}}
    ↓
Task 2: Generate sequence → ["scan files", "extract imports", "build graph"]
    ↓
Task 3: Execute tasks (with recording)
    ├─ Scan files (bash: find, grep)
    ├─ Extract imports (bash: grep, parse)
    └─ Build graph (write: DEPENDENCY_GRAPH.json)
    ↓
Task 4: Assemble template
    └─ ExecutionTrace → ActivityTemplate
    ↓
Task 5: Validate & register
    └─ templates/dependency-graph-generator.json ✅
    ↓
Result: New activity created!
```

---

## LLM Minimization Strategy

### First Execution: LLM Required

```
Goal → LLM (generate prompts) → Tasks → LLM (generate outputs) → Activity Template
```

**LLM Calls**: 1 per task + 1 for goal parsing
**Cost**: High (e.g., $0.50 for complex goal)
**Benefit**: Creates reusable template

### Second Execution: LLM Optional

**Scenario A: Deterministic (no LLM needed)**
```
Goal → Load Template → Replay Tool Calls → Output
```

Example: Generating dependency graph with same file patterns
- Tool calls: `find`, `grep`, `write` (deterministic)
- No LLM needed, just replay recorded commands
- Cost: ~$0 (only tool execution)

**Scenario B: Parameterized (minimal LLM)**
```
Goal → Load Template → Substitute Variables → Replay Tool Calls → Output
```

Example: Dependency graph for different directory
- Variable substitution: `targetDir = "repos/another-project"`
- Tool calls mostly replayable
- LLM only needed for variable inference
- Cost: ~$0.05 (one inference call)

**Scenario C: Generative (LLM required)**
```
Goal → Load Template → Execute with LLM → New Output
```

Example: Generate novel code based on requirements
- Each execution produces different code
- LLM required for creativity
- Template provides structure (prompts, validations)
- Cost: ~$0.30 (reduced from $0.50 due to structured prompts)

---

## Trace Replay vs. LLM Execution

### Execution Trace Structure

```typescript
interface ExecutionTrace {
  tasks: ExecutedTask[]
  impulsesCreated: string[]
  filesModified: string[]
}

interface ExecutedTask {
  id: string
  actualPrompt: string  // After variable substitution
  toolCalls: ToolCall[]  // Recorded sequence
  response: string  // LLM response
  validationResults: {...}
}

interface ToolCall {
  tool: string  // e.g., "bash", "write"
  params: Record<string, unknown>
  result: { success: boolean, output?: string }
}
```

### Replay Decision Logic

```typescript
async function executeTask(task: ActivityTask, variables: Record<string, unknown>): Promise<TaskResult> {
  // Check if we have a recorded trace for this task
  const trace = await loadTraceForTask(task.id, variables)
  
  if (trace && isDeterministic(trace.toolCalls)) {
    // Replay tool calls without LLM
    console.log("⚡ Replaying recorded tool calls (no LLM)")
    return await replayToolCalls(trace.toolCalls, variables)
  } else if (trace && isMostlyDeterministic(trace.toolCalls)) {
    // Replay with minimal LLM (only for dynamic parts)
    console.log("⚡ Replaying with variable substitution")
    return await replayWithSubstitution(trace, variables)
  } else {
    // Full LLM execution required
    console.log("🤖 Executing with LLM")
    return await executeLLM(task, variables)
  }
}

function isDeterministic(toolCalls: ToolCall[]): boolean {
  // Tool calls are deterministic if:
  // 1. All parameters are static (no LLM-generated text)
  // 2. File operations use fixed paths
  // 3. Bash commands don't depend on LLM reasoning
  
  for (const call of toolCalls) {
    if (call.tool === "write" && call.params.content.includes("{{")) {
      return false  // Content has variable substitution
    }
    if (call.tool === "bash" && call.params.command.length > 200) {
      return false  // Complex command, likely LLM-generated
    }
  }
  return true
}
```

---

## Self-Replication Scenarios

### Scenario 1: Create Activity (Meta)

```
Goal: "Create an activity that generates TypeScript interfaces from JSON schemas"
    ↓
Execute: create-activity-from-goal
    ↓
Result: templates/generate-typescript-interfaces.json
```

**LLM Usage**: 
- First time: Generate prompts and code generation logic
- Subsequent times: Reuse prompts, LLM generates TypeScript (generative task)

### Scenario 2: Improve Activity (Evolution)

```
Goal: "Improve dependency-graph-generator to handle circular dependencies"
    ↓
Execute: improve-activity
    ├─ Load: templates/dependency-graph-generator.json
    ├─ Analyze: Execution failures (circular deps not detected)
    ├─ Generate: New validation logic
    └─ Create: templates/dependency-graph-generator-v2.json
    ↓
Result: Improved template with circular dependency detection
```

**LLM Usage**: 
- Analyze failures: LLM required (understanding error patterns)
- Generate fix: LLM required (creating new logic)
- Register: No LLM (template assembly is deterministic)

### Scenario 3: Debug Activity (Fix)

```
Goal: "Fix failing validation in refactor-session-files activity"
    ↓
Execute: debug-activity
    ├─ Load: execution trace from failed run
    ├─ Identify: Validation expects file that wasn't created
    ├─ Suggest: Fix validation or add file creation step
    └─ Test: Re-run with fix
    ↓
Result: Updated template with corrected validation
```

**LLM Usage**: 
- Identify issue: Minimal (pattern matching in traces)
- Suggest fix: LLM required (reasoning about intent)
- Apply fix: No LLM (edit template JSON)

---

## Implementation Roadmap

### Phase 1: Execution Trace Capture (COMPLETE ✅)

- [x] Add ExecutionTrace types
- [x] Add executionTrace field to ActivityExecution
- [x] Design template-generator module

### Phase 2: Template Generator (IN PROGRESS)

- [ ] Create src/template-generator.ts
- [ ] Implement assembleTemplateFromExecution()
- [ ] Implement inferTaskDescription()
- [ ] Implement extractVariables()

### Phase 3: Recording Logic

- [ ] Add recordExecutionTrace to ExecutorConfig
- [ ] Wrap tool handlers to capture calls
- [ ] Store execution trace in result
- [ ] Save traces to impulse store

### Phase 4: Trace Replay Engine

- [ ] Implement isDeterministic() heuristic
- [ ] Implement replayToolCalls() for deterministic tasks
- [ ] Implement replayWithSubstitution() for parameterized tasks
- [ ] Add replay vs. LLM decision logic to executor

### Phase 5: Meta-Activity (The Ribosome)

- [ ] Create create-activity-from-goal.json template
- [ ] Implement goal parsing task
- [ ] Implement task sequence generation
- [ ] Implement trace-to-template assembly
- [ ] Implement validation and registration

### Phase 6: Self-Improvement Loop

- [ ] Create improve-activity.json template
- [ ] Track execution failures by template
- [ ] Analyze failure patterns
- [ ] Generate template improvements
- [ ] Version templates (v1 → v2)

---

## Cost Reduction via Replay

### Example: Dependency Graph Activity

**First Execution** (with LLM):
```
Task 1: Scan files
  LLM call: "Find all .ts files in src/session"
  → Tool call: bash("find src/session -name '*.ts'")
  Cost: $0.10

Task 2: Extract imports
  LLM call: "Parse imports from each file"
  → Tool calls: bash("grep '^import' file1.ts"), bash("grep '^import' file2.ts"), ...
  Cost: $0.25

Task 3: Build graph
  LLM call: "Create JSON with dependencies"
  → Tool call: write("DEPENDENCY_GRAPH.json", {...})
  Cost: $0.15

Total: $0.50
```

**Second Execution** (replay):
```
Task 1: Scan files
  Replay: bash("find src/session -name '*.ts'")
  Cost: $0 (no LLM)

Task 2: Extract imports
  Replay: bash("grep '^import' file1.ts"), ...
  Cost: $0 (no LLM)

Task 3: Build graph
  Variable substitution: targetDir
  Replay: write("DEPENDENCY_GRAPH.json", {...})
  Cost: $0.02 (minimal LLM for variable mapping)

Total: $0.02 (96% cost reduction!)
```

---

## Universal Activity Loop

Every goal execution follows this pattern:

```
1. Receive Goal
    ↓
2. Load or Create Activity Template
    ├─ Search: Does similar activity exist?
    ├─ Load: Reuse existing template
    └─ Create: Generate new template via meta-activity
    ↓
3. Execute Activity
    ├─ Replay: Use recorded tool calls if deterministic
    ├─ Substitute: Apply variables if parameterized
    └─ Generate: Use LLM if creative/generative
    ↓
4. Record Execution
    ├─ Capture: Tool calls, prompts, outputs
    ├─ Validate: Check goal accomplished
    └─ Store: Save trace for replay/analysis
    ↓
5. Learn & Improve (optional)
    ├─ Register: New template if first execution
    ├─ Update: Improve template if execution failed
    └─ Version: Create v2 if significant changes
    ↓
6. Return Result
```

**This is the ribosome loop**: Every execution either uses an existing activity or creates a new one, which can then be reused infinitely.

---

## Key Insights

### 1. Activities All the Way Down

Everything is an activity:
- Creating code: activity
- Creating activity templates: meta-activity
- Improving templates: evolution activity
- Debugging failures: debug activity
- **Creating activities that create activities**: ribosome activity

### 2. LLM as Tool, Not Core

LLM is **one tool** among many (bash, read, write, edit):
- Use LLM for **generation** (code, prompts, novel solutions)
- **Minimize** LLM via replay for **deterministic** tasks
- **Eliminate** LLM entirely for **pure replay**

### 3. Execution Traces are Gold

Traces enable:
- **Replay**: Execute without LLM
- **Learning**: Understand what works
- **Improvement**: Fix what fails
- **Cost reduction**: 90%+ savings on repeated tasks

### 4. Self-Replication is Powerful

Once `create-activity-from-goal` exists:
- Every goal creates a reusable activity
- Every activity can create more activities
- System continuously improves itself
- **Exponential growth** in capabilities

---

## Next Step: Implement the Ribosome

**Goal**: Create the meta-activity that creates activities

**Activity to Execute**:
```bash
bun run index.ts run templates/create-activity-from-goal.json \
  --var goal="Generate TypeScript interfaces from JSON schemas" \
  --var templateName="generate-typescript-interfaces" \
  --var category="tool"
```

**Expected Result**:
- New template created: `templates/generate-typescript-interfaces.json`
- First execution trace stored
- Template ready for reuse
- Cost: ~$0.50 for creation, $0.05 for subsequent uses

**This is the moment**: The ribosome creates itself, then creates all other activities.

---

## Conclusion

The ribosome architecture transforms minibob from a **task executor** into a **self-replicating activity system**:

- ✅ Activities create activities (ribosome pattern)
- ✅ LLM minimized via trace replay (cost reduction)
- ✅ Every goal creates reusable template (continuous learning)
- ✅ Self-improvement through execution analysis (evolution)

**The system bootstraps itself**: Create the first meta-activity, then use it to create all others, reducing to minimal LLM usage over time.

**Status**: Architecture complete, ready to implement the ribosome.
