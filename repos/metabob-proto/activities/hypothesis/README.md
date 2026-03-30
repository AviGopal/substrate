# Hypothesis-Driven Codebase Understanding

This directory contains **meta-activities** that teach MiniBob to understand codebases through hypothesis testing AND learn from its own execution history.

## Overview

**Core Principle**: Activities ARE hypotheses. When MiniBob explores a codebase, it creates testable hypotheses (as activities with validators), executes them to observe reality, and decides whether to align code or expectations. MiniBob can also generate hypotheses about its OWN execution patterns to discover what works, what fails, and why.

## The Four Meta-Activities

### 1. `generate-hypothesis-activities.json`

**Purpose**: Create testable hypothesis activities from a learning goal.

**Input Shapes**: `goal`, `source_code`
**Output Shapes**: `activity`

**What It Does**:
1. Analyzes codebase structure (framework, patterns, dependencies)
2. Identifies components related to learning goal
3. Generates 3-5 hypothesis activities with validators
4. Registers activities with backend

**Example**:
```typescript
run_goal({
  activity_id: "generate-hypothesis-activities",
  variables: {
    learningGoal: "How does rate limiting work in this codebase?",
    entryPoints: "src/index.ts,package.json",
    sessionId: "hypothesis-2026-03-29-001"
  }
})
```

**Output**:
- `/tmp/hypothesis-{sessionId}/CODEBASE_ANALYSIS.md`
- `/tmp/hypothesis-{sessionId}/hypothesis_activities.json`
- `/tmp/hypothesis-{sessionId}/REGISTRATION_SUMMARY.md`

**Generated Activities** (examples):
- `hypothesis_existing_rate_limiter`: Check if rate limiting already exists
- `hypothesis_express_middleware`: Verify Express middleware pattern
- `hypothesis_redis_available`: Check if Redis is configured

---

### 2. `test-hypothesis.json`

**Purpose**: Execute a hypothesis activity and capture detailed observations.

**Input Shapes**: `activity`
**Output Shapes**: `trace`

**What It Does**:
1. Executes the hypothesis activity
2. Observes validator results (pass/fail)
3. Captures execution trace with state transitions
4. Documents expectations vs observations
5. Determines if hypothesis is confirmed/refuted/partial

**Example**:
```typescript
run_goal({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_express_middleware",
    hypothesisDescription: "Codebase uses Express middleware pattern",
    testId: "test-2026-03-29-001"
  }
})
```

**Output**:
- `/tmp/hypothesis-test-{testId}/OBSERVATIONS.md`
- `/tmp/hypothesis-test-{testId}/EXECUTION_TRACE.json`
- `/tmp/hypothesis-test-{testId}/TEST_SUMMARY.md`

**Hypothesis Status**:
- ✅ **CONFIRMED**: All validators passed
- ❌ **REFUTED**: Some validators failed
- ⚠️  **PARTIAL**: Mixed results

---

### 3. `interpret-test-results.json`

**Purpose**: Analyze test results and decide alignment strategy.

**Input Shapes**: `trace`, `goal`
**Output Shapes**: `recommendation`

**What It Does**:
1. Analyzes why validators failed (pattern_not_found, file_not_found, etc.)
2. Queries goal history to understand user preferences
3. Decides alignment strategy:
   - **ALIGN_CODE**: Fix code to match validators
   - **ALIGN_VALIDATOR**: Update validators to match code
   - **ACCEPT_DIFFERENCE**: Both approaches are valid
4. Generates alignment activity to execute the decision

**Example**:
```typescript
run_goal({
  activity_id: "interpret-test-results",
  variables: {
    testId: "test-2026-03-29-001",
    currentGoal: "Add distributed rate limiting"
  }
})
```

**Output**:
- `/tmp/hypothesis-test-{testId}/FAILURE_ANALYSIS.md`
- `/tmp/hypothesis-test-{testId}/GOAL_HISTORY.md`
- `/tmp/hypothesis-test-{testId}/ALIGNMENT_DECISION.md`
- `/tmp/hypothesis-test-{testId}/alignment_activity.json`
- `/tmp/hypothesis-test-{testId}/INTERPRETATION_COMPLETE.md`

**Alignment Decisions**:

| Decision | When | Action |
|----------|------|--------|
| ALIGN_CODE | Goal explicitly requires validated pattern | Generate refactoring activity |
| ALIGN_VALIDATOR | Code is correct, validator was wrong | Update hypothesis activity |
| ACCEPT_DIFFERENCE | Alternative valid approaches | Document tradeoffs |

---

### 4. `learn-from-executions.json`

**Purpose**: Meta-learning - analyze MiniBob's execution history to discover patterns.

**Input Shapes**: `trace`, `goal`
**Output Shapes**: `activity`, `recommendation`

**What It Does**:
1. Queries execution table for success/failure patterns
2. Generates meta-hypotheses about what works
3. Tests hypotheses statistically
4. Extracts confirmed patterns into new activities
5. Updates Thompson Sampling priors

**Example**:
```typescript
run_goal({
  activity_id: "learn-from-executions",
  variables: {
    learningGoal: "Which rate limiting approach has best success rate?",
    activityPattern: "%rate-limiting%",
    lookbackDays: 30,
    sessionId: "meta-001"
  }
})
```

**Output**:
- `/tmp/meta-learning-{sessionId}/EXECUTION_ANALYSIS.md`
- `/tmp/meta-learning-{sessionId}/meta_hypothesis_activities.json`
- `/tmp/meta-learning-{sessionId}/META_TEST_RESULTS.md`
- `/tmp/meta-learning-{sessionId}/extracted_activities.json`
- `/tmp/meta-learning-{sessionId}/LEARNING_SUMMARY.md`

**Discoveries** (examples):
- "Redis-based activities have 93% success vs 70% for in-memory"
- "Missing package.json causes 80% of dependency failures"
- "Goals with 'distributed' keyword need Redis"

**Meta-Learning Loop**:
```
Execute activities → Store traces → Analyze patterns →
Generate hypotheses → Test statistically → Extract activities →
Update Thompson Sampling → Execute with learned preferences → ...
```

---

## Complete Workflow Example

```typescript
// 1. Enter new codebase with a goal
const hypotheses = await run_goal({
  activity_id: "generate-hypothesis-activities",
  variables: {
    learningGoal: "Add rate limiting to API endpoints",
    entryPoints: "src/index.ts,package.json",
    sessionId: "session-001"
  },
  reason: "Understanding codebase before implementing rate limiting"
});

// Output: 3 hypothesis activities created
// - hypothesis_existing_rate_limiter
// - hypothesis_express_middleware
// - hypothesis_redis_available

// 2. Test each hypothesis
const test1 = await run_goal({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_existing_rate_limiter",
    hypothesisDescription: "Rate limiting already exists",
    testId: "test-001"
  },
  reason: "Testing if rate limiting is already implemented"
});
// Result: ❌ REFUTED - no rate limiting found

const test2 = await run_goal({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_express_middleware",
    hypothesisDescription: "Uses Express middleware pattern",
    testId: "test-002"
  },
  reason: "Testing if Express middleware pattern is used"
});
// Result: ✅ CONFIRMED - Express middleware pattern found

const test3 = await run_goal({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_redis_available",
    hypothesisDescription: "Redis available for rate limiter state",
    testId: "test-003"
  },
  reason: "Testing if Redis is configured"
});
// Result: ❌ REFUTED - Redis not in package.json

// 3. Interpret the Redis failure (most important for implementation)
const interpretation = await run_goal({
  activity_id: "interpret-test-results",
  variables: {
    testId: "test-003",
    currentGoal: "Add distributed rate limiting across instances"
  },
  reason: "Deciding whether to add Redis or use in-memory"
});
// Decision: ALIGN_CODE - Add Redis because goal mentions "distributed"
// Generated: alignment_activity.json to install Redis and refactor

// 4. Execute alignment
const alignment = await run_goal({
  activity_id: "align_code_add_redis", // from interpretation output
  reason: "Adding Redis to support distributed rate limiting"
});

// 5. Re-test hypothesis to verify
const retest = await run_goal({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_redis_available",
    hypothesisDescription: "Redis available",
    testId: "retest-003"
  },
  reason: "Verifying Redis is now available"
});
// Result: ✅ CONFIRMED - Redis now in package.json and configured
```

## Architecture Alignment

These activities implement the **Impulse-Activity Foundation** principles:

### Activities ARE Hypotheses
```
Traditional:                    Hypothesis-Driven:
───────────                     ─────────────────
1. Read docs                    1. Create hypothesis activity
2. Understand code              2. Execute (test hypothesis)
3. Write implementation         3. Validators check expectations
4. Hope it works                4. Align code or validators
```

### Uses New Paradigm Tables

All data stored in 4 core tables (020-paradigm-core-tables.surql):

1. **`impulse` table**:
   - Goals (shape='goal')
   - Source code (shape='source_code')
   - Traces (shape='trace')
   - Recommendations (shape='recommendation')

2. **`activity` table**:
   - Hypothesis activities (input_shapes, output_shapes, validators)
   - Meta-activities (these three templates)
   - Alignment activities (generated by interpret-test-results)

3. **`execution` table**:
   - Hypothesis test executions
   - Validator results (pass/fail with details)
   - State transitions (files read/written)

4. **`vessel` table**:
   - MiniBob instances that execute hypotheses
   - Resolver capabilities (file, memo types)

### No New Storage

Everything uses existing infrastructure:
- ✅ Thompson Sampling learns which hypotheses are reliable
- ✅ Ribosome pattern extracts successful patterns
- ✅ Trailblazing creates variants when hypotheses fail
- ✅ Goal history informs alignment decisions

## Success Metrics

Track hypothesis quality over time:

1. **Hypothesis Accuracy**: % of hypotheses confirmed on first test
2. **Alignment Quality**: % of alignment decisions that satisfy goal
3. **Learning Rate**: How quickly accuracy improves
4. **Code Quality**: Does aligned code pass tests?
5. **Validator Quality**: Do aligned validators reflect reality?

Query from execution table:
```sql
SELECT
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'completed' AND success = true THEN 1 ELSE 0 END) as confirmed,
  AVG(duration_ms) as avg_duration,
  AVG(cost_usd) as avg_cost
FROM execution
WHERE activity_id LIKE 'hypothesis_%'
  AND created_at > time::now() - 7d
```

## Testing Against Any Repository

See `scratch/` directory for test scenarios:

```bash
# Clone any repo to scratch/
cd scratch/
git clone https://github.com/example/repo test-repo
cd test-repo

# Generate hypotheses
minibob exec generate-hypothesis-activities \
  --var learningGoal="How does authentication work?" \
  --var entryPoints="package.json,src/index.ts" \
  --var sessionId="test-$(date +%s)"

# Follow workflow above...
```

## Debugging

All activities write to `/tmp/hypothesis-*` and `/tmp/hypothesis-test-*`:

```bash
# View codebase analysis
cat /tmp/hypothesis-{sessionId}/CODEBASE_ANALYSIS.md

# View generated hypotheses
cat /tmp/hypothesis-{sessionId}/hypothesis_activities.json | jq .

# View test observations
cat /tmp/hypothesis-test-{testId}/OBSERVATIONS.md

# View alignment decision
cat /tmp/hypothesis-test-{testId}/ALIGNMENT_DECISION.md
```

## Meta-Learning Workflow

MiniBob learning from itself:

```typescript
// Phase 1: Execute activities (normal usage)
// Users use MiniBob, executions stored in execution table

// Phase 2: Periodic meta-learning (automated)
const learning = await run_goal({
  activity_id: "learn-from-executions",
  variables: {
    learningGoal: "What patterns lead to success?",
    lookbackDays: 30,
    sessionId: `meta-${Date.now()}`
  },
  reason: "Automated meta-learning to improve recommendations"
});

// Discovers patterns:
// - Redis succeeds 93% of the time (vs 70% for in-memory)
// - Missing package.json causes 80% of failures
// - Goals with "distributed" → need Redis

// Phase 3: Extract improved activities
// New activity created: "add-rate-limiting-redis-preferred"
// - Includes learned validators (check package.json exists)
// - Thompson Sampling prior: 93% success
// - Metadata: "Learned from 15 executions, confidence 0.89"

// Phase 4: Apply learnings (automatic)
// Next time user requests rate limiting:
// - Thompson Sampling draws from Beta(14, 1) → high probability
// - Redis approach selected 80% of the time
// - Success rate improves over time

// Phase 5: Continuous refinement
// Every execution updates the learning
// Patterns validated or refined with more data
```

See `scratch/META_LEARNING_DEMO.md` for detailed example.

## Future Enhancements

1. **LLM-based Intent Extraction**: Use Haiku to infer hypothesis intent from code patterns
2. **Graph-based Hypotheses**: Test structural hypotheses using CPG traversal (integration with metabob-analysis-api)
3. **Probabilistic Validators**: Soft validators with confidence scores instead of pass/fail
4. **Cross-Codebase Meta-learning**: Learn patterns across multiple repositories
5. **Collaborative Filtering**: Share anonymized hypothesis patterns across organizations
6. **Automated Meta-Learning Schedule**: Trigger meta-learning after N executions or M days
