## Why

The API schema (Zod validation) and SurrealDB schema (SCHEMAFULL tables) have diverged, causing template creation to fail. This blocks integration testing of Thompson Sampling and prevents normal activity system operation. The mismatches were discovered during the fix-thompson-sampling implementation.

## What Changes

- **Remove nested object validation from API**: The `task_steps` field should accept flexible array content since SurrealDB defines it as `option<array>` without nested schema
- **Fix org_id type handling**: API sends string IDs but schema expects `record<organizations>` references
- **Align CreateTemplateRequestSchema with SurrealDB schema**: Remove fields and validations that don't exist in the database
- **Simplify TemplateTaskSchema**: Make it flexible to match DB's unstructured array

## Capabilities

### New Capabilities

- `schema-alignment`: Alignment between API validation schemas and SurrealDB table definitions

### Modified Capabilities

(none - this is fixing implementation, not changing requirements)

## Impact

- **repos/metabob-activity-api/src/models/schemas.ts**: Simplify `TemplateTaskSchema` and related schemas
- **repos/metabob-activity-api/src/routes/activities.ts**: Update template registration to handle flexible task_steps
- **repos/metabob-activity-api/sql/001-init-schema.surql**: Potentially update if we want stricter DB validation
- **Integration tests**: Will unblock Thompson Sampling live testing
- **Template creation**: Will start working via API
