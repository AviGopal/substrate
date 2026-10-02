# openspec-10 — shard entries 163-179 (read-only research, 2026-09-28/29)

Shard as actually listed by `(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#') | sed -n '163,179p'` (179 total):

| # | entry | kind |
|---|---|---|
| 163 | new-http-response-resolver.ts | stray substrate-authored file |
| 164-168 | new-simple-http-response-resolver.{ts,js,d.ts,*.map} | stray (compiled artefacts) |
| 169 | obsidian-legibility-surface/ | spec-only proposal (07-18) |
| 170 | patch-config-types.json | stray drafter patch |
| 171-173 | route-edit-9077062c-create-{config,impulses-and-dispatch,resolver}.json | stray drafter patches |
| 174 | unified-install-interface/ | active change (09-23) |
| 175 | value-per-cost-selection/ | active change (09-26..09-28), the most recent plan |
| 176 | archive/2026-05-17-stratified-goal-generator-harness | archived |
| 177 | archive/2026-05-30-autonomous-palette-write-resolvers | archived |
| 178 | archive/2026-05-30-substrate-gap-drafter-wiring | archived |
| 179 | archive/2026-09-24-resumable-landings | archived |

NOTE: the task text guessed that this shard held contained-self-development, decentralized-compose-ownership,
2026-09-24-live-self-view, consumer-side-landing-probes, causal-attempt-ledger, do-anything-surface,
human-surface-stack. By the real ordering those sit at other indexes; only value-per-cost-selection,
unified-install-interface and obsidian-legibility-surface from that list are here. I did not cover the others.

---

## 1. value-per-cost-selection (active; proposal/design/tasks read in full; 43 goal files)

**Why (baseline 2026-09-26, node 1):** recursion storm ~3,080 walks in 3 h (21 reached); ~60% of 210 node-1
autonomous composes structurally unable to land (84 at a vessel refused at cutover — 54 drafted+verified first;
21 gaps with no edit site; 51 retries of known failures; 18 protected vessel); node 2 composed 117× unsupervised
because a pause written on node 1 did not exist on node 2; dispatches kept walking after their own landing (one wrote
broken code to live source, one overwrote a real landing with a false "failed"); LLM credits exhausted; 57 autonomous
commits, several reverted. Cost recorded: $0.52 across 38,845 execution rows / 30.8 M input tokens (i.e. cost
accounting absent — `cost_usd: 0` hardcoded at five hops: llm-resolver credit fallback, feature-compose llmCall,
compose report `cost:0`, ias-executor `vessel-daemon.ts:315`, goal-host llm-router `costUsd: 0`).

Design facts worth keeping (they are class facts):
- Admission ran checks in the wrong order (blocking `bun run typecheck` spawn before the cheap "has a target"
  test); push scope evaluated only at cutover AFTER draft+verify; falsifier class and edit_site never gated;
  proposal-backed gaps ALWAYS admitted (`gap-to-feature.ts:1668`).
- Thompson rerank sorted by class theta before score → score-0 gap in a fresh Beta(1,1) class beat a 0.9 runner-up.
- THREE landability models, none calibrated; `gap-lifecycle-scan.ts:359-412` writes predictions nobody reads;
  `gap-landability-model.ts` imported by nothing (dormant/fossil).
- Landed dispatches did not terminate: Bun's default fetch idle timeout (~300 s) silently overrode the 900 s
  AbortSignal → early edit-intent compose "timed out" → fallback walk → second compose → BUSY → `failed/reached:false`
  overwrote the landing; double-compose guard missed because cutover sha ≠ final sha.
- Negative knowledge prompt-only: `.goal-host-failure-memory.jsonl` deliberately DROPS deterministic refusals.
- Budget/pause node-local and not money: rhythm `budget` is a load fraction; budget>1 = undeclared pause;
  `operator_pause` read by no code; readers resolve their own node only.
- `successYield` folded cost into P(success).

### Task-by-task status (as recorded in tasks.md, then checked on origin/dev and live journals 09-29 ~04:20Z)

All landed hashes below verified as ancestors of origin/dev in their repo (git merge-base), and the key strings
are present at HEAD (fc-exact, fc-no-gap, all-edits floor, push_scope_refused, spendEnvelope×14,
llmSpendSummaryNode, include_calibration, SPEND-RATE REFUSED, `timeout: false`×3, dispatchRatePolicy,
llmSpendSummary, boredom "spend envelope"). EVERY one of these commits is authored "substrate-authored: apply
route-edit-… via mitosis cutover" although each was an OPERATOR pre-validated exact edit ("directed") — the
git author line does not distinguish directed from autonomous (see claims).

| task | status | what / hash | live evidence |
|---|---|---|---|
| 0.1 | done | autonomy held on both nodes via `autonomous_pick` lease renew loops | superseded: reopened 09-27 08:50 (contained), 21:47 @2 USD/h |
| 0.2 | done | baselines: verified closures/day 14,13,7; fc landed 16.2%/7d, 12.3%/1d; walk yield 21%; structural refusal ≈60% | — |
| 1.1 | done | llm-resolver `7d7bf0a` usage.cost_usd + in-memory `llmSpendSummary` | falsifier passed 09-26 23:47 |
| 1.2 | done* | dev-vessel `98bc2b5` compose accumulates tokens — but SILENTLY REVERTED 2.6 (coalesced retry, stale base) | 2.6 re-landed `c10e74a` |
| 1.3 | done | goal-host `4eaad89` + `44e5615` | exec-level falsifier passed 00:01Z: 209 rows, $0.149/10 min |
| 1.4 | OPEN | ias-executor vessel-daemon cost passthrough; needs dist rebuild + re-propagation | not landed |
| 1.5a-c | done | `b880497`, `b7bda9c`, `e8c58ce` caller attribution | — |
| 1.5d | done | `67a25ea` default caller in llm-completion-dispatch | falsifier passed 08:30: unknown <1% (from 57–98%) |
| 1.5e | landed (goal file untracked, not in tasks.md) | feature_compose caller — "$1.06 of $1.31 caller unknown in first contained hour" | `caller: 'development-vessel:feature_compose'` present once at origin/dev |
| 1.6 | done | llm-resolver `3c83a33` prompt ceiling (5 gemini fallback calls took 3.99M tokens ≈ 72% of spend) | — |
| 2.1 | done | `3cbf979` push-scope at admission, PROTECTED_VESSELS import | admission logs `protected_vessel` exclusions live |
| 2.2 | done** | `c23b601` actionable-only admission; first attempt rolled back by test gate (test encoded old "always admit" policy); then DOUBLE-APPLIED as `194df79` by a non-terminating dispatch | duplicate removed by 2.4 cutover; live `needs_information` 340 (n1)/436 (n2) |
| 2.3 | OPEN | cheapest-first reorder; site-cap increment bug `:1557`; triplicated repeated-failure block `:1566/:1588/:1610` | not landed |
| 2.4 | done*** | `bea12ec` LLM-availability probe; a SECOND drafted landing of the same gap `7eae3a0` added a duplicate config-based probe; removed by `a30959a` | — |
| 2.5 | done | `96bf098` landability floor before rerank | — |
| 2.6 | done | `afc7d6d` → reverted by `98bc2b5` → `c10e74a` goal-supplied unique anchor outside grounding window | 119 re-drafts on 09-26 were this |
| 2.7 | done | `f70160f` deterministic verbatim EDIT-block path (no LLM plan) | fc-exact applying: 7 (n1) / 86 (n2) since 09-27 07:00 |
| 2.8 | [ ] but landed | `a188771` refuse gapless compose (adhoc 0/122 all week; gate failed closed on purpose since 575514d 07-19 with a stale PASS comment) | falsifier now observed: `[fc-no-gap] REFUSED` 16 (n1) / 4 (n2) — box not ticked |
| 3.1 | done | goal-host `f3ffd7d` git probe for route-edit id on timeout | — |
| 3.2 | done | `f9001e9` landed-verdict latch | — |
| 3.3 | done | `1942eaf` `timeout: false` (Bun idle timeout root cause); post-walk compose routed to node 1 not owner | — |
| 3.4 | OPEN | durable negative facts with invalidation conditions | NOT BUILT — repeated goals are only rate-limited (see 4.4) |
| 3.5 (floor) | [ ] but landed | `b9537eb` all-edits floor (3 FAVORABLE landings had applied 1/3,1/3,4/5 ops; verdict ignored `applyFailed`) | observed: `all-edits floor: WITHHELD FAVORABLE` 1 (n1) / 11 (n2); unfixed sibling: `ops.length = maxOps` silent truncation |
| 3.5 (no partial reach) | OPEN | goal reach counts N requested edits | — |
| 4.0 | OPEN | per-node llm-resolver identity + published P220 (needs container recreate = user decision) | bypassed by 4.0a |
| 4.0a | done | `e6f07a0`,`55c0649`,`c3c4041` `llmSpendSummaryNode` relay via dev-vessel | falsifier passed 06:50 (spent 0.14183 vs hand-sum 0.14182) |
| 4.1/4.2 | done | `292aff1`,`054de6f` envelope gate in auto-pick, investigate-and-decompose dispatch (the lease bypass), event-driven nudge (was re-walking one siteless family 17×/h ≈ $3.8/h with autonomy "held") | envelope binding 09-28 (50 refusals/h at 11:30) |
| 4.3a-c | done | `c313227` conductor, `baa64cc` apply-proposal, boredom `f28bc06` | falsifier passed 07:15 (pause) |
| 4.4 | done | goal-host `76c8e60` per-hash/global spend-rate breaker (defaults 3600/6/240, in-process, resets on restart) | SPEND-RATE REFUSED since 09-27 07:00: 1,380 (n1) / 727 (n2); ONE hash `0ee592d0` = 629 refusals on n1 — the breaker contains but the dispatcher never learns (3.4 absent) |
| 4b.1 | done | activity-api `626eb63` FTS offset honoured | — |
| 4b.2/4b.2b | done | `ba3408b`,`79eaaef` catalogue cache (49 listings/min from boredom paging 20× same page) | falsifier pending restart at write time |
| 4b.3 | OPEN | indexes activity.created_at, vpm.activity_id/variant_id, caller-id logging | — |
| 5.1 | OPEN | cost_n/cost_sum on SCHEMAFULL tables (migration) | — |
| 5.2 | landed, box [ ] | activity-api `97adc04` success yield without cost; test inverted first `1b3a3f7`; law-12 snapshot in container volume | — |
| 5.3 | OPEN | score = p / E[cost] | NOT BUILT: the proposal's central "one currency" is unimplemented |
| 5.4 | OPEN | per-(site,category) calibrated landability | — |
| 5.5(i) | landed | `febc7da` closeLandedGap writes closed_reason landed_verified + landed_sha | — |
| 5.5(ii/iii) | DEFERRED | close credit to gap-class posterior; file node-local | `route-edit` α1/β195 on node 1 |
| 5.5(iv) | landed 09-28 | `76bf256` category calibration held by the gap-store holder; node-2 local file had sealed systematic_failure 8/0, edit_intent_route 21/0, self_development 15/0 → excluded 126/128 | 18:30 node-2 pool 2→59; hopeless_excluded 0 afterwards; gap-class-posteriors.json STILL node-local |
| 6.1 | done outside tasks.md | reopen: CHECKINS 09-27 08:50 contained, 21:47 2 USD/h | 09-28 06:08 relaxed falsifier classes → 23:30 re-tightened to class1/class2 |
| 6.2 | OPEN | observe 24 h vs baseline | CHECKINS 09-28 23:35: reach fell to ~8%/h (from 20–30% earlier, 42–61% pre-break); 09-28 18:45 correction: five autonomous landings missed, "none is an improvement and none is system-verifiable"; 23:45 "the system credited an inert landing". Live 09-29 04:19Z: both nodes `863 candidates → 0 admitted` (n1: not owned 426, needs_information 340, autonomy_scope 68, protected 22; n2: needs_information 436, autonomy_scope 271, not owned 129, operator_hold 24) |

Admissible-work finding (09-27 07:25): 61 of 2,340 open gaps (2.6%) have edit site + class1/2 falsifier + no hold;
~53 workable. **97% of open gaps are not fixable as filed** → gap-content is the step-5 bottleneck.

Method laws this change encodes (keep): pre-validated exact edits with unique anchors, tsc before/after on a scratch
copy, tests under `WORKSPACE_ROOT=$(mktemp -d)`, no `$'`/`$&` in new text, "done when" names no shapes, byte-compare
landed file vs pre-validated, runtime==clone, one landing at a time per vessel. Caveat recorded in 4.0a: seqland's
runtime==clone compares against the node-1 clone working tree, which pull-sync advances → on an unsynced node it
compares two stale files.

---

## 2. unified-install-interface (active; proposal+tasks read; design/interface/evidence skimmed via proposal)

Problem statement is a class analysis worth keeping: 8 launch lanes, ≥8 docs each naming a canonical start, 3
healthchecks, 3 stop graces, 5 port sets; of 55 prior setup-audit findings 22 hold, 14 partial, 17 never fixed,
2 regressed, NONE verified off-host or on a pulled image. Five recurring classes: lane-drift, fail-open checks,
fixes outside the artifact, warm-state masking, doc-code drift aligned to a harness. "Fixing instances has been fast
(~1 day) and non-durable."

**Task status — CONFLICT:** committed tasks.md (d043bde5 / 0a406621, 09-23) ticks 0.2, 1.1–1.4, 2.1–2.14, 2b.1–2b.3,
3.1–3.3, 4.1–4.3, 5.1, 5.2, 5.4, 5b.1, 5c.1–5c.3 (with "Pending:" notes on most). The WORKING TREE copy (mtime
2026-09-28 20:11, uncommitted) UNTICKS every one of them back to `[ ]` except 0.1 — someone is reverting the claims
to unverified. Reality check:
- Artefacts exist in the tree: `scripts/substrate/substrate-{status,connect,manifest,ready,doctor}.sh`,
  `deploy.sh`, `.github/workflows/install-acceptance.yml` (419 lines), README `install:standalone|hub|spoke`
  fences, inventory `profiles`/`composed_profiles`. Commits fa7e9189, 2e34e161, c6e9ab83 (09-23).
- Running node 1 container `/usr/local/bin` has substrate-config/doctor/entrypoint/key/pull-sync/ready but NOT
  substrate-status/connect/manifest, and no /etc/substrate/image-revision → live fleet runs a pre-contract image.
- **Install acceptance CI: 39 "success", 7 failure, 5 skipped since 09-24; every one of the ≥29 "success" runs
  checked (09-25 07:22 → 09-29 00:55) reports `requested usable: fail` on BOTH docker and podman**, cause always
  `no LLM arm is currently servable (0 policy arm(s) checked); last-resort model 'claude-haiku-4-5-20251001' is
  (held…)`. The workflow conclusion is green (report-only), `promote` skipped every time. So the detector exists
  and has NEVER seen a usable install; the green badge reads as a pass.
- The report job's `ACCEPTANCE_HUB_URL` / `ACCEPTANCE_HUB_KEY` are EMPTY → results never reach the hub; they pile up
  as an `install-acceptance-unposted` artifact backlog. No install-acceptance gap exists in the live gap store
  (searched 6,278 rows). Task 1.4 "file a gap on failure" is therefore unwired: the detector's reader is absent
  (write-read-mismatch / dormant-mechanism). design.md Decision 6 (ratified) says explicitly "Recording in the
  substrate is not optional … the learner is the substrate: each run posts an installAcceptance impulse … a failure
  files a gap" — that half does not exist in practice.
- FRAMING: the green run conclusion is BY DESIGN (section 1 is "report-only"; promote is the gate and is skipped).
  The defects are (a) the unposted/ungapped result (reader absent), (b) usable=fail on 100% of runs since 09-25 with
  no one acting, and (c) the live fleet not running a contract image. The CAUSE of (b) is UNATTRIBUTED: "no LLM arm
  servable" on a CI runner may be a missing/invalid CI provider secret (the log shows ANTHROPIC_API_KEY configured
  but the last-resort arm "held") rather than an image defect — no positive control through the same address was run.
- 2.9 and 2b.1 and 5c.1 were "Landed as a direct edit, not a dispatched goal (the cockpit was unreachable)".

---

## 3. obsidian-legibility-surface (proposal only, 07-18; rung 4 of s2-stability-ladder)

Clarification exit on low-confidence intake; system-proposed reformulation on failure; every dispatch ends in a
written outcome note; all flows as graded activities. No tasks.md. grep of goal-host / human-surface / obsidian /
development-vessel src for outcome note / reformulation / clarification-exit: NO hits. obsidian-vessel since
superseded by human-surface-vessel. Status: spec-only fossil; the law-13 expectation it describes remains unmet
(operators still rewrite goals — see value-per-cost's pre-validated EDIT-block discipline, which is the opposite).

---

## 4. archive/2026-05-17-stratified-goal-generator-harness

All ~45 tasks ticked DONE 05-19..07-01 (goal-generator.ts, stratified-harness.ts 853 lines, coverage matrix,
reuse efficiency, optimality cache `validation/state/shortest-paths.json`, refinement events, decision_record on
`/v2/activities/recommend`, multi-witness, held-out rotation, weekly CI). Files still exist. **Weekly Recommendation
Validation workflow: 20 of 20 runs FAILED since 2026-05-18 (last 09-28), each in ~12 s; the 6 most recent checked all
log `FATAL: METABOB_API_KEY is not set.`** Newest stratified result on disk: 05-17. Only callers now: scripts/substrate/operator-goal-generator
(different generator) and comments. → dormant-mechanism: built, validated once (05-20 baseline
`universality_pass: true` on 10 goals), never run again; its CI failure never became a gap.

## 5. archive/2026-05-30-autonomous-palette-write-resolvers

All tasks ticked. Extended drafter palette to concept_create_write / conceptLink_write / substrateGap_write via
http_fetch. The prompt HARDCODES `substrateGap_write: POST http://127.0.0.1:8270/v2/impulses/resolve`. Live today
:8270 answers `{"vessel":"stateful-ui-vessel","panels":794}`; development-vessel is :8090. The prompt still carries
that line (`draft-gap-closing-activity.ts:118`), plus 8260 pins; 9 dev-vessel src files still hardcode
`127.0.0.1:8270`. Same hat as the memory's "248 escalations to pinned :8270". Execution table: 3 rows ever for
`development-vessel:draft-gap-closing-activity` (retained window). Stop-doing signal (3 consecutive autonomous
cycles minting concepts) never evidenced. → endpoint-routing + dormant.

## 6. archive/2026-05-30-substrate-gap-drafter-wiring

All tasks ticked: `drain-pending-substrate-gaps` seed + boredom goal[10]. Still present in source (boredom
index.ts:388/602/761). Execution table: 1 row for `development-vessel:drain-pending-substrate-gaps`. Its D.2 probe
reads `/workspace/gaps/gaps.json`; the live store is `/workspace/git/super-repo/gaps/gaps.json` (6,278 rows, written
04:21 today). `/workspace/gaps/gaps.json` still exists on node 1 (830 rows, LAST WRITTEN 2026-09-26 14:06 with
`typecheck-development-vessel-src-resolvers-vessel-mitosis-cutover-l27xx-ts11xx` gaps) alongside 2×4.5 MB
`.tmp` files from 08-07, a 5.3 MB bak-preclassdedup, pre-halt-backup etc. → HYPOTHESIS (writer not
identified): some writer resolved WORKSPACE_ROOT=/workspace two days ago, OR a test run with the live environment
wrote typecheck gaps there (CHECKINS 09-28 02:15–03:52 documents test runs inheriting the live env until `ea07298`): a second gap store is still being written (write-read-mismatch, recurs
the 09-22 "two memory stores" hat).

## 7. archive/2026-09-24-resumable-landings (read in full)

Why: 25 FAVORABLE cutovers, 7 refused for a held change_window lease then rolled back, 4 killed at the 240 s
drain; ~1/3 of verified work thrown away. Root causes: every restart budget shorter than a compose; a global
unnamed lease shared by cutover and trace-store-reconcile (reconcile held it half of wall clock).
Tasks (all [x]): 1.1 park `873fd81`; 1.2 pick park `c1dd4c2`; 1.3 resume `6ab8271` — which SILENTLY REVERTED
`a0ff3d3` (cutover staged a whole file from before it), restored `7994841`; 1.4 SIGTERM parks post-gate `b789d9c`;
1.5 `discardedLandingReport` detector `49b6b1c` (counts resumed parks as discarded — follow-up); 2.1a `/health`
in_flight_oldest_ms `883640f`; 2.2 pull-sync age-based defer (operator tier; one unexplained restart "no
in_flight_oldest_ms published" at 16:44); 3.1a-i `ace49c0`, 3.1a-ii `e17ea38`, 3.1c `80e168f` (test lease path leaked
cutover holds into other tests: 2/12 → 14/0), 3.1b `4e40707`, 3.2 `0b06246`, 3.2b `9ee5d9d` (3.1b's union semantics
re-broke cutovers until the read named `cutover`), 3.3a-i `a2f7542`, 3.3a-ii `5475e11`, 3.3b `c6213f1` seeder upsert on
seed_version (seeder was SEED-IF-EMPTY; `/templates` paging unstably ordered: 2,771 rows / 2,719 unique), 3.3b-fix
`0a8de60`, 3.4 activity-api `1055cba`. Reconcile run graded HOLLOW (valve deleted nothing). Executor has no
failure-path task semantics (3.3c deferred, still absent).
Detector liveness (checked): node-1 `[gap-drain-observer] discarded landings:` ran 292× in 48 h, latest 04:23Z
09-29, all `total=0` — the sweep completes; no discards since 09-26 (so the absence of later gaps is a true zero,
not a dead detector).
Live now: `/workspace/parked-landings` holds **47 park files**, newest 09-26 21:05, oldest 09-24 (one 910 KB); none
TTL-reaped → orphaned-park residue. `discarded-landings-2026-09-24/25/26` gaps all still OPEN; none after 09-26;
0 "RESUMING parked landing" / 0 "verified patch parked" in node-1 dev-vessel journal for the last 24 h.

## 8. Stray substrate-authored files (codebase-bloat-fossils)

Entries 163-168, 170-173 were all added by super-repo commit **4e4170a8 (2026-09-07 04:20, author "Substrate
Autonomous", "Automated commit: vessel code drift detected and committed.")** — 2,134 files, +59,401 lines, a
drift-committer sweeping every untracked file in the super-repo (incl. `{{target_path}}`, `{{unitFilePath}}`,
`e.g`, `elements.html` 3,270 lines, `all_gaps.json`, compose-slots, interactor logs). They are drafter
by-products of an `httpResponse` resolver gap (route-edit-9077062c): hand-rolled patch JSONs and tsc outputs
(.js/.d.ts/.map) that import `../repos/development-vessel/src/...` from inside openspec/changes. The real resolver
exists at `repos/development-vessel/src/resolvers/http-response.ts`. 51 such loose .ts/.js/.json/.map files sit at
the top level of openspec/changes. Surviving files from that commit by directory (full-path check): validation/
failure-modes 1,120, validation/scripts 208, scripts/substrate 149, packages/interaction-conformance 140,
repos/human-surface-vessel 135 (plain-file vessel), openspec/changes 79, validation/workspaces 72, packages/
vessel-discovery-client 68 (not all are junk — the commit also captured legitimate untracked files, which is its
own defect: it hides WHICH were intended). `scripts/substrate/compose-teacher.ts:364` records a file "truncated
mid-expression by an automated 'vessel code drift detected and committed'". CHECKINS 09-28 14:50: user approved
holding the drift-commit family (rhythm-self-maintenance budget:2 hold) and cleaning 9d839e0 — i.e. the class
recurred after 09-07. unified-install 5.6 claims root scratch deleted + placement hook installed in push clones;
rejected-commit check pending.

---

## Cross-cutting observations (for the realignment)

1. **Green-but-not-green is the repeating hat in this shard**: install-acceptance green with usable=fail ×29+;
   weekly harness failing silently 20/20; tasks ticked [x] whose falsifier is "pending"; tasks landed but left [ ]
   (2.8, 3.5, 5.2); a working-tree edit unticking 30+ install tasks. Status in tasks.md is not a reliable state
   carrier; the run artefacts are.
2. **Detectors built without a reader**: install-acceptance→hub (empty secret), discardedLandingReport gaps never
   closed/acted on, stratified harness (no key), gap-lifecycle-scan landability predictions nobody reads,
   gap-landability-model.ts imported by nothing.
3. **Node locality keeps reappearing**: pause on node 1 absent on node 2; spend read from one node; category
   calibration sealed on node 2 only; gap-class-posteriors.json still node-local; spend-rate breaker counts
   in-process and resets on restart; second gap store at /workspace/gaps.
4. **Non-terminating dispatch** produced: silent revert (98bc2b5 over afc7d6d), double apply (194df79), duplicate
   probe (7eae3a0), false failed verdict (ec38999d), resume cutover reverting a0ff3d3 (6ab8271). Root cause found:
   Bun default fetch idle timeout (fixed 1942eaf) + no latch (f9001e9).
5. **Repeated-goal waste is contained, not learned**: 3.4 negative facts never built; breaker refused one hash
   629× on node 1.
6. **Value-per-cost's core (5.3 score = p/E[cost], 5.4 calibrated landability, 5.1 cost posteriors) is unbuilt**;
   what shipped is measurement (phase 1), admission gates (phase 2), termination (3.1-3.3), and budget (phase 4).
7. **Supply bottleneck**: 97% of open gaps not actionable as filed; live admission 0/863 on both nodes.

---

## Addendum: unified-install evidence/prior-audit-ledger.md (read in full) and design.md Decisions 6/7

Ledger (09-22, HEAD 9f7ed3ec): 55 setup defects — 22 H / 14 P / 17 N / 2 R; latency bimodal (~1 day from the audit
that forced a fix, ~11 days from first detection; oldest open since 08-09); none verified off-host/pulled image.
Every prior audit ran on one host, rootless Podman, image local, ~/.metabob + gh token ambient, own drivers
(auditlib.py); commit 37b18ec0 "align setup/teardown instructions with audited behavior" edited docs TO the harness
and added a false README claim ("serves out-of-box", row 55 R). Recurred ≥3 audits: invisible crash loop (5 audits,
up to 1,404 restarts, zero gaps); "healthy while joined to nothing" (6 audits, each fix gating a different signal);
human-surface unreachable (7 audits — HOST=127.0.0.1 pin never removed); port/knob lists re-declared per lane (5);
declared knob reaches nothing (5; row 45 R — fix only in another session's uncommitted gen-env); durable membership
across recreate (4, 33 days); dev-seed 401 race (4; fix uncommitted, row 40); ambient credentials (3); image
provenance (3; row 17 N); metric-collector outside inventory (3; row 30 N). ~200 junk files at repo root (row 51 N).
Class totals: lane-drift 9 (2/3/4/0), fail-open 8 (5/1/2/0), silent discard 7 (5/1/0/1), doc-code drift 7 (1/2/3/1),
fix-outside-artifact 4, federation liveness 3 (0/3/0/0), boot ordering 3.
Decision 7: a setup defect closes only when the acceptance run passes on a pulled image containing the fix — by that
rule NO install task in this change is closed (usable never passed).
