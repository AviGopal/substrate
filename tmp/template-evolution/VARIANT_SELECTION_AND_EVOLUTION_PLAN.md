# Variant Selection & Systematic Evolution Plan

**Date**: 2026-02-24  
**Context**: Understanding Thompson Sampling variant selection and systematic template improvement

---

## How Variant Selection Works (Current System)

### Thompson Sampling Algorithm

**Current Implementation** (in Redis + SurrealDB):

```
For each template execution:
1. Generate variant_id = base_template_id + variant_hash
2. Track metrics in Redis:
   - thompson_alpha = successes + 1
   - thompson_beta = failures + 1
3. When selecting which variant to use:
   - Sample from Beta(alpha, beta) for each variant
   - Select variant with highest sampled value
4. Over time: successful variants get selected more often
```

**Example** (create-activity variants):
```
Variant A (original): alpha=2, beta=37  → ~5% selection probability
Variant B (improved): alpha=25, beta=5  → ~83% selection probability
Variant C (experimental): alpha=1, beta=1  → ~12% selection probability (exploration)
```

**Key Properties**:
- ✅ **Automatic**: No manual selection needed
- ✅ **Adaptive**: Adjusts based on observed performance
- ✅ **Exploratory**: Still tries worse variants occasionally (prevents local optima)
- ✅ **Converges**: Eventually settles on best variant

---

## Current Gaps in the System

### Gap 1: Variant Registration
**Issue**: New variants need to be explicitly registered  
**Impact**: v2 won't be selected unless we register it  
**Solution**: Use register_activity_template or MCP registration

### Gap 2: Variant Comparison
**Issue**: No automatic A/B testing dashboard  
**Impact**: Hard to see which variant is winning  
**Solution**: Query SurrealDB for variant metrics comparison

### Gap 3: Variant Graduation
**Issue**: No automatic promotion of winning variants  
**Impact**: Manual decision to retire old variants  
**Solution**: Boredom system should auto-deprecate losing variants

### Gap 4: Evolution Triggers
**Issue**: Evolution is manual (we triggered it)  
**Impact**: Templates don't self-improve automatically  
**Solution**: Boredom system should auto-trigger evolution

---

## Systematic Evolution Process

### Phase 1: Manual Evolution (What We're Doing Now)

**Process**:
1. Analyze template metrics (success rate, cost, duration)
2. Identify failure patterns
3. Apply known improvements
4. Create v2 variant
5. Register v2
6. Thompson Sampling auto-selects between v1/v2

**Timeline**: Immediate  
**Effort**: 30-60 min per template  
**Coverage**: 1 template (create-activity-self-contained)

### Phase 2: Batch Evolution (Next Step)

**Process**:
1. Query SurrealDB for all templates with success_rate < 80%
2. For each template:
   - Run analysis (similar to what we did)
   - Apply standard improvements (validation, prompts, required tools)
   - Create improved variant
   - Register and let Thompson Sampling test
3. Monitor results after 10+ executions each

**Timeline**: Next session  
**Effort**: 2-3 hours for 5-10 templates  
**Coverage**: All low-performing templates

**Templates to Evolve** (from Redis data):
- test-feature-template: 83% → 95% (2 failures to analyze)
- run-tests-in-docker: 50% → 90% (stability issues)
- e2e-test: 33% → 80% (needs debugging)

### Phase 3: Automated Evolution (Boredom System)

**Process**:
1. Boredom system monitors template performance
2. When template underperforms (success_rate < 70% for 10+ executions):
   - Trigger evolution activity automatically
   - Create candidate variant
   - Register as candidate (not stable)
3. Thompson Sampling tests candidate
4. After 20+ executions:
   - If candidate outperforms: promote to stable
   - If candidate underperforms: deprecate

**Timeline**: Future implementation  
**Effort**: 4-6 hours to implement boredom triggers  
**Coverage**: All templates continuously

---

## Variant Selection Mechanics (Technical Detail)

### Registration Process

**Option 1: Manual Registration** (what we'll do for v2):
```bash
# Copy v2 to local storage
cp tmp/template-evolution/create-activity-self-contained-v2.json \
   ~/.local/share/opencode/storage/activity-template/

# Backend auto-detects variant via hash
# Thompson Sampling starts tracking immediately
```

**Option 2: MCP Registration** (programmatic):
```javascript
// Use metabob_register_activity_template tool
{
  "template": { ...v2 template object... },
  "variant_hash": "new_hash_v2",
  "generation": 1,
  "parent_id": "create-activity-self-contained"
}
```

### Selection During Execution

**When user runs**:
```bash
opencode activity execute create-activity-self-contained --variables '{...}'
```

**System behavior**:
1. Fetch all variants of "create-activity-self-contained"
2. Query Thompson Sampling metrics from Redis:
   - v1 (original): alpha=2, beta=37
   - v2 (improved): alpha=1, beta=1 (NEW, no data yet)
3. Sample from Beta distributions:
   - v1: sample from Beta(2, 37) ≈ 0.05
   - v2: sample from Beta(1, 1) ≈ 0.50 (uniform, exploration)
4. Select v2 (higher sample)
5. Execute v2
6. Update metrics based on result:
   - If success: v2 alpha=2, beta=1
   - If failure: v2 alpha=1, beta=2

**After 10 executions** (assuming 80% success):
- v2: alpha=9, beta=3 → ~75% selection probability
- v1: alpha=2, beta=37 → ~2% selection probability
- v1 effectively retired (still occasionally tested)

---

## Improving Other Recent Activities

### Activities That Have Failed/Underperformed

From our session data:

1. **evolve-activity-self-contained**: Failed on Task 2 (analysis)
   - **Issue**: Expected SurrealDB data, found none
   - **Fix**: Add fallback to Redis data
   - **Priority**: HIGH (needed for automation)

2. **test-learning-loop-end-to-end**: Failed immediately
   - **Issue**: Unknown (needs debugging)
   - **Fix**: Run with verbose logging, identify root cause
   - **Priority**: MEDIUM

3. **test-feature-template**: 83% success (2/12 failures)
   - **Issue**: Needs failure analysis
   - **Fix**: Debug failed executions, apply fixes
   - **Priority**: MEDIUM

### Improvement Strategy

**Strategy 1: Fix Evolution Activity First**
**Why**: Unlocks automated improvement for all templates  
**Steps**:
1. Debug evolve-activity-self-contained failure
2. Add fallback logic: try SurrealDB → try Redis → try local files
3. Improve analysis task prompts (same issues as create-activity)
4. Test on create-activity-self-contained (we have data)
5. Once working: use it to improve other templates

**Estimated Impact**: Enables automated evolution → 10x improvement velocity

**Strategy 2: Batch Apply Standard Improvements**
**Why**: Fast wins for multiple templates  
**Steps**:
1. Create "apply-standard-template-improvements" activity
2. Input: template JSON
3. Output: improved template with:
   - Validation rules added
   - Prompts restructured
   - Required tools marked
   - Explicit instructions added
4. Run on all templates < 80% success

**Estimated Impact**: 5-10 templates improved in 1 session

**Strategy 3: Build Evolution Dashboard**
**Why**: Visibility into variant performance  
**Steps**:
1. Query SurrealDB for all templates and variants
2. Calculate metrics: success_rate, avg_cost, avg_duration, selection_probability
3. Generate markdown report
4. Identify top candidates for evolution

**Estimated Impact**: Data-driven prioritization

---

## Recommended Immediate Actions

### Action 1: Complete create-activity-self-contained-v2 Evolution ⭐
**Why**: Proves the manual evolution process works  
**Steps**:
1. Apply improvements to v2 JSON (20 min)
2. Register v2 variant
3. Test with simple template creation
4. Measure improvement: 3% → 60-80%

**Success Criteria**: v2 succeeds where v1 failed

### Action 2: Fix evolve-activity-self-contained ⭐⭐
**Why**: Unlocks automated evolution for all templates  
**Steps**:
1. Read evolve-activity-self-contained template
2. Identify Task 2 failure cause
3. Add data source fallbacks (SurrealDB → Redis → local)
4. Improve analysis prompts
5. Test on create-activity-self-contained

**Success Criteria**: Evolution activity completes successfully

### Action 3: Query Variant Performance Metrics
**Why**: Understand current state of all templates  
**Steps**:
1. Query SurrealDB: `SELECT template_id, success_rate, executions FROM template_metrics`
2. Query Redis for Thompson Sampling parameters
3. Generate comparison report
4. Identify next templates for evolution

**Success Criteria**: Clear prioritization of improvement work

### Action 4: Backfill Historical Data
**Why**: Enable SurrealDB-based analytics  
**Steps**:
1. Create backfill script/activity
2. Migrate 51+ Redis executions to SurrealDB
3. Verify data integrity
4. Enable evolution activity (needs SurrealDB data)

**Success Criteria**: All historical executions queryable from SurrealDB

---

## Boredom System Integration (Future)

### Automatic Evolution Triggers

**Boredom Activity Concept**:
```javascript
{
  "trigger": {
    "type": "performance_threshold",
    "condition": "success_rate < 0.70 AND executions > 10"
  },
  "action": {
    "activity": "evolve-activity-self-contained",
    "variables": {
      "templateId": "{{underperforming_template}}"
    }
  },
  "cooldown": "7 days" // Don't re-evolve same template too often
}
```

**How It Works**:
1. Boredom API monitors template metrics every hour
2. Identifies templates meeting trigger condition
3. Automatically executes evolution activity
4. Creates candidate variant
5. Thompson Sampling tests candidate vs. original
6. After 20+ executions: promotes or deprecates

**Benefits**:
- ✅ Zero manual intervention
- ✅ Continuous improvement
- ✅ Self-healing templates
- ✅ Adaptive to changing requirements

---

## Success Metrics for Variant Selection

### Short-term (This Session)
- ✅ v2 variant created and registered
- ✅ v2 tested at least once
- ✅ v2 success rate measured
- ✅ Thompson Sampling selects v2 over v1

### Medium-term (Next Session)
- ✅ 5+ templates with improved variants
- ✅ Evolution activity working end-to-end
- ✅ Variant performance dashboard created
- ✅ Historical data in SurrealDB

### Long-term (Future)
- ✅ Boredom system auto-triggering evolution
- ✅ Average template success rate > 85%
- ✅ Automatic variant graduation
- ✅ Zero manual template management

---

## Key Insights

### Insight 1: Thompson Sampling is Already Working ✅
We don't need to "turn on" variant selection - it's automatic. We just need to:
1. Register new variants
2. Let the system test them
3. Winning variants get selected more often

### Insight 2: Evolution is the Bottleneck
The selection system works. The challenge is creating good variants fast.
**Solution**: Fix evolution activity → unlock automation

### Insight 3: Historical Data Enables Better Evolution
SurrealDB with 51+ executions → better failure pattern analysis
**Solution**: Backfill Redis data → improve evolution quality

### Insight 4: Manual Evolution Proves the Process
Before automating, prove manual evolution works.
**Solution**: Complete create-activity-self-contained-v2 → validate approach

---

## Next Steps Decision Matrix

| Action | Impact | Effort | Priority |
|--------|--------|--------|----------|
| Complete v2 evolution | HIGH | 30 min | 🔴 DO NOW |
| Fix evolve activity | VERY HIGH | 1-2 hrs | 🔴 DO NEXT |
| Query variant metrics | MEDIUM | 15 min | 🟡 SOON |
| Backfill historical data | HIGH | 1-2 hrs | 🟡 SOON |
| Build dashboard | LOW | 1 hr | 🟢 LATER |
| Implement boredom triggers | VERY HIGH | 4-6 hrs | 🟢 LATER |

**Recommended Order**:
1. Complete v2 evolution (proves manual process)
2. Query variant metrics (understand current state)
3. Fix evolve activity (enables automation)
4. Backfill historical data (improves analysis quality)
5. Batch evolve other templates (leverage automation)
6. Implement boredom triggers (full automation)

