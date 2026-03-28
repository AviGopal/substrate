# Meta-Learning Templates

The meta-learning templates enable the system to learn from its own execution history and continuously improve. These templates implement the self-improvement loop: **Execute → Analyze → Learn → Evolve**.

## Overview

Five core templates implement different aspects of the learning system:

1. **analyze-failure** - Understand why executions fail
2. **discover-missing-impulses** - Find impulses that would have helped
3. **specialize-activity** - Create optimized variants for specific contexts
4. **generalize-pattern** - Extract reusable patterns from variants
5. **discover-composition-patterns** - Learn which activity sequences work

## The Learning Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    Activity Execution                        │
└───────────────┬─────────────────────────────────────────────┘
                │
         ┌──────┴──────┐
         │   Success?   │
         └──────┬──────┘
                │
     ┌──────────┼──────────┐
     │ Failure  │  Success │
     ▼          │          ▼
┌─────────┐    │    ┌──────────────┐
│ Analyze │    │    │ Extract      │
│ Failure │    │    │ Pattern      │
└────┬────┘    │    └──────┬───────┘
     │         │           │
     ▼         │           ▼
┌─────────────┐│    ┌──────────────┐
│ Discover    ││    │ Generalize   │
│ Missing     ││    │ Pattern      │
└──────┬──────┘│    └──────┬───────┘
       │       │           │
       ▼       │           ▼
┌─────────────┐│    ┌──────────────┐
│ Specialize  ││    │ Record       │
│ Activity    ││    │ Composition  │
└──────┬──────┘│    └──────┬───────┘
       │       │           │
       └───────┴───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Thompson Sampling    │
    │ Learns Best Options  │
    └──────────────────────┘
```

## Template Details

### 1. analyze-failure-v1

**Purpose**: Diagnose why an activity execution failed

**Input Schema**:
- `execution_trace` (required) - The failed execution to analyze
- `goal` (required) - Original goal being pursued
- `activity_template` (optional) - Template that was executed

**Output Schema**:
- `failure_analysis` - Structured analysis with root cause, missing impulses, recommended fixes

**Task Flow**:
1. Extract failure facts (what happened, where it failed, error message)
2. Categorize failure type (missing_context, incorrect_assumption, tool_misuse, etc.)
3. Identify missing context (which impulses/files/tools were needed)
4. Generate remediation strategy (immediate retry + template improvements)
5. Create failure analysis report

**Usage**:
```bash
# Analyze a failed execution
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "analyze-failure-v1",
    "impulses": [
      {"pointer": {"type": "activityExecutionTrace", "execution_id": "exec_failed_123"}},
      {"pointer": {"type": "memo", "content": "Fix authentication bug"}}
    ]
  }'
```

**When to Use**:
- After any failed execution
- When success rate drops for an activity
- When you need to understand why something isn't working

### 2. discover-missing-impulses-v1

**Purpose**: Compare failed execution against successful ones to find missing impulses

**Input Schema**:
- `execution_trace` (required) - The failed execution
- `activity_id` (required) - Activity ID to query for successful executions

**Output Schema**:
- `impulse_recommendation` - Ranked list of impulses with frequency, confidence, priority

**Task Flow**:
1. Query backend for successful executions of same activity
2. Extract impulses used in the failed execution
3. Compute impulse frequency in successes
4. Rank recommendations by confidence (frequency × missing_from_failure)

**Usage**:
```bash
# Find what impulses would have helped
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "discover-missing-impulses-v1",
    "impulses": [
      {"pointer": {"type": "activityExecutionTrace", "execution_id": "exec_failed_123"}},
      {"pointer": {"type": "memo", "content": "debug-null-pointer"}}
    ]
  }'
```

**When to Use**:
- After running analyze-failure
- When you want counterfactual reasoning ("what if we had X?")
- To understand which impulses correlate with success

### 3. specialize-activity-v1

**Purpose**: Create a specialized variant optimized for a specific context

**Input Schema**:
- `activity_template` (required) - Base template to specialize
- `failure_analysis` (required) - Analysis of what's missing
- `impulse_recommendation` (required) - Recommended additional impulses
- `specialization_context` (optional) - What context to specialize for

**Output Schema**:
- `activity_template` - New specialized variant
- `specialization_metadata` - What makes this variant different

**Task Flow**:
1. Identify specialization opportunity (input, task, domain, or goal-category)
2. Update input schema to require discovered impulses
3. Update task sequence to prevent failures (add validation, reorder tasks)
4. Generate variant metadata (ID, when to use, Thompson priors)
5. Assemble complete specialized template

**Usage**:
```bash
# Create specialized variant
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "specialize-activity-v1",
    "impulses": [
      {"pointer": {"type": "activityTemplate", "activity_id": "debug-null-pointer"}},
      {"pointer": {"type": "memo", "content": "{...failure_analysis...}"}},
      {"pointer": {"type": "memo", "content": "{...impulse_recommendation...}"}}
    ]
  }'
```

**When to Use**:
- After discovering missing impulses
- When an activity has mixed success rates across different contexts
- When you want to optimize for a specific domain (e.g., "bugfix with tests")

### 4. generalize-pattern-v1

**Purpose**: Extract common patterns from multiple specialized variants

**Input Schema**:
- `activity_template_set` (required) - Set of related variants to analyze
- `execution_trace_set` (optional) - Execution history for context

**Output Schema**:
- `activity_template` - Generalized template
- `generalization_report` - What was generalized and why

**Task Flow**:
1. Analyze variant similarities (common inputs, tasks, outputs)
2. Determine generalization strategy (make optional, parameterize, extract core)
3. Create generalized input schema (required core + optional additions)
4. Create adaptive task sequence (conditional execution based on available inputs)
5. Create generalization report

**Usage**:
```bash
# Extract generalized pattern
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "generalize-pattern-v1",
    "impulses": [
      {"pointer": {"type": "activityTemplate", "activity_id": "debug-with-tests-v1"}},
      {"pointer": {"type": "activityTemplate", "activity_id": "debug-with-history-v1"}},
      {"pointer": {"type": "activityTemplate", "activity_id": "debug-with-both-v1"}}
    ]
  }'
```

**When to Use**:
- When you have many specialized variants doing similar things
- When you want to reduce template proliferation
- When you want flexibility (work with or without optional context)

### 5. discover-composition-patterns-v1

**Purpose**: Learn which activity sequences successfully achieve specific goal types

**Input Schema**:
- `goal_category` (required) - Category of goal to analyze (bugfix, feature, refactor)
- `goal_text` (optional) - Specific goal text for semantic matching
- `min_execution_count` (optional) - Minimum executions to consider pattern significant

**Output Schema**:
- `composition_patterns` - Discovered activity sequences with success rates
- `goal_execution_paths` - Goal → activity path mappings for Thompson Sampling

**Task Flow**:
1. Query backend for executions related to goal category
2. Group executions by semantic goal similarity
3. Extract activity sequence patterns with success metrics
4. Rank by Thompson Sampling (Beta distribution)
5. Identify composition insights (success patterns, anti-patterns)
6. Format for backend storage (goal_execution_paths table)

**Usage**:
```bash
# Discover bugfix composition patterns
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "discover-composition-patterns-v1",
    "impulses": [
      {"pointer": {"type": "memo", "content": "bugfix"}},
      {"pointer": {"type": "memo", "content": "3"}}
    ]
  }'
```

**When to Use**:
- Periodically (daily/weekly) to learn from accumulated execution history
- When you want to understand which activity sequences work together
- To implement path-level Thompson Sampling (not just activity-level)

## Workflow Examples

### Example 1: Improve Failed Activity

```bash
# Step 1: Execute activity (fails)
execution_id="exec_failed_123"

# Step 2: Analyze why it failed
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -d '{"variant_id": "analyze-failure-v1", "impulses": [...]}'
# Returns: failure_analysis

# Step 3: Discover what impulses would have helped
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -d '{"variant_id": "discover-missing-impulses-v1", "impulses": [...]}'
# Returns: impulse_recommendation (test_file: 90% confidence)

# Step 4: Create specialized variant that requires test_file
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -d '{"variant_id": "specialize-activity-v1", "impulses": [...]}'
# Returns: new activity template with test_file required

# Step 5: Register new variant
curl -X POST http://activity.metabob.local/v2/activities/templates \
  -d '{"variant_id": "debug-null-pointer-with-tests-v1", ...}'

# Step 6: Thompson Sampling now compares original vs specialized variant
# System learns which works better over time
```

### Example 2: Reduce Template Proliferation

```bash
# You have 3 specialized variants:
# - debug-with-tests-v1
# - debug-with-history-v1
# - debug-with-tests-and-history-v1

# Extract generalized pattern
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -d '{
    "variant_id": "generalize-pattern-v1",
    "impulses": [
      {"pointer": {"type": "activityTemplate", "activity_id": "debug-with-tests-v1"}},
      {"pointer": {"type": "activityTemplate", "activity_id": "debug-with-history-v1"}},
      {"pointer": {"type": "activityTemplate", "activity_id": "debug-with-tests-and-history-v1"}}
    ]
  }'

# Returns: generalized template with:
# - Required: goal, error, source
# - Optional: test_file, git_history
# - Conditional tasks that run based on available inputs

# Now 1 template handles all 3 cases
```

### Example 3: Learn Composition Patterns

```bash
# Analyze execution history for bugfixes
curl -X POST http://activity.metabob.local/v2/activities/execute \
  -d '{
    "variant_id": "discover-composition-patterns-v1",
    "impulses": [
      {"pointer": {"type": "memo", "content": "bugfix"}}
    ]
  }'

# Returns:
# Goal: "Fix authentication bug"
# Recommended Path (87.5% success):
#   1. debug-null-pointer
#   2. write-fix
#   3. run-tests
# Alternative Path (60% success):
#   1. analyze-code
#   2. apply-patch

# System now recommends sequences, not just individual activities
```

## Integration with Goal Processing

The meta-learning templates integrate with MiniBob's goal processor:

1. **Goal Enrichment**: LLM understands user intent
2. **Activity Recommendation**: Thompson Sampling selects activity
3. **Execution**: Activity runs with impulses
4. **Verification**: Did we achieve the goal?
5. **Learning**: Update Thompson priors, impulse relevance
6. **Meta-Learning**: Run analyze-failure or discover-composition-patterns

```typescript
// In goal-processor.ts
async function handleExecutionFailure(trace: ExecutionTrace) {
  // Analyze the failure
  const analysis = await executeActivity({
    variant_id: 'analyze-failure-v1',
    impulses: [
      { pointer: { type: 'activityExecutionTrace', execution_id: trace.id }},
      { pointer: { type: 'memo', content: trace.goal }}
    ]
  });

  // Discover missing impulses
  const recommendations = await executeActivity({
    variant_id: 'discover-missing-impulses-v1',
    impulses: [
      { pointer: { type: 'activityExecutionTrace', execution_id: trace.id }},
      { pointer: { type: 'memo', content: trace.activity_id }}
    ]
  });

  // Create specialized variant if high confidence
  if (recommendations.high_priority_count > 0) {
    await executeActivity({
      variant_id: 'specialize-activity-v1',
      impulses: [...]
    });
  }
}
```

## Homoiconic Learning

The system is **homoiconic** - it can operate on its own execution traces:

- Activities generate execution traces
- Execution traces are impulses
- Meta-learning activities consume execution traces
- Meta-learning activities produce new activity templates
- New templates compete via Thompson Sampling

This creates a continuous learning loop where the system improves itself from its own experience.

## Deployment

Meta-learning templates are deployed via:

```bash
# Register all meta-learning templates
cd scripts
API_URL=http://activity.metabob.local bun run seed-meta-learning-templates.ts

# Or register all templates including meta-learning
API_URL=http://activity.metabob.local bun run seed-bootstrap-templates.ts
```

## Metrics and Observability

View meta-learning activity executions in the Activity Dashboard:

- Success rates for analyze-failure, discover-missing-impulses, etc.
- How often specialization is triggered
- How many variants are created vs generalized
- Composition pattern discovery frequency

## Future Enhancements

1. **Automated Trigger**: Run meta-learning automatically after failures
2. **Periodic Discovery**: Cron job for discover-composition-patterns
3. **Variant Pruning**: Remove poorly-performing variants
4. **Cross-Vessel Learning**: Share learned patterns between vessels
5. **Explainability**: Show why a variant was created or generalized

## Related Documentation

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Core primitives
- `docs/architecture/GOAL_AWARE_RECOMMENDATION.md` - Goal processing
- `RIBOSOME_ARCHITECTURE.md` - Template extraction from improvisation
- `LEARNING_SYSTEM_PROGRESS.md` - Learning system phases
