-- Migration: 002
-- Description: Test incremental migration (adds test field)
-- Author: Activity Mode
-- Date: 2026-02-28
-- Depends: 001_initial_activity_schema.sql

USE NS metabob DB devbob;

-- ============================================================================
-- Test Migration: Add test field to template_metrics
-- Purpose: Verify incremental migration works correctly
-- ============================================================================

-- Add a test field to an existing table
DEFINE FIELD test_migration_field ON template_metrics TYPE option<string>
  COMMENT "Test field added by migration 002 - can be removed later";

-- Create test index
DEFINE INDEX test_migration_idx ON template_metrics FIELDS test_migration_field;

-- Record migration
CREATE schema_version CONTENT {
  version: 2,
  applied_at: time::now(),
  applied_by: 'migration-runner',
  description: 'Test incremental migration (adds test field)',
  migration_file: '002_test_incremental_migration.sql',
  duration_ms: 0,
  success: true
};
