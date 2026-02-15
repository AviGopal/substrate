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
