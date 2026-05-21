# Capability: standalone-product-surface

The `metabob-cloud-dashboard` + `metabob-mcp` + frozen
`metabob-rpc-api` triple constitutes a **standalone product**: the
subset of metabob that ships to customers and runs independently of
the activity-impulse research stack (activity-api, discovery-vessel,
workbench, minibob).

This capability defines the contract that keeps the three components
shippable as a unit and prevents accidental coupling drift back into
the research stack.

## Requirements

### R1 — Standalone boot (dashboard)

`metabob-cloud-dashboard` SHALL boot to its login page and serve all
non-activity routes with **only** the following backends configured:

- `identity.metabob.com` (identity-vessel: auth + key issuance)
- `user-vessel` (orgs, users, projects, API keys, costs)
- `ide.metabob.com` (rpc-api 0.16.13: analysis only)

When `ACTIVITY_API_URL` and `DISCOVERY_URL` are unset, the dashboard
MUST NOT initiate any network request to `activity.metabob.com` or to
discovery-vessel during normal use.

### R2 — Standalone boot (mcp)

`metabob-mcp` SHALL boot, serve `GET /health = 200` on its optional
HTTP server (when `HEALTH_PORT` is set), and
expose its full set of analysis-oriented MCP tools with **only**:

- `METABOB_API_KEY` (the customer's API key)
- `ANALYSIS_API_URL` (= `ide.metabob.com`)

When `ACTIVITY_API_URL`, `USE_CONNECTION_SLOTS`, and discovery
configuration are unset, MCP MUST NOT initiate any request to
activity-api or discovery-vessel. The optional activity bridge tool
SHALL report a disabled state rather than erroring.

### R3 — Activity views gated

Any UI surface in `metabob-cloud-dashboard` that depends on
activity-impulse shapes (execution traces, impulse cost summaries,
Thompson-sampling metrics, learning-loop status) SHALL be gated by
the build-time flag `VITE_ENABLE_ACTIVITY_VIEWS`. When the flag is
not `"true"`:

- The route MUST render a placeholder explaining the view is disabled;
  it MUST NOT fetch activity-api.
- The corresponding nav entries (sidebar, command palette) MUST be
  hidden.
- The dashboard BFF proxy `/api/v2/activities/*` and `/api/activity/*`
  MUST return HTTP 501 with a JSON body
  `{ "error": "activity_views_disabled" }`.

### R4 — rpc-api is frozen

`metabob-rpc-api` is pinned to image `metabobapp/metabob-rpc-api:
0.16.13` (manifest `repos/deployment/helmfiles/legacy.yaml`).

- No proposal SHALL modify rpc-api source. The source repo is
  archived; only the Docker image exists. Any change that requires
  modifying rpc-api fails this requirement.
- New analysis-surface functionality SHALL be implemented in one of
  two adapter locations:
  1. The dashboard BFF (`repos/metabob-cloud-dashboard/src/index.ts`
     and adjacent server-side modules), composing existing rpc-api
     endpoints into higher-level shapes the UI consumes.
  2. A new small vessel that calls rpc-api as a client (used when
     persistence or cross-tenant aggregation is needed).

### R5 — Boundary documentation is authoritative

`docs/PRODUCT_BOUNDARIES.md` SHALL be the single source of truth for
the standalone product surface and SHALL contain, at minimum:

- Component matrix for dashboard, mcp, and rpc-api with the rpc-api
  frozen-version pin.
- Env-var matrix per component (required vs. optional, defaults).
- Auth flow from login → JWT → API key → `/session` exchange →
  analysis call.
- A "Coupling Audit" table enumerating every file:line in
  `repos/metabob-cloud-dashboard/` and `repos/metabob-mcp/` that
  imports or calls activity-api / discovery-vessel, with each entry
  classified REQUIRED / OPTIONAL (gated) / NEEDS-GATING.
- The adapter-layer principle stated in R4.

The doc SHALL be linked from super-repo `CLAUDE.md` under
"Architecture Documentation".

### R6 — Audit drift is detectable

When a new call to activity-api or discovery-vessel is introduced in
`repos/metabob-cloud-dashboard/` or `repos/metabob-mcp/`, the
Coupling Audit in `docs/PRODUCT_BOUNDARIES.md` SHALL be updated in
the same change. The audit table format SHALL be machine-greppable
(one row per file:line) so a future lint can compare a fresh grep
against the doc.

## Non-requirements

- This capability does NOT require activity views to be removed; they
  remain available in deployments where `VITE_ENABLE_ACTIVITY_VIEWS=
  "true"`.
- This capability does NOT specify the Playwright dev loop, the
  `/mcp` info surface, the team-lead E2E rubric, or the first
  adapter implementation. Those land in subsequent capabilities.
