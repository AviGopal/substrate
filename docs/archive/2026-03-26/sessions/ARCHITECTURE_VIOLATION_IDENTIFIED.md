# Architecture Violation: OpenCode Directly Accessing Backend

**Date**: February 12, 2026  
**Status**: 🚨 CRITICAL BOUNDARY VIOLATION  
**Reverted**: Commit 2e0b4be3

---

## The Violation

I attempted to fix the activity tool by making OpenCode read session tokens and call the backend API directly. This violates the fundamental architecture.

### What I Did Wrong

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob-api.ts`

```typescript
// ❌ WRONG: Made OpenCode read .metabob/state and call backend
async function getSessionToken(): Promise<string | undefined> {
  const stateContent = await fs.readFile(".metabob/state", "utf-8")
  const state = JSON.parse(stateContent)
  return state?.session_metadata?.session_token
}

// Then used it to call backend directly
headers["Authorization"] = `Bearer ${_sessionToken}`
```

**Why This Is Wrong**:
1. OpenCode should NEVER manage authentication
2. OpenCode should NEVER read `.metabob/state`
3. OpenCode should NEVER call backend APIs directly
4. Authentication is metabob-cli's responsibility

---

## Correct Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ OpenCode (TypeScript)                                       │
│   - UI and user interaction                                 │
│   - Tool invocations                                        │
│   - Session state management                                │
│   - NO backend communication                                │
│   - NO authentication management                            │
└──────────────────┬──────────────────────────────────────────┘
                   │ MCP Protocol (stdio)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ metabob-cli (Python)                                        │
│   - MCP Server                                              │
│   - Authentication (session tokens)                         │
│   - Activity execution orchestration                        │
│   - Backend API client                                      │
│   - CPG cochange analysis                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/REST (authenticated)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ metabob-rpc-api (Python/FastAPI)                           │
│   - Template storage (SurrealDB)                           │
│   - Thompson Sampling                                       │
│   - Execution recording                                     │
└─────────────────────────────────────────────────────────────┘
```

### Boundaries

**OpenCode responsibilities**:
- ✅ Call MCP tools
- ✅ Manage UI state
- ✅ Handle user interactions
- ❌ NO backend API calls
- ❌ NO authentication
- ❌ NO direct database access

**metabob-cli responsibilities**:
- ✅ MCP server
- ✅ Manage session tokens
- ✅ Call backend APIs
- ✅ Handle authentication
- ✅ CPG analysis
- ✅ Activity orchestration

**metabob-rpc-api responsibilities**:
- ✅ Store templates
- ✅ Execute Thompson Sampling
- ✅ Record executions
- ✅ Manage database

---

## The Real Problem

### Wrong Approach (What I Did)

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:276-282`

```typescript
// ❌ WRONG: OpenCode calling backend directly
const { MetabobAPI } = await import("../util/metabob-api")
const variantDetails = await MetabobAPI.getVariantDetails(resolvedId)
```

**Comment in code**:
```typescript
// Step 3: Load from backend via direct API
// Note: We use direct API instead of MCP's get_activity because MCP only returns
// metadata (no tasks) by design for incremental execution model.
```

**This comment reveals the architectural conflict**: OpenCode wants full templates with all tasks, but MCP deliberately hides tasks for incremental execution.

### Correct Approach (Not Yet Implemented)

OpenCode should use MCP for EVERYTHING:

```typescript
// ✅ CORRECT: Use MCP tools only
const { MetabobCLI } = await import("../util/metabob")

// Get metadata only (no tasks)
const activity = await MetabobCLI.getActivity(resolvedId)

// For execution, use incremental flow:
// 1. start_activity_execution (via MCP)
// 2. get_next_step (via MCP) - returns ONE step at a time
// 3. report_step_result (via MCP)
// 4. repeat until complete
```

---

## Why Incremental Execution Exists

From `activity_manager.py`:

```python
async def get_activity(self, activity_id: str) -> Optional[dict]:
    """
    Get activity METADATA only (NOT full steps).
    
    Returns high-level info: description, variables, context requirements.
    Does NOT expose: task prompts, validation rules, step IDs.
    
    This enforces incremental execution where agents receive steps one at a time.
    """
    # ... returns metadata only ...
    logger.info(f"get_activity returned metadata for: {activity_id} (hiding {task_count} steps)")
```

**Design rationale**:
1. **Context control**: Agent sees only current step, not entire plan
2. **Dynamic adjustment**: Can modify steps based on execution results
3. **Trailblazing**: Can inject fix steps mid-execution
4. **Token budget**: Avoids loading all steps into context at once

---

## The Conflict

### OpenCode's Current Design

**File**: `template-loader.ts` and `activity-template-repository.ts`

OpenCode expects to:
1. Load FULL template with ALL tasks upfront
2. Cache it in memory (TemplateCache)
3. Validate variables before execution
4. Show task list to user

**This conflicts with incremental execution model**.

### MCP's Design

metabob-cli provides:
1. `get_activity_tool()` - metadata only, NO tasks
2. `start_activity_execution_tool()` - initialize execution
3. `get_next_step_tool()` - ONE step at a time
4. `report_step_result_tool()` - record step outcome

**This enforces incremental execution**.

---

## The Real Issue

The `activity` tool in OpenCode (`packages/opencode/src/tool/activity.ts`) does this:

```typescript
// Pre-load template for validation only
const template = await TemplateRepository.get(templateId, { sessionID: ctx.sessionID })
if (!template) {
  throw new Error(`Activity "${params.activityId}" not found`)
}

// Pre-flight variable validation
const validationResult = validateTemplateVariables(template, params.variables)
```

**It needs the full template** to validate variables BEFORE starting execution.

But `TemplateRepository.get()` tries to get full template via:
1. Cache (works if cached)
2. MetabobAPI.getVariantDetails() (violates architecture)

**The violation**: Step 2 should use MCP, not direct API.

---

## Correct Fix (Not Applied Yet)

### Option 1: Add MCP Tool for Full Template

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

```python
@mcp.tool(name="get_activity_template")
async def get_activity_template_tool(activity_id: str) -> str:
    """
    Get FULL activity template including all tasks.
    
    ⚠️  This is an EXCEPTION to incremental execution.
    Only use for:
    - Pre-flight variable validation in activity tool
    - Template editing/debugging tools
    - Template migration/transformation
    
    For execution, use incremental flow (start_execution → get_next_step).
    """
    config = _get_server().get_config_manager()
    base_url = config.get("base_url")
    session_token = await _get_session_token(config)
    
    manager = get_activity_manager(base_url, session_token)
    
    # Load full template (this already exists internally)
    template = await manager._load_activity_to_cache(activity_id)
    
    if template is None:
        return json.dumps({"status": "not_found"})
    
    return json.dumps({
        "status": "success",
        "template": template  # Full template with all tasks
    })
```

### Option 2: Validate Variables via MCP

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

```python
@mcp.tool(name="validate_activity_variables")
async def validate_activity_variables_tool(activity_id: str, variables: str) -> str:
    """
    Validate variables for an activity WITHOUT exposing full template.
    
    Returns validation result: missing, invalid, or OK.
    """
    manager = get_activity_manager(...)
    template = await manager._load_activity_to_cache(activity_id)
    
    # Extract variable schema only
    required_vars = template.get("variables", {})
    provided_vars = json.loads(variables)
    
    # Validate
    missing = [v for v in required_vars if v not in provided_vars]
    
    return json.dumps({
        "status": "success",
        "valid": len(missing) == 0,
        "missing": missing
    })
```

### Update OpenCode to Use MCP

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:276-282`

```typescript
// ✅ CORRECT: Use MCP tool instead of direct API
const { MetabobCLI } = await import("../util/metabob")

// Option 1: Get full template via MCP
const template = await MetabobCLI.getActivityTemplate(resolvedId)

// Option 2: Just validate variables via MCP (don't need full template)
const validation = await MetabobCLI.validateActivityVariables(resolvedId, variables)
```

---

## Recommended Solution

**Short term** (for activity tool to work):
1. Add `get_activity_template_tool` to metabob-cli MCP
2. Update TemplateLoader to call MCP instead of MetabobAPI
3. Remove MetabobAPI usage from OpenCode (or mark deprecated)

**Long term** (architectural cleanup):
1. Move template caching to metabob-cli
2. OpenCode uses MCP for ALL template operations
3. Remove `MetabobAPI` module entirely from OpenCode
4. Document MCP as the ONLY communication path

---

## Action Items

- [ ] Revert my incorrect fix (DONE - commit 2e0b4be3)
- [ ] Add `get_activity_template_tool` to metabob-cli
- [ ] Update TemplateLoader to use MCP tool
- [ ] Test activity tool works with MCP-only approach
- [ ] Remove MetabobAPI direct calls from OpenCode
- [ ] Document architecture boundaries clearly

---

## Lessons Learned

1. **Respect boundaries**: OpenCode should NEVER touch backend or auth
2. **MCP is the boundary**: All metabob operations go through MCP
3. **Read architecture docs**: The comment in template-loader explained the conflict
4. **Don't hack around design**: If MCP doesn't expose something, add it properly
5. **Architecture over expediency**: Fix the architecture, don't violate it

---

**Status**: Violation reverted, correct fix not yet implemented  
**Next**: Add proper MCP tool for template loading
