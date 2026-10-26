# The interface is shapes: every behaviour of the surface is changeable through interaction

**Vessel:** human-surface-vessel (interpreter, primitives, write checks, the person's record,
sign-in), with named dependencies on goal-host-vessel (dispatch, walk state, utterance routing,
asking a person), development-vessel (validators, gap store, the readers of answers) and
identity-vessel (people's accounts and delegated tokens).

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
- **A person's history lives in a store that forgets it.** The person's list is drawn from
  what goal-host still holds, which is a bounded window of recent runs. When it drops a run, or
  a read fails, the person's ask vanishes from their list or stays "running" for ever, and they
  ask again.
- **The system asks people from code, and most answers go nowhere.** Several steps write
  questions directly. None of them is selected, traced as a step or graded. Most of the
  readers of those answers are unscheduled or absent. Asks outlive the gap they were about.
  An answer to an earlier revision is hidden when the asker rewrites the question. A hold
  that waits on a person's verification has no exit.
- **A message is read by a closed list.** A misreading is invisible to learning, and a
  message that is only a reading's prefix is sent as a goal.
- **Every output is a preview.** A page is drawn from its first 2,000 characters, and a long
  answer cannot be read here at all.
- **The interface is arranged around the machinery, not the person.** Shape names, producers,
  ids and counts sit at the same weight as the answer. A raw artifact is presented as the
  answer. One layout serves different jobs.

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
11. **A person's asks and their outcomes are the surface's own record**, kept durably, so
    their threads outlive whatever goal-host still holds.
12. **A message is read by reader activities**, chosen by their record in context. The stakes of
    a reading decide its echo: applied with undo, confirmed first, or offered as a choice.
13. **Asking a person is an activity the system selects, and the surface is one of its
    resolvers.** Every ask names its subject, carries the evidence to answer it, has a reader
    and a time, and leaves when its subject closes.
14. **Verification is a choice among validators**, a person being one. An answer given without
    a person's credential only steers reversible actions.
15. **A person signs in, so a verdict they give is theirs.** The credential stays on the server,
    and a delegated token is minted per write.
16. **A signed-in person can read any output whole.** Everyone else sees the preview, marked as
    cut.
17. **An activity may draw into its own run's region**, and nowhere else. Progress is the
    surface's own drawing of the walk.
18. **The landing serves the person's jobs:** what needs them, their threads, the system's
    health, and teaching.

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

Whether the interface serves people is measured per job, from records the surface already keeps:
- the time to an answer the person accepts;
- how often they ask again;
- how often they override the default form;
- complaints by kind;
- how often a person's verdict disagrees with the judge's;
- how soon stuck work is noticed;
- the share of asks answered, and the share of answers a reader acted on.
