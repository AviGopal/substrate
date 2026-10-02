# Dossier: spend-envelope-throughput

**Class key:** `spend-envelope-throughput`. **Window:** 2026-05-23 → 2026-09-29. **Evidence base:** the class file
`classes/spend-envelope-throughput.json` (76 attempts, 41 problems, 18 claims), `_mech_chunks/*`, the raw notes, and a
live read-only check on 2026-09-29 04:49–04:55Z of both `substrate-live` (node 1, the hub) and `compose2-live` (node 2).

**Scope.** This class holds every way that work admission, concurrency, pace and spend went wrong: compose-lane capacity,
change-window leases, restart and drain budgets, runaway storms, LLM provider credit, and the USD envelope. The critic
passes folded three other keys into it: `runaway-amplification`, `llm-plane-availability` and `llm-provider-plane`
(critic.md:155,160; critic-2.md:60-62). Rows carrying those keys are included here.

**One line.** Each dispatcher runs its own admission check, and when a check refuses, the refusal is written only to a
log. Every new bound (slots, leases, the envelope, the breaker) therefore had to be threaded into each entry point one
leak at a time. The same goal can be refused hundreds of times a day while its selection weight stays the same.

---

## 1. Timeline

### Era 1: May–June. Timeouts, memory and pace set by hand
| Date | Event | Outcome, and what later showed |
|---|---|---|
| 05-23..06-18 | Boredom timeout ladder: `71feaeff, 985117ed, eb179580, 106b1f0b, c6f13b75, 666a77c7, 63d39383, 83656824` (TimeoutStartSec 90→300→600; in-flight limit raised 3 times; dev-vessel 90→600 s) | Symptom edits. The root cause was Bun capping AbortSignal at 300 s, and it was fixed only by async dispatch in `ac0d75b5`/`d048b889` (git-super-1). |
| 05-24 | Queue flooding by TaskGenerator (1232 critical + 619 medium queued; the queue filled at 10 per 5 min and drained at 1 per 8–10 min) | The fix was an env flag `TASK_GENERATION_ENABLED`. The env read is still at activity-api `src/index.ts:916`, which violates law 1 (openspec-1). |
| 05-29 | Cost accounting on traces (audit F21: engine.ts, goal-host HttpLLMPort) | **Failed.** 18,135 traces after 09-27 still had `cost_usd = 0` (openspec-1). |
| 05-31 | goal-host OOM at ~10 GB, killed every ~3 min, docker daemon wedged; cause was the 05-27 fire-and-forget bus forwarder. Fix: BoundedBusSink (L1), framework fix (L2), `detect-service-oom-cascade` detector (L3) | Partial. L1 is copied into 3 vessels. The framework cap is an env var (`IAS_SUBSCRIBER_MAX_INFLIGHT`). The L3 detector has 0 traces (openspec-2). |
| 05-31..06-03 | goal-host memory iterations `da22a979, 837584ee, 46a06b9b, c142759d, d314fda6, 654377fa` (Bun.gc workaround, MemoryMax 3G, streaming refactor) | The streaming refactor crashed dispatches and was fixed the same day in `d314fda6`. The ~2 GB per dispatch leak was left unaddressed: patches covered ~700 KB of 2 GB (validation-other-1). |
| 06-03 | Second dispatcher, `light-dispatch-vessel`, added to route around the goal-host leak | It works (Stage 3.4 PASS), but the leak itself was never patched (openspec-3). |
| 06-04 | Throughput-paced boredom pool `30938781` (MAX_CONCURRENT=3), then UCB1 `2517d309` | This created a second selector beside Thompson, and 30 more cadence timers were added anyway (git-super-1). |
| 06-20..07-04 | DB CPU pegged; cutover restart storms. Posterior-delta coalescing | Write conflicts went from 122 per 60 s to 0, but CPU stayed near 490% (memory-adjacent). |
| 06-20..09-16 | self-recovery "immune system" `6f5e1bdd` plus 16 commits | Repeatedly autoimmune: `92b1b1fa, fc143654, 44250006, 1d9190eb` ("holding the door shut on the cure"), `ad9da780` ("bound the recovery reflex") (git-deployment). |

### Era 2: July. Dedup, isolation, and the first shaped pace
| Date | Event | Outcome, and what later showed |
|---|---|---|
| 07-05 | First "compose BUSY/503 falls through to a shell walk" fix | Fixed 5 times: `01ef41e, 4ba7bbd, eed0ccf, ee4622a, 2cc8af7, 60833b4`. It came back on 09-25 because the edit-intent route is duplicated in two places, EARLY (~12683) and late (~13304/13365) (git-goalhost). |
| 07-09..07-23 | "Contiguous shape flow": the event drain replaced timers (GapDrainObserver, poolImpulse, `watchdog-tick.ts`) | **Failed.** Gap to dispatch took 34 ms on 07-09, but 1931 of the last 2000 drain-log rows were `ok:false` HTTP 400. The drain went silent on 07-23 and the watchdog on 07-20; `standing.json` was frozen on Sep 7 (openspec-4). |
| 07-13..09-26 | LLM plane dark again and again (`d327b2d..b712872`, `17dc3d0`, `5b199b3`, `3fa37f0/cbf029a`, `b9b68d8/3839090`, `0768990`, `c5e49d3/3068940/dd9d886`, `d508933`, `3ea2136`) | 17 recurrences. One outage left the fleet dry for 43 h on an invalid key while OpenRouter was funded (git-small). |
| 07-16 | Anthropic-only drafting; credit outage. Model `auto` plus per-(task × model) Thompson (`7e1590f`, `03e51d3`, `517d75c`) | Worked (8 arms). A vestigial cascade remains because goal-host pins claude-haiku (memory-1). |
| 07-17 | Per-compose worktree isolation `8ec501b, e5fd6c9, f655c8d` | Worked: 3 concurrent substrate commits. Later analysis found isolation had removed the capacity refusal, and the host oversubscribed (memory-6). |
| 07-21 | run-goal coalesce dedup `055406c, 7e121c4` | Worked: pool 50→3 (45 copies before). |
| 07-21 | Per-gap compose cooldown `bc6daac` | Worked for flappers (4/4→1/4). The upstream single-slot trigger was left open (memory-1). |
| 07-22 | Boredom cheap-tick demotion `e7987d9e` | CPU 1500%→220%. |
| 07-24 | Runaway satisfier shell commands, fixed with a 30 s abort in `6fb9282` | CPU 2183%→992%. This same 30 s default later silently killed the post-land suite from 08-31 to 09-28 (fixed in `5e9a0b2`). |
| 07-24 | 429 cooldown tier, funded arm seeding, provider reorder `3fa37f0, cbf029a, 9716cce` | Superseded 08-20: every groq slug was decommissioned and 6 phantom arms were retired. |
| 07-27 | Apply-loop bounded retry plus recommit cap `cd28e65, 12e7611` | Proposals 1670→85, but the backlog was 97% failure reports. |

### Era 3: August. Caps, slots and governors
| Date | Event | Outcome, and what later showed |
|---|---|---|
| 08-02 | maintenanceLease self-deadlock `3f4be28` | Worked; landings resumed. |
| 08-09 | Diagnosed: trace-store-reconcile holds the global `change_window` lease | Recurred 09-23 and 09-24. Still open on 09-29 (see Era 4). |
| 08-10 | Cross-process compose cap: `6ad3721, 68a26de, 84712c5, 070f71e, 36dd9b7` ("REFUSED does not queue, it dies"), `5f965b8, bf7fac0` | Worked: load 50.8→11.1. After that the lane was **cap 1**. 82.5% of picks were refused BUSY *after* selection (memory-3, reports-6). |
| 08-10 | "Nothing applies back-pressure between dispatch concurrency and provider quota" (memory-9:275); the verifier retried 400/800 ms against a daily cap | Not built until the 09-27 envelope. |
| 08-10 | Directed vs autonomous priority, handled by raising `EDIT_INTENT_COMPOSE_TIMEOUT_MS` to 900 s | Partial. The directed seam recurred on 09-11, 09-22, 09-23 and 09-28 (§3). |
| 08-11 | Operator dispatches refused CAPACITY(BUSY) in the autonomous cap-1 lane | Fixed 09-11 with a top-level `operator` field (landed `80e45a2a`). The seam recurred on 09-22 and 09-28 (reports-8). |
| 08-16 | walkBudget and lessonExecutionPolicy shaped as policies, `f87f52f` ("I shipped both readers, neither producer") | Node 2 still logs `walkBudget resolve failed (HTTP 404) — FALLING BACK to literal budget` 211 times a day (node2-runtime:81). |
| 08-15 | Watchdog detached from stdout `7164c1c` (autonomous) | Shell calls 30 s→22 ms. |
| 08-30 | runCheck group-kill and load-deferral guard `0fd7487, 3e687d2` | The operator withdrew this the same day ("latent bugs, neither fires against the actual load source"). |
| 08-30/31 | Test-exec concurrency governor `44c2b21` plus descendant-tree kill `791051e` | Worked: over 3.6 h, 0 orphans and load 9. The first claim that it cut CPU 5–17× was cosmetic (§2). |
| 08-31 | Skip the suite when typecheck fails `a07c8ce` | Worked: 3 of 5 composes skipped the 240 s suite. |
| 08-30 | Picker rotation `86cdbf2`, justified by an "88% monopoly" | The figure double-counted runner_up (real top share was 16%→35%). The error recurred on 09-07 and 09-08. |

### Era 4: September. Leases, the envelope, the breaker, the recursion guard
| Date | Event | Outcome, and what later showed |
|---|---|---|
| 09-06 | Load-induced test timeouts are charged to the drafter (odds ratio 3.34, ~100 approvals lost, ~10% of FAVORABLE). An `env_test_timeout` label was proposed | Unknown or not built (memory-3). |
| 09-06 | Concurrent composes on one path discard approved cutovers; the operator hand-landed `8e0c579` | Partial. Nothing reconciles FAVORABLE verdicts against pushed shas. |
| 09-11 | Gap `llm-completion-plane-dark` closed from the coarse classifyPlane ("2 providers usable") | **Wrongly closed.** Discovery listed no producer; the gap was reopened. Recovery at 13:43 has an unknown cause. |
| 09-14 | `spawnSync systemctl start` froze dev-vessel on every gap write; fixed with `--no-block` in `ca53600` (operator) | Worked (gap write 0.2 s). Five wrong explanations came first. It also left **three redundant compose entry points**: GapDrainObserver, the in-process nudge, and the watchdog (timers-readers). |
| 09-15..09-18 | LLM plane restored locally several times (placeholders `35537c7e`, clean draw `80ab9659`) | 09-17: all 7 providers unusable. 09-18: federation to syzygy.host was the working route. |
| 09-18..09-25 | Slow-query remedy pinned to a template that does not exist (`db_performance_slow_queries_2026-09-18T16`) | 118 failed attempts, the store maximum. It is still being nudged on 09-29 at 04:49 ("compose lane full"). |
| 09-20..09-25 | Self-restart kills in-flight composes (9+ hats); `404a89c`, `bf74cc5`, selfRestartAlreadyOwed | Partial. The gap `every-restart-budget-is-shorter-than-a-compose` (16 restarts, 4 lost composes in 3 h) is still open. |
| 09-22 | Identity rate-limit bucket shared across the fleet; 429s read as INVALID_API_KEY. Label fix `4fc5f80` | Partial. The limiter fix (`extractIp`) never landed because identity is a protected vessel. It recurred 09-23 in install CI; the gap is open. |
| 09-22 | Token metering on goal-host LLM calls | tokens are recorded; `cost_usd` stays 0. |
| 09-23 | Per-gap in-flight guard `c8cfc38, 01d085d, 799bd58` (unprompted) | Worked: nudge writes 270/h→1/h. |
| 09-23..09-25 | Named change-window leases and age-based restart budgets `ace49c0, e17ea38, 80e168f, 4e40707, 0b06246, 9ee5d9d, a2f7542, 5475e11, c6213f1, 0a8de60`; activity-api `1055cba` | Worked (`2992a23` pushed during a trace_store hold). The union semantics of 3.1b broke cutovers again until 3.2b. The failure path in the executor (3.3c) is absent. |
| 09-24 | Root cause of the change-window starvation: `946034c` blanked `{{…}}` placeholders for 9 days (108 of 108 reconcile runs failed while holding the lease); ias-executor `2893a93` | Partial. Retention removes 1,825 rows while 28,565 are inserted per 24 h, so reconcile keeps running. The change-window gaps are still open. |
| 09-24/25 | Resumable landings: parking and resume (`c1dd4c2`; 14 parked, 7 resumed) | Partial. **47 parked landings sit live on 09-29 and nothing resumes them** (verified). The resume path breaks attempt attribution (RUN10-VOID-2002). |
| 09-25 | `autonomous_pick` lease `128f51f` | Worked, with 21–34 skips per graded window. A walk executed the falsifier sentence and duplicated the lease (`31d07cd`, removed in `15bb263`). It does not stop in-flight composes (`768ae7c`). |
| 09-26 | Recursion storm: ~3,080 walks between 05:00 and 08:00, 21 reached, quota exhausted. The container had to be stopped. Guard `7f0425d` was hand-landed under operator identity | Worked. The substrate could not land it itself because the LLM was down. **No deterministic brake existed** (reports-7). |
| 09-26/27 | Spend accounting phase 1: `7d7bf0a, 3c83a33, 98bc2b5, 67a25ea, 4eaad89, 44e5615, b880497, b7bda9c`, plus a prompt ceiling (5 gemini fallback calls took 3.99 M tokens, ~72% of spend) | Worked for the llm-resolver meter. `98bc2b5` silently reverted `afc7d6d`. Task 1.4 (ias-executor passthrough) is open. |
| 09-27 | Federated `spendEnvelope` pool shape gating auto-pick, nudge, conductor, apply-proposal and boredom: dev-vessel `292aff1, 054de6f, c313227, baa64cc, 6c86595`; boredom `f28bc06`; super-repo `a1826314` closed the undirected-compose bypass | Worked as containment: the pause falsifier passed at 07:15 on both nodes. **Leaks were closed one entry point at a time.** Boredom's reader (`readBoredomEnvelope`) is a ~85-line copy of dev-vessel's `spendEnvelopeAllows`. |
| 09-27 | Spend-rate breaker per goal hash `76c8e60` (`dispatchRatePolicy`, in-process, 3600 s / 6 per hash) | Partial. By 09-27 one hash, `0ee592d0`, had been refused 629 times on node 1. The dispatcher never learns because task 3.4, negative facts, was never built. |
| 09-27 | Containment: autonomyScope, a class1/class2 falsifier requirement, a 1–2 USD/h envelope | Admissible supply fell from 235–255 to 0–3. The 8 landings after that were all reverted (reports-7). Admission was widened and tightened twice in 48 h (live-pool-memory:91-99). |
| 09-28/29 | Envelope binding: node 1 exhausted 23:34–00:28 (85 refusals); operator-directed landings draw from the same $2/h | Live (§5). |
| 09-29 | The gap-compose watchdog fires `gap_to_feature` about every 90 s, with `ok:200` each time, while `stalled_min` keeps rising | Live (§5). |

### Claims and what later showed
| Claimed | Claim | Later |
|---|---|---|
| 08-11 | "6× load improvement" (round7 draft) | Retracted in `f1dcb5cf`: it was a single sample; the real range was 511–1989%. |
| 08-30 02:00 | `0fd7487` fixes the orphan leak that saturates the box | Withdrawn at 02:18: nothing was accumulating. |
| 08-30 02:59 | Raising the local-tools sh() watchdog from 30 s to 900 s "made autonomy work" | The post-land suite was silently dead from 08-31 to 09-28, killed by the shell's 30 s default (fixed in `5e9a0b2`). |
| 08-30 07:59 | "88% picker monopoly" (in the message of commit `86cdbf2`) | runner_up was double-counted; the same error recurred 09-07 and 09-08. |
| 08-30 17:14 | Governor `44c2b21` cut CPU 5–17× | At 22:35 it was found largely cosmetic, because timeout escapes the process group. `791051e` fixed that. |
| 09-04 09:39 | "Load ~20 means the substrate is hot" | At 09:53 the load was traced to a qemu VM (6.5 cores); the substrate was using ~30%. |
| 09-11 12:41 | "LLM plane dead; dispatching futile" | 17 commits landed overnight through the 429 trickle. |
| 09-13 | "An anthropic 401 sets no cooldown" | Retracted the same day: it fired 151 times in 40 h. The operator had sampled the wrong unit. |
| 09-15 | "LLM plane not a blocker, verified serving" / "crash loop cleared, stable" | 09-17: 7 of 7 providers unusable, and a placeholder key made a dead arm look configured. |
| 09-17 06:24 / 07:04 | "Blocker cleared" / "the composer is drafting right now" | The registration lapsed at 06:25. At 09:11 the operator wrote "I was wrong last turn". |
| 09-17 09:14 | "No configuration path to a drafting-capable provider" | 09-18: federating to syzygy.host worked. |
| 09-25 18:33Z | "autonomous_pick lease gate live and verified" | A walk executed the test sentence and duplicated the edit (`31d07cd`). The lease does not stop in-flight composes (`768ae7c`). |
| 09-27 00:02Z | "The system can now see what it spends" | `98bc2b5` silently reverted `afc7d6d`. On 09-28 only 3.8% of executions recorded cost. |
| 09-27 02:13Z | "Phase 3 dispatch termination complete" | The same cause had been diagnosed 09-25 and left for 2 days. The post-walk double-compose recurred (`194df79`, `7eae3a0`). |
| 09-27 06:05 | "node 2 resolver spend ≈ 0" | Retracted at 06:15: node 2 spent $2.78 over 649 calls. |
| 09-27 07:16 | "4.4 spend-rate breaker done" | It contains the goal but does not learn from it. Hash `0ee592d0` was refused 629 times, and 295 more times in the 24 h to 09-28 15:13 (§5). |

---

## 2. Root causes (from the 41 problem rows, deduplicated)

1. **No single admission point.** Work enters through at least nine dispatchers: boredom, gap-compose watchdog,
   GapDrainObserver, the in-process nudge, rhythm-conductor, funnel-drain, apply-proposal, goal-host `/resolve`, and satisfier
   shells. Each bound was added to some of them and not the rest. That gave BUSY falling through to a shell walk
   (fixed 5 times), undirected composes bypassing the paused envelope (until `a1826314`), nudges bypassing the lease,
   "4 window-blind dispatchers" during graded runs, and operator work sharing the autonomous lane.
2. **A refusal leaves no trace the system can act on.** Envelope, breaker, lane-full, lease and recursion refusals are
   written to journal lines only. Failure memory is per node and prompt-only ("never gates spend"). The same remedy was
   decided 518 times between 09-24 and 09-28 (gap-history). The same hash was refused 629 times. The watchdog restarts
   263–542 times a day. The breaker's counts reset on restart.
3. **Environment failures are charged as fix failures.** Load timeouts count against the drafter (OR 3.34). Capacity refusals
   were counted as failed attempts; this was fixed for cooldowns on 08-29 and recurred on the directed path on 09-24.
   Restart and drain budgets (240 s) are shorter than a compose (5–15 min).
4. **Budgets are static constants or env vars, not shapes read at use time.** Examples: the timeout ladders,
   `IAS_SUBSCRIBER_MAX_INFLIGHT`, `TASK_GENERATION_ENABLED`, the breaker defaults 3600/6/240, and walkBudget with no
   producer on node 2. This violates law 1 and law 5.
5. **Resources the system does not observe.** Provider credit and key validity are not visible to it: no detector for
   credit exhaustion exists, arms are not gated on non-empty keys, and placeholder keys look configured. The identity
   rate-limit bucket is fleet-shared. Spend is metered at one resolver: the envelope reads `llmSpendSummaryNode`,
   while the trace store prices only 5.3% of executions.
6. **A single global mutex and a single slot.** The `change_window` lease had no name dimension until 09-23..25. The
   compose lane is cap 1 at about 48 per day, against about 42 new gaps per day plus self-minted children. The composer
   lands on its own repo and restarts itself.
7. **Reflexes with no bound.** self-recovery was autoimmune. The watchdog has no global attempt budget (docs-2: only a
   per-fire `attempts` counter, which contradicts the reflex-tier rule in SOFTWARE §5). `/resolve` had no lineage or
   depth check until `7f0425d`.

## 3. Why it recurs: the missing shared capability

Each fix built one piece of admission control at one entry point. Nothing combines those pieces into one seam. The
missing capability is **admission as a single shaped, durable, fleet-wide seam**. It has two halves, and both are absent:

- **(a) One chokepoint rather than N readers.** Live source on node 1 (`/workspace/git/vessels`, HEAD `f451e42`
  2026-09-29 01:37) has `spendEnvelope` logic in **7 files across 2 vessels**: boredom `index.ts` ×8; dev-vessel
  `gap-to-feature.ts` ×18, `feature-compose.ts` ×4, `substrate-gap.ts` ×3, `apply-proposal-as-patch.ts` ×3,
  `rhythm-conductor-tick.ts` ×2, `config.ts` ×1. The breaker exists only in goal-host `index.ts` (×9), the slots only in
  dev-vessel `compose-slots.ts`, and the recursion guard and the watchdog each live somewhere else. Every new bound therefore has to
  be threaded to every entry point, and each leak is found only after it has spent money (`a1826314`, `292aff1`,
  `054de6f`, `c313227`, `baa64cc`, `f28bc06`).
- **(b) Refusals as negative facts the selector reads.** A refusal should lower the refused goal's selection weight or
  put it on hold. At present the loop only re-rolls: it picks the same goal, is refused, and picks it again. This is the
  "3.4 negative facts" task that value-per-cost left unbuilt.

The seam belongs in the dispatch path, at the goal-host `/run-goal` and `/resolve` handler entry together with
dev-vessel's compose admission. Every dispatcher already reaches one of the two. Its records must be reachable over
discovery from either node (law 11; decentralized: an absence on one node is not an absence).

This is not a new idea. It is the general form of several partial versions already in the tree (§4). The envelope
proved the *shape* half works across nodes: `gap-to-feature.ts:4084` sums every discovered poolImpulse and
llmSpendSummaryNode producer, and the reader fails closed once a record has been seen. What is missing is the
*chokepoint* and the *memory*.

## 4. Prior attempts at this capability, and why each did not hold

| Attempt | Which part of the capability | Why it did not hold |
|---|---|---|
| activity-api `src/services/circuit-breaker.ts` (`26dae08`, 2026-04-10; CLOSED/OPEN/HALF_OPEN per vessel, writes `circuit_breaker_trace`) | Durable breaker state | Only `vessel-router.ts` imports it. **`circuit_breaker_trace` has 0 rows** (verified 09-29). It is a dormant duplicate of what `dispatchRatePolicy` later rebuilt in process. |
| BoundedBusSink L1 ×3 plus `IAS_SUBSCRIBER_MAX_INFLIGHT` (05-31) | In-flight bound | Copied into each vessel instead of the framework, and gated by an env var. The L3 OOM detector has 0 traces. |
| light-dispatch-vessel (06-03) | Relief for the dispatch SPOF | It routed around the leak without encapsulating it. The leak patch was never applied. |
| Throughput-paced boredom pool plus UCB1 (06-04) | Pace | A second selector next to Thompson, and timers kept multiplying. |
| Event drain replacing timers (07-09) | One entry path | The drain died on 07-23 (HTTP 400). The watchdog and timers stayed as parallel entry points. |
| Coalesce dedup `055406c` (07-21) | Identical-goal admission | Covers only concurrent copies, not repeats over time. |
| Compose slots `6ad3721..bf7fac0` (08-10) | Concurrency at one resource | Admission happens *after* selection (82.5% BUSY), and "REFUSED does not queue, it dies". The limit is local to dev-vessel. |
| walkBudget / lessonExecutionPolicy shapes (`f87f52f`, 08-16) | Budget as a shape | Readers were shipped without producers. Policy files were erased from a worktree. Node 2 still falls back to the literal 211 times a day. |
| Governor plus killtree `44c2b21`/`791051e` (08-30) | Host CPU admission | It works, but only for test execution in local-tools. |
| Rhythm registry, meta-rhythm budget 0.05 (09-07) | Law-5 pace | Works for auditors (241/day → 1 per 10 min). It does not cover dispatchers outside the conductor. |
| `refusal_events` table (activity-api) | Durable refusal store | 9,160 rows, but only two selector types (`no_producer_for_expected_shapes` 9,129; `promote_gate_below_threshold` 31), last written 09-26. No admission refusal is written there, and no admission reads it. |
| goal-host failure memory (09-22) | Negative memory | Per node, feeds the prompt only, and does not gate spend (mech 11). |
| Named leases and restart budgets (09-23..25) | Lease admission | A name dimension, but the failure path (3.3c) is absent. The reconcile holder keeps failing. |
| `autonomous_pick` lease (09-25) | Window admission | Does not stop in-flight work. Operator-controlled with no machine criterion. |
| `/resolve` recursion guard `7f0425d` (09-26) | Depth and lineage | Only within one process. Node 2 logged 72 RECURSION REFUSED in 24 h (verified). |
| `spendEnvelope` (09-27) | Fleet-wide shaped cap | Spend only, measured at llm-resolver only. Read by 7 separate readers, one of them a copy (`f28bc06`). Refusals are logged and not learned. |
| `dispatchRatePolicy` breaker `76c8e60` (09-27) | Per-goal repeat cap | In process, resets on restart, not learned from (629 refusals of one hash). |
| Growth governor (SUBSTRATE_AS_DYNAMICS, λ₁ ≳ ρ_grow) | Global admission against growth | Specified in the docs and **never built** (memory-8:376, transcripts-1:213). |

## 5. Current verified state (2026-09-29, 04:49–04:55Z, both nodes, journal over the last 24 h)

| Signal | node 1 `substrate-live` | node 2 `compose2-live` |
|---|---|---|
| `spend envelope exhausted` | 381 | 100 |
| `SPEND-RATE REFUSED` (breaker) | 335 | 226 |
| `compose lane full` | 424 | 117 |
| `RECURSION REFUSED` | 8 | 72 |
| gap-compose `watchdog_restart` | 542 | 76 |

- **Envelope binding.** The latest line is `spent 2.005 USD of 2 USD/h over 2 spend source(s)` (09-29 00:34–00:35 on both
  nodes). Node 1's exhaustion by hour: 06–08h, 11h and 23h–00h of 09-28/29, each 40–60 lines.
- **Breaker without learning.** Refusals by hash on node 1: `0ee592d0` 178, `960e4bdc` 78, `0a04b6a4` 59, `2e760e4c` 20. On node 2:
  `0ee592d0` 117, `960e4bdc` 51. `0ee592d0` is the trace-store-reconcile remedy: goal-host logs "FAILURE-RECALL — 5
  prior hollow verdicts" for it on 09-26 and 09-28, and the reconcile family sampler fired 622 times in 36 h. So the
  failure is remembered in the prompt but never stops dispatch. **The last breaker refusal on either node was 09-28 15:13**,
  and the family sampler's last fire was 15:13:07. That is **unattributed**. Two candidates: the reconcile dispatcher
  stopped, or goal-host restarted (`ActiveEnterTimestamp` 09-28 18:21:28) and reset the in-process counts, and the hash has
  not reached `per_hash_max` since. There is no positive control that tells these apart.
- **Watchdog.** The latest row (04:51:25Z) is `{"action":"watchdog_restart","open_intents":383,"stalled_min":262,"attempts":1,"ok":true,"http":200}`.
  Every row reports ok while the stall grows (docs-2 recorded 191→195 and 376→382 earlier).
- **Two meters that disagree.** The envelope gates on `llmSpendSummaryNode` from llm-resolver. The hub `execution` table
  prices 1,132 of 21,349 rows in 24 h (5.3%, $19.95).
- **Parked landings.** 47 files in `/workspace/parked-landings`, with no auto-resume.
- **Durable refusal state.** `circuit_breaker_trace` has 0 rows. `refusal_events` has no admission-type rows. Six refusal
  kinds (envelope, breaker, lane, lease, recursion, watchdog) exist only in journals.
- **Open gaps still recurring.** `db_performance_slow_queries_2026-09-18T16` was nudged into a full lane at 04:49:13Z. The
  reconcile narrowed-child re-emits (node2-runtime:64). The shared identity bucket is open.
- Cross-reference: the operator clone of development-vessel is at `ba0f30b` (09-23) with 0 `spendEnvelope` hits, while
  live is at `f451e42` (09-29). That belongs to `sync-deploy-drift`, not here.

## 6. What to keep, fold or retire

**Keep** (live-used, general): compose slots with the directed reservation and per-gap in-flight guard (`compose-slots.ts`);
the `spendEnvelope` shape and its cross-node reader (`gap-to-feature.ts:4084`); named change-window leases and age-based
restart budgets; parked landings (add an auto-resume); the long-running drain counter (`404a89c`, `bf74cc5`); run-goal
coalesce dedup (`055406c`); the test-exec governor plus killtree (`44c2b21`, `791051e`); `--no-block` on the gap kick
(`ca53600`); the `/resolve` recursion guard (`7f0425d`); the rhythm registry and rhythm budget hold; per-(task × model)
Thompson arms; `llmSpendSummary` and `llmSpendSummaryNode`.

**Fold:** boredom `readBoredomEnvelope` and its URL joiner (`f28bc06`) into dev-vessel `spendEnvelopeAllows` or the
shared seam. BoundedBusSink ×3 into the framework subscriber, with its cap as a shape rather than an env var. The breaker's
in-process counts and the activity-api `circuit-breaker.ts` into one durable store. The duplicated EARLY and late
edit-intent routes in goal-host into one route.

**Retire, or give a producer:** `IAS_SUBSCRIBER_MAX_INFLIGHT` and `TASK_GENERATION_ENABLED` env gating; the node-2
walkBudget fallback (give it a producer); `operator_pause` on rhythms (no reader); the third redundant compose entry point
(the watchdog should detect and file, not re-dispatch without a bound).

## 7. Retire condition (measured on both nodes, rolling 7 days, checked continuously)

1. **Refusals are learned.** No `goal_hash` is refused by any admission bound (envelope, breaker, lane, lease, recursion)
   more than **k = 12** times in 24 h unless its selection weight has measurably dropped. "Measurably dropped" means the
   selector's recorded weight or posterior for that goal or family after the k-th refusal is below its value at the first
   refusal, or the goal carries a hold. Currently: 295 refusals of `0ee592d0` in the window with no weight change.
2. **Refusals are shaped and reachable.** All 6 refusal kinds appear as rows in one discovery-reachable shaped store that
   the selector reads, and a read from either node returns the other node's rows. Currently 0 of 6 are anywhere but
   journals.
3. **Reflexes are bounded.** Count `watchdog_restart` rows where `stalled_min` has risen by at least 60 across consecutive
   fires with no other action taken. That count must be 0. Currently 542 per day on node 1.
4. **Supporting check, not a gate:** the share of executions carrying `cost_usd > 0` where an LLM was called is at least
   95%, so the gate and the trace store measure the same spend. Currently 5.3% of all executions.

The class retires when 1–3 hold for 7 consecutive days on both nodes, and no new problem row in this class appears in
the gap store or journals during those days.
