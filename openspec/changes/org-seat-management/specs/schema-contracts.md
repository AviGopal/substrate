# Schema Contracts - Organization Seat Management

**Created:** 2026-03-25
**Updated:** 2026-03-25

---

## Overview

This document defines the database schema contracts for the seat management feature. All schema changes are owned by `metabob-analysis-api` and stored in `repos/metabob-proto/surrealdb/core/`.

## New Table: seat_allocations

**File:** `repos/metabob-proto/surrealdb/core/006-seat-allocations.surql`

```sql
-- ==========================================================================
-- SEAT ALLOCATIONS TABLE
-- Tracks which users occupy seats in an organization
-- Source of truth for computing seat_usage
-- ==========================================================================

DEFINE TABLE IF NOT EXISTS seat_allocations SCHEMAFULL
  PERMISSIONS
    -- All org members can view allocations
    FOR select WHERE org_id = $auth.org_id
    -- Only admins/owners can create allocations
    FOR create WHERE $auth.role IN ['admin', 'owner'] AND org_id = $auth.org_id
    -- Only admins/owners can delete allocations
    FOR delete WHERE $auth.role IN ['admin', 'owner'] AND org_id = $auth.org_id
    -- No updates allowed - delete and recreate
    FOR update NONE;

-- ==========================================================================
-- FIELDS
-- ==========================================================================

-- Organization this allocation belongs to
DEFINE FIELD IF NOT EXISTS org_id ON seat_allocations TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value;

-- User who occupies this seat
DEFINE FIELD IF NOT EXISTS user_id ON seat_allocations TYPE record<users>
  ASSERT $value != NONE
  VALUE $value;

-- When the seat was allocated
DEFINE FIELD IF NOT EXISTS allocated_at ON seat_allocations TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

-- Who allocated the seat (null for system/migration)
DEFINE FIELD IF NOT EXISTS allocated_by ON seat_allocations TYPE option<record<users>>
  VALUE $value;

-- Reason for allocation (manual, invite, migration, etc.)
DEFINE FIELD IF NOT EXISTS allocation_reason ON seat_allocations TYPE option<string>
  VALUE $value;

-- ==========================================================================
-- INDEXES
-- ==========================================================================

-- Query by organization
DEFINE INDEX IF NOT EXISTS idx_seat_alloc_org ON seat_allocations FIELDS org_id;

-- Ensure one allocation per user (across all orgs)
DEFINE INDEX IF NOT EXISTS idx_seat_alloc_user ON seat_allocations FIELDS user_id UNIQUE;

-- Compound index for org+user queries
DEFINE INDEX IF NOT EXISTS idx_seat_alloc_org_user ON seat_allocations FIELDS org_id, user_id UNIQUE;

-- Query by allocation date
DEFINE INDEX IF NOT EXISTS idx_seat_alloc_date ON seat_allocations FIELDS allocated_at;
```

## Field Specifications

### seat_allocations

| Field | Type | Required | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | record | auto | auto | unique | SurrealDB auto-generated |
| `org_id` | record<organizations> | yes | - | FK to organizations | Must exist |
| `user_id` | record<users> | yes | - | FK to users, UNIQUE | One seat per user |
| `allocated_at` | datetime | no | time::now() | - | Allocation timestamp |
| `allocated_by` | record<users> | no | null | FK to users | Who performed allocation |
| `allocation_reason` | string | no | null | - | manual, invite, migration |

## Existing Table Updates

### organizations (no schema change needed)

The `organizations` table already has the required fields:

```sql
-- Already exists in 002-organizations.surql
DEFINE FIELD IF NOT EXISTS seat_limit ON organizations TYPE int
  ASSERT $value >= 1
  VALUE $value
  DEFAULT 5;

DEFINE FIELD IF NOT EXISTS seat_usage ON organizations TYPE int
  ASSERT $value >= 0 AND $value <= seat_limit
  VALUE $value
  DEFAULT 0;
```

**Note:** `seat_usage` will be computed via queries rather than stored, to avoid synchronization issues. The stored value is for backwards compatibility.

### subscriptions (no schema change needed)

The `subscriptions` table already has:

```sql
-- Already exists in 004-subscriptions.surql
DEFINE FIELD IF NOT EXISTS seat_limit ON subscriptions TYPE int
  ASSERT $value >= 1
  VALUE $value
  DEFAULT 5;

DEFINE FIELD IF NOT EXISTS plan ON subscriptions TYPE string
  ASSERT $value IN ['free', 'starter', 'pro', 'enterprise']
  VALUE $value
  DEFAULT 'free';
```

## Plan-to-Seat Mapping

| Plan | Seat Limit | Notes |
|------|-----------|-------|
| free | 1 | Personal use |
| starter | 3 | Small teams |
| pro | 10 | Growing teams |
| enterprise | 999999 | Unlimited (effectively) |

This mapping is enforced in application code, not database:

```typescript
// repos/metabob-analysis-api/src/config/plans.ts
export const PLAN_SEAT_LIMITS: Record<string, number> = {
  free: 1,
  starter: 3,
  pro: 10,
  enterprise: 999999,
};
```

## RBAC Permissions Summary

### seat_allocations

| Operation | Owner | Admin | Member | System |
|-----------|-------|-------|--------|--------|
| SELECT | Yes (own org) | Yes (own org) | Yes (own org) | Yes |
| CREATE | Yes (own org) | Yes (own org) | No | Yes |
| UPDATE | No | No | No | No |
| DELETE | Yes (own org) | Yes (own org) | No | Yes |

### Computed seat_usage Query

```sql
-- Use this pattern instead of relying on stored seat_usage
SELECT
  id,
  name,
  seat_limit,
  (SELECT count() FROM seat_allocations WHERE org_id = $parent.id)[0].count AS seat_usage
FROM organizations
WHERE id = $org_id
```

## Migration Requirements

### 006-seat-allocations-migration.surql

```sql
-- Migration: Backfill seat_allocations for existing users
-- Run once after schema is applied

-- For each organization
LET $orgs = SELECT id FROM organizations;

FOR $org IN $orgs {
  -- Get all active users in this org
  LET $users = SELECT id, created_at FROM users
    WHERE org_id = $org.id;

  -- Create allocation for each user (if not exists)
  FOR $user IN $users {
    LET $existing = SELECT id FROM seat_allocations
      WHERE user_id = $user.id
      LIMIT 1;

    IF array::len($existing) = 0 {
      CREATE seat_allocations SET
        org_id = $org.id,
        user_id = $user.id,
        allocated_at = $user.created_at,
        allocated_by = NONE,
        allocation_reason = 'migration';
    };
  };
};

-- Sync seat_usage on all orgs
UPDATE organizations SET
  seat_usage = (SELECT count() FROM seat_allocations WHERE org_id = $parent.id)[0].count;
```

## Validation Rules

### Allocation Constraints

1. **One seat per user**: Enforced by UNIQUE index on `user_id`
2. **User must be in org**: Application validates `user.org_id = allocation.org_id`
3. **Seat limit check**: Application checks `seat_usage < seat_limit` before CREATE
4. **No self-deallocate**: Application prevents users from removing their own allocation

### Seat Limit Enforcement

The database does NOT enforce seat limits (to avoid complex triggers). Enforcement is in application code:

```typescript
// Before creating allocation
const seatInfo = await getSeatInfo(db, orgId);
if (seatInfo.seat_usage >= seatInfo.seat_limit) {
  throw new SeatLimitExceededError();
}
```

## Event Triggers (Future)

For future Stripe integration, we may add database events:

```sql
-- Future: Event emission for seat changes
DEFINE EVENT IF NOT EXISTS seat_allocated ON TABLE seat_allocations WHEN $event = 'CREATE' THEN (
  -- Emit event to queue
  CREATE audit_logs SET
    org_id = $after.org_id,
    action = 'seat_allocated',
    resource_type = 'seat_allocation',
    resource_id = $after.id,
    timestamp = time::now(),
    details = { user_id: $after.user_id }
);

DEFINE EVENT IF NOT EXISTS seat_deallocated ON TABLE seat_allocations WHEN $event = 'DELETE' THEN (
  -- Emit event to queue
  CREATE audit_logs SET
    org_id = $before.org_id,
    action = 'seat_deallocated',
    resource_type = 'seat_allocation',
    resource_id = $before.id,
    timestamp = time::now(),
    details = { user_id: $before.user_id }
);
```

## Schema Version

This schema requires:
- SurrealDB 3.x
- Existing core schemas (001-005)
- Schema version: `006`

Add to `000-schema-version.surql`:

```sql
UPDATE schema_version SET
  version = 6,
  changes = array::append(changes, {
    version: 6,
    date: time::now(),
    description: 'Add seat_allocations table for seat management'
  })
WHERE id = 'schema_version:core';
```
