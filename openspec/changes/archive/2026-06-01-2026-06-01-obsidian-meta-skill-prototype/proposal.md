# Obsidian meta-skill prototype (authoring activities from raw interaction traces)

## Why

The substrate has one activity-authoring template today —
`repos/development-vessel/src/seed/draft-gap-closing-activity.ts` — and
it is a **substitution engine**, not a synthesis engine. It fills
`<scenario_id>` and `<output_shape_name>` into a fixed 4-task skeleton
keyed on an operator-curated `validation/failure-modes/scenarios/*.json`
file (`draft-gap-closing-activity.ts:35-114`). The drafter has no prior
over "this is a recurring interaction pattern," consumes no observation
stream, and produces only analytical-report activities — no actions, no
closed-loop verification. The static guardrails in the template
(`json_path_extract` ban at `:53`, fixed resolver vocabulary at `:35`)
are skeleton-rules, not behavioural rules: they constrain what a human
operator would have written by hand, not what the substrate could
learn from the trace stream.

**The capability the substrate cannot do today, and that this proposal
adds:** author an activity from scratch from raw observation traces —
choose its structure (single-task / multi-task / composed / iterative /
branching), declare its own `inputShapes` and `outputShapes`, ground in
substrate concept-graph priors, and close the loop via behavioural
prediction-matching rather than static validators.

The sibling `2026-05-31-display-perception-vessel` will eventually need
exactly this capability: a substrate that has seen a few hundred hours
of a noisy observation stream and can mint a candidate
"recognise-this-pattern" or "respond-to-this-pattern" activity without
operator-written scenarios. Validating the meta-skill on the display
channel first means failure to converge is ambiguous between the
perception layer and the authoring layer.

**Obsidian is the right prototype substrate for this skill** because
the vessel (`repos/obsidian-vessel/`) already exposes the Obsidian
plugin API in-process — Workspace events, Vault events, and
`app.commands.executeCommandById(...)` — so the observation and action
channels are latency-free and ground-truth-perfect. The Obsidian
command catalog also gives the substrate a free reversibility-class
training set (text edits reversible via Ctrl-Z, file deletes
soft-irreversible to trash, plugin disables hard-irreversible relative
to the current session). The privacy boundary maps directly to display:
the vault `sync_root` convention is the analog of the peer-vessel
tmpfs frame-storage region.

If the meta-skill works in Obsidian, it transfers to display by
swapping the IO layer. If it does not work in Obsidian — where ground
truth is exact and reversibility is well-typed — it will not work in
display, and the problem is the authoring loop, not perception.

## What changes

### Layered observation hierarchy (Layers 0-1 ship; Layers 2-4 substrate-authored)

| Layer | Content | Owner |
|---|---|---|
| 0 | Raw `obsidianEvent` impulses (workspace + vault hooks) | Phase 1 infrastructure |
| 1 | `obsidianEpisode` windowing clusters | Phase 1 infrastructure |
| 2 | Intent classifications (labelled-intent impulses) | Substrate-authored interpretation activities |
| 3 | Trajectory predictors (next-event predictions) | Substrate-authored prediction activities |
| 4 | Composed assistance activities (action + verification) | Substrate-authored action chains |

Each layer grounds in the layer below it via the trace store; no global
ontology is required, and the substrate is free to compose across
layers.

### 7-activity bootstrap sequence

1. **`observe-obsidian-events`** (Phase 1, deterministic) — workspace +
   vault hooks emit `obsidianEvent` impulses (Layer 0).
2. **`group-interaction-episodes`** (Phase 1, deterministic) —
   windowing resolver, emits `obsidianEpisode` with sorted-unique class
   signature (Layer 1).
3. **`probe-obsidian-action-effects`** (Phase 1) — substrate
   experiments with available commands in sandbox states, observes
   deltas, builds `actionEffectModel` impulse per command. This is the
   "understand how Obsidian works" capability.
4. **`detect-recurring-pattern`** (Phase 3) — recognises recurring
   patterns at any layer (not just Layer 1); triggers the drafter on
   threshold breach.
5. **`draft-activity-from-pattern`** (Phase 2) — general drafter.
   Receives pattern cluster + resolver vocabulary + activity vocabulary
   + `actionEffectModel` + contrast examples. Authors
   arbitrary-structure activities (no skeleton). Layer 2+ output.
6. **`predict-and-verify`** (Phase 3) — verification routing on
   activity type (action / interpretation / prediction). Emits
   `prediction_disagreement` on miss.
7. **`refine-on-disagreement`** (Phase 3) — authors a variant from
   disagreement traces; closes the loop into existing Thompson
   posterior machinery.

### Comprehensibility discipline (load-bearing because maintenance is LLM-mediated)

- Self-describing names mandatory (shape names, template ids, task ids).
- Substantive description on every activity, every task, every output
  shape rationale.
- Citations to substrate knowledge — concept ids when activities build
  on concept-db priors. `service_oom_cascade_scan` is the reference
  example.
- Explicit composition rationales — when activity B compose-dispatches
  activity A, B's task description for the step must say *why A
  specifically* (essential / replaceable / accidental).
- Provenance metadata — `authored_from_pattern: { pattern_id,
  observation_window, contrast_examples }`.

A `comprehensibility_check` resolver (sibling of `convergent_validity_check`
from iter-088) reads a newly-authored template, has an LLM explain it
without other context, and compares against the activity's
self-description. Templates below the comprehensibility floor are
refused promotion. Periodic re-checks use a second model provider to
detect model-specific bait.

### Success metric — the transfer test

The substrate identifies a recurring `(observation_signature,
action_signature, post_observation_signature)` triple from a raw event
stream, mints a candidate activity whose structure was chosen to fit
the observed pattern, declares its own `inputShapes` and `outputShapes`,
and the activity's Thompson posterior beats uniform-random on
next-occurrence prediction — with no operator-curated scenario JSON
anywhere.

**First observable milestone:** the substrate authors its first
interpretation activity (Layer 2) consuming observations and producing
a labelled intent impulse, validated by behavioural continuation, with
no operator-curated scenario.

## Out of scope

- **Display perception, OmniParser, and any pixel-level capture** —
  `2026-05-31-display-perception-vessel`, `2026-05-31-display-vessel-host-peer`.
- **Display control / n=0 hard gate UX beyond a synthetic Obsidian
  analog** — `2026-05-31-display-control-extension`.
- **Signature partitioning machinery** —
  `2026-05-31-display-signature-partitioning`. The Obsidian prototype
  uses the existing default signature tier; partition pressure shows
  up first when display ships.
- **Cross-substrate federation of substrate-authored Obsidian
  activities** — `2026-05-31-substrate-fleet-federation`.
- **Replacing `draft-gap-closing-activity`** — it remains as the
  scenario-driven analytical drafter; this proposal adds an orthogonal
  general drafter.

## Dependencies

- **`2026-05-30-obsidian-vessel-concept-db-frontend`** — the Obsidian
  plugin's existing concept-db client surface; the meta-skill writes
  back authored-template provenance via the same channel.
- **`2026-05-30-trace-to-concept-mining`** — supplies the trace-history
  read path the drafter draws contrast examples from.
- **`2026-05-30-info-gain-bonus-on-success`** — the success-discount
  the prediction-disagreement loop composes against.
- **Existing `convergent_validity_check` resolver (iter-088)** — the
  comprehensibility check shares its pre-runtime LLM-verification
  scaffolding.
- **Existing `prediction_disagreement` failure-mode work** — this
  proposal adds the three sub-cases (`intent_inconsistency`,
  `trajectory_divergence`, `action_no_effect`) to the taxonomy.

## Risk

- **Permissive scope ↔ infinite-loop compositions.** Mitigation:
  `max_composition_depth` budget on `ExecuteOptions` extends the
  existing depth=16 safety from `parent_execution_id` walks.
- **Unsatisfiable `inputShapes` on authored templates.** Mitigation:
  registration-time check — every declared `inputShape` must have at
  least one known producer or be marked `seedable`.
- **Output-shape misalignment.** Mitigation: `convergent_validity_check`
  must run on every newly-authored activity at least once before
  promotion.
- **Compose references to non-existent activities.** Mitigation:
  validate at registration time.
- **Misaligned-with-reality activities** (executes, declares matching
  shapes, but interpretation is wrong). Caught only by the
  prediction-disagreement loop — no static check exists. Validation
  moves from static skeleton rules to dynamic behavioural consistency;
  the static validator is the wrong tool for permissive scope.
- **Drafter context-budget overrun** with full resolver + activity
  vocabulary. Mitigation: drafter is iterative (prune vocabulary
  first, draft against pruned set) rather than single-shot;
  `markdown_split_sections` exists and is used.

## Companion concepts

- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern` (the
  authoring-from-traces capability is this pattern's generalisation
  to operator interaction).
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate` (signature
  stability across noise levels is the cross-domain transfer
  invariant).
- `concept_RYl73llSCGfc` + `concept_6RwK5H5F28hT` (the
  `service_oom_cascade_scan` citation references) — exemplar of the
  comprehensibility discipline.

## Related openspecs

- `2026-05-30-obsidian-vessel-concept-db-frontend/` — the vessel's
  existing concept-db client.
- `2026-05-31-display-perception-vessel/` — the channel this proposal
  rehearses the meta-skill for.
- `2026-05-31-display-control-extension/` — the action sibling on the
  display channel; reversibility-class methodology is shared.
- `2026-05-31-display-signature-partitioning/` — partition machinery
  the meta-skill will consume once display ships.
