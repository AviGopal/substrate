# Goal-Seeking Architecture

**Status:** ✅ IMPLEMENTED and VALIDATED
**Location:** `repos/minibob/src/goal-processor.ts`
**Last Updated:** 2026-03-23

## Overview

Goal-seeking is **adaptive path finding** - the system's ability to navigate from current state to desired state through activity execution. It is NOT search, ranking, or planning. It is continuous adjustment based on measured outcomes.

**Key Insight:** Goal-seeking is the manifestation of the process-of-becoming at the session level. Each goal execution is a vessel (goal specification) → becoming (activity executions) → instance (achieved state) transformation.

## Architecture

### Three-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│ GOAL LAYER                                                  │
│ - Parse user intent                                         │
│ - Track completion criteria                                 │
│ - Verify achievement objectively                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ RECOMMENDATION LAYER (Backend)                              │
│ - Thompson Sampling for exploration/exploitation            │
│ - Historical success rate analysis                          │
│ - Context-aware selection (loaded impulses)                 │
│ - Category alignment (feature/bugfix/refactor)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION LAYER                                             │
│ - Load activity template                                    │
│ - Execute with LLM + tools                                  │
│ - Capture execution trace                                   │
│ - Measure outcomes (files modified, tools used, etc.)       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```typescript
// 1. User provides goal message
const goalMessage = "Fix authentication bug in login flow"

// 2. GoalProcessor parses into structured goal
const goal: Goal = {
  message: "Fix authentication bug in login flow",
  type: "bugfix",
  intent: "Fix authentication bug in login flow",
  context: {},
  createdAt: 1640000000000
}

// 3. Backend recommends activities via Thompson Sampling
const recommendations: ActivityRecommendation[] = [
  {
    templateId: "debug-auth-flow",
    selectionMetadata: {
      method: "thompson_sampling",
      alpha: 12,  // Successes
      beta: 3,    // Failures
      sample: 0.78
    },
    variables: {}
  }
]

// 4. Execute top recommendation
const execution: ActivityExecution = await executor.execute({
  template: loadedTemplate,
  variables: {},
  reason: "Goal: Fix authentication bug in login flow"
})

// 5. Verify goal achievement objectively
const verification = {
  verified: true,
  reason: "Verified: 2 file(s) modified"
}
```

## GoalProcessor Implementation

### Core Methods

**parseGoal(message, context): Goal**
- Converts user message into structured goal
- Infers type from keywords (feature, bugfix, refactor)
- Current: Simple keyword matching
- Future: LLM-based intent extraction

**getRecommendations(goal, loadedImpulseIds, limit): ActivityRecommendation[]**
- Delegates to backend MCP endpoint
- Backend applies Thompson Sampling
- Returns ranked recommendations with selection metadata
- Context-aware via loaded impulse IDs

**isGoalComplete(executions, goal): {complete, reason}**
- Checks if goal is achieved
- Uses objective verification (files modified, tools used)
- Prevents LLM hallucination ("I completed it" with no changes)
- Backward compatible (works without goal parameter)

**verifyGoalAchievement(goal, executions): {verified, reason}**
- Objective verification based on goal intent keywords
- File modification goals: Count files modified
- Test execution goals: Check for test output
- Analysis goals: Count tool calls
- Default: Require measurable work (files OR tools)

**executeGoal(message, context, options): GoalResult**
- Main loop: recommend → execute → verify → repeat
- Limits: maxActivities (default 5), maxCost (default $10)
- Tracks total cost, tokens, duration
- Returns full execution history

### Goal Types

**Implemented Types:**
- `feature`: Add/create/implement functionality
- `bugfix`: Fix/repair/debug problems
- `refactor`: Clean/reorganize/improve code
- `exploration`: Analyze/search/investigate
- `other`: Fallback for unclassified

**Type Inference:**
```typescript
// Keywords → Type mapping
"add", "create", "implement" → feature
"fix", "bug", "error" → bugfix
"refactor", "clean", "reorganize" → refactor
```

### Verification Strategies

**File Modification Goals:**
```typescript
if (goal.intent.match(/change|modify|edit|update|replace/i)) {
  const filesModified = countFilesModified(executions)
  return filesModified > 0
}
```

**Test Execution Goals:**
```typescript
if (goal.intent.match(/test/i)) {
  const hasTestOutput = executions.some(exec =>
    exec.taskResults?.some(tr => tr.output?.includes('test'))
  )
  return hasTestOutput
}
```

**Code Creation Goals:**
```typescript
if (goal.intent.match(/create|add|implement|write/i)) {
  const filesModified = countFilesModified(executions)
  return filesModified > 0
}
```

**Analysis Goals:**
```typescript
if (goal.intent.match(/analyze|explore|find|search/i)) {
  const toolsUsed = countToolCalls(executions)
  return toolsUsed > 0
}
```

**Default Strategy:**
```typescript
// Require MEASURABLE WORK
const filesModified = countFilesModified(executions)
const toolsUsed = countToolCalls(executions)
return filesModified > 0 || toolsUsed > 0
```

## Backend Integration (Thompson Sampling)

### MCP Endpoint

```typescript
// MiniBob calls backend via MCP
const mcpClient = getMCPClient()
const recommendations = await mcpClient.recommendActivities(
  goal.intent,          // User goal message
  goal.type,            // Category filter (optional)
  loadedImpulseIds,     // Context-aware selection
  limit                 // Max recommendations
)
```

### Backend Recommendation Engine

**Location:** `repos/metabob-activity-api/src/routes/activities.ts`

**Thompson Sampling Algorithm:**
1. For each template, sample from Beta(α, β) distribution
   - α = successes + 1
   - β = failures + 1
2. Rank templates by sampled value
3. Return top N recommendations

**Benefits:**
- Automatic exploration/exploitation balance
- No manual A/B test configuration
- Learns which templates work best over time
- Category-aware (feature vs bugfix vs refactor)

### Selection Metadata

```typescript
{
  method: "thompson_sampling",
  alpha: 12,      // Successes observed
  beta: 3,        // Failures observed
  sample: 0.78,   // Sampled value this iteration
  score: 0.8      // Mean success rate (α/(α+β))
}
```

## Execution Loop

### Standard Loop

```typescript
async executeGoal(message, context, options) {
  const goal = parseGoal(message, context)
  const executions = []

  for (let i = 0; i < maxActivities; i++) {
    // 1. Get recommendations from backend
    const recommendations = await getRecommendations(goal, loadedImpulseIds)
    if (recommendations.length === 0) break

    // 2. Execute top recommendation
    const template = await loadTemplate(recommendations[0].templateId)
    const execution = await executor.execute({
      template,
      variables: recommendations[0].variables,
      reason: `Goal: ${goal.intent}`
    })
    executions.push(execution)

    // 3. Track costs
    totalCost += execution.metrics.cost
    if (totalCost > maxCost) break

    // 4. Check completion
    const {complete, reason} = isGoalComplete(executions, goal)
    if (complete) {
      return {goal, executions, completed: true, reason, ...}
    }
  }

  return {goal, executions, completed: false, ...}
}
```

### Termination Conditions

1. **Goal achieved:** Objective verification passes
2. **Cost limit:** Total cost exceeds maxCost ($10 default)
3. **Activity limit:** Max iterations reached (5 default)
4. **No recommendations:** Backend has no suggestions

## Goal Decomposition

**Current State:** ❌ NOT IMPLEMENTED

**Future Design:**
- Complex goals decompose into sub-goals
- Each sub-goal executes independently
- Parent goal tracks sub-goal completion
- Enables hierarchical planning

**Example:**
```typescript
// Parent goal
"Implement user authentication system"

// Decomposed sub-goals
[
  "Create user model with password hashing",
  "Implement login endpoint with JWT",
  "Add authentication middleware",
  "Write authentication tests"
]
```

## Learning from Goal Executions

### What's Captured

**Per-Goal Metrics:**
- Activities executed (IDs, order)
- Total duration (ms)
- Total cost (USD)
- Total tokens (input, output, cache)
- Completion status (true/false)
- Completion reason (string)

**Per-Activity Metrics:**
- Success rate for goal type
- Cost efficiency (cost per successful completion)
- Time efficiency (duration per successful completion)
- Context effectiveness (which impulses led to success)

### Backend Learning Loop

```
┌─────────────────────────────────────────────────────────┐
│ 1. Goal execution produces ActivityExecution traces     │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Backend stores traces with goal context              │
│    - Goal intent                                        │
│    - Goal type                                          │
│    - Activity used                                      │
│    - Success/failure                                    │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Thompson Sampling updates distributions              │
│    Success: α ← α + 1                                   │
│    Failure: β ← β + 1                                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Next goal uses updated distributions for selection   │
└─────────────────────────────────────────────────────────┘
```

## Comparison: NOT Search or Planning

### What Goal-Seeking IS NOT

❌ **Search/Ranking:**
- Not: "Find best template statically"
- Instead: "Sample from probability distributions dynamically"

❌ **Planning:**
- Not: "Generate full sequence upfront"
- Instead: "Execute next step, observe, adjust"

❌ **Constraint Solving:**
- Not: "Satisfy all constraints simultaneously"
- Instead: "Improve iteratively through measured outcomes"

### What Goal-Seeking IS

✅ **Adaptive Path Finding:**
- Sample next step probabilistically
- Execute and measure outcomes
- Update probabilities based on results
- Repeat until goal achieved

✅ **Continuous Adjustment:**
- No fixed plan
- Each step informs next step
- Learning happens during execution

✅ **Exploration/Exploitation Balance:**
- Thompson Sampling naturally balances
- Try proven templates (exploitation)
- Try untested templates (exploration)

## Integration Points

### MiniBob → Backend

**Endpoint:** `POST /v2/activities/recommend`

**Request:**
```json
{
  "goal_description": "Fix authentication bug",
  "category": "bugfix",
  "loaded_impulse_ids": ["impulse-123", "impulse-456"],
  "limit": 3
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "template_id": "debug-auth-flow",
      "selection_metadata": {
        "method": "thompson_sampling",
        "alpha": 12,
        "beta": 3,
        "sample": 0.78
      }
    }
  ]
}
```

### MiniBob → Activity Executor

**Input:**
```typescript
{
  template: ActivityTemplate,
  variables: Record<string, unknown>,
  reason: `Goal: ${goal.intent}`
}
```

**Output:**
```typescript
{
  id: string,
  status: "completed" | "failed",
  metrics: {
    cost: number,
    totalTokens: {input, output},
    duration: number
  },
  executionTrace: {
    filesModified: string[],
    filesCreated: string[],
    ...
  }
}
```

## Future Enhancements

### 1. LLM-Based Goal Parsing (⚠️ PLANNED)
- Use LLM to extract intent from natural language
- Identify dependencies between goals
- Suggest decomposition strategies

### 2. Goal Decomposition (⚠️ PLANNED)
- Break complex goals into sub-goals
- Execute sub-goals in parallel where possible
- Track dependencies between sub-goals

### 3. Multi-Goal Coordination (⚠️ PLANNED)
- Execute multiple goals concurrently
- Share impulses between goal executions
- Optimize resource allocation across goals

### 4. Goal Learning (⚠️ PLANNED)
- Track which goal patterns succeed
- Recommend goal decomposition strategies
- Predict completion time and cost

## References

**Implementation:**
- `repos/minibob/src/goal-processor.ts` - Core implementation
- `repos/metabob-activity-api/src/routes/activities.ts` - Backend recommendation engine

**Related Concepts:**
- Thompson Sampling: Probabilistic template selection
- Impulse System: Context injection mechanism
- Activity Templates: Executable transformation recipes

**Meta-Architecture:**
- `ideogram-catalog.md` - Goal-seeking as universal pattern
- `domain-mappings.md` - Goal-seeking across domains
- `closed-loop-architecture.md` - Goal execution in closed loop
