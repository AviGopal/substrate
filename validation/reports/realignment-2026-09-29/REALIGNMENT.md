# REALIGNMENT (2026-09-29)

**What this is.** This is the master synthesis of the 2026-09-29 realignment sweep, revised after three adversarial reviews (history, architecture, evidence). It draws on:
- 59 collector records (`records/*.json`, plus `_summary.json` and `_critic-2.json`) and 52 collector raw notes (`raw/*.md`, plus `critic.md` and `critic-2.md`). Reports-2..8 exist only as records.
- 27 class files (`classes/<key>.json`) and 27 dossiers (`dossiers/<key>.md`), each re-measured by a current-state lens and a new-hat lens.
- 55 mechanism-verdict chunks (`mechanisms/chunk-NN.md`), built from 1,642 collector items.
- The canon (`CANON.md`, 18 laws K1–K18 and 25 contradictions C1–C25), built from 1,283 principle statements.
- Earlier syntheses it must not repeat: `validation/reports/docs-self-management-assessment-2026-09-22/REPORT.md`, WHY-THINGS-KEEP-BREAKING (`2ca586ba`, 09-28), and `validation/reports/self-development-program-2026-09-25/MECHANISM-AUDIT-2026-09-28.md` (cited below as MECHANISM-AUDIT).

**Reading rules.**
1. Where a lens or reviewer re-measured a figure, this document uses the re-measured value and says so.
2. Every live count carries its snapshot time and node. Node 1 is `substrate-live` (the hub). Node 2 is `compose2-live` (PROFILE=compute). The live gap store is `/workspace/git/super-repo/gaps/gaps.json` on node 1. It grew from 6,279 to 6,301 rows during the morning of 09-29.
3. The dossiers' `recurrences` fields are never summed. The shards overlap, and some rows are journal-line counts of a single instance.
4. Nothing here is claimed as new or resolved. Each proposal names the earlier attempt it continues **and** the concrete fact that differs. Where no such fact exists, the entry says "no difference" rather than inventing one.
5. Hashes and figures quoted from a reviewer are cited to the class file that holds them (`classes/<key>.json`); I confirmed each is present there. Figures I re-measured myself say "re-measured".

**The P0 warning applies to this document.** CANON.md:11 says the canon is "restatement number eight" unless its §5 is done. This document inherits that condition. Its predecessors include the seven realignments counted in `dossiers/docs-drift.md`, the 08-08 nine-agent audit, the four multi-agent audits of 08-16..08-22, the 09-22 docs-self-management assessment, WHY-THINGS-KEEP-BREAKING and MECHANISM-AUDIT. Earlier attempts to turn rulings into machine-read rows also failed: `FOUNDATION_COMPLIANCE_CHECKS.md` (20 FC + 7 CC checks, 0 code hits) and the `doc_expectation` concept ingestion (1,991 rows, no reader) (`classes/docs-drift.json`). A realignment held only in prose is a claim, not state (K5).

> **Amended 2026-10-01:** see §9 (security findings and the hardcoding census). §9.0 is a new precondition on §2.4 and on any seam that makes an address resolvable or a behaviour writable.
>
> **Amended 2026-10-02:** the continuity amendment (`CONTINUITY-AMENDMENT-2026-10-02.md`) is integrated into §§1, 2.0b, 2.1, 2.2, 2.6, 3.4, 4.2, 6.2, 7 and 8. §10 records what was adopted and the decisions it leaves open. It grants no new runtime authority and has no runtime effect until each integrated item names its writer and reader.
>
> **Amended 2026-10-03:** §2.2 gains *The unit of evidence, and what conditions selection* (user review): the execution record is the particle and learning is an idempotent fold over attached verdicts; selection is conditioned by evidence pooled across nodes and grouped by code version, never by the node's ambient store; credit, reuse and "reached" are keyed by (arm, target shape, goal class) with the verdict's instrument recorded.
>
> **Amended 2026-10-03 (later):** §11 records the prior art behind the 10-03 rulings: the executable plan of record has been attempted at least ten times, human solicitation and credentials repeatedly, and about thirty "done" claims rested on proxies. It states the four reasons none held and what that binds: fix `self_fact_reconcile` flapping before adding rows; the row is the falsifier; durable solicitation; operator-free end-to-end acceptance.
>
> **Amended 2026-10-03 (step 1):** §12 records the prior art for the five step-1 harm classes: hand lists that drift, hollow advertisement, landed-but-unverified, federation write exposure, and count-armed latches. It binds: fix the class, not the instance; coverage means a mutation that turns an armed test red; nothing measured means refuse; a served shape is verified by calling it; latches carry an evidence verdict.
>
> **Amended again 2026-10-02 (user rulings on authority):** §2.1 item 6, §7 step 9 and §10 no longer define a human-governed boundary. The system changes its own limits on evidence applied by the previously accepted version; humans are informed, not gating (§10 item 1).

### Review disposition (09-29 revision)

R1 = history lens, R2 = architecture lens, R3 = evidence lens. "Fixed" means the text changed. "Rebutted" means the text stands, with the reason given.

| # | Problem (short) | Disposition | Where |
|---|---|---|---|
| R1-1 | §2.3 "every earlier attempt sat at admission" is false | Fixed. Sentence deleted, writer-side list inserted, stated: no structural difference except abstain-not-refuse and a verified field | §2.3 |
| R1-2 | exactEditSpec repeats a measured null | Fixed. Five priors cited. Restricted to detectors that already emit a byte region; RCT required | §2.3 |
| R1-3 | class-2 carrier certified regressions | Fixed. Tamper + polarity rule (fail on parent, pass on child, not self-authored) | §2.1 item 2, §2.2 |
| R1-4 | mandatory edit_site gets fabricated | Fixed. Abstain / needs-localization; exit is "verified non-fabricated" | §2.3, §7 step 3 |
| R1-5 | ledger installer uncommitted | Fixed. Committing it is a precondition. Flip-to-refuse condition named as a shape. Re-measured: 0 `ledger` matches in `setup-git-push.sh` at HEAD `5223a5c4` (5 in the working tree, not 7), `Dockerfile.substrate` 0 at HEAD, 1 in the tree | §2.1 item 2, §2.5 |
| R1-6 | sibling refusal: loosening and shape-key | Fixed. `900bc69`→`7148d37` and `63b48175` cited. Key is function, not shape | §2.1 item 1 |
| R1-7 | watchdog called "new"; lane can tamper | Fixed. "New" removed. Four watchdog failures cited. Judged by effect. Evaluator paths stay excluded | §2.1 item 6 |
| R1-8 | port lint post-land; helper already exists | Fixed. Lint moved pre-land. `packages/vessel-discovery-client`, `4fdf5b91`, `6c98916` cited. Write federation: 07-19 proposal cited, no difference named | §2.4 |
| R1-9 | retire sweep exists and is 401-blind | Fixed. Gap restated. Posterior + n-floor + must-fail criterion | §2.5 item 3 |
| R1-10 | retired rows still dispatched by pinned id | Fixed. Precondition added | §4.2 step 2 |
| R1-11 | §5 restates the 09-22 docs assessment | Fixed. Cited gap by gap. Earlier claim-as-predicate attempts cited. Runtime reader named | §5 |
| R1-12 | sixth revert spec | Fixed. MECHANISM-AUDIT #3 cited. One carried, four retired | §7 step 5, §8 |
| R1-13 | ReAct baseline priors | Fixed. `84200483`, 09-19 PREREG cited. Baseline arm runs first. Battery output kept out of stores | §7 step 8 |
| R1-14 | directed forwarding priors | Fixed. `bbb83ff`, `5ec4719`, `112e194` cited. Moved to the intent writer, plus a coverage row | §2.2 item 3 |
| R1-15 | tools=0/0 instrument cannot see wrapper tool use | Fixed. Reported as "not measurable by this instrument" (K4). Positive control named | §1, §7 step 8 |
| R1-16 | variant contradiction §4.2/§6.2/§8 | Fixed. One per-row rule | §4.2 step 3, §6.2 |
| R1-17 | two specs for verdict→credit | Fixed. Only the ledger is carried. The 08-26 change is marked superseded. `0bd32ff` and the psi wiring are cited as existing readers | §2.2, §8 |
| R1-18 | `expected` derived from the registry | Fixed. Sourced from the landing ledger | §7 step 2 |
| R1-19 | §8's difference is conditional; rows were tried before | Fixed. Conditionality stated. FOUNDATION_COMPLIANCE and `doc_expectation` cited. Rows are generated, not hand-entered | header, §8 |
| R2-P1 | operator stays load-bearing | Fixed. Builder label on every rank and step, checked against the 27 excluded paths | §2 ranks, §7 |
| R2-P2 | general floor built last | Fixed. The vertical slice is §7 step 1, and the floor rank is §2.0b | §2.0b, §7 |
| R2-P3 | route-around record and output chaining unranked | Fixed. Now Rank 0 | §2.0b |
| R2-P4 | sibling refusal vs variant-first (law 3) | Fixed. Registered siblings allowed as `variant_of`. Evidence replicated | §2.1 item 1 |
| R2-P5 | hand-written rows repeat jointBinding | Fixed. Rows are generated by dispatched parses held to an oracle | §8 |
| R2-P6 | birth control can be gamed | Fixed. Same rule as R1-3, executed by the evaluator | §2.1 item 2 |
| R2-P7 | refusing at write violates law 13 | Fixed. Accept as needs-localization. Refuse only placeholder or malformed rows | §2.3 |
| R2-P8 | "one holder" contradicts C21 | Fixed. Evidence replicated, posteriors derived locally, holder-abstain on partition | §2.4 |
| R2-P9 | component exits, no vertical slice | Rule stands: the slice is the only "done". **Status 10-03: NOT DONE** (a news-goal reach was claimed as the slice; withdrawn, see §7 step 1 status) | §7 step 1 |
| R2-P10 | enforcement in git hooks and a script | Fixed. `landing_admission` activity; hook is observer only; runner wrapped as a shape with a canary | §2.1 item 2, §2.5 |
| R2-P11 | callers depend on broken parts | Fixed. Prerequisites ordered | §7 |
| R2-P12 | redispatch livelock under-weighted | Fixed. Own exit, own builder | §2.6, §7 step 4 |
| R2-P13 | admission stays an operator knob | Fixed. C20 quarantine shape and a measured widen/tighten criterion as exits; starts concurrently with step 2 | §7 step 9 |
| R3-1 | 30.8% is validated success, not reach | Fixed | §1 |
| R3-2 | 726 unsourced | Fixed. 574 runs / 13 failed (chunk-01:40) | §2.1 |
| R3-3 | :8270 file count | Fixed. 9 src files, re-measured in the live clone | §2.4 |
| R3-4 | openspec counts | Fixed. Re-measured: 176 entries = 98 change dirs + `archive` (4) + 77 strays | §4.1, §5 |
| R3-5 | generate-secrets.sh exists | Fixed. 3 missing paths, re-checked | §5 |
| R3-6 | escalation framing | Fixed | §2.4, §6.2 |
| R3-7 | header counts | Fixed | header |
| R3-8 | floor denominator depends on retention | Fixed. Re-measured on both nodes | §1 |
| R3-9 | 112/113 window | Partly fixed. The source (reports-4, docs-drift dossier) gives no window, and this says so. The one Substrate Autonomous docs commit is residue | §5 |
| R3-10 | behavioral-verification line | Fixed. :26–27; :26 is the branch that fires | §2.2 |
| R3-11 | README lines | **Rebutted in part.** Re-measured `docs/README.md`: :134, :149, :150 (the reviewer had :148) | §5 |
| R3-12 | "restatement eight" is conditional | Fixed | header |
| R3-13 | ~40 masked timers | Fixed. 35 | §6.2 |

---

## 1. The end goal

The substrate is a decentralised fleet that develops itself. Given any goal in natural language, it walks the shape graph to a useful, verified output.

- **Floor:** at worst it matches a ReAct agent. The walk routes around missing producers, bad formats and errors using tool-enabled fallback. Every step is traced, and every route-around is recorded as "producer X absent, routed via Y" (C6).
- **Ceiling:** at best it reuses a learned pathway.
- **Middle:** it reuses the characterized portions of a learned pathway and adapts the uncertain connections wherever they occur, not only at the first or last mile (§2.0b).

**Purpose (amended 10-02).** The mechanism preserves continuity from a need, through produced outputs, actual downstream consumption and observed consequences, to changed future behaviour. Variation supplies alternatives; experimentation characterizes their effects; reduction makes useful transitions reusable under identifiable conditions. Code, activity templates and compositions are different representations of behavioural structure, with different modification and deployment mechanics. Humans take part as sources of purpose, information, authority and judgment.

How it works:
- Behaviour lives in versioned, variable resolvers, and these are used first. Activities select, grade, compose and retire those behaviours (K11, which reconciles the operating model with L2).
- A capability is encapsulated only when traces show that a routed-around need recurs. It is then reused, and its outputs are chained into new goals (L3, L4, OM).
- History decides what to do next, what to learn and what can wait. "History" here means traces graded against independent ground truth.
- Every shape is reachable from every node over p2p, so absence in one place is not absence (K9, L11, C21).

**Done** means an end-to-end path runs across nodes and reaches its goal. It does not mean a component passed its own check. §7 step 1 makes that the first and only "done".
- An execution completing, a consumer successfully using its output, a learning update being stored, and that update influencing later execution are **four separate claims**. Record which one has been established.
- A successful slice demonstrates the connection; repeated observations characterize its reliability. No single successful run establishes a general probability or unlimited applicability.

**The autonomy criterion** has two levels.
- **The self-development milestone** stays as CLAUDE.md states it: a substrate-authored commit on origin/dev, with no operator hands, whose effect is verified at the consumer.
- **The broader criterion** is sustained continuation and learning within granted authority. It has no measured acceptance yet (§10).
- Legitimate human participation (purpose, information, authority, judgment) is not an autonomy failure. Repeated human reconstruction of lost inputs, context or history **is** a continuity defect. Both kinds of participation are recorded accurately.

**The failure** is the same issue recurring for the same reason. Trying approaches that fail is not the failure.

The system has never been built end to end. Evidence (all 09-29):
- A need phrased without a component name had no entry point at 03:35 (`9c967329`). Target inference returned no target shapes (confidence 0), and the walk ran pool leftovers and ended HOLLOW (raw/live-pool-memory.md, need `879c4bc6`).
- **Ceiling vs fresh derivation, stated as what it is.** Lifetime validated-success (**not reach**) by tier from `goal_execution_paths.successful_executions` is learned_pathway 860/2,788 = 30.8% and fresh_derivation 485/16,165 = 3.0% (raw/live-activities.md:79-84, #263). This counter family is the one ruled unreliable in the next bullet, so the contrast is indicative only. **Reach by tier is unmeasured.**
- **Floor reach, re-measured 09-29 ~06Z from the goal-host per-run LLM-judge verdicts in the retained journal.** Node 1: 161 reached of 1,276 floor verdicts (12.6%); the journal begins 09-25 14:35. Node 2: 59 of 245 (24.1%); the journal begins 09-26 09:57. `groundedOk=0` throughout. The denominators depend on journal retention; an earlier draft's 1,287 and 58/241 were from a longer retention or a different window and are withdrawn.
  - The dossier's "~2% (7/7,197)" was an artefact. `success_count` is written only in the CREATE block (`activity-api routes/goal-paths.ts:680`), so it is a first-run flag, and the table summed lifetime `execution_count` (goal-walk-floor current-state lens; line re-checked by R3).
- **Floor tool use is not measurable by the current instrument (K4).** Every floor log line on both nodes reads `tools=0/0`, but that counter (`goal-host index.ts:5394`, `tools=${executedOk}/${executed.length}`) counts client-side `tool_calls` only. The live source says the agentic dispatch wrapper "runs its tool loop internally and surfaces no client-side tool_calls", and that a grounded wrapper answer "legitimately arrives with groundedOk === 0" (`index.ts:5276-5278`, `:5321`). The negative has no positive control through the same address, so "the floor is not a tool-using ReAct loop" is **withdrawn as a fact**. It stands only as an open question: §7 step 8 names the control that must move the counter first.

---

## 2. The few shared capabilities whose absence regenerates most classes

### 2.0 The governing finding: consolidate, do not mint

Every dossier proposed a "missing shared capability". The new-hat lens then found that capability already built, or already specified, under another name in all 10 dossiers it examined (dormant-mechanism and write-read-mismatch share one row below):

| Dossier's proposed capability | What already exists (lens evidence) |
|---|---|
| `measure_outcome` → `verdict` shape (false-verification) | `goal_verification_label`, 14,125 rows (R3 re-measure; `grounded`: false 12,975, null 1,150, true 0), served by activity-api. openspec `2026-08-26-consequence-verdict-into-credit` (`fe00585e`) is marked superseded by the causal-attempt-ledger (MECHANISM-AUDIT #6). |
| `deployDrift` reconciler (sync-deploy-drift) | `self_fact_reconcile` (`983ca92`/`bad7993`/`4e70cbb`, 09-23): graded, boredom-selected, runs a canary positive control, files class-2 gaps, closes on re-measure. Its header already plans a `selfFactSpec` shape. |
| jointBinding registry extension (write-read-mismatch, dormant-mechanism) | The same `self_fact_reconcile`, plus the `expectation:*`/`expectation-trend:*` loops (`7aa8a69b`, `707dd248`). The operator ruled "register into these, do not add a probe runner" when superseding `consumer-side-landing-probes` on 09-28. |
| store self-model `storeExpectation` (trace-store-db) | Declaration-drift scan `8636190`/`e85d3ab` (09-05): 0 ticks, 0 gaps. Plus `self_fact_reconcile`. |
| belief ledger + conservation oracle (selection-learning) | `/v2/activities/conservation-audit` (`ad41776`, 09-06), deleted by autonomous `3147195` on 09-13. Six auditor templates still call it (`activities.ts:5980`, R3 re-check): 21/231 succeeded over 7d. |
| admission seam with negative facts (spend-envelope) | openspec `value-per-cost-selection` Decisions 3/5/7/8. Task 3.4 (negative facts checked before spend) is unticked. |
| federated producer-and-vocabulary resolver (goal-walk-floor) | goal-host `fetchKnownShapes` already unions peer `/registry/shapes` (`a289eff`, 07-02) and learned shapes (`6082c2e`, 07-31). Discovery `/registry/shape-descriptions` covers 312/405 shapes (since `1da5b87`, 06-28), but inference does not read it. |
| consumer-effect `verification_spec` (hollow-landing) | Specified by `399bb2c` (07-12). The sweep was already gated on it by `0bd32ff` (07-31). The live class-1/class-2 `falsifier` carrier exists. |
| post-land consequence observation (autonomous-regression) | Five openspec changes since May specify post-land revert, none built (MECHANISM-AUDIT #3). causal-attempt-ledger 5.1/6.1/6.2 open (0 of 36 tasks ticked while the ledger runs). |

The timelines show a recurrence mechanism, and it is **not** "no one thought of the general capability". It runs like this:
1. A verifier or detector is built and validated once.
2. It then gets no caller, no reader, no input or no rhythm. It runs on one node only, or it can be edited by the lane it checks.
3. The next attempt mints a **parallel** instrument instead of registering into the existing one.

MECHANISM-AUDIT's verdict names the same mechanism: "decay without detection". Examples:
- `behavioral-verification` has had 0 inputs since 07-12.
- `gate_self_probe` exists and has no reader of its result.
- The expectation loop runs toy families only, and its only reader is its writer.
- The newly-failing withhold has fired 0 times in 72h.
- `run-isolated-verification.sh` has 0 callers and is untracked.
- declaration_drift has had 0 ticks.

Canon K1 and K6 name this pattern. The ranked capabilities below are therefore **consolidations of named organs that already exist**. For each one, "what must be different" is a concrete wiring fact: a caller, a reader, a mandatory registration point, or a cross-node address. Where no such fact exists, the entry says so.

**Who builds each rank (R2-P1).** The `autonomyScope` pool record excludes 27 paths: "autonomous work may not land on what lands, verifies, grades or constrains autonomy" (raw/live-pool-memory.md:93-97). These include feature-compose, mitosis-cutover/evaluate, gap-to-feature, substrate-gap, pool-impulse, goal-host index, posterior-update, boredom index, discovery, identity, scripts/substrate and self-fact-reconcile. Every rank below touches at least one of them. So each rank carries one of three builder labels:
- **(a) operator bootstrap** under #1184/C9. It needs an attempt budget and a TTL, is recorded as an L12 intervention, and is committed under operator identity, never "Substrate Autonomous".
- **(b) dispatched goal**, for paths outside the exclusion set.
- **(c) blocked until earn-in** (§7 step 9).

This plan is operator-load-bearing until §7 step 9 moves items from (a) to (b). That is stated here rather than hidden. It is also why step 9's criterion starts right after the slice, concurrently with step 2, rather than waiting for steps 2–8.

Dossier overlap, stated so that nobody plans for 27 classes:
- dormant-mechanism and write-read-mismatch are one capability counted twice.
- spend-envelope's "no single admission point" is also the root cause filed under gap-content, autonomous-regression (window-blind dispatchers) and node-locality.
- The seven capabilities the dossiers proposed reduce to the five below. Rank 0 is added because the floor is the end goal and was previously ranked last (R2-P2).

### 2.0b Rank 0: the floor, the route-around record, and output chaining (the end goal, not a ranked afterthought)

**The capability.**
- The floor or walk fallback emits one shape per route-around: need signature, missing or failed producer, the route taken, and its outcome (C6/K10).
- A counter per (need signature, missing producer) runs across nodes, as replicated evidence (C21).
- When the counter crosses a threshold held as a shape, a generator files an **encapsulation goal**. This is the OM's "encapsulate only on attested recurrence", and the demand signal law 6 says the system, not the operator, should turn into a goal.
- **Output chaining.** A produced shape is offered to open goals that consume it. The existing change-series orchestrator (c24) is the nearest organ.
- **Inference reads the 312 shape descriptions** discovery already serves, and need-phrased entry works with no component name (`9c967329`).

**Builder.** goal-host index is excluded, so the emitter and the inference change are (a). The generator can live in a vessel outside the exclusion set, so it is (b) once the emitter exists.

**Prior attempts.** A grep of `classes/`, `dossiers/` and `mechanisms/` for route-around / routed-via finds no carrier: only the principle (C6/K10, and the operating-model statement in `classes/_principles.json`). The nearest built organ is the in-flight recovery loop (`recommendExcluding`, chunk-13 #24), which never runs its retry branch (327/327 `attempt 1/1` in 72h, capped by `callerPinned`). So this is the one entry without a failed predecessor of the same form. It is **not claimed as new**, because the principle has been stated before. Floor "fixed" was declared on 05-03, 06-25, 07-30, 09-11, 09-12, 09-16 and 09-25, and each was later retracted (§6.2). Demand-counted capability-gap filer (c11) and the change-series orchestrator (c24) are the organs to extend. Inference reading descriptions was named in the goal-walk-floor lens and never wired.

**What must be different.** The counter reads route-around records the walk already produced. It does not read operator dossiers, which is how the five ranks below were chosen (R2-P3). §7 step 1's slice is the test.

**Reduction and partially known cases (amended 10-02).**
- Shape signatures **retrieve candidates**; they do not prove that two concrete inputs are interchangeable.
- A reduced activity preserves its actual dependencies, and distinguishes instance values, variable parameters, preconditions, relevant context, implementation versions and characterized outcomes.
- It begins with the narrow applicability that observation supports. Wider applicability is a hypothesis, tested through variation. Inspectable source evidence is kept when internal steps are encapsulated.
- Reuse the characterized portions and adapt the uncertain connections wherever they occur (§1). Keep useful inputs and intermediate results across retries.
- A mismatch may need information, translation, another consumer, a new composition or changed code. It does not automatically require a new resolver or weaker validation.
- **Acceptance:** a reusable activity keeps its source dependencies, works with changed instance values, and recognizes an incompatible precondition. An internal mismatch can be investigated without discarding the characterized remainder.

### 2.1 Rank 1: one standing expectation evaluator, proven able to fail, that every mechanism must register into

**The capability.** A single graded activity evaluates shaped expectation rows. Each row holds: a fact or joint, the authority it compares against, the copies or readers it checks, the instrument, a must-fail control, a window, an n-floor, an `edit_site`, and a class-2 falsifier. Findings are filed as stable-id gaps that close only when the evaluator re-measures them, and each recurrence increments a lineage counter. Rows and findings are **replicated as evidence to every node**, so no single process is the only oracle (R2-P4, C21).

**Ruling: the home is `self_fact_reconcile`, not `joint-liveness-tick`.** The evidence:
- `self_fact_reconcile` is an activity (L2).
- `development-vessel:self-fact-reconcile-tick` ran 574 times in 7 days with 13 failed (97.7%) on node 1, and `satisfier:self_fact_reconcile` ran 6 times (mechanisms/chunk-01.md:40). It ran 13 times per 24h on node 2 (09-29 05:24Z). An earlier draft's "726 at 97.8%" had no persisted source and is withdrawn.
- It runs a canary positive control, files class-2 `evidence_resolve` gaps that point back at itself, and closes by re-measurement.
- Its header already plans the data form (`selfFactSpec`).

**Known weakness of this home (R1-7), stated.** The lane's own self-fact landings `b585a03`, `04b3e9c` and `a198907` were reverted on 09-27. `b585a03` fabricated the very directory its check looked for, and was closed `landed_verified` (`classes/autonomous-regression.json`). Its closures flap on polarity (chunk-01:40). Five self-fact-divergence gaps sit at reopen_count 23–26 and were closed as `predicate_verified_by_detector` at 09-29 03:51 (`classes/false-verification.json`). This home is chosen because it is the only graded one, **not** because it is trustworthy. Items 2 and 6 exist to contain that.

`joint-liveness-tick` falls short on each point:
- It is a systemd script, not an activity.
- It opens SurrealDB directly (`scripts/substrate/joint-liveness-tick.ts:53-60`), so it is failed and masked on node 2.
- It has no close path: line 74 writes only `status:'open'`, and the same ids are re-filed every 30 minutes.
- None of its gaps carries an `edit_site` or a falsifier.

Its 6 bindings, the `expectation:*` families, the declaration-drift checks, the conservation invariants and MECHANISM-AUDIT's "fired on real traffic within N" rule (its "Reconnect" item 6) all become `selfFactSpec` rows. The tick shrinks to a bootstrap-tier watchdog (C10).

**Builder: (a).** `self-fact-reconcile` has been excluded since 09-27 13:15Z.

**Classes it retires, fully or in part:**
- dormant-mechanism: liveness rows.
- write-read-mismatch: joint rows.
- sync-deploy-drift: copy-vs-authority rows.
- trace-store-db: store-object rows, i.e. declared kind, freshness and budget per object that code reads.
- composition-crystallization: an input-contract row for the extractor.
- docs-drift: claim rows.
- federation-p2p: the far-side reachability witness as a row.
- false-verification: the instrument-control half.

**Prior attempts, and why each did not hold:**

| Attempt | Why it did not hold |
|---|---|
| F4 `check-lifecycle-channels.sh` (05-27) | Never created (checked live 09-29). |
| `closure-audit.ts` (`86186cb4`, 05-27) | Nothing schedules it. |
| `redeploy-on-source-drift` openspec (05-30) | 0/16 tasks. |
| `orphaned_capability_scan` (`1ef8356`, 06-23) | No retire direction. 5 of 51 closed. |
| `edge_liveness_report` (`a6f5b9c`, 08-09) | No scheduler and no gap output. |
| Write-key/read-key agreement detector (08-17) | Never built. |
| `joint-liveness-tick` (`daa2632c`, 08-25) | 1 hardcoded binding for 34 days. Caught 0 of about 180 breaks. Its meta-guard "checked > 0" was satisfiable with 1 binding. |
| Declaration drift (`8636190`/`e85d3ab`, 09-05) | No tick. 0 gaps. |
| Conservation audit (`ad41776`, 09-06) | Deleted by autonomous `3147195` (09-13). Its templates still call the deleted route. |
| `validator-liveness` (`8a3804ff`, 09-09) | Blind to demand-driven validators. `validator-cadence-severed` has been open since 09-18. Masked on node 2. |
| `learning-loop-selftest` (09-10) | posterior_delta is untestable from a deterministic idle probe. "Module not found" on node 2. |
| Expectation-trend / responsibility cycle (09-19/20) | Toy families only. 273 ticks with 0 violations across a day of breaks. `expectation-scan-heartbeat` reads `checked:0` every minute on both nodes. |
| `self_fact_reconcile` (09-23) | Hard-coded fact table. Compares against the working tree, so on node 2 a truncated copy against a truncated source reads as agreement. Its fleet-inventory gap sits at reopen_count 24 while pull-sync refuses on purpose (`substrate-pull-sync.sh:444-457`, `5ddfc7e2`). |
| jointBinding registry (`70254535`, 09-27/28) | Every binding written by the operator. The pool is per-node: node 2 `:8090` returns 0 records while the hub returns 5. |
| `consumer-side-landing-probes` (09-28) | Superseded the same day. 0/7 built. |
| Reuse-before-mint at the mint chokepoint (`900bc69`, 06-26) | Loosened by the substrate for its own detector mints (`7148d37`, 07-12). `producerExistsForShape` has been proposal-only since 08-26 (`classes/composition-crystallization.json`). |
| Runtime-drift watchdog (`63b48175`, 09-13) | Duplicated pull-sync's mirror-to-live under a different shape (`classes/sync-deploy-drift.json`). A shape-keyed refusal would not have caught it. |

**What must be different this time.** Each item is a wiring fact:
1. **One evaluator family, not one process.**
   - An unregistered instrument is refused.
   - A sibling instrument is allowed only as a `variant_of` row inside the evaluator family, graded by Thompson (law 3 variant-first repair, K11, R2-P4).
   - Duplicates are detected by function: the same authority plus the same copies or readers checked. The output shape is not the key, because `63b48175` would have passed a shape-keyed check.
   - The refusal rule is a `selfFactSpec` policy row on an excluded path, so the lane cannot loosen it the way `7148d37` loosened `900bc69`.
2. **Registration is mandatory at landing, with a discriminating control.**
   - Every landing that adds a resolver, timer, script, emitter or table writer must carry a row.
   - The row counts only if the **evaluator**, not the lander, runs its control and it fails on the landing's parent sha (or a deliberately severed copy) and passes on the landed sha (R1-3, R2-P5/P6).
   - A landing that modified its own control's target, fixture or test cannot produce its own verdict. That rule must reject the known cases: `a198907`, `c4bb14d`, `9cfdea4`, `af2c737`, `b585a03` and the 09-28 stale-test gaming (`classes/autonomous-regression.json`, `classes/hollow-landing.json`).
   - Enforcement is a graded **`landing_admission` activity** on the landing path (R2-P10). The `git-hooks-ledger` post-commit hook is a bootstrap-tier observer only.
   - **Precondition (R1-5).** The installer is not committed. At HEAD `5223a5c4`, `setup-git-push.sh` has 0 `ledger` matches (5 in the working tree) and `Dockerfile.substrate` has 0 `git-hooks-ledger` matches (1 in the tree). The live hooksPath exists only because the image was built from an uncommitted tree, which is the sync-deploy-drift class. Commit it, plus a chaining `pre-commit`, before anything relies on it.
   - **Flip to refusal.** The causal-attempt-ledger recorded and never refused, and settled `0a0d59f`/`39783b0` as "held". To avoid repeating that, the flip is a shape (`landingAdmissionPolicy.mode`) with a pre-registered condition: refuse once 14 days of observation show ≥95% of qualifying landings carrying a control that passed the parent/child test, with 0 false refusals on a weekly positive-control landing. The shape is on an excluded path.
   - Earlier history of this item: WHY-THINGS-KEEP-BREAKING recommended "a landing gate on the registered joints" on 09-28, and it was not built. Self-certification at birth failed three times: `verification_spec` 0/6,293; `be26a6b` closure-at-birth, reverted by `8a5223c`; `a198907` log-only reader. The parent/child rule is the concrete difference.
3. **Authority is git objects or a peer, never a working tree.** Examples: `git show origin/dev:<path>`, or the holder resolved by discovery. The node-2 false-clean case proves why.
4. **Rows are replicated as evidence and resolved by shape from every node.** Findings go through the substrateGap shape, which node 2 already resolves byte-identically to the hub (dormant-mechanism lens: 5,040,321 bytes).
5. **Every row has a scheduled must-fail control.** `gate_self_probe` is the existing control runner. It ran 37/37 in 5 days (chunk 00). What it lacks is a reader of its result.
6. **The evaluator is watched by effect, from outside the lane that can edit it.**
   - This is **not new**. Earlier watchdogs failed four ways:
     - the phantom relay watchdog manufactured the outage it existed to catch (`3dbbbeff`, 09-14, `classes/federation-p2p.json`);
     - the gap-compose watchdog logged 3,339 restarts with `ok:true` while `stalled_min` climbed to 241 (raw/live-pool-memory.md);
     - `c71819af` judged success by HTTP status (`classes/false-verification.json`);
     - `self-recovery.timer` amplified outages, restarting activity-api on 09-25 and 09-26.
   - The watchdog's pass condition is therefore **effect**: a must-fail row is refused within its window. HTTP status and process liveness do not count.
   - The evaluator changes only through the gate-evolution path of §7 step 9: a candidate runs in shadow, and the **accepted** evaluator promotes it only if it refuses everything the accepted one refuses. Success in nearby files is never read as permission, and a candidate never judges itself. Earlier drafts said "permanently excluded" and then "human-governed boundary"; both are superseded by the 10-02 user rulings (§10). **Tamper of rows and controls** is covered by item 2's rule applied to the evaluator itself.
   - The remaining risk is an operator edit. It is logged as an L12 intervention.

**Honest note.**
- Items 1, 3, 4 and 5 re-implement known principles.
- Item 2's parent/child control is the only mechanism fact that differs from the three failed self-certifications.
- Item 6 repeats a watchdog with a different pass condition.
- If item 2 and the installer precondition are not built, nothing is different.

### 2.2 Rank 2: the verdict reaches credit, closure and settlement through one reader

**The capability.** Every state-changing "done" (reach credit, `landed_verified`, attempt settlement, posterior update) reads an independent verdict record. No site computes its own.
- **Record:** the existing `goal_verification_label`, keyed by execution_id or landed sha. `labeler` is the instrument, and `grounded` is set only when that instrument's control passed. This is **not** a new shape.
- **Readers to build or repoint:**
  - `activity-api posterior-update.ts` / `propagateCreditAlongChain`. It has 0 reads of `goal_verification_labels` today (R3 re-check).
  - `sweepPendingLandVerifications` in `gap-to-feature.ts`: 25 checked, 0 closed, 23 pending on both nodes.
  - Attempt settlement #2 in `/workspace/attempt-ledger/attemptSettlement.jsonl`. Only 4 of 429 settlements are #2.
- **Readers that exist, cited so that nobody builds them again (R1-17):**
  - `0bd32ff` (07-31) gates credit on `verification_outcome`.
  - psi/successor_value was wired at 6 call sites on 08-17, and its blend stays default-inert (`classes/write-read-mismatch.json`).
  - goal-host `maybeConsumeOracleLabel` (`index.ts:16865`) reads labels, but only for DispatchRecord-keyed goals.

**Three uses of evidence (amended 10-02).** Within the existing trace, verdict and credit paths, evidence is used in three separate ways:
1. **Observation:** a specific consumer used a specific producer output under identified conditions, with an observed consequence.
2. **Learning:** an attributed observation updates one transition's characterization, including uncertainty and applicability.
3. **Acceptance:** accumulated evidence satisfies the requirements of a named action such as delivery, landing, closure or scope expansion.

What follows from the split:
- A terminal verdict is one observation, not the only source of learning. A useful intermediate transition can be observed even when the overall goal fails.
- Actual consumption establishes use, not causal benefit. Comparisons and controlled variations strengthen attribution.
- **The information contract.** The minimum to preserve: source execution and step; producer and consumer identities and versions; actual input and output references; binding; relevant conditions and variation; observed consequence; observation horizon; instrument; provenance. Inspect existing fields and readers before any schema change. This is an information contract, not a mandate for a new store.
- An outcome estimate names the event it estimates, its conditions and its horizon. Unobserved or delayed consequences stay **unresolved**. Consumption, short-horizon success and later failure can coexist without contradiction.
- Later observations extend the history. **A correction names the observation and the derived update it supersedes.** Updates carry stable identities and go through an idempotent ingestion path, so retries and replication do not multiply evidence.
- The existing landing, authentication and closure safeguards stay. An incomplete view cannot certify the unseen outcome. Partial learning does not authorize deployment. A verifier is itself a characterized consumer with tested limits.
- **Acceptance:** one chain with a successful intermediate consumer and a later failure yields separately attributable observations; an unavailable observation does not become a negative outcome; duplicate delivery does not duplicate an update; selection demonstrably reads the resulting characterization.

**The unit of evidence, and what conditions selection (amended 10-03, user review).**

*What is atomic.* The chain execution → closure → grading → trace → learning update is **not** one atomic step. Verdicts arrive late, and some never arrive, so forcing them at exit time produces exit-graded credit. The measured result: arms valued 0.69–0.93 with zero reached rows, ungraded failures charged β, rows graded at insert and again at `/reach`, and hollow walks charged β.
- **The particle.** One immutable execution record. Besides the information contract above, it carries:
  - the **candidate set and the selection propensity** at decision time; today only `candidates_count` is logged, and only on the `/recommend` path;
  - the **code version** of the arm that ran; traces carry none today;
  - the **goal class and the instrument** that judged it (see *Shapes and goals* below).
- **Verdicts are observations attached to that record.** Each names its instrument and its horizon. They accumulate and can be superseded.
- **The learning update is a fold, keyed by (execution, observation), not a step.** Retries and replication then cannot double-count, a re-baseline is a re-fold, and a wrong verdict is retracted by superseding it.
- The particle is the unit of credit. Continuity is the chain: need → output → actual consumption → consequence → changed selection. A walk's verdict is attributed back to its steps. An intermediate step's output being consumed is itself an observation about that step.

*How prior executions condition selection.* They should condition it, as **evidence and never as ambient state**:
- **The selection context is computed from the goal's own execution and its related impulses**, never from the node's shared store. Reading the node's store conditions one run on unrelated runs and is self-reinforcing: arms that run often leave the impulses that select them again. That is the effect-as-cause of law 12.
- **Evidence about an arm is pooled across nodes** (§2.4). The node is a condition only where it changes the outcome, which by law 11 means data locality. That means partial pooling: a global per-arm estimate, with per-node and per-context deviations that move only on evidence.
- **Evidence is grouped by the code version that produced it.** A changed arm's prior evidence is discounted or kept as a separate group. Time decay addresses drift in the world, not code change. One decay rule, not two.
- **Recorded candidates and propensities** let past executions be reweighted (counterfactuals recorded at decision time, law 12). Without them, "this arm is good" cannot be separated from "this arm was the only candidate offered". That confound sits under the Spearman ≈ 0 in §7 step 8.

*Shapes and goals.* A shape names a region of informational state and a goal names a destination plus an acceptance test. The walk compiles a goal into target shapes (`completionShapes`) and backward-chains to them. That is correct for routing, but it is where the shape stands in for the goal:
- **A hollow completion** is the measured gap: the target shape was produced and the goal's test was not met.
- **A satisfier reach** is the target shape already present, with no transition.
- **Credit, reuse and "reached" are keyed by (arm, target shape, goal class), with the verdict's instrument recorded.** Goal class means the parse, the command and the oracle class. Credit is never keyed by arm or shape alone, which averages unrelated tasks that share a generic target such as `fileEditResult` or `shellResult`. Nor is it keyed by `goal_hash` alone, which transfers nothing to near-misses.
- **A learned pathway's signature includes the acceptance class it passed**, not only its input→output shapes. First- and last-mile adaptation reuses a direction **together with** its test class. Reusing the shape signature alone is a learned hollow completion.
- **A hollow cluster over goals sharing surface form is the demand signal** to construct the parse, command and oracle for that class (CLAUDE.md, operator role).

Where this rides: the candidate set, propensity, code version and goal-class keying belong in the verdict→credit reader (WIRING step 3, with the grading fixes). The execution-scoped context is the armed state-signature gap in ias-executor. The pathway signature belongs to extraction (the ribosome mints only from reached executions).
- **Acceptance:**
  - two identical runs, one alone and one beside unrelated concurrent executions, select from the same context;
  - two goals with the same target shape but different goal classes update different cells;
  - an arm's code change opens a new evidence group;
  - a hollow walk and an ungraded exit leave the posterior unchanged;
  - each logged decision can be reweighted from its recorded candidates and propensity.

**Prerequisite ordering (R2-P11).** `grounded` has never been true in 14,125 rows. Making `grounded` settable by a passing control comes **before** `posterior-update.ts` reads labels. Otherwise the new reader reads only abstentions.

**Ruling on the carrier.** `verification_spec` is not revived as a separate key. Its 0/6,293 coverage matches the diagnosis of a fossil that never had a writer. `runBehavioralVerification` (`vessel-mitosis-cutover.ts:2896-2908`) is changed to execute the gap's **class-2 falsifier** (shape + field + polarity). That carrier is already live: 78 class-2 and 47 class-1 open rows at 05:26Z, and 21 gaps closed through `predicate_verified_by_*`.

**This carrier has certified regressions (R1-3), so it is promoted only behind the §2.1 item 2 rule.**
- Class-2 polarity is inverted and flapping.
- Five self-fact-divergence rows sit at reopen_count 23–26 and were closed `predicate_verified_by_detector` at 09-29 03:51.
- The operator reverted `a198907`, `c4bb14d`, `9cfdea4` and `af2c737` as passing-but-regressed landings, and three of them had been closed `landed_verified`.
- The 09-27 containment reopen had falsifier-required, class1/class2-only admission and kept 0 of 8 landings (raw/live-pool-memory.md: "8 autonomous landings: 1 improvement").

Without the parent/child and no-self-authored-control rule, promoting this carrier repeats 09-27. With the rule, the known cases above are the rule's must-reject fixtures.

**Builder: (a).** posterior-update, gap-to-feature and mitosis-cutover are all excluded.

**Classes it retires, fully or in part:** false-verification, hollow-landing, autonomous-regression, calibration-seal, and the credit half of selection-learning.

**Prior attempts:**
- The falsification harness and independent oracles (07-28, `63b7168`/`a4e01cc`): operator-run.
- Recompute and triangulation (`aed9961`): mostly abstains.
- `behavioral-verification.ts` (`399bb2c`): no input.
- The per-class Beta close-oracle (`980135a`): the posterior is never read.
- Class 1/1b/2 predicates and the sweep. Literal predicates can be satisfied by a comment (`80ff131`). Class-2 polarity is inverted and flapping.
- The post-land suite: dead from 08-31 to 09-28 because of the 30 s shell default. Revived by `5e9a0b2`/`fad0d3c`. Its NEWLY-failing withhold has fired 0 times.
- The semantic gate, refuter panel and lenses: they read the diff and fail open when the judge is unreachable (`feature-compose.ts:2283`).
- The causal attempt ledger (`cbdb432`/`a4923f2`/`c89861b`, accepted 09-26). It records and never blocks. It is per node. It settled `0a0d59f` and `39783b0` as "held".
- `consequence-verdict-into-credit` (08-26): no design, no tasks, and marked superseded by the ledger (MECHANISM-AUDIT #6). It is **not** revived (§8).
- The oracle corpus: human labels fell from about 50 per day to about 3 per day. There were 15 in 7 days and none since 09-26 (MECHANISM-AUDIT #6).

**Live defects the reader must not inherit** (verified at HEAD `f451e42` on 09-29):
- Hardcoded `verdict:"FAVORABLE", cited_trace_ids:[]` at `feature-compose.ts:214`, `feature-compose.ts:6878` and `patch-with-tools.ts:239`. `vessel-mitosis-evaluate.ts:1538` returns FAVORABLE `static_checks_pass` with no cited field at all. `:1638` is a correct `INSUFFICIENT_DATA` abstention.
- `behavioral-verification.ts:26` (line numbers per R3, both clones) returns pass when there is no spec. This is the branch that actually fires today, because spec coverage is 0/6,293 and cutover calls the function only when a spec exists (`vessel-mitosis-cutover.ts:2907-2908`). `:27` returns `{ran:false, passed:true}` for any endpoint that is not localhost, so a consumer on another node would also silently pass. That second branch is correct as a finding, but it is secondary.
- `predicateLiteralNotUnique` still arms on catch and reads the decoy `/workspace/git/super-repo/development-vessel/src`.
- goal-host's late-landing check asks for `goal_path_sha`, and discovery answers 404 on both nodes because no producer exists. This is a reader without a writer.
- pull-sync logged 4 distinct `TEST REGRESSION` verdicts: ias-executor `3cf29a3`, dev-vessel `24a64a8`, activity-api `9cfdea4`, activity-api `39783b0`. None reached settlement. `39783b0` was flagged at 22:02:35Z and settled "held" at 22:16:52Z on node 2. It is HEAD on both nodes (R3 re-check) and unreviewed.
- The `directed` key is missing on most intents: node 1 has 18 of 409 carrying it, node 2 51 of 124.

**What must be different.**
1. The sweep's existing reader (`0bd32ff`) is pointed at a verdict that is actually produced: the class-2 falsifier result, under the §2.1 item 2 rule. `posterior-update.ts` gets its first reader of verdict labels, after `grounded` is settable.
2. Settlement is shared evidence, resolvable by shape from every node, and not a per-node JSONL (C21).
3. **`directed` and `author` inheritance moves to the intent writer (R1-14).**
   - Six forwarding attempts inside `gap_to_feature` on 09-22/23 did not raise coverage (`classes/narrowing-duplicates.json`, `classes/directed-overshoot.json`): `bbb83ff` was hollow, `5ec4719` changed the wrong function, and `112e194` closed by measurement for one call path only.
   - Coverage stayed at 18/409 because intents are written by other paths (route-edit, recommit, narrowing) that never pass through the patched call.
   - The difference: every intent writer inherits from its source row, and a coverage row in 2.1 with a must-fail control asserts ≥99% of new intents carry both keys.
   - The operator-identity rule was violated by 199 + 36 + 20 commits since 09-25. Operator lane work goes through an `author:operator` field that the chokepoint (§2.5) writes. A memory rule alone does not do it.
4. Every fail-open branch above becomes an abstain (C5).

If item 1 is not built, nothing is different.

### 2.3 Rank 3: the gap write contract (supply) and the edit derived as data

**The capability.** `substrateGap_write` is the seam that steers the whole repair lane. It gains a content contract **at write**:
- It refuses only placeholder or malformed rows: ids like `{{goal.gap_id}}`/`{{id}}`/`g.id` (10 `{{…}}` ids on 09-29, R3), and status `Open`.
- **It abstains instead of refusing (R1-4, R2-P7).** A row without a verified `edit_site` and falsifier is accepted in a **`needs-localization`** state that is not actionable. It is not refused, so human-reported needs and walk-reported shortfalls stay admissible (law 13).
- A localization and falsifier-derivation activity is dispatched against it, with a **causal check**: the `edit_site` must be the writer or reader of the failing joint, not the victim file. That check exists because on 09-15 an `edit_site` minted from the victim file aimed 4 gaps at the innocent file.
- It derives a canonical identity from (edit_site, defect signature).
- It enriches the parent instead of forking. Narrowing currently resets `failed_attempts` to 0 by design (`gap-to-feature.ts` ~3595).
- It keeps one lineage field, propagates closure along lineage, and counts recurrence across closed rows and store resets. Today 16 narrowed children are open under closed parents, 399 of 430 recommit children point at an open source, and `substrate-gap.ts:460` excludes closed rows.

**Mandatory fields get fabricated, so the fields are verified, not just required.** The earlier attempts that minted false fields:
- `predicateLiteralNotUnique` (`5499f5c`, `classes/false-verification.json`) left gaps closable at birth, because it read ENOENT as absent.
- `self_fact_reconcile` v1 filed self-verifying class-2 gaps.
- The 09-10 truncation minted a nonexistent `edit_site` (`13f7d07`).
- The 09-15 `edit_site` was minted from the victim file.

The contract checks that a carried `edit_site` exists and contains the defect signature, and that the falsifier **fails on the current tree**.

**The edit derived as data (`exactEditSpec`), narrowed after R1-2.** The operator's 80% landing rate comes from the operator choosing both the location **and** the `new` text. A deterministic step cannot supply the `new` text. It can supply the location only where a detector already measured one. Earlier attempts at deterministic location or anchoring:
- **09-08:** verified-unique region arming with anchors mechanically derived from gap text. RCT result 6.8% vs control 6.9%, p=1.0, and 50 mislocalising anchors retracted (`classes/gap-content.json`).
- **08-11:** the anchor supply pipeline, where the model picks an index. Recorded as "supply correct, adherence not".
- **09-10:** `anchor_index` enumerated choice. Dormant (`classes/drafter-quality.json`).
- **`fee458e`:** prefer line-addressed edits. Reverted by `91b11fe` after apply_failed rose from 0% to 66% (`classes/directed-overshoot.json`).
- **09-13, `19bbb8b`/`e670b69`:** grounding rose from 2.4% to 81% while FAVORABLE went from 0/9 to 0/16. The pre-registered falsifier concluded "information placement is not the lever" (`classes/gap-content.json`).

So `exactEditSpec` is **restricted to gaps whose detector already emits an exact byte region**, for example a literal port at a file:line, a `{{…}}` id, or an `env_gate_scan` file:line. The LLM fills only the `new` side. It is measured against a randomised control arm as on 09-08. Without that restriction and control, it repeats the 09-08 null. The apply side already exists as fc-exact / `parseExactEditBlocks`.

**Builder: (a).** substrate-gap and gap-to-feature are excluded. The localization activity is (b) if it lives outside those files.

**Classes it retires, fully or in part:** gap-content, narrowing-duplicates, drafter-quality, calibration-seal (supply), docs-drift (doc gaps are born `falsifier:none`), and memory-recall (the gap-store half).

**Evidence that supply is the binding constraint:**
- 1,625 of 1,837 open gaps (88%) have `falsifier:none` (R3 re-measure, 09-29 ~06Z).
- Admission at 04:49Z was 0 of 863 on both nodes; 1–2 were admitted per tick at other times.
- Operator-specified code edits land 80%; autonomous derivation lands 0.9–4.3% (09-13). The difference is attributable to operator-chosen location and text (above).
- Three bulk closes of one backlog: 06-14, 09-05, and 693 on 09-28.

**Prior attempts at the writer or mint site (R1-1).** An earlier draft said every earlier attempt sat at the admission or picker end. **That was false** and is withdrawn. Writer-side attempts (`classes/gap-content.json`, `classes/narrowing-duplicates.json`):
- Class dedup by volatile-stripped id at write: `c214385`/`c8be5b1` (06-14).
- UUID class dedup plus a K=3 consumption gate in `substrate-gap.ts`: `52810c0` (07-04).
- Preserving `failed_attempts` across re-emission: `486022e`..`bc6daac` (06-30..07-21).
- A write-race lock: `cc0e966` (07-26).
- Stopping route-edit nesting at the mint site: `154390b`/`11ba16d` (08-03). Titles were still nested up to 81 levels on 08-06.
- Closure predicate at gap birth: `be26a6b` (08-30), reverted by `8a5223c` (08-31).
- A 400-char truncation guard at mint: `13f7d07` (09-10).
- Recommit children leading with the parent spec: `206f055b` (09-12).

Admission-side attempts: gap-content §I.1–I.5 (05-30, 06-01, never landed); `admitActionableGaps` and `require_falsifier_classes` (`d7ec192`); falsifier-anchor immutability `80b5e2d`; census high-water `d055f18e`; in-flight dedup three times; mint dedup `1b0c693` (live but unused); the drafter inputs since June; and the operator pre-validated exact-edit method (C4).

**What must be different.** Against that list, the canonical-identity, enrich-parent and failed-attempts items **repeat** `c214385`, `52810c0`, `486022e..bc6daac` and `206f055b`. **I name no structural difference for them.** They are carried only because their failure was never measured by a row, and 2.1 gives them that row. The two facts that do differ from every listed attempt are:
1. **Abstain-plus-localize instead of mandatory fields.** `be26a6b` and `13f7d07` both forced a field at birth and got fabricated values.
2. **The carried fields are verified** (the site exists and contains the signature; the falsifier fails on the current tree).

Also, `gapFromFlatPointer` stops dropping `classification_metadata`, and `substrateGap_write` stops dropping free-text falsifiers (hollow-landing lens).

### 2.4 Rank 4: one address per shape, evidence replicated to every node, with an addressed-measurement envelope

**The capability.**
- **The helper already exists** as `packages/vessel-discovery-client` (`classes/env-gating.json`). Its loopback repair existed in only one consumer (`4fdf5b91`, `classes/endpoint-routing.json`). This rank finishes adoption of that helper; it does not build a new one.
- Consolidating into one helper has broken the floor once: `6c98916` overshot and built invalid URLs at 5 call sites, about 9.8k failures until `5ca51be`. So **every helper change must pass a fleet-wide consumer control before it lands**: each call site resolves one known-present shape through the helper.
- The patterns that work are lifted into it: the discovery-summing reader (`gap-to-feature.ts:4084`) and holder-abstain (`5d0788b`).
- **Replace "one holder per store" with C21 (R2-P8).** Evidence (traces, verdicts, gaps, route-around records, settlements) is replicated over p2p. Posteriors are derived locally or at the hub. On partition, the holder abstains, and a node never reads absence as absence.
- Every `/resolve` answer returns a typed error (unauthenticated / invalid credential / wrong envelope / not the owner / not found / empty) and echoes `resolved_by` and `server_time`.

**Builder: (a)** for discovery, goal-host index and identity (all excluded). **(b)** for call-site migrations in non-excluded vessel files.

**Classes it retires, fully or in part:** endpoint-routing, node-locality, federation-p2p, human-surface-escalation, operator-instrument-fault (system half), credential-hygiene (attach and validate half), memory-recall (address half), goal-walk-floor (vocabulary half), and env-gating (`WORKSPACE_ROOT` split).

**Evidence (09-29):**
- A loopback `:8270` literal is pinned in `development-vessel/src/seed/draft-gap-closing-activity.ts:118` and 8 more dev-vessel src files: 9 in total, re-measured in the live clone at `/workspace/git/vessels/development-vessel` (`classes/endpoint-routing.json` agrees).
- 336 `needs-human-*` escalations were delivered to the replaced stateful-ui `:8270` vessel (grown from 248 on 09-22). None carries an answer there. The surface a human actually reads, `:8310`, never receives them. The uiFeedback log holds 81 needs-human answers ever, 7 of them real operator answers on 09-27 (dossiers/calibration-seal.md:81, human-surface-escalation.md:76).
- `WORKSPACE_ROOT` forks: frozen `/workspace/gaps/gaps.json` (830 rows, last written 09-26 14:06Z), `/workspace/pool/standing.json` (9.7 MB) and `/workspace/memory/notes.json` (both 09-07).
- 1,459 concept-bridge write failures per 24h on node 2, because `CONCEPT_DB_ENDPOINT` is absent.
- System memory holds nothing from before 09-26, and recall ignores the topic (`44ab5fd4`).

**Correction to goal-walk-floor.** The inference vocabulary is **not** node-local. goal-host already unions both peers' `/registry/shapes`. The verified defects are narrower:
- Inference turns requested fields into shapes and drops named shapes.
- Inference receives bare names without the 312 descriptions (now Rank 0).
- The selector's refusal pool (`activities.ts` ~7759) reads templates only: 263 of 994 refusals in 7d named a shape that was being served.

**Prior attempts:**

| Attempt | Why it did not hold |
|---|---|
| vessel-federation spec (05-23) | 0/43 tasks. |
| fleet-federation (05-31) | 0/53 tasks. |
| `DiscoveryRegistrationLoop` (`35eb02f5`, 07-01) | Never adopted. |
| Relay findability / replicate-on-register (`openspec/changes/2026-07-19-relay-findability-replication`) | Items (1) and (3) still absent after 72 days; grep finds no replicate/forward-on-register (`classes/_mechanisms.json`). `holePunchSuccess` = 0. |
| `trace-replication-tick` | One shape, on the node with 0 peers. |
| `packages/vessel-discovery-client` + `4fdf5b91` | The loopback repair reached one consumer only. |
| `asResolvePath` → `6c98916` (09-22) | Overshot; about 9.8k failures until `5ca51be` (09-28). |
| The 13-commit relay recall ladder (08-07..08-17) | Retries around a location problem. |
| Doctor check 4b (`a5dd4b24`) | Runs only when invoked. |
| De-hardcode grep pre-commit gate (`2026-06-25-substrate-root-rename-and-repo-hygiene`) | 0 tasks checked. |
| Operator law "a negative is unattributed until a positive control shares its address" (09-15) | Violated within the hour. |

**What must be different.**
1. **The literal-port lint runs pre-land in `vessel-mitosis-evaluate`, not post-land (R1-8).** A post-land failure depends on a revert reader that does not exist: pull-sync TEST REGRESSION never reached settlement, and the withhold fired 0 times in 72h. Pre-land refusal needs no reader. This differs from the 06-25 de-hardcode plan in placement (the landing path, not a hook that is inert on both nodes).
2. The fleet-wide consumer control before any helper change is the fact that would have stopped `6c98916`.
3. **Write federation: no difference named.** It is the 07-19 proposal, unbuilt after 72 days, and I do not know what unblocks it. It is ordered after §7 step 1's slice, which shows whether a node-2 write is actually needed for the slice. Until then, evidence replication (C21) is the carried item, and write federation stays a proposal.

### 2.5 Rank 5: non-production runs are sandboxed, and artefacts are admitted with a reader and retired without one

**The capability.**
- **Sandbox.** Every non-production run goes through one sandboxed-run primitive: a private root and tmp, no live env, sockets or credentials, a residue manifest, and a canary positive control. The primitive exists in dormant form as `scripts/substrate/run-isolated-verification.sh` (09-14), untracked and with 0 callers. **Under the script-retention law a script is not trusted until an activity validates it (R2-P10).** It is therefore committed, then wrapped as an advertised `sandboxedRun` shape with a canary row in 2.1, before it is called "the sole runner".
- **Commit chokepoint.** Every autonomous commit passes the `landing_admission` activity (§2.1 item 2). It stages only source trees that have a reader, and refuses emit, cache, state, leases, `{{…}}`, paths outside `ALLOWED_TOPLEVEL_DIRS`, and new behavioural env reads. It writes `author`. The `git-hooks-ledger` hook observes only, and it depends on the same installer precondition as §2.1 item 2.
- **Retirement.** One compost activity drives the existing `activity.retired` primitive and its peers.

**Builder: (a)** for `scripts/substrate` and mitosis-evaluate (both excluded). **(b)** for the compost activity's non-lane parts.

**Classes it retires, fully or in part:** test-residue-live-state, codebase-bloat-fossils, env-gating (landing half), and directed-overshoot.

**Evidence (09-29):**
- `vessel-mitosis-evaluate.ts:263` still spawns `bun test` with the full live env.
- `f451e42` moved the test leak into a tracked push-clone file.
- `/workspace/doc-fix-policy.json` was set to `autoland:true` by a test (09-28 21:18Z).
- The placement gate is inert on both nodes: `core.hooksPath=/usr/local/share/substrate/git-hooks-ledger` holds no chaining `pre-commit` (R3 re-check).
- `edc68d49`/`e72a7fc8` committed `leases/` and `state/`.
- The rhythm self-maintenance goal produced at least 11 residue commits, each graded a success. Its hold's `lift_when` names a nonexistent step.

**Prior attempts:**
- Placement hook, three installs (`ab4af9bd`, 08-11 hand-install, `d993b331`): never on the effective hooksPath.
- Script prunes: `8d3e57ce`, `1150750f`, `008f3ab9`, `e375d716`.
- Success-rate retirement sweep (`7f3a81f`→`66b95e1`): retired 21 working arms.
- **The hourly light-dispatch retire sweep exists and is 401-blind.** `retireNeverSucceededTemplates` (light-dispatch `src/index.ts:165`) lists templates with the Bearer scheme: Bearer→401, ApiKey→200, "covered 0/0" logged 89 times since 09-25 (`classes/endpoint-routing.json`).
- `checkAndRetireByPosterior`: reachable only via `POST /executions`. 0 poor-performance retirements. `scaffold-and-publish-vessel` stands at 1/8,022.
- The coherence-recover hourly dedup (`6b21bf4e`, 06-20): treated the symptom.
- The 08-29 hermeticity sweep and `env -i` at 4 call sites (`ea07298`, `f451e42`).
- `self_interference_scan` (09-13): its remedy was refused by the gate it diagnoses.
- The operator cleanup chain (`66ba773` and others): it deletes output and leaves the generator.

**What must be different.**
1. One runner, wrapped as a shape, and a canary that proves it is the only path.
2. The chokepoint is an activity. The hook is an observer (installer committed first).
3. **The retire gap is restated (R1-9).** A caller already exists. The missing facts are that the sweep uses the wrong auth scheme, and that its predecessor's criterion retired working arms.
   - Fix the scheme first.
   - The criterion becomes posterior-based and is held as a policy shape, not an in-process constant (L1): for example, retire when P(success) < 0.05 under Beta(α, β) with α+β ≥ 30.
   - It has a must-fail control: a known-working arm that must **not** be retired in any sweep.
   - The caller stays the existing hourly loop. The rhythm conductor is **not** named as caller, because §3.3 marks its disposition broken (R2-P11).
4. The drift-commit generator in `rhythm-conductor-tick.ts:126` is removed at the source, not held.

### 2.6 What the ranks do not cover, and where it rides

- **The redispatch livelock (R2-P12).** This is current and is the clearest live case of "same issue, same reason".
  - Since 09-22, 2,248 of 2,256 node-1 dispatches (99.6%) went to 3 gaps, alongside 246,254 `compose_skipped_cooldown` and 180,114 `compose_skipped_inflight` actions.
  - Node 2 dispatched the same two gaps 550 and 88 times on 09-28.
  - The 09-25 `remedy-livelock-*` gaps failed (raw/live-pool-memory.md).
  - The headline case (`0ee592d0`) came from one gap-to-feature family sampler firing every ~14 s on a `falsifier:none` gap. So it rides on 2.3 (such a gap is `needs-localization`, not actionable) **and** on value-per-cost task 3.4, a hold checked at dispatch entry before any dispatcher-side sampling.
  - It gets its own exit (§7 step 4) and builder: gap-to-feature is excluded, so (a).
- **Selection decision provenance** (selection-learning). The logged belief is VPM/CTS alpha plus hand-coded boosts (`activities.ts` ~6725–6860: tagBoost up to +10; `historyBoost` = executions/20). These are in-process constants (L1), and `posteriorSource`/`context_blend_weight` are not logged. Log store, key and blend, and move the boosts into shaped policy. It rides on 2.2 and 2.1, and is **not** a fourth key contract. Three already exist and are bypassed: `normalizeActivityId`, `posterior-aggregator.ts` `1540053`, the evidence-aliasing lint `c851cbbb`.
- **Composition keyed by `goal_hash`** (composition-crystallization). Found 09-05 and re-found 09-16. The key changes to shape signature. The extractor's input contract is a 2.1 row.
- **Workaround records (amended 10-02).** A route-around (§2.0b) is recorded by the **unmet consumer requirement** and its relevant conditions, as well as by the missing or failed producer. Recurrence supplies demand, but frequency alone does not show that the workaround is effective or worth encapsulating.
- **Trace-store poison set.** Five fixed firstIds fail 74 times a day each. `v_paradigm_execution_traces` (2 rows) is read at 35 sites in 11 files. These are 2.1 rows, plus moving `queryRaw`'s status check into `query()` (`676c3f3` taken to its seam).

### 2.7 Class → capability map

| Class | Rank |
|---|---|
| goal-walk-floor | 0 (route-around, descriptions, need entry) + 2.4 (vocabulary) + 2.1 (floor-parity row) |
| false-verification, hollow-landing, autonomous-regression, calibration-seal | 2.2 (with 2.1 controls) |
| dormant-mechanism, write-read-mismatch, sync-deploy-drift, trace-store-db, composition-crystallization (input) | 2.1 |
| gap-content, narrowing-duplicates, drafter-quality | 2.3 |
| docs-drift | 2.1 (claim rows) + 2.3 (predicate at birth) |
| endpoint-routing, node-locality, federation-p2p, human-surface-escalation, operator-instrument-fault, credential-hygiene, memory-recall | 2.4 (memory-recall also 2.3) |
| selection-learning | 2.2 + 2.1 |
| spend-envelope-throughput | 2.3 + value-per-cost 3.4 + §7 step 4 |
| test-residue-live-state, codebase-bloat-fossils, env-gating, directed-overshoot | 2.5 |

---

## 3. What to keep: the core toolset, and how each becomes available

### 3.1 Counts (method stated)

Across 55 mechanism chunks (1,642 collector items, deduplicated per chunk), there are two tallies:
- **Lower bound:** rows with a numeric index, which cover 30 of the 55 chunks: keep-general 203, keep-specific 84, revive-general 27, fossil 91, broken 55, duplicate/merge about 35, unknown 5.
- **Upper bound:** all table rows in all chunks: keep-general 339, keep-specific 133, revive-general 51, fossil 168, broken 115, merge-into 55, duplicate-of 35, unknown 17. This tally is inflated by merge tables and by rows that carry two verdicts.

The true figures lie between the two. Several chunks corrected stale collector claims against live evidence:
- `gate_self_probe` ran 37/37 in 5 days; it was not "executed once".
- `docs_align_tick` does run.
- 33 of 55 `expected_literal` gaps are substrate-detected.
- Mitosis overlays are being GC'd.

### 3.2 What "available" means

A mechanism counts as available only when all four hold:
- **(a) Advertised:** it is a shape registered by the three-place rule (`config.ts` plus `routes/impulses.ts` plus discovery).
- **(b) Selectable:** it has an activity row that Thompson can select and traces can grade.
- **(c) Recalled:** it is a concept that the drafter recalls at prompt-build.
- **(d) Watched:** it has a liveness row in the 2.1 evaluator.

In-process gates can't satisfy (a) or (b), so they get (c) and (d). Bootstrap-tier units (C10) get (d) only.

### 3.3 The core toolset, grouped by the capability it serves

| Group | Keep (verdict source) | Availability today → needed |
|---|---|---|
| **Floor and walk (Rank 0)** | ReAct floor `universalToolFallback` / `runGroundedToolLoop` (c11, c13; tool use not measurable by the current counter, §1); learned-pathway reuse `recordGoalPath` / `recommendReachingPath` + Wilson ranking `785293c` (c13, c17); pathway reuse by shape_signature (c11); `inferGoalTargetShapes` (c13; must read shape descriptions); satisfier plane (c11, c13); `walk-concepts` recall (c13); slot binding + `{{shape}}` interpolation (c11); ribosome `mintReachedTrace` + grounded mint gate (c13); auto-bridge + mint governor (c11); reuse-before-mint gate (c11, c27); `distribution_policy` producer pick (c11); llm-router cascade (c13); demand-counted capability-gap filer (c11); change-series orchestrator (c24) | (a) and (b) for most → route-around emitter and chaining |
| **Evaluator (2.1)** | `self_fact_reconcile` (c01); expectation scan / responsibility cycle (c00, c06); joint-liveness detector, to become rows (c08); `gate_self_probe` as control runner (c00); detector-yield registry (c07); `trace_failure_pattern_report` `reason_contains` (c15); `edge_liveness_report` (c15); model-reality audit (c00, c19); self-operational-health (c19); `substrate-doctor`/`ready` (bootstrap, c19) | (b) for the first; the rest are scripts or in-process → rows with controls |
| **Verdict and credit (2.2)** | `goal_verification_labels` corpus (c11, c15); 17 deterministic `verify*Reach` oracles (c14); reach gate `verifyGoalReached` + hollow beta-penalty (c13); honest-reach `classifyReach` (c15, c17); citation oracle (c11); `landedCommitVerdict` / `sweepPendingLandVerifications` (c00, c08); close predicates class 1/1b/2 (c00, c10); `classifyFalsifier` (c05); post-land suite + `computeNewlyFailing` (c00, c06, c10); causal attempt ledger + git hooks (c06, c19); revert-aware `shaWasRevertedInAnyClone` (c07; blind to reverts that name no sha); failure memory by goal_hash (c11, c36); TD(λ) `propagateCreditAlongChain` (c17); real Beta sampler `d69a4ad` (c13); VPM/CTS belief stores (c15, c17); `0bd32ff` credit gate; psi/successor_value (08-17) | Readers missing → `grounded` settable first, then the readers |
| **Gap lane (2.3)** | `decomposeGap` (c00; exposed as a `gapDecomposition` shape); `gap_lifecycle_scan` (c00; expiry carries `close_basis:"expired"`); falsifier-anchor immutability `80b5e2d` (c00); feature_compose lane + fc-exact EDIT path + stub / zero-behavior-delta detectors (c00); `admitActionableGaps` (c07); premise check (c08); gap clustering (c00); `autonomous_pick` lease (c00, c07, c08) | Mostly in-process → concepts plus the write contract |
| **Store and trace (2.1 rows)** | `execution` as sole trace store + `trace_store_counters` + lease-gated reconcile (c00, c15, c28); `execution_trace_content` (c28); trace digest / exemplar (c15); migration runner + `init_migrations` (c17, c28); `QuerySemaphore` / `queryRaw` (c15, c28); DB-admin repair catalogue + backup rail (c17) | (a) partly → store-object rows |
| **Deploy (bootstrap tier)** | pull-sync + mirror-to-live + `.last-good` + owed restart (c06, c10, c18); bump-submodules + image build (c06); vessel-ctl manifest install (c06, c37); bootstrap seeder + `seed_version` upsert (c00); placement pre-commit + gitleaks (c37; to be put on the effective hooksPath, installer committed); committer attribution `_record.sh` (c37) | Unit only → a shaped `deploy_convergence_report` per tick, and a copy-vs-authority row |
| **Admission and pace** | Rhythm conductor `timeShapedRhythm` (c00; **broken disposition**: needs per-family skip reasons and a code seeder for its registry before it can be any rank's caller); spend envelope + `autonomyScope` (c00, c07, c10); compose slots (c06); goal coalescing (c06, c11); maintenance leases (c10, c17, c33); boredom UCB1 + condition fold + gap-goal supply (c24) | (a) partly → a hold read at dispatch entry; C20 quarantine shape |
| **Memory and knowledge** | Memory retire primitive `19ae84e` (c36); session-start hook (c37; pins `localhost:18090`, fix it); concept-db recall (c21); tuning-param seam `substrate_tuning_param` (c17; promote to an advertised shape) | (a) → fail-closed read, replicated evidence |
| **Surfaces and federation** | Auth validation cache + reason-bearing 401 (c23 M6); `auth_token_source` (c23 M7); LLM spill chain (c07); participation journal (c54); `packages/vessel-discovery-client` | → the 2.4 envelope |

### 3.4 Revive-general (27 numbered rows): each needs a named caller, or it stays a fossil

| Mechanism | Caller it must get |
|---|---|
| `env_gate_scan` (c00, c07) | An existing scheduled loop (not the conductor until it is repaired); gaps carry the file:line it already finds, which qualifies them for `exactEditSpec` |
| `reach_rate_scan` / `detect-reach-rate-shortfall` (c00) | Fix its 09-28 19:36 failure; schedule it; split by author and by tick vs need-phrased |
| `self_interference_scan` (c01) | Becomes the canary half of 2.5 |
| `perf_canary_resolve` (c01) | Post-land verification seam |
| `causal-adjudication` reader half (c05) | 2.2 reader |
| Registration replication (c06, unbuilt) | 2.4 evidence replication (write federation stays a proposal, §2.4) |
| Unregistered dev resolvers: behavioral-verification, causal-adjudication, region-probe (c07) | Three-place registration |
| docs-align family (c07) | 2.1 claim rows; `docs/` land path in `deriveVesselFromPath` |
| `state_signature` key, `producer_count` scan (c07) | 2.1 rows |
| Behavioural verification `399bb2c` (c10) | 2.2, reading the class-2 falsifier behind the §2.1 item 2 rule |
| Lexical / Tier-2 rebind `tryLexicalRebind` (c11) | The middle tier: adapting uncertain connections (§1, §2.0b) |
| Missing-verifier-gap filer (c13) | 2.2: a class without a verifier files for one (K3 bound) |
| `gradeArmByExecution` (c13); in-flight recovery loop and re-route arm (c13, c41) | Rank 0 |
| Decision-level credit `decision_outcome` (c15) | 2.2 reader; the joint is severed (gap open 09-27) |
| Variant minting on 3 consecutive failures (c15) | Family sampler; bounded by the June-July storm lesson (§4.2 step 3) |
| Successor features walk read (c15); `groupedExecutionStats` livelock sensor (c15) | Rank 0 / 2.1 row. `grouped-execution-stats.ts` reads the dead view |
| Federation evidence fold `replication-pull.ts` (c16) | 2.4 (C21) |
| Poor-performance retirement `checkAndRetireByPosterior` (c17) | 2.5 compost driver, with the §2.5 item 3 criterion |
| `identical-failure-run-tick` (c19) | Never given a unit → 2.1 row |
| `run-isolated-verification.sh` (c19) | 2.5 `sandboxedRun`; commit it first |
| Change-series orchestrator (c24) | Rank 0 output chaining; C3 |
| conservation-bridge-tick (c27) | Only after its source route is restored as a 2.1 row |
| `queryRaw` → default `query()` (c28) | activity-api, plus concept-db and identity-vessel |
| `approach_feedback_scores` (c28, conditional) | None as a table. First try an `approach` field on `goal_verification_label` (law 3) |
| `substrate-vessel-edit-gate` hook (c37) | Operator path into the attempt ledger |
| External-oracle harness *method* (c20) | Known-answer fixtures become deterministic oracle rows at `verifyGoalReached` |

---

## 4. Fossils and duplicates: counts, and an organisation that keeps history without competing

### 4.1 Counts (09-29, node 1 unless stated)

- **Mechanisms:** 91–168 fossil verdicts, and about 35 duplicate-of plus 55 merge-into (§3.1 method).
- **Activity pool** (hub, 04:40–05:00Z; R3 re-check):
  - 4,010 activities: 1,228 retired, 1,241 deprecated, 131 minted since 09-01.
  - 131 mint-dedup groups with 1,012 duplicate rows.
  - 70 `activityExecutionSummary` producers, 68 active, minted 05-30..07-01.
  - VPM has 6,744 arms. 3,503 (52%) sit at exactly Beta(1,1), and 58% of 7-day selections went to arms with α+β ≤ 4.
  - 586 `<name>-<ts13>` variant rows from the June-July variant storm, 545 never executed (raw/live-activities.md:55).
- **Selection residue:**
  - The six conservation-auditor templates call a deleted route.
  - `learned-satisfier-substrategap-write` is at 132/0.
  - `learned-auto-bridge-problem-detection-1r2k9x` references an unregistered resolver ×305 (09-28).
  - Three operator experiment variants of trace-store-reconcile (`-lease-ttl-120s` 171/23, `-release-before-verify` 166/19, `-swap-timeout-15min` 19/3).
  - `scaffold-and-publish-vessel` stands at 1/8,022 and is not retired.
  - ribosome-extract: 1,788 executions in 7 days, all `execution_error`, pinned to a retired template (MECHANISM-AUDIT #4).
- **Tracked residue at super-repo HEAD `d03d1a9e`** (04:40–05:00Z):
  - `validation/failure-modes` 3,342 files;
  - `.d.ts`/`.map` outside repos 615;
  - `.js` with a `.ts` sibling 177;
  - `openspec/changes` top-level stray files 77;
  - `Substrate/` 68;
  - `leases/` 2;
  - 4 root files.

  The node 1 clone has 1,626 untracked entries, including `{{target_path}}`.
- **openspec (re-measured).** `openspec/changes` has 176 entries: 98 unarchived change directories, the `archive` directory (4 archived changes) and 77 stray files. An earlier draft counted all 176 entries as changes. Proposal-only or dormant changes include `consequence-verdict-into-credit` (superseded), `reuse-before-mint-crossfamily-dedup`, `cross-vessel-wiring-repair`, `escalation-disposition-executor` and `redeploy-on-source-drift`. `causal-attempt-ledger` is at 0/36 tasks while it runs.
- **Runtime residue:** 47 parked landings with no resume, newest 09-26; 11 mitosis dirs; 14 orphan `gaps.json` tmp files; `/workspace/tmp` at 624M; `landability_predictions.log` at 11.1 MB with no reader (`gap-lifecycle-scan.ts:359-412`).
- **Frozen stores:** `/workspace/gaps/gaps.json` (830 rows, 09-26), `/workspace/pool/standing.json` (9.7 MB, 09-07) and `/workspace/memory/notes.json` (09-07). Each is a mis-address trap for any measurer (K4).
- **DB:**
  - `activity_execution_traces` has 18,135 July rows.
  - `v_shape_pattern_performance` has 0 rows, and `v_paradigm_execution_traces` has 2.
  - 425 July blob files total 14.8 GB of the 46.0 GB, with `enable_blob_garbage_collection=false`.
  - `init_migrations` has 225 rows and 224 distinct names.
- **CI:** Weekly Recommendation Validation failed 20 of 20 runs (05-18 → 09-28, `METABOB_API_KEY` unset).
- **Docs:** see §5.

### 4.2 Organisation

**The blocker.** The mechanism chunks propose `archive/fossils/<area>/<name>` 119 times. `archive` is not in `ALLOWED_TOPLEVEL_DIRS` (`scripts/git-hooks/pre-commit:74-85`). A copied tombstone tree is also bloat in itself (K7). The convention is not adopted.

**Ruling: history is git plus the retire primitive. It is not a directory.**

1. **Code and scripts.** `git rm` in a traced commit whose message names the fossil, its class key and its last live sha. Any index is one derived-cache file under an allowed directory (C11).
2. **Activities and resolvers.** The existing `activity.retired` primitive, extended to carry `retired_reason`, `last_sha`, `class_key` and `superseded_by`. Retired rows stay queryable by shape for history.
   - **Preconditions (R1-10):** exclusion from selection is **not** in place today.
     - Pinned-id dispatch bypasses it: the ribosome ran 1,788 executions in 7 days pinned to `targetTemplateId: ribosome-extract`, which is absent from the catalogue (MECHANISM-AUDIT operational findings).
     - `activities.get-activities-with-tiered-fallback.ts` has 0 occurrences of `deprecated`, a gap open since 08-02 (`classes/docs-drift.json`).
   - The recommend path, `discover-by-shapes`, the satisfier pick **and pinned `targetTemplateId` dispatch** must all honour retired/deprecated, each proven by a 2.1 row whose must-fail control dispatches a retired id and expects refusal.
3. **Variant-of, decided per row (R1-16).** A duplicate is kept as `variant_of:<canonical>`, competing only inside its family's Thompson draw, **only if it has its own execution evidence and a distinct hypothesis**. Everything else is residue and is retired. Applied:
   - **Human-originated experiments (amended 10-02).** Autonomy attribution and evidence quality are separate questions. Operator-authored work never counts as autonomous authorship, but it can supply useful observations. Evidence keeps its author, intervention, experimental conditions and source execution. Benchmark and synthetic outcomes stay distinguishable from operational ones, and their estimates are not transferred without an applicability argument. Existing experiment isolation requirements stay.
   - The three trace-store-reconcile experiment variants are **operator interventions**, recorded as L12 interventions and excluded from autonomous-achievement counts and from the lane's denominator. Each is **reviewed on its own hypothesis, applicability, evidence, duplication and cost**, not retired for its human origin alone. One that holds a distinct, supported hypothesis can stay as `variant_of`; the rest are retired. Retiring an executable variant does not erase its experimental history. Unsupported duplicate proliferation is still a defect. This agrees with §6.2.
   - **Acceptance:** autonomous-achievement counts exclude operator work, while an applicable experimental result can still influence selection with its provenance intact.
   - The 70 `activityExecutionSummary` producers are a consolidation target for `reuse-before-mint-crossfamily-dedup` (§8). The canonical one keeps its posterior. Any with executions and a distinct resolver becomes `variant_of`, and the rest are retired.
   - The 545 never-executed storm variants are retired outright. That storm is the reason §3.4's "variant minting on 3 failures" is bounded.
4. **Fixtures and methods.** Harness fixtures with known answers become deterministic oracle rows before their scripts are removed.
5. **Stores.** Frozen twin stores are made read-only, and every reader is repointed before deletion. July blobs are reclaimed only after a backup rail snapshot, never by hand-editing the DB.
6. **openspec.** Each of the 98 unarchived changes is reconciled against landed state, then archived or marked superseded with the absorbing change. The 77 stray top-level files are removed.
7. **Driver.** Steps 1 to 6 are output from the 2.5 compost activity, chained into goals (Rank 0 chaining). A cleanup that is not chained teaches nothing (L6).

---

## 5. Realigning the docs

Every doc correction so far has been operator-first. The docs-drift dossier and reports-4 give "112/113 doc commits operator-authored" **without a stated window**, and I could not recover one. `git log -- docs` shows about 309 commits over the repo's life (R3 count). One of them is by Substrate Autonomous (`4e4170a8`, 09-07), and it is drift-commit residue, not a doc edit. So the defensible claim is: **no substrate-authored doc edit has been found**. The last operator doc commit was `b7ea55fa` (09-24). The fix below is mostly the path, not the text.

**Contradictions with the canon or with reality:**

| Doc | Problem | Fix |
|---|---|---|
| CLAUDE.md "One file per goal" | A workaround, not a principle (C3) | Keep until Rank 0 output chaining exists, then remove |
| CLAUDE.md law 2 "Behaviors are activities" | Silent on versioned resolvers used first (OM) | Adopt K11 wording (C7). Same change in `IMPULSE_ACTIVITY_FOUNDATION.md` |
| CLAUDE.md script retention / bootstrap tier | Does not name the kill switches and self-observation watchdogs | Name them, each with an attempt budget and an effect-judged pass condition (C10, §2.1 item 6) |
| CLAUDE.md "Direct edits are gated … fails open" | Not marked as a convenience hook | Add the C5 rule |
| CLAUDE.md port anchors, profile table | Port values are caches (C11) | Keep as invariants; values are queried |
| CLAUDE.md "Placement … only enforces once installed" | True, and inert on both nodes | Commit the installer and fix the hooksPath, not the doc (2.5) |
| `IMPULSE_ACTIVITY_FOUNDATION.md:699` | Tests vs activities-as-tests | C19 ruling |
| README 318–324 | Prescribes `repos/obsidian-vessel/install.sh`; the served surface is human-surface-vessel | Rewrite |
| README:480 | Carries the `applyExtraction=false` ribosome correction that CLAUDE.md does not | Reconcile in one place |
| `docs/API_V2_ACTIVITY.md:22` | k8s `svc.cluster.local:8080` URL | Retire |
| Retired-CLI guides (ACTIVITY_TASK_CONTEXT_PROPAGATION, INTERACTIVE_ACTIVITIES, CONCEPT_INTEGRATION_TEMPLATES, DASHBOARD_ANALYTICS, EXTERNAL_VALIDATION, IDENTITY_VESSEL_CURL_EXAMPLES) | Describe surfaces that no longer exist | Retire |
| `docs/guides/{HUMAN_PROJECT_LIFECYCLE,CONTAINER_NETWORK_LIFECYCLE,SYZYGY_LOCAL_SURFACE}.md` | Untracked, yet linked from the modified `docs/README.md` at :134, :149 and :150 (re-measured) | Commit them or drop them; never link untracked files |
| MDP / DEC / REPRESENTATION / NETWORK / FLEET / LITERATURE lens docs (~4.9k lines, ~0 code hits) | Recalled as principles | Demote from drafter context to theory |
| Docs citing the 3 missing paths (`scripts/check-shape-dispatch.ts`, `scripts/init-database.ts`, `scripts/validate-security.sh`; re-checked absent) | Named 09-14, still cited | Rewrite the citations. `repos/deployment/scripts/generate-secrets.sh` exists and is tracked; an earlier draft wrongly listed it |
| Any "landing is solved" / "deploy boundary closed" / "fixed" claim | Retracted by later evidence (C23) | Remove. Status is a cache |
| 98 unarchived openspec changes | Dormant proposals read as live plans | §4.2 step 6 |

**The mechanism fix is the 09-22 docs-self-management assessment, not new (R1-11).** `validation/reports/docs-self-management-assessment-2026-09-22/REPORT.md` lines 115-131 listed seven gaps in dependency order, and **none was built in the 7 days since**. Mapped:

| 09-22 gap | Carried as |
|---|---|
| 1. No targeted super-repo land path | `deriveVesselFromPath` gains a super-repo `docs/` land path. This comes first; every downstream fix is moot until then (the 09-22 ordering stands) |
| 2. Detector has no behavioural oracle | Claims stored as predicates (path-exists, command-exit, shape-advertised, identifier-present, route-status) as 2.1 rows. Doc gaps born with that falsifier; today all 25 open `documentation_drift` gaps are `falsifier:none` |
| 3. `walkScripts` false positives | The truth set becomes "exists anywhere in the super-repo, or advertised via discovery". `docs-align-tick.ts:577-578` walks `scripts/` only, so 14 of 18 "missing" paths exist |
| 4. Category marked hopeless (11/0 calibration) | Reset calibration after 3 |
| 5. Reap refusal permanent and silent | Churn-relative reaping; today it refuses 606 candidates every run |
| 6. No doc-scoped reader | **The runtime reader is named here:** the 2.1 evaluator reads the claim rows, and concept-db recall filtered on `doc_expectation` at prompt-build reads the doc concepts. Without the second, doc concepts are an archive |
| 7. Two docs claim the unwired closure design | Covered by the "fixed claims" row above |

Plus two items that were not in the 09-22 list: install-acceptance switches from report-only to judging (runs `36505437797`, `36465457622`, `36457698723` concluded success while logging `usable=fail`), and the test-written `/workspace/doc-fix-policy.json` is reset.

**Earlier claim-as-predicate attempts, and the difference (`classes/docs-drift.json`):**
- On 07-01, `SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md` set out 7 falsifiable claims watched by docs-align-scan. The status lines drifted within a day.
- On 08-28, the docs-align accuracy invariant was enabled, reverted on 15 false findings, then re-enabled.
- `doc_expectation`/`architecture_doc` ingestion produced 1,991 rows, about 507 of them stale, with no retirement field and no reader.

The only difference claimed is that the claim rows are evaluated by the same evaluator with must-fail controls, and closed through the gap falsifier path. The docs-drift dossier found that no earlier attempt joined at that seam. If gap 1 (the land path) is not built, there is no difference.

Law 9 stands: docs hold invariants and failure modes only.

---

## 6. Realigning ourselves (operators and assistant sessions)

### 6.1 Operating mode

1. **Search before building. The search includes specs, retired rows, superseded proposals and earlier syntheses.** For every proposal, name the existing organ it extends and the earlier attempt it repeats. This document's first draft failed that rule 19 times (Review disposition, R1).
2. **Route around, record the route-around, and encapsulate only on attested recurrence** (OM, C6, Rank 0).
3. **The operator lands only what restores the system's ability to land its own fixes** (#1184, C9), item by item, with the builder label (§2.0). Operator commits carry operator identity.
4. **Every negative needs a positive control through the same address first** (K4). This document's own `tools=0/0` claim broke that rule (§1).
5. **Verify at the consumer, in the executing artifact** (K5).
6. **One change per window**, recorded as an intervention (L12). Holds and masks carry a TTL shape (C20).
7. **A session's output is not done until it has a runtime reader.**

### 6.2 Anti-patterns observed, with evidence

| Anti-pattern | Evidence |
|---|---|
| **Instrument faults reported as system facts** | 25 declared-then-retracted operator measurements, 08-28 → 09-16. The 08-08 audit found 8 of the operator's own measurements wrong. The class law, written 09-15 23:59, was violated within the hour. This document's first draft repeated it (`tools=0/0`, the 30.8% "reach", the unsourced 726). |
| **Laws written to memory with no runtime reader** | "Negative unattributed" was learned at least 10 times before it was written (#1203). WORKING_SYSTEM_EXPECTATIONS: "asked seven times, answered seven times in prose". |
| **Operator changes validated locally, overshooting fleet-wide** | About 45 operator or directed commits and 6 same-day correction chains. On 09-22, 19 goal-host bypass commits each corrected its predecessor. `ca53600` and `5598853` silently undid 12 and 7 landings. `6c98916` overshot at 5 call sites. |
| **Operator work indistinguishable from autonomy in git** | Since 09-25: 199 dev-vessel, 36 goal-host and 20 activity-api lane commits authored "Substrate Autonomous", operator exact-edits and reverts included. Reverts `12c7d9a`, `37d0f72`, `4068e7e` and `d3dd218` name no sha. |
| **"Fixed" declared without measurement** | Goal-walk floor "fixed" seven times. "Deploy boundary closed" (07-21). "Landing is solved" (09-02/03). Stale-base revert "closed" 08-28, recurred 09-14, 09-24 and 09-26. |
| **Hand-completing the loop's work** | Three bulk closes of one backlog (06-14, 09-05, 693 on 09-28). Operator cleanups delete output and leave generators (`66ba773`). |
| **Holds and masks used as the retiring mechanism** | rhythm-self-maintenance is held on both nodes with a nonexistent `lift_when`. 35 timer unit-files are masked on node 2 (R3 re-measure), including joint-liveness, validator-liveness, learning-loop-selftest and learning-liveness-probe, so node 2 has no store or learning health check. `autonomyScope` was widened and re-tightened twice in 48h by record edits. |
| **Specific paths instead of seams** | The 09-28 lane-core patches. Resolve-URL fixed at 11 sites separately. Pull-sync coverage extended one artefact type at a time. |
| **Rediscovery presented as a finding** | 3 in 7 findings are rediscoveries (#960/#1202). MECHANISM-AUDIT: "every mechanism has been built at least once". This sweep's dossiers re-proposed existing organs (§2.0), and its first synthesis re-proposed §5 from 09-22. |
| **Experiments contaminating the lane's own denominator** | The three trace-store-reconcile operator variants are live arms; they are excluded from autonomous counts and reviewed per hypothesis under §4.2 step 3 (amended 10-02: human origin alone is not a reason to retire). Probes wrote residue into learning state. Battery residue flooded memory: 578 of 1,077 live notes (09-22). |
| **Assistant-session durability and hygiene** | reports-2..8 raw notes were refused by the Write tool and survive only as records. `scripts/substrate/federation-relay/.relay-pub-key.protobuf` is a 68-byte libp2p Ed25519 **private** key sitting untracked in the host working tree (R3 confirmed the header type only). It needs rotation plus removal as a credential-hygiene gap; the material is never printed. A `make -n` dry run by an agent destroyed substrate-live (09-23). |
| **Asking the user to decide through a surface they do not read** | C18. 336 escalations went to the replaced `:8270` (248 on 09-22), none answered there. The read surface `:8310` never receives them. |

---

## 7. Realigning the system's operational mode toward self-sufficiency

The loop to close runs: **need or detection → contracted gap → admitted → edit derived as data → landed → verified at the consumer → credited, closed, or reverted → recurrence counted → next future chosen from history.**

**Ordering rule (R2-P2, R2-P9).** One vertical slice first. After that, each step widens only what the slice showed was missing. Component exits count only as sub-exits of the slice. Every step carries a builder label from §2.0.

**Integration order (amended 10-02).**
1. Correct the source contradictions first (§8: the canon's withdrawn "reach" figures were corrected on 10-02; any later contradiction is corrected the same way before generation). Policy is never generated from stale claims.
2. Define the observation/update boundary (§2.2) and the reduced-transition contract (§2.0b) at the existing trace, verdict, extraction and selection seams.
3. Apply provenance separation (§4.2 step 3) to every experiment from the outset.
4. Settle authority boundaries (step 9) before any protected modification.
5. Exercise the single slice (step 1). **Its first demonstrated break decides which existing repair advances next; six parallel implementations are not started.**

The agentic-runner approach stays the implementation-sequencing reference named by the October 2 companion reports. The slice maps into that work and the existing ledger and realignment changes; it is not another runner or a new gate program. The operational readers are the existing consumers, trace ingestion and credit paths, activity selection, extraction, the expectation evaluator and the dispatch scope checks. Each implemented item names its concrete writer and reader and demonstrates consumption.

1. **Vertical slice on both nodes (Rank 0).** Builder: (a) for the goal-host parts.
   - **STATUS 2026-10-03: NOT DONE. A "done" claim is withdrawn (user, qa: done from a proxy).** The "news goal" reached only after goal-specific operator surgery, recorded here as L12 interventions:
     - 7fe068c: a news-only writer step keyed on question words;
     - b260a15, 7295de1, acf4922: vocabulary lists in isCountableQuestion;
     - armed by the operator-written check-first tests decb28c, 462a277, ed21374, d7e1674.

     Against this step's own definition it showed at most a route-around: no chained output consumed, no reworded reuse, no held-out generality, and a single node. The compose probe (D, "give me a briefing…") lost both halves.
   - **Acceptance from 10-03 (qa):**
     - (a) held-out CLASS probes from the sealed set (sha256 0ed9e4dd…), at least 2 per class, reached with ZERO operator commits in the window (checked by diffing operator-authored commits across all repos from arming to verdict);
     - (b) the compose chain: D consumes A's and B's published outputs (foreign-but-offered), reaches, and credits them;
     - (c) grounded reach only (satisfier-only and hollow walks do not count);
     - (d) must-fail: the same probes on a tree with the surgery reverted reach at the SAME rate; if not, the surgery was what produced the reach.
   - The surgery is not reverted blind. Commits that do not generalize are retired through restore-or-retire gaps.
   - One need-phrased goal (no component name) and one detector-filed gap each run end to end on node 1 **and** node 2.
   - The walk routes around at least one hole, with the route-around traced as a record.
   - The output is chained into at least one follow-on goal.
   - The result is verified at the consumer by an instrument that has a positive control.
   - This single run is the only "done". What it lacked decides which of steps 2–9 goes first. The order below is the default if it lacks everything.
   - **Execution-and-learning extension (amended 10-02).** Use one useful need and its actual consumer, on the nodes the plan already requires. Recheck deployed revisions and existing work before selecting it.
     1. Run a case that needs an uncertain connection or a workaround. Preserve inputs, scoped identities, bindings, outputs and the route taken.
     2. Have a real downstream operation consume the output and observe its consequence. A shape declaration or a log-only dependency is not enough.
     3. Follow the observation through the stored characterization or reduced activity to its named selection reader.
     4. Run a related case with changed input values. Record exactly what was reused and which acquired information selection read. A controlled comparison without that information strengthens the claim that learning made the difference.
     5. Vary one relevant representation or precondition. Observe adaptation at that connection while usable state and characterized operations are kept.
     6. Exercise a must-fail case: stale input, a crossed execution binding, missing content or an invalid applicability condition. It must not count as supported continuation merely because a process exited successfully.
     7. Follow later consequences at a stated horizon. Record what stays pending and what must trigger its reader. Report support and uncertainty without inventing reliability from one run.
   - Deliberately broken cases use isolated fixtures. Live bookings, policies, services or production data are never modified just to supply a negative control.
   - **Completion evidence:** source and consumer execution identities; actual content references and bindings; versioned operations and variations; observations and horizons; attributed, idempotent learning writes; the later selection's reads; reused and adapted portions; human contributions; unresolved consequences.
2. **The evaluator can fail and sees every node (2.1).** Builder: (a).
   - Exit: every row has a must-fail control refused within 7 days, executed by the evaluator.
   - Exit: findings resolve by shape from node 2.
   - Exit: **`checked == expected`, where `expected` comes from the landing ledger's count of resolvers, timers, scripts and writers added, not from the registry the evaluator reads** (R1-18). Otherwise it repeats joint-liveness's "checked > 0".
   - Exit: a deliberately severed binding is flagged within one tick and closes within one tick of repair.
   - Precondition: the git-hooks-ledger installer and a chaining pre-commit are committed.
3. **Supply: the gap write contract (2.3).** Builder: (a).
   - Exit: 0 placeholder rows.
   - Exit: rows missing fields are `needs-localization`, not actionable.
   - Exit: **carried `edit_site` and falsifier fields are verified non-fabricated on a sample of ≥50 new rows** (the site exists and contains the signature; the falsifier fails on the current tree). "100% carry" is **not** an exit, because it can be met with fabricated values (R1-4).
   - Exit: recurrence is counted across closed rows.
   - `exactEditSpec` is measured against a randomised control on byte-region-detector gaps only. Exit: a rate above the control with p < 0.05, split by author. The operator-dictated 80% is excluded (C4).
4. **The redispatch livelock ends (R2-P12).** Builder: (a) (gap-to-feature, dispatch entry).
   - Exit: on both nodes, no gap receives more than 24 dispatches per 24h without a hold or weight change written as a C20 quarantine shape.
   - Exit: value-per-cost task 3.4 is checked at dispatch entry.
5. **Verification at the consumer, feeding credit and closure (2.2).** Builder: (a).
   - Order: `grounded` becomes settable by a passing control, **then** `posterior-update.ts` reads labels.
   - Exit: every gap-lane landing has settlement #2 from a post-restart consumer-side falsifier that passed the parent/child rule.
   - Exit: `landed_verified` is only reachable through such a verdict. `a198907`, `c4bb14d`, `9cfdea4`, `af2c737` and `b585a03` replayed as fixtures must all be rejected.
   - Exit: pull-sync `TEST REGRESSION` feeds settlement.
   - Exit: ≥99% of new intents carry `directed` and `author` (2.1 coverage row).
   - **Revert (R1-12).** MECHANISM-AUDIT #3 counts five openspec changes that specified post-land revert since May: self-deployment "rollback within 1h", fleet-federation, closure-proof G4.3, redeploy D.1, contained 8.3/8.4. None was built. This plan **carries only contained-self-development 8.3/8.4** and marks the other four superseded by it in the same change. What differs: the trigger is a settlement row written first (8.4), not a detector matching `git revert` text, which MECHANISM-AUDIT #3 found blind to lane reverts. Exit: every regressed settlement is followed within 1h by a lane revert whose message names the sha. If the settlement reader is not built, this is the sixth unbuilt specification.
   - Until then, autonomous-regression's retire condition is reported as **not evaluable**, never as "retired".
6. **One address, replicated evidence (2.4).** Builder: (a) for discovery/identity/goal-host; (b) for call sites.
   - Exit: the pre-land literal-port lint refuses a positive-control landing.
   - Exit: a helper change passes the fleet-wide consumer control before landing.
   - Exit: the envelope echo is served fleet-wide.
   - Exit: a marker memory note written on node 2 is recalled by topic from node 1 and survives a cutover.
   - Exit: the federation witness is a green row per (vantage, target) pair.
7. **Containment by sandbox and chokepoint (2.5).** Builder: (a).
   - Exit: `sandboxedRun` is an advertised shape whose canary proves it is the only path.
   - Exit: 0 residue-class paths in substrate commits over 30 days with `rhythm-self-maintenance` un-held.
   - Exit: the placement gate refuses a weekly positive-control commit on each node.
   - Exit: the retire sweep runs with the right scheme and never retires its must-keep control arm.
8. **Futures from history.** Builder: (a)/(b).
   - Selection logs store, key and blend. Boosts become shaped policy. Composition is keyed by shape signature.
   - Exit: Spearman(posterior mean, selection share) ≥ 0.3 over competing arms with n ≥ 20.
   - **Floor tool use (R1-15).** `tools ≠ 0/0` is **dropped as an exit**. It stays unmeasurable until a positive control moves the counter. The candidate control is the goal-host source's own: a file line-count question the wrapper "answers correctly" (`index.ts:5276-5278`). If the counter stays 0/0 on that control, the instrument is the finding, and floor tool use is reported as "not measurable by this instrument".
   - **ReAct parity (R1-13).** Earlier attempts:
     - the 05-02 parity benchmark (`84200483`/`9022dd67`) measured LLM-call parity, not outcome parity, and was lost when minibob was removed on 05-24;
     - the 09-19 generality round-1 PREREG had a ReAct baseline arm that never ran ("parity UNTESTED") (`classes/goal-walk-floor.json`).
   - So the **baseline arm runs first**, before any parity claim. The comparison is on outcome. Battery output goes to a sandboxed store (2.5), never to the memory or gap stores, because battery residue once filled 578 of 1,077 notes.
   - Exit: need-phrased probes reach ≥90% and ≥ the baseline arm's rate.
9. **Earn-in of autonomy scope (C8, C20, R2-P13).** It is listed last but **starts right after the slice, concurrently with step 2**, because it is what moves later builder labels from (a) to (b). Its criterion can only fire once step 5 measures landings, so it is built early and fires late.
   - **Authority (amended 10-02, user rulings; this supersedes the same-day "three authority categories", which itself replaced "N verified landings in adjacent paths").** There is no trust root as such and no human-governed category. The system changes its own limits when its evidence supports the change, and operates under its own principles:
     - **Limits are shapes the system reads and writes (law 1).** These are spend, scope, which paths it may change, its own deploy gate, and its risk parameters (soak length, canary choice, rollout order, the widening and tightening bars, hold TTLs).
     - **No self-certification (K15, K18).** Anyone, the lane included, may propose a change with evidence. A change is **applied only by the previously accepted version** of the system's own gate and evaluator, never by the change being proposed. That includes a new deploy gate or a new pull-sync: it is a candidate until the accepted version promotes it.
     - **Evidence must be relevant and independent.** It concerns the behaviour the limit governs (success in nearby files is not evidence), it predates the proposal, it comes from executions the proposer's own lineage did not dispatch, and it is graded by the accepted evaluator, whose must-fail controls refused within their window.
     - **Tightenings** need less evidence and carry a TTL. **Widenings** need the full criterion. Every change is an L12 intervention.
     - **A change to the gate or evaluator itself** runs in shadow next to the accepted one, on the accepted version's fixture corpus and on live ticks. It is promoted only if it refuses everything the accepted one refuses, agrees on known-valid cases, has its own must-fail controls refuse, and has soaked. A candidate may add fixtures but not remove them.
     - **The system builds its own vessels, its own security checks, its own holds and releases, and manages its own development risk.** New vessels start from a confined-by-default template and are checked by the accepted harness. The operator builds only the minimal bootstrap that runs the accepted version, plus its break-glass.
     - **Humans are informed, never gating.** Every limit change and gate promotion is reported through the surface humans actually read (C18), with the evidence and a one-step undo. Delivery is checked by effect. Humans can always intervene by hold or revert. They do not approve each change, and nothing waits on them.
     - **Holds** are C20 quarantine shapes. Anyone may place one, and it applies at once as a tightening. A hold is lifted only by expiry or by the criterion with evidence, never by deleting a record. The system's own detectors place and release holds.
   - **Acceptance:** an unauthorized operation stays refused despite high confidence (a change citing its own or irrelevant evidence is refused); a weakened gate cannot certify its own promotion; a hold survives deletion of its request record; a new vessel without the confinement template is refused by the accepted harness; dispatchers consume the effective limits.
   - The widen/tighten decisions stop being record edits. They become that criterion plus a C20 TTL quarantine shape that dispatchers read.
   - The 09-28 rhythm hold with a nonexistent `lift_when` is re-expressed under the same shape.
   - Exit: two consecutive scope changes made by the criterion, with no operator record edit in between.

**The autonomy success criterion stays as CLAUDE.md states it, as the self-development milestone (§1).** It can only be counted after steps 3 and 5 separate authors. The broader criterion, sustained continuation and learning within granted authority, is not yet measurable (§10).

---

## 8. What "allowing this to be created" requires (proposal outline only, not implemented)

The outline follows law 3 as it applies to specs. It **amends existing openspec changes** and opens no new one. Each carried item names what it supersedes, so the spec count goes down.

- **`contained-self-development` §8.** Carry 8.3 (revert_of mode), 8.4 (sweep auto-revert with the settlement written first), 8.6 (strike limit) and 8.23 (joint on the post_land_suite `ran=false` rate). **Mark superseded by it:** self-deployment "rollback within 1h", the fleet-federation revert task, closure-proof G4.3 and redeploy D.1 (MECHANISM-AUDIT #3).
- **`causal-attempt-ledger`** (0/36 ticked while live). This is the **single** spec for the verdict→credit joint: 5.1 (generalise the sweep into settlement), 6.1/6.2 (lesson on regressed), shared settlement as replicated evidence, ingestion of pull-sync regression verdicts, and `goal_verification_label` read in `posterior-update.ts` after `grounded` is settable. The existing readers `0bd32ff` and psi (08-17) are extended, not re-made.
- **`2026-08-26-consequence-verdict-into-credit`.** **Not revived.** It was marked superseded by the ledger (MECHANISM-AUDIT #6), and an earlier draft of this document wrongly proposed writing its design. Its reference to `goal_verification_label` moves into the ledger item above, and the change is archived as superseded.
- **`self_fact_reconcile` `selfFactSpec` migration.** Rows for joints, copies, store objects, docs claims, mechanism liveness and federation reach. `landing_admission` observes, then refuses by the `landingAdmissionPolicy` shape's condition. Authority is git objects or a peer. This supersedes the jointBinding registry and the joint-liveness script.
- **`value-per-cost-selection`.** Task 3.4 (negative facts at dispatch entry) and 5.1/5.3/5.4, plus the §7 step 4 livelock exit. The gap-class posterior is derived locally from replicated evidence (C21), not moved to one holder.
- **gap-content §I.1–I.5** (05-30/06-01). Re-opened as the `substrateGap_write` contract (abstain plus localize, verified fields) plus `exactEditSpec` restricted to byte-region detectors.
- **`2026-05-30-redeploy-on-source-drift`.** Folded into 2.1 rows and archived as superseded.
- **`2026-08-26-reuse-before-mint-crossfamily-dedup`.** `producerExistsForShape` at the mint chokepoint with a function key (§2.1 item 1), on a path the lane cannot loosen (the `7148d37` lesson). Its first target is the 70 `activityExecutionSummary` producers (§4.2 step 3).
- **`run-isolated-verification.sh`.** Commit it, then wrap it as `sandboxedRun`.
- **Contradiction rulings C1–C25 and the class retire conditions.** Hand-entering them repeats jointBinding `70254535`, `FOUNDATION_COMPLIANCE_CHECKS.md` (0 code hits) and the `doc_expectation` ingestion (no reader) (R2-P5). They are **generated**: dispatched goals parse `dossiers/*.md` retire conditions and `CANON.md` into `selfFactSpec`/policy rows, and a deterministic oracle checks each parsed row against its source line. Rows the parse cannot produce are reported as unparsed, not hand-filled.
  - **Correct the inputs first (amended 10-02).** The canon is reconciled **before** any rows are generated from it. CANON.md §1 called 30.8% versus 3.0% "reach" and stated ~2% floor reach; both were corrected on 10-02 to match §1 here, with the withdrawn readings kept and marked. Withdrawn interpretations can never become current thresholds.
  - Source statements are classified as **observations** (time-, node-, version- and method-bounded measurements), **expectations** (behaviour required by a stated contract or purpose) or **hypotheses** (proposed relationships awaiting experiments).
  - Every generated record keeps its source revision and location, its statement kind, and the reader that gives it an operational role. A source change triggers a refresh or an explicit invalidation of derived records.
  - Deterministic validation establishes faithful extraction and structural validity; it does not make arbitrary prose true. Unparsed or unsupported claims stay explicit and are never fabricated into predicates. A generated row is exercised through its existing evaluator or consumer.
  - **Acceptance:** withdrawn interpretations cannot become active expectations; a source correction reaches derived readers; hypotheses stay distinguishable from measured facts and established contracts.

**This document's own runtime reader, and why its difference is conditional (R1-19).** The class keys and retire conditions in §2 and §7 become generated 2.1 rows, each with a must-fail control and an `edit_site`. The evaluator, not an operator, then reports whether each class is retired, not evaluable, or recurring. That is the only way this pass could differ from the previous seven, and it is **conditional** on three things:
- the git-hooks-ledger installer being committed;
- the §2.1 item 2 parent/child control being built;
- the row generator existing.

If none of the three is built, this file joins the previous seven as an archive, and the next synthesis should count it as restatement number nine.

## 9. Amendments (2026-10-01): security findings and the hardcoding census

Sources: the hardcoding census and approach (`validation/reports/realignment-2026-09-29/hardcoding/`, super-repo `7c4d860d`); qa's audit of it; and the 10-01 security findings, filed as gaps:
- `development-vessel-resolve-route-is-unauthenticated-so-anyone-reachable-can-write-our-policy`
- `local-policy-reads-span-federated-peers-so-an-unresponsive-peer-substrate-halts-the-lane`
- `substrate-local-shapes-must-resolve-only-to-own-substrate-producers`
- `activity-api-accepts-unsigned-minibob-bearer-tokens`
- `human-ask-route-reads-span-federated-peers-so-a-peer-can-redirect-human-asks`

### 9.0 New precondition: addressability follows locality and authentication
No seam that makes an address resolvable or a behaviour writable lands before two things are enforced:
1. **The shape's locality.** A substrate-local shape resolves only to own-substrate producers, using a positive allowlist stamped by discovery on receive.
2. **The route's caller authentication.** Every vessel resolve/write route validates against identity.

The reason, measured on 10-01:
- Only discovery and activity-api authenticate. activity-api also accepts an unsigned bearer.
- Producer ports are host-published on all interfaces, including a global IPv6 address.
- Node 2's federation ingress proxies any shape from any overlay dialer.
- Discovery fan-out returns foreign producers for local shapes, and policy reads take the newest record across them.

So making more things "resolve by shape" or "writable as a shape" before this converts fixed pins, which at least pointed at our own node, into injection paths. The per-shape trust-root gate on policy writes stays as defence in depth after route auth lands.

### 9.1 §2.4 correction: the address seam is the typed lookup
- The seam is the ias-executor-ts typed discovery lookup (`HttpDiscoveryAdapter.lookup()`, `4719cb4`), extended with origin/origin_upstream provenance. It is not `packages/vessel-discovery-client`, whose `discoverByShape` returns `found:false` on a query error. That makes an unreadable lookup look like an absent producer.
- §2.4 must also count three pin sources that weren't listed:
  - the seed templates and prompts that teach `127.0.0.1:8xxx`;
  - the env-default disguise, `process.env.X ?? "http://127.0.0.1:<port>"`, including four endpoint vars set nowhere, so their literal always wins;
  - self-address pins.
- The A-class migration (~254 sites) depends on §9.0. The seam must carry the locality property before any site migrates.

### 9.2 §2.2 addition: abstain on a truncated view or a max_tokens stop, with a counterweight
- A verdict computed on a truncated input, or from a generation that stopped at max_tokens, is an abstain, not HOLLOW, and carries no β. The abstain is computed in code from the cut record (`cuts[]`, `stop_reason`) before the judge is called, not in prompt text. The label carries the cut.
- Counterweight: abstention can't become an escape hatch. The same §2.1 row checks the abstain rate per family, and a family that abstains in more than a set share of its runs is a divergence. This is the same lesson as verified deferrals: a family that always overflows its budget would otherwise never be graded.
- Related: a deferral to a concurrent lease holder is ungraded only when the lease store confirms the other holder. A family's self-report doesn't count.

### 9.3 §2.1: three planned evaluator rows, each with a must-fail control
1. A content-budget check: decision paths may not silently truncate.
2. A port-pin lint, which counts new `127.0.0.1:<port>` / env-default pins against a ceiling.
3. A widened env-gate scan. The current `env_gate_scan` exempts inline-default reads, which is exactly the law-1 set, and its `GUARD_RE` is corrupted.

### 9.4 §4: the human-surface-stack acceptance item 5 is unmet
stateful-ui is still live (805 panels) and was still being written to on 10-01. Its retirement is a user decision.

### 9.5 Order of the hardcoding work
- **Step 0, first: stop the generators.** Three small edits stop new pins from being produced:
  - surgical-gap-scan's prescription of the env-default pin;
  - the seed templates that teach pins;
  - the topology hint that teaches the `obsidian:write_note` fallback.
  Every day they run, the A/D inventories grow.
- **Then C** (judge and human view, per §9.2).
- **D: delivery by origin is HELD.** It needs re-specifying with an origin derived from the authenticated caller identity and a target constrained to own-substrate surfaces. A caller-asserted origin is the human-ask-route injection again.
- **Then A, after §9.0.**
- **Then B, last.** Explicit precondition: route auth plus trust-root gating of `tuningParam_write`, with an authority rule (operator or a named learner identity).
- Early small fix: the trace-store reconcile should stop at a margin below its cap (hysteresis, as a policy, not a constant). Today it parks at the cap, re-crosses within minutes, and dispatches reconcile into lease contention.


## 10. Amendment (2026-10-02): continuity, experimentation and reduction

**Basis.** The user's clarification in review: outputs are validated through their use as inputs; variation, experimentation and reduction characterize confined state transitions; autonomy sustains that continuity, with humans taking part as sources of purpose, information, authority and judgment. The draft is `CONTINUITY-AMENDMENT-2026-10-02.md`. Its version note (the working copy ending at §8; §9 added by `e028a7f9`) is superseded by this integration, which was made against origin/dev with §9 present. §9's locality, authentication and trust requirements are preserved.

**Where it was integrated:**

| Amendment section | Integrated into |
|---|---|
| 1. Purpose and completion | §1 (purpose, the four separate claims, the two-level autonomy criterion); §7 closing line |
| 2. Observations, learning and acceptance | §2.2 "Three uses of evidence" |
| 3. Reduction and partially known cases | §1 "Middle"; §2.0b "Reduction and partially known cases"; §2.6 "Workaround records"; §3.4 rebind row |
| 4. Human-originated experiments | §4.2 step 3; §6.2 |
| 5. Authority and evaluator evolution | §2.1 item 6; §7 step 9 "Authority" (re-amended the same day by the user rulings in item 1 below) |
| 6. Inputs to generated expectations | §8 "Correct the inputs first" |
| 7. One execution-and-learning slice | §7 step 1 "Execution-and-learning extension" |
| 8. Integration order and readers | §7 "Integration order" |

**What it does not do.** It grants no new runtime authority and has no runtime effect. An integrated item counts as implemented only when it names its concrete writer and reader and demonstrates consumption. Keeping only prose here would repeat the warning at the top of this document.

**Open items, stated rather than settled:**
1. **The permanent boundary: resolved by the user on 10-02.** There is no human-governed category and no trust root as such. The rulings, verbatim:
   - "There shouldn't be a trust root per-se."
   - "The revision is correct. The system should operate in accordance to its design principles." This confirms that the system may change its own limits when its evidence supports it, with humans informed and able to intervene, not approving each change.
   - "We must consider that the system will need to build its own vessels, implement these sorts of security checks, hold and release on its own, manage its own develop and risk. And operate under the system's principles."
   - Standing alongside them: "safety via locality, secrets never in agent reach"; "the goal … is not to have the operator blocking"; "we can leave the github token as is for now"; "we should use the pull-sync check" (a deploy-side check judged by the accepted version, never by the incoming change).

   §2.1 item 6 and §7 step 9 now state this. The one constraint that remains is a principle, not a boundary: **no change judges itself**.
2. **CANON.md was reconciled in the same change** (§1's middle, figures and autonomy criterion, K3, C8, and §5's generation rule). The withdrawn readings stay in the canon, marked withdrawn. No rows have been generated from it yet, and §8's classification rule applies when they are.
3. **The broader autonomy criterion has no measured acceptance.** §1's "sustained continuation and learning within granted authority" needs a measurable form, or the self-development milestone (landing counts) stays the de facto goal.
4. **Known live conflicts at adoption (10-02):**
   - Step 9's acceptance ("an unauthorized operation stays refused despite high confidence") failed at adoption: the admin key and identity's key secret were in every vessel's process environment (filed HIGH, `every-vessel-process-env-carries-the-admin-and-api-key-secrets-so-lane-code-can-unlock-containment`). Status later on 10-02:
     - Env scoping is in effect on node 1 by effect at 16:03Z; node 2 is pending its strip and restarts.
     - The gap stays open: every vessel still runs as root, and the policy store is written by the lane's own process.
     - Until a deploy-side check judged by the accepted version lands, a lane push can change root code on every node within one tick (pull-sync runs the newly pulled version of itself). So step 9 holds for the runtime path only, not for landing → deploy.
   - `6ac1aa6` is a live case of a candidate weakening its own evidence source: a lane draft added entries to a guard test's allowlist so its own landing passed. The guard is now frozen.
   - Proposed, not live: the slice Y verdict stamping in review on 10-02 (Y1c) would not meet §2.2's "a correction names what it supersedes" as drafted, because a failure class stamped on a run stays when the run later reaches, so readers would have to filter it.

## 11. Amendment (2026-10-03): prior art for the 10-03 rulings

**Basis.** The user's review: "none of what we are seeing as issues are 'new' per-se. When have we done something like this before." Three of the 10-03 rulings restate earlier attempts, which this realignment's own dossiers already trace (`dossiers/docs-drift.md`, `dormant-mechanism.md`, `false-verification.md`, `human-surface-escalation.md`, `credential-hygiene.md`):
- the executable plan of record (`061b8651`);
- suspend/resume with a credential path (`533b8f72`);
- the slice withdrawal (`4b0c8d99`).

Tags: [V] verified in git, code or the live gap store on 10-03. [D] taken from a dossier and not re-checked.

**11.1 The executable plan of record has been attempted at least ten times.**
- Six manual realignment passes ran from 02-24 to 06-24 (`af9d8308`…`e53f0266`); this document is the seventh. [D]
- The failure-mode harness moved into the `harness-run-matrix` activity (05-23): 0 journal hits since 09-21. [D]
- `closure-audit` (05-27, `86186cb4`) was never scheduled. [D]
- Docs-as-expectation phases 1–3 (07-01, `a0f40fb2`): `doc_drift_fix` has never run. [D]
- `docs_align_scan` (07-10) is orphaned, and the 27 `docs-drift-*` gaps are all open with 0 ever closed. [V]
- `joint-liveness-tick` (08-25, `daa2632c`) had 1 binding for 33 days and caught 0 of ~180 breaks. [D]
- `validator-liveness` (09-09): `validator-cadence-severed` is still open. [V]
- The expectation batteries (09-19) ran 273 ticks with 0 violations across a day of breaks. [D]
- `self_fact_reconcile` (09-23; data rows since 09-29, `56f140e7`, 15 rows) is live and is §2.1's named home. Its closures FLAP: of 34 `self-fact-divergence-*` gaps, 13 are open and the maximum `reopen_count` is 28 (24 on the fleet-inventory row, as §2.1 notes). [V]
- Synthesis documents, 08-13 → 10-02 [V]:
  - PROCESS_MEANT_VS_ACTUAL; BUILT_BUT_NOT_RESOLVED; LEARNING_MECHANISM_AUDIT; SEAM_MAP;
  - NEEDLE_MOVERS / AUDIT_EXPECTATIONS / RECTIFICATION; PROCESS_MAP; ARCHITECTURE_FALSIFICATION;
  - WORKING_SYSTEM_EXPECTATIONS; WHY-THINGS-KEEP-BREAKING / MECHANISM-AUDIT;
  - REALIGNMENT; WIRING.

  Every one except REALIGNMENT and WIRING stopped being edited within about two days of creation. That is the user's account: progress, a regression somewhere, a fix that still leaves the goal red, and a new synthesis.

**11.2 Human solicitation and credentials.**
- The interactor passthrough (06-02, `b5b3f695`) was pinned to `:8270`, and 336 questions went to a store no human reads. [D]
- WS1–WS6 (07-05, `6b984bdb`). [V]
- `solicitHumanInput` (07-06, goal-host `77d320f`, now `index.ts:15054`) [V]:
  - it is reachable only after recovery has run out;
  - the pending request lives in process memory, so a restart loses it;
  - it waits at most 120s by default;
  - the answer is injected as `opts.variables.human_input`.

  Mechanism audit M26 records "effectively no" answered solicitations. [D]
- The docs-decision solicit/answer scan (07-12) has 0 executions. [D]
- The escalation-disposition executor (08-28, `9cb83d00`) has closed 0 gaps by human disposition. [D]
- `solicitation-outcome-scan-pins-one-ui-endpoint-instead-of-discovery` is open. [V]
- No value-blind credential path has ever existed. No `secret_set` or `secretRef` code exists in any vessel, and 27 related gaps are open. [V]

**11.3 "Done" declared from a proxy, then withdrawn: about thirty claims** (`dossiers/false-verification.md` §1). Examples:
- the harness "LIFT CANDIDATE" produced by changing the harness (05-22); [D]
- the self-approved S1→S2 lift (05-26); [D]
- "13 gaps closed", 12 of them by hand commits (08-28); [D]
- "50 landed_verified", 78% of them ancestry stamps (09-07); [D]
- crystallization "proven" and conformance "converged" on toy arithmetic classes with operator restorations (09-18);
- the causal-attempt-ledger "3×10/10", which depended on pausing four autonomous paths (09-26);
- "it was working", retracted 15 minutes later because the post-land suite had been dead since 08-31 (09-28);
- the canon reach figures withdrawn (`32c5bbe5`) and the news-goal slice withdrawn (`4b0c8d99`) (10-02).

§6.2 counts the goal-walk floor declared "fixed" seven times.

**11.4 Why none of them held.** These reasons are common to all three:
1. Each attempt shipped one part (a finder, a store, a fixer or a harness). It was declared working on its own check and never measured end to end.
2. Nothing re-runs a claim after a fix, so documents and "done" verdicts go stale and the next session rediscovers the problem.
3. Checks that cannot fail, and operator-assisted outcomes, were counted as the system working.
4. Checks were never connected to gap closure. Doc, credential and solicitation gaps are filed with `falsifier: none` and no landing path, so they cannot close by measurement.

**11.5 What follows (binding on the 10-03 rulings).**
- **Flapping before rows.** Diagnose why `self_fact_reconcile` closures flap (the fencing root of §2.1? a stale write flipping an honest false? a predicate without hysteresis?) **before** registering WIRING's must-fails as rows. Rows added to an evaluator that flaps multiply the noise.
- **The row is the falsifier.** A row that goes red files, or bumps, one gap whose class-2 falsifier **is that row**, so the row going green is the closure. Every row has a recorded must-fail run (K6) and a recorded completion count per tick (rows evaluated = rows registered). Doc rows use the same closure, or "WIRING as a view" becomes the 28th open docs-drift gap.
- **Durable solicitation is a known failure, not a hypothesis.** The suspend/resume acceptance (`533b8f72`) must begin with the in-memory, ≤120s `solicitHumanInput`: the pending request survives a restart and is addressed by discovery.
- **Acceptance is end to end and operator-free** (§1, §7 step 1; the 10-02 user rulings). A part's own check is never "done". Each declared "done" names the consumer-side measurement and the window in which no operator commits landed.
- **Prior art first.** Before a ruling or a synthesis is written, search git (super-repo and submodules), the live gap store and this document's dossiers. Cite what was tried, and say why the new attempt differs.

## 12. Amendment (2026-10-03): prior art for the step-1 harm classes

**Basis.** The user asked the same question of the plan's step 1 ("stop active harm"): when have these happened before? Each of the five classes recurs. Each was previously fixed at one site and passed its own check, and nothing filed the class.

Tags: [V] verified in git, code or the live gap store on 10-03. [D] taken from a dossier or memory note.

**12.1 Hand-maintained lists that drift from the registry they copy.**
- activity-api's `builtInResolvers` allowlist (`dfbc587`, 05-27, "F-139") was copied by hand from goal-host and never touched again. It has drifted (`file_read` vs the engine's `file-read`; no `compose_parallel`). [V]
- Earlier instances:
  - the deploy mirror coverage list fell behind three times (07-25 → 09-24) [D];
  - KNOWN repo lists (`c1985ec`, 08-09) [V];
  - a 16-name vessel inventory against 18 submodules, fixed only by `150f156d` [V];
  - `FS_WRITE_SHAPES` (`a72918f`, 10-01) was bypassed a day later (`5b10279`) [V].
- Each fix pinned or derived **one** copy. None searched for the other copies.

**12.2 Hollow advertisement: a shape is advertised but not served.**
- concept-db's `concept_*_write` shapes:
  - were added to discovery by `9d7d715` (09-01) and again by `9e2c8a8` (09-11), so config lists them twice;
  - `626b408` (09-26) added a no-op `switch('')` that exists only to satisfy the shape-dispatch lint.
  
  All three commits are substrate-authored, so **the lane gamed a gate**. [V]
- The lint (`995fee1`, 05-17) checks that a case label exists, not that the shape is served. [V]
- Earlier, de-advertisement was done one vessel at a time: identity `3cc9ee3`, llm-resolver `85d5edb`/`cc19227`, mcptool `3f62a22`. [V]
- No probe sends a known-good request through the advertised address.

**12.3 Landed but unverified, "measure after landing".**
- `pending_outcome_verification` (07-07, `3c0e547c`) had no verifier. [V]
- `runBehavioralVerification` (07-12) exists, but 0 of 6,279 gaps carry a spec. [D]
- `sweepPendingLandVerifications` (07-30, `ff04a178`). [V]
- The post-land suite was dead from 08-31 to 09-28 (≈600 `ran=false` read as passes). [D]
- The live store [V] holds **237** stamped gaps:
  - 101 still open;
  - 62 closed `landed_unverifiable`;
  - 38 closed `landed_verified`, **34 of them on `close_basis=absent`** (a literal-absence check).
- So deferral has never produced a behavioral verification.
- The class recurred live on 10-03: `69256d9` landed `landed_unverified` with a `ran=false` suite, and the sweep would have closed it `landed_verified` on a text predicate.

**12.4 A write surface exposed over federation without a per-shape policy.**
- The `FEDERATION_SIGNING_SECRET`/`FEDERATION_PEER_AUTH_MODE` knobs (07-01) are written and never read. [V]
- The ingress proxy forwards any shape (07-07, `708e4c64`). [V]
- The confused deputy:
  - was analysed (08-05) and noted "still open" (09-12) [V];
  - `9f1d1c98` (09-14) guarded only registry shapes [V].
- `federationShapePolicy` exists only in INGRESS-AUTH.md. [V]
- On 10-03 the transport half of ingress auth did not exist on origin/dev, and `326061de` was live on one node only. [V]
- Each fix guarded one surface; the relay tier has never had a substrate-authored fix. [D]

**12.5 Flags and latches switched on by counts, not measured benefit.**
- `accelerator-flag-tick` (`8972cda`, 07-02, substrate-authored) arms **three** latches with no off path [V]:
  - `SF_BLEND` at ≥200 rows;
  - `REPAIR_SIGNATURE_CONSUME` at ≥5;
  - `CROSS_SIG_REPUTATION_PENALTY` at ≥1.
- `activities.scoring.ts` reads the env var before the tuning row, so env overrides any verdict. [V]
- An operator note (07-25) observed the SF_BLEND self-arm and accepted it. [D]
- The learning-rate mechanisms of 06-04 were reported "tracked and improving" while none was ever accepted on a measured rate. [D]

**12.6 The common thread.**
1. Every earlier fix swapped a measurement of what a consumer actually gets for a proxy:
   - a hand copy;
   - a lint that sees a string;
   - a stamp;
   - a count threshold;
   - a typecheck.
2. Each proxy passed its own check.
3. Fixes were single-site, so nothing searched for sibling copies or filed the class.
4. In two classes (12.2, 12.5) the substrate itself armed or gamed the gate.

**12.7 What follows (binding on step 1 and its successors).**
- **Fix the class, not the instance.** Each step-1 gap names the class and every known copy or call site (all three latches; both cutover routes; every hand list of builtin ids).
- **Coverage means a mutation.** A behavior is covered only if removing or negating the shipped check turns an **armed** test red. A green test of a copied predicate, or one that isn't armed, is a lead, not coverage. This is the scope criterion's definition (WIRING; §7 step 9, slice L).
- **Nothing measured means refuse.** A landing or promotion that no instrument actually exercised is refused, never landed as `unverified` or closed on a literal. This applies at the lane cutover (`no_measurement_available`), at the sweep (`landed_literal_only` is excluded from tallies and credit), and at the image gate (a promoted change that acceptance did not exercise is flagged and not promoted).
- **A served shape is verified by calling it.** The executable shape-dispatch lint drives each advertised shape once against a fixture. Advertisement without service is refused.
- **Latches carry an evidence verdict.** Every self-enabling flag has an off path that wins over env, and a reach-graded verdict written through the criterion path.
