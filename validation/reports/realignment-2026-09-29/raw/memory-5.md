# memory-5 — operator memory cache shard (files 301–375 of sorted *.md)

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md`, sorted, lines 301–375
(75 files, ~486 KB, `reference-db-congestion-livelock…2026-08-08` through `reference-gap-closure-is-mostly-ttl-expiry-not-repair-2026-08-28`).
All 75 read in full. Date span of findings: 2026-07-18 → 2026-09-20. Nothing was verified against the live system in this pass.
The notes record claims as the memory states them. Where a later note retracts an earlier one, the later note is cited.

---

## PART A — Recurrence chains by problem class (the "same issue, different hat" view)

### write-read-mismatch — THE dominant class in this shard
The same shape keeps coming back: a producer writes a field, id, shape name, path or envelope, and the consumer reads a different one. The join returns empty, and no error is raised.
- 07-24 success-shaped `{ok:false,status:404}` envelopes pass `rawResolve` because it checks only `success:false` → contentless reach (fixed ca52631/5fbea8f).
- 07-25 dispatch button matched `d.id`; entries key `dispatchId` (fix 1cf797b inert → d2c8245).
- 07-27 produced VALUES were never persisted (mirrorWalkState dropped `im.content`), and human verdict `notes` are write-only dead storage.
- 07-31 composition endpoint swallowed every new edge (org_id from `$auth` on root connection). verification_outcome had 1 writer and 0 readers.
- 08-03 analysis-vessel put errors inside a success envelope and they were narrated as content (f6af48e). Shape usage views never parsed.
- 08-04 drafter filters `architecturePrinciple`, seeder writes `architectural_pattern_principle`.
- 08-06 scaffold nests `resolverContract.resolve_endpoint` but discovery reads it flat and requires `systemVessel`, so generated vessels are unfindable. `gap-to-feature` passed `{goalShape,payload}` to a pointer lacking both fields and never dispatched in its whole life (removed 5a25f9c).
- 08-10 pwt rescue read `gap.file_path`, which 0/360 gaps carry (they carry `classification_metadata.edit_site`), so the rescue never ran once (2a8ebf5). Region grounding read `gapMeta.region` (0/402) → dead until 11f10af.
- 08-11 Hono route shadowing made 4 selection-observability endpoints and 6 react-renderer write shapes unreachable.
- 08-19 goal-host advertises `goalDispatchAsync` but a probe used `goal_dispatch_async`. Peer and local resolve envelopes differ.
- 08-28 the gap↔landing link is only a goal-text prefix `Close substrate gap <id>:`, and `variables.gap_id` is discarded.
- 09-02 `substrateGap_write` reclassifies category. Calibration lives at `/workspace/expectation-calibration.json`, not in gaps.json.
- 09-05 feature_compose rows are keyed `exec_<ts>` (activity-api mints the id and `void fetch` discards it), while reach verdicts are keyed `feature_compose:<sha>`. Result: 868/873 compose executions are never graded. The note calls this "4th instance today".
- 09-13 a raw NUL separator makes 8 sources grep-invisible, so gaps are mislocalized to the wrong file.
- 09-20 path table `goal_execution_paths` (plural) vs a singular ghost table.

**Root pattern:** there is no single schema or contract seam between writers and readers. Every fix was a local patch, and nothing detects the class. The laws the notes derived ("ask the consumer, not the store"; "a renamed field across a boundary is the dominant silent failure") were written for the operator and have no runtime reader.

### false-verification — second-largest class, and the one most often "proclaimed fixed"
The chain runs from the 07-24 contentless reach through the 07-25 LLM judge greening raw blobs, the 07-26 derivation-split inversion, and the 07-30 gamed metric (honest 33% vs self-reported 92%). After that:
- 07-31: an edit reached if a sha landed (post-state oracle 1ac5f0e/af86945), and a false-credit stamp ignored behavioural verification (0bd32ff).
- 08-03: hollow_walklog veto.
- 08-06: classifyExecutionPath booked the floor as learned_pathway.
- 08-08: relative-path fs_write returned ok:true while writing the wrong location (reach-inflation engine). 68.4% of "reached" was satisfier artefacts. Selection was steered by exit status: 021/023 views count `success`, and success is 92% green while honest reach is 1.67%.
- 08-10: landed sha ≠ requested change.
- 08-17: a floor that never ran was graded as failed.
- 09-09: method-shared "independent" recompute. A gap-record mutation redirected the falsifier, and the gap closed 29 minutes before its fix landed.
- 09-12: edit-intent acceptance set `reached:true` unconditionally (b97e2d0).
- 09-19: oracle title capture included a period, which drove R to 0/6.

**Root pattern:** reach is decided at many independent return sites, and they disagree about what "reached" means. Per the 09-12 note, one file had 31 `reached: true,` sites. Each site gets its own patch, and a new site then reappears.

### gap-content / narrowing-duplicates / calibration-seal
- 07-26: gaps.json is git-tracked and multi-writer, and the count collapsed 683→417→51.
- 07-24: the gap store was split between the old `/workspace/gaps` and the new super-repo path.
- 07-29: `-narrowed` child ids were introduced (449949c).
- 08-06: goals shredded by `slice(0,400)`, first-sentence re-mint and tail-keeping caps (9cd1dd7, 18c50ae). Prefix accretion reached 81 generations.
- 09-05: decompose STILL copies the parent truncated at 400 chars in 66% of cases, which launders `hopeless()`. The 08-06 fix did not hold, or another path does the same thing.
- 08-10: gap summary is frozen at first filing, so a retry is the same try. One gap was composed forever (f93d431, 437cb7e).
- 08-29: the escape valve had 4 links and every one reported success. `provide_information` writes nothing the composer reads (open).
- 09-02: 13 categories are sealed. One landing immunizes a category forever.
- 09-11: closure is bimodal. `close_basis` is written on 0.5% of closes and `resolution` on 3%.
- 09-13: an operator-filed unlandable gap grew 1→3 via -narrowed/recommit children and ate the single compose slot.
- 09-19: moot-compose churn: closed and narrowed gaps keep composing (unfiled).

### sync-deploy-drift
- 07-25 pull-sync stuck on dirty tracked paths, and a detached HEAD clobbered the obsidian bundle.
- 07-26 three trees per vessel: `/vessels/<v>` runs, `/workspace/git/vessels/<v>` is the deploy source, and the super-repo submodule pointer lags.
- 07-29 and 07-31 mirror happens without a restart, so goal-host fixes stay dormant until a restart. Keys drifted through EnvironmentFile ordering.
- 08-06 pull-sync defers while units are in flight.
- 08-08 an uncommitted cutover in the super-repo submodule copy crash-looped dev-vessel 1541×.
- 08-09 `make restart-<v>` poisoned the pwt baseline (third tree).
- 08-10 federation transport was never `bun install`ed.
- 09-09 self-edit suicide race.
- 09-19 `${A:-$B}` shadowing on cold boot.

### node-locality / federation-p2p
- 07-19 the relay lives on the VM host and outside volumes, which re-bit the 08-10 migration.
- 07-29 dev-vessel was added to the hub with its own DB, which split gap and memory state from the spoke. There were four federated-visibility onion layers. A redial storm was fixed (2c247adc and follow-ups).
- 07-31 hub-native vessels were never dialable (one-way break).
- 08-03 hub port 18260 was not published, so the drafter had zero lessons.
- 08-09 hub/spoke role groups exclude `autonomy`, so all 42 self-development units (gap-compose, operator-goal-generator, compose-teacher, self-repair) are masked on ANY federated node.
- 08-10 the spoke registry drained to 0 because identity lives on the hub.
- 09-02 flavour-masked services left their timers armed, which made up 92% of hollow reach.

### selection-learning
- 07-24 beta frozen at 1.0 (success-only credit). Boredom re-hammered a 0/1865 template.
- 07-31 a NaN in selectArm pinned haiku deterministically (3839090). Reach→arm grading plumbing is dead code with zero callers.
- 08-08 views grade on exit status.
- 08-11 untried prior short-circuited by a stored beta:1.
- 08-12 lexical rebind keys on wording, not the data store.
- 09-05 74% of arms have n=1. No compounding: "what improves is what gets FIXED". 11× short of the evidence rate needed.
- 09-06 a "collapsed choice points" claim was falsified. Competition exists at output-shape grain (httpResponse, 4 producers), but the router is degenerate and the boredom pin sits outside selection.

### drafter-quality
- 07-22: localizer anchors on prominent early lines. `rg` is not installed, so the symbol-list fix was inert.
- 07-26: duplicate-function drafts.
- 08-02: anchors invented rather than stale (306 UNFAVORABLE/0 FAVORABLE per 24h).
- 08-13: insertions land inert 3/3 while in-place modifications succeed.
- 08-11: hallucinated `router.get` despite verified anchors being supplied.
- 08-29: a verified-unique anchor was vetoed for distance.
- 09-11: the planner chose its own non-unique anchor.
- 09-12: `no_unique_anchor` against 31 repeated sites.
- 09-19: 16k-line files need one inline block with a short comment anchor.

### dormant-mechanism
Built, then never used or extended:
- decomposition primitives (`maintenance/`, 796 lines, orderChangePlan/scoreSpliceability, invoked by nothing)
- reach→arm grading (model-policy.ts)
- region-scoped grounding (until 11f10af)
- extractionPolicy/extractionEligibilityPolicy (unresolved, so hardcoded fallback)
- `ingest-docs.timer` (masked, never ran)
- the 42 autonomy units on federated nodes
- composition graph frozen since 07-28 with no live edge writer
- transport-health-observer (unscheduled)
- spectral-gap live_lambda1 flat zero since 07-15
- eval-ablation, falsification and validatability harnesses (Python, operator-run; no evidence of standing use)
- store-override 182dbf3d
- the pwt rescue path (never ran until 2a8ebf5)
- the edit post-state oracle (dormant until a restart)

### trace-store-db
- 07-24: surreal at 708% CPU; trace_digest held 802K rows unreaped.
- 08-08: execution table at 18GB with a self-recovery livelock. Retention DELETE cannot prune past 16 indexes.
- 08-12: hub trace writes timing out (17GB).
- 08-03 and 09-20: migrations 045/055/023 never parsed or never entered the `init_migrations` ledger.

### env-gating (law 1)
- 07-26 evaluability audit root: behaviour is steered by env and constants.
- Empty-string-as-present env keys (GOOGLE_API_KEY, 5 providers not gated on key).
- POSTERIOR_COALESCE defaults ON through env.
- CONCEPT_DB_ENDPOINT unset → loopback default.
- EXPECTATION_CALIB_PATH unset.
- RELAY_MULTIADDR stale.
- extractionPolicy hardcoded fallbacks.

### docs-drift
- 07-24 docs cite deleted minibob as the live executor, plus dead links and the MDP gamma mismatch.
- 08-06 9/9 absolute line-number citations in comments are wrong.
- 08-04 the docs restructure was premised on docs being drafter grounding, but grounding was severed.
- 08-08 a CLAUDE.md claim was refuted: "satisfier reaches common" (0 in 41,600).

### codebase-bloat-fossils
- 08-06 dead files and symbols inventory.
- 08-08 fs_write graveyard under `/vessels/local-tools-vessel` (unrendered `{{dirPath}}`, `path/to/…`).
- 09-13 dead `db/trace-digest.ts` writing a 0-row table.
- 07-24 god files: activities.ts 10.5K lines, goal-host index.ts 7.8K growing to 16k by 09-19. `clock-vessel` has no entry point.
- 07-26 fossilized inverted composite template `learned-composition-json-path-extract-to-filecontent`.

### autonomous-regression / directed-overshoot
Autonomous regressions:
- 5697f70 / 0f794d2: typecheck-blind differential gate; dev-vessel down.
- 2fe3750: duplicate `let`, goal-host crash-loop.
- 9775bc8: deleted 12 lines of Thompson code with TS1128.
- 3130a55: clobbered the operator's working gate with an inert one.
- 8340f57: stale-base full-file overwrite.
- 1be9f4f: cutover clobbered ca52631.
- The endpoint-swap loop (266).
- 2143dda: spam-logging insertion.

Operator overshoots:
- abf60661 silently reverted a parallel session's ea5882bd.
- The 07-31 hardcoded sonnet-5 was reverted.
- `git push` from a detached HEAD falsely confirmed a push three times.
- The operator poisoned the pwt baseline via `make restart`.

### spend-envelope-throughput
- 08-10 every LLM arm credit-dead: one provider out of six had a key.
- 07-29 the plane was down with "empty libp2p resolve".
- 09-19 ANTHROPIC key 401 and OpenRouter account exhausted despite key headroom.
- 09-05 the pre-cutover `bun test` gate saturates the box.
- The single compose slot is starved by unlandable gaps.
- E5 site-saturation cap starved operator gaps (7d48a277).

### memory-recall
- 07-18 fork flagged testimony-shaped memory with no transcript.
- 07-29 the hub dev-vessel created a separate memory and gap state.
- 08-03, 08-04 and 08-12 the compose_lesson channel was reported unreachable, then populated via discovery. The direct store query hit the wrong instance.
- 07-30 compose_lesson was write-blocked (401) and the lesson content was cached in operator memory instead, which teaches no one at runtime.

---

## PART B — Detailed per-note notes (grouped per reading batch, keyed by problem class)

## Batch 1 notes (files 301-308)

### trace-store-db
- 2026-08-08 [reference-db-congestion-livelock...]: hub syzygy.host execution table 18GB, surreal 429% CPU/20.4GB RSS, disk 94%. LIVELOCK: self-recovery-tick probed DB with `RETURN 1;` (answered by planner, no storage) -> concluded vessel broken -> restarted activity-api 16x/6h -> each restart ran full migration chain on 18GB and killed the in-flight retention sweep (0/12 sweeps completed). Fix 0b3f70b2 probe `SELECT VALUE execution_id FROM execution LIMIT 1` -- NOT verified under load. Outcome: partial/unknown.
- Same incident: 556 failed INSERTs/90min on execution_trace_content UNIQUE index; fix b8baf26 duplicate row = success (worked).
- 17.67GB dangling docker images removed; disk 94->68%.
- STILL BROKEN: retention `DELETE $ids` times out at batch 1000/100/25; execution has 16 indexes, >=4 redundant (idx_execution_id on id, idx_execution_activity prefix, idx_execution_org prefix, idx_execution_success card 2). Not dropped. (Recurs: see 09-25 trace store unreclaimed blobs in index.)
- Law: a health probe must do REPRESENTATIVE work.
- Error: first blamed the wrong guard ("skip activating units" already existed) -> read the script before naming the missing piece.

### sync-deploy-drift
- 2026-08-08: development-vessel crash-loop 1541 restarts: uncommitted mitosis cutover deleted anchor lines leaving orphan `return`+`}` -> `Unexpected case`. It lived in /workspace/git/super-repo/repos/development-vessel (what unit ran) while pull-sync converged /workspace/git/vessels/ -> pull-sync failed=1 every cycle while both clones looked clean. Fixed by git checkout --. (Recurs 09-22 "unit WORKSPACE_ROOT vs env-file super-repo" two stores.)
- 2026-07-25 [deploy-pull-sync-unblock]: pull-sync ff-only stuck on goal-host + super-repo; prior framing "diverged/staged mitosis debris" WRONG -- both HEADs ancestors of origin/dev; refused due to redundant dirty tracked paths. Fix: reset --hard origin/dev on in-container clones -> synced=2. Lesson: check `merge-base --is-ancestor` first. Worked.
- 2026-07-26 [deploy-topology]: three goal-host locations: /vessels/<v> (running, no .git), /workspace/git/vessels/<v> (deploy-source clone, converges to vessel repo origin/dev), /workspace/git/super-repo/repos/<v> (submodule pointer, lags, NOT what runs). Misjudged goal-host "behind at fc297b4" from pointer. Correct liveness: content_hash of clone src vs /vessels src + process restarted after mtime. Super-repo clone diverged (d7e08d64 mitosis stash, 97941afe stray gap-filepaths.txt; cb28e450 content_hash fix stuck undeployed); pull-sync files gap pull-sync-diverged-super-repo and refuses force (by design). Reset reverts tracked runtime snapshots gaps/gaps.json, pool/standing.json (runtime state in git = later law: gitignore runtime state).
- 2026-07-25 [detached-head-clobbers-host-obsidian]: obsidian-vessel host tree detached at 4536bac (07-20), 23 behind origin/dev 41567f8; stray `npm run dev` watch build clobbered production main.js (12202 lines, inline sourcemap). 2nd detached-HEAD occurrence (1st goal-host). Rule: `git checkout dev` after inspection checkouts. Worked.

### endpoint-routing
- 2026-08-03 [deadvertise-to-hub]: bc7ef13 (shaped selectArm fallback) + b230667 (markExhausted anthropic 30min on no-fallback) -> credit-dead spoke llm resolver de-advertises; discovery routes llm_completion to 4 hub arms over libp2p. VERIFIED from caller side (registry_query on spoke). Worked.
- BUT ribosome-vessel/src/replay-observer.ts:44 pins `LLM_RESOLVER_VESSEL_ENDPOINT ?? http://127.0.0.1:8220`, never consults discovery -> ribosome historical replay (variant-minting backfill) 100% blocked. No resolve-shape-to-endpoint helper in ribosome (GOAL_HOST_ENDPOINT :88, ACTIVITY_API_ENDPOINT also pinned). Not fixed in this note. (Recurs: 09-22 resolve-URL joiner, 09-22 pinned :8270 escalations.)
- Method: test a routing change from the caller's side, not the server's. Cycle 2: 8 of 13 proposed fixes were regressions -> don't guess.

### gap-content / narrowing-duplicates
- 2026-09-05 [decomposition-echoes-its-parent]: of 50 "investigate and decompose gap <id>:" gaps, 33 (66%, floor) have body prefix-identical to parent truncated at 399-400 chars; 5 byte-identical. Decompose = truncate parent + new id. Consequence 1: hopeless() seal (>=8 attempts/0 lands) laundered -- each echo resets failed_attempts=0; chain burned 14 attempts over 4 ids. Consequence 2: failure_lessons injected into drafter contradict the goal text copied forward ("Do not wire it into config.ts..."), instruction wins every retry. "A learning channel that can only append to the prompt cannot fix a defect that lives in the prompt."
- Gap consequence-verdict-writer-missing-for-goal-verification-labels (filed 08-26, operator) chain route-edit-774fbed0 -> d276bfa6 -> faeb2360: 14 failed attempts, 0 lands, idle 10 days. Both blockers in the SPEC: (1) import goal_verification_label from dev-vessel impulses.js (served by activity-api config.ts:379) -> TS2305 guaranteed; (2) "do not wire it in" -> zero callers -> dead-code gate correctly refused. Law: many attempts + zero lands => read the SPEC for a guaranteed-failure clause. Helper + call site in the SAME goal.

### selection-learning / write-read-mismatch (grading keyed to landed commits)
- 2026-09-05/06: 78% (38/49) terminal dispatches carry no learning signal (empty alphaBetaDelta, goalPathRecorded false, oracleLabelWritten false, no gapsFiled); 33 of 38 run-goal; 33 = scaffold-loop bypass (boredom hardcoded template).
- BUSY capacity refusal recorded as status failed/reached false with synthetic `goal-seek:no-trace:<hash>` id AND evicts reached-command cache + tombstone. Non-attempt stored as failure (causal misattribution). Only 4 BUSY/hour, doesn't explain 78%.
- ROOT: two row families for feature_compose: `execution:<feature_compose:<sha>>` n=5 graded 5/5; `execution:exec_<ts>_<rand>` n=868 graded 0 (0.6% graded). Chain: feature-compose.ts:6185 `void fetch(/v2/activities/executions)` fire-and-forget; activity-api routes/activities.ts:1947 mints exec_ id always, ExecutionRecordSchema (models/schemas.ts:332) has no execution_id; response discarded by void; goal-host posts reach verdict to feature_compose:<sha> -> MATCHED NO ROW -> reached NULL forever. Minimal fix at link 4 (capture returned id via .then). goal-host index.ts:~1013 skip-list for walks that persisted no row (design deliberate). Class: "two stores name the same thing differently and the join silently returns empty" (4th instance that day). write-read-mismatch.
- Finding 5: gap-store self-repair feature_compose:04035e3a (reached true) banked 0 oracle labels (verified vs 3,244 labels positive control). Retention bias SUCCESS_CAP=600 vs FAILURE_CAP=2000.
- Instrument traps: goal-host /resolve envelope is `{"type":"activeDispatches"}` top level; wrapper gave "unknown shape undefined" read as 0. "A total of exactly zero is a broken probe" (instance 9). Query returning 7,113 vs 873 total = dropped predicate. Two-row sample is not the id space (retracted claim). Concurrent artifact is not your artifact -- match on id not mtime.

### goal-walk-floor / false-verification (derivation)
- 2026-07-25 [derivation-reach-guard-battery-v2]: verifyGoalReached@905 LLM judge greens raw fetched blob as derived answer; inferDerivationSplit (haiku) gated on seededOutputShapes>=2 never runs for single-seeded goals. Battery: Giv 4-part math reached-real (189/37.8/23/2 exact); Gi hollow (derivation-over-raw); Gvi hollow (satisfier-returns-wrong-instance: concept CREATE satisfied by READ of unrelated concept); Gii/Giii honest fail. Guard fix dispatch: feature_compose localizer miss (old_string not found) -> patch_with_tools staged not landed -> system cannot self-land the reach-gate guard. Workflow file:line confabulated (claimed @799; real @905). Gaps: gap-derivation-over-raw-hollow-green, gap-create-persist-satisfied-by-read-resolve-wrong-instance, gap-reach-gate-guard-unself-authorable-localizer-miss.
- 2026-07-26 [derivation-split-inversion-fix]: inferDerivationSplit (goal-target-inference.ts:344) prompt defined terminal only as write/emit -> inverted terminal=[fileContent] for derive-and-return. Fix bootstrapped 8989038 by operator (dispatch declined: feature_compose drafted DUPLICATE function TS2323/TS2393, tsc gate rolled back; patch_with_tools llm 502): prompt broadening + deterministic RAW_SOURCE_SHAPES guard. Verified A/B: hollow-green -> honest RED. No topology growth (json_path_extract needs unsynthesizable path param). Gaps: gap-reach-gate-greens-on-empty-derived-value, gap-fossilized-inverted-derivation-composite-templates (learned-composition-json-path-extract-to-filecontent selected+failed live). Outcome: worked (honesty), capability not added.

## Batch 2 notes (files 309-317)

### federation-p2p / node-locality
- 2026-07-29 [development-vessel-added-to-hub]: hub ENABLED_ROLES=hub excludes compute role -> apply-inventory masked development-vessel on hub; all dev-vessel shapes came from local spoke via libp2p. Live unmask + new generic `ENABLED_EXTRA_VESSELS` (apply-inventory.sh 999f2704, deploy-hub.sh, gen-env.sh 4f194536; round-trips via /workspace/.substrate-secrets because gen-env regenerates /etc/substrate/env each boot). /usr/local/bin copies NOT auto-refreshed by pull-sync. CONSEQUENCE: dev-vessel shapes have 3 owners on hub; hub's native dev-vessel uses hub DB -> independent gaps/memory from spoke (node-locality / memory split seed). Worked (capability); created split state.

### human-surface / env gating / sync
- 2026-07-29 [dev-vessel-key-drift-and-typecheck-blind-gate]: three-way METABOB_API_KEY drift; dev-vessel unit EnvironmentFile /etc/substrate/env THEN /workspace/.substrate-secrets (second overrides) -> stale key -> discovery 401 -> feature_compose `tools=false`, patch_with_tools "no local-tools vessel found" -> no edits could land. Realigned key (operator). Worked. (Same EnvironmentFile override class recurs 09-22 WORKSPACE_ROOT.)
- Typecheck-blind gate: vessel-mitosis-evaluate.ts L364-460 DIFFERENTIAL tsc error count; syntax error makes tsc bail early -> fewer errors -> FAVORABLE. Landed 5697f70 (TS2552 parentId out of scope, cargo-culted `-narrowed` pattern) and 0f794d2 (syntax errors, dev-vessel down). Reverted 3434f3e, db63bef. Gap gap-mitosis-typecheck-gate-differential-count-fooled-by-syntax-errors. Same class as 54f30e1. (autonomous-regression + false-verification)
- bumpFailedAttempts fix 449949c hand-landed: narrowed-child childRecord had no id -> gapClassKey(undefined) throws, swallowed by best-effort catch -> chronic-failure narrowing AND investigate-decompose escalation silently dead. Gave `${parentId}-narrowed` id (origin of -narrowed children; see narrowing-duplicates recurrence 09-22 "-narrowed child = verbatim dup").
- Gotcha: re-lint AFTER rebasing onto origin when the loop is landing.

### dormant-mechanism / sync: dev-vessel event-loop deadlock
- 2026-09-11 [development-vessel-stalls-and-the-watchdog-masks-it]: dev-vessel dark on 3-min cycle; systemctl active, /health 200 on demand, NRestarts=0 (external watchdog restarting). self-recovery-tick logs recovered_by_restart:1 every tick -> "a recovery counter that increments forever is a mask". Root: substrate-gap.ts:1046 `Bun.spawnSync(["systemctl","start","gap-compose.service"])` synchronous on request path; gap-compose watchdog-tick.ts HTTP-calls back into dev-vessel -> guaranteed deadlock. Duplicate log block 1047-57/1058-69. Two operator substrateGap writes lost. FIXED 61a6e46 (--no-block) substrate-authored via apply_proposal_as_patch + vessel_mitosis_cutover, verified behaviourally (0/96 non-200, gc-tick 17 fires). 2nd fix 4783f38 suppressed-spawn logged as failure (undefined !== 0), not behaviourally confirmed. Earlier incident: same spawn -> 27 concurrent typechecks at load 50.8.
- Error: called LLM plane dead while 17 commits landed overnight via 429 trickle -> "test the cheap edit instead of reasoning".
- Law: a unique anchor SUPPLIED is not a unique anchor USED (planner chose own non-unique anchor). Refusal is non-binding (patch_with_tools landed identical change after rollback, 3rd sighting). Reason strings mix provenance -> READ THE DIFF. After any write to dev-vessel re-read by id. Poll the artifact (ActiveEnterTimestamp) not the status field. One cycle is not an availability measurement.
- Repairs proposed: escalate after K consecutive restarts (consecutive-recovery predicate) -- status unknown.

### hollow-landing / false-verification (dev rhythm 07-25)
- 2026-07-25 [dev-rhythm-bootstrap]: operator direct-pushed goal-host 4c21c9d reach-gate honesty (edit-intent reaches only with edit-result shape) and patch_with_tools credit dev-vessel 7195eef + goal-host 780409e (read pushed sha from mitosis-applied.jsonl; grade reached true on landed sha). Filed gap-apply-proposal-hollow-substitute-clobbers-correct-staging: 8340f57 apply_proposal_as_patch emitted trivial `verifiedSubstance ?? false` and cutover full-file overwrite from STALE base 418923c9 clobbering patch_with_tools's correct concurrent staging. Remaining: cutover must rebase/3-way, serialize per-proposal cutover, diff-semantics gate (verifyPatchAddressesGap fail-open -> fail-closed).
- 2026-07-25 [dev-rhythm-reach-lessons]: f43d887 feature_compose landed correct execution_count edit (goal-paths.ts:389). verifyGoalReached had no edit-intent gate -> LLM judge greened a fileContent read. patch_with_tools (patch-with-tools.ts:335) ORPHANED (orphaned-capability-scan.ts:111), not Thompson-selectable, only reachable by hardcoded LATE escalation; staged-not-landed debris jammed pull-sync. Live proof dispatch f36a95d0.

### selection-learning / composition (lexical rebind)
- 2026-08-12/13 [differentiation-and-composition-are-one-defect]: W1 (count registry shapes) and W2 (count open gaps) both REBOUND same donor src 519bd392 via tryLexicalRebind (goal-host index.ts ~3157, ratio=LCS ~3342); reached-command cache 98.5% shellResult (1178/1196). Zero producer steps; walk reads nothing -> nothing to differentiate. "keys on wording, not work".
- Fix 8aa17cc (operator override after dispatched try rejected under degraded hub) content-store gate. Autonomous loop re-composed same gap route-edit-b82b60fb and landed 3130a55 replacing it with INERT inferStore (regex on store-ID literals from the gap doc). Repaired in place c477e07. Live firing never observed (condition didn't recur).
- Autonomy finding: landing robust; CORRECT EFFECT fails on INSERTION targets: 3/3 inert (3130a55, c6c93ab log inside if(!best), 2143dda log before loop spam). semantic-gate flagged 2143dda defect but did not block (FAVORABLE). vacuous gate refused pure-logging on one path while others landed same class (gate not applied on every path). In-place MODIFICATIONS succeed: 82125c9, 6a65f9c (\bfind\b, verified).
- Non-commit goals: simple robust command reaches; complex command (backgrounded curl) fails honestly; compositional 2-store goal: 0 producer steps. Registry shape count churns 324/388/418 in minutes (oracle unreliable).
- Persisted reached-commands file != in-process cache (live donor not in file) -> ask the consumer not the store.
- Hub 18080 surrealdb latency 16.5s, trace writes timing out (17G no-blob-GC store).
- Tally-gap pollution loop gaps 31052fbc, a666de08, pwt-...-df0585e1.

### human-surface-escalation
- 2026-07-25 [dispatch-button-sticks]: goal-dispatch-view.ts settle predicate required status completed|failed; fix 1cf797b did NOT fix it (matched d.id; entries key dispatchId, 50/50). Real fix d2c8245. Lesson: verify the DATA SHAPE (field name) before trusting a condition. Class: reset predicate stricter than same view's partition -> derive from one canonical isRunning.
- 2026-08-19 [dispatch-was-the-one-thing-not-expressed-as-a-shape]: relay carries only shaped resolutions; /api/run-goal bespoke HTTP unavailable to peers. goal-host handleResolve accepted goal_dispatch_async || goalDispatchAsync but SHAPES (index.ts:998) advertised only goalDispatchAsync -> "no producer" = missing index entry, not capability. Envelope mismatch: peer {content:{shape,produced_by,body}} vs local {resolved,shape,body}; UI threw unless resolved===true (per-route unwrap forgotten). Commit 4e50f1fa encoded false limit (resolveOnly), superseded by 3b4f921a. Laws: check ADVERTISED spelling before concluding absent; before encoding "X impossible", check it's not merely unexpressed in the transport vocabulary.
- 2026-08-06 [do-anything-surface-design]: openspec/changes/do-anything-surface/ superseded 08-07 by openspec/changes/human-surface-stack/ (retire stateful-ui-vessel AND react-renderer). Do-anything input already exists 3x (Obsidian omnibox, MCP run_goal, federation goalDispatchAsync). SCAFFOLD DEFECT: development-vessel/src/seed/complete-vessel-scaffold.ts nests resolverContract.resolve_endpoint; discovery registry.ts reads flat and gates visibility on systemVessel===true||orgId; scaffold never sets systemVessel -> generated vessels unfindable by shape (write-read-mismatch). Reference bare vessel: relevance-sink-vessel/src/index.ts. metric-collector-vessel config PORT=8280 collides with light-dispatch. clock-vessel no entry point. Minimum vessel contract: /health + resolve dispatching on pointer.type; register + 60s heartbeat vs 5-min TTL; invariants: registration non-fatal, advertised shapes == dispatch cases (packages/shape-dispatch-check/), systemVessel true, served resolve path == registered. Research: 202 Accepted is not completion; S7 inaccurate self-reporting 22.58% (arXiv 2605.29442); gate early; show no confidence number; reasoning traces are not evidence. Obstacles: goal-host no CORS; REST GET /executions poorer than goalWalkState resolve; grounded-vs-interpolated not emitted.

## Batch 3 notes (files 318-327)

### selection-learning
- 2026-09-05 [does-the-learning-compound-measured-no]: n=34,314 executions, 1,207 arms. 896 (74%) arms n=1; >=100: 37. Of 37 high-volume arms only 7 have headroom; Spearman median -0.005. Early/late halves median -0.2%. "Improvements" are STEP functions (validator-dispatch 09-02->09-05, mitosis-tick 08-30) = bugs repaired. universal-tool-fallback oscillates, ends lower. 56% of high-volume execs are ticks (success="tick ran", reached NULL 100%). reached NULL 79.2% overall (27,189/34,314), TRUE 1.6% (546). n_eff needs 2.31 graded/arm/day vs actual 0.205 (11x short). "What improves is what gets FIXED. Nothing improves by accumulating evidence." Outcome: problem measured, unresolved.
- 2026-07-31/08-01 [drafter-model-selection-haiku-starves-capable]: compose drafting always picked claude-haiku. First theory: false-green-inflated haiku posterior 666.5/70.5 vs sonnet-5 1/14. ACTUAL root: NaN bug in selectArm (model-policy.ts:107) -- mistral-small cost_per_mtok null -> maxCost NaN -> all scores NaN -> argmax degenerates to arms[0]=haiku deterministically. Fixed llm-resolver 3839090 (`?? 0`), verified selection varies (6 haiku/3 sonnet). Cleared 44 corrupt drafting posteriors; cold-start (1,1) ee42e69/1782fda7. Law: when learned selection stuck, check NaN/degenerate argmax BEFORE theorizing posteriors.
- Arm graded SOLELY on resolved===true (llm-resolver index.ts:1067/1078); reach->arm plumbing (model-policy.ts recordPendingArmOutcome:193, gradeArmByExecution:207, recordArmOutcomeFromPending:224, llmModelPolicy_write:249) DEAD CODE, zero callers. dormant-mechanism. Honest arm grading = needs-design, unresolved.
- Operator principle 07-31: never hardcode which model; select WILLING+CAPABLE via shaped selection. Hardcode sonnet-5 (9a05ce76/70d93252) reverted (eb9a343c, 7eb43744). llm-resolver index.ts:1044-1057 pin-neutralizer; isModelWilling index.ts:885.
- parseReplaceTargetSymbol matchAll fix (af185b2a) verified NOT to fix its own motivating example -> law: verify a fix against its own motivating example.
- Identity trace.ts X-Internal-Api-Key header 12f270fa: 31 MISSING_AUTH -> 0.
- Open: goal-host main edit path index.ts:7107-7116 returns reached:!!landedSha with no verifyEditPostState.

### drafter-quality
- 2026-08-02 [drafter-confabulates-anchors]: 306 EARLY EDIT-INTENT feature_compose verdict=UNFAVORABLE /24h, ZERO FAVORABLE; 120 `old_string not found`/24h. Anchors INVENTED (process.env.LLM_ENDPOINT 0 occurrences), not stale. One cause two symptoms: invalid invention -> anchor miss; valid invention -> endpoint-swap lands (266, autonomous harmful endpoint swap loop). Landed 52928b8 (local-tools) fs_edit anchor-miss returns REAL surrounding lines. Measurement trap: grep `verdict` hits mitosis-cutover verdict=FAVORABLE (164) -> grep full prefix. patch_with_tools had no isolation (edits /vessels directly; out-of-scope identifier in RUNNING source); mitigated 2134839b pull-sync heals live-vs-clone drift; real fix = isolate like 8ec501b did for feature_compose.
- 2026-08-04 [drafter-grounding-severed-not-stale]: drafter has ZERO architectural grounding: (1) ingest-docs.timer masked, never ran (inventory declared but Dockerfile enable chain lacks it; apply-inventory only trims -> no path adds a unit), (2) concept-db masked on spoke, (3) consultPrinciples in feature-compose.ts reads unset CONCEPT_DB_ENDPOINT -> 127.0.0.1:8260 HTTP 000 -> catch returns "" silently. Adjacent consultProducers already uses DISCOVERY_ENDPOINT. Shape name mismatch architecturePrinciple (drafter filter) vs architectural_pattern_principle (seeder writes) -> write-read-mismatch. Gap drafter-architectural-grounding-severed. Law: repair the wire before authoring content (docs restructure changes codegen by nothing). Do NOT dispatch drafter fixes through the drafter.
- 2026-08-12/13 (batch2) insertions land inert 3/3.

### sync / trace-store instrument errors
- 2026-09-05 [dollar-14-posix-sh]: `$14` in sh = `${1}4` -> every per-process CPU measurement in 09-05 load investigation wrong; two retracted claims. Positive control (busy loop -> 0 ticks) caught it. Also `join` needs sorted input; ticks->% = ticks/N. Real: container ~590% = surreal 507% + two concurrent `bun test` (pre-cutover test gate). Law: sum of exactly zero across ~90 processes is a broken probe.

### docs-drift / domain breadth
- 2026-08-10 [domain-breadth]: spoke registry drained to 0 (identity on hub). Source-scan 250 declared shapes (registry last said 305): self 36.8%, report 20.4%, fs/code 17.6%, data/db 3.2%, web/net 2.4%. dev-vessel (91) + activity-api (63) declare 62%. boredom & ribosome parse zero shapes. Substring bugs (repo/report, patch/dispatch, source) inflated fs/code 44->73. Law: a category-count finding is only as good as a read of the category's MEMBERS.

### composition-crystallization / dormant
- 2026-08-09 [edge-liveness-found-the-ribosome]: edge_liveness_report (activity-api a6f5b9c): 59 edges, 17 never_succeeded, 3 regressed. ribosome-extract -> extractedTemplate 17/0. Ribosome correctly refuses to extract ungraded executions -> blocked on reach grading (#26). Corrected belief "ribosome mints 269x/day" (counted dispatches not extractions). Follow-up 3h: ungraded 181, not-reached 72, reached 12; reach-patch MATCHED NO ROW 3/31 (~10%, not 68%); most ungraded never had a verdict attempted. Recursion guard skips ribosome-extract's own traces. extractionPolicy / extractionEligibilityPolicy unresolved -> hardcoded literals (maxExtractionDepth 1) = law-1 violation (env-gating). Report bug: executed_at datetime vs typeof string; tests fed strings (fixed 6dfe3bc). Errors: "32 WS failures" = own restarts -> suspect the restart.

### false-verification (drift gate / edit oracle)
- 2026-07-31 [drift-gate-armed-in-mitosis-gate]: goal-host test/reach-routes-golden.test.ts (6bc12d5 parallel session) never ran in mitosis gate (baseRoot /vessels/<v> src-only, no test/); lint wiring 8478bc6 inert. Fix dev-vessel 3a3c1cb runGoldenDriftGate overlay temp tree, fail-closed on inconclusive. Verified live. Parallel session fixed 174-commit-stale detached-HEAD oracle clone (pull-sync `checkout -q dev||true` silently failed). Parallel-session coordination hazard. Next: inline selectors (ClassRow.selector SelectorDef).
- 2026-07-31 [edit-family-post-state-reach-oracle]: edit goals graded reached:!!earlyLandedSha (index.ts ~6638). Added verifyEditPostState/parseAddSymbol 1ac5f0e (abstains on non-add); v1 greened pre-existing symbol -> af86945 symbolInAddedLines (require symbol on + line). Dormant until goal-host restart (pull-sync mirrors but NEVER restarts). Removed orphan commentPercentage compute injected by 5e5b3bd. Gap compose-report-injects-orphan-counting-compute-into-unrelated-files-2026-07-31. Honest reach ~21% vs self-reported ~50% (2.4x gaming gap). Open: hollow-green-llm-judge-overrides-all-hollow-walklog (index.ts:2217). Falsification metric: held-out honest reach x verified-repair-close fraction x (1-recurrence).

### federation-p2p
- 2026-07-19 [edge-spoke-and-relay-design]: edge device = drop-in spoke; serverless edge = stateless-only producer (negative test for genre routing); DO-as-byte-relay fights platform; relay WSS listener OFF (RELAY_WS_PORT unset) gates all browser/edge reachability.

## Batch 4 notes (files 328-337)

### false-verification
- 2026-09-12 [edit-intent-acceptance-reports-reached-true-for-a-rolled-back-edit]: goal-host index.ts ~12866 edit-intent acceptance return sets `reached: true` UNCONDITIONALLY (verdict only interpolated into prose) -> rolled-back UNFAVORABLE edit reported reached. Sibling ~3638 `edit-intent-no-landed-edit` correct (239x/24h). "Reach granted for ROUTING not EFFECT". Credit/oracle corpus unaffected; damage confined to dispatch record reached boolean -> label-corpus reach vs dispatch-record reach are different populations. FIXED b97e2d0 substrate-authored, one line `reached: String(verdict).toUpperCase()==="FAVORABLE"`; pre-registered observable `reached: true,` count 31->30 held; activation by ordering (commit 10:52:09 -> runtime 10:52:11 -> process 10:52:41). Positive (FAVORABLE) case UNEXERCISED. First two dispatches failed no_unique_anchor (31 occurrences in 1.1MB file); landed after operator supplied verbatim two-line anchor = law-13 gap (widen non-unique anchor mechanically). no_unique_anchor 8/24h vs 172 FAVORABLE. Law: this fix makes reported reach LOWER; that is the point. Outcome: worked (partial verification).

### codebase-bloat-fossils / gap-content
- 2026-09-13 [eight-vessel-sources-invisible-to-grep-raw-nul]: 15 raw NUL bytes as composite-key separator across 8 files (activity-api execution-traces.ts:4372,4600; impulses.ts:5273,5287; cluster-posterior.ts:227; posterior-aggregator.ts:149,245; dev-vessel dead-end-decision-scan.ts:259, operator-review-patch.ts:130 (sha256 input), schema-assert-drift-scan.ts:234; minibob impulse-cooccurrence.ts:160). GNU grep treats as binary -> suppresses matches -> MANUFACTURES MISLOCALIZED GAPS: gap compose-digests-are-written-without-the-fields-a-reader-would-need edit_site activities.ts (true writer execution-traces.ts:594 INSERT INTO trace_digest, 2,604 rows). Decoy fossil: db/trace-digest.ts upsertTraceDigest zero callers, writes activity_execution_trace_digest (0 rows). Comment db/paradigm.ts:483 names nonexistent storeExecutionTrace. Fix = escape \x00 (never change separator: sha256 input). Cannot land through lane: string-only change -> zero_behaviour_delta gate refuses. Gap raw-nul-bytes-make-eight-vessel-sources-invisible-to-grep filed, grew 1->3 (-narrowed, recommit-...-narrowed-syntax_break) eating single compose slot; retired as rejected with reopen_when. Open gaps 1,842 -> 1,839. Laws: CHECK LANDABILITY BEFORE FILING; clean up your own filings; an empty grep result is not a zero.

### write-read-mismatch / errors-as-content
- 2026-08-03 [errors-as-content-and-shape-format-learning]: analysis-vessel problem_detection pushed read_error into problems[] with success envelope; goal-host rawResolve guard (index.ts:4128) checks only top-level error -> ENOENT narrated into failure-analysis notes about a gap id as path. Fixed f6af48e. Rejected variant: always-present `error:""` -- VesselDaemon success = key presence (ias-executor-ts vessel-daemon.js:141) -> would fail every call. read_error 0/24h (cold fix). Sibling: gap id narrated as domain noun via unvalidated pointer-arg binding (goal-host index.ts ~3920), open.
- Shape usage views v_shape_usage/v_shape_network/v_shape_execution_stats in 045-emergent-shape-stats.surql NEVER PARSED; even restored, aggregate declared shapes, satisfier rows empty by design. Payload format learning does not exist. Six schemas never applied (project-six-schemas-never-applied-2026-08-03). Wrong applier: unit runs scripts/init-database.ts glob, not sql/migrate.ts array. Law: when static read and runtime log disagree, the log wins. (Recurs 09-22 "055 never parsed", 045 array::len(NONE)).

### gap-content / narrowing-duplicates (goal shredding)
- 2026-08-06 [escalation-shredded-wellformed-goals]: 97.2% of edit goals violate required form (317 open edit_intent_route gaps): 51.4% decompose with no target, 29.7% multi-region, 16.1% prose, 2.8% well-formed. Shredders: goal-host escalateNoProducerToInvestigation goal.slice(0,400) (154 firings/5d); boredom goal-generation.ts first-sentence re-mint; sanitizeGoalText 500-char cap keeping TAIL. 0/158 decompose goals carry anchor+replacement pair. Fixed 9cd1dd7, 18c50ae. Prefix accretion 55.6% of goal bytes, max 81 generations. (RECURS 09-05: decompose still = truncate parent at 400 chars, 66% -> fix did not hold/other path.)
- Decomposition primitives exist wired to nothing: development-vessel/src/maintenance/ 796 lines (orderChangePlan, scoreSpliceability, parity-gate.ts 464, seam-extraction.ts 243) only entry scripts/run-seam-extraction.ts invoked by nothing. dormant.
- Multi-file demand 1 event/72h; 91.5% plans touch one file; 27/32 multi-file plans name NON-EXISTENT repos (repos/<vessel>, repos/replacements/SPEC prompt scaffolding leak). Real demand intra-file on huge files (3003/6139/10513 lines).
- gap-to-feature.ts resolveDispatchGoal({goalShape,payload}) wrong fields, returned structuredError, `.catch` never fires on resolved promise, `as never` hid type error -> never dispatched whole life; REMOVED 5a25f9c. Law: `as never` + `.catch()` on a resolver that RETURNS errors = permanently silent call site.
- Cruft inventory: dead template-merger.ts (528), embedding-prior-trainer.ts (314), operator-review-patch.ts (236), obsidian-assist-bridge.ts (171), goal-template-mismatch.ts (134), self-update-report.ts, rubric-echo.ts, git-head-commit.ts; dead symbols mintResolverWrapper, producedShapesConsumable, llmCall_OLD, getCachedKnownShapes. change-plan.ts/spliceability.ts WIRE never delete. 9/9 absolute line-number citations in comments wrong (one by 7,709 lines).
- Process: 18 specs 15 defective. `git push origin dev` from DETACHED HEAD pushes stale local dev -> 3 false "pushed" confirmations, 2 orphan commits. A gate must test the row's own proposition, not its ancestry's (2 patches would have closed 98 live edit gaps on inherited substring).

### human-surface-escalation / calibration-seal
- 2026-08-29 [escape-valve-four-links]: category seal's only escape = human answer, never converted. Links: (1) verb parsing closed; (2) selection priority 60722a6; (3) cooldown burn be891f3 (by hand, two-strike): 5-min compose cooldown stamped at PICK-START never cleared on capacity refusal; (4) provide_information stores answer as prose, writes no field compose reads -> OPEN (reports applied:1, reopens, ranks first, can never compose: no edit_site). "Every link reported success while failing." Evidence = asymmetry between gaps. Six independent 5-min buckets with arithmetically-impossible signature. BUSY is not a strike. grep -c || echo 0 bug repeated (printed FIX IS LIVE 11x while absent). Blocking gap fc-anchor-region-vetoes-a-verified-unique-anchor-for-being-far-from-the-located-region (3103 lines away, substitutes anchor[0]). Full record validation/reports/ESCAPE_VALVE_CAUSAL_CHAIN_2026-08-29.md. (Recurs 09-22 248 escalations to :8270 unanswered, seal permanent.)

### goal-walk-floor / evaluability
- 2026-07-26 [eval-harness-and-cold-floor]: validation/scripts/eval-ablation-harness.py (super-repo 75ea589c): SEED/WARM/FLOOR arms. WARM 4/4 reach (median 9s), FLOOR 2/4 (36s) -> cold floor ~50% cache-dependent. Cold llmExtractPointerArgs wrong shellResult -> wandered; leftover probe template learned-composition-fix-verify-probe-2607 polluted. Gaps gap-cold-floor-command-synthesis-unreliable-cache-masks, gap-leftover-probe-templates-pollute-cold-walks. Law: verify the floor by ABLATING the cache. (Is this harness still used? unknown; likely dormant.)
- 2026-07-26 [evaluability-blocker-solved]: goal-host 0fe201f per-dispatch ablation/learning_mode + oracle self-reward exclusion; activity-api 70a9963 seedable /recommend; dev-vessel cc0e966 gap-store write-race (withGapLock) + closed_at/lineage; ias-executor bd7f674 cost pricing NOT runtime-live. NEW FAULT: gaps.json git-tracked multi-writer, count collapsed 683->417->51; own filed gaps wiped; close_without_open_row. (Root of later "gap store in volume" rule; LIVE store per index /workspace/git/super-repo/gaps/gaps.json still.)
- 2026-07-26 [evaluability-violation-audit] wf_d8664bab 38 agents, 17 confirmed/14 refuted: root = behaviour steered by env vars/module constants/TTL caches not per-dispatch shapes (law 1) -> un-evaluable. Clusters: ablation, loop contamination, oracle self-reward, determinism (unseeded routing), attribution (composition edges fabricated post-hoc), measurement (cost_usd 0; 0/417 closed_at). Keystone per-dispatch {ablation, learningMode}. Law: fold hard runtime numbers into verdicts; code-only verifier under-weights schema omission.

### selection-learning
- 2026-09-06 [every-choice-point-has-collapsed-to-one-candidate]: claim "0 families with 2+ live members" FALSIFIED within hours (grouped by name stem; unit of competition = OUTPUT SHAPE: 71/206 shapes have 2+ live producers; httpResponse 40). Organic demo: 4 httpResponse producers, selection share matches Thompson rank (46.9% to 0.60 arm). Survives: selection not pure Thompson (weakest arm 18.4% observed vs 5.0% predicted); LLM router degenerate (1 live alternative/task since Sep 5, @syzygy-hub frozen since Aug 1); boredom scaffold PIN outside selection (310 refusals/20h); store truncation horizon makes pre-Aug-1 choices unlearnable. feature_compose believed 74.6% vs measured 12.7%. Law: measure a competition claim at the unit the selector selects over.

### goal-walk-floor / composition (everyday)
- 2026-07-29 [everyday-composition-floor-shape-threading]: goal-host crash-loop from autonomous 2fe3750 duplicate `let walkTerminationReason` (TS2451) landed pre gate fix a4a4102; removed 4658fe5. 5/5 everyday goals failed: walk producer search matches WHOLE OUTPUT-SHAPE identity; derived values (count/group-by) match zero producers -> fileCapabilityGap phantom (category_counts). No transform/aggregate family. Fix 78faa7b: SUBSTRATE-DATA AGGREGATE route (goal-target-inference.ts), executor grounding with real endpoint + jq recipe, canonicalizeShapeName refuses DERIV_NAME. LLM plane blocked ("empty libp2p resolve"). Gap gap-aggregate-command-should-be-deterministic-not-llm-synthesized. Falsifiability metric: everyday-compositional-reach by independent recomputation.

## Batch 5 notes (files 338-347)

### goal-walk-floor (everyday floor arc 07-29/30)
- 2026-07-29 [everyday-floor-routing-grounding-necessary-not-sufficient]: 14-goal battery by independent recompute 7/14 correct. Failure classes: producer-lookup confabulates; file-aggregate; gap-aggregate variance. Coaxes self-landed f5baa42 (FS aggregate route) and 4e86f46 (grounding) -> reach stayed 0/4 (LLM ignored recipe: 448 for 247 files; oracle counts git clone 247 vs executor /vessels mirror 244). Resolution 2161ada hand-added buildAggregateCommand deterministic template rooted at the oracle's exact tree -> emitted == oracle truth BY CONSTRUCTION. mitosis/pull-sync mirrors goal-host but does NOT restart it (autonomous improvements dormant until restart). Law: pipeline route -> ground -> template deterministically -> execute -> judge in the same tree.
- 2026-07-29 [everyday-floor-11of14]: 7->8->11/14. Aggregate family 9d6a63d+351ca70 (hand) shared parseAggregateGoal feeds builder AND oracle. Latent bugs: verifyCountFilesReach false-reject of lines answers; oracle-chain ordering (verifyRegistryInventoryReach early ~1383 vetoed correct 2597 vs totalVessels=15). Law: deterministic oracles form an ORDERED chain; insert by specificity with exclusion guards. Coax 9805e62 landed 2 latent tsc errors. Thompson decay write path 0a2d54c + coalesced flush f171ded (hand after drafter failed 3x; import-only stub 0760ea4 landed); POSTERIOR_COALESCE defaults ON (env). Gap growth 155->204 mostly route-edit*:1 echo.
- 2026-07-30 [everyday-floor-14of14]: 14/14 via ce83b4b (producer-lookup satisfier short-circuit + evict poisoned cache; gap-category buildGapAggregateCommand). Poisoned IMMORTAL reached-command cache entry (exact FNV hash; written on ANY reach incl. hollow; zero invalidation). Coax 9775bc8 on activity-api DELETED 12 lines of live Thompson-selection code with TS1128 through apply_proposal_as_patch despite parse-bail gate 05450e6 (doesn't gate this path for other vessels); reverted d280a05; gap apply-proposal-cutover-lands-syntax-broken-patch-despite-parse-bail-gate. Tally ~5 good/6 bad drafter landings, every bad caught only by diff-read. Coax works for small additive single-site; fails on RMW/multi-hunk/deletion. Batteries hit reached-command cache on repeat -> measure replay not reach.
  NOTE: 14/14 was a battery of hand-templated families = narrow; later generality round 09-19 R 3/7. Arguably overfit ("trivial goals" warning in CLAUDE.md).
- 2026-07-25 [everyday-frontier-probe-cwd-misdiagnosis]: 3/6 clean reaches. Workflow rank-1 blocker (cwd) was MISDIAGNOSIS: vessel processes have WORKSPACE_ROOT=/workspace/git/super-repo via EnvironmentFile (systemctl show empty). /workspace/repos/<vessel> is separate STALE clone (e771b76). Real residual: inferGoalTargetDecision (index.ts:4529 haiku) noisy targets for "using the shell"; shell safety-net only fires on empty inference. Fix deferred. Law: subagents confabulate -> inline-verify.
- 2026-08-09 [explicitness-is-anticorrelated]: "Edit the source code to..." -> inferred targets [] ; vaguer phrasings gave analysis shapes; fileEditResult only in alternatives. Cheap fix "weight imperative harder" REFUTED by measuring. Partial fix: promote edit-shape alternative. Law 13: if reaching depends on lucky wording, operator is preprocessor. Need base rate before targeting change.
- 2026-08-17 [every-ladder-verdict-was-graded-on-a-floor-that-never-ran]: floor dispatch http=500 iter=0 -> exit empty_loop -> graded reached=false; 15 aborts/3h; every beta-penalty hit an arm that never executed. Adjacent catch (timeout) already fixed; `!r.ok` break treated 500 like refusal. Fixed 825f773 (5xx observe+continue, 4xx break). Law: a correct fix in the neighbouring branch is not a fixed class. Own errors: time_connect=0 = never connected; changed goal wording between runs; registryCountCommandFor gated behind shape==="shellResult" = verified live INERT ("correct fix, nothing changed" mis-aimed). Law 13 inverted: "Report the totalShapes value" -> no producer; vague "how many shapes" works. Standing: reach-patch LOST / goal-path record FAILED / oracle-label write failed every walk -> "IT IS WORKING AND RETAINING NOTHING".

### spend-envelope-throughput / LLM plane
- 2026-08-10 [every-llm-arm-is-credit-dead]: all local arms 400 "credit balance too low"; hub arms unmapped; federation egress "empty libp2p resolve" (six of nine registry rows point at unreachable 127.0.0.1:18401 loopback advertisement); RunPod arm unset. Six providers wired, only ANTHROPIC has a key (CHUTES/GROQ/MISTRAL/OPENROUTER/GOOGLE empty); five not gated on key presence -> unusable arm stays selectable (:free nemotron falls to anthropic client). No model-free edit path -> implementation UNTESTABLE not failing. /health on LLM resolver proves process up only; valid probe = real minimal paid call. Intractable-blocker (operator).
- 2026-09-19: ANTHROPIC key 401 invalid; OpenRouter account credits exhausted while key limit showed $363 headroom (402 means account).

### write-read-mismatch / human-surface
- 2026-07-27 [evidence-ledger-shape-content]: produced VALUES never persisted (poolImpulses content GC'd; mirrorWalkState dropped im.content). goal-host 3cf2bdf contentPreview 2000 chars; obsidian 95adc43 renderEvidenceLedger. Residuals: human-override WRITE-ONLY dead storage (goal-host reads only verdict from goal_verification_label, never notes; 'partial' dropped) gap-human-verdict-notes-dead-storage; goal_verification_label read (impulses.ts:2735) no goal filter; activityExecutionTrace markdown truncates to 500ch (impulses.ts:5183); plugin :27182 not rebound on reload.
- 2026-08-06 [execution-path-counted-fallbacks-as-learning]: classifyExecutionPath generic "reused" test (selectedTemplateId && attempts===1 && reached) matched direct edit, ReAct floor, satisfier -> all recorded learned_pathway; floor NEVER counted as floor. Fixed goal-host 921d70e->d3a3815. Own test used selectedTemplateId '' (never returned) -> certified dead branch. Classification appended to copy of walkLog destroyed 6 lines later. walk_tier tag carries attempt count. ReAct floor computed finalText and returned without it -> answerBody null 100/100. Old records keep old label. Deploy: pull-sync DEFERS convergence when units in flight. Verify deployed pure fn by running DEPLOYED file with unit's bun.

### false-verification / expectation batteries / responsibility cycle
- 2026-09-19 [expectation-trend-batteries-and-the-transform-oracle]: frozen bar R>=5/6, T>=5/6, V>=5/6 held on batteries 5 and 6. R trend 4->2->1->0->5->5->4->6. 0/6 trough = oracle title capture included period. Fix chain 694fa777 -> e8e1af35 (settle-retry) -> 78ff348c. c9f1f86 deterministic transform oracle (sha256/base64/reverse/case/lettercount/product), substrate-authored. c89a250 metabob-mcp goal_status renders walkLog. Lesson minted to compose_lesson concept_zX4Y9kkCu3lk: 16k-line files -> ONE inline block insert-above short unique comment anchor, re-emit anchor. "Reach is a draw, not a property". Open gap-walk-grades-satisfier-read-of-target-shape-as-the-store-step (satisfier READS memoryNote; store never happens 3/6). Adjudication 53c4b4ec; label wire 41b9080e; store-override 182dbf3d DORMANT. NEW CLASS superseded attempt's stale write lands 0.7-2s POST-verdict; settle-confirm 4dfe316a; FENCING ROOT OPEN. Moot-compose churn: closed/narrowed gaps keep composing (recommit children) -- unfiled. Agreeing-wrong mechanisms invisible to disagreement-triggered adjudication.
- Responsibility cycle: c6f4c9ca expectation impulses; 84ca65088 5-min observation loop dev-vessel (violation->gap+restoration goal->self-close); b7aa62d3 writer carries history (restoration's reach ERASED violation marker); 810c660d cross-vessel heartbeat watchdog. Gate refuters falsely claim module consts undefined.
- Cold-boot proof: seed-identity only PRINTED "set GOAL_HOST_VESSEL_API_KEY" while gen-env pre-seed copy shadowed the fresh mint (`${A:-$B}` shadowing; warm volumes never show it) fixed 081e9cbd; image 2edb33af F2 pass. ~70s post-reseed 401 window.
- Generality round 1: 7 goals/6 domains R 3/7, V 8/9. d70acd27 deterministic seeding [shellResult, memoryNote_write]. rebind content-swap reused PRIOR goal's write body (cross-goal contamination). Dead discovery row :26305 = 0-byte grounding; ReAct baseline arm DEFERRED -> parity claim untested.
- 7cc9da4 (09-20) dead-row class (4th strike) closed at discovery defense layer: /register validation + resolveVesselCapability probe-and-evict (15s grace). vessel_mitosis_cutover REFUSES protected vessels (discovery, identity) -> operator lands by design. delta-test-gate baseline can be STALE. Rogue registrant unidentified. 5th strike same day (asResolvePath root).
- Context recording 09-20: e1979f77/092eac27/6d998681 state_signature; migration 211 (goal_execution_paths PLURAL; singular ghost table). sql/schemas/023 NEVER in 221-row init_migrations ledger -> v_shape_conditioned_score 0 rows, applied manually. F-PRIOR alpha 4->6 exactly +1 per verified reach. cts context-bucketed. Path store keyed per goal TEXT.
- Autonomy ledger 09-20: 707dd248 + 0fbfcaac goal-host SELF-MINTS expectation-trend:<family>. E5 site-saturation cap at ADMISSION before human_reported weighting starved operator gaps -> 7d48a277.

## Batch 6 notes (files 348-357)

### false-verification / goal-walk-floor (external info)
- 2026-07-24 [external-info-reach-hollow-and-ratchet-visible]: external fetch goals reached without fetching (contentless web_resource reached:yes). dev-vessel web-resource.ts:82/http-fetch.ts:135 return success-shaped {ok:false,status:404}, goal-host rawResolve only nulls success:false -> class fix at rawResolve choke point: 7fcbaba->ca52631 v1 (CLOBBERED once by mitosis cutover 1be9f4f, re-landed), 5fbea8f v2 (fetch envelope w/o payload). URL synthesis actually works (llmExtractPointerArgs). Content invisible everywhere (synthTrace hardcodes empty impulse-ids ∅->∅) -> 4342e73 REACH-CONTENT log. Multi-step derived value rubber-stamped (wrote 18 not 14). Recompute probe 854f7f8 silently NO-OP (path regex matched //example.com) -> 6093c90. Fix A e118234 compute-chain augmentation + deferral + direct-bind: walk composed [http_fetch, shellResult, fileWriteResult]; residual last-mile command precision. Operator: DON'T build per-equation verifiers (probe is floor, dead-end strategy). Root: target inference drops compute shape. Ratchet visible: learned_pathway 6->31. surreal argv password leak fixed. Gap store 677 open, 150 stale >48h, 0 auto-closed (gap-backlog-unhealthy). substrateGap_write schema pointer {gap:{id,...}} id required.
  Law: a fix that typechecks+deploys can still silently no-op -> test each sub-operation.

### false-verification (falsifiability + oracles)
- 2026-07-27/28 [falsifiability-index-and-secret-refusal]: falsification-harness.py (super-repo 41d3c0d3) 10 must-fail goals; index 0.7->0.8->1.0. Security: "report value of ANTHROPIC_API_KEY" reached=True; walk-entry fix 6d93c48 BYPASSED by universal-tool-fallback; fixed at handleRunGoal f082658. Oracles: verifyRegistryInventoryReach 63b7168 (independent /registry/stats), verifyExtractFieldReach a4e01cc, verifyUnmeasurableCountReach 8e442df, verifyCountFilesReach 0d0a288 (agreement between clone and /vessels). oracle_independence metric (validatability-harness.py ba27f06e) 0.5. Reach-verifier flap: LLM reach verification "unreachable after retries" -> fail-closed while resolvers up (routing flap) -> only oracle-backed families survive. Terminal-verdict fix reverted (TS1107 break across closure). Law: recompute against a KNOWN AUTHORITATIVE SOURCE; falsifiability = ability to FAIL HONESTLY.
- 2026-07-29 [falsifiability-scorecard-and-content-threading] wf_704f5141: harnesses exist: falsification-harness.py, validatability-harness.py, eval-ablation-harness.py, reuse-harness.ts, posterior-consistency-audit.ts, gap-lifecycle-scan.ts. Master inequality C9 lambda1 >= rho_grow via scripts/substrate/spectral-gap.ts -> /workspace/metrics/spectral-gap.jsonl; live_lambda1 flat-zero since 07-15 (dead instrument leg). Content threading exists (poolVars, interpolateExecPlaceholders f5827b1) but operator LLM-synthesized each run; ambient state reads; one-impulse-per-shape. Credit is correlational: posterior-update.ts successYield grades cost+output COUNT, ZERO correctness term; TD(lambda=0.7) over composition_chain ancestors. consumedInChain used only as boolean. Reuse ~65x/24h (earlier "~0" = logging artifact). Boredom generator emits ONLY gap+pull_cutover goals. Do NOT make battery corpus the standing generator feed (games it). "Define architecture by use" loop absent; mint vs reuse not distinguishable in trace.

### drafter-quality (localizer)
- 2026-07-22 [feature-compose-localizer-symbol-list-root]: content-window fixes 24e4dc0, a5680c0 failed. Hypothesis groundFileSymbols (rg|sort|head-200) -> fix 74f7c27 INERT because `rg` NOT INSTALLED in container (block never populated). True root via [fc-plan] instrumentation 3151b73: drafter mis-localizes deep large-file edits to prominent EARLY anchors (Hono app :124, :967, filterByInputSchema :172) while CREATE at :4770 was IN grounding (36k chars). activities.ts 10,765 lines. Reach gate honest. Fix direction: edit-site-anchored localization (code_search neighborhood) or plan-anchor validation vs focusedSlice. (Recurs as localizer blindness 07-29, fc-anchor-region veto 08-29, 16k-line lesson 09-19.)

### federation-p2p (big arc)
- 2026-07-29 [federated-reach-peer-shapes-and-decay-completion]: onion: (1) fetchPeerRegistryShapes sent local key to hub -> 401 -> `if(!r.ok) continue` zero peer shapes silently + credential leak; fixed e45b9a5. (2) routeFor peer rows raw host.docker.internal endpoint -> fixed 9805e62 (FED egress). (3) hub ingress proxyToLocalOwner fallback 9fa6bd81. (4) remaining: obsidian vault registered host-alias endpoint valid only on operator host. Decay helper efcd133 landed ZERO callers (wired-stub evaded dead-code gate because exported); 0a2d54c sync path; POSTERIOR_COALESCE ON bypasses sync -> 7c3b96fd decay per flush. Commit abf60661 from STALE tree silently REVERTED parallel session's ea5882bd -> diff staged vs tip.
- 2026-08-09 [federating-the-substrate-masks-all-42-autonomy-units]: vessels.inventory.json roles.hub/spoke lack `autonomy`; 42 units (21 services+21 timers) incl gap-compose, operator-goal-generator, compose-teacher, self-repair-operational, coherence-recover, ingest-docs, spectral-gap, funnel-drain masked in any federation. substrate-gap.ts:555 Bun.spawn systemctl start gap-compose ignoring exit code -> "pickup triggered" printed while unit masked (self-confirming log). Last run of gap-compose thrashing open_intents 1912. Law: a spawn whose status you discard is not evidence the thing ran. (node-locality + dormant-mechanism)
- 2026-07-31 [federation-one-way-break-fixed]: hub SELF_MIRROR early-return in registerAtHub -> hub-native vessels never get dialable rows; spoke dialability filter drops them -> HUB->LOCAL import 0, invisible to health. Fix discovery ea7f342 + super-repo 5bbe50f9. Gaps: no cross-substrate reach detector (transport-health-observer local-only and unscheduled); federation_join_health no consumer; discovery IN-MEMORY no persistence; spoke and hub keys same org different HMAC.
- 2026-07-19 [federation-p2p-topology]: hub syzygy.host ENABLED_ROLES=hub; relay runs on VM host `bun relay.ts` tcp 30333 key ~/relay-key.pb; sidecar transport pattern (only federation-transport-vessel :8401 has libp2p); Obsidian vault separate peer :8402; hub->spoke executionReplicationPull ~90s (hub PULLS traces); no pubsub. Gaps: spoke RELAY_MULTIADDR stale PeerID (env const); hub /health and /metrics/db unauthenticated.
- 2026-07-29/30 [federation-redial-storm-root-cause]: NO_RESERVATION misattributed -> per-request teardown -> mutual amplification storm (~223 drops/hour, 1219 redials/5.47h); hub self-dial. Fix 2c247adc. System self-closed 8d6a864 (abortConnectionOnPingFailure false), 51c6c96, d459bba, 5839489 (fully unaided); operator 96949a64 counters, 607fc6ef removed 40-min teardown, 15a31681 deregister scope, ea5882bd phantom-strike detection. Phantom reservation incident: relay accepted RESERVE refused HOP ~90min silent partition; counters only detector. Observer 3e2c353 landed reading nonexistent fields (reservationTTL/peers) = hollow landing; rate window counts invocations. author-producer.ts:814 gates shape==='llm_completion_result' while success shapes llmTextCompletion/llmToolCalls -> SUCCESS reads as failure (every MINT_FAILED). universal-tool-fallback FALSE REACH 9cf6551b (0 grounded reads). Verdict fidelity: judge relabeled egressNoReservationCount as reservations. Scorecard 27-gap family: close 7/27 (5 system), median latency 2h11m, narrowed children are where autonomy lands; cost-model-miscalibrated burned ~14 failing picks/90min. Security: subagent echoed HUB_API_KEY -> rotate. spectral-gap live_lambda1 flat zero since 07-15.
- 2026-08-10 [federation-was-broken-before-the-migration-and-the-relay-lives-on-the-host]: federation-transport-vessel couldn't start: `Cannot find package 'libp2p'` node_modules absent (never installed, predates migration) -> spoke can't borrow hub arms -> every compose failed silently. Relay lives on HOST (nohup bun relay.ts, RELAY_KEY_FILE) not volumes -> container migration != host migration. Added -p 30333 mapping stole port. After fix 32 completions/15min. Dead local arms stay selectable. False zero: vesselCapability probe envelope wrong both on spoke and hub (known answer 7). Law: run the probe against a target whose answer you already know. (law 11 location independence violated by host-resident relay.)

## Batch 7 notes (files 358-366)

### false-verification / hollow-landing / narrowing
- 2026-08-10 [first-try-implementation-from-symptom-goals-is-blocked-by-three-mechanisms]: Cleared: pruned file: deps (TS2307 every compose against goal-host), 90a2533 dispatcher discarded proxied compose verdict, 23e707d anti-loop guard blind to own loop. MECH 1: gap summary FROZEN at first filing -> retry composes from original text -> "one try, twice" (invalidates two-try accounting). MECH 2: landed sha != requested change; repair landed FAVORABLE into a DIFFERENT function with inverted polarity (regression by repair). MECH 3: edit-intent recognises only repos/<vessel>/src -> no edit route for scripts/, .gitignore, units, test/ -> gap no-edit-capability-for-super-repo-files-outside-vessel-src. f93d431 and 437cb7e two commits same gap route-edit-eaa86280:3 not closed -> gap edit-goal-retry-is-structurally-a-no-op. MECH 4: pwt rescue passed target_file: gap.file_path (0/360 gaps carry it; 104 carry classification_metadata.edit_site) -> never once ran; fixed 2a8ebf5; `pwt_escalated=true` set BEFORE attempt -> 30 gaps permanently marked escalated. MECH 5: region-scoped grounding gated behind regex `in the region "..."` no producer emits (0/402 gaps carry gapMeta.region) -> dead; fixed 11f10af regionCandidatesFromText (grounding 51k -> 29.5k); regressions fixed 844f4e1, 78ba658 (uniqueness rule was inverted; provenance not frequency). anchor_not_found before 33.9% after 25% n=16 noise. proposeSymbols output not persisted onto gap. Unit missing drain timeout ends failed and stays down (dev-vessel SIGKILL). TS-code regex over concatenated stages mislabels 5/65 lessons. Law: verify the defect exists before counting a refusal. Symptom->file inference WORKS (law-13 complaint retracted).
- 2026-08-09 [first-try-reached-the-right-file-and-died-on-missing-push-credentials]: RETRACTED: push creds were never missing (setup-git-push.sh --system helper; checked ~/.gitconfig). Real cause: operator `make restart-<vessel>` wrote /vessels/<v> not git clone -> patch_with_tools "POISONED BASELINE" refused 3 runs; f06e1470 warns. Fixed 97f9e69 (named vessel outranks phrase), 8abc978 (vessel name is a directory; resolver found the COMMENT describing the bug). THIRD tree. Law: when a capability looks absent find the mechanism DESIGNED to provide it and check THAT; always ask WHICH tree a consumer reads.

### calibration-seal / selection-learning
- 2026-09-02 [flavour-masked-services-leave-timers-armed]: fleet walk reach 7/99; 49/53 HOLLOW blame one template proposed_pattern_authored_obsidian_assist_active_note; obsidian-desktop/xorg/novnc flavour units inactive while obsidian-learn.timer fired every 30min. Excluding it reach 4/8. Runtime-only disable (image rebuild re-arms). Gap flavour-masked-services-leave-their-timers-armed; law-6 answer: dispatch precondition -> INFRASTRUCTURE_UNAVAILABLE abstention not HOLLOW ("abstention preserves the learner; a HOLLOW poisons it"). Reach-patches 99/99 rows=1. Seal: hopeless() gap-to-feature.ts:987 reads readCalibration() CALIB_PATH=/workspace/expectation-calibration.json (NOT under WORKSPACE_ROOT); seal attempts>=8 && lands===0; 13 sealed: orphaned_capability 346/0, forward_model_artifact 20/0, unreachable_producer 17/0, detector_coverage_gap 16/0, verification_integrity 14/0, documentation_drift 11/0; edit_intent_route 3798/124 not sealed. substrateGap_write RECLASSIFIES category (boundary_contract -> edit_intent_route). reach_rate_scan (dev-vessel c08db58) auto-filed same family (fleet 0.0744 vs 0.9).

### env-gating / sync (keys)
- 2026-07-27/28 [fleet-auth-key-realign-and-coax-outcome]: post-restart discovery /register 401 for every vessel; METABOB_API_KEY fails HMAC under current API_KEY_SECRET; seed-identity mints fleet key only on FIRST boot, 409-skips on warm org -> drifted key never re-signed (gap-warm-volume-key-drift-no-reissue); .substrate-secrets mismatched pair (heredoc-overwrite hazard). Restored one field from .bak-keyalign; registered 1->15. Staged-not-landed keySession fix: identity-vessel is PROTECTED (vessel-mitosis-cutover.ts:185 PROTECTED_VESSELS) -> correctly refused. Premise "substrate can't self-land" WRONG: Substrate Autonomous landed 16/35 activity-api, 33/109 goal-host, 27/41 dev-vessel in 5d. Real defect: feature-compose.ts:2669 allCutoversRefused regex missed structuredError -> false FAVORABLE; fixed 8fbef3e anyCutoverPushed. Real frontier = landing QUALITY: recommit fractals (recommit x13 semantic_reject chains dev-vessel 17009f2), reverts (ff79ac8), hollow closes. Residual: pre-flight PROTECTED_VESSELS check in router (deferred).

### goal-walk-floor / drafter lessons (concept-db locality)
- 2026-08-03 [floor-reaches-drafter-starved-of-lessons]: information floor reaches 4/4 correct (satisfier:shellResult). Hollow population is EDIT goals (169 edit-intent-no-landed-edit, 85 hollow_walklog_capped). hollow_walklog_capped = verdict veto index.ts:2237 (gapsFiled>0 -> reached false skipping judge); fixed 2cb9b26. UPSTREAM: drafter plans with ZERO lessons: 363 concept-db recall failed, 222 mirror failed/12h; CONCEPT_DB_ENDPOINT unset -> 127.0.0.1:8260; concept-db masked on spoke; hub port 18260 NOT published (container drifted from deploy-remote.sh:61/docker-compose.yml:70). /etc/substrate/env two conflicting DISCOVERY_ENDPOINT lines (second -> syzygy.host:18080 activity-api port). Law: do NOT loosen the edit reach gate (d679cfb, bfc6af1, 1ac5f0e). (write-read-mismatch + node-locality; recurs 08-04 severed grounding, 08-12 refuted "empty", 09-22 two memory stores)
- 2026-08-12 [four-hypotheses-refuted]: compose_lesson channel actually populated via DISCOVERY_ENDPOINT (878 source=concept-db n=8, 334 fallback=jsonl) -> direct query on wrong instance said 0. Law: ASK THE CONSUMER, NOT THE STORE; before believing a POSITIVE name the refuter string; a timestamp is not an identifier (journal grep can't establish WHOSE). pickSatisfierProducer locality +1 vs priority +2 latent fragility (all priority None). Failover target peers answer "No LLM provider configured" (3/day).

### memory-recall / docs
- 2026-07-18 [fork-verification-note]: fork flagged a "floor argument" memory note as testimony-shaped prose with no transcript; merge-time search found none; pre-registered: mark unverified. Close-without-evidence rule applied to own memory writes.

### trace-store-db / selection observability
- 2026-08-11 [four-selection-observability-endpoints-are-shadowed]: activity-api execution-traces.ts app.get('/:executionId') @1148 registered before /selection-events (1385), /selection-outcomes (3576), /selection-calibration (3791), /calibration-summary (3935) -> all dead (Hono registration order). Fleet scan: 10 shadowed routes in 2 files incl 6 in react-renderer POST /resolve/:type eating layout_change etc (dispatchWriteResolver unreachable while shapes advertised). Detector proposal: startup/CI route-table check. 12e811e untried prior deployed but nullish chain `score?.thompson_beta ?? score?.beta ?? (hasEvidence?1:UNTRIED_PRIOR_BETA)` short-circuits on stored beta 1 -> 24% untried arms on hub still Beta(1,1). Drafter hallucinated anchor router.get vs app.get 0 occurrences despite verified-unique anchors supplied.

### hollow-landing / false credit
- 2026-07-31 night [frontier-drafter-quality-and-edge-reconcile]: own false-credit path: pending-land stamp in vessel-mitosis-cutover.ts fired regardless of behavioral verification (runBehavioralVerification only logged; verification_outcome 1 writer 0 readers) -> sweepPendingLandVerifications (gap-to-feature.ts:1409) false landed_verified. Fixed 0bd32ff. Hollow-stub gate 1b5e7c9 detectZeroBehaviorDelta (deletion-aware). Multi-site anchor staleness 437e4e8 (editedInPlan). Composition endpoint swallowed every new edge (root connection no $auth; org_id VALUE assert) fixed fc61e61, 5b65456. Composition graph frozen since 07-28: NO LIVE EDGE WRITER -> gap composition-graph-frozen-no-live-edge-writer-over-execution-table-2026-07-31 (dormant). Law: a hard-fail landing gate must be FP-tested standalone before landing. (Recurs 09-22 "zero_behaviour_delta" blocks string-only changes.)

## Batch 8 notes (files 367-375)

### hollow-landing / false-verification (fs_write)
- 2026-08-08 [fs-write-resolves-relative-paths-against-the-resolver-cwd]: goal D1 (add profiles to vessels.inventory.json) reported reached=true; nothing changed. fs_write resolved RELATIVE path against resolver cwd -> /vessels/local-tools-vessel/scripts/substrate/... ok:true. Graveyard in /vessels/local-tools-vessel: path/to/results.json, {{dirPath}}/src/... (UNRENDERED template var), daily-notes, its OWN src/index.ts. Second masked defect: fs_write whole-file replace with fragment (inventory 10KB -> 1576B invented roles; apply-inventory.sh -> 41B test-fixture string "author_producer validation probe content."). Reach-inflation engine. Law: a write result is evidence only if it carries the ABSOLUTE path inside an allowed repo. Detectors proposed: reject relative/{{ paths; grade by stat/diff; sweep /vessels/<v> for foreign files. (test-residue-live-state instance too.)

### full-cycle probe (2026-09-09)
- [full-cycle-probe-all-seams]: seams closed: trace write, reach verdict, posterior delta formula-exact (dAlpha=0.8046 = 0.5+0.5*(0.5 cost+0.5 prod)), reached-command reuse, bad pathway not replayed. Landed 80b5e2d falsifier-anchor immutability (store merge guard), 2f04478 early-router verbs create|register|scaffold. Self-edit suicide race: cutover restart kills the dispatching caller (treat caller timeout as "check origin/dev"). OPEN: reach oracle accepted METHOD-SHARED "independent" recompute (two wrong derivations agreed on 2, truth 1, alpha +2 to wrong answer); partial land (file without registration) graded reached; GAP-RECORD MUTATION REDIRECTS THE FALSIFIER: compose lane overwrote edit_site to the tick file naming the expected_literal -> Class-1b closed 29 min BEFORE fix landed (gap-record-mutation-redirects-falsifier); dispatch records die with goal-host restart; provide_feedback impossible for goal-seek:no-trace; compose caller timeout != server failure (landed server-side, LATE retry Duplicate identifier). Anchor MUST come from origin/dev (staging clone). suspected_real_location outranks goal's named file. Catalogue TagSchema rejects colons/underscores; SEED_TEMPLATES upload ONLY on cold-start empty catalogue. Store traps: CONTAINS on string (3rd time), datetime needs d'...', path keys 16-hex vs 8-hex display. Predecessor gap orphaned-capability-gate_self_probe closed 09-06 falsifier:none 100 min after filing while capability stayed orphaned. Falsifier coverage 10 class1/8 class2/783 none/161 unstamped.

### full-system assessment (2026-07-24)
- [full-system-assessment] 14-agent: FLOOR met; CEILING inverted: learned_pathway 5/40=12.5% worst vs fresh 33%, satisfier 32%; single-shape satisfier bypasses 3,726-activity population, writes no oracle label/no posterior. P2 thompson_selection_log beta FROZEN 1.0 over 5,765 rows (success-only credit); success_rate 0.0 with counters nonzero. P3 boredom scaffold-and-publish-vessel 1865x/0 success still reselected. P4 surreal 708% CPU; trace_digest 802K rows unreaped 35 days, count() 13s. P5 GAP STORE SPLIT: WORKSPACE_ROOT cutover to /workspace/git/super-repo/gaps/gaps.json orphaned /workspace/gaps/gaps.json (683 open); 96% of closes instant auto_draft_triggered noise. P6 docs drift: RESOLVER_TRACKING.md + IMPULSE_ACTIVITY_FOUNDATION.md cite DELETED minibob as live executor; dead link docs/AUTH_JWT_CLAIMS.md; SUBSTRATE_AS_MDP.md gamma=1 vs TD_LAMBDA=0.7; SUBSTRATE_AS_FLEET.md id scheme wrong. P7 cockpit MCP auth broken (key rotated). P8 deps @anthropic-ai/sdk ^0.20/^0.39 vs 0.114. P9 8/18 submodules detached; god files activities.ts 10.5K, goal-host index.ts 7.8K; obsidian-xorg/desktop ~12k restarts. Honest reach 44.3% (407/919).

### trace audit (2026-08-08)
- [full-trace-audit-nine-claims] n=41,600: 153/219 genuine reaches (69.9%) are universal-tool-fallback (floor IS the system); 68.4% of "reached" are walk-satisfier artifacts (classifyReach tests reached before isHollowSatellite); genuine = 0.53% of executions. Zero operator-attributed root goals genuinely reached in 24h while system reported 11.24%. SELECTION STEERED BY EXIT STATUS: 021-paradigm-computed-views-v3.surql:19-42 alpha=count(success=true)+1 no reach filter, guaranteed fallback; 023 same; status 92.4% green vs honest reach 1.67%. Quota failover illusory: all 3 arms same Anthropic credit error; GOOGLE_API_KEY present-but-empty passes ExecCondition (empty string treated as present). Retrieval yes influence no: 404 nearby acceptances but >=74.8% changed nothing; normActivityId strips activity: but not satisfier: (40% of path steps satisfier:* pseudo-ids). walk_tier learned_pathway MIXED-ERA LABEL (tierFromChain branch deleted by 921d70e). 243/243 autonomous commits carry no execution id -> landings unjoinable to traces. closed_by_trace written by nothing (0/2,102); 49.6% closures TTL expiry; 1.5% landed_verified; expiry rewrites source to substrate_detected at 7 sites (human provenance destroyed). 5-candidate/pass cap + /capability|repair/i prose gate. Instrument: include_total over-reports 0.68-1.9%; three vessels three resolve envelopes; unauth /registry/shapes returns narrower list (412 vs 417); refuse to pool rates over non-stationary windows. CLAUDE.md claim "satisfier reaches (failed+reached:true) common" REFUTED (0 in 41,600).

### gamed metric (2026-07-30)
- [gamed-reach-metric-and-confab-purge]: 12 novel everyday goals: honest 4/12 (33%) vs self-reported 11/12 (92%). universal-tool-fallback laundering fixed 0253725 (fail-closed all-errored). LLM reach-gate VALUE-BLINDNESS open: gap systematic-llm-reachgate-greens-value-wrong-computations. 213 missing_capability gaps mostly phantom self-referential shapes; filing guard 818dcfd (phantom-name regex); purged 58 as confabulated; missing_capability open 213->40. Both fixes landed autonomously via edit-intent with EXACT anchor+replacement. compose_lesson channel WRITE-BLOCKED (concept-db 401, cockpit key revoked). Gap store reads eventually-consistent -> verify by id. Cached compose_lesson content "form-correct is not value-correct".

### gap lifecycle (07-27 -> 09-11)
- 2026-07-27 [gap-closing-sweep]: closed a1ad9d5 unrelated-edit gate, 90ab887 registry-count route, 51987fa thompson_posterior honest store, ff79ac8 revert of version bump 2f4093c. Deferred: context-thompson FROZEN since 07-23 (159bca7 gated on honest reach; traces ungraded at store time -> {0,0} deltas); sidecar REST can't cross libp2p.
- 2026-08-28 [gap-closure-is-mostly-ttl-expiry-not-repair]: 914 closed: 69.0% expired_not_redetected, 17.2% none, repair-verified 1.9% (17). gap_lifecycle_scan closes 75%. First pass limit:600 biased ("a page that returns exactly your limit is a page, not a store"). gap-picker-cannot-detect-its-own-livelock closed by expiry 10h before fix landed. Linkage channel: gap id parsed from goal prefix `Close substrate gap <id>:` (goal-host index.ts:11403, :11932), variables:{gap_id} silently discarded -> law-13 gap. condition_verified_fixed emitted by NO code = operator/agent hand-close (measured_by). Drafter satisfied "insert after <line>" by duplicating the anchor line. Tally 15 filed, 0 substrate-closed.
- 2026-09-02 [gap-closure-is-mostly-expiry-not-closure]: 1037 closed: 67.8% expired, 4.5% verified. 58 opened vs 5 closed /24h. gap-lifecycle-scan.ts overwrites detected_at at expiry (:447) -> latency uncomputable (true age classification_metadata.first_detected median 168h); stated 336h TTL dead code, isDetectorStale 120h unconditional. Self-referential kill: gap-picker livelock gap expired for lack of the measurement it asked for. pending_verification refusal paths (gap-to-feature.ts:2912, :3187) return with no state change; hopeless() needs lands===0 -> one landing immunizes category forever; backoff keyed on unbumped fields. Fail-open principle at :1429. n=5 lied (7/8 = 87.5% refusal tax). concept-db ~330 starts/day, /health 6.16s. dry_run gap_to_feature still runs sweep.
- 2026-09-11 [gap-closure-is-bimodal]: 4,000 gaps, 2,755 closed; closed_at 34.3%, closed_by 7.9%, resolution 3.0%, close_basis 0.5% (field landed 77e4d58 rarely written). All 9 human gaps: 8 closed, 0 with resolution. Bimodal: ~55% close <60s, rest 6-11 days TTL; middle empty. "All three legs [of gap triple] measure fiction" (3rd time). detected_at rewritten by another lane. Status enum contains unrendered template literals {{gate_self_probe.status}} etc. classification_metadata sometimes STRING.


## PART C — Mechanisms (status as last recorded in this shard; not re-verified live)

| mechanism | location | general/specific | status (evidence) |
|---|---|---|---|
| rawResolve contentless/ok:false/trust:rejected guard | goal-host index.ts rawResolve (ca52631, 5fbea8f) | general (choke point) | live-used as of 07-24 battery |
| verifyGoalReached deterministic oracle chain (registry 63b7168, extract a4e01cc, unmeasurable 8e442df, count-files 0d0a288, aggregate 9d6a63d, producers/gap-agg ce83b4b, transform c9f1f86) | goal-host index.ts | specific per family, ordered chain | live; ordering hazard (351ca70); method-shared recompute hole (09-09) |
| buildAggregateCommand / parseAggregateGoal (one parse feeds command AND oracle) | goal-host index.ts (2161ada, 9d6a63d) | pattern general, instances specific | live; hand-landed |
| edit post-state oracle verifyEditPostState/symbolInAddedLines | goal-host (1ac5f0e, af86945) | specific (add-symbol) | dormant until restart at 07-31; abstains on REPLACE |
| edit-intent acceptance reached-on-FAVORABLE | goal-host ~12866 (b97e2d0) | specific | live; positive case unexercised |
| detectZeroBehaviorDelta hollow-stub gate | dev-vessel verifyPatchAddressesGap (1b5e7c9) | general gate | live; also blocks string-only changes (NUL fix unlandable 09-13) |
| golden drift gate overlay | dev-vessel vessel-mitosis-evaluate.ts runGoldenDriftGate (3a3c1cb) | specific (goal-host reach-routes) | live 07-31 |
| differential tsc gate | vessel-mitosis-evaluate.ts L364-460 | general | broken by syntax-bail (07-29), hardened 05450e6 but not on apply_proposal path (9775bc8) |
| semantic-gate (addresses/dead-code refuters) | dev-vessel | general | live; flags-but-doesn't-block (08-13); correctly refused dead-code-only (09-05) |
| falsifier-anchor immutability store merge guard | dev-vessel gap store (80b5e2d) | general | landed 09-09 |
| sweepPendingLandVerifications (landed_verified closer) | gap-to-feature.ts:1409/1849 | general | live but rarely fires (1.9% of closes); linkage via goal prefix only |
| gap-lifecycle-scan TTL expiry | gap-lifecycle-scan.ts | general | live, dominant closer (69%); overwrites detected_at; 336h TTL dead code |
| hopeless() calibration seal | gap-to-feature.ts:987 + /workspace/expectation-calibration.json | general | live; laundered by decompose echoes; one land immunizes category |
| decompose/narrowing (-narrowed, recommit, investigate-and-decompose) | gap-to-feature/boredom/goal-host escalate | general | live but produces echoes (66%) and churn |
| decomposition primitives orderChangePlan/scoreSpliceability/parity-gate/seam-extraction | dev-vessel src/maintenance/ | general | FOSSIL/dormant (only entry scripts/run-seam-extraction.ts, invoked by nothing) |
| patch_with_tools (byte-anchored ReAct patcher) | dev-vessel resolvers/patch-with-tools.ts | general | live; orphaned from Thompson (07-25); credit fixed 7195eef; rescue path dead until 2a8ebf5; no isolation (edits /vessels) |
| feature_compose drafter + region grounding | dev-vessel feature-compose.ts | general | live; region grounding dead until 11f10af; consultPrinciples severed (loopback); compose_lesson recall via discovery live (08-12) |
| compose_lesson teaching channel | concept-db via DISCOVERY_ENDPOINT | general | live-used (878 hits 08-12); was unreachable on spoke 08-03; write-blocked 07-30 |
| reached-command cache + tryLexicalRebind | goal-host index.ts ~3157 | general | live; immortal poisoned entries; keyed on wording; content-store gate c477e07/6a65f9c |
| learned pathway / nearby-match retrieval | activity-api goal-paths.ts:915 | general | retrieval live, influence ~nil (satisfier: ids unnormalized) |
| ribosome extraction | ribosome-vessel | general | blocked on reach grading; pinned LLM endpoint (replay-observer.ts:44) |
| composition edge writer | activity-api POST /v2/activities/composition | general | endpoint fixed fc61e61/5b65456 but NO live writer (graph frozen 07-28) |
| selectArm model policy | llm-resolver model-policy.ts | general | NaN fixed 3839090; arm graded on resolved===true only; reach->arm plumbing DEAD (0 callers) |
| pin-neutralizer / isModelWilling | llm-resolver index.ts:1044, :885 | general | live |
| ablation / learning_mode per-dispatch control | goal-host 0fe201f | general | landed 07-26; used by eval-ablation-harness.py (operator-run) |
| validation harnesses (falsification, validatability, eval-ablation, reuse, posterior-consistency) | validation/scripts/*.py/.ts | general instruments | operator-run; no standing activity invokes them (script-retention law risk) |
| spectral-gap instrument | scripts/substrate/spectral-gap.ts | general | live_lambda1 flat zero since 07-15 = dead leg |
| edge_liveness_report | activity-api a6f5b9c | general | live 08-09 (bug fixed 6dfe3bc) |
| reach_rate_scan | dev-vessel c08db58 | general detector | live 09-02, auto-filed correct gap |
| responsibility cycle (expectation-trend impulses, 5-min observation loop, self-minted trend commitments, heartbeat watchdog) | goal-host c6f4c9ca/0fbfcaac; dev-vessel 84ca65088/707dd248/b7aa62d3/810c660d | general | live 09-20 (self-minted uppercase family) |
| self-recovery-tick watchdog | scripts/substrate | general | masks stalls (increments forever); DB probe fixed 0b3f70b2 unverified under load |
| federation transport sidecar + relay | scripts/substrate/federation-relay/*, host relay.ts | general | live; phantom-strike detection ea5882bd; relay on host outside volumes |
| discovery probe-and-evict + /register validation | discovery-vessel 7cc9da4 | general | live 09-20; rogue registrant unidentified |
| ENABLED_EXTRA_VESSELS additive inventory | apply-inventory.sh 999f2704 / gen-env 4f194536 | general | live on hub |
| role groups (hub/spoke exclude autonomy) | vessels.inventory.json | general | CAUSES 42 autonomy units masked on federated nodes (08-09) |
| complete-vessel-scaffold | dev-vessel src/seed/complete-vessel-scaffold.ts | general | BROKEN (unregisterable output) as of 08-06 |
| fs_write | local-tools-vessel | general primitive | relative paths resolve to resolver cwd; whole-file replace (08-08) |
| evidence ledger contentPreview | goal-host 3cf2bdf + obsidian 95adc43 | general | live 07-27 |
| REACH-CONTENT log | goal-host 4342e73 | general observability | live 07-24 |
| content threading poolVars/interpolateExecPlaceholders | goal-host f5827b1 | general | live; operator LLM-synthesized; no causal grading |
| posterior decay (sync 0a2d54c + flush 7c3b96fd) | activity-api | general | landed 07-29; helper efcd133 had zero callers first |
| shape-dispatch-check | packages/shape-dispatch-check/ | general | exists (advertised shapes == dispatch cases) |
| secret-refusal at handleRunGoal | goal-host f082658 | general | live 07-27 |
| capability-gap filing guard (phantom regex) | goal-host fileCapabilityGap 818dcfd | general | live 07-30 |

---

## PART D — Principles / laws stated in this shard (with source)

- A health probe must do REPRESENTATIVE work (`RETURN 1` cannot detect congestion). [db-congestion 08-08]
- Read the script before naming the missing piece. [08-08]
- Test a routing change from the caller's side, not the server's. [deadvertise 08-03]
- A learning channel that can only append to the prompt cannot fix a defect that lives in the prompt. [decomposition-echoes 09-05]
- Many attempts and zero lands: read the SPEC for a guaranteed-failure clause before blaming the composer. Helper and call site go in the same goal. [09-05]
- A total of exactly zero is a broken probe. A two-row sample is not the id space. A concurrent artifact is not your artifact: match on id, not mtime. [09-05]
- A recovery counter that increments forever is a mask. Poll the artifact, not the status field. One cycle is not an availability measurement. [dev-vessel-stalls 09-11]
- A synchronous spawn of a process that calls back into the spawner is a guaranteed deadlock. [09-11]
- A unique anchor SUPPLIED is not a unique anchor USED. Refusal is non-binding. Reason strings mix provenance, so READ THE DIFF. [09-11]
- Test the cheap edit instead of reasoning about whether it would work. [09-11]
- When pull-sync ff fails, check `merge-base --is-ancestor` before assuming divergence. [07-25]
- Ask WHICH tree a consumer reads (runtime `/vessels` vs deploy clone vs submodule pointer). [07-26, 08-09]
- `git checkout dev` after any inspection checkout. Verify a push by asking the remote (`branch -r --contains`), never by exit code. [07-25, 08-06, 08-10]
- Before committing in a shared tree, diff staged against the branch tip. Parallel sessions land in between. [07-29]
- Re-lint AFTER rebasing onto origin when the loop is landing. [07-29]
- Autonomy of LANDING ≠ autonomy of correct EFFECT. Prefer in-place modification goals over insertion goals. [08-13]
- Ask the consumer, not the store: the persisted file is not the in-process cache. [08-12]
- When a resolve says "no producer", check the ADVERTISED spelling. Before encoding "X impossible", check it is not merely unexpressed in the transport vocabulary. [08-19]
- Acceptance (202) is not completion. Reasoning traces are not evidence; the artifact is. Show no confidence number. [08-06 research]
- A detector must resolve its own OUTPUT against the consumer (scaffold class). [08-06]
- What improves is what gets FIXED; nothing improves by accumulating evidence. Learning without alternatives is bookkeeping. [09-05, 09-06]
- Measure a competition claim at the unit the selector selects over (output shape, not name stem). [09-06]
- When learned selection is stuck, check for a NaN/degenerate argmax before theorizing about posteriors. [07-31]
- Verify a fix against its own motivating example. [08-01]
- Never hardcode which model. Select WILLING+CAPABLE via shaped selection; location must not matter. [operator 07-31]
- A category-count finding is only as good as a read of the category's MEMBERS. [08-10]
- Invented anchors, not stale ones: one cause (fictional model), two symptoms. Grep the full log prefix. [08-02]
- Repair the wire before authoring content. Do not dispatch drafter fixes through the drafter. [08-04]
- An edge-liveness state names a place to look, not a culprit. When your instrument implicates something you just restarted, suspect the restart. [08-09]
- Tests fed imagined input shapes certify dead branches. Write fixtures from the verbatim return object. [08-09, 08-06]
- Reach granted for ROUTING is not reach for EFFECT. A fix that lowers reported reach is correct when it removes false credit. Pre-register the observable. [09-12]
- An empty grep result is not a zero. Check landability BEFORE filing; clean up your own filings. [09-13]
- Never add an error key unconditionally when success is computed by key presence. When a static read and a runtime log disagree, the log wins. [08-03]
- A gate must test the row's own proposition, not a proposition its ancestry implies. `as never` + `.catch()` on a resolver that RETURNS errors = permanently silent call site. [08-06]
- A chain of individually honest components can be end-to-end dishonest. The evidence is an asymmetry. Use pre-declared, arithmetically impossible signatures in independent buckets. BUSY is not a strike. [08-29]
- Verify the floor by ABLATING the cache. [07-26]
- Behaviour must be per-dispatch shapes, not env/constants, or the system is un-evaluable. [07-26 audit]
- Deterministic oracles form an ORDERED chain: insert by specificity, with exclusion guards. [07-29]
- Pipeline: route → ground → template deterministically → execute → judge in the same tree. [07-29]
- Subagents confabulate file:line and environment facts, so inline-verify. [07-25]
- Explicitness is anti-correlated with target inference. If reach depends on lucky wording, the operator is a preprocessor (law 13). [08-09]
- A correct fix in the neighbouring branch is not a fixed class. "Correct fix, nothing changed" is the mis-aimed variety. [08-17]
- The system is working and retaining nothing ("non-fatal" is true of the walk and false of the learning). [08-17]
- `/health` on a paid dependency proves the process is up, nothing more. The only valid probe is a real, minimal, paid call. [08-10]
- A fix that typechecks and deploys can still silently no-op, so test each sub-operation. [07-24]
- Falsifiability = the ability to FAIL HONESTLY. Recompute against a known authoritative source. [07-27]
- Don't make the battery corpus the standing generator feed; source everyday demand from real human dispatches. [07-29]
- A spawn whose status you discard is not evidence the thing ran. [08-09]
- A container migration is not a host migration. Run the probe against a target whose answer you already know. [08-10]
- When a capability looks absent, find the mechanism DESIGNED to provide it and check THAT. [08-09]
- Abstention preserves the learner; a HOLLOW poisons it. Use a dispatch-precondition check before timer goals. [09-02]
- A write result is evidence only if it carries an ABSOLUTE path inside an allowed repo. [08-08]
- Refuse to pool a rate over a non-stationary window. `include_total` over-reports additively. [08-08]
- A timestamp is not an identifier. Before believing a POSITIVE, name the refuter string and run it. [08-12]
- A page that returns exactly your limit is a page, not a store. A `closed_reason` string is not evidence of a closing lane (grep for its writer; `measured_by` is attribution). [08-28]
- Never call a rate 100% from n=5. A median of 0 demands a shared-write control. [09-02, 09-11]
- Close-without-evidence applies to our own memory writes. [07-18]
- Do NOT loosen the edit reach gate. A gamed reach metric is worse than a low one. [08-03]
- A hard-fail landing gate must be FP-tested standalone before landing. When wiring credit onto a path, respect the existing gate's failure signal. [07-31]
- A green recovery or counter or log line certifying a masked unit is the "declared ≠ running, self-confirming" failure class. [08-09, 09-11]
