# Impulse-Driven Ribosome: Self-Replicating Activity System

**Date**: 2026-03-20  
**Integration**: Impulses + Ribosome Architecture  
**Focus**: Activity improvement through iterative variant testing

---

## Core Insight: Impulses are the mRNA

In the biological ribosome:
- **mRNA** carries instructions (codon sequences)
- **tRNA** brings amino acids (building blocks)
- **Ribosome** assembles protein

In our system:
- **Impulses** carry pointers to execution (code, data, context)
- **Tools** bring capabilities (bash, read, write, activities)
- **ActivityExecutor** assembles activities

---

## What are Impulses?

**Impulses are lazy-loaded pointers** that enable:

1. **Variable Passing**: Instead of copying data, pass reference
   ```typescript
   // Not this (eager, copies data):
   activity({ variables: { largeData: "..." } })  // 10 MB copied
   
   // This (lazy, passes pointer):
   impulse_create({ id: "large-data", pointer: { type: "file", path: "..." } })
   activity({ impulses: ["large-data"] })  // Pointer passed, loaded on demand
   ```

2. **Context Window Management**: Load only what's needed
   ```typescript
   // Impulse with budget:
   impulse_create({ 
     id: "execution-trace", 
     pointer: { type: "activityOutput", executionId: "act_123" },
     budget: 5000  // Max 5000 tokens
   })
   
   // Loaded automatically when referenced:
   task.prompt.template = "Analyze this trace: {{impulse:execution-trace}}"
   // → Loader fetches trace, formats for LLM, respects budget
   ```

3. **Automatic Tool/Activity Calling**: Compose workflows via pointers
   ```typescript
   // Create pointer to dependency graph:
   impulse_create({ 
     id: "dep-graph", 
     pointer: { type: "activityOutput", executionId: "act_dep_scan" }
   })
   
   // Automatically triggers activity if not cached:
   loadImpulse("dep-graph")  
   // → Checks cache
   // → If missing, executes activity "dep_scan"
   // → Returns result
   ```

4. **Workflow Composition**: Chain activities via impulses
   ```typescript
   // Activity 1: Scan dependencies
   execute(scanDependencies) → creates impulse "dep-graph"
   
   // Activity 2: Generate removal order (uses dep-graph)
   execute(generateRemovalOrder, { impulses: ["dep-graph"] })
   // → Automatically loads dep-graph into context
   // → Uses data to determine order
   ```

---

## Impulse Types for Activity Creation

### 1. Execution Trace Impulse

**Purpose**: Store what happened during activity execution

```typescript
impulse_create({
  id: `trace-${executionId}`,
  type: "executionTrace",
  pointer: {
    type: "activityOutput",
    executionId: "act_1774017674607_twvqxq",
    format: "executionTrace"  // Special format: tasks, tool calls, validations
  },
  budget: 10000,  // Max tokens to load
  metadata: {
    activityName: "Phase 1 Audit",
    status: "completed",
    duration: 139000,
    cost: 0.55
  }
})
```

**When Loaded**:
```json
{
  "tasks": [
    {
      "id": "task-1",
      "actualPrompt": "You need to map import dependencies...",
      "toolCalls": [
        {"tool": "bash", "params": {"command": "cd repos/... && find ..."}, "result": {...}},
        {"tool": "write", "params": {"path": "DEPENDENCY_GRAPH.json", ...}, "result": {...}}
      ],
      "validationResults": {
        "requiredFiles": [{"path": "DEPENDENCY_GRAPH.json", "exists": true}]
      }
    }
  ]
}
```

### 2. Template Variant Impulse

**Purpose**: Store different versions of activity template for comparison

```typescript
impulse_create({
  id: "template-variant-v1",
  type: "templateDefinition",
  pointer: {
    type: "templateDefinition",
    definition: {...},  // Full template JSON
    source: "execution",
    sourceExecutionId: "act_123"
  },
  budget: 8000,
  metadata: {
    templateName: "Dependency Graph Generator",
    version: 1,
    successRate: 1.0,  // 1 execution, 1 success
    avgCost: 0.55
  }
})
```

### 3. Comparison Data Impulse

**Purpose**: Store metrics comparing activity variants

```typescript
impulse_create({
  id: "variant-comparison",
  type: "comparisonData",
  pointer: {
    type: "memo",
    content: {
      variants: [
        {
          variantId: "v1",
          executions: 10,
          successRate: 0.8,
          avgDuration: 120000,
          avgCost: 0.55,
          commonFailures: ["validation timeout", "missing file"]
        },
        {
          variantId: "v2",
          executions: 5,
          successRate: 1.0,
          avgDuration: 95000,
          avgCost: 0.42,
          improvements: ["added retry logic", "relaxed validation"]
        }
      ]
    }
  },
  budget: 5000
})
```

### 4. Test Case Impulse

**Purpose**: Store input/output pairs for validating activity variants

```typescript
impulse_create({
  id: "test-case-1",
  type: "testCase",
  pointer: {
    type: "memo",
    content: {
      input: {
        goal: "Create dependency graph for refactoring",
        context: { targetDir: "repos/metabob-opencode/packages/opencode/src/session" }
      },
      expectedOutput: {
        files: ["DEPENDENCY_GRAPH.json"],
        patterns: ["\"totalFiles\"", "\"imports\""],
        validations: ["file exists", "valid JSON", "has required fields"]
      },
      actualOutput: {
        executionId: "act_123",
        status: "completed",
        outputFiles: ["DEPENDENCY_GRAPH.json"]
      }
    }
  },
  budget: 3000
})
```

---

## Activity Improvement Loop with Impulses

### Phase 1: Initial Creation (The Ribosome)

```
Goal: "Create dependency graph for refactoring"
    ↓
Execute: create-activity-from-goal
    ↓
    [Task 1: Parse Goal]
    Create impulse: "goal-parsed" → { intent, context, outputType }
    ↓
    [Task 2: Generate Task Sequence]
    Load impulse: "goal-parsed"
    Create impulse: "task-sequence" → ["scan files", "extract imports", "build graph"]
    ↓
    [Task 3: Execute Task Sequence with Recording]
    Load impulse: "task-sequence"
    Execute each task, record tool calls
    Create impulse: "execution-trace-v1" → full trace
    ↓
    [Task 4: Assemble Template]
    Load impulse: "execution-trace-v1"
    Create template from trace
    Create impulse: "template-v1" → activity template
    ↓
    [Task 5: Register Template]
    Load impulse: "template-v1"
    Validate and save to templates/
    Create impulse: "test-case-1" → input/output pair
    ↓
Result: New activity template + impulses for future improvement
```

### Phase 2: Testing & Validation

```
Goal: "Test dependency-graph-generator with different inputs"
    ↓
Execute: test-activity-variants
    ↓
    [Task 1: Load Test Cases]
    Load impulses: ["test-case-1", "test-case-2", "test-case-3"]
    ↓
    [Task 2: Execute Template with Each Test]
    Load impulse: "template-v1"
    For each test case:
      Execute activity
      Create impulse: "execution-result-N" → result
    ↓
    [Task 3: Compare Results]
    Load impulses: ["execution-result-1", "execution-result-2", "execution-result-3"]
    Analyze success rates, durations, costs
    Create impulse: "test-results-v1" → comparison data
    ↓
Result: Validation data stored as impulses
```

### Phase 3: Iterative Improvement

```
Goal: "Improve dependency-graph-generator based on failures"
    ↓
Execute: improve-activity-variant
    ↓
    [Task 1: Analyze Failures]
    Load impulses: ["template-v1", "test-results-v1"]
    Identify: 20% failure rate, common issue: "validation timeout"
    Create impulse: "failure-analysis-v1" → root causes
    ↓
    [Task 2: Generate Improvements]
    Load impulses: ["template-v1", "failure-analysis-v1"]
    Suggest: Add retry logic, increase validation timeout
    Create impulse: "improvement-suggestions" → proposed changes
    ↓
    [Task 3: Create Variant]
    Load impulses: ["template-v1", "improvement-suggestions"]
    Apply changes to template
    Create impulse: "template-v2" → improved template
    ↓
    [Task 4: Test Variant]
    Load impulses: ["template-v2", "test-case-1", "test-case-2", "test-case-3"]
    Execute v2 with test cases
    Create impulse: "test-results-v2" → new comparison data
    ↓
    [Task 5: Compare Variants]
    Load impulses: ["test-results-v1", "test-results-v2"]
    Compare: v1 (80% success) vs v2 (100% success)
    Create impulse: "variant-comparison" → decision data
    ↓
    [Task 6: Select Best Variant]
    Load impulse: "variant-comparison"
    Decision: v2 is better (higher success rate, lower cost)
    Register: templates/dependency-graph-generator.json (updated to v2)
    Create impulse: "template-current" → pointer to v2
    ↓
Result: Improved activity template, backed by data
```

### Phase 4: Continuous Evolution

```
Every execution creates impulse → Aggregated for analysis → Drives improvement
    ↓
Execute: dependency-graph-generator (100 times over weeks)
    ↓
    Create impulses: "execution-1" ... "execution-100"
    ↓
Periodic: analyze-activity-performance
    ↓
    Load impulses: ["execution-1" ... "execution-100"]
    Detect: 5% failure rate on large repos (>1000 files)
    Create impulse: "performance-analysis" → insights
    ↓
Execute: improve-activity-variant
    ↓
    Load impulses: ["template-v2", "performance-analysis"]
    Suggest: Add file batching for large repos
    Create impulse: "template-v3"
    Test: v3 with large repo test cases
    Create impulse: "test-results-v3"
    Compare: v2 vs v3 → v3 handles large repos better
    Register: v3 as new current
    ↓
Result: Activity continuously improves based on real usage data
```

---

## Impulse-Based Workflow Composition

### Example: Multi-Activity Refactoring Workflow

```typescript
// Activity 1: Audit (creates impulses)
execute(phase1-audit) 
  → impulse: "dependency-graph"
  → impulse: "removal-order"
  → impulse: "breaking-changes"

// Activity 2: Tool Simplification (uses impulses from Activity 1)
execute(phase2-tool-simplification, { 
  impulses: ["removal-order", "breaking-changes"] 
})
  → Loads removal-order (knows what to remove first)
  → Loads breaking-changes (knows what to document)
  → impulse: "simplified-tools" (result)

// Activity 3: Session Removal (uses impulses from Activities 1 & 2)
execute(phase3-session-removal, { 
  impulses: ["removal-order", "simplified-tools"] 
})
  → Loads removal-order (follows safe sequence)
  → Loads simplified-tools (knows what was already removed)
  → impulse: "removed-files" (result)

// Activity 4: Verification (uses all previous impulses)
execute(verify-refactoring, { 
  impulses: ["dependency-graph", "simplified-tools", "removed-files"] 
})
  → Loads all context from previous activities
  → Validates: All removals safe, no broken imports
  → impulse: "verification-report" (final result)
```

**Benefits**:
- No data duplication (impulses are pointers)
- Automatic context loading (on-demand)
- Clear workflow composition (explicit dependencies)
- Token budget control (per impulse)

---

## Template Variant Management with Impulses

### Variant Storage

```typescript
// Store variants as impulses
impulse_create({ id: "template-v1", pointer: { type: "templateDefinition", definition: {...} } })
impulse_create({ id: "template-v2", pointer: { type: "templateDefinition", definition: {...} } })
impulse_create({ id: "template-v3", pointer: { type: "templateDefinition", definition: {...} } })

// Store pointer to current version
impulse_create({ 
  id: "template-current-dependency-graph-generator",
  pointer: { type: "impulseRef", impulseId: "template-v3" }  // Points to v3
})
```

### Variant Comparison

```typescript
// Activity: compare-template-variants
{
  "tasks": [
    {
      "id": "task-1-load-variants",
      "prompt": {
        "template": "Load variants: {{impulse:template-v1}} {{impulse:template-v2}} {{impulse:template-v3}}"
      }
    },
    {
      "id": "task-2-load-execution-data",
      "prompt": {
        "template": "Load execution data:\nv1: {{impulse:executions-v1}}\nv2: {{impulse:executions-v2}}\nv3: {{impulse:executions-v3}}"
      }
    },
    {
      "id": "task-3-compare",
      "prompt": {
        "template": "Compare variants:\n\nMetrics:\n- Success rate\n- Average duration\n- Average cost\n- Common failures\n\nRecommendation: Which variant should be current?"
      }
    }
  ]
}
```

### A/B Testing Activities

```typescript
// Test two variants simultaneously
execute(ab-test-activity-variants, {
  variables: {
    variantA: "template-v2",
    variantB: "template-v3",
    testCases: ["test-case-1", "test-case-2", "test-case-3"]
  },
  impulses: ["template-v2", "template-v3", "test-case-1", "test-case-2", "test-case-3"]
})

// Result: Comparison impulse
impulse_create({
  id: "ab-test-results",
  pointer: {
    type: "memo",
    content: {
      variantA: { successRate: 0.9, avgCost: 0.55, avgDuration: 120000 },
      variantB: { successRate: 1.0, avgCost: 0.42, avgDuration: 95000 },
      recommendation: "variantB",
      reason: "Higher success rate, lower cost, faster"
    }
  }
})
```

---

## Impulse-Driven Ribosome Implementation

### Updated create-activity-from-goal Template

```json
{
  "name": "Create Activity From Goal (Impulse-Driven)",
  "description": "Meta-activity that creates new activity templates from goal execution traces using impulses",
  "category": "meta",
  "tasks": [
    {
      "id": "task-1-parse-goal",
      "prompt": {
        "template": "Parse goal: {{goal}}\n\nOutput JSON with intent, context, outputType.\n\nCreate impulse for next task."
      },
      "outputImpulses": ["goal-parsed"]
    },
    {
      "id": "task-2-search-similar",
      "dependencies": ["task-1-parse-goal"],
      "prompt": {
        "template": "Search for similar activities to: {{impulse:goal-parsed}}\n\nUse search_activities tool.\n\nCreate impulse with results."
      },
      "outputImpulses": ["similar-activities"]
    },
    {
      "id": "task-3-generate-task-sequence",
      "dependencies": ["task-2-search-similar"],
      "prompt": {
        "template": "Generate task sequence for: {{impulse:goal-parsed}}\n\nLearn from: {{impulse:similar-activities}}\n\nOutput task array with dependencies."
      },
      "outputImpulses": ["task-sequence"]
    },
    {
      "id": "task-4-execute-with-recording",
      "dependencies": ["task-3-generate-task-sequence"],
      "prompt": {
        "template": "Execute task sequence: {{impulse:task-sequence}}\n\nRecord all tool calls, prompts, validations.\n\nGoal: {{impulse:goal-parsed}}"
      },
      "outputImpulses": ["execution-trace"]
    },
    {
      "id": "task-5-assemble-template",
      "dependencies": ["task-4-execute-with-recording"],
      "prompt": {
        "template": "Create activity template from: {{impulse:execution-trace}}\n\nInclude:\n- Tasks with prompts\n- Tool calls as examples\n- Validations\n- Variables\n\nOutput ActivityTemplate JSON."
      },
      "outputImpulses": ["template-v1"]
    },
    {
      "id": "task-6-validate-against-patterns",
      "dependencies": ["task-5-assemble-template"],
      "prompt": {
        "template": "Validate template: {{impulse:template-v1}}\n\nAgainst similar: {{impulse:similar-activities}}\n\nCheck:\n- Task dependencies valid\n- Prompts clear\n- Validations comprehensive\n\nOutput validation result."
      },
      "outputImpulses": ["validation-result"]
    },
    {
      "id": "task-7-create-test-case",
      "dependencies": ["task-6-validate-against-patterns"],
      "prompt": {
        "template": "Create test case from execution:\n\nInput: {{impulse:goal-parsed}}\nOutput: {{impulse:execution-trace}}\n\nStore as test-case-1 impulse."
      },
      "outputImpulses": ["test-case-1"]
    },
    {
      "id": "task-8-register",
      "dependencies": ["task-7-create-test-case"],
      "prompt": {
        "template": "Register template if validation passed: {{impulse:validation-result}}\n\nTemplate: {{impulse:template-v1}}\nTest: {{impulse:test-case-1}}\n\nSave to templates/{{templateName}}.json"
      },
      "validation": {
        "requiredFiles": ["templates/{{templateName}}.json"]
      }
    }
  ]
}
```

**Key Changes**:
- Each task creates **output impulses**
- Next tasks load impulses via `{{impulse:id}}`
- No data duplication between tasks
- Clear data flow via impulse dependencies

---

## Benefits of Impulse-Driven Architecture

### 1. Lazy Loading (Token Efficiency)

```typescript
// Without impulses (eager, wasteful):
const hugeData = readFile("large-trace.json")  // 50 KB
const prompt = `Analyze this: ${hugeData}`  // 50 KB in context
// Problem: Might only need 5 KB of that data

// With impulses (lazy, efficient):
impulse_create({ id: "trace", pointer: { type: "file", path: "large-trace.json" }, budget: 5000 })
const prompt = `Analyze this: {{impulse:trace}}`
// → Loader extracts relevant 5 KB section
// → 90% token savings
```

### 2. Automatic Composition

```typescript
// Activity calls another activity via impulse:
task.prompt = "Use dependency graph: {{impulse:dep-graph}}"

// Impulse loader checks:
if (impulseCache.has("dep-graph")) {
  return impulseCache.get("dep-graph")  // Use cached
} else {
  // Execute activity that creates it
  const result = await execute("generate-dependency-graph")
  impulseCache.set("dep-graph", result)
  return result
}
// → Automatic activity chaining, no manual orchestration
```

### 3. Variant Testing

```typescript
// Test 3 variants with same test cases (all loaded as impulses):
const results = []
for (const variant of ["v1", "v2", "v3"]) {
  const result = await execute(`template-${variant}`, { 
    impulses: ["test-case-1", "test-case-2", "test-case-3"] 
  })
  results.push({ variant, result })
}

// Compare results (all data already in impulses):
impulse_create({ id: "comparison", pointer: { type: "memo", content: results } })
```

### 4. Versioned Data Flow

```typescript
// Store each execution as versioned impulse:
impulse_create({ id: "execution-1", ... })
impulse_create({ id: "execution-2", ... })
impulse_create({ id: "execution-3", ... })

// Aggregate for analysis:
task.prompt = "Analyze trends across executions: {{impulse:execution-1}} {{impulse:execution-2}} {{impulse:execution-3}}"

// → Time-series analysis of activity performance
// → Detect degradation or improvement over time
```

---

## Next Steps: Implement Impulse-Driven Ribosome

### 1. Enhance Impulse System

**File**: `repos/minibob/src/impulse.ts`

Add:
- `outputImpulses` field in TaskResult
- Automatic impulse creation from task outputs
- Impulse loader with budget enforcement
- Cache management for impulses

### 2. Update Activity Executor

**File**: `repos/minibob/src/activity.ts`

Add:
- Load impulses before task execution
- Substitute `{{impulse:id}}` in prompts
- Create output impulses after task completion
- Store impulses in execution trace

### 3. Create Meta-Activity Template

**File**: `repos/minibob/templates/create-activity-from-goal.json`

Implement:
- Impulse-driven task chain
- Output impulses at each step
- Validation using similar activity impulses
- Registration with test case impulses

### 4. Create Improvement Activity

**File**: `repos/minibob/templates/improve-activity-variant.json`

Implement:
- Load variant impulses
- Load execution data impulses
- Generate improvement suggestions
- Create new variant
- Test and compare variants

### 5. Test the Loop

```bash
# 1. Create initial activity from goal
bun run index.ts run templates/create-activity-from-goal.json \
  --var goal="Generate TypeScript interfaces from JSON schemas" \
  --var templateName="generate-typescript-interfaces"

# Result: templates/generate-typescript-interfaces.json + impulses created

# 2. Test the activity
bun run index.ts run templates/generate-typescript-interfaces.json \
  --var schemaFile="test.json"

# Result: Creates impulse "execution-1"

# 3. Improve based on failures
bun run index.ts run templates/improve-activity-variant.json \
  --var templateId="generate-typescript-interfaces" \
  --impulses execution-1,execution-2,execution-3

# Result: Creates template v2 with improvements
```

---

## Conclusion

**Impulses are the key to the ribosome architecture**:

1. ✅ **Lazy loading** → Token efficiency (90% reduction)
2. ✅ **Automatic composition** → Activities call activities via impulses
3. ✅ **Variant testing** → Compare versions using impulse data
4. ✅ **Iterative improvement** → Data-driven evolution via impulse analysis
5. ✅ **Version control** → Each execution stored as impulse for future learning

The ribosome creates activities by:
- Executing goal with recording
- Storing trace as impulse
- Assembling template from trace impulse
- Creating test case impulses
- Registering for reuse

Each execution creates impulses, feeding the improvement loop, creating better variants, infinitely evolving.

**Status**: Architecture complete with impulse integration, ready to implement.
