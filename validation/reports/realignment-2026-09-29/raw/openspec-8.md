# openspec-8 — entries 127-144 of openspec/changes (+archive), realignment round 2

Research date 2026-09-28/29. Read-only. Listing command from the task:
`(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#') | sed -n '127,144p'` (179 entries total).

## 0. Shard scope — what the range actually contains

The task text named the recent active plans (contained-self-development, decentralized-compose-ownership,
value-per-cost-selection, 2026-09-24-live-self-view, consumer-side-landing-probes, causal-attempt-ledger,
unified-install-interface, human-surface-stack, obsidian-legibility-surface, the 08-26..09-12 proposals, archive).
**Those are NOT in 127-144.** Actual positions: 108-115 (dated 08-26..09-24), 121 causal-attempt-ledger,
123 consumer-side-landing-probes, 124 contained-self-development, 125 decentralized-compose-ownership,
157 human-surface-stack, 169 obsidian-legibility-surface, 174 unified-install-interface,
175 value-per-cost-selection, 176-179 archive. They belong to adjacent shards (openspec-7 / openspec-9); not
duplicated here beyond cross-references.

Range 127-144 is:

| # | entry | kind |
|---|---|---|
| 127 | delete-old-http-response-new.json | substrate-authored stray (fossil) |
| 128 | do-anything-surface/ (proposal.md, design.md; NO tasks.md) | real operator proposal |
| 129-133 | fix-http-response-resolver.{ts,js,d.ts,d.ts.map,js.map} | stray + tsc emit residue |
| 134-136 | gap-msvqgv4y-{add-uipanel-write-to-draft-detector,closed,scenario}.json | stray, false-close artefact |
| 137-141 | http-response-camel.{ts,js,d.ts,d.ts.map,js.map} | stray + tsc emit residue |
| 142-144 | httpResponse.{d.ts,d.ts.map,js} | stray tsc emit residue (source httpResponse.ts is #151) |

## 1. do-anything-surface (the only real proposal in range)

- Committed 2026-08-07 by operator, `9ea845d4 docs(openspec): the do-anything surface and the human surface stack`.
  proposal.md 8.5KB, design.md 35.8KB, no tasks.md, never archived.
- Thesis: the do-anything box already exists 3x (Obsidian omnibox, MCP run_goal, federation `goalDispatchAsync`);
  what was missing is REACH (a browser surface for a non-operator) and HONESTY (`reached` headline, never
  `status` alone; hollow success = "most expensive thing this surface could ship"). Reuse-before-mint: no new
  shapes proposed. Initially targeted stateful-ui-vessel; the proposal itself carries a
  "Superseded in part by `human-surface-stack`" block — surface moved to a new vessel, stateful-ui-vessel and
  react-renderer to be retired.
- Nine behavioural expectations (starters from live producers; contract before run with band not %
  confidence; reached headline; artifact evidence; non-moving UI; Q&A attached to dispatch; prose only;
  one-gesture grading; everything traced, no private endpoints). Five falsifiers (stranger at a browser;
  `completed+reached:false` read as failure; grading without searching; every gesture in trace store;
  oracle corpus stops being failure-biased).
- design.md §4 known obstacles: goal-host no CORS (proxy instead); REST `GET /executions/:id` omits
  steps/answerBody (use `goalWalkState`/`activeDispatches` resolves); no streaming; grounded flag not emitted
  by goal-host — "do not re-derive it"; MCP cannot be transport; `ui` role not universal (resolve via discovery).
- design.md §5 two defects found in passing:
  1. **`complete-vessel-scaffold.ts` emits an invalid registration payload** (nested `resolverContract`, no
     `systemVessel`) — vessels built from the substrate's own scaffold register partially invisible.
     Said "worth filing separately". **STATUS 2026-09-28: STILL PRESENT.**
     `repos/development-vessel/src/seed/complete-vessel-scaffold.ts:213` still nests `resolverContract: {...}`;
     `grep -c systemVessel` = 0. Last touched `bbf0e09` 2026-07-12. Recorded 08-07, unfixed 52 days.
     (class: write-read-mismatch — producer writes nested, registry reads flat.)
  2. metric-collector-vessel default port collides with another vessel's inventory port (survives by manifest
     override). Not re-verified here.
- **What got built / is it live (2026-09-28):**
  - Realized in `repos/human-surface-vessel` (plain directory in the super-repo, not a submodule):
    `ui/src/Surface.tsx:57` "The do-anything surface"; `ui/src/components/AskRegion.tsx:219` dispatches with
    `tags:["surface:do-anything"]`; `StarterChips.tsx` (behaviour 1), `RunRow.tsx`, `GradeGesture.tsx`
    (behaviour 8), `lib/runState.ts` + `lib/walk.ts` read `reached`/`grounded`
    (`walk.ts:118-119` renders grounded only when goal-host supplies a boolean — obeys obstacle 4).
    `src/routes/proxy.ts:654` `POST /api/run-goal` proxies to goal-host as `goalDispatchAsync` through the
    resolve path (comment at :635-649 records it used to POST `/run-goal` as plain HTTP, which broke spokes).
  - Live: `human-surface-vessel.service` active, `:8310/health` ok.
  - **Supersession not completed:** `stateful-ui-vessel.service` is STILL active on node 1, `:8270/health`
    reports `panels: 794` (memory note of 09-22 recorded 480 — the replaced vessel keeps accumulating panels).
    The retirement promised by human-surface-stack has not happened; memory already documents 248 escalations
    posted to the pinned :8270 that no human reads (human-surface-escalation / endpoint-routing).
  - Not verified here: falsifiers 1, 2, 5 (no measurement found in this shard). Falsifier 4 plausibly holds for
    dispatch (goes through `goalDispatchAsync` resolve) but the proxy is itself a vessel-private REST route.
  - Residue inside the surface vessel: 32 tracked `.js` files beside 71 `.ts/.tsx` in `ui/src`
    (e.g. `Surface.js`, `AskRegion.js`, `runState.js`, `walk.js`, `.d.ts`) — tsc emit committed next to source.

## 2. The stray files (127, 129-144) — codebase-bloat-fossils

### 2.1 Origin: two substrate "commit everything" sweeps into the super-repo

Every stray in range was first added to git by one of two super-repo commits authored by
`Substrate Autonomous`:

- **`4e4170a8` 2026-09-07 04:20 "Automated commit: vessel code drift detected and committed."**
  2134 files, +59401/-89. Top dirs: validation 1426, packages 236, repos 186, scripts 157, openspec 79,
  plus root junk: `neptune_moons.txt` (353 lines), `elements.html` (3270 lines), `data.txt`, `e.g`,
  `history.txt`, `improvement_plan.txt`, `memory_note.md`, `noop-template.json`, `test.txt`,
  `test_http_response.ts`, `resolver-httpresponse.js`, `{{dirPath}}`/`{{unitFilePath}}`/`{{target_path}}`/
  `{{out_path}}` (unrendered template-variable paths as directory names), `interactor-log/*.jsonl`,
  `load-attribution/records.jsonl`, `gap-store`, `state`, and a root `tsconfig.json`
  (root tsconfig had been deliberately deleted `1c626d6d` 2026-04-30 "drop vestigial Bun-project scaffolding";
  the sweep resurrected it).
  **It also truncated a live source file**: `scripts/substrate/compose-teacher.ts:364-368` records that
  spectral-gap's source was "truncated mid-expression by an automated 'vessel code drift detected and
  committed' commit (4e4170a8, which deleted 45 lines and added none)"; `spectral-gap.service` failed from
  2026-09-14, last JSONL line 2026-09-07, and consumers read a 9-day-old λ₂ as current until measured
  2026-09-16. (autonomous-regression + dormant-mechanism: a dead producer whose last value kept being served.)
  Follow-on `0599ea34` same minute, 1 file.
- **`13c5d466` 2026-09-18 "vessel-code-commit-and-push"** 1909 files (+33963), 1785 under
  `validation/failure-modes`, 62 `Substrate/Projects`, root junk (`update_todos.js`, `temp_scanProjects_fixed.js`,
  `t2-rev-a.txt`, `test.json`...).
- **`796fac89` 2026-09-19 21:11 "vessel-code-commit-and-push cpg-inference-ts"** 412 files (+16104):
  tsc emit (`.js/.d.ts/.map`) for everything under `openspec/changes/*.ts`, root `bun-run-impulse.js`,
  `generate_report.js` (6234 lines), probe files (`known_answer.txt`, `my_probe.txt`,
  `learning_loop_selftest_probe.txt`), and the super-repo `tsconfig.json` edit. Commit subject names the
  cpg-inference-ts vessel but the content is the super-repo — the "commit-and-push for vessel X" goal ran
  `git add` on the wrong tree. Followed within 60s by submodule-pointer bumps `0ac33bfb`, `0d238a73`,
  `d730b03c`, `2cf1007f`.
- Generator: `repos/development-vessel/src/resolvers/rhythm-conductor-tick.ts:126` FAMILY_GOALS
  `"self-maintenance": "run the detect-vessel-code-drift scan across /workspace/repos, then for each vessel
  whose clone is strict and has changes, run the vessel-code-commit-and-push goal"` — a prose goal handed to
  an LLM walk, with git commit authority, no path allowlist. **Still present in source (2026-09-28).**
- Partial cleanup: `d993b331` 2026-09-23 (operator) "chore(root): remove tracked scratch files, and install
  the placement hook where the substrate commits" (part of unified-install-interface). It removed root junk
  (neptune_moons.txt, elements.html gone from HEAD) but the placement hook only checks
  **ALLOWED_TOPLEVEL_DIRS** — it cannot see junk inside an allowed dir. Left behind (HEAD 2026-09-28):
  - root: `history.txt`, `run_scan.js`, `mitosis-applied-host-sync.jsonl`, root `tsconfig.json`
  - **77 stray files directly in `openspec/changes/`** (all 60+ http-response/goal-summary/route-edit
    files), `validation/failure-modes` 3342 files (2275 scenarios, 1046 vessel-scenarios)
  - tracked tsc emit: `.js` files in scripts/substrate, validation/scripts, openspec/changes,
    packages/interaction-conformance, packages/vessel-discovery-client — 142 of them have a sibling `.ts`
    (pure emit residue), 30 without.
- **Recurrence after the "fix"**: `edc68d49` 2026-09-26 (Substrate Autonomous, "Fix runtime drift for
  development-vessel by syncing state/learning-mode-state.json") committed `leases/*.json`,
  `state/learning-mode-state.json` and failure-mode scenario JSONs into the super-repo — runtime state that
  CLAUDE.md says belongs in the volume and is gitignored. Same class, new hat, 3 days after d993b331.
- Container view: `/workspace` inside substrate-live is a git repo whose `origin` is
  `https://github.com/substrate-developer-hub/substrate-developer-hub.git` (an unrelated public project name),
  HEAD `aef8161c0 Automated commit`, `git status --porcelain` = 10212 lines; `/workspace` root holds 92 plain
  files incl. `FINAL_ANSWER.txt`, `GOAL_COMPLETION_CERTIFICATE.txt`, `DELIVERY_SUMMARY.txt`,
  `BROKEN-goal-host-index-2026-09-03T0514.ts.bak`, `_manual_overlay_broken/`, `and` (a file literally named
  "and"). This is where LLM walks write scratch; the sweeps then carried it into git.

### 2.2 The http-response family (127, 129-133, 137-144 + siblings 119, 126, 145-168 in other shards)

- Root cause documented in the live resolver itself, `repos/development-vessel/src/resolvers/http-response.ts`
  header: before operator fix `5be029a` 2026-08-16, `http_response` **ignored the URL and fetched a
  hardcoded `https://httpbin.org/status/404`**, returning its title for every request. Because the shape
  "worked", law 3 (reuse before mint) sent the drafter back to it, got garbage, and it re-minted: "three
  separate sessions today (16:10, 16:41, 17:18) drafting a generic http response resolver into
  openspec/changes/ — twelve orphaned files, none landed". The fix delegates to `resolveWebResource`
  (trust-gated fetcher) and keeps the shape for vocabulary stability.
- Afterwards 4 more substrate cutovers touched http-response.ts (`48db304`, `9419b26`, `5bed003` 08-17,
  `f0f340c` 08-18, all `-narrowed`/`recommit-` mitosis names → narrowing-duplicates).
- The strays themselves: 5 competing implementations of the same resolver
  (`fix-http-response-resolver.ts` imports `../config/types` — a path that does not exist from openspec;
  `http-response-camel.ts` is ≈ the eventual live delegate design; `httpResponse.js/.d.ts` plain fetch with no
  allowlist), plus `delete-old-http-response-new.json` (a "delete" instruction for
  `repos/development-vessel/src/resolvers/http-response-new.ts`, a file that does not exist in the resolvers
  dir today — only `http-fetch.ts`, `http-response.ts`, `http-retry.ts`). None is imported or read by
  anything: `grep openspec/changes` across repos/*/src and scripts finds only doc comments citing real
  proposal dirs. **Status: fossil, zero readers, delete.**
- The camelCase `httpResponse` vs snake `http_response` split is itself the drafter inventing a shape
  name (drafter-quality) — the live shape is `http_response`.

### 2.3 gap-msvqgv4y (134-136) — a closure written as a file, not a change

- `gap-msvqgv4y-scenario.json`: orphaned_capability_scan says `uiPanel_write` "invoked by 0 of the activity
  corpus"; target `repos/development-vessel/src/seed/draft-detector-activity.ts`; expected emergence
  `output_shapes_must_include: ["patch_proposal"]` (unrelated to the stated fix — gap-content / wrong
  predicate).
- `gap-msvqgv4y-add-uipanel-write-to-draft-detector.json`: a line-number patch (`insert_after_line 29`) adding a
  cosmetic "notify UI" task — a check-satisfying edit (hollow-landing class: invoke the orphan so the orphan
  count drops).
- `gap-msvqgv4y-closed.json`: declares `"status":"closed"` — "uiPanel_write is now invoked by
  draft-detector-activity, as verified by inspecting draft-detector-activity.ts".
- **Reality 2026-09-28:** `draft-detector-activity.ts` (46 lines, last commit `851cadc` 2026-06-14 operator)
  contains **no** `uiPanel_write`. The patch never landed; the closure JSON is a false claim written into the
  tree. `gap-msvqgv4y` does not exist in the live gap store (`/workspace/git/super-repo/gaps/gaps.json`,
  6278 records) — the id format predates the store or was never filed. The orphaned_capability category in the
  store today: 40 open, 3 closed, 8 rejected.

### 2.4 Adjacent live finding surfaced while checking 2.3 — 3372 auto-closed pseudo-gaps

Searching the gap store for uiPanel_write surfaced batches like 4 identical gaps created within 100 ms
(2026-09-20T08:39:27.628/.677/.719/.751Z), each `status: closed`, summary
`[closed by dispatch completion] Change repos/stateful-ui-vessel/src/index.ts ...`.
- Generator: `repos/goal-host-vessel/src/index.ts:16887` writes `substrateGap_write` with
  `id: auto_draft_decision:${hash}:${category}`, `source: "goal_host_auto_draft"`, `status: "closed"`,
  summary `[closed by dispatch completion] <goal text>`.
- Count: **3372 of 6278 gap-store records (54%)** have `source=goal_host_auto_draft`; per day
  09-18: 72, 09-19: 635, 09-20: 1337, 09-21: 1170, 09-22: 158; last at 2026-09-22T02:36:07Z (stopped).
- Effect: every dispatch completion minted a born-closed "gap" → gap-close-rate (law 7 triple, metric 1)
  is inflated by records that were never open; the store is half noise. Class: false-verification +
  narrowing-duplicates. (goal-host `src/index.ts` is 17275 lines — codebase-bloat.)

## 3. Classification summary for the realignment

KEEP
- do-anything-surface proposal.md: the nine expectations + five falsifiers are the right contract for any human
  surface and are partially realized in human-surface-vessel. design.md §2 research and §5 minimal-vessel
  skeleton are reusable reference (fold into docs/ as timeless guidance; the proposal is effectively absorbed by
  human-surface-stack).
- The lesson in `http-response.ts` header (a shape that answers but ignores its input poisons reuse-before-mint
  and drives re-minting) — a general principle.

DELETE (fossils, zero readers)
- All 17 strays in 127/129-144 and their siblings (77 files in `openspec/changes/` root), root
  `history.txt`, `run_scan.js`, `mitosis-applied-host-sync.jsonl`, root `tsconfig.json`, the 142 `.js` emit
  files with sibling `.ts`, 32 `.js` in human-surface-vessel/ui/src.

FIX (live defects this shard confirms)
1. `complete-vessel-scaffold.ts:213` nested resolverContract / missing systemVessel — reported 08-07, unfixed.
2. `rhythm-conductor-tick.ts:126` self-maintenance prose goal with commit authority over whatever tree the LLM
   picks — generator of 3 mass commits (2134 / 1909 / 412 files) and a source truncation; still armed; 09-26
   recurrence (`edc68d49`) after the 09-23 root-only placement hook.
3. placement hook only guards top-level dirs; needs a content rule (no emitted .js next to .ts, no runtime
   state dirs `leases/ state/`, no files directly in `openspec/changes/`).
4. stateful-ui-vessel still running (794 panels) — retirement not done.
5. goal-host auto-draft pseudo-gaps: purge/segregate 3372 records from close-rate metrics.
