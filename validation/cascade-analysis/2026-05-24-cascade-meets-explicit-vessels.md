# Cascade Analysis × Substrate-Explicit-Vessels Cross-Reference

**Authored**: 2026-05-24 by auditor.
**Purpose**: Cross-reference the audit's F-038 linchpin cascade
(`validation/cascade-analysis/2026-05-24-linchpin-cascade.md`)
against the existing `2026-05-23-substrate-explicit-vessels`
openspec change. The cascade's fix points are already specified
structurally; this document maps which cascade findings each
explicit vessel addresses.

## Why this cross-reference exists

The user observed that "the spec should already exist to some
degree in the main IAL openspec spec." It does. The existing
`2026-05-23-substrate-explicit-vessels` proposal (53 tasks, 0
complete as of this writing) names six substrate-hosted explicit
vessels that decompose minibob's responsibilities:

- `goal-host-vessel` (port 8210) — owns goal_execution +
  activity_execution shapes; replaces in-process
  `executor.execute()` in goal-processor.ts
- `llm-resolver-vessel` (port 8220) — owns `llmText`,
  `llmStructured`, `llmToolCall`; absorbs `repos/minibob/src/llm.ts`
  + 9 LLM-flavoured resolvers
- `local-tools-vessel` (port 8230) — owns `fileContent`,
  `commandResult`, `gitDiff`, `directoryTree` shapes; absorbs
  `repos/minibob/src/tools.ts`
- `ribosome-vessel` (port 8240) — subscribes to activity-api
  `task.completed` events; replaces the lifecycle-meta ribosome
  embedded in minibob
- `boredom-vessel` (port 8250) — timer-driven autonomous-loop
  driver; replaces `repos/minibob/src/boredom.ts`
- `bootstrap-seeder.service` (oneshot) — seeds SHARED_TEMPLATES
  at substrate boot; resolves chicken-and-egg dependency

The existing spec also names two additional structural changes:

7. **Thompson posterior advertisement** — adds `thompson_posterior`
   to activity-api's `config.discovery.shapes`, fixing the
   account-vs-global scope ordering bug from IAL Phase 9.3.
8. **Cross-vessel composition_chain propagation** —
   `VesselDaemon`'s `/run-goal` endpoint accepts
   `parent_execution_id` and `composition_chain` in the request
   body and threads them into ExecuteOptions.

This cross-reference is the auditor's way of confirming the
existing spec is the structural answer to the cascade we
identified, while noting the **specific cascade items that map
to specific spec sections**.

## Cascade → spec section mapping

| Cascade finding | Existing spec addresses via |
|---|---|
| **F-038** (composition_chain empty) | Point 4 of "What Changes" — cross-vessel composition_chain propagation. Threading `parent_execution_id` + `composition_chain` through VesselDaemon's request body is exactly the population fix the cascade names. |
| **F-028** (goal_resolve doesn't walk chain) | goal-host-vessel rewrite — verifier reimplementation can walk the chain from inception. |
| **F-037** (Thompson posteriors don't update) | Point 7 — `thompson_posterior` shape advertisement + Phase 9.3 scope-ordering fix. The Thompson update path becomes a proper shape resolution rather than a REST endpoint dead-end. |
| **F-029** (failure_mode not populated) | goal-host-vessel rewrite — taxonomy populated from inception. |
| **F-024** (boredom systemd POSTs goal:) | boredom-vessel replaces the systemd unit entirely with a proper substrate-resident vessel. F-024's specific bug (goal vs templateId POST format) becomes moot because the vessel implements its own scheduler. |

Every cascade finding has a corresponding structural fix in the
existing spec. The decomposition is not a separate piece of
work; it is the long-term answer to the cascade the auditor
identified.

## What the audit work contributes alongside the existing spec

1. **Diagnostic queries** (in the linchpin-cascade.md document)
   that dev can use to verify each layer of the cascade is
   actually fixed by their changes, without waiting an hour for
   trace accumulation. The substrate-explicit-vessels spec
   describes the structural fixes; the audit's cascade analysis
   provides the verification harness.

2. **Run-time evidence** that the cascade exists and remains
   active. The audit's findings F-014 → F-028 → F-029 → F-031 →
   F-032 → F-037 → F-038 are reproducible-at-time-of-recording
   observations. Each shipped audit iteration verifies them
   against current substrate.

3. **Cross-finding dependency analysis** identifying which fixes
   likely auto-cascade (F-038 → F-037 if Thompson reads the
   chain) and which need separate code changes (F-028 verifier
   must explicitly walk the chain). The substrate-explicit-vessels
   spec doesn't enumerate these dependencies; the cascade
   analysis does.

These three contributions are complementary to the existing spec,
not duplicative. The spec specifies WHAT to build; the audit
specifies HOW to verify each layer is working.

## What the existing spec covers that the audit doesn't

The existing spec includes structural elements the audit didn't
identify as cascade items because they don't manifest as
immediate runtime failures:

- **VesselDaemon toolkit** in ias-executor-ts (Bun HTTP wrapper +
  ResolverServer + DiscoveryRegistrationLoop). The substrate's
  current vessels duplicate this boilerplate per-vessel; the
  toolkit factors it out. Audit didn't flag this because it's a
  code-organization improvement, not a runtime defect.
- **Bootstrap-seeder.service** for resolving the chicken-and-egg
  dependency at substrate boot. Audit didn't flag this because
  the substrate boots successfully today; the seeder is for
  future cold-starts after the decomposition.
- **GoalHost promotion** from `src/examples/` to `src/hosts/`.
  Audit didn't flag this; it's a clean-up of internal
  organization within ias-executor-ts.

## Recommended sequencing under the existing spec

The cascade analysis's "Batch 1 → Batch 2 → Batch 3" mapping
(from
`validation/cascade-analysis/2026-05-24-linchpin-cascade.md`) is
compatible with the existing spec's task structure but the
existing spec's task ordering may differ. Dev should follow the
existing spec's task graph (53 tasks across 5 capabilities), and
use the cascade-analysis diagnostic queries as the per-task
verification harness.

In particular, the existing spec's point 4 (cross-vessel
composition_chain propagation) likely lands BEFORE goal-host-vessel
is operational. The cascade-analysis prediction is that this
single fix alone may unblock F-038, F-037, F-028, and parts of
F-024 — meaning the cascade can resolve through the existing
in-place infrastructure before the full vessel decomposition
completes.

## What I would NOT do

- Draft a new openspec change duplicating substrate-explicit-vessels.
  (Did this, recognized the redundancy, removed it.)
- Propose alternative naming or ports for the new vessels. The
  existing spec's choices (8210/8220/8230/8240/8250) are fine.
- Propose splitting local-tools-vessel into four (shell-vessel,
  filesystem-vessel, editor-vessel, git-vessel). The existing
  spec keeps them as one with separate shape advertisement —
  simpler, just as functional. The four-way split was the audit's
  initial impulse; the existing spec's one-vessel approach is
  cleaner because it matches how the resolvers cluster in
  minibob's source today.

## Authorship boundary

This document is observational: it cross-references existing
spec work with audit findings. The audit role does not propose
spec work directly; it observes substrate state and (here) maps
its observations to existing specs the operator can act on.

The auditor's contribution to the decomposition cycle:
- `validation/investigations/` — runtime evidence of each
  cascade finding.
- `validation/cascade-analysis/2026-05-24-linchpin-cascade.md` —
  diagnostic queries dev can run to verify each layer.
- This cross-reference — confirmation that the structural answer
  is already specified.

Dev decides what to build; the audit observes the build's
verification surface.
