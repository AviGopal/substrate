# Learning System Assessment - Document Index

**Assessment Date**: February 17, 2026  
**Request**: "Assess the system's capability to learn from previous sessions and convert common sequences into activity templates"

---

## Quick Summary

**Current State**: 🟡 70% Complete
- Infrastructure: ✅ Built (database tables, backend logic, configuration)
- Data Collection: ❌ Broken (impulses not tracked)
- Learning Loop: ❌ Blocked (pattern detection dormant)

**Key Finding**: Impulse data not flowing → Pattern detection never triggers → No learned variants created

**Solution**: Fix 3 code gaps (8 hours) → Unlocks existing learning pipeline

---

## Assessment Documents

### 1. Detailed Assessment (Main Document)
**File**: `LEARNING_SYSTEM_ASSESSMENT_FEB17.md`

**Contents**:
- Executive summary (70% complete, what works vs broken)
- Capability matrix (execution vs session learning)
- Root cause analysis (impulse data flow break)
- Evidence from database (102 executions, 0 impulses)
- Code location references
- Recommendations (fix impulse tracking first)

**Read this for**: Complete understanding of current state

---

### 2. Visual Summary
**File**: `LEARNING_CAPABILITY_VISUAL_SUMMARY.md`

**Contents**:
- System architecture diagrams (current vs should-be)
- Data flow visualization (where it breaks)
- Status matrices (what's implemented vs functional)
- Pattern detection logic explanation
- Trailblazing vs pattern learning comparison
- Cost-benefit analysis (Option A vs B)

**Read this for**: Quick visual understanding

---

### 3. Action Plan
**File**: `LEARNING_FIX_ACTION_PLAN_FEB17.md`

**Contents**:
- 3 specific code fixes with diffs
- Complete test plan (unit + integration + validation)
- Database verification queries
- Timeline (5 days, 20 hours)
- Success criteria per phase
- Rollback plan if issues arise

**Read this for**: Implementation guidance

---

## Historical Context

### Previous Gap Analysis
**File**: `ACTIVITY_LEARNING_GAP_ANALYSIS.md` (Feb 13, 2026)

**Key Points**:
- Identified 5 critical gaps
- Recommended 12 hours of fixes
- **Status**: Gaps remain unfixed

### Previous Fix Plan
**File**: `ACTIVITY_LEARNING_FIX_PLAN.md` (Feb 15, 2026)

**Key Points**:
- 3-week implementation plan
- Quick wins defined (Day 1-2)
- Created impulse_registry tables (DONE)
- **Status**: Data collection not implemented

---

## Evidence Summary

### Database State
```sql
-- Executions tracked: ✅
SELECT COUNT() FROM activity_executions; -- 102

-- Impulses tracked: ❌
SELECT COUNT() FROM impulse_registry; -- 0

-- Impulse usage: ❌
SELECT execution_id, array::len(impulses_used) FROM activity_executions;
-- All have impulses_used = []
```

### Code State
```
Pattern detection: repos/metabob-rpc-api/server/actions/variant_commissioning.py
  Status: ✅ Exists, ❌ Never executes (no impulse data)

Trailblazing: repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts
  Status: ✅ Exists, ✅ Works (creates failure-recovery variants)

Session analysis: (no files found)
  Status: ❌ Not implemented
```

---

## Key Findings

### What Works ✅
1. **Activity Execution Tracking**
   - 102 executions recorded
   - Success/failure, cost, duration tracked
   - File changes tracked

2. **Template Variant System**
   - Genealogy tracking works
   - Template versioning works
   - Variant storage works

3. **Trailblazing Auto-Recovery**
   - Creates variants from failures
   - Recovery steps learned
   - New variants saved

4. **Thompson Sampling**
   - Variant selection works
   - Reward updates work
   - (Limited by small variant pool)

### What's Broken ❌
1. **Impulse Data Collection**
   - OpenCode doesn't extract impulses
   - CLI doesn't accept impulses parameter
   - Backend receives empty arrays
   - **Result**: 0 impulses tracked despite 102 executions

2. **Pattern Detection**
   - Code exists in variant_commissioning.py
   - Logic: Check 3+ similar executions with impulse overlap
   - **Problem**: Always returns early (no impulse data)
   - **Result**: Never creates pattern-learned variants

3. **Variant Commissioning**
   - Code exists to auto-create variants
   - Triggered by pattern detection
   - **Problem**: Pattern detection never triggers
   - **Result**: Only failure-recovery variants exist

### What's Missing ❌
1. **Session Analysis**
   - No code to analyze user sessions
   - No pattern recognition from tool sequences
   - No template generation from sessions
   - **Status**: Configuration exists, no implementation

2. **Impulse Effectiveness**
   - Tables exist (impulse_registry, impulse_usage)
   - Backend code ready
   - **Problem**: No data to analyze
   - **Result**: Can't optimize impulse selection

---

## The Critical Path

### Current Blocker
```
Impulse data not flowing through pipeline
  ↓
Pattern detection never triggers
  ↓
No pattern-learned variants created
  ↓
Limited variant pool for Thompson Sampling
  ↓
No learning-based improvement
```

### After Fix
```
Impulse data flows OpenCode → CLI → Backend
  ↓
impulse_registry populated (50+ entries)
  ↓
Pattern detection triggers (3+ similar executions)
  ↓
Auto-commissioned variants created
  ↓
Thompson Sampling selects best variants
  ↓
System learns and improves over time
```

---

## Recommendations

### Immediate Priority: Fix Impulse Tracking
**Effort**: 1 week (20 hours)  
**ROI**: High - Unlocks existing code, enables learning loop  
**Files to modify**: 3 files (activity.ts, activity_manager.py, activity_tools.py)

### Short-Term: Validate Pattern Detection
**Effort**: 1 week (monitoring + validation)  
**Result**: Confirm learned variants created and used

### Long-Term: Session Analysis (Optional)
**Effort**: 2-3 weeks (80-120 hours)  
**ROI**: Medium - New feature, unclear usage frequency  
**Recommendation**: Evaluate after impulse tracking working

---

## Decision Points

### Question 1: Should we fix impulse tracking?
**Answer**: ✅ YES
- High ROI (8 hours unlocks existing code)
- Blocks all learning features
- Foundation for future optimization

### Question 2: Should we build session analysis?
**Answer**: ⚠️ EVALUATE LATER
- Alternative: Use create-activity-template activity (exists)
- Users can describe workflow, agent creates template
- May be simpler than automatic pattern detection
- **Decision**: Fix impulse tracking first, then re-evaluate

### Question 3: What's the priority?
**Answer**: 
1. **Week 1**: Fix impulse tracking (CRITICAL)
2. **Week 2**: Validate pattern detection (HIGH)
3. **Week 3+**: Session analysis (MEDIUM, if approved)

---

## Success Metrics

### Phase 1: Data Collection Working
- [ ] 10+ executions with impulse data
- [ ] 50+ impulse_registry entries
- [ ] impulse_usage records created
- [ ] E2E test passes

### Phase 2: Pattern Detection Working
- [ ] First pattern-learned variant created
- [ ] Variant shows in Thompson Sampling
- [ ] Pattern detection test passes
- [ ] Variant successfully executed

### Phase 3: Learning Loop Complete
- [ ] 5+ learned variants in pool
- [ ] Effectiveness rates calculated
- [ ] Cost optimization data available
- [ ] Documentation updated with examples

---

## Next Steps

1. **Read**: LEARNING_SYSTEM_ASSESSMENT_FEB17.md (detailed analysis)
2. **Review**: LEARNING_CAPABILITY_VISUAL_SUMMARY.md (visual overview)
3. **Decide**: Approve impulse tracking fix?
4. **Implement**: Follow LEARNING_FIX_ACTION_PLAN_FEB17.md
5. **Monitor**: Track metrics during Week 2

---

## Related Documentation

- `ACTIVITY_SYSTEM_COLD_START_GUIDE.md` - Bootstrap procedures
- `ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md` - Execution tracking validation
- `ACTIVITY_LEARNING_GAP_ANALYSIS.md` - Original gap identification (Feb 13)
- `ACTIVITY_LEARNING_FIX_PLAN.md` - Original fix plan (Feb 15)
- `BACKEND_INTEGRATION_COMPLETE.md` - Backend integration status

---

**Assessment Complete**: February 17, 2026  
**Assessor**: Activity Mode (OpenCode)  
**Status**: Ready for decision and implementation
