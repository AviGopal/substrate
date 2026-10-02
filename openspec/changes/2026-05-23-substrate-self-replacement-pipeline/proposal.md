# Proposal: Substrate Self-Replacement Pipeline

## Why

The substrate's audit (per `clients/`, archived `repos/`, and CLAUDE.md
acknowledgements) has identified two load-bearing vessels with
documented purity gaps:

- `metabob-activity-api` carries ~20 legacy REST endpoints alongside
  its `/v2/impulses/resolve` dispatch — the prototypical
  "universal resolver" anti-pattern the foundation warns against.
- `minibob` implements its `bash`, `read`, `write`, `edit`, `git`
  tools as built-ins rather than as discovery-resolved vessels —
  violating the "resolvers live where data lives" idiom.

The substrate already has every primitive required to fix this
without operator-led refactoring: `forge-vessel-for-shape` (Phase 22),
`external-resolver-vesselization` (the trace-driven onboarding pattern,
sibling to this change), the discovery-vessel `provisional` flag, and
the signal-confidence-weighting trust surface.

What is missing is the **internal** counterpart to
`external-resolver-vesselization`: a pipeline that takes an internal
substrate vessel, audits its purity against the canonical idiom set,
mints a replacement via the forge, validates it in shadow against
live traffic, promotes it on evidence, and archives the original. The
external pipeline reads traces of calls *leaving* the substrate; the
internal pipeline reads the substrate's own vessel registry and its
internal trace store.

Once shipped, this pipeline becomes the substrate's continual
maintenance loop. Vessels age, idioms evolve, purity gaps emerge —
and the substrate refactors itself via replacement rather than
in-place edit. Auditing a pure vessel is a cheap seven-item check;
auditing a mixed vessel is judgment-laden and expensive. The pipeline
is what keeps audit costs bounded over time and what makes the
substrate honestly self-maintaining.

Additionally, external organizational conditions require moving core
substrate components out of the `MetabobProject` GitHub organization
and out of the `metabob-*` / `*bob` naming scheme. For the present
period, new vessels live under the `AviGopal` individual GitHub
account, with npm scope `@avigopal/<vessel-name>` and **no project
prefix** in vessel names (e.g. `activity-vessel`, `shell-vessel`).
This naming and org migration is bundled into the replacement work
because produced-during-replacement is the cheapest moment to
restamp a vessel — there is no second migration step to plan for.

## Self-application

This pipeline is itself a catalog of activities subject to the same
disciplines as every other substrate mechanism:

- **Foundation alignment.** The five pipeline activities are
  expressed entirely in the four-primitive model (impulses,
  activities, vessels, traces). The audit step reads traces and
  registry records; the draft step composes the existing forge
  pipeline; the shadow step is parallel dispatch; the promotion step
  is a discovery-vessel PATCH; the archive step is filesystem and
  registry hygiene. No new primitive is introduced.
- **Closure.** The entire pipeline is substrate-resident.
  `closure-audit --without=operator-shell` MUST cover audit → draft →
  shadow → promote → archive without operator intervention except
  the operator's final approval gate before atomic swap (R6.3).
- **Confidence weighting.** Replacement vessels enter discovery under
  `provisional: true`, with `signal_confidence_weight ≤ 0.7` until
  the promotion threshold clears (per signal-confidence-weighting
  defaults). The shadow-validate stage is the evidence-accumulation
  window.
- **Thompson-managed selection.** Once promoted, replacement vessels
  compete on equal footing under Thompson sampling. The pipeline
  itself accumulates α/β: a successful replacement increments the
  pipeline's posterior; a failed shadow validation decrements it
  and surfaces the failure-mode for analysis.
- **Self-replacement is itself replaceable.** The pipeline activities
  are themselves vessels' shapes. The ribosome can extract patterns
  across replacement runs and propose higher-order replacement
  templates. The recursion bottoms out at the four primitives.

## What changes

Five seed templates in `development-vessel`, composing into one
pipeline:

1. **`audit-vessel-purity`** — given a `vessel_id`, checks the vessel
   against the seven-item purity checklist (R1). Reads
   discovery-vessel registration, source-tree structure (via
   `fs_read`), and recent trace signatures. Emits a
   `vesselPurityReport` impulse listing each gap with severity and
   an inferable replacement scope.

2. **`draft-replacement-vessel`** — given a `vesselPurityReport`,
   dispatches the existing `forge-vessel-for-shape` pipeline with
   the original vessel's advertised shapes as the contract to
   satisfy. The scaffold is generated under a new name in the
   `AviGopal` GitHub namespace with `@avigopal/<name>` npm scope and
   no `metabob-` or `*bob` prefix. Emits a `replacementScaffold`
   impulse.

3. **`shadow-validate-replacement`** — runs the new vessel alongside
   the old. Every resolve dispatched to the old also hits the new;
   responses are compared by shape and (where deterministic) by
   body. Divergence is recorded as `shadowDivergence` impulses. The
   replacement enters discovery under `provisional: true`; the old
   continues to serve live traffic. The stage runs until the
   divergence rate over N traces clears the threshold or the budget
   exhausts.

4. **`promote-replacement`** — when divergence rate ≤
   `max_divergence_rate` (default 0.01) over `min_shadow_traces`
   (default 200) and the new vessel clears the standard
   `promote-vessel` criterion, performs an atomic discovery-vessel
   swap: the new vessel becomes the shape's resolver-of-record; the
   old is deregistered. Emits `replacementPromotion`. This step has
   an operator-approval gate by default; an automated mode is
   available with explicit config and increased shadow-window size.

5. **`archive-vessel`** — moves the old vessel's source under
   `repos/archive/<name>-<YYYY-MM-DD>/`, removes from build
   manifests, leaves the discovery-vessel record in a frozen
   `archived` state for audit history. Emits `vesselArchive`.

Plus one canary application bundled into this change:

- **C.1 — Tool-vessel decomposition.** The first end-to-end
  application of the pipeline. Replaces minibob's built-in `bash`,
  `read`, `write`, `edit`, `git` tools with five discovery-resolved
  vessels (`shell-vessel`, `filesystem-vessel`, `editor-vessel`,
  `git-vessel`; the small `read`/`write` operations roll into
  `filesystem-vessel`). Once promoted, minibob source loses ~500 LOC
  of built-in implementation and routes tool invocations through
  discovery.

C.2 (`activity-vessel` replacement of `metabob-activity-api`) and C.3
(`goal-vessel` replacement of minibob's orchestration layer) are
**downstream changes** consuming this pipeline. They are not in this
spec's scope. C.1 is the canary because its contracts are small,
well-known, and the divergence oracle (compare new-vessel output
against the existing built-in) is exact.

## Success criteria

1. **Pipeline operational**: all five seed templates exist in
   `development-vessel`, validate via `bun run cli seed-templates`,
   and each has per-template unit tests (R8).
2. **Audit operational**: `audit-vessel-purity` produces a
   `vesselPurityReport` for at least three Tier 1+2 vessels
   (discovery-vessel, identity-vessel, activity-api). The report's
   gap list aligns with the known purity findings in CLAUDE.md.
3. **C.1 canary green**: the pipeline mints `shell-vessel`,
   `filesystem-vessel`, `editor-vessel`, `git-vessel`; each clears
   shadow validation against minibob's existing built-in
   implementation with divergence rate ≤ 0.01 over ≥ 200 traces.
4. **Promotion executed**: operator approves; discovery-vessel
   atomically swaps shape ownership; minibob's built-in
   implementations are no longer the producer-of-record.
5. **Archive clean**: archived built-ins live under
   `repos/archive/minibob-builtins-<date>/`; minibob source removes
   the corresponding files; `bun test` in minibob passes.
6. **Closure**: `closure-audit --without=operator-shell` reports
   zero failures for the audit → draft → shadow stages, and one
   *expected* failure for the operator-approval gate in promotion
   (which is the audit's correct behavior; automated-mode promotion
   is a separate config).
7. **Naming and org**: every minted vessel's repository lives under
   `github.com/AviGopal/<vessel-name>`, npm scope
   `@avigopal/<vessel-name>`, no `metabob-` or `*bob` substring in
   any name, dependency, or README.

## Capabilities

### New Capabilities

- `substrate-self-replacement-pipeline` — the five-activity pipeline
  plus the new shapes (`vesselPurityReport`, `replacementScaffold`,
  `shadowDivergence`, `replacementPromotion`, `vesselArchive`).
  Spec: `specs/substrate-self-replacement-pipeline/spec.md`.

### Modified Capabilities

- `substrate-forge-vessel` is invoked unchanged by
  `draft-replacement-vessel`; the forge's existing template chain
  consumes a `vesselPurityReport`-derived contract instead of an
  `externalResolverContract`. The forge does not need to know which
  pipeline invoked it.
- `2026-05-23-external-resolver-vesselization` and this change are
  **siblings at the substrate-maintenance horizon** (`intent:
  substrate_maintenance`, sub-intents `external` and `internal`).
  Ribosome filtering at the maintenance horizon captures both
  siblings without privileging either.
- Vessel tiering (per the audit plan): the pipeline's audit step
  operates against Tier 1+2 vessels by default; Tier 4 vessels are
  candidates for acquisition via the external sibling, not this
  one.

## Dependencies

- `2026-05-23-substrate-forge-vessel` (committed) — provides
  `forge-vessel-for-shape` and the VesselForgeHost resolver set.
- `2026-05-23-signal-confidence-weighting` (committed) — provides
  the trust surface replacements inherit.
- `2026-05-23-external-resolver-vesselization` (in flight) — sibling
  pipeline; this change reuses its `provisional` registration field
  and `promote-vessel` criterion machinery.
- `2026-05-23-substrate-vessel-tiering` (proposed in audit plan,
  not yet drafted) — informally consumed: this pipeline audits
  Tier 1+2 vessels first. If tiering hasn't shipped, audit operates
  on an operator-supplied vessel list instead.
- `discovery-vessel` accepts atomic-swap PATCH semantics (current
  registry supports re-registration; whether atomic vs read-modify-write
  is one of the design questions in §H of design.md).

## Out of scope

- **C.2 (activity-vessel)** — replacement of `metabob-activity-api`.
  Substantial enough to warrant its own change after C.1 succeeds.
  This change ships the pipeline; the next change consumes it for
  C.2.
- **C.3 (goal-vessel)** — replacement of minibob's orchestration
  layer. Deferred until C.1 demonstrates the pipeline works on
  smaller scopes.
- **Automated promotion default.** This change defaults to operator
  approval on the swap step. Automated promotion is configurable but
  not the default; tightening that default is a follow-on after the
  pipeline has demonstrated stability over multiple runs.
- **Substrate-wide naming migration.** Only vessels minted by this
  pipeline use the `AviGopal` namespace. Existing `metabob-*`
  vessels keep their names until they are themselves replaced; the
  pipeline is the migration mechanism, not a parallel rename.
- **Federation-aware replacement.** A pipeline run targets one
  federation at a time (the local substrate). Cross-federation
  replacement (e.g., the canary should be promoted in two
  substrates simultaneously) is a separate concern under
  `2026-05-23-vessel-federation`.
- **Migration of the super-repo itself.** This proposal addresses
  vessel migrations; the super-repo's location (currently
  `MetabobProject/metabob-devbob`) is governed separately.

## IAL integration

This change belongs to the post-lift-acceleration family alongside:

- `forge-vessel` (Phase 22) — the forge primitive this pipeline
  consumes.
- `signal-confidence-weighting` — the trust mechanism replacement
  vessels inherit.
- `external-resolver-vesselization` — the sibling pipeline for
  externally-sourced vessels.
- `llm-resolver-model-mab` — orthogonal Thompson layer over LLM
  models; replacements that include LLM dispatch route through it.
- `cost-weighted-posteriors` — replacements compete with originals
  under cost-aware Thompson selection.

Together these five form the "substrate makes itself adept"
cluster: forging new vessels, weighting trust on their outputs,
absorbing external resolvers, and now replacing internal ones. This
change closes the missing piece — without it, the substrate can
acquire and mint, but cannot retire its own load-bearing
implementations.
