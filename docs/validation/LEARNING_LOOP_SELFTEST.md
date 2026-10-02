# The learning-loop selftest

An expectation the substrate holds about itself: **the full execution→learning
chain conducts, and this is verifiable on demand by a probe whose outcome is
known by construction.** This document is timeless; the current probe
templates, arms, and gap ids live in the running system and are queried, not
memorized.

## The method

A selftest is a *dispatched intervention with known ground truth*, never a
re-reading of the system's own reports (a channel's reporting is not evidence
about the channel). One probe execution is followed through every seam, each
assertion made at the layer that consumes the artifact:

| Link | Assertion (at the consuming layer) |
|---|---|
| Walk → trace | a row in the authoritative execution store carrying the probe's tags and declared output shapes |
| Verdict delivery | the grading marker (`reach_graded`) lands on the row — measured at the receiver, not the sender |
| Classification | each scripted failure mode maps to its intended disposition (env failure → ungraded; verifier-negative → blame; hollow → ungraded) |
| Posterior delta | Δ(α,β) on the probe's arm matches the graded-yield formula within tolerance; abstentions (satisfier credit withholding) abstain |
| Pathway learning | a goal-path row exists for the probe's goal hash, including failed attempts |
| Reuse | a repeat dispatch exercises the reuse tier; a scripted-failing family is withheld |
| Extraction | a reached multi-task probe becomes a selectable learned template |

**Controls are not optional.** An observe-mode dispatch must move nothing in
any posterior family. A deliberately severed link must turn exactly its
assertion red. Every zero is printed beside a sample, every count beside its
denominator — the selftest's own instrument errors are caught by controls, not
by re-reading.

## Why the shape inventory is the mocking seam

All routing passes through discovery by shape — the one fixed point. A vessel
advertising a probe shape is therefore indistinguishable from a real
capability to the walk, the grader, and the extractor: mocking at the shape
level mocks the world without touching any production vessel. The probe kit is
ordinary registry citizenry:

- a **known-answer corpus** shape: fixed hostile/benign fixture pairs run
  through real gate functions, asserting both refusal-with-citation and
  benign-pass (the `gate_self_probe` pattern);
- a **scripted-outcome emitter**: emit an arbitrary declared shape with
  caller-supplied content, for synthetic shape-chains (the `emit_shape`
  pattern);
- **store-consistency auditors** run between probe rounds (posterior
  consistency, trace-outcome validity).

Isolation is by **attribution, not environment**: probe dispatches carry an
operator/probe tag so their traffic is excludable from fleet metrics and their
arms are self-contained. A staging copy would validate a different system.

## How the substrate runs it itself

- Probe templates are seed-tier activities on the autonomous rotation, so the
  selftest is condition-driven work like any other.
- A red assertion is filed as a gap **carrying a falsifier** (edit site +
  expected literal, or an evidence-resolve predicate), which drops it into the
  ordinary gap-compose repair lane. Falsifier anchors are immutable once
  filed: a lane touching the record must not be able to re-aim the
  measurement.
- The selftest reads raw stores over deterministic resolvers — no LLM in the
  assertion path — and emits a report shape whose red links are the next
  round's demand.

## The boundary

The selftest cannot validate itself. Its standing residue for the operator:
verify the instrument *completes* (a detector must be proven to complete, not
to exist), and periodically sever one link on purpose to confirm the matching
assertion — and only that assertion — goes red.
