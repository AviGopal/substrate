# Trajectory Editor: Visual Flow Diagrams

> **Purpose**: Visual representations of proper trajectory editor flows
>
> **Date**: 2026-04-24

## Diagram 1: Current vs Proper Goal-to-Trajectory Flow

### Current Flow (Misaligned)

```
┌──────────────────────────────────────────────────────────────┐
│ User enters goal text: "Fix auth bug"                       │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend: POST /goal-paths/recommend                        │
│   { goal_text: "Fix auth bug" }                             │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend: Return complete path (if seen before)              │
│   {                                                          │
│     path_activities: ['debug-bug', 'write-test', 'commit']  │
│     confidence: 0.85                                         │
│   }                                                          │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend: Load all activities into grid immediately          │
│                                                              │
│   Column 0      Column 1       Column 2                     │
│  [debug-bug] → [write-test] → [commit]                      │
│                                                              │
│ ✗ Trajectory appears "finished" before execution            │
│ ✗ Can't compose new paths (only historical playback)        │
│ ✗ No dynamic adaptation                                     │
└──────────────────────────────────────────────────────────────┘
```

### Proper Flow (Foundation-Aligned)

```
┌──────────────────────────────────────────────────────────────┐
│ User enters goal text: "Fix auth bug"                       │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Create goal impulse                                          │
│   {                                                          │
│     id: 'goal-1',                                           │
│     pointer: { type: 'memo', content: 'Fix auth bug' },    │
│     metadata: {                                             │
│       shape: 'goal',                                        │
│       domain: 'debug',                                      │
│       summary: 'Fix auth bug'                               │
│     }                                                       │
│   }                                                         │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Request first activity recommendation                │
│                                                              │
│ POST /v2/activities/recommend                               │
│   {                                                          │
│     goal_description: "Fix auth bug",                       │
│     available_shapes: ['goal'],                             │
│     exploration_rate: 0.2                                   │
│   }                                                         │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend: Thompson Sampling returns ranked options            │
│   [                                                          │
│     { id: 'debug-null-pointer', confidence: 0.87 },         │
│     { id: 'analyze-error-log', confidence: 0.72 },          │
│     { id: 'generic-debug', confidence: 0.45 }               │
│   ]                                                         │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ User selects 'debug-null-pointer' (or adds manually)        │
│                                                              │
│   Column 0                                                   │
│  [debug-null-pointer]                                       │
│                                                              │
│  Output shapes: ['error_analysis', 'patch']                 │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Update available shapes                             │
│   available_shapes: ['goal', 'error_analysis', 'patch']    │
│                                                              │
│ POST /v2/activities/recommend (again)                       │
│   {                                                          │
│     goal_description: "Fix auth bug",                       │
│     available_shapes: ['goal', 'error_analysis', 'patch'], │
│     exploration_rate: 0.2                                   │
│   }                                                         │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend: New recommendations based on updated shapes         │
│   [                                                          │
│     { id: 'write-tests', confidence: 0.91 },                │
│     { id: 'commit-changes', confidence: 0.65 }              │
│   ]                                                         │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ User adds 'write-tests'                                     │
│                                                              │
│   Column 0              Column 1                             │
│  [debug-null-pointer] → [write-tests]                      │
│                                                              │
│ ✓ Trajectory emerges step-by-step                          │
│ ✓ Can compose new combinations                             │
│ ✓ Adapts to current state                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Diagram 2: Impulse Flow Through Trajectory

### Automatic Impulse Creation

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER STARTS                               │
│                                                                     │
│  Goal: "Fix security vulnerability in auth"                        │
│                                                                     │
│  ┌──────────────────────┐                                          │
│  │   Goal Impulse       │                                          │
│  │   shape: goal        │                                          │
│  │   loaded: true       │                                          │
│  │   content: "Fix..."  │                                          │
│  └──────────────────────┘                                          │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        COLUMN 0                                     │
│                                                                     │
│  User adds: Activity A (analyze-security-issues)                   │
│  Input shapes: ['goal']                     ✓ Available            │
│  Output shapes: ['vulnerability_report', 'affected_files']         │
│                                                                     │
│  AUTOMATIC IMPULSE CREATION:                                       │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐ │
│  │ Impulse: vulnerability_rep │  │ Impulse: affected_files      │ │
│  │ shape: vulnerability_report│  │ shape: affected_files        │ │
│  │ producedBy: Activity A     │  │ producedBy: Activity A       │ │
│  │ loaded: false (placeholder)│  │ loaded: false (placeholder)  │ │
│  └────────────────────────────┘  └──────────────────────────────┘ │
│                                                                     │
│  Available shapes now:                                             │
│    ['goal', 'vulnerability_report', 'affected_files']             │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        COLUMN 1                                     │
│                                                                     │
│  Recommendation: Activity B (apply-security-patch)                 │
│  Input shapes: ['vulnerability_report', 'affected_files']          │
│                ✓ Both available from Column 0                      │
│  Output shapes: ['patch', 'test_result']                           │
│                                                                     │
│  User adds Activity B                                              │
│                                                                     │
│  AUTOMATIC IMPULSE CREATION:                                       │
│  ┌──────────────────┐  ┌─────────────────────┐                    │
│  │ Impulse: patch   │  │ Impulse: test_result│                    │
│  │ shape: patch     │  │ shape: test_result  │                    │
│  │ producedBy: B    │  │ producedBy: B       │                    │
│  │ loaded: false    │  │ loaded: false       │                    │
│  └──────────────────┘  └─────────────────────┘                    │
│                                                                     │
│  Available shapes now:                                             │
│    ['goal', 'vulnerability_report', 'affected_files',             │
│     'patch', 'test_result']                                        │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        COLUMN 2                                     │
│                                                                     │
│  Recommendation: Activity C (commit-and-deploy)                    │
│  Input shapes: ['patch', 'test_result']                            │
│                ✓ Both available from Column 1                      │
│  Output shapes: ['deployment_status']                              │
│                                                                     │
│  ✓ TRAJECTORY COMPLETE                                             │
└─────────────────────────────────────────────────────────────────────┘

KEY INSIGHTS:
  • Impulses flow automatically from activity outputs
  • User never manually creates impulses (except for testing)
  • Each column's outputs become next column's inputs
  • System validates shape compatibility at each step
```

---

## Diagram 3: Execution Model (Sequential + Parallel)

### Column-by-Column Execution with Parallel Rows

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TRAJECTORY STRUCTURE                          │
│                                                                     │
│   Column 0        Column 1          Column 2                       │
│                                                                     │
│   Row 0: [A]      Row 0: [D]        Row 0: [F]                     │
│   Row 1: [B]      Row 1: [E]                                       │
│   Row 2: [C]                                                       │
│                                                                     │
│   Legend:                                                          │
│   • Column = Sequential execution (0 → 1 → 2)                      │
│   • Row = Parallel execution (A, B, C run simultaneously)          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     EXECUTION TIMELINE                              │
│                                                                     │
│  T=0s                                                               │
│  ├─ Start Column 0 (3 activities in parallel)                      │
│  │                                                                  │
│  │  ┌────────────────────────────────────────────┐                 │
│  │  │ Activity A: analyze-error                  │ (12s)           │
│  │  ├────────────────────────────────────────────┤                 │
│  │  │ Activity B: check-dependencies             │ (8s)            │
│  │  ├────────────────────────────────────────────┤                 │
│  │  │ Activity C: scan-security                  │ (15s)           │
│  │  └────────────────────────────────────────────┘                 │
│  │                                                                  │
│  T=15s (wait for slowest: Activity C)                              │
│  │                                                                  │
│  │  All Column 0 activities completed ✓                            │
│  │  Output impulses collected:                                     │
│  │    - error_analysis (from A)                                    │
│  │    - dependency_report (from B)                                 │
│  │    - security_scan (from C)                                     │
│  │                                                                  │
│  ├─ Start Column 1 (2 activities in parallel)                      │
│  │                                                                  │
│  │  ┌────────────────────────────────────────────┐                 │
│  │  │ Activity D: generate-fix                   │ (20s)           │
│  │  ├────────────────────────────────────────────┤                 │
│  │  │ Activity E: update-docs                    │ (10s)           │
│  │  └────────────────────────────────────────────┘                 │
│  │                                                                  │
│  T=35s (wait for slowest: Activity D)                              │
│  │                                                                  │
│  │  All Column 1 activities completed ✓                            │
│  │  Output impulses collected:                                     │
│  │    - patch (from D)                                             │
│  │    - documentation (from E)                                     │
│  │                                                                  │
│  ├─ Start Column 2 (1 activity)                                    │
│  │                                                                  │
│  │  ┌────────────────────────────────────────────┐                 │
│  │  │ Activity F: commit-changes                 │ (5s)            │
│  │  └────────────────────────────────────────────┘                 │
│  │                                                                  │
│  T=40s                                                              │
│  │                                                                  │
│  └─ TRAJECTORY COMPLETE ✓                                          │
│                                                                     │
│  Total duration: 40s (not 70s if sequential!)                      │
│  Total cost: $0.23 (combined LLM calls)                            │
│  Success rate: 100% (all activities succeeded)                     │
└─────────────────────────────────────────────────────────────────────┘

EXECUTION RULES:
  1. Activities in same column execute in parallel (Promise.all)
  2. Next column waits for ALL activities in current column
  3. If ANY activity in column fails, entire column fails
  4. Output impulses from column N become available for column N+1
  5. No impulse from row 1 can be used by row 2 in same column
```

---

## Diagram 4: Learning Loop (Trace → Thompson Sampling)

### Complete Learning Feedback Cycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER EXECUTES TRAJECTORY                    │
│                                                                     │
│  Trajectory: [debug-bug] → [write-test] → [commit]                 │
│  Goal: "Fix auth vulnerability"                                    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       MINIBOB EXECUTION                             │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│  │  Execute         │    │  Execute         │    │  Execute     │ │
│  │  debug-bug       │ →  │  write-test      │ →  │  commit      │ │
│  │                  │    │                  │    │              │ │
│  │  Result: Success │    │  Result: Success │    │  Result: ✓   │ │
│  └──────────────────┘    └──────────────────┘    └──────────────┘ │
│                                                                     │
│  Create execution trace:                                           │
│    {                                                                │
│      id: 'exec-123',                                               │
│      activity_id: 'meta-trajectory-456',                           │
│      composition_chain: ['debug-bug', 'write-test', 'commit'],    │
│      outcome: { success: true, duration_ms: 45000, cost: 0.23 },  │
│      sub_executions: [...]                                         │
│    }                                                               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STORE TRACE TO BACKEND                           │
│                                                                     │
│  POST /v2/activities/execution-traces                              │
│    { trace: execution_trace }                                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND LEARNING UPDATES                         │
│                                                                     │
│  1. Update Thompson Sampling (α/β)                                  │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ activity_template                                    │       │
│     │   WHERE variant_id = 'meta-trajectory-456:v1'       │       │
│     │   SET thompson.alpha = alpha + 1  (success)         │       │
│     │                                                      │       │
│     │ Before: α=3, β=1  (75% success rate)                │       │
│     │ After:  α=4, β=1  (80% success rate)                │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                     │
│  2. Update Shape-Conditioned Scores                                │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ variant_performance_metrics                          │       │
│     │   WHERE variant_id = 'meta-trajectory-456:v1'       │       │
│     │     AND shape_signature = ['goal', 'error_log']     │       │
│     │   SET alpha = alpha + 1                              │       │
│     │                                                      │       │
│     │ Learn: This activity works well with these shapes   │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                     │
│  3. Update Composition Edges                                       │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ composition_edges                                    │       │
│     │   (debug-bug) → (write-test):  freq++, success++    │       │
│     │   (write-test) → (commit):     freq++, success++    │       │
│     │                                                      │       │
│     │ Learn: These activities work well together          │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                     │
│  4. Check for Variant Creation                                     │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ IF trajectory was modified:                          │       │
│     │   Create new variant:                                │       │
│     │     variant_id: 'meta-trajectory-456:v2'            │       │
│     │     composition: modified_composition                │       │
│     │     thompson: { alpha: 1, beta: 1 }                 │       │
│     │     metadata: {                                      │       │
│     │       parent_variant: 'v1',                         │       │
│     │       created_from_execution: 'exec-123'            │       │
│     │     }                                                │       │
│     └──────────────────────────────────────────────────────┘       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT USER BENEFITS                               │
│                                                                     │
│  POST /v2/activities/recommend                                     │
│    { goal: "Fix auth issue", available_shapes: ['goal'] }         │
│                                                                     │
│  Backend uses UPDATED Thompson scores:                             │
│    [                                                                │
│      {                                                              │
│        id: 'meta-trajectory-456:v1',                               │
│        confidence: 0.89,  ← Higher! (was 0.85)                     │
│        thompson: { alpha: 4, beta: 1 }                             │
│      },                                                             │
│      {                                                              │
│        id: 'meta-trajectory-456:v2',  ← NEW VARIANT!               │
│        confidence: 0.65,  (exploration)                             │
│        thompson: { alpha: 1, beta: 1 }                             │
│      }                                                              │
│    ]                                                                │
│                                                                     │
│  ✓ System learns from each execution                               │
│  ✓ Better recommendations over time                                │
│  ✓ New variants compete automatically                              │
└─────────────────────────────────────────────────────────────────────┘

LEARNING METRICS:
  • Thompson Sampling: α/β values update per execution
  • Shape-conditioned: Success rates per input shape combination
  • Composition patterns: Which activities sequence well
  • Variant competition: Multiple approaches compete via Thompson
```

---

## Diagram 5: User Workflow Comparison

### Before (Current Implementation)

```
┌────────────────────────────────────────────────────────────┐
│ 1. User enters goal                                        │
│    Time: 30 seconds                                        │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 2. Click "Generate Path"                                   │
│    ⚠ Only works if exact goal seen before                 │
│    Time: 2 seconds                                         │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 3a. IF path found:                                         │
│     Complete trajectory appears                            │
│     Time: 1 second                                         │
│                                                            │
│ 3b. IF path NOT found:                                    │
│     ⚠ User must manually search palette                   │
│     Time: 5-10 minutes                                     │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 4. User manually drags activities                         │
│    ⚠ No guidance on which to add next                     │
│    ⚠ No shape validation during construction              │
│    Time: 3-8 minutes                                       │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 5. Click "Save"                                            │
│    → Saves to localStorage only                            │
│    ✗ No execution                                          │
│    ✗ No learning feedback                                 │
│    Time: 1 second                                          │
└────────────────────────────────────────────────────────────┘

TOTAL TIME: 3-10 minutes (mostly manual work)
SUCCESS RATE: 30-40% (many abandoned attempts)
LEARNING: 0% (no traces stored)
```

### After (Foundation-Aligned)

```
┌────────────────────────────────────────────────────────────┐
│ 1. User enters goal                                        │
│    Time: 30 seconds                                        │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 2. System shows recommendations                            │
│    ✓ Based on Thompson Sampling                           │
│    ✓ Adapts to available shapes                           │
│    Time: 2 seconds (automatic)                             │
│                                                            │
│    [Activity A (87%)] [Activity B (72%)] [Activity C (45%)]│
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 3. User clicks Activity A (or manually selects)           │
│    ✓ Added to column 0                                    │
│    ✓ Output shapes computed                               │
│    Time: 2 seconds                                         │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 4. System shows NEXT recommendations                       │
│    ✓ Based on updated shapes                              │
│    ✓ Considers what Activity A produces                   │
│    Time: 2 seconds (automatic)                             │
│                                                            │
│    [Activity D (91%)] [Activity E (65%)]                   │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 5. User clicks Activity D                                 │
│    ✓ Added to column 1                                    │
│    ✓ Trajectory building step-by-step                     │
│    Time: 2 seconds                                         │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 6. Trajectory complete (or user adds more)                │
│    Click "Execute"                                         │
│    Time: 2 seconds                                         │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 7. MiniBob executes trajectory                            │
│    ✓ Real LLM calls                                        │
│    ✓ Actual state changes                                 │
│    ✓ Traces stored to backend                             │
│    Time: 30-60 seconds (execution time)                    │
└────────────┬───────────────────────────────────────────────┘
             ▼
┌────────────────────────────────────────────────────────────┐
│ 8. Results shown                                           │
│    ✓ Execution succeeded/failed                           │
│    ✓ Thompson Sampling updated                            │
│    ✓ Variants created if modified                         │
│    Time: 5 seconds (review)                                │
└────────────────────────────────────────────────────────────┘

TOTAL TIME: 2-3 minutes (mostly automated)
SUCCESS RATE: 80-90% (guided by recommendations)
LEARNING: 100% (every execution feeds learning loop)
```

---

## Diagram 6: Frontend Component Architecture

### Component Hierarchy

```
TrajectoryEditorPage
│
├─ Header (fixed)
│  ├─ Back button
│  ├─ Title
│  ├─ Validation indicator
│  └─ Save/Execute buttons
│
├─ Sidebar (left, scrollable)
│  │
│  ├─ GoalInputBox
│  │  ├─ Textarea (goal text)
│  │  ├─ Domain extraction (automatic)
│  │  └─ Generate recommendations button
│  │
│  ├─ ActivityRecommendations (NEW)
│  │  ├─ Top recommendation (highlight)
│  │  ├─ Alternative recommendations
│  │  └─ Confidence scores
│  │
│  ├─ SuggestNextActivity
│  │  ├─ "Add Next" button
│  │  └─ Suggestions based on current shapes
│  │
│  └─ ActivityPalette
│     ├─ Search/filter
│     └─ Activity cards (draggable)
│
├─ Main Content (center, scrollable)
│  │
│  ├─ ValidationErrorDisplay (conditional)
│  │  └─ Shape mismatch warnings
│  │
│  ├─ GoalEndpointIndicator
│  │  └─ Shows goal satisfaction status
│  │
│  └─ TrajectoryGridWithDnd
│     ├─ Column headers (0, 1, 2, ...)
│     ├─ Row headers (0, 1, 2, ...)
│     ├─ Activity cards (drag-and-drop)
│     │  ├─ Input shape indicators
│     │  ├─ Output shape indicators
│     │  └─ Task list (collapsible)
│     └─ "Insert Activity" buttons
│
└─ Info Panel (right, scrollable)
   │
   ├─ AvailableImpulsesPanel (NEW)
   │  ├─ Grouped by shape
   │  ├─ Produced-by indicator
   │  └─ Loaded status
   │
   ├─ ExecutionProgressPanel (NEW, during execution)
   │  ├─ Current activity highlight
   │  ├─ Progress bar
   │  └─ Real-time logs
   │
   └─ TrajectoryInfoPanel
      ├─ Activity count
      ├─ Column count
      └─ Help text
```

### State Management (Zustand Store)

```
trajectoryStore
│
├─ State
│  ├─ activities: TrajectoryActivity[]
│  ├─ impulses: Impulse[]  (NEW)
│  ├─ selectedActivityId: string | null
│  ├─ goalText: string
│  ├─ goalImpulse: Impulse | null  (NEW)
│  ├─ recommendations: ActivityRecommendation[]  (NEW)
│  ├─ isExecuting: boolean  (NEW)
│  └─ isDirty: boolean
│
└─ Actions
   ├─ addActivity(template, column, row)
   ├─ removeActivity(id)
   ├─ moveActivity(id, column, row)
   ├─ setGoalText(text)
   ├─ createGoalImpulse()  (NEW)
   ├─ addImpulse(impulse)  (NEW)
   ├─ computeAvailableShapes()  (NEW)
   ├─ fetchRecommendations()  (NEW)
   ├─ executeTrajectory()  (NEW)
   ├─ saveAsTemplate()  (NEW)
   └─ clearTrajectory()
```

---

## Summary: Key Visual Patterns

### Pattern 1: Iterative Composition
```
Goal → Recommend → Add → Update Shapes → Recommend → Add → ...
  ↑                                                          │
  └──────────────────── Loop until satisfied ───────────────┘
```

### Pattern 2: Automatic Impulse Flow
```
Activity A.output_shapes → Create Impulses → State Space → Activity B.input_shapes
```

### Pattern 3: Sequential + Parallel Execution
```
Column 0 (parallel rows) → Column 1 (parallel rows) → Column 2
   Wait for all              Wait for all              Final result
```

### Pattern 4: Learning Feedback
```
Execute → Trace → Backend → Thompson Update → Next Recommendation (improved)
   ↑                                                         │
   └────────────────── Continuous improvement ──────────────┘
```

---

**Related Files:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/trajectory-editor/specs/PROPER_END_TO_END_FLOW.md`
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/trajectory-editor/specs/KEY_QUESTIONS_ANSWERED.md`
