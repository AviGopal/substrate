# Activity Template Validation Report

## Summary

Validated 3 activity templates in the repository against the ActivityTemplate.Schema.

**Result: All templates require updates to match the current schema.**

## Validation Results

### 1. example-activity-template.json ❌
**Status:** FAILED - 18 validation errors

**Missing Required Fields:**
- `id` - Template identifier
- `version` - Version object (not number)
- `genealogy` - Template lineage tracking
- `executions` - Execution count
- `successRate` - Success rate metric
- `avgDuration` - Average duration metric
- `avgCost` - Average cost metric
- `avgTokens` - Token usage metrics (input/output/cache)
- `createdAt` - Creation timestamp
- `updatedAt` - Update timestamp

**Schema Mismatches:**
- `tasks[*].retry.max_attempts` should be `maxAttempts` (camelCase)
- `tasks[*]` missing `metrics` object (successRate, avgTokens, avgDuration, commonFailures)
- Uses `maxTokens` in prompt config (should be just a number field)

### 2. test-template-final.json ❌
**Status:** FAILED - 24 validation errors

**Missing Required Fields:**
- Same core fields as example-activity-template.json
- `integration` object (preChecks, postChecks, qualityGates)
- `metabob` configuration object

**Schema Mismatches:**
- `tasks[0].prompt.max_tokens` should be `maxTokens` (camelCase)
- `tasks[0].prompt.compressionStrategy` is undefined (not "filter")
- `tasks[0].prompt.variables` is undefined (should be array)
- `tasks[0].validation.required_patterns` should be `requiredPatterns`
- `tasks[0].validation` missing required arrays: requiredFiles, requiredPatterns, forbiddenPatterns, commands
- `tasks[0].retry.max_attempts` should be `maxAttempts`
- Missing task `metrics` object

### 3. create-activity-template.json (built-in) ❌
**Status:** FAILED - 23 validation errors

**Key Issues:**
- `version: 4` should be a `Version` object with structure: `{ major, minor, patch, variant, hash }`
- Missing execution metrics: executions, successRate, avgDuration, avgCost, avgTokens
- Missing timestamps: createdAt, updatedAt
- Missing genealogy object
- `contextRequirements[0].impulseTypes[0]` has invalid value "toolOutput" (not in enum)
- `learning.feedbackPoints[*].improvementHints` is undefined (should be record)

**Note:** This is the built-in template used by the system itself, so it needs updating.

## Schema Requirements

### Core Required Fields

All templates must include:

```typescript
{
  // Identity
  id: string
  name: string
  description: string
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  
  // Version & Lineage
  version: {
    major: number
    minor: number
    patch: number
    variant: number
    hash: string
  }
  genealogy: {
    parentId?: string
    parentVersion?: Version
    createdFrom: "manual" | "evolution" | "composition" | "trailblazing"
    author: { type: "human" | "ai", identifier: string }
    evolutionReason?: string
  }
  
  // Execution Metrics
  executions: number
  successRate: number
  avgDuration: number
  avgCost: number
  avgTokens: {
    input: number
    output: number
    cache: number
  }
  
  // Tasks
  tasks: Array<{
    id: string
    subagent?: string  // deprecated but optional
    description: string
    dependencies: string[]
    prompt: {
      template: string
      maxTokens: number
      compressionStrategy: "none" | "summarize" | "filter" | "adaptive"
      variables: Array<{
        name: string
        type: "string" | "number" | "boolean" | "file" | "files" | "codebase-context"
        required: boolean
        description: string
        default?: unknown
      }>
    }
    validation: {
      requiredFiles: string[]
      requiredPatterns: string[]
      forbiddenPatterns: string[]
      commands: Array<{
        name: string
        command: string
        required: boolean
      }>
    }
    retry: {
      maxAttempts: number  // NOT max_attempts
      strategy: "simple" | "progressive-context" | "fallback-agent" | "trailblazing"
      fallbackPrompt?: string
    }
    metrics: {
      successRate: number
      avgTokens: number
      avgDuration: number
      commonFailures: string[]
    }
  }>
  
  // Integration & Configuration
  integration: {
    preChecks: string[]
    postChecks: string[]
    qualityGates: Array<{
      name: string
      command: string
      required: boolean
    }>
  }
  
  metabob: {
    enabled: boolean
    learningMode: boolean
    targetContextTokens: number
    annotationStrategy: "all" | "key-components" | "failures-only"
  }
  
  // Timestamps
  createdAt: number  // Unix timestamp
  updatedAt: number  // Unix timestamp
  
  // Optional but recommended
  contextRequirements?: Array<{
    key: string
    hint: string
    impulseTypes: ("memo" | "file" | "component" | "commit" | "metabobIssue" | "metabobAnnotation" | "activityOutput" | "bashOutput" | "activityRecommendation" | "custom")[]
    required: boolean
    budgetRange: [number, number]
  }>
  
  hooks?: {
    preActivity?: { ... }
    postActivity?: { ... }
    onError?: { ... }
  }
  
  composition?: {
    standalone: boolean
    composesWith?: Array<{ templateId, relationship, description, example }>
    examples?: Array<{ name, description, sequence, outcome }>
  }
  
  learning?: {
    enabled: boolean
    captureStrategy: "detailed" | "summary" | "minimal"
    feedbackPoints: Array<{
      taskId: string
      metrics: Record<string, string>
      improvementHints: Record<string, string>  // NOT optional
    }>
  }
}
```

### Common Mistakes

1. **Snake case vs Camel case**
   - ❌ `max_attempts`, `max_tokens`, `required_patterns`
   - ✅ `maxAttempts`, `maxTokens`, `requiredPatterns`

2. **Version as number**
   - ❌ `version: 4`
   - ✅ `version: { major: 1, minor: 0, patch: 0, variant: 0, hash: "..." }`

3. **Missing metrics object per task**
   - Each task needs `metrics: { successRate, avgTokens, avgDuration, commonFailures }`

4. **Missing execution history**
   - Templates need `executions`, `successRate`, `avgDuration`, `avgCost`, `avgTokens` at root level

5. **Invalid impulse types**
   - ❌ `"toolOutput"` is not valid
   - ✅ Valid types: "memo", "file", "component", "commit", "metabobIssue", "metabobAnnotation", "activityOutput", "bashOutput", "activityRecommendation", "custom"

## Recommendations

### For Users Creating Templates

**Use the `register_activity_template` tool with `validate_only: true`** to validate templates before registration:

```typescript
register_activity_template({
  file_path: "./my-template.json",
  validate_only: true
})
```

This will show all schema violations before attempting registration.

### For Template Creators

1. **Start from a working example**: Use the built-in create-activity-template to generate new templates
2. **Use CreateOptions format**: Templates can be created using the simpler `CreateOptions` schema, and the system will auto-generate:
   - `id` (based on category and hash)
   - `version` object
   - `genealogy` object
   - Execution metrics (initialized to 0)
   - Timestamps

3. **CreateOptions minimal template**:

```json
{
  "name": "My Template",
  "description": "What this template does",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "Task description",
      "dependencies": [],
      "prompt": {
        "template": "Do something",
        "maxTokens": 8000
      }
    }
  ]
}
```

The system will automatically add all required fields when you register it.

### Next Steps

1. **Update existing templates** to match current schema
2. **Fix built-in create-activity-template.json** - this is critical as it's used to create new templates
3. **Document CreateOptions format** for easier template creation
4. **Create migration script** to upgrade old templates to new schema

## Files Requiring Updates

1. `/home/avi/documents/work/exp-repo/metabob-devbob/example-activity-template.json`
2. `/home/avi/documents/work/exp-repo/metabob-devbob/test-template-final.json`
3. `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`

---

**Generated:** February 12, 2026
**Validator:** register_activity_template with validate_only flag
**Schema Version:** ActivityTemplate.Schema from activity-template.ts
