-- Migration: 000
-- Description: Create schema_version table for migration tracking
-- Author: Activity Mode
-- Date: 2026-02-28
-- Depends: None

USE NS metabob DB devbob;

-- ============================================================================
-- Table: schema_version
-- Purpose: Track applied database migrations
-- ============================================================================

DEFINE TABLE IF NOT EXISTS schema_version SCHEMAFULL;

DEFINE FIELD version ON schema_version TYPE int
  COMMENT "Migration version number (sequential)";

DEFINE FIELD applied_at ON schema_version TYPE datetime DEFAULT time::now()
  COMMENT "When migration was applied";

DEFINE FIELD applied_by ON schema_version TYPE string
  COMMENT "Who/what applied the migration (user, migration-runner, etc)";

DEFINE FIELD description ON schema_version TYPE string
  COMMENT "Brief description of what this migration does";

DEFINE FIELD migration_file ON schema_version TYPE string
  COMMENT "Filename of the migration (for reference)";

DEFINE FIELD checksum ON schema_version TYPE option<string>
  COMMENT "SHA256 checksum of migration file (optional, for integrity checking)";

DEFINE FIELD duration_ms ON schema_version TYPE option<int>
  COMMENT "How long migration took to apply (milliseconds)";

DEFINE FIELD success ON schema_version TYPE bool DEFAULT true
  COMMENT "Whether migration applied successfully";

DEFINE FIELD error_message ON schema_version TYPE option<string>
  COMMENT "Error message if migration failed";

-- Indexes for efficient queries
DEFINE INDEX version_idx ON schema_version FIELDS version UNIQUE;
DEFINE INDEX applied_at_idx ON schema_version FIELDS applied_at;
DEFINE INDEX success_idx ON schema_version FIELDS success;

-- Record this migration
CREATE schema_version CONTENT {
  version: 0,
  applied_at: time::now(),
  applied_by: 'bootstrap',
  description: 'Create schema_version table for migration tracking',
  migration_file: '000_schema_version.sql',
  duration_ms: 0,
  success: true
};
