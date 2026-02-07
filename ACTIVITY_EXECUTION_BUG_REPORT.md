# Activity Execution Bug Report

**Date**: February 7, 2026  
**Status**: 🐛 Bug Identified  
**Severity**: HIGH - Blocks all activity template execution

## Problem Statement

When an agent tries to execute an activity template via the `activity` tool:
```typescript
activity({
  activityId: "create-activity-template",
  variables: {...},
  reason: "..."
})
```

The execution **fails with 404** because the system cannot find the template.

## Root Cause Analysis

### Data Flow Trace

1. **Agent calls activity tool**:
   - Input: `activityId = "create-activity-template"`
   - Tool: `packages/opencode/src/tool/activity.ts`

2. **OpenCode calls MetabobCLI.getActivity()**:
   - File: `packages/opencode/src/util/metabob.ts:863`
   - Calls MCP tool: `get_activity` with `activity_id: "create-activity-template"`

3. **metabob-cli MCP receives request**:
   - File: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
   - Tool: `get_activity_tool(activity_id: str)`
   - Calls: `activity_manager.get_activity(activity_id)`

4. **activity_manager loads from cache**:
   - File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:_load_activity_to_cache`
   - **Line 873**: Makes HTTP request:
     ```python
     response = await client.get(
         f"/activity-recommendations/variants/{activity_id}/details"
     )
     ```
   - Actual request: `GET /activity-recommendations/variants/create-activity-template/details`

5. **Backend returns 404**:
   - Endpoint exists: `/activity-recommendations/variants/{variant_id}/details`
   - But `variant_id` must include content hash suffix!
   - Actual IDs in database:
     - ✅ `create-activity-template-b7ccde64`
     - ✅ `create-activity-template-f20bafb3`
     - ❌ `create-activity-template` (doesn't exist)

### The Bug

**The system confuses `activity_id` with `variant_id`:**

- **activity_id**: Base identifier (e.g., `"create-activity-template"`)
  - Multiple variants can share the same activity_id
  - Used for searching and grouping

- **variant_id**: Unique identifier with content hash (e.g., `"create-activity-template-b7ccde64"`)
  - One variant = one unique variant_id
  - Required for fetching template details from backend

**metabob-cli tries to use `activity_id` as `variant_id`**, causing 404.

## Evidence from Logs

Backend logs show 404 errors:
```
INFO: 172.20.0.1:60004 - "GET /activity-recommendations/variants/manage-session-memory/details HTTP/1.1" 404 Not Found
INFO: 172.20.0.1:55118 - "GET /activity-recommendations/variants/create-activity-template/details HTTP/1.1" 404 Not Found
INFO: 172.20.0.1:60808 - "GET /activity-recommendations/variants/manage-session-memory/details HTTP/1.1" 404 Not Found
```

Requests are using base `activity_id` instead of full `variant_id` with hash.

## Why This Wasn't Caught Earlier

1. **Templates were manually registered with API**: Used full variant_id directly
2. **Search works correctly**: `/activity-recommendations/recommendations` returns full variant_ids
3. **Direct backend calls work**: When variant_id is known, lookups succeed
4. **Agent tool execution was never tested**: This is the first attempt to execute via activity tool

## The Correct Flow

### What SHOULD Happen

```
1. Agent: activity({ activityId: "create-activity-template", ... })
   ↓
2. OpenCode: Need to execute "create-activity-template"
   ↓
3. Resolution Phase:
   a. Call search_activities or recommendations endpoint
   b. Get variants: ["create-activity-template-b7ccde64", "create-activity-template-f20bafb3"]
   c. Thompson Sampling selects best: "create-activity-template-b7ccde64"
   ↓
4. Fetch Phase:
   GET /activity-recommendations/variants/create-activity-template-b7ccde64/details
   ✅ SUCCESS
   ↓
5. Execute template with 4 tasks
```

### What ACTUALLY Happens (Current Bug)

```
1. Agent: activity({ activityId: "create-activity-template", ... })
   ↓
2. OpenCode: Need to execute "create-activity-template"
   ↓
3. SKIP Resolution Phase ❌
   ↓
4. Fetch Phase (Wrong!):
   GET /activity-recommendations/variants/create-activity-template/details
   ❌ 404 NOT FOUND
   ↓
5. Execution fails
```

## The Fix

### Option A: Resolve activity_id → variant_id in metabob-cli

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Change `_load_activity_to_cache` to resolve activity_id first**:

```python
async def _load_activity_to_cache(self, activity_id: str) -> Optional[dict]:
    """Load full activity template into internal cache."""
    
    # Check cache first
    if activity_id in self._activity_cache:
        return self._activity_cache[activity_id]
    
    try:
        client = await self._get_client()
        
        # NEW: Check if activity_id is actually a variant_id (has hash suffix)
        # If it doesn't match variant_id format, resolve it first
        if not re.match(r'.+-[a-f0-9]{8,}$', activity_id):
            # activity_id provided, need to resolve to best variant_id
            recommendations = await self.search_activities(
                query="",
                category=None,
                limit=10
            )
            
            # Find variants matching this activity_id
            matching = [
                r for r in recommendations 
                if r.get('activity_id') == activity_id
            ]
            
            if not matching:
                logger.error(f"No variants found for activity: {activity_id}")
                return None
            
            # Use highest-scored variant (Thompson Sampling result)
            variant_id = matching[0]['id']  # Already sorted by score
            logger.info(f"Resolved {activity_id} → {variant_id}")
        else:
            # Already a variant_id
            variant_id = activity_id
        
        # Get variant details from backend
        response = await client.get(
            f"/activity-recommendations/variants/{variant_id}/details"
        )
        
        if response.status_code == 200:
            variant = response.json()
            # ... rest of transformation ...
            
            # Cache with BOTH activity_id and variant_id as keys
            self._activity_cache[activity_id] = activity
            self._activity_cache[variant_id] = activity
            
            return activity
        else:
            logger.error(f"Failed to load variant {variant_id}: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"_load_activity_to_cache failed: {e}")
        return None
```

### Option B: Backend provides activity_id → variant_id resolution endpoint

**New endpoint**: `GET /activity-recommendations/activities/{activity_id}/best-variant`

Returns the best variant for an activity_id using Thompson Sampling:

```python
@router.get("/activities/{activity_id}/best-variant")
async def get_best_variant(
    activity_id: str,
    session: SessionData = Depends(get_current_session_or_internal),
):
    """Get best variant for an activity using Thompson Sampling"""
    
    # Get all variants for this activity
    variants = await get_variants_by_activity_id(activity_id)
    
    if not variants:
        raise HTTPException(status_code=404, detail=f"No variants found for activity: {activity_id}")
    
    # Use Thompson Sampling to select best
    best_variant = await thompson_sampling_select(variants, session.consumer_id)
    
    return {
        "activity_id": activity_id,
        "variant_id": best_variant.variant_id,
        "score": best_variant.score,
        "metrics": best_variant.metrics
    }
```

Then metabob-cli calls this endpoint first:
```python
# Resolve activity_id → variant_id
response = await client.get(f"/activity-recommendations/activities/{activity_id}/best-variant")
variant_id = response.json()["variant_id"]

# Then fetch details
response = await client.get(f"/activity-recommendations/variants/{variant_id}/details")
```

### Option C: Allow backend to accept activity_id and auto-resolve

**Modify existing endpoint**: `GET /activity-recommendations/variants/{id}/details`

Make it accept BOTH `variant_id` and `activity_id`:

```python
@router.get("/variants/{id}/details")
async def get_variant_details(
    id: str,  # Can be variant_id OR activity_id
    session: SessionData = Depends(get_current_session_or_internal),
):
    """Get variant details (auto-resolves activity_id to best variant)"""
    
    # Try as variant_id first
    variant = await get_variant_by_id(id)
    
    if not variant:
        # Maybe it's an activity_id - resolve to best variant
        variants = await get_variants_by_activity_id(id)
        if variants:
            variant = await thompson_sampling_select(variants, session.consumer_id)
    
    if not variant:
        raise HTTPException(status_code=404, detail=f"Variant or activity not found: {id}")
    
    return variant
```

## Recommended Fix

**Option A** (Resolution in metabob-cli) is recommended because:

1. ✅ No backend changes required
2. ✅ Keeps Thompson Sampling logic where it belongs (backend)
3. ✅ metabob-cli already has search_activities method
4. ✅ Simple regex check to detect activity_id vs variant_id
5. ✅ Can cache results to avoid repeated lookups

## Testing the Fix

After implementing, test with:

```bash
# Start OpenCode session
opencode

# In chat:
> Create an activity template called "Feature Complete" for implementing 
> features with design, code, tests, and documentation
```

**Expected**:
1. Agent recognizes pattern → use `create-activity-template`
2. Agent calls: `activity({ activityId: "create-activity-template", ... })`
3. metabob-cli resolves: `"create-activity-template"` → `"create-activity-template-b7ccde64"`
4. Fetches variant details: GET `/variants/create-activity-template-b7ccde64/details` ✅
5. Executes 4 tasks successfully
6. New template registered in SurrealDB
7. Agent can then use new template

## Impact

**Before Fix**: ❌ ALL activity executions fail with 404  
**After Fix**: ✅ Activity tool works correctly, templates execute

**Blocks**:
- End-to-end activity execution demo
- Template creation workflow
- Activity-based development workflow
- Thompson Sampling optimization

**Priority**: CRITICAL - This is the core functionality

---

**Status**: Bug identified, fix designed, ready for implementation  
**Next**: Implement Option A in metabob-cli activity_manager.py

