# Activity Template Registration and Learning System

## How Registration Works Now

### Architecture Overview

```
Agent creates template JSON
  ↓
register_activity_template tool
  ↓
TemplateLoader.save()
  ↓
TemplateServiceClient.registerTemplate()
  ↓
MetabobAPI (HTTP) → Metabob Backend (SurrealDB)
  ↓
Template registered and discoverable
  ↓
TemplateCache.put() (5-min TTL cache)
```

### Detailed Registration Flow

#### 1. Template Creation (Agent Task)

The `create-activity-template` activity has two tasks:

**Task 1: `create-and-register-template`**
- Agent designs template following schema
- Writes JSON file to working directory
- Example: `my-template.json`

**Task 2: `register-template`**
```typescript
// Agent uses register_activity_template tool
register_activity_template({
  file_path: "my-template.json",
  register_with_metabob: true  // Default
})
```

#### 2. Registration Process (register_activity_template tool)

**File**: `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts`

```typescript
// Simplified flow:
1. Load template JSON from file
2. Parse with ActivityTemplate.CreateOptions schema
3. Generate template ID from name (e.g., "My Template" → "my-template")
4. Create full ActivityTemplate.Schema
5. Call TemplateRepository.save(template)
```

#### 3. Save to Backend (TemplateRepository)

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`

```typescript
export async function save(template: ActivityTemplate.Schema): Promise<void> {
  // Always save to Metabob backend (single source of truth)
  await TemplateLoader.save(template)
  
  log.debug("save completed", { id: template.id })
}
```

#### 4. Backend Communication (TemplateLoader)

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`

```typescript
export async function save(template: ActivityTemplate.Schema): Promise<void> {
  // Save to Metabob TemplateService (single source of truth)
  const result = await TemplateServiceClient.registerTemplate({
    template,
    overwrite: false  // Fail if already exists
  })
  
  if (!result.success) {
    throw new Error(result.error || "Failed to save template")
  }
  
  // Update in-memory cache
  TemplateCache.put(template)
}
```

#### 5. HTTP API Call (TemplateServiceClient)

**File**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts`

```typescript
export async function registerTemplate(
  options: RegisterTemplateOptions
): Promise<RegisterTemplateResult> {
  try {
    // Use direct HTTP API (first-party integration)
    const result = await MetabobAPI.registerActivityTemplate(options.template)
    
    if (result.success) {
      return {
        success: true,
        templateId: options.template.id,
        version: result.version
      }
    }
    
    // Fallback to MCP if HTTP fails
    const mcpResult = await MetabobCLI.registerActivityTemplate(options.template)
    return mcpResult
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}
```

#### 6. Storage in SurrealDB

**Backend**: `metabob-rpc-api` → SurrealDB

```sql
-- Template stored in activity_templates table
{
  id: "my-template",
  version: 1,
  name: "My Template",
  description: "...",
  category: "feature",
  tasks: [...],
  executions: 0,        // Initial
  successRate: 0.5,     // Initial (uniform prior)
  avgDuration: 0,       // Will be updated
  avgCost: 0,           // Will be updated
  avgTokens: {...},     // Will be updated
  created_at: "2026-02-05T...",
  updated_at: "2026-02-05T..."
}
```

---

## How create-activity-template Ensures Registration

### Task Structure

The template has **2 sequential tasks** with explicit dependencies:

```json
{
  "tasks": [
    {
      "id": "create-and-register-template",
      "description": "Design and write template to file",
      "dependencies": [],
      "validation": {
        "requiredPatterns": ["\"name\":", "\"category\":", "\"tasks\":"],
        "commands": [
          {
            "name": "verify-json-created",
            "command": "ls -la *.json 2>/dev/null | head -5",
            "required": false
          }
        ]
      }
    },
    {
      "id": "register-template",
      "description": "Register created template with Metabob backend and verify",
      "dependencies": ["create-and-register-template"],  // ← Must wait for task 1
      "prompt": {
        "template": "Register the created template file...\n\n**Registration Steps**:\n\n1. Find template file (*.json)\n2. Use register_activity_template tool\n3. Verify with search_activities\n\n**Error Handling**:\n- If register fails: Report error clearly, FAIL the task\n- If verification fails: Report what was found vs expected\n- Do NOT use || true to hide failures\n- Let the activity fail visibly so issues are caught"
      },
      "validation": {
        "commands": []
      }
    }
  ]
}
```

### Verification Step

Task 2 explicitly verifies registration:

```typescript
// In task 2 prompt:
const results = await search_activities({
  query: "{{templateName}}",
  category: "{{category}}",
  verbose: false
})

// Check if template found
if (results.activities.some(a => a.id === '{{templateId}}')) {
  console.log('✓ Template successfully registered and discoverable')
} else {
  throw new Error('Template registration failed - not found in search')
}
```

### Integration Hooks

```json
{
  "integration": {
    "postChecks": ["search_activities({ verbose: false })"],
    "qualityGates": [
      {
        "name": "template-valid-json",
        "command": "for f in *.json; do [ -f \"$f\" ] && jq empty \"$f\" || true; done",
        "required": true
      }
    ]
  }
}
```

### Working Directory Management

```json
{
  "hooks": {
    "preActivity": {
      "workingDirectory": {
        "type": "temporary",        // Isolated temporary directory
        "prefix": "activity-template-",
        "cleanup": "onSuccess"      // Clean up after registration
      }
    },
    "postActivity": {
      "cleanup": true               // Remove temp files
    }
  }
}
```

**Benefits**:
- Templates never pollute local filesystem
- Registration forces backend storage
- Cleanup ensures no orphaned files
- Temporary isolation prevents conflicts

---

## How Templates Succeed More Often (Learning System)

### Bayesian Learning Loop

#### 1. Initial State (New Template)

When a template is first registered:

```typescript
{
  executions: 0,
  successRate: 0.5,  // Uniform prior (50% expected success)
  avgDuration: 0,
  avgCost: 0,
  avgTokens: { input: 0, output: 0, cache: 0 }
}
```

#### 2. After Each Execution

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

```typescript
async function updateTemplateMetrics(
  template: ActivityTemplate.Schema,
  result: ExecutionResult
): Promise<void> {
  const executions = template.executions + 1
  const successCount = template.successRate * template.executions + (result.success ? 1 : 0)
  
  await ActivityTemplate.update(template.id, {
    executions,
    successRate: successCount / executions,  // ← Bayesian update
    avgDuration: (template.avgDuration * template.executions + result.totalDuration) / executions,
    avgCost: (template.avgCost * template.executions + result.totalCost) / executions,
    avgTokens: {
      input: (template.avgTokens.input * template.executions + result.totalTokens.input) / executions,
      output: (template.avgTokens.output * template.executions + result.totalTokens.output) / executions,
      cache: (template.avgTokens.cache * template.executions + result.totalTokens.cache) / executions,
    }
  })
}
```

#### 3. Success Rate Evolution

**Example**: Template with 10 executions

```
Execution  | Result   | Success Count | Success Rate
-----------|----------|---------------|-------------
Initial    | -        | 0             | 0.50 (prior)
1          | success  | 1             | 1/1  = 1.00
2          | success  | 2             | 2/2  = 1.00
3          | failure  | 2             | 2/3  = 0.67
4          | success  | 3             | 3/4  = 0.75
5          | success  | 4             | 4/5  = 0.80
6          | success  | 5             | 5/6  = 0.83
7          | failure  | 5             | 5/7  = 0.71
8          | success  | 6             | 6/8  = 0.75
9          | success  | 7             | 7/9  = 0.78
10         | success  | 8             | 8/10 = 0.80

Final: 80% success rate, high confidence (10 samples)
```

#### 4. Metrics Tracked

**Per Execution**:
```typescript
interface ExecutionResult {
  success: boolean           // Overall pass/fail
  totalDuration: number      // Milliseconds
  totalCost: number          // USD
  totalTokens: {
    input: number           // Prompt tokens
    output: number          // Completion tokens
    cache: number           // Cached tokens
  }
  tasks: TaskExecution[]    // Per-task breakdown
}
```

**Aggregated**:
```typescript
interface TemplateMetrics {
  executions: number         // Total runs
  successRate: number        // 0.0 - 1.0
  avgDuration: number        // Average milliseconds
  avgCost: number            // Average USD
  avgTokens: {
    input: number           // Average prompt tokens
    output: number          // Average completion tokens
    cache: number           // Average cached tokens
  }
}
```

#### 5. Ranking in Search Results

**File**: `repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts`

Templates are ranked by:
1. **Success rate** (primary)
2. **Execution count** (confidence)
3. **Query relevance** (semantic)
4. **Cost efficiency** (secondary)

```typescript
// Simplified ranking algorithm
function rankTemplates(templates: Template[]): Template[] {
  return templates.sort((a, b) => {
    // Primary: Success rate (higher is better)
    if (Math.abs(a.successRate - b.successRate) > 0.1) {
      return b.successRate - a.successRate
    }
    
    // Secondary: Execution count (more data = higher confidence)
    if (a.executions !== b.executions) {
      return b.executions - a.executions
    }
    
    // Tertiary: Cost (lower is better, if similar success)
    return a.avgCost - b.avgCost
  })
}
```

---

## How to Make create-activity-template Succeed More Often

### Current Success Rate Analysis

**Factors that lead to success**:
1. ✅ Agent studies example templates first
2. ✅ Agent validates JSON structure before registration
3. ✅ Agent uses appropriate subagent assignments
4. ✅ Agent includes comprehensive validation rules

**Factors that lead to failure**:
1. ❌ Skipping example review → schema violations
2. ❌ Creating too many tasks (>7) → reduced composability
3. ❌ Missing validation rules → failed executions
4. ❌ Incorrect agent assignment → capability mismatches

### Optimization Strategy

#### 1. Improve Context Injection

**File**: Line 6-20 in `create-activity-template.json`

```json
{
  "contextRequirements": [
    {
      "key": "templateExamples",
      "hint": "Use search_activities tool to find 2-3 existing activity templates as examples",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [3000, 6000]
    }
  ]
}
```

**Optimization**: Increase example quality and quantity
```json
{
  "contextRequirements": [
    {
      "key": "highQualityExamples",
      "hint": "Use search_activities to find 3 templates with >80% success rate from the same category as the target template",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [4000, 8000]  // More context for better examples
    },
    {
      "key": "failurePatterns",
      "hint": "Fetch common failure patterns from Metabob annotations for similar templates",
      "impulseTypes": ["metabobAnnotation"],
      "required": false,
      "budgetRange": [2000, 4000]
    }
  ]
}
```

#### 2. Add Validation Checkpoints

**Current**: Validation only checks JSON syntax

**Improvement**: Add semantic validation

```json
{
  "tasks": [
    {
      "id": "create-and-register-template",
      "validation": {
        "requiredPatterns": [
          "\"name\":",
          "\"category\":",
          "\"tasks\":",
          "\"validation\":",  // ← NEW: Ensure tasks have validation
          "\"retry\":"        // ← NEW: Ensure tasks have retry logic
        ],
        "forbiddenPatterns": [
          "\"subagent\": \"undefined\"",  // ← NEW: Catch invalid agents
          "\"maxTokens\": 0"              // ← NEW: Catch invalid budgets
        ],
        "commands": [
          {
            "name": "validate-schema",
            "command": "jq -e '.tasks | length > 0 and length <= 7' *.json",  // ← NEW: Task count check
            "required": true
          },
          {
            "name": "validate-dependencies",
            "command": "jq -e '.tasks | map(.dependencies // []) | all(. as $deps | all($deps[]; . as $dep | any(.tasks[]; .id == $dep)))' *.json",  // ← NEW: Dependency check
            "required": true
          }
        ]
      }
    }
  ]
}
```

#### 3. Feedback Loop (Learning Section)

**File**: Lines 209-248 in `create-activity-template.json`

The template already has a learning section:

```json
{
  "learning": {
    "enabled": true,
    "feedbackPoints": [
      {
        "taskId": "create-and-register-template",
        "metrics": {
          "template_valid": "Was generated template valid JSON? (boolean)",
          "registration_success": "Did registration succeed? (boolean)",
          "tasks_count": "Number of tasks in template (number)",
          "used_examples": "Did agent reference provided examples? (boolean)"
        }
      }
    ],
    "patterns": {
      "successPatterns": [
        "Agent studies examples before designing",
        "Agent creates task graph visualization first",
        "Agent validates JSON structure before registration"
      ],
      "failurePatterns": [
        "Skipping example review leads to schema violations",
        "Creating too many tasks (>7) reduces composability",
        "Missing validation rules leads to failed executions"
      ]
    }
  }
}
```

**How to use this for improvement**:

1. **After each execution**, Metabob records:
   - Did the template validate?
   - Did registration succeed?
   - Were examples used?

2. **Aggregate across executions**:
   - Executions where `used_examples=true` have higher success rates
   - Executions with `tasks_count <= 5` have higher success rates
   - Executions with comprehensive validation succeed more

3. **Evolve the template**:
   ```typescript
   // After 20+ executions, if data shows:
   // - Success rate: 65%
   // - Failures mostly from: skipping examples (40%), too many tasks (30%)
   
   // Create evolved version:
   await evolve_activity_template({
     parent_id: "create-activity-template",
     changes: {
       tasks: [
         {
           id: "create-and-register-template",
           prompt: {
             // NEW: Stronger emphasis on examples
             template: "CRITICAL: Study the provided template examples thoroughly before designing...\n\nDo NOT proceed without understanding the example patterns.\n\n..."
           },
           validation: {
             // NEW: Enforce task count limit
             commands: [
               {
                 name: "enforce-task-limit",
                 command: "jq -e '.tasks | length <= 5' *.json",
                 required: true
               }
             ]
           }
         }
       ]
     },
     evolution_note: "Increased emphasis on example usage and enforced task count limit based on failure analysis showing 70% of failures from these two issues",
     evolution_type: "optimized"
   })
   ```

#### 4. A/B Testing Different Prompt Strategies

**Current**: Single template version

**Improvement**: Create variants and let Thompson Sampling select best

```typescript
// Variant A: Explicit examples in prompt
const variantA = {
  name: "Create Activity Template (Example-Heavy)",
  tasks: [{
    prompt: {
      template: "Study these examples first:\n\n[inject 3 full templates]\n\nNow design your template..."
    }
  }]
}

// Variant B: Discovery-based examples
const variantB = {
  name: "Create Activity Template (Discovery-Based)",
  tasks: [{
    prompt: {
      template: "Use search_activities to find 3 relevant examples. Study them, then design..."
    }
  }]
}

// Variant C: Scaffolding approach
const variantC = {
  name: "Create Activity Template (Scaffolded)",
  tasks: [
    { id: "study-examples", ... },
    { id: "design-task-graph", ... },
    { id: "write-json", ... },
    { id: "validate-schema", ... },
    { id: "register", ... }
  ]
}

// Thompson Sampling automatically:
// - Tries all variants with exploration parameter (10%)
// - Measures success rates
// - Gradually favors high-performing variants
// - After 50+ executions, best variant emerges
```

---

## Concrete Improvements to Implement

### 1. Enhanced Validation (Week 1)

**Add to Task 1**:
```json
{
  "validation": {
    "requiredPatterns": [
      "\"validation\":",    // All tasks need validation
      "\"retry\":"          // All tasks need retry config
    ],
    "forbiddenPatterns": [
      "\"maxTokens\": 0",
      "\"subagent\": \"\"",
      "TODO"                // No TODOs in production templates
    ],
    "commands": [
      {
        "name": "schema-validation",
        "command": "jq -e '.tasks | length > 0 and length <= 7' *.json",
        "required": true
      },
      {
        "name": "dependency-graph-valid",
        "command": "python3 scripts/validate-task-graph.py *.json",
        "required": true
      }
    ]
  }
}
```

### 2. Better Example Selection (Week 2)

**Modify contextRequirements**:
```json
{
  "contextRequirements": [
    {
      "key": "highQualityExamples",
      "hint": "search_activities with category={{category}}, sort by successRate DESC, limit 3, filter executions >= 10",
      "impulseTypes": ["toolOutput"],
      "required": true,
      "budgetRange": [5000, 10000]
    }
  ]
}
```

### 3. Incremental Success Tracking (Week 3)

**Add metrics collection**:
```typescript
// In TemplateExecutor, after each task:
await MetabobAPI.recordTaskMetrics({
  activityId: activity.id,
  templateId: template.id,
  taskId: task.id,
  success: taskResult.success,
  duration: taskResult.duration,
  cost: taskResult.cost,
  patterns: {
    used_examples: taskResult.output.includes("studied examples"),
    validated_schema: taskResult.output.includes("jq"),
    task_count: JSON.parse(taskResult.files["template.json"]).tasks.length
  }
})
```

### 4. Automated Template Evolution (Week 4)

**Scheduled job** (runs weekly):
```typescript
// Check all templates with 20+ executions
const templates = await TemplateRepository.list()

for (const template of templates) {
  if (template.executions >= 20 && template.successRate < 0.75) {
    // Analyze failure patterns
    const failures = await MetabobAPI.getFailurePatterns(template.id)
    
    // Generate optimization suggestions
    const suggestions = analyzeFailures(failures)
    
    // Create evolved variant
    if (suggestions.length > 0) {
      await createEvolvedVariant(template, suggestions)
    }
  }
}
```

---

## Summary

### Registration Flow

1. Agent writes JSON → 2. register_activity_template tool → 3. TemplateLoader.save() → 4. TemplateServiceClient.registerTemplate() → 5. MetabobAPI → 6. SurrealDB

**Key point**: Backend (SurrealDB) is single source of truth. No local storage.

### Success Improvement

1. **Execution tracking**: Every run updates metrics (success rate, cost, duration, tokens)
2. **Bayesian learning**: Success rate converges to true probability with more data
3. **Ranking**: Search results favor high success rate + high confidence (execution count)
4. **Evolution**: Templates can spawn optimized variants based on failure analysis

### How create-activity-template Succeeds

- **Task 2 validates** registration with search_activities
- **Quality gates** check JSON validity
- **Learning section** tracks what works (examples, validation, task count)
- **Future optimizations** based on aggregated failure patterns

### Making It Better

1. ✅ Enhanced validation (schema, dependencies, task count)
2. ✅ Better example selection (high success rate, same category)
3. ✅ Incremental tracking (per-task metrics, pattern detection)
4. ✅ Automated evolution (weekly analysis, variant generation)

The system is **already designed to learn and improve**. The key is feeding it more execution data and using that data to evolve templates systematically.
