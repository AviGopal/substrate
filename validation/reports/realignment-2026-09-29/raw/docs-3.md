# docs-3 — shard notes (docs files 47..69 of `find docs -name '*.md' | sort`)

Read-only research, 2026-09-29 (container clocks). Live checks ran against `substrate-live`
(node 1, hub) clones at `/workspace/git/vessels/*` and the read-only SurrealQL helper.
No files other than this one were written.

## Coverage

Read in full or near-full (bodies truncated at ~300-500 chars/line for scanning):
- docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md
- docs/impulse-types/thompson_posterior.md
- docs/learning/FAILURE_MODES.md
- docs/LIVE_DEVELOPMENT.md
- docs/MEMORY_AS_SUBSTRATE.md
- docs/QUALIFICATION.md
- docs/operations/CONFIGURATION_SURFACE.md (sections 1-7)
- docs/operations/FEDERATION_GENRES.md
- docs/README.md (the docs index; nine purposes)
- docs/SCHEMA_OWNERSHIP.md
- docs/self-development/DOC_INGESTION.md
- docs/shapes/README.md
- docs/validation/LEARNING_LOOP_SELFTEST.md
- docs/testing/README.md, docs/testing/QUICK_VERIFICATION_GUIDE.md (first ~150 lines)

Skimmed (headings + head + key sections):
- docs/SUBSTRATE.md (70KB; read topology head + lines 685-940: retention/lease, convergence,
  dynamic vessels, self-sync, landing, dev-vessel specifics, closure properties, forge,
  self-deployment, federation, troubleshooting). Middle (vessel-ctl, keys, iteration loop) skimmed only via headings.
- docs/RBAC_GUIDE.md, docs/RBAC_TROUBLESHOOTING.md (headings + first 40 lines)
- docs/specs/activity-level-executor-hooks.md, auth-token-source-field.md, impulse-write-resolver.md (head "what ships" block + headings)
- docs/SUBSTRATE_NARRATION_PROTOCOL.md (sections A-D)
- docs/SUBSTRATE_PRESENTATION_2026_06.md (design principles, slides 3-5, 8)

Not read: CLAUDE.md/README.md (shard docs-1 owns them), the remaining 60% of the three specs'
design prose (only their "what ships" status blocks were checked against code).

Live checks run (all read-only): grep of 44 doc-promised identifiers across the live clones;
super-repo script existence + invokers; ingest-docs journal (75 runs); gap store
(`/workspace/git/super-repo/gaps/gaps.json`, 6,276 records) topic filters; SurrealDB census of
`execution.failure_mode.type` over the last 24h; `trace_store_counters`; memoryNote store files
and their backups; discovery `/registry/shapes`; `rhythm-cadence` unit.

---

## Findings grouped by problem-class key

### docs-drift

1. **Doc-ingestion reap has been refused for 5 days; 606 stale doc concepts compete for the drafter's top-4 slots.**
   DOC_INGESTION.md promises that stale sections are reaped, with a 25% fraction guard that
   refuses on mass deletion. Live: `ingest-docs.service` (systemd timer, ~6h, earlier ~11 min)
   output on every one of the 75 journaled runs since 2026-09-25 13:44: `docs:80, scanned:1290,
   created:0, updated:10, skipped:1280, reap:"refused", reapCandidates:606, reapLimit:472,
   reapGap:"filed"`. Gap `docs-reap-refused` (category documentation_drift) open since
   2026-09-24T04:59Z: "606 stale doc section(s): over the safety limit of 472 (25% of 1890)".
   The guard designed to prevent a truncated-walk mass deletion now permanently blocks the
   correct reap after a real docs restructure (the doc tree shrank; super-repo clone has 66
   non-archive docs vs 69 on host). The doc itself names this exact trap ("if the restructure is
   large enough to trip the fraction guard, the reap is refused and the stale concept survives
   beside its replacement, both eligible for the drafter's top four"). Nobody runs the
   "supervised reap". Also: `updated:10` on every run means the same 10 sections are
   re-PATCHed each time (never converges; cause not verified — possibly content
   nondeterminism or manifest hash not persisted).
   Classes: docs-drift + memory-recall (information at the right time, law 8) + dormant-mechanism.

2. **24 `docs-drift-docs-*` gaps, all open, zero closed; oldest from 2026-09-18.** Six of them
   are for this shard's docs: SUBSTRATE.md (2 violations), README.md (1), SUBSTRATE_NARRATION_PROTOCOL.md (3),
   shapes/README.md (1), testing/QUICK_VERIFICATION_GUIDE.md (5), testing/README.md (4:
   timelessness, naming_alignment, setup_enablement). The docs-align loop (law 9) files but
   never closes — detection without repair.

3. **LEARNING_LOOP_WRITE_RESOLVERS.md lists `compositionEdge_write` as a live write shape; it is
   neither advertised nor dispatched.** grep of live activity-api: no case; the only hit in the
   fleet is `development-vessel/src/resolvers/orphaned-capability-scan.ts`. shapes/README.md
   says so explicitly ("neither advertised nor dispatched — write composition edges through
   activityComposition_write"). Two docs in the same tree contradict each other. The write-
   resolver doc is also dated ("v1.5.0+ (last reviewed 2026-06-24)", repo-rename note) —
   violates law 9 timelessness. Its example curls `https://activity.metabob.com` — a hardcoded
   endpoint (endpoint-routing).

4. **LEARNING_LOOP_WRITE_RESOLVERS.md states, and the code confirms, that API-key callers run as
   ROOT** — contradicting CLAUDE.md ("Tenant isolation is enforced in the database via
   PERMISSIONS on `$token.org_id` ... Never bypass PERMISSIONS with root credentials"),
   docs/README.md §6 ("bypassing PERMISSIONS with root credentials defeats the whole
   mechanism"), SCHEMA_OWNERSHIP.md ("Bypassing PERMISSIONS with root credentials ... turns a
   tenancy bug into a data leak") and RBAC_GUIDE.md. Live code:
   `activity-api/src/routes/impulses.ts:142`:
   ```ts
   async function executeAsAuth<T>(jwtAuth, sql, params) {
     if (jwtAuth.authType === 'apikey') { return surrealDB.query<T>(sql, params); }  // root
     return queryWithAuth<T>(jwtAuth.jwtToken, sql, params);
   }
   ```
   Every vessel-to-vessel call is API-key authed, so for essentially all substrate traffic
   isolation is application-level `org_id = $orgId` predicates per resolver case — the pattern
   RBAC_GUIDE.md calls "Mistake 1: Application-Level Only". The laws and the implementation
   disagree; no gap found in the store for it (filters `root-cred|executeAsAuth|permissions`: 0).
   Adjacent law-1 violation in the same file: `TEMPLATE_LIFECYCLE_MIN_SAMPLES` /
   `TEMPLATE_LIFECYCLE_MIN_DELTA` read from env at module load (env-gating).

5. **Trace-store naming drift.** SUBSTRATE.md "Trace-store retention" names the trace store
   `activity_execution_traces`. Live: `trace_store_counters` has one row, `table_name:"execution"`,
   `row_count:149,651`, `cap:150,000` (99.8% of cap). `activity_execution_traces` holds 18,135
   rows; its newest `stored_at` is 2026-07-14T23:13:46Z (control: fields are datetimes, a
   sample returns values; `ORDER BY stored_at DESC LIMIT 1` and a `> 2026-09-01` count of 0).
   It is a legacy table no longer written, though an INSERT site remains at
   execution-traces.ts:2824 (dead or unreached code path — not traced). A code comment in execution-traces.ts says the
   `v_paradigm_execution_traces` view "froze or vanished (09-22..09-28), so the listing and every
   detector reading it saw no new traces" — the read path was silently blind for ~6 days
   (trace-store-db, write-read-mismatch).

6. **FAILURE_MODES.md's warning is still true, measured today.** Census of `execution` over the
   last 24h (21,058 rows): `failure_mode.type` null 11,129; `execution_error` 9,790 (NOT a member
   of the six-member union — the dominant type is outside the taxonomy, exactly as the doc
   predicts); `cascading` 138; `verifier_negative` 3; `budget_exhausted`, `safety_breach`,
   `user_abort`, `prediction_disagreement` 0. Of the 138 `cascading`, **138/138 have no
   `upstream_task_id`** (the one field the record exists to carry). Of the 9,790
   `execution_error`, **7,727 are on `success=true` rows** (mislabel; the code comment at
   execution-traces.ts:99-106 records the same class earlier: 6,275 execution_error+status=success,
   430 reached=true+execution_error). So the posterior's outcome-conditional step sizes are
   not consulted for the bulk of failures; `action_no_effect` (the "repair re-runs forever
   without effect" detector) has never been reached. The doc correctly describes itself as "a
   schema, not a census"; the defect is on the emitter side and has no closing gap
   (gap `reach-gap-failure-mode-summary` open).

7. **LIVE_DEVELOPMENT.md "Boredom cadence" says no rhythm shape is advertised and no selector
   consumes one; QUALIFICATION.md says qualification cadence lives in a `timeShapedRhythm`
   impulse read by the rhythm conductor, "never by a host timer".** Both are partly wrong:
   `timeShapedRhythm` exists in development-vessel (`rhythm-conductor-tick.ts`,
   `rhythm-reality-sync.ts`, `compute-state-signature.ts`) and boredom-vessel reads it; discovery
   advertises `rhythm_conductor_tick` / `rhythm_reality_sync` but NOT `timeShapedRhythm`. And the
   conductor itself is driven by a host systemd timer: `rhythm-cadence.timer` (15 min) runs
   `scripts/substrate/rhythm-seed-tick.ts` then `rhythm-conduct-tick.ts`. 46-49 systemd timers
   exist in the container. Law 5 (pace is a rhythm, not a throttle) is implemented as "a timer
   that runs the rhythm". Open gaps: `rhythm-cadence-registry_empty`,
   `rhythm-reality-sync-rewrites-the-whole-rhythm-body-from-a-stale-read-...` (x2, one likely a
   narrowed dup).

8. **SUBSTRATE.md promises a closure/self-deployment apparatus that does not exist in code.**
   Promised: `operatorIntervention`, `interventionRateReport` shapes; `memory-sync-tick`;
   `propose-spec` / `verify-merge-candidate` / `apply-spec` pipeline; `ciAgreementReport`;
   `restart-vessel` / `restore-data` activities; a "Forge vessel (parallel variant
   exploration)" spawning N ephemeral substrate clones; "three consecutive nightly green
   closure-audit runs are a hard lift gate". Live grep (all vessels, src, non-test):
   `operatorIntervention` NONE, `interventionRateReport` NONE, `memory-sync-tick` NONE,
   `verify-merge-candidate` NONE, `ciAgreementReport` NONE, `restart-vessel` NONE, no forge
   vessel (only concept-db hits for the word "forge"); `propose-spec` appears only as a string
   in memory-note.ts. `interventionRefused` DOES exist (dev-vessel config/routes,
   intervention-evaluate.ts) and is advertised. `validation/scripts/closure-audit.ts` exists
   (last commit 86186cb4, 2026-05-27) but nothing invokes it (no unit, timer, Makefile, hook, or
   vessel reference) — so the "hard lift gate" has no call site. These sections are aspirational
   prose stated in present tense.

9. **MEMORY_AS_SUBSTRATE.md: store location and content diverge from the doc.** Doc: store is
   `WORKSPACE_ROOT/memory/notes.json`. Live: dev-vessel unit has `WORKSPACE_ROOT=/workspace`,
   but the file being written is `/workspace/git/super-repo/memory/notes.json` (59 notes,
   created 2026-09-26T05:12Z..2026-09-29T03:34Z) while `/workspace/memory/notes.json` (680 notes,
   2026-05-27..2026-07-23, mtime Sep 7) is orphaned. See memory-recall below for the loss.
   Gap `docs-drift-docs-MEMORY-AS-SUBSTRATE-md` is open. The closure-audit verification the doc
   points to (`closure-audit.ts --without=operator-memory`) is uninvoked (item 8).

10. **SUBSTRATE_PRESENTATION_2026_06.md** (dated filename/title — law 9) makes claims the running
    system has refuted: "capacity grows monotonically ... by construction", "convergence is a
    mathematical consequence of well-posed primitives, not a hope", "The runtime is LLM-free
    under the endgame". The doc is indexed under purpose 7 and ingested as a `docSection`
    concept, i.e. recalled as a standing claim. It is a pitch, not an expectation; it should be
    archived out of the ingest walk.

11. **testing/README.md** is dated ("Primary Validation Harnesses (2026-05-27)", "metabob-devbob
    system", "Add to CI/CD pipeline", "Canary / production deployment") — pre-substrate vocabulary;
    4 open drift violations. QUICK_VERIFICATION_GUIDE.md recommends running `bun test` in
    vessel repos as a pre-push smoke — which the operator memory records as mutating live state
    (test-residue-live-state) — and `bun run dev &` of activity-api on :8080 on the host.

12. **SCHEMA_OWNERSHIP.md** is accurate on structure, but names `repos/deployment/.../metabob-proto`
    core layer and `sql/migrate.ts` as reference-only fossils (honest). It states "Tenant isolation
    is a property of the table" — contradicted by item 4 for API-key traffic.

13. **FEDERATION_GENRES.md** self-reports a drift: `SELF_MIRROR` startup log says "hub mirror
    disabled" while `registerAtHub` still registers per-vessel rows
    (`scripts/substrate/federation-relay/federation-transport-server.ts:928-1011`, confirmed). Also
    only 2 of 6 declarable `distribution_policy` values steer any pick (doc is honest about it):
    `unique_target`, `interchangeable`, `stateless`, `stateful_data_owner_merge` are declarable but
    behaviourally inert.

14. **Spec docs with honest "what ships" headers (good pattern, keep):**
    - activity-level-executor-hooks.md: `LifecycleSubscriberVessel` live in
      ias-executor-ts; ranked dispatch deferred — `HIGH_FREQUENCY_TOP_K` / `defaultTopKForShape`
      exported, no consumer (confirmed: only defining file + dist .d.ts).
    - auth-token-source-field.md: `auth_token_source` declared by 5 vessels + discovery registry;
      delegation headers `X-Metabob-Delegation-*` emitted/read by nobody (confirmed NONE).
    - impulse-write-resolver.md: concept-db's 7 write shapes present (confirmed
      `conceptCreditDecontaminate_write` in config/routes/resolver).
    - thompson_posterior.md: "Design directions, not behaviour" block (confidence-weighted
      observations, cost-weighted selection, per-model sub-resolvers) explicitly not implemented.
    These are the model for timeless docs: state what ships vs. what is design, and name the
    missing consumer.

### memory-recall

- **1,729 memory notes lost between 2026-09-23 and 2026-09-26.** Backups in
  `/workspace/git/super-repo/memory/`: `notes.json.pre-merge.1790118911018.bak` = 1,077 notes
  (2026-09-22T23:15Z), `pre-residue-cleanup.1790138390.bak` = 1,780 (09-23T04:39Z),
  `pre-op-retire.1790140094.bak` = 1,788 (09-23T05:08Z). Current `notes.json` = 59 notes, the
  earliest created 2026-09-26T05:12Z. The 09-22 fix "two memory stores merged at file level"
  (operator memory index) therefore did not hold: by 09-26 the store had been rewritten to a
  fresh array. Cause not verified in this shard (candidates: the 09-23 substrate-live
  destruction by `make -n`, a retire/cleanup op overwriting, or a writer that initialises an
  empty store when the read fails). The super-repo commit 44ab5fd4 (2026-09-28) independently
  observed "the system's memory holds nothing before 09-26". The store is gitignored
  (`.gitignore:239:/memory/`), lives in the super-repo clone, and is not what the doc names —
  a recurrence of the 09-22 split wearing a different hat.
- Doc ingestion (the other system-memory channel, law 8) is stalled by the reap refusal
  (docs-drift item 1): stale architecture sections keep being recalled into drafter prompts.
- MEMORY_AS_SUBSTRATE.md itself correctly states the teaching law: memoryNote teaches only the
  operator; drafter lessons belong in concept-db. The session-start/mirror/end hooks exist
  (`.claude/hooks/substrate-*.sh`, last commits 06-15..09-22).

### false-verification

- QUALIFICATION.md's "Repair" leg requires post-land verification to execute and names the gap
  class `autonomous-landings-are-never-post-verified` "while open". No gap with that id or any
  `post-verif|post-land` id exists in the store (0 hits), while operator memory records the
  post-land suite dead 2026-08-31..2026-09-28 (fixed 5e9a0b2). The doc points to a gap that
  does not exist, so nothing tracks the standing dependency.
- CONFIGURATION_SURFACE.md §6 records three ways its own probe lied before being trusted (zero
  names from swallowed `mounts denied`; counting its own abstentions as 10 false positives;
  executing the image's gen-env while grepping the worktree's). General law: "when a check reads
  one artifact and exercises another, its findings describe the gap between them, not the system."
- LEARNING_LOOP_SELFTEST.md defines the controls (observe-mode must move nothing; a severed link
  must turn exactly its assertion red). Live: `gate_self_probe`, `emit_shape` resolvers exist
  (dev-vessel), `reach_graded` marker written in activity-api execution-traces.ts. Whether the
  selftest runs as a seed-tier activity on rotation was not verified here.

### dormant-mechanism

- `closure-audit.ts` (2026-05-27), `substrate-narrator.ts` (2026-05-23), `validation/gaps/`
  (last record 2026-05-24; INDEX.md f5429063) — the Narration Protocol's whole apparatus — have
  no invoker. The protocol doc (SUBSTRATE_NARRATION_PROTOCOL.md) is still indexed as live
  methodology and points to `openspec/changes/2026-05-23-intervention-tracking/`. Fossil; the
  substrate gap store (`gaps.json`, 6,276 records) superseded `validation/gaps/`.
- `import-operator-memory.ts` (2026-08-21): no invoker; manual-only.
- `config-surface-probe.sh` (2026-09-23): referenced only by the Makefile; not an activity
  (script retention rule says it should be validated by an activity).
- `stratified-harness.ts` referenced by dev-vessel `substrate-health-tick.ts`;
  `failure-mode-harness.ts` by `harness-check-scenario.ts` and `docs-align-scan.ts` — referenced,
  but execution/completion NOT verified here (status unknown, not "live").

Not checked in this shard: compose2-live (node 2); ~60% of the three specs' design prose;
SUBSTRATE.md middle sections (vessel-ctl, keys, iteration loop) by heading only; cause of the
ingest `updated:10` flapping; cause of the memory-store loss.
- `HIGH_FREQUENCY_TOP_K` etc. (ranked lifecycle dispatch) — exported, unconsumed.
- `X-Metabob-Delegation-*` — spec'd, never built.
- 4 of 6 `distribution_policy` values — declarable, inert.
- The whole `prediction_disagreement` failure member (3 sub-cases) — schema + step sizes +
  dev-vessel seeds `predict-and-verify.ts` / `refine-on-disagreement.ts` exist, 0 rows in 24h.

### env-gating

- CONFIGURATION_SURFACE.md measured: 52 names in unit `Environment=` lines, 48 unique to that
  channel (e.g. `SURGICAL_SCAN_CAP`, `TASK_GENERATION_ENABLED`, `OPERATOR_GOAL_GEN`,
  `EMIT_GAPS`, `RECOVER_CAP`, `OBSIDIAN_LEARN_MODE`); ~451 distinct env names read across
  vessels; 34 drop-ins, 10 carrying Environment= including "boredom pacing overrides of
  240x-300x the in-code default"; "the size of the config surface is a direct measure of
  unfinished shaping". TRACE_STORE_* retention is env (open gap
  `trace-persistence-and-retention-are-steered-by-environment-variables-...` + its `-narrowed`
  twin). `TEMPLATE_LIFECYCLE_MIN_*` env in activity-api impulses.ts. Counter-example to follow:
  `THOMPSON_DECAY_HALFLIFE_DAYS` read at use time from `substrate_tuning_param` with no env
  fallback (confirmed `resolveThompsonDecayHalfLifeDays` in activity-api posterior-update.ts).

### endpoint-routing

- CONFIGURATION_SURFACE.md §5 "default drift": `SURREALDB_URL` 5 distinct defaults,
  `SURREALDB_PASSWORD` 4 (`changeme` vs `root`), `DISCOVERY_ENDPOINT` 4, `ACTIVITY_API_ENDPOINT` 4,
  `GOAL_HOST_VESSEL_ENDPOINT` `:8210` x12 and `:8090` x1, `FED_HEALTH_PORT` 8401 vs 8402; 11 aliases
  for the API key (fallbacks dead in-container); port collision metric-collector 8280 vs
  light-dispatch; one weak literal `dev-secret-change-in-production` for JWT_SECRET and
  API_KEY_SECRET across five identity-vessel files.
- A persisted routing anchor once "pinned the fleet to a decommissioned host and held the
  federation transport in a permanent crash loop" (now excluded from `.substrate-secrets`).
- LEARNING_LOOP_WRITE_RESOLVERS.md / thompson_posterior.md examples use hardcoded
  `activity.metabob.com` / `$METABOB_ENDPOINT` + REST paths.

### trace-store-db

- Trace store at 149,651 / 150,000 cap (`trace_store_counters:execution`,
  last_reconciled_at 2026-09-29T03:44Z). 21,058 execution rows in 24h. Reconcile is a
  copy-forward table swap with no automatic rollback; guarded by `maintenanceLease`
  (confirmed: dev-vessel `maintenance-lease.ts`, activity-api `db-admin-reconcile.ts`).
- `v_paradigm_execution_traces` view "froze or vanished (09-22..09-28)" per the code comment —
  detectors reading the view were blind; fixed by reading `execution` directly.

### federation-p2p

- FEDERATION_GENRES.md: withdrawal diff on each mirror tick; transient under partial registry
  repopulation withdraws not-yet-re-registered rows ("bounded and self-healing, but a peer
  querying inside it sees fewer producers than exist"). Transport that mirrors nothing still
  answers `/health` (failure loud only in journal). Identity-secret namespace rule: same secret =
  replica; different = foreign namespace.

### sync-deploy-drift

- SUBSTRATE.md / CONFIGURATION_SURFACE.md: `/etc/systemd/system/**` live fixes are stopgaps;
  unit property must live in one file (unit or drop-in, never both — drop-in silently wins or
  doubles lists). pull-sync every 10 min, health-gated restart, reverts to
  `/workspace/.last-good/<v>` and files a gap. "How long an in-container edit lasts — three
  classes, one appearance" (SUBSTRATE.md §Iteration loop). `/vessels` is the image layer;
  hot-reload is an escape hatch, not a delivery path.
- LIVE_DEVELOPMENT.md notes ribosome-vessel's module docblock still describes a retired
  `POST /v2/impulses/resolve` route (code comment drift).

### selection-learning

- thompson_posterior.md: decay half-life 3 days default, applied on write (SQL) and on the
  selection read; `thompson_posterior` reads `context_thompson_scores` (alpha/beta) or
  `variant_performance_metrics` (thompson_alpha/thompson_beta — two names for one concept, per
  operator memory); no per-signature posterior table (reports `signatures_aggregated`).
- FAILURE_MODES.md: reach gate (`classifyReach`, 4 verdicts: reached / not-reached / ungraded /
  legacy-success) overrides exit status; ungraded = {0,0}; deterministic-tier-only traces skip
  per-variant update; TD(λ=0.7) chain credit to ≤4 ancestors; sibling fan-out divides delta.
  Graded-yield success y∈[0.5,1] from cost (costRef $0.02) and productivity (prodRef 4 outputs).
  Confirmed `classifyReach` in activity-api reach-classify.ts, used by posterior-update,
  ribosome route, grouped-execution-stats, goal-host, ribosome-vessel.
- But (item docs-drift 6): the failure-mode input to computeDeltas is mostly null or
  out-of-union, so differentiated penalties are largely unused.

### codebase-bloat-fossils

- Shard docs that are fossils or should leave the ingest walk: SUBSTRATE_PRESENTATION_2026_06.md
  (pitch deck), SUBSTRATE_NARRATION_PROTOCOL.md (apparatus unused since 05-24), testing/README.md
  (pre-substrate vocabulary), SUBSTRATE.md §Closure properties / §Forge / §Self-deployment
  (unbuilt). RBAC_TROUBLESHOOTING.md mentions "Check Pod Logs" (Kubernetes-era).
- Legacy tables: `activity_execution_traces` (18,135 rows, last write 2026-07-14; an INSERT site remains),
  `minibob_instance` tombstone, `activity_template` compatibility view, `v_paradigm_*` views
  (one froze), `repos/deployment/.../metabob-proto` core layer.
- REST duplicates kept "for backward compatibility": `GET /v2/activities/:id/variant-scores`
  beside `thompson_posterior`; every `*_write` shape delegates to a REST handler; 5 retired
  analysis shapes answer 410 in activity-api.

### gap-content / narrowing-duplicates

- `-narrowed` twins observed while scanning: `trace-persistence-...-prunes` +
  `...-prunes-narrowed`; `a-substrate-authored-block-in-the-compose-lesson-writer-forges-
  operator-approved-true...` closed + `...-nar(rowed)` open; two identical-prefix
  `rhythm-reality-sync-rewrites-...` open. Three `novel-failure-development-vessel:mitosis-tick|cascading-<ts>`
  gaps filed within 12 s (1790640825221, ...826789, ...836989) — timestamp-keyed ids defeat dedup.
- LEARNING_LOOP_SELFTEST.md principle: a red assertion files a gap "carrying a falsifier (edit
  site + expected literal, or an evidence-resolve predicate)"; "falsifier anchors are immutable
  once filed".

---

## Mechanisms (promised by shard docs) and live status

| Mechanism | Location | General/specific | Status (evidence) |
|---|---|---|---|
| `*_write` learning-loop write resolvers (20) | activity-api routes/impulses.ts | general (shared seam) | live-used; `compositionEdge_write` listed but absent |
| `executeAsAuth` root fallback for API-key auth | activity-api routes/impulses.ts:142 | general | live-used; contradicts PERMISSIONS law |
| `thompson_posterior` shape | activity-api | general | live (advertised in registry) |
| Posterior time decay via `substrate_tuning_param` | activity-api lib/posterior-update.ts | general | live; model of law-1 compliance |
| FailureModeSchema + computeDeltas | activity-api models/schemas.ts, lib/posterior-update.ts | general | schema live; emitters mostly bypass it (census) |
| `classifyReach` reach gate | activity-api lib/reach-classify.ts | general | live-used by 6 call sites |
| TD(λ) chain credit + fan-out division | activity-api posterior-update | general | present (not measured here) |
| LifecycleSubscriberVessel (5 lifecycle shapes) | ias-executor-ts lifecycle-subscriber.ts | general | live; ranked dispatch dormant |
| `auth_token_source` field | discovery registry + 5 vessels | general | live-declared; delegation unbuilt |
| concept-db write shapes (7) | concept-db config/routes | general | live |
| shape-dispatch-check | packages/shape-dispatch-check/check.ts (2026-05-17); concept-db scripts/check-shape-dispatch.ts | general | exists; wired in concept-db; dev-vessel references it in mitosis/scaffold; fleet-wide lint wiring not verified |
| `distribution_policy` genres | discovery registry/resolvers; goal-host satisfier-pick.ts | general | live; only 2/6 values steer |
| SELF_MIRROR + per-vessel `@substrate` mirror | scripts/substrate/federation-relay/federation-transport-server.ts | general | live; misleading log line |
| Doc ingestion (`ingest-docs-as-concepts.ts` → concept-db; `consultPrinciples` top-4) | scripts/substrate + dev-vessel feature-compose.ts | general | runs on systemd timer; reap refused 75/75 runs; 606 stale concepts |
| memoryNote store + 3 harness hooks | dev-vessel resolvers/memory-note.ts; .claude/hooks | general | live but store reset to 59 notes (1,788 on 09-23) |
| `maintenanceLease` + `trace_store_counters` + `reconcile_trace_store` + `trace_store_health_observer` | dev-vessel + activity-api | general | live-used (counter at 149,651/150,000) |
| rhythm conductor (`timeShapedRhythm`, `rhythmFamilyGoal`) | dev-vessel rhythm-conductor-tick.ts; boredom | general | live but driven by `rhythm-cadence.timer`; shape not advertised |
| qualification oracles `verified-compute-answer`, `verified-gap-total` | goal-host-vessel src/index.ts | specific | present |
| `gate_self_probe`, `emit_shape`, `reach_graded` (selftest kit) | dev-vessel, activity-api | general | present |
| `interventionRefused` shape | dev-vessel | specific | live-advertised |
| `operatorIntervention`, `interventionRateReport`, `memory-sync-tick`, `verify-merge-candidate`, `ciAgreementReport`, `restart-vessel`, forge vessel | SUBSTRATE.md promises | — | absent (fossil prose) |
| closure-audit.ts | validation/scripts | specific | exists, uninvoked (fossil) |
| substrate-narrator.ts + validation/gaps | validation/ | specific | fossil since 05-24; superseded by gaps.json |
| import-operator-memory.ts | scripts/substrate | specific | manual-only |
| config-surface-probe.sh | scripts/substrate | specific | Makefile-only, not activity-validated |
| failure-mode-harness.ts / stratified-harness.ts | validation/scripts | specific | referenced by dev-vessel seeds (live) |
| packages/test-helpers (`spawnVessel`) | packages/ | general | exists (2026-09-07) |
| vessel-ctl (install/sync/restart, activity-dispatchable) | image /usr/local/bin | general | documented live (not re-verified) |
| substrate-status 5-level readiness | image | general | documented (not re-verified) |

---

## Principles (end goal and design laws stated in this shard)

- End goal (docs/README.md): every doc under docs/ is "an expectation the substrate holds about
  itself", a runtime input ingested into concept-db and read at drafting time; nine
  architectural purposes (ontology, execution/walk, learning from traces, self-development,
  topology/federation, identity/trust, interface, operations/bootstrap, gap management).
- Four primitives only — impulse, pointer, resolver, vessel; a shape is a routing-and-reasoning
  key, never a schema; a fifth primitive or a rename is drift (docs/README.md §1).
- The judged quantity is `reached`, not exit status; credit follows the reach verdict and
  ungraded outcomes are skipped (README §2-3; FAILURE_MODES.md).
- A document no reader consumes is an archive; name the reader; headings under
  docs/architecture/ are a frozen interface (DOC_INGESTION.md).
- A schema defines what may be recorded, it does not cause recording — check the census before
  reasoning from a taxonomy; a zero is not a zero until a positive control shows the query can
  return non-zero (FAILURE_MODES.md).
- A warning collected into a structure the caller discards is observed by nobody — find its
  reader (FAILURE_MODES.md).
- Behavioural values must be read at use time with no env fallback (thompson_posterior.md,
  decay half-life); config is the one region with no learning loop; the size of the config
  surface measures unfinished shaping (CONFIGURATION_SURFACE.md).
- A probe that cannot run must say so, never produce a number; when a check reads one artifact
  and exercises another, its findings describe the gap between them (CONFIGURATION_SURFACE.md §6).
- A check nothing invokes cannot be trusted when it passes (CONFIGURATION_SURFACE.md §7;
  mirrors CLAUDE.md script retention).
- Qualification = correctness by deterministic verdict source (LLM-judged green does not
  count), delivery, containment, repair with executed post-land verification; a landing whose
  post-land suite did not run is an activation, not a repair; any operator hand disqualifies
  the cycle (QUALIFICATION.md).
- Reuse without adaptation is memorization; adaptation without reuse means nothing was learned
  (QUALIFICATION.md).
- Selftest = dispatched intervention with known ground truth, assertions at the consuming
  layer, controls mandatory, isolation by attribution not environment, falsifier anchors
  immutable (LEARNING_LOOP_SELFTEST.md).
- The pool grades what it selects; a timer fires forever regardless of outcome, so timer-plane
  work cannot be learned away (SUBSTRATE.md dev-vessel specifics).
- Memory about the system belongs to the system; operator files are a derived cache; memoryNote
  teaches the operator, concept-db teaches the drafter (MEMORY_AS_SUBSTRATE.md).
- Single table owner; read across, write through the owner's resolver; owner migrates and owns
  PERMISSIONS; never hand-edit a live DB (SCHEMA_OWNERSHIP.md).
- The producer declares how its duplicates are treated (distribution_policy); identity secret
  defines the namespace boundary (FEDERATION_GENRES.md).
- Advertise and dispatch together, checked by tooling; a shape never resolved by a walk is a
  declaration, not a capability; prefer a new shape over a rename (shapes/README.md).
- `origin/dev` is the only code channel; pushing is deployment; host docker-cp is not a
  delivery path (SUBSTRATE.md).
- Honest "what ships / what is design" headers on specs (activity-level-executor-hooks.md,
  auth-token-source-field.md, impulse-write-resolver.md, thompson_posterior.md).
- The substrate cannot self-declare S3; push-away (refusal with cited evidence) is the signal
  (SUBSTRATE.md).
