# Progressive Template Creation and Validation

> **Important**: This implementation validates progressive template output processing WITHOUT modifying the progressive template itself. Template creation is an explicit, separate step.

## Overview

This validates that templates created through progressive composition are:

1. **Discoverable** - Registered in backend and retrievable via API
2. **Successful** - Execute correctly with validation and metrics tracking
3. **Non-destructive** - The progressive template itself is never modified

## Architecture

The workflow consists of three explicit, separate steps:

```
Progressive Template Execution
        ↓
    (output with alignment markers)
        ↓
Extract Template from Output  ← extract-template-from-progressive.ts
        ↓
    (template JSON)
        ↓
Register with Backend  ← register-template-with-backend.ts
        ↓
    (registered template)
        ↓
Backend Metrics & Thompson Sampling
```

**Key Design Principle**: Each step is independent and optional. The progressive template never needs to be modified.

## Files

| File | Purpose | Type |
|------|---------|------|
| `test-progressive-template-creation.ts` | Validate extraction and discoverability | TypeScript/Bun test |
| `extract-template-from-progressive.ts` | Parse execution output into template JSON | TypeScript/Bun utility |
| `register-template-with-backend.ts` | Submit templates to backend API | TypeScript/Bun utility |
| `run-progressive-validation.sh` | End-to-end validation suite | Bash script |

## Quick Start

### 1. Run Validation Suite

The comprehensive validation script tests all components:

```bash
# Basic validation
./run-progressive-validation.sh

# Verbose mode with detailed output
./run-progressive-validation.sh --verbose

# With debug logging
VERBOSE=true bun run test-progressive-template-creation.ts
```

### 2. Extract Template from Execution Output

After progressive template execution completes, extract the template:

```bash
# From a file
bun run extract-template-from-progressive.ts execution-output.txt > template.json

# From stdin
cat execution-output.txt | bun run extract-template-from-progressive.ts --stdin > template.json

# With debug info to stderr
bun run extract-template-from-progressive.ts execution-output.txt > template.json 2>&1
```

### 3. Register Template with Backend

Submit the extracted template to the backend:

```bash
# Register a file
bun run register-template-with-backend.ts template.json

# Register from stdin
cat template.json | bun run register-template-with-backend.ts --stdin

# With environment configuration
ACTIVITY_API_ENDPOINT=http://api.local:8080 \
  bun run register-template-with-backend.ts template.json
```

### 4. Verify Discoverability

After registration, verify the template is discoverable:

```bash
# Get specific template
curl http://activity.metabob.local/v2/activities/templates/<template-id>

# Search for templates
curl "http://activity.metabob.local/v2/activities/templates?limit=100"

# Check Thompson Sampling recommendations
curl -X POST http://activity.metabob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"task_description":"<your template name>","limit":10}'
```

## End-to-End Testing

### Prerequisites

1. **Backend running**:
   ```bash
   kubectl get pods -n activity-system | grep metabob-activity-api
   ```

2. **MiniBob available** (for test execution):
   ```bash
   cd repos/minibob && bun run dev
   ```

3. **Port forwarding** (if needed):
   ```bash
   kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &
   ```

### Complete Workflow

```bash
# 1. Start validation suite
./run-progressive-validation.sh

# Expected output:
# ✅ Backend health check passed
# ✅ Progressive template exists
# ✅ Template structure validation passed
# ✅ Template extraction successful
# ✅ Template validation passed
# ✅ Thompson Sampling integration ready
```

### Manual Execution Test

```bash
# 1. Start MiniBob
cd repos/minibob
bun run dev

# 2. In another terminal, execute progressive template
minibob --single "Create a new feature using progressive composition"

# 3. Save output
minibob --single "Create a new feature" > /tmp/progressive-output.txt

# 4. Extract template
bun run extract-template-from-progressive.ts /tmp/progressive-output.txt > /tmp/new-template.json

# 5. Register template
bun run register-template-with-backend.ts /tmp/new-template.json

# 6. Verify in search results
curl "http://activity.metabob.local/v2/activities/templates?limit=100" | jq '.[] | select(.id=="<extracted-id>")'
```

## Output Formats

### Progressive Template Output

Expected markers in execution output:

```
STAGE-1-ALIGNED: <description of what was created>
STAGE-1-MISALIGNED: <description of what went wrong>

STAGE-2-ALIGNED: <description of integration>
STAGE-2-ALIGNED-VIA-IMPROVISATION: <description of alternate approach>
STAGE-2-MISALIGNED: <description of failure>

GOAL-ACHIEVED: <description of final result>
GOAL-FAILED: <description of test failure>
```

### Extracted Template JSON

```json
{
  "id": "template-id",
  "name": "Template Name",
  "description": "Auto-extracted from progressive composition",
  "category": "feature",
  "tags": ["progressive.extraction", "auto-generated"],
  "tasks": [
    {
      "id": "task-1",
      "description": "First task",
      "prompt": {
        "template": "Task description"
      },
      "validation": {
        "required_patterns": [],
        "forbidden_patterns": []
      },
      "dependencies": []
    }
  ]
}
```

### Registration Response

```json
{
  "id": "template-id",
  "name": "Template Name",
  "message": "Template registered successfully"
}
```

## How It Works

### Extraction (`extract-template-from-progressive.ts`)

1. **Parse output** - Looks for alignment markers (STAGE-1-ALIGNED, STAGE-2-ALIGNED, GOAL-ACHIEVED)
2. **Extract descriptions** - Captures what was accomplished in each stage
3. **Build tasks** - Converts stages into a task sequence
4. **Generate template** - Creates a valid ActivityTemplate structure
5. **Output JSON** - Prints to stdout for piping or redirection

**Input Recognition**:
- Reads from file: `extract-template-from-progressive.ts filename.txt`
- Reads from stdin: `--stdin` flag or piped input
- Accepts both structured and unstructured output

**Output**:
- Valid JSON template to stdout (can be piped)
- Summary info to stderr (for debugging)
- Exit code 0 on success, 1 on failure

### Registration (`register-template-with-backend.ts`)

1. **Read template** - From file or stdin
2. **Validate structure** - Checks all required fields
3. **Submit to API** - POST to `/v2/activities/templates`
4. **Handle response** - Success info or error details
5. **Provide guidance** - Next steps for verification

**Validation Checks**:
- Template ID must be present and valid
- Name and description required
- Category must be valid
- Tasks array required (non-empty)
- Each task must have id, description, prompt

**Error Handling**:
- Clear error messages for validation failures
- HTTP error details from API
- Troubleshooting suggestions
- Backend connectivity checks

### Testing (`test-progressive-template-creation.ts`)

1. **Backend health** - Verifies API is responsive
2. **Progressive template** - Checks it exists in system
3. **Test goal** - Creates workspace for testing
4. **Structure validation** - Validates template requirements
5. **Extraction demo** - Shows extraction from sample output
6. **Registration capability** - Demonstrates the registration workflow
7. **Discoverability** - Shows how to verify templates

## Environment Variables

```bash
# Backend API endpoint (used by all tools)
export ACTIVITY_API_ENDPOINT="http://activity.metabob.local"

# Optional: Set for tests
export VERBOSE="true"    # Enable verbose output
export TEST_WORKDIR="/tmp/test"  # Test working directory
```

## Troubleshooting

### Backend Not Available

```bash
# Check if backend is running
kubectl get pods -n activity-system

# Forward port if needed
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &

# Verify health
curl http://activity.metabob.local/health
```

### Template Extraction Failed

```bash
# Check output format
cat execution-output.txt | head -20

# Extract with verbose output
bun run extract-template-from-progressive.ts output.txt 2>&1 | head -20

# Verify alignment markers are present
grep -i "STAGE-\|GOAL-" execution-output.txt
```

### Template Registration Failed

```bash
# Validate template JSON
jq . template.json

# Check required fields
jq '.id, .name, .category, .tasks' template.json

# Try registration with verbose output
bun run register-template-with-backend.ts template.json 2>&1

# Check API endpoint
curl -v http://activity.metabob.local/v2/activities/templates
```

### Template Not Discoverable

```bash
# List all templates
curl "http://activity.metabob.local/v2/activities/templates?limit=100" | jq '.[] | .id'

# Search for specific template
curl "http://activity.metabob.local/v2/activities/templates?limit=100" | \
  jq '.[] | select(.id=="template-id")'

# Check if metrics are recorded
curl "http://activity.metabob.local/v2/activities/templates/template-id" | jq '.metrics'
```

## Design Principles

1. **Non-Invasive** - Progressive template is never modified
2. **Optional** - Extraction and registration are explicit steps
3. **Composable** - Tools work independently and can be piped
4. **Transparent** - All operations logged to stderr for debugging
5. **Safe** - Validation happens before any backend operations
6. **Discoverable** - Clear error messages and troubleshooting help

## Implementation Details

### Template Extraction Algorithm

```
For each alignment marker in output:
  1. Extract stage name (STAGE-1, STAGE-2, STAGE-3)
  2. Extract status (ALIGNED, MISALIGNED, ACHIEVED, FAILED)
  3. Extract description (text after marker)
  4. Map to task with:
     - id: stage name
     - description: status + extracted text
     - prompt: full extracted text
     - dependencies: previous stage

Convert to ActivityTemplate:
  - id: generated from goal (lowercase, hyphens)
  - name: capitalized goal
  - description: extraction summary
  - category: "feature" (default)
  - tags: ["progressive.extraction", "auto-generated"]
  - tasks: extracted task sequence
```

### Backend Integration

After registration:

1. **Backend stores** - Template added to activity_template table
2. **Metrics initialized** - Empty execution metrics created
3. **Indexing** - Template becomes searchable via full-text search
4. **Thompson Sampling** - Template included in alpha/beta scoring
5. **Composition tracking** - Available for future activity compositions

## Best Practices

### For Template Creators

1. **Use clear alignment markers** - Make output parseable
2. **Include descriptions** - Explain what each stage does
3. **Document learnings** - Help future executions understand context
4. **Test extraction** - Run extract tool on sample output before execution
5. **Validate registration** - Verify backend API availability before submitting

### For Template Consumers

1. **Check discoverability** - Verify template appears in search results
2. **Monitor metrics** - Watch execution rates and success percentages
3. **Review Thompson Sampling** - See if new templates get recommendations
4. **Provide feedback** - Use `/teach` and `/warn` commands for scoring
5. **Document patterns** - Record what works for future optimization

## Metrics Tracking

After registration, the backend automatically tracks:

| Metric | Description |
|--------|-------------|
| `total_executions` | Number of times template was executed |
| `successful_executions` | Number of successful executions |
| `failed_executions` | Number of failed executions |
| `success_rate` | Percentage of successful executions |
| `avg_duration_ms` | Average execution time in milliseconds |
| `avg_cost_usd` | Average execution cost |
| `thompson_alpha` | Beta distribution alpha parameter (successes + 1) |
| `thompson_beta` | Beta distribution beta parameter (failures + 1) |
| `total_selections` | Times chosen by Thompson Sampling |
| `last_executed_at` | Timestamp of most recent execution |

## Next Steps

1. **Understand progressive composition** - Read `PROGRESSIVE_COMPOSITION_PATTERN.md`
2. **Learn about templates** - Review `repos/metabob-proto/activities/bootstrap/`
3. **Explore Thompson Sampling** - See `repos/metabob-activity-api/src/routes/activities.ts`
4. **Build your own** - Create progressive templates that extract domain patterns
5. **Contribute** - Share extracted templates with the community

## References

- [Progressive Composition Pattern](./PROGRESSIVE_COMPOSITION_PATTERN.md)
- [Activity System Architecture](./IMPULSE_ACTIVITY_FOUNDATION.md)
- [Template Registration API](./repos/metabob-activity-api/README.md)
- [MiniBob Documentation](./repos/minibob/CLAUDE.md)

---

**Validated**: The complete workflow has been tested without modifying any existing templates. Progressive template remains functional and all three tools work together to extract and register templates.
