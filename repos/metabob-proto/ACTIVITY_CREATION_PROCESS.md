# Activity Template Creation Process

> **Purpose**: Document the standard workflow for creating new activity templates via LLM task generation in metabob-proto.

---

## Table of Contents

1. [Overview](#overview)
2. [The Meta-Activity Approach](#the-meta-activity-approach)
3. [Standard Workflow](#standard-workflow)
4. [Activity Template Structure](#activity-template-structure)
5. [Task Design Principles](#task-design-principles)
6. [Best Practices](#best-practices)
7. [Examples and Patterns](#examples-and-patterns)

---

## Overview

Activity templates in metabob-devbob are created using **meta-activities** - activities that create activities. This self-referential approach enables:

- **Consistency**: All templates follow the same structure and patterns
- **Learning**: Template creation itself generates execution traces for improvement
- **Automation**: The system learns what makes good templates through Thompson Sampling
- **Self-improvement**: MiniBob can create and improve its own capabilities

The canonical meta-activity is `create-activity-self-contained.json` (repos/metabob-proto/activities/bootstrap/).

---

## The Meta-Activity Approach

### Why Meta-Activities?

Traditional approach:
```
Developer writes JSON → Manual testing → Deploy → Hope it works
```

Meta-activity approach:
```
User describes need → LLM generates template → Automatic validation →
Register with backend → Thompson Sampling learns → System improves
```

### Key Benefits

1. **Ribosome Pattern**: Activities that create activities, task by task
2. **Measured Creation**: Every template creation is traced and measured
3. **Evolutionary Improvement**: Failed templates create variants automatically
4. **Knowledge Extraction**: Successful patterns become reusable templates

---

## Standard Workflow

The activity creation process follows a **4-phase workflow**:

### Phase 1: Gather Requirements

**Task**: `gather-requirements`
**Agent**: `general`
**Purpose**: Extract and clarify requirements from user input

**Input Variables**:
- `templateName`: Human-readable name (e.g., "Add REST Endpoint")
- `templateDescription`: One-sentence description
- `category`: One of: feature, bugfix, refactor, tool, infrastructure
- `purpose`: Detailed explanation of workflow to automate
- `templateId`: Kebab-case ID (e.g., "add-rest-endpoint")

**Output**: `/tmp/activity-template-{templateId}/REQUIREMENTS.md`

**What It Produces**:
```markdown
# Activity Requirements: {templateName}

## Overview
[Brief description]

## Workflow Steps
1. Step 1: Description (Dependencies: none)
2. Step 2: Description (Dependencies: Step 1)
...

## Input Variables
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

## Expected Outputs
- Files created
- Reports generated
- State changes

## Validation Criteria
- Per-task validation
- Overall success criteria

## Error Handling
- Common failures
- Retry strategies
```

**Validation**:
- ✅ `REQUIREMENTS.md` exists in `/tmp/activity-template-{templateId}/`
- ✅ Contains sections: Workflow Steps, Input Variables, Validation Criteria
- ✅ No placeholders or TODOs remain

---

### Phase 2: Design Task Graph

**Task**: `design-task-graph`
**Agent**: `general`
**Dependencies**: `gather-requirements`
**Purpose**: Create task breakdown with proper dependency DAG

**Key Design Principles**:

1. **Atomicity**: Each task does ONE thing well
   - ❌ Bad: "Create files and run tests and commit"
   - ✅ Good: "Create files" → "Run tests" → "Commit changes"

2. **DAG Structure**: Tasks form a Directed Acyclic Graph
   - Linear: A → B → C (sequential)
   - Tree: A → B, A → C, B+C → D (parallel branches merge)
   - ❌ Never: A → B → C → A (circular)

3. **Granularity**: 3-5 tasks optimal, 7 maximum
   - Too few: Tasks become complex and hard to debug
   - Too many: Overhead increases, composability suffers

4. **Independence**: Tasks with no dependencies can run in parallel

**Output**: `/tmp/activity-template-{templateId}/TASK_GRAPH.md`

**What It Produces**:
```markdown
# Task Graph: {templateName}

## Overview
- Total tasks: 4
- Execution pattern: linear / parallel-merge / tree
- Estimated duration: ~2 minutes
- Estimated cost: $0.05

## Task Breakdown

### Task 1: task-id-1
- **Description**: What this task does
- **Agent**: general
- **Dependencies**: none
- **Estimated tokens**: 5000
- **Validation**: Success criteria

### Task 2: task-id-2
- **Description**: What this task does
- **Agent**: general
- **Dependencies**: task-id-1
- **Estimated tokens**: 8000
- **Validation**: Success criteria

## Dependency Graph
```
task-id-1
  ↓
task-id-2
  ↓
task-id-3
```

## Token Budget Summary
- Task 1: 5000 tokens
- Task 2: 8000 tokens
- **Total**: 13000 tokens (~$0.XX estimated)
```

**Validation**:
- ✅ `TASK_GRAPH.md` exists
- ✅ Contains: Task Breakdown, Dependency Graph, Token Budget
- ✅ No circular dependencies
- ✅ Token budgets are reasonable (3k-15k per task)

---

### Phase 3: Write Template JSON

**Task**: `write-template-json`
**Agent**: `general`
**Dependencies**: `design-task-graph`
**Purpose**: Generate valid ActivityTemplate.Schema JSON

**CRITICAL RULES**:

1. **NO GIT CHECKS**: Activity templates must not depend on git state
   - ❌ No `preChecks` checking git status
   - ❌ No `postChecks` requiring commits
   - ✅ Templates should be self-contained

2. **Variable Declaration**: All prompt template variables must be declared
   - If prompt has `{{foo}}`, variables array MUST include `{"name": "foo", ...}`

3. **Schema Compliance**: Follow ActivityTemplate.Schema exactly
   - See structure below

**Output**: `/tmp/activity-template-{templateId}/{templateId}.json`

**Validation**:
- ✅ Valid JSON (checked with `jq empty`)
- ✅ Contains required fields: name, category, tasks, contextRequirements
- ✅ No git preChecks or postChecks
- ✅ All variables in prompts are declared

---

### Phase 4: Register with Backend

**Task**: `register-with-backend`
**Agent**: `general`
**Dependencies**: `write-template-json`
**Purpose**: Register template via MCP, create usage docs

**CRITICAL - Use MCP Tools Only**:
- ✅ Use `register_activity_template` MCP tool
- ❌ DO NOT use curl or direct API calls
- ❌ DO NOT try to move files manually
- ✅ MCP handles authentication and storage

**Output**: `/tmp/activity-template-{templateId}/SUCCESS.md`

**What It Produces**:
```markdown
# Activity Template Created: {templateName}

✅ Template ID: `{templateId}`
✅ Category: {category}
✅ Status: Registered with backend

## Usage

```typescript
activity({
  templateId: "{templateId}",
  variables: { /* your variables */ },
  reason: "Why executing this activity"
})
```

## Template Location
- Local storage: ~/.local/share/opencode/storage/activity-template/
- Backend: Registered via MCP

## Next Steps
1. Test template with simple execution
2. Monitor metrics in dashboard
3. Improve based on learnings
```

**Validation**:
- ✅ `SUCCESS.md` exists
- ✅ Contains: Template ID, Status: Registered, Usage example
- ✅ No error markers (❌, FAILED, ERROR)

---

## Activity Template Structure

### Complete Schema

```json
{
  "name": "Template Name",
  "version": 1,
  "description": "One-sentence description",
  "category": "feature|bugfix|refactor|tool|infrastructure",

  "contextRequirements": [],

  "tasks": [
    {
      "id": "task-id",
      "subagent": "general",
      "description": "Task description",
      "dependencies": ["other-task-id"],
      "impulse_refs": [],

      "prompt": {
        "template": "Instructions with {{variables}}",
        "max_tokens": 8000,
        "compression_strategy": "filter|none|summarize|adaptive",
        "variables": [
          {
            "name": "variableName",
            "type": "string|number|boolean|file|files|codebase-context",
            "required": true,
            "description": "What this variable is for",
            "default": "default value (if optional)"
          }
        ]
      },

      "validation": {
        "required_files": ["path/to/file.ext"],
        "required_patterns": ["pattern that must appear"],
        "forbidden_patterns": ["TODO", "FIXME"],
        "commands": [
          {
            "name": "test",
            "command": "npm test",
            "required": true
          }
        ]
      },

      "retry": {
        "max_attempts": 2,
        "strategy": "simple",
        "fallback_prompt": ""
      },

      "metrics": {
        "success_rate": 0,
        "avg_tokens": 0,
        "avg_duration": 0,
        "common_failures": []
      },

      "tools": {
        "required": ["read", "write"],
        "optional": ["bash"],
        "disabled": []
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
  },

  "composition": {
    "standalone": true,
    "composesWith": [],
    "examples": []
  },

  "learning": {
    "enabled": true,
    "captureStrategy": "summary",
    "feedbackPoints": []
  }
}
```

### Field Descriptions

**Top Level**:
- `name`: Human-readable template name
- `version`: Integer version number (increment for major changes)
- `description`: One-sentence description of what template does
- `category`: Classification (feature, bugfix, refactor, tool, infrastructure)
- `contextRequirements`: Dependencies on external context (usually empty for self-contained templates)

**Task Fields**:
- `id`: Kebab-case unique task identifier
- `subagent`: Agent type (general, config, session, tool, test, docs, build)
- `description`: One clear purpose for this task
- `dependencies`: Array of task IDs that must complete first
- `impulse_refs`: References to impulses for context (advanced usage)

**Prompt Configuration**:
- `template`: Instructions with variable interpolation
- `max_tokens`: Token budget (3000-15000 typical)
- `compression_strategy`: How to handle large context
- `variables`: All variables used in template

**Validation**:
- `required_files`: Glob patterns for files that must exist
- `required_patterns`: Strings that MUST appear in output
- `forbidden_patterns`: Strings that must NOT appear
- `commands`: Shell commands to run for validation

**Tools Configuration**:
- `required`: Tools task MUST have access to
- `optional`: Tools that are nice to have
- `disabled`: Tools to explicitly disable

---

## Task Design Principles

### 1. Single Responsibility

Each task should do ONE thing well:

✅ **Good**:
```json
{
  "id": "create-handler-file",
  "description": "Create the route handler implementation file"
}
```

❌ **Bad**:
```json
{
  "id": "create-handler-and-test-and-commit",
  "description": "Create handler, write tests, run tests, and commit"
}
```

---

### 2. Clear Dependencies

Express dependencies explicitly:

✅ **Good**:
```json
{
  "id": "run-tests",
  "dependencies": ["create-handler-file", "create-test-file"]
}
```

❌ **Bad**:
```json
{
  "id": "run-tests",
  "dependencies": []  // Assumes files exist
}
```

---

### 3. Deterministic Validation

Use concrete validation criteria:

✅ **Good**:
```json
{
  "validation": {
    "required_files": ["src/handlers/new-endpoint.ts"],
    "required_patterns": ["export async function handleRequest"],
    "commands": [
      {"command": "npm run typecheck", "required": true}
    ]
  }
}
```

❌ **Bad**:
```json
{
  "validation": {
    "required_patterns": ["looks good"]
  }
}
```

---

### 4. Appropriate Token Budgets

Match budget to task complexity:

- **Simple tasks** (file creation, basic transforms): 3000-5000 tokens
- **Medium tasks** (code generation, analysis): 6000-10000 tokens
- **Complex tasks** (refactoring, design): 10000-15000 tokens
- **Never exceed**: 20000 tokens (split into multiple tasks instead)

---

### 5. Effective Prompt Templates

Write clear, actionable prompts:

✅ **Good**:
```json
{
  "template": "Create a TypeScript route handler for {{endpoint}}.\n\n**Requirements**:\n1. Use async/await\n2. Include error handling\n3. Return JSON responses\n\n**Output**: Write to src/handlers/{{handlerFileName}}.ts"
}
```

❌ **Bad**:
```json
{
  "template": "Make the endpoint {{endpoint}}"
}
```

---

### 6. Proper Agent Selection

Choose the right agent for each task:

- **general**: Default for most tasks (code, analysis, planning)
- **config**: JSON/YAML schema changes, configuration files
- **session**: Prompt engineering, template creation
- **tool**: Tool implementations, CLI utilities
- **test**: Test writing, test generation
- **docs**: Documentation, README files
- **build**: TypeScript compilation, build processes

---

## Best Practices

### 1. Start from User Intent

Always begin by understanding WHAT the user wants to accomplish, not HOW to implement it:

✅ **Good Requirements Gathering**:
```
User: "I want to add authentication"
Template:
  - What type? (JWT, session, OAuth)
  - What endpoints need protection?
  - Where to store credentials?
  - What error responses?
```

❌ **Bad Requirements Gathering**:
```
User: "I want to add authentication"
Template: *immediately generates JWT implementation*
```

---

### 2. Design the Graph, Then Fill Details

Create the task dependency structure first, then write detailed prompts:

**Order**:
1. Identify major phases (setup → implement → test → finalize)
2. Break each phase into 1-2 tasks
3. Draw dependency graph
4. Estimate token budgets
5. Write detailed prompts
6. Add validation criteria

---

### 3. Write to Temporary Locations

Activity templates should NEVER modify the working repository directly:

✅ **Good**:
```json
{
  "prompt": {
    "template": "Write output to /tmp/activity-{taskId}/output.json"
  }
}
```

❌ **Bad**:
```json
{
  "prompt": {
    "template": "Write output to ./src/output.json"
  }
}
```

**Rationale**: Templates are learning and may fail. Temporary locations allow rollback and don't pollute the workspace.

---

### 4. Make Templates Self-Contained

Avoid dependencies on git state, external services, or specific file structures:

✅ **Self-Contained**:
```json
{
  "contextRequirements": [],
  "integration": {
    "preChecks": [],
    "postChecks": []
  }
}
```

❌ **Fragile**:
```json
{
  "integration": {
    "preChecks": [
      {"type": "git_clean", "required": true}
    ]
  }
}
```

---

### 5. Enable Learning

Always enable learning and capture strategy:

✅ **Good**:
```json
{
  "learning": {
    "enabled": true,
    "captureStrategy": "summary",
    "feedbackPoints": ["after-validation", "on-failure"]
  }
}
```

This allows Thompson Sampling to learn which templates succeed.

---

### 6. Version Incrementally

When modifying templates:

- **Minor tweaks** (prompt wording, token budgets): Keep version
- **Task changes** (add/remove tasks, change validation): Increment version
- **Breaking changes** (different input variables): Create new template ID

---

## Examples and Patterns

### Pattern 1: Linear Workflow

**Use Case**: Sequential steps where each depends on previous

```
analyze-requirements → generate-implementation → validate-output
```

**Example Template**:
```json
{
  "tasks": [
    {
      "id": "analyze-requirements",
      "dependencies": []
    },
    {
      "id": "generate-implementation",
      "dependencies": ["analyze-requirements"]
    },
    {
      "id": "validate-output",
      "dependencies": ["generate-implementation"]
    }
  ]
}
```

**When to Use**: Simple workflows where output of each step feeds directly into next

---

### Pattern 2: Parallel-Merge

**Use Case**: Independent work streams that combine

```
analyze-requirements
  ├→ create-backend (parallel)
  └→ create-frontend (parallel)
       ↓
  integrate-components
```

**Example Template**:
```json
{
  "tasks": [
    {
      "id": "analyze-requirements",
      "dependencies": []
    },
    {
      "id": "create-backend",
      "dependencies": ["analyze-requirements"]
    },
    {
      "id": "create-frontend",
      "dependencies": ["analyze-requirements"]
    },
    {
      "id": "integrate-components",
      "dependencies": ["create-backend", "create-frontend"]
    }
  ]
}
```

**When to Use**: When subtasks can work independently then need integration

---

### Pattern 3: Checkpoint-Validate-Retry

**Use Case**: Risky operations that might fail

```
checkpoint → risky-operation → validate → (rollback if failed)
```

**Example Template**:
```json
{
  "tasks": [
    {
      "id": "create-checkpoint",
      "description": "Create git checkpoint before risky operation"
    },
    {
      "id": "risky-operation",
      "dependencies": ["create-checkpoint"],
      "retry": {
        "max_attempts": 3,
        "strategy": "simple"
      }
    },
    {
      "id": "validate",
      "dependencies": ["risky-operation"],
      "validation": {
        "commands": [{"command": "npm test", "required": true}]
      }
    }
  ]
}
```

**When to Use**: Code generation, refactoring, destructive operations

---

### Pattern 4: Hypothesis Testing

**Use Case**: Explore codebase to understand before implementing

**See**: `repos/metabob-proto/activities/hypothesis/` for complete examples

```
generate-hypotheses → test-hypothesis → interpret-results → align-code-or-validators
```

---

## Invoking the Template Creation Process

### Using the Meta-Activity

```typescript
import { activity } from '@metabob/minibob';

const result = await activity({
  templateId: "create-activity-self-contained",
  variables: {
    templateName: "Add REST Endpoint",
    templateDescription: "Create a new REST API endpoint with handler, validation, and tests",
    category: "feature",
    purpose: "Automate the process of adding new REST endpoints to the API with proper error handling, validation, and test coverage",
    templateId: "add-rest-endpoint"
  },
  reason: "Need reusable template for adding REST endpoints"
});

// On success, result contains:
// - REQUIREMENTS.md
// - TASK_GRAPH.md
// - {templateId}.json
// - SUCCESS.md
// - Template registered with backend
```

### Manual Process (for understanding)

1. **Gather Requirements**:
   ```bash
   # Manually create REQUIREMENTS.md with:
   # - Workflow steps
   # - Input variables
   # - Expected outputs
   # - Validation criteria
   ```

2. **Design Task Graph**:
   ```bash
   # Create TASK_GRAPH.md with:
   # - Task breakdown
   # - Dependency graph
   # - Token budgets
   ```

3. **Write Template JSON**:
   ```bash
   # Create {templateId}.json following ActivityTemplate.Schema
   # Validate with: cat template.json | jq empty
   ```

4. **Register**:
   ```bash
   # Use MCP tool: register_activity_template
   # Or via minibob CLI
   ```

---

## Learning Loop Integration

Every template creation execution is measured:

```typescript
{
  execution_id: "exec-abc123",
  activity_id: "create-activity-self-contained",
  status: "completed",
  success: true,
  duration_ms: 45000,
  cost_usd: 0.12,
  tasks_completed: 4,
  outcome: "Template 'add-rest-endpoint' created and registered"
}
```

This trace feeds Thompson Sampling:
- **Success** → Increase α (prior successes)
- **Failure** → Increase β (prior failures)
- **Next selection** → Draw from Beta(α, β)

Over time, the system learns which template creation patterns work best.

---

## Troubleshooting

### Common Issues

**Issue**: Task dependencies form a cycle
```
Error: Circular dependency detected: task-a → task-b → task-c → task-a
```

**Solution**: Review TASK_GRAPH.md and ensure DAG structure

---

**Issue**: Variable used in prompt but not declared
```
Error: Variable {{foo}} used in prompt but not in variables array
```

**Solution**: Add to variables array:
```json
{
  "variables": [
    {"name": "foo", "type": "string", "required": true, "description": "..."}
  ]
}
```

---

**Issue**: Template validation fails
```
Error: Pattern 'export async function' not found in output
```

**Solution**: Check validation criteria are realistic, not overly strict

---

**Issue**: Token budget exceeded
```
Warning: Task consumed 12500 tokens, budget was 8000
```

**Solution**: Increase `max_tokens` or split task into smaller subtasks

---

## Conclusion

Activity template creation via LLM task generation follows a structured, measurable process:

1. **Gather Requirements**: Understand user intent completely
2. **Design Task Graph**: Create DAG with clear dependencies
3. **Write Template JSON**: Follow schema exactly, validate thoroughly
4. **Register with Backend**: Use MCP tools, enable learning

This process is itself an activity template (`create-activity-self-contained.json`), demonstrating the **ribosome pattern** where activities create activities.

Every execution is traced, measured, and learned from through Thompson Sampling, enabling the system to continuously improve its template creation capabilities.

**Key Principles**:
- ✅ Start from user intent, not implementation
- ✅ Design graph structure before details
- ✅ Make templates self-contained
- ✅ Use temporary locations for outputs
- ✅ Enable learning and capture traces
- ✅ Validate thoroughly at each step

The result is a growing library of high-quality, battle-tested activity templates that encode best practices and learned patterns.
