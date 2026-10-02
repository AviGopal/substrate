# 4. The reach judge on content-producing goals

Track: why "news report" goal walks (goal_hash `a30a893c` and siblings) end HOLLOW even when they produce a dated, sourced report, and why two fabricated answers reached. This file covers only the judge link. Walk-side generators are mentioned only to exclude them.

**Headline.** The judge's own errors in this family are **6 of 61** logged end-of-walk verdicts:
- 2 grounded reports rejected;
- 2 fabricated, stale-dated answers reached;
- 2 hollow verdicts whose stated reason got the date wrong.

Most of the other 55 rejections are correct. They reject walk failures: raw search snippets with no report (15), placeholder templates (16), errors and clarification requests (10), and fabrications (8). **No grounded report reached in the window**, so the "grounded and reached" cell is empty. The judge has no clock: it gets today's date right only when a 2026-dated search result happens to be in view. The judge also never sees more than 1,500 chars of a report.

Sources and caveats:
- Line numbers are from the **live** `/vessels/goal-host-vessel/src/index.ts` in `substrate-live` (md5 `23ea6654…`, includes `76bb373`). The local checkout `repos/goal-host-vessel` is at `7d38196`, has uncommitted changes, and lacks `76bb373`.
- REALIGNMENT §9 is on `origin/dev` (`e028a7f9`). The local super-repo working tree is behind it.
- To read the journal, I wrote a scratch copy to the container's `/tmp` and then deleted it. Nothing else was written outside this file.

---

## 1. What the judge receives (code read)

### 1.1 Call sites of `verifyGoalReached` (index.ts:3619)

| Site | Line | Digest passed | Notes |
|---|---|---|---|
| Interim, after every progressing step | 10987 | `interimCaptured + interimPool`, **1500/shape, 8000 total** | not-reached verdicts are not logged |
| End of walk | 11093, retried ×2 at 11099 on `null` | `poolDigest + capturedDigest`, **1500/shape, 8000 total**; `walkEvidence` passed | the only site that emits `HOLLOW —` / `REACH-CONTENT` lines |
| Template path | 14404 | 600/shape, 4000 total (hardcoding C #3) | |
| ReAct floor | 5485 | `finalText` (≤6000) or scratchpad; zero-tool banner (`8a85cfa`) | logs `floor: verdict … groundedOk=` |

How the walk digest is built (10995–11080):
- Every pool impulse except `goal` is included, **in pool insertion order**, as `- <shape>: <JSON.stringify(content)>.slice(0,1500)`.
- A `shellResult` contributes its stdout. Everything else contributes the JSON envelope, so a report inside `{"resolved":true,…,"content":"…"}` loses about 60 chars to the envelope plus `\n` escaping.
- The captured digest (`captureReachDigest`, 14680–14705: 600/item, 4000 total) is appended, and the joined string is cut at 8000.

### 1.2 What is and isn't in the judge prompt (`llmJudgeReach`, extracted by 76bb373; prompt at 4073)

- **Included:** the goal, `producedShapes` (every pool shape name), the task summary (the chain), and the digest under the fixed label "Produced output CONTENT (truncated — …)". That label is printed even when nothing was cut (hardcoding C #1). An optional `commandEvidence` block is also included.
- **Not included: the current date.** No date or clock appears anywhere in the prompt. `9b273ec`/`dabca54`/`df481f9` (07-11) added a CURRENT DATE/TIME block to arg extraction and the producer pick only.
- **The run's own search results are not a separate evidence block.** They appear only as pool lines. A `webSearchResult` (3–4 KB) is cut to 1500 chars, which is about 2–3 results.
- **Duplicate pool entries.** `web_search` and `webSearchResult` often appear as two entries with identical content (verdicts #21, #25–#27), each spending 1500 chars of the budget.
- **Model:** `routedComplete(goalHash, "reach_verification", {prompt, model:"auto"})`. The arm is an llm-resolver vessel chosen by the router, and the model is the resolver's "auto". **No `maxTokens`** is sent. **`stop_reason` is never read** (hardcoding C #32). The goal-host journal does not record which model graded a verdict.
- **Sanitising:** `deterministic` is forced to false, and a negation-phrase list flips `reached` to false.

### 1.3 How `completion_shapes` are chosen

**The LLM picks them.** The prompt asks for "the shape(s) characterising the COMPLETION STATE … a subset of produced shapes". Nothing filters the answer. Downstream:
- `deliverReachVerdict` sends POST /reach with `completion_shapes` (1156);
- `recordGoalPath` stores them as the learned path's shapes;
- capability-gap filing uses `missing ∪ completion_shapes − produced`;
- the obsidian seed-only flip;
- `HOLLOW-CONTENT` logging (11313–11327: the first 400 chars of the first pool impulse per named shape).

In the census:
- the judge named `activity_template` (a 7,247-char template catalogue) as a completion shape in **14/61** verdicts and `error` in **5/61**;
- `activity_template` was in the judged digest in ≥25/61 verdicts, and `error` in ≥30/61. These are lower bounds: the shape list in the `reach-input` line is cut at 120 chars.

### 1.4 The 76bb373 seam

- `76bb373` (10-01) added `verifyVerbatimFileRead` (`src/verbatim-read.ts`) as the **first** entry in the deterministic oracle chain of `verifyGoalReached`. It runs after the hollow pre-checks and before the aggregate, registry, citation and other oracles.
- **Contract:** each oracle returns `GoalReachVerdict | null`, where `null` means abstain and the next oracle or the LLM judge decides. A verdict returns before the judge, so the retry/suppress/widen ladder keyed on `reached === false` never fires on a confirmed result.
- **Shadow:** the same commit extracted `llmJudgeReach` so the judge can run **in shadow** for N verdicts:
  - routed under `SHADOW_ROUTE_PREFIX`, so it is excluded from reward buffers;
  - bounded by the shaped policy `verbatimReadShadowPolicy` (`shadow_n`, `shadow_until`);
  - disagreements are written via `recordDeterministicLabel(…, override)` as `verdict:"partial"`, `labeler:"automated"`, so they never read as ground truth.

**Can a second deterministic family plug in? Yes, with one limitation that has to be fixed first.**
- The chain receives only `dig`, which is the 1500/8000-truncated digest. The verbatim oracle copes by **abstaining on digest-capped reads**.
- A grounded-report check needs the **whole** deliverable and the **whole** URL set of the run's `webSearchResult`. Both are cut in `dig`: the cea3f4a4 reports were 4,218 and 4,965 chars against a 1,500 cap.
- So the second family needs either:
  - an optional `poolEvidence` argument on `verifyGoalReached` (the untruncated `poolImpulses`, which sites 10987 and 11093 already hold; 14404 and 5485 pass none, so the oracle abstains there), or
  - to run at the walk call site before `verifyGoalReached`.

  The first keeps one oracle chain (§2.0 "consolidate"), so it is preferred.
- The shadow runner (`createVerbatimShadow`, `ShadowDeps`) is generic in its interface. Its log prefix (`[verbatim-read-oracle]`) and policy name are hard-coded, so reusing it needs a prefix/policy parameter, not a second runner (law 3).

---

## 2. Census

**Address.** The goal-host journal (`journalctl -u goal-host-vessel`, 169,476 lines) is retained from **2026-09-26T10:12Z to 2026-10-01T11:04Z**.

**Family:** every goal hash whose walk was a time-relative current-events question:

| goal_hash | goal |
|---|---|
| `a30a893c` | "What is happening today? This should search the web…" (the operator goal) |
| `4a4858b4` | a variant of the same |
| `fad02df8` | "What happened yesterday? This should search the web…" |
| `2a92fa34` | "What is happening today?" |
| `9dbab038` | "What is happening in the world today?" |
| `c1dfc244` | "What is happening in the world?" |
| `dbf716c8` | "Where is the rain in Spain?" (weather) |

Hashes were identified from the concept-recall term lines and confirmed against `recordGoalPath` goal text.

**Unit:** one logged end-of-walk verdict: a `walk(…): HOLLOW —` line, or a `REACHED via` line followed by `REACH-CONTENT`. Content comes from the `HOLLOW-CONTENT`/`REACH-CONTENT` lines (400/600-char previews). Pool shapes come from the preceding `reach-input:` line of the same pid.

**Denominator: 61 verdicts** (59 HOLLOW, 2 REACHED).
- All fall between **2026-09-30T12:26Z and 2026-10-01T09:35Z**. No family verdicts exist earlier in the retained window.
- Interim-gate not-reached verdicts are not logged, so 61 counts logged verdicts, not judge calls.
- Attribution is by pid adjacency. One REACHED line (a `docs_align_tick` rhythm walk attributed to `a30a893c`, line 158604) was a misattribution and is excluded.
- Separately, the floor logged 18 `floor: verdict` lines for the family: all `reached=false groundedOk=0`.

**Positive controls for the instrument:**
- The same parser finds REACHED events: 2 in the family, and 13 `REACHED early` lines journal-wide.
- The same parser finds date-correct judge reasons (#27, #74 below).
- Grounding was checked through the same address it claims: the `memoryNote` written by cea3f4a4 attempt 3 was resolved through development-vessel. Its link `aljazeera.com/news/liveblog/2026/10/1/iran-war-live-…` equals a result URL in that attempt's `webSearchResult`.

### 2.1 Output classes, split by whether a webSearchResult was in the pool

| Output class | Search in pool: HOLLOW | No search: HOLLOW | No search: REACHED |
|---|---|---|---|
| S: raw search snippets only, no report synthesised | 15 | 0 | 0 |
| P: placeholder template ("[Current Date]", "{{date}}") | 6 | 10 | 0 |
| I: fabricated or stale content | 3 (#27 June 2024, #35 Oct 30 2023, #74 June 7 2024) | 5 (#11, #13 Oct 4 2023, #15, #59 Nov 5 2023, #77 invented under the correct date) | **2 (#44 "Today is October 27, 2023"; #51 "as of mid-2024")** |
| G: grounded report | **2 (#72, #73)** + 1 single-item grounded note (#78) | 0 | 0 |
| C/E: clarification request, error, empty | 0 | 10 | 0 |
| U: content not shown | 6 | 1 | 0 |
| **Total** | **33** | **26** | **2** |

Rows I, G and U have no matching example of their own, so each answers one direction of the brief:
- **Grounded but rejected: 2 of 33 with-search verdicts**, plus one grounded note that is correctly rejected for having one item. The two cases differ in strength:
  - **#72** (cea3f4a4 attempt 1) is solid evidence. The report's "FlyDubai … dropped 14,125 feet in just 29 seconds … emergency landing" matches the NBC snippet in the same verdict block, dated October 1, 2026. The report was 4,218 chars, so the judge saw ≤36% of it. Judge reason: "missing a coherent report format".
  - **#73** (attempt 2) is **inference**. The report quotes the Al Jazeera live-blog title and a `Link: https://www.alj…`. That URL is confirmed in attempt 3's search in the same dispatch, but attempt 2's own search content is not in the journal. The report was 4,965 chars, so the judge saw ≤30% of it. Judge reason: "overly generic".
- **Fabricated and correctly rejected: 8 of 59 HOLLOW** (3 with search, 5 without).
- **Fabricated and reached (false reach): 2 of 2 REACHED.** Both:
  - had **no webSearchResult in the pool**;
  - came from the bare `llm_completion_dispatch` satisfier after a FEEDBACK-RETRY;
  - asserted a stale date;
  - had alpha withheld, but `recordGoalPath reached=true` was recorded.

  Every reach in the family over the window was false.

### 2.2 The stated reasons (59 HOLLOW)

These categories overlap. They are hand-coded from the reason text.
- **Format or coherence** ("coherent report format", "structured report", "fragmented"): about 9. This includes both grounded rejections' companions and most of the S-class.
- **Generic or insufficient detail** ("overly generic", "lacks substantive content", "partial commentary"): about 22.
- **Placeholder named explicitly:** 10.
- **Error or data missing** ("API key", "403", "non-trusted source", "error and hollow content"): 9.
- **Clarification instead of an answer:** 5.
- **Date:** 7 (#13, #27, #35, #37, #74, #77, plus #30's "events from September 29").
- **Truncation:** the judge never says "truncated" in this family. The 1,500 cut shows up instead as "incomplete", "partial" and "generic" on the two grounded reports.

**Junk siblings drove wrong reasons:**
- #65: the judge described the `activity_template` catalogue as "only presenting a template and placeholder".
- #59: a stale-dated fabrication was rejected "due to API key issues", reasoning from an `error` sibling.
- #74: a grounded deliverable note was rejected on an invented sibling `llm_completion`. The verdict is still correct, because the note had one item.

### 2.3 Date errors

**Base: 15 verdicts on outputs that asserted a date** (7 stale, 8 current).
- **Reason claims the date was wrong when it was right: 1** (#77). 5bef2e86 attempt 2 said "Today is Thursday, October 1, 2026" with invented headlines, and the judge said "incorrect date". The verdict is right; the reason is wrong.
- **Reason calls the real current date outdated: 1** (#35, 09-30 19:02Z). It said "outdated as it reflects events from September 30, 2026, instead of today's date" about a writer that asserted October 30, 2023.
- **Stale date accepted as today: 2** (#44, #51, the two false reaches).
- **Positive control:** #27 and #74 correctly flag June 2024 output as the wrong period. **Both had 2026-dated search results in the judged digest.** All four errors had either no search in the pool (#77, #44, #51) or a confused view (#35, which had a search in the pool). Inference: the judge infers "today" from whatever dated evidence is in view, and has no clock of its own.

---

## 3. Prior art (searched before proposing)

**goal-host `git log -S` on origin/dev**
- `verifyGoalReached`: 8 commits, the newest being `76bb373`.
- `groundedOk`: `6cba611`, `aa7056c`, `559a55d`, `8ee6c66` (floor grounding), and `8a85cfa`.
- "current date": only `df481f9`/`9b273ec`/`dabca54`, the 07-11 temporal grounding of arg extraction and producer pick, never the judge.
- "grounded report" and "cites a URL": 0 hits.

**What was tried on the judge, and what held**

| Attempt | Result |
|---|---|
| `8a85cfa` (08-15): a `[GROUNDING: ZERO tools…]` banner in the floor's judged digest | Prompt text. The floor-side banner is still live, but the walk path has no equivalent, and both false reaches came via the walk. |
| `2c26fcb` (08-15): "stating it in the prompt does not hold … same prompt, opposite behaviour" | The standing lesson. |
| `f44b27b` (07-23): show the judge the command that produced a value | Held. It changed the judged input, not the instruction. |
| `7506f16` (06-25): raise the pool caps from 600/4000 to 1500/8000 | Fixed one site. The captured-digest and template sites are still 600/4000 (hardcoding C). |
| `verifyCodeInvestigationCitation` (08-27): re-read the files an answer cites | The closest analogue to a grounded-report check: "the answer cites X, and X independently contains the claim". It is confirm-or-fail and closed against confabulated citations. |
| `76bb373` (10-01): deterministic verbatim oracle plus a bounded shadow judge | The precedent for this proposal. |

**Gap store** (`/workspace/git/super-repo/gaps/gaps.json`, 6,796 rows, filtered by id)
- Open and directly relevant:
  - `reach-judge-and-synthesis-lack-the-current-date-so-time-relative-goals-invert` (high severity). It already cites #35 and #44, prescribes a served clock shape and a deterministic date comparison, and has `falsifier:none`.
  - `reach-judge-accepts-coherent-answers-about-the-wrong-subject`.
  - `judge-accepts-a-plan-as-the-work-and-reuse-before-derive-reinforces-it`.
  - `the-missing-verifier-generator-only-mints-quantitative-families-…`. Hollow clusters such as this one never become verifier gaps.
  - `independent-recompute-oracle-grades-on-truncated-input-…`.
  - `a-satisfier-that-returns-no-content-logs-no-reason-so-a-failed-web-search-reads-as-no-producer`.
- Closed `gap-news`, `gap-headlines` and `gap-headlines-summary`: capability gaps minted from the judge's invented "missing" shapes. These are the downstream of §1.3.

**Realignment records**
- `hardcoding/C-decision-caps.md` already owns the truncation half:
  - rows #1–#3 (1500/8000, 600/4000) and #32 (no `stop_reason`);
  - the cea3f4a4 1,500-cut incident;
  - a `boundContent` helper with answer/terminal/evidence/context roles and a "cut ⇒ abstain" verdict guard.
- REALIGNMENT §9.2 carries the abstain rule and its counterweight. §9.3 row 1 is "decision paths may not silently truncate".
- §9.5 step 0 already names "the topology hint that teaches the `obsidian:write_note` fallback" as a generator. That is why every `a30a893c` walk ended "missing shapes [obsidian:write_note] have no producer". It belongs there, not in the judge.

---

## 4. Proposal

These items are judge-side only. "Grounded" means the run's own evidence bounds the content. It does **not** mean the report is true, and it does not mean "reached".

### 4.1 Row G1: the grounded current-events report (a §2.1 evaluator row and an oracle-chain family). **New.**

**Family parse** (abstain outside it, as verbatim does)
- The goal is time-relative ("today", "yesterday", "this week", "current", "latest", "happening") **and** asks for a report, summary, headlines or news.
- The offset is parsed: "yesterday" means −1 day.
- N is parsed: plural "headlines" or "multiple" means ≥2 items. "Multiple sources" means ≥2 distinct hosts. The defaults come from a shaped policy `groundedReportPolicy`, not constants (law 1).

**Predicate, evaluated on the untruncated deliverable**
1. **Date.** Every date the deliverable asserts as "today" or the report date is within ±1 day of the clock date plus the offset. Failure is deterministic `reached:false`.
2. **Grounding.** If no `webSearchResult`, `http_fetch` or `web_resource` is in the pool, the run has no grounding.
   - For goals that explicitly ask to search: `reached:false`.
   - Otherwise: abstain.
   - This step alone catches both false reaches (#44, #51).
3. **Items.** The deliverable has ≥N items, and each item cites a URL that appears in this run's search-result URL set. An exact match on a result title is allowed as a fallback. A planted URL that is not in the set fails.
4. **Hosts.** The cited URLs span ≥ the parsed host count.
5. **Pass.** Steps 1–4 hold ⇒ `reached:true` with `deterministic:true`. The reason records the clock date compared and the matched URLs.

**"Commentary" (caller decision)**
- This is the one criterion the oracle cannot check exactly. Two options:
  - **(i)** a structural proxy: ≥K words per item beyond the matched title and snippet, with K in the policy;
  - **(ii)** leave it ungraded and let the shadow judge measure it.
- Recommendation: (i), because a sentence count is checkable and the shadow judge records disagreement.

**Row fields**

| Field | Value |
|---|---|
| Authority | The host clock read at use time, with the compared date written into the label. The served clock shape the open date gap prescribes is the upgrade, not a prerequisite. The second authority is the run's own `webSearchResult` set. |
| Same-channel limit | Search is non-deterministic, so unlike verbatim there is no fresh independent re-read. The check bounds fabrication; it does not establish truth. |
| Instrument | `src/grounded-report.ts`, a pure function `(goal, deliverable, evidenceItems, now) → verdict|null`, as a sibling of `verbatim-read.ts`. |

**Where it plugs in**
- The 76bb373 oracle chain, placed right after the verbatim oracle.
- It is fed by a new optional `poolEvidence` argument (untruncated pool impulses) at sites 10987 and 11093/11099. At 14404 and 5485 it abstains.
- The floor (5485) could pass its observations later.

**Composition with the LLM judge**
- The oracle's verdict is authoritative in-family. Fails carry β, because must-fail controls exist.
- The LLM judge runs in **bounded shadow**, reusing `createVerbatimShadow` after it is parameterised. Disagreements are written as `partial` labels.
- No prompt text is added: §3 shows that has not held.

**Must-fail controls** (§2.1 item 2: run on the parent sha and the landed sha)

| Fixture | Content | Parent (judge) | Landed (oracle) |
|---|---|---|---|
| F1 | #74 llm_completion, "as of June 7, 2024", with that run's search | HOLLOW | fail: date |
| F2 | #44 "Today is October 27, 2023", no search | **REACHED** (the discriminating control) | fail: date and grounding |
| F3 | #77 invented headlines under the correct date, no search, no URLs | HOLLOW, wrong reason | fail: grounding; this is the case the date check cannot catch |
| F4 | the Al Jazeera memoryNote (1 item, grounded) | HOLLOW | fail: N |
| F5 | a synthetic grounded report: ≥3 items whose URLs come from a captured `webSearchResult`, dated today | — | pass (positive control) |
| F6 | F5 with planted URLs | — | fail |
| F7 | F5 padded past 8,000 chars | — | pass, which proves the oracle reads the pool, not `dig` |

Notes on the fixtures:
- F5–F7 are synthetic because the empty "grounded and reached" cell means no real positive exists.
- **Instrument prerequisite:** nothing persists the full deliverable. The journal keeps 400 chars, and the 4,218- and 4,965-char reports cannot be recovered. The label written for every in-family verdict must carry the full deliverable (or a pointer to it) and the run's URL set, so later fixtures can be real.

**Window and abstain counterweight (§9.2)**
- Window: 7 days, with n-floor = 10 in-family verdicts.
- Abstain triggers: no parseable items or URLs, deliverable absent, or offset unparseable. Abstains are counted per family.
- An abstain share above `groundedReportPolicy.max_abstain_share` (proposed 0.3) is a divergence finding. So is a shadow-disagreement share above the policy value.

**Builder**
- (a) operator bootstrap for the `index.ts` wiring: the new argument, the chain entry and the shadow reuse, because `index.ts` is excluded.
- (b) a dispatched goal for `src/grounded-report.ts` and its tests, if that file is outside `autonomyScope.excluded_paths`. That is inference, by analogy with hardcoding C's reading for `floor-observation.ts`.

**Verification**
- The F1–F7 fixtures through the real `verifyGoalReached`, with fetch stubbed, as 76bb373's gate tests did.
- A mutation that removes the date comparison must turn F1 and F2 green on the old verdict.
- Then a replay of the operator goal, reading the label at the consumer (§2.2).

### 4.2 Row G2: show the judge the deliverable, not the pool. **Ordering already in hardcoding C; exclusion list new.**

**Seam:** the shared digest builder proposed in hardcoding C (`boundContent`).

**Changes:**
- Put the deliverable first at full length. That is the walk's derivation-intent `terminal_shapes` or the honest-reach guard's `terminalShapes`, both already computed.
- Put the evidence next: search results as URL plus title lines, not 1500-char JSON.
- Deduplicate identical-content entries (`web_search` and `webSearchResult`).
- **Exclude** provenance stubs (`{producedBy, executionId}`), `activity_template`, the failure-mode `error` rows, `test_suite`, `filePaths`, `goal` and `dispatch_id`.
- **Restrict `completion_shapes`** in code to produced shapes minus that exclusion set before they reach POST /reach, `recordGoalPath` and capability-gap filing. **New.**

**Gate, verification and builder**
- Gate: a §9.3 row-1 content-budget expectation (the label carries `cuts[]`).
- Must-fail control: replay #72's view, where the report is cut at 1500 behind junk, and expect an abstain under §9.2.
- Builder: (a).

### 4.3 Abstain on a cut deliverable. **Already in REALIGNMENT §9.2 and hardcoding C; not re-proposed.**

- Only out-of-family verdicts need this. G1 never reads `dig`.
- Positive control already named there: cea3f4a4's 4,965-char report.

### 4.4 Not judge work: file separately (law 6)

- A walk satisfier produced `activity_template` and `error` on every `a30a893c` attempt. That is a pool-pollution generator.
- The inferred terminal `obsidian:write_note` is the §9.5 step 0 generator.
- `llm_completion_dispatch` answers current-events goals with no search (both false reaches). That is a routing defect: `LIVE_MEASUREMENT_RE` misses a bare "today", per the open date gap.
- The missing-verifier generator should have minted G1 from this hollow cluster (open gap).
