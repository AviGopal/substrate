# Spec: MiniBob Impulse-Driven Goal Processing

## Overview

Update MiniBob's goal processor to use impulse resolution instead of direct MCP method calls. This aligns MiniBob with the vessel/impulse paradigm: "don't treat activity-api any differently than any other vessel."

## Scope

### In Scope
- Update `goal-processor.ts` to create goal impulses
- Use impulse resolution instead of `mcp.recommendActivities()`
- Parse recommendations from resolved impulse content
- Keep MCP method as deprecated fallback (Phase 1)
- Update tests to use impulse-driven approach

### Out of Scope
- Changing activity execution logic
- Modifying impulse resolution dispatch order
- Changing Thompson Sampling parameters

## Requirements

### Functional Requirements

**FR-1: Goal Impulse Creation**

When user provides a goal, create a goal impulse:

```typescript
// In goal-processor.ts

async function processGoal(goalDescription: string, options: GoalOptions): Promise<void> {
  // 1. Get current impulse context
  const currentImpulses = getImpulseStore()
    .list()
    .filter(i => i.loaded)  // Only loaded impulses are available context
    .map(i => i.id)

  // 2. Create goal impulse
  const goalImpulse = createImpulse({
    id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    pointer: {
      type: 'goal',
      content: goalDescription,
      category: options.category,
      impulseRefs: currentImpulses,  // Pass current context!
      limit: options.limit || 3,
      excludeActivities: options.excludeActivities || []
    },
    metadata: {
      shape: 'goal',
      priority: options.priority || 'high',
      summary: `Goal: ${goalDescription.substring(0, 100)}...`
    },
    budget: 4000  // Recommendations don't need much budget
  })

  log.info('Goal impulse created', {
    id: goalImpulse.id,
    context_size: currentImpulses.length
  })

  // 3. Add to impulse state space (optional - loadImpulse will do this)
  // Already done by createImpulse()

  return goalImpulse.id
}
```

**FR-2: Impulse Resolution**

Resolve the goal impulse to get recommendations:

```typescript
async function getRecommendations(goalImpulseId: string): Promise<ActivityRecommendation[]> {
  try {
    // 1. Resolve goal impulse via impulse system
    //    This will:
    //    - Check local resolvers (no match)
    //    - Query vessel discovery (finds activity-api)
    //    - Call activity-api's impulse resolver
    //    - Return recommendations as content
    const resolved = await loadImpulse(goalImpulseId)

    if (!resolved.loaded || !resolved.content) {
      throw new Error(`Failed to resolve goal impulse: ${goalImpulseId}`)
    }

    // 2. Parse recommendations from content
    const data = JSON.parse(resolved.content)

    if (!data.recommendations || !Array.isArray(data.recommendations)) {
      throw new Error('Invalid recommendation format from impulse resolution')
    }

    log.info('Goal impulse resolved', {
      id: goalImpulseId,
      recommendations: data.recommendations.length,
      context_size: data.metadata?.impulse_context_size || 0
    })

    return data.recommendations

  } catch (error) {
    log.error('Goal impulse resolution failed', {
      id: goalImpulseId,
      error: error instanceof Error ? error.message : String(error)
    })

    // Fall back to deprecated MCP method
    return getFallbackRecommendations(goalImpulseId)
  }
}
```

**FR-3: Deprecated Fallback**

Keep MCP method as fallback during transition:

```typescript
async function getFallbackRecommendations(goalImpulseId: string): Promise<ActivityRecommendation[]> {
  log.warn('[DEPRECATED] Falling back to direct MCP recommendActivities()')

  const goalImpulse = getImpulseStore().get(goalImpulseId)
  if (!goalImpulse) {
    throw new Error(`Goal impulse not found: ${goalImpulseId}`)
  }

  const pointer = goalImpulse.pointer as any
  const mcp = getMCPClient()

  if (!mcp) {
    throw new Error('No MCP client and impulse resolution failed - cannot get recommendations')
  }

  // Use old direct call
  const recs = await mcp.recommendActivities(
    pointer.content,
    pointer.category,
    pointer.impulseRefs,
    pointer.limit,
    pointer.excludeActivities
  )

  return recs
}
```

**FR-4: Updated processGoal Flow**

Complete updated flow:

```typescript
export async function processGoal(
  goalDescription: string,
  options: GoalOptions = {}
): Promise<void> {
  // 1. Create goal impulse
  const goalImpulseId = await createGoalImpulse(goalDescription, options)

  // 2. Get recommendations via impulse resolution
  const recommendations = await getRecommendations(goalImpulseId)

  // 3. Select activity (existing logic)
  const selected = selectActivity(recommendations, options)

  // 4. Execute activity (existing logic - no changes)
  await executeActivity(selected, {
    goalDescription,
    goalImpulseId,
    // ...other options
  })

  // 5. Check goal completion (existing logic - no changes)
  const completed = await checkGoalCompletion(goalDescription)

  if (!completed && attempts < maxAttempts) {
    // Retry with exclusion
    return processGoal(goalDescription, {
      ...options,
      excludeActivities: [...(options.excludeActivities || []), selected.template_id]
    })
  }
}
```

### Non-Functional Requirements

**NFR-1: Backward Compatibility**
- Keep deprecated MCP method for 1 release
- Log warnings when fallback is used
- Monitor fallback usage in production

**NFR-2: Error Handling**
- Graceful fallback if impulse resolution fails
- Clear error messages for debugging
- Log impulse resolution failures

**NFR-3: Performance**
- Impulse resolution should not be slower than direct MCP call
- Goal impulse creation should be <10ms
- Total recommendation time should be <1s

## Implementation Details

### Files to Modify

**1. `repos/minibob/src/goal-processor.ts`**

Main changes:
```typescript
// REMOVE direct MCP calls:
// const recs = await mcp.recommendActivities(...)

// REPLACE with impulse-driven:
const goalImpulseId = await createGoalImpulse(goalDescription, options)
const recs = await getRecommendations(goalImpulseId)
```

**2. `repos/minibob/src/types.ts`**

Add types:
```typescript
export interface GoalOptions {
  category?: string
  limit?: number
  priority?: 'critical' | 'high' | 'medium' | 'low'
  excludeActivities?: string[]
  maxAttempts?: number
}

export interface ActivityRecommendation {
  template_id: string
  template_name?: string
  confidence: number
  selection_metadata: {
    thompson_alpha: number
    thompson_beta: number
    sampled_value: number
    success_rate: number
    total_executions: number
  }
}
```

**3. `repos/minibob/src/mcp.ts` (Optional - Add deprecation warning)**

```typescript
/**
 * @deprecated Use impulse resolution instead
 * Create a goal impulse and resolve it via loadImpulse()
 */
async recommendActivities(...args): Promise<any[]> {
  console.warn('[DEPRECATED] mcp.recommendActivities() - Use impulse resolution for goal-driven flow')
  // Keep existing implementation for fallback
}
```

### Helper Functions

**Create goal impulse:**
```typescript
function createGoalImpulse(
  goalDescription: string,
  options: GoalOptions
): string {
  const currentImpulses = getImpulseStore()
    .list()
    .filter(i => i.loaded)
    .map(i => i.id)

  const goalImpulse = createImpulse({
    id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    pointer: {
      type: 'goal',
      content: goalDescription,
      category: options.category,
      impulseRefs: currentImpulses,
      limit: options.limit || 3,
      excludeActivities: options.excludeActivities || []
    },
    metadata: {
      shape: 'goal',
      priority: options.priority || 'high',
      summary: `Goal: ${goalDescription.substring(0, 100)}...`
    },
    budget: 4000
  })

  return goalImpulse.id
}
```

## Verification Steps

**Step 1: Test goal impulse creation**
```bash
cd repos/minibob
bun run test-goal-impulse.ts
```

**Step 2: Test impulse resolution**
```typescript
// test-goal-resolution.ts
import { createImpulse, loadImpulse } from './src/impulse'

const goalImpulse = createImpulse({
  id: 'goal-test',
  pointer: {
    type: 'goal',
    content: 'Add tests for authentication module',
    category: 'test'
  },
  metadata: { shape: 'goal', priority: 'high' },
  budget: 4000
})

const resolved = await loadImpulse(goalImpulse.id)
console.log('Resolved:', resolved)

const recommendations = JSON.parse(resolved.content)
console.log('Recommendations:', recommendations.recommendations.length)
```

**Step 3: End-to-end test**
```bash
# Start MiniBob with impulse-driven goal processing
bun run src/index.ts --single "Add user authentication to the dashboard"

# Check logs for:
# - "Goal impulse created"
# - "Goal impulse resolved"
# - NOT "Falling back to direct MCP"
```

**Step 4: Test fallback**
```typescript
// Simulate impulse resolution failure
// Should see warning and fallback to MCP method
```

## Testing

### Unit Tests

`repos/minibob/test/goal-processor-impulse.test.ts`:

```typescript
import { describe, test, expect, mock } from 'bun:test'
import { processGoal } from '../src/goal-processor'
import { createImpulse, loadImpulse } from '../src/impulse'

describe('Impulse-Driven Goal Processing', () => {
  test('should create goal impulse', async () => {
    const goalImpulseId = await createGoalImpulse('Test goal', {})
    const impulse = getImpulseStore().get(goalImpulseId)

    expect(impulse).toBeDefined()
    expect(impulse?.pointer.type).toBe('goal')
    expect(impulse?.metadata?.shape).toBe('goal')
  })

  test('should resolve goal impulse to recommendations', async () => {
    const goalImpulseId = await createGoalImpulse('Add auth', { category: 'feature' })
    const recs = await getRecommendations(goalImpulseId)

    expect(recs).toBeArray()
    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0].template_id).toBeDefined()
  })

  test('should pass impulse context', async () => {
    // Create some loaded impulses
    const fileImpulse = createImpulse({
      id: 'file-test',
      pointer: { type: 'file', path: 'test.ts' },
      metadata: { shape: 'file' },
      budget: 2000
    })
    await loadImpulse(fileImpulse.id)

    const goalImpulseId = await createGoalImpulse('Test with context', {})
    const goalImpulse = getImpulseStore().get(goalImpulseId)

    expect(goalImpulse?.pointer.impulseRefs).toContain('file-test')
  })

  test('should fall back to MCP on resolution failure', async () => {
    // Mock impulse resolution to fail
    mock.module('../src/impulse', () => ({
      loadImpulse: async () => { throw new Error('Simulated failure') }
    }))

    const recs = await getRecommendations('goal-test')
    // Should still return recommendations via fallback
    expect(recs).toBeArray()
  })
})
```

### Integration Tests

Test with real activity-api backend.

## Acceptance Criteria

- [ ] Goal impulses created with proper structure
- [ ] Impulse resolution used instead of direct MCP calls
- [ ] Current impulse context passed in impulseRefs
- [ ] Recommendations parsed from resolved content
- [ ] Fallback to MCP method works if resolution fails
- [ ] Deprecation warnings logged when fallback used
- [ ] All existing tests still pass
- [ ] New impulse-driven tests pass
- [ ] End-to-end goal execution works

## Migration Path

### Phase 1: Add impulse-driven path (This spec)
- Implement impulse-driven logic
- Keep MCP fallback
- Deploy to canary
- Monitor for failures

### Phase 2: Make impulse-driven primary
- Remove fallback logic
- Make MCP method fully deprecated
- Update documentation
- Deploy to production

### Phase 3: Remove deprecated code
- Delete MCP recommendActivities method
- Remove fallback logic
- Clean up imports
- Final release

## Dependencies

- Goal impulse resolver in activity-api (see `goal-impulse-resolver.md`)
- Vessel discovery (optional - will fall back to MCP if unavailable)
- Existing impulse resolution system in MiniBob
