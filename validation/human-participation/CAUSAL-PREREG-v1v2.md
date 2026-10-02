# Pre-registered causal evaluation: repertoire v1 (stacked) → v2 (one-page)

Registered BEFORE any scored human run. The three questions are kept separate and
each carries its own horizon; an unelapsed horizon is PENDING, never refuted.

## Declaration

| Field | Value |
|---|---|
| Intervention | Presentation variant `onepage` (repertoire v2) instead of `stacked` (v1), selected via the `renderPolicy` impulse, adopted at page load |
| Affected activity | Human participation sessions on the human-surface vessel: frozen scenarios S1, S3, S5, S6, S7 |
| Expected consequence | Higher correct-assessment scores on S3/S6 keys and lower cross-question loss on S7, because verdicts sit beside evidence and all strands are co-visible without navigation |
| Observation needed | Per-run: scenario id, variant actually adopted (data-presentation read from the DOM, not the policy write), assessment-key score, time to completion, assistance given verbatim, preference statement (recorded separately from outcomes) |
| Comparison condition | v1 vs v2 on the same frozen scenarios, participant-counterbalanced order (half start on v1); practice exposure recorded per participant per key |
| Time horizons | Q1 immediately per run; Q2 after ≥6 scored runs per variant across ≥3 participants; Q3 only after a learning write exists at all (blocked on the consumption gaps) |
| Resources / stopping | Frozen-set runs only; stop Q2 collection at 12 runs per variant or when the 95% score interval separates, whichever first; no mid-collection key edits |

## Q1 — Did the change alter the experience? **CONFIRMED**

Verified at the rendering layer, both directions, in a real browser
(`stage5-variants.ts` PASS at `c0addb25`): under `onepage` the page does not
scroll and grid areas are active; under `stacked` grid areas are `none` and the
page scrolls; screenshots per variant; adoption boundary held (a mid-session
selection did not reflow the open page). Failed delivery is observable: the probe
fails on JS errors and on missing regions.

## Q2 — Did the changed experience improve human participation? **PENDING**

No scored human run has occurred. Nothing in Q1 is evidence for Q2 — a layout
that verifiably rendered is not thereby verifiably better. Prediction registered
now, falsifiably: v2 mean S6 score ≥ v1 + 1 point on the 8-point key; if the
interval includes zero after the stopping rule, the correct verdict is
"no supported improvement" and v2's adoption rests on the one-page requirement
alone, not on a comprehension claim.

## Q3 — Did resulting learning improve future behavior? **PENDING (structurally blocked)**

There is currently no path from a human contribution to a learned-state update
(stage-1 matrix). Until the consumption gaps close, Q3 is not merely unmeasured —
it is unmeasurable, and this document says so rather than borrowing confidence
from Q1. When it unblocks: held-out comparison with and without the learned
change, starting-state snapshot required (the stage-1 matrix header is the
snapshot convention).

## Known threats, stated now

Practice effects on repeated keys (counterbalancing + exposure log); operator as
first participant (their runs are labeled and excluded from confirmatory
analysis); the S1/S5 fixtures cannot render on either variant until the
`gap_needs_human` filter gap closes (pre-registered expected failure, see
REPERTOIRE.md); preference ≠ outcome is enforced by recording them in separate
fields.
