# Tasks — M5 Information-Directed Sampling

> **Dependency ordering:** M5 DEV is **blocked on M1** (`concept_vugylIHzIMvk` — embedding-conditioned posterior) for the analytic-EIG path. Task M5-DEV-A1 explicitly checks M1 readiness before enabling `ids_analytic`. The Option-B MC fallback can ship without M1 but does not satisfy acceptance criterion A4 on its own — do not promote `ids_mc` to default without an A4-passing experiment.

---

## SPEC

- [ ] **M5-SPEC-1** Land `proposal.md` (this folder) with full IDS derivation, dependency on M1, three EIG options, acceptance criteria A1–A7.
- [ ] **M5-SPEC-2** Cross-link from `docs/architecture/LITERATURE_COMPARISON.md` (Thompson section) to `concept_u9KSvyDVjxoO` and this change folder. Cite Russo & Van Roy 2018.
- [ ] **M5-SPEC-3** Update `docs/architecture/SUBSTRATE_AS_MDP.md` selection-step section to note that Thompson is the *current* selector and IDS is the M5-refinement target; do **not** edit primitives, scopes, or stores (discipline gate).
- [ ] **M5-SPEC-4** Open neighbour-edges in concept-db: `concept_u9KSvyDVjxoO --requires--> concept_vugylIHzIMvk`, `concept_u9KSvyDVjxoO --refines--> concept_EaAYU3p6LsxT`, `concept_u9KSvyDVjxoO --sibling--> concept_skw2SmuLHZlN, concept_CD8s3H1N_0G8` (via `mcp__metabob__concept_link`).
- [ ] **M5-SPEC-5** Add an OpenSpec `findings/` note linking M5's regret-proxy definition to `services/thompson-sampling.ts:83` (`computeWeightedSuccessScore`) so the A4 gate has a single canonical source.

---

## DEV (per-file modifications)

> Do not start DEV until M1 (concept_vugylIHzIMvk) is at least **DEV-complete** on the embedding-conditioned posterior surface. Track M1 progress in its own change folder.

### Phase D1 — EIG estimators (additive, no behaviour change)

- [ ] **M5-DEV-D1.1** New file `repos/metabob-activity-api/src/services/ids/eig.ts`:
  - `export function entropyBeta(alpha: number, beta: number): number` — closed-form via lgamma + digamma.
  - `export function eigBeta(alpha: number, beta: number): number` — single-arm closed form (Option B baseline).
  - `export function eigEmbedding(embedding: number[], posterior: ParametricPosterior): number` — Option A; returns `½ log(1 + eᵀΣe/σ_n²)`. Reads posterior covariance from M1's API (depends on M5-DEV-D1.5).
  - `export function regretExpected(arms: ArmSummary[]): { mu: number[], vStar: number, deltas: number[] }` — computes `μ(a)` and `V*` from posterior moments; closed form under Thompson, sampled under M1.
- [ ] **M5-DEV-D1.2** New file `repos/metabob-activity-api/src/services/ids/ids-score.ts`:
  - `export function psi(delta: number, eig: number, eps = 1e-6): number` — returns `delta*delta / max(eig, eps)`.
  - `export function twoArmRandomisedIDS(arms: { id: string; delta: number; eig: number }[]): { aId: string; aPrimeId: string; q: number }` — O(K²) search per §2.3.
- [ ] **M5-DEV-D1.3** Unit tests `repos/metabob-activity-api/src/services/ids/eig.test.ts` + `ids-score.test.ts`:
  - Closed-form `entropyBeta` matches scipy reference on 50 samples.
  - `psi` floors `eig` at `eps`.
  - `twoArmRandomisedIDS` mixing weights sum to 1, support ≤ 2, never both `eig=0`.
  - Cold-start (α=β=1, K=10): IDS marginal selection within ±3% of uniform (A5).
  - Synthetic correlated-arm benchmark: mean cumulative regret of IDS ≤ 0.5× Thompson over 100 seeds (A3).
- [ ] **M5-DEV-D1.4** New file `repos/metabob-activity-api/src/services/ids/posterior-source.ts`:
  - `export type ArmSummary = { id: string; alpha: number; beta: number; embedding?: number[] }`.
  - `export type ParametricPosterior = { mean: number[]; cov: number[][]; noiseVar: number }` — Option A interface.
  - `export async function loadParametricPosterior(orgId, accountId): Promise<ParametricPosterior | null>` — calls into M1's API (resolver shape `embedding_conditioned_posterior`); returns null on cold start, triggering Option B fallback in the selector.
- [ ] **M5-DEV-D1.5** Block on M1: assert `embedding_conditioned_posterior` is registered in `repos/metabob-activity-api/src/config.ts` (the `config.discovery.shapes` list) before this task completes. If absent, leave `loadParametricPosterior` returning `null` and ship Option B only.

### Phase D2 — Selector integration (single behavioural switch)

- [ ] **M5-DEV-D2.1** `repos/metabob-activity-api/src/services/recommendation.ts`:
  - Add `export function idsScore(arm, posterior, opts): { score: number; selection_method: string; debug?: {...} }` as a sibling to `thompsonScore` (line 343).
  - Do **not** delete `thompsonScore`; it is the fallback (criterion A5).
  - Update the two `.sort(...)` sites at `:186` and `:210` to consume a `scoreFn` argument; default remains `thompsonScore`.
  - Mutate `applyCompatibilityFilter` (line 74) to accept `scoreFn` and `selection_method` in its returned shape (`_compatibility_score`, `_selection_method`). Keep the signature backwards-compatible by defaulting `scoreFn = thompsonScore`.
- [ ] **M5-DEV-D2.2** `repos/metabob-activity-api/src/routes/activities.ts` `POST /recommend` handler (line 5691):
  - Read env `RECOMMEND_SELECTION_METHOD` (default `thompson`; values `thompson | ids_analytic | ids_mc`).
  - When `ids_analytic`: call `loadParametricPosterior`; if it returns null, log-warn and fall back to `ids_mc`. If `ids_mc` is also gated off, fall back to `thompson`.
  - Pass the chosen `scoreFn` into `applyCompatibilityFilter` and downstream sorts.
  - Decorate each emitted recommendation with `selection_method`, and (when `RECOMMEND_DEBUG_IDS=true`) `regret`, `eig`, `psi` per A6.
- [ ] **M5-DEV-D2.3** `repos/metabob-activity-api/src/routes/goal-paths.ts` `sampleBeta` site (line 123, used at line 775):
  - Mirror D2.2 — accept the same env flag; when IDS is active replace the `sampleBeta`-based sort with `idsScore`. Keep `sampleBeta` for non-recommendation callers.
- [ ] **M5-DEV-D2.4** `repos/metabob-activity-api/src/services/discover-by-shapes.ts` (line 154, `thompson_alpha` consumer):
  - No behavioural change required; this site reads scores but does not select. Add a comment noting that the selection upstream may now be IDS.

### Phase D3 — Observability + safety

- [ ] **M5-DEV-D3.1** Extend the `/recommend` response schema in `repos/metabob-activity-api/src/models/schemas.ts` with optional `selection_method`, `regret`, `eig`, `psi` fields. Backwards-compatible (all optional).
- [ ] **M5-DEV-D3.2** Add metrics (Prometheus) in `repos/metabob-activity-api/src/utils/`: `recommend_selection_method_total{method}`, `recommend_eig_seconds`, `recommend_regret_proxy`. Wire into the `/recommend` handler.
- [ ] **M5-DEV-D3.3** Add feature-flag guard: if `RECOMMEND_SELECTION_METHOD=ids_analytic` is set but `loadParametricPosterior` has returned null on > 5% of recent calls, auto-downgrade to `thompson` and emit a `selectorAutoRevert` log line (criterion A4 auto-revert).

### Phase D4 — Tests

- [ ] **M5-DEV-D4.1** Integration test `repos/metabob-activity-api/src/routes/__tests__/recommend-ids.test.ts`:
  - With `RECOMMEND_SELECTION_METHOD=thompson`, output matches the existing Thompson baseline (snapshot).
  - With `RECOMMEND_SELECTION_METHOD=ids_mc` on independent-Beta priors, output matches Thompson within tolerance (A5 cold-start).
  - With `RECOMMEND_SELECTION_METHOD=ids_analytic` on a fake M1 posterior with strong correlation, selected arm is the higher-EIG arm even when its `μ` is slightly below the Thompson winner.
- [ ] **M5-DEV-D4.2** Regression-gate harness `validation/scripts/ids-vs-thompson-replay.ts`:
  - Replays the last 7 days of `/recommend` calls against both selectors.
  - Emits `selection_method × cumulative_regret_proxy` summary. Used by VERIFY to confirm A4.

---

## DEPLOY

- [ ] **M5-DEPLOY-1** Helm values: add `RECOMMEND_SELECTION_METHOD` (default `thompson`) and `RECOMMEND_DEBUG_IDS` (default `false`) to `repos/deployment/charts/metabob-activity-api/values.yaml`. Do **not** flip the default until M5-VERIFY-3 passes.
- [ ] **M5-DEPLOY-2** Canary roll-out matrix in `repos/deployment/environments/canary.overrides.yaml`:
  - Stage 1: `ids_mc` on 10% of `/recommend` traffic (header-based shadow read, no behavioural change).
  - Stage 2: `ids_analytic` on 10% after M1 GA.
  - Stage 3: promote to 100% after a 7-day clean A4 gate.
- [ ] **M5-DEPLOY-3** Update `docs/SUBSTRATE.md` env-var matrix with the new flags.
- [ ] **M5-DEPLOY-4** Block production promotion on M1 production GA + A4 gate green for 7 consecutive days.

---

## VERIFY

- [ ] **M5-VERIFY-1** Unit-test suite green (M5-DEV-D1.3, D4.1).
- [ ] **M5-VERIFY-2** Synthetic correlated-arm benchmark (A3): IDS regret ≤ 0.5× Thompson on 100 seeds.
- [ ] **M5-VERIFY-3** Live A4 gate: 7-day window, IDS cumulative-regret-proxy ≤ 0.7× Thompson baseline. Auto-revert wired (M5-DEV-D3.3).
- [ ] **M5-VERIFY-4** Cold-start A5: empty-corpus `/recommend` returns marginal selection within ±3% of uniform.
- [ ] **M5-VERIFY-5** Observability A6: with `RECOMMEND_DEBUG_IDS=true`, `regret`/`eig`/`psi` populate on every candidate. Dashboard panel added.
- [ ] **M5-VERIFY-6** Discipline-gate audit: confirm no new scopes, primitives, or stores were introduced; diff scope is restricted to `services/ids/`, `services/recommendation.ts`, `routes/activities.ts` (recommend handler), `routes/goal-paths.ts` (recommend handler), `models/schemas.ts` (optional fields), and Helm. (concept_7mzv7SQN_7JB)
- [ ] **M5-VERIFY-7** Concept-db: confirm `concept_u9KSvyDVjxoO` graph edges from SPEC-4 are live and queryable via `mcp__metabob__concept_neighbors`.
- [ ] **M5-VERIFY-8** Recursive substrate-citizen check: did substrate authoring produce any of these artefacts? If 100% operator-authored, file a finding under `feedback_operator_fan_out_when_substrate_could_author.md` and draft the corresponding gap-closing detector spec.
