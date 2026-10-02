# Composition learning — verified state, 2026-08-20

> ## ⚠ SUPERSEDED IN PART — read the corrections first
>
> A 13-agent adversarial validation on 2026-08-21 confirmed this report's two
> headline findings but **overturned all three of its prescriptions**. See
> [`COMPOSITION_LEARNING_ARCHITECTURE_2026-08-21.md`](COMPOSITION_LEARNING_ARCHITECTURE_2026-08-21.md).
>
> - **#4 credit — prescription WRONG.** Already fixed by `e19997f` (08-13). This
>   report read the fix's own explanatory comment as evidence of the defect.
> - **#5 grading — prescription NOT IMPLEMENTABLE** at `:4591`, and the rationale
>   ("distinguishes composed from one-shot") is wrong: the cap only demotes. The
>   load-bearing site is `:9471`, which this report missed.
> - **#6 selection — diagnosis FALSE.** The composition graph *is* read, joined
>   and blended at scoring. The real defects are an unsent
>   `predecessor_activity_id` and a picker that does not order by the blend.
> - **SF_BLEND root cause found**, and this report's supporting premise was wrong:
>   the throwaway-name roundtrip succeeded only because it supplied non-null meta.
> - **The "1644 sampled" figure** was not a sample bound but an endpoint ceiling —
>   19% of rows are permanently unreachable through that route.
>
> The findings that stand: composition edges are a dead batch artifact, and the
> autonomy plane was masked in one hand-applied batch at 2026-08-16 21:13.

Live re-verification of the composition stack against the hub (`syzygy.host`,
`substrate-live`) and current `dev` source. This is a **delta report**: it builds
on `COMPOSITION_WIRING_AUDIT.md` (08-14) and `COMPOSITIONALITY_STATE.md` rather
than re-deriving them. Every claim below was checked tonight; where a prior
audit's line citation still holds, it is marked re-verified, not quoted.

## Executive summary

Composition **executes** and **routes**; composition **learning** is severed at
all three of its remaining joints — credit, grading, and selection. Separately,
two independent stalls have stopped the machinery from accumulating anything:

1. **Composition-edge accumulation stopped 2026-07-14** — five weeks ago, and a
   month *before* the masking below. Not caused by it.
2. **The entire autonomy plane was masked in one batch at 2026-08-16 21:13.**

These are distinct failures with distinct fixes. Treating them as one cause
would leave the older one in place.

## What works (do not re-litigate)

- **Multi-step execution** — verified 08-13 (`exec_joi8onzf`): two real
  `/pattern` steps, intermediate + terminal shapes both in `produced_shapes`.
- **Routing on an arbitrary NL goal** — verified 08-13, zero edits: inference
  emitted `[orphaned_capability_scan, memoryNote_write]` @0.9 and reached via a
  real 2-step chain (`live_shape_count:322`, `capability_orphan_count:76`).

The gate on routing is phrasing: `isCompositionAsk` (a write-clause regex) and a
newer explicitly-named-shape route (08-05) are the only bypasses of the
deterministic flatten shortcuts.

## Blocker re-verification (08-20)

| # | Blocker | Status | Evidence checked tonight |
|---|---|---|---|
| 2 | Target-inference flattens to `[shellResult]@0.6` before vocabulary/LLM | **still live, narrowed** | `goal-target-inference.ts:504/523/538` still return early; bypasses = `isCompositionAsk` + named-shape route |
| 3 | Floor one-shots and persists `compositionChain:[]` | **still live** | `goal-host-vessel/src/index.ts:4638` |
| 4 | Composition credit invisible to selection | **still live** | `ancestor_signatures` has **zero** populating callers — the code's own comment at `activity-api/src/lib/posterior-update.ts:702` says so; only tests set it |
| 5 | Reach-judging is content-only for the floor | **still live** | `verifyGoalReached` at `:4591` and `:12304` omit the `walkEvidence` arg that `:9564/:9570` pass |
| 6 | Nothing rewards a chain at selection | **still live, worse than documented** | see SF_BLEND below; `composition-graph`'s only non-test callers are the read route at `activities.ts:8002/8044`, not the scorer |

Blocker #1 (no traversable edge) was **not** re-verified tonight — the 08-14
live refinement and the 08-13 end-to-end reach already superseded its strongest
form. Flagged as the one item resting on prior evidence.

## New finding: the ψ accelerator ratchet reports success and does not land

`SF_BLEND` gates the successor-features blend in ranking. It is designed to
self-enable once `successor_features` reaches 200 rows, and to ratchet (once 1,
never back to 0).

- The tick **fired**: `[flag-policy] SF_BLEND evidence=sf_rows=1737 value=1 flipped=true`
  (activity-api journal, 04:34:06). `flipped=true` means `writeTuningParam` was
  awaited without throwing.
- The store **disagrees**: `GET /v2/tuning-params/SF_BLEND` → `{"value":null}`,
  read twice, 20+ minutes apart. `getTuningParam` runs the identical SELECT, so
  the scorer resolves `null → env (unset) → default 0`. **ψ blending is OFF.**
- The mechanism is **not** generically broken: a write-read roundtrip through the
  same `writeTuningParam` / same SELECT with a throwaway name
  (`PROBE_WRITE_READ_20260820 = 7`) returned `7`.

So the one flag that was supposed to switch composition-aware ranking on believes
it is on, while every consumer reads off. This is the producer/consumer
(write ≠ read) class the 08-14 wiring audit called systemic in 5/6 subsystems.

Two smaller defects observed in passing:
- Every flag line is logged **twice** — `accelerator-flag-tick` is imported and
  scheduled twice (`activity-api/src/index.ts:700` and `:711`).
- `GET /composition/graph` returns `"total": 0` alongside 200 edges; its catch
  branch also returns `{value:null}` with HTTP 200, making a read failure
  indistinguishable from an absent row.

## New finding: the composition graph is a batch artifact, not learned

Paginated the live graph (~2029 edges; 1644 sampled across 9 pages):

- **Newest edge: 2026-07-14.** Nothing in five weeks, though executions continued
  through August.
- **Every single sampled edge has `execution_id = "composition-edge-reconcile"`.**
  Not one edge was written by a live execution. `edge_kind`: 924 genuine /
  420 hub / 300 scaffold.
- `composition-edge-reconcile.{service,timer}` are **masked**. Independently,
  `development-vessel/src/resolvers/systemd-unit-health-observer.ts:47/172/225`
  documents this job "aborting every run for weeks" while a health observer hid
  the failure.

The composition graph is therefore not an accumulating record of what composed —
it is the residue of a batch job that was already failing before it was masked.
Any selection mechanism wired to read it would be reading a five-week-old
snapshot.

⚠ Method note: an earlier pass of this analysis concluded "exactly 200 edges"
because a quoting bug made offset pages return `INVALID_API_KEY`, which the
parser counted as zero edges. **A failed page and an empty page are not the same
thing** — the pagination was re-run through a helper script and corrected.

## The masking, dated

All substrate autonomy units are masked with a single mtime — **2026-08-16
21:13** — a batch action. Base-image masks (getty, x11, redis, udevd) carry the
image-build date 2026-08-05 and are unrelated.

Nothing in `scripts/` masks units (`grep systemctl mask` → no hits outside
`node_modules`), and no `SUBSTRATE_ROLE` / `DISABLED_VESSELS` is set in
`/etc/substrate/env`. So this was applied by hand inside the container, and it is
not reproducible from the repo.

Masked (autonomy-relevant subset): `goal-host-vessel`, `development-vessel`,
`ribosome-vessel`, `boredom-vessel`, `light-dispatch-vessel`, `analysis-vessel`,
`relevance-sink-vessel`, `stateful-ui-vessel`, `local-tools-vessel`,
`compose-teacher`, `composition-edge-reconcile`, `gap-compose`, `funnel-drain`,
`m1-trainer`, `operator-goal-generator`, `surgical-gap-scan`,
`typecheck-scenario-gen`, `efficiency-failure-tick`, `auto-describe-resolvers`,
`observe-orthogonal-refresh`, `goal-host-behavior`, `ingest-docs`, the
`obsidian-*` set. 67 masked unit files in total.

Note `llm-resolver-{google,haiku,opus,vessel}.service` are also masked, and they
carry the **same 21:13 mtime** — so they were swept in the same batch rather than
retired separately. Functionally this subset is harmless: they are superseded by
the `llm-<id>.service` units rendered by `render-llm-arms.sh`, which are running.
Not every mask in the batch is an outage — but the batch did not discriminate,
which is itself evidence about how it was applied (one sweep, not a curated set).

Consequences while this holds:
- No goal dispatch (`goal-host-vessel`), hence ~20h of zero LLM traffic observed
  on 08-20 and no new traces to learn from.
- No ribosome, so no extraction of reached executions into templates — law 4's
  "activities are earned by doing" has no runtime path.
- `substrateGap_write` is served by `development-vessel`, so **the outage blocks
  filing a gap about itself**.
- Masking defeats `Restart=on-failure`, self-recovery and pull-sync at once, so
  nothing will restore these without an operator.

## Ranked plan

**0. Decide the plane (gating, operator).** Was 08-16 21:13 deliberate? Nothing
below can be validated end-to-end while dispatch, ribosome and the gap store are
masked. If it was a cost or thrash control, say so and we scope to code-only work
plus a local stack.

**1. Land the credit joint (#4).** Populate `ancestor_signatures` at the
`propagateCreditAlongChain` call site so chain credit reaches
`context_thompson_scores` on the signature-conditioned key. Until this lands, a
composed pathway *cannot* out-rank a single-shot one — the evidence never arrives.

**2. Land the grading joint (#5).** Pass `walkEvidence` into the floor's
`verifyGoalReached` (`:4591`, and `:12304`). Today a zero-producer one-shot
passes the identical gate a two-step composition does, so the grader cannot
distinguish them and #1's credit would be computed over mislabelled outcomes.
**#5 before #1's validation**, or the credit is learned from a corrupted label.

**3. Fix the SF_BLEND write, then let the ratchet re-fire.** Diagnose why that
one name does not persist while an identical roundtrip does (suspect: a
pre-existing `SF_BLEND` row whose `value` is non-numeric, shadowing the UPSERT
under `LIMIT 1`; migration 152's UNIQUE index needs confirming on this
deployment). Do **not** hand-author `SF_BLEND=1` — that would mask the write
defect behind a manual value and forfeit the evidence.

**4. Restore composition-edge accumulation.** Fix `composition-edge-reconcile`'s
abort, or better — per law 6 — ask why edges are written by a batch reconcile at
all rather than by the execution that composed. An edge minted at execution time
needs no reconcile job and cannot silently stop.

**5. Only then, selection (#6).** Wire the composition graph into recommend-time
scoring. Sequenced last because it reads a structure that steps 3–4 must first
make current and trustworthy.

⚠ Before promising anything from ψ: the 08-17 finding that ψ was unreachable at
six call sites (each defect alone zeroing it) has **not** been re-verified here.
If those are unfixed, flipping SF_BLEND changes nothing.

## Execution constraints

- Steps 1, 2, 3 are one-file code changes in `activity-api` / `goal-host-vessel`.
  They are `repos/<vessel>/src/**` and must be **dispatched as goals**, not
  hand-edited — which requires step 0.
- A local `make up` stack restores a dispatch plane without step 0, but boots
  with *fresh* learning state: fine for verifying mechanism (does chain credit
  land once `ancestor_signatures` is populated), useless for working with the
  hub's learned posteriors. Probe ports with `ss -ltn` on all interfaces first —
  the 23xxx offset is occupied.
- Validate credit flow by intervention, not by reading the table: one graded
  success, assert the **direction** of the posterior change, never the amount.

## Left undone / not verified

- Blocker #1 rests on prior evidence (see above).
- ψ's six call sites (08-17) not re-checked.
- `successor_features` = 1737 rows is from the flag-tick's own log line, not an
  independent count.
- The `PROBE_WRITE_READ_20260820` tuning row was left in place — there is no
  DELETE route. Harmless (nothing reads that name), but it is litter.
- No gap was filed for any of this: `substrateGap_write` is unreachable.
