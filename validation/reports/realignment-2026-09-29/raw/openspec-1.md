# openspec-1 — raw notes (realignment 2026-09-29)

Shard: the first 18 entries of `ls openspec/changes | grep -v '^archive$'` (all 18 are dated 2026-04-26 .. 2026-05-23 change directories; **no stray .json/.ts files fall in this shard** — the strays sort after the dated entries: e.g. `add-goal-summary-resolver*.json`, `config-patch.json`, `delete-old-http-response*.json`, `fix-http-response-resolver.{ts,js,d.ts,*.map}`, `gap-msvqgv4y-*.json` belong to later shards), plus `openspec/specs/*` (3 capabilities).
Totals for context: `openspec/changes` has 176 entries, archive has 4. `openspec/specs` has only 3 capabilities (the older specs subtree was retired by `3b5035d7` 2026-08-02 "retire 31 change proposals and the frozen 2026-03 subtrees"; the 3 current ones added `a9b7a913` 2026-09-24).

Live checks done (read-only): vessel clones in `substrate-live:/workspace/git/vessels`, SurrealDB via q.sh, `validation/state/*.json`.

## Per-entry table

| # | Change | Tasks done/open | Last touched | Problem addressed | Built? Live now? |
|---|---|---|---|---|---|
| 1 | 2026-04-26-impulse-activity-loop (IAL) | 416/105 | f42ad044 2026-06-24 | Integration spec: goal → bind → execute → validate → escalate, with Thompson learning; defines lift (S1→S2) | Umbrella; phases 1–27. Lift declared 2026-05-26 in `validation/state/lift-status.json` (see below). Many phases superseded by explicit-vessels/goal-host. Tasks frozen since June. |
| 2 | 2026-04-26-security-hardening-findings | 2/65 | 63619f9f 2026-07-04 | Trust surface: H1 two-sided traces, H2 pubkey vessel-id, H3 scope attestations, H4 Tailnet-lock, H5 immutable baselines, CC1/CC2 | Only S1/S2 (advisory pubkey identity) landed 2026-07-04; live: `discovery-vessel/src/registry.ts:259 identity_status`. H1/H3/H4/H5 never built. |
| 3 | 2026-04-29-surrealdb-rl-layer | 23/15 | 4a21f592 2026-05-18 | Lost α/β updates (fetch-modify-write at 4 sites), 21-query discover-by-shapes, BM25 bound-param bug, O(n) dense scan | P1 atomic, P2 COMPUTED ev, P3 `fn::beta_sample` (live: DEFINE FUNCTION present; used in `activity-api/src/routes/activities.ts`), P5A BM25 fix done. P4 RELATE `composes` never built (no table). HNSW dropped by migration 110 (CPU storm F-V31). |
| 4 | 2026-05-17-shape-dispatch-agreement | 21/5 | a5c4817f 2026-05-18 | Advertised shapes vs `case` handlers diverge silently → β drift on callers | Static check live: `scripts/check-shape-dispatch.ts` in activity-api, concept-db, development-vessel lint. Runtime self-trace (3.3) never built; discovery/identity-vessel blocked. |
| 5 | 2026-05-17-state-space-signature-thompson-keying | 28/17 | 7b5d6928 2026-05-19 | Posteriors aggregate across heterogeneous contexts (identity memorised, not behaviour) | v1 signature + conditional read/write built; live: 29,178 `context_thompson_scores` rows, 9,809 with signature_version=1; many later consumers (signature-cluster-tick, cluster-posterior, embedding-prior-trainer). S2–S6 acceptance never measured; v0 reaper/cleanup (8.x) never done. |
| 6 | 2026-05-18-chain-credit-ancestor-signature-fix | 12/4 | 3a82cb25 2026-05-18 | Chain credit wrote every ancestor under the leaf's context bucket | Fix landed preventively; audit script (4.3) deferred. Subsumed by #5. |
| 7 | 2026-05-18-forge-goal-completion-test | 22/5 | 6db4c98e 2026-05-21 | Forge only tested standalone, never via a real goal's slot-binding escalation | Runner written; T8.1 "3 consecutive weekly passes" never met. Forge path itself later found broken (audit Finding 20: goal-host-vessel never registered forge resolvers; still no `VesselForgeHost` in goal-host-vessel/src today). Dormant. |
| 8 | 2026-05-18-test-audit-loop | 10/25 | f4d7cbed 2026-05-20 | Tests report pass/fail taken at face value; no audit of test sensitivity/alignment | Only registration/contract parts; audit/sensitivity/debug activities not built (no `audit-test-report` in any src). Dormant; the same concern reappears in Sept as "falsifier-none", "count ran=false", "a check that is never observed failing". |
| 9 | 2026-05-19-ias-executor-as-canonical-host | 35/19 | 00d00ff6 2026-05-21 | minibob god-object (7,932-line activity.ts, 80 embedded templates) violated layering | Superseded/achieved by #17: minibob is gone from `repos/` and `.gitmodules`; GoalHost in `ias-executor-ts/src/hosts/`. Parity gates S.1–S.5 never measured. |
| 10 | 2026-05-21-development-vessel | 73/6 | 0e162ff8 2026-05-23 | No vessel whose job is to manage vessels; ship-change as example file | Live and central (feature_compose, gap store, memoryNote). Cleanup tasks 8.1–8.4 (remove example ship-change files) open. |
| 11 | 2026-05-22-failure-mode-autonomous-loop | 19/2 | 5bd37061 2026-05-23 | Failure-mode harness 6/6 gaps; nothing drafts closing activities | `draft-gap-closing-activity` seed built and STILL RUNNING: 530 traces 2026-09-21..28, **457 failure / 73 success (86% failure)**, plus a timestamp-suffixed duplicate `draft-gap-closing-activity-1783049075304` (183 runs). Produced hollow/hallucinated templates in May (audit F10/F11/F13/F15/F24). |
| 12 | 2026-05-23-cost-weighted-posteriors | 0/26 | c9af28f9 2026-05-23 | Selection ignores cost; local substrate cost = LLM spend | Never built. Superseded by later `value-per-cost-selection` change (2026-09-20). Precondition (cost recorded on traces) still false: 18,135 traces since 2026-09-27 have `sum(cost_usd)=0` and zero rows with `tokens_input>0`. |
| 13 | 2026-05-23-harness-as-lifecycle-participant | 24/1 | 59b3534b 2026-05-23 | Harness was an external script; no trace, no impulse, no learning | Built (harness-run-matrix template, lifecycle observer). Became part of lift evidence. Measurement-of-harness quality not revisited. |
| 14 | 2026-05-23-intervention-tracking | 0/43 | 3f4f5019 2026-05-23 | S3 measure (`operatorIntervention`, `interventionRefused`) had no owner/emitter | Tasks all open, but code later appeared: `development-vessel/src/resolvers/intervention-evaluate.ts`, shapes in `development-vessel/src/config.ts`. Tasks.md never updated → doc drift. Whether it emits in practice not verified. |
| 15 | 2026-05-23-llm-resolver-model-mab | 0/33 | c9af28f9 2026-05-23 | Hardcoded Sonnet for every LLM resolver; no model selection learning | Never built (no `llmProviderConfig`/`model-mab` in any src). Dormant proposal. |
| 16 | 2026-05-23-single-container-substrate | 19/17 | 51c1a74c 2026-05-23 | Canary K8s suspended; cross-boundary trust blockers months away | Live: `substrate-live` container is exactly this. tasks.md stale (4.x, 5.x, 6.x unchecked though done/superseded; minibob listed as a unit). |
| 17 | 2026-05-23-substrate-explicit-vessels | 48/5 | f42ad044 2026-06-24 | Implicit vessels (minibob executor, Thompson) bypass the impulse model | Live: VesselDaemon toolkit, goal-host/llm-resolver/local-tools/ribosome/boredom vessels. `findings/audit.md` (812 lines, 24 findings, 2026-05-27..30) is the richest failure record in this shard. |
| 18 | 2026-05-23-substrate-identity-resolution | 0/50 | 4b7ce0e8 2026-05-23 | Hardcoded canary endpoints (`identity.metabob.com`, k8s DNS) as defaults; identity by env discipline | Never built (no `substrateIdentity` / `VESSEL_BOOTSTRAP_KEY` in src). Env-gating class stays open. |

## openspec/specs (the only "current truth" specs)

- `change-window-names` — named maintenance lease (`trace_store` vs `cutover`) so a reconcile hold does not refuse landings. Problem: reconcile lease blocked cutovers (write lock at a shared seam). Live (per 09-24 archive).
- `parked-landing` — verified patch parked before cutover (`/workspace/parked-landings/<gap_id>.json`), resumed instead of redrafted; `discardedLandingReport` sweep counts FAVORABLE-but-not-pushed composes, opens `discarded-landings-<date>` gap. Live: `development-vessel/src/resolvers/feature-compose.ts`, `services/gap-drain-observer.ts:349`. General capability at the landing seam.
- `restart-budgets` — drain deadline derived from cutover stage, `/health.in_flight_oldest_ms`, pull-sync defers by age not count. Problem: restarts killed in-flight landings (sync-deploy-drift). Implementation grep for `in_flight_oldest_ms` in vessel src returned nothing in the one pattern I tried — mark UNVERIFIED (may live in scripts/substrate or use a different name).

---

## Findings by problem class

### hollow-landing / false-verification (the dominant recurring class)

- **2026-05-26 lift was declared on gamed / weak evidence.** `validation/state/lift-status.json` (as_of 2026-05-26T16:40Z) records `coverage_criterion.method: "operator-judgment"`; the strict criterion (3 consecutive natural coverageReports) had ONE natural fire (`exec_ckg0w923`); three earlier-cited executions were operator-dispatched probes and had to be withdrawn (investigation-029 F-096); "substrate self-approved before criteria were met at 07:23Z". `findings/dev.md` D-IAL-003 (2026-05-24) is an operator hand-scheduling template runs 1 h apart so `rl` windows would be strictly increasing — i.e. engineering the metric (`coverage_progress`) rather than the capability. Outcome: lift = **failed as a measurement** (metric gamed); CLAUDE.md law "a high reach rate on trivial goals is a gamed metric" is the later restatement of the same lesson.
- **Closure audit 6/6 green 2026-05-25** (`findings/validation-2026-05-25.md`) → `validation/state/closure-status.json` last run 2026-09-07 reports `all_closed: false`. Claimed closed, later open.
- **Audit F13 (2026-05-28, CRITICAL)**: exec_a2qzc2sr — 8/8 tasks `success`, execution `success`, every output id `err_*`. Silent success across error-marked impulses (proxy-catch). Same class as Sept MEMORY "hollow_write", "count ran=false", "a silent skip reads as a pass".
- **Audit F24 (2026-05-30, CRITICAL)**: `draft-spec-from-gap` exec_151uni4h/exec_ftzw0hvl success with 6/10 `:err_` outputs and `filesCreated: []`; α=2,β=1 for spec-authoring with zero artifacts; `create-shape-provider-goal` at α=743 over 608 dispatches. Cause includes a hardcoded `/workspace/openspec/changes/...` path not present on the RW mount. Three stacked layers blind to the same failure (task F13 → execution F19 → posterior F24).
- **Audit F9 (2026-05-28)**: autonomous promoter audit row `decision: promote` while live row still `proposed=true` — audit-trail/live-state divergence (write succeeded on the log, failed on the state).
- **Audit F10 (2026-05-28)**: `CreateTemplateRequestSchema` `proposed: z.boolean().default(false)` bypasses the proposed-first discipline (commit 87ab8d18) → substrate-authored templates selection-visible immediately. **Still `default(false)` today** at `activity-api/src/models/schemas.ts:253` (not verified whether overridden downstream).
- **Validation 2026-05-25 F3 update**: dev fix `14e23e95` (boredom dispatch by `templateId`) made executions succeed (199 runs) but `total_selections: 0`, α/β 1/1 — "the problem has migrated, not been solved": execution green, learning dead. Recurs 2026-09-25 (MEMORY: "in-process picks bypass masks ⇒ autonomous_pick lease").
- IAL 8.4 (2026-05-09): `failure_mode` null on ALL 100 sampled traces including failures. Today: 1,219 of 4,764 failure traces since 2026-09-27 carry a non-null failure_mode (~26%) — still mostly unattributed 4.5 months later.
- `findings/dev.md` D-IAL-004 (2026-05-24): Thompson frozen, `total_selections=0`, composition_chain empty (F-037/F-038).
- `validation-2026-05-25.md` F-thompson-normalize: `applyOutcomeToPosteriors` WHERE on un-normalized `activity:⟨…⟩` id never matched → α/β never moved (fixed `b972fd2`). Class: write-read-mismatch (id-format at a seam).
- Audit F14 (2026-05-28): the auditor's own jq regex (`gap-closing:fm-`) dropped `fp-*` templates → auditor hallucinated "0 templates produced" (Finding 12). Discipline adopted: always emit `total_pre_filter` next to filtered counts. = MEMORY law "a negative is unattributed until a positive control shares its address" (09-15), learned again.
- Merge-gate traces with `failure_mode: null` (IAL gates section, 2026-06-01): "Commit dbd0b8f claimed to fix this 21:23Z; post-deploy traces still show the 5ms F25 sink" — claimed fix, not fixed.

### drafter-quality

- Audit F11 (2026-05-28): autonomously-authored templates `gap-closing:fm-43-…`, `fm-17-…` reference non-existent resolver `activity_fetch` (2-of-2 reproduction), abstract config strings as instructions. Resolver-name confabulation. Later Sept MEMORY: "invented paths, anchors" — same class. Fix attempted: registry-query primitive (iter-048/052, "25-LOC commit closes the WRITE side").
- `draft-gap-closing-activity` today: 86% failure over 530 runs in the last week — the May drafter is still burning dispatches.
- IAL 13.S3: minibob 5–8× CC wall-clock, 93k input tokens vs 11k (token efficiency; context stuffing).

### gap-content

- Failure-mode harness 2026-05-22: 6/6 gaps; `draft-gap-closing-activity` created to close them by drafting templates, not by editing code — gaps then had no edit site or machine check; proposals written to `validation/failure-modes/proposals/`. Sept: "gaps born without edit site or falsifier" is the same class.
- `gap-006` (2026-05-24): "substrate cannot describe its own operation" — blocking, open.

### selection-learning

- #5 conditional keying built but acceptance S2/S3 (≥25% templates discriminating at p<0.05) never measured.
- IAL Phase 18 (2026-05-06): failure-mode-stratified updates, chain credit, tags FTS, reuse harness; Phase 19 v2 harness; stop condition "two consecutive weekly runs improvise_health ≥0.70 / reuse ≥0.65" time-gated ~2026-05-26, never closed.
- Audit F15 (2026-05-28): brand-new substrate-authored templates (α=β=1, `total_executions: 0`) win recommend over operator-seeded for unrelated goals (web-research → fp-12). F17: 3/3 operator goals routed to substrate-internal templates with zero semantic fit, "success" then trains downstream topology learning.
- MEMORY 09-08/09-12: `activity`-table posteriors vestigial, two belief tables with different field names — continuation.

### spend-envelope-throughput / cost

- Audit F21 (2026-05-29): cost accounting universally zero — `engine.ts` only sets `taskCostUsd` in compose branch; `HttpLLMPort` dropped `usage`. Partial fix exists today (`goal-host.ts:391,405` capture `usage`), but **live: 18,135 traces since 2026-09-27, sum(cost_usd)=0, 0 rows with tokens_input>0**. The cost-weighted-posteriors (#12) and model-MAB (#15) proposals were written on top of a cost signal that has never existed in the trace store. value-per-cost-selection (09-20) re-attempts the same.
- Validation 2026-05-24 F1: TaskGenerator (every 5 min, 10 tasks) vs drain 1 task / 8–10 min → 1,232 critical + 619 medium queued; "architecture has no drain"; proposed fix was `TASK_GENERATION_ENABLED=false` env (env-gating). That env read is still at `activity-api/src/index.ts:916`.
- IAL Phase 12: SurrealDB connect/auth per query was the throughput bottleneck → session pool (`auth-session-pool.ts`), behind `DB_POOL_ENABLED`.

### composition-crystallization

- IAL success criteria 4/6 (ribosome templates converge above embedded; reuse trends up, improvise-share down) — improvise 4% (8.6 open). `create-shape-provider-goal` 30 execs 0 success (2026-05-25). P4 RELATE composition graph never built. Crystallization later "proven" 09-18 (MEMORY).

### goal-walk-floor

- IAL 8.5: 0 `create-shape-provider-goal` escalations observed, `shape_gap_resolution` empty. 8.6: 2% of top-level goals fell to improvise.
- Validation 2026-05-24 F4: `GOAL_RUNTIME=ias-executor` deployed but the executed path (SearchFirst) never exercised it — "fix deployed but not exercised". Same pattern as Sept "branch exists ≠ reachable" (09-21).

### dormant-mechanism

- Audit F4 (2026-05-27): lifecycle emits shipped without subscribers — `lifecycle:llm:dispatched` (`41382521`) into `NoopEventSink`; `lifecycle:gap:classified` (`31eeeb2f`) zero subscribers. Proposed convention: every new emit ships with a default subscriber + `check-lifecycle-channels.sh`. Sept MEMORY "IMPLEMENTED_DORMANT = largest audit class; grep READS" is the same law.
- Forge (#7, F20): 6 forge resolvers only registered by `ias-executor-ts/src/examples/vessel-forge-host.ts:182`; production GoalHost never had them. Still true (no VesselForgeHost in goal-host-vessel/src).
- Test-audit loop (#8), model-MAB (#15), cost-weighted (#12), identity-resolution (#18), security H1–H5 (#2): specs with 0–15% tasks, never built.
- Post-lift sibling specs listed in IAL tasks (display perception/control, substrate-forge-vessel, distillation, self-deployment, zk attestations): large proposal surface, most never implemented — codebase-bloat on the spec side.

### write-read-mismatch

- F-thompson-normalize (id format), F19 (2026-05-29): `activity-api-trace-sink.ts:138-148` stripped non-canonical failure types (`execution_error`) → null. Fixed: `execution_error` now in `FailureModeSchema` (`activity-api/src/models/schemas.ts:1141-1153`). Chain-credit leaf-bucket bug (#6). IAL 8.4: validator emits `failure_mode_propagation` impulse but no endpoint writes it into the trace.

### node-locality / sync-deploy-drift

- IAL F-V3 (2026-05-01): fix `5b632fe` not in Docker image `0.14.1-e850408` — validated against stale image. F-34: cluster image drifted from values.yaml. Validation 05-25: port 18210 not host-mapped "pre-dates Makefile fix". Same class as Sept "runtime vs clone" drift.
- Audit F23 (2026-05-30): single shared `GoalHost` store across all executions; slot-binding reads `runtime.store.all()` (sibling executions' impulses). Proposed engine-local `visibleImpulseIds` fix; **not present today** (`engine.ts:363,372,577` still call `this.runtime.store.all()`; may be filtered differently — not verified).

### endpoint-routing / env-gating

- #18 identity resolution: hardcoded `identity.metabob.com`, k8s DNS defaults (5 sites) — never replaced by shape resolution.
- IAL 5.0.6 `FEATURE_ACTIVITY_DRIVEN_BINDING`, `DENSE_EMBEDDING_HNSW_ENABLED`, `DB_POOL_ENABLED`, `TASK_GENERATION_ENABLED`, `GOAL_RUNTIME`, `FORGE_ENABLED` proposals — env flags steering behaviour; several still read in `activity-api/src/db/{paradigm,surreal,auth-session-pool}.ts`. Law 1 violation surviving since May.
- F-V13 discovery rejected METABOB_API_KEY; closure-audit read canary key from `~/.metabob/config.json` (401) — key-selection chain via env priority.

### trace-store-db

- HNSW dropped (migration 110, CPU storm on startup). `created_at` default not firing (migration 138). concept-db schema not applied to substrate DB; PERMISSIONS used `$auth.*` not `$token.*` (audit F1); concept-db singleton loses auth after ~1 h (F2).
- Trace volume: 18,135 traces in ~1.5 days (2026-09-27→28) — relevant to the Sept trace-growth work.

### human-surface-escalation / federation-p2p

- #14 intervention tracking + IAL 27.S.6 define push-away/S3 via `interventionRefused` audited by operator — the human auditor path had no reader in May; Sept MEMORY "248 escalations asked of a vessel no human reads" is the same class (a question with no runtime reader).
- #2 security hardening H2/H4 were written as federation prerequisites; only advisory pubkey identity landed (07-04).

### docs-drift

- IAL tasks "Tractable from this spec alone: None … continued iteration yields documentation drift, not code progress" (2026-05-02). Nevertheless the file grew to 2,301 lines of tasks + 2,325 lines of design.
- tasks.md of #14 (0/43) while code exists; #16 lists minibob unit and unchecked done items; #9 references minibob which no longer exists; #12/#15 are superseded without being marked.

### codebase-bloat-fossils

- 13 of 18 entries in this shard are unarchived despite being done, superseded, or abandoned. None in this shard are stray files.
- Duplicate activity variants: `development-vessel:draft-gap-closing-activity` + `…-1783049075304` + `activity:⟨development-vessel:draft-gap-closing-activity⟩` (three ids for one behaviour, splitting posteriors — law 3).
- Example-folder resolvers carrying production responsibilities (`ias-executor-ts/src/examples/vessel-forge-host.ts`, `ship-change-vessel.ts`, `branch-health.ts`; dev-vessel tasks 8.1–8.3 to remove them still open).

---

## Mechanisms (keep / fossil)

| Mechanism | Location | General/specific | Status |
|---|---|---|---|
| Atomic α/β + `fn::beta_sample` | activity-api DB fn, `routes/activities.ts` | general | live-used |
| State-space signature v1 + `context_thompson_scores` | `activity-api/src/utils/session-context.ts`, `lib/posterior-aggregator.ts`, `cluster-posterior.ts` | general | live-used (acceptance unmeasured) |
| Chain-credit per-ancestor bucket | `activity-api/src/lib/posterior-update.ts` | general | live |
| Shape-dispatch agreement lint | `scripts/check-shape-dispatch.ts` in activity-api, concept-db, development-vessel | general (build seam) | live-used; runtime probe never built |
| Advisory pubkey vessel identity (`identity_status`) | `discovery-vessel/src/registry.ts:259` | general | live; nothing gates on it |
| `execution_error` failure type | `activity-api/src/models/schemas.ts:1141` | general | live |
| VesselDaemon / ResolverServer / DiscoveryRegistrationLoop / GoalHost | `ias-executor-ts/src/hosts/` | general | live-used |
| parkedLanding + resume | `development-vessel/src/resolvers/feature-compose.ts` | general (landing seam) | live |
| discardedLandingReport sweep | `development-vessel/src/services/gap-drain-observer.ts:349` | general detector | live |
| Named change_window lease | development-vessel maintenance lease | general | live (spec) |
| `draft-gap-closing-activity` | development-vessel seed | specific | live but 86% failure; duplicate variants — candidate to retire or repair |
| Forge (VesselForgeHost + 6 resolvers) | `ias-executor-ts/src/examples/vessel-forge-host.ts` | specific | dormant/broken (never in production host) |
| TaskGenerator debug/optimize tasks | `activity-api` (TASK_GENERATION_ENABLED) | specific | env-gated; flooded queue in May; state today unknown |
| closure-audit.ts / lift-status.json / closure-status.json | `validation/scripts`, `validation/state` | specific | fossil (last closure run 09-07 all_closed=false; lift file 05-26) |
| Failure-mode harness + progression-driver | `validation/scripts/failure-mode-harness.ts` | specific | CLAUDE.md still names it the validation tool; its `manual_intervention_debt` metric was satisfiable by template drafting |
| intervention-evaluate | `development-vessel/src/resolvers/intervention-evaluate.ts` | specific | exists; use unverified; spec tasks 0/43 |
| RELATE composes graph, HNSW, cost-weighted Thompson, model-MAB, substrateIdentity, test-audit loop, H1/H3/H4/H5 | proposals only | — | never built (dormant proposals) |
| Proposed-first discipline for templates | `schemas.ts:253 proposed default(false)` | general | broken at schema default (May finding still standing) |
| Cost/tokens on traces | engine + trace sink | general | broken: 0 cost / 0 tokens on 18k recent traces |

## Principles stated in this shard

- "Topology *is* the residue of the learning loop; the loop's quality determines the topology's quality" (IAL proposal §Topology creation).
- Lift = coverage progress + substrate health + operator hand-over; the substrate must not write the lift file itself (IAL proposal; 27.3.c.4). The actual lift file was authored by the agent ("file_authored_by: Devbob Agent").
- S3 is emergent and must not be a gate: "Specifying a gate would invert the relationship: the substrate would optimize for 'appear S3-ready'" (IAL tasks 27.S.6). Direct statement of the gamed-metric law.
- "Tractable from this spec alone: None — continued iteration on this spec yields documentation drift, not code progress" (IAL tasks, 2026-05-02).
- Three layers, no smuggling: TS code deterministic, activities constrain, LLMs only where needed (ias-executor-as-canonical-host).
- "We don't write separate tests — activities ARE tests. Traces ARE test results" (harness-as-lifecycle-participant, quoting foundation).
- Every lifecycle emit must ship with a default subscriber (audit F4).
- Audit filters must report `total_pre_filter` alongside filtered counts (audit F14).
- A container is a valid trust boundary; one container = one substrate (single-container design).
- Closure principle: every lift property must derive from substrate-resident vessels alone (substrate-closure-properties, cited in IAL).
- Every behaviour carries fail-loud `failure_mode`; no silent fall-through to a defunct deployment (identity-resolution).
- A verified patch must not be discarded by a refused cutover; recurrence must be a gap event, not a journal grep (parked-landing spec).
- Restart decisions by age of in-flight work, not by count of busy observations (restart-budgets spec).

## Recurrence summary (the "different hat" pattern)

1. **Execution green, learning/outcome hollow**: May 24 (total_selections=0 after templateId fix) → May 28 (F13 err_* outputs success) → May 30 (F24 posterior pollution) → Sept (hollow_write 09-15, count ran=false 09-28, autonomous_pick bypass 09-25). Root cause each time: the success predicate reads the process exit, not the artifact; no consumer-side check.
2. **Metric satisfied without capability**: May 24 staggered runs to make `rl` strictly increasing → May 26 lift on operator judgment → May 22 `manual_intervention_debt` reduced by drafting templates → Sept "gameable-metric regression" (09-15), "class1 expected_literal arms when already present" (09-22).
3. **Built, never wired to a reader**: May 27 lifecycle emits to NoopEventSink → May 29 forge resolvers only in examples → Sept "IMPLEMENTED_DORMANT largest audit class", "248 escalations to a vessel nobody reads".
4. **Cost signal absent** May 29 → Sept (0 cost on 18k traces) while two cost-selection specs were written on top of it.
5. **Drafter confabulation**: `activity_fetch` May 28 → Sept invented paths/anchors.
