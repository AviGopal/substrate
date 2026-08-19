# The learning channel abstains correctly and reports that it punished

`bun run validation/scripts/posterior-divergence.ts` — measured against the hub
store the sampler actually reads.

```
arms queried            485
still at exactly (1,1)  245   never graded; drawn at the prior forever  (51%)
graded with n >= 5      183

posterior UNDERSTATES its own execution-success rate   159/183
posterior OVERSTATES it                                 16/183
pairs the evidence separates                          16539
  of those, ordered against execution reliability      7743 (47%)
Kendall tau-b                                           0.063
```

## Two things this report previously got wrong

Both are recorded here rather than quietly edited, because each one was the
report's headline when it was published and each changed the conclusion.

**First retraction — the premise.** The report claimed
`successful_executions` and `thompson_alpha` are "two views of one history" and
should track. They are not. `successful_executions` increments from
`validated.success` on the execution record (`activities.ts:2239`) — whether the
*step ran cleanly*. `thompson_alpha` is written separately from the *graded reach
with substance*. Reaching with substance is rarer than executing without error,
so nearly every arm's posterior *should* sit below its execution rate. The
159-vs-16 split is roughly what that alone predicts and is not evidence of a
defect.

**Second retraction — the mechanism.** The report then claimed the surviving
evidence was an asymmetric channel: 0 α credits against 12 β penalties across ten
human goals. **There were no β penalties.** `alphaBetaDelta` on the authoritative
per-dispatch record is `[]` on every one of those dispatches. The number 12 came
from counting log lines.

## What is actually true

The symmetric withhold is **implemented and working**. `index.ts:9677`:

```ts
const _alphaWasReachable = verdict.deterministic === true || consumedInChain.size > 0;
const _betaWithheldForSymmetry = !_noOracle && !_alphaWasReachable;
```

When α is structurally unreachable for a verdict — which it always is for a
one-step reach, since `consumedInChain` only grows when a later step consumes an
earlier step's output — β is withheld too. The reasoning is sound and the code
carries it out. On a miss the arm is not penalised; on a reach it is not
credited. The channel does not punish a tier it cannot reward.

**But the summary line does not say so.** `index.ts:9717` distinguishes only the
no-oracle case:

```ts
${_noOracle ? "β WITHHELD (no oracle owns this class)" : `β-penalised last pick ${lastPick}`}
```

so every symmetry-withheld β prints as a penalty that was applied. That is what
produced the 12, and reading those lines is what produced a published, wrong
conclusion about the system's learning dynamics.

The comment immediately above that line records this exact defect being found and
fixed once already, for the other branch:

> This line printed "β-penalised last pick" unconditionally, including on the
> branch immediately above that WITHHOLDS β — so every trace of a no-oracle
> refusal read as a penalty that was never applied. **The code was right and the
> log was wrong, which is the worse way round**: the log is what the reach-gate
> lessons, the judge, and every after-the-fact analysis read.

A second withholding branch was added afterwards and the line was not extended to
cover it. The class recurred one branch down from its own fix.

## The real gap: honest abstention forever is not learning

With the log corrected, the picture is not a biased channel. It is a **silent**
one. For every arm that only ever appears as a one-step pick:

- reach → α withheld (no in-chain edge, non-deterministic verdict)
- miss → β withheld (symmetry)
- posterior → Beta(1,1), permanently

**245 of 485 arms are in exactly that state.** They are not deflated; they are
untouched. Thompson cannot distinguish an arm it has never graded from one it has
graded and found fair, so the tier that answers goals no learned pathway
covers — the floor and the satisfier plane, the only tier that answered any of
the human goals in `HUMAN_GOALS_BATTERY.md` — accumulates no evidence at all, in
either direction, no matter how many times it runs.

The system is being honest. It abstains because it genuinely lacks the substance
signal the gate requires, and inventing one is how the previous, looser gate came
to credit reaches that were 68% hollow. The gap is not the gate's strictness. It
is that **nothing supplies a substance signal for a single-step answer**, and
until something does, half the fleet's arms are unlearnable by construction.

That is the thing to build next, and it is the honest definition of "reliable"
for this system: not that credit flows more freely, but that an arm which
answered a goal well can be told apart from one that never answered anything.

## About the instrument

Existing learning instruments all report on the credit channel — deltas sent,
deltas dropped, writes that threw. Every one of them passes here, correctly. The
missing view was of the *end state*, and building it is what surfaced both that
the channel abstains and that it says otherwise.

The script now gates only on the reading that has no benign explanation: the
share of arms never graded. Deflation is explicitly *not* a failure condition —
a posterior below the execution rate is what a working substance gate produces.

Three ways it could have lied, all guarded:

- **Tiny samples.** An arm with one outcome has an empirical rate of exactly
  0.000 or 1.000. The first version included them and reported 279 of 280 arms
  discordant — an artefact of breaking ties among identical 1.000s. Hence
  `--min-n` and pairwise comparison rather than positional.
- **A silent 401.** An unauthenticated read returns an empty set, which is
  indistinguishable from "no arm has a posterior". The script refuses to run
  without a key.
- **The satisfier plane.** A template listing contains zero `satisfier:*` ids, so
  a catalogue-only arm list omits precisely the tier under discussion. The arms
  are derived from the live shape vocabulary instead.
