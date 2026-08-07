# The do-anything surface — one box, honest verdicts, no shape vocabulary

**Vessel:** stateful-ui-vessel (surface) + goal-host-vessel (dispatch, walk state)
**Lever:** the substrate already accepts arbitrary natural-language goals. It has no
surface a person can reach without installing Obsidian. Close that, and close it
without repeating the failure that a status field is allowed to stand in for an outcome.

## Problem

A "do anything" input **already exists three times** — the Obsidian panel omnibox, the
MCP `run_goal` / `run_goal_async` tools, and the federation ingress `goalDispatchAsync`
type. All three are thin clients of the same two goal-host routes, so a fourth
implementation of "free text in, dispatch out" would add no capability whatsoever.

What does not exist is **reach**. The only human-facing omnibox lives inside an Obsidian
plugin that needs a rebuilt bundle, a plugin reload, and a live libp2p sidecar before it
answers at all. The one browser surface with a general audience, `workbench`, points at
activity-api and has no goal input. The one browser surface that is already the
substrate's face, `stateful-ui-vessel`, carries the substrate→human ask path
(`uiQuestion_write` → `uiFeedback`) and the human→substrate write path (`interactor*`)
but cannot accept a goal.

So a person who is not the operator, at a machine without Obsidian, cannot ask this
system to do anything. That is the gap.

## Reuse before mint

`stateful-ui-vessel` is the existing producer. It is browser-reachable, discovery-
registered, already streams over SSE, already renders a three-region UI, already records
operator interactions durably and emits them back as shaped impulses, and already carries
a visibility contract. It is missing one capability: human-initiated goal dispatch.

Minting a *separate* surface vessel would split the human's attention across two screens for
what is one conversation — the human asks, the substrate asks back mid-walk, the human
answers. The solicitation loop and the dispatch loop must share a surface or each is
half a surface. **The do-anything box belongs wherever the ask/answer loop lives.**

> **Superseded in part by `human-surface-stack`.** That change replaces the surface layer
> root-and-stem: stateful-ui-vessel and react-renderer are retired in favour of one
> human-facing vessel built from first principles. The reasoning above still holds — the two
> loops share a screen — but the screen is the new vessel, not stateful-ui-vessel. This
> change contributes the interaction contract; that change contributes the stack it is built
> on and the checker it is validated against.

The vessel-shaped question — *what would a minimal compliant vessel look like* — is
answered in `design.md` anyway, because the answer is small, because a spoke that masks
the `ui` role still needs the surface somewhere, and because the same skeleton is what a
future surface for a different human resolver would use.

## Behavior (expectations a reader can hold the system to)

**1. The box states what it can do, at the box.** An empty input is the worst possible
capability signal. The surface renders, adjacent to the input, a small ranked set of
specific starters drawn from shapes that actually have live producers — not a category
list, not invented examples. Clicking one **inserts editable text and does not dispatch**.
The capability claim is derived from the discovery registry at render time, so it cannot
drift from the fleet.

**2. A dispatch shows its contract before it runs.** Duration band, the target shapes the
walk inferred, and what the walk will not do without asking. Uncertainty is shown as a
band, never a point estimate, and never as a numeric confidence — planner confidence in
this system is measurably uncalibrated, so a percentage would be a fabricated signal.

**3. `reached` is the headline; `status` is never rendered alone.** A dispatch that exits
`completed` with `reached:false` renders as **not reached**, in the same visual weight as
any other failure, with the reason. There is no arrangement of the surface in which a
template exit status can be mistaken for an outcome. A hollow success is the most
expensive thing this surface could ship.

**4. The completion evidence is an artifact, not prose.** Every terminal state renders the
thing that can be checked — the diff, the answer body, the shapes produced, the trace id —
and labels what is missing when there is nothing to show. A walk that reached with no
artifact says so.

**5. The surface never moves under the reader.** Variable output occupies a fixed region.
Rows keep stable identity across refreshes; a row that settles becomes *more* readable,
never less. Scroll position, focus, text selection, and any open input survive every
update. New items arriving out of view are announced as a count, not spliced into the
reader's viewport.

**6. Questions and answers happen in the same place as the goal.** A solicitation raised
mid-walk appears attached to its dispatch. Answering it resolves it in place. The human is
never asked to correlate a question on one screen with a run on another.

**7. The human speaks prose; the system owns translation.** No shape names, no template
ids, no file paths are ever required from the human. Where the walk cannot infer a target
with enough confidence, it asks a specific question rather than guessing — the clarification
exit specified in `obsidian-legibility-surface`, reached through the same router.

**8. A verdict is cheap to record and is recorded at the moment it is held.** Grading a
dispatch is one gesture from the row itself. Disagreement is as easy to record as
agreement, and the surface does not solicit praise — a correct outcome needs no feedback.

**9. Everything the surface does is an activity and is traced.** Dispatching, grading,
answering a solicitation, injecting context: each goes through the shaped-impulse path
that already exists, so a human's session is evidence the loop can grade rather than an
unlogged intervention. The surface earns no private endpoints.

## Non-goals

- **Not a chain editor.** Composition belongs to `workbench` under the contract in
  `docs/architecture/WORKBENCH_CHAIN_UX_DESIGN.md`. This surface dispatches and reports.
- **Not a replacement for the Obsidian surface.** That vessel holds a specific human's
  local information and a vault write boundary. This one is reachable from a browser by
  someone who has neither.
- **Not a new dispatch path.** Every action maps onto a goal-host route that exists.
- **Not an autonomy control panel.** Gating what the substrate may do to itself is a
  separate concern and an in-band gate would not be a control anyway.

## Shape contract

**Consumed** (all served today): `goalWalkState`, `activeDispatches` — goal-host-vessel.
`vesselCapability` — discovery-vessel, for the capability claim and starters.
`execution_trace` — activity-api, for terminal evidence.

**Produced** (all served today): `goal_dispatch_async` — goal-host-vessel.
`poolImpulse_write`, `solicitationResponse_write`, `solicitationHeartbeat_write` —
goal-host-vessel. `uiFeedback`, `interactorEvent`, `interactorObservation` —
stateful-ui-vessel's own store.

**Producer sought before minting:** goal-host-vessel produces every dispatch and
walk-state shape this surface needs; stateful-ui-vessel produces every interaction shape.
**No new shape is required and none is proposed.** If the surface appears to need one, the
missing thing is an activity, and the activity is the gap to file.

## What would falsify this

Not "the box dispatches." The observables that distinguish landed from reached:

1. A person who has never seen this system, at a browser, with no operator present, types
   an intent in prose and gets an outcome they can act on — without ever typing a shape
   name, a template id, or a file path.
2. A dispatch that exits `completed` with `reached:false` is read as a failure by that
   person, unprompted. If they read it as success, the surface has shipped the defect it
   exists to prevent.
3. Grading a run does not require finding it first. A row worth grading is still on screen
   when the human reaches for it.
4. Every gesture the surface offers appears in the trace store, attributable, with no
   endpoint that mutates state outside the shaped-impulse path.
5. The oracle corpus stops being a biased failure sample — verdicts arrive on reached runs
   at a rate comparable to failed ones.
