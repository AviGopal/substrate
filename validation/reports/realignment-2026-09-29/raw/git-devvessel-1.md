# git-devvessel-1 — development-vessel git history, 2026-05-21 → 2026-08-15

Source: live clone `substrate-live:/workspace/git/vessels/development-vessel`, `git log --until=2026-08-15`.
Read-only. Everything below is from commit subjects/bodies/diffstats plus a small number of
read-only SurrealDB counts (hub store `execution` table, last 7 days as of 2026-09-28) used only to
say whether a June/July mechanism is still firing today.

## Coverage

- 1521 commits in window (05: 101, 06: 361, 07: 700, 08-01..15: 359).
- Authors: Substrate Autonomous 831, DevBob Assistant 663, Devbob Agent 16, substrate-live 9, other 2.
- 837 commits are `substrate-authored: apply …` (mitosis cutover landings); 684 are operator-style.
- All 684 operator-style subjects were read. Bodies were read for ~70 of them: every revert plus the
  commits that make load-bearing claims. For the 837 autonomous commits I read aggregate stats: gap
  tags, the files they touched, whether they were comment-only, and when they landed. I read a sample
  of diffs, not every one.
- `git log -S` was run on the recurring identifiers `-narrowed`, `recommit-`, `failed_attempts`,
  `boredom_target_template`, `LLM_ENDPOINT`, `mitosis-pending.json`, `skip_tests`,
  `REUSE_BEFORE_MINT`, `reachable_unlearned_probe`, `prior_failed_attempts`,
  `landedCommitVerdict`, `shaWasRevertedInAnyClone` and `/workspace/gaps/gaps.json`.
- Resolver adds/removals were read with `--diff-filter=A/D` on src/resolvers, src/observers and
  src/maintenance. Current reference counts are for HEAD (today), not for 08-15.
- NOT covered: individual diffs of most autonomous commits, test/ tree history, and anything after
  08-15. Some later commits are named only where they complete an in-window story.

## Headline numbers

| measure | value |
|---|---|
| substrate-authored landings | 837 (05: 6, 06: 125, 07: 559, 08 ≤15th: 182) |
| of those tagged `Gap: unknown-gap` (no gap id at all) | 239 |
| tagged `Gap: route-edit-<hash>` (ephemeral per-goal ids, not durable gaps) | 346 |
| tagged with the single gap `pwt-development-vessel-feature-compose.ts[-X]` | 70 (50 of them on 08-01..08-02) |
| substrate-authored commits whose .ts diff is comment/blank-only | 108 / 872 (12%) |
| autonomous edits to `src/resolvers/feature-compose.ts` (the drafter, which edits itself) | 192 |
| autonomous edits to `src/resolvers/dispatch-goal.ts` (mostly 1–9-line additive comment churn, 06-18..07-12) | 87 |
| autonomous edits to `src/config.ts` (32 are one-line allowlist inserts for "Seam ③" resolvers) | 83 |
| revert commits | 29 (the substrate reverted itself 4 times; the operator reverted substrate work ≥12 times; the operator reverted own work 5 times) |
| resolver/observer/maintenance files added | 259 (DevBob 179, Substrate 80) |
| resolver files deleted in window | 8 (rubric-echo, self-update-report, concept-naming-sync, obsidian-assist-bridge, summary-of-clock-vessel-functionality, shell-result [revert], reachable-unlearned-probe [revert], compose-cap.test) |
| recommit chain depth observed in gap ids | 13 (`recommit-`×13 `route-edit-X-semantic_reject`×13) |

Live-today check (hub `execution` table, last 7d): June/July tick mechanisms still dominate the trace
volume. `gap-to-scenario-bridge-tick` ran 17,969 times (99.9% "success"), `mitosis-tick` 7,874 (89%),
`dispatch-latest-auto-draft` 1,711, and the July-17 gap-closing template
`gap-closing:pull-sync-unhealthy-activity-api-1784251158497` 1,490. Templates prefixed
`development-vessel:detect-*` ran 1,948 times and June-era `proposed_pattern_authored_*` templates
ran 1,554 times. Meanwhile `feature_compose` ran 1,949 times with 382 ok (19.6%) at $30.87.
Tick "success" measures that the tick ran, not that it produced anything. These are live fossils:
still consuming cycles and trace-store growth.

---

## By problem class

### hollow-landing (inert, check-satisfying or vacuous commits)

The recurrence: each new "hollow" gate names one surface form. The next hollow landing wears a
different form. Nine or more distinct gates in 7 weeks:

- 06-29 `f960423` functional-completeness gate (reject wired-stub new capabilities). Next day
  `c319dfb`: the stub-gate had to strip comments and strings to stop blocking refactor moves.
- 07-25 `33b7d9e` semantic gate hard-fails effect-less header-only edits.
- 07-28 `3641a1b` catch constant-return stubs on the autonomous landing path.
- 07-31 `1b5e7c9` deterministic zero-behaviour-delta hard-fail (hollow-stub gate).
- 08-10 `4ea5234` refuse a plan whose every edit adds only unused bindings. The same day `dcff64c`
  says a TYPE-ONLY edit cannot be the requested change.
- 08-11 `7e378de` diagnostic-only edit is not a change. `671ce88` refuses an assignment the
  next statement erases, and `3686670` handles a self-call bound to a local first.
- 08-12 `06fabe9`: "the dead-store gate was inert because it was fed the op, not the file". The new
  gate was itself hollow on arrival.
- Instance: `bff3347` (substrate) added `console.log('isInert called with:', line)` inside the
  vacuous-edit gate to "make a concrete, verifiable change". Reverted in `11587fd` (08-11). The first
  root-cause explanation was wrong and was corrected in `2500b30`: "the gate fired, an override waved
  it through".
- Hollow mints (Seam ③ net-new resolver authoring, `5e2dbe7` 06-19): 70 resolver files were added by
  Substrate in July. Examples: `human-input.ts` fetches `DISCOVERY_ENDPOINT ?? http://localhost:8765`
  `/v2/notes`, a route and port that exist nowhere. `error.ts` fetched `:3173/v1/traces`, which never
  existed; it was repaired only on 08-29 (`9a33df2`). `goal-summary.ts` and `substantive-findings.ts`
  are 160–215-line capgap mints with hardcoded `127.0.0.1:8080/8090`. Today 60+ of them have exactly
  one in-tree reference (the dispatch table), and `git-head-commit.ts` and `spliceability.ts` have 0.
- Comment churn: 108 autonomous commits (12%) change only comments. `dispatch-goal.ts` received 87
  autonomous edits, e.g. `3071c26` rewrote the MAX_GOAL_LEN comment under `Gap: unknown-gap`.
- Metric hollowness in the same class. `83f3adc` (08-09): coverage-tick counted the TEMPLATE'S
  DECLARED shapes as learned: "an advertisement laundered into a demonstration". A maintenance
  activity was dispatched 36× while its metric never moved.

Outcome: partial. Each gate works for its form, and the class is still open. Memory (09-15)
records the `hollow_write` class as still sealing gaps.

### false-verification (false closes, wrong predicates, unmeasurable gaps)

This is the densest recurrence in the shard. The same confusion, "presence in history = outcome",
was fixed five times on one day and again a week later:

1. 07-09 `de9be66` adds "Class 3" pick-time evidence: a substrate-authored commit mentioning the gap id
   closes the gap as already_resolved. It is async-only, so `370a88c` copies it into the sync variant
   (the first duplication).
2. 07-30 `ff04a17` adds a pending-land sweep (`git merge-base --is-ancestor`). 07-31 `0bd32ff` gates the
   land-credit stamp on behavioural verification: "verification_outcome had 1 writer, 0 readers"
   (write-read-mismatch), so FAILED verification was still credited.
3. 08-07 `77cf692`: a reverted land is not a land (ancestor check cannot see `git revert`). `271228e`
   "match a rewritten revert message, and correct a false claim in 77cf692". `d719fee` makes a reopened
   gap trigger a pickup. `018fd05` "third instance": Class 3 matched the REVERT ITSELF. `81d8474`
   "fourth instance": the fix commit's own message closed the gap it described. `0497d9d` "fifth
   instance": "the SAME check exists twice — I fixed one copy and it ran second".
4. 08-14 `c871a45` centralises three duplicated Class-3 blocks into `landedCommitVerdict()`: ≥2 landings
   means 'present'. Evidence: `gap-env-gated-write-allowlist` was "closed" on `bafd83d`, an inert rename
   (`WRITE_ALLOWLIST` → `WRITE_ALLOWLIST_ENV`), after being re-landed once (`69d680b`). `980135a` B1:
   "close on MEASUREMENT, not provenance". Baseline: of 2112 closed gaps only 31 (1.5%) were
   `landed_verified`, and the close-oracle self-reported `{landed_commit:{closes:0, false_closes:8}}`.
   `closeOracleEarnedTrust` is ≥10 graded closes AND ≥0.7 hold rate.

The landing gate was hollow in succession. Each time a fix was proclaimed, the next layer was found
to be inert:

- 06-23 `709b989` verify ALWAYS passed: `error_count` was always 0 (tsc writes stdout, the scanner
  read stderr) and the code checked `exitCode` where the field is `exit_code`.
- 06-19 `5e2dbe7` the FAVORABLE gate counted only `error TS` lines, so shape-dispatch violations
  slipped through.
- 07-29 `a4a4102` delta-typecheck by error-signature SUBSET. The same day `05450e6` fails closed on
  TS1xxx syntax-bail (the "dirty-base subset hole"). `d9dc467`: three botched landings compounded on
  origin/dev.
- 07-30 `530c1e9` "the landing gate was a no-op for goal-host": `bun run lint` meant "Script not found",
  so the tree had zero error lines and both sides were the empty set. Two broken commits self-landed.
- 08-04 `5930d8e` gates on the TEST suite. `ca81f29` "test gate was blind to tests DISAPPEARING".
- 08-06 `c0b665e` "the autonomous landing gate never ran tests, and could not have": base root
  `/vessels/<v>` has no test/ dir and the seed set `skip_tests`. 82 substrate commits had landed since
  08-01 while 76 failures accumulated.
- 08-07 `f3b427b` enabling it wedged landings within the hour (the baseline suite exceeded 120s).
  `41bde26` gives a full suite its own timeout. `5dec42c` caches the baseline. `5d69e1e` confirms a
  "new" failure before rejecting.
- 08-09 `b21b309` claims bun changed its `(fail)` format. That was RETRACTED in `7c23983`: it was a
  TTY-vs-pipe measurement error. `25cd735` is the real cause: the overlay symlinked tests, so they
  imported UNPATCHED source. "Every FAVORABLE verdict citing bun test verified unmodified code." A
  commit disabling the path guard in `isEditIntentGoal` landed FAVORABLE this way.
- 08-09 `f38f1a3` installs the staged manifest. Reverted by the operator the next day (`b90d6c4`, it
  pruned shared node_modules). The substrate re-landed the same idea (`0797af4`), and the operator
  reverted it again (`49f4c06`). 08-12 `1aaf435` refuses a change whose manifest no longer resolves.
- Memory 09-28: the "POST-LAND SUITE DEAD 08-31→09-28 (shell 30s kill)" is the same timeout class as
  `f3b427b`/`41bde26`, reappearing with a different default.

Metric self-truth fixes in the same class:

- coverage-tick changed ~9× (`8f365c1`, `0842239`, `2077ea6`, `84638bb` limit 200→2000, `d98777e`,
  `74e4be0`, `44ebd4d`, `fc495c1`, `83f3adc`). `fc495c1` (08-07): "the lift criterion's flag was true by
  construction". The server clamps limit to 100, so `84638bb`'s 2000 never took effect and older
  windows always read 0.
- health-tick/lift-gate recalibrated ~8× (`a3cc682`, `33721a3`, `bf906fb`, `934c185`, `0d2240a`,
  `eca7bf3`, `361e5fd`, `4b42aba`).
- `d5faf3f` (08-12): the LLM health detector reported reachable:true through 43 h of 100% 401s (566
  completions/day, 0 ok).
- `3a6018f` (08-09): "every `validation:` block in src/seed is decorative — none has ever gated
  anything". `0436bd9`: the operator's attempted guard was inert.

Outcome: partial. The B1 close-oracle (08-14) is the right shape. Memory (09-15, 09-22) shows class1
`expected_literal` gates still arming falsely, so the class recurred after this window.

### write-read-mismatch (producer writes where the consumer does not read)

- 08-09 `b1c3e68`: gap_lifecycle_scan read the literal `/workspace/gaps/gaps.json`, frozen since 08-08
  08:05 (2666 total / 462 open), while the writer used `join(workspaceRoot(),"gaps")` (200 / 154). It
  fed auto-close, landability ranking and the conductor's queue. A hand-filed gap sat 13 h. `267900a`:
  two more readers were pinned to the frozen copy (`pick-priority-scenario`, `self-interference-scan`).
  "Found by grepping the literal prefix rather than the accessor."
- 08-06 `5dc8ab8` memory-note captured WORKSPACE_ROOT at import. The test suite wrote into the REAL
  memory store (and see test-residue).
- 08-11 `8a92d57`/`31f957a`: the quiesce marker was written under `WORKSPACE_ROOT/quiesce`
  (=/workspace/git/super-repo/quiesce), but the vessel and pull-sync read `/workspace/quiesce`. "The
  quiesce marker had no reader."
- 08-09 `1f01440`: cluster wrote the pattern where the drafter was not allowed to read it.
- 07-31 `0bd32ff`: `verification_outcome` had 1 writer and 0 readers.
- 06-08 `41fd8f7` (V24e): the selector reads trace-recorded output_shapes, but the template declared
  `activityTemplateVariant`. Chain templates got a starvation floor of 0.3 instead of a pull boost of
  2.0.
- 05-30 `74e4be0`: coverage read `output_shapes` (legacy) instead of `output_impulse_shapes`.
- 08-10 `2a8ebf5`: the pwt escalation read top-level `gap.file_path`, which 0/360 gaps carry (104
  carry `classification_metadata.edit_site`). It crashed on every entry and the crash was swallowed
  into a warn.
- 08-09 `b8feccd`: the gap-compose watchdog stall test used the mtime of `compose-lessons.jsonl`,
  which every compose in the fleet appends to (4 s old while gap_to_feature had not run for 24 h). It
  was permanently suppressed.
- Memory 09-22 records the same class again: two memory stores via EnvironmentFile WORKSPACE_ROOT,
  with 680 knowledge notes unread.

Outcome: patched per instance, three times in 8 days, with no class detector in this window.

### endpoint-routing (hardcoded ports, resolve URLs, discovery)

- 05-22 `c31bba6` and 05-27 `01dcd8a`: llm_completion_dispatch URL construction was fixed twice.
- 06-17 `e779602` substrate-local GETs lacked auth. 06-28 `1e985ab` auth header (safe-bailing). 08-01
  `6892c85`: the drafter's llmCall 401 "made every edit goal unreachable".
- 06-19 `eca7bf3` pointed the health-tick edge metric at the working endpoint. 07-04 `983e5c7` routed
  obsidian via discovery.
- 07-11 `ca2e263`: DISCOVERY_ENDPOINT is a bare base, so `/resolve` must be appended.
- 07-19..22 federated LLM failover: `ddaf74e`, `dde7d33`, `e252256`, `b43062d`, `534189a`, `da08516`,
  `d08774a`, `ff416d4`, `626225e`. 07-29 `ec8ef67` added a by-name hub-egress fallback.
- 07-29 `7d9e39c` injects in-file endpoint constants into the patcher prompt "to prevent URL
  confabulation".
- 08-01..02 degenerate self-modification loop: 50 substrate commits against the gap
  `pwt-development-vessel-feature-compose.ts` introduced `LLM_ENDPOINT ?? http://127.0.0.1:8100`
  (discovery root, 404 on POST). `b467d4b` made failover iterate but always call the same URL. Four
  call sites were swapped to the constant, PER_CALL_TIMEOUT 200s became 900s, and the repair prompt
  was replaced by the literal "Corrected file content". The operator reverted it all (`c20a972`).
  Then `3f6e4f3`/`5056240` pinned llmCall to `CONCEPT_DB_ENDPOINT` and wrote
  `{{source_code.content}}{{source_code.content}}` at byte 0. development-vessel crash-looped on hub
  and spoke (`4fc14ab`). Follow-ups: `33afcc8` + `978a70f` (re-land of the same fix), `c3194ee`
  (restore egress at all four llmCall sites), `93b18ba` (refuse drafts pointing llmCall at a non-LLM
  endpoint) and `35c6b33` (refuse drafter-corruption signatures).
- 08-09 `5dcfc60`: trace-store-reconcile POSTed to a route that does not exist, hardcoded
  127.0.0.1:8080 (connection refused on every spoke by construction), and sent the token in the wrong
  place. "Could never have run", and it held the lease that gates every self-edit.
- 08-09 `99a39a6`: "a loopback address is not a location on a federated deployment".
- 10 autonomous `surgical-hardcoded-endpoint-development-vessel-<hash>` landings. Hardcoded
  `127.0.0.1:80xx` survives in Seam ③ mints, e.g. `dispatch-goal.ts`
  `GOAL_HOST_ENDPOINT ?? http://127.0.0.1:8210`.
- Memory 09-22 records the resolve-URL joiner overshoot (absolute resolvePath + endpoint), the same
  class again.

Outcome: failed as a class. Per-site patches recur and the drafter keeps reintroducing literals.

### autonomous-regression (a substrate landing broke something)

- 07-03 `d26a303` restored package.json clobbered by mitosis cutover `01b959a`. `96c2aaa` restored the
  `learning_transfer_report` implementation.
- 06-30 `eafd87a` re-wired selectionEntropy after a concurrent-cutover overwrite clobbered it.
- 07-29 `bba209f` the substrate reverted its own concept-bridge change. `3434f3e` reverted the
  `-narrowed` introduction `5697f70`.
- 08-01: the substrate self-reverted 3 mitosis landings (`6a08733`, `3a56a24`, `3215e70`). `70517eb`
  deleted 2,969 lines of feature-compose.ts, and `3215e70` restored them.
- 08-01 `9c4660a`: "source corrupted by an autonomous commit — file path injected at line 1".
- 08-02 `4fc14ab`: crash-loop, described above. "Because the drafter is the mechanism by which the
  system edits code, its corruption is self-sealing."
- 08-09 `956e464` and 08-12 `9a34712`: the SAME wrong repair landed twice. The substrate replaced
  `"@avigopal/ias-executor-ts": "file:../ias-executor-ts"` with an unpublished registry version (npm
  404). The second landing came via the `-narrowed` child of the same gap. The first reached origin as
  `landed_verified` after 4 failed attempts, because verify typechecks against pre-populated
  node_modules. Cf. 07-11 `5208185`, the same dependency path fixed by the operator.
- 08-09 `25cd735`: a substrate commit disabling the path guard in `isEditIntentGoal` landed FAVORABLE,
  and afterwards every add/fix/update/remove goal routed to feature_compose.
- 07-23 `1d9ed66`, 07-29 `db63bef`, 08-07 `62b2f22`, 08-11 `8dcd202`/`f836134`/`5a04b21`: operator
  reverts of substrate feature-compose and cutover edits.

### directed-overshoot (an operator/directed fix regressed)

- 05-26 `6c3448e` → reverted the same day `9e99f11` (reachable_unlearned_probe). 05-27 `ff5ea7a`: its
  recommend task "was polluting Thompson with bogus recommendations".
- 06-04 `cc00663` → `467360b` revert: scenario_id dedup deadlocked apply (only 1/52 proposals
  qualified).
- 07-29 `b4e3d77` clear pending lock on throw → reverted the same day `05829d6`, superseded by
  `0c96b99` (clear on ALL exits).
- 08-06 `c0b665e` enabled the test gate and wedged autonomous landings; `f3b427b` unwedged them.
- 08-09 `f38f1a3` → `b90d6c4` (pruned shared node_modules), then `0797af4` (the substrate re-landed
  the operator's reverted idea), then `49f4c06`.
- 08-10 compose-lessons oscillated 5× in one day: `89a7f31` send spec, then `90c585f` revert (zero
  rows), then `d274763` send spec with relaxed search, then `8236895` revert, then `6137257` recall by
  failure class.
- 07-19 `575514d` semantic gate fails closed. 07-20 `ff416d4` "honor the documented fail-open". 08-07
  region containment went from veto (`973b7f6`) to inert on the escalation route (`6712946`) to
  abstain (`4645bf8`) to "informs the judge instead of vetoing" (`a71e9a8`).
- Operator self-corrections of wrong root-cause claims: `271228e` (77cf692), `2500b30` (bff3347),
  `6d3074d` (6060ab7), `7c23983` (b21b309). In each case a fix was proclaimed with a mechanism that
  was later disproved. This is the literal "proclaimed newly resolved" pattern, visible in git.

### narrowing-duplicates (-narrowed/recommit children, penalty resets, duplicate gaps)

- recommit chains: on failure, a gap re-files as `recommit-<id>-<reason>`, recursively. `12e7611`
  (07-27) measured 81 `recommit-`, 28 double, 15 triple, 7 quad and 2 quint. The backlog was 1588
  compose-report files vs 85 real proposals (~97% churn), so apply never reached real work. Git shows
  chains up to depth 13 landing (`recommit-`×13 `…semantic_reject`×13).
- `-narrowed` children: introduced by the substrate (`5697f70` 07-29), reverted, then `449949c` gave
  the narrowed child an id so chronic-failure escalation fires. The `-narrowed` child re-landed the
  404-dependency repair (`9a34712`). Memory 09-22: "`-narrowed` child = verbatim dup".
- failed_attempts penalty: `7833b6a` (06-29) introduced it. `c8a377d` (06-30) "preserve gap
  failure-tracking across detector re-emissions", because re-emission reset it. `63d6a67` extended it
  to MINT_FAILED.
- Dedup attempts: `c214385` (06-14 by gap class), `c8be5b1` (06-14 substrateGap by CLASS),
  `486022e` (06-17 content-hash sentinel so recurring gaps can re-draft), `5f17869` (per-proposal
  sentinel), `cefddf5` (sentinel TTL), `bc6daac` (07-21 per-gap cooldown).
- Re-landing: `ff04a17` shows the same gap re-landed because closure never happened (route-edit-62939765
  re-applied 4× on 07-09; service-failure-model-reality-audit landed twice, 3 commits in git).
- Gap ids: 239 autonomous landings carry `Gap: unknown-gap` and 346 carry ephemeral `route-edit-<hash>`.
  `10e10e9` (07-31): route-edit landings had no gap closer, so "every substrate-authored landing
  scored zero on the gap triple".

### calibration-seal (category/class posteriors sealing work)

- 06-30 `d1bb37a` category-level self-knowledge: strongly deprioritise a category with ≥8 attempts and
  0 lands. This is the origin of the class-posterior seal that memory (09-22 "seal permanent", 248
  escalations) later records as sealing work.
- 06-30 `8a1a761` predictLand vs a 0.5 prior, with mispredictions deprioritised ×2. 06-29 `7833b6a`
  failed_attempts penalty. 06-28 `e78f8da` landability-ranked gap selection. 07-01 `eb450e4`
  prioritise orphaned_capability "(it lands, feature gaps don't)". This is a feedback toward whatever
  already lands (easy/hollow classes).
- 08-06 `143212a`: "impact counted self-citations, blockingWeight had the wrong sign, and the hopeless
  filter was discarded".
- 08-14 `4b1f862` per-class posterior on the close oracle, and `closeOracleEarnedTrust`.

### drafter-quality (symptom edits, invented paths, anchors)

- June V-series (V13–V38): drafter schema and prompt fixes. `201c357` one-shot example, `f477892`
  explicit repos/<vessel>/ prefix, `7d5073c`/`bf26eb4` constrain to real resolvers and no invented
  URLs, `755b522`, `022b3aa`.
- 06-17/18 surgical pre-gate: `af0b32f`, `4850803`, `03aa031`, `8119285` (widen to unblock).
- 07-22 localization: `24e4dc0`, `a5680c0`, `74f7c27`, `3151b73` (diag), `1f9fa12`. 07-20 `74f25e6`
  rank the change-site by reading source.
- 07-31 `83bb498` ground the spec against the real file UNCONDITIONALLY, plus `31fb735`, `15c611e` and
  `25be910`.
- 08-07 region series (12 commits in one day): `130c431`, `690239b` ("the region was never a focus
  hint, so the drafter never saw the code"), `46d4113`, `9ccd136`, `e2899a3`, `40aa90a`, …
- 08-10/11 grounding/anchor series (~16 commits): `11f10af`, `844f4e1`, `78ba658` ("bound probe
  frequency — NOT by uniqueness, which measured backwards"), `3b73e39`, `62a4fd3`, `cd22366`,
  `fca1022`, `de4d309`, `4ff909c`, `6e63247`, `dd7afb3`, `6060ab7`, `dcb4198`, `2ff42fe`, `e637523`,
  `5dfc141`, `d7c9177`.
- Model pinning: `568d483` (07-11 SELF_DEV_LLM_MODEL env), `a6ee84b` (07-22 pin DeepSeek-V3.2), `5273bfa`
  (07-22 claude-sonnet-5), `47096a7` (07-25 restore "auto", law 1), `b0435f4`/`beec282` (07-31 unpin 4
  resolvers + seeds), `fd144a7`. The pin was reintroduced at least 3 times.
- 06-18 `d3cbf33`/`fdb5358`/`83c02c5`: learn from prior failed and successful attempts. 07-20
  `a3f01d6`: "drafter-floor mechanisms (plan-no-ops + success-blindness)". The memory note of 09-22,
  "failure side had no store", is the same need re-found.
- 08-14 `1abb3a4` feeds the closure criterion to the drafter at draft time (law 8). `639bd27` adds an
  adversarial-verify quorum.

### gap-content (gaps born without edit site or machine check)

- 07-17 `2ab4bed` derive spec from gap fields instead of crashing on missing pointer.spec. 07-01
  `8571930` crisp grounding lines. 06-23 `e9d00c5` inject the proposal's target files.
- 07-30 `76f44ca` actionability admission gate, and the gap-store identity leak. 08-06 `37c97ab` derive
  the missing path binding and refuse to plan without one.
- 08-10 `2a8ebf5`: 0/360 gaps have `file_path` and 104 have `edit_site`, so the escalation had never
  run.
- 08-14 `c871a45`: "0/30 landed_verified closures carry a surgical condition Class 1/2 can positively
  check". Gaps are born without a predicate.
- 239 autonomous landings with no gap id at all.

### dormant-mechanism (built, validated once, never used/extended)

Found explicitly in commit bodies:

- `2a8ebf5` pwt escalation "has never once run".
- `5dcfc60` trace-store-reconcile "could never have run".
- `3a6018f` seed validation blocks are all decorative.
- `5a25f9c` "remove a dispatch that could never fire".
- `b8feccd` composable gaps (154/157) had no event path and their watchdog was permanently suppressed.
- `69d6a21` "the unit spawn accomplished nothing".
- `ff04a17` "the next-tick verifier never existed".
- `81b505e` an empty rhythm registry must announce itself.
- `c0b665e` the test gate never ran.
- `530c1e9` the goal-host gate was a no-op.
- `06fabe9` the dead-store gate was inert.
- `6712946` the region gate was inert on the escalating route.

June "detector explosion", 06-13..06-19: template-input-lint, gate-saturation, vessel-write-error,
chain-fetch-failure, selector-saturation-audit ("recursive self-detector"), detector-authoring
recursion, detector_meta_scan ("Nth-order detector-over-detectors"), value-sanity self-check,
dead_end_decision_scan, detector_yield_registry, funnel detector, gap_lifecycle_scan and
model_opportunity_scan. Several are still firing today (detector-meta-tick 107/7d,
draft-detector-activity 51/7d, 1,948 `detect-*` runs/7d). Most of those are
`detect-unclassified_failure_*` per-failure detector instances: detectors minted per failure
instance, not per class.

### spend-envelope-throughput (budget, lanes, concurrency)

- 07-16 `8ec501b` per-compose worktree isolation ("stop refusing concurrent composes"). `f655c8d` sweeps
  stale workspaces.
- 08-10 capacity-cap series: `6ad3721` cap concurrency (host starvation), `68a26de` cross-process,
  `84712c5` reserve a slot for directed goals vs boredom, `070f71e` dead-holder release, `36dd9b7`
  (REFUSED→BUSY; "REFUSED does not queue, it dies"), `5f965b8` (race voided the reservation), `bf7fac0`.
  `fad4665`/`459d278`/`c77e1d1` drain counting.
- 06-16 `461aab3` raise the patcher budget + anti-search-loop. 06-14 `ab7537a` loop-break. 08-10 `23e707d`
  "make the anti-loop guard able to see the loop".
- 06-28 `a977d3c` decompose timeout 90s→200s. The degenerate loop later ratcheted PER_CALL_TIMEOUT
  200s→900s.
- Live: feature_compose $30.87/7d at a 19.6% ok rate.

### sync-deploy-drift (clones, pull-sync, restarts, runtime vs clone)

- The mitosis pending lock was fixed ≥6 times:
  - `2cfc6b0` (06-19 livelock when already applied)
  - `db30efa` (06-30 stalelock, autonomous)
  - `9019cbd` (07-19: /vessels mirror ahead of origin, so a freshness livelock and "hollow-green")
  - `b4e3d77` → revert `05829d6`, then `0c96b99` (07-29: orphaned lock froze pull-sync for 30 min)
  - `3f4be28` (08-01: lease deadlock against its own change-window lease)
  - `c8b2e6e` (08-02 dirty index)
  - `76c5ed0`/`24060e3` (08-11: freshness checked 1 of N files, now a base sha per file)
- Self-restart: `4ec9ce8` (06-23: dev-vessel self-cutover never deployed, restart killed itself),
  `b1192fa` (08-05: deferred timer destroyed unrelated composes), `a0e6692`/`ede3aeb`/`9f06451`/
  `8a92d57`/`31f957a`/`5a41852` (08-11 quiesce series), `644e7ee` (name who restarted).
- 06-12 `e723575` "sync from substrate container — recover authoritative state". 07-21 `edb4ba3`
  pull-cutover "make the deploy step real". `e5fd6c9` sync verified files into runtime at land time.
  `ba6ce43`/`fd701d9` revert live /vessels on every non-landing terminal. `af54cc8` guard against
  catastrophic live-source truncation. `e6f4feb` poisoned rollback baseline.
- 08-08 `9e7df31` committed agent worktrees broke submodule recursion.

### test-residue-live-state

- 08-06 `5dc8ab8`: the memory-note test wrote to the REAL memory store (frozen WORKSPACE_ROOT). The
  suite was self-poisoning run over run.
- 06-05 `a2a7a7c`/`ffafa9d`: substrate-heartbeat.json was tracked, and observer churn caused host-sync
  scope-creep rejects. 08-09 `459aa8b`: untrack pool/standing.json.
- 08-09 `267900a`: "79 fail / 1 error before and after (pre-existing)", a permanently red baseline.

### memory-recall

- 05-24 `d164bb9` memoryNote + memoryNote_write were born here.
- 07-26 `9790c2f` tolerant intake (was 500). 08-06 `7761f47`: an empty write created a titled shell and
  could BLANK a good note. 08-06 `5dc8ab8` WORKSPACE_ROOT frozen at import.
- 08-09 `abead92`/`0b5b279`: the drafter's principle consultation filtered on a shape no concept has,
  and AND-across-terms matched nothing for a 400-char spec. The compose-lessons oscillation on 08-10
  (see directed-overshoot) came from the lesson corpus being prose while specs are code.
- 05-29 `e03ec6e` concept-db priming of the drafter. 06-04 `eb119ab` dropped the source_type
  whitelist. 06-13 `7a80556` credit primed concepts (two-sided relevance). `839323e` one-sided
  relevance detector.

### selection-learning

- state signature revised 5×: `3cd263d` (06-01), `2bd15d4` (bucket high-entropy so posteriors
  accumulate), `e69a5df` (v2 coarsening), `df92d5e` (tier-collapse), `c4d075a` (activity-class axis),
  `59c9d83` (rhythm axis).
- template-mitosis variant loop `b500263` + `variant_promote` `07a4bd0` (06-04), with Thompson
  promotion.
- `ff5ea7a` probe polluting Thompson. `41fd8f7` shape mismatch starving chain templates.
- 07-01 `40c5c4a` learning-policy write-back tick. 07-10 `c05448e` rhythm_conductor_tick.

### composition-crystallization

- 06-19 `71ad11e` compose_topology_tick, `025c1c5`, `2bf6fe9`. 06-22 `3ba1c45` normalize compose-tasks
  so activities-as-resolvers execute. `2b81f4e` cap 40→300.
- 06-24 `a317cab` shape-graph walk builds composition. 06-24..25 author_producer (`ace3314`,
  `aaee339`, `2f03d3b`, `66fa65f`, `b2c67db`, `7159e3d`). 06-27 `df174db` author_composed_capability.
- 06-22 `2f45204` instructs the pattern-drafter to COMPOSE existing producers, not re-implement.
- Live today: `compose-auto-bridge-*` and `learned-composition-*` activities run in the hundreds/7d.
  `proposed_pattern_authored_*` (June draft-activity-from-pattern output) accounts for 1,554 runs/7d.

### composition vs reuse: reuse-before-mint

- 06-21 `407e3ed` shadow mode. 06-26 `900bc69` enforced by default ("off/shadow remain env overrides",
  which is env-gating). 07-12 `7148d37`: the substrate landed `reuse-gate-blocks-signature-bound-detector-mints`,
  loosening the gate for its own detector mints.

### env-gating

- `230093a` MITOSIS_HOST_SYNC_MODE, `568d483` SELF_DEV_LLM_MODEL, `900bc69` REUSE_BEFORE_MINT
  env override, `6358937` EXTRA_WORKSPACE_ROOTS, `30bbe40` DEV_OPERATOR_PRESENT (made presence come
  from discovery "not only" the env).
- Autonomous `gap-env-gated-write-allowlist` was "closed" twice by inert renames (`69d680b`,
  `bafd83d`).
- Frozen-at-import config (`5dc8ab8`) is the same law-1 hazard inside the code.

### federation-p2p

- 07-19..22 LLM failover across federated producers, libp2p egress rewrite, envelope unwrap
  (`dde7d33`, `b43062d`, `da08516`, `626225e`). 07-04 `3a9ea4c` Ed25519 identity at first start
  (advisory H2).
- 08-09 `99a39a6` loopback is not a location. 08-09 `5dcfc60` hub-owned activity-api is unreachable
  on spokes.
- 08-13 `4282791`: composes died invisibly when the hub llm-resolver said "No LLM provider
  configured".

### trace-store-db

- 05-31 `d915bc0` cap scan limits (SurrealDB thrash). 06-21 `f15f3ed` index on executed_at. 06-28
  `c48e14d` over-fetch 2000→500. 07-05 `ad8d843` ORDER BY executed_at not stored_at.
- 07-08 `9674cb8` maintenanceLease + trace_store_health_observer + reconcile. It could never run until
  08-09 (`5dcfc60`, `af12cf3` "my own fix was still broken", `30aac7c`, `4635174`). Meanwhile "the store
  sat at 2x cap" (`3a6018f`).
- 07-22 `bbd4283`: 5 DB observers were repointed off the decommissioned AET. `e282ac4` db_performance
  emits unauthenticated, so the gaps never persisted.

### human-surface-escalation

- 06-13 obsidian command gate. 06-14 obsidian_learn_commands. 06-22 `1eba1cb` feedback/RESPOND. 07-01
  Inbox/ dir + Outbox.md + implicit-vessel-scan. 07-06 ui_legibility_scan (stub).
- 08-07 `fd601c2`: judge a human complaint by the complainant. `b90cdcf` weights a human's report above
  a machine one. A human UI complaint was falsely closed twice (`77cf692`, `018fd05`).
- 08-14 `25a1dfb`/`980135a`: abstain means escalate to the human. Memory 09-22 records 248
  escalations to an unread vessel.

### docs-drift

- 07-01 `729af75` doc_drift_fix. 07-10 `ad5f7c0` docs_align_scan v1 + `9e11486` precision fixes.
  Substrate-authored docs-decision solicit/deliver/answer-scan (07-12) and docs-align-bridge/tick
  (07-11) are present and each referenced once.
- Commit messages as docs: 4 operator commits exist only to retract a false mechanism claimed in an
  earlier message (`271228e`, `2500b30`, `6d3074d`, `7c23983`).

### codebase-bloat-fossils

- 08-06 cruft sweep: `b306a58` rubric-echo (22-line scaffold nothing wired, a July substrate mint),
  `2e10d6a` self-update-report (a July substrate mint), `25f0b99` obsidian-assist-bridge (test-only
  life support), `1615970` llmCall_OLD (81 lines below its replacement). Plus `500c1d1`
  concept-naming-sync (substrate mint, orphaned), `76383da` summary_of_clock_vessel_functionality
  (half-done removal, substrate capgap mint) and `d86a4e4` product-era vessel name.
- Three parallel code-landing paths, each hardened separately:
  1. draft-gap-closing → apply_proposal_as_patch → mitosis (06-04)
  2. patch_with_tools (06-12)
  3. feature_compose (06-20)

  Plus authoring side paths: author_producer, author_composed_capability, author_new_resolver,
  template_repair, reachability_gap_repair, doc_drift_fix and change_series. Evidence of
  duplication cost: `44bcffd` (07-29) "unify path-2 onto the hardened static gate", and `e1f3656`
  (08-07) "the second landing route had no location check at all".
- Three duplicated Class-3 blocks, centralised on 08-14 (`c871a45`).
- `src/maintenance/{parity-gate, seam-extraction}` (07-16, operator) plus substrate
  `change-plan`/`spliceability` (07-17). `spliceability.ts` has 0 refs today.

---

## Mechanisms (general vs specific; live status)

| mechanism | where | general? | status (evidence) |
|---|---|---|---|
| feature_compose drafter | src/resolvers/feature-compose.ts (06-20 `d8c982a`) | general seam for code edits | live-used: 1,949 runs/7d, 19.6% ok, $30.87. Self-edited 192×. |
| vessel_mitosis_cutover + mitosis-tick | src/resolvers/vessel-mitosis-cutover.ts (06-02 `689cf99`) | general landing seam | live-used: 589 cutovers/7d (66% ok), mitosis-tick 7,874/7d. Pending-lock fixed ≥6×. |
| apply_proposal_as_patch | 06-04 `b5001aa` | specific path (landing path 1) | live-used, low volume. Duplicate of feature_compose landing (`44bcffd`). |
| patch_with_tools | 06-12 `c70b8d3` | specific path (landing path 2) | live-used, low. Its escalation never ran until 08-10 (`2a8ebf5`). Duplicate. |
| gap_to_scenario_bridge tick | 06-04 `492dd88` | specific | live-used: 17,969/7d, ~100% "success". Volume with no visible output = fossil churn. |
| dispatch-latest-auto-draft | 06-08 V24 | specific | live-used: 1,711/7d. June-era drafter chain, still running. |
| gap_to_feature | 06-20 `ac9bfc2` | general gap→compose seam | live-used. Holds the close-oracle. |
| landedCommitVerdict / close-oracle | 08-14 `c871a45`, `980135a` | general (all close sites) | live (not measured here). Replaced 3 duplicated Class-3 blocks. |
| sweepPendingLandVerifications | 07-30 `ff04a17` | general | live. `pending_outcome_verification` clear does not stick (memory 09-26). |
| vacuous-edit / hollow gates (≥9) | src/vacuous-edit.ts + feature-compose | specific per surface form | live. Each form-specific, no general "behavioural delta" oracle. |
| test-delta landing gate | mitosis static eval (`c0b665e`, `25cd735`) | general | broken → fixed 08-09 → dead again 08-31..09-28 (memory: shell 30s). |
| compose slots / capacity cap | src/compose-slots.ts (08-10) | general | live. |
| quiesce / drain | src/quiesce, long-running.ts (08-11) | general | live. The first version wrote the marker where nobody read it. |
| maintenanceLease | src/resolvers/maintenance-lease.ts (07-08) | general single global mutex | live. Deadlocked against itself 08-01 (`3f4be28`). |
| trace-store-reconcile | src/trace-store-reconcile.ts + seed | specific | dormant 07-08..08-09 (could never run). Later status unknown. |
| reuse-before-mint | activity-create-variant.ts (06-21/06-26) | general mint chokepoint | live. Env override. Loosened by the substrate 07-12. |
| Seam ③ net-new resolver authoring | 06-19 `5e2dbe7` | general | 70 substrate resolvers in July. Most have a single dispatch reference; several hit nonexistent endpoints; 5 deleted as cruft. |
| Seam ① generative frontier | 06-19 `9d7208a` (spectral-headroom gated) | general | unknown / likely dormant (no "generative-frontier" in the 24h journal). |
| compose_topology_tick / author_producer / author_composed_capability | 06-19..27 | composition seam | compose-auto-bridge-* live (hundreds/7d). author_* not seen in the 24h journal. |
| June meta-detectors (detector_meta_scan, selector-saturation, detector-authoring recursion…) | 06-13..19 | general in intent | live-used: 1,948 `detect-*` runs/7d, mostly per-instance `detect-unclassified_failure_*`. Detector-of-detector bloat. |
| state signature | compute-state-signature.ts | general selection context | revised 5×. Live (not measured). |
| rhythm_conductor_tick | 07-10 `c05448e` | general cadence | live (not measured). 08-09: empty registry was silent. |
| change_series | 08-06 `11ebf40` | general multi-file step | status unknown (0 journal hits in 24h). |
| docs_align_scan / doc_drift_fix | 07-01, 07-10 | general | not seen in 24h journal. Likely dormant. |
| parity-gate + seam-extraction (maintenance) | 07-16 | general refactor | "gate-proven on the real fossil". Current use unknown. spliceability.ts has 0 refs. |
| llmCall failover via discovery | feature-compose/patch-with-tools/llm-completion-dispatch | should be ONE shared seam | duplicated across 3+ files. Hand-reimplemented per file (`c3194ee` "all four llmCall sites"). |
| memoryNote store | 05-24 `d164bb9` | general | live. Split-store bugs recur (08-06, 09-22). |
| reachable_unlearned_probe | 05-26 | specific | reverted the same day (fossil). |

---

## Principles stated in commits (with location)

- "A reverted land is not a land"; git is append-only, so "any mechanism that treats presence-in-history
  as proof of outcome will keep believing reverted work" (`77cf692`, `018fd05`).
- "Duplicated logic means a fix applied to one site is not a fix" (`0497d9d`).
- "Close on measured 'absent', abstain on everything else"; "provenance is not measurement"; "trust is
  EARNED by holding closes", Beta(1,1) must not earn trust (`980135a`).
- "A template's declaration is not evidence the shape was ever produced": advertised ≠ demonstrated
  (`83f3adc`).
- "The gate cannot observe an install it never performs" (`956e464`). "A write that succeeds is not an
  edit" (`93d7596`). "Verify the rollback restored the file, do not trust the writer" (`1abc4ff`).
- "Because the drafter is the edit mechanism, its corruption is self-sealing": hand-revert under the
  intractable-blocker carve-out (`4fc14ab`, `35c6b33`).
- "Uniqueness is not location" (`6060ab7`, `d7c9177`). "A mention is not a declaration" (`fca1022`).
- "Capacity refusal must be BUSY — REFUSED does not queue, it dies" (`36dd9b7`).
- "Destroy the run and … the learning loop cannot tell a good change from a bad one" — quiesce instead
  of restart (`a0e6692`).
- "Found by grepping the literal prefix rather than the accessor" — search for the defect's form, not
  for the correct idiom (`267900a`).
- "The detector asked if the vessel was up, not if it could work" (`d5faf3f`).
- Reuse-before-mint (λ₁ ≳ ρ_grow) at the single mint chokepoint (`407e3ed`, `900bc69`).
- Generative gap sources must be headroom-gated (`9d7208a`).
- Operator-anchored fixes committed under the substrate identity: ~20 conventional-commit subjects in
  window are authored as "Substrate Autonomous", e.g. `2cfc6b0`, whose body says "the substrate cannot
  yet author this class of change itself". Others: `9019cbd`, `0c96b99`, `d26a303` and `96c2aaa`.
  This contaminates the autonomy criterion (memory law: never commit operator work under the
  substrate identity).

## Cross-cutting diagnosis for the realignment

1. The same five root causes recur across the whole window under different subjects:
   - (a) a gate or verdict reads an indirect signal (commit message, exit status, declared shape,
     mtime, `reachable:true`) instead of measuring the outcome;
   - (b) state paths diverge between writer and reader (WORKSPACE_ROOT vs literal);
   - (c) literal endpoints instead of discovery;
   - (d) duplicate implementations, where fixing one copy leaves the other deciding;
   - (e) per-form gates instead of one behavioural-delta oracle.
2. Each fix commit usually asserts closure. Four later commits exist only to retract the mechanism
   claimed. There is no automated check that a proclaimed fix changed the measured signal. The
   08-14 close-oracle is the first mechanism that grades this.
3. Landing volume is not progress. 837 autonomous landings, of which 239 have no gap, 108 are
   comment-only and 70 target one gap in the drafter's own file (50 in 2 days). Autonomous work
   concentrated on self-editing the drafter, which is the one file whose corruption is self-sealing.
4. Keep:
   - the close-oracle (`landedCommitVerdict`, earned trust);
   - per-file freshness shas;
   - quiesce/drain;
   - compose slots;
   - the test-delta gate (with the overlay fix);
   - revert-aware history checks;
   - drafter-corruption refusal;
   - reuse-before-mint at the chokepoint.

   Consolidate:
   - the three landing paths into one gated path;
   - llmCall/failover into one shared seam;
   - the ≥9 hollow gates behind one behavioural-delta check.

   Retire or park:
   - June tick fossils still firing (gap-to-scenario-bridge-tick 18k/7d, dispatch-latest-auto-draft,
     per-instance `detect-unclassified_failure_*`, `proposed_pattern_authored_*`);
   - Seam ③ capgap mints with nonexistent endpoints.
