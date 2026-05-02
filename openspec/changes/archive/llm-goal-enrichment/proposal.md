# Goal Processing Alignment

> **IMPORTANT**: This spec has been aligned with `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

## Problem

The GoalProcessor uses keyword matching in three critical places:
1. `parseGoal()` - determines goal type via regex patterns
2. `assessRelevance()` - scores recommendations via keyword overlap
3. `verifyGoalAchievement()` - checks completion via keyword patterns

This fails for vague goals like "say hello" or "make it better" because no keywords trigger.

## Foundation Alignment

The original proposal violated a core principle:

> **"LLMs Are Tools, Not Controllers"** - LLMs are one resolver type. Use them for reasoning and generation. Use deterministic resolvers for everything else.

The corrected approach:

| Component | ❌ Original | ✅ Aligned |
|-----------|------------|-----------|
| Goal type | LLM decides | Activity matching decides |
| Relevance | LLM scores | Thompson Sampling scores |
| Verification | LLM judges | Output schema validation |

## Solution

### 1. Goal Type Detection: Activity Matching, Not LLM

**Foundation says:**
> "Activities Constrain Search. Without activities, infinite options. With activities, ranked finite options."

Goal type is NOT determined by LLM classification. It emerges from which activities match:

```typescript
async parseGoal(message: string): Promise<Goal> {
  // Store raw goal - type determined later via activity matching
  return {
    message,
    intent: message,
    createdAt: Date.now(),
    // type: NOT SET HERE - determined by matching
  }
}

async processGoal(goal: Goal): Promise<void> {
  // Activity matching determines what "type" of goal this is
  const recommendations = await this.backend.recommendActivities({
    goalIntent: goal.intent,
    context: goal.context
  })

  // The MATCHED activities tell us what this goal is
  // Thompson Sampling ranks them by learned success
}
```

### 2. Relevance Scoring: Trust Thompson Sampling

**Foundation says:**
> "Thompson Sampling for activity selection. Relevance scores for impulse filtering."

Don't re-score with LLM. Trust the backend's learned scores:

```typescript
private assessRelevance(goal: Goal, recommendation: ActivityRecommendation): number {
  // Backend already computed this via Thompson Sampling
  // It knows: P(success | this goal shape, this activity)
  return recommendation.selectionMetadata?.score ?? 0
}
```

The backend learns from traces. Every execution updates Thompson parameters:
- Success → increment α
- Failure → increment β

Over time, the backend knows which activities work for which goal patterns.

### 3. Verification: Schema Validation, Not LLM Judgment

**Foundation says:**
> "Activity template defines outputSchema (what outputs it produces). Verification is: Do output impulses match what was promised?"

Verification is deterministic:

```typescript
private verifyGoalAchievement(
  activity: Activity,
  outputImpulses: Impulse[]
): boolean {
  // Check: did we produce what the activity promised?
  const requiredShapes = activity.outputSchema.produces
  const producedShapes = outputImpulses.map(i => i.metadata.shape)

  // All required shapes must be present
  return requiredShapes.every(required =>
    producedShapes.includes(required)
  )
}
```

**When IS LLM verification appropriate?**

Only for goals that are inherently subjective:
- "Make the code cleaner" (subjective)
- "Write good documentation" (subjective)

For these, the activity template should declare `subjective: true` and THEN use LLM verification.

### 4. Improvisation: Last Resort, Not Fast Fallback

**Foundation says:**
> "When nothing matches with sufficient confidence, the system can improvise. But improvisation MUST be recorded."

Correct improvisation trigger:

```
Input impulses
  ↓ Match against activities (Thompson-ranked)
  ↓ Activity #1: confidence 0.85 → try it
  ↓ Activity #1 fails
  ↓ Try Activity #2: confidence 0.72 (if > threshold)
  ↓ Activity #2 fails
  ↓ Activity #3: confidence 0.25 (below threshold 0.3)
  ↓ No more activities above threshold
  ↓ NOW improvise (with recording)
```

NOT:
```
Activity #1 fails
  ↓ IMMEDIATELY improvise ← WRONG
```

### 5. What LLM IS Appropriate For

The LLM is a resolver. Use it for:

1. **Reasoning about ambiguous input** (part of improvisation)
2. **Generating novel text** (code, docs, explanations)
3. **Optional context enrichment** (not decision-making)

```typescript
// APPROPRIATE: LLM as resolver within activity task
const task = {
  id: "generate-fix",
  resolver: "llm",  // LLM resolver
  params: {
    prompt: "Given this error, suggest a fix",
    input: ["error_log", "source_code"]
  }
}

// INAPPROPRIATE: LLM deciding what to do
// const whatShouldIDo = await llm.complete("What activity should I run?")
```

## Revised Design

### Goal Interface

```typescript
interface Goal {
  message: string
  intent: string  // Raw user intent
  context: Record<string, unknown>
  createdAt: number
  // NO type field - determined by activity matching
}
```

### Goal Processing Flow

```typescript
async processGoal(goal: Goal): Promise<void> {
  // 1. Ask backend for recommendations (Thompson-ranked)
  const recommendations = await this.backend.recommendActivities({
    goalIntent: goal.intent,
    impulses: goal.context.impulses
  })

  // 2. Try activities in order until one succeeds
  for (const rec of recommendations) {
    if (rec.score < this.confidenceThreshold) break

    const result = await this.executeActivity(rec.activity, goal)

    // 3. Verify via schema (deterministic)
    if (this.verifyOutputs(rec.activity, result.outputs)) {
      await this.recordSuccess(rec.activity, result)
      return // Goal achieved
    }

    await this.recordFailure(rec.activity, result)
  }

  // 4. All activities failed or none matched → improvise
  await this.improviseWithRecording(goal)
}
```

### Improvisation Recording

```typescript
async improviseWithRecording(goal: Goal): Promise<void> {
  const trace = {
    trace_type: "improvisation",
    steps: [],
    reasoning: [],
    outcome: null
  }

  // LLM resolves the ambiguous goal
  const result = await this.llm.complete({
    role: "system",
    content: "You have these tools available: ..."
  })

  trace.steps.push(result.toolCalls)
  trace.outcome = result.success ? "success" : "failure"

  // ALWAYS record
  await this.backend.storeTrace(trace)

  // If successful, ribosome extracts as template
  if (result.success) {
    await this.backend.notifyRibosomeCandidate(trace.id)
  }
}
```

## Summary of Changes from Original Spec

| Original | Aligned |
|----------|---------|
| LLM enriches goal type | Activity matching determines type |
| LLM scores relevance | Thompson Sampling scores relevance |
| LLM verifies achievement | Schema validation verifies achievement |
| Fast-fail to improvisation | Try all ranked activities first |
| LLM as decision maker | LLM as one resolver type |

## Scope

- `repos/minibob/src/goal-processor.ts` - main changes
- `repos/minibob/src/types.ts` - Goal interface simplification
- `repos/minibob/src/improviser.ts` - recording integration

## Cost Impact

**Original proposal added LLM calls for:**
- Goal enrichment (removed)
- Verification (removed for non-subjective goals)

**Aligned approach:**
- No additional LLM calls for goal processing
- LLM only used during improvisation (already existed)
- Cost neutral compared to current implementation
