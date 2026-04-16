# Comprehensive Guide to Impulse Chaining: Building Complex Workflows with MiniBob

This comprehensive guide teaches developers how to master impulse chaining to compose activities into sophisticated, learning-enabled workflows. Through real examples from the MiniBob codebase and hands-on tutorials, you'll learn to build everything from simple sequential chains to advanced multi-activity compositions.

## Table of Contents

1. [Quick Start: Your First Chain](#quick-start-your-first-chain)
2. [Core Concepts Deep Dive](#core-concepts-deep-dive)
3. [Impulse System Architecture](#impulse-system-architecture)
4. [Activity Composition Patterns](#activity-composition-patterns)
5. [Progressive Examples](#progressive-examples)
6. [Advanced Patterns](#advanced-patterns)
7. [Real-World Examples from MiniBob](#real-world-examples-from-minibob)
8. [Best Practices](#best-practices)
9. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
10. [Performance Optimization](#performance-optimization)

## Quick Start: Your First Chain

### What is Impulse Chaining?

Impulse chaining is MiniBob's approach to composing activities together. Instead of building monolithic activities, you create focused, reusable activities that communicate through **impulses** - structured data packets that carry information between activities.

Think of impulses as typed messages with metadata:
- They have a **shape** (the type of data: `source_code`, `error_log`, `test_results`)
- They carry **content** (loaded lazily for efficiency)
- They include **metadata** (context, size, relevance)
- They respect **budgets** (token/cost limits)

### Simple Sequential Chain

Let's start with the most basic pattern - one task feeding into the next. This example shows how to fix lint errors and then run tests:

```json
{
  "id": "fix-and-test",
  "name": "Fix Code and Run Tests",
  "description": "Fix lint errors then run tests to verify",
  "variables": [
    {
      "name": "errorLog",
      "type": "string",
      "required": true,
      "description": "ESLint error output to fix"
    }
  ],
  "tasks": [
    {
      "id": "fix-lint-errors",
      "description": "Fix the lint errors using AI",
      "prompt": {
        "template": "Fix these ESLint errors: {{errorLog}}. Use the edit tool to make precise fixes.",
        "maxTokens": 4000
      },
      "outputImpulses": ["fix-result"]
    },
    {
      "id": "run-tests",
      "description": "Run tests to verify the fix worked",
      "dependencies": ["fix-lint-errors"],
      "impulseReferences": ["fix-result"],
      "prompt": {
        "template": "The lint errors have been fixed. Now run tests to verify everything works.",
        "maxTokens": 2000
      },
      "validation": {
        "commands": [
          {
            "command": "npm test",
            "expectedOutput": "All tests passed"
          }
        ]
      }
    }
  ]
}
```

**Key Learning Points:**
- `dependencies`: Controls execution order
- `outputImpulses`: Creates impulses from task output
- `impulseReferences`: Makes impulses available to tasks
- `validation`: Ensures task completed successfully
