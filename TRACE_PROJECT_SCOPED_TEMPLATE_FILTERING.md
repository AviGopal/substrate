# Trace: Project-Scoped Template Filtering Implementation

## Overview
Complete multi-tenant isolation by implementing project-scoped template filtering. Currently supports global and org-scoped templates. This adds the final layer: project-level isolation within organizations.

## Current vs Desired State

### repos/metabob-rpc-api/server/db/operations/template_data.py:95-144 - `list_all_templates`

**Current Behavior:**
Filters templates by scope: (scope=NULL OR scope='global') for unauthenticated, (scope=NULL OR scope='global' OR (scope='org' AND org_id=$org_id)) for authenticated users. Line 106 has TODO comment about project-scoped filtering.

**Desired Behavior:**
Should filter: (scope=NULL OR scope='global') OR (scope='org' AND org_id=$org_id) OR (scope='project' AND project_id=$project_id). Requires project_id parameter extracted from user authentication context.

**Gap:**
Missing project_id parameter in function signature and SurrealDB query WHERE clause. Need to add: 'OR (scope="project" AND project_id = $project_id)' to query lines 126 and 138.

---

### repos/metabob-rpc-api/server/actions/activity.py:88-219 - `list_templates`

**Current Behavior:**
Filters templates by org_id and scope. Lines 186-189 explicitly skip project-scoped templates with TODO comment. Calls list_all_templates(limit, org_id).

**Desired Behavior:**
Should pass project_id to list_all_templates() and remove the project-scope skip logic (lines 185-188). Templates with scope='project' should be included if user's project_id matches.

**Gap:**
Missing project_id parameter in list_templates function signature and list_all_templates call. Remove filtering logic that skips project-scoped templates.

---

### repos/metabob-rpc-api/server/routes/activity.py:64-120 - `list_activity_templates`

**Current Behavior:**
Extracts org_id from Bearer token (lines 105-114) using session_id_from_token helper. Passes org_id to list_templates(). No project_id extraction.

**Desired Behavior:**
Should extract both org_id AND project_id from Bearer token authentication context. Pass both to list_templates(redis, category, limit, org_id, project_id).

**Gap:**
Missing project_id extraction from authentication token. Need to decode/lookup session data to get project_id field.

---

### repos/metabob-rpc-api/server/routes/activity.py:164-254 - `create_activity_template`

**Current Behavior:**
Extracts org_id from Bearer token (lines 234-248). Creates template with scope (default='org') and org_id. No project_id support.

**Desired Behavior:**
Should extract project_id from Bearer token when scope='project'. Store project_id in template record alongside scope and org_id.

**Gap:**
Missing project_id extraction and parameter passing to create_template(). Need to add project_id to create_template function signature.

---

### repos/metabob-rpc-api/server/actions/activity.py:301-454 - `create_template`

**Current Behavior:**
Accepts scope and org_id parameters (line 304-305). Stores them in template record (lines 386-387). No project_id field.

**Desired Behavior:**
Should accept project_id parameter and store it in template record when scope='project'. Template object should include 'project_id': project_id field.

**Gap:**
Missing project_id parameter in function signature and template object construction.

---

### repos/metabob-rpc-api/server/models/auth.py - `SessionData`

**Current Behavior:**
Unknown - file not read yet, but inferred to contain session_id. Used as placeholder for org_id (lines 112-114 in routes/activity.py).

**Desired Behavior:**
Should include org_id and project_id fields in SessionData model. Bearer tokens should contain full authentication context.

**Gap:**
SessionData model likely missing org_id and project_id fields. Need to extend model and populate from authentication system.

---

### repos/metabob-rpc-api/server/actions/auth.py - `session_id_from_token`

**Current Behavior:**
Decodes base64 Bearer token to extract session_id. Returns session_id as string.

**Desired Behavior:**
Should be extended to fetch full SessionData including org_id and project_id from session storage. Or provide helper functions get_org_id_from_token() and get_project_id_from_token().

**Gap:**
Only returns session_id. Need to fetch and return full session context with org_id and project_id.

---

### tests/validation-harnesses/activity-template-scope-assignment-harness.ts:1-488 - `Test Suite`

**Current Behavior:**
Tests org-scoped template creation and filtering. Validates scope='org' and org_id extraction from Bearer token.

**Desired Behavior:**
Should include test cases for project-scoped templates: (1) Create template with scope='project' and project_id, (2) Verify User 1 (Project A) can see template, (3) Verify User 2 (Project B, same org) CANNOT see template, (4) Verify User 3 (different org) CANNOT see template.

**Gap:**
Missing project-scope test cases. Need to add testProjectScopeIsolationWithinOrg() and testProjectScopeIsolationAcrossOrgs().

---

## Data Flow

```
POST /v2/activities/templates OR GET /v2/activities/templates
↓
Bearer token → session_id_from_token() → SessionData lookup → extract org_id + project_id
↓
create_activity_template() → extract scope, org_id, project_id → create_template(redis, template_data, scope, org_id, project_id) → SurrealDB write with scope/org_id/project_id fields
↓
list_activity_templates() → extract org_id, project_id → list_templates(redis, category, limit, org_id, project_id) → list_all_templates(limit, org_id, project_id) → SurrealDB query with WHERE clause filtering by scope/org_id/project_id
↓
Validation harness creates templates with different scopes, queries as different users, verifies isolation
```

## Implementation Plan

### Phase 1: Extend SessionData Model
- Add org_id field to SessionData model in server/models/auth.py
- Add project_id field to SessionData model
- Update create_session_model() to populate org_id and project_id from request context
- Update fetch_session_model() to return full SessionData with org_id and project_id

### Phase 2: Update Template Data Operations
- Add project_id parameter to list_all_templates() in template_data.py:95
- Update SurrealDB query at line 122-129 to include: OR (scope = 'project' AND project_id = $project_id)
- Update SurrealDB query at line 132-138 for unauthenticated case (no project filtering needed)
- Test SurrealDB query with project_id parameter

### Phase 3: Update Template Actions
- Add project_id parameter to list_templates() in activity.py:88
- Remove project-scope skip logic at lines 185-188
- Pass project_id to list_all_templates() call at line 120
- Add project_id parameter to create_template() at line 301
- Add project_id to template object construction at lines 373-394
- Pass project_id to create_template_record() at line 398

### Phase 4: Update API Routes
- Update list_activity_templates() in routes/activity.py:64 to extract project_id from Bearer token
- Pass project_id to list_templates() call at line 116
- Update create_activity_template() at line 164 to extract project_id from Bearer token
- Pass project_id to create_template() call at line 250
- Handle scope='project' validation (require project_id when scope is 'project')

### Phase 5: Extend Validation Harness
- Add testProjectScopeCreation() test case
- Add testProjectScopeIsolationWithinOrg() - User 1 (Project A) vs User 2 (Project B, same org)
- Add testProjectScopeIsolationAcrossOrgs() - User 1 (Org A, Project A) vs User 3 (Org B, Project C)
- Update test Bearer tokens to include project_id in session data
- Run validation harness and verify all tests pass

## Security Considerations

- Bearer tokens must include project_id to prevent privilege escalation
- SurrealDB query MUST check project_id match for scope='project' templates
- Users in same org but different projects must NOT see each other's project-scoped templates
- project_id should be validated against user's accessible projects (not just any UUID)

## Backward Compatibility

- Existing global templates (scope=NULL or scope='global') remain visible to all users
- Existing org-scoped templates (scope='org') remain visible to all users in that org
- New project-scoped templates (scope='project') add finer isolation without breaking existing behavior
- Default scope remains 'org' when not specified (line 232 in routes/activity.py)

## Test Strategy

- **Unit**: Test list_all_templates() with various combinations of org_id and project_id
- **Integration**: Test create_template() → list_templates() flow with project-scoped templates
- **E2E**: Validation harness with 3 users: User1 (Org A, Project A), User2 (Org A, Project B), User3 (Org B, Project C)

## Key Files to Modify

1. `repos/metabob-rpc-api/server/models/auth.py` - Add org_id and project_id to SessionData
2. `repos/metabob-rpc-api/server/actions/auth.py` - Extend session_id_from_token to fetch full context
3. `repos/metabob-rpc-api/server/db/operations/template_data.py` - Add project_id filtering to queries
4. `repos/metabob-rpc-api/server/actions/activity.py` - Add project_id parameter to list_templates and create_template
5. `repos/metabob-rpc-api/server/routes/activity.py` - Extract project_id from token and pass through
6. `tests/validation-harnesses/activity-template-scope-assignment-harness.ts` - Add project-scope tests

## Expected Outcome

After implementation:
- Templates with `scope='project'` are only visible to users with matching `project_id`
- Users in Project A cannot see templates from Project B, even if in same organization
- All existing global and org-scoped templates continue to work
- System achieves 100% compliance with multi-tenant isolation specification
