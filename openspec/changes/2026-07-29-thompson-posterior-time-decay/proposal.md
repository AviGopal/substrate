## Why

Thompson-sampling posteriors in activity-api (`variant_performance_metrics.thompson_alpha/beta`
and `context_thompson_scores.alpha/beta`) accumulate `alpha`/`beta` **without bound or decay** —
`(thompson_alpha ?? 1) + $alpha_delta` forever. A template that fails a run of executions during a
transient outage (an LLM-plane credit exhaustion, a stale registry, a federation circuit drop — all
observed and fixed this cycle) has its posterior mean permanently suppressed: it is rarely selected
again, so it is rarely re-tried, so the poisoned posterior never gets a chance to heal even after the
root cause is long fixed. `checkAndRetireTemplate` makes this worse, not better: it can **permanently
retire** a template on a windowed bad streak with no path back.

The identical bug was found and fixed in `llm-resolver-vessel/src/model-policy.ts` this cycle
(`recordArmOutcome`/`selectArm`): the hub's much larger, un-poisoned sample on the *same* model
(`mistral-small-latest`: hub alpha=7439/beta=304 ≈ 96% success vs. the local spoke's siloed
alpha=1/beta=80 ≈ 1% — pure stale poison from an earlier credit-dead period) proved the local
posterior was wrong, not the model. Per law 1 ("one selection primitive across all horizons"),
activity-template selection is architecturally the same primitive and carries the same risk, at
higher stakes (irreversible retirement vs. mere under-sampling).

## What Changes

- Add exponential time-decay toward the neutral prior `(1,1)` to BOTH posterior tables, applied at
  write time using the timestamp each table **already tracks** (`variant_performance_metrics.updated_at`,
  `context_thompson_scores.last_updated_at` — no schema migration needed):
  - `alpha_decayed = 1 + (alpha - 1) * 0.5^(age / halfLife)`, same for `beta`.
  - Half-life: 3 days (matches the llm-resolver-vessel fix; tune later against observed staleness
    incidents, not guessed once and frozen).
- Apply the decay in the SurrealQL `UPDATE ... SET` clauses in `posterior-update.ts`
  (`applyOutcomeToPosteriors`, both the unconditional `variant_performance_metrics` write ~line 753-762
  and the conditional `context_thompson_scores` write ~line 806-828), using `time::now() - updated_at`
  (a SurrealDB duration) converted to the decay factor in the query, OR by reading the current row,
  computing the decayed value in TypeScript, and writing the resolved number (safer: keeps the decay
  math in one tested TS function shared with the read/selection path, avoiding duplicate SQL-vs-TS
  logic drift). **Prefer the TS-computed approach** — mirrors `decayedCounts()` in
  `llm-resolver-vessel/src/model-policy.ts`, reusable in spirit though not in package (different repo).
- Apply the SAME decay at selection time (`src/routes/activities.ts:5750-5846`, before
  `betaSample(alphaBlended, betaBlended)`), consistent with the llm-resolver-vessel fix applying decay
  at both read (`selectArm`) and write (`recordArmOutcome`) sites.
- Do **NOT** touch `checkAndRetireTemplate`'s separate sliding-window (last-20-execution) retirement
  logic — it does not read `thompson_alpha`/`thompson_beta` directly, so this change does not affect
  retirement semantics. (A separate, follow-on question — should retirement itself become reversible /
  time-decayed — is out of scope here and should be evaluated only after this fix's telemetry is in.)
- Also touch the `enqueueVariantDelta` coalescing aggregator path (`2026-06-21 write-contention fix` —
  collapses concurrent +δ into one flush): confirm it composes correctly with decay (decay must be
  applied to the PRE-coalesce stored value once, not per-delta inside the aggregator, to avoid
  double-decaying a single flush).

## Impact

- Affected files: `repos/activity-api/src/lib/posterior-update.ts` (write-time decay, both tables),
  `repos/activity-api/src/routes/activities.ts` (selection-time decay ~line 5750-5846).
- Affected tests: add a per-function unit test for the decay helper (pure function, easily pinned —
  see `test/resolvers/vessel-mitosis-evaluate.test.ts` for the house style of pinning a numeric
  formula with concrete before/after values), plus an integration-style test asserting a
  long-untouched poisoned posterior (e.g. alpha=1, beta=80, last updated 30+ days ago) samples with a
  materially higher probability than an equally-poisoned but FRESH posterior (last updated seconds
  ago) — the property the whole fix is for.
- No schema migration: both decay-input timestamps already exist as columns.
- Follow this vessel's four-stage loop (VERIFY → DEBUG → SPEC → DEV) per `repos/activity-api/CLAUDE.md`;
  this proposal is the SPEC stage output. DEV should land as ONE commit touching the two files above,
  with the decay helper unit-tested before the write-site integration.
