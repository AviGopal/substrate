# Seam probe baseline — local stack, 2026-08-21

First **empirical** run of the probes defined in
[`SEAM_MAP_2026-08-21.md`](SEAM_MAP_2026-08-21.md) §5. Executed against a local
`substrate-live` container (operator-provided, default 18xxx ports), not the hub.

**Why this stack matters.** It runs the fleet the hub is missing:
`goal-host-vessel`, `development-vessel` and `ribosome-vessel` all `active` with
`NRestarts=0`; 17 masked units (base-image only) versus the hub's 67. Both the
trace store (`:18080`) and the dispatch plane (`:18210`) answer 200. It is also a
**genuinely independent replication target**: different container, different
database, ~150k executions of its own history.

All probes below are **read-only**. No goal was dispatched, no unit restarted, no
row written. Credentials never left the container — every authenticated call was
issued from inside it via `docker exec`.

## Baseline row counts (`db_admin` diagnose)

| table | rows |
|---|---|
| `execution` | 150,087 |
| `context_thompson_scores` | 4,545 |
| `successor_features` | 2,125 |
| `activity_composition_graph` | 1,999 |
| `execution_trace_content` | **810** |
| `substrate_tuning_param` | 2 |

⚠ **150,087 executions against 810 trace-content rows.** The map predicted
`R3-trace-12` (content written fire-and-forget after the 200 is decided) with a
healthy ratio of ≈1.0. Observed ratio is ~0.005. **Not yet a confirmed verdict**
— retention/reservoir sampling legitimately prunes content rows
(`TRACE_STORE_RESERVOIR_PER_ACTIVITY`), so this number is consistent with both
the defect and normal pruning. **Discriminator, not yet run:** compare
content-row count to execution count within a single recent hour, before
retention can act.

## Probe results

| # | seam | predicted | observed | verdict |
|---|---|---|---|---|
| **P2** | `L2-structure-04` execution-minted edges | 0 | **0 of 400** sampled; every edge `execution_id="composition-edge-reconcile"` | **CONFIRMED** |
| **P2-disc** | is the derive path invoked at all? | — | **0** `derive-from-parent` log lines AND **0** `Found NONE/NULL for field` on `activity_composition_graph` across 20k journal lines | **the path is NEVER REACHED** — see below |
| **P6** | `R3-trace-10` per-task `error` landing key | absent | **0 of 478** tasks carry `error` | **CONFIRMED** |
| **P7** | `R3-trace-09` `actualPrompt` ever stored | 0 | **0 of 478** tasks have non-empty `actualPrompt` | **CONFIRMED** |
| **P10** | `L1-credit-03` signature tier 2 | `[]` | `deriveSignatureShapes({tasks:[{input_shapes:["goal"]}]})` → **`[]`**, expected `["goal"]` | **CONFIRMED** (unit-level, by execution) |
| **P13** | `L3-tuning-06` SF_BLEND write | null | log says `SF_BLEND evidence=sf_rows=2125 value=1 flipped=true` (twice per tick); `GET /v2/tuning-params/SF_BLEND` → **`{"value":null}`** | **CONFIRMED** |
| — | endpoint defect | `total:0` | 400 edges returned alongside `"total": 0` | **CONFIRMED** |

### The P2 discriminator sharpens the diagnosis

The map offered a discriminator: zero log lines **and** zero assert failures means
the derive path was never invoked (seams `L2-structure-01/02` dead); assert
failures with zero rows would mean it was invoked and the `CREATE` was rejected
(`L2-structure-04`).

**Observed: both zero.** So `deriveCompositionEdgeFromParent` is **not reached**
on this stack. Consequence for the plan: **fixing the `CREATE`'s missing
`ASSERT != NONE` bindings (step 4.2) would have been inert on its own** — the
parent-resolution fix (4.1) is not merely a prerequisite for correctness, it is
the difference between the fix running and not running. This is the
amputated-in-series pattern, caught before a fix was written rather than after it
landed green and did nothing.

### P13 replicates on independent data

The SF_BLEND silent write was found on the hub. It reproduces here on a different
container with a different database and a different row count (`sf_rows=2125` vs
the hub's 1737), still logging `flipped=true` hourly while the store holds null.
**That rules out hub-specific data and confirms the code defect** — the JS `null`
bound into an `option<string>` column, whose UPSERT create branch writes nothing
and raises nothing.

Note `successor_features` = 2,125 is well past the ratchet's 200-row threshold, so
ψ *would* be eligible here — and is still off, for the write reason, independent
of the `completion_shapes` conjunct.

## What this baseline establishes

1. **Five predicted failures confirmed by execution**, not code reading. The seam
   map's static analysis is holding up where it can be tested.
2. **Two failure classes are now cleanly separated.** On the hub, composition
   edges were stale since 2026-07-14 and the reconciler was masked. Here the
   reconciler is alive and edges run to **2026-08-18** — and there are *still*
   zero execution-minted edges. The reconciler's death was a hub problem; the
   dead live-writer is a code problem present on both.
3. **The dispatch-requiring probes are unblocked.** Goal-host answers 200, so
   P4/P5 (stub fraction, literal `{{`), P14 (reach attribution), P17 (dropped
   intake keys) and P18 (coalescing) are all runnable here.

## Not yet run

Everything requiring a dispatch — P1, P3, P4, P5, P8, P9, P11, P12, P14–P22 — plus
the trace-content ratio discriminator above. These write learning state and spend
LLM budget, so they are held pending scope confirmation.

`P9` deserves care when it runs: it needs the stored `context_thompson_scores`
`template_id` form compared against what `/recommend` binds, and its first job is
to **confirm the zero** rather than to find a non-zero.
