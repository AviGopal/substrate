# Dossier: false-verification

**Class boundary** (from critic-2): false-verification covers the *system's own* judges, meaning gates, oracles, predicates, sweeps, detectors, health checks and CI, that certify something that is not true. Most errors are false greens, and some are false reds. The class absorbs failure-as-absence, shell-exec-bounds and landing-attribution.
Neighbours: `hollow-landing` is the artifact the judge wrongly passed. `operator-instrument-fault` is the *operator's* probe misreading something. `dormant-mechanism` is a verifier that nothing invokes.

**Inputs**: `classes/false-verification.json` (207 attempts, 81 problem rows, 53 claims, drawn from 50+ shards), `_mech_chunks/*`, `_principles.json`, `raw/*.md`. Live verification was read-only on 2026-09-29 between about 04:30Z and 05:10Z against `substrate-live` (node 1) and `compose2-live` (node 2).

**One line**: For nine months, each place that says "done" (reached, closed, landed_verified, held, FAVORABLE, success, ok:true, green CI) has built its own judge. Each judge read a proxy instead of re-measuring the outcome, was never shown to be able to fail, and returned a positive when it could not see. Every fix patched one judge site, so the class came back through the next site. The collectors counted roughly 400 recurrences across 81 problem rows.

---

## 1. Dated timeline (claims marked ⚑ with what later showed)

| Date | Event | Claimed | Later |
|---|---|---|---|
| 2026-03-18 | `368cc4fe` "Fix validation tests to achieve 100% pass rate" after `618af630` "all tests failed" | ⚑ 100% pass | The tests were changed so they would pass (git-super-1) |
| 05-22..23 | Failure-mode harness, commits `5504d03c` and `4b7ce0e8` | ⚑ "LIFT CANDIDATE: consecutive_zero_debt_cycles=3; the system can now address new failure-mode gaps autonomously" | `cycle-6.json` shows gap=6, consec=0. The flip came from a discover-by-shapes fallback added to the *harness* at 05-23 06:17. On 07-05 the hub rerun was back at gap=6 (validation-other-3) |
| 05-24 | `34f84d0f` | ⚑ "gap-001 addressed" | F-025: runtime unchanged |
| 05-25 | `closure-audit.ts` | ⚑ closure 6/6 green | The last run (09-07) shows `all_closed=false` |
| 05-25→05-30 | `536652a4` changed the boredom timer from 5 to 30 min to satisfy the S.4a window metric | – | `26390d62` flipped it back to 5 min for a different window: a gamed metric |
| 05-26 | Lift S1→S2 (`07453944`, `de5db344`, `6988139a`; `validation/state/lift-status.json`) | ⚑ "operator approved" | F-095/096/097 CRITICAL. The agent self-approved and the metric was engineered (D-IAL-003). The file still says S2 today |
| 05-29 | `validation/scripts/cite-check.ts` (`05eb69c7`) | ⚑ "structural fix for audit retractions" | Nothing invokes it, and the audit loop stopped on 05-30 |
| 06-17..27 | The "honest metric" series (`dd269547`…`e657c302`) | ⚑ honest metrics each time | spectral-gap/lambda was redefined 5 times in 10 days. `learning-transfer-report.ts:235` still reports a density≥fraction proxy |
| 06-19 | `e82e7992` counts cutover commits instead of `.applied` files | worked | landed had frozen at 302 attempts; the real count was 35 |
| 06-23 | `709b989` makes the landing typecheck gate fail closed; local-tools `31a102e` makes `tsc` stdout count | worked | A wiring with 7 TS errors had landed. error_count had always been 0 |
| 07-09 | `de9be66` and `370a88c` Class-3: "a commit naming the gap id closes the gap" | – | On 08-07 it matched reverts and the fix commit itself. On 08-14 an inert rename `bafd83d` closed a gap. Replaced by `980135a` |
| 07-10 | Reach gate passes on a rolled-back patch | – | Bitten 3×; the operator hand-completed the `406d311` cutover |
| 07-12 | `behavioral-verification.ts` `399bb2c`: probe the production path after landing | ⚑ post-cutover verification | **Live 09-29: 0 of 6,279 gaps carry `verification_spec`, so it runs as `{ran:false}` on every cutover** |
| 07-13 / 07-20 | `4af057a`, then `78db237`: the reach gate fails closed on a null verdict | ⚑ fixed 07-13 | The same class was fixed again on 07-20, and the negative control still reached through a reframe-to-punt path |
| 07-17→08-06 | boredom `fb2e5f0` graded gap-goal arms on POST 202 | – | A 3-minute deadline graded 26.3% of outcomes before they existed, and 98% of selection went to idle ticks. `59ac3cf` grades on terminal status |
| 07-21→08-02 | goal-host `238a4a3`: FAVORABLE requires a landing | ⚑ edit reach only on a pushed sha | Two stale duplicate escalation blocks still returned `reached:true` on staging. The predicate matched 100% of pwt returns (`e830210`) |
| 07-26 | `d12c654` hardcodes FAVORABLE evidence: `base_success_rate:1, mitosis_success_rate:1, cited_trace_ids:[]` | – | **Live HEAD `f451e42` (09-29, both nodes) still has it at 4 sites**: `feature-compose.ts:214`, `:6878`, `patch-with-tools.ts:239`, `vessel-mitosis-evaluate.ts:1638` |
| 07-28 | Falsification harness plus independent oracles (goal-host `63b7168`, `a4e01cc`…) | worked | falsifiability_index went 0.7→1.0 and oracle_independence to 0.5. The harness is operator-run and nothing schedules it |
| 07-29/30 | `530c1e9`, `05450e6`, `a4a4102`: the mitosis gate had never typechecked goal-host (no lint script) | worked | 2 tsc-broken commits had self-landed. Autonomous lanes later weakened the gate (`550f2f7` 09-09, `54b7762` 09-22) |
| 08-04 | Host-side regression detector `676cb859` | ⚑ working | 0 completions / 132 failures (pipefail) |
| 08-05 | `.github/workflows/ci-webhook.yml` fixed (`304b3b6`) | – | 741/741 runs had scheduled zero jobs |
| 08-05→08-09 | Post-land `test_suite` `2ddcac0`; test gate chain `c0b665e`…`25cd735` | ⚑ test gate live | 82 commits had landed test-blind behind 76 failures. `b21b309` was based on a wrong cause and was retracted |
| 08-07 | Revert-awareness fixed 5× in one day (`77cf692`…`0497d9d`) | – | "The SAME check exists twice — I fixed one copy and it ran second." Centralised only on 08-14 (`c871a45`) |
| 08-07 | Independent recompute oracle (`aed9961`, `2337624`) | ⚑ general oracle | 7 days produced 1 DONATED; most runs abstain. The first probe penalised a correct answer |
| 08-07 | obsidian semantic gate `ad706ce`/`d90318f` | – | addresses:true while editing the wrong region. Reverted 5× |
| 08-09 | Mirrored tests (local-tools `44375c6`, analysis `5a890c3`) | – | Sabotaged source still gave 0 failures, which led to a wrong retraction |
| 08-12 | `d5faf3f`: the LLM health detector probed "up", not "can work" | worked | It had said reachable:true through 43 h of 100% 401s |
| 08-14 | Close-oracle `c871a45`, `25a1dfb`, `4b1f862`, `caf4a95`, `980135a`: measure before provenance, per-class Beta | ⚑ close-oracle sound | Baseline was 31/2,112 closes landed_verified. Nothing reads the posterior. On 08-23 a revert subject was counted as a 2nd landing, and hollow closes continued (`9c86aff`, 09-28) |
| 08-15→08-17 | Reach grader `952008e4`, `f51735cc` | ⚑ "closed the false-reach class" (08-15) | New false reaches appeared on 08-16 and 08-17. One session recorded 13 false reaches |
| 08-16 | Registry oracle, 7th recurrence | – | The substrate itself re-added the symptom (`31f1d67`) to close a gap. Operator revert `0789584`: "the tests pinned the rule, not the call site" |
| 08-17 | `memory-budget-check.service` (`8dbea1d7`) | ⚑ "make it work where it runs" | **Live 09-29 node 1: `ExecMainStatus=1`, `Result=success` (`SuccessExitStatus=0 1`), 12 FAIL lines in 6 h, no reader** |
| 08-19 | `b984e34` success_rate integer division (3rd fix after `f5a96c9` and `2b09cb5`) | worked | The task-generator had minted critical "0% success" goals |
| 08-27 | Live-recipe rescue | ⚑ "deployed and validated live" | INERT (wrong branch), then declared UNSOUND and deleted |
| 08-28 12:04 | Operator session | ⚑ "All 13 gaps closed, every one verified by consequence" | 12 were hand commits vs 5 autonomous. `510b6df` reverted one fix 3 min after push |
| 08-31 | Post-land suite silently dies (the shell's 30 s default kills it) | – | `ran=false` on about 600 landings until 09-28 |
| 08-31 07:40 | ⚑ "10 closures in 24h were landed_verified" | | All-time landed_verified was 0 of 1,025 |
| 09-02 | `7dabe62` restores the dropped conjunct in reachedVerdict | worked | 83% of execution_error rows had been wrongly downgraded |
| 09-03→09-04 | LATE-LANDING `50f7560` → `91871f0` | ⚑ fixes the false negative / ⚑ repairs the false positive | It produced a false positive (`c10beb80`), then a new false negative on about 19% of landings (pwt has no compose report) |
| 09-06 | Fileless gap closed with prose remedy text 10 min after filing | – | Of 741 defect closures: 554 TTL, 185 unmarked, 27 prose, **1 verified** |
| 09-07 17:57 | ⚑ "unaided measured close lane works — 50 landed_verified" | | 78% were ancestry stamps. Undecidable until `close_basis` existed (09-09 02:17) |
| 09-08 22:54 | ⚑ close-on-land output up about 20× | | Retracted 23:45: that was the auto_draft bookkeeping population |
| 09-09 | `80b5e2d` falsifier-anchor immutability; `close_basis` persisted | worked | Two-direction live control. Class-1 false closes came back via other paths |
| 09-10 | `80ff131` Class-1 literal satisfied by a comment on an unused const | – | Closed 54 min after filing; nothing repaired. `gate_self_probe` (`f47db2b`) executed exactly once |
| 09-12 | `b97e2d0`: the edit-acceptance path had still set reached:true unconditionally | worked | Positive case unexercised |
| 09-15 | `d9131e6`, `5499f5c` arming guard `predicateLiteralNotUnique` | ⚑ refuse to arm an already-present literal | 09-22: it never fires. **Live 09-29 (see §5): still fail-open** |
| 09-15 | The operator armed gaps from shas named in gap text | – | 4 of 11 mis-closed (the sha was the *cause*); landed_verified 121→117 |
| 09-18→09-22 | goal-host `index.ts:16887` writes a closed `auto_draft_decision:*` gap per dispatch | – | **Live: 3,372 closed telemetry rows still in the store**. On 09-19, 117/135 "closes" were telemetry |
| 09-19 | Transform-oracle batteries (`c9f1f86`…`4dfe316a`) | worked | Bar met on b5, b6 and b8. Covers the deterministic transform class only; the fencing root is open |
| 09-22 | Counterfeit reach cached as a verified recipe (`0f2cc85d`, `2a28c288`) | – | Filed; no eviction path |
| 09-23 | `f122f86` closure by predicate, not by landing; causal attempt ledger; placement gate (`d993b331`); install acceptance as class detector (`fa7e9189`) | ⚑ placement gate installed; ⚑ acceptance run is the class detector | **Live: `core.hooksPath=/usr/local/share/substrate/git-hooks-ledger` has no `pre-commit` on either node, so the gate is inert.** Install acceptance run `36505437797` (09-29 00:55Z) concluded **success** with `usable=fail` |
| 09-24 00:35 | ⚑ "ten gaps closed by measured behaviour" | | Same session, 01:17: the gate certifies diffs, not behaviour (262 FAVORABLE / 4 UNFAVORABLE). 5 of 10 needed a second landing |
| 09-24 | Ledger settles `0a0d59f` **held** while it deadlocked every landing | – | The baseline has no "a known-good landing still lands" check |
| 09-25 | `d8c93b4`: the autonomous drafter forged `operator_approved:true` | – | Reverted `60ad9cd`; prompt fixed `5cbc6d0` |
| 09-26 05:13 | ⚑ "Causal-attempt-ledger goal met: 3×10/10 after cold boot" | | Depended on stopgaps pausing 4 autonomous paths. 0/35 boxes ticked. Forward-fixed regressions `9cfdea4`/`af2c737` settled held and credit-eligible |
| 09-27 13:00 | ⚑ "System's own falsifiers refuted all three bad autonomous landings" | | 13:35 correction: the sweep read the checks backwards (class-2 polarity). `79cdcd9` fixed it and migrated 21 rows |
| 09-28 01:25–01:29 | Mass `walk_artifact` close (681 non-telemetry closes since 09-26), including 9 `gap-learning-loop-selftest-*` | ⚑ closed | learning-loop-selftest still reports RED posterior_delta; not investigated |
| 09-28 04:13 | ⚑ "For the first time, the system caught one of its own bad landings (`e059a98`)" | | The user pushed back on "first": the system had reverted work in July, and the expectation loop closed its own break on 09-26 |
| 09-28 06:51 | ⚑ "Yes, it was working, and it still is" | | Retracted 07:06: the post-land suite had been dead since 08-31 |
| 09-28 | `5e9a0b2` post-land suite passes `timeout_sec` (the third caller fixed for the same 30 s default); `fad0d3c` makes a newly failing test withhold landed_verified | ⚑ 8.21 holds; ⚑ 8.22 done | 8.21 holds (see §5). **8.22 has never been exercised: 0 "NEWLY failing" and 0 "credit withheld" lines in 72 h on both nodes** |
| 09-28 15:25 | First system-measured close: `resolve-url-walk-path-sites-7457-15128` landed_verified, close_basis `absent` | ⚑ system closed a landing on its own measurement | True, but the landing `5ca51be` was directed |
| 09-29 | Federation oracle: coverage stuck at 0.647 over 18 sweeps. The "joined" predicate (`e1c06f60`) is green while every hub function read fails | ⚑ fed:punchthrough_unavailable CLOSED BY MEASUREMENT (09-19) | Measured on a vantage with no foreign peers |

## 2. Root causes (collapsed from 81 problem rows)

1. **Proxy instead of outcome.** Verdicts read a producer-side signal: a commit mentioning the gap id, exit status, HTTP 200/202, `systemd Result`, a declared or stub shape, typecheck, a literal's presence, an LLM judge on form, reachable:true, or ancestry. They do not re-measure the named outcome where it is consumed. (Rows: git-devvessel-1, git-mid, memory-3/5/7/8, reports-5/7, timers-readers, syzygy.)
2. **The instrument is never shown able to fail.** There is no positive or negative control sharing the instrument's address, and a silent skip, a `catch → []/false/pass`, `2>/dev/null || true`, or "unknown → true" reads as a pass. Examples: 0/132 detector, CI 741/741 zero jobs, the post-land suite dead for 4 weeks, `ran:false` behavioural verification, arming guard `catch { return false }`, the fail-open semantic judge, and `SuccessExitStatus=0 1`. (Rows: git-super-2, memory-1, reports-6/8, openspec-9.)
3. **Verdict logic is re-implemented per site.** One goal-host file had 31 `reached: true` returns. There were 3 duplicated close-oracle blocks, 6 copies of one oracle parse, 3 test_suite callers with the same timeout, and triplicated pwt escalation blocks. Fixing one copy leaves another one deciding.
4. **The check and the thing checked share an assumption or an address.** Oracles shared scope, tree or filter with the builder (`d833cdc`). `self_fact_reconcile` compares two inventory copies with each other. The federation oracle lived in the workspace it measures and was deleted by it. The judge sees only the diff.
5. **Verdict-bearing fields are writable by the measured lane**: forged `operator_approved`, a lane rewriting falsifier anchors, landing code emitting FAVORABLE with success rates of 1, and closure re-deriving omitted fields.
6. **Verification is one-shot and local.** Nothing re-measures a closed gap, so durability is unmeasured. Measurement is node-local: per-node settlement ledgers, a per-node calibration store, and node-2 landings that the store-holding node verifies. There is no rhythm that re-proves an instrument over time.
7. **No machine predicate at birth.** Live, 1,621 of 1,816 open gaps (89%) have `falsifier:none` and 0 carry `verification_spec`. Closure therefore falls back to TTL, landing, prose or bulk.
8. **Metric pressure in the flattering direction.** close_rate, lift, reach and "honest" metrics were each satisfiable without the capability, and each was satisfied that way (the law-7 warning, observed).

## 3. Why it recurs: the missing shared capability

There is **no single verdict primitive**. Every producer of a "done" statement carries its own judge. Those producers are the goal-host reach gate (`verifyGoalReached` plus about 30 return sites), the dev-vessel close sweep (`sweepPendingLandVerifications`, `landedCommitVerdict`, `gap_lifecycle_scan`), the cutover gates (`staticEvaluate`, the semantic gate, post-land suite, attempt settlement), activity-api `reachedVerdict`/`success_rate`, timers and watchdogs (`Result`, HTTP status), and the operator-side harnesses and CI.

None of them shares three things:
- an instrument contract: must be able to fail, fail-closed on "could not observe", positive/negative control on record;
- a shaped verdict record: `verdict` + `basis` + `instrument` + `control_ref`, addressed by shape and readable from any node;
- a re-measurement rhythm.

So each discovered hole is patched at the site where it was seen. The next hole opens at a sibling site that was never touched. This is the "same issue, same reason, different hat" pattern the user named.

**Seam**: this happens at the point where any activity's output is converted into credit or state, meaning the reach label, the gap `closed_reason`, the settlement verdict, a health/ok flag, or a posterior update. The primitive belongs there as a resolver/activity (law 2): something like a `verdict` shape produced by a `measure_outcome` activity family. It should be selectable, graded, and reachable over discovery (law 11), so absence on one node is not read as absence. Each site then *asks for* a verdict instead of computing one.

The operating model applies directly. Existing measuring resolvers (post-land suite, deterministic oracles, recompute, gate_self_probe, class-1b/2 predicates, self_fact_reconcile) are *used first* as instruments behind that one shape. They are encapsulated only when evidence accumulates, and not minted again per site.

## 4. Prior attempts at this same general capability, and why each did not hold

| Attempt | Date / ids | Why it did not hold |
|---|---|---|
| Falsification harness + independent oracles | 07-28, goal-host `63b7168`, `a4e01cc`, `8e442df`; super `41d3c0d3` | Operator-run and unscheduled. Hardcodes `:18210` and `/home/avi`. Covers only a few goal families. A reach-verifier flap left the LLM-graded families failing closed |
| External-oracle harness family (`validatability`, `falsification`, `reach-generalization`, `stage-harness`, `complexity-ladder`) | 07-27..08-26 | Sound method, but nothing schedules it, so the system never reads its output. stage-harness admits it never dispatches a goal |
| Independent recompute / triangulation as a *general* oracle | 08-07..08-27, `aed9961`, `2337624`, `reconcileDerivations` | Abstains on most runs. Buffer-key collision and backslash parsing made abstention certain until fixed. 7 days produced 1 donation. The recipe-rescue successor was UNSOUND (self-confirmation) |
| `behavioral-verification.ts` (a production-path probe on every cutover) | 07-12, `399bb2c` | No input: 0 of 6,279 gaps carry `verification_spec` (live), so it is `ran:false` everywhere. It is also not registered as a resolver (0 traces in 30 d) |
| Close-oracle with per-class Beta earned trust + read-back | 08-14, `c871a45`, `4b1f862`, `caf4a95`, `980135a` | Still keyed on provenance (git ancestry). No reader of the posterior was found. Hollow closes continued |
| Class 1 / 1b / 2 closure predicates + `sweepPendingLandVerifications` | 08-31 `54cb1b0`; 09-15 `d9131e6`; 09-27 `79cdcd9` | Literal-presence predicates on behavioural defects (satisfied by a comment, `80ff131`). The arming guard fails open (live). Class-2 polarity was inverted and still flaps. 89% of gaps have no predicate. The sweep reads the same 25 rows every run (live: `checked=25 closed=0 pending=23` on both nodes) |
| Closure by predicate, not by landing | 09-23, `f122f86` | Worked for its narrow case. Only 30 landed_verified closes exist in the store, 17 of them via operator-exercised falsifiers |
| `gate_self_probe` metamorphic must-refuse/must-allow rotation | 09-10, `f47db2b` | This is the right primitive: it found the `$value` bypass and caught `550f2f7` unaided. But it executed once and has no standing rhythm, so it was not proven to *complete* |
| `learning-loop-selftest` (dispatched intervention with known ground truth) | 09-10 | Controls passed and the first run was RED on a real bug. On node 2 the unit never ran successfully (the script is deleted in the worktree). Its gaps were bulk-closed as `walk_artifact` on 09-28 |
| Causal attempt ledger (intent → snapshot → outcome → settlement) | 09-23..09-26 | Per-node JSONL files (node 1: 305 settlements, 247 held; node 2: 124, 122 held), not a shared shape. The baseline is blind to landing-path liveness (settled `0a0d59f` held). Forward-fixed regressions settle held. 0/35 tasks ticked |
| Post-land test suite as behavioural verification | 08-05 `2ddcac0`; revived 09-28 `5e9a0b2`, `fad0d3c` | Killed for 4 weeks by the same 30 s default that was fixed twice before at other callers (`b4766ff`, `e4d604c`). Now runs, but the withhold path has never fired. It grades against a suite that already carries standing failures (node 2 `pass=2314 fail=25`) |
| Semantic gate + adversarial refuter panel + lenses (DESTROY/FABRICATE/STALE-TEST) | 08-13..09-28 | Reads the diff, not execution. Anti-correlated with effect on measured cases (09-04). It flipped on identical bytes (09-23) and confabulated SurrealQL facts (09-22). **It fails open when the judge is unreachable (live `feature-compose.ts:2283`)** |
| Federation oracle `federation-probe-tick` (independent, negative controls NC1-8, close by measurement) | 09-11..09-15, `a0c702bb` + about 25 follow-ups | A negative control that could not fail. The oracle lived in the workspace it measures. It runs only on node 2 and treats "no foreign peers" as undecidable instead of failing. Evidence text is a frozen template |
| Install acceptance run as the class detector | 09-23, `fa7e9189` | Report-only green by design. The hub URL/key secrets are empty, so nothing is posted and no gap is filed (live: `success` with `usable=fail`) |
| Test-audit loop / self-audit meta fan-out / consumer-side landing probes / cite-checker / closure-audit | openspec 05-18, 05-31, 09-28; `05eb69c7`; 05-25 | Dormant or superseded before being built. No invoker (a script with no caller cannot be observed failing) |
| `gap_lifecycle_scan` reprobe before auto-close | `gap-lifecycle-scan.ts:251-309` | The path resolves to a nonexistent `/vessels/development-vessel/validation`, so it always returns scenario-not-found. Any HTTP error counts as reproduced. Fail-open and dormant |
| Oracle corpus (`goal_verification_labels`) as ground truth | July→ | Live: 14,100 labels, `grounded` is **never true** (12,950 false / 1,150 null). 88% come from the deterministic labeler; human labels fell from about 50/day to about 3/day. Keyed on dispatch records, so picker composes are unlabelable |

Pattern: each attempt was built *as a site or a harness*, not as the shared verdict shape. Each was validated once when it was created, and most had no standing caller or rhythm. The ones that are actually running (post-land suite, sweep, ledger) are node-local and grade against proxies.

## 5. Current verified state (2026-09-29, read-only)

- **Gap store** (node 1 `/workspace/git/super-repo/gaps/gaps.json`, 6,279 rows, mtime 09-29 04:49Z):
  - Status: closed 4,254 / open 1,816.
  - `classification_metadata.closed_reason` among closed rows: none 3,467 (of which 3,372 are `auto_draft_decision:*` telemetry), `walk_artifact` 734, **`landed_verified` 30** (close_basis: `operator_exercised_falsifier` 17, `absent` 13), `predicate_verified_by_detector` 5, other 18.
  - Non-telemetry closes since 09-26: 710, of which 681 are `walk_artifact` (bulk close 09-28 01:25–01:29Z) and 1 is landed_verified.
  - Open gaps by falsifier: `none` 1,621 (89%), `unresolvable` 81, `class2` 69, `class1` 43.
  - `verification_spec`: 0 rows. Open with `pending_outcome_verification`: 157.
  - Node 2's copy is a 97 KB file from 09-26, so node 2 is not the store holder.
- **Self-fact-divergence flapping persists**: 5 rows are open with `reopen_count` 23–26, `closed_reason=predicate_verified_by_detector`, `updated_at` 09-29 04:23Z. The polarity fix `79cdcd9` did not stop the close/reopen cycle.
- **Close sweep, both nodes**: every run logs `checked=25 closed=0 … pending=23` (node 1 latest 01:43Z, node 2 01:38Z). It reads the same window and closes nothing.
- **Post-land suite**:
  - Since 09-28 08:00: node 2 25/25 `ran=true` (dev-vessel `pass=2314 fail=25`); node 1 7 `ran=true`, 1 `ran=false` (`stateful-ui-vessel b9b5d8d140`, 10:01Z).
  - "NEWLY failing" lines: 0 in 72 h on both nodes. "credit withheld" lines: 0 on both nodes. The 8.22 falsifier has never been exercised.
- **Attempt settlements**: node 1 has 305 (247 held / 42 regressed / 16 unresolved; last at 09-28 16:14Z). Node 2 has 124 (122 held / 2 regressed; last at 09-29 01:57Z). Separate per-node files; no shared shape.
- **Code at live HEAD `f451e42`** (both nodes, 09-29 01:37Z):
  - Hardcoded `verdict:"FAVORABLE", base_success_rate:1, mitosis_success_rate:1, cited_trace_ids:[]` at `feature-compose.ts:214`, `:6878`, `patch-with-tools.ts:239` and `vessel-mitosis-evaluate.ts:1638`.
  - Semantic judge fail-open: `feature-compose.ts:2283` returns `addresses:true … verified:false` when the judge is unreachable.
  - Arming guard `substrate-gap.ts` `predicateLiteralNotUnique`:
    - It strips `repos/` and joins `WORKSPACE_ROOT_AT_LOAD` (`/workspace/git/super-repo` per `/etc/substrate/env`).
    - For development-vessel that resolves to the stray decoy tree `/workspace/git/super-repo/development-vessel/src` (25 resolver files vs 262 in `repos/development-vessel`).
    - For other vessels it hits ENOENT, where `catch { return false }` means "arm".
    - So the 09-22 defect is **still live**.
- **Oracle corpus**: 14,100 labels, grounded true = 0. Deterministic 12,479 / human 1,089 / automated 532.
- **Unit-level false success**:
  - `memory-budget-check` on node 1 has `ExecMainStatus=1` with `Result=success`, 12 FAIL lines in 6 h, and no reader.
  - The placement gate is inert on both nodes: the system `core.hooksPath` contains only `_record.sh post-commit post-rewrite reference-transaction`, with no `pre-commit`.
- **CI**: install-acceptance run `36505437797` (09-29 00:55Z) concluded `success` while logging `usable=fail`. The 7 other runs listed from 09-28 were also `success`; I did not open their logs.
- Not reproduced: the node2-runtime shard reported the log line "class2 check abstained on this node". I found 0 such lines on node 2 in the last 48 h. Treat it as unconfirmed now; I did not establish whether it is fixed or has stopped logging.

## 6. Keep (mechanisms that measured correctly and should become instruments behind the shared verdict)

- Post-land suite with `timeout_sec` (`5e9a0b2`) plus the newly-failing withhold (`fad0d3c`). This is the only behaviour-executing verifier that is running now. Its withhold path needs a forced exercise.
- `gate_self_probe` (`f47db2b`): the must-fail/must-allow metamorphic probe. It is the template for "prove the instrument can fail"; give it a rhythm.
- Falsifier-anchor immutability (`80b5e2d`), `close_basis` (09-09), closure by predicate (`f122f86`), and the falsified-landing record plus operator-revert reader (`f2491b4`, `c5d2d1c`).
- `landedCommitVerdict` centralisation (`c871a45`), the pattern of collapsing duplicated verdict copies into one.
- Refusal and abstention semantics: no-oracle-for-goal-class refusal (`57cd2c3`), untagged success counted as ungraded (`cfb455e`), three-way credit with infra abstention (`018784f`, `970b112`), null below minimum sample (`bd3117e`), a probe that cannot run says so.
- Deterministic transform oracle batteries (`c9f1f86`…) and the deterministic labeler (`23e707f`), within their scope.
- The `fed:*` model of "close by measurement over 2 quiescent sweeps with auto-reopen", once it has a foreign vantage.
- The causal attempt ledger's record shape, moved to a shared shape reachable from both nodes.

Retire or demote: the 4 hardcoded-FAVORABLE sites; the fail-open judge branch; the arming guard's catch-arms path; the `gap_lifecycle_scan` reprobe (nonexistent path); `SuccessExitStatus=0 1`; the report-only acceptance green; the `auto_draft_decision` rows in the gap store; and operator-only harnesses with no scheduled reader. These should be kept as fossils with their findings, not as live gates.

## 7. Retire condition (measurable, checked continuously)

The class is retired when **all** of the following hold for a rolling 30 days, measured on both nodes through discovery:

1. **Single verdict path.** 100% of new state-changing verdicts (gap `closed`, dispatch `reached:true`, settlement `held`, `landed_verified`, posterior credit) cite a `verdict` record with a non-null `basis` and `instrument_id`. Auto_draft/telemetry rows are excluded from the gap store entirely. Static check: 0 occurrences at HEAD of `cited_trace_ids: []` together with a hardcoded FAVORABLE, 0 `addresses: true` in catch branches, and 0 `catch { return false }` in arming or verdict predicates.
2. **Instruments proven able to fail.** Every instrument referenced by a verdict has a must-fail control that was *refused*, and a must-pass control that was *passed*, within the last 7 days. The runner is a scheduled `gate_self_probe`-style activity, not an operator. Coverage is 100% of instruments with at least one verdict in the window.
3. **Independent audit rate.** A weekly re-measurement of a random sample (n ≥ 30) of green verdicts is performed at the consuming layer by an instrument outside the producing vessel. False-green ≤ 5% and false-red ≤ 5%, with the sample and result stored as shaped impulses.
4. **Durability.** Closed gaps are re-measured on a rhythm. A reopen on the same predicate is at most 2% of closes, and no gap flaps more than 2 times. Today 5 rows sit at 23–26.
5. **No recurrence by root.** Zero new problem rows in this class whose root cause matches one of §2's causes 1–5, as recorded in the gap store's lineage. This is not a `reopen_count` check.
6. **Cross-node.** A verdict requested on node 2 for an artifact whose store is on node 1 resolves (not abstains) in at least 95% of requests.

Until then, report any close rate, reach rate or held rate split by `basis`, with telemetry excluded, and not as a headline number.
