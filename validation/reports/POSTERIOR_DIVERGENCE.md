# Learning is working. Every instrument that reports on it says otherwise.

The standing question was whether the learning process is visible and reliable.
It is substantially reliable and it is not visible, and I concluded the opposite
twice before measuring it directly. Both wrong conclusions came from reading
instruments instead of running an intervention, and all three instruments fail in
the same direction.

## The measurement that settles it

Snapshot an arm's posterior, dispatch one goal that uses it, snapshot again.

```
goal: "My sourdough starter has gone flat and smells sharply of acetone
       after a week in the fridge. Tell me what that means and how to revive it."
       → reached, 1154-character answer delivered

                          BEFORE              AFTER            Δα
universal-tool-fallback   α 261.07 β 1152.21  α 261.77 β 1153.25  +0.70
satisfier:llm_completion  α   5.06 β    9.85  α   6.34 β   11.08  +1.28
```

**Credit flows.** Both arms gained α from one reached goal. Thompson's posteriors
move in response to outcomes. That is the answer to "reliable", and it is the
opposite of what this report claimed in its first two versions.

## What the instruments said instead

While that was happening, the dispatch record for the very same goal reported:

```json
"learning": { "alphaBetaDelta": [], "goalPathRecorded": true, "oracleLabelWritten": false }
```

Three separate readings, three separate lies, all under-reporting:

**1. `alphaBetaDelta` is empty on every dispatch, including ones that moved the
posterior.** It captures only the walk's in-process `learningSink`. The credit
that actually landed went through the trace-store and goal-path routes, which the
field cannot see. A reader of this field concludes no learning occurred from a
goal that demonstrably taught the system something.

**2. `oracleLabelWritten: false` on every dispatch, including ones whose label
landed.** `recordDeterministicLabel` (`index.ts:3490`) is fire-and-forget: it does
not await the response, does not check the status, and takes no sink to report
into. Querying the hub corpus directly finds the rows it claims not to have
written — `universal-tool-fallback | achieved` for the avocado goal, three rows
for the Saturn goal. The write works; the receipt is never issued.

**3. The `β-penalised last pick` log line reports penalties that were never
applied.** `index.ts:9677` correctly withholds β whenever α was structurally
unreachable for the same verdict:

```ts
const _alphaWasReachable = verdict.deterministic === true || consumedInChain.size > 0;
const _betaWithheldForSymmetry = !_noOracle && !_alphaWasReachable;
```

but the summary line at `:9717` distinguishes only the `_noOracle` case, so every
symmetry-withheld β prints as a penalty. Across ten dispatches that line claimed
12 penalties; `alphaBetaDelta` recorded none, and the withhold branch is why.

The comment directly above that line records this exact defect being found and
fixed once already, for the other branch:

> This line printed "β-penalised last pick" unconditionally, including on the
> branch immediately above that WITHHOLDS β — so every trace of a no-oracle
> refusal read as a penalty that was never applied. **The code was right and the
> log was wrong, which is the worse way round**: the log is what the reach-gate
> lessons, the judge, and every after-the-fact analysis read.

A second withholding branch was added afterwards and the line was never extended
to cover it. **The class recurred one branch below its own fix.**

## Two retractions, recorded rather than edited away

**First: the premise.** This report claimed `successful_executions` and
`thompson_alpha` are "two views of one history" and should track. They are not.
`successful_executions` increments from `validated.success` on the execution
record (`activities.ts:2239`) — whether the *step ran cleanly*. `thompson_alpha`
comes from the *graded reach with substance*. Reaching with substance is rarer
than executing without error, so nearly every arm's posterior *should* sit below
its execution rate. The 159-vs-16 split I published as evidence is roughly what
that alone predicts.

**Second: the mechanism.** The report then claimed the surviving evidence was an
asymmetric channel — 0 α credits against 12 β penalties. There were no β
penalties, and there were α credits; I had simply been reading the three
instruments above. Two published conclusions about the system's learning
dynamics, both drawn without once running the intervention that would have
settled it in four minutes.

## What is genuinely open

**245 of 485 arms have never been graded at all.** Not deflated — untouched, at
exactly Beta(1,1). This survives every correction above and is what the script
now gates on, because it is the one reading no benign story explains. An arm the
sampler has never graded is indistinguishable to it from an arm it has graded and
found fair, so those arms are selected on the prior no matter how often they run.

Deflation is explicitly **not** a failure condition. A posterior below the
execution-success rate is what a working substance gate produces, and the gate's
strictness is well-earned: the comment at `index.ts:9801` records that a looser
version credited any reach that happened to shell out, and that 68% of those
reaches were hollow — `ext_variety`, 20/20 reached and 0/20 correct.

## The instrument

`bun run validation/scripts/posterior-divergence.ts`

```
arms queried            485
still at exactly (1,1)  245   (51%)  → exits non-zero
graded with n >= 5      183
Kendall tau-b            0.063
```

Every existing learning instrument reports on the credit channel — deltas sent,
deltas dropped, writes that threw. All of them pass here, correctly. What was
missing was any view of the *end state*, and the general lesson is the one this
report had to learn twice: **a channel's own reporting is not evidence about the
channel.** Ask the store, or better, change one thing and watch what moves.

The tau is kept but reframed. It does not show the channel is broken; it shows
execution reliability cannot be used to sanity-check the posterior — worth
stating precisely because it means a genuinely broken credit channel would have
nothing obvious to contradict it.

Three ways the script could itself have lied, all guarded:

- **Tiny samples.** An arm with one outcome has an empirical rate of exactly
  0.000 or 1.000. The first version included them and reported 279 of 280 arms
  discordant — an artefact of breaking ties among identical 1.000s. Hence
  `--min-n` and pairwise comparison rather than positional.
- **A silent 401.** An unauthenticated read returns an empty set, which is
  indistinguishable from "no arm has a posterior". The script refuses to run
  without a key.
- **The satisfier plane.** A template listing contains zero `satisfier:*` ids, so
  a catalogue-only arm list omits precisely the tier that answers human goals.
  The arms are derived from the live shape vocabulary instead.
