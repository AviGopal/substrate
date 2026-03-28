# Activity System Evolution - Documentation Index

**Created**: February 13, 2026  
**Purpose**: Complete guide to transforming the activity system into an intelligent, self-improving platform

---

## Executive Summary

The activity system evolution transforms static template execution into an intelligent system that learns from outcomes, selects optimal variants, and creates improved templates automatically. Expected ROI: **80% cost reduction** on routine tasks through workflow regularization.

---

## Documentation Structure

### 1. EVOLUTION_TARGET_STATE.md (Comprehensive Design)
**File**: `EVOLUTION_TARGET_STATE.md`  
**Length**: ~800 lines  
**Audience**: Engineers implementing the system

**Contents**:
- Strategic vision and cost analysis
- Complete 4-phase implementation plan
- Code examples for each phase
- Database schema evolution
- Risk mitigation strategies
- Timeline and success metrics

**When to read**: Before starting implementation, for complete understanding

---

### 2. EVOLUTION_QUICK_START.md (Executive Summary)
**File**: `EVOLUTION_QUICK_START.md`  
**Length**: ~300 lines  
**Audience**: Stakeholders, project managers, engineers needing overview

**Contents**:
- Vision in one diagram
- 4 phases at a glance
- Cost savings example
- Key technical decisions
- Quick reference for files to modify

**When to read**: For quick understanding or stakeholder presentations

---

### 3. EVOLUTION_ARCHITECTURE_VISUAL.md (Visual Guide)
**File**: `EVOLUTION_ARCHITECTURE_VISUAL.md`  
**Length**: ~500 lines  
**Audience**: Engineers and architects

**Contents**:
- System overview diagram
- End-to-end data flows
- Evolution flow (variant creation)
- Database schema progression
- Cost analysis (before/after)
- Monitoring dashboards

**When to read**: When implementing specific components, for visual understanding

---

### 4. This Document (EVOLUTION_INDEX.md)
**File**: `EVOLUTION_INDEX.md`  
**Purpose**: Navigation and context

---

## Quick Navigation by Role

### For Stakeholders
1. Read **EVOLUTION_QUICK_START.md** (10 minutes)
2. Review "Cost Savings Example" section
3. Check "Success Metrics Summary"

**Key Questions Answered**:
- What's the ROI?
- How long will it take?
- What are the risks?

---

### For Project Managers
1. Read **EVOLUTION_QUICK_START.md** (10 minutes)
2. Review **EVOLUTION_TARGET_STATE.md** "Implementation Priorities" section
3. Check "Timeline Summary" and "Risk Mitigation"

**Key Questions Answered**:
- What are the phases?
- What's the critical path?
- What are the dependencies?
- How do we measure success?

---

### For Architects
1. Read **EVOLUTION_ARCHITECTURE_VISUAL.md** (20 minutes)
2. Review **EVOLUTION_TARGET_STATE.md** "Architecture Evolution" section
3. Check **CORRECT_ARCHITECTURE_DESIGN.md** for context

**Key Questions Answered**:
- How do the systems interact?
- What's the data flow?
- Where does intelligence live?
- How does learning work?

---

### For Backend Engineers
1. Read **EVOLUTION_TARGET_STATE.md** Phase 1 (Data Collection)
2. Read Phase 2 (Variant Selection)
3. Read Phase 3 (Auto-Evolution)
4. Review **EVOLUTION_ARCHITECTURE_VISUAL.md** "Database Schema Evolution"

**Files to implement**:
- `server/v2_activities.py` - New endpoints
- `server/variant_selector.py` - Selection algorithm
- `server/variant_evolver.py` - Evolution logic
- `sql/schema.surql` - Database schema

---

### For Frontend Engineers (OpenCode)
1. Read **EVOLUTION_TARGET_STATE.md** Phase 1 (Outcome Reporting)
2. Read Phase 2 (Remove Caching)
3. Review **EVOLUTION_ARCHITECTURE_VISUAL.md** "Request Flow"

**Files to implement**:
- `packages/opencode/src/tool/activity.ts` - Outcome reporting
- `packages/opencode/src/session/template-loader.ts` - Remove caching
- `packages/opencode/src/metabob.ts` - MCP updates

---

### For CLI Engineers (Mediator)
1. Read **CORRECT_ARCHITECTURE_DESIGN.md** "Metabob-CLI Responsibilities"
2. Read **EVOLUTION_TARGET_STATE.md** Phase 4 (Impulse Integration)
3. Review **EVOLUTION_ARCHITECTURE_VISUAL.md** "Data Flow"

**Files to implement**:
- `src/metabob_cli/mcp/tools.py` - Outcome reporting tool
- `src/metabob_cli/mcp/activity_manager.py` - Execution tracking

---

## Phase-by-Phase Implementation Guide

### Phase 1: Data Collection (Week 1-2)
**Goal**: Capture execution outcomes for future learning

**Read**:
- EVOLUTION_TARGET_STATE.md → "Phase 1: Data Collection"
- EVOLUTION_ARCHITECTURE_VISUAL.md → "Database Schema Evolution → Phase 1"

**Implement**:
1. OpenCode: Add outcome reporting
2. Backend: Add POST /executions endpoint
3. Backend: Create execution_outcomes table
4. Backend: Auto-update variant metrics

**Success Criteria**:
- ✓ 100% of executions recorded
- ✓ Can query success rates
- ✓ Metrics update in real-time

**Estimated Effort**: 2 weeks

---

### Phase 2: Variant Selection (Week 3-4)
**Goal**: Backend selects optimal variant based on data

**Read**:
- EVOLUTION_TARGET_STATE.md → "Phase 2: Dynamic Variant Serving"
- EVOLUTION_ARCHITECTURE_VISUAL.md → "Request Flow"

**Implement**:
1. OpenCode: Remove template caching
2. Backend: VariantSelector class
3. Backend: Scoring algorithm
4. Backend: A/B testing (95% exploit, 5% explore)

**Success Criteria**:
- ✓ Backend serves different variants
- ✓ High-performers selected more often
- ✓ Can demonstrate A/B testing

**Estimated Effort**: 2 weeks

---

### Phase 3: Auto-Evolution (Week 5-6)
**Goal**: System creates new variants from successful patterns

**Read**:
- EVOLUTION_TARGET_STATE.md → "Phase 3: Variant Evolution"
- EVOLUTION_ARCHITECTURE_VISUAL.md → "Evolution Flow"

**Implement**:
1. OpenCode: Report actual steps taken
2. Backend: Divergence calculation
3. Backend: Pattern detection
4. Backend: Variant commissioning
5. Database: Genealogy tables

**Success Criteria**:
- ✓ System creates 1+ new variants
- ✓ Genealogy correctly tracked
- ✓ New variants available for selection

**Estimated Effort**: 2 weeks

---

### Phase 4: Impulse Integration (Week 7-8)
**Goal**: Templates remember which context led to success

**Read**:
- EVOLUTION_TARGET_STATE.md → "Phase 4: Impulse Integration"
- CORRECT_ARCHITECTURE_DESIGN.md → "Impulse Provenance"

**Implement**:
1. Proto: Add impulse_refs to TaskStep
2. OpenCode: Track impulse usage
3. Backend: Impulse effectiveness learning
4. Backend: Template optimization

**Success Criteria**:
- ✓ Templates specify impulse requirements
- ✓ Impulse usage tracked
- ✓ Can identify high-value impulses

**Estimated Effort**: 2 weeks

---

## Key Concepts

### Multi-Armed Bandit
**What**: Algorithm for balancing exploration vs exploitation  
**Why**: Need to try new variants (explore) while using best known (exploit)  
**How**: 95% of requests use best variant, 5% use random for learning

**Read**: EVOLUTION_TARGET_STATE.md → "Phase 2: Variant Selection Algorithm"

---

### Variant Commissioning
**What**: Automatic creation of new template variants  
**Why**: System learns from successful deviations  
**How**: Detect patterns (3+ similar divergences) → Create new variant

**Read**: EVOLUTION_ARCHITECTURE_VISUAL.md → "Evolution Flow"

---

### Impulse Provenance
**What**: Tracking which context (impulses) led to successful outcomes  
**Why**: Templates should load proven helpful context  
**How**: Track impulse usage → Learn effectiveness → Optimize templates

**Read**: CORRECT_ARCHITECTURE_DESIGN.md → "Impulse Provenance"

---

### Genealogy Tracking
**What**: Content-addressable ancestry of template variants  
**Why**: Understand how templates evolved, rollback if needed  
**How**: Store content hash, parent hash, evolution reason

**Read**: EVOLUTION_TARGET_STATE.md → "Phase 3: Genealogy Tracking"

---

## Supporting Documents

### Historical Context
- **CURRENT_STATUS_ACTIVITY_SYSTEM.md** - Current state as of Feb 12
- **ACTIVITY_EXECUTION_FINAL_STATUS_FEB12.md** - Recent work completed
- **ARCHITECTURE_ALIGNMENT_PLAN.md** - Earlier planning (superseded)
- **CORRECT_ARCHITECTURE_DESIGN.md** - Core architectural principles

### Technical References
- **ACTIVITY_SYSTEM_QUICK_START.md** - How the current system works
- **ACTIVITY_SYSTEM_DEMONSTRATION.md** - Working examples
- **DATA_FLOW_ANALYSIS_FEB12.md** - System behavior analysis

---

## FAQ

### Q: Why remove OpenCode caching?
**A**: Backend needs control over which variant is served. Caching defeats dynamic selection. Each request should get the currently-optimal variant based on latest data.

**See**: EVOLUTION_TARGET_STATE.md → "Phase 2: Remove Local Caching"

---

### Q: How do we prevent bad auto-generated variants?
**A**: Multiple safety measures:
1. Only commission from successful executions
2. Require pattern (3+ similar divergences)
3. Manual review before activation
4. Sandbox testing environment
5. Gradual rollout (1% traffic first)

**See**: EVOLUTION_TARGET_STATE.md → "Risk Mitigation → Risk 3"

---

### Q: What if variant selection adds too much latency?
**A**: 
1. Cache variant scores (5 minute TTL)
2. Pre-compute scores for top variants
3. Timeout fallback to default variant
4. Expected overhead: < 50ms

**See**: EVOLUTION_TARGET_STATE.md → "Risk Mitigation → Risk 2"

---

### Q: How long to see ROI?
**A**: 
- Phase 1-2 (4 weeks): Basic intelligence, immediate cost savings start
- Phase 3-4 (8 weeks): Full self-improvement, maximum ROI
- Expected: 50-80% cost reduction on routine tasks

**See**: EVOLUTION_QUICK_START.md → "Cost Savings Example"

---

### Q: Can we implement phases out of order?
**A**: No. Each phase depends on previous:
- Phase 2 needs Phase 1 data
- Phase 3 needs Phase 2 selection
- Phase 4 needs Phase 3 evolution

**Critical path**: Must do Phase 1 → Phase 2 for MVP

**See**: EVOLUTION_TARGET_STATE.md → "Implementation Priorities"

---

## Success Metrics at a Glance

| Metric | Target | Phase |
|--------|--------|-------|
| Outcome capture rate | 100% | 1 |
| Variant selection working | Different variants served | 2 |
| Exploration rate | 5% of requests | 2 |
| Cost reduction | 50-80% on routine tasks | 2+ |
| Auto-variants created | 1+ per week | 3 |
| Genealogy accuracy | 100% | 3 |
| Impulse usage tracked | 100% of executions | 4 |
| Impulse optimization | Remove 20% unused | 4 |

---

## Timeline Summary

```
Week 1-2: Phase 1 - Data Collection (Foundation)
  ├─ OpenCode: Outcome reporting
  ├─ Backend: Database schema
  └─ Backend: Metrics tracking

Week 3-4: Phase 2 - Variant Selection (Intelligence)
  ├─ OpenCode: Remove caching
  ├─ Backend: Selection algorithm
  └─ Backend: A/B testing

Week 5-6: Phase 3 - Auto-Evolution (Self-Improvement)
  ├─ OpenCode: Report actual steps
  ├─ Backend: Pattern detection
  └─ Backend: Variant commissioning

Week 7-8: Phase 4 - Impulse Integration (Context Intelligence)
  ├─ Proto: Impulse provenance
  ├─ OpenCode: Usage tracking
  └─ Backend: Impulse learning

Total: 8 weeks to full intelligent system
MVP (Phases 1-2): 4 weeks to working variant selection
```

---

## Getting Started

### For Your First Task
1. Determine your role (Backend/Frontend/CLI/Architect)
2. Read the documents recommended for your role (see "Quick Navigation by Role")
3. Review the phase you'll be implementing
4. Check "Files to implement" in that phase
5. Start coding!

### For Your First Review
1. Read **EVOLUTION_QUICK_START.md** (10 min)
2. Review **EVOLUTION_ARCHITECTURE_VISUAL.md** diagrams (15 min)
3. Skim **EVOLUTION_TARGET_STATE.md** for your phase (20 min)
4. Ask questions!

---

## Contact and Questions

**For architectural questions**: Review CORRECT_ARCHITECTURE_DESIGN.md  
**For implementation details**: Review EVOLUTION_TARGET_STATE.md  
**For visual understanding**: Review EVOLUTION_ARCHITECTURE_VISUAL.md  
**For quick answers**: Review this document's FAQ section

---

**Status**: Documentation complete, ready for implementation  
**Next**: Team review and approval  
**Timeline**: 8 weeks (MVP in 4 weeks)  
**Expected ROI**: 80% cost reduction on routine tasks

---

*This index was created on February 13, 2026 as part of the activity system evolution planning.*
