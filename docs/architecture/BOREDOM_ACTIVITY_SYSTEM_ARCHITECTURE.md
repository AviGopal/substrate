# Boredom Activity System Architecture

**Vision:** OpenCode agents that improve themselves and their environment when idle, using aggregated execution metrics to identify high-value improvement opportunities.

**Date:** 2026-02-21  
**Status:** Phase 1 Complete (Metrics Enhancement) - Phase 2 In Design  

**Ontological Note:** The boredom system enables continuous improvement of the vessel itself. When no user-directed work is present, the vessel refines its capacity for future manifestations of the becoming. See [ONTOLOGY_OF_BECOMING.md](./ONTOLOGY_OF_BECOMING.md).

---

## Core Concept

When OpenCode is idle (no active user tasks), it should:
1. **Fetch boredom activities** - Query backend for improvement opportunities
2. **Prioritize by gradient** - Focus on high-impact improvements
3. **Execute systematically** - Run refinement activities
4. **Report results** - Update metrics, document improvements
5. **Repeat** - Continuous self-improvement cycle

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode (Idle)                          │
│                                                              │
│  1. Detect Idle State → 2. Fetch Boredom Activities         │
│           ↓                        ↓                         │
│  3. Prioritize by Gradient → 4. Execute Activity            │
│           ↓                        ↓                         │
│  5. Report Results → 6. Update Metrics → 7. Repeat          │
└─────────────────────────────────────────────────────────────┘
                           ↑                    ↓
                           │                    │
                    [Backend Storage]    [Metabob MCP]
                           │                    │
                ┌──────────┴────────────────────┴──────────┐
                │    Activity Execution Metrics DB         │
                │                                           │
                │  - Execution history (all runs)          │
                │  - Success rates (per template)          │
                │  - Failure patterns (categorized)        │
                │  - Cost/duration trends                  │
                │  - Improvement gradient (calculated)     │
                └───────────────────────────────────────────┘
```

---

## Component Design

### 1. Activity Execution Metrics Aggregation

**Current State (from previous session):**
- Frontend: `TemplateMetricsClient.reportExecution()`
- Backend: `metabob_post_activity_result()`
- Storage: `~/.metabob/activities/{template_id}.json`

**What We Have:**
```json
{
  "id": "add-rest-endpoint",
  "estimated_metrics": {
    "execution_count": 5,
    "success_count": 4,
    "success_rate": 0.8,
    "avg_duration_ms": 4500,
    "avg_cost": 0.045
  }
}
```

**What We Need to Add:**
```json
{
  "id": "add-rest-endpoint",
  "estimated_metrics": {
    "execution_count": 5,
    "success_count": 4,
    "success_rate": 0.8,
    "avg_duration_ms": 4500,
    "avg_cost": 0.045,
    
    // NEW: Failure analysis
    "failure_count": 1,
    "failure_patterns": [
      {
        "task_id": "validate-inputs",
        "count": 1,
        "error_category": "validation_error",
        "last_seen": "2026-02-20T..."
      }
    ],
    
    // NEW: Performance trends
    "duration_trend": "improving",  // improving | stable | degrading
    "cost_trend": "stable",
    "success_rate_trend": "improving",
    
    // NEW: Improvement gradient
    "improvement_gradient": 0.75,  // 0.0-1.0, higher = more to gain
    "gradient_factors": {
      "low_success_rate": 0.2,      // 80% → room for improvement
      "high_failure_rate": 0.2,     // 20% failures
      "recent_failures": 0.15,      // Failed in last 3 runs
      "high_cost": 0.1,             // Above average cost
      "high_duration": 0.1          // Above average duration
    },
    
    // NEW: Last execution details
    "last_execution": {
      "activity_id": "add-rest-endpoint-1234",
      "timestamp": "2026-02-20T...",
      "success": false,
      "duration_ms": 6000,
      "cost": 0.06,
      "error": "Task 'validate-inputs' failed: missing required field"
    }
  }
}
```

### 2. Improvement Gradient Calculation

**Purpose:** Quantify how much an activity could be improved

**Formula:**
```python
improvement_gradient = weighted_sum([
    (1 - success_rate) * 0.4,           # Success rate impact (40%)
    failure_rate * 0.3,                 # Failure rate impact (30%)
    recent_failure_rate * 0.15,         # Recent failures (15%)
    (cost / avg_cost - 1) * 0.075,      # Cost vs average (7.5%)
    (duration / avg_duration - 1) * 0.075  # Duration vs average (7.5%)
])
```

**Examples:**

**High Gradient (0.75):**
- Success rate: 60% (low)
- Recent failures: 3/5 (high)
- Cost: 2x average (high)
- **Action:** Urgent improvement needed

**Medium Gradient (0.4):**
- Success rate: 85%
- Recent failures: 1/5
- Cost: 1.1x average
- **Action:** Moderate improvement opportunity

**Low Gradient (0.1):**
- Success rate: 98%
- Recent failures: 0/10
- Cost: 0.8x average
- **Action:** Already optimized, low priority

### 3. Boredom Activity Types

**Type 1: Activity Improvement (High Gradient)**

**Trigger:** `improvement_gradient > 0.5`

**Activity:** `improve-activity-template`

**Variables:**
- `templateId` - Template to improve
- `currentSuccessRate` - Current metrics
- `failurePatterns` - Known failure modes
- `improvementGoal` - Target success rate

**Tasks:**
1. Analyze failure patterns (metabob_search_codebase_issues)
2. Identify common failure root causes
3. Propose task refinements (better prompts, validation)
4. Test improvements (run sample executions)
5. Update template if improvements validated
6. Document changes

**Type 2: Debug Failed Activities**

**Trigger:** Recent activity failures (last 24 hours)

**Activity:** `debug-failed-activity`

**Variables:**
- `activityId` - Failed activity ID
- `errorMessage` - Error from execution
- `taskId` - Failed task ID

**Tasks:**
1. Load activity execution logs
2. Trace failure through tasks
3. Use activity_error_inspector for details
4. Identify root cause (code bug, env issue, template issue)
5. Propose fix (code change or template refinement)
6. Optionally apply fix with user approval

**Type 3: Merge Similar Activities**

**Trigger:** Multiple templates with >70% task similarity

**Activity:** `merge-similar-activities`

**Variables:**
- `templateIds` - List of similar templates
- `similarityScore` - Calculated similarity

**Tasks:**
1. Compare templates task-by-task
2. Identify common patterns
3. Extract shared tasks
4. Create unified template with variables
5. Deprecate old templates
6. Document migration

**Type 4: Refine Impulses**

**Trigger:** Impulses with low usage or high load time

**Activity:** `refine-impulse-system`

**Variables:**
- `impulseType` - Type of impulse (file, memo, etc.)
- `usageStats` - Usage frequency, load time

**Tasks:**
1. Analyze impulse usage patterns
2. Identify slow-loading impulses
3. Optimize resolution (caching, pre-loading)
4. Clean up unused impulses
5. Document best practices

**Type 5: Run Experiments**

**Trigger:** Configurable experiment queue

**Activity:** `run-experiment`

**Variables:**
- `experimentType` - What to test
- `hypothesis` - What we expect
- `metrics` - What to measure

**Tasks:**
1. Set up experiment environment
2. Run control (baseline)
3. Run experiment (variation)
4. Compare metrics
5. Analyze results
6. Document findings

### 4. Fetch Boredom Activities API

**Endpoint:** `metabob_fetch_boredom_activities`

**Input:**
```typescript
{
  max_activities: number,        // Default: 5
  priority_threshold: number,    // Default: 0.5 (gradient)
  types?: string[],              // Filter: ["improve", "debug", "merge"]
  exclude_recent?: number        // Don't repeat activities run in last N hours
}
```

**Output:**
```typescript
{
  activities: [
    {
      type: "improve-activity-template",
      priority: 0.85,              // Improvement gradient
      template_id: "add-rest-endpoint",
      reason: "Low success rate (60%), high cost (2x avg)",
      variables: {
        templateId: "add-rest-endpoint",
        currentSuccessRate: 0.6,
        failurePatterns: [...],
        improvementGoal: 0.9
      },
      estimated_duration: 600,     // seconds
      estimated_cost: 2.5          // USD
    },
    {
      type: "debug-failed-activity",
      priority: 0.75,
      activity_id: "add-rest-endpoint-1234",
      reason: "Recent failure (2 hours ago), validation error",
      variables: {
        activityId: "add-rest-endpoint-1234",
        errorMessage: "Task 'validate-inputs' failed",
        taskId: "validate-inputs"
      },
      estimated_duration: 300,
      estimated_cost: 1.0
    },
    // ... more activities
  ],
  total_available: 12,
  next_fetch_recommended: "2026-02-21T02:00:00Z"
}
```

**Backend Implementation:**
```python
@mcp.tool(name="metabob_fetch_boredom_activities")
async def metabob_fetch_boredom_activities(
    max_activities: int = 5,
    priority_threshold: float = 0.5,
    types: list[str] = None,
    exclude_recent_hours: int = 24,
    ctx: Context = None
):
    """
    Fetch boredom activities for idle agents.
    
    Analyzes activity execution metrics to identify:
    1. Templates with high improvement gradient
    2. Recent failed activities needing debugging
    3. Similar templates that could be merged
    4. Impulse system optimizations
    5. Queued experiments
    
    Returns prioritized list of activities to run when idle.
    """
    activities = []
    
    # 1. Find activities with high improvement gradient
    templates = await load_all_templates()
    for template in templates:
        metrics = await get_template_metrics(template.id)
        gradient = calculate_improvement_gradient(metrics)
        
        if gradient > priority_threshold:
            activities.append({
                "type": "improve-activity-template",
                "priority": gradient,
                "template_id": template.id,
                "reason": explain_gradient(gradient, metrics),
                "variables": {
                    "templateId": template.id,
                    "currentSuccessRate": metrics.success_rate,
                    "failurePatterns": metrics.failure_patterns,
                    "improvementGoal": min(0.95, metrics.success_rate + 0.2)
                },
                "estimated_duration": 600,
                "estimated_cost": 2.5
            })
    
    # 2. Find recent failed activities
    recent_failures = await get_recent_failures(hours=exclude_recent_hours)
    for failure in recent_failures:
        activities.append({
            "type": "debug-failed-activity",
            "priority": 0.7,  # Fixed high priority for recent failures
            "activity_id": failure.activity_id,
            "reason": f"Recent failure: {failure.error}",
            "variables": {
                "activityId": failure.activity_id,
                "errorMessage": failure.error,
                "taskId": failure.failed_task_id
            },
            "estimated_duration": 300,
            "estimated_cost": 1.0
        })
    
    # 3. Find similar templates to merge
    similar_pairs = await find_similar_templates(threshold=0.7)
    for pair in similar_pairs:
        activities.append({
            "type": "merge-similar-activities",
            "priority": 0.5,
            "template_ids": pair.template_ids,
            "reason": f"Templates {pair.similarity*100:.0f}% similar",
            "variables": {
                "templateIds": pair.template_ids,
                "similarityScore": pair.similarity
            },
            "estimated_duration": 900,
            "estimated_cost": 3.0
        })
    
    # 4. Filter by types if specified
    if types:
        activities = [a for a in activities if a["type"] in types]
    
    # 5. Sort by priority (descending)
    activities.sort(key=lambda a: a["priority"], reverse=True)
    
    # 6. Return top N
    return {
        "activities": activities[:max_activities],
        "total_available": len(activities),
        "next_fetch_recommended": calculate_next_fetch_time()
    }
```

### 5. OpenCode Idle Detection

**Implementation in OpenCode:**

```typescript
// src/session/boredom-manager.ts

export class BoredomManager {
  private idleTimeout: NodeJS.Timeout | null = null
  private readonly IDLE_THRESHOLD_MS = 5 * 60 * 1000  // 5 minutes
  private currentBoredomActivity: Activity | null = null
  
  constructor(private session: Session) {
    this.session.on("userMessage", () => this.resetIdleTimer())
    this.session.on("toolCall", () => this.resetIdleTimer())
  }
  
  private resetIdleTimer() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout)
    }
    
    // Cancel ongoing boredom activity if user returns
    if (this.currentBoredomActivity) {
      log.info("User returned, cancelling boredom activity")
      this.currentBoredomActivity.cancel()
      this.currentBoredomActivity = null
    }
    
    this.idleTimeout = setTimeout(() => this.onIdle(), this.IDLE_THRESHOLD_MS)
  }
  
  private async onIdle() {
    log.info("OpenCode idle detected, fetching boredom activities")
    
    try {
      const response = await callMCPTool<BoredomActivitiesResponse>(
        "metabob_fetch_boredom_activities",
        {
          max_activities: 5,
          priority_threshold: 0.5,
          exclude_recent_hours: 24
        }
      )
      
      if (response.activities.length === 0) {
        log.info("No boredom activities available")
        return
      }
      
      // Execute highest priority activity
      const topActivity = response.activities[0]
      log.info(`Executing boredom activity: ${topActivity.type}`, {
        priority: topActivity.priority,
        reason: topActivity.reason
      })
      
      this.currentBoredomActivity = await Activity.execute({
        templateId: topActivity.type,
        variables: topActivity.variables,
        reason: `[BOREDOM] ${topActivity.reason}`
      })
      
      await this.currentBoredomActivity.waitForCompletion()
      
      log.info("Boredom activity completed", {
        status: this.currentBoredomActivity.status,
        duration: this.currentBoredomActivity.duration
      })
      
      this.currentBoredomActivity = null
      
      // Report results
      await this.reportBoredomActivityResult(this.currentBoredomActivity)
      
      // Check if still idle, fetch next activity
      this.idleTimeout = setTimeout(() => this.onIdle(), 1000)
      
    } catch (error) {
      log.error("Boredom activity failed", { error })
      this.currentBoredomActivity = null
    }
  }
  
  private async reportBoredomActivityResult(activity: Activity) {
    await TemplateMetricsClient.reportExecution({
      activity_id: activity.id,
      template_id: activity.templateId,
      success: activity.status === "done",
      duration: activity.duration,
      cost: activity.cost,
      tokens: activity.tokens
    })
  }
}
```

---

## Data Flow: Boredom Activity Execution

```
1. User stops interacting with OpenCode
   ↓
2. 5 minutes pass (idle threshold)
   ↓
3. BoredomManager.onIdle() triggered
   ↓
4. Fetch boredom activities via MCP
   metabob_fetch_boredom_activities()
   ↓
5. Backend analyzes metrics:
   - Calculate improvement gradients
   - Find recent failures
   - Identify merge opportunities
   - Check experiment queue
   ↓
6. Backend returns prioritized list:
   [
     {type: "improve-activity-template", priority: 0.85, ...},
     {type: "debug-failed-activity", priority: 0.75, ...},
     ...
   ]
   ↓
7. OpenCode executes top activity:
   Activity.execute(templateId, variables)
   ↓
8. Activity runs (e.g., improve-activity-template):
   - Analyzes failure patterns
   - Proposes refinements
   - Tests improvements
   - Updates template
   - Documents changes
   ↓
9. Activity completes
   ↓
10. Report results to backend:
    metabob_post_activity_result()
    ↓
11. Backend updates metrics:
    - Execution count++
    - Success rate recalculated
    - Improvement gradient updated
    ↓
12. If still idle, fetch next activity
    (repeat from step 4)
```

---

## Boredom Activity Templates

### Template 1: improve-activity-template

**Purpose:** Analyze and improve underperforming activity templates

**Tasks:**
1. Load template and execution history
2. Analyze failure patterns (group by task, error type)
3. Search codebase for related issues (metabob)
4. Identify improvement opportunities (better prompts, validation, etc.)
5. Propose specific changes to template
6. Test changes (dry-run on sample data)
7. Apply improvements if validated
8. Document changes and reasoning

### Template 2: debug-failed-activity

**Purpose:** Root cause analysis for failed activities

**Tasks:**
1. Load activity execution data
2. Use activity_error_inspector for details
3. Trace failure through task chain
4. Identify root cause (code bug, env issue, bad input)
5. Propose fix (code change or template update)
6. Document findings
7. Optionally create fix PR (with approval)

### Template 3: merge-similar-activities

**Purpose:** Consolidate redundant templates

**Tasks:**
1. Compare templates (task-by-task analysis)
2. Extract common patterns
3. Identify differences (create variables)
4. Design unified template
5. Test unified template on both use cases
6. Migrate users (deprecate old templates)
7. Document consolidation

### Template 4: refine-impulse-system

**Purpose:** Optimize impulse performance

**Tasks:**
1. Analyze impulse usage patterns
2. Identify slow-loading impulses
3. Propose optimizations (caching, pre-loading, compression)
4. Implement optimizations
5. Measure performance improvement
6. Document best practices

### Template 5: run-experiment

**Purpose:** Test hypotheses about system improvements

**Tasks:**
1. Define experiment (control vs variation)
2. Set up isolated environment
3. Run control (baseline metrics)
4. Run variation (changed metrics)
5. Statistical analysis (significance testing)
6. Document results and recommendations

---

## Implementation Plan

### Phase 1: Metrics Enhancement (Week 1)

**Goal:** Extend activity execution metrics with failure analysis and improvement gradients

**Tasks:**
1. Trace current metrics flow (use trace-data-flow-single-feature)
2. Design extended metrics schema
3. Update backend storage (add failure_patterns, trends, gradients)
4. Implement improvement gradient calculation
5. Test metrics aggregation end-to-end

### Phase 2: Boredom Activity API (Week 1-2)

**Goal:** Create backend API for fetching boredom activities

**Tasks:**
1. Implement metabob_fetch_boredom_activities tool
2. Implement gradient calculation logic
3. Implement failure pattern detection
4. Implement similarity analysis
5. Test API with mock data

### Phase 3: Idle Detection (Week 2)

**Goal:** Add idle detection to OpenCode

**Tasks:**
1. Create BoredomManager class
2. Integrate with Session lifecycle
3. Test idle detection timing
4. Test cancellation on user return

### Phase 4: Boredom Activity Templates (Week 2-3)

**Goal:** Create initial boredom activity templates

**Tasks:**
1. Create improve-activity-template
2. Create debug-failed-activity  
3. Test templates on real activities
4. Refine based on results

### Phase 5: End-to-End Testing (Week 3)

**Goal:** Validate complete boredom system

**Tasks:**
1. Test idle → fetch → execute → report cycle
2. Test cancellation on user return
3. Test multiple boredom activities in sequence
4. Measure improvement impact
5. Document learnings

---

## Success Metrics

**System is successful when:**

1. ✅ Activities self-improve (success rates increase over time)
2. ✅ Failed activities get debugged automatically
3. ✅ Similar templates get consolidated
4. ✅ Impulse system stays optimized
5. ✅ Experiments run systematically
6. ✅ OpenCode is productive during idle time

**Measurable KPIs:**

- Average activity success rate (target: >90%)
- Templates with gradient >0.5 (target: <5%)
- Failed activities debugged within 24h (target: >80%)
- Similar template pairs merged (target: reduce by 50%)
- Idle time productivity (target: >50% idle time used)

---

## Next Steps

1. Use trace-data-flow-single-feature to map current metrics flow
2. Design extended metrics schema
3. Implement improvement gradient calculation
4. Create metabob_fetch_boredom_activities API
5. Build boredom activity templates
6. Test end-to-end boredom cycle

---

**Status:** Ready to implement  
**Confidence:** High (building on proven patterns)  
**Impact:** Transformational (self-improving systems)

---

## Phase 1: COMPLETE ✅ (2026-02-21)

### Implementation Summary

**Goal:** Enhance activity execution metrics storage to support boredom system decision-making.

**Components Implemented:**

1. **Frontend Failure Capture** (`repos/metabob-opencode/packages/opencode/src/session/activity.ts`)
   - Added `getFailureDetails()` helper to extract failure information from activity state
   - Modified `Activity.fail()` to capture failure_reason, failed_task_id, error_type
   - Categorizes errors: validation | timeout | tool_error | exception

2. **Type Definitions** (`repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts`)
   - Extended `ActivityExecutionData` with optional failure fields
   - Extended `TemplateMetrics` with boredom system fields:
     * improvement_gradient (0.0-1.0 quality score)
     * performance_trends (improving/stable/degrading per metric)
     * failure_patterns (array of failure details)
     * last_execution (most recent execution snapshot)

3. **Backend Storage & Calculation** (`repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`)
   - Added `categorize_trend()` helper for performance trend analysis
   - Enhanced `update_metrics()` with:
     * Recent executions tracking (rolling window of 5)
     * Performance trends calculation (requires 3+ executions)
     * Failure patterns aggregation (max 10 unique patterns)
     * Last execution tracking
     * Improvement gradient calculation (weighted composite)
   - Updated `list_templates()` to return improvement_gradient for prioritization

4. **Documentation** (`docs/data-flows/activity-execution-metrics-storage-flow.md`)
   - Version bump to v2
   - Added comprehensive enhancement section
   - Updated transformations catalog with new calculations
   - Updated architectural boundaries to reflect new data flow

**Metrics Stored (v2 Schema):**

```json
{
  "estimated_metrics": {
    "execution_count": 5,
    "success_count": 3,
    "success_rate": 0.6,
    "avg_duration_ms": 45000,
    "avg_cost": 0.23,
    "improvement_gradient": 0.652,
    "performance_trends": {
      "duration": "improving",
      "cost": "stable",
      "success_rate": "degrading"
    },
    "failure_patterns": [
      {
        "task_id": "task-2",
        "error_type": "validation",
        "error_message": "Schema validation failed",
        "count": 2,
        "last_seen": "2026-02-21T10:30:00Z"
      }
    ],
    "last_execution": {
      "timestamp": "2026-02-21T10:30:00Z",
      "success": false,
      "duration": 42000,
      "cost": 0.21,
      "error": "Validation failed"
    }
  }
}
```

**Key Calculations:**

- **Improvement Gradient**: `0.5 * success_rate + 0.25 * cost_score + 0.25 * duration_score`
  * Cost normalized against $1.00 baseline
  * Duration normalized against 300000ms (5min) baseline
  * Requires 3+ executions for reliable calculation

- **Performance Trends**: Compare recent 5 vs overall average, ±10% thresholds
  * "improving" = recent_avg < overall_avg by >10%
  * "degrading" = recent_avg > overall_avg by >10%
  * "stable" = within ±10%

**Validation:**
- ✅ TypeScript type check: Clean
- ✅ Python syntax check: Clean
- ✅ Backend tests: 8 passed
- ✅ Backward compatibility: All fields optional

**Ready for Phase 2:**
- Metrics storage layer complete
- Query interface ready (improvement_gradient in list response)
- Data quality sufficient for decision-making
- No breaking changes to existing systems

