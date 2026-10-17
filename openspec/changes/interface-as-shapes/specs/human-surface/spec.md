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

## Requirement: threads, not runs

The default view SHALL group a person's asks into threads by goal. Each thread SHALL show its
outcome, a learning mark derived from its reach history, and one fold holding attempts,
outputs and provenance. When readable, it SHALL also show what changed since the person last
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
