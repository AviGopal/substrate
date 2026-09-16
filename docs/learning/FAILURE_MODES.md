# Failure modes — the taxonomy the schema defines, and the much smaller one the traces carry

> **Read this first: this document describes a schema, not a census.** Its former subtitle
> claimed it described "the taxonomy the traces actually carry", and that has never been
> true of the running store. Three of the six members below have never been emitted once,
> and the type that dominates real traffic is not in the union at all. The per-member
> "actionable fields" — the thing the next paragraph says makes a record more than a label —
> are, with one exception, never written. Treat the tables as the contract the schema is
> willing to accept, and the *Measured state* section for what arrives.

A failed execution is not one thing. The substrate records *how* it failed as a structured,
discriminated object on the execution trace, and the posterior update reads that object to
decide how hard to penalise the arm that ran. Blaming every failure equally teaches the
selector to avoid arms that were merely interrupted, and to keep arms whose output was
genuinely rejected; the taxonomy exists so those two get different treatment.

The object is defined by `FailureModeSchema` in
`repos/activity-api/src/models/schemas.ts` and travels as the optional `failure_mode`
field of a trace written to `POST /v2/activities/execution-traces`. The step sizes it maps
to live in `computeDeltas` in `repos/activity-api/src/lib/posterior-update.ts`.

## Measured state

What the `execution` table holds, counted directly (`SELECT failure_mode.type, count() …
GROUP BY`, with a positive control through the identical query shape confirming the zeros
are real zeros and not a mis-addressed query):

| `type` | rows | in the union below? |
|---|---|---|
| `execution_error` | 37,715 (93.5%) | **no — undocumented** |
| `cascading` | 2,778 | yes |
| `verifier_negative` | 427 | yes |
| `budget_exhausted` | **0, ever** | yes |
| `safety_breach` | **0, ever** | yes |
| `user_abort` | **0, ever** | yes |
| `prediction_disagreement` | **0, ever** | yes |

Two consequences worth stating plainly, because both invert what a reader would assume:

- **The dominant failure type is undocumented.** `execution_error` is 93.5% of all
  classified failures and appears nowhere in the union below. It is handled in
  `computeDeltas`, whose own comment calls it "THE 98% CASE". Any reasoning that starts
  from the six members below is reasoning about 6.5% of the traffic.
- **The actionable fields are aspirational.** The paragraph under *The six members* says the
  per-member fields "make the record actionable rather than a label". Measured: **0 of 2,778**
  `cascading` rows carry `upstream_task_id`, and **0 of 427** `verifier_negative` rows carry
  `validator_id` — while all 2,778 carry `reason`. So every record in the store today *is*
  a label. A `cascading` row cannot name what it cascaded from, which is exactly the fact a
  reader would go to that row to learn.

`action_no_effect` deserves its own note. It is the textbook type for "an action was
dispatched and the world did not change", it carries `pre_signature`/`post_signature` for
precisely that comparison, and it has **zero rows ever** — including through a stretch where
one recovery path re-ran an identical no-op every three minutes for hours. The type that
would have named that failure exists and was never reached.

Fixing the doc is the cheap half. The load-bearing half is that a taxonomy nothing emits
cannot condition anything: `computeDeltas` falls through to the full-β default for every
unclassified failure, so the per-type step sizes in *Outcome-conditional step sizes* below
are, for 93.5% of failures, not consulted.

## The six members

The union discriminates on `type`. Every member carries a human-readable `reason`; the
remaining fields are per-member and are **intended** to make the record actionable rather
than a label — see *Measured state* above for how much of that is currently true.

| `type` | Meaning | Fields beyond `reason` |
|---|---|---|
| `verifier_negative` | A validator or check rejected the output. | `validator_id`, `failed_evidence[]` of `{check_id, details?, location?}` |
| `budget_exhausted` | A cost or duration ceiling was hit. | `budget_type` (`cost` \| `duration`), `consumed`, `allowed` |
| `safety_breach` | A depth or cycle guard tripped. | `breach_type` (`depth` \| `cycle`), `limit?`, `ancestor_chain[]` |
| `cascading` | The failure was caused by an upstream task. | `upstream_task_id`, `upstream_failure_mode?` (recursively a failure mode) |
| `user_abort` | The execution was cancelled. | `abort_source` |
| `prediction_disagreement` | An activity emitted a prediction and the observed continuation diverged from it. | `authored_activity_id?`, `context` (see below) |

Two details matter when writing one of these. On `safety_breach`, `limit` is optional
because a cycle breach has no integer limit to report while a depth breach does. On
`cascading`, `upstream_failure_mode` is the same union again — the chain is preserved so a
victim can be told apart from a cause without a second lookup.

Documents that enumerate five members are missing `prediction_disagreement`, which is the
only member whose penalty depends on a sub-case rather than on the member alone.

## `prediction_disagreement` and its three sub-cases

This member covers the case where an activity produced a *prediction* — an intent label, a
trajectory, an assistance action — and reality then disagreed with it. Its `context` is
itself a discriminated union, on `sub_type`, with three members:

| `sub_type` | Meaning | Fields |
|---|---|---|
| `intent_inconsistency` | The labelled intent is inconsistent with what followed. | `intent_label`, `consistency_set[]`, `observed_continuation_signature` |
| `trajectory_divergence` | The observed trajectory left the predicted set. | `predicted_signatures[]`, `observed_signature`, `horizon_events` (positive integer), `divergence_index` (non-negative integer) |
| `action_no_effect` | An action was dispatched and the world did not change. | `command_id`, `pre_signature`, `post_signature` |

The distinction the posterior draws is between a wrong *guess* and a misfired *action*. The
first two sub-cases are guesses that turned out wrong, which is ordinary and cheap; the
third is an action confidently dispatched into the world to no effect, which is expensive
and is penalised in full.

## Outcome-conditional step sizes

`computeDeltas` maps an outcome to a `(alphaDelta, betaDelta)` pair. The values are:

| Outcome | α | β |
|---|---|---|
| Success (binary path) | 1 | 0 |
| Success (graded-yield path) | *y* | 1 − *y* |
| Failure with no `failure_mode` recorded | 0 | 1 (warning — but see note) |
| `execution_error` (undocumented, 93.5% of real failures) | 0 | 1 |

> **The warning has no production reader.** `computeDeltas` collects these into a
> `warnings: string[]` it is handed, and across `repos/activity-api/src/` the only code that
> ever *reads* that array is `blame-attribution.test.ts`. Every production call site passes
> it in and discards it. So "with a warning" describes a value that is computed correctly
> and observed by nobody outside the test suite — the same shape as the other findings on
> this page, and worth fixing before anyone relies on the warning as a signal.
| `verifier_negative` | 0 | 1 |
| `budget_exhausted` | 0 | 0.5 |
| `safety_breach` | 0 | 1 |
| `cascading` | 0 | 0 |
| `user_abort` | 0 | 0 |
| `prediction_disagreement` / `action_no_effect` | 0 | 1 |
| `prediction_disagreement` / `intent_inconsistency` | 0 | 0.5 |
| `prediction_disagreement` / `trajectory_divergence` | 0 | 0.5 |
| `prediction_disagreement` with an unknown or absent `sub_type` | 0 | 0.5 (with a warning) |
| An unrecognised `type` | 0 | 1 (with a warning) |

Read the zeroes deliberately. `cascading` scores nothing because the upstream cause already
carries the penalty and double-counting would blame a victim for its neighbour's defect.
`user_abort` scores nothing because a cancellation carries no evidence about the arm at
all. A half-penalty means the execution ran and something outside its own correctness
stopped it, or that a guess was wrong without an action misfiring.

The two defaults lean opposite ways on purpose. An unknown top-level `type` defaults to the
strict penalty, because an unmodelled failure is more likely a real rejection than a
neutral one. An unknown `prediction_disagreement` sub-case defaults to the half-penalty,
because two of its three sub-cases are halves and the member always represents a guess that
was wrong rather than a validator rejection.

## The graded success path

A success is not automatically worth a full unit of α. When the graded-yield path is in
force and the trace carries enough context, the credit is a yield *y* computed from the
execution's own economics: a cost score of `1 / (1 + cost / costRef)`, a productivity score
of `min(1, outputs / prodRef)` over the impulses the tasks produced, averaged with equal
weight, then mapped onto the interval between a floor and 1. The reference values are
`floor = 0.5`, `costRef = 0.02` (dollars), and `prodRef = 4` (output impulses), each
overridable through an authored tuning parameter.

So a free, productive success credits close to `α = 1, β = 0`, and an expensive success
that produced almost nothing credits closer to `α = 0.5, β = 0.5` — it is still a success,
never a penalty, but it does not outrank a cheap one. Without that context, or with the
graded path disabled, the binary `α = 1, β = 0` applies.

## The reach gate sits in front of all of it

Before any of the above is consulted, the trace's persisted reach verdict overrides its
exit status. `classifyReach` in `repos/activity-api/src/lib/reach-classify.ts` returns one
of four verdicts from the trace tags, the execution id, and the activity id:

- `reached` — the tags carry `reached:true`; treated as success.
- `not-reached` — the tags carry `reached:false`, or the trace is a legacy failure; penalised.
- `ungraded` — a structural satisfier satellite (an execution id prefixed `walk-satisfier-`
  or an activity id prefixed `satisfier:`), or a goal-host dispatch carrying no reach tag
  at all. The update is skipped entirely: `α = 0, β = 0`.
- `legacy-success` — no tags and a successful exit; credited, failing open for rows written
  before reach tagging existed.

`ungraded` is the load-bearing case. An outcome nobody graded is neither credited nor
blamed, so walk scaffolding cannot inflate a posterior and an unjudged dispatch cannot
punish an arm that may have done its job. It reuses the same `{0, 0}` idiom as `cascading`
and `user_abort`, which means every downstream write that is guarded on a non-zero delta is
suppressed for free.

## Two further conditions on where the credit lands

A trace whose every task is deterministic-tier skips the per-variant posterior update: a
cell-local Beta posterior over deterministic work captures uncertainty propagated from
upstream rather than any signal about the cell itself. Chain-credit propagation still
fires, so stochastic ancestors keep learning. When a trace carries no tier information at
all, the classifier conservatively treats it as stochastic and the update proceeds.

When a trace carries a composition chain, the same outcome is propagated to ancestors,
root-first, with a TD(λ) eligibility decay per step — λ defaults to 0.7 and must lie in the
open interval (0, 1), and at most four ancestors from the leaf are credited or blamed. A
sibling group produced by a parallel fan-out divides its per-ancestor delta by the group
width, so *k* siblings sum to one averaged ancestor update instead of crediting a shared
ancestor *k* times over.
