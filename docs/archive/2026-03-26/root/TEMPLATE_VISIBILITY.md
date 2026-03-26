# Template Visibility Scoping

This document describes how activity templates are scoped for visibility across the multi-tenant system.

## Core Concept

Template visibility is **simple access control**, not a marketplace. Templates are visible based on their scope field combined with the user's authentication context. There is no publishing workflow, ratings, or discovery mechanism - just RBAC-enforced visibility.

## Visibility Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TEMPLATE VISIBILITY LEVELS                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  GLOBAL (scope='global', public=true)                                        │
│  ────────────────────────────────────                                        │
│  Visible to all authenticated users                                          │
│  Example: Official Metabob templates, shared infrastructure recipes          │
│                                                                              │
│  PERMISSIONS: FOR select WHERE scope = 'global' AND public = true            │
│                                                                              │
│  Use case: Baseline templates that any organization can use                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  ORG-SCOPED (scope='org')                                                    │
│  ────────────────────────                                                    │
│  Visible to all members of the owning organization                           │
│  Example: Company-specific deployment templates, internal workflows          │
│                                                                              │
│  PERMISSIONS: FOR select WHERE org_id = $auth.org_id                         │
│                                                                              │
│  Use case: Templates shared within a company but not externally              │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PROJECT-SCOPED (scope='project')                                            │
│  ────────────────────────────────                                            │
│  Visible only to members of the specific project                             │
│  Example: Team-specific workflows, experimental templates                    │
│                                                                              │
│  PERMISSIONS: FOR select WHERE project_id IN $auth.project_ids               │
│                                                                              │
│  Use case: Templates for a specific team or codebase                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```surql
DEFINE TABLE activity_template SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      (scope = 'global' AND public = true)
      OR org_id = $auth.org_id
      OR (project_id IS NOT NONE AND project_id IN $auth.project_ids)
    FOR create, update, delete WHERE org_id = $auth.org_id;

-- Scope field determines visibility level
DEFINE FIELD scope ON activity_template TYPE string
  ASSERT $value IN ['global', 'org', 'project']
  DEFAULT 'org';

-- Public flag only matters for global scope
DEFINE FIELD public ON activity_template TYPE bool
  DEFAULT false;

-- Every template belongs to an organization
DEFINE FIELD org_id ON activity_template TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

-- Project scope is optional (only for project-scoped templates)
DEFINE FIELD project_id ON activity_template TYPE option<record<projects>>;
```

## How It Works

### Creating Templates

When a user creates a template, the `org_id` is automatically set from their JWT claims:

```typescript
// In activities.ts
const templateRecord = {
  name: validated.name,
  scope: validated.scope || 'org',  // Default to org-scoped
  public: validated.public || false,
  org_id: orgId,  // From JWT $auth.org_id
  project_id: projectId,  // Optional, from JWT $auth.project_id
};
```

### Querying Templates

The API has two paths for template queries:

**JWT Auth Path (RBAC-enforced):**
```typescript
// Uses SurrealDB PERMISSIONS clauses
const templates = await db.queryWithAuth(token, `
  SELECT * FROM activity_template
  ORDER BY created_at DESC
  LIMIT $limit
`);
// SurrealDB automatically filters based on $auth claims
```

**Redis Session Path (Application-level):**
```typescript
// Application applies WHERE clauses
const query = `
  SELECT * FROM activity_template
  WHERE (
    scope IS NULL
    OR scope = 'global'
    OR (scope = 'org' AND org_id = $org_id)
    OR (scope = 'project' AND project_id = $project_id)
  )
  ORDER BY created_at DESC
`;
```

## API Parameters

### List Templates

```bash
# All visible templates (org + global)
GET /v2/activities/templates

# Only global templates
GET /v2/activities/templates?scope=global

# Only org-scoped templates
GET /v2/activities/templates?scope=org

# Only project-scoped templates
GET /v2/activities/templates?scope=project
```

### Create Template

```bash
POST /v2/activities/templates
{
  "name": "deploy-backend",
  "description": "Deploy backend services",
  "scope": "org",           # or "global", "project"
  "public": false,          # Only relevant for scope=global
  "project_id": "project:backend"  # Required if scope=project
}
```

## What This Is NOT

This visibility system is **not a marketplace**:

| Marketplace Feature | Our System |
|---------------------|------------|
| Publishing workflow | ❌ Direct creation with scope field |
| Discovery/search | ❌ Simple filtered list |
| Ratings/reviews | ❌ Not implemented |
| Featured templates | ❌ Not implemented |
| Fork/clone | ❌ Copy manually if needed |
| Download counts | ❌ Not tracked |
| Author profiles | ❌ Just org_id ownership |

## Why Not a Marketplace?

The metabob system is built on the **process-of-becoming** - continuous learning from execution. Value comes from:

1. **Measured execution** - Templates are selected via Thompson Sampling based on success rates
2. **Automatic improvement** - Failed executions create variants through trailblazing
3. **Composition learning** - Backend learns which template sequences achieve goals

Publishing and discovery features would add complexity without improving learning. The system optimizes templates based on measured outcomes, not human curation.

## Related Documentation

- `docs/RBAC_GUIDE.md` - PERMISSIONS clause patterns
- `docs/MULTI_TENANT_ARCHITECTURE.md` - Tenancy model
- `DEPLOYMENT_GUIDE.md` - Stack deployment activities
