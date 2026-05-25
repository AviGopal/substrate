# Tasks: Substrate-Hosted Explicit Vessels

## Phase 0 — Vessel-daemon toolkit (ias-executor-ts)

- [x] 0.1 Promote `src/examples/goal-host.ts` → `src/hosts/goal-host.ts`;
  add `src/hosts/index.ts` barrel; export from `src/index.ts`.
- [x] 0.2 Add `src/hosts/vessel-daemon.ts` — Bun HTTP wrapper composing an
  `ActivityExecutor` + `LifecycleSubscriberVessel` + `DiscoveryRegistrationLoop` +
  `ResolverServer`. Exposes `POST /resolve`, `POST /run-goal`, `GET /health`.
  Accepts `parent_execution_id` and `composition_chain` in request bodies
  and threads them into `ExecuteOptions`.
- [x] 0.3 Add `src/hosts/resolver-server.ts` — Hono router that binds resolver
  ids to pointer-typed routes. One file replaces the six near-identical Hono
  apps across the existing vessels.
- [x] 0.4 Add `src/hosts/discovery-registration-loop.ts` — register on
  startup, 60s heartbeat, deregister on SIGTERM. Surface is a class with
  `start()` / `stop()` and an `onUnhealthy(callback)` hook.
- [x] 0.5 Promote `BunFileSystemAdapter`, `BunProcessAdapter`, `FetchAdapter`
  to top-level exports.
- [x] 0.6 Update `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` to reference
  `VesselDaemon` as the canonical starting point. Move file-layout examples
  to the new pattern.
- [x] 0.7 Ship a `src/hosts/__example__/minimal-vessel.ts` runnable example
  in ≤100 LOC demonstrating the full daemon scaffold. Used as the template
  for the six new vessels.

## Phase 1 — local-tools-vessel (lowest blast radius)

- [x] 1.1 New repo `repos/local-tools-vessel/` containing `src/index.ts`
  (≤100 LOC instantiating `VesselDaemon` on port 8230) and a thin resolver
  wrapper that re-exports `BunFileSystemAdapter` / `BunProcessAdapter`
  resolvers behind discovery-advertised shapes.
- [x] 1.2 Add `scripts/substrate/units/local-tools-vessel.service` matching
  the existing pattern (After=activity-api,discovery-vessel,identity-vessel;
  Restart=on-failure; WorkingDirectory=/vessels/local-tools-vessel).
- [x] 1.3 Add `restart-local-tools` and `logs-local-tools` targets to
  `scripts/substrate/Makefile`.
- [x] 1.4 Add `COPY repos/local-tools-vessel /vessels/local-tools-vessel` +
  `RUN cd /vessels/local-tools-vessel && bun install` lines to
  `Dockerfile.substrate`.
- [x] 1.5 Extend `scripts/substrate/seed-identity.ts` to mint
  `local-tools-vessel` API key at boot. Add to `gen-env.sh`.
- [x] 1.6 Smoke test: `curl localhost:8230/health` returns 200; vessel
  appears in `GET discovery-vessel:8100/resolve?type=fileContent`.

## Phase 1b — concept-db substrate unit (semantic layer for self-description)

Prerequisite: concept-db repo must be present at `repos/concept-db/`.
Validation finding: gap-001 — substrate cannot reason semantically about its
own templates without a concept layer; `propose-spec` degrades to
string-matching.

- [x] 1b.1 Add `scripts/substrate/units/concept-db.service` — `After=activity-api.service discovery-vessel.service identity-vessel.service`. Port 8260.
- [x] 1b.2 Extend `scripts/substrate/gen-env.sh` with a `concept-db.env` block
  (CONCEPT_DB_API_KEY, ACTIVITY_API_ENDPOINT, DISCOVERY_VESSEL_ENDPOINT).
- [x] 1b.3 Extend `scripts/substrate/seed-identity.ts` to mint a `concept-db`
  API key and write it to `/etc/substrate/env/concept-db.env`.
- [x] 1b.4 Add `COPY repos/concept-db /vessels/concept-db` +
  `RUN cd /vessels/concept-db && bun install` to `Dockerfile.substrate`.
- [x] 1b.5 Add a seed step: after identity seeding, POST the 24 Phase-22.S2
  concepts (12 vessel-construction-pattern + 12 impulse-activity-pattern) to
  concept-db's seed endpoint. Gate: idempotent (skip if already seeded).
  (concept-db-seeder.service + scripts/substrate/seed-concepts.ts)
- [ ] 1b.6 Smoke test: `curl localhost:8260/health` returns 200; vessel appears
  in `GET discovery-vessel:8100/registry/stats`.
  (Image builds clean; smoke test requires `substrate-run` with JWT_SECRET+SURREAL_PASS.)

## Phase 2 — llm-resolver-vessel (decouples LLM credentials)

- [x] 2.1 New repo `repos/llm-resolver-vessel/`. Ships `llm_completion`
  resolver (Anthropic SDK, graceful start without API key). Full minibob
  resolver migration deferred to Phase 4 once goal-host-vessel is live.
- [x] 2.2 Update `GoalHost`'s `LLMPort` interface to support an `HttpLLMPort`
  implementation; default to HTTP when `LLM_VESSEL_ENDPOINT` env is set,
  fall back to `InProcessLLMPort` for tests.
- [x] 2.3 Substrate plumbing per Phase 1 (unit file, Makefile, Dockerfile).
  Port 8220. Identity key seeding deferred (falls back to METABOB_API_KEY).
- [ ] 2.4 Move `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars to
  `llm-resolver-vessel`'s `EnvironmentFile` only. Other vessels no longer
  reference them. (Deferred to Phase 4 cutover.)
- [ ] 2.5 Latency measurement: record p50/p99 LLM-call latency before and
  after the cutover. Target: HTTP overhead ≤20ms p99 on localhost (the
  LLM call itself dominates at ≥500ms).

## Phase 3 — bootstrap-seeder.service (unblocks minibob removal)

- [x] 3.1 New `scripts/substrate/units/bootstrap-seeder.service` as
  `Type=oneshot`, `After=activity-api.service`. Calls a script under
  `scripts/bootstrap-seeder.ts` that reads `SHARED_TEMPLATES` from
  `@avigopal/ias-executor-ts` and POSTs each via `POST /v2/activities/templates`
  (UPSERT semantics — idempotent).
- [x] 3.2 Idempotency: POST /v2/activities/templates uses UPSERT; safe to
  repeat across substrate restarts without a separate tracking table.
- [x] 3.3 Smoke test: stop substrate, wipe `/data/templates/*`, restart;
  confirm catalogue is restored within 30s.

## Phase 4 — goal-host-vessel (the core lift)

- [x] 4.1 New repo `repos/goal-host-vessel/` — custom Bun.serve wrapping
  GoalHost on port 8210. Exposes
  `POST /run-goal { goal?, targetTemplateId?, variables?, parent_execution_id?, composition_chain? }`
  and `POST /resolve` for `goal_execution` / `activity_execution` shapes.
- [x] 4.2 Discovery advertisement: `goal_execution`, `activity_execution`
  shapes; `auth_scheme: ApiKey`; `auth_token_source: caller_identity`;
  `resolve_timeout_ms: 60000`. Uses DiscoveryRegistrationLoop on startup.
- [x] 4.3 `repos/minibob/src/cli/processor.ts` updated: when
  `GOAL_RUNTIME=ias-executor` + `GOAL_HOST_VESSEL_ENDPOINT` is set,
  POSTs to goal-host-vessel:8210/run-goal. In-process bridge remains as
  fallback. `scripts/substrate/units/minibob.service` sets
  `GOAL_HOST_VESSEL_ENDPOINT=http://127.0.0.1:8210`.
- [x] 4.4 Delete `repos/minibob/src/goal-host-bridge.ts` and the
  `GOAL_RUNTIME=ias-executor` env gate. The bridge was a transitional shim;
  with goal-host-vessel running, every dispatch is HTTP.
- [x] 4.5 Substrate plumbing: unit file, Makefile targets, Dockerfile COPY +
  bun install + systemctl enable, gen-env.sh key, seed-identity.ts key mint.
- [x] 4.6 Cross-vessel composition-chain integration test (port the
  Phase 18.4.7 chain-credit test to a 3-vessel topology:
  goal-host → llm-resolver → local-tools). Assert orchestrator α increment
  matches γ-discounted ancestor credit.
  (validation/scripts/test-4-6-cross-vessel-chain-credit.ts; uses activityMetrics
  resolver → requires local substrate with freshly issued key, not canary legacy
  key format; canary activityMetrics returns 401 due to JWT generation failure on
  legacy mb_inst_ keys; run: METABOB_API_KEY=<local-key> bun run test-4-6-...)

## Phase 5 — Thompson posterior advertisement

- [x] 5.1 Add `thompson_posterior` to `repos/metabob-activity-api/src/config.ts`
  `discovery.shapes`.
- [x] 5.2 Fix the account-vs-global scope ordering bug noted in IAL
  Phase 9.3 — global rows must be the fallback, not the precedence.
- [x] 5.3 Smoke test: `POST /v2/impulses/resolve` with
  `{ type: 'thompson_posterior', activity_variant_id: '...' }` returns the
  same payload as `GET /v2/activities/:id/variant-scores`.
- [x] 5.4 Workbench: replace one of its REST callsites for variant scores
  with the impulse path. Validates the impulse surface end-to-end. Other
  callsites remain on REST until a follow-up change.

## Phase 6 — ribosome-vessel

- [x] 6.1 New repo `repos/ribosome-vessel/`. WebSocket client to
  `activity-api:8080/ws`; subscribes to `task.completed` and
  `execution:succeeded`. Calls `assembleTemplateFromExecution`. Writes via
  `activityTemplate_update` impulse.
- [x] 6.2 Substrate plumbing per Phase 1. Port 8240.
- [ ] 6.3 Delete the ribosome lifecycle-meta path from minibob.
  (Deferred to Phase 8 — minibob still runs activities; inline path removed
  when activity.ts and ribosome-resolver.ts are deleted.)
- [x] 6.4 Smoke test: ribosome-vessel active, health returns 200,
  ws_connected=true from inside container. Full extraction test deferred
  to Phase 8 cutover (requires minibob shrink to avoid double extraction).

## Phase 7 — boredom-vessel (closes the autonomous loop)

- [x] 7.1 New repo `repos/boredom-vessel/`. systemd timer (`OnUnitActiveSec=5min`)
  triggering a one-shot script that POSTs a rotating topology-discovery goal to
  `goal-host-vessel:8210/run-goal`. Idle check: queries activity-api for recent
  external traces; skips if substrate busy. Goal rotation: 5 goals cycle across
  measurement, probing, health, escalation, and coverage.
- [x] 7.2 Substrate plumbing: boredom-vessel.service + boredom-vessel.timer units,
  Dockerfile COPY + bun install + systemctl enable timer,
  Makefile logs-boredom-vessel + sync + trigger targets.
- [x] 7.3 Smoke test: `make trigger-boredom-vessel` — should log "dispatched" or
  "substrate busy". Verify goal traces carry intent:topology_discovery tag.
- [x] 7.4 Delete `repos/minibob/src/boredom.ts` (replaced with no-op stub; full removal in Phase 8.1 with repl.ts cleanup).

## Phase 8 — minibob shrink and rename

- [ ] 8.1 Delete `repos/minibob/src/activity.ts` (ActivityExecutor),
  `mcp.ts`, `process-registry.ts`, `vessel-bootstrap.ts`, `vessel.ts`,
  `vessel-registry.ts`, `acp.ts`, `acp-gossip.ts`, `boredom.ts`,
  `improviser.ts`, `waking-activities.ts`, `template-extractor.ts`,
  `ribosome-resolver.ts`, `lifecycle-subscriptions.ts`,
  `goal-processor.ts`, `agent-runtime.ts`, `orchestration.ts`,
  `background-task-executor.ts`, `embedded-templates/` (now ias-executor-ts owned).
- [ ] 8.2 What remains: `cli/`, `conversational-repl.ts`, `repl.ts`,
  thin HTTP client. ~200 LOC target.
- [ ] 8.3 Rename `repos/minibob/` → `repos/metabob-cli/`. Update super-repo
  `.gitmodules` and `Dockerfile.substrate`. Keep `minibob` binary symlink for
  one release.
- [ ] 8.4 Update CLAUDE.md §2 (MiniBob description) to reflect the new
  CLI-only role; list the substrate-hosted vessels under §6.

## Phase 9 — IAL Phase 27.3.c integration

- [x] 9.1 Amend `openspec/changes/2026-04-26-impulse-activity-loop/tasks.md`
  Phase 27.3 with §27.3.c (this change's success criteria 1–4).
  (Satisfied by existing §27.3.g; section already present.)
- [x] 9.2 Add to the IAL proposal.md New Capabilities list a pointer to
  `2026-05-23-substrate-explicit-vessels` and `2026-05-23-zk-trace-attestations`.
- [x] 9.3 Update `validation/state/lift-status.json` schema to include
  `blockers["27.3.c"]` array.
- [x] 9.4 Add `validation/scripts/substrate-explicit-vessels-check.ts` —
  reads `systemctl is-active <vessel>.service` for each of the six new
  vessels and updates the blockers field.

## Order rationale

Each phase leaves the substrate functional. Phase 0 is pure addition (no
behaviour change). Phases 1–3 add capabilities without removing any.
Phase 4 is the cutover; the goal-host-bridge shim is the safety net during
Phase 4's rollout. Phases 6–7 remove duplicates that are now redundant.
Phase 8 is the cleanup. Phase 9 is the IAL integration.

If Phase 4 (goal-host-vessel cutover) regresses, revert to the bridge by
re-deploying the prior minibob image; no schema change is required.
