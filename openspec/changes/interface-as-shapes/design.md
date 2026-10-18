# Design — the interface as shapes

Read with [`proposal.md`](proposal.md) and [`specs/human-surface/spec.md`](specs/human-surface/spec.md).

## 1. The mapping into the substrate's terms

| Concern | Expressed as |
|---|---|
| A view of a run, thread or question | a shaped impulse `uiView`: a routing key, not a schema, read at render time (law 1) |
| What a view draws | pointers to the run's impulses (pool, `answerBody`, gap rows); never copies |
| Primitives | the surface's resolver-like layer: thin, in code, earned slowly. Today's forms (prose, text, rows, record, scalar, diff, terminal, page, stub, empty) are the first set |
| Authoring a view | an activity: consumes the content's shape, its context, the render policy and the person's words; produces `uiView` (law 2) |
| Choosing among views | the existing selection, per context; every choice is traced |
| Judging a view | reach (the write persisted and an independent validator passed it, once one is verified to run; task 0) plus use (later verdicts and signals), as in `render-learning.md` §5 |
| Keeping what works | ribosome extraction from reached, used views, as an aim with its own check (law 4); reuse before mint (law 3) |
| A person asking for a change | a goal typed into the one box: walk, write a `uiView` or `renderPolicy` value, validate, reached or not |
| The system observing its own interface | `human_surface:ui_view`, extended to name views, variants and policy revisions |
| Interface defects | gaps, closed by view or policy writes, measured by the gap triple |
| A person's verdict, use, re-ask | observations with their source, kept by the surface and weighed by their reader; never refused at the door |
| How much a person's label counts | a reliability learned per source and per shape or kind, from agreement with independent observations and later outcomes; never a fixed confidence or an override. The mechanism is development-vessel's observer calibration (the learning-credit tables beside the close-oracle and expectation calibration), with a person as one more observer |
| Whether an input is a person's | provenance: the human resolver was called (a question delivered and answered here) and the run used the answer; never a shape's name |
| A person teaching the system | a reading of the box with a named reader (verdict corpus, retry step, inference, concept lesson, waiting run) |
| The system managing itself | threads of its gaps, commits, deployments and configuration changes, graded like any run; a gap thread joined by the attempt records' own fields |
| A thread | runs held together by an explicit link carried with each dispatch; grouping by wording is a display fallback, and a re-run is not a link |
| A time-displaced ask | a commitment in the pool (a rhythm or a dated item) that the rhythm conductor honours, judged at commitment and at fulfilment, kept or decayed by use |
| Where it runs | primitives and drawing in the surface vessel, next to the person (law 11); views and authoring activities resolvable from any node |

Two timescales, as in `SUBSTRATE_AS_DYNAMICS.md`: the fast arm reads the current view on
every draw; the slow arm moves view variants' standing with traces, verdicts and use. A
person's request moves the slow arm on purpose.

## 2. Implementation options considered

| Option | Changes without a deploy | Safety | Keeps today's behaviour | Learnable | Theme and accessibility |
|---|---|---|---|---|---|
| 1. Declarative views from fixed primitives | yes | high: no code | yes: primitives and fallback | yes: variants are data | yes |
| 2. System-written markup in a sandbox | yes | medium: hard to validate | partly: an isolated island | weakly | poor |
| 3. System-written UI code, landed as commits | no: gate and restart per change | relies on the gate | risky | slowly | yes |
| 4. Renderer activities emitting views | yes | depends on output | yes, with fallback | yes | depends |

**Chosen:** 1 as the base, authored through 4, with 2 kept as the page primitive for content
no primitive can draw, and 3 reserved for adding primitives.

**External prior art.** Two established protocols take the same approach: the agent describes
the interface declaratively and the host draws it with its own pre-approved components.
- A2UI: an open protocol announced by Google in December 2025. Components are declarative
  JSON with a separate data model they bind to; no executable code.
- Adaptive Cards: Microsoft's declarative JSON UI, drawn natively by each host. Templating
  separates layout from data.

The prototype (task 11) encoded the run outcome both ways, decoded both to one tree and drew
identical markup. **Decision: `uiView` follows A2UI v0.9 `updateComponents`** (a flat list of
`{ id, component, … }` linked by id, `{ path }` JSON Pointer bindings into a data model),
with the surface's own catalog of primitives. A flat list is authored piece by piece, which
suits activities revising one part of a view. The catalog is the closed set of primitives. The
decoder is small and isolated, so a later A2UI revision changes one file. The shape name and
routing stay the substrate's.

## 3. The `uiView` shape (in A2UI's form, per task 11)

```
uiView {
  region:     "run.outcome" | "thread.list" | "run.fold" | …
  variant:    id of this variant
  catalogId:  the surface's primitive catalog
  components: [ { id: "root", component: "Stack", children: ["goal", "answer"] },
                { id: "goal", component: "Heading", text: { path: "/run/goal" } },
                { id: "answer", component: "Text", text: { path: "/answer/text" } } ]
}
```
Each `component` is a primitive. Its props are validated against that primitive's declared
props, and `{ path }` is an RFC 6901 pointer into the drawn context.

Unknown primitives, unresolvable bindings and invalid props fail the whole view, which then
falls back to the default for its region.

## 4. Write checks

Applied in the surface's write path to `uiView` and `renderPolicy` writes:
- refuse unrendered template tokens (`{{…}}`) in any key or value;
- refuse values outside each field's declared range (for example, importance weights above
  a declared bound);
- refuse kinds or ids of test or probe origin;
- refuse fields the surface does not read, naming them;
- record the author (activity or person, execution or dispatch) on every accepted write;
- keep the previous value so that one "undo" restores it.

Refusals name what they refused. A refused write leaves the current value in force.

## 5. The interaction model

There is one input: the box. Every other control only chooses what the box is about, or
changes only what is shown. The interface does not explain itself: labels are a few words,
state is shown by marks, and mechanism lives in these documents. The thread mock is the wireframe: the
context chip, the "Read as" echo, threads with a learning mark, one outcome and one fold, and
time states for each run (asking, running, waiting on you, judged, detail expired, changed
since, deleted).

| Where the person is | Typed | Read as | Read by |
|---|---|---|---|
| no context | a question | a new ask | surface |
| a running run | "also check tomorrow" | context added to the run | surface |
| a run waiting on them | "Seattle" | the answer to its question | surface |
| an outcome | "and tomorrow?" | a follow-up carrying the run's results | system |
| an outcome | "I was asking a question" | a correction to what it understood | system |
| an outcome | "that worked" | a verdict, with the note kept | system |
| anywhere | "show this as a table" / "make the outcome one line" | a presentation change | surface (exact grammar) or system (a view goal) |
| anywhere | "undo" | restore the last presentation write | surface |
| an outcome | "try again, but read the result" | a steer for a retry | system: the retry step |
| an outcome | "next time, GitHub means the website" | a lesson, with its source | system: a concept lesson, read when prompts are built |
| a running run | (Provide, in the fold) | an input the walk is missing | the running walk, as a person's input by provenance |
| a system thread (gap, commit, deploy, config change) | "that change broke X" | a verdict on the system's own work | system: the verdict corpus, and the gap's lane |

Every reading carries its provenance (who, in which context, about which result) and is
echoed with its reading, in a word or two; the reader is named here, not on screen. A reading
is offered only once its reader exists. The proof that it
took is the thread's next outcome: teaching is measured like a gap, by whether it took, how
long it took, and whether it stayed.

## 6. Dependencies outside the surface

| Need | Owner |
|---|---|
| A shape for "a person said this, in this context", read and routed by the system | goal-host / coordinator |
| Follow-ups: the model step sees what is attached; a seed cannot satisfy completion | goal-host (filed gaps) |
| Verdicts typed in the box are recorded | identity decision: who may record a human verdict |
| Runs ask through the route the surface reads, with content | goal-host |
| "Changed since you last looked" from readable slow-arm effects | coordinator |
| A validator for views: `ui_legibility_scan`'s rules pointed at `human_surface:ui_view` | development-vessel / coordinator |
| A run's output readable by id after the walk | goal-host (filed gap) |
| A person's verdict accepted by the learning corpus as an observation with its source, with its reliability learned per source and shape rather than fixed, and no override (the verdict gate) | activity-api, goal-host / coordinator |
| People distinguishable as sources, so reliability is learned per person rather than per surface | identity / coordinator |
| A registry declaration of which shapes are resolved by asking a person | discovery / goal-host |
| The use of a person's answer recorded as a step or shape, not only a log line | goal-host |
| The retry step reading a person's steer; inference reading a correction | goal-host |
| A concept lesson written from the surface, with its source | concept-db |
| Gaps, the system's commits, deploy verdicts and configuration changes readable as shapes for the threads | development-vessel / deployment |
| A link field from a run to the thread or run it continues, carried with the dispatch and distinct from re-running | goal-host |
| Shapes that declare what they take, so inference can choose the shape that answers (a run's record for a question about a run; a commitment for a time-displaced ask) | discovery / goal-host |
| Commitments a person owns: a rhythm or dated item carrying who asked and which thread; admission of "schedule this" as a change; a dated variant the conductor fires on time; an overdue detector; a notification to the person | development-vessel / goal-host |
| What a run was given from other goals' recall, recorded on the run | goal-host |

The surface work in `tasks.md` does not wait on these. Each surface step is useful alone, and
each dependent step is offered only when something reads it.
