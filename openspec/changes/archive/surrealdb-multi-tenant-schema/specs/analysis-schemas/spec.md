## ADDED Requirements

### Requirement: Analysis problems table stores detected code issues
The system SHALL provide an `analysis_problems` table with fields: `problem_id`, `org_id`, `project_id`, `severity`, `category`, `title`, `description`, `file_path`, `line_number`, `status`, `assigned_to`, `detected_at`, `resolved_at`, `resolution_summary`, `fixed_in_commit`.

#### Scenario: Create analysis problem
- **WHEN** a code analysis detects an issue in file "src/auth.ts" at line 42
- **THEN** an analysis_problems record is created with severity, category, and location

#### Scenario: Query problems by severity
- **WHEN** a user queries problems with severity = 'CRITICAL'
- **THEN** all critical problems in their projects are returned

#### Scenario: Assign problem to user
- **WHEN** an admin assigns problem to user_id = 'user:alice'
- **THEN** the assigned_to field is updated and Alice can see the problem

#### Scenario: Mark problem as resolved
- **WHEN** a problem is fixed and marked complete
- **THEN** status changes to 'resolved', resolved_at timestamp is set, and resolution_summary is stored

### Requirement: Code components table stores component metadata
The system SHALL provide a `code_components` table with fields: `component_id`, `org_id`, `project_id`, `file_path`, `function_name`, `class_name`, `component_type`, `complexity_score`, `loc`, `dependencies`, `created_at`, `updated_at`.

#### Scenario: Register code component
- **WHEN** CPG analysis discovers function "parseConfig" in file "src/config.ts"
- **THEN** a code_components record is created with function_name, file_path, and metadata

#### Scenario: Update component complexity
- **WHEN** code is modified and complexity increases
- **THEN** the complexity_score field is updated and updated_at timestamp is set

#### Scenario: Query components by type
- **WHEN** a query filters by component_type = 'function'
- **THEN** all function components in user's projects are returned

### Requirement: Annotations table stores developer notes
The system SHALL provide an `annotations` table with fields: `annotation_id`, `org_id`, `project_id`, `component_id`, `type`, `content`, `tags`, `created_by`, `link_to_problem_id`, `created_at`, `updated_at`.

#### Scenario: Create annotation on component
- **WHEN** a developer adds note "Uses legacy auth pattern" to component
- **THEN** an annotations record is created with type = 'implementation_note'

#### Scenario: Link annotation to problem
- **WHEN** an annotation explains context for problem_id = 'prob:123'
- **THEN** the link_to_problem_id field is set and the problem shows the annotation

#### Scenario: Query annotations by tags
- **WHEN** a query filters by tags containing 'security'
- **THEN** all annotations tagged with 'security' in user's projects are returned

### Requirement: Cochange patterns table stores file correlation data
The system SHALL provide a `cochange_patterns` table with fields: `pattern_id`, `org_id`, `project_id`, `file_a`, `file_b`, `cochange_count`, `confidence`, `last_cochanged_at`, `created_at`, `updated_at`.

#### Scenario: Record cochange pattern
- **WHEN** files "auth.ts" and "user.ts" are modified together in 5 commits
- **THEN** a cochange_patterns record is created with cochange_count = 5

#### Scenario: Suggest cochanges for file
- **WHEN** a user modifies file "auth.ts"
- **THEN** the system queries cochange_patterns where file_a = 'auth.ts' OR file_b = 'auth.ts'

#### Scenario: Filter patterns by confidence threshold
- **WHEN** a query requests patterns with confidence > 0.7
- **THEN** only high-confidence cochange patterns are returned

### Requirement: Impact relations table stores dependency impact data
The system SHALL provide an `impact_relations` table with fields: `relation_id`, `org_id`, `project_id`, `source_component`, `target_component`, `impact_type`, `impact_score`, `direction`, `created_at`, `updated_at`.

#### Scenario: Record impact relation
- **WHEN** function "validateUser" calls function "checkPermissions"
- **THEN** an impact_relations record is created with impact_type = 'function_call'

#### Scenario: Query downstream impact
- **WHEN** a query requests impact with direction = 'forward' from component X
- **THEN** all components affected by changes to X are returned

#### Scenario: Query upstream dependencies
- **WHEN** a query requests impact with direction = 'backward' to component Y
- **THEN** all components that Y depends on are returned

### Requirement: Design patterns table stores recognized patterns
The system SHALL provide a `design_patterns` table with fields: `pattern_id`, `org_id`, `project_id`, `pattern_name`, `components`, `confidence`, `description`, `detected_at`, `created_at`.

#### Scenario: Detect design pattern
- **WHEN** CPG analysis recognizes "Singleton" pattern in components
- **THEN** a design_patterns record is created with pattern_name and component list

#### Scenario: Query patterns by name
- **WHEN** a query filters by pattern_name = 'Factory'
- **THEN** all detected Factory patterns in user's projects are returned

#### Scenario: High-confidence patterns prioritized
- **WHEN** a query requests patterns ordered by confidence DESC
- **THEN** most confident pattern detections appear first

### Requirement: Progressive sync state table tracks analysis progress
The system SHALL provide a `progressive_sync_state` table with fields: `state_id`, `org_id`, `project_id`, `file_path`, `last_synced_at`, `sync_status`, `errors`, `created_at`, `updated_at`.

#### Scenario: Track file sync progress
- **WHEN** a file is analyzed and CPG is built
- **THEN** progressive_sync_state is updated with last_synced_at and sync_status = 'completed'

#### Scenario: Record sync errors
- **WHEN** file analysis fails with parsing error
- **THEN** sync_status = 'failed' and errors array contains error message

#### Scenario: Query files needing sync
- **WHEN** a query requests files where last_synced_at is older than file modification time
- **THEN** all stale files in user's projects are returned

### Requirement: Analysis schemas enforce org/project isolation
The system SHALL define PERMISSIONS clauses on all analysis tables to enforce organization and project-level isolation.

#### Scenario: User can only query problems in their projects
- **WHEN** a user queries analysis_problems
- **THEN** only problems with org_id = $auth.org_id AND project_id IN $auth.project_ids are visible

#### Scenario: User can create annotations in their projects
- **WHEN** a user creates an annotation
- **THEN** the annotation is automatically assigned org_id = $auth.org_id and project_id from context

#### Scenario: Admin can delete problems in their org
- **WHEN** an admin deletes a problem
- **THEN** the deletion succeeds if org_id = $auth.org_id AND $auth.role IN ['admin', 'owner']

#### Scenario: Member cannot delete problems
- **WHEN** a member attempts to delete a problem
- **THEN** the operation fails due to PERMISSIONS clause
