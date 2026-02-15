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
