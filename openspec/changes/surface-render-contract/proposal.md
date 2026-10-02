# One render contract for everything the human surface draws or asks

**Vessel:** human-surface-vessel (UI), with named dependencies on development-vessel and
goal-host-vessel
**Extends:** [`human-surface-stack`](../human-surface-stack/proposal.md) and its
[`render-learning.md`](../human-surface-stack/render-learning.md), and
[`do-anything-surface`](../do-anything-surface/design.md) principle 9. This is **not a
fourth registry**: it keeps the settled ruling (dispatch on *form*, never on shape; a closed,
mirrored `CONTENT_FORMS` vocabulary; verbatim `text` as the common case) and gives it one
entry point and one frame.

## Problem

The surface already has most of a render pipeline: `planContent` plans a shaped preview
into a `RenderPlan`, `ContentRender` switches on the plan's form, `formByShape` lets a
person pin a form by instruction, and every draw is recorded as a `form_decision`. What it
lacks is a contract that everything goes through:

- **Five callers frame content five ways.** The trace, the answer, the question body, the
  issue drawer and the response history each assemble their own shape badge, source line,
  truncation marker, copy button and empty notice — or omit them.
- **Inputs bypass the planner.** Raw responses (dispatch outcomes, errors, resolve bodies,
  walk-log objects, human contributions) are drawn as strings or `<pre>` blocks.
- **No density.** The same content cannot be drawn as a rail preview, an inline card and a
  full pane without re-implementing it.
- **Interactions are four one-offs.** Question responses, grading, answering a waiting walk
  and adding context each carry their own input, pending, sent and failed handling. The
  declared ask schema (`Ask {id, prompt, type: text|choice|number}`) is not what its one
  production writer sends (`{claim, hint}`), so typed asks are effectively unused.
- **The learning loop is open.** `form_decision` rows are written and nothing reads them;
  `renderPolicy.learnedFormByShape` exists with no writer and no reader.
- **Streams have no slot.** The surface serves `/api/stream` (store events) and consumes
  none of it; there is no chunk stream anywhere in the fleet yet.

## Change

One pipeline — **source → adapter → `Content` → planner → `RenderPlan` → `<Rendered>` →
form renderer** — and one sibling contract for input, **`Interaction`**, whose question types
are TypeSafe/Jev's three primitives (Choice, Score, Noul) plus free text. Humans and a
decision model become interchangeable answerers of the same typed question.

The planner gains two tiers between a human pin and the heuristic: **learned**
(`learnedFormByShape`, read at use time) and a reserved **jev** tier, both recorded in
`decidedBy` so a wrong choice is traceable to the tier that made it.

## Scope

- **In (UI, human-surface grant):** the `Content` type and adapters, `<Rendered>` frame,
  form registry, densities, the `Interaction` contract and its four widget types, the
  learned-tier read, `/api/stream` as a query-invalidation channel.
- **Out, needs substrate work (gaps, not hand edits):** a form-learner activity that reads
  the `form_decision` corpus (optionally asking Jev) and writes `learnedFormByShape`;
  typed asks at the `uiQuestion_write` writers; a chunk-stream source in goal-host or
  llm-resolver; confidence-routed questions.
- **Not changed:** `CONTENT_FORMS` (no new form is required by anything here), page layout,
  tabs, rail chrome.

See [`design.md`](design.md) for the inventory, contract, wireframes, phases and
validation.
