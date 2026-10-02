# Machine readers of traces, and failure → gap — what each reader sees, and the approach

2026-10-02. A read-only census in four tracks; nothing was dispatched or written. Everything here is on
the executor side (ribosome, ias-executor, goal-host, activity-api, the gap lane), which the coordinator
owns, so every item is an **ask to the coordinator**, not an edit.

**Evidence:**
1. [the ribosome's trace view](1-ribosome-trace-view.md)
2. [every other machine reader](2-machine-readers.md)
3. [failure → gap pipeline](3-failure-to-gap-pipeline.md)
4. [history and acceptance](4-history-and-acceptance.md)

**State at writing.**
- Live goal-host is `3082a94`, restarted 10-02 09:15Z. That build has the slice:
  - V2: date at the judge and at synthesis;
  - V3: full-length judge view, completion shapes chosen in code, a cut view abstains;
  - V4: bound-only edges, real pool provenance, edged composites;
  - V6: the route-around record at the stall;
  - V7: the writer binds findings when no terminal is present;
  - V8: additive walks.
- Also landed: credit by involvement (`574eea7`), and the floor no longer offers `shellResult` (`5b10279`).
- Measurements before 09:15Z describe the old code. The window since is too short (about 20 minutes, 0 walk
  composites) to grade the new mechanisms.

**Companion:** [human-surface-impulse-rendering/APPROACH.md](../human-surface-impulse-rendering-2026-10-02/APPROACH.md).
The human surface should render impulse **references** and read content by `(executionId, impulse_id)`. This
document asks the same question of the machine readers.

---

## 1. The finding: one trace, ~24 private renderings, and none reads both content and edges

Every machine reader builds its own view of a run from whatever fragment it can reach: a walk-log line, a
trace-list row, a digest string, the dispatch record. About 24 renderers exist, and about 16 build LLM
prompts. The views disagree.

| Reader | What it reads | What's lost or wrong |
|---|---|---|
| **Ribosome** (extracts templates) | A content-stripped trace signature, rendered into an LLM prompt (since 04-27, `mb:360e0de`) | **No edges:** 0 of 2,080 learned tasks carry `dependencies`.<br>**No arguments:** only 67 of 301 source tasks carry theirs; the read drops `consumed_from_task_ids`.<br>**A placeholder frozen:** `{{goal}}` in copied config is frozen to the ribosome's own goal text.<br>**Empty prompts:** 11 of 247 synthesis prompts got an unfilled `{{impulse:trace_signature}}`, and the model invented resolvers.<br>**Ids:** chosen by the LLM; 62 of 239 break the naming rule (duplicates such as `uiPanel-write` and `uipanel-write`).<br>**Unauditable:** the prompt is cut to 600 chars when recorded. |
| **Ribosome, concurrency** | ias-executor slot binding: `resolveImpulseSlot` (`engine.ts:355`) takes the first matching impulse in one **process-wide** store, and `evictExecutionScope` (`:1525`) deletes other runs' impulses | **This is the 2→1 collapse.**<br>• 165 of 260 extractions overlapped another.<br>• At least 47 of 239 proposal ids belong to a concurrent run.<br>• `8676beb` (08-21) fixed the single-run case and assumed runs never overlap. |
| **Failure memory** | A regex over walk-log strings (`index.ts:17113`) | No execution id, dispatch id, step or content.<br>23% of records are one boilerplate sentence (`edit-intent-no-landed-edit`).<br>At least 239 of 429 "similar goal" lessons are that sentence. |
| **Reach judge** | The V3 full-length view, plus an older 600/4,000-char digest appended outside V3's exclusions and cut accounting (`:11256`) | Split input.<br>11% of HOLLOW verdicts (145 of 1,319) come from a walk-log regex.<br>Judge `completion_shapes` name a shape the row never produced on 1,443 of 1,825 rows. This was measured before V3; recheck. |
| **Credit** | goal-host credits by recorded edges (`574eea7`); activity-api credits by chain depth | Two mechanisms disagree. |
| **Detectors** | The trace **list** (`task_count`), status, duration, template prefix, and a three-value failure type | `task_count` reads 0 on 50 of 50 walk rows, and 1,415 of 1,423 rows that hold tasks lack the field. That feeds false precondition-rejection and `-zero` gaps.<br>None reads the verdict: a HOLLOW verdict, "not registered" and a refused connection are all `execution_error`. |
| **Lessons** (concept-db) | Trace-derived concepts | About 1,027 never credited with a success. None links back to its source execution. |
| **Route-around record** (V6) | — | 0 machine readers. Not durable. |

**V4 is real but partial.** Edges now reach the store as ids: the 08:50Z acceptance run records its search
result as consumed. But `input_impulses` is still empty (532 of 532 rows since 08:30Z), the ids resolve to
nothing, and walk composites mark every step `success:true`.

**The answer to "does the ribosome need a different renderer":** yes. It needs a **deterministic
projection of the trace's impulse graph**, which it copies as structure. That is not a new design: it is
the trace record IMPULSE_ACTIVITY_FOUNDATION already defines (lines 489–545), filled in. It holds:
- steps, with resolver, shapes, and config before and after placeholders are filled;
- edges, from the bound impulse ids;
- the answer role;
- failed steps with reasons;
- the verdict;
- content **references**, not content;
- an id computed in code.

The LLM then only names, describes, and proposes which values become variables. minibob's
`assembleTemplateFromExecution` emitted dependencies this way until the 04-27 port replaced it with an LLM.

**The same projection serves the other readers.** Each keeps its own grouping and prompt, but none parses
logs any more:
- **failure memory** keys records to the failing step;
- **detectors** read the verdict and the step;
- **the judge** reads the answer role;
- **credit** reads the edges;
- **lessons** link to the source execution.

## 2. The finding: failure → gap fails at both ends

**The detection end: detectors judge the outer record.** The one class key computed, `deterministic:<class>`,
is read only by the failure-memory prompt, keyed per goal.
- **Wrongness never seeds a goal.** About 800 deterministic HOLLOW verdicts in 6 days became 0 gaps or goals
  (e.g. `edit-intent-no-landed-edit` 369, `code-investigation-uncited` 221). The missing-verifier generator
  filed 0.
- **Detectors that run and yield nothing:**
  - 52 auto-minted `detect-*` activities ran 4,668 times in 7 days and filed 4 gaps;
  - `detector_yield_registry` reads a file that doesn't exist and has filed 0 retirement gaps;
  - `generative_frontier_gap_tick` ran 136 times and filed 0.
- **False positives:** at least 6 of 10 phantom-success gaps and 17 of 31 precondition-rejection gaps.
- **The floor's blind counter** was filed as 8 open gaps by 7 detector families. None mentions tools, and
  no detector reads `tools_total`.

**The store end: rows aren't gaps, and closes aren't fixes.** Over 14 days:
- 49% of 6,878 rows are auto-draft decision records.
- 28% of real rows are re-filed retries (481 `recommit-*`) or narrowed copies (499 `*-narrowed`).
- The capability filer made 885 rows over 851 invented names; 90% were wanted by one goal; 668 were closed by
  one operator bulk action on 09-28.
- 1 of 792 detector-born gaps closed `landed_verified`.
- **Gaps outlive their failures.** The "fetch() URL is invalid" signature (6,853 rows) stopped on 09-28 and its
  gap is still open. Nothing closes a gap when its failure signature disappears.

**The loop has never closed on its own** (track 4). None of the seven stages has been completed end to end
without an operator: failure observed → class detected → gap with a machine-checkable falsifier → repair →
landing → verified at the consumer → 14 days durable.
- All 10 class-2 `landed_verified` closes since 09-28 trace to an operator filing, an operator-written check
  or an operator-dictated edit. That includes `a5e52db`, which I had reported as autonomous.
- The detector-recorded closes were the condition going away, or vacuous. Five such rows are open again after
  25–28 reopens.
- The only all-system run (`235dae8`) certified a regression as fixed.

**The classes found by hand this week, and why no detector caught them:**

| Class | Why it was missed |
|---|---|
| The floor's `tools=0/0` | No detector reads `tools_total` |
| The dead `mcpTool` bridge | `META_DENY` exempts it |
| `obsidian:write_note` as a target | No joint row between deliverable shapes and advertisers |
| `GPT-5.md` written into the live clone | The file is still there, among 58 untracked root files; the hygiene detector counts only mitosis dirs |
| The surface proxy's missing route | Flagged only as a file mismatch; the drift repair is env-gated |
| The surface proxy's cross-site forwarding | No detector covers route authentication |

## 3. Asks to the coordinator, in order

Labels: (a) is operator bootstrap; (b) is a dispatched goal. Each ask has a seam and controls in its track
file.

### First: things that make every later step trustworthy
1. **E1 (b), scope impulse slots to each execution in ias-executor** (`engine.ts:355`, `:1525`). Without it, any
   projection still binds through the shared slot and concurrent extractions cross-contaminate.
   - Must-fail: two overlapping extractions both produce the composite's id with the satisfier's inputs.
2. **M4 (b), detectors read the stored trace, not the list row.** This ends the `task_count` 0 false positives.
   It is dispatchable now.
3. **A3 (b), a closer that closes a gap when its failure signature has disappeared** and records
   `close_basis: condition_gone`. Only a landing counts as a fix.
   - Positive control: the 09-28 fetch-URL gap closes.

### The machine trace projection (§1)
4. **E3 + M1, the projection** at `mintReachedTrace`: steps, real edges, config before and after filling,
   answer role, failed steps with reasons, the verdict, content references, and an id computed in code.
   - goal-host builds it (a).
   - The ribosome's LLM step becomes a patch over it (b).
   - It extends plan V4/V5/C3, and the content references reuse the human-surface ask C1 (one content store
     for both renderers).
5. **E5–E7 (b):**
   - store and read `dependencies` and the config before filling;
   - stop expanding placeholders inside a copied template body;
   - keep the extractor's input for audit.
6. **E4 (b), a refusal gate in `activityTemplate_write`:** refuse when the task count, edges or id differ from
   the projection. Must-fail controls: the live collapsed and duplicate rows.
7. **E8 (b), a detector that recomputes the projection** for each new learned row and flags mismatches.
8. **M3 (a), one judge input.** Remove the 600/4,000 digest appended at `:11256`. This finishes hardcoding C.

### Readers of the projection
9. **M2 / A1 (a), failure memory keyed to the failing step and class,** not to a log line and a goal hash.
   `failure_mode` gains a class and a step locator.
   - It should precede plan step 6.
   - Must-fail: the boilerplate `edit-intent-no-landed-edit` stops dominating recall.
10. **A2 (b), a generator** that turns each deterministic verdict class into **one gap per class** with a
    class2 falsifier: the missing-verifier generator, re-keyed. Positive control: `edit-intent-no-landed-edit`
    (369) becomes one gap.
11. **M5, one credit reader of edges.** Reconcile goal-host's involvement credit with activity-api's
    chain-depth credit.
12. **M6, lessons carry their source execution,** so a lesson can be credited and retired.
13. **The V6 route-around record gets a durable store and its first reader:** the §2.0b need-keyed counter.

### Store hygiene and coverage
14. **A5–A7:**
    - re-key the detector mint by class, not instance;
    - unblind the yield registry so dead detectors retire;
    - false-positive guards for floor rows.
15. **A4 (b), an untracked-file check** for the substrate's own clone (the `GPT-5.md` class).
16. **Close-basis accounting** (track 4).
    - Every close records `landing:<sha>` or `condition_gone`.
    - Autonomy counts require no operator commit to the gap's check within 7 days of landing.
    - A reopen restarts the 14-day clock.
17. **Route authentication as a detector row** (the CSRF class). It is §9.0's precondition, made observable.

**Overlap with the plan of record** (agentic-runner §4): items 4–6 extend V4/V5/C3; item 9 precedes step 6;
item 13 extends V6; item 17 is §9.0.

## 4. Acceptance (track 4 §4, extending existing retire conditions)

Each criterion is checked on both nodes, as a standing check, split by author, with positive and must-fail
controls.

**(a) Extraction preserves the chain:**
- a minted template's tasks, edges and config equal the source projection's;
- its id is computed in code;
- reuse counts only as a `reached:true` run on a **different** `goal_hash`.

**(b) Failure → gap → fix without hands:**
- a failure class seen in traces is detected, keyed by class, deduplicated, and filed with a class2 falsifier;
- it is closed by a verified landing with no operator commit to its check in the prior 7 days;
- the consumer's output is non-empty;
- it does not reappear under another name for 14 days, and any reopen restarts the clock.

## 5. Decisions

These are the coordinator's to sequence: everything here is executor-side. For you:
1. **Send this to the coordinator as asks?** It extends their plan rather than adding a second one.
2. **Is "one projection, many readers" the shape you want** for the machine side, matching "one reference, read by
   id" for the human side?
