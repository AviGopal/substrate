# CANON: the realignment principle set (2026-09-29)

**What this is.** Three consolidations of `classes/_principles.json` (1,283 statements, split by index mod 3) merged into one canon. The first gave 20 principles, the second 26 and the third 24. After deduplication there are 18 laws.

**How to read the references.**
- `#n` is an entry's index in `/home/avi/documents/work/substrate/validation/reports/realignment-2026-09-29/classes/_principles.json`.
- "L1 to L13" are the CLAUDE.md laws.
- "OM" is the user's operating model of 09-29, in memory `project-operating-model-route-around-then-encapsulate-2026-09-29.md`.
- Class keys refer to `classes/<key>.json` and `dossiers/<key>.md`.

**Amended 2026-10-02** (continuity amendment, `CONTINUITY-AMENDMENT-2026-10-02.md`; integrated into REALIGNMENT §10): §1's "middle", evidence figures and autonomy criterion, K3, C8 and §5 were reconciled with REALIGNMENT. The withdrawn readings are kept, marked as withdrawn, so they cannot become current thresholds.

**Warning, the P0 finding.** Nothing in this document is new. Every law below has been written down before, and most of them several times. For example, "negative unattributed" was learned at least 10 times before it was written (#1203), and WORKING_SYSTEM_EXPECTATIONS says "asked seven times, answered seven times in prose; prose did not stick" (#1143). This canon only earns its place if §5 is done: every law gets a runtime reader. Otherwise it is restatement number eight.

---

## 1. The end goal

The substrate is a decentralised fleet that develops itself. Given any goal in natural language, it walks the shape graph to a useful, verified output.
- **Floor:** at worst it matches a ReAct agent. The walk routes around missing capabilities, bad formats and errors using tool-enabled fallback, and every step is traced (CLAUDE.md execution expectation, #11; OM).
- **Ceiling:** at best it reuses a learned pathway.
- **Middle:** it reuses the characterized portions of a learned pathway and adapts the uncertain connections wherever they occur, not only at the first or last mile (amended 10-02; REALIGNMENT §2.0b).

It reaches its answers from existing, versioned resolvers first. It **encapsulates** a new capability only when traces show that a routed-around need recurs. It then reuses that capability, and it chains outputs into new goals (OM, L3, L4).

Its history, meaning traces graded against independent ground truth, decides what to do next, what to learn, and what can wait (L5, L7). Every shape is reachable from every node over p2p, so absence in one place is not absence (OM, L11, #30/#33).

**Done means** an end-to-end path runs across nodes and reaches its goal. An execution completing, a consumer using its output, a learning update being stored, and that update changing later execution are four separate claims (amended 10-02).

**The autonomy criterion** has two levels (amended 10-02). The **self-development milestone** is a substrate-authored commit on origin/dev, with no operator hands, whose effect is verified at the consumer (#13, #784, #965). The **broader criterion** is sustained continuation and learning within granted authority. Legitimate human participation is not an autonomy failure; repeated human reconstruction of lost inputs, context or history is a continuity defect.

**The failure** is the same issue recurring for the same reason. Trying things that fail is not the failure (OM, #1227).

What this goal has never had is one end-to-end build (OM: "never once built so that it works end to end"). Evidence of how far the build falls short:
- **Corrected 10-02 (REALIGNMENT §1, R3-1, R3-8).** An earlier version of this line read "learned-pathway reach is 30.8%, against 3.0% for fresh derivation (#263)". That is **withdrawn as a reach figure**. 30.8% (860/2,788) and 3.0% (485/16,165) are lifetime validated-success counts from `goal_execution_paths.successful_executions`, a counter family ruled unreliable, so the contrast is indicative only. **Reach by tier is unmeasured.**
- **Corrected 10-02.** An earlier version read "the floor tier reaches about 2% of the time". That is **withdrawn**: the ~2% (7/7,197) was an artefact of a first-run flag summed against lifetime execution counts. Floor reach re-measured on 09-29 from goal-host's per-run LLM-judge verdicts was 12.6% on node 1 (161/1,276) and 24.1% on node 2 (59/245), with denominators that depend on journal retention. These are observations bounded by that time, node and instrument, not thresholds.
- A need that names no component had no entry point on 09-29 03:35 (#1112, commit 9c967329).

---

## 2. The laws (deduplicated)

Each law gives its **statement**, its **sources**, and its **bounds**. The bounds are reconciliations that the evidence supports but that no document states yet.

### K1. Every mechanism needs a standing liveness expectation, and a fix owes a class detector plus a caller
A mechanism fixed or built once decays without anyone noticing. So each mechanism carries "fired on real traffic within N", backed by an instrument, a value, a window and an n-floor. Every instance fix names the detector for its class, greps the sibling call sites, and wires something that actually calls the detector.
- **Sources:** #1116 MECHANISM-AUDIT, #1086, #1143, #1117 WHY-THINGS-KEEP-BREAKING (about 247 of 253 breaks were found by humans), #1085, #1211 (user: "the same class just one stage earlier"), #1259 (the cite-check checker shipped with no caller), #237, #114, L6, OM.
- **Bound:** a detector is growth. It counts against λ₁ ≳ ρ_grow (#712, K16). File a detector only when the class is attested to recur (#1030). Activity counts are not closure (#1165).

### K2. Everything behavioural is a shape read at use time
Env vars, config and literals are allowed only for identity, secrets, ports and the discovery endpoint.
- **Sources:** L1, #15, #297, #62, #88 CONFIGURATION_SURFACE §3, #545, #183, #744 (delete an inverted gate, do not set the env), #615/#984/#536 (model choice), #1124 (containment is a quarantine shape with a TTL), #977, #1271, #104.
- **Bound:** the bootstrap tier is the only sanctioned exception: kill switches (#1083), the two liveness watchdogs, and "provider pin is identity" (#882). See C10.

### K3. `reached` is necessary but not sufficient. Credit needs reach plus an independent verifier
Exit status, typecheck, `landed:true`, FAVORABLE, a sha or green CI are not outcomes. Read back the artifact the goal named, at the layer that consumes it.
- **Sources:** CLAUDE.md "`reached`, not `status`", #12, #34, #54, #84, #396, #625 (reached plus a landed sha checked out 0/4 on diff read), #948 (72 of 80 reached but 23 of 80 correct), #1245 ("`reached` is data, not a verdict"), #1063, #1248, #540 (a fix that lowers reported reach is correct if it removes false credit).
- **Bound:** a class earns credit only by gaining a deterministic verifier. Where there is no verifier, reach stays data (C2).
- **Bound (amended 10-02): three uses of evidence.** *Observation*: a specific consumer used a specific output under identified conditions, with an observed consequence. *Learning*: an attributed observation updates one transition's characterization, including its uncertainty and applicability. *Acceptance*: accumulated evidence meets the requirements of a named action (delivery, landing, closure, scope expansion). This law governs **acceptance**. A terminal verdict is one observation, not the only source of learning; consumption establishes use, not causal benefit; an unavailable observation is unresolved, never negative; a correction names what it supersedes, and duplicate delivery never duplicates an update. Partial learning never authorizes deployment (REALIGNMENT §2.2).

### K4. A negative is unattributed until a positive control shares its address
Absent, empty, zero, not-observed and failed are five different states. A zero read through a filter measures the filter. A truncated search does not establish absence. "Absent here" does not mean absent on a decentralised system.
- **Sources:** memory law file (09-15), #1203, #204, #933, #571/#745, #1147, #1220 (written 09-16, violated 09-17), #3 (the 08-09 filter removal was based on a false zero; 719 rows existed), #118/#1095 (SurrealDB treats a missing table the same as an empty one), #1204, #1261, #355 (a zero only refutes once the window is longer than the inter-arrival time), #1168, OM.
- **Bound:** #193 says "proceed on absence of evidence", but that applies only to *scheduling*, never to a verdict.

### K5. Verify at the consuming layer, on the executing artifact. Claims are not state
Read the receiver, never the worker's self-report. Committed, pushed, deployed, running, exercised and durable are six separate claims. The four trees (origin/dev, the push clone, `/vessels`, the process) are named separately. Commit messages, comments, checkboxes, summaries and subagent findings are claims.
- **Sources:** #1020, #394 (seven instances), #1126 (eight), #940, #574, #641, #575 ("three trees, name which"), #907 (the host `repos/` was 5 days stale), #829 (55 fixes certified on a warm host did not hold), #418 (only `is-ancestor origin/dev` counts), #1142, #1193 (violated at least 6 times), #822, #1266, #1080/#492, #1026, #777, #1023/#543 (honest parts, dishonest whole).

### K6. Every check must be proven able to fail, must have a caller, and must never read silence as a pass
Certify a check by the effect it exists to produce, and test it on a known-false state. Count `ran=false`. A laundered failure is worse than no check. The loop cannot report its own death.
- **Sources:** #90, #681, #1239/#911/#643 (the post-land suite ran `ran=false` from 08-31 to 09-28), #1050, #1118 (silence explains 64% of breaks), #1175, #1128, #1176, #1272 (a weekly CI with no secret, over 20 runs), #9, #349, #424, #1150, #772, #679, #1170, CLAUDE.md script retention.
- **Bound:** see C5 for when a check fails open and when it fails closed.

### K7. Every write names its runtime reader, and every reader names its producer
An additive-only diff is hollow until a reader is cited by file:line. An emitter with no subscriber is dormant. A shape no walk has resolved is a declaration, not a capability. Remove unread writes; do not relocate them.
- **Sources:** #1230 (user), #1066, #111, #936, #182 (f87f52f, "both readers, neither producer"), #845, #1065 IMPLEMENTED_DORMANT, #1119, #0/#186 (projections drop keys), #123 (48bc174), #70, #814, #1093, #1061, CLAUDE.md "name its runtime reader", memory 09-15 `hollow_write`.
- **Bound:** retention is separate from readership (#7 vs #847/#37/#1225). A store with no reader gets a TTL *or* is kept as reusable evidence, and that choice has to be made explicitly.

### K8. One address per shape, routed by discovery. One field has one meaning and one writer
Reads and writes of one shape share one discovery-routed address. Never pin a peer. Store paths never come from env-with-fallback. Two writers with different rules for one field is the defect: fix the writing side.
- **Sources:** CLAUDE.md "route by shape", #30, #63, #110/#1178 (the `WORKSPACE_ROOT` split has at least 7 faces), #257 (the resolve-URL joiner: 6c98916 on 09-22 left about 9.8k invalid-URL failures until 5ca51be on 09-28), #270/#364 (248 escalations went to a pinned :8270), #441, #1233, #892 (per-caller failover is a band-aid), #979, #211, #124, #661, memory 09-24 (`staged_base_sha` carried two meanings, which deadlocked the lane).
- **Bound:** discovery stays a registry. It takes on semantics only as "refuse or fail loudly on an unserved shape" (#300 vs #294).

### K9. Learned state is a shaped impulse served where its data lives, and is reachable from everywhere
A node-local JSON holding learned state is a fork, not a replica. Stores only grow, so a drop in size is data loss. Place a store by data locality, and reach it globally over p2p. Share evidence, not weights.
- **Sources:** L10, L11, #798, #885, #24, #789, #288 (an env-derived path fork plus recency recall means amnesia by displacement), #786, #1071, #129, #1183, #1244, #248, #41, #233/#872.
- **Bound:** local placement is compatible with global reachability only if discovery federates *writes* as well as reads (#2, #1244), and it does not today.

### K10. Reuse before mint. Encapsulate on evidence. Retirement is automatic
Before building anything, run the existing producer with corrected inputs, including for the operator (#912). A wrong mint has negative value. Activities are earned by doing. Minting is cheap only if retirement is automatic.
- **Sources:** L3, L4, OM, #18, #57, #156 (407e3ed and 900bc69, the mint chokepoint), #235, #260 (48% of arms never run), #398, #1009, #622 (a template that failed more than 1,000 times and still held positive credit), #1237, #1156, #413, #378 (fetch origin/dev first, because the substrate may already have fixed it), memory `feedback-search-prior-art-before-building-anything-2026-09-28`.
- **Bound:** "express every advertised capability" (#906, #898) means *advertised but never reached counts as a retire candidate*. It does not create demand for a mint (C13).

### K11. Behaviour lives in versioned resolver variants, selected and graded as activities
This is the reconciliation of OM with L2. Resolvers are primitives that can be versioned and varied, and they are used first. Activities are how a behaviour gets selected, graded, composed and retired, and activity variants choose among resolver versions. Consequential behaviour hidden inside one resolver is visible but cannot be extracted (#410). A deterministic path is fast but not exempt: it still passes through reach and the oracle (#450, #944).
- **Sources:** OM, L2, #410, #377, #812, #836 (code-layer authoring does not roll itself back; a no-op resolver accrues α), #31, #1231.

### K12. Fix the class at the shared seam, not at a site
One shared helper is better than N edits that are correct in N-1 places. A fix that enumerates cases takes on the next case's bug. Ask what else reaches the same destination. General tools come before specific paths.
- **Sources:** #1236 (id propagation across 13 hops; resolve-URL at 11 sites), #1200, OM ("we tend to overly build specific paths rather than general tools"), #238, #295, #176 (0789584 was the 7th recurrence; pin the call site), #338 (a fix overshoots at its own junction), #135.
- **Bound:** this conflicts with one-op goals (C3).

### K13. The fact must arrive at the moment of use. Decidable facts are bound structurally
Confabulation comes from starvation. Supply values (the edit site, schema, surrounding lines, prior trace, the correct output next to the incorrect one), not procedure. Where the goal decides a fact mechanically, bind it in code, because instruction does not hold. A gate that refuses after the fact is a backstop. It filters what gets kept; it does not teach.
- **Sources:** L8, #1062, #1188, #1001 (6 of 6 with evidence supplied vs 0 of 10 with decision rules), #945, #1002 ("Law 8 changed what the system tried; gates only changed what it was allowed to keep"), #595, #64, #523, #179/#200/#731, #1232 (`edit_site` moved `predicted_p` from 0.5 to 0.7), #329 (09-13: operator specs 80%, autonomous 2.5%).

### K14. Honest learning signal: grade every trace with a reason, abstain on infrastructure, store failures
Grade the layer that was actually wrong. Infrastructure, provider and billing failures abstain from the posterior; they may cool the arm through a separate channel (#449 vs #209/#737). Failures persist at least as long as successes. A hollow green is positive credit that keeps a failing family alive.
- **Sources:** #84, #258, #1158, #291, #555, #840, #296 (executions are kept about 5 days), memory 09-22 (the failure side had no store), #751, #952, #122, #671, #533.
- **Bound:** see C1 and C14 for which error costs more.

### K15. Causal discipline and honest denominators
Pre-register the behaviour and its falsifier before dispatch, not a string match. Change one thing per window and make no mid-run repairs. Split every rate by author, basis and goal-versus-tick. Attribute by id, never by time adjacency. Instrument after two refuted hypotheses. A metric that can be satisfied without a fix will be gamed.
- **Sources:** L7, L12, #960/#1202 (a causal leg survives 1 time in 7; a fix measures 1 time in 4; 3 in 7 findings are rediscoveries), #1047, #113 (a headline close_rate of 0.57 to 0.75 was about 6% landed-and-held), #1153 (48% reach was 92% self-scanning timers), #271, #320, #797 (at least 11 diagnoses reversed within a day), #971, #1229 (user: "not known until it is a trend"), #988.

### K16. Gap management is learned disposition, gated on measured closure
Each gap is born with an `edit_site`, a machine-checkable falsifier, and a first sentence that states the defect. Its premise is re-checked at dispatch. A retry enriches the parent and does not fork. A close requires measured "absent" over quiescent sweeps, with automatic reopen. Recurrence is counted, never deduplicated away. Growth stays within throughput headroom (λ₁ ≳ ρ_grow).
- **Sources:** L7, #21, #147, #879, #1120, #265, #688, #278, #266, #281 (`reopen_count` is 0 or None on 74 REOPENED rows, and 1,614 on the fixture), #990, #1032, #561 ("the gap triple currently measures fiction"), #109, #712, #157, #1108.

### K17. Code reaches the system only as a pushed commit on origin/dev, scoped and filtered. Tests never touch live state
Pushing is deployment. Compare content, not SHA markers. Re-check origin minutes after a landing. Never hand an LLM commit authority over an unscoped tree. Tests and probes are hermetic, run on temp roots, and fail closed against live stores. Never `docker cp`, and never hand-edit the DB.
- **Sources:** #99, #918 (4,455 files in 3 commits), #1218 (user), #379, #1041 (authorability is submodule membership), #10, #608, #1199, #170, #326 (no lifecycle make in agents).
- **Bound:** a template fix currently has *no sanctioned deploy path* (#664 vs #379/#73; C16).

### K18. The operator is a resolver, not a load-bearing preprocessor. Autonomy evidence is honest
Intervene only on blockers that cannot be resolved otherwise. For a circular blocker, bootstrap the *capability*, not the change it blocks. Operator edits are limited to "edits the system has proven incapable of landing on its own, but only those that would prevent it from landing fixes on its own" (#1184). Never commit as Substrate Autonomous. The agent never authors its own approvals (#809, #1262). Don't put decisions to the user: the system mints goals from wrongness (#1213).
- **Sources:** L6, L13, CLAUDE.md operator role, #27, #306, #1185, #1161, #158, #101, #1190, #678.

Docs (L9) and memory (L10) are folded into C11 and K9. The honesty law, refusal as a first-class outcome (#58, #583, #670 "never fake reach during an outage"), is part of K3 and K14.

---

## 3. Contradictions that must be ruled on

These are ordered by how much they block. "Proposed ruling" means the one the evidence supports. None of these rulings is recorded as a shape yet.

| # | Tension | Entries | Proposed ruling |
|---|---|---|---|
| **C1** | Grade every trace, or skip ungraded outcomes | #291, #219, #126 vs #84, #1158, #555 | Grade **every** trace with a reason class. Only infrastructure or unavailability reasons abstain from the Beta update. |
| **C2** | What reward is: reach, information yield, time-to-verdict, correct-and-cheap, or revisable | #34, #84 vs #856, #928, #613, #901, #1245, #948 | Credit is reach **∧** an independent class verifier, revised over time (stayed / reverted / recurred, #901). Yield and time-to-verdict are *selection priors for what to try*, not credit. |
| **C3** | One file, op or hunk per goal, vs fixing at the shared seam | CLAUDE.md "one file per goal", #327, #411, #599, #732, #999 vs #1236, #645, #354, #524 | One-op goals are a **workaround** (#1163), not a principle. A seam fix is a chained goal sequence, where each op depends on its predecessor's landing. This mechanism is unbuilt, so it is an open gap. Remove "one file per goal" from CLAUDE.md once the chain exists. |
| **C4** | Dictated exact edits as the only reliable landing path, vs L13 (rewriting a goal is itself the gap) | #493, #676, #1248, memory 09-24/09-27 `EDIT n old:/new:` vs L13, #322, #1232 | Dictation is a measurement of the gap (80% operator vs 2.5% autonomous, #329). The system must *derive* the EDIT block from the gap's `edit_site` and evidence (K13). Every operator-dictated landing gets `author:operator` and is excluded from the autonomy denominator. |
| **C5** | Fail open, fail closed, or abstain | #214, the CLAUDE.md hook vs #349, #130, #477 vs #423 | Gates on learning, landing and closing fail **closed**. Throttles, governors and operator-convenience hooks fail **open visibly**, with a signal (#1275). Verifiers with incomplete class coverage **abstain**. |
| **C6** | Route around holes (OM) vs surface the missing producer and use no fallback chain | OM, #1228 vs #1264, #310, #787 | Routing around is mandatory, but it must be *traced and visible*. The fallback records "producer X absent, routed via Y", and that record is the demand signal for encapsulation (K10). A silent fallback is forbidden. |
| **C7** | Where behaviour lives: OM (resolvers) vs L2 (activities) | OM vs L2, #140 | Settled by K11. Write it into CLAUDE.md L2 and FOUNDATION. |
| **C8** | Autonomy scoped out of its own core vs the S2 lift | #282 (autonomyScope 09-27: 27 excluded paths), #315, #841 vs #51, #13, #229, #220 | **Amended 10-02 (user rulings; REALIGNMENT §7 step 9, §10 item 1).** No human-governed category and no trust root as such. The system changes its own limits (scope, spend, which paths it may change, its deploy gate, its risk parameters) when evidence relevant to *that* behaviour supports it; the change is applied only by the previously **accepted** version of its gate/evaluator, never by the change itself, and a candidate gate is promoted only if it refuses everything the accepted one refuses. Humans are informed and can intervene (hold, revert), never gating. The earlier examples ("N verified landings in adjacent paths"; the same-day "three authority categories") are withdrawn. Today the rule is only `autonomyScope.reason` prose. |
| **C9** | Hand-land vs let the loop learn | #833, L6 vs #590, #677, #1185 ("fails twice") | #1184 is the operative rule: the operator lands only what restores the system's ability to land its own fixes. "Fails twice" is the trigger for *considering* that rule, not a licence. |
| **C10** | Kill switches and critical self-observation schedules as env or timers vs L1 and L5 | #1083, #697, #1162, #400, #56 vs L1, L5, #94 | Extend the bootstrap-tier exception by name: kill switches plus self-observation watchdogs that sit outside the selector they monitor. Each exception carries an attempt budget and a loud-failure duty. |
| **C11** | Docs as expectations vs docs as caches, and status in specs | L9, #81, #1216, #1226 vs #249, #100, #463, #1166 | Docs hold invariants and failure modes only. Every measured value, status, "ships vs design" block or dormant marker is a cache. It lives in the substrate as a shape and is queried. Docs-align is substrate work (L9), not an author's duty. |
| **C12** | Strict gate for honesty vs strictness blocks learning, and gates vs information as the primary lever | #334, #562, #451, #864 vs #585, #1002, #595, #64, #305 | Gates filter what is kept and information changes what is tried (#1002). Both are needed. A gate is never loosened. Learning pressure goes into K13 channels and a third independent truth source (#585). |
| **C13** | Express every advertised capability vs "a wrong mint is negative" | #906, #898 vs L3, #1009 | The orphan detector gets a retire direction (K10 bound). |
| **C14** | Which error costs more | #486, #633 vs #942, #36, #396 | On credit, a false rejection costs more because it starves the learner. On an oracle or ground truth, a false positive costs more (a plausible wrong value). Write both down, each scoped. |
| **C15** | Deduplicate identical failures vs deduplicate gaps by family | #252, #1227 vs #117 | Deduplicate the *work item* and keep the *count*. Recurrence increments one gap's lineage counter and never vanishes. `reopen_count` is broken today (#281). |
| **C16** | Deploying a template fix | #664 (mutate the live row) vs "never hand-edit the DB", #379, #73 | Unresolved. A landed template source must re-seed on unit start by content hash. Until then no sanctioned path exists, and this is a gap. |
| **C17** | Ground truth: tree vs ledger and memory | #727 vs L10, #61 | Split by kind. For *code*, the tree on origin/dev wins. For *what happened*, the trace ledger wins. For *learned knowledge*, the substrate memory wins. |
| **C18** | Ask vs decide | #1141 ("await a go-ahead"), #796 vs #1213, CLAUDE.md "wrongness is a goal seed" | The system files and acts. It asks the human only for authority it lacks (credentials, spend ceilings #796), and it asks through the surface the human actually reads (see `human-surface-escalation`). |
| **C19** | Tests vs activities-as-tests | #713 (FOUNDATION:699) vs #968, #683, #1142 | Activities are the regression tests *of behaviour*. A per-resolver test that executes the main path is the regression test *of code*. The post-land suite must execute, not read (#1142). |
| **C20** | Masking or holding units in graded windows vs "masking throws away the signal" and "containment is a shape" | memory 09-26 practice vs #1181, #1124 | Holds become a quarantine shape with a TTL, read by the dispatchers (#977, #1124). An operator mask is an intervention and gets recorded as one (L12). |
| **C21** | Posterior sharing vs the hub as learning state | #862 vs the CLAUDE.md hub profile, #43 | Share evidence (traces, verdicts) over p2p, and derive posteriors locally or at the hub from the shared evidence (#41). |
| **C22** | One trust boundary per container vs nothing absent anywhere | #816, #804 vs #30, #33, OM | Trust sits at the identity namespace (#891). Verification is a shape resolvable from any node. |
| **C23** | "Landing is solved" | #476, #620 (09-02, 09-03) vs the 09-24 lane deadlock, #1163 | **Retire the claim.** |
| **C24** | Operator as novelty injection vs non-load-bearing | #863 vs CLAUDE.md operator role | Novelty comes through the human surface as goals, like any resolver's contribution. It is not a structural operator role. |
| **C25** | Cost | #1214 ("cost is not a concern, truth is") vs #821 (value-per-cost stack) | Truth first. Cost is a selection tie-break and a deterministic brake at the resource (K16, #600). It is never a credit signal. |

---

## 4. The principles the current build violates most (tied to class keys)

These are ranked by how many classes the violation spans, multiplied by how often it recurred *after* a "fixed" claim. Counts come from the class files (attempts/problems/claims) and are **not summable**, because the dossiers warn that shards overlap. Items marked "live" were checked by the dossier authors on 09-29.

1. **K1 plus K6: fixed once, decayed silently, with no caller and no liveness.** This is the dominant failure, and it spans every class. The purest cases:
   - **`dormant-mechanism`** (75/50/13): WTKB puts at least 83 of 253 breaks in category C or E. `check-lifecycle-channels.sh`, proposed 05-27, does not exist (live 09-29).
   - **`false-verification`** (207/81/53, the largest class): each "done" site has its own judge, and each judge reads a proxy. The reach gate was "fixed" on 07-13 and again on 07-20, and the registry oracle recurred 7 times (0789584).
   - The post-land suite ran `ran=false` from 08-31 to 09-28 (5e9a0b2).
   - `docs-drift`: the install acceptance run "succeeds" while logging `no LLM arm completed` (run 36505437797, 09-29).
2. **K8: one address per shape, one writer.**
   - **`write-read-mismatch`** (120/64/13): 13 or more dispatch-id fixes between 09-24 and 09-26, and 59 of 59 reads empty until `53d8e77`.
   - **`endpoint-routing`** (66/45/6): `127.0.0.1:8270` is still pinned in `development-vessel/src/seed/draft-gap-closing-activity.ts:118`, plus 11 more src files (live). `DiscoveryRegistrationLoop` (35eb02f5, 07-01) was never adopted.
   - **`human-surface-escalation`** (38/35/5): 248 escalations went to the replaced vessel, and there are now **336** (live), with 0 answered.
   - **`credential-hygiene`**: revoke writes to redis while the listing reads SurrealDB, "fixed" 4 times.
3. **K3 plus K5: counting proxies as reach.**
   - **`hollow-landing`** (103/45/23): #948 found 68% hollow.
   - **`autonomous-regression`** (92/42/14): more than 50 regressing substrate-authored commits between 05-23 and 09-28. The stale-base silent revert was *closed* on 08-28 and recurred on 09-14, 09-24 (6ab8271) and 09-26.
   - **`sync-deploy-drift`** (137/70/19): "Deploy boundary closed" on 07-21 (a81c46f5), with symptoms still identical on 09-28.
4. **K12 plus C3: specific paths instead of shared seams.**
   - **`directed-overshoot`** (49/24/8): 19 goal-host operator-bypass commits on 09-22, each correcting its predecessor. `ca53600` and `5598853` silently undid 12 and 7 landings.
   - **`narrowing-duplicates`** (58/44/3): every guard is keyed on one id or one entry point and is routed around by the next minter (`gap-to-feature.ts:136-155`).
   - The OM names the 09-28 lane-core patches (calibration, class2 locality, narrowed-child wait, compose test scrub, pre-admission decomposition) as the latest instance.
5. **K13 plus C4: gap-content and fact starvation.**
   - **`gap-content`** (55/40/4): the capability §I.1–I.5 (05-30 and 06-01) never landed. There are three bulk closes of one backlog: 06-14, 09-05, and 693 gaps on 09-28.
   - **`drafter-quality`** (76/34/6): templates reference unregistered resolvers, for example `learned-auto-bridge-problem-detection-1r2k9x` ×305 on 09-28.
   - Operator 80% vs autonomous 2.5% (#329).
6. **K9 plus the OM p2p clause: node-local forks.**
   - **`node-locality`** (22/38/8) and **`federation-p2p`** (64/28/19): relay-findability items (1) and (3) from 07-19 are still absent 72 days later. `holePunchSuccess` is 0. NO_RESERVATION recurred 7 times through 09-29.
   - **`memory-recall`** (63/38/17): the gap store has been reborn 5 times. System memory holds nothing before 09-26, and recall ignores topic (44ab5fd4). Class-key recurrence excludes closed rows (`substrate-gap.ts:460`), so the system cannot see recurrence across a reset. This violates K16 and the P0 failure directly.
7. **K10: reuse before mint and automatic retirement.**
   - **`codebase-bloat-fossils`** (61/56/7): "placement hook installed" on 08-11 and 09-23 (d993b331), then `edc68d49` committed `leases/` and `state/` on 09-26. On both nodes the `core.hooksPath` directory has no chaining `pre-commit` (live), which is exactly the inert-gate case CLAUDE.md warns about. There are 47 unreaped park files on node 1.
   - **`selection-learning`** (135/51/25): 48% of arms never run (#260), 60% of picks go to n≤2 arms (#261), and `posterior-update.ts` never reads the 14,100 `goal_verification_labels`.
   - **`composition-crystallization`** (91/19/13): pathways are still keyed by `goal_hash`, a finding from 09-05 that was re-found on 09-16 and never landed.
8. **K2: env gating.** **`env-gating`** (49/40/7): `9cfdea4` (09-28, autonomous) added `if (!process.env.CONCEPT_DB_URL) return null` to production code to pass a test. It was reverted 32 minutes later (fb0a18a). The EnvironmentFile-wins mechanism has split stores 3 times: 07-19, 09-19 and 09-22.
9. **K17: live state touched by tests and residue.**
   - **`test-residue-live-state`** (34/41/4): the dev-vessel suite rewrites fixture gaps into the live store on every `bun test`, and that gap was still open on 09-29. `127.0.0.1:20236` was registered in live discovery by a test run (2b049b7a).
   - **`trace-store-db`** (87/44/10): the gap "cold boot silently skips 22 unparseable migrations" (129fa76) is open.
10. **K2 plus C20: the spend lever as a held operator habit.** **`spend-envelope-throughput`** (76/41/18): the LLM plane went dark 17 times, including 43 hours on an invalid key while funded. The `change_window` lease holder was diagnosed on 08-09 and is still open on 09-29.

**The operator's own instrument faults** are a class too: **`operator-instrument-fault`**, with at least 40 instances between 05-26 and 09-29. Every K4 and K5 violation above was also committed by the operator (#678: "I have the same failure mode as the system I am repairing").

---

## 5. What makes this canon different from the previous seven (runtime readers)

Per #1382 and #328, a principle with no runtime reader is an archive. The minimum needed to make this canon load-bearing reuses existing producers (K10). Check class history before building any of it.
- **K1 and K6:** a liveness row per mechanism, of the form (instrument, expected, window, n-floor), held as a shape. The existing `detector_coverage_scan` clusters only failing traces and is blind to absence (`dossiers/dormant-mechanism.md`), so it needs an *absence* direction, not a new detector.
- **K3:** a per-class verifier registry that the credit path reads. There is prior art: goal-host `63b7168`, `a4e01cc`, `8e442df` and `0d0a288`, the falsifiability index from 07-27/28.
- **K8:** a lint that fails a landing when a new literal port or `127.0.0.1` appears in `repos/*/src`. It needs a caller: the post-land suite, which now executes (5e9a0b2).
- **K16 and P0:** recurrence counted across closed rows and store resets (`substrate-gap.ts:460`), so that "same issue, same reason" becomes a number the selector reads.
- **Contradictions C1 to C25:** each ruling becomes a shaped policy row with its source `#n`. A ruling that exists only in this file is subject to K5: it is a claim, not state.
- **Generation from this file (amended 10-02; REALIGNMENT §8).** Before any row is generated, each source statement is classified as an **observation** (bounded by time, node, version and method), an **expectation** (behaviour required by a stated contract or purpose) or a **hypothesis** (a proposed relationship awaiting an experiment). Each generated row keeps its source revision and line, its statement kind and its reader. A change here refreshes or explicitly invalidates the derived rows. Statements marked withdrawn (§1) never become active expectations. Unparsed claims stay explicit and are never fabricated into predicates.
