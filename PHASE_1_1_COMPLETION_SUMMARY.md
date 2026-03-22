# Phase 1.1 Completion Summary: Activity Composition Graph

**Date:** March 20, 2026  
**Status:** ✅ COMPLETED

## What Was Implemented

### 1. Database Schema (repos/metabob-activity-api/src/models/schemas.ts)

Added complete Zod schemas for activity composition graph tracking:

```typescript
// Activity Composition Graph schemas
CompositionEdgeSchema - Complete edge data structure
CompositionRecordRequestSchema - Request validation for recording compositions
CompositionGraphQuerySchema - Query parameter validation
CompositionGraphResponseSchema - Response format

// Fields:
- parent_activity_id: The calling activity
- child_activity_id: The called activity  
- execution_id: Reference to specific execution
- goal_context: What goal triggered this composition
- success: Did the composition succeed
- execution_count: How many times this edge has been seen
- success_count: How many times it succeeded
- weight: Learned probability (success_count / execution_count)
- created_at, updated_at: Timestamps
```

### 2. API Endpoint: POST /v2/activities/composition

**Purpose:** Record when one activity calls another activity

**Logic:**
1. Validate request with `CompositionRecordRequestSchema`
2. Check if edge (parent → child) exists in database
3. **If exists:** 
   - Increment `execution_count`
   - Update `success_count` (if successful)
   - Recalculate `weight = success_count / execution_count`
   - Update timestamps
4. **If new:**
   - Create edge with `execution_count = 1`
   - Set `success_count` based on success
   - Set `weight` based on initial success
5. Return updated edge data

**Learning Formula:**
```
weight = success_count / execution_count
```

This represents `P(success | parent calls child)` - the learned probability that when parent activity calls child activity, the combination will succeed.

### 3. API Endpoint: GET /v2/activities/composition/graph

**Purpose:** Query activity composition patterns

**Query Parameters:**
- `activity_id` (optional): Filter edges where activity is parent OR child
- `min_weight` (optional): Filter edges with weight >= min_weight
- `limit` (default: 100): Max results
- `offset` (default: 0): Pagination offset

**Response:**
```json
{
  "edges": [
    {
      "parent_activity_id": "add-feature-complete",
      "child_activity_id": "add-comprehensive-tests",
      "execution_count": 15,
      "success_count": 14,
      "weight": 0.93,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 42
}
```

**Features:**
- Results sorted by weight (strongest compositions first)
- Efficient filtering with SurrealDB indexes
- Supports pagination for large graphs

---

## How It Works

### Recording Composition Events

When minibob executes an activity that calls another activity via the `activity` tool:

```
Activity A executes
  ↓
Calls tool: activity({ templateId: "B", ... })
  ↓
Activity B executes
  ↓
B completes (success/failure)
  ↓
POST /v2/activities/composition
{
  parent_activity_id: "A",
  child_activity_id: "B",
  execution_id: "exec_123",
  goal_context: "add authentication feature",
  success: true
}
  ↓
Backend updates graph:
  execution_count: 10 → 11
  success_count: 9 → 10  
  weight: 0.9 → 0.909
```

### Querying Composition Patterns

**Example 1: Find what an activity typically calls**
```
GET /v2/activities/composition/graph?activity_id=add-feature-complete

Returns:
- add-feature-complete → add-comprehensive-tests (weight: 0.93)
- add-feature-complete → commit-organized-changes (weight: 0.87)
- add-feature-complete → fix-lint-errors (weight: 0.45)
```

**Example 2: Find strong composition patterns**
```
GET /v2/activities/composition/graph?min_weight=0.8

Returns only edges with ≥80% success rate
```

---

## Integration Points

### Next Step: Phase 1.2 - Track Composition in Minibob

To close the learning loop, minibob needs to:

1. **Detect nested activity calls**
   - In `src/tools.ts`, when `activity` tool is invoked
   - Capture: parent_activity_id, child_activity_id, execution_id

2. **Report to backend**
   - After child activity completes
   - POST to `/v2/activities/composition`
   - Include: goal_context (from GoalProcessor), success (from activity result)

3. **Use learned patterns**
   - Query `/v2/activities/composition/graph?activity_id=X`
   - Suggest likely next activities
   - Pre-load templates for high-weight compositions

---

## Database Table (SurrealDB)

**Table:** `activity_composition_graph`

**Indexes:**
- `parent_activity_id` (for "what does X call?")
- `child_activity_id` (for "what calls X?")
- `(parent_activity_id, child_activity_id)` composite (for edge lookups)

**Sample Data:**
```
{
  "parent_activity_id": "add-feature-complete",
  "child_activity_id": "add-comprehensive-tests",
  "execution_id": "exec_1774046929_abc",
  "goal_context": "Add user authentication",
  "success": true,
  "execution_count": 15,
  "success_count": 14,
  "weight": 0.9333,
  "created_at": "2026-03-20T10:30:00Z",
  "updated_at": "2026-03-20T14:45:00Z"
}
```

---

## Testing Strategy

Once Phase 1.2 is complete (minibob tracking), test with:

1. **Create test scenario:**
   ```bash
   # Execute activity that calls another activity
   cd repos/minibob
   bun run index.ts run templates/test-nested-activities.json
   ```

2. **Verify edge creation:**
   ```bash
   curl http://localhost:8081/v2/activities/composition/graph | jq
   ```

3. **Run multiple times:**
   ```bash
   # Execute same nested flow 10 times
   for i in {1..10}; do
     bun run index.ts run templates/test-nested-activities.json
   done
   ```

4. **Check weight learning:**
   ```bash
   curl "http://localhost:8081/v2/activities/composition/graph?activity_id=test-parent" | jq '.edges[] | {parent, child, weight}'
   ```

Expected: weight should approach actual success rate as execution_count increases.

---

## Benefits of This Implementation

### 1. **Composition Discovery**
Learn which activities naturally work together based on historical data.

### 2. **Predictive Execution**
When activity A runs, pre-load likely children (high weight edges) for faster execution.

### 3. **Quality Improvement**
Identify weak compositions (low weight) → candidates for variant creation or debugging.

### 4. **Graph Visualization**
Can build visual graphs showing activity relationships and strengths.

### 5. **Path Planning Foundation**
Composition graph is foundation for Phase 2 multi-step path planning:
- Traverse graph to find optimal sequences
- Use edge weights for path probability
- Thompson Sample on paths instead of individual activities

---

## Files Modified

1. **repos/metabob-activity-api/src/models/schemas.ts**
   - Added `CompositionEdgeSchema`
   - Added `CompositionRecordRequestSchema`
   - Added `CompositionGraphQuerySchema`
   - Added `CompositionGraphResponseSchema`
   - Added type exports

2. **repos/metabob-activity-api/src/routes/activities.ts**
   - Added imports for composition schemas
   - Added `POST /composition` endpoint (lines ~1025-1160)
   - Added `GET /composition/graph` endpoint (lines ~1162-1250)

---

## Next Steps (Phase 1.2)

Files to modify for minibob composition tracking:

1. **repos/minibob/src/activity.ts**
   - Track parent activity ID in execution context
   - Pass to tool calls

2. **repos/minibob/src/tools.ts**
   - In `activity` tool handler:
     - Capture parent/child IDs
     - After child completes, call composition endpoint
     - Handle errors gracefully

3. **repos/minibob/src/mcp.ts**
   - Add `recordComposition(parent, child, execution, goal, success)` method
   - POST to `/v2/activities/composition`

---

## Success Criteria

✅ Schema defined and validated  
✅ POST endpoint handles edge creation and updates  
✅ POST endpoint calculates weight correctly  
✅ GET endpoint supports filtering and pagination  
✅ GET endpoint returns edges sorted by weight  
✅ Code includes proper error handling  
✅ Code includes logging  
✅ Ready for integration with minibob

**Status:** Phase 1.1 is complete and ready for Phase 1.2 integration.

---

## Sample Usage

### Recording a composition:
```bash
curl -X POST http://localhost:8081/v2/activities/composition \
  -H "Content-Type: application/json" \
  -d '{
    "parent_activity_id": "add-feature-complete",
    "child_activity_id": "add-comprehensive-tests",
    "execution_id": "exec_123",
    "goal_context": "Add user authentication",
    "success": true
  }'
```

### Querying compositions:
```bash
# All compositions
curl http://localhost:8081/v2/activities/composition/graph

# For specific activity
curl "http://localhost:8081/v2/activities/composition/graph?activity_id=add-feature-complete"

# Strong compositions only
curl "http://localhost:8081/v2/activities/composition/graph?min_weight=0.8"
```

---

## Conclusion

Phase 1.1 provides the backend infrastructure for learning activity composition patterns. Once Phase 1.2 integrates this with minibob's execution engine, the system will begin automatically learning which activities work well together, enabling:

- Smarter activity recommendations
- Predictive pre-loading
- Quality-based variant selection
- Foundation for multi-step path planning

This is the first critical piece of transforming minibob from a template executor into a self-learning execution engine.
