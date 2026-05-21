# Proposal: Team-Lead Key Overview

## Why

Playwright verification against `app.metabob.com` (2026-05-21) with
a seeded team-lead scenario (two devs, Alice with 12 calls + 1
failure, Bob with 3 calls) surfaced three real gaps in the
team-lead persona's view:

1. **No cross-key activity overview.** API Keys page lists keys
   but shows a static `0/1 conn` badge (the gated old activity-api
   metric). To see "everyone's usage" the team lead must navigate
   to `/mcp` → Usage → select each key one at a time from a
   dropdown. With N developers this is N navigations.
2. **Raw API key leaks into the Usage dropdown label.**
   The `<select>` renders options as
   `Alice (lead dev) (mb-…full-raw-key…)`. The raw key is the
   secret credential. It should never appear in a UI label;
   prefix-only is correct.
3. **Identity-vessel may be returning raw keys from `GET /v1/keys`
   list.** The dropdown leak is downstream of whatever the
   dashboard's `useApiKeys()` hook receives. If identity-vessel
   ships raw keys in the list response, that's a security
   regression — the contract from `createApiKey` was "shown once,
   prefix thereafter."

This change fixes all three with one tight scope.

## What changes

1. **user-vessel** — new batch endpoint
   `GET /v2/mcp/usage` (no `api_key_id`). Returns
   `{ snapshots: McpUsageSnapshot[] }` for every snapshot whose
   `org_id` matches the caller's `$token.org_id`. SurrealDB
   PERMISSIONS already enforce the filter; the handler just
   `SELECT` without a WHERE clause and relies on the access rule.

2. **identity-vessel** — audit `GET /v1/keys` list response. If
   the handler currently includes the raw `key` field, redact it
   to `key_prefix` (first 12 chars) so list responses never carry
   the secret material. New responses include `key_id` (existing)
   and `key_prefix` (new); raw `key` is removed.

3. **cloud-dashboard** — three small UI changes:
   - **API Keys page** (`APIKeysPage.tsx`): on mount, call
     `GET /api/mcp/usage` (batch). Render an inline badge per row:
     `<N calls · last seen <relative-time>>`. When no snapshot
     exists for a key, render `<no activity yet>`.
   - **Usage tab dropdown**: drop the raw-key suffix from option
     labels. Show `Alice (lead dev) · <key-prefix>…` instead.
   - `useApiKeys()` hook: read the new `key_prefix` field; if a
     handler still returns raw `key`, treat it as a transitional
     state and strip to prefix before render.

4. **rubric** — extend `01-onboard.spec.ts`:
   - After seeding telemetry for the seeded key, navigate to
     `/api-keys` and assert the inline badge shows
     `total_calls >= 1` for that key row.
   - Assert no `<option>` in any select on the `/mcp` route
     contains the substring `mb-` followed by a hyphen-separated
     base64 payload (a heuristic raw-key detector — the prefix
     form contains the `mb-…` but not the full structure).

## Non-goals

- A "team activity feed" (event-level audit log). Snapshot remains
  the source of truth; a separate `mcp_usage_event` table is a
  future capability when product needs per-call detail.
- A "by-developer" view that ties keys back to user identities.
  user-vessel already stores `user_id` on the snapshot; surfacing
  it in the UI is a follow-up to this change.
- A weekly/monthly rollup chart. Snapshot has `first_seen_at` and
  `last_seen_at`; time-windowed slicing is a future capability.
- Modifying `mcp_usage_snapshot` schema. The new batch endpoint
  reads existing rows.
- rpc-api remains frozen.

## Success criteria

- `GET https://user.metabob.com/v2/mcp/usage` (no api_key_id, JWT
  auth) returns all snapshots for the caller's org. Cross-org
  callers see none.
- `GET https://identity.metabob.com/v1/keys` no longer includes
  raw `key` in responses; it includes `key_prefix` instead.
- Visiting `/api-keys` on canary as the team-lead scenario user
  shows inline `<N calls · last seen …>` badges for both seeded
  keys.
- The `/mcp` Usage dropdown labels show key prefix only —
  Playwright assertion catches any raw-key substring.
- All four surfaces (user-vessel, identity-vessel,
  cloud-dashboard, rubric) commit on `dev`, deploy to canary,
  rubric remains green (`failed: 0`).
- New capability `team-lead-key-overview` archived under
  `openspec/specs/`.
