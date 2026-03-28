# Activity Recommendation System Improvements

**Date:** 2026-03-28
**Status:** ✅ Implemented
**Assessment Before:** 26.7% match rate (4/15 test cases)
**Expected After:** 70-80% match rate (to be verified)

## Overview

We've implemented three major improvements to the activity-api's recommendation system to address the poor goal resolution quality (26.7% match rate) identified in the assessment.

## Improvements Implemented

### 1. Semantic Tag-Based Pre-Filtering ✅

**Problem:** Thompson Sampling was applied to ALL 50 templates without considering goal semantics. Selection was essentially random due to uninformed priors (α=1, β=1).

**Solution:** Semantic keyword extraction and tag-based filtering

**Implementation:**
- Created `src/utils/semantic-tags.ts` with keyword → tag mappings
- Extract tag prefixes from natural language goal descriptions
- Pre-filter candidates by tag relevance before Thompson Sampling
- Calculate tag match quality scores (0.0 to 1.0)

**Example:**
```typescript
Goal: "Create unit tests for src/impulse.ts"
→ Extracts: ['utility.code.test', 'utility']
→ Filters to: test-related templates only
→ Boosts: templates with matching tags get +6 alpha
```

**Keyword Mappings (50+ keywords):**
- Testing: `test`, `tests`, `unit test` → `utility.code.test`
- Debugging: `debug`, `analyze`, `failure` → `meta.debug`
- Features: `implement`, `add`, `create` → `feature`
- Refactoring: `refactor`, `simplify`, `optimize` → `meta.refactor`
- Meta-learning: `extract`, `pattern`, `learn` → `meta.learning`
- Exploration: `explore`, `understand`, `codebase` → `utility.exploration`
- (See `semantic-tags.ts` for complete list)

**API Changes:**
- `POST /recommend` now automatically extracts tags if not provided
- Request parameters `tags` and `tag_prefix` are now optional (inferred from `task_description`)
- Response includes `tag_match_quality` in `selection_metadata`

**Benefits:**
- Relevant templates ranked higher before sampling
- Random selection eliminated for goals with clear intent
- Backward compatible (explicit tags/tag_prefix still work)

---

### 2. Impulse Relevancy Integration ✅

**Problem:** Impulse relevancy data was tracked but not used in recommendations. Activities were selected without considering which impulses were loaded.

**Solution:** Bayesian relevancy boosting and missing impulse discovery

**Implementation:**
- Created `src/utils/impulse-relevancy.ts` with boost calculation
- Query `impulse_relevance_metric` table for (activity, impulse) pairs
- Boost alpha for activities with high relevance_score for loaded impulses
- Penalize beta for activities requiring missing critical impulses
- Discover which missing impulses would unlock better activities

**Relevancy Classification:**
```
relevance_score - irrelevance_score > 0.3   → CRITICAL (boost alpha)
                                    < -0.3  → HARMFUL (penalize beta)
                                    between → NEUTRAL (ignore)
```

**Boost Calculations:**
```typescript
// Critical impulse loaded → boost alpha
alphaBoost = ceil(relevanceDiff * 10)  // 0.3+ → +3 to +10

// Critical impulse missing → penalize beta
betaPenalty = ceil(relevanceDiff * 5)  // 0.3+ → +1.5 to +5

// Harmful impulse loaded → penalize beta
betaPenalty = ceil(abs(relevanceDiff) * 5)
```

**API Changes:**
- `POST /recommend` now queries impulse relevancy automatically
- Response includes `impulse_analysis` in `selection_metadata`:
  - `alpha_boost`: How much alpha was increased
  - `beta_penalty`: How much beta was increased
  - `relevant_impulses`: Which loaded impulses helped
  - `missing_critical_impulses`: Which missing impulses hurt
  - `details`: Breakdown by boost source
- Response includes `missing_impulses` array (top 5 suggestions):
  - `impulse_id`: ID of missing impulse
  - `reason`: Why it's valuable
  - `unlocks_activities`: How many activities it enables
  - `avg_relevance_boost`: Average relevance improvement

**Benefits:**
- Recommendations consider available context
- Activities requiring unavailable impulses ranked lower
- System suggests which impulses to load for better results
- Learning from past execution patterns

---

### 3. Heuristic Thompson Prior Boosting ✅

**Problem:** Uninformed priors (α=1, β=1) created uniform random sampling. No domain knowledge encoded.

**Solution:** Reasoning-based heuristic boosts to alpha

**Implementation:**
Replaced `alpha = 1.0` with informed priors based on 6 heuristics:

```typescript
1. Tag Match Quality: +0 to +6
   - tagMatchQuality * 6 (6 levels of tag hierarchy)
   - feature.vessel.test matches "test" goal → +6

2. Shape Compatibility: +3
   - input_shapes ⊆ available impulse_shapes
   - Activity can run with loaded impulses

3. Recency: +1
   - Created in last 30 days
   - Newer templates likely better (iteration)

4. Execution History: +0 to +5
   - floor(executionCount / 10)
   - Proven stability bonus

5. Scope Preference: +1
   - org-specific or project-specific templates
   - Better fit than global

6. Impulse Relevancy: +0 to +10 (from improvement #2)
   - Based on loaded_impulses relevance scores
```

**Example Boosted Prior:**
```
Template: vessel-add-tests
Goal: "Create unit tests for src/impulse.ts"

Base: α=1, β=1

Boosts:
  Tag match (utility.code.test): +6
  Shape compatible (has source_code): +3
  Recency (new template): +1
  Execution history (20 past runs): +2
  Scope (org-specific): +1
  Impulse relevancy (source_code loaded): +4

Final: α=18, β=1
→ Mean = 18/19 = 94.7% (vs 50% with α=1, β=1)
→ High confidence recommendation
```

**API Changes:**
- Response `selection_metadata` includes:
  - `heuristic_boost`: Total alpha boost applied
  - `boost_breakdown`: Contribution from each heuristic
  - `original_beta`: Beta before penalties
  - Shows transparent reasoning

**Benefits:**
- Encodes domain knowledge as informative priors
- Reduces random variance in selection
- Enables consistent recommendations for same goal
- Still allows exploration via Thompson Sampling randomness

---

### 4. Missing Activity Templates ✅

**Problem:** Several goal categories returned NO recommendations due to missing templates (refactor, meta-learning, exploration, instrumentation).

**Solution:** Created 5 new high-value activity templates

**Templates Added:**
1. **meta.debug.analyze-execution-failure**
   - Analyzes failed traces for root cause
   - Tags: `meta.debug`, `meta`, `utility.analysis`
   - Input: `activityExecutionTrace`, `error`
   - Output: `analysis_report`, `missing_impulses_list`

2. **meta.debug.discover-missing-impulses-v2**
   - Compares failed vs successful executions
   - Tags: `meta.debug`, `meta.learning`, `meta`
   - Input: `activityExecutionTrace`, `activity_id`
   - Output: `missing_impulses_list`, `analysis_report`

3. **meta.learning.extract-activity-template**
   - Ribosome pattern: extract template from trace
   - Tags: `meta.learning`, `meta.develop`, `meta`
   - Input: `activityExecutionTrace`, `goal_text`
   - Output: `activityTemplate`

4. **utility.exploration.analyze-codebase-structure**
   - Explore codebase structure and dependencies
   - Tags: `utility.exploration`, `utility`, `utility.code.analysis`
   - Input: `directory_path`, `focus_areas`
   - Output: `codebase_structure`, `entry_points`, `dependency_graph`

5. **meta.refactor.simplify-code**
   - Refactor for readability and performance
   - Tags: `meta.refactor`, `meta`, `utility.code.quality`
   - Input: `source_code`, `file_path`, `test_suite`
   - Output: `source_code`, `refactoring_report`

**Seeding Script:**
- `scripts/seed-missing-activity-templates.ts`
- Run with: `bun run scripts/seed-missing-activity-templates.ts`
- Seeds to `metabob_internal` organization
- Idempotent (safe to run multiple times)

**Benefits:**
- Coverage for previously unhandled goal types
- Enables meta-learning and self-development loops
- Reduces "no recommendations" failures

---

## System Architecture Changes

### Files Modified

1. **`src/utils/semantic-tags.ts`** (NEW)
   - Keyword → tag mapping dictionary
   - `extractTagPrefixes(taskDescription)` - NLP extraction
   - `calculateTagMatchQuality(tags, templateTags)` - scoring
   - `extractImpliedShapes(taskDescription)` - shape inference
   - `analyzeTaskSemantics(taskDescription)` - comprehensive analysis

2. **`src/utils/impulse-relevancy.ts`** (NEW)
   - `calculateImpulseRelevancyBoosts(activityIds, loadedImpulses)` - boost calculation
   - `discoverMissingImpulses(activityIds, loadedImpulses)` - suggestion engine
   - Bayesian relevancy scoring logic

3. **`src/routes/activities.ts`** (MODIFIED)
   - Integrated semantic analysis at line ~1986
   - Added impulse relevancy queries at line ~2156
   - Enhanced Thompson Sampling with 6 heuristics at line ~2159-2200
   - Extended `selection_metadata` response with:
     - `tag_match_quality`
     - `heuristic_boost`
     - `boost_breakdown`
     - `impulse_analysis`
   - Added `missing_impulses` to response

4. **`scripts/seed-missing-activity-templates.ts`** (NEW)
   - Seeds 5 new activity templates
   - Run to populate database

### Data Flow

**Before:**
```
User Goal
  ↓
Query all templates (no filtering)
  ↓
Thompson Sample from ALL 50 with α=1, β=1 (random)
  ↓
Return top 5 (essentially random)
```

**After:**
```
User Goal
  ↓
Semantic Analysis (extract tags + shapes)
  ↓
Filter by tags (20-30 candidates)
  ↓
Filter by input_schema (10-15 feasible)
  ↓
Query impulse relevancy metrics
  ↓
Calculate heuristic boosts (6 factors)
  ↓
Thompson Sample with informed priors
  ↓
Return top 5 with explainability
  ↓
Suggest missing impulses (optional)
```

---

## Testing and Validation

### Re-run Assessment

```bash
bun run assess-goal-resolution.ts
```

**Expected improvements:**
- Match rate: 26.7% → 70-80%
- Consistency: 5/6 inconsistent → <10% inconsistent
- Coverage: 0% for 5 categories → >50% for all

### Manual Testing

```bash
curl -X POST http://activity.metabob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -H "x-org-id: metabob_internal" \
  -d '{
    "task_description": "Create unit tests for src/impulse.ts",
    "loaded_impulses": ["impulse:source-code-impulse-ts"],
    "limit": 3
  }' | jq
```

**Check for:**
- ✅ Top recommendation is test-related (e.g., `vessel-add-tests`)
- ✅ `tag_match_quality` > 0.5
- ✅ `heuristic_boost` > 5
- ✅ `impulse_analysis.relevant_impulses` includes loaded impulse
- ✅ `missing_impulses` suggests relevant additions

### Monitoring Metrics

Track in production:
1. **Match Rate**: % of recommendations that align with goal intent
2. **Consistency**: Same goal → same top-3 recommendations
3. **Boost Distribution**: Average heuristic_boost per recommendation
4. **Impulse Utilization**: % recommendations using impulse relevancy
5. **Missing Impulse Adoption**: How often suggested impulses are loaded

---

## Performance Impact

### Latency

**Added operations:**
1. Semantic analysis: ~5ms (in-memory keyword matching)
2. Impulse relevancy query: ~20-50ms (SurrealDB query)
3. Missing impulse discovery: ~20-50ms (SurrealDB query, parallel)
4. Heuristic calculations: ~1-2ms (CPU-bound math)

**Total overhead:** ~50-100ms

**Before:** ~100-200ms
**After:** ~150-300ms
**Acceptable:** Yes, still <500ms for interactive use

### Database Load

**New queries per recommendation:**
- 1x `SELECT FROM impulse_relevance_metric WHERE activity_variant_id IN [...]`
- 1x `SELECT FROM impulse_relevance_metric WHERE ...` (missing impulses)

**Optimization opportunities:**
- Cache impulse relevancy metrics (Redis, 5min TTL)
- Batch queries for multiple recommendations
- Index on `(activity_variant_id, impulse_id)` in impulse_relevance_metric

---

## Next Steps

### Immediate (Deploy to Dev)

1. **Restart activity-api** to load new code:
   ```bash
   kubectl rollout restart deployment -n activity-system metabob-activity-api
   ```

2. **Seed missing templates**:
   ```bash
   bun run scripts/seed-missing-activity-templates.ts
   ```

3. **Re-run assessment**:
   ```bash
   bun run assess-goal-resolution.ts > results-after-improvements.txt
   ```

4. **Compare results**:
   ```bash
   diff goal-resolution-assessment-results.txt results-after-improvements.txt
   ```

### Short-Term (1-2 weeks)

5. **Monitor Production Metrics**
   - Track match rate, consistency, latency
   - Collect user feedback on recommendation quality
   - Analyze impulse relevancy utilization

6. **Iterate on Keyword Mappings**
   - Add more keywords as new patterns emerge
   - Refine tag hierarchy based on usage
   - A/B test different boost weights

7. **Cache Optimization**
   - Add Redis caching for impulse relevancy metrics
   - Cache semantic analysis results (5min TTL)
   - Batch database queries

### Medium-Term (1-2 months)

8. **Embeddings-Based Semantic Matching**
   - Compute embeddings for goal descriptions
   - Match against template embeddings
   - Pre-filter to top-k most similar before heuristics

9. **Learning Loop Integration**
   - Track which recommended activities are actually selected
   - Use selection data to refine keyword mappings
   - Auto-update boost weights based on outcomes

10. **Goal Parsing Service**
    - Extract structured requirements from natural language
    - Feed to recommendation engine as impulse shapes
    - Enable more precise matching

---

## Success Criteria

**Minimum Acceptable:**
- ✅ Match rate > 50% on assessment
- ✅ All categories return recommendations
- ✅ Latency < 500ms p95

**Target:**
- ⭐ Match rate > 70% on assessment
- ⭐ Consistency > 90% (same goal → same top-3)
- ⭐ Latency < 300ms p95
- ⭐ User satisfaction: "Recommendations make sense"

**Stretch:**
- 🚀 Match rate > 85%
- 🚀 Automatic keyword discovery from execution traces
- 🚀 Embeddings-based semantic matching
- 🚀 Real-time learning from user selections

---

## Rollback Plan

If improvements cause regressions:

1. **Disable semantic analysis** (quick fix):
   ```typescript
   // In src/routes/activities.ts, line ~1986
   const effectiveTagPrefix = tag_prefix; // Remove || semantics.tagPrefixes[0]
   const effectiveTags = tags; // Remove || semantics.tagPrefixes
   const effectiveShapes = impulse_shapes; // Remove semantic additions
   ```

2. **Disable impulse relevancy** (if causing errors):
   ```typescript
   // In src/routes/activities.ts, line ~2156
   const impulseBoostsMap = new Map(); // Skip calculation
   const missingImpulseSuggestions = []; // Skip discovery
   ```

3. **Disable heuristic boosts** (revert to pure Thompson):
   ```typescript
   // In src/routes/activities.ts, line ~2159
   let totalBoost = 0; // Then skip all boost calculations
   ```

4. **Full rollback**:
   ```bash
   git revert HEAD
   kubectl rollout restart deployment -n activity-system metabob-activity-api
   ```

---

## Conclusion

We've addressed all three root causes identified in the assessment:

1. ✅ **Weak priors** → Heuristic boosting (6 factors)
2. ✅ **No semantic filtering** → Tag-based pre-filtering
3. ✅ **Missing categories** → 5 new templates

The recommendation system should now provide relevant, consistent, and explainable activity suggestions. The next step is to deploy and validate these improvements against the assessment benchmark.

**Expected outcome:** Match rate improvement from 26.7% to 70-80%, making MiniBob's autonomous operation significantly more effective.
