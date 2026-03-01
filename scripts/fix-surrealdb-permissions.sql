-- =============================================================================
-- SurrealDB Permissions Fix for v2.x IAM
-- =============================================================================
-- Problem: Tables created with PERMISSIONS NONE block even root user access
-- Solution: Update all tables to use PERMISSIONS FULL for root-level access
-- 
-- This enables the HTTP API to work with root credentials.
-- =============================================================================

USE NS metabob DB production;

-- Fix activity_template table permissions
DEFINE TABLE activity_template TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix activity_variants table permissions  
DEFINE TABLE activity_variants TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix api_keys table permissions
DEFINE TABLE api_keys TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix audit_logs table permissions
DEFINE TABLE audit_logs TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix organizations table permissions
DEFINE TABLE organizations TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix projects table permissions
DEFINE TABLE projects TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix schema_versions table permissions
DEFINE TABLE schema_versions TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

-- Fix subscriptions table permissions
DEFINE TABLE subscriptions TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix users table permissions
DEFINE TABLE users TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix sessions table permissions (if exists)
DEFINE TABLE sessions TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix activity_execution table permissions (if exists)
DEFINE TABLE activity_execution TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- Fix vessel_registry table permissions (if exists)
DEFINE TABLE vessel_registry TYPE ANY SCHEMALESS PERMISSIONS FULL;

-- =============================================================================
-- Verification
-- =============================================================================
-- Run: INFO FOR DB;
-- All tables should now show PERMISSIONS FULL
