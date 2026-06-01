# detect-merge-gate-no-rationale (substrate-self-detection family)

## Why

The substrate-as-git-author merge surface is gated by
`evaluate-pr-via-internal-idioms`
(`repos/development-vessel/src/seed/evaluate-pr-via-internal-idioms.ts:27-175`):
a seven-task composition whose verdict is meant to be auditable
from a single trace (operator directive 2026-06-01, cited at
lines 14-17 of the seed). Throughout 2026-06-01 the gate has
exhibited **rejection without cited rationale** in three trace
shapes:

- **Opaque mid-execution failure** — `exec_bdi43hzm` (2.0s) and
  `exec_meur43e0` (2.4s): all completed tasks `ok=true`,
  top-level `status=failure`, `failure_mode: null`,
  `output_impulse_ids: []`. Gate refused without saying why.
- **F25 sub-second sink** — `exec_hpw8n07m` and `exec_q4xlw1vd`
  (both 5ms): engine pre-flight rejection, zero tasks recorded,
  F25 phantom-success signature (`concept_qcctOLBT5-CL`) the
  substrate has already named — the gate itself is the F25 victim.
- **Variable-length failures** — `exec_imbmjn3f` (7.8s),
  `exec_u7xeinm9` (6.7s): longer runs, still `failure_mode: null`,
  still empty `output_impulse_ids`.

The seed runs `phantom_trace_scan` and `precondition_rejection_scan`
as `dry_run=true` (`evaluate-pr-via-internal-idioms.ts:62-82`,
citing `concept_qcctOLBT5-CL`) — so the gate *knows* about F25; it
just doesn't apply the same observability discipline to its own
refusals. Commit `dbd0b8f` ("traceable refusal-with-reason") at
21:23Z claimed to fix this; post-deploy traces still show the 5ms
F25 sink — either container drift
(`2026-05-30-vessel-binary-redeploy-on-source-drift`) or sibling
code path.

**The structural problem.** A merge gate that rejects without
cited evidence is the *opposite* of S2→S3 push-away (IAL §27.S.6
requires `failure_mode.context.intervention_refused: true` AND
`cited_evidence: [concept_ids]`). Today the gate produces
`failure_mode: null` and empty output — rationale bankruptcy.
Every such refusal is operator-opaque, drafter-opaque, and
selector-opaque; Thompson posteriors absorb a "failure" with no
attribution. Same bug class as
`detect-phantom-success-trace.ts:8-9` on `validator-dispatch`
(9367+ phantom traces) — but more load-bearing because the gate
sits in the self-merge loop.

## What changes

### 1. New seed template

`repos/development-vessel/src/seed/detect-merge-gate-no-rationale.ts`:
immunity pattern (`inputShapes: []`, `variables: []`, single task,
deterministic resolver) mirroring
`detect-phantom-success-trace.ts:38-62`. Header cites
`concept_9ldsmRgqSTd5`, `concept_qcctOLBT5-CL`,
`concept_MNYEq7xc_46U`. `outputShapes: ["substrateGap",
"mergeGateNoRationaleReport"]`.

### 2. New resolver

`repos/development-vessel/src/resolvers/merge-gate-no-rationale-scan.ts`:

- Input: `{ window_hours?, gate_name_patterns?, min_duration_ms?,
  max_emits?, dry_run? }`. Defaults: `window_hours = 24`,
  `gate_name_patterns = ["evaluate-pr-*", "*-gate",
  "verify-iteration-by-*"]`, `max_emits = 50`.
- Reads failed traces via the same activity-api
  `executionTraceList` surface the family already consumes.
- Filters to gate-class templates by metadata tag `gate=true`
  (preferred — Phase C) or `gate_name_patterns` (bridge).
- Classifies each failed gate trace into a `failure_shape`:
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

- **Fixing individual gates.** Gate repair is per-template;
  detector findings carry a `proposed_fix` string for downstream
  `draft-gap-closing-activity`.
- **Meta-rule "every gate must have a watcher".** Separate
  openspec (`detect-unwatched-gate`); this is the first watcher.
- **Changing the FailureMode taxonomy.** This proposal *reads*
  the schema; `2026-05-31-display-failure-mode-extensions` owns
  extensions.
- **Operator-side dashboards** for `mergeGateNoRationaleReport`
  — rides existing concept-bridge + dashboard work.

## Dependencies

- `executionTraceList` activity-api surface — already consumed
  by every existing family member.
- `substrateGap_write` impulse path — already shipped.
- The seed-template metadata `tags` field exists; adding a
  `gate=true` tag convention is a docs + per-seed change, not a
  schema change.

## Risk

- **False positives on legitimate null failure_mode.**
  `budget_exhausted` / `user_abort` failures have non-cited
  rationale by design. Mitigation: detector reads
  `failure_mode.type` and exempts those two types from the
  cited-evidence requirement (aligns with
  `2026-05-31-display-failure-mode-extensions`).
- **Recursive trap.** If this detector becomes a gate and fails
  opaquely, it becomes its own finding. Mitigation: explicit
  self-exclusion plus the immunity pattern (no inputShapes /
  variables / multi-task chain) makes it structurally unable to
  phantom-succeed.
- **Pattern-based gate detection drift.** Name patterns may
  miss gates added after this detector ships. Mitigation: Phase
  C's `gate=true` tag convention is the long-term answer.

## Companion concepts

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `concept_qcctOLBT5-CL` — F25 phantom-success signature (the
  5ms zero-task case this detector catches on the gate itself)
- `concept_MNYEq7xc_46U` — F25 architectural asymmetry (same
  bug class recurring higher up the stack)

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
push-away with cited evidence** — refusal that names *why*,
walkable from the refusal record to underlying concept_ids. The
detector enforces the structural property: refusal without
citation is **observability bankruptcy**, not push-away.

In RL terms: a refused action with `failure_mode: null` is an
unattributed negative reward. Thompson posteriors absorb the β
increment without learning which feature of the action drove
refusal; future drafters cannot read the refusal as a prior; the
selector cannot generalize. With cited evidence, the citation
chain `(refusal → concept_id → trace)` is walkable and the
refusal becomes a structural lesson. The family already names
this anti-pattern on `validator-dispatch`; this proposal extends
the same vocabulary to the substrate's own merge gate.
