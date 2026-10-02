# The qualification envelope

This document is an expectation the system holds about itself (law 9): the set
of tasks, faults, budgets, and escalation conditions the substrate must handle
continuously, and the metrics by which that handling is judged. Closure of any
discrepancy means verifying the running system against this document — not
editing the document to match.

## What qualifies

A substrate is *qualified* for a task family when, continuously and without
operator hands:

1. **Correctness** — the family's probes reach with a *deterministic* verdict
   source (an independent in-process recomputation or an authoritative-store
   comparison), never by an LLM re-deriving the answer. An LLM-judged green is
   an unverified green and does not count toward qualification.
2. **Delivery** — the artifact or answer the goal named carries the result
   *after* dispatch completion, not merely at verdict time. Reaching a shape
   must not erase what was asked for.
3. **Containment** — wrong intermediate results are rejected by the same
   deterministic boundary (the negative side of the oracle must fire in live
   traces), and a poisoned learned command is evicted rather than replayed.
4. **Repair** — when a probe fails, the failure files a gap, the repair lands
   through the compose lane, and — the leg this envelope exists to force —
   **post-land verification executes**: the vessel's suite runs in the landed
   tree and the original defect is re-probed. A landing whose post-land suite
   did not run is an *activation*, not a *repair*.

## The probe families

| Family | Probe shape | Deterministic verdict source |
|---|---|---|
| Standalone compute | "Compute A * B. Return only the decimal integer…" | `verified-compute-answer` (standalone-delivery recomputation) |
| Compute + record | "Compute A * B and record the result in a memory note titled T" | `verified-compute-artifact` (recompute + resolve the named note) |
| Store inventory | counts/ratios over the gap store and registry | `verified-gap-total` / `verified-registry-count` |

Probes use fresh operands per firing where adaptation is under test, and
repeated operands where pathway reuse is under test; both modes are required —
reuse without adaptation is memorization, adaptation without reuse means
nothing was learned.

## Budgets and escalation

- A probe dispatch that exceeds its family's latency bound (standalone: 120 s;
  multistep: 240 s) or terminates `reached:false` files a gap through the
  normal dispatch machinery; the gap store, not an operator inbox, is the
  escalation channel.
- The qualification cadence lives in the pool as a `timeShapedRhythm` impulse
  (family `qualification`) with a `rhythmFamilyGoal` mapping — read by the
  rhythm conductor, never by a host timer (law 5). If the rhythm registry
  loses this family, `rhythm-seed-tick` restores it.

## The metrics that matter (the gap triple, law 7)

Tracked over the probe stream, not asserted from single runs:

- **Correctness rate** per family, denominated over all firings, with the
  verdict source recorded — a rate whose population mixes deterministic and
  LLM verdicts is a claim about nothing.
- **Verified repair latency** — from probe failure to a landing whose
  post-land verification ran and passed.
- **Recurrence** — a defect class re-observed after its gap closed reopens the
  closure as false.
- **Operator intervention count** — any operator-authored diagnosis, repair
  goal, edit, or restart in the chain disqualifies that cycle from counting as
  autonomous.

## Standing dependencies

Qualification is honest only while these hold; each is checked by its own
detector, and a silent failure of the detector is itself a gap:

- The deterministic oracles remain rejection-capable (the negative control
  must appear in live traces at some cadence, not only in unit tests).
- The reach verdict is consumed by learning (`alphaBetaDelta` non-empty on
  deterministic reaches) and by selection (pathway acceptance observed at the
  policy threshold).
- Post-land verification executes on cutovers (see gap class
  `autonomous-landings-are-never-post-verified` while open).
