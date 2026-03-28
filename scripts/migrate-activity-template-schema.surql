-- Migration: Update activity_template schema to match RPC API data structure
-- Date: 2026-03-07
-- Issue: SCHEMAFULL table was dropping all RPC API fields (variant_id, activity_id, etc.)
--
-- OLD SCHEMA (metabob-backend): id, name, category, tasks, variables
-- NEW SCHEMA (metabob-rpc-api): variant_id, activity_id, variant_name, task_steps, version, etc.

USE NS metabob DB devbob;

-- Step 1: Remove old schema definition to allow new fields
REMOVE TABLE activity_template;

-- Step 2: Recreate table as SCHEMALESS (allows any fields)
-- This is the correct approach for flexible template storage
DEFINE TABLE IF NOT EXISTS activity_template SCHEMALESS;

-- Step 3: Define indexes for commonly queried fields
DEFINE INDEX activity_template_variant_id_idx ON activity_template FIELDS variant_id UNIQUE;
DEFINE INDEX activity_template_activity_id_idx ON activity_template FIELDS activity_id;
DEFINE INDEX activity_template_scope_idx ON activity_template FIELDS scope;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
DEFINE INDEX activity_template_created_idx ON activity_template FIELDS created_at;

-- Indexes are crucial for query performance:
-- - variant_id: Primary lookup (UNIQUE ensures no duplicates)
-- - activity_id: Lookup by template family (allows multiple variants)
-- - scope: Filter by global/org scope
-- - org_id: Multi-tenant filtering
-- - created_at: Sorting by newest first
