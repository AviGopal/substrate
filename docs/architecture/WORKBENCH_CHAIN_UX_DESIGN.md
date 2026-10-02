# Workbench Chain-Based UX Design

The workbench is the human-facing surface for **chains**: compositions of activities
wired together by impulse shapes. This document states the contract that surface holds —
what a chain is, what a human must be able to do to one, and what the surface must never
do. It is a behavioural contract, not a component inventory: implementations are free to
choose their own widgets and libraries as long as the invariants below hold. Where this
document and the running workbench disagree, the running system is authoritative and the
divergence is a gap to file.

---

## Vision Statement

A **chain** is a loose DAG in which activities are state-transition nodes and impulses are
the data edges between them. A chain is the same object the goal walk produces when it
backward-chains from a target shape; the surface only makes that object visible and
editable by a human. Composing a chain therefore means: injecting impulses as entry data,
selecting activities that consume and produce shapes, binding outputs to inputs by shape,
executing, observing, and extracting what worked as a reusable template. The surface adds
no private notion of "workflow" that the substrate cannot see — anything a human builds
here must be expressible as activities, shapes, and traces, because anything else is
unlearnable.

---

## Core Design Principles

These four principles are the load-bearing part of the contract. Each one exists because
its violation produces a specific failure: an untraced edit, a hidden impulse, a
one-directional search that cannot answer "what do I need for this?", or an execution view
that silently diverges from the execution it claims to show.

### 1. Activities All the Way Down

Every editing gesture that changes substrate state — creating a template, wiring a
composition edge, editing a task, saving a variant, launching a chain — must go through
the same activity-and-trace machinery as any other execution, never through a private
side-channel that mutates state invisibly. The consequence is that the surface earns no
special privileges: what a human does here is gradeable by the same learner that grades
autonomous work, and the record of a human's session is evidence, not an unlogged
intervention. A gesture that cannot be expressed this way is a missing activity, and the
missing activity is the gap to file rather than a reason to add a bespoke endpoint.

### 2. Impulses as First-Class UI Elements

Impulses are not backend plumbing hidden behind the activity boxes. Each impulse is a
visible object carrying its shape, and the shape is displayed as a badge wherever the
impulse appears, because shape is the routing key a human reasons with. The surface must
show what data is in hand at every point of the chain, let a human insert an impulse
between two activities rather than only at the entry, preview an impulse's metadata
without forcing its content to be resolved, and mark compatibility between an available
impulse and a candidate activity's inputs. Hiding impulses collapses the chain back into
an opaque pipeline the human can only run, not reason about.

### 3. Bidirectional Mapping and Discovery

The surface must support search in both directions. Forward: given the shapes already in
hand at that point in the chain, which activities are applicable, and how are they ranked. Backward: given a target
shape the human wants, which activities produce it, and what prerequisite shapes must be
obtained first — the same backward chaining the goal walk performs, exposed so a human can
see why a goal is not yet reachable and what is missing. Resolver lookup is part of the
backward direction: "which vessel can serve this shape" is answered by querying the
discovery registry, never from a hardcoded vessel list or a pinned port, so the answer
stays correct as the fleet changes.

### 4. Chain Execution as State Space Exploration

Executing a chain is exploration, so the surface must present three distinct views and
never conflate them: **before**, the predicted transitions and the shapes expected to
accumulate; **during**, live state as the execution reports it; **after**, the actual
result set against the prediction, so the difference is visible feedback rather than a
silent overwrite. The live view subscribes to the substrate's execution event stream —
task lifecycle and impulse-resolution events — and it must survive a dropped connection by
reconnecting and requesting the events it missed by sequence number. A view that
reconnects without catching up shows a plausible but wrong state, which is worse than
showing that it is disconnected.

---

## User Stories Mapped to Activities

The stories below are the required capabilities of the surface, stated as contracts rather
than as screens. Each names what the human supplies, what the system owes in return, and
the invariant that makes the interaction honest. None of them may require the human to
pre-translate their intent into shapes, file paths, or template identifiers: the human is
a resolver sending natural-language intent, and decomposition is the system's job.

### Story 1: Create Activity From Goal

A human states a goal in natural language. The system owes a decomposition: candidate
existing activities that already cover it, and — only when nothing covers it — a drafted
template proposed for review. Reuse must be offered before minting, because a duplicate
activity splits selection traffic and starts from an uninformed posterior. The drafted
template is a proposal, not a fact: it is shown for edit and confirmation, and it carries
no earned standing until it has actually run. A surface that jumps straight to "create
new" teaches minting as the default, which is the expensive path.

### Story 2: Wire Activities Together

A human connects one activity's output to another's input. The surface must validate
before accepting and must state its reason when it refuses. Three rules hold: shapes must
match — compatibility is decided on the shape key, not on a guess about content; direction
must run output to input; and the proposed edge must not close a cycle in the existing
graph. A refusal names which rule failed, so the human learns the shape vocabulary from
the refusal instead of being left to guess. Accepting an invalid edge and failing later at
execution time is the failure this validation exists to prevent.

### Story 3: Find Resolver for Shape

A human selects a shape and asks who can serve it. The answer comes from the discovery
registry — the fleet's one fixed point — and includes each candidate vessel's advertised
capability and health, so an unhealthy or unadvertised vessel is not silently offered as
an option. The surface must never carry its own table of vessels or endpoints: placement
follows data locality and changes as the fleet changes, and a stale hardcoded list is
wrong the moment a vessel moves. Where a shape has no producer at all, that emptiness is
itself the answer and should be shown as a gap rather than as an error.

### Story 4: Explain Activity Selection

When the chain selects among variants, a human must be able to ask why. The explanation
owes the actual decision inputs — the posteriors over the competing arms and the draw that
picked the winner — not a narrative reconstructed after the fact from the outcome. An
explanation generated from the result rather than from the recorded decision state is
self-confirming and will always sound right, which makes it useless as evidence. Where
counterfactuals were recorded at decision time, showing what would have been chosen under
different inputs is the honest form of a what-if view.

### Story 5: Modify Activity Template

Editing a template's task, prompt, or validation rules produces a **variant**: a new
template that records its parent for genealogy and starts from fresh neutral priors, so it
must earn its own standing by running rather than inheriting the parent's credit. The
parent is left intact, which keeps the earned posterior attached to the thing that earned
it and makes the edit reversible by simply not selecting the variant. The surface should
capture the rationale for the change alongside it, because the rationale is what makes a
later comparison between parent and variant interpretable.

### Story 6: Preview Execution

Before running, a human may ask what is likely to happen: which shapes the chain would
accumulate, and what duration, cost, and success rate the historical traces of these
activities imply. Predictions must be presented with their uncertainty and must be clearly
distinguishable from results — a preview that renders identically to a completed run
invites a human to act on a forecast as though it were an outcome. A preview must not
mutate substrate state or consume the resources of the real run; it reads history, it does
not rehearse the execution.

---

## Self-Referential UI Tracing

Work done through the surface feeds the same learning loop as work done autonomously.
That is the point of routing edits through activities rather than direct writes: the
human's session becomes evidence the system can learn from, and the surface becomes
subject to the same honesty rules as everything else — the record is what happened, not
what the interface intended.

### Recording UI Workflows

Every chain the surface starts is a traced execution, retrievable afterwards by its
execution id, and every state-changing gesture is attributable to the operator who made
it. The trace, not the interface's own optimistic state, is the record: if a gesture
succeeded on screen but produced no trace, it did not happen as far as the system is
concerned, and the surface should surface that discrepancy rather than absorb it. This
also means the surface must not offer any path that changes substrate state without
producing a trace, however convenient such a path would be.

### Learning from UI Patterns

Human-authored compositions are training signal: the edges a human draws between
activities, the impulses they insert, and the variants they keep are evidence about which
compositions are worth attempting. That evidence is graded the same way as any other —
by whether the resulting executions actually reached their goal, not by how often a
composition was drawn. Frequency alone measures habit, and a surface that ranks by
frequency will confidently recommend whatever humans do most, including their mistakes.

### Auto-Suggesting Based on UI History

The surface may propose the next activity to add, ranked by the learned posterior over
activities that consume the shapes in hand. Suggestions must be legible as
suggestions and must carry the evidence behind their ranking, so a human can disagree with
one on the merits. Acceptance and rejection are both informative and both should be
recorded at the moment of the decision — a rejection recorded only as an absence teaches
nothing, and a suggestion accepted without a record makes the later correlation between
suggestion and outcome uninterpretable.

---

## What the Surface Must Never Do

These are the standing prohibitions. Each corresponds to a way a chain-editing surface
degrades from an interface onto the substrate into a parallel system that quietly diverges
from it.

- **Never mutate substrate state without a trace.** No convenience path, no direct write,
  no optimistic local edit that is never reconciled against what the substrate recorded.
- **Never invent a vessel address.** Endpoints and placement come from discovery; a
  hardcoded host, port, or vessel list is wrong as soon as the fleet moves.
- **Never accept a connection it cannot justify.** Shape mismatch, wrong direction, or a
  cycle is refused with the reason stated, rather than accepted and failed at run time.
- **Never mutate a template that has earned a posterior.** Edits become variants with
  fresh priors and recorded parentage; credit stays attached to what earned it.
- **Never present a prediction as a result,** or a reconnected live view as a complete one
  when missed events have not been caught up.
- **Never require the human to speak the system's internal language.** If a goal only
  works once the human supplies shapes, template ids, or file paths by hand, that
  translation burden is a gap in the system, not a step in the workflow.
