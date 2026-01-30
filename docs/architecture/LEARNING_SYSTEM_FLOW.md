# Learning System Flow Diagram

> **⚠️ STATUS: SUPERSEDED**
> 
> This document describes an earlier version of the learning system architecture. The current production design uses a **double-blind A/B testing approach** where agents receive opaque recommendations without scores or explanations.
>
> **See instead:**
> - [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](../DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - Current v3.0.0 production architecture
> - [FINAL_ARCHITECTURE_SUMMARY.md](../../FINAL_ARCHITECTURE_SUMMARY.md) - Executive summary and implementation guide
> - [ARCHITECTURE_OVERVIEW.md](../ARCHITECTURE_OVERVIEW.md) - Complete system overview
>
> This document is preserved for historical reference and shows the evolution from annotation-driven learning to double-blind experimentation.

---

## High-Level Architecture (Historical - v1.0.0)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SUBMITS FIX REQUEST                     │
│              "Fix memory leak in session messages"              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 1: METABOB DECOMPOSITION                  │
│                                                                 │
│  metabob_search_codebase_issues("related to memory leak")      │
│         ↓                                                       │
│  metabob_analyze_change_impact(Session.messages)               │
│         ↓                                                       │
│  metabob_suggest_related_changes([Session.messages])           │
│                                                                 │
│  Output: TaskDecomposition                                     │
│  - impactedComponents: [Session.messages]                      │
│  - changeSequence: [Add default limit]                         │
│  - estimatedEffort: Simple (3 lines)                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 2: LOAD COMPONENT KNOWLEDGE                  │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │   Annotations    │    │  Prompt Profile  │                 │
│  │   Budget (5)     │    │  (version 2)     │                 │
│  │   - WHY          │    │  - Effective     │                 │
│  │   - CONSTRAINT   │    │  - Ineffective   │                 │
│  │   - SUCCESS      │    │  - Pitfalls      │                 │
│  └──────────────────┘    └──────────────────┘                 │
│           │                       │                             │
│           └───────────┬───────────┘                             │
│                       ▼                                         │
│           ┌──────────────────────┐                             │
│           │  Association Graph   │                             │
│           │  - component↔impulse │                             │
│           │  - component↔task    │                             │
│           │  - task↔activity     │                             │
│           └──────────────────────┘                             │
│                       │                                         │
│                       ▼                                         │
│           Select Optimal Context                               │
│           (knapsack: max score within budget)                  │
│                                                                 │
│  Output: OptimalContext                                        │
│  - impulses: [streaming_patterns, memory_opt]                 │
│  - totalTokens: 1800 / 5000                                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                PHASE 3: GENERATE OPTIMIZED PROMPT               │
│                                                                 │
│  Template:                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Fix memory leak in Session.messages                     │  │
│  │                                                         │  │
│  │ ROOT CAUSE: No default limit (loads ALL messages)      │  │
│  │                                                         │  │
│  │ ✅ EFFECTIVE APPROACH (87% success):                    │  │
│  │   - Add schema default: .default(100)                  │  │
│  │   - Add runtime fallback: const limit = input.limit ?? │  │
│  │   - Change loop: if (count >= limit) break             │  │
│  │                                                         │  │
│  │ ❌ AVOID (23% success):                                 │  │
│  │   - Creating manager classes (orphaned)                │  │
│  │   - Adding LRU caches (doesn't prevent load)           │  │
│  │                                                         │  │
│  │ ⚠️  PITFALL: Schema default alone insufficient         │  │
│  │                                                         │  │
│  │ VALIDATION: Memory < 100MB after 1000 ops              │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PHASE 4: EXECUTE WITH GATES                    │
│                                                                 │
│  Implement Fix                                                 │
│       ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ✅ GATE 1: Impact Analysis                              │  │
│  │    Does change affect problem?                          │  │
│  │    metabob_analyze_change_impact(...)                   │  │
│  │    → YES: Has path to Session.messages                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│       ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ✅ GATE 2: Integration Check                            │  │
│  │    Is code actually used?                               │  │
│  │    metabob_assess_deletion_safety(...)                  │  │
│  │    → YES: Has 8 callers, liveness=live                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│       ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ✅ GATE 3: Related Changes                              │  │
│  │    All integration points updated?                      │  │
│  │    metabob_suggest_related_changes(...)                 │  │
│  │    → YES: No missing integrations                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│       ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ✅ GATE 4: Performance Validation                       │  │
│  │    Does metric improve?                                 │  │
│  │    measureMemory(before) vs measureMemory(after)        │  │
│  │    → YES: 16GB → 95MB (99.4% reduction)                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│       ↓                                                         │
│  All Gates Passed ✅                                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PHASE 5: LEARNING & FEEDBACK                   │
│                                                                 │
│  Validation Result:                                            │
│  - success: true                                               │
│  - memoryReduction: 99.4%                                      │
│  - insight: "Schema default + fallback both required"          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Update Annotations:                                      │ │
│  │  - Add new: SUCCESS annotation (insight)                │ │
│  │  - Boost: Existing annotations in context               │ │
│  │  - Evict: Lowest-scoring if over budget                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│       ↓                                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Update Prompt Profile:                                   │ │
│  │  - Move to effective: "Add schema default + fallback"   │ │
│  │  - Move to ineffective: (none this time)                │ │
│  │  - Add pitfall: (validated existing one)                │ │
│  │  - Increment version: 2 → 3                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│       ↓                                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Update Association Graph:                                │ │
│  │  - Boost: Session.messages ↔ streaming_patterns         │ │
│  │  - Boost: Session.messages ↔ fix_memory_leak            │ │
│  │  - Boost: fix_memory_leak ↔ fix-bug-complete            │ │
│  │  - Prune: Weak edges (< 0.2 weight)                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│       ↓                                                         │
│  Learning Complete ✅                                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       COMMIT & REPORT                           │
│                                                                 │
│  git commit -m "fix: memory leak in session messages           │
│                                                                 │
│  - Added default limit: .default(100)                          │
│  - Added runtime fallback                                      │
│  - Memory: 16GB → 95MB (99.4% reduction)                       │
│  - Learning: annotations+2, prompt v2→v3, edges+3              │
│  "                                                              │
│                                                                 │
│  Report:                                                       │
│  ✅ Fix successful (1 commit, 3 lines)                          │
│  ✅ All validation gates passed                                 │
│  ✅ System learned for next time                                │
│  💡 Next fix will use learned knowledge                         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Through System

```
┌─────────────┐
│  User Task  │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│                    Metabob Analysis                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Search  │→│  Impact  │→│  Suggest │→│Deletion  │  │
│  │Codebase  │  │ Analysis │  │ Related  │  │ Safety   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│                   Knowledge Retrieval                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Annotations  │  │   Prompts    │  │ Associations │    │
│  │   (max 5)    │  │ (versioned)  │  │   (graph)    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         └──────────────────┼──────────────────┘            │
│                            ▼                               │
│                   ┌────────────────┐                       │
│                   │ Optimal Context│                       │
│                   │  (knapsack)    │                       │
│                   └────────────────┘                       │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│                  Prompt Generation                         │
│  Template + Effective + Avoid + Pitfalls + Context        │
│                            ↓                               │
│                 Component-Optimized Prompt                 │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│                    Implementation                          │
│                 (LLM applies changes)                      │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│                  Validation Gates                          │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                      │
│  │Gate1│→│Gate2│→│Gate3│→│Gate4│→ Pass/Fail            │
│  └─────┘  └─────┘  └─────┘  └─────┘                      │
│                       │                                    │
│                       ├─→ PASS → Continue                 │
│                       └─→ FAIL → Abort (don't commit)     │
└────────┬───────────────────────────────────────────────────┘
         │ (if PASS)
         ▼
┌────────────────────────────────────────────────────────────┐
│                   Learning Update                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Update   │  │ Update   │  │ Update   │                │
│  │Annot.    │→│ Prompts  │→│  Assoc.  │                │
│  │(scores)  │  │(version) │  │ (edges)  │                │
│  └──────────┘  └──────────┘  └──────────┘                │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│                      Commit                                │
│              (with learning metadata)                      │
└────────────────────────────────────────────────────────────┘
```

## Feedback Loop Detail

```
┌──────────────────────────────────────────────────────────────┐
│                    VALIDATION RESULT                         │
│  {                                                           │
│    success: true/false,                                      │
│    componentId: "...",                                       │
│    impulseIds: [...],                                        │
│    taskType: "...",                                          │
│    activityId: "...",                                        │
│    metrics: { cost, duration, performance }                  │
│  }                                                           │
└────────┬─────────────────────────────────────────────────────┘
         │
         ├─────────────────────┬─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Annotations    │   │ Prompt Profile  │   │  Association    │
│     Update      │   │     Update      │   │  Graph Update   │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ For each        │   │ Move instruct.  │   │ Update edge     │
│ annotation:     │   │ to effective/   │   │ weights based   │
│                 │   │ ineffective     │   │ on success      │
│ if success:     │   │                 │   │                 │
│   score *= 1.1  │   │ Extract new     │   │ Prune weak      │
│ else:           │   │ pitfalls        │   │ edges           │
│   score *= 0.9  │   │                 │   │                 │
│                 │   │ Regenerate      │   │ Strengthen      │
│ if > budget:    │   │ prompt          │   │ successful      │
│   evict lowest  │   │                 │   │ patterns        │
│                 │   │ version++       │   │                 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │  Persist to        │
                    │  Storage           │
                    │  (for next time)   │
                    └────────────────────┘
```

## Learning Convergence Over Time

```
Fix Attempt 1 (Baseline):
  Annotations: 3 generic (WHY, CONSTRAINT, PATTERN)
  Prompt: v1 (generic template)
  Associations: empty
  Result: Try LRU cache → FAIL ❌

        │ Learning Update:
        │ - Add FAILURE annotation
        │ - Move "add cache" to ineffective
        │ - Record failure pattern
        ▼

Fix Attempt 2 (Learning Applied):
  Annotations: 4 (3 + FAILURE from attempt 1)
  Prompt: v2 (knows cache doesn't work)
  Associations: 1 weak edge
  Result: Add schema default → SUCCESS ✅

        │ Learning Update:
        │ - Add SUCCESS annotation
        │ - Move "schema default" to effective
        │ - Strengthen associations
        ▼

Fix Attempt 3 (Converged):
  Annotations: 5 (evicted lowest, added new SUCCESS)
  Prompt: v3 (optimized with learned patterns)
  Associations: 5 strong edges
  Result: Similar fix → SUCCESS ✅ (faster, cheaper)

        │ System has converged:
        │ - Annotations stable (high relevance)
        │ - Prompt stable (fewer updates)
        │ - Associations strong (proven patterns)
        ▼

Fix Attempts 4-10:
  Success rate: 85%+
  Avg cost: Decreasing
  Time to fix: Decreasing
  System is mature for this component
```

---

**Key Insight**: Each failed attempt makes the system smarter. After 10 fixes, the system knows what works for each component and guides toward effective solutions.
