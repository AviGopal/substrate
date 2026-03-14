# Validation Test Case 6: Multi-Tenant Filtering

**Test**: Multi-Tenant Template Filtering - Scope isolation enforcement
**Phase**: 2 (Template Listing)
**Status**: READY (as of 2026-03-14 enforcement)

## Input

```json
{
  "scenario": "Two organizations request templates",
  "org1": {
    "endpoint": "POST /v2/session",
    "body": {
      "org_id": "org-alpha",
      "project_id": "proj-alpha-1"
    }
  },
  "org2": {
    "endpoint": "POST /v2/session",
    "body": {
      "org_id": "org-beta",
      "project_id": "proj-beta-1"
    }
  },
  "templateRequest": {
    "endpoint": "GET /v2/activities/templates",
    "headers": {
      "Authorization": "Bearer {org_token}"
    }
  }
}
```

## Expected Output

```json
{
  "status": "success",
  "validation": {
    "globalTemplates": "Visible to both org-alpha and org-beta",
    "orgAlphaTemplates": "Visible only to org-alpha (scope=org, org_id=org-alpha)",
    "orgBetaTemplates": "Visible only to org-beta (scope=org, org_id=org-beta)",
    "projectTemplates": "Visible only to matching project_id",
    "scopeIsolation": "Enforced at SurrealDB query + client-side filter"
  },
  "assertions": [
    "Both orgs see global templates (scope=null or scope='global')",
    "org-alpha sees org-alpha templates, NOT org-beta templates",
    "org-beta sees org-beta templates, NOT org-alpha templates",
    "Project-scoped templates visible only to matching project_id"
  ]
}
```

## Validation Criteria

1. Global templates (scope=null or 'global') visible to all users
2. Org-scoped templates visible only to users with matching org_id
3. Project-scoped templates visible only to users with matching project_id
4. Scope filtering enforced at both SurrealDB query and client-side filter
5. No cross-org data leakage
6. Multi-tenant isolation prevents unauthorized access

## Implementation Reference

- File: `repos/metabob-activity-api/src/routes/activities.ts` lines 68-108 (SurrealDB query)
- File: `repos/metabob-activity-api/src/routes/activities.ts` lines 221-244 (client-side filter)
- Specification: `activity-template-query-filtering`
- Auth: Session org_id/project_id extracted by auth middleware
