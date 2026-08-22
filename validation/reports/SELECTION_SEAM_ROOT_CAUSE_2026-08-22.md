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

### Tier 3 — fallback: reads a view that does not exist

`activities.ts:6492`:

```ts
let alpha   = scores?.alpha || template.metrics?.thompson_alpha || 1.0;
let betaVal = scores?.beta  || template.metrics?.thompson_beta  || 1.0;
```

`scores` comes from `scoresMap`, populated by `SELECT … FROM v_activity_score`.

**`v_activity_score` is not among the 96 tables in this database.**

```
SELECT * FROM v_activity_score LIMIT 1;   -->  {"result":[],"status":"OK"}
```

SurrealDB treats a missing table as an empty one: **`status: OK`, zero rows, no
error.** *Positive controls:* `v_selection_outcomes` (a view that does exist)
returns a row; `variant_performance_metrics` returns 3,349. So the empty result
measures the missing view, not a broken query.

`scores` is therefore always `undefined`, and the fallback resolves to `1.0/1.0`.
With `alpha += totalBoost` applied at `:6602`, the observed α=4.0 / β=1.0 is
exactly `Beta(1,1)` plus 3.0 of heuristic boost.

---

## Why the view can never come back

This is the failure class migration 174 documented for seven *other* views, and
`v_activity_score` is an eighth that it missed.

1. `sql/schemas/021-paradigm-computed-views-v3.surql:19` defines it —
   `DEFINE TABLE IF NOT EXISTS v_activity_score AS …`
2. `init_migrations` records **both** `021-paradigm-computed-views.surql` and
   `021-paradigm-computed-views-v3.surql` as applied on 2026-06-28
3. `scripts/init-database.ts` — the only schema applier — **skips any file whose
   filename is recorded**
4. the view is gone from the live volume (almost certainly a casualty of
   migration 166's batched REMOVE-over-stdin, which migration 174 records as
   having "silently dropped a subset of its statements")

Recorded-as-applied plus absent-from-the-volume equals **permanently
unrecoverable by the normal path**. Migration 174 established the remedy: a
*fresh, unrecorded* migration, applied statement-by-statement rather than piped.

---

## Why restoring the view is the wrong fix

The view's own header says `Replaces: variant_performance_metrics`, and its body
aggregates `FROM execution`:

```sql
count(success = true) + 1 AS alpha,
count(success = false) + 1 AS beta,
...
FROM execution GROUP BY activity_id, org_id
```

`execution` is a **150,000-row FIFO ring at cap** (`trace_store_counters:execution`
cap=150000, row_count=150040) that a credential-failure storm filled with 142,951
auth rows — 95.27% of the table, 133,622 of them older than 24h. Its retained
history is roughly two days, and the stratified retention sweep that should have
protected real traces deletes nothing because every composite index whose prefix
ends in `success` returns zero rows:

```
activity_id='validator-dispatch' AND success=true  -->  0
activity_id='validator-dispatch'                   -->  4,796
success=true                                       -->  7,123
```

So resurrecting the view would restore a posterior computed over a two-day window
that is 95% authentication telemetry — integer counts with no credit weighting,
recomputed from scratch on every eviction.

**The correct target is `variant_performance_metrics`**: 3,349 rows, 1,638 with
moved posteriors, credit-weighted fractionals (α=493.83/β=897.23 on the deepest
arm), durable, and already the table every *other* reader in the codebase uses
(`paradigm.ts:541`, `posterior-update.ts:902`, `discover-by-shapes.ts:261`,
`variant-creator.ts:490`). Law 3 says reuse the existing producer rather than
resurrect a duplicate.

---

## The fix, in dependency order

1. **Point tier 3 at `variant_performance_metrics`** (`activities.ts:6492`).
   Single highest-value change: it puts real, durable, credit-weighted evidence
   into every draw that currently gets the uniform prior. This alone unpins β.
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

**The fix is correspondingly small:** propagate `correlation_id` from the
recommendation onto the execution record when the selected template runs. Nothing
new needs designing — the column, the writer on one side, and the consuming view
all already exist.

This correction matters beyond the one finding: "the placeholder makes it
impossible" would have sent a repair at `execution_id`, which is deliberately a
placeholder and should stay one. The actual repair is on the execution side of a
key that was already agreed.
