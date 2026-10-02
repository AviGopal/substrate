# Stage 3 — Empirical observation of detection→dispatch chain

Date: 2026-06-03 (substrate clock 2026-06-04T00:55Z onward)
Substrate: `substrate-live` (single-container, 21h uptime)
Spec: `openspec/changes/2026-06-03-pre-lift-bootstrap-and-architecture-aware-loop/`

This pass observes — without modifying vessel source — what fires, what
gaps, and what the substrate would need to author next.

---

## 1. Detector firing matrix

All four horizon-detector templates are seeded in activity-api and
dispatchable via light-dispatch directly. None timed out, none
crashed; all four returned a structured report.

| Detector template | Light-dispatch | Goal-host | Direct (impulses/resolve) | Substrate-gaps emitted |
|---|---|---|---|---|
| `vessel-responsibility-audit-tick` | exec_72f97253-785 PASS | not exercised this pass | tested directly | **0** (gapped on principle data) |
| `vessel-architecture-pattern-scan-tick` | exec_2d0a14fe-4d9 PASS | not exercised | tested directly | **3** (single_dispatcher / catalogue_bloat / cost_output_mismatch) |
| `activity-lifecycle-audit-tick` | exec_051f21b1-3bc PASS | not exercised | tested directly | **0** (descriptive — recommendation-only resolver, not violation-emitter) |
| `resolver-distribution-audit-tick` | exec_e81b7b43-d8c PASS | not exercised | tested directly | **1** (shape_orphan: 4/4 advertised shapes never invoked) |

Cumulative dispatch path: all four ran through `POST http://127.0.0.1:8280/dispatch` with HTTP 200 + JSON `status: "success"`. ≥2 detectors emitting ≥1 gap each: **PASS** (2 out of 4 do — pattern-scan + distribution).

## 2. Substrate gaps emitted — sample bodies

### From `vesselArchitecturePatternScan`
- **single_dispatcher** (severity:high) — `dispatcher "unknown" handled 487/500 (97.4%) recent dispatches — single LLM-dispatcher SPOF for autonomous self-modification.` Distribution: `unknown:487`, `light-dispatch:13`. Cited principle: `single_llm_dispatcher_is_spof_for_autonomous_self_modification`. `emit_status:200`, `emitted:true`.
- **catalogue_bloat** (severity:medium) — `discovery advertises 4 shapes but only 0 appeared in recent 500 traces (0.0%).` Cited: `per_dispatch_full_state_capture_is_o_n_memory`.
- **cost_output_mismatch** (severity:high) — `277 recent failed traces burned ≥5s with task_count<=1.` Sample durations 8.8s – 21s. Cited: same.

### From `resolverDistributionAudit`
- **shape_orphan** — `4/4 advertised shapes never invoked in recent 500 traces` (orphans: `vesselCapability, vesselEndpoint, vesselHealth, vesselRegistry` — discovery-vessel's own shapes).

### From `vesselResponsibilityAudit`
- Zero violations: `vessels_scanned: 20, principles_fetched_total: 0, principles_consulted: 0`. The detector ran cleanly but had **no architectural principles to violate against**. Same for the audit-of-the-audit run with `vessel_name: "light-dispatch-vessel"` (`vessels_scanned: 1, violations: 0`).

## 3. Routing distribution (boredom cycles 33-36)

| Cycle | goalIdx | Signature prefix | Dispatcher | Reason | Outcome |
|---|---|---|---|---|---|
| 33 | 1 (substrate-health-tick) | `52e50cd2` | light-dispatch | thompson_sample | success (exec_16145ef2-706, 21s) |
| 34 | 2 (close-health-gap) | `18e6d6b4` | goal-host | capability_filter | TIMEOUT (5 min, "dispatcher unreachable") |
| 35 | 3 (probe-reachable-unlearned) | `f389935e` | goal-host | capability_filter | TIMEOUT (5 min) |
| 36 | 4 (harness-check-scenario) | `ec3802f4` | goal-host | capability_filter | (in-flight at observation end) |

Distribution: 1 light-dispatch / 3 goal-host. All four signatures distinct. `selectDispatcher` is firing correctly — the capability_filter path forces goal-host for templates flagged LLM-eligible (the boredom-side capability_hints derive from template metadata). Thompson_sample path is exercised once (cycle 33) — confirms it works when both dispatchers are eligible.

**Observation**: 3/4 cycles routed to goal-host all timed out. Stage 2.A (goal-host VmRSS leak patch) is the cause; Stage 3.6 will not pass until 2.A is verified. Sufficient evidence for **Stage 3.5 PASS** (dispatcher_used derived from selection logic, observable across multiple cycles, not always the same dispatcher).

## 4. State-signature observability

| Criterion (design.md) | Status | Evidence |
|---|---|---|
| Goal selection conditioned on (signature, goal_idx) | YES | `state-conditioned selection: signature=52e50cd2 mode=round_robin (insufficient posterior samples)` in cycle 33 log |
| Dispatcher conditioned on (signature, goal, capability) | YES | `dispatcher selected: ... signature=52e50cd2, goalIdx=1, cycle=33` |
| Signature persisted to trace metadata for retroactive analysis | **NO — Finding 3.3a** | trace metadata contains `dispatcher_used`, `dispatch_id`, `task_count`, `success_count`, `failure_count` — but NO `state_signature_hash`. activity-lifecycle-audit's `signature_affinity` field is 0 for every template precisely because the trace store has no signature column to aggregate on. |
| Activity hot/cold conditioned on signature | NO | `activity-lifecycle-audit` computes `signature_affinity: 0, distinct_signatures: 0` for all 37 templates with traces. |
| Concept-selection conditioned on signature | not measured this pass | — |

**Finding 3.3a (recorded)**: substrate cannot retroactively condition decisions on state-signature without persisting the signature into trace metadata. Without it, `activity-lifecycle-audit`'s affinity scoring degenerates to recency × success only. Tiny patch: both dispatchers should compute and store `state_signature_hash` on the trace document.

## 5. Audit-of-the-audit results

Dispatched `vessel_responsibility_audit` against `light-dispatch-vessel` itself. Same gap as section 2: `principles_fetched_total: 0, violations: 0`. The substrate cannot judge its own bootstrap work because the principle corpus is empty.

**Recursive consequence**: the operator's 596-LOC light-dispatch-vessel commit goes unchecked by the substrate's responsibility-audit, even though that's exactly the case Stage 1.A was designed for. The detector is present and dispatchable, but its check-data is absent. Stage 0 ingestion is the blocking dependency, NOT Stage 1.

## 6. concept-db `times_succeeded` non-increment — diagnosis

**Root cause**: `concept-usage-backfill` chain task 0 (`concept_select_for_prompt`) filters on `prior_source_types: ["constitutional_principle","observed_pattern","policy","anti_pattern"]`. No concepts of those source types exist in concept-db. Direct reproduction:

```
POST /v2/impulses/resolve { type: concept_select_for_prompt, prior_source_types: [...], query: "backfill" }
→ { selected_count: 0, candidates_considered: ?, selected: [] }
```

Task 1 (`json_path_extract` on `selected.0.id`) returns empty string. Task 2 (`concept_usage_record { concept_id: "" }`) POSTs to `http://127.0.0.1:8260/concepts//usage` → **404 Not Found, path: /concepts//usage**. Resolver returns `structuredError` shape, NOT `conceptUsageRecorded`.

Independently verified concept-db writeback IS functional when called directly with a valid id:
```
POST /concepts/concept_zmxHEoM6IpqD/usage { trace_id, outcome: success }
→ 201 created, then GET /concepts/concept_zmxHEoM6IpqD
→ times_succeeded:1, times_loaded:1, relevance:0.667
```

**Two-line resolution options**:
1. **Substrate-self-fix**: variant of `concept-usage-backfill` that broadens the source-type filter or omits it. Substrate-author-eligible once Stage 0 is done (then real principles exist and original filter works).
2. **Data fix**: complete Stage 0 ingestion (canonical fix; aligns substrate corpus with detector check predicates).
3. **Defensive resolver patch (≤5 LOC)**: `concept_usage_record` short-circuits with `success: true, shape: conceptUsageRecorded, body: { skipped: true, reason: "empty concept_id" }` when `concept_id === ""`. Prevents misleading `conceptUsageRecorded` shape in chains where the upstream extraction empty-failed. NOT applied this pass (out-of-spirit for observation iteration).

Recommend: option 2 (Stage 0 completion) — it unblocks both this gap AND the responsibility-audit data gap (§5).

## 7. Stage 3 verification status

| Criterion (tasks.md §Stage 3) | Status | Reason |
|---|---|---|
| **3.1** All four detectors emit ≥1 substrateGap | **PARTIAL** | 2 of 4 emit (pattern-scan: 3, distribution: 1). Other 2 are data-gapped (responsibility) or descriptive-only (lifecycle). |
| **3.2** vessel-responsibility-audit flags goal-host LLM-reuse misallocation | **GAP** | Detector ran on 20 vessels but principles_fetched=0; the check predicate has no data. Blocked by Stage 0. |
| **3.3** concept-db `times_succeeded` count grows beyond 6 baseline | **GAP** | Backfill chain emits success-shape but writeback never reaches concept-db with a valid id (root cause §6). |
| **3.4** ≥1 cheap-tier multi-task chain completes via light-dispatch | **PASS** | concept-usage-backfill 3/3 tasks success via light-dispatch (exec_39a7c719-b5b, 702ms). Also all four detectors are themselves 1-task light-dispatch chains. |
| **3.5** dispatcher_used derived from Thompson sampling, observable ≥10 cycles | **PARTIAL** | Observed 4 cycles (cumulative cycle counter is at 36; 33+ since Stage 2.C committed). Mix of light-dispatch (thompson_sample) + goal-host (capability_filter). Path is exercised but goal-host hangs after dispatch prevent achieving 10 cycles in a tight loop. |
| **3.6** goal-host per-dispatch VmRSS ≤100 MB after Stage 2.A | **GAP** | Stage 2.A not applied. 3 of 4 boredom cycles timed out on goal-host this pass — symptom consistent with the unfixed leak. |

## 8. Stage 4 readiness verdict

The substrate's detection→dispatch chain is **partially functional**:

- Light-dispatch is reliable (success on every direct + boredom-driven dispatch, low memory, sub-2-second turnaround).
- Goal-host is still gridlocked (Stage 2.A pending) — the LLM-reuse capability path remains uncertain under load.
- Detectors run, but two of four (responsibility, lifecycle) have no signal-bearing data yet (Stage 0 ingestion, signature persistence).
- Substrate-gaps from pattern-scan + distribution ARE landing in the `substrateGap_write` channel (emit_status:200), so the gap-drain pipeline can consume them.

**Smallest remaining operator-bootstrap to unblock Stage 4**: in order of leverage,

1. **Stage 0 ingestion** (~zero LOC; runs `ingest-doc-as-concepts` template against `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`). Unblocks 3.1, 3.2, §5 audit-of-the-audit, and concept-usage-backfill's silent-empty-selection failure mode.
2. **State-signature persistence into trace metadata** (~5–10 LOC in both dispatchers + activity-api trace model). Unblocks 3.3a; activity-lifecycle-audit's affinity scoring becomes meaningful.
3. **Stage 2.A goal-host VmRSS patch** (already specced; ~150 LOC). Unblocks 3.6, gets goal-host out of timeout-loop, lets boredom rotate through all 21 goals instead of dying on goals 2-4.

After (1)+(2), the substrate would have data-bearing detectors AND retroactive signature-conditioned analysis. With (3), goal-host can again author next-iteration fixes via LLM-reuse. The substrate is then in a position to autonomously author Stage 4.1–4.4 refactors. Without (1) the responsibility-audit silently no-ops; without (2) lifecycle-audit cannot meaningfully rank; without (3) only light-dispatchable (template-explicit) substrate work proceeds.

## 9. Dispatch execution_ids (reference)

| Detector | execution_id | dispatch_id |
|---|---|---|
| vessel-responsibility-audit-tick | exec_72f97253-785 | 72f97253-785e-485d-88b5-1c135dcd7fc2 |
| vessel-architecture-pattern-scan-tick | exec_2d0a14fe-4d9 | 2d0a14fe-4d91-4c01-a9bd-ac23077f6312 |
| activity-lifecycle-audit-tick | exec_051f21b1-3bc | 051f21b1-3bc3-4327-8972-1fd4b6f62d2e |
| resolver-distribution-audit-tick | exec_e81b7b43-d8c | e81b7b43-d8c8-451e-8b01-34ce4ab2e3ea |
| concept-usage-backfill (chain) | exec_39a7c719-b5b | 39a7c719-b5be-4974-921a-9f81cec3f257 |
| boredom cycle 33 (substrate-health-tick) | exec_16145ef2-706 | (boredom-vessel) |

## 10. Side-finding: light-dispatch maps overall_success → status:"failed"

Every trace POSTed by light-dispatch lands in activity-api with `status:"failure", success:false` despite light-dispatch's own JSON response reporting `status:"success"` and `failure_count:0`. The trace metadata's `success_count`/`failure_count` are correct. Source: `repos/light-dispatch-vessel/src/index.ts:413` writes `status: "success"` to the trace body when `overallStatus==="success"`, yet activity-api downgrades to `failure`. Either (a) activity-api requires a different success token (e.g. `"completed"`) or (b) some other field (likely `success: true`) is missing from the POST body. Not blocking Stage 3 progression but worth a one-line trace-shape audit before relying on success/failure counts for Thompson posterior updates.
