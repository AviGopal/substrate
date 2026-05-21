# Design — raw-key-stash-cleanup

## Context
`mcp-usage-telemetry` (2026-05-21) replaced the rpc-api `/session` exchange with a direct `user-vessel /v2/mcp/usage?api_key_id=` read. The Usage tab no longer needs the raw key in the browser — `api_key_id` is enough. The stash and its BFF intake remain only for back-compat during one release.

## Decision
Delete both. There are no clients still posting `raw_key`:
- `APIKeysPage` calls `stashRawKey` on create; nothing reads it.
- The BFF POST branch logs a deprecation warning and forwards the GET shape; never invoked by current UI.

## Out of scope
- Migrating already-stashed sessionStorage entries — they belong to the user's own browser session and harmlessly age out.
- Touching user-vessel `/v2/mcp/usage` — the read path is unchanged.

## Verification
Real-mcp-client invocation against canary (JSON-RPC stdio handshake, fresh `mb-*` key, calls `init_workspace` + `mark_complete` + `annotate_component` + `assign_git_changes`). Telemetry must still land in user-vessel and render in the dashboard Usage tab without the stash existing.
