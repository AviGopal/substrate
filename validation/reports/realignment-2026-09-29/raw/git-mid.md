# git-mid: obsidian-vessel, workbench, ias-executor-ts, boredom-vessel, concept-db

Source: git history. Live hub clones (`substrate-live:/workspace/git/vessels/<v>`) for ias-executor-ts (218 commits, HEAD 700ceff 09-28), boredom-vessel (134, HEAD 12bb26a 09-28), concept-db (122, HEAD d844020 09-28), obsidian-vessel (371, HEAD 1bd0226 08-22). workbench has no live clone, so the host `repos/workbench` was used (213, HEAD e045a2d 05-24). Node 2 (compose2-live) HEADs match the hub for all four. Host submodules lag behind: ias 25150c9, boredom 36954f2, concept-db 9e2c8a8.

Authorship (commits):
| repo | operator (DevBob/Devbob/avi) | Substrate Autonomous | last operator | last autonomous |
|---|---|---|---|---|
| boredom-vessel | 42 | 92 | 09-05 | 09-28 |
| concept-db | 79 | 43 | 09-28 | 09-28 |
| ias-executor-ts | 152 | 66 | 09-17 | 09-28 |
| obsidian-vessel | 177 | 194 (187 of them in July) | 08-22 | 08-08 |
| workbench | 213 | 0 | 05-24 | none |

Method: I read every operator commit subject. I read the bodies of about 45 key commits. For all autonomous commits I took numstat (files and +/-), and I read the diffs of about 30. Pickaxe searches (`-S`) covered gaps.json, body.gaps, edit_site, posterior, EXECUTABLE_RESOLVERS, resolve_endpoint, spendEnvelope, confabulat, interpolateBoundValues and concept-relevance-backfill-v2. I compared ancestry and gitlinks against the super-repo. I checked the live systemd units and timers for these vessels, and I ran one Bun resolution test on the host.

---

## Problem classes

### write-read-mismatch
- **The boredom gap-store read was wrong 4 times, each time "fixed".**
  - 06-24, 0b76b4f: C9 selection reads `/workspace/gaps.json`.
  - 07-21, cfe1cd3: the real path is `/workspace/gaps/gaps.json`, and gap-driven selection had been "silently dead (576KB of open gaps ignored)".
  - Same day, f12e865: "path fix alone read nothing". The store is a flat array and the reader expected `parsed.gaps`.
  - 07-17, 312146d / bd8aab3: the resolve envelope is `body.gaps`, a different reader in goal-generation.ts.
  - 08-09, 02b0d24: `/workspace/gaps/gaps.json` was a copy frozen 08-08, so the fix follows WORKSPACE_ROOT.
  - Memory (09-22) then found a unit WORKSPACE_ROOT vs env-file conflict for memory.
  - Same class each time, a different hat each time. Outcome: each fix worked locally, and the class recurred.
- **The argument chain for replayable compositions (ias-executor-ts, 08-16..08-17) was declared closed across 4 layers and was inert end-to-end.**
  - a56fe27: ribosome mints with input_shapes:[], so all 16 learned templates sit at alpha=1.00.
  - 3b95072: record resolvedConfig.
  - 5a5aa41: record it at every push site.
  - 9518d4e: "a FIFTH layer … the sink builds payload key by key … dropped one function later". The commit body says "fourth time today this exact shape has appeared, and the second time inside my own fix".
  - 5030377: the prompt skeleton literally says `"config":{}`.
  - f71bb56: the fix told the model to copy `resolvedConfig`, but the payload carries `config`, so the write-key/read-key mismatch was "reproduced in prose, inside the fix for it".
  - An earlier attempt, 0bbd488 (07-31), had already "hardened DERIVATION RULE 7 … never emit config:{}". Outcome: partial, and it recurred 3 times.
- **Dead LLM unwrap, shape-name mismatch.** The guard is `shape === "llm_completion_result"` but the producer returns `llmTextCompletion`. It was fixed in goal-host's proxy (b164b73), then again in ias vessel-resolver (2a12397, 08-06, "second executor"). The envelope JSON was written into ribosome-vessel/src/index.ts and into 7 proposal files. Duplicate code paths meant a duplicate bug.
- **Trace sink discarded the failure reason at the wire boundary, three times.**
  - dc4c4e5 (05-21): "strip non-canonical failure_mode at wire boundary", which introduced the loss.
  - acfd5c0 (08-22): "stop destroying the failure reason … 98% of failures were an information-free label". The premise (a closed FailureModeSchema) was false, because the schema was applied on no route.
  - 700ceff (09-28, autonomous): again adds `reach_reason` as the reason when failureMode is absent.
- **Walk read outputs from a store that had just been cleared.** 8676beb (08-21): `evictExecutionScope` cleared impulses before goal-host read them back, so stubs were pooled as data and the reach judge graded stubs.
- **Ribosome dedup/ids.** fdcd0ec (06-25): deterministic learned-template id. 140d1fa: synthesize sets top-level output_shapes. Both are part of the same write/read-shape class.
- **concept-db clobbered activity-api's shared `impulse` table.** 9b5c087 (07-23): concept-db's 003-impulse-table.surql did a bare DEFINE TABLE on the shared DB. That stripped tenant PERMISSIONS on every crash-loop cycle.

### memory-recall (concept-db search, the substrate's recall plane)
Lexical recall has broken 5+ times, each fix proclaimed:
- 04-28: db765b0, 4325538, f4901a6, dec74f6 (SurrealDB 3 BM25 `@@` compatibility, 4 commits) and 2c6488a (TF proxy when IDF=0).
- 08-10, 7df39d2: `@@` is AND over every term, so any real query matched NOTHING.
- 08-16, a4e353d: the ladder's last rung dropped the subject term, so seeded facts were unreachable.
- 09-02, fd645bd: two-stage FTS for performance (7.07s → 0.83s). This **broke lexical search entirely.** The placeholder appears twice and `.replace` substitutes only the first.
- The breakage was undetected for 24 days, until 278edae (09-26, autonomous): "lexical-search-has-returned-nothing-since-09-02-so-every-recall-is-dense-only", fixed with `.split().join()`.
- Also cb400d6 (09-02): /health stayed green through a total search outage. 945a667 (08-30): every other concept write returned 400 on a retryable conflict, so half of all compose-lesson writes were lost silently.
- Outcome: the latest fix worked. The class (a recall path with no end-to-end positive control) has had no durable detector.

### directed-overshoot (operator fix that regressed)
- fd645bd (09-02, operator perf) killed lexical search for 24 days (above). The commit body quoted "grep the sibling call sites", but no reach check ran on the recall result.
- dc4c4e5 (05-21) destroyed failure reasons until 08-22.
- c606ab5 (07-17, operator) accidentally staged the deletion of src/goal-generation.ts. It was reverted by 2113314, then re-applied by 2b9e23a ("restore full index.ts … on the correct base").
- c0e42fa3 (super-repo, 08-09) was titled "bump five stale pointers that were silently reverting live fixes", but it moved obsidian-vessel **backwards**, from 3364d47 to aa4ae90 (3364d47 is the later commit). This was corrected later by 0d238a73 / 2c9de115.
- 4f2f45d (08-01) "Fix file watcher" shipped a sidecar-less dev main.js, restored by de49d80.

### autonomous-regression
- **concept-db ping-pong, 09-28.** e059a98 (04:08, gap `failing-test-concept-db-tests-concept-test-ts`) adds `.min(1)` to schemas.ts. c8c944f (04:12, gap `route-edit-3e5be0a9`) byte-reverts it 4 minutes later. Two gaps own opposite edits of one file.
- **concept-db test-appeasing edit.** af2c737 (09-28 02:47, "failing-test" lane) lowered resolve_timeout_ms from 30000 to 10000 to satisfy a stale test. The comment beside the field explains why 30s is needed. The operator reverted it in d4eee29 (03:15), and filed the gap "atomic multi-file changes", because the lane lands one file per compose.
- **concept-db /health env-gate flip-flop.** `pwt-concept-db-index.ts-*` gaps:
  - 071088f (08-15): `enabled` gated on `DENSE_BACKFILL_ENABLED`.
  - 120d9d1 (08-18): reverted.
  - acb7a5a (08-18): gated again.
  - Three landings oscillating, and all of them are law-1 env gating.
- **boredom 84cd2f2 (09-19), "feat: Update boredom-vessel content".** An autonomous commit outside the mitosis path (unique subject fleet-wide). It committed 24 compiled artifacts (`src/*.js`, `*.d.ts`, `*.map`, index.js 4080 lines), and it **broke index.ts syntax** by inserting a string literal outside the `AUTONOMOUS_GOALS` array. 36954f2 (09-20 01:21, autonomous) repaired the syntax. The compiled files are **still tracked** in HEAD. They are inert only because Bun resolves `.ts` before `.js` (verified on the host).
- **boredom c7fb5a6 → 1bf4fee (07-31, 28 minutes apart).** An autonomous landing re-enabled minting "Author a producer resolver for shape X" goals for confabulated capability gaps, which operator 5bd047b (07-29) had deliberately disabled. The pwt mitosis reverted it. 7868111 (08-06) then found the same family escaping by category laundering (121 of 174 gaps).
- **ias 946034c (09-15, autonomous).** Interpolates `{{x}}` in non-LLM task configs at template-*load* time against raw task fields, with `?? ''`. That blanked every placeholder, so chained templates fail. Follow-ups are listed under hollow-landing.
- **obsidian-vessel 08-07: 5 reverts of autonomous UI landings in one day.**
  - 1812ee7: ad706ce edited the wrong region and wrapped text in literal `<b>` inside `createDiv({text})`.
  - b1d2417: d90318f replaced the elapsed time with '0s' instead of freezing it.
  - 78c675d, 0022455, 4de7dba: mitosis follow-ups.
  - The semantic gate approved all of them.

### hollow-landing
- **obsidian-vessel.** 0 of 194 autonomous commits touch main.js; 127 operator commits do. "Obsidian loads a BUILT main.js; the TS source is never read at runtime" (aa4ae90, 08-07). So **no substrate-authored UI change reached the running panel** until an operator rebuilt it. The host-pull-sync rebuild timer had "vanished" (08-07). The last autonomous commit (3364d47, 08-08) postdates the last rebuild, so it never shipped. The substrate cannot rebuild its own human surface.
- **boredom 314f228 (09-06).** Implemented "decline dispatch on a negative posterior" but matched `t.identifier` (0/100 rows have it) against a route capped at 100 of 2670 rows. It typechecked, passed the semantic gate, and reached origin/dev, but could never fire. It was replaced by operator 4e17f86 (09-05 author date), and the control matrix showed the scaffold arm at 6 successes vs 8598 beta.
- **ias discovery-adapter a065d22 (09-18 03:17).** Added `resolveVesselEndpoint`, which is **never called** (grep: defined only, line 31). 25150c9 (06:12, `gap-mu6dazag-narrowed`) then edited that dead helper *after* operator d1ebb66 had already closed the gap by hand ("OPERATOR-AUTHORED after five substrate attempts: two syntax breaks, one validation-that-throws, one anchor miss against a reverted tree, one dead-code helper landed by a racing autonomous compose").
- **ias template-provider "blanks every placeholder" series.** 2893a93 (09-24 05:30), 0685c69 (09-24 08:52, recommit-recommit … semantic_reject-anchor_not_found), fef2f14 (09-28 09:54, narrowed). Each **layers another interpolation copy**. HEAD now has `interpolateBoundValues` defined 3 times: a module-level identity stub inserted between imports (from 367e2ce/76ec135, 09-15), a nested function (line 237), a const (line 298), plus an IIFE (line ~324). The last copy reintroduces `?? ""` blanking. None removes the conceptually wrong load-time interpolation.
- **ias trace-sink "spool never replayed" series.** 29b2f70 (09-23, recommit after syntax_break), 7d2c5ab (09-26 narrowed, +111), c8a354b (09-28, adds `_quarantineFile2`, a numbered duplicate), e439193 (09-28, comments out `iv.unref()` so the replay timer keeps the process alive). That is 4 landings on one gap. The batch size is env-gated: `IAS_TRACE_SPOOL_DRAIN_BATCH`.
- **ias a07e8fd (07-03).** An autonomous edit to fossil `src/examples/branch-health.ts` and `ship-change-vessel.ts`.

### narrowing-duplicates
- **concept-db advertised-shape list.** 9d7d715 (09-01, recommit-…-13fbb880-verify_failed), 84cad4f (09-01, 6577f638-narrowed), 1b7fe81 (09-01, recommit-…-6577f638), 9e2c8a8 (09-11, 13fbb880-narrowed) all appended the same shapes. HEAD config.ts lists `concept_write`, `concept_create_write`, `conceptCreditDecontaminate_write`, `concept_delete_write`, `concept_retire_write` and `concept_supersede_write` **twice each**, and three are simultaneously public and marked `@shape-dispatch:private`.
- Subject counts: boredom 7 recommit / 2 narrowed / 12 unknown-proposal; ias 3 / 3 / 7; concept-db 2 / 2 / 6; obsidian 1 / 2 / 22. Names like `recommit-recommit-route-edit-a1c65f94-anchor_not_found-anchor_not_found` (boredom 24faf71, 07-24) show retry chains accreting in the id.
- 6de8e4f (08-02): goal text accreted `Close substrate gap <id>:` prefixes on each narrowing hop (11 doubled prefixes in 3h). `sanitizeGoalText` "existed but was never committed" (it sat in a working tree).
- ias-executor 2-3 landings per gap: template-provider (3), trace-sink spool (4), discovery-adapter (2 after the operator close).

### false-verification
- The semantic gate certifies "changes the named behaviour", not "does what was asked" (obsidian b1d2417 / 1812ee7 bodies, 08-07). This applied to 314f228 as well.
- **Failing-test lane edits code to match stale tests.** af2c737 (timeout), e059a98 (schemas). And d844020 (09-28) edits the *test* fake store to add INSERT handlers, a test change to make a test pass.
- **boredom arm grading.**
  - 07-17, fb2e5f0: the POST 202 was graded as success, so arms wireheaded to mean=1.00. 80 of 106 reservations went to two self-picking arms.
  - 08-06, 59ac3cf: a 180s deadline graded 26.3% of outcomes before they existed, so 98% of selection went to idle ticks (reward 0.2 vs drafting 0).
  - Both are "the grader measures the wrong event". The same class was fixed twice in 3 weeks.
- **c6d3109 (08-28).** The dormancy predicate `picks < 1` could only return 0 because two guards dropped zero-pick rows, making it a tautology.
- **cb400d6.** Liveness /health green through a capability outage.

### gap-content
- 968d693 (obsidian, 08-07): 0% of ui_legibility gaps carried edit_site (42% overall), so every interface complaint was unroutable. 47da778 (boredom, 08-07) carries edit site and region into the goal text. b883e94 admits by structured category, not prose keywords.
- 12bb26a (boredom 09-28, autonomous): gaps without an edit site now emit "investigate and decompose gap <id>" instead of "Close substrate gap". This is the right direction, and it came from the substrate.
- 7868111: the gap premise was false for 119 of 121 gaps (the producer already exists). Confabulated gap families are still re-dispatched.

### selection-learning
- 008ae03 (06-22): a NaN score pinned the selector on mitosis-tick no_op, which starved all self-optimization.
- c606ab5 (07-17): the candidate set was frozen at the 100 oldest templates (the activity-api page cap), so no template minted after 07-12 could be selected. The same page cap defeated 314f228 (09-06). So the 100-row cap bit twice in 2 months.
- a56fe27: all 16 learned compositions sat at alpha=1.00, "never credited, only blamed".
- 4e17f86: a scaffold template ran 2320 times at a 0.07% success rate, because the hardcoded id dispatch bypassed Thompson.
- aea0e85 / fb2e5f0 / 59ac3cf / 0ccfadf: grading and cooldown repairs to the gap-goal arms.
- 625f596 cold-start damping. cc0ab2d entropy injection.

### composition-crystallization
- The ribosome chain (above): 0bbd488, a56fe27, 3b95072, 5a5aa41, 9518d4e, 5030377, f71bb56, plus 07-14 prompt/gate fixes (9e1747d "eligibility gate fails open", f174656, 26ce11f, beb9ea6, b203e5a).
- The "template provider blanks placeholders" regression (946034c → 3 layered fixes) directly kills chained templates. As of HEAD the load-time interpolation remains.

### endpoint-routing
- d1ebb66 (09-17, operator): the discovery-adapter passed `resolve_endpoint` verbatim, so bare paths and libp2p rows gave "fetch() URL is invalid" on spokes. Five substrate attempts failed first.
- f28bc06 (boredom, 09-27, autonomous) **re-implements the same join** (`/^https?:/ ? re : endpoint+re`) inline in a new `boredomDiscoverResolveUrls`. That is a third copy of the resolve-URL joiner (goal-host routeFor, ias discovery-adapter, boredom), consistent with memory's 09-22 "joiner overshot at 5 call sites".
- obsidian sidecar: 07-11..07-30 there were roughly 25 commits on loopback, overlay, host-remap and ingress-pin routing (dc86e4b, 577892d, efae67a, 0da7490, 803ed65, ff49722, …).

### spend-envelope-throughput
- f28bc06 (09-27): boredom duplicates development-vessel's `spendEnvelopeAllows` (the comment says "obeys the same fleet-wide envelope as development-vessel's auto-pick") as about 85 lines of local code, rather than resolving one shared decision shape. It is a duplicate mechanism, so there are now two envelope readers that can drift.

### test-residue-live-state
- fdc9100 (ias, 08-21): the test suite wrote into the LIVE trace-retry spool (`IAS_TRACE_SPOOL_DIR` default `/workspace/trace-spool`). 81 of 83 spool files were `exec_test_1` debris, and real traces fell to ranks 64 and 73 behind `slice(0,25)`.
- d844020 (concept-db, 09-28): the autonomous lane edits a test fake-store. It is not residue, but tests are now a landing target of the autonomous lane.

### trace-store-db
- 09c32a0 (06-17): bounded retry on trace POST. 3cf29a3 (09-26): "the shared trace sink aborts at 15s and retries writes the server has already committed". The retry mechanism created duplicate writes, and the fix is timeout 120s plus an Idempotency-Key.
- 945a667: SurrealDB retryable conflicts. c404069 / 62cbf1e / 5419115: full scans (66K rows) and KNN OOM. 8971f0a: root token expiry.

### sync-deploy-drift
- **obsidian bundle.** 42 "rebuild main.js" operator commits. Deploy is manual, and the host-pull-sync timer vanished (aa4ae90).
- **312146d (07-17).** "the git landing did not follow the live cutover". The substrate cutover-deployed a fix that was absent from git.
- **6de8e4f.** The function lived only in a working tree.
- **c0e42fa3.** pull-sync's `git submodule update` reset submodules to stale pins, racing deploys. It "reported success and a grep returned 0".
- **ias 0dcf370 / 58c5638 (07-15).** A substrate:deploy hook and restart ordering. b6b58a2 (05-27): verify-dist-fresh (F-111) for dist drift. That mechanism's name has 0 external references now.

### env-gating
- concept-db `DENSE_BACKFILL_ENABLED` flip-flop (above).
- ias `IAS_TRACE_SPOOL_DRAIN_BATCH` and `IAS_TRACE_SPOOL_DIR`, 706674e "8s default resolve timeout, tunable via env", f685b16 "agent_fill (gated, default off)", 3ca8223 VESSEL_PUBLIC_ENDPOINT.
- boredom 7fc0eb1 "PR target via env".
- boredom 92f3336 (08-06, autonomous) documented that `EXECUTABLE_RESOLVERS` (an in-process constant) had disqualified all 214 proposals: 45 blocked resolvers, 94 idle cycles. It turned the constant into a seed unioned from discovery, a law-1 repair made by the substrate.

### human-surface-escalation
- Three generations of the human surface, each abandoned:
  - workbench (React app, 04-22..05-24, 213 commits, operator-only, not deployed).
  - obsidian-vessel panel (06-15..08-22, 371 commits).
  - human-surface-vessel (September, per memory not a submodule, so it is unauthorable).
- The obsidian-intake, obsidian-learn and obsidian-collaborate timers are **still enabled** in substrate-live. Every tick logs "SKIPPED: no vessel advertises obsidian:note — the human surface is not connected". These are dormant loops that read as passes, and they are timer-driven (law 5).

### dormant-mechanism / codebase-bloat-fossils
- **ias-executor-ts `src/examples/`**: vessel-forge-host, branch-health, ship-change-vessel, goal-host-demo, lifecycle-subscriber-demo, bun-host. Phase 22 forge resolvers: docker-build-push, helmfile-sync, scaffold-vessel-skeleton, wire-auth-blueprint, wire-discovery-registration, verify-three-invariants. Also DockerPort / HelmfilePort. External references: VesselForgeHost 0, HelmfilePort 0, agent_fill 0, verify-dist-fresh 0. This is the Kubernetes/Helm-era vocabulary in a single-container world.
- **boredom** has 24 compiled files in src/ (84cd2f2), and `vesselAdditionScaffoldDispatch` (78ea364, 07-08 adhoc) drives a template at 0.07% success.
- **workbench** is a whole-repo fossil. It still has a submodule gitlink and doc references (docs/LIVE_DEVELOPMENT.md, docs/README.md).
- **obsidian-vessel** is a fossil for autonomous development: development stopped 08-22, and 0 of its autonomous edits ever shipped unaided. Its sidecar/libp2p work (07-02..07-30) is the federation client layer, now superseded.
- The boredom `AUTONOMOUS_GOALS` hardcoded rotation (goal[46..49] added 06-19) is a static list rather than condition-driven selection (law 5). It persists and was edited as recently as 09-19 / 09-20.
- The boredom `0ccfadf` MIRROR of dev-vessel's admission gate is a declared duplicate with a TODO to delete it once a shape exists. f28bc06 repeats the pattern for the spend envelope.

### goal-walk-floor
- 02eae45 (08-09): a recommended template that does not exist killed the dispatch.
- 9f6813c: a degraded read is treated as information-absence.
- 8602362: the producer pick falls back to first-match.
- bf5c691: loaded:false inputs were dropped silently (law 8).
- 3c7808a / a4c58bc: pinning a target bypasses selection, not the evidence.

### federation-p2p
- obsidian 4ae5ba0 (07-02) managed libp2p sidecar, then about 30 follow-ups (relay circuit re-derive 480ac50, register with every namespace 872ba4c, overlay-or-fail 577892d, failover efae67a). d1ebb66 was needed because engine-level calls failed only on spokes.

---

## Mechanisms (status)
- **mitosis cutover landing lane** (`apply_proposal_as_patch` + `vessel_mitosis_cutover`). General, shared seam. Live and used: 395 autonomous commits across these 4 repos, 09-28 activity. Defects: one file per compose (d4eee29); ping-pong across gaps (e059a98/c8c944f); layering instead of replacing (template-provider, trace-sink).
- **pwt-* post-write mitosis** (gap ids `pwt-<vessel>-<file>`). Live-used. It both reverts bad landings (1bf4fee) and oscillates (concept-db /health ×3).
- **semantic gate (addresses:true)**. Live, false-positive (obsidian 08-07, 314f228).
- **failing-test lane** (gap ids `failing-test-<vessel>-tests-*`, new around 09-28). Live. It edits code or tests to agree, including against documented intent (af2c737).
- **trace-sink retry + disk spool + replay** (ias). Specific path, live. Duplicated by repeated landings (`_quarantineFile2`) and env-gated.
- **ribosome extraction** (ias templates/lifecycle/ribosome-extract.json + synthesize). General. Its chain has been repaired about 10 times. Whether it compounds is unverified here.
- **boredom gap-goal supply** (`generateGapGoalCandidates`). Live. Its gap-store readers have been re-fixed 4 times.
- **boredom spend envelope** (f28bc06). A duplicate of the dev-vessel envelope, live.
- **boredom admission MIRROR** (0ccfadf). A duplicate by declaration.
- **boredom posterior decline guard** (4e17f86). Live, specific to one template. 314f228 is a fossil.
- **boredom EXECUTABLE_RESOLVERS seed + discovery union** (92f3336). Live, a law-1 repair.
- **boredom AUTONOMOUS_GOALS static rotation**. Live, a law-5 fossil.
- **boredom selector-state snapshot** (00c1965, c6d3109). Live.
- **concept-db lexical ladder + two-stage FTS + dense leg** (7df39d2, a4e353d, fd645bd, 278edae, c9f083e, dee1f90). General recall seam, live. Broken 09-02..09-26 with no alarm.
- **concept-db search telemetry** (cb400d6). Live. It did not catch the 09-02 break.
- **concept-db shape-dispatch agreement check** (995fee1, 568b668, 05-17). Live. It coexists with duplicated public/private shape entries in config.ts.
- **ias discovery-adapter URL construction** (d1ebb66). Live. `resolveVesselEndpoint` is dead code. Duplicates exist in goal-host routeFor and in boredom f28bc06.
- **ias forge / examples / Helm ports**. Fossil.
- **ias verify-dist-fresh (F-111)**. Fossil or unknown: 0 external references.
- **ias agent_fill**. Dormant: env-gated, default off.
- **obsidian panel bundle** (main.js). Specific. Deploy is operator-only, so autonomous edits are hollow.
- **obsidian-intake/learn/collaborate timers**. Dormant, skipping every tick.
- **workbench**. Fossil repo.

## Principles found in commit bodies
- "An EXPLICIT PROJECTION is a silent dropper by construction … nothing about the type system can see it" (ias 9518d4e).
- "An instruction naming a field that does not exist is worse than no instruction" (ias f71bb56).
- "A prohibition alone has a poor record here; showing the correct output beside the incorrect one is the form that has worked" (ias 5030377).
- "The category was never evidence. Predicate on the claim itself" (boredom 7868111).
- "Behaviour gated behind an in-process constant … a resolver that is never attempted can never be found wanting" (boredom 92f3336, autonomous).
- "The judge verified that the patch CHANGES the behaviour the gap names. It never asked whether the new behaviour is what the complaint wanted" (obsidian b1d2417).
- "A wrong edit_site … aim[s] the drafter confidently at the wrong file, which is strictly worse than saying nothing" (obsidian 968d693).
- "Proceeds on absence of evidence … so an unmeasured template stays reachable" and "run the lookup against live data rather than trusting a clean typecheck" (boredom 4e17f86).
- "A liveness ping reported healthy through a total outage of the capability" (concept-db cb400d6).
- "When you fix a bug class, grep the sibling call sites" (concept-db fd645bd). The same commit then broke the lexical leg, so the principle was necessary but not sufficient.
- "Obsidian loads a BUILT main.js; the TS source is never read at runtime" (obsidian aa4ae90). Landing is not deploying.
- "concept-db is a CONSUMER of impulse, not its owner" (9b5c087). Schema ownership in a shared DB.
- "The grader measures the wrong event" is recurrent (fb2e5f0, 59ac3cf, c6d3109).
