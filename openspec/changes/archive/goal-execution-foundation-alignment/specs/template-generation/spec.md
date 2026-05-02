## MODIFIED Requirements

### Requirement: Template generation with schema extraction

The `assembleTemplateFromExecution()` function SHALL extract and populate `inputSchema` and `outputSchema` fields on generated templates, enabling shape-based activity matching.

#### Scenario: Extract input schema from execution
- **WHEN** a template is assembled from an execution trace
- **THEN** the system SHALL call `extractInputSchemaFromExecution(execution)`
- **AND** populate `template.inputSchema` with:
  - `required: ImpulseShape[]` - shapes that were loaded in all tasks
  - `optional?: ImpulseShape[]` - shapes that were loaded in some tasks

#### Scenario: Extract output schema from execution
- **WHEN** a template is assembled from an execution trace
- **THEN** the system SHALL call `extractOutputSchemaFromExecution(execution)`
- **AND** populate `template.outputSchema` with:
  - `produces: ImpulseShape[]` - shapes created by the execution

#### Scenario: Calculate schema confidence
- **WHEN** schemas are extracted
- **THEN** the system SHALL calculate `schemaConfidence` score (0.0 to 1.0)
- **AND** store it in `template.metadata.schemaConfidence`

#### Scenario: Pass schemas to backend registration
- **WHEN** the template is registered via MCP
- **THEN** the registration payload SHALL include `input_schema` and `output_schema` fields
- **AND** the backend SHALL store these for activity matching

### Requirement: Schema extraction from impulse data

Schema extraction functions SHALL derive shapes from execution impulse metadata.

#### Scenario: Derive input shapes from loaded impulses
- **WHEN** extracting input schema
- **THEN** the system SHALL iterate `execution.impulses[]`
- **AND** group by `impulse.metadata.shape`
- **AND** classify as required if loaded in majority of tasks

#### Scenario: Derive output shapes from created impulses
- **WHEN** extracting output schema
- **THEN** the system SHALL iterate:
  - `execution.taskResults[].metadata.outputImpulses[]`
  - `execution.executionTrace.impulsesCreated[]`
- **AND** extract unique shapes

#### Scenario: Handle missing shape metadata
- **WHEN** an impulse lacks shape metadata
- **THEN** the system SHALL infer shape from pointer type:
  - `file` → `file_content`
  - `memo` → `text_content`
  - `activityExecutionTrace` → `execution_trace`

### Requirement: Schema confidence scoring

Schema confidence SHALL indicate how reliable the extracted schema is.

#### Scenario: High confidence criteria
- **WHEN** calculating schema confidence
- **THEN** confidence SHALL increase for:
  - Execution succeeded (+0.15)
  - Multiple distinct input shapes (+0.1 per 3+ shapes)
  - Multiple distinct output shapes (+0.1 per 2+ shapes)
  - Consistent shape usage across tasks (+0.1)

#### Scenario: Low confidence warning
- **WHEN** `schemaConfidence < 0.5`
- **THEN** the system SHALL log a warning
- **AND** the template MAY be marked for manual review

#### Scenario: Confidence threshold for matching
- **WHEN** using schemas for activity matching
- **THEN** schemas with confidence < 0.7 SHALL be treated as optional hints, not hard requirements
