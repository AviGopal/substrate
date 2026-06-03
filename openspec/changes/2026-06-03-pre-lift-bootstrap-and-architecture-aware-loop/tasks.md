# Tasks

## Stage 0 — Architecture-as-data foundation

- [ ] **0.1** Ingest `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` as concepts via existing `ingest-doc-as-concepts` template. Each section becomes a `source_type: "architectural_pattern_principle"` concept with `severity` field (advisory|guidance|structural).
- [ ] **0.2** Ingest the session's architectural insight findings (validation/findings/*) similarly. Concept-db gains operator-articulated insights as queryable data.
- [ ] **0.3** Verify concept-db returns these via `concept_search_by_source(source_type="architectural_pattern_principle")`.
- [ ] **0.4** Author `architectural_principles_index` concept that catalogues which principles each horizon-detector should consult. Self-documenting + extensible.

## Stage 1 — Four horizon detectors

Each detector follows the immunity pattern (single resolver, no LLM, no iteration over pool, empty inputShapes). Three-place rule strict. Per-resolver test + commit + sync + boredom integration.

### 1.A Vessel responsibility audit

- [ ] **1.A.1** Resolver `repos/development-vessel/src/resolvers/vessel-responsibility-audit.ts`. Inputs: vessel_name (optional), workspaceRoot. Reads `/vessels/<name>/src/*.ts`, queries concept-db for `source_type: "architectural_pattern_principle"`. For each principle with `severity >= "structural"`, applies deterministic check predicates (regex over imports/exports, function-name patterns, fetch-target patterns). Emits substrateGap per violation.
- [ ] **1.A.2** Per-resolver test `test/resolvers/vessel-responsibility-audit.test.ts` — mock concept-search + fs_read; verify violation detection on synthesized "bad" vessel sources.
- [ ] **1.A.3** Three-place rule: `vessel_responsibility_audit` shape in config.ts + case in impulses.ts.
- [ ] **1.A.4** Boredom goal[17] dispatches it on cheap cadence (cost: cheap, single resolver, no LLM).

### 1.B Vessel-architecture pattern scan

- [ ] **1.B.1** Resolver `repos/development-vessel/src/resolvers/vessel-architecture-pattern-scan.ts`. Inputs: optional vessel_pair, time_window. Reads recent traces from activity-api segmented by dispatcher_used + failure_mode. Queries concept-db for `architectural_pattern_principle` concepts. Detects SPOFs (one vessel's failure correlates with downstream failures), cost-output mismatches (per-dispatch resource cost vs trace value ratios), catalogue-bloat (loaded shapes vs invoked shapes ratio).
- [ ] **1.B.2** Per-resolver test.
- [ ] **1.B.3** Three-place rule.
- [ ] **1.B.4** Boredom goal[18].

### 1.C Activity lifecycle audit

- [ ] **1.C.1** Resolver `repos/development-vessel/src/resolvers/activity-lifecycle-audit.ts`. Extends existing template_invocation_history_report with state-signature affinity scoring. For each template, computes (success_rate × recency × signature_affinity). Recommends LOAD (top N by score) and UNLOAD (bottom N).
- [ ] **1.C.2** Per-resolver test.
- [ ] **1.C.3** Three-place rule.
- [ ] **1.C.4** Boredom goal[19].

### 1.D Resolver distribution audit

- [ ] **1.D.1** Resolver `repos/development-vessel/src/resolvers/resolver-distribution-audit.ts`. Queries discovery-vessel for all advertised shapes + their owning vessels. Detects responsibility-imbalance (one vessel owning shapes that belong semantically to others per principle concepts). Detects shape orphans (advertised but never invoked) and shape demand-supply mismatches (high inputShapes demand vs zero advertised production).
- [ ] **1.D.2** Per-resolver test.
- [ ] **1.D.3** Three-place rule.
- [ ] **1.D.4** Boredom goal[20].

## Stage 2 — Operator-bootstrap dispatcher fixes

### 2.A goal-host dispatch-setup patch (operator-side)

- [ ] **2.A.1** Lazy `compute_state_signature`: cache the computed signature for N seconds (configurable, default 60s); invalidate on env-event (impulse pool change, vessel registration change).
- [ ] **2.A.2** Cached discovery shape registry: cache the `+77 new shapes` proxy registration; invalidate on `vessel.registered` WS events. No per-dispatch fetch.
- [ ] **2.A.3** Bounded ProxyImpulseBus snapshot: don't deep-clone per dispatch; use reference + copy-on-write for the trace metadata only.
- [ ] **2.A.4** Conditional fetch-probe: only attach instrumentation when DEBUG env is set.
- [ ] **2.A.5** Skip activity_recommend pre-check when targetTemplateId is explicit (current behavior runs it unconditionally).
- [ ] **2.A.6** Verify per-dispatch goal-host VmRSS delta drops from ~2 GB to ~100 MB or less. Measure via `cat /proc/<PID>/status | grep VmRSS` before and after a single dispatch.
- [ ] **2.A.7** Commit + push.

### 2.B light-dispatch-vessel — stateless oneshot

- [ ] **2.B.1** Create `repos/light-dispatch-vessel/` scaffold. Package.json, tsconfig, src/index.ts (oneshot orchestrator), src/discovery-registration.ts (registers on startup, deregisters on exit). No persistent state.
- [ ] **2.B.2** Implement task-walking logic: read template from activity-api → for each task, HTTP POST to resolver-owning vessel → write intermediate result to `/workspace/dispatch-<id>/task-<n>.json` → drop in-memory reference → continue.
- [ ] **2.B.3** Trace assembly + POST to activity-api at end. Exit cleanly.
- [ ] **2.B.4** Systemd unit `scripts/substrate/units/light-dispatch-vessel@.service` — templated systemd unit (one instance per dispatch via `light-dispatch-vessel@<dispatchId>.service`).
- [ ] **2.B.5** Concurrency limiter: cap simultaneous instances at 5 via systemd resource constraints.
- [ ] **2.B.6** Per-vessel test suite — mock HTTP per resolver vessel, verify orchestration + trace assembly.
- [ ] **2.B.7** Sync + start + verify via direct dispatch of `coverage-tick`. Confirm trace lands + light-dispatch process exits cleanly with VmRSS<100MB.
- [ ] **2.B.8** Commit + push.

### 2.C Capability-based dispatcher routing in boredom-vessel

- [ ] **2.C.1** `selectDispatcher(goal_idx, signature, capability_hints) → "goal-host" | "light-dispatch"`. Hard filter (capability) + soft filter (recent health) + Thompson sample over (dispatcher, goal_idx, signature) posteriors + 10-15% exploration bonus.
- [ ] **2.C.2** `capability_hints` derived from template metadata: does the template use `concept_select_for_prompt`? `llm_completion_dispatch`? open-ended goal text without targetTemplateId? Anything LLM-heavy → goal-host eligible only.
- [ ] **2.C.3** Trace metadata: dispatcher_used recorded by both dispatchers + included in compute_state_signature inputs.
- [ ] **2.C.4** Cross-validation: every 50 dispatches, fire a comparison probe (same goal through both dispatchers). Tag traces with `comparison_probe: true` for downstream analysis.
- [ ] **2.C.5** Per-boredom-vessel test verifying routing logic.
- [ ] **2.C.6** Commit + push.

## Stage 3 — Empirical verification

- [ ] **3.1** All four horizon detectors emit a non-trivial substrateGap each (≥1 violation per detector against current substrate state). Sample run dispatched manually + reviewed.
- [ ] **3.2** `vessel_responsibility_audit` specifically emits a substrateGap flagging goal-host's LLM-reuse logic as a responsibility-misallocation per the "Backend = pattern learner" principle.
- [ ] **3.3** concept-db's `times_succeeded` count grows beyond 6 (baseline) — autonomous concept-usage-backfill (goal[16]) completes at least once via either dispatcher.
- [ ] **3.4** At least one cheap-tier multi-task chain completes via light-dispatch-vessel (e.g. concept-usage-backfill, mitosis-tick, coverage-tick).
- [ ] **3.5** boredom logs show `dispatcher_used` derived from Thompson sampling (not always the same dispatcher) — observable across ≥10 boredom cycles.
- [ ] **3.6** goal-host per-dispatch VmRSS delta drops from ~2 GB to ≤100 MB after Stage 2.A patches.

## Stage 4 — Substrate-authored next iteration (NOT in this change's scope)

After Stages 0-3 complete, the substrate's architecture-aware detectors should surface the following as autonomous substrateGap impulses. The substrate authors fixes via the now-functional LLM-driven authoring path (through either dispatcher):

- [ ] **4.1** (substrate-detected) Selection-as-activity refactor: `select-activity-for-goal` template + activity-api `/v2/activities/select-for-goal` endpoint.
- [ ] **4.2** (substrate-detected) Goal-host thin-executor refactor: remove LLM-reuse, remove template catalogue fetch, converge with light-dispatch on execution path.
- [ ] **4.3** (substrate-detected) Lifecycle-hook activities: `activity_load_tick` and `activity_unload_tick` driven by Section 1.C audit.
- [ ] **4.4** (substrate-detected) Memory-axis extension of vessel_mitosis_evaluate, surfaced by Section 1.B.

These items are TRACKED here but NOT IMPLEMENTED in this change. They are the substrate's empirical proof points that the bootstrap fixes enabled autonomous self-development.

## Gates

| Gate | Blocks | Cleared when |
|---|---|---|
| Stage 0 | Stages 1-3 | foundation-doc concepts queryable; all four detectors can derive predicates |
| Stage 1 | Stage 3 success criteria | all four horizon detectors emit verdicts on substrate's current state |
| Stage 2.A | Stage 3.3, 3.6 | goal-host per-dispatch VmRSS verified |
| Stage 2.B | Stage 3.4 | light-dispatch oneshot proven via direct dispatch |
| Stage 2.C | Stage 3.5 | dispatcher routing observable in logs |
| Stage 3 | This change completion | all empirical verifications green |

## Operator vs substrate roles

| Action | Who |
|---|---|
| Authoring horizon-detector resolvers | Operator (initial), substrate (subsequent variants) |
| Ingesting principle concepts | Operator (via ingest-doc-as-concepts), substrate (future insights via concept_write from observe-orthogonal-patterns) |
| goal-host dispatch-setup patch | Operator (circular dependency requires bootstrap) |
| Building light-dispatch-vessel | Operator (alternative architecture requires fresh design) |
| Capability routing in boredom | Operator (architectural addition to existing vessel) |
| Stage 4 substrate-authored refactors | Substrate (autonomous via mitosis through working dispatchers) |

Operator-bootstrap budget for THIS change: ~1280 LOC. After this change, future architectural fixes target ZERO LOC of operator effort.
