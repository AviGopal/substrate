# MiniBob Verification Test Suite

**Purpose**: Comprehensive external verification of MiniBob and MiniBob+OpenCode integration capabilities

**Architecture**: Tests execute against real Kubernetes deployment (`api.minibob.local`, `dashboard.minibob.local`)

---

## Test Environment

### Prerequisites
```bash
# 1. Kubernetes cluster running (docker-desktop)
kubectl config current-context  # Should show: docker-desktop

# 2. Services healthy
kubectl get pods -n activity-system  # minibob pod Running
kubectl get pods -n metabob         # surrealdb, redis Running

# 3. Backend API accessible
curl http://api.minibob.local/health  # Should return {"status":"healthy"}

# 4. Dashboard accessible
curl http://dashboard.minibob.local   # Should return HTML

# 5. Bun runtime installed
bun --version  # Required for minibob execution
```

### Test Directory Structure
```
test-minibob-verification/
├── README.md                          # This file
├── setup.ts                           # Test environment setup
├── utils/
│   ├── minibob-executor.ts           # Standalone minibob execution
│   ├── opencode-executor.ts          # OpenCode + minibob execution
│   ├── backend-client.ts             # Direct backend API calls
│   └── assertions.ts                 # Verification helpers
├── tests/
│   ├── 01-goal-seeking-improvisation.ts
│   ├── 02-activity-selection.ts
│   ├── 03-impulse-integration.ts
│   ├── 04-insitu-debugging.ts
│   ├── 05-posthoc-improvement.ts
│   └── 06-activity-composition.ts
├── fixtures/
│   ├── novel-goal.json               # Goal with no matching templates
│   ├── ambiguous-goal.json           # Goal with multiple candidates
│   ├── impulse-chain.json            # Impulse context data
│   └── failing-activity.json         # Activity for debugging tests
└── results/
    └── <test-run-timestamp>/
        ├── execution-logs.txt
        ├── activity-traces.json
        ├── dashboard-screenshots/
        └── verification-report.md
```

---

## Test 1: Goal-Seeking Improvisation

**Objective**: Verify MiniBob can create new activities when no existing templates match the goal

**Mechanism**: 
- GoalProcessor receives novel goal
- No matching templates from Thompson Sampling
- Triggers improvisation via `MCPActivityBridge.createActivity()`
- Backend creates new template via `/v2/activities/create-goal-seeking`
- Template executed immediately

**Test Script**: `tests/01-goal-seeking-improvisation.ts`

### Test Case 1.1: Novel Feature Request
```typescript
// Input
const goal = "Create a fizzbuzz validator that checks if outputs are correct"
const context = { programmingLanguage: "typescript" }

// Expected Behavior
// 1. GoalProcessor.getRecommendations() → returns 0 results (no matching templates)
// 2. GoalProcessor detects empty recommendations
// 3. MCPActivityBridge.createActivity() called with:
//    - goalDescription: "Create a fizzbuzz validator..."
//    - templateName: "improvised-feature-<timestamp>"
//    - category: "feature"
//    - constraints: { maxTasks: 5, maxCost: <remaining>, preferComposition: true }
// 4. Backend decomposes goal into tasks
// 5. Template registered in SurrealDB
// 6. ActivityExecutor loads and executes template
// 7. Execution tracked in backend

// Verification
assert(result.executions.length === 1, "Should execute improvised activity")
assert(result.executions[0].templateId.startsWith("improvised-"), "Should use improvised template")

const template = await backend.getTemplate(result.executions[0].templateId)
assert(template.metadata.generatedFrom === "goal-seeking", "Should have goal-seeking metadata")
assert(template.tasks.length >= 2, "Should decompose into multiple tasks")
```

### Test Case 1.2: Improvisation After Failures
```typescript
// Input
const goal = "Fix authentication timeout bug in legacy auth system"
const context = { files: ["auth/legacy-auth.ts"] }

// Simulate 2 existing templates that fail
// - "fix-auth-timeout-v1" → fails validation
// - "fix-auth-timeout-v2" → fails execution

// Expected Behavior
// 1. Iteration 1: Execute "fix-auth-timeout-v1" → fails
// 2. Iteration 2: Execute "fix-auth-timeout-v2" → fails
// 3. Iteration 3: No untried recommendations
// 4. Trigger improvisation
// 5. Create "improvised-bugfix-<timestamp>"
// 6. Execute improvised template
// 7. hasAttemptedImprovisation = true (prevent infinite loop)

// Verification
assert(result.executions.length === 3, "Should try 2 existing + 1 improvised")
assert(result.executions[2].templateId.startsWith("improvised-"), "Third should be improvised")

const dashboard = await getDashboardData()
assert(dashboard.failedAttempts.length === 2, "Should track failed attempts")
```

### Test Case 1.3: Improvisation Constraints
```typescript
// Input
const goal = "Build complete e-commerce platform"
const options = { maxCost: 2.0 }  // Low budget

// Expected Behavior
// Improvisation should respect constraints:
// - constraints.maxCost = Math.max(1.0, maxCost - totalCost)
// - constraints.maxTasks ≤ 5 (prevent runaway)
// - constraints.preferComposition = true (reuse existing)

// Verification
const improvisedTemplate = await backend.getTemplate(templateId)
assert(improvisedTemplate.tasks.length <= 5, "Should respect task limit")

// Check if tasks reference existing activities (composition)
const hasComposition = improvisedTemplate.tasks.some(task => 
  task.prompt.template.includes("execute activity") || 
  task.impulseReferences?.some(ref => ref.includes("activityOutput"))
)
assert(hasComposition, "Should prefer composition")
```

### Execution
```bash
cd test-minibob-verification
bun run tests/01-goal-seeking-improvisation.ts

# Expected Output:
# ✅ Test 1.1: Novel Feature Request - PASS
# ✅ Test 1.2: Improvisation After Failures - PASS
# ✅ Test 1.3: Improvisation Constraints - PASS
# 
# Dashboard URL: http://dashboard.minibob.local
# Execution Traces: results/<timestamp>/traces/
```

---

## Test 2: Activity Execution and Selection

**Objective**: Verify Thompson Sampling selects relevant activities and filters irrelevant ones

**Mechanism**:
- Backend analyzes goal → returns ranked recommendations
- Thompson Sampling uses success rates (alpha, beta parameters)
- GoalProcessor filters by relevance
- Irrelevant activities never executed

**Test Script**: `tests/02-activity-selection.ts`

### Test Case 2.1: Relevance Filtering
```typescript
// Setup: Seed backend with templates
await backend.registerTemplate({
  id: "add-user-profile-feature",
  category: "feature",
  // ... success_rate: 0.85
})

await backend.registerTemplate({
  id: "fix-database-migration-bug",
  category: "bugfix",
  // ... success_rate: 0.90
})

await backend.registerTemplate({
  id: "refactor-authentication-module",
  category: "refactor",
  // ... success_rate: 0.75
})

// Input
const goal = "Add user profile page with avatar upload"

// Expected Behavior
// 1. Backend receives goal → extracts intent: "add user profile"
// 2. Thompson Sampling ranks:
//    - "add-user-profile-feature" → HIGH (relevant + high success)
//    - "fix-database-migration-bug" → LOW (irrelevant)
//    - "refactor-authentication-module" → MEDIUM (somewhat related)
// 3. Returns ranked: ["add-user-profile-feature", "refactor-authentication-module"]
// 4. GoalProcessor executes only "add-user-profile-feature"

// Verification
assert(result.executions.length === 1, "Should execute 1 relevant activity")
assert(result.executions[0].templateId === "add-user-profile-feature")

const recommendations = await backend.getRecommendations(goal)
assert(!recommendations.some(r => r.template_id === "fix-database-migration-bug"), 
  "Should filter irrelevant activities")
```

### Test Case 2.2: Thompson Sampling Exploration vs Exploitation
```typescript
// Setup: Create variant activities
await backend.registerTemplate({
  id: "add-api-endpoint-v1",
  // success: 10, failures: 2 → alpha=11, beta=3 (proven)
})

await backend.registerTemplate({
  id: "add-api-endpoint-v2",
  // success: 1, failures: 0 → alpha=2, beta=1 (new, promising)
})

// Input
const goal = "Add GET /api/users/:id endpoint"

// Execute 10 times to observe Thompson Sampling behavior
const selections = []
for (let i = 0; i < 10; i++) {
  const result = await minibob.executeGoal(goal, {})
  selections.push(result.executions[0].templateId)
}

// Expected Behavior
// Thompson Sampling should:
// - Mostly select "v1" (proven success rate)
// - Occasionally select "v2" (exploration)
// - Balance exploration vs exploitation

// Verification
const v1Count = selections.filter(id => id === "add-api-endpoint-v1").length
const v2Count = selections.filter(id => id === "add-api-endpoint-v2").length

assert(v1Count >= 6, "Should prefer proven template (exploitation)")
assert(v2Count >= 1, "Should explore new template occasionally")
assert(v2Count <= 4, "Should not over-explore")
```

### Test Case 2.3: Context-Aware Selection
```typescript
// Input
const goal = "Fix authentication bug"
const impulses = [
  { id: "error-log", pointer: { type: "memo", content: "JWT expired error in login flow" } },
  { id: "related-code", pointer: { type: "file", path: "auth/jwt-verify.ts" } }
]

// Expected Behavior
// Backend should use impulse context to refine recommendations:
// - Analyze error log → JWT expiration issue
// - Check file path → jwt-verify.ts
// - Recommend templates that handle JWT expiration specifically

// Verification
const recommendations = await backend.getRecommendations(goal, impulses.map(i => i.id))
assert(recommendations[0].template_id.includes("jwt") || 
       recommendations[0].template_id.includes("token"), 
  "Should recommend JWT-specific templates")
```

### Execution
```bash
bun run tests/02-activity-selection.ts

# Expected Output:
# ✅ Test 2.1: Relevance Filtering - PASS
# ✅ Test 2.2: Thompson Sampling Exploration - PASS (v1: 7, v2: 3)
# ✅ Test 2.3: Context-Aware Selection - PASS
```

---

## Test 3: Impulse System Integration

**Objective**: Verify impulses work as context in prompts AND as data passed to tools/executions

**Mechanism**:
- Impulses loaded with lazy evaluation
- Local impulses (memo, file) resolved by minibob
- Backend impulses (activityOutput, etc.) resolved via MCP
- Formatted into LLM context with token budgets
- Available to tools via ImpulseStore

**Test Script**: `tests/03-impulse-integration.ts`

### Test Case 3.1: Impulse as Context in Task Prompt
```typescript
// Setup: Create activity with impulse references
const template = {
  id: "test-impulse-context",
  tasks: [{
    id: "analyze-error",
    prompt: {
      template: `
Analyze this error log and suggest a fix:

{{#impulse error-log}}

Context from previous execution:
{{#impulse previous-fix-attempt}}

Provide specific code changes.
      `,
      variables: []
    },
    impulseReferences: ["error-log", "previous-fix-attempt"]
  }]
}

// Input
const impulses = [
  {
    id: "error-log",
    pointer: { type: "memo", content: "TypeError: Cannot read property 'user' of null at auth.ts:42" },
    budget: 500,
    priority: "critical"
  },
  {
    id: "previous-fix-attempt",
    pointer: { type: "activityOutput", activityId: "prev-execution-123", taskId: "task-1" },
    budget: 1000,
    priority: "high"
  }
]

// Expected Behavior
// 1. Task executor loads impulses before prompt formatting
// 2. Local impulse "error-log" → resolve directly (in-memory)
// 3. Backend impulse "previous-fix-attempt" → call MCP impulse_get_content
// 4. Format both into prompt within token budgets
// 5. LLM receives complete context

// Verification
const execution = await minibob.execute({ template, impulses })
const taskResult = execution.taskResults[0]

// Check impulse loading
assert(taskResult.impulses["error-log"].loaded === true)
assert(taskResult.impulses["error-log"].content.includes("TypeError"))

assert(taskResult.impulses["previous-fix-attempt"].loaded === true)
assert(taskResult.impulses["previous-fix-attempt"].tokenCount <= 1000)

// Check prompt formatting
const promptSent = taskResult.llmMessages[0].content
assert(promptSent.includes("TypeError: Cannot read property"))
assert(promptSent.includes("Context from previous execution"))
```

### Test Case 3.2: Impulse as Tool Data
```typescript
// Setup: Activity that uses tool with impulse data
const template = {
  id: "test-impulse-tool-data",
  tasks: [{
    id: "apply-fix",
    prompt: {
      template: `
Apply the fix from the previous execution using the edit tool.

The file path is: {{filePath}}

Use the edit tool with the changes from impulse "suggested-changes".
      `,
      variables: [{ name: "filePath", type: "string", required: true }]
    },
    impulseReferences: ["suggested-changes"]
  }]
}

// Input
const impulses = [
  {
    id: "suggested-changes",
    pointer: { 
      type: "activityOutput", 
      activityId: "analysis-123", 
      taskId: "generate-patch",
      outputKey: "patch"
    },
    budget: 2000,
    priority: "critical"
  }
]

// Expected Behavior
// 1. LLM analyzes impulse "suggested-changes"
// 2. LLM calls edit tool with:
//    - filePath from variable
//    - oldString/newString from impulse content
// 3. Tool execution uses impulse data

// Verification
const execution = await minibob.execute({ 
  template, 
  variables: { filePath: "auth.ts" },
  impulses 
})

const toolCalls = execution.taskResults[0].toolCalls
assert(toolCalls.some(call => call.name === "edit"), "Should call edit tool")

const editCall = toolCalls.find(call => call.name === "edit")
assert(editCall.parameters.filePath === "auth.ts")
// Changes should come from impulse
assert(editCall.parameters.oldString.includes("<code from impulse>"))
```

### Test Case 3.3: Impulse Chain (Activity → Impulse → Activity)
```typescript
// Scenario: Multi-activity workflow with data passing

// Activity 1: Analyze code
const analyzeTemplate = {
  id: "analyze-bug",
  tasks: [{
    id: "find-root-cause",
    prompt: { template: "Analyze {{file}} and identify root cause", variables: [] },
    outputImpulses: ["root-cause-analysis"]  // Create impulse from output
  }]
}

// Activity 2: Generate fix (uses impulse from Activity 1)
const fixTemplate = {
  id: "generate-fix",
  tasks: [{
    id: "create-patch",
    prompt: { 
      template: "Based on this analysis:\n{{#impulse root-cause-analysis}}\n\nGenerate a fix.",
      variables: []
    },
    impulseReferences: ["root-cause-analysis"],
    outputImpulses: ["fix-patch"]
  }]
}

// Activity 3: Apply fix (uses impulse from Activity 2)
const applyTemplate = {
  id: "apply-fix",
  tasks: [{
    id: "edit-file",
    prompt: {
      template: "Apply this patch:\n{{#impulse fix-patch}}\n\nUse edit tool.",
      variables: []
    },
    impulseReferences: ["fix-patch"]
  }]
}

// Expected Behavior
// 1. Execute analyze-bug → output stored as impulse "root-cause-analysis"
// 2. Execute generate-fix → loads "root-cause-analysis", outputs "fix-patch"
// 3. Execute apply-fix → loads "fix-patch", applies changes
// 4. All impulses stored in backend for reuse

// Verification
const exec1 = await minibob.execute({ template: analyzeTemplate, variables: { file: "auth.ts" } })
assert(await backend.impulseExists("root-cause-analysis"))

const exec2 = await minibob.execute({ template: fixTemplate })
assert(exec2.taskResults[0].impulses["root-cause-analysis"].loaded)
assert(await backend.impulseExists("fix-patch"))

const exec3 = await minibob.execute({ template: applyTemplate })
assert(exec3.taskResults[0].impulses["fix-patch"].loaded)

// Check impulse chain in dashboard
const impulseGraph = await dashboard.getImpulseGraph()
assert(impulseGraph.edges.includes("analyze-bug → generate-fix"))
assert(impulseGraph.edges.includes("generate-fix → apply-fix"))
```

### Execution
```bash
bun run tests/03-impulse-integration.ts

# Expected Output:
# ✅ Test 3.1: Impulse as Context - PASS
# ✅ Test 3.2: Impulse as Tool Data - PASS
# ✅ Test 3.3: Impulse Chain - PASS
# 
# Impulse Graph: http://dashboard.minibob.local/impulses
```

---

## Test 4: In-Situ Debugging via Improvisation

**Objective**: Verify on-the-fly variant creation when activity fails

**Mechanism**:
- Activity execution fails (validation, tool error, etc.)
- System detects failure
- Creates variant with debugging context
- Executes variant immediately
- Original + variant tracked separately

**Test Script**: `tests/04-insitu-debugging.ts`

### Test Case 4.1: Validation Failure → Variant with Relaxed Constraints
```typescript
// Setup: Activity with strict validation
const originalTemplate = {
  id: "create-api-endpoint",
  tasks: [{
    id: "implement-endpoint",
    validation: {
      requiredFiles: ["api/users.ts"],
      requiredPatterns: [
        { file: "api/users.ts", pattern: "export async function getUser" },
        { file: "api/users.ts", pattern: "// Rate limit: 100 req/min" }
      ]
    }
  }]
}

// First execution: Fails validation (missing rate limit comment)
const exec1 = await minibob.execute({ template: originalTemplate })
assert(exec1.status === "failed")
assert(exec1.taskResults[0].validationErrors.includes("Rate limit comment missing"))

// Expected Behavior (In-Situ Debugging)
// 1. Detect validation failure
// 2. Create variant "create-api-endpoint-debug-<timestamp>"
// 3. Variant has:
//    - Same tasks
//    - Relaxed validation (remove rate limit pattern)
//    - Additional context in prompt: "Previous attempt failed because: ..."
// 4. Execute variant
// 5. Track relationship: original → variant

// Simulated Manual Trigger (should be automatic)
const debugVariant = await MCPActivityBridge.createVariant({
  originalTemplateId: "create-api-endpoint",
  reason: "Validation failure: Rate limit comment missing",
  modifications: {
    relaxValidation: true,
    addContext: "Previous attempt failed validation. Focus on core functionality, skip rate limit comment."
  }
})

const exec2 = await minibob.execute({ template: debugVariant })

// Verification
assert(exec2.status === "completed", "Variant should succeed")
assert(exec2.templateId.includes("debug"), "Should use debug variant")

const relationship = await backend.getTemplateRelationship(originalTemplate.id, debugVariant.id)
assert(relationship.type === "debug-variant")
assert(relationship.reason.includes("validation failure"))
```

### Test Case 4.2: Tool Error → Variant with Different Approach
```typescript
// Setup: Activity that uses tool incorrectly
const originalTemplate = {
  id: "refactor-module",
  tasks: [{
    id: "rename-function",
    prompt: {
      template: "Rename function oldName to newName in {{file}} using edit tool"
    }
  }]
}

// First execution: Tool error (edit oldString not found)
const exec1 = await minibob.execute({ 
  template: originalTemplate,
  variables: { file: "utils.ts" }
})
assert(exec1.status === "failed")
assert(exec1.taskResults[0].error.includes("oldString not found"))

// Expected Behavior (In-Situ Debugging)
// 1. Detect tool error
// 2. Create variant with different approach:
//    - Variant task: "First READ the file, then identify exact oldString, then edit"
//    - Add impulse with error context
// 3. Execute variant with defensive prompt

// Simulated
const debugVariant = await MCPActivityBridge.createVariant({
  originalTemplateId: "refactor-module",
  reason: "Tool error: edit oldString not found",
  modifications: {
    taskPromptPrefix: "IMPORTANT: First use read tool to view exact file contents. Then carefully extract oldString before editing.",
    addErrorContext: true
  }
})

const exec2 = await minibob.execute({ 
  template: debugVariant,
  variables: { file: "utils.ts" }
})

// Verification
assert(exec2.status === "completed")
assert(exec2.taskResults[0].toolCalls[0].name === "read", "Should read first")
assert(exec2.taskResults[0].toolCalls[1].name === "edit", "Then edit")
```

### Test Case 4.3: Automatic Variant Selection
```typescript
// Scenario: Same goal executed twice, variant created after first failure

// First execution
const goal = "Add caching layer to API"
const result1 = await minibob.executeGoal(goal)
assert(result1.completed === false, "First attempt should fail")

// System automatically creates variant during failure
// Variant stored in backend with relationship

// Second execution (same goal)
const result2 = await minibob.executeGoal(goal)

// Expected Behavior
// 1. Thompson Sampling sees:
//    - Original template: alpha=1, beta=2 (failed once)
//    - Debug variant: alpha=1, beta=1 (untried)
// 2. May select variant for exploration
// 3. If variant succeeds: alpha=2, beta=1 (better success rate)

// Verification
const recommendations = await backend.getRecommendations(goal)
assert(recommendations.length >= 2, "Should have original + variant")

const variantRec = recommendations.find(r => r.template_id.includes("debug"))
assert(variantRec, "Should include debug variant in recommendations")
```

### Execution
```bash
bun run tests/04-insitu-debugging.ts

# Expected Output:
# ✅ Test 4.1: Validation Failure Variant - PASS
# ✅ Test 4.2: Tool Error Variant - PASS
# ✅ Test 4.3: Automatic Variant Selection - PASS
#
# Variant Relationships: http://dashboard.minibob.local/templates/variants
```

---

## Test 5: Post-Hoc Debugging and Improvement

**Objective**: Verify activity improvement by analyzing execution state changes

**Mechanism**:
- Inspect execution traces (tool calls, file changes, LLM messages)
- Identify inefficiencies (redundant tools, missing validation, etc.)
- Generate improved template variant
- Can be triggered by boredom system OR manual prompt

**Test Script**: `tests/05-posthoc-improvement.ts`

### Test Case 5.1: Manual Post-Hoc Analysis
```typescript
// Setup: Execute activity and capture trace
const originalTemplate = {
  id: "fix-bug",
  tasks: [
    { id: "analyze", prompt: { template: "Analyze {{file}}" } },
    { id: "fix", prompt: { template: "Fix the bug" } },
    { id: "test", prompt: { template: "Run tests" } }
  ]
}

const execution = await minibob.execute({ 
  template: originalTemplate,
  variables: { file: "auth.ts" }
})

// Capture execution trace
const trace = {
  executionId: execution.id,
  toolCalls: execution.taskResults.flatMap(r => r.toolCalls),
  fileChanges: await getGitDiff(),
  duration: execution.metrics.duration,
  cost: execution.metrics.cost
}

// Analysis: Identify issues
// - Task "analyze" used read tool 3 times (redundant)
// - Task "fix" called edit tool, but previous read already showed content
// - Task "test" used bash tool, but no validation on output

// Expected Behavior (Manual Trigger)
const improvedTemplate = await MCPActivityBridge.improveActivity({
  executionId: execution.id,
  analysisPrompt: `
Analyze this execution trace and create an improved template:

Issues found:
- Multiple redundant read calls
- Lack of output validation on tests

Suggest improvements to task structure and prompts.
  `
})

// Verification
assert(improvedTemplate.id === "fix-bug-improved-v1")
assert(improvedTemplate.tasks.length === 3, "Should keep 3 tasks")

// Check improvements
const analyzeTask = improvedTemplate.tasks[0]
assert(analyzeTask.outputImpulses.includes("file-content"), 
  "Should save read output as impulse to avoid re-reading")

const testTask = improvedTemplate.tasks[2]
assert(testTask.validation?.commands?.length > 0,
  "Should add test output validation")
```

### Test Case 5.2: Boredom System Triggers Improvement
```typescript
// Setup: Activity with mediocre success rate
await backend.registerTemplate({
  id: "deploy-to-staging",
  // Executions: 10 success, 5 failures (66% success rate)
})

// Boredom system detects improvement opportunity
// Criteria: success_rate < 80% AND execution_count > 10

// Expected Behavior (Automatic via Boredom)
// 1. Boredom poll detects "deploy-to-staging" as candidate
// 2. Backend creates improvement task:
//    {
//      id: "improve-deploy-to-staging",
//      templateId: "analyze-and-improve-activity",
//      variables: {
//        targetTemplateId: "deploy-to-staging",
//        minExecutions: 5  // Analyze last 5 executions
//      }
//    }
// 3. Vessel picks up task
// 4. Executes analysis activity:
//    - Fetches 5 execution traces
//    - Identifies common failure patterns
//    - Generates improved template
// 5. Registers improved template as variant
// 6. Thompson Sampling will test improved variant

// Simulation (manual trigger, normally automatic)
const boredomTask = await backend.createBoredomTask({
  type: "improve-activity",
  targetTemplateId: "deploy-to-staging",
  priority: "medium"
})

const improvedTemplate = await boredom.executeTask(boredomTask)

// Verification
assert(improvedTemplate.id === "deploy-to-staging-improved-v1")

const metadata = improvedTemplate.metadata
assert(metadata.generatedFrom === "post-hoc-analysis")
assert(metadata.sourceTemplateId === "deploy-to-staging")
assert(metadata.analysisData.executionsAnalyzed === 5)
assert(metadata.analysisData.commonFailures.length > 0)

// Check Thompson Sampling will use variant
const recommendations = await backend.getRecommendations("deploy code to staging")
const improvedRec = recommendations.find(r => r.template_id === improvedTemplate.id)
assert(improvedRec, "Improved variant should appear in recommendations")
```

### Test Case 5.3: State Change Analysis for Optimization
```typescript
// Setup: Activity that makes redundant changes
const originalTemplate = {
  id: "setup-project",
  tasks: [
    { id: "init", prompt: { template: "Initialize project with package.json" } },
    { id: "deps", prompt: { template: "Install dependencies" } },
    { id: "config", prompt: { template: "Create config files" } },
    { id: "verify", prompt: { template: "Verify setup" } }
  ]
}

// Execute and track ALL state changes
const beforeState = await captureState()
const execution = await minibob.execute({ template: originalTemplate })
const afterState = await captureState()

const stateChanges = diffState(beforeState, afterState)
// stateChanges = {
//   filesCreated: ["package.json", "tsconfig.json", ".env"],
//   filesModified: [],
//   toolCalls: 12,
//   gitCommits: 0
// }

// Analysis reveals:
// - Task "verify" called read tool 4 times but made no changes
// - Tasks could be combined: init + deps can run together

// Expected Behavior
const optimizedTemplate = await MCPActivityBridge.improveActivity({
  executionId: execution.id,
  optimizationGoals: ["reduce tool calls", "combine non-dependent tasks"],
  stateChanges
})

// Verification
assert(optimizedTemplate.tasks.length === 3, "Should combine init+deps")
assert(optimizedTemplate.tasks[0].id === "init-and-deps")

// Execute optimized version
const optimizedExec = await minibob.execute({ template: optimizedTemplate })
assert(optimizedExec.metrics.totalToolCalls < execution.metrics.totalToolCalls)
assert(optimizedExec.metrics.duration < execution.metrics.duration)
```

### Execution
```bash
bun run tests/05-posthoc-improvement.ts

# Expected Output:
# ✅ Test 5.1: Manual Post-Hoc Analysis - PASS
# ✅ Test 5.2: Boredom System Improvement - PASS
# ✅ Test 5.3: State Change Optimization - PASS
#
# Improved templates: 3 variants created
# Success rate improvement: +15% average
```

---

## Test 6: Activity Composition

**Objective**: Verify flexible workflow reuse with different impulse specifications

**Mechanism**:
- Define reusable activity templates
- Execute with different impulse contexts
- Same workflow, different data sources
- Composition via nested activities or impulse chaining

**Test Script**: `tests/06-activity-composition.ts`

### Test Case 6.1: Reusable Analysis Workflow
```typescript
// Setup: Generic analysis template
const analysisTemplate = {
  id: "analyze-code-quality",
  tasks: [{
    id: "analyze",
    prompt: {
      template: `
Analyze the code from these sources:

{{#impulse code-source}}

Check for:
- Code smells
- Security issues
- Performance problems

Output detailed report.
      `,
      variables: []
    },
    impulseReferences: ["code-source"],
    outputImpulses: ["analysis-report"]
  }]
}

// Execution 1: Analyze from file
const exec1 = await minibob.execute({
  template: analysisTemplate,
  impulses: [{
    id: "code-source",
    pointer: { type: "file", path: "auth/login.ts" },
    budget: 5000,
    priority: "high"
  }]
})

// Execution 2: Analyze from git diff
const exec2 = await minibob.execute({
  template: analysisTemplate,
  impulses: [{
    id: "code-source",
    pointer: { type: "memo", content: await getGitDiff("HEAD~1..HEAD") },
    budget: 5000,
    priority: "high"
  }]
})

// Execution 3: Analyze from previous activity output
const exec3 = await minibob.execute({
  template: analysisTemplate,
  impulses: [{
    id: "code-source",
    pointer: { 
      type: "activityOutput", 
      activityId: "code-generator-123",
      taskId: "generate-code"
    },
    budget: 5000,
    priority: "high"
  }]
})

// Verification
assert(exec1.status === "completed", "File source should work")
assert(exec2.status === "completed", "Git diff source should work")
assert(exec3.status === "completed", "Activity output source should work")

// All should produce "analysis-report" impulse
assert(await backend.impulseExists(`${exec1.id}-analysis-report`))
assert(await backend.impulseExists(`${exec2.id}-analysis-report`))
assert(await backend.impulseExists(`${exec3.id}-analysis-report`))

// Same template, different data sources
assert(exec1.templateId === exec2.templateId)
assert(exec2.templateId === exec3.templateId)
```

### Test Case 6.2: Nested Activity Composition
```typescript
// Setup: High-level workflow that uses sub-activities

const subActivity1 = {
  id: "analyze-requirements",
  tasks: [{
    id: "extract-requirements",
    prompt: { template: "Extract requirements from {{#impulse spec}}" },
    impulseReferences: ["spec"],
    outputImpulses: ["requirements-list"]
  }]
}

const subActivity2 = {
  id: "generate-implementation",
  tasks: [{
    id: "implement",
    prompt: { template: "Implement based on {{#impulse requirements-list}}" },
    impulseReferences: ["requirements-list"],
    outputImpulses: ["implementation-code"]
  }]
}

const mainActivity = {
  id: "full-feature-development",
  tasks: [
    {
      id: "analyze",
      prompt: {
        template: "Execute activity 'analyze-requirements' with impulse 'spec'"
      },
      // This should trigger nested activity execution
    },
    {
      id: "implement",
      prompt: {
        template: "Execute activity 'generate-implementation' with impulse 'requirements-list' from previous task"
      }
    },
    {
      id: "test",
      prompt: {
        template: "Create tests for {{#impulse implementation-code}}"
      },
      impulseReferences: ["implementation-code"]
    }
  ]
}

// Input
const impulses = [{
  id: "spec",
  pointer: { type: "file", path: "docs/feature-spec.md" },
  budget: 3000,
  priority: "critical"
}]

// Expected Behavior
// 1. Task "analyze" → triggers subActivity1 execution
// 2. subActivity1 outputs "requirements-list" impulse
// 3. Task "implement" → triggers subActivity2 with "requirements-list"
// 4. subActivity2 outputs "implementation-code" impulse
// 5. Task "test" → uses "implementation-code" directly
// 6. All executions linked in trace

const execution = await minibob.execute({ 
  template: mainActivity,
  impulses
})

// Verification
assert(execution.status === "completed")
assert(execution.taskResults.length === 3)

// Check nested executions
const nestedExecutions = await backend.getNestedExecutions(execution.id)
assert(nestedExecutions.length === 2, "Should have 2 nested activities")
assert(nestedExecutions[0].templateId === "analyze-requirements")
assert(nestedExecutions[1].templateId === "generate-implementation")

// Check impulse flow
const impulseFlow = await backend.getImpulseFlow(execution.id)
assert(impulseFlow.includes("spec → requirements-list → implementation-code"))
```

### Test Case 6.3: Goal-Driven Composition
```typescript
// Setup: Multiple specialized activities available
await backend.registerTemplates([
  { id: "create-api-endpoint", category: "feature" },
  { id: "add-database-model", category: "feature" },
  { id: "write-api-tests", category: "feature" },
  { id: "update-api-docs", category: "feature" }
])

// Input: Complex goal
const goal = "Add user registration endpoint with email validation"

// Expected Behavior (Composition via Goal Processor)
// 1. Backend decomposes goal into sub-goals:
//    - Add User model
//    - Create POST /register endpoint
//    - Add email validation
//    - Write tests
//    - Update docs
// 2. Thompson Sampling recommends activity sequence:
//    - "add-database-model" with variables: { model: "User", fields: [...] }
//    - "create-api-endpoint" with variables: { route: "/register", method: "POST" }
//    - "write-api-tests" with impulse from endpoint output
//    - "update-api-docs" with impulse from endpoint output
// 3. Execute in order, passing impulses between activities

const result = await minibob.executeGoal(goal, {}, { maxActivities: 5 })

// Verification
assert(result.completed === true)
assert(result.executions.length === 4, "Should compose 4 activities")

const executionIds = result.executions.map(e => e.templateId)
assert(executionIds.includes("add-database-model"))
assert(executionIds.includes("create-api-endpoint"))
assert(executionIds.includes("write-api-tests"))
assert(executionIds.includes("update-api-docs"))

// Check impulse passing
const apiExecution = result.executions.find(e => e.templateId === "create-api-endpoint")
const testExecution = result.executions.find(e => e.templateId === "write-api-tests")

const testImpulses = testExecution.taskResults[0].impulses
assert(testImpulses["api-output"], "Tests should receive API output as impulse")
assert(testImpulses["api-output"].pointer.activityId === apiExecution.id)
```

### Execution
```bash
bun run tests/06-activity-composition.ts

# Expected Output:
# ✅ Test 6.1: Reusable Analysis Workflow - PASS
# ✅ Test 6.2: Nested Activity Composition - PASS
# ✅ Test 6.3: Goal-Driven Composition - PASS
#
# Composition graphs: http://dashboard.minibob.local/compositions
```

---

## Test Execution

### Run All Tests
```bash
cd test-minibob-verification

# Setup environment
bun run setup.ts

# Run full suite
bun run all-tests.ts

# Expected output:
# MiniBob Verification Test Suite
# ================================
# Environment: ✅ All checks passed
# 
# Test 1: Goal-Seeking Improvisation
#   1.1 Novel Feature Request ........................... ✅ PASS (2.3s)
#   1.2 Improvisation After Failures .................... ✅ PASS (5.1s)
#   1.3 Improvisation Constraints ....................... ✅ PASS (3.2s)
# 
# Test 2: Activity Selection
#   2.1 Relevance Filtering ............................. ✅ PASS (1.8s)
#   2.2 Thompson Sampling Exploration ................... ✅ PASS (12.4s)
#   2.3 Context-Aware Selection ......................... ✅ PASS (2.1s)
# 
# Test 3: Impulse Integration
#   3.1 Impulse as Context .............................. ✅ PASS (3.5s)
#   3.2 Impulse as Tool Data ............................ ✅ PASS (2.9s)
#   3.3 Impulse Chain ................................... ✅ PASS (7.2s)
# 
# Test 4: In-Situ Debugging
#   4.1 Validation Failure Variant ...................... ✅ PASS (4.1s)
#   4.2 Tool Error Variant .............................. ✅ PASS (3.8s)
#   4.3 Automatic Variant Selection ..................... ✅ PASS (6.3s)
# 
# Test 5: Post-Hoc Improvement
#   5.1 Manual Post-Hoc Analysis ........................ ✅ PASS (5.7s)
#   5.2 Boredom System Improvement ...................... ✅ PASS (8.2s)
#   5.3 State Change Optimization ....................... ✅ PASS (6.1s)
# 
# Test 6: Activity Composition
#   6.1 Reusable Analysis Workflow ...................... ✅ PASS (9.3s)
#   6.2 Nested Activity Composition ..................... ✅ PASS (11.7s)
#   6.3 Goal-Driven Composition ......................... ✅ PASS (14.2s)
# 
# ================================
# Total: 18 tests
# Passed: 18 ✅
# Failed: 0
# Duration: 108.9s
# 
# Results saved to: results/2026-03-21-22-30-15/
# Dashboard: http://dashboard.minibob.local
```

### Run Individual Tests
```bash
# Test specific capability
bun run tests/01-goal-seeking-improvisation.ts
bun run tests/02-activity-selection.ts
bun run tests/03-impulse-integration.ts
bun run tests/04-insitu-debugging.ts
bun run tests/05-posthoc-improvement.ts
bun run tests/06-activity-composition.ts
```

### Verification Dashboard

All test executions visible in real-time:
```
http://dashboard.minibob.local

Views:
- /executions     - All activity executions
- /goals          - Goal processing flows
- /impulses       - Impulse graphs and chains
- /variants       - Template variants and relationships
- /compositions   - Activity composition graphs
- /thompson       - Thompson Sampling statistics
```

---

## Success Criteria

### Test 1: Goal-Seeking Improvisation ✅
- [ ] Novel goal triggers improvisation (no matching templates)
- [ ] Improvised template created via backend
- [ ] Template executed immediately
- [ ] Improvisation constraints respected (maxTasks, maxCost, preferComposition)
- [ ] Only one improvisation attempt per goal (prevent infinite loop)

### Test 2: Activity Selection ✅
- [ ] Relevant activities ranked higher
- [ ] Irrelevant activities filtered out
- [ ] Thompson Sampling balances exploration/exploitation
- [ ] Context (impulses) influences recommendations
- [ ] Success rates tracked and used

### Test 3: Impulse Integration ✅
- [ ] Impulses loaded lazily within token budgets
- [ ] Local impulses resolved by minibob
- [ ] Backend impulses resolved via MCP
- [ ] Impulses formatted into task prompts
- [ ] Impulses accessible to tools
- [ ] Impulse chains work (activity → impulse → activity)

### Test 4: In-Situ Debugging ✅
- [ ] Validation failures trigger variant creation
- [ ] Tool errors trigger variant with different approach
- [ ] Variants tracked with relationship to original
- [ ] Variants appear in Thompson Sampling
- [ ] Automatic variant selection based on success rates

### Test 5: Post-Hoc Improvement ✅
- [ ] Manual analysis creates improved templates
- [ ] Boredom system detects improvement opportunities
- [ ] Execution traces analyzed for inefficiencies
- [ ] State changes identified and optimized
- [ ] Improved variants show measurable improvements

### Test 6: Activity Composition ✅
- [ ] Same template reusable with different impulses
- [ ] Nested activity execution works
- [ ] Impulse chains enable composition
- [ ] Goal processor composes multiple activities
- [ ] Composition graphs visible in dashboard

---

## Troubleshooting

### Backend Not Accessible
```bash
# Check services
kubectl get pods -n activity-system
kubectl get pods -n metabob

# Port forward if needed
kubectl port-forward -n activity-system svc/metabob-activity-api 8081:8080

# Update test config
export MINIBOB_BACKEND_URL="http://localhost:8081"
```

### Templates Not Found
```bash
# Check template registry
curl http://api.minibob.local/v2/activities/templates | jq .

# Seed templates
cd repos/metabob-activity-api
bun run seed-templates.ts
```

### Impulse Resolution Fails
```bash
# Check MCP connectivity
curl -X POST http://api.minibob.local/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"impulse_get_content","params":{"impulse_id":"test"}}'

# Check SurrealDB
kubectl exec -it -n metabob surrealdb-0 -- surreal sql --endpoint http://localhost:8000
```

### Dashboard Not Loading
```bash
# Check dashboard pod
kubectl get pods -n metabob | grep dashboard

# Port forward
kubectl port-forward -n metabob svc/metabob-dashboard 3000:80

# Access at http://localhost:3000
```

---

## Next Steps

After all tests pass:

1. **Document Results**
   - Export dashboard screenshots
   - Generate execution traces report
   - Create comparison matrix (minibob vs opencode)

2. **Performance Analysis**
   - Measure improvisation latency
   - Analyze Thompson Sampling effectiveness
   - Benchmark impulse resolution speed

3. **Integration Testing**
   - Test OpenCode + MiniBob together
   - Verify seamless library integration
   - Test MCP communication patterns

4. **Production Readiness**
   - Load testing (100+ concurrent goals)
   - Failure recovery scenarios
   - Backend scaling verification
