# The surface acts on shapes present: human-surface-vessel as a resolver, not a client of one host

**Vessel:** human-surface-vessel. Named dependencies, each filed as its own gap where the work is
not the surface's: discovery-vessel (a person's credential through `/resolve`; peer forwards that
keep the forwarder's credential), the walk trio (walk, records, described-shape), identity-vessel,
and the registry (producers declaring side effects).

**Supersedes** the parts of `interface-as-shapes` that depend on goal-host: dispatch, walk state,
utterance routing, and asking a person (its Phases 6, 11 and 12, and the goal-host halves of
Phases 9 and 10). Everything else in that change stands. Its view, render-policy and write-guard
work is the model this change extends to the rest of the surface.

## Purpose

A person can see what the system is doing, why, and what it decided, and can ask, answer and
judge, through a vessel that works like every other vessel:
- it is reached by shape through discovery and reaches others only through discovery;
- it acts on the shapes present in its environment, and for this vessel that environment is the
  people using it;
- it holds no producer's address and no decision the learning loop cannot see.

## The target, in one paragraph

The surface is a **resolver vessel whose resolver is a person**:
- It serves the shapes a walk can call when a step needs a human: a question, a choice, a
  verdict. It answers them with what the person did.
- It writes what a person does (asks, answers, verdicts, complaints) as rows in the records
  store, under the person's own credential.
- It draws the rows the system writes: the walk's selections, steps, failures, answers and
  outcomes; reports; and composed answers to "how is the system doing".
- Every read and write goes through discovery `/resolve {pointer}`.
- It decides nothing. Which questions come first, which form a thing is drawn in, how a typed
  sentence becomes a change to the page: each is an activity the walk selects and the loop
  grades, writing a shape the surface reads at use time.
- What remains in the surface is input/output: drawing, capturing, the guard on what a write may
  contain, and the person's session.
- **The whole interface is driven by activities.** The surface has no fixed, named sections.
  What a screen shows, in what order and grouping, is a view an activity writes
  (`uiView_write`), naming the shapes to read and the form to draw each in. The surface draws
  whatever a view names, generically. Grouping the walk's rows into "what happened to this ask"
  is an activity's output, not code in the surface. *(direct)*

## Rulings this rests on

- The surface's changes bring its interface in line with human interaction design principles
  and with the system architecture, as one body of work; seeing an answer and judging it is
  part of it, not a separate addition. *(direct, through another session)*

- The dispatch host is not returning, and depending on it was the antipattern. *(direct)*
- A vessel acts on the shapes present and is invoked as part of activity execution; for this
  vessel, its perception is people's interaction. *(direct, through another session)*
- Requests reach the walk as rows: from the cockpit, from condition-selected activities, and
  from people through the surface. *(direct, through another session)*
- Every service uses the node's key and goes through discovery; no per-vessel keys, owner ids
  or addresses. *(direct)*
- Every code change is checked against the architecture before it lands, by someone other than
  its author. *(direct)*

A ruling heard through another session is held as the person's words; anything that narrows it
is confirmed with the person before work resting on it lands.

## Problem

Each item names the rule it breaks. The inventory is of the vessel's own source.

1. **The surface is a client of one dispatch host (goal-host), which is being removed.**
   - Asking posts `goalDispatchAsync`.
   - Watching polls `goalWalkState` and `goalWalkOutput`.
   - Lists read `activeDispatches`, plus the surface's own record of what it dispatched.
   - A run's question to a person arrives as `human_input`, and the answer goes back as
     `solicitationResponse_write`.
   - In the page, the runs list, the run view, its trace, chain and attempts, the starters and
     the credit view all draw goal-host's run model.
   - With that host gone these are dead paths. While it existed they were the antipattern of
     one vessel steering another by polling, instead of acting on shapes present.
2. **Selection written as code inside the vessel (law 2).**
   - An importance learner (which questions come first) and a form learner (how a shape is
     drawn) run inline when certain writes arrive.
   - They fold the exposure record into weight and form tables.
   - Their output is a shape (`renderPolicy_write`), and that half is right. The deciding is
     code: not selectable, not graded, not replaceable by a variant.
3. **Decomposition inside the surface (law 13).** A deterministic parser turns a person's
   sentence into a render-policy patch. A person sends words; turning words into a change is the
   system's work, and a parse living in the surface is the operator-as-preprocessor pattern
   moved into code.
4. **A verdict is written to one address, with sign-in coupled to it.**
   - The label write reads a producer's `endpoint` from a registry row. This is the one call not
     placed by discovery, and it can fall back to a peer's row.
   - Sign-in is offered only when that producer is local, so a node without it can't sign
     anyone in, even when identity is reachable.
5. **Behaviour fixed in code (law 1).** Caches, page limits, recheck intervals, learner
   thresholds, read timeouts and the scopes treated as operator are constants. The surface can't
   change them, and the system can't observe them as shapes.
6. **A per-vessel key.** The surface falls back to its own key variable. Every service is meant
   to use the node's key.
7. **A browser door wider than the person.**
   - The same-origin passthrough to discovery accepts any pointer, writes included.
   - It sends them under the vessel's key, so a person's action is recorded as the vessel's.
   - Whether a named report only reads is judged by its name, not by anything its producer
     declares.
8. **State kept beside the records store.**
   - Kept in memory or in the surface's own files: panels and feedback (journaled), an exposure
     corpus, the dispatch record, the view log and a page-frame cache.
   - Some of it is the person's interaction data, which belongs where the person is (law 11).
   - Some of it is a person's action, which belongs in records as a row.
9. **What the surface can show depends on another node's goodwill, and says so badly.**
   - On a spoke, most reports live on the hub. A forwarded read can come back refused for want
     of a credential, and a block that reads it must say so rather than draw an empty page.

## What changes

1. **Asking is writing a row.**
   - The box writes one exogenous row to records through discovery, under the person's
     credential. The walk picks it up from its pool.
   - Nothing is dispatched and nothing is polled.
   - The row is `world_changed {what, input_refs}` (see Decisions).
2. **Watching is reading rows, chosen by activities.** What the person sees of the walk (an
   episode: the row that opened it, the selections whose pool named it, their hops, failures,
   requests and answers, the outcomes on those answers) is composed by an activity and named in
   a view. The surface reads what the view names by shape through discovery and draws it; it
   does not group, rank or choose.
   - Today's fixed landing blocks ("needs you", "the system") are named sections too. They
     become entries an activity's view names, and the surface's block vocabulary shrinks to
     generic forms (a list of rows, a row's fields, a question to answer).
3. **A person is a resolver.**
   - When the walk needs a human, it calls a shape the surface already serves (`human_input`,
     drawn as a `uiQuestion`), the same way it calls any producer. No new shape is minted; only
     its tie to one host's run model goes.
   - The surface shows the question and answers the call with what the person did.
   - An answer the call could not wait for is written as a row instead.
4. **A verdict is a row.**
   - Judging an answer writes `outcome {r, input_refs: [<answer id>]}` under the person's
     credential, citing the answer alone.
   - A person's verdict grades: the walk's fold reads the producing activity from the answer's
     selection, folds the verdict into that activity's posterior, and credits along the
     composition it ran in.
   - The label write, its address lookup and its exception go.
   - Sign-in depends on identity alone.
5. **Deciding moves out of the surface.**
   - The importance learner, the form learner and the sentence parser stop running in the
     surface.
   - Each becomes an activity the walk can select, writing the shape the surface already reads
     (`renderPolicy_write`, `uiView_write`).
   - No new shape is minted (law 3).
   - The surface keeps the guard on what those writes may contain.
   - What was shown and what became of it are records rows, not a log the surface keeps. The
     evidence those activities are graded on (did the person act on what was shown) is then
     readable by anyone, and is not held by the vessel being graded.
6. **Perception is written, not acted on.** A person's interaction is this vessel's
   environment, so it is written as rows and becomes part of the state the walk selects from.
   The surface makes the perception present; what to do about it is the walk's choice.
7. **Behaviour constants become shaped reads.**
   - Every behavioural constant is read from the render policy or the view at use time, with
     its current value as the bootstrap default.
   - What stays fixed is the bootstrap tier: port, host, the discovery and identity addresses,
     the content-security policy, the server's idle timeout, and the registration heartbeat.
8. **Two keys, each for its own writer.**
   - The surface's own reads and writes use the node's key; the per-vessel fallback goes.
   - A person's rows (asks, answers, verdicts) are written under that person's key or
     on-behalf-of token, never the node's. Records stamps a node-key write as the node's own,
     so an ask written with the node key is not exogenous: it opens no episode and wakes no
     wait.
9. **The browser door narrows.**
   - The page's passthrough carries reads only, under the node's key.
   - A person's write carries the person's credential, so records stamps the person as the
     writer.
   - When producers declare their side effects in the registry, the reports block refuses
     anything not declared pure. Until then, the read-only judgement by name stays and is
     named as debt.
10. **Health is asked, then answered.**
   - The reports block is the interim.
   - The target is an ask whose answer is a composed row: what happened, why, and what the
     system decided. The composer is built as activities, outside the surface.
   - The surface's part is drawing that row.
11. **Observation never depends on a page being empty to say something is wrong.** Every read
    that gets no answer shows its reason. What is local (records, on a spoke) is shown even when
    the hub refuses everything else.

## Decisions

- **The ask row (decided by the walk's owner): `world_changed {what, input_refs: []}`.**
  - `input_refs` is the field the walk reads.
  - No distinct ask shape. Records tells a person's ask from the system's rows by the writer's
    role (a person's key is stamped as a person), not by shape, so any count that must leave
    asks out filters by role. A distinct shape would be a mint with no producer gap (law 3).
  - If a case turns up that role cannot separate, it goes to the walk's owner.
- **A person's verdict grades (the person's ruling).**
  - The verdict row cites the judged answer only; the fold reaches the activity through the
    answer's selection, so the verdict folds into that activity and its composition.
  - The walk's grading by provenance must count it: a verdict written under a person's key,
    citing the answer, is a person-described outcome. If the fold rule as
    built leaves it out, that is a gap for the walk's owner.
- **What the surface keeps (decided by data locality).**
  - Kept at the surface: the person's local input and output only (the session, an unsent
    draft) and caches it can rebuild from rows.
  - Moved to records as rows, under the person's key: asks, answers to the walk, verdicts,
    complaints, and the interaction itself (a person arriving, opening an episode, dismissing
    or ignoring a question, what was shown to them). The surface's existing interaction shapes
    (`interactorEvent`, `interactorObservation`) are the row shapes; no new shape.
  - A complaint is `world_changed` whose `input_refs` cite what it is about.
  - Goes with goal-host: the dispatch record.
- **Removals do not land as activities; behaviour does.**
  - Deleting a dead path or routing a call through discovery is not a new behaviour, so it lands
    as a plain commit.
  - Moving a learner out of the surface lands as an activity, the first variant of its family,
    selectable and graded.

## Not the surface's to fix (each is a gap for its owner)

- Discovery `/resolve` admits only service keys. A person's on-behalf-of token must be admitted,
  validated and carried to the producer, or no person can write anything.
- A spoke's forwarded reads are refused at the hub for want of a credential. Either the
  forwarder's key does not survive the federation entry point or the hub does not accept it.
  Until this is fixed, a spoke surface sees only local rows.
- Producers do not declare side effects in the registry, so no consumer can tell a read from a
  read that writes.
- Each person needs a key of their own (or an on-behalf-of token, above). A person key issued at
  the hub already passes identity there; issuing one per person is identity's and the person's
  act, not the surface's.

## Out of scope

- The composer that answers "how is the system doing". It is built by whoever builds activities.
- The walk's own design, beyond the fold counting a person's verdict.
- Account creation, which belongs to identity and to the person.
