# Human-interface program — stage state of record

Companion to the stage-1 matrix, the frozen scenarios, the repertoire, the stage-4
trace, and the v1→v2 causal prereg. Dated status; supersedes nothing timeless.

| Stage | Deliverable | Status | Evidence |
|---|---|---|---|
| 1 Audit | Behavior-and-evidence matrix | **DONE** | `validation/reports/human-participation-baseline-2026-09-20/MATRIX.md` (`487d8085`, `10cd8c42`) |
| 2 Scenarios | Frozen set + fixtures + keys | **DONE** | `SCENARIOS.md` + fixtures (`63f29a92`) |
| 3 Repertoire | Versioned baseline | **DONE** | `repertoire/REPERTOIRE.md` v1+v2, probe evidence, screenshots (`4cfb4cbd`, `81f6394c`) |
| 4 Observability | One replayable trace, missing links explicit | **DONE (5/9 links held)** | `stage4-trace.ts` + `TRACE-2026-09-20.md` (`f37a21f0`); the consumption row is the journal-format gap's falsifier run |
| 5 Propagation | Two variants selectable, recorded assignment, confirmed exposure | **DONE** | `stage5-variants.ts` PASS (`c0addb25`); selection via renderPolicy impulse, adoption boundary held, v1 retained for recovery |
| 6 Autonomous cycle | System-originated investigation → verified improvement or supported rejection | **DONE — supported rejection** (cycle A: substrate candidate refuted with the missing fact fed back; cycle B: two honest not-reached rounds, one system-filed capability gap, one destructive class defect caught and filed; re-entry precondition defined) | Ledger below |
| 7 Causal evidence | Scoped claim with limits | **Q1 CONFIRMED; Q2/Q3 PENDING by prereg** | `CAUSAL-PREREG-v1v2.md` |
| 8 Discovery | Changed understanding/reachability + age of unexercised structure | **PARTIAL** | See below |
| 9 Adoption | Adopted baseline + improvement cycle + retained alternatives | **PARTIAL** | See below |

## Stage-6 ledger (attribution per stage, as the program requires)

**Cycle A — the endpoint-pin repair (running):**
- Detection: operator (gap filed with verified evidence).
- Framing: operator (required behavior stated in the gap).
- Authoring: **substrate** — landed `175b9f1` (development-vessel), autonomously,
  via apply_proposal_as_patch + mitosis cutover, semantic gate approving.
- Verification: operator — the patch resolves discovery for `obsidian:note`, not
  the uiQuestion producer; when an obsidian vessel is present the scan regresses
  to a guaranteed no-op. **Supported rejection**, fed back through the gap with
  the one missing fact (query discovery for the shape the caller consumes).
- Continuation: substrate — event-driven compose pickup fired on the reopened
  gap (nudge completed http=200); second candidate awaited.
- Standing lesson filed with the rejection: the semantic gate accepted a patch
  whose discovery query names the wrong shape — an agreeing-wrong pair between
  composer and gate; the gate had no way to check *what* the helper resolves.

**Cycle B — the S6 comprehension goal:**
- Round 1: goal `7a51e940…`, natural language, no file paths (law 13). Terminal:
  `status failed, reached false`, the system's own verdict honest ("does not
  meaningfully distinguish supported conclusions from unresolved claims"). The
  decision log is high quality: it labeled its own empty panels HOLLOW-CONTENT,
  treated an unreadable `uiPanel_write` as non-persistence, withheld β where the
  arm structurally could not win, and named "the missing producer→consumer edge"
  itself. Operator verdict recorded to the oracle corpus
  (`goal_verification_labels:d2vd1ql9wkrjqbwlljr8`, not_reached, 0.98): root
  cause is **information starvation** — the handoff existed only as a git
  fixture, never as a resolvable impulse; no walk step could read the claims it
  was asked to help assess (law 8).
- Operator assistance, attached to its stage (information supply only): the
  handoff seeded as live panel `frozen-s6-incident-handoff-v1` (claims only,
  scoring key withheld). In doing so the live vessel **coerced a structured body
  to the string "[object Object]" while acknowledging success** — silent
  destruction; filed as gap
  `stateful-ui-panel-write-coerces-structured-body-to-object-object` (the
  replacement surface preserves structured bodies — this is the live vessel's
  defect, and it immediately triggered a compose nudge).
- Round 2 (`e318c843…`, information available): `reached false` again, honest
  hollow verdict — and two findings worth more than a reach:
  1. **The satisfier resolving the read shape `uiFeedback` issued a defaulted
     `uiQuestion_write` that OVERWROTE the live handoff panel** (byte-verified:
     body emptied, `updatedAt` advanced twice in step with the two walk rounds).
     Filed: `walk-satisfier-resolves-a-read-shape-by-issuing-a-defaulted-write-destroying-live-panel-content`.
     Panel restored afterward from the fixture.
  2. The walk again named the missing producer→consumer edge and **filed a
     capability gap itself — verified in the store, not taken from its own
     report**: `gap-candidate-improvement` (source `substrate_detected`,
     stamped 2026-09-20T05:25:51Z, inside the round-2 window) asks for a producer
     of the shape `candidate_improvement`, which it inferred from the goal's
     "author a candidate improvement". The system generating its own demand
     signal is what the program wanted; that it chose a fresh shape name rather
     than the existing ui vocabulary is itself stage-8 evidence (new-distinction
     proposal, currently unexercised).
  The feedback plane could not label round 2 (no template recorded — known
  limitation for refusal/satisfier-only dispatches); the verdict lives in the gap.
- **Cycle B outcome: supported rejection.** The current pathway cannot serve the
  S6 activity; the causes are precise, filed, and partly system-detected. Standing
  stop condition, evidence-based: **no further S6 re-dispatches until the
  destructive-satisfier gap closes** — each dispatch risks clobbering live panels
  a person may be reading. Round 3's precondition is that gap's closure, and its
  falsifier is this exact scenario: **re-seed the panel from the fixture
  immediately before dispatch** (the store copy must be assumed clobbered by any
  intervening walk), dispatch, and the panel body must survive the walk.

## Stage-8 record

- Discrepancies fed to discovery as structured gaps: 4 filed + 1 reopened-with-
  refutation, all category `human_participation`, source `human_reported`.
- **No new shape minted** for variant selection — law 3 held: `renderPolicy`
  (existing) gained a field instead of a new shape; the selection remained
  impulse-shaped and use-time-read (law 1).
- Proposed-but-unexercised structure, with age: a first-class exposure record
  (actual-presentation/exposure as a shape, not a probe artifact) — proposed
  2026-09-20 in the stage-4 trace, age 0 days, status: not minted; blocked on a
  demonstrated consumer (a consumer-less shape would land in the hollowness
  register it was born from).
- Reachability change demonstrated: uiQuestion producers are now selectable
  producers of two presentation variants; reach for human answers is still
  severed at consumption (unchanged until the journal-format gap closes).

## Stage-9 record

- Adopted baseline: v2 (onepage) as default policy, v1 (stacked) retained and
  demonstrated recoverable (stage-5 run, revision 2 restore).
- Expansion state: isolated fixtures + operator review only. No real-participant
  runs; per the prereg, no comprehension claim is made for v2 — its adoption
  rests on the one-page requirement, which is probe-verified.
- Attribution today: detection O/S mixed (see ledger), framing operator,
  authoring mixed (substrate landed one candidate; operator authored v2),
  verification operator + probes. The declining-operator-share metric starts
  from this row.
