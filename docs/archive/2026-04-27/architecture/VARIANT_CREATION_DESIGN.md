# Variant Creation System Design

> **Purpose**: Define the automatic variant creation mechanism that learns from failures by adjusting activity expectations through systematic template modifications.

## Overview

The variant creation system is the **expectation adjustment mechanism** in the learning loop. When an activity execution fails, the system:

1. **Analyzes** the failure to categorize root cause
2. **Clones** the template with modified expectations
3. **Applies fixes** based on failure category
4. **Tracks lineage** to understand variant evolution
5. **Prevents loops** through generation limits and decay

**Key Insight**: Variants are not just "fixes" - they are **adjusted expectations** about what's possible given observed constraints.

---

## Failure Pattern Analysis

### Current Failure Classification (from activity.ts)

Based on examination of the codebase, failures are currently tracked through:

1. **Validation failures** - Required files missing, patterns not found, forbidden patterns detected
2. **Tool failures** - Bash command errors, file read/write failures, git operation failures
3. **Timeout failures** - Task exceeded time limit
4. **LLM failures** - Token limit exceeded, API errors, rate limits
5. **Execution errors** - Uncaught exceptions, process crashes

### Failure Type Taxonomy

```typescript
type FailureCategory =
  | 'file_not_found'          // Required file doesn't exist
  | 'permission_denied'       // Insufficient permissions
  | 'timeout'                 // Task exceeded time limit
  | 'validation_pattern'      // Pattern matching failed
  | 'validation_forbidden'    // Forbidden pattern found
  | 'token_limit'             // LLM response truncated
  | 'prompt_ambiguity'        // Agent misunderstood task
  | 'missing_context'         // Required impulse not available
  | 'tool_error'              // Tool invocation failed
  | 'dependency_failure'      // Upstream task failed
  | 'external_service'        // API/service unavailable
  | 'syntax_error'            // Code/config syntax invalid
  | 'environment_mismatch'    // Wrong environment state
  | 'unknown'                 // Unclassified failure

interface FailureAnalysis {
  category: FailureCategory
  confidence: number  // 0.0-1.0
  evidence: string[]  // Supporting evidence from trace
  taskId: string      // Which task failed
  toolCalls: ToolCallRecord[]  // Tool calls before failure
  errorMessage: string
  stateAtFailure: {
    filesAvailable: string[]
    impulsesLoaded: string[]
    variablesProvided: Record<string, unknown>
  }
}
```

### Failure Pattern Detection

**From execution trace analysis:**

```typescript
function analyzeFailure(trace: ExecutionTrace): FailureAnalysis {
  const { error, tasks, state } = trace

  // 1. Check error message patterns
  if (error.includes('ENOENT') || error.includes('not found')) {
    return {
      category: 'file_not_found',
      confidence: 0.9,
      evidence: [
        `Error message: ${error}`,
        `Files available: ${state.filesAvailable.join(', ')}`
      ]
    }
  }

  // 2. Check validation failures
  const failedTask = tasks.find(t => t.status === 'failed')
  if (failedTask?.validation) {
    const { requiredFiles, requiredPatterns, forbiddenPatterns } = failedTask.validation

    if (requiredFiles && error.includes('required file')) {
      return { category: 'file_not_found', confidence: 0.95, ... }
    }

    if (requiredPatterns && error.includes('pattern not found')) {
      return { category: 'validation_pattern', confidence: 0.9, ... }
    }

    if (forbiddenPatterns && error.includes('forbidden pattern')) {
      return { category: 'validation_forbidden', confidence: 0.95, ... }
    }
  }

  // 3. Check tool failures
  const failedToolCall = trace.toolCalls?.find(tc => !tc.success)
  if (failedToolCall) {
    if (failedToolCall.tool === 'bash' && failedToolCall.exitCode !== 0) {
      return { category: 'tool_error', confidence: 0.8, ... }
    }
  }

  // 4. Check token limits
  if (error.includes('truncated') || error.includes('max_tokens')) {
    return { category: 'token_limit', confidence: 0.9, ... }
  }

  // 5. Check timeouts
  if (error.includes('timeout') || error.includes('timed out')) {
    return { category: 'timeout', confidence: 1.0, ... }
  }

  return { category: 'unknown', confidence: 0.5, ... }
}
```

---

## Variant Creation Logic

### Core Algorithm

```typescript
async function createVariant(
  baseTemplate: ActivityTemplate,
  failureAnalysis: FailureAnalysis,
  executionTrace: ExecutionTrace
): Promise<ActivityTemplate> {

  // 1. Check generation limit (prevent infinite variant chains)
  const generation = getVariantGeneration(baseTemplate)
  if (generation >= MAX_VARIANT_GENERATIONS) {
    log.warn(`Max variant generation (${MAX_VARIANT_GENERATIONS}) reached for ${baseTemplate.id}`)
    return null
  }

  // 2. Clone template structure
  const variantId = generateVariantId(baseTemplate.id, generation + 1)
  const variant: ActivityTemplate = {
    ...baseTemplate,
    id: variantId,
    name: `${baseTemplate.name} (Variant ${generation + 1})`,
    version: baseTemplate.version + 1,
    variant_of: baseTemplate.id,  // Lineage tracking
    metadata: {
      ...baseTemplate.metadata,
      variant_generation: generation + 1,
      variant_reason: failureAnalysis.category,
      source_execution_id: executionTrace.id,
      created_from_failure: true,
      expected_improvement: estimateImprovement(failureAnalysis)
    }
  }

  // 3. Apply expectation adjustments based on failure category
  applyExpectationAdjustments(variant, failureAnalysis, executionTrace)

  // 4. Initialize Thompson Sampling scores
  variant.thompson_alpha = 1  // Start neutral
  variant.thompson_beta = 1

  return variant
}

function getVariantGeneration(template: ActivityTemplate): number {
  if (!template.variant_of) return 0
  return (template.metadata?.variant_generation || 0) + 1
}

function generateVariantId(baseId: string, generation: number): string {
  // Remove existing variant suffix if present
  const cleanId = baseId.replace(/-v\d+$/, '')
  return `${cleanId}-v${generation}`
}
```

### Expectation Adjustment Rules

Each failure category has specific adjustment strategies:

#### 1. `file_not_found` → Add File Discovery Step

**Problem**: Template expects file to exist, but it doesn't.

**Adjustment**: Add pre-validation step to discover file location.

```typescript
function adjustForFileNotFound(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)

  // Extract missing file path from error
  const missingFile = extractFilePathFromError(analysis.errorMessage)

  // Add file discovery step BEFORE the failed task
  const discoveryTask = {
    id: `${analysis.taskId}-file-discovery`,
    description: `Locate ${missingFile} or similar file`,
    dependencies: failedTask.dependencies || [],
    prompt: {
      template: `**File Discovery**: The template expects file "${missingFile}" but it may not exist at that exact path.

**Your task**: Find the file or an equivalent file:

1. Check if ${missingFile} exists:
   \`\`\`bash
   ls ${missingFile} 2>/dev/null || echo "NOT_FOUND"
   \`\`\`

2. If not found, search for similar files:
   \`\`\`bash
   find . -name "*${path.basename(missingFile)}*" -type f
   \`\`\`

3. Create variable \`discovered_file_path\` with the actual path found.

**Important**: If no file is found, fail fast with clear error.`,
    },
    validation: {
      requiredPatterns: [
        { pattern: 'discovered_file_path', description: 'Must set the discovered path variable' }
      ]
    },
    tools: { required: ['bash'], optional: ['read'] }
  }

  // Insert discovery task before failed task
  const taskIndex = variant.tasks.findIndex(t => t.id === analysis.taskId)
  variant.tasks.splice(taskIndex, 0, discoveryTask)

  // Update failed task to use discovered path
  failedTask.dependencies.push(discoveryTask.id)
  failedTask.prompt.template = failedTask.prompt.template.replace(
    missingFile,
    '{{discovered_file_path}}'
  )

  // Relax validation - file may be in different location
  if (failedTask.validation?.requiredFiles) {
    failedTask.validation.requiredFiles = failedTask.validation.requiredFiles.map(f =>
      f === missingFile ? '{{discovered_file_path}}' : f
    )
  }
}
```

#### 2. `validation_pattern` → Relax Pattern Matching

**Problem**: Expected pattern not found in output.

**Adjustment**: Make pattern optional or add clarification step.

```typescript
function adjustForValidationPattern(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)
  const { requiredPatterns } = failedTask.validation

  // Identify which pattern failed
  const failedPattern = identifyFailedPattern(analysis.errorMessage, requiredPatterns)

  if (!failedPattern) return

  // Strategy 1: Make pattern case-insensitive if it's a text match
  if (!failedPattern.pattern.includes('(?i)')) {
    failedPattern.pattern = `(?i)${failedPattern.pattern}`
  }

  // Strategy 2: Convert to optional if confidence is low
  if (analysis.confidence < 0.7) {
    failedTask.validation.optionalPatterns = failedTask.validation.optionalPatterns || []
    failedTask.validation.optionalPatterns.push(failedPattern)

    // Remove from required
    failedTask.validation.requiredPatterns = requiredPatterns.filter(
      p => p.pattern !== failedPattern.pattern
    )
  }

  // Strategy 3: Add clarification to prompt
  failedTask.prompt.template += `\n\n**IMPORTANT**: Ensure output includes: "${failedPattern.description}"\nPattern to match: \`${failedPattern.pattern}\``
}
```

#### 3. `timeout` → Increase Time + Add Checkpoints

**Problem**: Task took too long to complete.

**Adjustment**: Increase timeout, add retry attempts, decompose if too complex.

```typescript
function adjustForTimeout(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)

  // Strategy 1: Increase timeout by 50%
  failedTask.timeout = (failedTask.timeout || 120000) * 1.5

  // Strategy 2: Increase max retry attempts
  failedTask.retry = {
    ...failedTask.retry,
    maxAttempts: Math.min((failedTask.retry?.maxAttempts || 2) + 1, 5)
  }

  // Strategy 3: Add progress checkpoint hints to prompt
  failedTask.prompt.template = `**Time Management**: This task has a ${failedTask.timeout}ms timeout.

Break work into small steps and report progress:
- After each major step, echo "PROGRESS: [step description]"
- This helps track execution and resume if needed

${failedTask.prompt.template}`

  // Strategy 4: If task is very complex (many tool calls before failure), suggest decomposition
  if (analysis.toolCalls.length > 10) {
    variant.metadata.suggested_improvements = variant.metadata.suggested_improvements || []
    variant.metadata.suggested_improvements.push({
      type: 'task_decomposition',
      reason: 'Task has >10 tool calls and times out - consider splitting',
      taskId: analysis.taskId
    })
  }
}
```

#### 4. `token_limit` → Increase Budget + Add Compression

**Problem**: LLM response was truncated due to token limits.

**Adjustment**: Increase max_tokens, add compression strategy hints.

```typescript
function adjustForTokenLimit(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)

  // Increase max_tokens by 30%
  const currentMaxTokens = failedTask.prompt.maxTokens || 4000
  failedTask.prompt.maxTokens = Math.min(currentMaxTokens * 1.3, 16000)

  // Add compression strategy
  failedTask.prompt.compressionStrategy = 'progressive'

  // Add compression hints to prompt
  failedTask.prompt.template = `**Token Efficiency**: This task has a ${failedTask.prompt.maxTokens} token limit.

Use compression strategies:
- Summarize verbose output
- Use references instead of full content
- Prioritize critical information

${failedTask.prompt.template}`
}
```

#### 5. `prompt_ambiguity` → Add Examples + Clarify

**Problem**: Agent misunderstood the task requirements.

**Adjustment**: Add explicit examples and step-by-step instructions.

```typescript
function adjustForPromptAmbiguity(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)

  // Analyze what went wrong from tool calls
  const incorrectApproach = analyzeIncorrectApproach(analysis.toolCalls)

  // Add explicit "WRONG" and "RIGHT" examples
  const clarification = `

**⚠️ IMPORTANT - Common Mistake**:
DO NOT: ${incorrectApproach.description}
${incorrectApproach.example}

**✅ CORRECT APPROACH**:
${generateCorrectExample(failedTask, analysis)}

**Step-by-step**:
1. ${extractSteps(failedTask.description)[0]}
2. ${extractSteps(failedTask.description)[1]}
3. ${extractSteps(failedTask.description)[2]}
`

  // Insert clarification at the beginning of the prompt
  failedTask.prompt.template = clarification + '\n\n' + failedTask.prompt.template
}
```

#### 6. `missing_context` → Add Required Impulses

**Problem**: Task needed information that wasn't available.

**Adjustment**: Add impulse definitions to provide missing context.

```typescript
function adjustForMissingContext(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)

  // Identify missing information from error/tool calls
  const missingInfo = identifyMissingInformation(analysis)

  for (const info of missingInfo) {
    // Create impulse pointer for missing context
    const impulseId = `${analysis.taskId}-${info.type}-context`
    const impulse: ImpulseDefinition = {
      id: impulseId,
      pointer: {
        type: info.type,  // e.g., 'activityMetrics', 'recentExecutions'
        ...info.params
      },
      budget: info.estimatedTokens || 2000,
      priority: 'high',
      description: info.description
    }

    // Add to template-level impulses
    variant.impulses = variant.impulses || []
    variant.impulses.push(impulse)

    // Add to task's impulse references
    failedTask.impulseReferences = failedTask.impulseReferences || []
    failedTask.impulseReferences.push(impulseId)

    // Update prompt to reference the impulse
    failedTask.prompt.template = `**Context Available**: ${info.description} is available in the \`${impulseId}\` impulse.

${failedTask.prompt.template}`
  }
}
```

#### 7. `validation_forbidden` → Remove Overly Strict Rules

**Problem**: Template forbids something that's actually necessary.

**Adjustment**: Remove or relax forbidden pattern rules.

```typescript
function adjustForValidationForbidden(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)
  const { forbiddenPatterns } = failedTask.validation

  // Identify which forbidden pattern was triggered
  const triggeredPattern = identifyTriggeredForbiddenPattern(analysis.errorMessage, forbiddenPatterns)

  if (!triggeredPattern) return

  // Strategy: Move to "discouraged" patterns (warning, not failure)
  failedTask.validation.discouragedPatterns = failedTask.validation.discouragedPatterns || []
  failedTask.validation.discouragedPatterns.push({
    ...triggeredPattern,
    severity: 'warning'
  })

  // Remove from forbidden
  failedTask.validation.forbiddenPatterns = forbiddenPatterns.filter(
    p => p.pattern !== triggeredPattern.pattern
  )

  // Add explanation to prompt
  failedTask.prompt.template += `\n\n**Note**: Avoid "${triggeredPattern.description}" when possible, but it's acceptable if necessary.`
}
```

#### 8. `tool_error` → Add Error Handling

**Problem**: Tool invocation failed unexpectedly.

**Adjustment**: Add error handling and fallback strategies.

```typescript
function adjustForToolError(
  variant: ActivityTemplate,
  analysis: FailureAnalysis
): void {
  const failedTask = variant.tasks.find(t => t.id === analysis.taskId)
  const failedTool = analysis.toolCalls.find(tc => !tc.success)?.tool

  if (!failedTool) return

  // Add error handling guidance to prompt
  const errorHandling = `

**Error Handling for ${failedTool}**:
- Check tool output for errors before proceeding
- If ${failedTool} fails, try alternative approach:
  ${getAlternativeApproach(failedTool)}
- Use error messages to guide next steps

**Example**:
\`\`\`bash
result=$(${failedTool} ... 2>&1)
if [ $? -ne 0 ]; then
  echo "ERROR: ${failedTool} failed: $result"
  # Try alternative...
fi
\`\`\`
`

  failedTask.prompt.template = errorHandling + '\n\n' + failedTask.prompt.template

  // Increase retry attempts for tool failures
  failedTask.retry = {
    ...failedTask.retry,
    maxAttempts: Math.min((failedTask.retry?.maxAttempts || 2) + 1, 4)
  }
}
```

---

## Variant Lineage Tracking

### Schema Structure

**In SurrealDB `activity` table:**

```surql
DEFINE FIELD variant_of ON activity TYPE option<string>
  COMMENT "Activity ID this is a variant of (parent)";

DEFINE FIELD variant_generation ON activity TYPE option<int>
  VALUE $value OR 0
  COMMENT "How many generations removed from original (0 = original, 1 = first variant, etc.)";

DEFINE FIELD variant_reason ON activity TYPE option<string>
  COMMENT "Failure category that prompted this variant creation";

DEFINE FIELD source_execution_id ON activity TYPE option<string>
  COMMENT "Execution ID that failed and led to this variant";

DEFINE FIELD expected_improvement ON activity TYPE option<object> FLEXIBLE
  COMMENT "Estimated improvement metrics: { success_rate_delta: +0.15, addresses_category: 'timeout' }";
```

**In TypeScript:**

```typescript
interface ActivityTemplate {
  id: string
  name: string
  variant_of?: string  // Parent template ID
  metadata?: {
    variant_generation?: number
    variant_reason?: FailureCategory
    source_execution_id?: string
    expected_improvement?: {
      success_rate_delta: number  // e.g., +0.15 = expect 15% improvement
      addresses_category: FailureCategory
    }
    created_from_failure?: boolean
  }
}
```

### Variant Family Queries

**Get all variants of a template:**

```typescript
async function getVariantFamily(baseTemplateId: string): Promise<ActivityTemplate[]> {
  const db = await getDB()

  // Get direct variants
  const directVariants = await db.query(`
    SELECT * FROM activity
    WHERE variant_of = $baseId
    ORDER BY variant_generation ASC
  `, { baseId: baseTemplateId })

  // Get transitive variants (variants of variants)
  const allVariants = [baseTemplate]
  for (const variant of directVariants) {
    const childVariants = await getVariantFamily(variant.id)
    allVariants.push(...childVariants)
  }

  return allVariants
}
```

**Get best-performing variant:**

```typescript
async function getBestVariant(baseTemplateId: string): Promise<ActivityTemplate> {
  const db = await getDB()

  const result = await db.query(`
    SELECT
      a.*,
      m.success_rate,
      m.thompson_alpha,
      m.thompson_beta,
      m.total_executions
    FROM activity a
    JOIN template_metrics m ON a.id = m.id
    WHERE a.id = $baseId OR a.variant_of = $baseId
    ORDER BY m.success_rate DESC, m.total_executions DESC
    LIMIT 1
  `, { baseId: baseTemplateId })

  return result[0]
}
```

---

## Retry Integration

### When to Create Variants

**Trigger points:**

1. **Immediate on failure** (if confidence > 0.7)
2. **After 2+ failures of same template** (pattern detection)
3. **Manual trigger** (user/admin requests variant creation)

### Retry Strategy

```typescript
async function handleActivityFailure(
  template: ActivityTemplate,
  execution: ExecutionTrace,
  analysis: FailureAnalysis
): Promise<void> {

  // 1. Record failure in Thompson Sampling
  await updateThompsonScores(template.id, { success: false })

  // 2. Check if variant creation is warranted
  const shouldCreateVariant = (
    analysis.confidence > 0.7 &&  // High confidence in failure cause
    analysis.category !== 'unknown' &&  // Categorized failure
    getVariantGeneration(template) < MAX_VARIANT_GENERATIONS  // Not too deep
  )

  if (!shouldCreateVariant) {
    log.info(`Skipping variant creation for ${template.id}: confidence=${analysis.confidence}, category=${analysis.category}`)
    return
  }

  // 3. Create variant
  const variant = await createVariant(template, analysis, execution)

  // 4. Register with backend
  await registerVariant(variant)

  // 5. Queue for retry (optional - can be immediate or deferred)
  if (IMMEDIATE_RETRY_ENABLED) {
    await retryWithVariant(variant, execution.variables)
  } else {
    await queueForRetry(variant.id, execution.variables)
  }
}
```

### Retry Execution

```typescript
async function retryWithVariant(
  variant: ActivityTemplate,
  originalVariables: Record<string, unknown>
): Promise<ExecutionTrace> {

  log.info(`[Retry] Executing variant ${variant.id} with original variables`)

  const executor = new ActivityExecutor({
    template: variant,
    variables: originalVariables,
    reason: 'variant_retry'
  })

  const result = await executor.execute()

  // Record outcome
  if (result.status === 'completed') {
    log.info(`[Retry] Variant ${variant.id} succeeded! Marking parent as superseded.`)
    await markVariantAsSuccessful(variant.id, variant.variant_of)
  } else {
    log.warn(`[Retry] Variant ${variant.id} also failed. May need further variant creation.`)
  }

  return result
}
```

---

## Loop Prevention

### Generation Limit

```typescript
const MAX_VARIANT_GENERATIONS = 5  // Prevent infinite variant chains

function preventVariantLoop(template: ActivityTemplate): boolean {
  const generation = getVariantGeneration(template)

  if (generation >= MAX_VARIANT_GENERATIONS) {
    log.warn(`Variant generation limit reached for ${template.id} (gen ${generation})`)

    // Mark template family as problematic
    flagTemplateFamily(template.variant_of || template.id, {
      reason: 'excessive_variants',
      max_generation: generation,
      suggestion: 'Manual review needed - template may have fundamental issues'
    })

    return false  // Don't create more variants
  }

  return true
}
```

### Similarity Detection

Prevent creating redundant variants that are too similar to existing ones:

```typescript
async function checkVariantSimilarity(
  proposedVariant: ActivityTemplate,
  existingVariants: ActivityTemplate[]
): Promise<boolean> {

  for (const existing of existingVariants) {
    const similarity = calculateTemplateSimilarity(proposedVariant, existing)

    if (similarity > 0.85) {  // Very similar
      log.info(`Proposed variant is ${similarity * 100}% similar to ${existing.id} - skipping creation`)

      // Instead, boost existing variant's Thompson score
      await updateThompsonScores(existing.id, { bonus: 0.1 })

      return false  // Don't create redundant variant
    }
  }

  return true  // Variant is sufficiently different
}

function calculateTemplateSimilarity(
  template1: ActivityTemplate,
  template2: ActivityTemplate
): number {
  // Compare task structures
  const taskSimilarity = compareTaskArrays(template1.tasks, template2.tasks)

  // Compare validation rules
  const validationSimilarity = compareValidationRules(
    template1.tasks.map(t => t.validation),
    template2.tasks.map(t => t.validation)
  )

  // Compare prompts (using simple text similarity)
  const promptSimilarity = comparePrompts(
    template1.tasks.map(t => t.prompt.template),
    template2.tasks.map(t => t.prompt.template)
  )

  // Weighted average
  return (
    taskSimilarity * 0.4 +
    validationSimilarity * 0.3 +
    promptSimilarity * 0.3
  )
}
```

### Decay Mechanism

Old, unused variants should decay in Thompson Sampling scores:

```typescript
async function applyVariantDecay(): Promise<void> {
  const db = await getDB()

  const OLD_VARIANT_THRESHOLD_DAYS = 30
  const DECAY_FACTOR = 0.95

  await db.query(`
    UPDATE activity
    SET
      thompson_alpha = thompson_alpha * ${DECAY_FACTOR},
      thompson_beta = thompson_beta * ${DECAY_FACTOR}
    WHERE
      variant_of IS NOT NONE
      AND last_executed_at < time::now() - duration::from::days(${OLD_VARIANT_THRESHOLD_DAYS})
      AND total_executions < 10
  `)

  log.info(`Applied decay to old, unused variants`)
}
```

---

## Backend Schema Modifications

### New Fields in `activity` Table

```surql
-- Already exists in 020-paradigm-core-tables.surql:
DEFINE FIELD IF NOT EXISTS variant_of ON activity TYPE option<string>
  COMMENT "Activity ID this is a variant of";

-- New fields to add:
DEFINE FIELD IF NOT EXISTS variant_generation ON activity TYPE option<int>
  VALUE $value OR 0
  COMMENT "Generation depth (0=original, 1=first variant, 2=variant of variant, etc.)";

DEFINE FIELD IF NOT EXISTS variant_reason ON activity TYPE option<string>
  COMMENT "Failure category that prompted this variant: file_not_found, timeout, etc.";

DEFINE FIELD IF NOT EXISTS source_execution_id ON activity TYPE option<string>
  COMMENT "Execution ID that failed and led to this variant creation";

DEFINE FIELD IF NOT EXISTS expected_improvement ON activity TYPE option<object> FLEXIBLE
  COMMENT "Expected performance improvement from this variant";

DEFINE FIELD IF NOT EXISTS superseded_by ON activity TYPE option<string>
  COMMENT "If a variant performs better, this points to the superior variant";

DEFINE FIELD IF NOT EXISTS deprecation_reason ON activity TYPE option<string>
  COMMENT "Why this variant was deprecated (if applicable)";
```

### New Index

```surql
DEFINE INDEX IF NOT EXISTS idx_activity_variant_family ON activity FIELDS variant_of;
DEFINE INDEX IF NOT EXISTS idx_activity_generation ON activity FIELDS variant_generation;
```

### New Endpoint: POST /v2/activities/variants/create

```typescript
router.post('/variants/create', async (c) => {
  const { base_template_id, execution_id, failure_analysis } = await c.req.json()

  // 1. Fetch base template
  const baseTemplate = await db.select(base_template_id)

  // 2. Fetch execution trace
  const executionTrace = await db.query(`
    SELECT * FROM execution WHERE id = $execId
  `, { execId: execution_id })

  // 3. Create variant
  const variant = await createVariant(baseTemplate, failure_analysis, executionTrace[0])

  // 4. Register variant
  const result = await db.create('activity', variant)

  // 5. Initialize Thompson Sampling
  await db.create('template_metrics', {
    id: variant.id,
    thompson_alpha: 1,
    thompson_beta: 1,
    total_executions: 0,
    successful_executions: 0,
    failed_executions: 0
  })

  return c.json({
    variant_id: variant.id,
    parent_id: base_template_id,
    generation: variant.metadata.variant_generation,
    expected_improvement: variant.metadata.expected_improvement
  })
})
```

---

## Integration Points in MiniBob

### 1. Activity Executor Failure Handler

**File**: `repos/minibob/src/activity.ts`

**Location**: After task execution fails (around line 2200-2400)

```typescript
// In executeTask() method, after validation failure:

if (!validationPassed) {
  log.error(`Task ${task.id} validation failed`)

  // NEW: Trigger variant creation if enabled
  if (this.options.enableVariantCreation) {
    const failureAnalysis = await analyzeTaskFailure(
      task,
      this.template,
      this.executionTrace
    )

    if (failureAnalysis.confidence > 0.7) {
      const mcp = getMCPClient()
      if (mcp) {
        await mcp.createVariant({
          base_template_id: this.template.id,
          execution_id: this.executionId,
          failure_analysis: failureAnalysis
        })
      }
    }
  }

  return { success: false, error: validationErrorMsg }
}
```

### 2. Goal Processor Integration

**File**: `repos/minibob/src/goal-processor.ts`

**Location**: After improvisation fails

```typescript
// In improvisationWithMultipleTurns(), after failure:

if (improvResult.outcome === 'failure') {
  const analysis = analyzeImprovisationFailure(improvResult)
  const attemptTemplate = await extractAttemptTemplate(improvResult, analysis)

  // Register attempt
  if (mcp) {
    await mcp.registerTemplate(attemptTemplate)
  }

  // NEW: Create variant with adjustments
  const variant = await createVariantFromAttempt(attemptTemplate, analysis)

  // Register variant
  if (mcp && variant) {
    await mcp.registerTemplate(variant)

    // Queue for retry
    await queueVariantRetry(variant.id, goal.variables)
  }
}
```

### 3. MCP Client Methods

**File**: `repos/minibob/src/mcp.ts`

```typescript
class MCPClient {
  // ... existing methods ...

  async createVariant(params: {
    base_template_id: string
    execution_id: string
    failure_analysis: FailureAnalysis
  }): Promise<{ variant_id: string }> {
    const response = await this.request({
      method: 'POST',
      url: '/v2/activities/variants/create',
      body: params
    })

    log.info(`Created variant ${response.variant_id} from ${params.base_template_id}`)
    return response
  }

  async getVariantFamily(baseTemplateId: string): Promise<ActivityTemplate[]> {
    const response = await this.request({
      method: 'GET',
      url: `/v2/activities/variants/family/${baseTemplateId}`
    })

    return response.variants
  }

  async getBestVariant(baseTemplateId: string): Promise<ActivityTemplate> {
    const response = await this.request({
      method: 'GET',
      url: `/v2/activities/variants/best/${baseTemplateId}`
    })

    return response.variant
  }
}
```

---

## Expected Improvement Estimation

```typescript
function estimateImprovement(analysis: FailureAnalysis): {
  success_rate_delta: number
  confidence: number
} {
  // Map failure categories to expected improvement
  const improvementMap: Record<FailureCategory, number> = {
    'file_not_found': 0.3,        // Adding discovery step should help significantly
    'validation_pattern': 0.2,     // Relaxing patterns helps moderately
    'timeout': 0.15,               // More time helps, but may indicate deeper issue
    'token_limit': 0.25,           // More tokens directly addresses problem
    'prompt_ambiguity': 0.35,      // Clearer prompts have high impact
    'missing_context': 0.4,        // Adding required context is very effective
    'validation_forbidden': 0.2,   // Removing overly strict rules helps
    'tool_error': 0.1,             // Error handling helps, but may recur
    'permission_denied': 0.05,     // Difficult to fix without environment changes
    'dependency_failure': 0.1,     // Upstream issue, variant may not help much
    'external_service': 0.05,      // Outside our control
    'syntax_error': 0.3,           // Examples and guidance help
    'environment_mismatch': 0.1,   // Hard to fix in template alone
    'unknown': 0.05                // Unknown cause = low confidence fix
  }

  const baseImprovement = improvementMap[analysis.category] || 0.1

  // Adjust by confidence in the analysis
  const adjustedImprovement = baseImprovement * analysis.confidence

  return {
    success_rate_delta: adjustedImprovement,
    confidence: analysis.confidence
  }
}
```

---

## Success Metrics

**Track these metrics to validate variant creation effectiveness:**

```typescript
interface VariantMetrics {
  // Creation metrics
  total_variants_created: number
  variants_by_category: Record<FailureCategory, number>
  avg_generation_depth: number
  max_generation_depth: number

  // Performance metrics
  parent_vs_variant_success_rate: {
    parent: number
    variant: number
    delta: number  // Should be positive if variants work
  }

  // Efficiency metrics
  variant_retry_success_rate: number  // % of variants that succeed on first retry
  redundant_variants_prevented: number  // Via similarity detection

  // Learning metrics
  most_effective_adjustments: Array<{
    category: FailureCategory
    avg_improvement: number
    sample_size: number
  }>

  // Health metrics
  max_generation_limit_hit: number  // How often we hit the limit
  deprecated_variants: number  // Variants that performed worse
}
```

---

## Implementation Checklist

### Phase 1: Infrastructure (2-3 hours)

- [ ] Add new fields to `activity` table schema
- [ ] Create variant creation endpoint in backend
- [ ] Add MCP client methods for variant operations
- [ ] Implement failure analysis function
- [ ] Implement variant ID generation logic

### Phase 2: Adjustment Rules (4-6 hours)

- [ ] Implement `file_not_found` adjustment
- [ ] Implement `validation_pattern` adjustment
- [ ] Implement `timeout` adjustment
- [ ] Implement `token_limit` adjustment
- [ ] Implement `prompt_ambiguity` adjustment
- [ ] Implement `missing_context` adjustment
- [ ] Implement `validation_forbidden` adjustment
- [ ] Implement `tool_error` adjustment

### Phase 3: Integration (2-3 hours)

- [ ] Hook variant creation into Activity Executor
- [ ] Hook variant creation into Goal Processor
- [ ] Implement retry-with-variant logic
- [ ] Add variant selection to Thompson Sampling

### Phase 4: Loop Prevention (1-2 hours)

- [ ] Implement generation limit checking
- [ ] Implement similarity detection
- [ ] Implement decay mechanism
- [ ] Add variant family flagging

### Phase 5: Testing & Metrics (2-3 hours)

- [ ] Create test cases for each failure category
- [ ] Verify variant creation from failures
- [ ] Validate retry behavior
- [ ] Track variant metrics in dashboard

**Total Estimated Effort**: 11-17 hours

---

## Example End-to-End Flow

**Scenario**: Activity `debug-activity-self-contained` fails because it expects file `error.log` but it's actually `error.txt`.

### 1. Execution Fails

```json
{
  "execution_id": "exec_abc123",
  "template_id": "debug-activity-self-contained",
  "status": "failed",
  "error": "Validation failed: Required file not found: error.log",
  "tasks": [
    {
      "id": "analyze-error",
      "status": "failed",
      "validation": {
        "requiredFiles": ["error.log"]
      }
    }
  ]
}
```

### 2. Failure Analysis

```json
{
  "category": "file_not_found",
  "confidence": 0.95,
  "evidence": [
    "Error message contains 'not found'",
    "File 'error.log' in requiredFiles but not in filesAvailable",
    "State shows error.txt exists instead"
  ],
  "taskId": "analyze-error"
}
```

### 3. Variant Created

```json
{
  "id": "debug-activity-self-contained-v2",
  "name": "Debug Activity Self-Contained (Variant 2)",
  "variant_of": "debug-activity-self-contained",
  "metadata": {
    "variant_generation": 1,
    "variant_reason": "file_not_found",
    "source_execution_id": "exec_abc123",
    "expected_improvement": {
      "success_rate_delta": 0.3,
      "confidence": 0.95
    }
  },
  "tasks": [
    {
      "id": "analyze-error-file-discovery",
      "description": "Locate error log file",
      "dependencies": [],
      "prompt": {
        "template": "Find error log file (may be error.log or error.txt):\n\nls error.* 2>/dev/null || find . -name '*error*.log' -o -name '*error*.txt'\n\nSet discovered_file_path variable with the actual path."
      }
    },
    {
      "id": "analyze-error",
      "description": "Analyze the error from the log file",
      "dependencies": ["analyze-error-file-discovery"],
      "prompt": {
        "template": "Read the error log from {{discovered_file_path}} and analyze..."
      },
      "validation": {
        "requiredFiles": ["{{discovered_file_path}}"]
      }
    }
  ]
}
```

### 4. Retry Succeeds

```json
{
  "execution_id": "exec_def456",
  "template_id": "debug-activity-self-contained-v2",
  "status": "completed",
  "tasks": [
    {
      "id": "analyze-error-file-discovery",
      "status": "completed",
      "output": "discovered_file_path=error.txt"
    },
    {
      "id": "analyze-error",
      "status": "completed"
    }
  ]
}
```

### 5. Thompson Sampling Updated

```
Original template:
  alpha: 5, beta: 3 → success_rate ≈ 0.625

Variant v2:
  alpha: 2, beta: 1 → success_rate ≈ 0.667

Variant selected 60% of the time due to higher score.
```

---

## Summary

The variant creation system is the **mechanism of expectation adjustment** that enables MiniBob to learn from failures. By analyzing failure patterns and systematically modifying template expectations (validation rules, prompts, context requirements), the system progressively improves success rates without manual intervention.

**Key Design Principles:**

1. **Categorize precisely** - Different failure types need different adjustments
2. **Adjust expectations** - Not "fixes" but adjusted assumptions about what's possible
3. **Track lineage** - Understand variant evolution and prevent loops
4. **Prevent redundancy** - Don't create duplicate variants via similarity detection
5. **Decay naturally** - Old, unused variants fade away via Thompson Sampling
6. **Learn continuously** - Every failure creates an opportunity to improve

The system shifts from "failing repeatedly" to "learning from failure" through structured, automated template evolution.
