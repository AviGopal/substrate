## ADDED Requirements

### Requirement: Thompson Sampling metadata correctness

The Thompson Sampling `/v2/activities/recommend` endpoint SHALL return correct metadata in the response, including the actual `beta` parameter value used for sampling.

#### Scenario: Recommendation returns correct beta value

- **GIVEN** a template with thompson_beta = 2.5 in metrics
- **WHEN** `/v2/activities/recommend` is called
- **THEN** the response `selection_metadata.beta` equals 2.5

### Requirement: Flexible task_steps validation

The API SHALL accept `task_steps` as an array of objects without enforcing strict nested field validation. The SurrealDB schema defines `task_steps` as `option<array>` without nested structure, so the API validation MUST match.

#### Scenario: Create template with minimal task_steps

- **WHEN** a template is created with `task_steps: [{"id": "1", "description": "Do something"}]`
- **THEN** the template is created successfully without validation errors

#### Scenario: Create template with empty task_steps array

- **WHEN** a template is created with `task_steps: []`
- **THEN** the template is created successfully

#### Scenario: Create template with rich task_steps

- **WHEN** a template is created with task_steps containing additional fields like `dependencies`, `subagent`, `prompt`
- **THEN** the template is created successfully and all fields are preserved

### Requirement: String-based org_id handling

The API SHALL accept and store `org_id` as a plain string identifier. The SurrealDB schema defines `org_id` as `option<string>`.

#### Scenario: Create template with org_id

- **WHEN** a template is created with `org_id: "metabob_internal"`
- **THEN** the template is created successfully with the org_id stored correctly

#### Scenario: Create template without org_id

- **WHEN** a template is created without specifying org_id
- **THEN** the template is created successfully with org_id as null

### Requirement: Schema synchronization

The API Zod schemas SHALL only validate fields that exist in the corresponding SurrealDB table schema. Fields sent to INSERT must match SCHEMAFULL table definitions.

#### Scenario: No unknown field errors

- **WHEN** a template is created with all required fields
- **THEN** SurrealDB does not return "no such field exists" errors

#### Scenario: Optional fields handled correctly

- **WHEN** a template is created with optional fields omitted
- **THEN** SurrealDB stores the record with default values or null for omitted fields

### Requirement: Thompson Sampling integration works end-to-end

After templates are created, the Thompson Sampling system SHALL select them based on their performance metrics using proper Beta distribution sampling.

#### Scenario: Created templates appear in recommendations

- **GIVEN** a template created via `/v2/activities/templates`
- **WHEN** `/v2/activities/recommend` is called with matching criteria
- **THEN** the created template appears in the recommendations

#### Scenario: Multiple calls show probabilistic variation

- **GIVEN** multiple templates with similar performance metrics
- **WHEN** `/v2/activities/recommend` is called 20 times
- **THEN** different templates are selected across calls (not deterministic)

## Test Contracts

### Black-Box Test: API health and authentication

```bash
# Pre-condition: Services deployed to local cluster
curl -s http://api.minibob.local/health | jq -e '.status == "ok"'
```

### Black-Box Test: Template registration

```bash
curl -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-schema-alignment-'$(date +%s)'",
    "activity_id": "test-activity",
    "variant_name": "Schema Alignment Test",
    "description": "Test template for schema alignment",
    "category": "tool",
    "task_steps": [{"id": "1", "description": "Test task"}],
    "scope": "global"
  }' | jq -e '.success == true'
```

### Black-Box Test: Thompson Sampling recommendation

```bash
curl -X POST http://api.minibob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"category": "tool", "limit": 5}' \
  | jq -e '.recommendations | length > 0'
```

### Black-Box Test: Dashboard displays templates

```
Using Playwright MCP:
1. Navigate to http://dashboard.minibob.local
2. Click "Templates" tab
3. Verify test template appears in list
4. Check Thompson Sampling metrics are displayed
```
