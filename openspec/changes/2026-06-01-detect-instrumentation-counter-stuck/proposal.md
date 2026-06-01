# detect-instrumentation-counter-stuck (substrate-self-detection family)

## Why

Counter-based observability surfaces alongside log/trace streams are
trusted by operators and Thompson selectors to summarize what the
underlying streams contain. When the two diverge — counter says zero,
logs say nonzero — every downstream consumer is silently misled. This
is **phantom-instrumentation**: the inverse of phantom-success-trace.
Phantom-success reports work that isn't real; phantom-instrumentation
reports zero work that IS real. Both are observability lies; both
deserve a detector citizen.

The existing four family members (phantom-success-trace,
precondition-rejection, dispatch-target-drift, OOM-cascade) all catch
**execution-side** anomalies. None catch **measurement-side** ones —
the case where the substrate is doing the right thing but its own
sufficient-statistic surface is stuck. The family needs a
measurement-primitive-self-meta-check citizen (per
`concept_GQOxmoGZ94z5`) before the substrate can claim its
observability surface is trustworthy at S2+.

## Empirical motivation

Concrete trigger observed 2026-06-01 21:17–21:52Z (35-min window):

- Concept-db `/upkeep/status` reported `running: true,
  interval_ms: 300000` with 5 registered upkeep activities
  (split-long-concept, resolve-island,
  adjust-priority-relevance, prune-irrelevant-neighbors,
  decay-stale-relevance).
- **Every activity in `activity_summary[]` showed
  `totalTrials: 0` and `expectedValue: 0.5`** — the Beta(1,1)
  uninformed prior.
- `docker exec substrate-live journalctl -u concept-db.service`
  over the same window showed 8 "Starting upkeep cycle" + 8
  "Selected upkeep activity" entries with real Thompson
  `selection_stats` (per-candidate samples 0.744, 0.608, 0.364,
  …), rotating across all 5 activities.
- The scheduler IS firing, IS doing real Thompson selection,
  IS picking activities. The counter that should reflect those
  trials is stuck at 0. 8 trials in 35 min; reported delta: 0.

Why structurally damaging:

- Concept-db's Thompson loop reads `totalTrials` (the α+β
  sufficient statistic) to compute confidence intervals and
  posterior priors. Stuck at 0 means every activity is
  uniformly uncertain forever; the sampler never converges.
- This is a **Q-table read path failure** — the policy network
  sees a hard-coded uninformed prior regardless of accumulated
  experience.
- All four existing family detectors scope to their own
  execution-side bug class. Measurement-side divergence is
  uncovered surface.

Broader pattern this graduates into the family:

- Per-template Thompson α/β at activity-api stuck at initial
  values despite trace evidence (related to F-V36).
- `substrateGap` emission counts stuck at 0 in dashboard
  surfaces despite detector traces showing emissions.
- Per-resolver latency rollups not advancing despite per-task
  latencies recorded in raw traces.

Each is the same shape: counter-as-summary diverges from
log/trace-as-ground-truth.

## What changes

### 1. New seed template

`repos/development-vessel/src/seed/detect-instrumentation-counter-stuck.ts`:

- Immunity pattern (`inputShapes: []`, `variables: []`, single
  task `scan_and_emit`, deterministic resolver). Mirrors
  `detect-phantom-success-trace.ts:27-63` and
  `detect-service-oom-cascade.ts:35-77`.
- Header cites `concept_9ldsmRgqSTd5`
  (`substrate_self_detection_principle`) and
  `concept_GQOxmoGZ94z5`
  (`detection_primitive_self_meta_check`) — the direct
  constitutional grounding: a counter that purports to measure
  activity is itself a measurement primitive, and when it
  fails to measure, the family surfaces it.
- `outputShapes: ["substrateGap",
  "instrumentationCounterStuckReport"]`.

### 2. New resolver

`repos/development-vessel/src/resolvers/instrumentation-counter-stuck-scan.ts`:

- Input: `{ window_minutes?: number, min_divergence?: number,
  endpoints?: string[], max_emits?: number, dry_run?: boolean }`.
- Defaults: `window_minutes = 30`, `min_divergence = 3`,
  `max_emits = 20`.
- Per configured `(endpoint, counter_path, log_query)` triple:
  read counter via `http_fetch`, read log/trace volume over
  same window, compute
  `divergence = logged_count - reported_counter_delta`. If
  `divergence >= min_divergence`, emit `substrateGap` via
  `substrateGap_write`:
  ```ts
  {
    classification_metadata: {
      gap_class: "instrumentation_counter_stuck",
      endpoint, counter_path, window_start, window_end,
    },
    evidence: {
      logged_count,
      reported_count_start, reported_count_end,
      divergence,
      example_log_entries: string[],
      example_counter_samples: { ts, value }[],
    },
    fix_priors: [concept_GQOxmoGZ94z5],
  }
  ```
- Initial triples:
  - Concept-db `/upkeep/status` →
    `activity_summary[].totalTrials` vs journal "Selected
    upkeep activity" lines. The motivating case.
  - Activity-api template-list →
    per-template `thompson_alpha + thompson_beta` vs
    `activity_execution_traces` rows in window.
  - Discovery-vessel `/registry/stats` → request-count
    surface vs discovery journal "Resolved capability" lines.
- Aggregate `instrumentationCounterStuckReport { window_start,
  window_end, endpoints_checked, divergences_found,
  emits_posted, per_endpoint_summary }`.
- Self-immunity: exclude
  `development-vessel:detect-instrumentation-counter-stuck`
  and `development-vessel:substrate-self-audit-meta` from
  any counter source iterated. Verify the detector's own
  emission count via trace history, not via any counter
  surface (mitigates the meta-recursion risk).

### 3. Three-place rule

Resolver + `discovery.shapes` entry in `src/config.ts` + `case`
in `src/routes/impulses.ts` for both
`instrumentation_counter_stuck_scan` and
`instrumentationCounterStuckReport`.

### 4. Audit-meta integration

Once `2026-05-31-substrate-self-audit-meta` ships,
`self_audit_fan_out` includes this detector in its parallel
dispatch list (Phase C). The detector becomes event-driven;
without that wiring it relies on Thompson rotation, which on a
thin prior is slow.

## Out of scope

- **Fixing each individual broken counter.** Counter repair is
  per-vessel work driven by the gap impulses this detector
  emits, not this proposal.
- **Root-cause inference.** A divergence has many possible
  causes (UPSERT clobbering, write-not-propagating, async
  stale read, missing increment on success path, parallel
  writer overwriting). The detector observes the gap only.
- **Counter-as-source-of-truth migration.** Deriving counters
  lazily from logs/traces instead of maintaining separate
  increment paths is per-vessel architecture, not this
  detector's concern.
- **Time-series storage of divergence trends** beyond the
  per-emit evidence payload. Lives in activity-api's metric
  surface, not this resolver.

## Dependencies

- `http_fetch` — already shipped.
- `substrateGap_write` — already shipped.
- **`vessel_logs_query` resolver — NOT shipped.** In-substrate
  detectors lack `docker exec journalctl` capability. Two
  paths:
  - (a) Ship `vessel_logs_query` as a companion artifact
    proxying journalctl-style queries through each vessel's
    own `/logs?since=…&grep=…` endpoint scoped to its
    systemd unit.
  - (b) Use activity-api's `activity_execution_traces` table
    as a proxy for "log volume" — count rows where
    `executed_at >= window_start` AND
    `activity_template_id IN (…)`. Cheaper, but loses
    coverage on non-trace-emitting code paths (concept-db
    upkeep cycles do not emit a trace row per cycle).
- Phase B selects between (a) and (b). Recommendation: (b) for
  the activity-api triple, (a) for concept-db and
  discovery-vessel triples.

## Risk

- **False positive at low-activity periods.** Both zero ⇒
  divergence zero ⇒ no gap. Real risk is transient stale
  counter reads (one cycle behind). Mitigation:
  `min_divergence` default of 3 exceeds expected per-cycle lag.
- **Meta-recursion: the detector's own counter could itself
  be stuck.** If the detector emits N gaps but its
  `gap_count` surface stuck at 0 reports zero, the next audit
  window flags the gap-emission surface and the substrate
  chases its own tail. Mitigation: explicit self-exclusion
  template-id allowlist; verify own emission count via trace
  history, not counter surface.
- **Log-query cost.** `journalctl` over a 30-min window can
  be slow. Mitigation: cap result size; rate-limit via the
  audit-meta proposal's Phase C window.
- **Endpoint configuration drift.** When concept-db changes
  `/upkeep/status` schema, the resolver reads `undefined`
  and divergence appears artificially large. Mitigation:
  schema-check the counter response before computing
  divergence; emit `instrumentation_schema_drift` (separate
  `gap_class`) if the path is unreadable.

## Companion concepts

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `concept_GQOxmoGZ94z5` —
  `detection_primitive_self_meta_check` (direct grounding: a
  counter-stuck divergence IS a measurement primitive failing
  to measure)
- Immunity-pattern siblings cited in every family-member header

## Related openspecs

- `2026-05-31-substrate-self-audit-meta/` — fans this detector
  out; once both ship, detection is event-driven not
  rotation-stochastic.
- `2026-05-31-detect-resource-budget-violation/` — June cohort
  sibling; both graduate uncovered surfaces (load axis and
  measurement axis) into the family.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase
  E.2 — refusals citing counter-stuck gaps contribute to the
  S3 sustained push-away window per IAL §27.S.6.
- `2026-04-26-security-hardening-findings/` H1 — counterparty
  signatures strengthen the citation chain; until H1 ships,
  divergence evidence is advisory.

## Graph-RL framing

Counter-based observability surfaces are the substrate's
Q-table **read path**. The trial counter is the sufficient
statistic the Thompson posterior reads to compute confidence;
when that read path is broken, the policy sees a stale prior
regardless of experience accumulated through the **write**
path (raw execution + log emission).

The substrate already has detectors on the write side
(phantom-success-trace catches lies-of-commission; OOM-cascade
catches resource-side write failures). The read side has been
uncovered. This proposal adds the first read-side detector
citizen: an observer that watches the gap between
sufficient-statistic-as-stored and experience-as-accumulated.

In Q-learning terms: this detector watches for cases where
`Q(s, a)` as read diverges from `Q(s, a)` as written. When
divergence persists, every downstream policy decision operates
on a stale Q value, and learning stalls. IAL §27.S.5's
self-recovery agenda needs this visibility before the
substrate can claim its learning loop is trustworthy.
