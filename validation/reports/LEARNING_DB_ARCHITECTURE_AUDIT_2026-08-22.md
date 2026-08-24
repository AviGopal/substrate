# Learning mechanism, database, and architecture — full audit

**Scope.** The learning loop in three planes at once: **code** (what the source
says), **traces** (what the live substrate actually did), and **intent** (what
CLAUDE.md's laws and the execution expectation promise). The question behind all
of it: *what is preventing growth?*

**Method.** A 96-table row census on the live local `substrate-live` container is
the spine; every claim is anchored to a runnable read-only probe. Produced by an
11-agent audit plus direct probing.

> **STATUS — POST-VERIFICATION.** All eleven agents reported and the adversarial
> pass ran over the growth-impacting findings; **six of seven came back partially
> or fully refuted** and are recorded as such below, including one that forced the
> headline to be rewritten. Findings marked *(replicated)* are ones I re-ran
> myself. Anything still labelled single-source has not been independently
> reproduced and should be treated accordingly.

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

> **CORRECTED.** An earlier revision of this report led with "nothing the system
> does ever becomes something it knows," built on the two dead rows in
> `activity_templates`. **That was wrong**, and the adversarial pass caught it.
> `activity_templates` is a legacy sink on `POST /v2/ribosome/extract`, untouched
> since 2026-04-02. The live extraction path mints `learned-*` rows into the real
> `activity` table. I re-ran every number myself: **427 learned activities exist,
> 100 of them carry moved posteriors, and 36 executed in the window.** Extraction
> works, is selected, and is graded. The corrected finding below is narrower,
> dated, and considerably more actionable.

**The credit the substrate earns is not the credit it draws on.** Outcome→arm
credit *does* land — that is settled, and the proof is in the store itself:
`variant_performance_metrics` holds credit-weighted posteriors like `α=493.83,
β=897.23`, roughly 1,391 observations accumulated on a single arm. The learning
machinery works. Two specific joins are severed around it.

**1. The sampler draws on numbers that disagree with the stored posterior for the
same arm.** Compared on *matched* arms — not two arbitrary samples, which is how
this was first measured and was wrong:

| arm | sampler logged | stored in `variant_performance_metrics` |
|---|---|---|
| `detect-vessel-code-drift` | α=4.0, β=1.0 | **α=23.76, β=10.86** |
| `operator-mcp-isomorphism-probe` | α=4.0, β=1.0 | **α=21.62, β=18.22** |

The disagreement is systematic and **optimistic in one direction: β is pinned at
1.0**, discarding accumulated failure evidence. An arm the store rates at 0.54
(α=21.62/β=18.22) is drawn at 0.80. **5,979 of 26,529 selections (22.5%) logged
the exact neutral prior α=1, β=1.**

*Mechanism undetermined.* `discover-by-shapes.ts:261` **does** read
`variant_performance_metrics` and **does** wire it into the draw
(`thompson_alpha = score?.thompson_alpha ?? score?.alpha ?? 1`), so the simple
explanation — "the sampler never reads the graded table" — is contradicted by the
code. Either the sampler is a different path, or that read returns nothing at
runtime. **The disagreement is replicated; the cause is not established**, and it
is the single most valuable thing to chase next.

**2. No selection can be joined to the outcome that followed it.**
`thompson_selection_log.execution_id` is a placeholder minted at recommendation
time:

```
  execution_id:    'recommend-1787376611094-19'
  correlation_id:  'sel_1787376611094_y7jg4t_19'
```

**Zero `execution` rows carry an id beginning `recommend-`.** *Positive control:*
6,970 rows begin `exec_`, so the predicate works. All **26,529** selections are
structurally unjoinable to any result, and the `correlation_id` meant to close
that link is never written back on the outcome side.

The consequence is precise: credit reaches *arms* (via trace ingestion keyed on
`activity_id`) but never reaches *decisions*. Thompson's own choices can never be
graded as choices, so there is no counterfactual-at-decision-time record — which
is exactly what law 12 asks for and the one thing that would distinguish "this arm
succeeded" from "choosing this arm was right." *(Both legs replicated.)*

---

**Extraction has collapsed to a trickle.** The ribosome dispatches ~96 extractions
a day and the learned corpus has grown by **two templates in three weeks**:

```
  2026-08-21T16:17   ← newest
  2026-08-21T12:37
  2026-07-31T22:02   ← previous, a 21-day gap
  2026-07-31T08:25
  ...
```

Two mints in the last 7 days against roughly two thousand dispatch attempts —
a yield near **0.1%**. Blockers 1 and 2 below are the mechanism for that yield.
The corpus is not empty; it has simply stopped growing, while the *other* source
of activities has not.

Minting continues unchecked from the other direction: **1.2% of activities carry
execution provenance, 51% were minted by the gap-closing path**, and **76% of
non-retired activities sit in a duplicate input/output shape family**. The corpus
is not made of things that worked — it is made of things that were proposed.

And because `activity.ev` is identically `0.5` on every one of 3,856 rows, the
candidate prefilter that feeds Thompson collapses to **pure recency**, showing the
selector the newest unearned arms first.

```
  extraction yields ~0.1%  →  earned pathways enter at 2 per 3 weeks
            ↑                                    ↓
  posterior never concentrates  ←  prefilter shows newest-minted arms first
            ↑                                    ↓
     evidence splits 76% ways  ←  proposal-minting fills the gap daily
```

The two sources of activities are running at wildly different rates: **earned**
templates arrive at roughly 2 per 3 weeks, **proposed** ones daily. Since the
prefilter orders by recency, the proposed ones are also the ones the selector
sees first. That is the trap — not that learning is broken, but that it is
out-competed for attention by its own backlog.

---

## The root cause, traced end to end

Three sequential blockers on the extraction path. Blockers 1 and 2 are verified
with positive controls and are jointly sufficient to explain a ~0.1% yield.
Blocker 3 is stated more narrowly than in earlier revisions: of its two
supporting table claims, one was refuted (`activity_templates` is a legacy sink,
not the live path) and one survives in restated form (the shape-weighted credit
branch has never executed). Both verdicts are recorded below.

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

### Blocker 3 — `ribosome-extract` emits a trace description, not a template

`ribosome-extract` declares `output_impulse_shapes:
['executionTraceWithSignatures']` — a *description of the trace*. Combined with
blocker 2, this is why 90 of 102 runs end `reached: false`: the walk produces
something, it is simply not the thing that would constitute a mint.

**Two dead tables, both cleared as non-causal.** An earlier revision made these
load-bearing; the adversarial pass refuted both causal clauses and I accept the
refutations:

| table | writers | readers | rows | verdict |
|---|---|---|---|---|
| `activity_templates` (plural) | 1 (`ribosome.ts:608`) | 0 | 2 | **legacy sink**, untouched since 2026-04-02; not the live path |
| `activity_template` (singular) | 0 | 6 | 0 | empty; the shape-weighted credit branch it gates has **never executed** — 0 firings vs 7,261 control *(replicated)* |

**The shape-weighted credit branch has never executed.** I first published this as
"6,928/6,928 posterior updates degraded", the verifier refuted the word
*degraded*, and I over-corrected by withdrawing the finding entirely. Running the
finder's own probe settles it — the observational fact is solid and worth keeping:

```
  shape-weighted branch fired:       0
  POSITIVE CONTROL (same try-block): 7,261
  activity_template counters:        0
```

`execution-traces.ts:3068` reads `SELECT output_shapes FROM activity_template`,
and the shape-match-weighted α/β branch at `:3087` is gated on that result. The
table has 0 rows, so the branch has **never once run**, while
`applyOutcomeToPosteriors` in the same try-block has fired 7,261 times.

The verifier was right that nothing was *degraded* — there was no working
weighted path to fall from. The accurate statement is that a designed capability
has never been reachable: **every Thompson credit update in this system's history
has been unweighted**, and the shape-match weighting that was built for it is
dead code behind an empty-table read. Same for the `activity_template` counter
update at `:3135` — 0 firings.

Related and narrower: `paradigm.ts:902` reads `FROM activity_template` and
hardcodes `input_shapes: []` with the comment "Legacy templates don't have
shapes", so that path is shape-blind by construction too.

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
| **The sampler does not read the graded posterior** — logs integer counts while the store holds credit-weighted fractionals | α=4/β=1 logged vs α=493.83/β=897.23 stored; 22.5% of selections at the neutral prior *(replicated)* |
| **All 26,529 selections are unjoinable to their outcomes** — `execution_id` is a `recommend-<ts>-<idx>` placeholder | 0 execution rows match; 6,970 `exec_` rows as positive control *(replicated)* |
| The `consumedInChain=0` abstention withholds **both** α and β, so the whole satisfier class is learning-inert | re-dated prior #4, still live |
| `execution` is a 150,000-row FIFO ring **at cap**; an auth storm at ~20,000/hr wrote 143,042 rows and flushed ~2 months of history | `trace_store_counters:execution` cap=150000, row_count=150040 *(replicated)* |
| Every composite index whose prefix ends in `success` returns zero rows, so the stratified retention sweep deletes nothing — the root enabler of the ring filling with auth noise | `activity_id='validator-dispatch' AND success=true` → **0**; each clause alone → 4,796 and 7,123 *(replicated)* |
| 5,378 refusals are read by nothing but an audit endpoint — the shape-gap demand signal vanishes | `refusal_events` consumed only by `GET /v2/activities/refusals/stats` |
| The hook-subscriber exclusion guards the leaf credit path and is bypassed on the chain-credit path | `writeAncestorDelta` has no `HOOK_SUBSCRIBER_PATTERN` test |
| Extraction yield has collapsed to ~0.1% — 2 mints in 3 weeks against ~96 dispatches/day | 427 learned activities exist, last two 2026-08-21 after a 21-day gap *(replicated)* |
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

**76% of non-retired activities (2,011 of 2,639) sit in a duplicate input/output
shape family** — the law-3 violation measured by signature rather than by name;
779 signatures cover 2,639 activities and the largest single group is **185
identically-named** ones. · `tool_usage` / `tool_usage_patterns` /
`tool_argument_pattern` — a three-way write≠read split, plus a reader filtering on
three fields the SCHEMAFULL table does not define. · `execution_exemplar` — a live
reader with both writer triggers structurally unable to fire. · The `activity`
posterior/counter columns are dead schema: `thompson_alpha/beta` 1.0/1.0,
`total_executions` 0, on all 3,856 rows (the live plane is
`variant_performance_metrics`, 1,638 moved posteriors). · `activity_state_affinity`
— four migrations invested in a computed `ev` field whose sole reader/writer sits
in `tsconfig.json`'s `exclude` array as an orphan. · Law 5: boredom is a genuine
condition-driven selector, but its rhythm input is dead at the consumer, and ~14
substrate-work timers run on hardcoded cadences.

*Three items previously listed here were removed by the adversarial pass —
`routing_trace`'s "silent full routing credit", `activity_metrics`' "phantom
read", and `circuit_breaker_trace`'s "undeserved health credit". All three had
real observational legs and inverted or dead causal legs; see the refutation
table below.*

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

## What the adversarial pass killed

Seven findings went to independent verifiers instructed to refute rather than
confirm. **Six came back partially or fully refuted.** In every case the
*observational* leg reproduced and the *causal* leg did not — which is the
signature of an audit reaching for impact rather than measuring it.

| claim | verdict |
|---|---|
| "extracted templates are never selectable, graded, or composed" | **REFUTED.** 427 `learned-*` activities, 100 with moved posteriors, 36 executed. Rewrote the headline. |
| "`activity_template` emptiness degraded 6,928/6,928 posterior updates" | **REFUTED on the word "degraded" only.** Nothing fell from a working state — but the shape-weighted branch has fired **0** times against a **7,261** positive control, so every credit update ever made was unweighted. Restated, not withdrawn *(replicated)*. |
| "`routing_trace`'s dead writers make the health scorer silently credit full routing weight" | **REFUTED and inverted.** `vessel-health.ts:59` returns early at score 0. It under-credits, not over-credits. |
| "`activity_metrics` is a phantom table read by the live scores endpoint" | **REFUTED.** `app.get('/scores')` is registered twice on the same Hono instance; the handler that reads it is shadowed dead code. |
| "`circuit_breaker_trace` field mismatch gives vessels undeserved health credit" | **REFUTED and inverted.** `vessel` has 0 rows, so the scorer pins `circuitBreaker = 0`, status `unhealthy`. |
| "`trace_digest`'s shallow floor is pinned to the activity-api restart" | **REFUTED (mechanism).** It is a rolling 2h retention reap in `trace-retention.ts`. |
| "learning-track classifier's join is structurally impossible" | **NOT REFUTED — confirmed and stronger.** A SurrealDB `RecordId` is bound into `WHERE activity_id = $activity_id` against a column `DEFINED AS TYPE string`, so the join can never match any row, ever. |

Two verifier notes worth keeping. One found that a citation supporting a claim was
**misattributed**: `code-variants.ts:1-13` is a *deprecation header written by
whoever retired that code* ("Phase B3b dead-code cleanup, 2026-04-28"), not
evidence of a live defect — the same "a comment describing a defect was written by
whoever fixed it" trap this codebase has hit before. Another flagged that three of
these were **rediscoveries** already catalogued in `SEAM_MAP_2026-08-21.md:143`,
`LEARNING_AUDIT_ROUND2.md:49`, and `COMPOSITIONALITY_STATE.md:333`, one of which
had already reached the correct narrower verdict.

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

---

## Addendum — live re-confirmation, 2026-08-23 (23:xx UTC)

Re-probed the four load-bearing claims against the same `substrate-live` container.
Two headline defects **hold unchanged**; the extraction landing **has resumed**,
which the body reported as halted. Corrections land here, not only in chat.

**Still open, re-confirmed live:**

- **Attribution — selections unjoinable to outcomes.** `thompson_selection_log`
  now holds **29,452** rows whose `execution_id` begins `recommend-<ts>` (was
  26,529 in the body). Selection is live (`selected_at` current to tonight). The
  join-impossibility itself is cited from the body's verified control (0 matches
  vs 6,970 `exec_`), not re-run tonight — `execution.id` is a `RecordId`, so the
  string-prefix positive control type-errors rather than counting. Today confirms
  only that placeholder-writing continues and has grown. **The law-12 gap is the
  single largest attribution defect and is unremediated.**
- **Prefilter is pure recency.** `activity.ev` is identically `0.5` on
  **3,858/3,858** rows tonight (was 3,856). Unchanged. `discover-by-shapes.ts:235`
  orders candidates by this constant before the Thompson draw, so the selector
  still sees newest-minted arms first.

**Changed since the body was written — extraction landing resumed:**

- **Minting is live again.** 5 activities minted in the last 3 days, newest
  **2026-08-23T15:43** — against the body's "2 in 3 weeks" and the expectations
  report's "4 in 21 days / halted on both sides." That framing is now **stale**.
- **The resumed mints are the *earned* path.** 4 of the 5 carry the `learned-`
  prefix — `learned-composition-substrategap-to-substrategap-write` (today),
  `learned-satisfier-shell-result`, two `learned-…-trace-store-reconcile`; the
  fifth is `auto-bridge:execution_trace`. **Zero** gap/proposal-path mints in the
  window. This is the first interventional signal on the expectations report's
  named open question ("what happened ~2026-08-01"): the resumption is **concurrent
  with restored operator goal traffic** to the local substrate this session (direct
  HTTP after the dead-hub cockpit repoint). Consistent with the operator-traffic-
  starvation hypothesis, **but uncontrolled** — this session changed many things at
  once (a revert, five source fixes, heavy dispatch), so no single cause is
  assignable (law 12). It is a lead for a one-variable follow-up, not a settled
  cause.

**Posterior movement, matched predicate.** Under the body's own predicate (α>1 OR
β>1, i.e. "above the prior"): **2,903 of 3,464 (83.8%)** variant rows have moved,
up from 1,638/3,349. (An interim probe tonight counted `thompson_beta>1` alone and
got 2,432 — the same phantom/mismatched-predicate trap this report's Method notes
warn against; recorded here as the correction, not the finding. The `beta`/`alpha`
column names are `thompson_beta`/`thompson_alpha`; a bare `beta` reads as a phantom
column and returns empty.) The credit machinery is accumulating, and faster than at
audit time.

**Net.** The two growth-blocking defects the audit ranks highest (unjoinable
selections; recency-only prefilter) are **both live and unremediated tonight**. The
one thing the body called dead — extraction landing — is **no longer dead**, and
the resumed traffic is earned, not proposed. The corpus is beginning to grow from
things that worked; it still cannot grade its own *choices*.

---

## Addendum 2 — the four ranked blockers, resolved or dispositioned, 2026-08-24

Acting on the standing condition "resolve all known blockers," each of the four
growth-blocking findings was taken to a terminal state. The rule throughout:
dispatch as a goal first (canonical), read the diff (not the reach verdict), and
only direct-edit under a fresh operator authorization where the autonomous lane
structurally cannot land the fix.

| # | Blocker | Disposition |
|---|---|---|
| B4 | Trace-store pressure (`success` composite index → zero-match retention) | **Already resolved by the substrate itself** — migrations 198 (`db667c1`) + 199 (`ffd75d0`), 08-22, removed the boolean indexes; ring drained 150k→9,242; stratified sweep live. Audit numbers were pre-fix. |
| B3 | `validator-dispatch` runs 1 of 5 tasks | **Filed as a gap** (`validator-dispatch-chain-dies-task1-to-task2-shape-binding`). A shape-binding gap (validator `input_shapes` never intersect parent `output_shapes` under `CONTAINSANY`, no wildcard) with **high blast radius into the extraction tier** (task 5 hardcodes `executionSucceeded:false`); a wrong fix corrupts ribosome training. Not landable blind from here — the honest disposition is to let the system learn the repair. The one "trivial" sub-fix flagged (the `retired IS NONE` strip) was **refuted as inert**: 0 of 3,858 rows have `retired` unset. |
| B1 | Selections unjoinable to outcomes (law 12) | **Resolved.** `execution-traces.ts` now lifts the walk's `correlation:<id>` tag into `body.correlation_id` (helper `deriveCorrelationIdFromTags`, 7 unit tests). Dispatched first; the lane landed only an inert interface-field partial (`be97c55`) — the real derivation was implemented directly under operator authorization. **Verified live at the consuming layer**: a trace carrying only the tag now stores `correlation_id` populated and joinable (`SELECT ... WHERE correlation_id = <nonce>` returns the row). Committed `755dca9`, deployed via pull-sync, activity-api restarted 02:34 UTC onto the new code. |
| B2 | Recency-only prefilter | **Resolved.** `paradigm.ts` `queryActivitiesByShapes` now admits `max(limit, 1000)` (helper `computeAdmissionLimit`, 6 unit tests + paradigm's first test file) so the Thompson draw — the real selector — sees earned, non-recent arms instead of the newest-minted only. Deliberately does *not* make the dead `ev` column live (that would turn the cut into a greedy exploit filter). Committed `a7182c9`, deployed. Effect is internal + longitudinal; verified by unit test + typecheck + deployment, not a point observation. |

**Incidental validation.** The compose-BUSY guard landed earlier this session
(`2cc8af7`) fired correctly under real contention while these were dispatched:
a concurrent autonomous-lane edit hit the busy lane and was graded
`RETRYABLE CAPACITY — NOT falling through to a walk that cannot edit`, instead of
rerouting to a dead-shape walk and minting a phantom capability gap.

**The frontier finding, reconfirmed.** The canonical dispatch path *lands green*
but produced an **inert partial** on B1 (interface field, no logic) and was
**gate-blocked** on B2 (no test file). Autonomy's mechanism works; landing correct
multi-hunk logic is the open frontier — which is why B1/B2 needed a hand, and B3
(higher blast radius, unverifiable here) was filed rather than forced.
