# Hypothesis-Driven Understanding Implementation Summary

## Completed: 2026-03-29

This document summarizes the implementation of hypothesis-driven codebase understanding for MiniBob.

---

## Core Concept

**Activities ARE hypotheses.** When MiniBob explores a codebase, it creates testable hypotheses as activities with validators, executes them to observe reality, and decides whether to align code or expectations based on goal context.

```
Traditional Approach:          Hypothesis-Driven Approach:
───────────────────            ────────────────────────────
1. Read documentation          1. Generate hypothesis activities
2. Try to understand code      2. Execute (test hypotheses)
3. Write implementation        3. Validators check expectations vs observations
4. Hope it works               4. Align code OR validators based on goal
5. Debug when it fails         5. Re-test to verify alignment
```

---

## What Was Implemented

### 1. Three Seed Activities (metabob-proto/activities/hypothesis/)

#### `generate-hypothesis-activities.json`
- **Purpose**: Create testable hypothesis activities from a learning goal
- **Input**: Goal description, entry point files
- **Output**: 3-5 hypothesis activities with validators
- **Example**: Given goal "How does rate limiting work?", generates hypotheses like:
  - "Express middleware pattern exists"
  - "Redis is used for state storage"
  - "Rate limiter middleware is applied"

#### `test-hypothesis.json`
- **Purpose**: Execute a hypothesis activity and capture observations
- **Input**: Hypothesis activity ID
- **Output**: Execution trace with validator results (CONFIRMED/REFUTED/PARTIAL)
- **Captures**: Which patterns found, which missing, file states, validator pass/fail

#### `interpret-test-results.json`
- **Purpose**: Analyze test results and decide alignment strategy
- **Input**: Test trace, current goal
- **Output**: Alignment decision + activity to execute it
- **Decisions**:
  - **ALIGN_CODE**: Fix code to match validators (goal requires it)
  - **ALIGN_VALIDATOR**: Update validators to match code (code is correct)
  - **ACCEPT_DIFFERENCE**: Both approaches valid (document tradeoffs)

### 2. Architecture Design Updates

- Updated `docs/architecture/HYPOTHESIS_DRIVEN_UNDERSTANDING.md` to use new paradigm tables
- Documents how activities/executions/impulses/vessels support hypothesis testing
- No new storage needed - uses existing infrastructure

### 3. Demo Repository (scratch/hypothesis-demo-repo/)

- Simple Express API with in-memory rate limiting
- Demonstrates complete workflow:
  1. Generate hypotheses about rate limiting
  2. Test hypothesis: "Redis is used" (REFUTED - uses Map)
  3. Interpret with goal: "Add distributed rate limiting"
  4. Decision: ALIGN_CODE (add Redis)
  5. Execute alignment (refactor to use Redis)
  6. Re-test hypothesis (now CONFIRMED)

### 4. Documentation

- `repos/metabob-proto/activities/hypothesis/README.md`: Complete usage guide
- `scratch/hypothesis-demo-repo/DEMO_WORKFLOW.md`: Step-by-step demonstration
- Example outputs showing what each activity produces

---

## Key Design Decisions

### 1. **Use New Paradigm Tables**

All data stored in 4 core tables (020-paradigm-core-tables.surql):

```typescript
// impulse table: All data with shapes
{
  shape: "goal" | "source_code" | "trace" | "recommendation",
  pointer: { type, ...details },
  content: null // lazy-loaded
}

// activity table: All state transitions
{
  id: "hypothesis_redis_storage",
  execution_type: "template",
  input_shapes: ["source_code"],
  output_shapes: ["trace"],
  tasks: [{ validation: {...} }]
}

// execution table: All traces
{
  activity_id: "hypothesis_redis_storage",
  input_impulses: [...],
  output_impulses: [...],
  validator_results: [
    { type: "required_patterns", passed: false, expected: "redis", actual: "Map<" }
  ]
}

// vessel table: Execution environments
{
  id: "minibob-instance-001",
  resolves: ["file", "memo"]
}
```

### 2. **MiniBob IS the Vessel**

No code changes needed in MiniBob - it already executes activities. The hypothesis capability IS the three seed activities. MiniBob:
- Executes meta-activities to generate hypotheses
- Executes hypothesis activities to test understanding
- Executes alignment activities to fix code or validators
- Stores everything in existing tables

### 3. **Validators ARE Expectations**

Activities with validators represent testable hypotheses:
```json
{
  "validation": {
    "required_patterns": ["redis"],     // Expectation
    "forbidden_patterns": ["Map<"]      // Counter-expectation
  }
}
```

Execution trace captures what was actually observed:
```json
{
  "validator_results": [
    {
      "type": "required_patterns",
      "passed": false,
      "expected": "redis",
      "actual": "Map<string, any>"      // Observation
    }
  ]
}
```

### 4. **Goal Context Drives Decisions**

Alignment decisions query goal history from impulse table:

```typescript
// Goal: "Add rate limiting" (generic)
// → Decision: ALIGN_VALIDATOR (in-memory is fine)

// Goal: "Add distributed rate limiting" (specific requirement)
// → Decision: ALIGN_CODE (must add Redis)
```

---

## Integration with Existing System

### Thompson Sampling
- Tracks success rates of hypothesis activities
- Learns which hypothesis patterns are reliable
- Recommends high-confidence hypotheses first

### Ribosome Pattern
- Successful hypothesis activities can be extracted
- Becomes templates for similar codebases
- E.g., "Express rate limiting investigation" template

### Trailblazing
- Failed hypotheses create variants
- Alternative hypothesis patterns explored
- Adapts to different codebases

### Learning Loop
```
Generate hypotheses → Test → Interpret → Align → Re-test → Extract patterns
         ↑                                                          ↓
         └──────────────────── Use learned patterns ───────────────┘
```

---

## Usage Example

```bash
# 1. Clone any repo to scratch/
git clone https://github.com/example/repo scratch/test-repo

# 2. Generate hypotheses
minibob exec generate-hypothesis-activities \
  --var learningGoal="How does authentication work?" \
  --var entryPoints="package.json,src/index.ts" \
  --var sessionId="session-$(date +%s)"

# Output: 3-5 hypothesis activities created

# 3. Test each hypothesis
minibob exec test-hypothesis \
  --var hypothesisActivityId="hypothesis_jwt_auth" \
  --var hypothesisDescription="Uses JWT for authentication" \
  --var testId="test-001"

# Output: ✅ CONFIRMED or ❌ REFUTED with detailed trace

# 4. If refuted, interpret
minibob exec interpret-test-results \
  --var testId="test-001" \
  --var currentGoal="Add SSO authentication"

# Output: Alignment decision + activity to execute

# 5. Execute alignment (if needed)
minibob exec align_code_add_oauth

# 6. Re-test to verify
minibob exec test-hypothesis --var hypothesisActivityId="hypothesis_jwt_auth" ...
```

---

## Files Created

```
repos/metabob-proto/activities/hypothesis/
├── generate-hypothesis-activities.json  # Meta-activity: Create hypotheses
├── test-hypothesis.json                 # Meta-activity: Execute & observe
├── interpret-test-results.json          # Meta-activity: Decide alignment
└── README.md                            # Usage guide

docs/architecture/
└── HYPOTHESIS_DRIVEN_UNDERSTANDING.md   # Updated design doc

scratch/hypothesis-demo-repo/
├── package.json                         # Demo Express app
├── src/index.ts                         # In-memory rate limiting
├── README.md                            # What's in the demo
└── DEMO_WORKFLOW.md                     # Step-by-step walkthrough

HYPOTHESIS_TESTING_IMPLEMENTATION_SUMMARY.md  # This file
```

---

## Testing the Implementation

### 1. Load Seed Activities

```bash
cd repos/metabob-proto
# Activities are in activities/hypothesis/
# Need to be loaded into metabob-activity-api's activity table
```

### 2. Run Demo

```bash
cd scratch/hypothesis-demo-repo
bun install

# Follow DEMO_WORKFLOW.md step by step
# Use MiniBob to execute the three meta-activities
```

### 3. Verify Outputs

Check that these directories get created:
- `/tmp/hypothesis-{sessionId}/` - Codebase analysis and generated activities
- `/tmp/hypothesis-test-{testId}/` - Test observations and traces
- Alignment decisions and generated activities

---

## Success Metrics

Track in execution table:

```sql
-- Hypothesis accuracy over time
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_tests,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as confirmed,
  AVG(duration_ms) as avg_duration,
  AVG(cost_usd) as avg_cost
FROM execution
WHERE activity_id LIKE 'hypothesis_%'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Alignment decision distribution
SELECT
  JSON_EXTRACT(output_impulses[0].content, '$.decision') as decision,
  COUNT(*) as count
FROM execution
WHERE activity_id = 'interpret-test-results'
GROUP BY decision;
```

**Target Metrics**:
- Hypothesis accuracy: >60% confirmed on first test (improves with learning)
- Alignment quality: >80% of aligned code passes re-test
- Cost: <$0.05 per hypothesis test
- Duration: <2s per hypothesis test

---

## Next Steps

### Phase 1: Validation (Current)
- [x] Create seed activities
- [x] Create demo repository
- [x] Document workflow
- [ ] Test with MiniBob locally
- [ ] Verify all outputs are created correctly

### Phase 2: Integration
- [ ] Load activities into metabob-activity-api
- [ ] Verify dual-write to new paradigm tables
- [ ] Test Thompson Sampling integration
- [ ] Create dashboard view for hypothesis tests

### Phase 3: Enhancement
- [ ] Add LLM-based intent extraction (use Haiku for cost efficiency)
- [ ] Graph-based hypotheses using CPG traversal
- [ ] Probabilistic validators (confidence scores instead of pass/fail)
- [ ] Meta-learning: learn which hypothesis patterns work best

### Phase 4: Scale
- [ ] Test on large codebases (>10k files)
- [ ] Optimize performance (parallel hypothesis testing)
- [ ] Add caching for repeated patterns
- [ ] Share anonymized hypothesis patterns across orgs

---

## Alignment with Foundation

This implementation follows all principles from `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`:

✅ **Impulses Are Universal Data**
- Goals, traces, recommendations all stored as impulses with shapes

✅ **Activities Constrain Search**
- Hypotheses constrain infinite possibilities to ranked testable options

✅ **Resolvers Live Where Data Lives**
- MiniBob resolves file/memo types locally
- Backend resolves trace/activity types via MCP

✅ **Metadata First, Content Later**
- Impulse metadata (shape, summary) used for matching
- Content lazy-loaded only when needed

✅ **Record Everything**
- All hypothesis tests stored in execution table
- Validator results captured for learning

✅ **Learn From Traces**
- Thompson Sampling learns hypothesis reliability
- Ribosome extracts successful patterns

✅ **Reserve Improvisation**
- New hypothesis patterns tried when existing don't match
- Trailblazing creates variants

✅ **LLMs Are Tools, Not Controllers**
- LLM generates hypotheses and interprets results
- Validators and traces are deterministic checks

---

## Conclusion

The hypothesis-driven understanding system is now ready for testing. It enables MiniBob to:

1. **Quickly understand** any codebase by generating and testing hypotheses
2. **Instrument** code by running hypothesis activities that capture traces
3. **Differentially align** based on goals - fix code OR update expectations
4. **Learn patterns** through Thompson Sampling and ribosome extraction

All using existing activity infrastructure with no new storage.

**Next**: Test the demo workflow and iterate based on results.
