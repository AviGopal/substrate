# Stop Wasteful Boredom Activities - Action Plan

**Problem**: Automatic task generation creates a wasteful loop of failing executions

---

## Current Situation Analysis

### The Wasteful Loop

```
1. Template fails → TaskGenerator detects failure
2. Auto-generates "debug" task → Added to boredom queue
3. MiniBob picks up debug task → Executes and fails
4. Failure detected → TaskGenerator generates another debug task
5. Repeat → Money wasted, no improvement
```

### Evidence

**Failed Executions**:
- 10 failed "hello-world" executions
- 23 failed "debug-low-success-template" executions
- 45 templates with <30% success rate

**Auto-Generated Tasks in Queue**:
- 7 critical priority tasks (likely all auto-generated debug tasks)
- 2 low priority tasks
- Running every 5 minutes: `TASK_GENERATION_INTERVAL = 5 * 60 * 1000`

**Cost Impact**:
- Each failed execution wastes API calls
- No learning from failures (execution traces not stored)
- System spins on same problems repeatedly

---

## Immediate Actions

### 1. Disable Automatic Task Generation

**Method A: Environment Variable** (Recommended - No code change)

```bash
# Update API deployment
kubectl set env deployment/metabob-activity-api \
  -n activity-system \
  TASK_GENERATION_ENABLED=false

# Verify
kubectl rollout status deployment/metabob-activity-api -n activity-system

# Check logs to confirm
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api \
  | grep "TaskGenerator"
# Should NOT see "Scheduled task generation started"
```

**Method B: Helm Values**

```yaml
# helm/charts/metabob-activity-api/values.yaml
env:
  TASK_GENERATION_ENABLED: "false"

# Redeploy
helm upgrade metabob-activity-api ./charts/metabob-activity-api \
  --namespace activity-system \
  --reuse-values \
  --set env.TASK_GENERATION_ENABLED=false
```

### 2. Clear Low-Quality Tasks from Queue

**Option A: Clear entire queue** (fresh start)

```bash
# TODO: Add API endpoint
curl -X DELETE "http://api.minibob.local/v2/activities/boredom/queue"
```

**Option B: Manual inspection and removal**

```bash
# List tasks
curl "http://api.minibob.local/v2/activities/boredom/queue/list" | jq .

# Remove specific task
curl -X DELETE "http://api.minibob.local/v2/activities/boredom/queue/{task_id}"
```

**Temporary: Stop MiniBob from processing queue**

```bash
# Scale down MiniBob
kubectl scale deployment/minibob-devbob -n activity-system --replicas=0

# This prevents further wasteful executions while we fix the system
```

### 3. Implement Cost Controls

**Add to boredom route** (`repos/metabob-activity-api/src/routes/boredom.ts`):

```typescript
// Before dequeuing a task for execution
interface CostControl {
  maxCostPerExecution: number;      // e.g., $0.50
  maxRetriesForFailure: number;     // e.g., 3
  minSuccessRateToRetry: number;    // e.g., 0.3
  blacklistedTemplates: string[];   // Known bad templates
}

const COST_CONTROLS: CostControl = {
  maxCostPerExecution: 0.50,
  maxRetriesForFailure: 3,
  minSuccessRateToRetry: 0.30,
  blacklistedTemplates: [
    "debug-low-success-template",
    "Comprehensive Activity Template Validation System"
  ]
};

// Check before execution
async function shouldExecuteTask(task: BoredomTask): Promise<boolean> {
  // Check if template is blacklisted
  if (COST_CONTROLS.blacklistedTemplates.includes(task.template_id)) {
    logger.warn('[CostControl] Template blacklisted', { template_id: task.template_id });
    return false;
  }

  // Check template success rate
  const template = await getTemplate(task.template_id);
  if (template.metrics.success_rate < COST_CONTROLS.minSuccessRateToRetry) {
    logger.warn('[CostControl] Template success rate too low', {
      template_id: task.template_id,
      success_rate: template.metrics.success_rate,
      threshold: COST_CONTROLS.minSuccessRateToRetry
    });
    return false;
  }

  // Check retry count
  if (task.retry_count >= COST_CONTROLS.maxRetriesForFailure) {
    logger.warn('[CostControl] Max retries exceeded', {
      task_id: task.id,
      retry_count: task.retry_count,
      max: COST_CONTROLS.maxRetriesForFailure
    });
    return false;
  }

  return true;
}
```

---

## Long-Term Solution: Goal-Based Development

### Philosophy Shift

**OLD (Wasteful)**:
```
System detects failures → Auto-generates tasks → MiniBob executes blindly
```

**NEW (Intentional)**:
```
Human submits well-defined goal → MiniBob executes with context → Success
```

### Implementation

#### 1. Curated Development Roadmap

Create `DEVELOPMENT_ROADMAP.md` with prioritized goals:

```markdown
# Development Roadmap

## Phase 1: Fix Dashboard Data Issues (Critical)
**Goal**: Make dashboard show real vessel and execution data

### Task 1.1: Fix code-variants API error
**Priority**: Critical
**Estimated Cost**: $0.10
**Success Criteria**: API returns data without session.org_id error

### Task 1.2: Add execution trace creation
**Priority**: High
**Estimated Cost**: $0.25
**Success Criteria**: Execution traces appear in dashboard after activity runs

### Task 1.3: Implement vessel heartbeats
**Priority**: High
**Estimated Cost**: $0.30
**Success Criteria**: Vessels tab shows 3 running MiniBob pods

## Phase 2: Improve Template Quality (High)
**Goal**: Increase overall success rate from 29% to >80%

### Task 2.1: Analyze top 10 failing templates
**Priority**: High
**Method**: Manual review, not auto-execution

### Task 2.2: Archive or fix low-performers
**Priority**: Medium
**Criteria**: Archive any template with <20% success after 10 executions
```

#### 2. Goal Submission Process

**Template for submitting goals**:

```bash
#!/bin/bash
# submit-goal.sh

cat > goal.json <<EOF
{
  "goal": "${1:?Goal description required}",
  "priority": "${2:-medium}",
  "context": {
    "estimated_cost": ${3:-0.50},
    "success_criteria": "${4:?Success criteria required}",
    "max_retries": 1,
    "validation": {
      "required": true,
      "commands": ["typecheck", "test"]
    }
  }
}
EOF

# Review before submitting
cat goal.json
read -p "Submit this goal? (y/n) " confirm

if [ "$confirm" = "y" ]; then
    curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
        -H "Content-Type: application/json" \
        -d @goal.json

    echo "Goal submitted! Monitor at: http://dashboard.minibob.local"
fi
```

**Usage**:
```bash
./submit-goal.sh \
  "Fix session.org_id null reference in code-variants.ts" \
  "critical" \
  0.10 \
  "API returns variants without error"
```

#### 3. Pre-Execution Validation

Before MiniBob executes any goal:

1. **Cost Estimate**: Show estimated token/cost
2. **Success Probability**: Based on template Thompson score
3. **Human Approval**: For goals >$0.50 or templates with <50% success rate
4. **Context Validation**: Ensure goal has enough detail

```typescript
// Pre-execution check
interface GoalValidation {
  isValid: boolean;
  estimatedCost: number;
  successProbability: number;
  requiresApproval: boolean;
  missingContext?: string[];
}

async function validateGoal(goal: Goal): Promise<GoalValidation> {
  const template = await selectTemplateForGoal(goal);

  const validation: GoalValidation = {
    isValid: true,
    estimatedCost: estimateExecutionCost(template, goal),
    successProbability: template.metrics.success_rate,
    requiresApproval: false,
    missingContext: []
  };

  // Check for missing context
  if (!goal.context?.repo) validation.missingContext.push('repo');
  if (!goal.context?.file && !goal.context?.new_file) {
    validation.missingContext.push('file or new_file');
  }

  // Require approval for expensive or risky executions
  if (validation.estimatedCost > 0.50) validation.requiresApproval = true;
  if (validation.successProbability < 0.5) validation.requiresApproval = true;

  if (validation.missingContext.length > 0) validation.isValid = false;

  return validation;
}
```

#### 4. Learning from Execution

**After every execution** (success or failure):

1. **Store execution trace** (we need to implement this)
2. **Update Thompson Sampling** (already implemented)
3. **Extract patterns** (via Ribosome if successful)
4. **Create improvement task ONLY if**:
   - Human explicitly requests analysis
   - Failure is blocking critical functionality
   - Pattern suggests simple fix

**No automatic task generation from failures!**

---

## Recommended Action Plan

### Week 1: Stop the Bleeding

```bash
# Day 1: Immediate
1. Disable automatic task generation
   kubectl set env deployment/metabob-activity-api \
     -n activity-system TASK_GENERATION_ENABLED=false

2. Scale down MiniBob (stop wasting money)
   kubectl scale deployment/minibob-devbob -n activity-system --replicas=0

3. Clear boredom queue
   # TODO: Implement clear endpoint or manually via DB

# Day 2-3: Add safeguards
4. Implement cost controls in boredom route
5. Add pre-execution validation
6. Blacklist known-bad templates

# Day 4-5: Fix critical issues
7. Submit 3 curated goals (from validation report)
8. Monitor execution closely
9. Learn from results
```

### Week 2: Establish Goal-Based Process

```bash
# Day 1-2: Create roadmap
1. Document current system state
2. Prioritize improvements by value/cost ratio
3. Create DEVELOPMENT_ROADMAP.md

# Day 3-4: Submit curated goals
4. Submit Phase 1 goals (dashboard data fixes)
5. One at a time, with monitoring
6. Validate success before next goal

# Day 5: Review and iterate
7. Analyze what worked
8. Update templates based on successes
9. Plan Phase 2 goals
```

### Ongoing: Intentional Development

**Every development need**:
1. Write clear goal with context
2. Estimate cost and success probability
3. Submit via curated process
4. Monitor execution
5. Validate success
6. Extract learnings

**Never**:
- Auto-generate tasks from failures
- Execute without context
- Retry failures blindly
- Ignore cost controls

---

## Cost Comparison

### Current (Wasteful)

```
Auto-generated tasks: 9
Average failure rate: ~70%
Failed executions: ~30 in last period
Estimated waste: $5-10 (depending on token usage)
Learning gained: 0 (no execution traces stored)
```

### Proposed (Intentional)

```
Curated goals: 3-5 per week
Success rate target: >80%
Successful executions: ~4 per week
Estimated cost: $2-3
Learning gained: High (traces stored, patterns extracted)
```

**Savings**: 50-70% reduction in costs
**Value**: 10x increase in actual improvements

---

## Implementation Checklist

### Immediate (Today)

- [ ] Disable TASK_GENERATION_ENABLED
- [ ] Scale down MiniBob to 0 replicas
- [ ] Document current boredom queue contents
- [ ] Identify which auto-generated tasks to keep vs delete

### Short-term (This Week)

- [ ] Implement cost controls in boredom route
- [ ] Add pre-execution validation
- [ ] Create template blacklist
- [ ] Implement queue management endpoints (clear, list, delete)
- [ ] Add execution trace creation to MiniBob
- [ ] Create DEVELOPMENT_ROADMAP.md

### Medium-term (Next 2 Weeks)

- [ ] Submit and validate Phase 1 curated goals
- [ ] Implement human approval workflow for expensive executions
- [ ] Create goal submission helper script with validation
- [ ] Archive templates with <20% success rate after 10 executions
- [ ] Document learnings from successful executions

### Long-term (Ongoing)

- [ ] Maintain curated development roadmap
- [ ] Review and update goals weekly
- [ ] Track cost vs value metrics
- [ ] Improve template quality based on execution data
- [ ] Build library of proven, high-success templates

---

## Success Metrics

**Track weekly**:
- Total execution cost
- Success rate of executions
- Number of goals completed
- Number of improvements deployed
- Template quality trends

**Target**:
- <$5/week execution cost
- >80% success rate
- 3-5 goals completed per week
- 100% of completions result in deployed improvements
- Average template success rate >70%

---

## Quick Commands

```bash
# Disable task generation
kubectl set env deployment/metabob-activity-api \
  -n activity-system TASK_GENERATION_ENABLED=false

# Stop MiniBob executions
kubectl scale deployment/minibob-devbob -n activity-system --replicas=0

# Check queue
curl "http://api.minibob.local/v2/activities/boredom/queue" | jq .

# Submit curated goal
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "YOUR_WELL_DEFINED_GOAL",
    "priority": "high",
    "context": {
      "repo": "minibob",
      "file": "src/activity.ts",
      "estimated_cost": 0.25,
      "success_criteria": "Execution traces appear in dashboard"
    }
  }'

# Re-enable MiniBob (after fixes)
kubectl scale deployment/minibob-devbob -n activity-system --replicas=3

# Monitor execution
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
open http://dashboard.minibob.local
```

---

**Stop the wasteful loop. Start intentional development.** 🎯
