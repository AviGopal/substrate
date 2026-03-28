# Validation Test Case 6: Multi-Tenant Template Filtering

**Test ID**: validation-v2-api-dataflow-alignment-phase2-complete-case-6  
**Phase**: Phase 2 - Template Routes  
**Operation**: Multi-tenant scope isolation  
**Purpose**: Verify org_id-based template filtering enforces multi-tenant isolation

## Input

```json
{
  "setup": [
    "Create session with org_id=org-A",
    "Create session with org_id=org-B",
    "Query templates with org-A token",
    "Query templates with org-B token"
  ]
}
```

## Expected Output

```json
{
  "validation": [
    "org-A session sees global + org-A templates",
    "org-B session sees global + org-B templates",
    "org-A session does NOT see org-B templates",
    "org-B session does NOT see org-A templates",
    "Multi-tenant isolation enforced at DB and client layers",
    "SurrealDB query includes WHERE clause for scope filtering"
  ]
}
```

## Validation Criteria

1. **Session Isolation**: Different org_id sessions return different template sets
2. **Global Templates**: Both orgs see global templates (scope IS NULL or scope = 'global')
3. **Org-Scoped Templates**: Only visible to matching org_id
4. **Project-Scoped Templates**: Only visible to matching project_id
5. **Database Filtering**: SurrealDB query uses WHERE clause:
   ```sql
   WHERE (
     scope IS NULL
     OR scope = 'global'
     OR (scope = 'org' AND org_id = $org_id)
     OR (scope = 'project' AND project_id = $project_id)
   )
   ```
6. **Client-Side Filtering**: Additional filtering in application code (defense-in-depth)

## Test Implementation

Location: `tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts:467-552`

Function: `testMultiTenantFiltering()`

## Expected Result

**PASS** - Multi-tenant isolation working correctly, templates filtered by org_id/project_id scope

## Security Implications

This test validates critical security requirements:
- Tenant data isolation (org-A cannot see org-B templates)
- Defense-in-depth (DB + client-side filtering)
- Prevents unauthorized access to private templates
- Ensures compliance with multi-tenant architecture specification
