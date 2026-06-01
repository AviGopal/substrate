# Design — Obsidian meta-skill prototype

## 1. Framing

`obsidian-vessel` is the prototype substrate for the
**observe → act → observe → learn** loop. It is **not** a
perception-fidelity prototype. The goal is the meta-skill of authoring
activities from scratch from raw interaction traces, in a form that
transfers to display-vessel by swapping the IO layer (Obsidian
in-process API → OmniParser + computer-use peer vessel).

If the meta-skill converges in Obsidian, it transfers. If it fails to
converge in Obsidian — where ground truth is exact — the failure is
unambiguously in the authoring loop, not in perception. Validating in
Obsidian first decouples the two failure modes.

## 2. Why Obsidian specifically

- **In-process plugin API.** `repos/obsidian-vessel/` is already an
  Obsidian plugin. `app.workspace.on('editor-change', …)`,
  `app.vault.on('modify', …)`, and `app.commands.executeCommandById(id)`
  are available without an external CLI or REST hop. The substrate
  observes and acts on the same in-process API surface.
- **Latency-free, exact ground truth.** `editor-change` fires *exactly*
  when the editor changes. Display gives OmniParser-mediated noisy
  ground truth. Low-noise input means a failed convergence is the
  authoring loop's fault, not perception's.
- **Free reversibility-class training set.** Obsidian commands have
  well-known reversibility properties (text edits reversible via
  Ctrl-Z, file deletes soft-irreversible to trash, plugin disable hard-
  irreversible within the current session). The substrate can build a
  learned reversibility classifier on this known set before
  display-vessel needs one. Tie-in:
  `2026-05-31-display-control-extension` §`reversibility_class`.
- **Privacy boundary maps directly.** Vault `sync_root` is the analog
  of the display peer-vessel tmpfs frame-storage region. Denylist
  policy developed here transfers.

## 3. The current gap

`repos/development-vessel/src/seed/draft-gap-closing-activity.ts` is
the only substrate-side activity-authoring template today.

Concrete limitations, by line:

- `:35` — fixed resolver vocabulary baked into the drafter prompt
  (`fs_read, fs_write, llm_completion_dispatch, json_path_extract,
  http_fetch`). No vocabulary is computed from the registered
  resolver catalog.
- `:39` — input is a `validation/failure-modes/scenarios/<scenario_id>.json`
  file, written by hand.
- `:53` — `json_path_extract` ban is a static skeleton-rule.
- `:86-114` — 4-task skeleton (read scenario → fetch traces → analyse
  → write report). All authored activities have this shape.
- `:107-111` — output shape is filled by substitution from
  `expected_emergence.activity_signature.output_shapes_must_include`.
  The drafter does not declare its own shapes.

The drafter is a substitution engine, not a synthesis engine. It
cannot author from a raw observation stream because there is no input
slot for one, no prior over "this is a recurring pattern," and no
output-structure flexibility.

## 4. Scoping decision

Any composition of resolvers / sub-activities the executor can run is
a valid authored activity. There is **no structural constraint** — no
fixed skeleton, no task-count limit, no resolver-set restriction. The
substrate is allowed to author:

- **Interpretation activities** — pure functions over observations
  producing labelled impulses (Layer 2).
- **Action activities** — dispatch an Obsidian command, observe
  effect (Layer 4).
- **Prediction activities** — emit a predicted-next-event impulse
  (Layer 3).
- **Arbitrary compositions of those.**

The static-skeleton model from `draft-gap-closing-activity` is
abandoned for this drafter; the static drafter stays in place for
scenario-driven analytical work.

## 5. Layered abstraction hierarchy

| Layer | Content | Owner |
|---|---|---|
| 0 | Raw `obsidianEvent` impulses | Phase 1 infrastructure |
| 1 | `obsidianEpisode` windowing clusters | Phase 1 infrastructure |
| 2 | Intent classifications (`intentLabel`) | Substrate-authored |
| 3 | Trajectory predictors (`trajectoryPrediction`) | Substrate-authored |
| 4 | Composed assistance activities (`assistanceAction`) | Substrate-authored |

Layers 0–1 are shipped infrastructure. Layers 2–4 are what the
substrate is permitted to author from scratch. Each layer grounds in
the layer below via the trace store; no global ontology is required.

## 6. Verification asymmetry

| Activity class | Verification | Failure mode emitted on miss |
|---|---|---|
| Action | Prediction-matches-next-observation | `prediction_disagreement.action_no_effect` |
| Interpretation | Behavioural continuation falls in the consistency set of the inferred intent | `prediction_disagreement.intent_inconsistency` |
| Prediction | Sequence-match against the next-N observed events | `prediction_disagreement.trajectory_divergence` |

A new `prediction_disagreement` top-level failure mode lands alongside
the existing taxonomy (sibling of `verifier_negative`,
`budget_exhausted`, `safety_breach`, `cascading`, `user_abort`,
`consent_revoked`). Sub-cases above. See sibling spec
`2026-05-31-display-failure-mode-extensions` for the established
pattern of adding failure-mode subtypes; this proposal follows the
same shape.

## 7. The 7-activity bootstrap sequence

### 7.1 `observe-obsidian-events` (Phase 1, deterministic, no LLM)

Workspace + vault hooks emit `obsidianEvent` impulses. Event kinds
include `editor-change`, `file-open`, `file-modify`, `file-delete`,
`active-leaf-change`, `command-executed`. Each event carries
`{ kind, timestamp, sync_root_relative_path?, command_id?, payload_hash }`.
Raw payloads (text contents, file bodies) never enter the trace store
directly; only hashes.

### 7.2 `group-interaction-episodes` (Phase 1, deterministic)

Windowing resolver. Output: `obsidianEpisode { event_ids[],
sorted_unique_class_signature, window_start, window_end,
sync_root_scope }`. Episode windows are time-bounded (default 60s, no
event for ≥ 5s closes) with a hard event-count cap.

### 7.3 `probe-obsidian-action-effects` (Phase 1)

The "understand how Obsidian works" capability. Substrate experiments
with available `app.commands` ids in sandbox states (a probe vault, not
the operator's), observes pre/post deltas, and builds one
`actionEffectModel { command_id, pre_signature, post_signature_distribution,
reversibility_class, observation_count }` impulse per command. Feeds
the drafter at §7.5 as part of the action vocabulary.

This is the Obsidian analog of `displayObjectDetection` model
discovery; differs in that the action surface is finite and
enumerable.

### 7.4 `detect-recurring-pattern` (Phase 3)

Recognises recurring patterns at **any** layer, not just Layer 1.
Inputs: trace-store query. Outputs: `recurringPatternCluster
{ pattern_id, layer, observation_signature_set, n_occurrences,
contrast_examples, span }`. Triggers `draft-activity-from-pattern`
when `n_occurrences ≥ threshold` (default 5).

### 7.5 `draft-activity-from-pattern` (Phase 2, the new general drafter)

Inputs:

- `recurringPatternCluster` (the trigger).
- Resolver vocabulary (every registered resolver's input/output shape
  contract, surfaced as available verbs).
- Activity vocabulary (every registered activity as a candidate
  compose target, ranked by **composability fit** — overlap between
  the activity's `outputShapes` and the pattern's observation
  signature — NOT by Thompson α).
- `actionEffectModel` impulses for any commands the drafter may use.
- Contrast pairs (traces where the pattern occurred AND traces where
  a similar prefix produced a different outcome). Without contrast,
  the LLM over-generalises.

Output: a candidate activity template with arbitrary structure (single
task / multi-task / composed / iterative / branching). Declares its
own `inputShapes` and `outputShapes`.

**Drafter is iterative** because context budget forces it. Step 1:
prune the resolver and activity vocabulary against the pattern
(LLM call against pruned summaries). Step 2: draft against the pruned
set. `markdown_split_sections` (existing resolver) does the slicing.

### 7.6 `predict-and-verify` (Phase 3)

Wraps a candidate activity in a verification harness routed by activity
class (§6). On miss, emits `prediction_disagreement` with the relevant
sub-case.

### 7.7 `refine-on-disagreement` (Phase 3)

Variant authorship from disagreement traces. Closes the loop into the
existing Thompson posterior machinery — variants are scored against
the parent via `propagateCreditAlongChain`
(`posterior-update.ts:386-392`).

## 8. Comprehensibility discipline

Load-bearing because the maintenance pipeline IS LLMs reading other
LLMs' output. Operative discipline is **LLM-comprehensibility**;
human-readability is a free bonus given the discipline.

Hard requirements enforced by the drafter prompt (not nice-to-haves):

- **Self-describing names** — shape names, template ids, task ids.
- **Substantive descriptions** — every activity, every task, every
  output-shape rationale.
- **Citations to substrate knowledge** — when activities build on
  concept-db priors, the activity references specific `concept_id`s.
  Reference example: `service_oom_cascade_scan` cites
  `concept_RYl73llSCGfc`, `concept_6RwK5H5F28hT`, etc. in its
  summary.
- **Explicit composition rationales** — when activity B compose-
  dispatches activity A, B's task description says *why A
  specifically* (essential / replaceable / accidental).
- **Provenance markers** — `authored_from_pattern: { pattern_id,
  observation_window, contrast_examples }` metadata on every
  authored template.

The drafter prompt enforces all five with worked examples in the
prompt body.

## 9. `comprehensibility_check` resolver

Sibling of `convergent_validity_check` from iter-088. Same pattern
(cheap pre-runtime LLM verification):

1. Read the newly-authored template.
2. Hand a second LLM the template and ask: *"What does this do? Why
   might it have been authored? What would have to be true for it to
   be useful?"* — with **no other context**.
3. Compare the LLM's reading against the activity's self-description.
4. Emit `comprehensibility_score { score, reasoning_diff }`.
5. Auto-promote refuses templates below floor.
6. Periodically re-check with a **second model provider** to detect
   model-specific bait (a template phrased to be comprehensible only
   to the model that authored it).

## 10. Drafter prompt changes for permissive scope

- **Resolver vocabulary** surfaced as available verbs, with
  input/output shape contract.
- **Activity vocabulary** ranked by composability fit, NOT Thompson α.
  The selection-side ranking is a separate concern; for *authoring*,
  the drafter needs all candidates that could plausibly compose,
  ordered by structural fit.
- **Contrast pairs** are mandatory — pattern-occurred AND
  similar-prefix-different-outcome traces. Without contrast, the LLM
  over-generalises.
- **Information-density management** — drafter is an iterative chain
  (prune vocabulary → draft against pruned set). Existing
  `markdown_split_sections` resolver does the slicing.

## 11. Permissive-scope risks and mitigations

| Risk | Mitigation |
|---|---|
| Infinite-loop compositions | `max_composition_depth` budget on `ExecuteOptions` extends existing depth=16 safety from `parent_execution_id` walks. |
| Unsatisfiable `inputShapes` | Registration-time check: every declared `inputShape` must have at least one known producer or be marked `seedable`. |
| Output-shape misalignment | `convergent_validity_check` (iter-088) must run on every newly-authored activity at least once before promotion. |
| Compose references to non-existent activities | Validate at registration time. |
| Misaligned-with-reality (executes, declares matching shapes, but interpretation is wrong) | Caught only by the prediction-disagreement loop. No static check exists. |

Validation moves from static skeleton rules (the gap-closing
validator's `json_path_extract` ban etc.) to dynamic behavioural
consistency. The static validator is the wrong tool for permissive
scope.

## 12. The transfer test (success metric)

The substrate identifies a recurring `(observation_signature,
action_signature, post_observation_signature)` triple from a raw
event stream, mints a candidate activity whose structure (single-task
/ multi-task / composed / iterative / branching) was chosen to fit
the observed pattern, declares its own `inputShapes` and
`outputShapes`, and the activity's Thompson posterior beats
uniform-random on next-occurrence prediction — with **no
operator-curated scenario JSON anywhere**.

Subsidiary properties:

- **Authoring-without-scenario.** The input to the drafter is a
  `recurringPatternCluster` mined from the trace stream, not a hand-
  written scenario file.
- **Signature stability across noise levels.** The same coarse-
  projection function works in Obsidian (low noise) and display
  (high noise). This is the cross-domain transfer invariant.
- **Prediction-disagreement closes the loop autonomously.** Variants
  are authored from disagreement traces without operator nudge.

## 13. First observable milestone

The substrate authors its **first interpretation activity (Layer 2)**
— one that consumes observations and produces a labelled intent
impulse, with no operator-curated scenario, where the label is
validated by behavioural continuation. That is when the meta-skill is
real.

## 14. Open questions for operator decision

These are decisions the operator should make before Phase 2 starts:

1. **Single-action vs multi-action `interactionTriple`.** Design as
   multi-action by default. Display requires it. Cost: a slightly
   wider shape on day one.
2. **Ground-truth source.** Prediction accuracy + Thompson dominance
   alone, OR an operator-feedback channel? Resolution: operator-
   feedback is *optional* and MUST NOT be required, because display
   has no analog. Obsidian may expose it as an opt-in for faster
   convergence on the prototype.
3. **Denylist policy for vault content entering concept-db.** Paths
   and document contents are PII-adjacent. Denylist mirrors the
   `2026-05-31-display-perception-vessel` Phase C tiering: raw
   content denied, aggregate summaries allowed.
4. **n=0 hard gate in Obsidian.** Install a synthetic operator-
   confirmation step per first-time signature so the gate's UX is
   exercised on the low-noise corpus before display ships. Analog of
   the gate in `2026-05-31-display-control-extension`.
5. **Lifetime of the Obsidian sandbox.** Permanent ongoing calibration
   corpus, NOT scaffolding to remove. The Obsidian channel becomes
   the substrate's continuous low-noise control surface for the
   meta-skill.
6. **Human-readability vs LLM-comprehensibility.** Resolution:
   LLM-comprehensibility is the operative discipline because the
   maintenance pipeline IS LLM-mediated; human inspectability is a
   free bonus given the discipline. No separate human-readability
   gate.

## Related openspecs

- `2026-05-30-obsidian-vessel-concept-db-frontend/` — vessel's
  concept-db client surface.
- `2026-05-30-trace-to-concept-mining/` — supplies the contrast-pair
  read path.
- `2026-05-30-info-gain-bonus-on-success/` — success-discount
  composed against by the prediction-disagreement loop.
- `2026-05-31-display-perception-vessel/` — channel this prototype
  generalises to; denylist tiering shared.
- `2026-05-31-display-control-extension/` — reversibility-class
  methodology shared.
- `2026-05-31-display-signature-partitioning/` — partition machinery
  the meta-skill will consume once display ships; not consumed in
  Obsidian.
- `2026-05-31-display-failure-mode-extensions/` — pattern for adding
  failure-mode subtypes; followed here for
  `prediction_disagreement`.
