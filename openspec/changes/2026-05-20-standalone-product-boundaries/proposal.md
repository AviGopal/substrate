# Proposal: Standalone Product Boundaries

## Why

`metabob-cloud-dashboard`, `metabob-mcp`, and the frozen `metabob-rpc-api`
(image `metabobapp/metabob-rpc-api:0.16.13`, deployed at `ide.metabob.com`,
manifest `repos/deployment/helmfiles/legacy.yaml`) together form a
**shippable standalone product**: a customer can install the MCP client,
log into the dashboard, manage API keys, and run analysis against rpc-api
without ever touching the activity-impulse research stack.

That product surface is not currently legible. Investigation in this
iteration (super-repo, 2026-05-20) found:

- Dashboard `repos/metabob-cloud-dashboard/src/index.ts` proxies to
  identity-vessel, user-vessel, **and activity-api**. The
  `/api/v2/activities` proxy is unconditional; the Execution Traces page
  hard-depends on activity-api shapes. There is no way to run the
  dashboard "standalone" today.
- MCP `repos/metabob-mcp/src/index.ts` already runs in a near-standalone
  mode: `ACTIVITY_API_URL` and `USE_CONNECTION_SLOTS` are optional env
  flags. But the boundary is undocumented and easy to regress.
- rpc-api owns analysis results only; **it does not own identity, orgs,
  or projects**. Those belong to identity-vessel + user-vessel. This
  separation is load-bearing for the standalone product but is not
  written down anywhere.
- rpc-api is **frozen at 0.16.13** (Python/Flask, archived repo, image
  only). Any new analysis-surface functionality must live in an
  adapter layer in the dashboard's BFF or in a new small vessel — never
  as a patch to rpc-api.

Without an explicit boundary doc + a feature gate on activity-shaped
views, the standalone-product story remains a property of how the
binaries happen to be built today rather than a guarantee.

## What Changes

This change is **documentation + a single feature flag**. It does not
modify rpc-api, does not build the MCP info surface, does not write the
E2E rubric, and does not build the adapter layer. Those land in
subsequent iterations.

1. **New doc**: `docs/PRODUCT_BOUNDARIES.md` — the source of truth for
   the standalone product surface. Contents:
   - Component matrix (dashboard / mcp / rpc-api) with frozen-version
     notes for rpc-api.
   - Env-var matrix per component: required vs. optional, default
     values, what each var connects to.
   - Auth flow: user → dashboard (identity-vessel JWT) → API key
     issuance → MCP client uses API key → rpc-api `/session` exchange
     → opaque session for analysis calls.
   - Coupling-to-activity-impulse audit: every place in cloud-dashboard
     and metabob-mcp that imports from / calls activity-api or
     discovery-vessel, tagged REQUIRED / OPTIONAL (already gated) /
     NEEDS-GATING.
   - "Standalone mode" definition: which env vars must be set/unset so
     the components run without activity-api or discovery-vessel.
   - Adapter-layer principle: rpc-api is frozen; new functionality
     lives in dashboard BFF or a new small vessel.

2. **New capability spec**: `standalone-product-surface` (delta added in
   this change). Documents the contract:
   - Dashboard MUST boot with only identity-vessel + user-vessel +
     rpc-api configured.
   - MCP MUST boot with only rpc-api + identity-vessel configured.
   - Activity-impulse-shaped views in dashboard MUST be feature-flagged.
   - rpc-api MUST NOT be modified.

3. **Single code change**: introduce `VITE_ENABLE_ACTIVITY_VIEWS` (env
   flag, default `false`) in cloud-dashboard. Execution-traces route
   and any other activity-shaped UI (deferred enumeration to the audit
   task) are gated behind this flag. The `/api/v2/activities` proxy in
   `src/index.ts` returns `501 Not Implemented` when the flag is off,
   instead of attempting to reach activity-api.

4. **Verification**: prove `bun dev` in `repos/metabob-cloud-dashboard`
   boots cleanly with `VITE_ENABLE_ACTIVITY_VIEWS=false` and
   `ACTIVITY_API_URL` unset; prove `bun start` in `repos/metabob-mcp`
   boots cleanly with `ACTIVITY_API_URL` unset.

## Non-Goals

- Building the Playwright dev loop. Deferred.
- Building the `/mcp` info surface in the dashboard. Deferred.
- Writing the team-lead E2E rubric. Deferred.
- Implementing the rpc-api adapter layer. Deferred — this change only
  *names* the principle.
- Touching rpc-api in any way.
- Removing the `/api/v2/activities` proxy entirely; it stays available
  when the flag is on.

## Success Criteria

- `docs/PRODUCT_BOUNDARIES.md` exists, is linked from super-repo
  `CLAUDE.md`, and enumerates every coupling point in dashboard + mcp.
- `VITE_ENABLE_ACTIVITY_VIEWS=false` is the default in
  `repos/metabob-cloud-dashboard/.env.example`.
- Dashboard `bun dev` boots and reaches the login page in standalone
  mode with no requests to activity-api / discovery-vessel.
- MCP `bun start` boots and serves `GET /resolve/health` in standalone
  mode (i.e. with `ACTIVITY_API_URL` and discovery env vars unset).
- The capability spec under `openspec/specs/standalone-product-surface/`
  exists after archive.
