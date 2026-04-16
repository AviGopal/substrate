## Basic Patterns

### 1. Simple Task Dependencies

The simplest form of chaining where one task's output feeds into the next.

**Example from `fix-lint-error.json`:**

```json
{
  "tasks": [
    {
      "id": "try-autofix",
      "type": "command",
      "command": { "run": "eslint src/ --fix" },
      "outputCapture": { "exitCode": "autofixExitCode" }
    },
    {
      "id": "check-remaining", 
      "dependencies": ["try-autofix"],
      "condition": "{{remainingExitCode}} !== 0",
      "type": "command",
      "command": { "run": "eslint src/" }
    },
    {
      "id": "manual-fix",
      "dependencies": ["check-remaining"],
      "condition": "{{remainingExitCode}} !== 0",
      "prompt": {
        "template": "ESLint autofix ran but errors remain: {{remainingErrors}}"
      }
    }
  ]
}
```

**Key Features:**
- `dependencies` ensures execution order
- `condition` enables conditional execution based on previous results
- Previous task outputs available via `{{taskId.output}}`
- `continueOnFailure` allows graceful error handling

### 2. Impulse References

Tasks can reference impulses from variables or other activities:

```json
{
  "impulses": [
    {
      "id": "error-context",
      "pointer": { "type": "memo", "content": "{{errorLog}}" },
      "budget": 3000,
      "priority": "required",
      "metadata": {
        "shape": "error_log",
        "source": "ci-output"
      }
    }
  ],
  "tasks": [
    {
      "id": "analyze",
      "prompt": {
        "template": "Analyze this error: {{error-context.content}}"
      }
    }
  ]
}
```

### 3. Output Shape Declarations

Each task declares what shapes it produces for downstream consumption:

```json
{
  "id": "analyze-failure",
  "outputShapes": ["failure_analysis"],
  "prompt": {
    "template": "Analyze the test failure and identify root cause..."
  }
}
```

This enables type-safe chaining and budget planning.

### 4. Discovery Activity Pattern

**Example from `scan-file-system.json`:**

Discovery activities generate impulse metadata without loading content:

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
        "input": ["discover-source-files"],
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

**Key Features:**
- Generates impulse metadata without loading content
- Uses `transform` operations to convert raw data into impulses
- Enables lazy loading for efficiency
