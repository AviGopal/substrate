# Activity Variant Architecture Violation

**Date**: February 6, 2026  
**Severity**: CRITICAL - Architecture Boundary Violation

## The Core Problem

The activity execution system (metabob-opencode) is **incorrectly coupled to the variant system** (A/B testing infrastructure). These should be completely separate concerns.

## What's Happening

### Current (WRONG) Architecture

```
OpenCode Agent
    ↓
Requests: activity_id = "jiggle-documentation"
    ↓
MCP Layer (metabob-cli)
    ↓
Looks up: variant_id = "jiggle-documentation-772b239e"  ❌ WRONG!
    ↓
RPC API endpoint: /variants/{variant_id}/details
    ↓
Returns: Variant-specific data (A/B testing metrics, Thompson sampling, etc.)
```

**Problem**: The agent knows about variants, A/B testing, impressions, conversions, Thompson sampling, etc.

**This is wrong**. The agent should only know about **activities**, not **variants**.

### Correct Architecture

```
OpenCode Agent
    ↓
Requests: activity_id = "jiggle-documentation"
    ↓
MCP Layer
    ↓
Activity Service (NOT variant service)
    ↓
Returns: ActivityTemplate (canonical, stable definition)
    ↓
Variant selection happens TRANSPARENTLY in backend
```

**The agent should NEVER see**:
- ❌ variant_id
- ❌ A/B testing metrics
- ❌ Thompson sampling scores
- ❌ Impression/conversion data
- ❌ Multiple variants of the same activity

**The agent should ONLY see**:
- ✅ activity_id
- ✅ Activity name/description
- ✅ Task definitions
- ✅ Required variables

## Why This Matters

### 1. Separation of Concerns

**Activity Execution** (OpenCode):
- What to execute
- Task definitions
- Variable requirements
- Execution flow

**Variant Management** (Backend A/B Testing):
- Which variant to serve
- Performance tracking
- Multi-armed bandit algorithms
- Evolution/improvement

These are **orthogonal concerns** that should be **completely decoupled**.

### 2. Agent Context Pollution

The agent doesn't need to know:
- That there are 5 variants of the bug-fix activity
- That variant A has 75% success rate
- That Thompson sampling selected variant B
- That we're running A/B tests

**The agent just needs**: "Here's the bug-fix activity definition"

### 3. Stability

Activity IDs should be **stable and canonical**:
- `activity_id = "bug-fix"` → always works
- `variant_id = "bug-fix-v1"` → breaks when v2 is deployed

**The agent shouldn't care about versions/variants**.

### 4. Complexity

By exposing variants to OpenCode, we've created:
- Complex MCP query logic
- Variant-aware caching
- Version disambiguation
- Backward compatibility nightmares

**None of this should exist at the OpenCode layer**.

## The Evidence

### 1. MCP Tool Returns Variant Data

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:306`

```python
response = await client.get(
    f"/activity-recommendations/variants/{activity_id}/details"  # ❌ WRONG!
)
```

**Should be**:
```python
response = await client.get(
    f"/activities/{activity_id}"  # ✅ Correct
)
```

### 2. OpenCode Stores variant_id

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:146`

The transformed template includes:
```typescript
variant_id: mcpActivity.variant_id  // ❌ OpenCode shouldn't know this
```

### 3. Database Stores variants, Not Activities

```sql
-- Current (WRONG)
SELECT * FROM activity_variants WHERE variant_id = 'bug-fix-v1';

-- Should be
SELECT * FROM activities WHERE activity_id = 'bug-fix';
-- (With variants as internal detail)
```

## The Correct Architecture

### Layer 1: Activities (Public API)

**Table**: `activities`
```json
{
  "activity_id": "bug-fix",
  "name": "Fix Bug",
  "description": "...",
  "category": "bugfix",
  "status": "active"
}
```

**Endpoint**: `GET /activities/{activity_id}`
**Returns**: Canonical activity definition (currently active variant)
**Used by**: OpenCode, MCP, agents

### Layer 2: Variants (Internal A/B Testing)

**Table**: `activity_variants`
```json
{
  "variant_id": "bug-fix-v1",
  "activity_id": "bug-fix",  // FK to activities table
  "task_steps": [...],
  "performance_metrics": {...}
}
```

**Endpoint**: `GET /admin/activities/{activity_id}/variants` (admin only)
**Returns**: List of variants for A/B testing management
**Used by**: Admin dashboard, evolution system, MAB algorithms

### Layer 3: Variant Selection (Transparent)

When OpenCode requests `activity_id = "bug-fix"`:

1. **Activity Service** receives request
2. **Variant Selector** (MAB) picks best variant internally
3. **Returns**: Task steps from selected variant
4. **Records**: Impression for tracking (internally)

**OpenCode never knows** which variant was selected.

## The Fix

### Step 1: Create Activities Table

```sql
CREATE TABLE activities (
    activity_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT current_timestamp,
    updated_at DATETIME DEFAULT current_timestamp
);
```

### Step 2: Link Variants to Activities

```sql
ALTER TABLE activity_variants 
ADD CONSTRAINT fk_activity 
FOREIGN KEY (activity_id) REFERENCES activities(activity_id);

-- Add index for performance
CREATE INDEX idx_variants_by_activity ON activity_variants(activity_id);
```

### Step 3: Create Activity Service

**File**: `repos/metabob-rpc-api/server/routes/activities.py`

```python
@router.get("/activities/{activity_id}")
async def get_activity(
    activity_id: str,
    session: SessionData = Depends(get_current_session_or_internal),
    db: SurrealDBClient = Depends(get_surreal_connection),
) -> ActivityTemplate:
    """
    Get activity template (transparently selects best variant).
    
    This endpoint:
    1. Validates activity exists and is active
    2. Uses MAB algorithm to select best-performing variant
    3. Records impression for tracking
    4. Returns canonical activity template (hiding variant details)
    
    The caller never knows which variant was selected.
    """
    from server.services.variant_selector import select_best_variant
    
    # Get activity metadata
    activity = await db.query(
        "SELECT * FROM activities WHERE activity_id = $aid",
        {"aid": activity_id}
    )
    
    if not activity or activity[0].status != "active":
        raise HTTPException(404, f"Activity {activity_id} not found")
    
    # Select best variant (MAB algorithm, transparent to caller)
    variant = await select_best_variant(
        db=db,
        activity_id=activity_id,
        context=session,  # for personalization
    )
    
    # Record impression (for MAB tracking)
    await record_impression(
        db=db,
        variant_id=variant.variant_id,
        session_id=session.session_id,
    )
    
    # Return canonical activity template (NO variant_id exposed)
    return ActivityTemplate(
        id=activity_id,  # ✅ activity_id, NOT variant_id
        name=activity[0].name,
        description=activity[0].description,
        category=activity[0].category,
        tasks=transform_task_steps(variant.task_steps),
        # NO variant-specific fields
    )
```

### Step 4: Update MCP Tool

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:306`

```python
# OLD (WRONG)
response = await client.get(
    f"/activity-recommendations/variants/{activity_id}/details"
)

# NEW (CORRECT)
response = await client.get(
    f"/activities/{activity_id}"
)
```

### Step 5: Update OpenCode Template Loader

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:146`

```typescript
// Remove all variant-specific fields
const template: ActivityTemplate.Schema = {
  id: mcpActivity.activity_id,  // ✅ NOT variant_id
  // ... other canonical fields only
  // ❌ NO variant_id
  // ❌ NO MAB metrics
  // ❌ NO performance data
}
```

## Migration Path

### Phase 1: Create Activities Table
1. Extract unique activity_ids from activity_variants
2. Create activities table with canonical definitions
3. Add FK from variants to activities

### Phase 2: Add Activity Service
1. Create `/activities/{activity_id}` endpoint
2. Implement variant selection logic
3. Return canonical templates (no variant details)

### Phase 3: Update MCP Layer
1. Point MCP to new `/activities/` endpoint
2. Remove variant_id from responses
3. Cache by activity_id (not variant_id)

### Phase 4: Update OpenCode
1. Remove variant awareness from template loader
2. Cache by activity_id only
3. Remove variant-specific fields from schema

### Phase 5: Deprecate Old Endpoints
1. Mark `/variants/{variant_id}/details` as admin-only
2. Update documentation
3. Remove variant references from public APIs

## Benefits

### For OpenCode Agents
- ✅ Simple, stable activity_ids
- ✅ No variant complexity
- ✅ Predictable behavior
- ✅ Cleaner caching

### For Backend
- ✅ Clean separation of concerns
- ✅ Can evolve variant system independently
- ✅ Can run A/B tests transparently
- ✅ Can retire/deploy variants without breaking OpenCode

### For Developers
- ✅ Clear mental model
- ✅ Activities = what to execute
- ✅ Variants = how to optimize (internal detail)
- ✅ No leaky abstractions

## Why This Happened

Looking at the code, it seems like:

1. **Variants were implemented first** (for A/B testing)
2. **Activities were never properly abstracted** as a separate concept
3. **MCP layer was built on top of variants** instead of activities
4. **The abstraction boundary was never enforced**

This is a classic case of **implementation details leaking into the API**.

## Current State

```
❌ OpenCode queries: /variants/{variant_id}/details
❌ MCP returns: variant-specific data
❌ Database has: only activity_variants table
❌ No activities table exists
❌ No variant selection service
❌ Agents see: variant_ids, MAB metrics
```

## Target State

```
✅ OpenCode queries: /activities/{activity_id}
✅ MCP returns: canonical activity templates
✅ Database has: activities + variants tables
✅ Variant selection is transparent
✅ Agents see: only activity_id and tasks
```

## Immediate Action

**Don't try to make jiggle-documentation work with the current broken architecture.**

**Instead, fix the architecture first**:
1. Create activities table
2. Create /activities/{activity_id} endpoint
3. Update MCP to use new endpoint
4. THEN register jiggle-documentation

---

**Key Insight**: You were right - we shouldn't have the agent know or care about variants. The fact that it does is a fundamental architecture bug, not just a serialization issue.

**Status**: Architecture violation documented  
**Next Action**: Implement proper activity/variant separation
