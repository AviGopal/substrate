# Hypothesis-Driven Understanding Demo Workflow

This document demonstrates the complete hypothesis testing workflow using the demo repository.

## Prerequisites

1. MiniBob deployed and accessible
2. metabob-activity-api running with new paradigm tables
3. Hypothesis seed activities loaded in metabob-proto

## Demo Scenario: Adding Distributed Rate Limiting

**User Goal**: "Add distributed rate limiting to support multiple API instances"

---

## Step 1: Generate Hypothesis Activities

MiniBob analyzes the codebase and creates testable hypotheses.

```typescript
// Execute via MiniBob
const result = await minibob.execute({
  activity_id: "generate-hypothesis-activities",
  variables: {
    learningGoal: "How does rate limiting work? Need to make it distributed.",
    entryPoints: "package.json,src/index.ts",
    sessionId: "demo-2026-03-29-001"
  },
  reason: "Understanding current rate limiting before making it distributed",
  workingDirectory: "/path/to/scratch/hypothesis-demo-repo"
});
```

**Expected Output**:
```
✅ Codebase analysis complete
✅ Generated 4 hypothesis activities:
   1. hypothesis_express_framework
   2. hypothesis_rate_limiter_exists
   3. hypothesis_redis_storage
   4. hypothesis_middleware_applied

📂 Files created:
   - /tmp/hypothesis-demo-2026-03-29-001/CODEBASE_ANALYSIS.md
   - /tmp/hypothesis-demo-2026-03-29-001/hypothesis_activities.json
   - /tmp/hypothesis-demo-2026-03-29-001/REGISTRATION_SUMMARY.md
```

**View Generated Hypotheses**:
```bash
cat /tmp/hypothesis-demo-2026-03-29-001/hypothesis_activities.json | jq .
```

**Example Hypothesis Activity** (auto-generated):
```json
{
  "id": "hypothesis_redis_storage",
  "name": "Check: Redis used for rate limiter state storage",
  "execution_type": "template",
  "input_shapes": ["source_code"],
  "output_shapes": ["trace"],
  "tasks": [
    {
      "id": "check_redis_dependency",
      "description": "Verify Redis in dependencies",
      "validation": {
        "required_files": ["package.json"],
        "required_patterns": ["redis", "ioredis", "@upstash/redis"],
        "forbidden_patterns": []
      }
    },
    {
      "id": "check_redis_import",
      "description": "Verify Redis imported in rate limiter",
      "validation": {
        "required_files": ["src/index.ts"],
        "required_patterns": ["import.*redis", "RedisClient", "redis\\."],
        "forbidden_patterns": ["Map<", "new Map"]
      }
    }
  ]
}
```

---

## Step 2: Test Hypotheses

Execute each hypothesis activity to confirm/refute understanding.

### Test 1: Express Framework

```typescript
const test1 = await minibob.execute({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_express_framework",
    hypothesisDescription: "Uses Express web framework",
    testId: "test-001"
  },
  reason: "Testing if Express is used",
  workingDirectory: "/path/to/scratch/hypothesis-demo-repo"
});
```

**Result**:
```
✅ Hypothesis CONFIRMED

Validators:
  ✅ package.json contains "express"
  ✅ src/index.ts imports express
  ✅ Pattern "app.use" found (middleware pattern)

Execution:
  - Duration: 1,234ms
  - Cost: $0.01
  - Files examined: 2

📂 Files created:
   - /tmp/hypothesis-test-test-001/OBSERVATIONS.md
   - /tmp/hypothesis-test-test-001/EXECUTION_TRACE.json
   - /tmp/hypothesis-test-test-001/TEST_SUMMARY.md
```

### Test 2: Rate Limiter Exists

```typescript
const test2 = await minibob.execute({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_rate_limiter_exists",
    hypothesisDescription: "Rate limiting functionality exists",
    testId: "test-002"
  },
  reason: "Testing if rate limiter is implemented"
});
```

**Result**:
```
✅ Hypothesis CONFIRMED

Validators:
  ✅ Function "rateLimitMiddleware" found
  ✅ Pattern "requestCounts" found (tracking requests)
  ✅ Status code 429 handling found

Execution:
  - Duration: 1,456ms
  - Cost: $0.01
```

### Test 3: Redis Storage (KEY TEST)

```typescript
const test3 = await minibob.execute({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_redis_storage",
    hypothesisDescription: "Redis used for distributed state",
    testId: "test-003"
  },
  reason: "Testing if Redis is used for rate limiter state"
});
```

**Result**:
```
❌ Hypothesis REFUTED

Validators:
  ❌ package.json: Pattern "redis" NOT FOUND
     Expected: redis, ioredis, or @upstash/redis
     Actual: Only express in dependencies

  ❌ src/index.ts: Pattern "import.*redis" NOT FOUND
     Expected: Redis import statement
     Actual: Uses "new Map<string, ...>" for in-memory storage

  ✅ Forbidden pattern "Map<" FOUND (indicates in-memory, not Redis)

Execution:
  - Duration: 1,321ms
  - Cost: $0.01

📂 Files created:
   - /tmp/hypothesis-test-test-003/OBSERVATIONS.md
   - /tmp/hypothesis-test-test-003/EXECUTION_TRACE.json
   - /tmp/hypothesis-test-test-003/TEST_SUMMARY.md

⚠️  Next: Run interpret-test-results to decide alignment strategy
```

---

## Step 3: Interpret Test Results

Analyze the Redis hypothesis failure and decide alignment strategy.

```typescript
const interpretation = await minibob.execute({
  activity_id: "interpret-test-results",
  variables: {
    testId: "test-003",
    currentGoal: "Add distributed rate limiting to support multiple API instances"
  },
  reason: "Deciding whether to add Redis or accept in-memory approach",
  workingDirectory: "/path/to/scratch/hypothesis-demo-repo"
});
```

**Processing**:
```
🔍 Analyzing validator failures...
   - 2 validators failed: redis dependency and import
   - Failure category: pattern_not_found
   - Code uses: In-memory Map
   - Expected: Redis client

📚 Querying goal history...
   - Found 5 recent goals
   - 2 mention "distributed"
   - 1 mentions "scalability"
   - 0 mention "simple" or "local-only"
   - Pattern: User prefers scalable solutions

⚖️  Making alignment decision...
   Current goal: "Add DISTRIBUTED rate limiting"
   Code status: Works correctly (in-memory)
   Goal requires: Distributed state (Redis)

   Decision: ALIGN_CODE
   Reason: Goal explicitly requires distributed capability,
           current in-memory approach doesn't support multiple instances

✅ Generated alignment activity: align_code_add_redis
```

**Output Files**:
```
📂 Files created:
   - /tmp/hypothesis-test-test-003/FAILURE_ANALYSIS.md
   - /tmp/hypothesis-test-test-003/GOAL_HISTORY.md
   - /tmp/hypothesis-test-test-003/ALIGNMENT_DECISION.md
   - /tmp/hypothesis-test-test-003/alignment_activity.json
   - /tmp/hypothesis-test-test-003/INTERPRETATION_COMPLETE.md
```

**View Alignment Decision**:
```bash
cat /tmp/hypothesis-test-test-003/ALIGNMENT_DECISION.md
```

```markdown
# Alignment Decision

**Test ID**: test-003
**Current Goal**: Add distributed rate limiting to support multiple API instances
**Decision**: ALIGN_CODE

## Decision Summary

Code must be refactored to use Redis for distributed state storage because
the current goal explicitly requires multi-instance support which in-memory
storage cannot provide.

## Rationale

### Current Goal Analysis
Goal contains keyword "distributed" which implies:
- Multiple API instances running concurrently
- Shared state across instances
- Horizontal scalability

In-memory Map only works within a single process.

### Goal History Insights
User has shown preference for:
- Scalability (mentioned in 2/5 recent goals)
- Production-ready solutions
- Multi-instance architectures

### Failure Impact
HIGH - Blocks the core requirement of distribution.

### Final Reasoning
While the current in-memory implementation works correctly for a single
instance, it fundamentally cannot support the stated goal. Redis is the
appropriate solution for distributed rate limiting.

## Action Items

### Align Code to Validators

**Changes Required**:
1. Add Redis dependency
   - File: package.json
   - Action: Add "ioredis": "^5.3.2"
   - Reason: Need Redis client library

2. Create Redis client initialization
   - File: src/redis.ts (new file)
   - Action: Initialize Redis client with connection handling
   - Reason: Centralized Redis configuration

3. Refactor rate limiter to use Redis
   - File: src/index.ts
   - Action: Replace Map with Redis INCR/EXPIRE commands
   - Reason: Distributed state storage

**Next Activity**: Run align_code_add_redis

**Success Criteria**: Re-run hypothesis_redis_storage - should CONFIRM
```

---

## Step 4: Execute Alignment

Run the generated alignment activity to add Redis.

```typescript
const alignment = await minibob.execute({
  activity_id: "align_code_add_redis",
  reason: "Adding Redis to support distributed rate limiting",
  workingDirectory: "/path/to/scratch/hypothesis-demo-repo"
});
```

**Expected Changes**:
```
✅ Task 1: add-redis-dependency
   - Modified: package.json
   - Added: "ioredis": "^5.3.2"

✅ Task 2: create-redis-client
   - Created: src/redis.ts
   - Exports: redisClient, connectRedis()

✅ Task 3: refactor-rate-limiter
   - Modified: src/index.ts
   - Changed: Map → Redis INCR/EXPIRE
   - Pattern: redis.incr(key), redis.expire(key, 60)

✅ Task 4: update-environment
   - Created: .env.example
   - Added: REDIS_URL=redis://localhost:6379

📂 Files changed:
   - package.json
   - src/index.ts
   - src/redis.ts (new)
   - .env.example (new)
```

**View Refactored Code**:
```typescript
// src/index.ts (after alignment)
import express from 'express';
import { redisClient, connectRedis } from './redis';

await connectRedis();

const app = express();
const PORT = 3000;

// Redis-based distributed rate limiting middleware
async function rateLimitMiddleware(req, res, next) {
  const clientId = req.ip || 'unknown';
  const key = `ratelimit:${clientId}`;
  const maxRequests = 10;
  const windowSeconds = 60;

  const current = await redisClient.incr(key);

  if (current === 1) {
    await redisClient.expire(key, windowSeconds);
  }

  if (current <= maxRequests) {
    next();
  } else {
    res.status(429).json({ error: 'Too many requests' });
  }
}

app.use(rateLimitMiddleware);
// ... rest of code
```

---

## Step 5: Re-test Hypothesis

Verify the hypothesis now passes after alignment.

```typescript
const retest = await minibob.execute({
  activity_id: "test-hypothesis",
  variables: {
    hypothesisActivityId: "hypothesis_redis_storage",
    hypothesisDescription: "Redis used for distributed state",
    testId: "retest-003"
  },
  reason: "Verifying Redis is now used after alignment"
});
```

**Result**:
```
✅ Hypothesis CONFIRMED

Validators:
  ✅ package.json contains "ioredis"
  ✅ src/redis.ts exists with Redis client
  ✅ src/index.ts imports from './redis'
  ✅ Pattern "redis.incr" found
  ✅ Pattern "redis.expire" found
  ❌ Forbidden pattern "new Map" NOT FOUND (correct - no longer used)

Execution:
  - Duration: 1,288ms
  - Cost: $0.01

📊 Hypothesis Evolution:
   - First test (test-003): ❌ REFUTED
   - After alignment (retest-003): ✅ CONFIRMED
   - Learning: Hypothesis validator was correct for the goal

✅ Codebase now aligned with distributed requirements
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ Hypothesis-Driven Understanding Complete                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Learning Goal: Add distributed rate limiting                    │
│                                                                  │
│ Hypotheses Generated: 4                                         │
│   ✅ Express framework       - CONFIRMED                        │
│   ✅ Rate limiter exists     - CONFIRMED                        │
│   ❌ Redis storage           - REFUTED → ALIGNED               │
│   ✅ Middleware applied      - CONFIRMED                        │
│                                                                  │
│ Alignment Decision: ALIGN_CODE                                  │
│   Reason: Goal requires distribution, code was single-instance  │
│   Action: Added Redis dependency and refactored                 │
│   Result: ✅ All hypotheses now confirmed                      │
│                                                                  │
│ Learning Captured:                                               │
│   - Express middleware pattern used                             │
│   - In-memory storage insufficient for distribution             │
│   - Redis INCR/EXPIRE pattern for rate limiting                │
│   - Alignment decision based on goal context                    │
│                                                                  │
│ Cost: ~$0.04 total (~$0.01 per hypothesis test)                │
│ Duration: ~6 seconds total                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Insights

1. **Activities ARE Hypotheses**: Each generated activity tested a specific understanding
2. **Validators Check Expectations**: Pattern matching validated assumptions
3. **Traces Capture Observations**: Execution traces showed what actually exists
4. **Goal Context Drives Alignment**: "Distributed" keyword triggered ALIGN_CODE decision
5. **Learning Loop Closes**: Re-testing confirmed alignment was successful

## Using This Pattern on Any Codebase

```bash
# 1. Clone any repo to scratch/
git clone <repo-url> scratch/my-test-repo

# 2. Generate hypotheses
minibob exec generate-hypothesis-activities \
  --var learningGoal="How does <feature> work?" \
  --var entryPoints="<relevant files>" \
  --var sessionId="test-$(date +%s)"

# 3. Test hypotheses
for hypothesis_id in $(cat /tmp/hypothesis-*/hypothesis_activities.json | jq -r '.activities[].id'); do
  minibob exec test-hypothesis \
    --var hypothesisActivityId="$hypothesis_id" \
    --var testId="test-$hypothesis_id"
done

# 4. Interpret failures
for test_id in $(ls -d /tmp/hypothesis-test-* | xargs -n1 basename); do
  if grep -q "REFUTED" "/tmp/$test_id/TEST_SUMMARY.md"; then
    minibob exec interpret-test-results \
      --var testId="$test_id" \
      --var currentGoal="<your goal>"
  fi
done

# 5. Execute alignments
# (alignment activities generated by interpret-test-results)
```

## Next Steps

1. ✅ Seed activities are working
2. ⏭️  Test on real-world codebases
3. ⏭️  Add LLM-based intent extraction for better hypothesis generation
4. ⏭️  Track hypothesis accuracy metrics in execution table
5. ⏭️  Build dashboard to visualize hypothesis testing patterns
