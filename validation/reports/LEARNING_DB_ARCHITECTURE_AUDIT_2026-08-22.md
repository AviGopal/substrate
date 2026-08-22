# Learning mechanism, database, and architecture — full audit

**Scope.** The learning loop in three planes at once: **code** (what the source
says), **traces** (what the live substrate actually did), and **intent** (what
CLAUDE.md's laws and the execution expectation promise). The question behind all
of it: *what is preventing growth?*

**Method.** A 96-table row census on the live local `substrate-live` container is
the spine; every claim is anchored to a runnable read-only probe. Produced by an
11-agent audit plus direct probing.

> **STATUS — this revision is PRE-VERIFICATION.** The adversarial pass has not
> run yet, and two of the eleven agents (including the one scoped to attribution)
> have not reported. Findings below carry the confidence their originating agent
> assigned, upgraded only where **I re-ran the probe myself** — those are marked
> *(replicated)*. Treat everything else as single-source. A follow-up revision
> will carry the verify verdicts and any retractions.

**Access.** Local container only. DB reads went through a helper that refuses any
statement not beginning `SELECT`/`INFO`. No remote host was contacted, no
credential extracted — a prior run of this investigation was correctly blocked for
embedding a key-extraction recipe, and that pattern was not rebuilt.

**Tree provenance.** Static claims are against `origin/dev` of each submodule
(`git -C repos/<x> grep origin/dev`), not the dirty local worktrees. activity-api
is at `3fdb2b2`, verified equal to the container's own checkout. Runtime claims
are against `substrate-live` (booted 2026-08-21T12:24 UTC).

---

## The one-line finding

**Nothing the system does ever becomes something it knows.** The ribosome — the
only mechanism that converts a successful execution into reusable structure, and
the origin law 4 reserves for activities — is *running hard and landing nothing*.
Its entire recorded output is **two empty templates**, both named
`extracted-validator-dispatch`, written 22 seconds apart on 2026-07-22, extracted
from executions with `successRate: 0`, carrying `tasks: []` and `impulses: []`,
into a table with **zero readers**.

Minting continues unchecked from the other direction: **1.2% of activities carry
execution provenance, 51% were minted by the gap-closing path**, and **76% of
non-retired activities sit in a duplicate input/output shape family**. The corpus
is not made of things that worked — it is made of things that were proposed.

And because `activity.ev` is identically `0.5` on every one of 3,856 rows, the
candidate prefilter that feeds Thompson collapses to **pure recency**, showing the
selector the newest unearned arms first.

```
  extraction lands nothing  →  no earned pathways enter the corpus
            ↑                                    ↓
  posterior never concentrates  ←  prefilter shows newest-minted arms first
            ↑                                    ↓
     evidence splits 76% ways  ←  uncontrolled minting fills the gap
```

---

## The root cause, traced end to end

Three sequential blockers, each verified with a positive control, **each alone
sufficient** — so fixing only one changes nothing.

### Blocker 1 — 69% of executions never receive a reach tag

The ribosome correctly refuses to extract from an execution it cannot confirm was
honestly reached (law 4). Over 6 hours of live logs it re-read 531 verdicts:

```
    364  verdict=ungraded      (no-reach-tag, after 5 attempts)
    127  verdict=not-reached
     40  verdict=reached
    491  "extraction SKIPPED (not honestly reached)"   = 364 + 127 exactly
```

The gate works as designed and is starving. `event_success=true` executions come
back `ungraded`, so the reach verdict is not landing on the execution record.
Independently corroborated on the goal-shaped slice: **52 of 283 goal executions
(18%) carry no reach verdict at all.**

### Blocker 2 — 88% of attempted extractions come back hollow

The 40 that pass the gate get `extraction ALLOWED` → `Dispatching
ribosome-extract` → `dispatchId`. Those dispatches land as:

| status | reached | n |
|---|---|---|
| success | **false** | **90** |
| success | true | 10 |
| success | null | 1 |
| failure | null | 1 |

**101 of 102 carry a `failure_mode` while reporting `status: 'success'`.** The
sampled row holds `failure_mode: {type: 'execution_error'}`, `status: 'success'`,
`success: True`, `reached: False` simultaneously. Because dashboards grade on
`status`, the substrate sees 101 successes.

*Positive control:* `reached = true` occurs 113 times fleet-wide and 10 times for
`ribosome-extract` itself, so `reached: false` is a real verdict, not an absence.

### Blocker 3 — even the 10 that reached minted nothing

`ribosome-extract` declares `output_impulse_shapes:
['executionTraceWithSignatures']` — it emits a *description of the trace*, not a
template.

And a one-character name difference splits the extraction path in half:

| table | writers | readers | rows |
|---|---|---|---|
| `activity_templates` (plural) | 1 (`ribosome.ts:608 INSERT INTO`) | **0** | 2 |
| `activity_template` (singular) | **0** | 6 | 0 |

Extraction output falls into a write-only table; six consumers starve on a
write-never one. An agent reports a measured cost of **6,928 of 6,928 posterior
updates degrading to unweighted** because the shape-weighted credit path reads
`activity_template`. *Single-source — I have not replicated that count.* What I
did confirm directly is the shape of the defect: `paradigm.ts:902` reads `FROM
activity_template` and its transform hardcodes `input_shapes: []` with the comment
"Legacy templates don't have shapes", so anything routed through that path is
shape-blind by construction regardless of the table's emptiness.

**Supporting law-1 violation.** The ribosome logs `WARN extractionPolicy
unresolved — falling back to maxExtractionDepth 1` and `WARN
extractionEligibilityPolicy unresolved — falling back to literal
[validator-dispatch, slot-binding]; three further lifecycle meta-templates exist
unlisted`. Both policies are shapes that do not resolve, so extraction depth is
hard-capped at 1 and eligibility is an in-process constant naming 2 of 5
candidates — unobservable and unlearnable.

**Not a dark vessel.** ribosome-vessel is enabled, `active`, `NRestarts=0`, and
dispatches ~96 extractions/24h — *above* its own code-declared starvation floor of
25/6h. The tier is not idle; it is spinning. What is dark is the landing.

**Highest-leverage fix, in order:** land the reach verdict on the execution record
(unblocks 69% of candidates); make `ribosome-extract` emit a template shape and
fail loudly when it does not reach; reconcile `activity_templates` /
`activity_template` onto one name.

---

## Findings by growth impact

### Blocks growth

| Finding | Evidence |
|---|---|
| Extraction lands nothing (blockers 1–3 above) | 2 empty templates ever; 90/102 hollow; 0 readers |
| `activity.ev` identically `0.5` on 3,856/3,856 rows → prefilter is pure recency | `discover-by-shapes.ts:235` `ORDER BY ev DESC, created_at DESC`, truncated **before** the Thompson draw |
| Only 1.2% of activities carry execution provenance; 51% minted by gap-closing | law 4 inverted at the source |
| A credential-failure storm flushed the trace store | 142,882 failed auth rows, 133,622 older than 24h, against ~2-day retention |
| Goal walks are a rounding error in the corpus | 283 of 150,056 executions (0.19%) carry a `goal` input shape |
| **`validator-dispatch` is a 5-task template that runs one task** — see below | 4,796/4,796, positive control clean *(replicated)* |
| Learning-track classifier reads `trace_digest` under a key its writers never use | `learning_track = 'unclassified'` on **3,856/3,856**; `execution_system_traces` can never receive a row |
| Promote gate is a rubber stamp | 6,324/7,652 `auto_promote`; projection fires 0.56%; **one** quality refusal ever |
| `shape_gap_resolution` has no writer; its one reader task is skipped ~94% | gap-resolution cache permanently cold |
| `code_modification_proposal` has writer, reader, registry shape and an activity arm — and zero rows | complete wiring, no flow |
| `queryWithAuth` pooled branch discards its own `sql` | **latent** — `DB_POOL_ENABLED` absent from `/proc/992491/environ` |
| Law 7's gap triple is not computed anywhere | live: 92% of gaps open, 23% recurrence |
| ≥8 behavioral env gates in goal-host unset and unreachable | law 1 |

### `validator-dispatch` executes one of its five tasks — and it is what the ribosome extracts from

An agent reported `learning_signal_write` skipped in 4,731/4,731 executions. That
did not replicate from the journal (2 mentions in 24h, both shape names rather
than skip events), so it was re-derived from the trace records instead — where it
is confirmed and larger than reported.

Every `validator-dispatch` execution carries five tasks. Across **all 4,796** in
the window:

| # | task | executions with `duration_ms > 0` |
|---|---|---|
| 1 | Find activities that can validate the just-completed work | 2,890 |
| 2 | Reshape the discovery result | **0** |
| 3 | **Execute the chosen validator activity** | **0** |
| 4 | Handle the dispatched validator's emissions | **0** |
| 5 | **Record per-task learning signals** | **0** |

*Positive control:* task 1 shows 2,890 non-zero durations, so the `duration_ms >
0` predicate works and the zeros are real absences, not a broken filter. Task 5
is 4,796/4,796 at zero with no exceptions.

So the template **never executes a validator and never records a learning
signal** — it performs discovery and stops, and reports success. This matters
doubly because `validator-dispatch` is one of only **two** templates on the
ribosome's hardcoded eligibility list (blocker 3 above). The thing the extraction
tier is permitted to learn from is a five-step behaviour that performs one step.

### Degrades growth

`routing_trace` — both writers unreachable, three readers consuming, and **the
health scorer silently defaults to full routing credit** when it finds nothing: a
dead channel that grades itself perfect. · **76% of non-retired activities (2,011
of 2,639) sit in a duplicate input/output shape family** — the law-3 violation
measured by signature rather than by name. · `tool_usage` / `tool_usage_patterns`
/ `tool_argument_pattern` — a three-way write≠read split, plus a reader filtering
on three fields the SCHEMAFULL table does not define. · `execution_exemplar` — a
live reader with both writer triggers structurally unable to fire. ·
`activity_metrics` is a phantom table read by the only Thompson-scores
observability endpoint. · `circuit_breaker_trace` — writer and reader agree on the
table and disagree on every field. · The `activity` posterior/counter columns are
dead schema: `thompson_alpha/beta` 1.0/1.0, `total_executions` 0, on all 3,856
rows (the live plane is `variant_performance_metrics`, 1,638 moved posteriors). ·
Law 5: boredom is a genuine condition-driven selector, but its rhythm input is
dead at the consumer, and ~14 substrate-work timers run on hardcoded cadences.

### Wasted work (complete, unwired machinery)

`execution_sequences`, `execution_state_snapshot`, `relevance_feedback`,
`impulse_usage_history`, `composite_sequence_patterns`, `execution_pattern` — each
has a writer, or a reader, or an HTTP route, and in several cases all three, with
nothing connecting them. `discovered_state_pattern` and the state-pattern-learner
have zero non-test importers. Migration 173 claims `execution_sequences` is "wired
and kept"; both ends are unwired.

---

## The execution expectation, measured

CLAUDE.md states ~90% reach "regardless of priors." The honest number depends
entirely on the denominator, and four defensible queries give four answers:

| denominator | reach | note |
|---|---|---|
| all executions with a verdict | **0.08%** | 143,143 of them are failed-auth rows — meaningless |
| excluding `auth_resolve_v1` | **37.0%** | 113 reached / 305 graded *(replicated)* |
| goal-shaped executions only | **42.4%** | 98 reached / 231 graded, 52 ungraded *(replicated)* |

**37–42% is the honest figure** against a stated ~90%. Two caveats that must
travel with it:

1. **This is a ~2-day window, not a cumulative rate.** `execution` is
   retention-pruned (oldest row 2026-08-20). Anyone quoting 37–42% as a lifetime
   figure is making exactly the error this section warns about. A separate agent
   reported 17.0% "cumulative"; its denominator is not stated in what it returned,
   so that number is omitted here rather than reproduced — it is not reconcilable
   with the windowed figures above without knowing what it divided by.
2. **Report the denominator whenever quoting any of these.** The 0.08% and the
   stated 90% are not measuring the same population.

*Note on goal-walk volume:* this audit measures 283 goal-shaped executions by
`'goal' IN input_impulse_shapes`; an agent reported 88 using a narrower
definition it did not spell out. Both are a rounding error against 150,056, which
is the load-bearing point; the discrepancy is a definitional one and is left
unresolved rather than papered over.

**Tier by tier:**

- **Floor (ReAct parity):** reached, but at 37–42%, not the stated ~90%.
- **Ceiling (learned pathway):** *fires.* 17 accepted reuses carry a cover value —
  14 at `cover=1.00`, 3 at `cover=0.50`. But every accept borrows from a **single**
  goal hash (`723a0e8705f734ab`) on a **1/1** record. The mechanism works; the
  corpus is one pathway.
- **Middle (first/last-mile adaptation):** **zero occurrences** of any first-mile
  or last-mile marker in the entire goal-host journal. Reuse lineage is logged and
  deliberately not persisted, so "does the ceiling beat the floor" is unanswerable
  from the trace record. This is the tier by which learning compounds, and it has
  never been observed to fire.

---

## Checked and cleared — things that look like defects and are not

Recorded because each cost real probe time, and because several would otherwise
have been filed with confidence.

**`activity_execution_traces` frozen 39 days.** 18,135 rows, no write since
2026-07-14, while every other learning table is fresh today. This is a
**documented, intentional decommission**: `execution` became the sole trace store
in July 2026, the shadow INSERT is gated on `DUAL_WRITE_ENABLED` which defaults
off *specifically* so the decommission survives an image rebuild
(`paradigm.ts:25`), and the only live `FROM activity_execution_traces` reads are
in the retention path that deletes from it (`impulses.ts:3755-3782`).

**`boredom-vessel.timer` shows `NextElapse=infinity`** — a known deadlock
signature. It is not one: the service is `Type=simple` running a live selection
loop (`MainPID=20597`, actively reserving and completing ticks). The timer is
vestigial. `m1-trainer.timer` has the same shape and cycles normally at
`NRestarts=0`.

**`activity.thompson_alpha` frozen at Beta(1,1) on all 3,856 rows** reads as a
dead learning loop until you ask what a *moved* posterior looks like:
`variant_performance_metrics` has 1,638 of 3,349 above the prior, and every reader
in the codebase reads that table. Dead schema, not a dead loop.

**The gradability gate** is exonerated by its own stated rollback criterion — it
is not what is blocking extraction.

**Extracted activities *are* selected when they exist** — the break is extraction
volume, not selection bias against extracted arms.

**Four populated tables carry `PERMISSIONS NONE`** (`activity_execution_traces`,
`impulse_relevance_metrics`, `goal_execution_paths`,
`activity_composition_graph`; 44,566 rows) against 52 tables that carry
`$auth.org_id` clauses. Vessels connect as root through `surrealDB.query`, so
these clauses are not the enforcement path in either direction. Noted, not filed.

**`goal_execution_paths` dual counter planes** (1,661/8,030 disagree; 456 rows
report `success_rate: 0` with a Thompson α showing successes) is already known and
already handled: self-healing rewrite at `posterior-update.ts:922`, a regression
test naming the exact defect (`proven-failing-paths.test.ts:71`), every call site
passing `min_success_rate: 0`, and the consumer reading the counter plane instead.

**A stale comment.** `activities.ts:3805` asserts *"`activity` is a VIEW over
`activity_template`"*. The live schema says `DEFINE TABLE activity TYPE NORMAL
SCHEMAFULL`. The code is correct; its stated reasoning is not.

---

## Method notes

**Three phantom-column reads.** Three queries returned clean, confident,
meaningless answers by naming columns that do not exist: `reached` on
`goal_execution_paths` ("8,030 nulls"), `template_id` on `thompson_selection_log`
("1 distinct template" — the column is `activity_id`; the true figure is 817), and
`created_at` on `thompson_selection_log` (an apparent month-long freeze — the
column is `selected_at`; logging is live at 1,327 selections/24h). SurrealDB
returns `NULL` for an absent column rather than erroring, so a typo and a genuine
absence are indistinguishable. **Read one full row before trusting any aggregate
over a named field.** The third nearly shipped as a headline claiming selection
had stopped a month ago.

**A retention window is not a history.** `execution` is pruned to ~2 days (oldest
row 2026-08-20). "152 distinct activities have executed" is a 19-hour statement,
not a system-history one. Corpus-coverage figures here are drawn from durable
tables for that reason.

**`GROUP BY x ORDER BY count DESC LIMIT n` silently drops groups.** Every headline
ratio in this report was recomputed with a direct unlimited `count()`; the 95.27%
auth share was confirmed that way (142,951 / 150,056), not read off a top-N.

**Two agents' findings appeared to contradict each other and both were right.**
One reported pathway reuse firing; another reported the middle tier firing zero
times. They were measuring different tiers — exact whole-pathway cover fires 17
times, first/last-mile adaptation has never fired. The reconciliation was worth
more than either claim alone.

**One agent corrected the audit's own premise.** The brief asserted the extraction
tier was dark. It is not — the vessel is healthy and dispatching above its
starvation floor. Only the *landing* is dark, which is a different defect with a
different fix.
