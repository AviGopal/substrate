## Why

The substrate has reached a stable partial-lift state at HEAD `9b7d145a`: deterministic templates fire autonomously (goal[0,1,3,4] complete reliably), state-signature conditioning is operational, mitosis primitives work on non-trivial vessels, GitHub is being updated (32+ commits/12h), concept-db has the relevance writeback resolver. But the substrate cannot autonomously close the loop on its own next iteration because:

1. **Detection layer is BEHAVIOR-aware, not ARCHITECTURE-aware.** The substrate's existing detectors (composition_coverage_report, authoring_chain_health_report, code_needs_report, phantom_trace_scan, service_oom_cascade_scan, …) catch implementation FAILURES — OOM cascades, preflight rejections, chain truncations. They do not catch architectural ANTI-PATTERNS — responsibility-misallocation, single-points-of-failure, cost-output mismatch, catalogue-bloat. The substrate cannot self-prescribe the architectural changes the operator articulates because it cannot SEE the patterns those changes address.

2. **Authoring path runs through goal-host, whose dispatch-setup leak costs ~2 GB per dispatch.** Every multi-task LLM chain (scaffold-mitosis-track, enact-orthogonal-decisions, draft-gap-closing-activity) routes through this leak. The substrate cannot author the deep fix for goal-host's dispatch-setup because the fix-authoring path is the leak. Circular.

3. **One LLM-capable dispatcher** = single point of failure for autonomous self-modification. With only goal-host as the LLM-capable path, any goal-host bug blocks the substrate from fixing it.

4. **State-signature conditioning is partial.** State-signature tags land on traces (Gap #1 closed earlier this session), `selectGoalForLoadConditioned` queries posteriors (Gap #2 closed), but the SUBSTRATE's CHOICES of which dispatcher, which detector to run, which template hot-set to maintain, are not yet conditioned on the signature.

This change sets pre-lift conditions: a known, observable, four-horizon detection/decision/enactment loop, conditioned on state-signature, with sufficient operator-bootstrap fixes to break the goal-host circular dependency.

## What Changes

This change introduces:

### A. Four-horizon detection coverage

For each horizon, the substrate gains an autonomous detector that consults architectural principles (queried from concept-db) and emits substrateGap impulses for violations:

| Horizon | Detector | Output |
|---|---|---|
| **Vessel** | `vessel_responsibility_audit` | flags vessels doing responsibilities that belong to other vessels per foundation-doc |
| **Vessel-architecture** | `vessel_architecture_pattern_scan` | flags SPOFs, cost-output mismatches, catalogue-bloat, single-dispatcher patterns |
| **Activity** | `activity_lifecycle_audit` (extends template_invocation_history_report) | flags activities that should be promoted/demoted/unloaded based on usage + signature affinity |
| **Resolver** | `resolver_distribution_audit` | flags responsibility-imbalance across vessels' advertised shapes |

All four are immunity-pattern compliant (single resolver, no LLM, no iteration over pool). They emit substrateGap impulses tagged by horizon for downstream consumption.

### B. Architectural-principles-as-concepts foundation

The foundation document and architectural memos are ingested into concept-db as concepts with `source_type=architectural_pattern_principle`. The four horizon-detectors above query these concepts to derive their check predicates. Future architectural insights extend the substrate's detection coverage by adding concepts, not by writing new resolvers.

### C. Operator-bootstrap fixes for goal-host's circular dependency

Three small surgical fixes that the substrate cannot author from inside its own dispatch loop:

1. **Direct-fix goal-host dispatch-setup** (lazy state-signature compute + cached discovery shape registry + bounded ProxyImpulseBus snapshot + conditional fetch-probe + skip activity_recommend pre-check when targetTemplateId is explicit). ~150 LOC.
2. **Ship light-dispatch-vessel** — stateless oneshot orchestrator (~250 LOC). Architecturally different (no per-dispatch state-capture), not a clone.
3. **Add capability-based dispatcher routing** to boredom-vessel — selectDispatcher(goal, signature, capability_hints) with exploration bonus and trace metadata for `dispatcher_used`. ~80 LOC.

After A+B+C land, the substrate can author its own subsequent fixes through either dispatcher.

### D. State-signature-conditioned choices throughout

Every substrate decision becomes state-signature-conditioned, not just goal selection:
- Which detector to run next (boredom rotation already; extend to detector cadence)
- Which dispatcher to use (Item C wires this)
- Which activities to keep in hot-set (Section A activity-lifecycle-audit drives this)
- Which concepts to cite in prompts (concept_select_for_prompt already does this)
- Which mitosis verdicts to act on (vessel_mitosis_evaluate gains memory-axis + state-signature segmentation)

### E. Selection-as-activity (the bigger refactor, deferred)

The downstream architecture (recommendation/selection as a dispatchable activity, goal-host converging with light-dispatch on the execution path) is articulated in `design.md` but NOT shipped in this change. After A+B+C+D land, the substrate's own architecture-aware detection layer would surface the need for E autonomously; E becomes a substrate-authored mitosis target.

## Success Criteria

Pre-lift conditions for this change to be complete:

1. **Architecture-aware observability live**: all four horizon detectors emit verdicts; foundation-doc concepts are queryable; sample dispatch runs each detector against substrate's own state and produces categorized substrateGap impulses for violations.

2. **goal-host autonomous LLM chains complete**: at least one concept-usage-backfill dispatch (goal[16]) completes end-to-end through goal-host; concept-db's `times_succeeded` count grows beyond the manual backfill baseline (currently 6).

3. **Light-dispatch alternative path proven**: at least one cheap-tier multi-task chain dispatched through light-dispatch-vessel completes successfully; both dispatchers' posteriors begin accumulating; capability-routing chooses correctly per goal.

4. **State-signature conditioning observable in choice logs**: boredom logs show `dispatcher_used` derived from `(signature, goal_idx, capability_hints)` Thompson sampling; detector rotation shows similar conditioning; selection rationale is auditable.

5. **The substrate's own architectural detectors flag operator-articulated insights as substrateGaps**: when given the foundation doc's "Backend = trace store + pattern learner" principle as a concept, the substrate's vessel_responsibility_audit detector emits a substrateGap flagging goal-host's LLM-reuse logic.

## Lift Relationship

This is a **pre-lift bootstrap**. The IAL's terminal lift criterion (operator-recorded hand-over in `validation/state/lift-status.json` after sustained coverage + health) requires the substrate to manage its own development autonomously. This change provides the four-horizon observability + dispatcher redundancy + state-signature-conditioned choice infrastructure that makes autonomous self-management possible.

After this change ships, the substrate can autonomously:
- Detect responsibility-misallocations (Section A)
- Choose dispatcher based on capability + signature (Section C+D)
- Maintain hot-set (Section A's activity-lifecycle-audit)
- Author its OWN deeper refactors (selection-as-activity, etc.) through working LLM-capable paths (both dispatchers)

This change does NOT itself constitute lift. It removes the circular blockers that prevented the substrate from reaching lift autonomously. The lift handover remains an operator action per IAL §27.

## Out of Scope (for this change)

- Selection-as-activity refactor (deferred to substrate-authored work after A+B+C land)
- Goal-host's full refactor to thin state-space manager (substrate-authored next iteration)
- Lifecycle-hook activities for catalogue management (substrate-authored after activity-lifecycle-audit surfaces the need)
- Multi-vessel dispatch redundancy beyond goal-host + light-dispatch (future, if Section E surfaces SPOF concerns at the higher layer)
- Federation primitives (separate spec)
