# The memory store was split and flooded; the substrate repairs its own retire primitive

Recorded 2026-09-22 (evening). Measured on the running substrate, not inferred.

## What was wrong (three findings, one root each)

1. **Two memory stores.** development-vessel's unit file declares
   `Environment=WORKSPACE_ROOT=/workspace`; the generated `/etc/substrate/env` sets
   `WORKSPACE_ROOT=/workspace/git/super-repo` (gen-env, 2026-07-25). systemd lets an
   EnvironmentFile override `Environment=`, so since July 25 the vessel has read and
   written `/workspace/git/super-repo/memory/notes.json` while 680 notes (87 feedback,
   287 finding, 264 project — the system's actual knowledge, incl. 452 harness-mirrored
   operator notes) stayed unread at `/workspace/memory/notes.json` (newest 2026-07-23).
   No impulse names that file: the system could not see it.
2. **Battery residue.** The expectation-trend checker (dev-vessel index.ts) mints a
   `trendcheck-<fam>-<seed>-<i>` product note and goal-host's transform oracle mints an
   `expectation:<title>` note per probe, every 120s tick, and nothing retires them:
   578 of 1077 live notes (54%). The memoryNote store had no delete/retire primitive.
3. **Recency window.** `resolveMemoryNote` sorts by updated_at and cuts at `limit`; the
   session hook asked for the newest 500. The residue displaced every convention, so
   session start reported "Feedback / conventions (0)" while 90 existed.

## Operator interventions (labelled; not evidence of autonomy)

- File-level merge of the orphaned store into the live one: 675 added, 1 id + 3 title
  collisions and 1 malformed row skipped, timestamps preserved (a resolver write would
  have stamped all 676 as fresh), provenance tag `merged-from:/workspace/memory/notes.json`,
  backup `notes.json.pre-merge.*.bak` beside the live file, race check on re-read.
  Result: 1752 notes; feedback 90 / finding 295 / project 281 now served (verified via the
  resolver by note_type).
- Session hook: conventions fetched by note_type separately (cannot be displaced).
- The unit/env WORKSPACE_ROOT collision is FILED, not hand-edited.

## The self-repair demonstration (gap → compose lane → verify by behaviour)

**Gap 1** `the-memory-store-has-no-retire-primitive-so-battery-residue-accumulates-forever`
(edit_site memory-note.ts, source human_reported, behavioural falsifier in the text).

- Attempt 1: dispatched 23:16Z via gap_to_feature. Landed **b5ed109 (Substrate
  Autonomous, 23:19Z)**, verdict FAVORABLE (typecheck, shape-dispatch, bun test),
  cutover restarted the vessel. **Falsifier run at 23:21Z on the live vessel: FAILED.**
  The branch read `pointer.retire`/`pointer.id` from the flat pointer only; the canonical
  nested envelope `{ note: { id, retire: true } }` fell through to the title/body
  rejection. Flat retire of a present note DID delete it (store 1753→1752) and flat
  retire of a missing id returned not_found. Half right, green, hollow for its reader.
- The failure was written back into the gap (attempt_1 sha/verdict/defect + the exact
  fix: read `src.retire` and `pickString("id")` after the envelope is normalised) and the
  lane re-dispatched at 23:2xZ. This is the loop the operator asked to see: the system's
  own failed attempt becomes the next attempt's lesson, no hand edit.

Gap 2 (the checker retires each probe's product + expectation note after grading) is
filed only after attempt 2 verifies, so its drafter binds to a contract that works.

## What "after" must show (pre-registered)

- Nested and flat retire both pass the 6-step falsifier on the live vessel.
- trendcheck/expectation note counts flat across ≥2 checker cycles (baseline 23:16Z:
  429 / 149 of 1752).
- Session start lists conventions (≥ 90 feedback).
- Two substrate-authored commits on development-vessel origin/dev; gap 1 and gap 2
  closed by behaviour, and not reopened.

## Attempt 2 — how a failed falsifier is fed back (the protocol, learned by reading the lane)

- Re-dispatch after annotating the gap in prose ("FAILED ITS FALSIFIER") was REFUSED:
  verdict `pending_verification`, "landed once but unmeasured — held pending
  verification; not re-composed". Correct guard (§12.6: a second landing would read as a
  manufactured re-land). The prose was not a measurement to the lane.
- The lane's own vocabulary (verifyGapCondition, Class-3 branch): a landing is treated as
  regressed when the summary carries the literal token **`BEHAVIORAL VERIFICATION FAILED`**
  or classification_metadata names **`regressed_by: <sha>`**. Re-filed with both, cleared
  `pending_outcome_verification`. Pick-time check then passed and the symbol grounded at
  memory-note.ts:168 (the retire branch) — the lane aimed at the right lines on its own.
- Then `[compose-cap] REFUSING autonomous compose: 1 in flight — retried when there is
  capacity` (verdict BUSY). Root: gap_to_feature does not forward `directed` into
  feature_compose, so an operator dispatch cannot take the reserved directed slot. Filed as
  `gap-to-feature-drops-the-directed-flag-so-an-operator-dispatch-competes-as-autonomous-work`.
  The retire gap is left for the lane's own retry (no operator re-dispatch) — that retry IS
  the demonstration.
- 23:26:35Z the lane picked the retire gap ON ITS OWN (no operator re-dispatch), drafted
  against memory-note.ts, and FAILED VERIFY: `TS2451: Cannot redeclare block-scoped
  variable 'nested'` (169, 173) — the drafter inserted a second envelope normalisation
  above the existing one. Rolled back (running file == b5ed109), `failure_lessons` gained
  class=verify_failed with the exact tsc error, failed_attempts=2. The gate caught it; the
  lesson is now in the gap and mirrored to concept-db for the next draft.
- 23:28Z the lane picked the directed-flag gap, took an anchor_not_found lesson on the
  first draft, and re-drafted via patch-with-tools (turns 2–22 visible). Both gaps are in
  the system's hands; the operator is watching, not editing.
- 23:3xZ two more picks of the retire gap were refused for capacity (the directed-flag
  compose holds the single autonomous slot). The lane then declared the gap
  "chronically stuck" and emitted a NARROWED CHILD — which is a verbatim copy of the
  parent (same edit_site, same summary with a "[narrowed from …]" prefix). No new
  information, one more arm competing for the same slot (law 3: a duplicate mint is a
  fresh uninformed cell). Filed below as an observation, not acted on.
- Attempt 3 (23:38Z, lane's own pick) also failed verify — but differently: the
  per-gap lesson block DID reach the drafter (priorAttemptFeedbackBlock, verbatim tsc
  output) and it stopped redeclaring `nested`; it still redeclared `src`/`pickString`.
  Root: the localizer anchors every draft on the existing retire block at the TOP of the
  function, and the correct fix is a MOVE below the envelope normalisation — not
  expressible as one in-place region edit — so each draft copies the normalisation upward
  and collides. Operator contribution (a lesson, not an edit): the gap text now states the
  constraint — stay inside the existing block, local `retireSrc`/`retireId`, no new
  top-level declarations. Left for the lane's own next pick.

## Attempt 4 — LANDED AND VERIFIED (23:47–23:49Z)

- After the gap text gained the in-place constraint, a goal hashed `0d323808` reached
  goal-host with our gap record hydrated into it ("gap-hydration: injected record
  the-memory-store-has-no-retire-primitive… cited file memory-note.ts"). It was NOT
  dispatched by the operator (no operator tag; no operator goal named this file). Goal-host
  routed it through EARLY EDIT-INTENT → feature_compose; the draft changed exactly two lines
  inside the existing retire block (reads `pointer.note.retire` / `pointer.note.id` as
  well as the flat pointer — the constraint was followed); verdict FAVORABLE; cutover;
  pushed as **19ae84e (Substrate Autonomous)**. The commit is labelled with the synthesized
  route-edit id, not the gap id — a provenance gap: the close-oracle cannot attribute this
  landing to the gap it fixed.
- **Falsifier on the live vessel (MainPID 1044575) — PASS 6/6:** nested retire of a present
  note → `retired`, re-read absent; nested missing id → `not_found`; nested without id →
  `missing_id`; flat missing → `not_found`; flat present → `retired`. Store size unchanged by
  the rejections.
- Gap 1 closed by measurement (closed_reason measured_by_operator, close_basis
  operator_measured_behavioral, landed_sha 19ae84e). The duplicate "narrowed" child closed
  as duplicate_of_closed_parent. Gap 2 (checker retires its probe notes; contract = nested
  `{ note: { id, retire: true } }`) FILED for the lane.

Score so far for the self-repair demonstration: 4 substrate drafts, 2 gated out by
typecheck with lessons the next draft partly heeded, 1 hollow-green caught only by the
behavioural falsifier, 1 correct landing after the operator supplied a *constraint* (never
a diff). Operator hands on code: zero.

## Directed-flag gap — first landing is a hollow_write (23:55Z)

bbb83ff (Substrate Autonomous) added `const isDirected = …` above the compose call and
never passed it: `directed: isDirected` absent, typecheck green (an unused const is
legal), verdict FAVORABLE. Exactly the hollow_write class (a write nothing reads). Fed back
with `BEHAVIORAL VERIFICATION FAILED` + `regressed_by: bbb83ff` and the one-line fix
location. Also: the lane auto-minted
`recommit-the-memory-store-…-verify_failed` from the CLOSED retire gap's old lessons and
picked it at 23:56Z — a recommit that does not check its parent's status. Closed as
superseded_parent_landed (the pick may already be composing; the falsifier will grade
whatever it lands).
