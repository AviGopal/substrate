# Tasks: TD(λ) eligibility-trace credit propagation

## SPEC
- [ ] S1. Anchor `concept_iae171XpW50_` (`eligibility_trace_credit_propagation`) as authoritative; cross-link to `concept_AwkpcryQXDjK` (composition_chain) and `concept_TbN0eSf7U_hM` (parent — learning-rate refinements).
- [ ] S2. Document the (variance, bias) trade-off in `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` Thompson-Sampling section: scalar λ ∈ (0,1), default 0.7, env override `TD_LAMBDA`.
- [ ] S3. Confirm gate `concept_7mzv7SQN_7JB`: this change adds **no new tier, primitive, or scope**.

## DEV
- [ ] D1. Apply `mvp.patch` to `repos/metabob-activity-api/src/lib/posterior-update.ts` and `repos/metabob-activity-api/test/posterior-update.test.ts`.
- [ ] D2. Add `TD_LAMBDA` row to `repos/metabob-activity-api/CLAUDE.md` env-var table.
- [ ] D3. Run `bun run typecheck && bun test src/lib/posterior-update` (workspace cwd). Confirm new `TD(λ) — env override` describe-block passes.
- [ ] D4. Verify the existing 18.4.5 / 18.4.6 / edge-case test suites still pass — the patch updates their expected α/β values from the 0.5-baseline to the 0.7-baseline.

## DEPLOY
- [ ] X1. Substrate-only: rebuild metabob-activity-api image; restart via `make -C scripts/substrate substrate-restart-metabob-activity-api`.
- [ ] X2. No env change required for default behaviour (0.7 is the new code default). Operators wanting the legacy decay can set `TD_LAMBDA=0.5` explicitly.
- [ ] X3. (Optional, canary-only when canary returns) update `repos/deployment/environments/canary.overrides.yaml` to surface `TD_LAMBDA` for ad-hoc tuning.

## VERIFY
- [ ] V1. Trigger a synthetic 3-deep composition chain in the local substrate; inspect `variant_performance_metrics` deltas; confirm `[0.7, 0.49, 0.343]` for success and matching β for non-cascading failure (A1, A2).
- [ ] V2. Set `TD_LAMBDA=2.0`; restart; tail logs; confirm one `td_lambda_invalid` warn line and fallback to 0.7 (A3).
- [ ] V3. Run `validation/scripts/failure-mode-harness.ts` once at `TD_LAMBDA=1.0` and once at default; compare ancestor-α stdev across runs; record a finding under `openspec/changes/2026-06-04-learning-rate-6-td-lambda-credit/findings/` (A4).
- [ ] V4. After ≥ 10 harness cycles, compare Thompson posterior mean convergence between historical (λ=0.5) traces and new (λ=0.7) traces on chain-root templates (A5).
- [ ] V5. `mcp__metabob__concept_search query=eligibility_trace` — confirm `concept_iae171XpW50_` is still the only concept in this lineage; no accidental siblings minted (A6).
