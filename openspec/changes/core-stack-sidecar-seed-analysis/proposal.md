## Why

The core product stack (`metabob-mcp`, `metabob-analysis-api`, `metabob-cloud-dashboard`) is currently incoherent: the MCP is a thin per-call dispatcher to a frozen Python backend (`metabob-rpc-api` at `ide.metabob.com`) and fires lossy fire-and-forget telemetry; the analysis-api is a stub that selects from existing rows rather than analysing anything; the dashboard shows lifetime call totals with no time axis, no detection drill-down, and a broken usage tab. The team-lead user stories that anchor the product — provision keys, watch detection trends over time, drill into what the agent did during a session, estimate risk on upcoming changes — cannot be served by the data the system currently captures.

This change re-anchors the three repos around a single architectural pattern: **the MCP is a non-LLM sidecar that maintains a continuously fresh local model of the codebase; the analysis-api owns all LLM cost and produces seed detections only (classify + locate); the agent's own LLM does deep reasoning and posts annotations back through MCP write tools.** Result: a clean cost model (~$5/hr/key, soft cap), a stateless never-block read contract for agents, and a coherent dataset for the dashboard.

## What Changes

- `metabob-mcp` becomes a long-running sidecar process:
  - Watches the working tree and git events; maintains an always-on CPG + embeddings + co-change predictions locally.
  - Contains **no LLM client**. Bundles context (changed code, CPG neighbours, embedding neighbours, commit history) and sends bundles to `analysis-api` over a new request/response protocol.
  - Maintains a priority queue (reactive > event-driven > proactive) and a budget-aware pacer.
  - Tool calls from the agent return cached results immediately with freshness metadata; **never blocks**, even on cold start (returns `warming: true` with whatever partial signal is available).
  - Tracks which cached results the agent actually reads and feeds that signal back to analysis-api so future scheduling can deprioritise unread work.

- `metabob-analysis-api` becomes the LLM runner:
  - New endpoint `POST /v2/analysis/run` accepts a context bundle + tier hint, returns a structured seed detection (or batch).
  - **Seeds only**: `{ file, line_start, line_end, category, severity, brief, confidence, refs }`. `category` comes from a fixed controlled vocabulary (race-condition, runtime-error, alignment, type-confusion, null-deref, resource-leak, perf, security, style, other). The LLM does not produce free-text categories.
  - Two-tier model dispatch: Haiku 4.5 default; Sonnet 4.6 escalation when triage confidence is below threshold.
  - Per-api-key rolling-hour budget tracker. Soft cap at $5/hr/key; tells sidecar to back off (`Retry-After`-style hint) at 80%, refuses non-reactive calls at 100%.
  - Stores seed events + agent annotations + resolution events for dashboard reads.
  - Drops aspiration of holding source code or running an internal LLM agent server-side. Code never leaves the developer's machine; only embeddings + structured event metadata + the brief seed text.

- `metabob-cloud-dashboard`:
  - Adds `/sessions` route with per-session three-act timeline (seed → agent annotations → resolution).
  - Adds spend-visibility surfaces per key: hourly burn rate, budget remaining, reads-per-dollar efficiency.
  - Adds detection-trend sparklines on key cards (calls, detections, problems-introduced vs resolved over time).
  - Fixes the existing revoke bug (silent API failure leaving revoked keys in the list).
  - Removes the broken/empty Usage tab error state by binding it to the new event-driven aggregates.

- **BREAKING** for legacy MCP versions: the MCP wire protocol against analysis-api is new. Older `metabob-mcp` versions continue to talk to the frozen `metabob-rpc-api` until rpc-api is sunset (separate phase D, not part of this change's immediate scope).

- The agent-facing MCP tool surface (`init_workspace`, `get_problems`, `analyze_impact`, `predict_cochanges`, `assign_git_changes`, `get_analysis_context`, `annotate_component`, `mark_complete`, `search_codebase`, `get_metrics`) keeps its signatures. Reads become cache reads; writes (`annotate_component`, `mark_complete`) post structured events to analysis-api.

## Capabilities

### New Capabilities
- `mcp-sidecar-lifecycle`: the long-running sidecar process model — file + git watchers, local CPG + embeddings + co-change engines, local SQLite + vector cache, never-block read contract returning cached results + freshness markers + warming flag.
- `mcp-scheduler-pacer`: priority queue, context bundler, budget-aware send loop, token estimator, read-feedback tracking. Owns the contract for what gets sent to analysis-api and when.
- `analysis-seed-detection`: the `POST /v2/analysis/run` endpoint, the seed schema, the controlled-vocabulary category set, Haiku-default + Sonnet-escalation tier dispatch.
- `analysis-budget-tracker`: per-api-key rolling-hour spend tracking, soft-cap enforcement at 80% / 100% / 120%, backoff hints back to the sidecar, reads-per-dollar efficiency metric.
- `dashboard-session-timeline`: `/sessions` route, session list, three-act drill-down (seed events + agent annotations + resolution events) keyed by `session_id` + `api_key_id`.
- `dashboard-spend-visibility`: per-key hourly burn rate, budget headroom, reads-per-dollar efficiency, soft-cap warning banner.

### Modified Capabilities
- `mcp-usage-telemetry`: the event shape changes from snapshot aggregates to a time-stamped event stream including `session_id`, `file`, detection counts produced/resolved per tool call, and a `read_at` echo when the agent later consumes a cached result. The existing `by_tool` aggregate becomes a server-side rollup of the new event stream rather than the wire shape.
- `mcp-outcome-events`: the annotation write path (`annotate_component`, `mark_complete`) gets a light structured contract — `{ type: 'explain'|'recommend'|'note'|'resolution', body, problem_id?, refs? }` — so the dashboard timeline renders consistently. `body` remains free text owned by the agent.

## Impact

**Code:**
- `repos/metabob-mcp/`: heavy work — adds watchers, local store, scheduler, context bundler, removes per-call backend dispatch in favour of cache reads.
- `repos/metabob-analysis-api/`: replaces stubbed impulse resolver with a real analysis pipeline (LLM dispatch, budget tracking, event storage, dashboard reads).
- `repos/metabob-cloud-dashboard/`: new routes, new visualisations, fixed revoke bug.
- `repos/metabob-rpc-api/`: no immediate change. Sunset plan deferred to a separate change once analysis-api reaches parity.

**APIs:**
- New: `POST /v2/analysis/run`, `GET /v2/dashboard/sessions`, `GET /v2/dashboard/sessions/:id`, `GET /v2/dashboard/spend`, `GET /v2/dashboard/usage-series` (all on analysis-api).
- New: `POST /v2/events/mcp` (analysis-api, replaces user-vessel's `/v2/mcp/usage` for new MCP versions).
- Modified: MCP tool result shape gains `freshness`, `warming`, `coverage` fields.

**Dependencies:**
- Sidecar: bundle ONNX runtime + `all-MiniLM-L6-v2` (already proven in activity-api), SQLite + sqlite-vss, existing cpg-inference-ts GCN.
- Analysis-api: Anthropic SDK (server-side metabob key, not customer-provided).

**Out of scope (separate changes):**
- Sunsetting `metabob-rpc-api` (the legacy MCP traffic path).
- Federation, OAuth, multi-org switching.
- The `impulse-activity` research stack — explicitly logically separate from the core stack per the current direction.
