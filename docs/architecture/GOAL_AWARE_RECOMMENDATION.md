# Goal-Aware Recommendation Architecture

## Key Insight: Goal Resolution is an Activity

**Goal → Activity selection is itself an activity.**

This is the meta-level application of the architecture principles. Instead of hardcoding recommendation logic in API endpoints, we:

1. Define goal resolution as activities with input/output shapes
2. Use Thompson Sampling to learn which resolution strategy works best
3. Let the system improve its own goal understanding over time

```
┌─────────────────────────────────────────────────────────────┐
│                   Goal Impulse                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           resolve-goal-orchestrator-v1                      │
│     (Thompson Sampling on resolution strategies)            │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│deterministic│  │  semantic   │  │ exploration │
│  (fast)     │  │  (accurate) │  │  (UCB1)     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│               Recommendation Impulse                        │
│     (activity_id, confidence, selection_trace)              │
└─────────────────────────────────────────────────────────────┘
```

## Registered Activities

| Activity ID | Input Shapes | Output Shapes | Purpose |
|------------|--------------|---------------|---------|
| `resolve-goal-deterministic-v1` | `[goal]` | `[recommendation, selection_trace]` | Fast keyword extraction + shape matching |
| `resolve-goal-semantic-v1` | `[goal]` | `[recommendation, selection_trace]` | LLM semantic analysis for complex goals |
| `resolve-goal-exploration-v1` | `[goal]` | `[recommendation, selection_trace, exploration_target]` | UCB1 exploration for weak priors |
| `resolve-goal-orchestrator-v1` | `[goal]` | `[recommendation, selection_trace]` | Meta-activity that selects strategy |

## Problem Statement

The current recommendation system differentiates goals by:
1. **Input shapes** - What types of impulses are provided
2. **Category** - Coarse classification (tool, feature, bugfix)
3. **Historical success** - Thompson Sampling priors

But it does NOT analyze:
- **Semantic content** of the goal text
- **Domain-specific keywords** (security, performance, refactor)
- **Similar past goals** that succeeded

This means the system can't distinguish between:
- "Fix the security vulnerability in auth" → needs security-focused activity
- "Fix the performance issue in auth" → needs performance-focused activity

Both have the same shapes and category, but need different approaches.

## Proposed Solution: Multi-Stage Goal Analysis

### Stage 1: Keyword Extraction (Deterministic)

Extract domain signals from goal text:

```typescript
interface GoalSignals {
  domain: 'security' | 'performance' | 'reliability' | 'feature' | 'refactor' | 'debug' | 'general';
  keywords: string[];  // Extracted terms
  confidence: number;  // 0-1 extraction confidence
}

function extractGoalSignals(goalText: string): GoalSignals {
  const domainPatterns = {
    security: /security|auth|permission|access|xss|injection|csrf|vulnerability/i,
    performance: /performance|speed|latency|cache|optimize|slow|memory|cpu/i,
    reliability: /reliability|error|crash|fail|timeout|retry|resilience/i,
    debug: /debug|bug|fix|issue|broken|wrong|incorrect/i,
    refactor: /refactor|clean|reorganize|restructure|simplify|extract/i,
    feature: /add|create|implement|new|feature|support/i,
  };

  for (const [domain, pattern] of Object.entries(domainPatterns)) {
    if (pattern.test(goalText)) {
      return {
        domain: domain as any,
        keywords: goalText.match(pattern) || [],
        confidence: 0.8,
      };
    }
  }

  return { domain: 'general', keywords: [], confidence: 0.5 };
}
```

### Stage 2: Shape-Conditioned Thompson Sampling

Already implemented via `v_shape_conditioned_score`:

```sql
-- Groups executions by (activity_id, org_id, shape_signature)
-- Computes Thompson priors (α, β) per group
SELECT * FROM v_shape_conditioned_score
WHERE activity_id IN $candidates
  AND shape_signature = $input_shapes
```

### Stage 3: Domain-Conditioned Scores (NEW)

Add a view that conditions on domain:

```sql
DEFINE TABLE IF NOT EXISTS v_domain_conditioned_score AS
  SELECT
    activity_id,
    org_id,
    metadata.domain AS domain,
    count() AS total_executions,
    count(IF success = true THEN 1 ELSE NONE END) + 1 AS alpha,
    count(IF success = false THEN 1 ELSE NONE END) + 1 AS beta
  FROM execution
  WHERE metadata.domain IS NOT NONE
  GROUP BY activity_id, org_id, metadata.domain;
```

### Stage 4: LLM-Assisted Goal Matching (Fallback)

When deterministic matching fails (no candidates with good priors):

```typescript
async function llmGoalMatch(
  goal: string,
  candidates: Activity[]
): Promise<{ activity_id: string; confidence: number }[]> {
  const prompt = `Given this goal: "${goal}"

Match to the most relevant activities:
${candidates.map(c => `- ${c.id}: ${c.description}`).join('\n')}

Return JSON: [{ "activity_id": "...", "confidence": 0.0-1.0 }]`;

  // Use Haiku for fast, cheap matching
  const response = await llm.generate(prompt, { model: 'haiku' });
  return JSON.parse(response);
}
```

### Stage 5: Exploration Strategy

When all priors are weak (< 5 executions), use exploration:

```typescript
function shouldExplore(
  candidates: ActivityScore[],
  explorationThreshold: number = 5
): boolean {
  // Explore if all candidates have low execution counts
  return candidates.every(c => c.total_executions < explorationThreshold);
}

function exploreActivity(candidates: Activity[]): Activity {
  // UCB1 exploration: balance exploitation (high mean) with exploration (high uncertainty)
  // Uncertainty = 1 / sqrt(total_executions + 1)
  const withUCB = candidates.map(c => ({
    ...c,
    ucb: (c.alpha / (c.alpha + c.beta)) + Math.sqrt(2 * Math.log(totalSelections) / (c.total_executions + 1)),
  }));

  return withUCB.sort((a, b) => b.ucb - a.ucb)[0];
}
```

## Data Gathering Strategy

### 1. Require Domain Metadata on Execution Traces

Update tracer to include domain:

```typescript
const tracedFunction = tracer.trace(fn, 'function-name', {
  inputShapes: ['goal', 'error'],
  metadata: {
    domain: 'debug',  // Extracted from goal
  },
});
```

### 2. Backfill Domain from Goal Text

For existing traces with goal impulses:

```sql
UPDATE execution
SET metadata.domain = fn::extract_domain(
  (SELECT content FROM impulse WHERE id IN execution.input_impulses AND shape = 'goal')[0].content
)
WHERE metadata.domain IS NONE
  AND input_impulse_shapes CONTAINS 'goal';
```

### 3. Record LLM Matching Results

When LLM matching is used, record for future learning:

```typescript
if (usedLlmMatching) {
  await recordExecution({
    ...trace,
    metadata: {
      ...trace.metadata,
      selection_method: 'llm_goal_match',
      llm_confidence: matchResult.confidence,
    },
  });
}
```

### 4. Active Learning: Targeted Improvisation

When exploring, prefer improvisation that fills gaps:

```typescript
async function targetedImprovisation(
  goal: string,
  weakAreas: { domain: string; shape_signature: string[] }[]
): Promise<Activity> {
  // Generate activity specifically for under-explored area
  const generated = await generateActivity({
    goalDescription: goal,
    constraints: {
      targetDomain: weakAreas[0].domain,
      targetShapes: weakAreas[0].shape_signature,
    },
  });

  return generated;
}
```

## Implementation Phases

### Phase 1: Domain Extraction (Deterministic)
- [ ] Add `extractGoalSignals()` function
- [ ] Include domain in execution traces
- [ ] Add `v_domain_conditioned_score` view

### Phase 2: Enhanced Recommendation
- [ ] Update `/recommend` to use domain signals
- [ ] Combine shape-conditioned + domain-conditioned priors
- [ ] Add exploration strategy for weak priors

### Phase 3: LLM Fallback
- [ ] Add LLM goal matching for no-match cases
- [ ] Record LLM matching results for learning
- [ ] Implement targeted improvisation

### Phase 4: Active Learning
- [ ] Identify under-explored areas
- [ ] Prioritize exploration in weak domains
- [ ] Generate targeted activities to fill gaps
