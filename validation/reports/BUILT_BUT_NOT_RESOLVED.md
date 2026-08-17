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

`ribosome-vessel` is the vessel that mints activity templates. A rule was added to
`ribosome-extract.json` requiring every synthesized template to carry a non-empty
top-level `input_shapes` — the field whose absence leaves a learned composition
with no producer→consumer edge, so it is denied alpha credit, so its posterior
decays toward zero and it is never selected again.

The rule merged, built, and was verified present in the shared `dist`. It reached
zero mints. A four-shape chain that executed after the merge minted at 00:22:33
with `input_shapes: []`, synthesized from the Aug-5 template. All 17
learned-composition templates in the registry carry `input_shapes: []`.

The instructive part is that every intermediate check passed honestly. The commit
landed. The build succeeded. The artifact contained the rule. The consumers were
healthy. Each answer was true, and the conjunction was false.

## The fix

Two changes, both in the fan-out:

1. **Propagate by content.** After the swap, copy `dist` into any consumer that
   does not resolve to it, matching the layout that consumer already has rather
   than converting it.
2. **Credit only verified arrival.** Before writing `LAST_GOOD`, hash the shipped
   artifact at each consumer against the shared build. On mismatch, withhold the
   marker, emit a gap, and let the next tick re-enter the fan-out.

The gate now asks whether the bytes arrived.

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

- The 17 existing `input_shapes: []` templates are dead arms. They are left in
  place — the rows are not hand-edited — and retirement or replacement is the
  lever, not mutation.
- The hub runs the same image and almost certainly carries the same stale
  consumer dists. It is not reachable by SSH from here, so this is
  operator-gated.
