# Activity Execution Verification

**Date**: February 7, 2026  
**Goal**: Verify activity template can be executed  
**Status**: ✅ Backend Verified, Ready for Execution

## What We Verified

### 1. ✅ Template Registration
- Template `create-activity-template-b7ccde64` is registered
- Status: `active`
- 4 task steps defined
- Ready for recommendations

### 2. ✅ Backend API Available
- Recommendation endpoint: `/activity-recommendations/recommendations`
- Variant details endpoint: `/activity-recommendations/variants/{id}/details`
- Authentication working with internal headers

### 3. ✅ Template Retrievable
```bash
GET /activity-recommendations/variants/create-activity-template-b7ccde64/details
Response: 200 OK
{
  "variant_id": "create-activity-template-b7ccde64",
  "variant_name": "Create Activity Template v4",
  "status": "active",
  "task_steps": [4 steps],
  ...
}
```

## Activity Execution Architecture

### How Activities Work in OpenCode

```
┌─────────────────────────────────────────────────────────────┐
│  User Request                                                │
│  "Create a new activity template for X"                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Activity Mode Agent                                         │
│  - Searches for matching activity template                  │
│  - Uses search_activities tool                              │
│  - Gets recommendations from backend                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Recommendation System                               │
│  - Thompson Sampling selects best variant                   │
│  - Returns variant with execution details                   │
│  - Records impression for CTR tracking                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Activity Executor                                           │
│  - Loads variant from backend                                │
│  - Resolves context requirements → impulses                 │
│  - Executes task graph (topological order)                  │
│  - Each task delegates to subagent                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Task Execution (per task)                                   │
│  1. Load impulse context                                     │
│  2. Build prompt with variables                              │
│  3. Call subagent (general, config, tool, etc.)             │
│  4. Validate output                                          │
│  5. Store result                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Post-Activity Hooks                                         │
│  - Create summary impulse                                    │
│  - Record conversion (success/failure)                       │
│  - Update Thompson Sampling stats                            │
│  - Mark activity complete                                    │
└─────────────────────────────────────────────────────────────┘
```

## Execution Methods

### Method 1: Via Activity Tool (Recommended)
The agent uses the `activity` tool provided by the framework:

```typescript
// Agent calls activity tool
await activity({
  activityId: "create-activity-template",
  variables: {
    templateName: "Bug Fix with Tests",
    templateId: "bug-fix-with-tests",
    category: "bugfix",
    description: "Fix bug with comprehensive tests"
  },
  reason: "User requested new bug fix template"
})
```

**Backend Flow**:
1. Tool queries `/activity-recommendations/recommendations`
2. Gets variant: `create-activity-template-b7ccde64`
3. Loads variant details from backend
4. Executes task graph
5. Records outcome to `/activity-recommendations/conversions`

### Method 2: Via search_activities Tool
The agent searches and selects manually:

```typescript
// Agent searches for templates
const results = await search_activities({
  category: "infrastructure",
  limit: 10
})

// Agent selects best match
const template = results.find(t => t.id.includes("create-activity"))

// Agent uses activity tool with selected template
await activity({
  activityId: template.id,
  variables: {...},
  reason: "..."
})
```

### Method 3: Via OpenCode CLI (Directory-based)
For prompt-based activities:

```bash
# Initialize activity directory
opencode activity init

# Create numbered prompts
.prompts/
  01-analyze.md
  02-design.md
  03-implement.md

# Execute
opencode activity run .prompts
```

## What's Working

✅ **Template Registration**: Template stored in SurrealDB  
✅ **Backend API**: Endpoints responding correctly  
✅ **Authentication**: Internal auth headers working  
✅ **Template Retrieval**: Can fetch variant details  
✅ **Status Active**: Template eligible for recommendations  

## What Needs Testing

⏳ **Full Activity Execution**: End-to-end task execution via tool  
⏳ **Context Resolution**: Impulse creation from contextRequirements  
⏳ **Task Validation**: Output validation per task  
⏳ **Conversion Recording**: Success/failure metrics to backend  
⏳ **Thompson Sampling**: Variant selection optimization  

## Next Steps for Full Execution

### Option A: Interactive Chat
```bash
opencode run "Create a new activity template called 'Feature Complete' for implementing features with tests"
```

The agent will:
1. Use `search_activities` to find `create-activity-template`
2. Use `activity` tool to execute it
3. Agent follows 4-task workflow
4. Results stored and metrics recorded

### Option B: Programmatic Execution
```python
# Via backend API directly
import requests

# 1. Get recommendations
recommendations = requests.post(
    'http://localhost:8080/activity-recommendations/recommendations',
    json={
        "session_id": "test-session",
        "consumer_id": "test-agent",
        "context": {"intent": "create-template"},
        "limit": 5
    },
    headers={'X-Internal-Request': 'true'}
).json()

# 2. Select variant
variant_id = recommendations['recommendations'][0]['variant_id']

# 3. Record selection
requests.post(
    'http://localhost:8080/activity-recommendations/selections',
    json={
        "session_id": "test-session",
        "consumer_id": "test-agent",
        "variant_id": variant_id,
        "impression_id": recommendations['impression_id']
    },
    headers={'X-Internal-Request': 'true'}
)

# 4. Execute (via OpenCode agent)
# ... agent executes tasks ...

# 5. Record conversion
requests.post(
    'http://localhost:8080/activity-recommendations/conversions',
    json={
        "session_id": "test-session",
        "consumer_id": "test-agent",
        "variant_id": variant_id,
        "success": True,
        "execution_time_ms": 180000,
        "quality_score": 0.85
    },
    headers={'X-Internal-Request': 'true'}
)
```

## Key Insights

1. **Activity Tool is Framework-Provided**: Not a CLI command, but a tool available to agents during chat
2. **Backend Tracks Full Funnel**: Impressions → Selections → Conversions
3. **Thompson Sampling**: Backend optimizes variant selection over time
4. **Genealogy Tracking**: Content hashing enables variant evolution tracking
5. **Stateless Execution**: Each execution is independent, metrics aggregated in backend

## Recommendation System Details

### Thompson Sampling Algorithm
- **Prior**: Beta distribution per variant
- **Update**: Bayesian update on success/failure
- **Selection**: Sample from posterior, pick highest
- **Exploration**: Automatic via sampling variance
- **Exploitation**: Converges to best variant over time

### Metrics Tracked
- **Impressions**: How often variant shown
- **Selections**: How often variant chosen
- **Conversions**: How often execution succeeds
- **CTR**: Click-through rate (selections/impressions)
- **Quality**: Average quality score from executions
- **Cost**: Average execution cost
- **Duration**: Average execution time

## Conclusion

✅ **Backend Infrastructure Verified**: Template registration and retrieval working  
✅ **Ready for Execution**: All prerequisites in place  
⏳ **Full E2E Test**: Requires interactive agent session  

The system is ready. The next step is to start an interactive OpenCode session 
and request template creation, which will trigger the full activity execution 
workflow using the registered `create-activity-template`.

---

**Status**: Backend verified ✅ | Execution ready ⏳
