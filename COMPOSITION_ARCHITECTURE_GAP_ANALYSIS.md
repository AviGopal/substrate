# Composition Architecture Gap Analysis

**Date:** 2026-04-16
**Status:** Documentation Updated, Implementation Pending

## Executive Summary

MiniBob's goal processor currently uses **branching architecture** with explicit separation between activity execution and improvisation. The desired vision is **composition-based**: everything should be an activity, selected and composed through impulse shapes.

**Key Finding:** All components exist (activity tool, composition engine, shape-based routing) but are used inconsistently. Goal processor contains branching logic instead of treating improvisation as an activity.

**Impact:** Could reduce goal processor from 7,608 → ~4,500 lines (40% reduction) while increasing learning coverage.

---

## Current vs. Desired Architecture

### Current (Branching)

```typescript
parseGoal()
  ↓
isSimpleGoal()?
  ├─ YES → Improvise (2-4 turns max)
  └─ NO  → Template search → Execute → Accumulate impulses → Repeat OR Improvise
```

**Issues:**
- Branching between activities and improvisation
- Goal processing is special-cased code
- Improvisation results not in Thompson Sampling
- Composition edges not learned

### Desired (Composition)

```typescript
while (!goalAchieved && turns < maxTurns) {
  const recommendations = await getRecommendations(goal, currentShapes);
  for (const rec of recommendations) {
    const execution = await executor.execute(rec.template);
    updateShapes(execution.outputs);
    if (checkGoalAchieved()) break;
  }
}
```

**Benefits:**
- Single unified path for all goals
- Improvisation is an activity template
- All executions feed Thompson Sampling
- Composition learned from traces

---

## Gap Analysis

### What Exists ✅

| Feature | Location | Status |
|---------|----------|--------|
| Activity tool (improviser can call activities) | `improviser.ts:165` | ✅ Works but optional |
| Composition engine | `composition/engine.ts` | ✅ Exists but unused |
| Shape-based routing concept | `state-space-manager.ts` | ✅ Partial implementation |
| Activity recommendation from backend | `goal-processor.ts:~5300` | ✅ Works with Thompson |
| Template extraction (ribosome) | `template-generator.ts` | ✅ Can extract from improvisation |

### What's Missing ❌

| Feature | Gap | Impact |
|---------|-----|--------|
| **Activity resolver** | Can't resolve `{type: "activity"}` impulses | Can't compose activities through impulses |
| **Improvisation as activity** | Improvise is special code path, not a template | Improvisation results not in Thompson Sampling |
| **Composition edge learning** | Edges exist but not recorded/learned from traces | No learning of activity sequences |
| **Goal as activity** | Goal processing special-cased | Goals treated differently from other activities |
| **Activity tool in standard tools** | Only available during improvisation | Can't call activities in deterministic flows |

---

## Files That Need Refactoring

### 1. Goal Processor (`goal-processor.ts` - 7,608 lines)

**Remove branching logic:**
- Lines 1192-1198: `isSimpleDiagnostic` - Just treat as normal goal
- Lines 6200-6360: Simple goal special case - Remove, let recommendation system handle
- Lines 6513-6530: "improvise" special handling - Make it a normal recommendation
- Lines 6838+: `recommendedApproach === "improvise"` - Remove pre-flight improvise routing

**Consolidate to unified loop:**
- Lines 6378-7350: Main activity loop logic should be THE ONLY path

**Estimated impact:** Could reduce from 7,608 to ~4,500 lines (40% reduction)

### 2. Improviser (`improviser.ts` - 1,682 lines)

**Keep as-is, but wrap as activity:**
- Currently: Separate execution path called from goal-processor
- Should become: ActivityExecutor for "improvisation" activity templates

**Minimal changes:** Wire differently, track composition edges

### 3. Activity Executor (`activity.ts` - 4,436 lines)

**Add composition recording:**
- When executing nested activities, record edges
- Lines ~2000-2500: Task execution loop should emit composition edge events

**Add activity resolver:**
- New resolver for `{type: "activity", id: "activity-id"}` pointers

**Minimal changes:** ~200 lines new code, refactor existing ~500 lines

### 4. New Files Needed

- **`activity-resolver.ts`** (~150 lines) - Resolve activity impulses
- **`ribosome-activity.ts`** (~200 lines) - Define improvisation activity template
- **Refactored goal processor main loop** (~200 lines) - Unified executor

---

## Migration Path

### Phase 1: Add Missing Components (Low Risk, 2-3 weeks)

**Deliverables:**
1. ✅ **Meta-activity templates** (DONE)
   - `goal_processing_standard.json` - Orchestrator
   - `goal_analysis.json` - Semantic analysis
   - `activity_recommendation.json` - Thompson Sampling query
   - `improvise_solution.json` - LLM improvisation
   - `goal_verification.json` - Verification

2. **Activity resolver** (`activity-resolver.ts`)
   - Enables `{type: "activity"}` impulses
   - Activities can call other activities via impulses
   - No changes to goal processor yet

3. **Shape tracking in activity executor**
   - Output shapes collected from task results
   - Passed back to goal processor
   - Goal processor tracks state space evolution

**Risk:** Low - Additive only, no removal

### Phase 2: Consolidate Goal Processor (Medium Risk, 3-4 weeks)

**Deliverables:**
1. Remove simple goal special case (lines 6200-6360)
2. Remove "improvise" special handling (line 6514)
3. Consolidate to unified activity execution loop
4. Update tests

**Risk:** Medium - Changes main execution path

### Phase 3: Learning from Composition (Low Risk, 1-2 weeks)

**Deliverables:**
1. Record composition edges when activities call activities
2. Query composition engine in recommendation phase
3. Thompson Sampling learns activity chains
4. Dashboard visualization of composition patterns

**Risk:** Low - Additive learning layer

---

## Current Decision Points vs. Desired Behavior

| Current | Line | Desired | Impact |
|---------|------|---------|--------|
| `isSimpleGoal()` branching | 6203 | Remove - all goals same | -~150 lines |
| Special "improvise" template_id | 6514 | Same as other activities | -~200 lines |
| Pre-flight approach recommendation | 2440 | Use Thompson recommendations | -~300 lines |
| Separate `improviseUntilComplete()` | 4454 | Activity executor handles it | Consolidate to 1 path |
| Orchestration special case | 6131 | Normal composition query | -~150 lines |

**Total reduction:** ~800-1,000 lines

---

## Composition Flow (Implemented in Templates)

```
goal_processing_standard (orchestrator)
├─> goal_analysis
│   └─> Output: goal_enrichment impulse
│
├─> activity_recommendation
│   ├─> Input: goal_enrichment
│   └─> Output: activity_recommendations impulse
│
├─> execute_recommended (LLM task)
│   ├─> Input: activity_recommendations
│   └─> Attempts execution of ranked activities
│       └─> Output: execution_result impulse
│
├─> improvise_solution (conditional)
│   ├─> Triggered if: execution_result.status == 'improvise_needed'
│   ├─> Tasks:
│   │   ├─> plan_approach (LLM)
│   │   ├─> execute_improvisation (LLM with full tools)
│   │   └─> extract_template (ribosome resolver)
│   └─> Output: improvisation_result + activity_template impulse
│
└─> goal_verification
    ├─> Input: goal_enrichment + execution_result
    └─> Output: goal_verification impulse
```

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Meta-activity templates created and validated
- [ ] Activity resolver implemented and tested
- [ ] Shape tracking added to activity executor
- [ ] Templates loadable and executable
- [ ] No changes to goal processor branching logic yet

### Phase 2 Complete When:
- [ ] All goals processed through unified activity loop
- [ ] No `if (simplicity.simple)` branching
- [ ] No `if (template_id === "improvise")` special cases
- [ ] No separate `improviseUntilComplete()` calls
- [ ] Goal processor reduced to ~4,500 lines

### Phase 3 Complete When:
- [ ] Improvisation produces activities (extracted templates)
- [ ] Extracted templates recommended by Thompson Sampling
- [ ] Activities compose other activities (nested execution)
- [ ] Composition edges recorded and learned
- [ ] Dashboard shows activity chains

---

## Risk Mitigation

### Risk: Simple goals may degrade
**Mitigation:** Ensure simple goal templates have good Thompson scores before removing branching

### Risk: Activity tool may create infinite loops
**Mitigation:** Improviser should avoid recommending same activity twice in one execution

### Risk: Composition edges may not record correctly
**Mitigation:** Add assertions in activity executor for edge recording

### Risk: Goal processor initialization depends on recommendations
**Mitigation:** Keep fallback to improvisation if recommendations empty

---

## Next Steps

1. **Immediate (Phase 1):**
   - [ ] Implement `activity-resolver.ts`
   - [ ] Add shape tracking to `activity.ts`
   - [ ] Load and test meta-activity templates
   - [ ] Integration tests for template execution

2. **Near-term (Phase 2):**
   - [ ] Refactor goal processor main loop
   - [ ] Remove branching logic incrementally
   - [ ] Update all tests
   - [ ] Validate against existing test suite

3. **Future (Phase 3):**
   - [ ] Add composition edge recording
   - [ ] Implement composition engine queries
   - [ ] Dashboard visualization
   - [ ] Thompson Sampling for composition patterns

---

## Related Documentation

- **Sequence Diagrams:** `docs/architecture/sequences/` (Updated 2026-04-16)
- **Meta-Activity Templates:** `repos/minibob/activities/meta/` (Created 2026-04-16)
- **Foundation:** `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **Composition:** `docs/architecture/IMPULSE_DRIVEN_COMPOSITION.md`

---

**Status:** Phase 1 in progress (templates created, resolver implementation pending)

**Estimated total effort:** 6-9 weeks for all 3 phases

**Estimated LOC reduction:** ~1,160 net reduction (new resolvers offset by removed branching)
