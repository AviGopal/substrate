-- API Keys Enhancement: Add name, prefix, status fields for dashboard integration
-- These fields support the API Keys management page in metabob-cloud-dashboard

-- Add name field for user-friendly key identification
DEFINE FIELD IF NOT EXISTS name ON api_keys TYPE option<string>
  VALUE $value;

-- Add prefix field for masked display (e.g., "mb_live_")
DEFINE FIELD IF NOT EXISTS prefix ON api_keys TYPE string
  VALUE $value
  DEFAULT 'mb_live_';

-- Add status field to track key state (active/revoked)
DEFINE FIELD IF NOT EXISTS status ON api_keys TYPE string
  ASSERT $value IN ['active', 'revoked']
  VALUE $value
  DEFAULT 'active';

-- Add usage_count field for tracking
DEFINE FIELD IF NOT EXISTS usage_count ON api_keys TYPE int
  VALUE $value
  DEFAULT 0;

-- Add revoked_at timestamp
DEFINE FIELD IF NOT EXISTS revoked_at ON api_keys TYPE option<datetime>
  VALUE $value;

-- Update PERMISSIONS to allow users to query by status
-- (Already defined in 002-organizations.surql, no changes needed)

-- Index for status filtering
DEFINE INDEX IF NOT EXISTS idx_api_key_status ON api_keys FIELDS status;
DEFINE INDEX IF NOT EXISTS idx_api_key_user_status ON api_keys FIELDS user_id, status;
