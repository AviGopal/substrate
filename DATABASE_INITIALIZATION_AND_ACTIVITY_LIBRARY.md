# Database Initialization and Activity Library Architecture

## Overview

This document explains how to initialize the database and how organizations and projects interact with the activity template library in the metabob-devbob system.

---

## Database Initialization

### Two Primary Methods

#### 1. **Docker/Local Development** (via `init-database.sh`)

**Location**: `scripts/init-database.sh`

**What it does**:
1. Initializes schema version tracking table
2. Creates activity system schema (activity_template, activity_execution tables)
3. Creates authentication system schema (users, organizations, sessions)
4. Loads bootstrap activity templates from `repos/metabob-proto/activities/bootstrap/`
5. Verifies database state

**Usage**:
```bash
./scripts/init-database.sh
```

**Prerequisites**:
- Docker Compose must be running
- `metabob-rpc-api-server` container must be active
- SurrealDB must be accessible from the API container

**What gets created**:
- `activity_template` table (stores all activity templates)
- `activity_execution` table (records execution history)
- `vessel_registry` table (tracks distributed DevBob pods)
- Auth tables (users, organizations, sessions)
- Schema version tracking

---

#### 2. **Kubernetes Deployment** (via `init-schema-k8s.sh`)

**Location**: `scripts/init-schema-k8s.sh`

**What it does**:
1. Copies SQL schema file to a K8s pod
2. Executes schema initialization via SurrealDB CLI
3. Verifies table creation

**Usage**:
```bash
./scripts/init-schema-k8s.sh [namespace] [pod] [surrealdb-host]

# Example:
./scripts/init-schema-k8s.sh metabob devbob-0 surrealdb:8000
```

**Prerequisites**:
- Kubernetes cluster with metabob namespace deployed
- DevBob pods running with SurrealDB access
- `kubectl` configured with cluster access

---

### Schema Files

Two versions exist:

1. **`init-surrealdb-devbob-schema.sql`** - Full schema with org/project scoping
   - Includes `scope` field (org/project/global)
   - Includes `org_id` field for multi-tenant isolation
   - Used for production multi-tenant deployments

2. **`init-surrealdb-devbob-schema-v2.sql`** - Simplified schema
   - Basic activity_template and activity_execution tables
   - No explicit scope/org_id enforcement
   - Used for single-tenant or development environments

---

## Activity Template Storage Architecture

### Three-Tier Model

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT MACHINES                          │
│  (metabob-opencode + metabob-cli + backend base URL)        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ MCP (Model Context Protocol)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (metabob-rpc-api)                      │
│  • Template selection & learning                            │
│  • Multi-tenant isolation enforcement                       │
│  • Thompson Sampling for variant selection                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Primary Storage + Cache
                 ▼
┌────────────────────────────────┬────────────────────────────┐
│      SURREALDB (Primary)       │    REDIS (Cache, TTL)      │
│  • activity_template table     │  • activity:template:{id}  │
│  • activity_execution table    │  • activity:metrics:{id}   │
│  • Persistent storage          │  • Fast read path          │
└────────────────────────────────┴────────────────────────────┘
```

### Storage Specifications

#### **SurrealDB** (Primary, Source of Truth)
- **Write path**: Always write to SurrealDB first
- **Tables**:
  - `activity_template` - Template definitions
  - `activity_execution` - Execution records for learning
- **Fields**:
  - `id` - Template ID (e.g., "add-feature-complete")
  - `name` - Human-readable name
  - `description` - What the template does
  - `category` - feature/bugfix/refactor/tool/infrastructure
  - `tasks` - Array of task definitions
  - `scope` - "global" / "org" / "project" (v1 schema)
  - `org_id` - Organization identifier (v1 schema)
  - `created_at`, `updated_at` - Timestamps

#### **Redis** (Cache, Performance Layer)
- **Read path**: Check Redis first, fallback to SurrealDB
- **Keys**:
  - `activity:template:{variant_id}` - Cached template JSON (TTL)
  - `activity:metrics:{variant_id}` - Performance metrics (TTL)
  - `activity:templates:list` - Set of all variant IDs (TTL)
- **TTL**: Templates cached for fast retrieval, auto-expire

---

## Multi-Tenant Isolation: Organizations and Projects

### Scope-Based Access Control

Templates have three visibility scopes:

#### 1. **Global Templates** (`scope='global'` or `scope=null`)
- **Visible to**: Everyone (all organizations, all projects)
- **Examples**: Core system templates (create-activity, evolve-activity, debug-activity)
- **Stored in**: `metabob-proto/activities/bootstrap/` for initialization
- **Use case**: Universal patterns that apply to all users

#### 2. **Organization Templates** (`scope='org'`)
- **Visible to**: All users and projects within the same organization
- **Isolation**: `template.org_id` must match `user.org_id`
- **Use case**: Company-specific workflows, internal patterns
- **Example**: "acme-corp-deployment-pattern" only visible to ACME Corp users

#### 3. **Project Templates** (`scope='project'`)
- **Visible to**: Only the specific project
- **Isolation**: `template.project_id` must match `user.project_id`
- **Use case**: Project-specific customizations
- **Example**: "webapp-v2-build-pipeline" only for that project

---

### Query Filtering Logic

When a user queries `GET /v2/activities/templates`:

```python
# Pseudo-code from validation harness
def filter_templates(user_context, all_templates):
    results = []
    
    for template in all_templates:
        # Rule 1: Global templates always visible
        if template.scope in [None, 'global']:
            results.append(template)
        
        # Rule 2: Org templates visible if org matches
        elif template.scope == 'org' and template.org_id == user_context.org_id:
            results.append(template)
        
        # Rule 3: Project templates visible if project matches
        elif template.scope == 'project' and template.project_id == user_context.project_id:
            results.append(template)
    
    return results
```

**Security Properties**:
- ✅ User A (Org 1) cannot see User B's (Org 2) org-scoped templates
- ✅ Project X cannot see Project Y's project-scoped templates
- ✅ Global templates are shared across all organizations
- ✅ Unauthenticated requests only see global templates

---

## How Organizations/Projects Use Activity Templates

### 1. **Template Registration** (Creating Templates)

**Endpoint**: `POST /v2/activities/templates`

**Request Body**:
```json
{
  "name": "Deploy to Production",
  "description": "Deploy application to production environment",
  "category": "infrastructure",
  "scope": "org",  // Optional: defaults to "org" if not specified
  "tasks": [ /* task definitions */ ]
}
```

**Backend Processing** (in `server/actions/activity.py`):
1. Extract `org_id` from authenticated user's token
2. Generate `template_id` from name ("deploy-to-production")
3. Generate `variant_id` with content hash ("deploy-to-production-a8b3f2c1")
4. Write to SurrealDB with `scope` and `org_id` fields
5. Cache in Redis for fast retrieval
6. Initialize Thompson Sampling metrics (alpha=1, beta=1)

**Result**: Template is now available to all users in the same organization

---

### 2. **Template Discovery** (Finding Templates)

**Endpoint**: `GET /v2/activities/templates?category=feature&limit=50`

**Backend Processing**:
1. Extract `org_id` from user's auth token
2. Query SurrealDB with multi-tenant filters
3. Apply scope-based filtering (global + matching org + matching project)
4. Enrich with Thompson Sampling metrics (success_rate, quality_score)
5. Sort by expected value (success_rate × quality_score)
6. Return filtered, sorted list

**Response**:
```json
{
  "templates": [
    {
      "variant_id": "add-feature-complete-a8b3f2c1",
      "name": "Add Feature (Complete)",
      "category": "feature",
      "scope": "global",
      "success_rate": 0.92,
      "quality_score": 4.5,
      "execution_count": 47
    },
    {
      "variant_id": "acme-feature-workflow-b9d4e3f2",
      "name": "ACME Feature Workflow",
      "category": "feature",
      "scope": "org",
      "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
      "success_rate": 0.87,
      "quality_score": 4.2,
      "execution_count": 12
    }
  ]
}
```

---

### 3. **Template Execution** (Using Templates)

**OpenCode CLI Flow**:
```typescript
// In metabob-opencode packages
Activity.execute({
  templateId: "add-feature-complete",
  variables: {
    featureName: "user authentication",
    files: ["src/auth.ts"]
  }
})
```

**Behind the Scenes**:
1. **OpenCode** → **MCP** → **metabob-cli** → **Backend API**
2. Backend retrieves template (Redis cache or SurrealDB)
3. Backend enforces access control (scope + org_id validation)
4. Template returned to CLI
5. CLI streams template to OpenCode
6. OpenCode executes tasks sequentially
7. Results reported back to backend for learning

---

### 4. **Learning & Metrics** (Thompson Sampling)

**When execution completes**:

**Endpoint**: `POST /v2/activities/executions/{execution_id}/complete`

**Request Body**:
```json
{
  "success": true,
  "duration_ms": 45000,
  "cost": 0.23,
  "tokens": { "input": 12500, "output": 850, "cache": 3200 }
}
```

**Backend Processing** (Thompson Sampling Update):
```python
# In server/db/operations.py
def update_metrics_after_execution(variant_id, success, duration_ms, cost):
    metrics = get_metrics(variant_id)
    
    # Thompson Sampling: Update Beta distribution parameters
    if success:
        metrics.alpha += 1  # Successes
    else:
        metrics.beta += 1   # Failures
    
    # Update aggregated metrics
    metrics.execution_count += 1
    metrics.success_rate = metrics.alpha / (metrics.alpha + metrics.beta)
    metrics.avg_duration_ms = update_moving_average(metrics.avg_duration_ms, duration_ms)
    metrics.avg_cost = update_moving_average(metrics.avg_cost, cost)
    
    # Save to SurrealDB and update Redis cache
    save_metrics(variant_id, metrics)
```

**Effect**: Over time, better-performing templates are selected more frequently by Thompson Sampling algorithm.

---

## Template Lifecycle

### 1. **Bootstrap Phase** (Initial Setup)

**Source**: `repos/metabob-proto/activities/bootstrap/*.json`

**Trigger**: `./scripts/init-database.sh` or manual seeding

**Templates Loaded**:
- `create-activity` - Create new activity templates
- `evolve-activity` - Improve existing templates based on metrics
- `debug-activity` - Debug failed activity executions
- `add-feature-complete` - Add features with tests and commits
- `fix-bug-complete` - Fix bugs with validation and documentation
- `refactor-with-tests` - Refactor code with test coverage
- ... (20+ core templates)

**Properties**:
- All marked as `scope='global'`
- No `org_id` or `project_id` (visible to everyone)
- Initialized with Thompson Sampling priors (alpha=1, beta=1)

---

### 2. **Organization Adoption** (Custom Templates)

**Scenario**: ACME Corp wants their own deployment pattern

**Steps**:
1. ACME developer authenticates → Gets token with `org_id`
2. Creates template via `POST /v2/activities/templates` with `scope='org'`
3. Backend extracts `org_id` from token and stores template
4. Template now available to all ACME developers
5. Other organizations cannot see or use this template

**Benefit**: Organizations can build proprietary workflows without exposing them

---

### 3. **Project Customization** (Project Templates)

**Scenario**: Project "webapp-v2" needs specialized build steps

**Steps**:
1. Developer working on webapp-v2 creates template with `scope='project'`
2. Backend extracts `project_id` from context and stores template
3. Template only visible within webapp-v2 project
4. Other projects in same organization cannot see it

**Benefit**: Project-specific customizations without polluting org-wide template library

---

### 4. **Variant Evolution** (Learning Over Time)

**Scenario**: Template "add-feature-complete" is failing 30% of the time

**Automatic Process**:
1. Backend tracks all executions and metrics
2. Thompson Sampling detects degrading success rate
3. `evolve-activity` template can be triggered (manually or automatically)
4. New variant created: "add-feature-complete-v2" with improved prompts
5. Both variants compete via Thompson Sampling
6. Better variant gets selected more frequently over time
7. Poor variant naturally phases out

**Key Insight**: No manual A/B testing needed - Thompson Sampling handles exploration/exploitation automatically

---

## Client Machine Architecture

### Minimal Local Storage

**What clients DO NOT store**:
- ❌ Full activity template definitions
- ❌ Template execution history
- ❌ Metrics and learning data
- ❌ Organization/project metadata

**What clients DO store** (cache only):
- ✅ `.metabob/` directory - Local cache of recently used templates (TTL)
- ✅ `~/.config/metabob-cli/` - CLI configuration (backend base URL, auth)
- ✅ Temporary impulse data for active sessions

**Required on Client**:
1. **metabob-opencode** (fork) - Activity execution engine
2. **metabob-cli** - MCP client for backend communication
3. **Configuration**: Backend base URL in `opencode.json`

```json
// opencode.json (minimal config)
{
  "mcp": {
    "metabob": {
      "type": "remote",
      "url": "https://backend.example.com",
      "enabled": true
    }
  }
}
```

---

## Data Flow Summary

### Template Registration Flow
```
Developer
  → POST /v2/activities/templates (with org_id in token)
  → Backend extracts org_id and scope
  → SurrealDB.insert(template, org_id, scope)
  → Redis.cache(template, TTL)
  → Return variant_id
```

### Template Discovery Flow
```
Developer
  → GET /v2/activities/templates?category=feature
  → Backend extracts org_id from token
  → SurrealDB.query(WHERE scope='global' OR (scope='org' AND org_id=user.org_id))
  → Redis.check_cache() → If miss, populate from SurrealDB
  → Enrich with Thompson Sampling metrics
  → Return filtered + sorted templates
```

### Template Execution Flow
```
OpenCode
  → activity({ templateId, variables })
  → MCP → metabob-cli
  → GET /v2/activities/templates/{templateId} (with org_id in token)
  → Backend validates access (scope + org_id)
  → Return template definition
  → OpenCode executes tasks
  → POST /v2/activities/executions/{id}/complete
  → Backend updates Thompson Sampling metrics
```

---

## Security & Isolation Guarantees

### Multi-Tenant Isolation
✅ **Organization A cannot see Organization B's templates**
- Enforced via `scope='org'` + `org_id` matching
- Backend validates on every query
- Validation harness: `activity-template-query-filtering-harness.ts`

✅ **Project X cannot see Project Y's templates**
- Enforced via `scope='project'` + `project_id` matching
- Even within same organization

✅ **Unauthenticated users only see global templates**
- No token = only `scope='global'` or `scope=null`

✅ **Token-based authentication**
- JWT tokens encode `org_id` and `project_id`
- Backend extracts and validates on every request

---

## Common Operations

### Initialize Fresh Database
```bash
# Local/Docker
./scripts/init-database.sh

# Kubernetes
./scripts/init-schema-k8s.sh metabob devbob-0 surrealdb:8000
```

### Register Org-Scoped Template
```bash
curl -X POST https://backend.example.com/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company Workflow",
    "description": "Company-specific deployment pattern",
    "category": "infrastructure",
    "scope": "org",
    "tasks": [ /* ... */ ]
  }'
```

### Query Templates for User
```bash
curl https://backend.example.com/v2/activities/templates?category=feature&limit=20 \
  -H "Authorization: Bearer $TOKEN"
```

### Execute Activity Template
```typescript
// In OpenCode session
await activity({
  templateId: "add-feature-complete",
  variables: {
    featureName: "user authentication",
    files: ["src/auth.ts", "src/middleware/auth.ts"]
  },
  reason: "Implement JWT-based authentication for API endpoints"
})
```

---

## References

### Key Files
- **Schema**: `scripts/init-surrealdb-devbob-schema.sql`
- **Init Script**: `scripts/init-database.sh`
- **Activity Actions**: `repos/metabob-rpc-api/server/actions/activity.py`
- **DB Operations**: `repos/metabob-rpc-api/server/db/operations.py`
- **Validation**: `tests/validation-harnesses/activity-template-query-filtering-harness.ts`

### Activity Templates
- **Initialize Database**: `initialize-database-schema-in-kubernetes`
- **Trace & Enforce**: `trace-enforce-validate-loop`
- **Template Management**: `create-activity`, `evolve-activity`, `debug-activity`

---

## Conclusion

The database initialization and activity library architecture follows these principles:

1. **Centralized Storage**: All templates stored in backend (SurrealDB primary, Redis cache)
2. **Multi-Tenant Isolation**: Scope-based access control (global/org/project)
3. **Client Simplicity**: Clients only need MCP client + backend URL
4. **Learning System**: Thompson Sampling automatically improves template selection
5. **Variant Competition**: Multiple template versions compete based on performance
6. **Security First**: Token-based authentication with org/project validation on every request

This architecture enables:
- ✅ Scalable multi-tenant operation
- ✅ Automatic learning from execution data
- ✅ Organization-specific customization
- ✅ Project-level isolation
- ✅ Minimal client-side complexity
- ✅ Centralized quality control via metabob-proto
