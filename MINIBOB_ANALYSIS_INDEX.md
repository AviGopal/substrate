# Minibob Architecture Analysis - Document Index

This analysis inspects the minibob library and metabob-activity-api to understand the current implementation state and identify gaps relative to the stated goals of a ribosome-style self-optimizing learning system.

## Documents

### 1. [MINIBOB_INSPECTION_SUMMARY.md](MINIBOB_INSPECTION_SUMMARY.md)
**Purpose:** Executive summary and comprehensive overview  
**Contents:**
- System architecture overview
- Flow analysis (direct vs integrated modes)
- Critical gaps identification
- Backend infrastructure review
- Recommendations with priorities

**Read this first** for a complete understanding.

---

### 2. [MINIBOB_ARCHITECTURE_GAP_ANALYSIS.md](MINIBOB_ARCHITECTURE_GAP_ANALYSIS.md)
**Purpose:** Detailed technical gap analysis  
**Contents:**
- Ribosome analogy mapping (ideal vs current)
- Component-by-component gap analysis:
  - Activity system gaps
  - Impulse system gaps
  - Tool system gaps
  - Goal processing gaps
  - Boredom system gaps
- Missing database tables (SQL schemas)
- Implementation roadmap (6 phases)

**Read this** for deep technical details and missing infrastructure.

---

### 3. [MINIBOB_ARCHITECTURE_VISUAL.md](MINIBOB_ARCHITECTURE_VISUAL.md)
**Purpose:** Visual diagrams and flow charts  
**Contents:**
- Current vs Ideal execution flow diagrams
- Execution graph evolution visualizations
- Impulse learning progression examples
- Variant evolution lifecycle
- Tool tracking flow comparison
- Summary comparison table

**Read this** for visual understanding of the gaps.

---

## Key Findings Summary

### ✅ What Works Well

1. **Activity Execution Engine**
   - Template loading and task execution
   - Variable substitution (including impulse references)
   - Task dependency resolution
   - Nested activity support

2. **Impulse System Foundation**
   - Pointer types: memo, file, activityOutput, custom
   - Lazy loading with token budgets
   - Backend storage for cross-execution access

3. **Thompson Sampling**
   - Activity recommendation based on historical success
   - Bayesian parameter updates (α, β)
   - Redis caching for performance

4. **Backend Integration**
   - MCP protocol communication
   - Execution metrics reporting
   - Template registry

5. **Boredom Infrastructure**
   - Task polling mechanism
   - Idle detection
   - Execution reporting

### ❌ Critical Missing Pieces

1. **No Activity Composition Graph**
   - Activities call each other but relationships not tracked
   - No graph edges, no weights
   - Cannot learn "activity A usually needs activity B"

2. **No Impulse Relevance Learning**
   - All impulses loaded every time
   - No tracking of which ones correlate with success
   - Wastes 30-50% of tokens on irrelevant context

3. **No Tool Call Tracking**
   - Tool calls execute but not stored as impulses
   - Next tasks cannot reference previous tool results
   - No learning of vessel requirements

4. **No Execution Sequence Learning**
   - Each goal execution recorded individually
   - No linking of activities that run together
   - No path learning (must always trial-and-error)

5. **No Goal → Path Planning**
   - Recommendations are single-step only
   - No multi-step planning from historical sequences
   - Thompson Sampling on activities, not paths

6. **No Autonomous Variant Creation**
   - Variants created manually
   - Boredom system has no task generation logic
   - No split/merge/debug based on metrics

---

## The Ribosome Analogy

The stated goal is a system that works like biological ribosomes:

| Biological System | Minibob Equivalent | Current State |
|-------------------|-------------------|---------------|
| Ribosome (executor) | Activity template | ✅ Implemented |
| mRNA (instructions) | Template definition | ✅ Implemented |
| tRNA (data carriers) | Impulses | ✅ Implemented |
| Amino acids (building blocks) | Tasks | ✅ Implemented |
| Protein synthesis (sequences) | Activity composition | ⚠️ Works but not learned |
| Natural selection | Thompson Sampling | ✅ Single-step only |
| Gene regulation | Impulse budgets | ⚠️ Fixed, not learned |
| Metabolic pathways | Execution graphs | ❌ Not tracked |
| Mutations | Variants | ❌ Manual only |

**Bottom Line:** You have ribosomes that execute. You're missing the feedback loops that enable evolution.

---

## Data Flow: Direct vs Integrated

### Direct Mode (Standalone)
```
Goal → GoalProcessor → Backend Recommendation → ActivityExecutor → LLM → Tools → Results
                ↓                                                                  ↓
         (Thompson Sampling)                                              (Report Metrics)
```

### Integrated Mode (OpenCode)
```
OpenCode Session → MinibobIntegration.submitGoal() → Same as Direct Mode
        ↓                                                      ↓
  (Provides LLM config, MCP tools)                  (UI callbacks, logging)
```

**Key Insight:** Both modes share the same backend, so learning benefits both.

---

## Missing Database Tables

To close the learning loops, these tables need to be created:

```sql
-- Track which activities compose together
activity_composition_graph (
  parent_activity_id,
  child_activity_id,
  execution_count,
  weight  -- Learned probability
)

-- Learn which impulses matter
impulse_relevance_metrics (
  impulse_id,
  activity_variant_id,
  relevance_score  -- P(success | impulse present)
)

-- Track execution sequences for goals
execution_sequences (
  goal_id,
  sequence,  -- [activity1, activity2, ...]
  outcome
)

-- Learn optimal paths for goal types
goal_execution_paths (
  goal_signature,
  successful_sequences,
  optimal_sequence
)

-- Learn which tools activities need
tool_usage_patterns (
  activity_variant_id,
  tool_name,
  usage_probability
)
```

---

## Implementation Priority

### Phase 1: Close Learning Loops (High Impact, 4-6 weeks)
1. Activity composition graph tracking
2. Impulse relevance learning
3. Tool call tracking as impulses

**Impact:** 50% token savings, predictable execution, vessel requirement checks

### Phase 2: Sequence Learning (Medium Impact, 3-4 weeks)
4. Execution sequence tracking
5. Goal path learning

**Impact:** Multi-step planning, 10x faster goal completion

### Phase 3: Autonomous Improvement (Long-term, 5-6 weeks)
6. Boredom task generation
7. Preemptive execution

**Impact:** Self-improvement, instant responses

---

## Files Analyzed

### Minibob Library (repos/minibob)
- `src/goal-processor.ts` - Goal parsing and execution loop
- `src/activity.ts` - Activity execution engine  
- `src/impulse.ts` - Impulse storage and resolution
- `src/mcp.ts` - Backend communication
- `src/boredom.ts` - Boredom task executor
- `src/tools.ts` - Built-in tools
- `ARCHITECTURE.md` - Vessel philosophy
- `README.md` - Usage documentation

### Activity API (repos/metabob-activity-api)
- `src/routes/activities.ts` - Template and execution endpoints
- `src/routes/impulses.ts` - Impulse storage endpoints
- `src/models/schemas.ts` - Data schemas

### OpenCode Integration (repos/metabob-opencode)
- `packages/opencode/src/minibob-integration/index.ts` - Integration layer

---

## Conclusion

**Minibob is a solid foundation with excellent execution capabilities but missing the learning infrastructure to become a true self-optimizing system.**

The gap is not architectural - the vessel abstraction is sound. The gap is in the **feedback loops** that turn execution data into learned patterns:

- ✅ Can execute activities
- ✅ Can recommend based on historical success
- ❌ Cannot learn which activities to compose
- ❌ Cannot optimize impulse loading
- ❌ Cannot plan multi-step sequences
- ❌ Cannot improve itself autonomously

**Implementing the missing database tables and learning queries would transform minibob from a "template executor" into a "self-optimizing execution engine."**

---

## Questions Answered

1. **What is the typical flow in minibob?**
   - Goal → Parse → Recommend (Thompson Sampling) → Execute → Report → Check Completion → Loop

2. **How does direct invocation differ from OpenCode integration?**
   - Direct: Self-contained, environment config, console logs
   - Integrated: Uses OpenCode's LLM config and MCP tools, session-scoped, UI callbacks
   - **Both share the same backend for learning**

3. **Where are the inconsistencies?**
   - System can execute but cannot learn:
     - No composition graph
     - No impulse relevance
     - No tool tracking
     - No sequence learning
     - No autonomous improvement

4. **What's the path forward?**
   - Phase 1: Close learning loops (composition, impulses, tools)
   - Phase 2: Sequence learning (paths, multi-step planning)
   - Phase 3: Autonomous improvement (boredom tasks, variants)

