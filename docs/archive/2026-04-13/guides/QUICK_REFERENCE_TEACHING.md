# MiniBob Teaching - Quick Reference Card

## Feedback Commands (In REPL)

```bash
/cheer[!|!!|!!!] [message]    # Positive feedback (boost α)
/chide[!|!!|!!!] [message]    # Negative feedback (boost β)
```

**Intensity:**
- `!` = mild (0.5-1.0 adjustment)
- `!!` = moderate (1.0-1.5 adjustment)
- `!!!` = strong (1.5-2.0 adjustment)

**Example:**
```
> minibob --single "fix the bug"
[activity completes]
> /cheer!! Perfect approach, solved it completely
✓ Cheered: activity:fix-bug (α=12.5, β=1)
```

## Template Operations

### Retrieve Templates

```bash
# Text search
minibob doctor surface "keyword"

# Goal-based (Thompson Sampling)
minibob doctor surface --goal "fix login bug"

# With output control
minibob doctor surface "debug" --format-yaml --selections 5

# Save to files
minibob doctor surface "deploy" --output file-prefix
```

### Submit Templates

```bash
# From file
minibob doctor tutor template.json

# From execution (ribosome)
minibob doctor tutor --from-execution exec_12345 \
  --name "Template Name" \
  --tags "category,type"

# With scope
minibob doctor tutor template.json --scope org      # Organization
minibob doctor tutor template.json --scope project  # Project only
minibob doctor tutor template.json --scope global   # Public

# Mark as variant
minibob doctor tutor template.json --variant

# Entire directory
minibob doctor tutor ./templates/
```

### Validate Templates

```bash
# Validate before submitting
minibob doctor check template.json

# Verbose validation
minibob doctor check template.json --verbose

# JSON output
minibob doctor check template.json --json

# Directory validation
minibob doctor check ./templates/
```

## Thompson Sampling Status

```bash
# Basic health check
minibob doctor health

# Deep check (includes Thompson Sampling)
minibob doctor health --deep --verbose

# Check specific component
minibob doctor health --check learning --verbose
```

**Output shows:**
```
✓ Recommendations: Thompson Sampling active (10 templates)
  Top: activity:fix-bug (α=14, β=2, confidence=87%)
✓ Template Registry: 10 templates registered
  Categories: feature(5), bugfix(3), test(2)
```

## Direct Database Queries

```bash
# List templates
curl "https://activity.metabob.com/v2/activities/templates?limit=100"

# Get template metrics
curl "https://activity.metabob.com/v2/activities/templates/<id>" | \
  jq '.metrics'

# Submit feedback via API
curl -X POST "https://activity.metabob.com/v2/activities/feedback" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{
    "activity_id": "exec_12345",
    "direction": "positive",
    "intensity": 2,
    "reason": "Excellent work"
  }'

# Extract template via ribosome
curl -X POST "https://activity.metabob.com/v2/ribosome/extract" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{
    "execution_id": "exec_12345",
    "template_name": "My Template",
    "category": "feature"
  }'
```

## Template Structure (Minimal)

```json
{
  "id": "activity:my-task",
  "name": "My Task",
  "description": "What this does",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "Step description",
      "prompt": {
        "template": "Do something with {{var}}",
        "variables": ["var"]
      }
    }
  ],
  "variables": [
    {
      "name": "var",
      "type": "string",
      "required": true
    }
  ]
}
```

## Categories

- `feature` - New functionality
- `bugfix` - Fix bugs
- `refactor` - Code improvement
- `test` - Testing tasks
- `tool` - Meta/utility tasks
- `infrastructure` - System/deployment

## Thompson Sampling Interpretation

| α (alpha) | β (beta) | Interpretation |
|-----------|----------|----------------|
| 1 | 1 | Never used (exploration) |
| 10 | 1 | Very reliable (91% mean) |
| 2 | 8 | Often fails (20% mean) |
| High α | Low β | Favored for selection |
| Low α | High β | Avoided |

**Mean = α / (α + β)**

## Common Workflows

### 1. Improvise → Extract → Use

```bash
# 1. Improvise
minibob --single "new task" > log.txt
EXEC=$(grep execution_id log.txt | cut -d'"' -f4)

# 2. Extract
minibob doctor tutor --from-execution $EXEC --name "Task"

# 3. Verify
minibob doctor surface --goal "new task"

# 4. Use again
minibob --single "similar task"
[Template gets selected automatically]
```

### 2. Edit → Validate → Submit

```bash
# 1. Get template
minibob doctor surface --goal "deploy" > template.json

# 2. Edit
vim template.json

# 3. Validate
minibob doctor check template.json --verbose

# 4. Submit
minibob doctor tutor template.json
```

### 3. Execute → Feedback → Improve

```bash
# 1. Execute
minibob --single "fix bug"

# 2. Provide feedback
/cheer!! Excellent approach

# 3. Verify impact
minibob doctor health --deep --verbose
[Shows updated α/β values]

# 4. Execute similar task
minibob --single "fix another bug"
[Higher probability of same template]
```

## Environment Setup

```bash
# ~/.metabob/config.json
{
  "metabob": {
    "apiKey": "your-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "learning": {
    "autoExtractTemplates": true,
    "minConfidenceThreshold": 0.7
  }
}
```

## Troubleshooting

```bash
# Check backend connection
minibob doctor health --check backend

# Verify authentication
minibob doctor health --check config

# Check Thompson Sampling state
minibob doctor health --check learning --verbose

# View recent executions
curl "https://activity.metabob.com/v2/activities/execution-traces?limit=10"

# Check template metrics
curl "https://activity.metabob.com/v2/activities/templates" | \
  jq '.templates[] | {id, alpha: .metrics.thompson_alpha, beta: .metrics.thompson_beta}'
```

## Key Files

- `~/.metabob/config.json` - User configuration
- `.metabob/config.json` - Project configuration
- `.metabob/waking-activities.json` - Startup activities
- `~/.metabob/templates/` - Local template cache

## Important Notes

✅ **Do:**
- Provide specific feedback messages
- Submit templates with good names/descriptions
- Use appropriate scope (org vs. project)
- Validate before submitting
- Monitor Thompson Sampling state

❌ **Don't:**
- Feedback on environment issues
- Submit templates without validation
- Over-penalize experimental attempts
- Submit duplicate templates
- Ignore failed extractions

## Resources

- Full guide: [TEACHING_AND_FEEDBACK_GUIDE.md](TEACHING_AND_FEEDBACK_GUIDE.md)
- Diagnostics: [MINIBOB_DIAGNOSTIC_TOOLS_SUMMARY.md](MINIBOB_DIAGNOSTIC_TOOLS_SUMMARY.md)
- Foundation: [docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- Main docs: [CLAUDE.md](CLAUDE.md)
