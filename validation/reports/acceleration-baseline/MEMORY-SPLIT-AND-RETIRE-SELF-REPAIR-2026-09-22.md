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

## 00:13Z — the closed recommit reopened itself; a loop, and a gate inconsistency

- `appendComposeLesson` (feature-compose.ts ~3180–3210) writes failure_lessons back with
  `status: "open"` unconditionally and rewrites `source`; a failed compose on the CLOSED
  recommit gap therefore reopened it (reopen_count 1) and the recommit mint never checks
  whether the base gap is still open. With the parent landed and verified, every draft is a
  no-op or duplicate → fails → reopens/re-mints itself. Filed
  `the-compose-lesson-writer-force-reopens-closed-gaps-and-mints-recommits-for-landed-parents`.
  Parked the looping gap through the lane's own candidate filter
  (`pending_outcome_verification = 19ae84e`, which is TRUE), not by deleting it.
- Directed-flag gap: the semantic gate REJECTED "adds isDirected but fails to pass it" at
  23:37Z, then PASSED the same defect at 23:49Z (bbb83ff). Same-input opposite verdicts —
  the judge-inconsistency class seen in goal-host earlier today.
- Gap 2 first draft: anchor_not_found — the drafter anchored on the `expectation:`
  violation scanner (lines 438–443) instead of the trendcheck grading loop (~529) the gap
  quotes verbatim. Lane retrying on its own.

## 01:0xZ — the lesson-writer gap reproduced its own defect

First draft for `the-compose-lesson-writer-force-reopens-closed-gaps-…` failed
anchor_not_found (drafter's old_string vs real text at 3159–3164), and appendComposeLesson
immediately minted `recommit-the-compose-lesson-writer-…-anchor_not_found` — the loop the
gap describes, now spawning from the gap that fixes it. Dominant failure class across all
three open gaps tonight is anchor_not_found on the FIRST draft (2 of 3), then a corrected
re-draft; the third landed hollow. Lane retrying all three on its own; no operator edits.

# 02:00–02:30Z — why the lane stalled: three independent outages, one of them self-repaired

Gap 2's directed compose died "BEFORE fc-plan: llmCall to :8220 returned error — no llm
arm is currently servable". Working outward from that:

1. **LLM plane — OpenRouter credits exhausted (operator blocker).** `/api/v1/credits`:
   total_credits 1400, total_usage 1399.69. Paid models 402, free models
   "429 free-models-per-day"; 3,901 "all completion providers cooling" events in 6 h;
   first full outage 02:09:50Z. Only an OpenRouter key is configured (Anthropic/OpenAI/
   Google/TypeSafe empty). Nothing the substrate can do; top-up or a second provider key.
2. **Identity rate-limits the fleet as one bucket → activity-api called it a revoked key.**
   identity `/v1/auth/resolve` limiter: 100/min per `ip:keyprefix`; every vessel is
   127.0.0.1 with the same 8-char prefix → 6,505 429s in 30 min. activity-api
   translated null verdicts into `INVALID_API_KEY`; goal-host's trace sink read that as
   revocation and SPOOLED (bursts of 40/min). **The substrate diagnosed and fixed the
   labelling itself**: gap `identity-rate-limit-on-a-fleet-shared-bucket-is-reported-by-
   activity-api-as-a-revoked-api-key` → commit **4fc5f80 (Substrate Autonomous, 01:55Z)**
   answers 503 IDENTITY_UNAVAILABLE for transient failures. Post-restart (02:21Z) goal-host
   INVALID_API_KEY fell from ~40/min to 1. The identity bucket itself (edit_site
   identity ratelimit.ts) is still open.
3. **self-recovery restarts activity-api every 3 minutes.** 33 starts in 3 h, systemd
   NRestarts=0 (all clean external stops), stops at 01:39:41 … 02:19:30 on a 3-min grid;
   `self-recovery-tick`: "UNHEALTHY: activity-api (:8080) — restarting … recovered via
   restart". Cause: 1,235 of 1,677 queries in 15 min took >10 s (recommend/FTS+dense over
   919 templates, up to 40 s); bun is single-threaded so /health cannot answer during one;
   the probe's budget is 10 s. /health answers in <10 ms when the loop is free. Each restart
   kills in-flight work and opens a 401 warm-up window. Filed
   `activity-api-recommend-queries-block-the-event-loop-…`.

Collateral, measured: **17,587 traces (119 MB) spooled since 08-17 with no replayer** —
4,500 on 09-16, 7,224 on 09-17, 3,256 on 09-23 — executions the learner never saw. Filed
`the-trace-sink-spools-rejected-traces-to-disk-and-nothing-ever-replays-them`
(edit_site ias-executor-ts trace sink; behavioural falsifier: spool count falls with
activity-api up, never with it down).

Also seen: `[human-surface] 1 vessel(s) advertise goal_execution; none answered a resolve
call` during the churn — the human surface could not dispatch while goal-host's own
recommend calls were failing.

## Where the demonstration stands (02:30Z)

- Retire primitive: landed 19ae84e, falsifier 6/6, gap closed by measurement. ✔
- Gap 2 (checker retires probe notes), directed-flag, recommit-loop: open, in the lane's
  queue; every draft now dies at the LLM call until credits return.
- Residue: 445 / 151 at 02:15Z (baseline 429 / 149) — will keep rising until gap 2 lands.
- Substrate self-repair observed tonight without operator hands: 19ae84e (retire, via
  edit-intent), 4fc5f80 (auth labelling), plus f122f86 / 983ca92 / bbb83ff on its own gaps.

## 02:31Z — funded; plane back; the anchor problem named

- Operator topped up OpenRouter (1400 → 1500). First servable completion 02:31:53Z
  (google/gemini-2.5-flash). No restart needed — the router re-probed on its own.
- Gap 2's fourth attempt (02:32Z) failed the same way as the first three: the localizer
  grounds on `EXPECTATION_SCAN_INTERVAL_MS` and every draft edits the `expectation:`
  violation SCANNER (`if (liveBody === String(e.spec.expected))`, ~438–470) instead of
  the trendcheck GRADING loop (`live.body.trim() === probe.expected`, line 529). The gap
  prose quoted the right line; the localizer never read it. The lane then minted another
  verbatim "narrowed" child (parked as duplicate).
- Fix as information (law 8), not code: `classification_metadata.region` = the unique
  grading line, which fc-scope reads as the grounding centre; plus an explicit forbidden
  region. Re-dispatched directed at 02:36Z. Pre-registered: the draft's op path must be
  index.ts with `old` containing `probe.expected`; then verify green; then residue count
  flat across two checker ticks (baseline 445 / 151 at 02:32Z).

## 02:36–02:55Z — the fourth outage: a poisoned discovery row emptied every grounding window

Gap 2's region literal was honoured ("region->line: found at 1 site … grounding on line
529") and the compose still refused: `Grounding window (0 bytes)`. Every compose after
02:33Z had a 0-byte window. `groundVesselFiles` reads files through
`discover("shellResult")`, and discovery resolved that shape — and code_read_lines,
code_search, codeReadResult — to `http://127.0.0.1:24892`, where nothing listens.
The row belongs to `local-tools-vessel` (the real one is PID 1620 on 8230, up since
20:06Z). `last_writer.at` = 02:36:54Z, fleet key, claimed_vessel_id local-tools-vessel;
discovery took 6 POST /register in that 10 s window, while feature_compose was verifying
an edit to repos/local-tools-vessel in an isolated checkout. A transient instance
registered its ephemeral port under the live id and exited; the live vessel's heartbeats
(keyed by vesselId) kept the poisoned endpoint alive with confidence 1. The liveness
guard (ffd1d58, running) checks lastSeen, which the heartbeats refresh — it cannot see an
endpoint swap. local-tools never re-registers unless a heartbeat 404s.

Operator remedy (reversible, no code): drain-restart local-tools so it re-registers 8230.
Filed `a-transient-verify-instance-registers-an-ephemeral-endpoint-under-the-live-vessel-
id-and-heartbeats-keep-it-alive` (edit_site discovery registry.ts: probe a changed
endpoint before storing it; a heartbeat must not keep alive an endpoint it does not come
from). Method note: "no producer" / empty grounding after a compose on a TOOLS vessel →
resolve the shape with the API key and compare the endpoint to the unit's PORT.

## 02:44Z — gap 2 finally drafts at the right line

With the region literal honoured and a 54 KB window (`grounding_has_region: true`), the
draft's op targets `if (live && …` at 529 — the first of five attempts to touch the
grading loop. It failed verify with `TS1472 'catch' or 'finally' expected` (the
replacement broke the enclosing try/catch); rolled back; lesson class `syntax_break`
recorded with the exact tsc output. That is the gate doing its job and the lane holding
the right site; the next draft carries the lesson. The registry row for local-tools had
already re-flipped to 8230 by the time the operator restart ran (harmless). The lane has
since picked the trace-spool replayer gap (31 KB window) and the registry-poison gap on
its own. Queue is moving again: credits + registry were the two blockers.

## 02:45–03:25Z — slot starvation, router self-corrected, proposal lane busy

- After the plane returned, the first three drafts (gap 2, spool replayer, registry
  poison) all failed `syntax_break` — malformed TypeScript, a class that was rare
  before (2 in 4 h) and jumped after the router fell to gemini-2.5-flash (its Chutes TEE
  arms 402: a second, separately funded provider; OpenRouter free arms 429 per-day).
  deepseek-chat-v3 and gpt-4o-mini were servable when pinned. NOT hand-tuned: by 03:25Z
  the router was serving deepseek-chat-v3 on its own (graded off flash). Credit burn
  02:31→03:25: ~0.7.
- 02:55→03:25Z: 23 `compose-cap REFUSING` vs 1 autonomous pick; the proposal-apply
  lane (mitosis-*) landed 16 FAVORABLE cutovers in the same window, incl. 57c759a
  "development-vessel-is-absent-from-the-discovery-registry…" (the registry class,
  found by the substrate independently). None of the six operator-filed gaps got the
  slot. Gap 2 re-dispatched directed with retries at 03:26Z (directed still not forwarded
  — that gap is one of the six).
- Residue 448 / 152 at 03:25Z (baseline 429 / 149).

## 03:26–03:52Z — why directed retries saw 14 straight BUSY: contention plus self-restarts

- Not a leaked counter: real composes held both slots (goal-host route-edit composes on the
  directed slot; a 10-min autonomous compose on the other). Most of the "REFUSING" count
  in that window was the operator's own retry loop — noted so the number is not misread.
- development-vessel restarted ITSELF three times in 11 min (03:30 "observed 3 in flight,
  LOSSY", 03:37, 03:41), each by its own landing cutover. Composes mid-draft at those
  moments died silently (no verdict, no lesson). With ~16 self-landings per 30 min from
  the proposal-apply lane, the vessel's restart cadence is shorter than a compose. Filed
  `development-vessel-self-cutovers-restart-the-vessel-faster-than-a-compose-completes-…`
  (edit_site vessel-mitosis-cutover.ts; defer self-restart while composes are in flight).
- Router: serving deepseek-chat-v3 again on its own. Credits: 1400.59/1500 at 03:25Z.
