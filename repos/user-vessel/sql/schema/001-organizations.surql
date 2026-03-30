-- Organizations table with RBAC PERMISSIONS enforcement
-- This is the core multi-tenant entity that owns all user data

DEFINE TABLE organizations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE org_id = $auth.org_id
    FOR update WHERE org_id = $auth.org_id AND $auth.role IN ['admin', 'owner']
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'owner';

-- Primary fields
DEFINE FIELD org_id ON organizations TYPE string
  ASSERT $value != NONE
  VALUE $before OR $value OR id;

DEFINE FIELD name ON organizations TYPE string
  ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 255;

DEFINE FIELD subscription_tier ON organizations TYPE string
  ASSERT $value IN ['free', 'starter', 'pro', 'enterprise']
  VALUE $value OR 'free';

-- Seat management
DEFINE FIELD seat_limit ON organizations TYPE int
  ASSERT $value >= -1  -- -1 means unlimited (enterprise tier)
  VALUE $before OR (
    $value OR (
      $parent.subscription_tier = 'free' ? 1 :
      $parent.subscription_tier = 'starter' ? 3 :
      $parent.subscription_tier = 'pro' ? 10 :
      -1  -- enterprise
    )
  );

DEFINE FIELD seat_usage ON organizations TYPE int
  VALUE $before OR 0;

-- Metadata
DEFINE FIELD created_at ON organizations TYPE datetime
  VALUE $before OR time::now();

DEFINE FIELD updated_at ON organizations TYPE datetime
  VALUE time::now();

-- Indices for performance
DEFINE INDEX idx_org_id ON organizations FIELDS org_id UNIQUE;
DEFINE INDEX idx_subscription_tier ON organizations FIELDS subscription_tier;
