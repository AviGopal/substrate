# Causal attempt ledger — finish line (pre-registered)

Change: `openspec/changes/causal-attempt-ledger/`. Registered before any task landed.
"Consistent" is defined here and nowhere else; the run is judged against this file, not
against dispatch statuses.

## Fixtures

- **Canary check.** `baselineCheckSet` contains a check `ledger_canary` that reads
  `repos/development-vessel/src/fixtures/attempt-ledger-canary.json` from the live runtime
  tree and passes iff `{"canary":"intact"}`. It exists so a landing can cause a real,
  harmless regression that a baseline check detects.
- **Seeded regression (R).** A registered landing through the cutover that changes the
  canary value, with a prediction that names no check expected to change.
- **Clean change (C).** A registered landing through the cutover that changes only a
  comment in the same fixtures directory, predicting no check change.
- **Unaccounted shell commit (U).** A walk whose tool fallback commits to a scratch branch
  through a shell resolver, with no registered attempt.

## One acceptance run passes iff all hold (read from the ledger, not from dispatch status)

1. R has an `attemptIntent` whose pre-snapshot timestamp precedes its commit, and whose
   `authoring_execution_id` resolves to an `execution` row.
2. R's `attemptOutcome` lists `ledger_canary` in `unexpected_flips` with `surprise: true`.
3. R settles `regressed`; no template is extracted from R's authoring execution.
4. R's lesson appears in the targeted gap's `failure_lessons` and in the canary file's
   compose lessons.
5. C's outcome has no unexpected flips; C settles `held`.
6. Re-running the settle sweep over R and C produces no second settlement event for either.
7. U is recorded `unaccounted` with its sha and the walk's execution id, and a gap naming
   U's sha exists with no operator action.
8. Every check verdict is one of the five values; no baseline check reports `pass` while
   its upstream errored.

Between runs the canary is restored by a registered landing (which itself must settle
`held` against the restored value).

## "Consistent"

Three consecutive acceptance runs pass. The third runs after the container is recreated
from a rebuilt image on the same volume (cold boot); it must also show the ledger records
from runs 1 and 2 intact. After the cold boot: the org is unchanged
(`organizations:substrate`) and `http://syzygy.host:18100/health` answers 200 from inside
the container.

## Known confounds, recorded before the run

- `bootstrap-seeder.service` fails on the warm volume: its 19 templates are refused
  because `activity.learning_track` is required and the templates do not set it. This is
  independent of this change.
- The dev seed unit was ordered only after `development-vessel.service`; it now also
  orders after `identity-seeder.service`. Template counts before and after the cold boot
  are recorded so a loss is attributed, not absorbed.

## Baselines recorded before the first task landed

- Activity templates in activity-api: 3991 (`SELECT count() FROM activity GROUP ALL`).
- Vessel push clones, `origin/dev`, prior 7 days: 149 commits, 89 carrying cutover
  provenance (`Mitosis:` trailer), 60 without — the population the unaccounted-landing
  detector must account for.

## Amendments recorded before the first acceptance run

Each is a correction found while building, written down before any run is graded.

- **Item 1 join.** An edit-intent landing's authoring execution is identified by its
  goal-host dispatch id (the only id that exists before the compose finishes). It
  "resolves to an execution row" through the dispatch record:
  `GET goal-host /executions/<dispatch_id>` → `executionId` → `execution:<executionId>`.
  Verified for `f25db62`: dispatch `aa450d1d…` → `exec_1790149668010_8qt9fd5e7nt`, row present.
- **Item 3 restated (was vacuous).** Measured: compose landings never reach
  `mintReachedTrace` (0 `route-edit` mint decisions in 6 h); every mint call site is a walk
  path. "No template is extracted from R" would therefore pass for R and C alike. Item 3
  becomes: **the walk execution that made U is not extracted, and goal-host's mint log
  records the deferral with the landing's sha** — U is a walk reach, so the mint path is
  genuinely reached and the guard must genuinely fire. That landing crystallization is
  disconnected on the compose path is recorded as an open gap, not claimed as a pass.
- **Settle window.** `policy/settlementPolicy.json` = `{"window_ms": 120000}` for all three
  runs (set by the operator; data, not source).
- **Fixture C redefined (before any graded run).** A new `src/fixtures/README.md` holding
  only a counter was refused ~70 times by the semantic judge as purposeless, and each
  rejected draft left an orphan copy in the live tree (GAPS_OBSERVED #27). C is now: increment
  a `runs` field in `attempt-ledger-canary.json`, which the `ledger_canary` check ignores. C
  still changes no check verdict, so item 5 (no unexpected flips, settles `held`) is unchanged.
  It edits a check-definition file, so its outcome carries `surprise: true` via
  `edits_check_definition`; item 5 grades flips and settlement, not surprise.
- **Involuntary cold boot between runs 1 and 2.** The container was removed by another session
  (GAPS_OBSERVED #28) and recreated from a rebuilt image on the same volumes. This is the
  cold boot the finish line calls for, and it came earlier than planned. Durability is graded by
  run 1's ledger records (`att-muetz6it-x79viq9`) surviving, and by the hooks and lease wait
  coming from the image. To keep the letter of "third run after a cold boot", run 4 is preceded
  by a second deliberate cold boot.
- **Config change: `COMPOSE_MAX_CONCURRENT=3`** (development-vessel drop-in `compose-cap.conf`,
  2026-09-24T08:43Z). The execution-id fix was refused `BUSY` 18 of 22 times over an hour because
  autonomous directed composes held both slots of the default cap of 2. Host headroom: load 7 on 16
  cores, 30 GB free. It is applied at a moment when no compose slot is held, so no in-flight compose
  is killed. This is a live-only drop-in: the cold boot before the final run is a container restart,
  not a recreate, so the drop-in survives it.
- **Amendment 2 — item 7 grades every U commit, and "linked" is defined (before run 6).** Items 7
  and 3' failed in runs 4 and 5, and an off-lane pre-check (U dispatch `45196b00`) showed why the
  old wording could not be graded honestly: one U goal produced several commits (the reach judge
  called an attempt hollow and the walk retried with side effects, GAPS_OBSERVED #46), and the
  grader read only HEAD. Item 7 now reads: **every commit on the U scratch repo since U's dispatch
  started has a landing event recorded `unaccounted` with its sha, carries an execution id that is
  either the dispatch id or an execution linked to it, and is named by an open gap.** An execution
  is *linked* when its trace-store row has `dispatch_id` or `parent_execution_id` equal to the
  dispatch id, or a tag `dispatch:<dispatch id>`. The tag is the mechanism because a walk's first
  template run takes its parent from the caller's `parentExecutionId`, which is undefined for
  `/run-goal`; setting the dispatch id there would point `parent_execution_id` at a row that is not an
  execution. This is stricter than the original, which a single correctly stamped HEAD could satisfy
  while earlier commits went unlinked. Approved by the user in the Documentation self-management
  session.
- **Amendment 2 — item 3' covers both reach paths (before run 6).** The restated 3' above assumed
  U is a walk reach, so the mint path is genuinely reached. The pre-check showed U reaching through
  a single satisfier, and goal-host skips `mintReachedTrace` for single-satisfier reaches by design
  (`satisfierOnly`), so no extraction is attempted and no deferral can be logged. Item 3' now reads:
  **no template is extracted from any of U's executions** (ribosome shows no `extraction ALLOWED` for
  them); **if a mint was attempted for U, goal-host's `reach->mint: DEFER landing` line naming U's
  dispatch and sha is also required**; and **if U reached through a single satisfier (dispatch
  `executionId` `walk-satisfier-*`), the run report says "no mint path ran (single-satisfier reach)"
  explicitly**, never by silence. A walk reach with no mint line at all fails. Approved by the user
  in the Documentation self-management session. The operator's recommendation was to make U
  exercise the mint path; the amendment accepts the single-satisfier branch as long as it is named.
- **Harness fixes after run 6 (grading criteria unchanged).** Run 6 failed (3/10), so the three consecutive
  runs are now 7, 8 and 9, with 9 after the cold boot. (1) The harness guard against walk-fallback bloat in
  the super-repo worktree copy of the canary stopped R, restore and C on a staged one-line draft; it now stops
  only when that copy grows by more than 20 added lines, which is the size of the class it exists for. (2) The
  item-7 ledger wait (poll up to 15 min for every U commit's landing event and gap) had been placed in item 6's
  section, where it ran before U existed; it now runs in the U section. (3) `run-task.sh` retries a dispatch whose
  compose was verified and parked (reported as "no failure detail in compose report", GAPS_OBSERVED #49) with
  identical text, which resumes the park. The runtime check before each run also requires the vessel process to
  have started after its source file was last written, not just file = clone (a restart racing a rollback loaded
  an uncommitted draft once, GAPS_OBSERVED #50).
- **Amendment 3 — item 3' covers floor reaches (effective from run 9; written during run 8, so run 8 is
  graded under Amendment 2).** Pre-check 4 (U `2435b599`) reached through the universal-tool-fallback floor
  (`executionId` `universal-tool-fallback-*`). Floor reaches never call `mintReachedTrace`; their only learning
  write is `recordGoalPath(goal, ["universal-tool-fallback"], true, …)`. Item 3' now also passes on a floor reach
  when no template is extracted from U's executions, the report states "no mint path ran (universal-tool-fallback
  reach; floor reaches only call recordGoalPath)", **and** goal-host logs that `recordGoalPath` withheld the reached
  path for U's dispatch because the dispatch has an unaccounted landing (the deferral the guard exists for,
  applied to the floor's only learning write). A floor reach without that line fails. Approved by the user in the Documentation self-management
  session (answer at about 02:15Z on 09-25: "Extend, and make recordGoalPath honor the deferral"), the stricter
  option over accepting the floor branch on the report sentence alone; confirmed by the user in this session
  ("Yes to floor exemption"). The user also chose to cap retries of side-effecting goals (GAPS_OBSERVED #46,
  option B), landed through goal-host before run 9; it changes substrate behaviour, not the criteria.
- **Amendment 4 — item 1b reads its criterion literally (effective from run 9).** Item 1 says R's
  `authoring_execution_id` "resolves to an `execution` row". The grader used to treat that id as a goal-host
  dispatch and follow it to the dispatch record's `executionId`; run 8 showed that hop breaks when a compose
  outlives its dispatch (GAPS_OBSERVED #53: the dispatch record names a rejected placeholder while the landing is
  real). From run 9 the grader reads R's `authoring_execution_id` from its settlement (which the ledger fills from the
  compose's own execution once that row exists), else from the intent, checks that id itself against the `execution`
  table and passes when the row exists; the dispatch hop remains as a fallback. The substrate change that makes the direct join true (the landing's
  attempt names the compose's own execution, keeping the dispatch in a separate field) is being landed through the
  substrate; until it is live, 1b still depends on the fallback.

## Confound from run 10 (second attempt, from 09:55Z 09-25)
Runs from here on use a different activity selection than runs 1–9. activity-api 53d8e77 (score reads) makes selection read learned
posteriors (the legacy read returns 406 rows; it returned 0 before), and the shape-conditioned path is active. Machine fixes that
landed in the same stop: b56623a (duplicate-first trace insert), 9387ca7 (no scheduled FTS rebuild), bf3f0bf (dense in-process),
and development-vessel cbdb432 (aggregate gap written only on a new sha). The first run-10 attempt (07:15Z) is void; see
RUN10-VOID-0715.md. The pass count restarts at run 10.

## Operator action before run 11 (12:18Z 09-25)
pull-sync mirrored development-vessel f3f1afe at 11:58:02 and deferred its restart (2 autonomous composes in flight). The
restart stayed owed, and would be taken once the oldest in-flight request passed its 900 s ceiling, possibly mid-run (the
mechanism that voided the first run-10 attempt, gap #56). The vessel never went idle, so master26 could not start run 11. I took the
owed restart at 12:18:01 (`vessel-ctl restart development-vessel`; 2 autonomous requests parked or re-picked) and removed the
now-satisfied `/workspace/.pull-sync/development-vessel.restart-pending` and `.restart-deferrals` (backup in
`/workspace/backups/pull-sync-owed-2026-09-25T1219/`). One change: the restart pull-sync already owed, taken before the run instead
of during it.

## Sequence reset after run 11's void (12:40Z 09-25)
The first run 11 was voided by an autonomous goal-host landing (8c31cdb, a global-fetch shim; see RUN11-VOID-1220.md), reverted by
a traced compose (goal-host 6ce1446, live at 12:36:13). Strict reading: the count restarts. The 09:55 run-10 pass is kept as
RUN10-PASS-0955.md; the next graded run is numbered run 10 again.

## Operator stopgap: gap-compose masked during graded windows (from 12:37:52Z 09-25)
The autonomous gap-compose lane (gap-compose.service; 444 starts in the 3 h before, from its timer and from event-driven starts on
every gap write) landed goal-host 8c31cdb inside run 11's window and voided it. No shaped window/lease exists that it reads (gap #59;
the coordinator's held gap). Stopgap, suggested by the coordinator: `systemctl mask --runtime gap-compose.service` while a graded run
holds the window, unmasked (and its timer restarted) between runs. `~/.cache/causal-attempt-ledger-harness/mask-keeper.sh` holds
the mask while `MASK` exists and re-applies it after the cold boot (a runtime mask does not survive a restart); every transition is
logged with a timestamp. Masked 12:37:52Z, before the third run-10 attempt started. Runs 10–12 all run with the lane masked.
Boredom-vessel is not stopped.

## Stopgap widened mid-run 11 (14:23Z 09-25)
Two goal-host landings inside run 11's window despite the gap-compose mask: 91c042b (13:58:38; gap-to-feature pick run in-process by
the boredom selector) and 4f1d3e8 (14:13:25; boredom ran dispatch-latest-auto-draft, whose "investigate and decompose" goal named
goal-host src/index.ts and was turned into an edit by EARLY EDIT-INTENT; it removes the posterior_source !== "stored" guard, a
selection change). goal-host restarted onto both at 14:15:34, mid-run 11; they are confounds for runs 11 and 12. From now on
mask-keeper2.sh also stops boredom-vessel.timer, boredom-vessel.service and funnel-drain.timer while MASK exists, and restarts
the timers at release. 4f1d3e8 is to be reviewed after run 12 (coordinator: revert as a pre-validated exact edit if the review can't
state what it fixes).

## State before the fourth run-10 attempt (~16:05Z 09-25)
Landed in the break after run 11's failure (diffs reviewed): development-vessel 429c8bd (scan made linear; 13–14 s → 0.03 s),
d2555d8 (localizeGap tries suspected_real_location first; coordinator), 51e30de then 21179d8 (the ownership session's gap-store
forwarding was overwritten by an autonomous recommit that adds a no_unique_anchor early return in classifyFalsifier; not on a graded
path); goal-host 7c70178 (DEFER/WITHHELD list every unaccounted sha of the dispatch), e0959ea (pinned-target pre-admission refusals are
recorded as completed/unreached; autonomous; benign). Frozen ledger files: attempt-register cbdb432, attempt-checks a4923f2. The
super-repo goal-host copy was re-synced from 8c31cdb (shim) to e0959ea; the super-repo gitlink is still pinned at 8c31cdb (reported
to the coordinator).

## State before the fifth run-10 attempt (18:34Z 09-25)
Landed and reviewed in the break after run 10 (fourth attempt) failed: goal-host 2f6436f (author_producer carries the dispatch id)
and development-vessel d72654f (the validation test pointer carries it), the fix for the id-less bridge-author validation commits;
local-tools 6687919 (logs shell requests without an id); development-vessel 516bc18 (the ownership fork's gap-store forwarding,
re-landed); development-vessel 128f51f + 15bb263 (the coordinator's `autonomous_pick` maintenanceLease gate on gap_to_feature's
auto-pick branch; a duplicate re-apply, 31d07cd, was removed; clone = runtime = process with one block; both falsifier halves
observed). The graded-window stopgap is now mask-keeper3.sh: it holds the autonomous_pick lease (acquired 18:33:19 as
ledger-graded-run, renewed every 20 min), keeps gap-compose masked, and keeps boredom and funnel-drain stopped. The frozen ledger
files are unchanged (attempt-register cbdb432, attempt-checks a4923f2; unaccounted-landing-scan 429c8bd).

## State before the sixth run-10 attempt (~20:05Z 09-25)
Landed in the break, diffs reviewed: development-vessel 390202d (author-producer probe snapshot/restore maps repos/X to /vessels/X,
the fix for run 10's fifth-attempt item-5 failure), eb62676 (the ownership fork's forwardToGapStore read hook, a no-op without
GAP_STORE_ENDPOINT), 70d2a00 (autonomous, after the lease was released: the landing gate now asks resolver changes for a cited
execution trace id; the graded fixtures edit src/fixtures, not resolvers), and afea8de (19:21, after run 10 ended: C's goal
route-edit-2fede0c8 landed a second time, runs 1→2; the duplicate-landing class, #50). The canary is consistent between live and
clone ({"canary":"intact","runs":2}). The super-repo development-vessel copy was cleaned (diff backed up) and synced to 70d2a00.
- In-window landing (run 10, sixth attempt): development-vessel 768ae7c (20:08:05, gap-to-feature.ts +24, a picker class-key change)
  from an auto-pick at 19:59:45, before the lease was taken at 20:02:13; the lease stops new picks, not composes already in flight.
  From now on, a run opens only once development-vessel reports in_flight == 0 after the lease is acquired.

## State before the seventh run-10 attempt (21:03Z 09-25)
Landed in the break, diffs reviewed: development-vessel 3756d4d (a parked landing keeps its pre-cutover attempt_id; a resume reuses it
and carries the resuming dispatch's id), goal-host 5a4ef1a + 4dec1bc (the coordinator's fix: an anchor-failure escalation to
patch_with_tools is skipped only when this goal's route-edit commit is the file's latest commit on origin/dev; fixes duplicate
landings like 31d07cd and afea8de). The lease was re-taken at 20:55:22; development-vessel in_flight reached 0 at 21:02:28, before GO.

## Cold boot (22:34:46Z 09-25), before run 12
`docker restart substrate-live` (no recreate). Up at 22:35:31, with COMPOSE_MAX_CONCURRENT=3 intact. keeper3 re-applied the gap-compose
mask and the timer stops, and the autonomous_pick lease survived (held by ledger-graded-run until 23:15:53, renewed by the keeper).
Known boot-order defect recurred and was deliberately NOT hand-repaired: goal-host started 22:35:16, development-vessel 22:35:24,
and goal-host logged `failed to register dev-vessel proxies: Unable to connect` at 22:35:17 (the ownership session flagged it from the
08:26 boot). Run 12 runs on the system exactly as the plain restart left it.
- Harness defect, fixed by hand: master26 left `HOLD` in place after the cold boot (it's set before the reboot, and only gate() clears
  it; there's no gate before run 12), so run-graded-next.sh 12 waited from 22:38:35 without dispatching anything. HOLD removed at
  23:03:43Z; nothing had been dispatched, and the post-boot state (lease, mask, the unrepaired proxy registration) is unchanged.

## State before the next streak (~00:40Z 09-26)
Landed and reviewed since run 12: goal-host 959519e (the floor carries the dispatch id explicitly via run(); logs `[uf] tool call
WITHOUT dispatch id`), development-vessel d4456d9 + 829f613 (author_composed_capability's probe carries the delegating compose's
execution id), d0e9e82 (autonomous, a scratch-variable scope change in the same file; the id fix survives). The driver is now
master27 (clears HOLD after the cold boot). The frozen ledger files are unchanged (cbdb432, a4923f2). Item 3' is graded strictly (an
unreached U fails) pending the user's call.

## State before the next streak (~03:00Z 09-26)
New since the last streak: goal-host 44a5efa (the post-walk EDIT-INTENT route skips a second compose when this goal's route-edit commit is
still the file's latest change; landed byte-equal to the pre-validated, tsc-clean file). The harness is master28 (a run opens only when
goal-host in_flight == 0 as well, so no earlier fixture dispatch is still walking) plus run-task-next retrying a fixture's
semantic-gate rollback (UNFAVORABLE). Run 10 of the previous streak passed (RUN10-PASS-0050.md); run 11 was stopped (RUN11-FAIL-0203.md).

## Cold boot (04:30:00Z 09-26), before run 12 of the master28 streak
`docker restart substrate-live` (no recreate); up at 04:30:32 with COMPOSE_MAX_CONCURRENT=3 intact; keeper3 re-applied the gap-compose
mask and the timer stops; the autonomous_pick lease survived (ledger-graded-run, expires 05:14:37, renewed by keeper3). The boot-order
defect recurred and was NOT hand-repaired: goal-host started 04:30:23, development-vessel 04:30:27, and goal-host logged
`failed to register dev-vessel proxies`. Run 12 runs on the system exactly as the plain restart left it.

## RESULT: CONSISTENT (05:10:18Z 09-26)
Three consecutive graded runs passed 10/10 under the unchanged rubric (strict 3′), the third after a cold boot:
- run 10: 03:06:35 → 03:46:13, 10/10 (RUN10-PASS-0306.md)
- run 11: 03:46:59 → 04:29:19, 10/10 (RUN11-PASS-0346.md)
- cold boot: `docker restart substrate-live` at 04:30:00 (no recreate; up 04:30:32; the goal-host proxy-registration boot-order defect recurred and was deliberately not repaired)
- run 12: 04:33:39 → 05:10:18, 10/10 (RUN12-PASS-0433.md)
Every item passed directly in all three runs. U reached via the floor each time, with 2/2 commits linked and recordGoalPath withholding U's path.
Same ledger code throughout (attempt-register cbdb432, attempt-checks a4923f2). Org organizations:substrate; syzygy.host discovery peering unchanged.
Operator stopgaps in force during the streak (released at the end): the autonomous_pick lease, the gap-compose runtime mask, and
boredom/funnel-drain stopped. Their proper replacement is the window/lease gap (#59).

## Amendment 5 (09-26, after the CONSISTENT streak): item 3′ when U does not reach
User ruling, RELAYED via the coordinator session: an UNREACHED U means the mint guard was "not exercised", and a run that never
exercised it cannot certify it, so item 3′ does not pass. The grader already scored this case as non-passing, so only the verdict text
changes: when U's dispatch reports `reached= False`, item 3′ now reads "not exercised (U did not reach)" instead of "guard silent on a walk
reach". This doesn't affect the CONSISTENT result: U reached in all three passing runs.
