# docs-1 — raw notes (docs shard 1 + CLAUDE.md + README.md)

Source: `find docs -name '*.md' | sort | sed -n '1,23p'` (23 files: `docs/API_V2_ACTIVITY.md`,
`docs/architecture/{EXPLICABILITY_SURFACE, GOAL_EXECUTION_PATHS_SCHEMA, HUMAN_PARTICIPATION,
IMPULSE_ACTIVITY_FOUNDATION, IMPULSE_CONFORMANCE_LEDGER, IMPULSE_STATE_SPACE_SPEC,
LITERATURE_COMPARISON, RESOLVER_TRACKING, RUNTIME_ACTIVITY_TRACING, SHAPE_ACTION_EVIDENCE_EXPECTATIONS,
SUBSTRATE_AS_DEC, SUBSTRATE_AS_DYNAMICS, SUBSTRATE_AS_FLEET, SUBSTRATE_AS_MDP, SUBSTRATE_AS_NETWORK,
SUBSTRATE_AS_REPRESENTATION}.md`, `docs/architecture/sequences/{01..05, README}.md`) plus `CLAUDE.md`
and `README.md`. Checked against: live clones `/workspace/git/vessels/*` in substrate-live (HEADs
09-28/29 for most vessels), SurrealDB `activity-system/learning_loop` (read-only), the live gap store
`/workspace/git/super-repo/gaps/gaps.json` (read-only copy), journals, systemd units, both containers'
env (names only; ids printed for FED_SUBSTRATE_ID/PROFILE which are identifiers, not secrets).

## Coverage and method caveats

- Read fully: IMPULSE_ACTIVITY_FOUNDATION (all 1211 lines), IMPULSE_CONFORMANCE_LEDGER,
  SHAPE_ACTION_EVIDENCE_EXPECTATIONS, HUMAN_PARTICIPATION (to l.120), EXPLICABILITY_SURFACE (to l.110),
  RESOLVER_TRACKING (l.1-100, 180-260), RUNTIME_ACTIVITY_TRACING (l.1-90), sequences/04 (l.1-376),
  sequences/05 (l.1-30, 283-310), SUBSTRATE_AS_DYNAMICS (header + §6-7), SUBSTRATE_AS_DEC (§2, §4.4),
  NETWORK §11, FLEET §7, README l.1-200 + Learning loop + Key design principles, CLAUDE.md (full, in context).
- Skimmed by heading only: SUBSTRATE_AS_MDP (1409 lines), SUBSTRATE_AS_REPRESENTATION, LITERATURE_COMPARISON
  (only §9 prediction headlines), IMPULSE_STATE_SPACE_SPEC (§7 interfaces), GOAL_EXECUTION_PATHS_SCHEMA,
  sequences 01/02/03/README, API_V2_ACTIVITY (endpoint list).
- Mechanism existence checked by grepping live clones for 436 backticked identifiers named in
  sequences/RUNTIME/STATE_SPACE/GOAL_PATHS docs (only 10 absent) and 52 doc-cited `src/*.ts` paths (all present).
  **Existence is not use**: use was checked by DB row counts / recent executions / journals where possible.
- HTTP liveness of documented activity-api endpoints was NOT verified: my probes returned 401 because the
  header form was wrong (`Bearer <METABOB_API_KEY>` rejected). Route existence rests on route-registration greps.
- The executions/goal-path numbers mix autonomous/tick traffic with operator goals; they are not a reach
  measurement of "useful work" (memory law: split by author).

## THE END GOAL (as the docs state it)

CLAUDE.md "The execution expectation" is the single sharpest statement:
- **Floor**: ReAct parity for any arbitrary task — walk + tool-enabled fallback *is* the ReAct loop, traced.
- **Ceiling**: a task done before runs over the learned pathway (cheaper, faster, more reliable).
- **Middle**: similar tasks reuse the pathway and walk only first/last-mile difference.
- **Reach ~90% on arbitrary useful goals regardless of priors**; reach failures are information-availability
  failures; high reach on trivial goals is a gamed metric.
- Autonomy success criterion: substrate-authored commit on remote working branch with no operator hands;
  trajectory S1 → S2 → S3; operator becomes structurally non-load-bearing.
- Foundation "Core Premise": progressively convert stages of any workflow into programmatic components that can
  be routed to, instead of rebuilding each time; "topology discovery engine"; convergence = recall reliably
  succeeds without learning needing new structure for known goal classes.
- SHAPE_ACTION_EVIDENCE: the condition being proven = every NL goal gets a shape-lattice entry point, walks,
  passes reach gate, records evidence keyed by signature, and the substrate's own commits measurably improve this loop.

Measured against the live store (7-day `goal_execution_paths`, by `walk_tier`; `success_count/execution_count`,
with the divergent `successful_executions/total_executions` in brackets):
- learned_pathway 461/901 = 51% [527/901]; satisfier 121/7279 = 1.7% [775/7324];
  fresh_derivation 52/6222 = 0.8% [83/6228]; universal_tool_fallback (the ReAct floor) 187/9274 = 2.0% [455/9274];
  feature_compose 0/54 [0/54].
- Three success counters on one row disagree (success_count vs successful_executions vs thompson_alpha);
  which one any "reach rate" reads is ambiguous → write-read-mismatch / false-verification.
- The floor is far from ReAct parity on this (mixed) population; the ceiling (learned pathway) is the only tier
  near half.

---

## Findings by problem-class key

### docs-drift

1. **Docs-as-expectation loop (law 9) fails three ways at once.**
   - False positives: `development-vessel/src/resolvers/docs-align-tick.ts:578` builds
     `live_truth.existing_paths = walkScripts(scriptsDir, 2000)` — only `scripts/`. `docs-align-scan.ts:320`
     then flags every doc path outside `scripts/` as missing (`setup_enablement`). Result: gaps
     `docs-drift-CLAUDE-md` (quotes `validation/scripts/failure-mode-harness.ts`, which EXISTS on host and in
     container super-repo), `docs-drift-docs-architecture-SHAPE-ACTION-EVIDENCE-EXPECTATIONS-md`
     (stratified-harness.ts, compare-reports.ts — both exist), `docs-drift-README-md`,
     `docs-drift-docs-architecture-sequences-02-impulse-resolution-md`. 24 `docs-drift-*` gaps opened 2026-09-18,
     all still open at 09-29, all `falsifier=none`.
   - False negatives: real drift in my shard went unflagged — see items 2-8.
   - Not closing: 33 of 35 doc-related gaps open; `orphaned-capability-docs_align_bridge` (09-26) says the
     `docs_align_bridge` resolver is invoked by 0 activities; `orphaned-capability-docFixPolicy{,_write}` open;
     the one doc gap that mattered (`docs-prescribed-a-command-the-tooling-now-refuses-and-the-docs-align-loop-never-noticed`,
     09-22) was aligned by hand in commit 37b18ec0 and now has a `-narrowed` twin (09-28), falsifier=none.
   - Tick does run (journal 09-28 01:22 `[resolve] bare pointer body accepted (deprecated form) type=docs_align_tick`)
     — i.e. it runs through a deprecated envelope, and its output is mostly false.
2. **API_V2_ACTIVITY.md** (last touched 2026-08-02): Base URL `activity-api.activity-system.svc.cluster.local:8080`
   (Kubernetes fossil; system is one container). Overview says activity-api does "Impulse Resolution — Resolve
   all impulse pointer types", contradicting foundation "The backend is NOT a universal resolver" and README
   principle 3. Documents `/v2/vessels/register|heartbeat|status` on activity-api (a second vessel registry
   duplicating discovery — see codebase-bloat). Documents `/v2/activities/execution-sequences` and
   `/v2/activities/boredom/*`: routes exist but have no callers outside activity-api and `execution_sequences`
   has 0 rows. The docs-align detector flagged only a dated version marker `**1.0.0** (2026-03-23)`.
3. **GOAL_EXECUTION_PATHS_SCHEMA.md** headings carry dates ("Per-Goal Record & Reuse (2026-06)",
   "Terminal Output Shapes (Migration 092, 2026-04-26)") — timelessness violation (law 9) the detector did
   not flag.
4. **Ribosome contradiction between the top-level docs.** CLAUDE.md ontology sentence: "the ribosome extracts
   successful executions into reusable templates"; foundation §Ribosome and principle 6 likewise. README
   "Learning loop" step 5: "the ribosome is the intended extractor and it is **not** currently what mints ...
   `applyExtraction` defaults to false ... nothing is registered". Live: `ribosome-extract` executed 1459× in
   14 days (plus 620 `compose-auto-bridge-source_code-to-ribosome-extract`), i.e. ~100+ proposal-only runs/day
   feeding the trace store. Foundation law 4 ("activities earned by doing — the ribosome") is design, not reality.
5. **README says obsidian-vessel is "the human interface"** and CLAUDE.md "Human: Obsidian vessels"; live
   `obsidian-vessel` unit is **inactive**; the served human surface is human-surface-vessel `:8310`.
   SHAPE_ACTION Claim 7 (human-interaction closure) is keyed on obsidian-vessel as the implicit channel.
6. **README install sequence** relies on `substrate-manifest`, `substrate-status --wait`, `substrate-connect`
   inside the image; the running substrate-live container (image `ghcr.io/avigopal/substrate:dev`, created
   2026-09-23 21:14 PDT) has none of them in `/usr/local/bin` (only as `.sh` in super-repo scripts). HEAD
   `Dockerfile.substrate` (227ac65e, 09-23) COPYs them. Ordering (image built before/after that commit) unknown —
   either way the running deployment is not what README describes (sync-deploy-drift).
7. **HUMAN_PARTICIPATION.md**: "Records append to `$WORKSPACE_ROOT/interactor-log/...` (WORKSPACE_ROOT defaults
   to /workspace)". Live env file sets `WORKSPACE_ROOT="/workspace/git/super-repo"` on both nodes → two journal
   dirs: `/workspace/interactor-log` (last write 2026-09-22 08:44) and `/workspace/git/super-repo/interactor-log`
   (last 09-27). See memory-recall / test-residue.
8. **SHAPE_ACTION_EVIDENCE "Standing invariants"** assert "The learner self-tunes: learning_policy recomputes
   TD_LAMBDA/YIELD_FLOOR ... writeback actuates them". Live `substrate_tuning_param`: 4 rows; TD_LAMBDA written
   2026-09-16 by learning-policy-writeback with evidence `templates_fetched:0, total_sample_volume:0,
   kappa_spread:0` (tuned on zero evidence), nothing since. No `learning_policy*` executions in 14 days.
   Claim 4 cites `dec_limiters.kappa_posterior_spread` from `scripts/substrate/autonomy-status.ts`
   (last commit 1cdd58b9, 2026-07-05; only callers are its own compiled `.js/.d.ts` siblings).
   Claim 5 (coverage-matrix fill run over run): latest pinned baseline `validation/baselines/2026-07-01-stratified.json`,
   latest result 2026-08-12 — not measured for ~7 weeks.
9. **IMPULSE_CONFORMANCE_LEDGER** seams 1-2 "scheduled (first/second migration)" since ≤2026-08-05: 34
   boredom/dev-vessel source files still call bespoke `/run-goal`; goal-host `index.ts` still has 7 REST
   `/v2/activities/recommend` references. The "dual-parse conformance fix" prerequisite: no identifier
   (`body.impulse.pointer` only in ias-executor hosts). Status = dormant plan.
10. **Foundation "Reachability Across Substrates"**: invariant "substrate identity surfaces only as a discovery
    pubkey and as a `foreign_provenance` annotation" — `foreign_provenance` has 0 hits in live src; the de-facto
    field is `origin_substrate_id` (execution table). Observe-detect-resolve section is honestly labelled
    "specified, not implemented" (good pattern).
11. **Dates in lens docs**: SUBSTRATE_AS_MDP/DEC/NETWORK/REPRESENTATION last touched 2026-07-03 — the lens
    stack's mechanism claims (momentum kernel, inertial credit flow, harmonic/livelock detector, spectral gap)
    have **0** code hits for `spectral_gap`, `hodge`, `harmonic`, `inertial`, `kappa_posterior_spread`; the only
    λ₁/ρ_grow code is a proxy `lambda1_inequality_ok: density >= fraction`
    (`development-vessel/src/resolvers/learning-transfer-report.ts:235`) — exactly the "incomparable scales"
    hazard the DYNAMICS header warns about.
12. **docs-reap-refused** (gap, 09-29 updated): ingest-docs refused to reap 606 stale doc sections (limit 472 of
    1890); samples include `CLAUDE.md#current-implementation-status-known-issues`,
    `CLAUDE.md#1-instructional-state-vessel` (deprecated state names), `docs/SUBSTRATE.md#promoting-to-canary`.
    These stale sections are dense-searched into the drafting prompt as `architecturePrinciple` concepts
    (per SHAPE_ACTION header) → the drafter is fed retired docs.
13. Doc churn since 2026-06-01: README 28 commits, CLAUDE.md 24, MDP 10, foundation 8, RUNTIME_TRACING 8 —
    the top-level docs are rewritten continuously while code-level claims (API_V2: 1 commit) rot.
14. Internal honesty patterns that DID work (keep): RUNTIME_ACTIVITY_TRACING opens with "DECIDED: uninstalled"
    + "confirm by effect"; sequences/04 retracts `improvise_solution` and "Trailblazing"; foundation "Known Gaps"
    keeps closed entries as repair patterns; DYNAMICS header's four preconditions. These are the model for all docs.

### write-read-mismatch

- **RESOLVER_TRACKING**: promises execution-level `resolver_tier`, `resolved_by_vessel_id` (migration 067) and
  `impulse_resolutions[]`. Live 3-day window: 85,720 executions, `resolver_tier` null on all, 0 with
  `impulse_resolutions`, 0 with `resolved_by_vessel_id`. Tier IS written inside `trace.tasks[].resolver_tier`.
  `impulse_resolution_metrics` table 0 rows, `llm_resolution_log` 0, `routing_trace` 0. So "resolver selection
  learned from impulse_resolutions" has no data at the documented address.
- **Tool argument pattern learning** (sequences/03 "Tool Argument Pattern Learning"; API_V2 `/tool-usage`):
  `ias-executor-ts/src/resolvers/learning-signal-writer.ts:154` POSTs `/v2/activities/tool-usage`;
  `activities.ts:10019` `CREATE tool_usage_patterns`; tables `tool_usage`, `tool_usage_patterns`,
  `tool_argument_pattern` all 0 rows. Silent learning-signal path (the foundation's own F-39 residue warning).
- **Human-surface journals** split across `/workspace/interactor-log` vs `/workspace/git/super-repo/interactor-log`
  (same class as the 09-22 "two memory stores" finding: EnvironmentFile WORKSPACE_ROOT wins over unit default).
- **goal_execution_paths**: `success_count`, `successful_executions`, `thompson_alpha` diverge on the same rows
  (e.g. universal_tool_fallback 7d: 187 vs 455 vs α-sum 972 over 517 rows).
- **activity table**: 4010 rows, all `total_executions` 0/NONE, all `learning_track="unclassified"` — the
  foundation's `Activity.thompson` α/β fields are vestigial; real posteriors live in
  `variant_performance_metrics` (thompson_alpha/beta) and `context_thompson_scores` (alpha/beta).

### node-locality

- Node 1 (substrate-live, described in the task as hub) runs `PROFILE_EFFECTIVE="standalone"` and
  `FED_SUBSTRATE_ID="local-dev-spoke"`; node 2 (compose2-live) `PROFILE="compute"`, `FED_SUBSTRATE_ID="spoke-66684ac4"`.
  Of 21,044 executions in the last day on node 1's store, 20,766 carry `origin_substrate_id="local-dev-spoke"`
  (i.e. node 1 itself) and 278 null. README's hub role and the "hub owns learning" rule are not what is deployed;
  the hub identifies itself as a spoke.
- Both nodes: `WORKSPACE_ROOT=/workspace/git/super-repo` (journals, gap store, memory resolve relative to the
  super-repo clone, not the volume root the docs describe).

### test-residue-live-state

- Last record in the stale live journal `/workspace/interactor-log/uiFeedback_write.jsonl` (2026-09-22 08:44) is a
  probe: `panel_id:"probe-panel", ask_id:"ghost-ask", value:"x"`. HUMAN_PARTICIPATION claims tests "use a temporary
  workspace and do not contact the running substrate".
- Gap store contains 12 gaps whose `status` is a literal un-rendered template (`{{status}}`,
  `{{goal.gap_status}}`, `{{goal.target_output_shape.substrateGap_write.status}}`, ...) plus one `Open` — template
  residue written as live gaps (also gap-content).
- Container super-repo `/workspace/git/super-repo` has 1629 `git status --short` lines (dirty/untracked residue).

### memory-recall

- docs-reap-refused (606 stale sections retained and retrievable) → recall surfaces retired CLAUDE.md sections.
- Journal split (above) means an activity reading the documented path reads a store frozen at 09-22.

### trace-store-db

- `execution` table: ~28.5k rows/day (85,720 in 3 days). Top 1-day activity_ids: validator-dispatch 5520,
  `development-vessel:gap-to-scenario-bridge-tick` 3706, `auth_resolve_v1` 2568, `development-vessel:mitosis-tick`
  1395, slot-binding 1118. Ticks and auth checks dominate traces — while RUNTIME_ACTIVITY_TRACING stays
  deliberately uninstalled "to protect the store". The store is being loaded by periodic ticks, not runtime tracing.
- 100 tables; 10 have 0 rows and are fossils: `activity_template`, `execution_traces`, `goal_execution_path`
  (singular), `execution_pattern`, `composition_chain`, `shape_gap_resolution`, `tool_argument_pattern`,
  `discovered_state_pattern`, `state_feature_importance`, `execution_sequences`; plus `tool_usage`,
  `tool_usage_patterns`, `impulse_resolution_metrics`, `llm_resolution_log`, `routing_trace`,
  `execution_system_traces`, `pattern` = 0. Duplicate-name pairs: activity/activity_template/activity_templates(2);
  execution/execution_traces/activity_execution_traces(18,135); goal_execution_path/goal_execution_paths;
  migrations(2)/init_migrations.
- Large live tables: thompson_selection_log 332,995; execution 150,112; concept 88,525; decision_outcome 57,901;
  promote_gate_evaluations 35,068; context_thompson_scores 29,189; goal_execution_paths 22,234.

### codebase-bloat-fossils

- Monolith files: `goal-host-vessel/src/index.ts` 17,910 lines; `activity-api/src/routes/activities.ts` 11,766;
  `development-vessel/src/resolvers/feature-compose.ts` 7,274; `activity-api/src/routes/impulses.ts` 6,236;
  `development-vessel/src/resolvers/gap-to-feature.ts` 5,404; `activity-api/src/routes/execution-traces.ts` 5,393.
  development-vessel: 400 non-test src files / 96,777 lines; activity-api 64,549; goal-host 24,534; obsidian 23,222 (inactive unit).
- Gap `orphaned-capability-docs_align_bridge` records **173 of 323 live resolvers are ever invoked** — 150
  registered resolvers are uninvoked fossils.
- activity table: 1228 of 4010 retired; all 4010 with zero counted executions.
- activity-api carries a second vessel registry (`/v2/vessels/register`, `/v2/vessels/discover` "SPEC-004",
  `routes/vessels`) alongside discovery-vessel ("the only fixed point"); callers: boredom
  `vessel-addition-scaffold-dispatch.ts` and concept-db `index.ts`. Duplicate mechanism.
- Checked-in compiled siblings: `scripts/substrate/autonomy-status.{js,d.ts,js.map,d.ts.map}` next to `.ts`;
  boredom-vessel `index.d.ts`, `vessel-addition-scaffold-dispatch.d.ts` (HUMAN_PARTICIPATION notes JS siblings
  "silently shadowing source changes" — same class).
- Doc-described fossils with no code: `improvise_solution` (retracted by seq/04 itself), `StateSpaceManager`,
  `ExecutionAdapter`, `LearningRecorder` (IMPULSE_STATE_SPACE_SPEC §7 interfaces — sketch only), `VesselHook`,
  `registerHook` (seq/05 correctly says none exist), codebase-as-vessel `npm:*` resolver introspection
  (foundation §Vessel Discovery; 0 hits), External Resolver Vesselization (0 hits for `vesseliz`),
  foundation "Minimal Backend API" `/v2/traces`, `/v2/traces/query` (no route found).

### dormant-mechanism

- Doc-promised development-vessel loops with **0 executions in 14 days** (as activity ids): docs-align
  (tick runs via a deprecated bare-pointer envelope, not as an activity), doc_drift_fix, learning_policy /
  learning_policy_writeback, selection-entropy, implicit-vessel-scan (`forward_model_strength`),
  obsidian-behavior-scan, interaction-expectation-verify, learning_mode, shape_closure_demand. Code exists
  for all (routes/impulses.ts registrations).
- Human participation pathway (uiQuestion_write → human-surface → uiFeedback → read by an activity): HUMAN_PARTICIPATION
  itself says "Learn: not established"; memory (09-22) records 248 escalations to the replaced :8270 vessel, 0 answered.
- Stratified harness / compare-reports (SHAPE_ACTION Claims 4-5): not run since 2026-08-12.
- Conformance ledger migrations 1, 2, 5, 6, 7: scheduled/open, not moving.
- `execution-sequences`, `boredom/enqueue` routes: no callers.
- Unified Execution Path (foundation Known Gaps: "Open", "the chosen direction"): `runTemplate` still in
  goal-host `index.ts` and `ias-executor-ts/src/hosts/goal-host.ts`.

### false-verification

- docs-align `setup_enablement` false positives (above) — a detector whose truth set is a subset of reality
  manufactures drift gaps; with `falsifier=none` they are also unclosable.
- `learning_policy_writeback` wrote TD_LAMBDA=0.6 citing all-zero evidence — a governor "actuating" on no data,
  reported by SHAPE_ACTION as a standing invariant.
- λ₁ ≳ ρ_grow reported as `lambda1_inequality_ok: density >= fraction` (proxy on unrelated scales).
- Three divergent success counters on goal_execution_paths.

### narrowing-duplicates / gap-content

- Gap store: 6276 gaps (closed 4251, open 1816, superseded 126, resolved 55, rejected 17). **480 `-narrowed`
  gaps, 458 open.** Example chain: `boredom-re-runs-one-fixed-concept-query-every-72s-...` → `-narrowed` (09-26)
  → `recommit-...-narrowed-compose_e...` (09-28). All doc gaps in shard carry `falsifier=none`.

### composition-crystallization

- Ribosome runs proposal-only (README) ~100/day; activity rows carry no execution counts; templates found in the
  pool were "authored by some other path". Foundation law "activities are earned by doing" not realized by the
  named mechanism.
- Successor features: table `successor_features` 2,681 rows; `SF_BLEND=1.0` set 2026-09-25 (updated_by absent)
  — live but blended at full weight with no recorded evidence row.
- Signature clusters: `signature_cluster_assignment` 2,005 rows, code `SIGNATURE_CLUSTER_N_MIN` present — live.

### goal-walk-floor

- Floor (`universalToolFallback` / `runGroundedToolLoop`, 4 iterations × 8 tool calls) exists and is the most-used
  tier by executions (9,274 in 7d) with ~2-5% success. `inferGoalTargetShapes`, `recommendReachingPath`,
  `recommendExcluding`, `verifyGoalReached` all present in goal-host. Mechanism exists; reach far from the ~90% contract.
- 686 of the 7-day goal paths lack `endpoint_output_shapes` (GOAL_EXECUTION_PATHS_SCHEMA purpose: index by terminal shape).

### selection-learning

- `thompson_posterior` shape advertised (activity-api routes/impulses.ts) — foundation's worked class-(b) repair; live.
- Per-model LLM sub-resolvers (`llmText@haiku` etc., RESOLVER_TRACKING) — "moving toward"; not checked in depth.
- `context_thompson_scores` 29,189 rows; `variant_performance_metrics` 6,744 — live posterior stores.

### sync-deploy-drift

- human-surface-vessel unit runs `/vessels/human-surface-vessel/src/index.ts` (image layer), not the live clone
  `/workspace/git/vessels/human-surface-vessel` (HEAD bb7b8dc 09-27). EXPLICABILITY_SURFACE links
  `repos/human-surface-vessel/src/store.ts` as the seed — a change there reaches the running unit only via image rebuild.
- Running image lacks README-promised CLIs (above).
- analysis-vessel HEAD 2026-08-09, identity 08-26, obsidian 08-22, ribosome 09-02, cpg-inference-ts 06-23 — stale clones.

### endpoint-routing

- API_V2 hardcodes a k8s service URL; foundation data-plane invariant says endpoint path is per-vessel advertised
  data. docs_align_tick accepted via "bare pointer body (deprecated form)" — the dual-parse fallback is load-bearing
  for the docs loop itself.

### human-surface-escalation

- EXPLICABILITY / HUMAN_PARTICIPATION are honest "operator-authored, not learning" contracts. Live journals stale
  since 09-22/27; obsidian channel inactive; Claim 7 unmeasurable (operator-presence bit: 0 hits for
  `operatorPresence|operator_presence`).

### federation-p2p

- FLEET/NETWORK decisions (genesis-op identity, self-describing ids, CRDT convergence, four-tier verification,
  survey-environment, propagate-substrate, budget-grant): code hits 0 for `CRDT`, `survey-environment`,
  `propagate-substrate`, `budget-grant`, `signature_verified`, `foreign_provenance`; `multihash` in
  content-addressed-vessel-id.ts, discovery types, libp2p transport (637 lines). Mostly design-only.

### env-gating

- `SIGNATURE_CLUSTER_N_MIN` (default 5) and REUSE_BEFORE_MINT are code constants/flags; SF_BLEND/TD_LAMBDA moved to
  `substrate_tuning_param` rows (shape-steerable) — partial compliance with law 1.

---

## Mechanisms (promised by docs → live status)

| Mechanism | Doc | Location | General/specific | Status + evidence |
|---|---|---|---|---|
| Reach gate `verifyGoalReached` + hollow β-penalty | foundation §Topology, seq/04 | goal-host index.ts | general seam | live-used (every walk) |
| In-flight recovery `recommendExcluding` | foundation, seq/04 | goal-host | general | live-used |
| Learned pathway replay `recommendReachingPath` / `recordGoalPath` | foundation, GOAL_PATHS | goal-host pathway-head/rank, activity-api | general | live-used (901 learned_pathway runs/7d) |
| ReAct floor `universalToolFallback`/`runGroundedToolLoop` | CLAUDE.md, seq/04 | goal-host | general | live-used, ~2-5% success |
| Target inference `goal-target-inference.ts` | SHAPE_ACTION C1 | goal-host | general | live (not re-measured here) |
| `thompson_posterior` shape | foundation Known Gaps | activity-api routes/impulses.ts | general | live-unused? (advertised; readers not counted) |
| Forward arm validator-dispatch → learning_signal_writer → impulse-relevance | foundation Two-Direction | ias-executor, activity-api | general | live-used (validator-dispatch 5,520/day; impulse_relevance_metrics 20,714) |
| Tool-usage / tool-argument pattern learning | seq/03, API_V2 | learning-signal-writer.ts:154, activities.ts:10019 | specific | broken/dormant (0 rows in 3 tables) |
| Execution-level resolver tracking (`resolver_tier`, `impulse_resolutions`, migration 067) | RESOLVER_TRACKING | activity-api execution-traces.ts | general | broken (0 of 85,720 rows) — tier only in trace.tasks |
| Execution sequences | API_V2 | activities.ts:10238 | specific | fossil (no callers, 0 rows) |
| Boredom queue on activity-api | API_V2 | routes/boredom.ts | duplicate | fossil (no external callers) |
| Vessel registry on activity-api | API_V2 | routes/vessels, vessel-registry | duplicate of discovery | duplicate (2 callers) |
| Ribosome extraction | CLAUDE.md, foundation, API_V2 | ribosome-vessel (HEAD 09-02), activity-api /v2/ribosome | general | live-unused: runs ~100/day with applyExtraction=false |
| Variant creation (3 consecutive failures) / retirement (20 runs <30%) | seq/04 | activity-api `shouldCreateVariant`, `checkAndRetireTemplate` | general | live (1,228 retired) |
| REUSE_BEFORE_MINT chokepoint | foundation Reuse Before Mint | dev-vessel activity-create-variant.ts | general | exists; effect unmeasured |
| Lifecycle subscription (hooks) + BusForwardingEventSink | seq/05 | ias-executor | general | live |
| Impulse-pool lifecycle events | foundation "The layer that is missing" | — | general | absent (documented as missing) |
| Unified execution path | foundation Known Gaps | goal-host runTemplate | general | open/dormant plan |
| Runtime activity tracing middleware | RUNTIME_TRACING | activity-api middleware/runtime-tracing.ts | general | dormant by decision (0 call sites) |
| docs-align-tick / docs-align-scan / doc_drift_fix | CLAUDE law 9, SHAPE_ACTION | dev-vessel | general | broken (false positives, 0 closes, docs_align_bridge orphaned) |
| ingest-docs → architecturePrinciple concepts | SHAPE_ACTION header | dev-vessel / concept-db | general | live but stale (606 unreaped sections) |
| learning_policy + writeback (TD_LAMBDA, YIELD_FLOOR) | SHAPE_ACTION invariants | dev-vessel learning-policy-writeback.ts | general | dormant/hollow (last write 09-16 on zero evidence) |
| Signature clusters (cluster:<id> write-through, N_MIN 5, 0.4 contamination) | SHAPE_ACTION invariants | activity-api signature-cluster*.ts | general | live (2,005 assignments) |
| Successor features ψ | SHAPE_ACTION, MDP §2.2 | activity-api successor-features.ts | general | live (2,681 rows; SF_BLEND=1.0 09-25) |
| repair_signature at ingest (sig v1f) | SHAPE_ACTION | activity-api execution-traces.ts | general | exists (use not checked) |
| mitosis-cutover protected names (discovery, identity) | SHAPE_ACTION | dev-vessel vessel-mitosis-cutover.ts (3,341 lines) | specific | exists |
| Staged-not-landed reach refusal + preEditContent restore + hard-fail detectors | seq/04 | dev-vessel feature-compose | general | live |
| Stratified harness / compare-reports / autonomy-status κ | SHAPE_ACTION C4-5 | validation/scripts, scripts/substrate | specific | dormant (last run 08-12; autonomy-status last commit 07-05) |
| λ₁ ≳ ρ_grow measurement | DEC §4.4, DYNAMICS §3 | learning-transfer-report.ts:235 proxy | general | broken-proxy |
| Human participation journal pathway | HUMAN_PARTICIPATION | human-surface-vessel (runs from /vessels image layer) | specific | live-but-split (two journal dirs) |
| RenderPolicy / surfaceIntent | EXPLICABILITY | human-surface-vessel store.ts, surface-intent.ts | specific | exists (renderPolicy_write 678 lines, stale store) |
| interventionRefused ledger / push-away | foundation immune system, FLEET | dev-vessel intervention-evaluate.ts | general | live-unused (0 pushAway/push_away hits; ledger shape advertised) |
| Observe-detect-resolve (guardian vessels, findings, resolution tiers) | foundation | — | general | absent (doc says so) |
| Codebase-as-vessel npm:/make: introspection | foundation Vessel Discovery | — | general | absent (0 hits) |
| External resolver vesselization | foundation | — | general | absent (0 hits) |
| Federation fold of foreign evidence | FLEET §3, NETWORK §5 | activity-api replication-pull.ts (origin_substrate_id) | general | partial; foreign_provenance absent |
| PreToolUse vessel-edit gate, SessionStart/End memory hooks, memory mirror | CLAUDE.md | .claude/settings.json hooks | specific | live (configured) |

---

## Principles (verbatim-ish, with location)

End goal / contract:
1. CLAUDE.md §execution expectation — Floor: ReAct parity for any task (walk + tool fallback, every step traced).
2. CLAUDE.md — Ceiling: learned pathway reuse; Middle: first/last-mile adaptation over an existing pathway; full re-derivation on near-miss = nothing learned.
3. CLAUDE.md — Reach ~90% on arbitrary useful goals regardless of priors is mechanism correctness, not a metric; reach failures are information-availability failures.
4. CLAUDE.md §operator role — Autonomy success = substrate-authored commit on remote working branch with no operator hands; "it fired" is not success; operator becomes non-load-bearing (S1→S2→S3).
5. Foundation §Core Premise — convert workflow stages into routable programmatic components instead of rebuilding; convergence = recall succeeds without new structure for known goal classes.

The 13 laws (CLAUDE.md §The laws): (1) everything behavioral is a shape (env/config bootstrap-only); (2) behaviors are activities; (3) reuse before mint — a wrong mint is negative value; (4) activities earned by doing (ribosome), not declared; (5) pace is rhythm, boredom is condition-driven selection; (6) don't rob self-maintenance; failure mints structure (patch instance / detector for class / generator goal); (7) measure by gap triple (close rate, latency, durability — gaps must not reappear in different hats); learned disposition; (8) information at the right time — fix starvation, not prompts; (9) docs are expectations, timeless; alignment is substrate work (docs-align loop); (10) memory belongs to the system; (11) location independence with data locality; (12) causal discipline — counterfactuals at decision time, change one thing; (13) humans are resolvers, not preprocessors.

Foundation design principles (IMPULSE_ACTIVITY_FOUNDATION §Design Principles + body):
- Impulses are universal data; pointer-as-shape is the bootstrap key for all resolution and learning (§Pointer-as-Shape).
- Minimum self-stable set = impulse, pointer, resolver, vessel (hypothesis under test); each implicit side channel is evidence about the minimum (§Minimum Self-Stable Set).
- Data-plane invariant: every vessel-to-vessel data exchange is a typed impulse to a discovery-advertised resolve_endpoint; control-plane exempt (§Minimum; CONFORMANCE_LEDGER).
- Activities constrain search; resolvers live where data lives; metadata first, content later; record everything; learn from traces; reserve improvisation (recorded); LLMs are tools, not controllers.
- Backend = trace store + pattern learner, NOT a universal resolver (§Backend's Role).
- Advertised is a claim; demonstrated is a fact — coverage must separate never-attempted / never-succeeded / succeeded-then-stopped (§Reachable subgraph).
- Reward attaches to reaching the goal, not exiting cleanly (reach gate); hollow completion β-penalised (§Topology Discovery).
- Reuse before mint, enforced at the mint chokepoint and at selection (§Reuse Before Mint).
- Learning-signal paths need instrumentation that makes their ABSENCE observable (§F-39 residue).
- A shape that returns a plausible-but-different value is worse than no shape (§thompson_posterior repair).
- Known Gaps keep closed entries as reusable repair patterns (§Known Gaps).

Lens principles:
- DYNAMICS header: before trusting any derived quantity — (1) both sides on a common scale, (2) a described detector is not a running detector (confirm a caller + accumulating history), (3) a measurement is not a governor until something acts on it, (4) check freshness, not presence.
- DEC §4.4 / DYNAMICS §3: master inequality λ₁(L(t)) ≳ ρ_grow — grow only as fast as credit mixes; "drafting or vessel-spawning without raising throughput is self-defeating"; livelock = looks busy, not learning (conjecture, not theorem).
- DEC §2: "Resolvers live where data lives" = sparsity of L; "Orthogonality is the moat" = block-diagonal ⋆ (shape × signature × tier × scope factorization).
- FLEET §3 / NETWORK §5: share evidence, not weights; fold foreign signed evidence into the local posterior under a conservative prior; ephemeral never crosses.
- FLEET §0 / foundation: nothing above discovery sees a substrate; substrate identity only at discovery.
- NETWORK §6: converge by default (CRDT/gossip), agree (BFT) only where forced.
- RESOLVER_TRACKING: resolver tier = binned directional certainty; distillation LLM → deterministic is additive; LLM resolver never removed.
- RUNTIME_TRACING: bound retention first, install instruments second; confirm an instrument by its effect; a wrapper row must never absorb a failure that belongs to the thing it wrapped.
- SHAPE_ACTION header: expectations, not readings — never inline measurements in docs (they are fed to the drafter as current truth).
- seq/04: failure is graded, not merely detected (canonical taxonomy verifier_negative/budget_exhausted/safety_breach/cascading/user_abort); a staged change is never graded as done.
- seq/05: reactive behaviour is an activity (subscription block), never a process-start callback.
- HUMAN_PARTICIPATION / EXPLICABILITY: receipt ≠ consumption ≠ learning; each transition needs a linked record; an unanswered question is not agreement; a variant that elicits fewer objections by hiding evidence is a regression.

---

## What to keep / organize (recommendation from this shard)

- KEEP as canonical: CLAUDE.md execution expectation + laws; foundation (pointer-as-shape, advertised≠demonstrated,
  Known Gaps pattern); DYNAMICS four-precondition header; RUNTIME_TRACING and seq/04 honesty patterns; CONFORMANCE_LEDGER as the one seam list.
- DEMOTE to "theory/frontier" folder: MDP/DEC/REPRESENTATION/NETWORK/FLEET/LITERATURE (≈4,900 lines) — their
  mechanisms have ~0 code; they should not be ingested as `architecturePrinciple` drafter context as if current.
- REWRITE or archive: API_V2_ACTIVITY.md (k8s URL, "resolve all pointer types", fossil routes);
  IMPULSE_STATE_SPACE_SPEC §7 (interfaces never built); GOAL_EXECUTION_PATHS_SCHEMA dated headings;
  RESOLVER_TRACKING execution-level fields (point at trace.tasks where tier actually lives).
- FIX the instrument before trusting its gaps: docs-align-tick existing_paths (walk whole super-repo), then reap
  the 606 stale sections, then give doc-drift gaps a machine falsifier (the claim's path/identifier exists).
- Reconcile the ribosome story across CLAUDE.md / foundation / README to one truth.
- Resolve the node identity: node 1 PROFILE_EFFECTIVE=standalone + FED_SUBSTRATE_ID=local-dev-spoke vs "hub".
