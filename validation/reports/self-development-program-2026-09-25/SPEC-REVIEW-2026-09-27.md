# Spec review, 2026-09-27: what prevents rapid, stable, reliable, reachful autonomous operation

All 97 active changes under `openspec/changes/` were reviewed newest first, in five slices, each
read against live `origin/dev` where a check was cheap. Per-slice findings are below the synthesis.

## The one-sentence answer

The code lane the system actually self-develops through (gap → edit → land → verify) was never
specified in any of the 97 changes. Specs went into detection and posterior mathematics; detection
grew far faster than closure. The rest of the diagnosis is one loop that keeps the operator
load-bearing.

## The loop

A detected gap carries no edit site and no machine-checkable falsifier (97 % of the open gaps
today; the detectors emit categories, not sites) → a landing cannot be verified against the
gap's condition (08-14: 0 of 30 closures had a checkable falsifier; one gap re-landed 5× in two
days) → no reward event reaches selection (consequence-verdict-into-credit never built; the
causal ledger observes outcomes but settlement is not wired into posteriors) → the posterior that
ranks compose work stays at α = 1 on every class (β accrues on every failure) → selection is
effectively random → autonomous landing is low and unstable (0–23 % of drafts a day) → the
operator writes exact-edit goals → they land under the "Substrate Autonomous" identity (110 such
commits on 09-25 while autonomous drafts landed 19 %) → nothing separates assisted from unassisted
reach (the stability ladder's rung 5 gauge was never built) → the only gaps with falsifiers are
operator-authored → repeat.

Two break points carry the leverage:

1. **Edit site + falsifier mandatory at detection.** Unspecified anywhere. Without it nothing
   downstream can be verified or learned.
2. **An unassisted-reach gauge the system reads.** Today it exists only as a query operators run
   (`route-edit-*` vs autonomous `gap_id`), not as a shape (law 1).

## By the four properties asked for

| Property | What governs it | State |
|---|---|---|
| Rapid | selection, cost, admission, dispatch termination | Addressed today (value-per-cost phases 1–4, 5.2). Selection still random until closure is credited. |
| Stable | containment, node-local control, self-restart drain, spend storms | Partly fixed (compose ownership, live-self-view, envelope, breaker); containment specified today (contained-self-development), not built. |
| Reliable | landing correctness, verification strength | Hollow and partial landings now refused (semantic gate, 3.5); the verifier is still no stronger than the generator (ladder rung 2, never built). |
| Reachful | actionable gaps, multi-file changes, large files, legibility | Least addressed: single-file lane (cross-vessel wiring 346 attempts / 0 landed, unspecced beyond a proposal), large files only partly editable (`replace_lines`), decomposer built but only operator-driven, legibility surface never built. |

## Recurring root causes (all five slices agree)

1. **No closure-based learning signal.** Learning-rate mechanisms (successor features, TD(λ),
   signature clustering, tier bandit, embedding prior, decay) were added and some are on, but
   none had its acceptance check run, and all tune (signature, template) cells, not gap
   disposition or verified closure. They tune the rate of a signal that is absent.
2. **Gaps are not actionable.** Detection emits categories; the original self-development loop
   (failure-mode loop) closed gaps by drafting activity templates, and the code lane that came
   later has no spec, so actionability was never made a contract.
3. **Capabilities are built but never wired into the autonomous loop.** Parity gate / seam
   extraction (operator-only), code-locality (mined, never consumed), test-audit (shape exists,
   no reader), trace-pattern feeder (live, silent), self-replacement pipeline (no code; mitosis
   patches in place with no shadow or evidence-gated promotion).
4. **The spec ledger is not the source of truth.** At least 12 changes show 0 tasks done with
   code on `origin/dev`; others are ticked but undelivered; `validation/state/lift-status.json`
   still declares phase S2 "post-lift" as of 2026-05-26 while the 06-03 pre-lift conditions were
   never met and the 06-01 closed-loop test (7 days, no operator curation) was never run. My own
   spec had three landed tasks unticked until this review (fixed in the same commit).
5. **The operator is load-bearing and attribution hides it.** Seven specs say the work was
   operator-only; acceptance gates that needed a run were never run; the defined lifts (06-01,
   06-03) and the stability ladder (07-18: none of five rungs climbed) were never met.
6. **Control and stability are node-local and state is fragile.** Mostly addressed today and by
   compose ownership; self-persistence (7/21) and direct push remain.

## Where today's work sits

The 15 landings of value-per-cost-selection fixed spend, admission waste and control (root
cause 6 and part of "rapid"); they touched none of causes 1–5. Containment
(contained-self-development) is the precondition for measuring anything autonomous, and the
contained reopen will most likely land where predicted (1–3 verified closures a day) for
cause 1–2 reasons; so the detection-time enrichment spec (edit site + falsifier mandatory, with a
reward on verified closure) should be drafted now, in parallel, not after the 48 h.

## Corrections to the slice reports

- Slice 5 reported no gap-class posterior writer. One exists (`updateClassPosterior`,
  `/workspace/gap-class-posteriors.json`, α+1 at `closeLandedGap` and the sweep, β+1 on compose
  failures); both nodes' files were read at 07:20 with α = 1 on essentially every class.
- Slice 1 reported value-per-cost 4.2 and 4.4 open; both landed (`054de6f`, `76c8e60`) and 4.4's
  falsifier passed. The checkboxes were stale.

## Archive / rescope candidates (user decision)

- Archive as delivered or superseded: 2026-08-28-escalation-disposition-executor,
  2026-08-27-live-recipe-rescues-failed-partner, 2026-08-14-sound-close-oracle-reland,
  2026-08-26-consequence-verdict-into-credit (→ causal-attempt-ledger), 2026-06-14-merge-gate,
  2026-06-14-gap-scenario-class-dedup, 2026-06-14-non-obsidian-trace-pattern-feeder,
  2026-06-01-substrate-as-git-author, 2026-06-01-closed-loop-learning-and-verification,
  2026-05-27-neutral-emitter-lifecycle-bus, 2026-05-23-vessel-federation,
  2026-05-23-intervention-tracking, 2026-05-23-llm-resolver-model-mab,
  2026-05-23-substrate-self-deployment, 2026-05-19-ias-executor-as-canonical-host,
  2026-05-18-chain-credit-ancestor-signature-fix, 2026-05-23-harness-as-lifecycle-participant,
  2026-05-23-single-container-substrate, 2026-07-29-thompson-posterior-time-decay (live),
  2026-07-08-substrate-self-managed-db-reconciliation (primitives live).
- Remove: the four 2026-08-17 directories created by an autonomous drift commit (raw code, one a
  hard-coded `resolved:true` placeholder), not specs.
- Rescope, still matter: 2026-08-29-cross-vessel-wiring-repair (multi-file ceiling),
  2026-05-23-substrate-self-replacement-pipeline (evidence-gated replacement),
  2026-05-18-test-audit-loop (verify the verifiers), 2026-05-23-cost-weighted-posteriors
  (→ value-per-cost 5.1/5.3), 2026-07-18-s2-stability-ladder (rungs 2 and 5 as tracked tasks),
  2026-07-15-vessel-maintenance-parity-gate (wire to a detector), 2026-07-05-code-locality-resolver
  (consume in goal-host).
- Missing specs: gap actionability at detection (edit site + falsifier contract) with closure
  credit; the gap → edit → land → verify lane itself; an unassisted-reach gauge as a shape.

## Per-slice evidence (condensed)

**Slice 1 (09-27 → 08-26).** value-per-cost (live, 25/41); contained-self-development (spec only);
causal-attempt-ledger (delivered as observation, 0/36 ticked, settlement not in posteriors);
decentralized-compose-ownership (40/40, created the two-node control problem); live-self-view
(11/13); unified-install-interface (1/51); host-independent-federation-join (proposal);
live-recipe rescue (live); cross-vessel-wiring-repair (proposal, 346/0 class); escalation
disposition (live; human is the designed exit); consequence-verdict-into-credit (unbuilt,
superseded); four 2026-08-17 drift-commit directories.

**Slice 2 (08-26 → 07-04).** reuse-before-mint cross-family dedup (unbuilt; 15+ dormant clones);
large-file edit (partial: `replace_lines`, region probe); sound close oracle (live, narrow);
human-surface stack (partial); posterior decay (live, ledger 0/11); parity gate (built,
operator-only); DB reconciliation (primitives live, ledger 0/23); duplicate genres, relay
findability, pebkac config, legibility surface, single transport (unbuilt); llm arms (partial);
s2 stability ladder (no rung climbed); contiguous shape flow (16/19); code locality (mined, never
consumed); spoke development (9/21); security hardening (2/67).

**Slice 3 (07-01 → 06-04).** closure proof (28/47; proof run F never done); root rename (done
outside ledger); semantic cutover gate, goal-target inference, validate/mint parity, drafter
filter (live, ledger stale); cross-signature penalty (flag, default off); explicit vessels
(48/53); concept-db supersession and upkeep (0/78, abandoned); self-persistence (7/21);
orphan detection (live scan); impulse-activity-loop (416/521; open: lift gates, verification
integrity, reuse ≥ 0.65 never met); learning-rate acceleration (code live, gates unticked);
promotion loop (sub-item C still broken); successor features (live, VERIFY never run).

**Slice 4 (06-04 → 05-30).** learning-rate 1/3/4/6/8 (mixed: 4, 6, 8 live; 1 default off; 3
unbuilt; none verified); pre-lift bootstrap (1/49 ticked; conditions 1, 2, 4, 5 not met);
closed-loop learning (7-day test never run); git author (superseded by mitosis push); goal-host
OOM (route-around); self-audit meta, display failure modes, info-gain bonus (abandoned);
draft-spec-from-gap (delivered, output to the operator).

**Slice 5 (05-28 → 04-29).** development-vessel (73/79; output is detectors); failure-mode loop
(drafts templates, not code); self-replacement pipeline (0/49, no code); cost-weighted posteriors
(0/26); test-audit loop (10/35, no reader); signature keying (28/45, metrics open); model MAB,
emitter bus, federation, intervention tracking (delivered outside the ledger); identity
resolution (0/50); surrealdb RL layer (correctness fixed, graph edges absent).
