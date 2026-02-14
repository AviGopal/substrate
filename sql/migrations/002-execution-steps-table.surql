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
