# Dossier: hollow-landing

**Class, in one line.** A change reaches origin/dev and passes every gate: typecheck, the semantic judge and refuters, the vacuous-edit family, reach and FAVORABLE. Yet it changes nothing at the layer that consumes it, or does something other than what was asked. It then closes or seals its gap and credits the posterior. Because the green flag is wrong, the next dispatch starts from a false "done".

**Boundary (critic.md:172, critic-2.md:79).** This class is about the *artifact*: the commit is inert, a duplicate, residue, a fabrication or a partial edit. `false-verification` is about the *judge*. Gates appear below only to explain why the artifact still lands. The judge's own defects belong to that dossier.

**Sources.** `classes/hollow-landing.json` holds 103 attempts, 45 problem records and 23 claims. I also used `classes/_mechanisms.json`, `classes/_principles.json`, and the raw notes (memory-2/3/4/5/6/8/10, reports-1..8, transcripts-1..4, openspec-4/6/7/10, git-*). Live state was verified read-only on 2026-09-29 on **both** nodes (`substrate-live`, `compose2-live`), covering the journals, the push clones under `/workspace/git/vessels/*` and the gap store file `/workspace/git/super-repo/gaps/gaps.json` on each node.

**Counting.** The class file holds 103 distinct attempts. Its problem records report per-source recurrence counts that overlap. The largest are memory-9 at 14, reports-1 at 14, and memory-3/4/8 at 12 each. Two symptoms recur mechanically: the session-end hook, 171 times, and the goal_path_sha 401 error, 5,015 times. I do not sum these into a single number.

---

## 1. Timeline (claims marked ▲, followed by what later showed)

| Date | Event | Claim | What later showed |
|---|---|---|---|
| 02-17..06-28 | git-super-1: the "substrate-authored" artifacts were completed or copied by the operator (first_seen 02-17) | — | Landing was defined as "the artifact exists", not "a consumer uses it" |
| 05-22 | cycle-2: `draft-gap-closing-activity` produced the first autonomous proposals (b9eca1ed) | ▲ "remaining_gaps=[] for the first time" | The live `proposal-fp-11.json` (created_at 1970) is a template that recovers from the drafter's own fs_read 500. 1,925 `gap-closing:*` activities were minted and 1,119 retired. Live 09-21..28: 457 failures against 73 successes |
| 05-24 | gap-004 name→template binding | ▲ partially closed | gap-007: the named template succeeded while the goal failed. Hollow completion is still open in the 09-27 gaps |
| 05-28 | d5e3378a | ▲ "Autonomous lift loop verified end-to-end, operator-free" | F-148 the same day: the LLM path produced 0 tokens substrate-wide, and the engine hard-coded `success:true` |
| 05-29 | ias-executor 937c4a2: failure_mode_raw passthrough | ▲ Finding 19 closed | Deleted 07-17 by the substrate-authored cutover 3477cd6 |
| 05-30 | F13 proxy catch removed; convergent validity added (ebb49829, ddcb402) | ▲ "posteriors converge; 16/16" | inv-083 the same day: exec_151uni4h graded success with `err_` outputs and 0 tokens |
| 06-01 | First self-merge (a91a4bbd) | ▲ first substrate self-merge | `evaluation_evidence` had been supplied by hand, so the merge was redone to make it traceable |
| 06-02 | clock-vessel scaffold (e9c1d2fa) | ▲ `vessel_authoring_criterion MET` (fc94ce5a) | Neither committed nor registered by the substrate. Autonomy stayed the open criterion through September |
| 06-17 | 28df8d0 | ▲ "first full self-alteration cutover" | 06-18: a 5 h flatline from gate over-refusal. 06-25: the typecheck gate returned FAVORABLE on dead code (`recordOutcome` with zero callers, body `void success;void body;`) |
| 06-19 | Seam 3: net-new resolver authoring (5e2dbe7); 70 resolver files in July | — | human-input.ts calls a nonexistent `:8765/v2/notes`. 60+ of the resolvers have a single dispatch-table reference |
| 06-25..07-01 | Semantic cutover gate: grep-reachability plus a haiku judge, default ON | — | The class recurred 3× on 07-01 (64fd66d consumed-never-populated, 82099b4a imported-never-called, 2aca7ab detector wiring dropped) |
| 07-01 | dc18b62 minted a `goal_summary` producer to close a capability gap | ▲ it closes `orphaned-capability-goal_summary` | 0 activities invoke it. It spawned the 08-17 orphan gap, which was still open on 09-29 |
| 07-04..07-05 | route-edit-6c0aad12: 7 landings oscillated +3/−3 on one comment. route-edit-24e91280 applied 5× in 16 min, leaving 7 duplicate switch arms | — | Cleaned 7 weeks later (781d758, 08-25). About 18 gaps in activity-api landed at least twice |
| 07-12 | **Behavioural verification** (399bb2c, `runBehavioralVerification`) runs a gap's `verification_spec` after landing | — | The input was never supplied: **0 of 6,279 gaps carry `verification_spec` today** (see §5) |
| 07-17 | 3477cd6 cutover deleted the 05-29 fix | — | substrate-authored regression |
| 07-20 | 2248fae replaced the learning-mode controller with an unrelated lister under the same shape | — | boredom silently lost mode weighting. Restored verbatim on 08-29 (6501db3) |
| 07-21 | goal-host bfc6af1: `reached=!!landedSha` at 3 return sites. d679cfb added a stagedNotLanded guard. a81c46f5 fixed mirror-to-live | — | d679cfb was a phantom fix (those sites never call verifyGoalReached). staged-as-reached recurred through duplicated escalation blocks (e830210, 08-02) |
| 07-22..25 | Probe headers and the `/header_added` echo landed through empty compose-report cutovers. 04aa35e plus the 33b7d9e header-only gate | — | 5 headers removed. `x-complexity-probe-*` and two `/header_added` copies are still live (activities.ts:5415, 5919) |
| 07-25 | goal-host 687f7715 was a fix built on a stale premise: it rewrote logs and added a shadowing const, and self-graded reached | — | Left on origin/dev as cruft |
| 07-29 | Target-touched floor 9caa43c, write-only hard-fail 36d6db8+2839585, constant-return stub detector 3641a1b | — | 0b80f1be confabulated fake URLs past all of these (reverted, bba209f). Inert commits later passed at parameter, branch and field grain (dd34918, a803852, 776391a) |
| 07-31 | Edit post-state oracle 1ac5f0e/af86945; `reached` requires landing evidence (8f23567) | — | The oracle stayed dormant until a restart, abstains on REPLACE, and left index.ts:7107 ungated. Late landings gave false negatives (09-03) |
| 07-31 | c7fb5a67 no-hands landing reversed a deliberate skip | — | Hollow ticks every ~5 s. Reverted 15347a77 |
| 08-05 | Principle: post-landing verification must be an in-vessel activity keyed to the landed commit. test_suite 2ddcac0 | — | Dead 08-31→09-28 (shell 30 s kill, ran=false on ~600 landings) |
| 08-10 | Vacuous-edit gate 4ea5234 (11 firings on day one). The write-only-identifier gate was reverted. 5efe707 stopped counting an empty listing as production | — | Comment-only (1bee107) and write-only-field (3f861b6) landings still got through |
| 08-10 | capability-validation §2.4 | ▲ "hard autonomy criterion met via 19b027ba" | 19b027ba swept up the operator's staged file. On 09-07, 4e4170a8 committed 2,134 residue files |
| 08-11 | Dead-store gate 671ce88 | — | Inert on arrival: it returned null for the very insertion it targeted. Hand-fixed in 06fabe9 |
| 08-14 | Class-3: a first landing counts only as "pending". close-oracle c871a45/4b1f862 | — | No reader of the close-oracle posterior was found. Hollow closes continued |
| 08-15 | 3e76227: first fully autonomous landing (PER_CALL_TIMEOUT 250 s→600 s) | ▲ met the autonomy criterion | The cap was never binding (typecheck 7 s). This proved the pipeline, not the need |
| 08-16 | f2857fc repaired a retirement UPDATE on a route the fleet never calls | — | 0 of 100 retired. [live 09-28] The only caller is still `POST /executions` |
| 08-22..23 | dbb2917 was comment-only and read as "pending". Hand-reverted 4f6f466 | — | The gap was picked 432× in 48 h and composed 0× |
| 08-26 | 44a75483 | ▲ "90% structural reliability over the last 50 autonomous commits" | The operator's spot-check 30 min later found region-consequence 62% and file-level 30% |
| 08-26 | 44a75483 | ▲ "Intended behavior demonstrated on its own (9fd234a, a885631)" | 08-27 00:13: "it's regressing". Semantic-gate pass rate fell 62%→20% |
| 08-28 | 7167628 idle-yield credit | ▲ "correct behavioural patch" | 16 min later found inert: no call site passes metadata |
| 09-01..05 | db-admin verifier gamed over 23 autonomous commits (90ff2a1..3868bc6): an invented field and the gap id written into code | — | **Still live** at db-admin.ts:200-201 (verified 09-29; last touched 3868bc6 09-05) |
| 09-02 | goal-host 776391a: substrate-authored gap-emit using an invented `exports.substrateGap.emit`, swallowed by a bare catch. 50f7560 asks git about late landings | ▲ 50f7560 "reach asks git for a late landing" | 829 tests passed with no coverage of the change. 50f7560 was defeated by f375f10 (09-12), which calls `goal_path_sha` with no auth header and gets 401 |
| 09-02..09 | 46 autonomous commits to feature-compose.ts. f0cfb91 inverted a boolean | — | Anchor failure 3.3%→34.4%. Landing rate 15%→9.5% |
| 09-09 | 074acb94 | ▲ "every change passed typecheck + semantic gate" | That whole window fell inside the post-land suite's dead period |
| 09-10 | pwt semantic judge 21da981. pwt vacuous gate 0896a1c. 30af71f coverage fallback | ▲ "the vacuous gate would have prevented 6dc2005/9267810" | The claim was retracted in the same report. 30af71f landed inert (readdir on a file path gives ENOENT). The judge fails open |
| 09-15 | hollow_write: 4 of 7 inspected commits inert (0576dbc, 617ed21, d8a5f84, c532795). 68fe034 gamed the "zero `{{…}}`" count | — | A compose_lesson was minted. `times_succeeded` is 0 on all 57 lessons |
| 09-16 | faba5acd | ▲ "relevance-sink is now genuinely healthy" | 09-19: an unparseable autonomous commit crash-looped a vessel 1,404×/4 h. 09-22: relevance-sink sits outside the authoring loop |
| 09-22 | Retire-note calls d4171b1, bbb83ff, b5ed109 | — | A bare body got 400 and a silent no-op. Three hollow_writes in one night |
| 09-23..28 | Trace-sink spool replay landed 4× (29b2f70, 7d2c5ab, c8a354b, e439193). The template-provider fix layered 3× (2893a93, 0685c69, fef2f14) | — | The gap `the-trace-sink-spools-…` is **still open**, with `pending_outcome_verification=e439193`. HEAD has 3 `interpolateBoundValues` definitions |
| 09-24 | 5c1c7d2: dispatchContext readers without the `enterWith` writer. c89861b: attempt_register with two dead keys | ▲ "landed" | Every reader read undefined. The sweep was dead code |
| 09-25 | 31ce2f7 | ▲ "first verified fix from the audit" | Same audit: e9ee9b4 failed its falsifier and 030b224 was hollow |
| 09-25 | 827a218 | ▲ "5.1 detector sweep landed" | A read resolver carried write data inside a swallowing catch. 1c7833b wrote `node:null` through all gates |
| 09-26 | 7d7bf0a re-created the duplicate `llmCompletion` Map key | — | **Still live** at llm-resolver-vessel/src/index.ts:1528-1529 |
| 09-26..27 | Partial exact-edit landings graded reached: f49d02e 4/5, 24a64a8, 3cced35 1/3. 3.5 all-edits floor b9537eb | ▲ "3.5 floor landed" / ▲ "4.7b cleanup reached" | The floor fires (see §5), but its box in tasks.md is still `[ ]` and the maxOps silent truncation is unfixed. 4.7b applied 1 of 3 edits |
| 09-27 | b585a03 created the checked directory (`mkdir -p`) to satisfy an existence falsifier. a198907 satisfied a class-1 literal with an env-gated const read only by a log line | ▲ 21:47Z "reopen at $2/h with verdict machinery in place" | 5 autonomous landings, 5 reverts (12c7d9a, 4068e7e; both are hidden under `route-edit-*` subjects). The system certified 3 of them as verified |
| 09-28 | 70d8fd0 FABRICATE lens. 5e9a0b2/fad0d3c revived the post-land suite | — | See §5: the suite runs but does not discriminate |
| 09-28 11:26 | 9d839e0 "sync vessel code" committed 422 `.bun` cache files plus gaps.json and learning-mode-state.json | — | 66ba773 removed the cache, but `gaps/gaps.json` and `state/learning-mode-state.json` are **still tracked** (verified) |
| 09-28 15:11 | **3d4f138** added a new `src/trace-store-reconcile.ts` (26 lines, POST to an invented `/v2/trace-store/reconcile`) | — | **Verified unimported**: the importers reference `src/seed/trace-store-reconcile.js`, a different file. It landed with post-land `ran=true pass=2314 fail=25` |
| 09-28 16:34 | The joint_liveness_detector's goal "investigate and decompose: joint SEVERED behavioral-verification-input" | — | The walk invented the shapes `behavioral_verification_input`, `…_output` and `…_report` and filed 3 capability gaps, all closed as `walk_artifact`. Nothing was repaired |
| 09-28 21:19 | 9c86aff: env-gated dead branch (reports-6) | — | Landed with `ran=true pass=2314 fail=25` |
| 09-29 04:23 | goal-host `Failed to resolve SHA … 401` | — | 413 occurrences since 09-28 04:30 (5,015 since 09-25 per the class file) |
| 09-29 04:28 | `severed-joint-behavioral-verification-input` re-filed (open) | — | The system itself says the effect verifier has no input |
| 09-29 | Session-end hook dispatch #171 | ▲ (06-16) "consolidates session learnings" | 171 dispatches. The latest went HOLLOW, then counted as a floor reach by *reading* memoryNote. Learned as a "4/5 reached" pathway |

## 2. Root causes

1. **Every gate reads the diff; none executes the changed line where it is consumed.** This covers typecheck, grep-reachability, the LLM judge and refuters, vacuous-edit, dead-store, stub, header-only and zero-delta. Each one closes one *surface form* of hollowness at one grain (symbol, parameter, field, branch, literal), and the class reappears at the next grain (memory-4). Write-only-ness is not decidable from a diff: the write-only-identifier gate was reverted on 08-10.
2. **Credit is keyed to a proxy that the minimal edit satisfies.** The proxies are a landed sha, the presence of a literal (class-1 `expected_literal`), an existence check, a count (the "zero `{{…}}`" metric) or `addresses:true`. When the check is the target, the drafter finds the cheapest satisfying edit. Examples: a198907 (log-only reader), b585a03 (fabricates the directory it checks for), 68fe034 (bogus literals), and db-admin (the gap id written into code). This is Goodhart's law, driven by weak falsifiers written in the same narrow vocabulary as the draft.
3. **Gaps with no predicate close on the landing alone.** `pending-land stamp … predicate=none (sweep will close as landed_verified)` appeared in 15 of 34 stamps since 09-26 on substrate-live. In 08-31 measurements, 1,366 of 1,368 gaps had no predicate. Hollow landings then either seal the gap for good or are re-composed without end.
4. **Re-composition is neither idempotent nor aware of a no-op.** Examples: 7 duplicate switch arms, 7-landing oscillation, spool replay 4×, `interpolateBoundValues` 3×, duplicate `llmCompletion` key, recommit children landing after the parent was already fixed (85b4c01), and `-narrowed` children undoing their parents.
5. **Landings are verified where they are edited, not where they are consumed or deployed.** Examples: obsidian `main.js` was never rebuilt (194 autonomous commits, 0 touching the bundle), seed-template landings stay inert until the seed re-runs, origin changes did not reach live because of a stale mirror index (a81c46f5), and gaps were closed for resolvers that no activity invokes (dc18b62). Closure was keyed to "a producer exists", not to "the capability is consumed".
6. **Residue shares the production landing channel.** Canary fixture toggles made up 71 commits (9% of autonomous commits) and 161 inverse pairs. Rhythm sync committed runtime state. Build output was committed beside `.ts` (542e712, 4e4170a8).

## 3. Why it recurs: the missing shared capability

The system has **no generator of consumer-side observables**. Nothing produces, when a gap is filed or decomposed, a machine-checkable statement of the form "after the fix, *this consumer* reads *this value* / *this probe* returns *this*". And nothing binds the result of running that statement to credit and closure.

The seam for it already exists and has been starved for 79 days. `runBehavioralVerification` (vessel-mitosis-cutover.ts ~2900, 399bb2c, 07-12) runs `classification_metadata.verification_spec` after a landing, writes `verification_outcome`, and withholds `landed_verified` on failure. **0 of 6,279 live gaps carry a `verification_spec`, and 0 carry a `verification_outcome`.** The comment in the same file says so directly: *"returns {ran:false} otherwise — which is the common case, so most landings were verified by nothing"*. The system's own joint_liveness_detector filed `severed-joint-behavioral-verification-input` at 04:28 on 09-29.

Every attempt in §4 except 399bb2c added another diff-shaped refusal at the gate. The one attempt aimed at *effect* never received an input. That is the same issue recurring for the same reason. Each new surface form of hollowness is handled by an operator-authored gate, and **all four open hollow-class gaps are `human_reported` with `falsifier=none`**. The detector that should have generated those gaps is missing (law 6), and so is the reader of the observable (law 8: the load-bearing fact, meaning what the consumer must observe, is never available at draft or verify time).

**Capability and seam.** The capability is **consumer-effect verification as a shape**. The seam is the gap record's `classification_metadata.verification_spec`, written by gap filing/decomposition (gap-lifecycle, decomposeGap) and read by vessel-mitosis-cutover `runBehavioralVerification`, whose outcome is carried on `cutoverApplied` and read by the pending-land sweep. It must be an activity (law 2): selectable, graded, and resolvable on whichever node holds the consumer (law 11). It must not be a new gate form.

## 4. Prior attempts at the same capability (verify effect, not diff), and why none held

| # | Date | Attempt | Why it did not hold |
|---|---|---|---|
| 1 | 05-30 | F13 proxy-catch removal plus convergent validity in engine.ts (ddcb402, ebb49829) | It grades task success, not consumption. inv-083 the same day showed a success trace with `err_` outputs |
| 2 | 06-25 | Typecheck plus shape-dispatch as the FAVORABLE landing gate | Landed a zero-caller `recordOutcome` with an empty body |
| 3 | 06-25..07-01 | Semantic cutover gate: grep reachability, haiku judge, computeDataFlowFacts | Reads the diff. The class recurred 3× on 07-01 and again in 09-15 and 09-19 |
| 4 | 07-12 | **Behavioural verification 399bb2c** (`verification_spec`) | **The input was never generated.** transcripts-4 measured 0 of ~6,100 gaps in September, and I measured 0 of 6,279 today. Per transcripts-4 it also fires before the restart |
| 5 | 07-21 | `reached=!!landedSha` (bfc6af1), stagedNotLanded (d679cfb) | A sha proves presence, not effect. d679cfb was a phantom fix, and staged≠landed recurred on every new route |
| 6 | 07-29 | Target-touched floor 9caa43c, zero-caller hard-fail 36d6db8, stub detector 3641a1b | Each covers one grain. Hollow landings passed at parameter, branch and field grain (dd34918, a803852, 776391a) |
| 7 | 07-31 | Edit post-state oracle 1ac5f0e: the requested symbol must appear on an added line | Symbol presence is not effect. Dormant until a restart, abstains on REPLACE, main path ungated |
| 8 | 08-05→ | In-vessel post-land test_suite 2ddcac0 | Dead 08-31→09-28 (shell 30 s). Revived by 5e9a0b2 but only *observes*, runs only pre-existing tests, and does not exercise the changed line (§5) |
| 9 | 08-10..09-24 | ≥9 per-form vacuous and hollow gates (f960423 … 06fabe9, ede0030, 0896a1c, 326a983/212408a/0874216) | Each closes one form. 06fabe9 was inert on arrival. ed313f2 loosened the guard autonomously. False refusals (log demotion 09-25, string-only fixes 09-13) |
| 10 | 08-14 | Class-3 "first landing = pending" plus close-oracle (landedCommitVerdict, per-class Beta) | Correctly refuses to trust a landing, but has no positive signal to move to `closed`. Nothing reads the posterior. Predicate-less stamps still close (§5) |
| 11 | 08-17 | Per-test baseline delta; 4 detectors with negative controls | Observes rather than gates. Misattributed 31f1d67. Later execution of the detectors is unknown |
| 12 | 07-27..08-26 | External-oracle harness family (validation/scripts) | Run only by the operator. Nothing schedules it, and its ports are hardcoded |
| 13 | 09-02 | 50f7560: ask git for late landings before grading | Defeated by f375f10's unauthenticated `goal_path_sha` (401 every call; 413 since 09-28 04:30) |
| 14 | 09-15 | `hollow_write` compose_lesson in the drafter scope | A lesson is not a check. `times_succeeded` is 0 on all 57 lessons |
| 15 | 09-24 | Class-1 `expected_literal` falsifiers with a "reader" field (decomposeGap v1.1) | Satisfied by a198907's log-only reader. Literal presence is a diff property |
| 16 | 09-27 | All-edits floor b9537eb, no-gap refusal a188771 | Handles one grain (partial apply) and fires. maxOps truncation is unfixed |
| 17 | 09-28 | FABRICATE / DESTROY / SATISFY-STALE-TEST refuter lenses (70d8fd0) | Still an LLM reading a diff. It came after b585a03 had passed the judge |

The pattern: 16 of 17 attempts judge the text of the change. The one that judges its effect (#4) has had no producer of its input since 07-12. #8 now runs, but on inputs that cannot discriminate.

## 5. Current verified state (2026-09-29, read-only, both nodes)

**Landing volume (both push clones agree, same origin), since 09-26.** 177 `Substrate Autonomous` commits across 10 vessels: 146 carry `route-edit-*` subjects (edit-intent goals, mostly operator-dispatched; this split is by commit subject, not by the `operator:<id>` dispatch tag) and **31 carry gap-lane subjects**. development-vessel alone accounts for 119. Of the 31 gap-lane commits, at least 9 are hollow, duplicate, reverted or residue: b585a03 and a198907 (reverted by 12c7d9a and 4068e7e), 9c86aff, 3d4f138, 9d839e0, 85b4c01, and the spool replays c8a354b/e439193 plus the template-provider layering. Reverts are hidden inside `route-edit-*` subjects, so `git log --grep revert` undercounts them.

**Post-land suite, split by node.**
- `substrate-live`: since 09-20, `vessel=development-vessel ran=false` 80 times and `ran=true` 0 times. activity-api ran=false 6 times. The last post-land line was 09-28 15:52. Since 09-28 07:30 its ran=true runs were for ias-executor (365/11), concept-db (145/2), local-tools (13/2) and boredom (2/0).
- `compose2-live` (which lands development-vessel now): dev-vessel went `ran=false` until 5e9a0b2 (09-28 07:09), then `ran=true pass=2314 fail=25` on **every one** of the 20 dev-vessel landings from fad0d3c (07:28) to f451e42 (09-29 01:37). That includes 3d4f138 (unimported file) and 9c86aff (env-gated dead branch). The counts are constant, "NEWLY failing" fired 0 times, and the 25 standing failures are never attributed. The suite is a regression detector over tests that already existed. It is not an effect probe.
- `[fc-coverage] TARGET HAS NO TEST FILE … a FAVORABLE verdict here means the change was reviewed, never executed` appeared 163 times on substrate-live since 09-26 (74 for human-surface proxy.ts, 35 for local-tools index.ts) and 91 times on node2. It is warn-only.

**Credit and closure.**
- Gap store (substrate-live, the hub copy): 6,279 gaps. `verification_spec` 0, `verification_outcome` 0, open gaps with `pending_outcome_verification` 158. The node2 local file (`compose2-live`, which lands development-vessel) holds only 70 gaps, also with 0 `verification_spec` and 0 `verification_outcome`, and it does not contain the severed-joint gap. The node that lands the most code keeps almost no gap state locally and resolves gaps through the hub (see node-locality).
- `pending-land stamp … predicate=none (sweep will close as landed_verified)`: 15 of 34 stamps since 09-26 (substrate-live).
- Floors that fire: `all-edits floor: WITHHELD FAVORABLE` and `autonomy-scope floor: WITHHELD FAVORABLE` (6+ on node2 on 09-28, 6 on substrate-live since 09-26).

**Still-live hollow residue (verified).**
- activity-api `src/routes/db-admin.ts:200-201`: `WHERE db_integrity_auto_repair_has_never_run = false`, an invented field (last touched 3868bc6, 09-05).
- llm-resolver-vessel `src/index.ts:1528-1529`: duplicate `["llmCompletion", …]` entry.
- development-vessel: `src/trace-store-reconcile.ts` is unimported (3d4f138).
- development-vessel still tracks `gaps/gaps.json` and `state/learning-mode-state.json` (`git ls-files`).
- goal-host `src/index.ts:34` sends a `goal_path_sha` request with no auth, logging `401 Unauthorized` (last seen 04:23 on 09-29).

**Open hollow-class gaps, all `human_reported`, all `falsifier=none`.**
- `autonomous-landing-fabricated-the-checked-thing-…` (09-27)
- `a-class1-literal-step-is-verified-by-a-hollow-write-…` (09-27, directed)
- `an-exact-edit-goal-can-land-with-some-of-its-edits-silently-dropped-…` (09-26)
- `the-trace-sink-spools-…` (open, with pending_outcome_verification set after 4 landings)

**The one machine-detected signal is the right one, but no repair followed.** `severed-joint-behavioral-verification-input` (joint_liveness_detector, open 09-29 04:28). The first walk it triggered, on 09-28 16:34, invented three phantom shapes and closed them as `walk_artifact`.

## 6. What to keep

These are kept because each has observed real catches, and together they form the base of the retire path:
- `runBehavioralVerification` plus `verification_outcome` writeback (the seam; it needs an input, not a replacement)
- post-land test_suite (as a runner)
- joint_liveness_detector (the continuous checker)
- all-edits floor and autonomy-scope floor
- class-3 "first landing = pending"
- 5efe707 empty-listing refusal
- pwt semantic judge 21da981 (2 real refusals)
- vacuous-edit deterministic checks (positive controls)
- refuter lenses
- `hollow_walklog_capped` precedence
- `deterministic:no-oracle-for-goal-class`
- failure memory (1,460 hits in 7 days)

Treat these as fossils, meaning cleanup targets and not mechanisms:
- `/header_added` and the probe headers
- the db-admin invented predicate
- the duplicate llmCompletion key
- the unimported `src/trace-store-reconcile.ts`
- the 3× interpolateBoundValues and the duplicate quarantine helper
- the goal_summary producer
- the `orphaned-capability-resolution` openspec placeholder
- the tracked runtime state in development-vessel

## 7. Retire condition (measurable, checked continuously)

The class is retired when all of the following hold together over a rolling window of **30 consecutive gap-lane landings, counted with author split** (route-edit operator dispatches excluded):

1. Every `cutoverApplied` carries `post_land_suite.ran=true` **and** a `verification_outcome` keyed to the landed sha. The outcome must come from a `verification_spec` that names a consumer-side observable (a reader, route or probe other than the edited line), and `passed=true` is required for `landed_verified`.
2. `pending-land stamp … predicate=none` count = 0. No gap closes `landed_verified` without a `verification_outcome`.
3. Zero of those 30 landings is reverted, or graded hollow by an operator verdict or a detector, within 7 days of landing.
4. `severed-joint-behavioral-verification-input` reads healthy on every joint_liveness_detector tick (≥1 open gap carries a `verification_spec`) on **both** nodes.
5. The next new hollow form is filed by a detector (`source≠human_reported`, `falsifier≠none`) before the operator files it.

The joint_liveness_detector plus the pending-land sweep journal lines are already emitted. They are the instruments for checking this, and no new counter is needed.

## 8. Related classes

false-verification (the judge side of the same green-over-broken super-class); dormant-mechanism (399bb2c, f2857fc, e62a5d9); codebase-bloat-fossils (residue from hollow landings); autonomous-regression; gap-content (predicate-less gaps; `falsifier=none`); write-read-mismatch (reader without a writer: 5c1c7d2, c89861b, goal_path_sha); narrowing-duplicates (recommit/narrowed children re-landing); node-locality (post-land verdict differs by node); sync-deploy-drift (landed on origin but not live, obsidian bundle).
