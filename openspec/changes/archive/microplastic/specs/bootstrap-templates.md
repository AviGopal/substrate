# Bootstrap Templates Specification

## Overview

Bootstrap templates are the foundational activities that microplastic ships with. They form a hierarchy where lower levels enable higher levels, and Level 0 templates are immutable to prevent self-destruction.

## Template Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      TEMPLATE HIERARCHY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 0: PRIMORDIAL (Immutable)                                │
│  ├── create-activity-template    (creates templates)            │
│  ├── execute-goal                (the meta-execution loop)      │
│  └── validate-template           (validates structure)          │
│                                                                  │
│  Level 1: META (Templates that make templates)                  │
│  ├── extract-from-trace          (ribosome extraction)          │
│  ├── create-variant              (variant from failure)         │
│  └── promote-template            (local → backend)              │
│                                                                  │
│  Level 2: SPEC GENERATION (Create specifications)               │
│  ├── generate-implementation-spec                               │
│  ├── generate-test-spec                                         │
│  └── generate-migration-spec                                    │
│                                                                  │
│  Level 3: CORE DEVELOPMENT (Common dev tasks)                   │
│  ├── implement-feature                                          │
│  ├── fix-bug                                                    │
│  ├── refactor-code                                              │
│  ├── add-tests                                                  │
│  └── update-documentation                                       │
│                                                                  │
│  Level 4: TUI CHOREOGRAPHY (Control narrative)                  │
│  ├── update-narrative                                           │
│  ├── request-clarification                                      │
│  └── present-options                                            │
│                                                                  │
│  Level 5+: LEARNED (Extracted from executions)                  │
│  └── ... (user-generated via ribosome)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Level 0: Primordial Templates

These templates are **immutable**. They cannot be modified, overridden, or deleted. They define the core behaviors that enable everything else.

### create-activity-template

**Purpose:** Creates new activity templates from specifications.

```json
{
  "id": "create-activity-template",
  "name": "Create Activity Template",
  "description": "Creates a new activity template from a specification. This is the fundamental template-creation mechanism.",
  "category": "infrastructure",
  "level": 0,
  "immutable": true,

  "inputSchema": {
    "required": [
      { "shape": "template_spec", "description": "Specification for the new template" }
    ]
  },

  "outputSchema": {
    "produces": [
      { "shape": "activity_template", "description": "The created template" }
    ]
  },

  "tasks": [
    {
      "id": "parse-spec",
      "description": "Parse the template specification",
      "prompt": {
        "template": "Parse the following template specification and extract: id, name, description, category, tasks, and variables.\n\nSpec:\n{{spec}}"
      }
    },
    {
      "id": "generate-structure",
      "description": "Generate the ActivityTemplate JSON structure",
      "prompt": {
        "template": "Generate a valid ActivityTemplate JSON structure from the parsed specification. Include proper task prompts and validation rules.\n\nParsed spec: {{parsed_spec}}"
      }
    },
    {
      "id": "validate-template",
      "description": "Validate the generated template",
      "prompt": {
        "template": "Validate that the generated template is well-formed:\n- All required fields present\n- Variable references are valid\n- Task dependencies are acyclic\n\nTemplate: {{generated_template}}"
      },
      "validation": {
        "requiredPatterns": ["\"id\":", "\"name\":", "\"tasks\":"]
      }
    },
    {
      "id": "register-template",
      "description": "Register the template in the local cache",
      "prompt": {
        "template": "Write the template to the local cache at .microplastic/templates/{{template_id}}.json"
      }
    }
  ]
}
```

### execute-goal

**Purpose:** The meta-activity that executes goals. This IS the goal processor logic as an activity.

```json
{
  "id": "execute-goal",
  "name": "Execute Goal",
  "description": "The meta-activity that processes user goals. Enriches the goal, searches for templates, executes or improvises, and records outcomes.",
  "category": "infrastructure",
  "level": 0,
  "immutable": true,

  "inputSchema": {
    "required": [
      { "shape": "goal", "description": "User's goal in natural language" }
    ],
    "optional": [
      { "shape": "context", "description": "Additional context for the goal" }
    ]
  },

  "outputSchema": {
    "produces": [
      { "shape": "execution_trace", "description": "Full trace of the execution" },
      { "shape": "goal_result", "description": "Whether goal was achieved" }
    ]
  },

  "tasks": [
    {
      "id": "enrich-goal",
      "description": "Understand and enrich the goal using LLM",
      "prompt": {
        "template": "Analyze this goal and extract:\n- Understanding: What the user wants\n- Clarified intent: Refined goal statement\n- Expected outcomes: Concrete results\n- Required capabilities: What tools/skills needed\n- Success criteria: How to verify completion\n- Category: feature/bugfix/refactor/exploration\n\nGoal: {{goal}}\nContext: {{context}}"
      }
    },
    {
      "id": "search-templates",
      "description": "Search for matching activity templates via Thompson Sampling",
      "prompt": {
        "template": "Query the template registry for activities matching:\n- Input shapes: {{input_shapes}}\n- Category: {{category}}\n- Required capabilities: {{capabilities}}\n\nReturn Thompson-sampled recommendations."
      }
    },
    {
      "id": "select-or-improvise",
      "description": "Select best template or decide to improvise",
      "prompt": {
        "template": "Given these template recommendations:\n{{recommendations}}\n\nIf best confidence > 0.3, select that template.\nIf no good match, prepare for improvisation.\n\nDecision: {{decision}}"
      }
    },
    {
      "id": "execute",
      "description": "Execute the selected template or improvise",
      "prompt": {
        "template": "Execute the selected approach:\n- If template: Run {{template_id}} with variables {{variables}}\n- If improvise: Use available tools to achieve {{goal}}\n\nRecord all steps in the execution trace."
      }
    },
    {
      "id": "verify-goal",
      "description": "Verify if the goal was achieved",
      "prompt": {
        "template": "Given the execution results:\n{{execution_results}}\n\nVerify against success criteria:\n{{success_criteria}}\n\nReturn: verified (boolean), reason, confidence (0.0-1.0)"
      }
    },
    {
      "id": "record-outcome",
      "description": "Record the outcome for learning",
      "prompt": {
        "template": "Record this execution:\n- Template: {{template_id}}\n- Success: {{verified}}\n- Trace: {{trace}}\n\nUpdate Thompson Sampling:\n- If success: alpha += 1\n- If failure: beta += 1"
      }
    }
  ]
}
```

### validate-template

**Purpose:** Validates that a template is well-formed before registration.

```json
{
  "id": "validate-template",
  "name": "Validate Template",
  "description": "Validates that an activity template is well-formed and can be safely executed.",
  "category": "infrastructure",
  "level": 0,
  "immutable": true,

  "inputSchema": {
    "required": [
      { "shape": "activity_template", "description": "Template to validate" }
    ]
  },

  "outputSchema": {
    "produces": [
      { "shape": "validation_result", "description": "Pass/fail with errors and warnings" }
    ]
  },

  "tasks": [
    {
      "id": "check-required-fields",
      "description": "Verify all required fields are present",
      "prompt": {
        "template": "Check that the template has:\n- id (string, non-empty)\n- name (string, non-empty)\n- description (string)\n- category (feature|bugfix|refactor|tool|infrastructure)\n- tasks (array, non-empty)\n\nTemplate: {{template}}"
      },
      "validation": {
        "requiredPatterns": ["\"id\":", "\"name\":", "\"tasks\":"]
      }
    },
    {
      "id": "validate-variable-references",
      "description": "Check that all variable references are defined",
      "prompt": {
        "template": "For each task prompt:\n1. Extract all {{variable}} references\n2. Verify each variable is defined in the task's variables array\n3. Flag undefined references as errors\n\nTemplate: {{template}}"
      }
    },
    {
      "id": "check-task-dependencies",
      "description": "Verify task dependency graph is acyclic",
      "prompt": {
        "template": "Build the task dependency graph from dependencies arrays.\nVerify no cycles exist.\nFlag cyclic dependencies as errors.\n\nTasks: {{tasks}}"
      }
    },
    {
      "id": "validate-validation-rules",
      "description": "Check that validation rules are well-formed",
      "prompt": {
        "template": "For each task with validation:\n- requiredFiles: paths must be valid patterns\n- requiredPatterns: patterns must be valid regex\n- commands: must have valid shell syntax\n\nTasks: {{tasks}}"
      }
    },
    {
      "id": "compile-result",
      "description": "Compile validation result",
      "prompt": {
        "template": "Compile the validation result:\n- valid: true if no errors\n- errors: list of blocking issues\n- warnings: list of non-blocking concerns\n\nChecks: {{check_results}}"
      }
    }
  ]
}
```

---

## Level 1: Meta Templates

Templates that create or modify other templates. These can be evolved but are critical infrastructure.

### extract-from-trace

**Purpose:** The ribosome - extracts activity templates from successful execution traces.

```json
{
  "id": "extract-from-trace",
  "name": "Extract Template from Trace",
  "description": "Ribosome function: Analyzes a successful execution trace and extracts a reusable activity template.",
  "category": "infrastructure",
  "level": 1,

  "inputSchema": {
    "required": [
      { "shape": "execution_trace", "description": "Successful execution trace" },
      { "shape": "goal_enrichment", "description": "Original goal context" }
    ]
  },

  "outputSchema": {
    "produces": [
      { "shape": "activity_template", "description": "Extracted template" }
    ]
  },

  "tasks": [
    {
      "id": "analyze-trace",
      "description": "Analyze the execution trace structure",
      "prompt": {
        "template": "Analyze this execution trace:\n{{trace}}\n\nIdentify:\n- Tool call sequence\n- Input data shapes\n- Output data shapes\n- Decision points\n- Variable patterns"
      }
    },
    {
      "id": "identify-variables",
      "description": "Identify parameterization points",
      "prompt": {
        "template": "From the trace analysis, identify what should be variables:\n- File paths that are specific to this execution\n- Names that could be generalized\n- Values that depend on context\n\nAnalysis: {{analysis}}"
      }
    },
    {
      "id": "generate-tasks",
      "description": "Generate task definitions",
      "prompt": {
        "template": "Generate ActivityTask definitions from the tool call sequence:\n{{tool_sequence}}\n\nEach task should:\n- Have a clear description\n- Include prompt template with variables\n- Include appropriate validation"
      }
    },
    {
      "id": "create-template",
      "description": "Assemble the complete template",
      "prompt": {
        "template": "Create a complete ActivityTemplate:\n- ID based on goal intent: {{goal_intent}}\n- Appropriate category: {{category}}\n- Input/output schemas from analysis\n- Tasks from generation step\n- Metadata tracking source execution"
      }
    },
    {
      "id": "validate-and-register",
      "description": "Validate and register the template",
      "prompt": {
        "template": "Run validate-template on the created template.\nIf valid, register with Thompson state alpha=1, beta=0.\nIf invalid, report errors for debugging."
      }
    }
  ]
}
```

### create-variant

**Purpose:** Creates a variant template from a failed execution.

```json
{
  "id": "create-variant",
  "name": "Create Template Variant",
  "description": "Creates a variant of an existing template based on failure analysis.",
  "category": "infrastructure",
  "level": 1,

  "inputSchema": {
    "required": [
      { "shape": "execution_trace", "description": "Failed execution trace" },
      { "shape": "activity_template", "description": "Original template that failed" },
      { "shape": "failure_analysis", "description": "Analysis of why it failed" }
    ]
  },

  "outputSchema": {
    "produces": [
      { "shape": "activity_template", "description": "New variant template" }
    ]
  },

  "tasks": [
    {
      "id": "analyze-failure",
      "description": "Deep analysis of the failure mode",
      "prompt": {
        "template": "Analyze why the template failed:\n\nOriginal template: {{original_template}}\nExecution trace: {{trace}}\nInitial analysis: {{failure_analysis}}\n\nIdentify the root cause and what needs to change."
      }
    },
    {
      "id": "design-variant",
      "description": "Design the variant that addresses the failure",
      "prompt": {
        "template": "Design a variant that addresses: {{root_cause}}\n\nOptions:\n1. Add/modify a task\n2. Change task order\n3. Add validation step\n4. Change prompt strategy\n5. Add conditional logic\n\nRecommended changes: {{changes}}"
      }
    },
    {
      "id": "generate-variant",
      "description": "Generate the variant template",
      "prompt": {
        "template": "Create variant template:\n- ID: {{original_id}}-variant-{{variant_number}}\n- Based on: {{original_template}}\n- With changes: {{changes}}\n- Track lineage in metadata"
      }
    }
  ]
}
```

---

## Level 2: Spec Generation Templates

Templates that create specifications for other work.

### generate-implementation-spec

```json
{
  "id": "generate-implementation-spec",
  "name": "Generate Implementation Spec",
  "description": "Creates a detailed implementation specification from a feature request.",
  "category": "tool",
  "level": 2,

  "inputSchema": {
    "required": [
      { "shape": "feature_request", "description": "Description of the feature to implement" },
      { "shape": "codebase_analysis", "description": "Understanding of current codebase" }
    ]
  },

  "outputSchema": {
    "produces": [
      { "shape": "implementation_spec", "description": "Detailed implementation plan" }
    ]
  },

  "tasks": [
    {
      "id": "understand-requirements",
      "description": "Understand the feature requirements",
      "prompt": {
        "template": "Analyze the feature request:\n{{feature_request}}\n\nExtract:\n- Core requirements\n- Edge cases\n- User stories\n- Acceptance criteria"
      }
    },
    {
      "id": "analyze-impact",
      "description": "Analyze impact on existing code",
      "prompt": {
        "template": "Given the codebase analysis:\n{{codebase_analysis}}\n\nIdentify:\n- Files that need modification\n- New files needed\n- Affected tests\n- Potential conflicts"
      }
    },
    {
      "id": "create-spec",
      "description": "Create the implementation specification",
      "prompt": {
        "template": "Create an implementation spec with:\n- Overview\n- Step-by-step implementation plan\n- File changes with diffs\n- Test cases\n- Validation criteria"
      }
    }
  ]
}
```

---

## Level 3: Core Development Templates

Common development tasks that most projects need.

### implement-feature

```json
{
  "id": "implement-feature",
  "name": "Implement Feature",
  "description": "Implements a feature based on a specification or goal.",
  "category": "feature",
  "level": 3,

  "inputSchema": {
    "required": [
      { "shape": "goal", "description": "Feature to implement" }
    ],
    "optional": [
      { "shape": "implementation_spec", "description": "Detailed spec if available" }
    ]
  },

  "tasks": [
    {
      "id": "understand-codebase",
      "description": "Understand the relevant parts of the codebase"
    },
    {
      "id": "plan-implementation",
      "description": "Create implementation plan"
    },
    {
      "id": "implement",
      "description": "Write the code"
    },
    {
      "id": "test",
      "description": "Run tests and fix issues"
    },
    {
      "id": "validate",
      "description": "Verify feature works as expected"
    }
  ]
}
```

### fix-bug

```json
{
  "id": "fix-bug",
  "name": "Fix Bug",
  "description": "Diagnoses and fixes a bug.",
  "category": "bugfix",
  "level": 3,

  "inputSchema": {
    "required": [
      { "shape": "bug_description", "description": "Description of the bug" }
    ],
    "optional": [
      { "shape": "error_log", "description": "Error logs or stack traces" },
      { "shape": "reproduction_steps", "description": "How to reproduce" }
    ]
  },

  "tasks": [
    {
      "id": "analyze-bug",
      "description": "Analyze the bug report and related code"
    },
    {
      "id": "locate-cause",
      "description": "Find the root cause"
    },
    {
      "id": "implement-fix",
      "description": "Implement the fix"
    },
    {
      "id": "verify-fix",
      "description": "Verify the bug is fixed"
    },
    {
      "id": "prevent-regression",
      "description": "Add test to prevent regression"
    }
  ]
}
```

---

## Level 4: TUI Choreography Templates

Templates that control how the TUI presents information.

### update-narrative

```json
{
  "id": "update-narrative",
  "name": "Update Narrative",
  "description": "Updates the TUI narrative display.",
  "category": "tool",
  "level": 4,

  "inputSchema": {
    "required": [
      { "shape": "narrative_update", "description": "What to show the user" }
    ]
  },

  "tasks": [
    {
      "id": "format-narrative",
      "description": "Format the narrative for terminal display"
    },
    {
      "id": "emit-impulse",
      "description": "Emit ui_component impulse for TUI rendering"
    }
  ]
}
```

### request-clarification

```json
{
  "id": "request-clarification",
  "name": "Request Clarification",
  "description": "Asks the user for clarification when the goal is ambiguous.",
  "category": "tool",
  "level": 4,

  "inputSchema": {
    "required": [
      { "shape": "ambiguity", "description": "What's unclear" },
      { "shape": "options", "description": "Possible interpretations" }
    ]
  },

  "tasks": [
    {
      "id": "present-options",
      "description": "Present clarification options to user"
    },
    {
      "id": "await-response",
      "description": "Wait for user selection"
    },
    {
      "id": "continue-execution",
      "description": "Continue with clarified intent"
    }
  ]
}
```

---

## Template Registration

### Registration Order

1. Level 0 templates registered first (immutable flag set)
2. Level 1-4 templates registered in order
3. Learned templates (Level 5+) loaded from cache

### Immutability Enforcement

```typescript
function registerTemplate(template: ActivityTemplate): void {
  if (template.level === 0 && isRegistered(template.id)) {
    throw new Error(`Cannot override immutable template: ${template.id}`)
  }

  if (template.level === 0) {
    template.immutable = true
  }

  templateRegistry.set(template.id, template)
}
```

### Template Validation on Load

All templates are validated on load:

```typescript
async function loadBootstrapTemplates(): Promise<void> {
  for (const template of BOOTSTRAP_TEMPLATES) {
    const result = await validateTemplate(template)
    if (!result.valid) {
      throw new Error(`Bootstrap template invalid: ${template.id}: ${result.errors.join(', ')}`)
    }
    registerTemplate(template)
  }
}
```

---

## Success Criteria

1. **Level 0 Immutable**: Cannot modify or delete primordial templates
2. **Hierarchy Respected**: Higher levels can reference lower levels
3. **Bootstrap Complete**: All templates load without errors
4. **Self-Describing**: Templates document their purpose
5. **Testable**: Each template can be tested in isolation
