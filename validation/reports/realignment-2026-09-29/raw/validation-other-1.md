# validation-other-1 — findings / results / substrate-authored / adversarial-probes / gaps / state

Shard: `validation/{findings,results,substrate-authored,adversarial-probes,gaps,state}` (173 files).
Read-only. Dates come from filenames, frontmatter and git (`git log -- <dir>`, 229 commits);
the filesystem mtime column is uninformative (mass checkout stamped almost everything 2026-06-26).

Node-1 DB facts below carry their window explicitly — see §6 (instrument findings).

---

## 0. Coverage

- **Read in full:** findings/capability-validation.md, blocker-clearance-and-round2.md,
  round3..round7, gap-escalation-loop-saturates-development-vessel.md, hub-admin-keyspace-lockout.md,
  f-083-debunked.md, results/2026-07-03-learning-transfer-causal-ledger.md (first 120 lines ≈ all),
  results/substrate-cycle-resync-2026-08-08.md, gaps/INDEX.md + gap-001..008 (heads), findings/README.md,
  substrate-authored/MANIFEST.md, adversarial-probes/v1/README.md + MANIFEST, state/closure-status.json.
- **Read by head + summary/verdict/tail sections:** all June-era observation dirs (autonomous-loop-fires,
  goal-host-dispatch-setup-leak, mitosis x3, self-repair x2, autonomous-10-fixes, phase-2-probe,
  sustained-loop, seed-gap-response, scenario-seed-response, concept-relevancy, self-improvement-loop,
  learning-rate x3, side-effect, stage-3), substrate-consistency x3, driven-development, orthogonal,
  self-detection-recursive, state-conditioning, ui-observation, yardstick, operator-probe, dev-guidance x2.
- **Skimmed only:** iter-15..35 narrations (heads + one grep); config-surface-audit.md (Part 1, headings,
  F10, F15-F68 table rows, §7.10-7.11 — not F1-F9/F11-F14 bodies); config-surface-open-decisions (headings, §7);
  architecture-bias-observation (T0 sample only); substrate-authored observations (first lines).
- **Unread:** state/agent-coordination.json (40 KB), state/shortest-paths.json, the 13 probe JSON bodies,
  results reuse-report `entries` beyond the first.
- Results JSON tabulated with jq (all 46 files).
- Script-retention check done by grep over `scripts`, `repos/*/src`, `validation/scripts`, `validation/activities`,
  `.claude`, `docs` for each harness that produced a file in this shard.

---

## 1. Recurrence chains (the spine: same issue, different hat)

### Chain A — root residue in the super-repo + the placement hook  [codebase-bloat-fossils, sync-deploy-drift]
1. **2026-08-11** round7 §2: container clone `/workspace/git/super-repo` had `core.hooksPath` unset,
   no pre-commit; a commit had already added **476 root-level files** (incl. `TCG_Card_Prices_2026.pptx`,
   `NOTES.txt`, `.gitconfig`, a file named `activity api schema code`). Fix: operator ran
   `scripts/git-hooks/install.sh` **by hand in that clone**. Declared "fixed and verified".
2. **2026-09-07** `4e4170a8` author **Substrate Autonomous**, "Automated commit: vessel code drift detected
   and committed." — **2134 files, 59,401 insertions**: literal `{{target_path}}`, `{{unitFilePath}}`,
   `e.g`, `neptune_moons.txt` (353 lines), `elements.html` (3270 lines), `data.json`, `all_gaps.json`,
   interactor-log jsonl, hundreds of `validation/failure-modes/scenarios/*.json` incl. `*-narrowed.json`
   twins, `validation/state/closure-status.json`, and the compiled `.js/.d.ts/.map` siblings now in
   `validation/substrate-authored/proposed/…/`. The hand-installed hook did not survive / was not in the
   path the committer used.
3. **2026-09-23** `d993b331` "remove tracked scratch files, and install the placement hook where the
   substrate commits" — hook install moved into `setup-git-push` (bootstrap tier).
- Lesson: the first fix was at the wrong tier (hand-applied in one clone). Runtime state
  (closure-status.json, gaps, scenarios, interactor logs) rode into git through an autonomous commit.

### Chain B — "first substrate-authored / autonomy criterion met", declared four times  [hollow-landing, false-verification]
1. **2026-06-01** `ac67e366` "first end-to-end substrate-published artifact"; `a91a4bbd` "first self-merge";
   the 19-25-58Z observation itself records the prior self-merge used **manually-supplied
   evaluation_evidence** and re-attempts it "traceably" (v2 at 19-34-42Z).
2. **2026-06-02** `fc94ce5a` `lift-status.json.vessel_authoring_criterion.status = "met"`
   (exec_sneey4w0, PR #22), phase "S2".
3. **2026-08-10** capability-validation §2.4: "Against CLAUDE.md's hard criterion … that criterion is met"
   — evidenced by `19b027ba` (pull-sync) which **swept the operator's staged report into its commit**,
   plus `4e21e9f0`, `9c479776`.
4. **September**: operator memory still treats autonomous landing as the open hard criterion (autonomy
   ledgers, "count ran=false", streak tests 09-25/26).
- Each declaration counted *a commit by the substrate identity*, not *a substrate-originated, verified,
  useful change*. Later evidence (4e4170a8 residue commit, c9faf50d wrong-function landing) shows commits
  by the substrate identity include harm.

### Chain C — concept recall / concept relevance  [memory-recall, write-read-mismatch]
1. **2026-05-23** gap-001: no concept-db unit in the local substrate at all.
2. **2026-06-04** concept-relevancy-investigation: `autocomplete-concept-writer` fires on every success but
   calls `concept_create` (fresh `concept_<nanoid>`), never `concept_usage_record`; the backfill template
   (boredom goal[16]) fails task 3. `times_succeeded` sum stuck (ts_sum 22 → 22 while concepts 1263 → 1285
   in 16 min, autonomous-10-fixes). Fix `2bed214` claimed; 10-fixes doc: "did not unblock ts-increment".
3. **2026-08-10** capability-validation §1.2: cause = `DISABLED_VESSELS=concept-db.service` mask.
   Same doc §4 overturns it: unmasking does not restore recall; `recallConceptRows(_, 5, 4_000)`
   (goal-host index.ts:9062) vs **41.75 s** resolve; cause "BM25 IDF not persisted (SurrealDB 3.0)".
4. **2026-08-10** blocker-clearance Part 4 overturns #3: "I was repeating the code's own log message as a
   diagnosis." Real cause: `search::score(0)` with bare `@@` (never the numbered `@0@@`; concept.ts:398-413;
   migration 004 documents the numbered form), `Number(c.fts_score ?? 0)` masks absence; latency =
   `SELECT *` materialising content + two 384-d embeddings before ORDER BY/LIMIT. **Not dispatched**
   (masked vessel would not deploy).
- Three declared causes in two documents in one day; nothing landed. `/health` 20 ms green throughout
  while the only load-bearing route took 42 s.

### Chain D — "Thompson converging" is a self-loop  [selection-learning]
1. **2026-05-25** iter-21/24: "Thompson Converging", "posteriors live after SurrealDB RETURN fix (c48c4333)";
   iter-28: "Validator-Dispatch Dominance at 301/301"; iter-21: validator-dispatch 75% of workload, 100% success.
2. **2026-05-25** f-083-debunked: proof that posteriors are safe = "α for validator-dispatch has been growing
   monotonically (~3500 → ~4184)" — the same self-looping activity.
3. **2026-06-04** seed-gap-response: "slot-binding + validator-dispatch infinite loop (≈85%)" of traces.
4. **2026-06-04** self-improvement-loop: state signature too fine-grained → "selectGoalForLoadConditioned
   is decorative"; load-gated round-robin in effect.
5. **2026-07-03** causal ledger: genuine-edge density +26.4 pp but circular (edges minted from success);
   crystallized/uninformed fraction shows *no* positive relation (Simpson flip); **cost_usd = 0 and tokens = 0
   on all 210,955 traces**.
6. **2026-08-10** every satisfier-plane success logs `WITHHELD alpha-credit … no in-chain
   producer-to-consumer edge and no landed sha` — successful traffic banks nothing.
7. **2026-08-12** complexity ladder: all four rungs `reached:true`, `walkTier: satisfier`,
   **producerSteps 0** on every rung; `rungs_with_producer_steps: 0` — the differentiation bar failed.
- Memory index (09-08) later: `activity`-table posteriors vestigial. F-083's "safe" proof was the loop.

### Chain E — `reached` vs `status`, both polarities  [false-verification]
1. **2026-05-24** gap-003 (×12) / gap-007 (×6): activity `completed`, goal_resolve `failure`, `failure_mode`
   null; named template succeeded, parent goal still failure.
2. **2026-08-10** smoke: `reached:true`, stdout "12", stderr `find: …No such file` (truth 74);
   `verifyCountFilesReach` fires only on `(repos|vessels)/…`; honesty check reads stderr only if stdout empty
   (index.ts:6538-6543).
3. **2026-08-10** G9: `reached:true` on 10 (truth 9), both trials; judge: "'10' is a valid numerical count";
   `countsSomeOtherUnit` correctly declines, but none of 16 `verify*Reach` oracles counts directories.
4. **2026-08-10** round4: cap-02 `reached:true` on an **80-char metadata stub** pointing at itself;
   `reach->mint: SKIP ungrounded reach … bare-LLM-yes` visible only to the learner; 4/4 ungrounded skips
   still reported `reached=true` and oracle labelled `achieved`.
5. **2026-08-10** round5: fix `56a0683` (grounded flag → universalToolFallback) landed+deployed; the dispatch
   that landed it reported **`reached:false`**; the proving log line fired **0 times** (n=0). Declared
   "correct by construction, unproven by measurement" — honest.
- Also: edit goals: `reached:true` means "a commit landed", not "the named function changed" (Chain G).

### Chain F — drafted repairs that nothing applies  [write-read-mismatch, drafter-quality]
1. **2026-06-04** scenario-seed-response: drafter consumes scenario JSON on disk, not the `substrateGap`
   store; authored template "reasons about the fix" — ends at `fs_write` of an analysis report, never
   patches source. seed-gap-response: 8 gap-closing templates drafted, all for gaps ~30 h older; the seed
   never reached.
2. **2026-06-04** self-improvement-loop: 5 templates, 18 scenarios, 3 mitosis dirs, 11 proposal reports
   authored; **0 cutovers, 0 verdicts above INSUFFICIENT_DATA, 0 changes to live vessel source**.
3. **2026-06-05** phase-2 probe: "HTTP-green and semantically broken end-to-end": 66 proposals, all
   unprocessable (`already_applied_sentinel`, `parse_failed`); `gap_to_scenario_bridge` non-idempotent
   (+10 files/run); `vessel_mitosis_evaluate` non-deterministic on the same root; cutover refuses
   "protected vessel: undefined" (missing field hits guard before validation).
4. **2026-08-11** round7 §1: applier reads `join(WORKSPACE_ROOT,"proposals")` =
   `/workspace/git/super-repo/proposals` (ENOENT ×21/24h) while 3 siblings hardcode `/workspace/proposals`
   (**4,138 entries, 2,257 pending**). One-line dispatched fix (reads `pointer.proposals_dir ??
   PROPOSALS_DIR ?? "/workspace/proposals"`), proven at n=1 dry-run.

### Chain G — directed repair lands green in the wrong place  [directed-overshoot, drafter-quality, false-verification]
- **2026-08-10** repair A dispatched twice with materially different text → same goal_hash `1ef8d7d8:1`,
  same gap `route-edit-1ef8d7d8:1`, gap summary frozen at trial 1 (1945 chars); semantic gate correctly
  rejected the inert patch both times.
- **2026-08-10** repair B `c9faf50d`: goal named `verifyCountFilesReach` twice; regex landed in
  `verifyRegistryInventoryReach` (line 1232) with inverted polarity; `reached:true`, FAVORABLE, deployed.
  Round3 (same day) corrects the blast radius: 7/7 counting goals with a registry token now graded wrong
  (β-penalising correct compositions); gap `route-edit-ed7585e0:9` **was never filed**. Round5 files
  `registry-inventory-oracle-abstention-narrowed-by-c9faf50d`; forward-fix not dispatched (race with
  autonomous cutovers every 15-25 min built from older base SHAs).
- **2026-08-10** round5: three attempts at the ungrounded fix — spec omitted interface decl; prose anchor
  became schematic anchor; third with verbatim unique anchor landed. Lesson: verbatim-unique anchors.
- **2026-07-03** causal ledger: R7 rollback of a `create_file` op **deleted the existing file**; a cutover
  overwrote the runtime-only `learning_transfer_report` with its 590-byte skeleton (restored `96c2aaa`).

### Chain H — trace store reads/writes and which store is real  [trace-store-db, node-locality]
- **2026-08-10** round3: activity-api `failed (start-limit-hit)` from external restarts; masking rejected
  because "the only trace store this spoke can reach" (hub `:18080` 000 @12 s).
- **2026-08-11** round6 refutes round3/round5: fleet reads **and** writes the hub
  (`METABOB_ENDPOINT=http://syzygy.host:18080` in /proc environ of 4 vessels); local store frozen at
  2026-08-02 with 0 POSTs in 718 requests; hub unwindowed reads hard-fail at 57-60 s even at `limit=10`;
  `limit` silently capped at 100; **37 call sites omit the window**; `template-success-ranking-24h` computes
  its cutoff and never sends it (18.7 s vs its 15 s abort — can never complete).
- **2026-08-11** round7 §7: DELETE = 45% of queries (retention valve holding table at 150,000 cap);
  O(1) `traceStore.row_count` 84,567 vs real ~150-152k (44% under-report, last reconciled 08-01).
- **2026-09-28 (this session)**: the node-1 `activity-system/learning_loop.activity_execution_traces`
  table holds 18,135 rows spanning only **2026-07-13T04:32 → 2026-07-14T23:13**; `execution_traces` is empty.
  Current traces on node 1 are not in this table. (Prior instance of the same class: round6 "local :18080
  frozen at 08-02".)

### Chain I — env/config knobs that are frozen, dead or discarded  [env-gating, sync-deploy-drift, docs-drift]
- **2026-06-02** baseline-alignment 6/6 achieved with `SUBSTRATE_REUSE_KEYWORD_MIN=999` (reuse disabled by env).
- **2026-08-09/21** config-surface-audit: `gen-env.sh` is the only env channel (allow-list); 7 dead vars
  (VLLM_*, FEDERATION_SIGNING_SECRET, SUBSTRATE_ADVERTISE_HOST, VESSEL_ADVERTISE_ENDPOINT); 6 whose operator
  value is discarded (TRACE_STORE_CAP=150000 hardcoded gen-env.sh:473 etc.); F41 peering config written into
  a file regenerated every start (silent un-peer on restart); F42 deploy-hub-pull drops ENABLED_EXTRA_VESSELS
  (hub answers no dispatches); F43 comment claims persistence nothing writes; F63 human surface state
  in-memory only; F55 compose vs make volumes differ (silent empty brain).
- **2026-08-08** cycle-resync: `.substrate-secrets` had two truncating writers (API_KEY_SECRET destroyed);
  FED_SUBSTRATE_ID never persisted (new identity every restart); fix landed at a path vessel-ctl doesn't source;
  bootstrap tier not self-updating ("fixing it in git let each container repair itself BACK into the bug").
- **2026-08-26** hub-admin-keyspace-lockout: `/v1/keys/issue` mints admin keys with no durable plaintext;
  SUBSTRATE_ADMIN_KEY only written on first-boot branch of seed-identity.ts.
- Memory index 09-22: unit `WORKSPACE_ROOT=/workspace` vs env-file super-repo (EnvironmentFile wins) — the
  same WORKSPACE_ROOT variable as round7's applier bug.

### Chain J — goal-host memory / OOM (June)  [spend-envelope-throughput, dormant-mechanism]
- 06-03 autonomous loop fires, goal-host OOM-killed twice in 10 min; in-memory dispatch map lost (#135).
- 06-03 dispatch-setup leak: ~2 GB per single dispatch (54 MB → 2,168 MB) for a template with no LLM step;
  streaming patches addressed ~700 KB (<0.05%).
- 06-03 self-repair: fix authored in a mitosis, but actuator (goal-host) is the broken artifact → cutover
  deadlock; upstream `ias-executor-ts` structurally invisible to `enact-orthogonal-decisions` (owns no templates).
- Post-bootstrap: operator bootstrapped ias-executor-ts 0.1.1 + cancel-after-consume; goal-host "still leaks but
  no longer deadlocks".

### Chain K — gap processing loops / saturation  [narrowing-duplicates, spend-envelope-throughput]
- 06-05 phase-2: gap_to_scenario_bridge non-idempotent; 09-07 residue shows `*-narrowed.json` twins of scenarios.
- **2026-09-14** gap-escalation finding: 139 route-edit mentions / 26 distinct ids in 4 min (~5.3×/gap);
  `falsifier=none` every pass; a `substrateGap_write` during saturation did not persist (read back empty).

---

## 2. Attempts (key → outcome)

| key | date | where | tried | outcome | evidence |
|---|---|---|---|---|---|
| hollow-landing | 06-01 | substrate-authored/MANIFEST, observations | publish-substrate-authored-artifact 7-task composition + gh_pr_merge self-merge | partial | ac67e366, a91a4bbd; evaluation_evidence hand-supplied first time |
| composition-crystallization | 06-02 | findings/2026-06-02-substrate-publishes-to-vessel-repos | reuse same publish composition against vessel repo cwd | worked | exec_mt2w5985, dev-vessel PR #1; composition never seen in retained traces later |
| trace-store-db | 06-03 | findings/2026-06-03-durability… | surrealdb_export/import + backend-snapshot-to-git template, gh_repo_create | dormant | no `backend-snapshot-to-git` in node-1 retained trace window (07-13..14) |
| dormant-mechanism | 06-03 | mitosis-empirical-proof, goal-host-mitosis x2 | vessel_mitosis_start parallel track; v0.2 unit-directive parity | partial | ran twice; v0.1 uncapped memory; evaluate INSUFFICIENT_DATA/NEUTRAL, non-deterministic (06-05) |
| spend-envelope-throughput | 06-03 | goal-host-dispatch-setup-leak | streaming patches (URL filter, body.cancel, Bun.gc) | failed | addressed ~700 KB vs ~2 GB/dispatch |
| selection-learning | 06-04 | learning-rate-2026-06-04 | M1-M6 (embedding prior, concept prior, replay, tier bandit, TD(λ)) validated "tracked+improving" | unknown | M1 dormant behind EMBEDDING_PRIOR_ENABLED=false; 07-03 ledger finds crystallized fraction non-predictive |
| memory-recall | 06-04 | concept-relevancy-investigation | 2bed214 concept-usage fix | failed | ts_sum 22→22 while +22 concepts (10-fixes obs) |
| write-read-mismatch | 06-04 | scenario-seed/seed-gap response | seed gap / seed scenario to test self-repair | failed | seed never read; drafter reads scenario files not gap store |
| drafter-quality | 06-05 | phase-2-probe | probe-chain-stages.sh 7-stage probe | worked (as instrument) | 5/7 HTTP-green, semantically broken |
| env-gating | 06-02 | substrate-consistency baseline | SUBSTRATE_REUSE_KEYWORD_MIN=999 + promote fresh templates | superseded | 6/6 aligned by minting new template per goal |
| selection-learning | 07-03 | results/learning-transfer-causal-ledger | SF-coverage backfill via feature_compose (8 rounds) + operator completions | partial | sf 0.1403→0.1808; landed a0bf985,36be0b2,edb5375,d1400b6; operator 2504304, 96c2aaa; ceiling 104 cells (retention destroyed ~2,000) |
| federation-p2p | 08-08 | results/substrate-cycle-resync | stop/start 2 spokes ×2, fix secrets writers, FED id persistence | worked | 4/4 self-resynced; hub cycle not covered |
| goal-walk-floor | 08-10 | capability-validation | 7 novel file/arith goals serial | worked | 7/7 trial 1 (answer-checked) |
| goal-walk-floor | 08-10 | blocker-clearance round2 | 8 novel goals | partial | 7/8; G9 wallpaper |
| false-verification | 08-10 | blocker-clearance Part 2 | repair A stderr honesty gate, 2 dispatches | failed | frozen gap summary; gate rejected inert patch |
| directed-overshoot | 08-10 | blocker-clearance Part 6 | repair B regex widen | reverted? no — regression live | c9faf50d wrong function; not reverted in-shard |
| goal-walk-floor | 08-10 | round3 | 8 goals | partial | 6/8; hollow recovery suppresses only producer |
| goal-walk-floor | 08-10 | round4 | 8 non-filesystem goals with controls | partial | 4/8, all 4 via universal_tool_fallback; 3 wallpaper |
| false-verification | 08-10 | round5 | 56a0683 ungrounded→fallback | unknown | proving line 0 fires |
| trace-store-db | 08-10 | round5 | activity-api StartLimitIntervalSec=0 drop-in | superseded | round6: unit not load-bearing |
| write-read-mismatch | 08-11 | round7 | proposals_dir fix dispatched | worked (n=1) | dry-run returns mitosisStaged |
| codebase-bloat-fossils | 08-11 | round7 | hand-install placement hook in container clone | failed | 4e4170a8 (09-07) 2134-file sweep; fixed at bootstrap 09-23 d993b331 |
| sync-deploy-drift | 08-11 | round7 | pull-sync self-heal identity gap filed ("Substrate Bot" vs "Substrate Autonomous") | unknown | filed w/ ordering constraint |
| trace-store-db | 08-11 | round7 | O(1) counter stale gap filed | unknown | 44% under-report |
| goal-walk-floor | 08-12 | results/complexity-ladder | 4-rung ladder + 3 must-fail controls | partial | controls correctly failed; all rungs reached with 0 producer steps |
| selection-learning | 08-12 | results/conditioned-differentiation | source-conditioned signatures | partial | 41→44 / 45 correct; `invariant:false` |
| env-gating | 08-21 | config-surface-audit / open-decisions | config-surface-probe.sh | dormant | invoked by nothing (Makefile comment only; §7 says so) |
| human-surface-escalation | 08-09 | config-surface-audit Part 6 | drive surface sequences 1-5 | partial | F26-F30; honest failures |
| endpoint-routing | 08-26 | hub-admin-keyspace-lockout | diagnose admin key | unknown | refused to forge JWT/edit DB; operator decision |
| spend-envelope-throughput | 09-14 | gap-escalation-loop finding | measurement only | unknown | 26 ids ×5.3/4 min |
| selection-learning | 05-13..08-01 | results/*reuse-report.json | reuse-harness hit@k benchmark | dormant/fossil | hit@1 0-0.47 (May); 0/0/0 on 07-05, 07-10, 08-01 — stale expected ids |
| false-verification | 05-22..23 | results/failure-mode-cycle-* | failure-mode-harness cycles | unknown | gap:6→reuse:6 at cycle 5; avg_self_heal_seconds null always |
| false-verification | 08-11 | results/stage-harness-latest | 8-stage fixture harness | worked (as instrument) | 29 pass, 7 known_open; admits no stage dispatches a goal |

---

## 3. Problems

| key | symptom | first | last | recurrences | root cause (as stated by the sources) |
|---|---|---|---|---|---|
| false-verification | reached/status disagree; judge grades form, stub artifacts pass | 2026-05-24 (gap-003) | 2026-08-10 (round5) | ≥6 docs | LLM judge fallback where no deterministic oracle; ungrounded flag wired only to learner |
| selection-learning | "Thompson converging" = validator-dispatch/slot-binding self-loop; satisfier wins bank nothing | 2026-05-25 | 2026-08-12 | ≥7 | posterior credit tied to chain edges/landed shas; signature too fine; cost telemetry zero |
| memory-recall | concept recall/relevance never works | 2026-05-23 | 2026-08-10 | 4 declared causes | FTS `search::score(0)` without `@0@@`, SELECT * of embeddings, 4 s budget; observer creates instead of increments |
| write-read-mismatch | drafted fixes accumulate unapplied | 2026-06-04 | 2026-08-11 | 4 | drafter input = scenario files; applier dir ≠ writer dir; proposal schema mismatch |
| codebase-bloat-fossils | autonomous commits sweep scratch/runtime files into super-repo root | 2026-08-11 (476 files) | 2026-09-07 (2134 files) | 2 | placement hook absent where substrate commits |
| directed-overshoot | directed edit lands in wrong function, reached:true | 2026-08-10 | 2026-08-10 | 1 (+R7 delete 07-03) | no check "patch touches named symbol"; line-numbers vs stale trees |
| trace-store-db | unwindowed trace reads never return; counter lies; DELETE-dominated DB | 2026-08-10 | 2026-08-11 (+node-1 table frozen at 07-14) | 3 | 30-day default window, range-scan+sort; retention valve at cap |
| node-locality | which trace store/tree is real (local vs hub; super-repo vs vessels clone vs /vessels) | 2026-08-10 | 2026-08-11 | 3 | three trees; spoke reads hub; operator ground truth from stale tree (34 vs 47) |
| env-gating | knobs dead/discarded/frozen; peering wiped on restart | 2026-06-02 | 2026-08-26 | many (F1-F68) | gen-env allow-list regenerated each boot |
| goal-walk-floor | hollow recovery suppresses the only producer; non-filesystem goals only work via fallback | 2026-08-10 | 2026-08-12 | 3 | suppressSatisfierShapes; learned/satisfier planes convert answerable goals into false successes |
| spend-envelope-throughput | concurrent dispatch exhausts LLM quota; no back-pressure; verifier retry 400/800 ms | 2026-08-10 | 2026-08-10 | 1 (compose-storm precedent) | no admission against shared budget |
| spend-envelope-throughput | goal-host ~2 GB per dispatch, OOM | 2026-06-03 | 2026-06-04 | 3 | per-dispatch full-state capture (ias-executor-ts) |
| narrowing-duplicates | same gaps re-processed ~5×/4 min; new gap writes lost | 2026-09-14 | 2026-09-14 | 1 | escalation marks nothing durable; falsifier=none never converges (unconfirmed) |
| sync-deploy-drift | pull-sync ahead 2 / behind 72, self-heal refuses own commits | 2026-08-11 | 2026-08-11 | 1 | two substrate identities ("Substrate Bot" vs "Substrate Autonomous") |
| sync-deploy-drift | runtime-only implementation overwritten by cutover skeleton | 2026-07-03 | 2026-07-03 | 1 | runtime vs git drift |
| endpoint-routing | hub ports answer unauthenticated POSTs from internet | 2026-08-11 | 2026-08-11 | 1 | no auth gate on run-goal / impulses/resolve |
| endpoint-routing | admin key plaintext never persisted → key management lockout | 2026-07-16 | 2026-08-26 | 1 | /v1/keys/issue vs seed-identity first-boot only |
| dormant-mechanism | harnesses/probes/detectors built, run once, invoked by nothing | 2026-05-13 | 2026-08-21 | ≥9 scripts | no activity validates them |
| gap-content | gaps filed w/o reach to fix; gap never filed behind c9faf50d; summaries phrased as correct state get closed already_resolved | 2026-08-10 | 2026-08-11 | 3 | — |
| human-surface-escalation | surface state in-memory; solicitation panel it can never receive | 2026-08-09 | 2026-08-21 | 1 audit | store.ts no persistence |
| docs-drift | config audit went stale both directions; role table wrong; "two commands" claim false | 2026-08-09 | 2026-08-21 | many | docs not verified by any invoked probe |
| test-residue-live-state | audit residue in live substrate (dispatch 097061c8…, a human grade, a uiFeedback) ; G4 minted empty UI panels | 2026-08-09 | 2026-08-10 | 2 | probes write through live stores |

---

## 4. Mechanisms (keep / fossil)

| name | location | purpose | status | evidence | general? |
|---|---|---|---|---|---|
| deterministic count oracle `verifyCountFilesReach` (+15 sibling `verify*Reach`) | goal-host-vessel/src/index.ts ~1602/1628 | recompute answer instead of LLM judge | live-used, narrow | fires only on `(repos|vessels)/…`; no directory-count oracle | specific paths; the pattern is the keeper |
| hollow detector `hollow_walklog_capped` ("cannot out-testify the walk's own log") | goal-host | refuse LLM judge override when walk produced 0 shapes | live-used | cap-val §1.4 | general |
| `isGroundedHonestReach` + 56a0683 grounded→fallback | goal-host | ungrounded reach → universal tool fallback | live, unproven | 0 fires at time of writing | general seam |
| universal_tool_fallback | goal-host | ReAct floor | live-used | carried 4/4 non-filesystem successes (round4) | general — keep |
| malformed-goal guard ("interpolation did not render") | goal-host | refuse {{NONCE}} goals | live-used | round4 | general |
| coalescing key (exact trimmed text while running) | goal-host index.ts:12217 | dedupe | live-used | round4 | general |
| publish-substrate-authored-artifact (7-task) | development-vessel seed | substrate git author chain | fossil (June) | not in node-1 retained window; later landing path is feature_compose | superseded |
| evaluate-pr-via-internal-idioms / gh_pr_merge self-merge | development-vessel | self-merge with trace evidence | fossil | June only | superseded |
| vessel_mitosis_start/evaluate/cutover (+freshness gate) | development-vessel resolvers | parallel-track self-modification | live-used (evolved) | mitosis-* ticks present in July window (90-176 traces each); evaluate non-deterministic 06-05 | general |
| surrealdb_export/import + backend-snapshot-to-git | development-vessel | durability | dormant | 0 traces in retained window | — |
| gh_repo_create / vessel-repo-promote | development-vessel | substrate-owned remotes | dormant | submodule cutover deferred; memory 09-22: 3 vessels still plain files | — |
| draft-gap-closing-activity → gap-closing:auto-* (4-task fs_read/http_fetch/llm/fs_write) | development-vessel seed | auto-draft templates | fossil/duplicate | 530 traces July window; June templates were analysis-only, mode collapse onto fm-43 | duplicate mints |
| apply-proposal-as-patch | development-vessel | apply drafted proposals | live-used (after 08-11 fix) | 39 traces July window; dir mismatch fixed 08-11 | — |
| gap_to_scenario_bridge | development-vessel | gap→scenario file | live, non-idempotent | 333 traces July window; `-narrowed` scenario twins in 4e4170a8 | duplicate generator |
| autocomplete-concept-writer observer | development-vessel/src/observers | concept per success | broken (June) | creates new concepts, never increments | — |
| concept-usage-backfill template | development-vessel seed | increment ts on cited concepts | broken (June) | task 3 never runs; 98 traces July | — |
| M1 embedding prior | activity-api | posterior prior | dormant | EMBEDDING_PRIOR_ENABLED=false (and gen-env hardcodes it — config audit) | env-gated |
| M3 replay observer (ribosome) | ribosome-vessel | replay on template_created | live (June) | 106 jobs/h June | — |
| M6 TD(λ) chain credit | activity-api posterior-update.ts | credit propagation | live (June) | 2393 chain-credit traces/2 h; July ledger: stalled 0/145 | — |
| state signature conditioning (`selectGoalForLoadConditioned`) | boredom-vessel | load-conditioned selection | decorative (June) | signature too fine | — |
| horizon detectors (pattern-scan, responsibility-audit, lifecycle-audit, resolver-distribution) | development-vessel | architecture gap emission | mixed | resolver-distribution 71 traces July; pattern-scan 0 | duplicates likely |
| `detect-unclassified_failure_*` detectors | activity table | per-failure auto-minted detectors | duplicate (suspected) | 136-145 traces each in July window for mitosis variants | bloat candidate |
| validator-dispatch / slot-binding | activity-api/ias-executor | lifecycle chain | live-used, self-loop | 4,280 / 1,503 traces in July window; 85% of June traffic | fossil loop |
| stateful-ui-vessel face (port 8270) | repos/stateful-ui-vessel | panels + interactor learning | fossil/replaced | memory 09-22: pinned :8270 got 248 escalations nobody reads | superseded by human-surface |
| vessel_heartbeat_starvation_scan (substrate-authored 06-01) | validation/substrate-authored/proposed | detector | fossil | 0 hits in repos/*/src; .js/.d.ts added by residue commit | never adopted |
| adversarial probe corpus v1 (13 probes) + `adversarial-probe-tick` | validation/adversarial-probes/v1 | S1→S2 / push-away gate | dormant | no consumer code for adversarial-probe-tick/adversarialProbeReport in repos/*/src; 0 traces in July window | never wired |
| closure-status audit (7 properties) | validation/state/closure-status.json | CLAUDE.md-closure properties | broken instrument | 09-07 run: dev-vessel "unreachable", HTTP 0 → 5 "not closed" | — |
| lift-status.json | validation/state | S1/S2/S3 ledger | fossil | as_of 2026-05-26 / 06-02 | superseded |
| substrate-narrator + gaps/INDEX (g0001…) | validation/scripts/substrate-narrator.ts, validation/gaps | narration gap records | fossil | docs-only reference; INDEX last row 05-24 | superseded by gap store |
| COORDINATION.md 3-agent protocol / F-number ranges | validation/state, findings/README | multi-agent coordination | fossil | May-June only | — |
| reuse-harness hit@k benchmark | validation/scripts/reuse-harness.ts | template reuse metric | fossil instrument | expected ids are May template names; 0/0/0 since 07-05; two 07-05 files byte-identical | — |
| failure-mode-harness | validation/scripts | scenario reuse/gap | dormant | invoked by docs + seed that calls itself its "equivalent"; last result 07-05 | — |
| stratified-harness, test-forge-goal-completion | validation/scripts | coverage / forge | dormant | only via run-weekly-harness.sh; the weekly cron asserted in a template description not established | — |
| stage-harness | validation/scripts/stage-harness.ts | 8-stage edit-chain fixtures | live-unused | no invoker; latest 08-11 29 pass/7 known_open | keep, needs an activity |
| complexity-ladder-harness, conditioned-differentiation-harness, probe-chain-stages | validation/scripts | reach differentiation / chain probe | live-unused | no invoker | keep ladder design (must-fail controls) |
| substrate-cycle-resync.mjs | validation/scripts | restart/resync test | live-unused | referenced only in a code comment (federation-probe-tick.ts:901) | — |
| config-surface-probe.sh | scripts/substrate | config delivery probe | live-unused | Makefile:159 comment only; open-decisions §7 | — |
| compiled `.js/.d.ts/.map` siblings | validation/scripts, substrate-authored/proposed | build output | duplicate | committed next to every .ts | bloat |

---

## 5. Claims (declared fixed/working/first → what later showed)

| key | claimed_at | claim | where | later |
|---|---|---|---|---|
| hollow-landing | 2026-06-01 | first substrate self-merge | substrate-authored observations 19-23-02Z (a91a4bbd) | next obs: evidence was hand-supplied; re-done "traceably" |
| hollow-landing | 2026-06-02 | vessel_authoring_criterion MET | state/lift-status.json (fc94ce5a) | autonomy still open criterion through Sept |
| hollow-landing | 2026-08-10 | hard autonomy criterion met (19b027ba) | capability-validation §2.4 | 19b027ba swept operator's file; 09-07 autonomous commit = 2134 residue files |
| selection-learning | 2026-05-25 | Thompson converging / posteriors live after RETURN fix | iter-21, iter-24 | dominance 301/301 validator-dispatch; 06-04 ≈85% self-loop; 09-08 posteriors vestigial (memory) |
| selection-learning | 2026-05-25 | F-083 debunked; posteriors safe (α monotonic) | findings/f-083-debunked.md | proof metric was the self-looping validator-dispatch |
| selection-learning | 2026-06-04 | M1-M6 all tracked and improving | learning-rate validation | M1 dormant; 07-03 crystallization non-predictive; 08-12 0 producer steps |
| memory-recall | 2026-06-04 | 2bed214 fixes concept relevance | concept-relevancy / 10-fixes | ts_sum unchanged in window |
| memory-recall | 2026-08-10 | recall blocked by mask → by BM25 IDF | capability-validation §1.2, §4 | blocker-clearance Part 4: both wrong; missing match reference |
| goal-walk-floor | 2026-08-10 | structural floor gap for pure-reasoning goals | capability-validation §1.4 | retracted same doc: starvation; serial 5050 trial 1 |
| directed-overshoot | 2026-08-10 | c9faf50d regression claims "src/foo" goals | blocker-clearance Part 6 | round3: example wrong; real blast radius 7/7 registry-token counts |
| false-verification | 2026-08-10 | 56a0683 fixes reach honesty | round5 | "not proven": 0 fires; later status not in shard |
| trace-store-db | 2026-08-10 | activity-api is the spoke's only reachable trace store | round3, round5 | round6: fleet uses hub; local unit not load-bearing |
| trace-store-db | 2026-08-09 | trace store is down | config-audit §7.10 | retracted: hang without restart under contention |
| spend-envelope-throughput | 2026-08-11 | load 15.3, container 353% (6× improvement) | round7 first draft | retracted in f1dcb5cf: single sample; 511-1989% |
| env-gating | 2026-08-09 | F10 inventory drift in image | config-audit | retracted: measured an old container |
| write-read-mismatch | 2026-08-11 | applier fixed | round7 §1 | proven n=1 dry-run only |
| codebase-bloat-fossils | 2026-08-11 | placement hook installed — root cause closed | round7 §2 | 09-07 4e4170a8 2134-file sweep; real fix 09-23 d993b331 |
| federation-p2p | 2026-08-08 | substrates cycle freely and resync 4/4 | results/substrate-cycle-resync | only spokes; hub not covered; 4 flattering instrument faults found first |
| env-gating | 2026-06-02 | 6/6 intent alignment | substrate-consistency baseline | achieved with reuse disabled by env + a fresh mint per goal |
| dormant-mechanism | 2026-06-03 | mitosis empirically proven | mitosis-empirical-proof | 06-04: 0 cutovers, evaluate INSUFFICIENT_DATA; 06-05 non-deterministic |
| drafter-quality | 2026-06-03 | side-effect vessel improvement operational; "lift is a stable mode" | side-effect-vessel-improvement | dispatch OOM'd; 06-04: author/stage run, evaluate/integrate stalled |
| composition-crystallization | 2026-06-04 | substrate authored 2 templates end-to-end | self-repair post-bootstrap | both executed 0 times afterwards |
| false-verification | 2026-05-22 | failure-mode cycles reuse:6 | results/failure-mode-cycle-5..8 | avg_self_heal_seconds null throughout; 07-05 back to gap:6 |
| selection-learning | 2026-05-23 | reuse hit@5 0.6 | results/run2-20260523 | 07-05/07-10/08-01 all 0 (benchmark fossil) |
| dormant-mechanism | 2026-09-07 | push-away closed | state/closure-status.json | same run cannot reach dev-vessel; one probe shape recorded |

---

## 6. Instrument findings from this session (read-only queries, node 1)

1. `activity-system/learning_loop.activity_execution_traces` = 18,135 rows, newest
   `2026-07-14T23:13:46Z` (`development-vessel:resolver-author`), oldest `2026-07-13T04:32:09Z`.
   `execution_traces` = 0 rows. So any activity counts from this table describe a **two-day July window**:
   validator-dispatch 4,280; slot-binding 1,503; draft-gap-closing-activity 530; gap-to-scenario 333;
   concept-usage-backfill 98; resolver-distribution-audit-tick 71; apply-proposal-as-patch 39;
   substrate-health-tick 4; mitosis family 90-176 each; coverage-tick, harness-run-matrix,
   drain-pending-substrate-gaps, observe/enact-orthogonal, vessel-architecture-pattern-scan-tick,
   vessel-demand-tick, probe-reachable-unlearned, backend-snapshot-to-git, publish-substrate-authored-artifact,
   adversarial* = 0 in that window. Not current usage.
2. **False-positive trap:** `executed_at > '2026-09-21'` (string literal) matched all 18,135 rows (July);
   `executed_at > d'2026-09-27T00:00:00Z'` matched 0. Always use `d'…'` datetime literals.
3. **False-zero trap:** `SELECT count() … GROUP ALL` over zero matching rows returns `[]`, not `{count:0}`.
4. `math::max(executed_at)` over datetimes returned null.

---

## 7. Principles (from the shard's own lessons)

- Score by answer vs independently computed ground truth in the tree the substrate reads; `reached` is data.
- Serial dispatch when measuring; concurrent runs exhaust the shared LLM quota and make "no route" and
  "LLM starved" indistinguishable in the walk log.
- A pattern/regex repair must be run against a case list incl. false-positive traps; typecheck can't tell
  a working pattern from an inert one.
- Give drafters verbatim, verified-unique anchor text, never a prose location; name the function and
  check the landed diff touches it.
- An edit goal's `reached` means "a commit landed"; verify the named symbol changed.
- Gap summaries must describe the defect, not the correct state (else closed `already_resolved`).
- Check which store/tree/process a component actually uses (`/proc/<pid>/environ`) before diagnosing it.
- A health probe that asks "is my process up" can't see the load-bearing route failing (20 ms /health vs 42 s resolve).
- Repeating the code's own log message is not a diagnosis.
- Instruments fail in the flattering direction: presence≠liveness (registry TTL), `every()` over empty set,
  conditional shape treated as mandatory, measuring a stopped container, single sample of a bursty signal.
- A check nothing invokes cannot be trusted when it passes (config-surface-probe, stage-harness, etc.).
- Fix at the tier that runs: a hand-applied fix in one clone is re-broken by the next boot/commit path.
- A remedy correct by the inventory can be wrong against measured state (masking activity-api) — and the
  measurement itself needs a control (round6 then refuted round3).
- Refuse privilege escalation to unblock (forged JWT, DB edit) — escalate credentials to the operator.
- Surreal: datetime literals `d'…'`; GROUP ALL on empty returns []; `SELECT * LIMIT 1` for field names.

---

## 8. Keep / archive recommendation (for this shard)

**Keep (load-bearing evidence):** capability-validation, blocker-clearance-and-round2, round3-7,
config-surface-audit + open-decisions, hub-admin-keyspace-lockout, gap-escalation-loop, causal ledger,
cycle-resync md, complexity-ladder + stage-harness JSON (their designs: must-fail controls, known_open fixtures).

**Archive as fossils (historical only):** iter-15..35 narrations, dev-guidance x2, gaps/ (narration era,
superseded by the gap store), state/COORDINATION.md, lift-status.json, agent-coordination.json,
substrate-authored/ (June publication chain), substrate-consistency, orthogonal/state-conditioning/ui
observations, May reuse/failure-mode/stratified JSON (instrument stale), adversarial-probes/v1
(never wired — either wire as an activity or archive).

**Delete candidates:** compiled `.js/.d.ts/.map` in `substrate-authored/proposed/` (arrived via residue
commit 4e4170a8); duplicate `results/2026-07-05-reuse-report.json` (byte-identical to hub-rebaseline);
`state/closure-status.json` (runtime output committed by the residue sweep; its negatives are unreachability).
