# Teaching MiniBob: Complete Guide to Feedback, Templates, and Variants

## Overview

MiniBob learns through three mechanisms:
1. **Feedback** - Adjust Thompson Sampling via `/cheer` and `/chide`
2. **Template Submission** - Add new templates via `doctor tutor`
3. **Automatic Learning** - Ribosome extracts templates from successful executions

This guide shows you how to use each mechanism effectively.

---

## 1. Providing Feedback (Teaching Thompson Sampling)

### In the REPL (Interactive)

#### `/cheer` - Positive Feedback

Tell MiniBob when an activity did well. This increases the template's Thompson Sampling `alpha` (successes).

**Syntax:**
```
/cheer[!|!!|!!!] [optional message]
```

**Intensity levels:**
- `/cheer` - Mild boost (α += 0.5)
- `/cheer!` - Moderate boost (α += 1.0)
- `/cheer!!` - Strong boost (α += 1.5)
- `/cheer!!!` - Maximum boost (α += 2.0)

**Examples:**
```
> minibob --single "fix the authentication bug"
[activity completes successfully]

> /cheer! That was exactly the right approach
✓ Cheered: activity:fix-auth-bug
  (+ 2 adjacent activities boosted)

> /cheer!!! Perfect! This solved the issue completely
✓ Cheered: activity:fix-auth-bug
```

**What happens:**
- Thompson Sampling `alpha` increases
- Adjacent activities in the composition get smaller boosts
- Future selections favor this template more
- Feedback is logged with your message for learning

#### `/chide` - Negative Feedback

Tell MiniBob when an activity performed poorly. This increases the template's Thompson Sampling `beta` (failures).

**Syntax:**
```
/chide[!|!!|!!!] [optional message]
```

**Intensity levels:**
- `/chide` - Mild penalty (β += 0.5)
- `/chide!` - Moderate penalty (β += 1.0)
- `/chide!!` - Strong penalty (β += 1.5)
- `/chide!!!` - Maximum penalty (β += 2.0)

**Examples:**
```
> minibob --single "add authentication to the API"
[activity uses wrong approach]

> /chide! Wrong approach - should have used middleware
✓ Chided: activity:add-auth-direct

> /chide!!! Completely wrong - broke existing functionality
✓ Chided: activity:add-auth-direct
```

**What happens:**
- Thompson Sampling `beta` increases
- Future selections avoid this template
- Template variants may be created on next failure
- Feedback is logged for pattern analysis

### Via API (Programmatic)

After execution, you can provide feedback programmatically:

```bash
# Positive feedback
curl -X POST "https://activity.metabob.com/v2/activities/feedback" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{
    "activity_id": "exec_123456",
    "direction": "positive",
    "intensity": 2,
    "reason": "Perfect execution, solved the issue"
  }'

# Negative feedback
curl -X POST "https://activity.metabob.com/v2/activities/feedback" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{
    "activity_id": "exec_123456",
    "direction": "negative",
    "intensity": 1,
    "reason": "Wrong approach, should have used different strategy"
  }'
```

### When to Provide Feedback

**Good times to `/cheer`:**
- Activity solved the problem perfectly
- Approach was elegant and maintainable
- Execution was fast and efficient
- Result exceeded expectations

**Good times to `/chide`:**
- Activity used the wrong approach
- Solution was overly complex
- Broke existing functionality
- Took too long or cost too much

**Avoid feedback when:**
- Activity failed due to environment issues
- Problem was unclear or ambiguous
- You're not sure if the approach was right

---

## 2. Creating and Submitting Templates

### Method A: Write Templates Manually

Create a template file (JSON, YAML, or TOML):

```json
{
  "id": "my-custom-activity",
  "name": "My Custom Activity",
  "description": "Does something specific",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "First step",
      "prompt": {
        "template": "Do the first step: {{variable}}",
        "variables": ["variable"]
      },
      "validation": {
        "requiredFiles": ["output.txt"],
        "requiredPatterns": ["success"]
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    }
  ],
  "variables": [
    {
      "name": "variable",
      "type": "string",
      "required": true,
      "description": "Input parameter"
    }
  ]
}
```

**Submit to registry:**
```bash
minibob doctor tutor my-template.json

# With scope control
minibob doctor tutor my-template.json --scope org      # Organization-wide
minibob doctor tutor my-template.json --scope project  # Project-only
minibob doctor tutor my-template.json --scope global   # Public (requires approval)

# Mark as variant
minibob doctor tutor my-template.json --variant

# Submit entire directory
minibob doctor tutor ./templates/
```

### Method B: Extract from Successful Execution (Ribosome)

**The ribosome pattern** mechanically converts execution traces into templates.

**Using `doctor tutor --from-execution`:**

```bash
# 1. Run an activity and capture execution ID
minibob --single "write hello to test.txt" > output.log
EXEC_ID=$(grep "execution_id" output.log | cut -d'"' -f4)

# 2. Extract template from the execution
minibob doctor tutor --from-execution $EXEC_ID \
  --name "Write Hello to File" \
  --tags "file-operations,simple"

# This creates a template that can reproduce the successful execution
```

**What the ribosome extracts:**
- Tool calls in sequence
- Variables used
- Files created/modified
- Validation patterns (what made it succeed)
- Task dependencies
- Impulse requirements

**Via API:**
```bash
curl -X POST "https://activity.metabob.com/v2/ribosome/extract" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{
    "execution_id": "exec_123456",
    "template_name": "Write Hello to File",
    "category": "feature",
    "tags": ["file-operations", "simple"]
  }'
```

### Method C: Let MiniBob Extract Templates Automatically

MiniBob automatically extracts templates from successful improvised executions.

**How it works:**
1. Goal has no matching template → MiniBob improvises
2. Improvisation succeeds → Trace is captured
3. Backend's ribosome extracts template automatically
4. Template enters registry with `confidence` score
5. Thompson Sampling can select it for future goals

**Enable automatic extraction:**
```json
// ~/.metabob/config.json
{
  "learning": {
    "autoExtractTemplates": true,
    "minConfidenceThreshold": 0.7,
    "requireSuccessCount": 2
  }
}
```

---

## 3. Creating Variants (Trailblazing)

**Variants** are modified versions of existing templates, created when the original fails.

### Automatic Variant Creation

When an activity fails, MiniBob can automatically create a variant:

**Triggers:**
1. Template fails execution
2. User provides `/chide` feedback
3. Success rate drops below threshold (e.g., < 50%)

**What gets modified:**
- Prompt templates (different phrasing)
- Retry strategies (more attempts, backoff)
- Validation rules (relaxed/stricter)
- Tool selection (alternatives)
- Task ordering (dependencies)

**Example:**
```bash
# Original template fails
> minibob --single "fix the authentication bug"
[activity:fix-auth-bug fails]

# Provide feedback
> /chide! Wrong approach - should use middleware

# MiniBob creates variant automatically
[Created variant: activity:fix-auth-bug:v2]
[Variant uses middleware-based approach]

# Next time, Thompson Sampling may select the variant
> minibob --single "fix the authorization bug"
[activity:fix-auth-bug:v2 selected - uses middleware]
```

### Manual Variant Creation

Create a variant by modifying an existing template:

```bash
# 1. Retrieve existing template
minibob doctor surface --goal "fix bug" > original.json

# 2. Edit the template
# - Change prompt phrasing
# - Add validation rules
# - Modify retry strategy

# 3. Submit as variant
minibob doctor tutor modified.json --variant
```

**Best practices for variants:**
- Keep the same `category` and similar `tags`
- Modify only one aspect (A/B testing)
- Add descriptive suffix (e.g., `fix-bug-with-tests`)
- Include `parent_template_id` in metadata

---

## 4. Retrieving Templates

### Method A: Text Search

Search templates by name, description, or tags:

```bash
# Search by keyword
minibob doctor surface "debug"

# Search with format control
minibob doctor surface "authentication" --format-yaml

# Limit results
minibob doctor surface "bug fix" --selections 3

# Save to files
minibob doctor surface "deploy" --output file-prefix --format-json
# Creates: deploy-1.json, deploy-2.json, deploy-3.json
```

### Method B: Goal-Based Recommendations (Thompson Sampling)

Get templates ranked by Thompson Sampling for a specific goal:

```bash
# Get recommendations for a goal
minibob doctor surface --goal "fix login bug" --selections 5 --verbose

# Output includes Thompson Sampling metadata:
# - alpha (successes)
# - beta (failures)
# - score (Thompson sample)
# - boost_breakdown (ranking factors)
```

**Example output:**
```json
{
  "id": "activity:fix-auth-bug",
  "name": "Fix Authentication Bug",
  "_recommendation": {
    "method": "thompson_sampling",
    "alpha": 14,
    "beta": 2,
    "score": 0.8732,
    "boost_breakdown": {
      "tag_match": 3,
      "shape_compatible": 2,
      "recency": 1,
      "execution_history": 4
    }
  }
}
```

### Method C: Direct Database Query

Query templates via HTTP API:

```bash
# List all templates
curl "https://activity.metabob.com/v2/activities/templates?limit=100"

# Filter by category
curl "https://activity.metabob.com/v2/activities/templates?category=bugfix"

# Get specific template
curl "https://activity.metabob.com/v2/activities/templates/activity:fix-bug"

# Get template metrics (Thompson Sampling state)
curl "https://activity.metabob.com/v2/activities/templates/activity:fix-bug" | \
  jq '.metrics'
```

---

## 5. Directly Altering Templates

### Method A: Edit and Resubmit

```bash
# 1. Retrieve template
minibob doctor surface --goal "fix bug" > template.json

# 2. Edit the file
vim template.json  # or your favorite editor

# 3. Validate changes
minibob doctor check template.json --verbose

# 4. Resubmit (overwrites existing)
minibob doctor tutor template.json
```

### Method B: Update via API

```bash
curl -X PUT "https://activity.metabob.com/v2/activities/templates/activity:my-template" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d @updated-template.json
```

### Method C: Template Mutation (Experimental)

Apply programmatic transformations:

```bash
# Add retry logic to all tasks
minibob doctor transform template.json --add-retry --max-attempts 3

# Relax validation rules
minibob doctor transform template.json --relax-validation

# Add impulse bindings
minibob doctor transform template.json --add-impulse \
  --type activityExecutionTrace \
  --id similar-execution
```

---

## 6. Understanding Thompson Sampling Impact

### How Feedback Affects Selection

Thompson Sampling uses **Beta distribution** with parameters `α` (alpha) and `β` (beta):

- **α (alpha)**: Successes + positive feedback
- **β (beta)**: Failures + negative feedback
- **Score**: Random sample from Beta(α, β)

**Selection probability:**
```
P(select) = Beta(α, β) × boost_factors
```

**Examples:**

| Template | α | β | Mean | Selection Probability |
|----------|---|---|------|----------------------|
| Never used | 1 | 1 | 50% | Moderate (exploration) |
| Always succeeds | 10 | 1 | 91% | Very high |
| Often fails | 2 | 8 | 20% | Very low |
| After `/cheer!!` | +1.5 to α | - | Higher | Increased |
| After `/chide!` | - | +1.0 to β | Lower | Decreased |

### Viewing Current State

```bash
# Check Thompson Sampling state
minibob doctor health --deep --verbose

# Output:
# ✓ Recommendations: Thompson Sampling active (10 templates available)
#   Top: activity:fix-bug (α=14, β=2, score=0.87)

# Get detailed metrics
curl "https://activity.metabob.com/v2/activities/templates" | \
  jq '.templates[] | {
    id: .id,
    alpha: .metrics.thompson_alpha,
    beta: .metrics.thompson_beta,
    success_rate: .metrics.success_rate,
    total_executions: .metrics.total_executions
  }'
```

---

## 7. How You Can Help

### A. Provide Quality Feedback

**Do:**
- ✅ Explain WHY in your feedback message
- ✅ Be specific about what worked/didn't work
- ✅ Provide feedback soon after execution
- ✅ Use intensity levels appropriately

**Don't:**
- ❌ Give feedback on environment issues
- ❌ Blame templates for unclear requirements
- ❌ Over-penalize exploratory attempts
- ❌ Feedback without understanding what happened

### B. Create Diverse Templates

Help MiniBob learn by contributing templates for:
- Common development tasks (testing, debugging, deployment)
- Domain-specific workflows (your project's patterns)
- Edge cases and error handling
- Performance optimization strategies
- Documentation and communication tasks

**Template diversity helps:**
- Wider coverage of problem types
- Better Thompson Sampling convergence
- More accurate goal→activity matching
- Faster learning loop

### C. Run Activities to Generate Traces

**Every execution helps:**
- Successful executions → Template extraction
- Failed executions → Variant creation
- Improvised executions → Pattern discovery
- Feedback-enhanced → Better Thompson Sampling

**Run regularly:**
```bash
# Use MiniBob for daily development
minibob --single "fix the failing test"
minibob --single "add input validation"
minibob --single "refactor the auth module"

# Each execution generates a trace
# Traces feed the learning loop
# Thompson Sampling improves over time
```

### D. Review and Curate Templates

Help improve template quality:

```bash
# Check for outdated templates
minibob doctor surface --goal "deploy" --verbose

# Review low-confidence templates
curl "https://activity.metabob.com/v2/activities/templates" | \
  jq '.templates[] | select(.metrics.success_rate < 0.5)'

# Update or archive poor performers
minibob doctor tutor updated-template.json
```

### E. Document Patterns

When you discover a successful pattern:

1. **Capture the execution:**
   ```bash
   minibob --single "your successful task" --verbose
   ```

2. **Extract as template:**
   ```bash
   minibob doctor tutor --from-execution <exec-id> \
     --name "Descriptive Name" \
     --tags "category,pattern-type"
   ```

3. **Share with team:**
   ```bash
   minibob doctor tutor template.json --scope org
   ```

### F. Report Issues

Help identify problems:
- Templates that consistently fail
- Thompson Sampling anomalies (always selects wrong template)
- Ribosome extraction errors
- Variant creation bugs

**Report via:**
- GitHub issues: https://github.com/MetabobProject/metabob-devbob/issues
- Template metadata: Add `issue_url` field
- Feedback messages: Include error details

---

## 8. Complete Workflow Example

Let's walk through a complete teaching cycle:

### Step 1: Initial Goal (No Template Exists)

```bash
$ minibob --single "add rate limiting to API endpoint"

[No matching template found]
[MiniBob improvises...]
[✓ Success! Created /src/middleware/rate-limiter.ts]

Execution ID: exec_20260408_123456
```

### Step 2: Extract Template from Success

```bash
$ minibob doctor tutor --from-execution exec_20260408_123456 \
    --name "Add Rate Limiting to API" \
    --tags "middleware,security,rate-limiting"

✓ Template extracted: activity:add-rate-limiting
✓ Submitted to org registry
✓ Thompson Sampling: α=1, β=0 (initial state)
```

### Step 3: Use Template Again

```bash
$ minibob --single "add rate limiting to the auth endpoint"

[Thompson Sampling selects: activity:add-rate-limiting]
[✓ Success! Added rate limiting]
```

### Step 4: Provide Positive Feedback

```bash
$ /cheer!! Perfect - exactly what was needed

✓ Cheered: activity:add-rate-limiting
Updated metrics: α=2.5, β=0
```

### Step 5: Template Fails on Different Case

```bash
$ minibob --single "add rate limiting to WebSocket endpoint"

[activity:add-rate-limiting selected]
[✗ Failed - WebSockets need different approach]
```

### Step 6: Provide Negative Feedback

```bash
$ /chide! HTTP rate limiting doesn't work for WebSockets

✓ Chided: activity:add-rate-limiting
Updated metrics: α=2.5, β=1.0

[Variant created: activity:add-rate-limiting:websocket]
```

### Step 7: Variant Gets Selected Next Time

```bash
$ minibob --single "add rate limiting to the chat WebSocket"

[Thompson Sampling selects: activity:add-rate-limiting:websocket]
[✓ Success! Added WebSocket rate limiting]
```

### Step 8: Cheer the Variant

```bash
$ /cheer!!! Exactly right for WebSockets

✓ Cheered: activity:add-rate-limiting:websocket
Updated metrics: α=3.0, β=0

Future selections will strongly favor the websocket variant for WebSocket contexts
```

---

## 9. Advanced Techniques

### A. Composition Feedback

Feedback on composite activities affects all participants:

```bash
# Activity uses 3 sub-activities
> minibob --single "deploy with tests"
[Composition: run-tests → build-app → deploy-to-prod]

# Positive feedback boosts all three
> /cheer!! Great deployment flow
✓ Cheered: activity:deploy-with-tests
  (+ 3 composed activities boosted)

# Each sub-activity gets proportional boost
# - run-tests: α += 0.5
# - build-app: α += 0.5
# - deploy-to-prod: α += 1.0 (final step gets more)
```

### B. Shape-Based Selection

Templates can specify input/output shapes:

```json
{
  "id": "activity:debug-test-failure",
  "input_shapes": ["test_results"],
  "output_shapes": ["bug_report", "fix_commit"]
}
```

When providing feedback, mention shape compatibility:

```bash
> /cheer! Perfect shape match - expected test_results, produced fix_commit
```

### C. Session-Based Learning

MiniBob tracks sessions for context:

```bash
# Start a session
$ minibob
minibob> goal: fix authentication bug
[Activity 1 executes]

minibob> goal: add tests for the fix
[Activity 2 executes - knows about Activity 1]

minibob> /cheer!! Great sequence
[Boosts both activities and the composition pattern]
```

---

## 10. Troubleshooting

### Issue: Feedback Not Affecting Selection

**Symptoms:**
- `/cheer` doesn't increase selection probability
- Template still selected after multiple `/chide`

**Solutions:**
1. Check Thompson Sampling state:
   ```bash
   minibob doctor health --deep --verbose
   ```

2. Verify feedback was recorded:
   ```bash
   curl "https://activity.metabob.com/v2/activities/templates/<id>" | \
     jq '.metrics'
   ```

3. Ensure enough time has passed (cache refresh):
   - Thompson Sampling cache refreshes every 5 minutes
   - Wait and try again

### Issue: Template Extraction Fails

**Symptoms:**
- `doctor tutor --from-execution` returns error
- Ribosome can't find execution trace

**Solutions:**
1. Verify execution ID:
   ```bash
   curl "https://activity.metabob.com/v2/activities/execution-traces/<id>"
   ```

2. Check trace has required fields:
   - success: true
   - tasks with tool_calls
   - state_snapshot with files

3. Use verbose mode:
   ```bash
   minibob doctor tutor --from-execution <id> --verbose
   ```

### Issue: Templates Not Appearing in Search

**Symptoms:**
- `doctor surface` doesn't find your template
- Template not in recommendations

**Solutions:**
1. Check template scope:
   ```bash
   curl "https://activity.metabob.com/v2/activities/templates/<id>" | \
     jq '.scope, .org_id, .public'
   ```

2. Verify authentication:
   ```bash
   minibob doctor health --verbose
   # Should show: Authenticated: Yes
   ```

3. Rebuild search index:
   ```bash
   curl -X POST "https://activity.metabob.com/v2/admin/rebuild-index" \
     -H "Authorization: ApiKey $METABOB_API_KEY"
   ```

---

## Summary

**Teaching MiniBob is a closed loop:**

1. **Execute** → Generates traces
2. **Feedback** → Adjusts Thompson Sampling (α/β)
3. **Extract** → Ribosome creates templates from successes
4. **Select** → Thompson Sampling picks better templates
5. **Repeat** → Continuous improvement

**Your role:**
- Provide quality feedback with `/cheer` and `/chide`
- Submit templates via `doctor tutor`
- Run activities to generate training data
- Review and curate templates
- Document successful patterns

**MiniBob's role:**
- Execute activities and capture traces
- Extract templates via ribosome
- Select templates via Thompson Sampling
- Create variants when templates fail
- Learn from feedback and execution history

**The result:**
A self-improving system that gets better at achieving your development goals over time.

---

**Next Steps:**
1. Try the complete workflow example above
2. Run `minibob doctor health --deep` to see current state
3. Provide feedback on your next activity execution
4. Extract a template from a successful improvisation
5. Watch Thompson Sampling improve over time

**Resources:**
- [Diagnostic Tools Summary](MINIBOB_DIAGNOSTIC_TOOLS_SUMMARY.md)
- [IMPULSE_ACTIVITY_FOUNDATION.md](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [CLAUDE.md](CLAUDE.md)
