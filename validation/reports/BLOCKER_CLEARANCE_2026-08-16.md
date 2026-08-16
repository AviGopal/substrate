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
