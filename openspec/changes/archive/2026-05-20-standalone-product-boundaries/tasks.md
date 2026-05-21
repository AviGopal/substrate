# Tasks: Standalone Product Boundaries

Iteration 1 of the standalone-product loop. Keep scope tight: doc + one
flag. Defer everything else.

## §1 Boundary documentation

- [x] 1.1 Create `docs/PRODUCT_BOUNDARIES.md` with the section skeleton
      from proposal.md §"What Changes" item 1.
- [x] 1.2 Fill the **Component matrix** section (dashboard / mcp /
      rpc-api). Include frozen-version note for rpc-api (0.16.13,
      `repos/deployment/helmfiles/legacy.yaml`).
- [x] 1.3 Fill the **Env-var matrix** for cloud-dashboard. Required:
      `VITE_IDENTITY_URL`, `VITE_USER_VESSEL_URL`. Optional:
      `ACTIVITY_API_URL` (gated by flag), `DISCOVERY_URL`,
      `VITE_RPC_API_URL`. Cross-reference every var with the line in
      `repos/metabob-cloud-dashboard/src/index.ts` that reads it.
- [x] 1.4 Fill the **Env-var matrix** for metabob-mcp. Required:
      `METABOB_API_KEY`, `ANALYSIS_API_URL` (=ide.metabob.com).
      Optional: `IDENTITY_ENDPOINT`, `ACTIVITY_API_URL`,
      `USE_CONNECTION_SLOTS`.
- [x] 1.5 Fill the **Auth flow** section — sequence of: login →
      JWT → key issuance → MCP `/session` exchange → opaque session
      → analysis call. Cite the rpc-api endpoints used at each step.
- [x] 1.6 Add **Adapter-layer principle** section: rpc-api is frozen;
      net-new analysis-surface lives in dashboard BFF or a new vessel.
- [x] 1.7 Link the new doc from super-repo `CLAUDE.md` (under
      "Architecture Documentation").

## §2 Dashboard coupling audit

Output lives in `docs/PRODUCT_BOUNDARIES.md` under a "Coupling Audit"
section, table form, one row per finding.

- [x] 2.1 Grep `repos/metabob-cloud-dashboard/` for: `activityApi`,
      `activity-api`, `/v2/activities`, `discovery-vessel`,
      `executionTrace`, `impulse`. Record file:line for every hit.
- [x] 2.2 For each hit, classify as REQUIRED / OPTIONAL (gated) /
      NEEDS-GATING. Expected NEEDS-GATING set: Execution Traces page,
      cost-summary impulse parsing in `features/billing/`, the
      `/api/v2/activities` proxy in `src/index.ts`.
- [x] 2.3 For each NEEDS-GATING entry, name the gate (env var, route
      conditional, or proxy-side 501) the iteration will add.

## §3 MCP coupling audit

- [x] 3.1 Grep `repos/metabob-mcp/` for: `ACTIVITY_API_URL`,
      `USE_CONNECTION_SLOTS`, `vessel-heartbeat`, `discovery`,
      `/v2/impulses`, `/v2/activities`. Record file:line.
- [x] 3.2 Confirm each hit is OPTIONAL (already gated) or upgrade its
      gate. Expected outcome: zero NEEDS-GATING entries (mcp is
      already standalone-clean).

## §4 Feature flag

- [x] 4.1 Add `VITE_ENABLE_ACTIVITY_VIEWS` to
      `repos/metabob-cloud-dashboard/.env.example` with default
      `false` and a comment pointing at PRODUCT_BOUNDARIES.md.
- [x] 4.2 Create a `useActivityViewsEnabled()` hook in
      `repos/metabob-cloud-dashboard/src/lib/feature-flags.ts` (new
      file). Returns `import.meta.env.VITE_ENABLE_ACTIVITY_VIEWS ===
      "true"`.
- [x] 4.3 Gate the Execution Traces route: in the route component
      (TanStack Router file under `src/routes/`), return a small
      "Activity views are disabled in this deployment" placeholder
      when the hook returns false. Do **not** delete the route.
- [x] 4.4 Gate the activity-api proxy in `src/index.ts`: if
      `process.env.VITE_ENABLE_ACTIVITY_VIEWS !== "true"`, return
      `501` with body `{ error: "activity_views_disabled", docs:
      "/docs/PRODUCT_BOUNDARIES.md" }` for any path matching
      `/api/v2/activities/*` or `/api/activity/*`.
- [x] 4.5 Hide nav entries (sidebar items, command-palette entries)
      for the gated views when the flag is off.

## §5 Standalone-mode verification

- [x] 5.1 Dashboard standalone boot: in
      `repos/metabob-cloud-dashboard/`, run `bun dev` with
      `VITE_ENABLE_ACTIVITY_VIEWS` unset and `ACTIVITY_API_URL` unset.
      Confirm: process starts, login page renders, no network calls
      to `activity.metabob.com` (network panel in browser /
      `bun --hot` log).
- [x] 5.2 MCP standalone boot: in `repos/metabob-mcp/`, run
      `bun start` with `ACTIVITY_API_URL` unset and
      `USE_CONNECTION_SLOTS` unset. Confirm `GET /resolve/health`
      returns 200 and that the activity bridge tool reports
      "disabled" rather than erroring.
- [x] 5.3 Update the super-repo memory with anything surprising the
      audit found (especially if a coupling assumed OPTIONAL turns
      out to be REQUIRED).

## §6 Archive prep

- [x] 6.1 Move the spec under
      `openspec/changes/2026-05-20-standalone-product-boundaries/specs/standalone-product-surface/`
      to `openspec/specs/standalone-product-surface/spec.md` on
      archive (handled by `opsx:archive`).
- [x] 6.2 Commit on `dev` (super-repo): one commit per logical group
      — boundaries doc, dashboard audit + flag, mcp audit. No
      `Co-Authored-By` trailer.
