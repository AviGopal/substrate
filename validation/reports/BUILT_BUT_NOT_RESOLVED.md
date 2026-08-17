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
