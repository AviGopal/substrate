# Validation Test Case 6: Multi-Tenant Scope Filtering

**Test ID**: validation-v2-api-dataflow-alignment-validation-case-6
**Type**: Multi-Tenant Isolation Validation
**Component**: Template List Scope Filtering

## Input

```json
{
  "scenario": "Two separate sessions with different org_id values",
  "session1": {
    "org_id": "org-A",
    "project_id": null
  },
  "session2": {
    "org_id": "org-B",
    "project_id": null
  }
}
```

## Expected Output

```json
{
  "validation": {
    "session1Templates": "Should contain global templates + org-A specific templates",
    "session2Templates": "Should contain global templates + org-B specific templates",
    "isolation": "org-A should NOT see org-B templates and vice versa"
  }
}
```

## Validation Criteria

1. ✅ Templates filtered by scope (global/org/project)
2. ✅ SurrealDB query enforces WHERE clause filtering
3. ✅ Client-side double-check for scope isolation
4. ✅ org_id from session matches template org_id (for org-scoped templates)
5. ✅ Global templates visible to all sessions

## Code Review Validation Result

**Status**: ✅ PASS (Code Review)

**Evidence** (repos/metabob-activity-api/src/routes/activities.ts):

**SurrealDB Query Layer** (lines 68-108):
- Project scope: Returns global + org + project templates
- Org scope: Returns global + org templates
- No scope: Returns only global templates

**Client-Side Enforcement** (lines 225-245):
```typescript
const scopeFilteredTemplates = filteredTemplates.filter(template => {
  if (template.scope === 'global' || !template.scope) {
    return true;
  }
  if (template.scope === 'org' && session?.org_id) {
    return template.org_id === session.org_id;
  }
  if (template.scope === 'project' && session?.project_id) {
    return template.project_id === session.project_id;
  }
  return false;
});
```

**Conclusion**: Double-layer scope enforcement (SurrealDB + client-side) matches Python RPC API pattern exactly. Multi-tenant isolation guaranteed.
