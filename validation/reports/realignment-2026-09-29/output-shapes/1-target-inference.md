# Output shapes, link 1: goal-target inference

Read-only investigation, 2026-10-01 (node 1, `substrate-live`, profile `standalone`). Nothing was dispatched, written, or restarted.

**The question.** Two operator dispatches of "What is happening today? This should search the web for multiple sources, get the current date and recent month / year. Then produce a report with the main headlines and some commentary on each." (`5bef2e86`, `cea3f4a4`, goal_hash `a30a893c`) inferred `["web_search","llm_completion","obsidian:write_note"]` at confidence 0.9. Two of those are method shapes and one is a delivery verb. `obsidian:write_note` has no advertiser in the live registry. How does inference choose targets, and how does a shape with no producer get into the target set?

**Short answer.**
- Inference checks only that a target is in its vocabulary (`known.has()`). It never checks for a live producer.
- The vocabulary is the local registry, plus peer registries, plus a learned-deliverable list from activity-api. That learned list puts in shapes no vessel serves, `obsidian:write_note` among them.
- The learned list's evidence gate does not filter anything: all 639 learned templates sit at `ev=0.5`, so `ev > 0` passes every one.
- The five learned templates that put `obsidian:write_note` on the list include the one the walk then picks as its producer. So one stale cluster of templates both creates the bad target and supplies the bad producer.
- Inference does not read shape descriptions.
- Inference does not read failure memory. Its decision is cached per process, so after five HOLLOW verdicts the same wrong targets came back five times.
- The registry has no shape for "an answer or report for a person" or for "the current date", so inference has no deliverable to choose for this kind of goal.

**About REALIGNMENT §9.** REALIGNMENT.md as read (778 lines, mtime 09-28 23:30) ends at §8, so §9.5 could not be checked. I located the topology hint through `hardcoding/D-delivery-targets.md:22` instead. §3 below shows it is not the live path.

**Line numbers.** `goal-target-inference.ts` is byte-identical between the live runtime (`/vessels/goal-host-vessel/src`) and the checkout. Live `index.ts` runs 93 lines ahead of the checkout, so citations below read `index.ts:<checkout> (live :<live>)`.

---

## 1. What target inference reads, and what it validates

**Call site.** `index.ts:12481` (live :12574) calls `inferGoalTargetDecision(goal, knownShapes, {decisionCache, maxTargetShapes: 6, complete: routedText(... walkConceptContext + prompt)})`. The log line `goal-target inference {...}` is written at `:12492` (live :12585).

**Inputs.**

| Input | Source | Read? |
|---|---|---|
| Shape vocabulary (`knownShapes`) | `fetchKnownShapes` `index.ts:5630` (live :5723). It unions discovery `GET /registry/shapes` (407 shapes), each `PEER_DISCOVERY_ENDPOINTS` registry (`fetchPeerRegistryShapes`, `:5544`; peers `syzygy.host:18100` with 408 shapes and `host.containers.internal:26100` with 322), and activity-api `GET /v2/activities/deliverable-shapes` (`fetchLearnedDeliverableShapes`, `:5580`; 28 shapes). Cached for 5 minutes. | yes |
| Concept-db recall | `index.ts:12210-12328` (live +93). Up to 5 concepts are found with a lexical 3-term / 1-term query and prepended to the prompt as "Recalled substrate concepts … consider them when choosing target shapes". | yes |
| Shape descriptions (discovery `/registry/shape-descriptions`) | `grep -c 'shape-descriptions\|shape_descriptions'` returns 0 in `index.ts`, live `index.ts` and `goal-target-inference.ts`. Positive control: the same grep for `registry/shapes` in `index.ts` returns 8. | **no** |
| Failure memory (`priorFailureFeedbackFor`) | Computed at `index.ts:12177`. Its only consumers are the walk's `priorVerdictFeedback` at `:13168` and `:13230`. It is not passed to inference. | **no** |
| Topology hints | Not read by inference. They feed authoring only (§3). | no |

**Decision procedure** (`goal-target-inference.ts:436-880`):
1. A deterministic `empty` fallback chain is built at `:441`. It is returned only when the LLM is unavailable or unparseable.
2. A per-goal-hash cache lookup follows (`:476`). The cache is `inferredTargetDecisionCache`, an in-process `Map` at `index.ts:4057` with an LRU of 512 and no TTL.
3. Deterministic shortcuts run next: named-action shape, then the prose route `:566-591`, extract-from-file, registry count, fs aggregate, and code-search.
4. Then the LLM prompt (`:744`). It lists the whole vocabulary as a flat JSON array of names, with "you MUST choose ONLY from this list", plus an edit rule, a shell rule and a composition rule.
5. Then a filter (`:785-796`): `known.has(str) ? str : null`.

**Validation.** The only check is vocabulary membership. Nothing checks that a target has a live producer, that it is a deliverable rather than a method or delivery verb, or that it is advertised by any vessel at all.

**Post-processing in `index.ts`** (`:12495-12786`, live +93): countable-goal shellResult append, shell safety net, store-intent override, derive-from-source seeding, producer-lookup override, compute-chain augmentation, named-shape bind, and then `inferDerivationSplit`. The split only partitions the targets into intermediate and terminal. Its one producibility check, `obsidianWriteResolvable` at `:12744` (live :12837), only guards the remap of fs-write terminals *to* `obsidian:write_note`. It does not reject a terminal that has no producer.

## 2. How `obsidian:write_note` becomes a target, verified hop by hop

| Hop | Evidence |
|---|---|
| Not in the local registry | `/registry/shapes`: 407 shapes, `obsidian:write_note` absent. A positive control through the same address lists `obsidian:vessel_count` and others. |
| Not in either peer registry | Both peers' `/registry/shapes` list 12 `obsidian*` shapes and no `obsidian:write_note`. |
| **Admitted by the learned-deliverable list** | `GET :8080/v2/activities/deliverable-shapes` returns 28 shapes, including `obsidian:write_note`. Three of the 28 have no advertiser anywhere: `obsidian:write_note`, `conceptDescription` and `obsidianAssistDelivered`. |
| Admission rule | `repos/activity-api/src/routes/activities.ts:1240-1287`. A shape is admitted if it is a terminal (produced but not consumed) in at least 5 (`FLOOR`) non-retired `learned-*` or `composed-cap*` activities with `ev > 0`. |
| The evidence gate is vacuous | All 639 such activities have `ev = 0.5` (SurrealDB `activity`, read 2026-10-01). `ev > 0` excludes none of them. |
| Exactly 5 templates carry it, the floor exactly | `learned-auto-bridge-obsidian-write-note-1vk7i9` (06-25), `-1w4gh1` (06-25), `learned-composition-problem-detection-to-obsidian-write-note` (06-30), `…-1782869944057` (07-01), `learned-auto-bridge-obsidian-write-note` (07-02). All are non-retired. They were extracted when an Obsidian vault was attached. Today discovery `vesselCapability` returns 0 producers for the shape (gap `goal-target-inference-proposes-a-terminal-shape-no-producer-serves`, with a positive control on `memoryNote_write`). |
| The same cluster supplies the producer | Both target dispatches selected `activity:⟨learned-composition-problem-detection-to-obsidian-write-note⟩`, a code-analysis composite, for a news report. Every walk of `4a4858b4` failed with "Resolver obsidian:write_note is not registered" (gap above). |
| Concept recall reinforces it (indicative) | The walk logged "5 concept(s) recalled at 3 term(s) 'commentary happening headlines'". I queried concept-db through a different address (GET `/concepts/search`, not the walk's POST `{type:"concept"}`). For the same terms it returns three `goal_finding` concepts titled "What is going on?" (07-08 and 07-13). Their content describes Obsidian vault exploration and note authoring, and mentions `obsidian:write_note`. Because the gate is `known.has()`, recall can only bias the choice *within* the admitted vocabulary. It is not how the shape gets in. |
| Topology hint: **not the live path** | `index.ts:16939` (live :17032) tells authored activities to "use obsidian:note to read and obsidian:write_note to write". It produced 4 `proposed_pattern_authored_operator_goal_*` templates (06-16/17), and **all 4 are retired**, so none contributes to the learned list. It remains a generator of new templates using this vocabulary (and `DISCOVERY_PROXY_SHAPE_FALLBACK` at `:15166` still names the shape), but it is not how this goal got its target. |
| Older routes into the terminal | `goal-note-title.ts:42` (`orderWriteSinks` appends `obsidian:write_note` as an unconditional tail sink) and the 06-30 fs-write→obsidian remap at `index.ts:12736`. These are the likely origin of the reaches that the ribosome extracted into the 5 templates (inferred from the matching dates, not traced). |

**The chain:**
1. In 06-25..07-02, a vault is attached, the walk bridges to `obsidian:write_note`, and the ribosome extracts 5 templates.
2. On 07-31, `6082c2e` + `2c91aaf` union learned terminals into the inference vocabulary with an `ev > 0` gate that admits everything.
3. The vault goes away and the templates stay.
4. Inference picks the shape, and the walk picks a template from the same cluster as producer. The step fails, and the walk ends HOLLOW.

## 3. Census of the retained journal

**Window and denominators.**
- goal-host journal: `Sep 26 10:12:57` → `Oct 01 11:05` UTC (container TZ verified UTC). 887 `goal-target inference {` lines over 565 distinct goal hashes. 37 of the 887 have an empty target.
- Dispatch store `/workspace/goal-host-dispatches.json`: 2,001 records, earliest `startedAt` Sep 28 03:12 UTC. The 386 lines before that cannot be joined.
- Join method: goal-host's `goalHashOf` re-implemented with JS int32 semantics (verified: it reproduces `a30a893c` for the target goal). Each dispatch is matched to the nearest inference line of the same hash within 15 minutes after start. **422 dispatches joined.**
- Human vs autonomous: human means `operator ∈ {operator:claude-avi, human-surface, claude-code-operator, operator:latency-probe}`. A `trigger:"operator"` alone does not count (that is how `rhythm-conductor-drain` and `learning-liveness-probe` appear).
- Kind heuristic:
  - *method*: shellResult, web_search, llm_completion*, http_fetch/response, web_resource, fileContent, fs_read, fs_list, source_code, codeSearchResult, code_find_function, bounded_shell, json_path_extract, activity.
  - *delivery verb*: `*_write`, `obsidian:write*`, `obsidian:note`, fs_write/fs_edit, fileWriteResult/fileEditResult, uiPanel_write.
  - *deliverable*: everything else.

**Registration class**, 1,675 target mentions on 887 lines, vocabulary as of 2026-10-01:

| Class | Mentions | Shapes |
|---|---|---|
| Advertised by the local registry | 1,628 | — |
| Advertised by a peer only | 33 | `federation_verification_report` 32, `federation_probe` 1 |
| Learned-only, no advertiser anywhere | 14 | `obsidian:write_note` 14 (14 lines, 3 hashes, **all human-surface**) |

**Kind**, same denominator: deliverable 964, delivery verb 504, method 207.

**Reach per joined dispatch** (422; reach is the dispatch record's final `reached`):

| Lane | Target set | n | reached |
|---|---|---|---|
| autonomous | contains a deliverable | 202 | 70 (35%) |
| autonomous | method / verb only | 99 | 70 (71%) |
| autonomous | empty | 10 | 1 |
| human | contains a deliverable | 21 | 9 (43%) |
| human | method / verb only | 83 | 39 (47%) |
| human | empty | 7 | 0 |

**Human, split by goal form:**
- Code-edit goals that name `repos/<vessel>/…`: 61 dispatches, 42 reached.
- Need-phrased goals: **50 dispatches, 6 reached (12%)**.
  - All 6 reaches had method-only targets (`llm_completion_dispatch` ×3, `shellResult` ×3).
  - None of the 8 need-phrased dispatches with a deliverable-kind target reached.
  - 13 of the 50 carried a learned-only target.

**Learned-only and peer-only targets:**
- 28 joined dispatches carried a target that is not locally advertised: 13 with `obsidian:write_note` and 15 with `federation_verification_report` (autonomous, peer-advertised). **0 of 28 reached.**
- The 394 with all-local targets reached 189 times.
- The 0/15 on the peer-advertised shape means peer advertisement is necessary but not proven sufficient. Treat that as a separate question for the federation track.

**The "What is happening today" family.**
- 17 dispatches, 0 reached, excluding the separate "What is happening in the world today?" below.
- `a30a893c` produced 11 inference lines across 4 bun PIDs. Inside PID 1666094 (Oct 01 00:14→06:21), 5 consecutive dispatches got the identical target set `[web_search, shellResult, obsidian:write_note]`, each after FAILURE-RECALL had reported earlier HOLLOW verdicts. This is the decision cache (§1) at work.

**Positive control.** `3f454cff` (autonomous, "run docs_align_tick to …") inferred `["docs_align_tick"]`. That shape is locally advertised, has a live producer, and is a deliverable. **It reached**, as did 11 other dispatches with the same goal. Human control: `5ab9486b` `["test_registration"]` reached.

**One reach that does not count as a positive.** `7e36414b` "What is happening in the world today?" was routed to `llm_completion_dispatch` and reached through `satisfier:llm_completion_dispatch` with no search step. That is the confabulation pattern in the open gap `reach-judge-and-synthesis-lack-the-current-date-so-time-relative-goals-invert`.

**Missing deliverables.** No registered shape represents "an answer or report for a person" or "the current date" (registry grep for clock/time/date/answer/human/report: `human_input` is an input, and every `*_report` is substrate introspection). For need-phrased goals, inference therefore has no deliverable to choose and falls back to methods plus a delivery verb.

## 4. Prior art

- **`7721fe8` (07-28, operator)** "route pure question/answer goals to the prose producer, not obsidian:write_note". This is the same symptom, seen on a hub with "the LLM target-inferrer … appends obsidian:write_note". The fix widened the prose route's gate and left the vocabulary source alone. The symptom is back on longer, non-prose goals.
- **`6082c2e` + activity-api `2c91aaf` (07-31, operator)** B2: union learned deliverables into the vocabulary so learned-only shapes (motivating example: `conceptDescription`) can be targeted. This is the admission path in §2. Its "evidence-gated (ev>0)" claim does not hold on today's data (639/639 at 0.5).
- **`744ecd8` (08-08)**: a failed deliverable-shapes lookup must not shrink the vocabulary. This is fail-open in the right direction, but it does not address over-admission.
- **Autonomous `6f2d6b6` (09-22)** added `deterministicWebSearchRoute` for gap `goal-target-inference-reads-what-is-happening-in-the-world-as-substrate-health`, which closed on 09-29. **The closure did not take effect:**
  - The route is called only inside `deterministicRegistryRoute`, which sits only in the `empty` fallback (`goal-target-inference.ts:320`, `:441`), and the prose route (`:566-591`) returns first. Its `LIVE_MEASUREMENT_RE` matches `today's`, not bare `today`.
  - The route's regex matches "What is happening in the world today?" (checked with node), yet that goal inferred `llm_completion_dispatch`.
  - In the 887-line window, **0 lines infer `["web_search"]` alone**.
  - The gap's `expected_literal` was `deterministicExternalInfoRoute`, which occurs 0 times in either copy of the file.
  - Its follow-ups `route-edit-875e56dc`, `route-edit-fd319b43` and their `-narrowed` copies are still open.
- **`goal-target-inference.ts` history**: 60 commits, 26 of them `Substrate Autonomous`. Most recently the path-rewrite gap was reverted by the operator (`316ed67`, 09-30) after autonomous `0f7e688` re-introduced it. In `classes/goal-walk-floor.json` the inference rows are all marked "partial": a long series of per-surface-form routing rules.
- **Open gaps on this link** (gap store, 6,796 rows, keyword filter: 42 hits):
  - `goal-target-inference-proposes-a-terminal-shape-no-producer-serves` (09-30, open, `edit_site: repos/activity-api/src/routes/activities.ts`, falsifier `none`). It already names the right edit site.
  - `detector-coverage-gap-execution_error_learned_composition_problem_detection_to_obsidian_write_note` and `…auto_bridge_obsidian_write_note` (10-01, open).
  - `goal-target-inference-adds-an-unrelated-shape…` (09-26, open).
  - `a-walk-executes-a-write-shape-named-only-in-an-edit-goals-falsifier-text` (09-25, open).
  - `shape-descriptions-do-not-name-the-fields-their-answers-carry` (10-01, open).
- **REALIGNMENT §2.0** already records that `fetchKnownShapes` unions peer and learned shapes, and that "inference does not read" the descriptions. **§2.0b** puts "Inference reads the 312 shape descriptions" under Rank 0, builder (a).
  - That precondition has slipped. Live `/registry/shape-descriptions` now returns **56 of 407**, against 312/405 on 09-29.
  - None of `web_search`, `llm_completion` or `memoryNote_write` has a description.
  - The learned-description store (`discovery registry.ts:468-504`) is in-memory, so the drop is plausibly a restart loss. This is inferred, not measured.

## 5. Proposals

Each item gets a seam, a gate, a builder, a verification and a novelty label. The verifications are **specified, not run** (this was read-only). Builder (a) means operator bootstrap: `goal-host index.ts` is in `autonomyScope.excluded_paths`, and `goal-target-inference.ts` is imported only by it. activity-api `routes/activities.ts` is not in the excluded list as REALIGNMENT quotes it, so items there are (b) dispatched goals.

### 5.1 Admit a learned deliverable only if something live can produce it — fix at the source (new)

- **Seam:** `repos/activity-api/src/routes/activities.ts` `GET /deliverable-shapes` (`:1240`). This is where the open gap's `edit_site` already points.
- **Gate (deterministic):**
  1. Replace `ev > 0` with a real evidence predicate, at least one *reached* execution of the template in the window. `ev` is a constant prior here, so it cannot serve.
  2. Retire-or-skip templates whose terminal shape has no advertiser today. Equivalent: activity-api asks discovery for each candidate's producers and drops shapes with 0. No new endpoint is needed: `vesselCapability` resolve already exists.
- **Builder:** (b), a dispatched goal naming the file.
- **Verification:**
  - Must-fail control: before the change, `GET /deliverable-shapes` contains `obsidian:write_note`.
  - After: it does not, and a re-dispatch of `a30a893c` logs an inference line without `obsidian:write_note` and does not select `learned-composition-problem-detection-to-obsidian-write-note`.
  - Positive control: `memoryNote_write`, `traceAggregateReport` and `problem_detection` stay on the list.
  - Discriminating check, named rather than run: whether `conceptDescription` (6082c2e's own motivating example) has any reached executions. If it does, the gate must keep it, and keeping it is part of the acceptance test.

### 5.2 Reject targets no live vessel advertises — fix at inference (new; same class as the gap above)

- **Seam:** `goal-target-inference.ts` `filterShape` (`:785`), fed a second set `advertised = local ∪ peer` that is passed in by `fetchKnownShapes` (`index.ts:5630`).
- **Gate:** `known.has(s) && (advertised.has(s) || learnedWithLiveProducer.has(s))`.
  - Do **not** gate on the local registry alone. That would drop `federation_verification_report`, which is peer-advertised and resolvable by design (`a289eff`).
  - On today's vocabulary the gate drops exactly the 3 learned-only shapes.
  - A dropped target is logged with its reason, so the drop is observable.
- **Builder:** (a). It is defence in depth for 5.1, so build 5.1 first and do this only if 5.1's gate leaks.
- **Verification:**
  - Must-fail: a fixture vocabulary containing `obsidian:write_note` and no advertiser, where the LLM returns it, and the filter drops it.
  - Positive: `federation_verification_report` with a peer advertiser is kept.

### 5.3 Failure memory must reach the target decision (new)

- **Seam:**
  - The `opts` passed at `index.ts:12481` (live :12574).
  - `remember()` and the cache lookup in `goal-target-inference.ts:466-479`.
- **Gate:** when `priorFailureFeedbackFor(goal)` is non-empty:
  1. Bypass the cached decision.
  2. Put the prior HOLLOW reasons and the prior target sets in the prompt, framed as "these target sets were tried and graded HOLLOW".
  3. Record `inference_basis: "post-failure"` on the log line.
- **Builder:** (a).
- **Verification:**
  - Must-fail: today, within one PID, the same hash after a HOLLOW verdict yields the identical decision. Observed 5/5 for `a30a893c` in bun[1666094].
  - After: the second dispatch of a goal whose first was HOLLOW logs a non-cached inference.
  - Positive: a goal with no failure history still hits the cache (latency unchanged).

### 5.4 Need-phrased goal with no deliverable in its target set: detect it and route explicitly, without inventing a preference (partly §2.0b)

- **The honest constraint.** "Prefer deliverable over method" cannot be implemented as a ranking, because for this goal class **no deliverable shape exists**. Need-phrased human goals: 6/50 reached, all with method-only targets.
- **What a gate can do:**
  1. When the goal names no repo path and no advertised shape, and the inferred set contains no deliverable-kind shape, mark the decision `deliverable: none` and route explicitly to the floor (the tool-enabled ReAct path) with the method shapes as the plan.
  2. Emit a route-around record, "need X, no deliverable producer, routed via floor", which is §2.0b's carrier.
  3. Never terminate on a delivery verb alone.
- **The missing deliverable class** (a person-facing answer/report shape and a current-date fact) is §2.0b and Rank 0 work: a vocabulary decision, not an inference rule. It is named here and not absorbed.
- **Builder:** (a) for the detection and the record. The deliverable shapes are a separate decision.
- **Verification:**
  - Must-fail: `a30a893c` today ends with a delivery-verb terminal and a HOLLOW verdict.
  - After: its line carries `deliverable: none` plus a route-around record, and the floor's output is graded against the goal with the current date supplied (depends on the open date gap).
  - Positive: `3f454cff` `[docs_align_tick]` is unchanged and still reaches.

### 5.5 Inference reads shape descriptions (already in REALIGNMENT §2.0b)

- **Precondition, newly measured:** coverage is 56/407 today, and the shapes this goal class needs have no description. Wiring the read first would read nothing for these goals.
- **Order:**
  1. Persist the learned descriptions, so they survive a discovery restart (discovery is excluded, so (a)).
  2. Then pass `{shape: description}` for the vocabulary into the prompt at `goal-target-inference.ts:744`, which today is a bare name list. Builder (a).
- **Verification:**
  - Must-fail: after a discovery restart, coverage must not fall.
  - Then: with descriptions present, a need-phrased goal's inference line cites a described deliverable where one exists.
  - Positive: code-edit goals keep `fs_edit` at the same rate (42/61 baseline).

### 5.6 Remove the dead web-search route or make it reachable (new; the closure did not take effect)

- **Seam:** `goal-target-inference.ts:276` and `:320`, which are reachable only through `empty` at `:441`.
- **Decision:**
  - Either move the route ahead of the prose route, broadened from surface form to temporal deixis (bare `today`, `yesterday`, `this week`) together with a world/news noun.
  - Or delete it and let 5.4 cover the class.
  - A surface-form regex is exactly what §6.2 warns against, so 5.4 is preferred. In either case the 09-29 closure should be reopened, because what was closed was a literal, not a behaviour.
- **Builder:** (a).
- **Verification:** must-fail: today 0/887 lines infer `["web_search"]`. After, "What is happening in the world today?" infers a target set containing `web_search`.

## 6. What detects this class without an operator (law 6)

Two detectors already exist and each sees half of the class:
- The `detector-coverage-gap-*obsidian_write_note` rows (10-01) see the execution errors.
- The filed gap sees the inference.

Nothing joins "inferred target" to "advertised producer count" per dispatch. The natural registration is one `selfFactSpec` row in the Rank 1 evaluator (§2.1):
- **Joint:** every shape on `/deliverable-shapes` has at least 1 advertiser in discovery.
- **Authority:** discovery.
- **Must-fail control:** today's list, which fails on 3 shapes.

That row would have fired on the day the vault went away.

---

Evidence files (scratch, not committed): `/tmp/ti/census.py`, `/tmp/ti/join.py`, `/tmp/ti/recs.json`, `/tmp/ti/rows.json`.
