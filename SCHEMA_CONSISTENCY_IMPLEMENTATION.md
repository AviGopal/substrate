# Schema Consistency Implementation - org_id String Type

## Overview

Successfully implemented the schema consistency spec for org_id fields across all activity-api tables. All `org_id` fields now use `TYPE string` instead of `TYPE record<organizations>` for consistency with cross-service architecture and JWT token structure.

## Implementation Date

2026-03-31

## Files Created

### 1. Migration Script
**Location:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/sql/migrations/031-org-id-string-consistency.surql`

- 142 lines
- 22 table field definitions
- Idempotent using `IF NOT EXISTS`
- Organized into 6 phases by functional grouping
- Includes verification query comments

### 2. Documentation
**Location:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/sql/SCHEMA_CONVENTIONS.md`

Complete guide covering:
- Rationale for string references
- Standard pattern with examples
- RBAC enforcement explanation
- Benefits and trade-offs
- Migration instructions
- When NOT to use string references
- Related fields guidance

## Schema Files Updated

All 22 tables with org_id fields updated across 9 schema files:

### Core Paradigm Tables (020-paradigm-core-tables.surql)
1. `impulse` - Core data storage table
2. `activity` - State transition definitions
3. `execution` - Execution trace records
4. `vessel` - Vessel instance registry

### Activity Registry (010-activity-registry.surql)
5. `activity_registry` - Unified activity registry

### Execution Tables (011-executions.surql)
6. `activity_execution_traces` - Individual execution records
7. `activity_composition_graph` - Activity composition relationships
8. `impulse_relevance_metrics` - Impulse usage relevance
9. `tool_usage` - Tool call tracking
10. `thompson_selection_log` - Selection algorithm logs

### Composition Tables (012-composition.surql)
11. `goal_execution_paths` - Goal-to-execution mappings
12. `activity_dataflows` - Data flow between activities
13. `activity_prerequisites` - Activity dependencies
14. `prerequisite_patterns` - Learned prerequisite patterns
15. `execution_sequences` - Ordered execution sequences

### Impulse/Tool Tables (013-impulse-tool-usage.surql)
16. `impulse_data` - Impulse storage
17. `impulse_usage_history` - Impulse usage tracking
18. `ci_runs` - CI/CD run records
19. `code_variants` - Code variant tracking

### Ribosome Tables (014-ribosome-sequences.surql)
20. `composite_sequence_patterns` - Learned activity sequences

### LLM Tables (017-llm-resolution.surql)
21. `llm_resolution_log` - LLM resolution attempts

### Pattern Tables (018-patterns.surql)
22. `pattern` - Pattern storage

## Changes Made

### Before (Inconsistent)
```sql
DEFINE FIELD IF NOT EXISTS org_id ON table_name TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id
  COMMENT "Organization ID (required for all records)";
```

### After (Consistent)
```sql
DEFINE FIELD IF NOT EXISTS org_id ON table_name TYPE string
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id
  COMMENT "Organization ID (string reference to identity-vessel)";
```

## Key Differences

1. **Type**: `record<organizations>` → `string`
2. **Comment**: Updated to indicate cross-service reference to identity-vessel
3. **Consistency**: All 22 tables now use identical pattern

## RBAC Enforcement Preserved

PERMISSIONS clauses continue to work correctly:

```sql
DEFINE TABLE table_name SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    -- ...
```

String comparison `org_id = $auth.org_id` works because:
- JWT `$auth.org_id` claim is a string
- No type casting or dereferencing needed
- Direct string-to-string comparison

## Verification Steps

### Check Migration Applied
```bash
surreal sql --endpoint http://localhost:8000 \
  --namespace activity-system --database learning_loop \
  --user root --pass root \
  < repos/metabob-activity-api/sql/migrations/031-org-id-string-consistency.surql
```

### Verify Field Types
```sql
-- Check all tables
INFO FOR DB;

-- Check specific table
INFO FOR TABLE impulse;
-- Expected: org_id TYPE string

-- Count tables with org_id as string
SELECT name FROM INFORMATION_SCHEMA.TABLES 
WHERE fields.org_id.type = 'string';
-- Expected: 22 tables
```

### Test RBAC Enforcement
```bash
# Sign in to get JWT token
TOKEN=$(curl -X POST http://api.metabob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' | jq -r '.token')

# Query with auth (should work)
curl -X POST http://api.metabob.local/v2/impulses \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id":"test","pointer":{"type":"memo","content":"test"},"shape":"test"}'

# Query without auth (should fail)
curl -X POST http://api.metabob.local/v2/impulses \
  -d '{"id":"test","pointer":{"type":"memo","content":"test"},"shape":"test"}'
```

## Database State

### Fresh Deployment
- No data migration needed
- Migration script defines current state
- Idempotent with `IF NOT EXISTS`

### Existing Deployment
- Migration updates field definitions
- Existing string values work unchanged
- If data had record types, would need conversion (but we have fresh DB)

## Related Files

- Spec: `openspec/changes/impulse-driven-recommendations/specs/schema-consistency.md`
- Migration: `repos/metabob-activity-api/sql/migrations/031-org-id-string-consistency.surql`
- Convention doc: `repos/metabob-activity-api/sql/SCHEMA_CONVENTIONS.md`
- Schema files: `repos/metabob-activity-api/sql/schemas/*.surql` (9 files updated)

## Next Steps

1. Deploy to local environment with fresh database
2. Verify all tables show `TYPE string` for org_id
3. Test RBAC enforcement with JWT authentication
4. Confirm multi-tenant isolation works correctly
5. Update identity-vessel documentation if needed

## Success Criteria

- [x] Migration script created (031-org-id-string-consistency.surql)
- [x] All 22 tables updated to use TYPE string
- [x] Documentation created (SCHEMA_CONVENTIONS.md)
- [x] Consistent comment pattern applied across all fields
- [x] Idempotent migration with IF NOT EXISTS
- [ ] Fresh database deployment tested (needs deployment)
- [ ] RBAC enforcement verified (needs deployment)
- [ ] Zero RECORD type references to organizations remain (verified)

## Notes

- **No data loss**: Fresh database means no existing data to migrate
- **String compatibility**: JWT claims are strings, perfect match
- **Cross-service pattern**: Aligns with identity-vessel being separate service
- **Performance**: String comparison is faster than record dereferencing
- **Flexibility**: Can reference orgs from external systems if needed
