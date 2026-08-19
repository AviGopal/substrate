# Learning is working. Every instrument that reports on it says otherwise.

The standing question was whether the learning process is visible and reliable.
It is substantially reliable and it was not visible, and I concluded the opposite
twice before measuring it directly. Both wrong conclusions came from reading
instruments instead of running an intervention.

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

I read all three as lies. **Only one was.** The other two are accurate within a
scope their names do not convey, which is a different defect and needs a
different fix.

**1. `alphaBetaDelta` — accurate in scope, and it had one real lie inside it.**
The type's own doc says it is "populated ONLY from paths that actually run at
terminalization". The credit that moved the sourdough goal's posterior came
through the execution-record route, which this field never claimed to cover, so
`[]` was correct there. But when a terminalization β *was* attempted,
`penaliseHollowTemplate` returned `dBeta: 2` **unconditionally** — including on
the branch where it had just logged:

```
beta-penalty REJECTED (404) for 'patch_with_tools' — no posterior row exists
    for this pick; penalty not applied
```

So the field asserted a penalty the store had refused. That is the exact defect
the α site fixed and documented — *"Report what HAPPENED, not what was attempted.
This line used to fire unconditionally, so a credit that was rejected or lost
still read as alpha-credited"* — applied to α and never to β. Repaired in
`5be4cfa`: `dBeta: _betaApplied ? 2 : 0`, landed and live. Verified at code level
in the running tree; I did not catch a rejected penalty flowing through a
dispatch sink end to end, because the rejections observed came from the compose
escalation path rather than walk terminalization.

**2. `oracleLabelWritten` — not a lie; a misleading name.** I claimed it reports
`false` while labels land. It does, and that is correct: the field is a *human
verdict consumption latch*, not a record of label writes. `index.ts:14810` burns
it only when `label?.labeler === "human"`, and the type's doc says so plainly —
"goal-host writes no oracle label at terminalization, so oracleLabelWritten stays
false here (that is the operator provide_feedback plane)". The machine labels I
found in the corpus are written by a different call and were never in this
field's scope. Nothing to fix in the code; the name invites the misreading I
made.

**3. The `β-penalised` log line — a genuine lie, now fixed.** `index.ts:9677`
correctly withholds β whenever α was structurally unreachable for the same
verdict:

```ts
const _alphaWasReachable = verdict.deterministic === true || consumedInChain.size > 0;
const _betaWithheldForSymmetry = !_noOracle && !_alphaWasReachable;
```

but the summary line at `:9717` distinguished only the `_noOracle` case, so every
symmetry-withheld β printed as a penalty. Across ten dispatches that line claimed
12 penalties; none were applied.

The comment directly above it records this exact defect being found and fixed
once already, for the other branch:

> This line printed "β-penalised last pick" unconditionally, including on the
> branch immediately above that WITHHOLDS β — so every trace of a no-oracle
> refusal read as a penalty that was never applied. **The code was right and the
> log was wrong, which is the worse way round**: the log is what the reach-gate
> lessons, the judge, and every after-the-fact analysis read.

A second withholding branch was added afterwards and the line was never extended.
**The class recurred one branch below its own fix** — and then a third time, in
`penaliseHollowTemplate`'s return value, which is defect 1 above.

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

## Verification of the first repair

`784ec45c` landed the corrected summary line; the substrate's own convergence
restarted goal-host at 00:55:45, after the write. A fresh miss on a one-step arm
now reports:

```
HOLLOW — …; β WITHHELD (α was structurally unreachable for satisfier:… —
                        symmetric abstention, not a penalty)
learning: { "alphaBetaDelta": [] }
```

The log and the sink now agree. Before the fix, that same dispatch printed
`β-penalised last pick` while applying nothing.

Two notes from the landing itself, both instances of classes already named here:

- **The dispatch was graded `reached:false`** with "the requested symbol is NOT
  observably present" — while the symbol *is* present on `origin/dev` and the
  diff is byte-identical to what was asked for. A false rejection, which is worse
  than a false reach: it penalises an arm that was right.
- **Three gates refused this one-line log correction in series** before it
  landed: the unused-declaration arm (false — `uf` is used six times, and the
  gate was judging a file its own string-stripper had deleted 73% of), the
  diagnostic-only arm (correct by its rule, wrong in substance — repaired in
  `f969eb8` so that a log edge which *adds* a conditional branch is treated as
  repair rather than quietening), and the semantic-symbol gate (false — it
  expected the fix in `penaliseHollowTemplate`, but the penalty logic was already
  correct and the defect was in the line that describes it).

  Each gate is individually well-reasoned. In series they make one class of
  repair — *the diagnostic is lying* — nearly unlandable, which is the class the
  system most needs to be able to land.

## Further loss channels, now legible

Visible in goal-host's journal once the above was being watched closely:

```
beta-penalty REJECTED (404) for 'feature_compose' — no posterior row exists
    for this pick; penalty not applied
reach-patch MATCHED NO ROW (walk-complete) for feature_compose:784ec45c…
    (reached=false) — verdict NOT persisted; this execution stays ungraded
[oracle-label] NOT consumed exec=feature_compose:784ec45c… reason=no_labels
```

An arm with no posterior row cannot be graded through the penalty path, and
nothing in that path creates one — so the row's absence is self-perpetuating.
This is a partial explanation for the 245 arms sitting at Beta(1,1), and it is
the same zero-row class already pinned for the posterior aggregator in
`posterior-aggregator-drop-visibility.test.ts`, on a different writer.

## Where this leaves the ungraded half

The gate still fails, correctly, on the reading that has no benign explanation:
245 of 486 arms have never been graded. One mechanism is now legible in the
journal and is the same zero-row class pinned for the posterior aggregator on a
different writer:

```
beta-penalty REJECTED (404) for 'patch_with_tools' — no posterior row exists
    for this pick; penalty not applied
```

An arm with no posterior row cannot be graded through the penalty path, and
nothing in that path creates one, so the absence is self-perpetuating. Until
`5be4cfa` the loss was also invisible in the dispatch record, which reported the
refused penalty as a delta of 2.

Filed as `gap-vacuous-edit-stripper-deletes-the-file-it-judges`: the repair for
the reference-counting view is verified offline but has failed to land across
three dispatches — two mangled by the drafter, one that never routed to compose
at all. It is left with the substrate rather than hand-applied, because the
inability to land it is itself the training signal.

## Summary of state

| | |
|---|---|
| Credit flows on a reached goal | **verified by intervention** (α +0.70 / +1.28) |
| β withheld symmetrically when α is unreachable | already correct in code |
| β withhold reported as a penalty | **fixed, live, behaviorally verified** (`784ec45c`) |
| Refused β reported as an applied delta | **fixed, live** (`5be4cfa`), code-level verified |
| `oracleLabelWritten` | not a defect — a human-verdict latch with a misleading name |
| 245/486 arms never graded | **open**; one mechanism identified, gate fails on it |
| Reference-counting view deletes 73% of the file | **open**, gap filed, 3 dispatches failed to land it |
