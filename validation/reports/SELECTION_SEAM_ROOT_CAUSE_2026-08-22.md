# Every Thompson selection is drawn from the uniform prior

**The finding.** Thompson sampling in this substrate has never been influenced by
what the system learned. All three posterior tiers are dead, so every draw is
`Beta(1,1)` plus hand-tuned heuristic boosts. The credit path works, writes real
graded posteriors, and no selection has ever read one.

This is the root cause behind the audit's headline
(`LEARNING_DB_ARCHITECTURE_AUDIT_2026-08-22.md`), traced from symptom to cause.

---

## The symptom

For the same arm at the same moment, three planes disagree:

| plane | `detect-vessel-code-drift` | `operator-mcp-isomorphism-probe` |
|---|---|---|
| **what the sampler drew** | α=4.0, β=1.0 | α=4.0, β=1.0 |
| `context_thompson_scores` (conditional) | α=14.81, β=4.19 | α=1.81–3.44, β=1.19–1.56 |
| `variant_performance_metrics` (global) | α=23.76, β=10.86 | α=21.62, β=18.22 |

The logged α/β are faithful — `selection_metadata.alpha` is assigned from
`alphaBlended`, the same variable passed to `betaSample()`
(`activities.ts:6700`, `:6826`). The sampler really did draw with β=1.0 for an
arm carrying 29 observations of failure evidence.

**β is pinned at 1.0 across the board.** That is the tell: β only ever moves when
a posterior is read, so failure evidence cannot reach the draw at all. Selection
is systematically optimistic by construction.

---

## The three tiers, all dead

`activities.ts:6607-6660` implements a three-tier posterior: **signature →
cluster → fallback**.

### Tier 1 — conditional lookup: structurally impossible

`context_bucket` is **one column with two subjects**, and the code says so at
`activities.ts:6144`:

- the **credit path writes** `computeStateSpaceSignature` — sha256 over
  `shapes|provenance|missing`, `.slice(0, 8)` bytes = **16 hex chars**
- the **selection path reads** `computeContextBucket` — sha256 over
  `task-semantics|org|goal_cluster`, `.slice(0, 4)` = **8 hex chars**

Different algorithm, different inputs, different width. No normalization can make
them meet. Confirmed live, 12 of 12 lookups:

```
"event":"cts_lookup","requested":98,"matched":0,"bucket":"761226ca",
  "note":"structural zero: this reader keys on computeContextBucket (8 hex)
          while the credit path writes computeStateSpaceSignature (16 hex)"
```

Stored buckets are 16 hex (`f969073b01114196`), as predicted.

### Tier 1b — v1 signature reader: right width, wrong value

The signature-keyed reader uses the correct 16-hex form and still returns
nothing, 12 of 12:

```
"event":"cts_sig_lookup","sig":"f81c27234d15a8cc","requested":98,"hits":0,"floor":5
```

The signature computed at *selection* time (from the goal's expected shapes)
rarely equals one computed at *credit* time (from an execution's realized shapes).

**Measured, and NOT the "never" an earlier draft of this claimed:** of 15 distinct
selection-time signatures taken from six hours of live logs, **2 (13%) do exist as
a `context_bucket` in the credit store**, and their rows clear the observation
floor comfortably — `satisfier:source_code` at n=107 (α=40, β=69),
`understand-source-file-demo` at n=12. So the two populations overlap; they are
not disjoint.

What produces `hits:0` is therefore **joint** sparsity: the signature must match
*and* the specific candidate must have a row under that signature. With 4,619
conditional rows spread over ~3,856 activities and many signatures, that pair is
rarely present for the ~98 candidates of any one call. This is exactly the
sparsity the cluster tier exists to absorb — which makes tier 3, the fallback, the
load-bearing repair rather than tier 1b.

### Tier 2 — cluster: alive, but never reached at selection time

`context_thompson_scores` holds **7** rows keyed `cluster:sigcl_…` out of 4,619,
and an earlier draft called the tier "unpopulated". **That was wrong** — those
rows are fresh and accumulating (written 06:34, 08:28 and 08:48 today) and carry
real weight, up to `n_observations = 195`. The clustering machinery runs:
`signature_cluster_run` 1,655 rows, `signature_cluster_assignment` 706.

The tier is skipped for a different reason. Selection gates it on
`clusterIdForSig` — the cluster assigned to the *current* signature — and the live
selection signatures have no assignment at all:

```
signature = 'f81c27234d15a8cc'  -->  NO ASSIGNMENT
signature = '5061a2ff297c5346'  -->  NO ASSIGNMENT
```

Clustering only ever sees signatures the credit path wrote, so a selection-time
signature is not merely unclustered — it was never a candidate for clustering.
A second gate compounds it: **403 of 706 assignments (57%) are
`contaminated: true`**, and contamination disables the tier by design.

It is also unobservable: `clusterShadowDecisions` is accumulated in memory and
never logged. Grepping the live journal for `cluster_shadow`, `used_scope`,
`cluster_lookup` and `sigcl` returns **0** occurrences each, so none of the above
is visible to an operator reading logs.

*(Note the column trap: the assignment key is `signature`, not `signature_hash`.
Querying the latter returns `None` for every row and reads exactly like an empty
column.)*

### Tier 3 — fallback: an org_id form mismatch returns zero rows

> **CORRECTED.** An earlier revision of this section said tier 3 "reads a view
> that does not exist" (`v_activity_score`). **That mechanism was wrong.** I found
> a `FROM v_activity_score` by grep and concluded it fed selection without
> confirming the call path. It does not: that query is in
> `GET /v2/activities/corpus-summary` (`activities.ts:4883`), an unrelated
> reporting endpoint. The view really is absent and that endpoint really is
> broken, but it is not the selection path. The measured symptom below is
> unchanged; only the cause is.

`scoresMap` (`activities.ts:6016`) is populated by `getShapeConditionedScores()`
or `getActivityScores()`, which resolve through `getCanonicalPosteriors()` in
`paradigm.ts:529`. That function reads **the correct table**:

```sql
SELECT variant_id, thompson_alpha, thompson_beta FROM variant_performance_metrics
WHERE ((account_id = $account_id) OR (account_id IS NONE AND org_id = $org_id))
  AND variant_id IN $activity_ids
```

The defect is one line — how `$org_id` is bound (`paradigm.ts:547`, and
identically at `:710` in the legacy fallback):

```ts
org_id: orgId.startsWith('organizations:') ? orgId.replace('organizations:', '') : orgId,
```

It **strips** the prefix. The rows carry it:

| org_id stored in `variant_performance_metrics` | rows |
|---|---|
| `organizations:substrate` | **3,275** |
| `organizations:metabob` | 76 |
| `public` | 17 |
| `metabob_internal` | 1 |
| `unknown` | 1 |

So the selector binds `'substrate'` and matches nothing:

```
WHERE account_id IS NONE AND org_id = 'substrate'                 -->      0
WHERE account_id IS NONE AND org_id = 'organizations:substrate'   -->  3,275
```

`getCanonicalPosteriors` returns an **empty map on every call**, and its own
doc comment states the consequence exactly:

> *"an empty map means every caller falls back to the uninformative prior, which
> is the honest reading of 'we could not observe the evidence'."*

That is the observed draw: `alpha = 1.0`, `betaVal = 1.0`, then `alpha +=
totalBoost` at `:6602` yields **α=4.0, β=1.0**. β stays pinned at 1.0 because no
failure evidence ever reaches it.

**Why the shim exists, and why it inverted.** The comment at `:706-708` explains
itself: *"Legacy table may have existing data with plain strings / TODO: After
migrating existing data to record format, use orgId directly / For backward
compatibility, strip organizations: prefix if present."* The premise was real —
19 plain-string rows do exist. But the migration to record form happened, the
shim was never removed, and it now matches the **19-row minority** while
orphaning the **3,351-row majority**. A compatibility shim outlived the
incompatibility and became the defect.

**The fix is to match both forms**, not to swap one for the other: bind the raw
and stripped values and accept either, so the 19 legacy rows keep matching and
the 3,351 prefixed rows start.

**Method note.** This correction is the session's own recurring error, committed
by me: I traced a grep hit to a conclusion without confirming which call path
reached it. The observable facts — the view is absent, the sampler drew
α=4.0/β=1.0 against richer stored values, both conditional readers report 0 hits
— were measured and all survive. Only the mechanism connecting them was invented,
and it was invented in the one place I had not probed.

---

## Aside — `v_activity_score` really is missing, and that is a separate bug

The view is genuinely absent (`SELECT * FROM v_activity_score` returns
`status: OK` with zero rows; SurrealDB treats a missing table as an empty one).
It cannot come back on its own: `schemas/021-paradigm-computed-views-v3.surql`
defines it with `IF NOT EXISTS`, `init_migrations` records that file as applied
on 2026-06-28, and `init-database.ts` skips any recorded filename. This is the
class migration 174 fixed for seven other views; `v_activity_score` is an eighth
it missed.

Its only consumer is `GET /v2/activities/corpus-summary`
(`activities.ts:4883`), which therefore reports zeros for the whole corpus. Worth
fixing, and **not** on the selection path — recorded here so the two are not
conflated again.

## The fix, in dependency order

1. **Match both `org_id` forms in `paradigm.ts:547` and `:710`.** Single
   highest-value change, and a one-line one: it puts 3,351 rows of real, durable,
   credit-weighted evidence into every draw that currently gets the uniform
   prior. This alone unpins β. (Tier 3 already reads the right table — it just
   cannot match a row.)
2. **Make tier 1 read the subject the credit path writes** — the 16-hex
   state-space signature, not the 8-hex task-semantics bucket. The reader is
   otherwise correct and already keys the map under all three id forms.
3. **Populate and instrument tier 2.** The cluster path is the designed answer to
   tier 1b's signature sparsity and it has 7 rows and no log line. Emit
   `clusterShadowDecisions` so `used_scope` is observable before tuning anything.
4. **Rebuild the `success` composite indexes**, so retention stops being a no-op
   and `execution` stops being an auth-noise ring.

**Do not** fix these in reverse order. Until step 1 lands, every other repair is
unobservable — the draw is dominated by heuristic boosts, so nothing downstream
will move measurably.

---

## The general lesson

**A missing table and an empty table are indistinguishable in SurrealDB.** Both
return `status: OK` with `result: []`. Every reader in this codebase that names a
table which was dropped, renamed, or never created will report healthy forever
and silently degrade to its default.

That is the same shape as `surrealDB.query()` returning `result[0]` without
inspecting per-statement status, and it is why this defect survived four prior
audits: the selector logged no error, threw no exception, and produced plausible
numbers the whole time.

**The check that finds this class:** for every `FROM <name>` in the codebase,
assert `<name>` appears in `INFO FOR DB`. It is a single query and a grep, and it
would have caught this on day one.


---

## Addendum — the selection/outcome join, corrected

An earlier revision of the main audit called all 26,529 Thompson selections
"structurally unjoinable to their outcomes," attributing it to
`thompson_selection_log.execution_id` being a `recommend-<ts>-<idx>` placeholder.
**That was directionally right about the effect and wrong about the cause**, and
the corrected version is both smaller and fixable.

`execution_id` is a placeholder *by design* — the code says so at
`activities.ts:7211` (`// Placeholder until actual execution`) and names the real
join key on the line above it: `correlation_id: rec.correlation_id, // Link to
execution via correlation_id`.

And the key exists on **both** sides:

- `INFO FOR TABLE execution` defines a `correlation_id` field.
- `thompson_selection_log` populates it faithfully (`sel_1785015944015_6nseg0_8`).
- `v_selection_outcomes` — the view built for this join — exists and holds 226 rows.

The defect is one measurement:

```
SELECT count() FROM execution WHERE correlation_id IS NOT NONE   -->  0 rows
SELECT count() FROM execution WHERE activity_id != 'auth_resolve_v1' -->  8,650
```

**Zero of 8,650 non-auth executions carry a correlation_id.** The selection side
writes the link; the execution side never does. This is a designed join with one
end attached, not an impossible one — and `v_selection_outcomes` covering 226 of
26,529 selections (<1%) is the visible consequence.

### It is wired on the storage and read sides, and on neither producing side

Tracing it end to end, the join is **more completely built than the audit
assumed, and unattached at both producing ends**:

| stage | state |
|---|---|
| selection writes `correlation_id` (`activities.ts:7210`) | ✅ populated, e.g. `sel_1785015944015_6nseg0_8` |
| `execution` table declares the column | ✅ present in `INFO FOR TABLE execution` |
| `paradigm.ts:374` projects `correlation_id` onto the execution row | ✅ explicitly listed |
| `execution-traces.ts:1126` fetches traces **by** `correlation_id` | ✅ with an `activity_id` fallback for traces lacking one |
| `v_selection_outcomes` consumes the join | ✅ exists, 226 rows |
| **the trace-ingest schema accepts it** | ❌ `StoreExecutionTraceRequestSchema` is a plain `z.object` with no `correlation_id` and **no `.passthrough()`** — Zod strips unknown keys, so it is discarded at validation |
| **any executor sends it** | ❌ `correlation_id` occurs **zero times** in goal-host-vessel's and ias-executor-ts's entire `src/` |

So `paradigm.ts:374` names a field that validation removed a step earlier, and no
producer supplies it in the first place. This is the *"an explicit projection is a
silent dropper"* class: a key-by-key builder copies only what survived
validation, and neither layer reports the loss.

**The fix is three coordinated changes, not one line:**

1. `StoreExecutionTraceRequestSchema` — declare `correlation_id: z.string().optional()`
   (or add `.passthrough()`), so the field survives ingest.
2. goal-host-vessel — thread the recommendation's `correlation_id` through
   dispatch onto the execution it starts.
3. ias-executor-ts — include it in the trace payload it posts.

Fixing only (1) changes nothing, because nothing sends the field; fixing only
(2)+(3) changes nothing, because validation strips it. That mutual invisibility
is why a join with five of seven stages already built has produced zero joinable
rows.

Until all three land, law 12 (counterfactuals recorded at decision time) has no
substrate: the system can say an arm succeeded, never that choosing it was
right.

This correction matters beyond the one finding: "the placeholder makes it
impossible" would have sent a repair at `execution_id`, which is deliberately a
placeholder and should stay one. The actual repair is on the execution side of a
key that was already agreed.
