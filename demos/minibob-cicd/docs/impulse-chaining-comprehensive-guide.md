# Complete Guide to Impulse Chaining: Building Complex Workflows with MiniBob

This comprehensive guide teaches developers how to master impulse chaining to compose activities into sophisticated, learning-enabled workflows. Through real examples from the MiniBob codebase, you'll progress from simple task chains to advanced multi-loop learning systems.

## Table of Contents

1. [Quick Start: Your First Chain](#quick-start-your-first-chain)
2. [Core Concepts Deep Dive](#core-concepts-deep-dive)
3. [The Activity Spectrum](#the-activity-spectrum)
4. [Progressive Examples](#progressive-examples)
5. [The Three Learning Loops](#the-three-learning-loops)
6. [Advanced Patterns](#advanced-patterns)
7. [Production Best Practices](#production-best-practices)
8. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
9. [Performance Optimization](#performance-optimization)

## Quick Start: Your First Chain

### Simple Sequential Chain

Start with the most basic pattern - one task feeding into the next:

```json
{
  "id": "my-first-chain",
  "name": "Lint and Test",
  "tasks": [
    {
      "id": "lint",
      "type": "command",
      "command": {
        "run": "eslint src/ --format=json",
        "captureOutput": true
      },
      "outputCapture": {
        "stdout": "lintResults",
        "exitCode": "lintExitCode"
      }
    },
    {
      "id": "test-if-clean",
      "dependencies": ["lint"],
      "condition": "{{lintExitCode}} === 0",
      "type": "command",
      "command": {
        "run": "bun test",
        "captureOutput": true
      }
    }
  ]
}
```

**Key Learning Points:**
- `dependencies`: Controls execution order
- `{{variableName}}`: References output from previous tasks
- `condition`: Conditional execution based on previous results
- `outputCapture`: Makes command output available to later tasks

### Adding Intelligence with Prompts

```json
{
  "id": "intelligent-fix",
  "name": "Fix Lint Errors with AI",
  "tasks": [
    {
      "id": "check-lint",
      "type": "command",
      "command": {
        "run": "eslint src/ --format=json",
        "captureOutput": true
      },
      "outputCapture": {
        "stdout": "lintOutput",
        "exitCode": "lintExitCode"
      }
    },
    {
      "id": "fix-errors",
      "dependencies": ["check-lint"],
      "condition": "{{lintExitCode}} !== 0",
      "prompt": {
        "template": "Fix these ESLint errors: {{lintOutput}}. Use the edit tool to make precise fixes.",
        "maxTokens": 4000
      }
    },
    {
      "id": "verify-fix",
      "dependencies": ["fix-errors"],
      "type": "command",
      "command": {
        "run": "eslint src/",
        "captureOutput": true
      },
      "validation": {
        "exitCode": 0
      }
    }
  ]
}
```

## Core Concepts Deep Dive

### Understanding Impulses

An **impulse** is a data packet that flows between activities. Think of it as a typed message with metadata:

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

**Impulse Anatomy:**
- `id`: Unique identifier for referencing
- `pointer`: How to access the actual data (memo, file, phaseOutput)
- `budget`: Token/cost limit for this data
- `priority`: required, high, medium, low
- `metadata.shape`: Data type for compatibility checking
- `lazyLoad`: Whether to load content on-demand

### Data Flow Patterns

#### 1. Direct Task Chaining
```
Task A → Output → Task B (as input)
```

#### 2. Impulse-Mediated Flow
```
Task A → Impulse Creation → Impulse Selection → Task B
```

#### 3. Phase-Based Consolidation
```
Phase 1 (Parallel Tasks) → Consolidated Impulses → Phase 2
```