# Activity Decomposition Guidelines

## Purpose

This document defines how to break down complex activities into small, composable, reusable chunks that can be chained together to achieve larger goals.

## Core Principles

### 1. Single Responsibility Principle

**Each activity should do ONE thing well.**

❌ **Bad: Kitchen Sink Activity**
```json
{
  "id": "analyze-and-fix-everything",
  "tasks": [
    "Fetch data from API",
    "Parse JSON response",
    "Analyze for errors",
    "Generate report",
    "Fix identified issues",
    "Run tests",
    "Commit changes"
  ]
}
```

✅ **Good: Focused Activities**
```json
{
  "id": "fetch-api-data",
  "description": "Fetch data from specified API endpoint",
  "input_shapes": ["api_endpoint"],
  "output_shapes": ["api_response"]
}

{
  "id": "parse-json-response",
  "description": "Parse JSON and extract relevant fields",
  "input_shapes": ["api_response"],
  "output_shapes": ["structured_data"]
}

{
  "id": "analyze-data-for-errors",
  "description": "Scan data for error patterns",
  "input_shapes": ["structured_data"],
  "output_shapes": ["error_report"]
}
```

**Why:** Small activities are easier to test, reuse, and compose.

### 2. Clear Input/Output Contracts

**Every activity must declare:**
- What data it needs (input shapes)
- What data it produces (output shapes)
- What side effects it has (if any)

**Shape Naming Convention:**
- Use descriptive names: `api_response`, `error_report`, `test_results`
- Be specific: `github_pr_data` not just `data`
- Indicate format when relevant: `json_config`, `markdown_report`

**Example:**
```json
{
  "id": "generate-markdown-report",
  "description": "Convert structured metrics into markdown format",
  "input_shapes": ["metrics_data", "report_template"],
  "output_shapes": ["markdown_report"],
  "side_effects": ["writes file to disk"],
  "contextRequirements": [
    {
      "id": "metrics",
      "type": "file",
      "source": "metrics.json",
      "required": true
    },
    {
      "id": "template",
      "type": "file",
      "source": "report-template.md",
      "required": false,
      "default": "## Metrics Report\n\n{{metrics}}"
    }
  ]
}
```

### 3. Minimal Dependencies

**Reduce coupling between activities.**

❌ **Bad: Tight Coupling**
```json
{
  "id": "activity-a",
  "tasks": [{
    "prompt": "Use the exact output format from activity-b step 3..."
  }]
}
```

✅ **Good: Loose Coupling via Shapes**
```json
{
  "id": "activity-a",
  "input_shapes": ["api_metrics"],
  "description": "Accepts any activity that produces api_metrics shape"
}

{
  "id": "activity-b",
  "output_shapes": ["api_metrics"],
  "description": "Produces standard api_metrics shape"
}
```

**Why:** Activities can be swapped, improved, or replaced without breaking compositions.

### 4. Reusable Patterns

**Extract common operations into separate activities.**

**Common Patterns to Extract:**

- **Data Fetching:** API calls, file reads, database queries
- **Data Transformation:** Parsing, filtering, mapping, aggregating
- **Validation:** Schema checks, constraint verification
- **Output:** Writing files, formatting reports, API posts
- **Control Flow:** Conditional execution, retry logic, error handling

**Example Library of Atomic Activities:**
```
fetch-json-from-api
parse-json-to-object
filter-by-criteria
sort-by-field
calculate-statistics
format-as-markdown
write-to-file
query-database
validate-schema
retry-with-backoff
```

## Decomposition Process

### Step 1: Identify the Goal

**Ask:** What is the single, well-defined outcome this activity achieves?

Example: "Generate a daily report of API performance metrics"

### Step 2: Break Down Into Phases

**Common phases:**
1. **Input/Setup:** Gather required data
2. **Processing:** Transform, analyze, calculate
3. **Output:** Format and deliver results
4. **Cleanup:** Release resources, update state

Example breakdown:
1. Fetch API metrics from backend
2. Calculate success rates and averages
3. Format as markdown report
4. Write to file and create GitHub issue

### Step 3: Define Data Flow

**Map the shapes between phases:**

```
[api_endpoint]
    ↓
[fetch-api-data]
    ↓
[api_response]
    ↓
[parse-json]
    ↓
[metrics_data]
    ↓
[calculate-stats]
    ↓
[statistical_summary]
    ↓
[format-markdown]
    ↓
[markdown_report]
    ↓
[write-file]
    ↓
[file_path]
```

### Step 4: Create Activities for Each Phase

Each box in the data flow becomes an activity.

### Step 5: Compose and Test

Chain activities together and test the composition.

## Activity Size Guidelines

### Too Small (Under-Decomposed)

**Signs:**
- Activity is just a single bash command
- No meaningful error handling possible
- Output is too granular to be useful

**Example:**
```json
{
  "id": "echo-hello",
  "tasks": [{"prompt": "Run: echo 'hello'"}]
}
```

**Fix:** Combine with related setup or context.

### Just Right

**Characteristics:**
- 1-3 tasks
- Clear, testable outcome
- Reusable in multiple contexts
- 10-60 seconds execution time
- Handles its own errors

**Example:**
```json
{
  "id": "fetch-api-metrics",
  "description": "Fetch metrics from activity API with retry logic",
  "tasks": [
    {
      "id": "fetch-with-auth",
      "description": "Call API with authentication",
      "retry": {"maxAttempts": 3, "strategy": "exponential"}
    },
    {
      "id": "validate-response",
      "description": "Verify response schema"
    },
    {
      "id": "save-to-file",
      "description": "Write metrics to JSON file"
    }
  ]
}
```

### Too Large (Over-Decomposed)

**Signs:**
- More than 7 tasks
- Takes longer than 2 minutes
- Does multiple unrelated things
- Hard to name clearly
- Mixes concerns (fetching + analyzing + reporting)

**Example:**
```json
{
  "id": "analyze-fix-test-commit",
  "tasks": [
    "Fetch code", "Parse AST", "Find bugs",
    "Generate fixes", "Apply patches", "Run tests",
    "Format code", "Commit changes", "Push to remote"
  ]
}
```

**Fix:** Split into:
- `analyze-code` → `generate-fixes` → `apply-and-test` → `commit-changes`

## Composition Patterns

### Pattern 1: Sequential Pipeline

**Use when:** Each step depends on the previous output

```
activity-a → activity-b → activity-c
```

**Example:**
```
fetch-data → transform-data → write-output
```

### Pattern 2: Fan-Out/Fan-In

**Use when:** Multiple parallel operations, then combine

```
        ┌─ activity-b ─┐
activity-a             activity-d
        └─ activity-c ─┘
```

**Example:**
```
        ┌─ analyze-errors ─┐
fetch-logs                  generate-report
        └─ check-performance ─┘
```

### Pattern 3: Conditional Execution

**Use when:** Next step depends on result

```
activity-a → [if success] → activity-b
          → [if failure] → activity-c
```

**Example:**
```
run-tests → [if pass] → deploy
          → [if fail] → notify-team
```

### Pattern 4: Retry Loop

**Use when:** Operation may fail but should retry

```
activity-a → [retry up to 3x] → activity-b
```

**Example:**
```
fetch-api → [retry with backoff] → parse-response
```

## Shape Catalog

### Standard Shapes

**Data Formats:**
- `json_data` - Generic JSON object
- `yaml_config` - YAML configuration
- `markdown_text` - Markdown document
- `source_code` - Programming files
- `csv_data` - Tabular data

**API Responses:**
- `api_response` - Generic API response
- `api_metrics` - Performance metrics from backend
- `api_template` - Activity template from backend
- `api_trace` - Execution trace data

**Reports:**
- `error_report` - List of errors/issues
- `metrics_summary` - Statistical summary
- `analysis_result` - Analysis findings
- `test_results` - Test execution results

**Artifacts:**
- `file_path` - Path to created file
- `git_commit` - Commit hash/reference
- `pr_url` - Pull request URL
- `issue_number` - GitHub issue number

### Creating New Shapes

**When to create:**
- Specific data structure used by multiple activities
- Standard format for a domain (e.g., `github_pr_data`)
- Clear semantic meaning (e.g., `user_credentials`)

**Naming:**
- Use underscores: `api_response` not `apiResponse`
- Be specific: `github_issue` not `issue`
- Include format when relevant: `json_config` not `config`

## Anti-Patterns to Avoid

### 1. God Activity

**Problem:** One activity that does everything

**Example:** `analyze-refactor-test-deploy-monitor`

**Fix:** Break into focused activities

### 2. Leaky Abstraction

**Problem:** Activity exposes implementation details

**Example:** Activity output includes temporary file paths or internal state

**Fix:** Return only meaningful, stable outputs

### 3. Hidden Dependencies

**Problem:** Activity relies on global state or previous activities

**Example:** Assumes files exist from previous unrelated activity

**Fix:** Declare all inputs explicitly in input_shapes

### 4. Premature Optimization

**Problem:** Creating 50 tiny activities "for reuse" before knowing patterns

**Example:** Separate activities for each API endpoint

**Fix:** Start with working activities, extract patterns as they emerge

### 5. Over-Specification

**Problem:** Activity enforces too many constraints

**Example:** "Input MUST be JSON with exactly these 15 fields..."

**Fix:** Accept any input matching general shape, handle variations gracefully

## Checklist for New Activities

Before creating an activity, verify:

- [ ] **Single responsibility:** Does ONE thing well
- [ ] **Clear name:** Describes what it does (verb-noun format)
- [ ] **Input shapes declared:** All required data specified
- [ ] **Output shapes declared:** All produced data specified
- [ ] **1-3 tasks:** Not too small, not too large
- [ ] **30-90 second execution:** Fast enough to be useful
- [ ] **Error handling:** Appropriate retry/validation
- [ ] **Reusable:** Could be used in different contexts
- [ ] **Testable:** Clear success/failure criteria
- [ ] **Documented:** Description explains purpose

## Example: Decomposing a Complex Activity

### Before (Monolithic)

```json
{
  "id": "assess-development-loop",
  "description": "Analyze workflow performance and generate improvement recommendations",
  "tasks": [
    {
      "id": "fetch-workflow-runs",
      "description": "Get recent GitHub Actions runs via gh CLI"
    },
    {
      "id": "parse-run-data",
      "description": "Extract success rates and durations"
    },
    {
      "id": "fetch-activity-metrics",
      "description": "Query backend for activity performance"
    },
    {
      "id": "correlate-data",
      "description": "Match workflow runs with activity executions"
    },
    {
      "id": "calculate-trends",
      "description": "Compute success rate changes over time"
    },
    {
      "id": "identify-issues",
      "description": "Find failing patterns"
    },
    {
      "id": "generate-recommendations",
      "description": "Suggest improvements"
    },
    {
      "id": "format-report",
      "description": "Create markdown report"
    },
    {
      "id": "post-to-github",
      "description": "Create or update GitHub issue"
    }
  ]
}
```

**Problems:**
- 9 tasks (too large)
- Mixes concerns (fetching + analysis + reporting)
- Takes 221 seconds
- Hard to reuse parts

### After (Decomposed)

**Activity 1: Fetch Workflow Data**
```json
{
  "id": "fetch-github-workflow-runs",
  "description": "Retrieve recent workflow runs from GitHub Actions",
  "input_shapes": ["workflow_name", "time_range"],
  "output_shapes": ["workflow_run_data"],
  "tasks": [
    {
      "id": "query-gh-api",
      "description": "Use gh CLI to fetch runs",
      "retry": {"maxAttempts": 3}
    },
    {
      "id": "save-json",
      "description": "Write to workflow-runs.json"
    }
  ]
}
```

**Activity 2: Fetch Activity Metrics**
```json
{
  "id": "fetch-backend-activity-metrics",
  "description": "Query activity API for performance metrics",
  "input_shapes": ["activity_filter", "time_range"],
  "output_shapes": ["activity_metrics"],
  "tasks": [
    {
      "id": "query-api",
      "description": "GET /v2/activities/metrics",
      "retry": {"maxAttempts": 3}
    },
    {
      "id": "save-json",
      "description": "Write to activity-metrics.json"
    }
  ]
}
```

**Activity 3: Analyze Performance**
```json
{
  "id": "analyze-workflow-performance",
  "description": "Calculate success rates and identify trends",
  "input_shapes": ["workflow_run_data", "activity_metrics"],
  "output_shapes": ["performance_analysis"],
  "tasks": [
    {
      "id": "correlate-data",
      "description": "Match workflows with activities"
    },
    {
      "id": "calculate-stats",
      "description": "Compute aggregates and trends"
    },
    {
      "id": "identify-issues",
      "description": "Flag anomalies and failures"
    }
  ]
}
```

**Activity 4: Generate Report**
```json
{
  "id": "format-performance-report",
  "description": "Convert analysis into markdown report",
  "input_shapes": ["performance_analysis"],
  "output_shapes": ["markdown_report"],
  "tasks": [
    {
      "id": "format-markdown",
      "description": "Create structured report with sections"
    },
    {
      "id": "add-recommendations",
      "description": "Include actionable suggestions"
    }
  ]
}
```

**Activity 5: Post to GitHub**
```json
{
  "id": "post-github-issue",
  "description": "Create or update GitHub issue with content",
  "input_shapes": ["markdown_content", "issue_labels"],
  "output_shapes": ["issue_url"],
  "tasks": [
    {
      "id": "find-or-create",
      "description": "Search for existing issue or create new"
    },
    {
      "id": "post-comment",
      "description": "Add content as comment"
    }
  ]
}
```

**Composition:**
```
fetch-github-workflow-runs
    ↓
[workflow_run_data]
    ↓
fetch-backend-activity-metrics
    ↓
[activity_metrics]
    ↓
analyze-workflow-performance
    ↓
[performance_analysis]
    ↓
format-performance-report
    ↓
[markdown_report]
    ↓
post-github-issue
    ↓
[issue_url]
```

**Benefits:**
- Each activity is 2-3 tasks (manageable)
- Clear data flow between activities
- Each activity is reusable:
  - `fetch-github-workflow-runs` → any workflow analysis
  - `fetch-backend-activity-metrics` → any metric reporting
  - `post-github-issue` → any automated reporting
- Easier to test each piece
- Can swap implementations (e.g., use different report formatter)
- Failures are isolated (if GitHub post fails, analysis still succeeded)

## Next Steps

1. Apply these guidelines to refactor autonomous-app-development workflow
2. Create a library of atomic activities (10-15 common operations)
3. Execute compositions and use /teach to reinforce good patterns
4. Monitor execution_sequences table to see patterns emerge
5. Use ribosome to extract successful compositions as new meta-activities

---

**Version:** 1.0
**Last Updated:** 2026-04-10
**Status:** Guidelines established, ready for application
