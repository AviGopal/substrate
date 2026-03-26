# Activity Template Success Patterns

**Extracted from**: High-performing templates (100% success rate)  
**Purpose**: Guide future template creation and evolution

---

## Pattern 1: Clear Task Decomposition (manage-session-memory)

### What Works
```typescript
{
  "tasks": [
    {
      "id": "analyze-intent",      // Clear, focused purpose
      "description": "Analyze user intent and determine what context is needed",
      "dependencies": []            // Explicit dependencies
    },
    {
      "id": "create-impulses",
      "description": "Create impulses from analysis (unloaded state)",
      "dependencies": ["analyze-intent"]  // Sequential when needed
    },
    // ... more tasks with clear boundaries
  ]
}
```

### Key Principles
- ✅ **One clear goal per task** - "Analyze intent" not "Analyze and create"
- ✅ **Explicit dependencies** - Makes execution order predictable
- ✅ **Descriptive task IDs** - Self-documenting workflow
- ✅ **Reasonable scope** - 5 tasks, each manageable

### Anti-Patterns
- ❌ Tasks with multiple responsibilities
- ❌ Hidden dependencies between tasks
- ❌ Vague task descriptions
- ❌ Too many tasks (>10) or too few (<2)

---

## Pattern 2: Input-Output Validation (test-metabob-stack-e2e-fixed)

### What Works
```typescript
{
  "prompt": {
    "template": `
    ## Your Task
    1. Input: {{acpTestInput}}
    2. Process: Echo back exact text
    3. Output verification: output === input
    4. Status: PASS if match, FAIL otherwise
    
    ## Output Format
    {
      "input": "{{acpTestInput}}",
      "output": "<actual>",
      "status": "PASS/FAIL",
      "verification": "exact string match"
    }
    `
  }
}
```

### Key Principles
- ✅ **Explicit input expectations** - What variables mean
- ✅ **Clear verification criteria** - How to determine success
- ✅ **Structured output format** - Machine-parseable results
- ✅ **Success/failure detection** - Binary outcomes

### Anti-Patterns
- ❌ Ambiguous success criteria
- ❌ Unstructured text output (hard to parse)
- ❌ Implicit assumptions about input
- ❌ No verification step

---

## Pattern 3: Single-Task Simplicity (validate-deployment-constraints-compliance)

### What Works
```typescript
{
  "tasks": [
    {
      "id": "validate-all-constraints",
      "description": "Validate all 10 constraints and generate report",
      "dependencies": [],
      "prompt": {
        // Comprehensive prompt with all logic
        // No complex dependencies
        // All validation in one place
      },
      "validation": {
        "required_files": [
          "constraint-compliance-report.json",
          "CONSTRAINT_REMEDIATION_GUIDE.md"
        ]
      }
    }
  ]
}
```

### Key Principles
- ✅ **Single focused task** - No dependency complexity
- ✅ **Comprehensive validation** - Check all requirements
- ✅ **Actionable outputs** - Reports include remediation
- ✅ **Clear deliverables** - Required files specified

### Anti-Patterns
- ❌ Over-decomposition (10 tasks for 10 checks)
- ❌ Partial validation (missing edge cases)
- ❌ Vague outputs ("validation report")
- ❌ No actionable guidance

---

## Pattern 4: Predictable Token Budgets (all successful templates)

### What Works
```typescript
{
  "context_rules": {
    "max_tokens": 8000,          // Consistent, reasonable
    "compression_strategy": "filter"
  }
}
```

### Key Principles
- ✅ **Consistent budgets** - 8K-16K for most tasks
- ✅ **Known compression** - "filter" is predictable
- ✅ **Room for growth** - Not using max context
- ✅ **Task-appropriate** - Complex tasks get more tokens

### Token Budget Guidelines
- Simple tasks (validation, checks): 8,000 tokens
- Medium tasks (analysis, generation): 12,000-16,000 tokens
- Complex tasks (multi-file edits): 20,000 tokens
- Never: 200,000 tokens (unpredictable cost)

---

## Pattern 5: Specialized Agents (manage-session-memory)

### What Works
```typescript
{
  "tasks": [
    {
      "subagent": "memory",  // Specialized for memory operations
      "description": "Analyze user intent and determine what context is needed",
      // Memory agent has tools: impulse_create, impulse_load, memory_optimize
    }
  ]
}
```

### Key Principles
- ✅ **Match agent to task** - memory for memory tasks
- ✅ **Leverage specialization** - Agents have domain tools
- ✅ **Consistent agent use** - All tasks in template use same agent (if appropriate)

### Agent Selection Guide
- **memory**: Impulse management, context optimization
- **general**: Most implementation tasks, file editing, testing
- **config**: Schema changes, configuration management
- **test**: Test generation, test analysis
- **docs**: Documentation generation, README updates

---

## Pattern 6: Graceful Retry Strategy (all successful templates)

### What Works
```typescript
{
  "retry": {
    "max_attempts": 2,      // Not too many (expensive)
    "strategy": "simple"    // Predictable behavior
  }
}
```

### Key Principles
- ✅ **Limited retries** - 2-3 max, not 10
- ✅ **Simple strategy** - No complex backoff
- ✅ **Idempotent tasks** - Safe to retry
- ✅ **Quick failure** - Don't mask real issues

### Retry Guidelines
- Validation tasks: 1-2 attempts (fail fast)
- API calls: 2-3 attempts (transient failures)
- File operations: 2 attempts (usually succeed first time)
- Complex operations: 1 attempt (debug before retry)

---

## Pattern 7: Structured Prompt Templates

### What Works
```typescript
{
  "prompt": {
    "template": `
    **Your Task**: [One sentence goal]
    
    **Input Variables**:
    - {{variable1}}: [What it means]
    - {{variable2}}: [What it means]
    
    **Steps**:
    1. [Specific action]
    2. [Specific action]
    3. [Verification step]
    
    **Output Format**:
    \`\`\`json
    {
      "field1": "value",
      "status": "PASS/FAIL"
    }
    \`\`\`
    
    **Success Criteria**: [How to know you succeeded]
    `
  }
}
```

### Key Principles
- ✅ **Clear sections** - Task, Input, Steps, Output, Success
- ✅ **Examples provided** - Show expected format
- ✅ **Explicit variables** - Document all {{variables}}
- ✅ **Verification included** - How to check success

---

## Pattern 8: Validation That Matters

### What Works
```typescript
{
  "validation": {
    "required_files": [
      "constraint-compliance-report.json",  // Specific files
      "CONSTRAINT_REMEDIATION_GUIDE.md"
    ],
    "required_patterns": [
      {
        "pattern": "## Executive Summary",  // Key sections
        "description": ""
      }
    ],
    "commands": [
      {
        "command": "cat output.json | jq empty",  // Syntax check
        "expected_exit_code": 0
      }
    ]
  }
}
```

### Key Principles
- ✅ **File existence** - Check deliverables exist
- ✅ **Structure validation** - Key patterns present
- ✅ **Syntax validation** - Valid JSON, valid code
- ✅ **Meaningful checks** - Not just "file exists"

### Anti-Patterns
- ❌ Over-validation (checking every detail)
- ❌ Under-validation (no checks at all)
- ❌ Brittle validation (exact line counts)
- ❌ Validation that can't fail (always passes)

---

## Anti-Patterns to Avoid (from failed templates)

### 1. Over-Decomposition
```typescript
// ❌ BAD: 7 tasks for one system
{
  "tasks": [
    {"id": "task-1", "description": "Analyze requirements"},
    {"id": "task-2", "description": "Design architecture"},
    {"id": "task-3", "description": "Implement component A"},
    {"id": "task-4", "description": "Implement component B"},
    {"id": "task-5", "description": "Implement component C"},
    {"id": "task-6", "description": "Integration test"},
    {"id": "task-7", "description": "Documentation"}
  ]
}

// ✅ GOOD: Incremental phases with validation
{
  "tasks": [
    {"id": "phase-1", "description": "Core components with unit tests"},
    {"id": "phase-2", "description": "Integration with system tests"},
    {"id": "phase-3", "description": "Documentation and final validation"}
  ]
}
```

### 2. Missing Pre-Flight Checks
```typescript
// ❌ BAD: Assume resources exist
{
  "prompt": "Scale deployment to 3 replicas"
}

// ✅ GOOD: Validate first
{
  "prompt": `
  1. Check: kubectl access, namespace exists, deployment exists
  2. If checks pass: Scale deployment to 3 replicas
  3. If checks fail: Report missing prerequisites
  `
}
```

### 3. Brittle Validation
```typescript
// ❌ BAD: Exact line counts
{
  "validation": {
    "commands": [
      {"command": "wc -l output.md | grep '^100 '", "expected_exit_code": 0}
    ]
  }
}

// ✅ GOOD: Meaningful content checks
{
  "validation": {
    "required_patterns": [
      {"pattern": "## Executive Summary"},
      {"pattern": "## Detailed Analysis"}
    ]
  }
}
```

---

## Template Health Checklist

Use this checklist when creating or evolving templates:

**Task Design**:
- [ ] Each task has one clear responsibility
- [ ] Dependencies are explicit and minimal
- [ ] Task IDs are descriptive
- [ ] 2-6 tasks total (not too few, not too many)

**Prompt Quality**:
- [ ] Clear goal statement
- [ ] All variables documented
- [ ] Step-by-step instructions
- [ ] Output format specified
- [ ] Success criteria defined

**Validation**:
- [ ] Required files listed
- [ ] Key patterns checked
- [ ] Syntax validation included
- [ ] Validation can actually fail

**Resource Management**:
- [ ] Token budgets are reasonable (8K-20K)
- [ ] Retry strategy is simple (2-3 attempts max)
- [ ] Agent selection is appropriate
- [ ] Compression strategy is "filter"

**Testing**:
- [ ] Template can be tested with simple inputs
- [ ] Failure modes are predictable
- [ ] Success/failure is clearly distinguished
- [ ] Output is machine-parseable

---

## Success Metrics

**Template Quality Score** (1-10):
- Task decomposition: Clear boundaries, explicit dependencies (0-2 points)
- Prompt quality: Clear, structured, examples provided (0-2 points)
- Validation: Meaningful, not brittle (0-2 points)
- Resource management: Predictable budgets, appropriate retries (0-2 points)
- Testing: Easy to test, clear success/failure (0-2 points)

**Target**: 8+/10 for production templates

---

## Conclusion

**Key Takeaways**:
1. ✅ **Simplicity wins** - Single-task templates work best
2. ✅ **Clear boundaries** - Explicit inputs, outputs, success criteria
3. ✅ **Validation matters** - But not too brittle
4. ✅ **Agent specialization** - Match agent to task domain
5. ✅ **Predictable resources** - Consistent token budgets, simple retry

**When in doubt**: Look at **manage-session-memory** and **validate-deployment-constraints-compliance** as exemplars.

---

**Generated by**: Activity Evolution Analysis  
**For**: Template creators and evolvers  
**Last Updated**: 2026-02-26
