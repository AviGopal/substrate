# Activity Execution Bug Report - CORRECTED

**Date**: February 7, 2026  
**Status**: 🐛 Bug Identified - Flow Corrected  
**Severity**: HIGH - Blocks all activity template execution

## Correct Understanding

The agent should **NOT** know about variant_ids or Thompson Sampling experiments. The correct flow is:

### 1. Search Phase (Agent Perspective)

Agent searches for activities:
```typescript
search_activities({ category: "infrastructure" })
```

metabob-cli returns (hiding variant_id):
```json
{
  "activities": [
    {
      "id": "create-activity-template",  // ← ONLY activity_id
      "name": "Create Activity Template",
      "description": "...",
      "category": "infrastructure"
      // NO variant_id exposed!
    }
  ]
}
```

### 2. Execution Phase (Agent Perspective)

Agent executes with activity_id:
```typescript
activity({
  activityId: "create-activity-template",  // ← Just the base ID
  variables: {...},
  reason: "..."
})
```

### 3. Internal Tracking (metabob-cli)

metabob-cli must:
1. **During search**: Store mapping `activity_id → variant_id` from recommendations
2. **During execution**: Look up stored `variant_id` for this `activity_id`
3. **Fetch details**: Use the tracked `variant_id` to get template
4. **Hide experiment**: Agent never knows about Thompson Sampling

## The Actual Bug

**metabob-cli is NOT tracking the variant_id from search results.**

When agent calls back with `activity_id`, metabob-cli has lost track of which variant to use.

### Current Broken Flow

```
1. search_activities called
   → Backend returns: variant_id="create-activity-template-b7ccde64"
   → metabob-cli returns to agent: id="create-activity-template"  ✅
   → metabob-cli FORGETS variant_id  ❌

2. activity({ activityId: "create-activity-template" }) called
   → metabob-cli receives: activity_id="create-activity-template"
   → metabob-cli tries: GET /variants/create-activity-template/details
   → Backend: 404 NOT FOUND (needs full variant_id with hash)  ❌
```

### Correct Flow (What We Need)

```
1. search_activities called
   → Backend: recommendations with variant_ids
   → metabob-cli stores: {"create-activity-template": "create-activity-template-b7ccde64"}
   → metabob-cli returns to agent: id="create-activity-template"  ✅

2. activity({ activityId: "create-activity-template" }) called
   → metabob-cli receives: activity_id="create-activity-template"
   → metabob-cli looks up stored: variant_id="create-activity-template-b7ccde64"  ✅
   → metabob-cli fetches: GET /variants/create-activity-template-b7ccde64/details  ✅
   → Execute template successfully  ✅
```

## Root Cause

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

### Issue 1: search_activities Doesn't Track Mappings

```python
async def search_activities(self, ...) -> list[dict]:
    # Gets recommendations with variant_ids
    recommendations = data.get("recommendations", [])
    
    # Returns summaries to agent
    return [
        {
            "activity_id": r.get("activity_id"),
            "variant_id": r.get("variant_id"),  # ← EXPOSED TO AGENT! Wrong!
            ...
        }
        for r in recommendations
    ]
    
    # ❌ Does NOT store variant_id mapping internally
```

Should be:
```python
async def search_activities(self, ...) -> list[dict]:
    recommendations = data.get("recommendations", [])
    
    # Store mappings for later execution
    for r in recommendations:
        activity_id = r.get("activity_id")
        variant_id = r.get("variant_id")
        self._recommended_variants[activity_id] = variant_id  # Track it!
    
    # Return ONLY activity_id to agent (hide experiment)
    return [
        {
            "id": r.get("activity_id"),  # ← Use 'id', not 'activity_id'
            "name": r.get("name"),
            "description": r.get("description"),
            # NO variant_id! Agent doesn't need to know.
        }
        for r in recommendations
    ]
```

### Issue 2: get_activity Doesn't Use Tracked Mapping

```python
async def _load_activity_to_cache(self, activity_id: str):
    # ❌ Directly uses activity_id as variant_id
    response = await client.get(
        f"/activity-recommendations/variants/{activity_id}/details"
    )
```

Should be:
```python
async def _load_activity_to_cache(self, activity_id: str):
    # Look up tracked variant_id
    variant_id = self._recommended_variants.get(activity_id)
    
    if not variant_id:
        # Not found in tracking - need to resolve
        # This is a fallback for direct execution without prior search
        variant_id = await self._resolve_activity_to_variant(activity_id)
    
    if not variant_id:
        logger.error(f"No variant found for activity: {activity_id}")
        return None
    
    # Fetch using tracked variant_id
    response = await client.get(
        f"/activity-recommendations/variants/{variant_id}/details"
    )
```

## The Fix

**Add variant tracking to ActivityManager:**

```python
class ActivityManager:
    def __init__(self, base_url: str, session_token: str = ""):
        self.base_url = base_url
        self.session_token = session_token
        self._activity_cache: dict[str, dict] = {}
        self._recommended_variants: dict[str, str] = {}  # NEW: Track variant selections
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def search_activities(self, ...) -> list[dict]:
        # ... get recommendations ...
        
        # Store variant mappings (hide from agent)
        for r in recommendations:
            activity_id = r.get("activity_id")
            variant_id = r.get("variant_id")
            impression_id = data.get("impression_id")
            
            # Track which variant was recommended for this activity
            self._recommended_variants[activity_id] = {
                "variant_id": variant_id,
                "impression_id": impression_id,
                "timestamp": time.time()
            }
            
            logger.debug(f"Tracked recommendation: {activity_id} → {variant_id}")
        
        # Return activity summaries (NO variant_id exposed)
        return [
            {
                "id": r.get("activity_id"),  # Just the base ID
                "name": r.get("name"),
                "description": r.get("description"),
                "category": r.get("category"),
                "success_rate": r.get("predicted_conversion", 0),
                # ... other metadata, but NO variant_id
            }
            for r in recommendations
        ]
    
    async def _load_activity_to_cache(self, activity_id: str):
        # Check if we have a tracked variant
        tracked = self._recommended_variants.get(activity_id)
        
        if tracked:
            variant_id = tracked["variant_id"]
            logger.info(f"Using tracked variant: {activity_id} → {variant_id}")
        else:
            # Fallback: resolve activity_id to best variant
            logger.warning(f"No tracked variant for {activity_id}, resolving...")
            variant_id = await self._resolve_activity_to_variant(activity_id)
            
            if not variant_id:
                logger.error(f"Could not resolve activity: {activity_id}")
                return None
        
        # Fetch using variant_id
        response = await client.get(
            f"/activity-recommendations/variants/{variant_id}/details"
        )
        
        # ... transform and cache ...
    
    async def _resolve_activity_to_variant(self, activity_id: str) -> Optional[str]:
        """Fallback: resolve activity_id to best variant without prior search"""
        try:
            # Search with this specific activity as intent
            results = await self.search_activities(
                query=f"execute {activity_id}",
                limit=5
            )
            
            # Find matching activity
            for result in results:
                if result.get("id") == activity_id:
                    # The search already tracked it, retrieve
                    tracked = self._recommended_variants.get(activity_id)
                    return tracked["variant_id"] if tracked else None
            
            logger.error(f"Activity not found in search results: {activity_id}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to resolve activity {activity_id}: {e}")
            return None
```

## Why This Design is Correct

### 1. Agent Doesn't Know About Experiments
- Agent sees only `activity_id`
- Thompson Sampling happens in backend
- metabob-cli hides implementation details

### 2. Proper Experiment Tracking
- Backend tracks impressions (what was shown)
- metabob-cli tracks selections (what was chosen)
- Backend tracks conversions (what succeeded)

### 3. Clean Separation
- **Backend**: Thompson Sampling, variant selection
- **metabob-cli**: Translation layer, tracks selections
- **OpenCode/Agent**: Simple activity execution, no experiment knowledge

### 4. Exception: Template Management Activities
For activities like `create-activity-template` that manipulate the activity system itself, more details can be exposed, but only in context.

## Testing the Fix

After implementing:

```bash
# Test the correct flow
opencode

> Create an activity template for bug fixes
```

**Expected internal flow**:
```
1. Agent: search_activities({ query: "create template" })
2. metabob-cli → Backend: POST /recommendations
3. Backend: Returns variant_id="create-activity-template-b7ccde64"
4. metabob-cli: Stores mapping, returns id="create-activity-template"
5. Agent: activity({ activityId: "create-activity-template" })
6. metabob-cli: Looks up → variant_id="create-activity-template-b7ccde64"
7. metabob-cli: GET /variants/create-activity-template-b7ccde64/details ✅
8. Executes successfully
9. Backend: Records conversion for Thompson Sampling
```

## Config Fix

metabob should NOT be in mcp section:

```json
{
  "metabob": {
    "base_url": "http://localhost:8080",
    "api_key": ""
  },
  "mcp": {
    "playwright": { ... }
  }
}
```

Metabob is a **core component**, not an optional MCP server.

---

**Status**: Bug identified correctly, fix designed  
**Next**: Implement tracking in metabob-cli activity_manager.py  
**Priority**: CRITICAL

