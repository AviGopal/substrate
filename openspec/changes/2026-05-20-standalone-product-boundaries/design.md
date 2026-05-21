# Design: Standalone Product Boundaries

## Scope

This is a documentation + single-flag change. Design notes here are
limited to (a) where the boundary lines fall, (b) why the flag lives on
the dashboard (not the proxy), and (c) the audit methodology so the
follow-up iterations have a stable starting point.

## Component map

```
                                           ┌─────────────────────────────┐
       Browser (customer)                   │ identity.metabob.com         │
            │                               │  - /v1/auth/login (JWT)      │
            │ (1) JWT cookie                │  - /v1/keys/issue            │
            ▼                               │  - /v1/auth/resolve          │
  ┌──────────────────────┐                  └─────────────────────────────┘
  │ cloud-dashboard      │ ─── identity ───►              ▲
  │  React 19 + Bun      │                                │
  │  src/index.ts proxy  │ ─── user-vessel ──────────────►│
  │                      │                                │
  │  Activity views are  │                                │
  │  gated by            │                                │
  │  VITE_ENABLE_         │ ── (optional, gated) ─────►   │
  │  ACTIVITY_VIEWS       │     activity.metabob.com       │
  └──────────┬───────────┘                                │
             │                                            │
             │ (2) Issued API key                         │
             ▼                                            │
  ┌──────────────────────┐                                │
  │ metabob-mcp (client) │ ── identity (auth resolve) ───►│
  │  Bun + MCP SDK       │                                │
  │  10 tools            │                                │
  │  src/auth-service.ts │ ── API key + /session ────────►┌─────────────────────────────┐
  │                      │                                │ ide.metabob.com (rpc-api)    │
  │  Activity bridge is  │ ─ (optional) ─►                │  FROZEN 0.16.13              │
  │  optional via env    │  activity.metabob.com          │  Python/Flask                │
  └──────────────────────┘                                │  Analysis only               │
                                                          └─────────────────────────────┘
```

## Why the flag lives on the dashboard binary, not the proxy

`src/index.ts` of the dashboard is **both the static server and the BFF
proxy**. We could gate at the proxy layer alone — return `501` from
`/api/v2/activities/*` when the flag is unset — but that still ships the
Execution Traces React route in the bundle and shows a broken UI to the
operator. Gating at both layers gives us:

- **Bundle-time**: the route is registered conditionally via the
  TanStack Router file router; we use a feature-flag wrapper that
  returns `null` (404) when `import.meta.env.VITE_ENABLE_ACTIVITY_VIEWS
  !== "true"`. This keeps the lazy chunk reachable for activity-aware
  deployments without forcing it on standalone customers.
- **Runtime proxy**: `/api/v2/activities/*` returns `501 Not
  Implemented` with a body explaining the flag, instead of attempting
  to dial a possibly-unset `ACTIVITY_API_URL`. This prevents accidental
  500s when someone hits the URL directly (e.g., a stale bookmark).

Both gates read the same env var. Vite resolves `VITE_*` at build time
for client code and Bun reads it at request time for the proxy; this
is exactly how the existing `VITE_*` vars work in the repo.

## Audit methodology

The "coupling-to-activity-impulse" audit task (T2 / T3) MUST produce a
concrete enumeration. Acceptable evidence per finding:

- Grep hit: file path + line number + 5-line context.
- Verdict: REQUIRED / OPTIONAL (already gated) / NEEDS-GATING.
- For NEEDS-GATING: name the gate (env var or runtime check) that the
  follow-up iteration will add.

The audit lives in `docs/PRODUCT_BOUNDARIES.md` under a "Coupling
Audit" section, not as a separate file. This keeps drift-detection
trivial: when someone adds a new activity-api call, the doc fails
review if it isn't added there.

For dashboard, primary grep targets:
- `activityApi`, `activity-api`, `/v2/activities`, `discovery-vessel`,
  `executionTrace`, `impulse`, `Thompson`, `vessel`.
- `repos/metabob-cloud-dashboard/src/index.ts` (proxy table).
- `repos/metabob-cloud-dashboard/src/features/execution-traces/`,
  `repos/metabob-cloud-dashboard/src/features/billing/` (cost
  summaries parse impulse shapes).

For mcp:
- `ACTIVITY_API_URL`, `USE_CONNECTION_SLOTS`, `vessel-heartbeat`,
  `discovery`.
- `repos/metabob-mcp/src/index.ts`, `src/auth-service.ts`,
  `src/vessel-server.ts`, `src/tools/activity.ts`.

## rpc-api as frozen substrate

The doc captures the operational contract: rpc-api 0.16.13 is the
**only** running version, the source repo is archived, and the Helm
manifest at `repos/deployment/helmfiles/legacy.yaml` pins the image
tag. Anything that looks like "we should add a new endpoint to
rpc-api" gets redirected to one of:

1. **Dashboard BFF**: extend `src/index.ts` with a new proxy route
   that composes rpc-api's existing endpoints (session exchange + GETs)
   into the higher-level shape the UI wants.
2. **New small vessel**: when the composition needs persistence or
   shared state across users (e.g., usage aggregation across orgs), it
   becomes a new vessel that reads from rpc-api as a client.

This change *names* the principle. The first adapter implementation
lands in a later iteration when the MCP usage-surface view needs it.

## Risks and mitigations

- **Risk**: We gate the activity views and a downstream operator who
  was using them silently loses the page. **Mitigation**: default the
  flag to `true` in `repos/deployment/` Helm values for any environment
  that already advertises an `ACTIVITY_API_URL`; default `false` only
  in the standalone install path. The flag's default in
  `.env.example` is `false` because `.env.example` documents the
  *standalone* product.
- **Risk**: Audit churn — every future activity-api call has to be
  added to the doc. **Mitigation**: keep the audit table machine-
  greppable (one row per file:line) so a CI lint can compare it
  against a fresh grep in a later iteration if drift becomes a
  problem.

## Out of scope

- The Playwright loop. The dashboard already has Playwright configured;
  wiring it to MiniBob is iteration 2.
- The `/mcp` route. Iteration 3.
- The team-lead rubric. Iteration 4.
- The first adapter implementation. Iteration 5.
