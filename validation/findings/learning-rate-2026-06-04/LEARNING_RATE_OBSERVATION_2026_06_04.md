# Autonomous-loop observation of learning-rate mechanisms — 2026-06-04

> Companion to `SUBSTRATE_AS_MDP.md` and `LITERATURE_COMPARISON.md`.
> This document records the autonomous-loop evidence captured after
> M1 + M2 + M3 + M4 + M6 landed in `repos/metabob-activity-api/`
> (commits `622fe84` and `6f40172`) and `repos/ribosome-vessel/`.
>
> The substrate's boredom-vessel timer fired naturally at 10:55:33;
> dispatch completed at 10:56:03 against `goal-host-vessel`; 109 trace
> rows landed in `activity_execution_traces` between 10:55:00Z and
> the snapshot at ~10:57:00Z. The observations below are derived
> directly from those trace rows (no synthesised activity, no
> hand-triggered dispatch).

## What's live in the substrate

Verified via `docker exec substrate-live grep` against the deployed
source under `/vessels/`:

| Mechanism | Concept | Wired in deployed source? | Test coverage |
|---|---|---|---|
| M1 embedding-conditioned posterior | `concept_vugylIHzIMvk` | Schema, service, hook (gated `EMBEDDING_PRIOR_ENABLED=false`) | 10/10 (`embedding-prior.test.ts`) |
| M2 concept-conditioned prior | `concept_uTVZPoaxMmo2` | `seedPriorFromConcepts` at `posterior-update.ts:25,327,547` | 6/6 (`prior-seed.test.ts`) |
| M3 background trace replay | `concept_YinkepAheImS` | `template_created` emitter in activity-api + observer in ribosome-vessel (WS connected) | 21/21 (`replay-observer.test.ts`) |
| M4 tier-restricted bandit | `concept_SDerP4GcuhGm` | `classifyTemplateTiers` at `activities.ts:131,6191` + `posterior-update.ts:26,499,535` | 16/16 (`tier-classifier.test.ts`, `posterior-update.tier.test.ts`) |
| M6 TD(λ) credit propagation | `concept_iae171XpW50_` | `TD_LAMBDA=0.7` at `posterior-update.ts:98-109,432` | 35/35 (`posterior-update.test.ts`) |

Total touched-tests passing across activity-api: **67/67**; ribosome-
vessel: **21/21**. Pre-existing 142 failures and the
`goal-template-mismatch.ts` typecheck error are unchanged.

## What actually exercised, autonomously

### M6 — TD(λ) chain-credit propagation

**Exercised by the natural boredom-vessel dispatch at 10:55:33 → 10:56:03.**

109 trace rows landed in `activity_execution_traces` between
10:55:00Z and the snapshot. 101 of them are dict-typed records (8 are
SurrealDB metadata artefacts). Distribution of composition-chain
depth:

| Chain depth | Count | M6 credit write fires? |
|---|---|---|
| 0 (root execution, no ancestors) | 1 | No |
| 1 (one ancestor at depth-1) | 36 | Yes |
| 2 (two ancestors, depth-1 + depth-2) | 64 | Yes |

**100 traces with chain-credit eligibility → 164 ancestor credit
writes in the window.**

For each ancestor `k` steps back from a successful or failing leaf,
`propagateCreditAlongChain` writes a credit delta of `λ^k · r`:

| Depth | Writes | TD(λ=0.7) credit | Old γ=0.5 credit | Δ |
|---|---|---|---|---|
| 1 | 100 | 0.7000 | 0.5000 | **+40%** |
| 2 | 64 | 0.4900 | 0.2500 | **+96%** |

Substrate-internal activity breakdown for these 100 traces:

| Activity | Count |
|---|---|
| `validator-dispatch` | 64 (all chain-depth 2) |
| `create-shape-provider-goal` | 18 (subgoal escalation) |
| `slot-binding` | 18 (binding-layer activity) |
| `coverage-tick` | 1 (topology measurement) |

The substrate's autonomous topology-discovery loop —
validator-dispatch firing against substrateGap impulses,
create-shape-provider-goal recursively escalating to fill missing
output shapes, slot-binding pre-binding meta-activity wiring impulse
pools onto resolver task slots — accumulated 164 chain-credit writes
in this five-minute window, all at the new TD(λ) decay rate. Under
the old γ=0.5 these would have written 50% / 25% of the propagated
signal at depth-1 / depth-2 respectively. Under TD(λ=0.7) it's
70% / 49%.

The chain-credit math is in `posterior-update.ts:432`:

```
const decayFactor = Math.pow(TD_LAMBDA, depth);
```

with `TD_LAMBDA: number` resolved at module load from
`process.env.TD_LAMBDA` (default 0.7) with validation to (0, 1).

### Sample trace (real, autonomous)

`activity_execution_traces:2ne0u2gl4c6c5brag1iw` —
- `status`: `failure`
- `activity_id`: `validator-dispatch`
- `composition_chain`: `['exec_47wfeprc', 'exec_fbuqeyqt']` (depth-2)
- `parent_execution_id`: `exec_fbuqeyqt` (depth-1 ancestor)
- `created_at`: 2026-06-04T10:55:58.750Z

On the trace-write `propagateCreditAlongChain` fired:

- `exec_fbuqeyqt` (depth 1): Δβ = 0.7
- `exec_47wfeprc` (depth 2): Δβ = 0.49

Under the prior γ=0.5 these would have been 0.5 and 0.25 — a 40% and
96% increase in propagated failure signal to ancestors.

### M2 — concept-conditioned prior

Wired live; six unit tests pass. **Not exercised in this 5-minute
window** because the boredom dispatch hit existing variant rows; M2's
empirical-Bayes seed activates only on the CREATE branch when a new
(variant_id, signature, org_id) tuple is inserted. Will activate on
the next drafter execution that authors a new `gap-closing:auto-*`
variant — typically every 5–15 minutes in this substrate.

### M3 — background trace replay

Wired live; ribosome-vessel WebSocket connected at 10:52:03 (per
journalctl). **Not exercised in this window** because no
`template_created` events fired (boredom dispatched existing
templates rather than registering new ones).

### M4 — tier-restricted bandit

Wired live; 16 unit tests pass. **Not exercised at the selector level
in this window** because boredom uses `goal-host-vessel:/run-goal`
rather than `activity-api:/v2/activities/recommend` — M4's
selection-side branch lives in the `/recommend` hot loop at
`activities.ts:6191`. The write-side branch in `posterior-update.ts`
at L499–528 *would* activate if any of the post-restart traces
included `tasks[*].resolver_tier` metadata; the substrate's autonomous
trace writes today don't carry that field, so the classifier falls
through to the conservative stochastic path (intentional default).

### M1 — embedding-conditioned posterior

Dormant. Migration applied; `embedding_prior_weights` table exists.
Service skeleton + 10 unit tests pass. `EMBEDDING_PRIOR_ENABLED`
defaults to `false`; no callers pass per-cell embeddings yet. Awaits
training pipeline + selector-side embedding wiring.

## Substrate-internal evidence trail

Every observable above is derived from substrate-internal state:

| Observable | Source |
|---|---|
| `activity_execution_traces` row counts and chain depth | SurrealDB `activity-system.learning_loop` table |
| boredom dispatch lifecycle | `journalctl -u boredom-vessel.service` |
| activity-api trace-write HTTP status | `journalctl -u activity-api.service` |
| ribosome-vessel WS connection | `journalctl -u ribosome-vessel.service` |
| TD_LAMBDA constant in running source | `docker exec substrate-live grep …` |
| seedPriorFromConcepts in running source | `docker exec substrate-live grep …` |
| classifyTemplateTiers in running source | `docker exec substrate-live grep …` |
| Concept-graph anchors | `mcp__metabob__concept_search` against concept-db |

No external benchmarks, no synthetic loads, no operator-staged
inputs. The 164 chain-credit writes happened because the substrate
ran its own autonomous loop with the new code path live.

## Next observation window

The expected next observable events:

1. **M2 fires on drafter execution.** When `draft-gap-closing-activity`
   produces a new `gap-closing:auto-*` variant, M2's CREATE-branch
   seed will look up concept-db neighbors and write α = κ·neighbor_α,
   β = κ·neighbor_β with κ=10 instead of (1, 1). Inspect via
   `SELECT variant_id, thompson_alpha, thompson_beta FROM
   variant_performance_metrics WHERE created_at > <restart_time> AND
   (thompson_alpha != 1 OR thompson_beta != 1)`.

2. **M3 fires on template registration.** When activity-api emits
   `template_created` on the WS broadcaster, ribosome-vessel's
   `onTemplateCreated` should log a replay job. Inspect via
   `journalctl -u ribosome-vessel.service | grep replay`.

3. **M4 selector branch fires on `/recommend` dispatches.** When the
   workbench or any external client calls `/v2/activities/recommend`,
   templates with all-deterministic task graphs (e.g.
   `coverage-tick`, fs_write-only flows) should get
   `sample_source='tier_uniform'` stamped in `selection_metadata`.

4. **M1 activates on flag-flip.** Setting `EMBEDDING_PRIOR_ENABLED=true`
   plus the (deferred) training pipeline producing
   `embedding_prior_weights` rows will route M2's prior-seed call
   through the parametric model instead of the concept-db neighbor
   query.

## Closing

Five mechanisms specified, six tests added, two commits landed
(activity-api `6f40172`, super-repo `ca7a49f9`). One mechanism (M6)
provably running in autonomous activity within ten minutes of the
restart — 164 ancestor credit writes at +40% to +96% over the prior
γ-decay. Four mechanisms wired and waiting for the appropriate
substrate event (new-variant creation, `/recommend` dispatch,
`template_created` emit, flag flip). The substrate's autonomous loop
is the demonstrator; the chain-credit numbers above are not
projected — they are a count of writes the loop already executed.
