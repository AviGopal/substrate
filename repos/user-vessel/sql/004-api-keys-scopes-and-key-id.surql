-- user-vessel — api_key.scopes + api_key.key_id
--
-- Background: identity-vessel's `lookupKeyScopes(keyId)` (validation.ts) queries
-- `api_key` by `id` or `key_prefix` and returns the row's `scopes` field. Two
-- gaps prevent this from working end-to-end:
--   1. `api_key` (Phase 1 schema) has no `scopes` column, so the lookup
--      always returns null and `resolveAPIKey()` falls back to the hardcoded
--      `['read','write']` defaults — meaning admin-scoped API-key auth is
--      impossible (blocks the admin-scope-enabled key-issuance path).
--   2. There is no link between the HMAC-embedded `key_id` (e.g.
--      `key_avi_canary_admin01`) and the SurrealDB record's auto-generated
--      `api_key:<rand>` id, so HMAC validators can't look the row up by the
--      identifier they carry on the wire.
--
-- This migration:
--   - Adds `scopes` (option<array<string>>, default ["read","write"]) so legacy
--     rows continue to authenticate read+write without a backfill step.
--   - Adds `key_id` (option<string>) + UNIQUE index for fast HMAC-embedded
--     identifier lookups. Optional so existing rows remain valid; operators run
--     a separate backfill to populate `key_id` on legacy rows after this
--     migration lands.
--
-- Backfill policy: NOT performed in this migration. Existing rows have an
-- empty `scopes` (defaults to ["read","write"] on read via the option default)
-- and a NULL `key_id`. Operators backfill via:
--   UPDATE api_key SET key_id = <derived> WHERE key_id IS NONE;
-- where <derived> is sourced from the seeded helmfile / init-data SurrealQL
-- that originally minted the key (or from a one-shot reconciliation script).
--
-- Idempotent: DEFINE FIELD/INDEX OVERWRITE is safe to re-run. Matches the
-- pattern used by activity-api migration 094 (impulse_resolutions) — see
-- the project CLAUDE.md.

-- =============================================================================
-- api_key.scopes
-- =============================================================================

DEFINE FIELD OVERWRITE scopes ON api_key TYPE option<array<string>>
  DEFAULT ["read", "write"];

-- =============================================================================
-- api_key.key_id  (HMAC-embedded identifier)
-- =============================================================================

DEFINE FIELD OVERWRITE key_id ON api_key TYPE option<string>;

DEFINE INDEX OVERWRITE idx_api_keys_key_id ON api_key FIELDS key_id UNIQUE;
