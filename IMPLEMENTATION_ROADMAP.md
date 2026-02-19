# Activity Metrics & A/B Testing: Implementation Roadmap

**Date:** 2026-02-18  
**Status:** Ready for Implementation  
**Goal:** Close the metrics recording gap and enable A/B testing for template improvement

---

## Overview

This document organizes all necessary changes by priority, dependencies, and effort. Changes are grouped into **Phases** that can be implemented sequentially or in parallel where dependencies allow.

---

## Current State Summary

### ✅ What's Already Built
- `executionEvidence` schema with session tracking
- `validationEvidence` for command execution
- `workArtifacts` tracking
- `correctnessVerdict` computation
- Session tracking with `taskId` field

### ❌ What's Missing
- Verification that activities complete properly
- Analysis script using new evidence fields
- Template name population
- A/B testing infrastructure

---

## Phase 0: Verification & Cleanup (Critical Prerequisites)

**Goal:** Ensure existing infrastructure works and data is clean  
**Duration:** 1 day  
**Blocking:** Yes - Must complete before other phases

### 0.1 Test Evidence Collection (2 hours)

**File:** None (manual testing)  
**Priority:** P0 - CRITICAL  
**Dependencies:** None  

**Tasks:**
1. Run real activity with template
2. Verify `executionEvidence.sessionsSpawned` populated
3. Check status transitions (setup → executing → done)
4. Verify taskId field populated correctly
5. Check validation and artifacts tracking

**Verification:**
```bash
# Test command
cd repos/metabob-opencode
bun run opencode activity \
  --template "fix-bug-complete" \
  --variables '{"bugDescription":"test","files":["test.ts"]}' \
  --reason "Testing evidence collection"

# Check result
ACTIVITY=$(ls -t ~/.local/share/opencode/storage/activity/*.json | head -1)
cat "$ACTIVITY" | jq '{
  status,
  templateId,
  sessions: .executionEvidence.sessionsSpawned | length,
  tasks: [.executionEvidence.sessionsSpawned[].taskId],
  validated: .validationEvidence.executed,
  verdict: .correctnessVerdict.verdict
}'
```

**Expected Output:**
```json
{
  "status": "done",
  "templateId": "fix-bug-complete",
  "sessions": 2,
  "tasks": ["diagnose", "implement-fix"],
  "validated": true,
  "verdict": "correct"
}
```

**If Test Fails:**
- Debug status transitions in `activity.ts`
- Fix evidence initialization
- Update execution path

**Deliverable:** Confirmation that evidence collection works

---

### 0.2 Clean Test Data (30 minutes)

**File:** Script or manual  
**Priority:** P0 - CRITICAL  
**Dependencies:** None  

**Tasks:**
1. Archive test-template-* activities
2. Remove or flag test fixtures
3. Document cleanup in git

**Commands:**
```bash
cd ~/.local/share/opencode/storage/activity
mkdir -p ../activity-archive/test-data-$(date +%Y%m%d)
mv act_*test-template*.json ../activity-archive/test-data-$(date +%Y%m%d)/
echo "Archived $(ls ../activity-archive/test-data-$(date +%Y%m%d)/*.json | wc -l) test activities"
```

**Verification:**
```bash
# Should show only real activities
ls -lt *.json | head -10
```

**Deliverable:** Clean activity storage with only real executions

---

### 0.3 Populate Template Names (1 hour)

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Priority:** P1 - HIGH  
**Dependencies:** None  

**Current Issue:**
```json
{
  "templateId": "fix-bug-complete",
  "templateName": null  // ← Always null
}
```

**Change:**
```typescript
// In Activity.create() or during template execution
// File: activity.ts, around line 430

export async function createFromTemplate(
  template: ActivityTemplate.Template,
  variables: Record<string, unknown>,
  reason?: string
): Promise<Info> {
  const activity = await create({
    directory: process.cwd(),
    title: template.name,  // ← Use template name
    // ...
  })
  
  // Add template metadata
  activity.templateId = template.id
  activity.templateName = template.name  // ← NEW: Populate from template
  activity.templateVersion = template.version.generation
  activity.variables = variables
  activity.reason = reason
  
  await save(activity)
  return activity
}
```

**Verification:**
```typescript
// After fix, activities should have:
{
  "templateId": "fix-bug-complete",
  "templateName": "Fix Bug Complete"  // ← Populated!
}
```

**Deliverable:** All new activities have human-readable templateName

---

## Phase 1: Analysis Script Updates (Data Access Layer)

**Goal:** Update analysis tools to use new evidence fields  
**Duration:** 1 day  
**Blocking:** No - Can run in parallel with Phase 2  
**Dependencies:** Phase 0.1, 0.2

### 1.1 Update analyze_template_performance.py (3 hours)

**File:** `analyze_template_performance.py`  
**Priority:** P0 - CRITICAL  
**Dependencies:** Phase 0.1 (verification that evidence works)  

**Current Issue:**
```python
# Looks for "tasks" field that doesn't exist
tasks = data.get("tasks", [])
```

**Changes Required:**

**1. Add helper function to extract task metrics:**
```python
def extract_task_metrics(data: dict) -> tuple[int, int, float]:
    """
    Extract task execution metrics from activity data.
    
    Returns: (task_count, failed_tasks, success_rate)
    """
    # NEW: Use executionEvidence if available
    execution_evidence = data.get("executionEvidence", {})
    sessions_spawned = execution_evidence.get("sessionsSpawned", [])
    
    if sessions_spawned:
        # Template-based activity with evidence tracking
        unique_tasks = set(s.get("taskId") for s in sessions_spawned if s.get("taskId"))
        task_count = len(unique_tasks)
        
        if task_count == 0:
            return 0, 0, 0.0
        
        # Task succeeded if:
        # - Session completed (endTime > startTime)
        # - Did actual work (toolCallCount > 0)
        successful_tasks = set()
        task_sessions = {}  # Track all sessions per task
        
        for session in sessions_spawned:
            task_id = session.get("taskId")
            if not task_id:
                continue
            
            if task_id not in task_sessions:
                task_sessions[task_id] = []
            task_sessions[task_id].append(session)
        
        # Task is successful if ANY of its sessions succeeded
        for task_id, sessions in task_sessions.items():
            for session in sessions:
                completed = session.get("endTime", 0) > session.get("startTime", 0)
                did_work = session.get("toolCallCount", 0) > 0
                
                if completed and did_work:
                    successful_tasks.add(task_id)
                    break  # Task succeeded, no need to check other sessions
        
        failed_tasks = task_count - len(successful_tasks)
        success_rate = len(successful_tasks) / task_count
        
        return task_count, failed_tasks, success_rate
    
    # FALLBACK: Use prompts for prompt-based activities (backward compat)
    prompts = data.get("prompts", [])
    if prompts:
        prompt_count = len(prompts)
        failed_prompts = sum(1 for p in prompts if p.get("status") == "failed")
        success_rate = (prompt_count - failed_prompts) / prompt_count if prompt_count > 0 else 0.0
        return prompt_count, failed_prompts, success_rate
    
    # No execution data
    return 0, 0, 0.0
```

**2. Update ActivityExecution dataclass:**
```python
@dataclass
class ActivityExecution:
    # ... existing fields ...
    
    # Add task detail
    tasks_executed: List[str]  # NEW: List of task IDs
    task_details: Dict[str, Dict]  # NEW: Per-task metrics
```

**3. Update load_storage_data to use helper:**
```python
# In load_storage_data(), replace task extraction with:

task_count, failed_tasks, success_rate = extract_task_metrics(data)

# Extract task details for deeper analysis
execution_evidence = data.get("executionEvidence", {})
sessions_spawned = execution_evidence.get("sessionsSpawned", [])
tasks_executed = list(set(s.get("taskId") for s in sessions_spawned if s.get("taskId")))

task_details = {}
for task_id in tasks_executed:
    task_sessions = [s for s in sessions_spawned if s.get("taskId") == task_id]
    task_details[task_id] = {
        "sessions": len(task_sessions),
        "total_messages": sum(s.get("messageCount", 0) for s in task_sessions),
        "total_tool_calls": sum(s.get("toolCallCount", 0) for s in task_sessions),
        "avg_duration": sum(s.get("endTime", 0) - s.get("startTime", 0) for s in task_sessions) / len(task_sessions) if task_sessions else 0
    }

executions.append(ActivityExecution(
    # ... existing fields ...
    task_count=task_count,
    failed_tasks=failed_tasks,
    success_rate=success_rate,
    tasks_executed=tasks_executed,
    task_details=task_details
))
```

**4. Update report to show task-level details:**
```python
def print_report(metrics: List[TemplateMetrics], ab_analysis: Dict):
    # ... existing report sections ...
    
    # NEW SECTION: Task-Level Analysis
    print("\n" + "=" * 100)
    print("TASK-LEVEL PERFORMANCE")
    print("=" * 100)
    
    # Aggregate task stats across all templates
    task_stats = defaultdict(lambda: {"executions": 0, "success": 0, "avg_messages": 0, "avg_tool_calls": 0})
    
    for m in metrics:
        # Would need to track this per execution in calculate_metrics
        pass  # Implementation details
    
    print(f"\n{'Task Name':30s} {'Executions':>12s} {'Success Rate':>14s} {'Avg Messages':>14s} {'Avg Tool Calls':>14s}")
    print("-" * 100)
    # ... print task stats ...
```

**Testing:**
```bash
python3 analyze_template_performance.py

# Should now show:
# - Non-zero success rates
# - Real costs and durations
# - Task-level breakdown
```

**Deliverable:** Analysis script works with new evidence fields

---

### 1.2 Add Task Performance Analyzer (2 hours)

**File:** `analyze_task_performance.py` (NEW)  
**Priority:** P2 - MEDIUM  
**Dependencies:** Phase 1.1  

**Purpose:** Detailed task-level performance analysis

**Features:**
- Success rate per task across all templates
- Identify consistently failing tasks
- Find performance bottlenecks (long-running tasks)
- Detect tasks with high retry rates

**Usage:**
```bash
python3 analyze_task_performance.py

# Output:
# Task: "diagnose"
#   Executions: 45
#   Success Rate: 92%
#   Avg Duration: 8.5s
#   Avg Cost: $0.0089
#   Used in: fix-bug-complete, debug-issue, analyze-error
#
# Task: "implement-fix"
#   Executions: 42
#   Success Rate: 78%  ← Lower!
#   Avg Duration: 25.3s
#   Avg Cost: $0.0234
#   Common failures: validation, test failures
```

**Deliverable:** Task-level insights for template improvement

---

## Phase 2: A/B Testing Infrastructure (Core System)

**Goal:** Implement stable/candidate selection and metrics tracking  
**Duration:** 3-4 days  
**Blocking:** No - Can run in parallel with Phase 1  
**Dependencies:** Phase 0 (clean data)

### 2.1 Extend Activity Template Schema (2 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`  
**Priority:** P1 - HIGH  
**Dependencies:** None  

**Changes Required:**

**1. Add A/B testing fields to template schema:**
```typescript
// Around line 100, after existing fields

export const Schema = z.object({
  // ... existing fields (id, name, category, tasks, etc.) ...
  
  // A/B Testing fields
  status: z.enum(["stable", "candidate", "archived", "deprecated"])
    .default("stable")
    .describe("Template lifecycle status"),
  
  stableVariantId: z.string().optional()
    .describe("If candidate, points to stable version"),
  
  candidateIds: z.array(z.string()).default([])
    .describe("If stable, lists active candidates"),
  
  allocationWeight: z.number().min(0).max(1).default(1.0)
    .describe("Traffic allocation weight (0.0-1.0)"),
  
  abTestConfig: z.object({
    enabled: z.boolean().default(false),
    startedAt: z.number().optional(),
    minSampleSize: z.number().default(20),
    confidenceLevel: z.number().default(0.95)
  }).optional()
    .describe("A/B test configuration"),
  
  // ... rest of schema ...
})
```

**2. Add type exports:**
```typescript
export type TemplateStatus = z.infer<typeof Schema>["status"]
export type ABTestConfig = z.infer<typeof Schema>["abTestConfig"]
```

**3. Update template creation to set defaults:**
```typescript
export async function create(options: CreateOptions): Promise<Template> {
  const template: Template = {
    // ... existing fields ...
    
    // Set A/B testing defaults
    status: options.status || "stable",
    candidateIds: [],
    allocationWeight: 1.0,
    
    // ... rest of creation ...
  }
  
  return template
}
```

**Testing:**
```typescript
// Should compile without errors
const template = await ActivityTemplate.create({
  name: "Test Template",
  status: "candidate",  // NEW
  stableVariantId: "stable-id"  // NEW
})
```

**Deliverable:** Schema supports A/B testing fields

---

### 2.2 Implement Template Selection Algorithm (4 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts` (NEW)  
**Priority:** P1 - HIGH  
**Dependencies:** Phase 2.1  

**Purpose:** Probabilistic A/B test allocation

**Implementation:**
```typescript
import { ActivityTemplate } from "./activity-template"
import { Log } from "../util/log"

const log = Log.create({ service: "template-selector" })

export interface SelectionResult {
  templateId: string
  templateName: string
  variant: "stable" | "candidate"
  reason: string
}

export interface AllocationStrategy {
  stableWeight: number  // e.g., 0.9
  candidateWeight: number  // e.g., 0.1
}

const DEFAULT_STRATEGY: AllocationStrategy = {
  stableWeight: 0.9,
  candidateWeight: 0.1
}

/**
 * Select a template variant for execution (stable or candidate).
 * 
 * Implements probabilistic A/B testing:
 * - 90% of traffic → stable version
 * - 10% of traffic → split among candidates
 */
export async function selectTemplate(
  baseTemplateId: string,
  strategy: AllocationStrategy = DEFAULT_STRATEGY
): Promise<SelectionResult> {
  
  // 1. Load base template (should be stable)
  const stable = await ActivityTemplate.load(baseTemplateId)
  
  if (!stable) {
    throw new Error(`Template not found: ${baseTemplateId}`)
  }
  
  // 2. If not stable or no candidates, return base
  if (stable.status !== "stable" || stable.candidateIds.length === 0) {
    return {
      templateId: stable.id,
      templateName: stable.name,
      variant: "stable",
      reason: stable.status !== "stable" 
        ? "Base template is not stable" 
        : "No active candidates"
    }
  }
  
  // 3. Load active candidates
  const candidates = await Promise.all(
    stable.candidateIds.map(id => ActivityTemplate.load(id))
  )
  
  const activeCandidates = candidates.filter(c => c && c.status === "candidate")
  
  if (activeCandidates.length === 0) {
    log.info("No active candidates found", { baseTemplateId, candidateIds: stable.candidateIds })
    return {
      templateId: stable.id,
      templateName: stable.name,
      variant: "stable",
      reason: "No active candidates"
    }
  }
  
  // 4. Probabilistic selection
  const roll = Math.random()
  
  log.debug("A/B test allocation", {
    baseTemplateId,
    roll,
    stableWeight: strategy.stableWeight,
    candidateCount: activeCandidates.length
  })
  
  // Stable gets majority of traffic
  if (roll < strategy.stableWeight) {
    return {
      templateId: stable.id,
      templateName: stable.name,
      variant: "stable",
      reason: `A/B test: stable allocation (${strategy.stableWeight * 100}%)`
    }
  }
  
  // Candidates split remaining traffic equally
  const candidateTraffic = 1.0 - strategy.stableWeight
  const perCandidateWeight = candidateTraffic / activeCandidates.length
  
  const candidateRoll = (roll - strategy.stableWeight) / candidateTraffic
  const selectedIndex = Math.floor(candidateRoll / perCandidateWeight)
  
  const selected = activeCandidates[Math.min(selectedIndex, activeCandidates.length - 1)]
  
  log.info("A/B test: candidate selected", {
    baseTemplateId,
    selectedId: selected.id,
    selectedName: selected.name,
    candidateIndex: selectedIndex,
    totalCandidates: activeCandidates.length
  })
  
  return {
    templateId: selected.id,
    templateName: selected.name,
    variant: "candidate",
    reason: `A/B test: candidate allocation (${(candidateTraffic / activeCandidates.length * 100).toFixed(1)}%)`
  }
}

/**
 * Get allocation weights for reporting.
 */
export function getAllocationWeights(
  stable: ActivityTemplate.Template,
  strategy: AllocationStrategy = DEFAULT_STRATEGY
): Record<string, number> {
  const weights: Record<string, number> = {
    [stable.id]: strategy.stableWeight
  }
  
  if (stable.candidateIds.length > 0) {
    const candidateTraffic = 1.0 - strategy.stableWeight
    const perCandidate = candidateTraffic / stable.candidateIds.length
    
    for (const candidateId of stable.candidateIds) {
      weights[candidateId] = perCandidate
    }
  }
  
  return weights
}
```

**Testing:**
```typescript
// Test selection distribution
const results = { stable: 0, candidate: 0 }

for (let i = 0; i < 1000; i++) {
  const selected = await selectTemplate("fix-bug-complete")
  results[selected.variant]++
}

// Should be ~900 stable, ~100 candidate
console.log(results)
// { stable: 897, candidate: 103 }
```

**Deliverable:** Working template selection with A/B allocation

---

### 2.3 Integrate Selection into Activity Tool (2 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Priority:** P1 - HIGH  
**Dependencies:** Phase 2.2  

**Changes:**

**1. Import template selector:**
```typescript
import { selectTemplate } from "../session/template-selector"
```

**2. Update activity execution to use selector:**
```typescript
// Around line 150, in activity tool execute()

// OLD:
const template = await ActivityTemplate.load(templateId)

// NEW:
const selection = await selectTemplate(templateId)
const template = await ActivityTemplate.load(selection.templateId)

// Log selection for metrics
log.info("Template selected for execution", {
  requested: templateId,
  selected: selection.templateId,
  variant: selection.variant,
  reason: selection.reason
})

// Store selection info in activity for tracking
activity.abTestSelection = {
  requestedTemplate: templateId,
  selectedTemplate: selection.templateId,
  variant: selection.variant,
  reason: selection.reason,
  timestamp: Date.now()
}
```

**3. Add selection info to Activity schema:**
```typescript
// In activity.ts, add to Activity.Info schema

abTestSelection: z.object({
  requestedTemplate: z.string(),
  selectedTemplate: z.string(),
  variant: z.enum(["stable", "candidate"]),
  reason: z.string(),
  timestamp: z.number()
}).optional()
  .describe("A/B test selection metadata")
```

**Testing:**
```bash
# Run activity multiple times, check variant distribution
for i in {1..20}; do
  bun run opencode activity --template "fix-bug-complete" \
    --variables '{"test":"'$i'"}' --reason "A/B test $i"
done

# Check distribution
ls ~/.local/share/opencode/storage/activity/*.json | \
  xargs -I {} jq -r '.abTestSelection.variant' {} | \
  sort | uniq -c

# Expected: ~18 stable, ~2 candidate
```

**Deliverable:** Activities automatically use A/B selection

---

### 2.4 Template Metrics Aggregation (3 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts` (NEW)  
**Priority:** P1 - HIGH  
**Dependencies:** Phase 1.1, Phase 2.1  

**Purpose:** Real-time metrics calculation for promotion decisions

**Implementation:**
```typescript
import { Activity } from "./activity"
import { ActivityTemplate } from "./activity-template"

export interface TemplateMetrics {
  templateId: string
  templateName: string
  status: "stable" | "candidate" | "archived" | "deprecated"
  
  // Execution counts
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  
  // Success metrics
  successRate: number
  taskSuccessRate: number  // Average across all tasks
  
  // Cost metrics
  totalCost: number
  avgCost: number
  minCost: number
  maxCost: number
  
  // Duration metrics
  avgDuration: number
  minDuration: number
  maxDuration: number
  
  // Task-level details
  taskMetrics: Record<string, {
    executions: number
    successRate: number
    avgDuration: number
    avgCost: number
  }>
  
  // Timestamps
  firstExecution: number
  lastExecution: number
  
  // Trend
  recentSuccessRate: number  // Last 10 executions
  trend: "improving" | "stable" | "degrading"
}

/**
 * Calculate metrics for a template from activity executions.
 */
export async function calculateMetrics(templateId: string): Promise<TemplateMetrics> {
  // 1. Load template
  const template = await ActivityTemplate.load(templateId)
  if (!template) {
    throw new Error(`Template not found: ${templateId}`)
  }
  
  // 2. Load all executions for this template
  const allActivities = await Activity.list()
  const executions = allActivities.filter(a => a.templateId === templateId)
  
  if (executions.length === 0) {
    // No executions yet
    return {
      templateId,
      templateName: template.name,
      status: template.status,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      successRate: 0,
      taskSuccessRate: 0,
      totalCost: 0,
      avgCost: 0,
      minCost: 0,
      maxCost: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      taskMetrics: {},
      firstExecution: 0,
      lastExecution: 0,
      recentSuccessRate: 0,
      trend: "stable"
    }
  }
  
  // 3. Calculate execution metrics
  const successful = executions.filter(a => a.status === "done")
  const failed = executions.filter(a => a.status === "failed")
  
  const successRate = successful.length / executions.length
  
  // 4. Calculate cost metrics
  const costs = executions.map(a => a.stats.cost.total).filter(c => c > 0)
  const totalCost = costs.reduce((sum, c) => sum + c, 0)
  const avgCost = costs.length > 0 ? totalCost / costs.length : 0
  const minCost = costs.length > 0 ? Math.min(...costs) : 0
  const maxCost = costs.length > 0 ? Math.max(...costs) : 0
  
  // 5. Calculate duration metrics
  const durations = executions.map(a => a.stats.duration).filter(d => d > 0)
  const avgDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0
  
  // 6. Calculate task-level metrics
  const taskMetrics: Record<string, any> = {}
  const taskExecutions: Record<string, Array<{success: boolean, duration: number, cost: number}>> = {}
  
  for (const activity of executions) {
    const evidence = activity.executionEvidence
    if (!evidence) continue
    
    for (const session of evidence.sessionsSpawned) {
      const taskId = session.taskId
      if (!taskId) continue
      
      if (!taskExecutions[taskId]) {
        taskExecutions[taskId] = []
      }
      
      const success = session.endTime > session.startTime && session.toolCallCount > 0
      const duration = session.endTime - session.startTime
      const cost = (activity.stats.cost.total / evidence.sessionsSpawned.length) // Rough estimate
      
      taskExecutions[taskId].push({ success, duration, cost })
    }
  }
  
  for (const [taskId, execs] of Object.entries(taskExecutions)) {
    const successCount = execs.filter(e => e.success).length
    taskMetrics[taskId] = {
      executions: execs.length,
      successRate: successCount / execs.length,
      avgDuration: execs.reduce((sum, e) => sum + e.duration, 0) / execs.length,
      avgCost: execs.reduce((sum, e) => sum + e.cost, 0) / execs.length
    }
  }
  
  const avgTaskSuccessRate = Object.values(taskMetrics)
    .reduce((sum: number, m: any) => sum + m.successRate, 0) / Object.keys(taskMetrics).length
  
  // 7. Calculate trend
  const sorted = [...executions].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
  const recent = sorted.slice(-10)
  const recentSuccessful = recent.filter(a => a.status === "done").length
  const recentSuccessRate = recentSuccessful / recent.length
  
  let trend: "improving" | "stable" | "degrading" = "stable"
  if (recentSuccessRate > successRate + 0.1) {
    trend = "improving"
  } else if (recentSuccessRate < successRate - 0.1) {
    trend = "degrading"
  }
  
  return {
    templateId,
    templateName: template.name,
    status: template.status,
    totalExecutions: executions.length,
    successfulExecutions: successful.length,
    failedExecutions: failed.length,
    successRate,
    taskSuccessRate: avgTaskSuccessRate || 0,
    totalCost,
    avgCost,
    minCost,
    maxCost,
    avgDuration,
    minDuration,
    maxDuration,
    taskMetrics,
    firstExecution: sorted[0]?.startedAt || 0,
    lastExecution: sorted[sorted.length - 1]?.startedAt || 0,
    recentSuccessRate,
    trend
  }
}

/**
 * Calculate metrics for stable vs candidate comparison.
 */
export async function compareVariants(
  stableId: string,
  candidateId: string
): Promise<{
  stable: TemplateMetrics
  candidate: TemplateMetrics
  comparison: {
    successRateDelta: number
    costDelta: number
    costDeltaPct: number
    durationDelta: number
    durationDeltaPct: number
  }
}> {
  const [stable, candidate] = await Promise.all([
    calculateMetrics(stableId),
    calculateMetrics(candidateId)
  ])
  
  const comparison = {
    successRateDelta: candidate.successRate - stable.successRate,
    costDelta: candidate.avgCost - stable.avgCost,
    costDeltaPct: stable.avgCost > 0 ? ((candidate.avgCost - stable.avgCost) / stable.avgCost) * 100 : 0,
    durationDelta: candidate.avgDuration - stable.avgDuration,
    durationDeltaPct: stable.avgDuration > 0 ? ((candidate.avgDuration - stable.avgDuration) / stable.avgDuration) * 100 : 0
  }
  
  return { stable, candidate, comparison }
}
```

**Deliverable:** Real-time metrics calculation for templates

---

## Phase 3: Promotion & Pruning Engine (Decision Logic)

**Goal:** Automated evaluation and lifecycle management  
**Duration:** 2 days  
**Dependencies:** Phase 2 (metrics infrastructure)

### 3.1 Statistical Testing Library (3 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/util/stats.ts` (NEW)  
**Priority:** P1 - HIGH  
**Dependencies:** None  

**Purpose:** Chi-square test for success rate significance

**Implementation:**
```typescript
/**
 * Perform chi-square test for two proportions.
 * 
 * H0: p1 = p2 (success rates are equal)
 * H1: p1 ≠ p2 (success rates differ)
 * 
 * Returns p-value. If p < 0.05, difference is statistically significant.
 */
export function chiSquareTest(
  successes1: number,
  total1: number,
  successes2: number,
  total2: number
): number {
  const failures1 = total1 - successes1
  const failures2 = total2 - successes2
  
  const totalSuccesses = successes1 + successes2
  const totalFailures = failures1 + failures2
  const grandTotal = total1 + total2
  
  // Expected values
  const expectedSuccesses1 = (total1 * totalSuccesses) / grandTotal
  const expectedFailures1 = (total1 * totalFailures) / grandTotal
  const expectedSuccesses2 = (total2 * totalSuccesses) / grandTotal
  const expectedFailures2 = (total2 * totalFailures) / grandTotal
  
  // Chi-square statistic
  const chiSquare = 
    Math.pow(successes1 - expectedSuccesses1, 2) / expectedSuccesses1 +
    Math.pow(failures1 - expectedFailures1, 2) / expectedFailures1 +
    Math.pow(successes2 - expectedSuccesses2, 2) / expectedSuccesses2 +
    Math.pow(failures2 - expectedFailures2, 2) / expectedFailures2
  
  // Degrees of freedom = 1 for 2x2 contingency table
  // Approximate p-value using chi-square distribution
  const pValue = 1 - cumulativeChiSquare(chiSquare, 1)
  
  return pValue
}

/**
 * Cumulative chi-square distribution (approximation).
 */
function cumulativeChiSquare(x: number, df: number): number {
  // For df=1, use gamma function approximation
  if (df === 1) {
    return erf(Math.sqrt(x / 2))
  }
  
  // For other df, use more complex approximation
  // (simplified for now)
  return 0.5
}

/**
 * Error function (erf) approximation.
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)
  
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  
  return sign * y
}
```

**Testing:**
```typescript
// Test with known values
const pValue = chiSquareTest(90, 100, 70, 100)
console.log(pValue)  // Should be < 0.05 (significant difference)
```

**Deliverable:** Statistical testing for promotion decisions

---

### 3.2 Promotion Decision Engine (4 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/session/promotion-engine.ts` (NEW)  
**Priority:** P1 - HIGH  
**Dependencies:** Phase 2.4, Phase 3.1  

**Purpose:** Automated promotion/pruning decisions

**Implementation:**
```typescript
import { calculateMetrics, compareVariants } from "./template-metrics"
import { chiSquareTest } from "../util/stats"
import { Log } from "../util/log"

const log = Log.create({ service: "promotion-engine" })

export interface PromotionCriteria {
  minSampleSize: number  // Min executions before decision
  confidenceLevel: number  // Statistical confidence (0.95 = p < 0.05)
  
  // Improvement thresholds
  minSuccessRateImprovement: number  // e.g., 0.05 = +5%
  maxCostIncreasePct: number  // e.g., 10 = +10% cost acceptable
  maxDurationIncreasePct: number  // e.g., 10 = +10% duration acceptable
}

export interface PruningCriteria {
  minExecutions: number  // Min before pruning
  maxFailureRate: number  // e.g., 0.7 = 70% failure → prune
  noImprovementAfter: number  // e.g., 50 executions with no improvement
}

export const DEFAULT_CRITERIA: PromotionCriteria = {
  minSampleSize: 20,
  confidenceLevel: 0.95,
  minSuccessRateImprovement: 0.05,
  maxCostIncreasePct: 10,
  maxDurationIncreasePct: 10
}

export const DEFAULT_PRUNING: PruningCriteria = {
  minExecutions: 10,
  maxFailureRate: 0.7,
  noImprovementAfter: 50
}

export interface Decision {
  action: "PROMOTE" | "CONTINUE_TESTING" | "PRUNE"
  reason: string
  confidence: number
  details: {
    sampleSize: number
    successRateDelta: number
    costDeltaPct: number
    durationDeltaPct: number
    pValue: number
    meetsThresholds: {
      sampleSize: boolean
      successRate: boolean
      cost: boolean
      duration: boolean
      significance: boolean
    }
  }
}

/**
 * Evaluate whether to promote a candidate to stable.
 */
export async function evaluatePromotion(
  stableId: string,
  candidateId: string,
  criteria: PromotionCriteria = DEFAULT_CRITERIA,
  pruning: PruningCriteria = DEFAULT_PRUNING
): Promise<Decision> {
  
  const { stable, candidate, comparison } = await compareVariants(stableId, candidateId)
  
  log.info("Evaluating promotion", {
    stableId,
    candidateId,
    stableExecutions: stable.totalExecutions,
    candidateExecutions: candidate.totalExecutions
  })
  
  // 1. Check minimum sample size
  if (candidate.totalExecutions < criteria.minSampleSize) {
    return {
      action: "CONTINUE_TESTING",
      reason: `Insufficient data (${candidate.totalExecutions}/${criteria.minSampleSize} executions)`,
      confidence: 0,
      details: {
        sampleSize: candidate.totalExecutions,
        successRateDelta: comparison.successRateDelta,
        costDeltaPct: comparison.costDeltaPct,
        durationDeltaPct: comparison.durationDeltaPct,
        pValue: 1.0,
        meetsThresholds: {
          sampleSize: false,
          successRate: false,
          cost: false,
          duration: false,
          significance: false
        }
      }
    }
  }
  
  // 2. Statistical significance test
  const pValue = chiSquareTest(
    candidate.successfulExecutions,
    candidate.totalExecutions,
    stable.successfulExecutions,
    stable.totalExecutions
  )
  
  const isSignificant = pValue < (1 - criteria.confidenceLevel)
  
  // 3. Check pruning criteria first (fail fast)
  if (candidate.totalExecutions >= pruning.minExecutions) {
    // High failure rate → prune
    if (candidate.successRate < (1 - pruning.maxFailureRate)) {
      return {
        action: "PRUNE",
        reason: `High failure rate (${(candidate.successRate * 100).toFixed(1)}%)`,
        confidence: 1.0 - pValue,
        details: {
          sampleSize: candidate.totalExecutions,
          successRateDelta: comparison.successRateDelta,
          costDeltaPct: comparison.costDeltaPct,
          durationDeltaPct: comparison.durationDeltaPct,
          pValue,
          meetsThresholds: {
            sampleSize: true,
            successRate: false,
            cost: false,
            duration: false,
            significance: isSignificant
          }
        }
      }
    }
    
    // Statistically worse than stable → prune
    if (comparison.successRateDelta < 0 && isSignificant && 
        candidate.totalExecutions >= pruning.noImprovementAfter) {
      return {
        action: "PRUNE",
        reason: `Statistically worse than stable (p=${pValue.toFixed(3)}, ${candidate.totalExecutions} executions)`,
        confidence: 1.0 - pValue,
        details: {
          sampleSize: candidate.totalExecutions,
          successRateDelta: comparison.successRateDelta,
          costDeltaPct: comparison.costDeltaPct,
          durationDeltaPct: comparison.durationDeltaPct,
          pValue,
          meetsThresholds: {
            sampleSize: true,
            successRate: false,
            cost: false,
            duration: false,
            significance: true
          }
        }
      }
    }
  }
  
  // 4. Check promotion criteria
  const meetsThresholds = {
    sampleSize: candidate.totalExecutions >= criteria.minSampleSize,
    successRate: comparison.successRateDelta >= criteria.minSuccessRateImprovement,
    cost: comparison.costDeltaPct <= criteria.maxCostIncreasePct,
    duration: comparison.durationDeltaPct <= criteria.maxDurationIncreasePct,
    significance: isSignificant
  }
  
  const allMet = Object.values(meetsThresholds).every(v => v)
  
  if (allMet) {
    return {
      action: "PROMOTE",
      reason: `Significant improvement: ${(comparison.successRateDelta * 100).toFixed(1)}% success rate, ${comparison.costDeltaPct.toFixed(1)}% cost, ${comparison.durationDeltaPct.toFixed(1)}% duration (p=${pValue.toFixed(3)})`,
      confidence: 1.0 - pValue,
      details: {
        sampleSize: candidate.totalExecutions,
        successRateDelta: comparison.successRateDelta,
        costDeltaPct: comparison.costDeltaPct,
        durationDeltaPct: comparison.durationDeltaPct,
        pValue,
        meetsThresholds
      }
    }
  }
  
  // 5. Continue testing
  const unmetReasons = []
  if (!meetsThresholds.successRate) unmetReasons.push(`success rate ${(comparison.successRateDelta * 100).toFixed(1)}% < ${(criteria.minSuccessRateImprovement * 100).toFixed(1)}%`)
  if (!meetsThresholds.cost) unmetReasons.push(`cost increase ${comparison.costDeltaPct.toFixed(1)}% > ${criteria.maxCostIncreasePct}%`)
  if (!meetsThresholds.duration) unmetReasons.push(`duration increase ${comparison.durationDeltaPct.toFixed(1)}% > ${criteria.maxDurationIncreasePct}%`)
  if (!meetsThresholds.significance) unmetReasons.push(`not statistically significant (p=${pValue.toFixed(3)})`)
  
  return {
    action: "CONTINUE_TESTING",
    reason: `Needs improvement: ${unmetReasons.join(", ")}`,
    confidence: 1.0 - pValue,
    details: {
      sampleSize: candidate.totalExecutions,
      successRateDelta: comparison.successRateDelta,
      costDeltaPct: comparison.costDeltaPct,
      durationDeltaPct: comparison.durationDeltaPct,
      pValue,
      meetsThresholds
    }
  }
}
```

**Testing:**
```typescript
const decision = await evaluatePromotion("stable-id", "candidate-id")
console.log(decision)
// {
//   action: "PROMOTE",
//   reason: "Significant improvement: +13% success rate...",
//   confidence: 0.97
// }
```

**Deliverable:** Automated promotion/pruning decisions

---

### 3.3 CLI Commands (3 hours)

**File:** `repos/metabob-opencode/packages/opencode/src/cli/template-commands.ts` (NEW)  
**Priority:** P2 - MEDIUM  
**Dependencies:** Phase 3.2  

**Purpose:** CLI for template lifecycle management

**Commands to implement:**

```typescript
// Command: opencode template create-candidate <stable-id>
export async function createCandidate(stableId: string, changes: string, reason: string) {
  // 1. Load stable template
  // 2. Clone to new candidate
  // 3. Set status="candidate", stableVariantId=stableId
  // 4. Add to stable.candidateIds
  // 5. Save both
}

// Command: opencode template list-candidates <stable-id>
export async function listCandidates(stableId: string) {
  // Show all active candidates with metrics
}

// Command: opencode template evaluate <candidate-id>
export async function evaluateCandidate(candidateId: string) {
  // Run evaluatePromotion, show decision
}

// Command: opencode template promote <candidate-id>
export async function promoteCandidate(candidateId: string, confirm: boolean) {
  // 1. Run evaluation
  // 2. If PROMOTE decision, execute promotion
  // 3. Archive old stable
  // 4. Update candidate to stable
}

// Command: opencode template prune <candidate-id>
export async function pruneCandidate(candidateId: string, reason: string) {
  // 1. Set status="archived"
  // 2. Remove from stable.candidateIds
  // 3. Log pruning reason
}

// Command: opencode template status <template-id>
export async function showStatus(templateId: string) {
  // Show metrics, A/B test status, candidates
}
```

**Deliverable:** Full CLI for template management

---

## Phase 4: Monitoring & Dashboards (Visibility Layer)

**Goal:** Visualize A/B tests and template performance  
**Duration:** 2 days  
**Dependencies:** Phase 2, Phase 3

### 4.1 A/B Test Dashboard (4 hours)

**File:** `dashboard_ab_tests.py` (NEW)  
**Priority:** P2 - MEDIUM  

**Purpose:** Text-based dashboard showing active A/B tests

**Features:**
- List all active stable/candidate pairs
- Show traffic allocation
- Display current metrics
- Show recommendations (PROMOTE/CONTINUE/PRUNE)

**Output:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVE A/B TESTS                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ fix-bug-complete                                                │
│ ├─ STABLE (v1) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 90%         │
│ │  Executions: 168  Success: 72%  Cost: $0.0234  Duration: 45s │
│ └─ CANDIDATE (v2) ━━━━ 10%                                      │
│    Executions: 20   Success: 85% ⬆️  Cost: $0.0245  Duration: 47s│
│    Status: READY FOR PROMOTION (p=0.03, confidence 97%)         │
│    Decision: PROMOTE (+13% success rate, statistically significant)
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Deliverable:** Visual monitoring of A/B tests

---

## Summary by Priority

### P0 - CRITICAL (Must Have)
- [ ] 0.1 Test Evidence Collection
- [ ] 0.2 Clean Test Data
- [ ] 1.1 Update Analysis Script
- [ ] 2.1 Extend Template Schema
- [ ] 2.2 Template Selection Algorithm
- [ ] 2.3 Integrate Selection
- [ ] 2.4 Metrics Aggregation

### P1 - HIGH (Should Have)
- [ ] 0.3 Populate Template Names
- [ ] 3.1 Statistical Testing
- [ ] 3.2 Promotion Engine

### P2 - MEDIUM (Nice to Have)
- [ ] 1.2 Task Performance Analyzer
- [ ] 3.3 CLI Commands
- [ ] 4.1 A/B Test Dashboard

---

## Timeline

### Week 1
- **Days 1-2:** Phase 0 (Verification & Cleanup)
- **Days 3-5:** Phase 1 (Analysis Scripts) + Phase 2.1-2.2 (Schema & Selection)

### Week 2
- **Days 1-2:** Phase 2.3-2.4 (Integration & Metrics)
- **Days 3-5:** Phase 3 (Promotion Engine)

### Week 3 (Optional)
- **Days 1-2:** Phase 4 (Dashboards & CLI)
- **Days 3-5:** Testing & Refinement

---

## Dependencies Graph

```
Phase 0 (Verification)
├─> Phase 1 (Analysis Scripts)
└─> Phase 2 (A/B Infrastructure)
    ├─> 2.1 Schema
    ├─> 2.2 Selection (depends on 2.1)
    ├─> 2.3 Integration (depends on 2.2)
    └─> 2.4 Metrics (depends on 2.1, 2.3)
        └─> Phase 3 (Promotion Engine)
            ├─> 3.1 Stats
            ├─> 3.2 Engine (depends on 3.1, 2.4)
            └─> 3.3 CLI (depends on 3.2)
                └─> Phase 4 (Dashboards)
```

---

## Success Criteria

### Phase 0
- ✅ Activities complete with status="done"
- ✅ executionEvidence populated with taskId
- ✅ Test data archived
- ✅ templateName populated

### Phase 1
- ✅ Analysis script shows non-zero success rates
- ✅ Real costs and durations displayed
- ✅ Task-level breakdown available

### Phase 2
- ✅ Template selection working (90/10 split)
- ✅ Activities tracked with variant info
- ✅ Real-time metrics calculated

### Phase 3
- ✅ Promotion decisions automated
- ✅ Statistical significance testing works
- ✅ CLI commands functional

### Phase 4
- ✅ Dashboard shows A/B tests
- ✅ Recommendations visible

---

## Risk Mitigation

### Risk: Activities still stuck in "setup"
**Mitigation:** Phase 0.1 tests this first. If fails, debug before continuing.

### Risk: Evidence fields not populated
**Mitigation:** Phase 0.1 verification. Roll back if needed.

### Risk: Statistical tests inaccurate
**Mitigation:** Validate with known test cases in Phase 3.1.

### Risk: Template selection breaks existing workflows
**Mitigation:** Phase 2.3 is backward compatible (selects stable if no candidates).

---

**Status:** Ready for implementation  
**Next Action:** Begin Phase 0.1 (Test Evidence Collection)
