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

## `closed` is a training label, not just a state

Marking a never-was-a-gap row `closed` would corrupt the learning signal, because
several consumers read `status === "closed"` as **landed / successfully repaired**:

| consumer | line | what `closed` means there |
|---|---|---|
| `gap-landability-model.ts` | 69, 173 | the model's positive training set |
| `gap-lifecycle-scan.ts` | 302 | `landed = status === "closed" && !failedSentinel` |
| `detector-coverage-scan.ts` | 119 | increments `detector_coverage_gaps_closed` |
| `detector-yield-registry.ts` | 261 | per-detector yield accounting |

Closing 394 phantom rows would therefore have taught the landability model that
394 phantom gaps were successfully landed, and inflated every detector's apparent
yield. The close would have looked like progress *by construction* — the gap
triple (law 7) measured against a corpus the closing itself poisoned.

So dispositions split by what actually happened:

- **`invalid-close` → `status: "rejected"`.** The row was never a coherent gap.
  `rejected` keeps it in the store for audit and is excluded from every
  closed-means-landed consumer above, since all of them test strict equality.
- **`stale-close` / `duplicate-close` → `status: "closed"`.** These genuinely were
  gaps; one is fixed, the other is covered elsewhere. Counting them as closed is
  accurate.

Round-tripped against the live store before use: a `rejected` write persists as
`rejected` and, unlike a close, does **not** stamp `closed_at`.

## Dispositions

Twelve verifiers assigned a verdict to every one of the 635 open rows, reading
members and citing file:line. Every proposed close was then attacked by an agent
told to break it and to default to refutation when uncertain.

| verdict | n | applied as |
|---|---|---|
| never was a coherent gap | 394 | `rejected` (303 applied, 91 broken on refutation) |
| defect gone from the live tree | 75 | `closed` (48 applied) |
| duplicate of another open gap | 22 | `closed` (18 applied) |
| **real defect, still true** | **129** | left open |
| honestly undecidable | 15 | left open, each with the reason |

**Refutation broke 121 of 491 proposed closes — 24.6%.** That is the number that
justifies the pass: without it, roughly one close in four would have been wrong,
and a wrong close deletes demand silently.

**369 dispositions applied, every one read back and confirmed; zero write
failures.** Open rows: **635 → 277**.

The 277 reconcile exactly: 121 refutation survivors + 129 real defects +
15 undecidable + 12 rows minted during the session.

### A silent truncation in the first refutation pass

The first pass batched proposed closes by category and sliced each batch at 60,
so **172 of 491 closes were never shown to any refuter** — `missing_capability`
(104 dropped) and `systematic_failure` (68). One refuter noticed and said so:
*"the prompt says 164 closes but enumerates only ~60."*

Nothing was applied from that unrefuted set. A second pass ran all 172 in six
batches with no cap, required every id to be accounted for, and broke 30 more.
The lesson is the one the harness already encodes about verification gates: a cap
that is not logged reads as coverage. Here the cap was mine.

## The generators

Closing the backlog is the smaller half. Six minters produce it:

| minter | site | rows |
|---|---|---|
| `fileCapabilityGap` | `goal-host/index.ts:4409` | 174 |
| recommit gap minter | `feature-compose.ts:2202` | 69 |
| synthetic `route-edit-<goalhash>` identity | `goal-host/index.ts:9538` | 58 |
| orphaned-capability census | `orphaned-capability-scan.ts:242` | 55 |
| narrowed-child minter | `gap-to-feature.ts:1781` | 49 |
| `emitAuthoringDecision` | `goal-host/index.ts:13546` | 37 |

Two of them are structural rather than merely noisy:

- **The recommit minter omits `parent_gap_id`** from the metadata it writes, and
  `gap-to-feature.ts:1771` gates narrowing on exactly that field — so the
  anti-grandchild guard cannot see the children this minter creates.
- **The narrowed-child guard reads caller-supplied in-memory metadata**
  (`meta0` = the passed gap object) rather than the stored row, so a caller that
  omits the field defeats it.

### The gap triple is currently unmeasurable

Law 7 measures close rate, detection→close latency, and durability. Two defects
make the last two unreadable:

- **`closeAuthoringDecisions` (`goal-host/index.ts:13600`) writes the close with
  `detected_at: new Date().toISOString()`**, overwriting the stored detection time
  with the close time — on ~390 rows. `detected_at` is the anchor for latency.
- **`reopen_count` is only assigned in the update branch**
  (`substrate-gap.ts:518-520`); the insert branch at 538-540 never seeds it, so
  recurrence is not counted from a gap's first life.

Any claim that gap latency or durability is improving — including any claim made
from this ledger — is unfalsifiable until those two are fixed. That is the first
thing to repair, because it is what every other measurement here rests on.

### The amplifier, observed live

Twelve rows were minted during the ~2.5h of this triage. Six are
`missing_capability` from the same 503 goal — `gap-host-503-response`,
`gap-goalhoststatusread`, `gap-analysis-of-503-cause`, `gap-bug-fix-report`,
`gap-bug-fix-verification`, `gap-system-status-report` — all reach-gate prose,
all minted while the analysis of that exact mechanism was being written.
