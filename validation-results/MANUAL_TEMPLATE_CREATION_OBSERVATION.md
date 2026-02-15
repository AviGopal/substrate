# Manual Template Creation - Behavioral Observation

**Date**: 2026-02-14  
**Observer**: Activity Mode Agent  
**Task**: Create a simple "Hello World" activity template from scratch  
**Purpose**: Observe and document decision-making process to inform better template design

---

## Step 1: Understanding Requirements

**Decision Point**: What do I need to know about activity templates?

**Information Needed**:
- Activity template JSON schema/structure
- Required vs. optional fields
- Task structure and dependencies
- Validation patterns
- Best practices

**Action**: Search for example templates

**Reasoning**: I need to see existing templates to understand the pattern before creating one. Starting from scratch without examples would lead to schema errors.

**Tools to Use**:
- `glob` to find existing template files
- `read` to examine template structure
- `grep` to find specific patterns

**Confidence**: High - this is the logical first step

---

## Step 2: Discovering Examples

**Action Taken**: Used `glob` to find activity template files

**Files Found**:
- activity-create-v2.json (complex, 7 steps)
- activity-evolve.json
- activity-debug.json (simpler, 5 steps)  
- activity-create.json

**Decision**: Read activity-debug.json as it's simpler and will show the minimal required structure

**Observation**: Template structure includes:
```
{
  "variant_id": string,
  "activity_id": string,
  "variant_name": string,
  "version": number,
  "description": string,
  "variables": object with type definitions,
  "prompt_strategy": string,
  "context_budget_tokens": number,
  "expected_duration_ms": number,
  "expected_cost": number,
  "expected_quality_score": number,
  "status": "active" | "testing" | etc,
  "tasks": array of task objects
}
```

**Task Structure** (each task):
```
{
  "id": string,
  "subagent": "general" | "config" | "session" | etc,
  "description": string,
  "dependencies": array of task_ids,
  "guidance": array of strings (human-readable tips),
  "impulse_refs": array (context references),
  "prompt": {
    "template": string,
    "max_tokens": number,
    "compression_strategy": string,
    "variables": array of variable names
  },
  "validation": {
    "required_files": array,
    "required_patterns": array,
    "forbidden_patterns": array,
    "commands": array
  },
  "retry": {
    "max_attempts": number,
    "strategy": "simple" | "progressive-context" | "trailblazing",
    "fallback_prompt": string
  },
  "metrics": {
    "success_rate": number,
    "avg_tokens": number,
    "avg_duration": number,
    "common_failures": array
  },
  "tools": {
    "required": array,
    "optional": array,
    "disabled": array
  }
}
```

**Key Insights**:
1. **Metadata fields** are important for tracking and optimization
2. **Variables** must be defined with types and descriptions
3. **Tasks** have comprehensive structure with validation, retry, metrics
4. **Guidance arrays** provide human-readable context
5. **Tools specification** helps agents know what's available

---

## Step 3: Designing Hello World Template

**Goal**: Create minimal but complete "Hello World" activity

**Decisions**:

### Task Count
**Options**:
- 1 task: Too minimal, no validation
- 2 tasks: Print + verify (good balance)
- 3 tasks: Print + verify + cleanup (potentially overkill)

**Choice**: 2 tasks
**Reasoning**: Demonstrates task dependency and validation without unnecessary complexity

### Task Structure
**Task 1**: print-message
- Subagent: general
- Action: Echo message to file
- Validation: File exists and contains message
- Tools: bash, write

**Task 2**: verify-output
- Subagent: general  
- Dependencies: [print-message]
- Action: Read file and confirm message present
- Validation: Output contains expected text
- Tools: read, bash

### Variables
**Required**:
- `message`: string - The message to print

**Optional**:
- `output_file`: string - Where to save output (default: "hello-output.txt")

---

## Step 4: Creating the Template JSON

**Process**: Write JSON incrementally, validating structure as I go

**Created**: `hello-world-observed.json`

**Validation Steps Performed**:
1. ✓ JSON syntax check (`jq empty`)
2. ✓ All required top-level fields present
3. ✓ Variables defined with types and descriptions
4. ✓ Tasks have all required fields
5. ✓ Task dependencies specified correctly
6. ✓ Validation patterns use variable interpolation

---

## Step 5: Reflection - What Was Essential?

### Information Required
1. **Example templates** - Absolutely critical. Starting without examples would be impossible.
2. **Schema understanding** - Needed to know required vs optional fields
3. **Task structure patterns** - Understanding how tasks relate and depend on each other
4. **Validation patterns** - How to ensure tasks succeed

### Decision Points Encountered
1. **How many tasks?** - Chose 2 for simplicity while demonstrating dependency
2. **Which subagent?** - Chose "general" as it's most flexible
3. **What validation?** - Chose file existence and content verification
4. **Retry strategy?** - Chose "simple" for straightforward tasks
5. **Tool requirements?** - Specified bash and read as essential

### Common Mistakes I Avoided (by seeing examples)
1. ❌ Forgetting to define variables with types
2. ❌ Not specifying max_tokens for prompts
3. ❌ Missing validation fields (even if empty)
4. ❌ Not including retry configuration  
5. ❌ Forgetting metrics section
6. ❌ Not specifying tool requirements

### What Made This Successful
1. ✅ **Examined examples first** - Learned structure before creating
2. ✅ **Started simple** - 2 tasks, minimal complexity
3. ✅ **Validated incrementally** - Checked JSON syntax immediately
4. ✅ **Clear variable definitions** - Types and defaults specified
5. ✅ **Comprehensive task structure** - All required fields included

---

## Key Patterns for Template Design

### Pattern 1: Discovery-First Approach
**Observation**: I MUST search for examples before creating anything  
**Implication**: `create-activity-template` should REQUIRE example context as first step  
**Implementation**: Make `highQualityExamples` impulse REQUIRED with budget 5000-8000 tokens

### Pattern 2: Incremental Validation
**Observation**: I validated JSON syntax immediately after creation  
**Implication**: Templates should include validation checkpoints  
**Implementation**: Add validation task that runs `jq empty` and checks required fields

### Pattern 3: Task Count Sweet Spot
**Observation**: 2-3 tasks felt right for simple templates, 5-7 for complex  
**Implication**: Guidance should suggest 3-5 as optimal range  
**Implementation**: Add guidance warning against >7 tasks

### Pattern 4: Comprehensive Structure
**Observation**: Even simple templates need full structure (validation, retry, metrics, tools)  
**Implication**: Template creator should not skip "optional" fields  
**Implementation**: Prompt should explicitly list ALL required sections

### Pattern 5: Variable Documentation
**Observation**: Variables need types, descriptions, and defaults to be useful  
**Implication**: Variable definition is a critical design step  
**Implementation**: Dedicated task for variable design with examples

---

## Recommendations for `create-activity-template` V3

### Required Context Impulses
1. **highQualityExamples** (5000-8000 tokens)
   - 3+ example templates from same or similar category
   - Focus on templates with success rate > 0.75
   - Annotated with "why" this structure works

2. **schemaReference** (2000-3000 tokens) 
   - ActivityTemplate JSON schema
   - Required vs optional fields
   - Field descriptions and constraints

3. **failurePatterns** (optional, 2000-4000 tokens)
   - Common mistakes from annotations
   - MESSAGE_FOR:all about template creation failures

### Task Structure (4-5 tasks)
1. **analyze-examples** (required)
   - Study provided examples
   - Extract patterns (task count, validation strategies, etc.)
   - Output: PATTERN_ANALYSIS.md

2. **design-structure** (required)
   - Design task graph with dependencies
   - Define variables with types/defaults
   - Choose task count (3-5 recommended)
   - Output: TEMPLATE_DESIGN.md

3. **write-template** (required)
   - Create JSON following examples
   - Include ALL required fields
   - Use variable interpolation in prompts
   - Output: {template-id}.json

4. **validate-template** (required)
   - Check JSON syntax
   - Verify all required fields present
   - Validate variable references
   - Run any available schema validators
   - Output: VALIDATION_REPORT.md

5. **register-template** (optional if tools available)
   - Register with backend if available
   - Test execution with sample variables
   - Output: Registration confirmation

### Validation Gates
**After write-template**:
- ✓ JSON syntax valid (`jq empty`)
- ✓ Required fields present (script check)
- ✓ Task count 3-7
- ✓ All tasks have validation, retry, tools
- ✓ Variables have types and descriptions

**After validate-template**:
- ✓ No TODO/TBD/FIXME in template
- ✓ All variable references exist
- ✓ Dependencies form valid DAG (no cycles)
- ✓ Subagent assignments appropriate

### Retry Strategies
- **analyze-examples**: simple (2 attempts)
- **design-structure**: simple (2 attempts)
- **write-template**: progressive-context (3 attempts)
- **validate-template**: trailblazing (3 attempts) - self-healing validation failures

---

## Behavioral Insights

### What Agents Need to Succeed
1. **Examples** (non-negotiable) - Cannot create templates without seeing structure
2. **Clear guidance** - What fields are required, what values are valid
3. **Validation feedback** - Immediate feedback when structure is wrong
4. **Variable examples** - How to use {{variable}} interpolation correctly

### Common Failure Modes (anticipated)
1. **Skipping examples** → Schema violations
2. **Too many tasks** (>7) → Complexity, low reliability
3. **Missing validation** → Silent failures
4. **Undefined variables** → Runtime errors
5. **No retry config** → No recovery from transient failures

### Success Indicators
1. **Pattern extraction** - Agent studies examples and documents patterns
2. **Incremental progress** - Design → Write → Validate sequence
3. **Self-validation** - Agent checks own work before proceeding
4. **Appropriate complexity** - Task count in 3-5 range

---

## Conclusion

**Time to Create**: ~15 minutes (with examples available)  
**Key Success Factor**: Having quality examples to learn from  
**Most Important Step**: Analyzing examples before starting

**Template Quality**: High - includes all required fields, follows patterns, validated

**Next Steps**:
1. Use these observations to create `create-activity-template-v3.json`
2. Include required context impulses (highQualityExamples, schemaReference)
3. Implement 4-5 task structure with validation gates
4. Test with varied scenarios (simple, complex, vague requirements)

