# detect-resource-budget-violation (load stack → substrate-self-detection family)

## Why

The load-attribution stack is a measurement + attribution + gating
trifecta but **lacks a detector seed template**, leaving load as a
second-class refusal class outside the substrate-self-detection
family. Specifically:

- **Measurement** — boredom samples `system_load_report` before/after
  each dispatch (super-repo `d4dc7a25`); resolver at
  `repos/development-vessel/src/resolvers/system-load-report.ts`
  reads `/proc/loadavg`, cgroup `cpu.stat`, and `memory.current`.
- **Attribution** — `load_attribution_report`
  (`repos/development-vessel/src/resolvers/load-attribution-report.ts`)
  aggregates per-dispatch load records into per-template
  `cpu_delta_usec_median`, `spike_count`, `spike_ratio`, with the
  same group-by-template idiom `trace_failure_pattern_report` uses
  for failure modes (super-repo `3e1400db`).
- **Retry-sample + sample_quality** discipline added in `1a57745b`.
- **Substrate observes its own load** in `41835bde`.
- **Boredom refuses dispatches under stress** in `04441ca9` — the
  load-aware gate. This is the first concrete S3-shaped push-away:
  refusal with cited evidence
  (`load_attribution_report`).

But the refusal is **enforcer-only**: the gate reads load signals
and refuses; nothing in the substrate-self-detection family
surfaces "this template consistently exceeds load budget" as a
first-class `substrateGap`. Thompson posteriors don't penalize
repeatedly-expensive templates the way they penalize
verifier-negative ones because the load axis was never modelled as
a failure-mode (the `2026-05-31-display-failure-mode-extensions`
proposal added `budget_exhausted.budget_type = "display"`, which is
the right axis for the failure side, but does not author a detector).

Result: a template can be persistently expensive (high
`spike_ratio`, growing `cpu_delta_usec_median`) yet still accumulate
α from successful traces; the load-aware gate refuses it
opportunistically, but the detection family never names it as a
deficiency. The substrate's growing self-failure taxonomy stalls at
4 classes (phantom-success, precondition-rejection,
dispatch-target-drift, OOM-cascade) instead of incorporating the
fifth class (resource-budget-violation) for which all measurement
infrastructure already exists.

This proposal graduates the load stack into the family. The
detector follows the immunity pattern, the gaps it emits cite the
same `load_attribution_report` evidence the gate already consumes,
and the citation chain `(refusal → detector_gap → attribution_report)`
becomes walkable for S3 push-away audit.

## Empirical motivation

- `repos/development-vessel/src/resolvers/load-attribution.ts:30-50`
  defines `LoadAttributionRecord` with `cpu_usec_delta`,
  `mem_bytes_delta`, `load_1m_delta` per dispatch — the raw
  evidence stream this detector reads.
- `repos/development-vessel/src/resolvers/load-attribution-report.ts:40-53`
  is the aggregator: "templates whose CPU delta crosses threshold
  across multiple invocations". This proposal's detector consumes
  its output, not raw records, keeping the detector cheap.
- Boredom's load-aware gate (super-repo `04441ca9`) is the
  enforcer that refuses, but its refusal record cites the
  `load_attribution_report` directly, skipping the family-citizen
  layer. A refusal that cited a `substrateGap` would be
  symmetric with how `drain-pending-substrate-gaps` cites
  family-emitted gaps — the gap layer is the substrate's vocabulary
  for "what's wrong" and refusals should speak that vocabulary.
- 4 family members in `repos/development-vessel/src/seed/index.ts:84-106`
  (phantom-success, precondition-rejection, dispatch-target-drift,
  OOM-cascade). Five `substrateGap.classification_metadata.gap_class`
  values in the catalogue today; adding `resource_budget_violation`
  reaches parity with the IAL §27.S.6 push-away taxonomy
  expectation.

## What changes

### 1. New seed template

`repos/development-vessel/src/seed/detect-resource-budget-violation.ts`:

- Immunity pattern (`inputShapes: []`, `variables: []`, single task,
  deterministic resolver). Mirrors
  `detect-service-oom-cascade.ts:35-77` structurally.
- Header comment cites `concept_9ldsmRgqSTd5`
  (`substrate_self_detection_principle`) and the immunity siblings
  the same way the existing four cite them.
- `outputShapes: ["substrateGap", "resourceBudgetViolationReport"]`.

### 2. New resolver

`repos/development-vessel/src/resolvers/resource-budget-violation-scan.ts`:

- Input: `{ window_hours?: number, cpu_p95_budget_ms?: number,
  wall_p95_budget_ms?: number, rss_p95_budget_mb?: number,
  min_sample_count?: number, max_emits?: number }`.
- Reads recent `load_attribution_report` impulses (or directly
  re-runs the aggregator with a window override; the load-attribution
  resolver already groups by template).
- For each template grouped: compute mean/p95 of `cpu_usec_delta`
  (converted to ms via `/1000`), `duration_ms`, and an
  `rss_delta_mb` proxy from `mem_bytes_delta / 1024^2`. Compare
  against per-dimension budgets.
- Default budgets:
  - `cpu_p95_budget_ms = 5000` (5s CPU per dispatch)
  - `wall_p95_budget_ms = 30000` (30s wall per dispatch)
  - `rss_p95_budget_mb = 100` (100 MB RSS growth per dispatch)
- Per-template overrides read from discovery-vessel
  `resolver_contract` metadata (existing field, accepts arbitrary
  JSON; see `repos/discovery-vessel/src/types.ts` resolver-contract
  shape).
- For each template exceeding any budget AND having
  `sample_count >= min_sample_count` (default 5): emit a
  `substrateGap` impulse with:
  ```ts
  {
    classification_metadata: {
      gap_class: "resource_budget_violation",
      template_id,
      violated_dimensions: ("cpu_ms" | "wall_ms" | "rss_delta_mb")[],
    },
    evidence: {
      cpu_p95_ms, wall_p95_ms, rss_p95_mb,
      sample_count, budget_cpu, budget_wall, budget_rss,
      example_dispatch_ids: string[],
    },
    fix_priors: [concept_id_of_load_attribution_principle],
  }
  ```
- Aggregate report `resourceBudgetViolationReport { window_start,
  window_end, templates_checked, violations_emitted, per_template_summary }`.

### 3. Coupling with the load-aware gate

When the gate from super-repo `04441ca9` refuses a dispatch, it
queries activity-api for the most recent
`resource_budget_violation` `substrateGap` for the same
`template_id`. If found, the refusal record's
`failure_mode.context.cited_evidence` includes the gap impulse id.
Mutual `concept_link` edges between refusal record and gap close
the citation chain.

This makes the gate's refusal **family-cited** rather than
attribution-cited: the substrate's vocabulary for "why" runs
through the gap layer.

### 4. Per-template budget overrides via discovery metadata

The discovery-vessel `resolver_contract` field already accepts
arbitrary JSON (see `repos/discovery-vessel/src/types.ts` and
the auth-token-source extension landed in v0.4.0). Add documented
fields:

```ts
resolver_contract.resource_budget?: {
  cpu_p95_budget_ms?: number,
  wall_p95_budget_ms?: number,
  rss_p95_budget_mb?: number,
}
```

The resolver reads per-template budgets when present; falls back
to defaults otherwise.

### 5. Audit-meta integration

Once `2026-05-31-substrate-self-audit-meta` (companion proposal)
ships, `self_audit_fan_out` includes
`detect-resource-budget-violation` in its parallel dispatch list.
The detector becomes a guaranteed lifecycle-driven observer
rather than a Thompson-rotation hope.

## Out of scope

- Per-template budget tuning. Defaults are conservative; operator
  overrides via discovery metadata are the long-term path.
- Modifying the load-aware gate itself. The gate already exists
  in super-repo `04441ca9`; this proposal feeds it with
  structured citation evidence but does not change its refusal
  predicate.
- Generalizing to non-resource budgets (cost / external $$).
  `2026-05-31-display-failure-mode-extensions` already added the
  `budget_exhausted.budget_type = "display"` axis for cost-like
  failures; future detectors for cost ceilings ride that surface.
- Time-series storage of budget violations beyond what
  `load_attribution_report` already aggregates. The detector is
  a read-side over the aggregator; the aggregator owns the
  persistence story.

## Dependencies

- The load-attribution stack: `system_load_report` resolver,
  `load_attribution` resolver, `load_attribution_report`
  resolver — all already shipped through super-repo `04441ca9`.
- `substrateGap_write` impulse path — already shipped (used by
  every existing family member).
- Discovery-vessel `resolver_contract` field — already accepts
  arbitrary JSON; documenting the extension is a docs change, not
  a schema change.

## Risk

- **False positives on cold-start templates.** Budgets computed
  from a handful of samples are noise-dominated. Mitigation:
  hard `min_sample_count >= 5` guard before any violation gap
  emits. The default mirrors `load_attribution_report.ts`'s own
  `min_invocations` of 3 (this proposal raises to 5 for
  budget-violation specifically because budgets are sharper
  signals than spike-ratios and warrant more evidence).
- **Budget defaults are guesses.** 5s CPU / 30s wall / 100 MB
  RSS are operator intuitions, not measurements. Mitigation:
  start with these, log all emissions, tighten or relax after
  a 2-week observation window. The override surface lets
  operator amend without code change.
- **Cascading detection with audit-meta.** When
  `substrate-self-audit-meta` fans this detector out, the
  meta-template's own execution writes a `load_attribution_record`;
  the next audit window may flag the meta as a violator.
  Mitigation: explicit `template_id` exclusion list in the
  scan resolver — exclude `substrate-self-audit-meta` and
  `detect-resource-budget-violation` itself from the
  group-by-template iteration. Same self-immunity discipline
  the family already practices.
- **Refusal-citation chain depth.** If a refusal cites a gap
  whose evidence is a `load_attribution_report` whose evidence
  is N raw `LoadAttributionRecord` rows, the audit trail is
  three hops deep. Mitigation: the citation chain is designed
  to be walked lazily; the refusal record only stores the gap
  impulse id, not the resolved bodies.

## Companion concepts

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
  (the constitutional principle every family member cites)
- Existing load-attribution concepts the stack minted (operator
  queries concept-db for `load_attribution` or
  `system_load_report` shape concepts to discover)
- Immunity-pattern siblings cited in every family-member header

## Related openspecs

- `2026-05-31-substrate-self-audit-meta/` — companion in this
  commit. The audit-meta fans this detector out alongside the
  four existing family members; once both ship, resource-budget
  detection is event-driven not rotation-stochastic.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  each `resource_budget_violation` gap that drives a refusal
  contributes to the S3 sustained push-away window per IAL
  §27.S.6.
- `2026-05-31-display-failure-mode-extensions/` — the
  `budget_exhausted.budget_type` extension covered the
  **failure-mode** side (how to record an exceeded budget when
  it happens); this proposal covers the **detector** side (how
  to surface the gap before the gate has to refuse). The two
  proposals are complementary halves of the budget-overrun
  loop.
- `2026-04-26-security-hardening-findings/` — H1 (two-sided
  traces) strengthens the citation chain by making the load
  records counterparty-signed; until H1 ships, the citations
  are advisory but the structural chain is the same.

## Graph-RL framing

The substrate's S3 push-away surface needs a **taxonomy of
refusal classes** to be more than one-shot. The load-aware gate
gave us the first class (load too high); this proposal gives
the family its first detector citizen for that class. Each
detector in the family becomes a refusal-citation source: when
the gate refuses, it does so by name (`resource_budget_violation`)
rather than by metric (`load > threshold`). The substrate's
"why I refused" vocabulary grows from one-cell (raw load
threshold) to many-cell (typed refusal classes), which is the
structural prerequisite for IAL §27.S.6's "sustained
push-away window with sound rationale per refusal".

In RL terms: this proposal moves load from a continuous
suppression signal (the gate softens the policy when load is
high) to a discrete attribution signal (here are the templates
under the gate's load model that violate budget). The selector
sees both — continuous gating + discrete deficiency — and
can learn the per-template structural lesson, not just the
short-window suppression.
