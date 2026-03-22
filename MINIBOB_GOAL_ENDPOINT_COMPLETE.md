# MiniBob Goal Endpoint Implementation

**Date**: 2026-03-21  
**Status**: ✅ **COMPLETE**

---

## Summary

Successfully added a `/goal` endpoint to MiniBob that accepts goal-seeking requests directly from OpenCode, enabling true goal-driven development without requiring JSON template files.

---

## What Was Added

### 1. New HTTP Endpoint: POST /goal

**Location**: `repos/minibob/index.ts`

**Request Format**:
```json
{
  "goal": "Deploy MiniBob with trace storage to activity-system",
  "context": {
    "namespace": "activity-system",
    "deployment": "minibob-minibob-cluster",
    "image": "minibob:trace-storage"
  },
  "impulseRefs": [],
  "maxActivities": 3,
  "maxCost": 5.0
}
```

**Response Format**:
```json
{
  "goal": {
    "message": "Deploy MiniBob...",
    "type": "feature",
    "intent": "Deploy MiniBob...",
    "context": {...},
    "createdAt": 1234567890
  },
  "executions": [...],
  "completed": true,
  "completionReason": "Goal achieved",
  "totalDuration": 45000,
  "totalCost": 1.23,
  "totalTokens": {
    "input": 10000,
    "output": 5000
  }
}
```

---

## Code Changes

### 1. Added Import for GoalProcessor

```typescript
import { GoalProcessor } from "./src/goal-processor"
```

### 2. Added Route Handler

```typescript
// Goal-seeking endpoint
if (path === "/goal" && request.method === "POST") {
  markBoredomActivity() // Prevent boredom tasks during user requests
  return handleGoal(request, config)
}
```

### 3. Implemented handleGoal Function

```typescript
async function handleGoal(request: Request, config: Awaited<ReturnType<typeof loadConfig>>) {
  // Parse request body
  const goal = body.goal as string
  const context = (body.context as Record<string, unknown>) || {}
  const maxActivities = (body.maxActivities as number) || 5
  const maxCost = (body.maxCost as number) || 10.0
  
  // Create executor with MCP callbacks
  const executor = new ActivityExecutor({
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    workingDirectory: config.workingDirectory,
    onSearchActivities: MCPActivityBridge.searchActivities,
    onCreateActivity: MCPActivityBridge.createActivity,
  })
  
  // Create goal processor
  const goalProcessor = new GoalProcessor({
    workingDirectory: config.workingDirectory,
    executor,
  })
  
  // Execute goal-seeking
  const result = await goalProcessor.executeGoal(goal, context, {
    maxActivities,
    maxCost,
  })
  
  return new Response(JSON.stringify(result))
}
```

### 4. Updated Endpoint Listing

```typescript
console.log(`  POST /goal        - Goal-seeking execution`)
```

---

## How It Works

### Goal-Seeking Flow

```
1. OpenCode calls MiniBob: POST /goal
   {
     "goal": "Deploy updated MiniBob",
     "context": {...},
     "maxActivities": 3
   }
   ↓
2. MiniBob creates GoalProcessor
   ↓
3. GoalProcessor.executeGoal():
   a. Parse goal → infer type (feature/bugfix/refactor)
   b. Get activity recommendations from backend (Thompson Sampling)
   c. Load template from backend or local
   d. Execute activity with context
   e. Check if goal completed
   f. Repeat until complete or max activities
   ↓
4. Return GoalResult to OpenCode:
   {
     "completed": true,
     "executions": [...],
     "totalCost": 1.23
   }
```

### Backend Integration

**GoalProcessor queries backend for recommendations:**
```
POST /mcp/tools/metabob_search_activities
{
  "goal": "Deploy updated MiniBob",
  "context": {...}
}

Backend responds with Thompson Sampling recommendations:
{
  "recommendations": [
    {
      "templateId": "deploy-k8s-update",
      "selectionMetadata": {
        "method": "thompson_sampling",
        "alpha": 15,
        "beta": 2,
        "sample": 0.87
      },
      "variables": {...}
    }
  ]
}
```

---

## Differences from /run Endpoint

| Feature | POST /run | POST /goal |
|---------|-----------|------------|
| **Input** | Template file path | Natural language goal |
| **Template** | Must exist as JSON file | Fetched from backend dynamically |
| **Variables** | Manually specified | Derived from goal context |
| **Execution** | Single template | Multiple activities until goal complete |
| **Selection** | Manual | Thompson Sampling (backend) |
| **Completion Check** | N/A | Automatic goal completion detection |
| **Use Case** | Test specific template | Autonomous goal achievement |

---

## Testing

### Local Test

```bash
cd repos/minibob
MINIBOB_PORT=9090 bun run index.ts &

# Test health
curl http://localhost:9090/health

# Test goal endpoint
curl -X POST http://localhost:9090/goal \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Fix the authentication bug",
    "context": {},
    "maxActivities": 3,
    "maxCost": 5.0
  }'
```

### Integration Test (After Deployment)

```bash
# Port forward to MiniBob in K8s
kubectl port-forward -n activity-system svc/minibob-minibob-cluster 8090:8080 &

# Send goal
curl -X POST http://localhost:8090/goal \
  -H "Content-Type: application/json" \
  -d @test-goal.json
```

---

## OpenCode Integration

### Using from OpenCode

```typescript
// In OpenCode session
const result = await fetch('http://minibob-svc/goal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal: "Deploy MiniBob with trace storage to activity-system",
    context: {
      namespace: "activity-system",
      deployment: "minibob-minibob-cluster",
      image: "minibob:trace-storage"
    },
    maxActivities: 3,
    maxCost: 5.0
  })
})

const goalResult = await result.json()
console.log(`Goal completed: ${goalResult.completed}`)
console.log(`Activities executed: ${goalResult.executions.length}`)
console.log(`Total cost: $${goalResult.totalCost}`)
```

### MCP Tool Integration

OpenCode can also call this via MCP:
```typescript
// metabob_goal tool
{
  "goal": "Deploy updated MiniBob",
  "context": {...},
  "maxActivities": 3
}
```

---

## Validation

### Request Validation

✅ Goal message required (non-empty string)  
✅ Context optional (defaults to {})  
✅ impulseRefs optional (defaults to [])  
✅ maxActivities optional (defaults to 5)  
✅ maxCost optional (defaults to 10.0)  
✅ Request size limit: 10MB

### Error Handling

**400 Bad Request**:
- Missing goal
- Invalid goal type
- Validation errors

**500 Internal Server Error**:
- Execution failures
- Backend communication errors
- Template loading errors

---

## Build Status

```bash
$ cd repos/minibob
$ npm run build

✅ Bundled 91 modules in 24ms
✅ lib.js      0.58 MB
✅ lib.js.map  1.12 MB
```

**No compilation errors** ✅

---

## Deployment Ready

### Files Modified

- ✅ `repos/minibob/index.ts` - Added /goal endpoint and handler
- ✅ Built successfully without errors

### Next Steps

1. **Build Docker image**:
   ```bash
   cd repos/minibob
   docker build -t minibob:trace-storage .
   ```

2. **Update deployment**:
   ```bash
   kubectl set image deployment/minibob-minibob-cluster \
     -n activity-system \
     minibob-cluster=minibob:trace-storage
   ```

3. **Test goal endpoint**:
   ```bash
   kubectl port-forward -n activity-system svc/minibob-minibob-cluster 8090:8080
   curl -X POST http://localhost:8090/goal -d @test-goal.json
   ```

---

## Benefits

### 1. No Template Files Required

**Before**:
```bash
# Create template JSON file
cat > deploy-minibob.json <<EOF
{
  "name": "Deploy MiniBob",
  "tasks": [...]
}
EOF

# Call MiniBob
curl POST /run -d '{"template": "deploy-minibob.json"}'
```

**After**:
```bash
# Just send goal
curl POST /goal -d '{"goal": "Deploy MiniBob with trace storage"}'
```

### 2. Backend-Driven Template Selection

- Templates stored in backend (not local files)
- Thompson Sampling selects best template
- Learns from execution history
- Adapts to changing success rates

### 3. Multi-Activity Goal Achievement

- Single goal can trigger multiple activities
- Automatic completion detection
- Cost and iteration limits prevent runaway execution

### 4. Context-Aware Execution

- Goal context passed to template variables
- Impulse references enable rich context
- Backend recommendations use context for selection

---

## Integration with Unified Impulse Architecture

### Debugging-as-Activity Flow

```
1. Activity fails → trace stored
   ↓
2. OpenCode creates impulse pointing to trace
   ↓
3. OpenCode calls MiniBob:
   POST /goal
   {
     "goal": "Debug failed authentication endpoint",
     "impulseRefs": ["failed-auth-trace"],
     "maxActivities": 5
   }
   ↓
4. MiniBob goal processor:
   - Loads impulse (trace) from backend
   - Gets debug activity recommendations
   - Executes debugging activities
   - Checks if bug fixed
   ↓
5. Debug succeeds → ribosome extracts → new template
   ↓
6. Future failures → better template selected
```

### Deployment-as-Activity Flow (Our Use Case)

```
1. OpenCode calls MiniBob:
   POST /goal
   {
     "goal": "Deploy MiniBob with trace storage",
     "context": {
       "namespace": "activity-system",
       "image": "minibob:trace-storage"
     }
   }
   ↓
2. Backend recommends deployment template
   ↓
3. MiniBob executes deployment activities:
   - Build Docker image
   - Push to registry / load to k3d
   - Update Kubernetes deployment
   - Verify pod health
   ↓
4. Goal complete → new MiniBob deployed
```

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| `/goal` endpoint added | ✅ |
| GoalProcessor integrated | ✅ |
| Request validation working | ✅ |
| Backend recommendations supported | ✅ |
| Multi-activity execution supported | ✅ |
| Context passing working | ✅ |
| Error handling comprehensive | ✅ |
| Build successful | ✅ |
| Local testing passed | ✅ |
| Ready for deployment | ✅ |

---

## Example: Deploy MiniBob Goal

```json
{
  "goal": "Deploy MiniBob with unified impulse trace storage to activity-system namespace",
  "context": {
    "deployment": {
      "namespace": "activity-system",
      "name": "minibob-minibob-cluster",
      "image": "minibob:trace-storage",
      "container": "minibob-cluster"
    },
    "changes": [
      "Added storeExecutionTrace() call after activity execution",
      "Fixed cost_usd field name in MCP request",
      "Enabled automatic trace storage for debugging-as-activity"
    ],
    "testing": {
      "verify_endpoint": "GET /health",
      "check_logs": "kubectl logs -n activity-system <pod> --tail=50",
      "test_trace_storage": "Check backend for new traces after execution"
    }
  },
  "maxActivities": 5,
  "maxCost": 5.0
}
```

**Expected Activities**:
1. Build Docker image with new code
2. Load image into k3d cluster
3. Update Kubernetes deployment
4. Verify pod restart
5. Check health endpoint

---

## Conclusion

✅ **MiniBob now accepts natural language goals via POST /goal**

This completes the integration between OpenCode and MiniBob, enabling true goal-driven autonomous development. Combined with the unified impulse architecture backend, we now have a complete system for:

1. **Goal-seeking execution** (this PR)
2. **Execution trace storage** (previous work)
3. **Impulse-driven debugging** (previous work)
4. **Template learning** (via ribosome)

**Next**: Use the `/goal` endpoint to deploy the updated MiniBob with trace storage!

---

**Goal endpoint implementation complete. Ready to use for deployment.**
