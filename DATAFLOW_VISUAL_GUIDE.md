# Dataflow Visual Guide

Quick visual references for understanding the complete architecture.

---

## 1. The Mandatory Flow (No Shortcuts!)

```
┌──────────────────┐
│ metabob-opencode │  ❌ CANNOT skip to backend
│   (TypeScript)   │  ❌ CANNOT access DB directly
└────────┬─────────┘  ✅ MUST use MCP gateway
         │
         │ MCP JSON-RPC (stdio)
         │ Tool: metabob_post_activity_result
         │
         ▼
┌──────────────────┐
│  metabob-cli     │  ❌ CANNOT access DB directly
│   MCP Server     │  ❌ CANNOT do business logic
│   (Python)       │  ✅ Pure stateless proxy
└────────┬─────────┘
         │
         │ HTTP REST
         │ POST /api/v1/activity-execution/results
         │
         ▼
┌──────────────────┐
│ metabob-rpc-api  │  ✅ Exclusive DB gateway
│  (Python FastAPI)│  ✅ Thompson Sampling here
└────────┬─────────┘  ✅ Gradient calculation here
         │
         │ SurrealDB driver
         │ UPDATE activity_templates SET ...
         │
         ▼
┌──────────────────┐
│   SurrealDB      │  ✅ Single source of truth
│  (Graph DB)      │  ✅ All metrics stored here
└──────────────────┘  ✅ Learning state persisted
```

**Why this is enforced:**
1. **Loose coupling**: Language-agnostic protocols (MCP, HTTP)
2. **Exclusive DB access**: Only one component writes to DB (prevents conflicts)
3. **Graceful degradation**: OpenCode works without backend (local cache fallback)
4. **Testing boundaries**: Can test each layer independently

---

## 2. Learning Loop (Continuous Improvement)

```
     ┌─────────────────────────────────────────────────────┐
     │                                                     │
     │  CONTINUOUS LEARNING LOOP                          │
     │                                                     │
     └─────────────────────────────────────────────────────┘
          │
          │
    ┌─────▼─────┐
    │  EXECUTE  │  User or Boredom triggers activity
    │ Activity  │  Example: "add-feature-complete"
    └─────┬─────┘
          │
          │ Activity completes
          │
    ┌─────▼─────┐
    │  MEASURE  │  Capture metrics
    │  Metrics  │  - Success: true/false
    └─────┬─────┘  - Duration: 45000ms
          │        - Cost: $0.18
          │        - Tokens: {input: 5000, output: 3000}
          │
    ┌─────▼─────┐
    │  RECORD   │  POST /api/v1/activity-execution/results
    │ to Backend│  Payload: { variant_id, success, duration, ... }
    └─────┬─────┘
          │
          │ Backend processes
          │
    ┌─────▼─────┐
    │   LEARN   │  Thompson Sampling (Bayesian update)
    │ (Thompson │  - Update Beta distribution: Beta(α, β)
    │  Sampling)│  - New success_rate = (α / (α + β))
    └─────┬─────┘  - Store in SurrealDB
          │
          │ Metrics updated
          │
    ┌─────▼─────┐
    │ CALCULATE │  Improvement gradient formula:
    │ Gradient  │  gradient = (1 - success_rate) * 0.5
    └─────┬─────┘            + frequency_weight * 0.2
          │                  + recency_weight * 0.2
          │                  + severity_weight * 0.1
          │
    ┌─────▼─────┐
    │ PRIORITIZE│  Sort templates by priority
    │ Templates │  priority = gradient × urgency_multiplier
    └─────┬─────┘  Top N → boredom activity queue
          │
          │ Wait for idle (5 min)
          │
    ┌─────▼─────┐
    │  BOREDOM  │  BoredomManager detects idle
    │  TRIGGER  │  GET /api/v1/learning-loop/boredom-activities
    └─────┬─────┘  Returns: [highest priority templates]
          │
          │ Select top activity
          │
    ┌─────▼─────┐
    │AUTO-EXEC  │  Execute with metadata:
    │ Activity  │  - initiatedBy: "boredom-auto"
    └─────┬─────┘  - branch: "boredom-activity"
          │
          │
          └───────────► Loop back to EXECUTE
```

**Key insight**: The loop NEVER stops. Even "idle" time is learning time.

---

## 3. Improvement Gradient Breakdown

```
Template: "add-feature-complete"
Current state:
  - success_rate: 0.75 (75%)
  - execution_count: 30
  - last_execution: 16 hours ago (failed)
  - failure_patterns: [timeout (severity: 7), validation (severity: 5)]

┌─────────────────────────────────────────────────────────────┐
│                   GRADIENT CALCULATION                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SUCCESS GAP (50% weight)                            │   │
│  │   gap = 1.0 - 0.75 = 0.25                           │   │
│  │   contribution = 0.25 × 0.5 = 0.125                 │   │
│  └─────────────────────────────────────────────────────┘   │
│               │                                             │
│  ┌────────────▼────────────────────────────────────────┐   │
│  │ FREQUENCY WEIGHT (20% weight)                       │   │
│  │   frequency = min(30 / 50, 1.0) = 0.6               │   │
│  │   contribution = 0.6 × 0.2 = 0.12                   │   │
│  └─────────────────────────────────────────────────────┘   │
│               │                                             │
│  ┌────────────▼────────────────────────────────────────┐   │
│  │ RECENCY WEIGHT (20% weight)                         │   │
│  │   hours_ago = 16                                    │   │
│  │   recency = 1.0 / (1.0 + 16/24) = 0.6               │   │
│  │   contribution = 0.6 × 0.2 = 0.12                   │   │
│  └─────────────────────────────────────────────────────┘   │
│               │                                             │
│  ┌────────────▼────────────────────────────────────────┐   │
│  │ SEVERITY WEIGHT (10% weight)                        │   │
│  │   max_severity = 7 (timeout errors)                 │   │
│  │   severity = 7 / 10 = 0.7                           │   │
│  │   contribution = 0.7 × 0.1 = 0.07                   │   │
│  └─────────────────────────────────────────────────────┘   │
│               │                                             │
│  ┌────────────▼────────────────────────────────────────┐   │
│  │ TOTAL GRADIENT                                      │   │
│  │   gradient = 0.125 + 0.12 + 0.12 + 0.07             │   │
│  │   gradient = 0.435 (43.5%)                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Interpretation:
  0.435 = MEDIUM-HIGH improvement potential
  
  This template:
    ✓ Has room for improvement (75% → goal 95%+)
    ✓ Is used frequently (30 executions)
    ✓ Failed recently (16 hours ago)
    ✓ Has severe errors (timeout issues)
    
  → HIGH PRIORITY for boredom system to improve
```

---

## 4. Vessel Transformation Cycle

```
┌──────────────────────────────────────────────────────────────┐
│              THREE-STATE ONTOLOGY CYCLE                      │
└──────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────┐
    │     VESSEL (Instructional State)            │
    │                                             │
    │  Activity Template:                         │
    │    {                                        │
    │      "id": "add-feature-complete",          │
    │      "name": "Add Feature (Complete)",      │
    │      "tasks": [                             │
    │        { "id": "task-1", "prompt": "..." }, │
    │        { "id": "task-2", "prompt": "..." }  │
    │      ],                                     │
    │      "learning": {                          │
    │        "success_rate": 0.75                 │
    │      }                                      │
    │    }                                        │
    │                                             │
    │  Properties:                                │
    │    - Static (doesn't change)                │
    │    - Reusable (spawn many instances)        │
    │    - Versionable (can track changes)        │
    └──────────────┬──────────────────────────────┘
                   │
                   │ Instantiation
                   │ (User triggers execution)
                   ▼
    ┌─────────────────────────────────────────────┐
    │     BECOMING (Transient State)              │
    │                                             │
    │  Activity Execution:                        │
    │    {                                        │
    │      "activityId": "act_abc123",            │
    │      "status": "executing",                 │
    │      "currentTask": "task-1",               │
    │      "agent": { "id": "agent_def456" },     │
    │      "toolCalls": [                         │
    │        { "t": 1000, "tool": "read" },       │
    │        { "t": 5000, "tool": "edit" }        │
    │      ]                                      │
    │    }                                        │
    │                                             │
    │  Properties:                                │
    │    - Ephemeral (exists during execution)    │
    │    - Transformative (changes code)          │
    │    - Temporal (has duration, flow)          │
    └──────────────┬──────────────────────────────┘
                   │
                   │ Actualization
                   │ (Execution completes)
                   ▼
    ┌─────────────────────────────────────────────┐
    │     INSTANCE (Functional State)             │
    │                                             │
    │  Activity Result:                           │
    │    {                                        │
    │      "activityId": "act_abc123",            │
    │      "status": "completed",                 │
    │      "success": true,                       │
    │      "artifacts": [                         │
    │        { "path": "src/feature.ts" },        │
    │        { "path": "tests/feature.test.ts" }  │
    │      ],                                     │
    │      "metrics": {                           │
    │        "duration": 30000,                   │
    │        "cost": 0.18,                        │
    │        "tokens": { ... }                    │
    │      }                                      │
    │    }                                        │
    │                                             │
    │  Properties:                                │
    │    - Actualized (instructions → state)      │
    │    - Observable (can measure)               │
    │    - Specific (unique ID, history)          │
    └──────────────┬──────────────────────────────┘
                   │
                   │ Learning
                   │ (Thompson Sampling update)
                   ▼
    ┌─────────────────────────────────────────────┐
    │  IMPROVED VESSEL (Next Iteration)           │
    │                                             │
    │  Updated Template:                          │
    │    {                                        │
    │      "id": "add-feature-complete",          │
    │      "learning": {                          │
    │        "success_rate": 0.76,  ← Updated!    │
    │        "execution_count": 31, ← Incremented │
    │        "avg_cost": 0.183,     ← Updated     │
    │        "improvement_gradient": 0.33 ← Lower │
    │      }                                      │
    │    }                                        │
    │                                             │
    │  Result: Template improved based on data!   │
    └──────────────┬──────────────────────────────┘
                   │
                   │ Next execution
                   │
                   └──► Loop back to VESSEL
```

**Key insight**: The vessel evolves through continuous execution and learning.

---

## 5. DevBob Multi-Vessel Coordination

```
┌────────────────────────────────────────────────────────────────┐
│              HOST ENVIRONMENT (Parent OpenCode)                │
│                                                                │
│  Task: "Implement full-stack authentication system"           │
│  Complexity: HIGH                                              │
│  Decision: Delegate to multiple DevBob vessels                │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         │ ACP Delegation
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
┌───────────────────────┐   ┌───────────────────────┐
│  DevBob Vessel 1      │   │  DevBob Vessel 2      │
│  (Backend Specialist) │   │  (Frontend Specialist)│
│                       │   │                       │
│  Container:           │   │  Container:           │
│    ID: abc123         │   │    ID: def456         │
│    Port: 3001 (ACP)   │   │    Port: 3002 (ACP)   │
│                       │   │                       │
│  Task:                │   │  Task:                │
│    - JWT endpoints    │   │    - Login UI         │
│    - User model       │   │    - Auth context     │
│    - Auth middleware  │   │    - Protected routes │
│                       │   │                       │
│  Impulses Shared:     │   │  Impulses Shared:     │
│    - apiDesign        │   │    - apiDesign        │
│    - dbSchema         │   │    - uiDesign         │
└───────────┬───────────┘   └───────────┬───────────┘
            │                           │
            │ Shared State via SurrealDB│
            └──────────┬────────────────┘
                       ▼
         ┌─────────────────────────────┐
         │       SurrealDB             │
         │  (Activity Synchronization) │
         │                             │
         │  vessel_1_activity:         │
         │    status: executing        │
         │    artifacts: [...]         │
         │                             │
         │  vessel_2_activity:         │
         │    status: executing        │
         │    artifacts: [...]         │
         │                             │
         │  Impulse state:             │
         │    apiDesign: loaded        │
         │    dbSchema: loaded         │
         │    uiDesign: loaded         │
         └─────────────────────────────┘
                       │
                       │ Results returned
                       ▼
         ┌─────────────────────────────┐
         │  HOST INTEGRATES RESULTS    │
         │                             │
         │  Backend artifacts:         │
         │    - src/auth.ts            │
         │    - tests/auth.test.ts     │
         │                             │
         │  Frontend artifacts:        │
         │    - components/Login.tsx   │
         │    - hooks/useAuth.ts       │
         │                             │
         │  Combined: Full auth system │
         └─────────────────────────────┘
```

**Coordination mechanisms:**
1. **ACP**: Task delegation and result retrieval
2. **SurrealDB**: Shared activity state for coordination
3. **Impulses**: Context sharing between vessels
4. **Git**: Artifact merging and conflict resolution

---

## 6. Boredom System Visual

```
┌────────────────────────────────────────────────────────────┐
│              BOREDOM SYSTEM LIFECYCLE                      │
└────────────────────────────────────────────────────────────┘

   USER ACTIVITY
        │
        │ User working...
        │
        ▼
   ┌──────────┐
   │ ACTIVE   │  BoredomManager: monitoring = false
   │  MODE    │  Session has recent user activity
   └────┬─────┘
        │
        │ 5 minutes pass with no activity
        │
        ▼
   ┌──────────┐
   │  IDLE    │  BoredomManager: monitoring = true
   │  MODE    │  Idle threshold exceeded (5 min)
   └────┬─────┘
        │
        │ Check if already executing
        │
        ▼
   ┌──────────┐
   │  FETCH   │  MCP Call: metabob_fetch_boredom_activities
   │ BOREDOM  │  GET /api/v1/learning-loop/boredom-activities
   │ACTIVITIES│  Params: { max_activities: 5, threshold: 0.6 }
   └────┬─────┘
        │
        │ Backend queries SurrealDB
        │
        ▼
   ┌──────────────────────────────────────────┐
   │  BACKEND CALCULATES PRIORITIES           │
   │                                          │
   │  Query:                                  │
   │    SELECT * FROM activity_templates      │
   │    WHERE success_rate < 0.95             │
   │      AND execution_count > 5             │
   │      AND last_execution > 24h ago        │
   │    ORDER BY improvement_gradient DESC    │
   │    LIMIT 5                               │
   │                                          │
   │  Results:                                │
   │    1. add-feature-complete (gradient: 0.43)│
   │    2. fix-bug-complete (gradient: 0.38)  │
   │    3. refactor-with-tests (gradient: 0.35)│
   └────┬─────────────────────────────────────┘
        │
        │ Return top activities
        │
        ▼
   ┌──────────┐
   │  SELECT  │  Pick highest priority (top of list)
   │ HIGHEST  │  Selected: "add-feature-complete"
   │ PRIORITY │  Gradient: 0.43, Priority: 0.85
   └────┬─────┘
        │
        │ Prepare for execution
        │
        ▼
   ┌──────────────────────────────────────┐
   │  EXECUTE WITH METADATA               │
   │                                      │
   │  ActivityTool.execute({              │
   │    templateId: "add-feature-complete",│
   │    initiatedBy: "boredom-auto",      │
   │    branch: "boredom-activity",       │
   │    title: "[BOREDOM] improve add-feature",│
   │    reason: "75% success rate, recent failures"│
   │  })                                  │
   └────┬─────────────────────────────────┘
        │
        │ Activity executes...
        │
        ▼
   ┌──────────┐     ┌──────────────────────┐
   │ MONITOR  │────►│ USER RETURNS?        │
   │EXECUTION │     │   → Abort activity   │
   └────┬─────┘     │     (respects user)  │
        │           └──────────────────────┘
        │ Activity completes
        │
        ▼
   ┌──────────────────────────────────────┐
   │  RECORD RESULTS                      │
   │                                      │
   │  POST /api/v1/activity-execution/results│
   │  {                                   │
   │    variant_id: "add-feature-complete",│
   │    success: true,                    │
   │    duration: 45000,                  │
   │    cost: 0.18,                       │
   │    initiated_by: "boredom-auto"      │
   │  }                                   │
   └────┬─────────────────────────────────┘
        │
        │ Thompson Sampling updates
        │
        ▼
   ┌──────────────────────────────────────┐
   │  METRICS UPDATED                     │
   │                                      │
   │  Template: add-feature-complete      │
   │    success_rate: 0.75 → 0.76         │
   │    execution_count: 30 → 31          │
   │    improvement_gradient: 0.43 → 0.41 │
   │    priority: LOWERED (improved!)     │
   └────┬─────────────────────────────────┘
        │
        │ Continue monitoring
        │
        └──────► Loop back to IDLE check
```

**Result**: System autonomously improves itself during idle time!

---

## Summary: The Big Picture

```
┌───────────────────────────────────────────────────────────────┐
│                  THE COMPLETE SYSTEM                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  USER/BOREDOM ──► EXECUTE ──► MEASURE ──► RECORD            │
│       ▲              │            │           │               │
│       │              ▼            ▼           ▼               │
│       │         Artifacts    Metrics    SurrealDB            │
│       │              │            │           │               │
│       │              └────────────┴───────────┤               │
│       │                                       │               │
│       │                                       ▼               │
│       │                             Thompson Sampling         │
│       │                                       │               │
│       │                                       ▼               │
│       │                           Calculate Gradients         │
│       │                                       │               │
│       │                                       ▼               │
│       │                             Prioritize Templates     │
│       │                                       │               │
│       │                                       ▼               │
│       └─────────────────────────────  Boredom Queue          │
│                 (Feedback Loop Closes)        │               │
│                                                               │
└───────────────────────────────────────────────────────────────┘

KEY PROPERTIES:
  ✓ Continuous learning (never stops)
  ✓ Autonomous improvement (boredom system)
  ✓ Multi-vessel coordination (parallel execution)
  ✓ Graceful degradation (works offline)
  ✓ Architectural boundaries enforced (MCP gateway)
```

---

**For more details, see:**
- `DATAFLOW_AND_LEARNING_ARCHITECTURE.md` - Complete technical documentation
- `DATAFLOW_QUICK_REFERENCE.md` - Quick lookup reference
- `ARCHITECTURE_COMPLIANCE_ASSESSMENT_2026-02-24.md` - Boundary validation

**Test the stack:**
```bash
./scripts/validate-metabob-stack.sh
```

**Run E2E test:**
```bash
opencode activity execute --template test-metabob-stack-e2e-fixed
```
