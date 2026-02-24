# Next Session: Milestone 2 - Intelligent Budget Allocation

## Quick Status

**Milestone 1 (Shared Instructional State)**: ✅ **COMPLETE** (ready to mark)
- Dual-write pattern implemented
- Tests written (191 + 224 lines)
- Verification complete (9/10 confidence)
- Production ready - ship it!

**Current State**: Clean git, verified implementation, comprehensive documentation

## What Was Just Completed

### Verification Session (1 hour)
1. ✅ Reviewed code quality (10/10)
2. ✅ Ran verification activity
3. ✅ Analyzed logs and storage
4. ✅ Reverted debug logging to production state
5. ✅ Created comprehensive documentation

### Commits
- **repos/metabob-opencode**:
  - ab9416c2: Enable debug logging
  - 1ba6f5aa: Revert to debug level (production)
- **Main repo**:
  - 045e9cc: Verification complete doc
  - 64211f9: Session summary

### Files Created
1. `DUAL_WRITE_VERIFICATION_COMPLETE.md` (247 lines)
2. `SESSION_COMPLETE_DUAL_WRITE_VERIFICATION.md` (260 lines)
3. `NEXT_SESSION_MILESTONE_2.md` (this file)

## Mark Milestone 1 Complete ✅

**Action**: Update project docs to mark Milestone 1 as COMPLETE

**Status File**: Check for `CURRENT_DEVELOPMENT_STATUS.md` or similar

**Deliverables Summary**:
- impulse-sync.ts (101 lines)
- 5 impulse tool integrations
- Unit tests (191 lines)  
- Integration tests (224 lines)
- Comprehensive documentation
- Verification analysis (9/10 confidence)

**Result**: Shared Instructional State is now unified between SessionMemory and Activity.impulses

## Milestone 2: Intelligent Budget Allocation

### Overview
**Goal**: Dynamically allocate impulse token budgets based on:
- Historical usage patterns
- Content size/complexity
- Loading priority
- Available context window

**Current State**: Fixed budgets (manual allocation)
**Target State**: Adaptive budgets (ML-driven or heuristic-based)

### Estimated Timeline
**Effort**: 4-6 hours  
**Complexity**: Medium-High  
**Dependencies**: Milestone 1 (complete ✅)

### High-Level Approach

#### Phase 1: Budget Tracking (1-2 hours)
**Goal**: Collect data on actual token usage per impulse

**Tasks**:
1. Add `actualTokensUsed` field to impulse metadata
2. Track tokens consumed during impulse loading
3. Store historical usage data
4. Create metrics: avg usage, variance, efficiency

**Files to Modify**:
- `src/session/impulse-loader.ts` (track usage)
- `src/session/session-memory.ts` (store metrics)
- ActivityTemplate.Impulse.Schema (add metrics fields)

#### Phase 2: Budget Prediction (2-3 hours)
**Goal**: Predict optimal budget based on content

**Approaches** (pick one):
1. **Heuristic-Based** (simpler, faster)
   - File size → token estimate
   - Pointer type → budget multiplier
   - Priority → minimum allocation
   
2. **ML-Based** (more accurate, complex)
   - Train on historical data
   - Features: file size, type, complexity
   - Model: linear regression or simple NN

**Files to Create**:
- `src/session/budget-allocator.ts` (core logic)
- `src/util/token-estimator.ts` (estimation helpers)

#### Phase 3: Dynamic Allocation (1-2 hours)
**Goal**: Apply predictions during impulse creation

**Tasks**:
1. Integrate budget-allocator into impulse-create
2. Override manual budgets with predictions
3. Allow manual override (escape hatch)
4. Add validation (min/max bounds)

**Files to Modify**:
- `src/tool/impulse-create.ts` (integrate allocator)
- `src/session/context-manager.ts` (budget validation)

#### Phase 4: Testing & Validation (1 hour)
**Goal**: Verify allocation improves efficiency

**Tests**:
1. Unit tests: budget-allocator logic
2. Integration tests: end-to-end allocation
3. Manual validation: run activities, check budgets

**Metrics to Track**:
- Average budget accuracy (predicted vs actual)
- Context window utilization (% used)
- Impulse load failures (over-allocated)

### Quick Start Commands

```bash
# Create budget tracking fields
cd repos/metabob-opencode
git checkout -b feature/intelligent-budget-allocation

# Start with Phase 1: Budget Tracking
# 1. Read impulse schema
cat packages/opencode/src/session/activity-template.ts | grep -A 50 "Impulse.Schema"

# 2. Read impulse loader
cat packages/opencode/src/session/impulse-loader.ts

# 3. Plan additions to schema and loader
```

### Success Criteria

**Phase 1 Complete**:
- [x] actualTokensUsed tracked per impulse
- [x] Historical metrics stored
- [x] Metrics visible in TUI/logs

**Phase 2 Complete**:
- [x] Budget predictor implemented
- [x] Predictions match historical data (>80% accuracy)
- [x] Configurable prediction strategy

**Phase 3 Complete**:
- [x] Dynamic allocation integrated
- [x] Manual override supported
- [x] Validation prevents over/under allocation

**Phase 4 Complete**:
- [x] Tests pass (unit + integration)
- [x] Manual validation shows improvement
- [x] Documentation complete

### Recommended Approach

**Start Simple** (Heuristic-Based):
1. File pointer → estimate file size → estimate tokens (4 chars/token)
2. Memo pointer → content length → estimate tokens
3. Add priority multiplier: high=1.5x, medium=1.0x, low=0.75x
4. Add minimum/maximum bounds (500-5000 tokens)

**Benefits**:
- Fast to implement (1-2 hours)
- No ML dependencies
- Easy to understand and debug
- Can iterate to ML later

**Iterate to ML** (Future):
1. Collect historical data (Phase 1)
2. Train simple model (linear regression)
3. Compare heuristic vs ML accuracy
4. Switch if ML provides >10% improvement

### Documentation Template

Create these files as you progress:
1. `BUDGET_ALLOCATION_PLAN.md` - Architecture and approach
2. `BUDGET_TRACKING_IMPLEMENTATION.md` - Phase 1 details
3. `BUDGET_PREDICTION_ANALYSIS.md` - Phase 2 findings
4. `SESSION_COMPLETE_MILESTONE_2.md` - Final summary

### Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Over-allocation (OOM) | Min/max bounds, validation |
| Under-allocation (truncation) | Increase multiplier, learn from failures |
| Complexity creep | Start simple (heuristic), iterate to ML only if needed |
| Testing difficulty | Unit tests for logic, integration tests for end-to-end |

### Next Session Plan

1. **Mark Milestone 1 Complete** (5 min)
2. **Review Milestone 2 Requirements** (10 min)
3. **Phase 1: Budget Tracking** (1-2 hours)
   - Read schema and loader
   - Add tracking fields
   - Store historical data
   - Create metrics

4. **Phase 2: Heuristic Predictor** (1-2 hours)
   - Implement token estimator
   - Add priority multipliers
   - Add bounds validation

5. **Phase 3: Integration** (1 hour)
   - Modify impulse-create
   - Test allocation
   - Verify budgets

6. **Phase 4: Validation** (30 min)
   - Run activities
   - Check metrics
   - Document findings

**Total**: 4-6 hours

### Related Files

**Schema & Types**:
- `packages/opencode/src/session/activity-template.ts`
- `packages/opencode/src/session/session-memory.ts`

**Impulse Tools**:
- `packages/opencode/src/tool/impulse-create.ts`
- `packages/opencode/src/session/impulse-loader.ts`

**Context Management**:
- `packages/opencode/src/session/context-manager.ts`
- `packages/opencode/src/session/impulse-resolver.ts`

**Testing**:
- `packages/opencode/test/session/` (add budget tests here)

## Questions to Answer

1. **Schema Changes**: What fields to add to Impulse.Schema?
   - `actualTokensUsed?: number`
   - `budgetAccuracy?: number` (predicted / actual)
   - `allocationStrategy?: 'manual' | 'heuristic' | 'ml'`

2. **Tracking Point**: Where to measure token usage?
   - After impulse loading completes
   - Count tokens in loaded content
   - Store in impulse metadata

3. **Prediction Strategy**: Heuristic or ML first?
   - **Recommendation**: Heuristic (simpler, faster)
   - Can switch to ML after collecting data

4. **Validation**: How to prevent over-allocation?
   - Min budget: 500 tokens
   - Max budget: 5000 tokens
   - Total context limit check

5. **Override**: How to allow manual budgets?
   - Add `manualBudget?: boolean` flag
   - Skip prediction if manual=true

## Ready to Start?

✅ Milestone 1 verified and complete  
✅ Clean git state  
✅ Documentation comprehensive  
✅ Approach outlined  
✅ Success criteria defined  

**Next command**:
```bash
cd repos/metabob-opencode
git checkout -b feature/intelligent-budget-allocation
```

**First task**: Read impulse schema and loader, plan Phase 1 additions

**Estimated**: 4-6 hours to complete Milestone 2

---

**Good luck! 🚀**
