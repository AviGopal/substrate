# memory-4 — operator memory cache, files 226-300 (sorted), 75 notes

Source: /home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md | sort | sed -n '226,300p'
(reference-a-trace-store-over-cap… through reference-cycle-3-fallback-overrides-hollow…). Notes are the
operator's cache; claims below are as recorded in the notes (dated), with later reversals called out.

## Per-note extraction log (chronological within reading order)

### 08-09 trace store over cap froze all self-editing (reference-a-trace-store-over-cap-froze-all-self-editing-2026-08-09)
- keys: trace-store-db, sync-deploy-drift, false-verification (mis-attribution), dormant-mechanism
- trace store row_count=299517 vs cap=150000 (2x, rising). Gap trace-store-reconcile-2026-08-09T02 never closes → re-dispatched forever, each run takes `change_window` lease TTL 15min (seed `src/seed/trace-store-reconcile.ts:27-30` documents the lease is never released on failure; TTL is the backstop). Retry cadence < backstop ⇒ ~100% duty cycle.
- `vessel-mitosis-cutover.ts:1039-1070` waits CUTOVER_LEASE_WAIT_MS=90s for change_window then returns cutoverDeferred SILENTLY → feature-compose.ts:3643 UNFAVORABLE → applied edit left on /vessels (rollback `feature-compose.ts:3529-3541` partial) → next attempt `patch-with-tools.ts:576-580` "POISONED BASELINE" refuses. Each failed attempt poisons the next.
- pull-sync deferred 16x/6h (0 syncs) by the same lease; clone frozen.
- Mis-attribution: goal-host `index.ts:9702-9723` error cascade applied→verify→semantic_gate.reason→body.error; cutover refusal falls through to the (passing) semantic gate reason. `feature-compose.ts:3688` lessonReason same defect feeding compose_lesson (drafter's only read-at-use channel). Comment at :3664 "CLASS AND EVIDENCE MUST DESCRIBE THE SAME EVENT" enumerated cases and missed cutover. Law: a fix that enumerates cases inherits a bug with the next case.
- `remedy-effectiveness-observer.ts:9` already named the "trace-store-reconcile livelock (7 days of 500s treated as success via 202 ACK)". Detector built, recurrence not prevented.
- Nothing compares LIVE vs CLONE except patch_with_tools (refuses only); `mirror-to-live` exists but nothing invokes it for this case. "Detection without a repairer that anything calls is a deadlock, not a safeguard."
- Operator error: multi-line body at a single anchor → TS1127 x14 (drafter can only replace anchor line). Law: tsc your own artifact before dispatching.
- Operator retraction: lease→pull-sync→clone-behind chain was false (clone converged on origin d1a30bf); the live tree carried 597 bytes of the operator's own patch residue; residue corrupted (extra escape) yet TSC_EXIT=0.

### 07-27 attention→reward presentation loop (obsidian-vessel e6206e9)
- keys: selection-learning, human-surface-escalation, federation-p2p, write-read-mismatch
- 3 Thompson arms minted proposed:true on hub (obsidian-present-inline-full / lede-progressive / digest-action); client-side Beta sampling from activityMetrics; attention grader emits activityExecutionTrace_write; loop closed with a real human 17:38Z (arm C 5.75/2.55→6.3/2.8). Outcome: worked (at time).
- Plain REST from a spoke is dead (/outbound/http dials peer-loopback, 30s hang); only impulse-resolve pointers cross libp2p overlay. `recordImpulseRelevance` silently dead on spokes. Gap: gap-sidecar-outbound-http-plain-rest-unreachable-and-bodyless-get-hangs.
- `thompson_posterior` shape counts legacy `execution` table; `variantMetricsSummary` derives fake α/β from successRate — dishonest instruments (gap-thompson-posterior-shape-reads-legacy-execution-table).
- context_thompson_scores v1 writes FROZEN hub-wide since 07-21 despite writer in posterior-update.ts (~790) — silent (gap-context-thompson-v1-writes-frozen-since-0721). Per-human conditioning dormant.
- Operator lesson: dom_query returns FIRST n matches — "frozen feed" was truncation artifact.

### 09-05 attrition fix pre-registered prediction
- keys: false-verification, gap-content, dormant-mechanism, sync-deploy-drift
- gap_lifecycle_scan expired gaps purely on elapsed time; 720 `expired_not_redetected` closures by gap_lifecycle_scan. Fix `hasNoAttemptEvidence(g)` spares never-attempted gaps. Pre-registered: 315 candidates → 141; 174 no-attempt must survive. Observed 06:36Z: expired 9, all with attempt evidence, 0/174 cohort expired (p≈0.0007 by chance). Outcome: worked.
- Instrument limits: dry_run always reports 0 expired; closed_at blank on 717/720 expired ⇒ expiry rate unmeasurable.
- Semantic gate correctly refused additive helper with zero callers (dead code) — put def+call site in one goal. Applier relocated anchor (span 489-493 vs ~96) yet typecheck passed — semantic gate caught it.
- Compose lane refused operator's DIRECTED compose (2 in flight cap=1); BUSY = non-attempt but dispatch status says failed.
- Picker: pool 237, hopeless_excluded 59 (~20% seal), tied_at_top 11.
- ★ Deploy two steps: mirror-to-live mirrors file, restart DEFERRED while dispatch in flight ⇒ file on disk ≠ running code (MainPID old). Watch MainPID/ActiveEnterTimestamp, not grep.
- Pull-sync quiesces properly (admission closed, capped wait).

### 08-03 audit cycle 2 — oracles uncovered not broken
- keys: false-verification, goal-walk-floor, dormant-mechanism
- 13 verdicts: 1 confirmed, 12 refuted, 8 proposed fixes were REGRESSIONS. Law: never land an audit finding without an adversarial pass (~90% base rate wrong/harmful).
- Confirmed: deterministic oracles LIVE but UNCOVERED — 100 records: 8 reaches, 4 attested landed sha, 4 LLM prose, 0 deterministic. Real parsers over 27 real goal texts → 0 owned. 12 oracle families not 9 (interpolated `verified-${row.id}` tags missed by literal grep).
- Retired beliefs: "walk is error-blind" (error text feeds next prompt index.ts:2574); chain.length ≠ depth (bundle members, index.ts:5190); porting resolver_schema would be a regression; 88.1% of missing-shape mentions name a shape present in registry ⇒ binding/demand problem not routing.
- ReAct fallback REACHED 20 hub/14 spoke with 0 tool calls — suspect.

### 08-06 audit iter 11 — reach written never graded
- keys: selection-learning, write-read-mismatch, hollow-landing(satisfier), goal-walk-floor, composition-crystallization, trace-store-db, codebase-bloat-fossils
- BP-1: `0ad5dfc` restored reach write, but every posterior consumer runs at trace-INSERT (`execution-traces.ts:2813/2908/3146`); `app.post('/reach')` (`:3888-3956`) calls neither classifyReach nor applyOutcomeToPosteriors. 0 rows changed alpha/beta across 400 traces. 92% ungraded (reach-classify.ts:32). Outcome of 0ad5dfc: partial/inert for learning.
- ★ CORRECTION: `activity_execution_traces` (AET) is DECOMMISSIONED (paradigm.ts; DUAL_WRITE_ENABLED unset) ⇒ 0ad5dfc's AET UPDATE matches 0 rows forever; only the `execution` mirror worked. Any reach-path fix must use `execution` (execution-traces.ts:2464-2530).
- BP-2: satisfier is its own grader: `synthTrace` (goal-host index.ts:5133-5162) sets completed+success unconditionally; 52.4% of paths satisfier-only (36.7% executions); synthetic trace pushes chain ⇒ walk.reached ⇒ ReAct floor suppressed at :7260.
- BP-4: floor doesn't loop: 41/74 invocations 0 act→observe cycles; 19/35 end at 90s ITER_TIMEOUT via unlogged `catch{break;}` :2712; floor excluded for all edit-intent goals; 0/4681 goal paths record a floor step; budgets constants (MAX_ITERS=4).
- Reconciliation: no forward plan persisted; SUBMITTED reach 17.2% vs SELF-SUBMITTED 5.0%; learned_pathway tier 2.2% vs fresh_derivation 33.8% (INVERTED; but walk_tier is name-substring proxy wrong 93%); `reusing known-reaching path` 6 fires vs 11,673 satisfier lines — middle tier does not exist. 79.6% of declared tasks skipped.
- BP-3 reach delivery `void fetch` 10s no retry (index.ts:9634) — write-before-insert race. BP-5 goal identity instance-grained: route-edit family 397 goal_hash / 1,327 execs, gap goals nest recursively. BP-6 success_rate stored as {0:251,1:199} only, composition-graph.ts reconstructs alpha from it (amplified pessimism); SurrealDB SET sequential ⇒ f5a96c9 repair wrong. BP-8 highest-churn files are the guards (feature-compose.ts 108 commits/7d); 217 autonomous commits through zero pre-commit hooks (core.hooksPath unset in 4 vessel submodules).
- Organ ledger: load-bearing only discovery, goal-host, development-vessel, llm-resolver. INERT: Thompson learner; total_selections 0 on all 2,444 arms (fire-and-forget UPDATE, 41.9% metrics:null); boredom rhythm fold pinned due_score ~0.3003 vs >=1.0 gate; idle selection on 5s env timer; relevance-sink 264/264 penalty writes failing. DARK: local surrealdb, concept-db (000 at both addresses), local activity-api, identity. DECLARED-ONLY: clock-vessel, ias-executor-ts (no unit), watchdog-tick.timer, vessel pre-commit hooks. MIS-WIRED ribosome: 20,653/20,653 events took trace.success branch (94% "reached" vs honest ~13%); recursion guard only rejects names starting `ribosome` ⇒ `learned-learned-…` stacking x21.
- Retired claims: systematic_failure no-route (false); "58% landings never ran suite" false but `timeout 240 bun test || true` discards exit code (>240s suite = testOk); /v2/activities/templates paginates fully to 2,444.
- 12-step dependency-correct fix sequence (instruments first: reach_credit_health, stored_rate_consistency activities; R-1..R-10 incl. shaped policies posteriorGradingPolicy, bodyHonestyPolicy, walkBudget, extractionPolicy, goalIdentityPolicy, goal_family_hash).
- Crosscheck caught 5/7 specs defective before dispatch: late grading would credit satisfier satellites; reach-gating ribosome would drop extraction to ~0 (verdict arrives after execution_completed); policy reads via activity-api /v2/impulses/resolve 404 `use_vessel_discovery` ⇒ law-1 compliance decorative — route via discovery POST /resolve flat {pointer}; body-honesty widening would refuse diagnostic reports. Law: spec → adversarial crosscheck → dispatch.
- Nuance: credit HAS flowed historically (920 α>1); honest claim is credit not flowing for current work; verdicts that arrive are 26:1 failures.

### 08-06 audit plan-vs-trace reconciliation (15 agents; 35 surviving, 7 refuted)
- keys: selection-learning, false-verification, goal-walk-floor, env-gating, composition-crystallization, node-locality
- Reach grading touches 2.4% of executions; 33% credited fail-open via `reach-classify.ts:33` `t.success ? 'legacy-success'` counted as success in posterior-update.ts:760.
- 0/202 grounded labels from runtime reach gate; oracles compute expected+observed (index.ts:1266) then discard into prose.
- Floor: 51% zero cycles; `if (!r.ok) break;` :2790 treats non-2xx fatal while timeout continues; floor writes 0/4,768 goal-path rows (`return uf` at :7643 before recordGoalPath).
- Ribosome tripped its own documented rollback trigger (9.9/6h < 25/6h) and nothing acted; 96.4% re-reads ungraded.
- CRITICAL: every gate in autonomous deploy path in-band: local-tools-vessel shell = `Bun.spawn(["bash","-c"])` as uid 0 with no guard; can overwrite test baselines, pull-sync binary, units. Test gate never rejected anything (0/180) — aggregate per-vessel delta; baselines activity-api 179 fail, dev-vessel 100; 10/11 substrate commits bypass it via MITOSIS_DIRECT_PUSH=1 (hash-equality short-circuit).
- relevance-sink-vessel squatter (compute role writing masked store); 162 ConnectionRefused/24h.
- Four policy shapes with NO producer: extractionPolicy (2,477 fallbacks/24h), extractionEligibilityPolicy, bodyHonestyPolicy, pathwayReusePolicy — in-process literals (law 1).
- Planner confidence carries no information (conf 0.0 → 50% beats 1.0 → 38.6%).
- Self-submitted "Close substrate gap" goals 3,606 execs (36%) at 5.6%, titles nest up to 81 levels (794 rows depth>=3) — autocatalytic route-edit loop STILL running on 08-06 despite "confirmed dead" 08-03 ⇒ recurrence.
- Retraction: shared signatures across goals = convergent re-derivation (keyed on exact goal-text hash), not reuse — "78% waste" misread as learning.
- Refuted: floor has no write tools (shellResult root bash); light-dispatch dead (112/578); "95.5% corpus orphaned" (instrument: list endpoint caches truncated projection).

### 08-04 audit R1-R5 — floor grounds on the hub
- keys: goal-walk-floor, node-locality, federation-p2p, false-verification, endpoint-routing, sync-deploy-drift
- R1,R2,R4,R5 NOT MET, R3 PARTIAL. Client-side tool branch (goal-host index.ts:2551-2578) executed 0 times in 72h; llm-resolver agentic by design executes tools itself; `federation-transport-server.ts:272` `rj?.body ?? rj?.content ?? rj` destroys tool_calls/usage/model at the wire; reach admitted on non-empty text (:2630). Tools execute at DEFAULT_TOOL_DISPATCH_ENDPOINT 127.0.0.1:8090 relative to the arm = HUB; spoke questions answered from wrong filesystem.
- No reach verdict durably attached: `reached:` in one line (:7177); 1800 rows 0 true/0 false; ribosome extraction 1.9%. Lever: recordDeterministicLabel (:2302) gated deterministic-only (100/100 deterministic, 1 achieved).
- Self-confirming oracle: file-count oracle generates the command it grades (-maxdepth 1) answered 10 for 17 and alpha-credited.
- Corrections: boredom not starved (2196 reservations/12h); rhythm-conductor-tick.ts:145 special-cases gap-closing out of staleness accrual ⇒ largest-alpha family never due. apply-inventory.sh has no `systemctl enable` path. LLM ~50% success load-sensitive, both failure modes return HTTP 200 (value:"" / error as content) ⇒ ungradable, read as wins. Dispatch store capped 100 records ≈77 min.
- Hazards: 32 goal-host restarts/day from mitosis cutover not draining in-flight work. Port 8401 unpublished but registry advertises 127.0.0.1:18401. Hub cannot report its own build SHA (/version 404). 7/10 mitosis overlays only feature-compose.ts (drafter patch attempts none landed). Read-only goal naming a file routed EARLY EDIT-INTENT.
- Next action proposed: delete det gate at :2304-2305 to label all executions (later 08-26: oracle-guard `if(!det) return;` restored — design says NEVER the LLM judge; reversal).

### 08-04 auth fail-open closed (activity-api 35e75cc)
- keys: env-gating(not), false-verification, autonomous-regression
- jwtAuth.ts admitted jwtAuth=null via 3 paths; activities.ts 57 routes use root surreal client with tenant filter inside `if (orgId)` ⇒ null org REMOVES filter ⇒ cross-tenant read on 0.0.0.0:18080. Fixed + live 401 probes. Outcome: worked.
- Near-miss: allowlist passed local suite byte-identical but would 401 cross-repo callers (substrate-gap.ts:456 /v2/events/publish; identity trace.ts:58). Law: when narrowing admission, enumerate callers across ALL repos. Test file asserted the hole (expect 200 on rejected key) — dispatched fix would have "fixed" the test; direct edit chosen.
- Internal key header only presence-checked, never compared to a secret (unfinished).
- activity-api masked on spoke — confirm where a vessel runs.

### 09-22..09-24 authorability = submodule membership (long note with many addenda)
- keys: human-surface-escalation, sync-deploy-drift, codebase-bloat-fossils, write-read-mismatch, narrowing-duplicates, false-verification, trace-store-db, endpoint-routing, drafter-quality
- 18 gitlinks + 3 plain-file vessels (clock, human-surface, relevance-sink) ⇒ no /workspace/git/vessels clone ⇒ substrate cannot author the live human surface. human-surface runs from detached `/workspace/git/human-surface-release` 11 commits behind. Bootstrapped in container via subtree split + local bare origin (recipe). /vessels is IMAGE LAYER.
- Lanes: patch_with_tools failed six-site edit twice (dup insert); byte-exact lane `apply_proposal_as_patch overwrite_files`; cutover PROVENANCE gate needs gap_id+proposal_id; multifile path dropped gap_id silently (fixed 8bc66ba + gate reads mitosis-pending.json 573461a). Form loop landed 8a83c8c, cab60aa, a1532dc, 1dcfd4b via substrate chain.
- LLM lane blind to ui/src (root tsc excludes ui/).
- A landed SHA re-closes a reopened gap (landed_verified, close_basis absent) — filed. pull_cutover reads stale fleet inventory (09-07).
- 09-23 "INVALID_API_KEY: revoked" fleet-wide was identity RATE LIMIT: /v1/auth/resolve 100/min per ip:prefix, extractIp → 'unknown' ⇒ whole fleet one bucket ⇒ 23,396 429s/2h ⇒ cached null ⇒ 401. Fix activity-api 503 on transient (4fc5f80); identity getConnInfo fix blocked (protected vessel).
- A f122f86 (landing-derived predicate, operator_hold respected); B 983ca92 self_fact_reconcile (7 divergences). Three copies-that-stopped-tracking: activity rows with learning_track NONE since reseed ⇒ 1,300 failed registrations 6h no gap (bf82746); dev-vessel absent from discovery 80 min because heartbeat timer armed only after successful boot registration (57c759a); journalctl --since ISO-Z silently fails.
- Empty-stderr git commit failure attributed: precutover suite runs in push clone and dev-vessel suite clean-slates the clone (test-residue) ⇒ staged index wiped; fixed bad7993. Boredom grades ticks by `findings`/`gaps_emitted` keys ⇒ detector with own vocabulary scored idle (write-read-mismatch).
- 09-23 03:35 first autonomous reconcile run: boredom ran tick 5x, closed obsidian row by predicate. Worked.
- Two wrong closes by own detector: reconcile read /vessels runtime copy (compose wrote uncommitted ui/src into live tsconfig) — source is the push clone (v1.2 4e70cbb); `-narrowed` clones copy classification_metadata incl. detector ⇒ closed rows it never filed (`childMeta = {...meta}` gap-to-feature.ts).
- feature_compose lands only with pointer.land:true; isolates only with verify_vessels; else edits LIVE tree uncommitted.
- Multi-line verbatim ops dead: assertAnchorInWindow did window.includes on numbered text ⇒ confabulated anchors; fixed 2f2ba0f.
- apply→tick→cutover orphans: concurrent cutovers, clearPendingIfOwned deletes record survivors need; trace-store-reconcile re-takes change_window (45 deferrals/90min) — RECURRENCE of 08-09 lease class.
- Semantic gate flipped on identical bytes (addresses:true → refuters 2/2).
- Parallel operator sessions drive gaps; split autonomy counts by author.
- 09-24 ★ `interpolateBoundValues` (ias-executor-ts activity-api-provider.ts) blanked every {{…}} at template load since substrate landing 946034c (09-15), undetected 9 days: chained templates lost outputs; trace-store-reconcile sent empty lease_token (403 108/108), never released ⇒ 5-min holds starved every landing. Fixed by substrate 2893a93 (directed pick, 4th draft). Probe template with observable sink = instrument.
- Picker: all human_reported gaps share ONE Thompson class; lessons bonus reads per_gap_failure_lessons (no writers) — write-read-mismatch; impactOf counts citations in summaries only.
- Change-window chain bottom to top: retention valve removes ~76 rows/h vs ~1,190/h ingest (74% tickers) ⇒ store never drains ⇒ health observer re-emits ⇒ reconcile forever ⇒ holds change_window. `last_reconciled_at` advances regardless.
- Templates list first page served from Redis id-set never invalidated ⇒ 6 days stale (1f58320, 55cd36d sort).
- Cutover restart puts composer in lame-duck drain 11+ min. Loop re-lands variants of visible fix forever (four landings on one gap).
- Gates read STALE SUBMODULE COPY (`REPO_ROOT ?? WORKSPACE_ROOT ?? super-repo` + repos/<v>) while ops apply in push clone; dev-vessel pointer 100 commits/3 days behind. Fixed guard 2 (20a668b); siblings filed.
- Lane rules: pending_outcome_verification short-circuits; judge refuses caller-less helper and partial fix; closing held gap needs falsifier_exercise.passed; scope REFUSED records no failure_lessons.

### 08-26 authorized blocker push all resolved
- keys: selection-learning, env-gating, drafter-quality, spend-envelope-throughput
- 5 fixes: selector-audit undifferentiated branch (dev 1ed2c3f); reach-verdict durable spool goal-host ea78fd7 (~13% transport loss 30/200 was dropped; now /workspace/.reach-verdict-spool.jsonl); llm-prompt materialize loaded:false ias-executor bf5c691; CREDIT_PROPAGATION_EXCLUDED_ANCESTORS activity-api 5d28ded (no-op until authored; authoring deferred — dormant); oracle-guard `if(!det) return;` restored (reverses the 08-04 proposal).
- Openspecs: variant-sprawl dedup fe8c29fb; large-file-edit keystone 6e9b27e9. Keystone BUILT dev c86451f `replace_lines` op: op_count 0→1 but drafter edit broke typecheck → rolled back; patch_with_tools lacks replace_lines. Partial.
- Key revision: validator-dispatch α/β frozen at 151324.78/585779.84 — smearing is a frozen historical artifact; starvation → freeze → stale attribution.
- Toolchain: host has node tsc no bun; classifier blocks schema migrations; substrate_tuning_param.value float-only (mig 152).

### 08-02 autocatalytic route-edit gap loop
- keys: narrowing-duplicates, gap-content, drafter-quality, test-residue-live-state(red baseline)
- goal-host index.ts mints `route-edit-${goalHashOf(goal)}` with `summary: goal` at two sites (:6889/:7201); failed gap-closing goals mint sibling gaps ⇒ nested "Close substrate gap route-edit-…" recursion; 1473 compose-reports of fiction about one file (48/52 patch runs targeted feature-compose.ts).
- Fix at mint site 154390b, 11ba16d, 2585053, 1d97038; nested-summary gaps 20/h→0 by 00h 08-03. BUT 08-06 audit found titles nested up to 81 levels deep still (794 rows depth>=3) — outcome: partial/recurred.
- Law: a failed attempt at closing a gap belongs to that gap, not a new one. Verify loop dead by querying the artifact store, not log absence.
- vessel-mitosis-evaluate.ts:721 bun test gate ABSOLUTE vs delta-aware typecheck ⇒ dev-vessel red baseline blocks meta-vessel edits (16 tests_failed/24h). 998def7 89→82 failures.
- cyclic_flow_scan resolver implemented but in neither DISCOVERY_SHAPES nor impulses.ts dispatch — orphaned; check-shape-dispatch only checks agreement between the two.

### 09-12 auto-minted child gaps monopolize the compose lane
- keys: narrowing-duplicates, spend-envelope-throughput, false-verification (instrument), gap-content
- Journal token counts inflated 10-20x: failure-class name embedded in gap id (`recommit-route-edit-7dccfd08-semantic_reject`) so each `[gap-falsifier] updated` re-counts; single gaps stamped 560+x/24h. TRUE: semantic_reject 30, zero_behaviour_delta 24, patch_with_tools 24, poisoned 17 vs FAVORABLE 172; fc-anchor-provenance REFUSED blind-edit 53.
- 400 open gaps: 228 (57%) auto-minted from compose failures (81 route-edit, 81 recommit-child, 66 narrowed-child). Top-2 edit sites take 57% of cap=1 lane (substrate-gap.ts 161, execution-traces.ts 137 attempts/24h). Per-gap retry counter cannot see it (growth is distinct gaps per file). identical_repeated_failure excluded 19/831.
- Filed `auto-minted-child-gaps-monopolize-the-cap-1-compose-lane` (remedy: cap admissions per edit_site, `edit_site_saturated`). Not hand-edited.
- METHOD LAW: judge a past event by the artifact AS OF that timestamp (`git log --before`), not HEAD — nearly "fixed" a correct unknown-symbol guard.

### 08-24 autonomous cadence stack was stalled
- keys: dormant-mechanism, write-read-mismatch, env-gating, autonomous-regression (clobber), gap-content
- 834 open gaps, ~78% stale. Chain: gap_lifecycle_scan runs only when rhythm conductor enqueues gap-organizing; registry had ONE rhythm (system-health) with no `family` ⇒ `no_goal_mapping` ⇒ nothing enqueued. Mounted timeShapedRhythm impulses (due must exceed 1.0; first mount dropped silently).
- Then (B) conductor enqueues to `~/.minibob/boredom-queue.json` — WRITE-ONLY ORPHANED queue (nothing drains) ; (C) boredom familyShapes map omits gap-organizing/gap-closing. Fix a7749bd drainBoredomQueue; drained NL goal went HOLLOW (gap_lifecycle_scan is a resolver, not walkable) ⇒ 60a602e FAMILY_RESOLVERS direct dispatch; outcome verified (funnel_history 8→9).
- Autonomous lane CLOBBERED the fix: drained goal text "…EDIT the drafter can LAND" tripped EARLY-EDIT-INTENT → mitosis cutover 6ba576a regenerated file from STALE snapshot reverting the commit (~1-in-5 autonomous-revert pattern). Filed maintenance-goal-text-misrouted-to-compose-2026-08-24.
- Marked resolved THREE times before it held. Rhythms live only in pool volume (no seeder) ⇒ fresh image starts dead; filed rhythm-registry-not-code-seeded-2026-08-24. Manual scan: open 834→251.
- Note 08-04 audit had said boredom rhythm fold pinned at due 0.3003 and gap-closing excluded from staleness — same class, 20 days earlier.

### 08-04 autonomous commits break tests undetected
- keys: autonomous-regression, false-verification, test-residue-live-state
- 4fa92b3 (Substrate Autonomous, 07-30, gap substrate-self-push-poller_wedged) made repairSignatureOf async; caller fixed, tests not (7→9 failures); undetected 5 days. No CI on any vessel repo; lint ran only one of six test files; branch protection impossible (403 plan). 192 autonomous commits/30d.
- Operator decision "Leave it" ⇒ achievable goal is detection not prevention.
- Method: bisect an out-of-band oracle (run suite at old commits); traces never tell you.

### 08-06 autonomous detect-and-resolve proven — envelope divergence (4e5d37f)
- keys: write-read-mismatch, human-surface-escalation, false-verification, node-locality, endpoint-routing
- First no-hands detect→draft→gate→land→deploy: `llmExtractPointerArgs` read resolver_schema `sj?.content` but dev-vessel answers `body` ⇒ AUTHORITATIVE PAYLOAD CONTRACT never attached. One-line fix `sj?.content ?? sj?.body`. Worked. But substrate's own verification (grep journal for a string that is never logged) was absence-satisfied.
- human_input squatter: dev-vessel `human-input.ts` answers "consult the human" with GET /v2/notes (404) note counts; goal-host picks `vessels[0]` positional. 0 posts measured.
- intervention_evaluate (S3 push-away) mute on spoke: METABOB_ENDPOINT/CONCEPT_DB_ENDPOINT default loopback, masked by role ⇒ DEFER "priors unreachable". A DEFER is not consent.
- Reachability gaps: detection 13, resolution 0; closed only by expiry; "Close substrate gap reach-gap-X" goals satisfier-resolve the repair shape bare → success:true UNFAVORABLE, targetMet (name-set membership) satisfied, gap stays open. 0/4,654 paths route through gap_to_feature.
- Credential incident: `cat ~/.metabob/config.json` printed keys; rotation needed.

### 08-28/29 autonomous gap-investigation dispatch confirmed live, hollow (11 fixes)
- keys: goal-walk-floor, false-verification, composition-crystallization, write-read-mismatch, sync-deploy-drift, trace-store-db
- Autonomous "investigate and decompose gap <id>" goals fire; floor reached with groundedOk=0 on LLM narration; REUSE LINEAGE "(not yet storable)" borrowed path 7dae833af19b717d.
- Fix #7 9cc89fd isGapInvestigationGoal + extractInvestigationSymbols → citation oracle reachable (deterministic:code-investigation-cited/uncited). Worked mechanically.
- Limitation: citation oracle satisfied by coincidental file (a test fixture containing "failed_attempts") — filed citation-oracle-accepts-coincidental-not-defining-citation (unfixed).
- Fix #8 6d96a81: floor return `verdict.completion_shapes ?? produced` — `??` doesn't fall back on [] ⇒ shapes=[] ⇒ unindexable reaches. Live-validated.
- Operator near-miss: docker cp fix into /vessels made content_hash(runtime)==clone so pull-sync logged synced=0 forever while process ran old code. Law: pull-sync convergence is content-hash not process-identity.
- Repair-side confabulation: "Close substrate gap …" goals reached on memoryNote claiming "Implemented a fix" with no code change; filed close-gap-repair-goals-confabulate-fixed-with-no-code-change; recursive case observed on itself within minutes.
- Fix #9 05e0c87 isGapRepairGoal ORed into existing deterministic:edit-intent-no-landed-edit gate (MUTATION_VERB lacked close/author/resolve). Validated on 7+ gap ids, zero FP (TP direction untested).
- Fix #10 785293c Wilson-lower-bound pathway ranking (pathway-rank.ts). Validated cross-goal reuse (24/24).
- Concurrent session f34547e: extractionPolicy/pathwayReusePolicy had no producer (decorative law-1 reads) — fixed.
- Fix #11 activity-api 86a776d: `?? null` for option<string> fields reused_from_goal_hash ⇒ POST /v2/goal-paths 500 on EVERY fresh pathway write (third failure mode of same field family; sibling field already fixed with comment). Explains zero cross-gap reuse.
- Net: after ~14h zero cross-gap REUSE LINEAGE and zero landed autonomous repairs.

### 07-30 autonomous gap loop unstarved
- keys: gap-content, narrowing-duplicates, write-read-mismatch, sync-deploy-drift
- ~60% of 252 gaps confab/stale. Fixes dev 76f44ca admitActionableGaps (before pickMostLandable); retire phantom typecheck gaps; store-identity leak: appendComposeLesson wrote gap back with hardcoded category missing_capability + summary "per-gap failure lessons updated" overwriting real gaps (30+ junk gaps). goal-host 9651fc3 walk-artifact filing guard. Purged 58 confab gaps (253→195).
- Diverged-clone wedge: unpushed autonomous commit 2ce50a5 (3 push retries lost to origin) silently wedged pull-sync; filed cutover-stranded-commit-wedges-pull-sync…
- Loop picked a real gap, semantic gate rejected cosmetic fix. Next frontier drafter quality. Route-as-data (ClassRow) designed not built.

### 07-24 autonomous landing clobber and hollow-correct edits
- keys: autonomous-regression, hollow-landing, drafter-quality, sync-deploy-drift
- Mitosis cutover replaces whole file from clone at stale base SHA ⇒ reverts concurrent landings: f50d9bb reverted by bfdd173; operator 7fcbaba (18-line guard) deleted by 1be9f4f within 10 min; re-landed ca52631. FIX CLASS: rebase/3-way apply onto HEAD. (Recurs 08-24 6ba576a, and 09-24 "6ab8271 undid a0ff3d3" per index.)
- Hollow-correct: f50d9bb assigned RegExp never .test()'d; 5ca4f0b merged read verbs into earlyEditVerb — both FAVORABLE. Reach gate verifies plausibility+typecheck not semantics.
- Fixing the stale drafter key made drafters live ⇒ read goals naming files route to live drafter (hazard activated by operator).

### 07-29 autonomous landing quality 83% negative-value
- keys: hollow-landing, false-verification, autonomous-regression, drafter-quality
- 12 of 57 autonomous commits audited: 2 substantive (d5b8968, 9b2cbdc), 4 inert, 5 hollow, 1 wrong. 5/57 package.json-only commits greened (apply_proposal_as_patch applied no source; cutover shipped version bump). 5/5 hollow = write-only (54f30e1 info.health TS2339 landed ⇒ typecheck gate blind; aff20ea uncalled fn; 09b49f2; 18833a3; ec9fc01 field not in INSERT whitelist). 91f27c6 appended :lineCount to goalHashOf (wrong but settled, not reverted).
- Fix 9caa43c target-touched floor; baseline TS2339 removed. Residual write-only-hollow: coaxed 36d6db8 landed core, dropped carve-outs ⇒ operator hand-landed 2839585. Escalation apply_failed→patch_with_tools coaxed daf6d36 had runtime crash (.includes on object) — operator corrected 38f9505.
- Law: close-rate ≠ landing quality; coax→READ-THE-DIFF→complete; typecheck-pass ≠ runtime-safe with loose types.

### 08-06 autonomous loop is consistent not productive
- keys: hollow-landing, false-verification, selection-learning, memory-recall, gap-content, trace-store-db
- 261 autonomous commits/7d; semantic gate 323 runs (45% addresses:false); 294 rejected vs 11 landed_verified; 192 closed gaps: 104 expired, 75 unlabelled, 8 landed_verified. Latency median 79h p90 328h; 33 reopened.
- 305 failing tests across 4 vessels all substrate-detected, all unresolved; systematic_failure had no repair route (later retired 08-06 audit: falls to default route w/ boost).
- 7e6fd80 hollow: filtered dev-vessel GET /shapes which nothing fetches (advertisement via discovery-registration.ts:72). dd34918 second-order hollow: `'conceptDbReachable' in config` always false. Law: on_live_path means "code executes" not "is the mechanism"; right-law/wrong-site → right-site/wrong-wiring.
- Working learning loop = lesson channel feature-compose.ts:1700 compose-lessons.jsonl + concept-db, recalled at :1766. Drafter pass rate 0%→76% 08-01..08-05 (correlation). Concept-db recalls 459 ok vs 1212 FAILED; falls open to local jsonl capped at last 60 lines.
- Reach-write root cause 4 breaks (AET-only tag write; `missing` field undefined on SCHEMAFULL `execution`; view doesn't project reached; updated from empty AET). 0ad5dfc landed by substrate on 4th dispatch (prior 3 failures plumbing: poisoned baselines from own residue, .git/index.lock race). Observable, not credited.

### 08-27 autonomous loop landed the unsound rescue clause (inert)
- keys: autonomous-regression, false-verification, memory-recall (rejection had no runtime reader)
- a803852 autonomously landed `reconcileDerivations(a,b,recipeRescue?)` self-confirmation clause the advisor rejected; inert because call site passes 2 args. Latent landmine.
- Law 8 at meta level: "unsound, do not land" lived in openspec/conversation, no read-at-use channel for composer. Fix = code gate enforcing 30cbd14 invariant.

### 09-02 autonomy criterion met and the landed fix was inert
- keys: hollow-landing, drafter-quality, false-verification, write-read-mismatch ("missing readers")
- 776391a Substrate Autonomous, FAVORABLE, post-land suite 829/0, pushed, restarted — S2 criterion met. Change dead 3 ways: `exports.substrateGap.emit` invented API; `exports` undefined in ESM; bare `catch {}` swallows. Correct in-file pattern (HTTP POST substrateGap_write) existed at 3 sites.
- feature-compose logged "TARGET HAS NO TEST FILE … FAVORABLE means reviewed, never executed" (cites d96e2ae that hung vessel) — nothing gates on it. "Not missing information, missing readers."
- Gap `autonomous-land-produced-an-inert-fix-on-a-file-with-no-test-coverage` (hollow_land); remedies: gate on warning; unresolved-identifier check.

### 09-05 a vessel restart silently kills an in-flight compose (retracted)
- keys: autonomous-regression(no), drafter-quality, test-residue-live-state, calibration-seal
- joinDecisionOutcome fix dfc6d04 landed autonomously; pre-written test 7/7 (5/7 fail on unfixed); production falsifier met (approach_decisions entry outcome.landed). Worked.
- Retractions: restart didn't kill the compose (slow ≠ dead); applier relocation costs attempts not outcomes. What stands: applier relocates a verified anchor (scope-blind splice TS2304) ⇒ bumpFailedAttempts + updateCalibration(category,false) feeding hopeless() seal at 8/0.
- dev-vessel restarted 47x/24h (cutover deploys). Running `bun test test/resolvers/gap-to-feature` wrote 59 lines into tracked gaps/gaps.json — test-pollution live.

### 07-30 avg-threshold route + broken trunk incident
- keys: goal-walk-floor, false-verification, autonomous-regression, codebase-bloat-fossils (route-as-data)
- avg-threshold route landed (1c5f59f, f3953c0) compositional 5/8→6/8 via operator direct edit; autonomous route authoring blocked by oracle-drift hazard ⇒ route-as-data (ClassRow) proposed (task #15) — designed not built.
- Substrate landed 2 tsc-broken commits (7b3168e dup `let` — dedup edit INVERTED its intent; 4fa92b3 async un-awaited). ROOT: mitosis gate VACUOUS for goal-host: staticEvaluate default scripts=["lint"], goal-host has only `typecheck` ⇒ "Script not found" with zero TS errors ⇒ empty signature subset passes. Fixed 530c1e9 resolveCheckScripts + fail-closed on Script not found. Law: a gate that runs the wrong (absent) check reports GREEN; fail CLOSED when it can't prove it executed.
- Sync topology: running vessel = /vessels copy, pull-sync mirrors src, (then) did not restart.

### 08-12 a write-shaped goal is graded on the write, not the content
- keys: false-verification, goal-walk-floor, composition-crystallization, selection-learning, node-locality
- Complexity ladder harness validation/scripts/complexity-ladder-harness.ts: reach holds, correctness falls at 2; rung 4 persisted literal template "X, Y, Z". memoryNote reach bar = persistence.
- Re-measured with LLM live: still 0 producer steps; rungs 1 & 3 share path_signature 4502429f465d532f; inferGoalTargetDecision returns deduped Set ⇒ transformation count enters no code path.
- Differentiation mechanism EXISTS: computeStateSpaceSignature (activity-api session-context.ts:154) folds provenance — inert on write side (input_impulse_shapes ~4% of traces) and shadowed on read side (goal-host passes cached global signature keyed on loadedConceptIds, not goal content). Dormant-mechanism.
- Wrong copy 3rd time: spoke masks activity-api; trace instruments must default to hub.
- Harness lessons: discovery GET /shapes returns its own 4; use /registry/stats totalShapes; goal-host serves 4 routes; poll activeDispatches (~50 window).

### 09-05 a wrong edit_site is sticky
- keys: gap-content, write-read-mismatch, drafter-quality
- Localizer (gap-to-feature.ts:3524 localizeGap useLlm) targeted a path quoted as EVIDENCE in summary (activity-api/src/config.ts); two attempts rejected correctly by semantic gate. Rule: never put another file's path in a gap summary.
- substrateGap_write FLAT pointer form drops classification_metadata while reporting success (gapFromFlatPointer); NESTED `gap:{…}` form preserves (09-09 correction); falsifier always resolver-recomputed.

### 08-24 B1 and B3 falsified by live measurement
- keys: selection-learning, false-verification, trace-store-db, write-read-mismatch, sync-deploy-drift
- B1 (correlation attribution) inert: 0 organic executions with correlation_id; ias-executor activity-api-adapter.ts dropped r.correlation_id (fixed 66f0322); thompson_selection_log only written by /recommend, walks use discover-by-shapes (no log) ⇒ join covers minority. Universal per-execution capture e2c7959 mig 202 ⇒ 561 organic decision_outcome rows; then decision-calibration reader 03e6c55 (first reader).
- B3 validator template registered via POST was volume-only, wiped by seeder reconcile to SHARED_TEMPLATES; fixed 4f83bdb. discover-by-shapes param is `mode:backward`; `direction:` silently ignored.
- `activity_execution_traces` FROZEN since 07-14; live table `execution`.
- α-frozen β-pump on infra arms (auth_resolve_v1 α=1 β=401646) from telemetry reached:false; fixed 018784f isReachInapplicable ⇒ ungraded. Triangulated proof.
- Over-diagnoses: executed_at fix f48b4b5 redundant (created_at existed). Three wrong root causes in one session. Edit gate "false wall" (ias-executor-ts not gated).
- Shell quoting through docker exec strips quotes ⇒ false-empty SQL. `grep` aliased/broken in env.

### 08-16 blame was annihilated at the draw
- keys: selection-learning, false-verification, trace-store-db, env-gating, memory-recall, federation-p2p, sync-deploy-drift, test-residue-live-state
- goal-host index.ts:5636 drew (rand^(1/α))/(rand^(1/β)) — not Beta; blame term drops out ⇒ α=1,β=113 arm P(>0.5)=50% vs 0%. More failures ⇒ more reuse. Fixed d69a4ad. Law: check the TRANSFORM/draw, test moments.
- Hub convergence gate caught operator test regression (env hidden in own shell); flaky-suite detection.
- Retirement had 4 reasons it never fired (sole caller route nothing posts; reads execution vs ingest writes AET; <20 rows; rows[0] on flat array throws). Fixed e2d7077+1d83bf5; not proven live.
- Split write in one ingest handler: total_executions moves, α/β no-op when org mismatches ("public").
- False reach rung 2: resolveVesselHealthReport defaulted vessel_id "analysis-vessel-local"; test ASSERTED the default. Fixed 1170047. Law: a test that pins a silent default pins the confabulation.
- Shaped policies in `policies/` inside git work tree (gitignored) erased ~50 min after seeding; bodyHonestyPolicy fallback all along. Need POLICY_ROOT outside work tree. Reader+producer+storage all must survive.
- Io 45-dispatch failure was target inference (prose route), never entered execution. Fix 0223842 temporal deixis. Law: check whether execution was ever entered.
- http_response fake capability (hardcoded httpbin 404) ⇒ substrate re-minted http resolver 3x (12 orphaned files); 10/82 gap-scenario files literal `null`. Fixed 5be029a delegate to web_resource.
- Relay recall bimodal (3 ok/2 fail); fix 2dcfc12 retry null.
- Three propagation paths: vessel src (pull-sync + restart deferral), glue gen-env (only at container start), policies (none, erased). Verified-live 3 of 7 changes.
- Prune: 1-id DELETE 239ms vs 25-id 3,155ms; batch=1 queue explosion (320 in flight, load 13.4); reverted 07e32d38. Trace store 446,705 vs cap 150,000, sweep deletes zero. Design change needed.
- reached:false doesn't retract mid-walk memoryNote writes (two false notes persisted); memoryNote has no tombstone.
- concept overloaded shape (dev-vessel pattern-mining vs concept-db prose).
- POST /v2/activities/feedback unreachable with documented key (Missing organization context).
- walkBudget/lessonExecutionPolicy readers w/o producers fixed f87f52f. Law: a reader without a producer is not a law-1 fix.
- success_rate int/int truncation, 438/1059 impossible values.
- Edge banking: composition arm α=1 β=5 after 8 execs; satisfiers record no consumption (consumedBy None).

### 08-25 blocker resolution push — audit gaps filed
- keys: selection-learning, drafter-quality, spend-envelope-throughput, false-verification
- 6 gaps filed (learning-credit-lacks-marginal-attribution, reach-grader-starves-real-work-executions, variant-sprawl-splits-selection-evidence, selector-audit-checks-saturation-not-differentiation, composer-cannot-edit-large-files-marginal-anchor-loss, executor-rendering-non-uniform-llm-drops-unloaded-inputs) + oracle-corpus-header.
- validator-dispatch Beta(151324,585779) mean 0.205 vs exit-success 0.939; +30 execs with α/β frozen.
- Tier-1 landing (2-line removal d6c2a84) autonomous ~15 min; goal_status reported failed/interrupted while commit landed (self-edit false-fail). Hard tier (7 dead switch arms in large file) op_count=0; patch_with_tools timed out.
- "Cutover churn" refuted (NRestarts=0) — it was COMPOSE-LANE CONTENTION: operator dispatches queue behind autonomous loop.
- Substrate's own close of reach-grader gap hollow-reached via universal-tool-fallback; gap stays open. Keystone = large-file edit capability.
- git blame saved a wrong fix (commented guard deliberate) — later reversed 08-26 (design said NEVER the LLM judge).

### 09-05 boredom dispatches a hardcoded template with a crushed posterior
- keys: selection-learning, env-gating, endpoint-routing, hollow-landing, false-verification, dormant-mechanism
- scaffold-and-publish-vessel α=6.05 β=8585, 1/7981 success; dispatched by boredom `vesselAdditionScaffoldDispatch.ts:22` const SCAFFOLD_TEMPLATE_ID + hardcoded RUN_GOAL_URL 127.0.0.1:8210 ⇒ bypasses Thompson; 82% of terminal dispatches carry no learning signal, 83% of those this arm.
- Substrate autonomously landed guard 314f228 — inert twice (matches `t.identifier` non-existent field; `?limit=200` capped at 100). Operator's own first draft had the limit bug; replaced 4e17f86; ALSO inert — guarded a door nothing walks through (traffic doesn't pass through that resolver; 0 logs/6h).
- Deprecation unenforceable against pinned dispatch: by-id fetch doesn't filter deprecated; 1,218 retired/1,231 deprecated templates still runnable.
- Near miss: widening auto-promote prune would retire mitosis-tick (0.088) and draft-gap-closing-activity (0.276) — live caller passes prune_failed_out:true min_success_rate 0.6.
- Correct chokepoint: ias-executor goal-host.ts:~897 `dispatchTargetTemplateId` marks every selection bypass; audit-dispatch-target-drift reads it only for audit.
- Instrument errors: VPM field names activity_id/thompson_alpha; CONTAINS not substring; goal-host /resolve takes top-level type. total_executions inflated ~155x.
- Law: verify both the DATA path and the CONTROL path (is the check on the path traffic takes); door-test on an already-retired arm.

### 08-14 both autonomy axes proven live; inert diff closure is the frontier
- keys: hollow-landing, composition-crystallization, false-verification
- Mint 404→200 learned-composition-vessel-health-report-to-memorynote-write after 4 stacked fixes (8d960a8, f3c7028, 62acd51, fc559be, IMPULSE_RESOLVE_TIMEOUT_MS=30000). Landing bafd83d closed gap-env-gated-write-allowlist — but only renamed WRITE_ALLOWLIST→WRITE_ALLOWLIST_ENV (inert) and re-landed 69d680b. Gap-close detector accepts inert diffs.
- No learned composition earns promotion above satisfier floor (satisfiers preempt); success_rate display broken.

### 08-16 built but not resolved — the fan-out credited itself
- keys: sync-deploy-drift, false-verification, write-read-mismatch
- substrate-pull-sync.sh fan-out assumed consumers symlink shared `@avigopal/ias-executor-ts`; only dev-vessel did; 5/6 consumers (incl. ribosome, goal-host) had real copies ⇒ stale dist 11 days (Aug-5 vs Aug-16); health passed, LAST_GOOD written, disarming the freshness retry. Fixed c6d2212a (copy dist, hash per consumer, withhold LAST_GOOD). Every ias-executor change inert in ribosome+goal-host for 11 days.
- "Correct fix, nothing changed" 3 causes: stale propagation; redundant non-binding guard (depth cap four stacked limits; three fixes inert); mis-aimed unique anchor.
- False rejection (β-penalizing correct work): wrong-registry-count field chosen by /\bvessels?\b/ anywhere — SIXTH instance; 97 wrong-registry-count verdicts/24h; each earlier fix encoded the symptom. Invariant: take the field from the counting clause.
- Missing detector: for every producer/consumer link assert the consumer resolves producer's CURRENT output.

### 08-08 cadence chain has two breaks and rebind can answer wrong
- keys: memory-recall(pool split), write-read-mismatch, dormant-mechanism, human-surface-escalation, false-verification, composition-crystallization, test-residue-live-state
- Standing pool split across FOUR files by WORKSPACE_ROOT (/workspace/pool/standing.json 18,997 entries 12 rhythms vs super-repo pool conductor reads 143/0). boredom-queue.json 446 pending 0 executed no reader (later: vestigial; boredom reads due-state directly).
- Migrated rhythms; 11/12 fired. Then the substrate picked the operator's gap "standing-pool-split…" and "merged" files: universal tool fallback + auto-bridge-fileWriteResult bypassed satisfier refusal ⇒ wrote to wrong path, live pool restarted EMPTY 20:35:45 ⇒ all rhythms + rhythmFamilyGoal lost. Cadence dead since (08-24 note finds it dead again).
- Laws: "consolidate N copies" gap = instruction to do destructive merge; HOLLOW grades the answer not side effects; guard on one plane is not a guard — enforce at the write.
- gap-closing rhythm staleness pinned to stored 0 ⇒ due 0 forever (alpha 1187.5). 462 open gaps, auto_closed 0.
- Lexical rebind answered with donor's field (.units vs stock) and banked poison; fix f1ef8b9 insufficient; fresh derivation also wrong (jq line counting). Law: with no verifier for a family any plausible answer is certified AND banked; locate the verifier before touching reuse.
- Zero-shot 10 goals: reached 6/10, correct 4/10. Walk fixes d575161, 744ecd8, d5095b9, 5648250.
- Gaps: boredom-queue-is-write-only…, standing-pool-split…, lexical-rebind-silently-answers…, csv-goal-reached-true-with-no-file….

### 08-27/28 calibration seal and narrowing livelock (index + full record)
- keys: calibration-seal, narrowing-duplicates, env-gating, human-surface-escalation, drafter-quality, false-verification
- hopeless() (gap-to-feature.ts:778-781) hard-`continue`s by CATEGORY off /workspace/expectation-calibration.json when attempts>=8 && lands==0; bumpFailedAttempts→updateCalibration(cat,false) on every non-landing attempt including triage-only handlers (documentation_drift triage-only unless DOC_FIX_AUTOLAND=1 — env-gated). 11+ categories sealed (orphaned_capability 346/0, forward_model_artifact 20/0, unreachable_producer 17/0, detector_coverage_gap 16/0, documentation_drift 11/0, and 8/0 ones). Self-sealing. Code contradicts own comment ("penalty not hard exclusion").
- gap_needs_human escalation answer never read by hopeless() — question with no reader.
- recommit-* gaps hardcode category systematic_failure (feature-compose.ts:2340, healthy 68%) ⇒ outrank everything ⇒ 73 composes/12h on two targets, 0 landings.
- Narrowing (gap-to-feature.ts:1988-2014) copies parent verbatim + failed_attempts:0 ⇒ outranks parent forever (X/X-narrowed thrash).
- Drafter locates but cannot invent on large files ⇒ give transcription. Inverted boolean `updateCalibration(category, !isNoLandCategory)` staged into running copy, caught by live-sync rollback; container vs source md5 diverged.
- 08-28: operator's measurement gaps (detector_coverage_gap) structurally unclosable: 12 filed/0 closed.
- fc-coverage detector (feature-compose.ts ~3610) exact-basename only ⇒ misreports gap-to-feature.ts (6 suites) as untested; filed.
- Gaps filed: unseal-documentation-drift-replace-one-line-in-hopeless, narrowing-a-chronically-stuck-gap-copies-it-verbatim…, category-counter-outlives-the-per-gap-counter…, calibration-counts-killswitch-invocations…, recommit-gaps-inherit-a-healthy-category…, the-hopeless-escalation-asks-a-question-whose-answer-cannot-unseal.
- Escalation-after-refusal path landed 52452e0 over semantic-gate UNFAVORABLE and destroyed a week of reach_history.

### 09-05 capability gaps expire before they are ever attempted
- keys: gap-content, spend-envelope-throughput, calibration-seal, false-verification
- missing_capability n=450: 82% expired, 4% ever composed (vs edit_intent_route 83% composed). Land rate 3.1% measures attrition. Fix fbf7433 (hasNoAttemptEvidence) deployed, observed.
- Forecast: converts silent deletion into visible backlog: ~42/day new no-attempt gaps; lane ~48 composes/day, one effective slot (effectiveCap=max(1,cap-1)).
- Refuted unifying story "expiry and hopeless are same trap" (sealed categories expire less).

### 07-19 causal credit and authorship lineage
- keys: selection-learning, composition-crystallization
- propagateCreditAlongChain (posterior-update.ts:102-169) TD(λ=0.7) along composition_chain (execution ancestry), cap 4. Decision-time counterfactual only for gap landings (predicted_p/predicted_land in approach_decisions). HOLE: credit doesn't flow along authorship lineage (`extracted_from` stamped by ribosome.ts:591,609). Needs signed lineage credit; prerequisite graded reach.

### 07-25 causal intent four-layer persist root
- keys: write-read-mismatch, trace-store-db, sync-deploy-drift, composition-crystallization
- goalSignature onto minted templates: a8005ba dead top-level SELECT; 5c5a6b1 (self-authored) stamp; 530265c (self-authored) POST persists metadata (zod strip); migration 182/874104b DEFINE FIELD metadata — ROOT: SCHEMAFULL activity table silently drops undefined fields. Feed ef87c88; pull-sync cb28e450 content_hash blind to sql/*.surql (migration-only commits undeployable). Proven by probe round-trip.
- Gaps filed incl. no traced landing path for .json/.surql edits (feature_compose .ts-only).
- Law: verify by downstream use (fetch persisted artifact); onion peeled one layer per fix.

### 07-25 causal intent topology edge + queryable pool
- keys: composition-crystallization, memory-recall
- goal-host ced125b: composite trace metadata goalSignature + servesIntent; goalWalkState poolProvenance. Worked. Residual: ribosome-extract.json should emit metadata.goalSignature.
- Substrate self-closed walk_tier-illegible via 3-file fix e6bf483+mig181.

### 08-08 ceiling vs floor — two nulls and an invalid outcome variable
- keys: false-verification, composition-crystallization, selection-learning, drafter-quality
- A/B ablation.disableReuse: ceiling 5/6 vs floor 5/6; compounding test ceiling worse. Artifacts wrong: notes stored goal text/narration while graded reached; oracle compares recompute to the WALK's reported value, not the artifact. Filed reach-grades-the-walks-claim-not-the-stored-artifact. Law: reached not a usable outcome variable until artifact verified.
- Payload synthesis via LLM falls back to narration template (index.ts:7649) when plane dead.
- Oracle β-penalized correct work: \bdiscovery\b matched path ⇒ wrong-registry-count; fixed ba5f733 — fifth instance; guards encode symptom not invariant.
- Satisfier-plane reuse now fires 5/5; candidate-plane tie-break fired 0.

### 07-27 chain depth architectural cap
- keys: goal-walk-floor, composition-crystallization, codebase-bloat-fossils (probe templates)
- Pool SHAPE-KEYED (index.ts:2312 Set, addToPool no-op on present shape, progress=set-growth, 2-no-progress break) ⇒ fresh chain depth bounded by distinct shapes; target inference ≤3 end shapes slice(0,3); binary derivation split. 3 four-step goals reached but HOLLOW (max_chain=2). Operator probe template learned-composition-fix-verify-probe-2607 selected in every walk (pollution). Gaps: gap-shape-keyed-pool-caps-composition-depth, gap-multistage-pipeline-collapses-to-hollow-green, gap-leftover-probe-templates-pollute-cold-walks.

### 08-10 claim 1 unmeasurable while the cooldown self-rearms
- keys: spend-envelope-throughput, federation-p2p, memory-recall (operator reasoned from own stale note)
- Hub migration (syzygy.host → 104.236.0.175) kept 312,645 executions. Anthropic credit-dead; cooldown deadline re-armed by ambient fleet traffic. 502 `empty libp2p resolve` = credit wall (vessel withdraws llm_completion when quota-gated) wearing transport clothes.
- Later superseded: RunPod then OpenRouter wired ~07:00. Law: a recorded blocker is a claim with a timestamp.
- metrics/trend exit-status 86.4% ≠ claim 1.

### 08-08 claim 1 powered null + eight instrument errors
- keys: composition-crystallization, false-verification, selection-learning
- Claim 2 (adaptation) demonstrated 15/15; claim 3 hollow 1.5%; claim 1 (reuse compounds) POWERED NULL 40%→37% n=51. Chain: no verifier → no reach → no donor → no adaptation (git_commits 9/24→21/23 after verifier). Lexical pre-filter 0.5→0.15 then retracted as headline (13th error: donor scarcity not retrieval key).
- d9a2597 multi-occurrence substitution + prefilter both needed (restored 91df0e7). Law: never conclude a change did nothing while another blocker on the same path is closed.
- ROOT one line: `void fileMissingVerifierGap(goal)` (goal-host index.ts:2976) guarded by isQuantitativeRepoQuestion ⇒ missing-verifier gaps never filed for families lacking verifiers (0/109).
- Pattern: failures reporting as ABSENCE (8 instances): concept recall [] for "couldn't ask", discovery timeout = no producer (98.5% shellResult monoculture), DB probe RETURN 1 certifying saturated DB (16 activity-api restarts/6h).

### 08-04 classifyReach reads tags only; detector was blind
- keys: selection-learning, write-read-mismatch, autonomous-regression, human-surface-escalation, false-verification
- reach-classify.ts:32 makes every goal-host walk ungraded; POST /reach (zero callers) writes `reached` COLUMN nothing reads; targets legacy AET, canonical `execution` write labelled optional mirror; view v_paradigm_execution_traces doesn't project reached.
- POST /reach returns 200 {updated:0} on no match — operator shipped green that can't fail (3rd time).
- Reach rate 16% (16/82) vs 90% contract.
- host-pull-sync.sh detector keyed on super-repo gitlink diff ⇒ blind to 271 submodule autonomous commits/7d; fixed bb573355. In-container pull-sync (actual deployer) runs no test suite.
- Dead write: effectiveTags mutated after walk (index.ts:9500-9502) ⇒ execution_path/walk_tier never written.
- R3: oracleLabelWritten latch (index.ts:9704) set before human branch ⇒ human verdict never applied; provide_feedback GET trips latch. 0 HUMAN reach overrides/48h.

### 08-29 closed is not load-bearing — four false-close paths
- keys: false-verification, gap-content
- 914 closures: 631 TTL expiry (69%) (closed a livelock gap hours before its fix landed while live); `condition_verified_fixed` emitted by no code (operator hand-write); Class-3 commit provenance closes on fix+revert; empty array reads as healthy ('absent'). Repair-verified 17/914 = 1.9%.
- Predicate contract can't express non-empty/below-N/x<y ⇒ reach_history inflation (414,944 claimed vs 19,288 ever) inexpressible.
- Laws: point measurement vs distribution; check what emits a string; static grep misses await import; page returning your limit is a page.

### 08-11 closing the phrase route moved the misroute to the symbol route
- keys: drafter-quality, gap-content, goal-walk-floor
- dd1195b closed the prose-phrase route restating goals onto goal-host's own source; next dispatch landed on the SAME wrong file (goal-host index.ts) via last-resort symbol route on stem "mint" scraped from English (symbolCandidatesFromGoal, 4+ letters). Law: the destination is the attractor, not the route — enumerate other paths. Guard should key on provenance (scraped vs verbatim).
- Operator's own comment/string filter reverted (duplicate of parallel agent's fix; claimed benefit nonexistent; removes locators).

### 07-19 coax blocked by drafter apply floor
- keys: drafter-quality, hollow-landing, spend-envelope-throughput
- LLM funding restored (groq/mistral failover); blocker moved to apply: net-new files → feature_compose has no create-file op → satisfier:fileWriteResult/codeInsertResult writes a vault note ⇒ hollow reached:yes (gap-edit-intent-filewrite-satisfier-shadows-compose); existing file → anchor hallucination + patch_with_tools fs_edit malformed args ×3 ⇒ honest red.

### 09-16 cold boot loses all 121 dev-seed templates
- keys: sync-deploy-drift, dormant-mechanism, false-verification
- development-vessel-seed.service:20 lacks After=identity-seeder ⇒ 121/121 upload 401, Restart=no; warm volume hides it. Siblings (bootstrap-seeder, concept-db-seeder) have it. Lost templates are self-development meta-activities. Unit exits 0 while 9 templates fail on rerun.
- substrate-live's three seeders failed since 09-09 (NRestarts=10), fleet "healthy" due to warm volume. No CI workflow boots the image.
- Not filed as gap on purpose: compose lane can't target units (bootstrap tier exception).
- df in sandbox ≠ docker host.

### 07-26 cold floor raised to parity
- keys: goal-walk-floor
- Harness validation/scripts/eval-ablation-harness.py: cold floor 2/4 (cache-dependent). c7870bd degenerate-result re-synthesis; 6157be4 '0' degenerate for count goals. Floor 4/4 twice, warm 4/4. Outcome: worked (on a held-out 4-goal compute suite; later audits show floor 51% zero cycles etc. — narrow suite).

### 09-03 component isolation beats inference — concept search
- keys: memory-recall, trace-store-db, false-verification, drafter-quality
- concept-db semantic search missing 2000ms budget ⇒ lexical 0 ⇒ feature-compose plans with no principles ⇒ mechanism behind inert commits 776391a and 62e66a7 (invented APIs). /health 6.7ms throughout.
- Three wrong attributions (embedding LRU cache 78311ad shipped, not bottleneck; HNSW fine; scalar filter already fixed). Component timing: every part fast, composition 30x slow.
- RESOLVED: sibling call sites of the scalar-beside-index class never fixed: hydrate WHERE id IN $ids full-scan 4.92s→0.28ms (c404069); lexical content @@ AND org_id 7.07s→0.825s (fd645bd). End-to-end 8-12s → 0.66-1.9s; now returns the resolver contract concept.
- Laws: measure the composition boundary; a liveness ping is not a health check; scope acceptance to the defect; grep sibling call sites when fixing a class.

### 09-16 compose lane down — placeholder arm, policy pin, empty-key crash
- keys: env-gating, selection-learning, endpoint-routing, sync-deploy-drift, autonomous (success)
- feature_compose 400 at fc-decompose (89 in 30 min): llmModelPolicy rev 21 pinned feature_compose to gemini-2.5-pro arm existing only due to operator's placeholder GOOGLE_API_KEY; α/β never moved on 89 failures (fire-and-forget learning edge). Setting key "" crash-looped llm-resolver (index.ts:381 comment says don't continue; code passes ""). Blank ≠ absent; delete line in both env files (.substrate-secrets resurrects).
- Unit runs IMAGE path, landed commit doesn't change runtime until rebuild (this era).
- Loop worked: route-edit-fd914210 → 61ae51b Substrate Autonomous one-line fix pushed.
- feature_compose without pointer.gap fails semantic gate CLOSED (contract divergence gap). Cutover refuses protected vessels discovery + identity ⇒ can verify but never land (gap protected-vessel-compose-has-no-landing-path). goal-host misrouted edit goal to shellResult (confidence 0.6).
- Hub self-anchor fixes aba286bd; zero-intervention hub+spoke federation validated.

### 07-29 compose loop self-locked — botched landing cascade
- keys: autonomous-regression, false-verification, drafter-quality, sync-deploy-drift
- 3 botched autonomous landings: bd397db scope guard existsSync on RELATIVE path ⇒ refused every plan incl. repairs (self-lock); 4831d08 mis-anchored block inside a call-arg literal ⇒ syntax break ⇒ tsc parse-bail masks others; gap-to-feature guard mis-scoped + unimported lstatSync.
- Gate hole: staticEvaluate signature-subset; TS1xxx parse-bail truncates error sets ⇒ dirty(parse)→dirty accepted. Fixed d9dc467 (unblock) + 05450e6 (hasParseBail fail closed). 7 pre-existing failures surfaced; filed mitosis-gate-does-not-run-touched-resolver-tests.
- Everyday-compositional reach 71% (5/7) by independent recompute.
- MCP cockpit down (revoked key; ApiKey vs Bearer scheme); raw internal routes used.

### 07-29 compose loop stall — watchdog marker pollution
- keys: dormant-mechanism, env-gating, write-read-mismatch
- gap-compose demoted to watchdog; stall check = max mtime of WATCHDOG_ACTIVITY_PATHS (drain-log.jsonl + compose-lessons.jsonl); GapDrainObserver retrying two 500ing dispatchable gaps every 75s kept drain-log fresh (`__drainBackoff` read, never set) ⇒ compose watchdog never fired; 1794 open intents starved. Fix: env WATCHDOG_ACTIVITY_PATHS=compose-lessons.jsonl in drop-in (e216d355) — an env-var fix (law-1 tension). Units baked in image (Dockerfile COPY) ⇒ need both source and live drop-in.
- Law: flow watchdogs must read a signal specific to their own flow.

### 07-26 composite inputShapes leak fixed
- keys: composition-crystallization, write-read-mismatch
- Minted learned-composition templates unbindable: activity-api POST /templates inferInputShapesFromPrompt harvested shape keywords from ribosome's LLM description (shape-inference.ts:379-388); lossy trace sink drops per-task inputShapes. Fix 8b88856 pin input_shapes=[] for learned-*. ~83 poisoned rows remain; durable root (sink) open. Probe template left as junk (later polluted every walk — 07-27 note).

### 07-30 compositional reach 1/8 — hollow-green fix
- keys: false-verification, goal-walk-floor, composition-crystallization
- Two-op compositional reach 1/8; single-op 14/14. Operator's own deterministic parsers greedily matched substrings ⇒ alpha-credited wrong answers (verified-total_lines 8708 vs 7767). Fix c467e5f isCompositionalGoal guard. Law: an oracle that parses must refuse a goal it can only partially parse.

### 07-31 composition topology assessment (corrected)
- keys: composition-crystallization, selection-learning, false-verification, narrowing-duplicates
- `activity.metrics.total_executions` dead column (0/3846) ⇒ false "frozen ceiling". Truth in variant_performance_metrics: 162 composites executed, 101 successful, 46 α>5. Ribosome duplicate-variant extraction (learned-<composed-cap-X> cold twin); B2 deliverable-shapes FLOOR=5 filter (intended); tierFromChain stamps learned_pathway on failed chains.
- boredom `sort:"disposition_scored"` param dead but compensated.

### 08-07 composition works, domains do not
- keys: goal-walk-floor, composition-crystallization, false-verification
- chain_winner_lines 15/15 reached, 11/15 correct, 15 classes → 1 signature. chain_count_into_title 7/15. git 0/15 (refused by isQuantitativeRepoQuestion honest-refusal gate; git_log advertised unused); registry 0/15 (target inference collapsed 27/40 to shellResult). Reuse before mint violated by omission (300+ advertised shapes unused).

### 07-31 compounding loop state + reuse hop fix
- keys: composition-crystallization, endpoint-routing
- 266/424 learned rows output_shapes ["tool_output"] from prose inference ⇒ unselectable; fixed d1bb036 (derive from tasks). Residuals filed gap-ribosome-reuse-hop-cold-blocked (backfill, near-dup id suffixes, cold-start bonus, extraction targets rare chains).
- MCP auth scheme ApiKey vs Bearer; curl fallback recipes.

### 07-26 compute binding floor hardening
- keys: goal-walk-floor, drafter-quality, federation-p2p
- (A) routing fix 179dfa9; (B) synthesis prompt conflict 10e20ae; (C) satisfier binds file content as shellResult (not fixed; later judged mostly plane degradation). Relay NO_RESERVATION flap; local key credit-exhausted.
- gap-compute-goal-naming-repos-file-misroutes-to-edit-intent (recurs: 08-04 read-only goal routed EARLY EDIT-INTENT; 08-24 maintenance goal text misrouted to compose).

### 07-26 compute floor verified, plane recovered
- keys: goal-walk-floor, sync-deploy-drift, composition-crystallization
- 3/3 compute battery exact. Earlier failures substantially plane degradation.
- NEW: mitosis cutover restarts goal-host immediately killing in-flight dispatches (8 cutovers/15 min, 3/4 goals killed) — gap-mitosis-cutover-interrupts-in-flight-dispatches (recurs 08-04: 32 restarts/day; fixed later by quiesce/drain but 09-24 drain lame-duck 11+ min).
- analysis-vessel derive step hollow (can't read /workspace file; mis-selected auto-bridge composite) blocks topology growth.

### 07-29 confabulated external URL passes all gates
- keys: drafter-quality, hollow-landing, false-verification, endpoint-routing
- patch_with_tools escalation landed 0b80f1be: retryFetch in wrong place, duplicate fetches to hardcoded fake https://concept-db.com (egress risk), double res.text(). Passed target-touched, write-only-hollow, typecheck. Reverted bba209f.
- DETECT 33381f1 (Check C in detectArchitectureViolation, advisory); coax version da06433 was hollow no-op (split('+') on char; return inside forEach) + broke tsc baseline. PREVENT 7d9e39c: patch_with_tools injects in-file *_ENDPOINT constants (law 8).
- Law: structural gates ≠ semantic correctness; verify the diff on every dispatch.

### 07-29 confabulation fix landed + baseline break
- keys: drafter-quality, autonomous-regression, false-verification
- patch-with-tools.ts:554 single prompt choke point feeds three ungrounded paths. Advisory "go search" refuted as law-8 violation (fights anti-search nudge) ⇒ inject facts. 44c104b fixed baseline broken by autonomous da06433 (null-deref, inert). Gap da06433-external-url-detector-inert closed by 33381f1.
- Authorship gotcha: operator hand-commits in container clone authored "Substrate Autonomous" — indistinguishable in git log.
- Lesson: even the fix for confabulation gets confabulated (self-similar class); standing origin/dev tsc==0 detector needed.

### 08-02 confabulation is in the PLANNER, not the applier
- keys: drafter-quality, gap-content
- compose-report `spec` field: planner emits line-number-addressed plans ~4700 lines off with invented "current" code, because the localizer picked the wrong region and verbatimExcerptBlock supplied that region. Applier re-anchors (occurs==1) — "repaired:true" = real place for fictional edit.
- Hunk count predicts failure, not file size: single-site edit on 10,260-line file landed 154390b. Discriminator: verbatim old→new plan lands; line-number plan fabricates. Rule: one site per goal; constrain planner to verbatim form.
- Refuted: model choice (haiku turn 3 vs sonnet turn 14 both green), 52928b8, anchor staleness, producibility precheck.

### 09-18 conformance loop converged — deterministic frontier
- keys: composition-crystallization, endpoint-routing, gap-content, human-surface-escalation, false-verification
- Replay-conformance: 6eed100 exact-hit selection (mul 7/18 → 3-4/4); 2e8b4cc (substrate-authored) strike eviction (evict only on deterministic markers, 2 prose strikes); 0d86170 + 51b34a6 artifact oracle — compose REPLACED the mul branch instead of inserting (FAVORABLE landed diff silently broke the one conforming class).
- Boundary law: crystallized knowledge immune to model collapse (cached classes 8/8 under nano models); frontier acquisition not.
- Defects: discovery row poisoning (local-tools endpoint dead :21016 while lastSeen refreshed ⇒ every fleet compose refused at grounding ~45 min) — heartbeat ≠ socket proof; gap rewriter destroys operator specs then false-closes already_resolved w/o checking expected_literal; operator gaps starve (humanWeight only for source human_reported); probe-miner drowns in code-heavy gap text.
- Stale-note trap: idempotent rewrite doesn't bump updated_at.

### 08-07 containment guard rejected the definition-site fix
- keys: false-verification, drafter-quality, human-surface-escalation
- Operator's 973b7f6 region-containment gate required literal region string; rejected correct fix (definition line 1743) twice while admitting two wrong patches (ad706ce, d90318f reverted). e04764c widened one hop (define→use edge). Gate wrote `suspected_real_location` into next prompt, steering drafter at wrong line — removed.
- Operator's guards: 4 false positives vs 2 catches — each encoded the symptom not invariant. Landability decay: reverts spend the gap's selection budget.
- human_reported provenance lost on re-detection (re-created as substrate_detected).

### 07-27 content threading = function composition alignment
- keys: goal-walk-floor, composition-crystallization, memory-recall, drafter-quality
- Threading exists (poolVars→runTemplate; engine interpolation) but compute satisfier bypassed it: shellResult command LLM-synthesized from goal text. Keystone f5827b1 interpolates {{shape}} placeholders in exec command. 0499da1 EXTRACT-FROM-SOURCE route. fb9b1e1 detectArchitectureViolation (advisory). Pending: safety-net seeds shellResult sole target; findSimilarReachedGoal; concept search slow. fileContent loses path (fs_read unwraps to string) ⇒ keystone can't thread path.
- Deepest direction: computes as selectable deterministic activities.

### 07-27 context-thompson frozen — deep grounding (not fixed)
- keys: selection-learning, write-read-mismatch, trace-store-db
- 159bca7 (07-22) gated conditional posterior on honest reach; goal-host traces carry no reached tag ⇒ ungraded ⇒ both VPM and context_thompson_scores writes suppressed. goal-host never POSTs /reach; /reach doesn't apply posteriors; seek.executionId synthetic ≠ real exec rows (TranslatingTraceSink in ias-executor package); signature=None. Safe fix requires 1+2 together. (Recurrence of this class through 08-04, 08-06, 08-26.)

### 08-26 controlled intervention — grounded+keyed atom verified
- keys: composition-crystallization, write-read-mismatch, dormant-mechanism, goal-walk-floor
- registry-count goal reached via deterministic oracle, 385 three-way agreement; keyed traces stored; reuse attempted, honest fall-through.
- New cold classes: vessel count collapsed into existing signature; extension-filtered counts abstain (verifyCountFilesReach scope); file-count command mis-scoped to super-repo root; independent-recompute.ts:26 builder+oracle share one parse (not independent).
- Correction: verifier-recipe store /workspace/state/verifier-recipes.jsonl has 34 runtime-minted recipes (distinct-file-extensions agreed 0→19). Operator's negative from a 24h window was wrong.
- DEEPEST ROOT: recipe REUSE path write-only: `_useRecipe` never engages (index.ts:4183) — 0/4 proven families reused; candidate maturation broken. 4 families ever. missing-verifier dedup in-memory, never consults store. missing-verifier routes to feature_compose (expensive).

### 08-12 convergence runs in-container; host sync retired
- keys: sync-deploy-drift, codebase-bloat-fossils, docs-drift
- host-pull-sync.timer retired permanently (no quiesce; restarted into composes). In-container substrate-pull-sync quiesces, runs suites, ratchets baseline.
- Stalls: five clones pinned by abandoned drafts (activity-api router.get appended twice after export default in Hono — wrong-framework confab; goal-host deleted 21-line retry block; scratch/backup files); stale UU index entry. Preserved to /home/avi/substrate-clone-preserve-2026-08-12/.
- "Hub disk 99% full" was a gap summary citation never measured (3rd relay-of-citation-as-measurement).

### 08-25 creation routing fix landed substrate-authored
- keys: goal-walk-floor, drafter-quality, sync-deploy-drift, narrowing-duplicates
- isEditIntentGoal (goal-intent.ts:44) lacked creation verbs; substrate-authored 13f7440. Self-edit dispatch false-fails (cutover restart interrupts its poll).
- Create path: drafter emitted kind:"edit" for absent file ⇒ ENOENT; operator 632955a absent-target edit→write; grounding gate (feature-compose.ts:2790) refused net-new basenames — first "proof" 3afb1812 was retry-after-debris; fixed 578b831 + 3c6a4b3; clean-state 4839607 landed. Reliability 3/4 (lo-spec hallucinated export).
- Stale-proposal re-application: interrupted dispatch's staged proposal landed later ⇒ two competing commits 0e29710, 0c11b13 (route id keyed on goal text hash). Test files left on origin/dev (goal-intent.{reliability-control-6,sweep-a,sweep-b}.test.ts) — residue.
- Bare git stash popped someone else's WIP.

### 08-10 credit mixing implemented; failing test is fixture gap
- keys: selection-learning, test-residue-live-state
- TD(λ) fully implemented, λ from tuning row TD_LAMBDA (law-1 compliant). posterior-decay test fails because seedPriorFromConcepts unmocked. Method: walk every conjunct of a guard.
- Mint-rate guard env-only (referenced).

### 07-30/31 cross-substrate interop audit (14 rounds)
- keys: federation-p2p, env-gating, endpoint-routing, spend-envelope-throughput, human-surface-escalation, docs-drift
- Duplicate-genres openspec 0% implemented; discovery /resolve candidates[0]; placement env-frozen (apply-inventory.sh ENABLED_*); LLM_PINNED_PROVIDER read by nothing. 11 gaps filed; one record VANISHED from store.
- 7e051d7 duplicate-policy landed after 4 coax attempts + operator exact-edit spec (law 13 tension); cutover refuses protected vessels ⇒ operator hand-landing.
- distribution_policy keystone 6ab2e24 (operator hand-land, billing dead); transport ingress 24ac13e2; walk satisfier-pick 9225c54. PEER_FANOUT_MODE env const gates peer visibility (law 1). ~10 resolvers hardcode host.docker.internal:2718x.
- MAJOR CORRECTION round 8: "spoke→hub broken" for multiple rounds was WRONG-DOOR (discovery :8100 local-only by design; fan-out at :8401).
- Anthropic credits exhausted 07-31 ⇒ compose lane down; compose lane pinned to single LLM arm. Flagship autonomous landing dd13b69 (egress always appended) — but self-cutover deploys only the dispatching host (other substrate needs manual convergence). 6815f82e nested content-error repair loop; cc192274 substrate-authored invalid-model cooling (credit wire auto-closed). 2e10fde9 demand-driven redial. Relay keep-alive churned (no ping responder) → reverted → 46b3304d + af8a79e2 two-step keep-alive; storm eliminated over one predicted window.
- Relay is manual scp, not pull-synced; `systemctl restart federation-relay` silently no-ops. API_KEY_SECRET_PREVIOUS unset (latent 401 on rotation). concept_write duplicate producer (dev-vessel demo) shadows concept-db.

### 09-18 crystallization mechanism proven end to end
- keys: composition-crystallization
- Novel reached → identical goal REUSED from reached-command cache (consult lines 20→4) → survives restart → variant reached at consult 5. Non-contamination: 4 wrong products refused by recompute gate, cache evicted on graded failure. Outcome: worked (mechanism). Path store keyed by goal-text hash while shape signature unused (related).

### 07-24 cwd fix and efficiency roots
- keys: sync-deploy-drift, env-gating, trace-store-db, codebase-bloat-fossils
- Satisfier shell ran in /workspace (stale shadow checkout) — fixed by env WORKSPACE_ROOT=/workspace/git/super-repo (env-based fix). Note 09-22 index: WORKSPACE_ROOT split produced two memory stores (unit vs env-file) — same variable, later recurrence.
- CPU root: execution-traces.ts:2716 redis.del(CACHE_LIST_KEY) on every score update ⇒ full template scans ~15 cores; fixed a4735e9 + migration 180 created_at index. Second root: activities.ts:1063 all-or-nothing TTL (filed). 09-24 note: templates list Redis id-set never invalidated → 6 days stale (inverse failure of same cache).
- concept-db re-applies all migrations every restart (no ledger); draft-gap-closing-activity 100% fails via boredom_target_template tag; execution_trace_content 435,488 rows 96% orphan 22G.

### 08-03 cycle 3 — fallback overrides hollow; gate prose hole
- keys: goal-walk-floor, false-verification, drafter-quality
- 10 verdicts: 5 confirmed, 9/10 proposed fixes regressions. universalToolFallback `return uf` precedes `return walk` ⇒ LLM-only verdict overrides honest HOLLOW; 37/37 fallback reaches with 0 tools; verifyGoalReached called without walkEvidence ⇒ hollow cap unreachable. Both obvious fixes are regressions (groundedOk gate removed on purpose).
- Operator's egress gate: removedHosts harvested comments under whole-file pseudo-diff ⇒ exempted hosts named in comments. Fixed at call site. Law: reusing a diff-shaped check on a whole-file pseudo-diff changes its meaning.
- llmCall-endpoint misroute already covered by vessel-mitosis-cutover.ts:941-952 — check for existing gate first.

---

# SYNTHESIS — grouped by problem-class key

Recurrence dating below spans only this shard (07-19 .. 09-24). "Recurred" = same root reappearing after being declared fixed.

## write-read-mismatch (the dominant class in this shard)
Instances (each a producer writing where no consumer reads, or a consumer reading where no producer writes):
- 07-24 redis.del(CACHE_LIST_KEY) emptied the template list on every update (a4735e9) → 09-24 inverse: list id-set never invalidated, first page 6 days stale (1f58320, 55cd36d).
- 07-25 SCHEMAFULL `activity` table silently dropped undefined `metadata` field (mig 182); 08-06 `missing` field undefined on SCHEMAFULL `execution` (reach-write break 2).
- 07-27 → 08-26 reach verdict never reaches the posterior: goal-host computes `reached` but never POSTs /reach (07-27); /reach had zero callers (08-04); /reach writes the `reached` COLUMN while classifyReach reads TAGS (08-04); writes to decommissioned AET (08-06: 0ad5dfc's UPDATE matched 0 rows forever); /reach doesn't call applyOutcomeToPosteriors (08-06 BP-1); `void fetch` loses ~13% (08-26 spool ea78fd7). Five successive "fixes" of one edge.
- 08-04 effectiveTags mutated after walk serialized them (execution_path/walk_tier never written).
- 08-04 human verdict latch: automated label wins, provide_feedback never applied.
- 08-06 7e6fd80 filtered GET /shapes nobody fetches; dd34918 read `config.conceptDbReachable` which lives on a module `let`.
- 08-08 boredom-queue.json write-only (446 pending, 0 readers); standing pool split across 4 files, conductor read the empty one; 08-24 AGAIN: conductor enqueues to write-only queue, rhythm lacked family, boredom familyShapes omitted gap-organizing.
- 08-16 shaped policies (bodyHonestyPolicy, walkBudget, lessonExecutionPolicy, extractionPolicy, pathwayReusePolicy) had readers and no producers (08-06 audit: four policy shapes no producer; 08-16 f87f52f; 08-28 f34547e) and the policies/ files were erased from a gitignored dir in a cleaned git work tree.
- 08-16 fan-out LAST_GOOD marker disarmed freshness retry; 5/6 consumers stale 11 days.
- 08-24 decision_outcome: zero readers until 03e6c55; thompson_selection_log only written by /recommend, walks never log.
- 08-26/27 verifier-recipe store: recipes minted (34 lines, one re-verified 19x) but `_useRecipe` never engages — READ SIDE DEAD.
- 08-27 "unsound, do not land" lived only in openspec/conversation; autonomous a803852 landed it (inert).
- 09-02 feature-compose logs "TARGET HAS NO TEST FILE" and nothing gates on it: "not missing information, missing readers".
- 09-05 wrong edit_site: flat substrateGap_write drops classification_metadata while reporting success.
- 09-23 boredom grades ticks by `findings`/`gaps_emitted` keys ⇒ detector with own vocabulary scored idle; picker lessons bonus reads per_gap_failure_lessons (no writers).
- 09-24 gates read the stale SUBMODULE copy while ops apply in the push clone.
Root pattern: no declared producer↔consumer contract is checked at runtime; every link is found by hand after the fact (08-16: "Detector still missing: for every declared producer/consumer link, assert the consumer resolves the producer's CURRENT output").

## hollow-landing
- 07-24 f50d9bb RegExp never .test()'d; 5ca4f0b merged verbs into wrong regex (both FAVORABLE).
- 07-29 audit 83% negative value (2 substantive/12); package.json-only commits greened; write-only fields.
- 07-29 0b80f1be fake URL; da06433 hollow detector; 08-06 7e6fd80/dd34918; 08-14 bafd83d rename-only closes gap; 08-27 a803852 inert rescue clause; 09-02 776391a invented `exports.substrateGap.emit`; 09-05 314f228 guard on nonexistent `t.identifier` + capped page; 09-18 compose replaced a working branch.
- Gates added in response: target-touched floor 9caa43c; write-only check 36d6db8/2839585; 05450e6 parse-bail; semantic gate `on_live_path` (proved insufficient 08-06); detectArchitectureViolation advisory. Each blocked one symptom; the class recurred each time at a new grain (symbol → parameter → branch → field name → page size).
- Operator-authored hollow too: 09-05 operator guard 4e17f86 inert (guarded a door nothing walks through); 08-26 CREDIT_PROPAGATION_EXCLUDED_ANCESTORS no-op until authored.

## false-verification
- Oracles grade the walk's CLAIM not the artifact (08-08 ceiling/floor nulls); write-shaped goals graded on the write (08-12, rung 4 persisted "X, Y, Z"); satisfier self-grades (08-06 BP-2, 52% of paths); fallback overrides HOLLOW with LLM judge 37/37 zero tools (08-03); ReAct fallback reached with 0 tool calls (08-03 cycle 2); self-confirming file-count oracle (08-04); citation oracle satisfied by coincidental fixture (08-28); repair goals confabulate "implemented" notes (08-28, fix #9 05e0c87).
- False rejection (β-penalizing correct work): wrong-registry-count field chosen by word anywhere — 5th instance 08-08 (ba5f733), 6th 08-16; "each fix encoded the symptom".
- Gap closure: 69% TTL expiry, repair-verified 1.9% (08-29); provenance closes on fix+revert; empty array = absent; `condition_verified_fixed` has no emitter; landed SHA re-closes reopened gap (09-22); gap rewriter false-closes already_resolved (09-18); 09-23 own detector closed rows via copied `detector` metadata on -narrowed clones.
- Test gate: never rejected (0/180), aggregate per-vessel delta, bypassed by MITOSIS_DIRECT_PUSH (08-06); `timeout 240 bun test || true` discards exit code; vacuous typecheck gate ("Script not found lint" ⇒ empty signatures ⇒ pass, 07-30, fixed 530c1e9); TS1xxx parse-bail subset hole (07-29, 05450e6); fc-coverage misreports suffixed tests (08-28).
- Semantic gate flipped on identical bytes (09-23).

## selection-learning
- Thompson draw was not a Beta variate (blame annihilated, 08-16 d69a4ad); α-frozen/β-pumped infra arms (08-24 018784f); classifyReach fail-open legacy-success (08-04/08-06); context_thompson_scores frozen since 07-21 (07-27); total_selections 0 on all arms (fire-and-forget UPDATE, 08-06); success_rate int/int truncation {0,1} amplified by composition-graph.ts (08-06, 08-16); planner confidence uninformative (08-06); boredom pinned dispatch bypasses Thompson for a 1/7981 arm (09-05); deprecation unenforceable against pinned dispatch; llmModelPolicy pinned arm α/β unmoved over 89 failures (09-16); all human_reported gaps one Thompson class (09-24); authorship-lineage credit absent (07-19); reuse fires but does not compound (claim 1 powered null 08-08).

## calibration-seal
- hopeless() category seal from /workspace/expectation-calibration.json (08-27): 11+ categories sealed at 8/0, triage-only and kill-switch runs count as failures, human escalation answer unread; recommit gaps hardcode healthy category. 08-28: operator measurement gaps (detector_coverage_gap 16/0) structurally unclosable. 09-05: applier relocation feeds updateCalibration(false) ⇒ seal. Live pick 09-05: hopeless_excluded 59/237.

## narrowing-duplicates
- 08-02 autocatalytic route-edit nesting (`summary: goal`), fixed 154390b etc; 08-06 still 81-deep nesting (794 rows); 08-27 narrowing = verbatim copy + failed_attempts 0; 09-12 57% of open gaps auto-minted children (81 route-edit/81 recommit/66 narrowed) eating cap=1 lane; 09-23 `childMeta = {...meta}` copies detector ⇒ false closes; 08-25 stale proposal applied twice (two commits). Failure class name embedded in gap id inflates journal counts 10-20x (09-12).

## gap-content
- Gaps born with wrong edit_site from evidence paths (09-05); flat write drops edit_site/falsifier (09-05/09-09); "consolidate N copies" gap caused destructive merge (08-08); missing-verifier gaps never filed outside covered families (08-08 fileMissingVerifierGap gate); capability gaps expire before attempt (82% expired, 4% composed, 09-05); 60% of 252 gaps confab/stale (07-30); store-identity leak overwrote real gaps (07-30); predicate contract can't express non-empty/below-N (08-29); code-heavy gap text drowns probe-miner (09-18).

## drafter-quality
- Planner line-number fiction (08-02; hunk count not file size); drafter locates but cannot invent (08-27); invents APIs despite 3 in-file exemplars (09-02) because concept search returned empty (09-03 root: index-defeating scalar conjunct, fixed c404069/fd645bd); confabulated external URL (07-29, 7d9e39c injection); symbol route scraping English stems (08-11); multi-line anchors dead due to numbered window (09-23 2f2ba0f); create-file kind:"edit" (08-25); coaxed drafts land core and drop carve-outs (07-29); runtime crash under loose types (07-29 38f9505).

## dormant-mechanism
- Oracles live but uncovered (08-03); cyclic_flow_scan orphaned (08-02); mirror-to-live exists, nothing invokes (08-09); retirement never completed its body (08-16); computeStateSpaceSignature fold inert (08-12); verifier-recipe reuse (08-27); attrition gap_lifecycle_scan dormant-but-armed (09-05); duplicate-genres openspec 0% (07-30); clock-vessel/ias-executor declared-only (08-06); remedy-effectiveness-observer detector didn't prevent recurrence (08-09); route-as-data ClassRow designed not built (07-30); cold boot loses 121 seed templates silently (09-16).

## spend-envelope-throughput
- Compose lane cap=1 (effective 1), ~48 composes/day vs ~42/day new no-attempt gaps (09-05); operator dispatches queue behind autonomous loop (08-25); BUSY non-attempt reported as failed (09-05); credit-dead LLM cooldown re-armed by ambient traffic (08-10); Anthropic credits exhausted 07-31; LLM ~50% success HTTP 200 on failure (08-04); change_window lease monopolized by trace-store-reconcile (08-09 → 09-23/24 RECURRED; root 946034c placeholder blanking 09-15→09-24).

## sync-deploy-drift
- Mitosis cutover stale-base full-file clobber (07-24, 08-24 6ba576a, ~1-in-5); mirrored ≠ running (09-05 MainPID; 08-16 three propagation paths, 3/7 changes live); fan-out stale 11 days (08-16); docker cp making content_hash equal ⇒ pull-sync synced=0 forever (08-28); self-cutover deploys only dispatching host (07-31); dirty/pinned clones stall convergence (08-12, 07-30 diverged wedge); host-pull-sync blind to submodule commits then retired (08-04, 08-12); gates read stale submodule copy (09-24); human-surface not a submodule ⇒ unauthorable (09-22); /vessels is image layer; units baked in image; cutover restarts kill in-flight dispatches (07-26, 08-04 32/day) → quiesce added → lame-duck drain 11+ min (09-24); WORKSPACE_ROOT pointing at stale shadow checkout (07-24).

## endpoint-routing
- Tools execute on the hub via DEFAULT_TOOL_DISPATCH_ENDPOINT loopback (08-04); port 8401 unpublished but advertised 18401; hardcoded RUN_GOAL_URL :8210 in boredom (09-05); policy reads via activity-api 404 use_vessel_discovery (08-06); discovery row poisoned by dead endpoint while heartbeat refreshed (09-18); wrong door :8100 vs :8401 (07-31); METABOB/CONCEPT_DB endpoints default loopback, masked on spoke (08-06); host.docker.internal hardcoded in ~10 resolvers (07-31); human_input picks vessels[0] positional (08-06); 248 escalations to pinned :8270 (index).

## goal-walk-floor
- Floor doesn't loop / 0 act-observe cycles 51-55% (08-04/08-06); never traced (0/4,768 rows); excluded for edit-intent; non-2xx fatal vs timeout observation; tools on wrong host; shape-keyed pool caps depth (07-27); target inference collapses to shellResult (08-07, 27/40); Io prose-route classifier never entered execution (08-16); single-op 14/14 vs two-op 1/8 (07-30); reach 16% vs 90% (08-04); zero-shot 6/10 reached, 4/10 correct (08-08).

## composition-crystallization
- Topology grows but unbindable (07-26 input_shapes leak 8b88856; 07-31 tool_output output_shapes d1bb036); ribosome mis-wired (94% "reached"), recursive learned-learned stacking (08-06); duplicate-variant extraction (07-31); ceiling not measurable (08-08); claim 1 powered null (08-08); crystallization proven 09-18 (replay, restart, variant); edge-banking: satisfiers record no consumption (08-16); fresh pathway writes 500 on `?? null` (08-28 86a776d, 3rd failure mode of same fields); path store keyed by goal-text hash.

## memory-recall
- Concept recall 459 ok / 1212 failed, jsonl fallback last 60 lines (08-06); relay recall bimodal (08-16 2dcfc12); concept-db search 8-12s ⇒ drafter plans without principles (09-03 fixed); `concept` overloaded shape; reached:false doesn't retract mid-walk memoryNote writes, no tombstone (08-16); confabulated "implemented" memoryNote could be recalled as evidence (08-28); rhythm registry lost when pool restarted empty (08-08); operator reasoned from own stale memory note (08-10) and prior-session summary (08-24).

## node-locality
- spoke masks activity-api, instruments must default to hub (08-12, 08-04); tools run on hub filesystem for spoke questions (08-04); intervention_evaluate mute on spoke (08-06); self-cutover deploys only one substrate (07-31); host vs container file divergence (07-26 430 vs 512 bytes).

## test-residue-live-state
- running gap-to-feature tests wrote 59 lines into tracked gaps/gaps.json (09-05); dev-vessel suite clean-slates the push clone mid-cutover (09-23 bad7993); test files left on origin/dev by creation sweeps (08-25); probe templates pollute walks (07-27 learned-composition-fix-verify-probe-2607; zzz-stamp-persist-probe); tests that ASSERT defects (08-04 auth test expect 200 on rejected key; 08-16 default vessel_id test); env hidden in operator shell (08-16).

## human-surface-escalation
- human-surface unauthorable (not submodule, 09-22); 248 escalations to replaced :8270; human_input squatter (08-06); hopeless escalation answer unread (08-27); human verdict latch (08-04); human_reported provenance lost on redetection (08-07); operator gaps starve without source human_reported (09-18); attention→reward loop worked 07-27 (obsidian e6206e9).

## federation-p2p
- 07-30/31 interop rounds 1-14 (see note): one-way belief was wrong-door; distribution_policy on three pick paths; LLM spill chain dd13b69→6815f82e→cc192274; relay keep-alive storm fix 46b3304d+af8a79e2; plain REST from spoke dead, only impulse-resolve crosses libp2p (07-27); transport destroys tool_calls at the wire (08-04); 502 empty libp2p resolve = credit wall (08-10); relay manual scp.

## trace-store-db
- Trace store 2x cap (299,517/150,000 08-09; 446,705 08-16), sweep deletes zero, DELETE width vs queue explosion (08-16), retention ~76 rows/h vs ~1,190/h ingest, 74% tickers (09-24); reconcile lease livelock (08-09 → 09-24); AET frozen/decommissioned; execution_trace_content 96% orphan 22G (07-24); concept-db migrations reapplied every restart; `ORDER BY` / quoting traps; hub migration kept 312,645 executions (08-10).

## env-gating
- DOC_FIX_AUTOLAND env kill-switch counted as failures (08-27); PEER_FANOUT_MODE env const hides peers (07-31); MITOSIS_DIRECT_PUSH bypasses test gate (08-06); placement via ENABLED_* env (07-30); WATCHDOG_ACTIVITY_PATHS env fix (07-29); WORKSPACE_ROOT env fix (07-24); constant budgets MAX_ITERS etc (08-06); mint-rate guard env-only (08-10); placeholder GOOGLE_API_KEY created a phantom arm, blank key crash-looped (09-16); boredom 5s env timer (08-06); API_KEY_SECRET_PREVIOUS unset (07-31); DUAL_WRITE_ENABLED unset makes reconcile skip (09-24). Counter-example compliant: TD_LAMBDA tuning row (08-10).

## docs-drift
- Code contradicts its own comments in gap-to-feature.ts twice (08-27) and llm-resolver keyless branch (09-16); feature-compose semantic-gate contract divergence (09-16); vessel-duplicate-genres openspec ratified 07-19, 0% implemented (07-30); CLAUDE.md "runtime state gitignored" inverted intent for policies/ (08-16); operator memory index stale (host sync, syzygy.host) steering wrong (08-12).

## codebase-bloat-fossils
- Probe templates, 12 orphaned http resolver drafts + 10 `null` scenario files (08-16), 1,218 retired / 1,231 deprecated templates still runnable (09-05), learned-learned stacking x21 (08-06), ~424 learned templates with near-dup id suffixes (07-31), 7/10 mitosis overlays of feature-compose.ts (08-04), abandoned drafts pinning clones (08-12), landed sweep test files (08-25), dead columns (activity.metrics.total_executions, activity.ev, success_rate), activity-table posteriors vestigial, AET decommissioned table, boredom-queue.json vestigial, three plain-file vessels duplicating submodule copies (09-22), 3 separate discovery-registration mechanisms (07-31).

## autonomous-regression
- 4fa92b3 async signature broke tests 5 days (07-30/08-04); 7b3168e dedup inverted into redeclare; bd397db self-lock cascade (07-29); 946034c blanked every {{…}} in templates 9 days (09-15→09-24); 52452e0 escalation over UNFAVORABLE destroyed a week of reach_history (08-28 ref); clobbers 1be9f4f / 6ba576a / 6ab8271; 91f27c6 goalHashOf format change left in place; da06433 broke tsc baseline.

## directed-overshoot
- Operator's own guards: 4 false positives vs 2 catches (08-07); operator egress gate prose hole (08-03); operator deterministic parsers hollow-greened compositional goals (07-30 c467e5f); operator-shipped greens that can't fail ×3 (08-04); operator's gap text caused destructive pool merge (08-08); operator fixing drafter key activated read-goal→compose hazard (07-24); operator LRU cache wrong fix reached origin (09-03); batch=1 prune experiment degraded live DB 20 min (08-16); operator docker cp broke pull-sync convergence detection (08-28); placeholder key → phantom arm → compose outage (09-16).

---

# MECHANISMS (general = shared seam; specific = one path). Status as of the latest evidence in this shard.

| mechanism | location | general? | status | evidence |
|---|---|---|---|---|
| Reached-command cache / crystallization replay | goal-host reached-command cache (store-backed) | general | live-used | 09-18 consult 20→4, survives restart, evicts on graded failure |
| Replay strike eviction + exact-hit selection | goal-host (2e8b4cc substrate-authored, 6eed100) | general | live-used | 09-18 converged |
| Deterministic oracle families (registry-count, file-count, avg-threshold, citation, edit-intent-no-landed-edit, compute-artifact) | goal-host index.ts oracles | specific per family | live but coverage-limited | 08-03 0/27 real goals owned; 08-26 registry 385 three-way; 09-18 16 verdicts |
| verifier-recipe triangulation store | /workspace/state/verifier-recipes.jsonl, goal-host `_useRecipe` (index.ts:4183) | general | broken (write-only read side) | 08-27 0/4 proven recipes reused; candidates never mature |
| Compose lesson channel | feature-compose.ts:1700 compose-lessons.jsonl + concept-db, recalled :1766 | general | live-used (degraded) | 08-06 pass rate 0→76%; recall 459 ok/1212 fail |
| Semantic gate (addresses/on_live_path/reachable_symbols) | development-vessel semantic-gate | general | live-used, insufficient grain | 08-06 7e6fd80/dd34918 passed; 09-23 flip on identical bytes |
| Target-touched floor | feature-compose.ts ~L2247 (9caa43c) | general | live-used | 07-29 |
| Parse-bail fail-closed + resolveCheckScripts | vessel-mitosis-evaluate.ts (05450e6, 530c1e9) | general | live-used | 07-29/30 |
| detectArchitectureViolation (env-gate, inline LLM, external URL Check C) | feature-compose.ts (fb9b1e1, 33381f1) | general | live, advisory only | 07-27/07-29; INLINE_LLM residual can't hard-fail |
| Endpoint-constant injection into patch_with_tools | patch-with-tools.ts (7d9e39c) | general | live-used | 07-29 |
| Poisoned-baseline guard (live vs clone) | patch-with-tools.ts:576-580 | general | live-used; no repairer invoked | 08-09 deadlock; mirror-to-live uninvoked |
| Cutover provenance gate | vessel-mitosis-cutover.ts (573461a reads mitosis-pending.json) | general | live-used | 09-22 |
| change_window lease | trace-store-reconcile vs cutover/pull-sync | general | live, repeatedly monopolized | 08-09, 09-23, 09-24 |
| hopeless() category seal | gap-to-feature.ts:778 | general | live-harmful | 08-27/28 11+ categories sealed |
| Narrowing / recommit children | gap-to-feature.ts:1988 / feature-compose.ts:2340 | general | live-harmful (duplicates) | 08-27, 09-12 |
| admitActionableGaps | gap-to-feature.ts (76f44ca) | general | live-used | 07-30 |
| hasNoAttemptEvidence expiry spare | gap_lifecycle_scan (fbf7433) | specific | live-used | 09-05 observed 9/9 |
| Rhythm conductor + timeShapedRhythm + FAMILY_RESOLVERS | dev-vessel rhythm_conductor_tick (a7749bd, 60a602e) | general | fragile; registry not code-seeded | 08-08 lost, 08-24 restored manually |
| boredom-queue.json | ~/.minibob | specific | fossil (write-only) | 08-08 446 pending |
| Gap-compose watchdog | watchdog-tick.ts + drop-in | general | live (env-pinned marker) | 07-29 |
| self_fact_reconcile detector | dev-vessel (983ca92, 4e70cbb) | general | live-used by boredom | 09-23 |
| decision_outcome capture + decision-calibration reader | activity-api (e2c7959 mig 202, 03e6c55) | general | live-used (read-only) | 08-24 |
| thompson_selection_log | activity-api /recommend only | specific | live, blind to walks | 08-24 |
| isReachInapplicable (telemetry ungraded) | reach-classify.ts (018784f) | general | live-used | 08-24 Δβ=0 |
| Beta draw fix | goal-host index.ts:5636 (d69a4ad) | general | live-used | 08-16 |
| TD(λ) credit propagation | posterior-update.ts (TD_LAMBDA tuning row) | general | live; no authorship-lineage edge | 08-10, 07-19 |
| CREDIT_PROPAGATION_EXCLUDED_ANCESTORS | activity-api 5d28ded | specific | dormant (never authored) | 08-26 |
| Reach-verdict durable spool | goal-host ea78fd7 | general | live-used | 08-26 |
| /reach endpoint | execution-traces.ts | specific | partial (observable not credited) | 08-06 |
| activity_execution_traces (AET) | activity-api | — | fossil (decommissioned) | 08-06, 08-24 frozen since 07-14 |
| activity.metrics.total_executions / activity.ev / success_rate | activity table | — | fossil/dead columns | 07-31, 08-16, 08-24 |
| thompson_posterior shape / variantMetricsSummary | activity-api | — | broken instruments | 07-27 |
| universalToolFallback (ReAct floor) | goal-host | general | live, overrides hollow, untraced | 08-03, 08-06 |
| grounding seed + citation oracle (isGapInvestigationGoal, isGapRepairGoal) | goal-target-inference.ts / goal-intent.ts (9cc89fd, 05e0c87) | specific phrasing | live-used | 08-28 |
| Wilson pathway ranking | goal-host pathway-rank.ts (785293c) | general | live-used | 08-29 |
| computeStateSpaceSignature provenance fold | activity-api session-context.ts:154 | general | dormant (write starved, read shadowed) | 08-12 |
| Lexical rebind (tryLexicalRebind) | goal-host | general | live; poison risk; 0/146 later | 08-08, 09-18 |
| Threaded {{shape}} exec placeholders | goal-host f5827b1 | general | live, partially inert (path lost) | 07-27 |
| Ribosome extraction | ribosome-vessel | general | live; mis-wired verdict, duplicate variants, recursion | 08-06, 07-31 |
| learned-* input/output shape guards | activity-api activities.ts (8b88856, d1bb036) | specific | live-used | 07-26, 07-31 |
| distribution_policy | discovery 6ab2e24, transport 24ac13e2, goal-host 9225c54 | general | live (fan-out path missing) | 07-31 |
| LLM spill chain (egress always appended, nested-error repair, invalid-model cooling, demand redial, ping keep-alive) | dev-vessel dd13b69, 6815f82e, cc192274, 2e10fde9, 46b3304d/af8a79e2 | general | live-used | 07-31 |
| Pull-sync quiesce + restart deferral + baseline ratchet + convergence gate | in-container substrate-pull-sync | general | live-used | 08-12, 08-16, 08-28 |
| host-pull-sync.timer | host | — | fossil (retired) | 08-12 |
| Fan-out consumer hash check | substrate-pull-sync.sh (c6d2212a) | general | live-used | 08-16 |
| audit-dispatch-target-drift / dispatchTargetTemplateId | ias-executor goal-host.ts:~897 | general seam | live-unused as gate | 09-05 |
| auto-promote prune | activity-api, called by boredom with prune_failed_out:true | general | live (protective scope) | 09-05 |
| remedy-effectiveness-observer | dev-vessel | specific | live, did not prevent recurrence | 08-09 |
| fc-coverage no-test warning | feature-compose.ts ~3610 | specific | live-unused (nothing gates) + misreports | 09-02, 08-28 |
| missing-verifier filer | goal-host index.ts:2976 | specific | broken gate (never fires outside covered families) | 08-08, 08-27 |
| Attention→reward presentation arms | obsidian-vessel e6206e9 | specific | live-used (07-27) | loop closed with real human |
| complexity-ladder / eval-ablation harnesses | validation/scripts | general instruments | used by operator | 07-26, 08-12 |
| human-surface-vessel (plain files) | super-repo | — | outside the loop until bootstrapped | 09-22 |

---

# PRINCIPLES / LAWS stated in this shard (with source note)

1. A fix that enumerates cases inherits a new bug with the next case (08-09 trace-store).
2. Detection without a repairer that anything calls is a deadlock, not a safeguard (08-09).
3. A reconciler that cannot finish becomes an exclusion lock on everything else (08-09).
4. Never land an audit finding without an adversarial pass; ~90% base rate wrong/harmful; ask for `fix_is_regression` (08-03, 08-03 cycle 3).
5. Spec → adversarial crosscheck → dispatch; ask which rows a fix touches and whether a policy read can ever resolve (08-06).
6. When narrowing admission, enumerate callers across ALL repos (08-04 auth).
7. Verify a loop is dead by querying the artifact it produced, not log absence (08-02).
8. A failed attempt at closing a gap belongs to that gap, not a new one (08-02).
9. Judge a past event by the artifact as of that timestamp (09-12).
10. Mirrored is not running; watch MainPID/ActiveEnterTimestamp; pull-sync convergence is content-hash not process identity (09-05, 08-16, 08-28).
11. Close-rate ≠ landing quality; coax → read the diff → complete (07-29).
12. on_live_path means "this code executes", not "is the mechanism"; right-law/wrong-site → right-site/wrong-wiring (08-06).
13. Landing is solved; verification is not — "not missing information, missing readers" (09-02).
14. A gate that runs the wrong/absent check reports GREEN; fail closed when you cannot prove the check executed (07-30).
15. A write-shaped goal is graded on the write, never on what was written; `reached` is not a usable outcome variable until the artifact is verified (08-12, 08-08).
16. A distribution needs its DRAW checked, not just its parameters; test moments (08-16).
17. A test that pins a silent default pins the confabulation (08-16).
18. Reader + producer + storage must each survive; a reader without a producer is not a law-1 fix (08-16).
19. When a goal fails identically and every fix targets execution, check whether execution was ever entered (08-16).
20. The reach verdict describes the dispatch, not the world it left behind — check the store (08-16).
21. Cheap-per-statement is not cheap-in-aggregate; bound live experiments in advance (08-16).
22. A success marker written on the wrong evidence is worse than no marker (08-16 fan-out).
23. "Correct fix, nothing changed" has three causes: stale propagation, non-binding guard, mis-aimed anchor (08-16).
24. A false rejection is worse than a false reach (β-penalizes correct work) (08-08, 08-16).
25. A gap that says "consolidate N copies" is an instruction for a destructive merge; HOLLOW grades the answer, not side effects; enforce at the write, not the planner (08-08).
26. With no verifier for a family, any plausible answer is certified and banked; locate the verifier before touching reuse (08-08); no verifier → no reach → no donor → no adaptation (08-08).
27. Reuse firing is not reuse helping; never conclude a change did nothing while another blocker on the same path is closed (08-08).
28. A failure reporting itself as ABSENCE is one habit of construction, not N bugs (08-08).
29. A zero read through a filter measures the filter (08-27, 08-28).
30. Treat code comments as intent, never spec (08-27).
31. Give the drafter transcription (verbatim old→new), never a description; one site per goal; hunk count predicts failure, not file size (08-27, 08-02).
32. Closed is not load-bearing; a point measurement disagreeing with a distribution is wrong; a page returning your limit is a page (08-29).
33. The destination is the attractor, not the route — when a fix removes one path, ask what other paths reach it (08-11).
34. A seeder needing a credential must order after the issuer and retry; a warm volume converts a boot defect into a silent one (09-16).
35. Measure every component; when components are fast and the whole is slow, measure the composition boundary; a liveness ping is not a health check (09-03).
36. Blank-but-present ≠ absent for env keys; comment-promises-X-code-does-Y is a class (09-16).
37. Flow watchdogs must read a signal specific to their own flow (07-29).
38. An oracle that parses must refuse a goal it can only partially parse (07-30).
39. A containment check is a causal question, not a substring one; a guard that writes its guess into the next prompt closes a loop on its own error; guards must encode the invariant, not the last symptom (08-07).
40. Inject load-bearing facts; advisory prompt text is not a fact at use time (07-29).
41. Structural gates (touched/caller/typecheck) are not semantic correctness (07-29).
42. Reusing a diff-shaped check on a whole-file pseudo-diff changes what it means; check for an existing gate before proposing one (08-03).
43. A recorded blocker is a claim with a timestamp (08-10); a prior-session summary is a report about a channel, not the channel (08-24).
44. A cooldown re-armed by ambient traffic is an outage with a countdown (08-10).
45. A vessel withdrawing a shape it cannot serve turns a billing failure into a routing failure two hops away (08-10).
46. Before widening any population, read what the LIVE CALLER passes (09-05).
47. Verify both halves: does the check compute correctly, and is it on the path the traffic takes; door-test a mechanism on a case you did not create (09-05).
48. When every improvement to a component is operator-authored, check whether the substrate CAN author it (09-22).
49. A vessel fact's source is the push clone; /vessels drifts with unlanded edits; never trust a copied authorship field (09-23).
50. Probe the exact path the consumer uses; a sibling endpoint's 200 attributes nothing (09-23).
51. When a gate refuses something the file plainly contains, ask which COPY the gate read (09-24).
52. Fix the producer, then verify the reader by reproducing its exact walk (09-24).
53. Probe templates with an observable sink are the instrument for engine-path questions (09-24).
54. Crystallized knowledge is immune to model collapse; frontier acquisition is not (09-18).
55. Heartbeat ≠ socket proof (09-18).
56. An autonomous change can author what operator+advisor rejected when the rejection has no runtime reader (08-27).
57. A self-edit dispatch can never observe its own success (cutover restarts the host); ground truth = commit + running mirror (08-25).
58. Bisect an out-of-band oracle to attribute an autonomous regression; traces never tell you (08-04).
59. Credit discipline must be signed for authorship lineage; wrong mint = negative value (07-19).
60. Operator latitude: "Leave it" (no CI/branch protection) ⇒ goal is detection not prevention (08-04 decision).
