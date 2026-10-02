# Substrate face and interactor learning

**Date:** 2026-06-02
**Author:** substrate-merged finding (delegation)
**Related concepts:** `concept_9ldsmRgqSTd5` (substrate self-detection recursive), `concept_U1GbuEbgtcM7` (substrate observation-recursion principle)
**Related vessel:** `repos/stateful-ui-vessel/` (port 8270, v0.1.0)

## 1. What the vessel is

`stateful-ui-vessel` is the substrate's "face." It is a small Hono/Bun HTTP service on port 8270 that holds an in-memory pool of **panels** (substrate-authored UI artifacts) and serves them to an operator-facing HTML/SSE frontend. Substrate-side activities write panels through the discovery contract (`POST /resolve` with `uiPanel_write` / `uiQuestion_write` pointers); the operator browses, dismisses, or answers; the vessel converts every click/dwell into an `interactorObservation` impulse and every answer/dismiss into a `uiFeedback` impulse, then forwards both back to dev-vessel as `substrateGap_write` so the substrate's own gap-aggregation loop can consume them. Questions are non-blocking — they sit on the page until answered or until the authoring activity's timeout fires, at which point silence itself is recorded as an observation.

## 2. The recursive principle applied to UI

The substrate already runs an observe-orthogonal-patterns → decide → enact loop against its own execution traces (`concept_U1GbuEbgtcM7`). The face extends that exact loop one level outward — from traces of *itself* to traces of its *audience*:

| Self-observation primitive | Audience-observation analogue |
|---|---|
| `phantomTraceReport` (dispatched activity yielded no trace) | `interactorObservation` (panel was shown but never engaged) |
| `failureMode` on an execution | `uiFeedback{kind:"dismiss"}` on a panel |
| `dispatch-drafter` (authors a gap-closing activity) | `present-panel-to-operator` (authors a UI artifact) |
| `observe-orthogonal-patterns` (scores templates by recurrence) | `observe-interactor-patterns` (scores panel-kinds by engagement) |

The architectural insight: **no new machinery is needed.** The same aggregator that converts repeated phantom-traces into a `pendingModifyDecision` can convert repeated dismiss-events into the same decision shape, and the same drafter that authors a gap-closing activity can author a panel-design activity. The recursion (`concept_9ldsmRgqSTd5`) extends naturally because both inputs reduce to the same impulse-shape contract.

## 3. How the substrate learns an optimal interface

Four concrete sub-loops, all running on existing substrate primitives:

a. **Importance signal.** Panels written with `importance=high` that the operator dismisses without engagement emit `interactorObservation{type:"click", target:"dismiss"}`. The substrate's gap-consumer counts these per authoring activity; when the dismiss-rate on `importance=high` panels from activity X crosses a threshold, a `pendingModifyDecision` is emitted asking activity X to reconsider its importance-assignment heuristic.

b. **Click→read time.** Dwell observations on long-body panels are bucketed by `(panel_kind, mean_dwell_ms)`. The drafter's next variant of `present-panel-to-operator` is conditioned on the bucket — short-dwell panel-kinds get a "produce shorter body" tasks contract; long-dwell panel-kinds preserve detail.

c. **Question accept-rate.** Questions ignored more than answered indicate framing failure. The substrate emits a sibling-variant activity with re-phrased prompts and A/B-tests via Thompson Sampling — the same α/β posterior path that ranks execution templates ranks question-phrasings, because both surface as `activity_template` rows.

d. **State-conditioned UI.** Panel rendering can be linked to the substrate's current `state_signature`. Under high-load states (many in-flight dispatches, recent failure spike) the substrate authors fewer / smaller panels — the assumption being that the operator is also under pressure. This is the same state-signature already used to gate boredom-cadence; reusing it here keeps the substrate from spamming itself.

## 4. What it asks vs what it tells

The face has two modes, sharing one panel primitive:

- **Tells** — `kind:"info"` panels rendered with no `asks` array. Status updates: "drafted 3 gap-closing variants in the last hour," "phantom-trace rate on dispatch-drafter is 12%." Ambient; the operator may dismiss but is not required to.
- **Asks** — `kind:"question"` panels with `asks[]`. Issued when the substrate's decision-loop hits low confidence — e.g., the LLM-REUSE step returns NONE but the embedding score on the second-best candidate is within 0.05 of the threshold. The panel asks "is `<close-candidate>` the right reuse?" with a non-blocking timeout. If no answer arrives by the timeout, the substrate proceeds with its own default and records the silence as `interactorObservation{type:"dwell", duration_ms:<timeout>}` — silence is data, not paralysis.

## 5. How the operator controls it

By talking to the substrate's normal dispatch path. Saying "show me the recent recurring gaps" dispatches a goal that resolves to a substrate-authored activity (`present-recurring-gaps`) composing recent `observe-orthogonal-patterns` output with a `uiPanel_write` impulse. The operator never edits the UI; the operator edits the substrate, and the UI follows. This collapses what is normally a separate "UI configuration" concern into the substrate's existing observe→decide→enact loop.

## 6. How we learn a more optimal interface (recursive)

- The aggregators that score template success now score panel success.
- The drafter that authors new activities now authors new UI activities.
- The self-merge composition that lands gap-closing variants now lands UI variants.
- The operator's role narrows to occasional question-answering and threshold tuning.

This is the third-level recursion: the substrate uses its own observation machinery to improve the surface through which the operator observes the substrate. The face becomes a substrate-authored artifact whose quality is measured by the same machinery that measures every other substrate-authored artifact.

## 7. What the parallel agent shipped

Validated against the working tree at `repos/stateful-ui-vessel/` (v0.1.0):

- `src/index.ts` (377 lines) — Hono app exposing `GET /health`, `GET /shapes`, `GET /api/state`, `GET /api/stream` (SSE), `POST /api/panels`, `POST /api/feedback`, `POST /api/observations`, `POST /resolve`, and `GET /` (embedded HTML+SSE frontend).
- `src/store.ts` — in-memory `panels`/`feedback`/`observations` stores with a `subscribe()` listener-set powering the SSE stream; `Panel`, `Ask`, `Feedback`, `Observation` types.
- `src/discovery.ts` — same `DiscoveryRegistrationLoop` shape as development-vessel; advertises four shapes: `uiPanel_write`, `uiQuestion_write`, `uiFeedback`, `interactorObservation`.
- `emitSubstrateGap()` in `src/index.ts:45-69` POSTs feedback + observations to dev-vessel as `substrateGap_write` impulses with categories `ui_feedback` and `interactor_observation`.

The scaffold matches the finding cleanly. Minor mismatches worth flagging:

- The vessel emits **only `substrateGap_write`** upstream; it does not yet write `uiFeedback` / `interactorObservation` impulses directly through the impulse-resolve path. This is acceptable for bootstrap (substrate's existing gap consumer picks them up under `category`) but the gap-consumer must be taught to recognize the two new categories.
- No persistence — restarts lose panels. Fine for scaffold; the next iteration should pin durable state to a small SurrealDB table or a flat-file pool.
- Dwell observations are not yet emitted by the frontend (only `click` is wired). The dwell loop in §3b needs frontend `IntersectionObserver` + timing to land.

## 8. Next code spec

Not authored in this delegation; the natural follow-ups:

- `present-panel-to-operator` — substrate-authored activity taking `(title, body, asks, importance, kind)` and dispatching `uiPanel_write` through discovery to stateful-ui-vessel.
- `observe-interactor-patterns` — boredom-cadence sibling of `observe-orthogonal-patterns`, aggregating `interactorObservation` + `uiFeedback` impulses and emitting `pendingModifyDecision` impulses for authoring activities whose panels under-perform.
- `panel_engagement_score` — a scoring resolver returning per-panel-kind metrics: `mean_dwell_ms`, `accept_rate`, `dismiss_rate`, `silence_rate`. This is the data dependency for both §3b and §3c.
- Frontend dwell instrumentation — `IntersectionObserver` driving `POST /api/observations` with `type:"dwell"` and accumulated `duration_ms`.
- Gap-consumer extension in dev-vessel — recognise `ui_feedback` / `interactor_observation` categories and route them into the same pattern-aggregation path as phantom-trace and failure-mode signals.

## Closing principle

The substrate's face is not a separate product. It is one more substrate-authored artifact whose authoring loop is the substrate's own observe→decide→enact cycle, now turned outward at its audience. Optimality is not designed — it is converged toward, by the same machinery that converges everything else.
