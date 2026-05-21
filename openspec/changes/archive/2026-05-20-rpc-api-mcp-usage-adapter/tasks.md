# Tasks: rpc-api MCP Usage Adapter

Iteration 4 of the standalone-product loop. First concrete exercise
of the dashboard-BFF adapter pattern.

## §1 Discover the real upstream contract

Before writing code:

- [x] 1.1 Inspect `repos/metabob-cloud-dashboard/src/index.ts` to
      identify the existing user-vessel proxy route. Confirm how
      `api-keys` are currently fetched / revealed (or whether
      reveal is impossible after creation — see design.md
      Risks).
      → **Reveal is impossible.** `APIKeysPage.tsx` shows the raw
      key once via `NewKeyBanner` ("this is the only time it will
      be shown"); `useApiKeys()` thereafter returns only the
      `prefix`. user-vessel has no reveal endpoint.
- [x] 1.2 Curl against `https://ide.metabob.com/session`,
      `/session/stats`, `/metrics` using a test API key from
      identity-vessel canary (or grab one from
      `~/.metabob/config.json`). Record the actual JSON shapes
      in a comment at the top of the new BFF handler.
      → `POST /session { apiKey, project }` → `{ session: <opaque-bearer> }`.
      → `GET /session/stats` (Bearer session) → `{ session_id, org_id,
        project_id, session_uuid, total_files, total_stored_problems,
        latest_job_id, files_analyzed, problems_tracked_by_file }`.
      → `GET /metrics` (Bearer session) → 401 for anonymous keys.
      Shapes recorded in `src/index.ts` BFF handler comment.
- [x] 1.3 If user-vessel cannot reveal raw API keys after
      creation: switch to the design.md "Option 1" path — accept
      the raw key in the request body via `POST /api/mcp/usage`.
      Update spec R1 in this change to reflect the chosen
      method.
      → Spec R1 + R2 + R3 updated to lock `POST { raw_key,
      api_key_id? }`. Client stashes the raw key in sessionStorage
      at create time via `src/features/mcp/lib/rawKeyStash.ts`.
      R3 amended so `/metrics` failure is non-fatal (best-effort
      with `metrics_status` echoed in the response).

## §2 BFF route

- [x] 2.1 Add the `/api/mcp/usage` handler in
      `repos/metabob-cloud-dashboard/src/index.ts`, alongside
      existing proxy routes. Compose: user-vessel key resolve →
      rpc-api `/session` → parallel `/session/stats` + `/metrics`.
      → No user-vessel hop (raw key is in body); rpc-api session
      → parallel stats + metrics implemented.
- [x] 2.2 Return the composed JSON shape per proposal.md.
- [x] 2.3 On any upstream non-2xx: HTTP 502 with body
      `{ error: "rpc_api_unreachable", upstream_status: N }`.
      → Applied to `/session` and `/session/stats`; `/metrics`
      failures are best-effort per amended R3.
- [x] 2.4 On missing / invalid auth: HTTP 401.
- [x] 2.5 On missing `api_key_id` (or raw key, depending on §1.3
      outcome): HTTP 400.

## §3 React Query hook

- [x] 3.1 Create
      `repos/metabob-cloud-dashboard/src/features/mcp/hooks/useMcpUsage.ts`.
      Use the project's existing React Query setup (see
      `src/features/api-keys/hooks/useApiKeys.ts` for style).
- [x] 3.2 Hook signature: `useMcpUsage(apiKeyIdOrRawKey: string |
      null)` returning the composed shape. `enabled: !!input`. 30s
      `staleTime`. No retries.
      → Signature is `useMcpUsage({ rawKey, apiKeyId? } | null)`
      so the hook can carry both the raw key (required for the
      POST body) and the id (for cache keying / echo).

## §4 Usage tab UI

- [x] 4.1 Rename `src/features/mcp/UsagePlaceholderTab.tsx` to
      `UsageTab.tsx`. Update the import in `MCPSurfacePage.tsx`.
- [x] 4.2 Top of tab: an API-key selector. Reuse the existing
      `useApiKeys()` hook to populate options. When no key
      selected, render the placeholder copy + link to the API
      Keys page.
- [x] 4.3 When a key is selected: call `useMcpUsage(...)`. On
      success, render a small card grid: total calls, last seen,
      by-tool list (if available), raw JSON in `<details>`.
      → Cards: Files analyzed / Total files / Stored problems /
      Latest job (the stats actually surfaced by rpc-api). A
      by-tool breakdown isn't available from /session/stats; the
      `<details>` block exposes the full composed JSON for any
      ad-hoc fields.
- [x] 4.4 Loading state: skeletons or a spinner. Error state: a
      single card with the error message + upstream_status + a
      "Retry" button.

## §5 Mount sidebar

- [x] 5.1 In `repos/metabob-cloud-dashboard/src/Layout.tsx` (or
      wherever the top-level layout lives — confirm path), mount
      `<Sidebar />` next to the existing main content. Match the
      existing sidebar styles in `Sidebar.tsx`; do NOT redesign.
      → Path is `src/shared/components/Layout.tsx`. Mounted with
      existing `fixed top-14 lg:w-56` styles; added `lg:pl-60` to
      main content to avoid overlap on lg screens.
- [x] 5.2 Boot the dashboard and confirm the MCP nav entry is
      visible at `/`.
      → Verified via `curl http://localhost:3458/mcp` returns 200
      and bundle contains `/api/mcp/usage` + `metabob_raw_api_keys`.

## §6 Verification

- [x] 6.1 `bun run build` succeeds; type-clean.
      → Build OK in 231ms; 760KB JS / 73KB CSS.
- [x] 6.2 Boot dashboard locally. With no API key selected: Usage
      tab shows placeholder. With a (possibly canary) API key
      selected: hook fires; either success (cards render) or
      visible 502 error (cards replaced by error card). Capture
      a curl against the local BFF for evidence.
      → `POST /api/mcp/usage` with a real canary key returned the
      full composed shape (stats populated, metrics null, metrics_status:401);
      `POST` without auth → 401; with auth and empty body → 400.
- [x] 6.3 No regression in `/api-keys`, `/mcp` Tools tab, `/mcp`
      Install tab, login routes.
      → `/api-keys` and `/mcp` both return 200 via SPA fallback.

## §7 Commits & archive

- [x] 7.1 One commit inside cloud-dashboard on `dev`:
      `feat(cloud-dashboard): /api/mcp/usage BFF + live Usage tab
      + mount Sidebar`. Push.
- [x] 7.2 One commit in super-repo on `dev`:
      `docs(boundaries): rpc-api adapter spec + Usage tab live
      note`. Adjust the "MCP surface in dashboard" section of
      `docs/PRODUCT_BOUNDARIES.md` so the iteration-5 placeholder
      language becomes "live as of <date>". Push.
- [x] 7.3 Archive: move change dir to
      `openspec/changes/archive/2026-05-20-rpc-api-mcp-usage-adapter/`
      and lift the spec to
      `openspec/specs/rpc-api-mcp-usage-adapter/spec.md`.
