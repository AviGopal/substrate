# MiniBob as Activity VM

## The Insight

> MiniBob should be like a VM that runs activities (programs), not bytecode. Provide basics to support execution, but don't overly define functionality - discover and run it via activities.

## What This Means

### Current Problem: Feature Accumulation

MiniBob has become a **feature framework** (9,145 LOC) instead of a **runtime VM**:

```
❌ WRONG: MiniBob as Framework
┌─────────────────────────────────────┐
│ MiniBob (9,145 LOC)                 │
│ ├─ Activity Executor                │
│ ├─ Understanding System (1,022)     │ ← Should be activity
│ ├─ Goal Processor (457)             │ ← Should be activity
│ ├─ Search-First Executor (662)      │ ← Should be activity
│ ├─ Boredom System (423)             │ ← Should be activity
│ ├─ Template Generator (123)         │ ← Debatable
│ └─ ... more features ...            │
└─────────────────────────────────────┘

Activities are just JSON → Limited by MiniBob's built-in features
```

### The Goal: MiniBob as VM

```
✅ CORRECT: MiniBob as VM
┌─────────────────────────────────────┐
│ MiniBob Runtime (~3,000 LOC)        │
│ ├─ Activity Executor ←──────────────┼─ Run any activity
│ ├─ Tool System (bash, read, write)  │
│ ├─ LLM Client (execute prompts)     │
│ ├─ Impulse System (context mgmt)    │
│ ├─ MCP Client (backend comm)        │
│ └─ Lifecycle Hooks (extensibility)  │
└─────────────────────────────────────┘
         ↓ runs
┌─────────────────────────────────────┐
│ Activities (Unlimited)              │
│ ├─ understand-codebase.json         │ ← Was understanding system
│ ├─ process-goal.json                │ ← Was goal processor
│ ├─ search-and-compose.json          │ ← Was search-first executor
│ ├─ autonomous-boredom.json          │ ← Was boredom system
│ ├─ extract-template.json            │ ← Was template generator
│ └─ ... infinite possibilities ...   │
└─────────────────────────────────────┘
```

## VM Essentials vs Activities

### ✅ Keep in VM (Runtime Essentials)

These are **fundamental to execution**, not discoverable features:

| Component | LOC | Why Keep? |
|-----------|-----|-----------|
| **Activity Executor** | ~1,320 | Runs activities (like bytecode interpreter) |
| **Tool System** | ~924 | Basic I/O (like syscalls) |
| **LLM Client** | ~434 | Execute prompts (like CPU) |
| **Impulse System** | ~311 | Context management (like memory) |
| **MCP Client** | ~747 | Backend communication (like network stack) |
| **Types & Config** | ~489 | Type system and configuration |
| **Lifecycle Hooks** | ~181 | Extension points for activities |
| **ACP Protocol** | ~362 | Vessel-to-vessel communication |

**Total: ~4,768 LOC** ← Acceptable VM size

### ❌ Move to Activities (Feature Code)

These are **discoverable functionality**, should be activities:

| Component | LOC | Move To |
|-----------|-----|---------|
| **Understanding System** | 1,022 | `templates/understand-codebase.json` |
| **Search-First Executor** | 662 | `templates/search-and-compose.json` |
| **Goal Processor** | 457 | `templates/process-goal.json` |
| **Boredom System** | 423 | `templates/autonomous-boredom.json` |
| **Template Generator** | 123 | `templates/extract-template.json` (ribosome) |
| **Impulse Filter** | 273 | Logic in activity prompts |
| **Search Components** | 662 | Part of activities |

**Total to Extract: ~3,622 LOC** ← 40% reduction

### 🤔 Debatable (Need Decision)

| Component | LOC | Question |
|-----------|-----|----------|
| **Memory Agent** | 316 | VM concern or activity? |
| **Session** | 141 | VM state or activity state? |
| **Validation** | 125 | VM or activity validation? |

## What MiniBob VM Should Provide

### 1. Core Execution Loop

```typescript
// MiniBob VM: Run any activity
async function executeActivity(
  template: ActivityTemplate,
  variables: Record<string, unknown>
): Promise<ActivityExecution> {
  // 1. Instantiate (Vessel → Becoming)
  const execution = instantiate(template, variables)

  // 2. Execute tasks (Becoming)
  for (const task of template.tasks) {
    const result = await executeTask(task, execution)
    execution.taskResults.push(result)
  }

  // 3. Actualize (Becoming → Instance)
  execution.status = 'completed'

  return execution
}
```

### 2. Tool System (Syscalls)

```typescript
// VM provides basic tools
const vmTools = {
  bash: (command: string) => Promise<ToolResult>
  read: (path: string) => Promise<ToolResult>
  write: (path: string, content: string) => Promise<ToolResult>
  edit: (path: string, old: string, new: string) => Promise<ToolResult>
  git: (args: string[]) => Promise<ToolResult>
}

// Activities can use tools via LLM tool calling
```

### 3. Impulse System (Memory Management)

```typescript
// VM manages context loading
interface ImpulseSystem {
  load(impulses: Impulse[]): Promise<void>
  resolve(pointer: ImpulsePointer): Promise<string>
  unload(impulseId: string): void
}
```

### 4. Backend Communication (Network)

```typescript
// VM handles backend calls
interface MCPClient {
  recommendActivities(goal: string): Promise<ActivityTemplate[]>
  storeExecutionTrace(trace: ExecutionTrace): Promise<void>
  resolveImpulse(pointer: ImpulsePointer): Promise<string>
}
```

### 5. Lifecycle Hooks (Extension Points)

```typescript
// Activities can hook into lifecycle
interface LifecycleHooks {
  beforeActivity?: (execution: ActivityExecution) => Promise<void>
  afterTask?: (task: ExecutedTask) => Promise<void>
  afterActivity?: (execution: ActivityExecution) => Promise<void>
}

// Example: Ribosome hook
hooks.afterActivity = async (execution) => {
  if (execution.success) {
    // Activity can decide to extract template
    await extractTemplateActivity(execution)
  }
}
```

## Converting Features to Activities

### Example 1: Understanding System → Activity

**Before (1,022 LOC in VM):**
```typescript
// src/understanding/explorer.ts
export class CodeExplorer {
  async explore(path: string): Promise<CodeStructure> {
    // ... 488 lines of code ...
  }
}

// src/understanding/analyzer.ts
export class ApplicationAnalyzer {
  async analyze(structure: CodeStructure): Promise<Analysis> {
    // ... 354 lines of LLM calls ...
  }
}
```

**After (Activity Template):**
```json
{
  "id": "understand-codebase",
  "name": "Understand Codebase Architecture",
  "tasks": [
    {
      "id": "explore-structure",
      "description": "Analyze file structure and dependencies",
      "prompt": {
        "template": "Analyze the codebase at {{path}}:\n1. List all files\n2. Identify dependencies\n3. Find entry points\nProvide JSON output.",
        "variables": [{"name": "path", "source": "variable"}]
      }
    },
    {
      "id": "analyze-architecture",
      "description": "Determine architecture pattern",
      "prompt": {
        "template": "Based on the structure:\n{{structure}}\n\nDetermine:\n1. Architecture pattern\n2. Key components\n3. Data flow",
        "variables": [{"name": "structure", "source": "context"}]
      }
    }
  ]
}
```

**Benefits:**
- 1,022 LOC removed from VM
- Understanding logic discoverable and evolvable
- Can create variants (understand-security, understand-performance)
- No VM changes needed for improvements

### Example 2: Goal Processor → Activity

**Before (457 LOC in VM):**
```typescript
// src/goal-processor.ts
export class GoalProcessor {
  async processGoal(goal: string): Promise<ActivityRecommendation[]> {
    // ... 457 lines of code ...
  }
}
```

**After (Activity Template):**
```json
{
  "id": "process-goal",
  "name": "Convert Goal to Activities",
  "tasks": [
    {
      "id": "decompose-goal",
      "description": "Break goal into steps",
      "prompt": {
        "template": "Goal: {{goal}}\n\nDecompose into concrete steps. Output JSON.",
        "variables": [{"name": "goal", "source": "variable"}]
      }
    },
    {
      "id": "search-activities",
      "description": "Find matching activities",
      "prompt": {
        "template": "For each step:\n{{steps}}\n\nSearch backend for matching activities.",
        "variables": [{"name": "steps", "source": "context"}]
      }
    },
    {
      "id": "recommend",
      "description": "Recommend execution plan",
      "prompt": {
        "template": "Create execution plan from:\n- Goal: {{goal}}\n- Steps: {{steps}}\n- Available activities: {{activities}}",
        "variables": [{"name": "goal", "source": "variable"}]
      }
    }
  ]
}
```

### Example 3: Search-First Executor → Activity

**Before (662 LOC in VM):**
```typescript
// src/search-first-executor.ts
export class SearchFirstExecutor {
  async executeGoal(goal: string): Promise<ExecutionResult> {
    // ... 662 lines of decomposition + search + execute ...
  }
}
```

**After (Activity Template):**
```json
{
  "id": "search-and-compose",
  "name": "Search-First Goal Execution",
  "tasks": [
    {
      "id": "decompose",
      "description": "Break goal into searchable steps",
      "prompt": {
        "template": "Goal: {{goal}}\n\nCreate steps that can be searched.",
        "variables": [{"name": "goal", "source": "variable"}]
      }
    },
    {
      "id": "search-and-execute",
      "description": "For each step, search or execute",
      "prompt": {
        "template": "For step: {{step}}\n1. Search activities\n2. If found: delegate\n3. If not: execute directly\n4. Summarize result",
        "variables": [{"name": "step", "source": "iteration"}]
      }
    }
  ]
}
```

### Example 4: Ribosome → Activity (Triggered by Hook)

**Before (123 LOC in VM):**
```typescript
// src/template-generator.ts
export function assembleTemplateFromExecution(...): ActivityTemplate {
  // ... 123 lines of template extraction ...
}
```

**After (Activity + Lifecycle Hook):**
```json
{
  "id": "extract-template",
  "name": "Extract Template from Execution (Ribosome)",
  "tasks": [
    {
      "id": "analyze-execution",
      "description": "Analyze successful execution trace",
      "prompt": {
        "template": "Execution trace:\n{{trace}}\n\nExtract reusable pattern. Create activity template JSON.",
        "variables": [{"name": "trace", "source": "variable"}]
      }
    },
    {
      "id": "validate-template",
      "description": "Validate generated template",
      "prompt": {
        "template": "Template:\n{{template}}\n\nValidate structure. Fix issues.",
        "variables": [{"name": "template", "source": "context"}]
      }
    },
    {
      "id": "register-template",
      "description": "Register with backend",
      "prompt": {
        "template": "Register template with backend via MCP.",
        "variables": []
      }
    }
  ]
}
```

**Lifecycle Hook:**
```typescript
// In activity executor
hooks.afterActivity = async (execution) => {
  if (execution.success && execution.shouldExtractTemplate) {
    // Trigger ribosome activity
    await runActivity('extract-template', {
      trace: execution.executionTrace
    })
  }
}
```

## Benefits of VM Approach

### 1. Minimal Runtime

MiniBob stays focused (~4,800 LOC):
- ✅ Activity executor
- ✅ Tool system
- ✅ LLM client
- ✅ Impulse system
- ✅ Backend communication

### 2. Unlimited Functionality

Any capability can be added as an activity:
- Understanding codebases
- Processing goals
- Composing solutions
- Extracting patterns
- Autonomous operation
- **Anything discoverable via LLM**

### 3. Evolution Through Activities

Improve functionality without touching VM:
```bash
# Old way: Change VM code
vim src/understanding/analyzer.ts  # Edit 354 lines
bun run build                      # Rebuild
docker build                       # Rebuild image
kubectl rollout restart            # Redeploy

# New way: Update activity
vim templates/understand-codebase.json  # Edit JSON
# Activity immediately available, no rebuild/redeploy
```

### 4. Variant Creation is Natural

```
understand-codebase-v1.json        # Original
understand-codebase-security.json  # Security focus
understand-codebase-performance.json # Performance focus
understand-codebase-simple.json    # Quick analysis
```

### 5. Self-Modification Via Activities

Activities can modify activities:
```json
{
  "id": "improve-understanding-activity",
  "tasks": [
    {
      "id": "analyze-current",
      "description": "Read current understanding activity",
      "prompt": {"template": "Read templates/understand-codebase.json"}
    },
    {
      "id": "improve",
      "description": "Improve the activity",
      "prompt": {"template": "Improve activity based on recent failures"}
    },
    {
      "id": "write-new-variant",
      "description": "Write improved variant",
      "prompt": {"template": "Write to templates/understand-codebase-v2.json"}
    }
  ]
}
```

## Implementation Plan

### Phase 1: Extract to Activities (Week 1)

1. **Create activity templates:**
   - `understand-codebase.json` (replaces understanding system)
   - `process-goal.json` (replaces goal processor)
   - `search-and-compose.json` (replaces search-first executor)
   - `extract-template.json` (replaces template generator)
   - `autonomous-boredom.json` (replaces boredom system)

2. **Test activities work:**
   ```bash
   bun run index.ts templates/understand-codebase.json '{"path":"."}'
   bun run index.ts templates/process-goal.json '{"goal":"Fix bug"}'
   ```

3. **Verify equivalent functionality**

### Phase 2: Remove from VM (Week 2)

1. **Delete source files:**
   ```bash
   rm -rf src/understanding/
   rm src/search-first-executor.ts
   rm src/goal-processor.ts
   rm src/template-generator.ts
   rm src/boredom.ts  # Move logic to activity
   ```

2. **Update exports:**
   ```typescript
   // Remove from src/lib.ts
   - export { CodeExplorer, ApplicationAnalyzer } from './understanding'
   - export { GoalProcessor } from './goal-processor'
   - export { SearchFirstExecutor } from './search-first-executor'
   ```

3. **Verify VM still works:**
   ```bash
   bun test
   bun run typecheck
   wc -l src/**/*.ts  # Should be ~4,800 LOC
   ```

### Phase 3: Optimize Activities (Week 3)

1. **Create variants:**
   - `understand-codebase-quick.json` (fast scan)
   - `understand-codebase-deep.json` (thorough analysis)
   - `process-goal-simple.json` (direct execution)
   - `process-goal-search-first.json` (reuse focus)

2. **Let Thompson Sampling learn which works best**

3. **Extract successful patterns via ribosome**

### Phase 4: Document VM (Week 4)

1. Update `CLAUDE.md`:
   ```markdown
   # MiniBob: Activity VM

   MiniBob is a minimal runtime (~4,800 LOC) that executes activities.
   Like a VM runs bytecode, MiniBob runs activity templates.

   ## VM Provides:
   - Activity executor
   - Tool system (bash, read, write, edit, git)
   - LLM client
   - Impulse system
   - Backend communication

   ## Activities Provide:
   - All functionality (understanding, goals, composition, etc.)
   - Unlimited and evolvable
   - Discoverable via execution
   ```

2. Create `VM_SPECIFICATION.md` documenting:
   - What VM guarantees
   - Tool system API
   - Lifecycle hooks
   - Extension points

## Decision Points

### 1. Memory Agent: VM or Activity?

**Option A: Keep in VM** (current: 316 LOC)
- Pro: Context management is fundamental
- Pro: All activities need it
- Con: Adds complexity to VM

**Option B: Move to Activity**
- Pro: Different strategies discoverable
- Con: Every activity would need to invoke it

**Recommendation:** ✅ **Keep in VM** - Fundamental concern

### 2. Session: VM or Activity?

**Option A: Keep in VM** (current: 141 LOC)
- Pro: State tracking is VM concern
- Pro: Needed for all executions

**Option B: Remove**
- Pro: Stateless VM
- Con: Lose session continuity

**Recommendation:** ✅ **Keep in VM** - Runtime state

### 3. Validation: VM or Activity?

**Option A: Keep in VM** (current: 125 LOC)
- Pro: Ensures activity correctness
- Pro: Type safety

**Option B: Move to Activity Prompts**
- Pro: Activities validate themselves
- Con: Less type safety

**Recommendation:** ⚠️ **Simplify in VM** - Basic validation only, detailed in activities

## Expected Outcome

### Before: Feature Framework
```
MiniBob: 9,145 LOC (feature-rich framework)
├─ Execution + 20 built-in features
└─ Activities: Limited by built-in features
```

### After: Activity VM
```
MiniBob: ~4,800 LOC (minimal runtime)
├─ Execution essentials only
└─ Activities: Unlimited (all features discoverable)
```

**Result:**
- ✅ Simpler VM (~50% LOC reduction)
- ✅ More powerful system (unlimited activities)
- ✅ Faster evolution (change activities, not VM)
- ✅ Better alignment (VM = infrastructure, Activities = becoming)

## The Ontological Clarity

### VM = Infrastructure (Stable)
- Provides execution environment
- Doesn't change frequently
- Tested and stable
- ~4,800 LOC

### Activities = Becoming (Evolving)
- Implement all functionality
- Change constantly
- Learn and improve
- Unlimited LOC

This separation aligns perfectly with the ontology:
- **VM** = Foundation for becoming (like physics)
- **Activities** = The becoming itself (like life)

The VM doesn't define what can become - it provides the conditions for becoming to emerge.
