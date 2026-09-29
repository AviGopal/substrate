# openspec-2 — openspec change proposals, shard entries 19–36

Source listing: `(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#') | sed -n '19,36p'`.
All 18 entries in this shard are top-level dated directories (2026-05-23 .. 2026-06-01). There are no stray
.json/.ts/.d.ts files in this slice, so no codebase-bloat-fossil *files* here. The fossil problem in this
shard is different: the proposals themselves are stale in both directions. Several say "0 tasks done" but
are live in code, and several are marked done but have produced no trace in the last 2 weeks.

Read: proposal.md + tasks.md (headings and checkboxes) for all 18. Skimmed design.md for none, because the
proposal and tasks carried the problem and the build. Read findings/dev.md for topology-discovery-loop. Skipped
the spec.md deltas (they restate the proposals).

Live checks (read-only, 2026-09-29 ~03:40Z, substrate-live):
- Grepped `/workspace/git/vessels/*/src` for each change's key identifiers.
- Counted traces in `trace_digest` since 2026-09-14 per activity_id (203 distinct activities).
- Found that `activity_execution_traces` only holds July rows (18,135 rows, all `2026-07`), so it is not
  the live trace store any more. Recent traces are in `trace_digest`.
- Checked `development-vessel` process env and journal.

## Task-checkbox vs reality table

| change | tasks [x]/[ ] | in live code? | traces since 09-14 | honest status |
|---|---|---|---|---|
| 2026-05-23-substrate-self-deployment | 0/36 | `gitMergePR`/`gitOpenPR` absent. `author-pr` string exists only as route/goal-extract names | n/a | SUPERSEDED by the edit-intent → feature_compose → mitosis cutover → push origin dev path (no PRs; direct landing). Whitelist idea → autonomyScope |
| 2026-05-23-substrate-self-replacement-pipeline | 0/49 | `audit-vessel-purity` absent. minibob gone | 0 | NEVER BUILT. Concept (replace, don't edit in place; shadow-validate; archive) partly reborn as `vessel_mitosis_cutover` + mitosis evaluate |
| 2026-05-23-topology-discovery-loop | 29/4 | yes: coverage-tick, substrate-health-tick, learned-topology-snapshot, probe-*, escalate-unknown-shape seeds and resolvers, boredom goal[3] | coverage-tick 0. satisfier:learned_topology_snapshot 3. Several duplicate auto-minted compositions of learned-topology-snapshot ↔ substrate-health-tick (1–2 each) | BUILT, NOW NEAR-DORMANT. S.4a (coverage_progress=true) never reached |
| 2026-05-23-vessel-federation | 0/43 | pubkey identity advisory only (dev-vessel `discovery-registration.ts` Ed25519 "advisory H2") | n/a | SUPERSEDED by fleet-federation → `2026-07-19-relay-findability-replication`, `2026-09-12-host-independent-federation-join`, libp2p-federation-transport vessel |
| 2026-05-27-neutral-emitter-lifecycle-bus | 0/32 (commit 4167ba2a says "tasks 1+4 live") | yes: activity-api `routes/events.ts` `/v2/events/publish`, `vessel.registered` events, `BusForwardingEventSink` in goal-host/dev-vessel/activity-api | bus live | LIVE, but tasks.md was never ticked (docs-drift) |
| 2026-05-28-concept-bridge-observer | 6/13 | yes: `concept-bridge-observer.ts` started in dev-vessel index | 592 journal lines/6h. "minted/usage recorded shape=source_code" | Part A LIVE (hand-authored, S1). Part B (substrate-authored replacement) never happened |
| 2026-05-30-doc-ingestion-and-concept-management | 13/3 | yes: ingest-doc-as-concepts, detect-stale-pointer seeds | 0 / 0 | BUILT, NEVER REACHED (5 dispatches died past the LLM step on 05-30; concept coverage delta 0%). Dormant |
| 2026-05-30-draft-spec-from-gap-template | 15/2 | yes: draft-spec-from-gap seed + WRITE_ALLOWLIST in fs-write | 0 | Template dormant. The WRITE_ALLOWLIST env knob it introduced became a recurring law-1 gap with repeated hollow landings (see env-gating) |
| 2026-05-30-info-gain-bonus-on-success | no tasks | `infoGainFactor` absent | n/a | NEVER BUILT |
| 2026-05-30-obsidian-vessel-concept-db-frontend | 18/3 | obsidian-vessel src has concept-db-client, canvas, etc. Live human surface is human-surface-vessel + obsidian-intake/learn/collaborate timers | n/a | Code exists. Acceptance probes for writeback/live push never passed. Surface superseded by human-surface-vessel |
| 2026-05-30-vessel-binary-redeploy-on-source-drift | 0/16 | `detect_binary_source_drift`, `redeploy-vessel-on-drift` absent. `systemd-restart.ts`, `restart-attribution.ts` exist | n/a | NEVER BUILT as specified. The class (running binary ≠ source) recurred many times since (sync-deploy-drift) |
| 2026-05-30-vessel-resolve-contract-conformance | no tasks | `verify-resolver-contract-conformance` absent. concept-db now reads `body?.impulse?.pointer ?? body?.pointer` (routes/impulses.ts:411). ias-executor ResolverServer accepts both forms | `__conformance_probe_nonexistent__` 1 trace (July) | Probe NEVER BUILT. Instances hand-patched, which the proposal itself said would "short-circuit the signal" |
| 2026-05-31-display-failure-mode-extensions | 0/13 | `consent_revoked`, `root_cause_step` absent | n/a | NEVER BUILT (display track abandoned) |
| 2026-05-31-goal-host-oom-bounded-concurrency | 0/23 | `BoundedBusSink` in goal-host, boredom, dev-vessel. ias-executor `IAS_SUBSCRIBER_MAX_INFLIGHT`. detect-service-oom-cascade seed exists | oom-cascade 0 | L1 LIVE (unticked). L2 in framework via subscriber cap (env-tuned). L3 detector dormant |
| 2026-05-31-list-endpoint-task-count-from-content | no tasks | yes: Option B. activity-api `execution-traces.ts:1032-1056` projects `metadata.task_count` | — | FIXED (denormalized) |
| 2026-05-31-substrate-fleet-federation | 0/53 | Phase-1 image exists (substrate image + substrate-connect per README). audit-vessel/network-guardian absent. H2 advisory keys only | n/a | PARTIAL/SUPERSEDED. Image = live. Observe-detect-resolve guardians never built |
| 2026-05-31-substrate-self-audit-meta | 0/18 | `self_audit_fan_out` absent. Many detector ticks exist instead (detector-coverage-audit-tick 5 traces, gate-self-probe-tick 4) | — | NEVER BUILT. Its motivation (9367 phantoms) was a measurement artefact |
| 2026-06-01-closed-loop-learning-and-verification | 0/5 | detect-recurring-pattern, predict-and-verify, detect-recurring-trace-pattern seeds exist | detect-recurring-trace-pattern 1, satisfier:trace_recurring_pattern_scan 1 | Code seeded (unticked). Transfer test never run. Obsidian-coupled pattern detector held out of the core loop (boredom-vessel index.ts:547 comment) |

Pattern: **tasks.md is not a reliable status source in either direction.** 4 changes are live with 0
boxes ticked (lifecycle bus, OOM L1, list-endpoint, fleet image). 3 have most boxes ticked but no traces in
2 weeks (doc-ingestion, draft-spec, topology coverage-tick).

---

## By problem-class key

### sync-deploy-drift
- **vessel-binary-redeploy-on-source-drift (05-30).** F26: concept-db commit `a262475` (super `a9abc101`)
  was edited into `/vessels/concept-db/src/routes/concepts.ts`, but the running binary still served the
  pre-F26 handler (Zod enum error on `source_type=memo,impulse_signature`). run_goal "rebuild and restart
  concept-db" selected `gap-closing:test-valid-1780148026306`, a generic template. It completed in 1.2s and
  restarted nothing. The fix (drift detector + redeploy activity + vesselManifest attribution +
  auto-substrate branches + 24h admin hold + rollback discriminator) was never built: 0/16 tasks. The class
  recurred later: the "process started after newest commit" gate, the 09-28 post-land suite silently dead
  since 08-31 (memory), and the human surface running from `/workspace/git/human-surface-release`.
  Outcome: failed/dormant.
- **topology-discovery findings D-001.** The activity-api template-list Redis cache (80% fill threshold)
  hid coverage-tick from recommendation. Fixed by `93cd621` (threshold 100%), then a "container needs
  restart to pick up the change". Instance of fix-landed-but-not-running.
- **D-004.** `EMBEDDING_MODEL_DIR` was set in the Dockerfile ENV but not in `gen-env.sh`, so dense search
  was disabled in the live substrate. Two config paths diverged (image vs generated env file). The same
  shape as the 09-22 unit `WORKSPACE_ROOT` vs EnvironmentFile split (memory).
- **OOM proposal L2.** The ias-executor-ts commits `8f1343c`, `01dfc54`, `402ecdd` sat local-only because the
  `AviGopal/ias-executor-ts` remote returned "Repository not found". The framework fix could not be
  published. Publish-path drift.
- **concept-bridge Part A** was deployed by `docker cp` + systemctl restart (tasks 1.5). The OOM proposal's
  L1.6/L3.6 prescribe the same. Operator hand-sync is the deploy mechanism of this whole era.

### env-gating
- **draft-spec-from-gap (05-30)** chose option "B. `WRITE_ALLOWLIST` env" to scope fs_write. This is a
  law-1 violation baked into the spec: behavior is frozen at process start and invisible to traces. Live
  consequences:
  - Gap `gap-env-gated-write-allowlist` was "closed" by landing `69d680b` (08-?? 05:39), then re-detected
    and re-landed as `bafd83d` (07:34), an inert rename WRITE_ALLOWLIST→WRITE_ALLOWLIST_ENV that left
    `process.env["WRITE_ALLOWLIST"]` intact. The code comment at dev-vessel
    `src/resolvers/gap-to-feature.ts:2824` documents this.
  - Then `6586f17` (2026-08-30, "recommit-recommit-gap-env-gated-write-allowlist-…-narrowed via mitosis
    cutover", Substrate Autonomous) changed the unset branch from throw to `return` with a comment claiming
    deny.
  - Current live `fs-write.ts:28-32` has `throw` followed by an unreachable `return`. The comment says
    "deny", but `resolveFsWrite` only calls `assertInAllowlist` when `process.env.WRITE_ALLOWLIST !==
    undefined`, so the unset branch is dead code.
  - The running development-vessel has **no WRITE_ALLOWLIST** in its environment (checked
    /proc/<pid>/environ, `.substrate-secrets`, `/etc/substrate/env`: 0). The effective behavior is still
    "any path under WORKSPACE_ROOT writable".
  - The header comment ("When unset, behavior is unchanged") contradicts the inner comment.
  - Net: ≥3 landings, the env gate intact, the scoping never active. Hat changes: rename → return →
    throw-in-dead-branch.
- **OOM L1** made the bus cap env-tunable (`BUS_MAX_INFLIGHT`). The live framework has
  `IAS_SUBSCRIBER_MAX_INFLIGHT` env (ias-executor `lifecycle-subscriber.ts:321`). Concurrency clamps are
  env-set, not rhythm/shape-read (laws 1 and 5).
- **obsidian-vessel concept-db frontend** used settings with a hardcoded default endpoint
  `http://127.0.0.1:18260` (also endpoint-routing).

### write-read-mismatch
- **list-endpoint-task-count-from-content (05-31).**
  - Migration 118 split `tasks` into `execution_trace_content`. The single-GET reader was updated; the LIST
    reader was not, so `array::len(tasks ?? [])` returned 0 for 491/500 rows.
  - `phantom_trace_scan` read that field, emitted 50 false-positive substrateGaps, and drove the "9367
    phantoms" claim cited in `detect-phantom-success-trace.ts:8-9` and in the self-audit-meta proposal.
  - Fixed via Option B: denormalized `metadata.task_count`, projected at activity-api
    `execution-traces.ts:1047/1056`. Outcome: worked (reader realigned), but the false claim had already
    propagated into two proposals and a concept (`concept_9ldsmRgqSTd5`).
- **neutral-emitter-lifecycle-bus (05-27).** Engine lifecycle events went only to the in-process
  eventSink. concept-db events went to an in-process EventEmitter. Discovery registration emitted nothing.
  Producers wrote to channels no other consumer read (F-129: goal-host registered zero proxies if it booted
  before dev-vessel). Fix: `/v2/events/publish` + forwarder + `vessel.registered`. Live.
- **concept-bridge-observer (05-28).** analysis-vessel resolutions (`problem_detection`, etc.) never
  matched concept-db `extractConceptRefs`. The 25s WS capture had 145 events and 0 recordUsage. The bridge
  mints signature concepts upstream. Live (journal: "minted/usage recorded shape=source_code").
- **vessel-resolve-contract-conformance (05-30).** Producers sent `{impulse:{pointer}}`, but concept-db
  read `body.pointer` and llm-resolver read `ctx.body.prompt`. This was a silent parse mismatch: goal-host
  handleResolve (patched 05-30), concept-db (400), llm-resolver (200 resolved:false). All were hand-patched
  (concept-db `routes/impulses.ts:411` now dual-form). The proposed conformance probe that would detect the
  class was never built.
- **topology D-001.** Template list served from a cache missing entries: a writer (template store) and
  a reader (Redis-cached list) disagreed.

### dormant-mechanism
- **topology-discovery-loop.** 29/33 tasks done, but S.4a (3 consecutive coverageReports with
  coverage_progress=true) never met: RL flat at 2 (05-24 finding). Live: coverage-tick has 0 traces since
  09-14. learned-topology-snapshot runs only as a satisfier (3), plus 5+ one-off auto-minted compositions.
- **doc-ingestion.** ingest-doc-as-concepts had 5 dispatches and detect-stale-pointer 1. None got past the
  LLM step ("multi-task abort" engine constraint, `concept_h4bBJaRzE9Yg`). Concept pointer coverage went
  272→279 with 0 `pointer.path` (delta 0%). The event-driven templates (mint-from-correction,
  refresh-changed-docs) were shipped as "inert listeners" with no emitter, which makes them dormant by
  design. 0 traces since 09-14.
- **draft-spec-from-gap.** One dispatch on 05-30 wrote a substrate-authored change dir. 0 traces since.
  The "substrate authors specs" capability is dormant.
- **detect-service-oom-cascade** (L3). Seed exists, 0 traces since 09-14.
- **closed-loop-learning** detect-recurring-pattern/predict-and-verify. Seeds exist (unticked). The
  transfer test never ran. boredom-vessel `index.ts:547` notes the obsidian-coupled detect-recurring-pattern
  was deliberately kept out of the core loop.
- **obsidian-vessel concept frontend.** Phases 2-4 code exists, but the acceptance probes for canvas,
  writeback, and live push are unchecked. The active human surface is human-surface-vessel.
- **Inert listener as a pattern:** mint-from-correction, refresh-changed-docs, and redeploy-on-drift's
  `vesselSourceChange` observer were all specced with "stub the emitter as TODO". A consumer with no
  producer is a dormant mechanism by construction.

### false-verification
- **self-audit-meta** cites "9367+ phantom-success traces from validator-dispatch". That number is the
  list-endpoint task_count=0 artefact per the sibling list-endpoint proposal (same date, 05-31). A detector
  family, a meta-template, and a constitutional concept were motivated by an unverified measurement.
- **topology D-003.** `_goal_resolve` returned status:failure with failure_mode:null ×12, which was
  explained away as "goal-level not activity-level". This is an early form of reached ≠ status.
- **concept-bridge 1.6** accepted as "fires" = WS event observed and HTTP dispatch attempted, even though
  concept-db rejected every write (root signin blocked). This is a positive-control-less acceptance: the
  wiring was declared correct while the consumer never persisted anything.
- **vessel-binary redeploy.** The run_goal "restart concept-db" completed green via an unrelated
  gap-closing template. This is hollow completion (completed, not reached) before the reach verdict existed.

### hollow-landing
- WRITE_ALLOWLIST: inert rename `bafd83d` and branch-flip `6586f17` (see env-gating). Multiple
  substrate-authored landings, each "closing" the same gap, with the condition unchanged.
- The `-narrowed`/`recommit-recommit-…` gap ids on these commits also belong to narrowing-duplicates.

### narrowing-duplicates
- The gap id `recommit-recommit-gap-env-gated-write-allowlist-typecheck_dangling_reference-typecheck_dangling_reference-narrowed`
  (commit `6586f17`) and the sibling `recommit-recommit-route-edit-9dd34558-…-narrowed` (`11ea1f6`) and
  `…de7e5272…` (`66bf1b8`) all landed on 2026-08-30 on fs-write.ts. Recommit chains stacked three
  suffixes deep.
- topology D-002: ribosome-extract created timestamp-variant ids, and the re-seed on restart thrashed
  templates (gap-005 ×3 template churn).

### composition-crystallization / codebase-bloat-fossils (duplicates)
- Since 09-14, trace_digest shows ≥6 distinct one-shot auto-minted compositions of the same two
  activities:
  - `activity:⟨auto-mint-learned_topology_snapshot⟩`
  - `activity:⟨learned-auto-mint-learned-topology-snapshot-1jk8z5⟩`
  - `activity:⟨learned-composition-learned-topology-snapshot-to-substrate-health-tick⟩`
  - `activity:⟨learned-composition-substrate-health-tick-to-learned-topology-sna⟩`
  - `composition:substrate-health-tick-to-learned-topology-snapshot`
  - `activity:⟨learned-composition-substrate-health-tick-to-vessel-health-report-to-systemd-unit-he⟩`

  Each has 1–2 executions. This is a law-3 violation (duplicate mints split traffic) in the area this
  topology spec founded.
- In the older activity_execution_traces there is the pair
  `learned-composition-advertised-shape-coverage-scan-to-resolver-distribution-audit-to` (90) and its
  reverse ordering `learned-composition-resolver-distribution-audit-to-advertised-shape-coverage-scan-to`
  (84): the same chain minted twice with reversed names.
- Specs in this shard that are fossils (never built, superseded, or abandoned) and should be archived
  with a status note rather than left as open changes: self-deployment, self-replacement-pipeline,
  vessel-federation, info-gain-bonus, display-failure-mode-extensions, self-audit-meta,
  vessel-binary-redeploy (keep its idea: see Principles), and fleet-federation phases 2–5.
- `repos/minibob` and `metabob-activity-api` naming referenced throughout are gone or renamed (activity-api).
  The AviGopal/`@avigopal` naming migration was bundled into the self-replacement pipeline.

### selection-learning
- **info-gain-bonus (05-30).** The 8-cycle probe showed 3 different templates selected for the same goal
  across C7–C9: `draft-spec-from-gap`, `gap-closing:fp-11-silent-semantic-failure`, `detect-stale-pointer`.
  Posteriors were too sparse (n≈1 arms). `drain-pending-substrate-gaps` "succeeded" with 0 outputs in 10ms
  and inflated α. Proposed α += 1/(1+n) on the signature bucket. Never built. The "empty success inflates
  α" class later reappears as hollow-landing and information_yield "idle".
- **topology D-002.** The stagnation detector dropped coverage-tick after 3 consecutive recommendations,
  so the improviser ran instead. The fix bypassed selection entirely (`templateId:` boredom tasks, in
  minibob `boredom.ts:executeTask`). The learned selector was routed around rather than fixed.
- **display-failure-mode-extensions.** Cascading β goes only to depth-1 ancestors. Proposed
  `root_cause_step` so credit reaches the step that failed. Never built. The attribution problem is still
  open (credit assignment in chains).

### spend-envelope-throughput
- **goal-host OOM (05-31).** goal-host grew to about 10GB and was OOM-killed every ~3 min (06:18–06:32Z).
  The cascade wedged the docker daemon. Root hypothesis: unawaited `BusForwardingEventSink.forward()`
  promise queue (the lifecycle bus from 05-27 created this), plus a WS listener leak on reconnect. L1
  `BoundedBusSink` is live in goal-host/boredom/dev-vessel. This is a direct consequence of the bus change
  (fire-and-forget without backpressure).
- **topology proposal.** "Budgeting/quota for probes" was declared out of scope ("assume rate-limited").

### human-surface-escalation
- **obsidian-vessel concept-db frontend.** The vault→substrate writeback was built but its acceptance
  was never verified. The later human-surface-vessel replaced it (memory: pinned :8270 escalations to a
  replaced vessel, 248 unanswered). Same class: a surface built but not verified as read.
- **concept-bridge** was hand-authored by the operator because the substrate could not (S1 deferral).
  Part B, the lift test, was never exercised.

### federation-p2p
- **vessel-federation (05-23).** Pubkey vessel ids (H2), content-addressed template ids, and peer-aware
  `/resolve`, with the principle "no substrate label above discovery". 0/43 tasks.
- **fleet-federation (05-31).**
  - 5 phases: image, H2, federated discovery + two-sided traces, quorum + self-install, adversarial
    auditor, plus the observe-detect-resolve guardian loop. 0/53 ticked.
  - Phase-1 image/bootstrap is effectively live via the substrate image and `substrate-connect` (README).
    The live dev-vessel has an "advisory H2" Ed25519 key (`discovery-registration.ts:15-20`).
  - audit-vessel and network-guardian were never built.
  - Superseded by `2026-07-19-relay-findability-replication`, `2026-09-12-host-independent-federation-join`,
    and the `libp2p-federation-transport` vessel.

### goal-walk-floor
- **topology-discovery** named the Reachability×Learnedness table and proactive probes of the
  Reachable+Unlearned and Unknown cells. `escalate-unknown-shape` reuses `create-shape-provider-goal`
  (751 traces in the old AET, so live then). This is the precursor of the walk's fallback.
- **redeploy proposal evidence:** a natural-language goal ("rebuild and restart concept-db") was routed
  to an unrelated template. This is an early instance of target-inference failure (compare commit
  `9c967329`: "target inference found no shape for 'memory'/'recall'").

### trace-store-db
- Migration 118 split the trace content (see write-read-mismatch).
- Live observation: `activity_execution_traces` holds only July 2026 rows (18,135). The recent trace
  surface is `trace_digest`. `execution_traces` is empty. Any detector or report that still reads AET
  sees a frozen July world. Not verified which readers still do; flag for the trace-store shard.
  - `trace_digest.executed_at` aggregates returned null for `math::max`, which suggests a string-typed
    timestamp (reads needing string compare).
- concept-bridge Part A was blocked by the concept-db SurrealDB root signin (`surreal.ts:43-51`,
  finding_2026_05_28_concept_db_root_signin_blocked). Its tasks 2.1–2.5 are unticked, but the bridge now
  records usage, so this was resolved elsewhere.

### memory-recall
- **doc-ingestion (05-30):**
  - Documents that concepts were minted only by operator hand. Docs, commits, and memory were never
    ingested, and there was no management layer (dedup/stale/orphan/contradiction).
  - Pointer coverage stayed at 0%.
  - `ingest-memory-finding` was specced against operator memory files.
  - Same class as the 09-22 "680 knowledge notes unread" and 09-28 "memory holds nothing before 09-26"
    findings (commit `44ab5fd4`).

### autonomous-regression / directed-overshoot
- OOM: the bus forwarder (05-27, operator-directed) caused the 05-31 goal-host OOM cascade. The fix of one
  class (trapped events) created another (unbounded in-flight).

### human-surface / docs-drift
- tasks.md checkboxes disagree with reality in 7/18 changes (table above). Proposals reference
  `repos/metabob-activity-api/...` and `minibob`, paths that no longer exist. Every proposal here is
  written with dates, instance names, and concept ids (the opposite of the "timeless docs" law 9); they are
  change records, so acceptable. But none of the 18 is archived, although 8 are dead.

### gap-content
- vessel-resolve-contract-conformance and doc-ingestion both specified substrateGap bodies with
  `gap_class` + `fix_priors`, but no edit_site or machine check. The same gap-content shortfall later
  identified (memory 09-15 edit_site targeting).
- The 50 false-positive gaps in `scripts/substrate/workspace/gaps/gaps.json` (list-endpoint) were declared
  "separate cleanup task". No evidence they were retired.

### test-residue-live-state
- The goal `gap-closing:test-valid-1780148026306` (a test-fixture-named template) was selected live
  for a real goal (05-30 redeploy evidence). Test templates were resident in the live selection pool.

---

## Mechanisms (general vs specific; used now?)

| mechanism | location | general? | status | evidence |
|---|---|---|---|---|
| Substrate event bus `/v2/events/publish` + WS broadcaster | activity-api `src/routes/events.ts`, `websocket/` | general (shared seam) | live-used | grep hits. dev-vessel observers subscribe. concept-bridge receives vessel_daemon_resolve events |
| BusForwardingEventSink (engine lifecycle → bus) | ias-executor-ts adapters; goal-host, dev-vessel, activity-api index | general | live-used | grep |
| BoundedBusSink backpressure | goal-host/boredom/dev-vessel | general-ish (duplicated per vessel instead of in framework) | live-used / duplicate | 3 vessel copies. Framework has a separate `IAS_SUBSCRIBER_MAX_INFLIGHT` cap |
| vessel.registered reactive proxy registration | discovery → goal-host | general | live-used | `vessel.registered` in activity-api types, dev-vessel `vessel-register-passthrough.ts` |
| concept-bridge-observer | dev-vessel `observers/concept-bridge-observer.ts` | specific (hardcoded BRIDGEABLE_SHAPES) | live-used | 592 journal lines/6h |
| registry-change-observer (lifecycle → topology fan-out) | dev-vessel `observers/registry-change-observer.ts` | general pattern | live (but topology outputs rarely traced) | grep. coverage-tick 0 traces since 09-14 |
| Topology measurement: learned-topology-snapshot, reachable-unlearned-report, unknown-shape-report, coverage-tick, substrate-health-tick | dev-vessel seeds/resolvers | general | dormant (satisfier-only use) | trace_digest counts |
| Probe layer: probe-reachable-unlearned, probe-untraversed-edge, escalate-unknown-shape | dev-vessel seeds, boredom goal[3] | general | dormant | 0 traces since 09-14 |
| create-shape-provider-goal (escalation) | activity-api/goal path | general | was live-used (751 in July AET) | old AET |
| ingest-doc-as-concepts, detect-stale-pointer | dev-vessel seeds | specific | dormant / never reached | 0 traces. 05-30 LLM-step abort |
| draft-spec-from-gap | dev-vessel seed | specific | dormant | 0 traces |
| fs_write WRITE_ALLOWLIST scoping | dev-vessel `resolvers/fs-write.ts` | general seam | broken (env-gated, unset → no scoping; inner deny unreachable) | /proc environ 0. Code lines 28-32, 53 |
| Class-3 landed-evidence re-land counting ('pending' on first landing) | dev-vessel `gap-to-feature.ts:~2820` | general | live (a repair of the hollow-close class, motivated by the WRITE_ALLOWLIST case) | code comment |
| detect-service-oom-cascade / service_oom_cascade_scan | dev-vessel | specific detector | dormant | 0 traces |
| phantom_trace_scan / detect-phantom-success-trace | dev-vessel | specific | fossil-ish (motivating number was an artefact) | 16 file hits. No recent traces seen |
| metadata.task_count denormalization | activity-api `execution-traces.ts:1032-1056,2903` | general | live-used | code |
| detect-recurring-pattern / predict-and-verify (obsidian) | dev-vessel seeds | specific | dormant (held out of core loop) | boredom `index.ts:547` |
| detect-recurring-trace-pattern | dev-vessel seed | general | live-low (40 July, 1 since 09-14) | counts |
| obsidian-vessel concept-db sync/writeback/canvas | obsidian-vessel src | specific | dormant/unverified. Superseded by human-surface-vessel | tasks unchecked, systemd units list |
| Advisory Ed25519 vessel identity (H2) | dev-vessel `discovery-registration.ts:15-20` | general | live (advisory only) | grep |
| systemd_restart resolver / restart-attribution | dev-vessel | general | live | grep. Not composed into a drift→redeploy activity |
| Self-replacement pipeline (audit-purity/shadow/promote/archive) | — | general | never built | 0 grep hits. Mitosis cutover is the later analogue |
| PR-based self-deployment (gitOpenPR/gitMergePR) | — | — | never built. Superseded by direct mitosis-cutover landing | 0 grep hits |
| templateId boredom tasks (bypass selector) | minibob boredom.ts (05-24). Now boredom-vessel | specific workaround | fossil pattern (routes around learning) | findings D-002 |

---

## Principles stated in this shard (with location)

- "Emitters broadcast neutrally; consumers register the hooks they need. No event is 'for' a specific
  consumer." (neutral-emitter-lifecycle-bus/proposal.md §Why)
- "Substrate is deployment vocabulary … the caller sees vessels, not topologies." No substrate_id above
  discovery. (vessel-federation/proposal.md §What it adds, §Explicit non-goals)
- "Ship the LOOP, not just the LOG": detection and resolution are activities under Thompson and ribosome,
  gated by four reversibility tiers. Push-away is applied to the substrate's own resolutions.
  (substrate-fleet-federation/proposal.md §Observe, detect, resolve)
- Container-local identity: the private key never leaves the container. Only a trust-roots bundle is
  external. (fleet-federation)
- "Hand-patching … would short-circuit the very signal this proposal is trying to generate." Detect the
  class and let the loop author per-instance fixes. (vessel-resolve-contract-conformance §Out of Scope)
- "A meta that fans out detectors must not be the next entry on the detectors' findings list." Immunity
  pattern: `inputShapes: []`, `variables: []`, deterministic single resolver. (self-audit-meta §1,
  goal-host-oom §Layer 3)
- "Detection arrives after the damage": event-driven detection instead of rotation-stochastic.
  (self-audit-meta §Why)
- Activity-layer authoring self-rolls-back via Thompson β. Code-layer (resolver) authoring does not: a
  no-op resolver accrues α ("phantom success"). So code-layer needs gates, a branch, and attribution.
  (vessel-binary-redeploy §Activity-layer vs code-layer review separation)
- Rollback target is the latest operator-ratified ancestor in a hash-chained manifest list.
  (vessel-binary-redeploy §Rollback discriminator)
- Coverage progress: the Reachable+Unlearned and Unknown cells strictly decrease and Reachable+Learned
  strictly increases over 3 cycles without external goals. "Lift" requires coverage and health, and the
  report was renamed because "convergence" overclaimed. (topology-discovery-loop §Coverage-progress)
- Count-based novelty: redundant successes should saturate (α += 1/(1+n)), with a symmetric pairing of
  failure stratification. (info-gain-bonus)
- Failure credit should go to the step that caused it (`root_cause_step`), not depth-1 ancestors.
  (display-failure-mode-extensions §4)
- Deployment-mechanism changes stay operator-controlled forever (bootstrap and trust-root protection). The
  verifier is itself deployable, anchored to prior versions. (self-deployment §Self-application, §Out of
  scope)
- Replace, don't edit in place: shadow-validate against live traffic, promote on evidence, archive the
  original. (self-replacement-pipeline §Why)
- "The S2 win is not re-deriving Part A … but deriving the next one." (concept-bridge-observer §S1→S2
  evidence value)
- Fix the canonical observability surface, not only the detector ("any client reading task_count faces
  the same artefact"). (list-endpoint §Why fix in activity-api)
- Inert listeners shipped "so the contract is in place" (doc-ingestion Family 1/3, redeploy observer).
  An anti-principle in hindsight: a consumer with no producer is dormant.

## Cross-cutting takeaways for the realignment
1. **Close or archive with an honest status.** 8 of 18 changes here are dead or superseded but still sit
   as open changes. 4 live changes show 0% ticked. tasks.md cannot be used as status. The realignment
   should archive each with a one-line "built / live / dormant / superseded-by" note that someone has
   verified.
2. **The recurring hat in this shard is "the fix landed but the effective behavior did not change":**
   - F26 source edited but the binary never restarted
   - the 93cd621 cache fix "needs restart"
   - the WRITE_ALLOWLIST gate renamed/flipped three times with no effective change
   - concept-bridge "fires" while every write fails

   All are verification at the producer, not at the consumer.
3. **Measurement artefacts propagate into specs.** The 9367-phantoms number (task_count=0 list artefact)
   motivated a detector family, a meta-template proposal, and a constitutional concept.
4. **The keepers from this shard:**
   - the event bus + forwarder + reactive registration (live, general)
   - metadata.task_count
   - concept-bridge (until substrate-authored)
   - the topology measurement vocabulary (general, dormant; worth reviving as walk-floor inputs rather
     than boredom ticks)
   - the class-3 re-land counting
   - the immunity pattern for detectors
   - the code-layer vs activity-layer rollback asymmetry principle
