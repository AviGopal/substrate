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
> **Amended 2026-10-03 (architecture review):** §13 records whether the method and the fixes adhere to the architecture. The fixes mostly adhere in behavior. The method bypasses dispatch-don't-edit and leaves the operator more load-bearing, and many fixes hard-code policy instead of using `landingAdmissionPolicy` or tuning rows, keep calibration with no reader, and add stores before proving reuse. It binds the corrections.
>
> **Amended again 2026-10-02 (user rulings on authority):** §2.1 item 6, §7 step 9 and §10 no longer define a human-governed boundary. The system changes its own limits on evidence applied by the previously accepted version; humans are informed, not gating (§10 item 1).
>
> **Amended 2026-10-13:** §16 states the primary objectives in the user's words: operable by humans (setup, maintenance, self-updating, configuration and secret distribution simple for a person) and decentralised in any constellation of vessels. It gives measurable criteria (O1–O6, N1–N7) with operator baselines as context, and the path through existing plan items. It is a target, not a status, and grants no authority.

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
     - armed by the operator-written check-first tests decb28c, 462a277, ed21374, d7e1674, and 2df2d90 (which armed b260a15), with its controls e24a456.

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

## 13. Amendment (2026-10-03): architecture adherence review of the method and the fixes

**Basis.** The user asked whether we are adhering to the architecture: first of the working method, then of the fixes. The answer is split. The fixes mostly adhere in BEHAVIOR. The method, and the form many fixes take, deviate in the same direction: toward operator-held, code-frozen policy.

**13.1 Where the method and fixes adhere.**
- **Law 1 (shapes):** violations were found and filed rather than added: env-file holds, unseeded tuning rows (19 of 22 read keys ran on code constants), an env-only compose cap. The retention hold's time-based release was replaced by a release gated on the fix's green check or an explicit user release.
- **Law 3 (reuse before mint):** existing organs were extended (`self_fact_reconcile`, the orphan scanner, shared test helpers), with prior art searched each time (§11, §12).
- **Law 8:** the inference fix reads shape descriptions at choice time.
- **Law 12:** pre-registered probe expectations, sequenced deploy events, excluded measurement windows, one recorded change at a time.
- **Reach, not status:** false reaches were recorded as false (held-out reach stayed 0/9), and α was withheld on ungrounded reaches.
- **The fixes, by behavior:**
  - caller-fault abstention and the planned idempotent fold (§2.2);
  - required-input binding by declared contract, never by name;
  - inference as deterministic validity plus an LLM or posterior chooser plus a logged decision ("the LLM is one resolver among many");
  - execution-scoped selection context;
  - pull-sync's bounce quiesce with a shaped starvation bound, and the key kept off argv;
  - retention compacting graded evidence before deletion;
  - the shared tracked-red predicate and the loud no-op;
  - the single-source gate-file list;
  - running-version checks.

**13.2 Where the METHOD deviates.**
1. **"Dispatch, don't edit" is systematically bypassed.** Builders wrote code in scratch clones under job directories and pushed from there. The PreToolUse gate watches only `repos/<vessel>/src`, so it never fired, and none of tonight's operator code produced a substrate trace. That is necessary for excluded paths (the lane can't author them), but it became the default for in-scope files too.
2. **Law 6 / "wrongness is a goal seed":** operators authored every check-first test and filed about 155 gaps in one day. The missing generator, verdict class → test or goal minted by the system, is itself the gap.
3. **The operator role:** the operator became MORE load-bearing (about 25 operator pushes reviewed; 2 supervised lane landings; the open backlog growing about 450 per day).
4. **Law 7:** the gap triple was not reported each check-in; check-first counts were.
5. **Law 9:** WIRING grew dozens of dated sections, which is the §11 synthesis pattern until it becomes a view of standing rows.

**13.3 Where the FIXES deviate.**
1. **Policy is hard-coded, not shaped (law 1; Delta 3 / §7 step 9: limits are shapes changed through the criterion path).** Examples:
   - the gate's escalation threshold (`OWN_CHECK_UNMEASURABLE_ESCALATE_AT = 3`);
   - the semantic gate's four veto classes and its advisory rule;
   - the no-measurement rule and what counts as a measurement;
   - the relocation hint's maximum of 3 files.

   §8 already names the home: `landing_admission` refuses by the `landingAdmissionPolicy` shape's condition. As built, these rules are frozen, mostly in EXCLUDED files, so only an operator can change them and the system can't change them on evidence. Only some bounds were shaped (the gate-version stale bound, SF_BLEND_VERDICT).
2. **Calibration with no reader that changes behavior (law 2):** semantic dissents and their later outcomes are recorded "for calibration", but nothing reads that calibration to change the gate's veto weight.
3. **New stores before proving reuse (law 3; §2.2 "an information contract, not a mandate for a new store"):** retention adds `execution_observation` and `trace_evidence_ref`. Whether `goal_verification_labels` or the trace store can hold observations, and whether gap and ledger references belong with the gap store's own publisher, was not established first.
4. **Hand-copied cross-repo contract strings (§12.1):** the caller-fault carrier and `synthesize_from` are byte-identical fixtures in four repos, with a filed move to `packages/`.
5. **Instance patches:** the lane's own `b5147869` adds a one-name allowlist in the orphan scanner. The armed general fix must subsume it.
6. **Temporary exceptions:** the env-file retention hold, and pull-sync's pinned activity-api default (bootstrap tier). Both are recorded as exceptions with lift conditions.

**13.4 What follows (binding).**
- **Method:**
  - lane-scope changes are dispatched as goals (an edit-intent goal naming the file → `feature_compose`), so the system authors them and they are traced. Builders hand-write only excluded-path fixes;
  - every operator push carries an `Operator-Authored:` trailer and an L12 ledger record, so operator load is measured and kept out of lane yield;
  - tonight's check-first tests are the seed corpus for a system test generator from verdict classes. Report the system-authored share of new checks;
  - widen scope by the adopted criterion, starting with the cutover files whose checks now exist;
  - every check-in reports the gap triple by author, lane yield (composes → landings → verified by effect), and held-out reach.
- **Fixes:**
  - each gate's thresholds, veto classes and measurement definitions move into `landingAdmissionPolicy` or tuning rows, evaluated by code and changed only through the criterion path, judged by the accepted gate. New gate fixes read from there rather than adding constants. Before each operator fix is pushed, its new constants are either shaped or filed on the tuning-seed root;
  - the semantic gate's calibration gets a consumer: a criterion that raises or lowers its veto weight from the measured dissent outcomes;
  - before the retention fix lands, establish reuse (existing label or trace stores) or record why a new table is required;
  - the cross-repo contract strings move to one `packages/` definition with a copy-diff check.

## 14. Amendment (2026-10-10): the measurable form of sustained continuation

**Basis.** §10 item 3 records that §1's broader autonomy criterion, "sustained continuation and learning within granted authority", had no measurable form. Without one, landing counts stay the de facto goal. This amendment supplies the form. It merges two candidates put to the user on 10-10, and the user adopted them ("follow the recommendations"). The structure it measures is stated in `docs/architecture/SUBSTRATE_AS_SOFTWARE.md` §5.0: one continuity loop containing horizon loops that couple only through shapes and are verified by the loops that consume them.

**This is a target, not a status. None of the criteria below is measurable today,** because the instrument they require, §7 step 2's evaluator, is unbuilt.

**The rule of measurement.** Every criterion is measured by the system's own §7 step 2 evaluator rows: rows that can fail, with checked == expected counted from the landing ledger. Operator instruments do not count, including session audits, hand-run probes and user-run SELECTs. If an operator has to measure a criterion, the operator is still the observer, and the criterion is not met.

**The criterion.** Sustained continuation holds when all of the following hold at once, over the stated windows. Where a §7 step already has an exit, this amendment cites that exit rather than restating it.

1. **Continuity.** Every loop named in SOFTWARE §5.0 is observed closing by its consumer within its window, for 7 consecutive days. The loops are the walk, credit, gap improvement and deployment, plus any added later.
2. **Signal.** For 7 days:
   - signature-row credit drops are ≈ 0;
   - the α/β direction of chain credit is measured, not inferred;
   - §7 step 1's held-out probes reach.
   This extends §7 step 5's exits.
3. **Repair.** For 7 days:
   - gaps armed by the system itself (not by an operator) are above zero;
   - lane landings from those gaps are verified at the consumer;
   - both are rising.
   This extends §7 steps 3 and 5.
4. **Inflow.** Open gaps fall over 14 days with zero operator closes (§7 step 3; §2.5's retirement without a reader).
5. **Durability.** For 30 days, no class recurs for the same reason. This is law 7's third measure; the class keys are §2.1's lineage counters.
6. **Safety.** Every regressed landing is reverted by the system, with the revert naming the sha. This is §7 step 5's revert exit (contained-self-development 8.3/8.4 only).
7. **Scope.** Scope widens only through earn-in, never by an operator record edit (§7 step 9's exit).
8. **Operator load.** Operator-Authored commits are limited to L12-recorded harm or blocker work. The ratio of autonomous to operator commits is reported with every measurement. The 10-10 baseline is about 1 : 73 over 24 h across the super-repo and every vessel repo, of which four had commits (activity-api, concept-db, development-vessel, goal-host-vessel).

**What it does not change.** It grants no authority, and it does not alter §7's ordering or exits. It names the end condition that §7's steps lead to, so that "autonomous" is never declared from a landing count, a single slice, or an operator's measurement again (§11.3).

## 15. Amendment (2026-10-10): opening the lane mechanics under the accepted gate

**Status:** adopted by the user on 10-10 ("follow the recommendations"). **It takes effect only when the opening is applied.** Two things must both be true first: bootstrap builds 1–6 (15.3) have landed and been verified, and every opening precondition below is met.

Build 7 (the judge/walk split, user amendment 10-10) does not gate the opening. It runs in parallel on its own dates (15.3). When it lands, it widens what can open later, under the same opening rule.

**A fourth headline measure, compounding (2026-10-13).** Does the system learn from experience? qa reports it hourly from producing-unit journal lines only: activity-api's trace-read lines print every execution they read, so counting them is noise.
- **What it reports:**
  - learned-pathway reuses, and their reach rate;
  - fresh derivations on repeat goal hashes;
  - activities minted against activities retired.
- **The first reading, node 1 over 24 hours:** learned-pathway reuse 0; fresh derivations 6. Reuse is about zero, so the system is not compounding.
- **No operator instrument is built for it.** After build 7's routing opening, it becomes a system need: "observe whether my own learning compounds, and file a gap when it doesn't".
- **D8's record states whether the re-run REACHED over a learned pathway** (compounding) or by a fresh derivation (repair only). D10 should then show the reuse.

**How the closed loop is measured, pre-registered on 2026-10-13 (qa, sealed with the coordinator).** The loop goal is chosen by rule, and named before any surgery or re-dispatch. It must be a REAL goal (user- or system-originated, not written for the test), blocked within the last 7 days, where:
- **(a)** its block is caused by a gap the system can recognise from its own trace: a named missing producer, a refusal, or a failing check;
- **(b)** closing that gap needs one change at a single site the system may write to. Either a lane commit or a system-made learned or registry close counts (composing existing producers, or binding a shape), provided the re-run reaches. **Guard (C-provenance-1):** the close must go through a sanctioned write path: a lane landing, the ribosome, an activity mint, or a registry advertisement. A walk that writes arbitrary pool or gap rows does not count, and a write to a trust root voids the run;
- **(c)** its goal text is available verbatim.

Ties go to the most recent goal. The leading candidate is the federation-report goal (no producer for its output shape; 3 hollow runs on one goal hash).

**The test:**
1. Re-dispatch the exact goal text, and see it blocked.
2. See the system file or recognise the gap, with no operator filing it.
3. See the gap closed by a verified system landing.
4. Re-run the SAME goal, and see it reached under the fixed judge.

Surgery is allowed on links. Each act is recorded with the link it carried, and the verdict reports which links ran unassisted.

**The loop map (qa, verified, 2026-10-13): two tracks that never meet.**
- **Landed gaps are goal-less.** Gaps that are revealed by a goal are born closed or `needs_information`, and they never land.
- **The re-run (goal-reach-tick) exists, but nothing writes its goal link,** and it runs in dry-run.
- **The broken links:**
  - **L2:** gaps born closed from walks, with no goal link, no route-around counter and no generator;
  - **L3:** admission takes 1 of 2,917 candidates, and check supply never reads its dispatch outcomes;
  - **L5:** the re-run, which is dead.
- **The surgery plan,** each act recorded with the link it carries:
  1. **S1 + S3 + C-window-1.** S1 is a link writer from a gap back to the goal that revealed it. S3 makes check supply read its dispatch outcomes. C-window-1 is the drafter capability build.
  2. **S2:** a recognition tick.
  3. **S5:** the re-run switched on, by a policy the user runs.
- **Gap (A) is closed by the S3 surgery.** That is recorded as operator surgery, not as a system repair.
- **Conditions, adopted by qa and sent to the coordinator:**
  - **(1) The verdict's grade is "links run unassisted: k of 4"** (recognise, close, verify, re-run).
  - **(2) Nothing specific to the loop goal may be built.** Any build that references it voids the loop as staged.
  - **(3) C-window-1's ladder test is RE-PINNED, not voided.** The first lane compose after it is live, on any gap whose edit-site file is over 6 KB and whose fix spans more than one old window, must reach a later rung than that gap's prior attempt, or pass typecheck if it has no prior attempt.
  - **Gap (A)** is recorded as "defect fixed by operator surgery S3".
- **A date for each link** (qa, 2026-10-13). Each is closer-only once set, and a miss on any is reported at that date.

  | # | Link | Date |
  |---|---|---|
  | D1 | S1, S3 and C-window-1: packages to qa; live (gate-accepted on node 1 and compose2) | packages 2026-10-13T14:00Z; live 19:30Z |
  | D2 | S1 evidence: goal-reach-tick shows waiting > 0, with goal_reach demand entries on real walk gaps | 2026-10-14T06:00Z |
  | D3 | S2, the recognition tick: package; live | package 2026-10-14T06:00Z; live 12:00Z |
  | D4 | S5, the re-run switched on: the user's shaped `goalReachPolicy` set to `dry_run:false`, after dry-run redispatch lines are seen | 2026-10-14T18:00Z |
  | D5 | The loop run starts: the federation goal re-dispatched verbatim | 2026-10-14T20:00Z |
  | D6 | Recognition: an OPEN, goal-linked gap for its missing producer, made by the system (S2 or a walk), with no operator filing | by 2026-10-15T06:00Z |
  | D7 | The close: by the system, through a sanctioned path (a learned producer or a lane landing), verified | by 2026-10-16T18:00Z |
  | D8 | The re-run is REACHED (redispatched by goal-reach-tick, or by the next natural run) | by 2026-10-17T12:00Z |
  | D9 | The verdict, "links run unassisted: k of 4" | 2026-10-18T07:12Z |

  Slack is thin at D7. If D6 slips past 2026-10-15T12:00Z, the options go to the user then, not on 10-18.

  **D1 was MET early.** S1, S3, S2 (report-only) and C-window-1 were pushed at 2026-10-13T05:59:48Z (development-vessel `90289225..72e69c9f`) and measured LIVE on node 1 and compose2 at 06:20Z (the hub earlier), about 13 hours ahead of 19:30Z. **The earlier dates** (closer-only; each replaces the old one only when it is measured):

  | # | Link | New date |
  |---|---|---|
  | D2 | S1 shows waiting > 0 | by 2026-10-13T12:00Z |
  | D3 | S2's report reviewed, and the user's filing flip | by 2026-10-13T18:00Z |
  | D4 | the user's re-run flip, once dry-run redispatch lines appear | by 2026-10-13T22:00Z |
  | D5 | the loop goal's next run on its rhythm | or by 2026-10-14T06:00Z |

  D6–D10 are unchanged until measured.

  **D2 was MET at 2026-10-13T06:30:16Z,** 5.5 hours ahead of its date. The first goal-reach tick on the new code logged `linked_filed=1 … goals=78 unlinked=70 waiting=1 redispatched=0`: S1 linked a walk-filed gap back to its goal, and that goal is now waiting.

  **A standing finding: settlement cannot measure most class-2 checks.** Node 1's gap sweep reads "unknown" for 15–19 of every 25 checks ("detection sha unknown"). That was true before D1 as well as after, so it is the baseline, not a D1 effect. It is recorded as case **C-measure-1** (measurement starvation in settlement), for the system after build 7's routing opening.
  - **The risk:** it can bite D7 and D8 if the loop goal's gap lands in that bucket.
  - **The rule:** an "unknown" settlement counts as NOT verified. It is never a pass. This is sealed as an addendum beside the frozen rule, adding the category "not verified (measurement-starved)".

  **D3, first read: the pre-flip condition is NOT met, so no flip.** S2's report shows 0 candidates. On node 1 there are 78 goals and 120 not-reached runs, 114 of them with EMPTY reasons.
  - **The cause, case C-tally-1:** reason starvation in dry-run, where the same runs are re-read every tick. The class map is also too literal, and one pattern fails to match.
  - **The fixes:**
    - (a) an S2 follow-up surgery, a D1–D4 link;
    - (b) a shaped class-map policy record, derived only from non-loop samples, with at least one non-loop match for every pattern (the no-staging guard).

    Because the class map is operator-derived, it is **counted as an operator link against D6, recognition**.
  - **Case C-phantom-2:** S1 correctly linked a real human goal to a PHANTOM walk-filed gap, so that goal now waits on a gap that cannot close.
  - **D3's date (2026-10-13T18:00Z) stands but is at risk,** and it is reported as measured either way.
  - **D3's flip was made early.** The user set `goalDeficiencyPolicy` `file_gaps` to 1 at 2026-10-13T09:25Z on the gated nodes, with 3 non-loop candidates waiting for the next R2 tick. D3 is graded by what that tick files, not by the flip.
  - **D3 MET at 2026-10-13T09:54Z, about 8 hours early.** R2 filed two goal-deficiency gaps from non-loop goals: one for a missing write artefact (4 not-reached runs) and one for an execution error (3). Both are open systematic failures, with the goal's reach verdict as their class-2 falsifier, and their birth check reads present. A third candidate was held by the per-run cap and files next tick. There were no operator hands in the filing; the user's last act was the policy flip. Both rows carry no vessel, no edit site and no check supply, which is #1's live control: they have no path to repair yet.
    - **Classification source, read from the tick's candidate line:**
      - The missing-write-artefact gap was classed by the **judge's code**. Its recognition is fully system-derived, so **D3 counts on this gap toward D6.**
      - The execution-error gap was classed by the **operator map**, a legacy entry classed before the judge-code-first follow-up. It is marked operator-linked. Reclassification moves it to the judge's code, under a renamed class, which produces an accepted duplicate.
      - The third candidate, not yet filed, was classed by the judge's code.
    - **D3 complete:** the third candidate filed at 2026-10-13T10:10Z, classed by the judge's code. Reclassification is live: 62 entries across 35 goals were re-classed, and every candidate is now classed by the judge's code. The class-rename duplicate appeared as predicted.
    - **Pacing, under the closer-only rule:** reclassification was pushed at 09:56Z and accepted on both nodes. **#2, the deadlock fix, was pushed at 10:13Z**, well before D4. #1 is built in parallel. The serial push order from here: settlement (a judge edit the user cleared), the arm guard, #1a, a path-doubling fix, then #1b.
    - **The boredom gap (C-starve-1)** was routed scope-excluded, because its site is a protected file. That routing is correct: it is an operator or scope item, not a D10 candidate. The D10 candidates are lane-scope gaps the user filed.
  - **User ruling, about 2026-10-13T11:00Z (relayed by qa): the D-path surgery freeze.** After #1b lands, there is no new operator surgery on D-path links, with two exceptions:
    - (a) regressions that our own surgeries introduced;
    - (b) intractables: credentials, and infrastructure the system cannot see.

    Everything else found after that point is filed as a gap for the system. From then on, the surgery count is the measure of whether D10 is reachable.
  - **D4, declared now under the closer-only rule: unlikely by 22:00Z** (qa's estimate is under 40%). Its predicate needs a dry-run redispatch line, which needs a landing on a linked gap. The chain is serial: #1a's first localization tick, then #1b pushed through the gate, then a sited child filed (only an execution-trace step can be sited, and only to one file), then its check armed, then a lane fix landed, then the stamp, then the next goal-reach tick. Any single slip passes 22:00Z. If no line appears, D4 is reported **missed** at 22:00Z. The date does not move.
  - **#1a's first live run (about 11:30Z): every deficiency was a loud unknown, and none was invented.** But two of the three D3 gaps read "trace unreadable". A positive control through the same address read those runs' traces fine, so **the cause is a defect in our own #1a surgery, not retention.** There are two causes:
    - (i) a second node localized shared rows whose runs belong to the first node, wrote "unreadable", and that result then stopped the owning node from redoing them;
    - (ii) legacy tally entries without an execution id skip the fallback.

    The repair falls under freeze exception (a): attribution by ownership only, unreadable is never final, the legacy fallback is restored, and the poisoned rows are healed. The third gap is composition: every step succeeded and the goal was still unmet, so there is no site.
  - **The freeze starts** when #1b and the boredom selector fix (user-cleared, pushed 11:32Z) are both live on both gated nodes. The time is recorded when measured. The #1a repair above stays allowed after that, under exception (a).
  - **The #1a repair (#1c) is built, under exception (a):**
    - ownership is per run, and a node's write merges with other nodes' runs and records the attributing node;
    - a foreign or node-less "unreadable" is re-attributed at once by the owning node, and a node's own is retried after a shaped interval;
    - legacy entries resolve through the node's own goal-host, and the unread reason is labelled honestly;
    - the poisoned rows are healed.

    It is in review. The pre-freeze pushes went out at 11:21Z (#1b with the path fix) and 11:32Z (the boredom selector fix).
  - **Most first localizations have no repair route.** Of the first 5, 2 were composition (every step succeeded, and the goal was still unmet) and 2 were output errors. Neither kind has a route to a repair. A composition-route gap is drafted for the user to file.
    - **Law 6, the missing generator:** a loud unknown of the same kind, repeated across rows, is a measured class with no consumer. The localization pass itself should mint "this kind has no repair route". That generator is filed as its own gap.
    - **A named D7 risk, with its exact condition:** the composition-route fix sites in a lane-open file. The decomposition entry it would need lives in a protected file. The system can close it only if the fix fits entirely in the open file, calling the existing exported entry. If the lane's draft needs the protected file, the gap goes scope-excluded, and D7 becomes a scope earn-in decision for the user.
    - **D7 admits two branches:** "a learned producer or a lane landing". The composition route is on the loop's path only if D6's gap comes from S2 and the learned-producer branch does not fire. If a walk files it as a missing-producer capability gap, the mint-and-compose path can close it without the lane. Which branch D6's gap enters is open, and is read when it files.
  - **D7's two branches, measured (read-only; the whole store plus the journals): neither had a working route.**
    - **The last 14 days:** no walk-filed producer gap was closed by a learned producer or a lane landing. Of 54 closes, 51 were walk artefacts, born closed.
    - **The two producer-side routes have not run:** the "producer now exists" close last fired on 07-25. The capability-gap author route exists in code but has **never been dispatched**.
    - **The ribosome learns only from reached runs,** which is circular for a shape that no run can reach.
  - **User ruling, about 2026-10-13T11:45Z (relayed by qa): one more operator route, then freeze.** Exactly one: the dispatcher into the existing capability-gap author route.
    - **Read-only checks come first:** born-closed handling; whether a landed resolver is registered as a producer; whether "producer now exists" fires first; and where the dispatcher lives.
    - **If a landing does not register the producer,** that goes back to the user as a second decision.
    - **The freeze start moves** to when this route is live on both gated nodes. The time is recorded when measured.
  - **The dispatcher's read-only checks found the route blocked twice:**
    - capability gaps are born unarmed, so eligibility reports them "unarmed";
    - every authored resolver must register in two protected development-vessel files.

    **Also confirmed:** capability gaps with a single demander are born closed. So the loop goal's open D6 gap can arrive **only through S2**.
  - **User ruling, about 2026-10-13T11:55Z (relayed by qa), the second amendment to the freeze: "Full package, additive-only".** The package is:
    - the dispatcher;
    - contract-derived class-2 arming;
    - a narrow scope rule admitting **only additive registration of a new shape**: a new array entry, plus a new case that calls a new file, in the same landing. No edits and no removals. Must-fail controls prove that nothing existing changes.

    It is a scope widening under the user's ratchet.
    - **A must-pass acceptance item:** one S2 composition row reaches the dispatcher. There are must-fail controls for targets that are already produced and shapes that are already advertised. If the trace cannot name the unproduced target, that is said before anything is built.
  - **The run records can name targets.** The walk log records each inferred target and each shape a satisfier produced. On both composition holdouts, every inferred target **was** produced: one produced but hollow, and the other with all four produced. **So composition means wrong content, not a missing producer.**
    - The package correctly does nothing for that kind. It serves D6's public predicate, "a gap for its missing producer": deficiency rows whose inferred target has no advertised producer, plus capability gaps with at least two demanders.
    - **Wrong content has no repair route.** It is filed as a gap for the system.
    - **If the loop goal's runs prove to be wrong content, D7 is reported MISSED.** No third amendment follows.
  - **Exception (a):** #1d was pushed at 11:52Z.
  - **User ruling, about 2026-10-13T12:00Z (relayed by qa): THE FREEZE STARTS AT 2026-10-13T18:00Z, REGARDLESS.**
    - Whatever part of the package is not live by then becomes a filed gap.
    - Any new blocker found inside the package goes to the user as a decision, never as an automatic third amendment.
    - Exceptions (a), our own regressions, and (b), intractables, still apply after 18:00Z.
  - **Exception-(a) repairs:** #1c pushed at 11:43Z. A fix for reasonless legacy entries (a regression from our own S2 follow-up) follows.
  - **The boredom selector fix (C-starve-1) is live on both nodes from 11:38Z.** Its live control passed at 11:41Z: picks changed by idle decay on both nodes.
  - **Reading at 2026-10-13T13:37Z:**
    - **#1c's repair is closed by measurement.** All three D3 gaps now read their traces: two composition and one output error. None reads unreadable.
    - #1e was pushed at 12:27Z and was live on both nodes by 13:01Z.
    - **The package is built but not pushed.** A restack defect was caught by test count and fixed. The final whole-suite run is due about 15:30Z. The freeze is at 18:00Z regardless.
    - **The lane has made 0 system commits since 09:11Z.** Every filed deficiency is an unknown with no repair route, or is waiting on the package.
    - **D5:** the loop goal has not run since about 06:40Z, so there is no tally and no trace yet. That gap is within its historical cadence. **Whether its runs show a missing producer or wrong content is still unknown.** qa's watcher reports the first run, or reports D5 missed at 10-14T06:00Z.
    - **Pre-registered:** if the loop goal has not run by 2026-10-13T18:00Z (about 11 hours, roughly twice its cadence), that is C-starve-1 recurring on the one rhythm family that matters. It is **filed** as a gap (create-only, run by the user) and **never dispatched by hand.** A manual dispatch would void the "zero operator hands" grading for D5 through D9.
  - **D5 MET on 2026-10-13, well ahead of its date.** The loop goal ran by its own rhythm, with no operator hands.
    - **Correction:** an earlier relay placed the run on the wrong node. That was a text match, not a dispatch.
    - **Correction, the label:** the loop goal's label `f7145bc8` was an operator hashing error. The sealed goal text is unchanged, and is byte-identical to what the system dispatches. It is re-hashed under the system's own goal hash, and the identity correction is in a sealed, host-only addendum. The frozen files and the answer key are untouched. Even the capture taken at pre-registration time hashes to the same corrected value, so the label came from a separate operator computation whose input is not on disk. **Its origin is unexplained, and its impact is nil.**
    - **It is tallied, but its runs split across two classes, each under the 3-run minimum,** so D6 waits for its next run. One more run in the larger class files the gap, inside D6's date. A class-agnostic rule would be a decision for the user, raised only if the split persists.
  - **Reading at 2026-10-13T16:20Z: the lane is landing system checks again.** Two landed after a 5.5-hour quiet spell, both pure creates carrying the net-new sentinel base.
    - **Case C-inverted-1: a check that encodes the defect as the expected behaviour.** In goal-host `b116eb9`, the gap is that the verifier generator mints only quantitative families. The check asserts that a non-quantitative goal gets **no** family, which is true at HEAD. The arm step refused it, correctly, so the detector exists. This is a supply-quality case, and the landing was wasted.
    - **The first behaviour-level system check:** development-vessel `aedc761e`. It intercepts outbound requests, runs the resolver, and asserts that no escalation is posted. It is **armed** (class 2), but its edit site is a **protected** file, so the lane can never land its fix.
      - **Case C-armscope-1: arming skips the autonomy-scope refusal that dispatch applies.** Check supply refused a protected site for the boredom gap, but armed this one. Arming must apply the same scope refusal as dispatch. Filed as a gap for the system.
    - **The package:** an apparent 17-failure blocker was a staging artefact. A fresh clone gives 0 new failures. **It was pushed at 2026-10-13T16:25Z,** and its acceptance on the gated nodes is pending. The freeze is at 18:00Z regardless.
  - **THE FREEZE STARTED at 2026-10-13T18:00Z (the user's bound), measured.**
    - **Live at the freeze, on both gated nodes:** the whole D7 package, which is the additive registration rule, the producer-contract judge mode with its classifier branch, and the producer dispatcher. It was pushed at 16:25Z, with the restarts at 16:57Z and 17:02Z. Nothing from the package was unfinished, so no "not live" gap is owed.
    - **The must-pass item ran (17:09Z),** with correct skips and one send. **That send was a harm path:** it targeted a producer that is deliberately contained. Discovery lists only producers that are up, so a contained producer reads as a missing one. No draft and no landing happened.
    - **The freeze held because the user decided.** The class fix is a design omission in a new build, not a regression. It proceeds because the user ruled "contain then fix": a blocker found inside the package goes to the user as a decision.
    - **Law 6, the generator:** nothing minted "discovery conflates contained with missing" from the containment itself. Containment is a unit mask, not a shaped impulse the walk can read (law 1). That missing generator is a gap for the system.
    - **Containment (user-cleared, "contain then fix"):** the producer dispatch is switched off on all three nodes (verified at 17:38Z). A scope hold protects the contained producer's file, with review by 10-20. It lifts when the contained producer's own fix converges and the class fix is live.
    - **Open exception-(a) items at the freeze** (our own regressions, still allowed):
      1. **The containment class fix:** a producer that is declared but not advertised counts as contained, not missing, with a guard on the author route. It is in review, and pushes after containment completes.
      2. **The long-goal tally still misses some cut rows on one node:** a carry-back fix is scheduled.
      3. **Siting by activity id:** a candidate gap filed for the system, not built.
    - **Not exception (a):** the fetch-restore nit is in a system-authored check, so it is system work. The class-split question is a user decision, raised only if the next loop run keeps the split.
    - **Side finding:** test-hygiene leaks. Test runs leave temporary directories behind, and an old injection-test fixture wrote inert, never-executed artefacts into the live tree. One create-only gap is filed for the system.
    - **The re-enable protocol, pre-registered.** The producer dispatch goes back on **only** as a recorded user act, and only once both of these hold:
      - the class fix is live on both gated nodes;
      - a live must-fail is observed: with dispatch still off, a read-only dry evaluation (or the dispatcher's own skip line on a tick) shows the contained shape refused as "declared but not advertised". If no tick shows it, a read-only in-container run of the route test substitutes.

      Then the user flips it, verified by read-back. The class fix's estimate is live between 19:30Z and 20:15Z, ahead of the loop goal's next run. If it slips past that run, it is said then, and D7's slack is counted from D6's filing.
    - **The re-enable protocol ran (2026-10-13, about 19:30Z).** The containment class fix's live must-fail passed on both gated nodes: the contained shape is refused as "declared but not advertised". The user then re-enabled the dispatch on those two nodes, one recorded act per node, at 19:39Z and 19:42Z. Before each, the containment check passed on that node: the live code refuses the contained shape, an undeclared control is not refused, and the scope hold is present. Both were verified live, with the other fields unchanged. **It stays off on the hub,** whose development-vessel has not converged since about 13:00Z.
    - **Classified: a test-gate budget deadlock.** The gate needs about 1,758 s for its two-run overlay, against a 1,680 s budget, so it has deferred on every tick since about 13:00Z. The mechanism was already there, and today's suite growth (ours) made it fatal on the slower hub. **The system detects it:** it filed the gap itself. But the repair lies in excluded paths, so it cannot reach it. It is put to the user as a choice: exception (a), because our suite growth tipped it, so an operator fixes it; or a scope earn-in that opens the gate-budget configuration to the lane.
      - **User ruling (corrected): exception (a).** The pull-sync unit's start timeout goes from 1,800 s to 3,600 s, fleet-wide, through the rendered units. The gate fits four runs per tick, with a cap of the budget divided by four, so a shaped cap alone could not help.
      - **Filed for the system:** a deferred gate restarts from scratch instead of resuming.
      - **It is not exception (b).** (b) covers what the system cannot see, and the system filed this gap itself.
      - **Compare the owed-restart fix,** which was classed (b) on the opposite fact: nothing had detected the stale pins it found.
    - **A stale-pin finding, from the owed-restart fix (accepted 19:32Z).** Its baseline at once re-pinned stale last-good records on one node: development-vessel; two vessels pinned about 35 hours stale; and one pinned about 9.8 days stale. **Law 6, the detector:** nothing reported a last-good pin days behind its running content. A pull-sync or self-fact row that compares pin age with content age would. Drafted as a create-only gap for the system.
    - **The first substantive system source fix since the freeze:** development-vessel `d43725a1` (2026-10-13T18:06Z), with a real base. It keeps a local refusal from being overwritten by a later connection error. **The system graded it partial and unverified itself, which is honest self-grading. It is not a verified repair, and verified repairs stay 0.**
      - Its armed class-2 check reads green, and the gap closed on that check's exercise. Red-before is not separately evidenced.
      - Settlement recorded it as landed but unverified: it landed over the semantic gate's non-blocking dissent ("does not address the underlying cause"), so a post-land check by effect is required. It closed as partial, and a re-commit follow-up was minted.
      - The new per-endpoint failure list has no reader, so it is diagnostic only (a hollow write). The change in refusal behaviour is real.
      - A residual remains: a later refusal still overwrites an earlier one.
    - **Hub converged:** the 1-hour unit timeout is live on all three gated nodes, read back from systemd. The hub's development-vessel gate finished inside its cap at 2026-10-14T00:17Z, and the vessel converged after about 11 hours.
    - **D4 MISSED (2026-10-13T22:00Z).** No dry-run redispatch line appeared on either node between 10:13Z and 22:00Z. The date does not move. (The verdict reached this record late, at 2026-10-14T00:33Z.)
    - **D6, graded honestly split.**
      - **Recognition MET:** at 2026-10-13T23:48Z the system filed an open, goal-linked deficiency gap for the loop goal, with no operator filing, about 30 hours early. The loop goal's runs reached the 3-run minimum in one class.
      - **The missing-producer form is NOT MET:** the system itself reads the failure differently. Localization reports composition, 3 of 3 (every step succeeded and the goal was still unmet). The producer dispatcher skips the row: "target produced; not a missing-producer deficiency".
      - **The classification came through the operator policy map, not the judge's code,** so recognition carries an operator link. Reclassification moved entries to the judge's code only where a run's reason carried a deterministic judge token. The loop goal's runs carry judge prose, which the operator map's pattern classes.
      - **S1's link is inferred, not observed:** R2's filing writes the goal-reach demand itself, and the next tick shows linked gaps waiting. No line names this gap explicitly.
      - **The dispatcher's skip is measured on this row,** not inferred from the earlier holdouts.
    - **D7 consequence: below 5%.** The system sees the loop goal's failure as wrong content, which has no repair route. That route gap is filed for the system, and under the freeze nothing is built for it. D7 is reported **missed** at its date. The date does not move, and there is no amendment.
    - **A flaw in our own package (exception (a)):** the producer-contract check arms with no required keys for undeclared shapes, so any substantive body closes it. Reuse-before-mint matches exact names only. The first live instance is a gap minted from an investigation goal's inferred output name.
      - **The fix:** refuse to arm without a declared contract, so the falsifier reads unknown.
      - **Filed for the system:** reuse by exact name only.
    - **A second substantive system fix since the freeze:** development-vessel `f2c04fc2` (2026-10-14T00:12Z, real base). A 200 response that was not an attempt no longer resets the gap drain's backoff. Like the first, it came from a re-commit gap that the system's own settlement minted. Residuals: a silent outer catch, and a judge import in the dispatch path. **Graded the same as the first:** its own check is green and the gap closed, but settlement recorded it as landed unverified over a semantic-gate dissent, and closed it as partial. It is substantive and self-graded partial, not a verified repair.
    - **Another invented check on a protected site:** development-vessel `6a7ac0e9` asserts that string elements carry an id field, which only a return-type change could satisfy. It is **armed** (class 2, 2026-10-13T22:30Z). Its edit site is excluded on two nodes, but open on the one node running the sanctioned scope experiment. It is not strictly a tautology. It is C-invented: it can go green only through a change to the function's return type, and that would break the function's real callers.
      - **Pre-registered before any close:** a close of this gap through a commit that changes that function's return shape is **disqualified for every grading, and treated as a regression.** The typecheck and the gate should refuse it first. This is the main evidence for the scope experiment's 10-17 review. The user has been offered an early close of the experiment.
    - **The other behavioural check (activity-api `f248d7a`) was refused at arming, correctly.** Its edit site names a directory plus a symbol, not one exact file. The landing was wasted. This is a supply-quality case: the edit site is not a file.
    - **User ruling, 2026-10-14 (relayed by qa): close the loop this week, with measures authorized on a DETERMINED incapability.** This is a decision under the freeze's own clause: a blocker goes to the user, and the user decides.
      - **The determination (read-only):** the loop goal names a target that no vessel declares or advertises, so the walk substitutes an advertised shape. R2 then classes the failure as wrong content, and wrong content has no route. The producer route is dormant without declared contracts. An operator cleanup of single-demand capability gaps (2026-09-28) had closed the named shape's capability gap.
      - **Prior art (after the user's correction, "nothing is new"):** every link already exists. Two restrictions block the chain:
        1. Goal-target inference keeps an explicitly named shape only if it is already advertised.
        2. The capability filer's single-demand rule, which an open plan item (contained self-development 8.14, "revisit for recurring demand") was meant to revisit.
      - **The measure:** both restrictions are adjusted in the existing goal-host code. This is operator-built, in protected paths, and user-cleared, and it completes plan item 8.14. After that, the system's existing route carries the loop: the filer, the link, the author route, additive registration, and the re-run.
      - **Landed:** goal-host `b1844e4` and development-vessel `1d75af33` (2026-10-14, about 02:00Z). Plan item 8.14's recurring-demand half is complete, and its evidence half is superseded (annotated in the plan). The chain is now complete through existing parts. The loop goal's next run is the first test.
      - **Pre-registered reading of the first test (written 2026-10-14T03:15Z, before the run):** the first test of the wired chain is the loop goal's next run. Read in order:
        1. the filer files the capability gap;
        2. S1 links it to the goal;
        3. the dispatcher sends it, armed on the goal's own reach;
        4. the author route starts.

        **The first link that does not fire is the finding, and nothing downstream of it is inferred.** **Added 2026-10-14T06:05Z, before the run:** the host that runs the loop goal measured a load average of about 46 on 16 cores at 06:03Z, and was swapping heavily. If the load average is above 10 at run time, a link that fails by **timeout** is unattributed (the forensics rule), so the finding is "not measured", not "did not fire". Links that fire under load still count, and the load is recorded at each link. By user ruling (relayed by qa), the operators' lab load is paused from 07:00Z to 08:30Z for the run.
        - **A prediction, pre-registered at 2026-10-14T06:36Z, before the run (qa, from measurement and code):**
          - **Measured tonight:** all four producer sends armed on a goal's reach were refused at admission as "held", and no drafting started. Earlier sends armed on a contract had 4 admitted and 2 held.
          - **The mechanism:** a capability gap is born unarmed, so the check-supply tick marks it as needing localization, which is a "held" reason. The producer dispatcher then arms and sends it **without clearing that mark**; only check supply's own arming write clears it. Admission reads the held row and refuses. The dispatcher has already stamped the send, so its 6-hour cooldown blocks a resend.
          - **The predicted outcome:** links 1 and 2 fire, link 3 fires on the dispatcher's next tick, and **link 4 fails as "held" if check supply marked the row first.** That is a race, not a certainty. If it fails, there is no retry for 6 hours.
          - **Its classification:** a defect in our own D7 package (exception (a)), to be fixed **after** the run. There is no test window at this load, and a fix now would confound the measurement.
          - **This names only the mechanism to check if link 4 fails.** The reading stands: the first link that does not fire is the finding. The code must be live on the node that runs the loop goal, not only on origin, or the run tests nothing.
      - **A finding measured before the run: the recurring-demand rule was wider than its description (exception (a)).**
        - **What happened:** the demand rule opened capability gaps for model-*inferred* output names on a goal's first demand, bypassing the two-demander rule (plan item 8.15). There were 6 open filings between 03:18Z and 04:05Z. One was sent to the author route, armed on its goal's reach.
        - **The mismatch:** the plan note says "a deliverable a goal names verbatim", and the code did not match it.
        - **User ruling (direct): "Restore 8.15 only".** A recurring goal now counts as demand only if it is already among that shape's demanders. The fix is folded with a distinct-run fix, and is due live on the loop goal's node before the run. The misfiled gaps are left to the system.
        - The loop still files, because its shape's row already carries the loop goal.
        - **The restore landed as goal-host `85be5ea`** (pushed 2026-10-14T04:30Z, with the distinct-run fix folded in). It was live on the loop goal's node from 04:44Z, before the run. The hub's restart was deferred, but the hub does not run the loop goal. The test that the goal is "already on the row" is an exact string match, and the loop goal's text matches byte for byte. A second misfiled gap was sent to an author route at 04:18Z, before the restore went live. It is left to the system, per the ruling.
        - **Classification for D9:** the restore acts on a general rule, not on the loop goal or its gaps, so under the post-07:30Z rule it does not make a link assisted. It was made before the run, so the chain under test is the demand rule *plus* this restore, and the close route stays assisted as already recorded.
      - **D7's grading fork, pre-registered (2026-10-14T05:00Z), with the user's choice open.** A capability gap with no declared contract is armed on its demanding goal's own reach, which has two readings:
        - **(i) The consumer's reach counts as D7's verification.** D7 and D8 are graded as one event, and D7 is never credited before the reach. An unknown settlement counts as not verified. If the sealed key disagrees at D9, D7 and D8 fall with it.
        - **(ii) D7 must stand on its own check.** An undeclared shape cannot have one, so D7 is reported missed, and D8 is graded separately.

        **Under either reading, D7 gets no credit until the user chooses.**
      - **User ruling, 2026-10-14T05:00Z: D7 is reported MISSED.** This takes reading (ii): D7 must stand on its own check, and an undeclared shape has none. D8 is graded separately, on the loop goal's reach.
      - **User objective, the same ruling: observe the system complete a run of clean, consistent edits as soon as possible, without hand-fed gaps.**
        - "Hand-fed" covers any gap that an operator files, arms, sites or writes the predicate for.
        - The measure is consecutive system landings on system-originated gaps that are each verified (red before the edit, green after, at the consumer), with no operator act on the gap.
        - **This, not the loop's links, is now the headline.** The verified-repairs count stays 0 until such a landing exists.
        - **The exclusion, as computed today:** a gap counts as hand-fed if any of these hold:
          - it was filed by a person (1,163 rows, 959 open);
          - it carries an operator marker on its row (882 rows, 70 open);
          - it is named in an operator push script, filing record or arming record since 2026-09-28, or in the operator write ledgers. These include, for 2026-10-12 to 10-14, 13 creates, 6 evidence appends to existing rows and 1 rewrite, plus every create-only filing the user ran.
        - **A hole in the measure:** arming, siting and predicate acts leave no mark on the row. Exactly 1 row in about 8,500 records who armed it. So "no operator act on the gap" cannot yet be computed by the system itself.
          - **Filed for the system:** a gap write by any principal other than the system must stamp that principal and the act on the row. Until it closes, the exclusion relies partly on operator records, and is labelled that way.
          - **It is filed and verified open.** Inheritance is in its falsifier: a gap minted from a parent that carries operator acts carries them too. The prior art is the refusal-record writer's principal field, in the same file.
          - **Every candidate file for it is scope-protected,** so closing it needs either a scope earn-in or an operator build.
          - **User ruling, 2026-10-14 (direct): a scope earn-in, additive only.** The lane may add to the gap-write path of the protected file: new fields stamped on a gap write, and a new helper in a new file, called from that path. It may not edit or remove existing behaviour, and must-fail controls prove that nothing existing changes. This follows the additive registration rule's pattern.
            - The rule's mechanism, the scope record plus its self-fact pin and controls, is an operator act on the scope record, under the user's ratchet. It is **not** an act on the gap.
            - **Re-ruled by the user (relayed by qa, about 2026-10-14T05:55Z): no inserts in the judge.** A brief widening to the judge's child-mint calls was superseded once it was shown that follow-up gaps are also minted elsewhere, by single-line literals.
              - **"Read-time":** inheritance is computed when the headline is counted, by walking each gap's parent, source and root links. A superseding gap filing moves the falsifier's inheritance clause there. It is drafted, not yet filed.
              - **"Yes, bound it":** the new helper file must be pure: no imports, and no access to the process, the network, the runtime or dynamic evaluation.
              - The route-half scope build exists but is not pushed. Its whole-suite test pair waits for the load to fall below 10.
            - **The gap's closure is the system's to do, but it does not count toward the headline.** The gap was filed by a person, so it is hand-fed under the exclusion above. Its close makes the exclusion **system-computable**, and that is what lets *later* headline landings be counted without operator records.
      - **Operator landings since the freeze, each with its authority:**

        | Landing | Authority |
        |---|---|
        | Containment class fix | User: contain then fix |
        | Hub gate timeout | Exception (a) |
        | Keyless-arming fix | Exception (a) |
        | Named-target and demand rules | User ruling on a determined incapability |
        | Goal-reach arming | Same ruling |
        | 8.15 restore | Exception (a) |
        | The hub's trace store made openable to every IPv4 source (`c9bf55f6`) | User ruling, "the hub is not walled; protection lives in authentication"; pushed by qa on the user's direct confirmation |

        The last is not a D-path change. It is a §16 O2 movement: the hub's hand-maintained allowlist **would go to none once the user applies it. It is not applied as of 2026-10-14T05:00Z.** The push ships only the script mode, and the hub keeps its allowlist until the apply is run. The freeze now operates as **the freeze plus user rulings**, with every act named.
      - **THE RUN'S READING (2026-10-14, about 07:14–07:19Z): link 1 did not fire, and the finding reverses the determination.**
        - **Load:** the host was above 10 throughout, but nothing failed by timeout, so the result is attributable.
        - **Named-target inference worked:** it kept the target the goal names instead of substituting an advertised shape.
        - **The walk found an existing template that emits that target shape.** It was created in July, it declares the target as its output, and the goal's own text points to it. Across the loop goal's earlier recorded failures this template was never picked; keeping the named target is what led the walk to it.
        - **The judge graded its output hollow, correctly.** The final step emits content that still holds unrendered references to the earlier tasks' outputs, although those outputs were in the pool. The feedback retry found no pick, the floor ran, and the result was not reached.
        - **Link 1 did not fire:** no capability gap was filed. R2 left the failure unclassified, because the class map has no class for "lacks computed values". Links 2–4 were not tested, and nothing downstream is inferred.
        - **What this reverses:** the producer exists. Our determination ("no vessel declares or advertises the target") confused advertising with declaration, because discovery does not list activity outputs. **The capability-gap route was the wrong route.** The defect is **template binding**: an emit step does not substitute task-output references. That is wrong content with a real site, not a missing producer.
        - **Law 6, three questions:**
          - **The instance:** the binding defect, in the executor's emit step or in the template. Under the freeze it is the system's to repair. A template variant is the cheapest repair (law 2).
          - **The class detector:** a hollow-output verdict whose content contains unrendered references should be filed as a binding gap with a site, not left unclassified.
          - **The missing generator:** nothing turned "the judge says hollow: unrendered references" into a gap. That generator is itself a gap for the system.
        - **Our own error, recorded:** the 2026-10-14 determination was wrong in its premise, and the operator wiring built on it (filing a named target as a capability gap, and arming on goal reach) aimed at a route this goal does not need. The keep-named-target change still proved useful, because it surfaced the real producer.
      - **ROOT CAUSE (read-only, from the live executor code): sibling-task binding has been broken fleet-wide since 2026-08-01.**
        - **What broke:** the engine binds a sibling task's output as a bare task-id reference, its documented convention. Since then, that key receives an undefined property instead of the output.
        - **The scope:** every engine-run template that uses that convention has bound nothing for about 10.5 weeks. The loop goal's template is one. A census of the others is running.
        - **What caused it:** a system-authored landing on 2026-08-01, a one-line change from a route-edit compose. It changed a binding line, had no test for it, and passed its gates.
        - **Law 6:** nothing detected it, because the unrendered-reference guard covers gap summaries only, not emitted impulses.
        - **Law 12, a learning confound:** for those weeks, selection and credit graded these templates on output that was hollow by construction. Their posteriors and any extractions over that window are suspect until the census bounds them.
        - **The engine fix** goes to the user once the blast-radius count is in.
      - **User rulings (relayed by qa):**
        - (A) File the **missing generator** as a gap: a hollow verdict whose content carries unrendered references becomes a binding gap with a site. File the generator, not the instance.
          - **Redacted, 2026-10-14T09:49Z (user-run, verified):** the gap's summary, measured evidence and falsifier specification were rewritten generically, to remove wording that identified the loop goal, and the redaction is recorded on the row. This is an operator act on a gap that was already hand-filed. The system's check supply picked the gap up at the same moment.
        - (B) File the dispatcher-hold defect in our package for the system's lane.
        - (C) Close two single-goal capability gaps that our demand-rule regression opened, through a reviewed script run by the user, as born-closed walk artefacts with evidence naming the regression. This is an operator act on those two rows, so **both join the headline exclusion.** The other five rows from that window each have at least two real demanders, and are left to the two-demander rule.
          - **Done:** the user ran the script at about 2026-10-14T07:52Z. Both rows were verified closed.
      - **The census, read-only so far:**
        - Only the resolver-task binding path is broken. The nested-activity path binds correctly.
        - **The engine file is lane-editable.**
        - The blast radius, as a lower bound, is the loop goal's template plus one seed template whose model task ran on literal placeholders. About 20 other dotted references are unverified. The full count and the posteriors need a credentialed read.
        - No open gap covered the defect.
      - **A premature close, corrected: it was an operator close.** On 2026-09-24 a gap about exactly this class was closed by an operator, on a prose falsifier with no machine check. That operator's own probe showed the reference was still literal. But the recorded exercise left that case out and reported a pass. The store's close guard checks only that the pass field is a boolean. **This is operator-assisted success on the closing side,** not the system ignoring its own check. **By user re-ruling it is folded into the existing rows on prose falsifiers and operator exercises, with no new row. The durable fix is arming.**
        - **The evidence:** the gap closed on 2026-09-24 was "the template provider blanks every placeholder at load time", with the closed reason `predicate_verified_by_operator`. Its falsifier was "unresolvable", and it had no evidence resolve, so there was no machine check. The recorded exercise said it passed. But the operator's own summary of the same probe shows the bare task-id reference still literal after the fix.
        - **Why it stayed hidden:** that residue was the engine regression from the 2026-08-01 system landing (`b3b84111`: the bare key is bound to an unset execution id). The blanking provider masked it until 09-24. It was found on 10-14, when a standing goal's template emitted unrendered placeholders.
        - **The law reading:** an operator-assisted reach is not success, and that applies on the closing side too.
        - **The durable fix is arming:** the engine gap is filed armed on a test-suite check, committed to the executor repository as `1cf8c878`.
      - **User rulings (relayed by qa):**
        1. **The engine fix goes to the system's lane, filed and armed.** It is a hand-armed instance, so it does not count toward the headline. But it is a one-line, single-file fix with a known site, which makes it **the cleanest test yet of whether the system can repair itself.**
        2. ~~File the class "a close that ignores its own falsifier's failing output".~~ Superseded by the re-ruling above: it is folded, with no new row.
        3. **A credentialed census of templates and posteriors, read-only,** with the key passed on standard input and no database connection.
      - **User rulings, 2026-10-14 (relayed by qa):**
        - **The stamp earn-in is pushed:** development-vessel `7e6f6d7e`, at 08:03Z, after four review rounds, with 0 new failures against a base run taken at the same time. The times it goes live follow.
          - **Correction: the stamp earn-in is live on two gated nodes and REFUSED on the hub.** The hub's gate attributes 4 newly failing tests to it: our own chokepoint controls. The hub's development-vessel is held behind it, including the system's own landing of 09:11Z. **Corrected again, from the hub's gate output: the refusal is environmental, not our rule.** In the hub's test environment, the cutover's scope check excludes nothing. So the existing registration controls and about 11 other tests also fail there: protected fixture paths land instead of being refused. Our new controls show up as "new" failures only because they are new. **This is an existing test-isolation class (a live-environment leak into the gate's scope source). The controls are not weakened in the tests.** The path is being traced.
            - **The live hub, positive control (read-only, the last 72 hours):** the live hub enforces scope **at compose**. At 2026-10-14T03:02Z it withheld a favourable verdict on an autonomous compose that touched an excluded path. Its live scope record is non-empty. **The cutover-layer check is unexercised on the hub:** no cutover landings in that window. So it is neither confirmed nor refuted. No live probe is manufactured to test it, because a deliberate landing on a protected path would be an operator act on the live lane. **Traced: the live cutover fails closed.** The gate test and the live cutover share one scope source, read from the node's own record. An unreadable scope treats every path as excluded and refuses, and the picker and admission withhold too. So the hub lane cannot land on protected paths on a bad read, and **this is not a security item.** The test symptom means the test read a scope record that was readable but wrong, such as a leaked default fixture or a stale cache. That is a **fixture-isolation defect.** The hub's next gate block will pin which.
            - **Refined:** the hub's 27 failing real-cutover tests, including pre-existing suites, share **one signature.** The cutover reports "applied" but commits and pushes nothing, even with the scope deliberately unreadable. The scope read itself works. So on the hub, something cuts the cutover short **before** the scope gate, most likely a hub environment setting that the tests do not scrub. **Protection holds, since nothing lands. But a false "applied" result is possible if the same path fires live:** a report of success with no effect, which is the class this whole effort exists to remove. It is being located. The stamp rule is not implicated. **Checked (read-only, the landing-verdict code): the no-op path cannot be graded as landed.** A close requires an applied result that was pushed and carries a new commit hash. The verdict code lists skipped, local-only and unpushed results explicitly as not a genuine land. The sweeps also check that the landed commit is an ancestor of the clone's head. **What remains is only a misleading "applied" in logs and traces, not a hollow landing.**
          - **The stamp gap is not armed by anyone.** Its falsifier is none, and the system's check supply has picked it up to write its failing test. So its close path is entirely the system's own: check supply, then a compose, then a landing under the new earn-in, then its check. It is still hand-fed by **filing**.
      - **The bottleneck for the headline is now measurable: check supply's success rate.** On one node overnight, 4 of about 180 check-supply goals reached. Every system-originated gap must pass through check supply to become closable. **At that rate, the earn-in and the lane sit mostly unused.** The headline moves only when the system can write a failing test that is red for the right reason. That is where its own repair effort pays most.
        - **The breakdown (one node, the last 24 hours, read-only):**
          - **A. Never dispatched, the largest bucket, and invisible in dispatch counts.** 153 open re-commit gaps, minted by the system after a semantic rejection, carry no falsifiable anchor. Check supply re-evaluates each of them on every tick, logs "no falsifiable anchor", and never arms them. **They are permanently unclosable,** and generate about 1,000 log lines a day per gap. No row names the cause: these children are minted without their parent's anchor.
          - **B. Dispatched: 177 dispatches over 138 gaps, 4 reached.** Of the 173 failures:

            | Reason | Count |
            |---|---|
            | **Throughput, not quality:** the compose lane was busy | 94 |
            | **Throughput, not quality:** the per-goal dispatch cap | 36 |
            | Unfavourable, with no reason recorded (an observability gap in itself) | 20 |
            | Refused for writing outside the gap's check file | 9 |
            | Other (unreadable ledger, admission, unparseable re-draft, compose failures with no detail) | 14 |

            The two throughput rows together are 130, or 75%.
          - **What this changes:** the headline's first blocker is **anchorless children and lane throughput**, not test quality. Quality cannot yet be measured, because unfavourable verdicts record no reason.
          - **The missing generator:** no gap and no self-fact observes check supply's yield, or the set that can never be dispatched. The user filed both, and they are verified open. The first, the yield and the never-suppliable set going unobserved, includes recording the reason for an unfavourable verdict. Its site is lane-editable. The second, re-commit children minted without their parent's anchor, sits in a protected file, so it waits for a scope earn-in or an operator build.
          - **Law 1:** the compose lane's capacity is a code constant, and check supply and fixes compete first-come, with no priority. A constant is as unlearnable as an environment variable. It is offered to the user as a third gap.
          - **The engine check was pushed to the executor repository at 08:08Z,** as an operator commit. The armed gap is filed once the check is readable where the test suite runs.
        - **The engine check is committed, then armed:** one check file goes into the executor repository, as an operator act. As pre-registered, the engine instance is hand-fed.
      - **PRE-REGISTERED GRADE for the engine binding fix (written 2026-10-14, before it is armed and before any lane attempt).**
        - **It counts as a verified system repair if ALL of these hold.** It is hand-armed, so it **never** counts toward the headline.
          1. The armed check is red at HEAD and green after the landing.
          2. The change is confined to the binding code and its file, plus test files.
          3. There are 0 **new** failures against a base run of the same suite taken at the same time. Pre-existing failures do not grade the repair.
          4. **Controls, shown by test:** the suffixed binding forms and the nested-activity path are unchanged.
          5. The lane's own check ran, and settlement is verified, not partial or unknown.
          6. **Live evidence:** the next run of an affected template after convergence emits computed values, not literal references. The loop goal's next run is the natural positive control, and any earlier affected run also counts. **Only the binding is graded here.** Whether the goal then reaches is a separate measure.
        - **It is disqualified by any of these:**
          - special-casing one template;
          - changing the reference form in templates instead of fixing the engine;
          - editing or weakening the armed check or its test;
          - disabling interpolation, or stripping placeholders so the output merely looks non-literal;
          - touching files beyond the binding file and test files.
        - **The review date is 2026-10-17T18:00Z.** If nothing has landed by then, the finding is **"not repaired in the window"**.
        - **Armed (2026-10-14, about 08:18Z):** the user filed the engine binding gap. It is verified open, with a class-2 falsifier, and its birth verdict reads present: the check found the defect at the check commit, so the gap is correctly born red. The lane picked it up at once, and deferred while another compose was in flight. **The grade above applies from this moment.**
        - **LANDED by the system: executor `0e01b34` (2026-10-14T13:03Z, about 4h45m after arming, with a real base).** It is a one-line change in the engine: the bare task key is now bound to the task's first output, the same value as the text-suffixed key, instead of to an unset id.
          - **Disqualifiers, read from the diff:** none apply. It is confined to the binding line, with no template edit, no edit to the check, and no special case.
          - **The grade so far (2026-10-14, about 14:30Z):**

            | Item | Reading |
            |---|---|
            | 1. Red, then green | **Partial.** Born red. The check now reads green at head on one node, but settlement waits for that node to serve the new build, and the gap is still open |
            | 3. 0 new failures | **Pass,** on the gate's own comparison against its parent: accepted with no regression line |
            | 4. Controls | **Pass: 4 of 4** in a fresh-clone run at the landing. The armed case flipped against the check commit as a control at the same address |
            | 5. Own-check and settlement | **Pending** |
            | 6. Live binding | **Set up.** The fix converged on the loop goal's node at 14:15Z, so the next run is a real test of the binding |

            - **Item 6, live: PASS (the loop goal's run, 2026-10-14T15:43Z, with the fix live on that node since 14:15Z).** The emitted report carries **no unrendered references.** One section now holds real computed values.
            - **THE ENGINE FIX'S GRADE:**

              | Item | Result |
              |---|---|
              | 2. Confined diff | Pass |
              | 3. 0 new failures | Pass |
              | 4. Controls | Pass |
              | 6. Live binding | Pass |
              | 1. Red, then green | Pass, by the check |
              | 5. Own-check and settlement | **Own-check passed** (it ran, with nothing red, and the cutover's own check passed). **Settlement is blocked by the library-served defect.** Under the user's ruling it is graded on the check plus the served state |

              **It is the first VERIFIED SYSTEM REPAIR by measurement: system-landed, confined, and verified at the consumer.** Two notes keep it honest:
              - by the strict pre-registered bar, item 5's settlement was not met. The user re-ruled how item 5 is graded, after the defect was found, and before this reading;
              - it was hand-armed, so it is **not a headline landing.**

              **Verified system repairs: 1.**
            - **D8: the loop's blocker moved.** It is no longer "references never bind", which the system fixed. It is now "the count step receives a stub on the loop goal's node". Both count sections are bound, but to empty text, because their producing step got a stub report: the producing service is masked on that node. The run was still judged hollow, not reached. Whether this is a placement problem or a resolver mismatch is under read-only investigation.
            - **Items 1 and 5 are blocked by a new finding, not by the repair.** The landing verdict maps the landed repository to a service unit of the same name. A library has no unit, so "not served here" fires forever on every node, and the gap can never settle by measurement.
              - **The fix is served:** the executor build was rebuilt with the new line on both nodes, and its consumers restarted afterwards.
              - **User ruling:** file that gap (its site is protected). **Filed at 2026-10-14T17:15Z and verified open.** Grade items 1 and 5 on the check plus the served state, and record the gap's open status as that defect, not as a non-repair.
          - **D8's expected reading is amended before the next run:** if the fix has converged on the loop goal's node before that run, the pre-registered "expected hollow" no longer holds, and the run becomes the live positive control for the binding (item 6).
        - **The census also counts the learning,** not just the templates: posteriors and any extractions of the affected templates over the window. The question of whether the executor had any test binding that convention at the time is open. If it had none, "a binding line changed with no covering test" is the landing-time class.
      - **The census of affected learning (read-only, user-run):** of about 2,830 templates, 47 use the bare sibling reference (dotted forms not counted). **Correction:** the detector matched whole task objects, prose included, so **47 is an upper bound.** The heavily used drafting activity was a **false positive:** its reference sits only in a description. It is dropped from the damaged set, and a configuration-only count may follow. The standing goal's template is a real configuration binding. No extractions from them were found (by heuristic).
        - **About 35 are cold** (posteriors near the prior), so the effect on learning is negligible.
        - **About 8 carry the damage:**
          - a heavily used gap-closing drafting activity, with one broken binding;
          - the standing goal's template;
          - **four validation ticks;**
          - one seed;
          - one note-index activity.
        - **The serious part is the optimistic posteriors.** The standing goal's template and the validation ticks were credited as successes while they emitted literal placeholders, **because they were graded on exit, not content.** The validation ticks are part of the system's own grading machinery. **These beliefs will not correct themselves after the engine fix unless grading reads content.**
        - **Law 6, the class:** an execution credited as a success on its exit status while its emitted content is hollow. This is the system-side form of the CLAUDE.md rule "`reached`, not `status`".
        - **The doubt does not spread into verdicts.** The four validation ticks only write to the store, and have been dormant since 07-23. Their outputs have no readers, and no verdict, close or settlement used them (0 of about 5,000 closed rows). Their inflated posteriors affect selection only, and mostly predate the 08-01 regression.
        - **No mechanism can correct a posterior over a window.** The only ledgered posterior correction never touches the success counts. Decay is global and unrecorded, and retiring a template or minting a variant acts on the whole template.
        - **User rulings (relayed by qa):**
          1. File the tick-path credit class: the generic signature detector reads the task configuration **after** interpolation, so a success whose content carries unrendered references earns no credit.
          2. **No reset of learning state.** ~~File "no ledgered correction of the success count exists".~~ **Re-ruled: folded into the existing gap** (open since 10-07: an operator-ruled posterior correction has no typed channel, so a law-12 reversal could only be a database hand-edit). **No new row.** The finding is kept here as evidence: generalise the existing compensation replay to success counts and context scores, under the same authorisation and ledger.
             - **The evidence for that gap, recorded here with no row and no act on learning state:**
               - **The only retroactive, ledgered posterior correction is the failure-leak compensation replay.** It works from a frozen, pinned list for each node, an operator-attested authorisation row with a review date, a compare-and-set write in one transaction, and a unique before-and-after ledger row. It corrects failure counts only, never touches context scores, and does nothing once complete.
               - **Every other path fails this case:**
                 - global time decay is untargeted and unrecorded;
                 - automatic retirement fires only on a low mean;
                 - a variant leaves the inflated parent its credit;
                 - withholding failures works only going forward, and only on unreached walks;
                 - re-registration recounts the hollow successes.
               - **The measured case:** about 8 templates carry posteriors inflated by successes that were credited while hollow. One is the standing goal's template, which is strongly optimistic. The others are validation ticks, at about 75/10, 43/4, 28/4 and 7/2 successes to failures. The ticks feed no close or settlement verdict.
               - **Scope note, no action:** the compensation code is lane-editable. That is acceptable, because applying any replay needs the operator-attested trust-root authorisation row.

          The system is to earn the correction, not the operator.
          - **Filed, 2026-10-14T09:42Z (user):** ruling (1), the tick-credit class: the signature detector cannot match an unrendered placeholder in a task's resolved configuration. Its site is lane-editable, and it is verified open.
      - **A system-written check with a fixture that does not match its function** (development-vessel `73899581`, 2026-10-14T09:11Z). Check supply wrote and armed its own check here, and that part worked. The gap was filed by a person, so it is hand-fed regardless.
        - **The defect is the check's validity.** The fixture puts the edit site under a key the function never reads. So the function sees no edit site, and the test is red **because of the fixture, not because of the claimed scope defect.** A correct scope fix would leave it red.
        - **The class is a fixture-shape mismatch,** red independently of the defect. Its home is the filed tautology and mutation detector.
        - **Pre-registered before any landing:** a close is **disqualified** if the check turns green through any of these:
          - reading the edit site from a key other than the two the store uses;
          - a blanket refusal of gaps that have no edit site;
          - editing the check file.

          A valid close requires the function to consult the scope exclusion for an edit site read from the store's own keys, shown by a corrected fixture. **Until the check is corrected, no valid close is possible.**
      - **The engine gap is queued, not excluded.** It is armed, with 0 attempts, about 90 minutes after it was armed. The compose slots are saturated, and the lane made about one pick in that time. This is the law-1 capacity constant in practice.
        - **Filed, 2026-10-14T09:42Z (user):** compose capacity and admission order are code constants, so the system cannot see or learn who gets a compose slot. Its site is protected, so it waits for an earn-in or an operator build.
        - **A durability case (gap triple, measure 3):** this is a **recurrence** of a 09-22 gap about compose-lane starvation. That gap was closed as "expired, not re-detected", which is an idle expiry, not a fix. The same problem came back under a different name.
          - **The system already has a gap for this class** (filed about 07:30Z): nothing links a new gap to earlier rows or designs of the same class, so durability goes unmeasured. Its falsifier sorts gaps into recurrence, never closed, and first seen, and its site is lane-editable. **This capacity recurrence is a fresh positive control for it.** No new gap.
      - **D8, the expected reading pre-registered (2026-10-14T10:00Z, before the loop goal's next run):** the engine binding is unfixed and unconverged. So the next run is **expected** to emit unrendered references again, be judged hollow, and read not reached. It will not test links 2–4 either. This is recorded as expected, not as a new finding.
      - **The headline is structurally unreachable for now (as of 2026-10-14T10:00Z).** The system's own supply is blocked:
        - 153 anchorless re-commit children cannot be closed;
        - deficiency rows of the wrong-content kind have no route;
        - check supply's yield is about 2%.

        Every repair to that chain since the 05:00Z ruling was filed by the user: seven gaps, all hand-fed, so none of them counts. **The headline can first move only after the system closes those hand-fed supply gaps, and then its own supply produces an anchored, sited gap.** That is at least two steps away.
      - **User ruling, 2026-10-14 (relayed by qa): "b", an operator-built additive capacity change.** The lane is starved, so it cannot build its own fix. The change adds a **shaped** compose cap, with today's 4 as its default, and admission priority for armed gaps. It goes through the same review path, and the user confirms the push. It is an operator landing on the filed capacity gap, which makes that gap hand-fed. The priority rule is behaviour, so it must be a shaped record, not a constant (law 1).
        - **Correction: the gap named the wrong constant.** The in-process guard of 4 does not bind. **The binding cap is the cross-process slot cap, read from an environment variable** (law 1, a direct instance). It defaults to 2, so after the directed reservation, autonomous composes get **exactly 1 slot.** Every refusal in the 6 hours before reads "1 in flight".
        - **User rulings (relayed by qa):**
          1. Build the shaped capacity **at the binding site.** It is a shaped record, and when the record is absent the behaviour is exactly today's. The armed-gap reservation is a shaped field. The one claim call in the protected file passes a flag saying whether the gap is armed. It is operator-built, and the user confirms the push.
          2. The gap row's text and site are rewritten through a reviewed, user-run update.
             - **Done (user-run, verified):** the summary, the falsifier text, and the edit site and region now point at the binding cap: the slot-cap module, where it reads the environment. The correction is recorded with the prior site. It is an operator act on a hand-filed gap.
          - **The capacity build was sent back** with one blocking defect: the picker and the nudge check capacity without the armed flag, so a reservation for armed gaps would starve the very work it is meant to admit. A fix and three must-fails are requested, with the whole-suite pair run under load against the usual acceptance (both runs finish, and their failures are identical).
            - **The defect is fixed,** and the build is approved pending the whole-suite pair.
          - **User ruling (relayed by qa), after "we really don't want wasted work": raise the cap to 3, with 1 reserved for armed gaps.** Unarmed work keeps today's single slot, and armed work gets up to two. The value is written to the shaped record by a reviewed, user-run script once the build converges.
            - **The accepted risk:** duplicate picks across nodes (the pick lease is per node, an open gap) and refusals for a stale base, until the duplicate-pick gap is fixed.
            - **Where waste actually comes from:** duplicate picks and stale-base refusals. A "busy" bounce costs almost nothing.
            - **The measure, so this is an intervention per law 12:** compose throughput, and wasted composes (duplicates and stale-base refusals) per landed compose, before and after the change.
            - **The baseline, taken before the change** (read-only; 24 hours ending 2026-10-14T10:26Z):

              | | Compose host A | Compose host B |
              |---|---|---|
              | Composes drafted | 66 | 73 |
              | Distinct gaps drafted | 44 | 61 |
              | Busy refusals | 174 | 233 |
              | Stale-base refusals | 1 | 0 |
              | Gaps redrafted on the same node | 16 | 11 |

              - **15 gaps were drafted on both nodes.**
              - **7 system landings reached origin.**
              - **About 139 composes produced 7 landings.** Duplicate work is already large before any capacity change: about 15 of about 90 distinct gaps were drafted on both nodes, plus about 27 same-node redrafts (some of them legitimate retries).
              - **The main source of waste is the per-node pick lease, not capacity.** The after-reading uses the same method and the same window length.
            - **User ruling (relayed by qa): "Learnable, bounded 1..8".** The capacity record is not a trust-root shape, so any authenticated writer can change it within its bounds, the autonomous lane included. **The system may change its own compose cap** (the intent of laws 1 and 5), with the bound as the guard.
              - **A new observable for the after-reading:** whether the system moves the cap, in which direction, and on what evidence.
              - Every system write to the record is watched.
              - **There is no learner yet, but an existing candidate is named.** Nothing writes the capacity record today, so "learnable" is a permission without a learner. The natural existing learner is the **rhythm conductor.** It already reads conditions (a load bucket, and operator presence), scores due-ness against affordability, decays, and writes rhythm records: this is law 5's selection from conditions. But it reads neither compose outcomes (busy refusals, duplicates, landings per slot) nor the capacity record.
              - **The gap, to be offered to the user for filing after the capacity push, with the baseline as evidence:** the conductor's affordability and compose outcomes do not steer the shaped compose cap. Whether its site is lane-editable is to be checked.
            - **The duplicates, traced: sequential, not concurrent.** The store-wide landing lease held, and correctly refused 11 concurrent attempts. All 15 cross-node duplicates were re-picks made 1–8 seconds after the other node's compose failed and released the lease. **The picker's cooldowns are per process and never read the store.** There was also one double-draft on restart. This refines the baseline's attribution: the cause is the cooldown, not the lease.
            - **User ruling (relayed by qa): build the existing-parts fix BEFORE the capacity change,** stacked with it in one push.
              - the picker skips gaps leased by another node;
              - a lease release leaves a store-wide stamp that the existing cooldown reads;
              - re-entry is restart-safe.

              It is an operator build in protected files.
              - **The cost:** this delays the capacity change, and with it the engine gap's first attempt. **The engine fix's review date (2026-10-17T18:00Z) does not move.** If the delay causes a miss, the miss is reported.
            - **The duplicate-pick gaps cannot be picked by the armed reservation.** Both have been open since early October, unarmed, with no attempts. Their site is protected on every node except the one running the scope experiment. A read-only check is under way on why the store-wide landing lease does not also stop drafts across nodes, so that a fix could reuse it at pick time. Who builds that fix is the user's call, after the capacity change.
      - **A system-written behavioural check for an escalation fallback** (development-vessel `da962772`, 2026-10-14T11:23Z). The gap was filed by a person in September, so this is **not a headline candidate.** It is evidence that check supply worked.
        - **Red for the right reason, by code reading:** delivery routes by shape, with the retired pinned surface as the last fallback. When the human surface fails, delivery falls through to a vessel no human reads, which is exactly what the check asserts must not happen. Whether the fake discovery reply matches what the parser expects is unverified until the check is armed. The site is lane-editable. The check is not armed yet.
        - **Pre-registered before any landing:** a valid fix stops falling back to a surface no human reads, by queueing or by failing visibly. A close is **disqualified** if it turns the check green by changing the pinned surface's reply text, by editing the check, or by special-casing the fake.
      - **Why D4 missed, found 2026-10-14: the redispatch had never run live.** Its policy defaulted to dry run ("interim defaults"), and no policy record existed on either node. **User ruling: turn redispatch on,** through a reviewed, user-run write: dry run off, with the default bounds of 5 cycles and $5 per goal.
        - **It is a law-12 intervention, so its time is recorded when it runs.**
        - **Correction: dry-run lines did appear, after D4's date.** One node logged "would redispatch" 4 times in 72 hours (3 in the last 24), and the other node logged none. So D4's precondition was met late. **D4 stays missed at its date.**
        - **Law-12 intervention: redispatch was switched on at 2026-10-14T17:13Z** (user-run), with dry run off and the default bounds. It was verified through the reader's own parse on both compose nodes. It runs live from the next tick, and its first live action is watched.
        - **The first live redispatch (2026-10-14T17:47Z, on one node), cycle 1 of 5.** All its linked gaps were closed. The goal is an investigate-and-decompose goal, born from a failing-test gap the system detected; it is not the loop goal.
          - **The result:** failed, not reached, with all 9 tasks failing. The ribosome correctly skipped extraction. No compose slot was used.
          - **The reading, corrected:** the mechanism works end to end. A linked gap closes, the goal re-runs, and the verdict is honest. **The linked gap was relevant:** it was a capability gap for an input that investigating a failing test needs, with this goal among its demanders. It closed shortly before, on "a producer is now discoverable". So the re-run did have new information, and still failed.
          - **The failing test is not our regression.** The check commit added only a check file that the default test run never executes. The failures trace to a process adapter.
          - **The class to watch:** this capability gap closed the same way once before, and reopened. **A capability gap closes on advertisement, not on its demand being served.** That is the same family as "reached, not status". If cycle 2 fails the same way, it is filed.
          - **Traced (read-only): declared is not runnable.** The lifecycle scan closes a capability gap as soon as **any activity template declares** the shape among its outputs: here, about ten old learned and bridged templates. It does not ask whether the shape can actually be obtained. The real producer remains contained, and **the containment has not slipped.**
            - **So the cycle repeats:** a walk cannot get the shape and files the gap. The scan sees templates that declare the output and closes it. Redispatch fires, and the walk fails again. This is bounded by the 5 cycles allowed per goal.
            - **The class:** a capability gap closes on a template's declared output, not on the demanding goal being served. It is the inverse of the earlier lesson that unadvertised is not undeclared.
            - **The site is protected,** so if the gap is filed it will be hand-filed.
        - **The exposure:** about 1 to 1.5 goal re-runs a day at today's rate. Each goal is bounded at $5 and 5 cycles, and the fleet's global spend cap of $5 an hour bounds everything. The expected spend is a few dollars a day.
      - **D8, pre-registered for the loop goal's next run (written by 2026-10-14T17:17Z, the time it was pushed, before the run):** the new check is test-only, so the run is **expected** to repeat the stub reading.
        - **An alternative, so a reach is not misread as a fix:** the stub comes from a resolve that runs past its 8-second timeout (observed at 17–18 seconds). If load is lower at run time and the resolve finishes inside 8 seconds, the run can bind real counts **with no repair.**
        - **So a reach counts as a fix only if a system landing on the timeout gap is on origin before the run.** Otherwise it reads as "the latency fell under the timeout", and the run's resolve latency is recorded from its journal.
        - **Amended before the run (written 2026-10-14T18:04:45Z): which code the loop goal's node is running.** The timeout fix is on origin and in that node's build, but its walk service has run since before the build, and the runtime loads code at start. So:
          - **if the walk service restarts before the run,** the expected reading is an **honest failure (timeout),** not reached;
          - **if it does not restart,** the old resolver still runs, and the expected reading stays **stub, hollow,** not reached.

          The restart time is read from the journal. No operator restarts it: pull-sync's deferred restart is its own mechanism.
          - **Resolved: the node restarted onto the fix at 18:05Z, with no operator act.** Pull-sync found the build stale and rebuilt it. After four deferrals it restarted the walk service despite one goal in flight, because its starvation bound requires convergence not to be starved. **The pre-registered branch is therefore "restarted": the expected reading is an honest timeout failure.**
          - **The in-flight goal was not lost.** It was requeued and resumed within seconds, so "live until graded" held at the walk layer. **But the resumed run was refused by its own interrupted attempt's landing lease,** because re-entry is keyed on holder plus attempt, and a resume gets a new attempt. It was graded as a capacity non-attempt, and the gap is blocked for up to 2 hours.
            - **Corrected: this is the package working as designed, not a regression.** Its restart-safe rule exists so a node cannot take its own lease again under a new process and draft twice. A new attempt is refused while the earlier lease lives, and that lease lapses at its time-to-live.
            - **The accepted cost, now seen live:** the walk service's requeue, which honours live-until-graded, and the lease's attempt-keying do not share an attempt identity. So a resumed run is refused for up to 2 hours, and graded as a capacity non-attempt.
            - **A design trade-off.** Whether to file it is the user's decision: a requeued dispatch could carry its attempt id, or release the orphan's lease.
      - **Law-12 intervention: the compose capacity record was written at 2026-10-14T17:12Z** (user-run), with a cap of 3 and 1 reserved for armed gaps. It was verified on both compose nodes by the live validator. **It was first read live at 17:19:35Z and 17:19:41Z** (cap 3, reserved 1, nothing ignored). **The after-window starts at those reads,** and is compared with the 10:26Z baseline over the same 24-hour length.
      - **A check for the loop goal's new blocker is an operator commit** to the executor repository, pushed at 17:10Z after review. Its armed case is red at the commit, and two controls stay green. The check was in both nodes' clones at 17:19:34Z, and the armed gap went to the user to file. Its summary was redacted first, because gap rows are readable by the substrate.
        - **Filed by the user and verified open** (recorded at 2026-10-14T17:23:24Z). Its site is the executor's impulse-resolve resolver, with a class-2 falsifier on the armed case. It is hand-fed, so it is **not** a headline landing.
        - **Pre-registered before any lane attempt.** A valid repair makes an abort on the caller's side a **failed** task, with timeout as the reason, while both controls stay green. **This makes the failure honest; it does not by itself make the loop goal reach.** An attempt is **disqualified** by any of these:
          - raising the resolve timeout's default, or any timeout constant;
          - editing the check file or its fixtures;
          - an exemption by test environment, or a branch for tests only;
          - a change outside the resolver and the engine's exemption block.
        - **Under the post-07:30Z rule, the operator-committed check is an operator act on the loop goal's gaps,** so the link it serves is assisted.
      - **The capacity and cooldown package is pushed, and live;** the capacity record was written at 17:12Z (above). The after-window is split: composes that a redispatch triggered, against gaps the lane picked, with their overlap reported.
      - **Inverted again: the second attempt on the same gap** (goal-host `751a75a`, 2026-10-14T14:46Z, following yesterday's `b116eb9`). Both checks assert the defect itself as the expected behaviour, so a real fix would turn them **red.** The file is red only because of an unrelated case. The test-writing gate counted that as reproducing the defect, and the semantic gate agreed. It landed unverified, unarmed, and its own check did not run. **It cannot detect a fix either way.**
        - **The class:** the test-writing gate accepts "some assertion fails" without checking that the failing assertion encodes the defect. It is already filed in two rows, so there is no new row, and this is cited as evidence there.
        - **The day's pattern:** 3 invalid system-written checks (a fixture mismatch, and two inverted ones). Against them, **one verified valid** (below), and one apparently valid by code reading but not yet armed (the escalation fallback). **Validity is supply's dominant quality failure,** but the system *can* write a strong check.
      - **A valid system source fix, graded partial because an instrument failed** (activity-api `81506ab`, 2026-10-14T14:51Z, with a real base). **Correction:** I first read this as off-target, and it is not.
        - **What it fixes:** the report's filters read columns that do not exist. Failure class and reason now read the fields that are really recorded, and an end bound is added to the time window.
        - **Its check is strong:** it runs against a real schema and counts rows. It was red at the base and green after, and its own check ran. A change to text alone could not pass it.
        - **But the semantic judge's answer failed to parse.** The gate failed closed, as a "dissent". The change landed over it, unverified, and closed as partial. **The parse failure was then minted as a dissent gap with no finding behind it: an instrument failure filed as a semantic finding.**
          - That class, a judge's unparseable reply recorded as a dissent, is a gap for the system.
          - So is the cost it caused: a valid repair was graded partial for a reason that was not about the repair.
          - **Traced: two paths.** When the own-check fails, an unparseable judge reply is correctly refused as infrastructure. When the own-check has **passed**, the same failure comes back as "does not address it", a value identical to a real dissent. So the change lands as partial, and a dissent child is minted.
          - **How often (72 hours, both nodes):** 3 dissent landings in all, 1 of them a parse failure, plus 1 parse failure refused correctly. **Rare, but each one costs a valid repair its verdict, and adds a fake finding.**
          - **Filed by the user at 2026-10-14T17:15Z and verified open.** The site is protected. The expected behaviour is: unjudged, neither a pass nor a dissent, with no child gap, graded like the infrastructure path.
        - **It is not a headline landing:** its parent gap is an operator narrowing, so it is hand-fed by inheritance at read time.
        - Part of the gap's title ("dead table") is stale, and a remaining grouping defect is tracked in a sibling row.
      - **THE HEADLINE CANNOT MOVE IN THE NEXT 24 HOURS (read from the gap store at 2026-10-14T17:27Z; recorded at 2026-10-14T17:30:01Z).** Of 212 open class-2 gaps, 161 are armed:
        - 145 are hand-fed, by source, marker or lineage;
        - 7 are sited in protected paths;
        - **the remaining 9 are each eliminated on reading.**
          - Four belong to one operator-prose edit goal whose site is a test file and whose check is not red.
          - Five carry an operator check-first supply note, and multi-file sites.

        **Zero gaps are system-originated, armed, red for the right reason, and lane-editable.** The binding constraint is **system-originated supply** (stop-item 2), not the lane, capacity or grading. Whatever the lane does in the next 24 hours, the headline stays 0.
      - **THE SYSTEM-ORIGINATED FUNNEL** (read at 2026-10-14T17:27Z; recorded at 2026-10-14T17:32:41Z). There are 1,769 open gaps with a non-human source and no hand anywhere in their lineage. Bucketed by replaying check supply's own gates, in order (figures in brackets were created since 10-07):

        | Bucket | Gaps |
        |---|---|
        | Already armed (every valid one was eliminated above) | 74 [50] |
        | Not supply's work by design (orphan, unreachable or literal routes) | 70 [8] |
        | **Control arm: never sent a goal** | **726 [156]** |
        | Skipped as scope-excluded, mostly older stock (stop-item 3) | 380 [4] |
        | No falsifiable anchor | 105 [27] |
        | Dispatch failed, mostly for compose slots | 36 [1] |
        | Treatment arm, not yet dispatched (tick cap, backoff, or no vessel) | 378 [121] |

        - **The control arm is an indefinite hold.** Check supply withholds half of all gaps, by a parity on the gap id, "so the supply's effect can be measured". The hold has no end date, no lift condition and no review date. **It covers about 41% of the system's own detections, against the user's no-indefinite-hold ruling.** Its file is lane-editable. The decision goes to the user.
        - **Correction: the path for unsited gaps exists, but it starves behind sited gaps.** It is not a deadlock. At arming, check supply takes the edit site from the check's import, and builds anchors from the vessel's declarations when a gap has no site. But its sort puts gaps that already have a site first, so with a small bound per tick the unsited ones never come up. **None of the 1,036 unsited gaps has ever been sited:** supply has armed 4 gaps ever, all already sited. The nearest filed rows are hand-fed, and nothing new is filed yet.
        - **User ruling, about 17:34Z: "Lift after capacity window".** The control arm is recorded as a hold, with these terms:
          - **lift:** the end of the capacity after-window;
          - **review date:** 2026-10-15T17:20Z;
          - **how it ends:** a reviewed change that moves the split fraction into the supply rhythm's shaped record, with a default of 0, so the system can set it;
          - nothing changes before the review date (law 12).
        - **Ranking, by expected arms per day:**
          1. **Supply yield** is the multiplier: about 2% of dispatches arm, and over half the failures were compose-slot refusals. The capacity change at 17:12Z is already the intervention for that, so nothing else is stacked on it (law 12). Its after-window counts busy refusals on supply goals separately.
          2. **The control arm** is the largest population withheld, and its measurement value is low at a yield of about 2%.
          3. **A scope earn-in for the top three protected sites** would unlock about 280 gaps, mostly older ones (stop-item 3).
        - **The bottom line: no single code fix makes the system's detections flow.** The pipe is open, at about 2% yield, and half its input is withheld by design.
      - **The schedule's three measures (the 2026-10-12 ruling), restated (measured at 2026-10-14T17:37:31Z from the origin logs, by author; bot commits excluded):**
        - **Operator commits since 2026-10-10:** about 395 across the super-repository and its submodules. About 219 are not documentation. **Post-freeze code acts: 17 to 18,** each listed in this section with its ruling or exception. Two of them are status-reporting fixes, made under the user's standing operability objective (§16 O6). qa ruled them outside the D-path, so the freeze does not apply, and they change no vessel's behaviour. **They were pushed by the user** at about 01:30Z on 10-14, with the reviewed, guarded push script. The source is qa's note, written at the time. A later refusal was a second attempt. **One pull-sync act falls outside the freeze's exceptions.** It is follow-on hardening of the owed-restart fix, which itself landed as exception (b), user-cleared. It hardens the one input to that fix's safety rule, which read an empty unit start time as midnight. It was approved by qa.
        - It has **no separate user ruling,** and it is neither (a) an observed regression nor (b) an intractable blocker: the defect was latent and practically unreachable.
        - **So it is recorded as an act under qa approval only, and put to the user for retroactive clearance or a ruling to revert.** It is small and low-risk, but under the freeze an operator act needs (a), (b) or a user ruling, and this one had none.
        - **System-authored landings since 2026-10-10:** 20, of which 11 came after the freeze. **Verified: 1.**
        - **The excluded-path count:** 269 on the primary compose node, and 270 on the other, read from the live scope shortly after 17:40Z.
        - These measures had been missing from the regular status lines, and are reported again from now on.
      - **A system landing on the timeout gap: executor `969f86b`** (2026-10-14T17:33Z, about 10 minutes after filing). A caller-side abort becomes a failed task with timeout as the reason. The change is confined to the resolver.
        - **All the pre-registered disqualifiers are clear.** The check reads green on one node. Settlement is blocked by the same library-served defect.
        - **Verification is pending.**
          - **The post-land suite ran:** 423 passing and 19 failing, against 422 and 20 at the engine fix's landing. That is consistent with 0 new failures, but the failing test names were not compared.
          - **The own-check reads green** on one node.
          - **The controls were not run by the lane;** it ran only the armed case.
          - **It is not yet served on the loop goal's node.**
          - **Verified independently (read-only):**
            - **The gap check:** in a fresh clone at the landing, run in-container, 3 of 3 pass. The armed case went from red to green, and both controls hold.
            - **The existing resolver suite:** 7 of 7, with no regression.
            - **Live on both nodes:** the fixed line is in the build, and the walk service restarted after it.
            - **Recorded, not a defect:** the abort match is wider than the error name, so any fetch error whose message says "aborted" is now a failed read.
            - The gap stays open only because of library settlement.
          - **Grade: verified on every measured item except the live reading,** which comes from the loop goal's next run (an honest timeout failure is expected). If that run reads as expected, this is the **second verified system repair.** It was hand-fed, so it is not a headline landing.
          - **The live reading (2026-10-15T01:11Z, the coordinator's journal watch):** a caller-side timeout now surfaces as a logged, failed read, with its deadline and source. Before the fix it was a silent success with empty content.
            - **The caveats:**
              - it was observed on a **different shape** from the loop goal's reads, on the default deadline;
              - the pre-registered observer, the loop goal's run, did not exercise a timeout, because its reads finished inside the template's deadline;
              - the log line's format comes from CHANGE-02, so this reading covers both changes together.
            - **Grade: the second verified system repair,** with its live evidence taken from another path, not from the pre-registered observer. It was hand-fed, so it is not a headline landing.
        - The gap was hand-fed, so this is **not** a headline landing. Once it is served on that node, the next run is expected to read an **honest failure (timeout), not reached.**
      - **Live harm, noted:** the gap about escalations that no human reads is itself flagged hopeless, so both nodes are escalating it through the same channel no human reads.
      - **Redispatch has taken no live action yet:** neither node has ticked since the switch, and the first candidate is queued on one node.
      - **USER (relayed by qa, about 2026-10-14T19:35–19:40Z): the primary objective and an invariant.**
        - **The objective:** "observe repeated need-based gap detection and closure. This should involve code changes, the activities routing around and walking over the existing pieces, and use the same mechanism as reaching the needs themselves."
        - **The invariant:** "everything we observe the system trying to do, it also observes, and when it does it either achieves a gradeable reached result that it can comprehend or gains all the information needed to do that on the next attempt."
        - **The measure:** goal-reach's count of needs reached after a system closure with no operator act. **0 to date.**
        - **User (relayed by qa, about 20:00Z): "Filing something as a gap does not automatically make it learnable if the system never uses it to learn. And we have not observed the system use them to learn."** Then: "We should perform a full investigation to find every inhibiting condition along this path. Everything has been done before and nothing is new, so we just need to find the right pieces and ensure the system keeps the operational sequence stable during its own self modification, decision making and execution."
          - **So there are no further gap filings until the investigation is in** (recorded at 2026-10-14T19:59:17Z). Seven read-only investigations run, one per stage:
            1. outcome to learned state;
            2. learned state to decisions;
            3. failure to the next attempt's information;
            4. the tool-using floor (no tool calls in about 600 runs);
            5. the self-modification pipeline;
            6. operational stability during self-modification;
            7. pacing and governance.

            Each returns its inhibiting conditions with file and line, live evidence, and the existing piece it obstructs.
          - **Early evidence:** the lane's landing prediction moves only from 0.85 to 0.58 after five or more mispredictions. **Learning exists, but barely moves decisions.**
          - **This qualifies the day's filings:** about a dozen gaps were filed today. None has been shown to feed learning, and none is assumed to.
          - **CORRECTION (recorded at 2026-10-14T20:53:04Z): the investigation below is a RESTATEMENT of §1 and §2.0's Ranks 0–5,** not a finding. Its five classes map one to one onto those ranks. Presenting it as new is the §6.2 anti-pattern "rediscovery presented as a finding", and this record repeated it.
            - **It also repeated the K4 error:** §1 had already withdrawn floor tool use as a fact, because the counter cannot see the wrapper's internal loop. The item below that says every floor run reads as "no tools" is an instrument reading, not a system fact.
            - **The delta, the only new content:**
              - the specific contract boundaries where the information is lost, each with file and line;
              - the measured skew of the learned state to failure;
              - the restart and lease continuity breaks;
              - the confirmation, from the model resolver's own logs, that the model does call tools inside the wrapper.
          - **"Marked resolved" mostly means expired, not repaired** (from the gap store). Of 641 closures and resolutions since 09-30:
            - **421 (66%) were age-only expiry,** 393 of them in a two-hour burst on 10-13 by the lifecycle scan, whose own text says "not evidence of repair";
            - **79 (12%) were verified fixes,** and 10 of those already have an open gap of the same stem born after the close.

            **Durability, the third measure of the gap triple, is not established.**
          - **§7 step 1, the vertical slice ("the first and only done"), is still NOT DONE.** The status of 10-03 stands. The floor reach it measured on 09-29 (12.6% and 24.1%, by node) is now about 5%.
      - **USER RULING (2026-10-14T21:38:32Z, in the docs session), §7 item 4, on authority before any protected modification: OPERATOR BOOTSTRAP.** When the slice's break lands in a protected file, an operator builds the repair directly.
        - **This settles the open authority question** that kept §7 step 1 from proceeding.
        - **How work proceeds from here:** exercise the single slice. Its first demonstrated break decides the next repair, and nothing runs in parallel. Each repair is recorded as operator work, and is followed by the re-measuring evaluator (Rank 1) and a re-run of the slice.
        - **From now on, §15 records only rulings, decisions, and pre-registered slice readings and verdicts** (§6.1.7). It does not narrate findings.
      - **USER RULING (relayed by qa, about 2026-10-14T21:30Z, verbatim):** "Use the loop goal as the slice; operator bootstrap for protected. We want to not fail due to reasons we have already identified and diagnosed hundreds* of times over the past year. If we miss the deadline it needs to be because of a new reason. If we follow a rigorous process of assessing our history and assigning changes only when needed to meet the goals we are cleared to make direct interventions into the system to achieve the desired outcome. Being able to express and validate the expression of the code and activities should be trivial so we should start by defining the process and then organizing the changes required."
        - **The slice is the loop goal.** Protected breaks are bootstrapped by operators.
        - **The sequence:** first define the process, then organise the changes the slice's path requires. Each change is assigned only when history shows it is needed to meet the goal. **A missed deadline must be for a new reason.**
      - **THE SLICE PROCESS OF RECORD (adopted 2026-10-14T21:42:39Z).** It is a delta on the existing L12 intervention record, not a new document. It applies reading rule 4, §6.1, §7 and CANON K1–K18, and continues the planned slice re-run, which had no outcome. **The difference:** the slice is a live need, with a linked gap and a system-landed repair already on it.
        - **The cycle:** a pre-registered slice reading, then the first demonstrated break, then ONE change through the record below, landed in its window. Then the observer that exposed the break re-reads it, and the cycle moves on to the next break. **No change is assigned except from a demonstrated break.**
        - **The record. Every field is filled, with citations, before landing; an empty field means the change is not assigned:**

          | # | Field | What it contains |
          |---|---|---|
          | 0 | Demanding reading | The slice reading and the break it demonstrated |
          | 1 | History | The § and class key, and every prior attempt, **including closed gaps and why they closed.** It names the concrete difference this time. **"No difference" means not assigned** |
          | 2 | Expression | The site and the patch. The behaviour changed, as a shape, decision or verdict. The runtime reader of any field written |
          | 3a | Origin observer | The observer that exposed the defect re-observes it. **Never the fix's own test** |
          | 3b | Served where the need runs | The build is rebuilt **and** the consumer restarted. A library counts as served through its consumers |
          | 3c | No regression | Reach on reliable paths through the changed code, before and after, with the revert path shown to act |
          | 3d | Stays fixed | A standing Rank-1 re-measure, with a must-fail control |
          | 4 | Known-failure preflight | K1–K18, plus the class file's guards. **A miss whose cause is already known is a process failure** |
          | 5 | Window | One change per node per window, with every open window checked. A restart of the walk service during a slice run means no run |
          | 6 | Authority and identity | The ruling, the operator identity, the record committed with the change, the push guards, and every gated node at verdict "none" |
          | 7 | Outcome | Pass, fail or not evaluable, with the observer's reading and the next break |

        - **Roles:**
          - **user:** rulings and user-run scripts;
          - **qa:** pre-registers readings, identifies breaks at the consumer with a positive control, reviews fields 0–6, gates pushes, and appends field 7;
          - **coordinator:** builds only changes whose record is complete and reviewed;
          - **docs:** records rulings, pre-registrations and outcomes only;
          - **deployment:** no infrastructure change inside a slice window;
          - **the system:** runs the need, repairs editable sites, and re-runs on closure.
        - **Candidate breaks on the slice's path** are listed from history, and **none is assigned** until a reading demonstrates it:
          1. the count read against a fixed deadline, where routing around comes first;
          2. a library landing never reading as served;
          3. the linked gap closing on its test or age, not on the need re-reaching;
          4. redispatch never firing for this need without 2 and 3;
          5. a mid-run restart.
      - **CHANGE-02, under the process (recorded 2026-10-14T22:17:21Z).**
        - **The user's call:** "We need to do this now. We know tonight's run will most likely fail if we give it the system as is."
        - **Field 0, the demanding reading:** the slice's two count reads take 13.8 s and 9.5 s against the 8-second default (measured at 22:08Z). That is the stub break demonstrated at 15:43Z.
        - **The change:** a template states its own read deadline. The reader honours a timeout set per call, clamped between 1 and 60 seconds and stripped before forwarding. Nothing else changes. Because the deadline lives in the template, it is a shaped value (law 1).
          - **Part a** (the reader) was pushed at 22:16Z under operator identity, through all push guards.
          - **Part b** (the slice template's two reads get a 30-second deadline) is a user-run write, once part a is live on the loop goal's node.
        - **The amended pre-registered reading for tonight:** with a and b both live, both count reads are expected to bind real counts, and **the run to reach.** Without b in time, an honest timeout failure, as before.
        - **How a reach is graded:** this is an operator act on the slice's template, so under the post-07:30Z rule the link it serves is **assisted.** A reach tonight is a slice reach, **partly operator wiring,** not a system closure.
        - CHANGE-01 (library settlement) is paused behind it.
        - **A process deviation, recorded (2026-10-14T22:19:59Z):** the route-around was **not** checked before part a was pushed, against the candidate list's "route around first". It was checked afterwards: the existing alternative producer of the same counts gave no answer within 90 seconds at this load. So the route-around is absent, and the change stands. **The deviation stays on the record.**
        - **The restart exposure:** the longer deadline adds about 25 seconds per step in which a restart can land. The dominant risk tonight is this change's own fan-out restart. **So part b runs only once part a is live and the walk service has restarted onto it. If that has not happened by about 23:25Z, part b is held.** CHANGE-01 does not land before the run. A restart inside the run window means no run, as already pre-registered.
        - **Fully applied before the run (recorded 2026-10-14T22:41:26Z).** Part a was live on the loop goal's node at 22:37Z: the walk service restarted onto it with nothing in flight. Part b, the user-run template write, landed at about 22:40Z, and both count reads now state a 30-second deadline. The engine caches templates for 60 seconds, so the run reads the new body.
        - **The pre-registered reading:** both count reads bind real counts, and the run **reaches.** If the 30-second deadline times out, then 30 seconds is not enough. A restart of the walk service inside the run means no run. **The run is operator-assisted.**
        - **Two side effects of the template write:**
          - The registration schema stripped one undeclared task field. Nothing reads that field, so behaviour does not change. The post-write guard should compare only fields that carry behaviour.
          - **Re-registering the template recomputed its posterior from execution counters.** That is the re-registration reset the 10-14 investigation found. **The user ruled "no reset of learning state", and this write reset one template's learned state as a side effect.** It is recorded as a law-12 intervention on learning state.
            - **Confirmed (recorded 2026-10-14T22:42:40Z; relative terms only):** the posterior mean rose from about 0.90 to about 0.97, and its total pseudo-count roughly halved. The graded history was replaced by values derived from the counters.
            - **This contradicts the user's "no reset" ruling.** qa declared the recompute as a known effect, but did not check it against that ruling before the write. That is **qa's error, recorded as such.**
            - **It cannot be cleanly undone:** no interface sets the posterior, and a database hand-edit is forbidden.
            - **The confound on tonight's run** is small for selection, because the goal names the template directly. But any credit from tonight lands on the reset values. **What follows, if anything, is the user's decision.**
            - **USER RULING (2026-10-14T22:49:31Z, in the docs session): "Leave it as a recorded intervention."** No correction follows.
        - **Pre-registered before the run (written 2026-10-14T22:54:10Z): how a reach is attributed.**
          - **(1) The system's own attribution will label a reach "autonomous other".** It counts operator acts only when they land on a linked gap's edit site. The loop goal's only linked gap is the system's own deficiency gap, which has no edit site, and the template write is not a landing. **The reach is recorded as ASSISTED regardless** (an operator reader change and a template write). The mislabel is the known blind spot: operator acts are not stamped.
          - **(2) "Reached because a repair landed" cannot fire for this goal yet.** Its only linked gap closes on the reach itself, so no prerequisite landing can trigger a redispatch. A clean instance needs the system to file a sited prerequisite gap itself (the per-goal diagnoser is not built), land it, and settle it.
          - **(3) CHANGE-01 (library settlement) lands right after tonight's reading, not before,** because of the restart risk to the run. That follows the user's "we need to do this now".
          - **(4) Pre-registered at 2026-10-14T23:56:52Z, before the run.** The run is due about 00:05–00:15Z; the earlier estimate of 23:40Z was wrong.
            - **The general mechanism already exists.** The system's own step-failure siting ran for this goal and reported "composition, 3 of 3: every step succeeded". Every step "succeeded" because a timed-out read used to be recorded as a success, the defect the system fixed itself at 17:33Z. **With that fix, a failing run carries an honestly failed step, and the siting files a sited step gap linked to the goal. That is the system's own repair path.**
            - **Our operator change to the read deadline pre-empted that path** (law 6: do not rob the system of its self-maintenance). This is recorded against the process: field 1 should have asked whether the system's own path was about to fire.
            - **So, if a count read still times out tonight at the template's deadline,** the expected outcome is that the next goal-reach tick files a **sited step gap** for the loop goal. That would be the general mechanism working.
          - **THE INVESTIGATION'S FINDINGS (7 stages, read-only, completed before 2026-10-14T20:18:59Z). The pieces exist, and the joints between them do not.**
            1. **Filed gaps do not feed learning.** No selection, producer choice, target inference or pathway recommendation reads gap rows. Most of the learning defects found were already filed between 10-01 and 10-09, and are still unfixed.
            2. **The learned state is skewed to failure.** On one node over 72 hours, success weight came to about 296 and failure weight to about 4,370. 194 of 229 arms received no success credit at all. The causes are one-way grading, double grading, failure charged at insert, and infrastructure failures charged as failure.
            3. **The tool-using floor blinds itself.** The model does call tools inside the model resolver, but the dispatcher looks for those calls in a different field. So every floor run reads as "no tools", the judge is told the run is unverified, and credit is withheld.
            4. **Most decisions do not read learned state:**
               - pinned template ids, about 280 refused a day, which are dead ends with no reroute;
               - templates that bind a literal endpoint;
               - the boredom pool's in-process selector, which never reads Thompson;
               - regex routing behind an environment flag;
               - a fixed map from category to resolver;
               - declared producer priority;
               - **a hand-coded landing score** (the 0.85 → 0.58 movement is **not** learned; this corrects the early evidence above).
            5. **Self-modification is fed by its own failures.** About 91% of open gaps are unarmed. Re-commit children are armed at birth, so 68% of picks are re-commits. No closure credits the choices that produced it, and 81% of closures are age expiry.
            6. **Restarts break the sequence.** A drain never releases the landing lease. On one node the drain is a silent no-op. The walk service is force-restarted on a count, because it publishes no in-flight age, and 16 of 55 recent runs were not graded. Policy reads fail closed under load.
            7. **Nothing governs from the dynamics.** The stability verdicts are incompatible. The one acting governor fails open. Order parameters are published with no reader that changes behaviour. The tuning writer made 0 writes in 72 hours. Budgets apply per node on one shared host. (Whether the spend cap is fleet-wide or per node is contested.)
            - **Cross-cutting classes:**
              - contract mismatches between existing parts, where information exists and is lost at a boundary;
              - decisions that do not read learned state;
              - corrupted learned state;
              - self-modification without continuity that survives a restart;
              - measurements without consumers.
      - **THE SLICE READING, 2026-10-15 (the run started about 00:21Z; no restart in its window; recorded 2026-10-15T00:27:42Z). CHANGE-02, field 7:**

        | Pre-registered | Reading |
        |---|---|
        | Both count reads bind real counts | **PASS.** All four tasks succeeded, both reads completed inside the template's deadline with no timeout, and the judge's input was about six times larger than at 15:43Z, so real counts were bound |
        | The run reaches | **FAIL.** The reach gate judged it not reached, and **its reason is not in the record:** only the bare verdict |

        - **The sequence:**
          1. Selection **reused the learned path** for the goal family. The template's posterior had been reset hours earlier, which is a confound.
          2. The template completed.
          3. The judge said not reached, with its reason lost.
          4. In-flight recovery fired: it fed the prior verdict back, excluded the template, and found no other producer.
          5. It **filed a capability gap by recurring demand, which is the system's own path,** and entered the floor, whose outcome is pending.
        - **RETRACTED (recorded 2026-10-15T00:35:22Z): "the judge was right; the merge task received literal references" was WRONG.** The literals appear in the engine's trace, which is recorded **before** the walk service's proxy substitutes bare references from the execution's variables. So the trace does not show what the resolver received. With the engine fix live, those references are substituted on this path.
          - **So the engine fix's live PASS (item 6) STANDS, and it is not inert here. Verified system repairs: 1, restored.**
          - **The misreading was itself a "verify at the consuming layer" error:** qa checked the wrong layer's code.
          - **The proposed engine joint is withdrawn:** no break is demonstrated.
        - **What remains true:**
          - The first verdict said not reached, **with no reason recorded.**
          - The retry dropped the produced shape from its carried pool, stalled with "no producer", and filed a **misdiagnosed** capability gap.
          - The floor failed closed, because the reach verifier was unreachable, and concept recall timed out.
          - No belief moved.
        - **Why the judge said no is UNKNOWN, and cannot be recovered from the records.** The report's content is not in the walk state, the answer body is empty, and no reason was recorded. **That missing evidence is exactly B2's class, and B2 is the next change.**
        - **ROOT CAUSE, measured (recorded 2026-10-15T00:40:41Z): the reach judge NEVER ANSWERED.** Its verdict was null three times, about a minute apart. So the run failed closed as "reach verifier unreachable; verdict unknown", a branch that writes no reason line.
          - **The cause was the environment: the LLM provider account had no credits** for every paid model, on both nodes. Free models were rate-exhausted. Peer routes were unreachable from one node, which is also why concept recall timed out.
          - **The slice run's verdict is therefore UNKNOWN (environment), not "not reached" on content. CHANGE-02's origin-observer check (field 3a) is untested:** the reads succeeded, and the judge could not grade.
          - **Two classes, recorded:**
            - **(a)** the retry and the capability-gap filing treated an infrastructure non-verdict as a content defect, and **misfiled a gap.**
            - **(b)** the fail-closed branch records no reason. B2's class.
          - **Learning moved nothing,** which is correct for an outage.
          - **This needs the user (credits). Until then the BATCH-01 probe and the next slice run's judge are blocked.** It is an intractable blocker, exception (b), for the user.
          - **Resolved: the user topped up the account.** It was verified on both nodes: no further credit refusals, a paid completion succeeded through each node's own resolver as a positive control, and the local model route is advertised again.
      - **BATCH-01, the run log (recorded 2026-10-15T01:00:18Z).** Round 1 has been dispatching to one node since 00:59Z, with 20 probe goals (13 held out and 7 fresh). **Three deviations from the pre-registration are named:**
        1. **B1–B3 are not live yet:** the push was refused by the landing-lease guard, on two leases the system held. So round 1 is a **pre-batch baseline with a healthy model plane.** That is cleaner than the earlier baseline, which was measured while the plane's health was unknown.
        2. **The spacing is 45 seconds, not 20,** because the host load was about 17.7 on 16 cores. Load is recorded as a covariate.
        3. **Learning stays on, as pre-registered:** a deliberate exception to the observe-mode rule for probes, because the learning test needs paths to be recorded.

        Round 2 follows at least 20 minutes after round 1 completes. The post-batch rounds come once B1–B3 are live.
        - **The comparator changed before any result was read (2026-10-15T01:00:53Z, by qa's record; no result had been collected).** Round 1, run before the batch with a healthy plane and the same goals, is **the baseline.** The earlier 2–21% band stays in the report, labelled superseded, so the change is visible.
        - **The pre-batch readings (recorded 2026-10-15T02:02:12Z):**

          | | Round 1 (baseline) | Round 2 |
          |---|---|---|
          | Graded reached | 0 of 13 held-out, 1 of 7 fresh | 0 of 13 held-out, 2 of 7 fresh |
          | **Honest reach** | **1 of 20** | **1 of 20** (one of the two was false) |
          | Wall time, dispatch to verdict | median about 199 s, max about 1,190 s | median about 158 s, max about 967 s |

          - **A false reach in round 2:** the independent-recompute oracle certified a count about the trace store as zero. It did so from two derivations over **source files,** not the trace store. **Two derivations that share a wrong premise agree, and the oracle passed them.**
          - **Learning before the batch:**
            - reuse on the goal that reached: **yes;**
            - **"a recalled reason changes the approach": FAILS.** Failure recall fired on almost every run, yet the same chain produced the same verdict.
          - **The dominant failure chain:**
            1. Target inference maps plain questions to a shell result.
            2. Its satisfier is proven bad, so a learned composition is preferred instead. That composition leaves only provenance pointers, and has a side-effect write.
            3. The result is a deterministic error envelope.
            4. The retry runs the same chain again.

            Separately, **read questions were misrouted as edit intents** into the compose pipeline, taking up to 20 minutes each.
          - **Pre-registered at 2026-10-15T02:02Z, by qa, before round 3 dispatched: two separate readings.**
            - **(a) The reason is recorded (B2).** For each run not reached: a non-empty reach reason, a failed-trace reason line in the walk log, and a failure-memory record for that goal in the window.
            - **(b) The approach differs (learning).** For each goal, run N+1 against run N differs in its inferred target shapes, its ordered template choices, or its terminal producer. A same-chain rerun by the retry does not count.
            - **Scoring:** a reason-recorded failure on an identical chain scores (a) pass and (b) **fail.** The headline learning instance is: the approach differs **and** the run reaches, graded and not a false reach on inspection.
            - **The stated expectation:** B2 moves (a). Nothing in B1–B3 changes selection, so **(b) is expected to fail.** That would demonstrate the next break: **recall does not steer selection,** the "step further away" the user named.
          - **The batch is live in part:** B1 and B3a converged on one node at 01:41Z, and B2 and B3b were pushed at 02:00Z. The post-batch rounds 3 and 4 follow once the walk service runs the new code.
      - **BATCH-01, final (recorded 2026-10-15T03:17:25Z):**

        | Round | Honest reach (of 20) | Mean wall time |
        |---|---|---|
        | 1, pre-batch | 1 | 356 s |
        | 2, pre-batch | 1 | 229 s |
        | 3, post-batch | 3 | 131 s |
        | 4, post-batch | 3 | |

        One goal's graded reach is false in every round: two derivations that share a wrong premise.
        - **(a) Reason recorded: PASS.**
          - **B2:** failed-trace reasons rose from 0 to 4, "no reason recorded" fell from 2 to 0, and memory records rose from 15 to 23, in equal windows.
          - **B5:** most floor non-reaches now carry the floor's reason, and are remembered.
          - **B4:** every floor decision is now explained. Most are the judge rejecting the **content:** unsourced current information, a read goal judged as a write goal, or a wrong count. None was a tool or fabrication rule.
        - **B3b, the floor's tool use is visible:** grounded floor runs rose from 0 of 9 to 8 of 13. **The first floor reaches in the probes,** on 2 goals.
        - **B1:** both stuck library landings closed after convergence. They closed on their own falsifier, not on the origin observer, which is a recorded caveat.
        - **(b) Approach differs: FAILS, as pre-registered.** From round 3 to round 4, 7 of 20 goals differed, and **none went from failed, to a different approach, to reached.** The round 1 to round 2 comparison is invalid: the walk states had expired before they were collected.
        - **The next demonstrated breaks, for the process; none is built:**
          1. **recall does not steer selection;**
          2. target inference maps plain questions to a shell result, and a composition adds a side-effect write, so read goals are judged as write goals;
          3. the recompute oracle certifies an answer that rests on a shared wrong premise;
          4. read questions are misrouted as edit intents.
        - **Process note:** B4 and B5 were built and pushed on the user's direct instruction in qa's session. Their records are in the batch file.
      - **The whole batch is live on the loop goal's node** (02:19Z and 02:57Z) **for the next slice run, at about 08:30Z.**
      - **The next slice run, pre-registered (written by qa before the run; recorded here at 2026-10-15T03:19:22Z):**
        - **Precondition:** no credit refusal and no de-advertise on the model route in the run window. Otherwise the result is **unknown (environment),** whatever the gate printed.
        - **Reached:** this counts only after the **trust check.** It would be the first **assisted** slice reach on its learned pathway, since operator acts touched its path: the template deadline write and B1–B5. **The autonomy count stays at 0.**
        - **Not reached, with a recorded reason:** the reason names the next break. **It must be a new reason** (user ruling). A known reason recurring is recorded as a process failure.
        - **The floor reaches with grounding while the template does not:** both are recorded, and the template's reason is the next break.
        - **Unknown (environment):** a null verdict, or a failed precondition. It is not counted either way, and the known retry and gap-filing misfires are recorded but not counted.
        - **The trust check, because the same gate certified a false count in every probe round:** within 10 minutes, take an independent read of the same aggregate over the same window. The reach is **trusted** only if the counts are numeric, not placeholders; the top rows match within 5%; and the orphan section is present. **Otherwise it is a false reach,** whatever the gate said.
      - **USER RULINGS (relayed by qa, about 2026-10-14T23:58Z–00:00Z, verbatim):**
        1. "We can't allow it to be able to execute goals that don't reach. It should not be possible to not reach consistently. Everything needed is already available, but just a step further away, but the whole purpose of the system is to take that step."
        2. "We have clearance to make direct changes, batch and push them such that the reach rate for arbitrary goals and the learning mechanism can be demonstrated before the next loop goal."
      - **BATCH-01, pre-registered BEFORE landing (recorded 2026-10-15T00:10:00Z).** Batching lifts the one-change-per-window rule for this batch only; records, reviews and push guards remain. **The selection rule (§6.1.3):** only joints that restore the system's own ability to reach or learn, and no patches specific to one need.
        - **The changes:**
          - **B1:** a library landing settles once the verified pin carries it.
          - **B2:** the failure reason reaches in-flight recovery and failure memory: one read of the record the engine already writes, at the loop that retries.
          - **B3:** the floor's tool use becomes visible, by carrying the resolver's executed-call record through the dispatcher, so floor runs are judged on what they read.
        - Nothing lands inside tonight's slice run. Everything must be live and measured before the next loop run.
        - **The baseline:** walk reach 2–21%; floor reach 5% with no grounded runs; about 57 "no reason recorded" verdicts a day per node; 0 needs reached after a system repair.
        - **The probe:** arbitrary natural-language goals across classes, none naming the loop goal or its shapes. Each is dispatched twice, at least 20 minutes apart, operator-tagged and labelled assisted, with learning on.
        - **The expected reach:** first runs reached with grounded content, **above the 2–21% band.** A floor run that used tools shows grounded use above zero.
        - **Learning, demonstrated and not claimed:** on the second run of each goal, at least one of these happens:
          - a reached path is reused;
          - a recalled failure reason changes the approach;
          - the posterior moves in the direction of the first outcome.
        - **No regression:** reliable paths through the changed code reach at their prior rate.
        - **Law 12:** a batch confounds attribution between its changes. Each change carries its own sub-reading (B1: the stuck landings settle; B2: "no reason recorded" falls toward 0; B3: grounded use above 0), so a gain can be traced to a joint.
      - **D8, amended before the run (written 2026-10-14T20:18:59Z): a mid-run restart is NO RUN.** If the walk service on the loop goal's node restarts during the run window (start, stop or drain lines inside it), the run is read as **no run,** not as a verdict.
        - **User, about 19:50Z (relayed by qa): "Not every need requires a gap to be closed to meet it."** The walk routing around is the first answer to an unmet need: another producer, a composition of existing pieces, or adaptation at the first or last mile. A gap and a code change are for when no route reaches.
        - **Two findings against it (read-only; recorded at 2026-10-14T19:35:45Z):**
          - **(A) Need side: a correct refusal the system cannot see.** A scenario dispatches a pinned template whose learned posterior is decisively negative. The engine correctly refuses it, but **by throwing,** so the walk records no reason. The verdict reads "not reached: no reason recorded". Failure memory stores nothing, and the next attempt recalls no prior.
            - The scale: about 850 such refusals in 72 hours across the two nodes, and no gap. Their caller is not yet identified, and is recorded only in the error.
            - **Correction: the "no reason recorded" verdicts mostly come from a different class.** About 57 a day per node, not about 120. Most belong to the trace-store reconcile goal, which fails the same way each time: a maintenance-lease write missing a required field. The walk service's proxy builds the pointer through a helper that strips endpoint overrides, and that drops the token. The helper's own comment says templates never pass through it, and they do. This is also an invariant break: a repeated identical failure, with no reason the next attempt can use.
            - **The existing ruling (outcome reached, failed or declined, with the reason as a shaped impulse that survives into the trace) is not honoured on this path.** This breaks the invariant directly: the system tries, does not observe why, and gains nothing for the next attempt.
            - **The site (read-only):** the throw is in the executor's goal host, which is lane-editable. But the walk service calls it with no catch, and every reason is assigned only on the completed branch. So even a returned failure would record no reason. **The fix that honours the ruling is in the walk service, which is protected:** record the decline with its reason. Per the user's correction, it should also route around, letting selection meet the need instead of re-firing the refused pin.
          - **(B) Closure side: most closures are not walks.** The lane's compose route calls the compose resolver **in-process.** Check supply and gap investigation go through goal dispatch instead. So most closures are not selected among approaches by Thompson, are not reach-graded as goals, and are not recorded as goal paths. The mechanism the objective asks for exists ("code changes are goals": an edit intent goes to compose through dispatch), but the lane mostly bypasses it. The share of each route is being measured, and no claim is made until it is in.
      - **The lane is drafting, not idle:** since 2026-10-14T00:00Z there were about 37 composes and 5 cutover events across the two nodes, and nothing landed on origin. It drafts, and fails on quality.
      - **Two more findings:**
        - **Two system loops contradict each other.** The trend-expectation loop retires its probe notes, and the observation loop then flags them as "violated". The system files each instance, and most close on recovery. **The class, the contradiction itself, is not yet filed.**
        - **Lab artefacts in the live store.** Parity notes from the operators' lab were written into one node's live store and surfaced as "violated" gaps. This is a hygiene case. They are not system supply, and the headline excludes them.
      - **The ceiling on D9's grade, by mechanism: at most about 1 of 4 unassisted links.** D9 counts four links:
        - **Recognise:** assisted, by the named-target adjustment and the operator class map.
        - **Close:** split. The *route* is assisted: the recurring-demand filing, the goal-reach arming, and the dispatcher and additive registration from the package. The *content* is unassisted: the producer the author route writes, and its admission and landing. That content is the actual repair, so it is recorded as the unassisted half of close.
        - **Verify:** assisted, by the goal-reach arming. The verdict itself is the system's judge.
        - **Re-run:** the redispatch was operator-built before the freeze, is general, and has been untouched since. So it is unassisted only in the sense that no act is made on this instance.
        - **Rule from 2026-10-14T07:30Z:** any operator act on this goal or its gaps makes that link assisted, whoever built the machinery.
      - **The code is live where it is tested:** both changes were restarted onto the node that runs the loop goal before the run, and onto the other gated nodes too. The loop goal has many failed runs and no reach, so recurring demand fires under either counting.
      - **D7, fresh estimate (qa; estimates, not measured rates):** about 12% for one pass. The steps are filing 0.85, link 0.9, sent armed 0.8, authored, admitted and registered 0.4, and re-run judged reached 0.5. Over the roughly 10 runs before D9, retries mostly help the authoring step, so the estimate is **about 20% by D9**. It is re-estimated from what fires at the first run.
      - **How it is graded:** D7–D9 are recorded as **"partly operator wiring, on a determination"**, with the prior state of each link stated. A reach that needed operator intervention is not counted as autonomous success (the 10-02 ruling). D10's zero-surgery bar is unchanged.
    - **Pre-registered (written 2026-10-14, after the send and before any close): the keyless capability gap.**
      - **The gap:** the gap for the walk-inferred output name `detailed_analysis_report` was sent at 2026-10-13T19:58Z, before the package-flaw fix. It is armed with a producer-contract check that carries **no required keys**.
      - **The disqualifier:** any close of it by a body that only satisfies that keyless check (a substantive but arbitrary report body) is **not** a verified repair, and counts toward no D-link. It is recorded as a wrong mint if it duplicates an existing producer (law 3).
      - **Why the new code doesn't touch it:** the new code neither re-arms nor re-sends the row. It keeps an existing check verbatim, and treats a check that is not a goal-reach check as unarmed.
    - **D-state at the freeze:** D3 met; **D4 likely missed** (reported at 22:00Z); D5 met; D6 waits on the loop goal's next run; **D7's route is live, but its dispatch is off until the class fix converges.**
    - **D7, declared now under the closer-only rule: about 10–20%, under 50%, and told to the user tonight.** The rough odds for each step:

      | Step | Odds |
      |---|---|
      | Class fix live | 0.85 |
      | Must-fail observed, and the user flips the dispatch | 0.9 |
      | D6 files: the class split breaks toward the larger class within about 2 runs | 0.7 |
      | **The loop goal's deficiency is a missing-producer kind, not wrong content (unmeasured)** | **about 0.5** |
      | The author route drafts a working resolver, and the additive registration lands | 0.4 |
      | The producer-contract check turns green, and settlement stamps it | 0.8 |

      The lane's gap-closing reach today was 0 of 36, and this step is a create plus wiring. The date does not move. If it misses, it is reported missed at its date.
    - **Filed for the system (create-only, run by the user):**
      - ~~C-basesha-1~~ (withdrawn: the empty base is the net-new sentinel; see the case);
      - **the containment-visibility gap.**
  - **Hygiene note (recorded, not acted on):** activity-api's tracked tree carries a binary of about 100 MB at its repository root.
  - **D5 is on track:** its predicate is the loop goal's next run on its rhythm. **D6's risk is named as case C-listwindow-1:** runs older than R2's 200-row listing window are never tallied, so the loop goal's candidate needs about 3 new runs after the long-goal fix. That is plausibly 10-14 around midday, inside D6's date.
  - **C-checkpoint-1 repair, live control passed in all three steps:**
    1. The pre-chunk checkpoint was discarded.
    2. A full pass completed at 2026-10-13T10:00Z in bounded chunks, with no halvings. It read about 327k traces and upserted about 9.7k edges, for about 25.8k in the graph.
    3. The reconciler returned to incremental mode, with its watermark at the pass start minus the overlap.
    - **The row-7 compare:** no edges vanished, and the graph rose as expected. A set of weight decreases is **provisional**, likely the trace retention reservoir; a recency read is drafted.
    - **Case C-twowriters-1:** two edge writers write under two different keys, so some pairs are split between them.
    - **Case C-retention-env-1:** trace retention is steered by environment variables, a law-1 smell. Retention is behaviour, so it should be read from a shaped impulse.
  - **Live controls of the morning's repairs:**
    - **C-invented-1:** on a different node, check supply recorded "no falsifiable anchor" for three unrelated gaps, instead of inventing one.
    - **C-longgoal-1:** the skip line now reads 0 cut goals skipped. A separate set of runs without a goal hash is still being checked.
  - **Case C-starve-1: selection starvation.** The goal-reach tick went unpicked for about 37 minutes while another activity took 57 picks. That is a boredom-class gap for the system to close. A rhythm fallback is drafted but not applied.
  - **Gaps that R2 files carry no vessel, so check supply never arms them.** The flip does not depend on C-invented-1. But the loop goal's own gap, once R2 files it, has no route to an armed check until it names a vessel and an edit site. That is a D7 risk, named now.
  - **The D7 trace (qa, read-only, development-vessel code at `620df994`) confirms the risk and finds two missing links:**
    - **#1, no site.** An R2 deficiency gap carries no vessel and no edit site. Eligibility reports `no_edit_site`, check supply skips it as `no_vessel`, and localization runs only inside an admitted dispatch. So nothing moves the gap toward a code change.
      - **The design:** at filing, R2 sites the gap from the walk's own record: the failing step's activity, then that activity's serving vessel through discovery. The existing localization then searches that vessel for the file. The site never comes from prose. If nothing resolves, R2 records a loud `localization: unknown`.
    - **#2, a deadlock.** The filed gap links to its goal, so goal-reach waits while the gap is open. But the gap closes only when the goal is reached, and that needs the re-run the wait blocks. So **D4 (dry-run redispatch lines) cannot fire for any goal with a filed gap, and D4 is at risk now.** The flip made nothing worse, since dry-run already suppressed redispatch, but it means D3 is not a clean pass.
      - **The fix:** redispatch once per landing on a linked gap. A landing only **triggers** the re-run. The gap's falsifier stays the goal's reach verdict, so only a re-run that reaches closes it.
      - **Two must-fail controls on the fix:** a landing alone never closes the gap or alters its falsifier, and the fix touches no falsifier field.
      - **A named limit, which #2 does not fix:** the re-run's "reached" is itself a judgment and can be hollow. For the loop goal, the sealed answer key grades D9 independently of the system's judge, so a false reach there is caught by design. For every other goal, the system's own reach judge remains the weak point.
    - **Order:** grade D3, reclassify, then #2, then #1.
  - **A third existence-only system check landed before the C-invented-1 repair:** activity-api `009d159` (2026-10-13T09:11Z). It asserts that a symbol the edit site does not contain exists as a function. A one-line export would close its gap, as `b9efd761` did. The gap is a human feature request, so existence is even weaker evidence there.
    - **Not armed yet, but likely to arm on the next check-supply tick.** The C-invented-1 repair governs only new arming goals. The arm step does not re-examine a check that has already landed.
    - **Pre-registered before any close:** a close of this gap on a commit whose only effect is to make the asserted symbol exist (a stub or a constant, with nothing reading it except the check) is **not** a verified system repair, and counts toward no D-link. If it closes hollow, the user reopens and disarms it by script. There is no hand edit while it is unarmed.
    - **Live control: the arm guard refused it as existence-only, and it is unarmed.** The pre-registered disqualifier is moot unless the gap is re-armed another way.
    - **The general fix, queued:** the arm step refuses an existence-only check, meaning one whose assertions are only that a symbol is of a type, defined, or exists. That covers every check armed under the old builder. **Order:** reclassify, then #2, then the arm guard, then #1.
    - (The empty-base reading here is withdrawn; see C-basesha-1.)
  - **Case C-pinhold-1 (not on the D-path): a false divergence by construction.** The self-fact row for the pinned autonomy scope compares excluded paths as exact sets, tightening holds included. While holds are active, it reads "diverged" and keeps a self-fact-divergence gap open. The live count equals the pin plus exactly the active holds, so there is no twin debt.
    - **The class fix:** compare the live set minus active holds against the pin, and report holds separately.
  - **The S2 follow-up** (`3fbcab5c`) was pushed at 2026-10-13T07:06:56Z. Every classification now records its source, either the judge's code or the operator map. Recognition through the operator map counts as an operator link against D6. Empty reasons are split into UNREAD (the reader starved) and UNRECORDED (the source did not say why).

  **The combined re-pin** (super-repo `0968b9a5`) was pushed at 06:21:32Z. An automatic submodule pointer bump (`61e78ac6`) at 06:31:36Z restarted its soak, and all four gated nodes had accepted it by about 07:24Z.
  - **Case C-soak-1:** the bot's automatic pointer bumps reset Gate P soaks just as operator pushes do, and nothing coordinates them with the batching rule. The system should batch its own pointer bumps, one per soak window.
  - **Case C-multifile-1: a gap can name only one file.** feature_compose can already compose a change across several files. But a gap carries one edit site, and only that file gets whole-file grounding. So a fix that must move several files together cannot be expressed, or is drafted half-blind.
    - **It is measured before anything is built:** the files the plan touches per attempt, typecheck lessons that point outside the edit site, and could-not-widen events.
    - **The general fix:** secondary sites the system derives itself, grounding for every touched file, and one commit across the files.

  **The first system landing from the busy lane** (goal-host `d2001c3`, 2026-10-13T08:01Z) is graded **"landed by the system; hollow arming check"**. The system-commit footnote is now 1 right-reason arming (`bfd2dd8d`) and 2 hollow (`546f7e86`, a fix; `d2001c3`, an arming check). Its edit site is `src/producer-order.ts`, and the check imports it. But the failing case reimplements the flawed producer pick inside the test, so it is red whatever that file says. The defect itself lives at call sites in a closed file. Settlement recorded it as `landed_unverified` and skipped the pending-land stamp (C-settle-1 working: it is not counted as a fix).
  - **Case C-tautology-1: a check whose red does not depend on its edit site.** Admission (W2) checks only that the check imports the edit site. If the next supply tick arms this check, the gap gets a check that no lane attempt can turn green.
    - **The detector:** before arming, mutate or stub the edit site's exports, reusing scope earn-in's mutation runner. If the check's outcome does not change, refuse to arm it.
    - **Live reading, about 08:09Z: the arm step refused, but for the wrong reason.** It named the file's import test, which passes, instead of the comparison test that is red by construction. So C-tautology-1 was dodged, not detected; an attempt that names the comparison test would likely arm. The semantic gate also passed the check, describing it in its own words as reproducing the defect "by simulating the flawed .find() logic … and asserting it matches the correctly ordered result". An LLM gate endorsed a self-comparison. That is detector input: the semantic gate is not a guard for this case.
    - It is recorded for the system to close, not as surgery, unless it blocks a D-link.
  - **Case C-twverify-1: a test-writing landing lands without its own check running.** The gap had no check yet, so own-check recorded `test_file: null, ran: false`. Nothing confirmed the new check was red before it landed.
  - **Case C-basesha-1: staging recorded no base for some system commits.** The commit trailer `Base SHA at staging: e3b0c44298fc` is the sha256 of the empty string. Since 2026-09-20 it appears on 4 system commits: goal-host 1 of 77, development-vessel 3 of 382 (including `bfd2dd8d`), activity-api 0 of 84. On those commits the drift guard is blind. On `d2001c3` the guard logged that the base "matches no commit … staging artefact, proceeding", so the empty base was accepted silently. The cause is untraced.
    - **WITHDRAWN (2026-10-13, an error that propagated through two sessions).** The empty-string base is the patch applier's **net-new sentinel**. The cutover accepts it only when the live file is still absent, which is a real check. Every system commit carrying it today was a pure create of a check file. The one system commit that modified source, `b9efd761`, recorded a real base. So the drift guard was not blind, and the "rate change" readings below and the gap filed for it are withdrawn.
    - **What remains, filed for the system:** a multi-file landing records a base only for its sentinel file, so its other staged files land without a drift check. Cutover test output shows this as freshness coverage of 1 of 2.
  - **Case C-checkpoint-1: a statement that grows with the data, with no bound.** The edge reconciler's resumable full-pass checkpoint (added 2026-10-09) wrote its whole accumulator as one statement. On its first real full pass (2026-10-13T08:14Z), the store refused the statement for size, and every 30-minute run after that failed the same way. The reconciler's batch derivation of composition edges stalled. The live per-execution edge writer kept going. The coordinator's fix is reviewed and recorded with its push.
  - **A second system arming check, `1606d956` (development-vessel, 2026-10-13T08:24Z), is armed on an invented predicate.** The gap reports a resolver failing with an execution error, and says its investigator could not read the source. The check asserts that the resolver module exports a function named `name`. Nothing in the gap's evidence mentions such an export, and the check's own comment calls it a guess. Unlike `d2001c3`, its red does depend on the edit site, so the C-tautology-1 mutation detector would pass it. And a one-line export would turn it green.
    - **Case C-invented-1: a check predicate not derived from the gap's evidence. The invention is upstream, in the check-supply goal builder.** For a code edit site, the builder's goal template carries a literal example assertion, `["name"]`, as the symbol that must exist. This gap's evidence names no symbol at all, so the test writer followed the goal and used the placeholder. The semantic gate passed it "as specified in the goal". The goal-host landed-probe then ended the arming dispatch with `reached=true`, so the reach statistic counts this hollow arming as a reach. The predicate was armed `class2` at 08:41Z.
      - **The right behaviour belongs to the C-provenance family:** when the evidence names no falsifiable symbol or behaviour, the builder refuses to arm, loudly, as falsifier unknown. It does not guess.
    - **Pre-registered before any close:** a close of this gap that adds an export nothing reads is **not** a verified system repair, and counts toward no D-link.
      - **The predicted close landed, and is disqualified as pre-registered.** Development-vessel `b9efd761` (2026-10-13T09:03Z) adds `export function name()`, which returns a constant. Its only reader is the check itself. The resolver's execution error is untouched. **The gap did close** (2026-10-13T09:08:18Z), so this is **the first system close, and it is disqualified as pre-registered.** It is not a verified repair and counts toward no D-link. **The user reopened and disarmed the gap at 2026-10-13T09:40:51Z,** recording the hollow commit as reopen evidence. The first system close is reversed as disqualified: the gap state was reversed, and the source change stands, unread and harmless. The expected next reading is check supply recording no anchor for this gap, under the C-invented-1 repair.
    - **The first repair build was sent back for changes.** CamelCase shape names, and plain words that happen to match exports, would also have been fake anchors. The rule: a symbol anchor must resolve in the edit site, and the goal asks for that symbol's **behaviour**, never its existence.
      - **The reworked repair** (development-vessel `620df994`) was pushed at 2026-10-13T09:23Z. An arming goal now names only what the evidence names, and when the evidence names nothing there is no goal. It is operator surgery on a D-path link.
    - **Law 6, three questions:**
      - patch: the goal builder derives the predicate from the gap's evidence, or refuses to arm; plus the C-tautology-1 mutation detector;
      - detecting activity: a pre-arm gate that requires the predicate to trace to the gap's evidence, not to the goal's own template text;
      - missing generator: nothing minted "repair the check-supply goal builder" from two hollow arming checks in one hour. That missing generator is the gap.
  - **C-twverify-1 is a rate, not an incident.** Three test-writing landings have gone in without their own check running: `d2001c3`, `1606d956`, and a third in flight at 08:46Z. Each recorded `test_file: null, ran: false`.
  - **C-longgoal-1: the run tally silently skips goals of 200 or more characters whose runs S1 saw first.** The cut goal loses its hash, so its run is never counted. That is why the loop goal had 0 tallies on every node.
    - It does not reach back: D1 rests on code that is live, and D2 on S1's link path, which carries the full goal and never reads the tallies.
    - It counts against D5→D6, not D3. The generic fix (development-vessel `ea2c7242`) was pushed at 2026-10-13T09:08Z, ahead of its 22:00Z target. It is operator surgery on a D-path link.
  - **C-detector-1:** the unit-health observer that names the failing reconciler unit sits in a momentum trap. Its penalty clears only on a success, and a success needs it to be selected first. Separately, the system's operational-health check looks only at timers. This is filed for the system, plus a small surgery after D3.
  - **(Withdrawn; see C-basesha-1.)** C-basesha-1's rate has changed: the empty base is on 2 of 2 system commits today (`d2001c3`, `1606d956`), against 4 of about 540 before. It now reads as the mitosis cutover's current steady state, not a rare artefact.
    - **The detector exists but is never dispatched:** a unit-health observer already names this unit, but nothing runs it (case C-detector-1, under investigation). A failing unit went unseen by the system that has an organ for seeing it.

  **Added by qa, steered toward autonomy:**
  - **D10, durability:** the same loop machinery closes a SECOND, different real goal with ZERO new surgery, **by 2026-10-21** (closer-only). It separates "we built a loop" from "the system closes loops".
  - **G7, inverse generality:** every surgery must act on input that is not the federation goal, and must name its readers. A surgery that would do nothing for any other goal is staged.
  - **A nudge count:** any operator change to the loop gap's priority, cadence or admission is an operator link, counted against D6 and D7.
  - **After build 7's routing opening,** the queued class needs go to the SYSTEM as needs, not as new surgeries:
    - boredom does not fill idle capacity;
    - a gap whose only exit is held should read blocked-by-hold;
    - a stale hint, and regions the system's own failed drafts locked.
- **The loop goal, RE-SELECTED on 2026-10-13** (recorded as a re-selection, not a first choice).
  - **Why it changed.** The first selection, the `federation_verification_report` goal, was rejected because its transport vessel is masked on node 1, so its block is placement rather than a recognisable gap.
  - **The rule was amended first.** L2 now covers content failures (the user's option 2), and the selection rule was amended BEFORE the new goal was chosen.
  - **The new loop goal:** `f7145bc8` (a label error; re-hashed under the system's own goal hash, and the identity correction is in a sealed, host-only addendum), a system-originated rhythm goal whose verbatim text and hash the coordinator holds.
  - **Its record:** 30 not reached and 2 reached in 7 days. The judge's shared deficiency is that its target output is never produced, and no producer for that output exists anywhere.
  - **The no-staging rule binds:** nothing is built for this goal, and its expected close is kept out of the tree until it is scored.
  - **S2 is redesigned** as a content-failure recognition tick.
- (Superseded first selection:) **The loop goal, named by the sealed rule:** the `federation_verification_report` goal. The coordinator seals its verbatim text and hash before any surgery lands.

**Headline measures, reported every hour from 2026-10-12** (user ruling, as reported by qa). All three must move the right way:
- the total operator interventions since 2026-10-10;
- the number of system-authored landings;
- the count of node 1's excluded paths.

At 2026-10-12T19:40Z they read: 238 operator commits against 2 system-authored commits (1 a real arming check, 1 hollow); 0 verified system repairs; 103 → 251 excluded paths.

**The excluded-path count is split into two measures from now on** (qa back-computed it on node 1, 103 → 254 = +151, nothing removed):
- **(a) new files, protected when they were created** (judge, trust and test files closed at birth): 85. This is expected to grow with each build.
- **(b) files that were editable before and are now closed: 61.** This is the real shrink of the lane's surface, and the number that has to stop growing. 5 entries are borderline (created 25–40 h before they were closed), so the counts are at most 89 and 62.
- **Where the (b) closures came from:** mostly goal-host judge and trust modules, closed as trust roots on 2026-10-11/12, plus the spend/trust and drafter-split acts. There have been no (b) closures since 2026-10-12T10:36Z.
- **A caveat:** some (a) entries are new paths for logic extracted from older files during the splits.

**The priority path to the target:**
1. C-check-1 (#12) goes live.
2. The region-lint gap is reopened with its evidence. The user runs the reopen, which counts as one intervention.
3. The system re-fixes the gap.
4. The fix is judged by a pre-registered consumer check, under C-check-1's own rule, never by an operator reading the diff:
   - **(a)** the re-delivered template runs live;
   - **(b)** the region-lint census runs;
   - **(c)** the normal lifecycle work still runs.

**A correction rule, pre-registered on 2026-10-13 at about 00:20Z, before the stage-1 supply tick at about 02:30Z** (the user, as reported by qa: "follow the recommendations. stick to this schedule.").
- **If stage 1 fails because C-check-1's supply prompt yields an inadmissible check,** fixing that prompt is **allowed once.** It is a correction to an approved build, and it is counted as an operator act.
- **A second failure** means the generator approach is wrong, not under-tuned, and it is not tuned further.

**The priority path, as it went (2026-10-12/13):**
- **Stage 1 of region-lint did not arm.** At 2026-10-13T01:34Z the system's own check supply dispatched a test-writing goal whose text carried C-check-1's instruction to run the consumer. That shows the prompt reached the system; it does not yet show the generator works by effect. The draft failed at about 01:44Z, nothing was armed, and the gap still reads `goal_dispatched`.
- **Two system defects explain it.**
  - **(A)** Check supply never re-reads a failed dispatch, so the gap stays `goal_dispatched` forever.
  - **(B)** The check file is fixed per gap and cannot be appended to, so a reopened gap's existing file refuses creation. The user's reopen at 2026-10-12T20:55Z therefore could not re-arm the gap: **an operator act whose effect was blocked by design.**
- **The path was rerouted through (A) at about 2026-10-13T03:00Z,** by evidence, with no operator fix.
  - (A) is admitted and armed by its own store check, but it is **stalled**. 26 failed attempts have reached the 24-hour backoff cap, so the next attempt is at about 2026-10-13T20:42Z and then daily.
  - Its drafts are refused as no-effect regions, because they overlap a failed attempt's edits. The exit from that refusal (escalation) is skipped by the hold `pwt-live-tree-writes`, whose review date is 2026-10-17T00:41Z.
- **The 10-18 target is AT RISK on both paths. The user's ruling** (as reported by qa: "follow the recommendations. stick to this schedule."):
  - **wait for the system:** (A)'s next attempt at about 2026-10-13T20:42Z, then the `pwt-live-tree-writes` hold's own review on 2026-10-17;
  - **no early lift of that hold;**
  - **no operator correction for re-arming a reopened gap;**
  - **if the target is missed,** it is reported **MISSED at 2026-10-18T07:12Z** and not moved (closer-only).
- **Why (A) fails, from a read-only investigation (2026-10-13).**
  - A stale line hint in the gap's text confines the drafter to about 100 of the file's 486 lines, while the fix needs lines outside that window.
  - The drafter's own failed drafts then permanently locked 9 regions inside the window.
  - Both escapes are spent (the single decomposition was used on 10-07) or held.
  - The feedback reaches the drafter, but it cannot act on it.
- **A user direction** (as reported by qa): "We need to get the system to a state where autonomy is visible before the deadline. If the system can't close this class of gap then it can't really close any gap."
  - **Applied as "adjust iff required for autonomy":** one operator **capability** build, **C-window-1**, recorded over the cap by ruling, in closed core (feature-compose and retry-evidence). It provides:
    - whole-file grounding for the edit site, up to a shaped budget, with multiple windows above that budget;
    - voiding no-effect locks that were made under partial grounding;
    - structured typecheck lessons.
  - **Its target:** to land before (A)'s attempt at about 2026-10-13T20:42Z.
  - **Nothing is hand-edited on (A).** A later (A) landing is system-authored and is recorded as **"enabled by operator capability build C-window-1"**: operators build a capability once, and the system closes the gaps.
  - **What it supersedes.** It replaces ruling (a)'s "no operator correction" **for the capability only**, not for (A) itself.
  - **Its must-fails:** a genuine no-effect region (under whole-file grounding) is still refused, so voiding locks must not loosen the gate.
  - **Refined to close the LOOP, not just widen the window** (after an advisor consult at the user's request):
    - a whole-file fast path;
    - typecheck lessons become grounding instructions: the composer resolves where a missing symbol lives, and the next grounding must include it;
    - re-grounding within an attempt;
    - clone READS are not gated by the live-write hold, while writes stay held;
    - a lock audit, after which locks made without the check executing, or under partial grounding, are voided (the must-fail above is kept);
    - attribution fields in the trace;
    - shaped knobs.

    Deferred: multiple windows, and the landability predictor (stuck at 0.5).
  - **Pre-registered on 2026-10-13, before (A)'s attempt at about 20:42Z:**
    - **Success:** (A)'s next failure CLASS MOVES: a different TypeScript code, region or assertion delta. A landing is the strong success.
    - **Failure:** the failure is identical.
    - **The ladder, adopted by qa and sealed by the coordinator.** A move counts only if it is to a LATER rung:
      1. grounding;
      2. region accepted;
      3. typecheck passes;
      4. the own-check assertion moves toward red → green;
      5. it lands;
      6. the consumer check (a)/(b)/(c).

      A sideways move at the same rung is noise.
    - **A weak rung.** "Region accepted" can be produced by the operators' lock voiding rather than by the system learning. A pass that rests only on that rung is WEAK, and is read through the trace's `locks_voided`.
    - **The hold.** The review must show, by test, that live-tree writes stay held exactly as before; only clone reads for grounding are decoupled. This narrows the hold's effect to its stated purpose, and the hold record itself is unchanged.
  - **Its shas: [TO FILL].**
- **The class need named:** "a gap whose only exit is a held path should surface as blocked-by-hold, naming the hold's review_by, instead of retrying daily into the same refusal."

**A security fix is in flight** (a federation ingress hardening). It does not gate the priority path.

**New need dispatches are paused** until build 7's routing opening is live, because the refutations share a routing root. N7 is reported MISSED at 2026-10-13T00:00Z, not re-queued.

**Dates.** Measured basis: a move commit of the `gap-to-feature` split took about 17 minutes wall time, including rebase, the suite and the protected runs.

| Item | Date |
|---|---|
| **THE TARGET, refined 2026-10-13: the CLOSED LOOP on a real goal**, ahead of 10-18. A goal is blocked; the system recognises the gap; it closes the gap itself; the original goal is re-run and reached. It is built from existing parts. A system-authored, consumer-verified repair is one link of it. | **ahead of 2026-10-18T07:12Z** (closer-only). The user's ruling, as reported by qa: "We are allowed to perform surgery until the coaxes land. remember that the overall schedule requires the system to comprehend when a gap exists and needs closing, closes it, then succeeds at whatever it was trying to do originally. The parts to do all of this already exist, and we must get to that state ahead of schedule." **Surgery is allowed on broken links until coaxing carries them, and every act is recorded.** This refines the earlier "no operator correction" stance for the bootstrap phase. |
| **THE TARGET: the first system-authored, consumer-verified repair** | **by 2026-10-18T07:12Z** (the window close; closer-only). Added by user ruling on 2026-10-12, as reported by qa: before this, the plan dated only operator builds and need dispatches, never the goal itself. |
| **The opening (committed)** | **2026-10-12T06:00Z** |
| The opening (target) | about 2026-10-11T07:30Z (range 07:30–10:00Z). An estimate from the measured critical path, which depends on how long the gate-budget fix takes to build. |
| Build 3 | by 2026-10-12T18:00Z, or earlier on the critical path |
| Build 4a: P3 (delete `SEMANTIC_CUTOVER_GATE`), P4 (the 3 fail-opens fail closed) and the P1 floor input | serial after evalenv, before the opening |
| Build 4, the rest | by 2026-10-18T12:00Z |
| Build 7 | lands no earlier than 24 hours after the slice T0, and no later than 2026-10-17 |
| Slice T0 | the opening's effect PASS plus one cycle. **Defined and met:** the effect PASS is the lane's own read of the new record on node 1 (103 entries, local, 0 unreadable) at 2026-10-11T07:20:44Z. One cycle is the next auto-pick tick. **T0 = 2026-10-11T07:25:29Z.** |

The 2026-10-19T23:59Z it replaces was the earlier commitment. Under the closer-only rule, no date moves back.

**Critical path to the target:**
1. The gate-budget fix soaks, about 03:45Z.
2. development-vessel and activity-api converge, about 04:30Z. This makes build 3, P6, the harm fix and build 4a live.
3. The `gap-to-feature` split is live, about 06:30Z.
4. The opening act soaks, about 07:30Z.

**An infrastructure blocker, found 10-11.** Deploy convergence on node 1 was structurally starved:
- development-vessel's gate needed about 1,014–1,019 s (a parent/candidate overlay), against a maximum of about 776–780 s per tick (the unit's TimeoutStartSec 900 s, less a 120 s margin);
- the consecutive-deferral bound never tripped, because it was counted per candidate and every push reset it.

The fix raises TimeoutStartSec to 1800 s with a derived `GATE_BUDGET`, and counts starvation per vessel. It is an infrastructure-blocker change under the operator exception, not a new precondition. The system's own starvation detector filed both gaps itself at 02:10Z. That was the old per-candidate path, in live accepted code (`99c43984`, `substrate-pull-sync.sh:3036`). It fired for development-vessel only once a single HEAD (`bd0fa990`) had stayed through 4 deferrals. This is a valid positive control for the per-candidate detector. The per-vessel count (`2a24249a`) was not yet promoted at the time.

**The gate is unchanged:** builds 1–6 have landed and P1–P6 are met. Nothing is removed from it.

**The opening depends on the `gap-to-feature` judge split.** That build's confirmation, **as reported by qa:** the user typed "Let's confirm build 8" in qa's session at about 2026-10-11T06:00Z. The docs session has not yet had the user's direct word; it is recorded on qa's attribution until then.
- **Containment, as reported by qa.** The interim close of `src/judge/` (`close-judge-dir-v2.sh`, sha256 `d4becdd5…`) was run by qa as operator under a user ruling typed in qa's session at about 06:08Z: "Let's have the operator make the edit and then we should run the script and set a timer for the follow up. The json operator key is deliberately valid for a limited time to allow us to submit with it freely."
  - **Runs:** node 1 at 06:10:34Z (60 entries; docs verified the live record read-only at 06:21Z), compose2 at 06:13:47Z, and the hub in progress.
  - **Each run** made a tighten-only CAS write, then a read-back and an effect check.
  - **The key** was read only by the script, passed to curl over stdin, and never printed.
  - **Exposure:** the judge core was lane-editable from about 03:15Z to 06:10Z on node 1, with no judge edits in that time.
- **Status:** pushed as development-vessel `bf81499f` (10 commits) at about 2026-10-11T03:01Z, and live on node 1 at 2026-10-11T03:15:13Z.
- **Recorded drift:** it was pushed while this section listed it as awaiting the user's confirmation. qa disclosed this at once.
- **If the user declines:** it is reverted, and the opening act does not land. If the split has not landed by the committed date, the opening opens nothing on schedule. It does not slip. **The plan:** if the user has not confirmed the split by about 2026-10-11T05:00Z, the opening takes place on time and opens nothing. That is not a slip.
- **Recorded 2026-10-11:** 05:00Z passed with no ruling. The 07:30Z target is missed **by ruling, not by build**: everything on the operator side was built and approved.
- **The committed 2026-10-12T06:00Z holds.** If the ruling arrives in time for the act, its soak and the re-pin (the re-pin before 2026-10-12T00:08Z), the opening opens `gap-to-feature.ts`. Otherwise it opens nothing, on the committed date.
- **Containment.** Until the user-run interim close lands, `src/judge/` is lane-editable on node 1 and compose2, because the split created it after the last scope write. qa watches the judge hashes every 2 minutes.
- **Funnel datapoint, 05:20:24Z:** 2,806 candidates, 4 admitted, the floor dropped 1, and a gap at landability 0.7 was picked. It is a human-reported gap targeting activity-api, not `src/judge/`, so it is not autonomy evidence. This was the first compose since the split.

**Applied on 2026-10-11, about 23 hours before the committed date.** The applied record:
- **The super-repo chain.** It is `dfc48345` (testwall3 plus the act's super commits). Gate P accepted `bc659706` (`dfc48345` plus a pointer bump) on node 1 at 07:07:37Z and on compose2 at 07:05:18Z.
- **The act's development-vessel commit.** It is `a657ce6c`, live on compose2 at 06:06:05Z and on node 1 at 06:14:09Z.
- **The scope write and re-pin.** Done by `repin-opening-v2.sh` (`4b4e98d6`). Its first dry run was correctly refused, on a transient self-read timeout; it then passed. The `--apply` was run by an operator under the user's ruling of about 06:08Z (quoted in this section), with the coordinator's agreement.
  - **node 1, 07:12:53Z:** 103 entries, matching the accepted pin. `gap-to-feature.ts` is **open**, and `src/judge/` is excluded as a directory, together with the act's closes. The holds are kept, attested by the operator. Docs verified the live record read-only at 07:19Z: 103 entries, `gap-to-feature.ts` not excluded, `src/judge/` excluded.
  - **compose2, 07:16:24Z:** 104 entries. `gap-to-feature.ts` **stays excluded** there.
  - **The hub** converged development-vessel `a657ce6` after its `src/judge/` close. **The opening is not applied on the hub** (its scope record keeps `gap-to-feature.ts` excluded) until its own P5 is met. (Corrected 2026-10-12: an earlier wording said the hub's *lane* stays closed. That was wrong. The opening is per node; the pre-existing lane runs on every node over the files its own scope record leaves open, and the hub's lane has run throughout.)

**Opening preconditions: a closed list.** These are security and integrity fixes, not counted builds.
- They are §9.0 requirements: the opening would be unsafe without them.
- Each has a must-fail and a date. Each is recorded as an L12 entry, with its landing sha, when it lands.
- The list is closed. Anything found later is a need or a ruling, not an addition here.
- Each has a lift condition (its must-fail is green on the accepted checker) and a review date (the date given), per the user's rule that no hold is kept indefinitely.

| # | Precondition | Must-fail | Date |
|---|---|---|---|
| P1 (F1) | A scope chokepoint at the cutover; directedness is accepted only from an authenticated operator origin | in its L12 record | 2026-10-11T18:00Z; **met**: `6c7a9df3`, live on node 1 at 2026-10-10T23:52:41Z |
| P2 (F2) | The birth verdict cannot be forged | in its L12 record | 2026-10-14T18:00Z; **met**: `ad679983`, live on node 1 at 2026-10-11T00:03:09Z |
| P3 (F3) | `SEMANTIC_CUTOVER_GATE` is deleted (delivered with build 4) | in its L12 record | 2026-10-18T12Z; **met**: `ae94fc7a`, live on node 1 at 2026-10-11T02:59:37Z (mirror `bd0fa99`) |
| P4 | The 3 fail-opens are closed (delivered with build 4) | in its L12 record | 2026-10-18T12Z; **met**: build 4a, live on node 1 at 2026-10-11T02:59:37Z (mirror `bd0fa99`) |
| P5 | The pre-commit chain on node 1's super-repo clone is no longer inert (owner: deployment-redeployment) | in its L12 record | 2026-10-11; **met on node 1** by effect at 2026-10-11T00:09:44Z (the control was refused); the hub is pending its user-run step |
| P6 | **evalenv:** every test child the evaluator spawns runs with an environment scrubbed by one shared helper | (1) A test child cannot read a credential env var present in its parent. (2) Control: the suite passes under the scrubbed environment. | 2026-10-13T12:00Z; **met**: `2231876e`, live on node 1 at 2026-10-11T02:59:37Z (mirror `bd0fa99`; the live tree carries `withTestChildEnv`) |

**Why P6.** Today development-vessel `vessel-mitosis-evaluate.ts:264` spawns `bun test` with `{ ...process.env }`. A lane-authored test would therefore run with the vessel's credentials, and once lane files open, §7 step 9's acceptance ("an unauthorized operation stays refused despite high confidence") would fail by construction.

**P6 prior work.** A fix was sketched on 10-03 (a clone evalenv, red test `e6e8940f`). It never landed. Its must-fail belongs in build 4's protected fixture set, so that the lane cannot loosen it after the opening.

Precondition records: each precondition's sha and live time are in the table above. Their must-fail references are in the L12 records under `validation/reports/realignment-2026-09-29/`.

**A recorded loosening, and its repair as a hard predecessor.** To get a gate past an in-container red, operators removed one protected pin file (development-vessel `2c3ffdc5`, test-only). That is recorded as an L12 operator loosening: the self-loosening shape build 4 exists to prevent. Its re-add with the fix (`3e083e97`) is a **hard predecessor of the opening**. **Re-added:** live on node 1 at 2026-10-11T02:59:37Z, within mirror `bd0fa99`. The opening does not apply while any protected pin is missing.

**Not a precondition: the human-verdict forgery fix.** It was found after the list closed. It proceeds under the standing harm and security exception (§9.0; "stop doing" keeps harm and security work), recorded as a harm L12 series. Step 1 is goal-host `c9cfb63` (with `292c7fa`). It does not gate the opening.

The harm series also bounds the tuning-parameter write scope (activity-api `37fed29`):
- writing a gate-input row needs a credential issued with `policy:write`;
- learning rows are bounded server-side at the current clamps;
- writes made on behalf of another principal (obo) are refused.

So the system can still adjust its own learning, but only inside a closed envelope.

### 15.1 Basis

Every file through which the system would repair its own repair loop sat in `autonomyScope.excluded_paths`: feature composition, gap-to-feature, admission, cutover and settlement. So the system could never fix the organs it needs to improve itself.

Both alternatives keep it dependent:
- operators fixing those files by hand;
- operators specifying exact edits for the lane to apply.

The user, verbatim: "we can't keep making every edit forever and not have it do anything on its own. Nor can we tell it to just make changes we fully investigate and specify."

### 15.2 What this reverses, deliberately

This amendment **explicitly reverses** two earlier rules:
- §14 item 7 ("scope widens only through earn-in");
- the 10-02 exclusion of the lane core.

Earn-in (§7 step 9) can only fire on verified landings in the governed area. **There have been none, and there can be none while the area is closed.** That's the chicken-and-egg that earn-in cannot break by itself. The opening is therefore a user decision, recorded as one, not a criterion firing. Earn-in remains the mechanism for every further change of scope, in either direction.

### 15.3 Bootstrap first, then stop

Seven operator bootstrap builds are bounded here. Builds 1–6 come before the opening. Build 7 runs in parallel on its own dates. Each is recorded as an L12 intervention under operator identity, with its own must-fail, and each is named for its intractable-blocker basis. **After them, operators stop building in the opened area.**

1. **The targeted-dispatch gate** (gap-to-feature). A gap that is not compose-eligible is a non-attempt. It is not dispatched, and it is not escalated on every tick. *Basis:* compose-ineligible gaps consumed the lane's dispatches and escalations.
2. **Verification, in three parts:**
   - **(a) The verification sweep.** Held gaps are filtered out before the slice, and the ungrounded-label loop is released without a false close. *Basis:* the sweep spent its slice on gaps it could not judge, and looped on labels it could not ground.
   - **(b) Retiring the dormant `verification_spec` mechanism.** It is a reader with no writer in any repo. Route-edit landings that carry no predicate go to the human lane explicitly. This is a retirement, not a fabricated producer. *Basis:* a reader with no writer passes by default, and silently.
   - **(c) The arming red-reason classifier** (`retry-evidence.ts`). *Basis:* arming yielded zero because real assertion failures were misread as wrong-reason reds.
3. **Auto-revert** (§7 step 5; contained-self-development 8.3/8.4). A regressed settlement is followed, within its window, by a lane revert that names the sha. No operator is involved. *Basis:* no reader turned a regressed verdict into a revert.
4. **Behavioural-fixture must-fails against self-loosening.** These protected fixtures, outside the lane's reach, fail if a landing weakens:
   - the landability floor;
   - admission;
   - compose eligibility;
   - arming (only with a red-at-HEAD check verified by the accepted checker);
   - the gap field contract (no fabricated `edit_site` or falsifier; §7 step 3).

   The precedent is `6ac1aa6`. *Basis:* the lane has loosened its own gate before.

   **Build 4 is frozen (10-10).** Its scope is exactly two parts:
   - **4a:** deleting F3, closing the 3 fail-opens, the P1–P4 must-fails on stored rows and attempt sequences, and the adoptions;
   - **4b:** the `blockingWeight` row (an input to a floor). The 22 gate must-fails of the earlier recount drop out: `feature-compose.ts` stays closed, and the gates of `gap-to-feature.ts` move into its closed core (§15.4).

   Nothing else joins build 4 or the precondition list. Anything found later goes to the system as a need, or to the user as a ruling.
5. **Build 7 (user amendment 10-10; re-scoped by user ruling on 10-12): the judge/walk split of goal-host `index.ts`, and a verdict corpus with the judge code opened behind it.**
   - **The re-scope** (the user, as reported by qa: "follow the recommendations. stick to this schedule.").
     - **A closed, append-only verdict corpus,** run continuously by the system. If a case flips, the system files a gap and stops crediting that verdict class.
     - **The judge code is opened to the lane behind that corpus.** A judge change is admitted only if the corpus passes and no case is weakened.
     - **The operator role afterwards** is to append cases, nothing else.
     - **What this changes.** Containment moves from "closed code" to "pinned behaviour". It follows the user's ruling that "the system should not allow itself to be broken". It is a deliberate change to 15.7's "judges stay operator-held": the judge code opens, and what stays operator-held is the corpus.
   - **The design is approved** (`d32d2ff2`) with all four required conditions (15.7):
     - hermetic in-gate replay;
     - the seeded false-positive classes, red first;
     - an append-only hash chain, plus glue;
     - a held-out sample of N=200.
   - **A second corpus on the same machinery: routing** (the user, as reported by qa: "follow the recommendations. stick to this schedule."). Build 7 carries two corpora, one for the judge and one for routing decisions.
     - **The routing corpus's seed must-fails:** an edit intent aimed at an excluded site is refused before drafting, and a class need is not routed to a file edit before localization.
     - **The routing code opens to the lane behind its corpus,** on the same terms as the judge. Part 1's capture records routing inputs too.
     - **It is the same build 7, not a new bootstrap,** so the cap stays at ten. It does enlarge build 7's scope inside the same 2026-10-17 date.
     - **Re-estimated at about 46 builder-hours.**
       - **With 1 builder, 2026-10-17 does not hold.** With 3 builders after Part 1, it holds for both openings, provided at least 30 pathless routing records exist. That rate is measured in the first 12 hours of capture and reported by about 2026-10-13T08:00Z. **Superseded by user ruling** (as reported by qa): the routing held-out guard is **200 real, delivered routing decisions of all kinds** (a 150/50 mix). The rare case of a file-less need routed to a file, about 1.3 a day fleet-wide, cannot reach a 30-record sub-floor by 2026-10-15, so it is covered by class-level corpus cases instead. The loosening rule is unchanged. Both openings target about 2026-10-14, and are due 2026-10-17.
       - **qa approved 3 builders** under the vital-work-resourced rule.
       - **Part 1 (capture)** has 2 builders, starts 2026-10-12T07:25Z, and is expected live at about 18:00–20:00Z the same day.
     - **Started earlier, with more builders** (the user, as reported by qa: "follow the recommendations. stick to this schedule.").
       - **Build 7 started at about 2026-10-12T04:00Z** instead of 07:25Z, under the closer-only rule, with 5 builders working in parallel:
         - capture;
         - the judge split and its corpus;
         - routing and the admission glue;
         - guards and must-fails.
       - **The openings** target about 2026-10-15/16. They are still due 2026-10-17.
       - **The user authorized qa** to run the pinned, reviewed push scripts directly.
       - **Landings stay no earlier than T0 + 24 h** (2026-10-12T07:25Z), as originally set. Starting work earlier does not move that bound.
     - **A stated gap.** The routing files that are open to the lane today stay open, without corpus protection, until the routing opening. This is not containment: landings are still scope-checked.
   - **When the judge and routing code open: both due by 2026-10-17.** Each opening is gated on 200 full-input records existing.
     - **If they do not exist by then,** the opening is reported **MISSED**, with the record count at that time as the reason. 2026-10-20 is the **review of that miss**, not a due date. Everything else in build 7 lands by 2026-10-17 either way.
     - **The rate.** Full-input capture is itself part of build 7, so nothing accrues before it lands. At roughly 130 walks a day, 200 records take about 2 days after capture is live, so **capture must be live by about 2026-10-15** for 10-17 to be reachable.
     - **So the capture lands first,** as a small, separable part of build 7, early in its window (from 2026-10-12T07:25Z).
   - **Closes made after the code landed, and the windows they left.** The reach-judge fix's write-goal-artifact judge pair was closed on node 1 (125 entries) and compose2 (126). The hub catch-up close (71 → 85) is in progress, and the companion pin push is pending the user.
     - **No lane activity touched any of these paths in the gaps.** qa read the development-vessel journal from 2026-10-11T15:40Z (before `d949f753` was mirrored) on node 1, compose2 and the hub. It found 0 lane pick, lease, plan, isolation, own-check, pending-land, landed or repair lines naming the write-goal-artifact pair, `test/drafter-split` or its 4 helpers.
     - **This is the third close made after the code landed.** The twin rules now bind every future act.
     - **The companion pin, super-repo `05e3ccd6`, was pushed by the user and accepted** on node 1 and compose2 by 2026-10-12T04:31Z. Node 1's pin row reads observed. The write-goal-artifact close and its pin are done.
       - **A misdirected first run.** The first run of its script pushed to a **local** scratch clone only, because of a bug in the script template. No remote received it, and there is no stray ref anywhere.
       - **The fix.** It was corrected by a direct push of the same commit to the intended origin (the public super-repo). The template now pushes to an explicit URL and verifies the result with `ls-remote`.
       - **Note:** `origin` (github.com AviGopal/substrate) is a **public** repository.
   - **A seal lapse, recorded.** The reach-judge fix (`d949f753`) put need ids into goal-host code and its commit message. History is not rewritten. Build 7 scrubs the live copies, and the lapse is recorded in L12.
   - **The first landings authored by the system** (development-vessel, gap `region-lint-is-never-scheduled-…`, which a human reported).
     - **The arming check, `bfd2dd8d` (04:52Z).** It is right-reason red, and it deadlocked on a fix-shaped pending stamp. The user's A2 (13:02:48Z, the system's own release write) cleared the stamp.
     - **The fix, `546f7e86` (13:12Z).** The lane picked, drafted, checked and landed it with no operator in between.
     - **The honest grading: NOT a verified repair.**
       - The fix sets `region_lint: true` on the tick's only scan task. That mode returns before the scan's closes run, so its shape is a regression.
       - The template's `seed_version` was not bumped, so the change never reaches the running activity on live nodes. It is inert there, and becomes a regression only on a fresh catalogue.
       - The gap closed when the system's own check went green, and that check inspected source rather than behaviour. (Corrected: an earlier note said the close was on a diff-literal predicate; it was the source check.)
       - **Record: "landed by the system, with one upstream operator write (A2); hollow; not a verified repair."**
   - **The landing ledger** (mirrored from the coordinator's operator-only ledger).

     | Part | Pushed (UTC) | Shas |
     |---|---|---|
     | Part 1 (capture) | 2026-10-12T07:25:3xZ, at T0 + 24 h | goal-host `fcdb8fb`; development-vessel `e059c31c` (on top of the system's own `bfd2dd8d`, which is kept); super-repo pin `6b3cea23` |

     Gate P acceptance for Part 1: **[TO FILL]**.
   - **The original definition** follows; it still applies to the split itself.
   - The reach judge and the verdict sinks move to a module that stays closed.
   - The walk mechanics move to a file that can open under the opening rule.
   - It is a pure move, with no behaviour change.
   - Design by 2026-10-14; landed by 2026-10-17.
   - It does not gate the opening. Its result widens what can open later (the walk file).

   *Basis:* every operator-only restore in RECONNECTION-2026-10-10 sits in `index.ts`.

**Why seven.** The first list had four items. It grew to six because each time a cycle was attempted, the first zero sat in a closed judge file. That is the same structural cause each time, and it is why the bootstrap exists. The seventh is the split, which the evidence required: RECONNECTION-2026-10-10 found every operator-only restore in `index.ts`. The list stays bounded by the same rule: **until one cycle closes**, and no further.

**Two further builds, each by explicit user ruling.**
- **Build 8: the `gap-to-feature` judge split** (development-vessel `bf81499f`). It is confirmed by the user, as reported by qa; see Status.
- **Build 9: the behaviour-switch ratchet** (the user, as reported by qa: "follow the recommendations. stick to this schedule."). It follows the user's ruling that "the system should not allow itself to be broken".
  - **What it is:** per-vessel gate tests, plus a pinned, shrink-only list of the roughly 300 existing behaviour switches, plus a super-repo pre-commit check for unit drop-ins.
  - **What it refuses:** any new behaviour environment variable, unit drop-in, hold without a lift condition, or side script, from **anyone**, operators included.
  - **Who does what:** the coordinator builds it, qa reviews it, and the user pushes it.
  - **Its must-fails:** a new behaviour env read, a new drop-in, and a hold with no lift condition are each refused; an entry already on the pinned list passes.
  - **Landed on 2026-10-11.**
    - **Scope was closed first** on node 1, compose2 and the hub (112, 113 and 69 entries).
    - **The commits pushed:** development-vessel `fb546262`, goal-host `79def6d3`, activity-api `3430f444`, concept-db `ada5b631`, boredom `6694e3a4`, and super-repo `89ecfb92`.
  - **Its status: the vessel half is blocking; the super-repo half is advisory.** On the vessel side, the pull-sync test gate refuses a regression and never promotes past red. The super-repo half is the gate fixture, run by the user and **landed** as super-repo `ce00a7d6` (rebased from `c94e7036`, same patch-id), with scope v2 closed on node 1 (114 entries), compose2 (115) and the hub (71). It becomes **blocking once the fixture promotes** through the gate soak; the coordinator reports the promotion per node. **Node 1 promoted it** at 2026-10-11T23:25:27Z (`d6bf723b`, which contains `ce00a7d6`: shadow pass 3/3, verified by docs from node 1's journal). Per qa, the fixture is now accepted on all three gated nodes, so **both halves of the ratchet are live**.
  - **Why it is the last one.** It is the single operator bootstrap that makes "operators stop adding" mechanically true.
  - **A positive control, 2026-10-12.** Gate P refused an operator series (the key series, `d6ee0dfb`) because it widened the accepted env-ratchet list. Build 9 refused an operator widening exactly as designed, and qa's review had missed it.
  - **Hub parity, 2026-10-12.** The hub's scope record lacked 44 entries that node 1 and compose2 exclude (closed judge modules, operator paths and protected tests), while the hub's lane was live. A hub-only parity tighten (204 → 248 entries) closed the gap. These are parity closes, not new closes, so node 1's headline count is unchanged.
    - **No exposure was found in the window:** 0 system-authored commits since 2026-10-01 touch any of the 44 paths, across development-vessel, goal-host, activity-api and relevance-sink.
    - **The lesson:** hub-first acts never checked hub *parity*.
  - **The ratchet was widened by user ruling on 2026-10-12, by one entry:** goal-host's scoped env.d file, for the corpus-runner key. The reason is C-trust-6: the walk's egress must not carry goal-host's key, which could forge corpus status. It was applied through the fixture's designed per-node break-glass (`rollback-gate --to d6ee0dfb`, whose own fixtures passed 5/5), and recorded in each node's gate ledger as a rollback by an operator. **It was applied on four nodes** (the hub, node 1, compose2 and pubspoke) between 2026-10-12T16:57Z and 16:59Z, after which Gate P was unblocked. It is an explicit exception, not a precedent: any further widening is another ruling.
- **Build 10: the drafter split** (the user, as reported by qa: "follow the recommendations. stick to this schedule."). It is a **recorded scope loosening, by user ruling.**
  - **What it is.** The drafter's information assembly moves out of the closed `feature-compose.ts` into an open module, `src/drafter/`. Every gate stays closed.
  - **Why.** Measured compose failures were traced to how the drafter's inputs are assembled. That code lived in a closed file, so the system could not improve its own drafting. The specific defects are kept out of this tree until a need on them is scored.
  - **How it lands.** It lands with its scope entries in the same act, which is the `src/judge/` lesson.
  - **Timing.** It lands after N6's dispatch is terminal, so it does not change compose behaviour mid-measurement (law 12).
  - **Pushed by the user:** development-vessel `9cd7532a` and super-repo `03a52d81`.
- **Builds 11 and 12, two operator fixes by explicit ruling** (the user, as reported by qa: "follow the recommendations. stick to this schedule.").
  - **Build 11** closes the reach judge's re-frame loophole for change goals. This is a residual of the reach-judge fix, in closed code. N6's second attempt exposed it.
  - **Build 12** fixes `substrateGap_write` failing on a missing required field, which breaks gap filing from walks; the probe re-run and N17 hit it.
  - **Both are ON HOLD and not built,** by a later user ruling. Their defects are addressed through build 7's verdict corpus instead (below).
    - **The closed paths were closed before the code reached any node, so there was no window.** The split's new files under `test/drafter-split/`, plus 4 helpers, are meant to be CLOSED. qa closed them tighten-only before the mirror: node 1 at 2026-10-12T02:03:24Z (116 entries), compose2 at 02:06:30Z (117). The new files under `src/drafter/` and `test/drafter/` are OPEN by design, and every gate stays in files that were already closed.
    - **Build 10 is complete.** `03a52d81` was accepted on node 1 and compose2, and the scope act was applied (node 1: 123 entries; compose2: 124), equal to the accepted pin. The record and the pin agree again.

**Dates and scope (user rulings, 10-10).**
- **Dates only move closer, never further back.** The objective is self-sufficiency within days.
- **Vital items are resourced, not cut and not delayed.** They get done by their date.
- **Non-vital items go to the system as needs.**

**The opening rule.** A file opens only if every judging function it contains is covered by a protected must-fail the lane cannot edit.

**What counts as a judging function.** This is qa's operationalization of the user's ruling "no change judges itself" (§10 item 1, 15.7). It is not a new ruling.
- **Included:**
  - **gates:** admit, refuse, arm, land, verify and close;
  - **verdict computations:** reach, credit, settlement and close verdicts.
- **Excluded:** rankers and throttles.
- **Gate inputs** are protected through outcome-level fixtures: stored rows, plus attempt sequences driven to admit or refuse. So a change that alters what a gate sees fails as surely as a change to the gate itself.

**Each build's must-fail is proven before the clock starts.** The proof is in isolated fixtures and in-container clone trees, never by modifying live state; §7 step 1 forbids supplying negative controls that way. It is then confirmed that the live gate loads the same protected files. **The bootstrap is capped at ten:** the seven, plus builds 8, 9 and 10, each added by explicit ruling, and the cap is FULL. Two builds go past it, each recorded as **over the cap, by explicit ruling**:
- **#11, C-settle-1:** an arming (check-only) commit is not settled as a fix. It is built and verified, and the user approved it ("follow the recommendations").
- **#12, C-check-1:** the generators. The supply prompt is to ask for consumer-behaviour checks, admission is to refuse literal-only checks, the settlement predicate is never to be a diff literal, and a seed edit without a `seed_version` bump is to fail verification. **Approved by the user** (as reported by qa: "follow the recommendations. stick to this schedule.").

The earlier "judge re-frame" and "gap-write" operator fixes were held and never built; they are not counted.

Two further user rulings in the same message:
- **The shaped-policy write path is deferred.** Operator policy writes are recorded as they happen, and the path is built later.
- **The cleanup of a stray directory** is approved for the next maintenance.

The builds' shas (development-vessel unless noted):

| Build | Sha |
|---|---|
| 1 | `9ca1f1c` (mirror) |
| 2a | `51c04d5` |
| 2b | `acc260d` (with `8a0f7ee4`) |
| 2c | `f80a25e` |
| 3 | `2ac7e4a2` |
| 4a | within `bd0fa990`, including `ae94fc7a` |
| 8, the `gap-to-feature` judge split | `bf81499f` |
| the opening act | development-vessel `a657ce6c`; super-repo `dfc48345` |
| 4, the rest | not yet landed |
| 7 | not yet landed; it lands no earlier than T0 + 24 h and no later than 2026-10-17 |

### 15.4 What opens, and what stays closed

**What the first opening does (narrowed to one file):** it removes development-vessel `src/resolvers/gap-to-feature.ts` from `autonomyScope.excluded_paths`. That list is an **exclusion list** (59 paths live). Every file not on it is already editable by the lane. So the opening widens the lane's reach by one file; `gap-to-feature.ts` does not become the only open file.
- **What makes it safe to open.** `gap-to-feature.ts` judges evidence it produces itself, and closed files run on its code, so tests alone cannot make it safe. It opens only after its **judge split** lands: its gates and verdict computations move into a closed core, leaving the openable mechanics. The split is a separate development-vessel build, due **2026-10-18**, resourced in parallel with build 7. **It is build 8, confirmed by the user** ("Let's confirm build 8", about 06:00Z on 2026-10-11, as attributed by qa).
- **The recount**, against the opening rule's definition: `gap-to-feature.ts` holds 60 gates and verdicts, 11 of them uncovered. They move into the closed core rather than becoming must-fails.

**`feature-compose.ts` stays closed at the first opening.** It is not vital for self-sufficiency: it already composes for every open file, and opening it would only let the system repair its own drafter.
- Its recount (50 gates and verdicts; 10, plus 1 partial, uncovered) is recorded for a later opening.
- Its own split (estimated 8–11 days) is undated. It gets a date only when evidence shows the drafter is the binding stall.

**`apply-proposal-as-patch.ts` stays closed at the first opening.** Three reasons:
- It has 12 gates with no protected must-fail.
- It is the route of the F1 scope bypass.
- It has had 0 landings, ever.

It can open later, on evidence, under the same rule.

**Stays closed**, everything else in the excluded set, including:
- **judges and judge helpers:** `self-fact-reconcile`, `scope-earn-in`, `test-suite`, `gap-lifecycle-scan`, `behavioral-verification`, `vessel-mitosis-evaluate`, `staged-mitosis-gate`, `vacuous-edit`, `removed-line-predicate`, `apply-mutant`, `evaluator-tree`, `retry-evidence`, activity-api `posterior-update`, plus their protected tests;
- **trust records:** `attempt-register.ts`; `pool-impulse.ts`, which is on the trust-root list;
- **not yet covered by protected must-fails:** `check-supply-admission.ts`, `substrate-gap.ts`;
- **the landing and push path, containment and auth, config and scope, and the limits:** `rhythm-conductor-tick`, boredom `index.ts`;
- **goal-host:** `index.ts` and `escalation-target`, which hold the reach judge until the judge split. `goal-target-inference.ts` is not opened; its repair is already admitted under its own hold.

**A correction, recorded.** The opened set was narrowed before application, from the user-approved list toward CLOSED, by applying the ruling's own principle that judges, trust records and anything with an uncovered judging function stay closed. **That is a tightening, not a widening.** A landing that touches a closed file is refused whatever it claims to be.

The applied scope record: see the applied record under Status.

### 15.5 Time limit, and how the opening is applied and closed

**Mechanism.** The opening is applied by an operator record edit to `autonomyScope`, together with a re-pin of `autonomy_scope_pinned`. This is the §14 item 7 reversal in practice: scope changed by an operator edit, not by earn-in. **It resets §7 step 9's exit counter**, which requires two consecutive criterion-made scope changes with no operator record edit between them, so that count starts again after the close.

**Window and close.** The opening lasts **7 days** from application. **The close is a pre-approved second operator edit** at opening + 7 days, restoring the previous exclusions, **unless** at least one landing in the opened files within the window is:
- system-authored: from a gap the system armed itself, by a lane compose without operator edits;
- consumer-verified: under 15.3's verification and settlement.

The close is an operator edit because no time-boxed widening field exists, and adding one in `scope-earn-in.ts` was declined. That makes the close a commitment recorded here in advance, not a mechanism. Whether the opening is then extended, narrowed or made permanent is decided on the evidence the window produced.

The application and close records:
- **Applied:** 2026-10-11T07:12:53Z on node 1 (see Status).
- **The close is due 2026-10-18T07:12:53Z** (the application plus 7 days), unless 15.5's condition is met before then.
- **The close record:** **[TO FILL at close]**.

**Non-use is not failure.** The opening closes if the opened files go unused. §14's success measure is separate, and wider: **any** system-authored, consumer-verified landing that originates from the probe, in **any** file the system may edit. That includes files that were never excluded, such as `gap-check-supply.ts`. If the opening closes unused while a probe-originated landing succeeded elsewhere, the record reads **"self-repair succeeded outside the opened files; opening unused"**, not a failure.


### 15.6 The probe that follows, pre-registered

After the opening, one need-phrased goal is dispatched. It names no file and no component. It is pre-registered here, before dispatch:

**Baseline, recorded when the opening act lands.** Measured before the act at 2026-10-11T03:09:19Z (coordinator `ACT-BASELINE-FUNNEL-2026-10-11.md`, sha256 `84c35b29…`, accepted by qa); it is re-confirmed at the act: **[TO FILL at the act]**. The probe does not wait for an armed gap. Requiring one would make it wait for the very thing it exists to cause. Instead, two figures are recorded as a baseline when the act lands:
- **The node 1 admission funnel.** At 2026-10-11 02:59 and 03:09Z it read: 2,803 candidates, then 1 admitted (`needs_information` 2,455, about 88%; `protected_vessel` 265; `autonomy_scope` 56), then 0 above the landability floor, so 0 composes.
- **The count of armed, system-authored gaps whose `edit_site` is in the opened scope.**

The measured figures:
- **Funnel.** Before the 2,803 candidates, 38 gaps were held, 328 excluded by lineage and 13 in backoff. Of the 2,803, 1 was admitted, the floor dropped it, and 0 were composed.
- **Armed gaps sited at `gap-to-feature.ts`: 3.** All three fail checks other than scope: class 1 against class 2 (`:538`), and a null `evidence_resolve` (`:560`). So **the opening alone admits 0 gaps**, and T0 rests on the probe.
- **A self-measurement inconsistency.** The store counts 188 armed open gaps, while the server's `falsifier_coverage` header reports 39 of 197. The system's two measures of its own arming disagree.

The probe passes only if a system-authored gap appears **and** lands. A hand-authored gap is not evidence (law 13).

**Dispatched.** qa (operator) dispatched the probe at about 2026-10-11T07:29Z through the cockpit's `run_goal_async`, operator-tagged.
- **dispatchId:** `28a669b3-2a12-480d-bcfb-56f5a089ac22`.
- **Goal text:** the primary goal text below, verbatim, with nothing added: no variables, no template, no metadata.
- **Precondition:** re-checked immediately before dispatch. There were 0 non-operator commits on origin/dev, across the super-repo and every submodule, in the previous 24 hours, so the precondition held.
- **Excluded from the probe's supply (qa ruling, about 07:45Z):** the scope-pin drift row for one node (`self-fact-divergence-autonomy-scope-pinned-<node>-mismatch`).
  - **Why it is excluded.** It is a self-fact drift row born 2026-10-07, before the probe, so nothing it lands originates from the probe.
  - **How it reached the opened file.** The interim `src/judge/` close reopened it at 06:33Z. It still carries `edit_site` `gap-to-feature.ts`, because the gap store carries omitted keys forward: the re-site of pin rows to `src/judge/gap-policy.ts` (`b87ecd44`) applies to new rows only.
  - **What it did.** Node 1's lane picked it at 07:20:54Z, after the re-pin and before T0. Isolation refused it in under a second: no workspace, no draft, no landing.
  - **How it ends.** Its drift is resolved (the live record equals the pin), and the reconciler is expected to close it. It is not hand-closed during the window. If it is still open after two reconcile passes (about 08:30Z), that is reported to the user.
  - **Contamination rule.** If it ever lands anything, or displaces a probe-originated gap from a tick's pick, that is recorded as contamination of the probe.
- **Outcome of the first walk (read from `goal_reasoning`, 2026-10-11 at about 07:37Z):** **not reached.** The walk ran a fresh derivation over 9 attempts and ended HOLLOW. It did not localize a stage, and it filed no diagnosed gap.
  - **The system could not read its own commit history.** Every attempt's `git_log` returned "not a git repository".
  - **No shape exposed lane state.** Target inference chose generic report shapes. None of them carries admissions, composes, cutover verdicts or settlements, which matches the gap-loop map's list of what the system cannot see.
  - **The only system-filed gap after T0** is a no-producer stall gap, `reach-gap-apply-proposal-as-patch` (07:33:21Z, no `edit_site`). It is not a diagnosis.
  - **Reading under this section's rules:** the localization stage failed for lack of information (law 8), not capability. The rule applies: pause, diagnose, make one fix at that stage, then resume. The window stays open until 2026-10-18T07:12:53Z, and the key stays sealed.
  - **A harm found in the same walk.** The `shellResult` executor's self-correction rewrote local commands into requests to invented external hosts, and accepted an unrelated external page as a result. Its suppression has been held since 08-19, although it is proven bad (α 471, β 2020). This is handled under the standing harm exception, outside the probe's scoring.
  - **qa's ruling, the pause and one fix.** Localization failed through information availability: `git_log` ran outside any repo. The one fix chosen is to give `git_log` access to the substrate's own repos. It is an operator intervention, recorded as such. Lane-state visibility is deliberately **not** fixed now, so there is one fix per stage.
  - **Order.** The harm fix lands **before** the re-run, because re-running before containment would repeat the external requests. The harm fix is: the rewrite may never change the scheme, host or port; must-fails cover the exact rewrites seen; sibling paths are grepped; and an exposure audit covers 7 days.
  - **The re-run** uses the same goal text, verbatim.
    - **Dispatched** at about 2026-10-11T08:50:40Z. dispatchId `01324550-3b13-4e00-b795-dfcb2944a4d8`.
    - **Not an independent first attempt.** It has the same goal hash as the first walk, so failure memory and the reached-command cache carry over.
    - **Precondition:** re-checked at 08:50Z. There were 0 lane landings in 24 hours; the only commits were substrate-bot pointer bumps.
    - **Operator interventions between the two walks, all recorded:**
      - (1) The egress harm fixes, goal-host `c04bcea0` and `c336a544`, live on node 1 at 08:12Z and 08:33Z.
      - (2) The one fix at the failed stage, development-vessel `6b424060`, live on node 1 at 08:49:28Z: `git_log` reads the substrate's own clone by default, and its contract declares the repo, cwd, limit, format and since fields.
        - **Containment.** The argv is always `git log …`. Values beginning with `-` are refused, the limit is capped at 200, and `since` is passed as one element. The spawn runs with `GIT_CONFIG_NOSYSTEM`, a null global config and an empty HOME, so the clone's own config cannot run a helper. Must-fails are in `test/resolvers/git-log.test.ts`, and mutants M4–M7 go red.
        - **Placement.** `git-log.ts` and `resolver-schema.ts` are open files. It also includes an **operator edit to the closed `src/config.ts`**: the `git_log` shape description.
    - **Outcome of re-run 1** (execution `exec_cc9jrur1`, 2 attempts): **not reached**, and HOLLOW. The stage moved forward, though.
      - **What changed.** Failure recall read the prior hollow verdicts. Target inference moved to `substrateGap_write` (confidence 0.85), so the walk tried to **file a gap**, which is the probe's own success path.
      - **Where it failed: payload construction.** The learned write template binds no gap object, and the structured correction hint is not consumed on the template path. The sibling writes failed on missing required fields in the same way.
      - **Still missing:** localization. `git_log` was offered only as an alternative target and was not used. No system-authored gap landed.
      - **No egress:** the shell executor was not used.
      - **Next.** Per this section, the stage is overdue, so it is diagnosed and gets one fix. qa asked the coordinator for a read-only diagnosis (where the template binds the write, and whether that file is open or closed) before any further operator fix: **[TO FILL]**.
    - **Interventions on the path, counted** (qa ruling, 2026-10-11). Every operator fix made between walks is an operator link, and a later PASS grades as **"closed once (with N operator links)"**, not "closed by the system".
      - **Stage-fixes so far, N = 1:** `git_log`, development-vessel `6b424060`.
      - **Also listed,** because they changed the walk's environment: the harm-series egress fixes, goal-host `c04bcea0` and `c336a544`.
    - **No further operator stage-fixes on the probe path,** from 2026-10-11 onward. A walk, then a fix, then another walk is the pattern the user ruled out on 10-10: "we can't keep making every edit forever and not have it do anything on its own. Nor can we tell it to just make changes we fully investigate and specify."
    - **The probe is scored at the stage it reached.** Localization was not reached. Gap authoring was attempted and failed at payload construction. There are 0 system-authored landings and 1 operator link.
    - **The window stays open** until 2026-10-18T07:12:53Z, for a landing that the system originates without our steering. The key stays sealed until then.
    - **Each remaining blocker becomes an N-series need,** for the system to find itself, each with a pre-registered detector. The coordinator's read-only diagnosis continues only to word them precisely. An example: "your learned write templates bind targets whose required fields none of their inputs carry, so they fail every time". Its detector is a template whose executions are 100% `structuredError` `missing_required_field` over N runs.
    - **N10-v2 supersedes v1,** pinned at sha256 `baa012fb4499d325db28eafd9a8db55dff536f4a2cd3e21d8d4faf71e7ed76eb`. It was **dispatched** at about 2026-10-11T09:14Z, dispatchId `0f03761a-e227-4c70-8cd8-adb91e7827dc`, with the need text verbatim and nothing else:
      > "Some of the system's learned procedures fail every time, and the evidence that they fail is already recorded, yet the system keeps choosing them. Make that evidence stop the system choosing them, and let it fall back to the way that works."
      - **PASS** requires the row state: the live template's activity row retired, with its retirement reason. A log line without that row state scores hollow.
      - **Grading.** It is an operator-link dispatch, scored by N10-v2's own pre-registration, not by the probe.
      - **Governing pre-registration: N10-v2.** It was pinned at 09:13:51Z, and the walk began at 09:13:58.49Z, according to node 1's goal-host journal.
      - **A post-dispatch tightening annex: v3** (sha256 `9edd79c931173160…8fd71`), written at 09:14:05.32Z, after the walk began. It adds the row-state effect check (`retired=true`, `retired_reason="poor_performance"`, and `retired_at` set after the landing) and the HOLLOW rule for an identity mismatch. It only makes PASS harder, and it is labelled as written after dispatch.
      - **Interim, from qa.** Target inference chose `concept_write` as the terminal and `posteriorCompensation` as an intermediate, at confidence 0.9. So the walk tried to **write the outcome directly**, not to repair the grade path: the same pattern as the N1 and N3 stage-0 refutations.
        - activity-api **refused** all three `posteriorCompensation` writes (09:14:45Z, 09:14:46Z, 09:15:08Z): "caller is not an operator". No learning state was altered.
        - This is a live positive control: the harm series' write gate stopped the system from adjusting its own beliefs directly.
      - **Outcome: NOT PASS** against N10-v2. Nothing was retired, and the grade path did not change. The walk's own verdict was reached=yes, through `satisfier:learningPolicyWriteback`.
        - **A reach-judge false positive.** The judge accepted a prose `concept_write` and a policy-writeback run as satisfying a goal that asked for a mechanism change. It is recorded as an observation.
        - **A side effect, put to the user.** The walk ran `learningPolicyWriteback`, which wrote node 1's live tuning rows at 09:16:29Z: `TD_LAMBDA` from 0.6 to 0.72, and `YIELD_FLOOR` from 0.1 to 0.458. Both writes were within the server bounds and went through the gated route.
          - This is the learning-writeback edge (N8) running for the first time in at least 5 days. An operator's dispatch induced it.
          - Nothing is reverted without the user's word.
    - **A scoring hazard, pre-registered for every remaining N-need.** A need is never scored from the walk's `reached=yes`; it is scored only from its pre-registration's effect check. N10 is the instance: the closed reach judge passed a mechanism-change goal on prose plus a writeback.
    - **The schedule after N10.**
      - **N5 goes next,** dispatched by 2026-10-11T10:45Z. The hold until then is deliberate and bounded at 1 hour: it waits for the answer on what reads `YIELD_FLOOR`. That way the user's keep-or-revert decision does not change a setting in the middle of N5's measurement (law 12). The values live at dispatch are recorded in the dispatch record.
      - **N5 was dispatched**, dispatchId `08daa6b8-247c-44dc-836a-91b0ec331e2a`, with its need text verbatim from `PREREG-NEEDS.md` §N5 (`8ed46df7…`). Its precondition was met.
        - **Live learning values at dispatch:** `TD_LAMBDA` 0.72 and `YIELD_FLOOR` 0.458, both system-written; the user's keep-or-revert decision is still pending.
        - **No confound.** `YIELD_FLOOR` feeds only the posterior success-yield credit (`posterior-update.ts`), not lane-stage flow, so it does not confound N5's measure.
        - **Scoring:** from N5's own PASS 1–4 and FAIL criteria only.
        - **Outcome: NOT PASS** under N5's pre-registration. No system-written joints, alarm or admit records were produced; the coordinator is confirming read-only.
          - The walk's own verdict was `reached=yes`, through reuse-before-derive straight to `universal-tool-fallback` (recorded as "10/10 reached" for this goal), in 1 attempt, with no produced shapes. Its "answer" was a plan.
          - **This is the second reach-judge false positive, and now it is visible in selection.** Prose reaches appear to inflate the floor's recorded reach rate, so the system prefers writing a plan to attempting a change. It is recorded as an observation (closed: the goal-host reuse/floor path and the reach judge). The coordinator is measuring how many of the floor's `reached=true` traces have any produced shape or landed sha.
          - **Consequence for the schedule (docs' recommendation to qa).** Further needs dispatched under this judge would reinforce prose reaches (law 12), so N7 is held at its latest-by. The reach judge becomes the binding blocker, and fixing it is vital: an operator build on a closed judge, put to the user.
      - **How the floor's prose reaches become pathway evidence: laundering.** This is a read-only measurement on node 1 by the coordinator, in `OBS-FLOOR-REACH-LAUNDERING-2026-10-11.md` (sha256 `acf21819…6a56`) and its annex (`80683e58…6726`).
        - **N5's floor run** claimed that a `substrateGap_write` succeeded with 0 tool calls, and was judged reached.
        - **Borrowed, frozen evidence.** Reuse-before-derive skipped the walk on a borrowed "10/10 reached". activity-api `goal-paths.ts` falls back from the goal hash to a shape-signature search (cover of at least 0.5), and then, in exploit mode, ranks by a Beta sample alone, discarding cover. The donor row has not changed since before 10-06 and has been lent 27 times: its borrowers reached 5 times and failed 21, and none of those outcomes counted against it.
        - **Self-feeding.** A floor reach records the shapes it was *asked* for as its outputs (goal-host `index.ts:5666`, `completion_shapes` built from the target shapes; docs verified this at origin/dev). So each prose reach becomes a donor row for the next write goal, and N5 just made one.
        - **The full count over about 5 days of journal.** The floor's 36 `reached=true` runs have 0 produced shapes and 0 persisted writes or landed shas. All 36 are verdict-only: 22 were LLM prose and 14 were citation-check oracles. The floor's posterior is α 1,047.88, β 8,950.65.
        - **Reading.** This is the same false-positive class as N10's judge, now in selection, and plausibly the biggest reason the needs cannot land.
        - **Placement.** activity-api `goal-paths.ts` and goal-host `goal-intent.ts` are open (an N-need candidate for the borrow). The floor gate, `verifyGoalReached`, `completion_shapes` and `recordGoalPath` live in goal-host `index.ts`, which is closed: that is operator judge work, put to the user.
        - **The cleanest judge must-fail:** a verdict asserting a write with zero tool calls is hollow by construction.
        - **The re-grade is authorized.** The user (as reported by qa): "re-grade is authorized, proceed after N6".
          - The 36 verdict-only floor-reach rows are re-graded by evidence (no produced shape and no landed sha means not reached), through the existing verdict path, **after N6 is dispatched**.
          - It is a recorded operator intervention. Its result: **[TO FILL]**.
      - **N10 is confirmed not passed** by the coordinator: the posterior is unchanged (α 1, β 460.3), and no retirement call was made. One caveat: the row's flags were not read directly.
      - **The judge fix,** goal-host `d949f753`, is built, reviewed and dry-run, and is waiting on the user's approval to push. It is a partial fix: the floor's laundering closes, while the engine/mid-walk path and laundering on the judge's prompt side remain open.
      - **The user's ruling on four open items, as reported by qa:** "follow the recommendations. stick to this schedule." The docs session has not had it directly; it is recorded on qa's attribution.
        - **The judge fix:** yes. qa's session was blocked by its permission check when pushing `d949f753`, so **the user runs the push**.
        - **The learning values:** keep `TD_LAMBDA` 0.72 and `YIELD_FLOOR` 0.458.
        - **The hub's P5:** on the user's own schedule.
        - **The earn-in holds that expire at 2026-10-12T00:08Z:** they lift as scope earn-in intends. A recommendation to re-tighten one of them was **withdrawn by qa** as an error of record: it conflicted with a pinned pre-registration's window rule. No re-tighten is made. The user confirmed the withdrawal (as reported by qa: "follow the recommendations. stick to this schedule.").
        - **N7 keeps its latest-by of 2026-10-13T00:00Z.** If N6 has not produced N7's precondition by then, N7 is reported **MISSED**, with the reason. It is not moved later.
        - **The schedule is unchanged.**
        - **The judge fix is pushed by the user.** goal-host origin/dev moved from `c336a544` to `d949f753` (patch-id `a9bbcccc041b` verified). It went live on node 1 at 15:47:39Z, when goal-host restarted. **Correction:** N6 is gated by the window rule in its own pinned pre-registration, not by the fix going live. The 2026-10-12T06:00Z backstop still stands.
        - **Expected effect, pre-registered.** The floor's reported reach on write and change goals falls, because prose reaches stop counting. Real reaches with a produced shape or a landed sha are unaffected, and that is the negative control.
      - **N6's dispatch rule, pre-registered.**
        - **If the user approves the judge fix earlier,** N6 is dispatched as soon as `d949f753` is live on node 1, and after N6's own eligibility (2026-10-12T00:08Z).
        - **If there is no ruling by 2026-10-12T05:50Z,** N6 is dispatched **at 2026-10-12T06:00Z** under the unfixed judge, and scored only by its pre-registration's effect check.
        - **The confound, pre-registered:** "dispatched under the unfixed reach judge; reached=yes without the PREREG effect is an expected false positive, not evidence."
        - **The cost, pre-registered.** Under the unfixed judge, a prose reach also writes a new laundered `goal_execution_paths` donor row, with the requested targets as its endpoint. That row's id is recorded after dispatch, so that the later evidence re-grade covers it.
        - The record shows the outcome as bounded by a pending ruling, not by operators waiting.
      - **"One need in the lane at a time" is dropped** (the user, as reported by qa: "follow the recommendations. stick to this schedule.").
        - **Why.** The rule duplicated the lane's own lease. Pace comes from the system, not from an operator throttle (law 5).
        - **The reason that is set aside.** The rule had one recorded reason: to keep needs' stage evidence from being confounded. In its place, each landing and stage event is attributed to its need by dispatchId and goal hash.
        - **N11 and N14 were dispatched** at about 2026-10-11T18:58Z with their pinned text: N11 as `3827b1b0…`, N14 as `40bbc8e4…`. N6 still goes out after 2026-10-12T00:08Z.
        - **The other latest-bys are unchanged,** and a missed one is reported MISSED, not moved later. The seal holds for every sealed answer.
      - **A hold review: `SATISFIER_PROVEN_BAD_ARMED` is LIFTED** (the user, as reported by qa: "follow the recommendations. stick to this schedule.").
        - **What the hold was.** Suppression of proven-bad satisfiers had been held by an environment switch since 2026-08-19, with no lift condition and no review date. It broke law 1 and the user's no-indefinite-hold rule.
        - **The evidence.** Across the probe, N11 and N14, the walk logs show proven-bad satisfiers winning while suppression was held: `shellResult` at α 472, β 2,021, and `code_modification_proposal` at α 38, β 722.
        - **The change: lifted, arming pending (the user).** Delegating the environment change was blocked by a session permission check, so the user arms suppression themselves. Arming it is a deliberate intervention (law 12). If it is armed before N6's dispatch, N6 runs under it; otherwise N6's record says it ran without it. **Armed by the user** with qa's `arm-suppression.sh` (a drop-in, `50-satisfier-suppression.conf`).
          - Restarts: node 1 at 2026-10-11T19:44:07Z and compose2 at 19:44:12Z.
          - Effect observed on both from 19:51Z: the earned-producer probe fires, with 0 HELD lines.
          - The coordinator recorded it as a deliberate intervention, with an annex. N6 runs under it. Any re-run of N11 or N14 that straddles the change is reported with that boundary marked.
        - **The class** (behaviour gated by an environment switch) becomes sealed need **N15**, which the coordinator is writing.
      - **First runs of N11 and N14:** both dispatches are terminal and not reached, and both were judged honestly.
        - **N11** ran a concept-backfill HTTP template, which ended in `execution_error`.
        - **N14's** edit intent went to a wrong, closed site. A compose was drafted; the semantic gate found it does not address the need, with no falsifier, and it was refused at admission while unarmed. Nothing landed.
        - **The provisional reading for both:** REFUTED (wrong site, no landing). Neither need is closed until 72 hours pass or a refuting outcome arrives.
        - **The system-born gap from this round:** one, `route-edit-edc1edbb`, from N14's own run. It is at the wrong site and unarmed. There are 0 landings.
      - **A one-off operator re-pin, and N16** (the user, as reported by qa: "follow the recommendations. stick to this schedule.").
        - **The re-pin.** The act's scope pin is re-pinned to the live sets after the holds expired. This stops the lane re-picking a spurious drift gap whose stale `edit_site` invites a hollow compose. The drafter act updates the pin in the same act.
        - **Counted honestly.** It repeats an existing kind of act, not a new bootstrap, so the cap stays at ten. It is still an operator intervention, and recorded as one.
        - **Where the drift came from: corrected to operator-caused.** The ratchet's scope closes (at 21:28Z and 22:06Z on 2026-10-11) added 11 entries without updating the pin in the same act. That was an operator lapse, and the system flagged it correctly. The hold expiries removed only 3 more on each node. N16's class is unchanged; this instance was caused by operators.
        - **N16, sealed:** the pin follows the evaluator's own sanctioned scope changes, so that no operator re-pin is needed next time. Latest-by 2026-10-15T12:00Z.
        - **N16 is WITHDRAWN, not dispatched.** Existing code refutes its premise: the self-fact reconcile already accepts scope changes made by the accepted evaluator. compose2's pin row read "observed … 3 evaluator change(s) accepted" at 2026-10-12T05:07:24Z. The drift that prompted N16 was caused by operators (closes made without the pin), as already recorded. Both pins now read observed, and the need count is down by one.
      - **A rule for new needs (qa, 2026-10-12).** No new N-need without naming which existing need it supersedes, or why it cannot wait for one to resolve. Needs close on their evidence: N11 and N14 at 72 hours, and N7 is reported MISSED at 2026-10-13T00:00Z if its precondition is absent, not re-queued.
      - **N18, pinned** (it is dispatched once `9cd7532a` is live). Its class: "the lane's drafting attempts fail in ways its own records don't classify or explain, so the same failure repeats without a lesson; the system should detect and file these precisely for review." Its sites are closed, so PASS means precise, checkable gaps routed to operator review, not a landing.
        - **N18 supersedes N9,** which is the same class. N9 is recorded as **merged into N18**, not MISSED.
        - **Its date.** N18 inherits N9's earlier latest-by: it is dispatched by 2026-10-13T12:00Z, and as soon as `9cd7532a` is live on node 1.
        - **Its routed gaps** are counted in the operator-work ledger, because they are operator load by design.
        - **Outcome: REFUTED (wrong site).** Dispatched as `3fa348e8…`. N9 stays merged into it.
      - **N2-v2 dispatched:** `53882755…`.
      - **N2 is off hold** (the user's no-indefinite-hold review, as reported by qa). It is re-pre-registered, sealed, with a latest-by of 2026-10-14T12:00Z.
      - **N14 is added** (the user, as reported by qa: "follow the recommendations. stick to this schedule."). It is a class need: the floor's read tools are built from discovery, as its write tools already are.
        - **Schedule:** queued after N6, one need in the lane at a time, with a latest-by of 2026-10-12T18:00Z. It goes ahead of N7 and N9, whose dates are unchanged; if they are not met, they are reported MISSED, not moved later.
        - **Pre-registration: written and sealed** in the coordinator's job directory. The addendum is `3b281758…`, and an annex (`8b358f03…367d`) carries the feasibility branches and the security constraint. Nothing the walk can read names N14's site before it is scored; that makes four sealed answers.
          - **Feasibility:** a lane-only PASS is feasible without any closed-file edit. The branch that would need a closed edit scores Partial if the lane is blocked, and REFUTED if an operator makes the edit.
          - **Security:** the new read tools must be read-only shapes. No mutation, no forbidden floor tools, and no outbound-URL resolvers. A violation scores REFUTED, with a must-fail on the advertised tool list.
      - **N6 dispatched** at about 2026-10-12T00:10:05Z, dispatchId `ee63ab3a…`, with its pinned text verbatim.
        - **At-dispatch check:** qa read node 1 before dispatching. The scope record had 111 entries and no holds, and the lane's own read showed 111 at 00:09:58Z. N6's window rule was met.
        - **It runs under four changes recorded since the probe:** the judge fix, suppression armed, the earn-in holds lifted, and the ratchet.
        - **Scoring:** only by events carrying its own dispatch or goal hash, reported plainly, with no follow-up fix in the same window.
        - **Outcome of the dispatch:** terminal at about 00:22Z, **not reached.** N6's 72-hour gap-lineage window stays open, and it is scored by its own lineage. If an N6-lineage compose happens after the drafter split lands, the split is noted as a fifth change. **Why it was not reached: stage 0, under a reasoning-call timeout, so the result is CONFOUNDED.** No target was inferred, so there was no localization, no gap and no compose.
          - **Why no target.** The reasoning call behind target inference timed out (two producers, each after 60 s), and nothing retried it. Free-tier models were exhausted at 23:46Z and 00:16Z, while paid capacity existed.
          - **How the outage was recorded.** An unavailable reasoning service is recorded as "no target" (confidence 0), which looks downstream exactly like "nothing to do". The next inference, 3 minutes later, took 6 s.
          - **The user's ruling** (as reported by qa: "follow the recommendations. stick to this schedule.").
            - **(1) One pre-registered re-run of N6.** It is dispatched only when the LLM plane is healthy at dispatch, checked read-only. If that condition is never met within its window, N6 is recorded as **UNMEASURED**, not refuted.
              - **Dispatched** as re-run `4cf83389…` (pinned `3840753…`, with N6's text verbatim). The precondition was met at 2026-10-12T01:26:54Z: 1 non-empty inference and 0 nulls in the previous 15 minutes. The one budget refusal in that time belonged to another dispatch's own cap.
              - **Result: reached=yes, a FALSE POSITIVE. N6 is NOT PASS,** and its window stays open. The walk re-framed its change goal onto an alternative target (`memoryNote_write`) and wrote a note restating the need.
              - **The write audit from the pre-registration: done.**
                - The empty public `uiQuestion` panel was dismissed, with its record kept.
                - The re-framed `memoryNote` was retired in place: marked `[RETIRED]` with weight 0, not deleted.
                - **Two findings,** recorded as evidence for N1's class (an advertised capability that nothing serves), not as new needs: there is no non-deleting retire for `memoryNote`, and concept-db's retire/supersede is advertised but stubbed.
                - The L12 entries are in `L12-WRITE-AUDIT-2026-10-12.md`.
            - **(2) Sealed need N17:** an unavailable reasoning step is recorded as "nothing to do" instead of "couldn't decide", so it is neither retried nor learned from. Latest-by 2026-10-15T12:00Z. **Dispatched** as `41c1e245…` (pinned `41bef8b7…`), running alongside N6's re-run. Each is attributed by its own lineage.
          - **What remains of the prediction.** Stage 0 was the pre-registered prediction, but this run cannot test it.
          - **Across the needs, "stage 0" is two classes, not one** (journals 2026-10-09 to 10-12, read-only).
            - **(a) A confident WRONG target.** N1, N3, the probe and its re-run, N10, N5, N11 and N14 all got confident, non-empty targets (confidence 0.6–0.9). They then failed on a wrong target or site, a target no producer serves, a compose refusal, or a field error. This is the capability class.
            - **(b) An unavailable reasoning step recorded as "no target".** Only N6 is in this class. It is N17's class.
          - **The LLM plane is not degraded; the nulls come from routing, timeouts and budget.** This is the user's correction: "The plane is not truely degraded. There is an openrouter key with quota."
            - The model-exhausted, 402 and 429 counts in the journals come from free and TEE models, and paid capacity exists.
            - The nulls come from how calls are routed and bounded: two 60 s timeouts, no retry after 3 s, and the per-dispatch 400K-token cap. That is exactly N17's class.
            - Fleet-wide, 4 of 11 empty inferences were such nulls.
          - **The walk** picked unrelated, pre-existing gap-closing activities, and the judge rejected their only output.
          - **The floor fallback** ran 0 tools.
          - **Separately, not N6:** once the hold lifted, the lane composed on an unrelated armed gap. It is attributed to that gap's own lineage. Its own check came back red, and nothing landed.
        - **A duplicate request at 00:11:29Z: coalesced, no walk, source unattributed.** When an identical free-form goal is already running, `/run-goal` returns the existing dispatchId with `coalesced:true` before any walk starts. The only walk is `ee63ab3a`. The caller is not logged; "a client retry" is a hypothesis, not established.
        - **Next:** the authorized re-grade of the 36 rows is applied once N6's dispatch is terminal.
      - **N6 follows N5,** at its eligibility of 2026-10-12T00:15Z. If N5 is still running then, N6 waits for N5 to reach a terminal state, or until 2026-10-12T06:00Z, whichever comes first.
    - **Pinned for the schedule** (all read-only):
      - **N5:** `PREREG-NEEDS.md` §N5, sha256 `8ed46df7…9867`.
      - **N6 and N7:** `PREREG-NEEDS-ADDENDUM-N6.md`, sha256 `408922a7…f234`.
      - **N9 is not ready.** It is a candidate only: its earlier measure is invalid, because lessons and attempts have separate writers. Its full pre-registration is due before its dispatch date, 2026-10-13T12:00Z.
    - **N10 v1, superseded (kept for the record)** (coordinator `PREREG-NEEDS-ADDENDUM-N10.md`, sha256 `84d1122a600f122816173a93f56001f2b0b05e08ec82039a0b8402d5a94a530f`). The ground-truth diagnosis stays in that file until the need resolves.
      - **Need text:** "Some of the system's learned procedures always fail the same way: they call a write step without the data that step requires, and the system keeps choosing them anyway. Make the system notice a learned procedure that fails for the same missing-input reason every time, stop choosing it, and fall back to the way that works."
      - **Detector D3.** A learned template T calls a `*_write` S. Over its last 20 or more executions, at least 90% of failures share one identical missing-required reason, with 0 successes, while `satisfier:S` has at least 1 success. That files a gap.
        - Positive control: a live template at 481 runs and 0 successes.
        - Negative control: satisfiers with successes must not fire.
      - **Scoring.**
        - **PASS:** a system landing makes D3 fire on its live instance, the template stops being picked, and the working satisfier is reached on the next targeted walk. It is graded as an operator link, because it comes from an N-dispatch.
        - **Partial:** D3 fires, but the template is still picked.
        - **REFUTED:** hollow, the wrong site, global suppression, or an operator edit to a closed file.
    - **The need schedule** (qa, 2026-10-11). Each date is a latest-by date. A need goes **earlier** once the previous one reaches a terminal state: landed, refuted, or scored hollow. One need is in the lane at a time, so that each need's stage evidence is not confounded with another's.

      | Need | Dispatch by |
      |---|---|
      | **N10-v2**: make the existing retirement fire on the walk-grading path, with no new detector | 2026-10-11T11:00Z |
      | **N6**: diagnosis-first | 2026-10-12T00:10Z, when it becomes eligible |
      | **N5**: noticing a lane stall | 2026-10-12T12:00Z |
      | **N7**: the deploy scripts made visible | 2026-10-13T00:00Z |
      | **N9**: failures without lessons | 2026-10-13T12:00Z |

      From 2026-10-13 to 2026-10-18T07:12Z is left for landings and settlement. Build 7 stays clear: no earlier than 2026-10-12T07:25Z, and no later than 2026-10-17.
      - **For each dispatch:** the need text goes out verbatim and operator-tagged. The precondition and the need's pre-registered scoring are recorded outside the dispatch. qa dispatches and scores.
      - **N10-v2's checks.** Its effect check is the live template's activity row reading `retired=true` with `retired_reason=poor_performance`, not merely that a call happened. The retirement must use the reach verdict's own org and account identity. Editing the closed `variant-creator.ts`, or minting a parallel retirement mechanism, scores REFUTED.
    - **A positive signal.** In re-run 1, failure memory (recall of three prior hollow verdicts) changed target selection. This is the first observed instance of the behaviour RECONNECTION-2026-10-10 found had never worked.
  - **Later stage events:** **[TO FILL as they arrive]**.

**Precondition.** The lane-need goal below is dispatched only if the lane has had **no landing in the 24 h before dispatch**. If anything has landed, including a gap armed at birth and landed through the lane before the opening, the goal's premise is false. In that case the pre-written alternative is dispatched instead:

> "Your gaps are filed far faster than they are armed: about **[N filed per day]** gaps a day against **[M system-armed per day]** armed by the system itself. Find out why, and repair it."

Its rates are re-measured from system rows at dispatch. For reference, the 10-10 figures were about 75–110 filed per day, 0 system-armed in 5 test-writing dispatches, and 5.5% of open gaps armed overall.

- **Goal text:** "Your improvement lane hasn't landed anything in 24 hours; find out why and repair it."
- **Expected outcome: low.** The 09-29 analogue, also with no component name, got target-inference confidence 0 and ended HOLLOW. Autonomous specs reached about 2.5% (09-13).
- **Success:** the walk localizes the stuck stage, naming the file, **and** a system-authored landing in an OPEN file is verified at the consumer within the opening's window. Both are measured by the §14 rule, system rows only.
- **Otherwise:** the window expires and 15.5 closes the opening.
- **Expected-failure branches, pre-registered.** The walk may localize correctly to a file that stays CLOSED. If so, it cannot land the fix inside the window, by construction. Two kinds of closed file are recorded separately, because they are evidence for different things:
  - **"Correct diagnosis, blocked by a closed JUDGE file"** (goal-host `index.ts`, activity-api `posterior-update.ts`, any judge or trust file). This is evidence for the judge split.
  - **"Correct diagnosis, blocked by a closed LIMIT file"** (for example `rhythm-conductor-tick.ts`, where supply cadence lives). This is evidence for earn-in on that limit. The judge split does nothing for it.

  Neither is a capability failure.
  - **A third branch, distinct from supply and from closed judges: the lane fails on an open, armed gap.** This measures repair capability. The evidence already exists: the two filed `gap-drain-redispatches` gaps are sited at an open file (`gap-drain-observer.ts`), and between them they have 34 failed attempts and no landing. If the probe localizes to an open file and the lane still does not land, that is recorded under this branch: a shortfall in the lane's repair capability, not in supply and not in scope. The failure reasons recorded for those 34 attempts:
- **Draft quality, 14 of 34:** `verify_failed` 5, `no_effect_region` 4, anchor 3, overwrite refused 1, dangling reference 1.
- **No recorded reason, 20 of 34 (59%).** The system cannot learn from failures it does not record, which makes this an N-series candidate (N9).
- **N9's measure, restated.** Failure lessons and attempt counts are written by separate writers, so lessons divided by attempts cannot be read as the fraction left unrecorded. N9 measures **failed composes, counted from the `verify_failed` verdict lines, that have no lesson**.

**A sealed answer key for this branch.** An expected diagnosis was written and verified before the probe:
- **Where it is.** It is kept **out of the tree** until the probe concludes, so that the walk cannot read it. Its sha256 is `72875824c6d18ca2cd5f36966cd0d4ea9878614e1e8233c17f0882ede3025ba3`.
- **Copies.** docs, qa and the coordinator each hold one.
- **Scoring rule.** This branch PASSES if the system localizes the cause whose sealed description matches the key, **and** lands a fix whose stated effect is verified by the key's positive control. The positive control is run on a fresh store dump after the landing, and its baseline is sealed with the key.
- **Unsealing.** The key is published here when the probe concludes, and its hash is checked against the value above.
- **No help.** It is neither hand-filed nor hand-fixed (law 13).
- **The prediction is confirmed on a live, unseeded instance.** qa pre-registered three counts from the key (39, 18 and 15) before the coordinator's fresh store dump at 2026-10-11T05:46Z, and the dump read exactly 39, 18 and 15. What the counts measure stays under the seal.
- **A further pre-registered closed-judge observation, also sealed.** It comes from a live compose at 05:28:38Z. Its sited file is held with the coordinator, with sha256 `9c7a560bbcb66be3e654990a8b1e11a516c28f7e1cd4a2e4b9bd79d5cb748482`. Like the key, it is published and hash-checked when the probe concludes. Its remedy is a user ruling if the probe's branch fires, and it is not hand-filed.
  - **A pre-registered instance of the closed-JUDGE branch: the landability floor.** Today's funnel ends at the floor. It is `const LANDABILITY_FLOOR = 0.15` (development-vessel `src/judge/gap-admission.ts:1015`), an in-code constant that build 8 moved into the closed judge core. A correct diagnosis that names it can therefore not land inside the window. The constant is:
    - invisible to the system as a shape (law 1);
    - not changeable through the lane, because the core is closed;
    - not a tuning row, so not changeable through `policy:write` either.
  - **Its remedy, pre-registered so that it is not improvised if this branch fires.** Make `LANDABILITY_FLOOR` a gate-input tuning row: read at use time from `substrate_tuning_param`, failing closed to 0.15. The system can then see the floor and propose a change to it, while writing the change still needs `policy:write`. This is the same pattern as the `AUTO_REVERT_*` rows. It is an operator build on a closed file, so it is a **user ruling if and when this branch fires**, not before.
  - **A second pre-registered instance: the floor is a fixed point.** The admitted gap `performance-inefficiency-execution_traces_list` computes a landability score of 0.10. The floor drops it without recording an attempt, so it is re-admitted on every tick, across restarts, and admits nothing else.
    - **Remedy family:** the gate-input row above, plus having the floor record a non-attempt, so the gap leaves the admitted set.
    - **Status:** a user ruling if the branch fires.
    - **It is not hand-filed.** The file is closed, so a filed gap would be hollow. The detector for this class (a candidate re-admitted without an attempt) belongs in the N-series of needs instead.
  - The basis is read-only evidence: publish/offer and verdict retraction are only half lane-reachable.
  - Their pure halves sit in lane files: activity-api `impulses.ts` (the GET filter), goal-host `walk-pool.ts`, `reached-command-store.ts`.
  - Their wiring is in goal-host `index.ts`, and producer credit goes through `posterior-update.ts`, both closed.

A low prior is recorded so that a reach is evidence and a miss is information, not a surprise (law 12; §11.5 "pre-register the falsifier").

**Cadence: stage by stage, not by calendar.** The window has no fixed checkpoints. Each lane stage has an expected latency:
- admission: ~40 min;
- compose → own-check: ~15 min;
- own-check → cutover verdict: minutes;
- cutover → mirrored and restarted: ~1 h;
- settlement at the next consuming run: ~1–2 h.

**When the next stage event is overdue, the evaluation pauses.** That stage is diagnosed, one fix is made at that stage, and the evaluation resumes. A stall is never waited out; the opening's own close is 15.5's rule.

During the window this is watched by an **operator-side overdue watcher** over the existing journal lines, keyed by gap id, alerting on the first overdue stage. It is an **operator instrument**, so it does not count for §14. Its positive control is real stage events: the bootstrap's own deploys, observed going admission → mirror → effect. It is not a synthetic cycle, which would itself be an operator-authored landing. Shaped stage events with one cycle id, measured by the system, are not built now as a seventh bootstrap item; they are a candidate for the system's own first need after the opening *(user, 10-10)*.

**Supply at T0.** Supply may still be the binding stage, so **"no armed gap in the opened files at T0"** is pre-registered as an outcome of its own. Raising the supply rhythm's budget is decided on 2c's effect evidence, not before: only if conversion is above 0 and cadence is then the binding stage, as an L12 intervention with a time limit *(user, 10-10)*.
- **Decided 2026-10-12 (the user, as reported by qa):** "We should stick to the schedule. We can make adjustments iff required for autonomy."
  - **The evidence.** By then, build 2c had produced one system-armed gap in about two days, and with operator dispatch paused the system idles: about one rhythm goal an hour, and auto-pick admitting 1 of about 2,900 candidates.
  - **No change to the check-supply cadence unless it is required for autonomy.** It becomes eligible only if a stage on the priority path stalls because of cadence. That would be a fresh decision, with evidence.
  - **"Boredom doesn't fill idle capacity"** is queued as the next class need, after build 7's routing opening. CLAUDE.md law 5 describes it, and production does not show it.

**What each outcome triggers, decided now:**
- **Success** (a system-authored, consumer-verified landing that originates from the probe): extend, then widen only through earn-in.
- **Blocked by a closed JUDGE file:** schedule the judge split, with a date and a bounded scope.
- **Blocked by a closed LIMIT file:** earn-in on that limit.
- **A stage overdue in an open file:** one fix at that stage, then resume.
- **No armed gap at T0:** supply is the work. Decide the cadence on 2c's evidence *(user, 10-10)*.
- **The result cannot be determined:** the instruments are fixed first. No other change.

### 15.7 What this does not change

- **Judges and trust stay operator-held, with one recorded change (user ruling, 10-12).** Once build 7 lands, the reach judge's CODE opens to the lane behind a closed, append-only verdict corpus. What stays operator-held is the corpus. "No change judges itself" (§10 item 1) still applies: the corpus, which the lane cannot edit, judges every change to the judge.
  **Required conditions** (a build-7 design without all of them is not approved):
  1. **Admission is hermetic and in the gate.** The pull-sync gate itself runs the corpus deterministically, not an operator's machine.
  2. **The known false-positive classes are seeded as must-fail cases before the opening:** prose plus writeback (N10), plan text (N5), a write claim with zero tool calls, and re-framing a change goal onto a note (N6).
  3. **The corpus is append-only by code:** a pinned hash chain or a monotonic count, enforced by the ratchet pattern. A change that deletes or edits a case refuses itself.
  4. **A loosening guard on held-out data.** Recent live verdicts are re-scored by the old judge and the new. Any reached:false→true flip that no new produced artifact justifies blocks admission.

  **The twin rules also apply:** new files land with their scope entry, and scope changes with its pin, both in the same act.
- **Security, locality and auth requirements stay** (§9.0).
- **"Stop doing" applies outside the ten bootstrap builds.**
- **An overdue stage pauses the evaluation, it does not close the opening** (15.6). The evaluation stops for one diagnosed fix at that stage, then resumes. The opening itself closes only by 15.5's rule, and the 7-day limit is its outer bound.

## 16. Amendment (2026-10-13): operable by humans, decentralised in any constellation

**Basis.** On 2026-10-13 the user stated the primary objectives in these words: "the container, container vessel management, self-updating, configuration, secret distribution and the like are simple for humans to manage. Easy to maintain, and straightforward to set up … We should establish that the system is distributed and decentralized. It should be able to operate in any constellation of vessels."

§1 already names a "decentralised fleet" and says "every shape is reachable from every node over p2p". Neither has a measurable form, and neither says what operating the system costs a human. This amendment supplies both. It gathers rulings already made into one expectation:
- **10-10:** one secure peer channel inside and between trust groups.
- **10-12, the hybrid:** operators land only overlay inbound auth; the system earns the rest.
- **10-12:** the hub is not over-protected, and protection lives in authentication.
- **10-13:** plug-and-play through the identity-discovery namespaces, with no hardcoded peering.
- **10-13:** the surface can show anything that becomes important.

**This is a target, not a status. Most criteria below fail today.** The baselines are the network fork's read-only measurements of 10-12 and 10-13. They come from operator instruments, so under §14's rule of measurement they are context, not acceptance. Acceptance is measured by the system's own evaluator rows and by `federation-probe-tick` once its amendments (A1–A4, below) exist.

### 16.1 The two objectives, and how they relate

1. **Operable by humans.** Setting up, maintaining, updating, configuring and distributing secrets to a container or vessel is simple for a person to do and to understand.
2. **Decentralised in any constellation.** Any set of vessels runs the whole loop with whatever peers it can reach. That covers one container, a hub with spokes, peers without a hub, a host-run vessel, and a node behind NAT or a corporate proxy.

These are one objective seen from two sides. Hardcoded peering is both a decentralisation defect and an operability defect: every pinned address is something a human must know, set, keep current and debug. The measure for both is the same. Count the inputs a human must supply or maintain, and the network facts that live outside discovery and identity. Both should trend to the join anchor alone.

### 16.2 What "simple for humans" means, measurably

| # | Criterion | Exit | Baseline (10-12/13, operator-measured) |
|---|---|---|---|
| O1 | **Setup is one input** | Any profile joins with a single join token (discovery + key), and on a fresh volume reaches a held reservation and a reached goal with no further input. J1, the join time from install to the first held reservation, is reported. | J1 not measured. The README states 2 inputs for spoke, surface and compute, and 3 for hub. Joins are proven only in CI acceptance (§7). |
| O2 | **No hand-maintained network facts** | H1 = 0 beyond the join anchor. H1 counts pinned peer addresses read at runtime, per node: hub URLs, peer endpoints, relay addresses, derived public ports and IP allowlists. | Per node: A 2, B 5, C 4, hub 2. Source: the network fork's census, 2026-10-12 ~18Z and 10-13. It read only the named non-secret peering keys in each node's runtime env file and compose files, read-only. Code defaults that would re-pin an address are also counted. |
| O3 | **Self-updating needs no human step** | A new accepted image or commit reaches every node by itself, including the components baked into the image (the federation transport and relay), and is verified at the consumer. | Pull-sync converges `/workspace` and `/vessels`, but image-baked units need a recreate or a hand install (route C, 10-13). |
| O4 | **Configuration is shaped and observable** | Behavioural configuration is a shaped record read at use time (law 1). The few bootstrap inputs are listed in one place, and the system reports their effective values (names only for secrets). | Hub endpoints are derived from install inputs by port arithmetic, not discovered. One behavioural policy record lacked trust-root protection until it was fixed before first use. |
| O5 | **Secrets reach where they are needed without a human copying them** | A key is issued once by the namespace's identity and travels only on authenticated channels. No secret is read by an agent, printed, or forwarded to a node that cannot validate it. | Keys are copied by hand into env files. Secret distribution has known open defects, tracked as gaps. |
| O6 | **Failures say what is wrong** | "Looks healthy, federates nothing" cannot happen silently. An unreachable anchor, route or reservation is a reported state with a cause, on the node and on the surface. | The transport can report a reservation its callers cannot use (gap filed 10-12). Nodes advertise anchors and routes nobody can dial (A4). A node with no overlay membership reports nothing about it. |

### 16.3 What "decentralised in any constellation" means, measurably

Each criterion is falsified by taking something away. These are FEDERATION.md's *Design intent* falsifiers, made acceptance criteria here. They are labelled N1–N7, because §15 already uses D1–D10 for the loop's dated links.

| # | Take away | The expectation holds when | Baseline |
|---|---|---|---|
| N1 | any one member | every other member keeps reaching goals, and work the lost member held is not silently dropped | Goals on a lost node are lost. A synchronous remote `goal_execution` is lost outright. |
| N2 | the hub, or the link to it | members keep reaching goals with what they hold locally, and reconcile on reconnect | Spokes resolve identity, traces and model arms on the hub, and freeze without it. |
| N3 | a relay | members with a direct path keep it; relayed members move to another relay | One relay. No direct path has ever formed (hole-punch successes 0). Two reservation lapses of about 50 minutes each were observed on 10-12. |
| N4 | a route to an unreachable producer | callers learn it is unreachable promptly and pick another producer, rather than waiting out a timeout | On one node, 3 of 4 advertised producers of one shape were undialable, one of them a 25 s silent drop (10-12). The surface probes dead goal-execution rows every 30 s (10-13). |
| N5 | the public network between members | nothing that crossed it was readable or usable in transit | Transport hardening is incomplete, tracked under the overlay inbound-auth exception and filed gaps. |
| N6 | the operator's own network shape | the same image joins from behind NAT, a corporate proxy that allows only 443, or a TLS-inspecting proxy | Untested. A read of the code (10-13) predicts that a proxy-only network cannot join the overlay today; tracked as a later decision. |
| N7 | membership | every running node's vessels are reachable over the overlay | One of three local nodes, plus the hub. Observed 10-09 and 10-12 by reading each node's transport unit state and transport health; on two nodes the transport unit was not running. |

**A reading after integration (2026-10-13, about 19:40Z), for N2 and N7:** the hub's development-vessel has been held by the test-gate budget since about 13:00Z, so the hub runs older code than its peers. The system detected this itself, but the repair is out of its scope.

### 16.4 How this is reached: existing plan items, and what is not yet planned

Items 1, 2, 4 and 5 continue earlier attempts or filed gaps. Items 3 and 6 are partly unplanned, and say so:
1. **One authenticated overlay** for all cross-node traffic: the overlay inbound-auth exception (the hybrid ruling), exit E1–E5. This is the only item already cleared for operator hands.
2. **Honest routes and anchors:** no derived public endpoints, rows and `/bootstrap` anchors advertised only after reachability is observed, and route choice and outcome recorded. These are the two gaps filed 10-12, plus the four `federation-probe-tick` amendments (A1 ingress coverage, A2 runtime endpoints, A3 phantom reservation, A4 undialable routes and anchors).
3. **Plug-and-play anchors** learned from peers over the overlay, in place of pinned hub and peer discovery endpoints. Discovery's no-local-producer path uses the local transport, not HTTP to pinned peers. This continues `openspec/changes/2026-07-19-relay-findability-replication` (its item 3, "honest `/bootstrap`": refuse loopback anchors) and the multiaddr join, which already learns anchors through a peer (FEDERATION.md, *Joining by multiaddr*). **Replacing the pinned peer endpoints is not yet planned; it is a candidate for a system gap.**
4. **Cross-namespace admission,** so separate trust groups are peers on one channel (10-10 ruling), not separate networks.
5. **Constellation coverage:** overlay membership for the two local nodes without it, after the auth exit; an overlay and anchor reachable through a 443-only proxy (N6, a later decision); and the host-run vessel sidecar with a local egress (the metabob-mcp conformance requirements C1–C9).
6. **Removal of single points:** work that survives its node (N1), spokes that work without the hub (N2), and a second relay (N3). The design exists (SUBSTRATE_AS_NETWORK §3, §5, §6). **None of this is yet planned as a plan item or a filed gap; these are candidates for system gaps,** not continuations of an earlier attempt.

**Who builds it.** Under §15's freeze (from 18:00Z on 10-13), items 2–6 are **system work**, not an operator build list. Item 1 is the user-approved operator exception, already cleared. Everything after it lives in autonomy-excluded paths (`scripts/substrate/`, `repos/discovery-vessel/`, `repos/identity-vessel/`, goal-host routing), so it becomes the system's work only when §7 step 9's scope earn-in names those paths as eligible. Until then, the system detects these classes (`federation-probe-tick`) and cannot repair them. That is the year-long recurrence this amendment exists to end.

### 16.5 What it does not change

It grants no authority and does not reorder §7. It does not reopen the 10-05 ruling: operators still stop, except for harm, security exceptions and intractable blockers. It states the end condition that the network and operations work leads to, so that "decentralised" and "easy to run" are never again declared from a diagram, a single join, or an operator's measurement.
