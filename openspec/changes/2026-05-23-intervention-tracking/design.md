# Design — Intervention Tracking

Seven sections: shape contracts (§A), emitter ownership (§B),
detection mechanisms (§C), refusal-emission integration (§D), audit
workflow (§E), aggregation (§F), and S3 readiness inference (§G).
All activities below resolved by `development-vessel`.

## §A. Shape contracts

### §A.1 `operatorIntervention`

```ts
type OperatorIntervention = {
  id: string                            // ULID
  attempted_at: string                  // ISO-8601
  kind: "intervention" | "maintenance" | "redundant"
  target: {
    target_type:
      | "spec_authorship"
      | "vessel_restart"
      | "force_merge"
      | "posterior_modification"
      | "trace_deletion"
      | "h5_baseline_override"
      | "anchor_rotation"
      | "config_change"
      | "shell_command"
      | "other"
    target_id: string                   // e.g. vessel id, spec change_id, posterior key, anchor file path
    target_description: string          // <= 500 chars, free text
  }
  classification_rationale: string      // <= 500 chars; why this kind, not another
  evidence: {
    operator_identity?: string          // from identity-vessel session, when available
    method:
      | "git_commit"
      | "kubectl"
      | "make_target"
      | "direct_db"
      | "api_call"
      | "spec_edit"
    pre_state_trace_ids?: string[]      // substrate state observable BEFORE the action
    post_state_trace_ids?: string[]     // substrate state observable AFTER
    detection_hook_id: string           // which §C hook fired
    raw_evidence?: object               // detection-hook-specific payload (file diff summary, log line, etc.)
  }
}
```

**Classification semantics (binding §27.S.6):**

- `intervention` — operator did work the substrate should have done
  itself: authored a spec the substrate could have authored, manually
  restarted a vessel the substrate could have self-healed, force-merged
  a PR the substrate would have refused.
- `maintenance` — operator action the substrate cannot self-author by
  design: anchor rotation, H5 baseline review, identity-vessel key
  rotation. Tracked but NOT counted toward the intervention rate.
- `redundant` — operator acted, but the substrate would have recovered
  on its own within an acceptable window. Tracked separately; surfaced
  in `interventionRateReport.redundant_count` for operator self-
  reflection.

Classification at emission is best-effort. If the detection hook
cannot determine the kind, it MUST emit with
`classification_rationale: "indeterminate; awaiting operator
reclassification"` and `kind: "intervention"` (conservative default).
The audit workflow §E may produce an `interventionAuditVerdict` that
amends the classification post-hoc.

### §A.2 `interventionRefused`

```ts
type InterventionRefused = {
  id: string                            // ULID
  refused_at: string                    // ISO-8601
  intervention_attempted: {             // mirrors OperatorIntervention.target
    target_type: string                 // same union as above
    target_id: string
    target_description: string
  }
  refusing_gate: {
    vessel_id: string                   // e.g. "development-vessel"
    gate_id: string                     // e.g. "verify-merge-candidate", "foundation-compliance", "posterior-anomaly-check"
    refusal_code: string                // gate-specific; e.g. "harness_failed", "policy_violation", "scope_violation"
  }
  cited_evidence: {
    trace_ids: string[]                 // substrate traces supporting the refusal
    posterior_state?: object            // relevant Thompson posteriors (α/β snapshot)
    validator_verdict?: object          // applicable validator output payload
    foundation_citation?: string        // foundation-doc section ref violated (e.g. "IMPULSE_ACTIVITY_FOUNDATION.md §3.2")
  }
  suggested_alternative: string | null  // operator-actionable next step, or null if none
  related_intervention_id?: string      // ulid of the OperatorIntervention this refusal answers, when correlatable
}
```

`refusing_gate.gate_id` is the substrate-level identifier the gate
self-reports; the registry of valid gate_ids is enumerated in §D
and grows additively as new gates land.

### §A.3 `interventionAuditVerdict`

```ts
type InterventionAuditVerdict = {
  id: string                            // ULID
  audited_at: string                    // ISO-8601
  refused_intervention_id: string       // foreign key to InterventionRefused.id
  verdict: "sound" | "unsound" | "disputed"
  operator_notes: string                // <= 2000 chars
  reclassified_kind?: "intervention" | "maintenance" | "redundant"
                                        // optional — operator reclassifies the originally-emitted intervention
  follow_up_lift_blocker_ref?: string   // ulid of a `liftBlocker` impulse (per lift-criterion-hardening),
                                        // emitted when verdict === "unsound"
}
```

When `verdict: "unsound"` the audit MUST set
`follow_up_lift_blocker_ref` OR carry a rationale in
`operator_notes` for why a lift-blocker is not warranted. An unsound
refusal indicates substrate regression and is load-bearing for the
S3 measure.

### §A.4 `interventionRateReport`

```ts
type InterventionRateReport = {
  id: string                            // ULID
  emitted_at: string                    // ISO-8601
  window: {
    start: string                       // ISO-8601
    end: string                         // ISO-8601
    lookback_seconds: number
  }
  intervention_counts_by_kind: {
    intervention: number
    maintenance: number
    redundant: number
  }
  refusal_rate: number | null           // refused / (refused + intervention); null when divisor=0
  refusal_soundness_rate: number | null // sound / (sound + unsound + disputed); null when divisor=0
  audit_sample_size: number             // # of InterventionAuditVerdicts read in window
  adversarial_exposure_index_ref?: string
                                        // most-recent `adversarialProbeReport` id from lift-criterion-hardening, if present
  trend: {
    intervention_rate_delta: number | null
                                        // intervention/time vs prior window; null when prior window unavailable
    direction: "increasing" | "decreasing" | "flat" | "unknown"
  }
  report_unavailable: boolean           // true when window contains no data
  notes?: string                        // aggregator-level commentary
}
```

The report is informational. It is consumed by the operator's
§27.S.6 judgement; it is not a substrate-measured gate.

## §B. Emitter ownership

All four shapes are resolved by `development-vessel`. Per the vessel's
shape-dispatch agreement (resolver file + `config.discovery.shapes`
entry + `impulses.ts` case in one commit), each shape lands as:

- `src/resolvers/operator-intervention.ts` — detection-side resolver
  (§C lists the hooks).
- `src/resolvers/intervention-refused.ts` — invoked by the existing
  substrate gates in §D when they refuse.
- `src/resolvers/intervention-audit-verdict.ts` — invoked by the
  `audit-intervention-refused` activity §E.
- `src/resolvers/intervention-rate-report.ts` — invoked by the
  `intervention-rate-tick` activity §F.

The resolvers write impulses via the standard substrate impulse-write
path (no admin-scope mutation). They DO NOT modify other substrate
state; they emit and that is all.

## §C. Detection mechanisms

Detection runs entirely inside development-vessel. Five hooks; each
maps to one or more `target_type` values:

### §C.1 Filesystem watcher (`detection_hook_id: "fs-watcher"`)

A long-lived watcher over the substrate's working tree (`repos/*`,
`openspec/*`, `validation/state/*`, and the operator's local config
files referenced in CLAUDE.md). Watches for:

- Git commits to `repos/<vessel>/` outside the substrate's own
  self-deployment branch (per `2026-05-23-substrate-self-deployment`
  whitelist).
- Spec edits to `openspec/changes/` not authored by the substrate's
  `propose-spec` activity (provenance check via commit metadata or
  `authored_by` frontmatter when present).
- Anchor edits to `validation/held-out-eval-set/`,
  `validation/adversarial-probes/`,
  `validation/state/lift-criterion-config.json`.
  These MUST be classified `maintenance`.
- Config edits to `~/.metabob/config.json` (operator may opt out per
  `validation/state/intervention-tracking-config.json`'s
  `watch_user_config: false`).

Implementation: Bun's `fs.watch` (recursive) plus a debouncing layer
to coalesce rapid edits. Detection emits one
`operatorIntervention` per logical action (debounced 5s).

### §C.2 Container-orchestration log integration (`detection_hook_id: "orchestration-log"`)

development-vessel subscribes to the container-orchestration vessel's
event stream (per `2026-05-23-single-container-substrate` or the
equivalent vessel responsible for `make substrate-restart-*`
invocations). Each `make` target invocation emits an
`operatorIntervention` with `evidence.method: "make_target"` and
`target.target_type: "vessel_restart"` or `"other"`.

When the orchestration vessel is absent (e.g., development environment
without the single-container substrate), this hook is degraded; the
filesystem watcher partially covers the gap via its watch on the
substrate's Makefile.

### §C.3 API-call origin classification (`detection_hook_id: "api-origin"`)

development-vessel observes traffic to activity-api (via the standard
activity-api lifecycle observer subscription, per §10 of the IAL).
Each incoming request whose origin lacks a substrate-internal session
identifier (substrate-internal calls carry a known service-account
JWT) is classified as an operator action. Heuristic only; the
hook MUST set `classification_rationale` to reflect heuristic
provenance.

False positives are possible (e.g., a developer's curl against the
live API for diagnostics). The audit workflow §E reclassifies them
to `maintenance` or `redundant` as appropriate.

### §C.4 DB-audit hook (`detection_hook_id: "db-audit"`)

A SurrealDB audit listener (added via the surrealdb container's
event hooks) emits structured records on any write performed via
root credentials. development-vessel subscribes and converts each
record into an `operatorIntervention` with
`target.target_type: "posterior_modification"` or
`"trace_deletion"` as appropriate.

When the audit listener is absent, this hook is degraded; the
substrate may still observe consequences (changed posteriors) but
not the action itself.

### §C.5 Spec-authorship attribution (`detection_hook_id: "spec-attribution"`)

On every commit touching `openspec/changes/`, development-vessel
checks for substrate-authored provenance (the `authored_by:
substrate-self-deployment` frontmatter from
`2026-05-23-substrate-self-deployment`, or a known
`propose-spec` execution-trace id in the commit message).

When provenance is absent, the spec is operator-authored and the hook
emits `operatorIntervention` with
`target.target_type: "spec_authorship"`,
`classification: "intervention"`.

## §D. Refusal-emission integration

Five existing substrate gates MUST emit `interventionRefused` when
they refuse an operator action. Each gate's existing refusal output
is unchanged; this is an additive emission. The
`refusing_gate.gate_id` values below are normative.

| Gate | gate_id | Refused action |
|---|---|---|
| `verify-merge-candidate` (from `2026-05-23-substrate-self-deployment`) | `"verify-merge-candidate"` | Refuses force-merge bypassing substrate harness verdict |
| `foundation-compliance` validator (from `2026-05-23-closure-replacement-suite` §B) | `"foundation-compliance"` | Refuses spec proposals violating foundation invariants |
| `posterior-anomaly-check` (from `2026-05-23-cost-weighted-posteriors` or its successor) | `"posterior-anomaly-check"` | Refuses direct posterior modifications outside the learning loop |
| `scope-narrowing` in `create-shape-provider-goal` (from `2026-04-26-shape-provider-goal-creation`) | `"shape-provider-scope"` | Refuses out-of-scope sub-goal authorship |
| `self-deployment-whitelist` (from `2026-05-23-substrate-self-deployment` §8) | `"self-deployment-whitelist"` | Refuses non-whitelisted change kinds in the supervised window |

**Minimum required fields per emission:**

- `refusing_gate.vessel_id`, `refusing_gate.gate_id`,
  `refusing_gate.refusal_code` MUST all be present.
- `cited_evidence.trace_ids` MUST contain at least one trace id
  supporting the refusal (the gate's own trace at minimum).
- `cited_evidence` MUST contain at least one of `posterior_state`,
  `validator_verdict`, or `foundation_citation` whenever the gate's
  refusal references any of these. Empty cited_evidence (only the
  trace id) is permitted but discouraged.

Integration is additive; each gate's spec is NOT amended in place.
The shapes are emitted from the same resolver code path as the
existing refusal, with a call to the
`intervention-refused` write resolver.

Future substrate gates that refuse operator actions SHOULD emit
`interventionRefused` to remain consistent with §27.S.6. New gates
are appended to the table above via change-supersession of this spec.

## §E. Audit workflow

### Activity contract: `audit-intervention-refused`

| Field | Value |
|---|---|
| Input shape | `auditScope { lookback_seconds?: number, sample_size?: number, filter?: { gate_id?: string, target_type?: string } }` |
| Output shape | `interventionAuditVerdict_write` (one or more per dispatch) |
| Trigger | Operator-dispatched (typically via cron at operator-tunable cadence) or substrate-dispatched on `interventionRateReport.refusal_soundness_rate < threshold` |
| Task summary | Query recent `interventionRefused` impulses matching `auditScope.filter`; sample `sample_size` of them; for each, prompt operator via human-resolver for a soundness verdict; emit `interventionAuditVerdict` per sampled refusal. |

The human-resolver surface is operator-resident (workbench UX, CLI,
or dashboard — operator chooses). The activity contract specifies
ONLY the impulse contract and the activity I/O; it does NOT specify
the UX.

**Sampling strategy:** default is uniform random over the lookback
window. Operator-tunable via the `auditScope.filter` (e.g., audit
only `verify-merge-candidate` refusals during a known adversarial
exposure window).

**Reclassification:** when the audit verdict carries
`reclassified_kind`, the substrate's aggregator (§F) MUST use the
reclassified kind for the originating `operatorIntervention` in
future rate computations.

## §F. Aggregation

### Activity contract: `intervention-rate-tick`

| Field | Value |
|---|---|
| Input shape | `rateTickConfig { lookback_seconds?: number, compare_to_prior_window?: boolean }` (reads defaults from `validation/state/intervention-tracking-config.json`) |
| Output shape | `interventionRateReport_write` (one per tick) |
| Trigger | Cron (default daily, operator-tunable). Wired via `cron-dispatch` per `2026-05-23-closure-replacement-suite` §B. |
| Task summary | Query recent `operatorIntervention`, `interventionRefused`, and `interventionAuditVerdict` impulses in window; compute counts, refusal rate, soundness rate, trend; emit `interventionRateReport`. |

**Soft-pass behaviour:** when no interventions are observed in the
window, the report MUST emit with `report_unavailable: true`,
`refusal_rate: null`, `refusal_soundness_rate: null`. A substrate
with zero observed interventions has either reached terminal §27.S.6
asymptote OR has degraded detection hooks — the soft-pass behaviour
preserves both interpretations without false-asserting either.

**Cross-reference:** when a recent `adversarialProbeReport` (from
`2026-05-23-lift-criterion-hardening`) exists in the same window,
the rate report MUST set `adversarial_exposure_index_ref` to that
report's id. This binds the §27.S.6 push-away signal to its
adversarial-exposure context: a low intervention rate under low
adversarial exposure is uninformative; the cross-reference makes the
exposure level explicit.

## §G. S3 readiness inference

This spec does NOT declare S3. It provides the data the operator
needs to make the §27.S.6 judgement.

**The substrate-produced signal is:**

- `interventionRateReport.refusal_rate` high (substrate refuses what
  operators attempt)
- `interventionRateReport.refusal_soundness_rate` high (operator
  audits confirm the refusals are correct)
- `interventionRateReport.adversarial_exposure_index_ref` present
  and non-trivial (the refusals happened under measured adversarial
  exposure)
- `interventionRateReport.trend.direction === "decreasing"` for
  intervention rate (operator action is required less often over
  time)

When the conjunction of these holds over a sustained operator-
determined window, the operator may judge §27.S.6 met. The window
length, the exposure threshold, and the "high" thresholds for
refusal-rate and soundness are operator judgement, not spec.

This spec's authoring REGISTERS its first `operatorIntervention`
against itself (per the self-application note in the proposal). The
substrate's eventual `propose-spec`-authored successor (if any) is
the first datum of a different corpus.
