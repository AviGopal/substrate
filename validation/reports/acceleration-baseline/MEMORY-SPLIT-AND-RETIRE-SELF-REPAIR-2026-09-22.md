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
- Correction to the lossy-cutover gap after reading the site: the fc cutover path already
  quiesces (marker → wait on /health in_flight → breadcrumb); the LOSSY restart at 03:30
  came from the proposal-apply path (`mitosis-<ts>` id), which has no quiesce/wait — the
  journal shows none for it, and the code comment at the site names the class ("fixed one
  call site, missed the sibling"). Gap text and region literal corrected accordingly.

## 03:56Z — gap 2 LANDED (d4171b1) … and is a silent no-op

Fifth attempt, region-pinned, landed as d4171b1 (Substrate Autonomous), verdict FAVORABLE,
vessel restarted 03:56:07. Placement and shape match the contract exactly (after the
`r++` grading line, nested `note: { id, retire: true }`, both notes, warn-on-throw). One
detail differs from every sibling call in the same file: the request body is bare
`{ type, note }` instead of `{ impulse: { pointer: … } }`. Executing the exact landed body
against the live resolver: HTTP 400 `pointer.type is required`; fetch does not throw, the
catch never fires, the note stays. Green diff, absent behaviour — the third hollow_write
tonight, and the second caught only by RUNNING the landed request rather than reading it.
Fed back with `BEHAVIORAL VERIFICATION FAILED` + `regressed_by: d4171b1`, the exact
envelope from expWrite, and a required `rr.ok` check so a refused retire cannot be silent.
Re-dispatched directed. The two-tick residue measurement continues as the falsifier.

## 04:05–04:32Z — the envelope fix landed first, and made the hollow retire real

- Gap filed 04:00Z (`development-vessel-resolve-rejects-a-bare-type-body-…`, edit_site
  src/routes/impulses.ts) LANDED 04:05Z as **3ed68a6 (Substrate Autonomous)**: tolerant
  parse, deprecation log line. Falsifier on the live vessel: bare body 200 / `{}` 400 /
  nested 200. **PASS.** Closed by measurement.
- Consequence: the "silent no-op" retire calls from d4171b1 now succeed — 7 `bare pointer
  body accepted` lines since 04:05Z. The checker tick at 04:25Z (uppercase, r=3/3) ran
  three probes and the residue stayed **451 / 153**, identical to the 03:56Z baseline;
  before tonight that tick added ~6 notes. One tick flat; the pre-registered criterion is
  two — measurement running.
- Gap 2's sixth attempt (correct envelope + `rr.ok` check) was judged correct by the
  semantic gate and HELD: `env_change_window_held` — the change-window lease was held by
  trace-store-reconcile and the vessel had restarted under it (3ed68a6's own cutover).
  Proposal staged in /workspace/proposals; the apply lane retries. Gap 2 will close by
  behaviour regardless once the second tick is flat.

## 04:37Z — first tick verified with positive evidence (and one misread corrected)

The 04:25Z uppercase tick used seed `mudllwm2` (goal-host handled
trendcheck-uppercase-mudllwm2-0/-2). The store holds NO note with that seed and no
uppercase product touched after 04:20Z; the newest uppercase product is dated
2026-09-20. So the tick created its 3 products + 3 expectation records and the six
bare-body retire calls at 04:24:14/04:24:34/04:25:04 removed them — net residue 451/153,
unchanged. Replaying the exact landed retire body against a stale note: 200 `retired`.
Misread corrected: six "surviving" notes I attributed to this tick carry a 09-20 seed and
09-20 timestamps — I had printed only HH:MM:SS. Rule re-learned: print the date with the
time when grading anything against a tick.

State: the retire loop is live end-to-end — landed twice by the substrate (d4171b1
+ 3ed68a6), proven by behaviour. Remaining: second tick for the pre-registered two-tick
criterion; the 451/153 legacy residue predates the fix and needs a one-time retirement
(a walk goal using the new primitive, not a hand delete).

## 04:41Z — two-tick criterion MET; gap 2 closed by measurement

Second tick 04:41:05Z (deterministic-battery, r=0/3): residue 450 / 153 (the −1 is the
operator's replay test), no note with the tick's seed remains, retire acceptances now 14.
Across ticks 04:25Z and 04:41Z the battery residue did not grow; before tonight each tick
added ~6. Gap 2 closed (closed_reason measured_by_operator, landed d4171b1 + 3ed68a6).

Scorecard for the demonstration (all landings substrate-authored, all verified by
running the new path, operator hands on code: zero):
- retire primitive — 19ae84e, 6/6 falsifier ✔ (after one hollow landing + 2 gated drafts)
- checker retires probe notes — d4171b1, effective once 3ed68a6 landed; two-tick ✔
- resolver accepts bare pointer body — 3ed68a6, 3/3 falsifier ✔ (filed 04:00, landed 04:05)
- auth transient labelled 503 not revoked — 4fc5f80, found and fixed by the substrate alone ✔
- still open, in the lane: directed flag (1 hollow landing), recommit self-reopen loop,
  trace-spool replayer, registry endpoint poisoning, activity-api event-loop starvation,
  proposal-apply lossy self-restart, identity shared bucket.
- operator interventions, none on code: memory-store merge, local-tools re-registration,
  funding, gap text/region constraints, measured-failure write-backs.

## 04:45–05:05Z — the product battery's real killer: a walk-aborting TypeError

- Three fresh product controls with the plane healthy (deepseek serving): 0/3 reached.
  So the family's decline was goal-host, not the model. A solo control's un-interleaved
  trail showed it: 20 s in, right after the memoryNote_write satisfier,
  `pool-walk error (undefined is not an object (evaluating 'c.slice')) — falling back to
  single-template recovery loop`. The recovery loop tried learned compositions
  (memorynote-write-to-shell, filecontent-to-memorynote-write) that cannot compute.
- 91 such aborts since 2026-09-22 20:12:06Z (the first boot after the operator's
  shutdown), every hour since. Seven digest builders share the latent flaw:
  `try { c = JSON.stringify(imp.content) } catch { c = String(imp.content) }` — but
  JSON.stringify(undefined) returns undefined without throwing, so `c.slice` throws. All
  seven sites date from June–August; what is new since 20:12Z is an impulse with
  undefined content in the pool. Root of THAT is still open; the hardening (normalise c
  to "" at all seven sites + log the stack at the pool-walk catch) landed operator-authored
  on goal-host, and the next occurrence will name the source impulse.
- Earlier suspicion that my feedback retry displaced the suppress retry: refuted by
  counts (suppress fired 3× in the control window). Suspicion that near-miss feedback
  steered arithmetic: refuted (the failing walks never reached synthesis).
- The residue-cleanup walk (def68ff1) retired nothing — it ran on the broken instance.
  Re-dispatch after the hardened instance passes a solo product probe.

## 05:05–05:20Z — hardening verified, residue retired, product family handed back

- Hardened goal-host (875e137): 0 `pool-walk error` on the new instance (the one seen was
  the old PID). Solo product probe 421*659 reached (note body 277439) on attempt 3. Two
  further controls did not reach within 4-5 hollow verdicts — the family is no longer
  ABORTED, but still flaky: the walk writes the note before computing, and only reaches
  shellResult via suppress-retry/re-framing when the budget allows. Filed
  `a-learned-pathway-whose-head-is-a-satisfier-is-found-then-dropped-…` (goal-host;
  region = the pseudo-id refusal line; falsifier: 3 fresh product goals reach on attempt
  ≤2 with shellResult before memoryNote_write). Not hand-fixed.
- The walk's own attempt at the residue cleanup wrote its PLAN as the report note
  (pseudo-code with `{len(notes_to_retire)}` placeholders) — the counterfeit class again;
  retired. Operator data action instead, through the substrate's own new primitive:
  552 stale notes retired (0 rejected), store 1788 → 1236; invariants held — feedback 90,
  finding 297, project 282, expectation-trend 4, non-battery expectations 30. Backup
  `notes.json.pre-op-retire.*.bak`.
- Store composition now: 567 reference / 297 finding / 282 project / 90 feedback. The
  session-start recall window can no longer be displaced by battery churn.

# 07:10Z — the closure hour

Measured the operator's principle (every activity must lead into another) against the
trace store, last 24 h: 56,535 tasks, 15% declare any input; 916 of 15,700 executions
contain an intra-execution consumption; 76% of produced impulse instances are never
consumed; execution.input_impulses empty on all 150,421 rows ever. In goal-host the same
day: 6 α, 89 β, 4,280 β-WITHHELD. The graph a consistency-maintaining walk would need
does not exist in the durable record; goal-host's chain ledger knows the edges and the
satisfier trace discards them (`inputImpulseIds: []` at the synthTrace). Filed
`satisfier-traces-record-no-input-impulses-…` with region on the unique templateName
line and the 15% / 76% / 4,280 as falsifier baselines.

Plan for the hour (directed dispatch, verify by behaviour, close by measurement):
1. directed flag (rewritten with a unique two-line anchor after two no_unique_anchor
   deaths — one of them caused by my own "next to land:" instruction, which is 3×).
2. consumption edges (goal-host).
3. pathway head for the transform family (corrected to the initial pool-walk call; the
   refuters had rightly rejected a partial patch and the second draft hit a non-existent
   option on the recovery loop).
Also rewritten: lesson-writer gap with a unique 3-line anchor for `status: "open"`.

## 08:10Z — hour elapsed; state, and why it continues

Nothing new landed in the hour. Every directed dispatch reached the drafter and died at
one of three gates, each time for a nameable reason that was fed back:
- directed flag: right site, then TS2353 — `directed` is not on FeatureComposePointer;
  feature-compose reads it through a local cast. Lesson: build a widened pointer
  variable, pass the variable. Re-dispatched.
- consumption edges: TS (Set.filter, out-of-scope map), then no_unique_anchor twice —
  the planner chose `inputImpulseIds: [],` (6×) and `const synthTrace…` (not in window)
  despite unique anchors in the gap text. Redesigned as ONE insertion after the unique
  ledgerStep line, mutating the still-unpersisted trace object. Re-dispatched.
- pathway head: refuters rejected a partial patch (correct), then a non-existent option
  on the recovery loop; rewritten to the initial walk call, both halves required. Its
  second dispatch never got the slot (busy for 29 min). Re-dispatched.
Slot contention is the throughput ceiling: one autonomous compose at a time, 5–12 min
each, plus the operator lane's own retries competing because `directed` is not
forwarded — which is the first gap in this list.
The class behind two of the three: the planner ignores supplied anchors and picks the
most-repeated line in the region. That is a lane defect (already on file as
`patch-with-tools-fails-as-a-class-…`), and the reason single-op, unique-anchor gap
designs land where multi-op ones die.

## 08:47Z — directed flag LANDED (5ec4719); falsifier needs a one-slot window

- After six attempts the lane landed `directed: isDirected` inside the compose call
  (2-line diff, typecheck+shape-dispatch+tests green; cutover 08:47:58). Attempt 6 had
  been correct and was rejected by MY region literal (it named the untouched
  `isDirected` line); moving the region into the call let the same ops land.
- First falsifier run: directed POST → BUSY. Cause is contention, not the flag: both
  slot files live (cap 2), slot-1 held by a `directed: true, land: false` compose that
  did NOT come through gap_to_feature (pre-landing baseline already had 1 directed of 6).
  Directed claims can use the full cap, so two directed lanes plus one autonomous
  compose saturate it. The flag's own falsifier — a directed operator dispatch claims a
  slot while exactly ONE autonomous compose holds the other — is armed as a window
  watcher and fires automatically.
- Not closed. Closure requires that observation.

## 09:15Z — the directed flag is a chicken-and-egg, and 5ec4719 hit the wrong function

- One-slot-window falsifier (08:53:05Z, exactly one slot live, cap 2): a directed
  gap_to_feature dispatch was still refused `verdict=BUSY stage=capacity`. Reading the
  file: THREE resolveFeatureCompose calls; 5ec4719 added `directed` to the one in
  `routeCapabilityGapToNewResolver` (~3391, where `isDirected` lives), while the
  targeted `pointer.gap_id` path in `resolveGapToFeature` (starts 3463) calls compose at
  ~4142 with no flag and no `isDirected` in scope. My region literal was unique — in the
  wrong function. Fed back with `regressed_by: 5ec4719`, the correct function, and a
  unique anchor inside the right literal (the spread line I first chose occurs twice).
- Deadlock: the lane's event-driven pickups reclaim a released slot within seconds; my
  15 s polls lost every race for 18 minutes (60+ refusals), and they lose BECAUSE the
  targeted path still counts as autonomous — the defect under repair. Broke it the way
  goal-host does: POST feature_compose directly with `directed: true` (feature-compose
  honours the flag today), same gap payload, land: true. This is the byte-exact operator
  lane; the drafter and every gate still do the work.

## 09:26Z — the directed fix was correct, applied at 4149–4150, and thrown away by a lease

Direct feature_compose (directed: true) took the reserved slot as designed (compose
fc-mudw1ti7, `directed=true`, second slot while an autonomous compose held the first),
grounded on the right region, applied the change at lines 4149–4150 inside
resolveGapToFeature, and the semantic gate wrote: "adds the directed property to the
correct resolveFeatureCompose call inside resolveGapToFeature". Then:
`DEFERRED: change_window lease held by trace-store-reconcile after waiting 90000ms` →
verdict UNFAVORABLE → rolled back → nothing staged. Last 3 h fleet-wide: 97 DEFERRED vs
153 FAVORABLE — 39% of verified landings discarded and re-drafted. The holder is the
trace-store DB-maintenance activity (5-min TTL, dispatched in bursts for the
trace-store-cap gap class). Filed `a-verified-patch-is-rolled-back-when-the-change-
window-lease-is-held-…` (cutover must keep the verified patch and re-run only the
landing step when the lease frees). Re-dispatch of the directed fix is armed to fire the
moment the lease is free and a slot is open.

Is this the "provable architectural design flaw" stopping condition? Not yet. A single
fleet change window serialising DB maintenance against code landings is a defensible
design; discarding verified work on contention and letting a five-minute maintenance
lease be re-acquired in bursts are implementation choices with filed, bounded fixes.
- Cross-reference: the root side was already filed at 08:33Z by another operator session,
  `a-failing-trace-store-reconcile-re-takes-the-single-global-change-window-faster-than-
  its-ttl-so-cutovers-defer-forty-five-times-in-ninety-minutes` (edit_site
  seed/trace-store-reconcile.ts): change_window is a single global mutex with no name
  dimension; a failing reconcile re-acquires it continuously (holder continuous 08:04–
  08:16, longer than its 5-min TTL). My gap is the downstream half (cutover must not
  discard verified work on a held window). Together they describe the landing
  bottleneck: one lock shared by maintenance and code landings, no persistence of
  verified state across contention, and event-driven pickups that out-race any operator
  poll for the released slot.

## 09:31–09:36Z — the window opened onto a draining process; the drain came from a hand-written drop-in

- 09:31:34Z the lease-free/one-slot window opened and the direct `feature_compose` (directed:true) POST returned `{"error":"draining"}`. `/health` kept reporting `status:ok` throughout, so a health-gated dispatcher cannot see a drain; only the resolve route refuses. **Health lies during drain — gate on the refusal, not on `/health`.**
- Cause of the drain: `systemd Reloading.` at 09:31:33 immediately after `/etc/systemd/system/development-vessel.service.d/cutover-lease-wait.conf` (mtime 09:31:33.865) appeared, containing `Environment=CUTOVER_LEASE_WAIT_MS=330000`. No source under `/vessels/*/src` or `scripts/` writes that file; two other operator session transcripts were active in the same minutes. This was an operator restart from a concurrent session, not a substrate cutover. It is also env-gated behaviour (law 1): the lease wait moved from 90 s to 330 s in a place no trace or walk can observe.
- Cost of that restart: the vessel sat in `stop-sigterm` for the full 240 s drain budget (`drain deadline — 0 authoring run(s) and 1 long-running request(s) still in flight; they will be lost`), and ten timer units (`gap-compose`, `goal-host-behavior`, `autonomy-metrics`, `runtime-drift`, `trace-store-health-check`, `efficiency-failure-tick`, `db-contention-check`, `obsidian-*`) queued behind the restart job because they are ordered `After=development-vessel.service`. Every dev-vessel restart therefore stalls the whole autonomous tick fleet for up to 4 minutes. Filed as an observation; a restart of one vessel should not gate unrelated timers.
- 09:35:34Z new PID 57513; 09:35:52Z the retried direct compose was admitted: `composeId fc-mudwr2nj-ydw2ps`, gap `gap-to-feature-drops-the-directed-flag…`, `directed: true`. Autonomous picks were refused (`REFUSING autonomous compose: 1 in flight`) while it ran — the reserved-slot behaviour, observed on the direct lane. The gap is about making the *gap_to_feature* lane show the same behaviour.

## 09:43–09:47Z — directed flag landed at the correct site; negative control passes; positive probe armed

- `112e194` (substrate-authored, pushed 09:43Z) inserts `directed: (pointer as { directed?: boolean }).directed === true,` at line 4147, inside `resolveGapToFeature` (function begins line 3463) — the call the gap named. The earlier `5ec4719` had put the flag in `routeCapabilityGapToNewResolver` instead. What made the difference: the region literal moved onto a unique comment line inside the real call, and the design became a one-op inline insert (no `isDirected` variable to leave unused). Cutover verdict FAVORABLE, cited typecheck + shape-dispatch + baseline-delta tests.
- **Negative control (old process, PID 57513, source predates the landing):** with exactly one compose in flight, a directed `gap_to_feature` POST returned `verdict:BUSY stage:capacity`. So the probe discriminates; a green here after the restart is meaningful.
- The new code is not yet running: the landing scheduled `mitosis-self-restart-development-vessel-fc-2026-09-23T09-42-29-270Z`, which waits for `/health in_flight == 0` (up to 16 min) before `systemctl restart`. The other operator session's directed compose holds the one slot, so the restart waits on it.
- Armed: once the PID changes, POST directed `gap_to_feature` for the consumption-edge gap (admitted at 0 in flight, not discriminating), then 25 s later a directed POST for the pathway-head gap with that first compose in flight. Pass = second POST admitted (journal shows `directed: true` for it) while autonomous picks still log `REFUSING autonomous compose`. Fail = BUSY again. Both POSTs are real work on the two queued goal-host gaps, not throwaway probes.

## 09:53–09:58Z — directed-flag gap CLOSED by measurement

- Restart onto the new code came at 09:53:09Z (PID 314864, live tree `2f2ba0f`, which also carries the other session's anchor-provenance fix in `feature-compose.ts`).
- 09:53:16Z an autonomous compose (`route-edit-788557e8`, `directed: false`) took the first slot. 09:53:31Z my directed `gap_to_feature` POST for the consumption-edge gap was **admitted** as `fc-mudxdsc4`, `directed: true`, with one compose in flight — the exact condition that returned BUSY on the old process at 09:46Z. A further directed POST at two in flight was refused with a new log line, `REFUSING DIRECTED compose: 2 in flight`, so the flag reaches the cap check and the full cap still binds. Autonomous picks at one in flight kept logging `REFUSING autonomous compose`.
- Closing it took two writes. The first, which omitted metadata keys to delete them and omitted category/source/summary, returned `action:updated` yet the store stayed open with the old keys: `substrateGap_write` carries forward every existing metadata key the incoming row omits (`if (!(k in inMeta)) inMeta[k] = exMeta[k]`), so a key is deleted only by writing it as `null`. The second write set `regressed_by`, `pending_outcome_verification`, `pending_set_at` and `verify_failure_reason` to null, added `attempt_landed_2` (falsifier PASSED with the timeline), `falsifier_exercise.passed=true`, `closed_reason=landed_verified`, `close_basis=operator_exercised_falsifier`, and status closed. Store re-read at +2 s, +22 s, +62 s: closed, `closed_at 09:57:33Z`, `reopen_count 0`, unchanged through one more background write.
- **Write churn found while closing.** In 15 minutes this one open row received 68 writes from `[gap-falsifier] updated … falsifier=none` and 33 from `[gap-to-feature] non-attempt … clearing cooldown`; fleet-wide the gap event bus carried 444 publishes in 5 minutes. Each write triggers the event-driven pickup; the pickup hits BUSY and writes "clearing cooldown"; that write re-triggers the falsifier classifier, which rewrites an unchanged classification. A writer that writes on a non-attempt feeds the trigger it is answering. Filed separately.

**Correction to the churn paragraph above:** `[gap-falsifier] updated <id>` is the log line `substrateGap_write` prints for every write it applies (`substrate-gap.ts:1090`), not a separate classifier loop, and every line in that journal is duplicated. Deduplicated: ~34 writes on the row in 15 minutes, matching the 33 `non-attempt … clearing cooldown` writes. The loop is therefore one path: gap write → event-driven pickup → `compose-cap` BUSY → non-attempt write "clearing cooldown" → gap write → pickup … paced only by the ~25 s backoff. A non-attempt should not write the row, or a write from the non-attempt path should not re-arm the pickup.
