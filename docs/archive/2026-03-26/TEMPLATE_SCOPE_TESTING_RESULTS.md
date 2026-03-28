# Template Scope & Isolation Testing Results

## Executive Summary

**Date**: 2026-03-01  
**Tested Component**: Activity Template Scope System in DevBob K8s  
**Status**: ⚠️ Scope system not fully implemented  

### Key Findings

1. ✅ **Template Registration Works**: Successfully registered 6 templates to SurrealDB
2. ✅ **Multi-Org Support Works**: Created 2 separate organizations with distinct users
3. ⚠️ **Scope Field Not Set**: Templates saved with `scope=null` regardless of input
4. ⚠️ **Org ID Not Set**: Templates saved with `org_id=null` regardless of input
5. ✅ **Templates Visible Globally**: All users can see all templates (expected behavior for null scope/org)

---

## Test Setup

### Organizations Created

| Org | Email | User ID | Org ID |
|-----|-------|---------|--------|
| Org 1 | devbob-test@local.dev | f5594fa0-d5ae-40ab-a0fa-02a598f1516d | 3135883c-8be3-4b2b-bdd8-dbe2e427358f |
| Org 2 | devbob-test2@local.dev | (generated) | e6b7c99d-1a5b-444b-9437-5c53793933a1 |

### Templates Registered

Total: 6 templates in SurrealDB

1. **trace-enforce-validate-loop** (infrastructure-040f0daf)
2. **Manage Session Memory** (infrastructure-cbfca84f)
3. **Create Activity Template** (infrastructure-63b45ffc)
4. **Debug Activity Execution** (infrastructure-096d6eee)
5. **Org-Specific Test Template** (infrastructure-313e5bea) - attempted org scope
6. **trace-data-flow-single-feature** (infrastructure-aacb0bb7)

---

## Test Results

### Test 1: Template Registration ✅

**Method**: POST to `/v2/activities/templates` with Bearer token

**Result**: SUCCESS
- 6 templates registered successfully
- HTTP 201 responses for all registrations
- Templates persisted to SurrealDB
- Templates visible via GET endpoint

### Test 2: Scope Field Assignment ⚠️

**Method**: Register template with explicit scope/org_id in JSON payload

**Input**:
```json
{
  "name": "Org-Specific Test Template",
  "scope": "org",
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
  ...
}
```

**Expected**:
```json
{
  "id": "infrastructure-313e5bea",
  "scope": "org",
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f"
}
```

**Actual**:
```json
{
  "id": "infrastructure-313e5bea",
  "scope": null,
  "org_id": null,
  "project_id": null
}
```

**Conclusion**: Scope and org_id fields are NOT being set during template creation.

### Test 3: Multi-Org Visibility ✅

**Method**: Query templates from User 1 (Org 1) and User 2 (Org 2)

**Results**:

User 1 Query:
```
Total: 6 templates
  - trace-data-flow-single-feature
  - Manage Session Memory
  - trace-enforce-validate-loop
  - Org-Specific Test Template
  - Create Activity Template
  - Debug Activity Execution (Self-Contained)
```

User 2 Query:
```
Total: 6 templates
  - trace-data-flow-single-feature
  - Manage Session Memory
  - trace-enforce-validate-loop
  - Org-Specific Test Template
  - Create Activity Template
  - Debug Activity Execution (Self-Contained)
```

**Conclusion**: Both users see identical template sets. Since all templates have `scope=null` and `org_id=null`, this is the expected behavior for "global" templates.

### Test 4: Activity Execution ⚠️

**Method**: Attempted to execute activity via `opencode run` command

**Result**: FAILED - ProviderInitError

**Error**:
```
ProviderInitError: ProviderInitError
 data: {
  providerID: "anthropic",
},
```

**Cause**: ANTHROPIC_API_KEY in container is not a valid API key (appears to be base64-encoded session token)

**Impact**: Could not test:
- Activity execution with scope-filtered templates
- Activity persistence to SurrealDB
- Template selection based on org/project context

---

## Architecture Analysis

### Current Implementation

```
Template Registration Flow:
┌─────────────┐         ┌──────────────┐         ┌───────────────┐
│ OpenCode    │ ──POST→ │ RPC API      │ ──SQL→  │ SurrealDB     │
│ CLI         │         │ /v2/activi-  │         │ activity_     │
│             │         │ ties/template│         │ templates     │
└─────────────┘         └──────────────┘         └───────────────┘
                              │
                              ├─ Validates auth token ✅
                              ├─ Parses template JSON ✅
                              ├─ Stores to database ✅
                              └─ Sets scope/org_id? ❌
```

### Expected Scope Behavior

| Scope | Org ID | Project ID | Visibility |
|-------|--------|------------|------------|
| `global` | null | null | All users across all orgs |
| `org` | set | null | Users within the same org |
| `project` | set | set | Users within the same project |
| `null` | null | null | Defaults to global (current behavior) |

### Template Query Filtering Logic (Expected)

When querying `/v2/activities/templates`:

1. **Global templates** (scope=global or null): Always visible
2. **Org templates** (scope=org): Visible only if `template.org_id == user.org_id`
3. **Project templates** (scope=project): Visible only if `template.project_id == user.project_id`

---

## Root Cause Analysis

### Potential Issues

1. **Backend Not Setting Scope/Org**:
   - RPC API may not be extracting scope/org_id from request body
   - Database model may not have these fields
   - ORM mapping may be incomplete

2. **Frontend Not Sending Scope/Org**:
   - OpenCode CLI may not include scope/org_id when registering
   - Local templates don't have these fields populated

3. **Database Schema Missing Fields**:
   - SurrealDB table may not have scope/org_id/project_id columns
   - Schema migration may not have been run

### Verification Commands

```bash
# Check if SurrealDB schema has scope fields
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/json" \
  -d "{\"ns\": \"metabob\", \"db\": \"production\", \"query\": \"INFO FOR TABLE activity_templates;\"}"
' | python3 -m json.tool

# Check RPC API logs for scope handling
kubectl logs -n metabob metabob-rpc-api-56d8fb8c46-tspz4 -c rpc-api | grep -i "scope\|org_id"
```

---

## Recommendations

### Immediate Actions

1. **Verify Database Schema**:
   - Check if `activity_templates` table has `scope`, `org_id`, `project_id` columns
   - Run schema migrations if needed

2. **Check RPC API Backend Code**:
   - Review `/v2/activities/templates` POST handler
   - Verify ActivityTemplate model includes scope fields
   - Check if org_id is extracted from Bearer token

3. **Test Manual Scope Assignment**:
   - Insert template directly into SurrealDB with scope/org_id set
   - Query as different users to verify filtering logic exists

4. **Fix Anthropic API Key**:
   - Set valid ANTHROPIC_API_KEY in devbob StatefulSet
   - Restart pods to test activity execution

### Implementation Plan

**Phase 1: Schema Verification**
```sql
-- Check current schema
INFO FOR TABLE activity_templates;

-- Add fields if missing
DEFINE FIELD scope ON TABLE activity_templates TYPE option<string>;
DEFINE FIELD org_id ON TABLE activity_templates TYPE option<string>;
DEFINE FIELD project_id ON TABLE activity_templates TYPE option<string>;
```

**Phase 2: Backend Fix**
```python
# In RPC API template creation endpoint
def create_template(template_data: dict, user_context: UserContext):
    # Extract org from user token
    org_id = user_context.org_id
    
    # Set scope based on input or default to org
    scope = template_data.get('scope', 'org')
    
    # Save with scope/org
    template = ActivityTemplate(
        **template_data,
        scope=scope,
        org_id=org_id if scope in ['org', 'project'] else None,
        project_id=template_data.get('project_id')
    )
    return template.save()
```

**Phase 3: Query Filtering**
```python
def list_templates(user_context: UserContext):
    # Global templates
    query = "SELECT * FROM activity_templates WHERE scope = 'global' OR scope IS NULL"
    
    # Add org templates
    query += f" OR (scope = 'org' AND org_id = '{user_context.org_id}')"
    
    # Add project templates if project context exists
    if user_context.project_id:
        query += f" OR (scope = 'project' AND project_id = '{user_context.project_id}')"
    
    return execute_query(query)
```

---

## Testing Scripts Created

1. **`test-template-registration-k8s.sh`** - Basic registration test
2. **`test-scope-filtering-comprehensive.sh`** - Multi-org setup and testing
3. **`verify-scope-isolation.sh`** - Detailed isolation verification
4. **`final-scope-test.sh`** - Comprehensive scope behavior validation
5. **`register-templates-manually.sh`** - Individual template registration

---

## Next Steps

### For Developers

1. Review `metabob-rpc-api` source code:
   - `server/routes/v2_activities.py` (or similar)
   - `server/models/activity_template.py`
   - `server/utils/surreal_client.py`

2. Check SurrealDB schema:
   - Connect to SurrealDB pod
   - Run `INFO FOR DB;` and `INFO FOR TABLE activity_templates;`

3. Test with valid Anthropic API key:
   - Update StatefulSet environment
   - Execute full activity workflow

### For Users

**Current Workaround**: All templates are global by default, which works for:
- Single-tenant deployments
- Small teams sharing all templates
- Development/testing environments

**Not Supported (Yet)**:
- Org-scoped template isolation
- Project-scoped templates
- Multi-tenant template separation

---

## Conclusion

The DevBob K8s deployment is **functional for template storage and retrieval**, but **scope/org isolation is not yet implemented**. All templates are effectively global.

This is likely a **backend implementation gap** rather than an architectural issue. The infrastructure (SurrealDB, authentication, multi-org support) is in place and working correctly.

**Impact**: 
- ✅ Can use templates across the platform
- ✅ Multi-org auth works
- ⚠️ No template isolation between organizations
- ⚠️ Cannot test org-specific or project-specific templates

**Severity**: Medium (functionality works, but multi-tenancy not enforced)

---

**Document Version**: 1.0  
**Test Date**: 2026-03-01  
**Tester**: Activity Mode  
**Platform**: DevBob K8s (Docker Desktop)
