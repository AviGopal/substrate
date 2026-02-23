-- Initialize SurrealDB Schema for Learning Loop
-- Namespace: metabob, Database: metabob
-- Created: 2026-02-23
-- Purpose: Fix critical data persistence bug by creating proper database schema

-- Use the metabob namespace and database
USE NS metabob;
USE DB metabob;

-- ============================================================================
-- Table: activity_execution
-- Purpose: Store individual activity execution records (primary storage)
-- ============================================================================

DEFINE TABLE activity_execution SCHEMAFULL;

DEFINE FIELD execution_id ON activity_execution TYPE string
  COMMENT "Unique execution identifier (e.g., exec_abc123)";

DEFINE FIELD variant_id ON activity_execution TYPE string
  COMMENT "Activity variant identifier (e.g., template-name-hash)";

DEFINE FIELD activity_id ON activity_execution TYPE string
  COMMENT "Base activity/template identifier";

DEFINE FIELD success ON activity_execution TYPE bool
  COMMENT "Whether the execution succeeded";

DEFINE FIELD cost_usd ON activity_execution TYPE number
  COMMENT "Execution cost in USD";

DEFINE FIELD duration_ms ON activity_execution TYPE number
  COMMENT "Execution duration in milliseconds";

DEFINE FIELD tokens_input ON activity_execution TYPE number DEFAULT 0
  COMMENT "Input tokens consumed";

DEFINE FIELD tokens_output ON activity_execution TYPE number DEFAULT 0
  COMMENT "Output tokens generated";

DEFINE FIELD tokens_cache ON activity_execution TYPE number DEFAULT 0
  COMMENT "Cached tokens used";

DEFINE FIELD error_message ON activity_execution TYPE option<string>
  COMMENT "Error message if execution failed";

DEFINE FIELD error_type ON activity_execution TYPE option<string>
  COMMENT "Error type/category if execution failed";

DEFINE FIELD created_at ON activity_execution TYPE datetime DEFAULT time::now()
  COMMENT "Timestamp when execution was recorded";

-- Indexes for efficient queries
DEFINE INDEX idx_variant_id ON activity_execution FIELDS variant_id;
DEFINE INDEX idx_activity_id ON activity_execution FIELDS activity_id;
DEFINE INDEX idx_created_at ON activity_execution FIELDS created_at;
DEFINE INDEX idx_success ON activity_execution FIELDS success;

-- ============================================================================
-- Table: template_metrics
-- Purpose: Store aggregated metrics for Thompson Sampling (cached data)
-- ============================================================================

DEFINE TABLE template_metrics SCHEMAFULL;

DEFINE FIELD variant_id ON template_metrics TYPE string
  COMMENT "Activity variant identifier (primary key)";

DEFINE FIELD activity_id ON template_metrics TYPE string
  COMMENT "Base activity/template identifier";

DEFINE FIELD total_selections ON template_metrics TYPE number DEFAULT 0
  COMMENT "Total number of times this variant was selected";

DEFINE FIELD total_successes ON template_metrics TYPE number DEFAULT 0
  COMMENT "Total number of successful executions";

DEFINE FIELD total_failures ON template_metrics TYPE number DEFAULT 0
  COMMENT "Total number of failed executions";

DEFINE FIELD thompson_alpha ON template_metrics TYPE number DEFAULT 1.0
  COMMENT "Thompson Sampling alpha parameter (successes + 1)";

DEFINE FIELD thompson_beta ON template_metrics TYPE number DEFAULT 1.0
  COMMENT "Thompson Sampling beta parameter (failures + 1)";

DEFINE FIELD avg_cost ON template_metrics TYPE number DEFAULT 0.0
  COMMENT "Average execution cost in USD";

DEFINE FIELD avg_duration_ms ON template_metrics TYPE number DEFAULT 0.0
  COMMENT "Average execution duration in milliseconds";

DEFINE FIELD last_updated ON template_metrics TYPE datetime DEFAULT time::now()
  COMMENT "Timestamp of last metrics update";

-- Unique index on variant_id (primary key)
DEFINE INDEX idx_variant_id_unique ON template_metrics FIELDS variant_id UNIQUE;
DEFINE INDEX idx_activity_id ON template_metrics FIELDS activity_id;
DEFINE INDEX idx_success_rate ON template_metrics FIELDS thompson_alpha, thompson_beta;

-- ============================================================================
-- Table: failure_patterns
-- Purpose: Analyze and track common failure modes for learning
-- ============================================================================

DEFINE TABLE failure_patterns SCHEMAFULL;

DEFINE FIELD variant_id ON failure_patterns TYPE string
  COMMENT "Activity variant identifier";

DEFINE FIELD error_type ON failure_patterns TYPE string
  COMMENT "Error type/category";

DEFINE FIELD error_message ON failure_patterns TYPE string
  COMMENT "Error message text";

DEFINE FIELD occurrence_count ON failure_patterns TYPE number DEFAULT 1
  COMMENT "Number of times this error occurred";

DEFINE FIELD first_seen ON failure_patterns TYPE datetime DEFAULT time::now()
  COMMENT "First time this error was encountered";

DEFINE FIELD last_seen ON failure_patterns TYPE datetime DEFAULT time::now()
  COMMENT "Most recent occurrence of this error";

-- Composite index for variant + error type
DEFINE INDEX idx_variant_error ON failure_patterns FIELDS variant_id, error_type;
DEFINE INDEX idx_last_seen ON failure_patterns FIELDS last_seen;

-- ============================================================================
-- Schema Initialization Complete
-- ============================================================================

-- Verify tables were created
INFO FOR DB;
