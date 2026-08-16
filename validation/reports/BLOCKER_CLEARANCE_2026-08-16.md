# Blocker clearance — what was fixed, what was measured, what is still blocked

Session goal: *clear all blockers, prune the rows, make all required fixes, review code touched
for architecture violations, demonstrate valid reaching of increasingly compositional patterns.*

Every number below is measured against the running system on 2026-08-16, not cited from a source
comment. Where a figure replaces one I previously asserted, the retraction is explicit.

---

## 1. The headline defect: blame was annihilated at the draw

The prior review (`LEARNING_ARCHITECTURE_REVIEW.md` §0) said blame never lands. **That was wrong in
its mechanism.** Measured on the hub, 78 of 91 sampled arms carry `thompson_beta > 1`, one at
113.59 after 395 executions. The write path works.

The draw did not. `goal-host index.ts:5636` computed

```ts
(Math.random() ** (1 / alpha)) / (Math.random() ** (1 / beta))
```

which is not a Beta variate: as β grows, `Math.random() ** (1/β) → 1`, the denominator — the whole
blame term — drops out, and the draw collapses to ≈ `Math.random() ** (1/α)`, increasing in credit
and blind to failure. Against `producer-pick.ts:34`'s `sampledScore > 0.5` gate, which ranks a
learned scaffold at **−1, ahead of fresh derivation** (200,000 draws per arm):

| arm | α | β | posterior mean | shipped | true Beta |
|---|---|---|---|---|---|
| `learned-auto-bridge-shellresult` | 8.95 | 53.96 | 0.142 | **99.8%** | 0.00% |
| `learned-satisfier-http-response` | 3.17 | 30.20 | 0.095 | **89.9%** | 0.00% |
| `auto-bridge-code_modification_proposal` | 1.00 | 113.59 | 0.0087 | **50.4%** | 0.00% |

So the more an arm had failed, the more reliably it was preferred over deriving anew — law 3
inverted. Fixed in `d69a4ad` (Marsaglia-Tsang gamma → `X/(X+Y)`, extracted to `src/beta-sample.ts`).
Tests assert **moments** against closed form across seven shapes including α<1 and extreme skew,
because the old expression returned a finite, positive, well-typed number for every input — only
the moments catch it. Verified live on the spoke at 12:47:44.

**The transferable lesson.** I audited both ends of this channel — the write and the read — and
found nothing, because both were correct. The defect was the *transform in the middle*. "Half-wired
channel" was the wrong class; this was a fully-wired channel with a broken transform, and no
written-vs-read detector would have caught it. **A distribution needs its draw checked, not just
its parameters.**

## 2. Retirement could not fire, for four independent reasons

`checkAndRetireTemplate` has never retired anything. Measured: `retired_reason = "poor_performance"`
on **0 of 100** sampled rows, while an arm at posterior mean 0.0087 with 395 executions stayed
fully selectable. `retired` is genuinely filtered (`discover-by-shapes.ts:179/184` and the recommend
path), so this was a real hole, not a decorative flag.

1. Its only call site is `POST /v2/activities/executions`. Nothing in the fleet posts there; traces
   go to `/v2/activities/execution-traces`. Commit `f2857fc` repaired its UPDATE binding correctly
   and the repair was **inert for want of a caller**.
2. It reads `FROM execution`; the ingest handler writes `activity_execution_traces`.
3. `learned-auto-bridge-shellresult` carries 407 executions in `variant_performance_metrics` and
   **zero rows in `execution`** — so its `< 20 → return false` guard refuses precisely the arms that
   earned retirement. That filtered read also took **43.5s** live (unindexed on `activity_id`).
4. `surrealDB.query<T>` returns a flat `T[]`, but it does `recentExecutions[0] || []` then
   `.filter(...)` on it — `.filter` on a single row object, which throws, is swallowed by its own
   catch, and returns false. **It has never once completed its own body.**

Fixed in `e2d7077`: `checkAndRetireByPosterior` reads `variant_performance_metrics` (indexed, O(1)),
judges on the posterior mean rather than the stored `success_rate`, and is called from the ingest
route the fleet actually posts to. It **deliberately does not sweep** — it fires only on a graded
failure, so arms retire one fresh failure at a time. The same predicate applied retroactively would
retire most of the live corpus in one write (highest posterior mean in a 91-arm sample: 0.604).
Thresholds read at use time via `getTuningParam`, not frozen as constants.

## 3. Two shapes had readers and no producers — my own miss

`walkBudget` and `lessonExecutionPolicy` are resolved at use time by goal-host and had no producer
anywhere. Confirmed with the consumer's own instrument, against a query proven to show positives:

```
memoryNote             2 vessels
bodyHonestyPolicy      2 vessels
walkBudget             0 vessels
lessonExecutionPolicy  0 vessels
```

and goal-host says so on every floor entry: `walkBudget resolve failed (no resolver for shape) —
FALLING BACK to literal budget iters=4 calls=8`. **A reader without a producer is not a law-1 fix;
it is the same frozen constant with a longer code path, and it reads as landed.** Fixed in
`f87f52f`, both mirroring `bodyHonestyPolicy`: validated JSON from the container volume at use time,
serve when usable, serve nothing when not so the consumer keeps its documented fallback.

`lessonExecutionPolicy` gates verbatim execution of a recalled `curl`/`wget` lesson. **Shipping the
producer enables nothing** — absent, malformed, flag-absent and `false` all resolve null and the
consumer stays fail-closed. Only the literal boolean `true` enables; `"true"`, `1` and `"yes"` are
refused, because this is the one switch whose accidental truthiness would give autonomously-authored
concept-db text a deterministic path to the shell rather than a persuasion-dependent one.

## 4. The prune is blocked by DB congestion, not by policy — STILL BLOCKED

I previously reported this mechanism as disabled. **That was wrong**: it is enabled and not
dry-run (`TRACE_RETENTION_ENABLED=true`, `TRACE_RETENTION_DRY_RUN=false`, `TRACE_STORE_CAP=150000`,
read from `/proc/<pid>/environ`). I had inferred "never runs" from absent logs in a 4,000-line
window on a 2-day-old process — the boot line had simply rotated out. That is the negative-evidence
trap, and the authorization to prune was never the missing piece.

Measured state of the trace store:

```
row_count 446,705   cap 150,000        ← 2.98× over its own cap
slow_queries 70,735 / 109,196 queries  ← 65% slow
error_rate 9.46%    mean 6,620ms   p95 14.1s   p99 45s   max 300s
```

Every sweep behaves identically:

```
valve: counted      total=446,430  ceiling=150,000  willPrune=true
valve: first batch  requested=25  returned=25  surplus=296,430  target=20,000
   ~4 min later →   sweep cycle failed: "SurrealDB query failed: The operation timed out."
```

It selects 25 ids, issues the DELETE, and the DELETE times out — **deleting zero**. Surplus climbs
monotonically across cycles: 294,970 → 295,625 → 296,430. The sweep is not slow, it is stalled, and
ingest outpaces it.

**The load-bearing new observation:** the retention sweep and the periodic FTS scorer rebuild fail
at the *identical millisecond* on separate cycles — `12:16:59.611Z` and `12:46:59.611Z`, both
`[trace-retention] sweep cycle failed` and `[FTS] Periodic FTS scorer rebuild failed`. Two
independent subsystems released together by one 300s timeout means both were blocked on the same
saturated DB. `max` query latency is 300,007.9ms — exactly the timeout.

This is **not** the batch-size question the source comment leaves open. That comment records
batch 25 at 3.52 s/row as its best measured state; the valve now achieves 0 rows/cycle. Something
regressed beyond tuning, and the co-timestamped failures point at DB saturation with the FTS rebuild
competing for the same capacity. The comment's own conclusion — "the remaining explanation is the
storage engine's delete path for this table, which is a design question (partitioning, a different
retention substrate, or not storing this volume at all)" — is the right frame, and the FTS rebuild
thrash is a new, cheaper lead worth testing first.

**Not attempted, deliberately.** Intervening on a saturated production DB — disabling the FTS
rebuild, tuning batch size blind, or hand-deleting — is an unvalidated gamble against the one
component whose failure takes the fleet down, and the backup is not restore-grade (a live-volume
tar of a running RocksDB, `tar` exit 1 "file changed as we read it"). A consistent copy requires
stopping the DB, i.e. a full outage to protect trace rows that are being deleted by policy anyway.
Recommended next step, in order: establish whether a periodic FTS rebuild ever completes at this
row count; if not, back it off and re-measure the valve on a genuinely quiet table — which is also
the re-test the source comment explicitly asks for.

## 5. Corrections to figures I previously asserted

| claim | status |
|---|---|
| "blame never lands / negative half severed" | **wrong mechanism** — blame lands; the draw destroyed it |
| "hub disk 99% full" | **false** — 42G of 619G, 7%, 578G free |
| "PAT expired, pointer-bump dead" | **false on the hub** — `git ls-remote` authenticates; clone HEAD == origin/dev == pointer; both fixes deployed this session by pull-sync with no hands |
| "trace retention is disabled" | **false** — enabled, not dry-run; it is stalled, not off |
| "~29,354 prunable rows" | **order of magnitude low** — surplus is ~296,000 |
| "every arm has 0 successes" | **my own query artifact** — keyed on `successes`/`success_count`, which do not exist |

## 6. Deploy chain, verified working

Push → pull-sync (10-min tick) → mirror to `/vessels` → unit restart, with no operator hands beyond
the push. Observed end-to-end: `[pull-sync] goal-host-vessel: content ee90dc21 -> 6e971521
(git d69a4ad5) — mirroring into /vessels` at 12:47:44, `ActiveEnterTimestamp` the same second.

## 7. Left out, and why

- **PAT rotation** (hub serves unauthenticated data; 25/30 environs hold the PAT). Requires a
  GitHub credential only a human can mint. It cannot be included in "clear all blockers"; naming it
  here so it does not vanish from that phrase.
- **The trace-store congestion** above — a design question, not a tunable, and not safe to gamble on.
- **`repairSignatureOf` returns a Promise its tests never await** (4 pre-existing failures in
  goal-host on a clean checkout). Found while establishing a regression baseline; not in scope, but
  a signature function whose tests are dead is worth its own fix.

---

## 8. The compositional ladder — run, graded by hand

Each rung dispatched with a nonce for attribution, then graded against ground truth I captured
independently. `reached` is reported alongside my own verdict, because they disagree.

### Rung 1 — single shape, external fact. `d83905f9`, nonce `ladder1-105eb7`
Goal: number of registered vessels **and** registry uptime.
`reached: true` — "deterministic:verified-registry-count — independently queried
`/registry/stats.totalVessels=11`; the produced output matches the authoritative registry."

**My grade: PARTIAL.** `totalVessels: 11` matches the ground truth I captured before dispatch
(`registeredVessels: 11`) — genuinely verified, not asserted. But the goal asked for *two* numbers
and the output carries `"uptime": null`. It chose `/registry/stats` (no uptime) over `/health`
(which has it), answered half, and the judge graded the half it checked. The verification was real;
its *scope* was narrower than the goal.

### Rung 2 — two shapes, chained. `45870e9e`, nonce `ladder2-95d19b`
Goal: health of discovery-vessel **and** development-vessel, persisted as a memory note naming each.

The decomposition was genuinely compositional and worth crediting:
```
inferred_target_shapes ["vessel_health_report","memoryNote_write"]  confidence 0.9
derivation-intent  intermediate ["vessel_health_report"]  terminal ["memoryNote_write"]
```
Both shapes were produced and the note really persisted — I read it back out of the store, and it
carries my nonce, so it is attributable.

**My grade: FALSE REACH.** `reached: true`, with the judge stating *"The output successfully
summarizes the health of both the discovery vessel and the development vessel."* The persisted note
(`id: vessel-health-summary`) summarises **`analysis-vessel-local` only**. Neither named vessel
appears anywhere in it. The judge asserted a fact about content it did not check.

The mechanism worked and the binding failed: two shapes, correctly ordered, correctly chained, a
real durable write — pointed at the wrong subject. This is the compositional analogue of the
write-shaped-goal defect: *graded on the write, not the content.*

One gate did behave correctly, and it is the one this session repaired the sibling of:
```
walk: WITHHELD alpha-credit for satisfier:memoryNote_write —
      no in-chain producer-to-consumer edge and no landed sha
```
The credit path noticed the two steps were not really composed and refused to reward it, even
while the reach judge was calling it a success. Credit discipline is ahead of reach discipline.

### Rung 3 — not run, and why
The Io-calibre rung tests whether a recalled lesson survives to execution. It cannot be tested on
this spoke: concept recall is dead here (§9), so no lesson reaches the drafter, and the verbatim
lever has nothing to act on. Running it would have measured the transport outage, not the ladder.

## 9. Concept recall is intermittent over the relay — CORRECTED FROM MY FIRST READ

**What I first wrote here was wrong and is retracted in place.** I claimed the spoke was dialing a
stale peer, on the reasoning that the egress target `138.197.116.56` is not the hub
(`syzygy.host` = `104.236.0.175`). The inference was bad: that address is the **relay**, not the
hub, and the spoke holds a live circuit through it.

Evidence that the transport is healthy:
```
federation-transport-vessel: active
  activeReservations: 1   reservationTtlRemainingMs: 3,578,703
  connections: [{peer: 12D3KooWJ9Jdv..., addr: /ip4/138...}]
[fed-transport] egress/resolve -> concept via 6yz95okd7tjBHWkVAAdZ      (requests ARE forwarded)
[fed-transport] hub-register per-vessel (10 rows) -> all ok             (hub registration works)
```

And the hub's concept-db is healthy and **fast**, answering my own dispatches' queries:
```
13:21:57.990Z [concept-db] [searchConcepts] lexical ladder matched — skipping the dense leg
              entirely {"lexical_hits":4}   term: "shellResult pointer payload"
```

So the request leaves the spoke, the hub answers in milliseconds, and the response does not return
within budget. It is a **relay round-trip / queuing** problem, not a dead address and not a
concept-db fault.

It is also **intermittent, not total**, which my first write-up also got wrong. Both outcomes occur:
```
13:11:07  arg-synthesis lessons: chars=405 via=opts          shape=shellResult      (recall WORKED)
13:13:13  recall FAILED TimeoutError ... budget=12000ms
13:13:13  arg-synthesis lessons: chars=0 via=hash-fallback   shape=vessel_health_report
13:13:41  arg-synthesis lessons: chars=0 via=hash-fallback   shape=memoryNote_write
```
This matches the standing "concept-db recall fails ~80% — contention, not flakiness" observation
rather than an outage. Law 8 is degraded here, not severed, and the fix is latency/contention on
the relay path, not a peer address.

**A real defect found while chasing this, and it is not the one I expected.** `concept` is an
**overloaded shape**. Three rows advertise it:
```
development-vessel-local          http://localhost:8090   (non-libp2p, LOCAL)
development-vessel-local@spoke-…  libp2p
concept-db-local@syzygy-hub       libp2p
```
`goal-host index.ts:1040` filters them by **vessel name** (`/concept-db/i`) before preferring a
non-libp2p endpoint, which discards the only local HTTP producer and forces every recall over the
relay. That looks like routing-by-name — an architecture violation — but it is **defensible and
should not be "fixed" naively**: the two producers mean different things under one key. Asked
directly, `development-vessel` returns
`{"shape":"concept","body":{"concept_name":"multi_step_resolver_flow", …}}` — trace pattern-mining,
not the prose-lesson recall the walk expects. Re-routing to it would silently feed the drafter
wrong-typed content.

The genuine defect is therefore **upstream of the routing**: a shape is a routing-and-reasoning key,
and two incompatible meanings share this one, which is exactly what forces a consumer to
discriminate by vessel name. The fix is to split the vocabulary (e.g. a distinct shape for
trace-pattern concepts), not to change the picker.

## 10. The operator feedback channel is not reachable with the documented credential

`POST /v2/activities/feedback` with the `~/.metabob/config.json` API key returns
`{"error":"Unauthorized","message":"Missing organization context"}`, with or without an explicit
`org_id` in the body or `X-Org-Id` / `X-Organization-Id` headers. The route wants JWT org context.
So step 4 of the canonical loop — record an operator verdict into the corpus — has no working path
from the documented client config. I could not record the rung-2 false reach through it; it is
recorded here instead.

## 11. What enabling verbatim lesson execution actually did

`policies/lesson-execution-policy.json` on the spoke now contains `{"verbatimCommands": true}`, and
the shape resolves:
`{"resolved":true,"shape":"lessonExecutionPolicy","body":{"verbatimCommands":true}}`.

**To revoke: delete that file.** No restart, no code change, no deploy. That revocability is the
whole point of making it a shape rather than a constant. Its current practical effect is nil
because concept recall is down (§9) — it will begin to matter the moment that transport is fixed,
which is worth knowing before fixing it.

---

## 12. Retirement acceptance test — RAN, INCONCLUSIVE. The fix is not proven live.

Both fixes are deployed and running: goal-host on the spoke carries `beta-sample.ts` and the
`betaSample(alpha, beta)` call site (restarted 12:47:44); activity-api on the hub carries
`checkAndRetireByPosterior` (MainPID 1175073, restarted 13:24:08 after its migration pass).

I then tried to prove the repaired negative loop end to end on a live arm that has genuinely earned
retirement — `learned-satisfier-http-response`, **202 executions, posterior mean 0.0951,
`retired: false`** — by posting one failing trace through the real ingest route.

Pre-state / post-state:

| | executions | α | β | retired |
|---|---|---|---|---|
| before | 202 | 3.1737 | 30.1967 | false |
| after | **203** | 3.1737 | 30.1967 | **false** |

The trace stored (`{"success":true,"stored":true}`) and the execution counter incremented. **Nothing
else moved, and retirement did not fire.** Two reasons, at least one of which is my test's fault:

```
[learning] Thompson Sampling score update returned no results in either table
  {execution_id:"retire-probe-7d56de", activity_id:"learned-satisfier-http-response",
   org_id:"public", org_id_alt:"organizations:public", alpha_delta:0, beta_delta:1}
```

1. **Wrong tenancy.** My synthetic trace defaulted to `org_id: "public"`; the arm's
   `variant_performance_metrics` row lives under another org, so the α/β update matched nothing.
   `checkAndRetireByPosterior` scopes its read the same way and would have found no row either.
2. **No reach verdict.** My call site is gated on `!reachUngraded && !reachEffectiveSuccess`, and a
   hand-posted trace with no reach tags very likely classifies `ungraded` — in which case the gate
   declined it *by design*, since an ungraded outcome must neither credit nor blame.

**So the claim "retirement now fires" is NOT established.** What is established: the code is live,
11 unit tests pin its behaviour, and the four reasons the old path could never fire are each
verified. Proving it end to end needs a trace that carries the arm's real org *and* a reach verdict
— i.e. a genuine failing dispatch of that arm, not a synthetic POST. That is the next session's
first task, and it is cheap once framed correctly.

**A real secondary finding, and it is the session's recurring class again.** One ingest produced a
*split outcome*: `total_executions` went 202 → 203 while α/β did not move. Two writes in the same
handler, keyed differently, and one silently no-opped while the other succeeded — so an arm's
execution count and its posterior can drift apart on ordinary ingest whenever tenancy does not
line up. `[learning] ... returned no results in either table` is logged at WARN and nothing acts on
it. That is worth its own investigation: it is the write/read key-mismatch class, inside a single
request path.

---

## 13. Both remaining blockers traced to a root cause and fixed

### 13.1 The prune was phase-locked, not batch-limited

The retention sweep and the FTS scorer rebuild are **both `setInterval(30 min)` armed at the same
process boot** — so they fire together every period, forever. That is why two unrelated subsystems
failed at the identical millisecond: both statements were issued together and both hit the same
300s timeout. The valve selected 25 ids, issued its DELETE into a table held by
`REBUILD INDEX`, and committed nothing, every cycle, while ingest outpaced it.

This also answers the question the long measurement note in `trace-retention.ts` leaves open —
*"re-test batch=1 on a QUIET table before drawing a conclusion"*. The table is **never** quiet when
the sweep runs, by construction. Nothing about DELETE regressed; the contention did.

Fixed in `d253457`: defer while `isFtsRebuildInProgress()` (an existing exported predicate the HTTP
endpoint already uses), and re-arm a bounded retry on that specific reason. **The pair is the fix.**
A guard alone would be worse than the bug — the collision is structural, so every cycle would skip
and the logs would read like success. The retry walks the sweep into a rebuild-free window;
rebuild occupies ~350s of every 1800s, so ~80% of the period is available. After 6 attempts it
gives up loudly and names what that means.

### 13.2 The false reach came from a resolver inventing its subject

`resolveVesselHealthReport` defaulted `vessel_id` to the literal `"analysis-vessel-local"` whenever
the caller failed to bind it, **and reported nothing about having done so**:

```ts
const vesselId = (typeof pointer.vessel_id === "string" && pointer.vessel_id.length > 0)
  ? pointer.vessel_id
  : "analysis-vessel-local";
```

That is the whole of rung 2's false reach. The walk decomposed correctly and simply never bound the
argument; the resolver returned a well-formed healthy report about a vessel nobody asked for; the
note persisted; and the judge, reading a valid report, asserted it covered both named vessels.

**No gate could have caught it.** Once the report is built, a defaulted subject is
indistinguishable from a requested one — every component did its job on the wrong subject. A wrong
answer that looks right is strictly worse than no answer, because only one of the two is detectable.

Fixed in `1170047`: return `resolved: false` with the reason when `vessel_id` is absent, empty,
whitespace, or non-string, so an unbound argument surfaces as an unresolved impulse and the walk
retries or fails honestly — the discipline `bodyHonestyPolicy` already follows by serving nothing
rather than an empty policy.

**The finding inside the finding.** The existing test asserted the defect:

```ts
it("defaults vessel_id to analysis-vessel-local when not provided", ...)
expect(body["vessel_id"]).toBe("analysis-vessel-local");
```

The silent default was pinned by its own coverage, so removing it would have read as a regression.
**A test that pins a silent default pins the confabulation with it.** That is worth generalising:
the detector for this class is not "is it tested" but "does any test assert that an unbound
argument is *refused* rather than filled in".

### 13.3 Autonomy observed in passing

Five substrate-authored commits landed on `development-vessel` with no operator hands during this
session (`3e76227`, `6147a37`, `e8a7b24`, `5f48765`, `72bdf78` — mitosis-cutover applications of
its own gap-closing goals). They forced a divergence triage on push; they touched
`feature-compose.ts` and `vacuous-edit.ts`, disjoint from this work, and rebased cleanly.

---

## 14. RETRACTION: the phase-lock hypothesis is refuted by its own test

**§13.1 is wrong and the fix in `d253457` does not unblock the prune.** I am recording this in place
rather than editing §13.1, because the reasoning error is the useful artifact.

I claimed the sweep failed because it collided with `REBUILD INDEX`, inferring it from two
subsystems failing at the identical millisecond. The deployed fix defers while a rebuild is in
flight. The first post-fix cycle is the discriminating test, and it failed:

```
13:41:37  valve: entering        ceiling=150000  dryRun=false  batch=25
13:41:38  valve: counted         total=447,243   willPrune=true
13:41:38  valve: first batch     requested=25  returned=25  surplus=297,243
13:45:44  sweep cycle failed     "SurrealDB query failed: The operation timed out."
```

The valve issued its DELETE at 13:41:38. The FTS job's *initial* rebuild is delayed 5 minutes from
job load (13:39:44), i.e. due at 13:44:44 — three minutes later. And grepping the whole 13:39–13:47
window for `REBUILD INDEX` or an `[FTS] … rebuild` event returns **nothing**: only
`queryActivitiesByFTS` calls, which are searches, not rebuilds.

**So the DELETE timed out with no rebuild running at all.** The collision cannot be the cause,
because on this cycle there was no collision.

What the identical timestamps actually showed was two clients of one saturated store being released
together by the same 300s timeout — a *shared symptom*, which I read as a *shared cause*. Both
observations were real; the causal direction was invented. This is the same error the session's
headline finding warned about from the other side: I found a correlation at the endpoints and
supplied a mechanism for it without testing the mechanism itself.

**What stands.** The original source comment's conclusion is unrefuted and now better supported:
the per-delete cost lives in the storage engine's delete path for this table, and it is *"a design
question (partitioning, a different retention substrate, or not storing this volume at all) rather
than anything tunable here."* Ordinary workload alone saturates the store — `queryActivitiesByFTS`
was failing with 8–10s timeouts throughout the same window, on a 3,849-row table.

**What to do with `d253457`.** Keep it, but do not count it as the prune fix. Not issuing DELETEs
into a table held by `REBUILD INDEX` is correct on its own terms and its tests pin real behaviour;
it simply is not the blocker. The blocker is unchanged and remains **the one item I could not
clear**: the trace store is 447k rows against a 150k ceiling, the valve commits zero per cycle, and
ingest outpaces it.

## 15. Ladder rung 2, re-run against the fixed resolver — PARTIAL, and honestly so

`b4f06988`, nonce `ladder2b-134cf1`, one vessel named explicitly.

**The false-reach class is fixed.** The persisted note is titled *"Health Report for
discovery-vessel"* and its body names `discovery-vessel`. The resolver can no longer substitute a
subject nobody asked for, and the note carries the dispatch nonce, so it is attributable.

**The substance is still wrong.** It reports health `unknown` with `discovery.registered: false`,
citing HTTP 404s. Ground truth, captured independently: `{"status":"ok","vessel":"discovery",
"registeredVessels":11}` — healthy and registered. The resolver's probes 404 against this spoke,
where `activity-api` is masked and the discovery record id is `discovery`, not `discovery-vessel`.

**But the failure is now visible in the artifact.** Rung 2a produced a confident, well-formed report
about the wrong vessel with nothing to indicate a problem. Rung 2b produces a report about the right
vessel that *says in its own body* that its probes returned 404 and that this is why the status is
`unknown`. The reach judge still graded it reached — it should not have, since "unknown because I
could not reach anything" is not the health status the goal asked for — but an operator reading the
note now sees the defect instead of being misled by it.

That is the honest summary of the ladder: **hidden wrongness became visible wrongness.** Valid
compositional reach is still not demonstrated.

---

## 16. Architecture violations found in code touched this session — filed, not all fixed

The goal asked for a review of code interacted with. These are the violations found, each with the
law it breaks and the evidence. Filed rather than fixed where fixing exceeds the session's blast
radius; naming them is the deliverable, rewiring them is next-session work.

| # | Site | Law | Evidence |
|---|---|---|---|
| 1 | `development-vessel/src/resolvers/vessel-health-report.ts:3-4` — `METABOB_ENDPOINT ?? "http://127.0.0.1:8080"`, `DISCOVERY_ENDPOINT ?? "http://127.0.0.1:8100"` | **1** (env-frozen behaviour) + **11** (data locality) | Hardcoded host ports, resolved at process start, invisible to traces. On any spoke `:8080` is `activity-api`, which is **masked** — so every trace/goal probe 404s and the report degrades to `unknown`. Measured live: `discovery-vessel → probe skipped, registered false`. Should route by shape through discovery. |
| 2 | `activity-api/src/services/trace-retention.ts` — **19** `env.*` reads in one config loader | **1** | Enablement, dry-run, caps, batch size, ceilings and budgets are all bootstrap-frozen. A retention policy is behaviour the system should be able to observe and learn; none of it is visible to a trace or the walk. |
| 3 | `activity-api/src/index.ts:632` — `FTS_REBUILD_INTERVAL_MS`, and `trace-retention` `intervalMs` | **5** (cadence is a rhythm impulse, not a static interval) | Two `setInterval`s armed at boot. Law 5 says cadence lives in the pool as time-shaped rhythm impulses the selector reads. Note: my phase-lock hypothesis built on these was **refuted** (§14) — the violation is real, the failure it was blamed for is not. |
| 4 | `activity-api/src/routes/db-admin.ts` | script-retention / dead surface | Imported by nothing, mounted nowhere in `index.ts`, and contains no route declarations matching the app's patterns. A surface nothing invokes cannot be observed failing, so it can never be trusted when it passes. |
| 5 | The `concept` shape — 3 producers, 2 incompatible meanings | **shape vocabulary** ("a shape is a routing-and-reasoning key") | `development-vessel` serves trace pattern-mining (`multi_step_resolver_flow`); `concept-db` serves prose recall. Because both answer one key, `goal-host:1040` must discriminate by **vessel name** (`/concept-db/i`) — routing by name, forced by the overload. Fix the vocabulary, not the picker. |
| 6 | `variant_performance_metrics.success_rate` written int/int on two `TYPE int` columns | data integrity | Truncates to exactly 0 or 1; per the in-source note, 438 of 1,059 mixed-outcome rows carry a mathematically impossible value. It is read back and amplified by `composition-graph.ts`. **Never read it as a success signal — use α/β.** |
| 7 | `activity-api/src/services/variant-creator.ts` — `checkAndRetireTemplate` still present | dead-but-live code | Superseded by `checkAndRetireByPosterior` and provably incapable of completing its own body (§2). Left in place with its four defects documented rather than deleted, because its one call site is a route an external caller may still use. Should be removed once that is confirmed. |
| 8 | Split write inside one ingest handler | write/read key mismatch | One trace moved `total_executions` 202→203 while α/β did not move; `[learning] Thompson Sampling score update returned no results in either table` is logged at WARN and nothing consumes it. An arm's execution count and its posterior can silently diverge. |

**Fixed this session:** the silent-default subject (§13.2), the counterfeit Beta draw (§1), retirement's
four-way inertness (§2), and two shapes with readers and no producers (§3).

---

## 17. Ladder rung 2, third run — A VALID COMPOSITIONAL REACH

`2784ab60`, nonce `ladder2c-c34927`. Same two-shape goal shape as rung 2a, with a subject whose
registry id actually binds.

**First, the correction that made it possible.** I had blamed rung 2b's `unknown` on the resolver.
Probing the predicate instead of inferring from it:

```
discovery-vessel          health= unknown  registered= False  probe= skipped
discovery-vessel-local    health= unknown  registered= False  probe= skipped
goal-host-vessel          health= healthy  registered= True   probe= HTTP 200
development-vessel-local  health= healthy  registered= True   probe= HTTP 200
```

**The resolver is correct.** Neither `discovery-vessel` nor `discovery-vessel-local` is a registered
id, so rung 2b's `unknown` was an *honest* report about a subject that does not exist. My "the
resolver's probes 404 on this spoke" reading was wrong in attribution — the 404s are what a correct
resolver returns for an unknown id.

**Rung 2c, hand-graded against ground truth captured before dispatch:**

| check | result |
|---|---|
| subject | note titled *"Health Report for goal-host-vessel"* — the vessel named in the goal |
| substance | body: *"The vessel `goal-host-vessel` is `healthy`"*; live `/health` → `status=healthy` ✓ |
| durable | persisted in the memoryNote store and read back out of it |
| attributable | carries the dispatch nonce `ladder2c-c34927` |
| compositional | two shapes inferred at confidence 0.9, split intermediate → terminal, both produced and chained |
| verdict | `reached: true`, and I agree |

This is the ladder's first clean rung: right subject, right substance, durable, attributable, and
genuinely composed rather than answered by one satisfier.

**Two blemishes worth naming rather than glossing.**

1. The note body opens with the literal `memoryNote_write:` — a shape name leaking into human prose.
   Cosmetic, but it is the write-shape surfacing in content a person reads.
2. `WITHHELD alpha-credit for satisfier:memoryNote_write — no in-chain producer-to-consumer edge`
   fired again, on a run that genuinely composed. So the composition **earned no credit**: the walk
   produced both shapes and chained them, but did not record the producer→consumer edge that would
   let the pathway compound. The credit gate is right to withhold on the evidence it has; the
   defect is that a real composition is not producing that evidence. That is the next thing to
   chase, and it is precisely the mechanism §"the ceiling" depends on — pathway reuse cannot
   compound if valid compositions never bank an edge.

---

## 18. Ladder rung 3 — a valid FOUR-shape compositional reach, and it earned credit

`fd96b11d`, nonce `ladder3-aeb301`. Two independent facts from two different subsystems, joined
into one durable artifact.

The decomposition was the deepest of the session and the walk derived the extra shape itself:

```
inferred_target_shapes ["vessel_health_report","discovery_vessel_registry_observer","memoryNote_write"]
countable goal — APPENDED shellResult to inferred targets so the measurement is composable
intermediates [vessel_health_report, discovery_vessel_registry_observer, shellResult]
terminal     [memoryNote_write]
```

Hand-graded against ground truth captured **before** dispatch:

| check | result |
|---|---|
| fact 1 | *"Health status of goal-host-vessel: healthy"* — live `/health` → `healthy` ✓ |
| fact 2 | *"Registered vessels in discovery registry: 11"* — live `/registry/stats` → `11` ✓ |
| durable | persisted and read back by nonce id |
| attributable | `ladder3-aeb301` |
| compositional | 4 shapes, intermediate/terminal split, one derived by the walk unprompted |
| verdict | `reached: true` — *"deterministic:verified-registry-count — independently queried … totalVessels=11; the produced output matches the authoritative registry"* |
| credit | **alpha-credited**, not withheld: *"substance-honest reach"* |

Both facts correct, from separate producers, in one artifact. The reach reason is a genuine
independent verification rather than prose, and unlike rung 2c the walk banked credit for it —
so this pathway can compound.

**Blemish:** the stored note body is the raw envelope
(`{"shape":"memoryNote_write","body":"…","nonce":"…"}`) rather than clean prose. The same
write-shape leak as rung 2c's `memoryNote_write:` prefix, one layer worse. The content is correct;
its packaging is machine-facing in a human-facing store.

### The ladder, honestly graded

| rung | shapes | verdict | my grade |
|---|---|---|---|
| 1 | 1 | reached | **PARTIAL** — asked for two numbers, returned one; judge graded the half it checked |
| 2a | 2 | reached | **FALSE REACH** — right structure, invented subject, judge asserted content it never read |
| 2b | 2 | reached | **HONEST-BUT-WRONG** — right subject binding restored; subject was an unregistered id, so `unknown` was the correct answer to a bad question |
| 2c | 2 | reached | **VALID** — right subject, right substance, durable, attributable |
| 3 | 4 | reached | **VALID** — two independent facts, both correct, credited |

**Increasingly compositional reach is demonstrated at rungs 2c and 3.** What is *not* demonstrated
is that it happens reliably regardless of phrasing: rung 2a and 2b were the same goal shape and
failed for reasons that had nothing to do with composition — a resolver that invented its subject,
and a subject id that did not exist. Both are now fixed or understood, but the sample is two clean
runs, not a rate.

---

## 19. The shaped policies are erased by something that rewrites their directory

Late in the session all three policy shapes began resolving `false` again:

```
walkBudget             {"resolved":false,"error":"no walk budget configured — consumer keeps its literal fallback"}
lessonExecutionPolicy  {"resolved":false,"error":"verbatim lesson execution not enabled — consumer stays fail-closed"}
bodyHonestyPolicy      {"resolved":false,"error":"no body-honesty policy configured — consumer keeps its literal fallback"}
```

and the walk was logging `bodyHonestyPolicy resolved to no usable body — FALLING BACK to the literal
denial-field list` on every step. The directory:

```
/workspace/git/super-repo/policies/     (dir mtime 13:57)
  llm-model-policy.json                 1,274 bytes   13:57   ← was 11,022 bytes at 12:58
  (body-honesty-policy.json  — GONE, was 569 bytes, dated Aug 10)
  (walk-budget.json          — GONE, seeded by me ~13:05)
  (lesson-execution-policy.json — GONE, seeded by me ~13:05)
```

**The producers are fine.** They report "not configured" honestly, and the consumers fall back
exactly as designed — `lessonExecutionPolicy` fails closed, so verbatim execution is OFF again with
no exposure. The storage is the problem.

`WORKSPACE_ROOT=/workspace/git/super-repo` (read from `/proc/<pid>/environ`) **is a git work tree**,
and `policies/` is **gitignored** (`.gitignore:239:/policies/`). So every shaped policy this system
has lives as an ignored file inside a clone the convergence loop treats as disposable, and
`llm-model-policy.json` shrinking 11,022 → 1,274 bytes shows something actively *rewrites* the
directory rather than merely deleting from it.

**I did not identify the mechanism and will not guess it.** `reset --hard` (the only reset in
pull-sync) does not remove ignored files, so it is not sufficient on its own; something else writes
here. That is the next thing to find.

**Why this matters more than the three files.** CLAUDE.md says runtime state *"belongs in the
container volume and is gitignored: a file the substrate rewrites is not a file git should carry."*
These files **are** gitignored — and being gitignored inside a clone that gets cleaned is precisely
what destroys them. The rule was followed and the outcome is the opposite of the rule's intent.

It also means the law-1 remediation has never actually taken effect in this deployment, for a third
reason. First the shapes had no producer (§3, my miss). Then the producers existed and resolved
(verified: `walkBudget SHAPED iters=6 calls=12` at 13:14:01, the seeded values steering the live
walk). Now the storage under them is periodically erased. **Reader, producer, and storage each
have to survive; two out of three still yields a frozen literal**, and `bodyHonestyPolicy` has
evidently been in this state since well before today — its fallback was logging all session and
nobody read it.

The fix is to put policy files on the volume *outside* any git work tree and point `WORKSPACE_ROOT`
— or a dedicated `POLICY_ROOT` — at that path. That is a deployment change, not a code change, and
it is the fourth item on the carried-forward list.

---

## 20. Closing state, per the goal's five clauses

### Fixes made — with live-verification status, not just "landed"

| fix | commit | status |
|---|---|---|
| Counterfeit Beta draw → real Marsaglia-Tsang sample | `d69a4ad` | **LIVE, verified** — mirrored 12:47:44, unit restarted same second |
| Retirement on posterior evidence, from the real ingest route | `e2d7077`+`1d83bf5` | **DEPLOYED, UNPROVEN LIVE** — code in the running tree; acceptance test inconclusive (§12) |
| `walkBudget` + `lessonExecutionPolicy` producers | `f87f52f` | **BUILT AND CORRECT; storage erased under them** (§19) |
| Health-report refuses an assumed subject | `1170047` | **LIVE, verified by rung 2c** (§17) |
| Retention defers while `REBUILD INDEX` holds the store | `d253457` | **LIVE — but NOT the prune fix; hypothesis retracted** (§14) |
| Durable tombstone for the reached-command library | `f9057a1` | **PUSHED, DEPLOY PENDING** — not yet mirrored at time of writing |

Two notes so nobody over-reads these. **Retirement will not clear the existing backlog by design**:
the sampler fix stops blamed arms being selected, so they stop earning fresh failures, so trickle
retirement rarely touches them — they are neutralised by the draw instead. Zero retired rows next
week is the expected outcome, not evidence of failure. And **the tombstone is event-driven, not
retroactive**: rung 2a's poisoned entry evicts only when that goal re-runs and grades false. The
JSONL will not shrink on its own.

**The sampler's live consequence, measured.** `learned-satisfier-memorynote-write` — the arm the
ladder's terminal step runs on — sits at α=2.73, β=43.40, **posterior mean 0.0592** over 181
executions. Under the shipped expression an arm at that posterior cleared `producer-pick`'s `> 0.5`
reuse gate roughly 85% of the time; under a real Beta it clears ~0%. That is the fix's effect on
live selection. I did **not** capture that arm's α before rung 3, so I cannot attribute today's
credit increment to it specifically, and I am not claiming to.

### Code reviewed for architecture violations
Eight filed with evidence (§16), four fixed. Plus §19: the shaped-policy storage sits inside a git
work tree, which is a violation the checklist does not currently name.

### Prune — attempted through the sanctioned mechanism, still blocked
Never a policy question: `TRACE_RETENTION_ENABLED=true`, `DRY_RUN=false` all along. 447k rows
against a 150k ceiling, zero deleted per cycle. My phase-lock explanation was **refuted by its own
first test** (§14). The original source comment's conclusion stands: a storage-engine design
question — partitioning, a different retention substrate, or not storing this volume — not
something tunable from here. **This is the one blocker I could not clear.**

### Ladder — demonstrated at rungs 2c and 3
Graded table in §18. Right subject, right substance, durable, attributable, genuinely composed; the
four-shape run derived a shape unprompted and earned credit. **Two clean runs is not a rate**, and
the two failures before them (§17, §13.2) failed for reasons unrelated to composition.

### Carried forward — each needs a decision no session can make
1. **PAT rotation** — a credential only a human can mint.
2. **`POLICY_ROOT` outside the git work tree** (§19). **Do not re-seed the policy files until this
   moves** — they will be erased again, and every "verified live" claim about shaped policy on this
   deployment has a TTL of one convergence cycle. My `walkBudget SHAPED iters=6 calls=12` proof at
   13:14:01 was real and is already gone.
3. **Trace-store design change** — the prune blocker above.
4. **Retirement acceptance test** with a trace carrying the arm's real org *and* a reach verdict.
5. **`POST /v2/activities/feedback` is unreachable** with the documented API key (§10), so step 4 of
   the canonical loop has no working path from `~/.metabob/config.json`.
6. **The split ingest write** (§12) — `total_executions` moved while α/β did not, logged at WARN
   with no consumer.
7. **Edge banking.** `WITHHELD alpha-credit — no in-chain producer-to-consumer edge` fires even on
   valid compositions (rung 2c), and the composition arm for exactly that pattern,
   `learned-composition-vessel-health-report-to-memorynote-write`, sits at **α=1, β=5.0 after 8
   executions** — only ever blamed, never credited. A valid composition that banks no edge cannot
   compound, which is the mechanism pathway reuse depends on. Noticed, not diagnosed.

---

## 21. The one prune experiment left is operator-gated

`trace-retention.ts` ends its measurement note with an explicit open action:

> *"Re-test batch=1 on a QUIET table before drawing a conclusion from that sample."*

That re-test is now worth running, because §14 removed the confounder the original sample had: the
prior batch=1 measurement was taken while an index rebuild ran concurrently, and I have since shown
the current failure happens with **no rebuild running at all**. The table is quiet in the sense the
note meant. The comparison is also sharper than when the note was written — batch 25 now deletes
**zero** per cycle, which is worse than the 3.52 s/row that same note records as its best measured
state, so something changed and batch=1 is the cheapest probe of it.

`TRACE_RETENTION_DELETE_BATCH` is a documented env override (*"Kept as an env override so a
deployment on a healthier table … can raise it without a code change"*) but is **absent from
`gen-env.sh`**, so the unit runs the code default of 25 and the value cannot be changed without
either an image change or a systemd drop-in on the live hub.

**I attempted the drop-in and it was refused by the permission layer.** Writing unit files on the
production hub is a reasonable thing to gate, and I did not work around it. The experiment is
therefore **operator-gated, not abandoned**:

```
# on the hub, inside substrate-live:
mkdir -p /etc/systemd/system/activity-api.service.d
printf '[Service]\nEnvironment=TRACE_RETENTION_DELETE_BATCH=1\n' \
  > /etc/systemd/system/activity-api.service.d/zz-batch1-experiment.conf
systemctl daemon-reload && systemctl restart activity-api
# observe ONE sweep in `journalctl -u activity-api | grep trace-retention`, then revert:
rm /etc/systemd/system/activity-api.service.d/zz-batch1-experiment.conf
systemctl daemon-reload && systemctl restart activity-api
```

Read one sweep and stop: if the valve reports a non-zero delete count, batch size was the lever
after all and belongs in `gen-env.sh`; if it still times out, the storage-engine design question is
confirmed by elimination and no further tuning is worth attempting. Either outcome closes the
question — which is why it is worth one operator action rather than more analysis from here.

---

## 22. Why a valid composition banks no edge — diagnosed, deliberately not patched

§20 item 7 left this as "noticed, not diagnosed". It is now diagnosed, statically, and the finding
is that **the credit gate is right and the ledger feeding it is blind to one step type.**

The gate (`index.ts:9384`) credits on either a deterministic verdict **or** a genuine in-chain
producer→consumer edge. It is backed by the strongest measurement in this codebase: over 80 goals
in four families with no deterministic verifier, **72/80 graded reached and only 23/80 were
correct — 68% hollow** — and `ext_variety`, which no oracle owns, was 20/20 reached and 0/20
correct. Every one of those false reaches had run a command. Dropping "a command ran" as substance
is why the posterior records correctness rather than activity. **This gate must not be loosened.**

The ledger it consults:

```ts
const ledgerStep = (inputShapes: string[] | undefined, newOutputs: string[]): void => {
  for (const s of (inputShapes ?? [])) if (chainProduced.has(s)) consumedInChain.add(s);
  for (const s of newOutputs) if (s && s !== "activityExecutionSummary") chainProduced.add(s);
};
```

An edge is recorded only when a later step's **declared `inputShapes`** matches an earlier step's
output. Of the five call sites, **three pass `undefined`**:

```
:8247  ledgerStep(undefined, [satisfiableNow])   ← the satisfier path
:8823  ledgerStep(undefined, [missingShape])
:8553  ledgerStep(undefined, bundleNew)
:8552  ledgerStep(bc.inputShapes, [])            ← declared-input path
:8928  ledgerStep(pick.inputShapes, _stepNew)    ← declared-input path
```

So a satisfier step can only ever **add to `chainProduced`, never to `consumedInChain`**. Satisfiers
are selected by target shape and carry no declared inputs, so **a walk composed entirely of
satisfiers records zero edges by construction**, however genuinely the data flowed. Rung 2c was
exactly that: `vessel_health_report` produced by a vessel-resolve satisfier, then `memoryNote_write`
by another, correct content in the note, and `consumedInChain.size === 0`.

Rung 3 credited only because it had the *other* arm — a deterministic registry verdict. Take that
away and a valid four-shape composition would also have banked nothing.

**Why I am not patching it.** The obvious change — infer the edge from what a satisfier actually
consumed from the pool rather than from a declaration — widens what counts as substance, and the
68%-hollow measurement above is precisely a record of what happens when substance is widened on
plausible reasoning. Doing it safely needs the satisfier's real consumed-impulse ids, which means
reading a live walk's step records; the dispatch store is in-memory and rung 2c's record had already
aged out (`404`) when I went back for it, so I could not verify the shape of the fix against real
data. **A credit gate this well-evidenced should not be widened from a partial picture.**

The corroborating number, from the live posterior table: the composition arm for exactly this
pattern, `learned-composition-vessel-health-report-to-memorynote-write`, sits at **α=1, β=5.0 after
8 executions** — only ever blamed, never credited. That is this defect's signature, and it is why
the pattern cannot compound: every run of it either fails, or succeeds and banks nothing.

**The next step is a measurement, not an edit**: capture one satisfier-only walk's step records
live (before the dispatch ages out), confirm the consumed impulse ids are present and correct, and
only then decide whether the ledger can read them without re-admitting the hollow class.
