# Corrected Learning Loop Architecture

**Date**: 2026-02-21  
**Status**: READY TO IMPLEMENT  
**Communication Pathway**: opencode → MCP → cli → API → DB

---

## Communication Architecture Principle

**ALL communication from opencode to backend MUST go through MCP:**

```
metabob-opencode (client)
        ↓
        ↓ MCP protocol (tool calls)
        ↓
metabob-cli (MCP server)
        ↓
        ↓ HTTP/REST (authenticated)
        ↓
metabob-rpc-api (backend)
        ↓
        ↓ Database protocol
        ↓
SurrealDB / Redis / PostgreSQL
```

**Why This Pattern?**
1. **Single integration point**: All auth/backend logic in metabob-cli
2. **LLM familiarity**: Agents use standard tool calling interface
3. **Plugin architecture**: Add new backends by configuring MCP, not code changes
4. **Clear boundaries**: Each layer has single responsibility
5. **Future-proof**: New plugins only need MCP tool definitions

---

## Corrected Data Flow

### Activity Execution Metrics (Write Path)

```
User executes activity in opencode
        ↓
Activity.complete() in opencode
        ↓
TemplateMetricsClient.reportExecution()
        ↓
MCP.callTool("metabob_post_activity_result", {...})
        ↓
metabob-cli receives MCP call
        ↓
HTTP POST /api/activity-execution (with auth headers)
        ↓
metabob-rpc-api receives request
        ↓
INSERT INTO activity_execution (SurrealDB)
        ↓
UPDATE template_metrics (aggregates)
        ↓
Response back through chain
```

### Boredom Activity Fetch (Read Path)

```
BoredomManager.checkIdleAndExecute() in opencode
        ↓
MCP.callTool("metabob_fetch_boredom_activities", {...})
        ↓
metabob-cli receives MCP call
        ↓
HTTP GET /api/boredom-activities (with auth headers)
        ↓
metabob-rpc-api receives request
        ↓
SELECT FROM template_metrics WHERE improvement_gradient < 0.7
        ↓
Calculate priorities, categorize
        ↓
Response back through chain
```

---

## Component Responsibilities (Corrected)

### metabob-opencode
**Owns**: UI, sessions, execution state (in-memory only)
**Does**: 
- Execute activities
- Track idle time
- Call MCP tools for all backend operations
**Does NOT**:
- Make HTTP calls directly to backend
- Own any persistent storage
- Implement auth logic

### metabob-cli (MCP Server)
**Owns**: MCP tool definitions, auth, backend integration
**Does**:
- Expose MCP tools to opencode
- Handle authentication to rpc-api
- Proxy requests to rpc-api
- Transform between MCP format and API format
- Implement stateless business logic
**Does NOT**:
- Own database storage
- Execute activities
- Manage UI sessions

### metabob-rpc-api (Backend)
**Owns**: All persistent storage, aggregation logic
**Does**:
- Provide REST/RPC endpoints
- Manage SurrealDB, Redis, PostgreSQL
- Aggregate metrics
- Run background jobs (Celery)
**Does NOT**:
- Know about MCP protocol
- Know about opencode client
- Implement UI logic

---

## Implementation Plan (Corrected)

### Phase 1: Backend API Endpoints (metabob-rpc-api)

**Activities**:
1. `design-surrealdb-schema-rpc-api.json`
   - Define: activity_execution, template_metrics, failure_patterns
   - Create indexes and relationships
   - Design aggregation queries

2. `implement-surrealdb-client-rpc-api.json`
   - SurrealDB connection client
   - Transaction support
   - CRUD operations

3. `add-learning-loop-endpoints-rpc-api.json`
   - POST /api/activity-execution
   - GET /api/boredom-activities
   - GET /api/template-metrics/{id}
   - POST /api/templates (register)

### Phase 2: MCP Tool Updates (metabob-cli)

**Activities**:
4. `update-mcp-post-activity-result.json`
   - Change from JSON file writes
   - To: HTTP POST to rpc-api
   - Add authentication headers
   - Handle response

5. `update-mcp-fetch-boredom-activities.json`
   - Change from JSON file reads
   - To: HTTP GET from rpc-api
   - Transform API response to MCP format
   - Cache with short TTL (optional)

6. `add-mcp-template-management-tools.json`
   - New tool: metabob_register_template
   - New tool: metabob_get_template_metrics
   - All proxy to rpc-api endpoints

### Phase 3: Client Updates (metabob-opencode)

**Activities**:
7. `implement-boredom-execution-opencode.json`
   - Complete executeBoredomActivity()
   - Load template, create activity, execute
   - Monitor for user return, cancel if needed
   - Metrics auto-reported via Activity.complete()

8. `update-template-metrics-client-opencode.json`
   - Keep MCP.callTool() approach
   - NO direct HTTP to rpc-api
   - Ensure all calls go through MCP

9. `add-boredom-manager-tests-opencode.json`
   - Test idle detection
   - Test activity fetch via MCP
   - Test autonomous execution
   - Test cancellation

### Phase 4: Data Migration

**Activities**:
10. `migrate-existing-data-to-surrealdb.json`
    - Read Redis data (via rpc-api endpoint)
    - Read JSON files (temporary script)
    - Transform and insert into SurrealDB
    - Verify integrity

### Phase 5: Testing & Validation

**Activities**:
11. `test-learning-loop-end-to-end.json`
    - Execute activity → verify metrics in SurrealDB
    - Go idle → verify boredom activity triggers
    - Verify metrics update after boredom execution
    - Test concurrent executions
    - Performance testing

---

## MCP Tool Definitions (Updated)

### 1. metabob_post_activity_result

**Purpose**: Report activity execution completion

**MCP Signature**:
```python
@mcp.tool(
    name="metabob_post_activity_result",
    description="Report activity execution result to backend for metrics",
)
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,  # {success, duration, cost, tokens, ...}
    ctx: Context = None,
):
    # NEW: Proxy to API instead of writing to files
    response = await http_client.post(
        f"{API_BASE_URL}/api/activity-execution",
        json={
            "activity_id": activity_id,
            "template_id": result.get("template_id"),
            "success": result["success"],
            "duration": result["duration"],
            "cost": result["cost"],
            "tokens": result.get("tokens"),
            "failure_reason": result.get("failure_reason"),
            "failed_task_id": result.get("failed_task_id"),
            "error_type": result.get("error_type"),
        },
        headers=get_auth_headers(),
    )
    
    if response.status_code == 200:
        return {"success": True, "message": "Metrics reported successfully"}
    else:
        return {"success": False, "error": response.text}
```

### 2. metabob_fetch_boredom_activities

**Purpose**: Fetch low-quality templates for improvement

**MCP Signature**:
```python
@mcp.tool(
    name="metabob_fetch_boredom_activities",
    description="Fetch prioritized activities for idle-time improvement",
)
async def metabob_fetch_boredom_activities(
    max_activities: int = 5,
    priority_threshold: float = 0.6,
    exclude_recent_hours: int = 24,
    ctx: Context = None,
):
    # NEW: Query API instead of reading JSON files
    response = await http_client.get(
        f"{API_BASE_URL}/api/boredom-activities",
        params={
            "max_activities": max_activities,
            "priority_threshold": priority_threshold,
            "exclude_recent_hours": exclude_recent_hours,
        },
        headers=get_auth_headers(),
    )
    
    if response.status_code == 200:
        data = response.json()
        return {
            "status": "success",
            "activities": data["activities"],
            "total_candidates": data["total_candidates"],
        }
    else:
        return {
            "status": "error",
            "error": response.text,
            "activities": [],
        }
```

### 3. metabob_register_template (NEW)

**Purpose**: Register new activity template

**MCP Signature**:
```python
@mcp.tool(
    name="metabob_register_template",
    description="Register activity template with backend",
)
async def metabob_register_template(
    template_id: str,
    template_definition: dict,
    ctx: Context = None,
):
    response = await http_client.post(
        f"{API_BASE_URL}/api/templates",
        json={
            "template_id": template_id,
            "definition": template_definition,
        },
        headers=get_auth_headers(),
    )
    
    if response.status_code == 201:
        return {"success": True, "template_id": template_id}
    else:
        return {"success": False, "error": response.text}
```

---

## API Endpoints (metabob-rpc-api)

### POST /api/activity-execution
**Purpose**: Record activity execution and update metrics

**Request**:
```json
{
  "activity_id": "act_abc123",
  "template_id": "validate-and-fix-docker",
  "success": true,
  "duration": 658300,
  "cost": 1.05,
  "tokens": {
    "input": 327751,
    "output": 2758,
    "cache": 0
  },
  "failure_reason": null,
  "failed_task_id": null,
  "error_type": null
}
```

**Response**:
```json
{
  "success": true,
  "execution_id": "exec_xyz789",
  "metrics_updated": true
}
```

**Implementation**:
```python
@app.post("/api/activity-execution")
async def post_activity_execution(data: ActivityExecutionData):
    # 1. Insert execution record
    execution_id = await db.insert_execution({
        "activity_id": data.activity_id,
        "template_id": data.template_id,
        "success": data.success,
        "duration": data.duration,
        "cost": data.cost,
        "tokens": data.tokens,
        "failure_reason": data.failure_reason,
        "failed_task_id": data.failed_task_id,
        "error_type": data.error_type,
        "timestamp": datetime.utcnow(),
    })
    
    # 2. Update aggregated metrics (in transaction)
    await db.update_template_metrics(data.template_id)
    
    return {
        "success": True,
        "execution_id": execution_id,
        "metrics_updated": True,
    }
```

### GET /api/boredom-activities
**Purpose**: Fetch low-quality templates for improvement

**Query Params**:
- `max_activities`: int (default: 5)
- `priority_threshold`: float (default: 0.6)
- `exclude_recent_hours`: int (default: 24)

**Response**:
```json
{
  "status": "success",
  "activities": [
    {
      "template_id": "low-quality-template",
      "activity_type": "improve-template",
      "priority": 0.85,
      "improvement_gradient": 0.42,
      "reason": "Success rate declining (60% → 40%)",
      "estimated_effort": "30-60 minutes",
      "metrics": {
        "execution_count": 10,
        "success_rate": 0.4,
        "avg_duration": 45000,
        "avg_cost": 0.35
      }
    }
  ],
  "total_candidates": 3
}
```

**Implementation**:
```python
@app.get("/api/boredom-activities")
async def get_boredom_activities(
    max_activities: int = 5,
    priority_threshold: float = 0.6,
    exclude_recent_hours: int = 24,
):
    # Query templates with low improvement_gradient
    cutoff_time = datetime.utcnow() - timedelta(hours=exclude_recent_hours)
    
    templates = await db.query("""
        SELECT *
        FROM template_metrics
        WHERE improvement_gradient < 0.7
          AND (last_execution IS NULL OR last_execution < $cutoff)
        ORDER BY priority DESC
        LIMIT $limit
    """, {"cutoff": cutoff_time, "limit": max_activities})
    
    # Calculate priorities and categorize
    activities = []
    for template in templates:
        activity = categorize_and_prioritize(template)
        if activity["priority"] >= priority_threshold:
            activities.append(activity)
    
    return {
        "status": "success",
        "activities": activities,
        "total_candidates": len(templates),
    }
```

---

## Benefits of MCP-Only Communication

### 1. Single Integration Point
- All auth logic in metabob-cli
- opencode never needs API keys
- Change backend URL in one place

### 2. LLM-Friendly Interface
- Agents use tool calling (familiar pattern)
- No HTTP client code in opencode
- Standard MCP protocol

### 3. Plugin Architecture
- Add new backend: Configure MCP tool, no code changes
- Add new storage: Update cli only, opencode unchanged
- Add authentication: Update cli only

### 4. Clean Separation
- opencode: Execution environment
- cli: Integration layer
- rpc-api: Data layer

### 5. Future-Proof
- New plugins only need MCP tool definitions
- Swap backends without touching opencode
- Add caching/retry in cli layer

---

## Implementation Order

**Week 1: Backend Foundation**
1. Design SurrealDB schema (rpc-api)
2. Implement SurrealDB client (rpc-api)
3. Add API endpoints (rpc-api)

**Week 2: MCP Integration**
4. Update metabob_post_activity_result (cli)
5. Update metabob_fetch_boredom_activities (cli)
6. Add template management tools (cli)

**Week 3: Client Completion**
7. Implement executeBoredomActivity (opencode)
8. Verify TemplateMetricsClient uses MCP (opencode)
9. Add comprehensive tests (opencode)

**Week 4: Migration & Testing**
10. Migrate existing data (one-time script)
11. End-to-end testing (all repos)

---

## Success Criteria

- [ ] All opencode → backend communication goes through MCP
- [ ] No direct HTTP calls from opencode to rpc-api
- [ ] All auth/integration logic in metabob-cli
- [ ] SurrealDB is single source of truth
- [ ] Redis used only for ephemeral data
- [ ] Autonomous boredom execution working
- [ ] All tests passing (100%)
- [ ] No data duplication

