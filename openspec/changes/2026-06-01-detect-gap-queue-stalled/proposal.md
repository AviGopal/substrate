# detect-gap-queue-stalled (substrate-self-detection family member)

## Why

`drain-pending-substrate-gaps`
(`repos/development-vessel/src/seed/drain-pending-substrate-gaps.ts`)
is the substrate's gap-consumption resolver — it pulls the oldest
open `substrateGap` impulse and dispatches `draft-gap-closing-activity`
against it. It is the only path that converts detector emissions into
actual fix-drafting work; without it, every `substrateGap` accumulates
as inert evidence.

Throughout the 2026-06-01 session it has F25-pre-flight-rejected
consistently — sub-second failed traces (5–20 ms) carrying the
precondition-rejection signature
(`concept_qcctOLBT5-CL`). Empirical evidence from this session:

- F25 drain failures: `exec_yy8bb0e5` (7 ms), `exec_ayutk3l8` (11 ms),
  `exec_u1xpiwqn` (12 ms), `exec_1xvspi3a` (6 ms), `exec_ubq83n5f`
  (8 ms), `exec_trv11e3f` (8 ms), `exec_bgkl7gph` (10 ms), repeating.
- Concurrent successful detector emissions:
  `exec_zy2mj19v` (`detect-precondition-rejection`, 907 ms ok),
  `exec_o2q5g2q8` (1130 ms ok), `exec_yire9tgz` (1262 ms ok),
  `exec_vz1wsp8i` (1456 ms ok).

The pattern is asymmetric: **detectors emit gaps; the drain rejects.
The queue depth climbs monotonically.** This is exactly the bug class
the substrate-side memory `feedback_substrate_gap_consumer_unwired.md`
(2026-05-28) named: "substrateGap_write stores but doesn't trigger;
autonomous palette excludes concept_create_write".

The existing family — `detect-phantom-success-trace`,
`detect-precondition-rejection`, `audit-dispatch-target-drift`,
`detect-service-oom-cascade`, plus the proposed
`detect-resource-budget-violation` — catches per-trace patterns.
None observes the **aggregate queue state**: emission rate vs
drain success rate. `detect-precondition-rejection` flags the
drain's individual F25 traces, but treats them as a per-template
deficiency, not as a **systemic loop-break** at the consumption
layer. The substrate's autonomous improvement curve flatlines despite
detection succeeding — gaps are observed, never drained — and no
family member names that condition.

This proposal adds the missing observer. It operates on aggregated
queue state (emission count, drain success count, queue lag, age
distribution) rather than per-trace patterns. Different observable.

## Empirical motivation

- `repos/development-vessel/src/seed/drain-pending-substrate-gaps.ts:54-67`
  reads the single oldest open `substrateGap` per tick (limit=1).
  When `dispatch_drafter` pre-flight-rejects, the underlying gap
  remains open — no advance, no compensating tick.
- `repos/development-vessel/src/seed/detect-precondition-rejection.ts:36-77`
  catches the trace-shape of pre-flight rejections at per-template
  granularity. It would flag drain failures as a deficiency of
  `drain-pending-substrate-gaps`, but the deficiency it names is
  the drain template's pre-flight problem, **not** the queue-stall
  consequence (gaps accumulating with zero drain progress).
- `feedback_substrate_gap_consumer_unwired.md` (2026-05-28) is the
  long-standing memory of this class. The substrate's recorded
  understanding includes "the consumer doesn't drain"; no detector
  encodes that understanding as a structural observation.
- `concept_9ldsmRgqSTd5` (`substrate_self_detection_principle`):
  every bug class observed becomes a detection template, not just a
  patched instance. Queue-stall is the systemic complement to per-
  trace F25 — it belongs in the family.

## What changes

### 1. New seed template

`repos/development-vessel/src/seed/detect-gap-queue-stalled.ts`:

- Immunity pattern verbatim (`inputShapes: []`, `variables: []`,
  single deterministic task). Mirrors
  `detect-precondition-rejection.ts:36-77` structurally.
- Header comment cites `concept_9ldsmRgqSTd5` and the immunity
  siblings the existing four detectors cite.
- `outputShapes: ["substrateGap", "gapQueueStalledReport"]`.
- Tags: `["lift.autonomous.loop", "substrate.self.detection",
  "queue.stall.detection"]`.

### 2. New resolver

`repos/development-vessel/src/resolvers/gap-queue-stalled-scan.ts`:

- Input: `{ window_hours?: number,
  min_gap_emission_count?: number, min_queue_lag?: number,
  drain_template_id?: string, dry_run?: boolean }`.
- Defaults: `window_hours = 4`, `min_gap_emission_count = 5`
  (N), `min_queue_lag = 3` (M), `drain_template_id =
  "development-vessel:drain-pending-substrate-gaps"`.
- Reads two streams over the window:
  - `substrateGap` emissions (open + closed) — via the existing
    `substrateGap` resolver path
    (`repos/development-vessel/src/resolvers/substrate-gap.ts` or the
    activity-api gap surface; the drain template already consumes
    this resolver at line 61).
  - `drain-pending-substrate-gaps` execution traces — via
    `executionTraceList` filtered by `activity_template_id`.
- Computes:
  - `gap_emission_count` — substrateGap impulses created in window.
  - `drain_success_count` — drain traces with `status="success"`
    AND non-empty `output_impulse_ids[]` containing a
    `healthGapDispatch` impulse (the drain's terminal output shape;
    see `drain-pending-substrate-gaps.ts:38` `outputShapes`).
  - `drain_failure_count` — drain traces with `status="failure"`
    OR `duration_ms < 500` AND `task_count = 0` (F25 signature).
  - `queue_lag` — count of `substrateGap` impulses with `status =
    "open"` that have no resolution trace referencing their id in
    `composition_chain` or `input_impulse_ids[]`.
  - `oldest_gap_age_min` — minutes since the oldest open gap was
    created.
- Stall predicate:
  `gap_emission_count > min_gap_emission_count
    AND drain_success_count == 0
    AND queue_lag > min_queue_lag`.
- On stall: emit one `substrateGap` (rate-limited; see Risk):
  ```ts
  {
    classification_metadata: {
      gap_class: "gap_queue_stalled",
      drain_template_id,
    },
    evidence: {
      queue_size: queue_lag,
      gap_emission_count,
      drain_failure_count,
      drain_success_count: 0,
      oldest_gap_age_min,
      sample_failures: string[], // up to 10 drain trace_ids
      window_hours,
    },
    fix_priors: [
      "concept_qcctOLBT5-CL", // F25 (precondition-rejection)
      // concept id for substrate_gap_consumer_unwired memory once minted
    ],
    summary: string, // human-readable one-liner
  }
  ```
- Aggregate report shape `gapQueueStalledReport { window_start,
  window_end, gap_emission_count, drain_success_count,
  drain_failure_count, queue_lag, oldest_gap_age_min,
  stall_detected: boolean, sample_failure_trace_ids: string[] }`.
- **Self-exclusion**: the resolver's substrateGap-read step
  filters out `template_id ==
  "development-vessel:detect-gap-queue-stalled"` from the
  `gap_emission_count` tally. The detector must not count its own
  emissions or it amplifies its own signal under stall (recursive
  trap; see Risk).

### 3. Three-place rule registration

Per the development-vessel CLAUDE.md:
- Resolver in `src/resolvers/gap-queue-stalled-scan.ts`.
- Add `gap_queue_stalled_scan` to `discovery.shapes` in
  `src/config.ts`.
- Add the `case` in `src/routes/impulses.ts`.
- Add `gapQueueStalledReport` as its own shape with the same
  two-place wiring.

### 4. Audit-meta integration

Once `2026-05-31-substrate-self-audit-meta` ships, the meta's
`self_audit_fan_out` list includes
`detect-gap-queue-stalled` alongside the other family members.
Event-driven not rotation-stochastic.

### 5. Concept minting on stall

When the detector emits its first stall gap, the post-execution
task path mints a `concept_create_write` describing the stall
pattern (gap-class, drain target, sample failure ids). Future
drain runs and refusal records can cite it as a structural prior.
This closes the citation chain back into concept-db so the
substrate's memory of "the queue stalls under this signature"
becomes addressable evidence, not just a one-shot gap.

## Out of scope

- **Fixing `drain-pending-substrate-gaps` itself.** That is the
  natural follow-up openspec triggered once this detector starts
  emitting. Detection precedes repair.
- **Concept-db's own queue depth.** Covered by upkeep — concept-db
  has a different consumption model (passive observation, not
  active drain) and is not represented by a single drain template.
- **Generalizing to other consumer queues.** The detector is
  parameterized on `drain_template_id` so the same scan can be
  re-instantiated for future drain templates, but only the
  `drain-pending-substrate-gaps` instance is registered by this
  proposal.

## Dependencies

- `executionTraceList` activity-api surface — already consumed by
  the other four detectors.
- `substrateGap` resolver / read surface — already exists; the
  drain template uses it at
  `drain-pending-substrate-gaps.ts:61`. May need a
  `with-status="open"` filter pass-through if not already
  supported.
- `substrateGap_write` impulse path — already shipped.
- `concept_create_write` — already shipped; gated by the
  development-vessel's write scope which is currently sufficient
  for concept-db (not admin).

## Risk

- **Recursive trap (self-amplification).** This detector emits
  `substrateGap` when the queue is stalled. The stalled queue
  doesn't drain that emission either, so on the next tick the
  emission counts toward `gap_emission_count` and re-emits.
  Mitigation: explicit `template_id` exclusion in the
  `gap_emission_count` tally (see §2 self-exclusion), AND a
  per-detector rate-limit (≤1 emission per `window_hours / 2`
  per `drain_template_id`).
- **False positive at substrate cold-start.** Before any
  detector has emitted, `gap_emission_count = 0` and the predicate
  is false — no FP. The first FP risk is when a detector has
  emitted exactly `min_gap_emission_count + 1` gaps over a long
  window with one transient drain failure; mitigation is the
  conjunction with `queue_lag > min_queue_lag` (requires
  unresolved volume, not just emission volume).
- **Window misalignment with drain cadence.** `drain-pending-
  substrate-gaps` runs on boredom rotation; a 4-hour window may
  cover ≥ 50 drain attempts under healthy boredom but only 3-5
  under quiet operation. Mitigation: the `drain_failure_count`
  field carries the absolute count; operators can re-tune
  defaults after a 2-week observation window.
- **Drain template id drift.** If a variant of
  `drain-pending-substrate-gaps` is promoted via Thompson, the
  scan's `drain_template_id` parameter goes stale. Mitigation:
  resolve drain template by canonical id only (variants of
  drain-pending-substrate-gaps are still the same template_id at
  the activity-api `activity_template.id` level; Thompson
  selects variants, not template ids).

## Companion concepts

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
  (constitutional)
- `concept_qcctOLBT5-CL` — F25 (precondition-rejection signature);
  the per-trace bug whose queue-aggregated form this detector
  catches
- The prior `substrate-gap-consumer-unwired` memory note
  (2026-05-28) — the human-language record of this class
- Immunity-pattern siblings cited by the existing four detectors

## Related openspecs

- `2026-05-31-substrate-self-audit-meta/` — once shipped, this
  detector joins the meta's fan-out alongside the other family
  members.
- `2026-05-31-detect-resource-budget-violation/` — companion
  fifth family member graduating the load-attribution stack. This
  proposal adds a sixth observable (queue-depth dynamics) the
  family did not previously model.
- `2026-05-30-trace-to-concept-mining/` — the unknown-discovery
  arm. This detector encodes a **known** systemic deficiency; the
  mining arm finds the unknown ones.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  gaps emitted by this detector are candidate refusal evidence in
  the S3 sustained-push-away window (IAL §27.S.6).

## Graph-RL framing

`drain-pending-substrate-gaps` is the substrate's
**resolution-budget allocator**: it converts open gaps (an
exploration queue of "things to fix") into actual fix-drafting
work. When the queue stalls, the substrate is detecting problems
but spending **zero exploration budget on resolving them**. The
improvement curve flatlines despite the loss-signal channel being
live.

The existing family observes the **decision layer** (was the
right template selected? was the dispatch well-formed?). This
detector observes the **budget-allocation layer** (is the
exploration budget actually being spent?). Different RL
substrate, same family vocabulary. In policy-iteration terms:
detection-family members audit the policy; this detector audits
whether policy-improvement runs at all.

For S3 push-away: a refusal record that cites a
`gap_queue_stalled` substrateGap is the cleanest possible
S3-shaped refusal — the substrate refuses operator interventions
not because of a single bad template, but because the substrate's
own self-repair loop is provably stalled and the operator's
proposed intervention does not address it.
