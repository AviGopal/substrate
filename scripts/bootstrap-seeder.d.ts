#!/usr/bin/env bun
/**
 * bootstrap-seeder.ts — seed shared activity templates into activity-api.
 *
 * Reads SHARED_TEMPLATES from @avigopal/ias-executor-ts (built at
 * /vessels/ias-executor-ts) and UPSERTs each template via
 * POST /v2/activities/templates. The endpoint is idempotent (UPSERT
 * semantics in SurrealDB), so re-running on every substrate restart is safe.
 *
 * Environment variables (from /etc/substrate/env):
 *   METABOB_API_KEY      — API key for activity-api auth
 *   METABOB_ENDPOINT     — activity-api base URL (default: http://127.0.0.1:8080)
 *
 * Exits 0 on success, non-zero on fatal error.
 *
 * Spec: openspec/changes/2026-05-23-substrate-explicit-vessels tasks.md §Phase 3
 */
export {};
//# sourceMappingURL=bootstrap-seeder.d.ts.map