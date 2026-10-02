## ADDED Requirements

These requirements correspond to the umbrella `obsidian-meta-skill-prototype` spec entries that become live capability when Phase 2 ships. They install the general drafter, the comprehensibility-check resolver, the authoring-discipline hard requirements, and the registration-time invariants for permissive-scope authoring. Phase 1 supplies the observation read path; Phase 3 adds the verifier-refiner loop.

### Requirement: `recurringPatternCluster` impulse shape contract is live as drafter input

The `recurringPatternCluster` shape SHALL be the drafter-input shape produced by pattern miners across any of the four layers. Contrast examples are required so the drafter can author a discriminating template rather than a tautological one. In Phase 2 the cluster is hand-constructed by the operator; Phase 3 auto-detects it.

#### Scenario: Cluster with no contrast examples rejected
- **WHEN** a `recurringPatternCluster` is written with `contrast_examples: []`
- **THEN** the write is rejected with `verifier_negative.shape_contract_violation`

#### Scenario: Layer value outside 0..3 rejected
- **WHEN** a `recurringPatternCluster` carries `layer: 4` or any value outside 0..3
- **THEN** the write is rejected

### Requirement: `authoredActivityCandidate` impulse shape contract is live

The `authoredActivityCandidate` shape SHALL be the drafter's output: a foundation `ActivityTemplate` together with provenance, declared shape contracts, cited concepts, per-composition-task rationales, and drafter provenance metadata.

#### Scenario: Candidate accepted when all provenance fields populated
- **WHEN** an `authoredActivityCandidate` is written carrying non-empty `authored_from_pattern.pattern_id`, populated `composition_rationales` for every compose-dispatch task, and `drafter_provenance.contrast_pair_count > 0`
- **THEN** the candidate is accepted and queued for downstream verification

#### Scenario: Compose-dispatch task without rationale rejected
- **WHEN** an `authoredActivityCandidate` template contains a task that compose-dispatches another activity but `composition_rationales` lacks an entry for that task_id
- **THEN** the write is rejected with `verifier_negative.authoring_discipline_violation`

### Requirement: `comprehensibilityScore` impulse shape contract is live

The `comprehensibilityScore` shape SHALL be the comprehensibility-check resolver's output: a 0..1 score, an evaluator model id, an `evaluated_at` timestamp, and a `reasoning_diff` describing how the evaluator's reading differed from the template's self-description.

#### Scenario: Score outside 0..1 rejected
- **WHEN** a `comprehensibilityScore` is written with `score < 0` or `score > 1`
- **THEN** the write is rejected

#### Scenario: Same evaluator_model_id on consecutive re-checks rejected
- **WHEN** a periodic re-check writes a `comprehensibilityScore` for template T using the same `evaluator_model_id` as the most recent previous evaluation, when an alternative provider is available
- **THEN** the write is rejected — the re-check policy requires a different model provider

### Requirement: `draft-activity-from-pattern` activity contract

`draft-activity-from-pattern` SHALL be a shipped infrastructure activity with `input_shapes: [recurringPatternCluster, actionEffectModel, resolverVocabulary, activityVocabulary]` and `output_shapes: [authoredActivityCandidate]`. The drafter SHALL be iterative — a prune-vocabulary step precedes the draft step — and SHALL satisfy the five authoring-discipline rules before emission.

#### Scenario: Candidate emitted only when discipline satisfied
- **WHEN** the drafter has authored a candidate satisfying all five authoring-discipline rules
- **THEN** one `authoredActivityCandidate` is emitted

#### Scenario: Discipline violation suppresses emission and emits failure mode
- **WHEN** the drafter's intermediate candidate is missing `composition_rationale` on a compose-dispatch task
- **THEN** no candidate is emitted and a `verifier_negative.authoring_discipline_violation` impulse is written

### Requirement: `comprehensibility_check` resolver contract

The `comprehensibility_check` resolver SHALL take a template (id + body) and produce a `comprehensibilityScore` per the shape contract. Procedure: an evaluator LLM (a second model provider where available) is given the template body **without** the activity's self-description and asked what it does, why it might have been authored, and what would have to be true for it to be useful. The evaluator's reading SHALL be compared semantically against the template's self-description. Templates whose score falls below the configured floor SHALL be refused promotion.

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

The drafter SHALL satisfy all five rules before emitting an `authoredActivityCandidate`. Emission absent any of these SHALL produce a `verifier_negative.authoring_discipline_violation` impulse.

1. Self-describing names on shapes, template ids, task ids (regex rejects single-character or unprintable names).
2. ≥ 1 sentence description on every task.
3. ≥ 0 `cited_concept_ids` (zero allowed only if the pattern carries `n_concept_citations_available = 0`).
4. `composition_rationale` for every compose-dispatch task with a non-empty `rationale_class` and `rationale_text`.
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

### Requirement: Registration-time invariant — input shapes have producers or are seedable

Every declared `inputShape` on a registered template SHALL have at least one known producer in the activity vocabulary, OR SHALL be marked `seedable: true`. Violation SHALL emit a `verifier_negative.activity_registration_invariant` impulse and the registration SHALL be rejected.

#### Scenario: Input shape without producer accepted when seedable
- **WHEN** a template declares an `inputShape` with no producer and carries `seedable: true` for that shape
- **THEN** registration succeeds

#### Scenario: Input shape without producer and not seedable rejected
- **WHEN** a template declares an `inputShape` with no producer and no `seedable: true` marker
- **THEN** registration is rejected with `verifier_negative.activity_registration_invariant`

### Requirement: Registration-time invariant — compose-dispatch references resolve

Every compose-dispatch reference within a registered template SHALL resolve to an existing activity id at registration time.

#### Scenario: Dangling compose-dispatch reference rejected
- **WHEN** a template registers a task that compose-dispatches `activity_id: X` and no such activity exists
- **THEN** registration is rejected with `verifier_negative.activity_registration_invariant`

### Requirement: Registration-time invariant — max composition depth ≤ 16

`max_composition_depth` SHALL be ≤ 16, extending the existing `parent_execution_id` walk safety to authored templates.

#### Scenario: Depth above 16 rejected
- **WHEN** a template registers with `max_composition_depth: 17`
- **THEN** registration is rejected

### Requirement: Registration-time invariant — authored_from_pattern resolves

`authored_from_pattern.pattern_id` SHALL resolve to a stored `recurringPatternCluster` at registration time.

#### Scenario: Dangling pattern_id rejected
- **WHEN** an `authoredActivityCandidate` is registered with `authored_from_pattern.pattern_id: P` and no cluster P exists
- **THEN** registration is rejected

### Requirement: Registration-time invariant — comprehensibility floor

`comprehensibility_score` SHALL be ≥ 0.6 (configurable floor) at the time of registration / promotion.

#### Scenario: Below-floor candidate refused promotion
- **WHEN** a candidate carries `comprehensibility_score: 0.55` with floor 0.6
- **THEN** promotion is refused and `verifier_negative.comprehensibility_below_floor` is emitted

#### Scenario: At-or-above-floor candidate promoted
- **WHEN** a candidate carries `comprehensibility_score: 0.6`
- **THEN** promotion proceeds

### Requirement: Registration-time invariant — every compose-dispatch task carries a rationale

Every task that compose-dispatches another activity SHALL carry a `composition_rationale` entry per the `authoredActivityCandidate` shape.

#### Scenario: Compose-dispatch without rationale rejected
- **WHEN** a registered template has a compose-dispatch task whose task_id is absent from `composition_rationales`
- **THEN** registration is rejected
