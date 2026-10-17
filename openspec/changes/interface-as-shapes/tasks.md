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

## Phase 6 — as the coordinator schedules the goal-host side
18. The utterance shape: every other message goes to the system as text plus context.
19. Follow-ups, corrections and verdicts, each offered only once something reads it.
20. "Changed since you last looked", once the slow-arm effects are readable.

## Pre-registered validation
- Task 12: the encoded default produces the same output as today's renderer on every existing
  render test.
- Task 15: a typed request ("make the outcome one line") reaches, takes effect without a
  deploy, is named by `human_surface:ui_view`, and is undone by typing "undo".
- Throughout: interface gaps are measured by the gap triple; interface changes asked for in
  text are measured by the share that took effect and the time each took.
