# Improvisational Template Creation

## The Insight

> Don't plan templates - **improvise toward goals and record what worked**. Templates are crystallized successful improvisations.

## Current Approach (Wrong)

```
❌ PLANNING-FIRST
1. Think about goal
2. Design perfect template
3. Write JSON with tasks
4. Execute template
5. Hope it works

Problems:
- Requires predicting the right approach
- Template may not match reality
- Wastes time planning
- Limits discovery
```

## New Approach (Right)

```
✅ IMPROVISATION-FIRST
1. Receive goal
2. Improvise solution (LLM + tools)
3. Record everything that happened
4. Extract template from successful trace
5. Review and create variants

Benefits:
- Discovers what actually works
- Templates reflect reality
- No wasted planning
- Enables continuous learning
```

## The Process

### Phase 1: Improvise (Becoming)

**Input:** User goal as natural language

```bash
# User provides goal
minibob improvise "Add user authentication to the API"

# MiniBob responds:
"I'll work on this goal step by step, recording everything..."
```

**What happens:**
1. LLM receives goal with **no predefined template**
2. LLM decides what to do first (understand codebase? read files? analyze?)
3. Uses tools as needed (bash, read, edit, git)
4. Makes decisions dynamically based on what it finds
5. Continues until goal achieved or stuck
6. **Every step is recorded in execution trace**

**Example improvisation trace:**
```json
{
  "execution_id": "exec_improvise_20260323_001",
  "goal": "Add user authentication to the API",
  "improvisation": true,
  "steps": [
    {
      "step": 1,
      "thought": "Need to understand current API structure",
      "action": "read",
      "params": {"file": "src/index.ts"},
      "result": "API has 5 endpoints, no auth middleware",
      "duration_ms": 1200
    },
    {
      "step": 2,
      "thought": "Check if auth library already installed",
      "action": "bash",
      "params": {"command": "grep -r 'passport\\|jwt' package.json"},
      "result": "No auth libraries found",
      "duration_ms": 300
    },
    {
      "step": 3,
      "thought": "Install JWT library",
      "action": "bash",
      "params": {"command": "bun add jsonwebtoken @types/jsonwebtoken"},
      "result": "Installed successfully",
      "duration_ms": 2500
    },
    {
      "step": 4,
      "thought": "Create auth middleware",
      "action": "write",
      "params": {
        "file": "src/middleware/auth.ts",
        "content": "// JWT authentication middleware..."
      },
      "result": "File created",
      "duration_ms": 3000
    },
    {
      "step": 5,
      "thought": "Add middleware to routes",
      "action": "edit",
      "params": {
        "file": "src/index.ts",
        "old": "app.get('/api/users'",
        "new": "app.get('/api/users', authMiddleware"
      },
      "result": "Modified 5 routes",
      "duration_ms": 2200
    },
    {
      "step": 6,
      "thought": "Test that protected routes work",
      "action": "bash",
      "params": {"command": "curl -H 'Authorization: Bearer test' http://localhost:3000/api/users"},
      "result": "401 Unauthorized (correct behavior)",
      "duration_ms": 500
    }
  ],
  "outcome": {
    "status": "success",
    "goal_achieved": true,
    "total_duration_ms": 15700,
    "total_cost": 0.0234,
    "files_modified": ["src/index.ts", "package.json"],
    "files_created": ["src/middleware/auth.ts"]
  }
}
```

### Phase 2: Extract (Instance → Vessel)

**Automatic extraction** after successful improvisation:

```typescript
// Ribosome automatically triggers
async function extractTemplateFromImprovisation(
  execution: ImprovisationTrace
): Promise<ActivityTemplate> {
  // 1. Identify task boundaries (logical groupings of steps)
  const tasks = identifyTaskBoundaries(execution.steps)
  // Example: Steps 1-2 = "understand", Steps 3 = "install", Steps 4-5 = "implement", Step 6 = "validate"

  // 2. Generalize the steps (extract variables)
  const generalizedTasks = tasks.map(task => ({
    id: generateTaskId(task),
    description: summarizeTask(task.steps),
    prompt: {
      template: extractPromptPattern(task.steps),
      variables: identifyVariables(task.steps)
    },
    validation: extractValidation(task.steps)
  }))

  // 3. Create template
  return {
    id: `tpl_extracted_${Date.now()}`,
    name: `Add User Authentication`,
    category: inferCategory(execution.goal),
    description: execution.goal,
    tasks: generalizedTasks,
    metadata: {
      extractedFrom: execution.execution_id,
      extractionMethod: "improvisation",
      firstSuccessMetrics: {
        duration: execution.outcome.total_duration_ms,
        cost: execution.outcome.total_cost
      }
    }
  }
}
```

**Resulting template:**
```json
{
  "id": "add-user-authentication-v1",
  "name": "Add User Authentication",
  "category": "feature",
  "extractedFrom": "exec_improvise_20260323_001",
  "tasks": [
    {
      "id": "understand-current-auth",
      "description": "Analyze current API authentication state",
      "prompt": {
        "template": "Analyze {{api_file}} to understand current authentication:\n1. Are there existing auth endpoints?\n2. Is there auth middleware?\n3. What auth libraries are installed?",
        "variables": [
          {"name": "api_file", "source": "variable", "default": "src/index.ts"}
        ]
      }
    },
    {
      "id": "install-auth-library",
      "description": "Install JWT authentication library",
      "prompt": {
        "template": "Install JWT library:\nbun add jsonwebtoken @types/jsonwebtoken\n\nConfirm installation successful.",
        "variables": []
      },
      "validation": {
        "requiredPatterns": [
          {"file": "package.json", "pattern": "jsonwebtoken"}
        ]
      }
    },
    {
      "id": "create-auth-middleware",
      "description": "Implement JWT authentication middleware",
      "prompt": {
        "template": "Create authentication middleware in {{middleware_path}}:\n1. Verify JWT token from Authorization header\n2. Decode and validate token\n3. Attach user to request\n4. Handle errors appropriately",
        "variables": [
          {"name": "middleware_path", "source": "variable", "default": "src/middleware/auth.ts"}
        ]
      },
      "validation": {
        "requiredFiles": ["src/middleware/auth.ts"]
      }
    },
    {
      "id": "apply-middleware",
      "description": "Add auth middleware to protected routes",
      "prompt": {
        "template": "Update {{api_file}}:\n1. Import auth middleware\n2. Apply to routes that need authentication\n3. Leave public routes unprotected",
        "variables": [
          {"name": "api_file", "source": "variable"}
        ]
      }
    },
    {
      "id": "validate-auth",
      "description": "Test authentication works",
      "prompt": {
        "template": "Test authentication:\n1. Try accessing protected route without token (should 401)\n2. Try with valid token (should 200)\n3. Try with invalid token (should 401)",
        "variables": []
      }
    }
  ]
}
```

### Phase 3: Review (Analysis & Variants)

**Analyze the extracted template** in context:

```typescript
interface TemplateReviewContext {
  // The template being reviewed
  template: ActivityTemplate

  // Context from goal sequence
  precedingGoals: string[]      // What goals came before?
  followingGoals: string[]      // What typically comes after?
  goalCluster: string[]         // Related goals in same session

  // Execution metrics
  executions: {
    execution_id: string
    success: boolean
    duration_ms: number
    cost: number
    tokens: TokenUsage
  }[]

  // Tool usage patterns
  toolsUsed: {
    tool: string
    count: number
    avg_duration_ms: number
    success_rate: number
  }[]

  // Error patterns
  errors: {
    error_type: string
    frequency: number
    task_id: string
    recovery_steps?: string[]
  }[]

  // Reliability metrics
  reliability: {
    success_rate: number
    failure_modes: string[]
    recovery_rate: number
  }

  // Similar templates
  similarTemplates: {
    template_id: string
    similarity_score: number
    performance_comparison: {
      faster: boolean
      cheaper: boolean
      more_reliable: boolean
    }
  }[]
}
```

**Review process:**
```typescript
async function reviewAndCreateVariants(
  template: ActivityTemplate,
  context: TemplateReviewContext
): Promise<ActivityTemplate[]> {

  const variants: ActivityTemplate[] = []

  // 1. SPEED VARIANT: If average duration is high
  if (context.executions.some(e => e.duration_ms > 30000)) {
    variants.push(createSpeedOptimizedVariant(template, context))
  }

  // 2. COST VARIANT: If cost is above threshold
  if (context.executions.some(e => e.cost > 0.10)) {
    variants.push(createCostOptimizedVariant(template, context))
  }

  // 3. RELIABILITY VARIANT: If success rate < 80%
  if (context.reliability.success_rate < 0.8) {
    variants.push(createReliabilityOptimizedVariant(template, context))
  }

  // 4. CONTEXT-SPECIFIC VARIANTS: Based on goal sequences
  const goalPatterns = analyzeGoalPatterns(context)
  if (goalPatterns.hasPrerequisitePattern) {
    variants.push(createPrerequisiteAwareVariant(template, goalPatterns))
  }

  // 5. TOOL-OPTIMIZED VARIANTS: Based on tool usage
  if (context.toolsUsed.some(t => t.tool === 'bash' && t.success_rate < 0.9)) {
    variants.push(createToolOptimizedVariant(template, context))
  }

  return variants
}
```

### Example Variants Created from Review

**Original:** `add-user-authentication-v1` (extracted from improvisation)
- Duration: 15.7s
- Cost: $0.0234
- Success rate: 70% (fails if auth library already installed)

**Variant 1:** `add-user-authentication-fast-v1`
```json
{
  "optimizationFocus": "speed",
  "changes": [
    "Parallel: Check auth state + check libraries simultaneously",
    "Skip: Library installation if already present",
    "Simplified: Validation step (faster test)"
  ],
  "expectedImprovements": {
    "duration_ms": -5000,
    "cost": -0.008
  }
}
```

**Variant 2:** `add-user-authentication-reliable-v1`
```json
{
  "optimizationFocus": "reliability",
  "changes": [
    "Added: Pre-flight check for existing auth",
    "Added: Error handling for each step",
    "Added: Rollback capability if validation fails"
  ],
  "expectedImprovements": {
    "success_rate": +0.25
  }
}
```

**Variant 3:** `add-user-authentication-with-tests-v1`
```json
{
  "contextPattern": "followed by 'add tests' goal in 80% of cases",
  "changes": [
    "Added: Create test file for auth middleware",
    "Added: Write integration tests",
    "Added: Run tests as part of validation"
  ],
  "expectedImprovements": {
    "completeness": "Reduces need for follow-up testing goal"
  }
}
```

## Implementation: Goal Improviser

### New Component: `src/improviser.ts`

```typescript
/**
 * Goal Improviser
 *
 * Executes goals without pre-defined templates by improvising
 * with LLM + tools, recording everything for template extraction.
 */

import type { LLMClient } from './llm'
import type { ToolHandler, ToolResult } from './types'
import { createLLMClient } from './llm'
import { createToolHandlers, getAllToolDefinitions } from './tools'

export interface ImprovisationStep {
  step: number
  thought: string        // LLM's reasoning
  action: string         // Tool name
  params: Record<string, unknown>
  result: ToolResult
  duration_ms: number
  timestamp: string
}

export interface ImprovisationTrace {
  execution_id: string
  goal: string
  improvisation: true
  context?: Record<string, unknown>
  steps: ImprovisationStep[]
  outcome: {
    status: 'success' | 'failure' | 'stuck'
    goal_achieved: boolean
    total_duration_ms: number
    total_cost: number
    files_modified: string[]
    files_created: string[]
    error?: string
  }
}

export class GoalImproviser {
  private llm: LLMClient
  private tools: Record<string, ToolHandler>

  constructor() {
    this.llm = createLLMClient()
    this.tools = createToolHandlers()
  }

  /**
   * Improvise toward a goal without a template
   */
  async improvise(
    goal: string,
    context?: Record<string, unknown>
  ): Promise<ImprovisationTrace> {

    const trace: ImprovisationTrace = {
      execution_id: `exec_improvise_${Date.now()}_${randomId()}`,
      goal,
      improvisation: true,
      context,
      steps: [],
      outcome: {
        status: 'success',
        goal_achieved: false,
        total_duration_ms: 0,
        total_cost: 0,
        files_modified: [],
        files_created: []
      }
    }

    const startTime = Date.now()
    let stepNumber = 0
    let goalAchieved = false

    // System prompt for improvisation
    const systemPrompt = `You are MiniBob, an AI agent that achieves goals through improvisation.

Goal: ${goal}
${context ? `Context: ${JSON.stringify(context)}` : ''}

You have access to tools: ${Object.keys(this.tools).join(', ')}

Approach:
1. Think about what to do next (reasoning)
2. Use a tool to take action
3. Observe the result
4. Decide if goal is achieved or continue

After each step, output JSON:
{
  "thought": "your reasoning",
  "action": "tool_name",
  "params": {...},
  "goal_achieved": true/false
}

Start by understanding the current state, then work toward the goal.`

    // Conversation history for context
    const messages = [
      { role: 'user', content: systemPrompt }
    ]

    // Improvise step by step
    while (!goalAchieved && stepNumber < 50) {
      stepNumber++
      const stepStartTime = Date.now()

      // Get LLM decision
      const response = await this.llm.generateWithTools({
        messages,
        tools: getAllToolDefinitions(),
        temperature: 0.7  // Higher temp for creativity
      })

      // Parse LLM response
      const decision = JSON.parse(response.content)

      // Execute tool
      const toolResult = await this.tools[decision.action](decision.params)

      // Record step
      const step: ImprovisationStep = {
        step: stepNumber,
        thought: decision.thought,
        action: decision.action,
        params: decision.params,
        result: toolResult,
        duration_ms: Date.now() - stepStartTime,
        timestamp: new Date().toISOString()
      }
      trace.steps.push(step)

      // Add to conversation history
      messages.push({
        role: 'assistant',
        content: JSON.stringify(decision)
      })
      messages.push({
        role: 'user',
        content: `Result: ${JSON.stringify(toolResult)}\n\nWhat's your next step?`
      })

      // Check if goal achieved
      goalAchieved = decision.goal_achieved

      // Safety: Check if stuck (same action repeated)
      if (this.isStuck(trace.steps)) {
        trace.outcome.status = 'stuck'
        break
      }
    }

    // Finalize trace
    trace.outcome.total_duration_ms = Date.now() - startTime
    trace.outcome.goal_achieved = goalAchieved
    trace.outcome.status = goalAchieved ? 'success' : (trace.outcome.status || 'failure')

    // Extract file changes
    trace.outcome.files_modified = this.extractModifiedFiles(trace.steps)
    trace.outcome.files_created = this.extractCreatedFiles(trace.steps)

    return trace
  }

  private isStuck(steps: ImprovisationStep[]): boolean {
    if (steps.length < 3) return false

    // Check last 3 steps
    const last3 = steps.slice(-3)
    const actions = last3.map(s => s.action)

    // Stuck if same action repeated 3 times
    return actions.every(a => a === actions[0])
  }

  private extractModifiedFiles(steps: ImprovisationStep[]): string[] {
    return steps
      .filter(s => s.action === 'edit')
      .map(s => s.params.file as string)
      .filter(Boolean)
  }

  private extractCreatedFiles(steps: ImprovisationStep[]): string[] {
    return steps
      .filter(s => s.action === 'write')
      .map(s => s.params.file as string)
      .filter(Boolean)
  }
}
```

### New CLI Command

```typescript
// index.ts - Add improvise command

if (command === 'improvise') {
  const goal = args[0]
  if (!goal) {
    console.error('Usage: minibob improvise "your goal here"')
    process.exit(1)
  }

  console.log(`🎭 Improvising toward goal: ${goal}`)
  console.log('Recording all steps...\n')

  const improviser = new GoalImproviser()
  const trace = await improviser.improvise(goal)

  console.log(`\n✅ Goal ${trace.outcome.goal_achieved ? 'achieved' : 'not achieved'}`)
  console.log(`   Steps taken: ${trace.steps.length}`)
  console.log(`   Duration: ${trace.outcome.total_duration_ms}ms`)
  console.log(`   Cost: $${trace.outcome.total_cost}`)

  // Store trace
  if (isMCPEnabled()) {
    await mcp.storeExecutionTrace(trace)
  }

  // Extract template if successful
  if (trace.outcome.goal_achieved) {
    console.log('\n🧬 Extracting template from improvisation...')
    const template = await extractTemplateFromImprovisation(trace)

    // Register with backend
    await mcp.registerTemplate(template)
    console.log(`✅ Template created: ${template.id}`)

    // Review and create variants
    console.log('\n🔍 Reviewing for optimization opportunities...')
    const context = await buildReviewContext(template, trace)
    const variants = await reviewAndCreateVariants(template, context)

    console.log(`✅ Created ${variants.length} variants:`)
    variants.forEach(v => {
      console.log(`   - ${v.id} (${v.metadata.optimizationFocus})`)
    })
  }
}
```

## Usage Examples

### Example 1: First Time (Improvisation)

```bash
$ minibob improvise "Add user authentication to the API"

🎭 Improvising toward goal: Add user authentication to the API
Recording all steps...

Step 1: Understanding current API structure...
  → read src/index.ts
  ✓ Found 5 endpoints, no auth

Step 2: Checking for auth libraries...
  → bash: grep 'jwt' package.json
  ✓ No auth libraries installed

Step 3: Installing JWT library...
  → bash: bun add jsonwebtoken
  ✓ Installed successfully

Step 4: Creating auth middleware...
  → write src/middleware/auth.ts
  ✓ File created (127 lines)

Step 5: Applying middleware to routes...
  → edit src/index.ts
  ✓ Modified 5 routes

Step 6: Testing authentication...
  → bash: curl -H 'Authorization: Bearer test' http://localhost:3000/api/users
  ✓ Returns 401 (correct)

✅ Goal achieved
   Steps taken: 6
   Duration: 15700ms
   Cost: $0.0234

🧬 Extracting template from improvisation...
✅ Template created: add-user-authentication-v1

🔍 Reviewing for optimization opportunities...
✅ Created 3 variants:
   - add-user-authentication-fast-v1 (speed)
   - add-user-authentication-reliable-v1 (reliability)
   - add-user-authentication-with-tests-v1 (completeness)
```

### Example 2: Second Time (Template Reuse)

```bash
$ minibob improvise "Add user authentication to the API"

🔍 Found existing template: add-user-authentication-v1
📊 Thompson Sampling recommends: add-user-authentication-reliable-v1
   (90% success rate vs 70% for v1)

Would you like to:
  [1] Use recommended template (reliable-v1)
  [2] Use original template (v1)
  [3] Improvise fresh (ignore templates)

> 1

✅ Executing: add-user-authentication-reliable-v1
   Duration: 12500ms (21% faster)
   Cost: $0.0198 (15% cheaper)
   Success: true

📈 Updating Thompson Sampling...
```

## The Learning Cycle

```
1. IMPROVISE
   User: "Add authentication"
   MiniBob: *figures it out step by step*
   ↓
2. EXTRACT
   Successful trace → Template v1
   ↓
3. REVIEW
   Analyze: cost, time, reliability, context
   Create variants: fast, reliable, complete
   ↓
4. EXECUTE
   Thompson Sampling: picks best variant
   ↓
5. LEARN
   Results update Thompson Sampling
   Success → Template improves
   Failure → Create new variant
   ↓
   (cycle continues)
```

## Review Analysis Framework

### What to Analyze

1. **Temporal Patterns**
   - Preceding goals: What led here?
   - Following goals: What comes next?
   - Session clustering: Related goals together?

2. **Performance Metrics**
   - Duration: Too slow?
   - Cost: Too expensive?
   - Success rate: Reliable enough?

3. **Tool Usage**
   - Which tools most used?
   - Which tools fail most?
   - Better tool alternatives?

4. **Error Patterns**
   - Common failure modes?
   - How were errors recovered?
   - Preventable errors?

5. **Context Factors**
   - Codebase size: Scale differently?
   - Tech stack: Specialized variant?
   - Team patterns: Workflow-specific?

### Variant Creation Rules

```typescript
interface VariantRule {
  condition: (context: TemplateReviewContext) => boolean
  generate: (template: ActivityTemplate, context: TemplateReviewContext) => ActivityTemplate
  name: string
}

const variantRules: VariantRule[] = [
  {
    name: 'speed-optimization',
    condition: (ctx) => ctx.executions.some(e => e.duration_ms > 30000),
    generate: (tpl, ctx) => {
      // Parallelize tasks, simplify validation, cache results
      return createSpeedOptimizedVariant(tpl, ctx)
    }
  },
  {
    name: 'cost-optimization',
    condition: (ctx) => ctx.executions.some(e => e.cost > 0.10),
    generate: (tpl, ctx) => {
      // Reduce token usage, use cheaper model for simple tasks
      return createCostOptimizedVariant(tpl, ctx)
    }
  },
  {
    name: 'reliability-improvement',
    condition: (ctx) => ctx.reliability.success_rate < 0.8,
    generate: (tpl, ctx) => {
      // Add error handling, validation, retry logic
      return createReliabilityOptimizedVariant(tpl, ctx)
    }
  },
  {
    name: 'context-completion',
    condition: (ctx) => {
      // If 80%+ of sessions have follow-up goal
      const followUpPattern = analyzeFollowUpGoals(ctx.followingGoals)
      return followUpPattern.frequency > 0.8
    },
    generate: (tpl, ctx) => {
      // Include common follow-up steps in template
      return createCompleteVariant(tpl, ctx)
    }
  }
]
```

## Migration Path

### Phase 1: Add Improviser (Week 1)
- [ ] Create `src/improviser.ts`
- [ ] Add `improvise` CLI command
- [ ] Test with simple goals
- [ ] Verify trace capture

### Phase 2: Enhance Extractor (Week 2)
- [ ] Improve template extraction from traces
- [ ] Better task boundary detection
- [ ] Variable identification
- [ ] Validation extraction

### Phase 3: Build Reviewer (Week 3)
- [ ] Implement review analysis
- [ ] Create variant generation rules
- [ ] Connect to Thompson Sampling
- [ ] Test variant performance

### Phase 4: Close the Loop (Week 4)
- [ ] Integrate with existing templates
- [ ] Template vs improvise decision logic
- [ ] Continuous improvement monitoring
- [ ] Dashboard for template evolution

## Benefits

1. **No Planning Waste** - Templates emerge from real executions
2. **Reality-Based** - Templates match what actually works
3. **Continuous Evolution** - Variants constantly optimized
4. **Context-Aware** - Templates adapt to usage patterns
5. **Discovery-Driven** - Find solutions organically

## Alignment with Ontology

```
IMPROVISATION = Pure Becoming
   ↓ (no predetermined vessel)
TRACE = Becoming captured
   ↓ (the trajectory through state space)
TEMPLATE = Vessel crystallized
   ↓ (the pattern extracted)
VARIANTS = Vessels optimized
   ↓ (learning from instances)
THOMPSON SAMPLING = Becoming influenced
   ↓ (best vessel selected)
```

The improvisation IS the process-of-becoming. The template is just the **crystallization of a successful becoming** for reuse.
