-- Subscriptions and audit logs for billing and security tracking

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

DEFINE TABLE IF NOT EXISTS subscriptions SCHEMAFULL
  PERMISSIONS
    -- Users can view their organization's subscription
    FOR select WHERE org_id = $auth.org_id
    -- Only admins can update subscriptions (typically via Stripe webhooks)
    FOR create, update WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR delete NONE;

DEFINE FIELD IF NOT EXISTS org_id ON subscriptions TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS stripe_subscription_id ON subscriptions TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS stripe_customer_id ON subscriptions TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS plan ON subscriptions TYPE string
  ASSERT $value IN ['free', 'starter', 'pro', 'enterprise']
  VALUE $value
  DEFAULT 'free';

DEFINE FIELD IF NOT EXISTS status ON subscriptions TYPE string
  ASSERT $value IN ['active', 'past_due', 'canceled', 'incomplete', 'trialing']
  VALUE $value
  DEFAULT 'trialing';

DEFINE FIELD IF NOT EXISTS seat_limit ON subscriptions TYPE int
  ASSERT $value >= 1
  VALUE $value
  DEFAULT 5;

DEFINE FIELD IF NOT EXISTS current_period_start ON subscriptions TYPE option<datetime>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS current_period_end ON subscriptions TYPE option<datetime>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS cancel_at_period_end ON subscriptions TYPE bool
  VALUE $value
  DEFAULT false;

DEFINE FIELD IF NOT EXISTS metadata ON subscriptions TYPE option<object>
  VALUE $value;

DEFINE INDEX IF NOT EXISTS idx_subscription_org ON subscriptions FIELDS org_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_subscription_stripe ON subscriptions FIELDS stripe_subscription_id;
DEFINE INDEX IF NOT EXISTS idx_subscription_status ON subscriptions FIELDS status;

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================

DEFINE TABLE IF NOT EXISTS audit_logs SCHEMAFULL
  PERMISSIONS
    -- Users can view audit logs for their organization
    FOR select WHERE org_id = $auth.org_id AND ($auth.role = 'admin' OR user_id = $auth.id)
    -- System can create audit logs (application layer manages this)
    FOR create FULL
    -- Audit logs cannot be updated or deleted
    FOR update, delete NONE;

DEFINE FIELD IF NOT EXISTS org_id ON audit_logs TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS user_id ON audit_logs TYPE option<record<users>>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS action ON audit_logs TYPE string
  ASSERT $value IN ['login', 'logout', 'create', 'update', 'delete', 'access_denied', 'api_key_created', 'api_key_revoked']
  VALUE $value;

DEFINE FIELD IF NOT EXISTS resource_type ON audit_logs TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS resource_id ON audit_logs TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS timestamp ON audit_logs TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS ip_address ON audit_logs TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS user_agent ON audit_logs TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS details ON audit_logs TYPE option<object>
  VALUE $value;

DEFINE INDEX IF NOT EXISTS idx_audit_org ON audit_logs FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_audit_user ON audit_logs FIELDS user_id;
DEFINE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs FIELDS timestamp;
DEFINE INDEX IF NOT EXISTS idx_audit_org_timestamp ON audit_logs FIELDS org_id, timestamp;
DEFINE INDEX IF NOT EXISTS idx_audit_action ON audit_logs FIELDS action;
