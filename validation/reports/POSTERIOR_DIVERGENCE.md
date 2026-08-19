# Thompson is sampling from something unrelated to what happened

`bun run validation/scripts/posterior-divergence.ts` — measured against the hub
store the sampler actually reads.

```
arms queried            486
still at exactly (1,1)  246   never graded; drawn at the prior forever
graded with n >= 5      183

posterior UNDERSTATES its own success rate   159/183
posterior OVERSTATES it                       16/183
pairs the evidence separates                16532
  of those, ordered AGAINST the evidence     7738 (47%)
Kendall tau-b (1 = agrees, 0 = unrelated)    0.064
```

Every row of `variant_performance_metrics` carries two views of one history: the
tally of what happened (`successful_executions` / `total_executions`) and the
Beta the sampler draws from (`thompson_alpha` / `thompson_beta`). They should
track. They don't:

| arm | succ | fail | empirical | posterior mean |
|---|---:|---:|---:|---:|
| `satisfier:source_code` | 384 | 49 | **0.89** | **0.10** |
| `satisfier:activity_template` | 356 | 86 | 0.81 | 0.11 |
| `satisfier:problem_detection` | 506 | 127 | **0.80** | **0.02** |
| `satisfier:memoryNote_write` | 647 | 267 | 0.71 | 0.19 |
| `satisfier:shellResult` | 2035 | 1579 | 0.56 | 0.09 |
| `satisfier:gap_compose` | 100 | 377 | 0.21 | 0.04 |
| `universal-tool-fallback` | 1127 | 2593 | 0.30 | 0.18 |

**tau = 0.064 is the number that matters.** A uniformly pessimistic posterior
would be harmless — Thompson compares arms, so a constant factor cancels. This
is not uniform. 47% of the arm pairs the evidence actually separates are ordered
the wrong way round, which is a coin flip. The sampler's preferences carry
almost no information about which arm works.

`satisfier:source_code` succeeds 89% of the time and is drawn as if it succeeds
10% of the time. `satisfier:problem_detection` succeeds 80% of the time and is
drawn at 2%. Meanwhile `gap_compose`, which genuinely fails four times out of
five, sits at 0.04 — close enough to `source_code`'s 0.10 that the two are
nearly indistinguishable at the draw.

## Why

The credit channel applies β and withholds α. From the walk logs of ten human
goals dispatched this session:

```
alpha-credited last pick   0
WITHHELD alpha-credit      5      ← one on every single reach
β-penalised               12
β WITHHELD                12
```

and from the dispatch records themselves — the authoritative per-goal view, not
a log — five reached goals, `alphaBetaDelta: []` on every one.

The gate is `index.ts:9818`:

```ts
if (verdict.deterministic === true || (!editEffectReach && consumedInChain.size > 0)) {
```

`consumedInChain` only grows when a later step declares an input shape an earlier
step produced. **A one-step reach can never have such an edge**, and every reach
on the floor or the satisfier plane is one step. So the entire tier that answers
goals no learned pathway covers is structurally uncreditable, while the same
tier's failures are penalised normally.

The gate is not careless — the comment above it records that a looser version
credited any reach that happened to shell out, and that 68% of those reaches were
hollow (`ext_variety`: 20/20 reached, 0/20 correct). Tightening it was right. But
the tightening removed the only arm that single-step reaches could ever satisfy,
so the correction to over-crediting became a total withdrawal of credit for one
whole tier.

The β side already understands this asymmetry. It refuses to penalise for the
same reason, in these words:

> α was structurally unreachable for this verdict (non-deterministic, and
> consumedInChain=0, which every satisfier pick is), so penalising would let this
> arm only ever lose

That reasoning is correct and it is applied in only one direction. β is withheld
where α is impossible on a **miss**; on a **reach** the arm gets nothing at all.
The result is an arm that can lose but cannot win — which is what 159 understating
arms and 16 overstating ones look like from the outside.

Decay is not the cause and was checked: `alpha: 1 + (alpha - 1) * d` shrinks both
parameters toward the neutral prior, pulling the mean toward 0.5. It cannot
produce means far below the empirical rate.

## The instrument

Existing learning instruments all report on the credit channel — deltas sent,
deltas dropped, writes that threw. A channel that faithfully delivers only half
the evidence passes every one of them, because every delta it carries does
arrive. It just never carries the other sign. Comparing the end state against the
outcomes it summarises is the check that catches that, and nothing was making it.

Two ways this script could have lied, both now guarded:

- **Tiny samples.** An arm with one outcome has an empirical rate of exactly
  0.000 or 1.000. A first version included them and reported 279 of 280 arms
  discordant — an artefact of breaking ties among identical 1.000s, not a
  finding. Hence `--min-n` and pairwise comparison rather than positional.
- **A silent 401.** An unauthenticated read returns an empty set, which is
  indistinguishable from "no arm has a posterior". The script refuses to run
  without a key rather than report a zero it cannot defend.

It exits non-zero when the posterior stops tracking the record, so it can gate
rather than merely inform.
