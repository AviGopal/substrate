# Adversarial Probe Set v1 — Operator-Authored Seed Corpus

This directory holds the **v1 adversarial probe set** consumed by the
substrate-resident `adversarial-probe-tick` activity (per
`openspec/changes/2026-05-23-lift-criterion-hardening/specs/lift-criterion-hardening/spec.md`
R3). v1 is the operator-authored bootstrap corpus that seeds the
S1 → S2 acceptance gate (§27.S.4b) and, post-lift, the load-bearing
S2 → S3 push-away signal (IAL §27.S.6).

## What this is

A flat directory of probe JSON files, one per probe, plus a
`MANIFEST.json` enumerating them. Each probe specifies:

- An **input** to be dispatched against the substrate (a goal, an
  attempted intervention, a manipulated trace, an injected impulse,
  an external event).
- The **expected substrate behavior** — what the substrate MUST and
  MUST NOT do, and what evidence it MUST cite.
- **Audit criteria** — `sound` / `unsound` / `disputed` verdicts
  that the operator applies when reviewing the substrate's response.

The format mirrors `design.md` §A.2 of lift-criterion-hardening with
extensions for richer operator-side audit. The `adversarial-probe-tick`
resolver reads the `expected_failure_classification` /
`expected_breach_subtype` fields and computes `pass_rate`. The richer
`audit_criteria` block is for the human-resolver audit pass (per
intervention-tracking spec R7 `audit-intervention-refused`).

## How the substrate consumes this

1. `adversarial-probe-tick` enumerates files matching
   `validation/adversarial-probes/v<N>/<probe_id>.json` for the highest
   `<N>`.
2. For each probe, the resolver dispatches `input.body` as a substrate
   goal via the standard goal-host path.
3. The resulting AET's `failure_mode.type` (and
   `failure_mode.context.breach_type` when present) is compared to
   `expected_failure_classification` / `metadata.expected_breach_subtype`.
4. The aggregate `pass_rate` lands on the next `adversarialProbeReport`
   emission. §27.S.4b reads
   `pass_rate ≥ adversarial_floor` (default 0.80).

Post-lift, the same corpus is sampled by `audit-intervention-refused`
(intervention-tracking R7); the substrate's `interventionRefused`
emissions are audited against the corresponding probe's
`audit_criteria.sound` clause. Increasing refusal rate with sound
verdicts is the §27.S.6 push-away signal.

## How the operator uses the probe reports

- Soft-pass / hard-pass against §27.S.4b: did the substrate detect
  enough of the seeded adversaries?
- Per-probe drill-down: which probe(s) failed, and was the substrate's
  rationale (the `interventionRefused` cited evidence) sound?
- Trend across rotations: are escaping probes from the same category
  (e.g., all foundation-compliance bypasses)? That signals validator
  drift before the held-out eval-set catches it.

## How this evolves

- **v1 is operator-authored.** The substrate may NOT modify any file
  under `validation/adversarial-probes/` (R7.2 of lift-criterion-hardening
  enforces this via the self-deployment whitelist).
- **v2+ may include substrate-distilled probes** authored by the
  substrate's `adversarial-probe-distillation` activity (IAL §27.S.5,
  expected post-lift). The substrate authors candidate probes; the
  operator vets and promotes them into the next `v<N>` directory. The
  authorship boundary remains operator-side; the substrate is a
  proposal source, not a corpus owner.
- **Rotation** follows the ISO-week seed convention from
  Phase 25 §G8.1.1 — operator-driven, default quarterly with monthly
  review. Each rotation lands as `v<N+1>/` with at minimum one new
  probe per category (so the substrate cannot memorize the corpus).

## Probe categories (this v1)

- **self_development** — does the substrate compose primitives to
  extend itself?
- **foundation_compliance** — does the substrate reject substrate-
  shaped proposals that violate foundation invariants?
- **push_away** — does the substrate refuse operator interventions
  it should refuse, and accept those it should accept?
- **inversion** — does the substrate model an external system as a
  vessel, or does it require operator-mediated specification?
- **closure** — does the substrate detect closure-replacement
  failure (missing memory, missing skill, etc.)?
- **posterior_manipulation** — does signal-confidence-weighting
  filter a forged trace?
- **self_recovery** — does the substrate self-heal a killed vessel
  within the §27.3.j.5 SLA?

See `MANIFEST.json` for the full list. Severities are `HIGH` for
gates that directly probe S1→S2 lift criteria, `MEDIUM` for
hardening signals, `LOW` for observational probes (none in v1).

## Soft-pass semantics

Per R3.5: an empty probe directory soft-passes the §27.S.4b gate
with a `liftBlocker` warning. v1 explicitly avoids that path by
shipping a non-trivial corpus. First-lift operator policy MAY
require hard-pass (no soft-pass tolerated); this is a per-substrate
operator choice, not a code gate.

## Ambiguity flag

Several probes target substrate behavior that is not yet fully
specified (e.g., `v1-005` posterior-direct-modification — there is no
substrate-internal write path for direct posterior modification today;
the probe is forward-looking). Each such probe's
`audit_criteria.disputed` clause spells out the spec gap; the operator
resolves the verdict by treating "substrate has no defended boundary
here yet" as a `liftBlocker` against §27.S.4b rather than a substrate
failure.
