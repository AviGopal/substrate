# Tasks: Concept-Conditioned Thompson Prior

## SPEC

- [ ] S1. Document mechanism in `docs/architecture/SUBSTRATE_AS_MDP.md`
      as a §3.1 addendum — empirical-Bayes prior seeding, citing
      `concept_uTVZPoaxMmo2`.
- [ ] S2. Add an entry to
      `docs/architecture/LITERATURE_COMPARISON.md` under
      "Empirical Bayes / partial pooling" — explain that concept
      similarity acts as the neighbor kernel.
- [ ] S3. Record acceptance criteria 1–6 (proposal.md) as the spec
      contract.

## DEV

- [ ] D1. `repos/metabob-activity-api/src/lib/prior-seed.ts`
      (NEW, ~80 LOC) — module exporting `seedPriorFromConcepts(
      templateId, signature, orgId): Promise<{alpha0: number,
      beta0: number, source: 'concepts'|'fallback'}>`. Env-configured:
      `CONCEPT_DB_URL`, `PRIOR_SEED_K` (default 5),
      `PRIOR_SEED_KAPPA` (default 10),
      `PRIOR_SEED_TIMEOUT_MS` (default 500), `PRIOR_SEED_ENABLED`
      (default `true`). Returns
      `{alpha0: 1, beta0: 1, source: 'fallback'}` on any error,
      timeout, empty response, or disabled flag. Emits a structured
      `logger.debug` line `prior_seed_applied` with both branches
      tagged for offline auditing.
- [ ] D2. `repos/metabob-activity-api/src/lib/posterior-update.ts`
      lines 540–550 (the `context_thompson_scores` CREATE branch):
      replace the literal `1.0` baseline in the CREATE arm with
      `$alpha0` / `$beta0` bound parameters, populated by an
      `await seedPriorFromConcepts(...)` call placed above the
      `LET $existing = …` query. Apply only when `$existing` is empty
      AND `$cardinality < $cap` — i.e. only on CREATE, never on UPDATE
      (existing posteriors are sovereign).
- [ ] D3. `repos/metabob-activity-api/src/lib/posterior-update.ts`
      lines 311–316 (chain-credit CREATE branch): same substitution.
      The ancestor write should seed the same way using the ancestor's
      `(activity_id, signature)`.
- [ ] D4. `repos/metabob-activity-api/src/routes/execution-traces.ts`
      lines 2463–2464 and 2530–2531: legacy inline writes — gate
      these behind `PRIOR_SEED_LEGACY_PATHS` (default `false`). The
      posterior-update.ts path is the canonical write; the legacy
      duplicates remain at Beta(1, 1) unless explicitly opted in.
      Avoid double-seeding.
- [ ] D5. `repos/metabob-activity-api/src/lib/prior-seed.test.ts`
      (NEW): unit tests for `seedPriorFromConcepts` covering:
      empty concept-db response → fallback; timeout → fallback;
      malformed response → fallback; healthy response with K=5 →
      computed (μ_α, μ_β, κ-scaled). Mock `fetch` per existing test
      style.
- [ ] D6. `repos/metabob-activity-api/src/lib/posterior-update.test.ts`
      (extend): integration-style test exercising the CREATE branch
      with `seedPriorFromConcepts` injected, asserting α₀ + β₀ ≈ κ.

## DEPLOY

- [ ] P1. `repos/deployment/charts/metabob-activity-api/values.yaml`:
      add env keys `PRIOR_SEED_ENABLED=true`,
      `PRIOR_SEED_K=5`, `PRIOR_SEED_KAPPA=10`,
      `PRIOR_SEED_TIMEOUT_MS=500`,
      `CONCEPT_DB_URL=http://concept-db.activity-system.svc.cluster.local:8081`,
      `PRIOR_SEED_LEGACY_PATHS=false`.
- [ ] P2. `scripts/substrate/.env.in`: same set of env keys for the
      single-container substrate (concept-db on localhost:8081 inside
      the container).
- [ ] P3. Canary deploy: push to `dev`, wait for canary rollout,
      verify `/health` returns 200 and a `prior_seed_applied`
      log line appears within 5 minutes of first new signature.

## VERIFY

- [ ] V1. Pre-change baseline snapshot:
      `bun run validation/scripts/learning-rate-window.ts > validation/results/2026-06-04-prelim-baseline.json`
      against canary.
- [ ] V2. Verify `concept-db kill` falls back: in the local substrate,
      `systemctl stop concept-db`, run a goal that creates a new
      signature, confirm a `prior_seed_source=fallback` log appears
      and the row writes Beta(1, 1) + delta.
- [ ] V3. Re-run reuse benchmark
      (`validation/scripts/reuse-benchmark.ts`); confirm MRR ≥ 0.2161
      (= 0.2361 − 0.02, acceptance criterion 4).
- [ ] V4. 7-day post-deploy: re-run `learning-rate-window.ts` and
      compare against V1 baseline. Pass = ≥ 20% reduction in
      trial-count-to-converge across new signatures.
- [ ] V5. Re-run Phase 18.4.7 chain-credit integration test
      unchanged — must still PASS.
