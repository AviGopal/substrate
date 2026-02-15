-- =============================================================================
-- Agent Executions Table - Session Tracking and Self-Improvement
-- =============================================================================
-- Creates a queryable table for agent-level session data with proper scoping.
-- Enables long-term analysis of agent performance and self-improvement.
-- 
-- Data Flow:
--   OpenCode → CLI MCP → Backend API → Redis (7-day TTL) + SurrealDB (permanent)
-- =============================================================================

-- Create agent_executions table for session data
DEFINE TABLE agent_executions SCHEMAFULL;

-- Session Identity
DEFINE FIELD session_id ON agent_executions TYPE string;
DEFINE FIELD org_id ON agent_executions TYPE string DEFAULT "anonymous";
DEFINE FIELD project_id ON agent_executions TYPE string DEFAULT "default";

-- Agent Identity
DEFINE FIELD agent_id ON agent_executions TYPE string;
DEFINE FIELD agent_version ON agent_executions TYPE string;

-- Session Metadata
DEFINE FIELD goal ON agent_executions TYPE string;
DEFINE FIELD context ON agent_executions TYPE object DEFAULT {};
DEFINE FIELD status ON agent_executions TYPE string DEFAULT "in_progress";

-- Timing
DEFINE FIELD started_at ON agent_executions TYPE datetime;
DEFINE FIELD completed_at ON agent_executions TYPE option<datetime>;
DEFINE FIELD total_duration_ms ON agent_executions TYPE float DEFAULT 0.0;

-- Outcome
DEFINE FIELD outcome ON agent_executions TYPE option<object> DEFAULT {
    success: false,
    goal_achieved: false,
    tests_passed: NONE,
    code_quality_improved: NONE,
    error: NONE
};

-- Reflection (self-improvement data)
DEFINE FIELD reflection ON agent_executions TYPE option<object> DEFAULT {
    what_worked: "",
    what_didnt_work: "",
    improvements_suggested: ""
};

-- Tool Usage
DEFINE FIELD tool_invocations ON agent_executions TYPE array DEFAULT [];
DEFINE FIELD tool_usage_stats ON agent_executions TYPE array DEFAULT [];

-- Activity Usage
DEFINE FIELD activities_used ON agent_executions TYPE array DEFAULT [];

-- Metadata
DEFINE FIELD created_at ON agent_executions TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON agent_executions TYPE datetime DEFAULT time::now();

-- Indexes for performance
DEFINE INDEX idx_agent_exec_session_id ON agent_executions FIELDS session_id UNIQUE;
DEFINE INDEX idx_agent_exec_org_project ON agent_executions FIELDS org_id, project_id;
DEFINE INDEX idx_agent_exec_agent_id ON agent_executions FIELDS agent_id;
DEFINE INDEX idx_agent_exec_status ON agent_executions FIELDS status;
DEFINE INDEX idx_agent_exec_created_at ON agent_executions FIELDS created_at;
DEFINE INDEX idx_agent_exec_completed_at ON agent_executions FIELDS completed_at;

-- Composite index for common queries
DEFINE INDEX idx_agent_exec_project_agent ON agent_executions FIELDS project_id, agent_id, created_at;

-- =============================================================================
-- Usage Examples
-- =============================================================================

-- Query 1: Get all sessions for a project
-- SELECT * FROM agent_executions 
-- WHERE project_id = 'my-project' AND org_id = 'my-org'
-- ORDER BY created_at DESC;

-- Query 2: Get agent success rate
-- SELECT 
--     agent_id,
--     count() as total_sessions,
--     math::sum(CASE WHEN outcome.success = true THEN 1 ELSE 0 END) as successful,
--     math::sum(CASE WHEN outcome.success = true THEN 1.0 ELSE 0.0 END) / count() as success_rate
-- FROM agent_executions
-- WHERE completed_at IS NOT NONE
-- GROUP BY agent_id;

-- Query 3: Find sessions by goal pattern
-- SELECT * FROM agent_executions 
-- WHERE goal CONTAINS 'bug fix' OR goal CONTAINS 'implement'
-- ORDER BY created_at DESC;

-- Query 4: Analyze tool usage effectiveness
-- SELECT 
--     tool_name,
--     count() as usage_count,
--     avg(success_rate) as avg_success_rate
-- FROM (
--     SELECT 
--         session_id,
--         tool_usage_stats[*].tool_name as tool_name,
--         tool_usage_stats[*].success_count / tool_usage_stats[*].invocation_count as success_rate
--     FROM agent_executions
--     WHERE array::len(tool_usage_stats) > 0
-- )
-- GROUP BY tool_name
-- ORDER BY usage_count DESC;

-- Query 5: Get reflection insights
-- SELECT 
--     reflection.what_worked,
--     reflection.improvements_suggested,
--     count() as occurrence_count
-- FROM agent_executions
-- WHERE reflection IS NOT NONE AND outcome.success = true
-- GROUP BY reflection.what_worked, reflection.improvements_suggested
-- ORDER BY occurrence_count DESC
-- LIMIT 10;

-- Query 6: Project-level session statistics
-- SELECT 
--     project_id,
--     org_id,
--     count() as total_sessions,
--     math::sum(CASE WHEN outcome.success = true THEN 1 ELSE 0 END) as successful,
--     avg(total_duration_ms) as avg_duration_ms,
--     min(created_at) as first_session,
--     max(created_at) as last_session
-- FROM agent_executions
-- WHERE completed_at IS NOT NONE
-- GROUP BY project_id, org_id;

-- =============================================================================
-- Data Retention Policy
-- =============================================================================
-- Unlike Redis (7-day TTL), SurrealDB stores permanently for analysis.
-- Optional cleanup query for old sessions (run periodically if needed):
--
-- DELETE FROM agent_executions 
-- WHERE created_at < time::now() - 90d  -- Keep 90 days
-- AND status = 'completed';
