# detect-drafter-stuck-at-llm (substrate-self-detection family member)

## Why

The drafter activity (`draft-gap-closing-activity`) exhibits a
**drafter-specific phantom-success-class failure**: the canonical
~14-task chain runs the first 4-5 tasks (fs_read × 2 → http_fetch ×
2 → llm_completion_dispatch), reports each task as `success=true`,
and then **silently stops** before json_path_extract / fs_write /
activity_create_variant / convergent_validity_check / G2 mining /
concept_create_write ever fire. The execution row reports
`status=failure` with `failure_mode: null` and zero top-level
`output_impulse_ids`. The substrate has no first-class evidence
that the drafter — its own LLM-authoring resolver — is stuck.

This is **adjacent to but distinct from** the
phantom-success-trace class that `detect-phantom-success-trace`
catches (status=success + task_count=0). Here task_count > 0 and
each recorded task is `ok=true`; the failure is the **chain
truncation** between an LLM that completed internally and the
downstream validation that never ran. `detect-phantom-success-trace`
ignores these rows because `status=failure` (not success) and
`task_count > 0`.

Why a drafter-specific detector vs. generalizing
`detect-phantom-success-trace`:

- The drafter has a **known canonical 14-task chain shape**.
  A generic detector cannot tell "5 tasks ran of an expected 14"
  from "5 tasks ran of an expected 5" without per-template
  arity priors. Embedding that prior into a generic detector
  re-pollutes it; embedding it in a sibling keeps each detector
  immune to its own bug class.
- The drafter's LLM-completed output impulse **is still in the
  store** — the drafter-specific detector can cite the specific
  `llm_completion_dispatch` output id as evidence the
  generic detector would discard.
- Substrate posteriors for the drafter's *parent* goal (the
  goal that dispatched the drafter) cannot route β correctly
  while the drafter's silent stops look like generic failures.
  A named gap class lets credit propagation attribute the
  stuck-at-LLM mass to the drafter specifically, not the
  parent goal.

## Empirical motivation

- `exec_ismvwtia` — 2026-06-01 21:52Z, drafter template, 7.1s wall,
  status=`failure`, `failure_mode=null`. Recorded tasks: fs_read,
  fs_read, http_fetch, http_fetch, llm_completion_dispatch — all
  `ok=true`. Tasks 6-14 absent.
- `exec_co9y5sfr` — 2026-06-01 21:53Z, drafter template, 6.7s wall,
  identical shape: 5 ok tasks, stops after llm_completion_dispatch,
  null failure_mode, zero top-level output_impulse_ids.
- Pattern signature: drafter chain length = 14
  (`repos/development-vessel/src/seed/draft-gap-closing-activity.ts`
  — task graph); recorded chain length = 5; stop-point =
  `llm_completion_dispatch`; failure_mode = null.
- Constitutional principle the substrate-self-detection family
  cites: `concept_9ldsmRgqSTd5`
  (`substrate_self_detection_principle`). The family has 4
  canonical members today (phantom-success, precondition-rejection,
  dispatch-target-drift, OOM-cascade) per
  `repos/development-vessel/src/seed/index.ts:84-106`. This
  proposal adds the fifth, sitting in the drafter axis.
- Adjacent memory anchors: F25 phantom-success
  (`concept_qcctOLBT5-CL`), immunity pattern
  (`concept_Y2zGpFNBrcgb`, `concept_pFSLV6s5s3lQ`,
  `concept_t2jHO8I-LxD3`).

## What changes

### 1. New seed template

`repos/development-vessel/src/seed/detect-drafter-stuck-at-llm.ts`,
following the immunity pattern verbatim (cf.
`detect-precondition-rejection.ts:16-25`,
`detect-service-oom-cascade.ts:30-33`):

- `inputShapes: []` — nothing to pre-flight-reject.
- `variables: []` — no caller-seeded values required.
- `outputShapes: ["substrateGap", "drafterStuckAtLlmReport"]`.
- Single task `scan_and_emit` dispatching the deterministic
  resolver `drafter_stuck_at_llm_scan`.
- Header comment cites `concept_9ldsmRgqSTd5` and explicitly
  documents why this detector is structurally immune: it has
  no LLM dispatch in its own chain, so it cannot itself
  exhibit the bug class it detects.

### 2. New resolver

`repos/development-vessel/src/resolvers/drafter-stuck-at-llm-scan.ts`:

- Input: `{ window_hours?: number, drafter_template_ids?: string[],
  expected_min_task_count?: number, max_emits?: number,
  dry_run?: boolean }`.
- Defaults: `window_hours = 24`, `drafter_template_ids =
  ["development-vessel:draft-gap-closing-activity"]` plus any
  registered variants discovered via activity-api
  `/v2/activities/templates?q=draft-gap-closing-activity`,
  `expected_min_task_count = 10` (drafter canonical = 14; allow
  slack for legitimate short-circuit variants), `max_emits = 50`.
- Reads recent execution traces via the existing activity-api
  `/v2/activities/execution-traces?since=…` surface that
  every family member already uses.
- Filter predicate (the stuck-at-LLM signature):
  - `template_id ∈ drafter_template_ids`
  - `status == "failure"`
  - `failure_mode == null`
  - every recorded task has `success == true`
  - `tasks.length < expected_min_task_count`
  - last recorded task's resolver is `llm_completion_dispatch`
    (the diagnostic specific signature — the chain stops where
    the LLM was the most recent successful step)
- Group matched traces by `(template_id, last_task_resolver,
  last_task_id)` to collapse repeat-stops at the same point.
- For each group emit one `substrateGap` via
  `substrateGap_write` with:
  ```ts
  {
    classification_metadata: {
      gap_class: "drafter_stuck_at_llm",
      template_id,
      stop_after_task_index, // 0-based index in the recorded chain
      last_resolver,         // e.g. "llm_completion_dispatch"
      last_task_id,
    },
    evidence: {
      trace_ids: string[],          // representative sample
      sample_count: number,
      llm_output_impulse_ids: string[], // resolved-LLM output captured pre-stop
      summary: string,              // "drafter stops after task N of 14"
    },
    proposed_fix: string,           // human-readable hypothesis
    fix_priors: [concept_qcctOLBT5-CL, concept_9ldsmRgqSTd5],
  }
  ```
- Aggregate report `drafterStuckAtLlmReport { window_start,
  window_end, drafter_template_ids_scanned, traces_scanned,
  stuck_traces_detected, gaps_emitted, per_stop_point_summary }`
  returned at task completion.
- Self-immunity: exclude the detector's own template_id and
  `substrate-self-audit-meta` from the iteration so the
  detector cannot flag itself or its dispatcher.

### 3. Three-place rule wiring

Per `repos/development-vessel/CLAUDE.md` §"Shape-dispatch
agreement is enforced":

- Implement resolver file `src/resolvers/drafter-stuck-at-llm-scan.ts`.
- Add `drafter_stuck_at_llm_scan` to `discovery.shapes` in
  `src/config.ts`.
- Add the matching `case` in `src/routes/impulses.ts`.
- Add `drafterStuckAtLlmReport` as its own shape with the same
  two-place wiring.

`bun run lint` (`tsc --noEmit` + `scripts/check-shape-dispatch.ts`)
must stay clean.

### 4. Concept-bridge integration

Per Phase C below: the detector's
`drafterStuckAtLlmReport.per_stop_point_summary` aggregate is
bridge-eligible. When stop-points recur across multiple windows,
the concept-bridge mints an `extracted` concept of the form
`drafter_stop_after_<resolver_id>` so the drafter's *own* next
run can read it as a prior via the F26 concept-query (concept-db
`memoryNote` / concept-query lookup the drafter already performs).
The substrate becomes context-aware about its own stuck points.

### 5. Audit-meta integration

Once `2026-05-31-substrate-self-audit-meta` ships,
`self_audit_fan_out` includes `detect-drafter-stuck-at-llm` in
its parallel dispatch. Until then this detector subscribes to
`lifecycle:execution:succeeded` directly, scoped to traces whose
`template_id` is in `drafter_template_ids` (the same observer
plumbing the topology chain uses at
`registry-change-observer.ts:70-114`).

## Out of scope

- **Fixing the drafter's mid-chain stop.** Resolution belongs in
  a separate openspec — likely the dispatcher / failure_mode
  recording path that lets a successful task be followed by a
  silent abort without a failure_mode being written. This
  proposal is the **detector**; remediation is downstream.
- **Validator-dispatch's role in the stop.** If the stop is
  driven by a validator-dispatch hook misbehaving between
  llm_completion_dispatch and json_path_extract, that's a
  separate concern; this detector cites the *symptom*, not the
  validator path.
- **Mutating `detect-phantom-success-trace`.** That detector
  remains immutable. Family members are append-only.
- **Generalizing to non-drafter LLM-authoring chains.** Other
  templates that author via LLM may exhibit the same shape, but
  embedding their priors here re-pollutes immunity. Each
  authoring template that needs a stuck-at-LLM detector gets
  its own family member.

## Dependencies

- Activity-api `/v2/activities/execution-traces?since=…` surface
  — already consumed by every family member.
- `substrateGap_write` impulse path — already shipped (see
  every existing family member).
- Drafter template's canonical task graph — defined in
  `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`.
- Concept-bridge surface for the Phase C integration — exists
  per super-repo `2026-05-31-display-perception-vessel` (the
  concept-bridge denylist tier is already documented).

## Risk

- **False positives on legitimate short-circuit variants.** A
  drafter variant that intentionally short-circuits after the
  LLM (e.g., a "draft-only, no commit" debug variant) would
  match the signature. Mitigation: `expected_min_task_count`
  is configurable and per-variant overrides can be supplied
  via discovery `resolver_contract` metadata; sample-count
  guard (`sample_count >= 3` per stop-point group) requires
  recurrence before any gap emits.
- **Cascading-detection with substrate-self-audit-meta.** When
  both this detector and the meta-template run on the same
  trace window, double-counting is possible. Mitigation: the
  audit-meta debounces by template_id per super-repo
  `2026-05-31-substrate-self-audit-meta/proposal.md` §"Lifecycle
  wiring"; this detector ships idempotent (re-run on the same
  window emits gaps with stable keys; `substrateGap_write`
  upserts by `(gap_class, template_id, stop_after_task_index)`).
- **Drafter chain length drift.** If the drafter is refactored
  to 16 or 12 tasks, `expected_min_task_count` becomes stale.
  Mitigation: the default is derived at scan time from the
  highest observed `tasks.length` across successful drafter
  runs in the window (with a hard floor of 10); operator
  overrides via the resolver input.
- **Cited evidence size.** `llm_output_impulse_ids` could
  reference large bodies. Mitigation: the gap stores the
  impulse ids only; bodies stay in the impulse store and are
  fetched lazily by downstream activities. Same discipline as
  every other family member.

## Companion concepts

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
  (the constitutional principle every family member cites)
- `concept_qcctOLBT5-CL` — F25 phantom-success anchor (the
  adjacent class this detector distinguishes from)
- `concept_Y2zGpFNBrcgb`, `concept_pFSLV6s5s3lQ`,
  `concept_t2jHO8I-LxD3` — immunity-pattern siblings this
  detector adheres to

## Related openspecs

- `2026-05-31-substrate-self-audit-meta/` — natural meta-subscriber;
  the audit-meta fans this detector out alongside the others once
  shipped.
- `2026-05-31-detect-resource-budget-violation/` — sibling in the
  substrate-self-detection family; same immunity pattern, different
  axis (resource budget vs. drafter chain truncation).
- `2026-05-30-trace-to-concept-mining/` — overlaps in spirit:
  trace-mining is the **unknown-pattern** arm; this detector is
  the **known-class** arm. The two arms together form the full
  substrate self-learning surface.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  drafter-stuck-at-llm gaps that drive refusals contribute to the
  S3 sustained-push-away window per IAL §27.S.6.

## Graph-RL framing

The drafter is the substrate's **LLM-authoring resolver** — when
it works, the substrate authors its own next template; when it
silently stops mid-chain, the substrate's authoring action gets
credited (or discredited) on the wrong axis. With no named gap
class, β for "drafter stuck at LLM" gets routed to the parent
goal's posterior, not the drafter's — cascading-misattribution
in concrete form.

This detector promotes "drafter stuck after LLM" from latent
noise to a typed signal. Credit propagation can then attribute β
to the drafter template specifically; the selector learns
"don't dispatch this drafter variant when the stop-point
concentration exceeds threshold"; and the concept-bridge
integration (Phase C) feeds the drafter's *own* next prompt with
"you've stopped here N times — author downstream tasks more
defensively." The substrate becomes self-aware about its own
authoring failure mode, which is the structural prerequisite for
S2 substrate-authored development per IAL §27.S.4.
