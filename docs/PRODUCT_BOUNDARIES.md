# Product Boundaries

Source of truth for the **metabob standalone product surface**:
`metabob-cloud-dashboard` + `metabob-mcp` + frozen `metabob-rpc-api`.
Customers install MCP, log into the dashboard, manage API keys, and
run analysis against rpc-api **without touching the activity-impulse
research stack** (`activity-api`, `discovery-vessel`, `workbench`,
`minibob`).

This document is the boundary contract. Spec:
`openspec/specs/standalone-product-surface/spec.md` (after archive).

## Component matrix

| Component | Repo | Stack | Deployment | Frozen? |
|---|---|---|---|---|
| **cloud-dashboard** | `repos/metabob-cloud-dashboard/` | React 19 + Bun + TanStack Router + Tailwind + shadcn/ui | `bun --hot src/index.ts` (static server + BFF proxy in one process) | No — active |
| **metabob-mcp** | `repos/metabob-mcp/` | TypeScript + Bun + MCP SDK v1.0.4 + Hono + Tree-Sitter + ONNX | Customer-installed CLI (`dist/cli.js`); optional HTTP resolver on `HEALTH_PORT` (default 8080) | No — active |
| **metabob-rpc-api** | _not in repos/_ | Python + Flask | Image `metabobapp/metabob-rpc-api:0.16.13`, manifest `repos/deployment/helmfiles/legacy.yaml`, namespace `metabob-legacy`, served at `ide.metabob.com` | **YES — 0.16.13, source repo archived, image-only** |

## Env-var matrix

### cloud-dashboard (`repos/metabob-cloud-dashboard/`)

| Variable | Required? | Default | Purpose | Read at |
|---|---|---|---|---|
| `IDENTITY_URL` | required | `https://identity.metabob.com` | identity-vessel: auth, JWT, API key issuance | `src/index.ts` |
| `USER_VESSEL_URL` | required | `http://user-vessel:8080` | orgs, users, projects, API keys, costs | `src/index.ts` |
| `RPC_API_URL` (a.k.a. analysis URL) | required | `https://ide.metabob.com` | rpc-api: analysis submit/get | (proxy table in `src/index.ts`) |
| `VITE_ENABLE_ACTIVITY_VIEWS` | optional | `false` | enables activity-impulse views (execution traces, usage analytics) + the `/api/v2/activities` and `/api/activity` proxies | build-time (Vite) + runtime (proxy gate) |
| `ACTIVITY_API_URL` | optional (must be set when `VITE_ENABLE_ACTIVITY_VIEWS=true`) | `http://activity.metabob.local` | activity-api endpoint | `src/index.ts:6` |
| `DISCOVERY_URL` | not currently used | n/a | reserved for future discovery integration | n/a (zero hits) |

### metabob-mcp (`repos/metabob-mcp/`)

| Variable | Required? | Default | Purpose | Read at |
|---|---|---|---|---|
| `METABOB_API_KEY` | required | _none_ | customer API key for rpc-api | `src/index.ts:30+`, `src/auth-service.ts` |
| `ANALYSIS_API_URL` | required | `https://ide.metabob.com` | rpc-api endpoint | `src/index.ts:26` |
| `SESSION_ID` | optional | generated | persistent session id | `src/index.ts:28` |
| `LOG_LEVEL` | optional | `info` | logging | `src/index.ts:29` |
| `HEALTH_PORT` | optional | `8080` | optional vessel HTTP server | `src/index.ts:31`, `src/vessel-server.ts` |
| `IDENTITY_ENDPOINT` | optional | `https://identity.metabob.com` | identity-vessel for tenant resolution; failure is non-fatal | `src/auth-service.ts:22`, `src/index.ts:39` |
| `IDENTITY_API_KEY` | optional | _none_ | identity-vessel admin key (only when proxying identity calls) | `src/index.ts`, `src/auth-service.ts:166` |
| `ACTIVITY_API_URL` | optional | `https://activity.metabob.com` | activity-api endpoint; only used if `USE_CONNECTION_SLOTS=true` or the (currently unregistered) activity tool fires | `src/index.ts:27`, `src/config.ts:74` |
| `USE_CONNECTION_SLOTS` | optional | `false` | gates activity-api connection-slot acquisition (line `src/index.ts:321`) | `src/index.ts:36` |

### metabob-rpc-api (frozen)

Operational config is owned by the legacy deployment. From the
dashboard's perspective the contract is the set of endpoints below;
from the MCP's perspective it is identical (`src/api-client.ts`).

## Auth flow

```
┌─ user opens dashboard ────────────────────────────────────────────────────┐
│                                                                            │
│  Browser ──POST /v1/auth/login──► identity.metabob.com                    │
│         ◄────────── JWT (15 min) ──────────                                │
│                                                                            │
│  Browser ──POST /v1/keys/issue──► identity.metabob.com                    │
│         ◄────────── API key ────────────── (shown once, copy to clipboard) │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌─ customer installs MCP, sets METABOB_API_KEY ─────────────────────────────┐
│                                                                            │
│  MCP ──POST /session  { apiKey, project:"default" }──► ide.metabob.com    │
│      ◄─────────── { session: "<opaque>" } ────────────                     │
│                                                                            │
│  MCP ──POST /v2/submit  (files)──────────────────────► ide.metabob.com    │
│      Authorization: Bearer <session>                                       │
│      ◄─────────── { job_id } ─────────────                                 │
│                                                                            │
│  MCP ──GET /jobs/<job_id>/status──► ide.metabob.com                       │
│  MCP ──GET /analysis────────────► ide.metabob.com                         │
│                                                                            │
│  (Optional) MCP ──POST /v1/auth/resolve──► identity.metabob.com           │
│      tenant lookup; failure is non-fatal, MCP continues with key-only      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

rpc-api endpoints used by MCP (`src/api-client.ts`): `POST /session`,
`POST /v2/submit`, `GET /analysis`, `GET /jobs/<id>/status`,
`POST /feedback/detection`, `GET /health`, `GET /metrics`,
`GET /session/stats`, `GET /v2/impulses/learned`,
`POST /activity-recommendations/recommendations`,
`POST /v2/activities/record/start`,
`POST /v2/activities/record/complete`,
`POST /v2/analysis/learning/cochange`,
`POST /v2/analysis/learning/tool-usage`,
`POST /v2/analysis/learning/feedback`. **All endpoints above are in the
frozen 0.16.13 surface; new functionality MUST NOT extend rpc-api.**

## Standalone mode

A deployment runs in **standalone mode** when:

- `VITE_ENABLE_ACTIVITY_VIEWS` is unset (or `"false"`) in
  cloud-dashboard.
- `ACTIVITY_API_URL` is unset in mcp.
- `USE_CONNECTION_SLOTS` is unset (or `"false"`) in mcp.

Standalone-mode guarantees:

- Dashboard initiates no network request to `activity.metabob.com` or
  `discovery-vessel` during normal use.
- Dashboard's `/api/v2/activities/*` and `/api/activity/*` proxy
  endpoints return HTTP `501 { error: "activity_views_disabled" }`.
- Dashboard hides nav entries for activity-shaped routes (execution
  traces, usage analytics).
- MCP's optional activity tool reports a disabled state rather than
  erroring.
- MCP's optional HTTP server (when `HEALTH_PORT` is set) returns 200 on `GET /health`.

The opposite of standalone mode is **research mode**, in which the
flags above are true. Research-mode is the default in
`repos/deployment/` Helm values; standalone-mode is the default in
`.env.example` and customer-facing install docs.

## Adapter-layer principle

`metabob-rpc-api` is **frozen at 0.16.13**. The source repo is
archived; only the Docker image exists; the Helm chart pins the
image tag.

When the dashboard or MCP needs analysis-surface functionality that
rpc-api doesn't expose, that functionality MUST land in one of two
adapter locations — never as a patch to rpc-api:

1. **Dashboard BFF** (`repos/metabob-cloud-dashboard/src/index.ts`
   and adjacent server-side modules). Compose existing rpc-api
   endpoints into the higher-level shape the UI consumes. Example: a
   "tool usage summary" UI view could combine
   `GET /session/stats` + `GET /v2/impulses/learned` server-side and
   serve a single shape to the React client.
2. **A new small vessel** that calls rpc-api as a client. Use this
   when the composition needs persistence or cross-tenant aggregation
   (e.g., usage aggregation across orgs, alerting on budget
   thresholds).

The dashboard BFF is the default. Reach for a new vessel only when
the BFF cannot meet the requirement.

## Coupling audit

The "Coupling Audit" is a machine-greppable table — one row per
file:line for every reference in cloud-dashboard or metabob-mcp to
the activity-impulse research stack. Whenever a new such reference
is introduced, this table MUST be updated in the same change.

### Format

`file:line | <REQUIRED|OPTIONAL|NEEDS-GATING> | <matched_line_truncated> | <gate_or_dash>`

Classification:
- **REQUIRED** — load-bearing for non-activity functionality; cannot be gated without breaking the standalone product.
- **OPTIONAL (already gated)** — behind an env var or runtime check.
- **NEEDS-GATING** — currently runs unconditionally; gating added in iteration 2 of the standalone-product loop (this change).

### cloud-dashboard audit (2026-05-20)

```
src/index.ts:6 | OPTIONAL (already gated) | const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL || "http://activity.metabob.local"; | proxy-gate-501
src/index.ts:140 | NEEDS-GATING | if (pathname.startsWith("/api/v2/activities")) { | proxy-gate-501
src/index.ts:142 | NEEDS-GATING | const targetUrl = `${ACTIVITY_API_URL}${path}${url.search}`; | proxy-gate-501
src/index.ts:188 | OPTIONAL (already gated) | console.log(`   Activity API: ${ACTIVITY_API_URL}`); | -
src/lib/api/activity-api.ts:10 | OPTIONAL (already gated) | const BASE_URL = "/api/activity"; | proxy returns 501 in standalone mode
src/lib/api/activity-api.ts:39 | OPTIONAL (already gated) | const url = `${BASE_URL}/activities/execution-traces${queryString ? ...}`; | proxy returns 501 in standalone mode
src/lib/api/activity-api.ts:50 | OPTIONAL (already gated) | return get<ExecutionTrace>(`${BASE_URL}/activities/execution-traces/${id}`); | proxy returns 501 in standalone mode
src/lib/api/activity-api.ts:308 | OPTIONAL (already gated) | return post<ImpulseResolveResponse>(`${BASE_URL}/impulses/resolve`, { pointer }); | proxy returns 501 in standalone mode
src/lib/api/costs.ts:9 | OPTIONAL (already gated) | import { resolveImpulse, type ImpulsePointer } from "./activity-api"; | only called from usage-analytics route (gated)
src/lib/api/api-keys.ts:33 | NEEDS-GATING | const ACTIVITY_URL = "/api/activity"; | api-keys-usage-panel-gate
src/lib/api/api-keys.ts:135 | NEEDS-GATING | return get<ConnectionCountResponse>(`${ACTIVITY_URL}/connections/count?...`); | api-keys-usage-panel-gate
src/features/api-keys/hooks/useApiKeys.ts:40 | NEEDS-GATING | const response = await apiKeysApi.getApiKeyConnections(apiKeyId); | api-keys-usage-panel-gate
src/types/api.ts:25 | OPTIONAL (already gated) | // Activity stats (populated from activity-api) | type-only
src/types/api.ts:163 | OPTIONAL (already gated) | impulses?: string[]; | type-only
src/types/api.ts:211 | OPTIONAL (already gated) | impulses_used?: string[]; | type-only
src/types/api.ts:220 | OPTIONAL (already gated) | // Thompson Sampling recommendation | type-only
src/shared/types/websocket.ts:4 | OPTIONAL (already gated) | The cloud dashboard subscribes to real-time events broadcast by activity-api | type-only; ws connection itself gated by route
src/shared/types/websocket.ts:111 | OPTIONAL (already gated) | type: "impulse.resolved"; | type-only
src/features/execution-traces/hooks/useExecutionTraces.ts:6 | NEEDS-GATING | import * as activityApi from "@/lib/api/activity-api"; | execution-traces-route-gate
src/features/execution-traces/hooks/useExecutionTraces.ts:23 | NEEDS-GATING | const response = await activityApi.getExecutionTraces(query); | execution-traces-route-gate
src/features/execution-traces/hooks/useExecutionTraces.ts:60 | NEEDS-GATING | const response = await activityApi.getTemplates(); | execution-traces-route-gate
src/features/execution-traces/hooks/useExecutionTraces.ts:73 | NEEDS-GATING | const response = await activityApi.getTemplate(id); | execution-traces-route-gate
src/features/execution-traces/hooks/useExecutionTraces.ts:95 | NEEDS-GATING | const response = await activityApi.getMetricsSummary(); | execution-traces-route-gate
src/features/execution-traces/hooks/useExecutionTraces.ts:108 | NEEDS-GATING | const response = await activityApi.getQualityTrend(days); | execution-traces-route-gate
src/features/execution-traces/hooks/useExecutionTraces.ts:121 | NEEDS-GATING | const response = await activityApi.getTemplatePerformance(); | execution-traces-route-gate
src/features/execution-traces/ExecutionTracesPage.tsx:19 | NEEDS-GATING | import { getExecutionTraces, getExecutionTrace } from "@/lib/api/activity-api"; | execution-traces-route-gate
src/features/billing/UsageAnalyticsPage.tsx:21 | NEEDS-GATING | import { getMetricsSummary, getQualityTrend } from "@/lib/api/activity-api"; | usage-analytics-route-gate
src/features/billing/UsageAnalyticsPage.tsx:34 | NEEDS-GATING | import type { MetricsSummary } from "@/lib/api/activity-api"; | type-only-but-route-gated
src/routes/execution-traces.tsx:7 | NEEDS-GATING | import { ExecutionTraces } from "@/features/execution-traces/ExecutionTracesPage"; | execution-traces-route-gate
src/routes/execution-traces.tsx:11 | NEEDS-GATING | path: "/execution-traces", | execution-traces-route-gate
src/routes/usage-analytics.tsx:7 | NEEDS-GATING | import { UsageAnalytics } from "@/features/billing/UsageAnalyticsPage"; | usage-analytics-route-gate
src/routes/usage-analytics.tsx:11 | NEEDS-GATING | path: "/usage-analytics", | usage-analytics-route-gate
e2e/global-setup.ts:17 | OPTIONAL (already gated) | const activityApiUrl = process.env.ACTIVITY_API_URL || "http://localhost:8080"; | e2e-only
```

#### Required gates for cloud-dashboard

- `proxy-gate-501` — in `src/index.ts`, when the activity-views flag
  is off, the `/api/v2/activities/*` and `/api/activity/*` branches
  return `501 { error: "activity_views_disabled", docs:
  "/docs/PRODUCT_BOUNDARIES.md" }` instead of dialing
  `ACTIVITY_API_URL`. Applies to lines 140+ in `src/index.ts`.
- `execution-traces-route-gate` — the `/execution-traces` route
  renders a placeholder when the flag is off; the
  `useExecutionTraces*` hooks are not called. Nav entry hidden.
- `usage-analytics-route-gate` — same treatment for
  `/usage-analytics`.
- `api-keys-usage-panel-gate` — the per-row "Connections" /
  "Sessions" panel in the API Keys page is hidden when the flag is
  off; `useApiKeyConnections` is not called. The rest of the API Keys
  page (list, create, revoke) remains fully functional in standalone
  mode.

### metabob-mcp audit (2026-05-20)

```
src/auth-service.ts:22 | REQUIRED | const DEFAULT_IDENTITY_ENDPOINT = 'https://identity.metabob.com'; | -
src/auth-service.ts:56 | OPTIONAL (already gated) | const url = `${endpoint ?? process.env.IDENTITY_ENDPOINT ?? DEFAULT_IDENTITY_ENDPOINT}`; | if (apiKey) at src/auth-service.ts:54
src/cli.ts:82 | OPTIONAL (already gated) | ACTIVITY_API_URL  Activity API URL (fallback ~/.metabob/config.json) | help-text-only
src/config.ts:74 | OPTIONAL (already gated) | if (!env.ACTIVITY_API_URL && config.activityApiUrl) { | conditional set
src/index.ts:27 | OPTIONAL (already gated) | const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL || ...; | only consumed when USE_CONNECTION_SLOTS or activity tool fires
src/index.ts:36 | OPTIONAL (already gated) | const USE_CONNECTION_SLOTS = process.env.USE_CONNECTION_SLOTS === 'true'; | env-flag (default false)
src/index.ts:39 | OPTIONAL (already gated) | const IDENTITY_ENDPOINT = process.env.IDENTITY_ENDPOINT || ...; | only fires when authService.hasKey()
src/index.ts:270 | OPTIONAL (already gated) | log('info', `Resolving tenant with identity-vessel (${IDENTITY_ENDPOINT})...`); | if (authService.hasKey()) at line 269
src/index.ts:321 | OPTIONAL (already gated) | if (USE_CONNECTION_SLOTS) { | env-flag (default false)
src/tools/activity.ts:* | OPTIONAL (already gated) | unregistered tool — not in TOOL_REGISTRY (`src/tools/index.ts`) | dead-on-arrival
src/vessel-heartbeat.ts:* | OPTIONAL (already gated) | dead code — class defined but never instantiated | dead-on-arrival
src/vessel-server.ts:131 | OPTIONAL (already gated) | app.post('/v2/impulses/resolve', async (c) => { | served only when HEALTH_PORT is set; returns 401 without auth header
.minibob/vessel.json:16 | OPTIONAL (already gated) | "endpoint": "/v2/impulses/resolve" | manifest-only; not loaded by mcp
tests/unit/config.test.ts:80 | OPTIONAL (already gated) | expect(env.ACTIVITY_API_URL).toBe('https://activity.metabob.com'); | test-only
```

#### Required gates for metabob-mcp

None. MCP is already standalone-clean; all activity-impulse references
are either OPTIONAL or REQUIRED-for-identity-vessel (which is itself
optional via `if (authService.hasKey())`). Observations worth
noting for future cleanup (not blocking standalone):

- `src/tools/activity.ts` is implemented but **not registered** in
  `src/tools/index.ts`. The `.minibob/vessel.json` manifest lists it,
  but MCP doesn't load it.
- `src/vessel-heartbeat.ts` defines a `VesselHeartbeat` class that is
  never instantiated.

Both can be removed in a later sweep; they don't affect standalone
mode today.

## Iteration sequencing

This doc and the `VITE_ENABLE_ACTIVITY_VIEWS` flag landed in **iteration
1** of the standalone-product loop
(`openspec/changes/2026-05-20-standalone-product-boundaries/`). Future
iterations land in their own changes:

- **Iteration 2** — Playwright-MCP dev loop: wire the dashboard's
  existing Playwright suite to MiniBob so specs run on a loop and
  surface results.
- **Iteration 3** — MCP info surface in the dashboard (`/mcp` route):
  tool catalog + per-key usage. First adapter — implementation
  candidate for the BFF principle (R4) above.
- **Iteration 4** — Team-lead E2E rubric: onboard, observe-agent,
  observe-mcp-usage, manage-team, budget-check, cross-project-view.
- **Iteration 5** — rpc-api adapter layer: name the first vessel-vs-BFF
  decision driven by an actual UI need.
