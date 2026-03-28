# API v2 Design: Clean Interface Architecture

## Design Principles

1. **Consumer-First**: Each namespace serves a specific consumer with exactly what they need
2. **No Leakage**: Internal implementation details (Thompson Sampling, A/B tests) stay internal
3. **Stateless CLI**: metabob-cli is stateless - backend manages learning, experiments, state
4. **Version Prefix**: All v2 endpoints start with `/v2/` for clean versioning

---

## API Structure Overview

```
/v2/
  ├── session/           # Authentication for metabob-cli
  ├── activities/        # Activity templates & execution (metabob-cli)
  │   ├── templates/
  │   ├── search/
  │   ├── record/
  │   └── mutate/
  ├── cloud/             # Dashboard & cloud management
  │   ├── admin/
  │   ├── auth/
  │   ├── orgs/
  │   ├── projects/
  │   └── activities/
  └── client/            # File sync & agent coordination
      ├── sync/
      ├── impulses/
      └── tasks/
```

---

## 1. Session API (`/v2/session`)

**Consumer**: metabob-cli  
**Purpose**: Exchange API key for session token, associate with project

### Endpoints

#### `POST /v2/session`
Create session from API key or internal request

**Request**:
```json
{
  "api_key": "mbk_abc123xyz...",      // Optional: API key
  "project_id": "exp-repo-dev",       // Optional: Project context
  "session_id": "devbob-cli-abc123"   // Optional: Client session ID for tracking
}
```

**Headers** (alternative auth):
```
X-Internal-Request: true
X-Project-ID: devbob-agent
```

**Response**:
```json
{
  "session_token": "sess_xyz789...",
  "expires_at": "2026-02-08T12:00:00Z",
  "user_id": "user_abc123",
  "org_id": "org_metabob",
  "project_id": "exp-repo-dev"
}
```

#### `GET /v2/session`
Validate current session and get metadata

**Headers**:
```
Authorization: Bearer sess_xyz789...
```

**Response**:
```json
{
  "session_id": "sess_xyz789...",
  "user_id": "user_abc123",
  "org_id": "org_metabob",
  "project_id": "exp-repo-dev",
  "created_at": "2026-02-07T10:00:00Z",
  "expires_at": "2026-02-08T12:00:00Z",
  "is_internal": false
}
```

#### `DELETE /v2/session`
Invalidate session

**Headers**:
```
Authorization: Bearer sess_xyz789...
```

**Response**: `204 No Content`

---

## 2. Activities API (`/v2/activities`)

**Consumer**: metabob-cli  
**Purpose**: Discover, execute, and learn from activity templates

### 2.1 Templates (`/v2/activities/templates`)

#### `GET /v2/activities/templates`
List all available activity templates (with pre-filtering)

**Query Parameters**:
- `limit` (default: 20, max: 100)
- `offset` (default: 0)
- `category` (feature|bugfix|refactor|tool|infrastructure)

**Response**:
```json
{
  "templates": [
    {
      "id": "feature-impl-v1",
      "name": "Feature Implementation",
      "description": "Implement a new feature following project conventions",
      "category": "feature",
      "task_count": 5,
      "estimated_duration_ms": 300000,
      "estimated_cost": 0.4,
      "success_rate": 0.87,
      "execution_count": 15,
      "variables": {
        "feature_name": {"type": "string", "required": true, "description": "Name of the feature"},
        "feature_description": {"type": "string", "required": true, "description": "Detailed requirements"}
      },
      "context_requirements": [
        {"type": "codebase_context", "required": true},
        {"type": "user_requirements", "required": true}
      ]
    }
  ],
  "total": 8,
  "limit": 20,
  "offset": 0
}
```

**Note**: Backend selects best variant transparently (Thompson Sampling happens server-side)

#### `GET /v2/activities/templates/{template_id}`
Get full template details including tasks

**Response**:
```json
{
  "id": "feature-impl-v1",
  "name": "Feature Implementation",
  "description": "Implement a new feature following project conventions",
  "category": "feature",
  "tasks": [
    {
      "order": 1,
      "type": "agent_task",
      "agent_mode": "implementation",
      "prompt_template": "Implement {{feature_name}}: {{feature_description}}\n\nFollow project conventions...",
      "timeout_ms": 300000,
      "retry_policy": {"max_attempts": 2, "backoff_ms": 1000},
      "validation": {
        "type": "test_execution",
        "required": true,
        "command": "npm test"
      }
    },
    {
      "order": 2,
      "type": "agent_task",
      "agent_mode": "test",
      "prompt_template": "Write tests for {{feature_name}}...",
      "validation": {
        "type": "coverage_check",
        "min_coverage": 0.8
      }
    }
  ],
  "variables": {...},
  "context_requirements": [...],
  "parent_id": null,
  "version": "v1",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-02-01T14:30:00Z",
  "metrics": {
    "executions": 15,
    "success_rate": 0.87,
    "avg_duration_ms": 180000,
    "avg_cost": 0.25,
    "last_execution": "2026-02-07T09:00:00Z"
  }
}
```

**Note**: Backend returns the "best variant" for this template based on learning

#### `GET /v2/activities/templates/{template_id}/lineage`
Get template evolution history

**Response**:
```json
{
  "template_id": "feature-impl-v3",
  "current_version": "v3",
  "ancestors": [
    {
      "id": "feature-impl-v1",
      "version": "v1",
      "created_at": "2026-01-15T10:00:00Z",
      "evolution_note": "Initial version"
    },
    {
      "id": "feature-impl-v2",
      "version": "v2",
      "created_at": "2026-01-20T11:00:00Z",
      "parent_id": "feature-impl-v1",
      "evolution_note": "Added test coverage validation"
    }
  ],
  "descendants": [
    {
      "id": "feature-impl-v4-experimental",
      "version": "v4-experimental",
      "created_at": "2026-02-05T15:00:00Z",
      "evolution_note": "Experimental: AI-generated test suggestions"
    }
  ]
}
```

### 2.2 Search (`/v2/activities/search`)

#### `POST /v2/activities/search`
Semantic search for activity templates with context

**Request**:
```json
{
  "query": "add REST endpoint with validation",
  "category": "feature",
  "context": {
    "intent": "User wants to add a new API endpoint for user profiles",
    "codebase_info": {
      "language": "typescript",
      "framework": "express",
      "has_tests": true
    }
  },
  "limit": 5
}
```

**Response**:
```json
{
  "results": [
    {
      "template_id": "add-rest-endpoint-v2",
      "name": "Add REST Endpoint",
      "description": "Add a new REST endpoint with validation and tests",
      "category": "feature",
      "relevance_score": 0.95,
      "match_reason": "Exact match: REST endpoint creation with validation",
      "estimated_duration_ms": 240000,
      "success_rate": 0.91
    },
    {
      "template_id": "feature-impl-v1",
      "name": "Feature Implementation",
      "relevance_score": 0.78,
      "match_reason": "General feature implementation pattern"
    }
  ],
  "query": "add REST endpoint with validation",
  "total_results": 2
}
```

**Note**: Backend uses semantic search + Thompson Sampling to rank results

### 2.3 Record (`/v2/activities/record`)

#### `POST /v2/activities/record/start`
Record activity execution start

**Request**:
```json
{
  "template_id": "feature-impl-v1",
  "execution_id": "exec_abc123",       // Client-generated UUID
  "session_id": "sess_xyz789",
  "variables": {
    "feature_name": "User profile API",
    "feature_description": "GET /api/users/:id endpoint"
  },
  "context": {
    "project_id": "exp-repo-dev",
    "codebase_language": "typescript",
    "agent_version": "1.7.1"
  }
}
```

**Response**:
```json
{
  "execution_id": "exec_abc123",
  "tracking_id": "track_xyz789",       // Backend tracking (for learning)
  "started_at": "2026-02-07T10:00:00Z"
}
```

#### `POST /v2/activities/record/step`
Record individual task/step completion

**Request**:
```json
{
  "execution_id": "exec_abc123",
  "step_number": 1,
  "status": "completed",              // completed | failed | skipped
  "duration_ms": 45000,
  "cost": 0.08,
  "output": {
    "files_modified": ["src/api/users.ts", "src/routes/index.ts"],
    "tests_added": 3,
    "validation_passed": true
  },
  "error": null
}
```

**Response**:
```json
{
  "recorded": true,
  "execution_id": "exec_abc123",
  "step_number": 1
}
```

#### `POST /v2/activities/record/complete`
Record activity execution completion

**Request**:
```json
{
  "execution_id": "exec_abc123",
  "status": "success",                // success | failed | cancelled
  "duration_ms": 180000,
  "total_cost": 0.25,
  "outcome": {
    "files_modified": 5,
    "tests_added": 8,
    "tests_passed": 8,
    "commits_created": 2,
    "quality_score": 0.92
  },
  "error": null,
  "failure_reason": null
}
```

**Response**:
```json
{
  "recorded": true,
  "execution_id": "exec_abc123",
  "learning_updated": true,
  "new_success_rate": 0.88
}
```

**Note**: Backend updates Thompson Sampling priors, CTR, conversion rates internally

#### `POST /v2/activities/record/metrics`
Record detailed execution metrics (optional, for rich learning)

**Request**:
```json
{
  "execution_id": "exec_abc123",
  "metrics": {
    "llm_calls": 12,
    "tokens_used": 45000,
    "tool_calls": 23,
    "files_read": 15,
    "files_written": 5,
    "time_breakdown": {
      "planning_ms": 10000,
      "implementation_ms": 120000,
      "testing_ms": 30000,
      "validation_ms": 20000
    },
    "quality_metrics": {
      "correctness_score": 0.95,
      "test_coverage": 0.87,
      "code_quality": 0.89,
      "metabob_issues": 0
    }
  }
}
```

**Response**:
```json
{
  "recorded": true,
  "execution_id": "exec_abc123"
}
```

### 2.4 Mutate (`/v2/activities/mutate`)

#### `POST /v2/activities/mutate/create`
Create new activity template

**Request**:
```json
{
  "name": "Add GraphQL Query",
  "description": "Add a new GraphQL query with resolver and tests",
  "category": "feature",
  "tasks": [
    {
      "order": 1,
      "type": "agent_task",
      "agent_mode": "implementation",
      "prompt_template": "Create GraphQL query {{query_name}} that {{query_description}}",
      "validation": {"type": "test_execution", "required": true}
    }
  ],
  "variables": {
    "query_name": {"type": "string", "required": true},
    "query_description": {"type": "string", "required": true}
  },
  "context_requirements": [
    {"type": "graphql_schema", "required": true}
  ],
  "parent_id": null,
  "metadata": {
    "created_by": "user_abc123",
    "tags": ["graphql", "backend", "api"]
  }
}
```

**Response**:
```json
{
  "template_id": "add-graphql-query-v1",
  "name": "Add GraphQL Query",
  "version": "v1",
  "created_at": "2026-02-07T10:30:00Z",
  "status": "active"
}
```

#### `POST /v2/activities/mutate/derive`
Derive new template from existing (evolution)

**Request**:
```json
{
  "parent_id": "feature-impl-v2",
  "name": "Feature Implementation with AI Tests",
  "evolution_note": "Added AI-powered test generation step",
  "changes": {
    "tasks": [
      {
        "operation": "insert",
        "after_step": 2,
        "task": {
          "order": 3,
          "type": "agent_task",
          "agent_mode": "test",
          "prompt_template": "Generate comprehensive tests using AI analysis..."
        }
      }
    ]
  },
  "experiment": {
    "enabled": true,
    "traffic_percentage": 0.1,
    "hypothesis": "AI test generation improves coverage by 15%"
  }
}
```

**Response**:
```json
{
  "template_id": "feature-impl-v3-ai-tests",
  "parent_id": "feature-impl-v2",
  "version": "v3-ai-tests",
  "evolution_type": "enhancement",
  "experiment_id": "exp_abc123",
  "created_at": "2026-02-07T10:45:00Z",
  "status": "experimental"
}
```

#### `PUT /v2/activities/mutate/{template_id}`
Update existing template

**Request**:
```json
{
  "description": "Updated description...",
  "tasks": [...],
  "variables": {...},
  "change_note": "Fixed prompt template variable substitution"
}
```

**Response**:
```json
{
  "template_id": "feature-impl-v1",
  "updated_at": "2026-02-07T11:00:00Z",
  "version": "v1.1"
}
```

#### `DELETE /v2/activities/mutate/{template_id}`
Archive/delete template

**Response**: `204 No Content`

---

## 3. Cloud API (`/v2/cloud`)

**Consumer**: metabob-dashboard (web UI)  
**Purpose**: Organization management, analytics, billing, admin

### 3.1 Admin (`/v2/cloud/admin`)

#### `GET /v2/cloud/admin/users`
List users with permissions

#### `POST /v2/cloud/admin/users`
Create user

#### `PUT /v2/cloud/admin/users/{user_id}/role`
Update user role

#### `GET /v2/cloud/admin/audit`
Audit logs

### 3.2 Auth (`/v2/cloud/auth`)

#### `POST /v2/cloud/auth/login`
Dashboard login (email/password or OAuth)

#### `POST /v2/cloud/auth/api-keys`
Generate API key for CLI

#### `GET /v2/cloud/auth/api-keys`
List user's API keys

#### `DELETE /v2/cloud/auth/api-keys/{key_id}`
Revoke API key

### 3.3 Organizations (`/v2/cloud/orgs`)

#### `GET /v2/cloud/orgs`
List user's organizations

#### `POST /v2/cloud/orgs`
Create organization

#### `GET /v2/cloud/orgs/{org_id}`
Get organization details

#### `GET /v2/cloud/orgs/{org_id}/members`
List members

#### `POST /v2/cloud/orgs/{org_id}/members`
Invite member

#### `GET /v2/cloud/orgs/{org_id}/usage`
Usage statistics (API calls, storage, costs)

### 3.4 Projects (`/v2/cloud/projects`)

#### `GET /v2/cloud/projects`
List projects in organization

#### `POST /v2/cloud/projects`
Create project

#### `GET /v2/cloud/projects/{project_id}`
Get project details

#### `GET /v2/cloud/projects/{project_id}/sessions`
List active sessions

#### `GET /v2/cloud/projects/{project_id}/activity-history`
Activity execution history with analytics

### 3.5 Activities (Dashboard) (`/v2/cloud/activities`)

#### `GET /v2/cloud/activities/templates`
List templates with full analytics

**Response** (richer than CLI version):
```json
{
  "templates": [
    {
      "id": "feature-impl-v1",
      "name": "Feature Implementation",
      "variants": [
        {
          "variant_id": "feature-impl-v1-baseline",
          "version": "v1",
          "metrics": {
            "executions": 100,
            "success_rate": 0.87,
            "avg_duration_ms": 180000,
            "ctr": 0.15,
            "conversion_rate": 0.87,
            "quality_score": 0.85
          },
          "experiment": null
        },
        {
          "variant_id": "feature-impl-v2-experimental",
          "version": "v2",
          "metrics": {...},
          "experiment": {
            "id": "exp_abc123",
            "status": "running",
            "traffic": 0.1,
            "hypothesis": "Adding AI suggestions improves quality by 10%",
            "results": {
              "control_success_rate": 0.87,
              "variant_success_rate": 0.92,
              "statistical_significance": 0.95
            }
          }
        }
      ],
      "total_executions": 115,
      "overall_success_rate": 0.88,
      "trending": "up",
      "last_30_days": {
        "executions": 45,
        "success_rate": 0.90
      }
    }
  ]
}
```

#### `GET /v2/cloud/activities/experiments`
List A/B experiments

#### `POST /v2/cloud/activities/experiments/{experiment_id}/conclude`
End experiment and promote winner

#### `GET /v2/cloud/activities/analytics`
Aggregate activity analytics

**Query Parameters**:
- `date_from`, `date_to`
- `org_id`, `project_id`

**Response**:
```json
{
  "date_range": {
    "from": "2026-01-01T00:00:00Z",
    "to": "2026-02-07T23:59:59Z"
  },
  "summary": {
    "total_executions": 1250,
    "successful_executions": 1087,
    "failed_executions": 163,
    "overall_success_rate": 0.87,
    "total_cost": 312.50,
    "total_duration_hours": 125.5
  },
  "by_category": {
    "feature": {"executions": 500, "success_rate": 0.89},
    "bugfix": {"executions": 400, "success_rate": 0.85},
    "refactor": {"executions": 250, "success_rate": 0.90},
    "tool": {"executions": 100, "success_rate": 0.82}
  },
  "top_templates": [
    {
      "template_id": "feature-impl-v1",
      "executions": 150,
      "success_rate": 0.87
    }
  ],
  "trends": {
    "daily_executions": [...],
    "daily_success_rate": [...]
  }
}
```

---

## 4. Client API (`/v2/client`)

**Consumer**: metabob-cli  
**Purpose**: File sync, impulse sharing, agent task coordination

### 4.1 Sync (`/v2/client/sync`)

#### `POST /v2/client/sync/files`
Sync local file changes to backend

**Request**:
```json
{
  "session_id": "sess_xyz789",
  "project_id": "exp-repo-dev",
  "changes": [
    {
      "path": "src/api/users.ts",
      "operation": "modified",
      "content_hash": "sha256:abc123...",
      "timestamp": "2026-02-07T10:00:00Z"
    },
    {
      "path": "src/api/posts.ts",
      "operation": "created",
      "content_hash": "sha256:def456...",
      "timestamp": "2026-02-07T10:05:00Z"
    }
  ]
}
```

**Response**:
```json
{
  "synced": true,
  "files_synced": 2,
  "conflicts": [],
  "sync_id": "sync_xyz789"
}
```

#### `GET /v2/client/sync/status`
Get sync status and conflicts

**Response**:
```json
{
  "last_sync": "2026-02-07T10:05:00Z",
  "pending_changes": 0,
  "conflicts": [],
  "sync_enabled": true
}
```

#### `POST /v2/client/sync/embeddings`
Upload code embeddings for semantic search

**Request**:
```json
{
  "session_id": "sess_xyz789",
  "project_id": "exp-repo-dev",
  "embeddings": [
    {
      "file_path": "src/api/users.ts",
      "function": "getUserProfile",
      "embedding": [0.123, 0.456, ...],  // 1536-dim vector
      "metadata": {
        "language": "typescript",
        "lines": "10-25",
        "signature": "async function getUserProfile(userId: string)"
      }
    }
  ]
}
```

**Response**:
```json
{
  "uploaded": true,
  "embeddings_count": 1
}
```

#### `POST /v2/client/sync/annotations`
Sync code annotations (from Metabob analysis)

**Request**:
```json
{
  "session_id": "sess_xyz789",
  "project_id": "exp-repo-dev",
  "annotations": [
    {
      "file_path": "src/api/users.ts",
      "component": "getUserProfile",
      "annotation_type": "design_decision",
      "content": "Uses Redis cache for performance (expires after 5 min)",
      "created_at": "2026-02-07T10:00:00Z",
      "created_by": "agent"
    }
  ]
}
```

**Response**:
```json
{
  "synced": true,
  "annotations_count": 1
}
```

### 4.2 Impulses (`/v2/client/impulses`)

#### `POST /v2/client/impulses`
Create shared impulse for agent coordination

**Request**:
```json
{
  "impulse_id": "imp_abc123",
  "session_id": "sess_xyz789",
  "type": "design_decision",
  "content": {
    "title": "API Design for User Profiles",
    "description": "REST endpoint: GET /api/users/:id/profile",
    "requirements": [
      "Return user profile data",
      "Include avatar URL",
      "Cache for 5 minutes"
    ],
    "constraints": [
      "Max response time: 200ms",
      "Auth required"
    ]
  },
  "share_with": ["backend-agent", "frontend-agent"],
  "expires_at": "2026-02-07T12:00:00Z"
}
```

**Response**:
```json
{
  "impulse_id": "imp_abc123",
  "created_at": "2026-02-07T10:00:00Z",
  "shared_with": ["backend-agent", "frontend-agent"]
}
```

#### `GET /v2/client/impulses`
List impulses for current session

**Response**:
```json
{
  "impulses": [
    {
      "impulse_id": "imp_abc123",
      "type": "design_decision",
      "content": {...},
      "created_at": "2026-02-07T10:00:00Z",
      "created_by": "session_xyz789",
      "shared_with": ["backend-agent", "frontend-agent"]
    }
  ]
}
```

#### `GET /v2/client/impulses/{impulse_id}`
Get specific impulse

#### `DELETE /v2/client/impulses/{impulse_id}`
Delete impulse

### 4.3 Tasks (`/v2/client/tasks`)

#### `GET /v2/client/tasks`
Get tasks assigned to this agent/session

**Response**:
```json
{
  "tasks": [
    {
      "task_id": "task_abc123",
      "type": "code_review",
      "priority": "high",
      "assigned_by": "coordination-agent",
      "assigned_at": "2026-02-07T10:00:00Z",
      "payload": {
        "files": ["src/api/users.ts"],
        "review_type": "security",
        "checklist": [
          "Check for SQL injection",
          "Verify input validation",
          "Check auth enforcement"
        ]
      },
      "status": "pending"
    }
  ]
}
```

#### `POST /v2/client/tasks/{task_id}/accept`
Accept task assignment

#### `POST /v2/client/tasks/{task_id}/complete`
Mark task complete with results

**Request**:
```json
{
  "status": "completed",
  "result": {
    "issues_found": 2,
    "issues": [
      {
        "type": "security",
        "severity": "high",
        "file": "src/api/users.ts",
        "line": 15,
        "description": "Missing input validation for userId parameter"
      }
    ],
    "recommendations": [...]
  }
}
```

#### `POST /v2/client/tasks/{task_id}/defer`
Defer task (move to boredom queue)

---

## Authentication & Authorization

### Auth Methods

1. **Session Token** (Bearer)
   ```
   Authorization: Bearer sess_xyz789...
   ```

2. **Internal Request** (Agent-to-Agent)
   ```
   X-Internal-Request: true
   X-Project-ID: devbob-agent
   ```

3. **API Key** (CLI)
   ```
   X-API-Key: mbk_abc123...
   ```

### Permission Scopes

Each endpoint checks permissions based on session/user:

- `/v2/session` - Public (creates auth)
- `/v2/activities/*` - Requires session or internal auth
- `/v2/cloud/*` - Requires dashboard session with org/project access
- `/v2/client/*` - Requires session or internal auth

---

## Error Responses

All errors follow consistent format:

```json
{
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Activity template 'feature-impl-v999' not found",
    "details": {
      "template_id": "feature-impl-v999",
      "available_templates": 8
    },
    "request_id": "req_xyz789"
  }
}
```

### Error Codes

- `AUTH_REQUIRED` (401) - Missing or invalid auth
- `FORBIDDEN` (403) - Valid auth but insufficient permissions
- `NOT_FOUND` (404) - Resource doesn't exist
- `VALIDATION_ERROR` (400) - Invalid request data
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INTERNAL_ERROR` (500) - Server error

---

## Migration Strategy

### Phase 1: Implement v2 Backend
1. Create new route files:
   - `server/routes/v2_session.py`
   - `server/routes/v2_activities.py`
   - `server/routes/v2_cloud.py`
   - `server/routes/v2_client.py`

2. Create internal services:
   - `server/services/activity_learning.py` - Thompson Sampling, A/B tests
   - `server/services/template_engine.py` - Template variant selection
   - `server/services/sync_manager.py` - File sync coordination

3. Register routers in `server/app.py`

### Phase 2: Migrate metabob-cli
1. Update `ActivityManager` to use v2 endpoints
2. Remove impression/selection/conversion tracking
3. Simplify to CRUD + record operations

### Phase 3: Deprecation
1. Add deprecation headers to `/activity-recommendations/*`
2. Keep old routes for 1 release cycle
3. Remove in v3.0

---

## Success Metrics

✅ metabob-cli code reduced by 500+ lines  
✅ API surface reduced from 15+ endpoints to 8 core endpoints  
✅ No ML/learning concepts exposed to CLI  
✅ Clear separation: CLI (consumer) vs Dashboard (admin)  
✅ Backend learning still works (internal)  
✅ Response times < 100ms for template list  
✅ Response times < 50ms for template get (cache hit)  

---

## Next Steps

1. **Review** this design with team
2. **Prototype** session + templates endpoints
3. **Test** with metabob-cli integration
4. **Implement** remaining namespaces
5. **Document** with OpenAPI specs
6. **Migrate** from v1 to v2
7. **Deprecate** old endpoints

