# Self-improvement loop observation — 2026-06-04

Window: T+0 = 08:58:42 UTC → T+END = 10:54:52 UTC (~116 minutes, cycles 144 → 167 in the boredom rotation, one full pass through all 24 autonomous goals plus a few extras).

## 1. Telemetry table

| Sample | gaps¹ | scenarios | proposal reports | mitosis dirs | templates / gap-auto | concepts / ts>0 / tl_sum |
|---|---|---|---|---|---|---|
| T+0  (08:58) | 532 (carried) | 154 | 145 (mixed)        | 2  | 100 / 35 | 42 / 6 / 311 |
| T+24 (09:21) | …             | 155 | 146 reports        | 2  | 100 / 35 | 42 / 6 / 355 |
| T+42 (09:42) | …             | 159 | 54 reports         | 4  | 100 / 38 | 42 / 6 / 422 |
| T+END(10:54) | …             | 172 | 56 reports         | 5  | 100 / 40 | 42 / 6 / 515 |

¹ `gaps` snapshotted only at start — substrate_gap table not requeried each sample (drain-pending-substrate-gaps and gap-to-scenario-bridge both fired but volume change is end-to-end visible as +18 scenarios). Drift is +18 scenarios, +2 mitosis dirs, +5 gap-closing:auto-* templates, +204 concept loads, **0 new concepts, 0 new ts/tf increments**.

## 2. Decision-making narrative

Per-cycle log lines name signature, mode, eligible dispatchers, reason. Sample (cycles 144–167, one pass):

| cycle | signature | goal | mode | dispatcher (reason) |
|---|---|---|---|---|
| 144 | 7e59b221 | 0  coverage-tick      | round_robin | light-dispatch (thompson_sample) |
| 145 | 3d4fb303 | 1  substrate-health   | round_robin | goal-host (thompson_sample) |
| 146 | 4daa98d8 | 2  close-health-gap   | round_robin | goal-host (capability_filter) |
| 147 | 4d970729 | 3  probe-reachable-unlearned | round_robin | goal-host (capability_filter) |
| 148 | 9bfcc921 | 4  harness-check      | round_robin | goal-host (capability_filter) |
| …   | …         | … | round_robin | … |
| 159 | 5a3791e8 | 15 mitosis-tick       | round_robin | goal-host (thompson_sample) |
| 160 | 5a3791e8 | 16 concept-usage-backfill | round_robin | light-dispatch (thompson_sample) |
| 167 | f5bb36a0 | 23 apply-proposal-as-patch | round_robin | goal-host (capability_filter) |

**Goal selection: every observed cycle reported `mode=round_robin (insufficient posterior samples)`.** Why: `selectGoalForLoadConditioned` requires ≥1 eligible (signature, goal) cell with ≥MIN_CELL_SAMPLES=3 traces *at the current signature*. The state-signature **changes nearly every cycle** (`fetchCurrentSignature` returns a fresh hash per tick from concept-db growth, recent template additions, etc.). Across the 24-cycle window only one signature repeated (5a3791e8 across cycles 159, 160). The denominator (samples-per-(signature, goal) cell) is effectively always 0 ⇒ Thompson never fires, the policy degrades to load-aware round-robin walking the cycle counter. The state-conditioning never gets a chance to express preference.

**Dispatcher selection: substantively transparent.** For cheap deterministic ticks both dispatchers are eligible and Thompson sample picks; for LLM/state-space goals the capability filter narrows to goal-host only. The reason field cleanly distinguishes `capability_filter` (forced) from `thompson_sample` (eligible-choice, but again under-sampled) from `exploration_bonus` (15% random) — observed mix matches expectation.

## 3. Trace accumulation against staged mitosis

Three new mitosis directories were staged during the window (09:32, 09:36, 10:50 — all by goal[23] apply-proposal-as-patch firing on cycles 143 and 167, plus one extra). Each updated `/workspace/mitosis-pending.json` to the latest. No `mitosis-pending.json` was ever cleared, no mitosis was ever cut over, no `vessel-architecture-pattern-scan.ts` content changed in any vessel.

Direct invocation of `vessel_mitosis_evaluate` against the freshly-staged `mitosis-2026-06-04T10-50-40-689Z`:

```json
{
  "verdict": "INSUFFICIENT_DATA",
  "reason": "need ≥1 traces per version (base=0, mitosis=0)",
  "cited": null
}
```

Even with `mitosis_root` supplied, static-eval refused — the staged tree contains only `src/resolvers/<one-file>.ts`, no `package.json`. The resolver's static-eval gate requires either a complete tree or `static_check_base_root` + `staged_files` to overlay. The mitosis-tick template (`repos/development-vessel/src/seed/mitosis-tick.ts:138-152`) passes **neither** `mitosis_root` **nor** the overlay parameters to evaluate. Verdict is structurally pinned to INSUFFICIENT_DATA for every substrate-staged mitosis until those wirings are added.

**Verdict-flip watch: NO.** The substrate accumulates more pending mitoses on each cycle of goal[23], but each one is also INSUFFICIENT_DATA-locked. Boredom rotation contains no goal that exercises a vessel against the new mitosis version_id — the apply-proposal-as-patch resolver only writes the target file into a staging directory; no systemd unit is created, no traces tagged `metadata.version_id: mitosis-…` are ever emitted. Sampled traces during the window had `metadata: undefined`; no `version_id` field exists on any trace.

## 4. Concept-db growth analysis

By source-type at T+0 vs T+END (n=42, identical):

| source_type | n |
|---|---|
| architectural_pattern_principle | 9 |
| extracted | 2 |
| impulse_activity_pattern | 9 |
| memo | 6 |
| vessel_construction_pattern | 16 |

- New concepts: **0**
- `times_succeeded` increments: **0** (ts_sum 6 → 6, 6 concepts had ts>0 throughout)
- `times_failed` increments: **0** (tf_sum 1 → 1)
- `times_loaded` increments: **+204** (311 → 515) — all from search-side reads (boredom dispatches that call `concept-db/concepts/search` during template selection)

Goal[16] concept-usage-backfill fired at cycle 160. Despite its declared purpose (POST `conceptUsageRecorded` for both-sided relevance), no ts/tf increment landed. The 3-task chain (concept_select_for_prompt → json_path_extract → concept_usage_record) executed but the writeback either silently no-op'd or wrote to a stale endpoint — no journal-side error, no counter delta.

No executed `gap-closing:auto-*` template emits `concept_write` or `concept_link` as an output shape. The ribosome-style "successful trace → concept" wiring is **not active**. Concept-db is, in the substrate's words, "a read-only memory store that gets searched": rich for prompt-grounding, inert as a growing learning surface.

## 5. The selection signal

Concretely, `selectGoalForLoadConditioned` inputs:

1. `roundRobinIdx` — persisted at `/tmp/boredom-goal-index`, increments by 1 each tick (mod 24).
2. `loadBefore.load_anomaly[_severe]` — cost-tier budget; observed normal throughout, so all 24 goals were eligible.
3. `signature` (`compute_state_signature` from dev-vessel) — varies almost every tick.
4. Posterior cell `(signature, goal_idx) → (α, β, samples)` mined from last-24h traces filtered by `state_signature:<hash>` tag — observed: every cell empty except the rare repeat-signature case.

The substrate IS state-conditioned in the schema and in the logging. It is NOT state-conditioned in **effect**, because the signature space is too fine-grained for posterior accumulation at current throughput (12 ticks/h). Until either (a) the signature hash coarsens (binned bucket rather than full hash), or (b) prior is mixed in across signatures, the system runs as load-gated round-robin with thompson-sampled dispatcher choice.

## 6. Verdict on "can we see the substrate improving itself?"

**Partial — observably moving, structurally stalled.**

Observably moving: 5 new gap-closing-auto templates authored, 18 new scenarios bridged, 3 new mitosis dirs staged, 11 new proposal reports written. The author→stage chain runs end-to-end and produces artifacts on every cycle.

Structurally stalled: 0 cutovers, 0 verdicts above INSUFFICIENT_DATA, 0 new concepts, 0 ts/tf increments, 0 changes to live vessel source. The substrate is rapidly accumulating *unconsumed work* (mitosis dirs that won't evaluate, gap-closing templates that don't execute against new versions, concept-usage-backfill ticks that don't write back). The author and stage actuators run; the evaluate and integrate actuators do not.

## 7. Smallest remaining operator-bootstraps (priority order)

1. **Make staged mitoses evaluable.** Either (a) wire `mitosis-tick` template to pass `mitosis_root` + `static_check_base_root` + `staged_files` to `vessel_mitosis_evaluate` (3 small JSON edits to `seed/mitosis-tick.ts`), or (b) make `apply-proposal-as-patch` copy the full vessel tree (not just the target file) so static-eval works without the overlay path. (a) is cheaper and uses existing overlay support. Without this, every staged mitosis is permanently INSUFFICIENT_DATA and the cutover gate is effectively dead.
2. **Wire concept-db writeback on successful auto-* executions.** Add a lifecycle observer that emits `concept_usage_record` when a `gap-closing:auto-*` template completes successfully (and `concept_create` when a novel pattern is extracted from a trace). Without this, concept-db's ts/tf stays at 6/1 forever while activity multiplies around it.
3. **Coarsen the state-signature hash so posteriors can accumulate.** Either bucket the hash (top 8 bits) or add a stable-component option to `compute_state_signature`. Until then, `selectGoalForLoadConditioned` is decorative — observable in logs, never load-bearing on the choice.
4. **Drafter-side: emit `required_code_modifications.full_patched_source` so apply-proposal can stage full vessel trees** rather than the partial src tree it produces today. Closes the evaluate-readiness gap if (1a) isn't taken.

Backlog drain rate: ~1 mitosis staged per 25-min sub-cycle, ~3 new gap-closing-auto templates per hour, 0 successful evaluations per hour. The actuator-side drain rate against the staged backlog is **zero**.

---

## Citations

- Boredom selection: `repos/boredom-vessel/src/index.ts:822-864` (selectGoalForLoadConditioned), `:1072-1114` (selectDispatcher)
- Mitosis-tick template: `repos/development-vessel/src/seed/mitosis-tick.ts:45-176`
- Evaluate resolver static path: `repos/development-vessel/src/resolvers/vessel-mitosis-evaluate.ts:260-310`
- Apply-proposal-as-patch staging: `repos/development-vessel/src/resolvers/apply-proposal-as-patch.ts:1-25`
- Cycles observed: journal `boredom-vessel.service` 08:54 → 10:54 UTC, cycles 144 → 167
- Direct evaluate probe: `POST /v2/impulses/resolve {vessel_mitosis_evaluate, mitosis-2026-06-04T10-50-40-689Z}` → INSUFFICIENT_DATA at 10:54:52Z
