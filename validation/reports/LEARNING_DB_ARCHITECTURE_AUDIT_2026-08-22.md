# Learning mechanism, database, and architecture — full audit

**Scope.** The learning loop in three planes at once: **code** (what the source
says), **traces** (what the live substrate actually did), and **intent** (what
CLAUDE.md's laws and the execution expectation promise). The question behind all
of it: *what is preventing growth?*

**Method.** A 96-table row census on the live local `substrate-live` container is
the spine; every claim below is anchored to a runnable probe, and every probe is
read-only. Findings are ranked by growth impact, not by how surprising they are.

**Access.** Local container only. DB reads went through a read-only helper that
refuses any statement not beginning `SELECT`/`INFO`. No remote host was contacted
and no credential was extracted — a prior run of this investigation was correctly
blocked for embedding a key-extraction recipe, and that pattern was not rebuilt.

---

## The one-line finding

**Nothing the system does ever becomes something it knows.** The ribosome — the
only mechanism that converts a successful execution into reusable structure, and
the origin law 4 reserves for activities — has produced, in its entire recorded
history, **two empty templates**, both named `extracted-validator-dispatch`,
written 22 seconds apart on 2026-07-22, extracted from two executions with
`successRate: 0`, carrying `tasks: []` and `impulses: []`, into a table with
**zero readers**.

Meanwhile minting continues unchecked from the *other* direction: 3,856 activities
exist, **1.2% carry execution provenance and 51% were minted by the gap-closing
path**. So the corpus is not made of things that worked — it is made of things
that were proposed. And because `activity.ev` is identically `0.5` on every row,
the candidate prefilter that feeds Thompson orders by **pure recency**, showing
the selector the newest unearned arms first.

That is the growth trap, and it is a closed loop:

```
  extraction lands nothing  →  no earned pathways enter the corpus
            ↑                                    ↓
  posterior never concentrates  ←  prefilter shows newest-minted arms first
            ↑                                    ↓
     evidence splits 21 ways  ←  uncontrolled minting fills the gap
```

## The root cause, traced end to end

Three sequential blockers. Each is independently verified with a positive
control, and each alone is sufficient — so fixing only one changes nothing.

**Blocker 1 — 69% of executions never receive a reach tag.** The ribosome
correctly refuses to extract from an execution it cannot confirm was honestly
reached (law 4). Over 6 hours of live logs it re-read 531 verdicts:

```
    364  verdict=ungraded      (no-reach-tag, after 5 attempts)
    127  verdict=not-reached
     40  verdict=reached
    491  "extraction SKIPPED (not honestly reached)"   = 364 + 127 exactly
```

The gate is working as designed. It is starved because the reach verdict is not
landing on the execution record, so `event_success=true` executions come back
`ungraded` and are correctly refused.

**Blocker 2 — 88% of the extractions that *are* attempted come back hollow.**
The 40 that pass the gate get an `extraction ALLOWED` → `Dispatching
ribosome-extract` → `dispatchId` chain. Those dispatches land in `execution` as:

| status | reached | n |
|---|---|---|
| success | **false** | **90** |
| success | true | 10 |
| success | null | 1 |
| failure | null | 1 |

**101 of 102 carry a `failure_mode` while reporting `status: 'success'`** — the
sampled row shows `failure_mode: {type: 'execution_error'}`, `status: 'success'`,
`success: True`, `reached: False` on the same record. This is exactly the hollow
completion CLAUDE.md warns about, and because dashboards grade on `status`, the
substrate sees 101 successes.

*Positive control:* `reached = true` occurs 113 times fleet-wide and 10 times for
`ribosome-extract` itself, so `reached: false` is a real verdict, not an absent
field.

**Blocker 3 — even the 10 that reached minted nothing.** `ribosome-extract`
declares `output_impulse_shapes: ['executionTraceWithSignatures']` — it emits a
*description of the trace*, not a template. And the one table extraction output
has ever reached, `activity_templates`, has exactly **one** code reference in the
entire fleet (`ribosome.ts:608 INSERT INTO`) and **no reader at all**, while
`activity_template` — singular, empty — has **six readers and no writer**. A
one-character name difference splits the extraction path in half: output falls
into a write-only table, and six consumers starve on a write-never one.

That emptiness has a measured cost downstream: **6,928 of 6,928 posterior updates
degrade to unweighted** because the shape-weighted credit path reads
`activity_template`.

**Supporting law-1 violation:** the ribosome logs `WARN extractionPolicy
unresolved — falling back to maxExtractionDepth 1` and `WARN
extractionEligibilityPolicy unresolved — falling back to literal
[validator-dispatch, slot-binding]; three further lifecycle meta-templates exist
unlisted`. Both policies are shapes that do not resolve, so extraction depth is
hard-capped at 1 and eligibility is an in-process constant listing 2 of 5
candidates — unobservable and unlearnable.

**Highest-leverage fix, in order:** land the reach verdict on the execution record
(unblocks 69% of candidates); make `ribosome-extract` produce a template shape
rather than a trace description, and fail loudly when it does not reach; then
reconcile `activity_templates` / `activity_template` onto one name.

---

## The secondary finding — nothing culls what minting produces

3,856 activities exist; 817 have ever been selected and the durable trace corpus
knows 274 of them. The gate that is supposed to hold that line — the promote
gate's k-nearest-neighbour quality projection — **fires on 0.56% of promotions**,
and in the system's entire history exactly **one** template was ever refused on
quality grounds.

---

## Findings, ranked by growth impact

| # | Finding | Plane | Impact | Confidence |
|---|---|---|---|---|
| 0a | Extraction lands nothing: 2 empty templates ever, from `successRate: 0` executions, into a reader-less table | trace + db | **blocks growth** | CONFIRMED |
| 0b | 69% of executions never get a reach tag, so the ribosome's honesty gate correctly refuses them | trace | **blocks growth** | CONFIRMED |
| 0c | 90 of 102 `ribosome-extract` runs are `status: success` + `reached: false` + `failure_mode` set | trace | **blocks growth** | CONFIRMED |
| 0d | `activity_templates` (1 writer, 0 readers) vs `activity_template` (0 writers, 6 readers) — 6,928/6,928 credit updates degrade to unweighted | code + db | **blocks growth** | CONFIRMED |
| 0e | `activity.ev` identically `0.5` on all 3,856 rows → candidate prefilter is pure recency before the Thompson draw | db + code | **blocks growth** | CONFIRMED |
| 0f | Only 1.2% of activities carry execution provenance; 51% minted by the gap-closing path | db | **blocks growth** | CONFIRMED |
| 1 | Promote gate is a rubber stamp: 83% `auto_promote`, quality projection fires 0.56% | db + code | **blocks growth** | CONFIRMED |
| 2 | 79% of minted activities have never been selected; duplicates are semantic, not literal | db | **blocks growth** | CONFIRMED |
| 3 | The drafter's teaching channel reads 21 concepts out of 58,066 | db + code | **degrades growth** | CONFIRMED |
| 4 | `queryWithAuth` pooled branch discards its own `sql` argument | code | **latent landmine** | CONFIRMED |
| 5 | `execution` is 95.29% auth checks — every headline throughput number is inflated ~20× | trace | measurement | CONFIRMED |
| 6 | Pathway reuse works, but its entire corpus is one 1-step pathway | trace | **degrades growth** | CONFIRMED |
| 7 | `goal_execution_paths` carries two disagreeing counter planes (1,661/8,030) | db | mitigated | CONFIRMED |
| 8 | `activity.thompson_alpha/beta` is a vestigial column pair | db | cosmetic | CONFIRMED |

---

### 1. The promote gate admits nearly everything — and hides that it did

`promote_gate_evaluations` has 7,652 rows: 6,337 `promote`, 1,315 `refused`.

The refusals are not quality control. 1,284 of them are `failed_out_pruned` —
retrospective deprecation of templates that had *already been promoted* and then
failed in service. The gate's actual admission criterion, `projected_mean` below
threshold, has refused **one template, ever**.

The cause is that there are **two promote paths writing into one audit table**:

- `/promote` — the operator-pulled gate, which really does run a k-nearest-neighbour
  projection over similar templates. This is the path that produces
  `insufficient_neighbor_evidence` (29) and `projected_mean_below_threshold` (1).
- The **auto-promoter** (`activities.ts:3847`), which gates only on empirical mean
  and sample count and then writes `k_neighbors: 0, neighbor_template_ids: []`,
  **hardcoded**, into the same table.

6,324 of 7,652 evaluations (83%) took the weak path. Because the auto-promoter
stamps the projection fields with literal zeros rather than leaving them absent,
the audit trail cannot distinguish "the projection ran and found no neighbours"
from "the projection was never attempted." Only 43 rows in 7,652 (0.56%) carry
`k_neighbors > 0`.

This is the enforcement point for law 3 (*reuse before mint*) and law 4
(*activities are earned by doing*). It is not enforcing either.

```
dbq.sh "SELECT decision, count() AS n FROM promote_gate_evaluations GROUP BY decision;"
dbq.sh "SELECT reason, count() AS n FROM promote_gate_evaluations GROUP BY reason ORDER BY n DESC;"
dbq.sh "SELECT count() AS n FROM promote_gate_evaluations WHERE k_neighbors > 0 GROUP ALL;"
```

**What detects this class without an operator?** A gate that records a decision
must record *which* gate decided. The audit row needs a `gate_version` or
`projection_attempted` field, and `k_neighbors` should be `NONE` — not `0` — when
no projection ran. An absent value is honest; a zero is a claim.

---

### 2. The population is 3,856 arms and 274 of them have ever run

| measure | count | of 3,856 |
|---|---|---|
| activities minted | 3,856 | 100% |
| ever selected (`thompson_selection_log`, all history) | 817 | 21% |
| present in the durable trace corpus (274 distinct `activity_id`) | 274 | 7.1% |

Selection outruns execution by 3×: 817 arms were drawn and 274 left a trace.

The duplication is **semantic, not literal**, which is why name-based dedup has
never caught it. A single behaviour — evicting zero-score templates from the
activity hot set — is minted as at least 21 distinct activities:

```
  11  Activity Lifecycle Unload Gap Closer
   3  Activity Lifecycle Hot-Set Eviction Analysis
   2  Activity Lifecycle Template Eviction Analysis
   2  Activity Lifecycle Unload Detection
   1  Activity Lifecycle Unload Detection & Eviction Policy
   1  Activity Lifecycle Unload — Hot-Set Eviction Gap Closer
   1  Activity Lifecycle Unload: Score-Zero Template Eviction
   1  Activity Lifecycle: Hot-Set Eviction Detection and Remediation
   … and a dozen more paraphrases
```

Literal-name grouping reports 1,759 distinct names for 3,856 rows. That
understates the problem: the eleven exact `Unload Gap Closer` duplicates are the
*visible* part, and the twenty paraphrases around them are invisible to any
exact-match check. `corpus-from-repo-docs` likewise exists five times under four
timestamp-suffixed ids.

CLAUDE.md is explicit that this is not neutral: *"a duplicate mint is a fresh
uninformed cell that splits selection traffic and raises the growth rate the
learning loop must outpace… a wrong mint is negative value, not zero."* Twenty-one
arms for one behaviour means each gets 1/21 of the evidence, so none of them ever
accumulates enough posterior mass to win — and the Thompson selector, faced with
twenty-one near-identical uninformed arms, is sampling noise.

```
dbq.sh "SELECT name, count() AS n FROM activity GROUP BY name ORDER BY n DESC LIMIT 25;"
dbq.sh "SELECT count() AS n FROM (SELECT activity_id FROM thompson_selection_log GROUP BY activity_id) GROUP ALL;"
```

**What detects this class without an operator?** Dedup must key on the *shape
signature* (input shapes → output shapes), not the name. Two activities consuming
and producing the same shapes are the same cell wearing different prose, and the
mint path should be required to justify itself against the existing producer —
which is exactly what law 3 already says and nothing currently enforces.

---

### 3. The teaching channel reads 21 rows out of 58,066

Per the standing teaching law, the substrate's only *read-at-use-time* channel
into a running drafter is concept-db → `composeLessonsBlock` → the decompose
prompt. That function is real and wired (`feature-compose.ts:2383`, consumed at
`:2964`, `:3039`). What it reads is the problem.

`concept` holds 58,066 rows. Their composition:

| source_type | count |
|---|---|
| `impulse_signature` | 50,041 (86%) |
| `extracted` | 3,840 |
| `doc_expectation` | 1,841 |
| `recurring_code_problem` | 563 |
| `impulse_activity_pattern` | 502 |
| … 85 more kinds | |
| **`compose_lesson`** | **21** |

`composeLessonsBlock` filters `source_type: "compose_lesson"` with `limit: 8`. So
the corpus the drafter actually learns from is 21 rows, sampled 8 at a time —
0.036% of the store. The other 86% of the "concept graph" is machine-generated
impulse-signature bookkeeping living in the knowledge table.

Usage confirms it from the other side: **98 distinct concepts have ever been
recorded as used**, and of 838 usage records, 796 (95%) carry `outcome: neutral`
with a `trace_id` of `mcp_rest_search_*` — an agent or operator searching through
the MCP surface, not a substrate execution consuming a lesson. Only 42 records in
the entire history carry a graded outcome (18 success, 24 failure).

A grading channel that has received 42 signals cannot rank lessons, so the
drafter's 8-row sample is effectively arbitrary.

```
dbq.sh "SELECT source_type, count() AS n FROM concept GROUP BY source_type ORDER BY n DESC;"
dbq.sh "SELECT outcome, count() AS n FROM concept_usage GROUP BY outcome;"
dbq.sh "SELECT count() AS n FROM (SELECT concept_id FROM concept_usage GROUP BY concept_id) GROUP ALL;"
```

---

### 4. `queryWithAuth` runs a hardcoded query instead of the caller's — latent

`repos/activity-api/src/db/surreal.ts:376`, inside the pooled branch:

```ts
logger.info('Executing authenticated query (pooled)', { sql, params, … });
const result = await session.db.query(
  'SELECT id, name, description, content, created_at, updated_at FROM template',
  params,
);
```

The `sql` argument is logged and then discarded; a hardcoded `SELECT … FROM
template` runs in its place. `template` is not among the 96 tables in this
database, so the call returns `[]` — silently, with the *intended* SQL sitting in
the log as though it had run. The legacy branch immediately below is correct.

This backs roughly eighteen call sites in `paradigm.ts` — shape-conditioned
scores, variant scores, activity discovery, the FTS and HNSW lookups — i.e. most
of the selection read path.

**It is latent, not live.** The branch is gated on `DB_POOL_ENABLED === 'true'`
and that variable is absent from the running process:

```
PID=$(docker exec substrate-live systemctl show activity-api -p MainPID --value)
docker exec substrate-live bash -c "tr '\0' '\n' < /proc/$PID/environ | grep -c DB_POOL_ENABLED"   # -> 0
```

It arms the moment an operator flips the canary flag, and it will present as
"selection suddenly recommends nothing" with no error anywhere. Note that
`paradigm.ts:432` and `:1800` already carry comments about `queryWithAuth`
silently dropping statements — this class has bitten this codebase twice before.

It is also a law-1 violation in its own right: a behavioural switch on an env var
is invisible to traces and unlearnable.

---

### 5. 95.29% of the `execution` table is authentication

`execution` holds 150,050 rows. **142,977 of them (95.29%) are `auth_resolve_v1`**
— API-key validation. Real substrate work is **7,049 executions across 152
distinct activities**.

This matters because "150,050 executions" is the number that gets quoted. Any
throughput, cost, or learning-volume figure derived from an unfiltered
`SELECT count() FROM execution` is inflated roughly twentyfold.

Two mitigating facts, both verified: auth executions do **not** pollute the
durable trace corpus (`activity_execution_traces WHERE activity_id =
'auth_resolve_v1'` → 0), and `execution` is retention-pruned to roughly two days
(oldest row 2026-08-20), so it is a rolling window rather than a permanent record.
That second fact is itself a trap — the "152 distinct activities" figure above is
*a 19-hour window*, not system history, which is why the corpus-coverage numbers
in finding 2 are drawn from the durable trace table instead.

```
dbq.sh "SELECT activity_id, count() AS n FROM execution GROUP BY activity_id ORDER BY n DESC LIMIT 15;"
dbq.sh "SELECT count() AS n FROM execution WHERE activity_id != 'auth_resolve_v1' GROUP ALL;"
```

---

### 6. Pathway reuse — the compounding mechanism — works, on a corpus of one

The *middle* of the execution expectation (reuse a learned body, walk only the
first or last mile) is the mechanism by which learning compounds. It exists, it is
wired, and it fires: 30 pathway-reuse decisions in the goal-host journal, 24 of
them accepted.

But every single accepted reuse is the same one:

```
[goal-host-vessel] pathway reuse: accepted 1-step pathway via shape_signature
  cover=1.00 borrowed_from_goal=723a0e8705f734ab (1/1 reached) of 3 recommended, dropped 0
```

All 24 accepts are **1-step** pathways borrowed from a **single** goal hash, each
resting on a **1/1** success record. The consumer is healthy — it deliberately
reads `successful_executions` rather than the derived `success_rate`
(`goal-host index.ts:5597`), which is the correct plane. There is simply almost
nothing in the corpus to reuse.

This is the clearest statement of the growth problem: the machinery for
compounding is built and functioning, and it is starved of material because
minting is uncontrolled (findings 1–2) while execution is not.

---

### 7. Two counter planes on `goal_execution_paths` — pre-known and mitigated

1,661 of 8,030 rows disagree between `execution_count`/`success_count` and
`total_executions`/`successful_executions`, and 456 rows report `success_rate: 0`
while their Thompson α records successes.

**This is already known and already handled** and is recorded here only so it is
not re-filed a third time. There is a self-healing derived-rate rewrite at
`posterior-update.ts:922`, a regression test that names the exact defect
(`proven-failing-paths.test.ts:71`: *"success_rate is miscomputed on a large
fraction of rows"*), every call site passes `min_success_rate: 0` so the field
gates nothing, and the consumer that matters reads the counter plane instead.

---

### 8. `activity.thompson_alpha/beta` is vestigial

All 3,856 rows sit at exactly `Beta(1,1)`. The columns exist and are populated;
they are written once at mint and never updated.

This is **not** a finding that learning is dead — a positive control settles it.
`variant_performance_metrics` has 1,638 of 3,349 rows with `thompson_alpha > 1`,
and every reader in the codebase reads *that* table
(`paradigm.ts:541`, `posterior-update.ts:902`, `discover-by-shapes.ts:261`,
`variant-creator.ts:490`). `paradigm.ts:518` says so in as many words. The
`activity` copies have no reader. Dead schema, not a dead loop.

The one hazard worth noting: `paradigm.ts:811` does `SELECT * FROM activity`,
which drags the stale columns into whatever consumes that result.

---

## Checked and cleared — things that look like defects and are not

Recording these because each cost real probe time, and because two of them are
exactly the kind of finding this audit would otherwise have filed with confidence.

**`activity_execution_traces` frozen for 39 days.** The durable trace table
(18,135 rows) has taken no write since 2026-07-14, while every other learning
table is fresh today. This is a **documented, intentional decommission**: `execution`
became the sole authoritative trace store in July 2026, the AET shadow INSERT is
gated on `DUAL_WRITE_ENABLED` which defaults off specifically so the decommission
survives an image rebuild (`paradigm.ts:25`), and the only live `FROM
activity_execution_traces` reads remaining are in the retention path that deletes
from it (`impulses.ts:3755-3782`). No learning consumer reads it. No defect.

**Four populated tables carry `PERMISSIONS NONE`** — `activity_execution_traces`,
`impulse_relevance_metrics`, `goal_execution_paths`, `activity_composition_graph`
(44,566 rows total), against 52 tables that do carry `$auth.org_id` clauses. Worth
knowing, but the vessels connect as root and read through `surrealDB.query`, so
these clauses are not the enforcement path for fleet traffic in either direction.
Flagged for the record, not filed as a finding.

**`boredom-vessel.timer` shows `NextElapse=infinity`**, which matches a known
timer-deadlock class. It is not one: the service is `Type=simple` running a
live selection loop (`MainPID=20597`, actively reserving and completing ticks),
so the timer is vestigial. `m1-trainer.timer` shows the same shape and is cycling
normally at `NRestarts=0`.

**A stale comment.** `activities.ts:3805` asserts *"`activity` is a VIEW over
`activity_template`"*. The live schema says `DEFINE TABLE activity TYPE NORMAL
SCHEMAFULL` — it is a normal table, and `activity_template` is a separate empty
one. The code around the comment is correct; the reasoning stated for it is not.

---

## Method notes — three phantom-column reads

Three times during this audit a query returned a clean, confident, and entirely
meaningless answer because it named a column that does not exist:

- `SELECT reached … FROM goal_execution_paths` → "8,030 nulls." There is no
  `reached` column. The reach verdict is not stored on that table at all.
- `SELECT … template_id … FROM thompson_selection_log` → "1 distinct template."
  The column is `activity_id`. The true figure is 817.
- `ORDER BY created_at` on `thompson_selection_log` → an apparent one-month-old
  freeze. The column is `selected_at`; logging is live, 1,327 selections in 24h.

SurrealDB returns `NULL` for an absent column rather than erroring, so a typo and
a genuine absence are indistinguishable in the result. **Read one full row before
trusting any aggregate over a named field.** Every corrected figure in this report
came from doing that; the third one nearly shipped as a headline about selection
having stopped a month ago.

The same discipline killed finding 8 as a headline. "All 3,856 activities at
Beta(1,1)" reads as a dead learning loop until you ask what a *moved* posterior
looks like and find 1,638 of them one table over.
