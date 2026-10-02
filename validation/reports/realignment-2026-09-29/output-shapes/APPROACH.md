# Output-shapes census and approach — why goal walks don't produce useful output, in line with REALIGNMENT

2026-10-01. Read-only census. Nothing was edited, dispatched or restarted to produce it. This is a
**proposal to the coordinator**, who owns REALIGNMENT.md. It does not amend REALIGNMENT; §7 lists the
amendments it proposes.

**Detailed evidence, one file per link of the chain** (each file has the file:line rows, method, census
and prior art):
- [1 — target inference](1-target-inference.md)
- [2 — binding between steps, retries and re-frames](2-output-chaining.md)
- [3 — vocabulary and earning](3-vocabulary-and-earning.md)
- [4 — the reach judge on content goals](4-reach-judge.md)
- [5 — delivery to the surface](5-delivery-to-surface.md)

**Code line numbers** refer to the live goal-host source, which is byte-identical to `origin/dev` `76bb373`.
The local checkout carries someone else's uncommitted edits.

**REALIGNMENT is read from `origin/dev`** (`e028a7f9`, with §9). Tracks 1–3 read a stale local copy that ends
at §8. Their "§9 is absent" remarks are superseded here.

---

## 0. Corrections (to the framing that prompted this, and between tracks)

1. **5bef2e86 attempt 1's placeholder report did not come from search results failing to reach the
   writer.**
   - It is `llm_completion_result`, from the `synthesize_content` task of
     `activity:⟨auto-bridge-obsidian:write_note⟩`.
   - That task's only input is `goal`; its prompt is `GOAL:{{goal}}`. It cannot see search results by
     construction.
   - The `llm_completion` satisfier ran too, but its output was never recorded (track 2 §0).
2. **FEEDBACK-RETRY is not "re-running the same chain".** It is a fresh walk with an empty pool
   (`index.ts:13307-13324`). Nothing attempt 1 produced is carried into attempt 2.
3. **The `web_search` drop in 5bef2e86 attempt 2 was a refused payload, not a chain-reconstruction bug.**
   - The payload was refused twice with "query is required".
   - The one-shot `satisfierTried` rule then blacklisted the shape. The un-poison regex
     (`index.ts:10775`) covers only transient errors.
   - The walk then logged "no producer" although the producer exists. cea3f4a4's retry passed the same
     correction round (15 of 16 such episodes succeed).
4. **The "incorrect date" verdict belongs to 5bef2e86 attempt 2**, whose date was correct. cea3f4a4 attempt 2
   was rejected as "overly generic". Track 3 swaps the two.
5. **§9.5 step 0 names the wrong generator for `obsidian:write_note`.**
   - The live path is activity-api `GET /deliverable-shapes` (`routes/activities.ts:1240-1254`), which goal-host
     unions into the inference vocabulary (`index.ts:5677`, `:5748`).
   - Its gate is `ev > 0`. Verified directly: **638 of 638** non-retired learned/composed templates have
     `ev = 0.5`, so the gate filters nothing.
   - Five vault-era templates (06-25 to 07-02) end in `obsidian:write_note`, which meets `FLOOR = 5`.
   - The topology hint at `index.ts:16939` produced four templates, all retired.
   - The other hardcoded `obsidian:write_note` remaps in goal-host (`:11595`, `:12829`) are gated on
     resolvability, so they are inert today.
6. **The judge is a secondary leak; the walk is the generator.**
   - On current-events goals (journal 09-26→10-01; 61 logged end-of-walk verdicts), **6** were judge errors.
   - **49** correctly rejected walk output: raw snippets 15, unfilled templates 16, errors or clarifications
     10, fabrications 8.
   - **No grounded report reached in the window.**

## 1. What prompted it

- The operator goal `a30a893c` ("What is happening today? … search the web … report with the main
  headlines and some commentary on each") was dispatched from the human surface again and again, and came
  back hollow every time. 5bef2e86 and cea3f4a4 each open by recalling 5 earlier hollow verdicts.
- The question was how activities are supposed to produce output shapes that are useful.
- The architecture's answer:
  - the walk aims at a shape that means the deliverable;
  - it chains back to producers that consume the evidence;
  - it binds that evidence shape to shape;
  - it judges whether the goal was reached;
  - the ribosome turns the reached run into a reusable producer (laws 2–4, CLAUDE.md "execution expectation").
- Every one of those links is broken for this class of goal, and each break fails open into something that
  looks served.

## 2. The chain, measured

| Link | What happens today | Key measure (denominator, window) | Track |
|---|---|---|---|
| **Aim** | Inference checks only `known.has(shape)`. Through the vacuous `ev > 0` gate the vocabulary includes learned terminals that no vessel serves. No registered shape means an answer for a person or the current date. Inference reads no shape descriptions and no failure memory, and caches per goal hash with no expiry. | 0/28 dispatches with an unadvertised target reached. Need-phrased human goals reached 6/50, code-edit goals 42/61. The same targets came back 5/5 for `a30a893c` in one process. Descriptions cover **56/407** (REALIGNMENT counted 312 on 09-29); they are held in memory and lost on restart. | 1, 3 |
| **Select** | The backward-chain pick path has no posterior check, so the penalised composition (Beta(1, 63.2) over 241 runs) runs again. The exclusion set resets each walk, so all three producers of the dead terminal run in turn, and their declared inputs (`activity_template`, `error`) are pulled into the pool. | Steps 3, 5 and 7 of every `a30a893c` walk. | 3 |
| **Bind** | **LLM writers bound to `{{goal}}` only.** 8 of them are auto-bridges. | 16/1,294 LLM tasks. The bridge ignored upstream data that was in the pool in 32/37 runs. | 2 |
|  | **Re-frames pass `terminalOutputShapes: undefined`**, so the synthesis prompt is goal text with no evidence and no date. | 388/388 re-frames. 2/2 recorded news re-frame outputs were stale. | 2 |
|  | **The evidence block has no provenance filter**, so outputs of failed steps are bound in as "PRODUCED INPUT DATA". | Two instances of invented content laundered this way. | 2 |
|  | **Retries are fresh walks.** | 21/459 lost a shape that the earlier attempt had produced. | 2 |
|  | **`web_search` has no `resolver_schema`.** | The first payload is refused 16 times in ~21 h. | 2 |
| **Judge** | No date. Each shape is cut at 1,500 chars and the whole at 8,000. The judge picks `completion_shapes` itself, and that choice feeds `/reach`, `recordGoalPath` and capability-gap filing. | 6/61 errors: 2 grounded reports rejected, 2 false reaches with no search, 2 wrong date reasons. `activity_template` was named a completion shape in 14/61 verdicts, `error` in 5/61. | 4 |
| **Earn** | Ribosome extraction and goal-host minting both require a reach. Capability demand is counted per invented shape name. FAILURE-RECALL changes only the synthesis text, and filters out the structural cause. There is no route-around emitter. | 850 capability rows over 850 distinct names ("news", "headlines", "headlines_summary" never aggregate). The mint path works when a reach happens: 1/96 mints since 09-26 was web search → memory note. | 3 |
| **Deliver** | `answerBody` is built only on reach, cut to 1,500 per output and 3,000 overall. Content is blanked after the newest 100 records. The trace store keeps shape names only. Panel writes are unauthenticated and carry no author or dispatch. | 43/43 unreached records have `answerBody` null. 4/4 human-surface runs among them had real content in the pool. 0/7,158 info panels have a body over 200 chars. cea3f4a4's best report survives only as a 400-char excerpt. | 5 |

## 3. The governing pattern

The same three-part pattern as the hardcoding census:

- **Each link fails open into "looks served".**
  - The `ev > 0` gate passes everything.
  - `known.has` stands in for "can be produced".
  - "No producer" merges a refused payload with an absent producer.
  - The judge chooses its own completion shapes.
  - The capability-gap filer says "already served: obsidian:write_note" (35 times since 09-26), because it
    checks the same vocabulary inference reads.
- **Fixed on one path, missing on the sibling.**
  - Posterior rejection exists on pick path (b) but not on (c).
  - Un-poison covers transient errors but not refusals.
  - **The date appears on the `llm_completion_dispatch` path** (the bridge writer produced the correct
    weekday from a goal-only prompt) **but not on the `llm-resolver` satisfier path.** No date injection was
    found in either source, so where it enters is unknown.
  - `17f2e41` widened the `answerBody` gate and kept `reached`.
- **Closures that didn't take effect.**
  - `goal-target-inference-reads-what-is-happening-in-the-world-as-substrate-health` closed 09-29 on an
    `expected_literal` that occurs 0 times in the file. Its route only runs on the empty fallback, and
    0/887 inferences chose `web_search`.
  - Meanwhile `goal-host-rawresolve-lets-synthesized-args-override-the-resolved-shape-type` stays open
    although `7310fb0` fixed it.

**Why this class cannot learn its way out.** Earning requires a reach. A reach requires all four of these:
- a target that something produces;
- evidence bound into the writer;
- a judge with a clock and the full deliverable;
- content kept long enough to judge, show and extract.

So the order below is forced: unblock the reach first, then let the existing extraction earn the producer.
**No report shape or template is declared by hand** (law 4).

## 4. Approach, in order

Builder labels follow REALIGNMENT §2.0.
- **(a)**: operator bootstrap. goal-host `index.ts` and `goal-target-inference.ts`, which only it imports,
  are excluded, as are discovery and `scripts/substrate`.
- **(b)**: a dispatched goal.

Every item ships with the positive and must-fail controls specified in its track file. Change one thing per
landing (law 12).

### Step 0 — stop the generator (corrects §9.5 step 0)

**The deliverable-vocabulary gate (b).** activity-api `routes/activities.ts` `/deliverable-shapes` (T1 5.1, T3 P1).
- **Change:** replace `ev > 0` with evidence of a reached run **and** a live advertiser for the terminal.
- **Controls:**
  - must-fail: `obsidian:write_note` is on the list today;
  - positive: `memoryNote_write`, `traceAggregateReport` and `problem_detection` stay on it;
  - discriminating: `conceptDescription`, the original motivating example, is kept if it has reached
    executions.
- **Gap:** this is the open gap's own `edit_site`. Supply the machine-checkable falsifier it lacks (§6).
- **Detector (law 6):** one §2.1 row, "every `/deliverable-shapes` entry has ≥ 1 advertiser in discovery".
  It fails on 3 shapes today, and would have fired the day the vault went away.

### Step 1 — keep the content (the precondition two tracks hit independently)

The grounded-report oracle's positive fixtures (step 3) have to be synthetic, and the surface can show only
400 of 4,965 chars, for the same reason: nothing persists the deliverable.

- **Retention (a).** Extend the open `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`; do not
  mint a new gap.
  - Keep a bounded `priorAttempts` with per-shape content.
  - Use a *stated* cut: the floor's `final_text` precedent of 4,000 chars plus `…[truncated N]`.
  - `pruneStore` keeps the reported attempt's content.
- **Always build `answerBody` (a)**, labelled `not reached — best attempt (k of n)`, with the content
  unwrapped from its envelope.
  - Gate: a not-reached `answerBody` never feeds credit, `goal_answer`, or concept writeback.
  - This is APPROACH-hardcoding D; it does not route anything, so it is outside §9.5's hold.
- **Surface, inside the human-surface grant: can start now.** The run view leads with "Best output so far —
  not reached".
  - It is a pull by the `dispatchId` the browser holds, so it is §9.0-safe by construction.
  - Selection is deterministic; placeholders and refusals are excluded.
  - It states chars shown versus chars produced, and is thin until retention lands (T5 P1).

### Step 2 — bind what exists (all (a) unless marked)

- **Re-frames keep their evidence and terminals** (T2 P1).
  - Derive the terminals for the alternative list with the same derivation-intent split.
  - Let the llm_completion branch bind findings when there is no terminal.
- **Bind evidence only** (T2 P4). A provenance filter on `boundFindingsFromIntermediates`, read from a shaped
  list (law 1). It excludes:
  - outputs of failed steps;
  - outputs of goal-only LLM tasks;
  - bookkeeping shapes.
- **A refused payload is not "no producer"** (T2 P3). Add the refusal class to the bounded un-poison, and split
  the log line. The root fix is a `web_search` `resolver_schema`; its seam is **decision 2**.
- **A retry seeds the previous attempt's successful intermediates** (T2 P2). This is §2.0b output chaining,
  inside one dispatch. The cross-dispatch case belongs to the change-series orchestrator (c24); it is (b) once
  c24 has a reader.
- **Goal-only writers.**
  - The bridge author binds upstream shapes through a `{{findings}}` slot (a).
  - The 16 existing goal-only writer rows are retired as data, with a reason row (b).
  - An admission check refuses a new report/summarize writer bound to `{{goal}}` only.
- **Declare consumption only when it was bound** (T2 P6). The code drifted from CONSUMPTION-EDGE-ANALYSIS.

### Step 3 — the judge sees the deliverable, with a clock

- **Restrict what the judge reads, and what counts as completion (a)** (T4 G2).
  - The deliverable goes first at full length, then the evidence as URL and title lines.
  - Exclude `activity_template`, `error`, provenance stubs, `goal`, `dispatch_id` and `filePaths`.
  - `completion_shapes` is restricted **in code** before `/reach`, `recordGoalPath` and gap filing.
  - Abstaining on a cut view is already §9.2 and hardcoding C; it is not re-proposed here.
- **The date.** Investigate first: one LLM path already has it (§3). Locating that is cheaper than the
  three-place `currentTimeReport` registration (T3 P4); register only if it can't be found. Either way it is a
  deterministic comparison, never prompt text (`8a85cfa` and `2c26fcb` did not hold).
- **G1, the grounded-report oracle** (T4 G1), in the `76bb373` oracle chain after the verbatim oracle.
  - A pure `src/grounded-report.ts`: (b) if it is outside `excluded_paths` (verify before dispatch), with
    fixtures and tests.
  - The `poolEvidence` argument and chain wiring (a).
  - Predicate:
    - every date the report asserts is the clock date (±1 day, with the goal's offset parsed);
    - search evidence exists for goals that ask to search;
    - there are ≥ N items, each citing a URL from this run's results;
    - the URLs span ≥ the parsed host count.
  - Its verdict is authoritative in-family, with the LLM judge in bounded shadow.
  - The discriminating must-fail control is F2, "Today is October 27, 2023", which the current judge reached.
  - Policy is held as a shaped `groundedReportPolicy`, including the abstain-share counterweight from §9.2.
  - "Commentary" is **decision 1**.

### Step 4 — selection and memory act on evidence (a)

- **The posterior check also on the backward-chain pick path.** A candidate whose resolver is
  `not registered` is retired with `resolver_absent`, not given a β tick (T3 P2). Inference also rejects an
  unadvertised target, as defence in depth behind step 0 (T1 5.2), with peer advertisers counted.
- **Failure memory reaches inference and selection** (T1 5.3, T3 P6).
  - Bypass the inference cache after a hollow verdict.
  - Exclude a pick that failed twice on the exact goal hash.
  - Stop filtering out structural reasons.

### Step 5 — earn the producer (§2.0b)

- **A route-around record per walk, keyed by need signature, not invented shape name** (T3 P3).
  - The capability-gap filer checks live discovery, not the inference vocabulary.
  - The threshold is held as a shape. Crossing it files an encapsulation goal.
  - The generator is (b), in a non-excluded vessel; the emitter is (a).
- **Then the existing ribosome / `mintReachedTrace` extracts the reached composition.** This is the
  architecture's way to a useful output shape.
- **Inference reads shape descriptions only after they are durable and checked** (T1 5.5, T3 P5).
  - Persist them across restart; describe `_write` verbs.
  - Refuse foreign-domain descriptions (≥ 21 found: "maritime", "genomic").
  - Discovery is excluded, so (a).

### Step 6 — delivery to the person: pull only, until §9.0

- The run view pull (step 1) is the only §9.0-safe path to the person today.
- The Delivered lane stays **HELD** (§9.5 D): `uiPanel_write` is unauthenticated, and panels carry no
  author or dispatch.
- `operator:"human-surface"` is caller-asserted (the proxy forwards the request body verbatim), so it must
  not become a routing key.
- "Reuse `human_presentation`" (T3) is the right *name*, but it is not yet a plan. It is emitted only after a
  reach and is unadvertised, so it cannot be a target until a reached composite terminates in it. See
  **decision 4**.

## 5. What the substrate can do for itself now ((b) list), and what is inside the grant

These need no operator bootstrap. Check each one against `autonomyScope.excluded_paths` before dispatch.

1. **The `/deliverable-shapes` gate** (step 0), with the falsifier from §6. This is the highest-leverage item.
2. **Retire the 16 goal-only writer templates as data**, with reason rows (step 2).
3. **`src/grounded-report.ts`**, as a pure function with fixtures F1–F7 (step 3), if outside the excluded paths.
4. **The §2.1 row "deliverable terminals have an advertiser"** (step 0).
5. *Held:* the `web_search` `resolver_schema` (decision 2), and the local-tools time resolver (pending the
   date lead).

**Inside the human-surface grant:** the run view's best-output block (step 1). human-surface is plain files,
which the substrate cannot author.

**Everything else is goal-host (a)** and needs the user's builder-(a) clearance list. In steps 1–4 that is:
- retention and `answerBody`;
- the four binding seams;
- judge restriction and G1 wiring;
- pick-path posterior check;
- failure memory into inference and selection;
- the route-around emitter.

## 6. Gap ledger (consolidate, do not mint)

| Gap | Action |
|---|---|
| `goal-target-inference-proposes-a-terminal-shape-no-producer-serves` | **Supply a falsifier** in place of `none`: "`GET /deliverable-shapes` contains no shape with 0 advertisers". Must-fail today: `obsidian:write_note`. Correct its "ev>0 appears to mean the template has run (unverified)": that is **verified false** (638/638 at 0.5). |
| `walk-synthesis-step-does-not-receive-the-pool-evidence-it-should-summarize` | **Mechanism now verified:** the goal-only bridge writer, plus unbound re-frames. Keep its falsifier. |
| `reach-judge-and-synthesis-lack-the-current-date-so-time-relative-goals-invert` | **Extend** with the lead (the dispatch path already has the date) and a falsifier: the date comparison, with F2 as the must-fail. |
| `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` | **Extend** with content retention and the always-built, labelled `answerBody`. |
| `a-satisfier-that-returns-no-content-logs-no-reason-so-a-failed-web-search-reads-as-no-producer` | **Extend** with the refusal class (T2 P3). |
| `produced-llmcompletion-does-not-flow-into-the-deferred-memorynote-terminal-body` | **Extend:** same seam as re-frame binding. |
| `the-missing-verifier-generator-only-mints-quantitative-families-…` | **Cite:** G1 is the instance it should have minted from this hollow cluster. |
| `goal-target-inference-reads-what-is-happening-in-the-world-as-substrate-health` | **Reopen.** It closed on an `expected_literal` that occurs 0 times in the file, and 0/887 inferences chose `web_search`. |
| `goal-host-rawresolve-lets-synthesized-args-override-the-resolved-shape-type` | **Close.** Fixed by `7310fb0`; 0 events after 09-30 15:24Z. |
| `detector-coverage-gap-…obsidian_write_note` (×2) | Close as covered once step 0 lands and the joint row holds. |
| *Not yet filed* | These are candidates for the coordinator to fold into existing gaps or file:<br>• goal-only LLM writer tasks<br>• re-frames pass no terminals<br>• the bound evidence block has no provenance filter<br>• the judge chooses `completion_shapes`, junk included<br>• the backward-chain pick has no posterior check<br>• the inference cache ignores failure memory<br>• capability demand is keyed by invented name<br>• shape descriptions are volatile (56/407) |

**For the coordinator, separately from the news-goal work:** the two closure findings (reopen and close
above) are gap-store integrity issues, not news issues. A closure keyed on a literal that is absent from the
file is the class-1 arming failure again.

## 7. Proposed REALIGNMENT amendments (for the coordinator)

1. **§9.5 step 0:** the `obsidian:write_note` generator is the activity-api `/deliverable-shapes` gate, not the
   topology hint (whose templates are retired). The fix is (b), not goal-host.
2. **§2.0b:**
   - (i) **Inference reads descriptions** has an unstated precondition: descriptions are durable and checked.
     Today's count is 56/407, not 312.
   - (ii) The route-around counter is keyed by **need signature**, never by an inferred shape name.
   - (iii) **Output chaining** includes the intra-dispatch case: retries and re-frames reuse what earlier
     attempts produced.
3. **§2.1, three rows, each with its must-fail control:**
   - deliverable terminals have an advertiser;
   - G1 grounded report (F2);
   - an LLM writer run with pool intermediates has a bound evidence block.
4. **§2.2:** `completion_shapes` is chosen in code, with bookkeeping shapes excluded, before any reader
   (`/reach`, `recordGoalPath`, gap filing) consumes it.
5. **§1 evidence:** split floor reach by goal kind. Need-phrased human goals reached 6/50 against code-edit
   42/61 in the same window.

## 8. Decisions needed (the user's)

1. **"Commentary" in G1:** a word-count proxy per item (track 4 recommends this; it is checkable, and the
   shadow judge records disagreement), or leave it to the shadow judge.
2. **The `web_search` schema seam:** local-tools answers `resolver_schema` for its shapes (b), or goal-host's
   lookup falls back to development-vessel's table (a). Don't dispatch the schema fix until this is decided.
3. **The dead web-search inference route:** move it ahead of the prose route (a surface-form rule, which
   §6.2 warns against), or delete it and rely on "no deliverable ⇒ route to the floor, with a route-around
   record" (T1 5.4, preferred).
4. **The terminal of the first earned composite for person-facing answers:**
   - `memoryNote_write` or `uiPanel_write`. Both are unauthenticated routes under §9.0.
   - Until route auth lands, the pull (step 1) is how the person sees it, whichever is chosen.
   - `human_presentation` becomes the advertised name once a reached composite ends in it.
5. **Builder-(a) clearances** for the goal-host items listed in §5.

## 9. Leads to investigate before building (not proposals)

- **The date sibling.** The `llm_completion_dispatch` path (development-vessel, through ias-executor)
  produced the correct date and weekday from a goal-only prompt. The llm-resolver satisfier path didn't.
  Grepping both sources finds no date injection. Find where it enters before registering anything.
- **`7bbd7e8`.** It put gap-clustering instructions ("clustered classes … member gap ids …") into the
  **universal** llm_completion prompt. cea3f4a4 #1's news report was then rejected as "missing a coherent
  report format". That is not demonstrated as the cause; it needs a one-change A/B (law 12) before any fix.
- **Six `web_search` "returned no content" events** with no `rawResolve` line before them (09-30T19:09 to
  10-01T03:18). Cause unknown.

## 10. Verification status

- Every verification in this document and the five track files is **specified, not run**.
- Spot-checked directly for this synthesis:
  - the `/deliverable-shapes` query and its `ev > 0` gate in the live activity-api source;
  - 638/638 non-retired learned/composed templates at `ev = 0.5` (grouped count);
  - goal-host's union of that list into the inference vocabulary (`index.ts:5677`, `:5748`).
- Instrument limits that bound every count here:
  - HOLLOW-CONTENT shows 400 chars, and only for the shapes the judge selected;
  - reach input is cut at 300 chars;
  - argument provenance drops values of 2,000 chars or more;
  - no prompt actually sent to `llm_completion` is recoverable.
- The metabob cockpit's goal-host and registry tools were failing during this work: they call `localhost`
  and the connection closes. Everything was read through `127.0.0.1` directly.
