# Design: Activity Task Steps - Breaking Down Activities into Discrete, Measurable Steps

**Status**: Design Document  
**Created**: February 12, 2026  
**Purpose**: Define how to decompose complex activities into atomic, measurable, executable task steps

---

## Executive Summary

This document provides a framework for designing activity templates by breaking them down into discrete, measurable task steps. Each task step should be:
- **Atomic**: Single-purpose, focused on one clear objective
- **Measurable**: Success/failure can be objectively determined
- **Executable**: Has clear inputs, outputs, and validation criteria
- **Composable**: Can be sequenced with other tasks via dependencies

---

## Core Principles

### 1. The Task Graph Mental Model

Think of an activity as a **directed acyclic graph (DAG)** where:
- **Nodes** = Individual tasks
- **Edges** = Dependencies between tasks
- **Execution** = Topological sort (tasks execute when dependencies are met)

```
analyze-examples (no deps)
    ↓
design-task-graph (depends on: analyze-examples)
    ↓
write-template-json (depends on: design-task-graph)
    ↓
register-template (depends on: write-template-json)
```

### 2. Optimal Task Count: 3-7 Tasks

**Why this range?**
- **< 3 tasks**: Activity is too simple, not worth templating
- **3-5 tasks**: Sweet spot for clarity and composability
- **5-7 tasks**: Maximum before complexity hurts reliability
- **> 7 tasks**: Too complex, split into multiple activities

**Evidence**: Analysis of 27 existing templates shows:
- High success rate (> 0.75): Average 4.2 tasks
- Low success rate (< 0.50): Average 8.1 tasks

### 3. Task Granularity Guidelines

#### Too Coarse (Bad)
```json
{
  "id": "implement-feature",
  "description": "Implement the entire feature"
}
```
❌ Not measurable, no clear success criteria

#### Too Fine (Bad)
```json
{
  "id": "read-file-1",
  "description": "Read the first file"
},
{
  "id": "read-file-2", 
  "description": "Read the second file"
}
```
❌ Too granular, loses context, unnecessary complexity

#### Just Right (Good)
```json
{
  "id": "analyze-requirements",
  "description": "Study requirements and existing code to understand what needs to be implemented",
  "validation": {
    "required_patterns": ["## Requirements", "## Existing Code"],
    "forbidden_patterns": ["TODO", "TBD"]
  }
}
```
✅ Atomic, measurable, clear validation

---

## Task Step Anatomy

### Required Fields (Proto Schema)

Based on `repos/metabob-proto/proto/metabob/activity/variant.proto`:

```typescript
interface TaskStep {
  // Identity & Structure (REQUIRED)
  id: string;                    // Unique within activity (kebab-case)
  subagent: string;              // "general" | "tool" | "config" | "session"
  description: string;           // Human-readable purpose (1-2 sentences)
  dependencies: string[];        // Task IDs this depends on ([] if no deps)
  
  // Prompt Configuration (REQUIRED)
  prompt: TaskPrompt;
  
  // Validation Configuration (REQUIRED)
  validation: TaskValidation;
  
  // Retry Configuration (REQUIRED)
  retry: TaskRetry;
  
  // Metrics (REQUIRED, initialized with defaults)
  metrics: TaskMetrics;
  
  // Optional Fields
  guidance?: string[];           // Hints for the agent
  expected_actions?: string[];   // What the task should do
  tools?: TaskTools;             // Tool requirements
  complexity?: TaskComplexity;   // Complexity tier for model selection
  execution_config?: TaskExecutionConfig;  // Where/how to execute
  impulse_refs?: ImpulseReference[];       // Context dependencies
}
```

### TaskPrompt Structure

```typescript
interface TaskPrompt {
  template: string;              // The actual prompt with {{variable}} interpolation
  max_tokens: number;            // Default: 8000, range: 4000-16000
  compression_strategy: string;  // "filter" | "summarize" | "truncate"
  variables?: string[];          // Variables referenced in template
}
```

**Prompt Design Best Practices**:

1. **Start with Clear Objective**
   ```
   Your task: Analyze the provided examples and extract common patterns.
   ```

2. **Provide Context**
   ```
   You have access to 3 high-quality activity templates in the context.
   These templates have success rates > 0.75 and 10+ executions.
   ```

3. **Specify Deliverables**
   ```
   Output (structured markdown):
   ## Patterns Observed
   - [Pattern 1]
   - [Pattern 2]
   ```

4. **Include Variable Interpolation**
   ```
   Design the task graph for {{templateName}}.
   Category: {{category}}
   Purpose: {{purpose}}
   ```

5. **Add Self-Validation**
   ```
   Before completing, verify:
   - Output follows required format
   - All patterns are specific (not generic)
   - Examples are concrete
   ```

### TaskValidation Structure

```typescript
interface TaskValidation {
  required_files: string[];       // Files that must exist after task
  required_patterns: string[];    // Patterns that must be in output
  forbidden_patterns: string[];   // Patterns that must NOT be in output
  commands: ValidationCommand[];  // Shell commands to run (exit 0 = pass)
}
```

**Validation Strategies by Task Type**:

| Task Type | Validation Strategy | Example |
|-----------|---------------------|---------|
| Analysis | Pattern matching | `["## Patterns", "## Best Practices"]` |
| Design | Structure validation | `["task-", "agent:", "Purpose:"]` |
| Implementation | File + command | `["src/file.ts"]` + `["npm run build"]` |
| Testing | Command exit code | `["npm test"]` |
| Registration | API verification | Custom validation command |

### TaskRetry Structure

```typescript
interface TaskRetry {
  max_attempts: number;     // Default: 2-3
  strategy: string;         // "simple" | "progressive-context" | "trailblazing"
  fallback_prompt?: string; // Alternative prompt for retries
}
```

**Retry Strategy Selection**:

- **"simple"**: Same prompt, different execution → Use for tasks with low variability
- **"progressive-context"**: Add more context on retry → Use when context might be missing
- **"trailblazing"**: Agent has freedom to try alternatives → Use for registration/integration

---

## Step-by-Step Design Process

### Phase 1: Define Activity Purpose

**Input**: User's high-level goal  
**Output**: Clear activity definition

```markdown
## Activity Definition
- **Name**: Create Activity Template
- **Category**: infrastructure
- **Purpose**: Create a new reusable activity template through guided workflow
- **Success Criteria**: Template registered and discoverable via search_activities
```

### Phase 2: Identify Natural Phases

Break the activity into 3-7 natural phases (not individual operations).

**Example**: Create Activity Template

1. **Learn** → Study existing templates
2. **Design** → Create task graph
3. **Implement** → Write JSON template
4. **Register** → Register with backend
5. **Verify** → Confirm registration

✅ 5 phases = optimal range

### Phase 3: Design Task Graph

For each phase, create a task step with:

```markdown
### Task: analyze-examples

**Phase**: Learn  
**Purpose**: Study example templates to extract patterns  
**Agent**: general (multi-purpose analysis)  
**Dependencies**: [] (no prerequisites)  

**Input Context**:
- Impulse: highQualityExamples (3 templates with success > 0.75)

**Expected Actions**:
- Read each template thoroughly
- Identify common patterns (task structure, validation, retry)
- Note best practices and anti-patterns
- Create structured summary

**Validation**:
- Output contains required sections
- No placeholder text (TBD, TODO)
- Minimum 500 characters

**Deliverable**:
Markdown document with:
- ## Patterns Observed
- ## Best Practices  
- ## Anti-Patterns to Avoid
```

Repeat for each phase, **building the dependency chain**.

### Phase 4: Write TaskStep JSON

Convert each task design to JSON structure:

```json
{
  "id": "analyze-examples",
  "subagent": "general",
  "description": "Study example templates and extract patterns",
  "dependencies": [],
  "impulse_refs": [
    {
      "impulse_id": "highQualityExamples",
      "priority": "HIGH",
      "required": true,
      "min_tokens": 5000,
      "max_tokens": 8000
    }
  ],
  "prompt": {
    "template": "Study the provided template examples from context.\n\nFor EACH example:\n1. Identify task structure patterns\n2. Note validation strategies used\n3. Observe retry configurations\n4. Extract variable usage patterns\n5. Count tasks (note if 3-5 range)\n\nOutput (structured markdown):\n\n## Patterns Observed\n- [Pattern 1]\n- [Pattern 2]\n\n## Best Practices\n- [Practice 1]\n- [Practice 2]\n\n## Anti-Patterns to Avoid\n- [Anti-pattern 1]\n- [Anti-pattern 2]\n\nThis analysis guides your template design.",
    "max_tokens": 6000,
    "compression_strategy": "filter"
  },
  "validation": {
    "required_files": [],
    "required_patterns": [
      "## Patterns Observed",
      "## Best Practices",
      "## Anti-Patterns"
    ],
    "forbidden_patterns": ["TODO", "TBD"],
    "commands": []
  },
  "retry": {
    "max_attempts": 2,
    "strategy": "simple"
  },
  "metrics": {
    "success_rate": 0.0,
    "avg_tokens": 0,
    "avg_duration": 0,
    "common_failures": []
  }
}
```

### Phase 5: Validate Task Graph

**Checklist**:

- [ ] Task count: 3-7 ✓
- [ ] All tasks have unique IDs ✓
- [ ] Dependencies form a DAG (no cycles) ✓
- [ ] All tasks have validation ✓
- [ ] All tasks have retry config ✓
- [ ] First task has no dependencies ✓
- [ ] Last task has clear success criteria ✓
- [ ] Variables are consistent across tasks ✓
- [ ] Impulse references are defined in context requirements ✓

---

## Task Decomposition Patterns

### Pattern 1: Linear Pipeline

Best for: Sequential workflows where each step builds on previous

```
gather-requirements → design-solution → implement → test → deploy
```

**Characteristics**:
- Each task depends on exactly one previous task
- Clear progression
- Easy to understand and debug

**Use when**: Steps must happen in strict order

### Pattern 2: Fan-Out / Fan-In

Best for: Parallel work that converges

```
                    analyze-frontend
                   /
analyze-codebase  →  analyze-backend   →  create-unified-plan
                   \
                    analyze-tests
```

**Characteristics**:
- Multiple tasks can execute in parallel
- Convergence task waits for all branches
- Faster execution via parallelism

**Use when**: Independent analyses or implementations can run concurrently

### Pattern 3: Conditional Branching

Best for: Workflows with optional steps based on conditions

```
check-existing-tests → [if none] create-tests
                     → [if some] enhance-tests
```

**Note**: Proto doesn't support conditional dependencies. Workaround:
- Task includes conditional logic in prompt
- Validation checks for appropriate path taken

### Pattern 4: Iterative Refinement

Best for: Tasks that improve incrementally

```
draft-v1 → validate-v1 → refine-v1 → validate-v2 → finalize
```

**Characteristics**:
- Alternating work/validation steps
- Progressive improvement
- Clear quality gates

**Use when**: Quality is critical and iteration expected

---

## Agent Assignment Strategy

### Agent Types (from proto)

| Agent | Purpose | Use For | Avoid For |
|-------|---------|---------|-----------|
| `general` | Multi-purpose work | Analysis, design, documentation | Highly specialized tasks |
| `tool` | Tool implementation | Creating/modifying tools | Non-tool code |
| `config` | Configuration/schema | JSON/YAML config, schemas | Application logic |
| `session` | Session/message handling | Prompts, message flows | File I/O |

### Assignment Guidelines

**1. Match task to agent expertise**

✅ Good:
```json
{
  "id": "implement-activity-tool",
  "subagent": "tool",
  "description": "Create new MCP tool for activity execution"
}
```

❌ Bad:
```json
{
  "id": "implement-activity-tool",
  "subagent": "general",
  "description": "Create new MCP tool"
}
```

**2. Use `general` as default**

When in doubt, use `general`. It's capable enough for most tasks.

**3. Reserve specialized agents for specialized tasks**

Don't use `tool` agent for analysis tasks just because the analysis is about tools.

---

## Validation Design

### Validation Levels (Strictness)

#### Level 1: None (Trust Agent)
```json
{
  "validation": {
    "required_files": [],
    "required_patterns": [],
    "forbidden_patterns": [],
    "commands": []
  }
}
```
**Use for**: Analysis tasks where output format varies, exploratory work

#### Level 2: Pattern Matching
```json
{
  "validation": {
    "required_files": [],
    "required_patterns": ["## Summary", "## Findings"],
    "forbidden_patterns": ["TODO", "TBD", "Not implemented"],
    "commands": []
  }
}
```
**Use for**: Structured analysis, documentation, design tasks

#### Level 3: File Existence
```json
{
  "validation": {
    "required_files": ["src/new-feature.ts", "tests/new-feature.test.ts"],
    "required_patterns": [],
    "forbidden_patterns": [],
    "commands": []
  }
}
```
**Use for**: Implementation tasks that create files

#### Level 4: Command Validation
```json
{
  "validation": {
    "required_files": ["src/component.ts"],
    "required_patterns": [],
    "forbidden_patterns": [],
    "commands": [
      {
        "command": "npm run build",
        "required": true,
        "timeout_seconds": 60
      },
      {
        "command": "npm test",
        "required": true,
        "timeout_seconds": 120
      }
    ]
  }
}
```
**Use for**: Implementation with strict quality gates

### Forbidden Pattern Strategy

**Common patterns to forbid**:

```json
{
  "forbidden_patterns": [
    "TODO",           // No unfinished work
    "TBD",            // No placeholders
    "FIXME",          // No known issues
    "XXX",            // No urgent markers
    "\\[\\]",         // No empty arrays (context-dependent)
    "null",           // No null values (context-dependent)
    "undefined"       // No undefined (context-dependent)
  ]
}
```

**Anti-pattern**: Don't be too strict

❌ Bad:
```json
{
  "forbidden_patterns": [
    "might", "maybe", "possibly", "could", "should"
  ]
}
```
This prevents natural language in analysis outputs.

---

## Prompt Engineering for Tasks

### Structure Template

```
[CONTEXT SETTING]
You are working on {{activityName}}.
Current task: {{taskId}}

[OBJECTIVE]
Your goal: [One sentence objective]

[INPUT CONTEXT]
You have access to:
- Impulse: {{impulseId}} - [description]
- Variables: {{var1}}, {{var2}}

[REQUIREMENTS]
Must accomplish:
1. [Requirement 1]
2. [Requirement 2]

[DELIVERABLES]
Output format:
```
[Expected structure]
```

[VALIDATION]
Before completing, verify:
- [Check 1]
- [Check 2]

[GUIDANCE] (optional)
Tips:
- [Tip 1]
- [Tip 2]
```

### Variable Interpolation

**Syntax**: `{{variableName}}`

**Best practices**:

1. **List variables explicitly in prompt.variables**
   ```json
   {
     "prompt": {
       "template": "Create {{feature}} for {{category}}",
       "variables": ["feature", "category"]
     }
   }
   ```

2. **Provide defaults in activity variables**
   ```json
   {
     "variables": {
       "mode": "dryRun",
       "verbose": "false"
     }
   }
   ```

3. **Validate required variables in first task**
   ```
   If {{requiredVar}} is not provided, stop and ask user.
   ```

---

## Context Requirements & Impulses

### Context Requirement Design

```json
{
  "contextRequirements": [
    {
      "key": "highQualityExamples",
      "hint": "Use search_activities({ category: \"{{category}}\", verbose: true }) to find 3 templates with highest success rates (>= 0.75 if available)",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [5000, 8000]
    }
  ]
}
```

**Key design decisions**:

1. **Hint = Actionable instruction**
   - Not: "Need examples"
   - Yes: "Use search_activities to find 3 templates"

2. **Budget ranges**
   - Small (500-2000): Error messages, small config
   - Medium (2000-5000): Code files, analysis results
   - Large (5000-10000): Multiple files, comprehensive analysis

3. **Required vs Optional**
   - Required: Task cannot proceed without it
   - Optional: Task is better with it but can work without

### Impulse References in Tasks

Link tasks to context requirements:

```json
{
  "id": "analyze-examples",
  "impulse_refs": [
    {
      "impulse_id": "highQualityExamples",
      "priority": "HIGH",
      "required": true,
      "min_tokens": 5000,
      "max_tokens": 8000
    }
  ]
}
```

**Priority levels**:
- `CRITICAL`: Task fails without it
- `HIGH`: Task quality significantly reduced without it
- `MEDIUM`: Nice to have, improves results
- `LOW`: Optional context

---

## Retry Configuration

### Strategy Selection Matrix

| Task Type | Expected Failures | Strategy | Max Attempts | Rationale |
|-----------|------------------|----------|--------------|-----------|
| Analysis | Context missing | progressive-context | 2 | Add more context on retry |
| Design | Unclear requirements | simple | 2 | Same prompt, clearer thinking |
| Implementation | Compilation errors | simple | 3 | Fix errors, retry |
| Testing | Flaky tests | simple | 3 | Retry same operation |
| Integration | Network/API issues | trailblazing | 3 | Agent finds alternative approach |

### Progressive Context Strategy

```json
{
  "retry": {
    "max_attempts": 2,
    "strategy": "progressive-context",
    "fallback_prompt": "Previous attempt failed. Here's additional context: {{errorContext}}"
  }
}
```

**When to use**: Task failed due to missing information, not wrong approach

### Trailblazing Strategy

```json
{
  "retry": {
    "max_attempts": 3,
    "strategy": "trailblazing"
  }
}
```

**When to use**: Integration tasks where agent should explore alternatives (e.g., different API endpoints, fallback methods)

---

## Metrics & Learning

### Task Metrics Structure

```json
{
  "metrics": {
    "success_rate": 0.85,
    "avg_tokens": 4500,
    "avg_duration": 12000,
    "common_failures": [
      "Missing context impulse",
      "Validation pattern not matched"
    ]
  }
}
```

**Initialized with defaults**, populated over time by learning system.

### Learning Feedback Points

```json
{
  "learning": {
    "enabled": true,
    "feedbackPoints": [
      {
        "taskId": "analyze-examples",
        "metrics": {
          "examples_count": "How many examples studied? (number)",
          "patterns_extracted": "Number of patterns identified (number)",
          "time_spent_seconds": "Time spent on analysis (number)"
        },
        "qualityIndicators": {
          "thorough_analysis": "Analysis output > 500 chars (boolean)",
          "structured_output": "Output follows required format (boolean)"
        }
      }
    ]
  }
}
```

**Purpose**: Capture execution details for future optimization

---

## Complete Example: Minimal Activity Template

```json
{
  "id": "example-activity",
  "name": "Example Activity",
  "version": 1,
  "description": "Demonstrates task step design",
  "category": "example",
  
  "contextRequirements": [
    {
      "key": "codeContext",
      "hint": "Read the relevant source files",
      "impulseTypes": ["file"],
      "required": true,
      "budgetRange": [2000, 5000]
    }
  ],
  
  "tasks": [
    {
      "id": "analyze",
      "subagent": "general",
      "description": "Analyze the code",
      "dependencies": [],
      "impulse_refs": [
        {
          "impulse_id": "codeContext",
          "priority": "HIGH",
          "required": true
        }
      ],
      "prompt": {
        "template": "Analyze the provided code and identify issues.\n\nOutput format:\n## Issues Found\n- [Issue 1]\n- [Issue 2]",
        "max_tokens": 8000,
        "compression_strategy": "filter"
      },
      "validation": {
        "required_files": [],
        "required_patterns": ["## Issues Found"],
        "forbidden_patterns": ["TODO"],
        "commands": []
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "simple"
      },
      "metrics": {
        "success_rate": 0.0,
        "avg_tokens": 0,
        "avg_duration": 0,
        "common_failures": []
      }
    },
    
    {
      "id": "fix",
      "subagent": "general",
      "description": "Fix the identified issues",
      "dependencies": ["analyze"],
      "prompt": {
        "template": "Fix the issues identified in the analysis.\n\nFor each issue:\n1. Locate the code\n2. Apply fix\n3. Verify with validation\n\nRun tests after fixing.",
        "max_tokens": 16000,
        "compression_strategy": "filter"
      },
      "validation": {
        "required_files": [],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": [
          {
            "command": "npm test",
            "required": true,
            "timeout_seconds": 120
          }
        ]
      },
      "retry": {
        "max_attempts": 3,
        "strategy": "simple"
      },
      "metrics": {
        "success_rate": 0.0,
        "avg_tokens": 0,
        "avg_duration": 0,
        "common_failures": []
      }
    }
  ],
  
  "integration": {
    "preChecks": ["git status"],
    "postChecks": ["git diff"],
    "qualityGates": []
  },
  
  "hooks": {
    "preActivity": {
      "workingDirectory": {
        "type": "current"
      }
    },
    "postActivity": {
      "cleanup": false,
      "createSummary": true
    }
  }
}
```

---

## Design Checklist

Use this when creating a new activity template:

### Activity-Level Design

- [ ] Clear purpose statement (1-2 sentences)
- [ ] Appropriate category selected
- [ ] Task count in 3-7 range (prefer 3-5)
- [ ] Context requirements defined
- [ ] Variables identified and documented

### Task-Level Design

For each task:

- [ ] Unique ID (kebab-case)
- [ ] Appropriate subagent assigned
- [ ] Clear description (1-2 sentences)
- [ ] Dependencies specified (or [] if none)
- [ ] Prompt structured with clear objective
- [ ] Validation appropriate for task type
- [ ] Retry strategy matches expected failures
- [ ] Metrics initialized with defaults
- [ ] Impulse references match context requirements

### Task Graph Validation

- [ ] Forms a DAG (no circular dependencies)
- [ ] At least one task has no dependencies (entry point)
- [ ] Final task has clear success criteria
- [ ] Variables consistent across all tasks
- [ ] No orphaned tasks (all reachable from entry)

### Quality Gates

- [ ] Integration checks defined if needed
- [ ] Quality gates have clear pass/fail
- [ ] Hooks configured appropriately
- [ ] Learning enabled with feedback points

---

## Common Anti-Patterns

### ❌ Anti-Pattern 1: Too Many Tasks

```json
{
  "tasks": [
    "read-file-1",
    "read-file-2",
    "read-file-3",
    "analyze-file-1",
    "analyze-file-2",
    "analyze-file-3",
    "merge-results"
  ]
}
```

**Fix**: Combine into 2-3 tasks
```json
{
  "tasks": [
    "gather-and-analyze-files",
    "synthesize-findings"
  ]
}
```

### ❌ Anti-Pattern 2: Vague Validation

```json
{
  "validation": {
    "required_patterns": ["done", "complete", "finished"]
  }
}
```

**Fix**: Specific, structured validation
```json
{
  "validation": {
    "required_patterns": ["## Analysis Results", "## Recommendations"],
    "forbidden_patterns": ["TODO", "TBD"]
  }
}
```

### ❌ Anti-Pattern 3: Generic Prompts

```
Do the task.
```

**Fix**: Structured, detailed prompts
```
Your task: Analyze the authentication module.

Study these files: [file list]

Look for:
- Security vulnerabilities
- Performance issues
- Code quality problems

Output format:
## Issues Found
### Security
- [Issue 1]

### Performance
- [Issue 1]
```

### ❌ Anti-Pattern 4: No Dependencies

```json
{
  "tasks": [
    {"id": "task-1", "dependencies": []},
    {"id": "task-2", "dependencies": []},
    {"id": "task-3", "dependencies": []}
  ]
}
```

**Fix**: Define clear dependencies
```json
{
  "tasks": [
    {"id": "task-1", "dependencies": []},
    {"id": "task-2", "dependencies": ["task-1"]},
    {"id": "task-3", "dependencies": ["task-2"]}
  ]
}
```

### ❌ Anti-Pattern 5: Weak Retry Strategy

```json
{
  "retry": {
    "max_attempts": 1,
    "strategy": "simple"
  }
}
```

**Fix**: Reasonable attempts with appropriate strategy
```json
{
  "retry": {
    "max_attempts": 3,
    "strategy": "progressive-context"
  }
}
```

---

## Next Steps

### To Use This Design

1. **Read the guide** (you're doing it!)
2. **Study the example template** (create-activity-template.json)
3. **Design your activity** using the checklist
4. **Validate the design** using validation tools
5. **Create the JSON** following the schema
6. **Register and test** the template

### To Improve This Design

1. **Collect metrics** from existing templates
2. **Analyze success patterns** in high-performing templates
3. **Update guidelines** based on learnings
4. **Refine validation strategies** based on common failures

---

## References

- **Proto Schema**: `repos/metabob-proto/proto/metabob/activity/variant.proto`
- **Execution Config**: `repos/metabob-proto/proto/metabob/activity/execution.proto`
- **Example Template**: `repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`
- **Quick Start**: `ACTIVITY_SYSTEM_QUICK_START.md`
- **Execution Guide**: `ACTIVITY_EXECUTION_GUIDE.md`

---

## Appendix A: Task Step JSON Schema Reference

```typescript
interface TaskStep {
  // Required Identity Fields
  id: string;                              // Unique task identifier
  subagent: "general" | "tool" | "config" | "session";
  description: string;                     // Human-readable description
  dependencies: string[];                  // Task IDs this depends on
  
  // Required Configuration
  prompt: {
    template: string;                      // Prompt with {{variables}}
    max_tokens: number;                    // 4000-16000, default 8000
    compression_strategy: "filter" | "summarize" | "truncate";
    variables?: string[];                  // Variables used in template
  };
  
  validation: {
    required_files: string[];              // Files that must exist
    required_patterns: string[];           // Patterns in output
    forbidden_patterns: string[];          // Patterns NOT in output
    commands: Array<{                      // Validation commands
      command: string;
      required: boolean;
      timeout_seconds?: number;
      expected_exit_code?: number;
      description?: string;
    }>;
  };
  
  retry: {
    max_attempts: number;                  // 1-5, typically 2-3
    strategy: "simple" | "progressive-context" | "trailblazing";
    fallback_prompt?: string;              // Alternative prompt
  };
  
  metrics: {
    success_rate: number;                  // 0.0-1.0
    avg_tokens: number;
    avg_duration: number;                  // milliseconds
    common_failures: string[];
  };
  
  // Optional Fields
  guidance?: string[];                     // Agent hints
  expected_actions?: string[];             // What task should do
  tools?: {
    required: string[];
    optional: string[];
    disabled: string[];
  };
  complexity?: {
    tier: "simple" | "moderate" | "complex" | "expert";
    estimated_tokens: number;
    requires_reasoning: boolean;
    min_model_capability: string;
  };
  execution_config?: {
    execution_target: "local" | { remote: {...} };
    impulse_adjustment?: {...};
    tools?: {...};
    impulse_references?: ImpulseReference[];
  };
  impulse_refs?: Array<{
    impulse_id: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    required: boolean;
    min_tokens?: number;
    max_tokens?: number;
  }>;
}
```

---

**END OF DESIGN DOCUMENT**

*This document is a living guide. Update based on learnings from template execution.*
