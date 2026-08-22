# Seam closure — what was closed, what was reversed, what remains

Companion to `SELECTION_SEAM_ROOT_CAUSE_2026-08-22.md` and
`LEARNING_DB_ARCHITECTURE_AUDIT_2026-08-22.md`. This is the action record: what
changed, what it measured before and after, and where a fix was withdrawn.

Every claim here is a measurement against the live local `substrate-live`
container. Where a change is committed but not yet deployed, it says so.

---

## 1. The autonomy blocker — CLOSED, verified in production

**The defect.** `fs_edit`/`fs_write` called `resolve(path)`, which resolves a
*relative* path against `process.cwd()`. No fs resolver runs with cwd equal to
`WORKSPACE_ROOT` — development-vessel runs at `/vessels/development-vessel` while
the root is `/workspace/git/super-repo`. Every relative path therefore resolved
somewhere the caller never named and was rejected.

**Why it mattered.** `repos/<vessel>/src/…` is the exact form CLAUDE.md tells
callers to use and the form `feature_compose` emits. Observed live as `fs_edit:
HTTP 500 path outside workspace root: repos/identity-vessel/src/index.ts` against
a file that exists, across four distinct vessel-source paths in six hours.

**Scope of the claim, corrected.** An earlier draft said this made the autonomy
criterion "structurally unreachable". **It did not**, and the measurement says so:
`git log --author='Substrate Autonomous'` shows **10 substrate-authored commits in
the preceding 7 days** (08-15, 08-18 ×6, 08-20, 08-22). Autonomy was never at
zero. What was blocked is the `fs_edit` route specifically — the walk's
edit-intent path through goal-host. The commits that were landing came via
`apply_proposal_as_patch + vessel_mitosis_cutover`, a different resolver that
never touched this guard. The 09:18 substrate-authored commit observed during this
session is consistent with the pre-existing rate and is **not** evidence that this
fix enabled it.

**The fix** (`development-vessel@89a7bf3`). Resolve a relative path against each
candidate root, and *return* the resolved absolute path so callers stop operating
on the raw string. The second half is load-bearing: `Bun.file(pointer.path)` would
have read from cwd even once the guard passed, trading a 500 for a silent
wrong-file read. `fs-write`'s allowlist check had the same defect independently.

**Verified after deploy:**

| probe | before | after |
|---|---|---|
| `repos/activity-api/src/routes/activities.ts` | `path outside workspace root` | `oldString not found` ✅ |
| `../../../etc/passwd` | rejected | **still rejected** ✅ |
| `/etc/passwd` | rejected | **still rejected** ✅ |
| `/workspace/git/super-repo-evil/x.ts` | rejected | **still rejected** ✅ |

The error moved from a guard rejection to a content error — the file resolved and
was read at the correct absolute location, no write occurred, and the sandbox was
not widened.

**Verified by conviction, not by green tests.** Reinjecting the original
`resolve(path)` fails 6 of the 15 new tests — exactly the relative-path cases.
Two baseline suite runs scored 81 and 94 failures against this change's 82 and 88,
so the suite is flaky in that band and the change sits below the worst baseline.

---

## 2. The posterior lookup — the real root cause, one line

**Every Thompson selection this substrate has made was drawn from `Beta(1,1)` plus
heuristic boosts.** Not because the credit path is broken — it works and holds
credit-weighted posteriors up to α=493.83/β=897.23 — but because the selector
could not read one.

`getCanonicalPosteriors` reads the correct table and binds the wrong value: it
**strips** the `organizations:` prefix while the rows carry it.

```
org_id in variant_performance_metrics:
  organizations:substrate  3275     public            17
  organizations:metabob      76     metabob_internal   1
                                    unknown            1

WHERE account_id IS NONE AND org_id = 'substrate'                →      0
WHERE account_id IS NONE AND org_id = 'organizations:substrate'  →  3,275
```

It returned an empty map on every call, and its own doc comment states the
consequence: *"an empty map means every caller falls back to the uninformative
prior."* That is exactly the measured draw — α=4.0/β=1.0 for an arm whose stored
posterior is α=23.76/β=10.86 — and why **β was pinned at 1.0 everywhere**: no
failure evidence could reach the draw.

**Why it inverted.** The strip was a back-compat shim with a TODO: *"after
migrating existing data to record format, use orgId directly."* The migration
happened. The shim outlived the incompatibility and now matched the **19-row
minority** while orphaning the **3,351-row majority**.

**The fix** (`activity-api@baca870`) matches *both* forms rather than swapping one
for the other — dropping the bare form would orphan the rows the shim was written
for. Both call sites. **1,624 arms carrying moved posteriors become visible to
selection.** Zero test regressions (96 unique failing names before and after).

**Deployment status, stated exactly.** The fix is live (`activity-api` converged
to `3fb33b6` at 09:32:44, verified in the pull-sync log). What is verified is the
*query*: run directly against the live database, the widened clause returns 3,275
rows where the narrow one returns 0, and 1,624 of the newly-matchable rows carry
`thompson_alpha > 1`. What is **not yet verified is the end-to-end draw** — the
sampler writes `thompson_selection_log` only when `/recommend` is called, and the
newest entry is 09:30:14, before the deploy. Selections arrive in bursts on goal
traffic, and none has landed since. Until one does, the last β=1.0 draw on record
predates the fix and must not be read as evidence either way.

The test went through two rewrites, both forced by measurement rather than taste.
It first drove `getActivityScores` through a `mock.module` of `../db/surreal`;
that passed in isolation *both locally and inside the container* and failed only
in a full-suite run, because `mock.module` is global and order-dependent — once an
earlier file imports the real module, the cached binding wins. pull-sync refused
to converge on it twice, blocking the fix the test existed to protect. It now
asserts on source, deterministic under any ordering and the pattern this repo
already uses (`execution-traces.sql-targets.test.ts`).

**The autonomous half-revert.** Substrate-authored commit `3e58e73` consolidated
this function, kept the widened clause at the first site, and narrowed the second
back to a single form — **while leaving `params.org_id_prefix` bound there**. An
unused parameter, which no placeholder/binding check catches, because the mismatch
runs the harmless direction: I had verified placeholders ⊆ bindings and it passed.
The check that was needed is whether every intended widening survived. The test now
anchors on `$org_id_prefix` — unique to these two sites — and asserts the **count
is 2**, proven by conviction on each site independently.

---

## 3. The `success` predicate — two fixes, one reversal, one escalation

This one went wrong twice before it went right, and both reversals are recorded
because the pattern matters more than the outcome.

**Round 1 — assumed corruption (196/197).** `activity_id='X' AND success=true`
returned **0 in 2ms** while the same rows returned **5,619 in 750ms** by scan.
Diagnosed as index corruption; both composites rebuilt with `CONCURRENTLY`.

**Round 1 refuted (198).** After the rebuild applied, freshly-built indexes still
returned 0. *You cannot rebuild your way out of a fault the rebuild reproduces.*
Removed them, exactly as 196 had pre-committed: **a missing index degrades to a
correct scan, a corrupt one silently lies.**

**Round 2 — the removal exposed something worse (199).** With only the
single-field `idx_execution_success` left to serve the boolean, the planner uses
it and **discards the conjoined filter**:

| query | result |
|---|---|
| global `success = true` | 8,167 |
| `ribosome-extract` total rows | **123** |
| `ribosome-extract AND success = true` | **8,167** ← the global count |
| `ribosome-extract AND success` | 122 ✅ |
| `validator-dispatch` total rows | 5,547 |
| `validator-dispatch AND success = true` | **8,442** ← exceeds its own total |

A filtered count larger than the unfiltered count for the same activity is proof
on its own.

**This was more dangerous than the defect it replaced.** Before, ~49 call sites
got `0` — wrong but inert, since a sweep that selects nothing deletes nothing. A
global row set is wrong *and plausible*, and `trace-retention.ts` filters strata
with exactly this predicate. A per-stratum delete driven by a global selection
deletes across every stratum.

**It was not firing, by luck rather than design** — the journal at 09:13:40 shows
`over global ceiling — skipping stratum auto-discovery this cycle so the indexed
valve is reached (total 150086, ceiling 150000)`. Above the ceiling the sweep
takes the global time-ordered valve. Below it, stratum deletes engage on a
predicate that cannot tell which stratum it is in. Migration 199 removes the last
boolean index before that happens, and carries the rule: **no index over
`success` is to be reinstated** — every configuration tried has been fast and
wrong, in two different directions.

---

## 4. A stale test that blocked the pipeline

`execution-traces.sql-targets` pinned `CREATE activity_composition_graph SET`
after the writer was deliberately changed to a keyed `UPSERT`. The table it
guards never changed, so it failed on the *verb* while its actual invariant held —
and `substrate-pull-sync` refused to converge activity-api on that single
failure, blocking every migration behind it. Now pins the real form and
additionally asserts the upsert stays *keyed*, so a regression to a bare table
write that reintroduces duplicate edges still fails. Verified by conviction:
redirecting the writer fails it, restoring passes 3/3, `execution-traces.ts` left
byte-identical.

---

## 5. What the autonomy path did, once it worked

Two dispatches of the same fix, differing only in the quality of the information
given:

| dispatch | information supplied | result |
|---|---|---|
| first | approximate line numbers, prose description | drafter **confabulated** an anchor occurring **0 times** |
| second | verbatim anchors proven unique in the file | **exactly the right plan** — both real sites, widened `$org_id_prefix` clauses drafted correctly |

That is law 8 in a controlled comparison: the first failure was information
starvation, not model weakness. The fix for a wrong output was not a bigger
prompt — it was making the load-bearing fact available at the moment of use.

The second dispatch was then blocked by a gate worth keeping:

> `TARGET HAS NO TEST FILE: repos/activity-api/src/db/paradigm.ts — every gate
> below this point READS the diff; only a test RUNS it. A FAVORABLE verdict here
> means the change was reviewed, never executed.`

That gate is correct. The test file now exists, so it is satisfied for future
changes to that file.

---

## 6. Diagnosed, not yet fixed

**The selection→outcome join** is built at five of seven stages and unattached at
both producing ends. Selection writes `correlation_id`; `execution` declares the
column; `paradigm.ts:374` projects it; `execution-traces.ts:1126` fetches *by* it;
`v_selection_outcomes` consumes it. But `StoreExecutionTraceRequestSchema` has no
`correlation_id` and no `.passthrough()`, so Zod strips it at ingest, and the
field occurs **zero times** in goal-host-vessel's and ias-executor-ts's entire
source. Zero of 8,650 non-auth executions carry it. Fixing either side alone
changes nothing — that mutual invisibility is why a nearly-complete join has
produced nothing. Three coordinated changes across three repos.

**The conditional tiers** miss through joint sparsity rather than impossibility:
2 of 15 live selection signatures do exist in the credit store, with rows well
past the observation floor. Tier 2's cluster rows are fresh and weighty
(n up to 195) but live selection signatures carry **no cluster assignment**, and
57% of assignments are `contaminated`. Tier 3 — now fixed — is the fallback meant
to absorb exactly this.

**`v_activity_score` really is missing** and cannot self-restore (defined with
`IF NOT EXISTS` in a schema file that `init_migrations` records as applied, so
`init-database.ts` skips it forever — the class migration 174 fixed for seven
other views). Its only consumer is `GET /v2/activities/corpus-summary`, which
reports zeros for the whole corpus. Real, separate, **not** on the selection path.

---

## Method notes

**Four phantom-column reads, all caught by reading one full row first.** `reached`
on `goal_execution_paths`; `template_id` and `created_at` on
`thompson_selection_log`; `signature_hash` on `signature_cluster_assignment`. Each
returned a clean, confident, meaningless answer — SurrealDB returns `NULL` for an
absent column, so a typo and a genuine absence are indistinguishable. One nearly
shipped as a headline claiming selection had stopped a month ago.

**A grep hit is not a call path.** The audit's published tier-3 mechanism —
"selection reads a view that does not exist" — was wrong. `FROM v_activity_score`
exists, but in a reporting endpoint. I traced a grep hit to a conclusion without
confirming what actually populated `scoresMap`. Every *measured* fact survived;
only the mechanism connecting them was invented, and it was invented in the one
place left unprobed.

**Both index reversals came from the instrument, not from insight.** 196 said in
advance what to do if the rebuild failed, and it failed, and that instruction was
followed. A fix that specifies its own falsification is worth more than a fix that
is merely correct.


---

## Re-evaluation — measured after deploy

### The `success` predicate: CLOSED and verified

Migration 199's own four-query check, run after it applied:

| | total | `AND success=true` | `AND success` |
|---|---|---|---|
| `ribosome-extract` | 123 | **122** | **122** ✅ |
| `validator-dispatch` | 3,102 | **3,102** | **3,102** ✅ |

All forms agree and every filtered count is bounded by its total — the first time
that has been true on this table.

### The retention sweep started working, and the ring is draining

The predicate the per-stratum sweep filters on was returning zero rows, so it
deleted nothing. With it fixed:

| measure | before | after |
|---|---|---|
| `execution` rows | 150,002 (at cap) | **69,564** |
| `auth_resolve_v1` rows | 142,951 | **65,958** |

Roughly **80,000 rows drained**. Auth share is still ~95%, so the storm's
composition is unchanged — what changed is that the valve now moves.

*Side observation, not chased:* `trace_store_counters.row_count` reads 146,845
against an actual 69,564. The counter lags the table by a wide margin and is its
own defect.

### The posterior fix: verified at the query, NOT at the draw

Stated exactly, because the distinction is the whole point of this report.

**Verified.** The fix is live (`3fb33b6`, converged 09:32:44 — and migration 199
appearing in `init_migrations` independently proves activity-api restarted on that
content, since migrations apply at `ExecStartPre`). That converge also passed the
test gate, which confirms the source-based test survives the container's
full-suite run — the thing two earlier versions failed. Against the live database
the widened clause returns **3,275** rows where the narrow one returns **0**, and
**1,624** of the newly-matchable rows carry `thompson_alpha > 1`. Both entry
points are covered: `getCanonicalPosteriors` is called from the shape-conditioned
path (`paradigm.ts:652`) as well as `:2190`, so the fix is not confined to one
branch.

**Not verified: any behavioural change at the draw.** The first post-deploy burst
(09:37:37, 3 selections) logged β=1.0 on all three. That is *inconclusive rather
than negative*: all three arms have `variant_performance_metrics` rows at
α=1.0/β=1.0 with `total_executions` 0–1 — genuinely untried, for which β=1.0 is
the **correct** draw. A conclusive test needs a burst containing an arm that has a
moved posterior.

**And a correction that cuts against the fix's headline.** Comparing
`Activity scores fetched` counts either side of the deploy:

```
before 09:32   count:0 path:legacy ×10    count:36 path:new ×3    count:60 path:new ×2
after  09:33   count:0 path:legacy ×8     count:36 path:new ×3    count:9  path:new ×1
```

The **`new` (paradigm) path was already returning 36–60 rows before the fix**.
Only the `legacy` path returned 0, and it still does. So the claim "every Thompson
selection was drawn from the uniform prior" is **not supported by this
instrument** — some path was already fetching scores. The query-level defect is
real and measured (0 vs 3,275 on the exact clause `getCanonicalPosteriors` emits),
but its share of live draws is undetermined, and the α=4.0/β=1.0 observations that
motivated the whole investigation are not yet explained end to end.

That is the honest state: a real defect, really fixed, whose behavioural
consequence remains unproven. It is recorded as open rather than closed.


---

# Round 2 — the decay, and why the open question closed differently than expected

## The α=4.0/β=1.0 draw is explained. It was never a read failure.

The previous round left one thing explicitly open: draws logged α=4.0/β=1.0 while the
score fetch was demonstrably returning 36–60 rows. Both facts were true. The missing
piece is **selection-time posterior decay**, applied *after* the fetch and *before* the
draw:

```
alpha_decayed = 1 + (alpha - 1) * 0.5^(age_days / halfLife)      halfLife = 3
```

Reproduced exactly against the sampler's own log:

| arm | stored | stale | decays to | + boost 3.0 | logged |
|---|---|---|---|---|---|
| `detect-vessel-code-drift` | 23.76 / 10.86 | 33.9d | 1.009 / 1.004 | **4.009 / 1.004** | 4.0 / 1.0 |
| `operator-mcp-isomorphism-probe` | 21.62 / 18.22 | 25.8d | 1.054 / 1.045 | **4.054 / 1.045** | 4.0 / 1.0 |

**β pinned at exactly 1.0 on every observation was the tell.** The posterior was fetched
correctly, then decayed to the uniform prior before it could be sampled.

## The cost, corpus-wide

Over the 1,821 arms carrying real evidence (α+β > 4), at the in-force 3-day half-life:

| staleness | arms | evidence retained |
|---|---|---|
| <1d | 81 | ~100% |
| 3–7d | 3 | 20% → 0.4% |
| 14–30d | 409 | 3.9% → 0.098% |
| **>30d** | **1,328** | **<0.098%** |

**95.4% retain under 5%. The median arm retains 0.0002%.**

This is the mechanism behind "learning does not compound," stated precisely: the credit
path accumulates evidence correctly, and the selector forgets it faster than arms
re-execute. The corpus is bimodal — a small hot set runs constantly and never decays, a
large cold set runs on a cycle of weeks and is erased between draws.

**Origin:** the constant is documented as matching "the llm-resolver-vessel decayedCounts
fix this mirrors." LLM resolver arms fire many times an hour; 3 days barely touches them.
Activity templates fire on a cycle of weeks. **A constant calibrated for one population
was applied to a population with a completely different cadence.**

## Why the obvious fix is wrong — and how I found that out

I raised the default to 30 days. `substrate-pull-sync` **refused to converge** and named
the reason: `test/posterior-decay.test.ts` already pins that a posterior poisoned by a
transient outage — α=1, β=81, i.e. 80 failures the arm did not earn — must heal to
re-selectable within 30 days.

That requirement is real, predates me, and raising the half-life silently overrides it.
The gate was right; moving without reading it was my error, and it is the second time this
session that a guard caught something my own checks missed.

**One constant is doing two incompatible jobs:**

- **R1** wants *fast* forgetting, so unearned blame heals.
- **R2** wants *slow* forgetting, so earned credit compounds.

A symmetric exponential toward (1,1) treats an earned 23.76/10.86 and an outage-poisoned
1/81 identically, so satisfying either breaks the other. This is now proved rather than
asserted: swept across 15 half-lives from 0.5 to 1,000 days, **the set satisfying both is
empty**, with a monotonicity check (the requirements move in opposite directions) and a
positive control (each is individually satisfiable, so the empty intersection is a real
conflict rather than an impossible pair of asks).

**Rejected on evidence, recorded so it is not re-derived:** decaying β faster than α. The
asymmetry is tempting — blame is contaminated by outages, credit is earned — but it
systematically inflates every arm's mean, and *"no failure evidence reaches the draw"* is
the precise defect this whole investigation started from. It would deepen the failure it
appears to fix.

**Left at 3, deliberately.** The resolution is a design decision, and most likely belongs
upstream: blame recorded during an infrastructure outage is not the arm's fault, and decay
is a workaround for attributing it in the first place. Fixing attribution removes the need
for aggressive forgetting, which dissolves the conflict instead of trading sides.

The test file is a characterization: change the half-life and it fails, sending the next
reader to the conflict rather than letting the change land silently.

## Corrections to the previous round, from reading the code rather than inferring

**The `correlation_id` seam is smaller than I published.** I wrote that the ingest schema
strips the field and that the fix is "three coordinated changes." Both wrong:

- The trace-store route reads `body.*` **directly** and deliberately does *not* apply
  `StoreExecutionTraceRequestSchema` — there is a comment saying so, because enforcing it
  would 400 the flat posters that currently work. So the schema strips nothing here.
- The route **already passes the field through**:
  `...(body.correlation_id ? { correlation_id: body.correlation_id } : {})`, commented
  "Selection-to-execution correlation (from /recommend endpoint)".
- `/recommend` **already returns** `rec.correlation_id` per recommendation.

So six of seven stages are built and the storage side is complete. The single remaining
gap: **goal-host never reads `correlation_id` off the recommendation** (zero occurrences
in its source), so nothing downstream can send it. One producer chain, not three
coordinated schema changes.
