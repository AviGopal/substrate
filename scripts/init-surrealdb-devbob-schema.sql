-- =============================================================================
-- SurrealDB Schema for DevBob Activity Storage
-- =============================================================================
-- This schema defines the tables and indexes for storing DevBob activity
-- templates and execution records.
--
-- Usage:
--   cat scripts/init-surrealdb-devbob-schema.sql | \
--     surreal sql -u root -p root --ns metabob --db devbob
--
-- =============================================================================

-- Use the metabob namespace and devbob database
USE NS metabob DB devbob;

-- =============================================================================
-- Activity Template Table
-- =============================================================================
-- Stores reusable activity templates that can be executed by DevBob agents

DEFINE TABLE IF NOT EXISTS activity_template SCHEMAFULL;

DEFINE FIELD id ON activity_template TYPE string
  ASSERT $value != NONE;

DEFINE FIELD name ON activity_template TYPE string
  ASSERT $value != NONE;

DEFINE FIELD description ON activity_template TYPE string;

DEFINE FIELD category ON activity_template TYPE string
  ASSERT $value IN ["feature", "bugfix", "refactor", "tool", "infrastructure"];

DEFINE FIELD tasks ON activity_template TYPE array;

DEFINE FIELD variables ON activity_template TYPE array;

DEFINE FIELD metabob ON activity_template TYPE object;

DEFINE FIELD created_at ON activity_template TYPE datetime
  DEFAULT time::now();

DEFINE FIELD updated_at ON activity_template TYPE datetime
  DEFAULT time::now();

-- Indexes for fast lookups
DEFINE INDEX activity_template_id_idx ON activity_template FIELDS id UNIQUE;
DEFINE INDEX activity_template_category_idx ON activity_template FIELDS category;
DEFINE INDEX activity_template_name_idx ON activity_template FIELDS name;

-- =============================================================================
-- Activity Execution Table
-- =============================================================================
-- Records of activity template executions

DEFINE TABLE IF NOT EXISTS activity_execution SCHEMAFULL;

DEFINE FIELD id ON activity_execution TYPE string
  ASSERT $value != NONE;

DEFINE FIELD template_id ON activity_execution TYPE string
  ASSERT $value != NONE;

DEFINE FIELD status ON activity_execution TYPE string
  ASSERT $value IN ["pending", "running", "completed", "failed", "cancelled"];

DEFINE FIELD agent_id ON activity_execution TYPE string;

DEFINE FIELD variables ON activity_execution TYPE object;

DEFINE FIELD start_time ON activity_execution TYPE datetime
  DEFAULT time::now();

DEFINE FIELD end_time ON activity_execution TYPE datetime;

DEFINE FIELD duration_ms ON activity_execution TYPE number;

DEFINE FIELD cost ON activity_execution TYPE number;

DEFINE FIELD tokens ON activity_execution TYPE object;

DEFINE FIELD error ON activity_execution TYPE string;

DEFINE FIELD created_at ON activity_execution TYPE datetime
  DEFAULT time::now();

-- Indexes for fast lookups
DEFINE INDEX activity_execution_id_idx ON activity_execution FIELDS id UNIQUE;
DEFINE INDEX activity_execution_template_idx ON activity_execution FIELDS template_id;
DEFINE INDEX activity_execution_status_idx ON activity_execution FIELDS status;
DEFINE INDEX activity_execution_agent_idx ON activity_execution FIELDS agent_id;

-- =============================================================================
-- Vessel Registry Table
-- =============================================================================
-- Tracks all vessels in the distributed DevBob deployment
-- Enables vessel discovery and health monitoring

DEFINE TABLE IF NOT EXISTS vessel_registry SCHEMAFULL;

DEFINE FIELD pod_name ON vessel_registry TYPE string
  ASSERT $value != NONE;

DEFINE FIELD pod_ip ON vessel_registry TYPE string;

DEFINE FIELD acp_endpoint ON vessel_registry TYPE string
  ASSERT $value != NONE;

DEFINE FIELD status ON vessel_registry TYPE string
  ASSERT $value IN ["starting", "running", "stopping", "stopped"]
  DEFAULT "starting";

DEFINE FIELD last_heartbeat ON vessel_registry TYPE datetime
  DEFAULT time::now();

DEFINE FIELD registered_at ON vessel_registry TYPE datetime
  DEFAULT time::now();

-- Indexes for fast lookups
DEFINE INDEX vessel_registry_pod_name_idx ON vessel_registry FIELDS pod_name UNIQUE;
DEFINE INDEX vessel_registry_status_idx ON vessel_registry FIELDS status;

-- =============================================================================
-- Schema Initialized
-- =============================================================================
-- Run SELECT * FROM activity_template; to verify
-- Run SELECT * FROM vessel_registry; to verify vessel registration
