# Self-Healing Activity Templates - Action Plan

**Goal**: Enable activity templates to diagnose and repair themselves autonomously  
**Timeline**: 3 weeks (Phase 1-3)  
**Status**: Ready to execute

---

## Phase 1: Foundation (Week 1) - CRITICAL

### 🎯 Objective
Fix architectural issues that block self-healing:
- Template versioning with genealogy
- Backend-first storage
- Real execution data APIs

### Task 1.1: Implement Template Genealogy (2 days)

**Files to Create/Modify**:
```
src/session/activity-template.ts
  + Add Version interface (timestamp, parent_hash, variant_hash, full_version, generation)
  + Add TemplateGenealogy interface (created_at, parent_id, variant_hash, evolution, variant_ids)
  + Add TemplateEvolution interface (reason, based_on_execution, improvised, author)
  + Update ActivityTemplate.Schema to include genealogy

src/session/activity-template-repository.ts
  + generateVersionString(parent: Template, improvised: boolean): string
  + createVariant(parent: Template, modifications: Change[], reason: string): Template
  + getAncestry(templateId: string): Template[]
  + getVariants(parentId: string): Template[]
```

**Validation**:
```typescript
// Test version generation
const version = generateVersionString(parentTemplate, false)
expect(version).toMatch(/^\d+:[a-f0-9]+:[a-f0-9]+$/)

// Test genealogy tracking
const variant = await createVariant(parent, changes, "Increased token budget")
expect(variant.genealogy.parent_id).toBe(parent.id)
expect(variant.genealogy.generation).toBe(parent.genealogy.generation + 1)
```

### Task 1.2: Implement Backend TemplateService Client (2 days)

**Files to Create**:
```
src/backend/template-service-client.ts
  + class TemplateServiceClient
  + searchTemplates(query: string, category?: string): Promise<Template[]>
  + getTemplate(id: string): Promise<Template>
  + registerTemplate(template: Template): Promise<void>
  + updateMetrics(id: string, metrics: Metrics): Promise<void>
  + listTemplates(filter?: Filter): Promise<Template[]>
  + deleteTemplate(id: string): Promise<void>

src/backend/execution-service-client.ts
  + class ExecutionServiceClient
  + getExecution(id: string): Promise<Execution>
  + listExecutions(filter: Filter): Promise<Execution[]>
  + getExecutionTasks(id: string): Promise<Task[]>
  + getExecutionLogs(id: string): Promise<Log[]>
  + getExecutionErrors(id: string): Promise<Error[]>
```

**Integration**:
```typescript
// Update TemplateRepository to use backend first
export class TemplateRepository {
  static async get(id: string): Promise<Template> {
    // 1. Try backend
    try {
      return await templateServiceClient.getTemplate(id)
    } catch (backendError) {
      // 2. Fall back to cache (if fresh)
      if (cache.has(id) && cache.isFresh(id)) {
        return cache.get(id)
      }
      // 3. Error (no built-in fallback except bootstrap)
      throw new Error(`Template ${id} not available`)
    }
  }
}
```

### Task 1.3: Implement Backend API Endpoints (3 days)

**Backend Files** (`repos/metabob-rpc-api`):
```
server/routes/activities.py
  + GET /v2/activities/executions?template_id={id}&limit=100
  + GET /v2/activities/executions/{execution_id}
  + GET /v2/activities/executions/{execution_id}/tasks
  + GET /v2/activities/executions/{execution_id}/logs
  + GET /v2/activities/executions/{execution_id}/errors
  + GET /v2/activities/templates/{template_id}/stats
  + GET /v2/activities/templates/{template_id}/learnings

server/actions/activities.py
  + async def get_execution_history(template_id, limit): ...
  + async def get_execution_details(execution_id): ...
  + async def calculate_template_metrics(template_id, period): ...
  + async def extract_learning_data(template_id): ...
```

**Database Schema** (if needed):
```sql
-- Store execution history
CREATE TABLE activity_executions (
  execution_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_ms INTEGER,
  cost_usd REAL,
  error_message TEXT
);

-- Store task execution details
CREATE TABLE activity_task_executions (
  task_execution_id TEXT PRIMARY KEY,
  execution_id TEXT REFERENCES activity_executions,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  tokens_used INTEGER,
  error_message TEXT
);
```

### Phase 1 Success Criteria ✅
- [ ] Templates have genealogy with parent tracking
- [ ] Backend TemplateService client works
- [ ] Backend APIs return real execution data
- [ ] debug-activity can fetch execution details
- [ ] evolve-activity can fetch metrics
- [ ] Storage uses backend as primary source
- [ ] No version conflicts

---

## Phase 2: Self-Healing (Week 2) - HIGH

### 🎯 Objective
Enable activities to recover from failures automatically:
- Trailblazing implementation
- Recovery prompt generation
- Variant creation from recoveries

### Task 2.1: Implement Trailblazing (3 days)

**Files to Modify**:
```
src/tool/activity.ts
  + Add trailblazing parameters:
    trailblazing?: {
      enabled: boolean
      maxCostPerTask: number
      maxTotalCost: number
      maxRecoveryAttempts: number
    }

src/session/activity.ts
  + Add improvisations tracking:
    improvisations: Array<{
      taskId: string
      attemptNumber: number
      originalError: string
      recoveryPrompt: string
      outcome: 'success' | 'failure'
      costIncurred: number
    }>

src/session/activity-executor.ts
  + async function generateRecoveryPrompt(
      failedTask: Task,
      error: Error,
      previousTaskOutputs: Record<string, any>,
      activity: Activity
    ): Promise<string>
    
  + async function attemptRecovery(
      activity: Activity,
      failedTask: Task,
      error: Error
    ): Promise<RecoveryResult>
```

**Recovery Prompt Template**:
```typescript
const recoveryPrompt = `
Task "${failedTask.id}" failed with error:
  ${error.message}

Previous task outputs available:
${formatPreviousOutputs(previousTaskOutputs)}

Execution context:
- Working directory: ${activity.workingDirectory}
- Variables: ${JSON.stringify(activity.variables)}
- Files created so far: ${listCreatedFiles()}

Please retry the task, adjusting your approach based on:
1. The actual file locations (check previous outputs)
2. The current working directory
3. Available tools and their actual outputs

Your task: ${failedTask.description}
`
```

**Integration**:
```typescript
// In activity executor, after task fails:
if (trailblazingConfig.enabled) {
  const recoveryPrompt = await generateRecoveryPrompt(task, error, outputs, activity)
  
  for (let attempt = 1; attempt <= trailblazingConfig.maxRecoveryAttempts; attempt++) {
    const result = await attemptRecovery(activity, task, error)
    
    if (result.success) {
      // Track successful recovery
      activity.improvisations.push({
        taskId: task.id,
        attemptNumber: attempt,
        originalError: error.message,
        recoveryPrompt,
        outcome: 'success',
        costIncurred: result.cost
      })
      
      // Continue to next task
      return result
    }
    
    if (activity.totalCostIncurred > trailblazingConfig.maxTotalCost) {
      throw new Error('Trailblazing cost limit exceeded')
    }
  }
}
```

### Task 2.2: Variant Creation from Recoveries (2 days)

**Files to Modify**:
```
src/session/activity-executor.ts
  + async function extractModifications(
      activity: Activity
    ): Promise<TemplateModification[]>
    
  + async function createVariantFromRecovery(
      activity: Activity,
      originalTemplate: ActivityTemplate
    ): Promise<ActivityTemplate>
```

**Logic**:
```typescript
// After successful activity with improvisations:
if (activity.improvisations.length > 0 && activity.status === 'completed') {
  const modifications = await extractModifications(activity)
  
  const variant = await TemplateRepository.createVariant(
    originalTemplate,
    modifications,
    `Auto-recovered from ${activity.improvisations.length} failures`
  )
  
  variant.genealogy.evolution = {
    reason: `Recovered from: ${activity.improvisations.map(i => i.originalError).join(', ')}`,
    based_on_execution: activity.id,
    improvised: true,
    author: 'trailblazing-system'
  }
  
  await TemplateServiceClient.registerTemplate(variant)
}
```

### Phase 2 Success Criteria ✅
- [ ] Trailblazing parameters work in activity tool
- [ ] Recovery prompts are generated automatically
- [ ] Activities auto-recover from transient failures
- [ ] Successful recoveries create tracked variants
- [ ] Variants have proper genealogy (improvised=true)
- [ ] Recovery costs are tracked and limited

---

## Phase 3: Automation (Week 3) - MEDIUM

### 🎯 Objective
Close the loop: automatic diagnosis → evolution → validation → promotion

### Task 3.1: Continuous Improvement Loop Template (2 days)

**File to Create**:
```
templates/built-in/continuous-improvement-loop.json
  Tasks:
  1. diagnose-failure - Run debug-activity-self-contained
  2. evolve-template - Run evolve-activity-self-contained
  3. register-variant - Register improved template
  4. enable-ab-test - Start A/B testing
  5. collect-metrics - Wait 24h and gather data
  6. evaluate-winner - Promote best variant
```

**Usage**:
```typescript
// Trigger manually or on failure hook
await activity({
  templateId: 'continuous-improvement-loop',
  variables: {
    executionId: 'failed-exec-123',
    templateId: 'problematic-template'
  },
  reason: 'Automatic improvement cycle after repeated failures'
})
```

### Task 3.2: A/B Testing Framework (2 days)

**Files to Create**:
```
src/session/activity-ab-testing.ts
  + class ABTestManager
  + startTest(originalId: string, variantId: string, split: number): TestConfig
  + recordExecution(testId: string, templateId: string, result: Result): void
  + getMetrics(testId: string): { original: Metrics, variant: Metrics }
  + promoteWinner(testId: string): string
  + archiveLoser(testId: string): void

src/session/activity-template-repository.ts
  + Add AB test routing:
    static async getForExecution(templateId: string): Promise<Template> {
      const activeTest = ABTestManager.getActiveTest(templateId)
      if (activeTest) {
        return ABTestManager.selectVariant(activeTest) // 50/50 split
      }
      return this.get(templateId)
    }
```

### Task 3.3: Failure Hooks (2 days)

**Files to Create**:
```
src/session/activity-failure-hooks.ts
  + registerFailureHook(templateId: string, hook: FailureHook): void
  + triggerHooks(activity: Activity): Promise<void>
  + Built-in hooks:
    - OnRepeatedFailure (threshold: 3 failures in 24h)
    - OnLowSuccessRate (threshold: <70%)
    - OnHighCost (threshold: >$10/execution)
```

**Integration**:
```typescript
// In activity executor, after failure:
await ActivityFailureHooks.triggerHooks(activity)

// Registered hooks execute automatically:
FailureHooks.register('problematic-template', {
  condition: (activity) => activity.failureCount > 3,
  action: async (activity) => {
    // Trigger continuous improvement loop
    await activity({
      templateId: 'continuous-improvement-loop',
      variables: {
        executionId: activity.id,
        templateId: activity.templateId
      }
    })
  }
})
```

### Phase 3 Success Criteria ✅
- [ ] Continuous improvement loop template works end-to-end
- [ ] A/B testing splits traffic 50/50
- [ ] Metrics are collected automatically
- [ ] Winners are promoted after 24h
- [ ] Failure hooks trigger improvement loops
- [ ] <5% of failures require manual intervention

---

## Testing Plan

### Phase 1 Tests
```typescript
// test/unit/template-genealogy.test.ts
describe('Template Genealogy', () => {
  it('generates proper version strings')
  it('tracks parent-child relationships')
  it('increments generation numbers')
  it('stores evolution metadata')
})

// test/integration/backend-api.test.ts
describe('Backend API Integration', () => {
  it('fetches execution history')
  it('fetches template metrics')
  it('fetches learning data')
  it('registers templates with backend')
})
```

### Phase 2 Tests
```typescript
// test/integration/trailblazing.test.ts
describe('Trailblazing', () => {
  it('generates recovery prompts')
  it('retries failed tasks with context')
  it('creates variants from successful recoveries')
  it('respects cost limits')
  it('tracks improvisations')
})
```

### Phase 3 Tests
```typescript
// test/e2e/continuous-improvement.test.ts
describe('Continuous Improvement Loop', () => {
  it('diagnoses failed activity')
  it('evolves template with improvements')
  it('registers variant and starts A/B test')
  it('collects metrics for 24h (mocked)')
  it('promotes winner and archives loser')
})
```

---

## Risk Mitigation

### Risk 1: Backend API Unavailable
**Mitigation**: Graceful degradation to local cache + clear error messages

### Risk 2: Trailblazing Costs Spiraling
**Mitigation**: Hard cost limits ($1/task, $5/total) with circuit breaker

### Risk 3: Bad Variants Getting Promoted
**Mitigation**: A/B test with statistical significance check (p<0.05)

### Risk 4: Breaking Changes During Evolution
**Mitigation**: JSON schema validation + rollback on first failure

---

## Success Metrics (After 3 Weeks)

- **Template Success Rate**: >80% (up from ~60%)
- **Auto-Recovery Rate**: >50% of transient failures
- **Manual Interventions**: <10% of failures
- **Improvement Cycle Time**: <24h (diagnosis→promotion)
- **Template Conflicts**: 0 (single source of truth)
- **Genealogy Trees**: Growing (healthy evolution)

---

## Next Steps

1. **Review and approve this plan**
2. **Set up development branch**: `feature/self-healing-templates`
3. **Begin Phase 1, Task 1.1**: Implement template genealogy
4. **Daily standups**: Track progress, unblock issues
5. **Weekly demos**: Show working features

**Ready to start!** 🚀
