# Goal Resolution Quality Analysis

**Date:** 2026-03-28
**Assessment Script:** `assess-goal-resolution.ts`
**Full Results:** `goal-resolution-assessment-results.txt`

## Executive Summary

The activity-api's goal resolution and template selection mechanism is **performing poorly** with a **26.7% match rate**. Template selection appears largely random due to:

1. **Weak Thompson Sampling priors** (α=1, β=1 for most activities)
2. **No semantic matching** before probabilistic selection
3. **Missing activity categories** (no templates for several goal types)
4. **High inconsistency** (same goal returns different results)
5. **No input schema filtering** or requirement matching

## Quantitative Results

### Overall Performance
- **Total test cases:** 15
- **Matched expectations:** 4 (26.7%)
- **Failed to match:** 11 (73.3%)
- **API errors:** 0

### Performance by Category

| Category | Match Rate | Status |
|----------|------------|--------|
| feature | 100% (2/2) | ✅ Good |
| test-creation | 50% (1/2) | ⚠️ Weak |
| bugfix | 50% (1/2) | ⚠️ Weak |
| refactor | 0% (0/1) | ❌ **No recommendations** |
| meta-learning | 0% (0/3) | ❌ **No recommendations** |
| exploration | 0% (0/2) | ❌ **No recommendations** |
| instrumentation | 0% (0/1) | ❌ **No recommendations** |
| activity-improvement | 0% (0/2) | ❌ **No recommendations** |

## Critical Issues

### 1. Thompson Sampling Dominance with Weak Priors

**Observation:**
- All recommendations use `selection_metadata.method: "thompson_sampling"`
- Most activities have uninformed priors: α=1, β=1
- Selection is essentially **random sampling** from a uniform distribution

**Examples:**
```
Test Creation Goal: "Create unit tests for src/impulse.ts"
🥇 bootstrap:vessel-extend (score: 0.9988, α/β: 1/1)  ← Infrastructure, not test-related
🥈 shape_test_goal (score: 0.9900, α/β: 1/1)          ← Generic shape test
🥉 resolve-goal-orchestrator-v1 (score: 0.9865, α/β: 5/1)  ← Meta, not test-related
```

**Impact:**
- High variance in recommendations
- No correlation with goal semantics
- Inconsistent results on repeated requests

### 2. Missing Semantic Filtering

**Observation:**
- No evidence of goal text analysis before sampling
- Activities selected regardless of relevance to goal description
- Input schema matching not working (no `input_shapes` shown for matches)

**Expected behavior (from architecture):**
According to `resolve-goal-orchestrator-v1` activity:
1. **Deterministic matching** for clear goals (keyword + schema)
2. **Semantic analysis** using LLM when deterministic fails
3. **Exploration** (UCB1) when priors are weak
4. Thompson Sampling only after filtering candidates

**Current behavior:**
- Thompson Sampling applied to ALL 50 templates
- No filtering by category, tags, or input requirements
- Random selection from uninformed priors

### 3. Category Coverage Gaps

**Missing or broken categories:**
- `refactor` - Returned no recommendations despite having template: `refactor-task-steps`
- `meta-learning` - No recommendations despite 7 meta activities existing
- `exploration` - No recommendations despite `explore-codebase-v1` existing
- `instrumentation` - No recommendations despite `instrument-code-runtime` existing

**Possible causes:**
- Category filtering too strict
- Templates not tagged correctly
- API routing issue for non-standard categories

### 4. Selection Inconsistency

**Repeated request test:**
Same goal sent twice, different top recommendations:

| Test Case | First Top | Second Top | Consistent? |
|-----------|-----------|------------|-------------|
| Create unit tests | bootstrap:vessel-extend | tpl_1774659781975_21v6r | ❌ No |
| Fix JWT error | fix-typescript-errors-v1 | ts-proven-001 | ❌ No |
| Debug impulse error | fix-typescript-errors-v1 | tpl_1774564775369_c80eg | ❌ No |
| Pagination endpoint | shape_test_trace_1774562882280 | tpl_1774527135212_ennsic | ❌ No |
| WebSocket support | tpl_1774565172639_tt71gr | shape_test_file_1774562882280 | ❌ No |
| Write executor tests | Create TypeScript Unit Tests | (same) | ✅ Yes |

**5 out of 6 tests showed inconsistency** - This is unacceptable for a production system.

### 5. Score Source: "Legacy"

**Observation:**
All recommendations show `score_source: "legacy"`, suggesting:
- New scoring mechanisms not implemented yet?
- Fallback to old Thompson Sampling without improvements?
- Input schema matching not operational?

## Root Cause Analysis

Based on the evidence, the recommendation pipeline appears to be:

```
User Goal
    ↓
    ├─ NO semantic analysis
    ├─ NO input schema filtering
    ├─ NO category pre-filtering
    ↓
Thompson Sample from ALL 50 templates
    ↓
Random selection (because α=1, β=1 for most)
    ↓
Return top 5
```

**Expected pipeline (from IMPULSE_ACTIVITY_FOUNDATION.md):**

```
User Goal
    ↓
Parse intent + extract requirements
    ↓
Filter by category/tags/input_schema
    ↓
Deterministic match (keyword + schema)
    ├─ Match found → Return with confidence
    ├─ No match → Semantic analysis (LLM)
    │   ├─ Match found → Return ranked results
    │   └─ No match → Exploration (UCB1)
    └─ Low confidence → Thompson Sampling on FILTERED candidates
```

**The filtering and semantic layers are not functioning.**

## Specific Examples of Poor Matching

### Example 1: Test Creation
**Goal:** "Create comprehensive unit tests for src/impulse.ts"

**Expected:** `vessel-add-tests` (exists in templates)

**Actual Top 3:**
1. `bootstrap:vessel-extend` (infrastructure) ❌
2. `shape_test_goal` (generic feature) ❌
3. `resolve-goal-orchestrator-v1` (meta) ❌

**Analysis:** None of the top 3 are test-creation activities, despite:
- Multiple test-related templates existing (`vessel-add-tests`, `Create TypeScript Unit Tests`)
- Goal explicitly mentioning "tests"
- Category being clearly "test-creation"

### Example 2: Debugging
**Goal:** "Debug why the activity execution is failing with 'impulse not found' error"

**Expected:** `discover-missing-impulses` or `analyze-failure` (both exist)

**Actual Top 3:**
1. `fix-typescript-errors-v1` (TypeScript bugfix) ❌
2. `test-legacy-001` (testing) ❌
3. `ts-new-001` (TypeScript) ❌

**Analysis:** All recommendations are TypeScript-related, ignoring:
- "impulse not found" in goal text
- `discover-missing-impulses` activity designed exactly for this
- Semantic meaning of "debug execution failure"

### Example 3: Meta-Learning
**Goal:** "Extract a reusable activity template from the last successful test creation execution"

**Expected:** `extract-template-from-trace` or `create-activity-from-trace` (both exist)

**Actual:** No recommendations returned

**Analysis:** Complete failure despite having exactly the right templates. Suggests category filtering is broken.

## Recommendations

### Immediate Fixes (High Priority)

1. **Enable Category Pre-Filtering**
   - Filter templates by category before Thompson Sampling
   - Use `category` parameter in request if provided
   - Fall back to category inference from goal text

2. **Implement Semantic Keyword Matching**
   - Extract keywords from goal description
   - Match against activity names, descriptions, and tags
   - Only Thompson Sample from semantic matches (top 10-20)

3. **Fix Missing Category Issue**
   - Investigate why refactor/meta/exploration categories return no results
   - Check template tags and category assignments
   - Verify API routing for all categories

4. **Bootstrap Thompson Priors**
   - Instead of α=1, β=1, use α=2, β=1 (optimistic prior)
   - Or use execution history to populate priors
   - Reduces random variance in selection

5. **Add Input Schema Filtering**
   - Match `impulse_shapes` in request against template `input_schema`
   - Only recommend templates that can work with available impulses
   - Return schema mismatch warnings

### Medium-Term Improvements

6. **Implement Orchestrator Pattern**
   - Use `resolve-goal-orchestrator-v1` activity for complex goals
   - Route to deterministic/semantic/exploration strategies
   - Thompson Sampling as final tie-breaker, not primary method

7. **Add Semantic Similarity (Embeddings)**
   - Compute embeddings for goal descriptions
   - Match against template embeddings
   - Pre-filter to top-k most similar before sampling

8. **Execution History Integration**
   - Use actual success/failure data to update α and β
   - Prioritize proven templates for similar goals
   - Trailblaze only when confidence is low

9. **Add Explanation/Confidence Scores**
   - Return why each activity was recommended
   - Show input match quality (0-1 score)
   - Expose Thompson confidence intervals

### Long-Term Architectural Changes

10. **Goal Parsing Service**
    - Extract requirements, constraints, and context from goal text
    - Structure as impulse shapes and categories
    - Feed structured data to recommendation engine

11. **Multi-Stage Ranking**
    - Stage 1: Category + tag filtering (broad)
    - Stage 2: Semantic similarity (narrow to top 20)
    - Stage 3: Input schema validation (feasibility)
    - Stage 4: Thompson Sampling (selection)

12. **Learning from Traces**
    - Analyze which templates actually solve which goal patterns
    - Auto-tag templates with successful goal types
    - Build goal → template mapping database

## Testing Strategy

### Regression Tests
Create a test suite with:
- 50+ diverse goals covering all categories
- Expected activity matches for each
- Minimum match threshold: 70%
- Maximum inconsistency: 10%

### Monitoring Metrics
Track in production:
- Match rate by category
- Selection inconsistency rate
- Thompson prior distributions (α, β)
- Score source distribution (legacy vs. new)
- User override rate (when user manually selects different activity)

### Validation Criteria
Before declaring goal resolution "working":
- [ ] 70%+ match rate on test suite
- [ ] <10% inconsistency on repeated requests
- [ ] All categories return recommendations
- [ ] Semantic matching working (proven by ablation test)
- [ ] Thompson priors informed by execution data

## Next Steps

1. **Run assessment regularly** - Use `assess-goal-resolution.ts` weekly
2. **Investigate category filtering** - Debug why meta/exploration return no results
3. **Add keyword matching** - Quick win for improving relevance
4. **Bootstrap priors** - Use optimistic defaults (α=2, β=1)
5. **Instrument recommendation pipeline** - Add logging to see where filtering happens

## Conclusion

The current goal resolution system is **not production-ready** for autonomous operation. MiniBob is effectively selecting activities at random due to:
- Uninformed Thompson Sampling priors
- No semantic analysis or filtering
- Missing category coverage
- High inconsistency

**Immediate action required:** Implement semantic keyword matching and category pre-filtering before Thompson Sampling. This will improve match rate from 26.7% to likely 60-70% as a quick win.

**Medium-term:** Build the full orchestrator pattern described in IMPULSE_ACTIVITY_FOUNDATION.md with deterministic → semantic → exploration fallback chain.
