# External Validation Integration Guide

> **Status:** Superseded by Phase 9 of `2026-04-26-impulse-activity-loop`. The Thompson Sampling implementation described below is current code; the integration recipe will be replaced once the `thompson_posterior` shape lands. Treat this doc as historical implementation reference, not target architecture.

## Overview

This document describes how to integrate the ExternalValidationResolver into MiniBob's activity execution flow. It covers:

1. Registering the resolver
2. Detecting external validation tasks
3. Executing external validation
4. Recording differentiated feedback
5. Handling failures and retries

## Current State

**Internal validation** (existing):
- Location: `repos/minibob/src/activity.ts:2183-2262`
- Runs after task execution
- Pattern-based validation only
- Binary success/failure

**External validation** (new):
- Resolver: `repos/minibob/src/resolvers/external-validation-resolver.ts`
- Runs as separate task or post-execution hook
- Executes against real external systems
- Classified errors with retriability and categories

## Integration Steps

### Step 1: Register External Validation Resolver

**File**: `repos/minibob/src/activity.ts`

**Location**: Where other resolvers are registered (search for resolver map initialization)

```typescript
import { ExternalValidationResolver } from './resolvers/external-validation-resolver'

// In ActivityExecutor constructor or initialization
this.resolvers.set('external-validation', new ExternalValidationResolver(
  this.workingDirectory,
  {
    defaultTimeout: 30000,  // 30 seconds default
    cacheResults: false
  }
))
```

### Step 2: Detect External Validation Tasks

External validation tasks are identified by:
- `resolver: "external-validation"` in task definition
- `resolverRequirements.resolver === "external-validation"`

**Example task structure**:
```json
{
  "id": "validate-sql",
  "resolver": "external-validation",
  "impulseReferences": ["task-generate-sql-output"],
  "resolverRequirements": {
    "resolver": "external-validation",
    "config": {
      "validationType": "database",
      "dbType": "postgres",
      "connectionString": "${DATABASE_URL}",
      "dryRun": true
    }
  }
}
```

### Step 3: Execute External Validation Task

**File**: `repos/minibob/src/activity.ts`

**Location**: Task execution loop (search for resolver execution logic)

```typescript
// When executing task with resolver === "external-validation"
if (task.resolver === 'external-validation') {
  const resolver = this.resolvers.get('external-validation')

  if (!resolver || !resolver.enabled) {
    return {
      taskId: task.id,
      status: "failed",
      error: "External validation resolver not available"
    }
  }

  // Load impulse references
  const impulseRefs = await this.prepareImpulseRefs(task.impulseReferences || [])

  // Get validation config from resolverRequirements
  const config = task.resolverRequirements?.config || {}

  // Execute validation
  const validationOutputs = await resolver.resolve(impulseRefs, config)

  // Extract validation result
  const validationResult = validationOutputs[0]
  const passed = validationResult.metadata?.passed || false

  // Return task result
  return {
    taskId: task.id,
    status: passed ? "completed" : "failed",
    output: validationResult.content,
    error: passed ? undefined : validationResult.metadata?.errorType,
    metadata: {
      validationType: validationResult.metadata?.validationType,
      errorType: validationResult.metadata?.errorType,
      errorCount: validationResult.metadata?.errorCount,
      retriable: validationResult.metadata?.retriable,
      failureCategory: validationResult.metadata?.failureCategory,
      durationMs: validationResult.metadata?.durationMs
    }
  }
}
```

### Step 4: Enhance Internal Validation to Track Both

**Current flow**:
```typescript
// After LLM task execution
if (task.validation) {
  const validationResult = await this.runValidation(task.validation, result.content, variables)
  if (!validationResult.success) {
    return { taskId, status: "failed", error: validationResult.error }
  }
}
```

**Enhanced flow** (to support post-task external validation):
```typescript
// After LLM task execution
let internalValidation = { success: true }
let externalValidation = { success: true, metadata: {} }

// 1. Run internal validation (existing)
if (task.validation) {
  internalValidation = await this.runValidation(task.validation, result.content, variables)
}

// 2. Run external validation if specified (NEW)
if (task.externalValidation) {
  // Create impulse from task output
  const outputImpulse: Impulse = {
    id: `task-${task.id}-output`,
    pointer: { type: 'memo', content: result.content },
    budget: Math.ceil(result.content.length / 4),
    priority: 'required',
    loaded: true,
    content: result.content,
    metadata: { shape: 'task_output' },
    createdAt: Date.now()
  }

  // Register impulse for validation
  this.impulses.set(outputImpulse.id, outputImpulse)

  // Create impulse reference
  const impulseRefs: ImpulseRef[] = [{
    id: 'output',
    ref: outputImpulse.id,
    priority: 'required',
    budget: outputImpulse.budget
  }]

  // Execute external validation
  const externalResolver = this.resolvers.get('external-validation')
  if (externalResolver && externalResolver.enabled) {
    const validationOutputs = await externalResolver.resolve(
      impulseRefs,
      task.externalValidation
    )

    const validationResult = validationOutputs[0]
    externalValidation = {
      success: validationResult.metadata?.passed || false,
      metadata: {
        errorType: validationResult.metadata?.errorType,
        errorMessage: validationResult.content,
        retriable: validationResult.metadata?.retriable,
        failureCategory: validationResult.metadata?.failureCategory,
        validationType: validationResult.metadata?.validationType
      }
    }
  }
}

// 3. Determine overall task success
const taskPassed = internalValidation.success && externalValidation.success

// 4. Record differentiated feedback to backend (NEW)
if (isMCPEnabled() && templateId) {
  await this.recordDifferentiatedValidation({
    execution_id: executionId,
    task_id: task.id,
    success: taskPassed,
    internal_validation_passed: internalValidation.success,
    external_validation_passed: externalValidation.success,
    external_validation_type: externalValidation.metadata?.validationType,
    external_error_type: externalValidation.metadata?.errorType,
    external_error_message: externalValidation.metadata?.errorMessage,
    external_failure_category: externalValidation.metadata?.failureCategory,
    external_retriable: externalValidation.metadata?.retriable
  })
}

// 5. Return result with differentiated metadata
if (!taskPassed) {
  const errorSource = !internalValidation.success ? 'internal' : 'external'
  const errorMsg = !internalValidation.success
    ? internalValidation.error
    : externalValidation.metadata?.errorMessage

  return {
    taskId: task.id,
    status: "failed",
    error: `${errorSource} validation failed: ${errorMsg}`,
    metadata: {
      internalValidation: internalValidation.success,
      externalValidation: externalValidation.success,
      errorType: externalValidation.metadata?.errorType,
      failureCategory: externalValidation.metadata?.failureCategory,
      retriable: externalValidation.metadata?.retriable
    }
  }
}
```

### Step 5: Add MCP Endpoint for Differentiated Feedback

**File**: `repos/minibob/src/mcp.ts`

Add method to record differentiated validation:

```typescript
async recordDifferentiatedValidation(data: {
  execution_id: string
  task_id: string
  success: boolean
  internal_validation_passed: boolean
  external_validation_passed: boolean
  external_validation_type?: string
  external_error_type?: string
  external_error_message?: string
  external_failure_category?: string
  external_retriable?: boolean
}): Promise<void> {
  await this.callTool('record-task-validation', {
    ...data,
    timestamp: Date.now()
  })
}
```

**File**: `repos/metabob-activity-api/src/routes/activities.ts`

Add MCP tool handler:

```typescript
// POST /v2/activities/task-validation
app.post('/v2/activities/task-validation', async (c) => {
  const body = await c.req.json()

  // Update execution trace with differentiated validation
  await db.query(`
    UPDATE activity_execution_trace
    SET
      internal_validation_passed = $internal_validation_passed,
      external_validation_passed = $external_validation_passed,
      external_validation_type = $external_validation_type,
      external_error_type = $external_error_type,
      external_failure_category = $external_failure_category,
      external_retriable = $external_retriable
    WHERE id = $execution_id
  `, {
    execution_id: body.execution_id,
    internal_validation_passed: body.internal_validation_passed,
    external_validation_passed: body.external_validation_passed,
    external_validation_type: body.external_validation_type || null,
    external_error_type: body.external_error_type || null,
    external_failure_category: body.external_failure_category || null,
    external_retriable: body.external_retriable || false
  })

  // Record in validation history
  await db.query(`
    CREATE external_validation_history CONTENT {
      org_id: $org_id,
      execution_id: $execution_id,
      task_id: $task_id,
      validation_type: $validation_type,
      passed: $passed,
      error_type: $error_type,
      error_message: $error_message,
      failure_category: $failure_category,
      retriable: $retriable,
      timestamp: time::now()
    }
  `, {
    org_id: c.get('auth')?.org_id,
    execution_id: body.execution_id,
    task_id: body.task_id,
    validation_type: body.external_validation_type,
    passed: body.external_validation_passed,
    error_type: body.external_error_type,
    error_message: body.external_error_message,
    failure_category: body.external_failure_category,
    retriable: body.external_retriable
  })

  return c.json({ success: true })
})
```

### Step 6: Update Thompson Sampling

**File**: `repos/metabob-activity-api/src/services/thompson-sampling.ts`

Modify Thompson parameter updates to use weighted penalties:

```typescript
// Category weights for Thompson Sampling adjustments
const CATEGORY_WEIGHTS: Record<string, number> = {
  code_quality: 0.8,
  schema_mismatch: 0.9,
  auth: 0.5,
  resource: 0.6,
  rate_limit: 0.2,
  timeout: 0.3,
  network: 0.1,
  external_service: 0.4,
  contract_violation: 0.7,
  behavior: 0.85,
  environment: 0.3,
  execution: 0.5,
  input: 0.6,
  unknown: 0.5
}

function updateThompsonParameters(
  metrics: ActivityMetrics,
  executionResult: {
    success: boolean
    internalValidation: boolean
    externalValidation: boolean
    failureCategory?: string
  }
): { alpha: number; beta: number } {
  let alpha = metrics.thompson_alpha
  let beta = metrics.thompson_beta

  if (executionResult.success) {
    // Both internal and external validation passed
    alpha += 1
  } else {
    // Determine penalty based on failure type
    let penalty = 1

    if (!executionResult.internalValidation) {
      // Internal validation failed - standard penalty
      penalty = 1
    } else if (!executionResult.externalValidation && executionResult.failureCategory) {
      // External validation failed - weighted penalty
      penalty = CATEGORY_WEIGHTS[executionResult.failureCategory] || 0.5
    }

    beta += penalty
  }

  return { alpha, beta }
}
```

## Testing Integration

### Unit Tests

Create `repos/minibob/test/external-validation-integration.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { ActivityExecutor } from '../src/activity'

describe('External Validation Integration', () => {
  it('should execute external validation task', async () => {
    // Test that external validation tasks execute correctly
  })

  it('should record differentiated feedback', async () => {
    // Test that both internal and external validation are tracked
  })

  it('should apply weighted Thompson penalties', async () => {
    // Test that failure categories affect Thompson differently
  })
})
```

### Integration Tests

Test with real external systems:

```bash
# Set up test database
export TEST_DATABASE_URL="postgresql://test:test@localhost/test_db"

# Run integration tests
bun test test/external-validation-integration.test.ts
```

## Deployment

### Phase 1: MiniBob Changes

1. Add ExternalValidationResolver to resolver registry
2. Add support for external validation tasks
3. Add MCP call for differentiated feedback
4. Deploy to canary

### Phase 2: Backend Changes

1. Run migration 053-external-validation.surql
2. Add MCP endpoint for task validation
3. Update Thompson Sampling service
4. Deploy to canary

### Phase 3: Validation

1. Create test activity with external validation
2. Execute and verify differentiated tracking
3. Check Thompson Sampling adjustments
4. Monitor error classification accuracy

## Monitoring

### Metrics to Track

1. **External validation adoption rate**
   - % of executions using external validation
   - Target: 40% within 3 months

2. **Validation gap**
   - % difference between internal and external success rates
   - Baseline: 25%
   - Target: < 10%

3. **Error classification accuracy**
   - Manual review of error classifications
   - Target: > 90% correct categorization

4. **Thompson Sampling improvement**
   - Measure recommendation accuracy before/after
   - Target: +15% improvement

### Dashboard Queries

```sql
-- External validation adoption
SELECT
  COUNT(*) as total_executions,
  COUNT(CASE WHEN external_validation_type IS NOT NULL THEN 1 END) as with_external,
  (COUNT(CASE WHEN external_validation_type IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)) as adoption_rate
FROM activity_execution_trace
WHERE timestamp > time::now() - 7d;

-- Validation gap
SELECT
  activity_id,
  COUNT(*) as total,
  SUM(CASE WHEN internal_validation_passed THEN 1 ELSE 0 END) as internal_success,
  SUM(CASE WHEN external_validation_passed THEN 1 ELSE 0 END) as external_success,
  (internal_success - external_success) * 100.0 / total as gap_pct
FROM activity_execution_trace
WHERE external_validation_type IS NOT NULL
GROUP BY activity_id
ORDER BY gap_pct DESC;

-- Failure category distribution
SELECT
  external_failure_category,
  COUNT(*) as count,
  AVG(external_retriable::int) as retriable_rate
FROM activity_execution_trace
WHERE external_validation_passed = false
GROUP BY external_failure_category
ORDER BY count DESC;
```

## Rollback Plan

If external validation causes issues:

1. **Disable resolver**: Set `enabled: false` in resolver registration
2. **Revert migration**: Remove external validation fields
3. **Revert Thompson**: Use original update logic
4. **Redeploy**: Push revert to canary, then production

```typescript
// Disable external validation
this.resolvers.set('external-validation', new ExternalValidationResolver(
  this.workingDirectory,
  { enabled: false }  // Resolver exists but disabled
))
```

## Next Steps

1. Implement Step 1-2 (register resolver, detect tasks)
2. Test with example templates
3. Implement Step 3-4 (execution and tracking)
4. Run backend migration
5. Implement Step 5-6 (MCP endpoint, Thompson updates)
6. Deploy to canary
7. Monitor metrics
8. Tune category weights based on data

## References

- [External Validation Guide](EXTERNAL_VALIDATION_GUIDE.md) - User-facing documentation
- [Validation Resolver Design](/tmp/validation-resolver-design.md) - Complete design document
- [External Validation Resolver](../repos/minibob/src/resolvers/external-validation-resolver.ts) - Implementation
- [Migration 053](../repos/metabob-activity-api/sql/migrations/053-external-validation.surql) - Schema changes
