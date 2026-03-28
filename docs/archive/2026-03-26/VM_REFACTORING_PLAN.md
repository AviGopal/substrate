# MiniBob VM Refactoring Plan

## Goal
Transform MiniBob from a feature framework (9,145 LOC) to an activity VM (~4,800 LOC) by moving feature code to activities.

## Current vs Target Architecture

### Current (Feature Framework)
```
src/
├─ activity.ts (1,320)     ✅ Keep - VM core
├─ tools.ts (924)          ✅ Keep - VM syscalls
├─ mcp.ts (747)            ✅ Keep - VM network
├─ llm.ts (434)            ✅ Keep - VM CPU
├─ types.ts (489)          ✅ Keep - VM types
├─ boredom.ts (423)        ❌ Remove - Move to activity
├─ acp.ts (362)            ✅ Keep - VM communication
├─ memory-agent.ts (316)   ✅ Keep - VM memory
├─ impulse.ts (311)        ✅ Keep - VM context
├─ impulse-filter.ts (273) ❌ Remove - Logic in activities
├─ acp-gossip.ts (193)     ✅ Keep - VM protocol
├─ lifecycle-hooks.ts (181)✅ Keep - VM extension
├─ config.ts (172)         ✅ Keep - VM config
├─ environment.ts (167)    ✅ Keep - VM env
├─ mcp-activity-bridge.ts (158) ✅ Keep - VM bridge
├─ lib.ts (145)            ✅ Keep - VM exports
├─ session.ts (141)        ✅ Keep - VM state
├─ validation.ts (125)     ✅ Keep - VM validation
├─ search-first-executor.ts (662) ❌ Remove - Move to activity
├─ goal-processor.ts (457) ❌ Remove - Move to activity
├─ template-generator.ts (123) ❌ Remove - Move to activity
├─ understanding/ (1,022)  ❌ Remove - Move to activities
│   ├─ explorer.ts (488)
│   ├─ analyzer.ts (354)
│   └─ types.ts (153)
└─ components/ (?)         ❌ Remove - Unknown purpose
```

### Target (Activity VM)
```
src/
├─ activity.ts            ✅ Activity executor
├─ tools.ts               ✅ Tool system
├─ mcp.ts                 ✅ Backend client
├─ llm.ts                 ✅ LLM client
├─ impulse.ts             ✅ Impulse system
├─ memory-agent.ts        ✅ Context management
├─ acp.ts                 ✅ Vessel protocol
├─ lifecycle-hooks.ts     ✅ Extension points
├─ types.ts               ✅ Core types
├─ config.ts              ✅ Configuration
├─ environment.ts         ✅ Environment detection
├─ session.ts             ✅ Session state
├─ validation.ts          ✅ Type validation
└─ lib.ts                 ✅ Public API

Total: ~4,800 LOC
```

## Phase 1: Create Activity Templates

### 1.1 Understanding System → Activities

Create three activity variants:

**`templates/understand-codebase-quick.json`** (Fast scan)
```json
{
  "id": "understand-codebase-quick",
  "name": "Quick Codebase Understanding",
  "category": "tool",
  "description": "Fast scan of codebase structure and key files",
  "tasks": [
    {
      "id": "scan-structure",
      "description": "List directory structure and file types",
      "prompt": {
        "template": "Analyze {{path}}:\n1. Run: ls -R {{path}}\n2. Count files by extension\n3. Identify package.json or similar\n4. List key directories\nOutput JSON with structure summary.",
        "variables": [
          {"name": "path", "source": "variable", "type": "string"}
        ]
      },
      "validation": {
        "requiredPatterns": ["structure", "fileTypes"]
      }
    },
    {
      "id": "identify-entry-points",
      "description": "Find main entry points",
      "prompt": {
        "template": "Based on structure:\n{{structure}}\n\nIdentify likely entry points:\n- Look for index.*, main.*, app.*\n- Check package.json main/bin fields\n- Find server start files\nOutput JSON list.",
        "variables": [
          {"name": "structure", "source": "context", "type": "string"}
        ]
      }
    }
  ]
}
```

**`templates/understand-codebase-deep.json`** (Thorough analysis)
```json
{
  "id": "understand-codebase-deep",
  "name": "Deep Codebase Understanding",
  "category": "tool",
  "description": "Comprehensive architecture and dependency analysis",
  "tasks": [
    {
      "id": "explore-structure",
      "description": "Detailed file structure analysis",
      "prompt": {
        "template": "Analyze {{path}} in detail:\n1. Directory tree with file sizes\n2. All dependencies (package.json, requirements.txt, etc.)\n3. Import/export relationships\n4. Test file locations\nGenerate comprehensive structure JSON.",
        "variables": [
          {"name": "path", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "analyze-architecture",
      "description": "Determine architecture pattern",
      "prompt": {
        "template": "Given structure:\n{{structure}}\n\nAnalyze:\n1. Architecture pattern (MVC, microservices, etc.)\n2. Key modules and their purposes\n3. Data flow between components\n4. Technology stack\nOutput detailed JSON analysis.",
        "variables": [
          {"name": "structure", "source": "context", "type": "string"}
        ]
      }
    },
    {
      "id": "identify-patterns",
      "description": "Find code patterns and conventions",
      "prompt": {
        "template": "Scan codebase for:\n1. Common patterns (factories, singletons, etc.)\n2. Naming conventions\n3. Code organization principles\n4. Testing approach\nDocument findings as JSON.",
        "variables": []
      }
    }
  ]
}
```

**`templates/diagnose-problem.json`** (Problem diagnosis)
```json
{
  "id": "diagnose-problem",
  "name": "Diagnose Codebase Problem",
  "category": "tool",
  "description": "Identify root cause of a described problem",
  "tasks": [
    {
      "id": "understand-symptoms",
      "description": "Analyze problem symptoms",
      "prompt": {
        "template": "Problem description:\n{{problem}}\n\nAnalyze:\n1. What are the symptoms?\n2. What components are likely involved?\n3. What files should we examine?\nOutput JSON analysis.",
        "variables": [
          {"name": "problem", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "investigate-files",
      "description": "Read relevant files",
      "prompt": {
        "template": "Based on analysis:\n{{analysis}}\n\nRead the identified files and look for:\n1. Code that matches symptoms\n2. Error handling\n3. Edge cases\n4. Dependencies\nDocument findings.",
        "variables": [
          {"name": "analysis", "source": "context", "type": "string"}
        ]
      }
    },
    {
      "id": "identify-root-cause",
      "description": "Determine root cause",
      "prompt": {
        "template": "Symptoms: {{problem}}\nCode analysis: {{findings}}\n\nDetermine:\n1. Root cause\n2. Affected files\n3. Recommended fix\n4. Validation steps\nOutput diagnosis JSON.",
        "variables": [
          {"name": "problem", "source": "variable", "type": "string"},
          {"name": "findings", "source": "context", "type": "string"}
        ]
      }
    }
  ]
}
```

### 1.2 Goal Processing → Activity

**`templates/process-goal.json`**
```json
{
  "id": "process-goal",
  "name": "Process User Goal into Activities",
  "category": "tool",
  "description": "Convert a user goal into executable activity recommendations",
  "tasks": [
    {
      "id": "decompose-goal",
      "description": "Break goal into concrete steps",
      "prompt": {
        "template": "User goal: {{goal}}\n\nDecompose into 3-5 concrete, testable steps.\nEach step should be:\n- Specific and measurable\n- Achievable with existing tools\n- Ordered logically\nOutput JSON array of steps.",
        "variables": [
          {"name": "goal", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "search-activities",
      "description": "Find matching activities for each step",
      "prompt": {
        "template": "Steps:\n{{steps}}\n\nFor each step, search backend for matching activities using MCP.\nUse bash tool to query:\ncurl 'http://api.minibob.local/v2/activities/templates?search=<step>'\n\nOutput JSON mapping steps to activities.",
        "variables": [
          {"name": "steps", "source": "context", "type": "string"}
        ]
      }
    },
    {
      "id": "create-execution-plan",
      "description": "Generate execution plan",
      "prompt": {
        "template": "Goal: {{goal}}\nSteps: {{steps}}\nAvailable activities: {{activities}}\n\nCreate execution plan:\n1. Use existing activities where possible\n2. Mark steps needing new activities\n3. Define execution order\n4. Estimate effort\nOutput JSON execution plan.",
        "variables": [
          {"name": "goal", "source": "variable", "type": "string"},
          {"name": "steps", "source": "context", "type": "string"},
          {"name": "activities", "source": "context", "type": "string"}
        ]
      }
    }
  ]
}
```

### 1.3 Search-First Execution → Activity

**`templates/search-and-compose.json`**
```json
{
  "id": "search-and-compose",
  "name": "Search-First Goal Execution",
  "category": "tool",
  "description": "Execute goal by searching and composing existing activities",
  "tasks": [
    {
      "id": "decompose-and-search",
      "description": "Decompose goal and search for each step",
      "prompt": {
        "template": "Goal: {{goal}}\n\n1. Break into steps\n2. For each step, search activities:\n   curl 'http://api.minibob.local/v2/activities/templates?search=<step>'\n3. Categorize: found/not-found\nOutput JSON with found activities and missing steps.",
        "variables": [
          {"name": "goal", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "execute-or-delegate",
      "description": "Execute found activities or handle missing steps",
      "prompt": {
        "template": "Plan:\n{{plan}}\n\nFor each step:\n- If activity found: Note to delegate (will be handled by orchestration)\n- If not found: Execute step directly with available tools\n- Capture result summary (not full trace)\nOutput JSON results.",
        "variables": [
          {"name": "plan", "source": "context", "type": "string"}
        ]
      }
    },
    {
      "id": "synthesize-results",
      "description": "Combine results into goal outcome",
      "prompt": {
        "template": "Goal: {{goal}}\nResults: {{results}}\n\nSynthesize:\n1. Was goal achieved?\n2. What was accomplished?\n3. Any issues or gaps?\n4. Next steps if incomplete\nOutput JSON summary.",
        "variables": [
          {"name": "goal", "source": "variable", "type": "string"},
          {"name": "results", "source": "context", "type": "string"}
        ]
      }
    }
  ]
}
```

### 1.4 Template Extraction → Activity

**`templates/extract-template.json`** (Ribosome)
```json
{
  "id": "extract-template",
  "name": "Extract Template from Execution (Ribosome)",
  "category": "infrastructure",
  "description": "Generate reusable activity template from successful execution",
  "tasks": [
    {
      "id": "analyze-execution",
      "description": "Analyze execution trace for patterns",
      "prompt": {
        "template": "Execution trace:\n{{trace}}\n\nExtract:\n1. Goal/intent\n2. Task sequence\n3. Tools used\n4. Success criteria\n5. Reusable patterns\nOutput analysis JSON.",
        "variables": [
          {"name": "trace", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "generate-template",
      "description": "Create activity template JSON",
      "prompt": {
        "template": "Based on analysis:\n{{analysis}}\n\nGenerate activity template JSON with:\n- Descriptive ID and name\n- Category\n- Tasks with prompts\n- Variable definitions\n- Validation rules\nOutput complete template JSON.",
        "variables": [
          {"name": "analysis", "source": "context", "type": "string"}
        ]
      }
    },
    {
      "id": "validate-and-save",
      "description": "Validate and save template",
      "prompt": {
        "template": "Template:\n{{template}}\n\n1. Validate JSON structure\n2. Check all required fields\n3. Save to templates/ directory\n4. Register with backend via:\n   curl -X POST http://api.minibob.local/v2/activities/templates -d @template.json\nOutput confirmation.",
        "variables": [
          {"name": "template", "source": "context", "type": "string"}
        ]
      }
    }
  ]
}
```

### 1.5 Boredom System → Activity

**`templates/autonomous-boredom.json`**
```json
{
  "id": "autonomous-boredom",
  "name": "Autonomous Boredom Activity",
  "category": "infrastructure",
  "description": "Self-improvement when idle for 5+ minutes",
  "tasks": [
    {
      "id": "assess-state",
      "description": "Check system state and opportunities",
      "prompt": {
        "template": "Assess improvement opportunities:\n1. Query backend for low-success templates\n2. Check recent failures\n3. Look for patterns in execution traces\n4. Identify optimization targets\nOutput JSON assessment.",
        "variables": []
      }
    },
    {
      "id": "select-improvement",
      "description": "Choose improvement to work on",
      "prompt": {
        "template": "Assessment:\n{{assessment}}\n\nPrioritize by:\n1. Impact (affects many executions)\n2. Feasibility (can be improved)\n3. Recency (recent failures)\nSelect top opportunity and output JSON.",
        "variables": [
          {"name": "assessment", "source": "context", "type": "string"}
        ]
      }
    },
    {
      "id": "execute-improvement",
      "description": "Perform the improvement",
      "prompt": {
        "template": "Selected improvement:\n{{improvement}}\n\nExecute appropriate action:\n- Debug failed template\n- Create variant\n- Optimize slow template\n- Extract new pattern\nDocument outcome.",
        "variables": [
          {"name": "improvement", "source": "context", "type": "string"}
        ]
      }
    }
  ]
}
```

## Phase 2: Test Activities

### 2.1 Test Understanding Activities

```bash
# Quick understanding
cd repos/minibob
bun run index.ts templates/understand-codebase-quick.json '{"path":"."}'

# Deep understanding
bun run index.ts templates/understand-codebase-deep.json '{"path":"../metabob-activity-api"}'

# Diagnose problem
bun run index.ts templates/diagnose-problem.json '{"problem":"API calls returning 401"}'
```

### 2.2 Test Goal Processing

```bash
# Process goal
bun run index.ts templates/process-goal.json '{"goal":"Add user authentication"}'

# Search and compose
bun run index.ts templates/search-and-compose.json '{"goal":"Fix the login bug"}'
```

### 2.3 Test Ribosome

```bash
# First, run an activity successfully
bun run index.ts templates/hello-world.json '{"message":"Test"}'

# Then extract template from execution
bun run index.ts templates/extract-template.json '{
  "trace": "<execution_trace_json>"
}'
```

### 2.4 Verify Equivalence

Create comparison tests:
```typescript
// test/vm-refactoring.test.ts
describe('VM Refactoring', () => {
  it('understanding activity equals old system', async () => {
    const activityResult = await runActivity('understand-codebase-quick', {path: '.'})
    const oldSystemResult = await oldUnderstandingSystem.explore('.')

    expect(activityResult).toMatchStructure(oldSystemResult)
  })

  // ... more equivalence tests
})
```

## Phase 3: Remove from VM

### 3.1 Delete Feature Code

```bash
# Create backup branch first
git checkout -b vm-refactoring
git add -A
git commit -m "checkpoint: before VM refactoring"

# Remove understanding system
rm -rf src/understanding/

# Remove feature executors
rm src/search-first-executor.ts
rm src/goal-processor.ts
rm src/template-generator.ts

# Remove boredom system (logic moved to activity)
rm src/boredom.ts

# Remove impulse filter (logic in activities)
rm src/impulse-filter.ts

# Remove components directory (verify not needed first)
ls -la src/components/
# If empty or unused:
rm -rf src/components/
```

### 3.2 Update Exports

**`src/lib.ts`** - Remove feature exports:
```typescript
// REMOVE THESE:
- export { CodeExplorer, ApplicationAnalyzer } from './understanding'
- export type { CodeStructure, Analysis } from './understanding/types'
- export { GoalProcessor } from './goal-processor'
- export { SearchFirstExecutor } from './search-first-executor'
- export { assembleTemplateFromExecution } from './template-generator'
- export { BoredomSystem } from './boredom'
- export { ImpulseFilter } from './impulse-filter'

// KEEP THESE (VM essentials):
export { ActivityExecutor, loadTemplateFromMCPOrLocal } from './activity'
export { createToolHandlers, getAllToolDefinitions } from './tools'
export { createLLMClient } from './llm'
export { getMCPClient, isMCPEnabled } from './mcp'
export { ImpulseResolver } from './impulse'
export { MemoryAgent } from './memory-agent'
export { ACPProtocol } from './acp'
export { LifecycleHooks } from './lifecycle-hooks'
export type {
  ActivityTemplate,
  ActivityExecution,
  ActivityTask,
  Impulse,
  ToolHandler,
  ToolResult
} from './types'
```

### 3.3 Update Entry Point

**`index.ts`** - Remove feature CLI commands:
```typescript
// REMOVE:
- if (command === 'understand') { ... }
- if (command === 'diagnose') { ... }
- if (command === 'search-first') { ... }

// KEEP:
- if (command === 'run') { ... }  // Run any activity
- Server mode (no command) { ... }
```

Users now run: `bun run index.ts templates/understand-codebase.json '{"path":"."}'`
Instead of: `bun run index.ts understand . architecture`

### 3.4 Clean Up Dependencies

**`package.json`** - Remove unused dependencies:
```bash
# Check what's actually used
bun run build
# Review for unused imports

# Remove if not needed by VM core
# (understanding system might have added specific deps)
```

### 3.5 Verify VM Size

```bash
# Check line count
find src -name "*.ts" -exec wc -l {} + | tail -1
# Target: ~4,800 LOC

# Check what remains
ls -la src/*.ts | awk '{print $5, $9}' | sort -rn

# Verify no dead code
bun run typecheck
```

## Phase 4: Update Documentation

### 4.1 Update CLAUDE.md

```markdown
# MiniBob: Activity VM

MiniBob is a **minimal activity runtime** (~4,800 LOC) that executes activity templates.

## Architecture

MiniBob provides the VM essentials:
- Activity executor (runs any activity template)
- Tool system (bash, read, write, edit, git)
- LLM client (executes prompts with tool calling)
- Impulse system (context management)
- MCP client (backend communication)
- Lifecycle hooks (extension points)

**All functionality is implemented as activities**, not built into the VM.

## Key Principles

1. **VM = Infrastructure** - Stable, minimal, rarely changes
2. **Activities = Functionality** - Unlimited, evolving, discoverable
3. **No feature accumulation** - Add capabilities via activities, not VM code

## Available Activities

See `templates/` directory for all activities:
- `understand-codebase-*.json` - Codebase analysis
- `process-goal.json` - Goal processing
- `search-and-compose.json` - Activity composition
- `extract-template.json` - Ribosome pattern
- `autonomous-boredom.json` - Self-improvement

Create new activities by copying and modifying existing ones.
```

### 4.2 Create VM Specification

**`VM_SPECIFICATION.md`**:
```markdown
# MiniBob VM Specification

## What the VM Guarantees

1. **Activity Execution**: Any valid activity template will execute
2. **Tool System**: Bash, read, write, edit, git always available
3. **LLM Integration**: Prompts execute with tool calling
4. **Context Management**: Impulses loaded and resolved
5. **Backend Communication**: MCP client for all backend operations
6. **Lifecycle Hooks**: Activities can hook into execution phases

## Tool System API

[Document each tool...]

## Lifecycle Hooks

[Document hook points...]

## Extension Points

[Document how to extend VM...]
```

### 4.3 Create Activity Development Guide

**`ACTIVITY_DEVELOPMENT.md`**:
```markdown
# Developing Activities for MiniBob

## Activity Structure

[Template format...]

## Best Practices

1. Keep activities focused (single responsibility)
2. Use impulses for large context
3. Validate outputs
4. Create variants for different approaches

## Examples

[Show common patterns...]
```

## Phase 5: Validate Alignment

### 5.1 Run Alignment Checks

```bash
# 1. Check VM size
echo "VM LOC:" && find src -name "*.ts" -exec wc -l {} + | tail -1
# Target: ~4,800 LOC

# 2. Verify no feature code
grep -r "class.*Analyzer" src/  # Should find nothing
grep -r "class.*Executor" src/  # Should only find ActivityExecutor
grep -r "class.*Processor" src/  # Should find nothing

# 3. Count activities
ls templates/*.json | wc -l
# Should have 10+ activities

# 4. Verify activities work
for activity in templates/*.json; do
  echo "Testing $activity..."
  bun run index.ts "$activity" '{}' || echo "FAILED: $activity"
done
```

### 5.2 Ontological Verification

```markdown
✅ VM (Infrastructure) = Stable instructional state (~4,800 LOC)
✅ Activities (Programs) = Evolving vessels (unlimited)
✅ Executions (Becoming) = Captured in traces
✅ Instances (Results) = Stored in backend
✅ Learning Loop = Backend Thompson Sampling + ribosome activity
```

## Expected Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| VM LOC | 9,145 | ~4,800 | -47% |
| Built-in Features | 8 | 0 | -100% |
| Available Activities | 20 | 30+ | +50% |
| Activity Variants | Few | Many | +200% |
| VM Rebuild Frequency | High | Low | -80% |
| Activity Updates | Rare | Frequent | +300% |

## Success Criteria

- [ ] VM is ~4,800 LOC (±500)
- [ ] No feature code in src/ (only infrastructure)
- [ ] All features available as activities
- [ ] Activities test equivalent to old features
- [ ] Documentation updated
- [ ] Alignment verified
- [ ] Thompson Sampling selecting best activity variants

## Timeline

- **Week 1**: Create activities, test equivalence
- **Week 2**: Remove VM features, update exports
- **Week 3**: Optimize activities, create variants
- **Week 4**: Documentation, validation, deployment

**Total: 4 weeks to complete VM refactoring**
