# Database Schema Specification

## Overview

This specification defines the SurrealDB schema for organization member management, including tables for members and invitations with RBAC permissions.

## Schema Files

### File: repos/metabob-proto/surrealdb/core/006-organization-members.surql

```sql
-- Organization member management tables
-- Part of the core multi-tenant schema (metabob-proto)

-- ============================================================================
-- ORGANIZATION_MEMBERS TABLE
-- ============================================================================
-- Tracks active and removed membership in organizations
-- Uses soft delete (status='removed') to preserve audit trail

DEFINE TABLE IF NOT EXISTS organization_members SCHEMAFULL
  PERMISSIONS
    -- Members can view other members in their org (excluding removed)
    FOR select WHERE org_id = $auth.org_id AND status != 'removed'
    -- Only owner/admin can add members
    FOR create WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id
    -- Only owner/admin can update (role changes, soft delete)
    FOR update WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id
    -- Hard delete not allowed (use soft delete)
    FOR delete NONE;

-- Required fields
DEFINE FIELD IF NOT EXISTS org_id ON organization_members TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS user_id ON organization_members TYPE record<users>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS role ON organization_members TYPE string
  ASSERT $value IN ['owner', 'admin', 'member', 'viewer']
  VALUE $value
  DEFAULT 'member';

DEFINE FIELD IF NOT EXISTS status ON organization_members TYPE string
  ASSERT $value IN ['active', 'removed']
  VALUE $value
  DEFAULT 'active';

-- Audit fields
DEFINE FIELD IF NOT EXISTS invited_by ON organization_members TYPE option<record<users>>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS joined_at ON organization_members TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS created_at ON organization_members TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

-- Removal tracking
DEFINE FIELD IF NOT EXISTS removed_at ON organization_members TYPE option<datetime>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS removed_by ON organization_members TYPE option<record<users>>
  VALUE $value;

-- Indexes
-- Unique constraint: user can only be member of org once
DEFINE INDEX IF NOT EXISTS idx_org_member_unique ON organization_members
  FIELDS org_id, user_id UNIQUE;

-- Unique constraint: only one owner per org (conditional unique)
-- Note: SurrealDB 3.0 supports WHERE clause in index for conditional uniqueness
DEFINE INDEX IF NOT EXISTS idx_org_single_owner ON organization_members
  FIELDS org_id
  WHERE role = 'owner' AND status = 'active';

-- Fast lookup by org (most common query)
DEFINE INDEX IF NOT EXISTS idx_member_org ON organization_members
  FIELDS org_id;

-- Fast lookup by user (for user's org list)
DEFINE INDEX IF NOT EXISTS idx_member_user ON organization_members
  FIELDS user_id;

-- Fast lookup by status (for active members)
DEFINE INDEX IF NOT EXISTS idx_member_status ON organization_members
  FIELDS org_id, status;

-- ============================================================================
-- ORGANIZATION_INVITATIONS TABLE
-- ============================================================================
-- Tracks pending, accepted, declined, and expired invitations
-- Invitations are separate from members to handle pre-signup flow

DEFINE TABLE IF NOT EXISTS organization_invitations SCHEMAFULL
  PERMISSIONS
    -- Members can view invitations in their org
    FOR select WHERE org_id = $auth.org_id
    -- Only owner/admin can create invitations
    FOR create WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id
    -- Invitations can be updated (accept/decline) or by admin
    FOR update WHERE org_id = $auth.org_id
    -- Only owner/admin can delete (revoke) invitations
    FOR delete WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id;

-- Required fields
DEFINE FIELD IF NOT EXISTS org_id ON organization_invitations TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS email ON organization_invitations TYPE string
  ASSERT $value != NONE AND string::is_email($value)
  VALUE string::lowercase($value);

DEFINE FIELD IF NOT EXISTS role ON organization_invitations TYPE string
  ASSERT $value IN ['admin', 'member', 'viewer']
  VALUE $value
  DEFAULT 'member';

-- Token stored as hash for security
DEFINE FIELD IF NOT EXISTS token_hash ON organization_invitations TYPE string
  ASSERT $value != NONE
  VALUE $value;

-- Audit fields
DEFINE FIELD IF NOT EXISTS invited_by ON organization_invitations TYPE record<users>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS status ON organization_invitations TYPE string
  ASSERT $value IN ['pending', 'accepted', 'declined', 'expired', 'revoked']
  VALUE $value
  DEFAULT 'pending';

-- Timestamps
DEFINE FIELD IF NOT EXISTS expires_at ON organization_invitations TYPE datetime
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS created_at ON organization_invitations TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS accepted_at ON organization_invitations TYPE option<datetime>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS declined_at ON organization_invitations TYPE option<datetime>
  VALUE $value;

-- Indexes
-- Unique token hash for lookup
DEFINE INDEX IF NOT EXISTS idx_invitation_token ON organization_invitations
  FIELDS token_hash UNIQUE;

-- Fast lookup by org
DEFINE INDEX IF NOT EXISTS idx_invitation_org ON organization_invitations
  FIELDS org_id;

-- Fast lookup by email (check for existing invitation)
DEFINE INDEX IF NOT EXISTS idx_invitation_email ON organization_invitations
  FIELDS email;

-- Fast lookup by org and status (list pending invitations)
DEFINE INDEX IF NOT EXISTS idx_invitation_org_status ON organization_invitations
  FIELDS org_id, status;

-- ============================================================================
-- MEMBERSHIP_AUDIT_LOG TABLE
-- ============================================================================
-- Tracks all membership changes for compliance and debugging

DEFINE TABLE IF NOT EXISTS membership_audit_log SCHEMAFULL
  PERMISSIONS
    -- Only admins can view audit logs
    FOR select WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id
    -- System creates audit logs (via triggers or application)
    FOR create WHERE org_id = $auth.org_id
    -- Audit logs are immutable
    FOR update NONE
    FOR delete NONE;

DEFINE FIELD IF NOT EXISTS org_id ON membership_audit_log TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS action ON membership_audit_log TYPE string
  ASSERT $value IN [
    'member_invited',
    'member_joined',
    'member_removed',
    'member_left',
    'role_changed',
    'invitation_revoked',
    'invitation_declined',
    'ownership_transferred'
  ]
  VALUE $value;

DEFINE FIELD IF NOT EXISTS actor_id ON membership_audit_log TYPE record<users>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS target_user_id ON membership_audit_log TYPE option<record<users>>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS target_email ON membership_audit_log TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS details ON membership_audit_log TYPE option<object>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS created_at ON membership_audit_log TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_audit_org ON membership_audit_log
  FIELDS org_id;

DEFINE INDEX IF NOT EXISTS idx_audit_action ON membership_audit_log
  FIELDS org_id, action;

DEFINE INDEX IF NOT EXISTS idx_audit_time ON membership_audit_log
  FIELDS org_id, created_at;
```

## Migration Notes

### Adding to Existing Organizations

When this schema is deployed, existing organizations will have no members in the `organization_members` table. A migration script should:

1. Create owner membership for existing org creators:
```sql
-- For each org, create owner membership from first admin user
LET $orgs = SELECT id FROM organizations;
FOR $org IN $orgs {
  LET $first_admin = (
    SELECT id FROM users
    WHERE org_id = $org.id AND role = 'admin'
    ORDER BY created_at ASC
    LIMIT 1
  )[0];

  IF $first_admin {
    CREATE organization_members SET
      org_id = $org.id,
      user_id = $first_admin.id,
      role = 'owner',
      status = 'active',
      joined_at = $first_admin.created_at,
      created_at = time::now();
  };
};
```

2. Create member entries for other users:
```sql
LET $users = SELECT id, org_id, role, created_at FROM users;
FOR $user IN $users {
  -- Skip if already has membership (owner created above)
  LET $existing = (
    SELECT id FROM organization_members
    WHERE org_id = $user.org_id AND user_id = $user.id
  )[0];

  IF !$existing {
    CREATE organization_members SET
      org_id = $user.org_id,
      user_id = $user.id,
      role = IF $user.role = 'admin' THEN 'admin' ELSE 'member',
      status = 'active',
      joined_at = $user.created_at,
      created_at = time::now();
  };
};
```

## Relationships

```
organizations (1) <---> (*) organization_members (*) <---> (1) users
organizations (1) <---> (*) organization_invitations
organization_members (*) <---> (1) users (invited_by)
organization_invitations (*) <---> (1) users (invited_by)
organizations (1) <---> (*) membership_audit_log
```

## Query Patterns

### List Active Members
```sql
SELECT
  *,
  user_id.email AS user_email,
  user_id.name AS user_name,
  invited_by.name AS invited_by_name
FROM organization_members
WHERE org_id = $org_id AND status = 'active'
ORDER BY role DESC, joined_at ASC;
```

### Check Seat Availability
```sql
LET $org = (SELECT seat_limit, seat_usage FROM organizations WHERE id = $org_id)[0];
LET $active_members = (SELECT count() FROM organization_members WHERE org_id = $org_id AND status = 'active')[0].count;
LET $pending_invites = (SELECT count() FROM organization_invitations WHERE org_id = $org_id AND status = 'pending')[0].count;

RETURN {
  seat_limit: $org.seat_limit,
  active_members: $active_members,
  pending_invites: $pending_invites,
  available: $org.seat_limit - $active_members - $pending_invites
};
```

### Find Invitation by Token
```sql
-- Note: Token hash computed in application layer
SELECT
  *,
  org_id.name AS org_name,
  invited_by.name AS invited_by_name
FROM organization_invitations
WHERE token_hash = $token_hash AND status = 'pending'
LIMIT 1;
```
