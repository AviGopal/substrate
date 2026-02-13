# Activity Template Creation Guide

Complete guide for creating activity templates that follow the ActivityTemplate.Schema.

## Quick Start

1. **Use the example**: See `example-activity-template.json` for a complete working example
2. **Follow the schema**: Use the structure documented below
3. **Validate**: Use the `register_activity_template` tool to validate and register
4. **Test**: Execute your template with test variables

## Schema Reference

### Top-Level Fields

```typescript
{
  "name": string,              // Template name (will be converted to kebab-case ID)
  "description": string,       // What this template does (1-2 sentences)
  "category": string,          // "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  "tasks": Task[],             // Array of 3-7 tasks (prefer 3-5)
  
  // Optional fields:
  "contextRequirements": ContextRequirement[],
  "integration": Integration,
  "metabob": MetabobConfig,
  "composition": Composition,
  "learning": Learning,
  "hooks": Hooks,
  "repositories": Record<string, RepositoryMapping>
}
```

### Task Schema

Each task represents a single unit of work:

```typescript
{
  "id": string,                    // Unique kebab-case identifier
  "subagent": string,              // DEPRECATED - use agentImpulses instead
  "description": string,           // What this task does
  "dependencies": string[],        // IDs of tasks that must complete first
  
  "prompt": {
    "template": string,            // Prompt with {{variable}} placeholders
    "maxTokens": number,           // 8000-16000 recommended
    "compressionStrategy": string, // "none" | "summarize" | "filter" | "adaptive"
    "variables": PromptVariable[]  // Variables used in template
  },
  
  "validation": {
    "requiredFiles": string[],     // Glob patterns for files that must exist
    "requiredPatterns": string[],  // Patterns that must appear in output
    "forbiddenPatterns": string[], // Patterns that must NOT appear
    "commands": ValidationCommand[] // Commands to run for validation
  },
  
  "retry": {
    "max_attempts": number,        // Usually 2-3
    "strategy": string,            // "simple" | "progressive-context" | "fallback-agent" | "trailblazing"
    "fallbackPrompt": string?      // Optional fallback prompt
  },
  
  // Optional advanced fields:
  "guidance": string[],
  "expected_actions": string[],
  "tools": TaskTools,
  "complexity": TaskComplexity,
  "executionTarget": TaskExecutionTarget,
  "impulseReferences": string[],
  "agentImpulses": string[]
}
```

### Prompt Variables

Define variables that can be interpolated into prompts:

```typescript
{
  "name": string,           // Variable name
  "type": string,           // "string" | "number" | "boolean" | "file" | "files" | "codebase-context"
  "required": boolean,      // Must be provided?
  "description": string,    // What this variable is for
  "default": any?           // Optional default value
}
```

**Variable Interpolation**:
- Use `{{variableName}}` in prompt templates
- Supports pipe filters: `{{name | kebabCase}}`, `{{title | pascalCase}}`
- Available filters: `kebabCase`, `camelCase`, `pascalCase`, `snakeCase`, `uppercase`, `lowercase`

### Validation Schema

Validation runs after task execution:

```typescript
{
  "requiredFiles": string[],           // Must exist after task (glob patterns)
  "requiredPatterns": string[],        // Must be in agent output
  "forbiddenPatterns": string[],       // Must NOT be in output
  "commands": [
    {
      "name": string,                  // Command name for logging
      "command": string,               // Shell command to run
      "required": boolean              // Fail task if command fails?
    }
  ]
}
```

### Retry Strategies

- **`simple`**: Retry with same prompt (good for transient failures)
- **`progressive-context`**: Add more context each retry (good for missing info)
- **`fallback-agent`**: Try different agent if first fails (experimental)
- **`trailblazing`**: Let agent explore solutions creatively (expensive)

### Integration Configuration

Pre/post checks and quality gates:

```typescript
{
  "preChecks": string[],        // Commands to run before activity
  "postChecks": string[],       // Commands to run after activity
  "qualityGates": [
    {
      "name": string,
      "command": string,
      "required": boolean
    }
  ]
}
```

### Metabob Configuration

Code quality integration:

```typescript
{
  "enabled": boolean,                    // Enable Metabob integration?
  "learningMode": boolean,               // Capture learnings?
  "targetContextTokens": number,         // 5000 recommended
  "annotationStrategy": string           // "all" | "key-components" | "failures-only"
}
```

### Composition Patterns

Show how templates work together:

```typescript
{
  "standalone": boolean,              // Can run independently?
  "composesWith": CompositionRule[],  // Optional related templates
  "examples": [
    {
      "name": string,                 // Example workflow name
      "description": string,          // What it achieves
      "sequence": [
        {
          "template": string,         // Template ID
          "variables": object,        // Variables to pass
          "reason": string            // Why this step
        }
      ],
      "outcome": string               // Expected result
    }
  ]
}
```

### Learning Configuration

Capture feedback for improvement:

```typescript
{
  "enabled": boolean,
  "captureStrategy": "detailed" | "summary" | "minimal",
  "feedbackPoints": [
    {
      "taskId": string,
      "metrics": Record<string, string>,        // Metrics to capture
      "improvementHints": Record<string, string> // Questions to answer
    }
  ]
}
```

### Lifecycle Hooks

Setup, cleanup, and error handling:

```typescript
{
  "preActivity": {
    "workingDirectory": {
      "type": "current" | "temporary" | "custom",
      "path": string?,
      "prefix": string?,
      "cleanup": "always" | "onSuccess" | "onError" | "never"?
    },
    "environment": Record<string, string>,
    "commands": ValidationCommand[]
  },
  "postActivity": {
    "cleanup": boolean,
    "createSummary": boolean,
    "extractFiles": {
      "pattern": string,
      "destination": string,
      "action": "copy" | "move"
    }?
  },
  "onError": {
    "captureEnvironment": boolean,
    "captureLogs": { "tail": number }?,
    "createDiagnosticImpulse": boolean,
    "cleanup": boolean
  }
}
```

## Best Practices

### Task Design

1. **Keep it simple**: 3-5 tasks is optimal, 7 is maximum
2. **Clear dependencies**: Linear or tree structure, no cycles
3. **Atomic tasks**: Each task should do one thing well
4. **Testable validation**: Validation should be objective and automatable

### Agent Selection (Deprecated)

The `subagent` field is deprecated. Use `agentImpulses` instead for dynamic agent behavior:

```json
{
  "id": "my-task",
  "agentImpulses": ["task-instructions", "tool-config", "constraints"],
  "prompt": { ... }
}
```

If you must use `subagent` for backward compatibility:
- `general`: Multi-purpose work
- `config`: Schema/config changes
- `session`: Prompt engineering
- `tool`: Tool implementations
- `test`: Test coverage
- `docs`: Documentation
- `build`: TypeScript compilation

### Validation Strategy

1. **Required files**: Use for tasks that create files
2. **Required patterns**: Check agent followed instructions
3. **Forbidden patterns**: Prevent common mistakes (TODO, console.log, etc.)
4. **Commands**: Run typecheck, tests, linting

### Token Budgets

- **Simple tasks**: 8,000 tokens
- **Moderate tasks**: 10,000-12,000 tokens
- **Complex tasks**: 14,000-16,000 tokens
- **Context-heavy tasks**: Consider splitting into multiple tasks

## Examples

### Minimal Template

```json
{
  "name": "Simple Script",
  "description": "Create a simple utility script",
  "category": "tool",
  "tasks": [
    {
      "id": "create-script",
      "subagent": "general",
      "description": "Create the script file",
      "dependencies": [],
      "prompt": {
        "template": "Create a {{scriptName}} script that {{functionality}}.",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": [
          {
            "name": "scriptName",
            "type": "string",
            "required": true,
            "description": "Name of the script"
          },
          {
            "name": "functionality",
            "type": "string",
            "required": true,
            "description": "What the script should do"
          }
        ]
      },
      "validation": {
        "requiredFiles": ["*.sh", "*.js", "*.py"],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "simple"
      }
    }
  ],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": false,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "key-components"
  }
}
```

### Advanced Template with Context Requirements

```json
{
  "name": "Fix Bug with Context",
  "description": "Fix a bug using existing code patterns and quality analysis",
  "category": "bugfix",
  "contextRequirements": [
    {
      "key": "bugContext",
      "hint": "Use metabob_search_codebase_issues to find similar bugs",
      "impulseTypes": ["metabobIssue"],
      "required": true,
      "budgetRange": [2000, 4000]
    },
    {
      "key": "codePatterns",
      "hint": "Use metabob_search_codebase_issues to find correct patterns",
      "impulseTypes": ["metabobAnnotation", "file"],
      "required": false,
      "budgetRange": [1000, 3000]
    }
  ],
  "tasks": [
    {
      "id": "analyze-bug",
      "subagent": "general",
      "description": "Analyze bug and similar issues",
      "dependencies": [],
      "impulseReferences": ["bugContext", "codePatterns"],
      "prompt": {
        "template": "Analyze bug: {{bugDescription}}\n\nReview similar issues from context and identify root cause.",
        "maxTokens": 10000,
        "compressionStrategy": "filter",
        "variables": [
          {
            "name": "bugDescription",
            "type": "string",
            "required": true,
            "description": "Description of the bug"
          }
        ]
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": ["## Root Cause", "## Fix Approach"],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "progressive-context"
      }
    },
    {
      "id": "implement-fix",
      "subagent": "general",
      "description": "Implement the bug fix",
      "dependencies": ["analyze-bug"],
      "prompt": {
        "template": "Implement fix for bug based on analysis.\n\nFollow existing code patterns from context.",
        "maxTokens": 12000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": [
          {
            "name": "typecheck",
            "command": "npm run typecheck",
            "required": true
          },
          {
            "name": "test",
            "command": "npm test",
            "required": true
          }
        ]
      },
      "retry": {
        "max_attempts": 3,
        "strategy": "progressive-context"
      }
    }
  ],
  "integration": {
    "preChecks": ["git status"],
    "postChecks": ["npm test"],
    "qualityGates": [
      {
        "name": "tests-pass",
        "command": "npm test",
        "required": true
      }
    ]
  },
  "metabob": {
    "enabled": true,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "key-components"
  }
}
```

## Template Registration

### Using the Tool

```typescript
// Validate only (dry run)
register_activity_template({
  file_path: "./my-template.json",
  validate_only: true
})

// Register with backend
register_activity_template({
  file_path: "./my-template.json",
  validate_only: false
})
```

### Validation Script

```bash
bash scripts/validate-activity-template.sh my-template.json
```

## Common Issues

### Issue: "Missing required field"
- **Cause**: Template is missing a required schema field
- **Fix**: Add the missing field or check spelling

### Issue: "Circular dependency detected"
- **Cause**: Task dependency graph has a cycle
- **Fix**: Review task dependencies, ensure no task depends on itself transitively

### Issue: "Variable not found in template"
- **Cause**: Variable defined but not used in prompt, or typo in `{{variable}}`
- **Fix**: Check prompt template for correct variable usage

### Issue: "Duplicate task IDs"
- **Cause**: Two or more tasks have the same ID
- **Fix**: Ensure all task IDs are unique

### Issue: "Invalid category"
- **Cause**: Category is not one of the allowed values
- **Fix**: Use: `feature`, `bugfix`, `refactor`, `tool`, or `infrastructure`

## Advanced Features

### Cross-Repository Tasks

Execute tasks in different repositories using ACP delegation:

```json
{
  "id": "backend-task",
  "executionTarget": {
    "type": "remote",
    "connection": "docker://devbob-rpc-api",
    "repository": "metabob-rpc-api",
    "shareImpulses": true,
    "syncActivityState": true
  },
  "prompt": { ... }
}
```

### Task Complexity Tiers

Guide model selection for cost optimization:

```json
{
  "id": "simple-task",
  "complexity": {
    "tier": "simple",
    "reasoning": "Straightforward file creation",
    "suggestedModels": {
      "preferred": "anthropic/claude-haiku-4",
      "fallback": "anthropic/claude-sonnet-4"
    },
    "characteristics": {
      "requires_deep_reasoning": false,
      "requires_creativity": false,
      "has_clear_criteria": true,
      "involves_tradeoffs": false
    }
  }
}
```

### Impulse-Based Agents

Define agent behavior through impulses instead of hardcoded names:

```json
{
  "id": "custom-agent-task",
  "agentImpulses": [
    "specialized-instructions",
    "tool-restrictions",
    "quality-constraints"
  ],
  "prompt": { ... }
}
```

## Resources

- **Schema Definition**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- **Example Template**: `example-activity-template.json`
- **Existing Templates**: `repos/metabob-opencode/packages/opencode/templates/built-in/`
- **Validation Script**: `scripts/validate-activity-template.sh`

## Getting Help

If you need assistance:
1. Check the example templates in `templates/built-in/`
2. Review the TypeScript schema for field definitions
3. Run validation to see specific error messages
4. Ask for help with specific template requirements
