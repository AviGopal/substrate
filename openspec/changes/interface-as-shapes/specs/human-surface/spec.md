# human-surface — interface as shapes

Each requirement names the check that falsifies it.

## Requirement: presentation is read from shapes at render time

Every behaviour a person can perceive and might want changed (layout, design tokens, the form
chosen per shape, and the composition of regions) SHALL be read from shaped impulses at render
time. Only the frame (the fixed regions and the input), the interpreter and the primitives are
code. Once views are shapes, the frame SHALL itself be described by a default `uiView`, so its
arrangement is changeable even though its machinery is not.

A field a presentation shape declares SHALL be read by the surface. A field nothing reads (a
layout variant the bundle ignores while it draws a fixed one) misstates what the system
controls, and SHALL be either read or removed.

**Check:** a change to any of these shapes, written while the surface is running, is visible
on the next read without a rebuild or restart. An audit lists every presentation constant
still compiled into the bundle and finds each is part of the frame, the interpreter or a
primitive. An audit of the policy's fields finds none that the surface does not read.

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

A message that carries only the start of a reading (a complaint's prefix with nothing after
it, a chip's words left unfinished) SHALL NOT be sent. It stays in the box until it says
something.

The one exception to one input is credentials. A person signs in through two fields of their
own (an identifier and a password), because a password typed into the box would be echoed
and read as a message. Signing in sends nothing to the system but the credential's check.

**Check:** the same words typed in two contexts are read differently, and each reading is
shown before or as it takes effect. No control other than the box and the sign-in fields sends
anything. A complaint prefix sent alone reaches no reader and starts no run.

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

A shape declared as needing a person SHALL be served only by human resolvers: the surface, and
any other surface or vault that delivers a question to a person and returns the answer. Each
SHALL advertise itself as a producer of that shape, so a walk that needs it finds the person
among its producers and chooses to ask. A producer that is not a human resolver SHALL NOT
satisfy a shape declared as needing a person, at bind or at the judge. Step selection SHALL
find the human resolvers for such a shape as it finds any producer, so asking is chosen where a
step needs a person, not only when recovery runs out. A walk that has no human resolver for it
asks through the asking activity, or records that no person could be asked; it does not bind a
stand-in under that shape.

**Check:** a grade the learning corpus refuses is still kept on the run and drawn beside the
judge's verdict. No label is written with a fixed confidence. A person-shaped output a satisfier produced draws with its producer and no
person mark. An output from the step a person's answer drove is marked as theirs. Discovery
for a shape declared as needing a person returns only human resolvers, and a composed activity
whose step produces that shape without calling one is refused at bind.

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

When an attempt does not carry the run it started, the surface SHALL group the system's own
runs by what they report, never by their wording: by the template the system routed each to. Each group
shows that template's rate ("2 of 44 reached"), so the reach of one kind of work is visible at
a glance, and a change of outcome across different asks is never drawn as one ask learning.

**Check:** a commit the system lands appears as a thread step naming the gap it addressed and
the gate's verdict. System runs routed to one template draw as one line with that template's
rate. A policy change appears with its author. A deploy appears with the units
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
validators can check it. What it drew SHALL be kept durably, the way people's form choices
and exposures are kept, so that a restart does not turn the record into "not observed". A
count read from a declared constant is not a record of what was drawn.

**Check:** after a variant takes effect, `human_surface:ui_view` names that variant for the
region it drew. After a restart, the forms drawn before it are still counted.

## Requirement: a person's asks and their outcomes are the surface's own record

Every ask sent from the surface SHALL be kept by the surface, durably, with the outcome of its
run (finished or not, reached or not, its execution) once it is read. A person's list and
threads SHALL be drawn from that record, not from what goal-host still holds: goal-host keeps a
bounded window of runs, and a person's history must outlive it.

A run whose state can no longer be read SHALL be drawn with its kept outcome, or as "record
gone" when none was kept. It SHALL never be drawn as running, or stalled, because a read
failed or the run aged out. A thread's mark SHALL count every run of the thread in the record,
with an outcome never captured shown as such, never as unjudged.

**Check:** after a restart, and after goal-host no longer holds them, a person's earlier asks
are still listed, each with the outcome kept for it. A run goal-host answers "not found" for
is drawn as kept or as "record gone", never as running. A thread asked four times shows four
runs.

## Requirement: a message is read by readers, and the stakes decide the echo

A message SHALL travel to the system as one impulse carrying its text, what was on screen when
it was sent, the person's recent moves, and its provenance (signed in, or unverified). Readers
SHALL be activities that each propose a reading with a confidence. The exact-phrase reader is
one of them, the fastest and always right when it matches. The reading chosen SHALL be chosen
by each reader's record in that context.

The echo follows the stakes of the reading:
- low (a view, an interface complaint, an item supplied to a run): applied at once, with undo;
- medium (an answer, a decline, a follow-up, a new ask, a steer): applied, with undo for a while;
- high (a verdict, a lesson, a commitment, a stop, a pin for every output of a shape):
  confirmed first, in a few words;
- unsure (readers disagree, or none is confident): a choice of the top two or three readings,
  never "what did you mean?".

An exact phrase or a chip is an explicit choice and is not confirmed again. A message is read
against what was on screen when it was sent. A message may have parts, each read and echoed.
"No, I meant …" right after a reading corrects it, and the correction is kept as a labelled
example. The same words sent again at once count as a likely misreading. Ignoring a
confirmation counts nothing. The person's next move grades the reading: carrying on credits
it, undo or a correction debits it.

When no reader activity serves a message, the surface reads only the exact phrases and
prefixes, and sends everything else to the system as text with its context.

**Check:** the same words on two screens are read differently, each reading echoed by its
stakes. A high-stakes reading takes effect only on yes. An undo after a reading is recorded
against the reader that proposed it.

## Requirement: an ask the surface shows has a subject, evidence and a reader

Asking a person SHALL be an activity the system selects, like any other producer, and the
surface SHALL be one of its resolvers: an ask is not a code path inside another step. Every
ask the surface shows SHALL:
- name its subject (the run or gap it is about) and carry the evidence needed to answer it,
  composed from the subject's own records, never a fixed template;
- name the reader that will act on the answer, and be offered only when that reader runs;
- carry a time by which it is answered or withdrawn;
- leave the person's waiting list when its subject closes, and be withdrawn by its asker then.

An answer SHALL be kept with the revision it answered and SHALL stay visible and counted when
the asker rewrites the ask. The surface SHALL show what an answer did once its reader reports,
and SHALL NOT claim a reader runs when it cannot confirm one.

The waiting list SHALL lead with asks a person can act on. Asks that no reader takes, notices
and malformed asks follow them, folded, and do not count as waiting. A person's attention is
the scarce input: the system SHOULD ask only when a person is the most reliable validator it
has for the subject.

**Check:** no ask with no confirmed reader is offered as waiting. An ask whose gap has closed
is not counted as waiting. An answer to an earlier revision is still shown as answered. The
first rows of the waiting list are asks a person can act on.

## Requirement: verification asks are validator choices, and an unverified answer only steers

When a landed change cannot be measured, the system SHALL choose how to verify it from the
validators it has, ordered by their earned reliability: the detector's own re-measurement, a
check that runs, a person, a model's judgement. A person is one validator among these. Every
validator, a person included, SHALL be graded later by whether the change held.

A verification ask SHALL carry what a person needs to verify: the landed change, the condition
it was meant to fix, and what was measured before and after. Its answer SHALL have a reader that
closes, reopens or requests a check. A hold waiting on verification SHALL carry a review date,
and SHALL NOT expire unnoticed: at its date it becomes a goal to write the missing check.

An answer given without a person's credential is an observation. It MAY steer reversible
actions (reopen, retry, raise priority, request a check). It SHALL NOT close a gap, credit a
posterior or enter the verdict corpus as a person's verdict. The echo SHALL show only what
the answer can do ("Not fixed: reopened"), never more.

**Check:** a verification ask shows the change and the condition. An answer to it reaches a
reader. An unsigned "fixed" requests a check and does not close the gap. A hold past its date
appears as a goal, not as an expired gap.

## Requirement: a person signs in, so a verdict they give is theirs

A person SHALL be able to sign in on the surface. The credential SHALL go to the identity
service once and SHALL NOT be kept. The session it returns SHALL stay on the surface server.
The browser holds only an opaque id, in a cookie that scripts cannot read and that other sites
cannot send; the cookie is marked secure when the surface is reached over TLS. A forwarded
protocol header is believed only from the local proxy. Signing in and out SHALL be accepted
only from the surface's own page.

A verdict given while signed in SHALL be written as that person's, under a delegated token
minted for the one node whose writer checks it and for the one shape it writes, right before
the write. The node SHALL be read from the registry row of the producer the write goes to, so
the token's audience and the write's target cannot differ. A verdict given while signed out
SHALL be kept on the run as before, and SHALL be recorded as the person's when they sign in.

Sign-in SHALL be offered where this node serves the verdict writer itself. Where the writer is
reached over the relay, the same path SHALL be offered only once an end-to-end run through the
relay has passed. A person SHALL be able to obtain an account in the substrate's organisation:
signing in to a separate organisation would record verdicts where nothing learns from them.

**Check:** a signed-in verdict is stored as a human verdict naming the person, with the
token's audience naming the writer's node. No credential appears in any response or record of
the surface. A sign-in posted from another origin, or with none, is refused before the
identity service is called.

## Requirement: a signed-in person can read an output whole

The surface SHALL let a signed-in person read any output of a run whole, up to the cap its
producer sets, by the run and the output's own id. Because the surface reads under its own
key, this read SHALL be served only to a request carrying a valid person session, and SHALL
NOT be open to every visitor. The preview stays readable to everyone.

For a signed-in person, a page they asked to see SHALL be drawn whole, and any other cut output
SHALL offer to show all of it. What arrives replaces the preview; the cut mark remains only
if the whole is itself capped. Where the whole cannot be read, the preview stays, marked as
cut.

**Check:** without a session, the whole read is refused and the preview draws with its cut
mark. With a session, a cut page draws whole and its cut mark is gone. An expired session is
refused.

## Requirement: an activity draws into its own run's region, and only there

During a run, an activity MAY show something to a person, or ask them something, through the
surface's question and panel shapes, carrying the run it belongs to and a view composed from
the closed primitives. No separate run-scoped view shape is added. The surface SHALL accept it
only after reading that the run exists and is running, and SHALL drop it when the run ends. It
SHALL draw it labelled with the activity that produced it.

It SHALL NOT hide or restyle the run's outcome, verdict, cut marks or provenance. It SHALL
NOT write the global presentation policy, and SHALL NOT pass markup through the page frame.
The run's progress is not such a view: it is the surface's own drawing of the walk's state,
under the presentation policy, with no activity producing it.

**Check:** a view for a finished or unknown run is refused. A view that would replace the
outcome region is refused. A run's view disappears when the run ends.

## Requirement: the landing serves the person's jobs

The surface SHALL serve four jobs, each with its own view:
- getting something done, which is the person's threads;
- being needed, which is the few asks waiting on this person;
- watching the system, which is its health by kind of work (reach, trend, cost, what it is
  stuck on) and its gaps as threads;
- teaching it, which is lessons and their effect.

Landing SHALL show first what needs the person (usually none to three), then what changed in
their threads, then one line of the system's health. A result SHALL be presented as an answer
to the person's words, with one line on why to trust it; a raw artifact is evidence, never the
answer.

**Check:** with no asks waiting, landing shows the person's threads first. A thread whose
answer is a raw artifact is drawn with the artifact as evidence under an answer, or marked as
having none.
