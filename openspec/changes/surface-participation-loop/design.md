# Design — the participation loop

Read with [`proposal.md`](proposal.md). Widgets, footer states and the `Answer` type are
the `Interaction` contract of [`surface-render-contract`](../surface-render-contract/design.md)
§4; this document specifies, per input site, **who reads the input, what that reader parses,
and how the outcome is read back**.

---

## 1. The regime

Every human input site on the surface carries four things:

| Part | Meaning |
|---|---|
| **Write** | the shape / route the input is sent as |
| **Reader** | the activity or resolver that consumes it, by name |
| **Contract** | exactly what the reader parses — built by the widget, never left to prose |
| **Readback** | where the surface reads the result, and the outcome states it can show |

A site without a reader shows *"Recorded — nothing acts on this kind of answer yet"* and
has a held gap for the reader. A site whose contract is a text parser runs a byte-mirror of
that parser in the browser before sending, and refuses a submission that would parse to a
different result than the person chose.

Chrome (tabs, Live/Paused, run filter) is not an input site.

---

## 2. Inventory

| # | Site | Write | Reader | Contract | Readback | Status |
|---|---|---|---|---|---|---|
| Q1 | Escalation: "Needs your decision" (`needs-human-*`) | participation → `uiFeedback_write` | development-vessel `escalation_disposition_apply` | text containing one verb; optional `EDIT_SITE:` / `VERIFY_SHAPE:` / `EXPECTED_LITERAL:` lines | gap `classification_metadata.human_disposition{,_record_id,_at}` | reader live; contract unmet by UI |
| Q2 | Escalation: "Fixes that keep failing" (`reland-needs-human-*`) | same | same | same | same | same |
| Q3 | "Did the fix work?" (`pending-verify-*`) | same | **none** | — | — | reader missing → gap |
| Q4 | "Where should the change go?" (`needs-localization-*`) | same | **none** (the Q1 reader ignores this prefix) | — | — | reader missing → gap |
| Q5 | Docs decision (`docs-decision-*`) | same | development-vessel `docs_decision_answer_scan` — but it reads answers from **Obsidian vault notes** (`obsidian:note`), not from the surface's answer log | — | — | answers given on this surface are unread (and its asks are untyped — held gap `uiquestion-asks-writer-sends-claim-hint-not-typed-asks`) |
| R1 | Add context to a running goal | `poolImpulse_write` → goal-host | the walk's next iteration (`drainInjectedImpulses`) | `{dispatchId, shape, content}`; useful only when `shape` is one the walk needs | `goalWalkState.poolEvents` (source "human-contributed impulse") and whether `pendingTargets` shrank | reader live; shape not steered |
| R2 | Answer a waiting walk | `solicitationResponse_write` → goal-host | the waiting walk (`pendingSolicitations`) | `{solicitationId, outcome, answer}` | walk resumes; solicitation leaves the log | **route broken upstream** → gap |
| R3 | Grade a finished run | `/api/grade` → `goal_verification_label_write` | oracle corpus (goal-host reach judge, obsidian grader) | verdict + notes | `goalWalkState.humanGraded` / `humanReachNotes` | live; readback already shown |
| F1 | Report a problem | `/api/feedback` → `uiFeedback` | gap store, keyed `ui-feedback-<region>-<kind>` | region + kind + text | the gap in the Issues drawer | live; receipt not linked |

---

## 3. Contracts

### 3a. Escalation answer (Q1, Q2)

The applier (`escalation-disposition-apply.ts`) reads the latest non-dismiss answer per
panel, runs `parseDisposition(text)` — first match wins, in the order **redefine → grant
access → provide information → drop**, matched anywhere in the text — then applies:

- `drop` → gap closed, `closed_reason: human_dropped`
- any other → gap reopened with a bounded exemption from the category seal and
  `failed_attempts: 0`
- labelled lines, each on its own line: `EDIT_SITE: repos/…` (sets `edit_site`),
  `VERIFY_SHAPE: <shape>` (sets `verify_shape`), `EXPECTED_LITERAL: …` (sets
  `expected_literal`)
- idempotence on the answer record id (`human_disposition_record_id`)

The widget builds the text as:

```
<verb phrase>
<details>
EDIT_SITE: <path>          (only if given)
VERIFY_SHAPE: <shape>      (only if given)
```

with verb phrases chosen to be the parser's own literals: `redefine`, `grant access`,
`provide missing information`, `drop`. Because the parser is position-blind, details that
mention another verb ("don't redefine it, just drop it") would flip the result — the mirror
check catches this before sending. `EXPECTED_LITERAL` is **not offered**: a literal gate is
wrong for a behavioral defect and closes gaps on text presence; it stays available only by
typing it deliberately.

### 3b. Add context (R1)

`goalWalkState.pendingTargets` lists the shapes the walk still needs. Supplying one of them
is the only injection that can satisfy the walk; `human_context` is free-form context no
activity consumes by shape. The widget therefore offers **"Provide <shape>"** per missing
target as the primary action and free-form context second.

### 3c. Outcome readback

A small proxy route, `GET /api/gaps/:id` (human-surface `src/routes/proxy.ts`, the same
upstream as `/api/gaps`), returns one gap. The question view polls it after sending while
the card is open.

| Outcome | Condition | Shown |
|---|---|---|
| applied | `human_disposition_record_id` == this answer's record id | "Applied — *verb*" + what changed (reopened with N attempts / closed / edit site set) |
| pending | sent, not yet applied, < 10 min | "Sent — waiting for the applier" |
| not understood | sent, not applied after the applier's next run, or pre-check failed | "Not understood — choose one of the four" |
| superseded | a newer answer's record id is applied | "Replaced by your later answer" |
| unread kind | Q3–Q5 | "Recorded — nothing acts on this kind of answer yet" |

---

## 4. Wireframes

### 4a. Escalation card (Q1 / Q2)

```
NEEDS YOUR DECISION
goal-target inference read 'What is happening in the world right now?' as substrate health
goal-target-inference-reads-…-narrowed · failed auto-repair 8× · 0 lands

  <question body, rendered>

What should happen to this gap?
  ( ) Redefine the goal          the goal is wrong or too broad
  (•) Provide missing information here is the fact it lacks
  ( ) Grant access                it needs a credential or permission
  ( ) Drop it                     not worth closing — closes the gap

  ┌───────────────────────────────────────────────────────────────┐
  │ It should route to web_search — the tool is advertised and    │
  │ answers in one call.                                          │
  └───────────────────────────────────────────────────────────────┘
  ▸ Where the fix goes (optional)
      Change site  [ repos/goal-host-vessel/src/goal-intent.ts    ]   must start with repos/
      Verify with  [ web_search                                   ]   shape that proves it

  [ Send ]  [ Decline ]                  ✓ Applied — provide information · reopened, 3 attempts
```

Mirror-check failure, inline, before sending:

```
  ⚠ Your details mention "drop", which the applier would read first as a different
    decision than "Provide missing information". Reword the details.   [ Send ] disabled
```

### 4b. Unread kinds (Q3, Q4, Q5)

```
DID THE FIX WORK?
repos/development-vessel/src/resolvers/feature-compose.ts — add a FABRICATE-TO-SATISFY lens…
route-edit-e8797240 · landed 83c8a95e

  <question body, rendered>

  ( ) Fixed it   ( ) Inert — nothing changed   ( ) Wrong change   ( ) Can't tell
  [ details … ]
  [ Send ]                     ⓘ Recorded — nothing acts on this kind of answer yet
```

The typed Choice is kept so that, when the reader lands, answers given now are already
machine-readable.

### 4c. Outcome strip (all question cards)

```
✓ Applied — drop · gap closed                      (reached)
… Sent — waiting for the applier                   (pending)
✗ Not understood — choose one of the four          (not understood)
↺ Replaced by your later answer                    (superseded)
ⓘ Recorded — nothing acts on this kind of answer   (unread kind)
```

### 4d. Running run: what the walk is missing (R1)

```
refresh the substrate reality model …
◐ running · 1m 12s · rhythm-conductor-drain

THE WALK IS MISSING                                          (from pendingTargets)
  fs_edit            [ Provide ]
  resolver_schema    [ Provide ]
  ▸ Add other context

  Provide resolver_schema
  ┌───────────────────────────────────────────────┐
  │ {"shape":"…"}                                 │   Text ▾ / JSON
  └───────────────────────────────────────────────┘
  [ Add to the walk ]            ✓ In the pool at 1:14 — resolver_schema no longer missing
```

The block sits under the verdict line while the run is running and disappears when it ends.
Readback: the injected impulse appears in the trace with source "human-contributed impulse",
and the target leaves `pendingTargets`.

### 4e. Waiting walk (R2) — target, after the route gap closes

```
Questions tab                              Run view
WAITING ON YOU  (1)                        ? waiting · 4m · run-goal
  investigate and decompose …              ┌ The walk is waiting on you ─────────────────┐
  run 01347a2b · waiting 4m                │ <question_markdown, rendered>               │
                                           │ ( ) Answer  ( ) Not now  ( ) I lack context  │
                                           │ [ answer … ]                    [ Send ]     │
                                           └─────────────────────────────────────────────┘
```

A waiting walk appears in both places; answering in either resumes the walk.

### 4f. Report a problem (F1)

```
  ( hard to see ) ( hard to understand ) ( wrong )
  [ what is wrong … ]
  [ File ]              ✓ Filed as ui-feedback-the-surface-hard_to_understand — show ›
```

"show ›" opens the Issues drawer scrolled to that issue, highlighted.

### 4g. Grade (R3) — unchanged

Already reads back (`humanGraded`, `humanReachNotes`); kept as the reference instance.

---

## 5. Phases

| # | Work | Where | Outside the grant |
|---|---|---|---|
| 1 | Escalation card: verb Choice + details + optional change site / verify shape; mirror of `parseDisposition` with a test pinning it to the development-vessel source | UI | — |
| 2 | `GET /api/gaps/:id` and the outcome strip; confirm the participation receipt id equals the interactor-log record id the applier stores | human-surface `src/routes/proxy.ts` + UI | — |
| 3 | Add context driven by `pendingTargets` | UI | — |
| 4 | Report → issue link and highlight | UI | — |
| 5 | Unread-kind labelling and typed Choice for Q3 / Q4 | UI | — |
| 6 | Reader for pending-verification answers (apply "inert" / "wrong" through the failed-verification protocol) | development-vessel | extend held gap `pending-verification-questions-go-to-a-human-without-a-confidence-first-pass` |
| 7 | Reader for localization answers (set `edit_site` from the answer) | development-vessel | new held gap |
| 7b | `docs_decision_answer_scan` also reads the surface's answer log, not only vault notes | development-vessel | new held gap |
| 8 | Mid-walk questions: route to a question producer (`uiQuestion_write`) instead of the `human_input` vault reader; check the response body, not the status; surface waiting walks in the Questions tab | goal-host-vessel | new held gap |

Phases 1–5 are independent of 6–8. When 6 or 7 lands, its site moves from "unread kind" to
the Q1 contract pattern and the label disappears.

---

## 6. Validation (pre-registered)

1. **Parser mirror.** A test runs the surface's mirror and development-vessel's
   `parseDisposition` over the same fixture set (including every live answer text) and
   asserts identical results; editing either without the other fails it.
2. **Contract met.** Every escalation answer the new widget can produce parses to the verb
   the person chose (property test over verbs × detail fixtures); a detail that flips the
   verb blocks Send.
3. **Positive control for readback.** Answer one live escalation through the widget; within
   one applier run the gap carries `human_disposition_record_id` equal to the receipt id and
   the card shows "Applied". If the ids differ, phase 2's premise is false and the readback
   must key on something else.
4. **Unparsed rate.** Of escalation answers given through the new widget, zero are
   `unparsed` (baseline: ~40 of 65).
5. **Add-context lands.** An injection chosen from "The walk is missing" removes that shape
   from `pendingTargets` in the next `goalWalkState` read.
6. **No hollow receipts.** No card shows "Applied" or "Sent" for a kind in the unread set.

---

## 7. Evidence (as measured when this was written)

- `uiFeedback_write.jsonl` (the log the applier reads): 83 records on escalation panels —
  63 answers and 18 declines on `needs-human-*`, 2 answers on `reland-needs-human-*`;
  65 distinct answered panels. Answer texts with no parseable verb: 40.
- Gaps with `human_disposition` set: 15, all `provide_information`.
- `pending-verify-*` / `needs-localization-*`: no reader anywhere in the fleet's source.
- `docs-decision-*`: `docs_decision_answer_scan` reads `obsidian:note` vault notes only.
- `poolImpulse_write`: 0 injections in 7 days; no activity or resolver declares
  `human_context` as input.
- `human_input` producers in discovery: development-vessel (`resolvers/human-input.ts`, a
  vault-note reader), two registrations. goal-host's solicitation path checks only `r.ok`.
  0 solicitations posted in 7 days.
