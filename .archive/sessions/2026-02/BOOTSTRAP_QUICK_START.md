# Activity Template Bootstrap - Quick Start Guide

**For**: Developers and agents setting up a new metabob-devbob instance  
**Time**: 5 minutes  
**Result**: Fully functional activity template system with 5 core templates

---

## Prerequisites

1. Backend services running:
   ```bash
   docker-compose up -d surreal redis api-server
   ```

2. Backend healthy:
   ```bash
   curl http://localhost:8080/status
   # Should return: {"status":"ok","version":"0.16.0"}
   ```

---

## Step 1: Create Session Token

```bash
cd /path/to/metabob-devbob
python3 scripts/create_session_state.py
```

**Output**:
```
✅ Session created with 24-hour token
✅ Stored in .metabob/state
```

**Files created**:
- `.metabob/state` - Contains session token for API authentication

---

## Step 2: Bootstrap Core Templates

```bash
python3 scripts/bootstrap_core_templates.py
```

**Output**:
```
============================================================
BOOTSTRAP CORE ACTIVITY TEMPLATES
============================================================

1. Getting session token...
   ✓ Token loaded

2. Checking backend...
   ✓ Backend reachable (0 existing templates)

3. Uploading core templates...

============================================================
Uploading: activity-create-v2.json
============================================================
  Context Requirements: 3
    - pattern-source: REQUIRED
    - similar-templates: optional
    - validation-context: optional
✅ Uploaded successfully: activity-create-29e9d6c5

...

============================================================
BOOTSTRAP SUMMARY
============================================================
✅ Uploaded: 5
   - activity-create-v2.json → activity-create-29e9d6c5
   - feature-impl.json → feature-impl-c4b2e8ee
   - bug-fix.json → bug-fix-93374d0f
   - refactor.json → refactor-72eb4607
   - add-rest-endpoint.json → add-rest-endpoint-97b69d8d

✨ BOOTSTRAP COMPLETE - All core templates uploaded!
```

---

## Step 3: Verify Templates

```bash
python3 << 'EOF'
import requests, json

token = json.load(open('.metabob/state'))['session_metadata']['session_token']
headers = {'Authorization': f'Bearer {token}'}

response = requests.get('http://localhost:8080/v2/activities/templates', headers=headers)
templates = response.json()['templates']

print(f'Total templates: {len(templates)}')
for t in templates:
    if any(k in t['variant_id'] for k in ['feature', 'bug', 'refactor', 'activity', 'endpoint']):
        print(f'  ✅ {t["variant_id"]} ({len(t.get("task_steps", []))} steps)')
EOF
```

**Expected Output**:
```
Total templates: 5
  ✅ feature-impl-c4b2e8ee (5 steps)
  ✅ bug-fix-93374d0f (4 steps)
  ✅ refactor-72eb4607 (4 steps)
  ✅ activity-create-29e9d6c5 (7 steps)
  ✅ add-rest-endpoint-97b69d8d (6 steps)
```

---

## Core Templates Available

### 1. Feature Implementation (`feature-impl-c4b2e8ee`)
**Purpose**: Implement new features following project conventions

**Variables**:
- `feature_name` (string, required)
- `feature_description` (string, required)
- `target_location` (string, required)

**Context Requirements**:
- ✅ **codebase-patterns** (REQUIRED): Existing code patterns for reference
- **project-conventions** (optional): Project coding standards
- **dependency-context** (optional): Related components

**Steps**: 5 (understand → design → implement → integrate → test)

**Example Usage**:
```javascript
activity({
  activityId: "feature-impl-c4b2e8ee",
  variables: {
    feature_name: "User authentication",
    feature_description: "JWT-based auth with refresh tokens",
    target_location: "src/auth/"
  },
  reason: "Implement user authentication system"
})
```

---

### 2. Bug Fix (`bug-fix-93374d0f`)
**Purpose**: Systematically fix bugs with proper analysis and testing

**Variables**:
- `bug_description` (string, required)
- `error_message` (string, required)
- `affected_files` (array, required)

**Context Requirements**:
- ✅ **bug-context** (REQUIRED): Bug reports, stack traces, logs
- ✅ **affected-code** (REQUIRED): Files and components affected
- **similar-fixes** (optional): Past bug fixes for patterns

**Steps**: 4 (analyze → fix → test → commit)

**Example Usage**:
```javascript
activity({
  activityId: "bug-fix-93374d0f",
  variables: {
    bug_description: "Session timeout not working",
    error_message: "TypeError: Cannot read property 'expiresAt'",
    affected_files: ["src/session.ts", "src/middleware/auth.ts"]
  },
  reason: "Fix session timeout bug"
})
```

---

### 3. Refactor (`refactor-72eb4607`)
**Purpose**: Improve code structure while maintaining functionality

**Variables**:
- `target_component` (string, required)
- `refactor_goal` (string, required)
- `constraints` (string, required)

**Context Requirements**:
- ✅ **target-code** (REQUIRED): Code to be refactored
- ✅ **usage-patterns** (REQUIRED): How the code is used
- **test-coverage** (optional): Existing tests to maintain

**Steps**: 4 (analyze → plan → refactor → verify)

**Example Usage**:
```javascript
activity({
  activityId: "refactor-72eb4607",
  variables: {
    target_component: "UserService",
    refactor_goal: "Extract database logic to repository pattern",
    constraints: "Maintain backward compatibility"
  },
  reason: "Refactor UserService for better separation of concerns"
})
```

---

### 4. Activity Create (`activity-create-29e9d6c5`)
**Purpose**: Create new activity templates (self-hosting!)

**Variables**:
- `source_pattern` (string, optional): Description of successful interaction
- `activity_name` (string, required): Name for new activity
- `activity_id` (string, required): ID for new activity
- `target_category` (string, required): Category (feature-impl, bug-fix, etc.)
- `test_variables` (object, optional): Test variables to validate

**Context Requirements**:
- ✅ **pattern-source** (REQUIRED): Source interaction to formalize
- **similar-templates** (optional): Existing templates for reference
- **validation-context** (optional): Test data

**Steps**: 7 (identify → define → design → create → validate → test → summarize)

**Example Usage**:
```javascript
activity({
  activityId: "activity-create-29e9d6c5",
  variables: {
    activity_name: "Deploy to Production",
    activity_id: "deploy-production-v1",
    target_category: "infrastructure",
    source_pattern: "Recent successful production deployments"
  },
  reason: "Create template for production deployment workflow"
})
```

---

### 5. Add REST Endpoint (`add-rest-endpoint-97b69d8d`)
**Purpose**: Add new REST API endpoints with validation and tests

**Variables**:
- `method` (string, required): HTTP method (GET, POST, PUT, DELETE)
- `path` (string, required): Endpoint path
- `description` (string, required): What the endpoint does
- `request_schema` (string, optional): Request body schema
- `response_schema` (string, optional): Response schema

**Context Requirements**:
- ✅ **api-context** (REQUIRED): Existing API structure
- ✅ **endpoint-spec** (REQUIRED): Endpoint requirements

**Steps**: 6 (analyze → design → implement → validate → test → document)

**Example Usage**:
```javascript
activity({
  activityId: "add-rest-endpoint-97b69d8d",
  variables: {
    method: "POST",
    path: "/api/users/:id/profile",
    description: "Update user profile information",
    request_schema: "{ name: string, email: string, avatar?: string }"
  },
  reason: "Add profile update endpoint"
})
```

---

## Troubleshooting

### Issue: "No session token in state file"
**Solution**: Run `python3 scripts/create_session_state.py` first

### Issue: "Backend not reachable"
**Solution**: 
```bash
docker-compose up -d surreal redis api-server
curl http://localhost:8080/status
```

### Issue: "Upload failed: 500 - Variant with same content already exists"
**Meaning**: Template already uploaded (this is normal on re-run)  
**Action**: No action needed - template is already in database

### Issue: "Failed to create template" (other errors)
**Solution**: Check backend logs:
```bash
docker logs metabob-rpc-api-server-dev-1 --tail 50
```

---

## Advanced: Manual Template Upload

If you want to upload custom templates:

```python
import requests, json

# Load token
token = json.load(open('.metabob/state'))['session_metadata']['session_token']

# Load template
with open('my-template.json', 'r') as f:
    template = json.load(f)

# Upload
response = requests.post(
    'http://localhost:8080/v2/activities/templates',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        'name': template['variant_name'],
        'description': template['description'],
        'category': template['activity_id'],
        'variables': template['variables'],
        'context_requirements': template.get('context_requirements', []),
        'task_steps': template['task_steps']
    }
)

print(response.json())
```

---

## What's Next?

### Using Templates from OpenCode
Once OpenCode is restarted with the MCP server loaded:

```javascript
// Search for templates
search_activities({ category: "feature", verbose: true })

// Execute template
activity({
  activityId: "feature-impl-c4b2e8ee",
  variables: { feature_name: "...", ... },
  reason: "Implement new feature"
})
```

### Creating More Templates
Use the **activity-create** template to create new templates:

```javascript
activity({
  activityId: "activity-create-29e9d6c5",
  variables: {
    activity_name: "My New Workflow",
    activity_id: "my-workflow-v1",
    target_category: "feature-impl"
  },
  reason: "Formalize successful workflow pattern"
})
```

---

## Files Reference

**Configuration**:
- `.metabob/config.json` - API key and base URL
- `.metabob/state` - Session token (auto-refreshed, 24-hour lifetime)

**Scripts**:
- `scripts/create_session_state.py` - Generate session tokens
- `scripts/bootstrap_core_templates.py` - Upload core templates
- `scripts/migrate_add_context_requirements.py` - Add context requirements to templates

**Templates** (source):
- `repos/metabob-proto/activities/bootstrap/*.json` - Core template definitions

**Documentation**:
- `BOOTSTRAP_VALIDATION_REPORT.md` - Full validation report
- `BOOTSTRAP_QUICK_START.md` - This guide
- `ACTIVITY_SYSTEM_WORKING.md` - System status and architecture

---

## Success Checklist

- [ ] Backend services running (surreal, redis, api-server)
- [ ] Session token created (`.metabob/state` exists)
- [ ] Core templates uploaded (5 templates)
- [ ] Templates verified (query returns 5 templates)
- [ ] Ready to use from OpenCode or Python

---

**Status**: 🟢 **READY FOR USE**  
**Updated**: February 16, 2026  
**Version**: v1.0 (Post-context-requirements fix)
