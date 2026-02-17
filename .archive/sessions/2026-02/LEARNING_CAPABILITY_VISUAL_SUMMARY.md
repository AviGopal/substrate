# Learning System Capability - Visual Summary

**Date**: February 17, 2026  
**Status**: 🟡 70% Complete - Infrastructure Ready, Data Collection Broken

---

## System Architecture: Current State

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER SESSION                                 │
│  Agent executes activities, uses tools, modifies files              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    EXECUTION TRACKING                               │
│                                                                     │
│  ✅ Activity ID: demo-315bfaf1                                     │
│  ✅ Execution ID: exec_xyz123                                      │
│  ✅ Success: true                                                  │
│  ✅ Duration: 45s, Cost: $0.03, Tokens: 8500                       │
│  ✅ Files Changed: src/auth.ts, src/utils.ts                       │
│  ❌ Impulses: [] (EMPTY - THIS IS THE PROBLEM)                     │
│                                                                     │
│  Database: 102 executions recorded, 0 impulses tracked             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     LEARNING PIPELINE                               │
│                                                                     │
│  Pattern Detection:                                                 │
│    ❌ BLOCKED - Requires impulse data                              │
│    Code: variant_commissioning.py (exists, never runs)             │
│                                                                     │
│  Variant Commissioning:                                             │
│    ❌ BLOCKED - Pattern detection never triggers                   │
│    Logic: Check 3+ similar executions → Create variant             │
│                                                                     │
│  Impulse Effectiveness:                                             │
│    ❌ BLOCKED - No usage data to analyze                           │
│    Tables: impulse_registry (0 entries)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    TEMPLATE EVOLUTION                               │
│                                                                     │
│  Trailblazing Variants:                                             │
│    ✅ WORKING - Creates variants from failure recovery             │
│    Source: Task failures → Recovery → New variant                  │
│                                                                     │
│  Pattern-Based Variants:                                            │
│    ❌ BLOCKED - Never created (no pattern detection)               │
│    Source: Similar executions → Detect pattern → New variant       │
│                                                                     │
│  Thompson Sampling:                                                 │
│    ✅ WORKING - Selects best variant from pool                     │
│    Limited pool: Only trailblazing variants available              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Learning Capabilities: Status Matrix

### Execution-Based Learning

```
┌──────────────────────────────────────────┬──────────┬──────────┬─────────┐
│ Capability                               │ Impl.    │ Func.    │ Blocker │
├──────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ Record execution outcomes                │    ✅    │    ✅    │   ---   │
│ Track success/failure                    │    ✅    │    ✅    │   ---   │
│ Track cost/duration/tokens               │    ✅    │    ✅    │   ---   │
│ Track file changes                       │    ✅    │    ✅    │   ---   │
│ Track component changes                  │    ✅    │    ✅    │   ---   │
│ Track impulse usage                      │    ✅    │    ❌    │ No data │
│ Detect impulse patterns                  │    ✅    │    ❌    │ No data │
│ Calculate effectiveness                  │    ✅    │    ❌    │ No data │
│ Commission pattern variants              │    ✅    │    ❌    │ No data │
│ Commission failure variants              │    ✅    │    ✅    │   ---   │
│ Thompson Sampling selection              │    ✅    │    ✅    │   ---   │
└──────────────────────────────────────────┴──────────┴──────────┴─────────┘

Legend: Impl. = Implemented, Func. = Functional
```

### Session-Based Learning

```
┌──────────────────────────────────────────┬──────────┬──────────┬─────────┐
│ Capability                               │ Impl.    │ Func.    │ Status  │
├──────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ Record user sessions                     │    ✅    │    ✅    │ Working │
│ Track tool sequences                     │    ✅    │    ✅    │ Working │
│ Analyze tool sequences                   │    ❌    │    ❌    │ Missing │
│ Detect repeated patterns                 │    ❌    │    ❌    │ Missing │
│ Generate template suggestions            │    ❌    │    ❌    │ Missing │
│ Convert session to template              │    ❌    │    ❌    │ Missing │
│ User confirmation workflow               │    ❌    │    ❌    │ Missing │
└──────────────────────────────────────────┴──────────┴──────────┴─────────┘

Note: Configuration exists, but no implementation code found
```

---

## The Break Point: Impulse Data Flow

### Where It Breaks

```
┌─────────────────┐
│  OpenCode       │  Has impulses in session memory
│  Session Memory │  {id, type, pointer, tokens}
└────────┬────────┘
         │
         │ ❌ Not extracted
         ↓
┌─────────────────┐
│  Activity Tool  │  Calls MCP without impulses
│  (activity.ts)  │  Missing: sessionManager.getImpulses()
└────────┬────────┘
         │
         │ ❌ Not passed
         ↓
┌─────────────────┐
│  CLI MCP        │  start_execution() doesn't accept impulses
│  Activity Mgr   │  Missing: impulses parameter
└────────┬────────┘
         │
         │ ❌ Empty array
         ↓
┌─────────────────┐
│  Backend API    │  Receives impulses_used: []
│  Record Endpoint│  Stores empty array in database
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Database       │  impulse_registry: 0 entries
│  SurrealDB      │  impulse_usage: 0 entries
└─────────────────┘
```

### How It Should Flow

```
┌─────────────────┐
│  OpenCode       │  Extract impulses from memory
│  Session Memory │  sessionManager.getImpulses()
└────────┬────────┘
         │
         │ ✅ Pass as parameter
         ↓
┌─────────────────┐
│  Activity Tool  │  Include impulses in MCP call
│  (activity.ts)  │  activityManager.start_execution(..., impulses)
└────────┬────────┘
         │
         │ ✅ Accept parameter
         ↓
┌─────────────────┐
│  CLI MCP        │  Store impulses in execution state
│  Activity Mgr   │  execution.impulses_available = impulses
└────────┬────────┘
         │
         │ ✅ Send to backend
         ↓
┌─────────────────┐
│  Backend API    │  Process impulses_used array
│  Record Endpoint│  Update impulse_registry & impulse_usage
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Database       │  impulse_registry: 50+ entries
│  SurrealDB      │  impulse_usage: 100+ entries
└─────────────────┘
         │
         ↓
┌─────────────────┐
│  Learning       │  Pattern detection triggers
│  Pipeline       │  Variant commissioning works
└─────────────────┘
```

---

## Pattern Detection Logic

### Current State: Dormant

```python
# File: variant_commissioning.py

async def should_commission_variant(db, execution_data) -> bool:
    """Triggers when 3+ similar executions detected"""
    
    # Step 1: Check success
    if not execution_data.get("success"):
        return False  # ✅ Works
    
    # Step 2: Check impulses
    impulses_used = execution_data.get("impulses_used", [])
    if not impulses_used:
        return False  # ❌ ALWAYS RETURNS HERE (no impulse data)
    
    # Step 3: Check divergence (NEVER REACHED)
    template_impulses = set(...)
    execution_impulses = set(...)
    divergence = len(execution_impulses - template_impulses) / ...
    
    if divergence < 0.3:
        return False
    
    # Step 4: Check pattern (NEVER REACHED)
    similar_count = await count_similar_executions(...)
    if similar_count >= 3:
        logger.info("Pattern detected!")
        return True  # Would trigger variant commissioning
    
    return False
```

### How It Should Work

```
Execution 1: Fix auth bug
  Impulses: [codebase-scan, bug-report, test-results]
  Success: true

Execution 2: Fix auth bug (similar)
  Impulses: [codebase-scan, bug-report, test-results]
  Success: true

Execution 3: Fix auth bug (similar)
  Impulses: [codebase-scan, bug-report, test-results]
  Success: true
  
  ↓ Pattern Detection Triggers
  
  - 3+ executions with 80%+ impulse overlap
  - All successful
  - Impulses diverge from template
  
  ↓ Auto-Commission Variant
  
  New Variant Created:
    ID: demo-315bfaf1-a7b3c2d4
    Name: auto-a7b3c2d4
    Impulses: [codebase-scan, bug-report, test-results] (learned)
    Genealogy: PATTERN_LEARNING from 3 executions
    
  ↓ Added to Thompson Sampling Pool
  
  Future executions will prefer this variant
```

---

## Trailblazing vs Pattern Learning

### Trailblazing (Works) ✅

```
Activity Execution
  ↓
Task 3 Fails: "Test failed - validation error"
  ↓
Trailblazing Recovery:
  - Generate continuation prompt
  - Agent fixes issue
  - Recovery steps captured
  ↓
Create Variant:
  - Copy base template
  - Add recovery steps to Task 3
  - Genealogy: FAILURE_RECOVERY
  ↓
Save Variant:
  - ID: demo-315bfaf1-trailblazed-abc123
  - Success: Future executions skip the failure
```

**Evidence**: System creates these (code in `trailblazing-executor.ts`)

### Pattern Learning (Broken) ❌

```
Activity Execution #1
  Impulses: [A, B, C] (but not recorded)
  Success: true
  ↓
Activity Execution #2
  Impulses: [A, B, C] (but not recorded)
  Success: true
  ↓
Activity Execution #3
  Impulses: [A, B, C] (but not recorded)
  Success: true
  ↓
Pattern Detection:
  ❌ NEVER TRIGGERS (no impulse data)
  ↓
Variant Commission:
  ❌ NEVER HAPPENS
```

**Evidence**: 0 pattern-learned variants in database (102 executions)

---

## Fix Priority: Cost-Benefit Analysis

### Option A: Fix Impulse Tracking

**Effort**: 1 week (8 hours implementation, 32 hours validation)

**Unlocks**:
- ✅ Pattern detection (already coded)
- ✅ Variant commissioning (already coded)
- ✅ Impulse effectiveness tracking
- ✅ Thompson Sampling with learned variants
- ✅ Cost optimization (remove unhelpful impulses)

**ROI**: High - Fixes existing code, enables learning loop

### Option B: Build Session Analysis

**Effort**: 2-3 weeks (80-120 hours)

**Unlocks**:
- ✅ Session tool sequence analysis
- ✅ Pattern recognition from user actions
- ✅ Template generation suggestions
- ✅ User confirmation workflow

**ROI**: Medium - New feature, unclear usage frequency

### Option C: Do Both (Recommended Sequence)

**Week 1**: Fix impulse tracking (Option A)
- Immediate value
- Validates learning pipeline
- Quick win

**Week 2-4**: Build session analysis (Option B)
- Now learning loop works
- Session data can feed pattern detection
- Compound benefits

---

## Evidence Summary

### Database State

```sql
-- Executions tracked
SELECT COUNT() FROM activity_executions;
-- Result: 102 executions

-- Impulses tracked
SELECT COUNT() FROM impulse_registry;
-- Result: 0 impulses

-- Impulse usage
SELECT execution_id, array::len(impulses_used) 
FROM activity_executions 
LIMIT 10;
-- Result: All have impulses_used = []
```

### Code State

```bash
# Pattern detection code exists
find . -name "variant_commissioning.py"
# Result: repos/metabob-rpc-api/server/actions/variant_commissioning.py

# Trailblazing code exists
find . -name "trailblazing-executor.ts"
# Result: repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts

# Session analysis code?
find . -name "*session*analyzer*.ts"
# Result: (none found)
```

### Documentation State

```bash
ls -1 *LEARNING*.md
# ACTIVITY_LEARNING_GAP_ANALYSIS.md (Feb 13) - Identified gaps
# ACTIVITY_LEARNING_FIX_PLAN.md (Feb 15) - Proposed fixes
# LEARNING_SYSTEM_ASSESSMENT_FEB17.md (Feb 17) - This assessment
```

---

## Next Steps: Action Items

### Immediate (This Week)

1. **Review This Assessment** (1 hour)
   - Confirm findings
   - Validate recommendations
   - Decide on Option A vs B vs C

2. **Fix Impulse Tracking** (8 hours)
   - Update OpenCode activity tool
   - Update CLI activity manager
   - Test end-to-end flow

3. **Validate Pattern Detection** (4 hours)
   - Run 5 similar executions
   - Verify pattern detection triggers
   - Confirm variant commissioning

### Short Term (Next 2 Weeks)

1. **Monitor Learning Loop** (ongoing)
   - Track impulse registry growth
   - Monitor variant creation
   - Measure effectiveness improvements

2. **Document Learnings** (2 hours)
   - Update gap analysis
   - Create examples
   - Write best practices

3. **Decide on Session Analysis** (1 hour)
   - Evaluate ROI
   - Prioritize vs other features
   - Plan implementation if approved

### Long Term (Month 2+)

1. **Session Analysis** (if approved)
   - Implement sequence detection
   - Build template generation
   - Create user workflow

2. **Optimization** (ongoing)
   - Analyze impulse effectiveness
   - Remove low-value impulses
   - Optimize prompt sizes
   - Reduce costs

---

## Success Criteria

### Phase 1: Impulse Tracking (Week 1)
- [ ] 10+ executions with impulse data
- [ ] 50+ impulse_registry entries
- [ ] impulse_usage records created
- [ ] Pattern detection triggered at least once

### Phase 2: Pattern Learning (Week 2)
- [ ] First pattern-learned variant created
- [ ] Variant shows in Thompson Sampling
- [ ] Variant selected and executed
- [ ] Success rate improvement measured

### Phase 3: Session Analysis (Week 4-6, if approved)
- [ ] Session analyzer implemented
- [ ] Pattern detector working
- [ ] Template generator functional
- [ ] User confirmation flow complete
- [ ] First user-confirmed template created

---

## Conclusion

**Current State**: 70% Complete
- Infrastructure: ✅ Built
- Data Collection: ❌ Broken
- Learning Loop: ❌ Blocked

**Blocker**: Impulse data not flowing through pipeline

**Quick Fix**: 8 hours to fix impulse tracking

**Impact**: Unlocks pattern detection, variant commissioning, effectiveness tracking

**Recommendation**: Fix impulse tracking first (high ROI), then evaluate session analysis

---

**Assessment Complete**  
**Date**: February 17, 2026  
**Ready for**: Decision and implementation
