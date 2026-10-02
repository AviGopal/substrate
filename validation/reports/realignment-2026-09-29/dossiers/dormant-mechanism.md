# Dossier: dormant-mechanism

**What the class is.** A mechanism is built, often verified once, and then never runs, never gets called, or is never read on real traffic. Examples: a resolver with no activity, an emitter with no subscriber, a timer that skips 100% of its ticks, a detector with one binding, a harness that nothing schedules, or a table that is written and never read. The system does not notice. An operator audit notices, days to months later, and repairs that one instance. Nothing ever takes on the class.

Sources: `classes/dormant-mechanism.json` (75 attempts, 50 problem records, 13 claims), the raw notes named inline, `validation/reports/self-development-program-2026-09-25/WHY-THINGS-KEEP-BREAKING-2026-09-28.md` (WTKB) and `MECHANISM-AUDIT-2026-09-28.md` (MA). Live checks were run read-only on 2026-09-29 between 04:30 and 04:55Z on the hub (`substrate-live`) and node 2 (`compose2-live`).

**Size.** Collectors reported 50 problem records with self-counted recurrences that sum to 320. These overlap heavily across collectors. The one de-duplicated count is WTKB. It lists 253 break cases from January to 09-28. Of those, 64 are category C (a half-built joint: no reader, no writer, input never produced, never fired) and 19 are category E (validated once, then stale). So at least **83 distinct instances**. About 247 of the 253 were first found by a human. The system found 2. No named detector was first on any case.

---

## 1. Dated timeline (claims and what later showed)

| Date | Event | Claimed | Later |
|---|---|---|---|
| 2026-02-17 → 06-05 | Ratchet, correctness validation, trace-enforce-validate, contract enforcement, M1–M6 were built and validated, then never referenced again (git-super-1, 10 recurrences) | "validated" | Nothing uses them. This is the first recorded wave. |
| 05-17 | concept-db upkeep rules shipped (`repos/concept-db/CLAUDE.md`) | "autonomous Thompson activities creating traces" | **Live 09-29:** `/upkeep/status` shows totalTrials 0,0,3,0,0,5 over 6 activities. `/health` shows `upkeep.enabled:false` while `/upkeep/status` shows `enabled:true`. |
| 05-18 | Weekly recommendation/stratified-harness GitHub workflow added | "DONE with weekly CI" (archive tasks.md, 05-19..07-01) | **Live:** `gh run list` shows every scheduled run failing in 10–14s, including 09-28 run 36401878072 (`METABOB_API_KEY is not set`). The count is 20/20 since 05-18. No gap was ever filed. |
| 05-18 | Shape-dispatch agreement lint | lint wired | The runtime `verifier_negative` self-trace was never built. On 08-21, `packages/shape-dispatch-check` had 0 callers (reports-3). |
| 05-23 | Harness migrated to the activity `harness-run-matrix` (validation/failure-modes/README.md) | "fires automatically on execution_completed" | 0 dev-vessel journal mentions since 09-21. The `harness-check-scenario` input mis-wire gap has been open since 09-22. |
| 05-23 | Topology-discovery loop: 29/33 tasks done | — | S.4a coverage_progress was never true. coverage-tick has had 0 traces since 09-14. |
| 05-27 | Audit F4: lifecycle emits have no subscribers (`41382521` to NoopEventSink, `31eeeb2f` gap:classified with 0 subscribers). **First explicit statement of the class.** The proposed fix was "every emit ships with a default subscriber + `check-lifecycle-channels.sh`". | proposal | `check-lifecycle-channels.sh` **does not exist** (verified 09-29). The neutral-emitter bus shipped 4/4 tasks with 0 `lifecycle.*` subscribers (inv-077, "energized but draws no current"). |
| 05-27 | closure-audit.ts (`86186cb4`) | "3 nightly greens gate lift" | No unit, timer, Makefile or hook invokes it. Last output 09-09, and all its negatives were uncontrolled "HTTP 0" results. On 09-07 it claimed "push-away closed" in the same run that could not reach dev-vessel. |
| 05-30..06-04 | ingest-doc, draft-spec-from-gap, closed-loop learning, concept-db supersession (0/42 tasks), upkeep loop (0/36), LR-3 replay (0/46) | specs | Built but not wired, or never built. openspec shows 98 recognised changes, 67 in progress, 0 complete. |
| 06-03 | Vessel mitosis | "empirically proven" | 06-04: 0 cutovers. 06-05: evaluate is non-deterministic. |
| 06-13..19 | Detector explosion: `3ccaebc` template-input-lint, `a0f1a0a` selector-saturation "recursive self-detector", `851cadc` detector-authoring recursion, `09cd374` consumer-productivity audit | "substrate authors its own detectors" | C.GATE (a self-authored detector firing with trace evidence) was never recorded. `detector_coverage_scan` clusters **failing traces**, so it is blind to absence-of-write (reports-3, 08-14..16). On 09-26 the gap `detector-coverage-dormant` recorded 9 detector templates never selected. **Live 09-29:** still open, last_detected 02:58Z. |
| 06-23 | `1ef8356` orphaned_capability_scan: the first detector for "resolver invoked by nothing" | "find-half" | Only the find half exists. The fix half was proven missing on 06-24. author_producer came 07-01. `57f1ac4`/`786229b`/`5693903` (08-28/29) fixed the counting (orphans 33→3) and prescribed rewire-before-mint. `repair_direction` still offers only rewire or mint, never **retire**. **Live:** hub 51 gaps (38 open / 8 rejected / 5 closed); node 2 40 open. goal_summary and interface_deploy_reach_check are still at 0 invocations after 40+ days. The 08-17 bridge template `1bec4b88` was written into openspec and never registered. |
| 06-29 | obsidian intake/learn/collaborate timers (`d6bb951c`) | async human loop | **Live 09-29:** timers active. Every tick logs `SKIPPED: no vessel advertises obsidian:note` (2562+222+169 ticks/7d, 100% skipped, per timers-readers). The surface was replaced and nothing dispositions the timers. |
| 06-29 | surgical-gap-scan (`459bf0ca`) | supply of landable gaps | 91/91 runs emitted 0. On 09-28, `da76f061` "detects endpoint+absolute joins" was reverted the same day by `807b92ef`. **Live 09-29:** `"emitted": []`. |
| 07-12 | behavioral-verification `399bb2c` (substrate-authored) | wired into every cutover | `{ran:false}` on every cutover. 0 of 6,133 gaps carry `verification_spec` (MA #2). **Live:** the joint `severed-joint-behavioral-verification-input` is open with reopen_count 4. |
| 07-20 | Census/validation activity families minted, auto-promoted, rhythm-mounted | — | Zero unassisted dispatches. The conductor only enqueued, gated at load>=8. Credit to the posterior was exactly 0. |
| 07-21 | NO_RESERVATION retry `63f0bf1` | — | 0 firings. The burst was on a different ingress path. |
| 07-28 → 08-04 | Host autonomous-regression detector `676cb859` | "working" | **0/132 completions** (pipefail). Fixed in `cffc9489`. Memory law "a detector must be proven to COMPLETE" dates from 08-04. |
| 08-02 | `8d3e57ce` pruned 38 no-caller scripts. The **script-retention law** entered CLAUDE.md: "a gate with no call sites can never be observed failing". | law | The law has no enforcer. validation-other-3 found about 70 validation scripts with no invoker. The harness family (07-26..08-28) has not been touched since 08-28. |
| 08-04 | Post-land suite `2ddcac0` | the gate named most-needed on 09-10 | Dead from 08-31 to 09-28, because a 30s shell kill made ran=false read as a pass. Fixed in `5e9a0b2`. **Live 09-29:** `post-land suite … ran=true pass=145 fail=2` and similar. |
| 08-05 | GitHub `ci-result` lane revived by the operator | — | Never executed in 741 runs. Superseded by the in-vessel test_suite. |
| 08-09 | `a6f5b9c` edge_liveness_report ("whether an edge has EVER worked") | — | 08-09 census: 17/59 edges never succeeded. It is a report with no scheduler and no gap output. |
| 08-09 | `b8feccd`/`3a6018f`: 154/157 composable gaps had no live lane, and every seed validation block is decorative | instance repair | The gap-compose pickup chain was repaired and worked (`04775a7` closed in 12m59s). **Live:** `self-op-health:repair_unit_dormant` (gap-compose.timer) has been open since 09-24. |
| 08-17 | memory-budget-check.service gives one zero-call-site instrument a scheduler | "fixes zero-call-site instruments" | Its sibling `argument-chain-check.test.ts`, named in the same comment, is still unplaced. |
| 08-25 | **`daa2632c` joint-liveness-tick**: the first general detector for write→read-severed joints | general | It had **exactly 1 binding (`decision_outcome`) for 33 days**, and its meta-guard only asserted "checked > 0". It caught 0 of 179 Aug–Sep breaks (WTKB). The mechanism was built but its coverage was not. |
| 09-05 | About 40 operator commits: causal-adjudication, schema-drift, reach-rate-scan | — | 0 executions in the retained window. |
| 09-06 | Conservation auditors (`ad41776`) + bridge | liveness invariant | 37k findings and 0 gaps until the bridge got a caller (09-08). The auditors took 21% of executions. Duplicate routes exist. |
| 09-09 | `8a3804ff` validator-liveness-tick | "detects validators that stopped keeping cadence" | Its first gaps were unarmed (`614de014`). **Live 09-29:** `SEVERED 10/97, worst vessel_exercise_scan (4.5d)`. Gap `validator-cadence-severed` has been open since 09-18 with 0 closes. It is structurally blind to demand-driven validators (reports-8). |
| 09-10 | `7c34185` execution_exemplar: 0 rows → 315 (four stacked defects, including a 24h setInterval in a process with 11.4-min mean uptime) | worked | **Live:** 2,967 rows. **Held.** |
| 09-10 | `8fc5db2e` learning-loop-selftest with severed-link controls | worked (first run RED on a real bug) | **Live hub:** `1 RED link: posterior_delta`. This is a standing red that nothing acts on. **Node 2:** script deleted in the worktree; the unit is masked and failed. |
| 09-10 | gate-self-probe wired onto rotation | — | Executed exactly once ever (09-10 09:40). |
| 09-16 | `a172e235` identical-failure-run-tick: "identical failures should not be possible". Its first run found an auth activity failing 2,286×/24h. | — | **Live:** no unit file exists in `scripts/substrate/units` or on the hub, and 0 `identical-failure*` gaps. The one detector for "same failure, nothing changed" was never scheduled. |
| 09-16 | In-flight recovery: 193/193 attempts are 1/1 | "retry machinery live" (earlier) | Re-found and re-declared as new in MEMORY 09-22. That is re-discovery, not detection. |
| 09-17 | "checkAndRetireByPosterior has zero callers" (`80ab9659`) | zero | A false zero minutes later: it is wired to `/executions`, which gets 24 req/3h against 82,629 on `/execution-traces`. Zero variants ever. |
| 09-19/20 | Expectation-trend batteries + responsibility cycle + 5-min expectation scan | self-minted expectations | Only toy families. **Live 09-29:** the hub heartbeat reports `checked:13, violations_found:0`, and the store holds only `expectation-trend:product/uppercase`, parity and trendcheck notes. **0 mechanism-liveness expectations.** Node 2's heartbeat reports `checked:0` every minute. |
| 09-26 | `service-failure-joint-liveness` / `-validator-liveness` filed after node-2 pull-sync auto-enabled DB watchdogs on a DB-less node | — | On 09-28 05:56 the node-2 units were hand-**masked**. **Live:** masked+failed on node 2, and both gaps are still open on the hub. Masking disposed of the signal. |
| 09-27 | `70254535` (operator) joint registry: `jointBinding` pool records, 4 check kinds, self-gap unless all bindings are checked | "the joint-registry seam" (WTKB rec. 1) | **Live hub:** 5 records (discovery-endpoints-healthy, ribosome-registered, operator-revert-learned, behavioral-verification-input, ribosome-extraction). The last tick shows `bindings=6 checked=6 severed=3`, and 5 `severed-joint-*` gaps are open with reopen counts 1–4 and **0 closed**. **Node 2:** 0 records. All records were operator-authored and no mechanism registers its own joint at birth. None of the 6 overnight breaks were registered (transcripts-4). |
| 09-28 | MA: "every mechanism has been built at least once; failure mode is **decay without detection**". Recommendation #6: "each self-correction mechanism carries an expectation 'fired on real traffic within N'". | recommendation | **Not built** (verified: no such expectation note, no `mechanism-liveness` gap id). The same audit misdiagnosed node 2's selftest as "clone behind". The file is still deleted at HEAD `9c967329` (node2-runtime). |
| 09-28/29 | The ~40 custom systemd timers all report `Result=success` and none is validated by an activity (git-deployment). db-maintenance reports `actions:[]` on every tick. | — | **Live 04:31Z:** `slow_queries 6062` (1764 → 2862 → 6062), the same 3 integrity findings, `actions:[]`. |
| 09-29 (live) | Shadow emitter `cluster_shadow_decision` (activities.ts:7387-7440) | — | Still writing. It produced 42 of the 61 impulses created in the last ~80 min. Its only reader is a test, and it sits outside retention. `relevance_feedback` and `upkeep_audit_log` have 0 rows. |

---

## 2. Root causes (converged across 40+ collectors)

1. **Acceptance is local and one-time.** A mechanism is "done" when it typechecks, passes its own test, or completes one dispatch (openspec-2, WTKB root cause). Nothing asserts afterwards that it still fires on real traffic.
2. **A mechanism is born without its joint.** Producers and consumers are wired separately (memory-9). A writer lands without a named reader, and a reader lands without a live writer (lifecycle emits, the shadow emitter, write-only logs such as `landability_predictions.log` at 10.5MB/3d). A resolver lands without an activity (51 orphans; 22 detector resolvers with no seed). Imports that are never called pass every gate, because `noUnusedLocals` is off (reports-8).
3. **Absence of signal reads as health.** A silent skip, `ran:false`, a 100%-SKIPPED tick, `actions:[]`, `emitted:[]` or `checked:0` all exit 0. Detectors cluster *failures*, so a mechanism that never runs produces no failures and stays invisible (reports-3).
4. **Scheduling rides on the wrong carrier.** Some jobs use env gates or `setInterval` in short-lived processes (exemplar, 11.4-min uptime). Some are Thompson-selected cadence that a cold arm never wins (9 detectors "never selected by UCB"). Some are load-gated conductors. Some have no unit at all (identical-failure-run, closure-audit). Units run on nodes where their data isn't (law 11 → masked on node 2).
5. **No disposition.** Only "rewire or mint" is offered. "Retire" is not, so a hollow mint begets a bridge mint (openspec-6). Masking a failing unit or leaving a standing RED counts as disposal.
6. **The watchers decay the same way.** joint-liveness had 1 binding for 33 days. validator-liveness cannot see demand-driven validators. The selftest RED is unacted on. The expectation scan watches toy families. Every liveness detector is itself a dormant-mechanism instance.

## 3. Why it recurs: the missing shared capability

Every repair so far was **instance-grain** (wire this resolver, schedule this script, extend this binding list) or **one more detector with a hand-kept list**. The class regenerates at one seam: **the moment a mechanism lands.** Nothing at landing requires the mechanism to declare *who calls or reads it and how often it must fire*. Nothing continuously evaluates that declaration where the data lives, reachable from every node. And nothing turns a violation into a gap with the full disposition set {rewire, schedule, relocate, **retire**}. Because the declaration is absent, every watcher needs a human-curated list, and the list decays just like the mechanisms it watches. That is why the joint registry sat at 1 binding, and why today's 5 bindings are all operator-written.

**Shared capability: birth-registered mechanism liveness.** It has three parts, all *reuses*, not new mints (law 3):
- **(a) Declaration at the landing seam.** The feature_compose / mitosis-cutover landing path requires every new writer, resolver, emitter, timer or script to carry a `jointBinding` pool record: writer, reader, expected window, check kind. Operator commits get the same rule via the pre-commit hook. A landing that adds a producer without a binding is refused, or files a gap on itself.
- **(b) One evaluator, routed by shape.** `joint-liveness-tick` evaluates all bindings, plus the expectation-scan responsibility cycle for "fired on real traffic within N" (MA #6). It resolves by shape through discovery and does not open SurrealDB directly. Node 2 then gets a real answer instead of `Unable to connect` → mask.
- **(c) Disposition, not just detection.** A violation files a gap whose repair options include **retire**, and whose closure predicate is the binding turning green. This feeds the gap triple, and it gives the fossil inventory (189 fossil / 158 dormant / 107 live-unused of 1,654 inventoried mechanisms) a standing drain.

## 4. Every prior attempt at this same capability, and why it did not hold

| # | Attempt (date, id) | Scope | Why it did not hold |
|---|---|---|---|
| 1 | F4 convention "default subscriber per emit + check-lifecycle-channels.sh" (05-27) | emitters | Proposed only; the script was never created. |
| 2 | closure-audit.ts (`86186cb4`, 05-27) | 7 external crutches | Nothing schedules it, and its negatives are uncontrolled HTTP 0 results. It is itself dormant. |
| 3 | detector_coverage_scan + detector-authoring recursion (`851cadc`, 06-14) | detectors | Clusters failing traces, so it cannot see absence. C.GATE was never met. |
| 4 | template-input-lint / consumer-productivity audit (`3ccaebc`, `09cd374`, 06-13/14) | declared-unused inputs | Input-grain only. Per-instance detector sprawl remains (1,948 detect-* runs/7d). |
| 5 | orphaned_capability_scan (`1ef8356` 06-23; repairs 08-28/29) | resolvers with 0 activity callers | This is the **best-held** attempt: it runs and gaps. But the fix half is weak, there is no retire, it is blind to direct and LLM-tool calls (52/303 phantom), and it drains almost none (5 closed of 51). |
| 6 | Script-retention law (`8d3e57ce`, 08-02) | scripts | A law with no enforcer. About 70 validation scripts have no invoker. |
| 7 | edge_liveness_report (`a6f5b9c`, 08-09) | composition edges | A report with no scheduler and no gap output. |
| 8 | "A detector must be proven to COMPLETE" (memory law, 08-04) | detectors | This is operator memory, which teaches only the operator. It has no runtime reader. |
| 9 | memory-budget-check placement (08-17) | 1 instrument | Instance grain. Its named sibling is still unplaced. |
| 10 | **joint-liveness-tick (`daa2632c`, 08-25)** | write→read joints | Hand-kept list (1 binding for 33 days). The meta-guard only checked "> 0". |
| 11 | Conservation auditors + liveness invariant (09-06) | conservation laws | 37k findings with 0 gaps until the bridge got a caller. Duplicates took 21% of executions. |
| 12 | validator-liveness-tick (`8a3804ff`, 09-09) | validators | Real and live on the hub, but its gap is open with 0 closes. It is blind to demand-driven validators, and masked on node 2. |
| 13 | learning-loop-selftest (`8fc5db2e`, 09-10) | learning chain links | A standing RED `posterior_delta` that nobody acts on. The script is deleted and masked on node 2. |
| 14 | identical-failure-run-tick (`a172e235`, 09-16) | repeated failures | Never given a unit. |
| 15 | Expectation-trend / responsibility cycle (09-19/20) | toy transforms | Never extended to mechanisms. It checks 13 on the hub and 0 on node 2. |
| 16 | detector-coverage-dormant / self-op-health gaps (09-24/26) | detector units | They detect, but nothing closes them. |
| 17 | **Joint registry `jointBinding` (`70254535`, 09-27)** | declared joints | The right seam, and live. But every binding was written by the operator, no landing registers one, node 2 has 0, and 3 severed joints have been flagged every 30 min with **0 closed**. |
| 18 | MA recommendation #6 "mechanism fired on real traffic within N" (09-28) | self-correction mechanisms | Recommendation only; not built. |

Pattern: every attempt added **detection over a hand-curated scope**. None attached the declaration to the **landing seam**, and none carried a retire disposition. Coverage therefore depended on an operator remembering to register, which is the class's own failure mode. Attempts 10, 17 and 18 are the same capability rediscovered three times in 34 days. WTKB and MA each called earlier work "missing" before correcting themselves (transcripts-4 C36: "firsts that were prior art … joint registry 08-25").

## 5. Current verified state (2026-09-29, 04:30–04:55Z)

**Hub (`substrate-live`):**
- **joint-liveness.timer:** active. Last tick `bindings=6 (seed 1 + registered 5) checked=6 severed=3`.
- **severed-joint gaps:** 5 open, 0 closed:
  - `decision_outcome`, since 09-27
  - `ribosome-registered`, reopen 2
  - `behavioral-verification-input`, reopen 4
  - `ribosome-extraction`, reopen 1
  - `discovery-endpoints-healthy`, reopen 1
- **`joint-liveness-detector-checks-nothing`:** open since 09-28 09:57.
- **validator-liveness:** `SEVERED 10/97`. Gap `validator-cadence-severed` open since 09-18.
- **learning-loop-selftest:** `1 RED link(s): posterior_delta`.
- **Other open liveness gaps:**
  - `detector-coverage-dormant` (last detected 02:58Z)
  - `self-op-health:repair_unit_dormant` (since 09-24)
  - 8 `service-failure-*` gaps
- **identical-failure-run-tick:** the script is present, with no unit and 0 gaps.
- **surgical-gap-scan:** `emitted: []`.
- **obsidian-intake:** `SKIPPED: no vessel advertises obsidian:note`.
- **db-maintenance:** `actions:[]`, `slow_queries 6062`.
- **Orphaned-capability gaps:** 51 (38 open / 8 rejected / 5 closed).
- **concept-db upkeep:** `/health` `enabled:false` against `/upkeep/status` `enabled:true`. Trials are 0,0,3,0,0,5.
- **Shadow emitter:** `cluster_shadow_decision` produced 42 of the last 61 impulses. `relevance_feedback` and `upkeep_audit_log` have 0 rows.
- **Expectation store:** the heartbeat reports `checked:13`, but there are no mechanism-liveness expectations.

**Node 2 (`compose2-live`):**
- joint-liveness, validator-liveness, learning-loop-selftest and compose-drift are all **masked failed**.
- 0 `jointBinding` records resolve.
- The expectation-scan heartbeat reports `checked:0`.
- 40 orphaned-capability gaps are open.

Absence there is not absence *in the network*, but nothing routes these checks to the hub by shape. They were masked instead.

**Held repairs (keep):**
- execution_exemplar: 2,967 rows.
- Post-land suite: `ran=true` on every recent cutover since `5e9a0b2`.
- Gap-compose pickup chain (08-09). Currently masked or dormant by choice, as the gap says.

**Off-repo:**
- The weekly CI failed again on 2026-09-28 (run 36401878072, 13s).

## 6. Keep / retire

**Keep (the general pieces, to be extended, not re-minted):**
- `jointBinding` pool shape + `joint-liveness-tick.ts` (evaluator, with the self-gap on unchecked bindings).
- `orphaned_capability_scan` (resolver-grain find half).
- `validator-liveness-tick`.
- The expectation-scan / responsibility cycle, as the home of "fired within N".
- `learning-loop-selftest` severed-link controls.
- `identical-failure-run-tick` logic (needs a unit).
- `edge_liveness_report` (data source).
- The post-land suite with the ran=false → failure rule (`5e9a0b2`).

**Retire candidates (disposition via the capability, not by hand):**
- obsidian-intake/learn/collaborate timers (target replaced).
- surgical-gap-scan (0/91).
- The weekly GitHub workflow (20/20 failures), or set its secret, and turn a CI failure into a gap.
- closure-audit.ts.
- composition-edge-reconcile (superseded by the inline write).
- The `cluster_shadow_decision` emitter (no reader, no TTL).
- 11 empty schema-twin tables.
- The ~70 no-invoker validation scripts.
- The concept-db resolver-side upkeep scheduler (untraced), or register it as activities.

## 7. Retire condition (measurable, checked continuously)

The class is retired when all of the following hold for **30 consecutive days**, measured on the hub and resolved by shape from node 2:
1. **Registration is automatic.** 100% of mechanisms landed in the window through the landing path (substrate-authored and operator) carry a `jointBinding` or expectation record created by the landing itself, not by hand. A test: count commits that add a resolver, timer, script, emitter or table writer against the bindings created with a matching commit sha. The ratio must be 1.0.
2. **Coverage.** The evaluator checks every registered binding on every tick (`checked == expected`) on the hub. Node 2 resolves the same verdict by shape with **0 masked liveness units**.
3. **Detection moves to the system.** In the break ledger (the WTKB method, re-run monthly), at least 80% of category C and E cases are first detected by a liveness gap rather than by an operator audit. The baseline is 0 of 83.
4. **Disposition closes the loop.** Every severed-joint, orphaned-capability, validator-cadence or detector-dormant gap reaches a terminal disposition (rewired / scheduled / relocated / **retired**) within a median of 7 days. None stays open with a rising reopen_count. The baseline is 0 of 5 severed-joint closes, and 5 of 51 orphan closes.
5. **No re-emergence under a new hat.** No new problem record in a future realignment sweep has "built/validated once, never fired/read" as its root cause for a mechanism landed after the capability went live.

## 8. Related classes

- write-read-mismatch: contract drift on a live joint. Liveness catches the silent half, and semantic invariants catch the rest.
- hollow-landing: a field nothing reads.
- false-verification: a skip read as a pass.
- codebase-bloat-fossils: the undisposed residue of this class.
- env-gating: env-armed dormancy.
- node-locality: detectors wired to hub-only state, then masked on the spoke.
- operator-instrument-fault: negatives from uncontrolled probes.
- selection-learning: cold detectors never selected by UCB.
- docs-drift: docs promising loops with 0 executions.
