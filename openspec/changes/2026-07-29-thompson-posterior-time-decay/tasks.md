# Tasks

## 1. Decay helper

- [ ] Add a pure `decayedCounts(alpha, beta, updatedAt, halfLifeMs)` helper in
      `repos/activity-api/src/lib/posterior-update.ts` implementing
      `x_decayed = 1 + (x - 1) * 0.5^(age / halfLife)` for both counts, mirroring the
      shape of `decayedCounts()` in `llm-resolver-vessel/src/model-policy.ts`.
- [ ] Half-life is read as a shaped value, not a frozen constant — an in-process
      literal here is exactly the unlearnable knob law 1 forbids, and the proposal
      already says to tune it against observed staleness rather than guess once.
- [ ] Unit-test the helper with concrete before/after numbers, per the house style in
      `test/resolvers/vessel-mitosis-evaluate.test.ts`. Pin at least: zero age is a
      no-op; one half-life halves the excess over the prior; unbounded age converges
      to `(1,1)` and never below it.

## 2. Write-time decay

- [ ] Apply the helper in `applyOutcomeToPosteriors` at the unconditional
      `variant_performance_metrics` write, computing the decayed value in TypeScript
      and writing the resolved number rather than expressing the decay in SurrealQL —
      one tested implementation, no SQL-vs-TS drift.
- [ ] Apply it at the conditional `context_thompson_scores` write, using that table's
      own `last_updated_at`.
- [ ] Confirm composition with the `enqueueVariantDelta` coalescing aggregator: decay
      applies once to the pre-coalesce stored value, never per-delta inside the flush,
      or a single flush double-decays.

## 3. Selection-time decay

- [ ] Apply the same helper before `betaSample(alphaBlended, betaBlended)` in the
      selection path in `repos/activity-api/src/routes/activities.ts`, matching the
      llm-resolver-vessel fix which decays at both read and write.

## 4. Prove the property the fix exists for

- [ ] Integration-style test: a long-stale poisoned posterior (alpha=1, beta=80, last
      updated 30+ days ago) samples with materially higher probability than an equally
      poisoned but freshly-updated one. Without this, the change is untested where it
      matters — the whole point is that a posterior poisoned during a transient outage
      can heal once the cause is fixed.

## 5. Out of scope, deliberately

- [ ] Do not touch `checkAndRetireTemplate`. Its sliding-window retirement does not read
      `thompson_alpha`/`thompson_beta`, so decay does not change retirement semantics.
      Whether retirement should itself become reversible is a separate question, worth
      asking only once this fix's telemetry exists — permanent retirement with no path
      back is the higher-stakes half of the same problem.

## Verification

- [ ] No schema migration: both decay-input timestamps already exist as columns.
- [ ] After landing, compare a known-poisoned variant's sampled selection rate before
      and after. Change one thing and record that you did.
