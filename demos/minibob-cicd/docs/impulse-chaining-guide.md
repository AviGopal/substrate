# Impulse Chaining Guide: Composing Activities for Complex Workflows

This guide teaches developers how to use impulse chaining to compose activities together, building complex workflows from simple components. Through concrete examples from the MiniBob codebase, you'll learn the patterns and principles for effective activity composition.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Basic Chaining Patterns](#basic-chaining-patterns)
3. [Advanced Impulse Management](#advanced-impulse-management)
4. [The Three Learning Loops](#the-three-learning-loops)
5. [Discovery and Impulse Generation](#discovery-and-impulse-generation)
6. [Workflow Composition Patterns](#workflow-composition-patterns)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Core Concepts

### What is Impulse Chaining?

Impulse chaining is the mechanism by which activities pass data, context, and control flow between each other. An **impulse** is a structured piece of information that can be:

- **Generated** by one activity (discovery, analysis, execution results)
- **Consumed** by another activity (as context, input data, or decision criteria)
- **Transformed** as it flows through the chain (filtered, enriched, aggregated)

### Key Components

1. **Impulses**: Data packets with metadata, shape information, and pointers
2. **Tasks**: Individual units of work that can depend on other tasks
3. **Phases**: Groups of activities that execute together (parallel or sequential)
4. **Dependencies**: Explicit relationships between tasks that control execution order
5. **Output Shapes**: Standardized data formats that ensure compatibility

## Basic Chaining Patterns

### 1. Simple Task Dependencies

The most basic pattern is sequential task execution with dependencies:

```json
{
  "tasks": [
    {
      "id": "try-autofix",
      "description": "First try ESLint's built-in autofix",
      "type": "command",
      "command": {
        "run": "eslint src/ tests/ --fix",
        "captureOutput": true
      },
      "outputCapture": {
        "stdout": "autofixOutput",
        "exitCode": "autofixExitCode"
      }
    },
    {
      "id": "check-remaining",
      "description": "Check if any errors remain after autofix",
      "dependencies": ["try-autofix"],
      "type": "command",
      "command": {
        "run": "eslint src/ tests/",
        "captureOutput": true
      },
      "outputCapture": {
        "stdout": "remainingErrors",
        "exitCode": "remainingExitCode"
      }
    },
    {
      "id": "manual-fix",
      "description": "Use LLM to fix errors that autofix couldn't handle",
      "dependencies": ["check-remaining"],
      "condition": "{{remainingExitCode}} !== 0",
      "prompt": {
        "template": "ESLint autofix ran but some errors remain: {{remainingErrors}}"
      }
    }
  ]
}
```

**Key Points:**
- Tasks execute in dependency order
- Output from one task becomes available to dependent tasks via `{{variableName}}`
- Conditions can control whether tasks execute
- `continueOnFailure` allows workflows to proceed despite errors

### 2. Conditional Execution

Tasks can execute conditionally based on previous results:

```json
{
  "id": "manual-fix",
  "dependencies": ["check-remaining"],
  "condition": "{{remainingExitCode}} !== 0",
  "prompt": {
    "template": "Only runs if autofix didn't fix everything"
  }
}
```

### 3. Output Shape Declarations

Activities declare what data shapes they produce, enabling type-safe chaining:

```json
{
  "outputSchema": {
    "produces": [
      { "shape": "lint_passes", "description": "All lint rules pass" },
      { "shape": "code_changes", "description": "Applied code modifications" }
    ]
  }
}
```

## Advanced Impulse Management

### Impulse Structure

Impulses are structured data packets that carry both content and metadata:

```json
{
  "id": "error-context",
  "pointer": { "type": "memo", "content": "{{errorLog}}" },
  "budget": 3000,
  "priority": "required",
  "metadata": {
    "shape": "error_log",
    "source": "ci-output"
  },
  "loaded": false,
  "content": null
}
```

**Key Fields:**
- `pointer`: How to access the data (memo, file, phaseOutput, etc.)
- `budget`: Token/cost limit for this impulse
- `priority`: required, high, medium, low
- `metadata.shape`: Data type for compatibility checking
- `lazyLoad`: Whether to load content on-demand

### Lazy Loading and Budget Management

For large datasets, impulses can be lazy-loaded with budget constraints:

```json
{
  "id": "discovered-impulses",
  "pointer": { "type": "phaseOutput", "phase": "discovery" },
  "budget": 5000,
  "priority": "high",
  "lazyLoad": true,
  "metadata": {
    "shape": "impulse_metadata_batch",
    "source": "discovery-phase"
  }
}
```

Then later tasks can selectively load what they need:

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
      },
      "relevanceThreshold": 0.3
    }
  }
}
```
### Transform Operations

Transform tasks can process impulses without LLM calls, providing efficient data manipulation:

```json
{
  "id": "create-impulses",
  "type": "transform",
  "transform": {
    "input": ["discover-source-files", "discover-test-files", "discover-configs"],
    "operation": "createImpulseMetadata",
    "config": {
      "shapes": {
        "*.ts": "source_code",
        "*.test.ts": "test_file",
        "*.json": "config_file"
      },
      "extractSummary": true,
      "loadContent": false
    }
  },
  "outputShapes": ["impulse_metadata_batch"]
}
```

## The Three Learning Loops

The MiniBob system implements three interconnected learning loops that work together through impulse chaining:

### Loop 1: Impulse Flow (Selection and Usage)

**Purpose**: Learn which impulses are relevant for different types of goals.

**Pattern**: Discovery → Selection → Lazy Loading → Usage Tracking → Relevance Learning

```json
{
  "id": "select-impulses",
  "description": "Select relevant impulses from discovered batch (Loop 1)",
  "dependencies": ["shape-inference"],
  "type": "transform",
  "transform": {
    "input": ["discovered-impulses", "shape-inference"],
    "operation": "filterImpulsesByShapes",
    "config": {
      "requiredShapes": "{{shape-inference.output.required}}",
      "optionalShapes": "{{shape-inference.output.optional}}",
      "budgetAllocation": {
        "error_log": 3000,
        "source_code": 4000,
        "execution_trace": 2000
      },
      "relevanceThreshold": 0.3
    }
  },
  "metadata": {
    "demonstratesLoop": 1,
    "description": "Impulse Flow: Select and load impulses based on learned relevance"
  }
}
```

### Loop 2: External Validation (Feedback and Adaptation)

**Purpose**: Learn from real-world execution results and adapt strategies.

**Pattern**: Internal Validation → External Testing → Error Classification → Strategy Updates

```json
{
  "id": "external-validation",
  "description": "External validation with tests (Loop 2)",
  "dependencies": ["internal-validation"],
  "type": "command",
  "command": {
    "run": "bun test",
    "captureOutput": true,
    "timeout": 60000
  },
  "validation": {
    "exitCode": 0
  },
  "retry": {
    "maxAttempts": 2,
    "strategy": "progressive-context",
    "onRetry": {
      "includeImpulse": "previous-attempt-trace"
    }
  },
  "metadata": {
    "demonstratesLoop": 2,
    "validationType": "external",
    "errorClassification": "enabled"
  }
}
```

### Loop 3: Discovery (Environment Scanning)

**Purpose**: Learn which discovery activities are effective for different goal types.

**Pattern**: Shape Inference → Parallel Scans → Impulse Consolidation → Effectiveness Learning

```json
{
  "phases": [
    {
      "id": "discovery",
      "name": "Phase 1: Discovery (Loop 3)",
      "description": "Environment scanning to discover relevant context",
      "activities": [
        {
          "ref": "discovery/scan-file-system",
          "vars": { "goalCategory": "bugfix" }
        },
        {
          "ref": "discovery/scan-git-history",
          "vars": { "commitCount": 5 }
        },
        {
          "ref": "discovery/scan-execution-traces",
          "vars": {
            "goalCategory": "bugfix",
            "goalKeywords": ["test", "failure"]
          }
        }
      ],
      "execution": "parallel",
      "outputHandling": "consolidate-impulses"
    }
  ]
}
```

## Discovery and Impulse Generation

### Discovery Activity Pattern

Discovery activities scan the environment and generate impulse metadata:

```json
{
  "id": "discover-source-files",
  "type": "command",
  "command": {
    "run": "find src -name '*.ts' -type f",
    "captureOutput": true
  },
  "outputShapes": ["file_metadata_list"]
}
```

## Workflow Composition Patterns

### 1. Simple Sequential Workflow

```json
{
  "tasks": [
    { "id": "lint", "type": "command", "command": { "run": "npm run lint" } },
    { "id": "test", "dependencies": ["lint"], "type": "command", "command": { "run": "npm test" } },
    { "id": "build", "dependencies": ["test"], "type": "command", "command": { "run": "npm run build" } }
  ]
}
```

### 2. Parallel Discovery with Consolidation

```json
{
  "phases": [
    {
      "id": "discovery",
      "activities": [
        { "ref": "discovery/scan-file-system" },
        { "ref": "discovery/scan-git-history" }
      ],
      "execution": "parallel",
      "outputHandling": "consolidate-impulses"
    }
  ]
}
```

### 3. Conditional Branching

```json
{
  "tasks": [
    {
      "id": "try-autofix",
      "type": "command",
      "command": { "run": "eslint --fix" },
      "continueOnFailure": true
    },
    {
      "id": "manual-fix",
      "dependencies": ["try-autofix"],
      "condition": "{{try-autofix.exitCode}} !== 0",
      "prompt": { "template": "Manual fix needed" }
    }
  ]
}
```

## Best Practices

### 1. Design for Composability

- **Use Standard Output Shapes**: Always declare what shapes your activity produces
- **Make Activities Self-Contained**: Each activity should run independently with proper inputs
- **Document Dependencies**: Clearly specify what inputs are required

### 2. Efficient Impulse Management

- **Use Lazy Loading**: For large datasets, use lazy loading with budget constraints
- **Set Appropriate Budgets**: Balance cost vs. completeness
- **Prioritize Impulses**: Mark critical impulses as 'required', nice-to-have as 'low'

### 3. Error Handling

- **Use Retry Strategies**: Implement retry with progressive context
- **Continue on Failure**: Allow workflows to proceed when appropriate
- **Validate Outputs**: Check that tasks produce expected results

### 4. Learning Integration

- **Enable Tracing**: Set `recordTrace: true` for learning
- **Contribute to Learning**: Set `contributeToLearning: true`
- **Define Learning Callbacks**: Specify `onSuccess` and `onFailure` actions

## Common Patterns from the Codebase

### CI/CD Remediation Pattern

1. **Detection**: CI step fails
2. **Discovery**: Scan for relevant context (files, history, traces)
3. **Analysis**: LLM analyzes failure with discovered context
4. **Remediation**: Apply fixes based on analysis
5. **Validation**: Run tests to verify fix
6. **Learning**: Record what worked for future use

### Bug Fix Pattern

1. **Error Input**: Receive error log or description
2. **Shape Inference**: Determine what types of context are needed
3. **Selective Discovery**: Run only relevant discovery activities
4. **Context Loading**: Lazy load only the most relevant impulses
5. **Iterative Fixing**: Try fixes with validation loops
6. **Success Recording**: Track which approaches worked

### Feature Development Pattern

1. **Requirements**: Receive feature description
2. **Codebase Scan**: Understand existing patterns
3. **Implementation**: Write new code following patterns
4. **Testing**: Create tests for new functionality
5. **Integration**: Ensure compatibility with existing code

## Troubleshooting

### Common Issues

**Impulse Not Found**
- Check that the referenced task has completed
- Verify the impulse ID matches the task output
- Ensure the task actually produces the expected output shape

**Budget Exceeded**
- Increase budget for critical impulses
- Use more selective discovery to reduce impulse count
- Implement better relevance filtering

**Dependency Cycles**
- Review task dependencies for circular references
- Use phases to break complex dependencies
- Consider splitting large activities into smaller ones

**Learning Not Working**
- Ensure `recordTrace: true` is set
- Check that `contributeToLearning: true` is enabled
- Verify learning callbacks are properly configured

### Debugging Techniques

**Trace Execution**
```json
{
  "tracing": {
    "recordTrace": true,
    "captureStateTransition": true,
    "metadata": {
      "debugMode": true
    }
  }
}
```

**Validate Outputs**
```json
{
  "validation": {
    "requireOutput": true,
    "requiredPatterns": ["expected-pattern"],
    "customCheck": "{{output.length}} > 0"
  }
}
```

**Progressive Context on Retry**
```json
{
  "retry": {
    "maxAttempts": 3,
    "strategy": "progressive-context",
    "onRetry": {
      "includeImpulse": "previous-attempt-trace"
    }
  }
}
```

## Conclusion

Impulse chaining enables powerful composition of activities into complex workflows. By understanding the patterns of task dependencies, impulse management, and the three learning loops, developers can build sophisticated automation that learns and improves over time.

Key takeaways:
- Start simple with basic task dependencies
- Use discovery activities to generate context efficiently
- Implement lazy loading and budget management for scale
- Enable learning to improve performance over time
- Design for composability and reuse

Refer to the existing activities in the codebase for concrete examples of these patterns in action.