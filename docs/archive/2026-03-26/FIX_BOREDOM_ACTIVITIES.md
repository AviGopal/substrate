# Fix Boredom Activities - Make Them Productive

**Goal**: Keep boredom activities running, but stop the wasteful failure loop

---

## Root Cause Analysis

### Why Boredom Activities Are Failing

1. **Auto-generated tasks lack context**
   - Generated from failures without understanding WHY they failed
   - Generic "debug" tasks without specific fixes
   - No execution traces stored → can't learn from failures

2. **Low-quality templates keep getting selected**
   - 45 templates with <30% success rate
   - Thompson Sampling not working effectively
   - No blacklist for proven-bad templates

3. **No failure prevention**
   - Same tasks retry indefinitely
   - No maximum retry limit
   - No cost cap per task

4. **Missing critical data**
   - Execution traces not stored (we validated this earlier)
   - Can't analyze what went wrong
   - Can't improve templates based on failures

---

## The Fix: 4-Part Solution

### Part 1: Store Execution Traces (Critical!)

**Why this is the foundation**: Without execution traces, we can't learn from failures.

**Implementation**: Add execution trace creation to MiniBob

**Submit this as first goal**:
```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add execution trace creation to MiniBob. After every activity execution (success or failure), call POST /v2/activities/execution-traces with full state snapshot including: execution_id, template_id, status, duration_ms, cost, tasks array with tool_calls, impulses_used, files_modified, error_message if failed.",
    "priority": "critical",
    "context": {
      "repo": "minibob",
      "file": "src/activity.ts",
      "endpoint": "POST /v2/activities/execution-traces",
      "example_payload": {
        "execution_id": "exec-abc123",
        "template_id": "code-change-feature",
        "variant_id": "code-change-feature-v1",
        "activity_id": "code-change",
        "status": "success",
        "duration_ms": 45000,
        "cost": 0.25,
        "success": true,
        "tokens": {
          "input": 5000,
          "output": 2000,
          "cache": 1000
        },
        "tasks": [
          {
            "task_id": "task-1",
            "description": "Create feature branch",
            "status": "completed",
            "duration_ms": 5000,
            "tool_calls": [
              {
                "tool": "bash",
                "success": true,
                "duration_ms": 100
              }
            ]
          }
        ],
        "impulses_used": [],
        "state_snapshot": {
          "output_state": {
            "filesModified": ["src/activity.ts"]
          }
        }
      },
      "implementation_hints": [
        "Add traceExecution() function in src/activity.ts",
        "Call after activity completes in executeActivity()",
        "Include try/catch to not fail if trace creation fails",
        "Log trace_id after successful creation"
      ]
    }
  }'
```

**Expected outcome**: Dashboard Executions tab shows all executions with full details

---

### Part 2: Improve Task Generation Quality

**Current problem**: Tasks generated like "debug-low-success-template" with no specifics

**Solution**: Make task generator use execution traces to create actionable tasks

**Update** `repos/metabob-activity-api/src/services/task-generator.ts`:

```typescript
async function generateDebugTask(failedExecution: ExecutionTrace): Promise<BoredomTask> {
  // Don't generate if we've tried 3 times already
  const retryCount = await getRetryCountForTemplate(failedExecution.template_id);
  if (retryCount >= 3) {
    logger.info('[TaskGenerator] Max retries reached, not generating task', {
      template_id: failedExecution.template_id,
      retry_count: retryCount
    });
    return null;
  }

  // Create task with SPECIFIC context from failure
  return {
    id: `debug-${failedExecution.execution_id}`,
    goal: `Fix failure in ${failedExecution.template_id}: ${failedExecution.error_message}`,
    priority: 'high',
    context: {
      repo: failedExecution.repo,
      failed_execution_id: failedExecution.execution_id,
      error_message: failedExecution.error_message,
      failed_task_id: failedExecution.failed_task_id,
      files_involved: failedExecution.state_snapshot?.output_state?.filesModified,
      retry_count: retryCount,

      // Specific fix hints based on error patterns
      fix_approach: analyzeErrorPattern(failedExecution.error_message),

      // Don't use the same template that failed!
      preferred_template: 'code-change-bugfix', // Use bugfix template for debugging

      // Add validation to prevent same failure
      additional_validation: {
        forbiddenPatterns: [
          { pattern: failedExecution.error_message } // Must not produce same error
        ]
      }
    }
  };
}

function analyzeErrorPattern(errorMessage: string): string {
  // Pattern recognition for common errors
  if (errorMessage.includes('null is not an object')) {
    return 'Add null check or optional chaining';
  }
  if (errorMessage.includes('command not found')) {
    return 'Install missing dependency or fix command path';
  }
  if (errorMessage.includes('ENOENT')) {
    return 'Create missing file or directory';
  }
  if (errorMessage.includes('typecheck failed')) {
    return 'Fix TypeScript type errors';
  }
  // ... more patterns

  return 'Investigate error and implement fix';
}
```

**Key improvements**:
- Max 3 retries per template
- Specific error messages in goal
- Fix approach hints
- Use different template (bugfix) for debugging
- Additional validation to prevent same error

---

### Part 3: Add Cost Controls & Failure Prevention

**Add to** `repos/metabob-activity-api/src/routes/boredom.ts`:

```typescript
interface TaskExecutionPolicy {
  maxCostPerTask: number;
  maxRetriesPerTemplate: number;
  minTemplateSuccessRate: number;
  cooldownPeriodMs: number; // Wait before retrying same template
}

const EXECUTION_POLICY: TaskExecutionPolicy = {
  maxCostPerTask: 0.50,           // Don't spend >$0.50 on single task
  maxRetriesPerTemplate: 3,       // Max 3 attempts at same template
  minTemplateSuccessRate: 0.20,   // Don't use templates with <20% success
  cooldownPeriodMs: 3600000,      // 1 hour cooldown after failure
};

async function canExecuteTask(task: BoredomTask): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  // Check template success rate
  const template = await getTemplate(task.template_id);
  if (template.metrics.total_executions > 5 &&
      template.metrics.success_rate < EXECUTION_POLICY.minTemplateSuccessRate) {
    return {
      allowed: false,
      reason: `Template success rate too low: ${template.metrics.success_rate}`
    };
  }

  // Check retry count
  const retries = task.context?.retry_count || 0;
  if (retries >= EXECUTION_POLICY.maxRetriesPerTemplate) {
    return {
      allowed: false,
      reason: `Max retries exceeded: ${retries}`
    };
  }

  // Check cooldown period
  const lastFailure = await getLastFailureTime(task.template_id);
  if (lastFailure && Date.now() - lastFailure < EXECUTION_POLICY.cooldownPeriodMs) {
    return {
      allowed: false,
      reason: `Template in cooldown period (1 hour after failure)`
    };
  }

  // Estimate cost and check limit
  const estimatedCost = estimateTaskCost(task, template);
  if (estimatedCost > EXECUTION_POLICY.maxCostPerTask) {
    return {
      allowed: false,
      reason: `Estimated cost too high: $${estimatedCost}`
    };
  }

  return { allowed: true };
}

// Modify dequeue endpoint
app.post('/v2/activities/boredom/dequeue', async (c) => {
  const task = await getNextTask();

  // Check execution policy
  const canExecute = await canExecuteTask(task);
  if (!canExecute.allowed) {
    logger.warn('[Boredom] Task blocked by execution policy', {
      task_id: task.id,
      reason: canExecute.reason
    });

    // Mark task as blocked, don't return to vessel
    await markTaskBlocked(task.id, canExecute.reason);

    // Try next task
    return c.json({ task: null, reason: 'No executable tasks available' });
  }

  return c.json({ task });
});
```

**Benefits**:
- Stops wasteful retries
- Blocks low-performing templates
- Cooldown prevents rapid repeated failures
- Cost cap prevents expensive mistakes

---

### Part 4: Improve Template Quality with Thompson Sampling

**Problem**: Thompson Sampling isn't working because:
1. Many templates have 0 or 1 executions (no data)
2. Alpha/beta not being updated correctly
3. Selection isn't favoring high-performers

**Solution**: Better template recommendation

**Update** `repos/metabob-activity-api/src/routes/activities.ts`:

```typescript
// In recommend endpoint
async function selectTemplateForGoal(
  goal: string,
  availableTemplates: ActivityTemplate[]
): Promise<ActivityTemplate> {

  // Filter out proven-bad templates
  const viableTemplates = availableTemplates.filter(t => {
    // Must have decent success rate if executed >5 times
    if (t.metrics.total_executions > 5) {
      return t.metrics.success_rate > 0.20;
    }
    // Give new templates a chance
    return true;
  });

  // Sort by Thompson Sampling score
  const scored = viableTemplates.map(t => ({
    template: t,
    score: thompsonSample(t.metrics.thompson_alpha, t.metrics.thompson_beta),

    // Boost score for templates with:
    // - High success rate and many executions (proven)
    // - Recent successful execution (trending)
    confidence: calculateConfidence(t.metrics)
  }));

  // Sort by (score * confidence) to favor proven winners
  scored.sort((a, b) =>
    (b.score * b.confidence) - (a.score * a.confidence)
  );

  // Top pick with exploration (10% chance to try lower-ranked)
  if (Math.random() < 0.1 && scored.length > 1) {
    return scored[1].template; // Second best
  }

  return scored[0].template;
}

function calculateConfidence(metrics: ThompsonSamplingMetrics): number {
  // More executions = more confidence
  const executionConfidence = Math.min(metrics.total_executions / 10, 1.0);

  // Higher success rate = more confidence
  const successConfidence = metrics.success_rate;

  // Recent success = more confidence
  const recencyBonus = wasRecentlySuccessful(metrics.last_executed_at) ? 0.2 : 0;

  return Math.min(
    (executionConfidence * 0.5) +
    (successConfidence * 0.4) +
    recencyBonus,
    1.0
  );
}
```

---

## Implementation Plan

### Phase 1: Enable Learning (Week 1)

**Day 1: Add execution trace creation**
```bash
# Submit goal to add traces to MiniBob
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -d @execution-trace-goal.json

# Monitor execution
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f

# Verify traces appear
curl "http://api.minibob.local/v2/activities/execution-traces?limit=5"
```

**Day 2-3: Add cost controls**
```bash
# Implement execution policy in boredom route
# - Max retries: 3
# - Min success rate: 20%
# - Cooldown: 1 hour
# - Max cost: $0.50

# Test with a known-good goal
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -d '{
    "goal": "Add health endpoint to dashboard that returns uptime",
    "priority": "low"
  }'
```

**Day 4-5: Improve task generation**
```bash
# Update task-generator.ts to:
# - Use execution traces for context
# - Analyze error patterns
# - Provide fix hints
# - Use bugfix template for debugging
```

### Phase 2: Clean Up Bad Templates (Week 2)

**Identify templates to archive**:
```bash
# Templates with <20% success after 10+ executions
curl "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[] |
    select(.metrics.total_executions > 10 and .metrics.success_rate < 0.2)] |
    .[] | {variant_id, success_rate, total_executions}'

# Archive these templates (mark as deprecated)
# Don't delete - keep for analysis
```

**Focus on proven templates**:
```bash
# Templates with >70% success
curl "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[] |
    select(.metrics.success_rate > 0.7)] |
    .[] | {variant_id, success_rate, total_executions}'

# Use these as basis for new templates
```

### Phase 3: Curated High-Value Goals (Ongoing)

**Submit 3-5 high-value goals per week**:

1. **Fix critical issues** (from validation report)
   - Code-variants API error
   - Vessel heartbeat implementation
   - Dashboard data improvements

2. **Improve template quality**
   - Extract patterns from successful executions
   - Create variants of high-performers
   - Archive consistent failures

3. **Infrastructure improvements**
   - Better error messages
   - Improved validation
   - Enhanced logging

**Example curated goals**:
```bash
# Goal 1: Fix known bug
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Fix session.org_id null reference in code-variants route by making org_id optional with default null",
  "priority": "critical",
  "context": {
    "repo": "metabob-activity-api",
    "file": "src/routes/code-variants.ts",
    "line": 122,
    "error": "null is not an object (evaluating session.org_id)",
    "fix": "const orgId = session?.org_id || null;",
    "validation": "API returns variants without error"
  }
}'

# Goal 2: Add feature with clear spec
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add /health endpoint to dashboard that returns JSON with status, uptime, version",
  "priority": "medium",
  "context": {
    "repo": "activity-dashboard",
    "file": "src/index.ts",
    "endpoint_path": "/health",
    "response_format": {
      "status": "healthy",
      "uptime": 12345,
      "version": "1.0.0"
    },
    "validation": "curl localhost:3000/health returns 200 with JSON"
  }
}'
```

---

## Success Metrics

### Before (Current State)
- 45 templates with <30% success rate
- 9 tasks in queue (mostly auto-generated debug tasks)
- 10 failed executions of same template
- No execution traces stored
- No learning from failures
- Estimated waste: $5-10/week

### After (Target State)
- <10 templates with <30% success rate (rest archived)
- 3-5 curated goals in queue
- Max 3 retries per template
- All executions traced
- Patterns extracted from successes
- Cost: <$5/week with 80%+ success rate

---

## Quick Actions

### 1. Add Execution Trace Creation (Do This First!)
```bash
# This is the foundation - without traces, we can't learn
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add execution trace creation to MiniBob after every activity execution",
    "priority": "critical",
    "context": {
      "repo": "minibob",
      "file": "src/activity.ts",
      "endpoint": "POST /v2/activities/execution-traces"
    }
  }'

# Monitor in dashboard
open http://dashboard.minibob.local
```

### 2. Add Cost Controls (Do Today)
```bash
# Submit goal to add execution policy
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -d '{
    "goal": "Add execution policy to boredom route with max retries, min success rate, cooldown period, and cost cap",
    "priority": "high",
    "context": {
      "repo": "metabob-activity-api",
      "file": "src/routes/boredom.ts",
      "policy": {
        "maxRetriesPerTemplate": 3,
        "minTemplateSuccessRate": 0.20,
        "cooldownPeriodMs": 3600000,
        "maxCostPerTask": 0.50
      }
    }
  }'
```

### 3. Submit Curated Goals (Weekly)
```bash
# Use the curated goal template
./submit-curated-goal.sh \
  "Fix code-variants session.org_id error" \
  "critical" \
  "metabob-activity-api" \
  "src/routes/code-variants.ts"
```

---

## The Key Insight

**Boredom activities are powerful when**:
1. ✅ Goals have clear context and success criteria
2. ✅ Execution traces are stored for learning
3. ✅ Cost controls prevent wasteful retries
4. ✅ Template quality improves over time
5. ✅ Failures inform better task generation

**Boredom activities are wasteful when**:
1. ❌ Auto-generated tasks lack specific fixes
2. ❌ No execution traces to learn from
3. ❌ Same failures retry indefinitely
4. ❌ Low-quality templates keep getting selected
5. ❌ Failures generate more failing tasks

---

**Fix the system, keep the activities running.** 🎯
