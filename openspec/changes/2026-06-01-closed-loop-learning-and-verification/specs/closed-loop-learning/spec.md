## ADDED Requirements

These requirements correspond to the umbrella `obsidian-meta-skill-prototype` spec entries that become live capability when Phase 3 ships. They install autonomous pattern detection, verifier routing by authored-activity output-shape, the closed-loop refinement subscriber, the three `prediction_disagreement` sub-case populations, and the Phase-3 transfer-test exit criteria.

### Requirement: `intentLabel` impulse shape contract (Layer 2) is live

The `intentLabel` shape SHALL be the Layer-2 output of substrate-authored interpretation activities: a free-form-within-bounded-class label naming what the user appears to be doing across an episode, paired with a consistency set the behavioural-continuation verifier compares observed continuations against.

#### Scenario: Label with non-existent source_episode_id rejected
- **WHEN** an `intentLabel` references a `source_episode_id` not present in the episode store
- **THEN** the write is rejected

#### Scenario: Empty consistency_set rejected
- **WHEN** an `intentLabel` carries `consistency_set: []`
- **THEN** the write is rejected — the verifier needs a non-empty expected-continuation set

### Requirement: `trajectoryPrediction` impulse shape contract (Layer 3) is live

The `trajectoryPrediction` shape SHALL be the Layer-3 output of substrate-authored prediction activities: a probability distribution over predicted next observation signatures within a finite horizon.

#### Scenario: Prediction with zero horizon entries rejected
- **WHEN** a `trajectoryPrediction` is written with `predicted_next_signatures: []`
- **THEN** the write is rejected

#### Scenario: horizon_events non-positive rejected
- **WHEN** any entry in `predicted_next_signatures` carries `horizon_events <= 0`
- **THEN** the write is rejected

### Requirement: `assistanceAction` impulse shape contract (Layer 4) is live

The `assistanceAction` shape SHALL be the Layer-4 output of substrate-authored action activities: a concrete Obsidian command dispatch with predicted post-state, pinned to a source pattern. The `reversibility_class` SHALL be one of the three classified (non-`unknown`) values.

#### Scenario: Action with reversibility_class "unknown" rejected
- **WHEN** an `assistanceAction` is written with `reversibility_class: "unknown"`
- **THEN** the write is rejected

#### Scenario: source_pattern_id missing rejected
- **WHEN** an `assistanceAction` is written with empty `source_pattern_id`
- **THEN** the write is rejected — every action SHALL trace to a pattern

### Requirement: `detect-recurring-pattern` activity contract

`detect-recurring-pattern` SHALL be a shipped infrastructure activity with `input_shapes: [obsidianEpisode, intentLabel?, trajectoryPrediction?]` and `output_shapes: [recurringPatternCluster]`. It SHALL emit clusters only when at least one contrast example is available and the occurrence count meets the configured threshold (default `n_occurrences ≥ 5`).

#### Scenario: Cluster with insufficient contrast suppressed
- **WHEN** the activity finds N occurrences of a candidate pattern but cannot identify any contrast trace
- **THEN** no `recurringPatternCluster` is emitted

#### Scenario: Cluster emitted when threshold met with contrast
- **WHEN** the activity finds 6 occurrences of a candidate pattern and at least one contrast trace
- **THEN** one `recurringPatternCluster` is emitted with the contrast example populated

### Requirement: `predict-and-verify` activity contract

`predict-and-verify` SHALL be a shipped infrastructure activity with `input_shapes: [authoredActivityCandidate, obsidianEpisode]` and `output_shapes: [verifierResult, prediction_disagreement?]`. The verifier SHALL be routed by the candidate's declared output-shape signature.

#### Scenario: Verifier passes when observation matches prediction
- **WHEN** the candidate emits an `intentLabel` and the observed continuation signature is a member of `consistency_set`
- **THEN** a positive `verifierResult` is emitted and no `prediction_disagreement` is written

### Requirement: `refine-on-disagreement` activity contract

`refine-on-disagreement` SHALL be a shipped infrastructure activity with `input_shapes: [prediction_disagreement, recurringPatternCluster]` and `output_shapes: [authoredActivityCandidate]`. It SHALL fire autonomously on `prediction_disagreement` traces and author a refined candidate addressing the specific disagreement sub-case. Refined candidates SHALL plug into `propagateCreditAlongChain` for parent-child credit flow.

#### Scenario: Action-no-effect disagreement triggers refinement
- **WHEN** a `prediction_disagreement` with `sub_case: "action_no_effect"` is written
- **THEN** `refine-on-disagreement` fires autonomously and emits a refined `authoredActivityCandidate`

### Requirement: Verifier routing by activity type

`predict-and-verify` SHALL route by output-shape signature on the authored candidate. When the candidate declares multiple verifiable output shapes, all applicable verifiers SHALL run and a logical AND-conjunction SHALL govern promotion.

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

### Requirement: `prediction_disagreement` sub-case population

The `prediction_disagreement` failure-mode reserved by Phase 1 SHALL be populated by `predict-and-verify` with the appropriate sub-case context on each verifier miss.

#### Scenario: intent_inconsistency context populated
- **WHEN** an observed continuation signature is not in the `consistency_set` of an active `intentLabel`
- **THEN** a `prediction_disagreement` failure-mode impulse is written with `sub_case: "intent_inconsistency"`, `intent_label`, `consistency_set`, and `observed_continuation_signature` populated

#### Scenario: trajectory_divergence context populated
- **WHEN** the observed next-N event signature is not among `predicted_next_signatures` within the declared horizon
- **THEN** a `prediction_disagreement` failure-mode impulse is written with `sub_case: "trajectory_divergence"`, `predicted_signatures`, `observed_signature`, and `horizon_events` populated

#### Scenario: action_no_effect context populated
- **WHEN** an `assistanceAction` dispatches command C and the observed post-state signature equals the pre-state signature
- **THEN** a `prediction_disagreement` failure-mode impulse is written with `sub_case: "action_no_effect"`, `command_id`, and `post_signature == pre_signature`

### Requirement: `prediction_disagreement` posterior treatment

Posterior treatment of `prediction_disagreement` sub-cases SHALL mirror the `confidence_tier` scaling in `2026-05-31-display-failure-mode-extensions`: `action_no_effect` = full β=1.0 (action confidently dispatched, world did not change); `intent_inconsistency` and `trajectory_divergence` = β=0.5 (substrate produced a guess and the guess was wrong, but the action surface did not misfire).

#### Scenario: action_no_effect updates β by 1.0
- **WHEN** an `assistanceAction` produces a `prediction_disagreement.action_no_effect`
- **THEN** the variant's β increases by 1.0

#### Scenario: trajectory_divergence updates β by 0.5
- **WHEN** a `trajectoryPrediction` produces a `prediction_disagreement.trajectory_divergence`
- **THEN** the variant's β increases by 0.5

### Requirement: Runtime-authored activities draw from the canonical shape vocabulary

Activities the substrate authors at runtime (Layers 2–4) SHALL consume combinations of `obsidianEvent`, `obsidianEpisode`, `intentLabel`, `trajectoryPrediction` and SHALL emit one of `intentLabel`, `trajectoryPrediction`, `assistanceAction`. Newly-authored templates SHALL declare `inputShapes` and `outputShapes` from this vocabulary or extend it; declaring an undeclared shape SHALL emit a `seedable: true` marker and trigger the registration-time check.

#### Scenario: New shape declared with seedable marker
- **WHEN** a candidate declares an `outputShape` not present in the vocabulary
- **THEN** the registration emits a `seedable: true` marker and the registration-time check evaluates whether the new shape is admissible

### Requirement: Phase 3 transfer-test exit criteria

Phase 3 acceptance SHALL remain open until all four of the following conditions hold simultaneously over a 7-day window during which no operator-curated scenario JSON enters the authoring pipeline. The operator MUST verify all four before declaring Phase 3 closed.

- At least one substrate-authored Layer-2 interpretation activity has been promoted past the comprehensibility check.
- At least one substrate-authored Layer-4 action activity has been promoted past the comprehensibility check.
- Aggregate Thompson posterior over substrate-authored activities beats uniform-random on next-occurrence prediction by a statistically significant margin (Beta posterior mean ≥ 0.6 against a uniform-random baseline; sample count ≥ 30).
- `refine-on-disagreement` has fired autonomously at least once (closed-loop refinement evidence).

Layer-2 alone satisfies the *first observable milestone* and MAY be celebrated before Layer-4 ships, but does not close Phase 3.

#### Scenario: All four criteria met → operator may close Phase 3
- **WHEN** the 7-day window has produced (a) ≥1 promoted Layer-2 activity, (b) ≥1 promoted Layer-4 activity, (c) Beta posterior mean ≥ 0.6 with sample count ≥ 30, and (d) ≥1 autonomous `refine-on-disagreement` firing, with zero operator-curated scenario JSON in the pipeline
- **THEN** the operator may declare Phase 3 acceptance closed

#### Scenario: Layer-2-only milestone celebrated without closing Phase 3
- **WHEN** only the first criterion (Layer-2 promotion) is met
- **THEN** the first observable milestone may be declared but Phase 3 acceptance remains open

#### Scenario: Operator-curated JSON in pipeline invalidates window
- **WHEN** any operator-curated scenario JSON enters the authoring pipeline during the 7-day window
- **THEN** the window resets and Phase 3 acceptance cannot be closed
