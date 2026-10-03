# Slice R: the goal-reach loop (user ruling 2026-10-02)

> "Any goal being resolved should reach, even if reaching requires prerequisites to be filed and completed first."
> A reach that needed operator diagnosis, hand-armed gaps or hand replays is not success.

## What exists (investigation, origin/dev goal-host acf4922 · activity-api b622270 · dev-vessel 182d2447)
Nothing closes goal → prerequisite → land → re-dispatch:
- No per-goal diagnoser. Every filer is class- or shape-keyed with multi-goal floors.
- `judged_hollow` (23/24 news verdicts) has no filer. `fileCapabilityGap` misdiagnosed it as the phantom `gap-headlines` (falsifier none).
- 0/7,044 gaps carry goal_hash or dispatch linkage.
- Nothing parks a goal on its gaps. `requeueOf`/`resumed_from` are restart-only.
- No re-dispatch on gap close. Closure is judged by unit tests, never by the originating goal.
- No cross-dispatch budget per goal_hash.
- Failure memory only feeds the prompt, and drops exactly the attempts that coincided with gap filing.
- Recovery templates `recover-from-goal-failure` and `goal-execution-with-retry` are declared and dormant.

## The loop (one organ, new file, outside excluded_paths)
`repos/development-vessel/src/resolvers/goal-reach.ts`: an activity selected by a rhythm/boredom condition, so it is graded by traces.

**State.** One `goalReach` record per goal_hash, written through the pool (a shaped impulse, law 1):
- `{goal, goal_hash, origin (operator|surface|autonomous), dispatches:[id], waiting_on:[gap_id], cycles, cost_usd, status: open|waiting|redispatching|reached|stopped, stop_reason}`.

**R1. Observe.** Each tick, read recent non-reached dispatches through goal-host's existing shapes (`activeDispatches`, `goalWalkState`). Read-only. No goal-host edit.

**R2. Diagnose → prerequisite.** For each non-reached dispatch, produce ONE prerequisite per distinct break:
- Inputs: goalReachReason, steps (candidates/excluded/rationale), routeArounds, walkLog, and the trace's `verdict_class`.
- The output is a gap written through `substrateGap_write` with `blocked_goals:[{goal_hash, dispatch_id}]`, an `edit_site` verified as in slice S step 1 (exists, contains the signature, is the writer/reader of the failing joint, not the victim), and a break signature.
- Dedup by (edit_site, break signature): attach this goal to an existing open gap's `blocked_goals` rather than mint a new one. Reuse before mint.
- Abstain honestly: when the break cannot be localized, file a `needs-localization` gap that still carries `blocked_goals`. A goal blocked on an unlocalized gap is visible and counted, never silently dropped.

**R3. Make it actionable.** Hand each linked prerequisite to slice S (`gap_localize`): an authored red test plus control, contained and unprivileged, landing as a depth-1 child, birth sha ⊇ test.

**R4. Wait.** The goal's `status=waiting`, with `waiting_on` set to its open prerequisites.

**R5. Re-dispatch on close.** When every `waiting_on` gap is closed, re-dispatch the goal through goal-host's existing dispatch shape, then read `reached`. `reached:true` → `status=reached`, and the record shows `operator_hands:false` iff no operator write touched its gaps or dispatches. Otherwise go back to R2 with the new dispatch.

**R6. Stop.** Per goal_hash: ≤5 cycles and ≤$X total (a policy shape, accepted interim until L).
- A cycle that produces NO new distinct break, or the same break signature twice, is futile.
- On stop: `status=stopped` with the honest reason (`blocked_by_scope:<paths>` | `futile:<signature>` | `budget`). Each `blocked_by_scope` stop also files a scoped `limitChangeProposal` (slice L's input queue).

## Success criterion (the user's, measurable)
A goal counts as reached by the system only if `status=reached` AND `operator_hands:false` AND it reaches again on a re-dispatch on the OTHER node (no flaky one-node reach).
- Report: goals entered, reached-without-hands, waiting, stopped by reason.
- Never quote a hand-assisted reach as success.
- Fixture set: the news goal plus 4 arbitrary goals not chosen for ease, including one quantitative, one code question and one multi-part. Same set before and after.

## Known blocker, stated now
The news goal's two open breaks (`after-a-hollow-retry-the-reach-judge-grades…`, `a-hollow-synthesis-verdict-widens…`) both fix in goal-host `src/index.ts`, which is excluded. The lane cannot land them, so R will stop the news goal with `blocked_by_scope` and file the limit proposal. That is correct behaviour, not a failure of R; reaching it then depends on slice L (criterion runner) or an operator (a) build. Many walk-machinery breaks will share this. R measures how many.

## Builder / order
1. S (gap_localize) with qa's fix-first (contained unprivileged runner, state-keyed test protection, relevance check, compose depth-1 child).
2. R in `goal-reach.ts`: R1/R4/R5/R6 first (deterministic), then the R2 diagnoser. Operator bootstrap is only registration plus activity template plus condition.
3. Tests for R:
   - linkage dedup;
   - the waiting → redispatch transition fires only when all waiting_on are closed;
   - the futility stop on a repeated signature;
   - `operator_hands` computed from ledger authorship;
   - must-fail: a hand-closed gap does not count as hands-free.

   All red/green.
4. Pre-registered measurement on the fixture set.

## v2 — CONSOLIDATION (2026-10-02 ~21:15Z), supersedes "new organ" above
Prior art (user asked "when have we done this before"): failure-mode-autonomous-loop (05-22, reports only), closed-loop-learning-and-verification (06-01, 0/5 tasks), **recover-from-goal-failure + goal-execution-with-retry (dev-vessel e00f8cf2, 06-04, 603 lines, seeded, DORMANT: nothing selects them)**, fileCapabilityGap (06-25, shape-keyed; minted phantom gap-headlines today), horizon-escalation test (07-21: "parts exist, the SEAM doesn't; operator load-bearing for detect→diagnose→escalate"), escalation-disposition-executor (08-28, spec only), demand_goals (09-28, goal text on shape gaps, 2-goal floor). Each was built once and left without a caller, reader or rhythm.
**R is therefore NOT a new organ.** It is the missing SEAM around the existing ones:
- Re-dispatch = the existing `goal-execution-with-retry` activity (already POSTs a retry to goal-host); recovery-action choice = existing `recover-from-goal-failure`. Revived, not rewritten.
- Goal↔gap linkage = EXTEND `demand_goals` on gap metadata (add `{goal_hash, dispatch_id, origin}` entries; drop the 2-goal floor for linkage, keep it for minting). No parallel `blocked_goals` field.
- New code is ONLY the seam: a `goal_reach_tick` resolver (dev-vessel, new file `goal-reach-tick.ts`, outside excluded_paths) that (R1) reads non-reached dispatches via goal-host shapes, (R4) keeps the per-goal_hash record, (R5) when all linked gaps closed selects `goal-execution-with-retry` for that goal, (R6) enforces cycles/budget/futility and files limitChangeProposal on blocked_by_scope; plus the CALLER (a pool condition "non-reached goals with closed prerequisites, or unlinked failures > 0"), and the READER (the tick's own status record, which the fixture report reads).
- qa's v1 changes all carried: operator_hands three-valued from the landing ledger ROUTE (true/possible/false; only false = success; any non-R re-dispatch = hands); side-effect classification via isWriteShape before re-dispatch (surface-origin goals with landed writes → ask the originating human); array-merge append with expect_status for demand_goals (test: two concurrent attaches keep both); "reaches again on a node serving the needed shapes + same node after an interval"; pre-registered R2 abstain rate.
**What differs from every prior attempt:** a named caller that selects it, a named reader of its output, and a pre-registered measurement on a fixed goal set. None of the 05–09 attempts had all three.

## Reader = behaviour change (qa, 2026-10-02 ~21:25Z)
"Reader" means a consumer that CHANGES BEHAVIOUR on real traffic, not a report. R's reader is the re-dispatch through goal-execution-with-retry, gated on all linked gaps being closed; S's reader is admission (an S-armed gap becomes class2 and is auto-picked). The pre-registered measurement must show both readers firing on real traffic, including "selected by its caller N times in 24h" for R and S. A record written without a behaviour change is the June-template failure (built, seeded, never selected). demand_goals has two writers now: goal_reach entries are tagged {source:"goal_reach", ...} and must not change any existing demand_goals consumer (tested).

## R7 — LEARN: ribosome hand-off (qa, 2026-10-02 ~21:35Z; the user asked "what does this have to do with the ribosome?")
R as designed closes REACH but not LEARN. After R5 reached with operator_hands "false", hand the reaching execution to the ribosome's EXISTING extraction path (no new organ) and record extracted_template_id on the goalReach record. Success criterion extended: for each reached fixture goal, a RELATED goal with changed inputs must reuse the extracted pathway, read from selection's trace (chosen template id = extracted_template_id; walk steps fewer than the original). That is CLAUDE.md's ceiling/middle and REALIGNMENT §7 step 1 extension items 3–4. Prerequisites now visible: the ribosome is unregistered in discovery (register 400 ×79/3h; gap severed-joint-ribosome-registered), and its extraction is fed by self-scan ticks and auth traces with an unseeded eligibility policy (gap the-ribosome-learns-from-self-scan-ticks-and-auth-traces-instead-of-reached-goals). The hand-off records failure honestly while those are open.

## Generality rule for R2 (same ruling)
R2's diagnoser files prerequisites by the GENERAL break class (e.g. "non-reached walk with consumable evidence got no synthesis before judgment"), never by one goal's surface form. Dedup by class signature attaches many goals to one class gap; a class gap's acceptance is that UNRELATED goals in its demand_goals reach, not the one that surfaced it.

## Held-out measurement (qa refinement of the generality ruling)
R's fixture splits into a DEVELOPMENT set (usable while building/debugging) and a HELD-OUT set chosen up front by a recorded rule, sealed by sha256, never dispatched or inspected during development, run only at measurement time. The headline is reach on the HELD-OUT set. A class gap's acceptance ("unrelated linked goals reach") prefers held-out goals where available. Sealed set: /home/avi/.claude/jobs/ac8b0aad/tmp/steward/heldout/ (created by a separate agent; the coordinator sees only sha256 and count until measurement).
Held-out storage (qa): the sealed set lives HOST-side under the coordinator's job dir; verified by effect that no node container mounts /home/avi/.claude or a parent (docker inspect), so no lane process can read it. Only the host-side measurement step reads it, after re-checking sha256; a mismatch means the run is not reported as held-out.
SEALED (2026-10-02 ~21:55Z): /home/avi/.local/share/substrate-heldout/heldout-goals.jsonl (444; dir 700), sha256 0ed9e4dda1b8b78b2b9556cb572550ff5b02283a463006bfce3edff85a602eb5, 13 goals (quantitative 2, code question 0, web/current-info 4, multi-part 3, general/other 4); rule + application in the file header. Limits: the goal-host dispatch store keeps only ~2,001 dispatches (from 09-28), so it is a 4-day sample; 0 code questions qualified. Unread by the coordinator.
Reporting conditions (qa): (1) report held-out reach in two strata — OPERATIONAL (9, the headline) and FIXTURE (4, validation/prompts; benchmark, possibly seen during development); (2) counts with a Wilson 95% interval, never a bare percentage; pre-registered: a change counts as real only if intervals across measurement rounds do not overlap; (3) known limits: 0 code questions, 4-day source window (dispatch store keeps ~2,001); when more history exists, seal a SECOND batch by the same rule (new sha) rather than editing this one.

## L12 note: goal-reach-tick posterior contaminated by idle alpha (2026-10-02)
R wiring pushed (development-vessel fbf35341 + 4814b23f, dry_run default). Until idle-ticks-earn-alpha-because-the-reach-route-drops-the-traces-information-yield lands, light-dispatch's immediate /reach credits every goal-reach tick (idle included) with alpha, so the goal-reach-tick arm's posterior is contaminated from its first tick until <fix sha>. When the fix lands: reset the goal-reach-tick arm to its prior (or exclude pre-fix evidence), and decide the same explicitly for every light-dispatched detector. Verify catalogue presence by effect after deploy (template selectable, first tick traced).

## Standing acceptance probe: reached goals compose (surface session + user, 2026-10-02)
A and B reach → D (their composition) must reach USING A's/B's producers or outputs (provenance in D's pool) and credit them; control D' = D + a never-reached part derives only that part fresh; must-fail: a D whose parts' shapes don't connect is not reported reached. Rerun with different topics (generality rule). First run (node 2): A reached, B reached, D failed fresh_derivation (inference dropped half the goal; generic shape-signature reuse borrowed an unrelated path; outputs released at walk end). Gap: reached-goals-do-not-compose-so-a-goal-built-from-two-reached-goals-re-derives-and-fails. This probe joins the held-out measurement as the LEARN half of R's success criterion.

## Queued for §7 step 8: reconnect the vocabulary "slow loop" (surface session, user-confirmed prior art)
Prior art: 05-17 state-space-signature keying (28/45); 05-28..06-01 concept-db supersession (0/42); 06-04 no-new-shape-minting ruling (unenforced); 06-04 learning-rate #1/#6/#7 (embedding posterior, TD(λ), successor ψ — blend gated off); 06-28 hierarchical signature clustering (activity-api 636e2ff, cluster-posterior.ts; contamination = too-broad detector, but a contaminated cluster is only skipped, never split); 10-01 8257a4a dropped the shape-conditioned priors (graded on exit status) next to f3aba7e's reach-graded counter.
Verified (coordinator, origin/dev): (a) selection DOES read the cluster posterior in code — D5.1 partial pooling replaces a cold leaf (n<5) with the cluster posterior unless contaminated (activities.ts ~6711-6745, ~7043); live firing unmeasured (debug-level log; measure via used_scope="cluster" counts). (b) 8257a4a removed paradigm.ts input-shape-conditioned priors; remaining context conditioning = leaf signature posterior + cluster fallback + f3aba7e counter.
Reconnection (general, not goal-keyed): re-grade clustering/pooling on the reach signal; extend from opaque signatures to intent classes and shapes; split a contaminated class on a NAMED observable condition (producer live/offline, credential, node, slot, precondition) with children inheriting the parent prior, merge indistinguishable siblings; concept-db supersession for words + enforce the no-mint ruling; ψ/TD(λ) for horizon moves. Acceptance: the reached-goals-compose probe + a class that splits on a named condition (reaches where its producer is live, stalls where offline). Sequenced after security, R2 and the landing-gate hole.

## L12 intervention: flow investigation dispatches (2026-10-02 ~23:40Z)
Operator dispatches on node 1 (claude-code-operator) for the end-to-end flow investigation: 57de00ab (count TS files under repos/concept-db/src), 92a530c4 (current system load), b3d1dd39 (summarize repos/clock-vessel + its shapes), 4e4dac67 (development-vessel changes in the last day); re-dispatches to follow. Development set only; held-out untouched. Boredom resumed ~23:15 after the envelope fix, so nothing is attributed to timing.

## L12 intervention: containment of cross-bound satisfier mint (2026-10-02 ~23:52Z, node 1 substrate-live)
- 23:52:47Z ACTION retire attempt #1 via activityTemplate_deprecate (POST /v2/impulses/resolve, ApiKey METABOB_API_KEY, in-container) on activity:learned-satisfier-system-load-report. RESULT 422 insufficient_evidence (global scope + non-admin key requires Thompson winner/loser posteriors). Not fabricated. No write.
- 23:53:18Z ACTION retire via existing activityTemplate_update primitive (allowedFields includes retired/deprecated; global-scope update gate requires an auditable reason) updates {retired:true, deprecated:true}, evidence.reason "contaminated mint: cross-bound impulses (gap concurrent-executions-consume-each-others-impulses-because-slot-binding-takes-the-first-match-from-a-shared-store)", source_trace_ids [exec_pcg54bbs, walk-satisfier-1-1790984267987]. Audit impulse upkeep-1790985199131-vghr2u.
  REASON: contaminated mint; unrelated dispatch 4e4dac67 ran this id as exec_pcg54bbs (23:38:09Z) with a shellResult body.
  BEFORE: retired=false deprecated=false; body ALREADY CLEAN at retire time (tasks resolver=system_load_report, output_shapes [system_load_report]); a later legit extraction from walk-satisfier-1-1790984310337 (dispatch 59cb8b01, 23:38:32Z) overwrote the contaminated shellResult body (updated_at 23:38:56Z). Id is deterministic (learned-satisfier-<shape>), so every satisfier extraction upserts the same row. History: 3 executions under this id: exec_51x6icar (09-26, system_load_report), exec_98mq4kpo (10-02 21:10, system_load_report), exec_pcg54bbs (10-02 23:38, shellResult = contaminated).
  AFTER: retired=true deprecated=true updated_at 23:53:19Z; retired_reason/retired_at NOT set (not updatable fields; reason lives in the audit impulse).
  DURABILITY RISK: POST /templates mints with `UPSERT activity:<id> CONTENT {...}` and activityRecord carries no retired field, so the next system_load_report satisfier extraction can wipe retired (unverified until observed).
- 23:54:00Z ACTION verify-by-effect (a): control dispatch 95ebcce4-0d82-4ee5-923d-a1db5fce2b4a on node 1 (POST :8210/run-goal in-container, operator claude-code-operator, goal "What changed in the development-vessel repository over the last day?"). REASON: confirm the retired id is no longer selectable. RESULT: reached=false (status failed, selected proposed_pattern_authored_concept_relevance_http_backfill; git_log satisfier HOLLOW "not a git repository"); 19 executions under the dispatch, NONE ran learned-satisfier-system-load-report (vs 4e4dac67, which did). BEFORE/AFTER row: retired=true unchanged.
- 23:58:28Z ACTION verify-by-effect (b): pinned dispatch e86b0286-6109-454d-8344-69f83bdfc457 with targetTemplateId=learned-satisfier-system-load-report. RESULT: REFUSED before execution; goal-host journal "[ActivityApiTemplateProvider] refusing to load ...learned-satisfier-system-load-report for execution: retired=true deprecated=true"; surfaced error reads "not found in shared catalogue or activity-api" (misleading message, refusal is correct). 0 execution rows. Node 2 (compose2-live) not tested.
- ~00:00Z item 3 THROTTLE: NO WRITE. No shaped concurrency knob exists for ribosome-extract (see report); did not invent one.
