-- =============================================================================
-- API Keys Connection Slots Extension
-- =============================================================================
-- Extends api_keys table with connection slot limits and LLM budget fields.
-- These fields enable the connection-based billing model and LLM proxy.
-- =============================================================================

-- =============================================================================
-- Connection Slot Fields
-- =============================================================================

-- Maximum concurrent connections allowed for this API key
DEFINE FIELD IF NOT EXISTS max_connections ON api_keys TYPE int
  ASSERT $value >= 1 AND $value <= 1000
  VALUE $value OR 1
  DEFAULT 1
  COMMENT "Maximum concurrent connection slots (1-1000, default 1)";

-- Tier determines default limits and features
DEFINE FIELD IF NOT EXISTS tier ON api_keys TYPE string
  ASSERT $value IN ['starter', 'pro', 'enterprise']
  VALUE $value OR 'starter'
  DEFAULT 'starter'
  COMMENT "Subscription tier: starter (1 slot), pro (5 slots), enterprise (custom)";

-- =============================================================================
-- LLM Budget Fields
-- =============================================================================

-- Token budget for LLM proxy usage
DEFINE FIELD IF NOT EXISTS llm_budget ON api_keys TYPE object
  VALUE $value OR {
    tokens_per_month: 1000000,
    tokens_used: 0,
    reset_at: time::now() + 30d,
    overage_enabled: false
  }
  DEFAULT {
    tokens_per_month: 1000000,
    tokens_used: 0,
    reset_at: time::now() + 30d,
    overage_enabled: false
  }
  COMMENT "LLM token budget: monthly allocation, usage tracking, overage settings";

-- Nested field definitions for llm_budget
DEFINE FIELD IF NOT EXISTS llm_budget.tokens_per_month ON api_keys TYPE int
  ASSERT $value >= 0
  VALUE $value OR 1000000
  DEFAULT 1000000
  COMMENT "Monthly token allocation (default 1M for starter)";

DEFINE FIELD IF NOT EXISTS llm_budget.tokens_used ON api_keys TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  DEFAULT 0
  COMMENT "Tokens used in current billing period";

DEFINE FIELD IF NOT EXISTS llm_budget.reset_at ON api_keys TYPE datetime
  VALUE $value OR time::now() + 30d
  COMMENT "When token budget resets (monthly)";

DEFINE FIELD IF NOT EXISTS llm_budget.overage_enabled ON api_keys TYPE bool
  VALUE $value OR false
  DEFAULT false
  COMMENT "Allow usage beyond budget (billed at overage rate)";

-- =============================================================================
-- Billing Contact (Optional)
-- =============================================================================

DEFINE FIELD IF NOT EXISTS billing_email ON api_keys TYPE option<string>
  ASSERT $value IS NONE OR string::is_email($value)
  COMMENT "Email for billing notifications and budget alerts";

-- =============================================================================
-- Default Tier Limits
-- =============================================================================
-- These are reference values; actual limits stored in max_connections/llm_budget
--
-- Tier: starter
--   max_connections: 1
--   tokens_per_month: 1,000,000 (1M)
--
-- Tier: pro
--   max_connections: 5
--   tokens_per_month: 10,000,000 (10M)
--
-- Tier: enterprise
--   max_connections: custom (up to 1000)
--   tokens_per_month: custom
-- =============================================================================

-- =============================================================================
-- Indexes for Connection Slot Queries
-- =============================================================================

-- Tier filtering for analytics
DEFINE INDEX IF NOT EXISTS idx_api_key_tier
  ON api_keys FIELDS tier;

-- Budget reset scheduling
DEFINE INDEX IF NOT EXISTS idx_api_key_budget_reset
  ON api_keys FIELDS llm_budget.reset_at;
