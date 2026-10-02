# Human participation: behavior and evidence contract

Status: first exchange pathway implemented locally; autonomous improvement and human
usability gains remain to be demonstrated. This work is operator-authored. It is not
evidence of the substrate improving its own interface.

Humans participate as implicit vessels. Human-surface is an explicit communication
boundary, with discoverable question, feedback, and rendering capabilities. Activities
can include human contributions; neither conversations nor screens define their limits.
Impulse content remains open. A shaped exchange can carry a demonstration, an unfamiliar
record, a procedure, or a reference without the interface interpreting it successfully.

## Expected behavior inventory

| Behavior | System responsibility | Evidence / remaining work |
|---|---|---|
| Receive | Preserve content and provenance, including unfamiliar contributions | First slice preserves JSON question bodies and responses; binary transfer and general unsolicited contributions remain separate work |
| Understand | Relate content to the right activity; retain uncertainty and original content | Question id and revision are enforced; broader activity/intent interpretation is not established |
| Invite | Recognize a need for human participation and formulate a useful request | Existing `uiQuestion_write` is now visible in the browser; autonomous initiation must be demonstrated by an activity |
| Compose | Find existing pathways involving humans; identify missing capabilities | Existing discovery shapes remain the boundary; no new scheduler or browser-owned learner |
| Present | Choose understandable, useful representations with an inspectable original | Existing content-form renderer used; original JSON is available; render-policy experiments remain open |
| Communicate | State the contribution needed and the consequence of responding | Questions, response history, explicit storage receipts and decline supported; consumption is not inferred |
| Continue | Preserve identity across waiting, interruption and restart | Journals restore questions and response identities; late answers cannot silently target a revised question |
| Evaluate | Check outcomes against goals and retain disagreement | Existing grade path remains; independent assessment coverage is still limited |
| Repair | Investigate challenges and verify corrections | Ordinary answers no longer become interface complaints; complaint-to-verified-repair loop remains to be proven |
| Learn | Link a contribution to consumption, update and later behavioral benefit | Not established by this exchange implementation; next required causal link |
| Adapt | Apply supported contextual preferences without disrupting participation | Presented question versions and drafts remain stable; new versions require review |
| Grow | Author, exercise and retain new interaction capabilities | Not demonstrated; proposed variants must earn standing through held-out outcomes |

Appeal should support useful, informed, voluntary participation. Measure whether people
understand invitations, contribute useful distinctions, assess evidence accurately and
return when participation is worthwhile. Clicks, response volume and acceptance alone
are insufficient. An unanswered question does not establish agreement or inability.

## Implemented pathway

```text
activity → uiQuestion_write → journaled question revision
         → human-surface presentation → human contribution
         → uiFeedback → journaled receipt → uiQuestion read by an activity
```

The browser adapters are `GET /api/questions` and `POST /api/participation`. Both use
the existing shaped resolver in process. They do not dispatch a new goal, introduce
a private answer store, or claim that the requesting activity resumed. A contribution
is public feedback to the system; author identity beyond the existing surface context
is not established by these records.

`Panel.body` is unknown JSON content. An optional `asks` list remains a presentation
hint, not a complete vocabulary of contributions. Text and JSON are the current input
forms; arbitrary binary content can be referenced but is not uploaded or resolved by
this implementation. Original content is available alongside its interpreted rendering.

Every changed question gets a monotonically increasing revision. Repeating the same
question does not invalidate the version a person is reading. A browser response names
the question, revision, optional part, and a response id. Retries of an identical
response return the existing receipt; reusing its id for different content is rejected.
Old responses remain inspectable without answering a newer question. Partial answers
do not silently complete a multi-part question. Declining is distinct from answering.

The browser loads the first question snapshot automatically and buffers later changes.
Selection changes preserve unsent drafts while the page remains open. Explicit refresh
can discover new versions; accepting a revised question preserves the text for review.
Unsent drafts do not survive page reload. Received contributions and questions do survive
a vessel restart. The interface does not equate storage with consumption or learning.

## Persistence and operating limits

Records append to `$WORKSPACE_ROOT/interactor-log/uiPanel_write.jsonl` and
`uiFeedback_write.jsonl` (`WORKSPACE_ROOT` defaults to `/workspace`). A write is appended
and synced before it becomes visible in memory or is acknowledged. Storage failure
does not produce a successful receipt. Incomplete journal lines are skipped with a
warning; subsequent appends begin on a new line. Replay does not emit new interactions.

The recent-feedback feed remains capped at 500. Question state and response-id
deduplication use all retained journal records so that unrelated traffic cannot reopen
an answered question or turn a retry into another contribution. These indexes and
journals currently grow with retained history. Compaction, pagination, multi-writer
coordination and retention policy are follow-up work; use one vessel writer per journal
directory. No network-wide concurrency bound or complete provenance chain is claimed.

## Validation and quality bar

The isolated test suite covers shape → browser adapter → shape read, structured content
(including false, zero and null), revision conflicts, idempotent retry, partial answers,
decline, identical authoring retries, history-window rollover, restart and failed storage.
Tests use a temporary workspace and do not contact the running substrate.

The browser probe runs the built UI against a disposable local server. It exercises
buffered arrivals, draft preservation across selection and revision review, structured
answers, duplicate retries, stale-version rejection, reload, narrow layout, keyboard
focus and dark rendering. It does not establish accessibility conformance or that humans
find the interface appealing. A moderated, counterbalanced study on frozen tasks remains
necessary to compare comprehension, effort, assessment accuracy and willingness to
participate. The overall interface still contains legacy interaction-conformance findings.

The source had a duplicated, syntactically invalid feedback hydration block; that is
replaced by a single replay path. Server imports now explicitly reference TypeScript,
and Vite explicitly loads its TypeScript config and prioritizes TypeScript sources.
This prevents checked-in JavaScript siblings from silently shadowing source changes.

## Next responsibility cycle

Give the substrate a behavioral goal: make a recurring misunderstanding in a human
activity observable and repairable. Let it detect the gap, frame an investigation,
propose a variant, ask for participation where necessary, and verify the result.
Record operator interventions explicitly. Require linked evidence of contribution
consumption and later reuse before calling the result learning.

Use a frozen task family for convergence, an expanding exploration set for new
distinctions, and before/after/disable/restore plus held-out and restart trials for
structural growth. Keep presentation/procedure versions attached to the experiences
they produced. A better-looking interface and a configurable rendering policy are
candidate improvements, not proof of autonomous growth.

## How a content form is chosen, and how that choice becomes learnable

The shape vocabulary is open and ragged; content arrives in a small closed set of
forms. So the surface dispatches on form, never on shape name, and the verbatim
branch is the designed default rather than an error state. Two questions follow,
and they have different oracles. Conflating them is what makes a "form learner"
unfalsifiable.

**Fidelity is machine-decidable and is a filter, not a ranking.** A form is wrong
— no human needed — if rendering loses content. That is what the fidelity
predicates decide, with a deliberately coercing fixture to prove the red state
and a preserving one as positive control. It cuts the candidate set and cannot
rank what survives: a byte-perfect rendering of an unreadable payload passes
every predicate.

**Preference among the survivors needs human evidence**, in three grades.
Strongest is an explicit pin, which is a labelled preference on a (shape, form)
pair. Next is a complaint, which is a negative label on whatever form was in
force when someone looked. Weakest but highest-volume is revealed behaviour: a
fold that gets expanded, a horizontal scroll, a value that gets copied.

Neither oracle can be applied to a choice nobody recorded. The surface therefore
records every form decision — the shape, a signature of the content, the chosen
form, WHICH BRANCH chose it, and the policy revision in force — and publishes a
measured census of those records on its own self-report, so the substrate's
legibility detector can judge form as well as typography. A decision whose author
is unrecorded cannot be graded: grading a pin and a guess of last resort as one
row lets the heuristic take credit for instructions a person typed by hand.

### The three tiers, and how a disposition is promoted

Expected trajectory, strongest first:

1. **Declared by the producer.** The resolver that emits a shape declares its
   content form in the impulse metadata. No inference, and no shape name in the
   surface at all. This is where a strongly-learned disposition retires to, and
   the promotion criterion must be stated before it is built: a posterior above
   threshold across distinct human encounters, with automatic demotion when a
   complaint lands afterwards. Without demotion, a promoted mistake is permanent
   — the irreversibility class the weight floor and the type-scale repair both
   exist to prevent.
2. **Learned policy.** The same `formByShape` field a person's instruction
   writes, written instead by a learner. Still keyed by shape; the difference is
   that no one typed those keys, and the policy is a shaped impulse read at use
   time.
3. **Inferred for a shape never seen.** A typed decision over the closed form
   set, conditioned on observable content features rather than on the name —
   which is what lets it generalise to a shape nobody has registered, and what
   keeps its cache honest, since caching by shape name reintroduces the
   hand-keyed table.

Under all three sits the heuristic floor, and under that the verbatim default.
Any external decision arm must be minted as an activity with its decision and
confidence in the trace, so the junction is graded and the arm can LOSE to the
floor on a measured family; must be wired fail-closed; and must never render a
confidence number to a person, which is separately forbidden.

Tier 3 is a trajectory and not a current component. The reason is a measurement:
after the planner was repaired so that a bare single-line value reaches the value
renderer, the misroute class on the live pool went to zero, and no remaining
form on that pool is decided by a guess that a better guesser would improve.
An inference arm is justified when the census says otherwise — which is what the
census is for.
