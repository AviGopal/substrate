# Next Session: CLI Migration to V2 API

## Quick Context

The V2 API is **complete and tested**. The remaining work is updating metabob-cli to use these new endpoints.

## Current State

### Backend ✅
- V2 Session API: Working (`/v2/session`)
- V2 Activities API: Working (`/v2/activities/templates`)
- Proto JSON format: Stable
- Test API key available: `mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ`

### CLI ⏳
- Session manager: ✅ Already using v2 (X-API-Key header)
- Activity manager: ⏳ **Needs migration** (using old endpoints)

## File to Update

**Primary file**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

## Migration Strategy

### 1. Replace Endpoint Calls

**OLD** (Complex - 500+ lines):
```python
# Search with Thompson Sampling
POST /activity-recommendations/recommendations
Body: {
  "consumer_id": "...",
  "intent": "...",
  "session_id": "...",
  "category": "...",
  # Thompson Sampling parameters
}

# Track impression
POST /activity-recommendations/selections
Body: {
  "session_id": "...",
  "impression_id": "...",
  "selected_variant_id": "..."
}

# Track outcome
POST /activity-recommendations/conversions
Body: {
  "session_id": "...",
  "selection_id": "...",
  "success": true,
  "quality_score": 0.9
}
```

**NEW** (Simple - ~100 lines):
```python
# Search templates
GET /v2/activities/templates?query={query}&category={category}&limit={limit}
Headers: {
  "Authorization": "Bearer <session_token>"
}

# Get template details
GET /v2/activities/templates/{template_id}
Headers: {
  "Authorization": "Bearer <session_token>"
}

# Create template
POST /v2/activities/templates
Headers: {
  "Authorization": "Bearer <session_token>"
}
Body: {
  "name": "...",
  "description": "...",
  "tasks": [...],
  "variables": {...}
}
```

### 2. Remove Tracking Logic

Delete these functions:
- `_record_impression()` 
- `_record_selection()`
- `_record_conversion()`
- `_calculate_thompson_sampling_scores()` (client-side)

The backend now handles all optimization transparently!

### 3. Simplify ActivityManager Class

**Before** (~800 lines with tracking):
```python
class ActivityManager:
    def __init__(self):
        self.session_tracker = {}
        self.impression_cache = {}
        self.selection_cache = {}
        # ... tracking state
    
    async def search_activities(self):
        # Generate consumer_id
        # Call recommendations endpoint
        # Record impression
        # Apply Thompson Sampling
        # Cache results
        # Return activities
    
    async def select_activity(self):
        # Record selection
        # Update cache
        # Prepare for conversion tracking
    
    async def record_outcome(self):
        # Record conversion
        # Update metrics
        # Clean up cache
```

**After** (~200 lines without tracking):
```python
class ActivityManager:
    def __init__(self):
        self.client = None  # HTTP client
    
    async def search_activities(self, query, category=None, limit=20):
        """Simple template search"""
        response = await self.client.get(
            "/v2/activities/templates",
            params={"query": query, "category": category, "limit": limit}
        )
        return response.json()["templates"]
    
    async def get_activity(self, template_id):
        """Get template details"""
        response = await self.client.get(
            f"/v2/activities/templates/{template_id}"
        )
        return response.json()
    
    async def create_activity(self, template_data):
        """Create new template"""
        response = await self.client.post(
            "/v2/activities/templates",
            json=template_data
        )
        return response.json()
```

### 4. Update MCP Tool Descriptions

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

Update tool descriptions to remove references to impression/selection/conversion tracking:

```python
# Before:
"search_activities": {
    "description": "Search for activity templates with Thompson Sampling optimization",
    # ... mentions impressions, CTR, etc.
}

# After:
"search_activities": {
    "description": "Search for activity templates by query and category",
    "parameters": {
        "query": "Search query",
        "category": "Optional category filter",
        "limit": "Max results (default: 20)"
    }
}
```

## Testing Plan

### 1. Unit Tests
```bash
cd repos/metabob-cli
pytest tests/mcp/test_activity_manager.py -v
```

### 2. Integration Test
```bash
# Start MCP server
metabob-cli mcp

# Test from OpenCode
# Create session, search activities, get activity details
```

### 3. End-to-End Test
```bash
# Run full activity execution flow
# Verify templates are retrieved correctly
# Verify no tracking errors
```

## Expected Code Reduction

- **Before**: ~800 lines (with tracking)
- **After**: ~200 lines (pure CRUD)
- **Reduction**: ~600 lines removed (75% simpler!)

## Backward Compatibility

**Option 1**: Hard cutover (recommended)
- Remove old code entirely
- Use v2 endpoints only
- Clean break

**Option 2**: Gradual migration
- Keep old code with feature flag
- Switch between v1/v2 based on config
- Remove old code in next release

**Recommendation**: Hard cutover - the v2 API is tested and ready.

## Rollback Plan

If issues arise:
1. Old `/activity-recommendations/*` endpoints still exist
2. Can revert CLI changes
3. No data migration needed (both use same DB)

## Success Criteria

- [ ] `search_activities()` uses `/v2/activities/templates`
- [ ] `get_activity()` uses `/v2/activities/templates/{id}`
- [ ] `create_activity()` uses `POST /v2/activities/templates`
- [ ] All tracking code removed
- [ ] MCP tools updated
- [ ] Tests passing
- [ ] OpenCode integration working

## Commands for Next Session

```bash
# 1. Check current implementation
cat repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

# 2. Check MCP tools
cat repos/metabob-cli/src/metabob_cli/mcp/tools.py

# 3. Run tests after changes
cd repos/metabob-cli && pytest tests/mcp/ -v

# 4. Test with OpenCode
metabob-cli mcp  # Start server
# Then use OpenCode to test activity search
```

## Time Estimate

- Code changes: 1-2 hours
- Testing: 30 minutes
- Documentation: 30 minutes
- **Total**: 2-3 hours

## Notes

- Session management already uses v2 ✅
- Backend v2 API is stable and tested ✅
- No database changes needed ✅
- Proto JSON format working ✅

The migration is straightforward - it's mostly deleting complex tracking code and replacing with simple REST calls!
