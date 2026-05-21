# Raw Key Stash Cleanup

## Why
After `mcp-usage-telemetry` swapped the dashboard `/api/mcp/usage` BFF to a `GET ?api_key_id=` read against user-vessel (keyed by `api_key_id`, scoped by `$token.org_id`), the raw API key is no longer required in the browser to render the Usage tab. The `rawKeyStash` sessionStorage write at key creation time and the legacy `POST /api/mcp/usage { raw_key }` BFF branch are now dead code that briefly puts raw key material in `sessionStorage`. Removing them shrinks the XSS-readable surface and deletes ~70 LOC of unused glue.

## What Changes
- Delete `repos/metabob-cloud-dashboard/src/features/mcp/lib/rawKeyStash.ts`.
- Remove imports + write/forget sites in `src/features/api-keys/APIKeysPage.tsx`.
- Update `src/features/mcp/UsageTab.tsx` header comment (drop the "removed in follow-up" line).
- Remove the legacy `POST /api/mcp/usage` branch from `src/index.ts`; keep only `GET /api/mcp/usage?api_key_id=` and the batch (no-id) read.

## Impact
- BFF: one HTTP method becomes 405. No active client posts to this path.
- Browser: no new `metabob_raw_api_keys` entries are written; existing sessionStorage entries become unreferenced and naturally age out on tab close.
- No schema, vessel, or wire-protocol changes.
