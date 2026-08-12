# Gap pool triage — disposition ledger

What this is: a per-gap record of why every open `substrateGap` was closed, kept
open, or deferred, with the evidence that decided it. It exists because the pool
crossed 600 open rows and a bulk close with no citation is indistinguishable from
deleting the system's own demand signal.

Read this alongside `validation/scripts/stage-harness.ts`, which pins the defects
that stayed open as executable fixtures.

## Method

1. **Prove the write path before using it.** The gap store's flat write shape
   returns `success:true` while silently ignoring `status`; only the `gap`-nested
   form applies. Every close in this ledger is followed by a read-back that
   confirms `status` flipped and `closed_at` was stamped. A write that reports
   success is not a write that landed.
2. **Read members, not counts.** A category total says nothing about what the
   category contains.
3. **Adversarial refutation before closing.** Every proposed close is re-checked
   by an agent instructed to break it, defaulting to refutation when uncertain.
   Closing a live gap silently deletes real demand — the worst outcome available.
4. **The generators are in scope.** Closing the backlog while the minters run at
   their current rate resolves nothing.

## Measured flow

The pool held **635 open rows**, and grew by **3 rows in the 4 minutes** it took to
close 1. Any triage that does not also bound the minters is arithmetic that loses.

## Findings established before the fan-out

### One goal minted 77 capability gaps

Of 173 open `missing_capability` rows, **123 originate from gap-*closing* goals**,
and **77 from a single one** — `Close substrate gap
a-draining-compose-host-returns-503-and-goal-host-never-reads-the-status`.

That is the amplifier: an unclosable gap is a gap *generator*, and its output rate
is proportional to how often the picker retries it. Each minted gap is itself
pickable, so the pool compounds.

Named shapes from that goal's walks include `a-detailed-fix`, `success-message`,
`evidence_of_503_fix`, `implementationDetails`. These are not shapes.

### Only 4 of 173 name anything real

Matched against the live 391-shape vocabulary:

| verdict | n | reading |
|---|---|---|
| exact live shape | 3 | `edge_liveness_report`, `memory_note`→`memoryNote`, `file_content`→`fileContent` |
| plausible near-miss | 1 | `finalEditResult` → `fileEditResult` |
| no match | 155 | prose nouns |
| no shape in summary | 14 | malformed |

**A correction to a previously recorded belief.** The prior note held that this set
was *mixed* and must not be bulk-closed, on the strength of `editResult` being a
near-miss for the real `fileEditResult`. That single example was real, but it is
not representative: measured across all 173, the near-miss population is ~4, not a
substantial fraction. The caution was right in kind and wrong in scale.

**And the mirror caution, which survives.** A looser matcher (substring
containment, fuzzy at 0.75) "found" a live shape for 24 of them — including
`customer`→`cluster`, `analysis`→`code:impact_analysis`, `status`→`git_status`,
`report`→`test_report`. Those are coincidence. A loose matcher finds a plausible
near-miss for almost any English noun, so string distance cannot decide this
class; only meaning and actual template demand can.

### Two mechanisms proposed and refuted

Recorded because a refuted mechanism is cheaper to leave written down than to
re-derive:

- **Bridge-authored producers declare invented input shapes.** Refuted: all 39
  `BRIDGE-AUTHORED` lines in 48h declare `inputs=[goal]` or `inputs=[]` — real
  vocabulary members.
- **`inferGoalTargetDecision` skips the vocabulary filter that
  `inferGoalTargetShapes` applies.** Refuted: it filters, via `filterShape`
  against `known`.

The filter chain in `fileCapabilityGap` also demonstrably works *for real names* —
the journal shows `[fileCapabilityGap] already served: goal normalizes to goal`.
Invented names sail through precisely because they are not real enough to match a
deny-list entry, which is the structural problem: **the gate is a deny-list over
names, when the only sound gate is evidence of demand.** The function's own comment
asserts that genuine demand is "template-demanded"; nothing enforces it.

## Dispositions

Populated by the triage run; see the tables appended below.
