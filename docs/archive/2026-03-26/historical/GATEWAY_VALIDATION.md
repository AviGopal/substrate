# MCP Gateway Validation Report

**Validation Date:** 2026-02-18  
**Scope:** repos/metabob-cli MCP server implementation  
**Objective:** Verify MCP gateway implements forwarding pattern without business logic

---

## Executive Summary

⚠️ **MIXED COMPLIANCE** - Gateway implementation shows both compliant forwarding and concerning local business logic.

**Key Findings:**
- ✅ Activity template tools use **local file storage** (compliant pattern for Phase 1)
- ⚠️ Activity execution tools mix **local + backend HTTP calls** (hybrid approach)
- ✅ No direct database connections (compliant)
- ⚠️ Some business logic in gateway layer (calculating metrics)

**Recommendation:** Current implementation is **acceptable for Phase 1/2** but should be refactored in **Phase 3** to pure forwarding pattern.

---

## Gateway Tools Inventory

### 1. Activity Template Tools (`activity_template_tools.py`)

**Pattern:** ✅ LOCAL STORAGE GATEWAY (File-based, no HTTP)

#### Tool: `metabob_search_activities`

**Implementation:**
```python
# Line 38-84
async def metabob_search_activities(query, category, ctx):
    templates = activity_templates.list_templates(category=category)
    
    if query:
        templates = [t for t in templates 
                    if query in t["name"] or query in t["description"]]
    
    return {"status": "success", "templates": templates}
```

**Forwards to:** `activity_templates.list_templates()` → Local file storage (`~/.metabob/activities/*.json`)  
**Business logic:** ✅ Minimal (query filtering only)  
**Error handling:** ✅ Proper try/catch with error responses  
**Verdict:** ✅ **COMPLIANT** - Pure forwarding to file-based storage

---

#### Tool: `metabob_get_activity_template`

**Implementation:**
```python
# Line 101-141
async def metabob_get_activity_template(template_id, ctx):
    template = activity_templates.get_template(template_id)
    
    if not template:
        return {"status": "not_found", "error": f"Template not found: {template_id}"}
    
    return {"status": "success", "template": template}
```

**Forwards to:** `activity_templates.get_template()` → Local file storage  
**Business logic:** ✅ None (just forward + not-found check)  
**Error handling:** ✅ Proper error responses  
**Verdict:** ✅ **COMPLIANT** - Pure forwarding pattern

---

#### Tool: `metabob_register_activity_template`

**Implementation:**
```python
# Line 158-190
async def metabob_register_activity_template(template, ctx):
    template_id = activity_templates.save_template(template)
    
    return {"status": "success", "template_id": template_id}
```

**Forwards to:** `activity_templates.save_template()` → Local file storage  
**Business logic:** ✅ None (just forward)  
**Error handling:** ✅ Proper try/catch  
**Verdict:** ✅ **COMPLIANT** - Pure forwarding pattern

---

#### Tool: `metabob_list_activity_templates`

**Implementation:**
```python
# Line 207-238
async def metabob_list_activity_templates(category, ctx):
    templates = activity_templates.list_templates(category=category)
    
    return {"status": "success", "templates": templates}
```

**Forwards to:** `activity_templates.list_templates()` → Local file storage  
**Business logic:** ✅ None (just forward)  
**Error handling:** ✅ Proper error responses  
**Verdict:** ✅ **COMPLIANT** - Pure forwarding pattern

---

#### Tool: `metabob_post_activity_result`

**Implementation:**
```python
# Line 255-292
async def metabob_post_activity_result(activity_id, result, ctx):
    # Extract template ID from activity ID
    template_id = activity_id.rsplit("-", 1)[0] if "-" in activity_id else activity_id
    
    activity_templates.update_metrics(template_id, result)
    
    return {"status": "success", "activity_id": activity_id}
```

**Forwards to:** `activity_templates.update_metrics()` → Local file storage  
**Business logic:** ⚠️ **MODERATE** - Template ID extraction logic  
**Error handling:** ✅ Proper error responses  
**Verdict:** ⚠️ **ACCEPTABLE** - Minor business logic (ID parsing) but forwards correctly

---

### 2. Activity Execution Tools (`activity_tools.py`)

**Pattern:** ⚠️ HYBRID (Local components + Backend HTTP calls)

#### Tool: `activity/start`

**Implementation:**
```python
# Line 31-116
async def activity_start(activity_id, template_id, session_id, variables, impulses, ...):
    from metabob_cli.mcp.activity_manager import get_activity_manager
    
    # Get config and session token
    config = load_config()
    base_url = getattr(config, "api_base_url", "http://localhost:8080")
    session_token = getattr(config, "session_token", "")
    
    # Get activity manager
    manager = get_activity_manager(base_url, session_token)
    
    # Start execution via activity manager
    result = await manager.start_execution(
        activity_id=activity_id,
        session_id=session_id,
        variables=variables,
        impulses=impulses,
    )
    
    return {"status": "success", "execution_id": result.get("execution_id")}
```

**Forwards to:** `activity_manager.start_execution()` → Backend HTTP API  
**Business logic:** ⚠️ **MODERATE** - Config loading, session token retrieval  
**Error handling:** ✅ Proper try/catch  
**Verdict:** ⚠️ **HYBRID** - Forwards to backend but has setup logic

---

#### Tool: `extract_execution_components`

**Implementation:**
```python
# Line 120-192
async def extract_execution_components(execution_id, changed_files, git_diff, ctx):
    from .server import watcher
    
    component_changes = []
    
    for file_path in changed_files:
        # Get all components in the file
        file_components = watcher.metabob_api.list_file_components(file_path)
        
        for component in file_components:
            # Check if component in git diff
            in_diff = True
            if git_diff and component.get("name"):
                file_section = _extract_file_section(git_diff, file_path)
                in_diff = component["name"] in file_section
            
            if in_diff:
                component_changes.append({
                    "file_path": file_path,
                    "component_name": component.get("name"),
                    "component_type": component.get("type"),
                    "change_type": _detect_change_type(component, git_diff, file_path),
                })
    
    return json.dumps({"component_changes": component_changes})
```

**Forwards to:** `watcher.metabob_api.list_file_components()` → CPG analysis  
**Business logic:** ❌ **HEAVY** - Git diff parsing, component filtering, change detection  
**Error handling:** ⚠️ Try/catch per file, continues on error  
**Verdict:** ❌ **VIOLATION** - Significant business logic in gateway layer

---

#### Tool: `annotate_execution_components`

**Implementation:**
```python
# Line 194-262
async def annotate_execution_components(execution_id, component_changes_json, ...):
    from .server import watcher
    
    component_changes = json.loads(component_changes_json)
    impulse_ids = json.loads(impulse_ids_json) if impulse_ids_json else []
    
    annotations_created = []
    
    for change in component_changes:
        # Build annotation content
        content = f"Modified by execution {execution_id}: {execution_description}"
        if impulse_ids:
            content += f"\n\nContext used: {', '.join(impulse_ids)}"
        
        # Create annotation
        success = watcher.metabob_api.annotate_component(
            file_path=change["file_path"],
            component_name=change["component_name"],
            component_type=change.get("component_type"),
            reason=content,
            metadata={"execution_id": execution_id, "impulses": impulse_ids},
        )
        
        if success:
            annotations_created.append({...})
    
    return json.dumps({"annotations": annotations_created})
```

**Forwards to:** `watcher.metabob_api.annotate_component()` → Backend API  
**Business logic:** ❌ **HEAVY** - Content formatting, loop orchestration, success tracking  
**Error handling:** ⚠️ Try/catch per component, continues on error  
**Verdict:** ❌ **VIOLATION** - Business logic should be in backend

---

#### Tool: `report_execution_outcome`

**Implementation:**
```python
# Line 264-394
async def report_execution_outcome(execution_id, variant_id, session_id, success, ...):
    import httpx
    
    changed_files = json.loads(changed_files_json)
    impulses_loaded = json.loads(impulses_loaded_json)
    
    # Extract components
    extraction_json = await extract_execution_components(execution_id, changed_files, git_diff)
    component_changes = json.loads(extraction_json)["component_changes"]
    
    # Map impulses
    impulses_used = [
        {
            "impulse_id": imp.get("id"),
            "content_hash": hashlib.sha256(str(imp.get("content")).encode()).hexdigest()[:16],
            "tokens_used": imp.get("tokens"),
            "was_useful": True,  # TODO: Track actual usage
        }
        for imp in impulses_loaded
    ]
    
    # Call backend API
    backend_url = os.getenv("METABOB_API_URL", "http://localhost:8080")
    api_key = os.getenv("METABOB_API_KEY", "")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{backend_url}/v2/activities/record/complete",
            json={
                "execution_id": execution_id,
                "success": success,
                "duration_ms": duration_ms,
                "cost": cost,
                "tokens": tokens_used,
                # ... more fields
            },
            headers={"Authorization": f"Bearer {api_key}"},
        )
    
    # Annotate components if successful
    if success and component_changes:
        annotations_json = await annotate_execution_components(...)
    
    return json.dumps({"success": response.status_code == 200, ...})
```

**Forwards to:** Backend HTTP API (`POST /v2/activities/record/complete`)  
**Business logic:** ❌ **VERY HEAVY** - Component extraction, impulse mapping, HTTP client, orchestration  
**Error handling:** ✅ Proper try/catch with error responses  
**Verdict:** ❌ **MAJOR VIOLATION** - This should be a simple forwarding call

---

## Supporting Module Analysis

### `activity_templates.py` - Local Storage Layer

**Functions:**

1. **`list_templates(category)`** (Line 76-123)
   - ✅ Pure file I/O - reads `~/.metabob/activities/*.json`
   - ✅ Minimal logic - category filtering
   - ✅ Returns metadata list

2. **`get_template(template_id)`** (Line 126-182)
   - ✅ Pure file I/O - reads template JSON
   - ✅ Schema conversion (snake_case → camelCase)
   - ✅ Template lookup by ID or activity_id

3. **`save_template(template)`** (Line 185-236)
   - ✅ Pure file I/O - writes template JSON
   - ⚠️ ID generation logic (from name)
   - ⚠️ Timestamp addition (created_at, updated_at)
   - **Verdict:** ⚠️ Minor business logic (ID gen) but acceptable

4. **`update_metrics(template_id, result)`** (Line 239-300)
   - ❌ **SIGNIFICANT BUSINESS LOGIC**:
     - Calculates execution counts
     - Computes rolling averages (duration, cost)
     - Updates success rates
   - File I/O for read + write
   - **Verdict:** ❌ **VIOLATION** - Metrics calculation should be in backend

**Overall Verdict:** ⚠️ Mostly compliant file I/O layer, but `update_metrics()` contains business logic.

---

## Architecture Pattern Analysis

### Current Pattern: HYBRID LOCAL + BACKEND

```
┌─────────────────────────────────────────────────────────────┐
│                    metabob-opencode (MCP Client)             │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP calls
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              metabob-cli (MCP Gateway Server)                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Activity Template Tools                             │   │
│  │  - metabob_search_activities         ✅ Local files │   │
│  │  - metabob_get_activity_template     ✅ Local files │   │
│  │  - metabob_register_activity_template ✅ Local files│   │
│  │  - metabob_post_activity_result      ⚠️  Local files│   │
│  │    (with metrics calculation)                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Activity Execution Tools                            │   │
│  │  - activity/start                    ⚠️  Backend HTTP│   │
│  │  - extract_execution_components      ❌ Business logic│   │
│  │  - annotate_execution_components     ❌ Business logic│   │
│  │  - report_execution_outcome          ❌ Business logic│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Local Storage   │    │ metabob-rpc-api  │
│  ~/.metabob/     │    │  (Backend HTTP)  │
│  activities/     │    │                  │
└──────────────────┘    └──────────────────┘
```

**Assessment:**
- ✅ Template tools use local storage (file-based gateway)
- ⚠️ Execution tools mix local + backend calls
- ❌ Significant business logic in gateway layer

---

## Issues Found

### CRITICAL Issues: 3

1. **Heavy Business Logic in `extract_execution_components`** (activity_tools.py:120-192)
   - **Problem:** Git diff parsing, component filtering, change type detection
   - **Impact:** Gateway contains logic that should be in backend
   - **Recommendation:** Move to backend service, gateway should just forward

2. **Heavy Business Logic in `annotate_execution_components`** (activity_tools.py:194-262)
   - **Problem:** Content formatting, loop orchestration, success tracking
   - **Impact:** Gateway orchestrates multiple backend calls
   - **Recommendation:** Backend should handle annotation batching

3. **Massive Orchestration in `report_execution_outcome`** (activity_tools.py:264-394)
   - **Problem:** 
     - Calls other tools (`extract_execution_components`)
     - Maps impulses with hashing
     - Direct HTTP client usage
     - Multi-step orchestration (extract → report → annotate)
   - **Impact:** Gateway is an orchestration engine, not a forwarder
   - **Recommendation:** Backend should expose single endpoint that handles all steps

---

### WARNING Issues: 2

1. **Metrics Calculation in `update_metrics`** (activity_templates.py:239-300)
   - **Problem:** Rolling average calculations, success rate computation
   - **Impact:** Business logic in file storage layer
   - **Recommendation:** Backend should calculate metrics, or accept this as acceptable for Phase 1

2. **Template ID Extraction in `metabob_post_activity_result`** (activity_template_tools.py:266-268)
   - **Problem:** Parsing activity_id to extract template_id
   - **Impact:** Minor business logic in gateway
   - **Recommendation:** Client should send both IDs explicitly, or accept as minor

---

## Compliance Scorecard

| Criterion | Status | Details |
|-----------|--------|---------|
| **No direct database connections** | ✅ PASS | Uses file storage and HTTP APIs |
| **Proper error handling** | ✅ PASS | All tools have try/catch |
| **Template tools forward correctly** | ✅ PASS | Forward to local file storage |
| **Execution tools forward correctly** | ❌ FAIL | Heavy orchestration logic |
| **No business logic in gateway** | ❌ FAIL | Metrics calculation, component extraction, orchestration |
| **Tools registered properly** | ✅ PASS | All tools decorated with @mcp.tool |

**Overall Score: 3/6 PASS** ⚠️

---

## Recommendations

### Phase 1/2 Status: ACCEPTABLE WITH CAVEATS

**Current implementation is usable** because:
- Template management works correctly via local files
- Execution tracking reaches the backend
- No data loss or corruption risks

**However, it violates MCP Gateway principles:**
- Gateway should forward, not orchestrate
- Business logic belongs in backend
- Gateway layer is too thick

---

### Phase 3 Refactoring Recommendations

#### 1. **Simplify `report_execution_outcome`** (HIGH PRIORITY)

**Before (Current - 130 lines):**
```python
async def report_execution_outcome(...):
    # Extract components (tool call)
    extraction_json = await extract_execution_components(...)
    component_changes = json.loads(extraction_json)["component_changes"]
    
    # Map impulses (business logic)
    impulses_used = [{"impulse_id": ..., "content_hash": ...} for imp in impulses]
    
    # HTTP call to backend
    response = await client.post(f"{backend_url}/v2/activities/record/complete", ...)
    
    # Annotate components (tool call)
    if success:
        await annotate_execution_components(...)
```

**After (Recommended - 20 lines):**
```python
async def report_execution_outcome(...):
    """Simple forwarding to backend - no orchestration."""
    backend_url = os.getenv("METABOB_API_URL")
    api_key = os.getenv("METABOB_API_KEY")
    
    # Forward everything to backend as-is
    response = await client.post(
        f"{backend_url}/v2/activities/outcome/report",
        json={
            "execution_id": execution_id,
            "variant_id": variant_id,
            "success": success,
            "duration_ms": duration_ms,
            "cost": cost,
            "tokens_used": tokens_used,
            "changed_files": json.loads(changed_files_json),
            "impulses_loaded": json.loads(impulses_loaded_json),
            "git_diff": git_diff,
            "failure_reason": failure_reason,
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    
    return response.json()
```

**Backend should handle:**
- Component extraction (via CPG service)
- Impulse mapping and hashing
- Annotations (batch creation)
- Orchestration of all sub-operations

---

#### 2. **Remove `extract_execution_components` Tool** (HIGH PRIORITY)

**This tool should not exist at MCP layer** - it's internal backend logic.

**Alternative:**
- Backend endpoint `/v2/components/extract` (called by outcome handler)
- Or integrate into `/v2/activities/outcome/report` directly

---

#### 3. **Remove `annotate_execution_components` Tool** (HIGH PRIORITY)

**This tool should not exist at MCP layer** - it's internal backend logic.

**Alternative:**
- Backend endpoint `/v2/annotations/batch` (called by outcome handler)
- Or integrate into `/v2/activities/outcome/report` directly

---

#### 4. **Move Metrics Calculation to Backend** (MEDIUM PRIORITY)

**Current `update_metrics()` in `activity_templates.py`:**
```python
def update_metrics(template_id: str, result: dict) -> None:
    # Load template from file
    template_data = json.load(...)
    
    # Calculate rolling averages
    execution_count += 1
    new_avg_duration = (total_duration + result["duration"]) / execution_count
    new_avg_cost = (total_cost + result["cost"]) / execution_count
    
    # Save back to file
    json.dump(template_data, ...)
```

**Recommended:**
- Backend maintains metrics in database
- Gateway tool just forwards: `POST /v2/templates/{id}/metrics`
- Backend returns updated metrics

---

#### 5. **Backend API Design for Phase 3**

**New Backend Endpoints:**

1. **`POST /v2/activities/outcome/report`**
   - Accepts: execution_id, success, duration, cost, tokens, changed_files, impulses, git_diff
   - Handles:
     - Component extraction (via CPG)
     - Impulse mapping
     - Annotation creation
     - Metrics update
   - Returns: outcome_id, components_extracted, annotations_created

2. **`GET /v2/templates`**
   - Query params: category (optional)
   - Returns: template list with metrics

3. **`GET /v2/templates/{id}`**
   - Returns: full template object

4. **`POST /v2/templates`**
   - Body: template object
   - Returns: template_id

5. **`POST /v2/templates/{id}/metrics`**
   - Body: execution result
   - Returns: updated metrics

**Gateway tools become simple forwarders:**
```python
async def metabob_report_execution_outcome(...):
    return await http_client.post(f"{backend_url}/v2/activities/outcome/report", json={...})

async def metabob_search_activities(query, category):
    return await http_client.get(f"{backend_url}/v2/templates?category={category}&query={query}")
```

---

## Testing Recommendations

### Current State Testing

**Integration Tests:**
```python
# Test that tools forward correctly
async def test_template_tools():
    # Verify metabob_search_activities returns templates from storage
    result = await metabob_search_activities(category="feature")
    assert result["status"] == "success"
    assert len(result["templates"]) > 0

# Test that execution tools reach backend
async def test_execution_tools():
    # Verify report_execution_outcome calls backend
    result = await report_execution_outcome(...)
    assert result["success"] == True
```

**Unit Tests:**
```python
# Test activity_templates.py logic
def test_update_metrics():
    # Verify metrics calculation (current business logic)
    update_metrics("template-id", {"success": True, "duration": 1000, "cost": 0.05})
    template = get_template("template-id")
    assert template["estimated_metrics"]["execution_count"] == 1
```

---

### Phase 3 Testing

**After refactoring to pure forwarding:**

```python
# Mock backend, verify gateway forwards correctly
async def test_gateway_forwarding():
    with mock_backend() as backend:
        result = await metabob_report_execution_outcome(...)
        
        # Verify gateway forwarded to backend
        assert backend.received_request("/v2/activities/outcome/report")
        assert result == backend.mock_response
```

---

## Conclusion

**Status: ⚠️ ACCEPTABLE FOR PHASE 1/2, REQUIRES REFACTORING FOR PHASE 3**

### Current State Assessment

**Strengths:**
- ✅ Template management via local files works correctly
- ✅ No direct database connections
- ✅ Proper error handling throughout
- ✅ Execution tracking reaches backend

**Weaknesses:**
- ❌ Heavy business logic in gateway layer (component extraction, orchestration)
- ❌ Metrics calculation in file storage layer
- ❌ Tool composition (tools calling other tools)
- ❌ Direct HTTP client usage in tools

### Phase 3 Action Plan

**Priority 1: Simplify Execution Tools (2-3 days)**
1. Create backend endpoint: `POST /v2/activities/outcome/report`
2. Move component extraction to backend
3. Move annotation orchestration to backend
4. Refactor `report_execution_outcome` to simple HTTP forward
5. Remove `extract_execution_components` and `annotate_execution_components` tools

**Priority 2: Move Metrics to Backend (1-2 days)**
1. Create backend endpoint: `POST /v2/templates/{id}/metrics`
2. Move metrics calculation to backend service
3. Update `metabob_post_activity_result` to simple HTTP forward

**Priority 3: Backend Template Storage (Optional, 2-3 days)**
1. Migrate templates from `~/.metabob/activities/` to database
2. Update all template tools to HTTP forwarding
3. Maintain backward compatibility with file discovery

### Acceptance Criteria for Phase 3

- [ ] All MCP tools are < 30 lines (simple forwarding only)
- [ ] No business logic in gateway tools
- [ ] No tool-to-tool calls (no composition)
- [ ] All metrics calculation in backend
- [ ] All orchestration in backend
- [ ] Gateway tools return backend responses directly

---

**Generated By:** OpenCode Architecture Validation  
**Validation ID:** validate-mcp-gateway-2026-02-18  
**Confidence Level:** VERY HIGH (source code analysis)  
**Recommended Phase 3 Start:** After addressing Priority 1 + 2
