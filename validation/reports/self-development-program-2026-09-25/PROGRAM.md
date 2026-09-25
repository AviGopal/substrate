# Self-development program — levers, owners, falsifiers (2026-09-25)

One ordered list of the changes that take the substrate to reliable
self-development, so the sessions working on it stop competing for the single
compose lane and every lever closes on an observation, not on "it landed".
Numbers are measured on `substrate-live` at 2026-09-25 02:30–03:10Z; every one
has a re-derivation command in the evidence section.

## What "reliably self-develops" means here

Measured, not declared. The program is done when, over a rolling 24h:

| Measure | Now | Target |
|---|---|---|
| Autonomous landings that hold (settled `held` by the attempt ledger) | not measurable (ledger 0/3 graded runs) | measured, and ≥ 80% of landings held |
| Gap close rate vs open rate (distinct classes, not per-event rows) | 36 closed vs 469 opened | closed ≥ opened |
| Autonomous `gap-closing` / `gap-drain` reach | 0/32, 2/54 | ≥ 50% |
| Reach on admitted dispatches (pre-admission refusals excluded, split by author) | 14% raw; ~36% excluding refusals and empty runs | ≥ 70%, then the ~90% contract |
| Goal parity: human surface vs direct goal-host vs cockpit | surface = direct on the one comparable goal; cockpit unreachable (stale key) | equal reach and path on a matched set |

## Resource budget (the system should never run redlined)

Current: 16 cores, 65 GB. Compute is not saturated (~5 of 16 cores; load 5–7).
The waste is concentrated in storage and one process:

| Resource | Now | Budget |
|---|---|---|
| Trace store on disk | 42 GB (40.8 GB unreclaimed RocksDB blobs; blob GC off) | < 5 GB |
| SurrealDB resident memory | 19.7 GB | < 8 GB |
| SurrealDB CPU | ~3.9 cores (retention deletes timing out) | < 1 core steady |
| A loop repeating an action the system already refused | pinned scaffold dispatch every ~90 s (234 in 6h); reconcile 89/24h reaching 1 | ≤ 3 repeats/hour of any refused action |
| Full test suites in parallel | ≤ 3 × 0.5–0.9 GB (compose verify + pull-sync baseline) | acceptable; cache baselines across restarts |

## The levers, in order

Lane cost = development-vessel compose slots it needs. The lane is shared; a
session dispatches only inside its own window. This session adds no lane
dispatches of its own.

| # | Lever | Owner | Falsifier (closes it) | Lane cost | Depends on |
|---|---|---|---|---|---|
| 0 | **Honest denominator**: pre-admission refusals recorded as `refused` with a caller, not as failed runs | substrate (gap `a-pre-admission-refusal-is-recorded-as-a-failed-run-…`) | no `failed` record starting "refusing pinned target" for 1h; every refused record names its caller | 1 | — |
| 1 | **live-self-view**: gates read the push clone, not the stale checkout (6.1 in flight; 2.2 operator-tier; 5.2 waits on a trigger; 3.1 one landing left) | substrate-30 [2876f5] (confirmed) | the change's own falsifiers; unexplained refusals ("no failure detail") fall | 2 | — |
| 2 | **causal-attempt-ledger**: every landing registered, settled `held`/`regressed`, credit deferred | ledger lead [aac97f] + runner [f076b8] | 3 consecutive passing graded runs | runs + #53 fixes | 0 (honest counts) |
| 3 | **Gap aggregation** for per-event detectors (done for unaccounted landings: b6f0d14, 617b12a) | ledger lead [aac97f] | route-closes predicate lands; no detector files > 1 gap per class per hour | 1 | — |
| 4 | **Escalation dedupe**: one human question per hopeless gap across restarts | substrate (gap `hopeless-gap-escalation-dedupes-in-process-memory-…`) | ≤ 1 accepted escalation per gap id per 24h | 1 | — |
| 5 | **Gap-closing diagnosis**: why autonomous gap-closing reaches 0/32 | this session (done 03:10Z, see below) | each miss class named and filed as one gap | 0 | 0 |
| 6 | **Arm bad-satisfier suppression** ("would be PROVEN-BAD … suppression is HELD"); accepted for after graded run 11, behind a re-baseline that strips composes killed by the drift/freshness gates from β | ledger lead [aac97f] (accepted, conditional) | walks stop selecting satisfiers with a decisively negative posterior; reach on those goals rises | 1–2 | 2 |
| 7 | **Decentralized compose ownership**; per-repo cutover leases recorded in its design.md as a separate follow-up change | compose-ownership [391b83] | a second node composes its owned repos while node 1 self-lands; per-repo leases let two repos cut over in parallel | tasks 3.x | operator: second node |
| 8 | **Gap disposition** (close / merge / defer / drop on evidence) | unowned: new change after 3 and 5 | closed ≥ opened over 24h without closing live defects | new change | 3, 5 |
| 9 | **Human surface truthfulness**: awaiting count; substrate-run surface check | substrate (gap `the-surface-awaiting-count-…`); image decision for a browser | `surface-state-probe.ts` all predicates pass; a substrate-run check exists | 1 | operator: browser |

## Lever 5 finding — why autonomous gap closing fails (24h to 03:10Z)

149 autonomous gap dispatches: gap-decompose 15/60 reached, gap-closing 0/34,
gap-drain 2/55. The misses are three classes, not a capability ceiling:

| Class | Misses | Filed |
|---|---|---|
| gap-drain pins a remedy template that has never existed (`development-vessel:db_performance_slow_queries`, minted hourly by trace-store-health-observer) | 39 | `the-slow-query-detector-names-a-remedy-template-that-does-not-exist-…` |
| compose lane at capacity (BUSY) | 44 across the three triggers | lane capacity: levers 7 and 0 |
| edit accepted but no landing evidence (hollow) | 14 gap-closing | measured by lever 2 once attempts settle |

## Lane schedule (as agreed 03:10Z)

1. Ledger graded run 8 finishes.
2. Ledger landings, sequential: development-vessel `attempt-register.ts` (#53),
   then `feature-compose.ts` (#53, **held until live-self-view 6.1 settles** —
   same file), then goal-host `g-retrycap`.
3. Ledger graded runs 9, 10, cold boot, 11.
4. live-self-view (substrate-30) and compose ownership (391b83) dispatch in the
   gaps between those windows; ownership moves in 75-minute windows and will
   not bring up node 2 during a graded-run window.
5. **File freeze (ledger ruling, 05:25Z):** development-vessel `attempt-register.ts`
   and `attempt-checks.ts` are frozen from a passing run 9 through run 11. If
   run 9 fails, compose-ownership 3.1 may land on `attempt-register.ts` before
   the next run.
6. Unheld substrate gaps from this audit (levers 0, 4, 9 and the phantom
   remedy) are left to the substrate's own gap drain.

## Decisions only the operator can make

1. **Trace-store fix** (see `TRACE-STORE-GROWTH.md`). ~89% of 41 GB of blobs is
   garbage from activity-api's 30-min `REBUILD INDEX` on `activity` (every
   ~20 KB row rewritten, blob GC off); live data is ~5.2 GB. Code fixes are
   filed held for the post-run-10 window: rebuild only on invalidation, expire
   `cluster_shadow_decision` impulses, drop the dead `activity_template`
   UPDATE, and make `context_thompson_scores` writes conflict-safe. Reclaiming
   the garbage needs the surrealdb unit stopped in a window (after run 12
   ~12:15Z, or after a failed graded run): a forced blob-GC compaction on a
   backup first, which needs a Rust toolchain not present on host or in
   container, or export/import as the fallback (the 08-12 attempt ended
   `ok=3 fail=6`). Not riding on the cold boot (law 12).
2. **Cockpit key.** `~/.metabob/config.json` holds a key identity rejects
   (401); the live operator key differs. One line fixes it (see report).
3. **Browser in the image**, so the substrate can check its own surface.
   Gap (held): `the-substrate-cannot-see-its-own-human-surface-…`.
4. **A second compute node** for lever 7.
5. **Discovery-vessel policy**: 312 open gaps target a protected vessel no
   cutover may land on.

## Periodic check of the human surface

`validation/human-participation/surface-state-probe.ts` photographs the live
surface, crops each region, and checks it against its source (runs vs
goal-host, questions header vs API, findings vs gap store, shapes vs
discovery, data routes). Run it every few hours while the program is live,
and after any human-surface landing.

```
PLAYWRIGHT_MODULE=$PWD/.video/node_modules/playwright/index.mjs \
CHROMIUM_EXECUTABLE=$(ls -d ~/.cache/ms-playwright/chromium-1224/*/chrome) \
bun run validation/human-participation/surface-state-probe.ts --out=<dir>
```

First run (02:59Z): runs 50/50 and running count match; findings 10/10;
shapes 402/402; data routes all 2xx; **questions header 43 vs 178 unanswered
(fail)**; runs list shows 3.8% of its rows without scrolling; 39 of 50 runs
have no goal text (lever 0).

## Goal parity: human surface vs direct goal-host (03:20Z; cockpit out of scope)

Four goal classes, each sent through the surface's Ask box in a real browser
and straight to goal-host `/run-goal`:

| Goal | Surface | Direct | Reading |
|---|---|---|---|
| Arithmetic, store in memoryNote | `73511ecf` reached (160246 verified) | `f449f02c` reached (verified) | parity |
| Count open gaps | coalesced onto the direct run | `71d2f2c7` reached (1659 verified) | one execution by design |
| Where is `leaseStem` defined | `6bba16ee` failed after 3 attempts | `8ecbc7b6` reached, 1 attempt | **control:** the surface's exact text sent direct (`911ac586`) inferred the same extra target and needed 2 attempts; direct text again (`7da13b99`) reached in 1. Text sensitivity, not entry point |
| development-vessel `in_flight` | `439b8aa3` failed, 11 attempts | `7d58ab22` failed, 14 attempts | parity in failure: inference picked `shellResult` over the advertised `vesselHealth` |
| Any goal while goal-host drains | "ingress proxy failed … NO_RESERVATION", no retry | "draining for restart — retry" | **surface worse**: routes to an unreachable federated peer |

**Re-run on the healthy system (08:52Z, after the container restart):** three
matched pairs, 6/6 reached, identical inferred target shapes per pair, all
deterministic verifiers passing (174793; the leaseStem path; 1803 open gaps).
Wall times direct/surface: 92/82 s, 43/55 s, 7/29 s: no systematic penalty for
the surface. The earlier `leaseStem` miss was text sensitivity under load, not
the entry point.

Verdict: goals sent through the surface behave as goals sent directly,
except during a goal-host drain, where the surface names the wrong cause
and offers no retry. Gaps filed: `while-goal-host-drains-the-surface-routes-…`
and `goal-target-inference-picks-shellresult-over-the-advertised-vesselhealth-…`.

## Evidence (re-derivation)

- Storage: `du -sh /var/lib/surrealdb/data.db`; per-type sizes of `*.blob`,
  `*.sst`; `grep enable_blob_garbage_collection data.db/OPTIONS-*`.
- Retention failures: `journalctl -u activity-api --since -24h | grep -c "batch FAILED"`.
- Reach and refusals: `/workspace/goal-host-dispatches.json` filtered by
  `startedAt`, grouped by `reached`, `operator`, `trigger`, `error`.
- Gap flow: `/workspace/git/super-repo/gaps/gaps.json`, `detected_at` and
  `closed_at` windows.
- CPU per process: 10 s `/proc/<pid>/stat` utime+stime delta, attributed by cgroup.

## Integrated sequence (from 11:00Z, 2026-09-25)

Aims: **L** latency, **R** reach, **S** development speed (drafts that land,
discovery→landing ratio), **D** decentralization. One change per slot, landed
from a pre-validated exact edit, measured before the next (law 12). A
development-vessel landing restarts the composer, so within a slot
development-vessel changes go first, then activity-api or other vessels.

**Window after run 10 (10:56–~12:11), already agreed:**
- ownership: 5.1a, 5.2, 5.2b on development-vessel (**D**)
- coordinator: m1-trainer concept-search fallback removal (**L**; 624 dead searches per 15 min)

**Runs 11 → cold boot → 12:** no machine changes (the cold boot must be the only change).

**After run 12 (the lane is open), in order:**

| # | Change | Where | Aims | Falsifier |
|---|---|---|---|---|
| 1 | Retry targets the gate's corrected site (suspected_real_location before edit_site) | development-vessel gap-to-feature.ts | S R | wrong-site refusals/24h fall (35 of 123 today) |
| 2 | Stop redrafting after two same-class failures; reframe or escalate | development-vessel gap-to-feature.ts | S L | same-class retries fall from ~40% of retries |
| 3 | Vacuous guard allows level demotions, then SQL logging to debug | development-vessel vacuous-edit.ts → activity-api db/surreal.ts | L | activity-api log bytes −90% |
| 4 | Learning writes off the request path; conflict-safe posteriors | activity-api execution-traces.ts, posterior-aggregator | L R | posterior observations == outcomes; 0 conflicts |
| 5 | concept-db lexical recall fixed (alone: changes ranking) | concept-db concept.ts | R S L | lexical matches > 0; search p50 < 40 ms |
| 6 | boredom caches its fixed concept query | boredom-vessel | L | ≤ 1 search / 15 min |
| 7 | Pre-admission refusals recorded as refused, with caller; find the pinned scaffold dispatcher | goal-host | R (honest denominator) | 0 "refusing pinned target" failures |
| 8 | Surface: awaiting count; drain routing; no federated fallback for local state | human-surface-vessel | parity | surface-state-probe all pass |
| 9 | Trace sender: idempotency key, backoff, timeout above server p99; then 202 + queue | ias-executor-ts, activity-api | L | 0 duplicate deliveries; POST p99 < 20 ms |
| 10 | Pooled query path runs its own SQL; then enable the pool | activity-api db/surreal.ts | L | no connection per query |
| 11 | Classifier stops rewriting activity rows; shadow impulses expire | activity-api | L, storage | no whole-table rewrites; store growth ~0 |
| 12 | Trace-store compaction window (method: operator decision) | surrealdb | L, storage | data.db < 5 GB; surreal RSS < 8 GB |
| 13 | The system authors exact-edit goals (verified anchors + scratch tsc before a compose slot) | development-vessel | S R | autonomous first-try landing rate toward the operator rate (4/4) |
| 14 | Gap disposition (close / merge / defer / drop on evidence) | new change | S | closed ≥ opened per 24h |
| 14b | Settled `regressed` debits the Thompson β of the template that produced the landing (ledger's first slice records lessons and withholds extraction but defers any α/β write) | development-vessel / activity-api learning state; separate change, alone (law 12) | R S | withheld-β share falls (34 withheld vs 7 applied per hour today); posteriors of regressing templates drop |
| 15 | Node 2 and per-repo cutover leases | ownership change + ops | D S | two cutovers in parallel; compose BUSY refusals fall |

Items 1–3 go first after run 12 because they change how every later item
lands: fewer wasted drafts and a guard that allows log-cost fixes. Item 13 is
the structural version of what made today's four landings first-try, and
item 15 raises lane capacity for everything after it.
