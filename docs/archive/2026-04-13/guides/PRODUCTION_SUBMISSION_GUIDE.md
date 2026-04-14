# Production Submission Guide for Progressive Templates

## Overview

All validation and registration tools are now configured to submit templates to **`https://activity.metabob.com`** (production) by default.

The workflow for submitting progressive template outputs to production is:

```
Progressive Execution → Extract Template → Register with Production Backend
```

## Quick Start - Production Submission

### 1. Extract Template from Progressive Output

```bash
bun run extract-template-from-progressive.ts execution-output.txt > template.json
```

**What it does:**
- Parses `STAGE-1-ALIGNED`, `STAGE-2-ALIGNED`, `GOAL-ACHIEVED` markers
- Extracts stage descriptions and learnings
- Creates valid template JSON for backend submission
- Outputs to stdout (can be piped)

### 2. Register with Production Backend

```bash
bun run register-template-with-backend.ts template.json
```

**What it does:**
- Validates template structure
- Transforms to backend schema (variant_id, activity_id, task_steps, scope)
- Submits to `https://activity.metabob.com/v2/activities/templates`
- Returns registration confirmation with template ID
- Provides next steps

### 3. One-Line Pipeline

```bash
bun run extract-template-from-progressive.ts output.txt | \
  bun run register-template-with-backend.ts --stdin
```

## Schema Transformation

The registration tool automatically converts from the simple template format to the backend's required schema:

**Input Format:**
```json
{
  "id": "my-template",
  "name": "My Template",
  "description": "A template",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "Do something",
      "prompt": {"template": "..."}
    }
  ]
}
```

**Backend Format (Automatic Conversion):**
```json
{
  "variant_id": "my-template",
  "activity_id": "my-template",
  "variant_name": "My Template",
  "description": "A template",
  "category": "feature",
  "scope": "global",
  "org_id": null,
  "project_id": null,
  "tags": [],
  "task_steps": [
    {
      "id": "task-1",
      "description": "Do something",
      "prompt": {"template": "..."},
      "validation": {"required_patterns": [], "forbidden_patterns": []},
      "dependencies": [],
      "retry": {"maxAttempts": 1, "strategy": "linear"}
    }
  ],
  "metadata": {"author": "auto-extracted", "version": "1.0.0"},
  "variables": [],
  "impulses": []
}
```

**Automatic Conversions:**
- `id` → `variant_id` and `activity_id`
- `name` → `variant_name`
- `tasks` → `task_steps` (with validation/retry/dependencies)
- `scope` defaults to `"global"`
- `org_id`/`project_id` default to `null`

## Verification

After submission, verify template is discoverable:

```bash
# Check if template exists
curl "https://activity.metabob.com/v2/activities/templates?limit=100" | \
  jq '.[] | select(.id=="template-id")'

# Get full template details
curl "https://activity.metabob.com/v2/activities/templates/template-id"

# Check Thompson Sampling recommendations
curl -X POST https://activity.metabob.com/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"task_description":"your template name","limit":10}'
```

## Environment Configuration

### Production (Default)
```bash
# Uses https://activity.metabob.com automatically
bun run register-template-with-backend.ts template.json
```

### Local/Staging Override
```bash
# Use local backend for testing
export ACTIVITY_API_ENDPOINT="http://activity.metabob.local"
bun run register-template-with-backend.ts template.json
```

### Custom Endpoint
```bash
# Use any backend
export ACTIVITY_API_ENDPOINT="https://custom-api.example.com"
bun run register-template-with-backend.ts template.json
```

## Complete Example Workflow

### Step 1: Execute Progressive Template
```bash
minibob --single "Create a feature that validates user input across the application"

# Output includes:
# STAGE-1-ALIGNED: Created validation middleware in src/middleware/validate.ts
# STAGE-2-ALIGNED: Integrated middleware into Express app with error handling
# GOAL-ACHIEVED: All tests pass, feature ready for deployment
```

### Step 2: Save Output
```bash
minibob --single "Create a feature" > /tmp/progressive-output.txt
```

### Step 3: Extract Template
```bash
bun run extract-template-from-progressive.ts /tmp/progressive-output.txt > /tmp/template.json

# Stderr output:
# 📋 Extraction Summary:
#    Goal: Create a feature that validates user input across the application
#    Stages found: 3
#    Template ID: create-a-feature-that-validates-user-input
#    Tasks: 3
```

### Step 4: Register with Production
```bash
bun run register-template-with-backend.ts /tmp/template.json

# Stdout output:
# {
#   "id": "create-a-feature-that-validates-user-input",
#   "name": "Create a feature that validates user input across the application",
#   "message": "Template registered successfully"
# }
```

### Step 5: Verify in Production
```bash
# Check it exists
curl "https://activity.metabob.com/v2/activities/templates/create-a-feature-that-validates-user-input"

# Should return:
# {
#   "id": "create-a-feature-that-validates-user-input",
#   "name": "Create a feature that validates user input across the application",
#   "metrics": {
#     "total_executions": 0,
#     "successful_executions": 0,
#     "failed_executions": 0,
#     "success_rate": 0,
#     ...
#   }
# }
```

## Error Handling

### Schema Validation Errors
The tool validates template structure before submission:
- ✓ Required fields: id, name, description, category, tasks
- ✓ Each task must have: id, description, prompt
- ✗ Rejects templates with missing fields

### Backend Errors
Common issues and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| 404 Not Found | Endpoint wrong | Check ACTIVITY_API_ENDPOINT |
| 400 Bad Request | Schema invalid | Tool auto-converts schema, check output |
| 500 Server Error | Database error | Template already exists or backend issue |
| Connection refused | Backend down | Verify backend is running |

### Debugging

Enable verbose output:
```bash
# See schema conversion
bun run register-template-with-backend.ts template.json 2>&1 | grep -A20 "Template Information"

# Check extracted template structure
jq . /tmp/template.json | head -50
```

## Monitoring Production Templates

### Dashboard Access
```bash
# View all registered templates
curl "https://activity.metabob.com/v2/activities/templates?limit=100"

# Monitor your template's performance
curl "https://activity.metabob.com/v2/activities/templates/template-id" | \
  jq '.metrics'
```

### Thompson Sampling Integration
Templates are automatically included in Thompson Sampling recommendations:

```bash
# Your template appears in recommendations for similar tasks
curl -X POST https://activity.metabob.com/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"task_description":"validate user input","limit":10}' | \
  jq '.recommendations[] | select(.template_id=="create-a-feature-that-validates-user-input")'
```

### Metrics Tracked
- `total_executions` - Times template was executed
- `successful_executions` - Number that succeeded
- `failed_executions` - Number that failed
- `success_rate` - Percentage of successes
- `avg_duration_ms` - Average execution time
- `avg_cost_usd` - Average cost per execution
- `thompson_alpha` - Beta dist. alpha (successes + 1)
- `thompson_beta` - Beta dist. beta (failures + 1)

## Important Notes

✅ **Progressive template unchanged** - Original template continues to work
✅ **Schema auto-converted** - No manual schema mapping needed
✅ **Metrics automatic** - Backend tracks everything after registration
✅ **Production-ready** - All tools configured for production submission
✅ **Safe** - Validation before submission, clear error messages
✅ **Composable** - Tools can be piped for automation

## Support & Troubleshooting

### Common Questions

**Q: Can I submit to both local and production?**
A: Yes, use ACTIVITY_API_ENDPOINT env var to switch between backends.

**Q: What if template already exists?**
A: Backend prevents duplicate IDs. Update existing or use different ID.

**Q: How long does registration take?**
A: Immediate - template available in search within seconds.

**Q: Do I need authentication?**
A: Currently uses unauthenticated endpoints. Production may require credentials.

**Q: Can templates be updated?**
A: Create new variant or use different ID. Backend tracks all versions.

### Debugging Steps

1. **Verify extraction format:**
   ```bash
   cat output.txt | grep "STAGE-\|GOAL-"
   ```

2. **Check template JSON:**
   ```bash
   jq . template.json
   ```

3. **Validate backend reachability:**
   ```bash
   curl -I https://activity.metabob.com/health
   ```

4. **Test with sample template:**
   ```bash
   echo '{"id":"test","name":"Test","description":"Test","category":"feature","tasks":[{"id":"t1","description":"Do it","prompt":{}}]}' | \
     bun run register-template-with-backend.ts --stdin
   ```

## Next Steps

1. Extract progressive template output
2. Register with production backend
3. Monitor metrics and Thompson Sampling scores
4. Collect feedback and iterate

---

**Production Backend**: `https://activity.metabob.com`
**Local Override**: `export ACTIVITY_API_ENDPOINT="http://activity.metabob.local"`
**Status**: Production-ready ✓
