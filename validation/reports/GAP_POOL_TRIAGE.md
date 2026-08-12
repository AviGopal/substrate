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

### ⚠ RETRACTED: "the gap triple is unmeasurable"

**That claim was wrong, and it was the loudest claim in this ledger.** An earlier
revision said latency and durability were both unreadable, on two mechanisms taken
from the fan-out and written up without probing the live store. Both are false as
stated. Probed against the running resolver:

**Latency is measurable.** `detected_at` *is* overwritten by a close, but it was
never the anchor. `first_detected_at` is, and it is explicitly preserved —
`substrate-gap.ts:513-515` says so (*"first_detected_at anchors durability — never
overwritten by a re-emission's detected_at"*) and the store agrees:

```
open,  detected 2026-08-07 → detected_at=2026-08-07  first_detected_at=2026-08-07
close, detected 2026-08-12 → detected_at=2026-08-12  first_detected_at=2026-08-07
                                                      closed_at=2026-08-12T03:42:49Z
```

`closed_at − first_detected_at` computes correctly. Nothing is destroyed.

**Recurrence is counted.** `reopen_count` increments on a closed→open re-emission:
0 → 1, verified by round-trip. The insert branch leaving it absent is deliberate —
a fresh row has never reopened, and the comment at :536-538 states that intent.

### The real defect: recurrence is invisible for volatile-id detectors

What survives is narrower and was not what either mechanism claimed. The class-key
fallback at `substrate-gap.ts:460` excludes closed rows:

```ts
gaps.findIndex((g) => hasClassifiableId(g) && g.status !== "closed" && gapClassKey(g.id) === classKey)
```

So a re-emission carrying a *different* volatile id in the same class, after that
class was closed, cannot find its closed sibling and creates a fresh row instead of
incrementing it. Probed:

```
open   triage-probe-class-1786500000000  → created
close  triage-probe-class-1786500000000  → updated (reopen_count=0)
open   triage-probe-class-1786500000001  → created (reopen_count absent)
```

`gapClassKey` exists *precisely because* detectors mint volatile per-run ids. So
recurrence is undercounted for exactly the detectors that motivated class dedup,
and a durably-closed gap that comes back under a new id reads as a brand-new gap —
inflating the apparent mint rate while hiding the recurrence. That is a real hit to
law 7's durability leg, but a much smaller one than claimed, and the close-rate and
latency legs are fine.

### The method note this earns

Three findings in this triage came from the fan-out and needed a probe before they
could be trusted: the `missing_capability` set being "mixed" (over-stated), the
`detected_at` overwrite (harmless), and `reopen_count` (working). **A finding from a
subagent is a hypothesis with a citation attached, and a citation is not a
measurement.** Every load-bearing claim here that could be probed against the live
store now has been.

## Repairing the largest minter, and what the dispatches showed

The 503 gap — `a-draining-compose-host-returns-503-and-goal-host-never-reads-the-status`
— was repaired first because it is the parent of 77 of the 173 phantom capability
rows. It was dispatched as a **non-specific goal**, twice, before any hand-editing.

Both tries produced the same result: **right file, right region, syntactically
invalid TypeScript, caught by `tsc` and rolled back** (TS1472/TS1005 at 9696-9706,
then TS1005/TS1136/TS1128 at 9582-9609). Neither reached a landing.

Two behaviours are worth crediting, because both are failure modes seen earlier:

- It **refused the ungraded escape hatch**, twice: *"ESCALATION SUPPRESSED — the
  byte-anchored route runs no semantic judge and lands ungraded; a region-named
  gap stays on the judged compose path."*
- It graded itself honestly throughout — two `deterministic:edit-intent-no-landed-edit`
  hollow verdicts, and a satisfier refusal on the grounds that a filesystem write
  with no landed sha is uncreditable.

### The drafter's edit site was better than the operator's

Both attempts anchored on `if (earlyComposeResp.ok) {` — the pre-walk EARLY
compose route. That was recorded here, initially, as an adjacent-but-wrong site,
because the defect had been located by reading code and the later compose call at
:10026 is the one that parses a body without consulting the status.

**Production traffic settled it against the reading.** Restarting the producer
mid-dispatch put the 503 on the EARLY route:

```
EARLY EDIT-INTENT feature_compose HTTP 503 — falling through to walk
```

The later call never saw it. The drafter chose the site that fires; the operator
chose the site that does not. Both holes were real and both are now closed
(`eed0ccf`, `ee4622a`), but the localisation credit belongs to the system, and the
two failures were **syntax, not localisation**.

The generalisable form: *a defect site identified by reading is a hypothesis, and
the traffic is the experiment.*

### The fix is validated, and insufficient

Forced 503s on two independent dispatches, 2/2:

```
03:34:18  EARLY EDIT-INTENT compose producer draining (503) — re-issuing in 30000ms
03:36:01  EARLY EDIT-INTENT compose producer draining (503) — re-issuing in 30000ms
```

Both re-issues then received **503 again** and fell through. Cause, filed as
`the-drain-503-advertises-a-retry-after-eight-times-shorter-than-its-own-drain-budget`:
`development-vessel/src/index.ts:248` hardcodes `Retry-After: 30` while its drain
deadline at `:309` is `VESSEL_DRAIN_MS` = **240000 ms**. The advertised callback is
up to 8× shorter than the window in which it keeps answering 503, so a caller that
honours the header correctly still re-issues into the same drain. A constant
cannot be right here except by coincidence.

So the caller-side change converts *silently discard* into *one bounded retry* —
a strict improvement, validated — and the remaining half is a producer-side defect
left for the substrate rather than hand-patched.

### The amplifier, observed live

Twenty-two rows were minted over the session. Twelve had appeared by mid-triage. Six are
`missing_capability` from the same 503 goal — `gap-host-503-response`,
`gap-goalhoststatusread`, `gap-analysis-of-503-cause`, `gap-bug-fix-report`,
`gap-bug-fix-verification`, `gap-system-status-report` — all reach-gate prose,
all minted while the analysis of that exact mechanism was being written.

## Final state

| measure | value |
|---|---|
| open at session start | 635 |
| open at session end | 287 |
| dispositions applied and read-back-verified | 369 |
| `rejected` (never was a gap) | 301 total in store |
| `closed` (was a gap, now resolved) | 238 total in store |
| minted during the session | 22 |
| real defects left open, each with file:line and a repair | 129 |
| honestly undecidable, each with the reason | 15 |
| refutation survivors, held open | 121 |

Nothing here is a claim that the pool is healthy. It is a claim that every open row
is now one of three things: a defect someone can act on, a close that survived an
adversary, or a question with a stated blocker.

## Dispatchability is not a property of the target

The landing queue marks 8 of 79 rows `dispatchable`, judged on the target: single
file, modest size, colocated test, and a distinctive anchor near the edit site.
Rank 8 (`cross-file-symbols.ts`) satisfies every one of those — 403 lines, a
17KB colocated test, host md5 == deployed md5, anchor verified to occur exactly
once, two lines from the edit site.

**It is still not dispatchable, and the criterion was wrong.** Three natural
phrasings of the same symptom were pre-flighted:

| phrasing keyed on | localiser's decision |
|---|---|
| "cross-file" | `feature-compose.ts` — wrong file |
| "treats every" | `llm-router.ts` — wrong file |
| "word-shaped" | no unique hit — unrestated, walks instead of composing |

The anchor being good says nothing about whether the *goal prose* reaches the
file. Those are two separate conditions and only the second decides whether a
pathless goal composes at all.

The counts underneath are the whole story: `"cross-file"` occurs in 6 files,
`"treats every"` in exactly 1, `"word-shaped"` in 0. The localiser's decision
procedure is *an English bigram that happens to occur in exactly one file* — so
which file a symptom edits is decided by a coincidence of prose, not by meaning.
That is ranks 5-7 of this same queue, measured live rather than argued.

**And it is a law-13 finding about the operator, not only the system.** Getting
those three phrasings took three rounds of hand-tuning prose to steer a substring
match. A goal that only works after an operator rewrites it is a gap in the
system, not a workflow to institutionalise — and the rewriting here was mine.

### The localiser cannot route a goal about the localiser

Rank 6 is `symptom-to-file-localisation-depends-on-a-substring-coincidence`, in
`goal-host-vessel/src/goal-file-resolution.ts` — 1021 lines, **two** colocated
tests, host md5 == deployed md5, anchor verified unique. On target properties it
is the best remaining candidate in the queue.

No pathless goal reaches it. The phrases that describe what the localiser does
are shared with the files that *call* it:

| term | files containing it |
|---|---|
| `"unique hit"` | 4 |
| `"left unrestated"` | 3 |
| `"restated with target"` | 2 |
| `"locator class"` | 0 |

A symptom description of the localiser is written in the localiser's own
vocabulary, and that vocabulary is exactly what its consumers quote. So the
uniqueness test can never fire on the right file — the defect **prevents its own
repair from being dispatched**.

Across two targets and five pre-flighted phrasings, no non-specific goal became
dispatchable. The two-try budget could not be spent, and that is a reach ceiling
in the localiser rather than a failure of the drafter: nothing was ever asked to
implement anything.

## What must be repaired next

1. **`fileCapabilityGap` gates on a deny-list over names**, so any noun the reach
   gate writes becomes a capability gap — 174 rows, the largest single minter.
   The sound gate is evidence of demand, and the precedent is already in the tree:
   `inferGoalTargetDecision` filters its model's shape names against the known
   vocabulary.
2. **Class-key recurrence after a close is invisible** (`substrate-gap.ts:460`),
   so durability is undercounted for volatile-id detectors.
3. **The recommit minter omits `parent_gap_id`**, the exact field the
   anti-grandchild guard at `gap-to-feature.ts:1771` reads.
4. **`Retry-After: 30` outlives nothing** — the producer's own drain budget is
   240s (`development-vessel/src/index.ts:248` vs `:309`).

Close rate and detection→close latency are both readable — an earlier revision of
this ledger claimed otherwise and has been retracted above. The 635 → 287 count is
real; the durability leg is the one that stays partly blind, and only for
volatile-id detectors.
