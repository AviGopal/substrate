-- ============================================================================
-- SurrealDB 3.0 Schema for Activity Learning Loop
-- ============================================================================
-- Purpose: Schema definitions for template metrics with proper variant_id support
-- Version: 3.0 (updated for SurrealDB 3.0 compatibility)
-- ============================================================================

-- ============================================================================
-- Table: template_metrics
-- ============================================================================
-- Purpose: Store aggregated metrics for activity template variants
-- Key change: Now properly supports variant_id field
-- ============================================================================

DEFINE TABLE template_metrics SCHEMALESS PERMISSIONS FULL;

-- Indexes for efficient queries
DEFINE INDEX idx_variant_id ON template_metrics FIELDS variant_id;
DEFINE INDEX idx_activity_id ON template_metrics FIELDS activity_id;
DEFINE INDEX idx_success_rate ON template_metrics FIELDS success_rate;
DEFINE INDEX idx_last_executed ON template_metrics FIELDS last_executed_at;

-- ============================================================================
-- Table: activity_execution  
-- ============================================================================
-- Purpose: Time-series records of individual activity executions
-- ============================================================================

DEFINE TABLE activity_execution SCHEMALESS PERMISSIONS FULL;

-- Indexes for time-series queries
DEFINE INDEX idx_activity_exec_template ON activity_execution FIELDS template_id;
DEFINE INDEX idx_activity_exec_time ON activity_execution FIELDS started_at;
DEFINE INDEX idx_activity_exec_success ON activity_execution FIELDS success;

-- ============================================================================
-- Table: failure_pattern
-- ============================================================================
-- Purpose: Track recurring failure patterns for debugging
-- ============================================================================

DEFINE TABLE failure_pattern SCHEMALESS PERMISSIONS FULL;

DEFINE INDEX idx_failure_template ON failure_pattern FIELDS template_id;
DEFINE INDEX idx_failure_frequency ON failure_pattern FIELDS frequency;

-- ============================================================================
-- Table: impulse_mapping_record
-- ============================================================================
-- Purpose: Track impulse learning data for pattern recognition
-- ============================================================================

DEFINE TABLE impulse_mapping_record SCHEMALESS PERMISSIONS FULL;

DEFINE INDEX idx_impulse_session ON impulse_mapping_record FIELDS context.activeSession;
DEFINE INDEX idx_impulse_pattern ON impulse_mapping_record FIELDS userIntent.normalizedPattern;
DEFINE INDEX idx_impulse_quality ON impulse_mapping_record FIELDS outcome.responseQuality;

-- ============================================================================
-- Notes on SCHEMALESS vs SCHEMAFULL
-- ============================================================================
-- We use SCHEMALESS for flexibility and to avoid the field persistence issues
-- encountered with SCHEMAFULL + custom HTTP client in SurrealDB 2.x.
-- 
-- With SurrealDB 3.0 + official library:
-- - SCHEMALESS allows dynamic field addition
-- - Indexes provide query performance
-- - Application layer handles validation
-- - No risk of fields being silently dropped
-- 
-- If we need stricter validation later, we can:
-- 1. Add ASSERT clauses for business rules
-- 2. Use application-layer validation (Pydantic models)
-- 3. Migrate to SCHEMAFULL once all data operations are tested
-- ============================================================================
