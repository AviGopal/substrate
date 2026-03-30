# Meta-Learning Demo: MiniBob Learning from Itself

## The Self-Improving Loop

```
┌──────────────────────────────────────────────────────────┐
│  1. MiniBob Executes Activities                          │
│     - add-rate-limiting (Redis version)                  │
│     - add-rate-limiting (in-memory version)              │
│     - Results stored in execution table                  │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  2. MiniBob Analyzes Its Own History                     │
│     run_goal({ activity_id: "learn-from-executions" })   │
│     - Queries execution table                            │
│     - Discovers: Redis has 92% success, in-memory 78%    │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  3. MiniBob Generates Hypotheses About Patterns          │
│     "Redis-based activities succeed more often"          │
│     - Creates meta-hypothesis activity                   │
│     - Validates against execution data                   │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  4. MiniBob Tests Hypotheses                             │
│     - Runs statistical analysis on execution traces      │
│     - Confirms: Redis pattern is superior (p < 0.05)     │
│     - Confidence: 0.85                                   │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  5. MiniBob Extracts New Activities                      │
│     - Creates "add-rate-limiting-redis" (preferred)      │
│     - Adds validators from failure analysis              │
│     - Updates Thompson Sampling priors                   │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  6. MiniBob Uses Learned Patterns                        │
│     - Next time: Auto-recommends Redis approach          │
│     - Thompson Sampling: 92% prior → higher selection    │
│     - Validators prevent known failures                  │
└────────────────┬─────────────────────────────────────────┘
                 │
                 └─────────► Back to Step 1 (continuous)
```

## Demo Scenario: Learning Which Rate Limiting Works Best

### Initial State (No Learning)

MiniBob has two activity variants:
- `add-rate-limiting-redis` (never executed)
- `add-rate-limiting-memory` (never executed)

Thompson Sampling uses neutral priors (50/50).

### Execution Phase (Gathering Data)

```bash
# User requests rate limiting 25 times over 2 weeks
# Different goals trigger different variants:

# 10 times: Goals mentioning "simple", "local", "development"
# → MiniBob tries in-memory approach
# → Result: 7 successes, 3 failures (70% success)

# 15 times: Goals mentioning "distributed", "production", "multi-instance"
# → MiniBob tries Redis approach
# → Result: 14 successes, 1 failure (93% success)
```

**Execution table now contains**:
```sql
SELECT
  activity_id,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes
FROM execution
WHERE activity_id LIKE '%rate-limiting%'
GROUP BY activity_id;

-- Results:
-- add-rate-limiting-memory: 10 total, 7 successes (70%)
-- add-rate-limiting-redis:  15 total, 14 successes (93%)
```

### Meta-Learning Phase (Discovery)

MiniBob runs meta-learning:

```typescript
const learning = await minibob.execute({
  activity_id: "learn-from-executions",
  variables: {
    learningGoal: "Which rate limiting approach has the best success rate?",
    activityPattern: "%rate-limiting%",
    lookbackDays: 30,
    minSampleSize: 5,
    sessionId: "meta-001"
  },
  reason: "Analyzing rate limiting patterns to improve recommendations"
});
```

**Output: `/tmp/meta-learning-meta-001/EXECUTION_ANALYSIS.md`**

```markdown
# Execution Pattern Analysis

**Learning Goal**: Which rate limiting approach has the best success rate?
**Period**: Last 30 days
**Total Executions**: 25

## Success Patterns

### Top Performing Activities
| Activity | Executions | Success Rate | Avg Duration | Avg Cost |
|----------|------------|--------------|--------------|----------|
| add-rate-limiting-redis | 15 | 93% | 2.1s | $0.02 |
| add-rate-limiting-memory | 10 | 70% | 1.8s | $0.01 |

### Common Success Characteristics
- **Redis approach**: Used when goals mention "distributed", "production"
- **In-memory approach**: Used for "simple", "local" scenarios
- **Pattern**: Distributed scenarios need Redis for reliability

## Failure Patterns

### Top Failure Causes
| Error Message | Activity | Frequency | Common Conditions |
|---------------|----------|-----------|-------------------|
| Redis connection failed | add-rate-limiting-redis | 1 | REDIS_URL not set |
| Map not distributed | add-rate-limiting-memory | 3 | Multi-instance deployment |

### Common Failure Characteristics
- **In-memory failures**: Occur when deployed to multiple instances
- **Redis failures**: Only when environment misconfigured

## Hypotheses to Test

1. **Hypothesis**: Redis-based approach has higher success rate
   - Evidence: 93% vs 70% success
   - Test: Statistical significance test

2. **Hypothesis**: In-memory fails in distributed scenarios
   - Evidence: All 3 failures had "multi-instance" in goal
   - Test: Query goals + failures correlation

3. **Hypothesis**: Redis requires environment configuration
   - Evidence: 1 failure due to missing REDIS_URL
   - Test: Check if validator could prevent this
```

**Meta-Hypothesis Generation**:

```json
{
  "meta_hypotheses": [
    {
      "id": "meta_hypothesis_redis_superior",
      "name": "Test: Redis approach has statistically significant higher success",
      "validation": {
        "execution_queries": [{
          "sql": "SELECT activity_id, AVG(success) as rate FROM execution WHERE activity_id LIKE '%rate-limiting%' GROUP BY activity_id",
          "expected": "redis.rate > 0.9 AND memory.rate < 0.8",
          "min_sample_size": 10
        }]
      }
    },
    {
      "id": "meta_hypothesis_memory_fails_distributed",
      "name": "Test: In-memory fails when goal mentions 'distributed'",
      "validation": {
        "execution_queries": [{
          "sql": "SELECT e.success, i.content FROM execution e JOIN impulse i ON e.input_impulses CONTAINS i.id WHERE e.activity_id = 'add-rate-limiting-memory' AND i.shape = 'goal'",
          "expected": "goals with 'distributed' have success = false",
          "confidence_threshold": 0.7
        }]
      }
    }
  ]
}
```

**Meta-Hypothesis Testing**:

```
✅ Meta-Hypothesis 1: CONFIRMED (Confidence: 0.89)
   Redis success: 93% (n=15)
   Memory success: 70% (n=10)
   Effect size: +23 percentage points
   p-value: 0.042 (significant)

✅ Meta-Hypothesis 2: CONFIRMED (Confidence: 0.85)
   In-memory with "distributed" goal: 0% success (3/3 failed)
   In-memory without "distributed": 100% success (7/7 passed)
   Strong correlation between distributed goal and failure
```

**Pattern Extraction**:

```json
{
  "extracted_activities": [
    {
      "id": "add-rate-limiting-redis-preferred",
      "name": "Add Redis Rate Limiting (Preferred)",
      "description": "Implement distributed rate limiting using Redis (93% success rate)",
      "metadata": {
        "extracted_from": "meta-learning-meta-001",
        "evidence": {
          "success_rate": 0.93,
          "sample_size": 15,
          "confidence": 0.89,
          "learned_at": "2026-03-29T10:30:00Z"
        },
        "preference": {
          "when": ["goal contains 'distributed'", "goal contains 'production'", "multi-instance deployment"],
          "avoid_when": ["goal contains 'simple' AND goal contains 'local'"]
        }
      },
      "tasks": [
        {
          "id": "verify-redis-config",
          "description": "Check Redis configuration (prevents 100% of Redis failures)",
          "preChecks": [
            {
              "name": "check-redis-url",
              "command": "test -n \"$REDIS_URL\"",
              "failureMessage": "REDIS_URL not set. Learned: This causes all Redis-based failures.",
              "learned_from": "failure_analysis_meta-001"
            }
          ]
        },
        {
          "id": "implement-redis-rate-limiter",
          "validation": {
            "required_patterns": ["redis.incr", "redis.expire"],
            "forbidden_patterns": ["Map<", "in-memory"],
            "reason": "Learned: Redis pattern 23% more reliable than in-memory"
          }
        }
      ]
    }
  ]
}
```

**Thompson Sampling Update**:

```json
{
  "priors_before": {
    "add-rate-limiting-redis": { "alpha": 1, "beta": 1 },   // Neutral 50/50
    "add-rate-limiting-memory": { "alpha": 1, "beta": 1 }   // Neutral 50/50
  },
  "priors_after_learning": {
    "add-rate-limiting-redis": { "alpha": 14, "beta": 1 },  // 93% success → strong prior
    "add-rate-limiting-memory": { "alpha": 7, "beta": 3 }   // 70% success → weak prior
  },
  "selection_probability": {
    "redis": "~80%",        // Much higher due to strong evidence
    "memory": "~20%"        // Still explored, but less often
  }
}
```

### Application Phase (Using Learned Patterns)

**Next time user requests rate limiting**:

```typescript
const recommendation = await activityApi.recommend({
  goal: "Add distributed rate limiting for API gateway",
  context: { deployment: "multi-instance" }
});

// Thompson Sampling with learned priors:
// - Draws from Beta(14, 1) for Redis → ~0.93
// - Draws from Beta(7, 3) for memory → ~0.70
// - Selects Redis (80% chance)

// Plus goal matching:
// - Goal contains "distributed" → Redis strongly preferred (learned pattern)
// - Confidence: 0.89 (from meta-learning)

// Result:
{
  "recommended_activity": "add-rate-limiting-redis-preferred",
  "confidence": 0.89,
  "reason": "Learned from 15 executions: 93% success rate for distributed scenarios",
  "alternatives": [
    {
      "activity": "add-rate-limiting-memory",
      "confidence": 0.11,
      "reason": "70% success rate, but fails in distributed scenarios"
    }
  ]
}
```

**Execution with learned validators**:

```typescript
// Pre-check runs BEFORE execution (learned from failures)
// Check 1: REDIS_URL is set
if (!process.env.REDIS_URL) {
  throw new Error(
    "REDIS_URL not set. " +
    "Learned: This causes 100% of Redis failures. " +
    "Preventing execution to avoid known failure mode."
  );
}

// Execution proceeds with high confidence
// MiniBob knows this pattern works 93% of the time
```

## Continuous Improvement Loop

### Month 1: Initial Learning
- Executions: 25
- Patterns discovered: Redis > in-memory for distributed
- Confidence: 0.89

### Month 2: Validation & Refinement
- Executions: 50 more (75 total)
- Redis: 46/50 success (92%) - pattern holds!
- In-memory: 15/25 success (60%) - declining (more distributed goals)
- Confidence: 0.93 (increasing with more data)

### Month 3: Pattern Evolution
- New pattern discovered: "Redis + Upstash for serverless"
- Executions: 100 total
- Three variants now:
  - Redis (self-hosted): 92% success
  - Redis (Upstash): 95% success
  - In-memory: 55% success (mostly failed distributed cases)

### Month 6: Mature Patterns
- Thompson Sampling heavily favors Redis (99% selection)
- In-memory only selected for explicit "local-only" goals
- New meta-learning: "Which Redis provider is best?"

## Key Benefits

### 1. **Self-Documentation**
MiniBob documents its own patterns:
- "I learned that Redis works 93% of the time for distributed scenarios"
- Evidence: 15 successful executions
- Confidence: 0.89

### 2. **Self-Improvement**
MiniBob gets better over time:
- Month 1: 50/50 guess between Redis and in-memory
- Month 2: 80/20 preference for Redis (learned)
- Month 6: 99/1 preference for Redis (validated)

### 3. **Self-Debugging**
MiniBob identifies failure modes:
- "Missing REDIS_URL causes 100% of Redis failures"
- "In-memory fails 100% of the time in distributed scenarios"
- Adds validators to prevent known failures

### 4. **Meta-Learning**
MiniBob learns HOW to learn:
- Which patterns to look for
- How much data is enough (min_sample_size)
- When to re-evaluate (after N executions)

## Comparison with Traditional Approaches

### Traditional ML Pipeline
```
1. Collect data manually
2. Feature engineering (manual)
3. Train model (batch)
4. Deploy model
5. Monitor performance
6. Retrain periodically (manual trigger)
```

### MiniBob Meta-Learning
```
1. Execute activities (automatic - users use the system)
2. Pattern discovery (automatic - hypothesis generation)
3. Validation (automatic - hypothesis testing)
4. Extraction (automatic - create new activities)
5. Application (automatic - Thompson Sampling)
6. Continuous refinement (automatic - every execution updates)
```

**No manual intervention needed!**

## Integration with Codebase Hypotheses

The same meta-learning works for understanding codebases:

```typescript
// Learn from codebase exploration history
const codebaseLearning = await minibob.execute({
  activity_id: "learn-from-executions",
  variables: {
    learningGoal: "Which codebase patterns indicate Express framework?",
    activityPattern: "hypothesis_express%",
    sessionId: "codebase-meta-001"
  }
});

// Discovers:
// - "package.json with 'express' → 98% confidence Express is used"
// - "app.use() pattern → 95% confidence Express is used"
// - "import express from 'express' → 100% confidence Express is used"
//
// Extracts hypothesis activity with learned patterns:
// - Check package.json first (fastest, 98% accurate)
// - If ambiguous, check for app.use() (95% accurate)
// - Fall back to import statement (100% accurate but slower)
```

## Summary

Meta-learning enables MiniBob to:

1. ✅ **Learn what works** - Discover high-success patterns
2. ✅ **Learn what breaks** - Identify failure modes
3. ✅ **Learn what to recommend** - Improve Thompson Sampling priors
4. ✅ **Learn how to validate** - Add pre-checks from failure analysis
5. ✅ **Learn continuously** - Every execution updates understanding

All without human intervention - just by querying its own execution history with hypotheses!
