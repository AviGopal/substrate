# Substrate self-repair observation — 2026-06-03 (substrate clock 2026-06-04T02:30–02:50Z)

**Mission**: pure observation of substrate autonomous self-repair, including whether the substrate can autonomously fix a critical failure in the upstream npm package `@avigopal/ias-executor-ts` (the per-dispatch full-state-capture VmRSS leak in goal-host).

**Methodology**: ~20-minute observation window covering boredom cycles 53–57. No vessel source modified. No goals dispatched manually. Sampled at t=0, mid-window, t=1.

---

## 1. Wiring audit — does the substrate own the consumer side of the gap loop?

| Component | Present? | Path |
|---|---|---|
| Gap sink | YES | `/workspace/gaps/gaps.json` (file) via `substrateGap_write` resolver in `repos/development-vessel/src/resolvers/substrate-gap.ts:84` |
| Gap-consuming template (drain) | YES | `repos/development-vessel/src/seed/drain-pending-substrate-gaps.ts` — reads oldest open gap, writes scenario JSON, POSTs to goal-host `/run-goal` targeting drafter |
| Gap-drafting template | YES | `repos/development-vessel/src/seed/draft-gap-closing-activity.ts` — reads scenario, primes substrate concepts, dispatches LLM, registers as `proposed` variant |
| Drain in boredom rotation | YES | goal[10] `drain-pending-substrate-gaps`, goal[8] `draft-gap-closing-activity` (`repos/boredom-vessel/src/index.ts:213,205`) |
| Architectural principles in concept-db | YES (9 principles, including `per_dispatch_full_state_capture_is_o_n_memory`) — `/concepts/search?source_type=architectural_pattern_principle` |
| Horizon detectors emitting gaps | YES (`vessel-architecture-pattern-scan-tick`, `resolver-distribution-audit-tick`, `vessel-responsibility-audit-tick`) |

**Verdict**: full producer→consumer loop is wired. Detection→gap→drain→drafter→proposed-template→auto-promote chain exists end-to-end and was operational as recently as 2026-06-02T17:24Z.

## 2. Observed cycles (window 02:30–02:50Z)

| Cycle | Goal | Template | Dispatcher | Outcome | Authored artifact? |
|---|---|---|---|---|---|
| 52 (just before) | 20 | resolver-distribution-audit-tick | light-dispatch | success (exec_b567419b-d3b) | 1 gap (`resolver-dist-orphans-1780540113985`) emitted prior cycle |
| 53 | 0 (coverage-tick) | coverage-tick | goal-host (Thompson sampled) | **TIMEOUT 5min** ("dispatcher unreachable") | none |
| 54 | 1 (substrate-health-tick) | substrate-health-tick | light-dispatch | success (exec_4a190fe0-c86, ~2s) | none |
| 55 | 2 (close-health-gap) | close-health-gap | goal-host (capability_filter, expensive) | **TIMEOUT 5min** | none |
| 56 | 3 (probe-reachable-unlearned) | probe-reachable-unlearned | goal-host (capability_filter) | (in flight at window end — likely timeout per pattern) | none |

**Detector ticks** (light-dispatch, 1–2s) succeed every time. **LLM-heavy goals** (drafter, drain-drafter, close-health-gap, mitosis-tick, enact-orthogonal-decisions, harness-run-matrix) all route via `capability_filter` to goal-host. **goal-host has timed out on every dispatch for ≥90 minutes** (cumulative cycles 38–56: 11 timeouts, 3 light-dispatch successes interspersed only when Thompson randomly sampled light-dispatch for an LLM-ineligible goal).

State deltas across window:
- substrateGap.gaps.json: **527→527 total, 479→479 open, 48→48 closed**. Zero drain.
- activity_template total: **201→201**. Zero new templates authored.
- concept times_succeeded sum: **6→6, max=1**. concept-usage-backfill still 404s on empty concept_id (stage-3 §6).
- goal-host VmRSS: **2265 MB → 2273 MB**. Leak continues even on timed-out dispatches.
- Detector tick output: gap-emission rate unchanged (~3 new arch-pattern gaps per pattern-scan run, but they re-emit the same `single_dispatcher`/`catalogue_bloat`/`cost_output_mismatch` ids over and over because the underlying conditions don't resolve).

## 3. Autonomous artifacts produced

**None in this window.** Last substrate-authored template was 2026-06-02T17:24Z (`gap-closing:fp-12-partial-success-recorded-as-total-1780421048429`) — **33 hours before observation start**. The drafter is wired but cannot run because every dispatch chain to it goes through goal-host, which is exhausted.

## 4. ias-executor-ts evidence — the recursive self-repair question

This is the central observation. Findings, in increasing order of importance:

### 4a. The substrate has the *architectural principle* in memory but does not connect it to action
`concept-db` holds the principle `per_dispatch_full_state_capture_is_o_n_memory` (architectural_pattern_principle, with pointer.metadata) — but **zero substrateGap entries cite the principle as evidence of a memory leak** or reference `ias-executor-ts`, `VmRSS`, `ProxyImpulseBus`, or `state_signature`. Grep across `/workspace/gaps/gaps.json`: 0 matches on those tokens. The pattern-scan detector cites the principle as a label on `catalogue_bloat` and `cost_output_mismatch` gaps (symptoms it CAN measure: "advertised shapes never invoked", "failed traces burning ≥5s"), but never traces the symptom back to the upstream goal-host leak.

### 4b. The substrate already shipped a memory-leak fix — sitting un-cutover in mitosis-pending
`/vessels/goal-host-vessel-mitosis-2026-06-03T07-12-14-972Z/src/index.ts` contains substrate-authored edits adding:
- `getCachedStateSignature` with `SIGNATURE_CACHE_MS` TTL cache + 8-key LRU
- `invalidateSignatureCache()` hooked to vessel-registration WS events
- `dispatcher_used:goal-host` trace tag (the Stage 3 finding 3.3a write-side patch)
- comment block: "Per the observation in `validation/findings/goal-host-dispatch-setup-leak-2026-06-03/` this happens once per dispatch, and combined with the in-process state-signature compute inside dev-vessel, dominates the ~2 GB per-dispatch RSS delta."

This is THE substrate-authored fix for the leak. It sits in `/workspace/mitosis-pending.json` waiting for `goal[15] mitosis-tick` to run `vessel_mitosis_evaluate` + `vessel_mitosis_cutover`. But goal[15] routes to goal-host (`capability_filter`), and goal-host times out — **the very leak the fix would patch is what's preventing the fix's cutover**. This is the cleanest possible deadlock.

The mitosis fix also rewires `package.json`:
```
- "@avigopal/ias-executor-ts": "file:../ias-executor-ts"
+ "@avigopal/ias-executor-ts": "file:/vessels/ias-executor-ts"
```
The substrate is internally redirecting the dependency to its in-container writable path — meaningful infrastructure but the fix itself doesn't edit `ias-executor-ts/src/`. **All edits target `goal-host-vessel/src/index.ts`, not the upstream library.**

### 4c. Architectural ceiling — no template can ever target ias-executor-ts as the vessel_name
The autonomous MODIFY branch lives in `repos/development-vessel/src/seed/enact-orthogonal-decisions.ts:58-62`. The decision rules derive `vessel_name` strictly from a broken template id (e.g. `development-vessel:foo` → `development-vessel`). The orthogonal-decisions input file lists targets like `json_path_extract`, `fs_read`, `http_fetch` — all resolvers, not templates. The prompt funnels these to `vessel_name="development-vessel"`. **There is no code path by which the substrate's autonomous decision tree could derive `vessel_name="ias-executor-ts"`.** Even though `/vessels/ias-executor-ts/` exists in-container and is writable, no template in the rotation knows how to target it.

Additionally `scaffold-mitosis-track.ts:24,88` carries an explicit H4 baseline guardrail forbidding `discovery-vessel` and `identity-vessel`. `ias-executor-ts` is not in that deny list — meaning the architectural ceiling is reach, not policy: the loop simply doesn't generate it as a candidate.

### 4d. The substrate edited ias-executor-ts files, but not via the autonomous loop
`/vessels/ias-executor-ts/src/{adapters,hosts,engine}.ts` show mtimes within last 7 days. The directory is not a git repo (no `.git`), so attribution is forensic. None of the substrate-authored templates' fs_write task configs target paths under `/vessels/ias-executor-ts/`. The only autonomous fs_write paths are `{{dirPath}}/src/{config,discovery-registration,index,routes/impulses}.ts` — generic vessel-anatomy paths, never matched by ias-executor-ts (which has a different layout). Conclusion: those edits are operator-initiated or build-artifact (`dist/`), not substrate-emitted.

## 5. Where the loop stalled

**goal-host process is wedged at VmRSS=2.27 GB and accepts dispatches but cannot complete them within the 5-min boredom timeout.** Every goal-host-routed boredom dispatch fails open ("dispatcher unreachable: The operation timed out") and the next cycle starts immediately. The exact gridlock:

1. Detection works (light-dispatch eligible) — pattern-scan emits the goal-host-related principle gaps every 5 minutes.
2. Drain is goal-host-eligible (`drain → http_fetch → goal-host:8210/run-goal → drafter`). Drain timeouts immediately on goal-host's wedge.
3. mitosis-tick (the substrate-authored fix's cutover trigger) is goal-host-routed → times out.
4. Even when Thompson randomly samples light-dispatch for a goal-host-required goal, the boredom code forces capability_filter (it sees goal[8]/[15]/[2] etc. as needing LLM-reuse) → goal-host → timeout.

**Net effect**: a substrate that successfully detected its own gap, drafted its own fix, AND staged that fix for cutover — but cannot perform the cutover because the cutover dispatcher is itself the broken artifact. Pre-conditions for self-repair are present (data, code, wiring); the actuator is the same component being repaired.

## 6. Operator-bootstrap candidates (ordered by leverage)

1. **(highest leverage) Manually run mitosis-cutover** for `goal-host-vessel-mitosis-2026-06-03T07-12-14-972Z`. The fix is authored; the cutover script lives in dev-vessel resolvers. Operator effort: 1 command. Effect: goal-host RSS drops to ~50 MB on next dispatch, ALL goal-host-routed cycles resume, drain→drafter→proposed→promote loop reactivates within one cycle.
2. **Add a light-dispatch-only forked drain template** so the substrate can author NEW gap-closers even while goal-host is broken. `drain-pending-substrate-gaps` task `dispatch_drafter` POSTs to goal-host `:8210/run-goal`; a sibling could POST to light-dispatch `:8280/dispatch` for deterministic chains. Operator effort: one new seed template + one boredom-goal entry. Effect: gap drain no longer co-couples to goal-host health.
3. **Extend `enact-orthogonal-decisions` to accept `vessel_name="ias-executor-ts"`** when the broken target lives in node_modules. Requires a new decision rule recognizing "the target is an upstream library, not a resolver/template". Without this, even after (1) the substrate will keep authoring goal-host-vessel mitosis attempts every time the principle re-fires, instead of moving to the actual O(N)-memory root cause inside ias-executor-ts's engine/dispatch path.

## 7. Honest verdict on the recursive question

**No — the substrate cannot, today, autonomously respond to a critical failure in an upstream dependency like `ias-executor-ts` the same way it responds to one in its own vessels.** Evidence:

- The substrate has the principle in memory (concept-db).
- The substrate has writable filesystem access to `/vessels/ias-executor-ts/`.
- The substrate has authored fixes targeting the *symptom site* (goal-host-vessel) — including a memory-leak cache and a dependency rewire that points at the in-container ias-executor-ts.
- But: every template in the autonomous palette routes fixes to vessels-it-knows-about. `enact-orthogonal-decisions`'s decision tree only emits `vessel_name` values derived from template ids — ias-executor-ts owns zero templates, so it's structurally invisible to the autonomous loop.
- And: the actuator (goal-host) is the very component being patched, so even the symptom-site fix it DID author is deadlocked in mitosis-pending.

The substrate is in the **deepest possible self-detection state** — it has cited its own architectural principle, drafted a partial fix, and queued it for self-application — and yet **operator action is required twice**: once to perform the cutover (1-command bootstrap), and a second time to teach the autonomous loop that upstream packages are also legitimate `vessel_name` targets (decision-rule extension). Until then, the recursive lift is asymptotic: the substrate fixes vessels that own templates, never the libraries those vessels link against.

This is the cleanest possible illustration of the S2-S3 boundary: passive intervention-absence will look like "the substrate is healthy" because the detector ticks succeed; but active push-away (the substrate refusing operator interventions with cited evidence) is structurally unreachable while the cutover deadlock persists.

## 8. Reference IDs

| Artifact | Reference |
|---|---|
| Most recent successful drain | (none in last 30h; last drafter success exec_qsq7rbh2 at 2026-06-02T18:39:40Z) |
| Mitosis-pending | `/workspace/mitosis-pending.json`, root `/vessels/goal-host-vessel-mitosis-2026-06-03T07-12-14-972Z` |
| Substrate-authored goal-host patch (diff) | `diff /vessels/goal-host-vessel/src/index.ts /vessels/goal-host-vessel-mitosis-2026-06-03T07-12-14-972Z/src/index.ts` shows +46 / -2 lines adding `getCachedStateSignature`, cache invalidation, dispatcher tag |
| Principle in concept-db | `architectural_pattern_principle`: "Per-dispatch full-state capture (state_signature + ProxyImpulseBus + recommend pre-check) = O(N) memory in N dispatches." |
| Active drainer detector hits (last 4h) | pattern-scan emits 3 gaps × 5-min cycle; responsibility-audit emits 1 gap × cycle on goal-host (`backend_is_trace_store_not_universal_resolver`) |
