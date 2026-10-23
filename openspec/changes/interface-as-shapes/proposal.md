# The interface is shapes: every behaviour of the surface is changeable through interaction

**Vessel:** human-surface-vessel (interpreter, primitives, write checks), with named
dependencies on goal-host-vessel (dispatch, walk state, utterance routing) and
development-vessel (validators, gap store).

**Consolidates and extends** the earlier changes, kept in history:
`do-anything-surface`,
`human-surface-stack` and its
`render-learning.md`,
`surface-render-contract`,
`surface-participation-loop`.
This is not a fifth parallel design. It keeps what those changes settled, builds the part of
`render-learning.md` that never ran, and reopens one ruling, named below.

## Purpose

A person, or the system itself, can change any behaviour of the interface by interacting
with it: the layout, the design, how components are made, how content of any shape is drawn,
and how input is read. A change takes effect without a rebuild or a deploy, is traced like
any other execution, can be undone, and is kept or retired by the same learning loop that
governs every other activity.

## Problem

- **Most of what the surface shows is compiled into its bundle.** Layout, component structure
  and most rendering rules are constants. The system cannot observe them through a shaped
  impulse, so by law 1 it can never learn them, and a person cannot change them except by
  asking an operator for a commit.
- **The form vocabulary is closed.** The system can choose among the forms the surface ships
  (prose, rows, record, scalar, page, …) but cannot make a new one. "Show this the way I need
  it" is reachable only when an existing form happens to fit.
- **The one channel the system does write is unguarded.** `renderPolicy_write` refuses only
  writes that change nothing. A test process once wrote out-of-range importance weights for
  test-only kinds into the live policy, and the learner carried them forward as its anchor
  because nothing checked what was written.
- **Input is several separate controls, and most of them reach nothing.** Grading is refused
  for want of a human-scoped credential, corrections and follow-ups have no reader, and the
  system's questions mostly arrive as empty panels.

## What changes

1. **Everything a person can perceive and might want changed is read from shapes at render
   time:** layout, design tokens, the form chosen per shape, and view descriptions (`uiView`)
   that compose fixed primitives and bind by pointer to a run's impulses. The frame, the
   interpreter and the primitives remain code.
2. **Views are produced by activities.** Variants compete per context under the existing
   selection, and every choice lands in a trace. An independent validator activity checks
   each produced view, once one is verified to run. Extracting views that keep working into
   templates is an aim with its own check. No view is hand-declared.
3. **Primitives are the only presentation code,** added rarely and on evidence, the way
   resolvers are. Today's renderers become the first primitives and the fallback.
4. **Every write that steers presentation is checked, attributed and revertible.**
5. **There is one input, the box, read in a visible context,** echoed with how it was read.
   Every other control only chooses what the box is about. The interface does not explain
   itself: labels are a few words, state is shown by marks.
6. **The default view is threads, not runs:** one outcome, one learning mark, one fold.
7. **Every observation carries its source and has a reader.** A person's verdict is kept and
   weighed, never refused. A person's input is a person's by provenance, never by a shape's
   name.
8. **Teaching is a reading of the box with a named reader:** verdict, steer, correction,
   lesson, answer, missing input. It is proven by the thread's later outcome.
9. **The system's self-management is drawn as threads:** its gaps, commits, deployments and
   configuration changes, graded like any run. The interface is how people observe the
   system's health and capability.
10. **A time-displaced ask is a thread with a future:** a commitment the system's own rhythm
    machinery honours, shown as "next due", judged at commitment and fulfilment.

## The ruling this reopens

`surface-render-contract` settled two rulings: dispatch on form, never on shape; and
`CONTENT_FORMS` is closed and mirrored. The first stands. The second is replaced in principle:
**the set of primitives is closed; the set of forms is open.** A form is either a primitive or
a `uiView` composed from primitives. A closed form vocabulary cannot coexist with a system that
changes how components are made.

The reopening takes effect when the `uiView` interpreter lands (`tasks.md` phase 4). Until
then the closed list stays in code, and nothing in this change claims otherwise.

## What does not change

- Choosing by form, never by shape.
- Reach before exit status; the surface never moves under the reader (`do-anything-surface`).
- Every input names its reader and shows its outcome (`surface-participation-loop`).
- Arbitrary markup is drawn only inside the sandboxed page primitive, which grants nothing.

## Measured by

The gap triple applied to the interface: interface gaps closed, the latency from detection to
close, and whether they stay closed. Also, the share of interface changes asked for in text
that took effect, and how long each took. Not by the number of views, variants or primitives.
