# API v2 Summary: Clean Consumer-Focused Design

## Quick Reference

### 🔐 Session API (`/v2/session`)
**Consumer**: metabob-cli  
**Purpose**: Authentication

```bash
POST   /v2/session    # Create session (API key → session token)
GET    /v2/session    # Validate current session
DELETE /v2/session    # Logout
```

### 🎯 Activities API (`/v2/activities`)
**Consumer**: metabob-cli  
**Purpose**: Template discovery & execution tracking

```bash
# Templates
GET  /v2/activities/templates              # List all templates
GET  /v2/activities/templates/{id}         # Get template details
GET  /v2/activities/templates/{id}/lineage # Get evolution history

# Search
POST /v2/activities/search                 # Semantic search

# Record
POST /v2/activities/record/start           # Start execution
POST /v2/activities/record/step            # Step completion
POST /v2/activities/record/complete        # Execution complete
POST /v2/activities/record/metrics         # Detailed metrics

# Mutate
POST /v2/activities/mutate/create          # Create template
POST /v2/activities/mutate/derive          # Derive from parent
PUT  /v2/activities/mutate/{id}            # Update template
DEL  /v2/activities/mutate/{id}            # Delete template
```

### ☁️ Cloud API (`/v2/cloud`)
**Consumer**: metabob-dashboard  
**Purpose**: Organization & analytics management

```bash
# Admin
/v2/cloud/admin/users
/v2/cloud/admin/audit

# Auth
/v2/cloud/auth/login
/v2/cloud/auth/api-keys

# Orgs
/v2/cloud/orgs
/v2/cloud/orgs/{id}/members
/v2/cloud/orgs/{id}/usage

# Projects
/v2/cloud/projects
/v2/cloud/projects/{id}/sessions
/v2/cloud/projects/{id}/activity-history

# Activities (Dashboard)
/v2/cloud/activities/templates      # With full analytics
/v2/cloud/activities/experiments    # A/B testing
/v2/cloud/activities/analytics      # Aggregate stats
```

### 🔄 Client API (`/v2/client`)
**Consumer**: metabob-cli  
**Purpose**: File sync & agent coordination

```bash
# Sync
POST /v2/client/sync/files          # Sync file changes
GET  /v2/client/sync/status         # Sync status
POST /v2/client/sync/embeddings     # Code embeddings
POST /v2/client/sync/annotations    # Code annotations

# Impulses
POST /v2/client/impulses            # Create shared impulse
GET  /v2/client/impulses            # List impulses
GET  /v2/client/impulses/{id}       # Get impulse
DEL  /v2/client/impulses/{id}       # Delete impulse

# Tasks
GET  /v2/client/tasks               # Get assigned tasks
POST /v2/client/tasks/{id}/accept   # Accept task
POST /v2/client/tasks/{id}/complete # Complete task
POST /v2/client/tasks/{id}/defer    # Defer task
```

---

## Key Design Decisions

### ✅ What metabob-cli Gets

**Simple, Clean Interface**:
- List templates with basic metrics
- Get template details with tasks
- Record execution events
- Create/update templates

**Hidden Complexity**:
- ❌ Thompson Sampling scores
- ❌ CTR/conversion predictions
- ❌ Impression/selection IDs
- ❌ A/B experiment assignments
- ❌ Variant selection logic

### 🧠 What Backend Does (Internal)

**Learning System** (not exposed to CLI):
- Thompson Sampling for variant selection
- A/B testing and experiments
- CTR/conversion tracking
- Quality score predictions
- Automatic variant selection

**Result**: CLI calls `/v2/activities/templates/{id}`, backend returns "best variant" transparently

---

## Authentication Flow

### metabob-cli → Backend

```
1. CLI: POST /v2/session
   Body: {"api_key": "mbk_abc123", "project_id": "exp-repo-dev"}
   
2. Backend: Creates session
   Response: {"session_token": "sess_xyz789", "expires_at": "..."}
   
3. CLI: Stores session_token in memory

4. CLI: All requests include
   Header: Authorization: Bearer sess_xyz789
   
   OR for agent-to-agent:
   Header: X-Internal-Request: true
           X-Project-ID: devbob-agent
```

---

## Typical CLI Workflow

### 1. Search for Activity

```bash
POST /v2/activities/search
{
  "query": "add REST endpoint with validation",
  "category": "feature",
  "limit": 5
}

Response:
{
  "results": [
    {
      "template_id": "add-rest-endpoint-v2",
      "name": "Add REST Endpoint",
      "relevance_score": 0.95,
      "success_rate": 0.91
    }
  ]
}
```

### 2. Get Template Details

```bash
GET /v2/activities/templates/add-rest-endpoint-v2

Response:
{
  "id": "add-rest-endpoint-v2",
  "name": "Add REST Endpoint",
  "tasks": [
    {"order": 1, "type": "agent_task", "prompt_template": "..."},
    {"order": 2, "type": "agent_task", "prompt_template": "..."}
  ],
  "variables": {
    "endpoint_path": {"type": "string", "required": true},
    "method": {"type": "string", "required": true}
  }
}
```

### 3. Execute Activity

```bash
# Start
POST /v2/activities/record/start
{
  "template_id": "add-rest-endpoint-v2",
  "execution_id": "exec_abc123",
  "variables": {"endpoint_path": "/api/users", "method": "GET"}
}

# Record steps
POST /v2/activities/record/step
{
  "execution_id": "exec_abc123",
  "step_number": 1,
  "status": "completed",
  "duration_ms": 45000
}

# Complete
POST /v2/activities/record/complete
{
  "execution_id": "exec_abc123",
  "status": "success",
  "duration_ms": 180000,
  "total_cost": 0.25
}
```

### 4. Create New Template

```bash
POST /v2/activities/mutate/create
{
  "name": "Add GraphQL Query",
  "category": "feature",
  "tasks": [...],
  "variables": {...}
}

Response:
{
  "template_id": "add-graphql-query-v1",
  "created_at": "2026-02-07T10:30:00Z"
}
```

---

## Benefits Over Old API

### Before (`/activity-recommendations/*`)

❌ 15+ endpoints with ML complexity  
❌ Impression → Selection → Conversion funnel  
❌ Thompson Sampling client-side logic  
❌ CTR/conversion tracking in CLI  
❌ Variant selection in CLI  
❌ 500+ lines of tracking code  

### After (`/v2/activities/*`)

✅ 8 core endpoints, simple CRUD  
✅ "Give me templates, let me record results"  
✅ Thompson Sampling server-side only  
✅ Learning happens transparently  
✅ Variant selection automatic  
✅ Clean, understandable code  

---

## Migration Impact

### metabob-cli Changes

**Remove** (500+ lines):
- `impression_id` tracking
- `selection_id` tracking
- CTR/conversion recording
- Thompson Sampling client logic
- Multi-step recommendation flow

**Add** (200 lines):
- Simple template list/get
- Execution recording (start/step/complete)
- Template create/update

**Net**: -300 lines, cleaner code

### Backend Changes

**New Files**:
- `server/routes/v2_session.py`
- `server/routes/v2_activities.py`
- `server/routes/v2_cloud.py`
- `server/routes/v2_client.py`
- `server/services/activity_learning.py` (move internal logic)

**Deprecated**:
- `server/routes/activity_recommendations.py` (keep for 1 release)

---

## Success Metrics

✅ **API Simplification**: 15+ endpoints → 8 core endpoints  
✅ **CLI Code Reduction**: 500+ lines removed  
✅ **Response Times**: < 100ms for list, < 50ms for get  
✅ **Learning Preserved**: Backend still does Thompson Sampling  
✅ **Clean Separation**: CLI (consumer) vs Dashboard (admin)  
✅ **Auth Working**: X-Internal-Request for agents, Bearer for dashboard  

---

## Next Steps

**Phase 1: Prototype** (1 week)
- [ ] Implement `/v2/session` endpoints
- [ ] Implement `/v2/activities/templates` endpoints
- [ ] Test with metabob-cli

**Phase 2: Full Implementation** (2 weeks)
- [ ] Implement search/record/mutate
- [ ] Move learning system to internal service
- [ ] Implement cloud API (dashboard)
- [ ] Implement client API (sync/impulses/tasks)

**Phase 3: Migration** (1 week)
- [ ] Update metabob-cli to use v2
- [ ] Deprecate old `/activity-recommendations/*`
- [ ] Test end-to-end

**Phase 4: Cleanup** (1 week)
- [ ] Remove old routes
- [ ] Update documentation
- [ ] Performance optimization

---

## Questions to Answer

1. **Session Management**: Should sessions auto-renew or require explicit refresh?
2. **Rate Limiting**: Per-API-key or per-session?
3. **Template Versioning**: How to handle breaking changes to template schema?
4. **Sync Conflicts**: How to resolve file sync conflicts?
5. **Impulse TTL**: Default expiration for shared impulses?

---

## Full Design

See `API_V2_DESIGN.md` for:
- Complete endpoint specifications
- Request/response examples
- Error handling
- Authentication details
- Implementation guidelines
