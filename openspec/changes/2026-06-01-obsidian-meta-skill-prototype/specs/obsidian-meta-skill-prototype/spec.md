# Spec — obsidian-meta-skill-prototype

Formal capability specification for the dev-vessel to implement.
Resolver shapes, activity contracts, failure-mode subtypes. Code is
out of scope; this document fixes the contracts.

## 1. Shapes

### 1.1 `obsidianEvent` (Layer 0)

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

### 1.2 `obsidianEpisode` (Layer 1)

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

### 1.3 `actionEffectModel` (Layer 1 / vocabulary)

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

Reversibility-class vocabulary matches
`2026-05-31-display-control-extension` exactly. Reversibility
classification is initially heuristic (text-edit → reversible,
file-delete → soft_irreversible, plugin-disable → hard_irreversible)
and is the seed corpus for a learned classifier.

### 1.4 `recurringPatternCluster` (Layer 1 → drafter input)

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

### 1.5 `authoredActivityCandidate` (drafter output)

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

### 1.6 `intentLabel` (Layer 2)

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

### 1.7 `trajectoryPrediction` (Layer 3)

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

### 1.8 `assistanceAction` (Layer 4)

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

### 1.9 `comprehensibilityScore`

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

## 2. Activity contracts

The seven bootstrap activities in design §7. Contracts below specify
input shapes, output shapes, and whether the activity is shipped
infrastructure or substrate-authored.

| Activity | Class | Input shapes | Output shapes |
|---|---|---|---|
| `observe-obsidian-events` | infrastructure | `[]` | `[obsidianEvent]` |
| `group-interaction-episodes` | infrastructure | `[obsidianEvent]` | `[obsidianEpisode]` |
| `probe-obsidian-action-effects` | infrastructure | `[obsidianEpisode]` | `[actionEffectModel]` |
| `detect-recurring-pattern` | infrastructure | `[obsidianEpisode, intentLabel?, trajectoryPrediction?]` | `[recurringPatternCluster]` |
| `draft-activity-from-pattern` | infrastructure | `[recurringPatternCluster, actionEffectModel, resolverVocabulary, activityVocabulary]` | `[authoredActivityCandidate]` |
| `predict-and-verify` | infrastructure | `[authoredActivityCandidate, obsidianEpisode]` | `[verifierResult, prediction_disagreement?]` |
| `refine-on-disagreement` | infrastructure | `[prediction_disagreement, recurringPatternCluster]` | `[authoredActivityCandidate]` |

Activities the substrate authors at runtime (Layers 2–4) consume
combinations of `obsidianEvent`, `obsidianEpisode`, `intentLabel`,
`trajectoryPrediction` and emit one of `intentLabel`,
`trajectoryPrediction`, `assistanceAction`. The shape catalog enforces
that newly-authored templates declare `inputShapes` and `outputShapes`
from this vocabulary or extend it; declaring an undeclared shape
emits a `seedable: true` marker and a registration-time check fires.

## 3. Failure mode — `prediction_disagreement`

Adds a new top-level entry alongside `verifier_negative`,
`budget_exhausted`, `safety_breach`, `cascading`, `user_abort`,
`consent_revoked`.

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

Posterior treatment: `prediction_disagreement.action_no_effect` =
full β=1 (action confidently dispatched, world did not change).
`intent_inconsistency` and `trajectory_divergence` = β=0.5 (the
substrate produced a guess and the guess was wrong, but the action
surface did not misfire). Mirrors `confidence_tier` scaling in
`2026-05-31-display-failure-mode-extensions`.

## 4. Registration-time invariants

Enforced at template registration; rejection emits a
`verifier_negative.activity_registration_invariant` impulse.

1. Every declared `inputShape` has at least one known producer in the
   activity vocabulary OR is marked `seedable: true`.
2. Every compose-dispatch reference resolves to an existing activity
   id.
3. `max_composition_depth` ≤ 16 (extends the existing
   `parent_execution_id` walk safety).
4. `authored_from_pattern.pattern_id` resolves to a stored
   `recurringPatternCluster`.
5. `comprehensibility_score ≥ 0.6` (configurable floor).
6. Every task that compose-dispatches another activity carries a
   `composition_rationale` entry in §1.5.

## 5. Verification asymmetry routing

`predict-and-verify` (§7.6) routes by output-shape signature on the
authored candidate:

| Authored output shape includes | Routes to |
|---|---|
| `intentLabel` | Behavioural-continuation verifier — observed continuation in `consistency_set` ⇒ pass |
| `trajectoryPrediction` | Sequence-match verifier — observed next-N events match `predicted_next_signatures` within horizon ⇒ pass |
| `assistanceAction` | State-change verifier — observed post-action signature matches `expected_post_signature` ⇒ pass |
| Multiple | All applicable verifiers run; AND-conjunction for promotion |

## 6. Comprehensibility check contract

`comprehensibility_check` resolver:

- **Input:** template (id + body).
- **Procedure:** evaluator LLM (a second model provider where
  available) is given the template body **without** the activity's
  self-description and asked: *"What does this do? Why might it have
  been authored? What would have to be true for it to be useful?"*
- **Comparison:** the evaluator's reading is compared semantically
  to the template's self-description (LLM-judge or embedding
  similarity).
- **Output:** `comprehensibilityScore` per §1.9.
- **Promotion gate:** score < floor ⇒ refuse promotion + emit
  `verifier_negative.comprehensibility_below_floor`.
- **Periodic re-check:** every 7 days using a model provider
  different from the most recent evaluation, when available.

## 7. Provenance & comprehensibility hard requirements

Drafter must satisfy all five before emission; emission absent any of
these is a `verifier_negative.authoring_discipline_violation`:

1. Self-describing names on shapes, template ids, task ids (regex
   reject single-character or unprintable names).
2. ≥ 1 sentence description on every task.
3. ≥ 0 `cited_concept_ids` (zero allowed only if pattern carries
   `n_concept_citations_available = 0`).
4. `composition_rationale` for every compose-dispatch task with a
   non-empty `rationale_class` and `rationale_text`.
5. Non-empty `authored_from_pattern.pattern_id` and
   `observation_window`.

## 8. Transfer-test exit criterion (formalised)

Operator may declare Phase 3 acceptance closed when, over a 7-day
window with no operator-curated scenario JSON anywhere in the
authoring pipeline:

- At least one substrate-authored Layer-2 interpretation activity
  has been promoted past comprehensibility check.
- At least one substrate-authored Layer-4 action activity has been
  promoted past comprehensibility check.
- Aggregate Thompson posterior over substrate-authored activities
  beats uniform-random on next-occurrence prediction by a
  statistically significant margin (Beta posterior mean ≥ 0.6
  against a uniform-random baseline; sample-count floor 30).
- `refine-on-disagreement` has fired autonomously at least once
  (closed-loop refinement evidence).

Layer-2 alone satisfies the *first observable milestone* (design
§13) and is a softer gate that may be celebrated before Layer-4
ships.
