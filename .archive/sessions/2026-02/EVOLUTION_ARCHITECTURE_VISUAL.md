# Activity System Evolution - Architecture Visual Guide

**Purpose**: Visual representation of the target architecture  
**Audience**: Engineers implementing the evolution

---

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        ACTIVITY SYSTEM EVOLUTION                   │
│                                                                    │
│  From: Static templates → To: Intelligent, self-improving system   │
└────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│       USER REQUEST          │
│  "Add authentication API"   │
└─────────────┬───────────────┘
              │
              ▼
┌───────────────────────────────────────────────────────────────────┐
│                          OPENCODE (Executor)                       │
│ ─────────────────────────────────────────────────────────────────│
│  Role: Execute activity templates                                 │
│                                                                   │
│  Phase 1+: Report execution outcomes                              │
│  Phase 2+: No local caching (always request fresh)                │
│  Phase 3+: Report actual steps taken                              │
│  Phase 4+: Track impulse usage                                    │
└───────────────────┬───────────────────────────────────────────────┘
                    │
                    │ MCP Request: get_activity_template(id, context)
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                      METABOB-CLI (Mediator)                        │
│ ─────────────────────────────────────────────────────────────────│
│  Role: Translate between OpenCode and Backend                     │
│                                                                   │
│  • Maps proto schema ↔ TypeScript types                           │
│  • Enriches context with component analysis                       │
│  • Associates executions with code changes                        │
│  • Synthesizes impulses from Metabob tools                        │
└───────────────────┬───────────────────────────────────────────────┘
                    │
                    │ HTTP: GET /v2/activities/templates/{id}
                    │ + context (language, project_type, recent_files)
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    BACKEND (Intelligence Layer)                    │
│ ─────────────────────────────────────────────────────────────────│
│  Role: Intelligent variant selection and learning                 │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐          │
│  │          VARIANT SELECTOR (Phase 2)                 │          │
│  │ ───────────────────────────────────────────────────│          │
│  │  1. Get all active variants for activity_id        │          │
│  │  2. Score each variant:                            │          │
│  │     - Success rate (60%)                           │          │
│  │     - Context match (30%)                          │          │
│  │     - Recency (10%)                                │          │
│  │  3. Multi-armed bandit:                            │          │
│  │     - 95% exploit: Return highest scored           │          │
│  │     - 5% explore: Return random for learning       │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐          │
│  │         VARIANT EVOLVER (Phase 3)                   │          │
│  │ ───────────────────────────────────────────────────│          │
│  │  When execution completes:                         │          │
│  │  1. Calculate divergence from template            │          │
│  │  2. If divergence > 30% and success:              │          │
│  │     → Check for pattern (3+ similar divergences)  │          │
│  │     → Commission new variant                      │          │
│  │     → Track genealogy (parent → child)            │          │
│  │  3. Store new variant as ACTIVE                   │          │
│  │  4. Future selections include new variant         │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐          │
│  │        IMPULSE LEARNER (Phase 4)                    │          │
│  │ ───────────────────────────────────────────────────│          │
│  │  Track which impulses → success:                   │          │
│  │  • errorContext: 90% success rate                  │          │
│  │  • componentAnnotations: 85% success rate          │          │
│  │  • debugLogs: 40% success rate → Remove           │          │
│  │                                                    │          │
│  │  Update variant impulse requirements based on      │          │
│  │  empirical data                                    │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                   │
└───────────────────┬───────────────────────────────────────────────┘
                    │
                    │ Return: Selected variant (proto format)
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    EXECUTION & LEARNING LOOP                       │
└───────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: End-to-End

### Request Flow (Phase 2+)

```
USER: "Add REST endpoint for /users"
  │
  ▼
┌──────────────────────────────────────────────────────┐
│ OpenCode: activity({ activityId: "add-rest-endpoint" })
│           variables: { path: "/users", method: "GET" }
└───────────────────┬──────────────────────────────────┘
                    │
                    │ MCP: get_activity_template
                    │ context: {
                    │   language: "typescript",
                    │   project_type: "rest-api",
                    │   recent_files: ["src/api/auth.ts"]
                    │ }
                    ▼
┌──────────────────────────────────────────────────────┐
│ CLI: Enrich context with Metabob analysis           │
│      • list_file_components(recent_files)            │
│      • get_component_annotations()                   │
│      • suggest_related_changes()                     │
└───────────────────┬──────────────────────────────────┘
                    │
                    │ HTTP GET /v2/activities/templates/add-rest-endpoint
                    │ + enriched_context
                    ▼
┌──────────────────────────────────────────────────────┐
│ Backend: VariantSelector.select_variant()           │
│                                                      │
│ Active variants:                                     │
│  - add-rest-endpoint-v1 (60% success, old)          │
│  - add-rest-endpoint-v2 (75% success, medium)       │
│  - add-rest-endpoint-v3 (85% success, recent)       │
│  - add-rest-endpoint-v4 (unknown, new)              │
│                                                      │
│ Scoring:                                             │
│  v1: 0.60 * 0.6 + 0.8 * 0.3 + 0.2 * 0.1 = 0.62     │
│  v2: 0.75 * 0.6 + 0.9 * 0.3 + 0.5 * 0.1 = 0.77     │
│  v3: 0.85 * 0.6 + 0.9 * 0.3 + 0.9 * 0.1 = 0.87 ← Winner
│  v4: 0.50 * 0.6 + 0.0 * 0.3 + 1.0 * 0.1 = 0.40     │
│                                                      │
│ Decision: 95% chance → v3 (best score)              │
│           5% chance → random (exploration)          │
│                                                      │
│ Selected: add-rest-endpoint-v3                      │
└───────────────────┬──────────────────────────────────┘
                    │
                    │ Return variant proto
                    ▼
┌──────────────────────────────────────────────────────┐
│ OpenCode: Execute variant tasks                     │
│                                                      │
│ Task 1: Analyze existing endpoints ← impulse: codeStructure
│ Task 2: Create handler function ← Template step    │
│ Task 3: Add validation ← Template step              │
│ Task 4: Write tests ← Template step                 │
│ Task 5: Update docs ← Template step                 │
│                                                      │
│ Result: ✅ Success (4m 23s, $0.08)                   │
└───────────────────┬──────────────────────────────────┘
                    │
                    │ Report outcome
                    ▼
┌──────────────────────────────────────────────────────┐
│ Backend: Record execution outcome                   │
│                                                      │
│ execution_outcomes table:                            │
│  - variant_id: add-rest-endpoint-v3                 │
│  - success: true                                     │
│  - duration_ms: 263000                               │
│  - cost: 0.08                                        │
│  - impulses_used: ["codeStructure"]                 │
│                                                      │
│ Update variant metrics:                              │
│  v3.success_count += 1                               │
│  v3.avg_duration = (prev_avg + 263000) / count       │
│  v3.avg_cost = (prev_avg + 0.08) / count             │
│                                                      │
│ New success rate: 86% (was 85%)                      │
└──────────────────────────────────────────────────────┘
```

---

## Evolution Flow (Phase 3)

### When Agent Diverges from Template

```
USER: "Add REST endpoint for /users with rate limiting"
  │
  ▼
┌──────────────────────────────────────────────────────┐
│ Backend selects: add-rest-endpoint-v3                │
│                                                      │
│ Expected steps:                                      │
│  1. Analyze existing endpoints                      │
│  2. Create handler function                         │
│  3. Add validation                                   │
│  4. Write tests                                      │
│  5. Update docs                                      │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│ OpenCode executes but diverges:                     │
│                                                      │
│ Actual steps taken:                                  │
│  1. Analyze existing endpoints ← Template           │
│  2. Check rate limiting patterns ← NEW STEP         │
│  3. Create handler function ← Template              │
│  4. Add rate limiting middleware ← NEW STEP         │
│  5. Add validation ← Template                        │
│  6. Write tests ← Template                           │
│  7. Write rate limit tests ← NEW STEP               │
│  8. Update docs ← Template                           │
│                                                      │
│ Divergence: 3 new steps out of 8 = 37.5%            │
│ Result: ✅ Success                                   │
└───────────────────┬──────────────────────────────────┘
                    │
                    │ Report: actualStepsTaken + divergence
                    ▼
┌──────────────────────────────────────────────────────┐
│ Backend: VariantEvolver.check_for_evolution()       │
│                                                      │
│ 1. Calculate divergence: 37.5% > 30% threshold ✓    │
│ 2. Execution successful: true ✓                     │
│ 3. Check for pattern:                                │
│    Query similar divergences for v3...              │
│                                                      │
│    Found:                                            │
│     - exec_abc123 (2 days ago): Added auth check    │
│     - exec_def456 (5 days ago): Added rate limiting │
│     - exec_ghi789 (current): Added rate limiting    │
│                                                      │
│    Pattern: 3 executions added rate limiting ✓      │
│                                                      │
│ 4. Commission new variant!                           │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│ Create: add-rest-endpoint-v4                         │
│                                                      │
│ genealogy:                                           │
│   content_hash: sha256:a1b2c3...                    │
│   parent_hash: sha256:d4e5f6... (v3)                │
│   reason: PATTERN_EMERGENCE                         │
│   source_execution_id: exec_ghi789                  │
│                                                      │
│ task_steps: [extracted from actual execution]       │
│   1. Analyze existing endpoints                     │
│   2. Check rate limiting patterns ← NEW             │
│   3. Create handler function                        │
│   4. Add rate limiting middleware ← NEW             │
│   5. Add validation                                  │
│   6. Write tests                                     │
│   7. Write rate limit tests ← NEW                   │
│   8. Update docs                                     │
│                                                      │
│ status: ACTIVE                                       │
│                                                      │
│ Future requests will now consider v4 for selection   │
└──────────────────────────────────────────────────────┘
```

---

## Database Schema Evolution

### Current Schema (Phase 0)

```sql
activity_variants
├── variant_id (PK)
├── activity_id
├── variant_name
├── description
├── category
├── task_steps (JSON)
└── created_at

(No execution tracking)
(No metrics)
(No learning)
```

### Phase 1 Schema (Data Collection)

```sql
activity_variants
├── variant_id (PK)
├── activity_id
├── variant_name
├── description
├── category
├── task_steps (JSON)
├── success_count ← NEW
├── failure_count ← NEW
├── avg_duration_ms ← NEW
├── avg_cost ← NEW
├── last_executed ← NEW
└── created_at

execution_outcomes ← NEW TABLE
├── execution_id (PK)
├── variant_id (FK → activity_variants)
├── session_id
├── user_id
├── project_id
├── success
├── duration_ms
├── tasks_completed
├── tasks_failed
├── error_message
├── context (JSON)
└── created_at

Indexes:
- idx_variant ON execution_outcomes(variant_id)
- idx_created ON execution_outcomes(created_at)
```

### Phase 2 Schema (Variant Selection)

```sql
(Same as Phase 1, plus:)

variant_selections ← NEW TABLE
├── selection_id (PK)
├── activity_id
├── variant_id
├── context (JSON)
├── score
├── was_exploration (boolean)
└── timestamp

Purpose: Track which variants were selected and why
Enables: A/B testing analysis, selection algorithm tuning
```

### Phase 3 Schema (Evolution)

```sql
(Previous tables, plus:)

variant_genealogy ← NEW TABLE
├── variant_id (PK)
├── parent_variant_id
├── content_hash (unique)
├── evolution_reason (enum: PATTERN_EMERGENCE, MANUAL_IMPROVEMENT)
├── source_execution_id (FK → execution_outcomes)
├── divergence_pattern (JSON)
└── created_at

divergence_log ← NEW TABLE
├── log_id (PK)
├── execution_id (FK → execution_outcomes)
├── variant_id
├── divergence_score
├── added_steps (JSON array)
├── skipped_steps (JSON array)
├── reordered (boolean)
└── timestamp

Purpose: Track variant ancestry and divergence patterns
Enables: Evolution tracking, pattern recognition
```

### Phase 4 Schema (Impulse Learning)

```sql
(Previous tables, plus updates to:)

task_steps (in activity_variants JSON)
  ├── id
  ├── subagent
  ├── prompt
  └── impulse_refs ← NEW
      ├── impulse_id
      ├── priority (HIGH/MEDIUM/LOW)
      └── required (boolean)

impulse_provenance ← NEW TABLE
├── impulse_id (PK)
├── content_hash
├── used_in_executions (count)
├── success_count
├── failure_count
├── avg_tokens
├── common_variants (JSON array)
├── component_associations (JSON array)
└── updated_at

impulse_usage ← NEW TABLE (per execution)
├── usage_id (PK)
├── execution_id (FK → execution_outcomes)
├── impulse_id
├── was_accessed (boolean)
├── tokens_used
└── timestamp

Purpose: Learn which impulses lead to success
Enables: Template optimization, impulse recommendations
```

---

## Cost Analysis: Before vs After

### Before Evolution (Current State)

```
┌─────────────────────────────────────────────────────┐
│ Task: "Add REST endpoint"                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Agent Process:                                       │
│  1. Read task description (LLM reasoning)           │
│     Tokens: 500 × $0.015/1k = $0.0075              │
│                                                     │
│  2. Analyze codebase structure (LLM reasoning)      │
│     Tokens: 10,000 × $0.015/1k = $0.15              │
│                                                     │
│  3. Design API endpoint (LLM reasoning)             │
│     Tokens: 5,000 × $0.015/1k = $0.075              │
│                                                     │
│  4. Generate handler code (LLM generation)          │
│     Tokens: 2,000 × $0.075/1k = $0.15               │
│                                                     │
│  5. Generate tests (LLM generation)                 │
│     Tokens: 3,000 × $0.075/1k = $0.225              │
│                                                     │
│  6. Write documentation (LLM generation)            │
│     Tokens: 1,000 × $0.075/1k = $0.075              │
│                                                     │
│ Total: 21,500 tokens, $0.6825 per task             │
│                                                     │
│ For 1000 tasks: $682.50                             │
└─────────────────────────────────────────────────────┘
```

### After Evolution (Target State)

```
┌─────────────────────────────────────────────────────┐
│ Task: "Add REST endpoint" (95% of time: best variant)
├─────────────────────────────────────────────────────┤
│                                                     │
│ Backend: Select add-rest-endpoint-v3                │
│  → 85% historical success rate                     │
│  → Proven template with 47 successful executions    │
│  Cost: $0 (database query, <1ms)                    │
│                                                     │
│ Agent Process:                                       │
│  1. Load template (no reasoning needed)             │
│     Tokens: 200 × $0.015/1k = $0.003                │
│                                                     │
│  2. Execute task 1: "Analyze endpoints"             │
│     Template guides, LLM fills in specifics         │
│     Tokens: 1,000 × $0.015/1k = $0.015              │
│                                                     │
│  3. Execute task 2: "Create handler"                │
│     Template provides structure                     │
│     Tokens: 1,500 × $0.075/1k = $0.1125             │
│                                                     │
│  4. Execute task 3: "Add validation"                │
│     Template provides pattern                       │
│     Tokens: 800 × $0.075/1k = $0.06                 │
│                                                     │
│  5. Execute task 4: "Write tests"                   │
│     Template provides test structure                │
│     Tokens: 1,200 × $0.075/1k = $0.09               │
│                                                     │
│ Total: 4,700 tokens, $0.2805 per task              │
│                                                     │
│ Savings: $0.6825 - $0.2805 = $0.402 per task (59%)  │
│ For 1000 tasks: $402 savings = $280.50 total cost   │
│                                                     │
│ ROI: $402,000 saved per 1000 tasks                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Task: New pattern (5% of time: exploration)         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Backend: Select random variant for learning         │
│  → May be less optimal, but gathers data            │
│  → Cost similar to pre-evolution                    │
│                                                     │
│ Purpose: Discover if new variants work better       │
│ Trade-off: 5% higher cost for continuous learning   │
└─────────────────────────────────────────────────────┘
```

---

## Monitoring and Observability

### Dashboards to Build

```
┌─────────────────────────────────────────────────────┐
│ VARIANT PERFORMANCE DASHBOARD                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Per Activity:                                        │
│  - Success rate by variant (bar chart)              │
│  - Avg duration by variant (line chart)             │
│  - Avg cost by variant (line chart)                 │
│  - Selection frequency (pie chart)                  │
│                                                     │
│ Global Metrics:                                      │
│  - Total executions today                           │
│  - Overall success rate                             │
│  - Cost savings vs baseline                         │
│  - New variants commissioned                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ EVOLUTION TIMELINE                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Timeline View:                                       │
│  v1 ────────────────→ (60% success)                 │
│       │                                              │
│       └──→ v2 ──────→ (75% success)                 │
│              │                                       │
│              └──→ v3 ──→ (85% success) ← Active     │
│                   │                                  │
│                   └──→ v4 → (testing...)            │
│                                                     │
│ Shows: Genealogy, evolution reasons, success rates   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ IMPULSE EFFECTIVENESS                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Impulse Rankings:                                    │
│  1. errorContext        → 90% success (keep!)       │
│  2. componentAnnotations → 85% success (keep!)      │
│  3. codeStructure       → 72% success (keep)        │
│  4. debugLogs           → 45% success (remove?)     │
│                                                     │
│ Shows: Which impulses contribute to success          │
└─────────────────────────────────────────────────────┘
```

---

## Summary: The Complete Picture

```
┌────────────────────────────────────────────────────────────────┐
│                    INTELLIGENT ACTIVITY SYSTEM                  │
│                                                                │
│  Phase 1: DATA COLLECTION                                      │
│   Every execution → Database                                   │
│   Metrics tracked automatically                                │
│                                                                │
│  Phase 2: INTELLIGENT SELECTION                                │
│   Backend chooses best variant                                 │
│   95% exploit (best) + 5% explore (learn)                      │
│   Context-aware scoring                                        │
│                                                                │
│  Phase 3: AUTO-EVOLUTION                                       │
│   Detect successful patterns                                   │
│   Commission new variants                                      │
│   Track genealogy                                              │
│                                                                │
│  Phase 4: IMPULSE OPTIMIZATION                                 │
│   Learn which context helps                                    │
│   Remove unused impulses                                       │
│   Optimize templates empirically                               │
│                                                                │
│  RESULT: Self-improving system                                 │
│   - 59-80% cost reduction                                      │
│   - Gets smarter over time                                     │
│   - Adapts to codebase                                         │
│   - Minimizes LLM usage                                        │
└────────────────────────────────────────────────────────────────┘
```

---

**Next**: Review EVOLUTION_TARGET_STATE.md for implementation details  
**Quick Start**: See EVOLUTION_QUICK_START.md for summary
