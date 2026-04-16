# Current Procedural Generation Process

> **Status**: This document describes how MiniBob currently creates and executes procedurally generated activity templates, and identifies gaps in the process.

## User Question

> "Let's make sure our traces, and the procedurally generated activities are being created with the proper names, descriptions, tasks, expectations and scopes and that we are able to pull and run them from the backend. We should, in the same process as creation, also execute the activity steps as we go. We should not 'improvise' except as error handling. What is our current process for this?"

## TL;DR - Current State

**What Works:**
- ✅ Progressive composition template exists (`create-template-progressive`)
- ✅ Template extraction from executions (ribosome pattern)
- ✅ Backend registration of templates
- ✅ Template retrieval from backend
- ✅ Stage-by-stage execution with alignment checks

**What's Broken:**
- ❌ Templates are executed **AFTER** creation, not **DURING**
- ❌ No immediate execution of newly created templates
- ❌ Improvisation is still the primary mode, not error handling
- ❌ Names/descriptions may be generic, not goal-specific
- ❌ No verification loop (create → execute → validate → refine)

---

## The Ideal Flow (What User Wants)

```
1. User provides goal
   ↓
2. MiniBob searches for existing templates (Thompson Sampling)
   ↓
3a. IF template found with high confidence:
    → Execute template directly (no improvisation)
    → Track execution for Thompson Sampling
   ↓
3b. IF no template OR low confidence:
    → Execute create-template-progressive
    → THIS CREATES TEMPLATE STEP-BY-STEP
    → AS EACH TASK IS CREATED, EXECUTE IT IMMEDIATELY
    → Validate execution before moving to next task
    → IF task fails → that's error handling (improvise fix)
    → IF task succeeds → capture it in template
   ↓
4. Register completed template with backend
   ↓
5. Immediately execute the newly created template (validation run)
   ↓
6. IF validation succeeds:
   → Template is ready for future use
   ↓
   IF validation fails:
   → Mark as "attempt template"
   → Create variant with fixes
   → Retry variant
```

---

## Current Flow (What Actually Happens)

### Path 1: Activity Recommendation Found

```
1. User provides goal
   ↓
2. GoalProcessor.executeGoal()
   ↓
3. getRecommendations(goal)
   → Calls backend Thompson Sampling
   → Returns ranked activity templates
   ↓
4. loadTemplateFromMCPOrLocal(templateId)
   → Strategy: backend-first, local-first, or hybrid
   → Tries: vessel cache → backend API → embedded templates
   ↓
5. ActivityExecutor.execute(template)
   → Executes tasks sequentially
   → NO improvisation (uses template as-is)
   ↓
6. Record execution feedback (MISSING - Gap 2 from bootstrap doc)
   ↓
7. Return results to user
```

**File**: `repos/minibob/src/goal-processor.ts` (lines 4792-5650)

### Path 2: No Matching Activity (Current Approach)

```
1. User provides goal
   ↓
2. GoalProcessor.executeGoal()
   ↓
3. getRecommendations(goal) → Empty or low confidence
   ↓
4. EITHER:
   4a. Use procedural generation (if score < 0.7)
       → loadTemplate('create-template-progressive')
       → Execute this meta-template
   OR
   4b. Enter improvisation mode
       → improvisationWithMultipleTurns()
   ↓
5. IF improvisation path (4b):
   - GoalImproviser.improvise()
   - LLM + tools loop until goal achieved
   - Capture ImprovisationTrace
   ↓
6. Extract template from trace:
   - extractTemplateFromImprovisation() (success)
   - extractAttemptTemplate() (failure)
   ↓
7. Register template with backend
   → mcp.registerTemplate(template)
   ↓
8. Template now available for future recommendations
   → BUT NOT IMMEDIATELY EXECUTED
```

**Files**:
- `repos/minibob/src/goal-processor.ts` (lines 3570-3810 improvisation)
- `repos/minibob/src/improviser.ts` (improvisation execution)
- `repos/minibob/src/template-extractor.ts` (template extraction)

---

## Deep Dive: create-template-progressive

**File**: `repos/minibob/src/embedded-templates/create-template-progressive.json`

### What It Does

This is a **meta-template** that creates other templates using progressive composition:

```
Stage 1: Initial setup
  → Try known activity (if suggested)
  → OR improvise
  → Output: STAGE-1-ALIGNED or STAGE-1-MISALIGNED
  ↓
Checkpoint 1: Verify alignment
  → Output: CHECKPOINT-PASSED or CHECKPOINT-FAILED
  ↓
Stage 2: Integration
  → Build on Stage 1
  → Backtrack if approach fails
  → Output: STAGE-2-ALIGNED or STAGE-2-MISALIGNED
  ↓
Checkpoint 2: Verify alignment
  ↓
Stage 3: Testing
  → Verify end-to-end
  → Output: GOAL-ACHIEVED or GOAL-FAILED
  ↓
Learning Summary: Document patterns
  → Extract composition sequences
  → Identify optimization opportunities
```

### Critical Features

1. **Stage-by-stage execution** - Each stage validates before proceeding
2. **Alignment markers** - Uses `echo` tool to output structured status
3. **Backtracking** - Can try alternate approaches on failure
4. **Composition recording** - Uses `runActivity` tool to call other activities
5. **Learning documentation** - Final task extracts patterns

### What It's Missing

**❌ It doesn't CREATE an activity template as output**

The template:
- Executes stages progressively ✓
- Records alignment markers ✓
- Documents learnings ✓
- **BUT**: Doesn't emit a JSON activity template file

**What it should do**:
```json
{
  "id": "learning-summary",
  "prompt": {
    "template": "...\nNow output the activity template you just created:\n\nwrite({\n  path: '.metabob/generated-templates/{{goalSlug}}.json',\n  content: JSON.stringify({\n    id: 'generated-{{goalSlug}}',\n    name: '{{goal}}',\n    description: '...',\n    tasks: [\n      // Extract from stage executions\n    ]\n  }, null, 2)\n})\n"
  }
}
```

---

## Template Extraction (Ribosome Pattern)

### Current Implementation

**File**: `repos/minibob/src/template-generator.ts`

**Function**: `assembleTemplateFromExecution(execution)`

**What It Does**:
1. Analyzes execution trace
2. Extracts input schema (which impulses were used)
3. Extracts output schema (which impulses were created)
4. Converts executed tasks into template tasks
5. Infers task prompts from tool calls and LLM messages
6. Adds validation rules from execution patterns
7. Returns `ActivityTemplate` object

**Schema Extraction**:
```typescript
extractInputSchemaFromExecution(execution) {
  // Counts impulse usage across tasks
  // Classifies as required (majority of tasks) or optional
  // Returns { required: [], optional: [] }
}

extractOutputSchemaFromExecution(execution) {
  // Extracts from:
  // 1. taskResults[].metadata.outputImpulses[]
  // 2. executionTrace.impulsesCreated[]
  // 3. Tool calls (inferred shapes)
  // Returns { produces: [] }
}
```

**Progressive Determinism** (Lines 28-42):
- Tracks model selection decisions
- Promotes tasks to deterministic resolvers when patterns stabilize
- MIN_PATTERN_SUCCESS_RATE = 0.80 (80% success)
- MIN_PATTERN_USES = 3 (minimum 3 uses)

### What Gets Registered

When template is extracted and registered:

```typescript
const template: ActivityTemplate = {
  id: `tpl_${timestamp}_${hash}`,
  name: execution.template?.name || "Untitled Activity",
  description: execution.template?.description || goal,
  category: inferCategory(goal), // feature/bugfix/refactor/tool
  tags: [...],
  tasks: extractedTasks,
  inputSchema: extractInputSchemaFromExecution(execution),
  outputSchema: extractOutputSchemaFromExecution(execution),
  metadata: {
    generatedFrom: 'execution',
    sourceExecutionId: execution.id,
    firstExecutionMetrics: {
      duration: execution.metrics.duration,
      cost: execution.metrics.cost,
      tokens: execution.metrics.tokens,
      status: execution.status
    },
    createdAt: Date.now(),
    author: 'ribosome',
    inputSchemaInferredFrom: {
      executionId: execution.id,
      confidence: calculateConfidence(execution),
      impulseCount: execution.impulses.length
    }
  }
}
```

**Confidence Calculation** (Lines 89-147):
```typescript
let confidence = 0.5  // Base
if (impulses.length >= 3) confidence += 0.1
if (impulses.length >= 5) confidence += 0.1
if (goal_achieved) confidence += 0.15
if (has both input & output schemas) confidence += 0.1
return Math.min(confidence, 0.95)  // Cap at 95%
```

---

## Template Retrieval & Execution

### Loading Templates

**File**: `repos/minibob/src/activity.ts` (lines 2965-3038)

**Function**: `loadTemplateFromMCPOrLocal(templateId, options?)`

**Strategies**:

1. **backend-first** (default):
   ```
   Try: Backend API → Embedded templates
   ```

2. **local-first**:
   ```
   Try: Vessel cache → Backend API → Embedded templates
   ```

3. **hybrid**:
   ```
   Try: Vessel cache → Backend API → Embedded templates
   ```

**Vessel Cache**:
```typescript
const cache = getTemplateCache()
if (cache) {
  const cached = await cache.get(templateId)
  if (cached && !cache.isStale(templateId)) {
    return cached
  }
}
```

**Backend API**:
```typescript
const mcp = getMCPClient()
if (mcp) {
  const template = await mcp.getActivityTemplate(templateId)
  if (template) {
    await cache?.set(templateId, template)
    return template
  }
}
```

**Embedded Templates**:
```typescript
const { getEmbeddedTemplate } = await import('./embedded-templates')
const template = await getEmbeddedTemplate(templateId)
if (template) {
  return template
}
```

### Executing Templates

**File**: `repos/minibob/src/activity.ts` (ActivityExecutor class)

**Process**:
1. Load impulses (input context)
2. For each task in template.tasks:
   - Substitute variables in prompt
   - Filter tools (if resolverRequirements specified)
   - Call LLM with prompt + tools
   - Execute tool calls
   - Validate task result (if validation rules exist)
   - Retry on failure (if retry.maxAttempts > 0)
   - Capture task result
3. Validate outputs (shape validators, early exit)
4. Create execution trace
5. Store impulses (output artifacts)

**Early Exit** (Gap in current flow):
- Shape validators can validate outputs
- Early exit happens if all outputs satisfied
- **BUT**: No immediate retry if validation fails

---

## Critical Gaps in Current Flow

### Gap 1: No Execute-During-Creation

**Current**:
```
create-template-progressive executes
  → Documents what it did
  → Extracts template FROM trace
  → Registers template
  → END (template not executed)
```

**Needed**:
```
create-template-progressive executes
  → Stage 1: Create + execute task 1
  → Validate task 1 output
  → IF valid: Add to template
  → IF invalid: Retry with fixes
  → Stage 2: Create + execute task 2 (building on task 1)
  → Validate task 2 output
  → ...repeat...
  → Final: Write template JSON to file
  → Execute complete template (validation run)
```

### Gap 2: Template Names/Descriptions Not Goal-Specific

**Current**:
```typescript
name: execution.template?.name || "Untitled Activity"
description: execution.template?.description || goal
```

If execution came from improvisation:
- `execution.template` is undefined
- Fallback to "Untitled Activity"
- Description is just the goal text

**Needed**:
```typescript
name: inferNameFromGoal(goal) // e.g., "Add JWT Authentication"
description: generateDescription(goal, taskSummaries)
// "Implements JWT-based authentication by creating middleware,
// integrating routes, and adding tests"
```

**Location to fix**: `repos/minibob/src/template-generator.ts` (line ~300)

### Gap 3: No Immediate Validation Run

**Current**:
```
Template extracted → Registered → Available for future use
```

**Needed**:
```
Template extracted
  ↓
Registered with backend
  ↓
IMMEDIATE EXECUTION (validation run)
  ↓
IF success:
  → Mark template as validated
  → Thompson alpha += 1
  ↓
IF failure:
  → Extract attempt template
  → Create variant with fixes
  → Retry variant
```

**Implementation**:
```typescript
// In goal-processor.ts after extractTemplateFromImprovisation()
if (mcp) {
  await mcp.registerTemplate(extractedTemplate)

  // NEW: Immediate validation run
  log.info(`[Validation] Running validation of ${extractedTemplate.id}`)
  const validationExecution = await executor.execute({
    template: extractedTemplate,
    variables: goal.variables,
    impulses: goal.impulses,
    reason: "Validation run after template creation"
  })

  // Record feedback (Gap 2 from bootstrap doc)
  await mcp.recordExecutionFeedback(extractedTemplate.id, validationExecution)

  if (validationExecution.status !== 'completed') {
    // Create variant
    const variant = await createVariantFromAttempt(
      extractedTemplate,
      analyzeFailure(validationExecution)
    )
    await mcp.registerTemplate(variant)
  }
}
```

### Gap 4: Improvisation as Primary Mode, Not Error Handling

**Current Flow**:
```
No template match → Improvise (LLM + tools loop)
```

**Needed Flow**:
```
No template match
  ↓
Execute create-template-progressive
  ↓
Stage 1: Try known activity OR improvise if none found
  → Improvisation is error handling for "no known activity"
  ↓
Stage 2: Try known activity OR improvise
  → Improvisation is error handling
  ↓
Stage 3: Try known activity OR improvise
  → Improvisation is error handling
```

**Implementation**:
```typescript
// In goal-processor.ts
if (recommendations.length === 0 || bestScore < 0.7) {
  log.info(`[GoalProcessor] Using progressive composition for template creation`)

  // Load create-template-progressive
  const createTemplate = await loadTemplateFromMCPOrLocal('create-template-progressive')

  // Execute it to create the template
  const executor = new ActivityExecutor({
    template: createTemplate,
    variables: {
      goal: goal.intent,
      workingDirectory: process.cwd()
      // Note: stage1ActivityId, stage2ActivityId, stage3ActivityId
      // could be populated from failed recommendations
    },
    impulses: goal.impulses
  })

  const execution = await executor.execute()

  // Extract template from execution
  const newTemplate = await extractTemplateFromExecution(execution)

  // Register and validate
  if (mcp) {
    await mcp.registerTemplate(newTemplate)
    // Run validation...
  }

  return execution
}
```

### Gap 5: Tasks Don't Have Proper Scopes

**Current**:
```typescript
tasks: extractedTasks.map(task => ({
  id: task.id,
  description: task.description, // Generic
  prompt: { template: inferredPrompt }, // Inferred from tool calls
  validation: extractedValidation // May be incomplete
}))
```

**Needed**:
```typescript
tasks: [
  {
    id: "setup-middleware",
    description: "Create JWT middleware for request authentication",
    scope: {
      files: ["src/middleware/auth.ts"], // Explicit file scope
      functions: ["authenticate", "verifyToken"], // Expected functions
      dependencies: ["jsonwebtoken"] // Required packages
    },
    prompt: { template: "..." },
    validation: {
      requiredFiles: ["src/middleware/auth.ts"],
      requiredExports: ["authenticate"],
      requiredPatterns: [
        { pattern: "jwt.verify", description: "Must verify tokens" }
      ],
      shape: "middleware_implementation" // Output shape
    }
  }
]
```

**Where to add**: `repos/minibob/src/template-generator.ts` in task extraction

---

## Recommended Changes

### Priority 1: Fix create-template-progressive Output

**File**: `repos/minibob/src/embedded-templates/create-template-progressive.json`

Add final task to output template JSON:

```json
{
  "id": "output-template",
  "description": "Write the generated template to a file",
  "dependencies": ["learning-summary"],
  "prompt": {
    "template": "Based on the execution trace, create an activity template JSON file:\n\n1. Analyze what was executed in each stage\n2. Extract task definitions from tool calls\n3. Create proper input/output schemas\n4. Output the template file\n\nwrite({\n  path: '.metabob/generated-templates/{{goalSlug}}.json',\n  content: JSON.stringify({\n    \"id\": \"generated-{{goalSlug}}\",\n    \"name\": \"{{goal}}\",\n    \"description\": \"[analyze and write description based on what was done]\",\n    \"category\": \"[infer from goal]\",\n    \"tasks\": [\n      // Extract from stage 1, 2, 3 executions\n    ],\n    \"inputSchema\": {\n      \"required\": [/* analyze what impulses were used */]\n    },\n    \"outputSchema\": {\n      \"produces\": [/* what was created */]\n    }\n  }, null, 2)\n})\n\nThen use echo to confirm:\necho({ message: 'TEMPLATE-CREATED: [path to file]' })"
  },
  "validation": {
    "requiredFiles": [".metabob/generated-templates"],
    "requiredPatterns": [
      { "pattern": "TEMPLATE-CREATED", "description": "Must confirm template creation" }
    ]
  }
}
```

### Priority 2: Add Immediate Execution After Registration

**File**: `repos/minibob/src/goal-processor.ts` (line ~3700)

After `mcp.registerTemplate(extractedTemplate)`:

```typescript
// Immediate validation run
try {
  log.info(`[Validation] Testing newly created template: ${extractedTemplate.id}`)

  const validationExecutor = new ActivityExecutor({
    template: extractedTemplate,
    variables: goal.variables || {},
    impulses: goal.impulses || [],
    reason: "Validation run after creation"
  })

  const validationExecution = await validationExecutor.execute()

  // Record feedback
  if (mcp) {
    await mcp.recordExecutionFeedback(extractedTemplate.id, validationExecution)
  }

  if (validationExecution.status === 'completed') {
    log.info(`[Validation] ✓ Template validated successfully`)
  } else {
    log.warn(`[Validation] ✗ Template failed validation, creating variant`)

    const failureAnalysis = analyzeExecutionFailure(validationExecution)
    const variant = await createVariantFromAttempt(extractedTemplate, failureAnalysis)

    if (mcp) {
      await mcp.registerTemplate(variant)
      // Could retry variant here
    }
  }
} catch (error) {
  log.error(`[Validation] Failed to run validation: ${error.message}`)
}
```

### Priority 3: Improve Template Metadata

**File**: `repos/minibob/src/template-generator.ts`

Add name/description inference:

```typescript
function inferNameFromGoal(goal: string): string {
  // Remove noise words
  const clean = goal
    .replace(/^(please|can you|could you|I need|I want to|let's)\s+/i, '')
    .replace(/\s+(for me|please)$/i, '')

  // Title case
  return clean
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function generateDescription(
  goal: string,
  execution: ActivityExecution
): string {
  const filesCreated = execution.executionTrace?.outputState?.filesCreated || []
  const filesModified = execution.executionTrace?.outputState?.filesModified || []

  let desc = `Achieves: ${goal}\n\n`

  if (filesCreated.length > 0) {
    desc += `Creates: ${filesCreated.join(', ')}\n`
  }

  if (filesModified.length > 0) {
    desc += `Modifies: ${filesModified.join(', ')}\n`
  }

  // Add task summaries
  const taskSummaries = execution.taskResults
    .filter(t => t.status === 'completed')
    .map(t => `- ${t.id}: ${t.metadata?.summary || 'Completed'}`)

  if (taskSummaries.length > 0) {
    desc += `\nSteps:\n${taskSummaries.join('\n')}`
  }

  return desc
}
```

Then use in template extraction:

```typescript
const template: ActivityTemplate = {
  id: generateTemplateId(),
  name: inferNameFromGoal(goal),
  description: generateDescription(goal, execution),
  // ...
}
```

---

## Summary: Current vs Needed

| Aspect | Current State | Needed State |
|--------|--------------|-------------|
| **Template Creation** | Extracted after improvisation | Created during execution (progressive) |
| **Execution Timing** | Template executed in future goals | Executed immediately after creation |
| **Improvisation Role** | Primary mode for new goals | Error handling only |
| **Template Names** | Generic ("Untitled Activity") | Goal-specific ("Add JWT Authentication") |
| **Template Scope** | Inferred from tool calls | Explicit file/function/dependency scopes |
| **Validation** | No validation of created templates | Immediate validation run after creation |
| **Variant Creation** | Manual only | Automatic on validation failure |
| **Feedback Loop** | Missing | Records execution success/failure to Thompson Sampling |

---

## Action Items

1. **Modify create-template-progressive.json** - Add output-template task
2. **Add immediate execution** - In goal-processor.ts after registration
3. **Implement name/description inference** - In template-generator.ts
4. **Add scope extraction** - Task scope from execution trace
5. **Route to progressive composition** - Default path for new goals
6. **Reserve improvisation for errors** - Only when stages fail

After these changes, the flow becomes:

```
User goal
  ↓
Search templates (Thompson Sampling)
  ↓
IF found:
  → Execute template
  → Record feedback
  → Done
  ↓
IF not found:
  → Execute create-template-progressive
  → Stage 1: Try activity OR improvise (error handling)
  → Stage 2: Try activity OR improvise (error handling)
  → Stage 3: Try activity OR improvise (error handling)
  → Output template JSON
  → Register with backend
  → EXECUTE template (validation)
  → IF success: Template ready
  → IF failure: Create variant, retry
  → Done
```

This matches the user's desired workflow: **progressive composition with execution during creation**, improvisation only as error handling.
