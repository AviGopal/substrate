# Tasks: Team-Lead Key Overview

## §1 user-vessel — batch endpoint

- [x] 1.1 Extend the existing `/v2/mcp/usage` handler in
      `repos/user-vessel/src/routes/` to branch on
      `c.req.query("api_key_id")`. When ABSENT, return
      `{ snapshots: [...] }` for all rows the JWT can see (PERMISSIONS
      handle the filter). When present, keep current behavior.
- [x] 1.2 Cap the response at 500 rows. Add a `total` field
      reflecting the count even if truncated. Log a warning when
      truncation fires.
- [x] 1.3 Unit test: org A's caller sees only org A's snapshots;
      org B is invisible. Capping triggers correctly at 501 rows.

## §2 identity-vessel — `/v1/keys` audit

- [x] 2.1 Grep `repos/identity-vessel/src/` for the `/v1/keys`
      GET handler. Read it; determine whether raw `key` is in the
      response body.
- [x] 2.2 If raw key is present: redact. Replace the `key` field
      with `key_prefix` (first 12 chars). Keep `key_id` as-is.
      Update any shared type definition.
- [x] 2.3 Unit test (or integration probe): list response
      contains `key_prefix`, does NOT contain a raw key (regex
      `mb-[A-Za-z0-9+/=_-]{30,}` absent).
- [x] 2.4 If raw key was NOT present (i.e., the audit found
      identity-vessel was already clean), skip 2.2 + 2.3 and note
      the finding in the change's tasks.md.

  **§0 AUDIT FINDING (2026-05-21)**: `GET /v1/keys` at
  `src/index.ts:1076` selects
  `id, key_id, key_prefix, org_id, user_id, name, prefix, scopes,
  is_active, created_at, expires_at` and maps to a response that
  exposes `prefix` (the public identifier portion of the raw key —
  base64 of `org_id-user_id-key_id-issuer`, NO HMAC suffix), NOT
  the raw `key`. Curl probe against `https://identity.metabob.com/v1/keys`
  with the team-lead JWT confirms: the response contains `prefix` but
  no field whose value matches the full raw-key shape
  (`mb-<b64>-<32-hex-hmac>`). The `prefix` IS long enough to trip the
  rubric heuristic regex `mb-[A-Za-z0-9+/=_-]{30,}`, but it is NOT a
  credential by itself — without the HMAC suffix, identity-vessel's
  `verifyKey()` rejects it. §2.2 + §2.3 therefore SKIPPED. The
  dashboard fix is to truncate `prefix` to 12 chars at the rendering
  layer (R4) — done in `UsageTab.tsx`. No identity-vessel commit
  needed for this change.

## §3 cloud-dashboard — inline badges + dropdown fix

- [x] 3.1 Add `useAllMcpUsage()` hook at
      `repos/metabob-cloud-dashboard/src/features/mcp/hooks/useAllMcpUsage.ts`.
      Returns `Record<api_key_id, McpUsageSnapshot>`. Indexed for
      O(1) lookup. 30s staleTime, no retry.
- [x] 3.2 Update BFF `/api/mcp/usage` handler in
      `src/index.ts`: when no `api_key_id` query param, proxy
      `GET ${USER_VESSEL_URL}/v2/mcp/usage` (no param). When
      present, keep existing single-key behavior.
- [x] 3.3 Create `UsageBadge` component at
      `src/features/api-keys/components/UsageBadge.tsx` with the
      shape from design.md. Include `relativeTime` helper inline
      (no new dependency).
- [x] 3.4 Wire `UsageBadge` into `APIKeysPage.tsx` next to each
      key row. Add `data-key-id={k.key_id}` to the row container
      so rubric can target it.
- [x] 3.5 Update `UsageTab.tsx` dropdown: option label is
      `${name || key_id} · ${key_prefix ?? truncate(key, 12)}`.
      Don't render the full raw key anywhere in the dropdown.
- [x] 3.6 In `useApiKeys()` hook: if the response includes raw
      `key` (transitional state), strip to prefix before passing
      to consumers. After identity-vessel redaction lands, this
      branch is dead code but harmless.

## §4 Rubric extension

- [x] 4.1 In `e2e/rubric/01-onboard.spec.ts`, after the
      create/revoke assertions, add: "inline usage badge appears
      after telemetry" — navigates to `/api-keys`, locates the
      seeded key by `data-key-id`, asserts visible text matches
      `/\d+ calls/` and `/last seen/`.
- [x] 4.2 Add: "dropdown labels don't leak raw key" — visits
      `/mcp` Usage tab, collects all `<option>` text content,
      asserts none match `mb-[A-Za-z0-9+/=_-]{30,}`.
- [x] 4.3 Ensure the rubric's `globalSetup` emits at least one
      telemetry POST for the seeded key BEFORE running specs
      (it already does in the post-iter-1 state — confirm).

## §5 Verification

- [x] 5.1 Local: `curl https://user.metabob.com/v2/mcp/usage
      -H "Authorization: Bearer <jwt>"` returns the array shape.
- [x] 5.2 Local: `curl https://identity.metabob.com/v1/keys
      -H "Authorization: Bearer <jwt>"` — confirm `key_prefix`
      field; no raw `key`.
- [x] 5.3 Boot dashboard locally with canary backends, log in as
      the seeded scenario, visit `/api-keys`. Visually confirm
      inline badges show counts; `/mcp` dropdown shows prefix
      only.
- [x] 5.4 `bun run dev-loop` → `failed: 0`, including the two
      new rubric assertions.

## §6 Deploy (in order)

- [x] 6.1 Deploy user-vessel to canary. Verify
      `GET /v2/mcp/usage` (no param) returns array. Verify
      single-key path unchanged.
- [x] 6.2 Deploy identity-vessel to canary. Verify
      `GET /v1/keys` shape change. **SKIPPED** — §0 audit finding;
      identity-vessel was already clean, no code change.
- [x] 6.3 Deploy cloud-dashboard to canary. Verify
      `app.metabob.com/api-keys` shows inline badges, `/mcp`
      dropdown is clean.
- [x] 6.4 Run rubric against canary.

## §7 Commits + archive

- [x] 7.1 Commits (no Co-Authored-By):
      - `repos/user-vessel`:
        `feat(mcp-usage): batch GET endpoint for org-scoped snapshots`
      - `repos/identity-vessel`: SKIPPED (§0 audit finding)
      - `repos/metabob-cloud-dashboard`:
        `feat(api-keys): inline mcp usage badges + prefix-only dropdown`
      - `repos/deployment`:
        `chore(deploy): user-vessel + identity-vessel + cloud-dashboard for team-lead overview`
      - super-repo:
        `docs(boundaries): team-lead-key-overview spec + 3 submodule bumps`
- [x] 7.2 Push all five.
- [x] 7.3 Archive: move change dir to
      `openspec/changes/archive/2026-05-21-team-lead-key-overview/`
      and lift the spec to
      `openspec/specs/team-lead-key-overview/spec.md`.
- [x] 7.4 Update `docs/PRODUCT_BOUNDARIES.md`: add a short note
      under "MCP surface in dashboard" describing the
      org-scoped batch endpoint and the team-lead inline view.
