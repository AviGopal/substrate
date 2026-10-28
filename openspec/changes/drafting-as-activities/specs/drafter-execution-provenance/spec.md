## ADDED Requirements

### Requirement: A drafting execution exposes only its selected arm to extraction

Every durable `feature_compose` execution that reached the drafting step records the selected
`DrafterRecord.variant` as `metadata.drafter_variant`. If that selected module falls back to the
closed floor, the trace retains the selected arm so grading cannot charge the floor for the
variant's failure. A floor execution is recorded as `floor`. Executions refused before drafting do
not claim an arm.

The exact-execution `executionTraceWithSignatures` read used by `ribosome-extract` returns that
field as an optional `drafter_variant` string, and returns no unrelated execution metadata. The
reader validates the field as a non-empty string and preserves its existing authenticated
tenant-scoped point lookup.

#### Scenario: A floor execution is attributed to the floor

- **WHEN** `feature_compose` drafts with `drafter_variant: "floor"` and emits its durable execution
- **THEN** the stored execution carries `metadata.drafter_variant: "floor"`
- **AND** an exact `executionTraceWithSignatures` read exposes `drafter_variant: "floor"`

#### Scenario: A failed variant remains attributed to the selected variant

- **WHEN** a named drafter is selected and the closed core falls back to the floor
- **THEN** the stored and read-back `drafter_variant` remain the selected variant id
- **AND** the trace reader does not expose unrelated metadata

#### Scenario: No draft has no arm attribution

- **WHEN** `feature_compose` refuses before invoking the drafter
- **THEN** the execution has no `drafter_variant` field

#### Scenario: Invalid historical metadata is omitted

- **WHEN** the exact execution has no selected-arm field or its value is empty or non-string
- **THEN** the reader omits `drafter_variant` and still returns the trace
