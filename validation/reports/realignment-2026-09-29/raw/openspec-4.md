# openspec-4 — raw notes (openspec change proposals, entries 55–72)

Source: `openspec/changes/` entries 55–72 of `(ls openspec/changes | grep -v archive; ls archive)`.
All 18 are **active (non-archived) dated directories** — no stray .json/.ts files in this shard.
Read 2026-09-29 (container clock) / 2026-09-28 host. Live checks against `substrate-live`
container clones `/workspace/git/vessels/<v>` (dev-vessel HEAD `f451e42`, 2026-09-29) and
host `repos/` (host lags container; e.g. `src/maintenance/spliceability.ts` exists in
container). Gap store checked: live `/workspace/git/super-repo/gaps/gaps.json` (6276 gaps,
earliest created_at **2026-09-18**) plus `/workspace/gaps/gaps.json` and 14 tmp copies.

Entries:
1. 2026-06-16-substrate-namespace-and-compose-migration
2. 2026-06-16-substrate-self-persistence-and-direct-push
3. 2026-06-23-demand-driven-orphan-capability-detection
4. 2026-06-24-author-producer-validate-mint-parity
5. 2026-06-25-cross-signature-reputation-penalty
6. 2026-06-25-goal-target-shape-inference
7. 2026-06-25-semantic-cutover-verification-gate
8. 2026-06-25-substrate-root-rename-and-repo-hygiene
9. 2026-07-01-shape-action-evidence-closure-proof (umbrella)
10. 2026-07-04-single-transport-story
11. 2026-07-05-code-locality-resolver
12. 2026-07-05-distributed-spoke-development
13. 2026-07-08-substrate-self-managed-db-reconciliation
14. 2026-07-09-restore-contiguous-shape-flow
15. 2026-07-15-vessel-maintenance-parity-gate
16. 2026-07-18-s2-stability-ladder
17. 2026-07-19-llm-arms-data-driven
18. 2026-07-19-obsidian-pebkac-config

---

## Cross-cutting findings first (the "different hat" pattern in this shard)

1. **Every gap id cited in these changes' VERIFY/design docs is gone.** Checked 13 ids
   (`reach-gate-blind-to-template-dispatches-2026-07-09`, `detector-idle-writes-no-trace-2026-07-09`,
   `env-vs-fix-failure-attribution-2026-07-09`, `cutover-acquires-change-window-2026-07-09`,
   `trace-store-counter-drift-2026-07-12`, `walk-blind-to-vessel-resolver-producers-2026-07-13`,
   `auto-draft-gaps-close-hollow-2026-07-13`, `store-pressure-invisible-to-sensing-2026-07-13`,
   `gap-sourcecodeanalysis-empty-success`, `gap-repair-signature-retry-outcome-unrecorded`,
   `capability-gap-interaction-expectation-verify`, `operator-2026-06-24-hollow-bridge-shadows-genuine-producer`,
   `llm-model-policy-arms-disjoint-from-keyed-models`) → **ABSENT from every gaps.json in the
   container**. Live store starts 2026-09-18. "Filed as a gap, the loop will drain it" was the
   hand-off for most residuals in this shard; the record of those hand-offs no longer exists, so
   none of those closures can be verified. (memory-recall / false-verification / gap-content.)
2. **Worked-once-then-decayed arcs.** Contiguous shape flow (34 ms gap→dispatch on 07-09) →
   drain-log shows 1931/2000 last entries `ok:false http_status:400` hammering two gaps
   (`llmModelPolicy_write` ×966, `llmQuotaState` ×965), drain-log last write 2026-07-23; watchdog
   log last write 2026-07-20 (`open_intents:1523`); `standing.json` (9.7 MB) last modified Sep 7.
   Code-locality shadow mode: 8060 shadow entries, 28 ever `found:true`, 0/1000 recent.
3. **Specs never updated after landing or after drift.** 175 active changes vs 4 archived. The
   07-01 umbrella's F5 "Archive this change" never ran. LLM-arms proposal still says "cutover
   remaining" though entrypoint/Dockerfile wire `apply-llm-arms`. DB-reconciliation tasks.md is
   fully unchecked while VERIFY.md says done; its counters now track table `execution` with cap
   150000 (spec: 25000 demo / 50000 default).
4. **Commit hashes cited in VERIFY docs partly don't resolve.** `b72cd62f` (standing_intent_shapes
   fold into compute_state_signature) is not a valid object in the dev-vessel clone and
   `git log --all -S standing_intent_shapes` is empty; `5381b04` (toolbelt detector) missing too.
   Other cited hashes resolve (db90246a, cfd3dd89, f93a9bab, a551ca8b, a080dfcb, 9674cb8, d245022,
   0ed07cd, e836774).

---

## By problem-class key

### hollow-landing
- **06-25 semantic-cutover-verification-gate** — Problem: autonomous loop landed a hollow patch
  for `trace_outcome_inconsistency` gap: net-new `recordOutcome`/`isNoOpBody`, zero callers,
  `void success; void body;`, never touching `verifyGoalReached → penaliseHollowTemplate`. Passed
  because verify = `tsc --noEmit` + shape-dispatch only (feature-compose.ts ~L306). Built:
  `verifyPatchAddressesGap` (grep reachability hard-fail + haiku LLM judge + `suspected_real_location`
  writeback), flag `SEMANTIC_CUTOVER_GATE` default ON. Live: `feature-compose.ts:417`
  `SEMANTIC_CUTOVER_GATE = (env ?? "1") !== "0"`, used at :5800. 25 unit tests (07-01). Outcome:
  worked as a gate but **class recurred 3× in one day** (07-01): consumed-never-populated
  (activity-api `64fd66d`), imported-never-called (obsidian `82099b4a`), and the detector's own
  wiring dropped (`2aca7ab`) → fixes `bd94937`, `0174b56` (regex couldn't match
  `new Map<string,number>(`), super-repo `543e74e` (28 gate tests). Memory index later records
  `hollow_write` (09-15) and "a gate that READS a diff cannot certify reach" (09-19) — same class,
  new hat. Outcome: partial.
- **06-24 author-producer validate↔mint parity** — `author_producer` minted bridges with pointer
  `filePaths:"{{source_code}}"` (never in pool) while validation used a goal-extracted path;
  `learned-auto-bridge-problem-detection` produced empty `problem_detection` → HOLLOW. Built
  `goal_file_extract` + 2-task bridge + path normalization (`repos/`→`/vessels/`). Live:
  `src/resolvers/goal-file-extract.ts` present. Verified `exec_rbv3iaxt`; real finding
  "createServer is 233 lines" at `/vessels/discovery-vessel/src/index.ts:81`. Still HOLLOW for the
  demo goal (reach-gate calibration + analysis-vessel only surfaces 1 issue). Outcome: partial.
  Also records: validation tolerated `read_error` as substance → a vacuous validation (false-verification).
- **07-01 umbrella** — `gap-sourcecodeanalysis-empty-success`: analysis-vessel returns success with
  `files_analyzed=0` → hollow producer → sibling-gap churn. Gap now ABSENT from store.
- **07-01** — `c271bb7` "Substrate Autonomous" landed 62 s after a hollow verdict filed a capability
  gap; causal delta never measured ("authored resolver's shape not yet in inferred target vocabulary").

### false-verification
- **06-23 orphan detector** — hand analysis claimed "28 invoked / 250 orphaned"; the templates
  endpoint paginates at 100 → real numbers **216 invoked / 35 orphans**. A measurement artifact
  drove a proposal ("negative unattributed until a positive control shares its address").
- **07-08 DB reconciliation** — first autonomous cadence `exec_2ulr7ddi` 5/5; but on 07-12 counters
  said 21,970 while `db_admin diagnose` counted 17,309 (~21% overcount; fire-and-forget increments
  miss delete/expiry). Goal `9d4d00f4` scored `reached:yes` off a meandering walk that produced
  nothing (operator label `not_reached`, `goal_verification_labels:nkktd0xv0w7xa1fbjo8u`).
- **07-09 contiguous flow** — `reach-gate-blind-to-template-dispatches`: pure `targetTemplateId`
  dispatches get `reached:false` + null completionShapes even on trace-verified success.
- **Live now (dev-vessel `src/resolvers/substrate-gap.ts:1205-1220` comment):** the gap-pickup
  path printed "pickup triggered" while `systemctl start` on a MASKED unit failed (exit discarded —
  "The log certified an outage as healthy"); watchdog-tick's stall marker is
  `/workspace/proposals/compose-lessons.jsonl`, appended by every compose → never stale → drain
  never fires. The watchdog built in 07-09 E1 was therefore structurally unable to fire.
- **07-01 C1.3** — `/templates/:id/metrics` broken on SurrealDB 3.x; CI-narrowing detector had to
  read recommend-response posteriors instead.
- **07-01 A3.7** — docs-align-scan flagged MDP doc twice with contradictory rationales ("judge noise").
- **07-15 parity gate** — "the gate can only BLOCK" — designed as the deterministic dual of the
  semantic gate. Container has `src/maintenance/parity-gate.ts` (+test), consumed by
  `vessel-mitosis-cutover.ts` and `change-series-tick.ts`.

### goal-walk-floor
- **06-25 goal-target-shape-inference** — NL goals had `target.size===0` → opportunistic mode →
  `learned-auto-bridge-obsidian-write-note` chosen over genuine producer; `advancesTarget` /
  `isHollowScaffold` dead code without a target. Built `inferGoalTargetShapes` (goal-host `f85a6d5`,
  06-30; `src/goal-target-inference.ts`), constrained to producible vocabulary, cached by goal_hash.
  Verified 07-01 goal_hash `270b97f0`: `["code_quality","problem_detection","sourceCodeAnalysis"]`.
  B5 (seeding ≥0.8 over 20 organic) never measured. Still live (inferGoalTargetShapes in 2 files).
  **Recurs:** super-repo HEAD commit `9c967329` (09-29): "target inference found no shape for
  'memory'/'recall'"; 07-13 `6c699b51` inferred right targets but terminated "no producer" for
  `substrateGap_write` (a shape dev-vessel serves) → `walk-blind-to-vessel-resolver-producers` gap
  (now absent). Outcome: partial.
- **07-09** — goal-host `PRODUCER_DISCOVERY_ENDPOINT` pointed at unreachable hub disabled
  `getTemplateLocalFirst` → every `targetTemplateId` dispatch failed at template fetch (env-gating
  + node-locality).
- **07-01 feature_compose failure modes** — planner invents paths (`src/routes/recommend.ts` ENOENT);
  `old_string` mismatch on ~10k-line files.

### drafter-quality
- **07-01** — never put `${` in an old_string anchor; never instruct in-container composes to edit
  `test/**` (not shipped in image → ENOENT → whole compose rolls back).
- **07-05 spoke** — "three-place NEW-resolver authoring works first-try; internal multi-site EDITS
  to big files do not (drafter ceiling)"; stale-base collateral: compose staged off stale base
  (`0114038`), carried collateral deletions (would have deleted `sf-coverage-replay-tick`) that
  still typecheck → FAVORABLE missed them. Follow-up task unchecked.
- **07-09** — P3-2 drain backoff: 5 honest compose rollbacks (insert+delete pairs op-ceiling) →
  operator direct edit.
- **07-15 parity gate** — root: drafter cannot splice files past ~1–2k lines. Census: activity-api
  `routes/activities.ts` 12014 lines, goal-host `index.ts` 6912, activity-api `routes/impulses.ts`
  5686, `execution-traces.ts` 3717, boredom `index.ts` 3491, obsidian `goal-dispatch-view.ts` 2546,
  minibob `impulse.ts` 2342, dev-vessel `gap-to-feature.ts` 2085. Now goal-host `index.ts` is
  ≥7486 lines (line refs at 7478/7486) — fossil grew. Phase 3 (first parity-gated landing on
  activities.ts) unchecked.
- **07-18 S2 ladder rung 1** — "compose-drops-secondary-hunks": silently lands only first hunk of
  multi-part changes. Memory index (09-27): "prose → planner dropped 2/3 edits, still reached" —
  same class two months later.

### write-read-mismatch
- **07-09 contiguous flow** — reconcile template's `db_admin` call used vessel `{impulse:…}`
  envelope; activity-api requires `{pointer:…, budget}` → every reconcile run 400-ZodErrored
  (`exec_z20x6yrz`); fixed `8b3d8eef`. Same class later in drain-log: 1931 consecutive
  `http_status:400` on `llmModelPolicy_write`/`llmQuotaState` remedies (to 2026-07-23).
- **07-01 D1** — consumed-never-populated map (`64fd66d` → fix `526a0eb`); D1.3 version-2 retry
  rows read but never written.
- **07-05 code-locality** — trace sink hardcoded `filesModified: []`; fixed (ias `ad132ac`,
  `811e02a`, `134ddf0`, activity-api `99fccf6`; trace-sink :194 forwards `materialsConsulted`).
  But locality recall reads `/workspace/locality/code-locality-index.json` (stale since Sep 18)
  keyed by `family` — 0/1000 recent predictions found → recall reader never matches writer keys.
- **07-05 spoke** — feature_compose parses local-tools flat `{stdout,content}`; dev-vessel returns
  `{success, shape, body}` → cannot substitute.
- **06-24** — `{{impulse:slot}}` JSON.stringify's arrays → analysis-vessel rejects `'["/p"]'`.

### node-locality
- **07-05 distributed spoke** — hub had no `shellResult` producer (local-tools unit
  loaded-but-disabled) → every edit-intent goal died `endpoint discovery failed (llm=true,
  tools=false)`. Restored via `systemd_restart`. Toolbelt detector v1 false-positives because
  "same vesselId" ≠ "same location"; blocked on routable endpoints.
- **07-09** — hub `138.197.116.56:18080` unreachable; traces spool-and-replay.
- **Live (substrate-gap.ts:1215):** "GapDrainObserver subscribes to activity-api's websocket,
  which on a spoke is the HUB's — unreachable when the hub is down, and silently so." The event
  path built on 07-09 is node-local-blind. Observer still constructed (`src/index.ts:395-398`,
  env `GAP_DRAIN_OBSERVER!=="0"`), journal shows only "discarded landings: total=0" every ~10 min.
- **07-19 LLM arms** — google arm absent because never in enable list; arms undifferentiated
  across local + `@syzygy-hub` mirrors.

### sync-deploy-drift
- **06-16 self-persistence** — cutover livelock (`rejected_base_sha` / `rejected_commit_failed`)
  through host-sync-poller; fixed by `MITOSIS_DIRECT_PUSH=1` (dev `2cad89c`, live in
  vessel-mitosis-cutover.ts). Self-restart race noted.
- **07-05 spoke** — hub committed `5381b04` on stale `0114038` because in-container fetch failed
  (no credential helper for plain `git fetch`); `pull_cutover` authored by substrate (`d245022`,
  idempotent `0ed07cd`), scheduled in boredom (`de87042`/`6561c67`). Live: `pull-cutover.ts`
  exists; boredom `goal-generation.ts:156` now uses pull_cutover as a doom-signal repair goal.
  Extend-to-all-vessels task unchecked.
- **07-01** — `sync-obsidian-vessel` Makefile styles path bug half-synced stale source;
  docker cp `src/src` nesting hazard.
- **07-08** — activity-api baked into image (no sync target) → `docker cp` in window; new seed
  templates not auto-seeded (cold-start guard).
- **07-08** — previous shrink attempt killed by `self-recovery.service` git-reverting vessels mid-window.

### trace-store-db
- **07-08 DB reconciliation** — AET 218,953 rows / 13 GB / 23 indexes (dups) / 3 views; count 86.5 s;
  per-row DELETE >190 s for 500 rows. Swap done 07-09: keep-set 40,851, 10 indexes, cold
  ORDER BY LIMIT 100 = 4.4 ms. Primitives activity-api `3f378ae` (migration **156** — 155 taken),
  dev-vessel `9674cb8`. `surreal export` stalled (CLI 2.3.3) → file-level backup. Live now:
  `trace_store_counters:execution` row_count 150193, cap 150000, last_reconciled_at
  2026-09-29T03:14Z → cadence still live; parameters drifted 6× from spec; store sits at cap.
  Whole-store pressure (p95 1875 ms, 2095 slow q, 3.1% errors 07-12) invisible to the observer.
- **07-09 contiguous flow** — root of bloat = timer "tick exhaust" (`information_yield:"idle"`
  traces); E4 (kill idle writes at source) unchecked.
- **SurrealDB constraints** (07-08 design): `type::datetime()` not `<datetime>`; root path for
  DDL/deletes (PERMISSIONS silently no-op on JWT path, F-V56); omit optional fields rather than
  null; no unbounded ORDER BY/GROUP BY.

### composition-crystallization / selection-learning
- **06-25 cross-signature reputation penalty** — hole: `blendWeight=0.7` lets strong local α on a
  gamed signature escape bad global reputation (36 edge-probe variants, compose-* wrappers).
  `reputationFactor = 1 - blendWeight*(1-μ_g)`, novelty exempt, MIN_GLOBAL_OBS 5. Landed
  (`applyReputationFactor`, 8 tests) flag OFF; live now read via `getTuningParam(
  "CROSS_SIG_REPUTATION_PENALTY", env, 0)` (activities.ts:6388) managed by
  `jobs/accelerator-flag-tick.ts` (flag became a tuning param — law-1 movement). F3 staggered flips
  never recorded as measured in the spec.
- **07-01 D1 REPAIR_SIGNATURE_CONSUME** — substrate-authored (`64fd66d`, `526a0eb`, goal-host
  `0820eff`); same flag-tick management.
- **07-01 lift gate** — 0/24 ticks, λ₁=0 from 2-component composition topology (412 nodes, star
  ratio 0.60), ρ_sample probes null ("BLIND PROBES").
- **07-05 code-locality** — expertise formation; slices 2–7 unchecked in tasks.md but a
  dev-vessel `code-locality.ts` + `code-locality-mining-tick.ts` (substrate-authored `37d4c13`,
  `3c5b4f1`) exist in SHADOW mode (not activity-api `locality_associations` as designed — table
  absent). Never promoted. Dormant.

### dormant-mechanism
- **Orphan capability (06-23)** — find-half built (`orphaned_capability_scan`, tick template);
  fix-half proven missing 06-24; later gap-to-feature routes `orphaned_capability` via
  `author_producer` direct mint (gap-to-feature.ts:1060-1069, 1752, 1952; comment 2026-07-01).
  Live: 38 open / 3 closed orphaned_capability gaps, created 09-23..09-28 (reborn after store
  reset under same stable ids: `orphaned-capability-code:analysis_context`, `…-mcp:tool_call`,
  `…-substrateBootstrap`). Demand generated, rarely drained.
- **Standing pool (07-09 A1–A5)** — `standing.json` 9.7 MB frozen at Sep 7; `standing_intent_shapes`
  identifier absent from dev-vessel; compute-state-signature.ts:423-449 does fetch `poolImpulse`
  for a "rhythm/cadence axis". Commit `b72cd62f` does not resolve.
- **Watchdog timers (07-09 E1–E3)** — watchdog-log last 2026-07-20 (1523 open intents);
  structurally unable to fire (stall marker never stale, masked unit start failed silently).
- **Interaction closure (07-01 G)** — `solicitation_id` stamping in obsidian (5 files) +
  `interactionExpectation` (1 dev-vessel file); G1.2/G2.2–G4.3 unchecked; human surface later
  replaced (memory: human-surface-vessel, 248 escalations to a vessel no human reads).
- **Self-persistence Phase 0 (06-16)** — `snapshot-state`/`restore-state` never built (0 hits);
  `AviGopal/substrate-state` repo created empty. Continuity-off-host never delivered.
- **Parity gate (07-15)** — module + tests + applier exist and are imported by the cutover and
  `change-series-tick`; `spliceabilityGap` shape never registered on host; no parity-gated landing
  recorded in the spec.

### env-gating
- **06-25 reputation penalty / 07-01 flags** — originally env flags; now tuning params
  (`getTuningParam(name, process.env[name], default)`) — env still the fallback.
- **SEMANTIC_CUTOVER_GATE**, **MITOSIS_DIRECT_PUSH**, **GAP_DRAIN_OBSERVER**,
  **BOREDOM_MIN_DISPATCH_INTERVAL_MS** (07-09 boredom demotion by cadence-stretch env),
  `TRACE_STORE_CAP/HOT_WINDOW_DAYS/RESERVOIR_PER_ACTIVITY` (07-08) — all env.
- **07-04 single transport** — `PREFER_LIBP2P_ROUTE=1` makes transport a host setting. Still live:
  goal-host `llm-router.ts:69`, `index.ts:4242`, `index.ts:7478`; peer-only routing
  (`discoveredVia === 'peer'`, index.ts:422/425). The central ask ("registration says libp2p ⇒
  route libp2p") is only partially done (4242 accepts `protocol==="libp2p"` OR env).
- **07-19 LLM arms** — explicit law-1 boundary: pin = identity (env OK), arm list = behavior
  (open gap: arm inventory should be a shape).

### endpoint-routing
- **07-04** — leak inventory: ~20 dev-vessel resolvers with `http://127.0.0.1:80xx` DEFAULT
  constants; baked literal URLs in seed template JSON (`draft-gap-closing-activity.ts:110-332`,
  including a drafting prompt that teaches new activities to hardcode URLs;
  `detect-concept-db-drift.ts:63,79`; `detect-classifier-distribution-skew.ts:171`;
  `vessel-scaffold-trigger-tick.ts:241`). Follow-up slices never written. Memory (09-22) later
  records the resolve-URL joiner overshoot and a pinned `:8270` escalation writer — same class.
- **06-25 root rename Bucket 3** — hardcoded `/home/avi/.../metabob-devbob` paths; pre-commit
  grep-gate proposed.
- **07-19 obsidian** — Test Connection probes `127.0.0.1:${federationHealthPort}` not
  `getActiveSidecarPort()` → false negatives when 8402 held. **Still at `settings-tab.ts:232`.**
  Discovery endpoint default `http://127.0.0.1:18100` (ports-as-truth).

### federation-p2p
- **07-04 single transport** — overlay (libp2p Noise, Circuit Relay v2, AutoNAT, DCUtR) vs
  loopback. `vessel-discovery-client` now carries `libp2p_multiaddr` (3 files). Additive slice
  landed partially; cutover explicitly out of scope.
- **07-05 spoke** — one brain (activity-api singleton on hub), spokes stateless; cross-spoke
  ownership + cross-location cutover tasks unchecked.

### human-surface-escalation
- **07-01 G** — "we should fail when we can't reliably get the human to interact"; operator-presence
  guard; human as reach gate for surface changes. Mostly unbuilt.
- **07-09 D2** — escalate after 3 fix-failures (human_required via Obsidian / decompose /
  park-with-reason). Landed `cfd3dd89`. The Obsidian surface it escalates to was later replaced
  (memory 09-22: 248 needs-human escalations, 0 answered).
- **07-18 rung 4** — obsidian-legibility-surface (separate change).
- **07-19 obsidian pebkac** — T1–T6 unchecked; `main.js` ~2 MB tracked bundle treadmill decision open.

### codebase-bloat-fossils
- **06-25 root rename** — Bucket 1 cruft (~40 PNGs, 40 MB `.opencode-search-debug.log`), Bucket 2
  half-broken submodule layer (10 embedded repos with blobs + nested `.git`), all tasks unchecked
  in tasks.md though the root did move to `/home/avi/documents/work/substrate`. `.gitmodules`
  still carries `obsidian-vessel` (proposal said drop).
- **06-16 namespace** — removals R.1 (`vessels/`, `activity-monitor/`, `clock-vessel`) unchecked;
  obsidian plugin-id rename deferred.
- **Live residue** — `/workspace/tmp` 624 MB (dv-D…dv-pv, wt41, wt41root, sr-extract clones each
  with its own gaps/gaps.json); `/workspace/pool/standing.json.tmp.1784711646348` stray temp;
  `scripts/substrate/watchdog-tick.{d.ts,d.ts.map,js,js.map}` compiled residue next to the .ts.
- **07-15** — census of fossils (above); god files keep growing.
- **openspec itself** — 175 active change dirs vs 4 archived; stray system-written
  `.ts/.js/.d.ts/.json` files in `openspec/changes/` (other shards).

### docs-drift
- 07-01 umbrella: expectations doc Status lines drifted (Claim 1 "B not landed" after B landed);
  C1 checkboxes lagged; IAL §27.S boxes unticked vs `docs/SUBSTRATE.md` asserting lift complete
  2026-05-26. F4/F5 never done.
- 07-08 tasks.md all `[ ]` despite VERIFY done; 07-19 arms "cutover remaining" though landed;
  07-05 code-locality tasks 2–7 unchecked though a (differently placed) shadow implementation exists.
- 07-01 decision: "Fold-in, not supersession banners" — the reach-judge quotes falsified sentences.

### spend-envelope-throughput
- 07-09 — timers colonized selection ("timers begat timers"): funnel-drain exists because its
  resolver was starved in the selector; gap-compose because gap drain had no event trigger;
  gap→remedy latency floor 30–60 min; load-shed drop-ins stretched ticks to 1–2 h.
- 07-01 — open-gap queue ≥250 dominated by `other` (123) + `orphaned_capability` (54).

### narrowing-duplicates / calibration-seal
- 07-09 D2 — "Silent score-burial of a critical gap is a defect"; landability auto-close forbidden
  for verified/dispatchable gaps. C1 (env vs fix failure attribution; env failures must not
  `bumpFailedAttempts`/calibration) — live: `env_change_window_held` in 2 dev-vessel files, so
  partially landed even though the gap was never recorded as closed.
- 07-01 risk register — "don't let `failed_attempts` anti-thrash bury B".
- 07-08 — REUSE_BEFORE_MINT gate refused the observer tick template (correct); deflected a
  duplicate reconcile mint onto the existing template (07-12).

### autonomous-regression / directed-overshoot
- 06-25 — hollow `recordOutcome` landed in goal-host container copy (reverted E1.4).
- 07-05 — stale-base collateral deletions in substrate-authored patches.
- 07-15 — hollow splice risk into fossils; self-repair correctly returns `no_op`.

### test-residue-live-state
- `/workspace/tmp/*` clones each carry a gaps/gaps.json (14 copies) — test/experiment residue
  beside the live store; 07-01 note: in-container composes must not touch `test/**`.

### memory-recall
- 06-16 — continuity (`⋆`, learned posterior precision) must survive host move; snapshot/restore
  never built. Gap store history pre-09-18 gone (see cross-cutting 1).
- 06-25 — import-operator-memory.ts slug tied to old path.

### gap-content
- 07-01 decision 5 — "B's gap metadata is load-bearing": `gap-to-feature.ts` defaults
  `target_vessel` to development-vessel; `anchor_strings`, `spec_ref`, `file_facts` needed.
- 07-09 — detectors declare `route` + `remedy` as data (landed `a551ca8b`, `de9f77f7`, `114cef49`).
- 06-24 VERIFY — orphan gap closure needs the resolver's per-invocation contract that trace/pattern
  drafters can't synthesize.

---

## Per-entry summary table

| # | Change | Problem | Built | Tasks | Live / status (2026-09-29) |
|---|---|---|---|---|---|
|1|06-16 namespace+compose|9 vessels w/o remotes; host-coupled start|M0/M1.1/M2.1-2.3a/M2.5/M2.6/M3.1-3.2 done; activity-api rename `94b38dd56`|M1.2, M3.3, M3.4, R.1, X.* open|Superseded by root-rename + unified-install-interface; submodules now exist|
|2|06-16 self-persistence+direct-push|host-bound state, host-mediated cutover|Phase 1 direct push live (`2cad89c`), gen-env PAT, setup-git-push, git-push-setup.service|Phase 0 (snapshot/restore) 0/6; Phase 2 0/5; 1.7|Push live; snapshot never built (dormant)|
|3|06-23 orphan detection|250 "orphans" (actually 35)|scan + tick; 35 gaps|all unchecked in tasks.md though built|Detector live; 38 open gaps; fix-half via author_producer added 07-01, mostly undrained|
|4|06-24 validate↔mint parity|minted bridge ≠ validated pointer|goal_file_extract + 2-task bridge + path normalization|no tasks file|Live; demo still HOLLOW|
|5|06-25 cross-sig reputation|gamed local α escapes bad global|applyReputationFactor|—|Tuning-param gated via accelerator-flag-tick; measured flip not recorded|
|6|06-25 goal target inference|NL goal target.size 0|inferGoalTargetShapes (`f85a6d5`)|—|Live; still misses some goals (memory/recall 09-29)|
|7|06-25 semantic cutover gate|typecheck-clean hollow landing|verifyPatchAddressesGap + computeDataFlowFacts|—|Live default ON; class recurs|
|8|06-25 root rename + hygiene|cruft, broken submodules, absolute paths|root moved|0/~30 checked|Partially done by other means; obsidian still in .gitmodules|
|9|07-01 closure proof umbrella|no proof loop works|A, C1, E1, B, E2, D1, G1.1 done|E1.5, B5, D1.3, G1.2-G4.3, D2/D3, F1-F5 open|Stalled; never archived|
|10|07-04 single transport|two transport stories|discovery-client libp2p fields|—|PREFER_LIBP2P_ROUTE still live; baked URLs unfixed|
|11|07-05 code locality|re-derive file set every goal|slice 1 (trace attribution); shadow resolver in dev-vessel|2–7 open|Shadow only; 0/1000 recent found; index stale Sep 18|
|12|07-05 distributed spoke|hub missing local-tools; no cross-location cutover|local-tools restored; pull_cutover; toolbelt detector|same-location, gap wiring, cross-location, ownership open|pull_cutover live; rest open|
|13|07-08 DB reconciliation|AET 219k/13GB|swap + counters + lease + observer + reconcile op|tasks all [ ] (VERIFY says done)|Live, reconciled today; cap drifted to 150000|
|14|07-09 contiguous shape flow|timers colonized selection|standing pool, route/remedy, event drain, watchdogs|C1, C2, E4 open|Event drain degraded (400 storm → silent since 07-23); watchdog silent since 07-20|
|15|07-15 parity gate|drafter can't splice fossils|parity-gate.ts, seam-extraction.ts, spliceability.ts|Phase 3–5 open|Built; consumed by cutover; no landed fossil split recorded|
|16|07-18 S2 ladder|interlocutor does 4 jobs; verifier ≈ generator|spec only|—|Principles; rung 1 bug class still recurring (09-27)|
|17|07-19 LLM arms|hand-authored arm units; pinned arms fall back|renderer + apply-llm-arms wired in entrypoint; LLM_PINNED_PROVIDER in llm-resolver|spec says remaining|Landed; spec stale; arm-inventory-as-shape gap open|
|18|07-19 obsidian pebkac|misconfigurable vault join|spec|T1–T6 open|settings-tab.ts:232 bug still present|

---

## Mechanisms (general vs specific, live status)

- **Semantic cutover gate** (`verifyPatchAddressesGap`, `computeDataFlowFacts`; dev-vessel
  feature-compose.ts:417/5800) — GENERAL (shared compose verify seam). live-used.
- **Parity gate + seam extraction + spliceability** (dev-vessel `src/maintenance/*`) — GENERAL
  (maintenance verify seam). live code, imported by vessel-mitosis-cutover.ts and change-series-tick.ts;
  no recorded fossil split → effectively live-unused.
- **Goal→target-shape inference** (goal-host `goal-target-inference.ts`) — GENERAL (walk entry).
  live-used; coverage gaps.
- **Reach gate `verifyGoalReached`** — GENERAL; referenced as the reused judge pattern.
- **Cross-sig reputation factor** (`applyReputationFactor`) — GENERAL at recommend chokepoint;
  tuning-param gated; unknown whether on.
- **accelerator-flag-tick** (activity-api `jobs/accelerator-flag-tick.ts`) — GENERAL flag policy
  evaluator for REPAIR_SIGNATURE_CONSUME / CROSS_SIG_REPUTATION_PENALTY. live (exists).
- **Repair-signature consumption** (activity-api activities.ts:6060, goal-host `0820eff`) — SPECIFIC; live code.
- **orphaned_capability_scan** (dev-vessel) — GENERAL detector; live-used (gaps minted 09-23..28).
- **author_producer + goal_file_extract 2-task bridge** — GENERAL producer-mint path; live.
- **MITOSIS_DIRECT_PUSH cutover** (vessel-mitosis-cutover.ts) — GENERAL landing seam; live-used.
- **pull_cutover** (dev-vessel resolver; boredom goal-generation.ts:156) — GENERAL convergence;
  live-used as repair goal; only dev-vessel scheduled originally.
- **advertised_shape_coverage_scan toolbelt check** — SPECIFIC; live (1 file) but false-positives
  (same-vessel ≠ same-location); cited commit `5381b04` missing from clone.
- **trace_store_counters + reconcile_trace_store + maintenanceLease + trace_store_health_observer +
  pausable-citizen guard in fetchWithRetry** — GENERAL store-maintenance cadence; live-used
  (reconciled 09-29 03:14Z). Counter drift known.
- **GapDrainObserver (WS event drain)** — GENERAL event path; running but degraded: depends on hub
  WS (node-locality), drain-log silent since 07-23 after 400 storm. status: broken/degraded.
- **Standing pool `poolImpulse` / standing.json** — GENERAL; file frozen Sep 7; `poolImpulse`
  still fetched by compute-state-signature. dormant.
- **watchdog-tick.ts + watchdog.conf drop-ins** — GENERAL; broken (marker never stale; masked
  unit start ignored); log silent since 07-20. Superseded by in-process compose call (substrate-gap.ts:1218).
- **Gap route/remedy fields** — GENERAL data contract; live (landed).
- **Gap lifecycle age-boundary re-verify + burial guard** (`db90246a`, `cfd3dd89`) — GENERAL; commits exist.
- **Env-vs-fix failure attribution** (`env_change_window_held`) — GENERAL; partially live (2 files).
- **change_window lease** — GENERAL; 4 dev-vessel files.
- **code_locality shadow resolver + mining tick** (dev-vessel) — designed GENERAL
  (material-agnostic), implemented SPECIFIC/shadow; dormant (0/1000 found).
- **Trace attribution `materialsConsulted`** (ias trace-sink :194) — GENERAL; live.
- **libp2p overlay / discovery registration protocol fields** — GENERAL; partial.
- **render-llm-arms.sh / apply-llm-arms.sh / llm-arms.json** — GENERAL arm materialization; live.
- **LLM_PINNED_PROVIDER quota gating** (llm-resolver index.ts:69/1098) — SPECIFIC; live.
- **snapshot-state / restore-state** — never built (fossil-in-spec).
- **Obsidian solicitation_id stamping** — SPECIFIC; exists in obsidian src; the surface itself later replaced.

---

## Principles stated in this shard

- "All correctness lives in the deterministic gate, so the generator of the cut can be arbitrarily
  weak" — parity gate is the degenerate, strongest point of the semantic gate (07-15 proposal §Key insight).
- "A maintenance commit that also edits behavior voids parity and must be split" (07-15).
- "λ₁ ≳ ρ_grow": decomposition rate must outpace accretion (07-15).
- "typecheck=clean ≠ gap fixed" mirrors "status=completed ≠ goal reached" (06-25 semantic gate).
- Avoidance symmetric with reward: selection (target inference), execution (reach gate), authoring
  (semantic gate) (06-25).
- Verifier supremacy: checking must be an order of magnitude more reliable than doing; checks are
  themselves Thompson-graded activities — "one that never fires decays" (07-18 rung 2).
- "S2 is stable when the margin between self-report and independent audit is small and shrinking,
  not when a rate crosses a line once" (07-18).
- Tripwires: second gate-gaming incident; hollow closes in headline close rate; prediction-error
  drifting toward flattery (07-18).
- Placement follows data locality, NOT "everything everywhere": location-stateful vs
  location-independent vs shared singleton (07-05 spoke proposal §1).
- "A cutover is done only when scored, never when the unit merely restarts" (07-05).
- A vessel's reachability is entirely described by its discovery registration; loopback is the
  degenerate case (07-04).
- Expectations live in `docs/` (watched by docs-align-scan), not openspec; "fold-in, not
  supersession banners" (07-01 design decisions 1–2).
- "Don't let the system under test author its own ruler mid-experiment" (07-01 decision 4).
- "Falsifiable Status lines get falsified" (07-01 design).
- "Timers begat timers"; the gap write itself is the perfect trigger; quiet watchdog = no trace
  (07-09).
- "Gap lifecycle is decisions, not decay"; silent score-burial of a critical gap is a defect (07-09).
- Env failures must not burn gap/approach credit (07-09).
- "Reuse before mint" preserved: damp demonstrated bad reputation, not novelty (06-25 reputation).
- Law-1 boundary: provider/model pin is bootstrap identity; the arm list is behavior and should
  surface as a shape (07-19 arms).
- Law 6 class detectors owed alongside instance fixes: dead-arm-still-advertised, enable-list
  omission, build/run tag drift (07-19 arms).
- Expertise formation: attributed log → consolidation → cued recall → metacognitive gating →
  shadow apprenticeship → precise blame (07-05 agent-prompt.md).
- Continuity: "the carrier of learning must survive a move from host A to host B" (06-16).
- Hard invariant: no hardcoded refs not relative to `{substrate-root}` (06-25 rename).
- Never bulk-delete row-by-row in SurrealDB; copy-forward swap (07-08).

## Coverage
Read fully: all proposal.md / tasks.md / design.md / VERIFY*.md / findings for the 18 entries,
except: `orphan-resolvers-evidence.txt` (first 1.5 KB), spoke `design.md` (first 80 lines),
parity `design.md` (first 60 lines), code-locality `agent-prompt.md` (first 40 lines),
contiguous-flow `design.md` and `specs/contiguous-shape-flow/spec.md` (not read).
Live checks: greps over host repos and container dev-vessel clone; gap-store id lookups;
`trace_store_counters` query; pool/locality/watchdog log tails; journal of development-vessel (2h).
