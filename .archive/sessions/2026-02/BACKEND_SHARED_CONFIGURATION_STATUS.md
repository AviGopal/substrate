# Backend Shared Configuration Status

**Date**: February 11, 2026  
**Goal**: Share backend between host machine and devbob container instances  
**Status**: ✅ Backend Running | 🟡 Template Registration Needs Schema Migration

---

## Current Status

### ✅ Backend Services Running and Accessible

The backend is **fully operational** and accessible from both host and containers:

```bash
# Backend Services (Healthy)
✓ api-server-dev (metabob-rpc-api:8080) - Healthy
✓ metabob-redis (port 6379) - Healthy  
✓ metabob-surreal (port 8000) - Healthy
✓ metabob-surrealist (port 8001) - Web UI for SurrealDB
```

#### Access Points

**From Host Machine**:
- API: `http://localhost:8080`
- Redis: `localhost:6379`
- SurrealDB: `localhost:8000`
- Surrealist UI: `http://localhost:8001`

**From Containers** (via docker network):
- API: `http://api-server-dev:8080` or `http://host.docker.internal:8080`
- Redis: `redis:6379`
- SurrealDB: `surreal:8000`

### ✅ Authentication Working

**Valid API Key**: `mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8`  
**Project ID**: `exp-repo-dev`  
**Organization ID**: `62a4d853-4673-4450-b17e-4521f96e5c0e`

Session creation works:
```bash
curl -X POST \
  -H "x-api-key: mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"exp-repo-dev"}' \
  http://localhost:8080/v2/session
```

Returns:
```json
{
  "session_id": "...",
  "metadata": {
    "session_token": "..."
  }
}
```

### ✅ OpenCode MCP Integration Configured

The `configs/opencode.devbob.json` is properly configured:

```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_URL": "http://api-server-dev:8080",
        "METABOB_API_KEY": "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs"
      },
      "enabled": true
    }
  },
  "metabob": {
    "base_url": "http://api-server-dev:8080",
    "api_key": "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs"
  }
}
```

---

## 🟡 Issue: Bootstrap Templates Need Schema Migration

### Problem

Bootstrap templates in `repos/metabob-proto/activities/bootstrap/` use **V1 schema**, but the V2 API expects a different schema format.

### Schema Differences

#### Field Name Changes
| Bootstrap (V1) | API Expects (V2) | Status |
|----------------|------------------|---------|
| `task_steps` | `tasks` | ✅ Fixed |
| Task: `step_id` | Task: `id` | ❌ Needs mapping |
| Task: `title` | Task: `description` | ❌ Needs mapping |
| Task: (missing) | Task: `subagent` | ❌ Required field |

#### Variable Format
Bootstrap templates have:
```json
{
  "variables": {
    "feature_name": "",
    "feature_description": ""
  }
}
```

API expects (based on validation error):
```json
{
  "variables": {
    "feature_name": {
      "type": "string",
      "default": "",
      "description": "..."
    }
  }
}
```

Or variables should be omitted entirely.

### Registration Errors

When attempting to register, we get:
1. **422**: Missing `id` field in tasks (uses `step_id` instead)
2. **422**: Variables validation error (expects dict-of-dicts, not dict-of-strings)
3. **422**: Missing required fields in task definitions

---

## 📋 What We Have

### Bootstrap Templates (9 total)

```
repos/metabob-proto/activities/bootstrap/
├── activity-create.json (5 tasks)
├── activity-debug.json (5 tasks)
├── activity-evolve.json (5 tasks)
├── boredom-task-processor.json (6 tasks)
├── bug-fix.json (4 tasks)
├── code-analysis.json (4 tasks)
├── feature-impl.json (5 tasks) ← Most important
├── jiggle-documentation.json (0 tasks)
└── refactor.json (4 tasks)
```

### Recent Commits

```
10adc72 Add required proto fields to Group A bootstrap templates
6ec2a19 diagnosis: Identify root cause of activity discovery failure
cd813b7 docs: Document jiggle-documentation activity creation, testing, and status
8bf34db docs: Major jiggle cleanup with enhanced validation - remove 148 obsolete files
```

The project has been actively working on activity system implementation.

---

## 🎯 Solution Options

### Option 1: Create Schema Migration Script (Recommended)

Create `scripts/migrate-bootstrap-to-v2.py` that:
1. Reads V1 bootstrap templates
2. Maps all field names correctly:
   - `task_steps` → `tasks`
   - Task `step_id` → Task `id`
   - Task `title` → Keep as `description` (if that's the right mapping)
3. Adds required fields:
   - Task `subagent`: "general" (default for all tasks)
   - Task prompt fields with correct structure
4. Converts or omits `variables` field
5. Outputs V2-compatible JSON files

**Pros**:
- Preserves original templates
- Creates clean V2 versions
- Reusable for future template migrations
- Can be version controlled

**Cons**:
- Requires understanding full V2 schema
- One-time effort

### Option 2: Fix Bootstrap Templates Directly

Manually edit the 9 JSON files in `repos/metabob-proto/activities/bootstrap/`:
- Rename `task_steps` to `tasks`
- Rename task `step_id` to `id`  
- Add `subagent: "general"` to each task
- Fix variables format or remove them

**Pros**:
- Direct fix at source
- Templates are correct going forward

**Cons**:
- Manual work for 9 templates
- Error-prone
- Might break other systems using V1 format

### Option 3: API-Side Compatibility Layer

Update the V2 API to accept both formats:
- Accept `task_steps` as alias for `tasks`
- Accept `step_id` as alias for task `id`
- Make `subagent` optional with default "general"
- Accept string variables or omit validation

**Pros**:
- Backwards compatible
- Works with existing templates

**Cons**:
- Increases API complexity
- Deviates from clean V2 schema
- Technical debt

---

## 🚀 Recommended Approach

**Use Option 1**: Create a migration script

### Implementation Steps

1. **Study the V2 Schema**
   - Read `repos/metabob-rpc-api/server/models/proto_template.py`
   - Understand exact requirements for ActivityTemplate
   - Document all required fields

2. **Create Migration Script**
   ```python
   # scripts/migrate-bootstrap-to-v2.py
   
   def migrate_task(v1_task):
       """Convert V1 task to V2 format."""
       return {
           "id": v1_task["step_id"],  # Rename field
           "description": v1_task.get("description", v1_task.get("title", "")),
           "subagent": "general",  # Add required field
           "dependencies": v1_task.get("dependencies", []),
           "prompt": v1_task.get("prompt", {}),
           "validation": v1_task.get("validation", {}),
           "retry": v1_task.get("retry", {}),
           "metrics": v1_task.get("metrics", {}),
           # ... other fields
       }
   
   def migrate_template(v1_template):
       """Convert V1 template to V2 format."""
       return {
           "variant_id": v1_template["variant_id"],
           "activity_id": v1_template["activity_id"],
           "name": generate_name(v1_template["activity_id"]),
           "category": map_category(v1_template["activity_id"]),
           "description": v1_template["description"],
           "tasks": [migrate_task(t) for t in v1_template["task_steps"]],
           # Omit variables for now
           # ... other fields
       }
   ```

3. **Run Migration**
   ```bash
   python3 scripts/migrate-bootstrap-to-v2.py \
     --input repos/metabob-proto/activities/bootstrap \
     --output repos/metabob-proto/activities/v2 \
     --dry-run  # Preview changes first
   
   # Then actually migrate
   python3 scripts/migrate-bootstrap-to-v2.py \
     --input repos/metabob-proto/activities/bootstrap \
     --output repos/metabob-proto/activities/v2
   ```

4. **Register V2 Templates**
   ```bash
   python3 scripts/register-bootstrap-templates.py \
     --templates repos/metabob-proto/activities/v2
   ```

5. **Verify with Activity Tool**
   ```bash
   # In an opencode session (or via metabob-cli MCP)
   search_activities({ category: "feature" })
   # Should return: feature-impl-v1
   ```

---

## 🧪 Testing Activity System

Once templates are registered, test the full workflow:

### Test 1: Search Activities
```javascript
// In OpenCode or metabob-cli
search_activities({ 
  category: "feature",
  verbose: true 
})
```

Expected: Returns `feature-impl-v1` template with 5 tasks

### Test 2: Execute Activity
```javascript
activity({
  activityId: "feature-impl-v1",
  variables: {
    feature_name: "Test Feature",
    feature_description: "A simple test",
    target_location: "src/test"
  },
  reason: "Test activity system end-to-end"
})
```

Expected:
- Activity starts execution
- Each of 5 tasks executes sequentially
- Results are recorded in backend
- Success/failure is reported

### Test 3: Create Activity Template

Use the `activity-create` activity to create a new template:
```javascript
activity({
  activityId: "activity-create-v1",
  variables: {
    // ... variables for creating a new activity
  },
  reason: "Test create-activity activity"
})
```

This tests the "build the system with itself" capability.

---

## 📝 Configuration Files Reference

### Host Machine Config
- Environment: `.env.devbob`
- OpenCode Config: `configs/opencode.devbob.json`
- API Key: `.metabob_api_key`

### Container Config (devbob-opencode)
- Workspace: `/workspace` (mounted volume)
- OpenCode Config: `/workspace/configs/opencode.devbob.json`
- Metabob State: `/workspace/.metabob/state`
- Environment Variables:
  ```
  METABOB_API_URL=http://api-server-dev:8080
  METABOB_PROJECT_ID=exp-repo-dev
  METABOB_API_KEY=mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs
  ```

### Docker Compose
- File: `docker-compose.yaml`
- Networks: `devbob-network`, `metabob-network`
- Containers share backend via network bridge

---

## 🎯 Next Steps

1. **Create Schema Migration Script** ← **DO THIS FIRST**
   - Study V2 schema in detail
   - Write converter for all fields
   - Test with one template first

2. **Migrate Bootstrap Templates**
   - Run migration script
   - Verify output JSON is valid
   - Store in `repos/metabob-proto/activities/v2/`

3. **Register Templates to Backend**
   - Use fixed registration script
   - Verify all 9 templates register successfully
   - Check via API: `GET /v2/activities/templates`

4. **Test Activity Execution**
   - Start devbob-opencode container (if not running)
   - Use activity tool to search and execute
   - Verify full workflow

5. **Test Create-Activity Activity**
   - Use `activity-create-v1` to create a new template
   - Verify it registers and is executable
   - This validates "build system with itself"

---

## 🔍 Diagnostic Commands

```bash
# Check backend health
curl http://localhost:8080/health

# List templates
curl -H "x-api-key: mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8" \
  http://localhost:8080/v2/activities/templates | jq '.templates | length'

# Create session
curl -X POST \
  -H "x-api-key: mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"exp-repo-dev"}' \
  http://localhost:8080/v2/session

# Check running containers
docker ps | grep -E "devbob|metabob"

# Check devbob-opencode logs
docker logs devbob-opencode --tail 50

# Restart devbob-opencode (if needed)
docker restart devbob-opencode
```

---

## ✅ Summary

**What's Working**:
- ✅ Backend services running and healthy
- ✅ Authentication with API keys
- ✅ Session creation
- ✅ OpenCode MCP configuration
- ✅ Network connectivity between host and containers
- ✅ Registration script framework

**What Needs Work**:
- 🟡 Bootstrap templates need schema migration (V1 → V2)
- 🟡 Field name mappings (`task_steps` → `tasks`, `step_id` → `id`)
- 🟡 Required fields (task `subagent`, prompt structure)
- 🟡 Variables format (dict-of-dicts vs dict-of-strings)

**Action Item**:
**Create and run schema migration script to convert 9 bootstrap templates to V2 format**, then register them.

---

**Status**: 🟢 Infrastructure Ready | 🟡 Templates Need Migration  
**Blocking Issue**: Schema mismatch between bootstrap templates (V1) and V2 API  
**Solution**: Create migration script (Option 1)  
**Estimated Time**: 1-2 hours for migration script + testing

