# Hub trace-read latency — measured, with two of my own prior claims refuted

Scope: latency of the trace-list read on the hub vs the local spoke, why it is
slow, and which callers pay for it. Every number below is from an interleaved
measurement with a stated control. The two headline results are **corrections**,
not confirmations.

---

## 0. The route, and an invalid probe I nearly believed

Trace reads live at **`/v2/activities/execution-traces`** (mounted at
`activity-api/src/index.ts:308`). My first probes went to `/v2/executions`,
`/v2/traces`, `/v2/activities` — all **404**, on both hosts.

A 404 from a path that never existed is not evidence about the trace store. An
invalid probe yields no valid negative; I only had a measurement once I read the
mount table.

---

## 1. HEADLINE — every unwindowed caller hard-fails against the store it actually uses

The store the fleet uses is the **hub**, and on the hub an unwindowed read
**never returns**:

```
hub, limit=500, no window  ->  000 after 57.1 s     (template-success-ranking-24h's exact call)
hub, limit=10,  no window  ->  000 after 60.0 s     (execution-trace.ts's exact call)
```

`limit=10` failing is the important part: **`limit` does not bound the scan**, so
even a ten-row request dies. **37 in-tree call sites issue unwindowed reads** (§5).
Against the hub, all 37 are hitting a path that hard-fails.

### Which store does the fleet actually use? The hub — verified from `/proc`

Read from process environment, not from unit files:

```
development-vessel (pid 2474509): METABOB_ENDPOINT=http://syzygy.host:18080
goal-host-vessel   (pid 2415230): METABOB_ENDPOINT=http://syzygy.host:18080
ribosome-vessel    (pid  756508): METABOB_ENDPOINT=http://syzygy.host:18080
boredom-vessel     (pid  869250): METABOB_ENDPOINT=http://syzygy.host:18080
```

Readers **and** writers point at the hub. And the hub is receiving this spoke's
work: 100 traces in the 15 minutes 05:48:58 → 06:03:23, including
`development-vessel:mitosis-tick` (8), `validator-dispatch` (68), `slot-binding`
(13) — spoke-side activities.

### The local store is stale, and that is the architecture, not a defect

| store | newest trace | advancing? |
|---|---|---|
| `localhost:18080` | `2026-08-02T20:29:19Z` | no — frozen ~9 days |
| `syzygy.host:18080` (hub) | `2026-08-11T06:03:23Z` | yes, continuously |

Over 45 minutes the local unit logged **718 requests** — 236 `/health`, 220
`/v2/mcp/analysis/run`, 159 `/v2/impulses/resolve`, 56 GETs of execution-traces,
and **zero POSTs** to the trace write path. The 718 is the control that makes the
zero meaningful: request logging is on, so this is a real negative.

But per CLAUDE.md the trace store (`activity-api`, role `api`) is **hub-owned on a
spoke**. Nothing reads local either — every vessel environ points at the hub. So
the local unit is an unused out-of-role leftover and its staleness is expected.
**I am explicitly not calling this split-brain**: I checked for readers pointed at
local and found none.

**What this corrects.** Last session I justified the `activity-api`
`StartLimitIntervalSec=0` drop-in as protecting "the only trace store this spoke
can reach." Measurement does not support that: the store I protected holds nothing
current and nothing uses it. The action remains harmless — it removes a start-rate
limit on a unit that is not crash-looping — but it should not be cited as evidence
about trace availability, and the unit it protects is not load-bearing.

---

## 2. The dominant latency term is the missing time window, not the hub

Same host, same `limit=1`, only the window varies. Interleaved **A/B/A** so
cache warming cannot masquerade as a treatment effect.

| local `:18080` | `since=now-1h` | default (no window) |
|---|---|---|
| rep 1 | 0.350 s | 36.06 s |
| rep 2 | 0.755 s | 37.64 s |
| rep 3 | 0.464 s | — |

Roughly **50–100×**, and later reps of the windowed form ran at 0.006–0.016 s.

`limit` does **not** bound the scan: unwindowed `limit=1` costs the same as
`limit=50`. `limit` *is* honoured in rows returned (asked 1, got 1).

The handler's own comments state the mechanism independently of my measurement —
the default window is 30 days, and SurrealDB "does not index-optimize
`executed_at >= X ORDER BY executed_at DESC` (it range-scans then sorts)".
`services/trace-retention.ts` says it outright:

> the `GET /v2/activities/execution-traces` hot path is **O(rows) under Bun
> event-loop contention**. Trace-read latency **gates the learning loop**.

Both rows I inspected carry `org_id='organizations:substrate'` with
`account_id=None`, so these measurements are on the **fast** org-scoped
composite-index branch — not the unscoped worst case. It is this slow anyway.

---

## 3. Hub-specific behaviour: a hard cutoff, and wide variance

- **Unwindowed on the hub never returns.** `http=000` at **56.5 s** and **59.3 s**,
  both with `ttfb=0` — no byte ever arrived. That is a server/proxy cutoff around
  56–59 s, not my client timeout.
- **Windowed on the hub succeeds**, so the hub store is *reachable*: 0.50–1.44 s
  across 8 consecutive identical reads once quiesced.
- **But variance is wide.** Across the session the same windowed read ranged
  **0.50 s → 32.4 s**, with occasional `000`. The hub is ~15–30× slower than local
  even windowed.

**My earlier "hub times out, 000/12s" was a client timeout against a query shape
that exceeds ~56 s — not a dead store.** Functionally unreachable for any sane
caller timeout, so the practical conclusion survived; the stated cause did not.

---

## 4. Two hypotheses of mine, killed by their own controls

Recording these because the controls are the only reason I am not reporting them
as findings.

**(a) "An abandoned expensive query saturates the DB and degrades later reads."**
Paired intervention: quiesced baseline → issue one unwindowed read, abandon at 5 s
→ immediately re-measure.

```
PRE  : 22.90s, 5.82s, 4.36s
POST :  3.38s, 2.16s, 3.83s, 2.32s, 2.53s
```

POST is *faster* than PRE. **Refuted.** The hub is simply high-variance.

**(b) "My heavy read is causing the activity-api restarts."** Two unwindowed reads
did each coincide with a restart. But `Result=success`, `NRestarts=0`, and the
journal shows an external `Stopping activity-api.service`, i.e. a clean external
SIGTERM. Decisively, the restarts **predate my session**: 04:23, 04:39, 04:42,
04:49, 04:59, 05:02 … while my heavy reads began ~05:35. **Refuted** — 17 starts in
84 min is ~1 per 4.9 min, so a 30 s read colliding is expected coincidence.

The churn is real and independent (that is the already-filed
`cutover-restarts-role-excluded-units-unguarded`). Its interaction with this
finding is the compounding part: a read that takes ~30 s against a store that
restarts every ~5 min has a meaningful chance of being cut mid-flight.

---

## 5. Who pays: 37 callers omit the window

Classifying in-tree `execution-traces?` call sites by whether they pass
`since`/`start_date`:

- **NO-WINDOW: 37** — most of `development-vessel/src/resolvers/*`, plus
  `ribosome-vessel/src/replay-observer.ts`, `stateful-ui-vessel`, `workbench`,
  `boredom-vessel:2815`.
- **WINDOWED: 12** — `boredom-vessel` (3 of its 4), `reachable-unlearned-report`,
  `substrate-health-tick`, `learned-topology-snapshot`, others.

Caveat on that count: the classifier is **line-local** grep, so a `since` appended
on a following line of a template literal would misclassify. I read 2 of the 37
members in full (below); the other 35 are grep-grade and the split should be
treated as approximate.

### The clearest single defect: `template-success-ranking-24h.ts`

It computes a 24-hour cutoff, **never sends it**, fetches unwindowed with
`limit=500` under `AbortSignal.timeout(15_000)`, and filters client-side:

```ts
const cutoffMs = nowMs - 24 * 60 * 60 * 1000;      // computed
`${METABOB_ENDPOINT}/v2/activities/execution-traces?limit=500`   // never sent
signal: AbortSignal.timeout(15_000)
```

Measured, n=3, that exact call: **18.74 s, 18.30 s, 18.65 s** — every one past its
own 15 s abort. **This resolver can never complete.** The windowed equivalent it
already computed: **0.36 s, 0.009 s, 1.65 s**.

Second, independent defect in the same call: the handler caps
`limit = Math.min(Math.max(limitParam,1),100)`, so `limit=500` **silently returns
100**. Verified — asked 500, got 100 rows. It believes it ranks over 500 traces.

`execution-trace.ts:9` has the same shape with a 30 s abort — marginal rather than
impossible, against a 28–37 s local read.

---

## 6. What follows

**Caller-side, safe and free**: pass `since` where the caller already only wants
recent data. For `template-success-ranking-24h` this is strictly
semantics-preserving — it discards older rows anyway — and turns an always-failing
call into a sub-second one.

**Not safe to apply blindly**: a window is a filter. Callers that legitimately want
all-time (audits, cluster scans) would silently return less. I verified `since`
itself is correct, by monotone sweep on local — 1d→0, 7d→0, 30d→100, 90d→100,
365d→100 — which is exactly the shape of a working filter, and the 0s are true
because local's newest row is 9 days old. **This is the trap to avoid: on the
local store, "add a 24h window" returns zero rows and looks like a fast success.**

**Server-side belongs to the substrate, not to a hand-edit** (law 6). The 30-day
window is a deliberate OOMKill bound per the code comments; "just widen the index"
naively re-opens what it was written to close.

**The thing worth acting on first** is §1: 37 call sites issue unwindowed reads
against the hub, where unwindowed reads hard-fail at ~57–60 s regardless of
`limit`. That is not a slow path, it is a dead one — and it is dead on the store
the whole fleet actually uses. Trace-read latency gates the learning loop; a read
that never returns severs it.

---

## Status

**Measured:** unwindowed reads hard-fail on the hub (`000` at 57.1 s / 60.0 s) even
at `limit=10`, because `limit` does not bound the scan; the window is the dominant
latency term (~50–100× on local, where reads still complete); `limit` is silently
capped at 100; ~37 call sites omit the window; one resolver provably never
completes.

**Verified, not assumed:** the fleet reads *and* writes the hub
(`METABOB_ENDPOINT` from `/proc/<pid>/environ`, four vessels); spoke traces do land
there (`mitosis-tick`, `validator-dispatch` in the last 15 min).

**Refuted (mine):** "hub trace store is down/times out"; "abandoned queries
saturate the hub"; "my read caused the restarts"; and — after the environ check —
my own first draft's claim that local staleness meant readers were on a nine-day
snapshot. Nothing reads local. Each died to a control.

**Corrected:** the round-5 rationale for the `activity-api` start-limit drop-in.
The action stands; the reason given for it does not, and the unit is not
load-bearing.

**Not done:** no code was changed and nothing was dispatched. The unwindowed-caller
class and the `template-success-ranking-24h` defect are gap-shaped and belong to
the substrate.
