# Goal Processing Alignment - Design

> **Aligned with**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

## Core Principle

> "LLMs Are Tools, Not Controllers" - Use LLMs for reasoning and generation. Use deterministic resolvers for everything else.

## Goal Interface (Simplified)

```typescript
interface Goal {
  message: string       // Original user message
  intent: string        // Parsed intent (may equal message)
  context: Record<string, unknown>
  createdAt: number
  // NOTE: No 'type' field - type emerges from activity matching
}
```

## Activity Matching Flow

```
User: "fix the auth bug"
         │
         ▼
┌─────────────────────────────────────┐
│  Backend: recommendActivities()     │
│                                     │
│  Input impulses:                    │
│    - goal: "fix the auth bug"       │
│    - error_log: null pointer        │
│    - source_code: auth.ts           │
│                                     │
│  Thompson-ranked results:           │
│    1. debug-null-pointer (α=45, β=3)│ ← 93% success rate
│    2. analyze-stack-trace (α=12, β=2)│
│    3. generic-debug (α=8, β=5)      │
│                                     │
│  The MATCH tells us: this is a      │
│  debug goal, not feature/refactor   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  GoalProcessor: try activities      │
│                                     │
│  for each recommendation:           │
│    if score < threshold: break      │
│    execute activity                 │
│    if outputs match schema: SUCCESS │
│    else: record failure, try next   │
│                                     │
│  if all fail: improvise             │
└─────────────────────────────────────┘
```

## Key Changes from Original

### 1. No LLM in parseGoal()

```typescript
// BEFORE (wrong):
async parseGoal(message: string): Promise<Goal> {
  const enrichment = await this.llm.complete(...) // LLM decides type
  return { type: enrichment.category, ... }
}

// AFTER (aligned):
parseGoal(message: string): Goal {
  return {
    message,
    intent: message,
    context: {},
    createdAt: Date.now()
    // type: determined by activity matching, not here
  }
}
```

### 2. No LLM in assessRelevance()

```typescript
// BEFORE (wrong):
private async assessRelevance(goal: Goal, rec: Recommendation): Promise<number> {
  const llmScore = await this.llm.complete(...) // LLM judges relevance
  return llmScore
}

// AFTER (aligned):
private assessRelevance(goal: Goal, rec: Recommendation): number {
  // Trust Thompson Sampling - backend learned this from traces
  return rec.selectionMetadata?.score ?? 0
}
```

### 3. No LLM in verifyGoalAchievement()

```typescript
// BEFORE (wrong):
private async verifyGoalAchievement(goal: Goal, execs: Execution[]): Promise<boolean> {
  const result = await this.llm.complete(...) // LLM judges success
  return result.verified
}

// AFTER (aligned):
private verifyGoalAchievement(activity: Activity, outputs: Impulse[]): boolean {
  // Check: did we produce what the activity promised?
  const required = activity.outputSchema.produces
  const produced = outputs.map(o => o.metadata.shape)
  return required.every(r => produced.includes(r))
}
```

### 4. Correct Improvisation Trigger

```typescript
// BEFORE (wrong):
async processGoal(goal: Goal) {
  const activity = await this.selectActivity(goal)
  const result = await this.execute(activity)
  if (!result.success) {
    await this.improvise(goal) // Immediate fallback
  }
}

// AFTER (aligned):
async processGoal(goal: Goal) {
  const recommendations = await this.backend.recommendActivities(goal)

  for (const rec of recommendations) {
    if (rec.score < this.confidenceThreshold) break // Below threshold

    const result = await this.execute(rec.activity)
    if (this.verifyOutputs(rec.activity, result.outputs)) {
      await this.recordSuccess(rec.activity, result)
      return // Done
    }

    await this.recordFailure(rec.activity, result)
    // Continue to next activity, don't improvise yet
  }

  // Only improvise when ALL ranked activities exhausted
  await this.improviseWithRecording(goal)
}
```

## State Machine (Simplified)

```typescript
type GoalState =
  | "recommending"   // Fetching activity recommendations
  | "executing"      // Running selected activity
  | "verifying"      // Checking output schema match
  | "improvising"    // Direct LLM execution (fallback)
  | "completed"      // Goal achieved
  | "failed"         // Unrecoverable failure

// Removed states:
// - "enriching" (no LLM enrichment step)
// - "choosing" (backend already ranked)
```

## When LLM IS Used

The LLM is a resolver type, used in specific situations:

### 1. Within Activity Tasks (as resolver)

```typescript
// Activity template specifies LLM as resolver for specific task
const task = {
  id: "analyze-error",
  resolver: "llm",
  params: {
    prompt: "Analyze this error and suggest cause",
    inputs: ["error_log"]
  }
}
```

### 2. During Improvisation (fallback)

```typescript
async improviseWithRecording(goal: Goal) {
  const trace = createImprovisationTrace()

  // LLM used for reasoning about ambiguous goal
  const result = await this.llm.completeWithTools({
    systemPrompt: "You are debugging. Available tools: ...",
    userMessage: goal.intent
  })

  trace.steps = result.toolCalls
  trace.outcome = result.success

  // ALWAYS record
  await this.backend.storeTrace(trace)

  // Ribosome extracts successful improvisations as templates
  if (result.success) {
    await this.backend.notifyRibosomeCandidate(trace.id)
  }
}
```

### 3. For Subjective Goals (explicit opt-in)

```typescript
// Activity template can declare subjective verification
const activity = {
  id: "improve-documentation",
  outputSchema: {
    produces: ["documentation"],
    verification: "subjective" // Triggers LLM verification
  }
}

// Then verification uses LLM
if (activity.outputSchema.verification === "subjective") {
  return await this.llmVerify(goal, outputs)
} else {
  return this.schemaVerify(activity, outputs)
}
```

## Recording Requirements

Every execution must be traced:

```typescript
interface ExecutionTrace {
  trace_id: string
  activity_id: string

  // What went IN
  input_impulses: Impulse[]

  // What HAPPENED
  tasks: TaskExecution[]

  // What came OUT
  output_impulses: Impulse[]

  // State transition
  state_transition: {
    before: Record<string, string>
    after: Record<string, string>
  }

  // Outcome
  outcome: {
    success: boolean
    duration_ms: number
    cost_usd: number
  }
}
```

The backend uses traces to:
- Update Thompson Sampling (α/β parameters)
- Calculate impulse relevance scores
- Extract patterns via ribosome
- Record failure patterns to avoid

## Summary

| Concern | Resolution |
|---------|------------|
| Goal type | Activity matching (Thompson-ranked) |
| Relevance scoring | Backend Thompson Sampling |
| Success verification | Output schema validation |
| Improvisation trigger | All activities exhausted |
| LLM usage | Resolver within tasks, improvisation fallback |
