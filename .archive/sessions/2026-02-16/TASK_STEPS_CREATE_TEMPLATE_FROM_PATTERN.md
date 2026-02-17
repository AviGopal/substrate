# Task Steps Design: Create Activity Template from Successful Pattern

**Activity ID**: `infrastructure-create-template-from-pattern`  
**Category**: `infrastructure`  
**Purpose**: Transform a successful interaction pattern into a reusable activity template through guided extraction, design, validation, and testing

---

## Overview

This activity follows a **4-step linear pipeline** that progressively builds and validates an activity template:

```
extract-pattern → design-template → validate-schema → test-execution
```

**Design Rationale**:
- **4 tasks** = optimal range (3-5) for clarity
- **Linear dependencies** = clear progression, easy to understand and debug
- **Progressive validation** = syntax → schema → execution (fail fast at each level)
- **Test-driven** = validates with real execution before completion

---

## Task 1: Extract Pattern

### Task Definition

```json
{
  "id": "extract-pattern",
  "subagent": "general",
  "description": "Analyze the successful interaction pattern and extract reusable structure for templating",
  "dependencies": []
}
```

### Purpose
Transform a successful interaction (from session history, documentation, or description) into a structured breakdown suitable for template creation.

### Agent Assignment Rationale
- **Subagent**: `general` - Multi-purpose analysis task
- **Why not specialized**: Not specific to tools, config, or session management

### Inputs (Activity Variables)
- `pattern_description` (string, required): Description of the successful interaction pattern
- `session_id` (string, optional): Session ID containing the interaction to extract from
- `example_files` (array[string], optional): Example files that demonstrate the pattern
- `reference_templates` (array[string], optional): IDs of similar templates to learn from

### Context Requirements (Impulses)
```json
{
  "key": "reference-templates",
  "hint": "Use search_activities({ category: '{{category}}', verbose: true }) to find 2-3 templates with success rates >= 0.75",
  "impulseTypes": ["activityRecommendation", "toolOutput"],
  "required": false,
  "budgetRange": [3000, 6000]
}
```

### Prompt Template
```
Extract a reusable pattern from this successful interaction.

## Input

Pattern Description:
{{pattern_description}}

{{#if session_id}}
Reference Session: {{session_id}}
(Review the session history to understand the interaction flow)
{{/if}}

{{#if example_files}}
Example Files:
{{#each example_files}}
- {{this}}
{{/each}}
{{/if}}

{{#if reference_templates}}
Reference Templates (for pattern inspiration):
{{#each reference_templates}}
- {{this}}
{{/each}}
{{/if}}

## Your Task

Analyze the interaction and extract a reusable pattern. Output structured markdown with these sections:

### 1. Core Tasks

Break the workflow into 3-5 discrete tasks. For each task:

**Task ID**: [kebab-case-id]
**Purpose**: [One sentence - what this task accomplishes]
**Dependencies**: [Which task IDs must complete before this one, or "none"]
**Inputs**: [What information this task needs]
**Outputs**: [What this task produces]
**Agent**: [general|tool|config|session - which subagent is best suited]
**Complexity**: [simple|moderate|complex|creative - reasoning depth required]

Example:
**Task ID**: analyze-requirements
**Purpose**: Study requirements and existing code to understand what needs to be implemented
**Dependencies**: none
**Inputs**: requirement_description (string), codebase_files (array)
**Outputs**: Structured markdown with requirements analysis and implementation plan
**Agent**: general
**Complexity**: moderate (requires analysis but has clear criteria)

### 2. Variables

List all parameters that would change between template uses:

**Variable Name**: [camelCase]
**Type**: [string|number|boolean|file|files|codebase-context]
**Required**: [yes|no]
**Description**: [Clear explanation of what this variable controls]
**Default**: [Default value if optional, or "none" if required]

Example:
**Variable Name**: featureName
**Type**: string
**Required**: yes
**Description**: Name of the feature to implement
**Default**: none

### 3. Validation Points

For each task identified above, specify how to validate success:

**Task ID**: [task-id-from-section-1]
**Required Files**: [Glob patterns for files that must exist after task execution, or "none"]
**Required Patterns**: [Strings that must appear in task output, or "none"]
**Forbidden Patterns**: [Strings that must NOT appear (e.g., "TODO", "TBD"), or "none"]
**Validation Commands**: [Shell commands to run with expected exit codes, or "none"]

Example:
**Task ID**: analyze-requirements
**Required Files**: none
**Required Patterns**: "## Requirements", "## Implementation Plan"
**Forbidden Patterns**: "TODO", "TBD", "[unclear]"
**Validation Commands**: none

### 4. Integration & Quality Gates

**Pre-Checks**: [Commands to run before activity starts, e.g., "git status"]
**Post-Checks**: [Commands to run after activity completes, e.g., "npm test"]
**Quality Gates**: [Required checks for success, e.g., "tests pass", "no compilation errors"]

### 5. Retry Strategy

For each task, specify appropriate retry configuration:

**Task ID**: [task-id-from-section-1]
**Max Attempts**: [2-3 typically]
**Strategy**: [simple|progressive-context|trailblazing]
**Rationale**: [Why this strategy fits expected failure modes]

Example:
**Task ID**: analyze-requirements
**Max Attempts**: 2
**Strategy**: simple
**Rationale**: Task may need clearer thinking on retry, but doesn't need more context

## Validation Checklist

Before submitting, verify:
- [ ] 3-5 tasks identified (not too many, not too few)
- [ ] Each task has clear inputs and outputs
- [ ] Dependencies form a linear or fan-out/fan-in graph (no cycles)
- [ ] All variables have types and clear descriptions
- [ ] Validation is specific (not vague patterns like "done" or "complete")
- [ ] First task has no dependencies
- [ ] Last task has clear success criteria

## Output Format

Use structured markdown with all 5 sections above. Be specific and concrete - avoid placeholders like "TBD" or vague descriptions.
```

### Expected Output
Structured markdown document with 5 sections:
1. Core Tasks (3-5 tasks with detailed breakdown)
2. Variables (all template parameters)
3. Validation Points (per-task validation)
4. Integration & Quality Gates
5. Retry Strategy (per-task)

### Validation
```json
{
  "validation": {
    "required_files": [],
    "required_patterns": [
      "### 1. Core Tasks",
      "### 2. Variables",
      "### 3. Validation Points",
      "### 4. Integration & Quality Gates",
      "### 5. Retry Strategy"
    ],
    "forbidden_patterns": [
      "TBD",
      "[unclear]",
      "[placeholder]"
    ],
    "commands": []
  }
}
```

### Retry Configuration
```json
{
  "retry": {
    "max_attempts": 2,
    "strategy": "simple",
    "fallback_prompt": "The pattern extraction was incomplete. Review your output:\n- Did you identify 3-5 tasks (not too many/few)?\n- Are all 5 sections present?\n- Is validation specific (not vague)?\n- Are dependencies clear and cycle-free?\n\nRefine your analysis and try again."
  }
}
```

### Complexity
```json
{
  "complexity": {
    "tier": "moderate",
    "reasoning": "Requires structured analysis and pattern recognition but has clear criteria and format",
    "characteristics": {
      "requires_deep_reasoning": true,
      "requires_creativity": false,
      "has_clear_criteria": true,
      "involves_tradeoffs": false
    },
    "estimatedTokens": {
      "input": 3000,
      "output": 2500
    }
  }
}
```

---

## Task 2: Design Template

### Task Definition

```json
{
  "id": "design-template",
  "subagent": "general",
  "description": "Create the complete activity template JSON following ActivityTemplate.Schema structure",
  "dependencies": ["extract-pattern"]
}
```

### Purpose
Transform the extracted pattern into a valid ActivityTemplate.Schema JSON file with all required metadata, tasks, validation, and configuration.

### Agent Assignment Rationale
- **Subagent**: `general` - Complex synthesis task requiring understanding of schema structure
- **Why not config**: While output is JSON, this requires creative design, not just config editing

### Inputs (From Activity Variables + Previous Task)
- `activity_id` (string, required): ID for the new activity (e.g., "feature-add-auth")
- `category` (string, required): Template category (feature|bugfix|refactor|tool|infrastructure)
- `template_name` (string, required): Human-readable template name
- Previous task output: Pattern extraction with task breakdown

### Context Requirements (Impulses)
```json
{
  "key": "template-schema-reference",
  "hint": "Load example-activity-template.json as reference for schema structure",
  "impulseTypes": ["file"],
  "required": true,
  "budgetRange": [4000, 6000]
}
```

### Prompt Template
```
Create a complete activity template JSON file.

## Input

Activity ID: {{activity_id}}
Template Name: {{template_name}}
Category: {{category}}

The pattern analysis from the previous task provides the structure you need to implement.

## Your Task

Create a file named `{{activity_id}}.json` with a complete ActivityTemplate.Schema structure.

Reference the example-activity-template.json in context for schema structure and best practices.

### Required Top-Level Fields

```json
{
  "name": "{{template_name}}",
  "description": "[Clear 1-2 sentence description of what this template does]",
  "category": "{{category}}",
  "tasks": [...],           // Implement from pattern analysis
  "integration": {...},      // Pre/post checks and quality gates
  "metabob": {...},         // Standard Metabob config
  "composition": {...},     // Optional but recommended
  "learning": {...},        // Optional but recommended
  "hooks": {...}            // Optional lifecycle hooks
}
```

### Tasks Array

For each task from the pattern analysis, create a complete task object:

```json
{
  "id": "[task-id-from-pattern]",
  "subagent": "[agent-from-pattern]",
  "description": "[purpose-from-pattern]",
  "dependencies": [...],     // Array of task IDs or []
  "prompt": {
    "template": "[Detailed prompt - see guidelines below]",
    "maxTokens": 8000,       // Adjust based on task complexity
    "compressionStrategy": "filter",
    "variables": [...]       // Variables referenced in prompt template
  },
  "validation": {
    "requiredFiles": [...],       // From pattern analysis
    "requiredPatterns": [...],    // From pattern analysis
    "forbiddenPatterns": [...],   // From pattern analysis
    "commands": [...]             // From pattern analysis
  },
  "retry": {
    "maxAttempts": 2,        // From pattern analysis
    "strategy": "[strategy-from-pattern]",
    "fallbackPrompt": "[Optional - provide if strategy is progressive-context]"
  },
  "metrics": {
    "successRate": 0.0,
    "avgTokens": 0,
    "avgDuration": 0,
    "commonFailures": []
  },
  "complexity": {
    "tier": "[tier-from-pattern]",
    "reasoning": "[reasoning-from-pattern]",
    "characteristics": {
      "requires_deep_reasoning": false,
      "requires_creativity": false,
      "has_clear_criteria": true,
      "involves_tradeoffs": false
    }
  }
}
```

### Prompt Template Guidelines

Structure each task prompt with:

1. **Context Setting**
   ```
   You are working on [activity purpose].
   Current task: [task ID]
   ```

2. **Objective** (one sentence)
   ```
   Your goal: [clear objective from pattern analysis]
   ```

3. **Input Context**
   ```
   You have access to:
   - Variables: {{var1}}, {{var2}}
   - Previous task outputs (if dependencies exist)
   ```

4. **Requirements** (bullet list)
   ```
   Must accomplish:
   1. [Requirement 1]
   2. [Requirement 2]
   ```

5. **Deliverables** (expected output format)
   ```
   Output format:
   ## Section 1
   - [Detail]
   ```

6. **Self-Validation**
   ```
   Before completing, verify:
   - [Check 1]
   - [Check 2]
   ```

Use `{{variableName}}` syntax for variable interpolation.

### Integration Configuration

```json
{
  "integration": {
    "preChecks": [...],      // From pattern analysis
    "postChecks": [...],     // From pattern analysis
    "qualityGates": [...]    // From pattern analysis
  }
}
```

### Metabob Configuration (Standard)

```json
{
  "metabob": {
    "enabled": true,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "key-components"
  }
}
```

### Composition (Recommended)

```json
{
  "composition": {
    "standalone": true,
    "examples": [
      {
        "name": "[Concrete usage example name]",
        "description": "[What this example achieves]",
        "sequence": [
          {
            "template": "{{activity_id}}",
            "variables": {
              // Example variable values
            },
            "reason": "[Why this template is used]"
          }
        ],
        "outcome": "[Expected result]"
      }
    ]
  }
}
```

### Learning Configuration (Recommended)

```json
{
  "learning": {
    "enabled": true,
    "captureStrategy": "detailed",
    "feedbackPoints": [
      {
        "taskId": "[task-id]",
        "metrics": {
          "[metric_name]": "[Description (type)]"
        },
        "improvementHints": {
          "[hint_name]": "[Question to capture (string)]"
        }
      }
    ]
  }
}
```

### Hooks (Optional)

```json
{
  "hooks": {
    "preActivity": {
      "environment": {
        "TEMPLATE_CONTEXT": "creation"
      }
    },
    "postActivity": {
      "cleanup": true,
      "createSummary": true
    },
    "onError": {
      "captureEnvironment": true,
      "captureLogs": { "tail": 50 },
      "createDiagnosticImpulse": true,
      "cleanup": false
    }
  }
}
```

## Final Checklist

Before saving the file, verify:
- [ ] All required top-level fields present
- [ ] Task count matches pattern analysis (3-5 tasks)
- [ ] All task IDs are unique and kebab-case
- [ ] Dependencies reference valid task IDs
- [ ] No circular dependencies
- [ ] All {{variables}} in prompts are defined
- [ ] Validation is specific and measurable
- [ ] JSON is syntactically valid (no trailing commas, proper quotes)

Save the complete template as: {{activity_id}}.json
```

### Expected Output
A valid JSON file named `{{activity_id}}.json` containing a complete ActivityTemplate.Schema.

### Validation
```json
{
  "validation": {
    "required_files": [
      "{{activity_id}}.json"
    ],
    "required_patterns": [],
    "forbidden_patterns": [
      "TBD",
      "TODO",
      "FIXME",
      "[placeholder]"
    ],
    "commands": [
      {
        "name": "validate-json-syntax",
        "command": "jq empty {{activity_id}}.json",
        "required": true
      }
    ]
  }
}
```

### Retry Configuration
```json
{
  "retry": {
    "max_attempts": 3,
    "strategy": "progressive-context",
    "fallback_prompt": "The template JSON has errors. Debug systematically:\n\n1. **JSON Syntax**: Run `jq . {{activity_id}}.json` to identify syntax errors\n   - Common: trailing commas, unescaped quotes, missing brackets\n\n2. **Required Fields**: Compare to example-activity-template.json\n   - Top-level: name, description, category, tasks, integration, metabob\n   - Task-level: id, subagent, description, dependencies, prompt, validation, retry, metrics\n\n3. **Variable Consistency**: \n   - All {{variables}} in prompt.template must be in prompt.variables array\n   - Variable names should be camelCase\n\n4. **Dependencies**:\n   - All task IDs in dependencies array must exist\n   - Check for circular dependencies (A depends on B, B depends on A)\n\n5. **Validation Structure**:\n   - All validation fields must be arrays (can be empty [])\n   - Commands must have 'name', 'command', 'required' fields\n\nFix the identified issues and regenerate the complete JSON file."
  }
}
```

### Complexity
```json
{
  "complexity": {
    "tier": "complex",
    "reasoning": "Requires understanding complex nested schema structure, synthesizing multiple concerns, and creative design decisions",
    "characteristics": {
      "requires_deep_reasoning": true,
      "requires_creativity": true,
      "has_clear_criteria": true,
      "involves_tradeoffs": true
    },
    "estimatedTokens": {
      "input": 8000,
      "output": 4000
    }
  }
}
```

---

## Task 3: Validate Schema

### Task Definition

```json
{
  "id": "validate-schema",
  "subagent": "general",
  "description": "Validate the template conforms to ActivityTemplate.Schema using register_activity_template tool",
  "dependencies": ["design-template"]
}
```

### Purpose
Ensure the created JSON template is structurally valid and conforms to the ActivityTemplate.Schema before attempting execution.

### Agent Assignment Rationale
- **Subagent**: `general` - Straightforward tool use with debugging if needed
- **Tool requirement**: `register_activity_template` (with validate_only flag)

### Inputs (From Activity Variables)
- `activity_id` (string, required): Used to construct file path

### Tools Required
```json
{
  "tools": {
    "required": ["register_activity_template"],
    "optional": [],
    "disabled": []
  }
}
```

### Prompt Template
```
Validate the activity template schema.

## Context

Template File: {{activity_id}}.json

## Your Task

Use the `register_activity_template` tool to validate the schema WITHOUT registering:

```javascript
register_activity_template({
  file_path: "{{activity_id}}.json",
  validate_only: true
})
```

### If Validation Passes

Great! The template conforms to ActivityTemplate.Schema. Proceed to next task.

### If Validation Fails

The tool will return specific validation errors. For each error:

1. **Read the error message carefully** - it tells you exactly what's wrong
2. **Locate the issue** in {{activity_id}}.json
3. **Fix the problem**
4. **Re-run validation**
5. **Repeat until validation passes**

## Common Validation Errors & Fixes

### Error: "Missing required field: [field]"
**Fix**: Add the missing field to the appropriate location in the JSON

### Error: "Invalid enum value for [field]: got '[value]', expected one of [...]"
**Fix**: Change the value to one of the allowed enum values

Example: `"category": "feature"` not `"category": "new-feature"`

### Error: "Task dependency '[task-id]' not found"
**Fix**: Ensure all task IDs in dependencies arrays exist in tasks array

### Error: "Variable '{{varName}}' used in prompt but not declared in variables array"
**Fix**: Add variable to prompt.variables array:
```json
{
  "prompt": {
    "template": "Create {{featureName}}...",
    "variables": ["featureName"]  // Add this
  }
}
```

### Error: "Invalid task ID format: '[id]' (must be kebab-case)"
**Fix**: Convert task ID to kebab-case (lowercase with hyphens)

Example: `"analyze_code"` → `"analyze-code"`

### Error: "Circular dependency detected: [task-A] → [task-B] → [task-A]"
**Fix**: Remove one dependency to break the cycle

### Error: "Invalid JSON syntax at line [N]"
**Fix**: Run `jq . {{activity_id}}.json` to identify syntax errors
- Remove trailing commas
- Escape quotes in strings
- Close all brackets and braces

## Success Criteria

Validation must pass with no errors. You may need to iterate 2-3 times - this is normal for complex schemas.

Output the validation success message when complete.
```

### Expected Output
Successful validation confirmation, or multiple fix iterations resulting in successful validation.

### Validation
```json
{
  "validation": {
    "required_files": [
      "{{activity_id}}.json"
    ],
    "required_patterns": [
      "validation passed",
      "template is valid"
    ],
    "forbidden_patterns": [
      "validation failed",
      "schema error",
      "validation error"
    ],
    "commands": [
      {
        "name": "final-json-check",
        "command": "jq empty {{activity_id}}.json",
        "required": true
      }
    ]
  }
}
```

### Retry Configuration
```json
{
  "retry": {
    "max_attempts": 3,
    "strategy": "progressive-context",
    "fallback_prompt": "Schema validation is still failing after multiple attempts. Let's debug systematically:\n\n**Step 1: Compare Structure**\n- Open example-activity-template.json side-by-side\n- Check that your template has all the same top-level keys\n- Verify the structure of each section matches\n\n**Step 2: Validate Dependencies**\n- List all task IDs from your tasks array\n- For each task's dependencies array, confirm every ID exists\n- Draw the dependency graph - are there any cycles?\n\n**Step 3: Check Enums**\n- category: must be 'feature', 'bugfix', 'refactor', 'tool', or 'infrastructure'\n- subagent: must be 'general', 'tool', 'config', or 'session'\n- complexity.tier: must be 'simple', 'moderate', 'complex', or 'creative'\n- retry.strategy: must be 'simple', 'progressive-context', or 'trailblazing'\n\n**Step 4: Verify Variables**\n- Search for all {{variableName}} in prompt templates\n- Ensure each is listed in the corresponding prompt.variables array\n\n**Step 5: JSON Syntax**\n- Run: jq . {{activity_id}}.json\n- Fix any syntax errors reported\n\nAfter checking all 5 steps, fix the issues and retry validation."
  }
}
```

### Complexity
```json
{
  "complexity": {
    "tier": "moderate",
    "reasoning": "Straightforward validation with clear error messages, but may require iterative debugging",
    "characteristics": {
      "requires_deep_reasoning": false,
      "requires_creativity": false,
      "has_clear_criteria": true,
      "involves_tradeoffs": false
    },
    "estimatedTokens": {
      "input": 4000,
      "output": 1500
    }
  }
}
```

---

## Task 4: Test Execution

### Task Definition

```json
{
  "id": "test-execution",
  "subagent": "general",
  "description": "Execute the template with test data to verify end-to-end functionality",
  "dependencies": ["validate-schema"]
}
```

### Purpose
Validate that the template not only has correct schema structure, but actually executes successfully with realistic test data.

### Agent Assignment Rationale
- **Subagent**: `general` - Requires tool use, debugging, and potentially template fixes
- **Tool requirements**: `register_activity_template`, `activity`

### Inputs (From Activity Variables)
- `activity_id` (string, required): Template ID to test
- `test_variables` (object, required): Test variable values matching template's expected inputs

### Tools Required
```json
{
  "tools": {
    "required": ["register_activity_template", "activity"],
    "optional": [],
    "disabled": []
  }
}
```

### Prompt Template
```
Test the activity template with real execution.

## Context

Template: {{activity_id}}.json
Test Variables: {{test_variables}}

## Your Task

Execute the template end-to-end to verify it works correctly.

### Step 1: Register the Template

```javascript
register_activity_template({
  file_path: "{{activity_id}}.json",
  validate_only: false  // This time, actually register it
})
```

This makes the template discoverable and executable.

### Step 2: Execute the Activity

```javascript
activity({
  activityId: "{{activity_id}}",
  variables: {{test_variables}},
  reason: "Test execution of newly created template"
})
```

### Step 3: Monitor Execution

Watch for:
- ✅ **All tasks complete successfully**
- ✅ **All validation checks pass**
- ✅ **Activity reaches "completed" status**
- ❌ **Any task failures**
- ❌ **Validation errors**
- ❌ **Timeout or hanging**

### If Execution Succeeds

🎉 Template is validated and ready for use!

Output a success summary:
- Template ID: {{activity_id}}
- All [N] tasks completed successfully
- Total duration: [X seconds]
- Template registered and discoverable via search_activities

### If Execution Fails

Debug and fix the template. Common failure modes:

#### Failure Type 1: Task Prompt Issues

**Symptoms**: Task fails with "unclear instructions" or produces wrong output

**Debug**:
- Read the task's prompt.template in {{activity_id}}.json
- Is the objective clear?
- Are all required {{variables}} provided in test_variables?
- Is the expected output format specified?

**Fix**: Edit the prompt.template to be more specific

#### Failure Type 2: Validation Too Strict

**Symptoms**: Task completes but validation fails

**Debug**:
- Check the task's validation.requiredPatterns
- Is the agent output close but not exact match?
- Are forbidden patterns too broad?

**Fix**: Adjust validation to be less strict (e.g., partial pattern match)

#### Failure Type 3: Missing Variables

**Symptoms**: Prompt has "{{undefinedVar}}" in output

**Debug**:
- Search for all {{variables}} in the task's prompt.template
- Compare to prompt.variables array
- Check if test_variables provides the value

**Fix**: Add missing variable to prompt.variables or test_variables

#### Failure Type 4: Tool Not Available

**Symptoms**: Task fails with "tool not found"

**Debug**:
- Check if task.tools.required specifies a non-existent tool
- Verify tool name spelling

**Fix**: Remove invalid tool requirement or fix tool name

#### Failure Type 5: Dependency Issues

**Symptoms**: Task tries to run before dependency completes

**Debug**:
- Review task.dependencies array
- Check if dependency task actually produces required output
- Verify no circular dependencies

**Fix**: Correct dependencies or adjust task prompts

### Fix-Validate-Test Loop

When you fix the template:

1. **Edit** {{activity_id}}.json with the fix
2. **Re-validate** schema: `register_activity_template(validate_only=true)`
3. **Re-test** execution: `activity(activityId='{{activity_id}}')`
4. **Iterate** until success

Don't give up! Template debugging is iterative. Learn from each failure.

## Success Criteria

- Activity execution completes with status "completed"
- All tasks pass validation
- No errors or failures
- Template is production-ready

Output the success summary when achieved.
```

### Expected Output
Successful activity execution, or multiple debug-fix-retest cycles resulting in successful execution.

### Validation
```json
{
  "validation": {
    "required_files": [
      "{{activity_id}}.json"
    ],
    "required_patterns": [
      "completed",
      "success"
    ],
    "forbidden_patterns": [
      "activity failed",
      "task failed",
      "execution error"
    ],
    "commands": []
  }
}
```

### Retry Configuration
```json
{
  "retry": {
    "max_attempts": 3,
    "strategy": "progressive-context",
    "fallback_prompt": "Test execution is still failing. Let's do a comprehensive debug:\n\n**Execution Analysis**\n1. Which task failed? (check activity output)\n2. What was the exact error message?\n3. Is it a template structure issue or content issue?\n\n**Template Review Checklist**\n\n□ **Prompt Quality**\n  - Is each task's objective crystal clear?\n  - Does the prompt specify expected output format?\n  - Are all {{variables}} defined and provided?\n\n□ **Variable Flow**\n  - Run through the variable flow:\n    - Activity variables → interpolated into prompts\n    - Task outputs → available to dependent tasks?\n  - Any missing links?\n\n□ **Validation Alignment**\n  - For the failing task, review validation.requiredPatterns\n  - Run the prompt manually - what output would you produce?\n  - Would that output match the validation?\n  - If not, either fix the prompt or loosen validation\n\n□ **Dependencies**\n  - Does the failing task depend on a previous task?\n  - Does that previous task actually produce the needed output?\n  - Is the output accessible to the dependent task?\n\n□ **Test Variables**\n  - Are test_variables realistic and complete?\n  - Do they match what the template expects?\n  - Try different test values if needed\n\n**Fix Strategy**\n\n1. Make ONE targeted fix\n2. Re-validate schema (validate_only=true)\n3. Re-test execution\n4. Observe the new behavior\n5. Iterate\n\nFocus on the FIRST failing task - fix that before worrying about later tasks.\n\nYou can succeed - keep iterating!"
  }
}
```

### Complexity
```json
{
  "complexity": {
    "tier": "complex",
    "reasoning": "Requires debugging potentially multiple failure modes, understanding execution context, and iterative problem-solving",
    "characteristics": {
      "requires_deep_reasoning": true,
      "requires_creativity": true,
      "has_clear_criteria": false,
      "involves_tradeoffs": true
    },
    "estimatedTokens": {
      "input": 6000,
      "output": 3000
    }
  }
}
```

---

## Activity-Level Configuration

### Integration
```json
{
  "integration": {
    "preChecks": [
      "git status"
    ],
    "postChecks": [
      "test -f {{activity_id}}.json",
      "jq empty {{activity_id}}.json"
    ],
    "qualityGates": [
      {
        "name": "template-file-exists",
        "command": "test -f {{activity_id}}.json",
        "required": true
      },
      {
        "name": "valid-json",
        "command": "jq empty {{activity_id}}.json",
        "required": true
      }
    ]
  }
}
```

### Metabob Configuration
```json
{
  "metabob": {
    "enabled": true,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "key-components"
  }
}
```

### Hooks
```json
{
  "hooks": {
    "preActivity": {
      "loadImpulses": ["template-schema-reference"],
      "environment": {
        "TEMPLATE_CREATION": "true",
        "ACTIVITY_MODE": "template-design"
      }
    },
    "postActivity": {
      "cleanup": true,
      "extractFiles": {
        "pattern": "{{activity_id}}.json",
        "destination": "./templates/",
        "action": "copy"
      },
      "createSummary": true,
      "persistImpulses": ["created-template-definition"]
    },
    "onError": {
      "captureEnvironment": true,
      "captureLogs": {
        "tail": 100
      },
      "createDiagnosticImpulse": true,
      "cleanup": false
    }
  }
}
```

### Composition
```json
{
  "composition": {
    "standalone": true,
    "examples": [
      {
        "name": "Create REST Endpoint Addition Template",
        "description": "Create a template for adding REST endpoints with validation and tests",
        "sequence": [
          {
            "template": "infrastructure-create-template-from-pattern",
            "variables": {
              "pattern_description": "Add REST endpoint pattern: 1) Define route schema, 2) Implement handler with validation, 3) Add integration tests, 4) Document API",
              "activity_id": "feature-add-rest-endpoint",
              "category": "feature",
              "template_name": "Add REST Endpoint with Tests",
              "test_variables": {
                "endpoint_path": "/api/test",
                "http_method": "GET",
                "description": "Test endpoint"
              }
            },
            "reason": "Create reusable template for REST endpoint addition workflow"
          }
        ],
        "outcome": "New activity template 'feature-add-rest-endpoint' registered and tested"
      },
      {
        "name": "Create Bug Fix with Metabob Template",
        "description": "Create a template for fixing bugs with Metabob annotation workflow",
        "sequence": [
          {
            "template": "infrastructure-create-template-from-pattern",
            "variables": {
              "pattern_description": "Bug fix pattern: 1) Search similar issues with metabob_search_codebase_issues, 2) Fix code with tests, 3) Document fix with metabob_annotate_component, 4) Mark complete with metabob_mark_problem_complete",
              "activity_id": "bugfix-with-metabob-complete",
              "category": "bugfix",
              "template_name": "Bug Fix with Metabob Integration",
              "test_variables": {
                "bug_description": "Test bug in authentication",
                "affected_file": "src/auth/login.ts"
              }
            },
            "reason": "Create reusable template for bug fixes with full Metabob workflow"
          }
        ],
        "outcome": "New activity template 'bugfix-with-metabob-complete' registered and tested"
      }
    ]
  }
}
```

### Learning
```json
{
  "learning": {
    "enabled": true,
    "captureStrategy": "detailed",
    "feedbackPoints": [
      {
        "taskId": "extract-pattern",
        "metrics": {
          "task_count": "Number of tasks identified in pattern (number)",
          "variable_count": "Number of variables identified (number)",
          "validation_points_count": "Number of validation points specified (number)"
        },
        "improvementHints": {
          "analysis_clarity": "Was the pattern analysis clear and actionable? (string)",
          "appropriate_granularity": "Was task granularity appropriate (not too coarse/fine)? (string)"
        }
      },
      {
        "taskId": "design-template",
        "metrics": {
          "json_size_bytes": "Size of generated JSON file (number)",
          "first_validation_errors": "Number of validation errors on first schema check (number)",
          "fix_iterations": "Number of fix iterations needed (number)"
        },
        "improvementHints": {
          "schema_adherence": "Did template follow schema correctly on first try? (string)",
          "prompt_quality": "Were task prompts well-structured and clear? (string)"
        }
      },
      {
        "taskId": "validate-schema",
        "metrics": {
          "validation_attempts": "Number of validation attempts before success (number)",
          "error_types": "Types of validation errors encountered (array)"
        },
        "improvementHints": {
          "common_error_patterns": "Any recurring error patterns to address in design? (string)"
        }
      },
      {
        "taskId": "test-execution",
        "metrics": {
          "first_run_success": "Did test execution pass on first try? (boolean)",
          "debug_iterations": "Number of debug-fix-retest cycles (number)",
          "failing_task_id": "Which task failed first (if any)? (string)",
          "failure_reason": "What was the root cause of failure? (string)"
        },
        "improvementHints": {
          "test_variable_quality": "Were test variables comprehensive and realistic? (string)",
          "validation_tuning": "Did validation need adjustment (too strict/loose)? (string)"
        }
      }
    ],
    "aggregation": {
      "successPatterns": [],
      "failurePatterns": [],
      "optimization_opportunities": []
    }
  }
}
```

---

## Design Validation

### Task Graph

```
extract-pattern (no deps)
    ↓
design-template (depends on: extract-pattern)
    ↓
validate-schema (depends on: design-template)
    ↓
test-execution (depends on: validate-schema)
```

✅ Linear dependency chain  
✅ 4 tasks (optimal range)  
✅ Clear progression  
✅ Progressive validation (syntax → schema → execution)  
✅ No circular dependencies  

### Validation Checklist

- [x] Task count: 4 (in 3-7 range)
- [x] All tasks have unique IDs (kebab-case)
- [x] Dependencies form a DAG (no cycles)
- [x] All tasks have validation configuration
- [x] All tasks have retry configuration
- [x] First task has no dependencies
- [x] Last task has clear success criteria
- [x] Variables are used consistently
- [x] Prompts are structured and detailed
- [x] Validation is specific and measurable
- [x] Retry strategies match expected failures
- [x] Complexity tiers assigned appropriately
- [x] Tool requirements specified where needed

---

## Usage Example

```bash
# Create a new template for adding authentication features
opencode activity \
  activityId="infrastructure-create-template-from-pattern" \
  variables='{
    "pattern_description": "Authentication feature pattern: 1) Analyze security requirements, 2) Implement JWT auth with bcrypt password hashing, 3) Add login/logout/refresh endpoints with rate limiting, 4) Write security tests including XSS and injection tests, 5) Document security considerations",
    "activity_id": "feature-add-authentication",
    "category": "feature",
    "template_name": "Add Authentication Feature",
    "test_variables": {
      "auth_type": "JWT",
      "session_duration": "24h",
      "require_2fa": false
    }
  }' \
  reason="Create reusable authentication feature template"
```

---

## Next Steps

1. **Implement JSON**: Convert this design into `infrastructure-create-template-from-pattern.json`
2. **Register**: Use `register_activity_template` to make it discoverable
3. **Bootstrap Test**: Use this template to create itself (meta-test)
4. **Iterate**: Refine based on first execution feedback
5. **Document**: Add to activity template creation guide

---

## References

- **Schema Source**: `/repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- **Example Template**: `/example-activity-template.json`
- **Design Guide**: `/DESIGN_ACTIVITY_TASK_STEPS.md`
- **Proto Schema**: `/repos/metabob-proto/proto/metabob/activity/variant.proto`

