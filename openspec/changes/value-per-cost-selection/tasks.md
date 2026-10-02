How to follow along: every task under `repos/<vessel>/src` lands as a pre-validated
exact-edit goal (unique byte-exact anchors, `tsc` identical before/after on a scratch copy
of the push clone, the vessel's tests covering the file show no NEW failure versus the base (run with
`WORKSPACE_ROOT=$(mktemp -d)` so tests never touch live state; added after 2.2 passed tsc but
failed the lane's test gate), no `$'` `` $` `` `$&` `$$` in new text, "done when" names no shapes and
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

- [x] 1.5 LANDED: 1.5c `e8c58ce` (development-vessel llm_completion_dispatch forwards caller/task_type/dispatch_id), 1.5a `b880497` (goal-host llm-router stamps caller `goal-host:<task_type>` + dispatch_id; one blank line), 1.5b `b7bda9c` (goal-host floor tool loop / walk llm_completion / uf tool calls; byte-equal; phase-3 code intact). Falsifier pending node-1 goal-host restart. Caller attribution: every LLM caller (goal-host floor / universal tool fallback, arg
  synthesis, reach judge, target inference; development-vessel compose stages) passes `caller`
  and `task_type` so `llmSpendSummary` keys name the spender. Measured 00:00–00:30Z: 57–72% of
  spend was keyed `unknown|unknown`. Falsifier: `unknown` keys < 5% of window cost.
- [x] 1.6 LANDED llm-resolver `3c83a33` (00:37:14, byte-equal; entry check plus every tool-loop turn; the fallback walk stops on a ceiling refusal). Prompt-size ceiling: llm-resolver refuses (and logs, with caller) any single call whose
  input tokens exceed a ceiling read from a shaped impulse (default e.g. 200k), instead of
  serving it. Measured 00:15–00:26Z: 5 `gemini-2.5-flash` fallback calls took 3.99 M input
  tokens (~800k each, $1.20 = 72% of spend since 23:45), coinciding with goal-host floor
  (universal tool fallback) runs whose tool-output context grows per iteration. Falsifier: no
  served call above the ceiling; refusals are logged with caller.

## 2. Feasibility at admission (stop the structural waste)

- [x] 2.6 LANDED `afc7d6d` (23:26:50), reverted by 98bc2b5, RE-LANDED `c10e74a` (23:39:00), byte-equal both times. (FIRST in phase 2; blocks landing on large files) `feature-compose.ts` anchor
  provenance (~:40, log ~:4444): accept a goal-supplied old text that occurs exactly once in
  the target file even when it lies outside the grounding window; still reject drafter-invented
  anchors. Measured: 1.2 (4 correct edits on the 6k-line file) and the human-surface store.ts
  goal were both discarded as "anchor not in window", then re-drafted at LLM cost and
  rejected (119 re-drafts on 2026-09-26). Falsifier: the 1.2 goal lands byte-equal with no
  re-draft line in the compose log.
- [x] 2.1 LANDED `3cbf979` (00:10:2x, byte-equal; routed to node 2). — `gap-to-feature.ts` `admitActionableGaps`: push-scope gate after the protected
  check, memoised per vessel per pass, using `gateLanding` on the push clone's remote
  (same directory as the cutover's `hostRepoRoot`); replace the literal protected set at
  `:1534` with `PROTECTED_VESSELS`. Falsifier: with a vessel whose remote is a local bare
  repo, the admission log shows `push_scope_refused(<vessel>)` and no fc-plan for it; a
  control vessel with an owner/repo remote is still admitted.
- [x] 2.2 LANDED `c23b601` (00:53:12, revised G2 + operator test update 9bf8512) — then DOUBLE-APPLIED by the same non-terminating dispatch as `194df79` (01:19:17); duplicate block inert but must be removed. (earlier: ROLLED BACK by the lane's test gate 00:16/00:21: the admission test encoded the old "proposal-backed: always admit" policy (operator test update pre-verified: fails before, passes after), and the first G2 also excluded typecheck-class gaps before the phantom-typecheck path (2 tests); G2 is being revised to reuse that path's predicate, then 2.5/2.4 re-chained) Actionable-only admission: no edit site and falsifier not class1/class2 →
  `needs_information`, regardless of proposal report (`:1668`) and on every pick (drop the
  one-shot `alreadyInvestigated` bypass for these). Falsifier: 0 fc-plans for `(no-target)`
  gaps over a day of picks.
- [ ] 2.3 Reorder the admission loop cheapest-first (typecheck spawn last); count the site
  cap only for admitted gaps (fix the increment at `:1557`); collapse the triplicated
  repeated-failure block (`:1566/:1588/:1610`). Falsifier: admission log order and counts;
  pick latency does not regress.
- [x] 2.4 LANDED `bea12ec`; a second, drafted landing of the same gap (7eae3a0, 01:41, likely via the gap-closing path before 3.1) added a config-based duplicate probe in the capability-gap route; removed by `a30959a` (02:33, pre-validated; one extra blank line) (01:22:22; byte-equal to the chain end; its cutover also removed 194df79's duplicate 2.2 block). LLM-availability probe in the pre-selection capacity block (`~:3673`), short-TTL
  cached. Falsifier: with `llm_completion` de-advertised, selection returns a non-attempt
  without acquiring a slot.
- [x] 2.5 LANDED `96bf098` (00:58:47, byte-equal). Landability floor before the Thompson rerank (`:1215`). Falsifier: a score-0
  candidate is never picked over a ≥0.5 candidate.

- [x] 2.7 LANDED development-vessel `f70160f` (04:28:51, BYTE-EQUAL to the pre-validated file) through the lane: the early compose was mangled by the planner (TS1127 at 2757, rolled back), the post-walk compose, routed to the owner by the Documentation session's 4.7 (fbb2fab), applied it exactly. The user approved an operator hand-land as a bootstrap exception; it was NOT needed. FALSIFIER PASSED 04:40 (Documentation session's 4.7c, goal-host 1669ac8): node 2 logged `[fc-exact] applying 2 goal-supplied edits verbatim … (no LLM plan)` + `[spec-refine] skipped`; node 2's llm-resolver logged no completion requests during the compose; the landed file is byte-equal to the reference. Only the semantic and mitosis gates ran. NOTE: prose goals (4.7b) correctly fall back to the planner, so strict EDIT-block format is required. Deterministic application of goal-supplied EDIT blocks. A goal carrying `EDIT i / old: / new:` blocks
  whose old texts each occur exactly once in the target is applied VERBATIM by a deterministic path (splice,
  then the existing verify gates), with no LLM plan or draft. Measured: large exact edits are re-drafted by the
  planner (4b.2, 04:11), and every exact-edit goal tonight still paid for an LLM plan it did not need.
  Value: cheaper (no plan/draft tokens) and reliable (the pre-validated bytes land). Falsifier: 4b.2's goal
  lands byte-equal with 0 LLM calls in its compose report (tokens from 1.2's accounting).

- [x] 1.5d LANDED `67a25ea` (06:51:44, BYTE-EQUAL, one file). FALSIFIER PASSED 08:30: node 1 `caller: unknown` $0.001 of $0.116 in the 07:37 window (<1 %, from 57–98 %); remaining opacity is `llm_completion_dispatch` without a system prompt (template unnamed until ias-executor attribution). Default the caller in development-vessel `llm-completion-dispatch.ts`. EVIDENCE
  2026-09-27 (investigation of the ledger): llm-resolver keys spend on body `caller`/`task_type`
  only (`index.ts:1504-1507`); the $5.24 deepseek `unknown|unknown` was mostly goal-host tool
  loops before the 04:31/04:46 restarts picked up 1.5a–c, but ~37 calls/h remain, mostly
  activity-template tasks reaching this dispatcher through ias-executor's `vessel-resolver.ts`
  (loaded from `dist/`, so fixing it there needs the rebuild 1.4 is waiting on). An explicit
  caller wins; otherwise `development-vessel:llm_completion_dispatch:<system-prompt slug>`.
  task_type is deliberately NOT defaulted: a new task_type starts every arm at 1/1 and would
  explore expensive arms. PRE-VALIDATED: tsc 0/0; dispatch tests 26/26 on parent and patched.
  Falsifier: in the hour after landing, node 1's `unknown` caller share of spend falls from
  ~57% ($0.089 of $0.156) to under 10%. Goal: goals/1.5d-dispatch-caller-default.txt.
- [ ] 2.8 LANDED `a188771` (06:48:03, BYTE-EQUAL, one file, +13); falsifier pending (needs a gapless non-dry compose to occur). Refuse a free-text (no gap context) compose before the planning call. EVIDENCE
  2026-09-27: `adhoc` composes landed 0 of 122 over the week; each drafted, applied and
  typechecked, then the semantic gate refused "no gap context (free-text spec)". That gate has
  failed closed on purpose since 575514d (07-19); the comment above it still says PASS and is
  stale. Senders: the walk's `auto-bridge-feature_compose` step (binds no gap; today's 6 were
  goal b6b6c771 falling through after its early compose timed out at 313 s, the cause 3.3
  removed), apply-proposal-as-patch's free-text route, and perf-canary's live attempts (which
  therefore never stage either). A human-surface goal enters the same `/run-goal` path, so the
  exposure is shared, not a parity difference. The refusal sits beside the ungrounded refusal;
  dry runs return before the gate and are exempt. PRE-VALIDATED on f70160f+4.0a: tsc 0/0;
  feature-compose tests: the same 2 fail on the parent, no new failure. Falsifier: a gapless
  non-dry compose logs `[fc-no-gap] REFUSED` with zero llm-resolver completions for it, and
  `adhoc` rows with nonzero tokens stop appearing. Goal: goals/2.8-refuse-no-gap-compose.txt.
## 3. Termination and negative knowledge

PRIORITY RAISED 2026-09-27 01:20: non-terminating dispatches caused, in one session, a false 'failed'
verdict (ec38999d), a silent revert (98bc2b5 over afc7d6d), live-source writes (11:57, 13:02) and a double
apply (194df79 over c23b601). 3.1–3.3 land before anything else that edits gap-to-feature.ts. 3.1 also
skips a retry when ANY commit for the goal hash landed since dispatch start (not only when it is the
file's latest commit).

- [x] 3.1 LANDED `f3ffd7d` (02:06, byte-equal). goal-host early edit-intent (`index.ts:12660-12770`): on timeout, exception or
  non-favourable return, bounded git probe on `origin/dev` for a commit carrying the goal's
  route-edit id (do not require the report sha to match) before falling back. Falsifier:
  replay of the fe700129 / 6b6d93e2 shape ends `reached:true` citing the commit, with no
  walk steps after it.
- [x] 3.2 LANDED `f9001e9` (02:08; one equivalent regex-escape difference). Landed-verdict latch in `runGoalWithRecovery`; every later return preserves it;
  skip the post-walk compose (`:13141+`) when latched or probed-landed. Falsifier: a BUSY
  refusal after a landing leaves the final verdict landed.
- [x] 3.3 LANDED `1942eaf` (02:12; comment whitespace only). ROOT CAUSE: Bun's default fetch idle timeout (~300 s, fires 300–360 s) ignores the 900 s AbortSignal; fix `timeout: false` on both compose fetches. Also found: the post-walk compose routes to node 1 instead of the owner, so the double-compose guard missed node 2's report (194df79). Find what cuts the early edit-intent fetch at 220–360 s (the AbortSignal is 900 s)
  and fix it or align the budgets. Falsifier: the caller receives the compose's own report
  for composes that finish within 900 s.
- [ ] 3.4 Negative facts: persist deterministic refusals with invalidation conditions (in
  the failure-memory store, `index.ts:4038-4111`, as a distinct kind); check them in
  `handleRunGoal` before symbol proposal and at the top of `runGoalWithRecovery`.
  Falsifier: a second dispatch of a known-refused goal returns the refusal with 0 LLM
  calls; changing the invalidating condition lets it proceed.

- [ ] 3.5 LANDED `b9537eb` (07:09:13, BYTE-EQUAL, +13); falsifier waits for a compose with a failed op (expect `all-edits floor: WITHHELD FAVORABLE` and a rollback). ROOT CAUSE FOUND (2026-09-27): all three evidence landings carry `apply_failed:true`
  in their own compose reports (3cced35 and 24a64a8 applied 1 of 3 ops, f49d02e 4 of 5), yet the
  verdict was FAVORABLE: `feature-compose.ts` sets `applyFailed` in the apply loop but the verdict
  is `typecheckPass ? FAVORABLE : UNFAVORABLE`, and only the report reads the flag. Fix
  (goals/3.5-all-edits-floor.txt): an ALL-EDITS FLOOR after the target-touched floor withholds
  FAVORABLE when `applyFailed`, logging the failed ops; rollback and the cutover follow the
  verdict. The repair loop never runs once applyFailed is set, so a failed op is never repaired
  later. tsc 0/0; compose tests 240 pass, same 2 fail on the parent. Second, unfixed drop:
  `if (ops.length > maxOps) ops.length = maxOps` truncates a plan silently.
- [ ] 3.5 No partial reach. When a goal names N edits (strict EDIT blocks or prose "replace … with …"), the
  compose verdict and the goal's reach count how many of the requested new texts are present in the landed file
  and how many old texts are gone; below N the result is UNFAVORABLE / not reached, and the landing is not
  counted as closure. Measured: three FAVORABLE/reached landings tonight applied only part of their goal
  (f49d02e 4/5, 24a64a8 1/3, 3cced35 1/3). Gap: an-exact-edit-goal-can-land-with-some-of-its-edits-silently-
  dropped-…. Falsifier: a 3-edit goal whose compose applies 1 edit ends not reached, naming the missing edits.

## 4. Budget and breaker

- [ ] 4.0 (prerequisite, found by the 4.x design) Each node's llm-resolver needs its own vessel id, a routable endpoint and a published P220, so discovery lists both `llmSpendSummary` producers. Today both register the same id with a loopback endpoint and compose2 does not publish P220, so each node sees only its own spend and a global cap is effectively 2× until this lands.
  STAYS OPEN (2026-09-27): publishing P220 means recreating both containers (neither node
  publishes 8220; the manifest publishes a fixed port list), a lifecycle action that is the
  user's decision. Bootstrap path 4.0a below gets the cross-node sum without it.
- [x] 4.0a FALSIFIER PASSED 06:50: discovery on EACH node lists two `llmSpendSummaryNode` producers (:18090, :26090); each relay's numbers equal its node's llm-resolver read directly (node 1 since_start $9.5911, node 2 $2.8217); with a `spendEnvelope` record (id `spend-envelope`, cap 1000 USD/h, behaviour-neutral, written 06:50 by operator:claude-avi) the live `spendEnvelopeAllows()` returned spent_usd 0.14183 over spend_sources 2, and the hand sum of both nodes (current + unexpired share of previous) is 0.14182. LANDED (06:37–06:44, all three BYTE-EQUAL, one file each, no other commits): (1) `e6f07a0`, (2) `55c0649`, (3) `c3c4041`. Node 2 restarted 06:45:05 and advertises the relay; node 1 converges on its next pull-sync. Falsifier pending. NOTE: seqland's `runtime==clone` compares against the node-1 clone WORKING TREE, which pull-sync advances; on a node that has not synced yet it compares two stale files. Cross-node spend via a relay. development-vessel already advertises a routable
  endpoint on each node (`host.containers.internal:18090` / `:26090`; both pools are visible from
  both nodes), so it relays its OWN node's llm-resolver summary under a distinct shape
  `llmSpendSummaryNode` (read at use time, nothing written, a distinct name so nothing is
  counted twice), and the 4.1 reader sums that shape. Three one-file goals, in order:
  (1) `routes/impulses.ts` dispatch case, marked `@shape-dispatch:private` until (2);
  (2) `config.ts` advertises it; (3) `gap-to-feature.ts` reader switches shape. A refused
  connection reports zero with `unavailable:true`; a timeout or malformed answer carries no
  `current`, so the reader treats that node as unreadable rather than undercounting.
  PRE-VALIDATED on f70160f: tsc 0/0; shape-dispatch-check agrees (259→260 shapes, 262→263
  cases); covering tests 445/445 (router) and 245/249 on gap-to-feature (the same 4 fail on the
  parent). Falsifier: `vesselCapability` for `llmSpendSummaryNode` lists two producers from
  either node, each answers; with a generous `spendEnvelope` record, the verdict's `spent_usd`
  ≈ node-1 window + node-2 window read directly from each 8220. Measured motive: on
  2026-09-27 node 1 billed $9.53 and node 2 $2.78 between ~00:40 and 06:00 UTC, and the check-in
  read only node 1.
- [x] 4.1 LANDED `292aff1` (03:31:01, byte-equal) and 4.2 LANDED `054de6f` (03:35:14, byte-equal): the envelope gate is in auto-pick pre-selection, the investigate-and-decompose dispatch (the lease bypass) and the event-driven nudge; no envelope record yet, so behaviour is unchanged until one is written. DESIGN (goals/4.x-design.md): envelope = pool impulse `spendEnvelope` {usd_cap_per_hour, paused, reason}, newest across all poolImpulse producers via discovery; spent = Σ llmSpendSummary (current + unexpired share of previous) across producers, cached 30 s; no record → no cap (safe to land first); unreadable after a record was seen → block. PRE-VALIDATED: 4.1 gap-to-feature.ts (3 edits: helper, pre-selection gate `stage:budget`, and the investigate-and-decompose dispatch in bumpFailedAttempts gated by envelope + autonomous_pick lease, the real bypass), 4.2 substrate-gap.ts nudge (1 edit, depends on 4.1); tsc 0/0; 29 test files, no new failure. ORIGINAL: `spendEnvelope` + `spendEnvelope_debit` resolvers on one owner (hub), registered
  `unique_authoritative`, debited from each node's `llmSpendSummary` window deltas (not per-call writes). Falsifier: two nodes resolve the same
  envelope and its `spent_usd` rises with their combined spend.
- [x] 4.2 LANDED `054de6f` (03:35:14, byte-equal; see the 4.1 entry). (EVIDENCE 2026-09-27: the event-driven gap-compose NUDGE (substrate-gap.ts ~1207/1219 → gap-compose.service) bypasses the autonomous_pick lease. One siteless gap family (db_performance_slow_queries_2026-09-18…) was re-walked 17×/h as "investigate and decompose" (~10k-token deepseek floor calls), about $3.8/h with autonomy held. An operator_hold on the 3 gaps at 01:31:45 cut total LLM spend from ≈ $5.2/h to ≈ $2.1/h over the next 10 min (remaining: mostly directed composes). The nudge path and the investigation route MUST read the same envelope/lease as auto-pick.) Auto-pick reads the envelope via discovery in the pre-selection block; exhausted
  or paused → non-attempt `stage:budget`; unreachable → no compose. Falsifier: set
  `usd_cap` to the spent value → 0 fc-plans on both nodes.
- [x] 4.3 FALSIFIER PASSED 07:15 (pause 07:11:41–07:15:13, envelope `paused:true`): a non-dry `rhythm_conductor_tick` reported `spend_envelope: paused …`, enqueued 0, drained 0 (and the timer's own tick logged `no family selected and the queue not drained`); an untargeted `apply_proposal_as_patch` returned structuredError `budget_paused` before any attempt; boredom logged `[pool] not dispatching: spend envelope paused`. 4.3b LANDED `baa64cc` (07:04:10), 4.3c LANDED boredom-vessel `f28bc06` (07:06:05), both BYTE-EQUAL. SPLIT (2026-09-27) into three one-file goals after locating every spender. Node 2 runs
  no boredom, no rhythm timer, funnel-drain masked; its only spenders are inside
  development-vessel and already envelope-gated. Node 1's ungated spenders:
  - 4.3a LANDED `c313227` (07:00:51, BYTE-EQUAL): `rhythm-conductor-tick.ts` reads the envelope
    once per non-dry tick; not allowed → no family selected, queue not drained, reason in the
    report (`spend_envelope`). Tests 22/22 parent and patched.
  - 4.3b `apply-proposal-as-patch.ts`: an untargeted non-dry run (funnel-drain's watchdog restart
    impulse, boredom) refuses with a terminal structuredError when not allowed; proposal_id and
    dry runs ungated. This also makes the self-repair watchdog's re-enabling of funnel-drain
    harmless (the timer can run; it cannot spend). Tests: same 1 failure on parent.
  - 4.3c boredom-vessel `src/index.ts`: its own discovery read (boredom cannot import
    development-vessel), identical rules (newest record across pools, spend summed over
    `llmSpendSummaryNode`, 30 s cache, fail closed only after a record was seen); the daemon pool
    loop dispatches nothing while not allowed. tsc 0/0; its single test passes both ways.
  Falsifier (all three): set `spend-envelope` paused:true; within a tick the conductor reports
  `spend_envelope: paused`, an untargeted apply refuses, boredom logs `not dispatching`; unpause.
  NOT DONE: the self-repair script still re-enables timers that are merely stopped or disabled
  (only `mask` survives it and pull-sync); with 4.3b that no longer spends.
- [x] 4.3 DONE as 4.3a–c above (falsifier passed 07:15). Rhythm conductor and boredom resolve pause/budget via discovery, not their own
  node; `paused:true` replaces budget>1. Falsifier: a pause set on the owner stops drains on
  both nodes (node 2 included).
- [x] 4.4 LANDED goal-host `76c8e60` (07:10:13, BYTE-EQUAL, +61, via fc-exact). FALSIFIER PASSED 07:16 on node 2 with a temporary `dispatchRatePolicy` {window_s 300, per_hash_max 1}: dispatch 1 of one goal → 202; dispatch 2 → 429 `deterministic:spend-rate-refused - 1 dispatches of goal a175be1c in the last 300 s`, log `SPEND-RATE REFUSED at handler entry (no LLM call)`; policy removed (defaults 3600/6/240). Node 1's goal-host picks it up on its next pull-sync. PRE-VALIDATED (goals/4.4-spend-rate-breaker.txt, 3 edits in goal-host `index.ts`):
  in-process per-hash and global timestamp windows; thresholds from shaped policy
  `dispatchRatePolicy` {window_s, per_hash_max, global_max}, defaults 3600/6/240; /run-goal
  refuses right after the raw goal is read (before `resolvePathlessCodeChangeGoal`, the first LLM
  call) with 429 and a `spend-rate-refused` record; /resolve refuses after the RECURSION guard.
  Refusals are not counted. tsc 0/0; full goal-host suite 865 pass, the same 3 fail + 1 error on
  the parent. Would catch the trace-store reconcile re-dispatch (constant goal text, one hash).
  Counts reset on restart (not seeded from the dispatch store).
- [x] 4.4 DONE (see the LANDED entry above; falsifier passed 07:16). Spend-rate breaker in `handleRunGoal` (after the draining check, on the raw goal)
  and `/resolve`: per-hash and global counts over a window from `executionStore`, thresholds
  from a shaped impulse. Falsifier: a synthetic burst of one goal is refused after the
  threshold with 0 LLM calls.

## 4b. Database load from template listing (efficiency; found 2026-09-27 03:10, SurrealDB ~12 cores, CPU 3–6% idle)

Measured (15 min): 1,013 /v2/activities/templates requests, 739 listings (49/min), all hitting the DB
(paginated requests skip the Redis list cache). Callers: boredom-vessel fetchShapeDrivenCandidates
(index.ts:2757) pages 20× but the FTS path (activity-api routes/activities.ts:1363-1374) ignores
offset, so 19/20 pages repeat page 0; the rhythm-driven "refresh the substrate reality model" walk
(substrate-health-tick.ts:159 full scan, learned-topology-snapshot.ts:39) runs cold each time
(reuse suppressed by forceFloor); gap-to-feature familySample (:4168-4205) full-scans even when
/variants already filled the family. Per page ~1–2 s: `activity ORDER BY created_at` with no index,
metrics lookup (variant_performance_metrics by activity_id/variant_id) with no index, run twice per page.

- [x] 4b.1 LANDED activity-api `626eb63` (03:53:10, byte-equal). The FTS listing path honours `offset` (or returns an empty page for
  offset > 0). Falsifier: boredom's cycle issues ≤ 2 listing requests, not ~20.
- [x] 4b.2 LANDED activity-api `ba3408b` (04:45:52) and 4b.2b `79eaaef` (04:49:49), both BYTE-EQUAL via 2.7's verbatim path (`[fc-exact] applying 3 / 4 goal-supplied edits … (no LLM plan)`, spec-refine skipped). Falsifier pending the activity-api restart onto 79eaaef: DB-backed listings ≤ 2/min. (Earlier: NOT LANDED (04:11): the compose did NOT apply the pre-validated edits verbatim. The planner drafted its own 2-line edits (spans 31-32/47-48/68-69 against ~100-line EDIT blocks), which the semantic gate rightly rejected (unused import, recursive invalidate). Blocked on 2.7. activity-api: in-process cache of the full enriched catalogue (TTL from a shaped impulse,
  default 60 s), keyed by (orgId, projectId, accountId, scope, executionType), invalidated by the
  create/retire/promote handlers; every limit/offset slice served from it. Falsifier: DB-backed
  listings fall from ~49/min to ≤ 2/min; SurrealDB CPU falls.
- [ ] 4b.3 (follow-up) Indexes: `activity.created_at`; `variant_performance_metrics.activity_id` and
  `.variant_id` (migration); drop the second per-page enrichment; skip familySample when the family
  is already known; activity-api logs a caller id per request (the detector for this class).

## 5. Value per cost in selection

- [ ] 5.1 activity-api migration: `cost_n`, `cost_sum_usd`, `cost_sum_tokens` on
  `context_thompson_scores`; `tokens_sum` on `variant_performance_metrics`; increment at
  `posterior-update.ts:1238-1260` and `:1164`. Falsifier: fields rise with executions.
- [ ] 5.2 Remove cost from `successYield` (`posterior-update.ts:327-346`); record the change
  and compare posteriors a day before/after (law 12). LANDED activity-api `97adc04` 2026-09-27 07:31 (BYTE-EQUAL; goal
  goals/5.1a-success-yield-without-cost.txt): `quality = 0.5 + 0.5·productivity`. Cost entered the
  yield only once phase 1 populated `cost_usd` (before, every cost was 0 → costScore 1), so for
  cost-free rows this is byte-for-byte the pre-phase-1 update; costed successes stop being
  discounted. Test inverted first as an operator test-only commit (activity-api `1b3a3f7`, the
  9bf8512 precedent). tsc 0/0; posterior tests 68 pass / 27 fail on both parent and patched (the
  27 need a DB); graded-yield 6/6. LAW 12 SNAPSHOT taken 07:20 before landing:
  substrate-live:/workspace/validation-snapshots/posterior-snapshot-2026-09-27T0720Z.json.gz (container volume; binary artefacts are refused in the super-repo)
  (6,397 variant rows, 27,204 context rows). Blast radius: feature_compose's variant row does not
  decide anything (goal-host calls it directly); the live effect is on walk producers costed
  since 1.3. Falsifier: a reached, costed execution moves its variant by exactly α+0.75/β+0.25
  (no tasks) regardless of cost_usd.
- [ ] 5.3 Selector score = sampled p / max(E[cost], ε). Falsifier: equal-success producers
  at 10× cost → the cheaper one wins in the large majority of samples.
- [ ] 5.4 Per-(edit site, category) calibrated landability, updated where
  `updateClassPosterior` is called, read in `pickMostLandable` (`:1201`). Falsifier: a site
  with repeated failures and no landings loses rank below sites that land.

- [ ] 5.5 Credit closures. FOUND 2026-09-27: the gap-class posterior that ranks compose work
  (`/workspace/gap-class-posteriors.json`, read by the rerank at gap-to-feature.ts:1219) has
  α = 1 on essentially every class (node 1 `route-edit` α1/β195): β+1 on every non-infrastructure
  compose failure, α+1 only at `closeLandedGap` and the sweep, and operator-verified closes never
  credit it. (i) LANDED `febc7da` (BYTE-EQUAL): `closeLandedGap` records `closed_reason: landed_verified` + `landed_sha` (goal
  goals/5.1b-close-landed-gap-reason.txt; tests 245 pass / 4 fail on both). (ii)/(iii)
  DEFERRED: a close hook in substrate-gap.ts would credit whichever node serves
  `substrateGap_write` (operator closes arrive on node 1), but the file is node-local and the
  rerank for autonomous picks runs where compose selection runs; needs a discovery-routed write,
  and the two direct α+1 calls removed first so nothing is double-counted. The cost mean (5.1)
  needs a migration on SCHEMAFULL tables (not a one-file lane edit); `avg_cost_usd` on
  `variant_performance_metrics` already exists but averages the pre-phase-1 zeros.
  (iv) 2026-09-28, CATEGORY CALIBRATION (the hopeless() seal) moved to the gap-store holder,
  no new shape. Found: node 2's young node-local `/workspace/expectation-calibration.json`
  sealed systematic_failure 8/0, edit_intent_route 21/0, self_development 15/0 and excluded
  126 of 128 admitted gaps (pool 1-2, no autonomous landing since 10:19) while node 1's file
  showed the same categories landing (61/1195, 99/2656); against the live store, network
  evidence unseals 1,250 open gaps, 91 of them landable (site + class1/2 predicate).
  LANDED 76bf256 (BYTE-EQUAL; tsc 0; suite 2298/33 = parent): substrate-gap.ts credits the
  table where the store is held — an attempt on a failed_attempts rise, a land on a
  transition into closed with an INCOMING closed_reason landed_verified (operator
  hand-closes are not counted, per the 08-28 ruling) — and returns it on a read with
  `include_calibration`. Behavioural probe (fixture paths): rise → attempt; no rise → none;
  landed_verified close → attempt+land; expiry close of a row once carrying landed_verified
  → none; flagless read omits the table; live file untouched by the suite.
  THEN gap-to-feature.ts: the three local credits removed; readCalibration reads the held
  table, refreshed before each auto-pick, local file only when the holder cannot be read
  (logged). Double-count window: node 1 credited both locally and as holder between the two
  landings — do not quote node 1 calibration deltas from that window.
  Falsifier (pre-registered): node 2's first auto-pick after it runs both changes shows
  hopeless_excluded well below 126 and pool > 2, picks leave the goal-target-inference
  family; negative control: orphaned_capability, unreachable_producer,
  trace_store_reconciliation (0 lands fleet-wide) stay excluded. Expectation: this restores
  node 2's denominator, not a landing rate — at the measured low single-digit autonomous
  land rate and a compose-lane cap of 1, expect fractions of a landing per hour.
  The gap-class posterior (`gap-class-posteriors.json`) is still node-local — remains open.

## 6. Reopen and observe

ADMISSIBLE WORK (2026-09-27 07:25, gap store): 61 of 2,340 open gaps (2.6%) have an edit site and a
class1/class2 falsifier and no operator hold; 59 target vessels (development-vessel 29, goal-host
24, discovery 4 = protected, refused at admission; human-surface 2 = not authorable), so ~53 are
workable. Enough for a 24–48 h reopen test; and 97% of open gaps are not fixable as filed, which
is the step-5 bottleneck (the system writing gaps it can act on).

REOPEN CHECKLIST (6.1; needs the user's approval):
  1. Write `spend-envelope` with `usd_cap_per_hour` ≈ 1 (paused false, reason names the approval).
  2. Stop the node-1 lease renewal loop and release the node-1 `autonomous_pick` token
     (tmp/lease-spec.json) with maintenanceLease_write op release.
  3. Ask the Documentation session to stop its node-2 renew loop (pid 4125526) and release.
  4. Decide whether node-2 boredom/rhythm stay off (they are envelope-gated now either way).
  5. Record the intervention and time in CHECKINS.md (law 12), then observe 6.2 for 24 h:
     autonomous drafted-landing ≥ 40 %, ≥ 5 substrate-detected verified closures/day, cost per
     verified closure, no reverts, CPU and DB calm.


- [ ] 6.1 Set an initial envelope (small `usd_cap` per hour), release the node-1 lease and
  ask the Documentation session to stop the node-2 renew loop.
- [ ] 6.2 Observe 24 h against 0.2: verified closures per day and per dollar up;
  feature_compose landed share up; structural-refusal share of picks near 0; cost per
  verified closure reported; no walk after a landing; no downgraded landed verdicts.
