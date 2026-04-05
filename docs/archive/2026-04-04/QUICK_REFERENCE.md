# Progressive Template Validation - Quick Reference

## 30-Second Summary

Progressive template execution output → extract template → register with backend → verified discoverable.

**Progressive template is never modified.** Extraction and registration are explicit, optional steps.

## One-Line Commands

| Task | Command |
|------|---------|
| **Validate System** | `./run-progressive-validation.sh` |
| **Test Backend** | `bun run test-progressive-template-creation.ts` |
| **Extract Template** | `bun run extract-template-from-progressive.ts output.txt > template.json` |
| **Register Template** | `bun run register-template-with-backend.ts template.json` |
| **Extract + Register** | `bun run extract-template-from-progressive.ts output.txt \| bun run register-template-with-backend.ts --stdin` |

## Files

| File | Purpose | Run |
|------|---------|-----|
| `test-progressive-template-creation.ts` | Validation suite | `bun run` |
| `extract-template-from-progressive.ts` | Parse output → JSON | `bun run` |
| `register-template-with-backend.ts` | Submit to backend | `bun run` |
| `run-progressive-validation.sh` | Complete validation | `./` |
| `PROGRESSIVE_TEMPLATE_VALIDATION.md` | Full documentation | read |

## Quick Workflow

### Step 1: Verify System Ready
```bash
./run-progressive-validation.sh
```

### Step 2: Execute Progressive Template
```bash
minibob --single "Create a feature"
# Saves output with alignment markers:
# STAGE-1-ALIGNED: ...
# STAGE-2-ALIGNED: ...
# GOAL-ACHIEVED: ...
```

### Step 3: Extract and Register
```bash
bun run extract-template-from-progressive.ts execution-output.txt | \
  bun run register-template-with-backend.ts --stdin
```

### Step 4: Verify Discoverable
```bash
curl "http://activity.metabob.local/v2/activities/templates?limit=100" | \
  jq '.[] | select(.id=="template-id")'
```

## Input/Output

**Extraction Input (alignment markers expected)**:
```
STAGE-1-ALIGNED: <description>
STAGE-2-ALIGNED: <description>
GOAL-ACHIEVED: <description>
```

**Extraction Output (stdout)**:
```json
{
  "id": "template-id",
  "name": "Template Name",
  "description": "...",
  "category": "feature",
  "tasks": [...]
}
```

**Registration Output (stdout)**:
```json
{
  "id": "template-id",
  "name": "Template Name",
  "message": "Template registered successfully"
}
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/v2/activities/templates/{id}` | Get specific template |
| `GET` | `/v2/activities/templates?limit=100` | List templates |
| `POST` | `/v2/activities/templates` | Register template |
| `POST` | `/v2/activities/recommend` | Get recommendations |

## Environment

```bash
# Required (with defaults)
export ACTIVITY_API_ENDPOINT="http://activity.metabob.local"

# Optional
export VERBOSE="true"
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend not available | `kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &` |
| Extraction fails | Check output has `STAGE-1-ALIGNED` markers: `grep "STAGE-" output.txt` |
| Registration fails | Validate JSON: `jq . template.json` |
| Template not found | Check ID matches: `jq '.id' template.json` |

## Common Pipelines

### Extract Only
```bash
bun run extract-template-from-progressive.ts output.txt > template.json
```

### Extract + Save for Review
```bash
bun run extract-template-from-progressive.ts output.txt | tee template.json
```

### Extract + Register + Verify
```bash
TEMPLATE_ID=$(bun run extract-template-from-progressive.ts output.txt | \
  bun run register-template-with-backend.ts --stdin | \
  jq -r '.id')
curl "http://activity.metabob.local/v2/activities/templates/${TEMPLATE_ID}"
```

### Batch Register
```bash
for output in /tmp/outputs/*.txt; do
  echo "Processing: $output"
  bun run extract-template-from-progressive.ts "$output" | \
    bun run register-template-with-backend.ts --stdin
done
```

## Key Facts

✅ **Progressive template unchanged** - Never modified
✅ **Optional** - Extraction/registration are explicit steps
✅ **Safe** - Validation before any backend operations
✅ **Composable** - Tools work independently
✅ **Transparent** - All operations logged to stderr
✅ **Metrics automatic** - Backend tracks everything
✅ **Thompson Sampling** - Integrates automatically

## Help

```bash
# Test suite help
bun run test-progressive-template-creation.ts

# Extraction help
bun run extract-template-from-progressive.ts

# Registration help
bun run register-template-with-backend.ts

# Full documentation
PROGRESSIVE_TEMPLATE_VALIDATION.md

# Implementation details
IMPLEMENTATION_SUMMARY.md
```

## Examples

### Simple Registration
```bash
# Create a test template
cat > test-template.json << 'EOF'
{
  "id": "test-template",
  "name": "Test Template",
  "description": "A test template",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "Do something",
      "prompt": {"template": "Do it!"}
    }
  ]
}
EOF

# Register it
bun run register-template-with-backend.ts test-template.json
```

### Real Extraction from Sample
```bash
# Create sample output
cat > sample-output.txt << 'EOF'
STAGE-1-ALIGNED: Created middleware file
STAGE-2-ALIGNED: Integrated with routes
GOAL-ACHIEVED: All tests pass
EOF

# Extract and register
bun run extract-template-from-progressive.ts sample-output.txt | \
  bun run register-template-with-backend.ts --stdin
```

### Check Metrics
```bash
# After registration, check metrics
curl "http://activity.metabob.local/v2/activities/templates/template-id" | \
  jq '.metrics'

# Should show:
# {
#   "total_executions": 0,
#   "successful_executions": 0,
#   "failed_executions": 0,
#   "success_rate": 0,
#   ...
# }
```

## Remember

- 🎯 **Progressive template always works** - These tools don't affect it
- 🔒 **Safe to use** - Validation happens before submission
- 📊 **Metrics automatic** - Backend handles everything
- 🔄 **Composable** - Pipe tools together for automation
- 📝 **Well-documented** - See `PROGRESSIVE_TEMPLATE_VALIDATION.md` for details

---

For complete documentation, see: `PROGRESSIVE_TEMPLATE_VALIDATION.md`
For implementation details, see: `IMPLEMENTATION_SUMMARY.md`
