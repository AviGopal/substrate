# Impulse-Driven Ribosome: Implementation Roadmap

**Date**: 2026-03-20  
**Status**: Ready to implement  
**Goal**: Self-replicating activity system with impulse-driven composition

---

## Implementation Phases

### Phase 1: Output Impulses (Foundation)

**Objective**: Tasks can create impulses from their outputs

**Files to Modify**:
- `repos/minibob/src/types.ts`
- `repos/minibob/src/activity.ts`
- `repos/minibob/src/impulse.ts`

**Changes**:

1. **Add outputImpulses to Task Definition**
```typescript
// In types.ts, update ActivityTask:
export interface ActivityTask {
  // ... existing fields
  outputImpulses?: string[]  // NEW: Impulse IDs to create from output
}
```

2. **Add Automatic Impulse Creation**
```typescript
// In activity.ts, after task execution:
async function executeTask(task: ActivityTask, variables: Record<string, unknown>): Promise<TaskResult> {
  const result = await executeLLM(task, variables)
  
  // NEW: Create output impulses
  if (task.outputImpulses && result.status === "completed") {
    for (const impulseId of task.outputImpulses) {
      await createImpulse({
        id: impulseId,
        type: "activityOutput",
        pointer: {
          type: "memo",
          content: result.output  // Or parse structured output
        },
        budget: 5000,
        metadata: {
          taskId: task.id,
          createdAt: Date.now()
        }
      })
    }
  }
  
  return result
}
```

3. **Test**:
```json
{
  "tasks": [
    {
      "id": "task-1",
      "prompt": { "template": "Generate JSON: {name: 'test', value: 42}" },
      "outputImpulses": ["test-output"]
    },
    {
      "id": "task-2",
      "dependencies": ["task-1"],
      "prompt": { "template": "Use previous output: {{impulse:test-output}}" }
    }
  ]
}
```

---

### Phase 2: Impulse Loading in Prompts

**Objective**: `{{impulse:id}}` placeholders load impulse content

**Files to Modify**:
- `repos/minibob/src/activity.ts`

**Changes**:

1. **Add Impulse Substitution**
```typescript
async function substituteVariablesAndImpulses(
  template: string,
  variables: Record<string, unknown>,
  impulseIds: string[]
): Promise<string> {
  let result = template
  
  // Substitute variables (existing)
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
  }
  
  // NEW: Substitute impulses
  const impulsePattern = /{{impulse:([a-zA-Z0-9_-]+)}}/g
  const matches = Array.from(result.matchAll(impulsePattern))
  
  for (const match of matches) {
    const impulseId = match[1]
    const impulseContent = await loadImpulses([impulseId])
    const formatted = formatImpulsesForContext(impulseContent, 5000)  // Respect budget
    result = result.replace(match[0], formatted)
  }
  
  return result
}
```

2. **Update Task Execution**
```typescript
async function executeTask(task: ActivityTask, variables: Record<string, unknown>, impulseIds: string[]): Promise<TaskResult> {
  // Substitute both variables and impulses
  const prompt = await substituteVariablesAndImpulses(
    task.prompt.template,
    variables,
    impulseIds
  )
  
  // Execute with substituted prompt
  const result = await executeLLM({ ...task, prompt: { ...task.prompt, template: prompt } }, variables)
  
  // Create output impulses
  if (task.outputImpulses && result.status === "completed") {
    // ... (from Phase 1)
  }
  
  return result
}
```

3. **Test**:
```bash
# Create impulse manually
impulse_create({ id: "context-data", pointer: { type: "memo", content: "Important context" } })

# Run activity that references it
bun run index.ts run test-activity.json
# Prompt: "Use this context: {{impulse:context-data}}"
# → Loads and substitutes impulse content
```

---

### Phase 3: Execution Trace as Impulse

**Objective**: Store execution traces as impulses for template generation

**Files to Modify**:
- `repos/minibob/src/activity.ts`
- `repos/minibob/src/impulse.ts`

**Changes**:

1. **Store Trace After Execution**
```typescript
// In ActivityExecutor.execute():
async execute(options: ExecuteOptions): Promise<ActivityExecution> {
  // ... existing execution logic
  
  const execution: ActivityExecution = {
    id: activityId,
    status: "completed",
    // ... other fields
    executionTrace: this.executionTrace  // From Phase 1 foundation
  }
  
  // NEW: Store trace as impulse
  if (this.config.recordExecutionTrace && execution.executionTrace) {
    await storeActivityOutput(activityId, execution.executionTrace)
    
    // Also create a named impulse for easy reference
    await createImpulse({
      id: `trace-${activityId}`,
      type: "executionTrace",
      pointer: {
        type: "activityOutput",
        executionId: activityId,
        format: "executionTrace"
      },
      budget: 10000,
      metadata: {
        activityName: options.template.name,
        status: execution.status,
        duration: execution.duration,
        cost: execution.cost
      }
    })
  }
  
  return execution
}
```

2. **Test**:
```bash
# Run activity with recording
MINIBOB_RECORD_TRACE=true bun run index.ts run test-activity.json

# Check impulse was created
impulse_list | grep "trace-"
# → Should show trace-act_123...

# Load trace in next activity
# Prompt: "Analyze this execution: {{impulse:trace-act_123}}"
```

---

### Phase 4: Template Generator (The Assembler)

**Objective**: Convert execution trace impulse → activity template

**Files to Create**:
- `repos/minibob/src/template-generator.ts` (from earlier design)

**Implementation** (from Phase 1 design):
```typescript
export function assembleTemplateFromExecution(
  execution: ActivityExecution,
  templateName: string,
  category: string
): ActivityTemplate {
  if (!execution.executionTrace) {
    throw new Error("Execution trace not available")
  }
  
  const trace = execution.executionTrace
  
  // Extract tasks
  const tasks: ActivityTask[] = trace.tasks.map((executedTask, index) => ({
    id: `task-${index + 1}`,
    subagent: "general",
    description: executedTask.description || inferTaskDescription(executedTask),
    dependencies: index > 0 ? [`task-${index}`] : [],
    prompt: {
      template: executedTask.actualPrompt,
      maxTokens: 16000,
      compressionStrategy: "filter"
    },
    validation: assembleValidation(executedTask.validationResults),
    retry: { maxAttempts: 2, strategy: "simple" },
    outputImpulses: inferOutputImpulses(executedTask)  // NEW
  }))
  
  return {
    id: generateTemplateId(),
    name: templateName,
    description: trace.goalContext?.goal || "Generated from execution",
    category,
    tasks,
    metadata: {
      generatedFrom: "execution",
      sourceExecutionId: execution.id,
      firstExecutionMetrics: {
        duration: execution.duration,
        cost: execution.cost,
        tokens: execution.tokens,
        status: execution.status
      }
    }
  }
}

function inferOutputImpulses(executedTask: ExecutedTask): string[] {
  // Check if task created any impulses
  const impulseCreations = executedTask.toolCalls.filter(tc => tc.tool === "impulse_create")
  return impulseCreations.map(tc => tc.params.id as string)
}
```

---

### Phase 5: Meta-Activity (The Ribosome)

**Objective**: Activity that creates activities from goals

**Files to Create**:
- `repos/minibob/templates/create-activity-from-goal.json`

**Template** (simplified for initial implementation):
```json
{
  "name": "Create Activity From Goal",
  "description": "Meta-activity: creates reusable activity templates from goal execution",
  "category": "meta",
  "tasks": [
    {
      "id": "task-1-execute-goal",
      "description": "Execute goal while recording trace",
      "prompt": {
        "template": "Execute this goal: {{goal}}\n\nContext: {{context}}\n\nWork step by step, using tools as needed.\n\nGoal accomplished when: {{successCriteria}}"
      },
      "outputImpulses": ["goal-execution-trace"]
    },
    {
      "id": "task-2-generate-template",
      "dependencies": ["task-1-execute-goal"],
      "description": "Generate activity template from execution trace",
      "prompt": {
        "template": "Create an activity template from this execution: {{impulse:goal-execution-trace}}\n\nTemplate name: {{templateName}}\nCategory: {{category}}\n\nOutput: ActivityTemplate JSON with tasks, validations, and output impulses."
      },
      "outputImpulses": ["generated-template"]
    },
    {
      "id": "task-3-create-test-case",
      "dependencies": ["task-2-generate-template"],
      "description": "Create test case from execution",
      "prompt": {
        "template": "Create test case:\nInput: {{goal}}, {{context}}\nExecution: {{impulse:goal-execution-trace}}\nTemplate: {{impulse:generated-template}}\n\nOutput: Test case JSON with input/expected output."
      },
      "outputImpulses": ["test-case-1"]
    },
    {
      "id": "task-4-register-template",
      "dependencies": ["task-3-create-test-case"],
      "description": "Register template and test case",
      "prompt": {
        "template": "Register template: {{impulse:generated-template}}\n\nSave to: templates/{{templateName}}.json\n\nAlso save test case: {{impulse:test-case-1}}\nTo: test-cases/{{templateName}}-test-1.json"
      },
      "validation": {
        "requiredFiles": [
          "templates/{{templateName}}.json",
          "test-cases/{{templateName}}-test-1.json"
        ]
      }
    }
  ]
}
```

**Test**:
```bash
bun run index.ts run templates/create-activity-from-goal.json \
  --var goal="Generate dependency graph from TypeScript imports" \
  --var context="targetDir=src/session" \
  --var successCriteria="DEPENDENCY_GRAPH.json created with valid JSON" \
  --var templateName="dependency-graph-generator" \
  --var category="tool"

# Expected output:
# - templates/dependency-graph-generator.json (new activity)
# - test-cases/dependency-graph-generator-test-1.json (test case)
# - Impulses created: goal-execution-trace, generated-template, test-case-1
```

---

### Phase 6: Variant Testing & Improvement

**Objective**: Test and compare activity variants

**Files to Create**:
- `repos/minibob/templates/test-activity-variants.json`
- `repos/minibob/templates/improve-activity-variant.json`

**Test Activity Template**:
```json
{
  "name": "Test Activity Variants",
  "tasks": [
    {
      "id": "load-variants-and-tests",
      "prompt": {
        "template": "Load variants: {{impulse:template-v1}} {{impulse:template-v2}}\nLoad tests: {{impulse:test-case-1}} {{impulse:test-case-2}}"
      },
      "outputImpulses": ["variants-loaded", "tests-loaded"]
    },
    {
      "id": "execute-tests",
      "dependencies": ["load-variants-and-tests"],
      "prompt": {
        "template": "Execute each variant with each test case.\n\nRecord: success rate, duration, cost.\n\nOutput comparison data."
      },
      "outputImpulses": ["test-results"]
    },
    {
      "id": "analyze-results",
      "dependencies": ["execute-tests"],
      "prompt": {
        "template": "Analyze: {{impulse:test-results}}\n\nWhich variant is best? Why?"
      },
      "outputImpulses": ["analysis"]
    }
  ]
}
```

---

### Phase 7: Full Self-Improvement Loop

**Integration**: Connect all pieces

```
User Goal
    ↓
Execute: create-activity-from-goal
    ↓
    [Creates template + test case + impulses]
    ↓
User: Use new template 10 times
    ↓
    [Each execution creates trace impulse]
    ↓
Execute: analyze-activity-performance
    ↓
    [Loads all trace impulses, finds patterns]
    ↓
    [Creates: performance-analysis impulse]
    ↓
Execute: improve-activity-variant
    ↓
    [Loads: template, performance-analysis]
    ↓
    [Creates: template-v2, improvement-notes impulses]
    ↓
Execute: test-activity-variants
    ↓
    [Loads: template-v1, template-v2, test cases]
    ↓
    [Compares and selects best]
    ↓
Register: v2 as new current
```

---

## Testing Strategy

### Test 1: Output Impulses
```bash
# Create simple activity with output impulses
cat > test-impulse-output.json <<'EOF'
{
  "tasks": [
    {"id": "t1", "prompt": {"template": "Output: hello"}, "outputImpulses": ["greeting"]},
    {"id": "t2", "dependencies": ["t1"], "prompt": {"template": "Echo: {{impulse:greeting}}"}}
  ]
}
EOF

bun run index.ts run test-impulse-output.json
# Verify: Impulse "greeting" created, loaded in task 2
```

### Test 2: Trace Storage
```bash
# Run activity with recording
MINIBOB_RECORD_TRACE=true bun run index.ts run phase1-audit-simple.json

# Check impulse created
impulse_list | grep trace-

# Load trace
impulse_load trace-act_XXX
# Verify: Full execution trace with tasks, tool calls
```

### Test 3: Template Generation
```bash
# Generate template from trace
bun -e "
import { assembleTemplateFromExecution } from './src/template-generator.ts'
const trace = loadImpulse('trace-act_XXX')
const template = assembleTemplateFromExecution(trace, 'Test Template', 'tool')
console.log(JSON.stringify(template, null, 2))
"
```

### Test 4: Ribosome (Full Loop)
```bash
# Create activity from goal
bun run index.ts run templates/create-activity-from-goal.json \
  --var goal="Count TypeScript files in directory" \
  --var templateName="count-typescript-files" \
  --var category="tool"

# Use generated template
bun run index.ts run templates/count-typescript-files.json \
  --var targetDir="src/"

# Verify: Works correctly
```

---

## Implementation Order

1. **Week 1**: Phase 1-2 (Output impulses + loading)
2. **Week 2**: Phase 3-4 (Trace storage + template generator)
3. **Week 3**: Phase 5 (Meta-activity implementation)
4. **Week 4**: Phase 6-7 (Variant testing + full loop)

---

## Success Criteria

- [ ] Tasks can create output impulses
- [ ] Tasks can load impulses via {{impulse:id}}
- [ ] Execution traces stored as impulses
- [ ] Template generator works (trace → template)
- [ ] Meta-activity creates working templates
- [ ] Generated templates include output impulses
- [ ] Variant testing compares multiple versions
- [ ] Full improvement loop works end-to-end

---

## Next Immediate Goal for Minibob

```
Implement output impulses and impulse loading in minibob:

1. Add outputImpulses field to ActivityTask in types.ts
2. Create impulses from task outputs in activity.ts
3. Add impulse substitution in prompts ({{impulse:id}})
4. Test with simple activity that creates and loads impulses

Working directory: /home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob
Files to modify: src/types.ts, src/activity.ts, src/impulse.ts
Goal: Enable impulse-driven task composition
```

**This is the foundation for the ribosome** - once tasks can create and load impulses, we can build the full self-replicating system on top.
