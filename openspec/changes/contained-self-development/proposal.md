## Why

The substrate's purpose is self-development; everything else is downstream of it. Today almost
all of its progress comes from operators prodding it: on 2026-09-27 fifteen changes landed through
the lane, every one of them an exact edit an operator wrote. When the compose lane or a
fundamental of agentic development breaks, the system cannot repair itself, because the thing it
would edit is the thing that edits. Autonomous operation cannot be tested safely on the live
fleet as things stand: the learner is untrained (the gap-class posterior sits at α = 1 on every
class) and it works on its own critical components.

Two capacities must be demonstrated before autonomy is trustworthy:

- **Containment.** Autonomous work must not be able to break the machinery that lands and
  verifies work, so its failures are training signal rather than incidents.
- **Crystallization with flexibility.** A self-development use case done once by exploration
  must become a learned pathway that is reused cheaply, while the components underneath stay
  open to exploration by variant rather than by in-place rewrite.

## What Changes

Built only from primitives the architecture already has (shaped impulses read at use time,
activities graded by traces, discovery, variants, the ribosome). No env flags, no operator
approval step, no copied learning state, no operator-authored templates.

- **Stage 1, scope containment.** A pool shape `autonomyScope` (read through discovery like
  `spendEnvelope`) names the paths autonomous work may not land on: the lane core
  (feature-compose, the mitosis cutover, push policy, gap admission, the gap store writer,
  goal-host dispatch, pull-sync, the Class-1 verifiers). Admission refuses such a gap before
  drafting; the compose verdict withholds FAVORABLE when an autonomous compose touched an
  excluded path. Directed work is untouched. The learner earns its core after it lands cleanly on
  the periphery.
- **Reopen under containment** at ~$1/h on the system-filed admissible gaps, measuring the
  floor, extraction and reuse parts of the demonstration.
- **Stage 2, an autonomy node** (a compute-profile node like compose2-live, sharing hub learning
  state through discovery, sole holder of `autonomous_pick`), converging from a branch named by a
  shape rather than an env constant. Only then: branch landing with ref-aware verification on
  the node that runs the branch.
- **Promotion as an activity**: evidence (falsifier passed, soak, no new gaps in the family) →
  fast-forward of `dev`, graded on durability. The first promotion is the autonomy criterion.
- **Code gates become activities** (admission order, envelope read, breaker, verbatim edits,
  closure credit), in parallel and off the critical path.

## Impact

- development-vessel: `autonomyScope` reader, admission refusal, compose-verdict floor.
- Operator tier: holds stay until the stage-1 falsifier passes; two lifecycle decisions for the
  user (the autonomy node container, bundled with 4.0's P220 publication).
- Later: push/cutover/verification made ref-aware; pull-sync convergence ref read from a shape.
