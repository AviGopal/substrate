-- Schema version tracking for idempotent migrations
-- This table tracks which migration files have been applied

DEFINE TABLE IF NOT EXISTS schema_version SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE;

DEFINE FIELD IF NOT EXISTS version ON schema_version TYPE string
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS name ON schema_version TYPE string
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS checksum ON schema_version TYPE string
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS applied_at ON schema_version TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS migration_type ON schema_version TYPE string
  ASSERT $value IN ['core', 'activity', 'analysis']
  VALUE $value;

DEFINE INDEX IF NOT EXISTS idx_version ON schema_version FIELDS version UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_applied_at ON schema_version FIELDS applied_at;
