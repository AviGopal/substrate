-- API Keys Table Schema
-- Stores API keys for CLI authentication and usage tracking
-- Part of metabob-cli-to-dashboard-data-flow specification

DEFINE TABLE IF NOT EXISTS api_keys SCHEMAFULL PERMISSIONS FULL;

-- Primary key
DEFINE FIELD key_id ON api_keys TYPE string;

-- The actual API key (hashed or encrypted in production)
DEFINE FIELD api_key ON api_keys TYPE string;

-- Foreign keys
DEFINE FIELD user_id ON api_keys TYPE string;
DEFINE FIELD org_id ON api_keys TYPE string;

-- Metadata
DEFINE FIELD name ON api_keys TYPE string;
DEFINE FIELD scopes ON api_keys TYPE array DEFAULT ["read", "write"];
DEFINE FIELD is_active ON api_keys TYPE bool DEFAULT true;

-- Usage tracking
DEFINE FIELD last_used_at ON api_keys TYPE option<datetime>;
DEFINE FIELD expires_at ON api_keys TYPE option<datetime>;

-- Timestamps
DEFINE FIELD created_at ON api_keys TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON api_keys TYPE datetime DEFAULT time::now();

-- Indexes for performance
DEFINE INDEX api_keys_key_id_idx ON api_keys FIELDS key_id UNIQUE;
DEFINE INDEX api_keys_api_key_idx ON api_keys FIELDS api_key UNIQUE;
DEFINE INDEX api_keys_org_id_idx ON api_keys FIELDS org_id;
DEFINE INDEX api_keys_user_id_idx ON api_keys FIELDS user_id;

-- Comments for documentation
-- This table enables:
-- 1. CLI authentication via API keys
-- 2. Per-key usage tracking (sessions, files, problems)
-- 3. Key revocation and management
-- 4. Organization-level API key management
