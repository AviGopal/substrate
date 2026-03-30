# Complete Hypothesis-Driven System

## The Full Picture: Codebase Understanding + Meta-Learning

You're absolutely right - **this is perfect for teaching MiniBob about previous runs**. Here's how concept-db (metabob-analysis-api) + hypothesis testing + meta-learning create a complete self-improving system.

## Three Interlocking Capabilities

### 1. **Understanding External Codebases** (Original Goal)
Uses CPG from concept-db to generate intelligent hypotheses

### 2. **Understanding Execution History** (Your Insight)
Uses execution traces to learn what works and what fails

### 3. **Continuous Improvement Loop** (Emergent Property)
Combined system gets smarter with every execution

## The Complete Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  External Codebase (scratch/some-repo/)                     │
│  ↓                                                           │
│  metabob-analysis-api (concept-db)                          │
│  - Indexes code → CPG graph                                 │
│  - Infers intent from structure                             │
│  - Finds similar implementations                            │
│  ↓                                                           │
│  generate-hypothesis-activities                             │
│  - Uses CPG to create smart hypotheses                      │
│  - "Redis is used" (found redis.incr in graph)             │
│  ↓                                                           │
│  test-hypothesis                                             │
│  - Queries CPG instead of grep                              │
│  - Validates: graph structure matches expectations          │
│  ↓                                                           │
│  interpret-test-results                                      │
│  - Uses CPG to find alternatives                            │
│  - Uses goal history to decide alignment                    │
│  ↓                                                           │
│  execution table (stores everything)                        │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  MiniBob's Own Execution History                            │
│  ↓                                                           │
│  learn-from-executions (meta-learning)                      │
│  - Queries execution table                                  │
│  - Discovers: "Redis hypotheses succeed 93% of time"       │
│  - Generates meta-hypotheses about patterns                 │
│  ↓                                                           │
│  test-meta-hypotheses                                        │
│  - Statistical validation of patterns                       │
│  - "Redis > in-memory" confirmed (p < 0.05)                │
│  ↓                                                           │
│  extract-learned-activities                                  │
│  - Creates new activities from confirmed patterns           │
│  - Adds validators from failure analysis                    │
│  - Updates Thompson Sampling priors                         │
│  ↓                                                           │
│  Thompson Sampling (improved recommendations)               │
└─────────────────────────────────────────────────────────────┘
                      ↓
               Next execution uses
               learned patterns!
```

## Example: Complete Flow

### Week 1: First Encounter with Rate Limiting

**User**: "Add rate limiting to this Express API"

**MiniBob**:
1. Indexes codebase with concept-db
2. Generates hypotheses using CPG:
   - "Express middleware pattern exists" (found in graph)
   - "Redis is available" (not found in graph)
   - "In-memory storage used" (found Map in graph)
3. Tests hypotheses - all confirmed
4. No learned priors yet → Thompson Sampling picks randomly
5. Happens to try Redis approach
6. Execution FAILS - Redis not installed
7. Stores trace: `{ activity: "add-redis", success: false, error: "Redis not found" }`

**Learning**: Nothing yet (need more data)

### Week 2-3: More Executions (15 total)

**10 executions**: Various codebases, different goals
- 7 Redis attempts: 6 succeed, 1 fails (REDIS_URL missing)
- 3 in-memory attempts: 2 succeed, 1 fails (distributed deployment)

**Execution table now has**:
```
Redis: 6/7 success (86%)
In-memory: 2/3 success (67%)
```

Still not enough for confident meta-learning.

### Month 2: Meta-Learning Threshold Reached (25+ executions)

**MiniBob auto-triggers meta-learning**:

```typescript
// Scheduled task (runs weekly):
if (executionCount > 25 && daysSinceLastMetaLearning > 7) {
  await run_goal({
    activity_id: "learn-from-executions",
    variables: {
      learningGoal: "Which patterns lead to success?",
      lookbackDays: 30,
      minSampleSize: 5
    }
  });
}
```

**Discoveries**:
1. **Pattern**: Redis succeeds 93% (14/15), in-memory 70% (7/10)
2. **Failure Mode**: Missing REDIS_URL causes 100% of Redis failures
3. **Goal Correlation**: "distributed" keyword → Redis needed

**Extracts**:
- New activity: `add-rate-limiting-redis-preferred`
  - Includes validator: Check REDIS_URL exists
  - Thompson prior: Beta(14, 1) ≈ 93%
- Updated activity: `add-rate-limiting-memory`
  - Adds warning: "Not suitable for distributed deployments"
  - Thompson prior: Beta(7, 3) ≈ 70%

### Month 2 Day 8: Next Rate Limiting Request

**User**: "Add rate limiting for multi-instance deployment"

**MiniBob with learned patterns**:

1. **Concept-DB analysis**:
   - Indexes codebase
   - Finds: Express, no Redis, no rate limiting

2. **Hypothesis generation** (now smarter):
   - Uses learned patterns: "distributed" keyword detected
   - Generates hypothesis: "Need Redis for distributed rate limiting"
   - High confidence (0.89) from meta-learning

3. **Thompson Sampling** (now informed):
   - Draws from Beta(14, 1) for Redis → ~0.93
   - Draws from Beta(7, 3) for in-memory → ~0.70
   - **Selects Redis** (80% probability)

4. **Pre-execution validators** (learned from failures):
   ```typescript
   // Check 1: REDIS_URL exists
   if (!process.env.REDIS_URL) {
     throw new PreCheckFailure(
       "REDIS_URL not set. " +
       "Learned from 1/15 Redis failures: This always causes failure. " +
       "Please set REDIS_URL or choose in-memory approach."
     );
   }
   ```

5. **Execution**:
   - Validator catches missing REDIS_URL
   - MiniBob suggests: "Set REDIS_URL or use in-memory"
   - User sets REDIS_URL
   - Retry succeeds
   - **Success rate: 100%** (failure prevented by learned validator!)

6. **Meta-learning update**:
   ```
   Redis: 15/16 success (94%) ← improved!
   Validator prevented 1 failure
   ```

### Month 6: Mature Understanding

**Execution stats**:
- Redis: 58/60 success (97%)
- In-memory: 18/25 success (72%)
- Total: 85 executions

**New discoveries** (from continued meta-learning):
- Upstash Redis: 20/20 success (100%) for serverless
- Self-hosted Redis: 38/40 success (95%) for VMs
- In-memory: Only works for single-instance (learned constraint)

**Thompson Sampling now**:
- Redis (Upstash): Beta(20, 0) → ~99% selection for serverless
- Redis (self-hosted): Beta(38, 2) → ~95% selection for VMs
- In-memory: Beta(18, 7) → ~5% selection (only for explicit "local" goals)

### Year 1: Cross-Codebase Patterns

**Concept-DB has indexed**:
- 50 different codebases
- 200+ rate limiting implementations
- Embeddings for similarity search

**Meta-learning discovers**:
- Pattern clusters in CPG:
  - Cluster 1: Express + Redis (most reliable)
  - Cluster 2: FastAPI + Redis (also reliable)
  - Cluster 3: Express + in-memory (only for dev)

**MiniBob now**:
1. Indexes new codebase
2. Finds it's Express (via CPG)
3. Queries concept-db: "Similar Express projects"
4. Gets 30 examples, 90% use Redis
5. Meta-learning confirms Redis → 97% success
6. **Auto-recommends Redis with 97% confidence**

## Integration Points

### Concept-DB → Hypothesis Generation

```typescript
// In generate-hypothesis-activities.json:

// OLD (text-based):
"Check if 'redis' appears in files"

// NEW (CPG-based):
const cpgAnalysis = await conceptDb.analyzeCodebase(files);
const intent = cpgAnalysis.inferIntent("rate limiting");

if (intent.evidence.includes("redis.incr")) {
  generateHypothesis({
    name: "Redis used for distributed state",
    confidence: intent.confidence,
    evidence: intent.evidence
  });
}
```

### Concept-DB → Similar Implementations

```typescript
// In interpret-test-results.json:

// When hypothesis fails:
const similar = await conceptDb.findSimilarImplementations({
  intent: "rate_limiting",
  approach: "current implementation"
});

// Returns:
[
  {
    approach: "Redis INCR/EXPIRE",
    success_rate: 0.97,  // From meta-learning!
    found_in: ["project-a", "project-b"],
    cpg_pattern: { /* graph structure */ }
  },
  {
    approach: "In-memory Map",
    success_rate: 0.72,  // From meta-learning!
    limitations: ["single-instance only"]
  }
]
```

### Meta-Learning → Concept-DB Annotations

```typescript
// After meta-learning:

// Annotate CPG nodes with learned patterns
await conceptDb.annotate({
  component_id: "rateLimitMiddleware",
  learned_patterns: {
    success_rate: 0.97,
    sample_size: 58,
    optimal_approach: "Redis INCR/EXPIRE",
    failure_modes: ["missing REDIS_URL"],
    validated_at: "2026-03-29"
  }
});

// Future similar components inherit this knowledge
```

## The Self-Improving Loop

```
┌─────────────────────────────────────────────────────────────┐
│  User requests feature → MiniBob executes → Stores trace    │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Concept-DB indexes:                                        │
│  - Code structure (CPG)                                     │
│  - Intent inference                                         │
│  - Similar implementations                                  │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Meta-learning queries:                                      │
│  - Execution traces (what worked?)                          │
│  - Goal patterns (what did users want?)                     │
│  - Failure modes (what broke?)                              │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Knowledge synthesis:                                        │
│  - CPG shows WHAT code does                                 │
│  - Executions show WHICH approaches succeed                 │
│  - Goals show WHEN to use each approach                     │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Improved recommendations:                                   │
│  - Thompson Sampling with learned priors                    │
│  - Validators from failure analysis                         │
│  - Goal-aware pattern selection                             │
└───────────────┬─────────────────────────────────────────────┘
                │
                └──────────► Next execution is smarter
```

## What MiniBob Learns

### About Code (from concept-db):
- ✅ Code structure (CPG graph)
- ✅ Intent (what it's trying to do)
- ✅ Patterns (design patterns detected)
- ✅ Similar implementations (embedding search)
- ✅ Data flow (how values move through code)

### About Execution (from meta-learning):
- ✅ What works (success patterns)
- ✅ What breaks (failure modes)
- ✅ When to use what (goal correlations)
- ✅ How to validate (pre-checks)
- ✅ Statistical confidence (sample sizes)

### About Itself (from both):
- ✅ Which hypotheses are reliable
- ✅ Which activities succeed most often
- ✅ Which validators prevent failures
- ✅ Which patterns generalize across codebases
- ✅ How to improve over time

## Benefits

### For Users:
- **Week 1**: MiniBob tries things randomly, learns from failures
- **Month 1**: MiniBob recommends based on 80% confidence
- **Month 6**: MiniBob recommends based on 95% confidence
- **Year 1**: MiniBob rarely makes mistakes (97%+ success)

### For MiniBob:
- **Continuous learning**: Every execution improves understanding
- **Cross-codebase knowledge**: Patterns learned in one project help others
- **Failure prevention**: Validators added automatically from failures
- **Statistical rigor**: Confidence scores based on real data

### For the System:
- **No manual rules**: Everything learned from data
- **Self-documenting**: "Learned from 58 executions" tells you why
- **Adaptive**: Patterns evolve as technology changes
- **Composable**: New patterns combine with existing ones

## Implementation Priority

### Phase 1: ✅ Basic Hypothesis Testing (Complete)
- [x] Three seed activities (generate, test, interpret)
- [x] Demo repository
- [x] Documentation

### Phase 2: ✅ Meta-Learning (Complete)
- [x] Fourth seed activity (learn-from-executions)
- [x] Statistical hypothesis testing
- [x] Pattern extraction
- [x] Thompson Sampling integration

### Phase 3: 🚧 Concept-DB Integration (Next)
- [ ] CPG-based hypothesis generation
- [ ] Graph queries instead of text patterns
- [ ] Intent inference from structure
- [ ] Similar implementation discovery

### Phase 4: 🔮 Cross-Codebase Learning (Future)
- [ ] Share patterns across projects
- [ ] Collaborative filtering
- [ ] Pattern marketplace
- [ ] Transfer learning

## Summary

**Your insight was perfect**: This isn't just for understanding new codebases - it's for **MiniBob understanding itself**.

The combination of:
- **Concept-DB** (understanding code structure)
- **Hypothesis Testing** (validating understanding)
- **Meta-Learning** (learning from executions)

Creates a system that:
1. Understands codebases intelligently (CPG, not grep)
2. Tests understanding rigorously (validators, traces)
3. Learns what works (meta-hypotheses, statistics)
4. Improves continuously (Thompson Sampling, pattern extraction)
5. Gets smarter over time (self-improving loop)

**No human intervention needed** - just execution data and the ability to query it with hypotheses!
