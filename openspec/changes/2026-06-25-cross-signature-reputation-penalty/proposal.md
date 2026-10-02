# Cross-signature reputation penalty at the selection chokepoint

**Date:** 2026-06-25
**Vessel:** activity-api (selection / recommend path)
**Stage:** SPEC (investigation complete — chokepoint mapped below)
**Lever:** 3 of 3 from the 2026-06-25 composition-gap audit. Levers 1 (validate↔mint parity) and 2 (orphan loop closure) landed; this is the net-new selection-side lever.

## Problem

Activity selection is state-conditioned Thompson sampling: each `(state_signature, template)` cell has its own `Beta(α,β)`, blended at recommend time with the template's signature-agnostic global posterior (`v_activity_score`, grouped by `activity_id, org_id`). The blend (activity-api `src/routes/activities.ts` ~L6570-6592) is a **linear interpolation**:

```
blendWeight = nContext >= 5 ? 0.7 : nContext >= 2 ? 0.3 : 0.0
alphaBlended = blendWeight * ctxAlpha + (1 - blendWeight) * globalAlpha
betaBlended  = blendWeight * ctxBeta  + (1 - blendWeight) * globalBeta
sample = betaSample(alphaBlended, betaBlended)     // L6619, argmax'd downstream
```

**Two regimes, only one is a hole:**

1. **Fresh / weak signature (`blendWeight = 0.0`)** — `alphaBlended = globalAlpha`. The sample is drawn straight from the global posterior. A globally-bad template (high aggregate β) is **already damped here.** *No hole. A flat reputation multiply would DOUBLE-damp this case.*

2. **Gamed specific signature (`blendWeight = 0.7`, `nContext >= 5`)** — the sample is 70% from the per-signature posterior. A "gaming" template (genuine-edge-probe, compose-* wrapper) that has accumulated strong **local** α on one signature it games **escapes its bad global reputation** — global is downweighted to 0.3. This is the live hole: reach-gate catches it post-hoc (β-penalty after a wasted execution), but selection keeps picking it on its gamed signature. This is consistent with the audit's measured pollution (36 edge-probe variants, compose-* wrappers selected over genuine producers).

The audit framed this as "reboot at Beta(1,1) on a fresh signature." Investigation corrected that: the fresh-signature case is already covered by the global fallback; the actual escape is **strong-local-overrides-bad-global**.

## Change (DEV scope, activity-api recommend path)

Re-inject global reputation **proportional to how much the blend discounted it**, so we damp the gamed-signature escape WITHOUT double-damping the fresh-signature case.

Define the global reputation mean `μ_g = α_global / (α_global + β_global)` (from `scores`, already in scope at L6463 — **no extra DB read**). Apply a reputation factor that scales with the *local* blend weight:

```
reputationFactor = 1 - blendWeight * (1 - μ_g)
sample = betaSample(alphaBlended, betaBlended) * reputationFactor
```

Properties (the reason for this exact form):
- `blendWeight = 0.0` → `reputationFactor = 1.0`. **No double-damp** in the fresh-signature regime (global already in the Beta params).
- `blendWeight = 0.7`, bad global (`μ_g = 0.2`) → `factor = 1 - 0.7·0.8 = 0.44`. A gamed-signature sample (~0.9) is pulled to ~0.40.
- `blendWeight = 0.7`, good global (`μ_g = 0.85`) → `factor = 1 - 0.7·0.15 = 0.895`. A genuine producer is barely touched.
- Monotone: worse global reputation and/or more local override → stronger damping. Never amplifies (`factor ≤ 1`).

Guards:
- `scores` missing (template with no global row at all) → `reputationFactor = 1.0` (unchanged; nothing to damp by). A genuinely-new template is NOT penalized — it has no bad reputation yet, only an uninformed prior. This preserves exploration / reuse-before-mint (we damp *demonstrated* bad reputation, not novelty).
- Require a minimum global sample count before the factor bites (e.g. `α_global + β_global - 2 >= MIN_GLOBAL_OBS`, default 5) so a template with 1 unlucky global failure isn't suppressed. Below the floor → `reputationFactor = 1.0`.
- Put the whole thing behind an env flag `CROSS_SIG_REPUTATION_PENALTY=1` (default off until measured), and log `{template_id, blendWeight, mu_g, reputationFactor}` at debug when active, so the blend×reputation interaction is observable and we can A/B the selection distribution.

## Why this is the right altitude

- It is a **selection-stage** damping that complements the **post-hoc** reach-gate: the reach-gate stops a bad approach *after* a wasted execution + β-penalty; this stops it from being *selected* on its gamed signature in the first place. Together they raise the cost of gaming a single signature to near-zero payoff.
- It does NOT duplicate the scope-hierarchy warm-start (§4.2 MDP) — that is documented-but-unimplemented; the current linear blend is what exists, and this rides on top of it without assuming the hierarchical prior. If/when the strict hierarchical prior lands, this factor is retired (it would then double-count) — noted for the future implementer.
- It preserves **reuse-before-mint**: novelty (no global row) is untouched; only *demonstrated* global underperformance is damped. This pushes selection traffic off gaming cells toward genuine producers, which is the λ₁-raising direction.

## Out of scope

- The strict hierarchical prior (`Beta(α_global + ctx_succ, β_global + ctx_fail)`) replacing the linear blend — larger change, separate spec. This lever is the cheap, reversible interim.
- development-vessel's secondary `thompson-score.ts` selector (ias-executor producer-pick) — not the active recommend chokepoint; leave unchanged.

## Verification

- `bun run lint` (tsc --noEmit + shape-dispatch-check) green; `bun test` green incl. a new unit test for the reputation factor.
- **Unit test (the core proof):** construct two candidates on the SAME gamed signature — (A) gaming: ctx `Beta(20,1)` (strong local), global `Beta(2,30)` (bad); (B) genuine: ctx `Beta(10,2)`, global `Beta(40,5)` (good). With the flag ON, assert B's expected post-factor score > A's across a seeded sample batch, and that with the flag OFF (current behavior) A frequently wins. Also assert: a fresh-signature candidate (`blendWeight=0`) gets `reputationFactor==1.0` (no double-damp), and a no-global-row candidate gets `1.0` (novelty preserved).
- **Live (measured, not just asserted):** with the flag on, dispatch a goal whose recommend pool includes a known gamed wrapper and a genuine producer; confirm via the debug log that the wrapper's `reputationFactor` is low and selection shifts toward the genuine producer. Compare selection distribution flag-off vs flag-on over N dispatches.

## Risk

Low and reversible (env-flag-gated, `factor ≤ 1` so it can only damp, never amplify; novelty and low-observation templates are explicitly exempt). The one real interaction risk — double-damping vs a future hierarchical prior — is documented and the form is specifically chosen to be inert when `blendWeight=0`.
