# SurrealDB Schema Export

**Generated**: 2026-02-16T11:25:50.700916

**Source**: Local development SurrealDB


================================================================================

## Migration Files


### 002-execution-steps-table.surql

```sql

-- =============================================================================
-- Execution Steps Table - Phase 1 Impulse Tracking
-- =============================================================================
-- Creates a queryable table for per-step execution data with impulse tracking.
-- This enables learning from which context (impulses) helps activities succeed.
-- =============================================================================

-- Create execution_steps table for per-step data
DEFINE TABLE execution_steps SCHEMAFULL;

-- Fields
DEFINE FIELD execution_id ON execution_steps TYPE string;
DEFINE FIELD step_id ON execution_steps TYPE string;
DEFINE FIELD step_index ON execution_steps TYPE int;
DEFINE FIELD success ON execution_steps TYPE bool;
DEFINE FIELD output ON execution_steps TYPE option<string>;
DEFINE FIELD error ON execution_steps TYPE option<string>;
DEFINE FIELD cost ON execution_steps TYPE float;
DEFINE FIELD tokens ON execution_steps TYPE int;
DEFINE FIELD duration_ms ON execution_steps TYPE int;
DEFINE FIELD tool_calls ON execution_steps TYPE array DEFAULT [];

-- Phase 1: Impulse tracking fields
DEFINE FIELD impulses_loaded ON execution_steps TYPE array DEFAULT [];
DEFINE FIELD impulses_created ON execution_steps TYPE array DEFAULT [];
DEFINE FIELD context_summary ON execution_steps TYPE object DEFAULT {};

-- Metadata
DEFINE FIELD created_at ON execution_steps TYPE datetime DEFAULT time::now();

-- Indexes for performance
DEFINE INDEX idx_execution_steps_execution_id ON execution_steps FIELDS execution_id;
DEFINE INDEX idx_execution_steps_step_index ON execution_steps FIELDS step_index;
DEFINE INDEX idx_execution_steps_success ON execution_steps FIELDS success;
DEFINE INDEX idx_execution_steps_created_at ON execution_steps FIELDS created_at;

-- Composite index for common queries
DEFINE INDEX idx_execution_steps_exec_step ON execution_steps FIELDS execution_id, step_index;

-- =============================================================================
-- Migration: Copy existing step_results from activity_executions
-- =============================================================================
-- This is a one-time migration to populate execution_steps from existing data
-- Run this AFTER creating the table structure above
-- =============================================================================

-- Note: This would need to be run as a data migration script:
-- FOR execution IN (SELECT * FROM activity_executions WHERE step_results != NONE) {
--     FOR step IN execution.step_results {
--         CREATE execution_steps CONTENT {
--             execution_id: execution.execution_id,
--             step_id: step.step_id,
--             step_index: step.step_index OR 0,
--             success: step.success,
--             output: step.output,
--             error: step.error,
--             cost: step.cost OR 0.0,
--             tokens: step.tokens OR 0,
--             duration_ms: step.duration_ms OR 0,
--             tool_calls: step.tool_calls OR [],
--             impulses_loaded: step.impulses_loaded OR [],
--             impulses_created: step.impulses_created OR [],
--             context_summary: step.context_summary OR {},
--             created_at: execution.created_at
--         };
--     }
-- }

-- =============================================================================
-- Usage Examples
-- =============================================================================

-- Query 1: Find all steps for an execution
-- SELECT * FROM execution_steps WHERE execution_id = 'exec_abc123' ORDER BY step_index;

-- Query 2: Find failed steps across all executions
-- SELECT * FROM execution_steps WHERE success = false ORDER BY created_at DESC;

-- Query 3: Analyze impulse effectiveness
-- SELECT 
--     array::len(impulses_loaded) as impulse_count,
--     success,
--     count() as occurrences
-- FROM execution_steps 
-- WHERE array::len(impulses_loaded) > 0
-- GROUP BY impulse_count, success;

-- Query 4: Find steps that used a specific impulse
-- SELECT * FROM execution_steps 
-- WHERE 'impulse-123' IN impulses_loaded 
-- ORDER BY created_at DESC;

-- Query 5: Calculate success rate by impulse count
-- SELECT 
--     CASE 
--         WHEN array::len(impulses_loaded) = 0 THEN 'no_impulses'
--         WHEN array::len(impulses_loaded) <= 2 THEN 'few_impulses'
--         WHEN array::len(impulses_loaded) <= 5 THEN 'moderate_impulses'
--         ELSE 'many_impulses'
--     END as impulse_category,
--     count() as total_steps,
--     math::sum(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_steps,
--     math::sum(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) / count() as success_rate
-- FROM execution_steps
-- GROUP BY impulse_category
-- ORDER BY success_rate DESC;


```


### 003-agent-executions-table.surql

```sql

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


```


### 004-tool-invocations-table.surql

```sql

-- =============================================================================
-- Tool Invocations Table - Phase 2 Code Intelligence Persistence
-- =============================================================================
-- Creates a queryable table for tool usage with Phase 2 code intelligence.
-- Previously stored only in Redis (7-day TTL), now permanently in SurrealDB.
-- 
-- Data Flow:
--   OpenCode → CLI MCP (enrichment) → Backend API → Redis + SurrealDB
-- 
-- Code Intelligence Captured:
--   - Components extracted (functions, classes)
--   - Impact score (based on dependents count via CPG)
--   - Dependency counts (dependents/dependencies)
--   - Similar files (semantic similarity)
-- =============================================================================

-- Create tool_invocations table
DEFINE TABLE tool_invocations SCHEMAFULL;

-- Identity
DEFINE FIELD invocation_id ON tool_invocations TYPE string;
DEFINE FIELD session_id ON tool_invocations TYPE string;
DEFINE FIELD org_id ON tool_invocations TYPE string DEFAULT "anonymous";
DEFINE FIELD project_id ON tool_invocations TYPE string DEFAULT "default";

-- Tool Info
DEFINE FIELD tool_name ON tool_invocations TYPE string;
DEFINE FIELD file_path ON tool_invocations TYPE option<string>;
DEFINE FIELD operation ON tool_invocations TYPE string DEFAULT "unknown";  -- read, write, edit, bash, etc.
DEFINE FIELD timestamp ON tool_invocations TYPE datetime;

-- Phase 2 Enrichment (from code_context field)
DEFINE FIELD components ON tool_invocations TYPE array DEFAULT [];
DEFINE FIELD component_count ON tool_invocations TYPE int DEFAULT 0;
DEFINE FIELD impact_score ON tool_invocations TYPE float DEFAULT 0.0;
DEFINE FIELD dependents_count ON tool_invocations TYPE int DEFAULT 0;
DEFINE FIELD dependencies_count ON tool_invocations TYPE int DEFAULT 0;
DEFINE FIELD similar_files ON tool_invocations TYPE array DEFAULT [];

-- Outcome
DEFINE FIELD success ON tool_invocations TYPE bool;
DEFINE FIELD duration_ms ON tool_invocations TYPE float DEFAULT 0.0;
DEFINE FIELD error ON tool_invocations TYPE option<string>;

-- Tool Arguments (for debugging and analysis)
DEFINE FIELD args ON tool_invocations TYPE object DEFAULT {};

-- Metadata
DEFINE FIELD created_at ON tool_invocations TYPE datetime DEFAULT time::now();

-- Indexes for performance
DEFINE INDEX idx_tool_invocations_invocation_id ON tool_invocations FIELDS invocation_id;
DEFINE INDEX idx_tool_invocations_session ON tool_invocations FIELDS session_id;
DEFINE INDEX idx_tool_invocations_tool ON tool_invocations FIELDS tool_name;
DEFINE INDEX idx_tool_invocations_file ON tool_invocations FIELDS file_path;
DEFINE INDEX idx_tool_invocations_org_project ON tool_invocations FIELDS org_id, project_id;
DEFINE INDEX idx_tool_invocations_timestamp ON tool_invocations FIELDS timestamp;
DEFINE INDEX idx_tool_invocations_impact ON tool_invocations FIELDS impact_score;

-- Composite indexes for common queries
DEFINE INDEX idx_tool_invocations_project_tool ON tool_invocations FIELDS project_id, tool_name, timestamp;
DEFINE INDEX idx_tool_invocations_session_tool ON tool_invocations FIELDS session_id, tool_name;

-- =============================================================================
-- Usage Examples
-- =============================================================================

-- Query 1: Most impactful tool operations in a project
-- SELECT tool_name, file_path, impact_score, dependents_count
-- FROM tool_invocations 
-- WHERE project_id = 'my-project' AND impact_score > 0.7 
-- ORDER BY impact_score DESC;

-- Query 2: Files with highest dependency churn (frequently edited high-impact files)
-- SELECT 
--     file_path, 
--     avg(dependents_count) as avg_dependents,
--     count() as edit_frequency,
--     avg(impact_score) as avg_impact
-- FROM tool_invocations 
-- WHERE operation IN ['write', 'edit'] AND project_id = 'my-project'
-- GROUP BY file_path 
-- ORDER BY edit_frequency DESC, avg_impact DESC
-- LIMIT 20;

-- Query 3: Tool success rates by operation type
-- SELECT 
--     tool_name,
--     operation,
--     count() as total_invocations,
--     math::sum(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
--     math::sum(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) / count() as success_rate,
--     avg(duration_ms) as avg_duration_ms
-- FROM tool_invocations
-- WHERE project_id = 'my-project'
-- GROUP BY tool_name, operation
-- ORDER BY total_invocations DESC;

-- Query 4: Find all tool invocations for a session
-- SELECT * FROM tool_invocations 
-- WHERE session_id = 'session_abc123'
-- ORDER BY timestamp ASC;

-- Query 5: Components most frequently modified
-- SELECT 
--     component,
--     count() as modification_count,
--     array::group(DISTINCT file_path) as files_affected
-- FROM (
--     SELECT 
--         components[*] as component,
--         file_path
--     FROM tool_invocations
--     WHERE operation IN ['write', 'edit'] AND project_id = 'my-project'
-- )
-- GROUP BY component
-- ORDER BY modification_count DESC
-- LIMIT 30;

-- Query 6: Analyze tool usage patterns across sessions
-- SELECT 
--     ae.session_id,
--     ae.goal,
--     count() as tool_invocations,
--     array::group(DISTINCT ti.tool_name) as tools_used,
--     avg(ti.impact_score) as avg_impact,
--     ae.outcome.success as session_success
-- FROM agent_executions ae
-- JOIN tool_invocations ti ON ae.session_id = ti.session_id
-- WHERE ae.project_id = 'my-project'
-- GROUP BY ae.session_id, ae.goal, ae.outcome.success
-- ORDER BY ae.created_at DESC;

-- Query 7: Similar files frequently co-modified
-- SELECT 
--     file_path,
--     similar_file,
--     count() as comodification_frequency
-- FROM (
--     SELECT 
--         file_path,
--         similar_files[*] as similar_file
--     FROM tool_invocations
--     WHERE operation IN ['write', 'edit'] AND array::len(similar_files) > 0
-- )
-- GROUP BY file_path, similar_file
-- HAVING comodification_frequency > 3
-- ORDER BY comodification_frequency DESC;

-- =============================================================================
-- Graph Relationships (For Future Implementation)
-- =============================================================================

-- Relationship: agent_executions -[invoked_tool]-> tool_invocations
-- Usage: Connect agent sessions to tool usage for holistic analysis
--
-- RELATE agent_executions:$session_id->invoked_tool->tool_invocations:$invocation_id
-- SET timestamp = time::now();

-- Relationship: tool_invocations -[affected_file]-> files (if file registry exists)
-- Usage: Track which tools affect which files for impact analysis
--
-- RELATE tool_invocations:$invocation_id->affected_file->files:$file_path
-- SET impact_score = $impact_score, operation = $operation;

-- =============================================================================
-- Data Retention Policy
-- =============================================================================
-- Unlike Redis (7-day TTL), SurrealDB stores permanently for analysis.
-- Optional cleanup query for old tool invocations (run periodically if needed):
--
-- DELETE FROM tool_invocations 
-- WHERE created_at < time::now() - 90d  -- Keep 90 days
-- AND project_id = 'my-project';

-- =============================================================================
-- Migration Notes
-- =============================================================================
-- 1. This table complements the existing Redis storage (not replaces)
-- 2. Redis: Fast access for active sessions (7-day TTL)
-- 3. SurrealDB: Long-term analysis and learning
-- 4. Backend should write to BOTH Redis and SurrealDB
-- 5. org_id and project_id extracted from session_id via parse_session_id()


```


### 005-impulse-tables.surql

```sql

-- =============================================================================
-- Impulse Tables - Central Registry and Usage Tracking
-- =============================================================================
-- Creates queryable tables for impulse tracking and effectiveness analysis.
-- Enables learning loop: which context (impulses) helps activities succeed?
-- 
-- Data Flow:
--   Activity Execution → Steps with impulses → Backend API → SurrealDB
-- 
-- Two Tables:
--   1. impulse_registry: Central registry of all impulses (metadata)
--   2. impulse_usage: Junction table (which impulses used in which steps)
-- =============================================================================

-- =============================================================================
-- Table 1: impulse_registry (Central Impulse Metadata)
-- =============================================================================

DEFINE TABLE impulse_registry SCHEMAFULL;

-- Identity
DEFINE FIELD impulse_id ON impulse_registry TYPE string;
DEFINE FIELD session_id ON impulse_registry TYPE option<string>;  -- Which session created it
DEFINE FIELD org_id ON impulse_registry TYPE string DEFAULT "anonymous";
DEFINE FIELD project_id ON impulse_registry TYPE string DEFAULT "default";

-- Type & Content
DEFINE FIELD impulse_type ON impulse_registry TYPE string;  -- file, memo, bashOutput, activity, etc.
DEFINE FIELD pointer ON impulse_registry TYPE object DEFAULT {};  -- Full pointer data (type-specific)
DEFINE FIELD scope ON impulse_registry TYPE string DEFAULT "session";  -- session, activity, global

-- Budget Management
DEFINE FIELD budget ON impulse_registry TYPE int DEFAULT 0;           -- Token budget allocated
DEFINE FIELD actual_tokens ON impulse_registry TYPE option<int>;  -- Actual usage (if resolved)

-- Usage Statistics (Computed from impulse_usage table)
DEFINE FIELD usage_count ON impulse_registry TYPE int DEFAULT 0;
DEFINE FIELD success_when_used ON impulse_registry TYPE int DEFAULT 0;
DEFINE FIELD success_rate ON impulse_registry TYPE float DEFAULT 0.0;

-- Context Metadata
DEFINE FIELD created_by ON impulse_registry TYPE string DEFAULT "unknown";    -- agent_id
DEFINE FIELD created_for ON impulse_registry TYPE string DEFAULT "";   -- Purpose/reason
DEFINE FIELD tags ON impulse_registry TYPE array DEFAULT [];
DEFINE FIELD related_impulses ON impulse_registry TYPE array DEFAULT [];  -- Similar impulses

-- Lifecycle
DEFINE FIELD status ON impulse_registry TYPE string DEFAULT "active";  -- active, archived, deprecated
DEFINE FIELD created_at ON impulse_registry TYPE datetime DEFAULT time::now();
DEFINE FIELD last_used_at ON impulse_registry TYPE option<datetime>;
DEFINE FIELD archived_at ON impulse_registry TYPE option<datetime>;

-- Indexes
DEFINE INDEX idx_impulse_registry_id ON impulse_registry FIELDS impulse_id UNIQUE;
DEFINE INDEX idx_impulse_registry_session ON impulse_registry FIELDS session_id;
DEFINE INDEX idx_impulse_registry_type ON impulse_registry FIELDS impulse_type;
DEFINE INDEX idx_impulse_registry_org_project ON impulse_registry FIELDS org_id, project_id;
DEFINE INDEX idx_impulse_registry_success_rate ON impulse_registry FIELDS success_rate;
DEFINE INDEX idx_impulse_registry_status ON impulse_registry FIELDS status;
DEFINE INDEX idx_impulse_registry_created_at ON impulse_registry FIELDS created_at;

-- Composite indexes
DEFINE INDEX idx_impulse_registry_project_type ON impulse_registry FIELDS project_id, impulse_type, success_rate;

-- =============================================================================
-- Table 2: impulse_usage (Junction Table - Steps → Impulses)
-- =============================================================================

DEFINE TABLE impulse_usage SCHEMAFULL;

-- Links
DEFINE FIELD execution_id ON impulse_usage TYPE string;
DEFINE FIELD step_id ON impulse_usage TYPE string;
DEFINE FIELD impulse_id ON impulse_usage TYPE string;

-- Usage Details
DEFINE FIELD usage_type ON impulse_usage TYPE string;      -- loaded, created, referenced
DEFINE FIELD resolution_time_ms ON impulse_usage TYPE option<int>;
DEFINE FIELD tokens_used ON impulse_usage TYPE option<int>;

-- Contribution to Success
DEFINE FIELD step_succeeded ON impulse_usage TYPE bool;
DEFINE FIELD contributed_to_success ON impulse_usage TYPE option<bool>;  -- Causal analysis (future)

-- Metadata
DEFINE FIELD created_at ON impulse_usage TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_impulse_usage_execution ON impulse_usage FIELDS execution_id;
DEFINE INDEX idx_impulse_usage_step ON impulse_usage FIELDS step_id;
DEFINE INDEX idx_impulse_usage_impulse ON impulse_usage FIELDS impulse_id;
DEFINE INDEX idx_impulse_usage_composite ON impulse_usage FIELDS impulse_id, step_succeeded;
DEFINE INDEX idx_impulse_usage_type ON impulse_usage FIELDS usage_type;

-- Composite index for common queries
DEFINE INDEX idx_impulse_usage_impulse_success ON impulse_usage FIELDS impulse_id, step_succeeded, created_at;

-- =============================================================================
-- Usage Examples - impulse_registry
-- =============================================================================

-- Query 1: Most effective impulses (high success rate, sufficient usage)
-- SELECT impulse_id, impulse_type, usage_count, success_rate 
-- FROM impulse_registry 
-- WHERE usage_count > 5 AND status = 'active'
-- ORDER BY success_rate DESC, usage_count DESC
-- LIMIT 20;

-- Query 2: Underutilized impulses (candidates for archival)
-- SELECT impulse_id, impulse_type, created_at, last_used_at, usage_count
-- FROM impulse_registry 
-- WHERE usage_count < 3 AND created_at < time::now() - 30d AND status = 'active'
-- ORDER BY created_at ASC;

-- Query 3: Impulse effectiveness by type
-- SELECT 
--     impulse_type,
--     count() as total_impulses,
--     avg(usage_count) as avg_usage,
--     avg(success_rate) as avg_success_rate
-- FROM impulse_registry
-- WHERE status = 'active'
-- GROUP BY impulse_type
-- ORDER BY avg_success_rate DESC;

-- Query 4: Project-specific impulse statistics
-- SELECT 
--     project_id,
--     impulse_type,
--     count() as impulse_count,
--     avg(success_rate) as avg_success_rate,
--     math::sum(usage_count) as total_usages
-- FROM impulse_registry
-- WHERE org_id = 'my-org' AND status = 'active'
-- GROUP BY project_id, impulse_type;

-- Query 5: Recently created impulses not yet validated
-- SELECT impulse_id, impulse_type, created_by, created_for
-- FROM impulse_registry
-- WHERE created_at > time::now() - 7d AND usage_count = 0
-- ORDER BY created_at DESC;

-- =============================================================================
-- Usage Examples - impulse_usage
-- =============================================================================

-- Query 6: Which impulses correlate with success?
-- SELECT 
--     iu.impulse_id,
--     ir.impulse_type,
--     count() as usage_count,
--     math::sum(CASE WHEN iu.step_succeeded THEN 1 ELSE 0 END) as success_count,
--     math::sum(CASE WHEN iu.step_succeeded THEN 1.0 ELSE 0.0 END) / count() as success_rate
-- FROM impulse_usage iu
-- JOIN impulse_registry ir ON iu.impulse_id = ir.impulse_id
-- GROUP BY iu.impulse_id, ir.impulse_type
-- HAVING usage_count > 5
-- ORDER BY success_rate DESC;

-- Query 7: What impulses do successful activities share?
-- SELECT 
--     iu.impulse_id,
--     ir.impulse_type,
--     array::group(ae.variant_id) as activities_using,
--     count(DISTINCT ae.variant_id) as activity_count
-- FROM impulse_usage iu
-- JOIN execution_steps es ON iu.step_id = es.step_id
-- JOIN activity_executions ae ON es.execution_id = ae.execution_id
-- JOIN impulse_registry ir ON iu.impulse_id = ir.impulse_id
-- WHERE ae.success = true
-- GROUP BY iu.impulse_id, ir.impulse_type
-- HAVING activity_count > 3
-- ORDER BY activity_count DESC;

-- Query 8: Impulse usage patterns for a specific execution
-- SELECT 
--     iu.step_id,
--     iu.impulse_id,
--     ir.impulse_type,
--     iu.usage_type,
--     iu.step_succeeded
-- FROM impulse_usage iu
-- JOIN impulse_registry ir ON iu.impulse_id = ir.impulse_id
-- WHERE iu.execution_id = 'exec_abc123'
-- ORDER BY iu.step_id;

-- Query 9: Find co-occurring impulses (often used together)
-- SELECT 
--     iu1.impulse_id as impulse_a,
--     iu2.impulse_id as impulse_b,
--     count(DISTINCT iu1.execution_id) as co_occurrence_count
-- FROM impulse_usage iu1
-- JOIN impulse_usage iu2 ON iu1.execution_id = iu2.execution_id
-- WHERE iu1.impulse_id < iu2.impulse_id  -- Avoid duplicates
-- GROUP BY iu1.impulse_id, iu2.impulse_id
-- HAVING co_occurrence_count > 5
-- ORDER BY co_occurrence_count DESC
-- LIMIT 50;

-- Query 10: Impulse resolution performance
-- SELECT 
--     ir.impulse_type,
--     count() as usage_count,
--     avg(iu.resolution_time_ms) as avg_resolution_ms,
--     avg(iu.tokens_used) as avg_tokens
-- FROM impulse_usage iu
-- JOIN impulse_registry ir ON iu.impulse_id = ir.impulse_id
-- WHERE iu.resolution_time_ms IS NOT NONE
-- GROUP BY ir.impulse_type
-- ORDER BY avg_resolution_ms DESC;

-- =============================================================================
-- Graph Relationships (For Future Implementation)
-- =============================================================================

-- Relationship: agent_executions -[created_impulse]-> impulse_registry
-- Usage: Track which agent sessions created which impulses
--
-- RELATE agent_executions:$session_id->created_impulse->impulse_registry:$impulse_id
-- SET created_at = time::now();

-- Relationship: execution_steps -[loaded_impulse]-> impulse_registry (via impulse_usage)
-- Usage: Track which steps used which impulses
--
-- RELATE execution_steps:$step_id->loaded_impulse->impulse_registry:$impulse_id
-- SET usage_type = 'loaded', step_succeeded = $success;

-- =============================================================================
-- Maintenance Queries
-- =============================================================================

-- Update usage statistics for an impulse (run periodically or on-demand)
-- UPDATE impulse_registry SET
--     usage_count = (SELECT count() FROM impulse_usage WHERE impulse_id = $impulse_id),
--     success_when_used = (SELECT count() FROM impulse_usage WHERE impulse_id = $impulse_id AND step_succeeded = true),
--     success_rate = (SELECT math::sum(CASE WHEN step_succeeded THEN 1.0 ELSE 0.0 END) / count() FROM impulse_usage WHERE impulse_id = $impulse_id),
--     last_used_at = (SELECT max(created_at) FROM impulse_usage WHERE impulse_id = $impulse_id)
-- WHERE impulse_id = $impulse_id;

-- Archive unused impulses older than 30 days
-- UPDATE impulse_registry SET
--     status = 'archived',
--     archived_at = time::now()
-- WHERE usage_count < 3 
--   AND created_at < time::now() - 30d 
--   AND status = 'active';

-- =============================================================================
-- Data Retention Policy
-- =============================================================================
-- impulse_registry: Keep permanently (metadata is small, valuable for analysis)
-- impulse_usage: Keep 90 days (junction table can grow large)
--
-- Optional cleanup for impulse_usage:
-- DELETE FROM impulse_usage 
-- WHERE created_at < time::now() - 90d;

-- =============================================================================
-- Migration Notes
-- =============================================================================
-- 1. impulse_registry requires manual population initially (no existing data source)
-- 2. impulse_usage populated from execution_steps.impulses_loaded/impulses_created
-- 3. Backend should create impulse_registry entry when impulse first created
-- 4. Backend should create impulse_usage entries when step result recorded
-- 5. Usage statistics (usage_count, success_rate) updated periodically or on-demand


```



================================================================================

## Proto Definitions Reference


Found 9 proto files:


- `activity/admin.proto`

- `activity/execution.proto`

- `activity/optimization.proto`

- `activity/variant.proto`

- `auth/organization.proto`

- `common/types.proto`

- `learning/consumer.proto`

- `metrics/events.proto`

- `session/session.proto`