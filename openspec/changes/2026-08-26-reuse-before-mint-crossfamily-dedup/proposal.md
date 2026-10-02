# Reuse-before-mint: cross-family producer-existence dedup

## Why

Law 3 (reuse before mint) is violated at scale by the self-development authoring
path. Measured live 2026-08-25: the shape `activityExecutionSummary` is served by
**15+ near-duplicate producers** (`audit_debug_generalize_execution_summary_v3 / v4 /
v5 / v5_improved / v5_hardened / …`), several re-minted seconds apart, all
`metrics: null` (dormant, never earned). Each clone splits the sparse graded
evidence a posterior needs to concentrate, and clutters the reachable-but-unlearned
frontier.

**Root cause — the cap exists on the wrong axis.** `activity-api/src/services/
variant-creator.ts` `createVariant` already caps variants at **5 per parent**
(`variantCount >= 5` on `variant_of = $parent_id`, line ~272). But the clones are
tagged `variant.authored.template.mitosis` — they are authored via the
**compose → vessel_mitosis_cutover** path, which mints a *new top-level template*
rather than a `variant_of` child. So the per-parent cap never sees them, and there is
**no cross-family check** for "does an existing template already produce this output
shape with a similar name/description?" before authoring.

This is cross-cutting: there is no single template-write chokepoint (the mint paths
are `activity_create_variant` in development-vessel, `createVariant` in activity-api,
and mitosis authoring), so the fix is a shared guard, not a one-line edit — hence a
spec rather than a blind edit into the self-development core.

## What changes

1. **A shared `producerExistsForShape(outputShapes, nameSimilarity)` check** in
   activity-api, queried before ANY template author/mint commits: refuse (or route to
   compose-with-existing) when ≥N dormant templates already advertise the same
   `output_shapes` and a name/description similarity above threshold.
2. **The compose→mitosis authoring path consults it** before cutover: if a live
   producer of the target output shape already exists, prefer a composition edge to it
   (which is what raises λ₁ — see `activity-create-variant.ts:774`) over minting a
   fresh uninformed cell.
3. **A one-time consolidation sweep** for the existing dormant clone families:
   retire all-but-the-canonical via the evidence-gated `_deprecate` path once any one
   accrues ≥10 samples, or via admin-scope for provably-dormant (0-sample) duplicates.

## Verification

- Producer count for `activityExecutionSummary` (and other clone families) drops and
  stops growing; `reachable_unlearned_report` no longer lists 15+ producers for one
  shape.
- A dispatch that would previously mint a duplicate instead composes with the existing
  producer (trace shows a composition edge, not a new `variant.authored` template).

## Scope / non-goals

- The existing per-parent cap (variant-creator, 5) is correct and unchanged.
- Dormant clones are low *active* harm (0 samples ⇒ not splitting live graded
  traffic); the harm this closes is *future* sprawl and frontier clutter.
- Not a change to Thompson selection or credit assignment.

## Status

Filed as the resolution of gap `variant-sprawl-splits-selection-evidence`. Operator
direct implementation deferred to this spec because the fix is cross-cutting into the
self-development authoring core, where a blind edit risks breaking legitimate variant
authoring — exactly the harmful-intervention class the operator role resists. The
easy path (variant-creator per-parent cap) is already guarded; the clones are dormant.
