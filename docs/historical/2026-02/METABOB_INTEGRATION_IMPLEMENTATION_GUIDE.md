# Metabob Integration Implementation Guide

**Companion to:** METABOB_MCP_INTEGRATION_AUDIT_REPORT.md  
**Purpose:** Step-by-step implementation plan for closing integration gaps  
**Date:** 2026-02-27

---

## Quick Stats

- **Total Files:** ~1,300 TypeScript/JavaScript files
- **Files with Annotations:** Only 1 file (0.08% coverage)
- **Critical Gap:** 99.92% of codebase lacks design documentation
- **Session Tracking:** 0% integration
- **Template Evolution:** 0 evolution events recorded

---

## Phase 1: Session Tracking (Week 1)

### Goal
Enable telemetry for all agent sessions to capture:
- Session lifecycle (start/complete)
- Tool invocations and outcomes
- Performance metrics (duration, cost, tokens)
- Success/failure patterns

### Implementation Steps

#### Step 1.1: Create Session Tracking Utility

**File:** `repos/metabob-opencode/packages/opencode/src/util/session-tracking.ts`

```typescript
import { callMCPTool } from './metabob';

export interface SessionMetrics {
  duration: number; // milliseconds
  cost: number; // USD
  tokens: {
    input: number;
    output: number;
    cache: number;
  };
  toolsUsed: string[];
}

export class SessionTracker {
  private sessionId: string | null = null;
  private startTime: number = 0;
  private toolInvocations: string[] = [];

  async start(agent: string, task: string, context?: any): Promise<string> {
    this.startTime = Date.now();
    
    const result = await callMCPTool('metabob_record_session_start', {
      agent,
      task,
      context,
      timestamp: new Date().toISOString()
    });
    
    this.sessionId = result.sessionId;
    return this.sessionId;
  }

  async recordToolUse(tool: string, params: any, result: any): Promise<void> {
    if (!this.sessionId) return;
    
    this.toolInvocations.push(tool);
    
    await callMCPTool('metabob_record_tool_invocation', {
      sessionId: this.sessionId,
      tool,
      params,
      result: result.success ? 'success' : 'failure',
      timestamp: new Date().toISOString()
    });
  }

  async complete(outcome: 'success' | 'failed', metrics: SessionMetrics): Promise<void> {
    if (!this.sessionId) return;
    
    await callMCPTool('metabob_record_session_complete', {
      sessionId: this.sessionId,
      outcome,
      metrics: {
        ...metrics,
        duration: Date.now() - this.startTime,
        toolsUsed: this.toolInvocations
      },
      timestamp: new Date().toISOString()
    });
    
    this.sessionId = null;
    this.toolInvocations = [];
  }
}
```

#### Step 1.2: Integrate into Agent Lifecycle

**File:** `repos/metabob-opencode/packages/opencode/src/session/session.ts`

```typescript
import { SessionTracker } from '../util/session-tracking';

export class Session {
  private tracker: SessionTracker;

  async initialize(agent: string, task: string): Promise<void> {
    this.tracker = new SessionTracker();
    await this.tracker.start(agent, task, {
      workingDirectory: process.cwd(),
      timestamp: Date.now()
    });
  }

  async executeTask(): Promise<void> {
    try {
      // Existing task execution logic...
      
      // Track tool invocations
      const result = await this.callTool('search_codebase_issues', params);
      await this.tracker.recordToolUse('search_codebase_issues', params, result);
      
      // Complete successfully
      await this.tracker.complete('success', {
        duration: this.getSessionDuration(),
        cost: this.calculateCost(),
        tokens: this.getTokenUsage(),
        toolsUsed: this.getToolsUsed()
      });
    } catch (error) {
      // Track failure
      await this.tracker.complete('failed', {
        duration: this.getSessionDuration(),
        cost: this.calculateCost(),
        tokens: this.getTokenUsage(),
        toolsUsed: this.getToolsUsed()
      });
      throw error;
    }
  }
}
```

#### Step 1.3: Add Session Tracking to Activity Execution

**File:** `repos/metabob-opencode/packages/opencode/src/activity/executor.ts`

```typescript
async executeActivity(activityId: string): Promise<void> {
  const tracker = new SessionTracker();
  await tracker.start('activity', `Execute activity: ${activityId}`);
  
  try {
    // Execute activity tasks...
    for (const task of activity.tasks) {
      const result = await executeTask(task);
      await tracker.recordToolUse(task.tool, task.params, result);
    }
    
    await tracker.complete('success', getActivityMetrics());
  } catch (error) {
    await tracker.complete('failed', getActivityMetrics());
    throw error;
  }
}
```

### Validation

```bash
# Run test to verify session tracking
npm run test:session-tracking

# Expected output:
# ✓ Session starts and receives sessionId
# ✓ Tool invocations are recorded
# ✓ Session completes with metrics
# ✓ Failed sessions are tracked
```

### Success Criteria

- [ ] Session tracking utility implemented
- [ ] Integrated into agent lifecycle
- [ ] Activity executions tracked
- [ ] 100% of agent sessions recorded
- [ ] Metrics visible in Metabob dashboard

---

## Phase 1: Design Annotations (Week 1-2)

### Goal
Increase annotation coverage from 0.08% to 5% (65+ files annotated)

### Target Components for Annotation

#### Priority 1: Core Systems (Must annotate)

1. **Activity Execution**
   - `ActivityExecutor` - Why activity-centric model?
   - `TaskRunner` - Why sequential vs parallel?
   - `ValidationEngine` - Why pre/post validation?

2. **Session Management**
   - `Session` - Why stateful sessions?
   - `PromptBuilder` - Why compression strategies?
   - `ContextGathering` - Why token budgets?

3. **Tool System**
   - `ToolRegistry` - Why tool hiding?
   - `MCPIntegration` - Why MCP protocol?
   - `ActivityTool` - Why template-based execution?

4. **Storage & Persistence**
   - `ImpulseStore` - Why impulse-based storage?
   - `ActivityStorage` - Why dual-write pattern?
   - `RedisBackend` - Why Redis for state?

#### Priority 2: Complex Logic (Should annotate)

5. **Learning Loops**
   - Impulse learning mechanisms
   - Template evolution logic
   - Co-change pattern detection

6. **Workflow Orchestration**
   - Boredom detection
   - Task prioritization
   - Next-step prediction

### Implementation: Annotation Helper

**File:** `repos/metabob-opencode/packages/opencode/src/util/annotation-helper.ts`

```typescript
import { callMCPTool } from './metabob';

export async function annotateWithContext(
  filePath: string,
  componentName: string,
  componentType: 'function' | 'class' | 'method' | 'module',
  reason: string,
  designDecisions?: string[]
): Promise<void> {
  const annotation = {
    file_path: filePath,
    component_name: componentName,
    component_type: componentType,
    reason,
    design_decisions: designDecisions || [],
    timestamp: new Date().toISOString()
  };
  
  await callMCPTool('annotate_component', annotation);
  
  console.log(`✓ Annotated ${componentName} in ${filePath}`);
}

// Prompt agent to annotate after significant changes
export async function promptAnnotation(
  filePath: string,
  changeDescription: string
): Promise<void> {
  console.log(`
⚠️  ANNOTATION REQUIRED
File: ${filePath}
Change: ${changeDescription}

Please annotate this change using:
  annotate_component({
    file_path: "${filePath}",
    component_name: "ComponentName",
    component_type: "function|class|method",
    reason: "Why this design decision was made"
  })
  `);
}
```

### Annotation Campaign Script

**File:** `scripts/annotate-core-components.ts`

```typescript
import { annotateWithContext } from '../repos/metabob-opencode/packages/opencode/src/util/annotation-helper';

const CORE_COMPONENTS = [
  {
    file: 'src/activity/executor.ts',
    component: 'ActivityExecutor',
    type: 'class',
    reason: 'Activity-centric execution model chosen to enable reusable, validated, and trackable workflows. Sequential task execution with dependency management ensures predictable outcomes.',
    decisions: [
      'Sequential over parallel: Ensures dependency resolution',
      'Validation gates: Prevents partial executions',
      'Session isolation: Each activity runs in clean context'
    ]
  },
  {
    file: 'src/session/prompt.ts',
    component: 'PromptBuilder',
    type: 'class',
    reason: 'Token budget management critical for preventing context overflow. Compression strategies (filter, truncate, summarize) enable large codebase operations.',
    decisions: [
      'Filter first: Remove noise before truncation',
      'Preserve structure: Maintain code hierarchy in truncation',
      'Summarization last resort: Only when filtering insufficient'
    ]
  },
  {
    file: 'src/impulse/store.ts',
    component: 'ImpulseStore',
    type: 'class',
    reason: 'Impulse-based lazy loading chosen to prevent memory exhaustion from large file pointers. Redis backend enables distributed access and cross-session sharing.',
    decisions: [
      'Lazy loading: Load content only when resolved',
      'Pointer-based: Store references, not full content',
      'TTL-based expiry: Prevent memory leaks from orphaned impulses'
    ]
  }
  // Add 62+ more annotations...
];

async function annotateAllComponents() {
  console.log(`Starting annotation campaign: ${CORE_COMPONENTS.length} components`);
  
  for (const comp of CORE_COMPONENTS) {
    await annotateWithContext(
      comp.file,
      comp.component,
      comp.type as any,
      comp.reason,
      comp.decisions
    );
    console.log(`✓ Annotated ${comp.component}`);
  }
  
  console.log(`\n✅ Annotation campaign complete: ${CORE_COMPONENTS.length} components annotated`);
}

annotateAllComponents();
```

### CI/CD Integration

**File:** `.github/workflows/annotation-check.yml`

```yaml
name: Annotation Coverage Check

on: [pull_request]

jobs:
  check-annotations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Count changed files
        id: changes
        run: |
          CHANGED_FILES=$(git diff --name-only origin/main...HEAD | grep -E '\.(ts|js)$' | wc -l)
          echo "changed_files=$CHANGED_FILES" >> $GITHUB_OUTPUT
      
      - name: Check for annotations
        run: |
          # Check if PR adds annotations for changed files
          ANNOTATION_CALLS=$(git diff origin/main...HEAD | grep -c "annotate_component" || true)
          
          if [ "$ANNOTATION_CALLS" -eq 0 ] && [ "${{ steps.changes.outputs.changed_files }}" -gt 5 ]; then
            echo "⚠️  WARNING: No annotations found for ${{ steps.changes.outputs.changed_files }} changed files"
            echo "Consider adding design annotations using annotate_component()"
          fi
```

### Success Criteria

- [ ] Annotation helper utility created
- [ ] 65+ core components annotated
- [ ] CI/CD warns on missing annotations
- [ ] Annotation coverage dashboard shows 5%+
- [ ] All new features include annotations

---

## Phase 2: Template Evolution (Week 2)

### Goal
Enable automatic template improvement from execution outcomes

### Implementation: Evolution Trigger

**File:** `repos/metabob-opencode/packages/opencode/src/activity/evolution.ts`

```typescript
import { callMCPTool } from '../util/metabob';

export async function evolveTemplateFromFailure(
  activityId: string,
  templateId: string,
  error: any,
  executionContext: any
): Promise<void> {
  // Analyze failure
  const failureAnalysis = analyzeFailure(error, executionContext);
  
  // Generate improvement suggestions
  const improvements = generateImprovements(failureAnalysis);
  
  // Call Metabob to evolve template
  await callMCPTool('evolve_activity_template', {
    templateId,
    executionId: activityId,
    failures: [failureAnalysis],
    improvements,
    context: {
      error: error.message,
      failedTask: failureAnalysis.taskId,
      attemptNumber: executionContext.attemptNumber
    }
  });
  
  console.log(`✓ Template ${templateId} evolved based on failure in ${activityId}`);
}

function analyzeFailure(error: any, context: any): any {
  return {
    taskId: context.currentTaskId,
    errorType: error.name,
    errorMessage: error.message,
    stackTrace: error.stack,
    suggestedFixes: [
      'Add validation for edge case',
      'Improve error handling',
      'Add retry logic'
    ]
  };
}
```

#### Integration into Activity Executor

```typescript
// In ActivityExecutor.execute()
try {
  await executeTask(task);
} catch (error) {
  // Record failure
  await evolveTemplateFromFailure(
    this.activityId,
    this.templateId,
    error,
    { currentTaskId: task.id, attemptNumber: 1 }
  );
  throw error;
}
```

### Success Criteria

- [ ] Evolution triggered on failures
- [ ] Improvements captured in template metadata
- [ ] Template lineage tracked
- [ ] 10+ templates evolved within 2 weeks
- [ ] Template success rates improve

---

## Phase 3: Workflow Orchestration (Week 3)

### Goal
Enable AI-guided next-step suggestions

### Implementation

**File:** `repos/metabob-opencode/packages/opencode/src/workflow/orchestrator.ts`

```typescript
export async function getNextStepSuggestion(
  currentContext: string,
  completedTasks: string[]
): Promise<string> {
  const nextStep = await callMCPTool('get_next_step', {
    currentContext,
    completedTasks,
    codebaseState: await getCodebaseState()
  });
  
  return nextStep.suggestion;
}

// After task completion
async function onTaskComplete(taskId: string) {
  const suggestion = await getNextStepSuggestion(
    `Completed ${taskId}`,
    this.completedTasks
  );
  
  console.log(`\n💡 Suggested next step: ${suggestion}`);
}
```

---

## Phase 4: Boredom Task Integration (Week 4)

### Goal
Expose boredom task queue via MCP

**File:** `repos/metabob-opencode/packages/opencode/src/boredom/queue-client.ts`

```typescript
export class BoredomQueueClient {
  async listTasks(): Promise<Task[]> {
    return await callMCPTool('list_boredom_tasks', {});
  }
  
  async claimTask(taskId: string): Promise<void> {
    await callMCPTool('claim_boredom_task', { taskId });
  }
  
  async completeTask(taskId: string, outcome: any): Promise<void> {
    await callMCPTool('complete_boredom_task', { taskId, outcome });
  }
}
```

---

## Validation & Testing

### Test Suite

**File:** `tests/metabob-integration-validation.test.ts`

```typescript
describe('Metabob Integration', () => {
  it('tracks session lifecycle', async () => {
    const tracker = new SessionTracker();
    const sessionId = await tracker.start('test', 'validation');
    expect(sessionId).toBeDefined();
    
    await tracker.recordToolUse('test_tool', {}, { success: true });
    await tracker.complete('success', mockMetrics);
  });
  
  it('annotates components', async () => {
    await annotateWithContext(
      'test.ts',
      'TestComponent',
      'class',
      'Test annotation'
    );
    // Verify annotation stored
  });
  
  it('evolves templates on failure', async () => {
    await evolveTemplateFromFailure(
      'activity-123',
      'template-456',
      new Error('Test failure'),
      mockContext
    );
    // Verify evolution recorded
  });
});
```

---

## Success Metrics Dashboard

Track these metrics weekly:

| Metric | Baseline | Week 1 | Week 2 | Week 3 | Week 4 | Target |
|--------|----------|--------|--------|--------|--------|--------|
| Tools Used | 18/35 | - | - | - | - | 30/35 |
| Session Tracking | 0% | 100% | 100% | 100% | 100% | 100% |
| Annotation Coverage | 0.08% | 1% | 3% | 5% | 7% | 5%+ |
| Template Evolutions | 0 | 2 | 5 | 10 | 15 | 10+ |
| Workflow Guidance | No | No | No | Yes | Yes | Yes |

---

## Timeline Summary

**Week 1:** Session tracking + Start annotations  
**Week 2:** Complete annotation campaign + Template evolution  
**Week 3:** Workflow orchestration + Next-step guidance  
**Week 4:** Boredom task integration + Validation  
**Week 5-6:** Advanced features + Optimization

**Total Effort:** 6 weeks  
**Expected Outcome:** 86% tool utilization, self-improving system

---

**Next Steps:**
1. Review this guide with team
2. Assign implementation owners
3. Start with Week 1 session tracking
4. Track progress weekly
5. Adjust plan based on learnings
