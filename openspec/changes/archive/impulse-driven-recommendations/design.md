# Design: Impulse-Driven Activity Recommendations

## Architectural Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   IMPULSE-DRIVEN ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────┘

User Goal → MiniBob
     │
     ▼
┌──────────────────────────────────────┐
│ 1. CREATE goal impulse                │
│                                       │
│   createImpulse({                    │
│     id: generateId('goal'),          │
│     pointer: {                       │
│       type: 'goal',                  │
│       content: goalDescription,      │
│       category: inferCategory(),     │
│       impulseRefs: currentImpulseIds │ ← Pass current context!
│     },                               │
│     metadata: {                      │
│       shape: 'goal',                 │
│       priority: 'high'               │
│     },                               │
│     budget: 4000                     │
│   })                                 │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ 2. ADD to impulse state space        │
│                                       │
│   Impulse State Space:               │
│   ├─ goal-abc123 (unloaded)         │
│   ├─ file-src-auth.ts (loaded)      │
│   └─ memo-requirements (loaded)     │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ 3. RESOLVE goal impulse              │
│                                       │
│   const resolved = await             │
│     loadImpulse('goal-abc123')       │
│                                       │
│   This triggers:                     │
│   impulse.ts:resolvePointer()        │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ 4. DISPATCH via vessel discovery     │
│                                       │
│   Dispatch order:                    │
│   ├─ Local types (memo, file) ✗     │
│   ├─ Custom resolvers ✗              │
│   ├─ Vessel discovery ✓              │
│   │   └─ Query: resolve 'goal'       │
│   │       shape with impulse refs    │
│   └─ MCP backend fallback            │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ 5. ACTIVITY-API resolves             │
│                                       │
│   POST /v2/impulses/resolve          │
│   {                                  │
│     "pointer": {                     │
│       "type": "goal",                │
│       "content": "Add auth",         │
│       "category": "feature",         │
│       "impulseRefs": [               │
│         "file-src-auth.ts",          │
│         "memo-requirements"          │
│       ]                              │
│     }                                │
│   }                                  │
│                                       │
│   activity-api:                      │
│   - Calls Thompson Sampling          │
│   - Passes impulse context           │
│   - Returns recommendations as       │
│     impulse content                  │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ 6. PARSE recommendations             │
│                                       │
│   const recs = JSON.parse(           │
│     resolved.content                 │
│   )                                  │
│                                       │
│   recs.recommendations = [           │
│     {                                │
│       template_id: "...",            │
│       confidence: 0.85,              │
│       selection_metadata: {...}      │
│     }                                │
│   ]                                  │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ 7. EXECUTE selected activity         │
│                                       │
│   await activityExecutor.execute(    │
│     recs.recommendations[0],         │
│     variables                        │
│   )                                  │
└──────────────────────────────────────┘
```

## Key Design Decisions

### D1: 'goal' Impulse Pointer Type

**Decision**: Add 'goal' as a new impulse pointer type resolved by activity-api

**Pointer structure:**
```typescript
{
  type: 'goal',
  content: string,              // Goal description
  category?: string,            // Activity category filter
  impulseRefs?: string[],       // IDs of loaded impulses (context)
  limit?: number,               // Max recommendations (default 3)
  excludeActivities?: string[]  // Blacklist for retries
}
```

**Resolved content:**
```typescript
{
  recommendations: Array<{
    template_id: string,
    confidence: number,
    selection_metadata: {
      thompson_alpha: number,
      thompson_beta: number,
      sampled_value: number
    }
  }>,
  metadata: {
    impulse_context_size: number,  // Number of impulses considered
    sampling_method: 'thompson',
    total_candidates: number
  }
}
```

### D2: Impulse Context Passing

**Decision**: Pass current impulse state when resolving goal impulses

**Why**: Activity recommendations should consider what context MiniBob currently has available (files loaded, previous execution traces, etc.)

**Implementation**:
```typescript
// In goal-processor.ts
const currentImpulseIds = getImpulseStore()
  .list()
  .filter(i => i.loaded)
  .map(i => i.id)

const goalImpulse = createImpulse({
  pointer: {
    type: 'goal',
    content: goalDescription,
    impulseRefs: currentImpulseIds  // Pass context!
  }
})
```

### D3: Vessel Discovery Registration

**Decision**: activity-api registers as a vessel that resolves 'goal' shapes

**Vessel manifest:**
```typescript
{
  id: 'activity-api',
  name: 'Activity Recommendation Vessel',
  version: '2.0.0',
  capabilities: [
    {
      impulse_shapes: ['goal', 'activityRecommendation'],
      operations: ['resolve', 'recommend']
    },
    {
      impulse_shapes: ['activityExecutionTrace', 'activityMetrics'],
      operations: ['resolve', 'query']
    }
  ],
  endpoint: process.env.ACTIVITY_API_ENDPOINT
}
```

### D4: Schema Consistency - org_id Typing

**Decision**: Use `TYPE string` for org_id across ALL tables

**Rationale**:
- No true foreign key constraints needed (org managed by identity-vessel)
- Simpler cross-service references
- Avoids RECORD type mismatches
- Consistent with schema-migration.md changes

**Pattern:**
```sql
DEFINE FIELD IF NOT EXISTS org_id ON table_name TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";
```

**Tables to update:**
- activity_template
- activity_execution_traces
- impulse_data
- All tables using `TYPE record<organizations>`

### D5: Backward Compatibility During Transition

**Decision**: Keep MCP method as deprecated fallback for 1 release

**Implementation:**
```typescript
// In mcp.ts
async recommendActivities(...args) {
  console.warn('[DEPRECATED] Use impulse resolution for goal-driven recommendations')

  // Try impulse-driven path first
  try {
    const goalImpulse = createImpulse({
      pointer: { type: 'goal', content: args.taskDescription }
    })
    const resolved = await loadImpulse(goalImpulse.id)
    return JSON.parse(resolved.content).recommendations
  } catch (error) {
    // Fall back to direct API call
    console.warn('[FALLBACK] Using direct API call')
    return this.request('POST', '/v2/activities/recommend', ...)
  }
}
```

### D6: SurrealDB 3.0.5+ Compliance Audit

**Decision**: Audit all schemas for SurrealDB 3.0.5+ patterns

**Checklist:**
- [ ] Use `DEFINE ACCESS ... TYPE RECORD` (not legacy `DEFINE TOKEN`)
- [ ] Use `time::now()` (not `NOW()`)
- [ ] Use `crypto::argon2::compare()` for passwords
- [ ] Use `IF NOT EXISTS` for idempotent migrations
- [ ] Use `OVERWRITE` only when updating PERMISSIONS
- [ ] Use `TYPE datetime` (not `TYPE timestamp`)
- [ ] Use `TYPE option<T>` for nullable fields (not `TYPE T | null`)

## Data Flow

### Goal → Recommendations → Execution

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                 │
└─────────────────────────────────────────────────────────────────┘

User Input:
  "Add user authentication to the dashboard"
     │
     ▼
Goal Impulse Created:
  {
    id: "goal-20260331-abc123",
    pointer: {
      type: "goal",
      content: "Add user authentication to the dashboard",
      category: "feature",
      impulseRefs: [
        "file-src-dashboard-index.tsx",
        "file-package.json",
        "memo-user-story"
      ]
    },
    metadata: {
      shape: "goal",
      priority: "high"
    }
  }
     │
     ▼
Vessel Discovery Query:
  "Who can resolve shape='goal' with impulse context?"
     │
     ▼
Activity-API Responds:
  "I can! I have Thompson Sampling + template/trace data"
     │
     ▼
POST /v2/impulses/resolve:
  {
    pointer: { type: "goal", ... },
    impulseRefs: ["file-...", "memo-..."]
  }
     │
     ▼
Activity-API Processing:
  1. Extract goal description
  2. Load impulse metadata (shapes, summaries)
  3. Call Thompson Sampling with context:
     - task_description: "Add user authentication..."
     - category: "feature"
     - loaded_impulses: ["file-...", "memo-..."]
     - limit: 3
  4. Get recommendations sorted by confidence
     │
     ▼
Response (Impulse Content):
  {
    "recommendations": [
      {
        "template_id": "add-authentication-complete",
        "confidence": 0.87,
        "selection_metadata": {
          "thompson_alpha": 12.5,
          "thompson_beta": 2.3,
          "sampled_value": 0.8654
        }
      },
      {
        "template_id": "oauth-integration",
        "confidence": 0.72,
        "selection_metadata": {...}
      }
    ],
    "metadata": {
      "impulse_context_size": 3,
      "sampling_method": "thompson",
      "total_candidates": 8
    }
  }
     │
     ▼
MiniBob Selects & Executes:
  template_id: "add-authentication-complete"
  variables: { ... }
```

## API Changes

### New Endpoint: POST /v2/impulses/resolve (case 'goal')

**Request:**
```json
{
  "pointer": {
    "type": "goal",
    "content": "Fix the login bug where users can't sign in with Google OAuth",
    "category": "bugfix",
    "impulseRefs": [
      "file-src-auth-oauth.ts",
      "activityExecutionTrace-failed-login-fix"
    ],
    "limit": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "content": "{\"recommendations\":[{\"template_id\":\"...\",\"confidence\":0.85}]}",
  "metadata": {
    "shape": "activityRecommendations",
    "rowCount": 3,
    "summary": "3 activities recommended based on 2 impulses"
  }
}
```

### Updated: MiniBob Goal Processor

**Before:**
```typescript
const recommendations = await mcp.recommendActivities(
  goalDescription,
  category,
  loadedImpulses
)
```

**After:**
```typescript
const goalImpulse = createImpulse({
  id: generateId('goal'),
  pointer: {
    type: 'goal',
    content: goalDescription,
    category: category,
    impulseRefs: loadedImpulses.map(i => i.id)
  },
  metadata: { shape: 'goal', priority: 'high' },
  budget: 4000
})

const resolved = await loadImpulse(goalImpulse.id)
const { recommendations } = JSON.parse(resolved.content)
```

## Testing Strategy

### Unit Tests

1. **Impulse resolver - 'goal' type**
   - Test goal impulse resolution
   - Test with empty impulseRefs
   - Test with various categories
   - Test error handling

2. **Goal processor**
   - Test impulse creation
   - Test recommendation parsing
   - Test fallback to MCP method

3. **Vessel discovery**
   - Test activity-api registration
   - Test capability matching
   - Test routing to correct vessel

### Integration Tests

1. **End-to-end goal → execution**
   - Create goal impulse
   - Verify resolution via vessel discovery
   - Verify recommendations returned
   - Verify activity execution

2. **Schema migration**
   - Fresh database test
   - Verify org_id TYPE string works
   - Verify RBAC still enforced

3. **Backward compatibility**
   - Test MCP fallback still works
   - Test gradual migration path

## Rollout Plan

### Phase 1: Add 'goal' Impulse Resolver (No Breaking Changes)

- Add case 'goal' to activity-api impulse resolver
- Register activity-api in vessel discovery
- Deploy to canary
- Test with manual impulse creation

### Phase 2: Update MiniBob (With Fallback)

- Update goal-processor to use impulse resolution
- Keep MCP method as deprecated fallback
- Deploy to canary
- Monitor for regressions

### Phase 3: Schema Migration (Independent)

- Update org_id fields to TYPE string
- Test on fresh database
- Deploy schema changes
- Verify RBAC still works

### Phase 4: Remove Deprecated Code

- Remove MCP recommendActivities fallback
- Remove direct API call logic
- Update documentation
- Final production deployment

## Documentation Updates

### Files to Update

1. **repos/minibob/CLAUDE.md**
   - Document impulse-driven goal processing
   - Remove references to direct MCP calls

2. **repos/metabob-activity-api/CLAUDE.md**
   - Document 'goal' impulse type
   - Document vessel registration

3. **docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md**
   - Add 'goal' to canonical impulse types
   - Update examples to show goal resolution

4. **SURREALDB_SCHEMA_GUIDE.md** (new)
   - Document SurrealDB 3.0.5+ patterns
   - Document org_id typing convention
   - Document RBAC patterns
