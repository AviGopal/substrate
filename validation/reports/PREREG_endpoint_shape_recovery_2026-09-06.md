# Pre-registration — recovering endpoint output shapes on shape-blind pathways

Stamped **before** any write, so the after-reading can be adjudicated rather than admired.
An after-only reading cannot distinguish "the fix worked" from "the condition was never present"
(`causal-adjudication.ts`), so the numbers below are the baseline half of the claim.

## The defect

`goal_execution_paths.endpoint_output_shapes` is the index Tier-2 pathway reuse and the
shape-signature match mode read to find donor pathways. The donor query is:

```sql
WHERE endpoint_output_shapes CONTAINSANY $target_shapes
```

An empty array matches nothing. A pathway with no recorded endpoint shapes is therefore
**invisible as a donor**, no matter how often it succeeded.

**Root cause.** `activity-api/src/routes/goal-paths.ts:430`:

```ts
const endpointOutputShapes = validated.endpoint_output_shapes !== undefined
  ? validated.endpoint_output_shapes
  : await accumulateEndpointShapes(validated.path_activities);
```

`accumulateEndpointShapes` correctly decodes `satisfier:<shape>` pseudo-ids — but it only runs
when the field is `undefined`. goal-host always *sends* the key (`recordGoalPath`,
`goal-host-vessel/src/index.ts:5777`), as `[]` for a satisfier-only walk. **An explicit empty
array defeats the fallback**, so the row records `[]` and the pathway disappears from the index.

## Baseline (measured 2026-09-06 ~03:51–04:05 UTC, loadavg 24.81)

| quantity | value |
|---|---|
| `goal_execution_paths` rows | 9,853 |
| shape-blind rows (`endpoint_output_shapes` empty) | 8,314 (84.4%) |
| rows before 2026-08-26 / blind | 8,368 / 8,042 (96.1%) |
| rows since 2026-08-26 / blind | 1,485 / 272 (18.3%) |
| **successful + shape-blind (the target)** | **1,958** |
| rows currently usable as donors | 1,539 |
| goal-host 24h: `rebind]` mentions | 1,872 |
| goal-host 24h: `shape-mismatch` refusals | 1,404 |
| goal-host 24h: `shape_signature` matches | 49 |
| Tier-2 rebinds ever `selected=true` | 0 |

The writer defect is **dated, not ongoing**: 96.1% blind before 2026-08-26 against 18.3% since.
This is historical residue, which is what makes a one-shot recovery the right instrument.

## The derivation rule, and its control

Three candidate rules were scored against the 1,539 rows that already carry recorded shapes,
**stratified by era**, because validating a recent rule against recent truth and applying it to
old rows would be the wrong control stratum:

| rule | era | exact | subset | **superset** | mixed |
|---|---|---|---|---|---|
| declared output_shapes, terminal activity | all | 19 | 107 | — | **77 (37.9%)** |
| A: declared-union over path (**the live helper**) | before 08-26 | 139 | 63 | **73** | **22** |
| A: declared-union over path (**the live helper**) | since 08-26 | 560 | 199 | **245** | **145** |
| **C: observed-union + satisfier decode** | before 08-26 | 164 | 77 | **0** | **0** |
| **C: observed-union + satisfier decode** | since 08-26 | 627 | 321 | **0** | **0** |

Rule C is derived from `execution.output_impulse_shapes` — what runs **observably produced** —
unioned across the pathway, with `satisfier:<shape>` decoded from the id.

**Why 0 supersets is the load-bearing property.** Cover is computed donor-covers-goal
(`goal-paths.ts:1065`): `|have ∩ target| / |target|`. A *subset* label can only depress the score
and miss a donor — exactly today's behaviour, no worse. A *superset* label injects a shape the
pathway never produced, which both puts it in `CONTAINSANY` range and earns it cover credit:
a confidently wrong donor. Rule C produced zero supersets and zero mixed across both eras
(n=853 derivable). The backfill is therefore **monotone**: it can add correct matches and cannot
manufacture wrong ones.

**Caveat, stated so the table is not over-read:** rule A wrote some of the rows it is scored
against, so its "exact" column is partly self-agreement and its true error rate on
independently-recorded rows is *higher* than shown, not lower.

## Implementation route (revised 04:12 UTC — reuse, not mint)

The first plan was a new pure module plus a new impulse shape. That was abandoned on finding an
existing producer, per law 3: `db_admin` already exposes a `repair` operation backed by a **vetted
pattern catalogue** (`activity-api/src/routes/db-admin-repair.ts`) which supplies, for free, every
rail this write needs — dry-run by default (`apply` must be explicitly true), a pattern whitelist,
a pre-computed impact count, `max_rows` bounds, catastrophic-SQL rejection, and an audit row per
invocation. Minting a parallel surface would have duplicated all of it.

So the change is **one catalogue entry**, `recover_endpoint_output_shapes`.

It also collapsed the derivation. 1,644 of the 1,657 recoverable rows are satisfier-only, and a
`satisfier:<shape>` id *names its own output shape* — decoding it is exact by construction, not
inferred, and needs no execution join at all. The remaining 13 observed-only rows are left alone
rather than carrying a whole join for 0.8% of the target.

**The SQL was controlled at the layer that runs it**, not via a Python proxy of it — the same
`array::filter`/`string::slice` expression, executed against the 1,175 rows already carrying
recorded shapes:

| era | exact | subset (safe) | superset | mixed |
|---|---|---|---|---|
| before 2026-08-26 | 163 | 77 | **0** | **0** |
| since 2026-08-26 | 612 | 323 | **0** | **0** |

## Scope

- Successful pathways only (`successful_executions > 0`). Labelling failed pathways would put
  them in donor range gated only by `isProvenFailing` — a behaviour question, not a repair.
- Additive only: rows with a non-empty array are never touched. Guard is
  `array::len(endpoint_output_shapes ?? []) = 0`; `= []` matches nothing and would make the
  guard silently never fire.
- Derivable target: **1,657 of 1,958 (84.6%)** — of which **1,644 are satisfier-only**, i.e.
  exact by construction, not inferred. 301 remain underivable and are reported, not capped away.

## The dry run must report exactly 1,644

Fixed in advance, so the deployed pattern's own report is checked against a number rather than
accepted as whatever it prints. Two controls on the predicate itself:

| query | count |
|---|---|
| the pattern's `countSql`, verbatim | **1,644** |
| same, without the `satisfier:` clause | 1,958 |
| same, but guarded with `endpoint_output_shapes = []` | **0** |

The last line is why the guard is `array::len(endpoint_output_shapes ?? []) = 0`. The `= []` form
matches nothing in SurrealDB, so a guard written that way would silently never fire — and a
recovery that touches zero rows reports success identically to one that was never needed.

## Predictions (falsifiable, adjudicated at loadavg < ~10)

1. Rows usable as donors rises 1,539 → **3,183** (= 1,539 + 1,644).

   *Scope narrowed 04:18, before adjudication, not after:* the shipped pattern covers the 1,644
   satisfier-derivable rows, not the full 1,657 plan. The 13 observed-only rows are deferred and
   remain enumerated in `plan_endpoint_shape_recovery_2026-09-06.json`.

   A bare `satisfier:` id would slice to `""` and write an empty shape into the index. Checked
   before landing: **0 rows**, with a positive control returning 9,854 to prove the predicate can
   match — so that is a real zero and not a silently broken check. No guard needed.
2. `shape-mismatch` share of Tier-2 refusals **falls** from its 24h baseline of 1,404.
3. `shape_signature` matches per 24h **rises** from 49.
4. Tier-2 `selected=true` becomes **> 0** within 72h.

**If (1) holds but (2)–(4) do not, the finding is that the index was not the binding constraint** —
that is a result, not a failure, and it is the next thing to investigate rather than something to
explain away. Writing 1,657 labels and observing Tier-2 still never fire would be the honest
outcome to report.

## Outcome (written 04:33 UTC, after the apply)

Landed as `activity-api 8e0c579`, cut over by the substrate's own pull-sync at 04:28:23
(`activity-api mirrored (8e0c579) -> /vessels/activity-api`), verified at the consuming layer:
the pattern is present in the **deployed** file and `MainPID` moved 3415887 → 3427346, so the
running process reloaded rather than merely the checkout changing.

| step | result |
|---|---|
| dry run | **1,644** — exactly the pre-registered count |
| apply | `before 1644 → after 0`, snapshot at `/workspace/db-backups/2026-09-06T04-28-56-948Z-repair-recover_endpoint_output_shapes.json` |
| in-scope rows still blind | **0** |
| out-of-scope rows (`successful_executions = 0`) | 4,147, deliberately untouched |
| row-level check | **1,804 / 1,804** in-scope rows carry the decoded shapes |
| prediction 1 (donors 1,539 → 3,183) | **3,186** — met (+3 from concurrent writes during the window) |

**Functionally, not just numerically:** the donor query the shape-signature match actually runs
(`CONTAINSANY`) now returns 517 candidates for `shellResult` and 458 for
`orphaned_capability_scan`. Those pathways previously matched nothing.

### The first verification was wrong, and the write was not

The initial spot-check reported 643/899 agreement and 256 mismatches, all `actual=[]`. The write
was correct; **the checker keyed on `path_signature`, which is not unique** — 513 rows share
`4502429f465d532f`. It was comparing rows outside the declared scope (`successful_executions = 0`)
against a sibling row's plan entry. Re-checked per row against its own `path_activities`:
1,804/1,804. Recorded because a 256-row mismatch that turns out to be an artifact of a non-unique
key is exactly the kind of result that gets quietly dropped once it resolves in your favour.

### Predictions 2–3: an existence proof, recorded 05:06 UTC

Not the rate adjudication (that still needs a window at loadavg <~10), but something stronger than
an aggregate for the instances it covers: **a specific recovered pathway was used, twice, by the
exact mechanism that could not see it before.**

Two goals dispatched at 04:58 and 04:59 both logged:

```
pathway reuse: accepted 1-step pathway via shape_signature cover=1.00
  borrowed_from_goal=b5302926722fb9ca (15/15 reached)
```

That pathway is `path_signature = 4502429f465d532f`, activities `['satisfier:shellResult']`.

The counterfactual is **recorded, not reconstructed** — the rail's pre-mutation snapshot holds
**360 rows carrying that signature, every one with `endpoint_output_shapes = []`**. So before
04:28:56 that family matched nothing under `CONTAINSANY` and was invisible as a donor; after the
write it carries `['shellResult']`; and thirty minutes later it was borrowed by two goals with
*different* `goal_hash`es, both of which reached with answers verified against ground truth
(1346 and 6212, each independently recomputed by a second derivation).

Chain: backfill → the family becomes addressable → the shape-signature donor query finds it →
cross-goal reuse at `cover=1.00` → correct reaches.

**What this is not:** proof that the aggregate reuse *rate* rose. Two instances are two instances.
The honest claim is that the recovered data is demonstrably load-bearing in the live selection
path, which is the part that "donors went 1,539 → 3,186" could not establish on its own.

### Still open, deliberately

Predictions 2–4 (shape-mismatch share falls, `shape_signature` matches rise, Tier-2
`selected > 0`) are **not adjudicated**. They need an observation window, and loadavg was 17–30
throughout — above the floor at which this session trusts a measurement. The post-window baseline
starts at the cutover, 2026-09-06T04:28:23Z. **Landing and read-back are done; the effect is not
confirmed**, and if the donor count rose while Tier-2 still never fires, the index was not the
binding constraint — which is the result to report, not to explain away.

The two root causes remain open as gaps and were **not** fixed here: the `!== undefined` guard
that an explicit `[]` defeats, and the declared-vs-observed source of `accumulateEndpointShapes`.
Both change behaviour for all future selections and did not belong in a measurement window.

## Reversibility

**The revert path is the rail's snapshot, not the plan JSON.** The plan was keyed on
`path_signature`, and that turned out **not to be unique** (513 rows share one), so it cannot
identify the touched rows unambiguously — it remains useful as the derivation record, not as a
revert key.

The snapshot the repair rail took before mutating was verified by reading it, not by trusting the
apply response:

```
/workspace/db-backups/2026-09-06T04-28-56-948Z-repair-recover_endpoint_output_shapes.json
  table          : goal_execution_paths
  affected_count : 1644
  rows captured  : 1644
  rows with a record id : 1644      <- the unambiguous revert key
  sample pre-write endpoint_output_shapes : []
```

Every touched row is restorable by `id` to its exact pre-write value.

## Rate adjudication (06:30 UTC, host loadavg 9.99 — the first time it dropped below the floor)

Baseline = the 24 h before cutover; post = cutover (04:28:23) → 06:30, i.e. **2.03 h**. Rates are
per hour.

| metric | baseline/h | post/h | ratio |
|---|---|---|---|
| rebind calls | 19.42 | 22.69 | 1.17× |
| shape-mismatch refusals | 58.25 | 67.10 | 1.15× |
| shape_signature events | 2.12 | 5.43 | 2.55× |

### Verdict against the pre-registered predictions

1. **Donors 1,539 → 3,183 — MET** (3,186). Structural, and already confirmed.
2. **shape-mismatch share falls — NOT MET.** Per rebind call: **3.00 → 2.96**. Unchanged.
3. **shape_signature matches rise — NOT MET once self-caused events are removed.** The raw 2.55×
   is an artifact of my own dispatches. Attributing the 11 post-cutover events by timestamp against
   my dispatch log leaves **2 organic** (05:44:02, 06:06:02); the other 9 fall on operator goals.
   Organic rate **0.99/h against a 2.12/h baseline — 0.46×**, i.e. no rise.
4. **Tier-2 `selected=true` > 0 — MET ONLY BY MY OWN GOAL.** The single occurrence is goal B, which
   I dispatched specifically to force it. **Organic `selected=true` remains 0.**

**So (1) holds and (2)–(4) do not, which is exactly the case written down in advance: the index was
not the binding constraint.** Making 1,644 pathways addressable was necessary — they are provably
borrowed, and the counterfactual for that is recorded — but it was not sufficient, and it did not
move the reuse rate.

### Why this verdict is weaker than it looks, stated plainly

- **n is tiny.** 11 shape_signature events post-cutover, **2 of them organic**. Poisson error on
  n=2 is enormous; "0.46×" is not a reliable point estimate and is entirely consistent with no
  change in either direction. The defensible claim is **"no detectable increase"**, not "a decrease".
- **2.03 h against a 24 h baseline**, in a single stretch at elevated load. Time-of-day and load
  confounds are uncontrolled.
- **Attribution is judgment, not a tag.** I separated mine from organic by comparing timestamps to
  my own dispatch log. Ironically, the fix landed later this same window (`ablation`/`learning_mode`
  tags now persisting) is the beginning of the machinery that would make this attribution mechanical
  instead of manual.

The 72 h horizon in the original pre-registration therefore still stands; this is an early read at
2 h, not its replacement.
