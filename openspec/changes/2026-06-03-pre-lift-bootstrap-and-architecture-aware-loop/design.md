# Design

## The four-horizon detection loop

The substrate's autonomous loop needs to surface gaps at four distinct levels of abstraction. Currently it surfaces only at the lowest (implementation behavior). Each higher horizon requires a detector that consults architectural knowledge stored in concept-db.

```
Horizon                What it observes               Output shape
─────────────────────  ─────────────────────────────  ─────────────────────────
RESOLVER DISTRIBUTION  shape ownership across vessels  resolverDistributionAudit
ACTIVITY               template usage + signature       activityLifecycleAudit
                       affinity                         (extends template_invocation_history_report)
VESSEL                 source-level responsibilities    vesselResponsibilityAudit
                       vs foundation-doc principles
VESSEL-ARCHITECTURE    cross-vessel patterns: SPOFs,    vesselArchitecturePatternScan
                       cost-output mismatches, etc.
```

Each detector follows the same shape:

```typescript
type HorizonDetector<P, R> = {
  // 1. Gather inputs from substrate's existing observability
  inputs: {
    architectural_principles: ConceptSearchResult,   // concept_search_by_source
    vessel_sources: VesselSourceList,                 // fs_read per vessel
    activity_metrics: ActivityMetrics,                // activity-api query
    discovery_shapes: ShapeRegistry,                  // discovery-vessel
    recent_traces: TraceList,                         // activity-api query
  },
  // 2. Apply principle-derived check predicates
  checks: ChecksDerivedFromPrinciples<P>,
  // 3. Emit verdict per horizon
  output: HorizonAuditReport<R>,
  // 4. Side-effect: emit substrateGap per violation
  emits: SubstrateGapImpulse[],
}
```

All four detectors share infrastructure: they all `concept_search_by_source(source_type="architectural_pattern_principle")` to derive their check predicates. Adding a new architectural principle (via `concept_write`) extends ALL FOUR detectors' coverage without writing new resolver code.

This is the meta-pattern: **architecture as queryable data; detection as deterministic code over that data**.

## State-signature-conditioned choices

Currently the state signature conditions ONE thing: goal selection in `selectGoalForLoadConditioned`. This change extends conditioning to multiple substrate decisions:

```
Decision                       Conditioned on                               Source of policy
─────────────────────────────  ───────────────────────────────────────────  ─────────────────
Which goal to dispatch          (signature, goal_idx) Thompson posterior     existing (boredom)
Which dispatcher to use         (signature, goal, capability) posterior      NEW (boredom routing)
Which detector to run next      (signature, detector_idx) rotation policy   NEW (detector cadence)
Which concepts to cite          (signature, query) concept_select scoring   existing (already
                                                                              conditioned via
                                                                              query, extend to
                                                                              signature)
Which mitosis verdicts to act   (signature, verdict, vessel) policy          NEW (mitosis-tick
on                                                                            picks based on
                                                                              signature affinity)
Which activities to hot-load    (signature, activity_idx) recent-success     NEW (activity-
                                                                              lifecycle-audit)
```

The substrate's current state signature already includes load, memory, recent-trace aggregates, catalogue counts, UI presence (loaded_concept_ids). It will be extended (deferred to substrate-authored work) with:
- `dispatcher_health_summary` (recent OOM counts per dispatcher)
- `architectural_violation_pending_count` (open substrateGaps from horizon detectors)
- `hot_set_size` (current goal-host loaded-template count)

These additions let the substrate's choices SHIFT under different conditions: under high-load, prefer light-dispatch; under high-pending-violations, prefer horizon-audit goals; under stable conditions, prefer exploration of new templates.

## Why selection-as-activity is the right downstream architecture

The IAL principle "**Activities Constrain Search**" applies recursively: the substrate's OWN selection of activities is itself an activity, and that activity should be constrained the same way. Currently goal-host does selection inline (LLM-reuse over 200 templates per dispatch). Refactoring selection into a dispatchable `select-activity-for-goal` template would:

1. Make selection logic substrate-improvable via mitosis (substrate can author better selectors as it learns)
2. Allow two-stage selection: deterministic first-pass (FTS + posterior + concept-priors) skips LLM for high-confidence matches
3. Decouple goal-host from activity-api's recommendation logic (foundation-doc alignment)
4. Make goal-host's per-dispatch cost proportional to TASKS executed, not catalogue size

This refactor is deferred to substrate-authored work AFTER this change's bootstrap fixes break the LLM-authoring blockage.

## Why goal-host needs a thin-executor target architecture (and why we don't refactor it now)

The current goal-host does work that activity-api should own:
- Template catalogue search (activity-api has SurrealDB FTS + dense vectors)
- LLM-reuse decision (activity-api has Thompson posteriors)
- State-signature compute (activity-api could cache + invalidate on env events)
- ProxyImpulseBus snapshot (the bus IS the state; no snapshot needed)

The target architecture: goal-host shrinks from 1681 LOC to ~400 LOC, becomes a thin stateless executor + state-space manager. Light-dispatch-vessel converges with it on the execution path; they differ only in state-space services.

We don't ship this refactor in this change because (a) it's larger than operator-bootstrap should be, (b) after this change's detectors land, the substrate would surface the need autonomously, (c) substrate-authored refactor through working dispatchers proves the autonomous loop more robustly than operator-pre-emption.

## Why we need BOTH operator-bootstrap A (goal-host patch) AND C (light-dispatch)

A alone is insufficient: even with the dispatch-setup leak fixed, goal-host remains a single point of failure for autonomous self-modification. If a future bug emerges in goal-host, the substrate has no alternative path to author the fix.

C alone is insufficient: light-dispatch can only execute template-explicit, deterministic-resolver-chain dispatches. It cannot do LLM-reuse over open-ended goals. Some substrate goals legitimately need goal-host's full machinery.

A+C together: goal-host's known leak is patched (band-aid for current state); light-dispatch provides an architecturally-different backup path; both stay exercised via capability-routing; the substrate has a robust two-dispatcher topology from which it can autonomously author its own deeper refactors.

## Bootstrap budget

The operator-bootstrap fixes total ~480 LOC across goal-host (150), light-dispatch (250), boredom-vessel (80). Plus the four horizon detectors at ~200 LOC each (800 LOC total, immunity-pattern compliant, no LLM). Plus the foundation-doc-as-concepts ingestion (zero LOC — uses existing ingest-doc-as-concepts template).

Total operator-bootstrap surface: ~1280 LOC. Compare to "do nothing": substrate remains gridlocked on multi-task autonomous chains, manual operator surgery needed for every architectural fix.

## Risks

1. **Architecture-detectors over-flag**: too many substrateGap impulses overwhelm the gap-drain pipeline. Mitigation: each detector has a `priority_score` field and a per-cycle emission cap (5 gaps max per detector run).
2. **Light-dispatch concurrency limits**: many simultaneous oneshot invocations could exhaust systemd resources. Mitigation: cap in-flight count to 3-5 per second; queue overflow returns 503.
3. **Capability-routing learns wrong policy**: if early Thompson samples bias incorrectly, the substrate could route all traffic through one path. Mitigation: explicit 10-15% exploration bonus + cross-validation comparison probes (every M dispatches, fire SAME goal through both, log comparison).
4. **Substrate detects too many "violations" of architectural principles**: most existing vessels don't perfectly match foundation-doc principles (which is fine — they evolved organically). Mitigation: principle concepts include a `severity` field; only `severity >= "structural"` violations emit substrateGap; lower severities log only.

## Open questions (resolved during implementation)

1. **Which existing detectors should be classified as horizon-aware vs. behavior-aware?** Initial classification per appendix in tasks.md, refined as detectors run.
2. **How does state-signature get extended with new fields**? Currently `compute_state_signature` accepts `loaded_concept_ids` optionally; same pattern for `dispatcher_health_summary` etc. The signature hash absorbs them.
3. **What's the cross-validation cadence?** Every 50 dispatches initially; tune based on observed variance.
4. **Should horizon detectors run on boredom cadence or on every trace?** Boredom (5-min cadence) is sufficient for architectural drift; per-trace would create noise. Trace-level signals already exist for behavior failures.

## Forward path: autonomy after this change

After A+B+C+D land, the substrate can:
1. Detect responsibility-misallocations across its own source (Section A)
2. Choose dispatcher based on capability + signature (Section C+D)
3. Author its own deeper refactors through either dispatcher (working LLM path)
4. Self-prescribe selection-as-activity refactor (Section E) when audit detectors surface the need
5. Self-prescribe goal-host thin-executor refactor when cost-output detector flags the imbalance

Lift then becomes achievable through the substrate's own loop, not through continued operator intervention. The operator's role narrows to adversarial-tester + anchor-maintainer per IAL §27.S.
