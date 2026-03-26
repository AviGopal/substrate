# Improviser Implementation Plan

## Overview

Build the goal improviser that creates templates through improvisation rather than planning.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User: "Add authentication"                              │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ GoalImproviser                                          │
│ ├─ No template (pure improvisation)                    │
│ ├─ LLM + Tools (figures out steps dynamically)         │
│ └─ Records everything (full trace)                     │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ ImprovisationTrace                                      │
│ {                                                       │
│   steps: [                                              │
│     {thought, action, params, result, duration},        │
│     {thought, action, params, result, duration},        │
│     ...                                                 │
│   ],                                                    │
│   outcome: {success, files_changed, cost, duration}     │
│ }                                                       │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ TemplateExtractor (Ribosome)                           │
│ ├─ Identify task boundaries                            │
│ ├─ Extract prompt patterns                             │
│ ├─ Identify variables                                  │
│ └─ Generate ActivityTemplate                           │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ TemplateReviewer                                       │
│ ├─ Analyze: cost, time, reliability                    │
│ ├─ Context: preceding/following goals                  │
│ ├─ Errors: failure patterns                            │
│ └─ Create variants: fast, reliable, complete           │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Backend Storage                                         │
│ ├─ Template v1 (original)                              │
│ ├─ Template v2 (fast)                                  │
│ ├─ Template v3 (reliable)                              │
│ └─ Thompson Sampling (learns best)                     │
└─────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Core Improviser

**File:** `repos/minibob/src/improviser.ts`

```typescript
/**
 * Goal Improviser - Execute goals without templates
 *
 * Pure improvisation: LLM figures out what to do step by step,
 * using available tools. Everything is recorded for template extraction.
 */

import type { LLMClient, LLMMessage } from './llm'
import type { ToolHandler, ToolResult } from './types'
import { createLLMClient } from './llm'
import { createToolHandlers, getAllToolDefinitions } from './tools'
import { logger } from './utils/logger'

// ============================================================================
// TYPES
// ============================================================================

export interface ImprovisationStep {
  step: number
  thought: string              // LLM's reasoning about what to do
  action: string               // Tool name to use
  params: Record<string, unknown>
  result: ToolResult
  duration_ms: number
  timestamp: string
  cost_estimate: number        // Tokens used this step
}

export interface ImprovisationTrace {
  execution_id: string
  goal: string
  improvisation: true
  context?: Record<string, unknown>
  started_at: string
  completed_at?: string
  steps: ImprovisationStep[]
  outcome: {
    status: 'success' | 'failure' | 'stuck'
    goal_achieved: boolean
    total_duration_ms: number
    total_cost: number
    total_tokens: {
      input: number
      output: number
    }
    files_modified: string[]
    files_created: string[]
    files_deleted: string[]
    error?: string
  }
}

export interface ImprovisationConfig {
  maxSteps?: number           // Max steps before giving up (default: 50)
  temperature?: number        // LLM temperature for creativity (default: 0.7)
  stuckThreshold?: number     // Same action repeated N times = stuck (default: 3)
  saveTrace?: boolean         // Save to backend (default: true)
}

// ============================================================================
// IMPROVISER
// ============================================================================

export class GoalImproviser {
  private llm: LLMClient
  private tools: Record<string, ToolHandler>

  constructor() {
    this.llm = createLLMClient()
    this.tools = createToolHandlers()
  }

  /**
   * Improvise solution to a goal without pre-defined template
   */
  async improvise(
    goal: string,
    config: ImprovisationConfig = {}
  ): Promise<ImprovisationTrace> {

    const {
      maxSteps = 50,
      temperature = 0.7,
      stuckThreshold = 3,
      saveTrace = true
    } = config

    logger.info('Starting improvisation', { goal, maxSteps })

    // Initialize trace
    const trace: ImprovisationTrace = {
      execution_id: `exec_improv_${Date.now()}_${this.randomId()}`,
      goal,
      improvisation: true,
      started_at: new Date().toISOString(),
      steps: [],
      outcome: {
        status: 'success',
        goal_achieved: false,
        total_duration_ms: 0,
        total_cost: 0,
        total_tokens: { input: 0, output: 0 },
        files_modified: [],
        files_created: [],
        files_deleted: []
      }
    }

    const startTime = Date.now()
    const messages: LLMMessage[] = []

    // System prompt for improvisation
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(goal)
    })

    // Initial user message
    messages.push({
      role: 'user',
      content: 'Start working toward the goal. What should you do first?'
    })

    let stepNumber = 0
    let goalAchieved = false

    // Improvise step by step
    while (!goalAchieved && stepNumber < maxSteps) {
      stepNumber++
      const stepStartTime = Date.now()

      try {
        // Get LLM decision
        logger.debug('Requesting LLM decision', { step: stepNumber })

        const response = await this.llm.generate({
          messages,
          tools: getAllToolDefinitions(),
          temperature,
          max_tokens: 2000
        })

        // Parse decision (LLM should output structured JSON)
        const decision = this.parseDecision(response.content)

        logger.info('LLM decided', {
          step: stepNumber,
          thought: decision.thought,
          action: decision.action
        })

        // Execute the action
        const toolHandler = this.tools[decision.action]
        if (!toolHandler) {
          throw new Error(`Unknown tool: ${decision.action}`)
        }

        const toolResult = await toolHandler(decision.params)

        // Record step
        const step: ImprovisationStep = {
          step: stepNumber,
          thought: decision.thought,
          action: decision.action,
          params: decision.params,
          result: toolResult,
          duration_ms: Date.now() - stepStartTime,
          timestamp: new Date().toISOString(),
          cost_estimate: this.estimateCost(response)
        }
        trace.steps.push(step)

        // Update conversation history
        messages.push({
          role: 'assistant',
          content: JSON.stringify({
            thought: decision.thought,
            action: decision.action,
            params: decision.params
          })
        })

        messages.push({
          role: 'user',
          content: this.formatToolResult(toolResult, decision.action)
        })

        // Check if goal achieved
        goalAchieved = decision.goal_achieved || false

        if (goalAchieved) {
          logger.info('Goal achieved!', { step: stepNumber })
          break
        }

        // Check if stuck
        if (this.isStuck(trace.steps, stuckThreshold)) {
          logger.warn('Improviser appears stuck', {
            lastActions: trace.steps.slice(-stuckThreshold).map(s => s.action)
          })
          trace.outcome.status = 'stuck'
          trace.outcome.error = 'Repeated same action too many times'
          break
        }

      } catch (error) {
        logger.error('Step failed', {
          step: stepNumber,
          error: error instanceof Error ? error.message : String(error)
        })

        // Add error to conversation so LLM can recover
        messages.push({
          role: 'user',
          content: `Error occurred: ${error instanceof Error ? error.message : String(error)}\nHow can you recover?`
        })
      }
    }

    // Finalize trace
    trace.completed_at = new Date().toISOString()
    trace.outcome.total_duration_ms = Date.now() - startTime
    trace.outcome.goal_achieved = goalAchieved
    trace.outcome.status = goalAchieved ? 'success' : (trace.outcome.status || 'failure')

    // Extract file changes
    trace.outcome.files_modified = this.extractFilesModified(trace.steps)
    trace.outcome.files_created = this.extractFilesCreated(trace.steps)
    trace.outcome.files_deleted = this.extractFilesDeleted(trace.steps)

    // Calculate totals
    trace.outcome.total_cost = trace.steps.reduce((sum, s) => sum + s.cost_estimate, 0)

    logger.info('Improvisation complete', {
      execution_id: trace.execution_id,
      goal_achieved: trace.outcome.goal_achieved,
      steps: trace.steps.length,
      duration_ms: trace.outcome.total_duration_ms,
      cost: trace.outcome.total_cost
    })

    // Save trace if configured
    if (saveTrace) {
      await this.saveTrace(trace)
    }

    return trace
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private buildSystemPrompt(goal: string): string {
    return `You are MiniBob, an autonomous agent that achieves goals through improvisation.

GOAL: ${goal}

You have access to these tools:
- bash: Execute shell commands
- read: Read file contents
- write: Create new files
- edit: Modify existing files
- git: Git operations

Your approach:
1. Think about what to do next (reasoning)
2. Choose a tool and parameters
3. Execute the action
4. Observe the result
5. Decide if goal is achieved or continue

IMPORTANT OUTPUT FORMAT:
After reasoning, output ONLY valid JSON in this format:
{
  "thought": "your reasoning about what to do and why",
  "action": "tool_name",
  "params": { "param1": "value1", ... },
  "goal_achieved": true/false
}

Start by understanding the current state, then work systematically toward the goal.
Take concrete actions - don't just plan, actually do things.`
  }

  private parseDecision(content: string): {
    thought: string
    action: string
    params: Record<string, unknown>
    goal_achieved: boolean
  } {
    // Extract JSON from content (may have markdown formatting)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('LLM did not return valid JSON')
    }

    const decision = JSON.parse(jsonMatch[0])

    if (!decision.thought || !decision.action) {
      throw new Error('Decision missing required fields')
    }

    return {
      thought: decision.thought,
      action: decision.action,
      params: decision.params || {},
      goal_achieved: decision.goal_achieved || false
    }
  }

  private formatToolResult(result: ToolResult, action: string): string {
    return `Tool ${action} result:
Success: ${result.success}
${result.stdout ? `Output:\n${result.stdout}` : ''}
${result.stderr ? `Error:\n${result.stderr}` : ''}

What should you do next?`
  }

  private isStuck(steps: ImprovisationStep[], threshold: number): boolean {
    if (steps.length < threshold) return false

    const lastN = steps.slice(-threshold)
    const actions = lastN.map(s => s.action)

    // Stuck if all last N actions are the same
    return actions.every(a => a === actions[0])
  }

  private extractFilesModified(steps: ImprovisationStep[]): string[] {
    return [...new Set(
      steps
        .filter(s => s.action === 'edit')
        .map(s => s.params.file_path as string)
        .filter(Boolean)
    )]
  }

  private extractFilesCreated(steps: ImprovisationStep[]): string[] {
    return [...new Set(
      steps
        .filter(s => s.action === 'write')
        .map(s => s.params.file_path as string)
        .filter(Boolean)
    )]
  }

  private extractFilesDeleted(steps: ImprovisationStep[]): string[] {
    return [...new Set(
      steps
        .filter(s => s.action === 'bash' && s.params.command?.toString().includes('rm '))
        .map(s => {
          // Extract file from rm command
          const cmd = s.params.command as string
          const match = cmd.match(/rm\s+(.+)/)
          return match ? match[1] : null
        })
        .filter(Boolean) as string[]
    )]
  }

  private estimateCost(response: any): number {
    // Rough estimate: $0.003 per 1K input tokens, $0.015 per 1K output tokens
    const inputTokens = response.usage?.input_tokens || 0
    const outputTokens = response.usage?.output_tokens || 0

    return (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015
  }

  private async saveTrace(trace: ImprovisationTrace): Promise<void> {
    // Save to backend via MCP
    try {
      const { getMCPClient, isMCPEnabled } = await import('./mcp')
      if (isMCPEnabled()) {
        const mcp = getMCPClient()
        await mcp.storeExecutionTrace(trace as any)
        logger.info('Trace saved to backend', { execution_id: trace.execution_id })
      }
    } catch (error) {
      logger.error('Failed to save trace', { error })
    }
  }

  private randomId(): string {
    return Math.random().toString(36).substring(7)
  }
}
```

### Step 2: CLI Integration

**File:** `repos/minibob/index.ts` (add improvise command)

```typescript
// Add to command parsing section

if (command === 'improvise') {
  const goal = args.join(' ')  // Rest of args = goal
  if (!goal) {
    console.error('Usage: minibob improvise "your goal here"')
    process.exit(1)
  }

  console.log(`\n🎭 Improvising toward goal: ${goal}`)
  console.log('Recording all steps...\n')

  const improviser = new GoalImproviser()

  try {
    const trace = await improviser.improvise(goal)

    // Display results
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Goal: ${goal}`)
    console.log(`Status: ${trace.outcome.goal_achieved ? '✅ Achieved' : '❌ Not achieved'}`)
    console.log(`Steps: ${trace.steps.length}`)
    console.log(`Duration: ${trace.outcome.total_duration_ms}ms`)
    console.log(`Cost: $${trace.outcome.total_cost.toFixed(4)}`)
    console.log(`${'='.repeat(60)}\n`)

    // Show steps summary
    console.log('Steps taken:')
    trace.steps.forEach(step => {
      console.log(`  ${step.step}. ${step.thought}`)
      console.log(`     → ${step.action}(${JSON.stringify(step.params).substring(0, 50)}...)`)
      console.log(`     ✓ ${step.result.success ? 'Success' : 'Failed'} (${step.duration_ms}ms)`)
    })

    // Extract template if successful
    if (trace.outcome.goal_achieved) {
      console.log('\n🧬 Extracting template from successful improvisation...')

      // Import extractor
      const { extractTemplateFromImprovisation } = await import('./template-extractor')
      const template = await extractTemplateFromImprovisation(trace)

      console.log(`✅ Template created: ${template.id}`)
      console.log(`   Name: ${template.name}`)
      console.log(`   Tasks: ${template.tasks.length}`)

      // Register with backend
      if (isMCPEnabled()) {
        await mcp.registerTemplate(template)
        console.log(`   Registered with backend`)
      }

      // Review and create variants
      console.log('\n🔍 Analyzing for optimization opportunities...')
      const { reviewAndCreateVariants } = await import('./template-reviewer')
      const variants = await reviewAndCreateVariants(template, trace)

      if (variants.length > 0) {
        console.log(`✅ Created ${variants.length} optimized variants:`)
        variants.forEach(v => {
          console.log(`   - ${v.id}`)
          console.log(`     Focus: ${v.metadata.optimizationFocus}`)
          console.log(`     Expected improvement: ${v.metadata.expectedImprovement}`)
        })
      }
    }

  } catch (error) {
    console.error('\n❌ Improvisation failed:', error)
    process.exit(1)
  }
}
```

### Step 3: Template Extractor

**File:** `repos/minibob/src/template-extractor.ts`

```typescript
/**
 * Template Extractor - Extract activity templates from improvisation traces
 *
 * The ribosome pattern: successful improvisation → reusable template
 */

import type { ImprovisationTrace, ImprovisationStep } from './improviser'
import type { ActivityTemplate, ActivityTask } from './types'
import { logger } from './utils/logger'

export async function extractTemplateFromImprovisation(
  trace: ImprovisationTrace
): Promise<ActivityTemplate> {

  logger.info('Extracting template from trace', {
    execution_id: trace.execution_id,
    steps: trace.steps.length
  })

  // 1. Identify task boundaries (logical groupings)
  const taskGroups = identifyTaskBoundaries(trace.steps)

  // 2. Convert each group into a task
  const tasks: ActivityTask[] = taskGroups.map((group, index) => {
    const taskId = `task-${index + 1}`

    return {
      id: taskId,
      description: summarizeTaskGroup(group),
      prompt: {
        template: extractPromptPattern(group),
        variables: identifyVariables(group)
      },
      validation: extractValidation(group),
      dependencies: index > 0 ? [`task-${index}`] : []
    }
  })

  // 3. Create template
  const template: ActivityTemplate = {
    id: `tpl_${Date.now()}_${randomId()}`,
    name: capitalizeGoal(trace.goal),
    category: inferCategory(trace.goal, trace.outcome),
    description: trace.goal,
    tasks,
    variables: [],  // Extracted from task prompts
    metadata: {
      extractedFrom: trace.execution_id,
      extractionMethod: 'improvisation',
      firstSuccessMetrics: {
        duration: trace.outcome.total_duration_ms,
        cost: trace.outcome.total_cost,
        steps: trace.steps.length
      },
      createdAt: Date.now(),
      author: 'ribosome'
    }
  }

  logger.info('Template extracted', {
    template_id: template.id,
    tasks: template.tasks.length
  })

  return template
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

function identifyTaskBoundaries(steps: ImprovisationStep[]): ImprovisationStep[][] {
  // Group steps into logical tasks based on:
  // 1. Clusters of similar actions
  // 2. Natural breakpoints (read → analyze → modify pattern)
  // 3. File boundaries (all operations on same file)

  const groups: ImprovisationStep[][] = []
  let currentGroup: ImprovisationStep[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const prevStep = i > 0 ? steps[i - 1] : null

    currentGroup.push(step)

    // Break into new group if:
    // - Action changes significantly (read → write)
    // - Working on different file
    // - Group size >= 5 steps
    const shouldBreak =
      currentGroup.length >= 5 ||
      (prevStep && isSignificantActionChange(prevStep.action, step.action)) ||
      (prevStep && isDifferentFile(prevStep, step))

    if (shouldBreak && i < steps.length - 1) {
      groups.push([...currentGroup])
      currentGroup = []
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

function summarizeTaskGroup(group: ImprovisationStep[]): string {
  // Use the first step's thought as basis, generalized
  const firstThought = group[0].thought
  const actions = group.map(s => s.action)

  // Create descriptive summary
  if (actions.every(a => a === 'read')) {
    return 'Analyze and understand current state'
  } else if (actions.includes('write')) {
    return 'Create new files and components'
  } else if (actions.includes('edit')) {
    return 'Modify existing files'
  } else if (actions.includes('bash') && actions.includes('grep')) {
    return 'Search and verify configuration'
  } else {
    return firstThought.substring(0, 80)  // Use LLM's reasoning
  }
}

function extractPromptPattern(group: ImprovisationStep[]): string {
  // Convert the improvised steps into a reusable prompt template
  const actions = group.map(s => `${s.action}: ${JSON.stringify(s.params)}`).join('\n')

  return `Based on the goal, perform these actions:
${actions}

Adapt these actions as needed for the specific context.`
}

function identifyVariables(group: ImprovisationStep[]): Array<{name: string, source: string, type: string}> {
  // Extract variable values that should be parameterized
  const vars: Set<string> = new Set()

  group.forEach(step => {
    // Look for file paths, names, etc that should be variables
    if (step.params.file_path) {
      vars.add('target_file')
    }
    if (step.params.command) {
      // Extract patterns that look like variables
    }
  })

  return Array.from(vars).map(name => ({
    name,
    source: 'variable',
    type: 'string'
  }))
}

function extractValidation(group: ImprovisationStep[]): any {
  // Extract validation based on what the improvisation checked
  const validation: any = {}

  const filesCreated = group.filter(s => s.action === 'write').map(s => s.params.file_path)
  if (filesCreated.length > 0) {
    validation.requiredFiles = filesCreated
  }

  return Object.keys(validation).length > 0 ? validation : undefined
}

// ... more helper functions
```

## Testing Plan

### Test 1: Simple Goal

```bash
# Test basic improvisation
bun run index.ts improvise "Create a hello world HTTP server"

# Expected:
# - Creates server file
# - Adds dependencies if needed
# - Template extracted with 2-3 tasks
```

### Test 2: Complex Goal

```bash
# Test complex multi-step goal
bun run index.ts improvise "Add user authentication with JWT"

# Expected:
# - Explores current code
# - Installs libraries
# - Creates middleware
# - Modifies routes
# - Tests implementation
# - Template with 5-6 tasks
```

### Test 3: Reuse

```bash
# First time: improvise
bun run index.ts improvise "Add rate limiting"
# → Creates template

# Second time: should find and use template
bun run index.ts improvise "Add rate limiting"
# → Should offer to use existing template or improvise fresh
```

## Timeline

- **Week 1**: Build improviser core + CLI
- **Week 2**: Build template extractor
- **Week 3**: Build template reviewer + variant creator
- **Week 4**: Integration testing + refinement

## Success Metrics

- [ ] Improviser completes simple goals (3-5 steps)
- [ ] Improviser completes complex goals (10-20 steps)
- [ ] Templates extracted match improvisation
- [ ] Variants show measurable improvements
- [ ] Thompson Sampling learns best variants
- [ ] Second execution uses template instead of re-improvising
