# Ratchet Strategy: Alternating Template Improvement & Code Alignment

**Date**: 2026-02-24  
**Philosophy**: Continuous bidirectional improvement - templates inform code, code enables templates

---

## The Ratchet Mechanism

### Concept

```
Cycle 1: Improve Templates → Discover Code Gaps → Fix Code → Better Templates
Cycle 2: Use Better Templates → Discover New Patterns → Improve Code → Even Better Templates
Cycle 3: ...
```

**Key Property**: Each cycle raises the floor. Never regress.

**Ratchet Points**:
1. Template improvements teach us what code should do
2. Code improvements enable better template capabilities
3. Execution data reveals both template and code issues
4. Fix the bottleneck, measure, repeat

---

## Current State Analysis

### Templates (What We Know)

**High Performers** (>80% success):
- hello-world-minimal: 100% (27 executions)
- test-feature-template: 83% (12 executions)
- trace-enforce-validate-loop: 100% (1 execution)

**Low Performers** (<50% success):
- create-activity-self-contained: 3% (37 executions) ← CRITICAL
- run-tests-in-docker: 50% (2 executions)
- e2e-test: 33% (3 executions)

**Underutilized** (0 executions):
- 16 templates never executed
- May be broken or unknown

### Code (What We Know)

**Working Well**:
- SurrealDB dual-write: 100% operational
- Thompson Sampling: Automatic variant selection
- Activity execution: Reliable orchestration
- Impulse correlation: Schema supports it

**Known Issues**:
- evolve-activity-self-contained: Fails on Task 2 (no SurrealDB data fallback)
- RecordID serialization: Pydantic can't serialize (MEDIUM severity)
- Backfill logic: Doesn't exist (blocks historical analysis)
- Boredom triggers: Not implemented (blocks automation)

---

## Ratchet Cycle Design

### Cycle Structure

**Phase A: Template Improvement** (30-60 min)
1. Select low-performing template
2. Analyze failure patterns
3. Apply improvements (validation, prompts, tools)
4. Test improved variant
5. Measure: Did success rate improve?

**Phase B: Code Alignment Discovery** (15-30 min)
1. Review what worked vs. what didn't
2. Identify code gaps that blocked success
3. Document misalignment with design goals
4. Prioritize fixes

**Phase C: Code Alignment Execution** (30-90 min)
1. Fix identified code issues
2. Test that fix enables better templates
3. Update templates to use new capability
4. Measure: Did code change improve template success?

**Phase D: Measurement & Decision** (10-15 min)
1. Compare before/after metrics
2. Document insights learned
3. Identify next bottleneck
4. Decide: Improve templates OR align code?

**Total Cycle Time**: 1.5-3 hours

---

## Cycle 1: Bootstrap (Current Session)

### Phase A: Template Improvement (IN PROGRESS)

**Target**: create-activity-self-contained (3% → 60%+)

**Actions**:
1. ✅ Analyzed failure patterns
2. ✅ Identified improvements (validation, prompts, tools)
3. ⏳ Apply improvements to v2
4. ⏳ Test v2
5. ⏳ Measure improvement

**Expected Discovery**: What code gaps block template success?

### Phase B: Code Alignment Discovery (NEXT)

**Questions to Answer**:
1. Did v2 succeed or fail?
2. If failed: What code capability is missing?
3. If succeeded: What code improvement would make it better?
4. What design goals are violated by current implementation?

**Possible Discoveries**:
- Template registration is manual (should be automatic)
- Validation errors are opaque (should be detailed)
- Retry logic is simplistic (should be adaptive)
- No template versioning UI (should track evolution)

### Phase C: Code Alignment (TBD)

**Potential Fixes** (based on likely discoveries):
1. Improve validation error messages
2. Add template registration helper
3. Enhance retry with exponential backoff
4. Create variant comparison dashboard

### Phase D: Measurement

**Metrics**:
- create-activity-self-contained success rate: 3% → X%
- Code improvement impact: Y templates benefit
- Next bottleneck: Z identified

---

## Cycle 2: Evolution Activity (Next Cycle)

### Phase A: Code Alignment First (Reverse Order)

**Target**: Fix evolve-activity-self-contained

**Rationale**: Template improvements are manual. Fixing evolution activity unlocks automated improvement for ALL templates.

**Actions**:
1. Identify why Task 2 fails (no SurrealDB data)
2. Add fallback: SurrealDB → Redis → local files
3. Improve analysis task prompts
4. Test on create-activity-self-contained

**Expected Discovery**: What template patterns enable better evolution?

### Phase B: Template Pattern Discovery

**Questions**:
1. What made evolution succeed/fail?
2. What template structure is easiest to analyze?
3. What validation rules help evolution?
4. What prompts enable better analysis?

### Phase C: Apply Patterns to Templates

**Actions**:
1. Update create-activity-self-contained-v2 with evolution-friendly patterns
2. Update other templates with same patterns
3. Test evolution on improved templates

### Phase D: Measurement

**Metrics**:
- evolve-activity-self-contained success rate: 0% → X%
- Templates successfully evolved: Y
- Automation velocity: Z templates/hour

---

## Cycle 3: Batch Evolution (Future Cycle)

### Phase A: Template Improvement (Automated)

**Target**: All templates < 80% success

**Actions**:
1. Run fixed evolution activity on each
2. Thompson Sampling auto-tests variants
3. Measure aggregate improvement

**Expected Discovery**: Which templates resist evolution?

### Phase B: Code Alignment Discovery

**Questions**:
1. What templates can't be automatically improved?
2. What code capabilities would enable their improvement?
3. What design goals are still violated?

### Phase C: Code Alignment

**Potential Fixes**:
- Better failure pattern analysis
- Semantic validation (not just structural)
- Cross-template learning (apply patterns from winners)
- Automatic variant graduation

### Phase D: Measurement

**Metrics**:
- Average template success rate: X% → Y%
- Templates at >90% success: Z
- Manual intervention needed: N templates

---

## Design Goals Alignment Checklist

### Goal 1: Ductile Rigidity ✅ MOSTLY ALIGNED

**Design Intent**: Strong foundations, flexible execution

**Current State**:
- ✅ SurrealDB schema is strong (template_id, impulses)
- ✅ Dual-write provides flexibility (Redis fallback)
- ✅ Validation harnesses enforce correctness
- ⚠️ Templates lack strong validation (too flexible)

**Misalignment**: Templates don't enforce ductile rigidity on themselves
**Fix**: Add comprehensive validation to all templates (Priority 1 improvement)

### Goal 2: Functional State Transformation ✅ WELL ALIGNED

**Design Intent**: Track complete state transitions, not individual operations

**Current State**:
- ✅ Activity execution tracked as complete units
- ✅ Impulse correlation captures context transformations
- ✅ Thompson Sampling measures whole-variant performance
- ✅ Commits capture functional state changes

**Misalignment**: None identified
**Validate**: Continue this pattern

### Goal 3: Self-Improving System ⚠️ PARTIALLY ALIGNED

**Design Intent**: System learns and improves automatically

**Current State**:
- ✅ Thompson Sampling auto-selects better variants
- ✅ Metrics collection is automatic
- ⚠️ Evolution is manual (should be automatic)
- ❌ Boredom triggers not implemented

**Misalignment**: Evolution bottleneck blocks self-improvement
**Fix**: Phase C of Cycle 2 - fix evolution activity

### Goal 4: Activity-First Development ✅ WELL ALIGNED

**Design Intent**: Use activities for all structured work

**Current State**:
- ✅ This session used 5 activities
- ✅ Templates are primary abstraction
- ✅ Direct execution rare (as intended)
- ⚠️ Activity creation is broken (create-activity 3% success)

**Misalignment**: Can't easily create new activities (blocks scaling)
**Fix**: Cycle 1 - improve create-activity-self-contained

### Goal 5: Data-Driven Decision Making ✅ WELL ALIGNED

**Design Intent**: Metrics inform all decisions

**Current State**:
- ✅ Thompson Sampling uses metrics
- ✅ Execution data in SurrealDB
- ✅ Success rates tracked
- ⚠️ Historical data in Redis only (not SurrealDB)

**Misalignment**: Can't query full history for analysis
**Fix**: Backfill Redis → SurrealDB

---

## Ratchet Cycle Priority Matrix

| Cycle | Focus | Impact | Effort | Priority |
|-------|-------|--------|--------|----------|
| 1. Bootstrap | Improve create-activity | HIGH | 1 hr | 🔴 NOW |
| 2. Evolution | Fix evolve-activity | VERY HIGH | 2 hrs | 🔴 NEXT |
| 3. Batch | Evolve 5-10 templates | VERY HIGH | 3 hrs | 🟡 SOON |
| 4. Dashboard | Build metrics UI | MEDIUM | 2 hrs | 🟢 LATER |
| 5. Backfill | Migrate Redis data | HIGH | 2 hrs | 🟡 SOON |
| 6. Boredom | Auto-evolution triggers | VERY HIGH | 6 hrs | 🟢 LATER |

**Recommended Order**:
1. **Cycle 1**: Improve create-activity (proves manual process)
2. **Query Metrics**: Understand current variant performance
3. **Cycle 2**: Fix evolve-activity (unlocks automation)
4. **Backfill**: Enable historical analysis
5. **Cycle 3**: Batch evolution (scale improvements)
6. **Cycle 4+**: Dashboard, boredom, continuous improvement

---

## Measuring Ratchet Progress

### Success Metrics

**After Cycle 1**:
- ✅ create-activity-self-contained: 3% → 60%+
- ✅ Learned: What validation rules matter most
- ✅ Identified: Code gaps blocking template success

**After Cycle 2**:
- ✅ evolve-activity-self-contained: 0% → 80%+
- ✅ Can automatically evolve any template
- ✅ Improvement velocity: 10x faster

**After Cycle 3**:
- ✅ 5-10 templates improved
- ✅ Average success rate: >85%
- ✅ Proven: Ratchet mechanism works at scale

**After Cycle 4-6**:
- ✅ Dashboard shows variant performance
- ✅ Historical data enables better evolution
- ✅ Boredom system auto-improves templates
- ✅ Zero manual intervention needed

### Failure Modes to Watch

**Ratchet Slips** (regress instead of improve):
- Template v2 worse than v1
- Code fix breaks existing templates
- Improvement doesn't generalize

**How to Prevent**:
- Always measure before/after
- Thompson Sampling auto-detects regressions
- Keep v1 as fallback (never delete working variants)
- Document what worked and what didn't

**Ratchet Stalls** (no progress):
- Can't identify next bottleneck
- Code and templates both seem fine
- Improvements don't compound

**How to Recover**:
- Query execution data for hidden issues
- Look at 0-execution templates (underutilized)
- Interview user feedback (what's painful?)
- Try random exploration (new patterns)

---

## Key Insights

### Insight 1: Templates Teach Us What Code Should Do
When create-activity fails, it reveals what the system can't handle.
**Action**: Fix code to enable template success.

### Insight 2: Code Improvements Unlock New Template Capabilities
When we fix evolution activity, ALL templates benefit.
**Action**: Prioritize code fixes with broad template impact.

### Insight 3: Execution Data Reveals Both Bottlenecks
Metrics show us whether templates or code is the limiting factor.
**Action**: Always query data before deciding next focus.

### Insight 4: Ratchet Prevents Regression
Thompson Sampling keeps v1 alive, so v2 failures don't hurt users.
**Action**: Trust the exploration/exploitation balance.

### Insight 5: Alternating Rhythm Maximizes Progress
Spending 100% time on templates OR code is suboptimal.
**Action**: Alternate every 1-3 hours based on discoveries.

---

## Immediate Next Steps

### Step 1: Query Current State (15 min) ← DO NOW
```bash
# Get variant performance from Redis
docker exec metabob-redis redis-cli KEYS "activity:metrics:*"
# Get template metrics from SurrealDB
curl -s "http://localhost:8080/api/v1/learning-loop/executions?hours=168&limit=100"
```

**Output**: Dashboard showing variant performance

### Step 2: Complete Cycle 1 Phase A (30 min) ← DO NEXT
1. Apply improvements to create-activity-self-contained-v2
2. Register v2
3. Test with simple case
4. Measure improvement

**Output**: v2 template + success rate

### Step 3: Cycle 1 Phase B (15 min) ← THEN
1. Analyze what worked/failed
2. Identify code gaps
3. Document misalignments
4. Prioritize fixes

**Output**: Code alignment plan for Cycle 1 Phase C

### Step 4: Decide Next Cycle (5 min)
- If v2 succeeded: Move to Cycle 2 (fix evolve-activity)
- If v2 failed: Stay in Cycle 1 (align code, retry)

