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
callers to use and the form `feature_compose` emits. The substrate could not
write vessel source at all, which makes the stated autonomy criterion — a
substrate-authored commit landing with no operator hands — structurally
unreachable. Observed live as `fs_edit: HTTP 500 path outside workspace root:
repos/identity-vessel/src/index.ts` against a file that exists, across four
distinct vessel-source paths in six hours.

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

The test is written at the consuming layer deliberately: its mock filters rows by
the bound parameters the way SurrealDB would, rather than asserting on query text
— a text assertion would pass on any string containing `org_id`.

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
