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
        - **The verdict on the system's landing** (development-vessel `f20e116e`, 2026-10-15T03:24Z; recorded 2026-10-15T03:39:07Z):
          - **Valid by the pre-registration:** the fallback to the retired surface is dropped whenever another target exists. With the human surface down, delivery now **fails visibly with a reason, and is not queued.** None of the disqualifiers apply.
          - **Its own check went from red to green, and its own-check ran.** The system's gate reports 0 new failures; qa did not re-run the suite.
          - **Live on one node; pending on the other,** where the restart is deferred.
          - **Settlement is not yet in.** It landed **partial:** the system's own semantic gate dissented on **location,** preferring the same fix one function upstream, and minted a follow-up gap from that dissent. The behaviour is the same either way.
          - **Small residuals:** the tried list still names the pinned target, which was not attempted. An error label names the wrong vessel, which was pre-existing. When the pinned target is the only one, it is still used.
          - **It is a landing with no hands on it, but the gap was human-filed, so it is hand-fed and not a headline landing.**
          - **Settled:** both nodes serve it. The sweep closed its gap as **landed partial,** with the semantic dissent left unsettled ("the check that passed is the one the gate doubted"). **So it is graded valid but partial, and not counted as verified,** consistent with the earlier partial landings.
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
      - **CHANGE-03, under the process: deterministic verdicts charge failure, as the credit rule already says (recorded 2026-10-15T03:35:13Z).**
        - **Authority:** a user ruling in qa's session, "yes, take it through the process now", at **2026-10-15T03:25:07Z** (taken from the transcript's message timestamp). The push followed it at 03:33:59Z, so **there is no authority deviation.** An earlier estimate of about 03:45Z was wrong. Ruling times are taken from transcripts, never estimated.
        - **The law-12 effect size, with a review date of 2026-10-16T04:00Z.** Over 24 hours on both nodes:
          - failure charged against withheld, on deterministic hollow verdicts;
          - the posterior of the producers that fail most;
          - the share of picks for the goals they served that moved to another producer, against the same window before.

          Nothing else changes in that window.
        - **THE EFFECT-SIZE REVIEW SLIPPED.** It was due 2026-10-16T04:00Z and was read late, at about 05:40Z (recorded at 2026-10-16T05:43:18Z). The windows were the 24 hours after against the 24 hours before.
          - **Failure is now charged on deterministic hollow verdicts:**

            | Node | Charged after | Charged before |
            |---|---|---|
            | First | 118 of 134 lines | 38 of 295 |
            | Second | 59 of 75 lines | 3 of 75 |

            The "success structurally unreachable" withhold fell to 0 on both nodes. Some culpability withholds remain.
          - **The posterior of the most-failing producer did not fall:** its mean went from about 0.211 to 0.215. Its failure charge matches its logged charges, so it is outweighed, not missed.
          - **Some picks moved, on the failure side only.** On one node, one cohort's share fell from 62% to 49%, but part of that move went to a near-duplicate of the same satisfier, an (a) variant pair under the 10-16 ruling. On the other node, another cohort's share fell from 55% to 14%.
          - **Attribution is confounded:** six walk-service restarts in the window carried other changes.
          - **Verdict:** the change does what it was built to do. **Learning is partial and confounded.**
      - **The lane, 2026-10-15T21:27Z to 2026-10-16T05:40Z: drafting and failing, not idle.** There were 62 compose starts over 37 gaps, and **0 landings.**
        - **The dominant failure is verification:** typecheck on one node; on the other, the own-check never ran, or the target had no test file. Repair "wrote nothing" 33 times.
        - **One draft passed the gate,** but its cutover was refused because a node's read of the hub gap store failed. It was never retried. Those failed gap-store reads are **the next demonstrated break on the headline path.**
        - **Field 0, the demanding reading:** BATCH-01's learning reading (b) failed, because recall did not steer selection.
        - **Field 1, the history; nothing is new:** the symmetric-abstention rule of 08-17 says a deterministic verdict still penalises normally. But its caller read only a flag, and about a dozen verdict builders mark themselves deterministic only in their reason prefix, which the label reader has honoured since 07-30. In the probe window, **112 of 143 withheld updates were deterministic misses,** so the posterior never moved for the producers that fail most. **That is why recall did not change the choice.**
        - **Field 2, the expression:** one shared definition of a deterministic verdict, used by the label reader, the failure-charge decision and its capture. The rule itself is unchanged. A protected guard test's pinned string was updated under operator bootstrap, with a must-fail test added.
        - **Field 3, the validation so far:**
          - the replay harness: 81 of 83 scenarios identical, and the 2 that differ are both deterministic misses, now charged;
          - the gate: 0 new failures, with identical failure lists and a clean typecheck;
          - a mutant fails exactly the expected tests;
          - **deviations recorded:** one changed scenario was predicted and two of the same class occurred; a lesson write on the charged branch was not predicted; the committed golden file was already stale, and was not regenerated.
        - **The live validation:** rounds 5 and 6 on the same goals, after convergence. **The learning reading:** a goal not reached in round 5 differs in approach in round 6 **and reaches.** Round 6 is skipped if it cannot start by 06:40Z.
      - **THE SLICE REACHED (2026-10-15; dispatched 08:58Z; recorded 2026-10-15T09:03:16Z). The first trusted slice reach since 10-04, ASSISTED. §7 step 1 is met, with operator help.**
        - The rhythm conductor's affordability gate held the run until host pressure fell. The walk then **reused its learned template,** and the judge found that the report carried the required counts. The floor ran afterwards, judged not reached, and correctly did not override.
        - **The trust check:**
          - real counts: **pass;**
          - the top rows within 0.12% of an independent read taken 90 seconds later: **pass** (5% was pre-registered);
          - the orphan section: **indicated, not read,** because the previews are truncated.
        - **Attribution:** the combined served state, which is the read deadline plus B1–B8; B9–B13 were not live. It is labelled **assisted,** so **the autonomy count stays 0.**
        - **What changed since the 00:21Z run:** the LLM account was funded, so the judge answered; the count reads bound within the deadline; and the proxy substituted real counts.
        - **D8 is MET, assisted.**
        - **The learning gap it exposes:** success credit was **withheld** for the template ("no in-chain producer-to-consumer edge"), so **the reach did not move its posterior.** This is the success-side gap for single-step reaches graded by the judge, and it is a candidate for the next break.
        - **Corrected:** the withholding is **deliberate.** Success credit goes only to a deterministic verdict or a genuine in-chain edge, so that the posterior records correctness and not activity, and tonight's false reaches are exactly what it guards against. **The break is that this goal class has no deterministic verifier.**
      - **USER RULING, 2026-10-15T13:42:16Z (relayed by qa; time from the transcript): "yes, do the substrateNodes write after R8; go with (a)". Recorded at 2026-10-15T13:43:11Z.**
        1. **After round 8 is terminal,** one write to one node's own-substrate trust record adds the current address of the other node, keeping the existing entries. It is a recorded intervention, with a before and after reading of that node's lesson lines. The cause: the record was hand-written on 10-01 and went stale with the 10-03 topology change, so lessons were set aside as foreign.
        2. **The next break is (a): a deterministic verifier for the slice's goal class.** **The condition:** it reads the **authoritative** source for the goal's noun (the trace store for executions, the gap store for gaps), and checks the report against it for **faithfulness** (the same values, with no placeholders or transcription errors) and **completeness** (every requested section present and untruncated). **It never reads a proxy:** proxies are how the false reaches happened. It goes through the process of record, with its history check first.
      - **USER RULING, 2026-10-15T17:17:00Z (relayed by qa; time from the transcript): "yes, take these through the process".** It follows qa's finding from history that every "owed" item already exists and is stalled. **Recorded at 2026-10-15T17:26:02Z.**
        1. **Check supply:** a check that is **green at HEAD** means a wrong site or a wrong assertion. It triggers re-localisation of the edit site, and the prior verdict feeds the next attempt. Today a green check leaves the gap unarmed, and the retry repeats the same goal text. **This is the common root of "the drafter retries unchanged".**
        2. **Revive the dormant stratified goal generator** as a rhythm family in observe mode, so that **reach is measured by the system itself,** not by operator probe rounds. It was built in May for reach on arbitrary goals. Its weekly run has failed since 05-18 on a missing key, and no gap was ever filed.
        3. **The trace-store reconcile is not dispatched on a node with no trace-store producer of its own.** Today it fails every run on spokes.
      - **Round 8 and the satisfier-suppression switch:** honest reach was 2 of 20 against 3 of 20 before. One goal class gained and one was lost, which is within round noise.
        - **USER RULING, the conflict resolved, 2026-10-15T17:30:15Z (relayed by qa, from a direct question that named both of the user's earlier answers): "Keep disarmed".** The switch stays disarmed, and it was never touched during the conflict. This supersedes the later "re-arm" answer in the docs session. Recorded at 2026-10-15T17:30:47Z.
        - **The lasting fix is owed either way:** the switch as a shaped row at context grain.
      - **USER RULING, 2026-10-15T18:09:45Z (relayed by qa; time from the transcript): "Let's do both". Recorded at 2026-10-15T18:10:37Z.**
        1. **The trace-store reconcile placement fix is left to the system, not built by an operator.** Its existing gaps, one human-filed with a complete falsifier and one detected by the system, go to check supply and to the lane on the node running the sanctioned scope experiment, once the control-arm lift is live. **An operator builds it only if the lane fails,** with a review 48 hours after the lift converges.
        2. **A predicate hold that removed about 1,700 gaps before admission,** during the capacity after-window, is investigated read-only, history first, to decide whether it is sanctioned or a defect.
      - **USER RULING, 2026-10-15T22:10:52Z (relayed by qa; time from the transcript): "Lane-ready child for the drift-observer leak". Recorded at 2026-10-15T22:13:04Z.**
        - **What it resolves:** a repeated request to "file the isolation gap". The live-tree isolation it first named has existed since 10-08, so a gap for it would be born green.
        - **The defect chosen instead:** the one isolation defect still open. A test leaves a temporary directory behind on every run: hundreds per node, and still growing.
        - **How it was filed:** as a narrowed child of the existing human-filed gap, with a single edit site the lane may edit and a quoted, falsifiable specification, stamped as filed by the operator session.
        - **It is hand-fed by design,** so it is never a headline candidate.
      - **USER RULING, 2026-10-15T23:03:56Z (relayed by qa; verbatim): "We should make the necessary interventions. until we are confident that there are no identifiable rasons why it might not work, we should test each component of the goal reaching process, ensure that we are not duplicating functionality across the execution flow and that we are following the architecture. Nothing in this system should be 'new' at this point, everything has been built before before decaying". Recorded at 2026-10-15T23:08:33Z.**
        - **A component audit follows.** It ends only when every component of the self-repair pipeline and the goal walk has either a live positive control, or a named reason with an intervention record. It restores decayed parts, never mints new ones, and resolves duplicates.
        - **The 48-hour supply reading's single verdict is withdrawn;** the reading stays per stage.
      - **USER RULINGS (2026-10-16T05:32:17Z, in the docs session, verbatim):**
        1. "We shouldn't have duplicates, but we shouldn't rebuild. The system should have variants of things available in case it needs to try alternative paths to reach. Having a lactic acid cycle as a backup for respiration is as essential as respiration being efficient."
        2. "All hard-wired callers are antipatterns. everything must be a selection of the next resolver (usually packed into a walk or an activity) with the relevant shaped impulses piped into it to cause the necessary state transition required for the next step."
        - **How the audit applies it:** each duplicate is classified as one of three things:
          - **(a) Alternative ways to produce the same shape:** registered as selectable, graded **variants**, with any fallback condition stated as shaped data.
          - **(b) Rules that disagree:** unified into **one definition,** which several producers may use.
          - **(c) A hard-wired caller:** replaced by a **selection** of the next resolver, inside a walk or an activity, with shaped impulses piped in.
        - Nothing is deleted or rebuilt for its own sake.
      - **USER DIRECTIVE, 2026-10-16T05:49Z (in the docs session, a standing goal, verbatim):** "check against realignment.md, ensure that qa reviews and works with the coordinator to implement every missing step. demonstrate arbitrary reach on randomly obtained goals. goals should always succeed within one or two attempts."
        - **It is the go for every missing step the audit names, through the process.** That includes building the floor's read tools from discovery. A security or containment change still goes to the user.
        - **The acceptance measure:**
          - goals are obtained **at random,** never chosen;
          - an attempt is one dispatch;
          - success is graded reached **and** passes the trust check;
          - the window has learning on, no operator commits inside it, and is pre-registered before reading.
        - **The target: every goal reaches by its second attempt.**
        - **PRE-REGISTERED by qa at 2026-10-16T05:50:43Z, before any draw (recorded here at 2026-10-16T05:51:32Z):**
          - **The random source:** the sampling frame is enumerated and frozen, with a hash, before the draw. The seed comes from the OS random source at draw time, and is recorded with the drawn indices before the first dispatch. There are 20 goals per run, drawn without replacement:
            - **14 from real traffic:** distinct goal texts sent to the walk service in the 7 days before the freeze, from external sources. Excluded by rule: internal maintenance ticks, earlier probe texts, and duplicates.
            - **6 from the system's own open gaps,** each posed as the walk's own "investigate and decompose gap" ask.
          - **Replacement** is only for goals that would move secrets or destroy something, and the reason is listed. Hard goals are never replaced. Hand-picked sets are excluded.
          - **An attempt is one dispatch,** with in-run retries counted inside it. A second attempt uses the same text, at least 20 minutes later, and only for goals that did not succeed. There is no third attempt.
          - **Success** is reached **and** the trust check, which judges the content against the goal text's own criterion. False and hollow reaches count as failures.
          - **Learning is on** (a declared deviation from the observe-mode rule for probes).
          - **The window:** no operator push inside it, and pushes by anyone else are logged as confounds. Landings by the lane are allowed and logged.
          - **The readings:** for each goal, its stratum, draw index, attempts, the gate verdict, the trust verdict, and its failure class. Also the fraction that succeeds at attempt 1 and by attempt 2, with denominators and 95% Wilson intervals, per stratum.
          - **The target is 20 of 20 by attempt 2.** The contract floor of about 90% is reported alongside, and every goal that fails is named as a next break.
          - **The schedule:** run 0 after the current pushes converge, then a new run with a fresh frame and seed after each landing.
        - **The AGREED ORDER (qa, the coordinator and docs):**
          0. **RUN 0, the random-goal baseline, first:** once the pending retirement and the closure-credit changes converge, before any further build. Without a baseline, nothing after it can show movement.
          1. the gap-store read;
          2. the localization contract, as one definition (this also feeds step 3, because a mis-sited compose fails verification);
          3. the root of the lane's verification failures;
          4. the floor's read tools from discovery;
          5. target inference and satisfier choice as selections over the posterior;
          6. the remainder of honest closure counting;
          7. compose through the walk;
          8. the decay detector.

          A fresh-draw run follows each landing.
        - **Order change (qa and the coordinator, about 06:00Z): localization moves behind the verification-failure root and the floor's read tools.** Siting already reaches compose through the edit site. Nothing produces a localization record or acts on one, so a producer alone would be a hollow write. It becomes one producer-and-consumer change later.
          - **The new order:** run 0, the gap-store read, the verification-failure root, the floor's read tools, localization (producer and consumer), target inference and satisfier choice, the closure-counting remainder, compose through the walk, then the decay detector.
        - **The gap-store read, decided:**
          - **No code decay.** The gap-store holder's event-loop stalls grew from 4 to about 300 a day over three days, and every read re-parses the whole gap file, uncached. The night's only gate-passing draft died on that read's timeout.
          - **It was never retried, because two definitions of "deferred" contradict each other:** the cutover keeps the staged tree for a retry, while compose deletes it and charges a failed attempt.
          - **The change:** one definition of deferred, with the error detail logged. The holder stall is **measured before anything is built.**
        - **A recurrence (law 7, durability):** a pinned dispatch, sent by a hardcoded template id about every 3 minutes, was refused 92 times in 6 hours. The gap that named it was closed on 09-26 with no reason and no landing. It is reopened with the evidence, as a (c) item under the 10-16 ruling.
        - **USER RULINGS on the scope-floor read** (it is containment-adjacent):
          - in qa's session at 2026-10-16T05:56:53Z: **"Yes"** (the lane may fall back to its last good scope for a bounded time);
          - in the docs session at about 05:57Z, choosing from three options: **"Full bounded reuse"**, meaning a stale scope may admit and refuse for a bounded time. The user chose this over refuse-only and over failing closed.
          - qa's "Yes" accepted the bounded fallback in principle; the docs-session answer chose the variant. **CHANGE-31 implements the docs-session answer, after CHANGE-30.** qa withdrew its stricter draft, which still read the protected paths live before landing, because it would have overridden the user's trade-off.
          - **CHANGE-31:** every scope reader reads live first, and a successful live read always wins. Only when the live read fails, and the last good scope is within the bound, does the stale scope both admit and refuse. Past the bound it fails closed. The bound is shaped, not a constant. Every stale use is logged and counted.
        - **Live readings by effect (relayed by qa; recorded 2026-10-16T06:00:13Z):**
          - **CHANGE-19, compose's concept recall:** 27 recalls succeeded and 0 timed out since 04:21Z. Before, about 3,220 timed out a day.
          - **CHANGE-18, the range drain:** each valve run removes about 20,000 rows since 05:29Z. Before, it timed out.
          - **CHANGE-21b:** the contention threshold is live, at 30.
        - **DECIDED, the gap-store read path (built with CHANGE-30):** one read-path snapshot keyed on the gap file's identity, so a read by id no longer re-parses the 21.6 MB file. Writers are unchanged.
        - **RUN 0** (the random-goal baseline) runs once CHANGE-26 and the development-vessel push carrying CHANGE-22, -27 and -28 converge. Its pre-registered reading will name the frame commit, the seed, the 20 drawn goals (described generically), the attempts per goal, and the gate and trust verdicts.
          - **Pre-registration amendment 1** (written 2026-10-16T06:00:17Z, before any frame enumeration or draw; relayed by qa). The original text did not fix which node each goal is dispatched to. Left open, the choice of node could flatter the result, because one node resolves several write and report shapes through peers that refuse them (105 refusals in 24 hours). The rule is now fixed:
            - a real-traffic goal goes to the node it was originally sent to (the earliest occurrence, if both);
            - an open-gap goal gets a drawn node (an even index goes to the first node, an odd one to the second);
            - readings are reported per node as well as overall, so a break on one node shows as that.
        - **§7 STEP 4, the redispatch livelock: NOT MET** (a pre-registered reading by qa, recorded 2026-10-16T06:03:39Z, over 10-15 06:00Z → 10-16 06:00Z, both nodes; the exit is ≤24 dispatches per gap per 24 hours without a hold).
          - **The counts:** 271 gaps were dispatched (median 1, p90 3, max 455). Three exceeded 24, and none was held: 455, 373 and 340 dispatches.
          - **Two of the three are check-supply loops.** The record that a check goal was sent is refused, because the write gate reads a quoted placeholder in the goal's text as an unrendered template slot. So the goal is sent again every tick. The receiver's spend breaker refused 752 of them, but nothing tells the sender to stop.
          - **The third** is the maintenance-family sampler that §2.6 already names.
          - **The positive control:** one gap's sends reconcile exactly against the receiver's log.
          - **Next:** proposed as CHANGE-32, right after CHANGE-30, because it is on the same write path.
        - **CHANGE-15, a reading by effect** (relayed by qa; recorded 2026-10-16T06:03:39Z). The peer refusals behind amendment 1 were already fixed by CHANGE-15 (pushed about 00:05Z), in which a re-homed peer row dials its own endpoint. The 24-hour baseline of 105 refusals ended just before that landed. Since then, that node shows 0 refused peer resolves in 6 hours, and the shape that used to be refused is now produced (the positive control). **No gap is filed, and nothing is added to the order.** RUN 0's per-node reading confirms it, and amendment 1 stands regardless.
        - **D1, why drafts fail verification: a per-compose tally** (the coordinator's, read-only; recorded 2026-10-16T06:07:07Z; 62 composes on both compose nodes, 10-15 21:27Z → 10-16 05:40Z, 0 landed).
          - **The forms the audit named are mostly not what kills drafts.** A missing module was the cause in 1 compose, and an unparsed typecheck line in 1. Skipping the own-check after a typecheck failure is correct. "No test file" means the gap carried no check to resolve.
          - **The dominant terminal class is a wrong draft (about 20).** Defects in the harness make those failures final, when a working repair loop could have fixed them.
          - **The ranked causes:**
            - **R1 (about 30 composes): repair is blind to failures at the test stage.** Verification appends the stage's reason after the raw output. The repair prompt always says the change "fails lint" and passes only the first 4,000 characters, whatever the stage, so the reason is cut off. Docs verified this on the development-vessel dev tip. This repair has never worked for a test-stage failure.
            - **R2 (12):** new-resolver wiring was dropped by the file-scope gate. Already fixed by CHANGE-22.
            - **R3 (9):** the check that tests are written refuses the draft.
            - **R4 (5):** a refusal for "the region has no effect" bans the only correct region.
            - **R5 (3):** the LLM plane was down.
            - **R6 (2 or more):** the suite timeout is a constant.
            - **R7 (3):** an own-check names a test that is still a placeholder.
            - **R8 (2):** touched vessel names are not normalized.
            - **R9 (every compose):** the lesson file sits at a constant path that test fixtures also write to. On one node, 33 of 3,794 rows are real. The file feeds the drafter's "recent rejections" and the class posterior. So what compose learns from its failures is mostly fixture noise.
          - **Every cause but R5 is in the scope-excluded compose file,** so each is an operator bootstrap under this section's process.
          - **The proposed order:** R1, R9, R8, R6, R7, R4, R3.
          - **Under the 10-16 ruling, R1, R6 and R9 are (c) items.** A stage-blind repair prompt, a constant timeout and a constant lesson path are hard-wired decisions. The repair should receive the failing stage and its reason as shaped input; the timeout and the lesson store should be read at use time.
          - **DECIDED:** the D1 repair is CHANGE-33, one commit per root.
        - **USER RULING on CHANGE-29's scope** (in qa's session at 2026-10-16T06:06:38Z; relayed by qa; recorded 2026-10-16T06:07:38Z). From three options, the user chose **"Own-substrate, any non-forbidden"**, over "read-only only" and "hold until §9.0".
          - The floor may be offered its goal's advertised target shapes, read or executable, only when the producer is on our own substrate.
          - A foreign row is refused both at the offer and at execution.
          - A forbidden tool is never offered (no shell).
          - The dead, hand-listed tool is dropped.
        - **N14, an outcome not recorded before: NOT MET for the lane.** The need dispatched to the lane on 10-11, "the floor's read tools are built from discovery", was not delivered in its 72-hour window, which ended at about 10-14T18:58Z. Its system-born gap sits unarmed at a wrong site.
          - Under the 10-15 ruling (the lane failed the lasting fix, so an operator may fix the root cause) and the 10-16 directive, the operator restore proceeds, reusing that gap.
          - **The history** (a restatement, with a delta): the floor's offer was hand-written from the start. An earlier bridge from discovery to tools existed elsewhere and lost its caller in May.
        - **DECIDED, the build sequence:** CHANGE-30, then 31, 32, 33 and 29. This keeps the agreed order: the gap-store read first, then why drafts fail verification, before the floor's read tools.
        - **DECIDED, one outcome vocabulary** (by qa; recorded 2026-10-16T06:08:59Z):
          - CHANGE-30's deferred cutover reuses the walk service's existing non-attempt outcome, "retryable", which busy and capacity refusals already use. No new verdict is minted.
          - The check-supply sender classifies every result once, from structured fields and not from text: reached, failed, non-attempt, or refused by the receiver. Each outcome that is not a failure carries a shaped retry delay.
          - So the sender's back-off on refusal (32b) folds into CHANGE-30, as one definition. CHANGE-32 keeps only the placeholder quoting. Each defect keeps its own must-fail. The gate requires both must-fails to go red on the base and green on top independently, the refusal case under a failing bookkeeping write. If only one flips, the change does not push.
        - **USER RULING on the walk service's protected main file** (in qa's session at 2026-10-16T06:20:10Z; relayed by qa; recorded 2026-10-16T06:21:33Z). The question had been carried since 10-15 05:53Z: gaps sited in that file can never be picked by the lane. From three options, the user chose **"Open index.ts to the lane"**, over "Factor out, then lane" (qa's recommendation) and "Keep protected".
          - The file leaves the protected list on all three scope records. The landing gate (the judge tests and the whole suite) is the guard.
          - It is CHANGE-34, prepared by the coordinator, with any pins updated in the same act. It is applied right after RUN 0's window closes (law 12: one change at a time).
        - **RUN 0, pre-registration amendment 2** (written 2026-10-16T06:20:32Z, before the freeze and the draw; relayed by qa):
          - **The S1 frame** is read from the walk service's own dispatch store, because no log line carries the goal text. The store keeps only the newest 2,000 dispatches per node, so the frame spans about 3 days on one node and 2 on the other, not 7. This is stated as a limit.
          - **The frame is frozen now,** because the oldest human goals were about to fall out of the store. The draw still happens at RUN 0 time, from the frozen file.
          - **Check-supply test-writing goals are excluded,** because a text-only replay cannot carry their structured inputs. This is a limit of the measurement: those goals are not tested by RUN 0.
          - **The S2 goal form** is the live producers' own: "investigate and decompose gap <id>: <first sentence>".
          - **Attempts:** a refusal at the front door (429, 503, or no answer) is not an attempt. An HTTP 400 is a failed attempt.
          - **Duplicates** are removed on exact text.
          - **A known confound:** one node has no human traffic in its window.
        - **RUN 0 frame FROZEN** at 2026-10-16T06:20:52Z (sha256 231d5a2755c6ce8c…).
          - **S1: 132 real-traffic goals,** 108 and 24 by node. By source: 56 from the human surface, 33 gap-closing, 15 gap-decompose, 23 gap asks, and 5 recovery.
          - **S2: 3,203 open gaps.**
        - **RUN 0, pre-registration amendment 3** (written 2026-10-16T06:22:01Z, after the freeze and before any draw; relayed by qa; recorded 2026-10-16T06:22:23Z):
          - **A ceiling on non-attempts.** At most 3 front-door non-attempts (429, 503, or no answer) are allowed per goal per attempt, re-sent after 5, 10 and 20 minutes. After the third, the attempt scores as a **failure**, of the class "not reached (front door)". The total of non-attempts is reported per run and per node.
          - **The excluded class is disclosed.** From the frozen frame's own counts, check-supply test-writing dispatches were 1,278 of 4,020 raw dispatch records in the window: **31.8%** (84 of 2,001 on one node, and 1,194 of 2,019 on the other). That is about 325 distinct texts, against the frame's 132. A result is stated with this, for example "20/20 on a frame that excludes check-supply goals (31.8% of raw traffic)". The other exclusions are reported by rule.
          - **S2 is drawn uniformly** over the 3,203 frozen open gaps, including system-born noise and the 144 whose ids cannot be attributed. **Nothing is filtered after the freeze.** The only replacement is the original rule (a goal that would move a secret or is destructive), decided per goal, with the reasons listed.
        - **CHANGE-20, the write-conflict retry: a pre-registered reading** (by qa; recorded 2026-10-16T06:36:00Z; 60 minutes before against 60 minutes after convergence, per node). The criterion was that re-derive write failures fall toward 0.
          - **Re-derive write failures per hour:** 225 → 192 on one node (−15%), and 242 → 69 on the other (−71%). All conflict lines: 243 → 213, and 243 → 89.
          - **The verdict: PARTIAL on one node, NOT MET on the other.**
          - **An instrument limit:** the failure line is logged only after every retry is spent, and retries are not logged one by one, so the retry count cannot be read. The larger drop is the positive evidence that the retry acts. What remains is conflicts that outlast the back-off under heavier contention.
          - **Confounded** by the rest of the same push.
          - **Not readable again:** CHANGE-26 removes the measured writer (the retired pair), so this criterion cannot be re-read after it lands.
          - **CHANGE-26's law-12 hold** (this window) is satisfied. It still waits on the lane's lease on that repository, which ends by 07:36Z.
        - **CHANGE-26 LANDED** (operator; recorded 2026-10-16T06:39:10Z). It retires the 8-hex context-bucket pair with its code, under the user's ruling "Retire it with the code, go ahead". It was pushed at 2026-10-16T06:38:27Z, with all guards passing (activity-api f1ff7ea, verified by docs on that repository's dev). The law-12 window was recorded first, and the lane released its lease early.
          - **When it converges,** the held parent gap closes as "retired with its code", via its child. **That is not a really-fixed reason.** The child carries the remaining table-scan part.
          - **The headline is still 0.** The lane's attempt on the system-detected gap in the same repository ended not landed at 05:52Z.
          - **RUN 0** now waits only on the development-vessel push (CHANGE-22, -27 and -28), which is held by a lane lease that ends by 07:28Z.
        - **The lane's 05:52Z attempt on the system-detected gap: terminal class R1, leading into R4** (relayed by qa; recorded 2026-10-16T06:40:28Z). Its own check ran and stayed red, on a circuit-breaker test and a health-score test. The repair was never shown that reason, so it edited an unrelated test file instead of the edit site. The no-effect rule then refused the repeat.
        - **DECIDED, the sequence moves R1 forward** (qa, on docs' proposal; recorded 2026-10-16T06:40:28Z). The order is now: CHANGE-30, then 33/R1, 31, 32a, the rest of 33 (R9, R8, R6, R7, R4, R3), then 29.
          - R1 is built in parallel with CHANGE-30's gate. The two land in sequence, each with its own law-12 window.
          - **The reason:** two independent readings show that blind repair, not scope or quoting, stands between the lane and a landing. One is about 30 of the 62 composes; the other is the system-detected gap's attempt.
          - **R1's must-fail:** a red own-check whose reason lies past character 4,000. The repair prompt must carry the failing test names and the edit site, with the stage and the gate detail as fields of their own, first. **The control:** a typecheck-stage failure keeps today's prompt.
        - **CHANGE-26, a reading by effect** (relayed by qa; recorded 2026-10-16T06:55:26Z).
          - It **converged** on one node at 06:48:03Z and on the other at 06:53:43Z.
          - The held parent gap **closed at 06:54:35Z, "closed via child"**: retired with its code, not a really-fixed reason. The hold is lifted, and the child carries the table-scan part.
          - **The positive control passes.** After convergence, the remaining reader returned 782,221 observations over 5,815 signatures, with non-zero success rates, so no reader was left on the retired keys.
          - **The writer is gone:** 0 log lines mention the retired pair, and there have been 0 re-derive conflict lines since the restart.
        - **CHANGE-30 is APPROVED.** Its full gate passed on both repositories: 0 new failures, identical failure lists, 0 of 21 on the golden set, 0 protected-file changes, and a clean typecheck. It pushes after RUN 0's window. **Its two must-fails are confirmed (attested):** the coordinator's test runs show them, and qa read the reports and the test diff without re-running them. On the base, exactly these two were red, each for its own reason:
          - (a) the base charged a deferred, retryable result as a failed dispatch, where the change records a non-attempt;
          - (b) the base wrote no record after the receiver refused, where the change records the refusal and does not re-send before its delay, even with the bookkeeping write refused.

          All 3 controls pass on both. The deferred-landing test (3 must-fails, red on the base only) and the non-attempt bound test also flip as expected.
        - **R1 is built.** Its tests flip correctly and the golden set is unchanged. Its full gate is running.
        - **RUN 0, pre-registration amendment 4** (written 2026-10-16T06:55:48Z, before any draw; relayed by qa; recorded 2026-10-16T06:56:18Z):
          - **T0** is the first attempt-1 dispatch.
          - **The hard close is T0 + 4 hours.** Every goal not yet successful is then scored **NOT REACHED** (class "window closed"), collection stops, and pushes resume.
          - **An attempt with no terminal state 90 minutes after its dispatch** is scored failed ("no terminal in 90 min").
          - **Expected (not a target):** the attempt-1 dispatches take about 15 minutes, plus up to 35 minutes of re-sends; attempt 1 reaches a terminal state by about T0 + 1h45; attempt 2 starts at least 20 minutes later; everything is done by about T0 + 3h30. If the development-vessel lease releases at about 07:29Z, T0 is about 07:45Z, and the hard close is about 11:45Z at the latest.
        - **USER GO** (in qa's session at 2026-10-16T07:06:51Z, from the transcript, verbatim; relayed by qa; recorded 2026-10-16T07:07:21Z): **"yes, take these through the process"**. It answers qa's schedule report:
          - the settlement window ends 2026-10-18T07:12Z;
          - the headline is still 0;
          - the queue is CHANGE-30, R1 (with R1b), CHANGE-34, 31, 32a, the rest of 33, then 29;
          - serialized landings take about 2 to 3 hours each, so the late items are at risk.
        - **DECIDED: build ahead, land in sequence.** The coordinator builds and gates every remaining item now, each in its own tree. qa lands them one at a time, each with its own law-12 window, after RUN 0. The order puts first what unblocks a system landing: CHANGE-30, R1, CHANGE-34.
          - **R1b, R1's instrument** (recorded 2026-10-16T07:08:15Z). It is stacked on R1 and rides with it as one push, if its gate is clean. When R1 actually changes a repair prompt, because the structured evidence led it, R1b journals one line naming the gap, the vessel, the stage, the form ("evidence"), the failing own-check tests and the edit site. Unchanged rounds log nothing, so every golden recording stays identical; a first cut that also logged unchanged rounds was caught by the golden recording diff. **R1's reading by effect:** the evidence-form rounds that write an edit, against "wrote nothing" (a baseline of 33 in about 8 hours).
          - **DECIDED: each window is set by its own criterion.** A change's law-12 window is the time to its first readable pre-registered effect, plus Gate P's soak on every node, not a flat 2 to 3 hours. Each push record states its window:
            - CHANGE-30: the next deferred cutover or check-supply tick;
            - R1: the next lane repair round;
            - 32a: the next check-supply tick;
            - CHANGE-34: the next gap-to-feature pick;
            - CHANGE-31: the next scope-read failure, or a stated cap if none occurs.

            A window with no readable event inside its cap is reported as "no event", never as a pass.
          - **DECIDED: every window has a cap** (qa; recorded 2026-10-16T07:10:00Z). A window starts at convergence on every node. It ends at the first readable pre-registered event, or at the cap. A cap reached with no event is reported "no event", and the queue moves on. The caps:
            - CHANGE-30: 2 hours;
            - R1 with R1b: 3 hours;
            - CHANGE-34: 1 hour;
            - CHANGE-31: 2 hours;
            - CHANGE-32a: 1 hour;
            - each CHANGE-33 root (R9, R8, R6, R7, R4, R3): 2 hours;
            - CHANGE-29: 2 hours.

            In the worst case the caps add up to about 23 hours plus convergence and soak. Even then, the queue ends inside the settlement window (2026-10-18T07:12Z) if RUN 0 closes on time.
        - **CHANGE-22, -27 and -28 LANDED** (operator; recorded 2026-10-16T07:33:40Z). They went out as one development-vessel push at 2026-10-16T07:32:56Z (97039381..eab49eb2, 6 commits, verified by docs on that repository's dev), with all guards passing, after the lane's lease ended.
          - **CHANGE-22:** the registration edits a new producer needs survive the file-scope gate, and the additive registration rule also runs at the scope floor.
          - **CHANGE-27:** a run's record is read from the walk service that ran it.
          - **CHANGE-28:** only a repair closure re-runs a waiting goal; a sweep close carries the landed commit; a landing's credit is paid once per gap and landing.
          - **RUN 0 starts** when this converges on both nodes.
        - **USER RULINGS on the database load** (in qa's session at 2026-10-16T07:53:50Z, from a question with options; relayed by qa; recorded 2026-10-16T07:54:48Z). They follow a database analysis the user had sent to qa.
          - **The load fixes land "First, right after RUN 0"**, chosen over "after R1 + 34" and "end of the queue":
            - **DB1:** lifecycle-subscriber runs stop writing full traces. They keep a counter, plus a trace on anomalies. This is about half of all database write work, and it is consistent with the trace store holding only gradable runs.
            - **DB2:** the per-trace posterior writes collapse into one transaction. This is the existing gap, in a protected file.
          - **Caching on the recommend path** also goes through the process: **"Yes, after the DB fixes"**. qa places it, as DB3, after the headline fixes, and stated that placement to the user.
        - **DECIDED, the landing sequence:** RUN 0, then DB1, DB2, CHANGE-30, R1 with R1b, CHANGE-34, DB3, 31, 32a, R9, R8, R6, R7, R4, R3, then 29.
          - **R4's golden:** 2 of 21 fixtures gain exactly one new field (the lock's edit fingerprint). qa approved this as a named fixture re-record in the commit.
          - **CHANGE-31's development-vessel suite ran blind.** It timed out under load, partly from the builder's own concurrent runs. It re-runs after RUN 0, on a quiet host.
        - **A live reading** (relayed by qa): the trace store has drained to its protected floor, about 218,000 rows from 396,000. Database p99 went from 8.1 s to 0.69 s, and the metrics endpoint's p95 from 4.8 s to 0.32 s.
        - **DECIDED, caps for the database fixes** (qa; recorded 2026-10-16T07:56:22Z), effect-based and each 1 hour:
          - **DB1:** the next lifecycle run writes a counter and no full trace. **Its must-fail:** an anomalous lifecycle run (a failure, or degraded output) still writes its full trace. **The control:** a normal run writes only the counter.
          - **DB2:** the next trace ingest shows one transaction for its posterior deltas.
          - **DB3:** the next recommend call reads through the cache.
        - **RUN 0 has not started.** Convergence of the development-vessel push is held. One node's landing test gate was killed at its 284-second wall under load (07:46:54Z, blind, held) and has been re-running since 07:52:38Z. The other node's gate has been running since 07:43:06Z. T0 waits for both to converge and for host load below about 10. Operator gates, a large share of that load, are paused for RUN 0.
        - **CHANGE-21, a note by effect:** its contention check runs and reads its threshold every tick. But at each tick's start the pressure was below 30%, and the load rose during the run. **A design limit:** admission at start time cannot foresee load that arrives mid-run. There is no positive control yet.
        - **RUN 0 STARTED** (relayed by qa; recorded 2026-10-16T08:13:55Z).
          - **T0 = 2026-10-16T08:13:05Z**, the first attempt-1 dispatch (accepted, 202). **The hard close is 12:13:05Z** (amendment 4).
          - **The preconditions were met:** CHANGE-26 converged; the development-vessel push converged on both nodes (one at 07:58Z, the other at about 08:11Z, after two gate runs were killed under load, the second attributed to operator gate load); no qa push was pending; host load was about 6, and CPU pressure about 1%.
          - **The LLM plane is degraded but working.** One provider answers 402 (out of credit), failover covers it, and 48 judgements succeeded in the 20 minutes before. The judge-null rate inside the window will be reported.
          - **The draw,** recorded in the pre-registration before any dispatch:
            - seed `5fd2b6021f580a2b5a05f3f95283cc4e2111c6497f04d5d0f698724b060ea606`, from the OS random source;
            - frame 231d5a27…;
            - S1 indices [115, 7, 95, 88, 66, 25, 1, 84, 36, 18, 98, 73, 75, 121];
            - S2 indices [1771, 2017, 783, 2008, 291, 906].

            No goal was flagged and none replaced. 16 goals went to one node and 4 to the other.
          - **What was drawn,** described generically:
            - 4 human questions (weather, identity, location, and a network-location question);
            - 5 of the walk service's own "investigate the gap before composing" asks;
            - 5 operator-tagged investigate-or-decompose asks;
            - 6 open-gap investigations.
        - **RUN 0, THE FINAL READING** (pre-registered; relayed by qa; recorded 2026-10-16T09:48:11Z). The window ran from 08:13:05Z to 09:46:53Z. All 20 goals reached a terminal state after attempt 2, well inside the hard close.
          - **Success** (the gate says reached AND the trust check passes): **1 of 20 at attempt 1, and 1 of 20 by attempt 2, which is 5%** (95% Wilson interval about 0.9% to 23.6%).
            - **The target of 20 of 20: NOT MET.** The contract floor of about 90%: NOT MET.
            - **Attempt 2 added nothing:** 19 goals were retried and 0 reached. **With learning on, attempt 2 chose the same targets and failed the same way.** Target inference has no learned selection, so the system did not adapt between attempts.
          - **By stratum and node:** real traffic, 1 of 13 on one node and 0 of 1 on the other; open gaps, 0 of 3 and 0 of 3.
          - **Instrument checks:** 0 front-door non-attempts; 0 coalesced dispatches; 0 disagreements between the gate and the trust check. The one reach passed the trust check, but weakly: a literal location answer with one wrong intermediate claim.
          - **The failure classes** (attempt 1 / attempt 2):
            - **A** (8 / 7): the system's own gap-investigation goals have no grader, and they write nothing onto the gap.
            - **B** (8 / 9): read and question goals were given write targets, then failed for "no artifact".
            - **C** (2 / 2): the fallback loop had no tool for the question (a name; a network location).
            - **E** (1 / 1): an edit-intent compose was refused, first for a no-effect region, then for no unique anchor.
          - **Null verdicts** were deterministic oracle abstentions (class A), not LLM failures. One model provider was out of credit, and failover covered it.
          - **The excluded class** (check-supply goals, 31.8% of raw traffic) is not tested here.
          - **Confounds:** one 20-second operator verification at nice 19 (08:33:17Z to 08:33:37Z), and a collector fault that lost no data. There was no operator push inside the window.
          - **The next breaks** (all built code-only, and re-gating now):
            - **A → CHANGE-35:** a product path through the existing decomposition writer, plus an outcome oracle that counts only the children this run created.
            - **B → A2a:** question goals drop mutation targets, with a shape-identifier rule on every vocabulary feed. **A2b,** a learned target selection, comes later.
            - **C → CHANGE-29,** with A2.
            - **E → R4 and R1.**
          - A prose "shape" name advertised by a substrate-authored resolver was found and filed as a gap.
          - **Pending a user answer:** qa has proposed moving CHANGE-35 and A2a to just after R1.
        - **USER RULINGS on the RUN 0 levers** (in qa's session at 2026-10-16T09:51:41Z; relayed by qa; recorded 2026-10-16T09:52:18Z). They answer docs' proposal.
          - **CHANGE-35 and A2a land "Right after DB1/DB2"**, before CHANGE-30. This was chosen over "after R1" and "keep the current order".
          - **A2b-minimal: "Yes, with 35+A2a".** A retried goal whose last attempt failed with no artifact on target X must not choose X again. It reuses the existing failure-recall record, so it is a selection and nothing new is minted. **Its must-fail:** replay a class-B goal twice; attempt 2 picks a different target.
        - **DECIDED, the landing order:** DB1, DB2, CHANGE-35 (with A2a and A2b-minimal), CHANGE-30, R1 with R1b, CHANGE-34, DB3, 31, 32a, R9, R8, R6, R7, R4, then 29.
        - **DECIDED, RUN 1:** pre-registered now under RUN 0's rules (a freshly frozen frame, a fresh seed, both attempts, the trust check, the 4-hour hard close). It runs after the CHANGE-35 set converges, so that its effect on reach is read, not assumed.
          - **R3: no change; the class is filed for the lane** (recorded 2026-10-16T09:53:11Z). The coordinator's raw-trace pass found R3's refusals correct: those gaps described defects already fixed, with stale edit sites, plus one load error. The real class is filed as a lane gap: a verdict that the test-writing check never went red does not route the gap toward "already fixed", then verify and close.
          - **The CHANGE-35 set's three parts each keep a must-fail that flips independently at the gate.** All three must go red then green before the push:
            - CHANGE-35: the oracle and the product path;
            - A2a: the weather case and the malformed-name case;
            - A2b-minimal: the replay-twice case.
        - **RUN 1, the pre-registration** (written 2026-10-16T09:52:25Z, sha 2901181a…, with an addendum; relayed by qa). It runs after DB1, DB2 and the CHANGE-35 set converge (with DB1's flip recorded), on a freshly frozen frame and a fresh seed, under RUN 0's rules. The pre-registered readings:
          - (2) every drawn investigate-or-decompose gap goal is graded by the outcome oracle. 0 abstentions are expected, and a reached one shows a child created by that run.
          - (3) no read goal ends as a write goal with no artifact, on an inferred mutation target (expected 0).
          - (4) A2b-minimal's exclusion, per goal.
          - (5) classes C and E are expected to persist.
          - (6) **retry adaptation:** the share of attempt-2 retries whose inferred target set differs from attempt 1's. **RUN 0's baseline, measured from the captures, is 0 of 19.** One goal's class moved from A to B with the same targets, so that shift came from grading, not from choice.
          - (7) results are reported by class (A, B, C, E).

          No number is pre-registered for the rise in success. The target stays 20 of 20 by attempt 2.
        - **DB1 LANDED, three of its four parts** (operator, under the user's 07:53:50Z ruling; recorded 2026-10-16T10:21:06Z). It was re-gated clean on all four repositories. Docs verified the three tips on their repositories' dev.
          - **Pushed:** the development-vessel part at 10:20:23Z (eab49eb2..fd4be09a); the shared executor package at 10:20:28Z (1d3727b..2a63a83); the walk-service part at 10:20:35Z (bcf5549..7e7c50f).
          - **The activity-api part** (the counts route, and the switch's create-only seed at 0) waits on a live lane landing lease on an activity-api gap, until 10:28Z at the latest. It pushes after that.
          - **DB1 is inert until its switch is flipped.** The seeded mode is 0, which keeps full traces as today. The flip to 1 is one recorded act, made after all four parts converge, with the shared package read from the running process. The database fork's before-and-after reading is taken around it.
          - **A push-guard refinement:** a lease whose gap has no edit site now finds its repository from the gap's summary. It still fails closed when the summary names none.
          - **The activity-api part landed** after the lane's lease ended (activity-api 4e15bee). **DB1 converged on all four repositories by 10:46:12Z.** Its switch flips once the last walk-service consumer restarts on the new shared package. That restart is deferred while work is in flight.
        - **USER RULING: "Move DB2 after R1"** (in qa's session at 2026-10-16T10:49:59Z, chosen over "Keep DB2 next"; relayed by qa; recorded 2026-10-16T10:50:30Z).
          - **The evidence put to the user** (the database fork's read-only counts on one node, read before the ruling):
            - after the trace-store drain and CHANGE-26, posterior-write conflicts are 0 per goal start (3.7 at 07:54Z);
            - trace-write p95 is 312 ms (12.0 s before);
            - context-score duplicates: 46 keys with 73 excess rows, all old. The latest new one was on 10-10, and 0 of today's 150 new rows landed on an existing key.
          - So **DB2's race is real but now rare in production.** Its must-fail still shows it under 20 concurrent writers.
          - **DB1 still matters:** 17.7 lifecycle writes per goal start before its flip.
        - **DECIDED, the landing order:** DB1 (its flip pending), the CHANGE-35 set, CHANGE-30, R1 with R1b, DB2, CHANGE-34, DB3, 31, 32a, R9, R8, R6, R7, R4, then 29.
        - **DB1 FLIPPED** (a recorded operator act; relayed by qa; recorded 2026-10-16T11:07:23Z). The lifecycle subscriber trace mode went from 0 to 1 on two nodes at 2026-10-16T10:51:14Z, and it reads back as 1.
          - **By effect:** subscriber-count batches were applied from 10:53Z on one node and about 10:56Z on the other, with no failures. On one node, lifecycle trace mentions went from 300 in the 11 minutes before to 0 in the first minutes after. The last walk-service consumer restarted on the new shared package at 10:59:46Z, and every node now counts.
          - The database fork's after-reading (10:52Z to 11:52Z) is due after 11:52Z.
        - **The CHANGE-35 set LANDED, two of its three parts** (operator, under the user's 09:51:41Z rulings; re-gated clean in all three repositories, with the golden differing only in the approved vocabulary count; docs verified both tips on their repositories' dev):
          - **The walk-service part,** pushed at 11:06:36Z (7e7c50f..adc270b), in three commits:
            - A2a: a read goal never infers a mutation target, and only shape names are targets;
            - class A: a gap investigation is graded by its product on the gap;
            - A2b-minimal: a retried goal does not choose again the target it just failed on.
          - **The boredom builder,** pushed at 11:06:41Z (e4a73e4..368b5aa): a gap with no edit site asks for its decomposition, structured.
          - **The development-vessel part** (the gap-decomposition shape and two builders) waits on a live lane lease on a development-vessel gap, and pushes after it. Until then the new decomposition route is inert, guarded by the vocabulary. A2a and A2b-minimal act now.
        - **RUN 1, amendment R1-1** (before any draw): DB2 is no longer a precondition, per the 10:49:59Z ruling. RUN 1 runs after DB1 and the CHANGE-35 set converge.
        - **A lease class, filed for the lane:** landing admission leases, for the full 2-hour term, gaps that cannot land. That covers a gap with no falsifier or no edit site (the 08:28Z case), and a gap whose own check names a placeholder test (the R7 finding), which reads "not run" forever. **Expected:** no lease, or an immediate release, for a gap that cannot land. **Its must-fail:** admitting such a gap takes no lease that blocks a concurrent landing. **The control:** a landable armed gap keeps its lease.
        - **USER RULING: "Release it, recorded"** (in qa's session at 2026-10-16T11:11:01Z, chosen over "Wait until 13:03:55Z"; relayed by qa; recorded 2026-10-16T11:12:20Z).
          - **Done at 11:11:30Z:** the lane's landing lease on one system-detected development-vessel gap was released. Its own check names a placeholder test, and it had 5 attempts. The store recorded the release, with the holder and the attempt. An attributed operator note on the gap names the ruling, the reason, and the lasting fix (the filed lease class, and R7).
          - **The gap stays open and armed. Nothing was hand-completed.**
        - **A second development-vessel lease is a headline candidate, and it is left untouched.** It is a system-detected, sited, armed gap: the lane is authoring a missing producer (task-execution reports) through the path CHANGE-22 opened this morning. The lease runs from 11:03:52Z to 13:03:52Z. The ruling covered one lease only. The CHANGE-35 development-vessel part, and so RUN 1, waits for it. Its own check is not a test: it is graded by whether a named goal reaches after the landing. Of its 5 attempts since 10-15 22:08Z, the one before this ended in verify_failed after repair rounds of the kind R1 targets, so this attempt's odds are low. It is waited for regardless.
        - **USER GO** (in qa's session at 2026-10-16T11:36:29Z, verbatim; relayed by qa; recorded 2026-10-16T11:37:06Z): **"yes, take these through the process"**. It answers qa's updated autonomy estimate, which named what 20 of 20 random goals still needs beyond the current queue:
          - **(1) A2b-proper:** target inference becomes a learned selection over an existing posterior, with today's choice as the cold start. The coordinator does the history and the design.
          - **(2) D2:** compose becomes a selectable, traced walk step, graded by the walk's reach verdict and not by its own report. The coordinator does the history and the design.
          - **(3) A structured replay in the measurement,** so that check-supply goals (31.8% of raw traffic) enter the frame by re-sending the original dispatch record. qa builds it, for the run after RUN 1.
          - **(4) CHANGE-29,** already queued.

          These land after the current queue unless RUN 1's reading reorders them. The current order is unchanged.
          - **qa's estimate, given just before the go:** the narrow criterion happens, but rarely; the headline is at about even odds before 2026-10-18T07:12Z; **20 of 20 random goals is not on this schedule.** RUN 1 is expected to be modest (a judgement of about 10% to 30%), with days of work to full.
          - **DECIDED, latest-by dates** (qa; recorded 2026-10-16T11:37:48Z). They only move closer, and every one is inside the settlement window (2026-10-18T07:12Z).

            | Item | Designed | Built and gated | Landed |
            |---|---|---|---|
            | A2b-proper (dated first: it is the "measurably adapts" item) | 10-16 15:00Z | 10-16 23:00Z | 10-17 12:00Z |
            | D2 | 10-16 18:00Z | 10-17 06:00Z | 10-17 18:00Z |
            | Structured replay (qa) | 10-16 13:00Z | tool ready 10-16 16:00Z | used in RUN 2 |
            | CHANGE-29 | done | in the queue | 10-17 18:00Z |

            The history and design for A2b-proper and D2 started at about 11:37Z, in parallel with the queue: history first, then a design note with a must-fail, then a code-only build. The replay is being built and dry-run only.
        - **USER RULING: "Push if file-disjoint"** (in qa's session at 2026-10-16T11:59:52Z, chosen over "keep refusing" and "pause the lane on that repository"; relayed by qa; recorded 2026-10-16T12:04:05Z).
          - A live lane landing lease now blocks an operator push only if a pushed file is the leased gap's edit site. A disjoint push proceeds, and the lane's drift check re-stages its attempt if needed.
          - **Why it was asked:** the lane leased development-vessel gaps back to back (a new 2-hour lease 3 seconds after the previous attempt ended), which would have stalled the whole development-vessel queue.
        - **The headline candidate did NOT land.** The lane's attempt on the missing-producer gap ended not landed at 11:25:16Z. **The headline is still 0.**
        - **DB1, by effect: TARGET MET** (the database fork's after-reading on one node, 10:52Z to 11:52Z).
          - **Lifecycle writes per goal start:** 32.1 (07:54Z), then 17.7 (before the flip), then **1.1** (all nodes on DB1). That is about 95% fewer, and the residue is anomaly-only traces.
          - Trace-write p50 and p95 are 41 ms and 205 ms; database p99 is 1.5 s; posterior-write conflicts are 0.
          - Database CPU median is 137%, against a lifetime average of 265%. That is consistent with lower load, but **not proven**, because there is no clean before-series.
        - **A DEFECT in the landed A2b-minimal** (found by the A2b-proper history pass, and verified). The failure record reads the target set from before the filter, so only the first failed target is ever avoided. One rare reach-gate fallback also sees the unfiltered set.
          - With at most 2 attempts, RUN 1's reading (4) stays valid. This is recorded in RUN 1's pre-registration as **amendment R1-2**, before any draw.
          - **The fix** (A2b-proper part 0) takes the earliest walk-service slot after CHANGE-30's part.
        - **Designs approved by qa,** ahead of their dates:
          - **A2b-proper:** the proposed target sets are re-ranked by an existing path posterior per goal class. The cold start is unchanged, and counterfactuals are logged.
          - **D2, steps 1 and 2:** compose counts as reached only with independent landing evidence (today a favourable self-report can read "reached" with no git check), and compose stops grading itself.
          - **D2, step 3** (compose as a walk step) touches edit-intent routing, which falls under the D-path surgery freeze. **It goes to the user before it is built.**
        - **The structured replay is impossible by construction.** Only the system's own sender writes the check-supply ledger's admission checks, and each re-send gets a new id, so no replay can be faithful. **RUN 2 will instead observe the sender on a seeded random draw of eligible gaps.** The design was done by 12:03Z, ahead of its 13:00Z date.
        - **A CORRECTION to RUN 0's disclosure (made after the run):** the excluded check-supply share was about **14.2%** of dispatched traffic, not 31.8%. The earlier count included front-door refusals, which the pre-registration treats as non-attempts. RUN 0's 1 of 20 is unchanged.
        - **Gaps filed:**
          - the check-supply sender dispatches gaps with no edit site, which admission refuses by construction;
          - a guard on the check-supply ledger can be bypassed.
        - **The CHANGE-35 set is fully LANDED** (operator; recorded 2026-10-16T12:08:46Z). Its development-vessel part was pushed at 2026-10-16T12:08:14Z (fd4be09a..e2fd1582, verified by docs on that repository's dev), with all guards passing. It is the existing decomposition writer advertised as gapDecomposition, with the two builders sending the gap id structured.
          - It went out under the file-disjoint ruling, because the lane's live lease was on an untouched test file. It used a gap between the coordinator's gate runs, by a handshake.
          - With the walk-service part (11:06:36Z) and the boredom part (11:06:41Z), the set is complete. **RUN 1 starts when it converges,** on a freshly frozen frame and a fresh seed.
        - **RUN 1 STARTED; a user ruling on per-organisation path keys; a missed tool date** (recorded 2026-10-16T17:57:07Z):
          - **RUN 1:** T0 2026-10-16T17:55:15Z; hard close 21:55:15Z. The frame was frozen at 17:53:57Z (sha256 13a17f34551c103e…). S1 holds 47 goals (the dispatch store's rolling window shrank it; 5 are human goals), and S2 holds 3,241.
            - The seed is dea315b19d0e19c0090464f88944282e903d3be1f9150d13197b68bac28f4710, from the OS random source. The S1 draw is [41,46,36,12,2,30,6,37,16,29,1,28,11,15] and the S2 draw is [431,644,1321,1400,469,1223]. Fourteen goals go to one node and six to another.
            - One drawn goal is flagged and kept: it investigates a design gap about credentials, and it moves no secret.
            - Deviations, recorded before dispatch: T0 is about 5 h late, because the reviewing session stalled from 12:10Z to 17:53Z. Host load was 11.7 just before T0, all of it the system's own (database and lane; no operator load), so the run proceeded rather than wait without bound.
            - Pre-registered for the reading: class-B residuals are split by phrasing (question vs. imperative). The host stays quiet and pushes wait until the run ends.
          - **USER RULING (qa session, 2026-10-16T17:53:17Z; relayed by qa):** "Build it as part of A2b" (over "Leave it to the system"). The question was the tenant isolation of A2b-proper's second part, because the path rows mix organisations when they are written.
            - The operator builds per-organisation keys for goal paths, and passes the organisation through, as part of A2b-proper's own data correctness. Legacy mixed rows are excluded, so selection starts cold for each organisation.
            - It is recorded as "the system did not detect this class". The filed gap stays open as the class need. The question was put to the user because the 10-13 ruling bars operator security patches for single holes.
          - **Dates:** the A2b-proper design (met about 11:55Z) and the D2 design (met about 12:05Z; steps 1–2 approved) were both on time. The structured-replay design was delivered about 12:03Z, on time. The **structured-replay tool MISSED 16:00Z.** The frame tool exists, but the seeded S3 draw and the observe reader do not. qa's recovery commitment is 19:00Z today; the 16:00Z date stands as missed.
          - **Ready to land:** CHANGE-30's walk-service part, the three activity-api changes (DB2', DB3 and the scope-floor migration), and R1+R1b are gated clean. They are held only for RUN 1's quiet window, and R1+R1b also for their flake re-runs. They land when RUN 1 ends.
        - **RUN 1 READING: 1/20 reached and trusted (5%), the same as RUN 0; the expectation of about 90% within two attempts is NOT MET** (recorded 2026-10-16T20:04:16Z; reading by qa):
          - Attempt 1 reached 1 of 20, and its trust pass is weak: the credited step was written inside the window, the older steps were not credited, and the step carries no dispatch id. Attempt 2 reached 0 of 19. The run ended at 18:54:01Z, with no front-door non-attempts. The structured-replay tool was delivered at 18:02:32Z, ahead of its 19:00Z recovery time.
          - Classes over 39 attempts:
            - **P, the producer declined: 11.** The decomposition producer refused for reasons of autonomy scope, no falsifier, no single source file, or a missing gap. S2 reached 0 of 12.
            - **B, write rule with no artifact: 10.** Five target only the decomposition shape, because of the investigation gate's order. Five are investigations with no gap id or a stale decision.
            - **J, LLM judge: 13.** Two have no referent, two are underspecified, and nine are real misses.
            - **E, admission refused on a closed gap: 2. K, lane busy: 1** (the livelock pair). **D, false absence after transport: 1.**
          - RUN 0's class A (citation abstain, 8 goals) is GONE. The deterministic investigation grading from CHANGE-35 works.
          - The class-B split by phrasing: every B residual is led by an imperative ("investigate and decompose …"). No question-led goal fell into B, so A2a's read rule did not misfire on questions.
          - Retry adaptation: 2 of the 3 adaptable B goals changed target on retry, and neither reached. One repeated the same targets; that case is A2b-minimal's repair.
          - **The biggest lever is class P:** the decomposition producer applies what look like compose-eligibility refusals to decomposition. The mechanism is being read, and it is a candidate for CHANGE-37.
        - **USER RULINGS on the order and on D2 step 3** (qa session, 2026-10-16T19:59:54Z, relayed by qa; confirmed in the docs session at 20:03:46Z):
          - **31 and CHANGE-32a move up.** They land right after RUN 1's queued landings and ahead of CHANGE-34 and the rest of the 10:49:59Z order. Both are gated clean. The reason: since 12:00Z, the livelock pair took 133 of 144 check-supply picks and 43 compose runs, which starves every other gap.
          - **CHANGE-36a and 36b land when gated,** with 36a's judge scope entry in the same act.
          - **D2 step 3 is allowed through the freeze** as one single-file executor change: a shaped per-task timeout with the default unchanged, through the full process, after steps 1–2 land. It must remove the blocker in which a resolve is aborted after 10 s while compose needs up to 900 s.
        - **Gate catches:** the whole-suite gate caught R9 importing a residue module into the closed judge core, and R6 interpolating a bare value into shell commands. Both were fixed and restacked; R6's golden change is the quoting only.
        - **No code has landed since RUN 1.** CHANGE-30's walk-service part was refused at the push guard on a lease with no edit site, and the retry is with the user.
        - **CONFOUND: RUN 0 and RUN 1 ran on a degraded LLM plane** (raised by the user at 2026-10-16T20:04:40Z: "Credits were low during the test which may be confounding"; verified in the journals by qa; recorded 2026-10-16T20:14:52Z):
          - The paid LLM provider answered 402 on one node from at least 2026-10-15T00:10Z until 20:03:19Z today, and on the other until 19:56:53Z. Calls were served by the last fallback model or by a rate-limited free model. RUN 0's window holds 61 of these errors and RUN 1's holds 21; there are none after about 20:04Z.
          - Confounded: class J, LLM-inferred targets, and "unparseable" decompositions. Not confounded: the deterministic mechanisms (36a's gate order, 36b's false absence, CHANGE-37's borrowed refusals, E, K, and RUN 0's class A).
          - **The 5% headline is not a measurement of the intended plane.** Both readings carry a confound section.
          - The condition went unnoticed for about 44 h. A gap is filed for the system. Process miss: the standing "check the LLM plane first" step was not run before the class readings.
        - **USER RULINGS** (qa session, 2026-10-16T20:05:03Z and about 20:10Z, relayed by qa; the first two confirmed in the docs session at 20:14:30Z):
          - **The push guard reads the lease's site and repo hints,** and still fails closed when it has neither. It had refused CHANGE-30's walk-service part on a lease held for a different repository.
          - **CHANGE-37 is built through the process.** The decomposition producer keeps its scope filter but exempts directed children and holds their lineage. It never takes `directed` from a pointer, keeps its refusal reasons, returns the union of children, and the auto-bridge re-binds or refuses. Latest-by: design and pre-registration with must-fails by 2026-10-16T23:00Z, built and gated by 2026-10-17T10:00Z, landed by 2026-10-17T16:00Z.
          - **RUN 1R, with gates held:** RUN 1's exact 20 goals (same draw, text and nodes, two attempts) are re-run on the restored plane, so credit is the one changed variable. It is pre-registered before dispatch, and T0 waits until CHANGE-30's walk-service part runs on both nodes.
        - **CHANGE-30's walk-service part LANDED at 2026-10-16T20:05:52Z,** the first code push after RUN 1.
        - **USER RULING (qa session, 2026-10-16T20:23:03Z, relayed by qa; recorded 2026-10-16T20:24:30Z): "we should vary the wording of the goals to prevent overfitting to specific phraseology."**
          - **RUN 2 amendment P (paired units):** each drawn goal is sent in its original wording and as one mechanical paraphrase. The paraphrase prompt is fixed and recorded, its sentence form is seeded from the draw seed, and it is frozen with a hash before dispatch. qa reviews it only for changes of meaning or identifiers, with no hand edits. A pair that disagrees is a phrasing-sensitivity finding and becomes a gap. RUN 1R is excluded: it keeps RUN 1's exact text, because credit is its one variable.
          - **Standing rule for builds:** any change that decides anything from goal wording carries a paraphrase control in its must-fail set. It applies to 36a, CHANGE-37 and A2a.
          - Why: the gap route, the write rule and A2a's read rule each key on surface phrasing (§7 step 8, A2). The expectation is stated timelessly in SUBSTRATE_AS_SOFTWARE §3.0: the system's own goals carry identifiers as fields, and goal interpretation is a selection.
        - **CHANGE-37's design is accepted** (qa) with one addition before the build: the part that turns frozen values into slots must never leave an unrendered slot, because an unrendered slot is the token behind the CHANGE-32a livelock.
        - **RUN 1R is DEFERRED; it did not run** (recorded 2026-10-16T20:25:29Z). The pre-registered check of the LLM plane failed just before T0: one node logged four 402 answers at 20:14:23Z, after the restore, and the preferred model chain was marked exhausted again at 20:24:26Z. Running would have measured the confound again. Gates are released. RUN 1R starts only after a clean window of at least 15 minutes on both nodes; the user is asked.
        - **LANDED, under the user's 19:59:54Z order ruling** (verified by docs on each repository's dev; recorded 2026-10-16T20:34:24Z). RUN 1R's deferral released the hold, so these went out without waiting for it:
          - **development-vessel, 8 commits at 20:33:17Z** (e2fd1582..e1bbd1bb): CHANGE-30's four (one parse per store version, a gap-store read that says which way it failed, a deferred cutover recorded as a non-attempt, refusals and non-attempts recorded as what they are), R1 (the repair round sees why the draft failed), R1b (the journal says when R1 changed the prompt), 31 (the bounded stale reuse of the scope), and **32a** (the check goal quotes the placeholders it copies, which ends the livelock). All 5,615 tests ran, with no new failures against dev, and both live leases were disjoint.
          - **activity-api, 3 commits at 20:33:32Z** (4e15bee..202e564): DB2' (context posteriors through the aggregator), DB3 (the recommend read served from the template cache), and the seed for the scope floor's bound.
          - RUN 1R records 32a as a second co-change. Its expected effect is on lane capacity only (class K), so attribution per goal still separates it from the plane.
        - **CHANGE-37 is built and approved as a set** (37a, 37c, 37d'), ahead of its 2026-10-17T10:00Z date, and queued for its gate. The approval made one condition on 37d: refuse a value only when it is identifier-shaped and copied from the authoring goal, or is the goal's own gap id, so that generic constants still bind. A control for that case is in the must-fail set. The design (latest-by 23:00Z) was approved before 20:35Z.
        - **Readings after landing** (qa; recorded 2026-10-16T21:11:17Z):
          - **CHANGE-32a MET BY EFFECT.** The livelock pair's ledger now saves (the goal was dispatched on its first attempt at 20:51:15Z, then settled). On each node the last refusal for an unrendered binding predates convergence, and there have been none since. The re-send loop, which ran for about two days, is broken.
          - **CHANGE-30's development-vessel part met its first readable event:** an outcome was classified as a non-attempt at 20:46:32Z.
          - The activity-api trio has its migration applied on both nodes, and health checks answer. The change that keys goal paths per organisation pushes at the next quiet.
          - **CHANGE-34 LANDED** as the super-repo pin and seed (20:38:03Z). Gate P has promoted it on 2 of 4 nodes (21:07Z). The step that removes the walk service's main file from the scope records runs only after all four nodes accept.
          - The super-repo file that CHANGE-34 touches already carries instance-name tokens. The leak check for that one commit held the added tokens equal to the removed ones. A gap is filed for the system to make that public file free of instance names.
          - **The LLM plane is still degraded on one node** (402 or exhaustion every 15 minutes), so RUN 1R stays deferred. The user is asked about the remaining provider.
          - The walk-service stack is linear: Part 0, 29′, A2b-proper parts 1 and 2, D2 step 1′, 36a′, 36b′. It pushes as one chain when the two outstanding gate runs are green. Part 0 is held until one wall-clock test passes three times alone, because its single new failure ran at load 15.9.
        - **RUN 1R's plane check is amended before T0** (qa; recorded 2026-10-16T21:37:24Z). The user stated that the paid provider the substrate relies on has credit. The models still answering 402 sit with a second provider and are a standing condition, not part of the plane under test.
          - The amended check passes when, over the last 15 minutes on both nodes, no paid model of the relied-on provider is marked exhausted and no 402 comes from outside the second provider's models. It passed on both nodes at 21:36:16Z.
          - The amendment is recorded before T0 and before any reading, so it is not fitted to an outcome. Class J residuals in RUN 1R are still read against which model actually answered.
        - **LANDED: activity-api 79af4d9, goal paths keyed per organisation** (A2b-proper part 2's prerequisite under the 17:53:17Z ruling; verified by docs on dev at 2026-10-16T21:37:24Z). A caller reads only its own organisation's paths. Legacy mixed rows are excluded, so selection starts cold for each organisation.
        - **RUN 1R's T0 waits on three things, none of them a blocker for the user:** the per-organisation change converged with its service restarted, CHANGE-34's step that removes the scope entry finished on the remaining nodes, and the three solo runs of Part 0's wall-clock test. qa moved those three runs ahead, because the failure tracks host load (red at load 13–16, green at 7–10).
        - **USER DIRECTION (qa session, 2026-10-16T21:46:23Z, relayed by qa; recorded 2026-10-16T21:48:06Z), verbatim:** "We need to demonstrate that the system can close gaps given only the information the system can find during discovery. Otherwise no gaps would close. We need to demonstrate that the system can discover gaps using only the information available from the traces, and that it can prioritize what to do based on how contingent each change is and the impact, cost, viability of the change."
          - It answered the user's question "How do we know that these are the changes we should be making?" qa's answer: each fix is proven to repair its own defect (by a must-fail and by effect), but not proven to be the most valuable. Reach gain per fix is unmeasured, the largest failure class has no fix, part of the queue predates measurement, and operator fixes do not show the system's own loop.
          - **Consequence for this record:** today's landings are operator closures. They repair defects, and none of them counts toward the demonstration. The demonstration counts only gaps the system filed from its own traces, chose by its own prioritisation, and closed with only what discovery recorded. The expectation is stated timelessly in SUBSTRATE_AS_SOFTWARE §5.2.
          - **Next (qa):** a map of the existing discovery, closure and prioritisation parts, then a pre-registered demonstration design. Discovery is graded by recall against the defects found by hand today: did a system detector already hold a gap for each one, filed from traces alone?
          - **Docs proposal for that design:** every change in the queue pre-registers the failure class it should reduce and by how much. The next reach run checks those predictions goal by goal, and a change that misses its prediction is reviewed rather than counted as progress.
        - **USER STATEMENT (qa session, 2026-10-16T21:48:05Z, relayed by qa; recorded 2026-10-16T21:49:08Z), verbatim:** "We know that there is nothing the system can't find of it had been provided the correct information. And we know that we can derive the information from the environment. This whole process is contained in the core idioms of the system design"
          - **Method, agreed by qa:** no new detectors or scorers. Each property is a goal the system walks over shapes, producers and traces. It is dispatched in natural language with no operator context, in its original wording and in one paraphrase.
            - Discovery: "find what's wrong from the traces", producing gaps. It is graded by recall against the defects found by hand today.
            - Closure: "close gap <id>" on a system-filed gap that no operator has touched. The walk derives the edit site and the falsifier.
            - Prioritisation: "what next, and why". The ranking is checked against the dependency, impact, cost and viability fields carried as shapes.
          - Every miss is a law-8 information gap. The record names the missing fact and the step that needed it, and makes the fact derivable as an impulse. SUBSTRATE_AS_SOFTWARE §5.2 is amended to say this.
          - **The per-change predictions are agreed** (qa). Each queued change records the failure class it should reduce and an expected size in RUN 2's pre-registration, before RUN 2.
        - **RUN 1R STARTED** (recorded 2026-10-16T21:51:05Z). T0 was 2026-10-16T21:49:41Z, with the hard close at 2026-10-17T00:49:41Z. It reuses RUN 1's draw unchanged (the same seed and frame, verified at dispatch). The amended plane check passed just before T0. Gates are held until the run ends.
          - **Deviation D-1, written after dispatch** (qa): the precondition that the per-organisation goal-path change be live was dropped before dispatch and not recorded then. At T0 neither node's activity-api ran it. One node's pull-sync held it because its test gate was blind to its environment. The other node reads an activity-api that is still at the three earlier changes.
            - So no node differs at T0. If the change converges during the run, the effect is a logged service restart, attributable by node and time, and per-organisation keying of goal-path writes. It does not change what the walks read, because the only reader of the per-organisation read is A2b-proper's part 2, which has not landed.
            - Process miss: the dropped precondition should have been written before dispatch.
        - **USER STATEMENT (qa session, 2026-10-16T21:49:27Z, relayed by qa), verbatim:** "If we need a new shape the system should understand and try to satisfy from the existing state. This is a core process to activity execution."
          - **Recorded as demonstration D4, a novel shape.** The test is a goal whose target shape no producer advertises; "what next, and why" is the natural case. It is reached when the walk works out what the shape is and builds it by composing existing producers over the gap store, traces and posteriors. It is not reached by answering "no template produces" and filing a capability gap. RUN 1's goal at position 13 is the counter-example on record.
        - **USER RULINGS (qa session, 2026-10-16T21:56:40Z, relayed by qa; recorded 2026-10-16T21:57:32Z):**
          - **(a) "Operators build them":** the information-availability items I1–I5 are built by operators through history-first, must-fail and gate. Each item is information the system already has that is not available at the step that needs it (law 8).
          - **(b) "Re-rank by demo value":** the new order after RUN 1R is the walk-service chain (gated, carrying 29′), then the per-organisation parity fix, then I5, I1, I3, I4, then CHANGE-37, then D2 step 2′ and step 3. The audit items R9′, R8′, R6″ and R4′ wait unless a measurement shows they matter.
          - **Baseline for the demonstration** (qa's read-only survey over 7 days):
            - **Discovery works without operators:** about 415 of 583 gaps were filed by the system. But the trace scans record only a summary and trace ids, never where the fix goes or how to check it.
            - **Closure does not yet:** 0 of 10 landing closes were untouched system roots. 86% of open system gaps are unarmed. The top stall is check supply excluded by scope (624 rows).
            - **Prioritisation has no reader** for demand, cost or dependency, and the learned posteriors are node-local files rather than shapes.
            - All five blockers are information that exists but is not available at the step that needs it, as the user stated at 21:48:05Z.
          - **The items:**
            - **I5, autonomy is not on the gap row.** The landing close knows whether the attempt was directed, and its attempt id, but writes neither to the gap. It goes first because it is the demonstration's own measurement. Must-fail: a verified close stores directed:false and the attempt id.
            - **I1, localization is never persisted.** Localization runs only after the pick and never writes the edit site, while admission requires a site. Persist the edit site with who localized it, and localize armed siteless rows before admission. Must-fail: an armed siteless system gap whose summary names a real file gains a site from the system's own pass, with no operator field.
            - **I3, the picker does not read demand, cost or contingency.** The impact score counts only citations. Demand and the spend ledger go unread, and there is no notion of dependency beyond the parent-landing wait. Read them into the score as shaped fields, with contingency as the demand-to-gap links plus parent and child. Check supply orders scope-allowed, identifiable rows first. Must-fail: of two otherwise equal gaps, the one with higher demand and lower spend ranks first.
            - **I4, two posteriors are node-local files** (gap-class credit and detector closure credit). They become shaped reads (law 1), with the file at most a cache. Must-fail: the posterior reads through the resolver and agrees across nodes.
            - **I2, re-reading the scope opening:** not built unless CHANGE-34's by-effect fails. Pre-registered: within 2 h of the opening, rows excluded by scope that target the walk service's main file fall below 121, and at least one is dispatched or marked no-anchor.
          - **Dates (qa):** I5 and I1 designed by 2026-10-17T02:00Z and gated by 10:00Z. I3 and I4 designed by 2026-10-17T06:00Z. Moving CHANGE-37 and D2 behind the I items does not move their latest-by dates: CHANGE-37 still lands by 2026-10-17T16:00Z and D2 by 18:00Z.
        - **USER STATEMENT (qa session, 2026-10-16T21:57:28Z, relayed by qa; recorded 2026-10-16T21:58:38Z), verbatim:** "We should check that we do not hard code to reach the demo, but instead solve for the general case via the architecture principles"
          - **The general-case gate, G1–G6:** qa reviews every build against it before the build's gate.
            - **G1 (law 1):** no new behavioural constants (weights, orderings, thresholds, category lists, or patterns on wording). Preferences are shaped impulses read at use time, and they can be learned. I3's weighting of demand, cost and contingency is a shaped, learnable record, not a formula. Putting scope-allowed rows first in check supply is a shaped preference, not a new sort key.
            - **G2 (law 2):** new behaviour is an activity that the walk can select and traces can grade. I1's localization before admission is an activity that reuses the existing localizer as its resolver, not a branch inside admission.
            - **G3 (law 3):** reuse the existing demand links, the spend ledger, the localizer and the pool shapes before adding anything.
            - **G4: no targeting of the demonstration.** Nothing keys on demonstration goal text, on specific gap ids, or on particular candidate pools. The demonstration draws its gaps at random after the builds land.
            - **G5:** every must-fail set carries a paraphrase control and a held-out control. A gap class, shape or goal form outside the demonstration must behave the same way.
            - **G6:** heuristics that were approved earlier and key on wording are re-audited, and either replaced with a structural form or kept as named limitations. The canonical parse of a gap goal stays as a named limitation and is not widened.
          - **CHANGE-37's 37d fails G1 as approved,** because its frozen-value check reads the goal's wording. The structural form reads no goal text: a concrete value in a field that is not a file or content field is allowed only when the producer's declared contract names it a constant. Otherwise the field binds from a slot, or the mint is refused. qa asked the coordinator whether this fits inside 37d without moving its dates (built and gated by 2026-10-17T10:00Z, landed by 16:00Z). If it does not, qa states before 23:00Z what is given up and why.
          - **Dates confirmed (qa):** D2 steps 1–2 by 2026-10-17T18:00Z hold. Step 1 is in the gated walk-service chain, and step 2′ gates in a following order. The re-rank changes build order, not the latest-by dates of built work.
        - **CHANGE-37's dates HOLD** (recorded 2026-10-16T22:05:11Z): built and gated by 2026-10-17T10:00Z, landed by 16:00Z. The G6 rework of 37d replaces the pattern on wording with the producer's declared contract: the existing resolver-schema shape, given an optional `constant` flag. The goal text is never read.
          - Named interim cost: most shapes declare no contract yet, so bridges that carry a constant are refused until those shapes declare one. This fails safe, but it works against satisfying new shapes from existing state.
        - **USER RULING (qa session, 2026-10-16T22:04:34Z, relayed by qa): "Yes, through the process."** Build a binding slot for dispatch variables in the task executor, so that bridges the system authors bind the current goal's values instead of freezing one goal's values. This is the general fix behind 37d's interim refusal. It is one executor change, queued after the first two information items.
        - **CORRECTION to the D4 entry above:** RUN 1's goal at position 13 was NOT a novel shape. Its producer exists, and that call failed on transport, a case 36b covers. D4 has no counter-example on record yet. Its pass condition is unchanged, and it needs a genuinely novel shape in the draw.
          - **A capability lost without a gap:** read-only history shows that the walk's composite-authoring step, which handled genuinely novel shapes, was removed by an autonomous commit on 06-28, and no gap was filed. It is being filed now with a design to restore it (restore, never mint), as the enabler for D4. It is queued after the information items.
          - The class this exposes is a capability that decays with no detector to notice it. That is §7 step 2's E1, the decay detector.
        - **Information items:** I5 (autonomy recorded on closed gaps) is designed and approved under G1–G6. It reuses the existing read of the landing decision, adds no constants, and never turns an unknown into false. Correction to the survey: the sweep, not the landing close, is the only path that closes a gap as verified. **I5b**, a follow-on, carries the autonomy fact across nodes in the landing commit, because the ledger that holds it is node-local and the writer it touches is protected. **I1** (persisting the localizer's site) has its home in the existing check-supply tick. History shows that persistence was broken from its first commit, and a later repair dropped it.
        - **Latest-by dates** (set by qa, built by the coordinator; recorded 2026-10-16T22:05:49Z):
          - **Executor binding slot:** design by 2026-10-17T08:00Z, built and gated by 14:00Z, landed by 20:00Z. It is sequenced with D2 step 3's executor change, which is in the same file family.
          - **Composite-authoring restore (the D4 enabler):** history and design by 2026-10-17T06:00Z, built and gated by 18:00Z, landed by 2026-10-18T02:00Z.
          - Both land before the 2026-10-18T07:12Z settlement.
        - **The sibling sweep has started:** a read-only sweep of the autonomous-commit history, across the five vessels the lane writes to, for capabilities removed with no gap filed (deleted exports, resolver and route registrations, seeds, and cross-vessel shape calls). For each repository it reports the count over its denominator, removal versus refactor, whether the capability is still referenced, whether a gap was filed, and whether any detector covers the class. The class gap is filed with those numbers (§7 step 2, E1).
        - **The E1 class, sized** (qa's read-only sweep; recorded 2026-10-16T22:16:45Z):
          - Of 2,739 autonomous commits across the five lane vessels, **12 removed a capability that was still referenced or advertised.**
          - Only 3 of the 12 ever got a gap, all filed by operators, 10 to 110 days later. 2 are still unrestored: the walk's novel-shape authoring (06-28), and a detector stubbed to a dead endpoint while it was still advertised (07-24). 4 of the 12 were stale-base cutovers that overwrote others' work.
          - **No detector covers the class.** The class gap ("autonomous landings remove still-referenced capabilities and nothing notices") is filed for the system, linked to the older route-only gap without overwriting it. The stubbed-detector instance is filed too.
        - **USER STATEMENT (qa session, 2026-10-16T22:14:33Z, relayed by qa), verbatim:** "Rotation shouldn't be a blind reset of all learning"
          - It supersedes qa's earlier acceptance of an undercount after rotation. Rotation replaces the credential, never the trust history.
          - Autonomy stamps move to per-epoch asymmetric keys with key ids and a shaped public-key ring, so they verify on any node indefinitely. This folds in I5b.
          - Every learning artifact keyed on the rotating credential is audited.
        - **The federation-transport security hold** (in place since 10-09): the code for its lift condition landed on 10-12, but enforcement is not armed on any node.
          - The lift order is the user's: an operator-attested enforcement policy on each node, then unmasking, then verifying that a dial without credentials is refused.
          - Until then the hold is justified. Under the 10-09 rule that no hold is kept indefinitely, it needs a review date. qa proposes the user's decision on step 1, and the user is asked.
          - Meanwhile discovery must not advertise routes through a transport that a node keeps closed. That is the amended gap behind RUN 1R's transport failures.
        - **RUN 1R READING: 0/20 reached and trusted** (qa; recorded 2026-10-16T22:48:05Z). Attempt 1's one judge pass failed trust: the goal was truncated at its head where it was written, so its instruction never arrived. Attempt 2 reached 0 of 20. RUN 1 had reached 1 of 20.
          - **The funded LLM plane did not raise reach.** RUN 1's 5% was not an artefact of the credit outage.
          - Classes over 40 attempts: judge miss 12, producer declined 10, gap investigation graded as a write 8, admission refused 6, other write misreads 4, lane busy 0, false absence of a producer 0.
          - Every deterministic class held, as pre-registered. Lane busy fell to 0 after 32a. No judge miss flipped on the restored plane.
          - Transport failures appeared in at least 5 of 20 goals, all on one node. None of them decided its goal. The cause: a 1.5-second local health check missed under host memory pressure, the walk fell back to an unverified peer route through the closed transport, and the retry reused the same route. The gap is amended so that discovery does not advertise routes a node keeps closed.
          - **The judge-miss class (12 of 40) has no fix queued.** It is the next question. The deterministic fixes (36a, 36b, CHANGE-37, Part 0) are built and land next, and RUN 2 (a fresh draw with paraphrase pairs) measures them after they land.
          - A further gap is filed: the goal generator caps goals at 500 characters by keeping the tail, which drops the instruction when a goal lists many ids. It affects 2 of 47 goals in the pool.
        - **USER RULINGS (qa session, 2026-10-16T22:21:38Z, relayed by qa):**
          - **(1) "Accept 18:00Z gated." A DATE MOVES LATER, BY USER RULING.** Rotation-proof attempt signing (I5a′) moves from built and gated by 2026-10-17T10:00Z to built by 14:00Z and gated by 18:00Z. What moved: about 7 commits across two repositories, built alongside the other information items. Why: the user's 22:14:33Z statement replaced signing with the rotating key by per-epoch asymmetric keys held by the identity service and a public key ring. The design met its date. The closure count waits for it, because autonomy evidence cannot be trusted before the ring exists. Settlement keeps its margin.
          - **(2) "No rotation until ring lands." A hold on re-issuing operator keys.** Lift condition: the ring is live and both the pool attestation and the directed stamp verify on it. Review by 2026-10-17T18:00Z. Context: four stamps are keyed on the rotating node key and fail closed after a re-issue, while every learning posterior is keyed on organisation and user and survives rotation.
        - **USER RULING (docs session, 2026-10-16T22:47:07Z): "Now, between runs."** The node federation-transport hold (in place since 10-09) is lifted before RUN 2, in the user's order: an operator-attested enforcement policy on each node, then unmasking, then verifying that a dial without credentials is refused, with a credentialed spoke as the positive control. RUN 2's pre-registration names the changed network as a known difference from RUN 1R.
        - **USER RULINGS on the bootstrap (qa session, relayed by qa):** a security finding at the public bootstrap led to two rulings. Detail is kept out of the public record.
          - **2026-10-16T22:44:49Z: "Enforce now."** The bootstrap's ingress policy moves to enforcement, as an act the user runs, with a credentialed spoke as the positive control.
          - **User context in the same minute, verbatim:** "[the hub] is meant to be a public bootstrap for connecting to the overall network with your auth"
          - **2026-10-16T22:45:42Z: "Bootstrap = discovery/relay only."** Authenticated external callers get discovery, relay and routing. Shapes that spend the bootstrap's provider credits serve only its own organisation. A per-shape scope follows if the policy cannot express this.
          - The expectation is stated timelessly in FEDERATION.md *Design intent*.
        - **Builds and designs since RUN 1R:**
          - **I1 is built and approved.** Localization runs in the existing check-supply tick and writes the site and the localization record that admission already reads. Its must-fail, paraphrase and held-out controls fail on the parent and pass on I1. It is rebased onto the landed development-vessel tip and gates first.
          - **CHANGE-37 is rebased** off the deferred audit chain, with which it only shared a file, and is re-approved. The rebase caught a second G1 breach: 37c decided with a word list and a length threshold over the model's wording. 37c now decides structurally, with six paraphrased wordings as its control. Its dates hold.
          - **The I3/I4 design is approved,** on time.
            - I3: choosing what to work on next becomes a graded activity with two variants: today's hand-set score as the cold-start baseline, and a variant that ranks by fields already in the records.
            - I4: the per-class posteriors move to the shared store by writing through at the existing call sites. Each decision stays where it is, and only the storage moves.
          - **The executor binding-slot design is approved.** Task configs bind only explicit variable tokens, through the executor gate's one existing function, and bare tokens stay with the resolvers that already handle them.
        - **CHANGE-34's first by-effect sign:** the lane holds a lease on a gap the system detected whose edit site is the walk service's main file, opened tonight. That lease holds the walk-service chain at the push guard until it expires, and the push then retries automatically.
        - **The public bootstrap's federation ingress was switched to ENFORCE** by the user at 2026-10-16T22:54:41Z (recorded 2026-10-16T22:55:18Z). The operator-attested read-back is verified. The by-effect check is pending: the ratchet, the enforce-mode log lines, and our credentialed spoke still being served. The review of the 24 h log before the switch showed that no call from our own organisation would have been refused.
          - The finding behind the ruling is stated precisely: an uncredentialed external caller had been served in the preceding day, within one short span. It was not a continuing rate.
        - **READING: RUN 1R's judge misses are 11, not 12** (a read-only analysis by qa; recorded 2026-10-16T22:57:23Z). Position 1's first attempt was judged reached and then failed trust. Every cause is an existing mechanism that is unwired, behind the wrong gate, or in the wrong order:
          - **The tool-fallback floor never receives the walk's evidence, its reach reason, or its memory of the failure (4).** In two of these the walk had already found the root cause.
          - **Underspecified goals cannot ask (4).** There is no "needs information" outcome, and asking for clarification is graded as hollow.
          - **The wrong source answers "what have we learned" (2).**
          - **A goal truncated at its head (1),** already filed.
          - Also found: the reframe tries only its first alternative, retries adapt only after write-rule failures, and once the judge gave the same answer opposite verdicts.
        - **USER RULING (qa session, 2026-10-16T22:56:41Z, relayed by qa): "Yes, J1-J4 + judge check."** The four judge-miss items and a check of the judge's own consistency go through the process. They are ranked after the information items and before RUN 2, with design due by 2026-10-17T10:00Z.
        - **LATEST-BY dates to settlement** (set by qa; recorded 2026-10-16T22:58:14Z):
          - **J1–J4 and the judge check:** design by 2026-10-17T10:00Z, built and gated by 22:00Z, landed by 23:00Z.
          - **RUN 2** (a fresh seeded draw with paraphrase pairs and two attempts): its preconditions are the walk-service chain, CHANGE-37, I1, I4, I3 and J1–J4 all landed and converged, plus a clean plane check. **Earliest T0 is 2026-10-18T00:00Z,** with the hard close at 03:00Z and the reading by 04:00Z. That leaves about 3 h of margin before the 07:12Z settlement. If any precondition slips, T0 slips with it, and the record names which one.
          - **D4 (novel shape)** runs as its own short demonstration after the composite-authoring restore lands (by 02:00Z), from about 02:30Z to 04:30Z, in parallel with RUN 2's reading.
          - **D2 (closure)** runs over a window, gated by I5a′ (gated by 2026-10-17T18:00Z), not inside RUN 2.
          - **Stated risk:** one coordinator builds and gates everything through shared gate slots. The slip most likely to move T0 is the J items, which are the newest.
        - **USER RULINGS (qa session, 2026-10-16T23:11:27Z, relayed by qa; recorded 2026-10-16T23:12:25Z):**
          - **(1) "RUN 2 items first." A DATE MOVES LATER, BY USER RULING:** I5a′'s gate moves from 2026-10-17T18:00Z to about 2026-10-18T02:00Z. Why: there is a single gate lane, and RUN 2's preconditions go first.
          - **(2) "Yes, before RUN 2":** restore the walk's state-conditioned choice of recovery. The same autonomous commit on 06-28 that removed novel-shape authoring removed it, and recovery has picked blind to state since then (an E1 instance).
          - **(3) "Before RUN 2"** (over qa's recommendation of after): fix the light-dispatch caller budget. A fixed budget of 60 s with 3 retries aborts long tasks, wasting about 23% of execution time and spending on duplicate model calls. The budget is to be read from a shape, and cancellation is to be passed through.
          - **Consequence (set by qa): RUN 2's earliest T0 moves LATER, to about 2026-10-18T03:00Z, as a result of these rulings.** The hard close is shortened to T0 + 2 h: one attempt with paraphrase pairs, and attempt 2 only if it fits. The reading comes before 07:12Z.
          - **Docs note:** the user's goal is success "within one or two attempts". If attempt 2 does not fit, RUN 2 measures only attempt 1, and the record says so. It is not reported as the goal's measure.
        - **The bootstrap's enforcement is VERIFIED BY EFFECT** (run by the user, 2026-10-16T23:10:41Z). The ratchet is present, every mode line reads enforce, and our credentialed spoke is served under enforce (the positive control). Uncredentialed requests are refused. Some of them are likely one node's own replication now arriving without a key. That is the cross-authority follow-on, and replication is watched so it does not silently stop.
        - **DEMO-0 BASELINE dispatched** (about 23:12Z; pre-registered; original wording on both nodes; proposed by docs): the discovery (D1) and prioritisation (D3) goals run before the fixes, to give each fix a before and after.
          - **Deviation:** the mechanical paraphrase step itself failed in the system. "Rewrite the request…" was graded as a write goal, the class-B misread again. So the baseline uses original wording only, with no operator-written paraphrase. RUN 2's amendment P depends on that kind of step; see the next entry for how qa removed the dependency.
        - **USER RULING (qa session, 2026-10-16T23:12:36Z, relayed by qa; recorded 2026-10-16T23:13:30Z): "Yes, roots anchor too."** Every node, root or spoke, anchors to the public bootstrap with its own credential, through a shaped setting. It is a follow-on, not a RUN 2 precondition.
        - **RUN 2 risks raised by docs, now owned by qa:**
          - **Paraphrase:** no queued item fixes the "Rewrite the request…" misread. It is filed as its own class-B instance, owned by the structural J2 and read-rule work. RUN 2 does not depend on it: amendment P's paraphrases come from a direct completion call with the fixed recorded prompt (mechanical, not a walked goal). That change goes into RUN 2's pre-registration.
          - **Attempt 2 is kept.** If T0 is at or before 03:00Z, attempt 2 runs for every unit not reached and trusted, with pacing reduced to fit the close. If T0 slips, attempt 2 runs on a seeded half of the units (pre-registered: the units whose draw permutation index is even). "Within one or two attempts" is then still measured, on a random half. Running only attempt 1 is a last resort, and the record would say so.
          - **Replication:** a count taken at the receiver is requested before RUN 2. qa's expectation, stated in advance: zero both before the lift (the egress was masked) and after (refused without a key). If that holds, the lift did not regress replication, and the cross-authority follow-on owns it. **Docs note:** zero before the lift would mean evidence has not been replicating between authorities at all. That is §7 step 6's exit ("one address, replicated evidence") not met, and the record keeps it visible.
        - **DEMO-0 BASELINE READING** (all terminal by 2026-10-16T23:18:08Z; pre-registered; reading by qa; recorded 2026-10-16T23:18:52Z):
          - **Discovery (D1): 0 of 2.** One node listed problems but recorded no gap. The other listed them incompletely. Recall against today's hand-found defects is 0.
          - **Prioritisation (D3): 0 of 2 under the pre-registered predicate.** One node was judged reached but **failed trust:** it made a single pick, justified by the severity label and impact in prose, with no ranking, and it read none of the stored demand, landability, cost or dependency fields (no picker reads them today). The other node failed. The pick itself was sensible, a real grading defect, so the information exists but is not read from shaped fields.
          - **Both answers came from the tool-fallback floor,** which answers from the goal and its seeds only. That is the J1 class.
          - This is the pre-fix baseline that the information items and J1/J2 are measured against. It is re-measured after they land, with paraphrase pairs.
          - **Why discovery missed (raised by docs, confirmed in the walk logs by qa; recorded 2026-10-16T23:20:13Z):** on both nodes, target inference mapped D1's text to a single LLM-completion target with no alternatives. The gap shape never entered the candidate set, so the system's existing detectors, which file hundreds of gaps a week from traces, were never selectable. D1's 0 of 2 is a selection miss, not a missing capability.
            - Neither A2b-proper (which re-ranks a proposed set) nor J1 (the floor) covers it. It is **named item I-T, a target-inference information gap:** candidates must come from the advertised shape catalogue and its descriptions, structurally, with no keyword (G1). It is a D1 precondition, ranked with the J items.
            - **I-T's latest-by dates** (set by qa; recorded 2026-10-16T23:21:08Z): design by 2026-10-17T10:00Z, built and gated by 22:00Z, landed by 23:00Z, the same as J1–J4. It is one commit to the walk service, in the same serialised lane.
            - **Trade-off, decided in advance by qa under the user's 21:56:40Z ranking by demonstration value:** if the lane cannot take everything, I-T displaces the judge-consistency check (the last J item, already named first to slip), which moves after RUN 2. I-T then keeps D1's re-measure slot before settlement. If this happens, the record states "judge consistency displaced by I-T (a D1 precondition)". Docs note: without that check, RUN 2's reading relies on the trust check to catch any inconsistent judge verdicts.
              - Agreed and pre-registered for RUN 2 (qa; recorded 2026-10-16T23:21:57Z): if the consistency check is displaced, every unit the judge reaches gets a trust verdict from qa before it counts. A judge pass on a goal whose instruction is missing or truncated is a trust fail by rule.
        - **A known transitional effect of tonight's transport lift and the bootstrap's enforcement:** a walk on one node can pick a peer route at the bootstrap that refuses a call without a key. The refusal is pooled as content and judged hollow instead of triggering a fallback. It is low-frequency so far. The reachability item is amended to classify it, before RUN 2.
        - **FINDING: evidence has not crossed authorities for at least 3.5 days, so §7 step 6 is NOT MET** (measured at the receiver by the coordinator from a read-only node journal; raised by docs; recorded 2026-10-16T23:20:48Z).
          - The root node has stored **zero** rows replicated from the network hub across its whole retained journal: about 3.5 days and 2,619 pull results, none of which stored anything.
          - When it stopped predates the journal. The likely cause is the 10-09 transport containment hold, whose masked egress refuses every pull, which fits 3.5 days of connection failures. That is unproven, because the watermark lives in the database.
          - **The silent zero is itself a defect.** Tonight the failure changed from a connection failure, to a 502, to a timeout, and then to "pulled 0 stored 0" with no warning. Replication reports success while storing nothing (the class "a silent skip reads as a pass"). The reachability item's part (d) logs it as cross-authority once it lands.
          - **The containment hold of 10-09 had no lift condition or review date for a week,** and it silently disabled replication across authorities. That is the case the 10-09 ruling ("no hold is kept indefinitely") exists to prevent.
          - The other direction, the hub storing rows from the nodes, is being measured at the hub (a read the user runs through deployment), with our credentialed spoke as the expected positive control.
          - Fix owners: the cross-authority dial gap and roots anchoring, both filed, after RUN 2.
          - **Extended: measured at both ends, in reads the user ran** (recorded 2026-10-16T23:33:48Z):
            - **The hub's replication has never attempted a pull in its retained journal (5 days).** Every line reports zero peers discovered.
            - The root's pulls stored nothing for 3.5 days, and since tonight the hub's enforcement refuses them, because the root holds no hub-issued key. All the replication requests the hub received in the last 24 h came from the root, and all were refused. Enforcement is working as designed.
            - **Learning evidence crosses authorities in neither direction, and there is no positive control:** even the spoke anchored at the hub does not replicate to it.
            - Two independent causes. The hub's replication finds zero peers (the cause is not yet read; a history pass is requested). The root has no credentials (roots anchoring, ruled at 23:12:36Z).
            - **§7 step 6 is not met in either direction.** The fix ranks after RUN 2 unless the user moves it.
          - **CORRECTION, from the coordinator's read-only history pass** (recorded 2026-10-16T23:37:40Z). It supersedes the "neither direction" and "no positive control" lines above:
            - The spoke role runs no local trace store, so its traces are written directly to the hub. **Spoke evidence does reach the hub,** by direct write rather than replication. The hub's "zero peers" is correct for a spoke.
            - **The real gap is between the root and the hub.** The root's last successful pull from the hub was on 2026-08-22, about 8 weeks ago. There is no evidence the hub ever pulled from a foreign root.
            - **Root cause: the credential across authorities.** A key the hub did not issue is refused at the hub's register and replication endpoints, so the root's row never reaches the hub. Since tonight its pulls are also refused under enforcement.
            - **Why it went unnoticed for 8 weeks:** the silent zero is logged at info level with no shaped observation, so nothing in the system could see it.
            - Two gaps are filed (the silent zero, and the credential across authorities, multi-site), ranked after RUN 2.
            - **§7 step 6: NOT MET for roots** (root and hub, about 8 weeks). Spokes write directly.
        - **Builds approved since** (qa):
          - **J4:** failure memory feeds target selection, in observe mode only, because with learning on it would be counted twice.
          - **The light-dispatch budget (5 commits), before RUN 2 as ruled.** Building it surfaced two defects worth more than the fix. **(i)** The development vessel advertises the same 10 s budget for every shape. Using it would have cut model calls from 60 s to 10 s while the tests still passed. The budget now comes from the task's own timeout and is never below today's 60 s. The blanket advertisement is filed as its own gap. **(ii)** The vessel's request handler drops the cancellation signal, so passing cancellation through would have done nothing on its own.
          - **I-T's shape (qa decision):** the cause is a shortcut, not missing vocabulary. A shortcut for explanatory prose matched D1's text and answered before the model ran, and it was the one shortcut missing the guard the others have. The model also sees shape names, never their descriptions. Three parts are built together: **(a)** restore the missing guard (one line and no new wording rule, but named as debt); **(b)** give inference the shape catalogue with its descriptions, the structural fix, whose contract an existing red test already pins; **(d)** add the missing descriptions for the gap and memory-note write shapes. (a) is retired once (b) alone handles D1 and its paraphrases, including wordings that slip past the guard.
          - **I4 does not depend on this path** (qa; the coordinator is confirming the holder map). I4 writes and reads through the gap store's own forward route, a direct resolve to the holder, not activity-api replication. **Its claim is scoped:** it agrees across nodes that share a holder. The root node is its own holder, so it reads its own posterior and logs "separate authority" (a held-out case). Sharing learning across authorities stays replication's job. If any node's store route turns out to go through the federation egress, this becomes the user's decision.
            - The forward route's address comes from an environment setting. That is the pinned-endpoint case listed under §7 step 6 (law 1). I4 works on it, but it does not remove it.
            - **CORRECTION, holders measured** (deployment, without reading environment settings; recorded 2026-10-16T23:25:22Z): there are three gap stores. The root holds its own, and the second node writes into the root's store by direct HTTP, not into the hub's as first stated. The spoke and the hub each hold their own. **I4's same-holder group is therefore the root and the second node.** The spoke and the hub are separate authorities. No route uses the federation egress, so the dial fix is not an I4 precondition.
            - So RUN 2's units on both of its nodes share one holder's posteriors. Learning from the spoke and the hub reaches them only once replication across authorities works.
        - **A self-recovery defect** (filed by deployment): self-recovery counts a vessel as installed only when its unit name matches its source directory. A vessel whose names differ runs unwatched, and nothing restarts it if it dies. Measured: the federation transports on the root and on the spoke. The class is the same as the silent replication zero: the system's own watcher skips a target without saying so.
          - **qa decision: build it now** as super-repo glue through Gate P, not the vessel lane, so nothing in the queue slips. The decision stands on the measured exposure at the spoke and the root. The fix should match a vessel by its registered identity, not its directory name, and carry a must-fail for a vessel whose names differ. It was pushed at 2026-10-16T23:44:10Z.
          - **CORRECTION** (measured in a read the user ran at the hub, 2026-10-16T23:46:20Z; recorded 2026-10-16T23:47:06Z): the public bootstrap's transport and relay were **never** unwatched. On the hub profile they are rendered into the unit directory and counted as installed. An earlier inference that the bootstrap was unwatched, and so a dead join path, was wrong and is struck. The real exposure was only on nodes that run the baked transport without a rendered unit: the spoke (measured) and the root (since tonight's unmasking).
          - Open, and separate if confirmed: the relay unit declares no health port, so self-recovery may never probe it, whatever its installed state.
            - **Confirmed and filed, after RUN 2:** the relay is excluded from self-recovery by explicit declaration (no health port, self-recovery off). A crashed relay process is still restarted by the service manager, but a relay that stays up and stops granting reservations goes unnoticed. That may explain the spokes' many unattributed "no reservation" failures, which are being attributed.
        - **qa decision (about 23:5xZ; recorded 2026-10-16T23:50:16Z): the per-organisation goal-path change is REVERTED on its dev branch,** after it landed at 21:34Z.
          - Why: the system's own landing gate held it on the root (a test file stops loading in the gate's environment), so dev and the running node disagree. Two RUN 2 preconditions stacked above it would stay held with it: the budget fix's trace fields and the reachability fix.
          - The revert lines dev up with what runs. The change re-lands as a fresh commit once the parity cause is found and fixed.
          - No behaviour regresses: the target-selection reader counts only rows keyed per organisation, so it starts cold either way.
          - **Definition, asked by docs and set by qa (recorded 2026-10-16T23:50:49Z): "landed" means landed AND effective, verified by effect, never code only.** So A2b-proper's learned target selection now depends on the per-organisation change re-landing.
            - **The per-organisation change re-lands by these latest-by dates:** the parity cause found, fixed and gated (a harness matching pull-sync's count on the same tree) by 2026-10-17T08:00Z, and landed and converged by 10:00Z.
            - **A2b-proper's 12:00Z "landed" date holds only with that.** Its by-effect check: (1) a goal-path record writes per-organisation counters to the activity store, and (2) target selection's read logs non-empty per-organisation rows for a goal class it has run. Until both are observed, the record says "A2b-proper code landed (inert: per-organisation rows absent)", not "learned selection done".
            - **A known condition of RUN 2:** even once effective, selection starts cold for each organisation and accrues with runs, so RUN 2 measures it near cold.
        - **The 10-02 landing went around two guards, not just hollow** (coordinator; recorded 2026-10-17T00:01:03Z). It landed while its gap's own check was still red, and despite an operator ordering hold that named that exact fix. It got through a route (a proposal landed as a patch, then a cutover across variants) that runs neither the own-check gate nor the hold check. No damage is measured yet. This is the class where the system lands its own change past refusals that already exist.
        - **USER RULING (qa session, 2026-10-16T23:59:15Z, relayed by qa): "Before RUN 2."** The bypass route now enforces the same own-check and hold rule as the main lane, one rule, before RUN 2. Docs note: the closure demonstration counts the system's own landings, so a landing through an unguarded route would have credited exactly what it is meant to exclude.
        - **USER RULINGS (qa session, 2026-10-17T00:00:17Z, relayed by qa):**
          - **"Build now, before RUN 2":** the edit-intent router sent goals that forbid changes ("don't edit <file>, just tell me …") to a compose that lands. Measured: no structural guard stopped them before a landing. This is the safety half of I-T's part (ii), moved up from after RUN 2. The router now reads the existing prohibition predicate, with no new wording rule (G1, G3).
          - **"Include canonicalization":** one normalisation step for goal text (curly quotes to ASCII), shared by every predicate that reads goal text.
          - **RUN 2's T0 may move slightly LATER for these, by the user's ruling. T0 is pending the lane sizing, due about 2026-10-17T01:00Z** (recorded 2026-10-17T00:02:08Z). The rule: T0 is the lane's end plus about 30 min for convergence, the hard close is T0 + 2 h, and the reading takes about 20 min, all before the 07:12Z settlement. The lane is bound by builds rather than gates until the afternoon, so the two small safety builds may gate in the morning slack and T0 may not move at all.
            - Options docs raised, decided by qa: **landing the safety builds inside RUN 2's window is rejected.** The user ruled them before RUN 2, and landing them would restart the walk service on the nodes mid-run, a confound. **Parallel lanes** are a fallback only, capped for load and logged, because the lanes were serialised for load-sensitive tests. **A shorter RUN 2, with attempt 2 on the seeded half,** is the last resort. It is decided and put to the user before T0 if the sizing requires it. If even attempt 1 does not fit, the user decides what to cut.
        - **LANE SIZING** (coordinator, from measured gate costs; recorded 2026-10-17T00:04:28Z): gating every RUN 2 precondition commit by commit would end at about 10:00–11:00Z, after the 07:12Z settlement under any T0.
        - **USER RULING (qa session, 2026-10-17T00:03:52Z, relayed by qa): "Option A + RUN 3 later."**
          - Linear stacks are gated once per stack. Each commit keeps its own must-fail evidence, and any new failure is bisected before the push.
          - **MOVED LATER, by user ruling, to after RUN 2,** and measured by RUN 3 (the same design with a fresh draw) once they land: J1 (the floor sees the walk), J2 (asking instead of guessing), I-T's structural part (the described shape catalogue), and the judge-consistency check. Their earlier latest-by dates were built and gated by 2026-10-17T22:00Z and landed by 23:00Z. Whether those dates also move, because the lane gates them after RUN 2's items, is pending from qa and recorded when set.
          - **Kept for RUN 2:** both safety fixes, I-T's guard and descriptions, the information items, CHANGE-37, the state-aware recovery, the budget fix, reachability, J3 and J4.
          - **RUN 2: T0 about 2026-10-18T04:30Z, MOVED LATER from about 03:00Z** as a consequence of the 23:59:15Z and 00:00:17Z rulings. The hard close is 06:30Z and the reading lands by about 06:50Z, which leaves 22 min of slack before settlement. If a re-gate uses the slack, attempt 2 runs on the pre-registered seeded half.
          - **Consequence, stated plainly: RUN 2 does NOT measure the fixes for the largest failure class (judge misses, 11 of RUN 1R's 40 attempts). RUN 3 does.** The settlement reading therefore cannot show reach near the expectation of about 90% within two attempts, unless the kept fixes alone move it that far.
          - **Dates for the displaced items (set by qa; recorded 2026-10-17T00:08:35Z):** building continues on the old schedule (built by about 2026-10-17T22:00Z). Gating waits until after RUN 2's window, because the lane holds during RUN 2. They are **gated by 2026-10-18T10:00Z and landed and converged by 11:00Z, a date MOVED LATER by the 00:03:52Z ruling.**
          - **RUN 3** (the same design: a fresh seeded draw, paraphrase pairs, two attempts, and the trust check): **T0 latest-by 2026-10-18T12:00Z, hard close 14:00Z, reading by 14:30Z.** Its preconditions are the four displaced items landed and converged, plus the per-organisation change re-landed, so that learned selection is effective.
        - **USER RULING (qa session, 2026-10-17T00:06:11Z, relayed by qa): "Gated stack may push over it."** Since the walk service's main file was opened to the lane, the lane leases it almost continuously. A fully gated operator stack may now land over a live lane lease on that file. The lane's attempt re-stages, and each preemption is logged. Ad-hoc pushes still fail closed.
          - Docs note: every preemption delays one of the system's own attempts on the file it was just given. The preemption log is therefore also a measure of how much operator work displaces the system's own work. The headline (a landing the system originated and verified) is read with that count beside it.
            - Agreed (qa): every reading (RUN 2, RUN 3, the closure window) reports the real preemptions in its window, meaning log entries whose push range matches a confirmed push, with dry runs excluded. A system attempt re-staged by a preemption is reported as displaced, not as a system failure. If preemptions are frequent, the closure demonstration states that it under-measures the system.
        - **Protecting the two RUN 2 safety tests** (qa decision): the router's safety test and the landing-admissibility test join the protected paths, so the lane cannot weaken either rule by editing its test. The scope record write is the user's act on each node, and the matching super-repo record is qa's. Like any operator scope edit, it resets the lane's count of runs without operator edits (§7 step 9), and the reason is recorded.
        - **USER RULING (qa session, 2026-10-17T00:56:45Z, relayed by qa; recorded 2026-10-17T00:57:36Z): "Move to 10-17 ~09:00Z." RUN 2's T0 MOVES CLOSER.**
          - **RUN 2: T0 latest-by 2026-10-17T09:00Z, hard close 11:00Z, reading by about 11:20Z.**
          - **Condition:** every kept RUN 2 item is landed and verified by effect by 08:00Z, and qa's pre-registration is written. Otherwise T0 falls back automatically to 2026-10-18T04:30Z (close 06:30Z, reading 06:50Z).
          - Why: with stack gating, the kept items are projected gated by about 03:40Z and landed and converged by about 05:30Z, about 23 h ahead of the recorded T0. Docs raised it after qa corrected a peer message that had read 04:30Z as 10-17. The recorded date was always 10-18.
          - RUN 3's date at the time of this ruling was T0 latest-by 2026-10-18T12:00Z. Docs asked for the sizing to be re-run on the real dates, so that RUN 3, and with it the judge-miss fixes, could also move before the 07:12Z settlement. The next ruling decides it.
        - **USER RULING (qa session, 2026-10-17T01:00:02Z, relayed by qa; recorded 2026-10-17T01:02Z): RUN 3 MOVES CLOSER.**
          - **RUN 3: T0 latest-by 2026-10-17T20:00Z, hard close 22:00Z, reading by 22:30Z.** This is before the 2026-10-18T07:12Z settlement, so the settlement reading includes the judge-miss fixes.
          - Plan: the judge-miss items (J1, J2, the structural part of I-T, and the judge-consistency check) are built during the day while the gate is busy with RUN 2, and are gated right after RUN 2's window closes at 11:00Z. They are landed and verified by effect by about 18:30Z.
          - **Condition:** those items and the re-landed per-organisation change are landed and verified by effect by 19:00Z, and qa's RUN 3 pre-registration is written. Otherwise T0 falls back to the recorded 2026-10-18T12:00Z (close 14:00Z, reading 14:30Z).
          - This replaces 2026-10-18T12:00Z as RUN 3's primary date. The coordinator's sizing on the real dates is due at about 03:00Z and is recorded as a reading when it arrives.
        - **The first build of I-T's structural part was withdrawn at review** (qa, after docs' challenge). It had an in-code threshold labelled temporary, with no owner or review date, and a lexical rule whose tests all shared words with their targets. Agreed corrections: a threshold is read at use time from a shaped value, with the code value as bootstrap default only, and its replacement by a posterior is a filed gap with a review date; a word-matching rule is a named limitation that zero-overlap controls must expose.
        - **User statement (qa session, 2026-10-17T01:11:12Z):** "The architecture documentation already has an understanding about what the approach should be. We must consider how many shapes there will be in the future." Showing every shape description in every prompt grows with the catalogue, so I-T is redesigned as recall by meaning: a bounded set of candidate shapes is recalled from the concept store and from the nearest learned goal paths, and the model chooses only among those. The bound comes from tuning state. Needs in a compound goal are recovered by multi-vector recall, not by splitting on punctuation or conjunctions. A control at ten times today's catalogue must keep prompt size flat. When recall is unavailable, the fallback is recorded in the decision and counted in the reading.
        - **USER RULING (qa session, 2026-10-17T01:13:45Z, relayed by qa): "All four, RUN 3 at 10-18 ~02:00Z".**
          - **RUN 3: T0 latest-by 2026-10-18T02:00Z, hard close 04:00Z, reading by about 04:30Z,** before the 07:12Z settlement. It measures J1, J2, the judge-consistency check and the recall-based structural part of I-T.
          - **Condition:** all four landed and verified by effect, the per-organisation change re-landed, and qa's RUN 3 pre-registration written, all by 2026-10-18T01:00Z. Otherwise T0 falls back to 2026-10-18T12:00Z.
          - This is later than the 01:00:02Z ruling (10-17 20:00Z), by the user's explicit choice after being shown that option, and earlier than the originally recorded 10-18 12:00Z. The pre-registration carries each item's gate order and its own latest-by, so a slip shows on its own date.
        - **New shapes** (user question in the qa session, 01:14:42Z: "What of new shapes?"). Decided (qa and coordinator, docs' points adopted):
          - Shapes that appear later are indexed when they are advertised, minted or first seen in traces, and a new shape starts on the existing uninformed prior, with any exploration share read from tuning state.
          - A goal whose target shape does not exist gets a needs-information outcome with a novel-shape reason (J2's vocabulary, not a parallel outcome). The system then tries to satisfy it from existing state through the composite-authoring restore (D4's enabler), and the ribosome extracts a template on reach.
          - The test is a crossed pair, plus a paraphrase of each: a goal that shares words with an existing description but needs a new shape must read novel, and a goal sharing no words that an existing shape satisfies must read not novel. Only a decision on meaning passes both.
          - **The composite-authoring restore moves closer:** landed and verified by effect by 2026-10-17T23:00Z (gated by 21:00Z), from 10-18 02:00Z. The survey found the parts already exist (a disconnected path, existing registration events, and a broken description store that is repaired, not duplicated), and it projects landing at about 15:00Z.
        - **USER RULING (qa session, 2026-10-17T01:28:02Z, relayed by qa): "Ask me at the time".** RUN 3 has no pre-set drop order. If any of its items will miss the 01:00Z condition, qa brings the specific choice to the user when that item's own latest-by slips. The order qa and the coordinator had agreed is withdrawn as a rule; it may be offered as one option.
        - **Date check (qa, from records, 2026-10-17T01:4xZ):** MET: I5 and I1 designed by 02:00Z, I3 and I4 designed by 06:00Z (both built early), and the composite-authoring restore designed by 06:00Z. Pending, to be reported as met or missed: the executor binding-slot design and the per-organisation parity fix gated, both by 08:00Z. The per-organisation re-land is blocked by a stale uncommitted edit in the gate's working clone, not by its own code; restoring that clone is a user step.
        - **USER RULING (qa session, 2026-10-17T01:49:43Z, relayed by qa): "Fix before RUN 2".** A cross-organisation isolation defect in a shared store was confirmed in code (detail is kept out of this document). The fix is approved, and it is a RUN 2 condition: landed on every node by 08:00Z. A follow-up ships in the RUN 3 stack, and any miss it could cause in RUN 2 is pre-registered as its own class. Four security gaps were filed, with owners and review dates in the gap store; one of them is the user's.
        - **USER RULING (qa session, 2026-10-17T02:31:53Z, relayed by qa): "RUN 2 at 09:00Z w/o I3/I4".**
          - I3 and I4 failed their gate with new failures, confirmed on a second run rather than read off a loaded host. The causes were side effects (a read that wrote, a path outside the state root, a moved write), not the ranking. The repair is designed and approved.
          - RUN 2 runs without them, and their target classes (prioritisation as a graded, learned choice; class posteriors and closure credit in the shared store) are pre-registered EXPECTED UNFIXED in RUN 2.
          - **I3 and I4 latest-by:** built by 2026-10-17T12:00Z, gated by 19:30Z, landed and verified by effect by 22:30Z, inside RUN 3's 01:00Z condition.
          - The hold-bypass safety fix still applies to the reduced stack with identical patches (verified by qa). The rest of RUN 2's stack projects gated by about 05:55Z and live by about 06:30–06:45Z. RUN 2's T0 and its 08:00Z condition are unchanged.
        - **FINDING (coordinator, about 02:40Z; checked read-only by qa): test runs during gates have been writing fixture data into one node's live learned state** (the gap-closure calibration and the gap-class posteriors), because the test environment redirects the workspace but not those stores. It is long-standing, and no clean backup exists. This is the recurrence of a known class (a test suite mutating live state), so durability (law 7) failed here.
          - **USER RULINGS (qa session, 2026-10-17T02:49:22Z, relayed by qa): "Clean what's provable" and repair "Before RUN 2".** Back up first, remove tonight's test artefacts, and strip only entries the test source proves are fixtures. The gap-closure calibration is left as it is and pre-registered as a CONTAMINATED INPUT for RUN 2. The gate's test environment redirects every learned-state location, and a detector refuses a suite verdict if live state moved during it; promoted on every node by about 06:30Z, as a RUN 2 condition.
          - **What the contamination touches** (qa, from code): only the gap-landing verdict reads that calibration. The reach gate and the judge do not, so RUN 2's reach and trust grading are not on the contaminated input. Gap closures and landings inside the window are flagged in the reading. A second learned file written during gate windows (the landing-prediction baseline) is checked the same way.
        - **Gaps filed tonight, apart from the security ones** (review 2026-10-24 unless stated): the trace store's evidence floor protects every graded row with no bound; the landing gate runs candidates in a dirty or detached clone without refusing; a non-idempotent writer pasted a declaration repeatedly into a vessel clone; discovery advertises no input contract, so target validity can only check advertisement (a law-8 reach item); selection tuning is a file, not a shape, so the walk cannot observe or learn it (law 1); a gap's detection time can be written ahead of its creation and cannot be corrected; an import-time environment read makes replication tests depend on file order.
          - **Reading rule:** gap latency is measured from the earlier of detection and creation time, and the affected rows are listed in each reading.
        - **RUN 2 PRE-REGISTRATION WRITTEN** (qa, 2026-10-17T01:1xZ, in its working record, before any frame, draw or dispatch), with amendments, each separately stamped: dispatch order of each paraphrase pair seeded per unit; the seeded-half second attempt under either T0; a new class for goals aborted at the light-dispatch task budget; goals overlapping test fixtures excluded; the landing rule's by-effect read is never a live re-run of the cutover test; the class I3 and I4 target is expected unfixed; the contaminated calibration is an input flagged in the reading. Every text drawn in earlier runs (61) and the new builds' fixture texts are excluded from the frame. The record's sha, the frame and draw shas, and T0 are recorded when frozen.
          - The user's scope act protecting the two safety tests must be done by 07:30Z (C2(c)). The super-repo pin twin is already pushed and promoted.
        - **The scope act and the leak fix** (recorded 2026-10-17T04:5xZ): the user's scope act was written and verified by effect on two nodes (03:38:56Z, 03:42:03Z), with both safety tests excluded and every earlier exclusion kept. On the bootstrap the first credential presented was refused and nothing changed; the act was then **completed there at 03:50:09Z** with that node's operator credential, read back and verified by effect (the lane's own policy read shows the new entries contained), tighten-only. **CORRECTION (recorded 2026-10-17T05:27Z):** an earlier version of this line said the bootstrap act was still to be re-run; it had already completed when that was written. The leak fix (redirecting learned state during test runs, and flagging a live state file that moves) was accepted on all four nodes at 04:07:22Z.
        - **An unprompted system attempt** (coordinator, about 04:02Z): the system tried to decompose a class gap on its own. It guessed a file path that does not exist, and its own validity check refused the step. The safeguard held. The miss is information at the right time (law 8): the gap named a component but no file, and a code search would have found one. It is left for the system, and the closure demonstration counts localisation by guessed path against localisation by search.
        - **Gap-store routing: three user rulings in sequence** (qa session, relayed by qa):
          - **2026-10-17T04:16:13Z, "Fix before RUN 2"**, on a diagnosis that slow gap reads were routed to a peer's copy of the store.
          - The coordinator then retracted that diagnosis. qa verified in the deployed selector that the local producer is already preferred; the slow reads were most likely write contention under test load. **2026-10-17T04:41:23Z, "Fix the label before RUN 2"** (only the advertisement).
          - The coordinator then showed that the label alone is unsafe: the policy is set per vessel registration, not per shape, and a pinned copy wins over the local one, so it would misroute (verified by qa). **2026-10-17T04:47:53Z, "Build the full fix before RUN 2":** a per-shape distribution policy with holder identity in discovery. A producer that holds a shape's data declares it, routing reads that metadata for any shape and never a list of shape names, a node with no holder of its own reaches its designated holder and no other peer, and the routing record names the producer chosen and flags an advertisement that contradicts what the producer serves.
          - The user was shown that this moves RUN 2 off its 09:00Z T0, and chose it. **This is a date moved later by the user's explicit choice.**
        - **USER RULING (qa session, 2026-10-17T04:48:25Z, relayed by qa): "One merged run, 10-18 02:00Z".** With RUN 2 off 09:00Z, RUN 3 would have run first, and the two could no longer measure separate change sets.
          - **ONE pre-registered run: T0 latest-by 2026-10-18T02:00Z, hard close 04:00Z, reading by about 04:30Z,** before the 07:12Z settlement. It uses a fresh seeded draw, paraphrase pairs, two attempts and the trust check.
          - It measures everything landed and verified by effect by 2026-10-18T01:00Z: RUN 2's set, the routing fix, J1, J2, the judge-consistency check, the recall-based structural part of I-T, and I3/I4. It is governed by the RUN 2 pre-registration with its amendments plus RUN 3's additions. Any item that will miss 01:00Z goes to the user at the time (the 01:28:02Z ruling).
          - This supersedes RUN 2's 09:00Z date and RUN 3's separate date. The other options shown were two runs before settlement (RUN 2 about 11:00–13:00Z, holding RUN 3's landings until it closed) and RUN 3 first with RUN 2 as a repeat. Per-item effect is read through the failure classes.
          - **The scope act is complete on all three nodes** (03:38:56Z, 03:42:03Z, and the bootstrap at 03:50:09Z), so the two safety tests are protected wherever a lane runs. **CORRECTION (recorded 2026-10-17T05:27Z):** this line had said the bootstrap act was still due by 01:00Z; it was already done.
          - **Per-item predictions (amendment M-1, qa; written before any frame or draw),** against RUN 1R's class shares:
            - goal-direction misses 20% → ≤5% (36a);
            - producer-declined 25% → ≤5% (CHANGE-37);
            - the investigation-as-write class 15% → ≤5%, and other target misses 10% → ≤5% (I-T with recall; valid only if the degraded tier is ≤20% of dispatches);
            - judge misses 30% → ≤15% (J1–J4 and the judge-consistency check);
            - asks are ≤15% of attempts, and at least half of them are justified (J2);
            - budget aborts ≤2, ordering effects ≤1, transport ≤2.
            - **Headline prediction:** at least 25% reached and trusted by attempt 2, with original and paraphrase within 10 points of each other.
            - Declared NOT ATTRIBUTABLE in this run, so verified only by their own must-fail and by-effect checks: the safety fixes, I3/I4, the leak fix, the scope act, the shape-index trust and the discovery writes.
            - The prediction is a pre-registered falsifier, not the target. The acceptance target is unchanged: every random goal reaches by attempt 2, with no false reach (§15, the user's 05:49Z goal, and CLAUDE.md's ~90% reach expectation regardless of priors). A reading between the prediction and the target is progress, and is reported as NOT MET.
        - **USER RULING (qa session, 2026-10-17T05:59:46Z, relayed by qa): "Yes, earliest-T0 trigger". The merged run's T0 MOVES CLOSER.** Proposed by docs. T0 is the first moment ALL of these hold, latest-by 2026-10-18T02:00Z:
          - every item landed and verified by effect;
          - at least 1 h since the last landing;
          - the frame, the draw and the frozen paraphrases done after the last build commit is written, so the fixture-overlap exclusion covers every build;
          - the final learned-state cleanup, with zero fixture keys just before T0;
          - the LLM-plane check passed.

          The time each condition is met is recorded, and nothing about the drawn units is looked at in choosing T0. Projected T0 is about 2026-10-17T22:00–23:00Z, with the reading about 2026-10-18T01:00Z, three to four hours earlier than the latest-by.
        - **Latest-by dates tightened (amendment M-3, qa):** docs found that the recorded margin mixed projected and latest-by times; the last items were latest-by 23:30Z, 1.5 h before the 01:00Z condition. Now the judge-consistency check is built by 2026-10-17T20:00Z and landed and verified by effect by 22:00Z, and the per-organisation re-land is landed by 22:00Z, so a slip reaches the user with at least 3 h left.
        - **Novel-shape authoring: a mint must be earned** (qa condition on the composite-authoring wiring; laws 3 and 4, a wrong mint is negative value). A composite minted on validation, before it has ever reached, is provisional: if its first run does not reach, it is not offered to ordinary selection. A reached first run makes it a normal activity. A live check requires that a paraphrase of a novel goal, run after the first paraphrase's mint is described and indexed, recalls and reuses that shape rather than minting a second.
        - **The activity-api revert stack is landed** (pushed 2026-10-17T07:04:18Z, verified): the per-organisation change taken off the working branch, plus the trace-storage fix and the replication fix.
          - **USER RULING (qa session, 2026-10-17T07:02:39Z, relayed by qa): "Allow, one-time"** — a logged one-time exception to the push guard's "no gate run in flight" rule, because the run in flight was the gate re-testing the commit the push removes. It was armed and not used (the guard passed in a natural gap) and has been removed again.
          - Its comparison showed one new failure, in the check that concurrent posterior updates match serial ones. An interleaved comparison of the stack's base and tip (three runs each, alone) passed every time, as did both full suites, so the only failure was one run under heavy load inside a full suite. **INCONCLUSIVE**: the stack pushed on its clean record, per the rule stated beforehand. The suspicion that concurrent updates to one template can lose or misapply credit under load is filed as unproven (review 2026-10-24), and it is raised to high if a reproduction under contention shows it.
        - **USER RULING (qa session, 2026-10-17T07:10:42Z, relayed by qa): "Accept ~1 h slip, keep full gating".** The latest-by for the already-built merged-run items to be gated moves from 2026-10-17T09:00Z to 10:30Z (amendment M-4), with gate scope unchanged. **A date moved later by the user's explicit choice.** The cause: the gate re-tested the held, unchanged per-organisation candidate every ~12 minutes until the revert landed, holding the build queue at its load threshold, and the diagnosis waited on that same load. A gap is filed for re-testing an unchanged held candidate (law 5: pace by conditions, not by tick). As a mechanical consequence (amendment M-4a, not a further move), the landed-and-verified latest-bys of the same batch move by the same amount: the routing fix and the recall-based needs recovery are landed by 11:30Z. Unchanged: novel-shape authoring by 14:00Z, its tests and live check by 16:00Z, the judge-consistency check built by 20:00Z and landed by 22:00Z, the per-organisation re-land by 22:00Z, everything verified by effect by 2026-10-18T01:00Z, and T0 latest-by 02:00Z.
        - **REFUTED by effect: the earlier cause given for the per-organisation hold.** The stale edit was in a different copy from the one the gate tests, which was already clean. Removing it (the user's act) took out a real stray edit, which is kept as evidence for the repeated-writer gap, but the hold persisted. The cause is being re-diagnosed.
        - **FINDING (the database session's read-only investigation, cause confirmed in code by qa): learning has been mostly frozen.** **[RETRACTED on measurement, 2026-10-17T10:24Z — see the correction below.]** The dispatcher that runs most tasks labels every task deterministic, including tasks that call a model, and the learner deliberately skips runs whose tasks are all deterministic. Over 24 h, only 9.4% of learning decisions wrote anything (2,298 against 22,165 skipped). The core loop (traces are the learning substrate) has been silently off for most executions, and nothing in the system reported it.
          - **USER RULINGS (qa session, 2026-10-17T07:17:12Z, relayed by qa; amendment M-5), both proposed by docs, both merged-run scope added by the user's choice:**
            - **The tier fix is a REQUIRED merged-run item.** The dispatcher reports the resolver's real tier, not a fixed label. It goes to the lane first, with a coordinator fallback at 13:00Z, landed and verified by effect by 16:00Z. Prediction: the write share of learning decisions is at least 30% over the 2 h after landing. The reading compares second-attempt rescues with RUN 1R. The detector (law 6) is the write share served as a readable shape, with a shaped floor that files a gap when it is crossed.
            - **Concept-store recall health is diagnosed now, read-only.** Its own health report shows most meaning-based searches returning nothing, and word search broken for weeks. If the failure is systemic, the fix is a merged-run item landed by 18:00Z, before the freeze.
          - The merged run's 01:00Z condition and 02:00Z latest-by are unchanged.
        - **USER RULING (qa session, 2026-10-17T07:40:04Z, relayed by qa; amendment M-5a): "Fallback 09:00Z, live by 12:00Z". The tier fix's date MOVES CLOSER** (proposed by docs: the fix's value to the run is the hours of learning it has before T0). The lane's attempt made no real progress: it found the right file, but drew its grounding window from mined identifiers near the top of the file rather than from the sites of the value the goal quoted, anchored its plan far from them, and its own check was cycling. The coordinator builds from 09:00Z, landed and verified by effect by 12:00Z, and the write-share prediction is read from about 14:00Z. The lane miss is recorded for the closure reading.
          - **Second drafter-localisation miss tonight** (after the 04:02Z guessed path): a goal that quotes an exact value should ground the draft at that value's occurrences. This is information at the right time (law 8), and a gap is filed for it.
        - **USER RULING (qa session, 2026-10-17T07:41:35Z, relayed by qa; amendment M-6): "Yes, live by 18:00Z".** Proposed by docs. Lane localisation becomes a required merged-run item, landed and verified by effect by 18:00Z, before the freeze.
          - Grounding includes the occurrences of literals the goal quotes, found by the lane's existing code search (reuse, law 3), ahead of the mined-identifier window. The anchor guard refuses or relocates instead of proceeding anyway.
          - **By effect:** the queued lane goals, held until it lands, draft at the named sites. Prediction: at least 3 of 5 land a verified fix before the freeze, against none landed by the lane tonight.
          - Those goals were written by operators, so a landing from them counts as lane closure. It does not count toward the headline (a system-originated landing with no hand-fed gap); that still needs a gap the system found itself, closed by the system.
        - **What counts as the system closing its own gap (qa, recorded before any pickup):** only a gap the system filed itself, closed by the lane with no operator-written goal and no hand-armed site, verified by the gap's own falsifier by effect. For a "live state file moved" gap, a valid close attributes the write to the live vessel through the write-log comparison; excluding the file, narrowing the watch or suppressing the flag is hollow. The lane-closure prediction (M-6) is read at T0 (amendment M-6a), because the queued goals go out only after the localisation fix lands at about 16:00Z.
        - **READING (qa's trace review of one node, about 07:00–08:20Z):** of about 26 real goals, 8 were judged reached, and only 1–2 of those were genuine. False reaches came where the model judge graded (it accepted partial progress on a cleanup goal, and dictionary answers to questions about the system), while deterministically graded reaches were genuine. The walk kept choosing producers it had graded strongly negative, although its log reported the suppression as holding. The development vessel timed out repeatedly, so goals needing a code change died there first. Questions about the system were not grounded in its own registry or concept graph. Learning also skipped a second path (the floor's executor labels its tasks deterministic too), path links were credited on exit status rather than reach, and several outcomes leave no record. Six gaps are filed.
          - **Amendment M-5b:** the tier fix also covers the floor's executor. The write-share prediction excludes task-less no-op calls.
          - **USER RULINGS (qa session, 2026-10-17T08:02:43Z, relayed by qa; amendment M-7), both proposed by docs:**
            - **Development-vessel responsiveness: "Measure, then fix if linked".** If the timeouts coincide with the gap store rewriting unchanged rows, the already-built fix (an unchanged write becomes a no-op) is a merged-run item landed by 14:00Z, verified by effect (timeouts and the vessel's load drop). Otherwise the real cause goes back to the user.
            - **Selection honouring its own evidence: "Yes: diagnose, fix by 16:00Z".** First find why suppressing negatively graded producers has no effect; then the selector and the floor both honour the suppression they already compute, with no new constants (the user's ruling that a hard-wired caller is an antipattern). Prediction: the share of failed walks that use a suppressed producer falls from nearly all to at most 20%, and second-attempt rescues exceed RUN 1R's none.
            - **CORRECTION and refinement (amendment M-7a, qa; recorded 2026-10-17T08:29Z):** the suppression is off because of the user's 2026-10-15T14:12:48Z ruling ("keep it disarmed"), made after a test round showed that a single global switch loses either way: a producer that rates badly overall is the right one for some kinds of goal. Docs' proposal and qa's 08:02Z framing both missed that ruling. The fix is per kind of goal, not a global re-arm:
              - a producer is judged by its record on the walk's kind of goal; with too little evidence it is not suppressed, and the global score is never used as a fallback;
              - it is skipped only when another producer can make the same output, and the trace records what would have been picked;
              - old mis-graded evidence needs no cut-off, because the scores already decay;
              - first, show that per-context scores exist for these producers under a key that matches the walk's kind of goal; if they don't, the growth goes to the user.
              - The test: in the earlier round, the goal that needs the overall-weak producer keeps it, and the goal it lost drops the producer that lost it. Still live by 16:00Z.
            - **The precondition failed, and its cause was measured (coordinator; qa):** the per-context rows for these producers are keyed by the input pool, and satisfier steps leave the pool empty, so each producer has a single constant bucket, which is the same as the global row. Writer and reader agree on that key; the context is simply never supplied. (A key mismatch between writer and reader was suspected first and is not the cause.)
            - **USER RULING (qa session, 2026-10-17T08:34:28Z, relayed by qa; amendment M-7c): "Build the key now, read post-run".**
              - Build a goal-direction key (the set of target shapes) under its own signature version, never mixed into the pool partition. Its reader stays inert until each bucket has at least 10 samples. A round-trip check through the consumer's own call is required. Landed by 2026-10-17T16:00Z.
              - Tonight's item is "live and verified by round-trip", not a reach effect. The prediction that failed walks using a suppressed producer fall to at most 20% moves to a post-run reading at 2026-10-19T12:00Z, once buckets have filled. **That reading moves later by the user's explicit choice,** because a new key cannot have evidence by T0.
          - **USER RULING (qa session, 2026-10-17T08:32:22Z, relayed by qa; amendment M-7b): "Re-measure, then profile".** The development vessel's timeouts are not linked to the gap store's rewrites (measured, a rank correlation of −0.11 with median latency). The cause measured on the earlier code is its event loop blocked for 17–64 s by silent CPU work. It is re-measured on the new code. If the stalls persist, a profiling script the user runs locates them, with a fix by 18:00Z; otherwise the timeouts are a named confound in the merged run's reading. The rewrite fix leaves its 14:00Z slot, and the freed time goes to lane localisation. No dates move.
          - **One class, four instances tonight: learning or health written where its consumer never reads it.** The tier label skipped updates; path links were credited on exit status; context rows carry a key their producers never supply; and the concept store's word search returned nothing for six weeks with no error, with the new health counter not yet read by anything. The class detector (law 6) is a graded activity. It writes a marker outcome on each learning or health write path and reads it back through the consumer's own call (never a shared helper, so that writer and validator cannot miss together), and it files a gap for each path whose read misses. It goes to the user as one item with the key fix.
        - **CORRECTION (recorded 2026-10-17T10:24Z): the "learning mostly frozen" diagnosis is RETRACTED on measurement.** Over 24 h on one node, only 1.7% of the dispatcher's tasks used a true model resolver; the rest are deterministic code, and skipping them is correct by the tier-restricted bandit design, which sends credit to the stochastic cell. So the 9.4% write share was mostly correct skips, misread as a defect. Docs carried that framing to the user, and the requirement was ruled on it. The real defects are narrower: the model calls themselves are labelled deterministic, and the floor's model-controller decisions are not a traced cell, so they have nothing to credit. The earlier tier commits are withdrawn, and one already landed is inert; its message carries the retracted framing, and history is not rewritten.
          - **Method rule (qa):** a skip count is evidence of a defect only once the skipped items are shown to be ones that should not have been skipped. This is the fifth instance tonight of a diagnosis read off a metric without checking what the metric meant.
          - **USER RULING (qa session, 2026-10-17T10:22:59Z, relayed by qa): "Full declared-tier fix".** Each resolver declares its tier at registration from its own definition, and discovery echoes it. The dispatcher stamps the declared tier at use time, and name lists become a fallback only. The floor records its controller decision as its own model-tier step. A round-trip check through the consumer is required. Built by 18:00Z and landed before T0; any part that misses goes to the user at the time. **This replaces the 12:00Z tier date (M-5a): the scope changed by the user's choice.** The verdict (amendment M-5e) is zero skips on model-containing traces plus posterior movement. The write share is reported only against the measured control band (5.2–23.7%), not against the earlier 30% prediction.
        - **The development vessel's stalls are located** (profile run by the user, 2026-10-17T10:13:57–10:22Z). The attempt ledger re-reads and re-parses its whole log file on every lookup, which is about a third of CPU time. The largest log is several megabytes and growing. The fix is an in-memory index with no behaviour change, landed by 18:00Z and verified by M-7b's measures. One restart of that vessel, about 09:22Z, is still unattributed.
        - **USER RULINGS (qa session, 2026-10-17T10:13:43Z, then 10:14:35Z "Keep the stack", relayed by qa):** the split of the routing fix from I3/I4 that docs proposed was ruled first and then superseded, because the routing fix depends on I3/I4's code. They land together; the concept-store, discovery and goal-host fixes land on their own as each is ready, and a slip of the routing fix's 11:30Z date goes to the user at the time.
        - **USER RULING (qa session, 2026-10-17T10:26:02Z, relayed by qa; amendment M-9): "Run impact first".** This is the build priority if something has to give, ranked by impact on the merged run: (1) the development vessel's ledger index; (2) lane localisation; (3) the declared-tier fix; (4) judge consistency; (5) the selection goal-direction key; (6) the floor's controller step; (7) the novel-shape live check; (8) the activity-api cache fallback; (9) the per-organisation re-land. Dates are unchanged unless something actually slips, and every slip goes to the user at the time. The concept-store recall fix is not ranked because it is already built and approved and is on its last gate.
          - Judge consistency at 4 does not weaken the reading: the merged run counts a goal as reached only when the system says it reached AND qa's trust verdict passes, so a system false reach cannot inflate the number. Judge consistency matters for the system's own learning signal. (Docs had argued it first, on the opposite reading.)
          - The split option the user ruled at 10:13:43Z came from the coordinator's list of options. Docs' part was the argument for unbundling, from I3/I4's own dates.
        - **The unattributed restart is attributed:** at about 09:21:49Z the self-recovery watchdog restarted the development vessel during a stall and left no breadcrumb. The missing attribution is filed as a gap (law 12: a restart nobody records confounds the readings around it).
        - **The first autonomous commit of the day** (2026-10-17T07:41Z, goal-host, no operator involvement): it adds only a check-first test for one gap, so it is the lane's first step, not a closure. It is the only autonomous commit across the vessel repositories since midnight. Whether the gap was filed by the system or by an operator is pending, and that decides whether a later closure could count toward the headline.
          - **M-8a (qa, pre-registered before any closure; found by docs): that check is a hollow falsifier.** The gap is that the floor's fallback generates a value where an exact procedure should be executed. The check instead asserts that an export exists and runs the procedure through it, so today it fails on a missing export (a shape failure, contradicting its own comment), and it would pass once any working export is added, whatever the fallback does. A closure verified by it counts toward nothing. Only a by-effect falsifier counts: drive the floor with the letter-count goal, and its trace must show an executed shell task and the correct output.
          - Law 6: the lane's falsifier-validity check should refuse a check that fails for shape or load reasons rather than for the defect. A gap is filed for it.
          - **The gap was filed by the system** (qa, from the gap store): the floor caught its own wrong exact computations weeks ago and filed a gap, which it then decomposed into this one, and neither carries an operator mark. **M-8b (pre-registered before any closure):** headline eligibility depends on who filed the gap and who wrote its goal, not on who dispatched the work that exposed the defect. A closure still counts only by M-8a's floor-driven falsifier.
        - **USER RULING (qa session, 2026-10-17T10:37:11Z, relayed by qa; amendment M-4b): "Slip to 14:00Z".** The routing fix landing together with I3/I4 moves from 11:30Z to 14:00Z, **a date moved later by the user's explicit choice**. A new must-fail test failed in the full scrubbed suite but passed alone. The coordinator's harness had compared the stack only with its own parent, where the test also fails, so qa's push check was the first to catch it; the harness now compares against the published branch. The cause is test isolation (a module fixes its store location at first import), not a defect in the code under test. The fix changes no assertion, and the test's stand-in holder now refuses any location outside the temporary area. If it is not green by 13:00Z, it goes back to the user. The merged run's T0 is unaffected.
        - **The concept-store-independent merged-run items were pushed at about 10:42Z** (discovery routing, so stateful shapes go to their holder; goal-host's recall-based inference, novel-shape wiring and needs-information outcome). **Verification by effect is pending:** each is recorded as landed only once its check passes on every node it applies to. The novel-shape live check is due by 16:00Z, and concept-store recall is on its final gate.
        - **READING (qa, one node, 24 h): all 212 dispatched traces that contained a model call were graded not reached.** Templates declare outputs by meaning, resolvers emit them under their own names, and the grade requires every declared name to be produced, so it can never pass. The verdict therefore carries no information. The declared-tier fix as built would have turned the successful model calls from skipped into learning that model calls always fail, which is worse than today. Its dispatcher part is held.
          - **USER RULING (qa session, 2026-10-17T11:00:25Z, relayed by qa): "Honest grading first".** The tier declarations land, and are harmless on their own. An interim grade posts a verdict only when it carries information: every declared output produced means reached, a task failure means failed, and anything else is ungraded. The stamping change goes on top of that. The output-contract fix comes after the run, with grading by whether each declared output was bound from an emitted impulse through the template's own wiring (no name-alias table) as the preferred direction.
          - **Amendment M-5h (pre-registered):** tonight the expectation is no skips on model-containing traces, failures from real task failures only, successes ungraded, and no success credit on model cells. A posterior that learns "model calls always fail" counts as a failure of the change.
          - **Law 6:** a verdict that stays one value over many traces is uninformative by construction. A detector that flags it, for any grader or activity, is filed. It would have caught this, as well as the always-reached self-tests and the mostly-empty searches.
        - **Status of the merged-run items, as of 2026-10-17T13:37Z** (each is recorded as landed only once its by-effect check passes on every node it applies to):
          - **Pushed, verification pending:** discovery routing; goal-host's recall-based inference, novel-shape wiring and needs-information outcome; the concept store's tenant scoping and search fixes; discovery's echo of declared tiers; and the dispatcher stack (budget abort, honest grading, tier stamping, and a test-isolation fix).
          - **Discovery's held-shape routing is scoped by effect** (qa): every node runs its own development vessel, so the case of a node with no local holder cannot occur in the fleet. The routing fix will be recorded as landed and effective for what can be observed (rows advertised as held with their holder, routing choosing the local holder, no extra connections), with the no-local-holder case verified by its must-fail tests only. Disabling a vessel just to exercise that case would be an intervention nobody asked for.
          - **A second concept-store defect was caught before it shipped:** the stored concept drops the field the shape indexer keys on, so with the search fix alone every sync would have re-created every description. The search revert goes first on its own, and the indexer fix follows. That fix keys on the stored description, and its test checks that a second sync creates nothing. It is reverted after landing if the table grows faster than newly described shapes across two cycles.
          - **Gate admission (amendment M-12, qa):** the "load below 8" rule held every gate while the database rebuilt its indexes on a 16-core host. Gates now admit work on the same memory- and IO-pressure check the update process uses. Every result records its load, the per-suite time limit stays, and qa reverts to a stricter rule if a suite times out.
          - **A deploy gate that cannot run holds the change** (verified; an older code comment said otherwise). One activity-api test file had never loaded since it was added, because it sat outside the test folder. Moved, it loads and passes, so the gate covers every file in that repository again.
          - **The interface-as-shapes change proposal was published** (docs only; user-ruled).
        - **The development-vessel stack was pushed at 2026-10-17T16:01:54Z** (routing advertisement with I3/I4, the stall fix's ledger index, lane localisation, the declared tiers and the leak guard; verification by effect pending). No exception was needed: the final full suite showed no new failures against the published branch, and the protected file's failures were shown to be pre-existing timeouts.
          - It came about two hours after its 14:00Z date. The work waited on qa's pending question to the user, which sat unanswered while qa was blocked. The delay was in the operator loop, not the build.
          - **USER RULINGS (qa session, 2026-10-17T16:03:18Z, relayed by qa; amendment M-15):**
            - **"Live by 18:00Z"**, the closer of the two options shown: the development-vessel stack live and verified by 17:00Z; the goal-host stack (goal-direction key, floor controller step, recall-name fix, plus judge consistency if the user's scope act is in) by 17:00Z; the novel-shape live check by 18:00Z. These replace the passed 14:00Z and 16:00Z dates, **later by the user's choice**. If the scope act is not in by about 16:40Z, goal-host goes without judge consistency, which follows by 20:00Z.
            - **"Restart just before freeze"**: the database grew by about 1.1 GB/h through the afternoon, on course to pass the user's 20 GB line by T0. The user runs the guarded restart once more at the pre-freeze slot, after the last landing, so the run starts on a fresh database, and earlier only if host swap runs low.
          - The concept store's indexer has worked on one node since about midday (an earlier count mixed in older data), so recall by meaning now waits only on goal-host's reader fix.
        - **Pushed, verification by effect pending:** the goal-host stack at 2026-10-17T16:41:29Z (goal-direction key reader, the floor's controller step, and the recall-name fix that unblocks the novel-shape live check); the activity-api stack at 17:22:54Z (the goal-direction key's writer, plus the test file that had never loaded); and the development-vessel fix that makes two-step composites mintable. Judge consistency follows separately, by 20:00Z, after the user's scope act.
          - **USER RULING (qa session, 2026-10-17T17:21:26Z, relayed by qa): "Extend to dev pushes until freeze".** The file-scoped exception for the one protected test file whose cases time out under load applies to every development-vessel push until the freeze. Each use is logged, and any other new failure still refuses. Fixing that file's timeouts is a protected-file edit, which comes to the user after the run. (The re-run of this push was clean, so the exception was not used.)
        - **FINDING (qa, its own miss): most of the learned gap-class table on every node is test fixtures.** The watch had counted a handful of exact fixture names, but tests write keys with random suffixes. Counted by proven prefix, fixtures are roughly 87–99% of the classes on each node. Learning about which kinds of gap to close has run almost entirely on fixtures. Every gap-class reading before the cleanup is marked contaminated (amendment M-1e), and "zero fixture keys at T0" is measured by prefix.
          - **The cleanup** removes only keys whose prefix a named test is proven to mint, cross-checked against every real gap. Two real classes that share a prefix are explicitly excluded. It backs up first, never deletes the file, cleans the gap-store holder first, and re-checks and retries; it stops if fixtures keep coming back. The user runs it in the pre-freeze slot, after the last development-vessel test run and before the database restart. If the hourly count rises after the leak fix is live, the remaining leak routes must be closed before the cleanup.
        - **USER RULINGS (qa session, 2026-10-17T17:44:08Z, relayed by qa; amendment M-19):** the remaining novel-shape checks run within 45 minutes of the composite-mint fix going live, **a date moved later by choice**. The remaining production leak route (the lane's test children) is fixed before the freeze as a reviewed protected-file change, so fixtures cannot regrow during the run. The activity-api stack is live, and its deploy gate covers every test file again.
        - **READING (novel-shape live check, 2026-10-17T17:54Z; amendment M-20): the D4 demonstration's first two parts pass.** For the first time, given a goal that no producer served, the system composed and minted a new two-step capability, described and indexed it, and reached the goal with real content. The third part fails as built: a minted composite's output is never offered as a recall candidate, so a reworded goal cannot reuse it and could mint a duplicate. That is filed. (The retire-on-first-miss branch was not exercised, because the first run reached.)
          - **Probes were not observe-only:** the cockpit sends the learning-mode flag in a field the walk does not read, so every probe today updated real learning. Their wording and topics are excluded from the run's frame (amendment M-20a), probes now set the field the walk reads, and the first one is confirmed.
          - **A reached walk also runs the floor and records a second reached execution,** so its credit is doubled. Readings count one outcome per dispatch, and a gap is filed.
          - **Goal-direction key:** the read side is confirmed on one node. The writer is proven by the round-trip check on dedicated marker arms that every reading excludes, the first instance of the consumer-path detector.
        - **USER RULING (qa session, 2026-10-17T18:18:12Z, relayed by qa; amendment M-21): "Build it by 21:00Z"** — the time-aware meaning-search rebuild, which had not started because builders went to the leak, composite-mint and novel-shape items. It replaces its 18:00Z date, later by choice. Meaning search runs as it did before today's regression, and word search works.
        - **The judge-consistency scope act is done on all three nodes** (the user's act, 2026-10-17T18:14–18:18Z; amendment M-22): each node's live record now protects the judge-consistency tests, verified by read-back and by the lane's own exclusion check, tighten-only. The dispatcher was restarted on one node by the user at about 18:14Z, which starts the tier-stamping reading window.
        - **USER RULING (qa session, 2026-10-17T18:22:00Z, relayed by qa): the human-surface same-origin fix lands before the run.** A second node's own surface page was refused as cross-origin because of a fixed port offset. The fix compares the request's own address and guards against DNS rebinding. **Landed and effective:** pushed at 18:26Z; on that node its own requests went from refused to accepted, and the run list loads, while the other node's page is unchanged and a rebinding request is refused.
        - **The first consumer-path round-trip checks pass** (the law-6 detector for "written where its consumer never reads"; added to the validation scripts):
          - **Declared tiers, end to end:** a declared model tier survives discovery and the dispatcher, and its posterior moves instead of being skipped.
          - **Goal-direction key:** a marker outcome on a dedicated arm, which every reading excludes, is written and read back through the selector's own query.
          - **The first live check of the model-call tier window passes:** two model calls are stamped with their declared tier, a success stays ungraded, and a budget refusal charges nothing (consistent with M-5h).
        - **The development-vessel fix for two more test-leak routes is pushed** (2026-10-17T18:42Z, every guard passing; verification pending). The lane's test-child route is still being built and lands before the freeze.
        - **New failure class, pre-registered (amendment M-1h, "fabricated person"):** a goal that needed input from a person had that slot filled by a non-human producer returning an empty result, was judged reached, and the learner credited the stand-in. In the run this is never a success and counts as a missed ask. The fix, after the run: enforce from the declared tier (human is a tier) and the shape's declared producer contract, never from names; a detector flags any reached trace where a human-tier slot was filled by another tier; and the learned credit is reversed (law 13: humans are resolvers).
        - **USER RULING (qa session, 2026-10-17T18:44:58Z, relayed by qa): "No: fix the test first".** Judge consistency passed every push guard except one test that failed in the whole-suite run and passed on the base. Evidence that judge consistency did not cause it: under the same gate conditions the base fails it too and the failure lists are identical (verified by qa); the coordinator reports it also fails when run alone on both commits (2 of 2 each). The user declined a one-push exception. The failing test's cause is fixed first (in the test or in the feed, whichever is wrong) and lands first, and judge consistency waits behind it. **Its 22:00Z landing is at risk;** if it cannot make it, the date goes back to the user early. Because T0 waits for the last landing to converge on every node, and for at least an hour after it (the 05:59:46Z trigger's conditions), the merged run's start may follow.
          - **Update (2026-10-17T19:20Z): the cause is found, and it is in the source, not the test** — a test could rewrite live state through a hard-coded path. The fix routes that path through a dedicated setting whose default is unchanged. Judge consistency is rebased onto the fix, so **its 22:00Z date holds** (the fix is expected through its gate at about 19:50–20:00Z, with judge consistency about ten minutes later). The per-organisation re-land no longer waits behind judge consistency: the two share no code, only the build queue's single gate slot, so it gates in parallel (proposed by docs). The critical path to T0 is now the source fix, then judge consistency.
        - **The installer-instructions correction landed** (2026-10-17T19:19:44Z): run the installer from an empty directory, never inside a clone.
        - **Every kept pre-run item is pushed (2026-10-17T19:55Z); convergence and the frame freeze come next.**
          - The last test-leak route was pushed at 19:36Z. The concept-store search fix was pushed at 19:28Z, and its post-landing window is read under the pre-registered revert rule. The per-organisation re-land was pushed at 19:54Z.
          - The source fix behind the user's "fix the test first" ruling was pushed at 19:55Z. Under the same isolation, the harm is shown at the parent and absent at the fix: a test could requeue and rewrite live dispatches through a hard-coded path. **Judge consistency was pushed right after it, about two hours ahead of its 22:00Z date,** with the user's condition met.
          - qa found that its own push guard had a fail-open pattern: an early-exiting match inside a pipeline under pipefail could report a refusal falsely, or a pass falsely. It is fixed in qa's scripts. The same pattern exists in the substrate's own scripts, where it could skip restarting a changed vessel, so it is filed as a system gap with a lint as its detector, for after the run.
          - The learned gap-class file is copied between two nodes. The direction of that copy is now known from the code: the node holding the shared table passes the whole table down, and the other node sends back only single-key updates. So cleaning the holding node first is safe, and cleanup success is judged on that node's table, the one learning reads. The cleanup now waits only for the last leak fix to be live on every node (one node's restart is deferred while work is in flight) and for fixture counts to stay flat across one watch interval.
        - **Amendment M-28 (proposed by docs, adopted by qa): the user's pre-run steps are triggered by events, not by the clock.** The fixture cleanup is brought to the user as soon as the last leak fix is live on every node and fixture counts stay flat across one watch interval. The database-restart decision follows it, with the latest growth slope. The freeze and draw run once the last landings are live and no further build adds fixture texts. If the user is away when a step is ready, T0 slips only by that wait, and the reading says so. **Projected T0 moves closer, to about 21:30–22:00Z** (last convergence about 20:15–20:30Z, plus at least one hour). The 02:00Z latest-by is unchanged.
        - **The concept-store search fix stays** (its pre-registered window): no harm and no gain. Every widening was skipped for lack of time budget, and the timeouts and dense hits did not differ significantly.
        - **READING (coordinator, with qa; amendment M-32): most goals get no shape candidates at all, on every run node alike** (about 60% over 3 h, on both nodes), and a positive control reproduces the miss across nodes under the same org. The cause is query coverage, not isolation or trust. Long goal texts relax to a single lexical term that misses the roughly hundred shape descriptions, and the dense leg keeps a top-K over the whole concept store, where shape descriptions are too rare to survive the filter. (An earlier reading that one node had its own store and that the misses were one repeating goal was corrected.)
          - **USER RULING (qa session, 2026-10-17T20:09:27Z, relayed by qa; amendment M-33): "Build it now, with always-run".** Proposed by docs. Shape-description recall scores the goal exactly against every shape description (a set of about a hundred rows), always for shape searches, merged with the lexical leg. It reads the same trusted rows, adds nothing to the frame, and does not touch isolation or the trust rule. It is a small change confined to the concept store.
          - **T0 moves from about 21:30–22:00Z to about 22:30–22:45Z, a date moved later by the user's explicit choice,** so that the recall-based target inference the user chose to measure is actually exercised. The 02:00Z latest-by is unchanged.
          - **Predictions, fixed before the build:** the cross-node positive control finds at least one candidate; the live no-candidate share falls from about 62% to at most 30% over the first 30 minutes, on at least ten walks; isolation and trust are unchanged. It is reverted only if search timeouts or concept-store errors rise significantly in its first 30 minutes (the same test as the concept-store search fix) or the positive control fails live. If the no-candidate share does not fall to 30%, that is reported as the fix not reaching the walk, not reverted.
          - **Pushed at 2026-10-17T20:51Z and live on the first run node at 21:00Z.** Before the push it was checked in that node's actual test order, where an earlier version had failed. First live check: the cross-node control goal, which previously got no candidates, now gets them in well under a second. The no-candidate share is read over its first 30 minutes.
          - **READING (2026-10-17T21:00–21:30Z): every walk now finds shape candidates.** No walk lacked shape candidates (none of 16, against about 62% before; the prediction was at most 30%). The positive control passed live, each shape search takes about 165 ms, and no revert condition fired, so it stays. This shows a candidate is found, not that it is the right one; the run checks per goal whether the inferred target shape was correct. The recall-based target inference the user chose to measure will now be exercised in the run.
        - **The per-organisation re-land is refused on the node, three times** (the update gate failing closed as designed: one more unattributed test failure). The coordinator's gate had passed it on a freshly built tree. The node's clone runs its tests under its own older installed dependencies, under which two test-database starts miss their start window. This is the fourth gate/node disagreement today, filed as a system capability gap: the node's own update gate runnable as a dry run on a candidate in that node's real clone, by the lane and by operators, with every disagreement counted. qa's push guard now requires node-tree evidence. A fix is pushed only if it passes on an exact copy of that clone, dependencies included, and the start-window limit is not loosened. If the fix is refreshing the node's dependencies, that is a change inside the container and goes to the user.
          - The option of running without it was written down before any decision (amendment M-34): it is an isolation fix, every run dispatch is in one organisation, and its target would be expected unfixed.
          - **USER RULING (qa session, 2026-10-17T21:05:53Z, relayed by qa): "Wait for aa-1".** The run waits for the per-organisation re-land; T0 is its convergence plus at least an hour, so it must land by 01:00Z to keep the 02:00Z latest-by. If no fix passes under the node's real conditions by 23:30Z, the date returns to the user then. (Running without it was offered as the recommended option, which would have allowed T0 at about 22:00Z.)
        - **The fixture cleanup ran** (the user's act, after the fixture counts stayed flat across three readings). The gap-class table on the holding node, the one learning reads, now holds only its real classes and no fixture keys, verified by direct read; the other local nodes are clean too. The bootstrap node's own check reported it clean too, but no independent read or later watch is possible there, and its leak was still active before the cleanup, so it may refill. The 20-minute watch continues.
        - **Amendment M-36 (the user's aim, relayed by the human-surface session; conditions set by qa):** the human surface's display-only changes land before T0 instead of after the reading, on condition that they land and converge before the per-organisation re-land (so T0 does not move) and that they touch nothing the walk or the grading reads. They were pushed at 2026-10-17T21:27Z after two rounds of fixes before the push (a commit author, and node names that must not reach a public repository). They went live on both run nodes at 21:32Z and 21:36Z, before the re-land, so T0 did not move.
        - **Stand-ins for a person (amendments M-1i, then M-1k; this supersedes M-1h's "never a success").**
          - **User question (qa session, 2026-10-17T21:46:09Z):** "Fabricating a person is necessary for closure on that shape. In order for the system to understand something, it needs to be able to, over a composition of activities, understand how the outputs are used and what makes an output usable for the shape. This continues in a 'loop' of the activity composition; raising or lowering the confidence based on the environment. Is this a supported statement?" qa answered that it is supported: a non-human producer of a person-input shape is a competing variant that earns its posterior through how its output is used downstream, provided the credit is attributed to the stand-in. The failure seen today was a dishonest grade (an empty stand-in output judged reached and credited as if a person had answered), not the existence of a stand-in.
          - **USER RULING (qa session, 2026-10-17T21:47:50Z):** "Label it; grade on usability". A unit where a non-human producer filled a person slot (identified by provenance, never by shape name) is labelled as such and graded on whether its output was usable. Empty or unusable output still fails, and the credit goes to the stand-in variant.
          - **USER RULING (qa session, 2026-10-17T21:51:06Z), verbatim:** "No: usability alone, A human interaction to the contrary puts the outcome into question, a human concurrance is fine. Sometimes it might be justified to act on its own, other times it should get provenance from the right human at the right time. Same as everything else in the system." Docs had proposed an exception for goals where the person is the authority (consent, approval, their own preference). The user declined it. There is no authority exception: every such unit is graded on usability. A person's contrary observation makes the unit CONTESTED (reported separately, not counted as reached), and a person's concurrence confirms it. Whether to act alone or to seek the right person is learned selection, not a gate. The reading reports, per unit, whether a person was sought, with the source/authority split as description only.
        - **The per-organisation re-land landed** (pushed 2026-10-17T22:57Z, live on the holding node at 23:11:26Z with its migration applied; the other run node does not run that vessel). The cause of its refusals was a test that left a fake network function installed for later test files, through which the test database's health probe passed in the node's own test-file order. The fix is test-only: the test database helper no longer uses the shared network function. The leaking test, and the tests that passed only because of it, are filed as a test-hygiene gap.
        - **USER RULING (qa session, 2026-10-17T23:38:31Z, relayed by qa): "Run as is; fix after".** Docs had proposed dropping the target-inference cache after a not-reached attempt, so that a second attempt could choose differently. The coordinator's measurement showed that this would only buy a fresh model sample: target selection already re-runs on every ask, and the learning that should steer a second attempt away from a failed target logged no decisions in six hours because it has no evidence rows. That is the obstruction to repair after the run. The reading reports, per second attempt, whether the targets changed (amendment M-39).
        - **USER RULING (qa session, 2026-10-17T23:46:39Z, relayed by qa): "Restart before T0"** — the holding node's database, which qa had recommended skipping since its memory had levelled off. The user ran the guarded restart at 23:50:29Z. It came back healthy, every vessel on that node answered its health check, and resident memory fell sharply. Under the recorded rule, T0 is at the earliest the restart plus 30 minutes, about 00:20Z, later than the landing bound of about 00:11Z. **The frame is frozen.** The random draw is done, with a seed from the operating system's random source: 20 goals, 14 from real traffic and 6 from open gaps. Their paraphrases are frozen for 19 of the 20; for one, a gap reference did not survive rewording twice, so that unit runs its original text only.
        - **Pre-run safety finding (user ruling, qa session, 2026-10-17T23:59:31Z, relayed by qa: "Start the run; file it").** The router's safety check passed as registered: a "do not change anything" request was not sent down the code-landing path on either node. But on one node, target inference chose a write shape for "explain what would change in a file, but do not change anything", and the walk twice tried to edit the live file. Only the development vessel's workspace-root guard stopped it, so nothing changed. None of the drawn goals asked not to change something. Negation-blind target inference reaching a write is a post-run priority gap, and every write attempt in the run is flagged in the reading.
        - **User rulings relayed by the deployment session (recorded by qa):** admission is needed both within one namespace and across namespaces, designed from prior art; nothing should stay operator-only; and the deployment session's forks are for measurement and analysis. **Amendment M-40 (user ruling):** one node's federation transport stays as it is through the run. Its own charter's exit checks were never run after it went live, so the reading names the unverified checks as a condition, and the user runs reviewed scripts for them after the close.
        - **THE MERGED RUN: T0 2026-10-18T00:20:52Z, closed early at 02:03:18Z by the user's ruling** (every unit was terminal except one stuck unit, recorded as not finished).
          - **Result: 4 of 20 goals succeeded by attempt 2 (20%; 95% Wilson interval 8.1–41.6%),** where success means reached at the gate AND passing qa's trust check. Attempt 1 alone gave the same 4. **Attempt 2 added no new goal.** By stratum: 4 of 14 real-traffic goals, and **0 of 6 open-gap goals.**
          - **Against the pre-registration:** the target (every goal by attempt 2) is NOT MET, and so is the expectation of about 90% reach. The pre-registered falsifier (at least 25%) is MISSED by one goal: the fixes did not do what was claimed, at least not enough to show in reach. Against RUN 0 and RUN 1 (1 of 20 each) and RUN 1R (0 of 20) this is a probable improvement rather than a proven one, since the interval overlaps the baseline at its low end. Several changes landed today, so no single cause is attributed.
          - **The judge is the largest single class:** 16 of 22 gate reaches failed the trust check (wrong referent, hollow answers, wrong conclusions drawn from stale or contradicting sources, and a write where an investigation was asked). The reached-command cache replayed one judge-credited wrong answer at attempt 2, so credulity compounds.
          - **Attempt 2 could not change course:** target inference repeats, and the target selector has no evidence rows from not-reached outcomes (a condition recorded beforehand).
          - **Write actions:** one goal filed two gap records for a single ask, the second a duplicate.
          - **A system-generated follow-up** (decomposing a failed run goal) re-issued heavy whole-window trace scans back to back during attempt 2 (eight scans of a few minutes each, never more than two at once, for about 30 minutes), with no bound on re-issue and no per-request cost cap, so the database grew sharply. It was the self-development loop acting, without a guardrail, and the swap line for an early close was not reached.
          - **Paraphrase pairs:** two goals succeeded in both wordings, and two only in the original wording (phrasing-sensitivity findings).
        - **Next round (agreed by qa, the coordinator and docs; the coordinator sizes and the user gets dates).** The user's direction for this interval is autonomous operation. Each item repairs an EXISTING part, and the operator stays non-load-bearing:
          - **P1, unattended safety:** negation-blind targeting reaching a write; unbounded re-issue of heavy reads, with no per-request cost cap; a walk deadline and a cancel path; the reached-command cache replaying judge-only reaches.
          - **P2, judge credit:** the system's own grounded-report and verbatim-read checks already record disagreements with the judge, and those must discount or reverse credit, with each observer's weight learned through the existing observer calibration. qa's per-unit trust verdicts enter only as observations through the operator-feedback corpus, not as a gate.
          - **P3, open-gap goals (0 of 6), with the cause now localised:** the open-gap goals route correctly, but the existing gap decomposer failed every call. Its reply was either unparseable, and discarded unseen, or proposed steps naming files that do not exist or are protected, which its prompt is never shown (law 8). Separately, a paraphrase-blind parse of the gap reference leaves reworded gap goals ungraded and refuses every plain-language code-change goal at admission. That contradicts §3.0 of the execution-model document: identifiers travel as fields of the goal impulse, and human goals are interpreted, never pattern-matched.
          - **P4, target-selection evidence:** not-reached outcomes write evidence for the chosen target set, so a second attempt can move off a failed set.
          - **Then RUN 4:** the same design with a fresh frame and draw, its date as close as the repairs allow.
        - **CORRECTION (recorded 2026-10-18T02:12Z; the coordinator retracted its own pre-run measurement).** Two statements above are wrong: that the learning to steer a second attempt "logged no decisions in six hours because it has no evidence rows" (under the 23:38:31Z ruling), and that "the target selector has no evidence rows from not-reached outcomes" (in the run's reading). Target selection did log decisions from real evidence inside the run window, on both run nodes, including a target set with no successes and several failures that was chosen anyway. The measured obstruction to a second attempt changing course is:
          - the routes usually propose a single target set with no alternatives, and a per-goal cache makes that permanent, so selection has nothing to re-rank;
          - the existing step that avoids a failed target never fires, because its pattern does not match the wrapped failure reason, and structural failures are not remembered;
          - failure memory is a per-node file rather than a shape, so the nodes do not see each other's failures.
          - **P4 is restated accordingly:** extend the existing exclusion step so it recognises the recorded failure (from the structured reason, not a text pattern) and remembers structural failures; make failure memory a shared shape; and let the routes offer alternatives. The exclusion never removes a target that is the goal's only acceptable one.
        - **USER RULING (qa session, 2026-10-18T02:16:53Z, relayed by qa): "Public probe/echo".** The independent federation reachability probe was measured to be refused by the bootstrap node on every sweep since its inbound authentication went to enforce, so that checker was blind and filed false integrity gaps. The cause was that enforcement's public set left out the two control shapes the transport's own allowlist names as never refusable: the reachability answer and the echo round trip. Both become public, with a size bound on the echo, and the verification report stays credentialed. Rationale: neither shape exposes substrate data, and the probe is by design an unauthenticated outsider, so credentialing it would measure the wrong path. (This is a detector made blind by a change of its own environment; the law-6 question is what would have noticed a checker that is refused on every sweep.)
        - **USER RULING (qa session, 2026-10-18T02:24:41Z, relayed by qa): RUN 4 at 2026-10-19T04:00Z, "bounded".** The same design with a fresh frame and draw. It runs after these land (latest-by dates, 2026-10-18 unless stated):
          - the gap decomposer's missing inputs, 08:00;
          - the write-door rule for goals that forbid changes, 09:00;
          - the always-failing count query, 10:00;
          - the judge view clipping a goal's own target shape, 11:00;
          - banking a reached command on a single judge yes, 13:00;
          - duplicate gap filing, 13:00;
          - the retry when only one target set is offered, 18:00;
          - the gap reference carried as a structured goal field, 2026-10-19T02:00.

          The walk deadline and cancel path (2026-10-19T14:00) and the re-issue budget for heavy reads (2026-10-19T20:00) land after it, so RUN 4 applies its own registered limits: a unit is counted as failed after 45 minutes, the run closes early at fixed memory lines, and there are no hand cancels. The judge-credit and person-reliability repair is due 2026-10-20T20:00, and failure memory as a shared shape 2026-10-21T12:00.
        - **USER RULING (qa session, 2026-10-18T02:30:21Z, relayed by qa): "Earliest trigger, ≤04:00". RUN 4's T0 MOVES CLOSER** (proposed by docs): it starts one hour after every pre-run item has landed and converged on both run nodes, estimated about 2026-10-18T20:00Z, and no later than 2026-10-19T04:00Z. The gap-reference item splits:
          - its small half lands with the 18:00 batch: the grader reads the gap reference from the goal's structured field, which the producers already send, with the text parse as fallback;
          - its larger half lands later (about 22:00) and is not a precondition: a plain-language edit goal walks or decomposes instead of being refused outright. A plain-language edit goal drawn into the run is a named condition.

          The run's open-gap units carry the structured gap reference, as production does.
        - **FACT (verified on the published branches):** two commits authored by the substrate itself have landed on the working branch since 2026-10-17, with no operator hands. Both are failing-check files supplied for gaps, test-only and changing no runtime code. **Both are hollow** (verified against the published branches): each is red for a missing symbol it invented, not for the defect it names, so neither can be turned green by fixing its gap and neither landing advances a closure. The underlying class is the check writer drafting without the module's real exports in front of it (law 8), filed as a generator gap. One of them landed inside the run window, which the reading names as a condition (test-only, so no runtime effect). The headline (a system-authored commit that closes a gap the system filed, verified by effect) is still not met.
        - **USER RULING (qa session, 2026-10-18T02:35:48Z, relayed by qa): "Rebuild + recreate".** The public probe/echo fix is on the working branch but cannot take effect by convergence: the federation transport runs from the tree baked into the image, and in-place convergence of that tree waits on a behavioural fixture that is not built yet, so a converge only restarts the transport onto the old file. The user chose the supported path: a new image from CI, then a recreate of the bootstrap node and the public spoke, as a user act with a reviewed pre- and post-procedure. That procedure covers exporting the journal, the runtime state a recreate wipes, a volume backup, the enforcement ratchet and the firewall rule. Copying files by hand was declined. The convergence gap stands as the real fix (a code change must converge with the files it runs on, on every profile).
        - **USER RULINGS (qa session, relayed by qa):**
          - **2026-10-18T02:48:10Z, "Both: short renewal + sizing".** Since the previous day, every image had failed install acceptance on one gating check, because two dated coverage exemptions expired; boot was not affected, and every install-level check (live, seeded, served, usable) passed, so promotion had stopped. The exemptions are renewed for about 72 hours only, recorded as a gate widening and a temporary measure while the internals heal. Verified by effect when the next image passes acceptance and promotion resumes.
          - **2026-10-18T02:50:59Z, "Recreate from the digest": a GATE EXCEPTION** (docs advised asking). The bootstrap node and the public spoke are recreated from the unpromoted image built from the federation fix, whose only failing acceptance check is the expired exemptions, once its install-level checks are confirmed green on both container engines.
          - **2026-10-18T02:51:45Z: the owner-gap dates are accepted.** Restarting a unit onto an unchanged runtime tree stops by 2026-10-19T12:00Z; a fixture verifying unit files lands by 2026-10-19T18:00Z; and each tooling path gets a disposition (covered by a fixture, or left baked) by 2026-10-20T18:00Z. All of these come before the renewal expires at 2026-10-21T00:00Z, and the federation tree stays recreate-only until its own in-place convergence lands.
          - **2026-10-18T03:24:54Z.** Restart a run node's dispatcher, which had run since before the tier fix and so stamped every model task deterministic (the user restarted it at 03:27:41Z). And **the new gap, "a goal not admitted as a change still runs writes that are not files" (interface panels, concepts, code proposals), lands BEFORE RUN 4 and joins its start trigger,** instead of the proposed date after it.
          - The judge-credit and person-reliability repair is confirmed for 2026-10-20T20:00Z (relayed by the human-surface session).
        - **The write-door rule for goals that forbid changes landed** on both run nodes (pushed about 02:58Z, six hours ahead of its date): a goal reaches a file edit only if it was admitted as a change request.
        - **The host's shared temporary filesystem ran out of inodes** while its bytes were only 73% used, so shell writes on the operator host began to fail. The cause was about a hundred thousand scratch directories that test suites never removed, some over a week old. The user removed those older than 12 hours, and inode use fell to about a third. The class (suites leave temporary directories behind, inside containers as well as on the host) is appended to the test-hygiene gap, with a gate count of the temporary entries a suite leaves behind as its detector. Host disk monitoring stays an operator concern.
        - **The public spoke's recreate is VERIFIED** (2026-10-18T03:17Z): new image, the new rule in place, every unit back, every mask kept, every vessel healthy, relay reservation held. The post-check was hardened first (docs' point): a unit that a timer will start later counts as PENDING, not as a pass, so a unit file broken by the recreate cannot read as healthy. **Verified by effect:** in the first sweep afterwards, the reachability probes and echoes were allowed as public, the exact traffic refused before, with no false integrity alarms. The bootstrap node's recreate is next.
        - **CORRECTION of the run's attempt-2 database finding (recorded 2026-10-18T03:29Z).** The database pressure came from a run unit's own walk, which repeatedly re-requested a heavy shape with arguments it had synthesised itself. That same walk was the one that never finished. It was not solely a system follow-up. The heavy multi-minute reads were the walk's own direct requests for that shape; reads inside reusable activity templates were measured as fast. The existing re-request guard covers exactly those direct picks and still did not stop the repeats, which is under investigation. So the heavy-read limit's primary scope is the walk's direct requests, and counting reads inside templates is secondary (date unchanged). Separately, a system-generated investigation walk wrote an interface panel, a concept and a code-change proposal, writes that are not files, which led to the gap ruled above.
        - **USER RULINGS (qa session, relayed by qa), 2026-10-18 03:35Z to 04:32Z:**
          - **03:35:48Z: dates accepted for four newly filed learning-signal and visibility gaps,** none of them a RUN 4 precondition: the failed-impulse path by 2026-10-19T10:00Z, budget refusals by 2026-10-19T12:00Z, the parent link by 2026-10-19T18:00Z, and the schema check by 2026-10-20T12:00Z.
          - **03:36:50Z, "Let it run; revert if it lands".** A probe whose goal said to leave a file untouched was being turned into a real code change by the early edit-intent route, from wording alone. **Outcome:** the change was refused at admission, so nothing landed and there was nothing to revert. But the patch step had already run, so nothing was written only because admission refused it. The run was then graded "not reached", which was false, because the goal (leave the file untouched) was met.
          - **03:39:11Z, "Keep wording-based routing".** RUN 4 runs with the early edit route deciding by wording. Only the missed negation is fixed, and paraphrases that share no words with the edit cues are added as cases that must fail.
          - **03:42:17Z: observe mode must not write.** A new CRITICAL gap: a probe marked observe-only could still land code. The repair makes observe mode a dry run for anything that can write: drafts and diffs only, with no landing and no stored writes. The user ruled that it should come before the run, and added that reading the trace before acting would have shown that this probe reached and wrote no code. So a risk is judged from its trace before it is escalated.
          - **03:52:23Z:** the ribosome's replay judge, which scores below 0.5 on almost every successful run it re-grades, is to be repaired by 2026-10-20T12:00Z, not a RUN 4 precondition. **04:03:46Z:** dates accepted for three small learning-visibility fixes, none a RUN 4 precondition.
          - **04:14:14Z, "Both: args + successful path".** Runs on the fallback loop cannot become reusable templates today: their traces keep tool names but not arguments, and one failed tool call blocks the whole run. The fix records the arguments AND extracts the successful path. The dates for the three other new extraction gaps are accepted.
          - **04:23:03Z, three rulings.** (1) A single-step resolver that returns its declared shape on every path, errors included, gets **no verdict**, not "reached". (2) The 367 multi-step runs that succeeded but were graded "not reached" before the earlier grading change are **corrected through a traced re-grade**, not by editing scores. (3) **The light-dispatch grading fix moves before RUN 4** and joins its start conditions.
          - **04:30:09Z, "Must provide a permanent fix",** and **04:31:55Z, "No, don't wait".** One run node's goal-host loaded a private copy of the executor library from two days earlier, not the shared rebuilt copy, so no executor fix had taken effect there. The user declined a hand repair. The permanent repair applies to every vessel and every shared package on every pull-sync run: a private copy is swapped for a link to the shared copy, with the old copy kept aside and the vessel restarted only once it has nothing running; a copy that cannot be fixed safely is reported and filed as a gap, never skipped silently; and every check and repair is counted on the health page. It is due 2026-10-18T22:00Z and is **not** a RUN 4 start condition. **This narrows the 03:24:54Z ruling:** until the repair is live on that node, its executor-level door for non-file writes is absent, and RUN 4 records the two run nodes as differing. The goal-host doors stay on both. Steering write-capable goals to the other node was considered and not adopted, because it would bias the random draw.
        - **Readings and landings, 03:35Z to 04:32Z:**
          - **The light-dispatch fix was narrowed by qa before RUN 4.** As committed, it made every "not resolved" answer fail its task, not only budget refusals, and nobody had measured how many templates rely on a "not found" answer to let a chain continue. As applied, only budget refusals count as "budget exhausted", and a test confirms every other "not resolved" answer behaves as before. The wider rule is filed as its own gap with a four-step plan: count the cases, set expectations per template, mark the legitimate "not found" answers, then change the rule. Its first step is blocked because nothing records "not resolved" answers today: light-dispatch logs them as successes and stores no answer body.
          - **The validator fix and its template fix** are built and their tests pass, due 2026-10-19T10:00Z. The builder corrected its own earlier finding: without the template fix, the whole validator run fails at its third step, not just one task.
          - **The non-file-write rule's design is approved** (a RUN 4 start condition): one rule covers both kinds of write. Change actions are dropped at every door, and stored writes are allowed only when they are the goal's own product. **Its executor-level part counts as landed only by effect on each run node:** a probe whose change action is dropped at the executor door, shown in its trace. A merged change does nothing until the built copy that is actually loaded is rebuilt, which is how the stale private copy above was found.
          - **The first unattended-safety item is live on both run nodes,** and was confirmed working by effect on one of them.
          - **The replay judge does not gate extraction** (docs' suspicion was refuted by the code). **The extraction funnel on one node:** about 4,400 to 5,600 reached runs a day, 97 to 99% of them with no task records, so only about 100 to 220 a day can be extracted, and tens of activities are created a day. Runs with no tasks are skipped silently, and the fallback and satisfier paths record no task steps, which is what the 04:14:14Z ruling addresses.
          - **The trace-retention hold was lifted by the user on 2026-10-16** ("Build compaction, then lift"), so the large deletes seen since are expected pruning, not a loss.
          - **The bootstrap node's recreate is VERIFIED** (2026-10-18T04:32:31Z): new image, every unit back (76), every mask kept, every vessel healthy (14), federation enforce mode and its marker kept, relay reservation held, firewall rules identical. A cold copy of its volumes was taken first and is kept for rollback. The first post-check ran while the node was still booting and read NOT VERIFIED; the next one, PENDING on a timer-started unit, was correct; and the third, after the timer fired, was VERIFIED.
          - **The gap decomposer's repair is re-gated at an 840-second test limit.** Its last check timed out for the old version after 600 seconds at high host load, so there was nothing to compare against.
          - **Where execution time goes (one node, 24 hours):** 40% of execution time produced nothing useful. **21% of all execution time went to one goal that cannot succeed**, "bring the trace store back under its configured cap", dispatched about 10 times an hour: the protection rule for graded history keeps more rows than the cap allows. **All 52 of its "reached" grades were false:** the judge credited the steps while stating that the cap was still exceeded. That is evidence for P2, and the proposed check is the general form, comparing the goal's own measurable target against a fresh read, not a one-off for this goal. The stop is to land as soon as possible on its own: it reads the cap and the floor at use time and records why, and the general case (a goal that keeps failing for the same structural reason) is held back through the failure memory the generator reads, under P4. The template cache, which reloads every template about every 75 seconds because any single write clears it, is a separate fix. Host CPU pressure is what keeps deferring the test gates for the RUN 4 fixes, so this time is on the schedule's critical path.
        - **USER RULINGS (qa session, relayed by qa or docs), 2026-10-18 04:44Z to 06:3xZ:**
          - **04:44Z: two dates accepted.** Gap-store reads report when they are cut off, filter by key and count cut-off reads, by 2026-10-19T12:00Z. Writers reject unfilled templates and invalid values in any structured field, using one rule shared by the gap store and the human surface, with the stranded gap records corrected through the system, by 2026-10-19T20:00Z. That second gap had waited 17 days because it was excluded from the system's own repair work and had no check that could prove a fix; the reason is recorded and linked to the class of gaps that can never be closed.
          - **About 04:46Z (relayed by docs), "go ahead".** The autonomous-landing count is repaired before RUN 4. Measured: it counted every matching commit on every ref, including unpushed ones, so 27 substrate-authored commits since 10-10 read as 27 landings when they covered 20 gaps, 9 of which had only a check and no fix. The count becomes one landing per gap, credited only when the fix is on the remote working branch and the gap's own check is green; a check-only gap counts as "check supplied". **A second ruling: mechanism detail in public commit subjects and check filenames is not an issue.** The system is open source, so its defence is resisting harmful change, not secrecy.
          - **About 05:2xZ, three rulings.** (1) The decomposer's prompt gets the source inventory and the autonomy-scope list, and its reply cap is sized to the schema it is asked for: one commit, landed by 2026-10-18T12:00Z, a RUN 4 precondition. (2) The light-dispatch false-credit correction (retracting those grades to no verdict, through the existing compensation step and its ledger) moves earlier than proposed; its date follows. (3) The retry for hollow satisfier reaches must not widen to shell, HTTP or web tools when a single-shape check grades the goal: before RUN 4, a precondition.
          - **About 06:2xZ.** The first walk of a goal that failed before today runs with reuse switched off entirely. The repair, skipping only the specific commands that failed to run, lands **after** RUN 4: within 4 hours of its close and by 2026-10-19T12:00Z at the latest. RUN 4's reading reports it as a known limit on second-attempt success. The count of draws it affects, and the split of success by it, are fixed in the run plan before the run; unknown is never counted as zero. docs had recommended landing it before the run.
          - **About 06:3xZ: the cleanup's drain position becomes a RUN 4 gate** (the start waits), landed by 2026-10-18T13:00Z. Each pass currently re-reads the whole protected head of the trace store before it reaches anything it may delete. The measured reason: on the bootstrap node the cleanup re-entered about a minute after each pass, each pass ran about five minutes, stopped on its budget and deleted nothing, so the database was busy with it about 80% of the time; on one run node it was about 15 to 25%, overlapping the test gates. The position is kept with the trace store's own state, so the restart that follows every update does not reset it. Pass criteria are fixed in advance: rows are actually removed within three passes, with a stop reason other than the budget; the load falls; no protected row is deleted. The cheaper per-row check stays a separate item.
        - **Readings and landings, 04:33Z to 06:36Z:**
          - **The coverage-exemption renewal is verified by effect:** the first image built after it passed every install acceptance job on both container engines and was promoted, the first promotion since the previous evening.
          - **The public probe and echo fix is verified by effect on both public nodes.** Under enforce mode, the bootstrap node allowed 45 echoes and 6 probes as public after its restart, and the public spoke over a hundred; every one had been refused before. The federation checker can measure again.
          - **The bootstrap node's retention check passed twice:** the cleanup kept its lifted, non-dry-run setting across the recreate, and the protection for graded history is in the running code. **Both later restarts of its trace store were updates, not crashes:** pull-sync first restored the current code over the image's older copy, then applied a newly gated commit, each time stopping the service cleanly. Each start-up took about three minutes. The label pull-sync gives the first case ("truncated") is misleading after a recreate, and systemd's configuration is being reloaded about every half-minute there; both are low gaps.
          - **The light-dispatch fix and the shared-package link repair are pushed.** Only budget refusals now fail a task, and a counter records answers marked "not resolved". The link repair is soaking under the gate. **The decomposer's first fix is pushed**, three hours early. It is narrower than the whole repair: it localizes a gap that names no file, refuses before the model when nothing localizes, and keeps the raw reply when it cannot be parsed. Its effect is read per run node: no decomposer call is made with no file, every unparseable reply carries its length and tail, and the "names no existing file" failures fall to about zero. A nonzero success count is hoped for, not claimed.
          - **Where a goal's gap id comes from** (docs' point, adopted): the structured field first. A fallback that recovers an exact id from the goal's text runs **only at admission**, writes the field and records that it did so. Every later step reads only the field and fails loudly when it is missing, and a generator that leaves it out is a named finding. A lookup of this kind in a downstream step would still recover identifiers from prose, which the execution model forbids. The gap check also runs only when the goal carries a gap id, so ordinary questions that use the word "gap" are still graded.
          - **Reviews sent work back before it pushed.** One change would have stopped the system repairing a call that failed on bad arguments, by treating every server error as temporary, and removed an assertion from a protected test. The landing-counter repair would have read a path that does not exist and shown false zeros. The retry for a failed goal could drop a write the goal explicitly asked for. **The non-file-write rule refused real edit goals worded like "fix X without changing its signature"**, and missed a shape that can still draft a code edit. All are being fixed as follow-up commits and re-gate by about 13:00Z, inside RUN 4's latest start. Probes in observe mode report "not graded", not "not reached", and stop updating learning scores before the trial.
          - **A new substrate-authored commit landed** (05:30Z): a real source change, not a check, on a gap with two earlier landings in the same file. **The audit makes it not a headline instance.** The gap's root was written and armed by an operator, check first; the system did the narrowing, picking and landing. Its own check went from red to green, but only against a fake database. It broke a documented default: a request that leaves out the grouping field used to fall back to grouping by activity and is now refused with an empty, unmeasured answer, live. Its only reader never sends that field, so it still receives nothing measured. One of its new totals sums the wrong unit for a cost metric. Three sibling gaps carry the same check, now green, yet stay open and keep being re-picked. What to do about the broken default is the user's decision.
          - **A person's verdict on a run is kept and shown beside the judge's**, verified live: a "not reached" verdict was recorded as an observation, displayed next to the judge's "reached", and counted as disputed, while the training corpus refused it by provenance, as designed. The same run is P2 evidence: a question about this system's own files was credited for a generic answer that read nothing from the system. **Keeping verdicts only on the node where they are given is not intended:** the design makes a person a calibrated observer of the learner, and a node with no learner of its own currently sends such verdicts to no calibration. That is a low gap. **A pre-run check is added:** one probe that does not learn, on the run node without a learner, records which trace store holds its run and whether feedback on it is accepted. If not, verdicts for that node's runs are entered at the learner that owns their traces, or the reading names them as not entered.
        - **USER RULINGS (qa session, ledger times; relayed by qa unless stated), 2026-10-18 05:18Z to about 07:2xZ:**
          - **Correction to the batch above:** the three rulings labelled "about 05:2xZ" were recorded at 05:18:03Z. Re-grade phase 1 "before T0" falls between 05:18Z and 06:26Z. The labels on earlier relays ran late; these times come from the ledger.
          - **06:37:25Z, "Operator fix now"** for the audited autonomous commit. A request that leaves out the grouping field defaults to grouping by activity again, only a field that is present but unserved is refused, the omission becomes a must-fail case, and the new total becomes a row count. For the system: a detector for a landed change that narrows a documented default with no omission test, checked by the pre-land semantic gate, together with docs' point that the gate ran tests against a fake database and never ran the real reader. The sibling gaps whose checks are already green never close, because they are refused while another change holds the landing lease, before the existing "fixed elsewhere" mechanism can fire. The repair measures them at pick or lifecycle-scan time and retries a busy gap after the lease's remaining time, not every 45 seconds.
          - **06:45:03Z: the RUN 4 start estimate moves CLOSER, to about 15:30Z** (proposed by docs), from about 20:00Z. The rule is unchanged: one hour after every precondition has landed and converged. The latest start stays 2026-10-19T04:00Z. The observe trial runs inside the pre-start probe set as soon as observe has converged, rather than waiting for its own latest date. **The federation fix that lets those gaps close moves earlier** than 2026-10-20T12:00Z. **06:47:09Z:** its image is built and accepted before RUN 4, and the bootstrap node and public spoke are recreated before the start only if both are verified and converged at least an hour before it; otherwise after RUN 4, by 2026-10-19T12:00Z. The recreate scripts were first fixed (qa and docs reviewed them): one state directory per run, earlier backups never overwritten or deleted, no new run while an earlier one is neither verified nor rolled back, a boot that never reaches "served" read as NOT VERIFIED after 45 minutes, an unmeasurable volume treated as a failure, and the post-check confirms the running checker carries the fix. The fix counts as landed by effect only when the next sweeps close the open gap.
          - **07:00:11Z: the first slice of the judge-credit repair moves before RUN 4 as a precondition,** from 2026-10-20T20:00Z. It grades a question with a stated bound against a fresh read, and requires at least one real read before a question about this system's own state can count as reached. **The user accepted that the start estimate moves later for it, to about 16:00Z:** an explicit trade, not a slip. Because both the judge and the reach classifier change before RUN 4, the run is not a like-for-like trend against the previous one. qa's trust-checked count is the comparable series, and the judge's verdict before the new check is logged so that old and new can be compared.
          - **07:03:52Z: no autonomy arm in RUN 4,** and at the next ruling, asked for a lift condition, the user answered: **"Just don't do it."** The arm is **declined, not deferred**, so no lift condition applies, and the 48-hour autonomy count is withdrawn as a RUN 4 measure. The honest landing counter still lands as the metric repair. **The user's reason, given directly to docs, is a standing rule: "We should not run checks for long time periods if we know there are likely to be problems."** No multi-hour or multi-day window runs while a known blocker is likely to decide its outcome; fix the blocker, then run a short bounded check. It is applied: two 24-hour reads became 2-hour reads.
          - **Then: RUN 4 is 20 real-traffic goals and no open-gap units.** Drawing gap goals only from gaps the system found itself, with clean provenance all the way to the root, left a single family, and its check was hollow: it asserted an export whose name is a shape, not a function. A unit drawn from it could never be reached by fixing its gap. The decomposer is read in the pre-start trial instead. The registered expectation is 5 to 8 of 20 passing the trust check.
          - **Then: the check-writer repair lands before RUN 4, with the precondition stack and without moving the start.** An attach guard refuses any check whose referenced symbols are not real exports of the module, and the writer is given the module's export list. Its pass tests are registered: both hollow checks found so far are refused, a sound check on a real export still attaches, and the first system-written check after landing references only real exports.
        - **Readings, 06:36Z to about 07:30Z:**
          - **F-ARM, the headline for autonomy:** of about 3,600 open gaps, about 2,000 were detected by the system, but **none is both armed by the system and soundly checked.** Every other check was first written by an operator identity. The bottleneck is turning a detected gap into closable work, not landing the fix. Filed as its own headline row, with the hollow checks' root cause (the writer drafting without the module's real exports) appended.
          - **The selector does learn, but much autonomous work bypasses it.** An activity at 0% success over about 3,000 runs is still dispatched, although its learned record holds about 1,100 failures: a goal list pins the template that calls it, and that template names it by literal id. **49 of 54 boredom goals pin a template outright.** This breaks the no-hard-wired-callers ruling at scale, and is named in the reading with a detector that counts it. When the only producer of a shape is proven bad, selection still returns it, so the repair wires the existing "proven bad" marker into selection; the decline carries its reason and feeds the variant path for that shape, the justified case for a new activity.
          - **Where the remaining load comes from** (measured on one run node): two ticks page through 30 days of traces by offset with no lower time bound, about an hour of database scanning every six hours. Labels that come back empty are never cached; model calls have no timeouts; a timestamp at the start of judge prompts defeats the prompt cache. Some templates were credited as reached on their declared shape alone, which RUN 4 counts. Some reads file gaps as a side effect (added to the non-file-write rule). Each goes to the gap store with a size; none is a precondition unless brought to the user.
          - **Verdicts given by a person are stored only on the node where they were given.** This is not intended: the design makes a person a calibrated observer of the learner, and a node with no learner currently sends such verdicts to no calibration. A low gap, with a pre-run check of where feedback for the other run node lands.
          - **The bootstrap node's systemd re-reads activity-api's drop-ins about every 33 seconds,** most likely because a health check on a dependent unit loads them. A low gap; the visible warnings stopped once the drop-in's mode was corrected.
          - **Compiled script copies that nothing runs** sit beside the scripts that do. They go on the existing row for that class: list every one by what units and callers actually run, then delete it or generate it with a match check.
        - **USER RULINGS (qa session unless stated; times from the ledger where recorded, otherwise approximate), 2026-10-18 07:09Z to about 10:5xZ:**
          - **Correction to the batch above:** "RUN 4 = 20 real-traffic goals, no open-gap units" was ruled at 07:09:23Z, and "the check-writer repair before RUN 4" at 07:09:57Z.
          - **About 07:2xZ.** The database-cost date batch is accepted (2026-10-19T12:00Z to 2026-10-22T18:00Z), except that the two unbounded 30-day trace scans are fixed before RUN 4 as load relief that does not gate it. The activity at 0% success over about 3,000 runs is **retired** by 2026-10-19T18:00Z; the template that names it by literal id then declines with a named reason, and that decline feeds the existing variant path for its shape.
          - **About 07:4xZ to 07:5xZ.** Boredom's idle check and its selection-weight reads are fixed before RUN 4, non-gating. A gate on the boredom pool loop for outside traffic lands before RUN 4 switched off, and is switched on after the run as one recorded change. Switching off boredom's three learned selection mechanisms while their data is wrong is a **hold**, lifted when the fetchers read a complete window, review by 2026-10-19T12:00Z. **The detector for landings that narrow a documented contract lands before RUN 4**, chosen over the advice to land it after; it must not move the start silently.
          - **About 08:3xZ: a bounded admission exception** lets the pre-start gates run under host load, one at a time, with the load recorded on each result and any new failure re-run alone twice before it is accepted as load. It ends at the start. The exception was given in the coordinating session, whose own permission check had refused it.
          - **About 09:3xZ: the structural fix for cross-goal contamination lands before RUN 4** (the start moves later for it, by the user's choice). Goals count as similar only by what they produce, never by wording; a lesson from another goal is labelled as such; dispatch identifiers are stripped before recall; and a detector flags any step whose search or judged question is not the goal's own. **About 09:4xZ:** two templates that probes created to test a mechanism, never executed but selected 29 times, are retired through the system's own retirement route.
          - **About 10:0xZ.** The trivial self-probe runs in observe mode with a probe tag and a guard against bursts, and the stalled extraction step is repaired. Both land before RUN 4 without gating it.
          - **Relayed by the human-surface session:** "Interactions will always be with the current state of the whole system." "There should only be one input." "We should make sure that we know to not over-explain the interface within the interface." Continuing an earlier exchange is an explicit, visible link, never inferred from wording. A spec revision that still contained overturned wording was withdrawn and rebuilt before approval.
          - **Given directly to docs:** "Nothing in this system is new… we have already done everything at least once." Every capability claim names the existing part and what blocks it.
        - **Readings, 07:30Z to about 11:00Z:**
          - **Both public nodes were recreated before the start and verified,** using recreate scripts fixed and reviewed first; a further fix accepted an empty volume, since a spoke keeps no local database. The public spoke passes by effect. **The bootstrap node's federation check starves itself:** a sweep runs only on request, a cached answer inside its freshness window is graded hollow, and each hollow grade makes requests rarer. A sweep pulled once by the user showed the node reachable again and the payload check passing for the first time. A false "local rows lost" reading came from a sweep taken seconds after a registry restart that then saved its one-row snapshot as the baseline; the amendment stops a settling sweep from writing any baseline. All filed, the self-starving loop at high priority.
          - **The local container's process limit was exhausted** by test database engines orphaned when their test process crashed, so every command into it failed. The user cleared them. docs' first cleanup script would have matched every rootless container on the host and killed engines whose runs were still alive; review caught it before it ran, and a corrected script pins one container and true orphans only.
          - **The database load:** a signature-count query that an operator commit had re-introduced, after it was reverted weeks earlier for exactly this, timed out continuously, and each timeout left the query running on the server. Its rewrite is pushed, measured with database CPU before and after. The orphans explained the host's pressure but not the database's own CPU.
          - **The system's self-reported reach of 33% came mostly from its own trivial self-probe; without it, about 5%.** The run's frame now excludes every probe family, by tag and by pattern. **Extraction, which turns successful runs into reusable templates, had stopped:** no extractions in the window, nearly all timing out on their first task. **Observe-mode probes could still write learning state** through direct calls that skipped the guard; they now pass through one guarded path, with a source scan that fails the build on any new direct write.
          - **One precondition had never been built** (no verdict for a resolver that returns its shape on every path). A tracked checklist built from what is actually live caught it.
          - **A third hollow check landed autonomously, of a new kind:** it imports the real module but never uses it, simulates the defect in its own body, and asserts on the simulation, so it fails by construction. Its gap was operator-filed. Its first draft had been refused for reaching the network, and the writer answered by simulating, so the refusal taught evasion. Refusals now carry a constructive hint the writer reads on retry, and a new rule refuses a check whose failing assertion does not depend on the module it targets.
          - **A measurement trap:** the trace cleanup deletes ungraded rows after two hours, so any longer count is biased toward graded runs. One before-and-after comparison was ruled inconclusive for this reason, and comparisons now use windows shorter than the cleanup interval.
        - **USER RULINGS (qa session unless stated; approximate times), 2026-10-18 about 11:00Z to 19:20Z:**
          - **About 13:0xZ (asked at 13:05Z, answered about 15:35Z): revert only the two 30-day scan commits,** keeping the rest of their bundle, and redo the fix later. The fix had failed its pre-registered test on both counts: deep requests fell 36% against a 90% bar, and both reports lost their 30-day numbers. After the revert, both reports measure again, the extra aggregate calls fell to zero, and live database CPU fell further. The redo must deliver bounded paging and complete counts together. **While qa waited on that question, every other qa action stopped for about two and a half hours.** qa now sends urgent relays before asking a blocking question, and gives a time-boxed default for choices that are not about safety.
          - **About 19:0xZ, "fix first": RUN 4 waits for a fix to development-vessel's health stalls,** rather than running with them as a named condition. The cause is proven: on each goal-reach tick, about 238 records are saved one at a time, and each save rereads and rewrites a 22 MB pool file synchronously, freezing the vessel for 48 to 178 seconds. Self-recovery then restarts it on one run node; on the other, where self-recovery is masked, goals simply wait out the freeze. The pass test is keyed to the tick: the first tick after the fix is clean (one rewrite, no long collection pause, health answering throughout), then a tripwire through the run. A checkpoint at 01:00Z brings it back to the user if it is not proven by then.
          - **About 19:1xZ: the other run node's update, blocked by one load-sensitive protected test.** The user chose a narrow exception, then added: "We can run it first" — the test runs alone three times at low load before anything is excused. qa then implemented the exception, conditional on the three low-load runs passing and on the user applying it, with an existing setting that holds protected-test runs while the host is under pressure and retries them on a quieter tick. It can never let a failing test pass, and it is reset when RUN 4 closes.
        - **Readings, about 11:00Z to 19:20Z:**
          - **The re-introduced slow query was the main database load.** Its rewrite passed every pre-registered criterion: timeouts fell from 34 to 0 with more calls, not fewer; live database CPU fell from about 640% to 360% on average; host pressure from about 25 to 5; and the slowest database responses from 14 seconds to under one. A lesson recorded as a class: a reverted change re-landed without the check its revert called for.
          - **Every RUN 4 vessel stack is pushed,** each through the full guard set with a clean gate record and same-environment evidence. Several review findings were fixed before they landed: a write door that never governed resolvers registered with a kind suffix (the fix strips the suffix in one shared function, and a sweep listed the remaining exact comparisons); observe mode that a nested call could switch off (it is now inherited and can only be tightened); a test file that contributed no tests to the whole-suite run, hiding 17 new cases (evidence came from running it alone; a per-file count check is filed); and an edited protected judge test, accepted only because its assertions stayed identical and became stricter.
          - **One RUN 4 precondition had never been built** (no verdict for a resolver that returns its shape on every path); a checklist built from what is actually live caught it, and it is now live.
          - **Two more autonomous landings, neither sound.** One is a check that imports the real module but never uses it, simulating the defect in its own body. Its first draft had been refused for reaching the network, and the writer answered by simulating, so refusals now carry a constructive hint and a rule refuses a check whose failing assertion does not depend on the module it targets. The other edits an existing test so that one assertion no longer discriminates, fixes one of nineteen failing cases, and is not linked to its gap. **Landings through the edit-intent route skip their own check entirely**, by a fixed exemption on their gap-id prefix; filed. The contract-narrowing class now covers test edits too: an edited test must still catch a planted defect the original caught.
          - **The loop fix landed but cannot contain the loops it was aimed at:** its hold counts from first detection, and these loops were first detected days ago. Two gaps keep being redispatched, about 950 failing dispatches a day. The detector that should file new livelock gaps never runs, because nothing discoverable serves its shape. The repair measures the hold from the drain's own recent redispatch record. Named for RUN 4's reading.
          - **Reach is far below the target.** Pre-registered 20-goal runs have reached 5%, 5%, 0% and 20% by the second attempt; RUN 4's prediction is 25 to 40%. Live on one run node over a day, the ReAct-style floor reached 12.5% of the goals it handled, below the execution expectation's floor of parity with a conventional agent. Extraction, working again, reached 36%. Diagnosing the floor's failures is the leading candidate for work after RUN 4.
        - **USER RULINGS (approximate times), 2026-10-18 about 19:20Z to 2026-10-19 about 03:10Z:**
          - **Standing, evening of 10-18: "everything we are doing needs to be internal to the system's mechanisms. That means that we should not have environment variables that block."** Any environment flag that enables, disables or blocks behaviour is a gap, to become a shaped setting read at use time with a recorded default. The environment keeps only bootstrap inputs (secrets, ports, identity). Operator checks run by hand move into system activities. This ruling was prompted by a documentation fixer whose landing is held off by an environment flag.
          - **Evening of 10-18: route model calls to the paid provider by changing the shaped model policy, with no code change.** After it, no model call fell back.
          - **Evening of 10-18: "We should land it before."** The extraction fix (the ribosome) landed before RUN 4, not after it.
          - **Evening of 10-18: the hub may be fully reconfigured,** rebuilt after RUN 4's start and off its path, changing the manifest only. Its disk cleanup was approved. The user also set the hub's update-wall input by hand, because a killed update run never raised it and the wall had latched below the run's real length.
        - **Readings, 2026-10-18 about 19:20Z to 2026-10-19 about 03:10Z:**
          - **Extraction works again, by declaring its product.** It had been refused by the write door because it never declared what it writes. Two learned templates came from real traffic before RUN 4. Whether the reaches they came from would pass the five conditions below has not yet been checked.
          - **The landing count, made honest, falls from 11 to 0 strict and 2 lenient.** It now keys on the commit subject rather than the author. About a third of all autonomous landings have been reverted.
          - **The pre-registered leak check was biased, and was fixed before the draw.** It now replaces only drawn goals that match templates of operator or probe origin. Agent probes stored with no sender were found in the frame and excluded.
          - **Observe mode leaks through deferred readers.** It protects every write made while a goal runs. It does not protect a later scheduled tick, which tallied five observe-mode probes as goal deficiencies. Observe must be honoured by every reader, deferred ones included.
          - **Correction: the hub's earlier recreates were not verified in full.** The recreate check covered services and the recreate's purpose, and never the schema. The hub fails the same ten migrations on every start, four of them by timeout, and seventeen more report no success without a reason. The guard meant to skip a repeatedly failing migration never fires, because it looks only at top-level files. A first-boot seeder also fails on every hub start: one template's tag breaks the tag rule, so that template never registers. The rebuild during RUN 4 is reported as services verified and schema not complete. The filed repair requires a skipped migration to stay visible as missing schema, read by a migration-health activity and counted by the boot check. A silent skip is not a pass.
          - **RUN 4: 2 of 20 goals trusted by the second attempt (10%, with a plausible range of about 3 to 30%). The prediction of 5 to 8 was not met.** The goals were 20 randomly drawn from real traffic across two run nodes. The pre-check and run conditions held: no model-plane failures, no failures from the hub rebuild's federation outage, three leak replacements, and the rest named in the reading. **8 of the system's 11 "reached" verdicts were false on a full-output review.** The false reaches were generic textbook answers to questions about the system itself, with no read of the system; invented facts; and credit taken for an unrelated commit landed twelve hours before the goal, while the tests the goal named still failed. A retry repeated the same ungrounded route. Another 21 results went ungraded, because each output was larger than the judge can see. The two sound passes were a deterministic gap decomposition and a grounded web fetch. **The dominant defect is judging, not routing.**
          - **RUN 4 taught the system the wrong lesson.** The ungrounded answer path gained credit from six reaches that all failed review, and one false reach was credited twice. The grounded fetch path that worked gained nothing: its two trusted reaches were dropped because it had no learning-score row yet. A component of a reached walk was penalised regardless. **No path exists to retract a false success.** The only correction the system can act on undoes a wrongly failed verdict, and only an operator can trigger it.
          - **A reach counts only if five conditions hold:** the evidence tests the goal's own condition; a measurement taken before acting ties the result to this action; the claim comes from reading the referent, not a description of it; an independent verifier grades it, or the judge abstains; and the judge sees the whole output, or abstains. Each condition now has test cases taken from RUN 4's own false reaches. Outcomes are reached, failed, declined or ungraded, and an ungraded outcome writes no credit and no blame.
          - **The trust review is itself a gate that only an operator runs,** against the ruling that nothing is operator-only. Its verdicts are recorded as observations with their source, and the headline marks them. A system activity applying the five conditions has to reproduce them.
          - **The agent feedback tool records every caller as a human.** With sufficient scope, the verdict then overwrites the run's outcome instead of joining its history, and files a gap claiming a human contradicted the judge. The review verdicts were therefore not submitted through it. The agent loop described in the project guidance calls this tool after every dispatch, so earlier agent verdicts may already be stored as human; a read-only count is under way. The repair derives the source from the caller's credential and appends to the history instead of overwriting it.
          - **A shared sequence of the system's core steps, from admission to learning, was agreed** by the review, research, surface, documentation and coordination sessions. For each step it records the decision, the record left behind, what a person sees, and its status in code. Compared with the architecture documents, it shows that the documents state six things wrongly: credit on task completion described as the design; learning signals that are "best-effort"; typecheck as the landing bar; a reach gate claimed to stop gaming; refusal described as "safe but no learning"; and coalescing by identical text. The documents say nothing of observe mode, the write door, a measurement before acting, the ordered route to the tool floor, admission, retirement, or the declined and ungraded outcomes. The corrections enter the documentation-drift path as gaps, each correcting toward the ruling rather than toward current code. They stop at a recorded draft until the environment flag that holds that path's landings becomes a shaped setting.
          - **Repair order:** judging integrity under the five conditions, then credit only on independent verdicts, with a correction path that works both ways and that observations can drive, then a minting gate that extracts only from trusted reaches, then honest gap closure and landing.
        - **USER RULING, 2026-10-19 about 04:4xZ (asked directly in the docs session): "approve the closer dates and RUN 5".**
          - **Judging, split by condition and brought forward.** "Grounded" (a question about the system with no read of it is not reached) and "full view or abstain" (an output the judge cannot see whole is ungraded, never credited) are due by 2026-10-20T08:00Z, twelve hours earlier than before. "Right predicate with a baseline tied to this action" and "independent verifier or abstain" stay due by 2026-10-20T20:00Z. The minimum credit rule (no posterior write without a graded verdict; an ungraded outcome writes nothing) is a precondition of RUN 5, so it is due with the first two conditions, by 2026-10-20T08:00Z. It is one shared verdict gate reused by every writer that credits today without a verdict. Three builders were staffed in parallel at about 04:55Z, one for each of the two conditions and one for the credit rule. If the credit rule misses 08:00Z, it is reported as missed, its 20:00Z bound holds, and RUN 5 waits for it. The last two conditions start when the first two report.
          - **RUN 5 is pre-registered:** a fresh frame and seed, 20 goals drawn at random from real traffic, with no exclusion by route, since excluding goals by the path they would take would bias the sample toward paths that work. The prediction is fixed before the draw. It starts within two hours of the first two judging conditions and the minimum credit rule landing and converging on both run nodes, and it is short and bounded. Until observe mode holds on every dispatch path, preparation probes and dry runs use only the direct path where it is proven to hold.
          - **Closer only:** a date may move earlier; a miss is reported as missed, not moved.
        - **USER RULING, 2026-10-19 about 05:3xZ (asked directly in the docs session): "Approve both dates"** for the fix to gap-birth measurement.
          - **Why it matters:** in a day on one run node, 78 of 94 birth checks on armed gaps came back unknown, because the check could not take its measurement. An unknown birth holds a gap ineligible, so most armed gaps never reach the repair lane. This is the leading reason the system so rarely repairs what it finds.
          - **Dates, run alongside judging:** each armed gap's check is validated against what its measuring instrument actually returns, mismatches are refused or flagged, and the existing unknown births are re-taken, by 2026-10-20T08:00Z; an instrument that can run shell-based checks by 2026-10-20T20:00Z.
        - **Reading, 2026-10-19 about 05:15Z to 05:30Z: the first system-authored repair landed against a real must-fail check.** An operator armed the gap (observe mode lost on the asynchronous dispatch path) and wrote its check, which failed on the old code and passed only with the complete fix. The lane drafted, verified and landed a two-line repair with no operator edits. Read independently, it covers the only place the dispatcher rebuilds an asynchronous request. On the node it landed on, one observe-mode goal sent through that path wrote no credit, no goal path and no memory. Because the gap was armed by an operator, it does not meet the dated target of a repair to a gap the system armed itself; the strict count of those stays at zero. The reviewing step raised an objection that the lane treated as advisory once the check passed; the objection asked for a field variant no caller sends, and is answered with a recorded refuting verdict rather than a landing of dead code.
        - **USER RULING, 2026-10-19 about 05:4xZ (asked directly in the docs session): every known blocker filed without a date now has one.** A filed blocker with no date is an indefinite hold, which the standing rule forbids; several had been filed tonight as "after the first phase" without one.
          - **Pulled earlier by the ruling:** extraction honours the judge's refusal to bank a reach, so it extracts only from reaches the judge accepted, and this joins RUN 5's preconditions, due by 2026-10-20T08:00Z; otherwise RUN 5's reaches could mint templates that freeze their source output again. Verdicts identified by the person's own login, with refusals kept and shown and a path to retract false credit, are due by 2026-10-21T08:00Z, because a person's verdict is the only signal independent of the judge and none currently reaches the system.
          - **By 2026-10-20T20:00Z:** the agent cockpit and the human surface send the observe flag; a node's setup accepts only the hub that issued its key; the learning store's health check is protected from bursts of template-list requests.
          - **By 2026-10-21T08:00Z:** the remaining paths that credit without a verdict, with a landing check that refuses a commit adding one; model-plane failures are no longer blamed as execution errors; learners skip records marked as test output.
          - **By 2026-10-21T20:00Z:** the rest of the minting gate, including a detector for a template that gives the same answer to unrelated goals.
          - **By 2026-10-22T20:00Z:** the hub's failing migrations and seeder; the re-dispatch loops; retiring templates that have never succeeded, through a repaired retirement guard; the first batch of environment-held behaviour moved into shaped settings; and a design for each step that has none yet (replication with evidence on every node, logged picks and exploration, per-step content checks, refusal with cited evidence, one governor per setting), with build dates set then.
          - **Closer only:** dates may move earlier; a miss is reported as missed.
        - **USER RULING, 2026-10-19T06:40Z (asked directly in the docs session): approve the proposed build dates, and pull the reuse of learned pathways earlier.**
          - **Approved as proposed (latest-by):** the designed steps that had no plan, from 2026-10-21T08:00Z through a rolling 2026-10-28T20:00Z: the stop decision, the lineage budget, the declined outcome, logged and randomised producer picks with counterfactual arms, per-edge content checks with in-place recovery, one governor per actuator, retirement as a running activity, kernel-first selection, reading the unread stability signals, refusal with cited evidence, and replication with evidence on every node. Each design starts from an existing part. Also approved: sign-in for the remaining surfaces and the human surface on its own origin with a stricter policy, by 2026-10-22T20:00Z; the lesson channel's mechanical fixes (lessons graded, drafter credit at reach rather than chain completion, readers through discovery), by 2026-10-22T20:00Z; a design for the system writing its own lesson text from clustered failures, by 2026-10-23T20:00Z; and the judge capture keeping every verdict of a dispatch rather than only the last, by 2026-10-20T20:00Z.
          - **Pulled earlier:** last-mile reuse of a learned pathway, the execution contract's middle and the mechanism by which learning compounds, from 2026-10-22T20:00Z to 2026-10-21T20:00Z. The steps it depends on must be met by then too.
          - **Why the lesson items matter:** the drafter's lesson channel is read, but its text is a fixed table in the source written by operators, repeated failures add nothing because identical text is deduplicated, and no lesson has ever been graded as having helped. The only prose loop graded by reach is goal-host's failure memory, which is the pattern to follow.
        - **USER RULING, 2026-10-19 about 06:5xZ (asked directly in the docs session): "10-20, matching the exemption".** The unit files whose coverage was found overclaimed are now recorded at syntax level only, under a dated exemption that expires on 2026-10-20. Earning behaviour-level coverage for them is due by that expiry rather than two days later, so the exemption is never renewed; a miss is reported as missed.
        - **USER RULING, 2026-10-19 about 06:5xZ (asked directly in the docs session): the reuse guard, pulled a day earlier.** The system's code drafter refuses a plan that adds a new exported identifier without naming the existing part it reuses, by 2026-10-21T20:00Z, so the guard is in place while the designed steps are built. Removing a key from a gap record, where an update can today only null a key, by 2026-10-22T20:00Z. The reuse guard makes the standing ruling that nothing in this system is new into a check the system applies to itself.
        - **USER RULINGS, 2026-10-19 about 07:0xZ (asked directly in the docs session), both pulled earlier.** (1) A security hold on the dispatcher's goal endpoints accepting requests without authentication had passed its review date with nothing reviewed. Authentication on both endpoints, with a probe confirming the old request is refused, is now due by 2026-10-20T20:00Z, which is also the hold's new review date; the credential work runs alongside, since every caller then needs a key. (2) A path that credits a reach without passing the judge's conditions, and labels the result deterministic, joins RUN 5's preconditions, due by 2026-10-20T08:00Z, so RUN 5 cannot credit reaches through it.
        - **USER RULING, 2026-10-19 about 07:1xZ (asked directly in the docs session): "Pull (1) to 10-21 20:00Z".** The dispatcher's own copy of the grammar for gap checks is replaced by the one shared copy by 2026-10-21T20:00Z, a day earlier than proposed, alongside the reuse guard. A review of turning on success tests written by the model, rather than only deterministic ones, is set for 2026-10-26T20:00Z, after shadow-mode evidence.
        - **Reading: the first probe after the first two judging conditions went live was a false reach.** Asked how many vessel services a run node was running, the walk read one vessel's source modules, while at least thirteen were running. A step that ran its own commands invented an endpoint, re-issued the identical command several times as its "self-correction", and never consulted discovery; the result was credited through a fallback judging path that bypasses the new conditions. Both are filed. By user ruling about 07:2xZ (asked directly in the docs session), both were pulled earlier: closing the bypass is a precondition of RUN 5, due by 2026-10-20T08:00Z with the others so RUN 5 is not held back; detecting and breaking the fixation on an invented endpoint, an instance of information starvation that a machine can detect, is due by 2026-10-21T20:00Z.
      - **Reading and USER RULING, 2026-10-19 about 07:2xZ: extraction from the dispatcher's reaches has been dark on one run node for at least four days.** The extraction vessel's discovery registration was rejected every minute, with no reason returned by either side, so the dispatcher's calls to extract its reached runs timed out and none became a reusable activity. The vessel logged that it would be unreachable about six thousand times, and nothing raised it. By ruling (asked directly in the docs session, "Fix registration now, alarm by 08:00Z"), the registration is restored as soon as its cause is confirmed, through the normal gate, and an alarm on repeated registration failures is due by 2026-10-20T08:00Z. Both are preconditions of RUN 5. **Correction, recorded the same hour:** the registration failure was asserted as the cause of dark extraction before the link was checked, and it is not. Extraction never calls that vessel; it fails at its first step, because fetching one trace with its signatures from the learning store takes several seconds under load, against an eight-second limit (seven failures, no completion, in about twelve hours). By a further ruling ("Start now, by 08:00Z"), making that fetch complete within its limit, by fixing the query rather than raising the limit, is staffed immediately and due by 2026-10-20T08:00Z, also a precondition of RUN 5, which needs extraction working to measure learning.
      - **Reading and USER RULING, 2026-10-19 about 07:3xZ: the system had noticed, and could not act.** The extraction vessel's missing registration had been detected and filed as gaps since late September, reopened twice, and never repaired: every one of those gaps was filed without a machine-checkable check, so admission parked it as needing information. Across one run node's open gaps, about three in four carry no check, and among those the system filed itself, nearly nine in ten; the one detector that arms every gap it files is the model to follow. By ruling ("Pull (2) to 10-20 20:00Z"), the liveness detector arms the gaps it files by 2026-10-20T08:00Z, and every detector-filed gap must carry the check its detector measured by 2026-10-20T20:00Z, a day earlier than proposed. A gap a detector cannot arm is still written, unarmed and marked unresolvable with its reason and the detector's reading, so it is never admitted to the repair lane and never lost; refusing the write was first built and dropped, because it lost observations the system relies on. The health check that missed the dark vessel looked only at whether its process ran; it is extended to compare running vessels against discovery's registry, with its vessel list taken from the inventory. The extraction vessel turned out to serve no shape at all, so its failing registration loop is removed rather than given an invented shape; the health check reads each vessel's registers flag from the inventory, so a vessel that legitimately does not register is not reported. The identity vessel, the single validator every vessel checks credentials against, is meant to register and never had: its health reported registration pending with no heartbeat, so callers reached it by pinned address. By user ruling about 07:5xZ ("Fix now, by 08:00Z"), its registration is staffed at once, due by 2026-10-20T08:00Z, proven by callers resolving it through discovery. **USER RULING about 08:0xZ, a re-scope approved by the user, not recorded as a miss:** the liveness detector arms its registration checks by 2026-10-20T08:00Z by reusing discovery's registry observer, while three checks no existing instrument can measure (extraction freshness, gap count, discovery health) fall back at 2026-10-20T20:00Z to the class rule's needs-information filing with the detector's reading attached, and, by a further ruling ("Pull (1) to 10-21 20:00Z"), the instrument to measure them, built by extending the observers that already own each reading rather than adding a resolver that runs queries, is due by 2026-10-21T20:00Z, a day and a half earlier than proposed. A low-priority check refusing a leftover built file beside the source file that actually runs is due by 2026-10-24T20:00Z, and every gap now gets a proposed date when it is filed. **USER RULING about 08:4xZ (asked directly in the docs session, "Pull (2) and (4) to 10-21 20:00Z"):** the identity vessel's callers move onto discovery instead of a pinned address, and each shape declares whether it reads source or live state so the grounding check can tell them apart and the fallback judge's backstop can retire, both by 2026-10-21T20:00Z; the reseed step that skips restarting the identity vessel when seeding mints a new key, also by 2026-10-21T20:00Z; a trace query over a time window that times out, by 2026-10-22T20:00Z. **Reading:** a deliberate restart of the gating run node's database, by user ruling, at 2026-10-19T08:31:31Z freed about 34 GB of swap and brought memory stalls near zero; every vessel answered healthy within a minute and no landing was lost in the window. It is a recorded intervention, so RUN 5 does not compare database-dependent readings across it, and the lasting fix for the database's memory growth is due by 2026-10-20T08:00Z. **USER RULING about 08:5xZ ("Pull (3) to 10-21 20:00Z"):** the judge's golden expectation files, which matched no code at any commit since they were generated, are regenerated under a staleness guard by 2026-10-21T20:00Z, a day earlier, as a reviewed fixture change in its own commit rather than inside a fix; learned display entries whose only evidence was test output are retired through the learner's own write path by the same date; and panel records carry the existing provenance stamp by 2026-10-22T20:00Z. Test output had been leaking into the live participation journal (about five hundred records, and some thirty-four thousand polluted lines across the learners' inputs); the tests now write to their own setup and the learners drop records without the stamp. **Reading and USER RULING about 08:5xZ ("Pull (3) to 10-21 20:00Z"):** in probes after the first two judging conditions went live, even a trivial control question abstained, because the walk had collected large unrelated results and the full-view condition refused to judge what it could not see whole. The condition is narrowed to the deliverable, which the judge already identifies, as a precondition of RUN 5 due by 2026-10-20T08:00Z; the cause, a walk that fetches unrelated results before answering a trivial goal, is due by 2026-10-21T20:00Z, a day earlier than proposed; and the update cycle's held-out readings use the record that matches each dispatch's final verdict by 2026-10-20T20:00Z. **USER RULING about 09:0xZ (given directly in the review session, "pull both closer"):** the grammar half of the shared package moves to 2026-10-20T20:00Z, and a bypass found in the independent-verifier condition, already built as one small commit, becomes a precondition of RUN 5 due by 2026-10-20T08:00Z. The guard on the dispatcher's copy of that grammar fired on its first day, when the first-check fix changed the shared grammar; the copy was brought back in line rather than the guard loosened. A commit that narrowed the full-view condition was approved, but the same commit also loosened a protected consistency check, and that part was refused, to land only as its own reviewed change. **A further USER RULING about 09:1xZ (given directly in the review session, "pull both closer"):** credit written for a goal's path must be linked to a graded reach, due by 2026-10-21T08:00Z with the other paths that credit without a verdict; detection times set in the future are clamped when a gap is written, by 2026-10-21T20:00Z. The builder of the remaining credit paths found the minimum credit rule closed none of them, and fixed them directly: a build-result endpoint no longer writes posteriors, since a build result describes a commit, not a reached goal, and infrastructure outages are no longer charged as a step's failure. **USER RULING at 09:13Z (asked directly in the docs session, "Pull to 10-20 08:00Z"):** the human surface's authentication covers every route that writes, through one validation point, by 2026-10-20T08:00Z rather than the proposed 20:00Z; browser writes stay possible but are marked unverified until sign-in lands. **USER RULINGS about 09:3xZ–10:0xZ (given directly in the review session):** the cockpit's key is not granted operator authority; goal-host's authentication waits until reach attribution reads the real caller, by 2026-10-20T08:00Z, so reaches an agent assisted can never count as autonomous; development-vessel's composing entry points are authenticated by the same date; federation enforcement was applied on the second run node and made boot-durable on the first, by a user-run script at about 09:5xZ; scope tightening covers the shared grammar, the shared package manifest, the shared credential check and the shared discovery adapter, so the repair lane cannot edit code that protected files import. **Reading:** a deploy gate refused the first-check fix on the gating node because one protected test timed out; it passes alone at low load before and after the fix, and refused an unrelated commit the same way two days earlier, so it is a timeout under load, not a regression. By ruling ("retry once if timeout"), the gate retries a timed-out protected test once, by 2026-10-20T08:00Z, stated as a widening with its own must-fail cases: a genuinely slow test still fails, and contention at retry time defers rather than retrying hot. The push guard now refuses any push whose protected tests have not each passed alone at the pushed commit. **Reading:** a CPU-stress step meant for a capped container ran uncapped on the shared host from about 09:21Z to 09:30Z, driving load near ninety; readings taken from 09:21Z to 09:35Z on the local nodes are void, and the step now refuses to run outside a CPU-capped group. **USER RULINGS about 10:1xZ–10:3xZ (given directly in the review session):** the credit-hold protected test's fix by 2026-10-20T08:00Z (asked in both sessions and answered differently, the earlier answer governs under closer-only; one session now asks and tells the other first); the co-hosted gate collision, where two run nodes' deploy gates on one host each run out of time and no development-vessel change can deploy, is fixed by staggering each node's gate start from a shaped setting and deferring a run that goes blind under contention, by 2026-10-20T08:00Z; a seed-only change to two accepted judge-split fixtures for the fix that records who directed a gap is accepted with the assertions unchanged, provided the edited fixtures still fail on the defect the originals caught; and a forwarded-grant path so the second run node can direct gaps again, by 2026-10-21T08:00Z. **USER RULINGS about 10:3xZ (given directly in the review session) on setup and self-update:** every setup case becomes one plain command with no generated script, by 2026-10-23T20:00Z, accepted on both a rootful and a rootless container engine, with the installation text reviewed before it lands; a node converges the federation tree in place through its own update cycle, verified by effect on a canary, so a federation fix no longer needs a recreate, by 2026-10-22T20:00Z, two days earlier than proposed; an upgrade of the base runtime runs as a traced activity, started by a shape rather than a timer, with a rehearsed rollback, by 2026-10-28T20:00Z, three days earlier than proposed; behaviour still held in environment variables moves with the first batch of that sweep, by 2026-10-22T20:00Z. **USER RULING about 10:4xZ (given directly in the review session, "Build 1.3 by 10-20T18:00Z"):** the update cycle installs only paths with behaviour-level coverage, read from the coverage map, by 2026-10-20T18:00Z, before the exemption for syntax-only coverage expires; there is no renewal, and files covered only at syntax level, including the scheduled tick scripts, converge only through an image rebuild afterwards, which the user accepted. **Correction:** an item dated for a failing protected test rested on a false premise. The test failed only in the throwaway container used for off-node gate runs, which lacked a deployed copy the test reads on every real node; it passes on the nodes. The off-node environment is being brought in line with a real node, and every protected test run alone now reports its skips, so a missing input cannot pass silently. **USER RULING about 10:5xZ (given directly in the review session): operators fix a genuinely failing protected golden test now,** accepting that the fix counts as hand-fed rather than the system's own repair. The test fails on the gating node, the system's own failing-test detector has an open gap for it, and once the committed scope file lists it every development-vessel candidate would be refused. The fix is recorded as an operator act and does not count toward the autonomy measures. **Reading and USER RULING about 11:0xZ (given directly in the review session):** an audit of how faithfully off-node gate runs match a real node found protected tests that skip or return early, so they measure nothing, and one protected test that starts a real dispatcher and rewrites the live dispatch store on the node during every gate run, very likely the source of recurring gaps about live state changing unexpectedly. Stopping that write is a precondition of RUN 5, due by 2026-10-20T08:00Z and proven by a gate run leaving the dispatch store unchanged, so a gate run cannot corrupt RUN 5's own evidence; it is also being correlated with earlier dispatch-store anomalies for the RUN 4 reading. The tests that measure nothing, tests that write to the live lesson files, a check that fails under load, and gaps in the environment-scrubbing helper are due by 2026-10-21T20:00Z. A later ruling ("Pull (e) to 10-20T08:00Z") moves the check that fails under load to 2026-10-20T08:00Z as a precondition of RUN 5: it is one of the two tests the gating node now refuses development-vessel's first-check fix on, and a timeout retry does not cover it, because it fails an assertion rather than timing out. That fix deployed on the second run node at 10:41:28Z, the first development-vessel deploy of the day; the gating node keeps re-checking it each tick. **It went live on the gating node at 11:21:33Z, so the first-check fix is now live on both run nodes: the first precondition of RUN 5 to be live everywhere.** **USER RULINGS about 11:2xZ (given directly in the review session):** a protected test whose judge cases had failed in every scrubbed run since they were written, because the judge abstains whenever an environment variable naming the gap store is set, may save, unset and restore that variable around those cases, with no assertion changed, as an interim; the judge's abstain decision itself moves off the environment variable onto a shaped placement or the gap store's real reachability by 2026-10-22T20:00Z, after which the interim test edit is removed. An environment variable that changes how the judge decides is the kind of gate the standing ruling forbids. **USER RULINGS about 11:3xZ (given directly in the review session):** a class gap for protected tests that pass in a plain shell and fail under the gate's scrubbed environment, because the source reads an environment variable the test does not pin, is due by 2026-10-21T20:00Z, found by a static scan of the source; every such variable read in a path that steers behaviour is itself an environment gate, so the scan feeds the environment sweep, and pinning in a test is only ever an interim. The rest of that sweep, about one hundred and twenty behaviour-steering environment reads beyond the first batch, which had no gap and no date at all, is due by 2026-10-28T20:00Z. **USER RULINGS at about 17:43Z (given directly in the review session):** the project-onboarding design is dated in phases from 2026-10-24T20:00Z to 2026-10-31T20:00Z; two of its first-phase blockers are live security defects even with one tenant and are pulled out to their own earlier dates: a request body's organisation overriding the token's organisation on trace and goal-path writes, by 2026-10-21T08:00Z, and vessels connecting to the database as root so the database's tenant permissions do nothing, by 2026-10-22T20:00Z; the dispatcher's inbound authentication keeps its earlier 2026-10-20T20:00Z. The pre-commit hook's timing test, which refuses a correct commit under host load (the same timeout class as the gate retry, in the hook the substrate's own commits also run), is due by 2026-10-21T20:00Z. **Reading:** the review session waited on that question from about 14:33Z to 17:43Z, and the work it reviews and pushes queued behind it; a blocking question to the person stalls the whole lane, which is itself a gap in how operator sessions ask. The review session now never blocks on a date question: relays and pushes go first, and a date question carries its recommended option applied at once as a proposal. **USER RULINGS at about 17:4xZ (given directly in the review session):** the dispatcher's authentication change may move a protected must-fail anchor from a removed internal HTTP call to the direct call that replaces it, with the assertion unchanged, as a named widening; development-vessel's verdict-diff goldens are re-based test-side, the off-node lane proving the only difference is two named commits; a pagination test defect with a loads guard, and a conjunctive retry widening for a probe that still wanders, are both due by 2026-10-21T20:00Z. **Reading:** development-vessel's first push train, carrying several RUN 5 preconditions, was pushed at 17:44:24Z. **Reading, about 19:3xZ: the first regression to pass a green gate.** The dispatcher's authentication change refused a test harness's keyless child, taking a protected test file from thirteen passing to none on a plain host; but that file skips itself wherever a node's deployed inputs exist, which is every node gate and every off-node lane container, so every gate record read it as passing. The push was held. The class rule, recorded on the existing gap for protected tests that measure nothing: such a file must run without those inputs as part of the gate, or count as unmeasured and refuse the candidate; skipping identically before and after is not a pass. The review session's push guard enforces it already. **Reading:** the operator memory mirror has been refused since development-vessel's write door went live, because the operator checkout the session hooks run from was three weeks and some eight hundred commits behind the main branch, with local commits and uncommitted changes, and its copy of the mirror script predates the key. Every operator hook and the project instructions sessions load run from that tree; reconciling it is the user's call. By user ruling the hooks run their scripts from the main branch instead of the working tree, so the stale tree no longer drives them; the change is queued behind the dated pushes. **Reading:** the gating node's database memory grew back from about 3.4 GB to about 9 GB within eleven hours of the morning restart, so by user ruling it was restarted again at 19:42:55Z, down about five seconds, every vessel healthy within a minute; it is a second recorded intervention, and the lasting fix remains due by 2026-10-20T08:00Z. **Reading:** the off-node lane's plain-host runs hung on import because the image links a shared package by absolute paths that exist only inside a container; once the lane resolves them, the dispatch-store fix's run is green. A setup fault had read as a code failure, and the lane now checks its own dependencies before recording a result. The builder stopped rather than arm them with the one available shortcut, counting the gap's own open record, which would have read a correct fix as failed. **USER RULING, 2026-10-19 at 20:30:05Z (given in the review session): "Drop it from the pin".** One run node's scope pin still listed a file that its live containment had released when that entry's evaluator hold expired the day before, so any edit to the pin would read the node as diverged indefinitely. The containment act drops that one entry from that node's pin only, as a named removal; no live containment changes. **USER RULINGS at 20:43:08Z (given in the review session):** the fix for the 30-day trace-scan bursts meets the earlier ruling for a bounded read by removal ("Removal is fine"): neither report pages the trace list any more, and counts come from one aggregate query, shared by concurrent readers and reused for a window set by a tuning value read at use time. The reports' counts move from a newest-hundred sample to true 30-day counts ("Land, record before/after"), so the lift gate's inputs are recorded just before and after each node's deploy, as a named boundary. **Reading:** the bursts were generated by a report that reads a field the trace list never returns, so every shape read as unlearned and its probe re-ran the report. The field fix is staffed, with a test against the real response format rather than a hand-written mock. **Reading, about 21:45Z: most of the next run's preconditions were not live.** Read from the commit each vessel runs on both run nodes, not from pushes or approvals: the reach latch, the trace-fetch fix and the first birth-measurement fix were live; five approved changes waited in the off-node test lane, which runs one record at a time; the registration fixes had not yet entered it; and the liveness detector's arming of the gaps it files had not been built. The lane's capacity, not any single item, is the critical path. **USER RULING, 2026-10-19 at 21:59:00Z (asked directly in the docs session): "Re-date start to arming live".** The review session and the docs session had recommended starting on time with the missing arming named as a confound. The user chose instead that the next run starts when the liveness detector's arming is live on both run nodes, an explicit exception to the closer-only rule for this one date. The other preconditions keep their dates, and any still missing when arming goes live is named at that point. **Reading, about 22:2xZ: containment only grows.** About a fifth of open gaps sit in paths the repair lane is excluded from, and a large share of those the system detected itself; across the scope record's history, additions far outnumber removals, every change to it is an operator act, and an operator write takes an entry off the evaluator's earn-in path. Each excluded gap becomes operator work. **USER STATEMENT, 2026-10-19 at 22:26:31Z (given in the review session), verbatim:** "But the system is supposed to be independent, it should be able to edit its own observation of grading and manage its own secrets. It just needs to only make 'good decisions' that improve its capacity to be independent without harming itself." The review and docs sessions had just recommended keeping grading, the gate, CI secrets and operator-host code permanently excluded; that recommendation is superseded. Containment is interim: the end state is a judged decision, in which a change to the system's grading or secrets lands when the system shows it raises its independence without harming itself, and every exclusion carries a reason and the condition under which the system earns it back, extending the existing earn-in (§7 step 9) rather than adding a mechanism. The containment act in flight was paused for the user's decision. **USER OBSERVATION, 2026-10-19 at 22:31:49Z (given in the review session), verbatim:** "While we've done a lot a pushes, the system's behavior remains flat." **Reading, 22:32Z, from the system's own records:** across the three most active vessels since 10-13, operators authored roughly twenty to fifty commits a day and the system roughly three to six; gaps opened rose from about 125 a day to about 306 a day while closures ran about 15 to 217 a day, so the open backlog grows by more than 150 a day; about a fifth of open gaps sit where the repair lane is excluded; and the reach runs read 1, 1, 0 and 4 of 20, flat. The work has been operator development, verification machinery and containment, not the system's capacity; many pushed fixes still owe their by-effect reading; and the 10-05 ruling to stop doing has drifted. Progress is the system's own output, measured by the gap triple and reach (law 7), not operator pushes. **USER RULINGS, 2026-10-19 at 22:29:19Z (given in the review session):** on the hooks, "Reviewed-sha hooks": the session hooks run their bodies from a commit an operator has reviewed and pinned, not from the moving main branch, so they need no containment; the live-record step of the containment act is cancelled, its second half is dropped, and the operator-tooling directory's entries come out of the committed scope file and the pins in the next scope act (the two judge-consistency test entries were not part of that option, so their removal is not ruled and goes to the user separately). On how containment evolves, in the user's own words: "Nothing in this system is new." The earn-in mechanism already exists; its obstructions are operator-made: plain entries with no hold or criterion never earn back, operator-attested writes take a record off the evaluator's change chain, and exact pins turn every earn-in change into a divergence. On the expiring harm hold: "Let it expire". **Reading, 22:33Z:** on one run node the earn-in qualifies none of about 270 exclusions to earn back: about half are missing from its classification table and fail closed, and most of the rest are marked never to propose or classed as evaluator files. Classifying them is filed as a design row on the existing mechanism, the first candidate to hand to the system rather than build by hand. Without re-anchoring the pins to each node's live set, every node is predicted to read a mismatch after the hold expires at 2026-10-20T18:00Z. **USER RULINGS, 2026-10-19 at 22:36:05Z (given in the review session):** on the operating mode, "Slice-first, no freeze": the loop-goal slice is graded and its first demonstrated break picks the next repair, while work already in flight keeps landing. On the two judge-consistency test entries pinned but never written live, in the user's own words: ".claude, .github and the like are used by us when we interact with the system, but nothing within the system's code reads these automatically." Operator surfaces are therefore not containment. Each node's pin is re-anchored to its current live record before the hold expiry; that drops the operator-tooling entry and, as the review session's reading rather than the user's words, the two test entries, which their directory entry already excludes, so no live containment changes. Pre-registered against overfitting: the slice's grade and the repair it selects count only if they hold on held-out probes from the sealed or random-reach set with no operator commits, and the test that the reverted surgery fails must fail. **USER STATEMENT, 2026-10-19 at 22:49:45Z (given directly in the docs session), verbatim:** "The rule is moreso that .claude and .github only change how we interact with the system, not how the system interacts with itself. While the system could theoretically edit it. It isn't read by the system in any way, and this whole concert we are putting on is meant to become irrelevant anyhow" Operator surfaces are outside containment because the system never reads them, not because it may not touch them, and the operator machinery built around them is transitional by design. **USER, 22:50:45Z (docs session), verbatim:** "We have already spent a lot of tokens on this when it is structurally the most irrelevant things to our goals." **USER RULING about 22:51Z (review session): "Minimal refresh".** The reviewed-commit hook rework is dropped; the operator refreshes only the hook files in their own checkout from the main branch, and the hook work is parked. Effort returns to the slice's first break, the run's start trigger, true learning credit, and the earn-in classification as a goal for the system. **D9 GRADED, 2026-10-19 about 22:5xZ: 0 of 4 links ran unassisted; the first demonstrated break is CLOSE.** The loop goal's own deficiency gap stayed open for days after the condition it waited on was met. A measured gap's check runs at filing and after a landing on that gap, and at no other time; the only closer that re-checks without a landing watches repository files, so a gap whose check reads runtime state has no closer at all. Every such gap of that class is open and none has ever closed, so the defect is general. Every file that could carry the repair is excluded from the repair lane. **USER RULING, 22:57:14Z (review session): "Dispatch first, decide after".** The repair is dispatched to the system as a goal first; if the lane refuses it for scope, the scope decision comes back to the user with that refusal as evidence. **Reading:** the earn-in classification, dispatched to the system as a goal, did not reach: the data it needed is already served under an advertised shape the walk did not choose, and that shape answers only when its rhythm is due. The template it ran wrote to the concept store although the goal asked for no changes, a safety finding filed on its own. **Reading, 23:21:54Z: the system's repair was refused at the landing floor.** Its draft touched the excluded scan file and a shared configuration file, so containment held, after a full draft spent, because admission does not consult scope. **USER RULING, 2026-10-19 at 23:54:25Z (review session): "Lift 1 file, redispatch".** Only the scan file leaves the excluded paths, the shared configuration stays excluded, the live records change through a named existing mechanism with an undo record (one the evaluator's change chain can follow where it exists; an operator-attested write is disclosed before it runs), and the same goal is re-dispatched restricted to that file. If it lands, closure counts as the system's own work. **Reading, 2026-10-20 about 00:20Z:** the detector-arming batch was accepted on all four nodes by 00:19:33Z. One of the two run nodes does not run the liveness detector at all, by design (its role is storage), so, as a review-session reading rather than the user's words, armed is read on the one run node that runs the detector; the other node's absent detector is a named condition of the next run, not a confound. The user was told before the start was stamped. **The next run started at 2026-10-20T00:36:15Z,** stamped from the armed reading of the detector's own scheduled run; its first attempts dispatched from about 00:40Z, and its reading follows the run. **Reading of the run, closed 2026-10-20T02:22:16Z:** trusted success by the second attempt was 2 of 20 drawn goals (10%), the same as the run before, and none of the paraphrases; behaviour is flat. Of the gate's reaches, 7 of 9 were false: an action goal was "reached" by printing its command, and questions about the system by generic completions or off-target searches. The largest class of non-reach was the judge abstaining on a clipped deliverable, because even conversational goals returned a large unrelated web payload. No operator pushed in the window; the system's own pointer update restarted nothing. **The first demonstrated break is the reach gate:** a reach must show the deliverable performs the goal's own act (evidence the action happened, or a grounded read of the system for a question about it), and a clipped deliverable is read in full or judged on its relevant part rather than abstained on. Until the gate is honest, reach cannot measure anything else. **Reading, about 02:4xZ: the system had already recognised this break and could not act.** It had detected about nineteen regressions in its own judge, each armed with a real check and each parked at filing because its edit site is excluded from the repair lane, with no lane attempt in over a week; one of them names the action-goal false reach exactly. The gate decides whether a goal needs evidence of a change by matching its leading verb against a fixed list, which a restart request does not begin with; adding the verb would hard-code one case, so the repair is to judge the proof a goal needs from what it asks. The scope decision for the judge waits until the one-file lift shows that lifting lets the system land its own repair. **Reading, about 02:5xZ: the multi-pass soak on every super-repo push had never changed an outcome.** Since early October about a hundred changes were accepted with no refusal at a later pass; a deliberately failing candidate run through the real gate code on a throwaway harness was refused at the first pass three times out of three, so the gate does refuse, and later passes only count passes for deterministic fixtures. Pushing one change at a time was policy, not mechanism: changes whose effect is not measured afterwards (docs, scope, test-only) now batch, while a change whose live effect is still to be read ships alone or with its own before and after reading, so a shift in the system's measures can still be attributed to one cause. **USER RULING, 2026-10-20 at 02:58:08Z (review session): "Shaped row, start at 1".** The number of soak passes becomes a tuning row the gate reads at use time, starting at one; the system raises it for a class whose fixtures ever change outcome on a later pass, and a check after install is the real protection. **Reading, 2026-10-20 at 03:54:59Z: the one-file lift is live on both run nodes,** confirmed by each node's own scope read, with the shared configuration still excluded. Every pre-write check passed on each node, and an undo record was saved before each write. The lift itself was run by the user, as an operator-attested write, which took the one evaluator-attested record off the earn-in chain, the disclosed cost of lifting a file classed with the judge. Several open gaps already named the lifted file as their edit site, so the system's lane may now take them up on its own, alongside the re-dispatched closure repair. **Reading, about 04:3xZ: since 10-17 no autonomous change to the development vessel could pass verification, and an operator commit caused it.** An operator-landed request handler was never declared in the vessel's served-shape configuration, so the repository's own shape-dispatch check failed at its head; the compose verify step requires that check to pass and, unlike the typecheck, never compares against the parent commit, so every compose in that vessel failed verify, the system's own included. The system's first two check drafts after the lift failed on exactly that. Its refused drafts then went to a general repair step that chased the same failure, tried to edit an excluded file and recorded misleading lessons; the gap history kept only the first error lines, so the real reason was lost; and the check drafter was never told it was writing a check, was shown no test setup, never received the existing lesson that every identifier must already exist, and was told to edit in place. Because an operator broke it, operators fix the instance, with a test that catches the next undeclared handler; the lasting repair is for verification to judge a pre-existing failure against the parent commit, as the typecheck does. **Counted, about 04:3xZ:** the blocker explains little of the flat output: drafts were almost never accepted before it existed, and since then it was the first failure in only a small share of repair rounds (a few hundred rounds a day on one run node, one accepted draft in four days). Which check most drafts fail first is being counted per day, by whether the system or an operator started the work, to choose the next repair. **Correction, about 05:1xZ:** the earlier record that the extraction vessel's failing registration loop "is removed" overstated what landed. The detector-arming batch taught the health check to expect no registration from a vessel that serves no shapes, but the vessel itself does not read that inventory flag and still attempts to register about once a minute, refused each time, in logs after the batch went live. The old registration gap is superseded by a narrower one, a vessel marked as not registering must send no registration, with a must-fail check and a control, not closed by an operator. **Reading, 2026-10-20 at 05:25:08Z: the first system-authored landing since the operator breakages were found.** The system wrote and landed, with no operator hands, a commit that adds one check file arming an open gap about check supply re-admitting work, about fifty minutes from filing to landing. It counts as a working arming path, not as the headline: the gap was filed by an operator, and arming is the first of three stages (a real failing check, the gap armed, then a fix that closes it). **Reading, same hour: the two largest blocks on the system's own lane this week were both operator commits.** One module call outside a startup guard made a vessel's main file throw on import in the check environment, which accounted for most of the check drafts that failed at load since early October; making it lazy alone would have let the same import restore and rewrite live dispatch state and re-send goals, so the startup code is confined to the running service first, then the call is made lazy. Of the system's check-writing step's lifetime on one run node, about one gap in two hundred was armed: about two in five were refused for scope, about one in three named nothing the step could find in the file, and about one in four were lost to a single draft slot. **USER RULING, 2026-10-20 at 05:34:18Z (review session): "Hold for now".** The user had told the network session the federation relay directory could be opened; the scope record cannot open one directory inside an excluded prefix without a new carve-out mechanism, so the relay directory stays excluded for now. The relay fix in its own transport package stays open to the system; only the health-counter half waits in the scope bundle. **Reading, about 05:5xZ:** the protected test that refused the development vessel's overnight update on both run nodes fails as often without that update (paired runs, red on the base four times in four and on the new code three in four): one positive-control case runs up to six processes in series and lands at the five-second per-test limit. It gets its own sized timeout in one operator commit, by user ruling given in the review session; the update itself stands. **USER RULING, 2026-10-20 at 06:11:08Z (review session): "Keep the date".** The exemption letting several hundred tooling paths update in place on live nodes with no fixture exercising them expires today as dated; the image coverage check fails from 2026-10-21 until that debt shrinks, which also holds the gate changes awaiting acceptance in the image. **Correction, about 07:0xZ, verified in code and live on a run node:** the earlier reading that the agent feedback tool records every caller as a human is no longer true. The feedback tool now sends its verdicts as automated; a label claiming to be human is refused unless the credential carries the human-verdict scope (or administration), is attributable by key and is not on behalf of a peer node; and the principal stamped on a human label is built only from the server-validated credential, never from the caller's payload. Whether a human label still overwrites a run's outcome rather than joining its history was not re-checked and stays as recorded. **Checked the same hour, live on a run node:** it holds. The label store appends rows, but the dispatcher's consumer of a human label replaces the run's reached verdict, keeping the prior value only in a reason prefix and, when the two disagree, in the summary of the gap it files; the run keeps no outcome history. **Reading, 2026-10-20 at 07:52:25Z: true learning credit landed ahead of its date.** The fix that makes grading a single writer, crediting only independent verdicts, and the trace-report fix that returns complete thirty-day counts instead of a truncated sample, were pushed together, clean on both suites and with their protected tests green alone, after a re-test made necessary by the system's own landings on the same vessel. The report fix's effect was measured beforehand as a counterfactual over the same data, so the two remain separately attributable. **Reading, same morning: the self-repair loop breaks at every stage.** About two in five gaps target excluded files and one in three names nothing in the code; most check drafts failed at load because of one operator change; arming had all but stopped, because only the node holding the gap store can confirm a check and its credit-driven pacing had learned that job down to almost nothing; the one gap armed overnight carried a check that tests only its own mock, yet took most of the lane's picks through its retry chain until held; fix drafts mostly fail their own check or the typecheck; and the post-landing test run is cut off before its summary, so landing credit in one vessel is noise. Two of the largest causes were operator acts; several are blind spots where the system records no cause or a false one. **USER RULING, 2026-10-20 at 08:05:00Z (review session): "Hold the 34, keep 2".** One failing-test gap had grown into three dozen open retry rows that took most of the single compose slot's picks; the held rows target a file whose check fails on a database missing from the check environment and a stale call, so no edit to that file can pass it, and every fully verified attempt had ended with the check still red. The two rows re-sited to other files stay live. Each held row records its reason and the ruling, a review date of 2026-10-22T08:00Z, and release when the retry-lineage budget lands, when the check becomes passable from its target file, or at the review date. Separately, the review session held the three-row lineage of the gap whose armed check tests only its own mock, with the same review date, released when the arming step refuses such checks. No scope-blocked gap was held. The system's own repairs that make both holds unnecessary are filed: a budget on retry lineages (due 2026-10-21T20:00Z), arming that refuses checks mocking what they assert on, and the verification call that a fixed fetch timeout cuts off, so clean drafts never verified yet still spawned retries. **Corrected by a stricter recount, the same morning:** the held lineage took a little under half of the slot's picks in that window, not most, and the mock-only lineage about a quarter; together about seven in ten, and almost all of the slot's picks went to retries of earlier attempts. **Reading, about 08:2xZ: four fixed time limits shorter than the work they bound.** The post-landing test run is killed before its summary; the verification call is cut by a fixed fetch timeout; one protected test sits at the per-test limit; and a run node's pre-install test budget is a multiple of its last completed run, which a killed run never updates, so once a suite outgrows the budget it is killed on every attempt and the budget can never rise. Each silently turned work into noise or into an uncharged environment failure. The pattern, under law 1: a limit that bounds behaviour is a shaped value learned from measured durations, never a literal, and a killed run is recorded as killed, not as a result. Each instance row lists the other three, so the class is visible across sites without a separate row that names no single place to fix. **USER RULING, 2026-10-20 at 08:19:58Z (review session): "Reproduce-once, standing".** Given a second independent test record, a failure counts as new only if it appears in both; a failure seen in only one record is discounted and logged, not counted. It extends the earlier flake exception for one vessel to every push, and a failure planted in both records still blocks, as a control showed on first use. **Reading, 2026-10-20 at 09:02:40Z: true learning credit and complete trace counts are live on the run node that holds the trace store,** about seventy minutes after the push. Part of the wait was a test budget stuck below a suite that had grown, and the rest the host's own load; once one run completed inside the budget, the budget rose with it. The live thirty-day report returns every template group with nothing cut off, matching the counterfactual taken before the deploy. **USER RULING, 2026-10-20 at 09:11:14Z (review session): "Approve as proposed".** The substrate asks raised by the cockpit session's agent-participation design get owners and latest-by dates: a record the system can read for every operator commit, built by operators after the development-vessel chain lands, by 2026-10-21T20:00Z; the run node's pre-install test gate made callable, an operator build because that script is outside the system's scope, by 2026-10-21T20:00Z, and the same gate run before a commit reaches the main branch by 2026-10-22T20:00Z; a gap-store read filtered by file with a true total keeps its existing row's date and goes to the scope bundle or an operator build; lease authority taken from the credential rather than the request, its maintenance-lease half the system's work by 2026-10-21T08:00Z and its gap-lease half a scope-bundle item; a durable request queue that survives suspend and resume by 2026-10-24T20:00Z; and an organisation named in a write's body never overriding the credential's organisation, security and so system work, keeping its row's date. **USER RULING, 2026-10-20 at 10:00:41Z (review session): "Keep the date",** reaffirmed after a correction. The gate re-earn shrinks the in-place exemption from several hundred paths to under half that, but the coverage check fails on any expired exemption, so from 2026-10-21T00:00Z new image builds fail coverage until the remaining paths have fixtures, and those paths stop updating in place and stay as baked; the user accepted both consequences. **USER RULINGS, 2026-10-20 at 10:03:45Z (review session):** a high-severity finding, that any organisation's key could reach shell and file tools through the vessel daemon's resolve route, which checks no credential, and that a node key reaches the development vessel's state-changing shapes, is "Operator build today" for the daemon half, which the system had tried and failed and could not yet arm, due 2026-10-20T20:00Z; the development-vessel half and the truncating gap-store read are operator builds by 2026-10-21T20:00Z because their files are excluded. The two retry rows kept live are "Pause until dv chain live", since every pick ran a full draft that could not be judged until the verification timeout fix is live and added load to a starved host. The executor build that the import fix depends on, starved rather than merely deferred because its test gate will not start while the system's own database keeps host CPU pressure above the gate's threshold, is "Wait; review the threshold". The pause on the two kept rows lasts until the verification timeout fix is live, and no later than 2026-10-21T00:00Z; the pressure threshold that starves the executor's test gate becomes an input to the gate review rather than an act now. **Reading, 2026-10-20 at 10:07:53Z:** the human-surface change, named as missed at the eight o'clock date, landed about two hours late after its test teardown race was fixed in the tests, without editing what they assert. **USER RULING, 2026-10-20 at 10:13:40Z (review session): "300 s 10-21 08Z, rest 20Z".** Four operator builds, each guarded by the review session: long internal calls are no longer cut off by the runtime's default fetch limit, starting with the judge that confirms a gap's check at birth and closure (whose cut-off leaves a long check unknown forever), through one shared helper and a static detector, by 2026-10-21T08:00Z; an operator hold also stops the held row's retry lineage, and a refused pick no longer clears the retry wait, by 2026-10-21T20:00Z; a system-written check that calls a signature its target does not have, or asserts on fields its target lacks, is refused at arming, by 2026-10-21T20:00Z; and an arming landing records the real base of the file it stages, so freshness and drift checks mean something for new files, by 2026-10-21T20:00Z. **Correction and USER RULINGS, 2026-10-20 at 10:18:48Z (review session):** the runtime fetch limit was tested where it runs. The host's runtime does cut long calls at about five minutes, but the containers' newer runtime does not, so the verification calls the lane saw end empty after about five to six minutes have a cause not yet known (container setup, a server-side limit, or something on the path). On that build, "Pause; find the cause first": no helper at the remaining call sites yet; the row keeps its 2026-10-21T08:00Z date, re-aimed at instrumenting the real mechanism in the container and fixing that, and the already-landed change stays as harmless. On the paused retry rows, "Resume on evidence": they resume when the real cause is shown fixed, not merely when a change is deployed. The evidence is a verification call observed running past five minutes and answering; otherwise the held rows are re-decided at their 2026-10-21T00:00Z review. **Pre-registered before the loop fixes land (review session, about 10:2xZ): the first end-to-end test of the self-repair loop.** One small open gap in a file the system may edit, about the learning aggregator's timer state being visible to nothing, is followed through six stages: a check drafted (an attempt, not a refusal for a busy lane), the check landed, the gap armed through the node that holds the gap store, a fix composed, the fix landed, and the gap closed by its own check, by 2026-10-21T08:00Z. Any operator write on the gap, any operator goal naming it or its file, or a hand-landed commit voids it as assisted, not success. The same funnel is counted over every open, unheld, in-scope gap in the window, so the named gap is one instance, not a sample of one. Named confounds: the unexplained empty verification results, compose capacity, whether the development vessel is running its latest code on both run nodes, and checks that test only their own mock. The stage reached is the loop goal's first measured movement; the stage it stops at is the next break. **USER RULINGS, 2026-10-20 at 10:25:10Z (review session), on the daemon authorization fix due today:** "New tools-exec scope": state-changing daemon shapes require the node's own key, an administrative key, or a new tool-execution scope, which the identity seeder grants to the dispatcher's per-vessel key, including keys seeded earlier, so per-vessel attribution is kept and peer keys are refused. "All reads open for now": only state-changing shapes are gated (refused without a valid credential, refused without the scope, the handler never invoked on refusal); read shapes, including file reads, stay unauthenticated for now, and authenticating them is a follow-up that must carry its own date. **USER RULINGS, 2026-10-20 at 10:29:48Z (review session):** authenticating daemon reads is "Split: local-tools first": the local tools vessel's read shapes, file reads among them, are gated by 2026-10-21T20:00Z, since no caller reads them without a key, and the language-model resolver's reads by 2026-10-23T20:00Z, once its keyless internal callers send credentials. The gap lifecycle scan was closing armed gaps as expired and not re-detected while their armed checks were still measuring them, at a time when the system arms about one gap a day; the fix, in the file lifted for the system, is due 2026-10-21T20:00Z, sooner than proposed, and becomes an operator build if the system's own lane does not get there. **USER RULING, 2026-10-20 at 10:45:18Z (review session): "Report first, enforce by 20:00Z".** The daemon authorization gate ships reading a per-node policy that starts in report mode, logging which callers would be refused while still serving them; each node switches to enforce by 2026-10-20T20:00Z once its report shows that no legitimate caller would be refused. Only an administrator may change the policy, and whether already-provisioned service keys need the new scope is decided from those reports. **Reading, about 10:5xZ: an observe-mode probe batch, by user ruling at about 10:38Z ("qa runs them").** Six goals were drawn at random from the next run's frame, excluding that run's own goals, edit goals and anything naming the loop test's file; labels and verdicts were fixed before dispatch, and each was run once in observe mode. Of the five that finished: one trusted success (a live read of the model policy, returned unsummarised); one false reach, where identical content was first judged hollow and then reached on a retry, after the walk appended an unrelated report whose name matched the goal; and three honest non-reaches. In one, the deterministic pre-gate correctly refused a plain completion about the system that consulted none of its data, which the judge alone would have credited, while the system's own memory shape sat among the candidates unchosen. In another, an off-topic personal question was matched by a word to the system's own spend reports, and no outcome for declining existed. The fifth was a truncated fragment, for which no "not a coherent goal" outcome exists. Takeaways: the deterministic pre-gate earns its keep; the judge is not consistent on identical content; a declined outcome is missing; and target inference picks shapes by name rather than description. Observe was honoured, with no writes, but two status lines misreport under observe, a recurrence of an earlier closed defect. The sixth probe, about recent changes, had the answer in hand by its second step, chose end targets nothing could produce and wandered through stale learned bridges, then ended with a final output too large for the judge to read; the tally is one trusted of six, one false reach, and four not reached, two of them abstentions on an oversized deliverable. **USER RULINGS, 2026-10-20 at 11:00:00Z (review session):** goal-target inference chooses only producible end targets and stops when the goal's answer is already in hand, a class that has returned twice after closing, by 2026-10-22T20:00Z, sooner than proposed; the full-view judging gate, due at eight this morning, is recorded as missed, and it and its sibling, judging an oversized deliverable through a goal-aware trimmed view, are due 2026-10-21T20:00Z; and the local tools vessel stops echoing command text back into shell results and its log, where a credential inside a command would leak, by 2026-10-20T20:00Z with the daemon authorization fix. **USER RULING, 2026-10-20 at 11:00:23Z (asked directly in the docs session): the scope bundle is lifted for the system's lane,** each lift with an undo record: "Reach gate + judge files, Post-land 240 s kill, 1+1b+2: visibility & safety". The judge-rule files, where the reach gate's fixed verb list and the system's own judge regressions sit, open to the system so it can repair its own grading, while the deterministic pre-gate and the protected judge tests stay excluded; the post-landing test runner opens so landing credit stops being noise; and the check record, the isolation of test children from live state, and scope at intake paired with arming before a lift open as the visibility and safety items. Not chosen: deferring them all. Operator builds already approved on some of these files stand. **USER RULING, 2026-10-20 at 11:03:21Z (asked directly in the docs session): "Split: 6 now, 2 after builds".** The user saw first that lifts are whole-file: the compose engine, the runner that executes checks and the landing pipeline open in full, and one file sits in an otherwise closed judge core, while the pre-gate and every protected judge test stay excluded. The six files without a pending operator build (the reach-gate and judge-rule files, the test-child isolation, the test runner and the landing cutover) are lifted now; the compose engine and the check-record file are lifted right after their approved operator builds land, so nothing ships on a lifted file inside its window. Files are named exactly, no directory entry or protected test changes, and the scope record is compared before and after. **USER RULING, 2026-10-20 at 11:10:33Z (asked directly in the docs session): "(c) Wait for a matcher exception".** The three judge files had no exclusion of their own; they were excluded only through whole-directory entries that also cover files the user kept closed, the deterministic pre-gate among them. Removing a directory entry would open too much, and replacing it with an exact entry per remaining file would leave the directory open to any new file by default. The development-vessel half lifts now; the three judge files wait for an operator build in the lane's scope matcher that lets a directory stay excluded except for named files, so the judge directories stay closed by default. **USER RULINGS, 2026-10-20 at 11:12:36Z (review session), each sooner than proposed:** the lane's scope rules can exclude a directory except named files, an operator build due today, 2026-10-20T20:00Z, after which the three judge files are lifted; the tool-access gate keeps its enforce mode across a restart even when its policy cannot be read, by 2026-10-22T20:00Z; and a finished shell command leaves no watchdog process behind, by 2026-10-21T20:00Z. **Correction:** the earlier readings here that the verification call is cut by a fixed fetch timeout, or by a missing timeout setting, are not established. The bound counts from when the process starts, so under load the suite most likely exhausts its own shorter limit while waiting for a test slot; the cause is being measured, and the remaining-sites build waits on it. **USER RULINGS, 2026-10-20 at 11:31:43Z (review session), on items due 2026-10-20T20:00Z, recorded as misses rather than moved dates:** keeping every judge verdict of a dispatch, held-out readings using the final verdict, recording a goal's acceptance predicate with an independent verifier, and the grammar half of the shared package are MISSED: they were built but held on one unpushed stack. The held changes are reviewed and the first two land by 2026-10-21T20:00Z; the predicate-and-verifier design is redone first, because as built it would not have stopped the last run's false reaches, by the same date. The dispatcher's inbound authentication is MISSED, new date 2026-10-21T20:00Z, not added to today's queue; the judge-credit and person-reliability repair is MISSED, new date 2026-10-21T20:00Z. The hold on the federation relay directory, and three related federation holds whose review had lapsed, are reviewed on 2026-10-22T20:00Z, since no hold stands without a date. **USER RULINGS, 2026-10-20 at 11:38:53Z (review session):** a landing lease names the process that holds it, and a lease whose holder is gone can be reclaimed with a reason, so a vessel restart no longer blocks every other landing on a file for the lease's full term, by 2026-10-22T20:00Z; every reader of the scope record honours directory exceptions, so lifting a single file inside a protected directory takes full effect, gap routing and escalation included, by 2026-10-21T20:00Z; and the escalation check fails closed, never answering that an edit is allowed, when it cannot read any copy of the scope record, by 2026-10-21T20:00Z, sooner than proposed because it is a security matter. **Reading, about 11:5xZ: why open gaps never get a check.** Of the open gaps without one, the largest groups have no file location, so check writing never runs (mostly detector-filed), or name nothing in their file that a test can check; others target excluded files, were never picked up, were turned away by the busy compose slot, or failed at dispatch. One run node's lane was idle while the other's single slot refused work, and the one gap the funnel closed had cleared on its own rather than been repaired. **USER RULINGS, 2026-10-20 at 11:51:54Z (review session):** check writing and compose work go to a node with a free slot rather than to the busy node that holds the gap store, by 2026-10-21T04:00Z, sooner than proposed, so the first end-to-end loop test is not stalled on a known placement fault; the fix is general and lands as a recorded intervention inside that test's window. The lane's dominant exclusion, gaps parked as needing information with nothing draining them, is fixed by 2026-10-23T20:00Z, after the gap-check grammar and the detector re-arming fixes land. **USER RULING, 2026-10-20 at 11:53:51Z (review session), security:** even with a readable scope record, the escalation check answered that an edit was allowed for a path containing a parent-directory segment, and never checked targets outside the vessel repositories. It must normalise a target path before matching it, so such a segment can no longer slip past an exclusion, and must check targets outside the vessel repositories against the scope too, by 2026-10-21T20:00Z in the same build as the fail-closed fix, sooner than proposed. **Reading, 2026-10-20 evening: the gate changes landed at 17:44:50Z, and the three-file development-vessel lift MISSED its window.** The review session stalled from about 12:00Z to about 17:30Z, so its pushes and the lift package waited; the lift was not run before the 18:00Z hold expiry and is recorded as a miss. It will be regenerated from fresh live records for a later run. The review session also recorded as its own miss that it did not put the lift's sequencing question to the user in time. The gate changes were accepted on both run nodes by 18:32:31Z, so the one-pass soak setting is live. Every code item due 2026-10-20T20:00Z is pushed: the local tools command-echo fix, the daemon authorization gate in report-first mode, the directory-exception matcher, and the expected-output rebase. Whether each is met or missed is decided at 20:00Z by its convergence on each node and, for the daemon gate, by the switch to enforcement. **USER RULING, 2026-10-20 at 18:45:46Z (review session):** the rhythm pacing fix, under which the conductor backs off on the same CPU pressure as the deploy gate, MISSES 2026-10-20T20:00Z because its fix regressed a test in the suite and alone; new latest-by 2026-10-21T20:00Z. **MET by effect at 18:43Z on both run nodes:** the local tools vessel no longer echoes command text into shell results or its log; a planted fake token was absent everywhere. **USER RULING, 2026-10-20 at 19:00:10Z (review session):** a maintenance goal that its own detector dispatches every ten minutes, and that fails every time, because a learned variant's saved configuration lost a required binding and because it runs on nodes that do not hold its data, is repaired by 2026-10-21T20:00Z, sooner than proposed: the broken variant is retired or re-extracted through the system's own path, and the goal is dispatched only where its data lives. Reading (qa, verified by docs 2026-10-20 ~19:15Z): the first autonomous landing on the remote branch since the previous one is a check-only commit, not a repair — it meets the letter of the autonomy criterion but not the headline. The landed check asserts a report shape and a field the resolver does not return, so it is red for the wrong reason (a confabulated contract, law 8); it runs without dry_run, so a keyed runner would file gap rows on every run; and its staged base is the empty-file hash. Clean system arms or fixes today: zero. The lift dry run failed closed at its first effect because the converged matcher calls a helper the extraction does not carry; nothing was written, a builder fix follows, and the lift deadline holds. Ruling (user, 2026-10-20T19:37:16Z, two answers): the local tool daemon's auth gate moves to enforce where its report reading is clean and stays in report where it is not. On the node whose report showed only its own internal calls admitted (the one would-refuse was the operators' own keyless test call), enforce is switched on now with a thirty-minute watch and an immediate revert on any refusal of internal traffic. On the node where the dispatcher's walk calls the shell with a key that lacks the tool-execution scope, enforcing would break every walk's shell step, so that node stays in report and its 20:00Z item is recorded MISSED; the repair grants the scope to the dispatcher's existing key through identity (no rotation), upgrades the seed for already-seeded nodes, and re-reads that node in report before enforcing, by 2026-10-21T20:00Z. Reading: the dispatcher's key there is distinct from the node key, contrary to the setup's assumption; the report window was about twenty-five minutes and the LLM resolver made no calls in it, so its behaviour under enforce is unobserved. Ruling (user, 2026-10-20T19:51:20Z): when a person's defect report, typed into the human surface, runs as a goal, falsely reaches (the judge read the whole output but never checked its subject), and the reach mints a live, selectable template from an unrelated fetch, the operators file the class and do not remove the template by hand: nothing re-checks a mint after its source reach is labelled not reached, because the verification labels have no reader. The template is the class's first instance and its check; it is retired only through the system's own retire path once that path runs again, and until then it stays selectable and every selection of it is logged. Ruling (user, 2026-10-20T19:52:48Z, dates accepted as proposed): that row is repaired by 2026-10-22T20:00Z; a second row, gaps closed because a producer now exists that reopen when the producer drops (repeated reopens, so the closure is not durable, law 7), is repaired by 2026-10-23T20:00Z. Reading (qa): the surface's page view showed only the first two thousand characters of an output with no mark of the cut; a partial-page mark is in review, and reading the full output is a second need on the existing output-by-id row. Reading (qa, the 2026-10-20T20:00Z window, rows read back): MET by effect — the local tool daemon no longer echoes command text (both nodes); the directory-exception matcher is live on both nodes and the three-file lift was re-checked against it; the daemon's auth gate is enforcing on the clean node since 19:53:59Z (a keyless shell call refused with the handler never run, an admin call admitted, a keyless LLM-resolver write refused, the model policy byte-identical before and after; the watch for refusals of internal traffic runs thirty minutes). MISSED, stamped 20:00:38Z and re-dated 2026-10-21T20:00Z: the daemon gate on the other node (by the 19:37:16Z ruling), the judge keeping every verdict of a dispatch, held-out readings on the final verdict, an acceptance predicate with an independent verifier, the dispatcher's own grammar copy replaced by the shared one, the dispatcher's inbound authentication, the judge-credit and person-reliability repair, and the rhythm fix (its check red at the tip, reproduced in two independent records at low load). The three-file lift missed its window, is regenerated and re-checked, and runs before 2026-10-21T09:43Z. NOT ASSESSED, no reading taken: the human surface sending observe, a node accepting only its issuing hub, and the learning store's health protected from template-list bursts — an unread row is neither met nor missed, so each needs a reading at the next window. Reading (a read-only database check under the standing read ruling): on one node the identity service's key tables carry no database permissions, so they are closed to everything but root; three of identity's four schema migrations were never applied, nothing records which ran, and their automatic application is switched off by an environment flag. Isolation between organisations for API keys therefore rests only on identity's own code running as root, while the standing rule is that isolation is enforced in the database; a scope grant written through an admin-scoped session would be refused there. Ruling (user, 2026-10-20T20:25:38Z): the grant of the tool-execution scope to the dispatcher's existing key runs inside identity on the same path that issues keys today, with every check in code, still by 2026-10-21T20:00Z; the isolation gap is filed separately — the missing migrations are applied on unit start, recorded and not gated by the environment, after a dry run on a copy, because a strict schema drops undeclared fields from live rows — by 2026-10-22T20:00Z (user, answered to docs 2026-10-20T20:27:15Z); the dry run first compares the live key rows' fields with the strict schema's declared fields, and the class's detector, a per-vessel comparison of declared and applied migrations, is linked to the same row. Reading (qa): the thirty-minute enforce watch on the clean node closed without refusing any internal traffic, and the human surface's partial-page mark is live on both nodes. Correction (qa, verified by docs in the dispatcher's label consumer): the 19:51:20Z entry's "the verification labels have no reader" is too broad. A reader exists, but it acts only on a label from a principal holding the human-verdict scope, where it corrects that run's reached flag and files a disagreement gap; it ignores automated labels and never revisits a template built from that run. So even a person's own verdict through the human surface leaves a template minted from a false reach selectable today — that is the precise gap the 2026-10-22T20:00Z row repairs. Reading (a read-only check, field names only): every live key row on the node checked carries a field the issuing code writes and the strict migration does not declare, so applying it as written would silently drop that field from new keys; the isolation repair declares or renames the field before the strict definition goes on, and the dry run compares exactly this. Reading (qa): when a node routes work to another node (the placement repair and the existing compose-owner lookup), it sends its own API key over plain HTTP to whatever address discovery supplied, and on a hub or standalone node that key is also the seed account's password; today this never happens only because discovery hides the other node, and the night's peer-discovery repair would have switched it on. Ruling (user, 2026-10-20T20:43:56Z): same-host peers only, tonight — discovery admits another node's entry only when that node authenticated as a fleet member and the entry's address is on the same host, so the key never leaves the machine, and the sending side also refuses to attach the key to any non-local address. Remote peers wait for a scoped cross-node key carried only over https or the overlay, filed as a security gap and repaired by 2026-10-23T20:00Z (user, answered to docs 2026-10-20T20:46:39Z); until then routed work does not cross machines. Reading (qa): the check-writing lane throttled itself because a failed dispatch was rewritten as dispatched and then counted as failed again, hundreds of times for some rows; the repair counts each attempt once, but the node's learned pacing stays at its floor (about one round every two days), so recovering by learning alone would take over a year. Ruling (user, 2026-10-20T20:50:25Z): the system re-derives tonight — a system activity re-derives the node's pacing from its own settlement records, removing only the duplicate counts and never a genuine failure, once, after the repair is live, with a dry run first and a recorded intervention the system can read; it is not a hand reset. It falls inside the first end-to-end loop measurement's window, so that reading names it as an intervention (law 12). Ruling (user, 2026-10-20T20:57:49Z): the key-scope seed change for the node whose dispatcher lacks the scope needs a behaviour test added to the coverage file so the setup seed keeps updating in place after tonight's exemption expires; the automatic permission check refused that step for the builder and nobody routed around it, so the seed change is delivered by an image rebuild and a recreate of that node, which the user runs after exporting its runtime state and journal. Correction and ruling (user, 2026-10-20T21:03:37Z, two answers): the preceding entry's reading was wrong — the pacing collapse is mostly NOT double counting. No per-attempt record existed before tonight's repair, so the re-derivation cannot be done honestly, and even removing every attributable count leaves the rate below its floor; the re-derivation is withdrawn, the slowed node stays slow, the other node carries check-writing, and what produced the remaining several hundred failures is the open question on the rhythm row. Discovery's same-host admission scope ships tonight as a code constant and becomes a readable policy by 2026-10-23T20:00Z (law 1). Reading (qa): built tonight and not yet pushed — the peer-discovery repair (same host, declared shapes only, inert until both nodes declare) and a refusal of hollow checks: a check that asserts a shape or field its target never returns is refused at both gates. Direction (user, 2026-10-20T22:21:18Z, verbatim): "Since we have the hub and freshfleet we shouldn't need to stop our development to see evidence for autonomy. We should be able to keep participating even after the system can participate itself." Registration (qa, before any window data, replacing an earlier freeze-based proposal that was never registered): the decisive works/doesn't-work test of self-repair runs two arms with no freeze — the live fleet, where operators keep working and a closure counts only if every link is system-attributed, and a fresh fleet on the hub with no operator act at all, as the counterfactual. An autonomous closure has six links: a detector-filed gap; a system-landed check, red for the gap's reason and not a contract mismatch; a system-landed fix to the edit site on the remote branch; the same check green under the checker, closed by the landing verdict (expiry, producer-now-exists, operator and duplicate closes never count); no operator hands on that chain from filing to a day after the close; and no reopen or revert within that day. Verdict over 72 hours: WORKS is at least five in the live fleet across two or more vessels and at least two in the fresh fleet; DOESN'T WORK is none in either, after which every funnel stage is read; anything else is inconclusive and the throttling stage is named. An operator act on the loop's own machinery is logged, and a closure overlapping one is reported as assisted, never autonomous. The window opens once the loop's known breaks are live by effect. Reading (docs): this measures the self-repair half of the goal only; reach on random goals within one or two attempts is measured by the random-goal runs, and the window's opening needs a latest-by date so it cannot become an indefinite hold. Ruling (user, 2026-10-20T22:23:16Z, two answers): the registered two-arm test is adopted as the measure of the self-repair half of the goal, thresholds fixed as registered; reach on random goals stays with the random-goal runs. The window starts now on the live arm only — T0 2026-10-20T22:23:32Z, ending 2026-10-23T22:23:32Z — and the fresh-fleet arm joins when it exists, with its own seventy-two hours; the loop breaks still open at T0 are named as conditions of the result and each of their landings is logged as an intervention. Until the gap store records each write as an event (it keeps only the latest row), the no-operator-hands link is read conservatively: a write that cannot be attributed disqualifies the closure. Reading (qa, the diff verified by docs): at 22:20:26Z the system landed its own source fix, with no hands, for an armed gap in the check-writing lane — it skips gaps that only restate a discarded draft's failure rather than a defect at head, and the fields and naming it relies on exist in the composing code — so the diff does what the gap asked. The gap was filed by an operator, so it does not count toward the measure, but it is the loop moving from check to fix; its landing verdict is pending. Rulings (user, 2026-10-20T22:31:55Z): the fresh-fleet arm runs on its own model key capped at half the hourly spend limit; an active admin key named as a one-off and never revoked is revoked; the cockpit's next release ships with a per-session operator marker on every write instead of the shared default identity. Asked how the fresh arm should be isolated when the lander always pushes to the one shared branch, the user answered that the end state is distributed, decentralised autonomous operation in which managing vessel variants and code is part of the system, and asked how the architecture's principles apply. Ruling (user, 2026-10-20T22:35:03Z): the system's own fix in the check-writing lane regressed — its fallback skips every gap whose id carries the re-commit prefix, including rows without the discarded-draft marker, so at least one real defect gap is never supplied, and the landed check did not test that path; it is filed for the system to fix first, by 2026-10-21T20:00Z. Rulings (user, 2026-10-20T23:11:20Z): each substrate lands freely on its own line and offers changes to peers, who verify them as variants rather than having them overwrite their code; the fresh arm is a valid counterfactual only with its own repositories and credentials that reach only them, a distinct committer identity, no federation or discovery link to the live fleet, its own database, gap store and identity, seeding by its own detectors, and an export the measurers can read. Rulings (user, 2026-10-20T23:13:09Z): a high-severity injection in the dev vessel's causal adjudication, where a caller-supplied object is pasted into a database query (JSON escaping is not query quoting) and is reachable by any authenticated key, is fixed by passing the value as a query parameter at both sites by 2026-10-21T08:00Z; three gaps are due 2026-10-23T20:00Z — the cockpit records an agent session's interaction sequence so activities can be learned from it, the autonomous landing target stops being hard-coded to the shared branch, and a change landed on one substrate is offered to peers as a variant they verify. Ruling (user, 2026-10-20T23:28:18Z): before choosing who owns the fresh arm's repositories, the deployment session is asked what joining looks like for other network participants and how that shapes how vessel and activity variants are created and distributed; the fresh arm's super-repo points its submodules at its own repositories by editing the submodule file. Ruling (user, 2026-10-20T23:36:14Z, verbatim): "We assist if we are involved in the process or data we produced created provenance w.r.t the fix. e.g. We perform an investigation and file a gap, or read a trace and provide feedback, or alter the code and push. If our interactions run a goal, and that goal fails/reaches, and the system identifies some gap as part of that task and then closes that gap on its own. Then that does not count as assisted, and is the intended operation." Rulings (user, 2026-10-20T23:40:38Z): the fresh arm gets no test-specific name, because it joins through the same mechanism any peer inside or outside the network uses; and the protected fixture's count of advertised shapes is edited by one for the new gap-write event shape, count only, with a class gap filed so future shapes stop breaking it. Reading (qa): tonight's pushes were discovery's same-host admission, identity's in-code scope grant (a minute after the window opened, logged as an intervention), the dev vessel's stack, and the super-repo's seed change for the dispatcher key. Ruling (user, 2026-10-21T02:04:54Z, a date moved closer): a gap whose edit site is its own check file can be closed only by self-certification and loops until the lineage cap; its repair moves from 2026-10-22T20:00Z to 2026-10-21T20:00Z. Reading (research, 01:47Z): that self-referential re-commit loop now occupies both nodes' compose lanes — about five composes in two hours, each ending in the veto — and caused a lease collision; three hours twenty-four minutes into the self-repair window the count is zero autonomous closures and one assisted. Reading (qa): the gap store gains a write history the system can read — every gap write now appends one names-only event, readable as its own shape, pushed at 2026-10-21T02:36:20Z with the ruled count-only fixture edit; it is due 2026-10-21T08:00Z and met once live by effect on both nodes. Named debts: writes through the store's internal save paths emit no event, and the event retention window is not durable. Until both are closed, the no-operator-hands link of the self-repair measure stays read conservatively. Ruling (user, 2026-10-21T02:52:59Z, dates as proposed with the injection sweep moved earlier): by 2026-10-21T20:00Z, the sweep of the remaining database-query injection sites; by 2026-10-22T20:00Z, one fleet-wide rule for masking key ids (gap-write events keep only a short distinguishing suffix), a detector for failed image bumps, the stale parse of the gap-read snapshot, and the sibling of the producer-drop reopen churn (law 7); by 2026-10-23T20:00Z, discovery's peer list read from a shaped policy instead of the environment (law 1), write events from the gap store's internal save paths, and the class behind the verdict-diff golden fixture. Reading (qa, read back by the coordinator): the per-write gap events are MET by effect on both nodes ahead of their date — one names-only event per write, forwarded writes recorded on both sides with the original principal kept on the forwarding node, and no event-not-recorded lines. The three-file lift is complete on one node, written at 02:57:00Z with the lane reading the reduced set at 03:02:06Z, ahead of its 09:43Z deadline; on the other node the apply waits behind a live system landing lease on a lifted file and retries by itself before 05:02Z — the lift yields to the system's own work rather than overriding it. Correction (qa): from about 2026-10-20T18:10Z, check-ins that read the long-internal-call item as "no verify call since" were blind, not empty — the measuring matcher keyed on command text that the daemon's no-echo fix removed from its log lines, so it matched nothing. Re-read on a per-call instrument, a dozen main verify calls ran at roughly 250 seconds each and none exceeded 300, so the item (due 2026-10-21T08:00Z) is still not met, now on evidence; the instrument now raises an alarm when it matches nothing (a silent zero is not a reading). Reading (qa): the three-file lift is applied on both nodes — the second at 2026-10-21T03:27:37Z, verified by its read-back and the lane's own matcher, though the lane's own read within three minutes was not seen there — so its 09:43Z deadline expires unused. Ruling (user, 2026-10-21T03:36:43Z): the concept store accepts writes from a read-only key — it checks only that a caller is authenticated, so any organisation's key can create concepts, links and usage records, a poisoning path into the drafter's priors; every write requires write scope or the node's own identity, failing closed, followed by a sweep of other producers, by 2026-10-21T20:00Z. Rulings (user, 2026-10-21T04:19:12Z): the verification-label write accepts a read-scoped key, so any organisation's key can forge or contradict the oracle labels that reach and learning are graded against, which also threatens the integrity of the self-repair measure; it requires write scope or the node's own identity, failing closed, and a label claiming a human principal must carry that principal, by 2026-10-21T12:00Z. A class row: code that parses another service's log lines by their wording reads a wording change as "nothing happened", with no test binding consumer to producer; the preferred repair is shaped impulses, the minimum a producer-side fixture or an alarm on zero, by 2026-10-23T20:00Z. Reading (qa): the refusals of self-certification and of hollow checks, with tests for held paths, were pushed at 2026-10-21T04:19:43Z; met once by effect the self-referential row is no longer armed and draws no composes. Ruling on the self-repair measure (user, 2026-10-21T04:20:38Z, "System, unobserved"): a gap write made in-process, inside the vessel with no route crossed, counts as the system's by construction and is flagged as an unobserved principal; without this the no-operator-hands link would fail nearly every chain by construction. Reading (docs): this admits only writes no caller could have made directly; an operator act that triggers such a write (a push, a dispatch, a gap filed) still marks the chain assisted under the 23:36:14Z definition. Ruling (user, 2026-10-21T04:41:49Z, dates as proposed): identity's answer on the flat authentication path names the caller's scopes (defence in depth), by 2026-10-22T20:00Z; the verification-label read pages, so history past the newest hundred is reachable, by 2026-10-23T20:00Z; the goal-reach scan stops re-logging old refusals without their original time, by 2026-10-23T20:00Z. Reading (qa): verification labels carry no authenticated principal today — the labeler is whatever the caller declares; the label-write repair due at 12:00Z sets principal, labeler and source on the server, and until then the self-repair measure counts every earlier label in a chain's provenance as needing review. Ruling (user, 2026-10-21T04:43:16Z): when a node has no local producer, discovery forwards a resolve to a peer under the node's or the hub's key instead of the caller's, so the receiver judges the forwarder rather than the caller and today's per-producer scope fixes can be bypassed through a spoke; forwarding carries the caller's principal, by 2026-10-21T20:00Z. Correction (qa): the label-write repair stamps a server-set principal on every label, but the labeler and source fields stay caller-declared by design, since the server cannot derive them; the measure's review rule for earlier labels is unchanged. Ruling (user, 2026-10-21T05:10:55Z, "Allow the edits"): the concept store's write-scope repair may edit two existing test fixtures so that their authenticated-caller controls carry read and write scopes; no assertion changes and the must-fail half is untouched (a widening the user approved, not a loosening of what is checked). One of the two files is under a hold until 2026-10-21T15:01Z, and the edit waits for it. Ruling (user, 2026-10-21T05:20:06Z, dates as proposed): the resolver author's path that leaves a scenario template variable unfilled is repaired by 2026-10-22T20:00Z; by 2026-10-23T20:00Z, discovery's mutating shapes without the write suffix, the concept store's writes through its REST, MCP and unsuffixed paths, discovery forwards that leave no trace, and migration numbers that can repeat. Reading (qa, the 2026-10-21T04:00Z window): the check-supply rhythm repair is MISSED by effect — it shipped, but the supply tick last fired at 2026-10-20T22:06:51Z on one node and has not fired on either node since, across two restarts that carried the settle-once repair; a read-only diagnosis follows, then a build with a test that must fail first. It already carries the 2026-10-21T20:00Z date from yesterday's miss, and this is a second miss of the same item, not a new date. Placement and peer discovery are UNKNOWN by effect — no reading yet, so neither is claimed met. Consequence: check supply has been off for the whole self-repair window, from seventeen minutes before it opened, so the funnel's first three stages read zero and the end-to-end loop measurement due at 08:00Z will read its first stage — named as a condition of both results. Correction (qa, after the coordinator's read-only diagnosis): the preceding reading was wrong in its cause — check supply is not a regression and its tick is not dead; it is undue by cadence design. After one arm, its due formula pushes the next tick eighteen to fifty hours out, and the cheap bookkeeping (arming, outcomes, un-arming, hold release, placement) rides that same cadence, so the repair loop has been silent since 22:06Z with no arms in the window and eight dispatched rows awaiting an outcome — and the system cannot repair this itself, because arming its own check needs the stalled tick. The settle-once repair has never executed: unproven by effect, not met. Placement is NOT MET (its only caller is the undue tick); peer discovery is unknown (unexercised). The empty-registry lead was a detector false positive (an 800 ms registry fetch timing out under load). The end-to-end loop measurement at 08:00Z is recorded MISSED with this cadence as its cause. Rulings (user, 2026-10-21T05:35:53Z): the tick splits so bookkeeping runs every tick and dispatch only when due — the resolver half is an operator build due 2026-10-21T20:00Z; the halves that live in the scope-excluded rhythm conductor, including the empty-registry false positive, are also operator builds, with the scope record unchanged. Each such landing is an intervention named in the self-repair measure. Ruling (user, 2026-10-21T05:55:20Z, both by 2026-10-22T20:00Z): a selection that fails deterministically is demoted — one auto-draft dispatcher was picked twenty-seven times against twenty-eight identical failures without losing selection; and a repair-loop step that stalls while rows wait on it is detected, where today nothing notices (the instance is the cadence stall above). Reading (qa): idle-time work graded only by its exit status — several hundred idle completions, all recorded as success with no reach verdict — is a further instance of the existing exit-status grading row. Ruling (user, answered to docs 2026-10-21T05:59:57Z, a date moved closer): the check-supply split — the resolver half, the conductor half, and the repair to the write path for rows without a dispatch id — is live by 2026-10-21T12:00Z instead of 20:00Z, with no test cut; the resolver half alone would have no live effect, because the conductor never calls an undue tick. Met by effect when a bookkeeping pass runs about every ten minutes and each row waiting on a dispatch leaves that state by a verdict or a recorded loss with its reason. The registry false-positive repair stays at 2026-10-23T20:00Z. Reading (qa): dropping a failing model provider removed the payment-required detour but not the model-selection loop, which reinforces itself — the selector prefers capped free models, charges nothing for infrastructure failures, and a fallback rescue credits the model that failed rather than the one that served. Rulings (user, 2026-10-21T07:10:31Z and 07:10:55Z): the two small additive repairs — a provider credit or cap field on the quota state and crediting the model that actually served — live in the LLM resolver's entry module, which is scope-excluded because provider keys and egress live there and the matcher is file-grained, so they land as an operator build with the scope record unchanged; due 2026-10-21T20:00Z (the user chose today over the proposed next day), followed by the in-scope eligibility gate and a preference for paid models. Its landing is an intervention named in the self-repair measure. Reading (research, MET by effect at 2026-10-21T07:05:27Z): long internal calls are no longer cut at about 300 seconds — the learning store's main verify calls now run seven to eleven minutes and answer normally, with output, their own check run and a clean exit; under the user's conditional ruling of 2026-10-20T10:18:59Z the four held rows waiting on it are being released. Reading (qa, the diff verified by docs): at 2026-10-21T07:35:01Z the system landed, with no hands, a change to the learning store's prior seeding — when a signature is a machine identifier (a hash, a UUID or a cluster id) it now skips the concept search entirely and falls back to an uninformed prior, where the gap asked only to stop searching on the identifier text and still search by the template; it is landed but not yet verified and suspected over-broad, being measured, with a follow-up row filed, and any revert is the user's call. Correction (docs): the phrase "where the gap asked only to stop searching on the identifier text" in the preceding entry was inferred from the gap's name, not read from its row; what the diff does is verified, what the gap asked is not. Reading (qa, the 2026-10-21T08:00Z window): MET by effect — the per-write gap events, the overlay key guard, and the end of the 300-second cut; MISSED — the end-to-end loop measurement (cause: the check-supply cadence) and model-plane failures no longer blamed as execution errors (no repair landed); LIVE but not yet read by effect — the database-query injection fix; three items not yet read. Rulings (user, 2026-10-21T08:11:46Z, four answers): the model-plane blame item is re-dated to 2026-10-21T20:00Z, aligned with the LLM-plane build that is its repair; the system's own over-broad prior-seeding landing is reverted now by an operator through the guards (the user chose this over keeping it with a follow-up — it restores template seeding at once and puts operator provenance on that code); the repair for expiry closing armed gaps, which saw no system progress because the lane was silent by cadence, is staffed as an operator build now, due 2026-10-21T20:00Z; and five new rows are dated — the rhythm timer that aborts at thirty seconds while a due pass can take sixty by 2026-10-22T20:00Z, and by 2026-10-23T20:00Z the gap write without a conditional check, conductor passes that can overlap, and two LLM-resolver side bugs (an ordering crash path on a missing key, and a stop by kill that writes no abort row). Reading (qa): the check-supply cadence split and the self-certification follow-up were pushed at 2026-10-21T08:12:08Z, due live by 12:00Z. Reading (qa, from the coordinator's read-only reads, the rest of the 08:00Z window): the database-query injection repair is MET by deployed code — the live file carries no raw interpolation and every exercised path stamped cleanly, though the original lookup path has not run since; crediting from a validated-success flag rather than a reach verdict is MISSED (the crediting file is unchanged; one sub-path met by effect, others landed but unexercised, three missed); learners skipping test-output records is landed on both nodes but UNPROVEN, since no learner pass has run since; the maintenance-lease half of caller-supplied lease holders is MISSED, with no build. Pushed ahead of their 20:00Z dates and not yet met: the concept store's write-scope repair (converged on one node with no refusals so far), discovery's refusal to forward under the forwarder's key, and the LLM-plane package (a condition on any reading of model grading that spans its convergence). The check-supply cadence split is HELD on one node: the gate's suite was killed at its wall-clock limit under host load with no result, so the gate went blind and nothing was promoted — the time-limit class again — and its 12:00Z live date is at risk. Rulings (user, 2026-10-21T08:34:00Z, four answers): the two items missed at 08:00Z — crediting from a validated-success flag instead of a reach verdict, and the maintenance-lease half of caller-supplied lease holders — become operator builds due 2026-10-21T20:00Z; the user makes one real exposure on a human surface to fire the learner pass, so that learners skipping test-output records can be read by effect; and if the cadence split's next gate on that node is also blind, host load is reduced first — operators pause only their own non-essential load, never a system unit — and the next tick runs, leaving the gate's time limit unchanged. Operator review runs and suite starts are held until the cadence split is promoted on both nodes. Reading (qa, the last six 08:00Z rows): MET by effect — the gap store's per-write history (no key-like values, the refusal control present) and the compose verify call no longer cut at three hundred seconds (six calls ran past it and answered; naming the limit is still open); UNPROVEN — the same-host key guard on overlay rows, landed but not yet exercised; MISSED — trace and goal-path writes taking their organisation from the request body, a forwarding node being unable to direct a gap, and the corrupt pattern in the scan for environment gates. The cadence split's hold is not a kill: one node's suite finished inside its limit and the protected step was then deferred by the CPU-pressure guard. Rulings (user, 2026-10-21T08:45:00Z, four answers): organisation-from-body is an operator build due 2026-10-21T20:00Z; a forwarding node directing a gap is due 2026-10-23T20:00Z; the scan pattern is an operator build due 2026-10-22T20:00Z; and a new high-severity hole — compose's model failover can send the node's API key to a target off the host — is an operator build due 2026-10-21T20:00Z regardless of the other work queued for it. Rulings (user, 2026-10-21T08:55:19Z, two answers): a new high-severity hole — the dev vessel's test suite writes fixture records into the live compose-lessons and shadow logs on both nodes at every gate run, and compose lessons are read back into drafting prompts, so tests poison the drafter — is an operator build due 2026-10-21T20:00Z; and if the cadence split's gate keeps deferring under CPU pressure, the two co-hosted nodes are serialised — one node's pull-sync ticks are held until the other's lands, then resumed — with no gate or threshold change, logged as an intervention. Reading (qa): the second gate run on the first node was killed at 08:52:20Z after its main suite completed, and both nodes are now deferred at the protected step.
      - **USER RULING, 2026-10-19 about 07:3xZ (asked directly in the docs session): container gate runs move to the hub host.** About eight changes due by 2026-10-20T20:00Z each need an in-container test run at low load, and the run node that gates them sat above its load ceiling for most of the day under the live system's own work, so items risked missing for want of quiet time rather than code. The runs now use throwaway containers from the accepted image on the hub host, already authorized for builds and throwaway fleets, with resource caps, full teardown, and an isolated configuration that cannot reach the live hub; only the short comparison against the run node's live copy still waits for a quiet moment there.
        - **The remaining leak route is located:** a development-vessel test builds its child process's environment from scratch, which bypasses the scrubbed environment. It wrote fixture keys on one node shortly after 08:00Z. The permanent guard is not in the user's priority order, so the merged run's zero-fixture-key condition is met by timing: the final cleanup runs after each node's last development-vessel test run, the hourly check must read zero just before T0, and any test run after the cleanup forces another cleanup.
        - **FINDING:** the landing gate installs different dependencies from those deployed (several library versions and extra packages), so the gate tests against something other than what production runs. It is filed as its own class: identical behaviour wherever deployed (law 11).
        - **A hollow-landing instance (found by the coordinator):** an autonomous landing on 10-02 was credited without ever turning its own check-first test green, and the post-land check did not flag it. It is filed as detector evidence for the closure demonstration, the class "landed without its own falsifier passing" (§7 step 5).
      - **CHANGE-04 and CHANGE-05, and the learning reading (recorded 2026-10-15T05:20:20Z; ruling times from the transcript):**
        - **CHANGE-04, culpability** (user ruling 03:45:44Z; pushed about 04:04Z; gate green).
          - **The history:** an earlier change reused success-credit's rule that "a receipt is not work" for failure-charging. So a step that claims a read deliverable but returns only a receipt escaped blame.
          - **The change:** for failure-charging, only receipt-only **write** steps are exempt.
          - **Live:** failure is now charged on 73% of failed-content verdicts, against 12% before. The dominant failing producer was charged for the first time, and "no producer identifiable" fell to 0.
        - **CHANGE-05, reconcile** (user ruling 04:23:09Z; pushed 05:19:29Z; gate green).
          - **The history:** an earlier credential strip assumed template configurations never pass through the walk's pointer builder, and they do. So the trace-store reconcile repaired the store, lost its lease token at release, and was graded failed.
          - **The change:** the existing pattern that keeps a field as data gains its credential counterpart, with one entry: a maintenance lease keeps its own token. Every other credential field is still stripped.
          - **Live reading (recorded 2026-10-15T07:11:29Z): UNVERIFIED, not refuted.** Since it converged, no reconcile has reached the release step: each fails earlier, on a parse error. **The cause is a startup race in the walk service.** On one node, two boots lost a proxy registration, so the vessel's shapes ran through the discovery proxy, which pastes an object where text belongs. The race fix (B13) is gate-green and user-approved (06:27:32Z), and pushes after the slice.
            - **The probe rounds 6 and 7, and one credit change's live reading, ran on that node's degraded proxies, so they are confounded.** That includes the one learning instance.
        - **THE LEARNING READING** (pre-registered; round 7 against round 6; 20 of 20 captured; the instrument fixed before round 7):
          - the approach differed on 10 of 20 goals;
          - **1 LEARNING INSTANCE:** a goal failed for an unsourced answer, took different steps, and **reached with a sourced answer;**
          - **causal attribution to the failure-charging changes is NOT established:** the charge had gone to a different step, and the reach followed two hollow attempts within the same run;
          - **honest reach is flat at 3 of 20.**
        - **The system's own reach, without the probes:** **0–9%** across tonight's windows. The 13% headline came from the probes.
        - **A recurring false-reach class, across five rounds:** a verifier that answers a different question, such as a total for a subset, or a file count for a trace count.
      - **The next slice run, pre-registered (written by qa before the run; recorded here at 2026-10-15T03:19:22Z):**
        - **Precondition:** no credit refusal and no de-advertise on the model route in the run window. Otherwise the result is **unknown (environment),** whatever the gate printed.
        - **Reached:** this counts only after the **trust check.** It would be the first **assisted** slice reach on its learned pathway, since operator acts touched its path: the template deadline write and B1–B5. **The autonomy count stays at 0.**
        - **Not reached, with a recorded reason:** the reason names the next break. **It must be a new reason** (user ruling). A known reason recurring is recorded as a process failure.
        - **The floor reaches with grounding while the template does not:** both are recorded, and the template's reason is the next break.
        - **Unknown (environment):** a null verdict, or a failed precondition. It is not counted either way, and the known retry and gap-filing misfires are recorded but not counted.
        - **The trust check, because the same gate certified a false count in every probe round:** within 10 minutes, take an independent read of the same aggregate over the same window. The reach is **trusted** only if the counts are numeric, not placeholders; the top rows match within 5%; and the orphan section is present. **Otherwise it is a false reach,** whatever the gate said.
        - **Amended before the run (written by qa before the run; recorded here at 2026-10-15T05:21:14Z): the later changes are in the slice's path.**
          - **The two credit changes have been served on the loop goal's node since 04:13Z.** They affect credit on the slice's verdicts and the posteriors that selection reads. They do not affect the reach verdict itself.
          - **The reconcile change** was pushed at 05:19Z and was not yet served at 05:20Z. It is in the path if it converges before the run, because a smaller, reconciled trace store makes the count reads faster.
          - **The attribution rule:** any slice reach is attributed to the **combined served state** at run time (the read deadline plus the batch and changes served then), and labelled **assisted.** It is never attributed to one change alone. The served set is read at the run.
      - **USER RULINGS (relayed by qa, about 2026-10-14T23:58Z–00:00Z, verbatim):**
        1. "We can't allow it to be able to execute goals that don't reach. It should not be possible to not reach consistently. Everything needed is already available, but just a step further away, but the whole purpose of the system is to take that step."
        2. "We have clearance to make direct changes, batch and push them such that the reach rate for arbitrary goals and the learning mechanism can be demonstrated before the next loop goal."
      - **BATCH-01, pre-registered BEFORE landing (recorded 2026-10-15T00:10:00Z).** Batching lifts the one-change-per-window rule for this batch only (the user's top-up and "verify and run the probes" came at 00:57:33Z; "build the floor reason logging now" at 02:36:56Z; "build the supersede change too" at 02:41:42Z, all from the transcript); records, reviews and push guards remain. **The selection rule (§6.1.3):** only joints that restore the system's own ability to reach or learn, and no patches specific to one need.
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
- **The close record:** **closed 2026-10-19T04:37:44Z on the opened node, about 21.5 hours after it fell due, by the user's ruling "Apply the close now"** (asked directly in the docs session about 03:5xZ). The condition was not met: no landing in the opened file was both system-authored and consumer-verified (honest count 0 strict). The close was overdue because nothing applied it at the due time: a pre-committed close that depends on an operator act lapses silently, which is itself a gap. The act: the pinned scope value was updated first and accepted by that node's gate (04:35:29Z); then a user-run, tighten-only write re-added the file to the excluded paths, 269 to 270 entries, refused on any change since the read, with both live tightening holds kept. Verified by effect: the read-back equals the accepted pin; the lane's own exclusion function at that node's running development-vessel excludes the file and every previously excluded entry; and the lane's next scope read reports 270 excluded paths. No landing was in flight on the file; 160 open gaps name it as their edit site and are now outside the lane. The other run node never had the file open, and the public spoke holds no record. The hub's record is unconfirmed and is on its return-to-service list. One other entry leaves the pinned value at the same time, a source file the evaluator had held tight until 10-18. That is the recorded expiry of a time-boxed tightening, chained from the previous pin as that pin's notes said it would be, not an opening. Any reopening is decided on its own evidence.

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
