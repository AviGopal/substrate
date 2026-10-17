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
SHALL say that it fell back. A view SHALL never cause a region to fail to draw.

**Check:** an invalid view written to the live policy leaves the region drawn by the default,
with a visible fallback note, and nothing else on the page changes.

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

All input SHALL arrive through one text box. The context the box will use (the selected
thread or run, any open question, the visible outcome) SHALL be shown next to the box, and
clearing it SHALL make the next message a new ask. Every message SHALL be echoed with how it
was read and by whom, and a wrong reading SHALL be correctable in the same box. The surface
SHALL decide only unambiguous cases:
- no context: a new ask;
- an open question: its answer;
- an exact presentation phrase.

Every other message SHALL go to the system as text plus its context.

**Check:** the same words typed in two contexts are read differently, and each reading is
shown before or as it takes effect.

## Requirement: one path per kind of interaction

Each kind of interaction SHALL have exactly one write path and one reader, whichever place on
screen it starts from:
- answering a question (a run's or the system's), including declining it;
- supplying an input a running run is missing;
- a verdict on a result, calibration included;
- a presentation change, with its scope (this output, or every output of a shape) named in the
  echo;
- a complaint about the interface.

Text SHALL be entered only in the one box. Other controls (an option, a "Provide" on a missing
input, "Show as") SHALL either select the context the box will use or send through the same
path the box uses. They SHALL NOT be a second writer. A place that offers an interaction whose
path does not reach its reader SHALL NOT offer it.

**Check:** for each kind, every place it can be started from produces the same write to the
same reader. A run's question answered from the questions list reaches the waiting run exactly
as one answered on the run page does.

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

An input is a person's only by provenance. It is a person's when the activity that produced it
called the human resolver: this surface delivered the run's question and holds the answer, and
the run records that the answer was used. A shape's name SHALL NOT decide it. A stand-in
produced under the same shape SHALL be drawn with its producer, never hidden. It SHALL be
labelled as produced without a person only from a registry declaration of which shapes need a
person, never from a name.

**Check:** a grade the learning corpus refuses is still kept on the run and drawn beside the
judge's verdict. A person-shaped output a satisfier produced draws with its producer and no
person mark. An output from the step a person's answer drove is marked as theirs.

## Requirement: teaching is a reading of the box, with a named reader

A person teaches the system through the one box, by what they type in a context. The surface
SHALL offer each teaching reading only once its reader exists, and SHALL name the reader in
the echo:
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
with its source and context, and is named in the echo. The thread's mark changes when a later
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

**Check:** a commit the system lands appears as a thread step naming the gap it addressed and
the gate's verdict. A policy change appears with its author. A deploy appears with the units
it restarted.

## Requirement: threads, not runs

The default view SHALL group a person's asks into threads by goal. Each thread SHALL show its
outcome, a learning mark, and one fold holding attempts, outputs and provenance. The learning
mark SHALL be derived from the thread's reach history together with the observations of
people and use, so a disputed reach is shown as disputed. When readable, it SHALL also show what changed since the person last
looked. A person's threads SHALL never be pushed out of view by the volume of system runs.

**Check:** with any number of newer system runs, a person's thread remains listed with its
latest outcome.

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
