# human-surface — interface as shapes

Each requirement names the check that falsifies it.

## Requirement: presentation is read from shapes at render time

Every behaviour a person can perceive and might want changed (layout, design tokens, the form
chosen per shape, and the composition of regions) SHALL be read from shaped impulses at render
time. Only the frame (the fixed regions and the input), the interpreter and the primitives are
code. Once views are shapes, the frame SHALL itself be described by a default `uiView`, so its
arrangement is changeable even though its machinery is not.

**Check:** a change to any of these shapes, written while the surface is running, is visible
on the next read without a rebuild or restart. An audit lists every presentation constant
still compiled into the bundle and finds each is part of the frame, the interpreter or a
primitive.

## Requirement: a closed set of primitives

The surface SHALL hold a fixed set of primitives in code. Each SHALL draw with the design
tokens and SHALL be accessible: real elements, keyboard reachable, readable in both themes.
A primitive SHALL NOT execute code supplied by content or by a view. Arbitrary markup SHALL be
drawn only inside the sandboxed page primitive, which grants no script, network or storage.
A new primitive SHALL be added only by a reviewed commit, on evidence that no composition of
existing primitives can draw the need.

**Check:** a view or content containing script, event handlers or external references draws
without executing or fetching any of them.

## Requirement: views are declarative and fail safe

A `uiView` SHALL be a declarative tree of primitives with bindings by pointer to the impulses
of the run, thread or question it draws. It SHALL NOT copy their content. The surface SHALL
draw an unknown, invalid or unresolvable view by falling back to the current default view, and
SHALL mark that it fell back. A view SHALL never cause a region to fail to draw.

**Check:** an invalid view written to the live policy leaves the region drawn by the default,
with a fallback mark, and nothing else on the page changes.

## Requirement: views and policy variants are produced by activities

View variants and policy values SHALL be produced by activities, selected per context by the
existing selection, and recorded in traces. A goal that asks for an interface change SHALL
reach only when its write persists and an independent validator activity passes the produced
view. The validator must not share the producer's code path.

This requirement depends on a validator activity that runs and reaches. Until one is verified
to (`tasks.md`, task 0), a view change reaches on its persisted write alone and is marked
unvalidated, never validated.

Extracting views that keep reaching and being used into templates is an aim with its own
check, not an assumption. No template is declared by hand.

**Check:** a typed request ("make the outcome one line") becomes a traced goal whose reach
depends on the persisted write and, once task 0 holds, the validator's verdict, never on the
walk's exit status. Template extraction is checked by a reached, used view appearing as an
extracted template.

## Requirement: every presentation write is checked, attributed and revertible

Every write to `uiView` or `renderPolicy` SHALL be refused, with the refused keys and the
reason named, when it carries:
- an unrendered template token;
- a value outside its declared range;
- a kind or id of test or probe origin;
- a field the surface does not read.

Every accepted write SHALL record its author: the activity or person, and the execution or
dispatch. The previous value SHALL be restorable in one step, by a person typing "undo" or by
an activity.

**Check:** a write whose importance weights include a `{{…}}` kind, or a weight above the
declared bound, is refused with the key named, and the policy is unchanged. "Undo" restores
the value before the last accepted write.

## Requirement: one input, read in a visible context

There SHALL be one input: the box. It SHALL be the only control that sends anything. Choosing
what the person is looking at (a thread, a run, a question, an output, a missing input) and
changing only what is shown (folding, filtering, switching tabs) are not input: they choose
the context the box will use. A suggestion MAY fill the box; it SHALL NOT send.

The context the box will use SHALL be shown next to it, and clearing it SHALL make the next
message a new ask. Every message SHALL be echoed with how it was read, in a word or two
("Answer", "Verdict", "New ask"), and a wrong reading SHALL be correctable in the same box.
The surface SHALL decide only unambiguous cases:
- no context: a new ask;
- an open question: its answer;
- an exact presentation phrase.

Every other message SHALL go to the system as text plus its context.

Every interaction meets the current state of the whole system. Continuity with a specific
earlier exchange (a thread, a run, a question) is explicit and visible, as the box's context
and a link carried with what is sent; it is never inferred from wording.

**Check:** the same words typed in two contexts are read differently, and each reading is
shown before or as it takes effect. No control other than the box sends anything.

## Requirement: one path per kind of interaction

Each kind of interaction SHALL have exactly one write path and one reader, and SHALL be a
reading of the box in its context:
- answering a question (a run's or the system's), including declining it;
- supplying an input a running run is missing;
- a verdict on a result, calibration included;
- a presentation change, with its scope (this output, or every output of a shape) shown in
  the echo;
- a complaint about the interface.

A control that sends anything other than the box (an option button, a form, "Show as", a
complaint button) SHALL be retired once its reading of the box is proven, and never added. An
interaction whose path does not reach its reader SHALL NOT be offered.

**Check:** for each kind, the box in that context produces the write to its reader. A run's
question answered while the question is selected from the questions list reaches the waiting
run exactly as one answered on the run page does.

## Requirement: the interface does not explain itself

Visible text SHALL be the content, plus labels of a few words. State SHALL be shown by marks
(badges, dots, rings), not sentences. How the system works, which part reads an input, and what
is not yet possible SHALL be described in the documentation, not on screen; at most a hover may
say it. Visible text SHALL NOT use the system's vocabulary (shape names, field names, internal
step names) unless the content itself is about the system. The echo names the reading, not
the reader.

**Check:** no label or echo exceeds a few words; no visible text names an internal mechanism
when the content is not about the system; a limitation of the system appears in the docs, not
as a repeated line on screen.

## Requirement: every observation carries its source and has a reader

A verdict is an observation, and it may come from any source: a person, the judge, an oracle,
or use. The surface SHALL keep every verdict a person gives as an observation on the run,
recording:
- the source;
- the result it judged and that result's producer;
- what the judge said.

It SHALL keep it whatever the learning corpus does with it. Weighing observations is the
reader's job: independent agreement confirms a result, and a contrary observation from a
person puts the result in question. The surface SHALL draw a person's verdict beside the
judge's, disagreement included.

A person's label is never authority. People can be mistaken, or judge a shape by a different
criterion. So the reliability of a label SHALL be learned, per source and per shape or kind
of result judged, from its agreement with independent observations and with later outcomes.
It SHALL NOT be a fixed confidence, and it SHALL NOT override another observation by rank.
Every label SHALL therefore carry its source, the result it judged and that result's shape.
A person is one more calibrated observer in the substrate's existing observer calibration
(the learning-credit tables that already calibrate the close oracle and expectations), keyed
per source and per shape or kind. No separate mechanism is added.

An input is a person's only by provenance. It is a person's when the activity that produced it
called the human resolver: this surface delivered the run's question and holds the answer, and
the run records that the answer was used. A shape's name SHALL NOT decide it. A stand-in
produced under the same shape SHALL be drawn with its producer, never hidden. It SHALL be
labelled as produced without a person only from a registry declaration of which shapes need a
person, never from a name.

**Check:** a grade the learning corpus refuses is still kept on the run and drawn beside the
judge's verdict. No label is written with a fixed confidence. A person-shaped output a satisfier produced draws with its producer and no
person mark. An output from the step a person's answer drove is marked as theirs.

## Requirement: teaching is a reading of the box, with a named reader

A person teaches the system through the one box, by what they type in a context. The surface
SHALL offer each teaching reading only once its reader exists, and SHALL name the reading in
the echo. Each reading's reader:
- a verdict ("that worked", "wrong answer") is read by the verdict corpus;
- a steer ("try again, but read the result") is read by the retry step;
- a correction ("I was asking a question") is read by goal-target inference;
- a lesson ("next time, GitHub means the website") is read as a concept lesson when prompts
  are built;
- an answer to its question is read by the waiting run or gap;
- a missing input is read by the running walk.

Every teaching message SHALL carry its provenance: who taught it, in which context, and about
which result.

Teaching is proven only by its effect. A later ask in the same thread, or a similar one,
SHALL show whether the taught thing held. The measure is the gap triple: whether the teaching
took, how long it took, and whether it stayed.

**Check:** a reading with no reader is never offered. A lesson typed at an outcome is written
with its source and context, and its reading is echoed. The thread's mark changes when a later
run of that thread reaches after the lesson.

## Requirement: the system's self-management is visible as threads

What the system does to itself SHALL be drawn as threads beside a person's, and graded the same
way:
- its gaps, from detection through attempts and a landed commit to verified and still closed;
- its commits to its own code;
- its deployments, with the gate's verdict and the restart;
- its changes to its own configuration and policies, each with its author and an undo where
  the write path keeps one.

A person's verdict on any of these is an observation its reader weighs, as for any run.

A gap thread SHALL be joined by the fields the system records about its own attempts (the
gap, each attempt, the attempt's run, its outcome and commit), never by matching text. It
SHALL show a node's own work, with that scope in its label. Its mark SHALL count attempts and landings
separately, and how often the gap reopened, because the share of attempts that land is the
system's own measure of whether it is closing what it detects. An attempt with no run on
record SHALL be shown as one, not hidden. A step the system does not record in a readable form
(a deploy, a configuration change, today) SHALL NOT be drawn, and SHALL NOT be inferred.

**Check:** a commit the system lands appears as a thread step naming the gap it addressed and
the gate's verdict. A policy change appears with its author. A deploy appears with the units
it restarted. A run that belongs to a gap's attempt appears inside that gap's thread and in no
other thread.

## Requirement: threads, not runs

The default view SHALL group a person's asks into threads by goal. Each thread SHALL show its
outcome, a learning mark, and one fold holding attempts, outputs and provenance. The learning
mark SHALL be derived from the thread's reach history together with the observations of
people and use, so a disputed reach is shown as disputed. When readable, it SHALL also show what changed since the person last
looked. A person's threads SHALL never be pushed out of view by the volume of system runs.

A thread SHALL be held together by an explicit link from each run to the thread or run it
continues, carried with the dispatch. Grouping by the words of the ask is a display fallback:
it separates the same ask in two wordings and joins different asks that share words. A
re-run mechanism SHALL NOT stand in for the link: a re-run reuses the earlier run's identity,
and a new ask that continues a thread is a new run.

**Check:** with any number of newer system runs, a person's thread remains listed with its
latest outcome. A reworded ask that continues a thread lands in that thread once the link is
carried.

## Requirement: time-displaced threads

An ask whose intent is displaced in time ("remind me in an hour", "every couple of hours
check…", "send a follow-up next week", "tell me when it's done"), in any wording, SHALL be a
thread with a future. The thread SHALL show what is coming ("next due" for a one-off,
"every ~N · next due" for a rhythm). The runs that fire later SHALL land in that thread by link,
and a result that arrives after the person left SHALL be shown as changed since they looked.
The box, with the thread as context, SHALL read "stop", a new rhythm and a new due time as
changes to that commitment, each offered only once its reader exists.

The commitment is the system's own mechanism, not a scheduler in the surface:
- the ask is understood as time-displaced by inference over shapes that declare what they take;
- the walk commits it as a rhythm or a dated item in the pool, carrying who asked and which
  thread, through the write path rhythms already use, and only on a goal admitted as a change;
- the rhythm conductor fires it when due, within what the system can afford, and a one-off
  dated item fires at its time;
- the run it fires delivers to the thread; a reminder is a notice to the person;
- it is judged twice: at commitment (the item exists with the right due time) and at
  fulfilment (it fired on time, was delivered, and was used);
- a commitment fulfilled and used is extracted into an activity like any reached work;
- a rhythm whose results nobody uses decays out by the conductor's own economics;
- a commitment that comes due and does not fire or is not delivered is a gap.

**Check:** a time-displaced ask shows "next due" on its thread; the run it fires lands in the
same thread; "stop" in that context ends it; an overdue commitment appears as a gap.

## Requirement: a run judged against another ask is marked

When a run's outputs or its verdict refer to a different ask than the run's own (the system
fed it material recalled from other goals, and that material, not the ask, shaped what ran or
what was judged), the surface SHALL mark the run "judged against another ask" and show which,
from what the run records about the recall it was given. It SHALL NOT infer the mismatch from
wording.

**Check:** a run whose search ran another goal's query, from recalled material it records, is
marked, and the mark names the recalled ask.

## Requirement: honesty about what is known

Content SHALL be drawn as verified or learned only when the run reports it in a field the
surface reads:
- verified: a deterministic reach reason (for example `deterministic:transform-verified`);
- learned: the run's tier or execution path names a recorded pathway (`learned_pathway`).

Content the run reports as guessed or not understood (an empty inference, a model answer with
no source) SHALL be drawn distinctly from that. Everything else is drawn as unknown, never as
verified. An interaction SHALL NOT be offered unless something reads it.

**Check:** a run whose inference returned no target is never drawn as verified. A run with
no verified or learned marker is drawn as unknown.

## Requirement: the surface reports what it drew

The surface SHALL serve, as `human_surface:ui_view`, which view, variant, forms and policy
revision it drew for each region, so that the system can read its own interface and
validators can check it.

**Check:** after a variant takes effect, `human_surface:ui_view` names that variant for the
region it drew.
