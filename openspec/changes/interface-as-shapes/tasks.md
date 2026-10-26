# Tasks — the interface as shapes

Each task is one concern and one commit, with a test that fails without it. Each runs the full
suite in the gate's environment and is checked on the live surface after deploy. Every new
behaviour lands beside the old one, with the old one as fallback, so no step removes working
function. Display-only steps are batched; server steps deploy alone.

## Phase 0 — verify what the spec depends on
0. Check whether a validator activity for views exists and reaches (candidates in the
   registry: `ui_legibility_scan`, `comprehensibility_check`). Record what each checks, whether
   it has run, and its reach. Requirement 4 says "validated" only for what this confirms.
   Finding when this change was written: neither validates the surface's views.
   `ui_legibility_scan` applies deterministic legibility rules to the Obsidian panel's
   `obsidian:ui_view`, and has an open reachability gap. `comprehensibility_check` checks
   system-authored templates, not views. The reuse path (law 3) is to point
   `ui_legibility_scan`'s rules at `human_surface:ui_view` rather than mint a new validator;
   that is a development-vessel change, scheduled with the coordinator.

## Phase 1 — guard what already writes the interface
1. Write checks on `renderPolicy_write`: refuse template tokens, out-of-range values,
   test-origin kinds and unread fields, naming them; record the author; keep the previous
   value. Built by the system's compose lane from the filed gap
   (`render-policy-writes-accept-out-of-range-test-origin-and-unrendered-template-values`),
   armed with a red check file in the vessel (`test/checks/…`). If the lane has not landed it
   by its review date, it is built by an operator in a server window, cleared with qa. Law 6:
   the system keeps the lesson; the operator keeps the check.
2. "Undo" restores the previous presentation write. Depends on task 1, which keeps the
   previous value.

## Phase 2 — simplify within today's renderer (display only)
3. Answer and one fold: the outcome leads, and attempts, outputs, provenance and ids sit in
   one fold.
4. Model replies are drawn as prose, wrapped, never in the cut-off field view.
5. When a reached run's outputs have expired, the answer kept in its basis leads.
6. Verified or learned content is drawn apart from guessed or not-understood content, using
   only the fields the spec names; everything else is drawn as unknown.
7. Grade options follow the run's kind.

## Phase 3 — threads (display only)
8. Threads: a person's asks grouped by goal, from the surface's own record.
9. The learning mark from each thread's reach history.
10. System threads grouped by goal, with their repeat sequence.

## Phase 4 — views as shapes
11. Prototype one region (the run outcome) as a `uiView` in two candidate formats (A2UI, and
    a minimal in-house format). Choose one; record why.
12. The `uiView` interpreter, with today's run page encoded as the default view. It draws
    exactly what the surface draws now, on the existing render tests.
13. `uiView` writes behind the phase-1 checks; invalid views fall back visibly.
14. `human_surface:ui_view` names the view, variant and policy revision drawn per region.
15. The first variant authored by an activity, with a validator activity checking it. The
    default stays as fallback.

## Phase 5 — one input (surface side)
16. The context chip and the "Read as" echo.
17. Unambiguous readings on the surface: a new ask, adding context to a running run, an open
    question's answer, exact presentation phrases, and "undo".
17a. A run waiting on the person (its question delivered here) is drawn as waiting, never as
    running. An output is marked as a person's only by provenance: the question was answered
    here and the run used the answer. A stand-in is shown with its producer, and is labelled
    "without a person" only from a registry declaration.

## Phase 5a — one path per kind of interaction
16a. A run's question answered from the questions list goes through the same delivery as the run
     page (to the waiting run, with its heartbeat), not only into the question's record.
16b. "Add other context" is removed: its default shape has no reader. Missing inputs are
     supplied through "Provide", which selects the target, and the text goes in the box.
16c. Calibration grades are written as the same verdict observation as a run's grade, with the
     purpose "calibration" and blind kept.
16d. Presentation phrases are read in any context, and the echo names their scope. "Show as" on
     one output and the typed phrase write the same kind of record.
16e. Declining is one outcome on one path, from the run page and from the questions list.
16f. One input: each control that sends (option buttons, the question card's buttons, the
     question page's forms, "Show as", complain, calibration grades) is replaced by its reading
     of the box in context, one at a time, and retired once the reading is proven.
16g. Wording: labels of a few words, marks for state, no system vocabulary on screen; the
     echo names the reading.

## Phase 5b — observations and teaching (surface side)
17b. A person's verdict is kept on the run as an observation with its source, the judged result
     and the judge's verdict, whatever the corpus does; it is drawn beside the judge's.
17c. A grade carries the result it judged and that result's producer and provenance.
17d. The thread mark counts people's observations: a run a person disputed is shown as disputed.

## Phase 6 — as the coordinator schedules the goal-host side
18. The utterance shape: every other message goes to the system as text plus context.
19. Follow-ups, corrections and verdicts, each offered only once something reads it.
20. "Changed since you last looked", once the slow-arm effects are readable.
21. Teaching readings in the box, each once its reader exists: steer (retry step), correction
    (inference), lesson (concept lesson with its source). The echo names the reader.

## Phase 7 — the system's self-management as threads
22. Gap threads: detection, attempts, landed commit, verified, still closed; graded like runs.
    Joined by the attempt records' own fields, a node's own work, attempts and landings counted
    apart, attempts with no run shown as such.
23. Deployment and configuration steps in those threads: the gate's verdict, the restart, the
    author of a policy change and its undo.

## Phase 8 — time-displaced threads (as the system's commitments become readable)
24. "Next due" on a thread from its commitment (rhythm or dated item), and the runs it fires
    landing in that thread by link.
25. Box readings in a commitment's context: stop, a new rhythm, a new due time.
26. "Judged against another ask" on a run, from the recall it records.

## Phase 9 — the person's record
Paths are in `repos/human-surface-vessel/`.

27. Each run's outcome (status, reach, execution) is kept beside its ask in the durable record
    when first read finished (`src/own-dispatches.ts`). Verified by a restart: the outcome reads
    back with goal-host unreachable.
28. The person's list holds every ask in the record. A run goal-host answers "not found" for is
    drawn with its kept outcome, or as "record gone", never as running
    (`src/routes/proxy.ts`). Verified with goal-host answering "not found" for every run.
29. A thread's mark counts every run of the thread in the record, an uncaptured outcome
    included as such (`ui/src/lib/threads.ts`). Verified by a thread of four asks, two with
    outcomes, drawing four marks.
30. A message that is only a reading's prefix is not sent (`ui/src/lib/box.ts`). Verified by
    "hard to understand:" alone starting no run and reaching no reader.

## Phase 10 — sign-in, and outputs whole
31. A person signs in. The session stays on the server, and a delegated token for the
    writer's node and the label shape is minted per verdict (`src/person-session.ts`).
    Verified by a stored human label naming the person, with the token's audience naming the
    writer's node.
32. The session cookie is secure over TLS; a forwarded protocol is believed only from the
    local proxy; sign-in and sign-out are accepted only from the surface's own page
    (`src/person-session.ts`). Verified by a cross-origin sign-in being refused before the
    identity service is called.
33. A signed-in person reads an output whole by run and output id; everyone else gets the
    preview (`src/routes/proxy.ts`). Verified by the read being refused without a session, and
    served with one.
34. A cut page is drawn whole for a signed-in person, and any other cut output offers to show
    all (`ui/src/components/Rendered.tsx`). Verified by the cut mark leaving when the whole
    arrives.
35. The grade form retires once a person can obtain an account and sign in
    (`ui/src/components/GradeGesture.tsx`). Verified by a verdict typed in the box while
    signed in being stored as the person's.
36. Page-frame ids are bound to the signed-in session (`src/page-frame.ts`). Verified by one
    person's frame not loading under another session.
37. Sign-in is offered where the writer is reached over the relay, once an end-to-end run
    through the relay has passed (`src/person-session.ts`).

## Phase 11 — asks and answers (surface side)
38. The waiting list leads with asks a person can act on; folded kinds follow
    (`src/routes/impulses.ts`). Verified by the first rows all being asks.
39. A gap ask carries its gap's status, read off the request path, and an ask about a closed
    gap is folded and not counted as waiting (`src/routes/proxy.ts`). Verified with a stub gap
    store marking one gap closed.
40. No answer form claims a reader the surface cannot confirm
    (`ui/src/components/ResponseForms.tsx`).
41. An answer to an earlier revision of an ask is still shown and counted as answered
    (`src/store.ts`). Verified by rewriting an answered ask.
42. A verification ask draws the change, the condition, and before-and-after when its asker
    sends them (`ui/src/components/QuestionView.tsx`).
43. The echo of an answer given without a person's credential names only what it can do
    (`ui/src/components/TopBar.tsx`).

## Phase 12 — reading a message (as the message impulse and readers become available)
44. A message other than an exact phrase goes to the system as one impulse with its text,
    context, recent moves and provenance (`ui/src/components/TopBar.tsx`).
45. The echo follows the reading's stakes: undo for low and medium, confirmation for high, a
    choice when unsure (`ui/src/components/TopBar.tsx`). Verified by a high-stakes reading
    taking effect only on yes.
46. Undo and corrections are recorded against the reader that proposed the reading
    (`src/routes/proxy.ts`).

## Phase 13 — what the surface draws, kept and honest
47. Each form decision is kept durably, and the counts of form decisions survive restarts
    (`src/store.ts`). Verified by `human_surface:ui_view` counting forms drawn before a restart.
48. The policy's layout variant is read by the page, or removed from the policy
    (`ui/src/Surface.tsx`). Verified by an audit finding no policy field the surface ignores.
49. System runs are grouped by the template they report, with that template's rate
    (`ui/src/components/RunsList.tsx`).

## Phase 14 — the person's jobs
50. Landing leads with what needs the person, then what changed in their threads, then one
    line of the system's health (`ui/src/Surface.tsx`).
51. A thread presents an answer to the person's words with one line on why to trust it; a raw
    artifact is evidence under it (`ui/src/components/RunView.tsx`).
52. The system's health by kind of work: reach, trend, cost, what it is stuck on
    (`ui/src/components/RunsList.tsx`).

## Pre-registered validation
- Task 12: the encoded default produces the same output as today's renderer on every existing
  render test.
- Task 15: a typed request ("make the outcome one line") reaches, takes effect without a
  deploy, is named by `human_surface:ui_view`, and is undone by typing "undo".
- Task 21: a lesson typed at an outcome is written with its source and its reading echoed, and
  a later run of that thread shows whether it held.
- Task 22: a gap the system closes appears as a thread whose steps name the commit and the
  gate's verdict, and a person's verdict on it is kept as an observation.
- Task 24: a time-displaced ask shows "next due", and the run it fires lands in its thread.
- Task 28: after a restart, with goal-host holding none of a person's earlier runs, their list
  shows every ask with its kept outcome or "record gone", and none as running.
- Task 31: a person signs in on a node that serves the verdict writer, gives one verdict, and
  the stored label is a human verdict naming them, with the token's audience naming that node.
- Task 39: no ask about a closed gap is counted as waiting.
- Task 45: across a week of use, undo after a reading is recorded against the reader that
  proposed it.
- Throughout: interface gaps, and teaching, are measured by the gap triple; interface changes
  asked for in text are measured by the share that took effect and the time each took. How
  well the interface serves people is measured per job, by the proposal's measures, before a
  layout change and after it.
