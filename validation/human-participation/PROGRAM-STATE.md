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
  hollow verdict — and two findings worth more than a reach.
  **CORRECTION (2026-09-20 07:09 UTC) — this dispatch id is not a usable
  citation, and finding 1's evidence is re-grounded below.** `e318c843` is the
  first 8 hex characters of a `crypto.randomUUID()` dispatch id (goal-host
  `index.ts:15012`); `GET :8210/executions/e318c843` returns
  `404 {"error":"dispatch not found"}`, but a positive control at the same
  address shows 7 of 8 *full* UUIDs from the live journal returning `200`, so
  the 404 attributes to the truncation, not to a lost record. No UUID beginning
  `e318c843` survives in the current journal window, so the full key is
  unrecoverable and the citation is unresolvable as written. Record full
  dispatch ids from here on. Full re-grounding, including the primary journal
  evidence that replaces it, is Amendment 2 of
  `validation/reports/human-participation-baseline-2026-09-20/MATRIX.md`.
  1. **The satisfier resolving the read shape `uiFeedback` issued a defaulted
     `uiQuestion_write`, and the live handoff panel was observed emptied**
     (operator-contemporaneous: body emptied, `updatedAt` advanced twice in step
     with the two walk rounds). Filed:
     `walk-satisfier-resolves-a-read-shape-by-issuing-a-defaulted-write-destroying-live-panel-content`.
     Panel restored afterward from the fixture.
     **CORRECTION — two overstatements in the original wording.** (a) Record this
     as *observed-then-restored*, not byte-verified-and-re-checkable: stateful-ui's
     store is a whole-snapshot overwrite with no revision history, so the restore
     left nothing behind that can now confirm or refute the clobber. The
     observation stands; its independent re-checkability does not. (b) The class
     is real but its **frequency was overstated** — most defaulted live writes
     *create* junk panels rather than overwrite. Verified read-only against the
     live store: 32 panels carry auto-generated `panel-<epoch-ms>` ids and all 32
     have `createdAt == updatedAt` (never written twice), with creation times
     matching journalled satisfier firings to the second. Destructive overwrite
     needs the model to emit an already-existing id; its base rate is well under
     one per firing. What *is* now confirmed primary, from the goal-host journal
     rather than a dispatch id: the same defaulted `uiQuestion_write` fired 9
     times on 2026-09-20 within 55 minutes — 5 re-reading target `uiFeedback`,
     3 `interactorObservation`, 1 `interactorAssertion` — and the behaviour is
     not ui-specific (205 satisfier-produced lines overall, led by
     `memoryNote → memoryNote_write` at 80). The standing stop condition below is
     unaffected: the class is confirmed, only its rate is corrected.
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

## Corrections to the stage-1 framing (2026-09-20 07:09 UTC)

**CORRECTION — the visibility defect is a kind-vocabulary problem, and the filed
gap understates it.** The stage-1 matrix and the gap
`human-surface-uiquestion-read-drops-gap-needs-human-panels` both name a single
kind, `gap_needs_human`. Verified read-only against the live panel store: **four
distinct `gap_*` escalation kinds exist** — `gap_needs_human` (233),
`gap_pending_verification` (100), `gap_needs_localization` (65),
`gap_reland_needs_human` (14), all written from
`development-vessel/src/resolvers/gap-to-feature.ts`. stateful-ui's filter
(`index.ts:343`) admits two of them and so hides 179 escalations right now;
human-surface's (`src/routes/impulses.ts:219`) admits only `question` and would
hide all four. The gap's summary should be widened to the class.

This changes the repair already implied by that framing: **a kind allowlist is the
wrong fix and must not be the one implemented.** It has failed twice in production
on this same class — stateful-ui's own comment records that `kind === "question"`
alone "missed every real escalation", and its widened allowlist still hides 179
escalations. The vocabulary is **open at runtime**: a write-path probe this session
stored an invented kind (`escalation_kind_nobody_invented_yet`) uncoerced, and two
live kinds (`code_change`, `pulse`) have no writer anywhere in `repos/` at all (see
the open question below). An allowlist's default for an unknown kind is
invisibility, and an invisible human escalation is precisely the defect. The repair
must be a **fail-visible denylist** — display every kind unless explicitly named
non-escalation — so that an unrecognised kind surfaces as a stray visible panel
rather than a silent drop. Consistent with the standing rule that an unobservable
target is a failed scan and not a clean one
(`development-vessel/src/resolvers/ui-legibility-scan.ts:95-115`).

Note the count discrepancy rather than papering it: this correction was framed as
*five* escalation kinds. Four `gap_*` kinds is what the live store supports; a fifth
is reachable only by counting `question` (a solicitation, not an escalation) or the
unattributed `code_change`. Neither is adopted; the measured census is what stands.
Full numbers and method: Amendments 3 and 4 of
`validation/reports/human-participation-baseline-2026-09-20/MATRIX.md`.

## Open questions requiring a decision

- **An unattributed producer is writing into the human escalation channel.** The
  live stateful-ui store holds 3 panels of `kind:"code_change"` (all titled
  "Remove 'continue' statement in pickMostLandable", auto-ids
  `panel-1788692317394`, `panel-1788713691970`, `panel-1788750176582`) and 1 of
  `kind:"pulse"` (`substrate-reach-pulse`, "Reach Trend"). **No writer of either
  kind exists anywhere in `repos/`**: the only `code_change` hits in the tree are
  `has_code_changes` in `activity-api/src/services/state-pattern-learner.ts` (an
  unrelated identifier), and `substrate-reach-pulse` / `Reach Trend` have zero hits
  across `repos/` and `scripts/`. This is **unresolved** — not deferred, not
  explained.
  It matters more than a stray-panel count, because the 3 `code_change` panels are
  the **only asks-bearing panels among all 446**: every panel that actually poses a
  question to a human comes from the one producer nobody can identify, while the
  233 `gap_needs_human` escalations carry no asks at all. Any claim about what the
  system asks humans currently rests on an unattributed writer.
  Caveat on the negative, so it is not over-read: the runtime executes image copies
  of vessel sources, so absence from the worktree is not proof of absence from the
  running system.
  What would settle it: (1) repeat the search against the image/container copies
  under `/vessels` rather than the worktree; (2) read the durable traces bracketing
  the three creation timestamps (`panel-<epoch-ms>` ids give them exactly) and see
  which activity emitted the write; (3) failing both, add request-origin logging to
  stateful-ui's `POST /api/panels` (`src/index.ts:102`) — a gated file, so a
  specification rather than an edit — and wait for the next firing. Until one of
  these lands, the producer is unknown and should be described that way.

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
