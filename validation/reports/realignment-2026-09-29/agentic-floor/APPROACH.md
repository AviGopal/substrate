# Agentic floor census and approach — the ReAct steps must feed the shape mechanism

2026-10-01. Read-only census. Nothing was edited, dispatched or restarted to produce it; the one exception
is a read-only resolve of `autonomyScope`. This is a **proposal to the coordinator**, who owns
REALIGNMENT.md. §8 lists the amendments it proposes.

**Evidence, one file per track** (file:line rows, method, census and prior art):
- [A — the wrapper, and a loop goal-host can see](A-wrapper-and-visible-loop.md)
- [B — pool, provenance and traces](B-pool-provenance-and-trace.md)
- [C — extraction and reuse](C-extraction-and-reuse.md)
- [D — step selection and sequencing](D-step-selection-and-sequencing.md)
- [E — the history of attempts](E-history-of-attempts.md)

**Sources.**
- Line numbers are the live goal-host source, which is identical to `origin/dev` `76bb373`.
- REALIGNMENT is read from `origin/dev` `e028a7f9`, the version with §9.
- Windows: journals from 09-26 (node 1 11:22Z, node 2 09:57Z) to 10-01; trace-store counts from 09-10 to 10-01, unless a row says otherwise.

**Relationship to [output-shapes/APPROACH.md](../output-shapes/APPROACH.md).** This document supersedes that
one's order.
- **Kept as preconditions:** retention of each attempt's content and an always-built, labelled `answerBody`; the date and the evidence at the moment of use; a judge that reads the full deliverable; and the (b) `/deliverable-shapes` gate.
- **Shrunk:** its steps 2 and 4 (binding repairs and selection hygiene for the planner). They get smaller once the floor feeds the mechanism.

---

## 0. Corrections

1. **The floor did run during both 10-01 news dispatches.** It ran at 08:59 for cea3f4a4 and 09:35 for 5bef2e86, plus 6 more times that day. All 8 failed to reach, and all logged `tools=0/0`. Three things hid it in the dispatch record (D §0):
   - the floor logs with `console.log`, while the record's walk log is filled only by `tap()`;
   - an unreached floor returns the walk's result, so the record's template and reason are the walk's;
   - the floor's trace carries no dispatch id.

   The 09-29 dossier made the same misreading. It is a class, not a slip: **the dispatch record cannot show the floor**.
2. **Extraction is alive again, but not for this class** (C §2, verified directly).
   - 14 `learned-*` templates have been minted since 09-30, after the substrate-authored `c546ec9`/`784a162` re-pointed the trace lookup.
   - None came from the floor or from a human goal.
   - E's precondition "0 mints since 09-22" is stale. §5 restates it.
3. **The 08-21 "DO NOT TOUCH" on the floor** (`COMPOSITION_LEARNING_ARCHITECTURE_2026-08-21.md:112`) was narrow. It said that passing walk evidence into the floor's judge call would be inert, because the floor has no `stepSink` or `learningSink`. It described the floor's isolation; it was not a decision to keep it.
4. **Nobody chose the wrapper. It is a field mismatch** (A §2).
   - llm-resolver runs the tool loop and returns the executed calls as top-level `tool_calls`.
   - The development-vessel wrapper reads tool calls only from `content` (`llm-completion-dispatch.ts:453-492`) and drops them.
   - The 07-23 client-side loop (`43247db`) depended on that wrapper field and never ran a tool.
   - `559a55d` (07-27) then relaxed the gate to trust the wrapper's text.
5. **Builder labels come from the live `autonomyScope`** (read 10-01, updated 15:25Z; admission requires a class2 falsifier). The tracks could only guess, and output-shapes track 1 labelled `goal-target-inference.ts` excluded. From the live record:
   - **Excluded:** goal-host `index.ts`, `llm-resolver-vessel/src/index.ts`, discovery, identity, human-surface, `scripts/substrate`, and 20 development/activity-api core files.
   - **Not excluded:**
     - development-vessel `llm-completion-dispatch.ts`;
     - activity-api `routes/activities.ts` and the trace routes;
     - ribosome-vessel;
     - ias-executor;
     - local-tools;
     - goal-host `goal-target-inference.ts`.

## 1. The finding

**The floor does the work, but none of how it did it reaches the shape graph.**

| | Measure | Window |
|---|---|---|
| Floor verdicts | 908 (node 1: 438, node 2: 470) | journals from 09-26 |
| Reached | 242 | same |
| Logged `tools=0/0` | 908/908 | same |
| `groundedOk>0` | 0 | same |
| Floor ids among reach→mint lines | 0 of 165 | same |
| Floor trace rows with task content | 0 of 1,824 (304 of them reached) | 09-10 → 10-01 |

**Positive control (A §3.3).** Floor run `27c1c600` ran 4 real `curl`s inside the wrapper and logged `tools=0/0`. So tools do run, and the counter is the finding. That settles REALIGNMENT §1's withdrawn question (R1-15).

**The floor's row teaches the wrong things.**
- It records the requested targets as produced. 550 of the 578 floor path rows that list shapes have produced equal to requested.
- Its pathway is the single node `["universal-tool-fallback"]`.
- The shape-signature borrow then lends that node to unrelated goals: 294 such accepts against 130 exact-goal accepts, leading to 109 floor shortcuts, 65 of them unreached (C §4.3).
- The one floor reach ever extracted (08-08) became `learned-universal-tool-fallback`, which reached 3/32. It has since been deleted, with no record of who removed it. Because its id derives from the constant parent, it would return the moment the floor's row carries tasks (C §3.5).

**The shape mechanism the floor would feed carries shape names, not data flow (B, C).** This is the second half of the finding, and it applies to the walk too.

| Defect | Measure |
|---|---|
| Every pool impulse's `producedBy` is the constant `"goal-host-walk"` | all walk impulses |
| No consumed ids are recorded | all walk impulses |
| Pool ids (`walk-<shape>-<n>`) collide across walks, and none are in the `impulse` table | all walk impulses |
| Trace-level `input_impulses` is empty | 150,032/150,032 rows |
| Walk composite edges are positional | 9/178 name a template id where a shape belongs |
| Learned templates with `dependencies` or `inputImpulses` | 0/515 |
| Consumption declared on shape name alone | rows at 09-30 15:57Z and 10-01 08:57–08:59Z declare `web_search` consumed by goal-only prompts |

So feeding the floor in is necessary but not sufficient: §2.0b's "output chaining" rests on edges the mechanism doesn't record.

**Who the learning loop serves today.**
- Learned templates reached 41 times, 39 of them on self-maintenance goals and 0 on human goals (an upper bound; C §5).
- Floor reach was 1/36 for human-authored goals against 44/161 for autonomous ones (A §3.2, 09-28→10-01).

## 2. The loop, link by link

| Design point | Today | Track |
|---|---|---|
| **Act = resolve a shape**, every call visible | Calls happen inside llm-resolver's own loop: up to 20 turns, the first producer discovery lists, cached forever, no Thompson pick or locality check. The floor's 5 read tools are hand-written. `web_search` is never offered, even when the walk's own search succeeded (5bef2e86). Write targets become tools in 332/501 entries. | A, D |
| **Observe = a pool impulse with provenance** | The floor has no pool. Observations are prompt strings, and the walk's pool is not shared with it. | B |
| **Answer = a shaped impulse consuming the evidence** | The answer is `metadata.final_text`, capped at 4,000 chars. `goal_answer` and `human_presentation` are emitted only after a reach, and nothing reads them. | B, C |
| **Judge on the full answer, with date and evidence** | The judge is told "ZERO tools were executed" on all 439 verdicts in the window, including runs where tools ran (`index.ts:5482`). | A |
| **Extract the chain with edges** | The floor never calls `mintReachedTrace`. Ribosome-vessel needs ≥ 1 completed task. "Nodes, not edges" holds. Two extraction owners use different gates: goal-host refused 24 reaches as ungrounded, and ribosome-vessel extracted 16 of them anyway. | C |
| **Reuse: the ceiling, or first/last-mile adaptation** | Reuse mostly re-runs the floor. Adaptation exists only for single commands. | C |
| **Failure located at a step, read back** | The floor's reason never reaches failure memory. There is no route-around record. The sibling call site `index.ts:9552` discarded about 898 in-walk tool loops. | D |

## 3. Why every earlier attempt regressed (E §2)

- **R1 — a separate engine.** `universalToolFallback(goal, targetShapes, dispatchId)` takes no sinks. Each attempt to make it learn bolted a record on *after* it returned (`8ee6c66`, `c033664`, `8928e59`, `2d980fe`), so the system learned the engine's name, not its steps.
- **R2 — the work happens two hops below the instruments.** Every gate keyed on client-side evidence is either dead or wide open: `groundedOk`, `executed`, `commandEvidence`, `isGroundedHonestReach`.
  - The grounding gate flipped four times on one line in ten days: `43247db` → `559a55d` → `f195496` → `f4f983a`, the last two substrate-authored.
- **R3 — fixed on one path, not the sibling.**
  - `411417b` ("mint only grounded") and `559a55d` ("trust the wrapper") together guarantee a floor reach is never minted.
  - `:9552` missed `559a55d`.
- **R4 — counters that couldn't see the thing.** All seven "floor fixed" declarations measured answers, not structure. None was a standing activity.
- **R5 — prompt text instead of evidence.**
- **R6 — extraction never wired from the floor.** The extractor was also dead upstream until 09-29.
- **R7 — rows that look right and mean the opposite.** Empty tasks plus zero duration is the signature of a pre-flight rejection. Detectors file `phantom-success-*` and `precondition-rejection-*` gaps against floor rows.

**What is different this time.** Visibility comes first and is proved with a positive control before anything relies on it. The floor's steps enter through the walk's existing step block, not a new bolt-on. Acceptance is measured at the consumer: a floor-minted template is later selected for a *different* goal and reaches (E §4 A4). "The floor answered" no longer counts.

## 4. Approach, in order

**Builders:**
- **(a):** operator bootstrap. goal-host `index.ts` and llm-resolver `index.ts` are excluded.
- **(b):** a dispatched goal, for files outside the live `excluded_paths` (§0.5).

**Rules for every item:**
- one change per landing (law 12);
- the controls are in the track file named;
- no item widens what is addressable or writable before §9.0, except where marked.

### Step 1 — make every floor tool call visible (b, then a). The prerequisite.

- **(b) development-vessel `llm-completion-dispatch.ts:450-492`.** Pass llm-resolver's executed records through under a **new key** (e.g. `tool_transcript`), each stamped with the dispatch's execution id. llm-resolver already returns them, so it needs no change.
- **(a) goal-host `runGroundedToolLoop`.** Read that key for `executed`, `groundedOk` and `commandEvidence`.
  - The "ZERO tools" preamble becomes correct.
  - That changes judge behaviour on floor runs, so it ships alone and is measured.

**Two traps. Both guards ship in the same landing** (A §6, B B0):
1. **Never under `tool_calls` or `llmToolCalls`.** Otherwise goal-host re-executes every call. Guard: for N transcript entries, local-tools sees exactly N commands, not 2N.
2. **Never into the floor row's `tasks[]`.** A reached floor row with all-successful tasks becomes ribosome-eligible, and `learned-universal-tool-fallback` is re-minted under its constant id. Guard: no `activity` row id matches `universal-tool-fallback`.

**Controls:**
- **Positive:** a `27c1c600`-style run, or the line-count control, shows `tools=N/N` and `groundedOk>0`.
- **Must-fail:** a `tools: []` request yields an empty transcript.

**Side effect:** the transcript also settles where the correct date enters the dispatch path (A §4).

**Gap:** this supplies the missing falsifier for the open `floor-tools-counter-reads-zero-…`.

### Step 2 — stop false learning now (all (a), small and independent)

- **`completion_shapes` = produced ∩ requested, at both leaks** (D P3, C §7 item 7): the floor tag at `:5565` and the shapes handed to `recordGoalPath` at `:5615`. A guessed target stops becoming learned evidence.
- **Declare consumption only when the data was actually bound** (B4, output-shapes T2 P6). The stored 09-30 and 10-01 rows are the must-fail control. The two "too few edges" gaps should be re-scoped, not satisfied by adding edges.
- **Sibling call site `:9552`:** apply the `559a55d` acceptance, or after step 1, a real `groundedOk` (D P2). About 898 discarded loops.
- **Receipts are not reach content on the walk judge digest** (C5, `:11036`). Apply the existing `isBookkeepingOnly` at this sibling site.
- **Interim:** a floor pathway is borrowed only on an exact `goal_hash` match (C4, `:13213`), until step 4 fixes the borrow's input.

### Step 3 — the mechanism carries data flow (shared with the walk)

- **One pool object for the walk and the floor (a)** (B1). It records:
  - `producedBy` = the real producer;
  - an id unique per dispatch;
  - `producerExecutionId` and `consumedIds`.
- **`buildCompositeTraceFromChain` takes the real per-step inputs from that ledger (a)** (B2). This recurs `27cc619`'s class; extend its detector to template ids.
- **The extractor copies edges and refuses collapse (b)** (C3): ribosome-vessel `ribosome-extract.json` plus the `activityTemplate_write` handler.
  - It copies `dependencies` and `inputImpulses`.
  - It refuses when the task count ≠ the source's successful tasks.
  - It computes the id deterministically in code.
- **One reach-and-grounded signal for both extraction owners** (C2). goal-host stamps `grounded:` beside `reached:` (a), and ribosome-vessel requires it (b). Whether to retire the ribosome-vessel WS path instead is a decision (§9).

### Step 4 — floor acts become walk steps (a; the Rank 0 core)

- **Each surfaced tool record enters through the walk's satisfier step block** (`index.ts:10110-10245`, D P4, B B3): a pool impulse, a `walk-satisfier-*` trace, `ledgerStep`, `recordStep`.
- **The answer becomes a `human_presentation` / `goal_answer` impulse** whose inputs are the observation ids it used. The judge reads it at full length (output-shapes precondition).
- **On a reach, the floor calls the walk's own `buildCompositeTraceFromChain` + `mintReachedTrace`** and satisfies the 11-field contract in C §7:
  - tasks per shape step, with input and output shapes;
  - real impulse ids;
  - `resolved_config`;
  - the answer as a task;
  - a chain of ≥ 2 steps;
  - produced ∩ requested;
  - `reached` and `grounded`;
  - `templateId = composition:<shape-slug>`, never the constant;
  - a goal signature;
  - failed steps recorded as tasks.

  The `universal-tool-fallback` summary row keeps **no tasks**.
- **The floor starts where the walk stopped** (D P6). It receives the walk's successful-step impulses, through the provenance filter, plus the goal's failure memory.
- **A route-around record at `:13529`** (D P5, §2.0b). It needs the walk to return structured `missingTargets` and failed-producer reasons. The floor's own failure reason is recorded too.

### Step 5 — the loop moves to goal-host, so each step is chosen as a walk step

- **The change** (A option ii):
  - llm-resolver gets a "return pending tool calls" mode (a; llm-resolver is excluded);
  - the wrapper passes the pending calls through (b);
  - goal-host executes each one via `ufExecuteTool`, with a Thompson producer pick. That is the point where a ReAct step *is* a walk step.
- **Gated on two things:**
  - step 1's positive control;
  - a baseline-first parity battery (E A7) on the same goal set. The flat-prompt protocol may cost answer quality and prompt caching, and the 07-27 failure class (silent degradation to memory answers) must not recur.
- **Widening the tools to registry shapes with descriptions comes after §9.0.** `ufResolveUrl` takes the first non-libp2p row with no locality check.
  - `web_search` alone, as a one-shape exception, is a decision (§9).

## 5. Acceptance (E §4, with P0 restated)

**Preconditions.** Until all three hold, every criterion below is "not evaluable", never "met".
- **P0.1 — extraction is alive for this class.** It holds for walk composites (14 mints since 09-30). It does **not** yet hold for floor or human-goal reaches (0 of 145 runs). A known reached non-floor composite is extracted with ≥ 2 tasks **and edges** (step 3).
- **P0.2 — the counter moves.** Step 1's positive control passes, or `tools=` is declared dead and never cited again.
- **P0.3 — §9.0 holds** for any shape the floor newly resolves or writes.

**Criteria.** Each runs on both nodes, as a standing activity on a rhythm, with positive and must-fail controls:
- **A1:** every floor tool call is a task with non-empty `outputShapes`; task count equals executions.
- **A2:** the floor row is a chain, not a node; completion shapes are what was produced; an answer that consumed no step impulse is refused.
- **A3:** a floor reach is minted with edges, and is not a copy of the floor.
- **A4:** a floor-minted template is selected for a **different** `goal_hash` and reaches.
- **A5:** a reach with no recorded steps leaves the reuse tally unchanged; no `learned-universal-tool-fallback`-style rows are created.
- **A6:** failures are located at a step and read back into the floor; transport errors are not recorded as evidence.
- **A7:** a baseline-first parity battery; no "floor fixed" claim is valid without A1–A6 in the same window.
- **A8:** 14 days with no reopen across the floor gap families listed in E §4.

**Two §2.1 detector rows that would have fired on the day each defect landed:**
- "Every reached floor execution has a sibling `composition:*` row with ≥ 2 tasks, or a stated single-shape reason." Must-fail today: 304/304 lack one. It would have fired on 08-06.
- "No floor run whose `final_text` narrates a tool call has empty `tasks[]`." Today: 439. It would have fired on 07-27.

## 6. What the substrate can do itself now ((b)), and what is in the grant

Each needs a class2 falsifier for admission (live `autonomyScope`).
1. **The development-vessel wrapper forwards the executed transcript** under a new key, with both step 1 guards as its falsifier. This is the highest-leverage item: nothing else is evaluable until calls are visible.
2. **The extractor copies edges and refuses collapse** (C3), in ribosome-vessel and the activity-api write route.
3. **Liveness detectors close on recovery** (C6), so `severed-joint-ribosome-extraction` can close.
4. **From output-shapes:**
   - the `/deliverable-shapes` gate (activity-api);
   - retiring the 16 goal-only writer templates as data;
   - `goal-target-inference.ts` items: rejecting unadvertised targets, failure memory into inference, and the dead web-search route. These are **(b)** by the live list, not (a) as track 1 assumed.

**Inside the human-surface grant:** the run view's best-output block (output-shapes step 1). It is pull-only and §9.0-safe.

**Everything else is (a)** and needs the user's builder-(a) clearance:
- the goal-host halves of steps 1–4;
- step 5's llm-resolver mode.

## 7. Gap ledger (consolidate, do not mint)

| Gap | Action |
|---|---|
| `floor-tools-counter-reads-zero-…` | **Extend.** A, B and D supply its falsifier. Step 1 is its fix. Add both guards. |
| `minted-copy-of-the-floor-shadows-the-floor` | **Becomes a standing must-fail** (no row id matching `universal-tool-fallback`), not a closed item. Record that the template was deleted with no trace. |
| `severed-joint-ribosome-extraction` | **Close on recovery** (C6). Its detector cannot close today. |
| `ribosome-extraction-subsumed-by-goalhost-mint-retire-decision` | **Decision** (§9): unify the gate or retire one owner. |
| the two "too few edges" gaps | **Re-scope** to "edges only when bound" (B4); don't satisfy them by adding edges. |
| `judge-accepts-a-plan-as-the-work-and-reuse-before-derive-reinforces-it` | **Extend:** step 2's produced-shapes rule plus C4 interim; A5 is the falsifier. |
| `phantom-success-universal-tool-fallback-*`, `precondition-rejection-*` on floor rows | **Close as misreads** once step 4 gives floor rows real tasks and duration. Until then they are detector false positives on R7 rows. |
| `goal-host-floor-treats-a-transient-socket-drop-as-terminal`, `a-walk-treated-a-401-as-an-observation…` | **Cite** as A6's must-fail controls. |
| output-shapes ledger | Stands as written there. |

## 8. Proposed REALIGNMENT amendments (for the coordinator)

1. **§1 / §7 step 8: the withdrawn fact is resolved the other way.** Floor run `27c1c600` ran 4 real tool calls and logged `tools=0/0`: tools run, and the counter is blind.
   - The cause is a field mismatch in the development-vessel wrapper, not a design choice.
   - Line drift: the counter is at `:5594`, not `:5394`.
2. **§2.0b builder line.** The first move is development-vessel (b), then goal-host (a), not "(a) because goal-host is excluded".
3. **§2.0b, unstated precondition for output chaining.** Pool impulses carry their producer and consumed ids, and composites and learned templates carry edges. Today: `producedBy` is a constant, `input_impulses` is empty on 150,032/150,032 rows, and 0/515 templates have edges.
4. **§2.0b, add:** the floor's tool calls enter through the walk's step block, and floor reaches are minted through the walk's composite path. The floor's summary row never becomes extractable.
5. **§1 evidence.** Extraction is alive for walk composites since 09-29, through substrate-authored commits. It is never fed by the floor or human goals: 41 learned-template reaches, 39 self-maintenance, 0 human.
6. **§5 doc-expectation row.** The three architecture documents never mention the floor. `sequences/04-improvisation-failure-modes.md` draws a client-side tool loop and claims "every step lands in a trace". The journals contradict both.
7. **§2.1, two detector rows (§5 above).**

## 9. Decisions needed (the user's)

1. **Go/no-go criterion for step 5** (goal-host runs the loop): the parity battery's margin, and its window.
2. **`web_search` as the one-shape exception** to the §9.0 hold on widening the floor's tools. If yes: its `resolver_schema` seam (output-shapes decision 2).
3. **Two extraction owners:** unify the reach-and-grounded gate, or retire the ribosome-vessel WS path.
4. **Builder-(a) clearances:** the goal-host halves of steps 1–4, and step 5's llm-resolver mode.
5. **Carried from output-shapes:**
   - the "commentary" check;
   - the dead inference route;
   - the terminal of the first earned person-facing composite. This becomes concrete here: step 4 makes it `human_presentation`, read by pull until §9.0.

## 10. Findings for the coordinator (not folded into the approach)

- **An untraced write by the floor.** `/workspace/git/super-repo/GPT-5.md` (14 bytes, 09-30 01:47) was written through `shellResult` by floor run `27c1c600`, and it is still there. The floor's "read tools" can write.
- **The judge is told "ZERO tools were executed"** on every floor run (`index.ts:5482-5484`), including runs where tools ran.
- **`learned-universal-tool-fallback` was deleted** with no row, commit or gap recording who removed it.
- **The dispatch record cannot show the floor** (§0.1). Every dispatch-level analysis since July that says "the floor didn't run" is suspect.

## 11. Verification status

- Every fix and criterion here is **specified, not run**.
- Checked directly for this synthesis:
  - the 10-01 floor `ENTER`/verdict lines for `a30a893c` (8, none reached);
  - 14 `learned-*` rows created after 09-22, all on or after 09-30;
  - the live `autonomyScope` `excluded_paths` and admission class (read-only resolve);
  - the location of llm-resolver's tool loop (`src/index.ts:514`, `:688`), which is excluded;
  - the context of the 08-21 "DO NOT TOUCH" line.
- The metabob cockpit's goal-host and registry tools were failing throughout (they call `localhost`). Everything was read through `127.0.0.1` and `docker exec`.
