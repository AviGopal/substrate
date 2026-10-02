# Fix campaign: container-lifecycle audit failures — item 1: trace persistence

Diagnosis evidence for the audit finding "Trace persistence is broken on the
fresh datastore" (`container-lifecycle-audit-2026-09-21/REPORT.md`,
`trace-store-errors.json`, `dispatch-durable-traces.json`).

## Root cause (proven by isolation on the live engine, scratch namespace)

`sql/schemas/023-shape-conditioned-scores.surql` defines the computed view
`v_shape_pattern_performance` over `execution`. When that view is defined over
an **empty** `execution` table — which is what every cold boot does, since
`scripts/init-database.ts` applies schemas before any execution exists — its
incremental maintenance throws on **every subsequent `INSERT INTO execution`**:

    Incorrect arguments for function array::group().
    Argument 1 was the wrong type. Expected a array but found '<activity_id>'

so `POST /v2/activities/execution-traces` returns 500 permanently. Engine:
SurrealDB 2.3.3 (same binary as live; scratch ns `audit-scratch`).

Controls run (all through the same address, per the positive-control law):

| # | Setup | Insert into `execution` | Result |
|---|---|---|---|
| E | `v_shape_pattern_performance` alone, defined over empty table | full-field row | **ERR array::group** (audit's exact error) |
| E2 | same, after `REMOVE TABLE v_shape_pattern_performance` | full-field row | **still ERR** — the poisoned maintenance hook survives removal in-process |
| F | `v_shape_conditioned_score` alone, defined over empty table | full-field row | OK |
| grouptest1 | full 023 applied with **1 pre-existing row** (backfill non-empty) | existing group + new group | both OK |
| minimal | trivial grouped view over empty table | row | OK |

Why live never showed it: live's `v_shape_pattern_performance` is a **plain
table** (stale older definition), so `DEFINE TABLE IF NOT EXISTS` never
replaced it with the view — `IF NOT EXISTS` makes schema files silently
divergent between warm and cold stores. Live's `v_shape_conditioned_score`
IS the view and handles ~7.4k qualifying inserts/day cleanly.

`v_shape_pattern_performance` has **zero code readers** (only its own schema
file mentions it). `v_shape_conditioned_score` has three readers
(`src/db/paradigm.ts`, `src/routes/activities.ts`, coalesce-precedence test)
and must stay byte-identical.

Secondary noise in the audit log (`idx_trace_digest_execution_id already
contains ...`) is retry fallout: the client retried the 500'd POST after the
first attempt's `trace_digest` / `execution_trace_content` writes had landed.
It disappears when the root write succeeds. Separately, live's 296
"Authoritative execution write failed" over 3 days are all
`Database record execution:⟨walk-satisfier-*⟩ already exists` — duplicate
re-submissions colliding idempotently, not data loss, not this bug.

## Same class, second instance: 055

`sql/migrations/055-variant-tracking.surql` cannot parse on SurrealDB 2.3.3 at
all (`max(variant_generation)` — invalid function path; needs `math::`/`time::`
namespacing). The whole file 400s on every boot, so none of its DEFINE FIELDs
ever applied anywhere. Its `v_variant_families` view also uses
`array::group(id)` over `activity` — the identical insert-poisoning hazard,
also with zero readers — it just never fired because the file never parsed.

## Class finding: silently-dead migration files (filed as gap, not absorbed)

Applying every `sql/*.surql`, `sql/schemas/*.surql`, `sql/migrations/*.surql`
to a scratch db the way init-database does: **22 files fail wholesale with
HTTP 400 parse errors** (including BOTH variants of
`021-paradigm-computed-views` — which is why `v_activity_score` exists on no
deployment, live included) and several seed files fail on
`Found NULL for field org_id` (057, 076, 077). `applySQLFile` treats a 400 as
one failed file and continues; nothing records which files a boot skipped.
Raw sweep output: `sql-sweep-2026-09-22.txt` (this directory).

## Fix

Retire both reader-less views by converting their DEFINE blocks (and, for 023,
the two `idx_v_pattern_perf_*` indexes, which would auto-recreate a bare
table) to `REMOVE TABLE IF EXISTS` — the retirement precedent from
`022-paradigm-compat-views.surql`. Repair 055's parse errors so its field
definitions finally apply. `v_shape_conditioned_score` untouched.

## Blocking discovery: the surql landing gate is wedged

Both substrate dispatches staged the correct edit but were refused at cutover
by `surqlBreakingFieldRefusal`
(`repos/development-vessel/src/resolvers/vessel-mitosis-evaluate.ts`).
Substrate-authored commit `54b7762` (2026-09-16, "apply
route-edit-ee2fa6ac-narrowed") deleted 39 lines from that function — the
ALTER..ADD refusal, the MALFORMED_RE check, and the
`if (!/^DEFINE\s+FIELD\b/i.test(stmt)) continue;` guard — leaving the
DEFINE-FIELD shape test applied to **every** statement. Since then the gate
refuses any `.surql` file containing an ordinary `DEFINE TABLE`,
`DEFINE INDEX`, or `REMOVE TABLE` statement — verified by running the function
against the **unmodified** 023 file (refused). Every `.surql` mitosis landing
since 09-16 has been silently wedged; the typecheck gate passed the deleting
commit because deleting a branch typechecks.

Repair dispatched as a goal with the 39 lines verbatim
(dispatch c5fe1475); gaps filed:
`a-substrate-authored-deletion-wedged-the-surql-landing-gate-and-nothing-detected-it`
(corpus self-check so a gate regression surfaces as its own verdict) and
`cold-boot-silently-skips-twenty-two-unparseable-migration-files`
(durable per-file apply verdicts in init-database).
Oracle labels recorded on both refused dispatches (70cec40b, b5c3f896).

Acceptance gate: a cold-booted fresh-volume instance where
`POST /v2/activities/execution-traces` returns 2xx and the trace listing is
non-empty after a dispatched probe — the same check that produced the audit's
`dispatch-durable-traces.json` failure.
