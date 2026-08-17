# Built but not resolved: a fan-out that credited itself for bytes nobody received

A shared package can be correctly rebuilt, atomically swapped, and verified
present in the shared build while every consumer that matters keeps running the
previous version — and every gate in the path reports success. This document
records the mechanism, because the failure is invisible to health checks by
construction and the marker written on success disarms the retry designed to
catch it.

## The shape of the defect

`substrate-pull-sync.sh` rebuilds a shared package's `dist`, swaps it atomically,
restarts each consumer staggered, health-gates each restart, and on success
records `LAST_GOOD=$HEAD`. The correctness of the whole sequence rests on one
sentence in its own comment:

> consumer symlinks are absolute, so this propagates by reference

Measured for `@avigopal/ias-executor-ts`:

| consumer | real files in `dist` | symlinks |
|---|---|---|
| development-vessel | 0 | 164 |
| ribosome-vessel | 164 | 0 |
| goal-host-vessel | 164 | 0 |
| analysis-vessel | 164 | 0 |
| llm-resolver-vessel | 164 | 0 |
| local-tools-vessel | 164 | 0 |

The premise holds for one consumer in six. For the other five the swap is a no-op.
The bounce restarts them onto identical bytes. They return healthy — because a
process running stale code is perfectly healthy — so the run logs `fan-out
healthy`, writes `LAST_GOOD`, and moves on.

**Health cannot witness this failure.** It is not that the check was weak; it is
that the check answers a different question than the one that matters. The
question is "did the bytes arrive", and liveness has no opinion on it.

## Why it persisted rather than self-correcting

The path contains a mechanism built for exactly this: a dist-freshness retry that
re-enters the fan-out when the last successful fan-out `HEAD` differs from the
current one. It never fired, because the fan-out reported success and wrote
`LAST_GOOD=$HEAD`.

The run that left the dist stale is the run that disarmed the detector for stale
dist. That is the general form worth carrying: **a success marker written on the
wrong evidence does more damage than no marker, because it also silences the
retry.** Observed duration: eleven days (shared build Aug 16 23:33, consumer
copies Aug 5 23:36).

## What it cost

`ribosome-vessel` is the vessel that mints activity templates, and `goal-host-vessel`
executes the synthesis. Both were on the stale side. Every change to any
`ias-executor-ts` template or source over eleven days was inert in them: present in
the repository, present in the shared build, and absent from behavior.

The rule that exposed this was an addition to `ribosome-extract.json` requiring
synthesized templates to carry an accurate top-level `input_shapes`. It merged,
built, was verified present in the shared `dist`, and reached zero mints — the
first observation that something in the path was lying.

The instructive part is that every intermediate check passed honestly. The commit
landed. The build succeeded. The artifact contained the rule. The consumers were
healthy. Each answer was true, and the conjunction was false.

### Correction: the rule was accurate, not load-bearing

The diagnosis that motivated the rule was wrong, and the measurement that
disproved it is worth more than the rule.

The claim was that `input_shapes: []` on every learned composition denied them
alpha credit and drove their posteriors to zero. Computing the true external input
of each learned composition — union of every task's `inputShapes` minus every shape
produced by an earlier task in the same chain — gives:

    self-contained (`input_shapes: []` is CORRECT):   37
    genuinely consume an external shape:               1

The obvious objection is that this measures a missing key rather than real
topology. It does not: 67 of 115 learned-composition tasks (58%) declare a
non-empty `inputShapes`, and the four-task chain resolves as a clean
producer→consumer sequence —

    task 0  in=[]                          out=[vessel_health_report]
    task 1  in=[vessel_health_report]      out=[discovery_vessel_registry_observer]
    task 2  in=[discovery_vessel_registry_observer] out=[shellResult]
    task 3  in=[shellResult]               out=[memoryNote_write]

— where task 0's empty input is a generator, not an omission.

**37 of 38 are self-contained by construction.** They begin at a generator (a shell
command, a fetch) and end at a sink, so they consume nothing from outside
themselves and the empty field is the right answer. `input_shapes: []` was never
the anomaly it looked like — it is what a correct extractor produces for the kind
of chain this substrate mostly builds.

Alpha credit is in fact flowing (`alpha-credited last pick satisfier:…`).
Withholding is confined to single-step satisfiers with no in-chain
producer→consumer edge, which is the gate behaving as designed.

Rule 9a stands because it makes the field accurate for the one composition that
does take external input, and for future ones. It is not the ceiling lever it was
introduced as. The ceiling question — why learned compositions are rarely reused —
remains open and is not answered by this field.

The propagation defect above is independent of that error and is the durable
finding here.

## The fix

Two changes, both in the fan-out:

1. **Propagate by content.** After the swap, copy `dist` into any consumer that
   does not resolve to it, matching the layout that consumer already has rather
   than converting it.
2. **Credit only verified arrival.** Before writing `LAST_GOOD`, hash the shipped
   artifact at each consumer against the shared build. On mismatch, withhold the
   marker, emit a gap, and let the next tick re-enter the fan-out.

The gate now asks whether the bytes arrived.

**Verified live, not merely committed.** The unit runs
`/usr/local/bin/substrate-pull-sync`, which self-installs from the super-repo; that
executed file carries the new `FAN-OUT UNPROPAGATED` path. This check was not
optional — a propagation fix that reached the repository and not the running copy
would have been an instance of the defect it fixes. (A stale `substrate-pull-sync.sh`
sits beside it in `/usr/local/bin` and is *not* what executes; grepping the
plausible-looking name returns 0 and would have read as "the fix never landed.")

This was a direct edit rather than a dispatched goal, deliberately: the
propagation path cannot repair itself through the propagation path it is broken
in. A goal landing the fix would have mirrored it to `src` and left every consumer
on the same stale `dist`.

## Class, and the detector that does not exist

This is the third distinct member of a family already recorded on this substrate:

- **write ≠ read** — a producer writes a key no consumer reads.
- **half-wired channel** — a reader ships without its producer.
- **built but not resolved** — an artifact is built correctly and no consumer
  resolves to it.

All three share one structure: a stage verifies what it can observe and never
verifies that the next stage received it. The general detector — for every
declared producer/consumer link, assert the consumer actually resolves the
producer's current output — does not exist. Each instance has so far been found
by hand, after the fact, by someone asking why a correct fix changed nothing.

The operational tell is specific and worth reusing: **a fix that is present in the
repository, present in the build, and absent from behavior is a propagation
question, not a logic question.** Check what the running process resolves before
re-reading the diff.

## Compositional reach, as measured alongside this

Four dispatches, each graded by hand against ground truth captured *before*
dispatch:

| shapes | subjects | verdict | grading |
|---|---|---|---|
| 4 | goal-host, dev-vessel, healthy count, shape count | reached | all four facts correct |
| 2 | shape count, healthy count | reached | both correct, both with a producing step |
| 2 | four facts asserted | reached | facts true, but **2 of 4 had no producing step** |
| — | analysis-vessel, concept-db, + 2 counts | **failed, reached:false** | correct rejection — shell step errored, no reports produced |

The correct rejection matters as much as the reaches: the judge refused a chain
that produced nothing rather than narrating around it.

The third row is the concerning one and is filed as a gap: the oracle verified
`totalVessels=11` and the verdict credited four claims, two of which the chain
never measured. They were true by coincidence. Nothing in the substrate could have
distinguished that from fabrication — it was caught only because ground truth was
held externally.

### Depth is counted in distinct shapes, and I was testing the wrong axis

Depth beyond four shapes was not demonstrated by the dispatches above, and the
reason is a measurement error of mine rather than a substrate regression.

A five-fact goal — three vessel health reports plus two registry numbers —
inferred:

    inferred_target_shapes: ["vessel_health_report","shellResult","memoryNote_write"]
    confidence: 0.96

**Target shapes are a set, not a multiset.** Three health reports collapse to one
`vessel_health_report`. Adding more subjects of the same kind cannot increase
composition depth; it increases arity, which the walk correctly handles with a
single satisfier carrying multiple bindings. Three successive dispatches of mine
varied arity while depth is a function of distinct shapes, so they could not have
shown what they were built to show.

Two things follow. Escalating depth requires goals that genuinely need N distinct
shapes — a fetch, an extraction, a computation, a health probe, a registry read, a
sink — not N facts of one kind. And a "compositional pattern" claim should quote
the inferred target shapes, since that set, not the sentence count, is what the
walk will actually try to compose.

### The ceiling is a constant: `.slice(0, 3)`

Testing the corrected axis found the actual limit. A goal naming six distinct
capabilities — fetch a URL, extract a JSON field, count its digits by shell,
produce a vessel health report, read the registry shape total, persist a note —
inferred:

    inferred_target_shapes: ["shell","memoryNote_write"]   confidence 0.8, no alternatives

Two shapes for six capabilities. Set against the previous goal (five facts of one
kind → three shapes at 0.96), the relationship inverts: **the more distinct
capabilities a goal requests, the fewer target shapes are inferred.**

The cause is in `goal-target-inference.ts`, in both the cached path and the
LLM-parse path, and again for alternatives:

    ).slice(0, 3) as string[];   // :190
    ).slice(0, 3);               // :597, :613

**Inferred target shapes are hard-capped at three.** Chains of four steps were
observed only because the walk inserts intermediates behind the declared targets;
the declared target set itself cannot exceed three. Compositional depth is
therefore bounded by a constant, and no goal phrasing can raise it. Every
experiment above was measuring against a ceiling that no amount of goal authoring
could move.

This is also a **law 1 violation**. The cap is an in-process constant steering
runtime behavior: invisible to traces, unobservable through any shaped impulse, and
unlearnable — the loop cannot discover that a deeper target set would have reached
where a truncated one did not, because the truncation leaves no trace. The
`walkBudget` shaped policy already in `SHAPES` is the precedent for how a bound
like this should be expressed.

Filed as gap `target-inference-caps-depth-at-three`. The fix is to read the bound
from a shaped policy defaulting to the current value, so behavior is unchanged on
day one but becomes observable and tunable by the learning loop. It is deliberately
left to the substrate rather than hand-applied: this file is under
`repos/goal-host-vessel/src/`, code changes there are goals, and hand-completing it
would steal exactly the lesson law 6 reserves for the system.

Separately, the `REUSE-BEFORE-DERIVE` shortcut is **not** the depth suppressor it
first appeared to be. Reading it: it fires only when the recommended pathway is
*exactly* the floor, the goal is not an edit, and the goal does not request a
durable artifact — and it falls through to the full walk when the reused pathway
fails to reach. That is a correctly-guarded shortcut, and the one-step reuses
observed in the log belong to other dispatches, not to the multi-fact goals.

### Reviewed and found sound

The satisfier ordering was reviewed for architecture violations and is not one.
Vessel-resolve satisfies a missing shape by a real resolve call against a live
vessel *before* any candidate or bridge-authoring step, so the walk reaches a
vessel's actual capability rather than authoring a hollow wrapper that produces the
shape without doing the work. Derivation-deferral blocks a terminal emit while any
intermediate is unproduced, which is what stops a note being written from goal text
instead of from real findings. Compute-deferral orders `shellResult` behind the
intermediates whose output is its operand. `shellResult` being a near-universal
satisfier flattens chains, but it does so *after* shaped producers have been
offered, which is the floor behaving as designed rather than competing with the
ceiling.

## A refusal was pooled as content, and the goal went green

The depth-5 dispatch reached with a **three-step chain — exactly the inference
cap** — which confirms the ceiling above empirically. It also produced the sharpest
defect of the session.

`vessel_health_report` resolved to:

    {"resolved": false,
     "error": "vessel_id is required — refusing to report on an assumed vessel"}

That refusal is *correct*. It is a guard added earlier in this same session, after
the resolver was found defaulting to a hardcoded vessel and producing valid-looking
reports about a subject nobody asked for. It fired exactly as intended.

The walk recorded it as `REACH-CONTENT vessel_health_report`, graded the dispatch
`reached: true`, and persisted a note whose body contains the refusal text where
three health statuses should be. **Zero of the three requested health facts were
delivered and the verdict is green.**

The mechanism that exists to prevent this — `_degenerateReason` graded against the
shaped `bodyHonestyPolicy` — is healthy and would have caught it: the policy
resolves 200, its `errorFields` include `error`, and its `denialTextPattern`
matches both `required` and `refused`. The predicate is not the problem.

**Coverage is.** The walk log carries `VESSEL-RESOLVE SATISFIER produced …` for
`shellResult` and `memoryNote_write` — the path that calls the checker — and no
such line for `vessel_health_report`, which entered the pool by another route that
does not grade the body. The guard covers one path of two.

A second, narrower hole: `resolved` appears in neither `flagFields` nor
`truthyDenialFields`, so a bare `resolved:false` carrying no denial *text* would
pass even on the guarded path. This envelope was caught-able only because it also
carried prose.

Filed as `body-honesty-guards-one-route-only`. This is the same family as
everything else in this document — a mechanism that verifies what it can see on the
route it sits on, and never learns that another route bypasses it.

## The synthesis step discarded evidence it had already retrieved

The six-distinct-shape goal — fetch a star count, count its digits, probe vessel
health, read the registry shape total, persist one note — settled `reached: true`
with **zero** reach-content steps and a `goalReachReason` that merely restates the
goal ("The memory note containing the requested … was successfully written").

Graded against ground truth captured before dispatch:

| fact | truth | note | |
|---|---|---|---|
| star count | 95429 | 95429 | ✓ |
| digit length | 5 | 5 | ✓ |
| vessel health | healthy | "Unavailable (exit code 6)" | ✗ |
| shape total | 305 | "Unavailable (exit code 6)" | ✗ |

The digit length is quietly impressive: `wc -c` returns **6** because it counts the
trailing newline, and the note reports 5.

The two failures are the interesting part, because **the substrate had the
answer**. Its own reasoning records:

    shellResult: stdout "305\n"
      command: curl -s http://127.0.0.1:8100/registry/stats | jq .totalShapes
      exit_code: 0

It retrieved 305 with `exit_code 0` and then wrote "Unavailable (exit code 6)".
The `6` is the `wc -c` **output** of the *other* step, misread as an exit code —
and that misreading suppressed a value already in hand.

This is not a retrieval failure. Every fact was fetched successfully; two were
discarded while composing the answer. It is an information-at-point-of-use failure
(law 8) located in synthesis rather than in gathering, which is the harder place to
see it: the traces show clean successful fetches right up to the step that threw
them away.

Two further defects in the same dispatch. Reach was granted on the write with no
content grading — the write-shaped-goal class, again. And the goal said *persist
ONE memory note*; **two** were written, the second being the raw reasoning
scratchpad, so intermediate deliberation is leaking into the durable store as an
artifact.

Filed as `synthesis-discards-retrieved-evidence`.

## Carried, not fixed

- The hub runs the same image and almost certainly carries the same stale
  consumer dists. It is not reachable by SSH from here, so this is
  operator-gated.
- Trace-retention throughput after bounding the valve DELETE at 20s is
  **unmeasured**: the traces API returns `"total": -1` rather than counting, the
  hub journal is unreadable from this spoke (`activity-api` is masked here), and a
  `limit=1` read took 44.7s. That latency is itself a load signal, but it is not a
  surplus measurement and is not reported as one.
- A reach verdict credited four asserted facts while its oracle verified one
  (`totalVessels=11`); the two vessel-health claims had no producing step and were
  true only by coincidence. Filed as gap `reach-oracle-coverage-fraction`.
