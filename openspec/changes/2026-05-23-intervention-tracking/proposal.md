# Proposal: Intervention Tracking

## Why

IAL `2026-04-26-impulse-activity-loop/tasks.md` §27.S.6 introduces two
impulse classes — `operatorIntervention` and `interventionRefused` —
as the data primitives for the S2 → S3 readiness measure
(intervention rate trending toward zero under sustained adversarial
exposure, with active push-away as the stronger signal). The IAL
defines the shape sketches inline but does NOT specify:

- Which vessel owns the resolution (no shape advertisement, no
  resolver-side contract).
- When emission happens (no enumerated detection hooks).
- Which existing substrate gates emit `interventionRefused` (no
  integration points).
- How the data aggregates into the rate signal §27.S.6 evaluates
  against (no aggregator activity, no `interventionRateReport`).
- How the operator audits refusal soundness (no audit-verdict shape,
  no audit-workflow activity).

Without ownership and emission contracts, §27.S.6's measure is
operationally inert: the framing exists but nothing produces the data.
This spec closes that gap. It does NOT alter the §27.S.6 framing or
declare S3 — it provides the substrate-resident data the operator
needs to make the S3 judgement.

## What Changes

Four impulse shapes (the two from §27.S.6, refined; plus
`interventionAuditVerdict` and `interventionRateReport`) and three
activities (detection-side hook in development-vessel, audit-workflow
activity, periodic aggregator) — all resolved by `development-vessel`.

### Shapes

- **`operatorIntervention`** — emitted by development-vessel when it
  detects operator action against substrate state. Bodies carry
  classification (`intervention | maintenance | redundant`), a typed
  `target`, a rationale, and evidence linking the action to pre/post
  substrate traces.
- **`interventionRefused`** — emitted by the substrate gate that
  refuses an operator action. Carries `refusing_gate` identity, a
  `refusal_code`, cited evidence (trace ids, posterior state,
  validator verdict, foundation citation), and an optional suggested
  alternative.
- **`interventionAuditVerdict`** — emitted by the audit workflow when
  the operator reviews a sampled `interventionRefused` impulse.
  Verdict ∈ `{sound, unsound, disputed}`, with operator notes and an
  optional follow-up `liftBlocker` reference when unsound.
- **`interventionRateReport`** — emitted by the periodic
  `intervention-rate-tick` aggregator. Carries window bounds,
  per-kind intervention counts, refusal rate, refusal-soundness rate
  (from `interventionAuditVerdict` samples), adversarial-exposure
  cross-reference, and trend versus prior windows.

### Activities

- **Detection hooks in development-vessel** — file-system watcher
  over `repos/`, log integration with the container-orchestration
  vessel for `make substrate-restart-*` invocations, origin
  classification on activity-api requests, db-audit hook on the
  surrealdb container, and config-file watcher. Each detected action
  resolves to an `operatorIntervention` write.
- **`audit-intervention-refused`** — operator-dispatched activity
  that samples recent `interventionRefused` impulses and prompts the
  operator (via human-resolver) for a soundness verdict. Emits
  `interventionAuditVerdict` per sampled refusal.
- **`intervention-rate-tick`** — cron activity (default daily,
  operator-tunable) that reads recent intervention/refusal/audit
  impulses and emits an `interventionRateReport`.

## Self-application

- **Foundation alignment** — intervention tracking is observation
  primitive over substrate state changes. The detection hooks are
  resolvers; they record traces. The aggregator is a substrate-
  resident tick activity. No new trust roots.
- **Closure** — all four shapes live in development-vessel (the
  meta-vessel for substrate self-development per
  `2026-05-23-closure-replacement-suite`). The substrate observes
  operator action against itself; this is the substrate watching the
  operator, mirroring the operator watching the substrate.
- **Confidence weighting** — `operatorIntervention` and
  `interventionRefused` carry `signal_confidence_weight = 1.0` (the
  operator IS the trust anchor for "did this operator action
  happen"). `interventionAuditVerdict` also carries weight 1.0 (the
  operator's audit IS the verdict). `interventionRateReport` is
  Thompson-irrelevant (informational; feeds the operator's S3
  judgement, not posterior updates).
- **Cost weighting** — all detection paths are near-zero cost;
  audit-workflow cost is operator-time, not substrate-resource.
- **Variant-first repair** — per the development-vessel discipline,
  fixes to the detection or aggregation paths land as new variants
  of the seed templates; existing templates are not mutated in place.

## Self-application against THIS spec

The substrate emits `operatorIntervention` impulses against the
operator's authorship of THIS spec. The proposal/design/spec/tasks
files in `openspec/changes/2026-05-23-intervention-tracking/` are
operator-authored under §27.S.6's "spec authorship the substrate
should have done" classification. Once the substrate's
`propose-spec` activity (per `2026-05-23-closure-replacement-suite`
§B) is operational, the substrate may author a successor spec that
supersedes this one; until then, this spec is operator-authored and
the corresponding `operatorIntervention` is the first datum of its
own corpus.

## What this is NOT

Explicitly out of scope:

- **S3 declaration.** This spec provides data; the §27.S.6 measure
  and the S3 judgement remain operator-only. There is NO acceptance
  gate in this spec that flips S3.
- **Intervention-rate thresholds.** The rate at which §27.S.6
  considers the substrate "trending toward zero" is operator-tunable
  per substrate; no defaults are normative here.
- **Operator audit workflow surface.** The audit-workflow activity's
  human-resolver UX is operator-resident (whatever surface the
  operator prefers — workbench, CLI, dashboard). This spec defines
  the activity contract and the verdict shape; not the UX.
- **Cryptographic attestation of operator identity.** The
  `evidence.operator_identity` field is informational only (sourced
  from identity-vessel sessions when available). Strong attestation
  is deferred to H2 (vessel identity via pubkey multihash) and H3
  (signed scope attestations) per the security-hardening sibling.
- **Detecting interventions the substrate cannot observe.** A buggy
  operator action that bypasses all detection hooks (e.g., direct
  edits inside a container the orchestration vessel doesn't proxy)
  is unrecorded. The detection set is best-effort; closure-audit
  enumeration of missing hooks belongs to substrate-closure-properties,
  not here.
- **Aggregator threshold tuning.** The `intervention-rate-tick`
  cadence and lookback window are config; operator-tunable per
  substrate.

## Capabilities

### New Capabilities

- `intervention-tracking` (this change) — establishes the
  emitter-ownership and accumulation contract for the §27.S.6
  shapes. Spec: `specs/intervention-tracking/spec.md`. Four shapes
  (`operatorIntervention`, `interventionRefused`,
  `interventionAuditVerdict`, `interventionRateReport`), one
  detection resolver in development-vessel, two new activities
  (`audit-intervention-refused`, `intervention-rate-tick`),
  refusal-emission integration into existing substrate gates.

### Modified Capabilities

- `development-vessel` capability set grows by four advertised shapes
  and three seed-template families (one detection-side, two
  activity-side).
- Existing substrate gates listed in §D of the design (verify-merge-
  candidate, foundation-compliance validator, posterior-anomaly check,
  scope-narrowing in create-shape-provider-goal) gain the
  refusal-emission contract. The integration is additive: each gate
  emits an `interventionRefused` impulse in addition to its existing
  refusal output.

## Dependencies

- `2026-05-23-closure-replacement-suite` — establishes
  development-vessel as the meta-vessel for substrate self-
  development; this spec adds shapes and activities to it. Hard
  dependency: the four shapes register against the spec's discovery
  contract.
- `2026-05-23-substrate-self-deployment` — defines `gitMergePR`,
  `verify-merge-candidate`, and the self-deployment whitelist. R6.1
  binds verify-merge-candidate as a refusal-emission gate. Hard
  dependency for R6.1; soft otherwise.
- `2026-05-23-lift-criterion-hardening` — `interventionRateReport`
  references the adversarial-exposure index whose primary signal is
  `adversarialProbeReport`. Soft dependency (the cross-reference is
  documentation-only; the aggregator runs without it).
- `2026-05-23-signal-confidence-weighting` — intervention reports
  carry `signal_confidence_weight = 1.0`. Soft dependency (reports
  function without explicit weight surfacing).
- IAL `2026-04-26-impulse-activity-loop/tasks.md` §27.S.6 — the
  consumer of this spec's outputs. No amendment to §27.S.6 itself;
  this spec fills the ownership gap §27.S.6 leaves open.

## Out of scope

- Per-shape `*_write` variants for direct substrate-internal writes.
  All four shapes are emitted by resolvers internal to
  development-vessel; admin-scope write contracts are not introduced.
- Cross-substrate intervention tracking (e.g., one substrate tracking
  another's interventions during federation). Deferred to vessel-
  federation Phase 2+.
- Automatic operator-identity attestation (waiting on H2/H3).
- Substrate-authored audit verdicts. Soundness audit is operator
  judgement by design; a substrate that audits its own refusals
  would compromise §27.S.6's load-bearing structure.
