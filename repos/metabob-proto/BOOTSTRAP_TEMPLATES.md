# Bootstrap Activity Templates

> **Purpose**: Comprehensive guide to bootstrap activities for cold-start scenarios, execution flow management with explicit resolvers, and rollback strategies aligned with impulse-resolver architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Alignment](#architecture-alignment)
3. [Resolver Types](#resolver-types)
4. [Bootstrap Activity Templates](#bootstrap-activity-templates)
5. [Execution Flow Management](#execution-flow-management)
6. [Rollback Strategies](#rollback-strategies)
7. [Examples](#examples)
8. [Key Principles](#key-principles)

---

## Overview

Bootstrap activities handle **cold-start scenarios** where:
- No matching templates exist for the user's goal
- System must improvise with recording
- Failed executions require tactical adjustments
- State transitions need checkpoint-based rollback

This document defines bootstrap templates following the **impulse-resolver architecture**, where:
- **Tasks specify which resolver handles them** (llm, git, bash, file, validation, mcp)
- **Impulses flow as references**, not content
- **LLM is just one resolver among many** (used only for reasoning/generation)
- **Most operations use deterministic resolvers** (git, bash, file, validation)

---

## Architecture Alignment

### The Impulse-Resolver Model

```
INPUT IMPULSES → ACTIVITY → OUTPUT IMPULSES
                    ↓
            TASK SEQUENCE
                    ↓
      ┌─────────────┴─────────────┐
      ↓                           ↓
  RESOLVER              RESOLVER
  (explicit)            (explicit)
      ↓                           ↓
    llm                         bash
  (reasoning)              (execution)
      ↓                           ↓
  IMPULSE                     IMPULSE
  (output)                    (output)
```

**Key differences from traditional approach:**

| Traditional | Impulse-Resolver |
|-------------|------------------|
| LLM does everything | LLM reasons, resolvers execute |
| Tasks have prompts | Tasks have resolver + config |
| Data embedded in prompts | Data as impulse references |
| Sequential execution only | Explicit dependency graph |
| Retry = re-prompt | Retry = rollback + adjust |

---

## Resolver Types

Bootstrap templates use these resolvers available in MiniBob:

### 1. `llm` Resolver

**Purpose**: Reasoning about ambiguous input, generating text/code

**When to use:**
- Analyzing user intent
- Generating code/documentation
- Decision-making with uncertainty
- Creative problem-solving

**Config structure:**
```json
{
  "resolver": "llm",
  "config": {
    "model": "claude-sonnet-4",
    "temperature": 0.7,
    "max_tokens": 4000,
    "system_prompt": "You are analyzing code patterns..."
  }
}
```

**Key principle**: Use LLM minimally. If the task can be done deterministically (file ops, git ops, validation), use those resolvers instead.

---

### 2. `git` Resolver

**Purpose**: Version control operations, state checkpointing, rollback

**When to use:**
- Creating checkpoints before risky changes
- Rolling back failed changes
- Querying commit history
- Determining current state

**Config structure:**
```json
{
  "resolver": "git",
  "config": {
    "operation": "checkpoint|rollback|status|diff|log",
    "checkpoint_tag": "before-task-3",
    "rollback_to": "checkpoint-tag-or-sha",
    "paths": ["src/", "tests/"]
  }
}
```

**Operations:**
- `checkpoint`: Create tagged commit with current state
- `rollback`: Reset to specific checkpoint/commit
- `status`: Get working tree status
- `diff`: Get changes since checkpoint
- `log`: Query commit history

---

### 3. `bash` Resolver

**Purpose**: Shell command execution, running tools/tests

**When to use:**
- Running tests/linters
- Installing dependencies
- Building projects
- System operations

**Config structure:**
```json
{
  "resolver": "bash",
  "config": {
    "command": "npm test",
    "working_directory": "./",
    "timeout_ms": 30000,
    "capture_output": true,
    "env": {
      "NODE_ENV": "test"
    }
  }
}
```

**Safety**: Always validate bash commands. Never construct from untrusted input.

---

### 4. `file` Resolver

**Purpose**: Filesystem operations (read, write, search)

**When to use:**
- Reading source code
- Writing generated files
- Searching codebases
- File management

**Config structure:**
```json
{
  "resolver": "file",
  "config": {
    "operation": "read|write|search|glob",
    "path": "src/auth.ts",
    "content": "...",
    "pattern": "**/*.ts",
    "search_query": "function authenticate"
  }
}
```

**Operations:**
- `read`: Read file contents
- `write`: Write/overwrite file
- `search`: Grep-like content search
- `glob`: File pattern matching

---

### 5. `validation` Resolver

**Purpose**: Deterministic validation without LLM

**When to use:**
- Checking file existence
- Pattern matching in output
- Command success/failure
- JSON schema validation

**Config structure:**
```json
{
  "resolver": "validation",
  "config": {
    "rules": [
      {
        "type": "file_exists",
        "path": "output.json"
      },
      {
        "type": "pattern_match",
        "file": "output.json",
        "pattern": "\"status\": \"success\""
      },
      {
        "type": "command_success",
        "command": "npm test",
        "timeout_ms": 30000
      }
    ]
  }
}
```

**Rule types:**
- `file_exists`: Check file/directory exists
- `pattern_match`: Regex search in file
- `pattern_forbidden`: Ensure pattern NOT present
- `command_success`: Verify command exit code 0
- `json_schema`: Validate JSON against schema

---

### 6. `mcp` Resolver

**Purpose**: Backend queries (execution traces, templates, metrics)

**When to use:**
- Querying execution history
- Fetching template definitions
- Accessing learned patterns
- Thompson Sampling queries

**Config structure:**
```json
{
  "resolver": "mcp",
  "config": {
    "tool": "get_execution_trace|search_templates|get_metrics",
    "params": {
      "execution_id": "exec-123",
      "activity_pattern": "%debug%",
      "lookback_days": 30
    }
  }
}
```

**Available tools:**
- `get_execution_trace`: Fetch trace by ID
- `search_templates`: Find matching activities
- `get_metrics`: Query Thompson Sampling stats
- `get_impulse_relevance`: Relevance scores

---

## Bootstrap Activity Templates

### Template 1: Cold-Start Bootstrap

**Use case**: No matching templates exist for user's goal

**Activity ID**: `meta:cold-start-bootstrap`

**Input shapes**: `goal` (user request)

**Output shapes**: `activity` (generated template), `trace` (execution history)

**Structure:**

```json
{
  "activity_id": "meta:cold-start-bootstrap",
  "name": "Cold-Start Bootstrap",
  "description": "Improvise solution when no templates match, record execution, extract as template",
  "input_shapes": ["goal"],
  "output_shapes": ["activity", "trace"],

  "tasks": [
    {
      "id": "analyze-intent",
      "resolver": "llm",
      "description": "Analyze user goal to understand intent and requirements",
      "inputImpulses": ["goal"],
      "outputImpulses": ["intent_analysis"],
      "config": {
        "model": "claude-sonnet-4",
        "temperature": 0.7,
        "max_tokens": 2000,
        "system_prompt": "Analyze the user's goal and break it into concrete requirements."
      }
    },

    {
      "id": "checkpoint-before-improvisation",
      "resolver": "git",
      "description": "Create checkpoint before attempting improvisation",
      "dependencies": ["analyze-intent"],
      "inputImpulses": [],
      "outputImpulses": ["checkpoint"],
      "config": {
        "operation": "checkpoint",
        "checkpoint_tag": "before-bootstrap-{{timestamp}}",
        "message": "Checkpoint before bootstrap improvisation for: {{goal_summary}}"
      }
    },

    {
      "id": "search-similar-executions",
      "resolver": "mcp",
      "description": "Query backend for similar past executions to learn from",
      "dependencies": ["analyze-intent"],
      "inputImpulses": ["intent_analysis"],
      "outputImpulses": ["similar_traces"],
      "config": {
        "tool": "search_executions",
        "params": {
          "goal_keywords": "{{extracted_keywords}}",
          "success_only": true,
          "limit": 5
        }
      }
    },

    {
      "id": "improvise-with-llm",
      "resolver": "llm",
      "description": "Improvise solution based on intent and similar executions",
      "dependencies": ["search-similar-executions", "checkpoint-before-improvisation"],
      "inputImpulses": ["intent_analysis", "similar_traces"],
      "outputImpulses": ["improvised_solution"],
      "config": {
        "model": "claude-sonnet-4",
        "temperature": 0.8,
        "max_tokens": 8000,
        "system_prompt": "Generate a solution for this goal. Learn from similar past executions. Be explicit about steps and validation."
      }
    },

    {
      "id": "execute-improvisation",
      "resolver": "bash",
      "description": "Execute improvised commands with output capture",
      "dependencies": ["improvise-with-llm"],
      "inputImpulses": ["improvised_solution"],
      "outputImpulses": ["execution_output"],
      "config": {
        "command": "{{commands_from_llm}}",
        "capture_output": true,
        "timeout_ms": 300000
      }
    },

    {
      "id": "validate-outcome",
      "resolver": "validation",
      "description": "Validate that improvisation achieved the goal",
      "dependencies": ["execute-improvisation"],
      "inputImpulses": ["execution_output", "intent_analysis"],
      "outputImpulses": ["validation_result"],
      "config": {
        "rules": [
          {
            "type": "derived_from_intent",
            "source": "intent_analysis",
            "validation": "success_criteria"
          }
        ]
      }
    },

    {
      "id": "rollback-if-failed",
      "resolver": "git",
      "description": "Rollback to checkpoint if validation failed",
      "dependencies": ["validate-outcome"],
      "condition": "validation_result.success === false",
      "inputImpulses": ["checkpoint"],
      "outputImpulses": ["rollback_result"],
      "config": {
        "operation": "rollback",
        "rollback_to": "{{checkpoint.tag}}"
      }
    },

    {
      "id": "extract-template",
      "resolver": "llm",
      "description": "Extract successful improvisation as reusable template",
      "dependencies": ["validate-outcome"],
      "condition": "validation_result.success === true",
      "inputImpulses": ["improvised_solution", "execution_output", "validation_result"],
      "outputImpulses": ["activity_template"],
      "config": {
        "model": "claude-sonnet-4",
        "temperature": 0.3,
        "max_tokens": 6000,
        "system_prompt": "Extract the successful improvisation into a reusable activity template with explicit resolvers, validation rules, and rollback strategies."
      }
    },

    {
      "id": "register-template",
      "resolver": "mcp",
      "description": "Register extracted template with backend",
      "dependencies": ["extract-template"],
      "inputImpulses": ["activity_template"],
      "outputImpulses": ["registration_result"],
      "config": {
        "tool": "register_activity_template",
        "params": {
          "template": "{{activity_template}}",
          "initial_alpha": 2,
          "initial_beta": 1,
          "source": "bootstrap_extraction"
        }
      }
    }
  ]
}
```

**Key features:**
- ✅ Checkpoint before risky improvisation
- ✅ Rollback on failure
- ✅ Extract success as template
- ✅ Register for future use
- ✅ Learn from similar executions

---

### Template 2: Execute with Checkpoints

**Use case**: Execute activity with rollback capability at each task

**Activity ID**: `meta:execute-with-checkpoints`

**Input shapes**: `activity`, `goal`

**Output shapes**: `trace`, `checkpoint`

**Structure:**

```json
{
  "activity_id": "meta:execute-with-checkpoints",
  "name": "Execute Activity with Checkpoints",
  "description": "Execute activity template with git checkpoint before each task, enabling granular rollback",
  "input_shapes": ["activity", "goal"],
  "output_shapes": ["trace", "checkpoint"],

  "tasks": [
    {
      "id": "load-activity-template",
      "resolver": "mcp",
      "description": "Load activity template from backend",
      "inputImpulses": ["activity_id"],
      "outputImpulses": ["activity_template"],
      "config": {
        "tool": "get_activity_template",
        "params": {
          "activity_id": "{{activity_id}}"
        }
      }
    },

    {
      "id": "create-initial-checkpoint",
      "resolver": "git",
      "description": "Create checkpoint before starting activity",
      "dependencies": ["load-activity-template"],
      "inputImpulses": [],
      "outputImpulses": ["initial_checkpoint"],
      "config": {
        "operation": "checkpoint",
        "checkpoint_tag": "activity-start-{{activity_id}}-{{timestamp}}",
        "message": "Starting activity: {{activity_name}}"
      }
    },

    {
      "id": "execute-tasks-with-checkpoints",
      "resolver": "meta",
      "description": "For each task in activity: checkpoint → execute → validate → (rollback if failed)",
      "dependencies": ["create-initial-checkpoint"],
      "inputImpulses": ["activity_template", "initial_checkpoint"],
      "outputImpulses": ["task_results"],
      "config": {
        "loop": "activity_template.tasks",
        "steps": [
          {
            "id": "checkpoint-before-task",
            "resolver": "git",
            "config": {
              "operation": "checkpoint",
              "checkpoint_tag": "before-task-{{task.id}}-{{timestamp}}"
            }
          },
          {
            "id": "execute-task",
            "resolver": "{{task.resolver}}",
            "config": "{{task.config}}"
          },
          {
            "id": "validate-task",
            "resolver": "validation",
            "config": {
              "rules": "{{task.validation}}"
            }
          },
          {
            "id": "rollback-if-failed",
            "resolver": "git",
            "condition": "validation.success === false",
            "config": {
              "operation": "rollback",
              "rollback_to": "{{checkpoint.tag}}"
            }
          }
        ]
      }
    },

    {
      "id": "capture-execution-trace",
      "resolver": "mcp",
      "description": "Store execution trace with checkpoint metadata",
      "dependencies": ["execute-tasks-with-checkpoints"],
      "inputImpulses": ["task_results", "activity_template"],
      "outputImpulses": ["trace"],
      "config": {
        "tool": "store_execution_trace",
        "params": {
          "activity_id": "{{activity_id}}",
          "task_results": "{{task_results}}",
          "checkpoints": "{{checkpoint_list}}",
          "outcome": "{{derived_outcome}}"
        }
      }
    }
  ]
}
```

**Key features:**
- ✅ Checkpoint before each task
- ✅ Automatic rollback on validation failure
- ✅ Checkpoint metadata in trace
- ✅ Granular state restoration

---

### Template 3: Adjust Activity from Failure

**Use case**: Failed execution needs tactical adjustment

**Activity ID**: `meta:adjust-activity-from-failure`

**Input shapes**: `trace` (failed execution), `activity`

**Output shapes**: `activity` (adjusted variant)

**Structure:**

```json
{
  "activity_id": "meta:adjust-activity-from-failure",
  "name": "Adjust Activity from Failure",
  "description": "Analyze failed execution and create adjusted activity variant",
  "input_shapes": ["trace", "activity"],
  "output_shapes": ["activity"],

  "tasks": [
    {
      "id": "analyze-failure",
      "resolver": "llm",
      "description": "Analyze why activity failed and identify root cause",
      "inputImpulses": ["execution_trace", "activity_template"],
      "outputImpulses": ["failure_analysis"],
      "config": {
        "model": "claude-sonnet-4",
        "temperature": 0.3,
        "max_tokens": 4000,
        "system_prompt": "Analyze this failed execution. Identify: (1) which task failed, (2) why it failed, (3) what needs adjustment."
      }
    },

    {
      "id": "query-similar-failures",
      "resolver": "mcp",
      "description": "Query backend for similar failure patterns",
      "dependencies": ["analyze-failure"],
      "inputImpulses": ["failure_analysis"],
      "outputImpulses": ["similar_failures"],
      "config": {
        "tool": "search_failures",
        "params": {
          "activity_id": "{{activity_id}}",
          "failure_pattern": "{{failure_type}}",
          "include_resolutions": true,
          "limit": 5
        }
      }
    },

    {
      "id": "determine-adjustment-strategy",
      "resolver": "llm",
      "description": "Decide tactical adjustment based on failure analysis and similar cases",
      "dependencies": ["query-similar-failures"],
      "inputImpulses": ["failure_analysis", "similar_failures", "activity_template"],
      "outputImpulses": ["adjustment_strategy"],
      "config": {
        "model": "claude-sonnet-4",
        "temperature": 0.5,
        "max_tokens": 3000,
        "system_prompt": "Based on failure analysis and similar cases, determine adjustment strategy. Options: (1) increase token budget, (2) add validation rules, (3) change resolver, (4) split task, (5) add checkpoint, (6) adjust prompt."
      }
    },

    {
      "id": "apply-adjustments",
      "resolver": "transform",
      "description": "Apply tactical adjustments to activity template",
      "dependencies": ["determine-adjustment-strategy"],
      "inputImpulses": ["activity_template", "adjustment_strategy"],
      "outputImpulses": ["adjusted_activity"],
      "config": {
        "operations": [
          {
            "type": "modify_task",
            "task_id": "{{failed_task_id}}",
            "adjustments": "{{adjustment_list}}"
          },
          {
            "type": "increment_version",
            "reason": "Tactical adjustment after failure"
          },
          {
            "type": "add_metadata",
            "key": "adjusted_from",
            "value": "{{original_activity_id}}"
          }
        ]
      }
    },

    {
      "id": "validate-adjustments",
      "resolver": "validation",
      "description": "Validate that adjusted activity is well-formed",
      "dependencies": ["apply-adjustments"],
      "inputImpulses": ["adjusted_activity"],
      "outputImpulses": ["validation_result"],
      "config": {
        "rules": [
          {
            "type": "schema_valid",
            "schema": "ActivityTemplate"
          },
          {
            "type": "no_circular_dependencies"
          },
          {
            "type": "all_variables_declared"
          }
        ]
      }
    },

    {
      "id": "register-variant",
      "resolver": "mcp",
      "description": "Register adjusted activity as new variant",
      "dependencies": ["validate-adjustments"],
      "condition": "validation_result.success === true",
      "inputImpulses": ["adjusted_activity"],
      "outputImpulses": ["registration_result"],
      "config": {
        "tool": "register_activity_variant",
        "params": {
          "activity": "{{adjusted_activity}}",
          "parent_activity_id": "{{original_activity_id}}",
          "initial_alpha": 2,
          "initial_beta": 1,
          "trailblazing": true
        }
      }
    }
  ]
}
```

**Key features:**
- ✅ Root cause analysis
- ✅ Learn from similar failures
- ✅ Tactical adjustments only (not full rewrite)
- ✅ Register as trailblazing variant
- ✅ Thompson Sampling will test effectiveness

---

## Execution Flow Management

### Task Dependencies (DAG)

Tasks form a **Directed Acyclic Graph**:

```json
{
  "tasks": [
    {
      "id": "task-1",
      "dependencies": []
    },
    {
      "id": "task-2",
      "dependencies": ["task-1"]
    },
    {
      "id": "task-3",
      "dependencies": ["task-1"]
    },
    {
      "id": "task-4",
      "dependencies": ["task-2", "task-3"]
    }
  ]
}
```

**Execution order:**
```
task-1 (no dependencies)
  ├─→ task-2 (depends on task-1)
  └─→ task-3 (depends on task-1, runs in parallel with task-2)
        ↓
      task-4 (depends on task-2 AND task-3)
```

---

### Conditional Execution

Tasks can have conditions based on previous task outputs:

```json
{
  "id": "rollback-if-failed",
  "resolver": "git",
  "condition": "validation_result.success === false",
  "inputImpulses": ["checkpoint"],
  "config": {
    "operation": "rollback",
    "rollback_to": "{{checkpoint.tag}}"
  }
}
```

**Condition expressions:**
- JavaScript-like syntax
- Access to previous task outputs via variable names
- Boolean result determines execution

---

### Impulse Flow

Impulses flow between tasks as references:

```
Task 1: analyze-intent
  inputImpulses: ["goal"]
  outputImpulses: ["intent_analysis"]
                      ↓
Task 2: search-similar-executions
  inputImpulses: ["intent_analysis"]
  outputImpulses: ["similar_traces"]
                      ↓
Task 3: improvise-with-llm
  inputImpulses: ["intent_analysis", "similar_traces"]
  outputImpulses: ["improvised_solution"]
```

**Key points:**
- Impulses are REFERENCES, not content
- Resolvers load content when needed
- Memory agent manages loading/unloading based on budgets
- Previous task's output impulses become available to dependent tasks

---

## Rollback Strategies

### Strategy 1: Checkpoint Before Risky Operations

```json
{
  "tasks": [
    {
      "id": "checkpoint-before-refactor",
      "resolver": "git",
      "config": {
        "operation": "checkpoint",
        "checkpoint_tag": "before-refactor-{{timestamp}}",
        "message": "Before refactoring {{component_name}}"
      }
    },
    {
      "id": "perform-refactor",
      "resolver": "llm",
      "dependencies": ["checkpoint-before-refactor"],
      "inputImpulses": ["source_code", "refactor_plan"],
      "outputImpulses": ["refactored_code"]
    },
    {
      "id": "validate-refactor",
      "resolver": "validation",
      "dependencies": ["perform-refactor"],
      "config": {
        "rules": [
          {"type": "command_success", "command": "npm test"},
          {"type": "command_success", "command": "npm run typecheck"}
        ]
      }
    },
    {
      "id": "rollback-if-broken",
      "resolver": "git",
      "dependencies": ["validate-refactor"],
      "condition": "validation.success === false",
      "config": {
        "operation": "rollback",
        "rollback_to": "{{checkpoint.tag}}"
      }
    }
  ]
}
```

**When to use**: Before any task that mutates state (refactoring, feature implementation, configuration changes)

---

### Strategy 2: Incremental Checkpoints (Per-Task)

```json
{
  "hooks": {
    "beforeEachTask": {
      "resolver": "git",
      "config": {
        "operation": "checkpoint",
        "checkpoint_tag": "before-{{task.id}}-{{timestamp}}"
      }
    },
    "afterEachTask": {
      "resolver": "validation",
      "config": {
        "rules": "{{task.validation}}"
      },
      "onFailure": {
        "resolver": "git",
        "config": {
          "operation": "rollback",
          "rollback_to": "{{beforeTask.checkpoint.tag}}"
        }
      }
    }
  }
}
```

**When to use**: Long-running activities where any task might fail and you want granular rollback

---

### Strategy 3: Multi-Level Checkpoints

```json
{
  "tasks": [
    {
      "id": "checkpoint-activity-start",
      "resolver": "git",
      "config": {
        "operation": "checkpoint",
        "checkpoint_tag": "activity-start-{{timestamp}}",
        "level": "activity"
      }
    },
    {
      "id": "checkpoint-phase-1-start",
      "resolver": "git",
      "dependencies": ["checkpoint-activity-start"],
      "config": {
        "operation": "checkpoint",
        "checkpoint_tag": "phase-1-start-{{timestamp}}",
        "level": "phase"
      }
    },
    {
      "id": "task-1-1",
      "resolver": "git",
      "dependencies": ["checkpoint-phase-1-start"],
      "config": {
        "operation": "checkpoint",
        "checkpoint_tag": "before-task-1-1-{{timestamp}}",
        "level": "task"
      }
    }
  ]
}
```

**Checkpoint hierarchy:**
```
activity-start (rollback entire activity)
  └─ phase-1-start (rollback phase 1)
      └─ before-task-1-1 (rollback single task)
```

**When to use**: Complex multi-phase activities where you might need coarse-grained or fine-grained rollback

---

## Examples

### Example 1: Cold-Start Bootstrap with Rollback

**Scenario**: User asks to "add rate limiting" but no matching template exists

**Execution:**

```typescript
// User's goal
const goal = {
  id: "goal-001",
  shape: "user_request",
  content: "Add rate limiting to the API endpoints",
  metadata: {
    keywords: ["rate limiting", "api", "throttle"],
    priority: "high"
  }
}

// Execute bootstrap activity
const result = await executeActivity({
  activity_id: "meta:cold-start-bootstrap",
  inputImpulses: [goal],
  reason: "No matching template for rate limiting goal"
})
```

**Task execution flow:**

1. **analyze-intent** (resolver: `llm`)
   - Input: `goal` impulse
   - Output: `intent_analysis` impulse
   - Content: "User wants: (1) rate limiting middleware, (2) Redis for distributed state, (3) configurable limits"

2. **checkpoint-before-improvisation** (resolver: `git`)
   - Input: none
   - Output: `checkpoint` impulse
   - Action: `git tag before-bootstrap-1709234567`

3. **search-similar-executions** (resolver: `mcp`)
   - Input: `intent_analysis` impulse
   - Output: `similar_traces` impulse
   - Found: 3 executions with keywords "rate limiting", 2 successful

4. **improvise-with-llm** (resolver: `llm`)
   - Input: `intent_analysis`, `similar_traces` impulses
   - Output: `improvised_solution` impulse
   - Plan: Install express-rate-limit, add middleware, configure Redis

5. **execute-improvisation** (resolver: `bash`)
   - Input: `improvised_solution` impulse
   - Output: `execution_output` impulse
   - Commands executed: npm install, file writes, config updates

6. **validate-outcome** (resolver: `validation`)
   - Input: `execution_output`, `intent_analysis` impulses
   - Output: `validation_result` impulse
   - Result: ✅ PASSED (rate limiting middleware added, tests pass)

7. **extract-template** (resolver: `llm`) - since validation passed
   - Input: `improvised_solution`, `execution_output`, `validation_result` impulses
   - Output: `activity_template` impulse
   - Generated: `add-rate-limiting-v1` template with explicit resolvers

8. **register-template** (resolver: `mcp`)
   - Input: `activity_template` impulse
   - Output: `registration_result` impulse
   - Result: Template registered with α=2, β=1

**If validation had failed at step 6:**

7. **rollback-if-failed** (resolver: `git`) - condition triggered
   - Input: `checkpoint` impulse
   - Output: `rollback_result` impulse
   - Action: `git reset --hard before-bootstrap-1709234567`
   - State restored to before improvisation

**Outcome**: New template `add-rate-limiting-v1` now available for future similar requests

---

### Example 2: Execute with Checkpoints (Granular Rollback)

**Scenario**: Execute refactoring activity with rollback after each task

**Activity**: `refactor-to-async-await`

**Task structure:**
```
1. analyze-callback-code
2. generate-async-version
3. run-tests (validate)
4. update-documentation
5. final-validation
```

**Execution with checkpoints:**

```typescript
const result = await executeActivity({
  activity_id: "meta:execute-with-checkpoints",
  inputImpulses: [
    { id: "activity", content: "refactor-to-async-await" },
    { id: "goal", content: "Convert callbacks to async/await" }
  ]
})
```

**Task execution flow:**

1. **load-activity-template** (resolver: `mcp`)
   - Output: `activity_template` with 5 tasks

2. **create-initial-checkpoint** (resolver: `git`)
   - Checkpoint: `activity-start-refactor-to-async-await-1709234567`

3. **execute-tasks-with-checkpoints** (resolver: `meta`)
   - Loops through 5 tasks, for each:

   **Task 1: analyze-callback-code**
   - Checkpoint: `before-task-analyze-callback-code-1709234567`
   - Execute: (llm resolver) → success
   - Validate: pattern found in output → pass

   **Task 2: generate-async-version**
   - Checkpoint: `before-task-generate-async-version-1709234568`
   - Execute: (llm resolver) → success
   - Validate: files written → pass

   **Task 3: run-tests**
   - Checkpoint: `before-task-run-tests-1709234569`
   - Execute: (bash resolver) `npm test` → FAILED (1 test failing)
   - Validate: command exit code 1 → FAIL
   - **ROLLBACK**: `git reset --hard before-task-run-tests-1709234569`
   - State restored: generated async version removed
   - Activity terminates with failure at task 3

4. **capture-execution-trace** (resolver: `mcp`)
   - Trace stored with:
     - Tasks completed: 2 (analyze, generate)
     - Task failed: 3 (run-tests)
     - Checkpoint used: `before-task-run-tests-1709234569`
     - Rollback performed: true
     - Final state: Clean (rolled back)

**Outcome**:
- State restored to before failed task
- Trace recorded for learning
- Can adjust task 2 (generate-async-version) and retry
- No partial broken state left in codebase

---

### Example 3: Adjust Activity from Failure

**Scenario**: Previous execution of `add-rate-limiting` failed at validation

**Failed trace:**
```json
{
  "execution_id": "exec-abc123",
  "activity_id": "add-rate-limiting-v1",
  "status": "failed",
  "failed_task": "validate-rate-limiting",
  "failure_reason": "Required pattern 'express-rate-limit' not found in package.json",
  "tasks_completed": 3,
  "tasks_failed": 1
}
```

**Execute adjustment activity:**

```typescript
const adjusted = await executeActivity({
  activity_id: "meta:adjust-activity-from-failure",
  inputImpulses: [
    { id: "trace", content: "exec-abc123" },
    { id: "activity", content: "add-rate-limiting-v1" }
  ],
  reason: "Adjust failing rate limiting activity"
})
```

**Task execution flow:**

1. **analyze-failure** (resolver: `llm`)
   - Input: execution trace, activity template
   - Output: failure analysis
   - Root cause: "Task 'install-dependencies' succeeded but package.json not updated. Validation expects package.json change but task uses bash resolver with npm install without --save flag."

2. **query-similar-failures** (resolver: `mcp`)
   - Input: failure analysis
   - Output: similar failures (2 found)
   - Pattern: "package.json not updated after npm install" appears in 2 other activities

3. **determine-adjustment-strategy** (resolver: `llm`)
   - Input: failure analysis, similar failures, activity template
   - Output: adjustment strategy
   - Strategy: "Modify task 'install-dependencies' config to add --save flag to npm install command. Add validation rule to check package.json changed."

4. **apply-adjustments** (resolver: `transform`)
   - Input: activity template, adjustment strategy
   - Output: adjusted activity
   - Changes:
     ```diff
     {
       "id": "install-dependencies",
       "resolver": "bash",
       "config": {
     -    "command": "npm install express-rate-limit"
     +    "command": "npm install --save express-rate-limit"
       },
     + "validation": {
     +   "rules": [
     +     {"type": "file_modified", "path": "package.json"}
     +   ]
     + }
     }
     ```

5. **validate-adjustments** (resolver: `validation`)
   - Input: adjusted activity
   - Output: validation result
   - Checks: schema valid ✅, no circular deps ✅, variables declared ✅

6. **register-variant** (resolver: `mcp`)
   - Input: adjusted activity
   - Output: registration result
   - Registered: `add-rate-limiting-v2` as trailblazing variant with α=2, β=1

**Outcome**:
- New variant `v2` registered
- Thompson Sampling will test both variants
- If v2 succeeds more, it gets selected more often
- Original failure pattern recorded to prevent repeating

---

## Key Principles

### 1. Explicit Resolvers

Every task MUST specify which resolver handles it:

✅ **Good:**
```json
{
  "id": "run-tests",
  "resolver": "bash",
  "config": {
    "command": "npm test"
  }
}
```

❌ **Bad:**
```json
{
  "id": "run-tests",
  "prompt": "Run npm test and tell me if it passes"
}
```

**Why**: Deterministic operations (file, bash, validation) are faster, cheaper, and more reliable than LLM.

---

### 2. LLM for Reasoning Only

Use LLM only when reasoning about ambiguous input is needed:

✅ **Good - LLM for reasoning:**
```json
{
  "id": "analyze-error",
  "resolver": "llm",
  "config": {
    "model": "claude-sonnet-4",
    "system_prompt": "Analyze this error log and identify root cause"
  }
}
```

✅ **Good - bash for execution:**
```json
{
  "id": "run-fix",
  "resolver": "bash",
  "dependencies": ["analyze-error"],
  "config": {
    "command": "{{fix_command_from_analysis}}"
  }
}
```

❌ **Bad - LLM for everything:**
```json
{
  "id": "fix-bug",
  "resolver": "llm",
  "config": {
    "system_prompt": "Analyze error, generate fix, apply it, run tests, and commit"
  }
}
```

**Why**: Each resolver does what it's best at. LLM reasons, git manages state, bash executes, validation checks deterministically.

---

### 3. Impulses as References

Impulses flow as references, not embedded content:

✅ **Good:**
```json
{
  "id": "generate-fix",
  "resolver": "llm",
  "inputImpulses": ["error_log", "source_code"],
  "config": {
    "system_prompt": "Generate fix using error log and source code impulses"
  }
}
```

❌ **Bad:**
```json
{
  "id": "generate-fix",
  "resolver": "llm",
  "config": {
    "prompt": "Here is the error log:\n{{entire_error_log}}\n\nHere is the source code:\n{{entire_source_code}}\n\nGenerate fix"
  }
}
```

**Why**:
- Memory agent manages loading based on budgets
- Resolvers load content when needed
- Metadata allows reasoning without loading everything
- Avoids token waste

---

### 4. Checkpoint Before Risk

Always checkpoint before operations that mutate state:

✅ **Good:**
```json
{
  "tasks": [
    {
      "id": "checkpoint",
      "resolver": "git",
      "config": {"operation": "checkpoint"}
    },
    {
      "id": "risky-operation",
      "dependencies": ["checkpoint"]
    },
    {
      "id": "rollback-if-failed",
      "dependencies": ["risky-operation"],
      "condition": "validation.success === false",
      "resolver": "git",
      "config": {"operation": "rollback"}
    }
  ]
}
```

❌ **Bad:**
```json
{
  "tasks": [
    {
      "id": "risky-operation"
    }
  ]
}
```

**Why**: Enables rollback on failure, prevents leaving broken state

---

### 5. Validation is Deterministic

Use validation resolver for checks, not LLM:

✅ **Good:**
```json
{
  "id": "validate-output",
  "resolver": "validation",
  "config": {
    "rules": [
      {"type": "file_exists", "path": "output.json"},
      {"type": "pattern_match", "file": "output.json", "pattern": "\"success\": true"},
      {"type": "command_success", "command": "npm test"}
    ]
  }
}
```

❌ **Bad:**
```json
{
  "id": "validate-output",
  "resolver": "llm",
  "config": {
    "system_prompt": "Check if output.json exists and contains success: true. Also run npm test and check if it passes."
  }
}
```

**Why**: Validation is deterministic, fast, free, and reliable

---

### 6. Record Everything

Every bootstrap/improvisation execution MUST be recorded:

✅ **Good:**
```json
{
  "tasks": [
    /* improvisation tasks */
    {
      "id": "record-trace",
      "resolver": "mcp",
      "config": {
        "tool": "store_execution_trace",
        "params": {"include_full_state": true}
      }
    }
  ]
}
```

**Why**: Learning requires traces. No trace = no learning from this execution

---

### 7. Extract Success

Successful improvisation should become reusable templates:

✅ **Good:**
```json
{
  "tasks": [
    /* bootstrap tasks */
    {
      "id": "extract-template",
      "resolver": "llm",
      "condition": "bootstrap.success === true"
    },
    {
      "id": "register-template",
      "resolver": "mcp",
      "dependencies": ["extract-template"]
    }
  ]
}
```

**Why**: System grows its capabilities by extracting patterns from successful improvisations

---

## Conclusion

Bootstrap templates implement the **impulse-resolver architecture** for cold-start scenarios:

- **Explicit resolvers** for each task (llm, git, bash, file, validation, mcp)
- **Impulses as references** with metadata-first reasoning
- **Checkpoints and rollback** using git resolver for state management
- **LLM minimal** - only for reasoning, not execution
- **Deterministic validation** using validation resolver
- **Recording and extraction** for learning from improvisation

This enables MiniBob to handle unknown scenarios while maintaining:
- **Safety**: Checkpoint before risk, rollback on failure
- **Learning**: Every execution recorded and analyzed
- **Growth**: Successful patterns extracted as templates
- **Efficiency**: Right resolver for each task, impulses as references

The system progressively converts improvisation into programmatic components, reducing the need for LLM over time as it learns patterns.
