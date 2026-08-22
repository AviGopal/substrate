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

---

# Closure round 1 — six seams fixed, 2026-08-21

Fixed against the baseline above, each with a test and a before/after suite
comparison. All landed on `origin/dev` and converged into the running container
by `substrate-pull-sync`.

| seam | commit | what was actually wrong |
|---|---|---|
| `R3-execute-04` — the impulse body dies at hop 4 | `8676beb` (ias-executor-ts) | `evictExecutionScope` ran `store.impulses.clear()` on the top-level branch; a walk step IS top-level by that branch's own test, and the walk reads outputs back AFTER `execute()` returns. Now retains the execution's outputs and reaps them at the next top-level entry. **Suite 31 → 17 failures, zero newly failing: 15 pre-existing failures were this same defect**, including "resolved outputs are stored and retrievable by shape". |
| `L3-tuning-06` — SF_BLEND never lands | `2a31d5a` (activity-api) | JS `null` bound into `option<string>`. **NULL is not NONE**: the UPDATE branch raises, the CREATE branch writes nothing and raises nothing. Now omits absent keys and **reads the row back, throwing on mismatch**. |
| the same class, firing loudly | `2a31d5a` | `shape_definition.org_id` — every PUBLIC shape registration failing, 35×/48h on the hub. Same fix. `NONE` is also what the tenancy PERMISSIONS clauses test for. |
| the lint gate | `1e30bbd` | `CLAUDE.md` documents `bun run lint` as enforcing the shape contract. **No `lint` script existed**; the checker's only reference was a shell script nothing invokes. Wired, and **verified by conviction**: an injected bad case exits non-zero, passes again on revert. |
| `L2-structure-01..04` — no execution has ever minted an edge | `18c1490` | Four defects in series. The parent lookup read `activity_execution_traces` (**18,135 rows**) instead of `execution` (**150,003**) — a 12% shadow, so most lookups missed; the miss took a **bare return**, and the call site had `.catch(() => {})`, so the journal showed neither activity nor errors; the `CREATE` bound none of `execution_id`, `org_id`, `success`. |
| `L1-credit-10(ii)` — credit addressable by nobody | `eee3074` | Credit writes `template_id` through `normalizeActivityId` (**bare**); `/recommend` binds ids from `normalizeRecordId` (**prefixed** `activity:⟨…⟩`, verified live). `IN` never matched — **4,545 rows** orphaned. Now queries and keys both forms, with a `cts_lookup` requested-vs-matched counter. |
| `L3-psi-08` — ψ never blends | `cc99b98` (goal-host) | `psiInputs` refused the ENTIRE payload on a foreign signature, withholding `completion_shapes` — a conjunct of the server's ψ guard. Refusal narrowed to `signature` alone; the no-fabricated-signature invariant is preserved and now has its own test. **Suite 741 pass / 0 fail** (was 5 failing). |

## What the measurement changed about the diagnosis

**The static analysis said the composition-edge derive path was "never
reached"** — zero log lines, zero assert failures. Measurement showed it fires
on **66 of 100 ingests** and was giving up at a parent lookup against a 12%
shadow table, silently. Both the bare `return` and the `.catch(() => {})` had to
be counted before the truth was visible.

This also settles the sequencing question the plan flagged: **fixing the `CREATE`
alone would have landed green and minted nothing**, because the function returns
before reaching it. The amputated-in-series pattern, caught by measurement
rather than by an inert fix landing green.

## Deployment

`substrate-pull-sync` converged the container to these commits. It behaved
correctly under observation, and is worth recording as a working instrument:
it **quiesced goal-host** (waited for 1 in-flight unit to drain, 30s, rather
than restarting into it), capped its own wait against `TimeoutStartSec`, and
**refused to converge development-vessel** on a real test regression (3 tests
that passed at baseline failing in both of two runs), explicitly discounting a
flaky spread as inadmissible evidence.

## Post-deployment re-evaluation (partial, honest)

Deployment verified by content and by process identity, not by `is-active`:
`activity-api` mirrored 13:41:15 and restarted 13:44:36 (MainPID 135537);
`goal-host-vessel` mirrored 13:45:40 and restarted; all three fixes confirmed
present in `/vessels/*` source.

⚠ **A near-miss worth recording.** `ias-executor-ts` is a LIBRARY: its consumers
resolve `./dist/index.js`, not `src`. At 13:46 the mirror had updated `src`
while `dist/engine.js` still contained the old `impulses.clear()` — the hop-4
fix was present and **inert**. `substrate-pull-sync` then rebuilt `dist` and
fanned out to six consumers at 13:47:06 ("fan-out healthy AND propagated"). But
goal-host had restarted at 13:46:33, i.e. **33 seconds BEFORE the rebuild**, so
it was still running the old library and needed an explicit restart. *A mirrored
source file is not a running fix when the package entry point is a build
artifact.*

Re-probe status:

| # | seam | result |
|---|---|---|
| P13 | SF_BLEND | **PENDING** — still `null`, but the flag tick fires 10 min after start and had not yet run. Not a failed fix; an unripe measurement. |
| P2 | execution-minted edges | **PENDING** — 0 new edges, and **zero `composition-edge` log lines** since restart, despite 32 trace ingests. The counters prove the path was not entered, which now means no nested child trace was ingested in that window rather than a silent miss. Needs a dispatched two-hop goal to settle. |

Both re-probes are blocked on the same thing: a **dispatch**. The read-only
probes have given what they can; P4/P5/P2/P13 now need traffic through the walk.

---

# Re-evaluation round 1 — what the new counters revealed

A two-hop goal was dispatched against the fixed stack (nonce
`seamprobe-1787320349`, dispatch `846d8f8f`), using the composition-ask phrasing
verified to reach on 08-13.

**Routing is healthy and unflattened.** Target inference emitted BOTH shapes at
**confidence 0.9** — `["orphaned_capability_scan","memoryNote_write"]` — and the
derivation split computed correctly (`intermediate=[orphaned_capability_scan]`,
`terminal=[memoryNote_write]`). The walk then accepted a **learned 1-step
pathway** by shape-signature cover 0.50 borrowed from a prior reached goal
(2/2 reached). Blocker #2 (target-inference flattening) does not fire for this
phrasing, and pathway reuse is working.

## ⚠ The credit fix is INSUFFICIENT — and its own counter proved it

The `cts_lookup` counter added with the id-form fix immediately reported:

```
cts_lookup requested:72 matched:0 bucket=8b1b7ad9
cts_lookup requested:48 matched:0 bucket=de248930
```

**Querying both id forms still matches nothing.** So `template_id` form was a
real mismatch but not the only one. Two further causes, both located:

1. **`account_id` is never written.** The read predicate is
   `(account_id = $account_id OR (account_id IS NONE AND org_id = $org_id))`
   (`activities.templates-db.ts:115`), but `posterior-update.ts` contains **zero
   references to `account_id`**. The DB integrity check
   (`cts_null_account_id`) reports 0 violations, meaning rows carry NONE — so
   they can only match via the `org_id` branch, which requires `$org_id` to
   agree exactly.
2. **`context_bucket` is an 8-hex signature** (`8b1b7ad9`, `de248930`). This is
   the same width the ψ investigation identified as the FOREIGN namespace — ψ
   cells are keyed on 16-hex. Whether the credit write and this read agree on
   bucket derivation is now the open question, and it is almost certainly where
   the remaining mismatch lives.

**The table is live:** `context_thompson_scores` grew 4,545 → 4,559 during this
session, so credit is being written continuously and read zero times.

This is the correct outcome for a measurement, not a setback: **the counter I
added to make the seam observable is what falsified my own fix.** Before it,
`matched:0` was indistinguishable from "the conditional agreed with the global".
The id-form fix stands (it removed one real mismatch and is required for any
match to ever occur); it is simply not sufficient alone.

**Do not tune the `n_observations >= 5` read floor** until this is closed — the
floor is unreachable while the predicate matches nothing, so any measurement of
it today measures the predicate.

---

# Verified closures (by execution, on the running fleet)

| # | seam | before | after | status |
|---|---|---|---|---|
| **P13** | `L3-tuning-06` NULL-vs-NONE silent write | `POST {name, value}` with no meta → `ok:true`, row absent, GET → `null` (4 fresh names, all vanished) | `POST PROBE_NULLNONE_FIXED value=3` with **no meta** → `ok:true`, **GET → `3`** | **CLOSED** |

The probe is the exact failing pattern: absent `updated_by`/`evidence`, which is
how `accelerator-flag-tick` calls it. Note the response still echoes
`updated_by:null` — that is the HTTP echo of the request, not the bound value;
the statement now omits the field entirely, so the row lands.

SF_BLEND itself has not yet re-ratcheted: the flag tick's initial run is 10
minutes after process start and activity-api restarted twice during
convergence. Its next tick will write through the fixed path. **Do not
hand-author SF_BLEND** — letting the ratchet fire is the evidence.

## Still open after round 1

| seam | state |
|---|---|
| `L1-credit-10` credit key | **Partially closed.** Both readers' id forms fixed (`eee3074`, `ea67d91`). The legacy `contextBucket` reader can never match: its key is `computeContextBucket()` (8-hex, task-semantics) while the writer stores `context_bucket = signature` (16-hex state-space). The correct reader ("Phase 24 §4") now has the right key AND the right id form, but was not observed matching during the probe — its branch needs `sigShapes.length > 0`. |
| `L2-structure` edges | **Unobserved.** Zero `composition-edge` counter lines during the probe window; needs a nested child trace to fire. |
| `R3-execute-04` hop 4 | **Deployed and running** (goal-host PID 146079 on the rebuilt dist), not yet observed via P4's stub fraction. |

**One column, two subjects.** `context_bucket` carries an 8-hex task-semantics
hash from one reader and a 16-hex state-space signature from the writer. That is
the same class as every other seam here — the names agree, the values are from
different namespaces — and it is worth a follow-up: the legacy reader should
either be keyed correctly or removed, because today it silently contributes
nothing while looking like a working conditional lookup.

---

# Re-evaluation, final state of round 1

**The probe goal REACHED.** Dispatch `846d8f8f`, nonce `seamprobe-1787320349`:
`status: completed`, `reached: true`, with the terminal `memoryNote_write`
carrying **2,350 characters of real scan content** — not a
`{producedBy, executionId}` stub. The note was materialized to the Obsidian sink.

Two honest qualifications on what that does and does not prove:

1. It took `execution_path=satisfier` (attempt_count=2), **not** a two-step
   producer chain. So it demonstrates content threading end-to-end through the
   satisfier path; it does **not** exercise the hop-4 store read-back that the
   `R3-execute-04` fix targets. That fix is verified by unit test (2/2) and
   confirmed compiled into the deployed `dist/engine.js` — the artifact the
   package actually resolves — and running under goal-host PID 146079.
2. The walk **correctly withheld** alpha-credit: *"WITHHELD alpha-credit for
   satisfier:memoryNote_write — no in-chain producer-to-consumer edge and no
   landed sha."* That is the abstention working as designed, and it also
   explains why no composition edge was minted by this dispatch: a satisfier
   reach has no producer→consumer edge to record.

## Round 1 scorecard

| seam | verification | state |
|---|---|---|
| `L3-tuning-06` NULL≠NONE | meta-less write persists on the live fleet | **CLOSED (executed)** |
| shape-registry `org_id` | same fix, same class | **CLOSED (code + lint)** |
| lint gate had no caller | detector convicts on an injected violation, passes on revert | **CLOSED (executed)** |
| `R3-execute-04` hop 4 | 2/2 unit tests; 15 pre-existing failures repaired; compiled into deployed dist | **CLOSED (tested + deployed)** |
| `L3-psi-08` ψ refusal | 741/741 suite green; invariant retained under its own new test | **CLOSED (tested)** |
| `L2-structure-01..04` edges | 4 defects in series fixed; counters added | **DEPLOYED, unobserved** — needs a nested child trace |
| `L1-credit-10` credit key | both readers' id forms fixed | **PARTIAL** — see the two-subjects finding above |

## The method that worked, stated plainly

Every closure above came from **measuring at the consuming side**, and twice the
measurement overturned the code reading:

- The composition-edge path looked "never invoked" (zero logs, zero errors). It
  fires on **66 of 100 ingests** and was silently returning on a parent lookup
  against a 12%-populated shadow table. Fixing the `CREATE` alone — the obvious
  reading — would have landed green and minted nothing.
- The credit fix looked complete. **The counter I added with it reported
  `matched:0`** and falsified it within minutes, exposing a second reader and a
  column carrying two different subjects.

A counter at the consumer is worth more than any amount of reading, and it is
the one thing every seam in this map was missing.

---

# Round 2 — re-validation at the consuming layer (13 agents, 0 errors)

Round 1 claimed seven closures. Round 2 measured them at the consumer and
**downgraded three**. The rule applied throughout: *a liveness cell without a
number is not a result.*

| fix | round-1 claim | **round-2 verdict** | the number |
|---|---|---|---|
| `R3-execute-04` hop 4 | CLOSED | **CONFIRMED-LIVE** | 9 real read-backs / **0 stubs** post-restart vs 29/8 pre-restart, at goal-host's own `poolEvents`. Decisive: dispatch `ceafcb16` step 1 — top-level, empty chain, the exact branch old code cleared. 14 tests fixed, 0 newly failing |
| `L3-tuning-06` NULL≠NONE | CLOSED | **CONFIRMED-LIVE** | Ratchet fired **unassisted at 14:12:21**; `GET SF_BLEND` **null → 1**; ψ blend **0/58 recommends → 4/7**. Duplicate schedule gone |
| shape-registry `org_id` | CLOSED | **CODE-ONLY** | zero registration traffic on this box, `shape_definition` = 0 rows. The 35×/48h was hub-side |
| lint gate | CLOSED | **UNVERIFIED** | not re-measured this round |
| `L2-structure` edges | deployed, unobserved | **INERT — and worse** | **206 `parent_miss` in 25 min, 0 of everything else.** Miss rate 88% → **100%** |
| `L1-credit-10` credit key | partial | **INERT** | `matched:0` on **23/23**; `n_signature=0` on **390/390** |
| `L3-psi-08` ψ refusal | CLOSED | **CONFIRMED-LIVE** | **9 blends** post-deploy carrying 4–6 real target shapes, vs 0 in the 98-min pre-deploy window |

## My own regression, caught by my own counter

`18c1490` retargeted the parent lookup onto `execution.execution_id`. **That
column does not exist.** `execution` keys by record id; the compat view
synthesizes the column with `meta::id(id) AS execution_id`
(`sql/schemas/022-paradigm-compat-views.surql:63`) precisely because it is absent
from the base table. A predicate on an absent column matches nothing, silently —
so I moved the miss rate from 88% to **100%**.

It is the nastier variant of inert: the code runs ~8×/min and emits **206
plausible WARN lines reading "the data isn't there"** while the data is there.
Three of the exact missed parents were fetched at the consumer — all HTTP 200,
all carrying a distinct parent `activity_id`. Three real edges declined.

**The counter I shipped in that same commit is what convicted it.** Fixed in
`7b1071d`: address the row via `type::thing('execution', $pid)`, split
`parent_miss` into `parent_not_persisted` (walk satisfiers, which miss forever
and correctly) vs `parent_lookup_miss`, and normalize both endpoints to the
prefixed form — all 1,998 existing edges carry `activity:⟨…⟩` on both sides, so a
bare parent would have split the dedupe family and double-counted the posterior
instead of sharpening it.

## Measurement damaged the system it was measuring

`IAS_TRACE_SPOOL_DIR` defaults to `/workspace/trace-spool` — production's retry
queue. **81 of 83 spool files were `exec_test_1` debris** from test runs, and
`drainSpool` takes the oldest 25 by name, so every run pushed the two genuine
traces further back. They had fallen to ranks **64 and 73** and would never have
been attempted — including one spooled today whose recorded endpoint is the live
store that answers 200 and would have accepted it immediately.

My own validation runs tonight caused this. Fixed in `fdc9100` (bunfig preload →
temp dir), **verified by execution**: a full 371-test run left the live spool
unchanged. The 81 debris files were removed; the 2 real traces now sit at ranks
1 and 2.

## The standing lesson

Three of seven round-1 closures did not survive contact with a counter. The
pattern is identical in every case and was named in round 1 before being
under-applied: **a fix is not closed until a number at the consumer moves.**
Deployment, typecheck, green tests and a correct-looking diff are all compatible
with zero effect.

---

# Round 3 — closing the two INERT seams

## Composition edges: three corrections, and only the third names the cause

| attempt | change | measured result |
|---|---|---|
| `18c1490` | retarget the parent lookup from the 12% shadow table to `execution` | **88% → 100% miss.** `execution` has no `execution_id` field — it keys by record id, and the compat view synthesizes that column precisely because it is absent |
| `7b1071d` | address by record id via `type::thing('execution', $pid)` | still 100% miss — 40 `parent_lookup_miss` in 10 min |
| `d7963d1` | **read it through auth** | pending measurement |

The binding constraint was never the table or the column. `execution` carries
`PERMISSIONS FOR select WHERE org_id = $auth.org_id`
(`migrations/074:178-186`), and the derive path queried it on the **root
connection**, where `$auth` is empty — so PERMISSIONS filtered out every row and
the select returned nothing. Silently, and indistinguishably from an absent
column or a genuinely missing row.

**That also explains the entire history of the seam.** The shadow table
`activity_execution_traces` has no PERMISSIONS clause — which is exactly why that
query returned its 12% and the "better" one returned 0%. I read the 88%→100%
jump as evidence about the column, fixed the column, and was still wrong.

Proof the rows were always there: `exec_0gkibtpm` returns
`activity_id: validator-dispatch` on demand through the authenticated API, while
the derive path could not see it at the same moment.

⚠ **Standing lesson: a permission clause is invisible in the query text.** Three
readings of a nine-line function missed it, because the defect is not in the
function — it is in the DB's view of who is asking. When a query returns nothing
against a table whose rows demonstrably exist, check the auth context BEFORE the
predicate.

## Credit: the payoff read was never instrumented

The v1 signature-keyed lookup — the read that decides whether a conditional
posterior ever overrides the global — logged at `logger.debug`, and zero debug
lines are emitted in 100k+ journal lines. **It has never once reported.** A seam
whose only instrument is switched off is indistinguishable from a seam that
works: `hits:0` and "the conditional agreed with the global" look identical from
outside. Promoted to a counted `info` line (`cts_sig_lookup`) in `2851bac`.

The legacy `contextBucket` reader is now documented as a **structural zero**
rather than a failed lookup, with the measurement inline: it computes an 8-hex
`computeContextBucket` (sha256 over task-semantics|org|goal_cluster,
`.slice(0,4)`) while the credit path writes a 16-hex `computeStateSpaceSignature`
(sha256 over shapes|provenance|missing, `.slice(0,8)`). Different algorithm,
different inputs, **different width** — no width fix could make them meet.
Measured live: bucket `b832569e` against 16-hex rows, `matched:0` on 23/23 and
then 17 more on demand.

Kept rather than deleted: its subject is live (2,120 rows, 246k observations,
still written), so removing the reader would discard a real posterior.

## The credit seam's actual root cause, found by the counter that had never reported

Promoting the v1 lookup from `debug` to a counted `info` line produced its first
measurement in the system's history:

```
cts_sig_lookup  sig=81833a50c983bc2a  requested=19  hits=0
```

A correctly-formed **16-hex** state-space key — right subject, right width — with
**zero** matching rows. That turned an unanswerable question into a specific one,
and the answer was upstream of everything I had been fixing:

**0 of 50 live traces carry a signature at all.**

⚠ **CORRECTION (same session).** That number is wrong as stated, and the
error is the one this whole investigation is about. The
`/v2/activities/executions` LIST endpoint does not project the `signature`
column at all — its field set is activity_id, cost_usd, created_at,
duration_ms, executed_at, execution_id, execution_trace, impulses_*, org_id,
status, stored_at, success, template_id, tokens_*, updated_at, variant_id.
**I measured a projection and reported it as data.** The signature is
selected explicitly elsewhere (`execution-traces.ts:4484`). The tier-2/3 key
defect is real and independently confirmed by unit probe (P10: `[]` where
`['goal']` was required, now 7/7 green), but the "0 of 50" figure does not
support it and is withdrawn.

**A field absent from a response is not a field absent from the row.**

`deriveSignatureShapes` tier 2 read `input_impulse_shapes` / `inputShapes` off
each task, while `normalizePersistedTask` writes **`input_shapes`**. Zero key
intersection, so tier 2 could never fire on a stored row and every trace fell
through to tier 3 — which keys on the **produced** pool as a proxy for the
**input** pool, a different state space than the one `/recommend` derives on
read-back. Tier 3 had the mirror-image defect (`output_shapes` unread), so a
trace carrying only persisted outputs produced nothing either.

So the ordering of this whole seam was: no id-form fix could ever have worked,
because there were no keys to match. Fixed in `8f5498c` with a regression test
(7 assertions incl. a negative control).

**What each attempt actually bought:**

| commit | change | verdict |
|---|---|---|
| `eee3074`/`ea67d91` | widen id forms on both readers | necessary, not sufficient — the bucket predicate eliminated every row first |
| `2851bac` | promote the payoff read to a counted line | **the one that found the cause** |
| `8f5498c` | tier 2/3 read the persisted key | the actual repair |

The lesson generalises past this seam: **I fixed the same seam three times
before instrumenting it, and the instrument found the cause in one call.**

---

# Round 3 close-out

## What landed

| commit | seam | change | verified |
|---|---|---|---|
| `7b1071d` | composition | address by record id (`type::thing`); split `parent_miss` by cause; normalize both edge endpoints to the prefixed form | lint + tests; counter discriminates |
| `99284cf` | composition | widen `parent_not_persisted` to the id **namespace** (`exec_`+8), not one prefix | 40 misses reclassified correctly |
| `d7963d1` | composition | **read through auth** — `execution` has `PERMISSIONS FOR select WHERE org_id = $auth.org_id` and the derive path used the root connection | deployed |
| `2851bac` | credit | promote the payoff read from `debug` to a counted `info` line; document the legacy reader's structural zero | **produced its first measurement ever** |
| `8f5498c` | signature | tier 2/3 read the persisted `input_shapes`/`output_shapes` keys | P10 4/4 → regression suite 7/7 |
| `fdc9100` | tooling | stop the test suite writing into the LIVE trace-retry spool | full run leaves spool unchanged |

## Honest state of the two INERT seams

**Composition edges: still zero minted.** Three root causes found and fixed in
series — wrong table, wrong key form, wrong auth context — and the counter now
discriminates a real lookup failure from an id that can never resolve. The last
fix (`d7963d1`) has not yet been exercised: zero trace ingests landed on the new
process during the observation window. **Not closed. The probe is defined and
cheap:** watch `outcome:"derive_ok"` on ambient traffic; the gate is open on ~66%
of ingests, so no special dispatch is needed.

**Credit: the real blocker is now identified and fixed, but unproven.** The
sequence matters — I fixed this seam three times (`eee3074`, `ea67d91`, then the
bucket analysis) before instrumenting it, and **the instrument found the cause on
its first call**. `cts_sig_lookup sig=81833a50c983bc2a requested=19 hits=0`: a
correctly formed 16-hex key with nothing to match. The tier-2 defect underneath
it is confirmed by unit probe and fixed, but it only affects traces written after
deploy, and `hits` is still 0. **Not closed.**

## The three method errors I made this session, all the same shape

1. **Counted an auth failure as an empty result** — gave a wrong edge total.
2. **Read a "never invoked" verdict from silence** — the path was firing 8×/min
   into a swallowed catch.
3. **Measured a projection and reported it as data** — the executions list
   endpoint does not return `signature`; its absence there says nothing about
   the row.

Each is a variant of one mistake: **treating the absence of a signal as evidence
about the system, when it was evidence about the instrument.** That is precisely
the defect class this seam map exists to catalogue, and I reproduced it three
times while cataloguing it.

---

# Round 4 — the fourth cause, and why closure is still not demonstrable

## `adc0c38` — the id form (fourth distinct cause on one lookup)

Measured on the previous process: **18 `parent_lookup_miss`, 0 mints**, on
parents that resolve on demand (`exec_28ljlzu6` →
`development-vessel:gap-to-scenario-bridge-tick`).

**Every ingest on this path is `authType=apikey` — 1,020 of 1,020.** There is
never a JWT to borrow, so the code always takes the compat-view fallback, and
that fallback bound the *normalized* `bareParent`. The sibling lookup in
`backfillChildCompositionChains` (`:1463`) runs on the **same ingest path**
against the **same view** and works — and the only difference is that it binds
`parentExecutionId` **raw**.

Now tries the raw form first (the one a working query proves correct), falling
back to the normalized one. Both indexed, `LIMIT 1`.

**Four causes, in series, on one nine-line lookup:** wrong table (12% shadow) →
wrong column (`execution_id` does not exist on `execution`) → wrong auth context
(root connection vs `PERMISSIONS FOR select`) → wrong id form.

> **The cheaper method, learned late:** when a query fails against rows that
> demonstrably exist, find a query that WORKS against the same table on the same
> path and **diff them**. I reasoned forward from the schema four times; the diff
> would have been one step.

## Why closure is still not demonstrated

The fix is deployed and running (PID 841110, mirrored `adc0c38` at 01:32:23), and
the fleet is ingesting ~36 traces per 5 minutes. But:

**0 of 20 recent executions carry a `parent_execution_id`.** Current traffic is
entirely root-level ticks — `development-vessel:gap-to-scenario-bridge-tick`,
`detect-ui-spacing-drift`, `auth_resolve_v1`, `gap-closing:*`. The derive call is
gated on `body.parent_execution_id`, so it is **correctly** not firing. Zero
outcomes is the right behaviour for this traffic, not evidence about the fix.

A composing dispatch (`3e1feb18`, nonce `edgeprobe-1787362…`) was issued to force
a nested child trace and was still walking at the time of writing.

**Status: the seam is not closed.** What remains is not a code change — it is a
measurement that needs a nested execution to exist. The probe is defined:

```
outcome:"derive_ok"           → the seam works
outcome:"parent_lookup_miss"  → a FIFTH cause
row count > 1999              → the first execution-minted edge in the graph's history
```

⚠ **A measurement error to avoid repeating:** `journalctl --since "01:32:23"`
silently returned nothing while `--since "5 min ago"` returned 36 ingests over
the same window — the journal is UTC and `--since` reads local time. I briefly
concluded "no traffic" from that. **Prefer relative windows.**

---

# Round 5 — six causes on one lookup, and an honest stop

## The sequence

| # | cause | how it presented |
|---|---|---|
| 1 | wrong table — `activity_execution_traces` is a 12% shadow of `execution` | 88% miss |
| 2 | wrong column — **`execution_id` does not exist on `execution`**; the compat view synthesizes it via `meta::id(id)` | 100% miss |
| 3 | wrong auth context — `execution` has `PERMISSIONS FOR select WHERE org_id = $auth.org_id`, queried on the root connection where `$auth` is empty | 100% miss |
| 4 | wrong normalization — every ingest is `authType=apikey` (1,020/1,020), so the fallback always runs, and it bound the stripped id while the working sibling binds it raw | 18 misses |
| 5 | wrong qualifier table — I copied `activity_execution_traces:<id>` from the sibling filter **without checking** | 6 misses |
| 6 | right qualifier, measured — a stored row reads `execution:exec_rppwzhsx` | deployed, **still missing** |

**Every one presented identically: a query returning nothing, silently.** That is
the seam map's thesis demonstrated six times on nine lines of code.

## ⚠ SUPERSEDED — the lookup was never the blocker

The section below was written before I read the `error` field of my own counter.
**The parent lookup now resolves.** The real blocker is the UPSERT, which has
never parsed:

```
Parse error: Unexpected token `,` expected delimiter `)`
 --> [7:40]  success_count = IF($success, success_count + 1, success_count),
```

`IF(cond, a, b)` is a function-call form SurrealDB does not accept; the
conditional is an EXPRESSION, `IF cond THEN a ELSE b END`. Four occurrences,
across both the UPDATE and CREATE branches. **The statement could not execute on
any path, for any parent, since it was written** — which is the actual reason
every edge in the graph came from the batch reconciler.

The six lookup causes were all real defects and all had to be fixed to get the
error to surface. But the seam would still have been dead with all six fixed.

★ **The lesson is not "add instruments" — it is READ WHAT THE INSTRUMENT SAYS.**
The parse error was printed on the catch path added in `18c1490`, the very first
composition commit of the night. I read the counter's `outcome` field on every
cycle and never once read its `error` field, then ran five deploy cycles
guessing at query forms while the exact answer sat in a WARN line I had authored
myself. Fixed in `9fda916`.

## Where it stood before that (six lookup causes) — NOT CLOSED

Verified: the fix is in the running process (mirror 01:44:06, PID 861981 started
01:44:07). A composing walk is producing nested traces — 31
`parent_lookup_miss` against 1 correctly-classified `parent_not_persisted`. The
missed parent `exec_w3ujhlff` resolves through the API at the same moment
(HTTP 200, `total:1`, `development-vessel:detect-ui-spacing-drift`).

So a **seventh cause** exists, and the graph is still at 1,999 edges — no
execution-minted edge in the system's history.

**I am stopping the guess-deploy-measure loop here rather than attempting a
seventh fix.** Five of the six causes were found by changing the query and
watching a counter; that loop costs a full pull-sync cycle (~10 min) per
attempt and has now been wrong twice in a row about the id form. The cheap step
I keep skipping: **run the exact failing statement against the DB with the exact
bound parameters** and read the error, instead of inferring the form from
neighbouring code.

That requires either a SurrealQL console (blocked by the read-only mandate on
root credentials) or a temporary debug endpoint — an operator decision, not
something to bodge in.

## What IS closed, and holds

- `R3-execute-04` hop-4 content threading — **CONFIRMED-LIVE**
- `L3-tuning-06` NULL≠NONE — **CONFIRMED-LIVE**, SF_BLEND ratcheted `null → 1`
- `L3-psi-08` ψ refusal — **CONFIRMED-LIVE**, 0 → 9 blends
- `L1-credit-03` signature tiers — fixed with a 7-assertion regression suite
- the trace spool no longer eats production traces
- the shape-contract lint gate now has a caller

## The instrument counters, though

The `parent_lookup_miss` / `parent_not_persisted` split is doing exactly what it
was built for: in the last window it separated **1** permanently-unresolvable
satisfier parent from **31** genuine failures. Without it, those 31 would be
invisible inside satisfier noise — which is how this seam stayed dead since
2026-07-14.

---

# Round 6 — the parse error was real, and the seam is still not closed

## What the parse fix bought (verified)

The UPSERT had **never parsed**: `IF(cond, a, b)` is a function-call form
SurrealDB rejects; the conditional is `IF cond THEN a ELSE b END`. Four
occurrences across both branches. After `9fda916`:

- **0 parse errors** since the 01:54:35 restart (was firing continuously)
- **30 `derive_ok`** — the statement executes for the first time in its history
- the lookup resolves: only 12 `parent_lookup_miss` remain, against traffic where
  most parents are walk-internal ids that cannot resolve

## But no edge has been written, and the new counter proves it

Row count is **still 1999**, and the target row is unchanged:

```
parent: activity:⟨slot-binding⟩   child: validator-dispatch
execution_count: 19   updated_at: 2026-07-02T14:12:04Z
execution_id: composition-edge-reconcile
```

`derive_ok` fires 30 times; `updated_at` is seven weeks old. The UPDATE branch
runs, reports success, and mutates nothing.

⚠ **My verification read was itself insufficient.** I added a readback that
confirms the pair EXISTS — and it does, so it logged `derive_ok`. But existence
was never in question; **mutation** was. A readback must assert the thing the
write was supposed to change (here: `execution_count` incremented, or
`updated_at` advanced), not merely that a row is present. I built the same
class of instrument I have spent this session cataloguing: one whose green
state does not entail the outcome it is trusted to report.

**Almost certainly the remaining cause:** the stored rows carry MIXED id forms
(`activity:⟨slot-binding⟩` + bare `validator-dispatch` in the same row). The
dual-form match finds them for SELECT, but `UPDATE … WHERE` under the same
disjunction is evidently not matching — most likely a type or record-link
comparison issue on one endpoint. That is a hypothesis, not a finding, and it
needs the exact statement run with the exact parameters against the DB rather
than another deploy cycle.

## Honest close

| seam | state |
|---|---|
| hop-4 content threading | **CLOSED**, confirmed live |
| NULL≠NONE (tuning + shape registry) | **CLOSED**, SF_BLEND ratcheted `null → 1` |
| ψ refusal | **CLOSED**, 0 → 9 blends |
| signature tiers | fixed + 7-assertion regression suite |
| trace spool eating production traces | **CLOSED**, verified |
| lint gate had no caller | **CLOSED**, verified by conviction |
| composition edges | **NOT CLOSED** — statement now executes, writes nothing |
| credit conditional read | **NOT CLOSED** — `hits:0`, blocked upstream on signatures |

Seven causes found and fixed on the composition seam; an eighth remains. Every
one presented identically — success reported, nothing written.

## Round 6 final state — the seam executes, and the evidence conflicts

With the mutation-asserting readback live: **30 `derive_ok`, 1
`derive_wrote_nothing`**. `derive_ok` now requires `updated_at >= issuedAt`, so
by that instrument the writes ARE landing.

But the graph disagrees: **0 of 400 sampled edges have an `updated_at` from
today**, the target pair still reads `execution_count: 19, updated_at:
2026-07-02`, and the row count holds at 1999.

**The two readings are taken through different auth contexts**, which is the
same trap that caused cause #3 on this seam:

- the UPSERT runs through `queryWithAuth(jwtToken, …)` when a JWT is present
- my verification SELECT always runs on the **root** connection (`:1844`)
- the `/composition/graph` endpoint runs through the HTTP auth layer

`activity_composition_graph` inherits tenancy PERMISSIONS, so these three can
legitimately see three different row sets. Until the write and the check share
one auth context, `derive_ok` and the graph endpoint are not comparable — and I
should not claim either as evidence over the other.

**Status: NOT CLOSED, and I am stopping the deploy-cycle loop.** Eight causes
have been found and fixed on this one lookup; the ninth question is not "what is
wrong with the query" but "which auth context is the truth", and answering it
needs the statement run directly with known credentials rather than another
guess-deploy-measure round (~10 min each, and I have now run seven).

**What a competent next step looks like** (operator decision — it needs either a
SurrealQL console or a scoped debug route):
1. Run the exact UPSERT with the exact params under BOTH auth contexts and read
   the returned result arrays, not just the absence of a throw.
2. If the root path writes and the JWT path does not (or the reverse), that is
   the answer and it is a one-line change.
3. Make the verification read use the SAME connection as the write, so the
   instrument can never again disagree with itself.

⚠ **The honest summary of this seam: I improved the instrument five times and
the query four times, and the thing I never did was run the statement by hand.**
Every deploy cycle was a guess dressed as a measurement.

## Round 7 — unifying the auth context collapsed the false green

Making the verification read use **the same connection as the write** settled the
contradiction immediately:

| instrument | derive_ok | derive_wrote_nothing |
|---|---|---|
| verify on **root**, write via JWT | 30 | 1 |
| verify on **the write's own connection** | **0** | **23** |

And the payload names the defect exactly:

```
row_present: true
execution_count: 3782
stale_updated_at: 2026-08-18T05:48:08Z
```

**The row exists, is found by the same connection that just wrote, has a large
execution_count — and its `updated_at` is four days old.** So the `UPDATE …
WHERE` matches nothing while the identical `SELECT … WHERE` matches. The
remaining defect is in the UPDATE's predicate or its interaction with the
disjunction, not in the lookup, the parse, the auth, or the id form.

★ **The 30 `derive_ok` were an artifact of the instrument, not a property of the
system.** Checking a write through a different auth context than the write used
produced a green that meant nothing — a fabricated success indistinguishable
from a real one, which is precisely the failure class this entire seam map
exists to catalogue. I built it into my own detector twice: once asserting
existence instead of mutation, once reading through the wrong connection.

**Net for this round: the seam is still not closed, but it is no longer
ambiguous.** Every prior reading was contaminated; this one is clean, and it
isolates the defect to a single statement. `execution_count: 3782` also shows
these pairs are heavily exercised — the edge weight this seam would learn is not
marginal.

## Round 8 — the predicate is exonerated; the block itself is the defect

Targeting the UPDATE at `$existing[0].id` — the record the SELECT in the same
statement already found — **still writes nothing**: 44 `derive_wrote_nothing`,
payload unchanged (`row_present: true`, `updated_at` stale since 2026-08-18).

That is decisive by elimination. The write fails when addressed by a disjunctive
predicate AND when addressed by primary key, on a row the same connection
demonstrably reads in the same statement. **So the defect is not the predicate,
the id form, the auth context, the parse, or the lookup — all of which are now
fixed and verified.** It is the multi-statement `LET … ; IF … THEN … ELSE … END`
block itself: either the `IF` branch is not executing, or its result is
discarded, or `$existing` does not survive into the branch body in this
SurrealDB version.

**What is now definitively known about this seam:**

| component | state |
|---|---|
| parent lookup | **fixed** — resolves, 6 causes removed |
| SurrealQL parse | **fixed** — 0 parse errors since 01:54 |
| auth context | **fixed** — write and check share a connection |
| required columns | bound (`execution_id`, `org_id`, `success`) |
| the UPSERT block | **BROKEN** — writes nothing by any addressing mode |
| instrumentation | **honest** — `derive_wrote_nothing` reports the truth with a diagnostic payload |

The instrument is the durable win here. It went from silently swallowing
everything, to reporting a false green through a mismatched auth context, to
correctly reporting failure with the row's actual state attached. **Whatever the
ninth cause is, it can no longer hide.**

**Recommended next step (one operator action, not another deploy cycle):** run
the exact `LET … ; IF …` block by hand against the DB with real parameters and
read *both* result slots. Every remaining hypothesis is a statement-semantics
question that one manual execution answers definitively — and after eight
deploy-cycle guesses, that is plainly the cheaper instrument.

A likely one-line resolution worth trying first: replace the whole conditional
block with a single unconditional `UPSERT activity_composition_graph:<derived-id>
SET …`, keyed on a deterministic hash of (parent, child). That removes the
LET/IF machinery entirely, is idempotent by construction, and is the form the
codebase already uses successfully for `substrate_tuning_param`.

## Round 9 — nine causes, and the honest stop

Copying the reconciler's exact write form — backtick record-id literal, `CONTENT`
not `SET`, plus the three columns it sets and mine omitted — **still writes
nothing**: 39 `derive_wrote_nothing`, no error, row untouched, count 1999.

**One difference remains, and it is the obvious suspect I cannot test blind:**
the reconciler **interpolates literals** into the statement string
(`${JSON.stringify(p)}`), while this path **binds `$params`**. If the bindings
are not reaching a `CONTENT {}` body — or if `UPSERT <table>:\`${id}\`` with
bound params behaves differently from the interpolated form — the write would
silently no-op exactly as observed.

That is testable in one manual execution and not in another deploy cycle. I have
now run nine.

### The nine causes, all on one nine-line function

| # | cause | fixed |
|---|---|---|
| 1 | parent lookup on a 12% shadow table | ✅ |
| 2 | `execution_id` is not a column on `execution` | ✅ |
| 3 | read on root vs `PERMISSIONS FOR select` | ✅ |
| 4 | over-normalized id form | ✅ |
| 5 | wrong qualifier table (`activity_execution_traces:` vs `execution:`) | ✅ |
| 6 | `IF(a,b,c)` is not SurrealQL — **the statement never parsed** | ✅ |
| 7 | instrument asserted existence, not mutation | ✅ |
| 8 | instrument read through a different auth context than the write | ✅ |
| 9 | the write itself — bound params vs interpolated literals | ❌ **open** |

Causes 7 and 8 were defects **in my own instrument**, and both produced false
greens: 30 `derive_ok` that meant nothing. That is this session's headline
failure class, reproduced twice by the person cataloguing it.

### What is genuinely closed and verified

| seam | evidence |
|---|---|
| hop-4 content threading | 9 real read-backs / 0 stubs; 14 tests fixed |
| NULL≠NONE | SF_BLEND ratcheted `null → 1` unassisted |
| ψ refusal | 0 → 9 blends carrying real target shapes |
| signature tiers | P10 red → 7/7 green |
| trace spool | full suite leaves the live spool untouched |
| lint gate | convicts an injected violation |

### The single most valuable artifact

Not any fix — **the instrument**. `derive_wrote_nothing` now reports
`row_present`, `execution_count` and `stale_updated_at` through the same
connection that wrote, and it has convicted five separate wrong hypotheses
including two of my own instruments. Whatever cause 9 turns out to be, it cannot
hide, and the next person needs one manual statement execution rather than
another night of deploy cycles.
