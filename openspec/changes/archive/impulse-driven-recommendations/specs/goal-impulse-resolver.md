# Spec: Goal Impulse Resolver

## Overview

Add 'goal' pointer type to activity-api's impulse resolver (`POST /v2/impulses/resolve`). This enables activity-api to resolve goal-shaped impulses by returning activity recommendations via Thompson Sampling.

## Scope

### In Scope
- Add `case 'goal'` to impulse resolver switch statement
- Extract goal description and context from pointer
- Call Thompson Sampling with impulse context
- Return recommendations as JSON string content
- Return metadata about recommendation quality

### Out of Scope
- Modifying Thompson Sampling algorithm
- Changing activity template structure
- Adding new recommendation filters

## Requirements

### Functional Requirements

**FR-1: Goal Pointer Structure**

Input pointer format:
```typescript
{
  type: 'goal',
  content: string,              // Required: Goal description
  category?: string,            // Optional: Activity category filter
  impulseRefs?: string[],       // Optional: IDs of loaded impulses (context)
  limit?: number,               // Optional: Max recommendations (default 3)
  excludeActivities?: string[]  // Optional: Blacklist for retries
}
```

**FR-2: Resolution Logic**

```typescript
case 'goal': {
  // 1. Extract goal parameters
  const goalDescription = pointer.content
  const category = pointer.category
  const impulseRefs = pointer.impulseRefs || []
  const limit = pointer.limit || 3
  const exclude = pointer.excludeActivities || []

  // 2. Validate required fields
  if (!goalDescription) {
    return c.json({
      success: false,
      error: 'content (goal description) required for goal pointer'
    }, 400)
  }

  // 3. Load impulse metadata for context (optional enhancement)
  // This allows Thompson Sampling to consider what context MiniBob has
  const impulseContext = []
  if (impulseRefs.length > 0) {
    const contextQuery = `
      SELECT id, shape, summary FROM impulse
      WHERE id IN $impulse_ids
    `
    impulseContext = await surrealDB.query(contextQuery, {
      impulse_ids: impulseRefs
    })
  }

  // 4. Call existing Thompson Sampling logic
  const recommendations = await recommendActivitiesWithSampling({
    task_description: goalDescription,
    category: category,
    loaded_impulses: impulseRefs,
    limit: limit,
    exclude_activities: exclude,
    org_id: getOrgIdFromAuth(c),  // RBAC
    project_id: getProjectIdFromAuth(c)
  })

  // 5. Format as impulse content
  const content = JSON.stringify({
    recommendations: recommendations,
    metadata: {
      impulse_context_size: impulseRefs.length,
      impulse_context_shapes: impulseContext.map(i => i.shape),
      sampling_method: 'thompson',
      total_candidates: recommendations.length
    }
  })

  // 6. Return with metadata
  return c.json({
    success: true,
    content: content,
    metadata: {
      shape: 'activityRecommendations',
      rowCount: recommendations.length,
      summary: `${recommendations.length} activities recommended for: "${goalDescription.substring(0, 50)}..."`,
      availableOps: ['select', 'execute', 'compare']
    }
  }, 200)
}
```

**FR-3: Recommendation Format**

Output content (JSON string):
```json
{
  "recommendations": [
    {
      "template_id": "add-authentication-complete",
      "template_name": "Add Authentication (Complete)",
      "confidence": 0.87,
      "selection_metadata": {
        "thompson_alpha": 12.5,
        "thompson_beta": 2.3,
        "sampled_value": 0.8654,
        "success_rate": 0.844,
        "total_executions": 15
      }
    }
  ],
  "metadata": {
    "impulse_context_size": 3,
    "impulse_context_shapes": ["file", "memo", "activityExecutionTrace"],
    "sampling_method": "thompson",
    "total_candidates": 8
  }
}
```

### Non-Functional Requirements

**NFR-1: Performance**
- Resolution should complete in <500ms for typical queries
- Thompson Sampling query should use existing indexes
- Impulse metadata loading should be optional (skip if empty)

**NFR-2: RBAC Enforcement**
- Only return activities visible to org_id (via $auth or JWT)
- Respect project_id scoping if provided
- Use existing authentication middleware

**NFR-3: Error Handling**
- Return 400 for missing required fields
- Return 404 if no activities match category
- Return 500 with details if Thompson Sampling fails
- Log all errors for debugging

## Implementation Details

### File to Modify

`repos/metabob-activity-api/src/routes/impulses.ts`

**Location**: Around line 1222 (after existing pointer type cases)

**Add new case:**
```typescript
case 'goal': {
  // Implementation from FR-2 above
  break;
}
```

### Helper Function (Optional)

Create `src/services/goal-resolver.ts`:
```typescript
import { recommendActivitiesWithSampling } from './thompson-sampling'
import type { JwtAuthContext } from '../middleware/jwtAuth'

export async function resolveGoalImpulse(params: {
  goalDescription: string
  category?: string
  impulseRefs?: string[]
  limit?: number
  excludeActivities?: string[]
  auth?: JwtAuthContext
}): Promise<{
  recommendations: any[]
  metadata: any
}> {
  // Implementation
}
```

### Integration with Existing Code

**Reuse existing logic:**
- `recommendActivitiesWithSampling()` from `src/services/thompson-sampling.ts`
- Authentication from `getJwtAuthFromContext(c)`
- Database queries via `surrealDB.query()` or `queryWithAuth()`

**Do NOT duplicate:**
- Thompson Sampling algorithm
- RBAC logic
- Activity template queries

## Verification Steps

**Step 1: Manual testing with curl**
```bash
# Test basic goal resolution
curl -X POST http://api.metabob.local/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "pointer": {
      "type": "goal",
      "content": "Add user authentication to the dashboard",
      "category": "feature",
      "limit": 3
    }
  }' | jq

# Expected: 200 OK with recommendations array
```

**Step 2: Test with impulse context**
```bash
# Create some impulses first, then reference them
curl -X POST http://api.metabob.local/v2/impulses/resolve \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "pointer": {
      "type": "goal",
      "content": "Fix login bug",
      "impulseRefs": ["file-src-auth.ts", "memo-bug-report"],
      "limit": 5
    }
  }' | jq
```

**Step 3: Test error handling**
```bash
# Missing required field
curl -X POST http://api.metabob.local/v2/impulses/resolve \
  -d '{"pointer": {"type": "goal"}}' | jq
# Expected: 400 Bad Request

# Invalid category
curl -X POST http://api.metabob.local/v2/impulses/resolve \
  -d '{
    "pointer": {
      "type": "goal",
      "content": "Test",
      "category": "nonexistent"
    }
  }' | jq
# Expected: 200 OK with empty recommendations
```

**Step 4: Integration test from MiniBob**
```typescript
// In repos/minibob
import { getMCPClient } from './mcp'

const mcp = getMCPClient()
const result = await mcp.resolveImpulse({
  type: 'goal',
  content: 'Add tests for authentication module',
  category: 'test',
  limit: 3
})

console.log('Resolved goal impulse:', result)
// Expected: JSON string with recommendations
```

## Testing

### Unit Tests

Create `repos/metabob-activity-api/test/goal-impulse-resolver.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test'
import app from '../src/index'

describe('Goal Impulse Resolver', () => {
  test('should resolve basic goal impulse', async () => {
    const res = await app.request('/v2/impulses/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointer: {
          type: 'goal',
          content: 'Add user authentication'
        }
      })
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)

    const content = JSON.parse(data.content)
    expect(content.recommendations).toBeArray()
    expect(content.recommendations.length).toBeGreaterThan(0)
  })

  test('should respect limit parameter', async () => {
    const res = await app.request('/v2/impulses/resolve', {
      method: 'POST',
      body: JSON.stringify({
        pointer: {
          type: 'goal',
          content: 'Test goal',
          limit: 2
        }
      })
    })

    const data = await res.json()
    const content = JSON.parse(data.content)
    expect(content.recommendations.length).toBeLessThanOrEqual(2)
  })

  test('should reject missing content', async () => {
    const res = await app.request('/v2/impulses/resolve', {
      method: 'POST',
      body: JSON.stringify({
        pointer: { type: 'goal' }
      })
    })

    expect(res.status).toBe(400)
  })
})
```

### Integration Tests

Test end-to-end flow from MiniBob.

## Acceptance Criteria

- [ ] `case 'goal'` added to impulse resolver
- [ ] Goal description extracted from `pointer.content`
- [ ] Thompson Sampling called with impulse context
- [ ] Recommendations returned as JSON string
- [ ] Metadata includes recommendation quality info
- [ ] Error handling for missing required fields
- [ ] RBAC enforced (org_id filtering)
- [ ] Unit tests pass
- [ ] Manual curl tests succeed
- [ ] Integration test from MiniBob works

## Dependencies

- Existing Thompson Sampling implementation (`src/services/thompson-sampling.ts`)
- Existing impulse resolver endpoint (`POST /v2/impulses/resolve`)
- JWT authentication middleware
- SurrealDB activity_template and variant_performance_metrics tables
