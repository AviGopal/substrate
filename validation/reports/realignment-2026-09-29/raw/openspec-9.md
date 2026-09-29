# openspec-9 — entries 145-162 (round 2)

Source listing: `(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#') | sed -n '145,162p'` (179 entries total).

## 0. Scope note — the index range does not contain the named plans

The task text says 145-162 "include the MOST RECENT active plans (contained-self-development, decentralized-compose-ownership, value-per-cost-selection, …)". It does not. With `ls` ordering, entries 145-162 are:

| # | entry | kind |
|---|---|---|
| 145 | httpResponse.js.map | tsc emit of a stray draft |
| 146-150 | http-response-resolver.{d.ts,d.ts.map,js,js.map,ts} | stray draft + tsc emit |
| 151 | httpResponse.ts | stray draft |
| 152-156 | http-response-types.{d.ts,d.ts.map,js,js.map,ts} | stray draft + tsc emit |
| 157 | **human-surface-stack/** | the only real openspec change in range (9 files, 125 KB) |
| 158 | impulses-patch.json | stray edit-op JSON |
| 159-162 | new-http-response-resolver.{d.ts,d.ts.map,js,js.map} | tsc emit of a stray draft |

The named plans sit at: 108-115 (08-26..09-24 dated dirs), 121 causal-attempt-ledger, 123 consumer-side-landing-probes, 124 contained-self-development, 125 decentralized-compose-ownership, 128 do-anything-surface, 169 obsidian-legibility-surface, 174 unified-install-interface, 175 value-per-cost-selection, 176-179 archive. They belong to adjacent shards. I read my literal range in full and did only a **status-only pass** (section 4) on the named plans so the orchestrator can reconcile. I did NOT read the named plans' proposal/design/tasks in full.

---

## 1. The stray http-response files (145-156, 158-162) — codebase-bloat-fossils

### Provenance chain (the claim and what happened to it)

1. **2026-08-16** — the substrate drafted a "generic http response resolver" into `openspec/changes/` in three separate sessions (16:10, 16:41, 17:18), because the advertised `httpResponse` shape was a scaffold that ignored the URL and fetched `https://httpbin.org/status/404`. Law 3 (compose before mint) + a lying producer = repeated re-minting.
2. **2026-08-16, `5be029a` (development-vessel, operator DevBob)** — real fix: `repos/development-vessel/src/resolvers/http-response.ts` delegates to the trust-gated `web_resource` resolver, no default URL. Still live: `src/routes/impulses.ts:68,406` import and dispatch `resolveHttpResponse`. Its header comment records: "twelve orphaned files, **none landed**".
3. **2026-09-07, super-repo `4e4170a8` "Automated commit: vessel code drift detected and committed." (Substrate Autonomous)** — 2134 files, +59,401 lines, swept the orphans (and much else) into git: the whole `openspec/changes/*http-response*`/`*goal-summary*` family, `neptune_moons.txt` (353 lines), `elements.html` (3270 lines), `{{target_path}}`, `{{unitFilePath}}`, `{{dirPath}}/…`, `{{out_path}}`, `memory_note.md`, `memory_note_post-restart-2c340d.txt`, `improvement_plan.txt`, `history.txt`, `data.json`, `data.txt`, `e.g`, `all_gaps.json` (empty), `compose-slots/slot-0.slot`, `interactor-log/*.jsonl` (runtime state), `load-attribution/records.jsonl`, `ingest-audit-findings.patch`, `test_http_response.ts`, `resolver-httpresponse.js`, **and a root `tsconfig.json`** (a `tsc --init` template) that the operator had deliberately deleted on 2026-04-30 (`1c626d6d` "drop vestigial Bun-project scaffolding from root"). Top-level distribution: 1426 validation, 236 packages, 186 repos, 157 scripts, 79 openspec.
4. **2026-09-19, super-repo `796fac89` "vessel-code-commit-and-push cpg-inference-ts" (Substrate Autonomous)** — 412 files, +16,104: added `"rootDir": "./src", "outDir": "./dist"` to the root tsconfig (no `./src` exists at root) and committed the **tsc emit** of every stray `.ts`: `.js/.d.ts/.js.map/.d.ts.map` next to sources in validation (158), scripts (72), openspec (40), packages; plus probe residue `learning_loop_selftest_probe.txt`, `learning_loop_test.txt`, `my_probe.txt`, `test_probe.txt`, `known_answer.txt`, `generated-goals.json`, `generate_report.js` (6234 lines), `tmp_project-thread-scan.*`, `test-selftest.*`, `Substrate/Projects/temp_test_open_todo.md`, and a `{{dirPath}}/src/routes/impulses.js` tree. Note the commit message names a *vessel* (cpg-inference-ts) while the commit is in the super-repo.
5. **Now (2026-09-28)** — 823 tracked `.js/.d.ts/.map` files outside `repos/`, of which **615 are `.d.ts`/`.js.map`/`.d.ts.map` (unambiguous emit)** and 208 are `.js`, **177 of those `.js` having a same-named `.ts` sibling** (almost certainly emit; 31 `.js` without a sibling need audit — may be real sources). `packages/interaction-conformance`: 142 of 181 tracked files are emit-type (log shows only `f6afc6ca` 08-07 and drift commit `4e4170a8` 09-07). Earlier raw breakdown by directory (validation/scripts 220, scripts/substrate 192, packages/interaction-conformance 142, validation/workspaces 72, packages/vessel-discovery-client 68, openspec/changes 60, …). The root `tsconfig.json` is still present. "None landed" became "landed as residue, twice".
6. **Same family recurs:** development-vessel `9d839e0` (2026-09-28 11:26, Substrate Autonomous, "sync vessel code") committed `.bun/install/cache/*.pile` binaries. Report `46a6b047` (09-28 14:50) says "9d839e0 residue cleaned" — that cleanup addressed the bun-cache instance only; the 09-07/09-19 super-repo instances (tsconfig + 823 emitted files + ~60 openspec strays) are untouched. Three instances of one class (drift-commit sweeps untracked residue into git) in 21 days, each handled as a new residue.

### What each stray in range is

- `httpResponse.ts` — standalone fetcher returning `{shape, body:{status,headers,body}}`; **no trust gate** (unrestricted egress). Imports `../resolvers/types.js`, which does not resolve from `openspec/changes/`.
- `http-response-resolver.ts` — a **drafter-edited copy of the real operator fix** (header comment verbatim from `5be029a`), mutated with `// Changed return type to HttpResponse`, `// Added status`, `// Simplified body`. Its imports (`../../repos/development-vessel/src/config.js`) do resolve from `openspec/changes/` to the super-repo root, so this one is not an invented path — but it imports `HttpResponse`/`ResolverResult` from dev-vessel `config.js` and changes the contract (status/body flat) away from the live resolver's. Not a fossil of a distinct attempt; a symptom edit on a copy (drafter-quality).
- `http-response-types.ts` — `ResolverResult`, `HttpResponsePointer` interfaces (duplicates of dev-vessel types).
- `new-http-response-resolver.ts` — another delegate-to-web_resource draft importing `../repos/development-vessel/src/config/types.js` (a path that does not exist; dev-vessel has `src/config.ts`).
- `impulses-patch.json` — an edit-op `{old_string:"case \"http_response\":", new_string:"case \"httpResponse\":", path:/workspace/git/super-repo/repos/development-vessel/src/routes/impulses.ts}` — an edit plan emitted as a file instead of applied through feature_compose.
- `*.js/*.d.ts/*.map` — tsc output of the above (mtime 09-19 16:06 for http-response-resolver.*, 09-07 for the rest), produced by the root tsconfig.

### Keep / discard

- **Keep:** nothing in the files. The class lesson is already embodied in the live `http-response.ts` header comment. The http-response story is an exemplar of "a producer that lies about its shape causes re-minting" (law 3 failure mode) — worth one concept, not twelve files.
- **Discard:** all 17 in-range strays; root `tsconfig.json`; the 615 `.d.ts`/`.map` emits and the 177 `.js` with `.ts` siblings (after confirming no reader imports a `.js` sibling — `scripts/bootstrap-seeder.js` is emitted next to bootstrap-tier `bootstrap-seeder.ts`, check the Dockerfile does not run the .js); **audit** the remaining 31 sibling-less `.js`.
- **Missing detector (law 6):** the pre-commit `ALLOWED_TOPLEVEL_DIRS` gate only checks top-level dirs; a residue file under an allowed dir (openspec/changes/*.js) passes. The drift-commit activity (`vessel-code-commit-and-push`, "vessel code drift detected and committed") commits whatever is untracked — it is the writer; nothing checks "is this file a source or an artifact/probe".

---

## 2. human-surface-stack (157) — full read

Files: `proposal.md` (7.2 KB), `design.md` (12.3 KB), `BUILD-REPORT.md` (14.5 KB), `VALIDATION-2.md` (31 KB), `VALIDATION-3.md` (19.4 KB), `federation.md` (19.6 KB), `render-learning.md` (18.7 KB), `drafts/README.md`, `drafts/d4-activity-api-by-shape.patch`. All authored 2026-08-07 by DevBob (commits `9ea845d4`, `a87480b8`, `a3697be8`, `4e38c039`, `37b9804c`, `514e7b06`, `85122e84`, `91fdbbd4`, `f9f77afb`). **No tasks.md** — the three ranked "Next" lists are the de facto task ledger. Never archived; untouched since 08-07.

### What it proposed

Replace three UI stacks (react-renderer — never ran; workbench — never ran; stateful-ui-vessel — the only running one, React from esm.sh at runtime) with one `human-surface-vessel` (Bun + Hono + Vite + React 19 + TanStack Query/Router + Tailwind 4), a shared `packages/design-tokens`, and `packages/interaction-conformance` (13 rules P1-P13, static tier + runtime probe, "proven to refuse"), with the patterns also emitted as concept-db lessons (`--emit-concepts`, one rule table, two readers). No new shapes; inherit `uiPanel_write`, `uiQuestion_write`, `uiFeedback`, `interactor*`.

Falsifiers (proposal): (1) a newcomer gets an actionable outcome without typing shape/template/path; (2) the checker fails a planted violation; (3) a substrate-authored surface edit conforms because the drafter read the patterns; (4) bundle makes zero external requests; (5) react-renderer and stateful-ui-vessel gone from tree, inventory, manifest, units.

### Falsifier status now (2026-09-28)

| # | falsifier | status | evidence |
|---|---|---|---|
| 1 | newcomer outcome | partial | VALIDATION-3: 14-goal human-flow instrument 5/14 → 3/14 (honest render judging) → 11/14 quiet fleet → deployed 7/14 → 9/14. `count` 0/2 (human_presentation nested envelope). Not re-measured after 08-07 in this doc. |
| 2 | checker refuses | met (static) | BUILD-REPORT: self-test 30/0; planted violations caught P1,P4,P5,P9,P11,P13 on real source. |
| 3 | drafter conforms via lessons | unverified | `--emit-concepts` exists; no evidence the concepts were minted into concept-db or recalled. Checker never wired into any `lint`: no `package.json` outside the package references `interaction-conformance`; `repos/human-surface-vessel/package.json` has `start/typecheck/test*`, no `lint`. |
| 4 | no external host | met 08-07 | BUILD-REPORT §4b unfiltered enumeration. |
| 5 | retirement | **FAILED** | `stateful-ui-vessel.service` loaded active running on substrate-live today; discovery lists 4 producers of `uiPanel_write`/`uiQuestion_write`: stateful-ui-vessel `127.0.0.1:8270`, human-surface-vessel `127.0.0.1:8310`, development-vessel-local `host.containers.internal:18090`, development-vessel-compose2 `:26090`. `repos/react-renderer` and `repos/workbench` still on disk (gitignored `.gitignore:207,210`, not deleted). Memory 09-22: 248 `needs-human-*` escalations posted to pinned `:8270` (the replaced vessel), 0 answered — the dual-producer state the design's "retire completely — a vessel left dark is worse than one removed, because it reads as available" warned about, realized 6 weeks later. |

### Ledger items and live verdicts

**BUILD-REPORT §7 (ranked):**
1. Fix P5/P6/P10 false positives before wiring into lint — **not done.** `packages/interaction-conformance` last commit `f6afc6ca` 2026-08-07 (plus the 09-07/09-19 drift commits adding tsc emit, 142 files). Checker never wired → dormant-mechanism.
2. Build runtime probe — **not done** (no probe in package; later human-surface tests `test:browser`, `test:form-decision`, `test:capacity` are vessel-local probes, not the conformance probe).
3. Remap loopback endpoints resolved from discovery — **done for goal-host** (VALIDATION-2 §8: loopback→discovery host with offset port; `activeDispatches` 502→200 with env unset). But `config.ts:43-44` still has `GOAL_HOST_ENDPOINT ?? "http://127.0.0.1:8210"` and `proxy.ts:420` still honors the env override first; `proxy.ts:86-89` `ACTIVITY_API_ENDPOINT ?? ACTIVITY_API_URL ?? "http://127.0.0.1:8080"`; `impulses.ts:338` `DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090"` — env-gated routing still present (endpoint-routing, env-gating).
4. File scaffold defect as gap — **defect still present.** `repos/development-vessel/src/seed/complete-vessel-scaffold.ts:213` still emits nested `resolverContract: {...}`; `systemVessel` appears nowhere in the file. Every scaffolded vessel still registers partially invisible (per the 08-07 finding).
5. Retire react-renderer/workbench — **not done** (on disk, gitignored).
6. Cut over stateful-ui-vessel — **not done** (running, serving the vocabulary in parallel).

**VALIDATION-2 §7 (10 items) with §8 resolutions (08-07):**
1. Wire box to parser — claimed fixed §8 (filmed revisions 0→1→2→2→3).
2. Make `surfaceIntent` an activity — **not done.** `activity` table (4010 rows) has no surface-intent activity; discovery: `surfaceIntent` produced only by human-surface-vessel resolver. Law-2 violation "carried knowingly" (VALIDATION-3 §7) still carried.
3. Fix 502 — claimed fixed §8 (see above).
4. Container guard `gen-env.sh` consult HUB_DISCOVERY_URL — present (`gen-env.sh:206-215`). UI-only container boot "unproven until someone runs it" (08-07); later there is a `substrate-ui` deployment on host 19310 (VALIDATION-3 "Measured against the DEPLOYED surface").
5. Close real-run secret leak in `ui-only-up.sh` — claimed fixed §8 ("pipes the real run through redact() with PIPESTATUS"). **Current file (159 lines, rewritten `e375d716` 09-23 "one launch manifest") has no `PIPESTATUS` and no `redact()` function; only the DRY_RUN printf sed-redaction at line 100.** The script structure changed so the original leak site may be gone; not verifiable as the claimed fix. (Earlier `d63d64b6` 08-21: "`make -n up` printed the operator's key" — the same leak class reappeared through another path two weeks after the 08-07 "closed".)
6. Readiness green over dead container (`substrate-ready.sh`) — §8 says still open. Current file still `… 2>/dev/null || true` on `systemctl show` (lines 126-127); not re-verified whether a container-running precondition now exists.
7. Pause button moves — claimed fixed §8.
8. Contrast `--sf-ink-3` — open at 08-07.
9. Legibility floor on impulse overrides — open at 08-07.
10. GapStrip buffer/pause — open at 08-07.

**VALIDATION-3 §5 authorability:** "Closed, up to the cutover" (08-07): feature_compose symlinks an in-tree vessel into the runtime root. Cutover hop (`vessel-mitosis-cutover`, `patch_with_tools` commit from `MITOSIS_PUSH_CLONE_DIR/<vessel>`) left open. Recurrence: memory 09-22 "AUTHORABILITY = SUBMODULE MEMBERSHIP; the live human surface is the one vessel the substrate CANNOT author" — the same finding rediscovered 6 weeks later, then "bootstrapped in-container". Current state: `/workspace/git/vessels/human-surface-vessel` exists as a clone with two remotes — `origin` = `github.com/AviGopal/human-surface-vessel` (origin/dev = `bb7b8dc`, i.e. substrate-authored commits ARE pushed off-box) and `local-bare` = `/workspace/git/remotes/human-surface-vessel.git` (local-bare/dev = `fb042e9`, lagging). 44 commits; substrate-authored commits 09-22 (3 identical-subject commits `cab60aa`, `a1532dc`, `1dcfd4b` "apply the-human-surface-can-be-told-a-form-preference-but-cannot-learn-one-report.json" — double/triple apply) and `8a83c8c`, 09-27 `bb5d6b9` (a `-retry-narrowed-` child) and `bb7b8dc`; plus an **operator** commit `fb042e9` (09-26) made directly in that clone. Meanwhile super-repo `repos/human-surface-vessel` is still **plain 100644 files, not a submodule, no `.gitmodules` entry**, last super-repo commit `0bb3e9d4` 2026-09-22 — so the super-repo tree is ~7 commits behind a separate GitHub repo it does not reference. Two sources of truth for the one vessel whose purpose is human-reshaping. Unit runs from `/vessels/human-surface-vessel` (plus 4 leftover `/vessels/human-surface-vessel-mitosis-*` dirs from 09-26/27). Authorability was restored by bootstrapping a separate repo (09-22) rather than by the 08-07 in-tree cutover fix; the super-repo was never reconciled.

**VALIDATION-3 §7 still-open (08-07):** deep link doesn't scroll to run; `/api/gaps` hardcoded loopback; surfaceIntent not activity; P5/P6/P10; oracle prose contradicting its own shellResult ("recomputed 0 by TWO agreeing derivations" vs `stdout:"1"`) — false-verification observed in passing and not filed in this doc.

**render-learning.md (§6-8):**
- `ui_legibility_scan` advertised, never scheduled (no unit, inventory, manifest); 0 executions vs 5 for universal-tool-fallback (with a positive control). Dispatched once: `{"success":true,"shape":"uiLegibilityReport","body":{"available":false,"reason":"obsidian-vessel unreachable or ui_view empty"}}` — success while observing nothing; "a validator must be able to fail". **Now:** `activity:auto-bridge-ui_legibility_scan` and `activity:development-vessel:ui-legibility-audit-tick` exist as activity rows. `activity_execution_traces` (18,135 rows) has 0 legib rows, but the `execution` table (150,282 rows — the positive control mattered) has **8, all on 2026-09-26**: `ui-legibility-audit-tick` 3× failure, `auto-bridge-ui_legibility_scan` 3× failure, `satisfier:ui_legibility_scan` 2× success (10:52, 11:30). So it was eventually walked (7 weeks after the 08-07 note), mostly fails (it can now fail, or it fails for another reason — not inspected), and a satisfier path reported success on the same day. Discovery today returns **no producer for `uiLegibilityReport`** (it was advertised on 08-07). Separately, render-learning §8 describes an in-vessel "thermostat" loop in human-surface-vessel that files and re-closes `ui-feedback-*` gaps on re-observation — that is distinct from `ui_legibility_scan`.
- Telemetry parked (`interactorObservation/Event/Assertion/Attachment` stored, nothing reads). **Partially addressed later:** `repos/human-surface-vessel/src/importance-learn.ts` (added ~09-20, `0d0951c5` "show what matters most, and learn it from what was shown") reads `interactorObservation_write` exposure records and writes `renderPolicy_write` importance weights. That is a resolver-level learner inside the vessel, not a Thompson-graded activity — still no second render arm selected by posterior (render-learning §8 item 1).
- Complaint channel: `uiFeedback`→`substrateGap` keyed `ui-feedback-<region>-<kind>`; a collision bug (category coerced into interaction enum, 2nd complaint overwrote 1st) was fixed 08-07.

**federation.md:** UI-only spoke runbook; verification steps 1-4 (transport reservation, spoke in hub registry, relay ingress, unserved shape resolves). BUILD-REPORT §5: "none of it has been executed" at 08-07; libp2p transport unexercised then. VALIDATION-3 later measured the deployed `substrate-ui` spoke dispatching across libp2p to the hub (7/14→9/14).

**drafts/d4-activity-api-by-shape.patch:** substrate dispatch `49f8c0b6` (2026-08-08): resolve activity-api by shape instead of env pin. Verdict `staged-not-landed — feature_compose UNFAVORABLE (op_count=1, rolled_back)`, yet the edit **remained in substrate-live's working tree uncommitted and blocked `git pull --ff-only`** — vessel stopped converging to origin/dev silently. Patch defects: drops `.replace(/\/+$/,"")`; top-level `await` makes module load depend on discovery. Today `proxy.ts:86-89` still has the env pin → the intent never landed.

### Defects found by running (BUILD-REPORT §2) — all instances of recurring classes
- `export default app` + explicit `Bun.serve()` → EADDRINUSE against itself.
- Discovery advertises `127.0.0.1` addresses; success of lookup means env fallback never fires → silent 502 (endpoint-routing; recurs as memory 09-22 "resolve-URL joiner overshot").
- `vessel-ctl` swallows `post_install` output and exit → install ok:true over a failed build (false-verification).
- Checker's `statementRegion` took parameter destructure `{ value }` → P2 vacuous (a gate vacuous on the spelling its fixtures didn't use).
- MCP tool documents verdict enum `reached|not_reached|partial`; server accepts `achieved|not_achieved|partial` → 400 (docs-drift).
- `goal_verification_label_write` defined in activity-api but not advertised in the spoke's registry → `/api/grade` targets activity-api directly (write-read-mismatch / endpoint-routing).
- Readiness green over a dead container (`make up` printed 45 units `skipped` + "fleet ready" twice).
- VALIDATION-3: no discovery call had a timeout (hung deregister → vessel invisible but running; measured 6/14→0/14 twice); a fallback cached like an answer (one registry blip → 30s of 502s); "`networkidle` unreachable with SSE" and "a crash reports a smaller denominator = flattering" in the instrument.

---

## 3. Recurrence map (same reason, different hat)

| class | 08-07 human-surface-stack instance | later instance(s) |
|---|---|---|
| sync-deploy-drift / authorability | surface "cannot be authored" (not a submodule); closed "up to the cutover" | memory 09-22 rediscovered identically; bootstrapped as separate GitHub repo; super-repo plain-file copy now ~7 commits behind |
| endpoint-routing (loopback in registry) | 502 via 127.0.0.1:8210; fixed with loopback→discovery-host remap | 09-22 resolve-URL joiner overshoot (absolute + endpoint); env pins still in surface config/proxy |
| human-surface-escalation / dual producer | "retire completely — a dark vessel reads as available" | 248 escalations to :8270 (stateful-ui), 0 answered (09-22); stateful-ui still running 09-28 |
| false-verification (validator can't fail) | `ui_legibility_scan` success:true + available:false; vessel-ctl ok:true; readiness green over corpse | memory: "silent skip = pass", post-land suite dead 08-31→09-28 (`ran=false`) |
| dormant-mechanism | interaction-conformance checker built, proven to refuse, never wired | unchanged 09-28 |
| codebase-bloat-fossils via drift-commit | (08-16 twelve orphaned http-response drafts) | 09-07 `4e4170a8`, 09-19 `796fac89`, 09-28 `9d839e0` |
| docs-drift in openspec status | human-surface-stack never archived, no tasks.md | causal-attempt-ledger tasks.md 0/36 checked but header says ACCEPTED 09-26 10/10 ×3; attempt-ledger.ts landed by substrate 09-23 (`b99b877`, `2974205`) |
| narrowing-duplicates | — | 1909 distinct names across 4010 `activity` rows; e.g. "Surface trace clusters with abnormally high task-count variance across vessel families" ×5 under different `gap-closing:auto-*` ids; 3 identical commits in surface clone 09-22 |

---

## 4. Status-only pass on the named plans (NOT read in full — adjacent shards)

`tasks.md` checkbox counts (`- [x]` / `- [ ]`) and last commit date:

| entry | idx | tasks done/open | last commit |
|---|---|---|---|
| 2026-08-26-consequence-verdict-into-credit | 108 | single file, no tasks.md | 08-26 |
| 2026-08-26-large-file-edit-capability | 109 | single file | 08-25 |
| 2026-08-26-reuse-before-mint-crossfamily-dedup | 110 | single file | 08-25 |
| 2026-08-27-live-recipe-rescues-failed-partner | 111 | single file (29.8 KB) | 09-04 |
| 2026-08-28-escalation-disposition-executor | 112 | single file | 08-28 |
| 2026-08-29-cross-vessel-wiring-repair | 113 | single file | 08-29 |
| 2026-09-12-host-independent-federation-join | 114 | single file (25 KB) | 09-14 |
| 2026-09-24-live-self-view | 115 | 11/2 | 09-28 |
| causal-attempt-ledger | 121 | **0/36 but header: "Acceptance status (09-26): graded acceptance passed (CONSISTENT 05:10:18Z, runs 10/11/12 each 10/10)"**; `attempt-ledger.ts` exists, substrate-authored 09-23 | 09-26 |
| consumer-side-landing-probes | 123 | 0/7 | 09-27 |
| contained-self-development | 124 | 34/23 | 09-28 |
| decentralized-compose-ownership | 125 | 42/2 | 09-28 |
| do-anything-surface | 128 | no tasks.md (44 KB) | 08-07 |
| obsidian-legibility-surface | 169 | no tasks.md | 07-19 |
| unified-install-interface | 174 | 1/50 (tasks.md modified in working tree) | 09-23 |
| value-per-cost-selection | 175 | 26/15 | 09-28 |
| archive/2026-05-17-stratified-goal-generator-harness | 176 | 44/0 | 09-04 |
| archive/2026-05-30-autonomous-palette-write-resolvers | 177 | 18/0 | 09-04 |
| archive/2026-05-30-substrate-gap-drafter-wiring | 178 | 17/0 | 09-04 |
| archive/2026-09-24-resumable-landings | 179 | 23/0 | 09-24 |

Caveat: checkbox counts are not status — causal-attempt-ledger shows the checkbox ledger can be entirely stale while the work is accepted.

---

## 5. Keep / organize recommendations for this shard

**Keep (as reference / concepts):**
- human-surface-stack `design.md` §3 (tokens, P1-P13 rule table, "gate must be proven to refuse") and `render-learning.md` §5-8 ("a validator must be able to fail; 'could not observe' ≠ 'observed nothing'"; "steerable ≠ learning: needs a second arm + a reward = time-to-verdict, never dwell"). These are class-grain lessons with no runtime reader today — they should become concept-db lessons read at prompt-build, per the design's own §3.4.
- BUILD-REPORT §3/§4 method notes: "the substrate answers about its tree, not the operator's" (13621 vs 78 files), and "ReAct floor leaves `poolProvenance: []` — fall back to answerBody before declaring 'no artifact'".
- `packages/design-tokens`, `packages/interaction-conformance` (live code, dormant gate) — keep, but either wire into `lint` after fixing P5/P6/P10 or mark dormant explicitly.

**Organize / retire:**
- Archive human-surface-stack with an explicit open-items list (retirement undone, conformance unwired, scaffold defect, surfaceIntent-not-activity, env pins).
- Finish the stateful-ui-vessel cutover or unregister its shapes — a live dual producer of `uiPanel_write`/`uiQuestion_write` is the proximate cause of the 248-unanswered-escalations class.
- Decide the surface's source of truth: promote `repos/human-surface-vessel` to a submodule of `github.com/AviGopal/human-surface-vessel` (which already exists and receives substrate landings), replacing the stale plain-file copy.
- Delete the 17 in-range strays, the ~60 openspec stray files overall, root `tsconfig.json`, and the 823 emitted artifacts; add a detector on the drift-commit writer (refuse emitted/probe/template-placeholder paths such as `{{…}}`, `*.js` beside a `.ts`, `*probe*.txt`).
