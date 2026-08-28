# Give the human's answer an effect: the escalation-disposition executor

**Date:** 2026-08-28
**Vessel:** development-vessel (`src/resolvers/solicitation-outcome-scan.ts`, `src/resolvers/gap-to-feature.ts`)
**Stage:** SPEC (investigation complete; read-back repaired and verified live, before-bracket measured)
**Lever:** The increment `2026-08-14-sound-close-oracle-reland` explicitly deferred, whose
stated trigger condition is now met and measured.

## The intent already exists — this spec only records and completes it

This increment is **not a new design**. It was decided across three commits and one
proposal; the executor was never built. Verbatim:

1. **`d1bb37a` (2026-06-30)**, which introduced the category seal:
   > "The picker now **strongly deprioritises** gaps in a category the substrate has
   > empirically learned it CANNOT land (>=8 attempts, 0 lands, from the calibration
   > store) — it acts on its own measured limits instead of re-attempting a hopeless
   > class, **leaving a re-test path**."

2. **`143212a` (2026-08-06)**, which made the exclusion real:
   > "DEAD FILTER. The map ran over `gaps`, so `scoredGaps` — hopeless-category rows
   > **already escalated and meant to be excluded** — was computed and then discarded…
   > This **permanently removes 106 currently-open gaps** from auto-selection; **that is
   > the intended effect, not a side effect.**"

   This traded the automatic re-test path for a **human decision**, and predicated the
   exclusion on the row being *already escalated* — escalation runs immediately before
   the `continue` (`gap-to-feature.ts:827-847`). **The human is the designed escape.**

3. **The disposition vocabulary is already authored**, in the escalation body
   (`gap-to-feature.ts:831`):
   > "It likely needs a human response: **redefine the goal, provide missing information,
   > grant access, or drop it.**"

4. **`openspec/changes/2026-08-14-sound-close-oracle-reland/proposal.md`** scoped this out:
   > "Out-of-scope (separate increments): … escalation wiring (`uiQuestion_write` for
   > re-land — **the next increment if the after-bracket shows re-composition churn**)."

**The trigger is met, measured 2026-08-28:** `recommit-route-edit-9077062c-typecheck_dangling_reference-narrowed-semantic_reject-narrowed`
chains re-pick continuously, and a gap filed at 22:43 was declared chronically-stuck and
spawned a verbatim `-narrowed` clone by 22:49 — six minutes.

## Problem

The seal was never designed to be permanent. It became permanent because the escape
`143212a` relied on **had never once functioned**:

- The ask worked — **1755 accepted escalations in 48h**, 84-85 live panels.
- The read-back was structurally dead in two independent ways (the sole caller dispatched
  bare; the reader read obsidian episodes keyed on `solicitation_ids` while answers land
  in stateful-ui keyed on `panel_id`, and nothing produces `solicitation_ids` at all).
  Proof it had never been used: the durable answer log held **48 records with 0 `panel_id`**.
- Repaired by `fe52076`, verified through the running vessel's live dispatch:
  `outcomes 0 → 85`, `answered 0 → 1`, the one answered id being exactly the panel an
  operator had answered.

**What remains is the last link: an answered escalation still has no effect.**
`solicitationOutcomeReport` has **no consumer** — the only occurrences fleet-wide are
inside its own producer. Nothing closes, redefines, drops, or re-tests the gap.

**Before-bracket:** 12 sealed categories; **79 of 412 open gaps (19%)** excluded by
`hopeless()`, independently confirmed by the selector's own `hopeless_excluded: 79`.
`orphaned_capability` sits at 346 attempts / 0 lands.

## Two fixes considered and rejected, with reasons

- **Relax `hopeless()` back to a penalty.** Reverses `143212a`'s explicitly stated
  intended effect. The re-test path was traded away deliberately, not lost.
- **Count gap closures as calibration lands so categories can unseal.** The calibration is
  `predictLand`'s per-category baseline for whether **compose** can land a gap like this
  (`gap-to-feature.ts:1945-1948`). An operator hand-closure is not evidence of composer
  capability; feeding it in corrupts the self-model to improve a number. For the same
  reason, `needs-human` answers must **not** be folded into `recordOperatorEngagement`,
  which calibrates the close-oracle's re-land abstentions — a different evidence class.

## Change

A disposition executor that consumes `solicitationOutcomeReport` and applies the
already-authored verb to the gap. One shaped disposition per answered escalation:

| verb | effect on the gap |
|---|---|
| `drop` | close with `closed_reason: "human_dropped"`; no calibration write |
| `grant_access` / `provide_information` | attach the supplied fact to `classification_metadata`, then **restore a bounded re-test path** (see below) |
| `redefine` | rewrite the gap's summary/target from the human's answer, reset `failed_attempts`, **restore a bounded re-test path** |

**The re-test path is the load-bearing half.** Because `143212a` traded the automatic
re-test path *for* the human answer, `redefine` and `provide_information` must give it
back — that is precisely what they replaced. Bounded, so it cannot reopen the flood
`143212a` closed: an answered gap becomes selectable again for a **limited number of
attempts**, and its category stays sealed for everything else. The seal is not lifted;
one row is granted a human-authorized exemption.

Per §12.6, this is sound: validity is *measurement against the un-authorable referent*,
and a human answer is un-authorable by the substrate — it is exactly the referent the
section requires, not another self-authored certificate.

## Scope (one change, one measurement)

**In scope:** a consumer for `solicitationOutcomeReport`; the four-verb disposition
applied to the gap; the bounded re-test exemption; parsing the verb from the answer text.

**Out of scope (separate increments):**
- The stale-base cutover revert (`mitosis-cutover-lands-a-stale-base-patch-as-a-silent-revert`).
- `uiFeedback_write` standing as a generic floor satisfier, so goal-walks "reach" by
  writing payloads into the operator-feedback channel (48 records / 0 `panel_id`, all
  goal text; `repos/boredom-vessel/src/goal-generation.ts:304` documents the behavior).
- Any change to `hopeless()` itself.

## Verification (after-bracket)

- Per-resolver test: an answered escalation carrying each verb produces the stated gap
  mutation; an unanswered one produces none; a `dismiss` is not an answer.
- Live: answer one `needs-human-*` panel with `redefine`; the gap becomes selectable
  again within its bound, and the **category remains sealed** for its other members.
- The seal's own numbers move for a reason that is auditable: `hopeless_excluded` falls
  only by the count of human-answered gaps, never by more.
- Watch: exemption abuse — a gap re-consuming picks without landing should exhaust its
  bound and re-escalate rather than thrash.

## Note on this document

The program that produced the seal — cited in code as "expectation-setting step 2/3,
2026-06-29" — **has no spec in `docs/` or `openspec/`**; only two code comments, with no
step 1 anywhere. Its intent was recoverable only from commit messages. That is an
unwritten expectation against this vessel's own rule that no code lands without a spec,
and it is why this proposal quotes the ledger at length rather than citing a section.
