-- =============================================================================
-- Cost Tracking: Activity Costs and Summaries
-- Tracks per-execution costs and pre-aggregated summaries
-- =============================================================================

-- =============================================================================
-- Table: activity_costs (per-execution cost records)
-- Denormalized from activity_executions for faster cost queries
-- =============================================================================

DEFINE TABLE IF NOT EXISTS activity_costs SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS execution_id ON activity_costs TYPE string
  ASSERT $value != NONE
  COMMENT "Unique execution ID from activity-api";

DEFINE FIELD IF NOT EXISTS org_id ON activity_costs TYPE record<organizations>
  ASSERT $value != NONE
  COMMENT "Organization that incurred this cost";

DEFINE FIELD IF NOT EXISTS user_id ON activity_costs TYPE record<users>
  ASSERT $value != NONE
  COMMENT "User associated with this execution";

DEFINE FIELD IF NOT EXISTS api_key_id ON activity_costs TYPE record<api_keys>
  ASSERT $value != NONE
  COMMENT "API key used for this execution";

DEFINE FIELD IF NOT EXISTS project_id ON activity_costs TYPE option<string>
  COMMENT "Project this activity was associated with";

DEFINE FIELD IF NOT EXISTS goal_description ON activity_costs TYPE option<string>
  COMMENT "Goal or intent for this execution";

DEFINE FIELD IF NOT EXISTS activity_template_id ON activity_costs TYPE string
  ASSERT $value != NONE
  COMMENT "Activity template used";

DEFINE FIELD IF NOT EXISTS instance_id ON activity_costs TYPE string
  ASSERT $value != NONE
  COMMENT "Instance that ran this activity";

DEFINE FIELD IF NOT EXISTS cost_usd ON activity_costs TYPE float
  DEFAULT 0.0
  COMMENT "Total cost in USD for this execution";

DEFINE FIELD IF NOT EXISTS llm_tokens_used ON activity_costs TYPE int
  DEFAULT 0
  COMMENT "Total LLM tokens consumed";

DEFINE FIELD IF NOT EXISTS llm_cost_usd ON activity_costs TYPE float
  DEFAULT 0.0
  COMMENT "LLM cost in USD";

DEFINE FIELD IF NOT EXISTS duration_ms ON activity_costs TYPE int
  DEFAULT 0
  COMMENT "Execution duration in milliseconds";

DEFINE FIELD IF NOT EXISTS status ON activity_costs TYPE string
  DEFAULT "completed"
  COMMENT "Status: completed, failed";

DEFINE FIELD IF NOT EXISTS started_at ON activity_costs TYPE datetime
  VALUE $value OR time::now()
  COMMENT "When this execution started";

DEFINE FIELD IF NOT EXISTS completed_at ON activity_costs TYPE datetime
  VALUE $value OR time::now()
  COMMENT "When this execution completed";

-- Unique index on execution_id
DEFINE INDEX IF NOT EXISTS idx_activity_costs_execution
  ON activity_costs FIELDS execution_id UNIQUE;

-- Index for org-level cost queries
DEFINE INDEX IF NOT EXISTS idx_activity_costs_org_time
  ON activity_costs FIELDS org_id, started_at;

-- Index for project-level cost queries
DEFINE INDEX IF NOT EXISTS idx_activity_costs_org_project
  ON activity_costs FIELDS org_id, project_id, started_at;

-- Index for goal-level cost queries
DEFINE INDEX IF NOT EXISTS idx_activity_costs_org_goal
  ON activity_costs FIELDS org_id, goal_description, started_at;

-- Index for API key cost tracking
DEFINE INDEX IF NOT EXISTS idx_activity_costs_api_key
  ON activity_costs FIELDS api_key_id, started_at;

-- =============================================================================
-- Table: cost_summaries (pre-aggregated by org/project/goal/time)
-- Already defined in 002-org-management-schema.surql
-- This section extends it if needed
-- =============================================================================

-- The cost_summaries table is already defined in 002-org-management-schema.surql
-- with fields: org_id, period_start, period_end, granularity, project_id,
-- goal_pattern, total_executions, successful_executions, failed_executions,
-- total_cost_usd, total_llm_tokens, total_llm_cost_usd, updated_at
