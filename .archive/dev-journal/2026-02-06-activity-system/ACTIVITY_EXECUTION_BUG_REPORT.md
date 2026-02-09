# Activity Execution Bug Report - FINAL

**Date**: February 7, 2026  
**Status**: 🐛 Bug Identified - Correct Solution  
**Severity**: HIGH - Blocks all activity template execution

## The Correct Understanding

The variant selection is **already injected into the session via impulse/lifecycle hook**. metabob-cli doesn't need to maintain state - it just needs to read from the session context.

## How It Should Work

### 1. Turn Lifecycle Hook Injects Recommendations

**File**: `packages/opencode/src/session/turn-lifecycle-hooks.ts`

```typescript
// Hook: activity-recommendation-injection (priority: 15)
await SessionMemory.createImpulse({
  type: "activityRecommendation",
  pointer: {
    type: "activityRecommendation",
    context: promptText.slice(0, 200),
    limit: 5
  },
  budget: 1500
})
```

### 2. Impulse Resolver Fetches Recommendations

**File**: `packages/opencode/src/session/impulse-resolver.ts`

```typescript
async function resolveActivityRecommendation(context: string, limit: number) {
  // Calls MetabobCLI.searchActivities
  // Which calls metabob-cli MCP tool: search_activities
  const activities = await MetabobCLI.searchActivities(context, { limit })
  
  // Formats and returns to session
  return formatted_recommendations
}
```

### 3. Backend Returns Recommendations with variant_ids

```json
{
  "recommendations": [
    {
      "activity_id": "create-activity-template",
      "variant_id": "create-activity-template-b7ccde64",
      "name": "Create Activity Template",
      "score": 0.85,
      ...
    }
  ],
  "impression_id": "imp_abc123"
}
```

### 4. metabob-cli Returns to Agent (Hiding variant_id)

**Current (Wrong)**:
```python
return [{
    "activity_id": r["activity_id"],
    "variant_id": r["variant_id"],  # ← EXPOSED! Wrong!
    ...
}]
```

**Should be**:
```python
return [{
    "id": r["activity_id"],  # ← Just base ID for agent
    "name": r["name"],
    "description": r["description"],
    ...
    # NO variant_id! Agent doesn't need it.
}]
```

### 5. Agent Executes with activity_id

```typescript
activity({
  activityId: "create-activity-template",
  variables: {...},
  reason: "..."
})
```

### 6. metabob-cli Resolves variant_id from Session Context

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

When `get_activity("create-activity-template")` is called:

```python
async def _load_activity_to_cache(self, activity_id: str):
    # NEW: Check session context for recent recommendations
    # The impulse data contains the full recommendations with variant_ids
    
    # Option A: Session passes variant_id in the get_activity call
    # If OpenCode passes: get_activity("create-activity-template-b7ccde64")
    # Then we already have the variant_id!
    
    # Option B: metabob-cli reads from session memory
    # (But this would require passing session_id to MCP tools)
    
    # Option C: OpenCode resolves variant_id before calling get_activity
    # (Most straightforward - OpenCode has the impulse data)
    
    variant_id = activity_id  # If already resolved by OpenCode
    
    response = await client.get(
        f"/activity-recommendations/variants/{variant_id}/details"
    )
```

## The Actual Solution

**OpenCode should resolve the variant_id from the impulse before calling get_activity.**

### In OpenCode's Activity Tool Handler

**File**: `packages/opencode/src/tool/activity.ts` (or wherever activity tool is implemented)

```typescript
async function executeActivity(activityId: string, variables: any, reason: string) {
  // NEW: Resolve activity_id → variant_id from recent impulse
  const variantId = await resolveVariantFromRecommendations(activityId)
  
  if (!variantId) {
    // Fallback: use activity_id directly and let metabob-cli resolve
    log.warn("No variant found in recommendations, using activity_id directly")
    variantId = activityId
  }
  
  // Call metabob-cli with variant_id (not activity_id)
  const template = await MetabobCLI.getActivity(variantId)
  
  // Execute template...
}

async function resolveVariantFromRecommendations(activityId: string): Promise<string | null> {
  // Look up recent activityRecommendation impulse in session
  const recentImpulses = await SessionMemory.getRecentImpulses("activityRecommendation", { limit: 1 })
  
  if (!recentImpulses || recentImpulses.length === 0) {
    return null
  }
  
  // Parse the impulse content to find variant_id for this activity_id
  // The impulse content has the formatted recommendations text
  // But we need the ORIGINAL data from metabob-cli
  
  // BETTER: Store the raw recommendation data in impulse metadata!
  const recommendationData = recentImpulses[0].metadata?.recommendations
  
  if (recommendationData) {
    const match = recommendationData.find(r => r.activity_id === activityId)
    return match?.variant_id || null
  }
  
  return null
}
```

### Fix in metabob-cli: Store Raw Data in Response

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
async def search_activities(self, ...) -> list[dict]:
    recommendations = data.get("recommendations", [])
    
    # Return formatted results with METADATA
    return [
        {
            "id": r.get("activity_id"),  # Agent sees this
            "name": r.get("name"),
            "description": r.get("description"),
            "category": category,
            # ... other display fields ...
            
            # NEW: Include raw data in metadata (not shown to agent in prompt)
            "_meta": {
                "variant_id": r.get("variant_id"),  # Hidden from display
                "impression_id": r.get("impression_id"),
                "score": r.get("score")
            }
        }
        for r in recommendations
    ]
```

### Fix in OpenCode: Store Metadata in Impulse

**File**: `packages/opencode/src/session/impulse-resolver.ts`

```typescript
async function resolveActivityRecommendation(context: string, limit: number) {
  const activities = await MetabobCLI.searchActivities(context, { limit })
  
  // Format for display
  const formatted = formatRecommendationsForAgent(activities)
  
  // NEW: Store raw data in impulse for later lookup
  await SessionMemory.updateImpulseMetadata(impulseId, {
    recommendations: activities.map(a => ({
      activity_id: a.id,
      variant_id: a._meta?.variant_id,
      impression_id: a._meta?.impression_id
    }))
  })
  
  return formatted
}
```

## Summary: The 3-Part Fix

### 1. metabob-cli: Hide variant_id from agent, include in metadata
- Return `id` (not `activity_id`) to agent
- Put `variant_id` in `_meta` field

### 2. OpenCode impulse-resolver: Store metadata
- Save raw recommendation data (with variant_ids) in impulse metadata
- Agent sees formatted text, OpenCode keeps raw data

### 3. OpenCode activity tool: Resolve before calling get_activity
- Look up variant_id from recent impulse metadata
- Call `get_activity(variant_id)` with full variant ID
- metabob-cli receives correct variant_id, fetches successfully

## Why This Is Correct

1. **No state in metabob-cli**: Just a stateless translation layer
2. **Session has the context**: Impulse already contains the data
3. **Agent stays oblivious**: Never sees variant_id or experiment details
4. **Thompson Sampling works**: Backend tracks impressions → conversions
5. **Simple and clean**: Each component does one thing

## Testing

After fix:

```bash
opencode

> Create an activity template for bug fixes
```

**Internal flow**:
```
1. Turn hook: Create activityRecommendation impulse
2. Impulse resolver: Call search_activities
3. metabob-cli: Return id="create-activity-template" + _meta.variant_id
4. OpenCode: Store metadata, show formatted recommendations to agent
5. Agent: activity({ activityId: "create-activity-template" })
6. Activity tool: Look up variant_id from impulse metadata
7. Activity tool: Call getActivity("create-activity-template-b7ccde64")
8. metabob-cli: Fetch with variant_id → SUCCESS ✅
9. Execute template
```

---

**Status**: Correct solution identified  
**Priority**: CRITICAL  
**Next**: Implement 3-part fix

