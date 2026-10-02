# docs-2 — shard notes (docs, files 24–46 of `find docs -name '*.md' | sort`)

Read-only research, 2026-09-29 (container clock). Live checks were run by grepping the live clones at
`substrate-live:/workspace/git/vessels/*` and `/workspace/git/super-repo`, by reading systemd units and their
journals, and by read-only SurrealQL (ns activity-system, db learning_loop).

## Coverage

All 23 files were read in full, except IDENTITY_VESSEL_CURL_EXAMPLES.md (the first 80 lines plus the heading
list) and CONCEPT_INTEGRATION_TEMPLATES.md (about 230 of its lines):

| # | file | commits | last touched |
|---|---|---|---|
| 24 | docs/architecture/SUBSTRATE_AS_SOFTWARE.md | 7 | 2026-09-16 ad9da780 |
| 25 | docs/architecture/SUBSTRATE_AS_SOVEREIGN.md | 1 | 2026-09-16 e1d6af5c |
| 26 | docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md | 17 | 2026-09-23 d043bde5 |
| 27 | docs/architecture/WORKBENCH_CHAIN_UX_DESIGN.md | 6 | 2026-08-05 |
| 28 | docs/AUTH_JWT_CLAIMS.md | 7 | 2026-08-04 |
| 29 | docs/CORE_IDIOMS.md | 8 | 2026-08-05 |
| 30 | docs/FEDERATION.md | 16 | 2026-09-23 |
| 31 | docs/FOUNDATION_COMPLIANCE_CHECKS.md | 5 | 2026-08-02 |
| 32 | docs/GLOSSARY.md | 3 | 2026-08-05 |
| 33 | docs/guides/ACTIVITY_LIFECYCLE_DEPRECATION.md | 6 | 2026-08-02 |
| 34 | docs/guides/ACTIVITY_TASK_CONTEXT_PROPAGATION.md | 5 | 2026-08-02 |
| 35 | docs/guides/CONCEPT_DB_INVESTIGATION.md | 2 | 2026-09-23 |
| 36 | docs/guides/CONCEPT_INTEGRATION_TEMPLATES.md | 4 | 2026-08-02 |
| 37 | docs/guides/CONDITIONAL_TASKS.md | 4 | 2026-08-02 |
| 38 | docs/guides/CONTAINER_NETWORK_LIFECYCLE.md | 0 (untracked) | — |
| 39 | docs/guides/DASHBOARD_ANALYTICS.md | 5 | 2026-08-05 |
| 40 | docs/guides/EXTERNAL_VALIDATION.md | 8 | 2026-08-05 |
| 41 | docs/guides/HUMAN_PROJECT_LIFECYCLE.md | 0 (untracked) | — |
| 42 | docs/guides/INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md | 6 | 2026-08-02 |
| 43 | docs/guides/SYZYGY_LOCAL_SURFACE.md | 0 (untracked) | — |
| 44 | docs/guides/TEMPLATE_UPKEEP.md | 8 | 2026-08-05 |
| 45 | docs/HUMAN_SURFACE.md | 8 | 2026-09-23 |
| 46 | docs/IDENTITY_VESSEL_CURL_EXAMPLES.md | 2 | 2026-05-27 |

Four follow-up greps were all run:

- **Refusal candidate-pool source.** activities.ts:7759 reads template `output_shapes` only.
- **Watchdog cap.** Only a per-fire `attempts` counter exists; there is no global bound.
- **`execution_completed` emit.** It is emitted at execution-traces.ts:4062.
- **Conditional gate in the live executor.** `evaluateConditionalGate` is in engine.interpolation.ts.

Not covered:

- compose2-live (node 2). The unit and store checks ran on substrate-live only.
- concept-db row counts for `architecturePrinciple`.

## Axis that matters most

CORE_IDIOMS says `scripts/substrate/ingest-docs-as-concepts.ts` mints one concept per doc section. Only sections
under `docs/architecture/**` become `shape=architecturePrinciple`, and those are dense-searched into the
**code-authoring prompt**. Live evidence: `feature-compose.ts` references `architecturePrinciple`, and
`ingest-docs.timer` last ran 01:22 UTC, exit 0, `dryrun:false`. Drift in `docs/architecture/` therefore reaches
the drafter as authority. Drift in `docs/guides/` and top-level docs misleads operators only. The findings below
are sorted on that axis.

---

## Findings by problem class

### docs-drift

**A. Drift that reaches the drafter (docs/architecture/, ingested as architecturePrinciple)**

1. **SUBSTRATE_AS_SOFTWARE §5 names units that no longer run their named code.**
   - The doc says "*Units:* `gap-compose` (route an open substrateGap through the feature composer…)",
     "`compose-teacher` (bootstraps organic producer→consumer composites…)", and "`funnel-drain` (fires the funnel
     entry on a steady cadence…)".
   - Live: each of these units, plus boredom-vessel and operator-goal-generator, has a
     `/usr/lib/systemd/system/<u>.service.d/watchdog.conf` drop-in that replaces ExecStart with
     `watchdog-tick.ts`. The `run-dir.conf` ExecStart that would run `gap-compose-tick.ts` /
     `compose-teacher.ts` / `funnel-drain.ts` is overridden. The file comments say "Sorts after run-dir.conf
     (alphabetical), so this ExecStart wins".
   - This was deliberate: commit 887577bd (2026-07-08), "restore contiguous shape flow — watchdog demotion",
     makes the event-driven `GapDrainObserver` primary. The architecture doc was never updated, so the drafter
     is told these units do the composing.
   - compose-teacher's journal shows no output of its own in the last 2 days, only systemd start and stop
     lines. Its compose logic runs only as `WATCHDOG_RESTART_EXEC` when a stall fires.
2. **SUBSTRATE_AS_SOFTWARE §5 cites `resolutionRefused`** ("push-away applied to self"). It has 0 hits in any
   live clone. The live refusal vocabulary is `interventionRefused` (development-vessel) and `refusal_events`
   (activity-api).
3. **SUBSTRATE_AS_SOFTWARE §5 lists the self-* mechanisms as static systemd timers.** These are compose-teacher,
   spectral-gap, coherence-*, m1-trainer, model-reality-audit, autonomy-metrics, self-recovery,
   light-dispatch-healthcheck, funnel-drain and gap-compose; all have `*.timer=enabled`. That contradicts
   law 5 ("cadence lives in the pool as time-shaped rhythm impulses … not in static intervals, timers"), so the
   canonical software chart codifies the violation. Only self-recovery and light-dispatch-healthcheck are the
   stated reflex-tier exemption.
4. **TYPESCRIPT_VESSEL_TEMPLATE, "Known gap" list.** The doc names 5 files with `.svc.cluster.local` or public
   defaults (identity-vessel ×4, discovery-vessel auth).
   - Live has 15 `src` files with `svc.cluster.local`: activity-api ×7 (discovery-client, auth, connections,
     boredom, impulses, config, cli), concept-db ×3 (discovery-client, routes/impulses, config), identity ×3,
     ias-executor-ts helmfile-sync, and the forge template.
   - concept-db and activity-api are the two **exemplars the doc tells drafters to copy** ("Concrete
     implementation: repos/concept-db/src/services/discovery-client.ts, adapted from
     repos/activity-api/src/services/discovery-client.ts"). The template teaches the anti-pattern it forbids.
5. **TYPESCRIPT_VESSEL_TEMPLATE, invariant 2 says the shape-dispatch sweep keeps every vessel honest.**
   - Live `scripts/check-shape-dispatch-all.sh` has `VESSELS=( repos/activity-api repos/concept-db )`, which
     is 2 of 19 clones. Its only callers are itself and three `package.json` lint scripts (activity-api,
     concept-db, development-vessel).
   - No activity validates it. Under the script-retention rule it cannot be trusted when it passes. A vessel
     missing from the list "is silently skipped" (the doc's own words), which is the silent-skip-reads-as-pass
     class.
6. **TYPESCRIPT_VESSEL_TEMPLATE, "Emitting an impulse (the CALLING side)".** Accurate, and it cites the
   feature-compose gates, which exist: feature-compose.ts:1749-1836 refuses `exports.<x>.emit` and a literal
   `/v2/impulses/<segment>`. It is a correct lesson written after 2 landed-and-pushed emitters could never fire
   (776391aa0fc2 cited in feature-compose). Keep it. It shows the doc as a backstop written after the harm.
7. **SUBSTRATE_AS_SOFTWARE §6 "Frontier"** is honest about what is unbuilt: horizontal dispatch, two-sided
   signed traces, cost-aware selection, and a measured tangent/normal decomposition. Keep.
8. **SUBSTRATE_AS_SOVEREIGN** is labelled "EXPECTATION, NOT DESCRIPTION". It is honest, and was confirmed live:
   the trace `status` vocabulary over the last 3 days is `failure` 4764 / `success` 13371, with no `declined`.
   The defect test in the doc ("query the trace store for an outcome that means declined") **fails today**.
9. **WORKBENCH_CHAIN_UX_DESIGN** is a behavioural contract for a workbench whose repo is not a submodule and
   not a live clone (`repos/workbench` is referenced by ACTIVITY_TASK_CONTEXT_PROPAGATION; there is no
   workbench among the 19 live clones). It is a contract for a surface that does not exist in the fleet, ingested
   as architecturePrinciple. The human-surface-vessel is the live surface.

**B. Drift that misleads operators (guides and top-level docs)**

10. **CORE_IDIOMS vs GLOSSARY contradict each other on the ribosome.**
    - GLOSSARY §5: `ribosome-extract` "subscribes on `lifecycle:activity:postExecution` and emits an
      `extractedTemplate` proposal; the canonical learning-motion edge". This reads as live.
    - CORE_IDIOMS idioms 4 and 6 correctly say no emitter produces `lifecycle:activity:postExecution`. Live
      grep: the only hit is the template itself, so the template path is dead. ribosome-vessel's WebSocket
      consumer is the real path.
    - Extra: ribosome-vessel/src/index.ts:42 says "activity-api WS does not emit an execution.completed event",
      but activity-api execution-traces.ts:4062 does emit `execution_completed`. A stale in-code comment on the
      live path.
11. **FOUNDATION_COMPLIANCE_CHECKS (35 KB).** It specifies a `foundation-compliance` validator-as-activity with
    20 FC checks and 7 CC closure checks.
    - Live grep has 0 hits for: `foundation-compliance`, `foundationCompliance`, `proposedSpec`,
      `closureStatusReport`, `operatorOverride`, `ciAgreementReport`, `verify-merge-candidate` and
      `restart-vessel`. `propose-spec` appears only in development-vessel's CLAUDE.md and memory-note.ts.
    - "The closure-audit script runs CC-001..CC-007 nightly and emits a closureStatusReport impulse. Three
      consecutive green runs … hard prerequisite for lift approval": no unit runs closure-audit (no unit file
      matches), and `validation/state/closure-status.json` was last written 2026-09-09.
    - Every "open" property in that file has evidence `HTTP 0` or "health check failed: 0". That is a
      mis-addressed probe, not a measured absence (the positive-control law).
    - Whole doc: specification of an unbuilt gate, presented as "Authoritative check-list".
12. **CORE_IDIOMS idiom 7 (closure-audit)** is "lift-critical". The script exists at
    `validation/scripts/closure-audit.ts`, but it is operator-side, not scheduled, and last ran 09-09 with
    unattributed negatives. Dormant.
13. **CORE_IDIOMS idiom 10 (forge)** is accurately described as not dispatched. The live grep matches: the forge
    template is referenced by 3 development-vessel seeds but routed through `create-shape-provider-goal`.
    Accurate doc, dormant mechanism.
14. **ACTIVITY_TASK_CONTEXT_PROPAGATION** documents the retired CLI's `activity.ts` (line numbers ~1790, ~4337,
    ~6206), `mergeEmbeddedTaskFields`, `materializeOutputImpulses`, `SessionMemoryAgent`, `-t` loader and
    `cli/run-activity.ts`. It carries dated commits (d01d946, 5817d4d, d5ed943, c459304, 61a6617). Live grep
    finds 0 hits for `mergeEmbeddedTaskFields` and `materializeOutputImpulses`. Fossil.
15. **CONDITIONAL_TASKS** names `evaluateTaskCondition` (0 live hits) as its source. The live executor has
    `evaluateConditionalGate` (ias-executor-ts/src/engine.interpolation.ts:143, called at engine.ts:487), so
    the capability exists under another name. The live semantics differ: engine.ts:263 says an unresolved
    placeholder "in a conditional gate … is fatal rather than defaulted", while the doc says a missing impulse
    substitutes `""` and an eval failure means skip. The doc misleads template authors about gate semantics.
    Classify as docs-drift, not a missing capability.
16. **INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER**: its three "built-in" templates (`build-and-execute`,
    `human-guided-orchestrator`, `interactive-activity-selector`) have 0 hits in any live clone. `HumanResolver`
    appears only in `ias-executor-ts/src/templates/lifecycle/debug-failing-audit.json`. The doc describes a
    retired CLI's TTY resolver. Fossil. The live human resolver path is human-surface / stateful-ui.
17. **CONCEPT_INTEGRATION_TEMPLATES** points at a `templates/concept/` directory, and the three templates
    `prime-context-for-task`, `extract-concepts-from-trace` and `link-concepts-for-composition` "Landed:
    6bb1993 (2026-04-23)". `templates/` does not exist in the super-repo, and the three template ids have 0 hits
    in any live clone. Fossil claiming a closed loop that does not exist.
18. **DASHBOARD_ANALYTICS**: the dashboard repo "is not a submodule", and the doc uses the retired names
    `metabob-activity-api` and "Panels added in April 2026". The activity-api route `/impulse-relevance` does
    exist (activities.ts:9394). Fossil guide for a surface outside the fleet.
19. **EXTERNAL_VALIDATION**: its own header says the weighted-penalty table is "aspirational". The
    `external-validation` resolver has 0 live code hits; it appears only in migrations 164 and 176, which drop
    dead orphan tables. The 5-stage grounding pipeline (`smoke-test-endpoint` … `promote-provisional-vessel`,
    `externalResolverProbeReport`) has 0 hits. The failure-mode list in the header lists 5 modes; the live list
    has 6 (`prediction_disagreement` is missing). Fossil plus unbuilt design.
20. **IDENTITY_VESSEL_CURL_EXAMPLES**: base URL `https://identity.metabob.com` (a retired name per GLOSSARY
    §7.1), local `http://localhost:8080` (that is activity-api; identity is P101), and the old
    `/v1/keys/generate` path, which the doc itself admits is not the admin `/v1/keys/issue`. Last touched
    2026-05-27. Fossil.
21. **AUTH_JWT_CLAIMS contradicts itself.**
    - "API Key Authentication" claims show `scopes` and `api_key_id`. Yet "The claim set is what the generator
      emits" says the generator mints only `user_id, org_id, role, project_ids[], exp, iat`, and "a claim
      documented here that the generator does not emit … will silently be undefined".
    - The PERMISSIONS examples use `$auth.org_id` and `'write' IN $auth.scopes`, while CLAUDE.md and the doc's
      own best-practice 6 say `$token.org_id`.
    - The sample code uses `jwt.verify` with `JWT_SECRET` in application code, contrary to "identity-vessel is
      the single validator".
22. **ACTIVITY_LIFECYCLE_DEPRECATION and TEMPLATE_UPKEEP** say the before/after diff "is persisted to
    `upkeep_audit_log`". Live: `SELECT count() FROM upkeep_audit_log` = **0** (the table name is referenced in
    activity-api/src/routes/impulses.ts, so this is a true negative on the store). So no
    `activityTemplate_update` or `_deprecate` call has ever been audited into the store. They are unused, or the
    audit write never lands.
    - Both docs correctly state that `getActivitiesWithTieredFallback` has no `deprecated` predicate (live: 0
      occurrences of "deprecated" in activities.get-activities-with-tiered-fallback.ts).
    - Both correctly state that `audit-and-backfill-templates` does not exist (0 hits).
    - These are known gaps documented in prose rather than filed. A docs-as-gap-store anti-pattern: the doc
      records "until it is added…" and nothing drives it.
23. **Untracked docs (0 commits): CONTAINER_NETWORK_LIFECYCLE, HUMAN_PROJECT_LIFECYCLE, SYZYGY_LOCAL_SURFACE.**
    - SYZYGY_LOCAL_SURFACE pins an image id (125775d7…), the date "September 22, 2026", the host
      `syzygy.host`, the port 38310 and `FED_SUBSTRATE_ID=syzygy-local-surface-20260922`. That directly violates
      law 9 (no dated status or instance names).
    - CONTAINER_NETWORK_LIFECYCLE contains full setup commands (CLAUDE.md: README § Installation is the only
      document with setup commands) and `make -C scripts/substrate up|recreate`. The operator memory bans
      lifecycle make targets for agents after `make -n` destroyed substrate-live.
    - Both link `validation/reports/syzygy-local-bringup-2026-09-22/`, which exists on the operator host but is
      untracked (`git ls-files` empty) and absent from the container's super-repo. That is evidence the substrate
      cannot see (law 11).
    - HUMAN_PROJECT_LIFECYCLE says honestly that it is a design contract; its assessment report is also
      untracked.
24. **FEDERATION's Components table** places the transport in `repos/libp2p-federation-transport`. But
    `registerAtHub`, `substrateBootstrap`, direct-only mode and `resolveViaHttp` live in
    `scripts/substrate/federation-relay/federation-transport-server.ts` (the scripts tier, not a submodule),
    which makes them not substrate-authorable (authorability = submodule membership).
    - Its "Known limitations" section is a standing list of open defects written as documentation rather than
      filed: "hub-owned shapes do not resolve from a spoke — resolution works spoke → hub only", "Direct-only
      federates nothing, and nothing loudly says so", "HTTP-over-libp2p path fails every class above 1 B across
      a circuit", and "federation-relay hard-exit parks in activating forever".
25. **HUMAN_SURFACE and FEDERATION** also record defects as prose. Examples: two writers truncated
    `.substrate-secrets`, `FED_SUBSTRATE_ID` regenerated on each boot, and substrate-authored commits to
    `ui/src` land without a bundle because hooks are skipped. Useful knowledge, but its runtime reader is an
    operator, not a detector.

### goal-walk-floor / write-read-mismatch — the selector's refusal counts only templates

- `refusal_events` has **9160 rows**: `no_producer_for_expected_shapes` 9129 (the latest at 2026-09-29 03:21)
  and `promote_gate_below_threshold` 31 (last 2026-07-20). There were **112** in the last 24 h and **996** in the
  last 7 days.
- The refused shape sets include `goal_execution`, `activityExecutionTrace`, `light_dispatch_execution`,
  `goalExecutionPath` and `activityTemplateRecommendation`. SUBSTRATE_AS_SOFTWARE §2 lists vessels that serve
  all of them.
- Mechanism (activities.ts ~7720-7760): the refusal fires when "NO template IN THE FULL CANDIDATE POOL emits"
  an expected shape. The pool is `validTemplates` and their `output_shapes`, with no discovery or resolver
  consult. So a shape served by a vessel resolver but produced by no *template* is refused.
- Every refusal suggests `create-shape-provider-goal`. The same shape sets recur daily (8/8/8/7/5 per set in
  24 h), and nothing consumes the suggestion.
- This is a producer-type mismatch: the walk's knowledge (resolvers) and the selector's knowledge (templates)
  are two stores that are never joined. The honest-refusal mechanism itself is good; its candidate set is
  incomplete.

### dormant-mechanism

- **interventionRefused / push-away (CORE_IDIOMS idiom 11).** The resolver exists
  (development-vessel/src/resolvers/intervention-evaluate.ts; the shapes `intervention_evaluate`,
  `interventionRefused` and `_write` are advertised).
  - Its store is a JSON file at `$WORKSPACE_ROOT/refusals/refusals.json`. Two copies exist:
    `/workspace/refusals/refusals.json` (5 records, mtime 09-07) and
    `/workspace/git/super-repo/refusals/refusals.json` (1 record, mtime 09-25). That is the same two-roots
    `WORKSPACE_ROOT` split as the memory two-stores finding.
  - The super-repo copy is untracked and not gitignored (`?? refusals/`), which leaves a dirty tree in the
    substrate's own clone.
  - With 6 records in total, the S2→S3 "refusal-rate trend" readiness measure is operationally inert.
- **closure-audit (idiom 7):** dormant since 09-09. Its negatives are unattributed.
- **forge (idiom 10):** registered, not dispatched. The doc is accurate.
- **ribosome-extract lifecycle template:** it subscribes to an event nothing emits. The live ribosome runs via
  ribosome-vessel's WebSocket consumer instead.
- **compose-teacher:** runs only as the watchdog's `WATCHDOG_RESTART_EXEC` on stall. There is no evidence of a
  compose-teacher run in 2 days.
- **template upkeep middle activity:** absent. The write resolvers exist, but `upkeep_audit_log` = 0 rows.
- **external-validation resolver and grounding pipeline:** never built, or removed.

### spend-envelope-throughput / autonomous-regression — the gap-compose watchdog loop

- Live journal for `gap-compose.service` over the last 24 h: **263 `watchdog_restart` actions and 0 of any
  other action**.
- Each fire sends a `gap_to_feature` restart impulse that returns `ok:true http:200`. Yet `stalled_min` climbs
  191→192→194→195 between 03:39 and 03:44 UTC, and `open_intents` goes 376→382.
- `watchdog-tick.ts` has no global attempt budget, repetition bound or route-exhaustion branch; line 148 is
  only the per-fire `attempts` counter.
- SUBSTRATE_AS_SOFTWARE §5 names exactly this: "What a fixed tier still owes … an attempt budget, a repetition
  bound, and a route-exhaustion branch. … identical failures should not be possible, and where they occur the
  recurrence itself is the defect". The doc states the law, and the live reflex violates it.
- Two causes cannot be told apart from here: (a) an operator quiet-window mask on gap-compose (the operator
  memory lists "gap-compose mask" as part of the accepted quiet window), or (b) the restart impulse not
  producing activity on `WATCHDOG_ACTIVITY_PATHS` (drain-log.jsonl / compose-lessons.jsonl mtimes), so the
  stall marker never resets.
- Either way, the primary event drain (GapDrainObserver) has shown no flow activity for more than 3 hours
  while a fixed reflex fires every ~90 s.

### composition-crystallization

- **composition-edge-reconcile** runs, but in the 7-day journal **204 of 205 runs upserted 0 edges** (one run
  upserted 161). The latest runs report `batch_traces:0` even with `recent_ids=287` after the watermark. The
  edges are not becoming measurable from traces as SUBSTRATE_AS_SOFTWARE §5 promises. Live-used but near-inert.
  Its `recent_ids=287` against `batch_traces:0` is a possible write/read or filter mismatch (not
  discriminated).
- **spectral-gap** publishes `substrateObservable(kind=stability)` with HTTP 201 (`stability_ratio 1.65`,
  `inequality_holds true`). Live-used.
- **coherence-metric** is read-only and emits cosines. **coherence-recover** demotes duplicates ("demoted":1).
  Both live-used.
- **m1-trainer** writes a ridge-v1 row. It scanned 2503 records, 496 with embeddings; mse ≈1.20. Live-used.

### endpoint-routing

- Hardcoded `.svc.cluster.local` defaults are in 15 live `src` files (see docs-drift 4). The system stays closed
  "by env-var discipline", as the template doc admits, and that is the fragile arrangement.
- concept-db/src/index.ts:244 correctly notes that `/v2/vessels/register` is deprecated. But
  boredom-vessel/src/templates/vessel-addition-scaffold-dispatch.{ts,js,d.ts} still reference it (10 files in
  all reference the path). A scaffold that may teach new vessels the deprecated path. Needs checking.
- FEDERATION: hub→spoke resolution is one-directional (documented, still open). See federation-p2p.

### federation-p2p

- As documented: hub-owned shapes return `found:false` from a spoke unless the hub's own transport holds a
  circuit (`registerAtHub` returns early without one). Direct-only mode is silent, and HTTP-over-libp2p fails
  above 1 B across a circuit. These are documented as limits, not filed as gaps.
- The multiaddr join is "Not yet complete": identity still goes over HTTP, so a multiaddr-only join does not
  inherit `org_id`.
- The transport code lives in the scripts tier, so the substrate cannot author fixes to it.

### human-surface-escalation

- HUMAN_PROJECT_LIFECYCLE (untracked) sets the contract: "No response, timeout, disconnected terminal, or
  preselected option is a human answer".
- INTERACTIVE_ACTIVITIES (fossil) specifies the opposite for non-TTY: fall back to `default` or `options[0]`.
  The live docs therefore hold two contradictory human-answer semantics.
- A refusal row (08-28) shows `uiquestion-has-no-read-shape`: "the escalation channel … is write-only, so no
  answer can ever return" (this matches the memory finding of 248 escalations nobody reads).

### env-gating

- The self-* mechanisms are static systemd timers (docs-drift 3).
- TYPESCRIPT_VESSEL_TEMPLATE's Typed Config pattern loads behaviour blocks (`observer.enabled`,
  `discovery.enabled`, heartbeat intervals) from env at process start. The same doc later says "Anything that
  steers behaviour must be a shaped impulse read at use time, never an env var". The template is internally
  inconsistent about which config is bootstrap.
- TD_LAMBDA is correctly resolved at use time as a tuning parameter (activity-api/src/routes/tuning-params.ts,
  plus development-vessel learning-policy writeback). That is the positive example.
- The watchdog is configured wholly by unit `Environment=` lines (`WATCHDOG_STALL_MIN=45` etc.): cadence and
  thresholds are frozen at unit render, invisible to traces.

### selection-learning (claims checked and confirmed present)

- `propagateCreditAlongChain`, `TD_LAMBDA`, `applyOutcomeToPosteriors` (11 files), `v_shape_conditioned_score`
  (goal-host, activity-api), and the graded-yield success reward (posterior-update.ts:282, "2026-06-19") are
  all present.
- The `prediction_disagreement` β table is present in posterior-update.ts.
- CORE_IDIOMS idioms 3, 5, 8 and 9 match the code by name. Whether they are *read* at selection time was not
  verified in this shard.

### false-verification

- closure-status.json reports "open" properties with `HTTP 0`. The address was never positively controlled, so
  the audit's verdicts are unattributed.
- FOUNDATION_COMPLIANCE_CHECKS CC-001..007 are "hard prerequisites for lift", yet none is executable.
  AUTH_JWT_CLAIMS' "claims" table includes claims the generator does not emit, and the doc itself says these
  will be silently undefined.

### codebase-bloat-fossils

- File sizes in the live clones: goal-host-vessel/src/index.ts **17,910** lines,
  activity-api/src/routes/activities.ts **11,766**, activity-api/src/routes/impulses.ts **6,236**,
  development-vessel/src/resolvers/feature-compose.ts **7,274**, ias-executor-ts/src/engine.ts 1,922.
- development-vessel has 262 resolver files and 106 seed files. ias-executor-ts has 27 template files.
- Numbers only; no quality claim.
- Fossil docs in this shard (candidates to archive or rewrite): ACTIVITY_TASK_CONTEXT_PROPAGATION,
  INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER, CONCEPT_INTEGRATION_TEMPLATES, DASHBOARD_ANALYTICS,
  EXTERNAL_VALIDATION (except its "Toward Validator Vessels" / grounding-pipeline design idea),
  IDENTITY_VESSEL_CURL_EXAMPLES and SYZYGY_LOCAL_SURFACE. CONDITIONAL_TASKS needs rewriting against
  `evaluateConditionalGate`.
- A spec with no implementation: FOUNDATION_COMPLIANCE_CHECKS.
- Runtime residue in the substrate's clone: `refusals/` is untracked, not ignored.

---

## Mechanisms (doc-promised, with live check)

| Mechanism | Doc | Where | Scope | Status | Evidence |
|---|---|---|---|---|---|
| Reach gate `verifyGoalReached` | SOFTWARE §3.2 | goal-host + dev-vessel (9 files) | general | live-used | grep |
| In-flight recovery `recommendExcluding` | SOFTWARE §3.2 | goal-host index.ts, dev perf-canary | general | live-used (not measured) | grep |
| Per-goal path `recordGoalPath`/`recommendReachingPath` | SOFTWARE §3.2 | goal-host (pathway-head/rank, shaped-policy-store), activity-api | general | live-used | goal_execution_paths = 22,234 rows |
| Chain credit `propagateCreditAlongChain` + TD_LAMBDA | CORE_IDIOMS 8 | activity-api posterior-update.ts; goal-host; ias-executor engine | general | live-used | grep |
| Outcome-conditional β `computeDeltas` / `applyOutcomeToPosteriors` | CORE_IDIOMS 5 | activity-api posterior-update.ts | general | live-used | grep |
| Graded-yield reward | CORE_IDIOMS 3 | posterior-update.ts:282 | general | live-used | grep |
| Shape-conditioned read `v_shape_conditioned_score` | CORE_IDIOMS 9 | activity-api, goal-host | general | live-used | grep |
| Lifecycle hooks + `BusForwardingEventSink` | CORE_IDIOMS 4/13 | ias-executor bus-forwarder; goal-host, activity-api, dev-vessel | general | live-used | grep |
| ribosome-extract lifecycle template | CORE_IDIOMS 6, GLOSSARY | ias-executor templates/lifecycle | specific | broken (subscribes to an event nobody emits) | 1 hit, only itself |
| ribosome-vessel WS consumer | CORE_IDIOMS 6 | ribosome-vessel | general | live-used | activity-api emits `execution_completed` (execution-traces.ts:4062); the consumer's own comment says it does not |
| Closure-audit | CORE_IDIOMS 7, FCC §E | validation/scripts/closure-audit.ts | general | dormant | last output 09-09, all negatives `HTTP 0`, no unit |
| Forge `forge-vessel-for-shape` | CORE_IDIOMS 10 | ias-executor templates/forge | specific | dormant | registered, not dispatched |
| `create-shape-provider-goal` escalation | CORE_IDIOMS 10 | dev-vessel seeds (22 files), ias-executor | general | live-unused (suggested 9k times, never consumed) | refusal_events |
| Push-away `intervention_evaluate`/`interventionRefused` | CORE_IDIOMS 11 | dev-vessel intervention-evaluate.ts | general | dormant | 6 records in 2 split JSON stores |
| Selector honest refusal `refusal_events` | SOVEREIGN §1 (fragment) | activity-api activities.ts:7759 | general | live-used, but its candidate set is template-only | 9160 rows, 112/day |
| Declined outcome vocabulary | SOVEREIGN §1 | none | general | absent | trace status ∈ {success, failure} |
| Refusal-precision grading, gate revision, conduct ledger | SOVEREIGN §2–7 | none | general | absent | doc self-declares |
| `foundation-compliance` validator | FCC | none | general | absent | 0 hits |
| `propose-spec`/`verify-merge-candidate`/`restart-vessel`/`ciAgreementReport`/`operatorOverride` | FCC | none | specific | absent | 0 hits |
| Shape-dispatch checker `packages/shape-dispatch-check` | TS_TEMPLATE inv. 2 | packages + 3 vessel lint scripts | general | partial (sweep covers 2/19) | check-shape-dispatch-all.sh VESSELS |
| Registration-time shape filtering | TS_TEMPLATE inv. 2 | "vessels that implement it" | general | unknown | not checked |
| feature-compose emit-API gates | TS_TEMPLATE | feature-compose.ts:1749-1836 | specific | live-used | grep |
| `impulse-resolve` + `pointerFromImpulseSlots` | TEMPLATE_UPKEEP §3 | ias-executor resolvers/impulse-resolve.ts | general | live (callers not counted) | grep |
| `templateAuditReport` | TEMPLATE_UPKEEP §2 | activity-api; dev-vessel seeds (template-promote/mitosis ticks) | general | live-used | 11 files |
| `activityTemplate_update`/`_deprecate` + upkeep_audit_log | LIFECYCLE_DEPRECATION | activity-api impulses.ts | general | live-unused | upkeep_audit_log = 0 rows |
| Deprecated predicate on recommend path | LIFECYCLE_DEPRECATION | activity-api tiered fallback | specific | absent (documented gap, open) | 0 occurrences |
| `audit-and-backfill-templates` | TEMPLATE_UPKEEP §4 | none | specific | absent | 0 hits |
| `validateEvidenceGate` | TEMPLATE_UPKEEP §5 | dev-vessel variant-promote, template-promote-tick | general | live-used | the doc says it is in activity-api impulses.ts; it is in dev-vessel (location drift) |
| REUSE_BEFORE_MINT at mint chokepoint | SOFTWARE §5 | dev-vessel activity-create-variant.ts | general | live (1 site) | grep |
| Watchdog demotion (`watchdog-tick.ts`) | not documented in SOFTWARE | scripts/substrate + 5 unit drop-ins | general | live-used, unbounded | 263 restarts/24h, stall never clears |
| gap-compose / compose-teacher / funnel-drain as named in SOFTWARE §5 | SOFTWARE §5 | overridden by watchdog.conf | specific | fossil (names), duplicate path | unit drop-ins |
| composition-edge-reconcile | SOFTWARE §5 | scripts/substrate | general | live-used, near-inert | 204/205 runs upsert 0 |
| spectral-gap / coherence-metric / coherence-recover / m1-trainer / model-reality-audit | SOFTWARE §5 | scripts/substrate timers | general | live-used | journals |
| ingest-docs → architecturePrinciple → feature-compose prompt | CORE_IDIOMS header | scripts/substrate/ingest-docs-as-concepts.ts; feature-compose.ts | general | live-used | timer 01:22, dryrun:false |
| Federation `/bootstrap` + direct-only + `registerAtHub` + `substrateBootstrap` | FEDERATION | scripts/substrate/federation-relay/federation-transport-server.ts (not the repo the doc names) | general | live-used, scripts tier (not substrate-authorable) | grep |
| `resolveViaLibp2p` lpStream path | FEDERATION | libp2p-federation-transport, obsidian sidecar | general | live-used | grep |
| Conditional gate | CONDITIONAL_TASKS | ias-executor engine.interpolation.ts `evaluateConditionalGate` | general | live-used, doc names the wrong function and wrong semantics | grep |
| `mergeEmbeddedTaskFields`, `materializeOutputImpulses`, SessionMemoryAgent | TASK_CONTEXT_PROPAGATION | retired CLI | specific | fossil | 0 hits |
| HumanResolver TTY + interactive templates | INTERACTIVE_ACTIVITIES | retired CLI | specific | fossil | 0 hits for templates |
| Concept templates (prime-context, extract-concepts, link-concepts) | CONCEPT_INTEGRATION_TEMPLATES | none | specific | fossil/absent | 0 hits; no templates/ dir |
| external-validation resolver + grounding pipeline | EXTERNAL_VALIDATION | none | general | absent (tables dropped in migrations 164, 176) | grep |
| Dashboard panels | DASHBOARD_ANALYTICS | out-of-fleet repo; one activity-api route exists | specific | fossil | activities.ts:9394 |
| JWT generate/verify (identity-vessel) | AUTH_JWT_CLAIMS | identity-vessel | general | live (claims table drifts) | not re-tested |

---

## Principles and end goal (extracted precisely, with location)

**End goal**

- The substrate is a system whose authority over its own behaviour is **earned, evidenced and revisable, never
  declared**. The operator becomes structurally non-load-bearing: interventions are either refused with cited
  evidence or absorbed without harm (S3). SOVEREIGN intro, "The transfer boundary"; SOFTWARE §5 closing
  paragraph.
- The lift S1→S2 is **defined** as the substrate beginning to write authored-durable state (its own code).
  SOFTWARE §4 consequence 2, §5.
- Growth is "the recursive application of a finite idiom set across an unbounded shape space", not the addition
  of mechanisms. CORE_IDIOMS §3.

**Design laws stated in these docs**

1. The execution walk is Recall (Informational→Transient→Observational), then Learning (Observational→
   Informational). Nothing in the normal loop writes authored-durable state. SOFTWARE §1.1, §3.1.
2. Version, review and test the four primitives like code. Snapshot, migrate and protect the learned-durable
   group like a database. SOFTWARE §4.2.
3. Success means reaching the goal, not exiting cleanly. The reward is residual reduction, not exit status.
   Recovery is part of reaching. SOFTWARE §3.2.
4. `resolver_tier` is a coarse binning of a continuous, learned directional certainty. Keep the bins, read the
   scalar per (resolver, signature). SOFTWARE §4.1.
5. The reflex tier must be fixed and externally scheduled, but it owes an attempt budget, a repetition bound
   and a route-exhaustion branch. Identical failures should not be possible; recurrence is the defect.
   SOFTWARE §5.
6. Reuse before mint: reuse sharpens ⋆ and raises λ₁, while minting raises ρ_grow. The condition is
   λ₁ ≳ ρ_grow. SOFTWARE §5.
7. Refusal is a first-class outcome (reached / failed / declined). Refusal precision is graded. Gate revision is
   graded against the gate's stated purpose. Loop-destroying changes bind tighter. Decisions are staked with
   predictions recorded. The system reads its own conduct ledger. Accountability rests on "what the record says
   happened is what happened". SOVEREIGN §1–7.
8. "An acceptance that cannot be a refusal carries no information"; a system with no honest exit says no
   sideways, as hollow completion. SOVEREIGN §1.
9. "Under a completion-paying gradient, the cheapest edit to a blocking gate is its removal." SOVEREIGN §3.
10. Env supplies only bootstrap material (credential, port, identity, discovery endpoint). Anything that steers
    behaviour is a shaped impulse read at use time. TS_TEMPLATE "Substrate identity resolution".
11. Registration is non-blocking; every advertised shape has a dispatch case; the WS observer never throws.
    TS_TEMPLATE "Three invariants".
12. There is exactly one impulse endpoint, `POST /v2/impulses/resolve`, with the envelope
    `{impulse:{pointer:{type…}}}`. Send to the host that serves the shape, via discovery. Branch on `r.ok`.
    TS_TEMPLATE "Emitting an impulse".
13. "A gate that refuses after the fact is a backstop; this section is the part that is supposed to arrive
    first" — information at the moment of use. TS_TEMPLATE.
14. A handler must accept every key alias a caller might send, because a one-spelling reader silently starves
    goal families. TS_TEMPLATE "Shape advertisement".
15. Activities all the way down: no private side channel mutates state. Never mutate a template that has earned
    a posterior; edits become variants with fresh priors. Never present a prediction as a result. Never require
    the human to speak internal language. WORKBENCH principles 1–4 and "Never do".
16. Explanations must come from the recorded decision state, not be reconstructed from the outcome. WORKBENCH
    Story 4.
17. Rank by reach, not by frequency: "Frequency alone measures habit". WORKBENCH.
18. Templates must have grounding traces; declared-but-never-walked templates are hollow. CORE_IDIOMS idiom 6;
    law 4.
19. If removing a subscriber breaks an emitter, the emitter was not neutral. CORE_IDIOMS idiom 13.
20. Before writing a subscriber, check that its event is actually emitted somewhere. CORE_IDIOMS idiom 4.
21. A single green closure-audit run is weak evidence; closure must stay green across runs and run from inside
    the substrate. CORE_IDIOMS idiom 7.
22. "Templates do not belong in migrations": a non-idempotent insert mints duplicates on every redeploy.
    TEMPLATE_UPKEEP (migration 078 story).
23. A lifecycle decision that can only be made one way is not a managed lifecycle (`retired` is reversible).
    TEMPLATE_UPKEEP §5.
24. Upkeep is single-candidate-per-invocation, so each trace teaches the loop. TEMPLATE_UPKEEP §4.
25. Never benchmark without vitals. Probe on an isolated instance and only read on live. Trust the running code,
    not the checkout. An arm that always succeeds without changing its candidate query is gaming its bandit.
    CONCEPT_DB_INVESTIGATION.
26. Process state is not readiness. An advertised relay route or an HTTP 200 alone is not proof; require a
    reached goal with a durable trace. CONTAINER_NETWORK_LIFECYCLE; HUMAN_SURFACE.
27. A registry record's presence is not proof of capability, because records outlive their process by the TTL.
    Call the shape. HUMAN_SURFACE.
28. No response, timeout or preselected option is a human answer. Repeated manual intervention is a candidate
    capability gap. HUMAN_PROJECT_LIFECYCLE.
29. "Freezing a value that changes is the bug, not the storage" (relay multiaddr). A multiaddr names a peer
    identity; a URL names a host. FEDERATION.
30. A tombstone outlives the thing it marks: a 410 Gone is a deliberate signal. GLOSSARY §7.1.
31. The adapter-layer principle: missing functionality of a frozen dependency lands in an adapter, never as a
    patch to the frozen thing. FOUNDATION_COMPLIANCE_CHECKS references.
32. Recall and learning must not be conflated in one operation (FC-020). There must be no single-use REST
    endpoints (FC-016). Resolvers live where the data lives (FC-003). FOUNDATION_COMPLIANCE_CHECKS.
33. "Where this document and the code disagree, the code is what exists and this document is what is owed."
    SOVEREIGN header; the same stance appears in WORKBENCH.

## Cross-cutting observation for the realignment

The recurring hat in this shard is **documentation standing in for a filed, detectable gap.** Several docs
record a known defect honestly: the tiered-fallback deprecated predicate, the missing upkeep activity,
postExecution never being emitted, the forge not being dispatched, the svc.cluster.local defaults, federation
being one-directional, direct-only being silent, and the closure audit being operator-side. Each then stops.

The runtime reader of those sentences is the drafter only for `docs/architecture/**` (via architecturePrinciple),
and the operator otherwise. No detector watches any of them, so they persist across months: 2026-08-02/05
for most guides, while the defects remain in live code on 2026-09-29.

Meanwhile the docs that *do* reach the drafter (SOFTWARE §5, TS_TEMPLATE) carry stale unit semantics and an
exemplar list that contains the anti-pattern. The docs-align loop exists (dev-vessel `docs-align-scan.ts`,
`doc-drift-fix.ts` reference verifyGoalReached). Whether it covers these files was not checked here.
