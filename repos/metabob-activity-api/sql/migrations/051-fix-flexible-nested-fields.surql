-- Migration: Ensure FLEXIBLE mode for nested object fields
-- Created: 2026-04-06
-- Purpose: Fix schema errors when storing execution traces with nested impulse data
--
-- Errors being fixed:
-- - "Found field 'output_impulses[1].impulse_id', but no such field exists"
-- - "Found field 'tasks[2].prompt.variables[0].description', but no such field exists"
--
-- SurrealDB FLEXIBLE allows arbitrary additional fields but needs explicit definition

-- =============================================================================
-- activity_execution_traces: Fix output_impulses nested fields
-- =============================================================================
-- Allow any fields inside output_impulses array objects
DEFINE FIELD IF NOT EXISTS output_impulses ON activity_execution_traces TYPE option<array<object>> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS output_impulses.* ON activity_execution_traces TYPE object FLEXIBLE;

-- Common fields that MiniBob sends (defined for type safety but FLEXIBLE allows others)
DEFINE FIELD IF NOT EXISTS output_impulses.*.impulse_id ON activity_execution_traces TYPE option<string>;
DEFINE FIELD IF NOT EXISTS output_impulses.*.shape ON activity_execution_traces TYPE option<string>;
DEFINE FIELD IF NOT EXISTS output_impulses.*.pointer ON activity_execution_traces TYPE option<object> FLEXIBLE;

-- =============================================================================
-- activity_execution_traces: Fix tasks nested fields
-- =============================================================================
DEFINE FIELD IF NOT EXISTS tasks ON activity_execution_traces TYPE option<array<object>> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.* ON activity_execution_traces TYPE object FLEXIBLE;

-- =============================================================================
-- activity: Fix tasks nested fields for template storage
-- =============================================================================
DEFINE FIELD IF NOT EXISTS tasks ON activity TYPE option<array<object>> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.* ON activity TYPE object FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.*.prompt ON activity TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.*.prompt.* ON activity TYPE any FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.*.prompt.variables ON activity TYPE option<array<object>> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.*.prompt.variables.* ON activity TYPE object FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.*.validation ON activity TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tasks.*.retry ON activity TYPE option<object> FLEXIBLE;

-- =============================================================================
-- execution (paradigm table): Ensure trace object is fully flexible
-- =============================================================================
DEFINE FIELD IF NOT EXISTS trace ON execution TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS trace.* ON execution TYPE any FLEXIBLE;

-- =============================================================================
-- Verify migration
-- =============================================================================
-- This should return the field definitions showing FLEXIBLE mode
-- INFO FOR TABLE activity_execution_traces;
-- INFO FOR TABLE activity;
-- INFO FOR TABLE execution;
