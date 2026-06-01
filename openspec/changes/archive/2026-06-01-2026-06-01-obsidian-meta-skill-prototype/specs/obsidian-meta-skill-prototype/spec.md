# Spec — obsidian-meta-skill-prototype

Formal capability specification for the dev-vessel to implement.
Resolver shapes, activity contracts, failure-mode subtypes. Code is
out of scope; this document fixes the contracts.

## ADDED Requirements

### Requirement: `obsidianEvent` impulse shape contract (Layer 0)

The `obsidianEvent` shape SHALL be the Layer-0 raw-event impulse emitted by the
observation activity. It captures one Obsidian editor/file/workspace event with
sanitised metadata only — no raw text content. `bridge_eligibility` SHALL be
`"deny"` so raw events never cross the bridge to learning storage.

```typescript
obsidianEvent = {
  event_id: string,                 // ulid
  kind:
    | "editor-change"
    | "file-open"
    | "file-create"
    | "file-modify"
    | "file-delete"
    | "file-rename"
    | "active-leaf-change"
    | "command-executed",
  timestamp: ISO8601,
  sync_root_relative_path?: string, // never absolute; never raw text
  command_id?: string,              // only when kind === "command-executed"
  payload_hash: string,             // sha256 of raw event payload
  bridge_eligibility: "deny"
}
```

#### Scenario: Valid command event accepted
- **WHEN** an `obsidianEvent` is written with `kind: "command-executed"`, a `command_id`, and `bridge_eligibility: "deny"`
- **THEN** the impulse-write path accepts it and the event is queryable in the Layer-0 pool

#### Scenario: Absolute path rejected
- **WHEN** an `obsidianEvent` is written with `sync_root_relative_path` containing an absolute (filesystem-rooted) path
- **THEN** the write is rejected with `verifier_negative.shape_contract_violation`

#### Scenario: bridge_eligibility other than "deny" rejected
- **WHEN** an `obsidianEvent` is written with `bridge_eligibility: "allow"`
- **THEN** the write is rejected — raw events SHALL NOT cross the bridge

### Requirement: `obsidianEpisode` impulse shape contract (Layer 1)

The `obsidianEpisode` shape SHALL group an ordered run of `obsidianEvent`s into
a single user-interaction episode, summarised by a sorted-unique class
signature suitable for cross-trace comparison.

```typescript
obsidianEpisode = {
  episode_id: string,
  event_ids: string[],                       // ordered
  sorted_unique_class_signature: string[],   // sorted set of event-kind + command-id tokens
  window_start: ISO8601,
  window_end: ISO8601,
  sync_root_scope: string,                   // top-level vault folder
  bridge_eligibility: "allow"
}
```

#### Scenario: Episode emitted with ordered event_ids
- **WHEN** `group-interaction-episodes` consumes N `obsidianEvent`s within a window and emits an `obsidianEpisode`
- **THEN** `event_ids` is ordered chronologically and `sorted_unique_class_signature` is a sorted, deduplicated set of `(kind, command_id?)` tokens

#### Scenario: Unsorted signature rejected
- **WHEN** an `obsidianEpisode` is written with `sorted_unique_class_signature` that is not sorted or contains duplicates
- **THEN** the write is rejected with `verifier_negative.shape_contract_violation`

### Requirement: `actionEffectModel` impulse shape contract

The `actionEffectModel` shape SHALL capture a learned model of what a given
Obsidian command does to vault+workspace state, including a probability
distribution over post-state signatures and a reversibility classification.
The reversibility-class vocabulary SHALL match
`2026-05-31-display-control-extension` exactly.

```typescript
actionEffectModel = {
  command_id: string,
  pre_signature: string,                     // signature of vault+workspace state
  post_signature_distribution: Array<{
    post_signature: string,
    probability: number
  }>,
  reversibility_class:
    | "reversible"
    | "soft_irreversible"
    | "hard_irreversible"
    | "unknown",
  observation_count: number,
  bridge_eligibility: "allow"
}
```

Reversibility classification is initially heuristic (text-edit →
reversible, file-delete → soft_irreversible, plugin-disable →
hard_irreversible) and is the seed corpus for a learned classifier.

#### Scenario: Probabilities sum to 1.0 within tolerance
- **WHEN** an `actionEffectModel` is written
- **THEN** the sum of `probability` across `post_signature_distribution` entries is within ±1e-6 of 1.0

#### Scenario: Out-of-vocabulary reversibility class rejected
- **WHEN** an `actionEffectModel` carries a `reversibility_class` not in the four-value vocabulary
- **THEN** the write is rejected

### Requirement: `recurringPatternCluster` impulse shape contract

The `recurringPatternCluster` shape SHALL be the drafter-input shape produced
by pattern miners across any of the four layers. Contrast examples are required
so the drafter can author a discriminating template rather than a tautological
one.

```typescript
recurringPatternCluster = {
  pattern_id: string,
  layer: 0 | 1 | 2 | 3,                      // which layer the pattern was mined at
  observation_signature_set: string[],       // sorted unique signatures across instances
  n_occurrences: number,
  contrast_examples: Array<{
    matched_prefix: string[],                // event signatures
    divergent_outcome: string                // signature of where the contrast trace went instead
  }>,
  span: { from: ISO8601, to: ISO8601 },
  bridge_eligibility: "allow"
}
```

#### Scenario: Cluster with no contrast examples rejected
- **WHEN** a `recurringPatternCluster` is written with `contrast_examples: []`
- **THEN** the write is rejected with `verifier_negative.shape_contract_violation` — drafters require contrast to author discriminating templates

#### Scenario: Layer value outside 0..3 rejected
- **WHEN** a `recurringPatternCluster` carries `layer: 4` or any value outside 0..3
- **THEN** the write is rejected

### Requirement: `authoredActivityCandidate` impulse shape contract

The `authoredActivityCandidate` shape SHALL be the drafter's output: a
foundation `ActivityTemplate` together with provenance, declared shape
contracts, cited concepts, per-composition-task rationales, and drafter
provenance metadata.

```typescript
authoredActivityCandidate = {
  candidate_id: string,
  template: ActivityTemplate,                // foundation activity template structure
  authored_from_pattern: {
    pattern_id: string,
    observation_window: { from: ISO8601, to: ISO8601 },
    contrast_examples: string[]              // pattern_ids of contrast clusters
  },
  declared_input_shapes: string[],
  declared_output_shapes: string[],
  cited_concept_ids: string[],
  composition_rationales: Record<string, {  // keyed on task_id
    referenced_activity_id: string,
    rationale_class: "essential" | "replaceable" | "accidental",
    rationale_text: string
  }>,
  drafter_provenance: {
    drafter_activity_id: string,             // the drafter that authored this
    model_id: string,
    pruned_vocab_size: number,
    contrast_pair_count: number
  },
  bridge_eligibility: "allow"
}
```

#### Scenario: Candidate accepted when all provenance fields populated
- **WHEN** an `authoredActivityCandidate` is written carrying non-empty `authored_from_pattern.pattern_id`, populated `composition_rationales` for every compose-dispatch task, and `drafter_provenance.contrast_pair_count > 0`
- **THEN** the candidate is accepted and queued for `predict-and-verify`

#### Scenario: Compose-dispatch task without rationale rejected
- **WHEN** an `authoredActivityCandidate` template contains a task that compose-dispatches another activity but `composition_rationales` lacks an entry for that task_id
- **THEN** the write is rejected with `verifier_negative.authoring_discipline_violation`

### Requirement: `intentLabel` impulse shape contract (Layer 2)

The `intentLabel` shape SHALL be the Layer-2 output: a free-form-within-bounded-class
label naming what the user appears to be doing across an episode, paired with a
consistency set that downstream verifiers can compare observed continuations
against.

```typescript
intentLabel = {
  intent_label: string,                      // free-form within bounded class
  intent_class_id?: string,                  // when classifier emits a known class
  source_episode_id: string,
  consistency_set: string[],                 // signatures of expected continuations
  confidence: number,
  bridge_eligibility: "allow"
}
```

#### Scenario: Label with non-existent source_episode_id rejected
- **WHEN** an `intentLabel` references a `source_episode_id` not present in the episode store
- **THEN** the write is rejected

#### Scenario: Empty consistency_set rejected
- **WHEN** an `intentLabel` carries `consistency_set: []`
- **THEN** the write is rejected — the verifier needs a non-empty expected-continuation set

### Requirement: `trajectoryPrediction` impulse shape contract (Layer 3)

The `trajectoryPrediction` shape SHALL be the Layer-3 output: a probability
distribution over predicted next observation signatures within a finite horizon.

```typescript
trajectoryPrediction = {
  prediction_id: string,
  source_observation_signature: string,
  predicted_next_signatures: Array<{
    signature: string,
    probability: number,
    horizon_events: number
  }>,
  predictor_template_id: string,
  bridge_eligibility: "allow"
}
```

#### Scenario: Prediction with zero horizon entries rejected
- **WHEN** a `trajectoryPrediction` is written with `predicted_next_signatures: []`
- **THEN** the write is rejected

#### Scenario: horizon_events non-positive rejected
- **WHEN** any entry in `predicted_next_signatures` carries `horizon_events <= 0`
- **THEN** the write is rejected

### Requirement: `assistanceAction` impulse shape contract (Layer 4)

The `assistanceAction` shape SHALL be the Layer-4 output: a concrete Obsidian
command dispatch with predicted post-state, pinned to a source pattern. The
`reversibility_class` field SHALL be one of the three classified
(non-`unknown`) values — Layer-4 actions SHALL NOT dispatch on unknown
reversibility.

```typescript
assistanceAction = {
  action_id: string,
  command_id: string,                        // Obsidian command dispatched
  pre_signature: string,
  expected_post_signature: string,           // what the activity predicted
  reversibility_class: "reversible" | "soft_irreversible" | "hard_irreversible",
  source_pattern_id: string,
  bridge_eligibility: "allow"
}
```

#### Scenario: Action with reversibility_class "unknown" rejected
- **WHEN** an `assistanceAction` is written with `reversibility_class: "unknown"`
- **THEN** the write is rejected

#### Scenario: source_pattern_id missing rejected
- **WHEN** an `assistanceAction` is written with empty `source_pattern_id`
- **THEN** the write is rejected — every action SHALL trace to a pattern

### Requirement: `comprehensibilityScore` impulse shape contract

The `comprehensibilityScore` shape SHALL be the comprehensibility-check
resolver's output: a 0..1 score, an evaluator model id, and a
`reasoning_diff` describing how the evaluator's reading differed from the
template's self-description.

```typescript
comprehensibilityScore = {
  template_id: string,
  score: number,                             // 0..1
  evaluator_model_id: string,
  reasoning_diff: string,                    // how the evaluator's reading differed from self-description
  evaluated_at: ISO8601,
  bridge_eligibility: "allow"
}
```

#### Scenario: Score outside 0..1 rejected
- **WHEN** a `comprehensibilityScore` is written with `score < 0` or `score > 1`
- **THEN** the write is rejected

#### Scenario: Same evaluator_model_id on consecutive re-checks rejected
- **WHEN** a periodic re-check writes a `comprehensibilityScore` for `template_id` T using the same `evaluator_model_id` as the most recent previous evaluation, when an alternative provider is available
- **THEN** the write is rejected — the re-check policy requires a different model provider

### Requirement: `observe-obsidian-events` activity contract

`observe-obsidian-events` SHALL be a shipped infrastructure activity with
`input_shapes: []` and `output_shapes: [obsidianEvent]`. It SHALL subscribe to
the Obsidian event surface and emit one `obsidianEvent` per observed event with
`bridge_eligibility: "deny"`.

#### Scenario: Activity emits one obsidianEvent per observed Obsidian event
- **WHEN** Obsidian fires a `command-executed` event with command id C
- **THEN** the activity emits one `obsidianEvent` with `kind: "command-executed"` and `command_id: C`

### Requirement: `group-interaction-episodes` activity contract

`group-interaction-episodes` SHALL be a shipped infrastructure activity with
`input_shapes: [obsidianEvent]` and `output_shapes: [obsidianEpisode]`. It SHALL
window `obsidianEvent`s into `obsidianEpisode`s by inactivity gap or workspace
boundary.

#### Scenario: Window closes on inactivity gap
- **WHEN** the activity has consumed events e1..eN and no event arrives for longer than the configured idle threshold
- **THEN** it emits one `obsidianEpisode` whose `event_ids = [e1..eN]` and `window_end` equals the timestamp of eN

### Requirement: `probe-obsidian-action-effects` activity contract

`probe-obsidian-action-effects` SHALL be a shipped infrastructure activity with
`input_shapes: [obsidianEpisode]` and `output_shapes: [actionEffectModel]`. It
SHALL extract `(pre_signature, command_id, post_signature)` triples from
episodes and accumulate them into per-command `actionEffectModel` distributions.

#### Scenario: First observation creates new model
- **WHEN** the activity observes the first `(pre, C, post)` triple for command C
- **THEN** it emits an `actionEffectModel` with `command_id: C`, `observation_count: 1`, and a single-entry `post_signature_distribution`

#### Scenario: Subsequent observation updates distribution
- **WHEN** the activity observes a second `(pre, C, post)` triple for command C
- **THEN** the emitted (or updated) `actionEffectModel` reflects `observation_count: 2` with re-normalised probabilities

### Requirement: `detect-recurring-pattern` activity contract

`detect-recurring-pattern` SHALL be a shipped infrastructure activity with
`input_shapes: [obsidianEpisode, intentLabel?, trajectoryPrediction?]` and
`output_shapes: [recurringPatternCluster]`. It SHALL emit clusters only when at
least one contrast example is available.

#### Scenario: Cluster with insufficient contrast suppressed
- **WHEN** the activity finds N occurrences of a candidate pattern but cannot identify any contrast trace
- **THEN** no `recurringPatternCluster` is emitted

### Requirement: `draft-activity-from-pattern` activity contract

`draft-activity-from-pattern` SHALL be a shipped infrastructure activity with
`input_shapes: [recurringPatternCluster, actionEffectModel, resolverVocabulary, activityVocabulary]`
and `output_shapes: [authoredActivityCandidate]`. The drafter SHALL satisfy the
authoring-discipline hard requirements before emission (see the
`Drafter authoring-discipline hard requirements` requirement).

#### Scenario: Candidate emitted only when discipline satisfied
- **WHEN** the drafter has authored a candidate satisfying all five authoring-discipline rules
- **THEN** one `authoredActivityCandidate` is emitted

#### Scenario: Discipline violation suppresses emission and emits failure mode
- **WHEN** the drafter's intermediate candidate is missing `composition_rationale` on a compose-dispatch task
- **THEN** no candidate is emitted and a `verifier_negative.authoring_discipline_violation` impulse is written

### Requirement: `predict-and-verify` activity contract

`predict-and-verify` SHALL be a shipped infrastructure activity with
`input_shapes: [authoredActivityCandidate, obsidianEpisode]` and
`output_shapes: [verifierResult, prediction_disagreement?]`. The verifier
SHALL be routed by the candidate's declared output-shape signature (see the
`Verifier routing by activity type` requirement).

#### Scenario: Verifier passes when observation matches prediction
- **WHEN** the candidate emits an `intentLabel` and the observed continuation signature is a member of `consistency_set`
- **THEN** a positive `verifierResult` is emitted and no `prediction_disagreement` is written

### Requirement: `refine-on-disagreement` activity contract

`refine-on-disagreement` SHALL be a shipped infrastructure activity with
`input_shapes: [prediction_disagreement, recurringPatternCluster]` and
`output_shapes: [authoredActivityCandidate]`. It SHALL author a refined
candidate that addresses the specific disagreement sub-case (intent,
trajectory, or action-no-effect).

#### Scenario: Action-no-effect disagreement triggers refinement
- **WHEN** a `prediction_disagreement` with `sub_case: "action_no_effect"` is written
- **THEN** `refine-on-disagreement` fires autonomously and emits a refined `authoredActivityCandidate`

### Requirement: Runtime-authored activities draw from the canonical shape vocabulary

Activities the substrate authors at runtime (Layers 2–4) SHALL consume
combinations of `obsidianEvent`, `obsidianEpisode`, `intentLabel`,
`trajectoryPrediction` and SHALL emit one of `intentLabel`,
`trajectoryPrediction`, `assistanceAction`. Newly-authored templates SHALL
declare `inputShapes` and `outputShapes` from this vocabulary or extend it;
declaring an undeclared shape SHALL emit a `seedable: true` marker and
a registration-time check SHALL fire.

#### Scenario: New shape declared with seedable marker
- **WHEN** a candidate declares an `outputShape` not present in the vocabulary
- **THEN** the registration emits a `seedable: true` marker and the registration-time check evaluates whether the new shape is admissible

### Requirement: `prediction_disagreement` failure-mode taxonomy

A new top-level `failure_mode.type` value `prediction_disagreement` SHALL be
added alongside `verifier_negative`, `budget_exhausted`, `safety_breach`,
`cascading`, `user_abort`, `consent_revoked`. The discriminated `context`
payload SHALL be one of three sub-cases:

```typescript
failure_mode = {
  type: "prediction_disagreement",
  reason: string,
  context:
    | {
        sub_case: "intent_inconsistency",
        intent_label: string,
        consistency_set: string[],
        observed_continuation_signature: string
      }
    | {
        sub_case: "trajectory_divergence",
        predicted_signatures: string[],
        observed_signature: string,
        horizon_events: number
      }
    | {
        sub_case: "action_no_effect",
        command_id: string,
        pre_signature: string,
        post_signature: string,              // identical to pre_signature in the no-op case
        expected_post_signature: string
      }
}
```

#### Scenario: intent_inconsistency context populated
- **WHEN** an observed continuation signature is not in the `consistency_set` of an active `intentLabel`
- **THEN** a `prediction_disagreement` failure-mode impulse is written with `sub_case: "intent_inconsistency"` and the three context fields populated

#### Scenario: trajectory_divergence context populated
- **WHEN** the observed next-N event signature is not among `predicted_next_signatures` within the declared horizon
- **THEN** a `prediction_disagreement` failure-mode impulse is written with `sub_case: "trajectory_divergence"`

#### Scenario: action_no_effect context populated
- **WHEN** an `assistanceAction` dispatches command C and the observed post-state signature equals the pre-state signature (no change)
- **THEN** a `prediction_disagreement` failure-mode impulse is written with `sub_case: "action_no_effect"` and `post_signature == pre_signature`

### Requirement: `prediction_disagreement` posterior treatment

Posterior treatment of `prediction_disagreement` sub-cases SHALL mirror the
`confidence_tier` scaling in
`2026-05-31-display-failure-mode-extensions`:
`action_no_effect` = full β=1 (action confidently dispatched, world did not
change); `intent_inconsistency` and `trajectory_divergence` = β=0.5 (the
substrate produced a guess and the guess was wrong, but the action surface
did not misfire).

#### Scenario: action_no_effect updates β by 1.0
- **WHEN** an `assistanceAction` produces a `prediction_disagreement.action_no_effect`
- **THEN** the variant's β increases by 1.0

#### Scenario: trajectory_divergence updates β by 0.5
- **WHEN** a `trajectoryPrediction` produces a `prediction_disagreement.trajectory_divergence`
- **THEN** the variant's β increases by 0.5

### Requirement: Verifier routing by activity type

`predict-and-verify` SHALL route by output-shape signature on the
authored candidate. When the candidate declares multiple verifiable
output shapes, all applicable verifiers SHALL run and a logical
AND-conjunction SHALL govern promotion.

| Authored output shape includes | Routes to |
|---|---|
| `intentLabel` | Behavioural-continuation verifier — observed continuation in `consistency_set` ⇒ pass |
| `trajectoryPrediction` | Sequence-match verifier — observed next-N events match `predicted_next_signatures` within horizon ⇒ pass |
| `assistanceAction` | State-change verifier — observed post-action signature matches `expected_post_signature` ⇒ pass |
| Multiple | All applicable verifiers run; AND-conjunction for promotion |

#### Scenario: intentLabel candidate routes to behavioural-continuation verifier
- **WHEN** a candidate's `declared_output_shapes` contains `intentLabel`
- **THEN** the behavioural-continuation verifier fires and the sequence-match and state-change verifiers do not

#### Scenario: Mixed candidate requires all verifiers to pass
- **WHEN** a candidate's `declared_output_shapes` contains both `intentLabel` and `assistanceAction`
- **THEN** both verifiers run; promotion proceeds only if both pass

### Requirement: Registration-time invariant — input shapes have producers or are seedable

Every declared `inputShape` on a registered template SHALL have at least one
known producer in the activity vocabulary, OR SHALL be marked
`seedable: true`. Violation SHALL emit a
`verifier_negative.activity_registration_invariant` impulse and the
registration SHALL be rejected.

#### Scenario: Input shape without producer accepted when seedable
- **WHEN** a template declares an `inputShape` with no producer and carries `seedable: true` for that shape
- **THEN** registration succeeds

#### Scenario: Input shape without producer and not seedable rejected
- **WHEN** a template declares an `inputShape` with no producer and no `seedable: true` marker
- **THEN** registration is rejected with `verifier_negative.activity_registration_invariant`

### Requirement: Registration-time invariant — compose-dispatch references resolve

Every compose-dispatch reference within a registered template SHALL resolve to
an existing activity id at registration time.

#### Scenario: Dangling compose-dispatch reference rejected
- **WHEN** a template registers a task that compose-dispatches `activity_id: X` and no such activity exists
- **THEN** registration is rejected with `verifier_negative.activity_registration_invariant`

### Requirement: Registration-time invariant — max composition depth ≤ 16

`max_composition_depth` SHALL be ≤ 16, extending the existing
`parent_execution_id` walk safety.

#### Scenario: Depth above 16 rejected
- **WHEN** a template registers with `max_composition_depth: 17`
- **THEN** registration is rejected

### Requirement: Registration-time invariant — authored_from_pattern resolves

`authored_from_pattern.pattern_id` SHALL resolve to a stored
`recurringPatternCluster` at registration time.

#### Scenario: Dangling pattern_id rejected
- **WHEN** an `authoredActivityCandidate` is registered with `authored_from_pattern.pattern_id: P` and no cluster P exists
- **THEN** registration is rejected

### Requirement: Registration-time invariant — comprehensibility floor

`comprehensibility_score` SHALL be ≥ 0.6 (configurable floor) at the time of
registration / promotion.

#### Scenario: Below-floor candidate refused promotion
- **WHEN** a candidate carries `comprehensibility_score: 0.55` with floor 0.6
- **THEN** promotion is refused and `verifier_negative.comprehensibility_below_floor` is emitted

#### Scenario: At-or-above-floor candidate promoted
- **WHEN** a candidate carries `comprehensibility_score: 0.6`
- **THEN** promotion proceeds

### Requirement: Registration-time invariant — every compose-dispatch task carries a rationale

Every task that compose-dispatches another activity SHALL carry a
`composition_rationale` entry (per the `authoredActivityCandidate` shape).

#### Scenario: Compose-dispatch without rationale rejected
- **WHEN** a registered template has a compose-dispatch task whose task_id is absent from `composition_rationales`
- **THEN** registration is rejected

### Requirement: `comprehensibility_check` resolver contract

The `comprehensibility_check` resolver SHALL take a template (id + body) and
produce a `comprehensibilityScore` per the shape contract.

- **Input:** template (id + body).
- **Procedure:** an evaluator LLM (a second model provider where available) is
  given the template body **without** the activity's self-description and
  asked: *"What does this do? Why might it have been authored? What would have
  to be true for it to be useful?"*
- **Comparison:** the evaluator's reading is compared semantically to the
  template's self-description (LLM-judge or embedding similarity).
- **Output:** `comprehensibilityScore` per the shape contract.
- **Promotion gate:** score below the floor SHALL refuse promotion and emit
  `verifier_negative.comprehensibility_below_floor`.
- **Periodic re-check:** every 7 days, using a model provider different from
  the most recent evaluation, when available.

#### Scenario: Above-floor score allows promotion
- **WHEN** `comprehensibility_check` returns score 0.75 with floor 0.6
- **THEN** the template is promoted and no failure-mode impulse is emitted

#### Scenario: Below-floor score blocks promotion
- **WHEN** `comprehensibility_check` returns score 0.45 with floor 0.6
- **THEN** promotion is refused and `verifier_negative.comprehensibility_below_floor` is emitted

#### Scenario: 7-day re-check uses different provider when available
- **WHEN** 7 days have elapsed since the last `comprehensibilityScore` for template T, and at least one alternative provider is configured
- **THEN** the re-check selects a provider different from the previous `evaluator_model_id`

### Requirement: Drafter authoring-discipline hard requirements

The drafter SHALL satisfy all five rules before emitting an
`authoredActivityCandidate`. Emission absent any of these SHALL produce a
`verifier_negative.authoring_discipline_violation` impulse.

1. Self-describing names on shapes, template ids, task ids (regex rejects
   single-character or unprintable names).
2. ≥ 1 sentence description on every task.
3. ≥ 0 `cited_concept_ids` (zero allowed only if the pattern carries
   `n_concept_citations_available = 0`).
4. `composition_rationale` for every compose-dispatch task with a non-empty
   `rationale_class` and `rationale_text`.
5. Non-empty `authored_from_pattern.pattern_id` and `observation_window`.

#### Scenario: Single-character task id rejected
- **WHEN** a candidate's template contains a task with `id: "x"`
- **THEN** the drafter does not emit; `verifier_negative.authoring_discipline_violation` is written

#### Scenario: Task without description rejected
- **WHEN** a candidate's template contains a task with empty `description`
- **THEN** the drafter does not emit

#### Scenario: Zero cited concepts permitted only when pattern has none available
- **WHEN** a candidate carries `cited_concept_ids: []` and the source pattern carries `n_concept_citations_available: 3`
- **THEN** the drafter does not emit

#### Scenario: Zero cited concepts permitted when none available
- **WHEN** a candidate carries `cited_concept_ids: []` and the source pattern carries `n_concept_citations_available: 0`
- **THEN** emission proceeds

### Requirement: Phase 3 transfer-test exit criteria

Phase 3 acceptance SHALL remain open until all four of the following
conditions hold simultaneously over a 7-day window during which no
operator-curated scenario JSON enters the authoring pipeline. The operator
MUST verify all four before declaring Phase 3 closed.

- At least one substrate-authored Layer-2 interpretation activity has been
  promoted past the comprehensibility check.
- At least one substrate-authored Layer-4 action activity has been promoted
  past the comprehensibility check.
- Aggregate Thompson posterior over substrate-authored activities beats
  uniform-random on next-occurrence prediction by a statistically significant
  margin (Beta posterior mean ≥ 0.6 against a uniform-random baseline; sample
  count ≥ 30).
- `refine-on-disagreement` has fired autonomously at least once (closed-loop
  refinement evidence).

Layer-2 alone satisfies the *first observable milestone* (design §13) and is a
softer gate that MAY be celebrated before Layer-4 ships.

#### Scenario: All four criteria met → operator may close Phase 3
- **WHEN** the 7-day window has produced (a) ≥1 promoted Layer-2 activity, (b) ≥1 promoted Layer-4 activity, (c) Beta posterior mean ≥ 0.6 with sample count ≥ 30, and (d) ≥1 autonomous `refine-on-disagreement` firing, with zero operator-curated scenario JSON in the pipeline
- **THEN** the operator may declare Phase 3 acceptance closed

#### Scenario: Layer-2-only milestone celebrated without closing Phase 3
- **WHEN** only the first criterion (Layer-2 promotion) is met
- **THEN** the *first observable milestone* may be declared but Phase 3 acceptance remains open

#### Scenario: Operator-curated JSON in pipeline invalidates window
- **WHEN** any operator-curated scenario JSON enters the authoring pipeline during the 7-day window
- **THEN** the window resets and Phase 3 acceptance cannot be closed
