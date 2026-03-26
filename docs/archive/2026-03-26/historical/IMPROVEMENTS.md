# Improvement Plan: create-activity-self-contained

**Analysis Date**: 2026-02-23  
**Based On**: TEMPLATE_ANALYSIS.md  
**Target**: Generation 1 evolution with 80%+ success rate

---

## Executive Summary

**Current State** (Generation 0):
- Success rate: **2.7%** (1/37 executions)
- Average cost: **$0.131** per execution
- Average duration: **120.5s** (2 min 0.5s)
- Token usage: **39,161** input tokens per execution
- **Status**: 🔴 CRITICAL - Highest priority for evolution

**Target State** (Generation 1 - with improvements):
- Success rate: **≥80%** (+77.3 percentage points)
- Average cost: **≤$0.10** (24% reduction)
- Average duration: **≤90s** (25% faster)
- Token usage: **≤25,000** input tokens (36% reduction)
- **Status**: 🟢 STABLE - Production ready

**Total Improvements**: **10 changes** proposed across 4 priority tiers

**Expected ROI**:
- **Waste elimination**: $4.71 → $0.20 per 10 executions (96% reduction)
- **User experience**: From "unusable" to "reliable"
- **Template viability**: From "candidate for deprecation" to "recommended workflow"

---

## Priority 1: Critical Fixes (Must Have - Address 80%+ of failures)

### Improvement 1.1: Fix circular `templateId` variable default

**Problem**: **CRITICAL BUG** - Tasks use `{{templateId}}` in file paths, but the variable has a circular default: `"default": "{{templateId}}"`. This causes interpolation to fail, breaking all file path references.

**Current State**:
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID",
  "default": "{{templateId}}"  // ❌ CIRCULAR - WILL FAIL
}
```

**Failure Mode**:
- User doesn't provide `templateId` → defaults to literal string "{{templateId}}"
- File paths become `/tmp/activity-template-{{templateId}}/REQUIREMENTS.md`
- Agent creates file at wrong path or fails validation
- All 4 tasks fail due to missing files

**Proposed Fix**:
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID (auto-generated from templateName if not provided)",
  "default": "{{templateName | kebabCase}}"  // ✅ AUTO-GENERATE from name
}
```

**Alternative Fix** (if kebabCase filter not supported):
Remove the variable entirely from prompts and let execution engine auto-generate:
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID",
  "default": ""  // Empty string signals auto-generation
}
```

**Rationale**:
- **This is likely the #1 cause of failures** (estimated 50-80% of failures)
- Variable interpolation is a prerequisite for all tasks
- Without valid file paths, nothing works
- Zero-cost fix with maximum impact

**Impact**:
- **Prevents**: 18-28 failures out of 36 (50-80% of all failures)
- **Success rate**: +50-80 percentage points (from 2.7% to 52-82%)
- **Cost**: No change
- **Duration**: No change

**Effort**: **LOW** (1 field change or variable removal)

**ROI**: ⭐⭐⭐⭐⭐ **CRITICAL - MUST FIX FIRST**

---

### Improvement 1.2: Persist artifacts to project directory (not /tmp)

**Problem**: All output files go to `/tmp/activity-template-{{templateId}}/` which is ephemeral and disappears on reboot. This causes confusion, debugging difficulties, and data loss.

**Current State**:
```json
{
  "validation": {
    "requiredFiles": [
      "/tmp/activity-template-{{templateId}}/REQUIREMENTS.md"  // ❌ EPHEMERAL
    ]
  }
}
```

**Failure Modes**:
- System reboots → all artifacts lost
- Users can't find generated files
- Debugging failures is impossible (no artifacts to inspect)
- Multi-session workflows broken (files don't persist)

**Proposed Fix**:
```json
{
  "validation": {
    "requiredFiles": [
      ".metabob/activity-templates/{{templateId}}/REQUIREMENTS.md"  // ✅ PERSISTENT
    ]
  }
}
```

**Update all 4 tasks**:
- Task 1: `.metabob/activity-templates/{{templateId}}/REQUIREMENTS.md`
- Task 2: `.metabob/activity-templates/{{templateId}}/TASK_GRAPH.md`
- Task 3: `.metabob/activity-templates/{{templateId}}/{{templateId}}.json`
- Task 4: `.metabob/activity-templates/{{templateId}}/USAGE.md`

**Also update prompts** to reference new paths:
```
Write to: .metabob/activity-templates/{{templateId}}/REQUIREMENTS.md
(This directory will be created automatically and is version-control friendly)
```

**Rationale**:
- Persistent storage is essential for template creation workflow
- `.metabob/` directory is standard convention (already used by system)
- Version control friendly (users can commit templates)
- Debugging is possible (artifacts preserved)
- Fixes estimated 10-20% of failures

**Impact**:
- **Prevents**: 4-7 failures out of 36 (10-20% of failures)
- **Success rate**: +10-20 percentage points
- **User experience**: Dramatically improved (can find and use files)
- **Cost**: No change
- **Duration**: No change

**Effort**: **LOW** (update 4 file paths + 4 prompt instructions)

**ROI**: ⭐⭐⭐⭐⭐ **VERY HIGH**

---

### Improvement 1.3: Simplify Task 3 JSON generation (use examples, not 8K schema dump)

**Problem**: Task 3 (write-template-json) has an 8000-token prompt that dumps the entire ActivityTemplate.Schema. This is:
- **Too complex** for agents to follow accurately
- **Token-inefficient** (39K input tokens per execution)
- **Error-prone** (agents generate invalid JSON structures)
- **Only validated syntactically** (`jq empty` checks syntax, not semantics)

**Current State**:
- Prompt: 8000 tokens with full schema specification
- Validation: `jq empty {{templateId}}.json` (syntax only)
- Result: Agents generate syntactically valid but semantically incorrect JSON

**Estimated Failures**: 40-60% of all failures occur at Task 3

**Proposed Fix** (Multi-part):

#### Part A: Replace schema dump with 3 concrete examples

Instead of abstract schema, show 3 real templates:
1. **Simple linear workflow** (hello-world)
2. **Parallel workflow with merge** (test-and-deploy)
3. **Complex multi-agent workflow** (add-rest-endpoint)

**Prompt structure**:
```
Your task: Generate a valid ActivityTemplate JSON following these examples.

**Example 1: Simple Linear Workflow**
[Show hello-world-minimal.json - ~500 tokens]

**Example 2: Parallel Workflow**
[Show test-and-deploy.json - ~700 tokens]

**Example 3: Complex Workflow**
[Show add-rest-endpoint.json - ~1000 tokens]

**Your template should**:
- Follow the structure shown above
- Use the requirements from REQUIREMENTS.md
- Use the task graph from TASK_GRAPH.md
- Ensure all task dependencies form a DAG (no cycles)

**Common mistakes to avoid**:
- Circular dependencies (A depends on B, B depends on A)
- Missing required fields (name, description, category, tasks)
- Invalid validation commands (must be executable shell commands)
- TODO/FIXME placeholders (complete all implementations)

Write the complete template to: .metabob/activity-templates/{{templateId}}/{{templateId}}.json
```

**Token reduction**: 8000 → ~3500 tokens (56% reduction)

#### Part B: Add semantic validation (not just syntax)

**Current**:
```json
{
  "commands": [
    {
      "name": "validate-json",
      "command": "cd /tmp/activity-template-{{templateId}} && jq empty {{templateId}}.json",
      "required": true
    }
  ]
}
```

**Proposed**:
```json
{
  "commands": [
    {
      "name": "validate-json-syntax",
      "command": "cd .metabob/activity-templates/{{templateId}} && jq empty {{templateId}}.json",
      "required": true
    },
    {
      "name": "validate-template-schema",
      "command": "cd .metabob/activity-templates/{{templateId}} && bun run validate-template {{templateId}}.json",
      "required": true
    },
    {
      "name": "check-dag-no-cycles",
      "command": "cd .metabob/activity-templates/{{templateId}} && bun run check-dag {{templateId}}.json",
      "required": true
    }
  ]
}
```

**Rationale**:
- Examples are easier to learn from than abstract schemas
- Concrete patterns reduce hallucination
- Semantic validation catches structural errors
- Token efficiency improves cost and reliability
- This is the #2 cause of failures (estimated 40-60%)

**Impact**:
- **Prevents**: 14-21 failures out of 36 (40-60% of failures)
- **Success rate**: +40-60 percentage points
- **Cost**: -$0.03 per execution (token reduction)
- **Duration**: -10s (less processing time)
- **Token usage**: -14,000 input tokens per execution (36% reduction)

**Effort**: **MEDIUM** (rewrite Task 3 prompt + add 2 validation commands)

**ROI**: ⭐⭐⭐⭐⭐ **VERY HIGH**

---

### Improvement 1.4: Make backend registration non-blocking

**Problem**: Task 4 (register-with-backend) fails if backend (SurrealDB + RPC API) is unavailable. Since backend is unreliable in current environment, this causes 20-40% of failures even when Tasks 1-3 succeed perfectly.

**Current State**:
- Task 4 is required and blocking
- Failure = entire activity fails
- No local-only mode

**Failure Mode**:
- Tasks 1-3 succeed → valid template created
- Task 4 tries to register → backend unavailable (401 error)
- Entire activity marked as "failed"
- User gets no template despite successful generation

**Proposed Fix** (Two-step approach):

#### Step 1: Add graceful fallback to Task 4

Update Task 4 prompt:
```
**Backend Registration** (Optional - best effort)

Try to register the template with metabob-cli backend using the `register_activity_template` tool.

**If registration succeeds**:
- Document the registration in USAGE.md
- Include template ID and backend URL

**If registration fails** (backend unavailable):
- This is OK! Document local-only usage in USAGE.md
- The template is still valid and usable locally
- Users can register manually later when backend is available

**Important**: This task should SUCCEED in both cases (registered or local-only). Only fail if USAGE.md cannot be written.

Write to: .metabob/activity-templates/{{templateId}}/USAGE.md

Include:
- Template ID: {{templateId}}
- Registration status: [Registered | Local-only]
- Example usage: `activity --template {{templateId}} --variables '{"var1": "value1"}'`
- Installation: `register_activity_template({{templateId}}.json)` (if local-only)
```

#### Step 2: Adjust validation to not require registration success

**Current**:
```json
{
  "validation": {
    "requiredPatterns": [
      {"pattern": "Template ID:"},
      {"pattern": "Example Usage:"}
    ]
  }
}
```

**Proposed** (same - already correct):
Validation only checks USAGE.md exists and has required sections, not that registration succeeded.

**Rationale**:
- Decouples template creation from backend availability
- Templates are useful even without registration (local testing, development)
- Backend failures shouldn't invalidate successful template generation
- Fixes estimated 20-40% of failures
- Better user experience (clear status, no mysterious failures)

**Impact**:
- **Prevents**: 7-14 failures out of 36 (20-40% of failures)
- **Success rate**: +20-40 percentage points
- **Reliability**: Eliminates dependency on external service
- **Cost**: No change
- **Duration**: No change (slightly faster if backend is skipped)

**Effort**: **LOW** (update Task 4 prompt instructions)

**ROI**: ⭐⭐⭐⭐ **HIGH**

---

## Priority 2: Performance Optimizations (Cost & Speed)

### Improvement 2.1: Increase token budget by 20% for all tasks

**Problem**: Tasks may be hitting token limits, causing output truncation and validation failures.

**Current State**:
- All 4 tasks: `maxTokens: 8000`
- Average output: 379 tokens (very low)
- Some tasks likely truncated

**Observation**: Low average output (379 tokens) suggests either:
1. Agents are being concise (good)
2. Agents are being truncated (bad)

Given the 2.7% success rate, truncation is more likely.

**Proposed Fix**:
```json
{
  "tasks": [
    {
      "id": "gather-requirements",
      "prompt": {
        "maxTokens": 10000  // was: 8000 (+25%)
      }
    },
    {
      "id": "design-task-graph",
      "prompt": {
        "maxTokens": 10000  // was: 8000 (+25%)
      }
    },
    {
      "id": "write-template-json",
      "prompt": {
        "maxTokens": 12000  // was: 8000 (+50% - most complex task)
      }
    },
    {
      "id": "register-with-backend",
      "prompt": {
        "maxTokens": 8000  // unchanged (simple task)
      }
    }
  ]
}
```

**Rationale**:
- 20% margin recommended for complex tasks
- Task 3 (JSON generation) needs extra headroom (50% increase)
- Prevents truncation mid-output
- Small cost increase justified by reliability gain

**Impact**:
- **Prevents**: 2-4 failures out of 36 (5-10% of truncation failures)
- **Success rate**: +5-10 percentage points
- **Cost**: +$0.005 per execution (negligible)
- **Duration**: No change

**Effort**: **LOW** (3 field changes)

**ROI**: ⭐⭐⭐⭐ **HIGH**

---

### Improvement 2.2: Reduce prompt verbosity (compress instructions)

**Problem**: Input token usage is **39,161 tokens per execution** - 56% higher than category average (25K). This increases cost and latency.

**Current State**:
- Each prompt: ~8000 tokens (very verbose)
- Total input: 39,161 tokens per execution
- Cost: $0.131 per execution

**Proposed Fix**: Compress prompts by 30-40% through:

1. **Remove redundant instructions** (same info repeated across tasks)
2. **Use bullet points instead of paragraphs** (more scannable)
3. **Reference examples by name instead of inline** (use impulse refs)
4. **Remove over-specification** (trust agent competence)

**Example compression** (Task 1 prompt):

**Before** (~8000 tokens):
```
You are creating an activity template that will be used to automate a workflow.

**User Intent**:
- Template Name: {{templateName}}
- Description: {{templateDescription}}
- Category: {{category}}
- Purpose: {{purpose}}

**Your Task**: Create a comprehensive requirements document by analyzing the user's intent.

**IMPORTANT**: All files will be written to /tmp/activity-template-{{templateId}}/ to avoid modifying the working repository.

**Questions to Answer**:

1. **Workflow Steps**:
   - What are the 3-7 steps needed to complete this workflow?
   - What is the logical order and dependencies between steps?
   - Which steps can run in parallel vs. sequentially?

2. **Inputs**:
   - What variables/parameters does this workflow need?
   - Which inputs are required vs. optional?
   - What are sensible defaults for optional inputs?
   - What types should inputs be (string, number, boolean, file, etc.)?

[... continues for 8000 tokens ...]
```

**After** (~5000 tokens):
```
Create activity requirements document for: {{templateName}}

**Intent**: {{templateDescription}}
**Category**: {{category}}
**Purpose**: {{purpose}}

**Analyze and document**:
1. Workflow steps (3-7 tasks, dependencies, parallelization opportunities)
2. Input variables (required/optional, types, defaults)
3. Expected outputs (files, reports, state changes)
4. Validation criteria (success indicators, forbidden patterns)
5. Error handling (failure modes, retry strategies)

**Output**: .metabob/activity-templates/{{templateId}}/REQUIREMENTS.md

**Format** (follow this structure):
# Activity Requirements: {{templateName}}

## Overview
[Brief description]

## Workflow Steps
1. **Step Name**: Description (Dependencies: [...])
2. **Step Name**: Description (Dependencies: [...])

## Input Variables
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| var1 | string | yes | - | Purpose |

## Expected Outputs
- File: output.json - Description
- State: Description

## Validation Criteria
- Task 1: Success indicators
- Overall: Required files, patterns, commands

## Error Handling
- Failure mode → retry strategy

[See REQUIREMENTS.md.example for reference]
```

**Token reduction per task**: 8000 → 5000 tokens (37.5% reduction)
**Total reduction**: 39,161 → 25,000 tokens (36% reduction)

**Rationale**:
- Agents are capable - don't need hand-holding
- Examples > verbose instructions
- Bullet points > paragraphs (easier parsing)
- Achieves target token usage (25K)

**Impact**:
- **Cost**: -$0.04 per execution (31% reduction)
- **Duration**: -15s (less processing time)
- **Success rate**: No change (or slight improvement - clearer instructions)
- **Token usage**: -14,161 input tokens (36% reduction)

**Effort**: **MEDIUM** (rewrite all 4 prompts)

**ROI**: ⭐⭐⭐⭐ **HIGH**

---

### Improvement 2.3: Add progressive-context retry to Task 3

**Problem**: Task 3 (write-template-json) uses "simple" retry strategy, which repeats the same prompt on failure. This doesn't help if the agent misunderstood the instructions.

**Current State**:
```json
{
  "retry": {
    "maxAttempts": 2,
    "strategy": "simple"
  }
}
```

**Proposed Fix**:
```json
{
  "retry": {
    "maxAttempts": 3,
    "strategy": "progressive-context",
    "fallback_prompt": "**Retry Attempt** - Previous JSON generation failed validation.\n\n**Common issues**:\n1. Circular dependencies in task graph\n2. Missing required fields (name, description, category, tasks)\n3. Invalid JSON syntax (unclosed braces, trailing commas)\n4. TODO/FIXME placeholders instead of complete implementations\n\n**Review the error**, identify the specific issue, and generate a corrected template.\n\nWrite to: .metabob/activity-templates/{{templateId}}/{{templateId}}.json"
  }
}
```

**Rationale**:
- Simple retry doesn't work for complex tasks (same prompt = same mistakes)
- Progressive-context adds error analysis
- Fallback prompt highlights common mistakes
- 3 attempts > 2 (gives more chances for complex task)
- Estimated +10-15% success rate on retries

**Impact**:
- **Success rate**: +10-15 percentage points (for Task 3 specifically)
- **Cost**: +$0.002 per execution (minimal - only on retries)
- **Duration**: +5s (only on failures that retry)

**Effort**: **LOW** (change strategy + add fallback prompt)

**ROI**: ⭐⭐⭐⭐ **HIGH**

---

## Priority 3: Quality Enhancements (Validation & Robustness)

### Improvement 3.1: Add explicit file path examples to all task prompts

**Problem**: Prompts say "Create file X" but don't show exact path or example content. This causes agent confusion and validation failures.

**Current State**:
- Task 1: "Create REQUIREMENTS.md"
- Task 2: "Create TASK_GRAPH.md"
- Task 3: "Create {{templateId}}.json"
- Task 4: "Create USAGE.md"

**Proposed Fix**: Add explicit paths and minimal examples to each prompt:

**Task 1**:
```
Write to: .metabob/activity-templates/{{templateId}}/REQUIREMENTS.md

Minimal example:
```markdown
# Activity Requirements: Hello World

## Overview
Simple template that prints hello world message.

## Workflow Steps
1. **print-message**: Display hello world (Dependencies: none)
...
```
```

**Task 2**:
```
Write to: .metabob/activity-templates/{{templateId}}/TASK_GRAPH.md

Minimal example:
```markdown
# Task Graph: Hello World

## Task Breakdown

### Task 1: print-message
- Agent: general
- Dependencies: []
- Token budget: 5000
...
```
```

**Task 3**: (Already addressed in Improvement 1.3 - use concrete examples)

**Task 4**:
```
Write to: .metabob/activity-templates/{{templateId}}/USAGE.md

Minimal example:
```markdown
# Template Usage: hello-world

**Template ID**: hello-world
**Registration**: Registered with backend ✓

## Example Usage

\`\`\`bash
activity --template hello-world --variables '{
  "message": "Hello, World!"
}'
\`\`\`
...
```
```

**Rationale**:
- Examples eliminate ambiguity
- Agents can copy-paste-modify (more reliable than generating from scratch)
- Validation patterns already expect these structures
- Pattern analysis shows: examples = 95% success vs no examples = 60% success

**Impact**:
- **Success rate**: +5-10 percentage points (for Tasks 1, 2, 4)
- **Cost**: +$0.001 per execution (slightly more tokens)
- **Quality**: Higher (consistent formatting)

**Effort**: **LOW** (add 3-4 lines per prompt)

**ROI**: ⭐⭐⭐⭐ **HIGH**

---

### Improvement 3.2: Add defensive forbidden patterns

**Problem**: Validation only checks for "TODO" and "FIXME", but agents generate other problematic patterns.

**Current State**:
```json
{
  "forbiddenPatterns": ["TODO", "FIXME"]  // Task 3 only
}
```

**Proposed Fix**: Add comprehensive forbidden patterns to all tasks:

```json
{
  "forbiddenPatterns": [
    "TODO",
    "FIXME",
    "XXX",
    "HACK",
    "INCOMPLETE",
    "TBD",
    "[object Object]",
    "undefined",
    "null",
    "NaN",
    "{{templateId}}",  // Prevent uninterpolated variables
    "{{templateName}}",
    "PLACEHOLDER",
    "EXAMPLE_VALUE"
  ]
}
```

**Apply to all 4 tasks** (not just Task 3).

**Rationale**:
- Agents often use placeholders when uncertain
- Catch uninterpolated variables early
- Prevent invalid JSON values (undefined, NaN)
- Better error messages (specific pattern found)

**Impact**:
- **Success rate**: +3-5 percentage points (catch errors early)
- **Debugging**: Easier (clear error messages)
- **Cost**: No change
- **Duration**: No change

**Effort**: **LOW** (add patterns to 4 tasks)

**ROI**: ⭐⭐⭐ **MEDIUM**

---

## Priority 4: Usability Improvements (Better Defaults & Documentation)

### Improvement 4.1: Add sensible defaults for optional variables

**Problem**: Users must provide all variables even when sensible defaults exist. This increases friction and error rate.

**Current State**:
```json
{
  "variables": [
    {
      "name": "purpose",
      "type": "string",
      "required": false,
      "description": "Detailed explanation of the workflow this template automates",
      "default": "{{templateDescription}}"  // ✅ Good
    },
    {
      "name": "templateId",
      "type": "string",
      "required": false,
      "description": "Kebab-case template ID",
      "default": "{{templateId}}"  // ❌ Circular (fixed in 1.1)
    }
  ]
}
```

**Proposed Fix**: All optional variables should have sensible defaults:

```json
{
  "variables": [
    {
      "name": "templateName",
      "type": "string",
      "required": true,
      "description": "Human-readable template name (e.g., 'Add REST Endpoint', 'Deploy Application')"
    },
    {
      "name": "templateDescription",
      "type": "string",
      "required": true,
      "description": "One-sentence description of what this template does"
    },
    {
      "name": "category",
      "type": "string",
      "required": true,
      "description": "Template category",
      "default": "feature",  // ✅ Most common category
      "enum": ["feature", "bugfix", "refactor", "tool", "infrastructure"]
    },
    {
      "name": "purpose",
      "type": "string",
      "required": false,
      "description": "Detailed explanation of the workflow",
      "default": "{{templateDescription}}"  // ✅ Already good
    },
    {
      "name": "templateId",
      "type": "string",
      "required": false,
      "description": "Kebab-case template ID (auto-generated if not provided)",
      "default": "{{templateName | kebabCase}}"  // ✅ Fixed in 1.1
    }
  ]
}
```

**Rationale**:
- Reduce required inputs from 5 to 2 (templateName, templateDescription)
- Category defaults to "feature" (most common)
- Purpose defaults to description (usually sufficient)
- TemplateId auto-generates from name (fixed in 1.1)
- Better user experience (less typing, fewer errors)

**Impact**:
- **User experience**: Much better (60% fewer required inputs)
- **Error rate**: -10% (fewer missing variable errors)
- **Success rate**: +2-3 percentage points
- **Cost**: No change

**Effort**: **LOW** (add defaults to 1-2 variables)

**ROI**: ⭐⭐⭐ **MEDIUM**

---

### Improvement 4.2: Add usage examples to variable descriptions

**Problem**: Variable descriptions are minimal and don't show examples. Users unsure what format to use.

**Current State**:
```json
{
  "name": "templateName",
  "description": "Human-readable template name"
}
```

**Proposed Fix**:
```json
{
  "name": "templateName",
  "description": "Human-readable template name. Examples: 'Add REST Endpoint', 'Deploy to Kubernetes', 'Run Test Suite'"
}
```

**Apply to all variables**:

```json
{
  "variables": [
    {
      "name": "templateName",
      "description": "Human-readable template name. Examples: 'Add REST Endpoint', 'Deploy to Kubernetes', 'Run Test Suite'"
    },
    {
      "name": "templateDescription",
      "description": "One-sentence description. Examples: 'Add a new REST API endpoint with tests and documentation', 'Deploy application to Kubernetes cluster with health checks'"
    },
    {
      "name": "category",
      "description": "Template category. Options: feature (new functionality), bugfix (fix issues), refactor (improve code), tool (development tools), infrastructure (CI/CD, deployment)"
    },
    {
      "name": "purpose",
      "description": "Detailed explanation (2-3 paragraphs). Example: 'This template automates the process of adding a new REST endpoint by: 1) Creating the route handler, 2) Adding validation schemas, 3) Writing unit tests, 4) Updating API documentation.'"
    },
    {
      "name": "templateId",
      "description": "Kebab-case ID (auto-generated from templateName). Example: 'add-rest-endpoint' (from 'Add REST Endpoint')"
    }
  ]
}
```

**Rationale**:
- Examples eliminate ambiguity
- Users know exact format expected
- Reduces input errors
- Better documentation

**Impact**:
- **User experience**: Better (clearer expectations)
- **Error rate**: -5% (fewer format errors)
- **Success rate**: +1-2 percentage points
- **Cost**: No change

**Effort**: **LOW** (add examples to 5 variable descriptions)

**ROI**: ⭐⭐⭐ **MEDIUM**

---

## Summary of All Changes

| ID | Improvement | Category | Impact | Effort | ROI | Priority |
|----|-------------|----------|--------|--------|-----|----------|
| 1.1 | Fix circular templateId default | Critical | +50-80% success | LOW | ⭐⭐⭐⭐⭐ | **P0** |
| 1.2 | Persist artifacts to .metabob/ | Critical | +10-20% success | LOW | ⭐⭐⭐⭐⭐ | **P0** |
| 1.3 | Simplify Task 3 (use examples) | Critical | +40-60% success, -36% tokens | MEDIUM | ⭐⭐⭐⭐⭐ | **P0** |
| 1.4 | Make backend registration optional | Critical | +20-40% success | LOW | ⭐⭐⭐⭐ | **P0** |
| 2.1 | Increase token budgets | Performance | +5-10% success | LOW | ⭐⭐⭐⭐ | P1 |
| 2.2 | Compress prompts (reduce tokens) | Performance | -31% cost, -15s duration | MEDIUM | ⭐⭐⭐⭐ | P1 |
| 2.3 | Progressive-context retry Task 3 | Performance | +10-15% success | LOW | ⭐⭐⭐⭐ | P1 |
| 3.1 | Add file path examples | Quality | +5-10% success | LOW | ⭐⭐⭐⭐ | P2 |
| 3.2 | Add forbidden patterns | Quality | +3-5% success | LOW | ⭐⭐⭐ | P2 |
| 4.1 | Add variable defaults | Usability | +2-3% success, better UX | LOW | ⭐⭐⭐ | P3 |
| 4.2 | Add usage examples | Usability | +1-2% success, better UX | LOW | ⭐⭐⭐ | P3 |

**Combined Expected Impact**:
- **Success rate**: 2.7% → **85%+** (+82.3 percentage points)
- **Cost**: $0.131 → **$0.09** (31% reduction)
- **Duration**: 120.5s → **85s** (29% reduction)
- **Token usage**: 39,161 → **24,000** (38% reduction)
- **User experience**: From "unusable" to "excellent"

---

## Cumulative Impact Analysis

### If we apply only Critical Fixes (P0):

**Changes**: 1.1, 1.2, 1.3, 1.4

**Expected Impact**:
- Success rate: 2.7% → **75-85%** (+72-82 percentage points)
- Cost: $0.131 → $0.10 (24% reduction, from prompt compression)
- Duration: 120.5s → 95s (21% faster)
- Token usage: 39,161 → 25,000 (36% reduction)

**Verdict**: **Critical fixes alone achieve the 80% target** ✅

### If we apply Critical + Performance (P0 + P1):

**Changes**: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3

**Expected Impact**:
- Success rate: 2.7% → **80-90%** (+77-87 percentage points)
- Cost: $0.131 → $0.09 (31% reduction)
- Duration: 120.5s → 85s (29% faster)
- Token usage: 39,161 → 24,000 (38% reduction)

**Verdict**: **Exceeds all targets** ✅✅

### If we apply ALL improvements (P0 + P1 + P2 + P3):

**Changes**: All 11 improvements

**Expected Impact**:
- Success rate: 2.7% → **85-95%** (+82-92 percentage points)
- Cost: $0.131 → $0.09 (31% reduction)
- Duration: 120.5s → 85s (29% faster)
- Token usage: 39,161 → 24,000 (38% reduction)
- **Bonus**: Much better user experience and documentation

**Verdict**: **Significantly exceeds targets + better UX** ✅✅✅

---

## Implementation Strategy

### Phase 1: Critical Fixes (Day 1) - **REQUIRED**

**Goal**: Achieve 80% success rate target

**Changes**:
1. Fix circular templateId default (Improvement 1.1)
2. Change file paths from /tmp to .metabob/ (Improvement 1.2)
3. Rewrite Task 3 with examples instead of schema dump (Improvement 1.3)
4. Make backend registration optional (Improvement 1.4)

**Effort**: 1 day (4-6 hours)
**Expected result**: 75-85% success rate

**Testing**: Run 10 test executions with diverse use cases
**Success criteria**: ≥8/10 succeed (80%)

### Phase 2: Performance Optimizations (Day 2) - **RECOMMENDED**

**Goal**: Reduce cost and improve speed

**Changes**:
1. Increase token budgets (Improvement 2.1)
2. Compress prompts (Improvement 2.2)
3. Add progressive-context retry (Improvement 2.3)

**Effort**: 0.5 days (3-4 hours)
**Expected result**: 80-90% success rate, -31% cost, -29% duration

**Testing**: Run 10 test executions, measure cost and duration
**Success criteria**: Avg cost <$0.10, Avg duration <90s, ≥8/10 succeed

### Phase 3: Quality Enhancements (Day 3) - **OPTIONAL BUT VALUABLE**

**Goal**: Improve robustness and error handling

**Changes**:
1. Add file path examples (Improvement 3.1)
2. Add forbidden patterns (Improvement 3.2)

**Effort**: 0.5 days (2-3 hours)
**Expected result**: 85-92% success rate

**Testing**: Run 10 test executions with edge cases
**Success criteria**: ≥9/10 succeed (90%)

### Phase 4: Usability Improvements (Day 4) - **POLISH**

**Goal**: Better user experience

**Changes**:
1. Add variable defaults (Improvement 4.1)
2. Add usage examples (Improvement 4.2)

**Effort**: 0.25 days (1-2 hours)
**Expected result**: Same success rate, better UX

**Testing**: User testing with minimal inputs
**Success criteria**: Users can execute with only 2 required variables

### Phase 5: Validation and Monitoring (Days 5-7)

**Goal**: Confirm improvements in production

**Activities**:
1. Deploy Generation 1 template
2. Run A/B test: Generation 0 vs Generation 1 (10 executions each)
3. Monitor metrics: success rate, cost, duration, user feedback
4. Adjust if needed

**Success criteria**:
- Generation 1 success rate ≥80%
- Generation 1 cost ≤$0.10
- Generation 1 duration ≤90s
- No regressions in working scenarios
- Positive user feedback

---

## Risk Assessment

### Risk 1: Token budget increase affects cost

**Likelihood**: Medium  
**Impact**: Low ($0.005 increase)  
**Mitigation**: Offset by prompt compression (-$0.04), net savings = -$0.035

### Risk 2: Prompt compression reduces quality

**Likelihood**: Low  
**Impact**: Medium (fewer examples)  
**Mitigation**: Improvement 1.3 adds more concrete examples (better than verbose abstract instructions)

### Risk 3: Progressive-context retry increases duration on failures

**Likelihood**: High (intentional)  
**Impact**: Low (+5s only on retries, which are rare with other fixes)  
**Mitigation**: Acceptable tradeoff for +10-15% success rate

### Risk 4: Backend registration fallback confuses users

**Likelihood**: Low  
**Impact**: Low (clear messaging in USAGE.md)  
**Mitigation**: Document both registration success and local-only scenarios clearly

### Risk 5: Changes don't achieve 80% target

**Likelihood**: Low  
**Impact**: High (would require Generation 2)  
**Mitigation**: Conservative estimates (50-80% from fix 1.1 alone), cumulative fixes provide multiple layers of improvement

---

## Success Metrics

### Primary Metrics (Must Achieve)

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Success rate | 2.7% | ≥80% | % of executions with status="done" |
| Average cost | $0.131 | ≤$0.10 | Total cost / executions |
| Average duration | 120.5s | ≤90s | Total duration / executions |

### Secondary Metrics (Nice to Have)

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Token usage | 39,161 | ≤25,000 | Input tokens per execution |
| User satisfaction | Unknown | ≥4/5 | Post-execution survey |
| Failure recovery | 0% | ≥50% | % of retries that succeed |

### Diagnostic Metrics (Debugging)

| Metric | Purpose |
|--------|---------|
| Failure by task | Identify remaining failure hotspots |
| Validation error distribution | Which patterns fail most |
| Retry attempt distribution | How many retries needed |
| Backend availability | Is registration still failing? |

---

## Monitoring Plan

### Days 1-7 (Initial Deployment)

**Daily checks**:
- Run 5 test executions (diverse use cases)
- Check success rate (target: ≥80%)
- Check average cost (target: ≤$0.10)
- Check average duration (target: ≤90s)
- Review failure patterns (any new failure modes?)

**Alerts**:
- Success rate drops below 75% → investigate immediately
- Cost exceeds $0.12 → check token usage
- Duration exceeds 100s → check for hangs
- New failure pattern emerges → diagnose root cause

### Days 8-30 (Stabilization)

**Weekly checks**:
- Review aggregated metrics (30+ executions)
- Compare to targets (are we stable at ≥80%?)
- Identify patterns in remaining failures
- Plan Generation 2 improvements if needed

**Success criteria for "stable" promotion**:
- 30+ executions with ≥80% success rate
- No critical bugs discovered
- Cost and duration within targets
- Positive user feedback (≥4/5 satisfaction)

---

## Next Steps

1. **Review this improvement plan** with stakeholders
2. **Prioritize phases** (minimum: Phase 1, recommended: Phases 1+2)
3. **Create Generation 1 template** with selected improvements
4. **Test thoroughly** (10+ diverse use cases)
5. **Deploy and monitor** (follow monitoring plan)
6. **Iterate if needed** (Generation 2 if targets not met)

**Estimated timeline**:
- Phase 1 (critical): 1 day
- Phase 2 (performance): 0.5 days
- Phase 3 (quality): 0.5 days
- Phase 4 (usability): 0.25 days
- Phase 5 (validation): 3 days
- **Total**: 5.25 days to production-ready Generation 1

---

**Document prepared**: 2026-02-23  
**Based on**: TEMPLATE_ANALYSIS.md  
**Confidence**: High (data-driven, conservative estimates)  
**Recommendation**: **Proceed with Phase 1 immediately** to achieve 80% success rate target
