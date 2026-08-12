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

### Confirmed: the reach gate names the shape, and nothing checks the name

`repos/goal-host-vessel/src/index.ts:8367`, on the HOLLOW branch:

```ts
const needed = [...new Set([...(verdict.missing ?? []),
  ...((verdict.completion_shapes ?? []).filter((s) => !producedShapes.has(s)))])]
const codeGap = needed.find((s) => !live.has(s));
if (codeGap) { await fileCapabilityGap(codeGap, goal, needed); }
```

`verdict` is the **reach gate's LLM output**. When it judges a goal hollow it also
names, in free text, the shapes the goal would have needed. Those names are not
constrained to any vocabulary, so `codeGap` — "a name with no live resolver" — is
satisfied by any noun the judge happened to write. `a-detailed-fix`,
`success-message`, `evidence_of_503_fix` and `filePaths` are all reach-gate prose.

The journal confirms the ordering directly: the `HOLLOW … completion_shapes=[…]`
line immediately precedes `filed capability gap 'gap-a-detailed-fix'`.

**So every hollow verdict on a hard goal can mint a capability gap**, and a goal
that goes hollow 77 times mints up to 77 of them. That is the amplifier, and it
explains why the pool grows fastest exactly where the system is failing most.

**The asymmetry that makes this a one-line class defect.** The other LLM output
path in this system — `inferGoalTargetDecision` in `goal-target-inference.ts` —
already filters its model's shape names against the known vocabulary via
`filterShape`, dropping hallucinations. The reach gate's output goes unfiltered
into gap filing. The same defect class was fixed on one path and left on the
other.

### Three mechanisms proposed and refuted

Recorded because a refuted mechanism is cheaper to leave written down than to
re-derive:

- **Bridge-authored producers declare invented input shapes.** Refuted: all 39
  `BRIDGE-AUTHORED` lines in 48h declare `inputs=[goal]` or `inputs=[]` — real
  vocabulary members.
- **`inferGoalTargetDecision` skips the vocabulary filter that
  `inferGoalTargetShapes` applies.** Refuted: it filters, via `filterShape`
  against `known`.
- **A registered template declares the invented names as inputs**, entering
  `target` through the recurse path at `index.ts:7763`. Refuted with its own
  control: 448 `recurse — … needs [...]` lines exist in 72h, so the tap works,
  and not one of them names any of the invented shapes.

This one mattered. The obvious repair for the deny-list problem is to gate
`fileCapabilityGap` on *template demand*. Had that third mechanism been true,
that gate would have admitted exactly the noise it was meant to block — the
phantom template would itself be the demand. Confirming the real path first is
what kept the repair from being a plausible mechanism attached to a fix.

### An instrument-provenance correction

The `~/.metabob/config.json` endpoint is `http://syzygy.host:18100`, and
`syzygy.host` resolves to **104.236.0.175 — a remote droplet**. Every MCP tool
call therefore reaches the *hub*, while the gap store being triaged is the
*local* substrate on `localhost:18090`. The 391-shape vocabulary used for the
matching table above is the hub's.

This does not change the conclusion — `a-detailed-fix` and `evidence_of_503_fix`
are not shape names under any vocabulary, and the local substrate's own
`liveShapes()` check had already ruled every one of the 173 unserved locally —
but the table's *provenance* is the hub's registry, not this substrate's, and
anything read through an MCP tool in this session carries the same caveat.

The filter chain in `fileCapabilityGap` also demonstrably works *for real names* —
the journal shows `[fileCapabilityGap] already served: goal normalizes to goal`.
Invented names sail through precisely because they are not real enough to match a
deny-list entry, which is the structural problem: **the gate is a deny-list over
names, when the only sound gate is evidence of demand.** The function's own comment
asserts that genuine demand is "template-demanded"; nothing enforces it.

## Dispositions

Populated by the triage run; see the tables appended below.
