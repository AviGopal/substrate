## ADDED Requirements

These requirements correspond to the umbrella `obsidian-meta-skill-prototype` spec entries that become live capability when Phase 1 ships. They install the Layer-0/Layer-1 shape catalogue, the action-effect probe, and reserve the `prediction_disagreement` failure-mode schema slot. Phase 2 and Phase 3 populate downstream behaviour.

### Requirement: `obsidianEvent` impulse shape contract (Layer 0) is live

The `obsidianEvent` shape SHALL be the Layer-0 raw-event impulse emitted by `observe-obsidian-events`. It captures one Obsidian editor/file/workspace event with sanitised metadata only — no raw text content. `bridge_eligibility` SHALL be `"deny"` so raw events never cross the bridge to learning storage. Required fields: `event_id`, `kind` (one of `editor-change | file-open | file-create | file-modify | file-delete | file-rename | active-leaf-change | command-executed`), `timestamp`, `payload_hash`. Optional: `sync_root_relative_path` (never absolute), `command_id` (only when `kind === "command-executed"`).

#### Scenario: Valid command event accepted
- **WHEN** an `obsidianEvent` is written with `kind: "command-executed"`, a `command_id`, and `bridge_eligibility: "deny"`
- **THEN** the impulse-write path accepts it and the event is queryable in the Layer-0 pool

#### Scenario: Absolute path rejected
- **WHEN** an `obsidianEvent` is written with `sync_root_relative_path` containing a filesystem-absolute path
- **THEN** the write is rejected with `verifier_negative.shape_contract_violation`

#### Scenario: bridge_eligibility other than "deny" rejected
- **WHEN** an `obsidianEvent` is written with `bridge_eligibility: "allow"`
- **THEN** the write is rejected — raw events SHALL NOT cross the bridge

### Requirement: `obsidianEpisode` impulse shape contract (Layer 1) is live

The `obsidianEpisode` shape SHALL group an ordered run of `obsidianEvent`s into a single user-interaction episode, summarised by a sorted-unique class signature suitable for cross-trace comparison. Required fields: `episode_id`, `event_ids` (ordered), `sorted_unique_class_signature`, `window_start`, `window_end`, `sync_root_scope`, `bridge_eligibility: "allow"`.

#### Scenario: Episode emitted with ordered event_ids
- **WHEN** `group-interaction-episodes` consumes N `obsidianEvent`s within a window and emits an `obsidianEpisode`
- **THEN** `event_ids` is ordered chronologically and `sorted_unique_class_signature` is a sorted, deduplicated set of `(kind, command_id?)` tokens

#### Scenario: Unsorted signature rejected
- **WHEN** an `obsidianEpisode` is written with `sorted_unique_class_signature` that is not sorted or contains duplicates
- **THEN** the write is rejected with `verifier_negative.shape_contract_violation`

### Requirement: `actionEffectModel` impulse shape contract is live

The `actionEffectModel` shape SHALL capture a learned model of what a given Obsidian command does to vault+workspace state, with a probability distribution over post-state signatures and a reversibility classification from the four-value vocabulary (`reversible | soft_irreversible | hard_irreversible | unknown`).

#### Scenario: Probabilities sum to 1.0 within tolerance
- **WHEN** an `actionEffectModel` is written
- **THEN** the sum of `probability` across `post_signature_distribution` entries is within ±1e-6 of 1.0

#### Scenario: Out-of-vocabulary reversibility class rejected
- **WHEN** an `actionEffectModel` carries a `reversibility_class` not in the four-value vocabulary
- **THEN** the write is rejected

### Requirement: `observe-obsidian-events` activity contract

`observe-obsidian-events` SHALL be a shipped infrastructure activity with `input_shapes: []` and `output_shapes: [obsidianEvent]`. It SHALL subscribe to the Obsidian event surface and emit one `obsidianEvent` per observed event with `bridge_eligibility: "deny"`. The activity SHALL contain no LLM-backed tasks.

#### Scenario: Activity emits one obsidianEvent per observed Obsidian event
- **WHEN** Obsidian fires a `command-executed` event with command id C
- **THEN** the activity emits one `obsidianEvent` with `kind: "command-executed"` and `command_id: C`

#### Scenario: Raw text never emitted
- **WHEN** an editor-change event carries a 4 KB text payload
- **THEN** the emitted `obsidianEvent` carries only `payload_hash` and no `text` field

### Requirement: `group-interaction-episodes` activity contract

`group-interaction-episodes` SHALL be a shipped infrastructure activity with `input_shapes: [obsidianEvent]` and `output_shapes: [obsidianEpisode]`. It SHALL window `obsidianEvent`s into `obsidianEpisode`s by inactivity gap or workspace boundary. The activity SHALL contain no LLM-backed tasks.

#### Scenario: Window closes on inactivity gap
- **WHEN** the activity has consumed events e1..eN and no event arrives for longer than the configured idle threshold
- **THEN** it emits one `obsidianEpisode` whose `event_ids = [e1..eN]` and `window_end` equals the timestamp of eN

### Requirement: `probe-obsidian-action-effects` activity contract

`probe-obsidian-action-effects` SHALL be a shipped infrastructure activity with `input_shapes: [obsidianEpisode]` and `output_shapes: [actionEffectModel]`. It SHALL extract `(pre_signature, command_id, post_signature)` triples from episodes and accumulate per-command `actionEffectModel` distributions. It SHALL refuse to dispatch commands against any vault path other than the configured probe vault.

#### Scenario: First observation creates new model
- **WHEN** the activity observes the first `(pre, C, post)` triple for command C
- **THEN** it emits an `actionEffectModel` with `command_id: C`, `observation_count: 1`, and a single-entry `post_signature_distribution`

#### Scenario: Subsequent observation updates distribution
- **WHEN** the activity observes a second `(pre, C, post)` triple for command C
- **THEN** the emitted (or updated) `actionEffectModel` reflects `observation_count: 2` with re-normalised probabilities

#### Scenario: Probe refuses non-probe vault
- **WHEN** the activity is configured against a probe-vault path P and Obsidian's active vault is path P' ≠ P
- **THEN** no `executeCommandById` is dispatched and the activity emits a `verifier_negative.safety_breach` impulse

### Requirement: `prediction_disagreement` failure-mode schema slot is reserved

A new top-level `failure_mode.type` value `prediction_disagreement` SHALL be added to `FailureModeSchema` in `repos/metabob-activity-api/src/models/schemas.ts` alongside the existing values. The discriminated `context` payload SHALL support three sub-cases — `intent_inconsistency`, `trajectory_divergence`, `action_no_effect` — reserved as OPTIONAL columns at the database layer. Phase 1 SHALL NOT populate this field; emission lands in Phase 3.

#### Scenario: Schema accepts prediction_disagreement type
- **WHEN** a trace is submitted with `failure_mode.type = "prediction_disagreement"` and a populated `context` for any of the three sub-cases
- **THEN** the schema validator accepts the trace and the row persists with the sub-case fields readable

#### Scenario: Migration leaves existing traces unaffected
- **WHEN** the Phase 1 migration is applied to a database containing traces from before this phase
- **THEN** existing traces continue to load and query without modification; new optional fields default to NONE
