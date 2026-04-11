# Using Registered Activities

**Date**: 2026-04-09

## Overview

This guide shows how to use the 19 activity templates registered with the backend. These templates are now available for Thompson Sampling recommendations and can be used directly via MiniBob.

## Registered Templates

Based on `TEMPLATE_MIGRATION_AND_REGISTRATION_SUMMARY.md`, we successfully registered:

### Development Workflows
- `development:create-typescript-module:v1` - Create new TypeScript module
- `development:create-test:v1` - Create comprehensive tests
- `development:add-feature-to-module:v1` - Add feature to existing module
- `development:investigate-codebase:v1` - Investigate codebase structure

### Validation Activities
- `validation:validate-early-exit:v1` - Validate early exit patterns
- `validation:validate-environment-agnostic:v1` - Validate environment independence

### Bootstrap Activities
- `bootstrap:hello-world-minimal:v1` - Minimal hello world
- `bootstrap:hello-world:v1` - Full hello world
- `bootstrap:fix-bug-complete:v1` - Complete bug fix workflow
- `bootstrap:add-feature-complete:v1` - Complete feature addition
- `bootstrap:refactor-with-tests:v1` - Refactor with test coverage
- `bootstrap:trace-data-flow-single-feature:v1` - Trace data flow
- `bootstrap:trace-enforce-validate-loop:v1` - Trace validation loop
- `bootstrap:git-workflow-sync:v1` - Git workflow synchronization
- `bootstrap:evolve-activity-self-contained:v1` - Activity evolution
- `bootstrap:manage-session-memory:v1` - Session memory management

### Vessel Operations
- `vessel:vessel-test:v1` - Test vessel functionality
- `vessel:search-changes:v1` - Search for changes

### Testing Infrastructure
- `testing:test-minibob-tui-production-package:v1` - Test MiniBob TUI

## Discovery Methods

### 1. Text-Based Search (Direct Lookup)

Search for templates by name, ID, or category:

```bash
# Search by name
minibob doctor surface "create-test" --verbose

# Search by category
minibob doctor surface "bootstrap" --selections=5

# Search by keyword
minibob doctor surface "debug" --selections=3
```

**Syntax**: `minibob doctor surface <query> [--selections=N] [--verbose]`

**Example Output**:
```json
[
  {
    "id": "activity:⟨development:create-test:v1⟩",
    "name": "Create Tests for Module",
    "description": "Creates comprehensive tests for an existing module...",
    "category": "feature",
    "tasks": [...]
  }
]
```

### 2. Thompson Sampling (Goal-Based Recommendations)

Let MiniBob recommend the best template for your goal using Thompson Sampling:

```bash
# Thompson Sampling recommendation
minibob doctor surface --goal "create a unit test" --selections=3 --verbose
```

**How It Works**:
1. MiniBob analyzes your goal description
2. Extracts implied shapes (input/output requirements)
3. Queries backend for templates with Thompson Sampling scores
4. Returns ranked recommendations with confidence scores

**Example Output** (with `--verbose`):
```
Search type: goal-based (Thompson Sampling)
Query: "create a unit test"
Retrieving up to 3 templates...

Recommendations (Thompson Sampling):
  development:create-test:v1: 87%
  bootstrap:hello-world:v1: 45%
  testing:test-minibob-tui-production-package:v1: 23%

✓ Retrieved 3 template(s)
```

### 3. Direct Execution (Single Goal Mode)

Use MiniBob to execute goals directly - it will automatically find and use the best template:

```bash
# Execute a goal (MiniBob finds the best template)
minibob --single "create a test file for the calculator module"

# Interactive REPL mode
minibob
> create tests for src/auth.ts
```

**Process**:
1. MiniBob receives goal
2. Calls backend Thompson Sampling API
3. Selects best template based on confidence score
4. Executes activity with your goal as context
5. Records execution trace for learning

## Using Templates with Variables

Many templates accept variables for customization:

```bash
# View template structure to see required variables
minibob doctor surface "create-test" --format-json | jq '.[] | .variables'

# Execute with variables (via goal description)
minibob --single "create tests for src/calculator.ts using bun test framework"
```

**Common Variables**:
- `modulePath` - Path to module being tested
- `testPath` - Directory for test files
- `testFramework` - Test framework (bun, jest, vitest)
- `targetFile` - File to modify
- `featureDescription` - Description of feature to add

Variables are typically inferred from your goal description.

## Providing Feedback

MiniBob learns from your feedback to improve Thompson Sampling scores:

### In REPL Mode

```bash
minibob
> create tests for auth module

# If it worked well:
> /teach

# If it worked REALLY well:
> /teach!!!

# If it didn't work:
> /warn

# If it was terrible:
> /warn!!!
```

### In Single Goal Mode

Feedback is recorded automatically based on execution success:
- **Success** (all validations pass) → Increases α (successes)
- **Failure** (validation fails, errors) → Increases β (failures)

### Manual Feedback via API

```bash
# Positive feedback (boost score)
curl -X POST https://activity.metabob.com/v2/activities/feedback \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "development:create-test:v1",
    "execution_id": "exec_123",
    "feedback": "positive",
    "strength": 2
  }'

# Negative feedback (penalize score)
curl -X POST https://activity.metabob.com/v2/activities/feedback \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "bootstrap:fix-bug:v1",
    "execution_id": "exec_456",
    "feedback": "negative",
    "strength": 1
  }'
```

## Thompson Sampling Mechanics

**How MiniBob Learns**:

Each template has a Beta distribution:
- **α (alpha)** = successes + positive feedback
- **β (beta)** = failures + negative feedback

**Selection Process**:
1. For each template, sample from Beta(α, β)
2. Select template with highest sample value
3. This balances exploration (trying new templates) with exploitation (using known-good templates)

**Confidence Score**:
```
confidence = α / (α + β)
```

**Initial State** (before any executions):
- α = 1, β = 1 (uniform prior)
- confidence = 50%

**After 10 successful executions**:
- α = 11, β = 1
- confidence = 92%

**After 5 successes, 5 failures**:
- α = 6, β = 6
- confidence = 50% (uncertain)

## Example Workflows

### 1. Create Tests for a Module

```bash
# Method 1: Direct goal
minibob --single "create tests for src/calculator.ts"

# Method 2: Find template first, then execute
minibob doctor surface --goal "create test file" --selections=1 > template.json
minibob --activity template.json --variable modulePath=src/calculator.ts

# Method 3: Interactive REPL
minibob
> create comprehensive tests for the authentication module
> /teach  # if it worked well
```

### 2. Fix a Bug

```bash
# Let Thompson Sampling find the best approach
minibob --single "fix the login bug where users can't sign in with email"

# The backend will:
# 1. Find templates tagged for "bugfix"
# 2. Rank by Thompson Sampling scores
# 3. Select best template (likely bootstrap:fix-bug-complete:v1)
# 4. Execute with your bug description as context
```

### 3. Add a Feature

```bash
# Goal-based selection
minibob --single "add password reset functionality to the auth module"

# Possible templates selected:
# - bootstrap:add-feature-complete:v1 (high confidence)
# - development:add-feature-to-module:v1 (medium confidence)
```

### 4. Investigate Codebase

```bash
# Exploration goal
minibob --single "map how vessels are discovered and registered"

# Will likely use:
# - development:investigate-codebase:v1
```

### 5. Refactor with Tests

```bash
# Refactoring with safety
minibob --single "refactor the impulse resolution logic to be more modular"

# Will use:
# - bootstrap:refactor-with-tests:v1 (ensures tests pass before/after)
```

## Monitoring Learning Progress

### View Template Performance

```bash
# Search for templates and check their structure
minibob doctor surface "create" --selections=5 --format-json | \
  jq '.[] | {id, name, category}'

# Via API - get metrics
curl https://activity.metabob.com/v2/activities/templates/development:create-test:v1/metrics \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq
```

### Dashboard (Coming Soon)

Activity Dashboard will show:
- Template success rates
- Thompson Sampling confidence scores
- Most/least used templates
- Learning curves over time

## Registering New Templates

To add more templates to the learning system:

```bash
# 1. Create template in repos/metabob-proto/activities/
# 2. Validate locally
minibob doctor check repos/metabob-proto/activities/my-new-template.json

# 3. Submit to backend
minibob doctor tutor repos/metabob-proto/activities/my-new-template.json

# 4. Verify registration
minibob doctor surface "my-new-template"
```

## Template Naming Convention

**Pattern**: `<category>:<name>:<version>`

Examples:
- `development:create-test:v1`
- `bootstrap:fix-bug-complete:v1`
- `validation:validate-early-exit:v1`

**Categories**:
- `feature` - New functionality
- `bugfix` - Fix existing issues
- `refactor` - Improve code structure
- `test` - Testing infrastructure
- `tool` - Development tools
- `infrastructure` - System setup

## Schema Requirements

All templates must use **camelCase** field names:

✅ **Correct**:
```json
{
  "id": "my-template:v1",
  "tasks": [{
    "validation": {
      "requiredFiles": ["file.ts"],
      "requiredPatterns": ["pattern"],
      "forbiddenPatterns": ["bad"]
    },
    "retry": {
      "maxAttempts": 3
    }
  }]
}
```

❌ **Incorrect** (will be rejected):
```json
{
  "variant_id": "my-template",
  "tasks": [{
    "validation": {
      "required_files": ["file.ts"],
      "max_attempts": 3
    }
  }]
}
```

## Migration Script

If you have old snake_case templates:

```bash
# Migrate all templates in a directory
./scripts/migrate-templates-to-camelcase.sh repos/metabob-proto/activities/

# Backup files created automatically (.backup extension)
```

## Troubleshooting

### Template Not Found

**Problem**: `No templates found matching: "my-query"`

**Solutions**:
1. Check spelling of template name
2. Try searching by category instead
3. Use broader search terms
4. Verify template is registered: `curl https://activity.metabob.com/v2/activities/templates?limit=50 -H "Authorization: ApiKey $METABOB_API_KEY"`

### Registration Failed

**Problem**: `Backend rejected submission`

**Solutions**:
1. Check for snake_case fields: `grep -r "required_files\|max_attempts" <template-file>`
2. Validate locally first: `minibob doctor check <template-file>`
3. Check for Zod validation errors: `minibob doctor tutor <template-file> --verbose`

### Thompson Sampling Returns Wrong Template

**Problem**: MiniBob selects inappropriate template for goal

**Solutions**:
1. Provide more specific goal description
2. Give negative feedback: `/warn` or `/warn!!!`
3. Manually specify template: `minibob --activity <template-file> --variable ...`
4. Register more specialized templates for that use case

### Low Confidence Scores

**Problem**: All templates have ~50% confidence

**Cause**: Not enough execution data yet

**Solution**: Use templates more! Each execution improves the scores. After 10-20 executions, Thompson Sampling will have learned which templates work best.

## Next Steps

1. **Execute Goals**: Use `minibob --single "<goal>"` frequently
2. **Provide Feedback**: Use `/teach` and `/warn` to guide learning
3. **Register More Templates**: Add specialized templates for your workflows
4. **Monitor Progress**: Watch confidence scores improve over time
5. **Iterate**: Create template variants when existing ones don't quite fit

## Related Documentation

- `TEMPLATE_MIGRATION_AND_REGISTRATION_SUMMARY.md` - Migration results
- `repos/minibob/CLAUDE.md` - MiniBob usage guide
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - System architecture
- `TUTOR_SEARCH_ALIGNMENT_VERIFIED.md` - Verification report
