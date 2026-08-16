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
