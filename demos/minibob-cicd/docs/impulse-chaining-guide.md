# Impulse Chaining Guide: Composing Activities for Complex Workflows

This guide teaches you how to compose activities together using impulse chaining to build complex, intelligent workflows. We'll cover the core concepts, patterns, and provide concrete examples from the existing codebase.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Activity Types](#activity-types)
3. [Impulse Chaining Patterns](#impulse-chaining-patterns)
4. [The Three Learning Loops](#the-three-learning-loops)
5. [Building Complex Workflows](#building-complex-workflows)
6. [Practical Examples](#practical-examples)
7. [Best Practices](#best-practices)

## Core Concepts

### What is Impulse Chaining?

Impulse chaining is a mechanism that allows activities to pass data and context between each other in a structured, budget-aware way. Instead of directly passing large amounts of data, activities create **impulses** - lightweight references to data with metadata about relevance, budget constraints, and lazy loading capabilities.

### Key Components

- **Impulses**: Lightweight data references with metadata
- **Tasks**: Individual steps within an activity that can depend on each other
- **Phases**: Groups of activities that execute together (parallel or sequential)
- **Dependencies**: Explicit relationships between tasks
- **Budget Management**: Token/cost limits for each impulse
- **Lazy Loading**: Load data only when actually needed

## Activity Types

There are three main types of activities, each with different chaining capabilities:

### 1. Deterministic Activities

**Purpose**: Execute commands, run tests, perform validation  
**Chaining**: Minimal - mainly output shapes for triggering other activities

**Example**: `run-test-suite` activity that executes tests and produces `tests_pass` or `tests_fail` shapes.

### 2. Learning Activities

**Purpose**: LLM-assisted problem solving with pattern learning  
**Chaining**: Rich impulse usage and task dependencies

**Example**: `fix-test-failure` activity that uses impulses from past successful fixes and chains analysis → fix → validation tasks.

### 3. Discovery Activities

**Purpose**: Generate impulse metadata for other activities to consume  
**Chaining**: Produce batches of impulse metadata

**Example**: `scan-execution-traces` activity that queries backend for similar past executions and creates impulse metadata batches.

## Impulse Chaining Patterns

### 1. Basic Task Dependencies

The simplest form of chaining where one task depends on another's output:

```json
{
  "tasks": [
    {
      "id": "analyze",
      "prompt": {
        "template": "Analyze the error: {{errorLog}}"
      }
    },
    {
      "id": "fix",
      "dependencies": ["analyze"],
      "prompt": {
        "template": "Based on your analysis:\n{{analyze.output}}\n\nApply the fix:"
      }
    }
  ]
}
```

**Key Points**:
- Tasks with `dependencies` wait for prerequisite tasks to complete
- Previous task outputs become available as `{{taskId.output}}`
- This creates a linear chain of reasoning

### 2. Impulse Loading and Selection

More sophisticated chaining where tasks select and load relevant impulses:

```json
{
  "impulses": [
    {
      "id": "discovered-impulses",
      "pointer": { "type": "phaseOutput", "phase": "discovery" },
      "budget": 5000,
      "lazyLoad": true
    }
  ],
  "tasks": [
    {
      "id": "select-impulses",
      "type": "transform",
      "transform": {
        "operation": "filterImpulsesByShapes",
        "config": {
          "requiredShapes": ["error_log", "source_code"],
          "budgetAllocation": {
            "error_log": 3000,
            "source_code": 4000
          }
        }
      }
    },
    {
      "id": "load-selected-impulses",
      "dependencies": ["select-impulses"],
      "type": "loadImpulses",
      "impulseRefs": "{{select-impulses.output.impulseIds}}",
      "budgetEnforcement": true
    }
  ]
}
```

**Key Points**:
- Impulses can be lazily loaded based on selection criteria
- Budget allocation prevents runaway token usage
- Transform operations can filter and prioritize impulses


## The Three Learning Loops

The activity system is built around three interconnected learning loops that improve performance over time:

### Loop 1: Impulse Flow (Budget-Aware Context Management)

**Purpose**: Efficiently select and load relevant context for tasks

**How it works**:
1. **Discovery Phase**: Activities scan environment for potential impulses
2. **Shape Inference**: Determine what data shapes are needed for the goal
3. **Impulse Selection**: Filter discovered impulses by relevance and shape
4. **Lazy Loading**: Load only selected impulses within budget constraints
5. **Usage Tracking**: Record which impulses were actually used vs loaded
6. **Relevance Learning**: Update relevance scores based on usage patterns

**Example from `fix-test-failure-with-discovery.json`**:
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
  },
  "metadata": {
    "demonstratesLoop": 1,
    "description": "Impulse Flow: Select and load impulses based on learned relevance"
  }
}
```

### Loop 2: External Validation (Outcome-Based Learning)

**Purpose**: Learn from real-world validation results to improve activity selection

**How it works**:
1. **Internal Validation**: Quick syntax/logic checks
2. **External Validation**: Run tests, check compilation, etc.
3. **Error Classification**: Categorize failure types
4. **Thompson Sampling**: Update activity success/failure rates
5. **Variant Creation**: Generate new activity variants for persistent failures

**Example from `fix-test-failure-with-discovery.json`**:
```json
{
  "id": "external-validation",
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
    "strategy": "progressive-context"
  },
  "metadata": {
    "demonstratesLoop": 2,
    "validationType": "external",
    "errorClassification": "enabled"
  }
}
```

### Loop 3: Discovery (Environment Scanning)

**Purpose**: Learn which discovery activities are most effective for different goal types

**How it works**:
1. **Parallel Scanning**: Run multiple discovery activities simultaneously
2. **Impulse Generation**: Each scanner produces impulse metadata batches
3. **Effectiveness Tracking**: Record which discovered impulses were actually used
4. **Thompson Sampling**: Learn optimal discovery strategy per goal type
5. **Adaptive Scanning**: Skip low-value scans for well-understood goal types

**Example Discovery Phase**:
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
        },
        {
          "ref": "discovery/scan-execution-traces",
          "vars": { "goalCategory": "bugfix" }
        }
      ],
      "execution": "parallel",
      "outputHandling": "consolidate-impulses"
    }
  ]
}
```

**Learning Integration**:
All three loops feed back into the system:
- Loop 1 learns impulse relevance patterns
- Loop 2 learns activity success patterns
- Loop 3 learns discovery effectiveness patterns

