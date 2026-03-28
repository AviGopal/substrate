# Activity Learning Loop - Gap Analysis & Cost Optimization

**Date**: February 13, 2026  
**Context**: Reviewing alignment between goals and implementation, optimizing for cost  
**Status**: 🔴 **CRITICAL GAPS IDENTIFIED**

---

## Executive Summary

**Current State**: Activity execution works, but **learning loop is broken**. Session data is NOT flowing through the complete pipeline to enable learning from success/failure patterns.

**Impact**: 
- Cannot determine if activities were successful at their goals
- Cannot learn which context/impulses lead to success
- Expensive Sonnet runs without data-driven optimization
- System cannot self-improve based on actual execution data

**Root Cause**: Data recording infrastructure exists but has critical gaps preventing closed-loop learning.

---

## Critical Gap #1: Execution Start Recording is DISABLED

### Current State
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:462
# DISABLED: Backend /record/start endpoint has bug that creates templates instead of recording
```

**Impact**: 🔴 **CRITICAL**
- No execution records created when activities start
- Cannot track execution lifecycle
- Cannot measure duration accurately
- Cannot query "in-progress" executions

### Evidence
```bash
$ grep -n "record_execution_start" repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py
462:        # DISABLED: Backend /record/start endpoint has bug
1101:    async def record_execution_start_external(
```

The method exists but is never called during activity execution.

### Required Fix
1. Fix backend `/v2/activities/record/start` endpoint bug
2. Re-enable call in activity_manager.py
3. Verify execution records are created in SurrealDB `activity_executions` table

**Estimated Effort**: 1-2 hours

---

## Critical Gap #2: Impulse Tracking Not Implemented

### Current State
Per `GOALS_ALIGNMENT_ASSESSMENT.md`:
- ❌ **Step-level impulse tracking**: Not recording which impulses were loaded per step
- ❌ **execution_steps table**: Step data stored as JSON blob, not queryable
- ❌ **Context effectiveness**: Cannot determine which context helps activities succeed

### Impact: 🔴 **CRITICAL**
**Cannot answer the core question**: "What context/impulses lead to activity success?"

This is the **foundation of cost optimization**:
- Can't learn which context is useful vs noise
- Can't reduce token usage by omitting unhelpful context
- Can't improve success rates by including critical context
- Can't optimize prompt instructions based on empirical data

### Evidence from Code

**CLI side** - impulse tracking exists but is basic:
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_tools.py:227
# Map impulses (mark all as useful for now - TODO: sophisticated tracking)
impulses_used = [
    {
        "impulse_id": imp.get("id", "unknown"),
        "usage_type": "useful"  # ← No real tracking!
    }
]
```

**Backend side** - no execution_steps table:
```sql
-- What we have:
TABLE activity_executions {
  step_results: array  -- JSON blob, not queryable
}

-- What we need:
TABLE execution_steps {
  execution_id: record(activity_executions),
  step_index: int,
  impulses_loaded: array,   -- ❌ NOT IMPLEMENTED
  impulses_created: array,  -- ❌ NOT IMPLEMENTED
  success: bool,
  output: string
}
```

### Required Fix
1. Create `execution_steps` table in SurrealDB with impulse tracking
2. Update CLI to record step results with impulse IDs
3. Call `/v2/activities/record/step` after each step (endpoint exists)
4. Build analysis queries to correlate impulses with success

**Estimated Effort**: 4-6 hours

---

## Critical Gap #3: No Success Criteria Validation

### Current State
From recent commits:
```
4709295 feat: Self-improvement feedback loop implementation
```

But this focuses on **operational metrics** (queue depth, job states), not **activity effectiveness**.

### The Missing Question
**"Did this activity achieve its stated goal?"**

Current validation types (from code review):
```python
# Existing validations:
- "output_contains": Basic string matching
- "required_files": File existence check
- "required_patterns": Pattern matching

# MISSING:
- "template_registered": Did template creation succeed?
- "goal_achieved": Did activity accomplish stated objective?
- "test_passed": Did tests pass for code changes?
- "quality_improved": Did code quality metrics improve?
```

### Impact: 🔴 **CRITICAL**
- Cannot measure activity success objectively
- Cannot compare variant effectiveness
- Cannot optimize template selection
- Thompson Sampling operates without ground truth

### Required Fix
1. Define success criteria per activity category
2. Implement goal-based validation
3. Record validation results with execution outcomes
4. Build success rate analysis per template variant

**Estimated Effort**: 3-4 hours

---

## Gap #4: Session-Activity Linkage Broken

### Current State
Two separate systems collecting data:

**System 1: Agent Execution Tracking**
```
OpenCode Session → CLI MCP Tools → /api/agent-execution/tool/invocation
                                  → Redis: agent_execution:session:{id}
```

**System 2: Activity Execution Tracking**
```
Activity Execution → CLI Activity Manager → /v2/activities/record/complete
                                          → SurrealDB: activity_executions
```

**Problem**: No linkage between them! 

When an activity runs:
- Session data in Redis (tool calls, file modifications)
- Activity data in SurrealDB (execution results)
- **No connection between the two datasets**

### Impact: 🟡 **HIGH**
Cannot answer:
- "What tools were used during this activity execution?"
- "What files were modified during this activity?"
- "What code context was present when activity succeeded/failed?"

### Evidence
```python
# agent_execution.py - stores in Redis
def session_key(session_id: str) -> str:
    return f"agent_execution:session:{session_id}"

# activity_executions table - stores in SurrealDB
# NO session_id field! No linkage!
```

### Required Fix
1. Add `session_id` field to `activity_executions` table
2. Update recording endpoints to accept session_id
3. Build cross-database queries linking session → activity → outcomes

**Estimated Effort**: 2-3 hours

---

## Gap #5: No Cost-per-Activity Tracking

### Current State
From recent commit message:
> "It's a bit expensive to exist when we are running ourselves on sonnet for everything"

Yet we have **no visibility** into:
- Cost per activity execution
- Token usage breakdown by step
- Which activities are expensive vs cheap
- ROI (success rate vs cost)

### Impact: 🟡 **HIGH**
Cannot optimize for cost without data:
- Which activities should use cheaper models?
- Which steps are unnecessarily expensive?
- What's the cost of trailblazing vs success?
- Should we cache expensive operations?

### Evidence
```python
# activity_executions table has these fields:
total_cost: float       # ✅ Recorded
total_tokens: object    # ✅ Recorded

# But NO analysis tools exist to:
# - Compare costs across templates
# - Identify expensive variants
# - Calculate cost per success
# - Optimize model selection
```

### Required Fix
1. Build cost analysis queries (simple SQL)
2. Create cost dashboard/report
3. Implement cost-based variant selection
4. Add budget limits per activity category

**Estimated Effort**: 2-3 hours

---

## Cost Optimization Strategy

### Principle: Data-Driven Model Selection

**Current**: Everything uses Sonnet (expensive)
**Target**: Use cheapest model that achieves success threshold

### Implementation Plan

#### Phase 1: Data Collection (2 weeks)
Run activities on Sonnet, collect data:
- Success rates per template
- Token usage per step
- Cost per execution
- Impulse effectiveness

#### Phase 2: Analysis (1 week)
Build queries to answer:
- Which activities have >90% success rate? (candidates for cheaper models)
- Which steps use most tokens? (optimization targets)
- Which impulses correlate with success? (keep these)
- Which impulses never used? (remove these)

#### Phase 3: Optimization (2 weeks)
Implement changes:
- Use Haiku for high-success activities (10x cheaper)
- Reduce impulse noise (remove unused context)
- Shorten prompts based on success data
- Cache expensive operations

**Expected Savings**: 60-80% cost reduction while maintaining success rate

---

## Data Flow Verification Checklist

To declare "success" per user request, we need:

### ✅ Execution Recorded in Database
- [ ] `/v2/activities/record/start` creates execution record
- [ ] `/v2/activities/record/step` records each step
- [ ] `/v2/activities/record/complete` updates with outcome
- [ ] Can query executions by template_id, session_id, date

### ✅ Impulse Tracking Functional
- [ ] Step records include `impulses_loaded` array
- [ ] Step records include `impulses_created` array
- [ ] Can query: "Which impulses were present in successful executions?"
- [ ] Can query: "Which impulses correlate with failure?"

### ✅ Session Linkage Working
- [ ] Activity executions reference session_id
- [ ] Can join session tool calls → activity execution
- [ ] Can analyze: "What files were modified during activity X?"

### ✅ Success Criteria Validated
- [ ] Each activity has defined success criteria
- [ ] Validation results recorded with execution
- [ ] Can calculate success rate per template variant
- [ ] Thompson Sampling uses real success data

### ✅ Cost Tracking Operational
- [ ] Cost recorded per execution
- [ ] Can query: cost per template, cost per success
- [ ] Can identify expensive vs cheap activities
- [ ] Can calculate ROI per template variant

**Current Status**: 0/5 complete ❌

---

## Recommended Immediate Actions

### Action 1: Fix /record/start Bug (URGENT)
**Time**: 1-2 hours  
**Impact**: Unblocks entire pipeline

1. Find and fix backend bug in `/v2/activities/record/start`
2. Add test to verify execution record created (not template)
3. Re-enable call in activity_manager.py
4. Verify with test activity execution

### Action 2: Implement Basic Impulse Tracking (HIGH PRIORITY)
**Time**: 4 hours  
**Impact**: Enables learning loop

1. Create `execution_steps` table with impulse fields
2. Update activity_manager to call `/v2/activities/record/step`
3. Pass impulse IDs from session memory to activity manager
4. Verify impulse IDs appear in database

### Action 3: Link Sessions to Activities (MEDIUM PRIORITY)
**Time**: 2 hours  
**Impact**: Connects two data systems

1. Add `session_id` to activity_executions table
2. Update recording endpoints to accept session_id
3. Modify activity_manager to pass session_id
4. Write test query joining session → activity data

### Action 4: Add Success Validation (MEDIUM PRIORITY)
**Time**: 3 hours  
**Impact**: Enables success rate calculation

1. Define success criteria for bootstrap templates
2. Implement goal-based validation
3. Record validation results with outcomes
4. Build success rate query per template

### Action 5: Build Cost Analysis (LOW PRIORITY)
**Time**: 2 hours  
**Impact**: Visibility into optimization opportunities

1. Write SQL queries for cost analysis
2. Create simple report script
3. Document high-cost activities
4. Plan model downgrade experiments

**Total Time to Core Functionality**: ~12 hours (1-2 days focused work)

---

## Success Metrics

We can declare success when:

1. **Data Pipeline Works End-to-End**
   ```sql
   -- Can query recent activity executions
   SELECT * FROM activity_executions 
   WHERE started_at > NOW() - 1d
   ORDER BY started_at DESC;
   
   -- Returns real data with session_id, impulse tracking
   ```

2. **Learning Questions Answerable**
   ```sql
   -- Which impulses help activities succeed?
   SELECT impulse_id, 
          AVG(success) as success_rate,
          COUNT(*) as usage_count
   FROM execution_steps
   GROUP BY impulse_id
   ORDER BY success_rate DESC;
   ```

3. **Cost Visibility Achieved**
   ```sql
   -- Cost per template variant
   SELECT variant_id,
          COUNT(*) as executions,
          AVG(total_cost) as avg_cost,
          AVG(success) as success_rate,
          AVG(total_cost) / NULLIF(AVG(success), 0) as cost_per_success
   FROM activity_executions
   GROUP BY variant_id;
   ```

4. **Optimization Experiments Possible**
   - Can A/B test: Same activity with different context
   - Can measure: Impact of prompt changes on success/cost
   - Can optimize: Remove expensive, low-value steps

---

## Alignment with Original Goals

From user request:
> "We cannot consider this to be successful until we see this session's data alongside the other data related to the activity impulse system inside the database."

**Current Status**: ❌ **NOT ACHIEVED**

**Blockers**:
1. /record/start disabled - no execution records created
2. Impulse tracking not implemented - no impulse data in database
3. Session-activity linkage broken - cannot see session + activity data together

**Path to Success**: Complete Actions 1-3 above (7-8 hours work)

---

## Cost Optimization Insights

From user request:
> "It's a bit expensive to exist when we are running ourselves on sonnet for everything. Let's keep in mind that we are looking to optimize the instructions in such a way that we can decrease cost and token usage."

### Why We Can't Optimize Yet
Without execution data, we're **blind optimizing** - guessing what to change.

### With Data, We Can:
1. **Identify low-value tokens**
   - "This impulse is loaded 100 times but never used" → Remove
   - "This prompt section is 500 tokens but success rate unchanged without it" → Remove

2. **Identify high-value optimizations**
   - "Activities with <5 tasks succeed 95% on Haiku" → Downgrade model (10x savings)
   - "Step 3 always succeeds, doesn't need validation" → Skip validation (save tokens)

3. **Measure optimization impact**
   - Before: 90% success, $0.50 per execution
   - After: 89% success, $0.05 per execution
   - Decision: Accept 1% drop for 10x cost reduction

### Projected Savings (with data-driven optimization)
- **Model downgrade**: 60% cost reduction (high-success activities → Haiku)
- **Context pruning**: 20% token reduction (remove unused impulses)
- **Prompt optimization**: 10% token reduction (remove redundant instructions)
- **Caching**: 5% cost reduction (reuse expensive operations)

**Total Potential**: 70-80% cost reduction while maintaining success rate

**Current**: 0% optimization (no data to guide changes)

---

## Next Steps

### Immediate (This Session)
1. Review this gap analysis
2. Confirm priorities
3. Decide: Fix critical gaps now, or document for later?

### Short Term (Next 1-2 Days)
1. Fix /record/start bug
2. Implement impulse tracking
3. Link sessions to activities
4. Verify data pipeline with test activity

### Medium Term (Next 1-2 Weeks)
1. Collect execution data from real usage
2. Build cost analysis queries
3. Identify optimization opportunities
4. Run A/B tests on model/prompt changes

### Long Term (Next Month)
1. Automate optimization based on data
2. Implement variant evolution based on success patterns
3. Build self-improvement feedback loop
4. Achieve 70%+ cost reduction target

---

## Conclusion

**Status**: Activity execution works, but **learning and optimization are blocked** by data pipeline gaps.

**Critical Path**: 
1. Fix /record/start (1-2h)
2. Implement impulse tracking (4h)  
3. Link sessions to activities (2h)

**ROI**: 8 hours of work unblocks entire learning system and enables 70%+ cost reduction.

**Recommendation**: Prioritize completing the data pipeline before adding new features. Cannot optimize without data.

---

**Document Status**: Draft for review  
**Next Action**: User decision on priorities
