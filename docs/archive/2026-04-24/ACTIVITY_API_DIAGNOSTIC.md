# Activity API Diagnostic Tool

Standalone diagnostic script for exploring and manipulating the Activity API backend at `activity.metabob.com`.

## Installation & Setup

### Prerequisites
- Bun runtime installed
- API credentials in `~/.metabob/config.json`

### Configuration

Create or update `~/.metabob/config.json`:

```json
{
  "metabob": {
    "apiKey": "your-api-key-here",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

Alternatively, set environment variables:
- `METABOB_API_KEY` - Your API key
- `METABOB_ENDPOINT` - Backend URL (default: https://activity.metabob.com)

## Usage

```bash
bun diagnostic-activity-api.ts <command> [args] [options]
```

## Commands

### 1. `recommend` - Get Thompson Sampling Recommendations

Queries the Thompson Sampling algorithm to see which activities would be recommended for a given task.

**Usage:**
```bash
bun diagnostic-activity-api.ts recommend <task_description> [options]
```

**Options:**
- `--category <category>` - Filter by category (feature, bugfix, refactor, etc.)
- `--shapes <shape1,shape2>` - Filter by input shapes (comma-separated)
- `--output-shapes <shape1,shape2>` - Filter by expected output shapes
- `--limit <n>` - Number of recommendations (default: 5)

**Examples:**
```bash
# Basic recommendation
bun diagnostic-activity-api.ts recommend "fix authentication bug"

# Filter by category
bun diagnostic-activity-api.ts recommend "add logging" --category feature

# Filter by input shapes
bun diagnostic-activity-api.ts recommend "analyze execution trace" \
  --shapes activityExecutionTrace,errorLog

# Limit results
bun diagnostic-activity-api.ts recommend "refactor code" --limit 3
```

**Output includes:**
- Template ID and name
- Thompson Sampling score (sample value from Beta distribution)
- Beta distribution parameters (α, β)
- Score source (shape_conditioned, global, or legacy)
- Heuristic boost breakdown showing why each template scored the way it did
- Input/output shapes
- Correlation ID for tracking

### 2. `feedback` - Adjust Thompson Sampling Weights

Manually provide feedback to boost or penalize activity templates in Thompson Sampling.

**Usage:**
```bash
bun diagnostic-activity-api.ts feedback <activity_id> <positive|negative> <0-3> [options]
```

**Intensity levels:**
- `0` = 1.5x multiplier (mild adjustment)
- `1` = 2.0x multiplier (moderate adjustment)
- `2` = 2.5x multiplier (strong adjustment)
- `3` = 3.0x multiplier (very strong adjustment)

**Options:**
- `--adjacent` - Also apply reduced multiplier to adjacent activities in composition graph
- `--reason <text>` - Explanation for the feedback

**Examples:**
```bash
# Boost an activity strongly
bun diagnostic-activity-api.ts feedback acquire-codebase-context positive 2

# Penalize an activity with reason
bun diagnostic-activity-api.ts feedback slow-activity negative 1 \
  --reason "takes too long to execute"

# Boost activity and its neighbors
bun diagnostic-activity-api.ts feedback good-activity positive 2 --adjacent
```

**Effect:**
- **Positive feedback**: Multiplies the α (success) parameter
- **Negative feedback**: Multiplies the β (failure) parameter
- Higher α increases probability of selection
- Higher β decreases probability of selection

### 3. `composition` - Query Composition Graph

View activity composition edges showing which activities call other activities and how successful those compositions are.

**Usage:**
```bash
bun diagnostic-activity-api.ts composition <activity_id> [options]
```

**Options:**
- `--min-weight <0-1>` - Filter edges by minimum weight (success rate)
- `--limit <n>` - Maximum number of edges to return

**Examples:**
```bash
# View all compositions for an activity
bun diagnostic-activity-api.ts composition acquire-codebase-context

# Filter by minimum success rate
bun diagnostic-activity-api.ts composition my-activity --min-weight 0.7

# Limit results
bun diagnostic-activity-api.ts composition my-activity --limit 10
```

**Output includes:**
- Parent → Child relationships
- Weight (success rate: success_count / execution_count)
- Average duration and cost
- Input/output shapes
- Last updated timestamp

### 4. `graph` - Show Execution Path

Display the full execution path for an activity, showing both predecessors (what calls it) and successors (what it calls).

**Usage:**
```bash
bun diagnostic-activity-api.ts graph <activity_id>
```

**Examples:**
```bash
bun diagnostic-activity-api.ts graph acquire-codebase-context
```

**Output includes:**
- ⬆️ PREDECESSORS: Activities that call this activity
- 🎯 CURRENT: The activity being analyzed
- ⬇️ SUCCESSORS: Activities called by this activity

Sorted by weight (highest success rate first).

### 5. `template` - Show Template Details

Get detailed information about an activity template including tasks, validation rules, and schemas.

**Usage:**
```bash
bun diagnostic-activity-api.ts template <activity_id>
```

**Examples:**
```bash
# Use full template ID from list command
bun diagnostic-activity-api.ts template "activity:⟨Enforce Specification Compliance⟩"

# Or simple ID if it works
bun diagnostic-activity-api.ts template acquire-codebase-context
```

**Output includes:**
- Template metadata (ID, name, description, category)
- Execution type
- Input/output shapes
- Input/output schemas
- Task list with descriptions and validation rules

### 6. `list` - List Activity Templates

List all available activity templates with filtering options.

**Usage:**
```bash
bun diagnostic-activity-api.ts list [options]
```

**Options:**
- `--category <category>` - Filter by category
- `--type <execution_type>` - Filter by execution type (template, tool, composition, vessel_function)
- `--limit <n>` - Maximum results

**Examples:**
```bash
# List all templates
bun diagnostic-activity-api.ts list

# Filter by category
bun diagnostic-activity-api.ts list --category bugfix

# Filter by type
bun diagnostic-activity-api.ts list --type template --limit 10
```

### 7. `metrics` - Show Activity Metrics

Get aggregate metrics for a specific activity template.

**Usage:**
```bash
bun diagnostic-activity-api.ts metrics <activity_id>
```

**Examples:**
```bash
bun diagnostic-activity-api.ts metrics acquire-codebase-context
```

**Output includes:**
- Execution counts (total, successes, failures)
- Average and total costs
- Average duration
- Thompson Sampling parameters

## Understanding Thompson Sampling

### How It Works

Thompson Sampling is a probabilistic algorithm that balances **exploration** (trying new/uncertain activities) and **exploitation** (using proven activities).

Each activity has two parameters:
- **α (alpha)**: Successes + 1 + heuristic boosts
- **β (beta)**: Failures + 1 + heuristic penalties

The algorithm:
1. Samples a value from Beta(α, β) distribution for each activity
2. Ranks activities by sampled value
3. Returns top N activities

### Score Components

**Base Parameters:**
- Initial α = 1, β = 1 (uniform prior)
- Successes increment α
- Failures increment β

**Heuristic Boosts** (added to α):
- **Tag Match**: +0 to +6 based on tag match quality
- **Shape Compatible**: +3 if input shapes are available
- **Recency**: +1 for templates created in last 30 days
- **Execution History**: +1 to +5 based on execution count
- **Scope Preference**: +1 for org-specific templates
- **Impulse Relevancy**: Variable boost based on loaded impulses
- **Category Match**: +3 for exact category match
- **Output Shape Coverage**: +0 to +4 based on expected output coverage

**Score Sources:**
- **shape_conditioned**: Uses shape-specific success rates (learns per input context)
- **global**: Uses overall success rates across all contexts
- **legacy**: Uses old metrics calculation (deprecated)

### Adjusting Weights

Use `feedback` command to manually adjust weights:

```bash
# If activity works well, boost it
bun diagnostic-activity-api.ts feedback <activity_id> positive 2

# If activity fails or is slow, penalize it
bun diagnostic-activity-api.ts feedback <activity_id> negative 1
```

**Feedback intensity:**
- Level 0: 1.5x multiplier (gentle nudge)
- Level 1: 2.0x multiplier (moderate adjustment)
- Level 2: 2.5x multiplier (strong preference/avoidance)
- Level 3: 3.0x multiplier (very strong preference/avoidance)

## Composition Graph

### What Is It?

The composition graph tracks which activities call other activities and how successful those compositions are.

**Edge Structure:**
- **Parent**: Activity that initiates the composition
- **Child**: Activity that is called
- **Weight**: Success rate (success_count / execution_count)
- **Metadata**: Durations, costs, impulse shapes

### Use Cases

**1. Post-Execution Recommendations**

After an activity completes, the system can recommend next activities based on historical composition patterns.

```bash
# See what activities typically follow this one
bun diagnostic-activity-api.ts composition my-activity
```

**2. Trailblazing**

When an activity fails, the system can try alternative compositions that have higher success rates.

```bash
# Find high-success-rate alternatives
bun diagnostic-activity-api.ts composition my-activity --min-weight 0.8
```

**3. Pattern Learning**

The composition graph learns which activity sequences work well together, creating emergent workflows.

### Viewing Execution Paths

Use the `graph` command to see the full execution context:

```bash
bun diagnostic-activity-api.ts graph acquire-codebase-context
```

This shows:
- What activities typically call this one (predecessors)
- What activities this one typically calls (successors)
- Success rates for each edge

## Advanced Workflows

### 1. Debugging Failed Recommendations

When MiniBob gets poor recommendations:

```bash
# Step 1: Check what's being recommended
bun diagnostic-activity-api.ts recommend "your goal here" --limit 5

# Step 2: Check template details
bun diagnostic-activity-api.ts template <template_id>

# Step 3: Penalize bad templates
bun diagnostic-activity-api.ts feedback <template_id> negative 2 --reason "incorrect output"

# Step 4: Verify recommendations improved
bun diagnostic-activity-api.ts recommend "your goal here" --limit 5
```

### 2. Boosting New Templates

When you create a new template that you want to prefer:

```bash
# Boost the new template
bun diagnostic-activity-api.ts feedback new-template positive 2

# Verify it appears in recommendations
bun diagnostic-activity-api.ts recommend "task description" --limit 5
```

### 3. Analyzing Composition Patterns

To understand how activities compose:

```bash
# Get template list
bun diagnostic-activity-api.ts list --limit 20

# For each interesting template, check its composition
bun diagnostic-activity-api.ts graph <template_id>

# Identify high-weight edges (successful patterns)
bun diagnostic-activity-api.ts composition <template_id> --min-weight 0.7
```

### 4. Shape-Conditioned Recommendations

To test shape-aware recommendations:

```bash
# Without shapes (global scores)
bun diagnostic-activity-api.ts recommend "analyze data"

# With specific input shapes (shape-conditioned scores)
bun diagnostic-activity-api.ts recommend "analyze data" \
  --shapes activityExecutionTrace,errorLog

# Compare the differences in recommendations
```

### 5. Category-Specific Testing

To test category filtering:

```bash
# See all categories
bun diagnostic-activity-api.ts list --limit 50

# Test recommendations for specific category
bun diagnostic-activity-api.ts recommend "improve performance" --category refactor
```

## Troubleshooting

### "No API key found"

Ensure `~/.metabob/config.json` exists and has the correct structure:

```json
{
  "metabob": {
    "apiKey": "your-key-here"
  }
}
```

Or set `METABOB_API_KEY` environment variable.

### "HTTP 404: Template not found"

Use the full template ID from the `list` command output:

```bash
# List templates to get exact IDs
bun diagnostic-activity-api.ts list --limit 10

# Use the exact ID format shown
bun diagnostic-activity-api.ts template "activity:⟨Template Name⟩"
```

### "HTTP 401: Unauthorized"

Your API key is invalid or expired. Get a new key from the identity service.

### "Connection failed"

Check that:
1. You can reach `activity.metabob.com` (try `curl https://activity.metabob.com/health`)
2. Your endpoint in config is correct
3. Network/firewall allows HTTPS connections

## Development

To modify the diagnostic script:

```bash
# Edit the TypeScript file
vim diagnostic-activity-api.ts

# Test changes
bun diagnostic-activity-api.ts --help

# Make executable
chmod +x diagnostic-activity-api.ts
```

## Related Documentation

- `/repos/metabob-activity-api/` - Backend implementation
- `/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Core concepts
- `CLAUDE.md` - Main development guide
- `DISCOVERY_INTEGRATION.md` - Vessel discovery system

## Future Enhancements

Potential additions to this diagnostic tool:

1. **Interactive Mode**: REPL-style interface for exploring the API
2. **Batch Feedback**: Apply feedback to multiple activities at once
3. **Visualization**: Generate graphs showing composition relationships
4. **Diff Mode**: Compare Thompson Sampling scores before/after feedback
5. **Export**: Save recommendations to JSON for analysis
6. **Watch Mode**: Monitor recommendations for a goal over time
7. **Cost Analysis**: Track cost trends per activity
8. **Shape Explorer**: Discover available impulse shapes and their resolvers
