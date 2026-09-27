How to follow along: every task under `repos/<vessel>/src` lands as a pre-validated
exact-edit goal (unique byte-exact anchors, `tsc` identical before/after on a scratch copy
of the push clone, no `$'` `` $` `` `$&` `$$` in new text, "done when" names no shapes and
ends "This is a source edit only; do not perform any other action"). Goal text lives in
`goals/<task>.txt`. A task is done when: the landed file on `origin/dev` is byte-equal to
the pre-validated file; the vessel restarted after it (pull-sync may defer; see the
owed-restart gap); runtime == clone; and the falsifier reads as stated. One landing at a
time per vessel. Autonomous picks stay held on every node until phase 4 is live.

## 0. Preconditions and baselines (operator)

- [x] 0.1 Autonomous picks held on both nodes (node 1: `autonomous_pick` lease renewed from
  the operator session; node 2: the Documentation session's renew loop). Directed work only.
- [x] 0.2 Baselines recorded 2026-09-26 23:5xZ (queries in design.md §Measures):
  verified closures (closed with a passed falsifier) per day 14 (09-23), 13 (09-24), 7 (09-26);
  feature_compose landed 297/1,828 = 16.2% over 7 d and 56/455 = 12.3% over the last day;
  walk yield 152/713 = 21% (09-26); structural-refusal share of node-1 autonomous picks
  ≈60% (09-26). Recorded execution cost over the last day: $0.52 across 38,845 rows and
  30.8 M input tokens, i.e. cost accounting is effectively absent until phase 1.

## 1. Spend accounting (measure before changing behaviour)

- [x] 1.1 LANDED llm-resolver `7d7bf0a` (23:45:23; byte-equal except one cosmetic space). Falsifier PASSED 23:47: a 12-token completion reported `usage.cost_usd` 4.2e-06 and `llmSpendSummary.since_start` rose by exactly 1 call / 10 in / 2 out / $4.2e-06. — llm-resolver `src/index.ts`: return `usage.cost_usd` on every completion
  (provider-reported cost when present, else tokens × arm `cost_per_mtok`); add usage to the
  credit-fallback path (`:616-619`); accept `execution_id`/`dispatch_id`/`caller` on the
  request; aggregate spend IN MEMORY per 3600 s window (no per-call I/O: a per-call pool
  write would rewrite `pool/standing.json` on every completion) and serve it as the read
  shape `llmSpendSummary` (current / previous window, since start), one log line per window.
  Pre-validated (goals/1.1-llm-resolver-cost.txt, 6 edits). Falsifier: one completion →
  `usage.cost_usd > 0` for a paid model with a policy arm, and `llmSpendSummary.current`
  rises by exactly that completion's tokens and cost.
- [x] 1.2 LANDED `98bc2b5` (23:33:37; re-drafted, cosmetic quote change) — but it SILENTLY REVERTED 2.6 (coalesced retry inherited a stale-base compose; gap filed); falsifier (non-zero compose-report tokens) pending the next compose. — development-vessel `feature-compose.ts`: `llmCall` (`:366-445`) returns usage;
  a per-compose accumulator sums `{input_tokens, output_tokens, calls, cost_usd}` by stage;
  the compose report (`:6899-6900`) and `attemptOutcome` carry the totals. Falsifier: the
  next compose report has non-zero tokens equal to its `llmSpend` sum.
- [x] 1.3 LANDED goal-host `4eaad89` (1.3a llm-router.ts, 23:55:51) and `44e5615` (1.3b index.ts, 23:57:5x), both byte-equal; 1.3b (6 edits on the 17k-line index.ts) landed in ~1 min with 9 'accepted goal-supplied unique anchor' lines, i.e. 2.6 verified on the largest file. Falsifier pending node-1 goal-host restart. — goal-host `llm-router.ts` + `index.ts`: key usage by dispatch id via
  `dispatchContext`, count calls, stamp `record.cost` before `flushRouterFeedback`, pass
  real tokens/cost to `recordGoalPath` and `persistSatisfierTrace`, replace `costUsd: 0`.
  Falsifier: a walk that called the LLM writes an execution row with non-zero `tokens_in`
  and `cost_usd`. **Execution-level PASSED 00:01Z (with 1.1 + 1.3a live):** last 10 min, 209 rows,
  245,800 tokens_in, $0.149 recorded (the hour before: 148k tokens, $0). Dispatch-level
  `record.cost` pending 1.3b reaching node 1 (goal-host restarted 00:00:34 on 4eaad89 only).
- [ ] 1.4 ias-executor-ts `src/hosts/vessel-daemon.ts:315`: pass `usage.cost_usd` (and tokens)
  through instead of `0`. Pre-validated (goals/1.4-executor-cost.txt). CORRECTED scope: this
  site only publishes the `task.completed` event (`/v2/events/publish`), it does not write the
  `execution` table, so it cannot satisfy the execution-cost falsifier (that is 1.1–1.3's).
  Land AFTER 1.1 (no `cost_usd` exists until then). Consumers import a copied `dist`, so the
  change needs a rebuild and re-propagation to take effect. Falsifier: a `task.completed`
  event for an LLM-resolving task carries non-zero `cost_usd`. Phase-1 execution falsifier:
  `SELECT math::sum(cost_usd) FROM execution WHERE created_at > time::now()-1h` rises after 1.1–1.3.

## 2. Feasibility at admission (stop the structural waste)

- [x] 2.6 LANDED `afc7d6d` (23:26:50), reverted by 98bc2b5, RE-LANDED `c10e74a` (23:39:00), byte-equal both times. (FIRST in phase 2; blocks landing on large files) `feature-compose.ts` anchor
  provenance (~:40, log ~:4444): accept a goal-supplied old text that occurs exactly once in
  the target file even when it lies outside the grounding window; still reject drafter-invented
  anchors. Measured: 1.2 (4 correct edits on the 6k-line file) and the human-surface store.ts
  goal were both discarded as "anchor not in window", then re-drafted at LLM cost and
  rejected (119 re-drafts on 2026-09-26). Falsifier: the 1.2 goal lands byte-equal with no
  re-draft line in the compose log.
- [ ] 2.1 `gap-to-feature.ts` `admitActionableGaps`: push-scope gate after the protected
  check, memoised per vessel per pass, using `gateLanding` on the push clone's remote
  (same directory as the cutover's `hostRepoRoot`); replace the literal protected set at
  `:1534` with `PROTECTED_VESSELS`. Falsifier: with a vessel whose remote is a local bare
  repo, the admission log shows `push_scope_refused(<vessel>)` and no fc-plan for it; a
  control vessel with an owner/repo remote is still admitted.
- [ ] 2.2 Actionable-only admission: no edit site and falsifier not class1/class2 →
  `needs_information`, regardless of proposal report (`:1668`) and on every pick (drop the
  one-shot `alreadyInvestigated` bypass for these). Falsifier: 0 fc-plans for `(no-target)`
  gaps over a day of picks.
- [ ] 2.3 Reorder the admission loop cheapest-first (typecheck spawn last); count the site
  cap only for admitted gaps (fix the increment at `:1557`); collapse the triplicated
  repeated-failure block (`:1566/:1588/:1610`). Falsifier: admission log order and counts;
  pick latency does not regress.
- [ ] 2.4 LLM-availability probe in the pre-selection capacity block (`~:3673`), short-TTL
  cached. Falsifier: with `llm_completion` de-advertised, selection returns a non-attempt
  without acquiring a slot.
- [ ] 2.5 Landability floor before the Thompson rerank (`:1215`). Falsifier: a score-0
  candidate is never picked over a ≥0.5 candidate.

## 3. Termination and negative knowledge

- [ ] 3.1 goal-host early edit-intent (`index.ts:12660-12770`): on timeout, exception or
  non-favourable return, bounded git probe on `origin/dev` for a commit carrying the goal's
  route-edit id (do not require the report sha to match) before falling back. Falsifier:
  replay of the fe700129 / 6b6d93e2 shape ends `reached:true` citing the commit, with no
  walk steps after it.
- [ ] 3.2 Landed-verdict latch in `runGoalWithRecovery`; every later return preserves it;
  skip the post-walk compose (`:13141+`) when latched or probed-landed. Falsifier: a BUSY
  refusal after a landing leaves the final verdict landed.
- [ ] 3.3 Find what cuts the early edit-intent fetch at 220–360 s (the AbortSignal is 900 s)
  and fix it or align the budgets. Falsifier: the caller receives the compose's own report
  for composes that finish within 900 s.
- [ ] 3.4 Negative facts: persist deterministic refusals with invalidation conditions (in
  the failure-memory store, `index.ts:4038-4111`, as a distinct kind); check them in
  `handleRunGoal` before symbol proposal and at the top of `runGoalWithRecovery`.
  Falsifier: a second dispatch of a known-refused goal returns the refusal with 0 LLM
  calls; changing the invalidating condition lets it proceed.

## 4. Budget and breaker

- [ ] 4.1 `spendEnvelope` + `spendEnvelope_debit` resolvers on one owner (hub), registered
  `unique_authoritative`, debited from each node's `llmSpendSummary` window deltas (not per-call writes). Falsifier: two nodes resolve the same
  envelope and its `spent_usd` rises with their combined spend.
- [ ] 4.2 Auto-pick reads the envelope via discovery in the pre-selection block; exhausted
  or paused → non-attempt `stage:budget`; unreachable → no compose. Falsifier: set
  `usd_cap` to the spent value → 0 fc-plans on both nodes.
- [ ] 4.3 Rhythm conductor and boredom resolve pause/budget via discovery, not their own
  node; `paused:true` replaces budget>1. Falsifier: a pause set on the owner stops drains on
  both nodes (node 2 included).
- [ ] 4.4 Spend-rate breaker in `handleRunGoal` (after the draining check, on the raw goal)
  and `/resolve`: per-hash and global counts over a window from `executionStore`, thresholds
  from a shaped impulse. Falsifier: a synthetic burst of one goal is refused after the
  threshold with 0 LLM calls.

## 5. Value per cost in selection

- [ ] 5.1 activity-api migration: `cost_n`, `cost_sum_usd`, `cost_sum_tokens` on
  `context_thompson_scores`; `tokens_sum` on `variant_performance_metrics`; increment at
  `posterior-update.ts:1238-1260` and `:1164`. Falsifier: fields rise with executions.
- [ ] 5.2 Remove cost from `successYield` (`posterior-update.ts:327-346`); record the change
  and compare posteriors a day before/after (law 12).
- [ ] 5.3 Selector score = sampled p / max(E[cost], ε). Falsifier: equal-success producers
  at 10× cost → the cheaper one wins in the large majority of samples.
- [ ] 5.4 Per-(edit site, category) calibrated landability, updated where
  `updateClassPosterior` is called, read in `pickMostLandable` (`:1201`). Falsifier: a site
  with repeated failures and no landings loses rank below sites that land.

## 6. Reopen and observe

- [ ] 6.1 Set an initial envelope (small `usd_cap` per hour), release the node-1 lease and
  ask the Documentation session to stop the node-2 renew loop.
- [ ] 6.2 Observe 24 h against 0.2: verified closures per day and per dollar up;
  feature_compose landed share up; structural-refusal share of picks near 0; cost per
  verified closure reported; no walk after a landing; no downgraded landed verdicts.
