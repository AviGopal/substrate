## 1. Phase A — sidecar shell in metabob-mcp

- [ ] 1.1 Decide and document runtime model: same-process MCP stdio + sidecar workers vs. separate sidecar process spawned by MCP launcher. Land the decision in `repos/metabob-mcp/docs/SIDECAR.md`.
- [ ] 1.2 Add `METABOB_STATELESS` env-var switch; current per-call behaviour becomes the `stateless` mode fallback. Default to `sidecar`.
- [ ] 1.3 Add SQLite dependency (`bun:sqlite`) and the schema migration scaffold for the local store (`files`, `chunks`, `chunks_vss`, `seeds`, `annotations`, `schedule_queue`).
- [ ] 1.4 Bundle `sqlite-vss` for the vector index; verify the build pipeline produces a single distributable.
- [ ] 1.5 Bundle the existing `all-MiniLM-L6-v2` ONNX model (already used in activity-api) inside the MCP package; expose a `bun:onnxruntime`-backed embedder.
- [ ] 1.6 Implement filesystem watcher (e.g., `chokidar` or native `fs.watch`) scoped to the resolved workspace root; debounce 500ms.
- [ ] 1.7 Implement git event listener (poll `.git/HEAD` + working tree at 5s cadence; or hook into `.git/hooks/post-commit` if present).
- [ ] 1.8 Promote the existing CPG builder from on-demand to always-on incremental; persist CPG state to local store.
- [ ] 1.9 Wire the existing GCN co-change predictor to the local store; predictions cached per (file_set, content_hashes) tuple.
- [ ] 1.10 Define the local result cache API (read by tool handlers, write by scheduler callback): `getCachedSeeds(file)`, `getFreshness(file)`, `cacheSeeds(seeds)`, `markStale(files)`.
- [ ] 1.11 Refactor every MCP read tool (`get_problems`, `analyze_impact`, `predict_cochanges`, `assign_git_changes`, `get_analysis_context`, `search_codebase`, `get_metrics`) to be cache-only with `{ results, freshness, warming, coverage }` shape. No outbound HTTP at read time.
- [ ] 1.12 Implement the workspace identifier function: SHA-256 of `(resolved_root, first_commit_hash)` with documented fallback for non-git workspaces.
- [ ] 1.13 Generate `session_id` at sidecar startup; thread it through every event post.
- [ ] 1.14 Implement graceful shutdown handler: SIGTERM + idle-timeout, flush event buffer, close SQLite.
- [ ] 1.15 Anonymous-mode handling: if `METABOB_API_KEY` is unset, skip all outbound posts but still run local engines.

## 2. Phase A — scheduler/pacer in metabob-mcp

- [ ] 2.1 Implement the three-tier priority queue (P0/P1/P2) backed by `schedule_queue` table + in-memory work list.
- [ ] 2.2 Implement enqueue triggers: P0 from cache-miss reads, P1 from filesystem/git events, P2 from idle scans and TTL expirations.
- [ ] 2.3 Implement the context bundler: extracts excerpt (max 60 lines), CPG neighbours, embedding neighbours, recent commits. Skips gitignored files.
- [ ] 2.4 Implement the token estimator using a simple chars/4 heuristic plus a model-specific calibration table.
- [ ] 2.5 Implement payload compression: when over per-tier token limit, trim neighbour refs, shrink excerpt window; if not achievable, drop with `bundle_dropped_size` log.
- [ ] 2.6 Implement send loop: dequeue by priority, POST to `analysis-api`, persist response in local store, update freshness.
- [ ] 2.7 Implement backoff hint handling: pause queues by tier on `reduce-proactive`/`reduce-event`/`reactive-only`.
- [ ] 2.8 Implement 429 handling: pause sends for the affected api_key until `Retry-After` elapses.
- [ ] 2.9 Implement read-feedback tracking: stamp `read_at` on seeds when surfaced; include `seed_reads` records in next event batch.
- [ ] 2.10 Implement priority demotion: file with `read_rate < 0.1` over last 5 seeds gets P2 instead of P1.
- [ ] 2.11 Implement P2 idle-time guard: only sent when P0/P1 empty AND budget headroom > 50%; 10% minimum-slice rule.
- [ ] 2.12 Unit-test the scheduler against synthetic workloads (cold start, edit burst, budget over-cap).

## 3. Phase B — seed-detection endpoint in metabob-analysis-api

- [ ] 3.1 Drop the existing `/v2/impulses/resolve` stub for `problem_detection` (or keep gated behind a feature flag during transition). Replace with the new analysis flow.
- [ ] 3.2 Add Anthropic SDK dependency (server-side metabob key, NOT customer-provided).
- [ ] 3.3 Implement `POST /v2/analysis/run` route with input validation per design.md D12 schema.
- [ ] 3.4 Implement Haiku 4.5 dispatch path: prompt template, schema-constrained output via tool-use, JSON validation.
- [ ] 3.5 Implement seed schema validator: enforce controlled vocabulary categories, line range sanity, brief length ≤ 240 with no fix-language patterns.
- [ ] 3.6 Implement Sonnet 4.6 escalation path: triggered when Haiku produced any seed with `confidence < 0.6` AND input tokens ≤ 10000; cost accounting combines both tiers.
- [ ] 3.7 Implement `tier_hint` short-circuit: honour explicit `haiku` / `sonnet` requests, bypass auto-escalation.
- [ ] 3.8 Implement request_id dedup: cache responses for the last N request_ids per api_key; return cached response with `cost_usd: 0` on duplicate.
- [ ] 3.9 Implement seed persistence to a new `mcp_seeds` table with PERMISSIONS scoped by `$token.org_id`. Fields per design.md D11.
- [ ] 3.10 Add migration: create `mcp_seeds` table.

## 4. Phase B — budget tracker in metabob-analysis-api

- [ ] 4.1 Implement the rolling-hour spend tracker. Storage: Redis sorted set keyed by api_key_id, members are `(ts, cost_usd)` pairs.
- [ ] 4.2 Implement the budget read function: `spent_60m_usd(api_key_id)` sums entries with `ts > now - 3600s`.
- [ ] 4.3 Implement `cap_60m_usd` lookup: default 5.00, configurable per-key via a `mcp_key_budget` table.
- [ ] 4.4 Implement backoff hint computation per design.md D5 (`headroom_pct` → hint).
- [ ] 4.5 Wire backoff hints into every `/v2/analysis/run` response body.
- [ ] 4.6 Implement 429 refusal: when `headroom_pct ≤ -0.2` AND incoming `priority > 0`, refuse with `Retry-After` calculated from oldest entry rolloff.
- [ ] 4.7 Implement `reads_per_dollar` aggregate: ingest `seed_read` events, maintain rollup table.
- [ ] 4.8 Add migration: create `mcp_key_budget` and the aggregate rollup tables.

## 5. Phase B — event ingestion in metabob-analysis-api

- [ ] 5.1 Implement `POST /v2/events/mcp` route accepting batched event payload.
- [ ] 5.2 Validate each event against its kind-specific schema (`tool_call`, `seed_read`, `annotation`, `resolution`).
- [ ] 5.3 Persist events to a new `mcp_events` table with PERMISSIONS scoped by `$token.org_id`.
- [ ] 5.4 Add migration: create `mcp_events` table.
- [ ] 5.5 Wire `seed_read` events to update the corresponding `mcp_seeds.read_at` and increment per-key aggregates.
- [ ] 5.6 Implement session ending logic: on `session_idle_timeout` (default 30 min from last event), close session and set `ended_at`.
- [ ] 5.7 Implement annotation body truncation enforcement (server-side ≤ 2000 chars with `…[truncated]` indicator).

## 6. Phase B — dashboard read endpoints in metabob-analysis-api

- [ ] 6.1 Implement `GET /v2/dashboard/sessions` with filters (`api_key_id`, `from`, `to`, `workspace_id`).
- [ ] 6.2 Implement `GET /v2/dashboard/sessions/:session_id` returning meta + chronological event timeline.
- [ ] 6.3 Implement `GET /v2/dashboard/spend` with hourly/daily bucketing and model breakdown.
- [ ] 6.4 Implement `GET /v2/dashboard/usage-series` with by-category aggregation.
- [ ] 6.5 Implement `GET /v2/dashboard/usage-snapshot` returning the legacy snapshot shape from the event stream (compatibility for the existing dashboard Usage tab during transition).
- [ ] 6.6 Add SurrealDB views or materialised projections needed for performant aggregation reads.

## 7. Phase C — dashboard surfaces in metabob-cloud-dashboard

- [ ] 7.1 Investigate and fix the existing revoke bug: confirm whether DELETE `/api/v2/api-keys/:id` actually fires, whether user-vessel processes it, where the silent failure lives. Land the fix.
- [ ] 7.2 Add the BFF proxy route `/api/dashboard/*` → `metabob-analysis-api` `/v2/dashboard/*`, forwarding the JWT.
- [ ] 7.3 Switch the existing `/api/mcp/usage` reads to use the new `usage-snapshot` endpoint via the BFF.
- [ ] 7.4 Build the `/sessions` route: table view sorted by `started_at` desc, filterable by `api_key_id`.
- [ ] 7.5 Build the `/sessions/:session_id` drill-down: three-act timeline rendering seeds → annotations → resolutions with type-specific iconography.
- [ ] 7.6 Implement near-real-time polling for active sessions (5s interval when `ended_at` is null; stop when set).
- [ ] 7.7 Add per-key spend badges on `/api-keys` cards (burn percentage + sparkline over 7 days).
- [ ] 7.8 Add the soft-cap warning banner with link to drill-down when any visible key is over 80%.
- [ ] 7.9 Build the per-key spend drill-down view (`/api-keys/:id/spend` or equivalent): 24h hourly chart, totals panel, `reads_per_dollar` as primary metric, Haiku vs Sonnet split.
- [ ] 7.10 Update the existing MCP Usage tab to render the aggregated snapshot + event feed (kill the `unknown_error` state).
- [ ] 7.11 Remove or hide stub routes (`/members`, `/settings`, `/execution-traces`, `/usage-analytics`) that are out of scope for this change; document the decision.

## 8. Cross-cutting tests

- [ ] 8.1 Update `e2e/rubric/03-observe-mcp-usage.spec.ts` to drive the new event path: spawn a sidecar invocation, post a tool_call + annotation, assert the dashboard renders both the snapshot and the timeline.
- [ ] 8.2 Add a new Playwright spec covering the session drill-down: navigate to `/sessions`, click a session, verify the three-act timeline renders with at least one seed, annotation, and resolution.
- [ ] 8.3 Add a spec covering spend visibility: render `/api-keys`, assert the burn badge for a key with known spend; verify the sparkline renders.
- [ ] 8.4 Add a spec covering soft-cap banner: simulate a key above 80% (test fixture), verify the warning appears with link.
- [ ] 8.5 Add a spec covering revoke: create a key, revoke it, reload, assert it is removed (regression test for the bug fixed in 7.1).
- [ ] 8.6 Integration test in `metabob-analysis-api` exercising the full Haiku → Sonnet escalation path against a recorded fixture (replay LLM calls; no live spend).
- [ ] 8.7 Integration test exercising budget refusal: simulate a key over its cap, assert 429 with `Retry-After`.
- [ ] 8.8 Integration test exercising event-stream ingestion: post a batch, query the snapshot endpoint, confirm aggregation matches.

## 9. Documentation

- [ ] 9.1 Write `repos/metabob-mcp/docs/SIDECAR.md`: runtime model, modes, watchers, scheduler, local store layout, never-block contract.
- [ ] 9.2 Write `repos/metabob-analysis-api/docs/SEED_DETECTION.md`: seed schema, controlled vocabulary, two-tier dispatch, budget tracker, dashboard endpoints.
- [ ] 9.3 Update `repos/metabob-cloud-dashboard/README.md`: new routes, new BFF paths, removed/parked stub routes.
- [ ] 9.4 Update top-level `CLAUDE.md` "Current Implementation Status" with a paragraph on the core stack reorganisation and pointers to this change.
- [ ] 9.5 Add a `docs/CORE_STACK.md` at the super-repo level summarising what's in the core stack (these three repos) vs. the impulse-activity stack.

## 10. Validation

- [ ] 10.1 Run `openspec validate core-stack-sidecar-seed-analysis --strict` and resolve any issues.
- [ ] 10.2 Run the dev loop (`bun run dev-loop` in `repos/metabob-cloud-dashboard`) on a substrate substrate or canary; assert no rubric regressions.
- [ ] 10.3 Deploy to canary; manually verify the team-lead flows end-to-end with a real `metabob-mcp` sidecar against a real codebase.
- [ ] 10.4 Capture before/after screenshots of the API Keys page, MCP Usage tab, Sessions list, and a session drill-down; attach to the change archive.
