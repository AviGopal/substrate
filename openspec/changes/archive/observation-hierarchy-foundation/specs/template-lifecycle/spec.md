## ADDED Requirements

### Requirement: Thompson score decay
The backend SHALL apply a configurable daily decay factor to all Thompson alpha and beta parameters to ensure templates must demonstrate continued success to maintain their selection probability.

#### Scenario: Score decay applied daily
- **WHEN** a daily maintenance job runs and a template has alpha=100, beta=10 with decay factor 0.995
- **THEN** after decay the template SHALL have alpha=99.5, beta=9.95

#### Scenario: Active templates resist decay
- **WHEN** a template with alpha=50 is executed successfully twice and decay runs once in the same day
- **THEN** the template's alpha SHALL be (50 * 0.995) + 2 = 51.75 — successful executions more than counteract decay

#### Scenario: Inactive templates lose confidence
- **WHEN** a template with alpha=100 has no executions for 100 days
- **THEN** its alpha SHALL be approximately 60.6 (100 * 0.995^100) — exploration naturally increases for this template

#### Scenario: Decay factor is configurable
- **WHEN** the backend is configured with `THOMPSON_DECAY_FACTOR=0.99`
- **THEN** the daily decay SHALL use 0.99 instead of the default 0.995

### Requirement: Template pruning
The backend SHALL archive templates that have sufficient observations but persistently poor performance, and templates that are never used.

#### Scenario: Low-performing template pruned
- **WHEN** a template has `alpha + beta > 20` and `alpha/(alpha+beta) < 0.3`
- **THEN** the weekly pruning job SHALL archive the template — removing it from Thompson Sampling recommendations but preserving it in the database for historical reference

#### Scenario: Never-used template pruned
- **WHEN** a template has `total_executions = 0` and was created more than 30 days ago
- **THEN** the weekly pruning job SHALL archive the template

#### Scenario: Pruned templates accessible for analysis
- **WHEN** a template has been archived by pruning
- **THEN** it SHALL still be retrievable via `GET /v2/activities/templates/:id` with `status: "archived"` but SHALL NOT appear in Thompson Sampling recommendations

#### Scenario: Pruning thresholds are configurable
- **WHEN** the backend is configured with custom pruning thresholds
- **THEN** the pruning job SHALL use those thresholds instead of defaults

### Requirement: Generation depth tracking
Each template SHALL track how many ribosome extractions separate it from a human-created or LLM-improvised original, and selection probability SHALL decrease with generation depth.

#### Scenario: Manually created template has depth 0
- **WHEN** a template is created via `POST /v2/activities/templates` directly
- **THEN** it SHALL have `generationDepth: 0`

#### Scenario: Ribosome extraction increments depth
- **WHEN** the ribosome extracts a new template from a successful execution of a template with `generationDepth: 2`
- **THEN** the new template SHALL have `generationDepth: 3`

#### Scenario: Higher depth requires higher Thompson score
- **WHEN** Thompson Sampling selects among templates, and template A has score 0.7 at depth 0, and template B has score 0.75 at depth 4
- **THEN** template B's effective score SHALL be reduced by the depth penalty (configurable, default 0.02 per depth level), giving effective score 0.67, and template A SHALL be preferred

#### Scenario: Maximum generation depth enforced
- **WHEN** the ribosome attempts to extract from a template at `generationDepth: 5` (configurable maximum)
- **THEN** the extraction SHALL still proceed but the new template SHALL be flagged with `atMaxDepth: true` and its depth penalty SHALL be capped at the maximum

### Requirement: Template population cap
The backend SHALL enforce a maximum number of active (non-archived) templates to prevent unbounded library growth that degrades Thompson Sampling effectiveness.

#### Scenario: Population cap triggers competitive pruning
- **WHEN** the active template count exceeds the configured maximum (default 500) after a new template is created
- **THEN** the system SHALL archive the template with the lowest Thompson score among those with `alpha + beta > 10` (sufficient observations to judge)

#### Scenario: New templates are not immediately pruned
- **WHEN** the active template count exceeds the cap and a new template has `alpha + beta < 10`
- **THEN** the new template SHALL NOT be pruned — only templates with sufficient observations are eligible for competitive pruning
