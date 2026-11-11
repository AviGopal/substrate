# Tasks — the surface acts on shapes present

Each task is one concern and one commit, with a static must-fail test that goes red without it,
and the full suite green in the gate's environment. Every commit is checked against the
architecture by someone other than its author before it lands (same key, same routing and
hosting as every service, no addresses or behaviour constants, behaviour as activities). A
person-facing change is judged by the person's verdict on the live page, not by a test passing.
Removals and re-routings land as plain commits; a moved behaviour lands as an activity, the
first variant of its family.

Phases are ordered by what blocks them. Phase 0 is not the surface's work; the surface only
makes it visible and files it.

## Phase 0 — blockers owned elsewhere (file, don't build)
0.1 File the gap: a spoke's forwarded reads are refused at the hub for want of a credential.
    Evidence is one read the reports block draws as "no answer: unauthorized". The predicate
    that closes it: the same read, from the same spoke, answers.
0.2 File the gap: discovery `/resolve` admits only service keys. A person's on-behalf-of token
    must be validated and carried to the producer. Closing predicate: a row written through
    `/resolve` with a person's token carries that person as its writer.
0.3 File the gap: producers do not declare side effects in the registry. Closing predicate: the
    registry answers, for a named shape, whether resolving it writes.
0.4 If the walk's fold rule does not count a person's verdict on an answer (an outcome citing
    the answer, under a person's key), file it for the walk's owner.
0.5 Every gap row carries the operator marker of the session that wrote it.

## Phase 1 — observe what is there (unblocked)
1.1 A generic view. The view a region draws becomes a list of entries, each a pointer to read
    through discovery and a form to draw its answer in (rows, fields, a question). The fixed
    blocks go; their content becomes entries in the default view. No section is named in the
    surface's code. Must-fail: no landing block name or grouping rule appears in the page's
    source; a view written with a new pointer draws with no rebuild.
    Done: a view is {region, entries}, each {pointer, form: fields | rows | questions, title?,
    field?, show?, judge?}. "What waits on a person" is the producer's filter
    (`uiQuestion {open: true}`), not the page's. A stored view in the earlier form is refused
    by name and shown as passed over, beside the view in force.
    Debts named at the check: (a) `open: true` applies the ask classification
    (`classifyQuestion`) at the producer; classifying is a decision, so it moves to an
    activity with 3.1/3.2. (b) A new-form landing view is written by an activity through
    `uiView_write`, not by hand; until one is, the default draws and the old view is shown as
    passed over. (c) How the system is doing has no entry: the walk's posterior needs a list
    of cells, which a view argument cannot carry (5.1).
1.1a What the walk did with an ask is composed by an activity from records rows (episode
    grouping) and named in a view the activity writes. No producer of such a summary exists
    (the walk's own vessels serve only raw rows and the shapes built from owner schemas), so
    the way in is an owner shape schema whose target is the summary shape: the walk selects
    it from the state space and the system builds it. That is filed as a gap, not built in
    the surface. Until it exists, the default view names raw `record_read` pointers, drawn as
    rows in the order records returns them; the surface adds no ordering or grouping of its
    own.
1.1b Seeing and judging a row, as part of the generic view (not a separate piece). The row form
    shows a row's content in full, readable to a person (what was asked, what came back), not
    its ids. A row the view marks as judgeable offers the verdict; the verdict is written as
    `outcome {r, input_refs: [<answer id>]}` under the signed-in person's own key, never the
    node's (2.1, 2.4, 4.3). Designed against the first real answer row the walk writes.
    Must-fail: the verdict action cannot send without a person credential.
1.2 Every read with no answer shows its reason on the page (refused, absent, timed out, no
    producer). Must-fail: a stubbed refusal never renders as an empty block.
    Done with 1.1: every entry is drawn, and one with no answer says why.
1.3 Delete what only goal-host could fill: the runs list, run view, trace, chain and attempts
    views, starters, credit, and their server routes (`/api/run-goal`, `/api/mine`,
    `/api/walk-output`, `/api/resolve`, `/api/executions/:id`), the dispatch record, the
    goal-host clauses in inbound auth, and the run read that links a `human_input` question to
    a goal-host run. The served question shapes (`human_input`, `uiQuestion`) stay: 4.2 reuses
    them. Must-fail: no source names a goal-host shape (`goalDispatchAsync`, `goalWalkState`,
    `goalWalkOutput`, `activeDispatches`, `solicitationResponse_write`).
    Done. Email sign-in went with it: a session token cannot write a row through discovery
    (0.2), so key sign-in is the only sign-in until 0.2 lands. A walk step's question is
    answered in the one box, with no second input on its page.
1.4 Until a person's credential can reach records (0.2, or the person's own key), the ask box
    says plainly why it cannot send, instead of sending somewhere that no longer answers.

## Phase 2 — work like every vessel (unblocked)
2.1 Keys by writer: remove the per-vessel key fallback; the surface's own calls use the node's
    key. Must-fail: no source reads a vessel-specific key variable, and no person-row write
    (ask, answer, verdict) is sent under the node's key.
2.2 The browser passthrough sends reads under the node's key and a write (`_write` or a
    mutating primitive) only under the signed-in person's own key; signed out, a write is
    refused by name and nothing is sent. Must-fail: a write with no person key sends nothing,
    and no write leaves under the node's key.
    Scope changed from "reads only": person rows (ask, complaint, verdict) are the surface's
    only write path, and they go through this passthrough under the person's key.
    Done: met by `test/person-key-sign-in.test.ts`. Refusing a write the registry declares
    (rather than one named `_write`) waits on 0.3.
2.3 Behaviour constants become shaped reads. Each constant in the proposal's list is read from
    the render policy or the view at use time, with its current value as the bootstrap
    default, and the guard on `renderPolicy_write` gains a range for it. One commit per group
    (caches and recheck intervals; page and list limits; read timeouts; operator scopes).
    Must-fail: a static scan of the source finds no behaviour constant outside the bootstrap
    list, which the test names.
    Done for caches and recheck intervals: one policy field, `recheck`, merged key by key.
    The scan names every numeric constant left as bootstrap, a named debt, or pending.
    Law-1 debt: auth limits are constants; their proper home is an owner-role row read at use
    time, writable only by the owner credential, never by surfaceIntent. Learner and parser
    thresholds become activity input with 3.2 and 3.3. The guard's ranges are its own
    numbers: a reader's floor belongs to the producer's advertised cost or rate, read through
    discovery. No learning activity writes `recheck` yet: shaped, but unlearned. The event
    stream's keepalive is derived from the server's idle timeout.
    Done for page and list limits: a second policy field, `limits`, read the same way. The
    guard's bounds (what a write may contain or the surface may hold) stay the guard's, named;
    the history ring goes with 3.4; the form planner's scalar threshold with 3.2. The
    goal-host run-record parser was deleted rather than shaped. `maxPreviewChars` is written by
    the sentence parser and read by nothing: a hollow field, for 3.3.
    Done for read timeouts: a third field, `timeouts`, never unbounded, its ceiling derived
    from the server's idle timeout. Nothing is pending in the scan; a second scan refuses a
    read that waits on a literal number (the identity check's wait stays with the auth debt).
    The served `uiFeedback` shape no longer files a complaint as a gap under the surface's key.
2.4 Sign-in depends on identity alone. Whether sign-in is offered no longer depends on a local
    label producer. Must-fail: sign-in is offered when identity answers and no label producer
    is registered. Done with 1.3 (key sign-in).

## Phase 3 — deciding moves out (after Phase 2)
3.1 Importance: the inline importance pass stops running in the surface. Its logic is wrapped as
    the first variant of an activity that reads the exposure record and writes
    `renderPolicy_write`; the walk selects it and the loop grades it by whether what it
    promoted was then acted on. Reuse first: search the registry for an existing producer of
    render-policy writes before wrapping.
3.2 Form: the same for the form pass and its promote and demote thresholds, which become fields
    of the activity's input, not constants.
3.3 Typed changes to the page: the sentence parser stops running in the surface. The person's
    sentence is written as a row; an activity reads it and writes `renderPolicy_write` or
    `uiView_write`. The surface draws the result and offers undo.
3.4 What was shown and what the person did with it are written as records rows
    (`interactorEvent`, `interactorObservation`) under the person's key, replacing the
    surface's own exposure log, so those activities are graded by consumption from rows anyone
    can read.
    A person's write the surface refused (no sign-in it holds, e.g. after a restart) is today kept
    only in the surface's own store, unseen by the walk. It joins these rows once a person
    credential can reach records (0.2), never as a row forged under the node's key.
    Must-fail for the phase: no learner or parser runs in a request handler.

## Phase 4 — a person's actions are rows (after 0.2, or each person holding a key)
4.1 Ask: the box writes `world_changed {what, input_refs: []}` through discovery under the
    person's credential, so records stamps it as the person's and it is exogenous.
4.2 Answer: the walk calls `human_input`, which the surface already serves, when a step needs
    a person; the question cites the walk's request row instead of a dispatch. The call is
    answered with what the person did, or, if it could not wait, the answer is written as a
    row citing the request.
4.3 Verdict: judging an answer writes `outcome {r, input_refs: [<answer id>]}` under the
    person's credential, citing the answer alone. The walk's fold finds the activity itself (the
    answer's selection_ref, that selection's cell, its activity) and credits along the
    composition; citing a second row would make two judged rows. Only a writer's latest verdict
    on an answer counts. Must-fail: the verdict row cites exactly the judged row, and cannot be
    sent without a person credential. (The write itself landed with 1.1b.)
4.4 A complaint is `world_changed` whose `input_refs` cite what it is about; feedback the same.
    The surface keeps only the session, drafts and rebuildable caches.
    Done for complaints: a complaint typed in the box is `world_changed` under the person's
    key, and the surface's own feedback route is gone. Debt: the question it is about is
    named in its words, not cited, because a surface question id is not a records row id.
    A panel answer (`uiFeedback` through participation) is unchanged and moves with 4.2.
    Debt: a typed complaint no longer shares the legibility detector's gap key, so
    "detected and nobody complained" is no longer computable from keys. Named debt: a
    detector-vs-person agreement reader over `world_changed` complaints and `ui_legibility`
    gaps, built in records and activities, not in the surface.

## Phase 5 — health is answered, not assembled
5.1 When a composed answer to "how is the system doing" exists as a row, the landing draws it in
    place of the raw reports block. The composer is built as activities, outside the surface.
    Until then the reports block stays and names its read-only debt.

## Validation
- Each phase ends with the person using the live page and saying whether it shows what is
  happening. That verdict, not the suite, closes the phase.
- After Phase 4, one ask written from the page opens an episode, the walk takes it up, and the
  person's verdict lands as a row citing the answer and moves the producing activity's
  posterior, all with no call that does not go through discovery.
