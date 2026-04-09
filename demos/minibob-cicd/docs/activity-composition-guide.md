# Activity Composition and Impulse Chaining Guide

This guide teaches developers how to compose activities together using impulse chaining to build complex, intelligent workflows.

## Core Concepts

### What is Activity Composition?

Activity composition is the practice of connecting multiple activities together to create sophisticated workflows. Instead of writing monolithic activities, you compose smaller, focused activities that work together through **impulse chaining**.

### What are Impulses?

Impulses are structured data packets that carry information between activities and tasks. They have:
- **Shape**: The type of data (source_code, test_file, error_log, etc.)
- **Content**: The actual data (loaded lazily for efficiency)
- **Metadata**: Context about the data (size, source, relevance)
- **Budget**: Token/cost limits for processing

## Understanding Impulses

### Impulse Structure

```json
{
  "id": "error-context",
  "pointer": { "type": "memo", "content": "Test failed: expected 4, got 5" },
  "budget": 3000,
  "priority": "required",
  "metadata": {
    "shape": "error_log",
    "source": "ci-output"
  }
}
```

### Common Shapes

- `source_code`: TypeScript/JavaScript files
- `test_file`: Test files (.test.ts, .spec.ts)
- `error_log`: Error output from tools
- `config_file`: Configuration files
- `execution_trace`: Past execution records
- `impulse_metadata_batch`: Collections of impulse metadata

## Activity Structure

### Basic Components

Every activity has these key sections:

```json
{
  "id": "activity-name",
  "name": "Human Readable Name",
  "description": "What this activity does",
  "mode": "learning|deterministic",
  
  "variables": [],    // Input parameters
  "phases": [],       // Parallel discovery phases
  "impulses": [],     // Input impulses
  "tasks": [],        // Sequential execution steps
  
  "outputSchema": {}, // What this produces
  "learning": {}      // How this improves over time
}
```

### Example: Simple Activity Structure

From `fix-lint-error.json`:

```json
{
  "id": "fix-lint-error",
  "variables": [
    {
      "name": "errorLog",
      "type": "string",
      "required": true,
      "description": "ESLint error output"
    }
  ],
  "tasks": [
    {
      "id": "try-autofix",
      "type": "command",
      "command": { "run": "eslint src/ tests/ --fix" }
    },
    {
      "id": "manual-fix",
      "dependencies": ["try-autofix"],
      "condition": "{{remainingExitCode}} !== 0",
      "prompt": {
        "template": "ESLint autofix ran but errors remain: {{remainingErrors}}"
      }
    }
  ]
}
```

## Composition Patterns

### 1. Sequential Task Chaining

Tasks execute in dependency order, with outputs flowing as impulses:

```json
{
  "tasks": [
    {
      "id": "analyze",
      "prompt": { "template": "Analyze this error: {{errorLog}}" },
      "outputShapes": ["failure_analysis"]
    },
    {
      "id": "fix",
      "dependencies": ["analyze"],
      "prompt": {
        "template": "Based on analysis: {{analyze.output}}\n\nApply the fix."
      },
      "outputShapes": ["code_changes"]
    }
  ]
}
```

**Key Pattern**: Tasks reference previous outputs using `{{taskName.output}}` syntax.

### 2. Activity Reference Chaining

Activities can invoke other activities and receive their outputs:

```json
{
  "phases": [
    {
      "id": "discovery",
      "activities": [
        {
          "ref": "discovery/scan-file-system",
          "vars": { "goalCategory": "bugfix" }
        },
        {
          "ref": "discovery/scan-git-history",
          "vars": { "commitCount": 5 }
        }
      ],
      "execution": "parallel",
      "outputHandling": "consolidate-impulses"
    }
  ],
  "impulses": [
    {
      "id": "discovered-impulses",
      "pointer": { "type": "phaseOutput", "phase": "discovery" },
      "lazyLoad": true
    }
  ]
}
```

### 3. Conditional Execution

Tasks can execute conditionally based on previous results:

```json
{
  "id": "manual-fix",
  "dependencies": ["autofix-attempt"],
  "condition": "{{autofix-attempt.exitCode}} !== 0",
  "prompt": { "template": "Autofix failed, manual intervention needed" }
}
```

### 4. Transform Operations

Special tasks that process impulses without LLM calls:

```json
{
  "id": "select-impulses",
  "type": "transform",
  "transform": {
    "input": ["discovered-impulses", "shape-inference"],
    "operation": "filterImpulsesByShapes",
    "config": {
      "requiredShapes": "{{shape-inference.output.required}}",
      "budgetAllocation": {
        "error_log": 3000,
        "source_code": 4000,
        "execution_trace": 2000
      }
    }
  }
}
```

## The Three Feedback Loops

### Loop 1: Impulse Flow
**Discovery → Selection → Lazy Loading → Usage Tracking → Relevance Learning**

This loop optimizes which impulses are actually useful:

```json
{
  "id": "load-selected-impulses",
  "type": "loadImpulses",
  "impulseRefs": "{{select-impulses.output.impulseIds}}",
  "budgetEnforcement": true,
  "trackUsage": true,
  "metadata": {
    "demonstratesLoop": 1,
    "description": "Budget-constrained lazy loading with usage tracking"
  }
}
```

### Loop 2: External Validation
**Internal Checks → External Tests → Error Classification → Thompson Sampling Update**

This loop learns which approaches work:

```json
{
  "id": "external-validation",
  "type": "command",
  "command": { "run": "bun test" },
  "validation": { "exitCode": 0 },
  "retry": {
    "maxAttempts": 2,
    "strategy": "progressive-context"
  },
  "metadata": {
    "demonstratesLoop": 2,
    "errorClassification": "enabled"
  }
}
```

### Loop 3: Discovery
**Shape Inference → Parallel Scans → Impulse Consolidation → Effectiveness Learning**

This loop optimizes what context to gather:

```json
{
  "phases": [
    {
      "id": "discovery",
      "activities": [
        { "ref": "discovery/scan-file-system" },
        { "ref": "discovery/scan-git-history" },
        { "ref": "discovery/scan-execution-traces" }
      ],
      "execution": "parallel",
      "outputHandling": "consolidate-impulses"
    }
  ]
}
```

## Practical Examples

### Example 1: Simple Bug Fix Chain

A basic workflow that fixes lint errors:

1. **Input**: `errorLog` from CI
2. **fix-lint-error** - Attempts autofix, then manual fix
3. **run-lint** - Validates the fix worked
4. **create-pr-for-fix** - Creates PR if successful

```json
{
  "workflow": [
    {
      "activity": "fix-lint-error",
      "input": { "errorLog": "{{ci.lintOutput}}" }
    },
    {
      "activity": "run-lint",
      "condition": "{{fix-lint-error.success}}"
    },
    {
      "activity": "create-pr-for-fix",
      "condition": "{{run-lint.success}}"
    }
  ]
}
```

### Example 2: Complex Discovery-Driven Fix

From `fix-test-failure-with-discovery.json` - demonstrates all three loops:

1. **Discovery Phase** (Loop 3):
   - `scan-file-system` - Find relevant source/test files
   - `scan-git-history` - Find similar past fixes
   - `scan-execution-traces` - Find execution patterns

2. **Analysis Phase** (Loop 1):
   - `shape-inference` - Determine what data shapes are needed
   - `select-impulses` - Choose relevant impulses from discovery
   - `load-selected-impulses` - Lazy load with budget enforcement
   - `analyze-with-context` - Analyze failure with loaded context

3. **Fix Phase** (Loop 1):
   - `apply-fix` - Make targeted code changes

4. **Validation Phase** (Loop 2):
   - `internal-validation` - Syntax and static checks
   - `external-validation` - Run actual tests

5. **Learning Phase** (All Loops):
   - `record-impulse-usage` - Track which impulses were useful
   - `record-discovery-effectiveness` - Update Thompson Sampling

### Example 3: Discovery Activity Pattern

From `scan-file-system.json` - shows how discovery activities produce impulses:

```json
{
  "tasks": [
    {
      "id": "discover-source-files",
      "type": "command",
      "command": {
        "run": "find src -name '*.ts' -type f -exec sh -c 'echo \"{}:$(wc -l < \"{}\"):$(stat -c%s \"{}\")\"' \\;"
      },
      "outputShapes": ["file_metadata_list"]
    },
    {
      "id": "create-impulses",
      "type": "transform",
      "transform": {
        "operation": "createImpulseMetadata",
        "config": {
          "shapes": {
            "*.ts": "source_code",
            "*.test.ts": "test_file"
          },
          "loadContent": false
        }
      },
      "outputShapes": ["impulse_metadata_batch"]
    }
  ]
}
```

## Building Complex Workflows

### Step 1: Define Your Goal

Break your problem into phases:
- **Discovery**: What context do you need?
- **Analysis**: How do you process that context?
- **Action**: What changes do you make?
- **Validation**: How do you verify success?

### Step 2: Choose Your Composition Strategy

**Sequential**: Tasks run one after another
```json
"tasks": [
  { "id": "step1" },
  { "id": "step2", "dependencies": ["step1"] }
]
```

**Parallel**: Activities run simultaneously
```json
"phases": [{
  "execution": "parallel",
  "activities": [...]
}]
```

**Conditional**: Tasks run based on conditions
```json
{
  "condition": "{{previous.exitCode}} !== 0",
  "prompt": { "template": "Handle failure case" }
}
```

### Step 3: Design Your Impulse Flow

1. **Input Impulses**: What data does your activity need?
2. **Shape Inference**: What shapes will you work with?
3. **Discovery**: How will you find relevant context?
4. **Selection**: How will you choose what to load?
5. **Processing**: How will tasks chain outputs?

### Step 4: Add Learning and Validation

```json
{
  "learning": {
    "onSuccess": {
      "action": "updateThompsonSampling",
      "data": { "activity_alpha_increment": 1 }
    },
    "onFailure": {
      "action": "updateThompsonSampling",
      "data": { "activity_beta_increment": 1 }
    }
  },
  "validation": {
    "exitCode": 0,
    "requiredPatterns": ["success"]
  }
}
```
