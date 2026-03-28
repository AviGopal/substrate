# Activity Template Data Flow Mapping

**Date**: February 11, 2026  
**Purpose**: Complete trace of data flow from CLI → Backend → Database for activity templates

---

## Executive Summary

Activity templates flow through **v2 endpoints** (`/v2/activities/templates`), not the old v1 endpoints. The CLI code is correctly aligned with the backend v2 API. The registration flow is:

```
metabob-cli register-template 
  → POST /v2/activities/templates (Backend)
    → create_variant() (Server Action)
      → SurrealDB: activity_variants table
        → SurrealDB: variant_performance_metrics table
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLI LAYER (metabob-cli)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  commands.py:register_template()                                           │
│    ├─ Read template JSON file                                              │
│    ├─ Validate required fields (name, description, category, tasks)       │
│    ├─ Build variant_data dict                                              │
│    └─ POST to /v2/activities/templates                                     │
│         Headers: Authorization: Bearer <session_token>                      │
│         Body: TemplateCreateRequest (proto schema)                          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ MCP LAYER (metabob-cli MCP server)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  activity_manager.py:ActivityManager                                       │
│    ├─ search_activities()                                                   │
│    │   └─ GET /activity-recommendations/variants                           │
│    │        (Returns variant metrics for Thompson Sampling)                 │
│    │                                                                         │
│    ├─ get_activity()                                                        │
│    │   └─ GET /activity-recommendations/variants/{id}/details              │
│    │        (Returns full variant with task_steps)                          │
│    │                                                                         │
│    ├─ create_template()                                                     │
│    │   └─ POST /activity-recommendations/variants                          │
│    │        (Creates variant via v2 API)                                    │
│    │                                                                         │
│    ├─ start_execution()                                                     │
│    │   └─ POST /v2/activities/record/start                                 │
│    │                                                                         │
│    └─ _record_outcome()                                                     │
│        └─ POST /v2/activities/record/complete                              │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ BACKEND API LAYER (metabob-rpc-api)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  v2_activities.py Router (/v2/activities)                                  │
│                                                                              │
│  POST /v2/activities/templates                                             │
│    └─ create_template()                                                     │
│        ├─ Extract variant_name, activity_id, description                   │
│        ├─ Convert ProtoTaskStep[] to task_steps[]                          │
│        ├─ Call create_variant(db, variant_data)                            │
│        └─ Return proto ActivityVariant response                             │
│                                                                              │
│  GET /v2/activities/templates                                              │
│    └─ list_templates()                                                      │
│        ├─ Call list_variants(db, limit, offset)                            │
│        ├─ Convert variants to proto format                                  │
│        └─ Return {templates: [...], total, limit, offset}                  │
│                                                                              │
│  GET /v2/activities/templates/{id}                                         │
│    └─ get_template()                                                        │
│        ├─ Call select_best_variant(db, template_id)                        │
│        │   (Thompson Sampling - hidden from client)                         │
│        ├─ Fallback: get_variant(db, template_id)                           │
│        └─ Return proto ActivityVariant                                      │
│                                                                              │
│  POST /v2/activities/record/start                                          │
│    └─ record_execution_start()                                             │
│        ├─ Create execution record                                           │
│        └─ Store in activity_executions table                               │
│                                                                              │
│  POST /v2/activities/record/complete                                       │
│    └─ record_execution_complete()                                          │
│        ├─ Update execution record                                           │
│        ├─ Update Thompson Sampling parameters                              │
│        ├─ Store impulse usage (Phase 2)                                    │
│        └─ Store component changes (Phase 2)                                │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ SERVER ACTIONS LAYER                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  activity_variants.py                                                       │
│                                                                              │
│  create_variant(db, variant_data, auto_hash=True)                          │
│    ├─ compute_content_hash(activity_id, task_steps, variables, prompt)    │
│    │   └─ SHA-256 hash of semantic content                                 │
│    │   └─ Returns 16-char hex prefix                                       │
│    │                                                                         │
│    ├─ generate_variant_id(activity_id, content_hash)                       │
│    │   └─ Format: "{activity_id}-{hash[:8]}"                              │
│    │   └─ Example: "feature-impl-562c3ce9"                                 │
│    │                                                                         │
│    ├─ Check for existing variant (content_hash collision)                  │
│    │   └─ Raises ValueError if duplicate                                   │
│    │                                                                         │
│    ├─ Set defaults (parent_hash, lineage, evolution_type)                  │
│    │                                                                         │
│    ├─ INSERT INTO activity_variants                                        │
│    │   ├─ variant_id (PK)                                                   │
│    │   ├─ activity_id (category)                                           │
│    │   ├─ variant_name                                                     │
│    │   ├─ description                                                       │
│    │   ├─ task_steps[] (proto format)                                      │
│    │   ├─ variables{}                                                       │
│    │   ├─ content_hash                                                      │
│    │   ├─ parent_hash (for genealogy)                                      │
│    │   ├─ lineage[] (ancestry chain)                                       │
│    │   ├─ evolution_type (root|derived|optimized|merged)                   │
│    │   ├─ version                                                           │
│    │   ├─ status (testing|active|deprecated)                               │
│    │   └─ created_at (auto: time::now())                                   │
│    │                                                                         │
│    └─ INSERT INTO variant_performance_metrics                              │
│        ├─ variant_id (FK)                                                   │
│        ├─ activity_id                                                       │
│        ├─ total_impressions (0)                                            │
│        ├─ total_selections (0)                                             │
│        ├─ total_conversions (0)                                            │
│        ├─ conversion_rate (0.0)                                            │
│        ├─ thompson_alpha (1.0) ← Prior belief                              │
│        ├─ thompson_beta (1.0)  ← Prior belief                              │
│        └─ created_at, updated_at (auto)                                    │
│                                                                              │
│  get_variant(db, variant_id)                                               │
│    └─ SELECT * FROM activity_variants WHERE variant_id = $vid             │
│                                                                              │
│  list_variants(db, activity_id=None, limit=50, offset=0)                  │
│    └─ SELECT * FROM activity_variants                                      │
│        WHERE activity_id = $aid (if provided)                              │
│        ORDER BY created_at DESC                                            │
│        LIMIT $limit OFFSET $offset                                          │
│                                                                              │
│  get_variant_metrics(db, variant_id)                                       │
│    └─ SELECT * FROM variant_performance_metrics                            │
│        WHERE variant_id = $vid                                              │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ DATABASE LAYER (SurrealDB)                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Table: activity_variants                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│    DEFINE TABLE activity_variants SCHEMAFULL                               │
│                                                                              │
│    Fields:                                                                  │
│      variant_id: string (PK, indexed)                                      │
│      activity_id: string (indexed) - category/type                         │
│      variant_name: string                                                   │
│      description: string                                                    │
│      version: int DEFAULT 1                                                │
│      task_steps: array<object> - ProtoTaskStep format                      │
│      variables: object - Variable definitions                              │
│      context_requirements: array                                           │
│      content_hash: string (indexed) - SHA-256 hash                         │
│      parent_hash: option<string> - Parent variant_id                       │
│      lineage: array<string> - Ancestry chain                               │
│      evolution_type: string - root|derived|optimized|merged                │
│      evolution_note: string                                                 │
│      prompt_strategy: string DEFAULT "guided"                              │
│      status: string DEFAULT "testing"                                      │
│      execution_config: object                                               │
│      optimization_config: object                                            │
│      created_at: datetime DEFAULT time::now()                              │
│      updated_at: datetime                                                   │
│      created_by: option<string> - user_id                                  │
│                                                                              │
│    Indexes:                                                                 │
│      DEFINE INDEX idx_variant_id ON activity_variants (variant_id)        │
│      DEFINE INDEX idx_activity_id ON activity_variants (activity_id)      │
│      DEFINE INDEX idx_content_hash ON activity_variants (content_hash)    │
│      DEFINE INDEX idx_status ON activity_variants (status)                │
│                                                                              │
│  Table: variant_performance_metrics                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│    DEFINE TABLE variant_performance_metrics SCHEMAFULL                     │
│                                                                              │
│    Fields:                                                                  │
│      variant_id: string (PK, FK to activity_variants)                      │
│      activity_id: string                                                    │
│      total_impressions: int - Times shown to user                          │
│      total_selections: int - Times selected                                │
│      total_conversions: int - Times succeeded                              │
│      conversion_rate: float                                                 │
│      expected_value: float - Thompson Sampling UCB                         │
│      avg_duration_ms: int                                                   │
│      avg_cost: float                                                        │
│      avg_quality_score: float                                               │
│      thompson_alpha: float DEFAULT 1.0 - Success count + prior             │
│      thompson_beta: float DEFAULT 1.0 - Failure count + prior              │
│      last_updated: datetime                                                 │
│      created_at: datetime DEFAULT time::now()                              │
│                                                                              │
│  Table: activity_executions                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│    Stores execution records for learning                                   │
│                                                                              │
│    Fields:                                                                  │
│      execution_id: string (PK)                                              │
│      session_id: string                                                     │
│      variant_id: string (FK to activity_variants)                          │
│      activity_id: string                                                    │
│      status: string - running|completed|failed                             │
│      success: bool                                                          │
│      duration_ms: int                                                       │
│      cost: float                                                            │
│      tokens: int                                                            │
│      step_results: array<object>                                            │
│      outcome: string                                                        │
│      started_at: datetime                                                   │
│      completed_at: datetime                                                 │
│      impulses_used: array<object> - Phase 2                                │
│      component_changes: array<object> - Phase 2                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Endpoint Mapping

### V2 Endpoints (Current / Correct)

| Endpoint | Method | Purpose | CLI Function | Backend Handler |
|----------|--------|---------|--------------|-----------------|
| `/v2/activities/templates` | POST | Register template | `register_template()` | `create_template()` → `create_variant()` |
| `/v2/activities/templates` | GET | List templates | N/A | `list_templates()` → `list_variants()` |
| `/v2/activities/templates/{id}` | GET | Get template | N/A | `get_template()` → `get_variant()` |
| `/v2/activities/record/start` | POST | Start execution | `start_execution()` | `record_execution_start()` |
| `/v2/activities/record/step` | POST | Record step | `report_step_result()` | `record_execution_step()` |
| `/v2/activities/record/complete` | POST | Complete execution | `_record_outcome()` | `record_execution_complete()` |
| `/v2/activities/mutate/derive` | POST | Derive variant | `derive_template()` | `derive_variant_endpoint()` |
| `/v2/activities/mutate/lineage/{id}` | GET | Get lineage | `get_template_lineage()` | `get_lineage_endpoint()` |

### V1 Endpoints (Legacy / Deprecated for Templates)

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/activity-recommendations/variants` | GET | List variant metrics | Used for Thompson Sampling selection |
| `/activity-recommendations/variants/{id}/details` | GET | Get variant details | Returns full variant with steps |
| `/activities` | POST/GET | Activity events (NOT templates) | Different concept - event logging |

### Important Distinction

**Activity Events** (`/activities`) ≠ **Activity Templates** (`/v2/activities/templates`)

- **Activity Events**: User actions, analysis runs, sync operations (analytics/logging)
- **Activity Templates**: Reusable workflow definitions with tasks and validation

---

## Data Flow: Template Registration

### Step 1: CLI Command

```bash
metabob-cli register-template my-template.json
```

**File**: `repos/metabob-cli/src/metabob_cli/commands.py`

```python
@click.command(name="register-template")
def register_template(template_file: str, base_url: str, status: str, quiet: bool):
    # Read JSON file
    with open(template_file, "r") as f:
        template_data = json.load(f)
    
    # Validate required fields
    required = ["name", "description", "category"]
    missing = [f for f in required if f not in template_data]
    if missing:
        raise ClickException(f"Missing fields: {missing}")
    
    # Build variant data
    variant_data = {
        "name": template_data["name"],
        "description": template_data["description"],
        "category": template_data["category"],
        "tasks": template_data["tasks"],  # ProtoTaskStep format
        "variables": template_data.get("variables", {}),
        "context_requirements": template_data.get("context_requirements", []),
    }
    
    # POST to v2 API
    response = httpx.post(
        f"{base_url}/v2/activities/templates",
        json=variant_data,
        headers={"Authorization": f"Bearer {session_token}"},
    )
    
    if response.status_code in [200, 201]:
        result = response.json()
        template_id = result.get("variant_id")
        click.echo(f"Successfully registered: {template_id}")
    else:
        click.echo(f"Failed: {response.status_code}")
```

### Step 2: Backend API Handler

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

```python
@router.post("/templates")
async def create_template(
    template: TemplateCreateRequest,
    credentials: HTTPAuthorizationCredentials = Security(SESSION_TOKEN),
    db: SurrealDBClient = Depends(get_surreal_connection),
):
    """Create new activity template"""
    
    # Extract session token and validate
    session = await get_authenticated_session(request, credentials, redis)
    
    # Generate activity_id from category
    activity_id = template.category  # e.g., "feature", "bugfix"
    
    # Build variant_data
    variant_data = {
        "activity_id": activity_id,
        "variant_name": template.name,
        "description": template.description,
        "task_steps": [task.model_dump() for task in template.tasks],
        "variables": template.variables,
        "context_requirements": template.context_requirements,
        "created_by": session.user_id,
    }
    
    # Call server action
    variant = await create_variant(db, variant_data, auto_hash=True)
    
    # Return proto response
    return proto_response(variant_to_proto_dict(variant), status_code=201)
```

### Step 3: Server Action

**File**: `repos/metabob-rpc-api/server/actions/activity_variants.py`

```python
async def create_variant(db: SurrealDBClient, variant_data: dict, auto_hash=True):
    """Create variant with content hashing"""
    
    # Compute content hash (genealogy)
    content_hash = compute_content_hash(
        variant_data["activity_id"],
        variant_data["task_steps"],
        variant_data["variables"],
        variant_data.get("prompt_strategy", "guided"),
    )
    # SHA-256 → 16-char hex: "562c3ce9d4a1b8f2"
    
    # Generate variant_id
    variant_id = generate_variant_id(
        variant_data["activity_id"],
        content_hash,
    )
    # Format: "feature-562c3ce9"
    
    variant_data["content_hash"] = content_hash
    variant_data["variant_id"] = variant_id
    
    # Check for duplicates
    existing = await db.query(
        "SELECT variant_id FROM activity_variants WHERE variant_id = $vid",
        {"vid": variant_id},
    )
    if existing:
        raise ValueError(f"Variant exists: {variant_id}")
    
    # Set genealogy defaults
    variant_data.setdefault("parent_hash", None)
    variant_data.setdefault("lineage", [])
    variant_data.setdefault("evolution_type", "root")
    variant_data.setdefault("version", 1)
    variant_data.setdefault("status", "testing")
    
    # Insert into database
    result = await db.create("activity_variants", variant_data)
    
    # Initialize Thompson Sampling metrics
    metrics_data = {
        "variant_id": variant_id,
        "activity_id": variant_data["activity_id"],
        "total_impressions": 0,
        "total_selections": 0,
        "total_conversions": 0,
        "thompson_alpha": 1.0,  # Prior: 1 success
        "thompson_beta": 1.0,   # Prior: 1 failure
    }
    await db.create("variant_performance_metrics", metrics_data)
    
    return ActivityVariant(**result)
```

### Step 4: Database Storage

**SurrealDB Query**:

```surql
-- Insert variant
CREATE activity_variants CONTENT {
  variant_id: "feature-562c3ce9",
  activity_id: "feature",
  variant_name: "Add REST Endpoint",
  description: "Creates a new REST API endpoint with tests",
  version: 1,
  task_steps: [
    {
      id: "task-1",
      subagent: "coder",
      description: "Create endpoint handler",
      prompt: {
        template: "Create a new REST endpoint...",
        max_tokens: 8000
      },
      validation: {},
      retry: { max_attempts: 3, strategy: "exponential" }
    }
  ],
  variables: {},
  content_hash: "562c3ce9d4a1b8f2",
  parent_hash: NULL,
  lineage: [],
  evolution_type: "root",
  status: "testing",
  created_at: time::now()
};

-- Initialize metrics
CREATE variant_performance_metrics CONTENT {
  variant_id: "feature-562c3ce9",
  activity_id: "feature",
  total_impressions: 0,
  total_selections: 0,
  total_conversions: 0,
  thompson_alpha: 1.0,
  thompson_beta: 1.0,
  created_at: time::now()
};
```

---

## Data Flow: Template Search

### Step 1: MCP Tool Call

```python
# In OpenCode session
search_activities({ category: "feature", limit: 10 })
```

### Step 2: ActivityManager

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
async def search_activities(
    self,
    query: str = "",
    category: Optional[str] = None,
    limit: int = 20,
):
    """Search for activity templates"""
    
    client = await self._get_client()
    
    params = {"limit": limit, "offset": 0}
    if query:
        params["query"] = query
    if category:
        params["category"] = category
    
    # GET /activity-recommendations/variants (v1 endpoint)
    response = await client.get(
        "/activity-recommendations/variants",
        params=params,
    )
    
    if response.status_code == 200:
        data = response.json()
        templates = data.get("templates", [])
        
        # Convert proto format to internal format
        return [
            {
                "id": t.get("variant_id"),
                "name": t.get("variant_name"),
                "description": t.get("description"),
                "category": t.get("activity_id"),
                "task_count": len(t.get("task_steps", [])),
                "success_rate": t.get("expected_quality_score", 0),
            }
            for t in templates
        ]
    
    return []
```

### Step 3: Backend Handler (v1 endpoint - for metrics)

**File**: `repos/metabob-rpc-api/server/routes/activity_recommendations.py`

```python
@router.get("/activity-recommendations/variants")
async def list_variant_metrics(
    activity_id: Optional[str] = None,
    sort_by: Optional[str] = "expected_value",
    limit: int = Query(50, le=200),
):
    """List variant performance metrics (Thompson Sampling)"""
    
    # Query variants with metrics
    query = """
        SELECT
            v.*,
            m.thompson_alpha,
            m.thompson_beta,
            m.expected_value,
            m.conversion_rate
        FROM activity_variants v
        INNER JOIN variant_performance_metrics m
            ON v.variant_id = m.variant_id
        WHERE v.status = 'active'
        ORDER BY m.expected_value DESC
        LIMIT $limit
    """
    
    results = await db.query(query, {"limit": limit})
    
    # Return proto format
    return {"templates": [variant_to_proto(r) for r in results]}
```

---

## Data Flow: Template Execution

### Step 1: Start Execution

```python
await activity_manager.start_execution(
    activity_id="feature-562c3ce9",
    session_id="sess_abc123",
    variables={"endpoint_path": "/api/users"},
    cost_budget=1.0,
)
```

### Step 2: Record Start

**POST** `/v2/activities/record/start`

```json
{
  "template_id": "feature-562c3ce9",
  "variables": {"endpoint_path": "/api/users"},
  "session_id": "sess_abc123",
  "execution_id": "exec_def456"
}
```

**Database**:

```surql
CREATE activity_executions CONTENT {
  execution_id: "exec_def456",
  session_id: "sess_abc123",
  variant_id: "feature-562c3ce9",
  activity_id: "feature",
  status: "running",
  started_at: time::now(),
  variables: {endpoint_path: "/api/users"}
};
```

### Step 3: Record Completion

**POST** `/v2/activities/record/complete`

```json
{
  "execution_id": "exec_def456",
  "success": true,
  "duration_ms": 45000,
  "cost": 0.25,
  "tokens": 15000,
  "outcome": "success",
  "step_results": [...]
}
```

**Database Updates**:

```surql
-- Update execution record
UPDATE activity_executions:exec_def456 SET {
  status: "completed",
  success: true,
  duration_ms: 45000,
  cost: 0.25,
  tokens: 15000,
  completed_at: time::now()
};

-- Update Thompson Sampling parameters
UPDATE variant_performance_metrics
SET
  total_conversions = total_conversions + 1,
  thompson_alpha = thompson_alpha + 1,  -- Success!
  conversion_rate = total_conversions / total_selections,
  avg_cost = (avg_cost * (total_conversions - 1) + 0.25) / total_conversions,
  last_updated = time::now()
WHERE variant_id = "feature-562c3ce9";
```

---

## Schema Alignment: Proto Format

### ProtoTaskStep Format

Templates now use `task_steps[]` with proto schema:

```json
{
  "id": "task-1",
  "subagent": "coder",  // NOT "type" or "agent_mode"
  "description": "Create endpoint handler",
  "prompt": {  // Nested object, NOT "prompt_template" string
    "template": "Create a new REST endpoint for {{endpoint_path}}...",
    "max_tokens": 8000,
    "temperature": 0.7
  },
  "impulse_refs": [  // Phase 2: Learning system
    {
      "impulse_id": "imp_123",
      "required": true,
      "usage_hint": "API design patterns"
    }
  ],
  "validation": {
    "required_files": ["tests/test_endpoint.py"],
    "required_patterns": ["def test_"],
    "commands": ["pytest tests/test_endpoint.py"]
  },
  "retry": {
    "max_attempts": 3,
    "strategy": "exponential"
  },
  "tools": ["Read", "Write", "Shell"]
}
```

### Old Format (Deprecated)

```json
{
  "order": 0,  // REMOVED: Not content-addressable
  "type": "coder",  // CHANGED: Now "subagent"
  "agent_mode": "general",  // REMOVED: Redundant
  "prompt_template": "Create endpoint...",  // CHANGED: Now nested "prompt"
  "validation": {...},
  "cost_budget": 0.5
}
```

---

## Authentication Flow

### Session Token

```
1. CLI: metabob-cli login
   └─ POST /v2/session/create
      └─ Returns: {session_token: "tok_abc123", session_id: "sess_xyz"}

2. CLI: Store token in ~/.metabob/session.json

3. CLI: Every API call includes:
   Headers: {
     "Authorization": "Bearer tok_abc123"
   }

4. Backend: Validate token via Redis
   └─ GET redis:session:tok_abc123
      └─ Returns: SessionData{user_id, org_id, expires_at}
```

---

## Current Status

### ✅ What's Working

1. **V2 API endpoints exist**:
   - POST `/v2/activities/templates` - Template registration
   - GET `/v2/activities/templates` - List templates
   - GET `/v2/activities/templates/{id}` - Get template
   - POST `/v2/activities/record/*` - Execution tracking

2. **CLI is aligned**:
   - `register-template` uses correct v2 endpoint
   - ActivityManager uses v2 recording endpoints
   - Proto schema properly implemented

3. **Database schema**:
   - `activity_variants` table with genealogy
   - `variant_performance_metrics` with Thompson Sampling
   - `activity_executions` for learning

### ⚠️ What Needs Testing

1. **Authentication**:
   - Session token creation/validation
   - Bearer token propagation
   - API key vs session token

2. **End-to-end flow**:
   - Register template → Store in DB
   - Search templates → Return from DB
   - Execute template → Record outcome → Update metrics

3. **Proto format validation**:
   - ProtoTaskStep structure
   - impulse_refs (Phase 2)
   - component_changes (Phase 2)

---

## Testing Plan

### Test 1: Template Registration

```bash
# Create template file
cat > /tmp/test-template.json <<EOF
{
  "name": "Test Activity",
  "description": "Simple test activity",
  "category": "feature",
  "variables": {},
  "context_requirements": [],
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Echo test message",
      "prompt": {
        "template": "Echo: Hello World",
        "max_tokens": 1000
      },
      "validation": {},
      "retry": {
        "max_attempts": 3,
        "strategy": "exponential"
      }
    }
  ]
}
EOF

# Register via CLI
metabob-cli register-template /tmp/test-template.json

# Expected: Success with variant_id returned
```

### Test 2: Database Verification

```bash
# Query SurrealDB directly
curl -X POST http://localhost:8000/sql \
  -u root:root \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -d "SELECT * FROM activity_variants WHERE variant_name = 'Test Activity';"

# Expected: Variant record with task_steps, content_hash, etc.
```

### Test 3: Search Templates

```bash
# Via MCP (in OpenCode session)
search_activities({ category: "feature" })

# Expected: List including our test activity
```

### Test 4: Execute Activity

```bash
# Via activity tool
activity({
  activityId: "feature-<hash>",
  variables: {},
  reason: "Test execution"
})

# Expected: Activity executes, outcome recorded in DB
```

---

## Troubleshooting Guide

### Issue: 404 on register-template

**Cause**: Missing session token or v2 endpoints not mounted

**Fix**:
```bash
# 1. Check if v2 router is registered
grep "v2_activities" repos/metabob-rpc-api/server/main.py

# 2. Verify session token
metabob-cli config

# 3. Check API is running
curl http://localhost:8080/
```

### Issue: Authentication failed

**Cause**: Session token expired or invalid

**Fix**:
```bash
# Re-authenticate
metabob-cli login

# Check session
cat ~/.metabob/session.json
```

### Issue: Template not found after registration

**Cause**: Database connection or variant_id mismatch

**Fix**:
```surql
-- Check SurrealDB tables
INFO FOR DB;

-- List all variants
SELECT variant_id, variant_name FROM activity_variants;

-- Check metrics
SELECT * FROM variant_performance_metrics;
```

---

## Next Steps

1. ✅ **Authentication Setup**
   - Create session via `/v2/session/create`
   - Store token in CLI
   - Test Bearer auth on all endpoints

2. ✅ **Register Test Template**
   - Use proto schema format
   - Verify database storage
   - Check content_hash generation

3. ✅ **Execute Template**
   - Start execution
   - Complete steps
   - Record outcome

4. ✅ **Verify Learning Loop**
   - Check Thompson Sampling updates
   - Verify conversion tracking
   - Test variant selection

---

**Last Updated**: February 11, 2026  
**Next Action**: Create session token and test template registration end-to-end
