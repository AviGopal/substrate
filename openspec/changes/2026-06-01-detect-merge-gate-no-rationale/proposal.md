# detect-merge-gate-no-rationale (substrate-self-detection family)

## Why

The substrate-as-git-author merge surface is gated by
`evaluate-pr-via-internal-idioms`
(`repos/development-vessel/src/seed/evaluate-pr-via-internal-idioms.ts:27-175`):
a seven-task composition (`read_artifact` → `phantom_scan` →
`precondition_scan` → `score_artifact_comprehensibility` →
`synthesize_evidence` → `debug_dump_evidence` → `merge_pr`) whose
verdict is supposed to be auditable from a single trace
(per operator directive 2026-06-01, cited in the seed's own header
at lines 14-17). Throughout 2026-06-01 the gate has exhibited
**rejection without cited rationale** in multiple distinct trace
shapes:

- **Opaque mid-execution failure** — `exec_bdi43hzm` (2.0s) and
  `exec_meur43e0` (2.4s): all three completed tasks report
  `ok=true` at the task level, top-level `status=failure`,
  `failure_mode: null`, top-level `output_impulse_ids: []`. The
  gate refused, but the trace does not say why.
- **F25 sub-second sink** — `exec_hpw8n07m` (5ms) and
  `exec_q4xlw1vd` (5ms): engine pre-flight rejection shape,
  zero tasks recorded, the F25 phantom-success signature
  (`concept_qcctOLBT5-CL`) the substrate has already named —
  except here the *gate itself* is the F25 victim.
- **Variable-length failures** — `exec_imbmjn3f` (7.8s) and
  `exec_u7xeinm9` (6.7s): longer runs, still
  `failure_mode: null`, still empty
  `output_impulse_ids`. Wall time varies; rationale-absence does
  not.

The seed runs `phantom_trace_scan` and
`precondition_rejection_scan` as `dry_run=true`
(`evaluate-pr-via-internal-idioms.ts:62-82`, citing
`concept_qcctOLBT5-CL` directly in the task description), so the
gate *knows* about F25. It just doesn't apply the same observability
discipline to its own refusals.

Commit `dbd0b8f` ("traceable refusal-with-reason") landed
2026-06-01 21:23Z claiming to fix this; post-deploy traces still
show the 5ms F25 sink. Either the running container has not picked
up the fix (`2026-05-30-vessel-binary-redeploy-on-source-drift`
applies) or `dbd0b8f` addresses a sibling code path.

**The structural problem.** A merge gate that rejects without
cited evidence is the *exact opposite* of S2→S3 push-away (IAL
§27.S.6: "refusal of operator interventions with cited evidence").
S2→S3 requires
`failure_mode.context.intervention_refused: true` AND
`cited_evidence: [concept_ids]`. Today the gate produces
`failure_mode: null` and empty output, which is rationale
bankruptcy. Every gate refusal that lands this way is operator-
opaque, drafter-opaque, and selector-opaque: the next drafter
cannot read the refusal as a prior; the operator cannot audit
the refusal; Thompson posteriors absorb a "failure" with no
attribution. This is the same bug class
`detect-phantom-success-trace.ts:8-9` calls out for
`validator-dispatch` (9367+ phantom traces) — except the gate
is *more* load-bearing because it sits in the self-merge loop.

## What changes

### 1. New seed template

`repos/development-vessel/src/seed/detect-merge-gate-no-rationale.ts`:

- Immunity pattern (`inputShapes: []`, `variables: []`, single
  task, deterministic resolver) mirroring
  `detect-phantom-success-trace.ts:38-62` and
  `detect-precondition-rejection.ts:35-77` structurally.
- Header comment cites `concept_9ldsmRgqSTd5`
  (`substrate_self_detection_principle`), `concept_qcctOLBT5-CL`
  (F25 phantom-success), and `concept_MNYEq7xc_46U` (F25
  architectural asymmetry).
- `outputShapes: ["substrateGap", "mergeGateNoRationaleReport"]`.

### 2. New resolver

`repos/development-vessel/src/resolvers/merge-gate-no-rationale-scan.ts`:

- Input: `{ window_hours?: number, gate_name_patterns?: string[],
  min_duration_ms?: number, max_emits?: number, dry_run?: boolean }`.
- Defaults: `window_hours = 24`,
  `gate_name_patterns = ["evaluate-pr-*", "*-gate",
  "verify-iteration-by-*"]`, `max_emits = 50`.
- Reads recent failed traces via the same activity-api
  `executionTraceList` surface the family already consumes
  (`detect-phantom-success-trace`,
  `detect-precondition-rejection`).
- **Filter to gate-class templates** by either:
  - Template name matching one of `gate_name_patterns`, OR
  - Template metadata tag `gate=true` (preferred — Phase C
    proposes adding the tag to gate-class seeds).
- For each gate-class trace with `status=failure`, classify into
  one of four `failure_shape` values:
  - `null_failure_mode` — `failure_mode == null`
  - `missing_intervention_refused` — `failure_mode.context` lacks
    the `intervention_refused` field
  - `missing_cited_evidence` — `failure_mode.context.cited_evidence`
    is missing or not an array
  - `f25_zero_task` — `task_count == 0` (degenerate phantom-success
    on the gate itself; the 5ms F25 sink shape)
- Emit `substrateGap` per finding:
  ```ts
  {
    classification_metadata: {
      gap_class: "merge_gate_no_rationale",
      template_id,
      trace_id,
      failure_shape,
      task_count,
      duration_ms,
    },
    summary: "Gate {template_id} refused trace {trace_id} ({duration_ms}ms, {task_count} tasks) without cited rationale",
    proposed_fix: "Add failure_mode.context.{intervention_refused, cited_evidence} emission to ${template_id}'s failure path (synthesize_evidence and/or merge_pr task).",
    fix_priors: [
      "concept_9ldsmRgqSTd5",
      "concept_qcctOLBT5-CL",
      "concept_MNYEq7xc_46U",
    ],
  }
  ```
- Aggregate `mergeGateNoRationaleReport { window_start, window_end,
  gates_scanned, traces_scanned, violations_by_shape:
  Record<failure_shape, number>, per_template_summary,
  examples: trace_id[] }`.
- **Self-immunity**: exclude
  `development-vessel:detect-merge-gate-no-rationale` and
  `development-vessel:substrate-self-audit-meta` from the
  group-by-template iteration so the detector cannot flag itself
  or its dispatcher even if their names matched a pattern.

### 3. Audit-meta integration

Once `2026-05-31-substrate-self-audit-meta` ships,
`self_audit_fan_out` includes
`detect-merge-gate-no-rationale` in its parallel dispatch list
(append to the canonical four). Detection becomes lifecycle-driven
rather than rotation-stochastic — every top-level execution
triggers a fresh sweep of recent gate failures.

### 4. `gate=true` metadata tag convention

Phase C proposes extending the seed-template metadata to carry a
`gate=true` tag for gate-class templates: `evaluate-pr-via-internal-idioms`,
any future `verify-iteration-by-*`, and the boredom load-aware gate
(super-repo `04441ca9`). The detector reads the tag in preference
to name patterns; templates that should-but-don't carry the tag get
their own `substrateGap` (gap_class:
`gate_missing_tag`) so the convention becomes self-policing.

## Out of scope

- **Fixing individual gates.** This is the detector; gate repair
  is per-template work (e.g. ensuring `merge_pr` task emits
  `failure_mode.context.intervention_refused` on
  `evaluationInsufficient`). Each detector finding contains a
  `proposed_fix` string; drafting a fix is a downstream
  `draft-gap-closing-activity` concern.
- **Meta-rule "every gate must have a watcher".** A separate
  openspec (`detect-unwatched-gate`) is the right home for the
  meta-rule; this proposal ships the first concrete watcher.
- **Changing the FailureMode taxonomy.**
  `2026-05-31-display-failure-mode-extensions` already added
  schema room for `budget_exhausted.budget_type = "display"`;
  this proposal *reads* the schema, doesn't extend it.
- **Operator-side dashboards.** Display surfacing of
  `mergeGateNoRationaleReport` rides the existing concept-bridge
  + dashboard work; not part of this proposal.

## Dependencies

- `executionTraceList` activity-api surface — already consumed
  by every existing family member.
- `substrateGap_write` impulse path — already shipped.
- The seed-template metadata `tags` field exists; adding a
  `gate=true` tag convention is a docs + per-seed change, not a
  schema change.

## Risk

- **False positives on gate-shaped templates with legitimate
  null failure_mode.** Some failures are genuinely
  `budget_exhausted` with non-cited rationale (operator-aborted,
  cost-ceiling). Mitigation: align with
  `2026-05-31-display-failure-mode-extensions` — only flag
  gates where rationale is *constitutionally* required (gates
  that refuse PRs or refuse dispatches; not gates that abort
  on budget). The detector reads `failure_mode.type`
  and treats `budget_exhausted` / `user_abort` as exempt from
  the cited-evidence requirement.
- **Recursive trap.** If this detector becomes a gate and fails
  opaquely, it becomes its own finding. Mitigation: explicit
  `template_id` self-exclusion in the resolver (same discipline
  every family member already practices) plus the immunity
  pattern (no inputShapes / variables / multi-task chain) makes
  the detector structurally unable to phantom-succeed.
- **Pattern-based gate detection drift.** Name patterns may miss
  gates added after this detector ships. Mitigation: Phase C's
  `gate=true` tag convention is the long-term answer; pattern
  matching is the bridge until the tag is universal.

## Companion concepts

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
  (the constitutional principle every family member cites)
- `concept_qcctOLBT5-CL` — F25 phantom-success signature
  (the 5ms zero-task case this detector catches on the gate
  itself)
- `concept_MNYEq7xc_46U` — F25 architectural asymmetry (the
  fact that the same bug class can recur higher up the stack;
  this detector instantiates that observation on the merge
  gate)

## Related openspecs

- `2026-05-31-substrate-self-audit-meta/` — once shipped, this
  detector joins the meta-template's fan-out and becomes
  event-driven.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2
  — push-away credit accounting. Each gate-without-rationale
  refusal counts as one S3 push-away credit WHEN AND ONLY WHEN
  the gate later emits cited rationale on the same template
  family. Until the gate emits cited rationale, the refusal is
  observability bankruptcy, not push-away.
- `2026-05-31-display-failure-mode-extensions/` — defines the
  `failure_mode.context` schema this detector reads. Exempts
  `budget_exhausted` / `user_abort` from the cited-evidence
  requirement.
- `2026-04-26-security-hardening-findings/` H3 — signed scope
  attestations strengthen the cited-evidence semantics. Until
  H3 ships, cited evidence is advisory; the structural chain
  is identical.

## Graph-RL framing

Gates without cited rationale are the operational anti-pattern of
S2→S3 push-away. IAL §27.S.6 measures S3 readiness by **active
push-away with cited evidence**: refusal that names *why* the
substrate refused, walkable from the refusal record to the
underlying concept_ids. The detector enforces the structural
property: refusal without citation is **observability bankruptcy**,
not push-away.

In RL terms: a refused action with `failure_mode: null` is an
**unattributed negative reward**. Thompson posteriors absorb the
β increment without learning *which feature* of the action drove
the refusal; future drafters cannot read the refusal as a prior
because the refusal carries no payload to read. With cited
evidence the substrate can refuse operator/self interventions
*auditably*, the citation chain `(refusal → concept_id → trace)`
is walkable, and the same refusal becomes a structural lesson
the selector can generalize from. Without it, every refusal is
opaque and S3 cannot be measured.

This detector is the minimal structural enforcement: the family
already names what observability bankruptcy looks like on
`validator-dispatch`; this proposal extends the same vocabulary
to the substrate's own merge gate.
