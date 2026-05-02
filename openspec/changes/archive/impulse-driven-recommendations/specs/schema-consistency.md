# Spec: Schema Consistency - org_id Typing

## Overview

Fix inconsistent org_id field typing across activity-api schemas. Currently mixed usage of `TYPE record<organizations>` vs `TYPE string`. Standardize on `TYPE string` for all tables.

## Scope

### In Scope
- Audit all tables with org_id fields
- Update `TYPE record<organizations>` to `TYPE string`
- Verify RBAC still works with string references
- Test migrations on fresh database
- Document org_id typing convention

### Out of Scope
- Migrating existing data (fresh start)
- Changing RBAC enforcement logic
- Modifying identity-vessel schemas

## Requirements

### Functional Requirements

**FR-1: Identify Tables to Update**

Tables currently using `TYPE record<organizations>`:
```bash
# From grep output:
- composite_sequence_patterns
- impulse (paradigm schema)
- activity (paradigm schema)
- execution (paradigm schema)
- vessel (paradigm schema)
- pattern
- llm_resolution_log
- impulse_data
- impulse_usage_history
- ci_runs
- code_variants
- goal_execution_paths
- activity_dataflows
- activity_prerequisites
- prerequisite_patterns
- execution_sequences
- activity_execution_traces
- activity_composition_graph
- impulse_relevance_metrics
- tool_usage
- thompson_selection_log
- activity_registry
```

**FR-2: Standard Pattern for org_id**

Replace:
```sql
DEFINE FIELD org_id ON table_name TYPE record<organizations>
  ASSERT $value != NONE;
```

With:
```sql
DEFINE FIELD IF NOT EXISTS org_id ON table_name TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";
```

**FR-3: Preserve RBAC Enforcement**

PERMISSIONS clauses should still work with string org_id:

```sql
DEFINE TABLE table_name SCHEMAFULL
  PERMISSIONS
    FOR select, create, update WHERE org_id = $auth.org_id
    FOR delete NONE;
```

This works because:
- `$auth.org_id` is a string in JWT claims
- String comparison `org_id = $auth.org_id` works correctly
- No RECORD type mismatch

**FR-4: Migration Script**

Create `repos/metabob-activity-api/sql/migrations/031-org-id-string-consistency.surql`:

```sql
-- =============================================================================
-- Migration 031: Standardize org_id to TYPE string
-- =============================================================================
-- Convert all org_id fields from TYPE record<organizations> to TYPE string
-- This aligns with schema-migration.md and removes RECORD type dependencies
-- =============================================================================

-- Phase 1: Update core paradigm tables
-- =====================================

-- impulse table
DEFINE FIELD IF NOT EXISTS org_id ON impulse TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- activity table
DEFINE FIELD IF NOT EXISTS org_id ON activity TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- execution table
DEFINE FIELD IF NOT EXISTS org_id ON execution TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- vessel table
DEFINE FIELD IF NOT EXISTS org_id ON vessel TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- Phase 2: Update legacy activity tables
-- ========================================

-- activity_registry
DEFINE FIELD IF NOT EXISTS org_id ON activity_registry TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- activity_execution_traces
DEFINE FIELD IF NOT EXISTS org_id ON activity_execution_traces TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- activity_composition_graph
DEFINE FIELD IF NOT EXISTS org_id ON activity_composition_graph TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- Phase 3: Update impulse tables
-- ===============================

-- impulse_data
DEFINE FIELD IF NOT EXISTS org_id ON impulse_data TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- impulse_usage_history
DEFINE FIELD IF NOT EXISTS org_id ON impulse_usage_history TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- impulse_relevance_metrics
DEFINE FIELD IF NOT EXISTS org_id ON impulse_relevance_metrics TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- Phase 4: Update tool/pattern tables
-- ====================================

-- tool_usage
DEFINE FIELD IF NOT EXISTS org_id ON tool_usage TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- pattern
DEFINE FIELD IF NOT EXISTS org_id ON pattern TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- thompson_selection_log
DEFINE FIELD IF NOT EXISTS org_id ON thompson_selection_log TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- Phase 5: Update composition tables
-- ===================================

-- goal_execution_paths
DEFINE FIELD IF NOT EXISTS org_id ON goal_execution_paths TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- activity_dataflows
DEFINE FIELD IF NOT EXISTS org_id ON activity_dataflows TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- activity_prerequisites
DEFINE FIELD IF NOT EXISTS org_id ON activity_prerequisites TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- prerequisite_patterns
DEFINE FIELD IF NOT EXISTS org_id ON prerequisite_patterns TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- execution_sequences
DEFINE FIELD IF NOT EXISTS org_id ON execution_sequences TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- composite_sequence_patterns
DEFINE FIELD IF NOT EXISTS org_id ON composite_sequence_patterns TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- Phase 6: Update CI/variant tables
-- ==================================

-- ci_runs
DEFINE FIELD IF NOT EXISTS org_id ON ci_runs TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- code_variants
DEFINE FIELD IF NOT EXISTS org_id ON code_variants TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- llm_resolution_log
DEFINE FIELD IF NOT EXISTS org_id ON llm_resolution_log TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Show all tables with org_id field and their types
-- Run after migration to verify all are TYPE string
-- SELECT name, fields.org_id.type FROM INFORMATION_SCHEMA.TABLES WHERE fields.org_id IS NOT NONE;
```

### Non-Functional Requirements

**NFR-1: Idempotent Migration**
- Use `IF NOT EXISTS` for all field definitions
- Can be re-run without errors
- Safe to apply multiple times

**NFR-2: Zero Data Loss**
- Fresh database deployment (no existing production data)
- If data exists, string references will work identically

**NFR-3: RBAC Preserved**
- All PERMISSIONS clauses still enforce org_id isolation
- JWT `$auth.org_id` comparison works with string type
- Multi-tenant isolation maintained

## Implementation Details

### Files to Create

**1. Migration script** (above)
`repos/metabob-activity-api/sql/migrations/031-org-id-string-consistency.surql`

**2. Update schema files**

For each schema file in `repos/metabob-activity-api/sql/schemas/`:
- Replace `TYPE record<organizations>` with `TYPE string` for org_id
- Add comment: `COMMENT "Organization ID (string reference to identity-vessel)"`
- Keep all other fields unchanged

Example:
```sql
-- BEFORE (in 020-paradigm-core-tables.surql):
DEFINE FIELD IF NOT EXISTS org_id ON impulse TYPE record<organizations>
  ASSERT $value != NONE;

-- AFTER:
DEFINE FIELD IF NOT EXISTS org_id ON impulse TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";
```

**3. Documentation**

Create `repos/metabob-activity-api/sql/SCHEMA_CONVENTIONS.md`:

```markdown
# Schema Conventions

## org_id Field Type

**Always use `TYPE string` for org_id fields.**

### Rationale
- Organization records are managed by identity-vessel (separate service)
- No true foreign key constraints across services
- String references are simpler and avoid RECORD type mismatches
- RBAC enforcement works identically with string comparison

### Standard Pattern

```sql
DEFINE FIELD IF NOT EXISTS org_id ON table_name TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference to identity-vessel)";
```

### RBAC Enforcement

```sql
DEFINE TABLE table_name SCHEMAFULL
  PERMISSIONS
    FOR select, create, update WHERE org_id = $auth.org_id
    FOR delete NONE;
```

This works because `$auth.org_id` from JWT is a string.
```

## Verification Steps

**Step 1: Fresh database test**
```bash
# Delete and recreate database
kubectl delete namespace activity-system
helmfile -e local sync

# Check all org_id fields are TYPE string
surreal sql --endpoint http://localhost:8000 --namespace activity-system --database learning_loop --user root --pass root
> INFO FOR TABLE impulse;
# Verify org_id shows TYPE string, not TYPE record
```

**Step 2: Test RBAC enforcement**
```bash
# Create test organization
# Create MiniBob instance with org_id
# Sign in to get JWT
TOKEN=$(curl -X POST http://api.metabob.local/v2/auth/minibob/signin \
  -d '{"instance_id":"test","api_key":"test"}' | jq -r '.token')

# Create impulse with JWT auth
curl -X POST http://api.metabob.local/v2/impulses \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'

# Verify org_id is set correctly
# Verify RBAC filters by org_id
```

**Step 3: Verify migration script**
```bash
# Apply migration to fresh database
surreal import --endpoint http://localhost:8000 \
  --namespace activity-system \
  --database learning_loop \
  --user root --pass root \
  repos/metabob-activity-api/sql/migrations/031-org-id-string-consistency.surql

# Verify no errors
# Verify all tables updated
```

## Testing

### Schema Validation Test

```bash
# Script to verify all org_id fields are TYPE string
#!/usr/bin/env bash

TABLES=(
  "impulse" "activity" "execution" "vessel"
  "activity_registry" "activity_execution_traces"
  "impulse_data" "tool_usage" "pattern"
  # ... all tables with org_id
)

for table in "${TABLES[@]}"; do
  echo "Checking $table..."
  surreal sql --endpoint http://localhost:8000 \
    --namespace activity-system --database learning_loop \
    --user root --pass root \
    "INFO FOR TABLE $table" | grep "org_id.*TYPE string" || echo "❌ FAILED: $table"
done
```

### RBAC Test

```typescript
// Test that RBAC still works with string org_id
import { describe, test, expect } from 'bun:test'

describe('RBAC with string org_id', () => {
  test('should filter by org_id', async () => {
    // Create two orgs
    // Create impulses for each
    // Query as org1, should only see org1 impulses
    // Query as org2, should only see org2 impulses
  })

  test('should enforce org_id on create', async () => {
    // Try to create impulse with wrong org_id
    // Should fail or override with $auth.org_id
  })
})
```

## Acceptance Criteria

- [ ] Migration script created
- [ ] All schema files updated (org_id → TYPE string)
- [ ] Documentation created (SCHEMA_CONVENTIONS.md)
- [ ] Fresh database test passes
- [ ] RBAC enforcement still works
- [ ] No RECORD type references to organizations remain
- [ ] All tables use consistent org_id pattern

## Dependencies

- SurrealDB 3.0.5+ (supports TYPE string for references)
- Fresh database deployment (or no existing data)
- JWT authentication with org_id in $auth
