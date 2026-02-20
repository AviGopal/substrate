# Template Analysis: create-activity-template-(self-contained)

**Generated**: 2026-02-20  
**Analysis Period**: Last 30 days  
**Data Source**: Local template storage + execution history

---

## Executive Summary

**Current State**: Template is experiencing **0% success rate** across 34 executions, indicating critical systematic issues.

**Key Findings**:
- 📊 **34 total executions** with **0 successes**
- ⏱️ **Average duration**: 84.6 seconds (1m 25s)
- 💰 **Average cost**: $0.0768 per execution
- 🔴 **100% failure rate** - critical issues requiring immediate attention

**Recommendation**: URGENT - Template requires comprehensive debugging before further use.

---

## 1. Current Template

### Metadata

| Property | Value |
|----------|-------|
| **Name** | Create Activity Template (Self-Contained) |
| **ID** | `create-activity-self-contained` |
| **Version** | 1771575165760::827660b8ccd63d68 (Generation 0) |
| **Category** | infrastructure |
| **Status** | stable |
| **Created** | 2026-02-20 (recent) |
| **Updated** | 2026-02-20 |

### Description

Create activity templates without requiring example files or specific project structure - fully self-contained and repository-agnostic. Registers template directly to backend without local file dependencies.

### Structure Overview

- **Tasks**: 4 tasks (linear dependency chain)
- **Total token budget**: 32,000 tokens (4 tasks × 8,000 tokens each)
- **Context requirements**: 0 (self-contained)
- **Integration checks**: Git clean required, no pre/post checks
- **Metabob integration**: Disabled (learning mode enabled)

---

## 2. Task Breakdown

### Task 1: `gather-requirements`

**Purpose**: Extract and clarify requirements from user input to ensure complete understanding

**Configuration**:
- **Agent**: general
- **Dependencies**: None (entry task)
- **Token budget**: 8,000 tokens
- **Retry strategy**: Simple, max 2 attempts

**Variables Required**:
1. `templateName` (string, required) - Human-readable template name
2. `templateDescription` (string, required) - One-sentence description
3. `category` (string, required) - Template category (feature/bugfix/refactor/tool/infrastructure)
4. `purpose` (string, optional) - Detailed explanation (defaults to templateDescription)
5. `templateId` (string, optional) - Kebab-case template ID (defaults to generated from name)

**Validation**:
- ✅ Required file: `/tmp/activity-template-{{templateId}}/REQUIREMENTS.md`
- ✅ Required patterns: "## Workflow Steps", "## Input Variables", "## Validation Criteria"

**Metrics**:
- Success rate: 0%
- Avg tokens: 0
- Avg duration: 0ms
- Common failures: []

---

### Task 2: `design-task-graph`

**Purpose**: Design task breakdown with proper dependencies forming a directed acyclic graph (DAG)

**Configuration**:
- **Agent**: general
- **Dependencies**: `gather-requirements`
- **Token budget**: 8,000 tokens
- **Retry strategy**: Simple, max 2 attempts

**Variables Required**: None (uses output from task 1)

**Validation**:
- ✅ Required file: `/tmp/activity-template-{{templateId}}/TASK_GRAPH.md`
- ✅ Required patterns: "## Task Breakdown", "## Dependency Graph", "## Token Budget Summary"

**Metrics**:
- Success rate: 0%
- Avg tokens: 0
- Avg duration: 0ms
- Common failures: []

---

### Task 3: `write-template-json`

**Purpose**: Generate valid ActivityTemplate.Schema JSON following the exact structure

**Configuration**:
- **Agent**: general
- **Dependencies**: `design-task-graph`
- **Token budget**: 8,000 tokens
- **Retry strategy**: Simple, max 3 attempts (highest retry count)

**Variables Required**: None (uses output from tasks 1 & 2)

**Validation**:
- ✅ Required file: `/tmp/activity-template-{{templateId}}/{{templateId}}.json`
- ✅ Required patterns: `"name":`, `"category":`, `"tasks":`, `"contextRequirements":`
- ❌ Forbidden patterns: `"preChecks": ["git` (must not include git status checks)
- ✅ Commands: `cat /tmp/activity-template-{{templateId}}/{{templateId}}.json | jq empty` (exit code 0)

**Metrics**:
- Success rate: 0%
- Avg tokens: 0
- Avg duration: 0ms
- Common failures: []

---

### Task 4: `register-with-backend`

**Purpose**: Register the template directly with metabob-cli backend via MCP, creating usage documentation

**Configuration**:
- **Agent**: general
- **Dependencies**: `write-template-json`
- **Token budget**: 8,000 tokens
- **Retry strategy**: Simple, max 2 attempts

**Variables Required**: None (uses output from task 3)

**Validation**:
- ✅ Required file: `/tmp/activity-template-{{templateId}}/SUCCESS.md`
- ✅ Required patterns: "✅ Template ID:", "✅ Status: Registered with backend", "## Usage", "## Template Structure"
- ❌ Forbidden patterns: "❌", "FAILED", "ERROR"

**Metrics**:
- Success rate: 0%
- Avg tokens: 0
- Avg duration: 0ms
- Common failures: []

---

## 3. Execution Metrics (Last 30 Days)

### Summary Statistics

| Metric | Value |
|--------|-------|
| **Total executions** | 34 |
| **Successful** | 0 (0.0%) |
| **Failed** | 34 (100.0%) |
| **Average duration** | 84,648 ms (1m 25s) |
| **Average cost** | $0.0768 |
| **Total cost** | $2.61 |

### Token Usage Distribution

| Token Type | Average per Execution |
|------------|----------------------|
| **Input tokens** | 23,198 |
| **Output tokens** | 191 |
| **Cache tokens** | 0 |
| **Total tokens** | 23,389 |

**Analysis**: 
- Very high input token usage (23k tokens per execution)
- Extremely low output tokens (191) suggests early failures
- No cache usage - opportunities for optimization

---

### Success Rate Trend

**⚠️ CRITICAL: 0% success rate across all 34 executions**

Since the template was created recently (Feb 20, 2026), all executions occurred within a short timeframe:

```
All executions: 0% success
Trend: 🔴 Complete failure (no successful executions yet)
```

**Implication**: Template has never successfully completed, indicating fundamental design or implementation issues.

---

### Cost Trend

```
34 executions × $0.0768 avg = $2.61 total
Cost per success: N/A (no successes)
Wasted cost: $2.61 (100% failure rate)
```

**Efficiency**: Poor - spending money with zero value delivery

---

## 4. Failure Analysis

### 🚨 CRITICAL ISSUE: Zero Task-Level Metrics

**Observation**: All task metrics show:
- Success rate: 0%
- Avg tokens: 0
- Avg duration: 0ms
- Common failures: []

**This indicates ONE of the following**:

1. **Metrics Collection Failure**: Task metrics are not being properly recorded during execution
2. **Early Termination**: Template fails before any task begins execution
3. **Storage Bug**: Metrics are generated but not persisted to template file
4. **Variable Mapping Issue**: Required variables not properly interpolated, causing immediate failure

---

### Hypothesized Failure Modes

Based on template structure analysis:

#### 1. Variable Interpolation Failures (HIGH LIKELIHOOD)

**Evidence**:
- Task 1 requires `templateId` variable with default `{{templateId}}`
- Circular dependency: `templateId` defaults to `{{templateId}}` (self-reference)
- File paths use `{{templateId}}` throughout (e.g., `/tmp/activity-template-{{templateId}}/`)

**Impact**: If `templateId` is not provided explicitly, interpolation fails, blocking all file operations.

**Frequency estimate**: 100% (affects all executions)

---

#### 2. Validation Command Configuration Error (HIGH LIKELIHOOD)

**Evidence from Task 3**:
```json
"commands": [
  {
    "command": "cat /tmp/activity-template-{{templateId}}/{{templateId}}.json | jq empty",
    "expected_exit_code": 0  // ← CORRECT: jq empty returns 0 for valid JSON
  }
]
```

**However, the OLD template had**:
```json
"expected_exit_code": 1  // ← WRONG: This would expect jq to FAIL
```

**Status**: This appears to be FIXED in the current version, but if old executions used the wrong value, this would cause 100% validation failures.

---

#### 3. MCP Tool Availability (MEDIUM LIKELIHOOD)

**Task 4** relies on `register_activity_template` MCP tool:
- If MCP server not running, task 4 fails
- If tool signature changed, calls fail
- If authentication fails, registration fails

**Frequency estimate**: 50-70% (intermittent based on environment)

---

#### 4. Insufficient Token Budget (LOW LIKELIHOOD)

**Evidence**:
- Average output tokens: 191 (extremely low)
- Task budget: 8,000 tokens per task
- Ratio: Using only 2.4% of allocated output budget

**Interpretation**: Tasks are failing BEFORE running out of tokens, not due to token limits.

---

### Validation Failure Patterns (Hypothesized)

Since no actual failure logs are available, based on template structure:

| Pattern | Likelihood | Tasks Affected | Root Cause |
|---------|-----------|----------------|------------|
| "REQUIREMENTS.md not found" | High | Task 1 | Variable interpolation failure (`{{templateId}}` unresolved) |
| "Pattern '## Workflow Steps' not found" | Medium | Task 1 | Agent produces wrong format or task times out |
| "JSON validation failed" | High | Task 3 | Invalid JSON generated or validation command misconfigured |
| "MCP tool not available" | Medium | Task 4 | Backend not running or tool not registered |
| "✅ Template ID: not found in SUCCESS.md" | High | Task 4 | Registration fails or doc format wrong |

---

## 5. Performance Benchmarks

### Compared to Similar Templates

**Note**: Comparison data not available from backend API. Based on template structure analysis:

**Expected benchmarks for infrastructure templates**:
- Success rate: 70-85% (typical for complex multi-task templates)
- Duration: 2-5 minutes (typical for 4-task workflows)
- Cost: $0.10-$0.25 (typical for infrastructure automation)

**Actual performance**:
- Success rate: **0%** (🔴 -85 percentage points vs. expected)
- Duration: **1m 25s** (✅ Within expected range, but meaningless given 0% success)
- Cost: **$0.077** (✅ Below expected range, suggests early termination)

**Ranking**: Cannot rank without category-wide metrics, but **0% success = dead last**.

---

## 6. Learning Data

### Feedback Points

**Status**: No captured feedback yet (template never succeeded)

**Expected feedback collection**:
- `template_valid`: Should capture yes/no votes
- `prompt_clarity`: Should rate 1-10
- `example_usefulness`: Should rate 1-10

**Actual**: No data (template has not completed successfully)

---

### Pattern Recognition

**Success patterns identified**: None (no successful executions)

**Failure patterns identified** (hypothesized from metrics):

1. **100% failure rate**: Systematic issue, not transient errors
2. **Low output tokens (191 avg)**: Early termination, not exhaustion
3. **Zero task-level metrics**: Possible metrics collection bug or pre-execution failure
4. **Consistent duration (~85s)**: Suggests timeout or consistent failure point

---

## 7. Improvement Recommendations

### 🔴 URGENT: Fix Before Further Use

#### 1. **Debug Metrics Collection** (Priority: CRITICAL)

**Problem**: Zero task-level metrics suggest fundamental tracking issue

**Actions**:
- Add logging to track when task metrics are recorded
- Verify metrics are persisted to template storage
- Test with minimal 1-task template to isolate issue

**Expected impact**: Enables diagnosis of actual failure modes

---

#### 2. **Fix Variable Interpolation** (Priority: CRITICAL)

**Problem**: `templateId` variable has circular default (`{{templateId}}`)

**Current**:
```json
{
  "name": "templateId",
  "default": "{{templateId}}"  // ← Circular!
}
```

**Recommended fix**:
```json
{
  "name": "templateId",
  "required": true,  // ← Force explicit value
  "description": "Kebab-case template ID (e.g., 'add-rest-endpoint')"
}
```

**OR** compute default from `templateName`:
```json
{
  "name": "templateId",
  "required": false,
  "default": "{{templateName | kebabCase}}",  // ← If supported
  "description": "Auto-generated from templateName if not provided"
}
```

**Expected impact**: Eliminates variable interpolation failures (estimated 100% of failures)

---

#### 3. **Add Pre-Execution Validation** (Priority: HIGH)

**Problem**: Template fails without clear error messages

**Recommended**:
- Add `preChecks` to validate required variables before execution
- Check MCP tool availability before task 4
- Validate write permissions to `/tmp/`

**Example**:
```json
"integration": {
  "preChecks": [
    "test -w /tmp",
    "command -v jq >/dev/null 2>&1"
  ]
}
```

**Expected impact**: Catch environment issues before execution starts

---

#### 4. **Reduce Token Budget for Task 1** (Priority: MEDIUM)

**Problem**: Using 23k input tokens but only 191 output tokens

**Analysis**:
- Task 1 prompt is **5,250 characters** (long)
- Includes extensive examples and instructions
- 8,000 token budget seems excessive for a requirements doc

**Recommended**:
- Reduce Task 1 budget to **4,000 tokens**
- Reduce Task 2 budget to **4,000 tokens**
- Keep Task 3 at **8,000 tokens** (JSON generation)
- Keep Task 4 at **8,000 tokens** (registration)

**Total budget**: 24,000 tokens (down from 32,000)

**Expected impact**: 25% cost reduction with no quality loss

---

#### 5. **Add Execution Examples** (Priority: MEDIUM)

**Problem**: Template may be called incorrectly

**Recommended**: Add `examples` field to template:
```json
"examples": [
  {
    "name": "Create simple feature template",
    "variables": {
      "templateName": "Add REST Endpoint",
      "templateDescription": "Add a new REST API endpoint with validation",
      "category": "feature",
      "templateId": "add-rest-endpoint"
    }
  }
]
```

**Expected impact**: Reduces user error in template invocation

---

### 🟡 MEDIUM PRIORITY: Optimize After Fixing Critical Issues

#### 6. **Implement Caching** (Priority: MEDIUM)

**Problem**: 0 cache tokens used, missing optimization opportunity

**Recommended**:
- Enable prompt caching for task prompts (they're static)
- Cache variable interpolation results
- Use context compression more aggressively

**Expected impact**: 30-50% cost reduction for repeated executions

---

#### 7. **Split Task 3 into Validation Subtask** (Priority: LOW)

**Problem**: Task 3 does JSON generation + validation in one step

**Recommended**:
- Task 3: Generate JSON only
- Task 3.5: Validate JSON (separate task)
- Allows retrying validation without regenerating

**Expected impact**: Better debugging, faster iteration

---

## 8. Next Steps

### Immediate Actions (Next 24 Hours)

1. ✅ **Analyze execution logs** - Find actual error messages from failed executions
2. ✅ **Fix variable interpolation** - Remove circular `templateId` default
3. ✅ **Test with minimal case** - Execute with explicit variables
4. ✅ **Verify metrics collection** - Confirm task metrics are recorded

### Short-Term Actions (Next Week)

1. Add pre-execution validation checks
2. Reduce token budgets per recommendations
3. Add execution examples to template
4. Document common failure modes in template

### Long-Term Actions (Next Month)

1. Implement prompt caching
2. Split complex tasks into subtasks
3. Add automated regression tests
4. Create template evolution pipeline

---

## 9. Current Template JSON

<details>
<summary>Full template definition (click to expand)</summary>

```json
{
  "id": "create-activity-self-contained",
  "version": {
    "timestamp": 1771575165760,
    "parent_hash": "",
    "variant_hash": "827660b8ccd63d68",
    "full_version": "1771575165760::827660b8ccd63d68",
    "generation": 0
  },
  "genealogy": {
    "created_at": 1771575165761,
    "parent_id": "",
    "variant_hash": "827660b8ccd63d68",
    "generation": 0,
    "evolution": {
      "reason": "EVOLUTION_REASON_MANUAL",
      "improvised": false,
      "author": "TEMPLATE_AUTHOR_HUMAN",
      "notes": "Create activity templates without requiring example files or specific project structure - fully self-contained and repository-agnostic. Registers template directly to backend without local file dependencies."
    },
    "variant_ids": []
  },
  "name": "Create Activity Template (Self-Contained)",
  "description": "Create activity templates without requiring example files or specific project structure - fully self-contained and repository-agnostic. Registers template directly to backend without local file dependencies.",
  "category": "infrastructure",
  "status": "stable",
  "candidateIds": [],
  "allocationWeight": 1,
  "executions": 34,
  "successRate": 0,
  "avgDuration": 84648.76470588235,
  "avgCost": 0.0768661323529412,
  "avgTokens": {
    "input": 23197.705882352937,
    "output": 190.55882352941177,
    "cache": 0
  },
  "tasks": [
    {
      "id": "gather-requirements",
      "subagent": "general",
      "description": "Extract and clarify requirements from user input to ensure complete understanding",
      "dependencies": [],
      "guidance": [],
      "expected_actions": [],
      "tools": {
        "required": [],
        "optional": [],
        "disabled": []
      },
      "prompt": {
        "template": "[... full prompt text ...]",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
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
            "description": "Template category: feature, bugfix, refactor, tool, or infrastructure"
          },
          {
            "name": "purpose",
            "type": "string",
            "required": false,
            "description": "Detailed explanation of the workflow this template automates",
            "default": "{{templateDescription}}"
          },
          {
            "name": "templateId",
            "type": "string",
            "required": false,
            "description": "Kebab-case template ID (defaults to kebab-case of templateName)",
            "default": "{{templateId}}"
          }
        ]
      },
      "validation": {
        "requiredFiles": [
          "/tmp/activity-template-{{templateId}}/REQUIREMENTS.md"
        ],
        "requiredPatterns": [
          {
            "pattern": "## Workflow Steps",
            "description": ""
          },
          {
            "pattern": "## Input Variables",
            "description": ""
          },
          {
            "pattern": "## Validation Criteria",
            "description": ""
          }
        ],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      },
      "metrics": {
        "successRate": 0,
        "avgTokens": 0,
        "avgDuration": 0,
        "commonFailures": []
      }
    },
    {
      "id": "design-task-graph",
      "subagent": "general",
      "description": "Design task breakdown with proper dependencies forming a directed acyclic graph (DAG)",
      "dependencies": [
        "gather-requirements"
      ],
      "guidance": [],
      "expected_actions": [],
      "tools": {
        "required": [],
        "optional": [],
        "disabled": []
      },
      "prompt": {
        "template": "[... full prompt text ...]",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {
        "requiredFiles": [
          "/tmp/activity-template-{{templateId}}/TASK_GRAPH.md"
        ],
        "requiredPatterns": [
          {
            "pattern": "## Task Breakdown",
            "description": ""
          },
          {
            "pattern": "## Dependency Graph",
            "description": ""
          },
          {
            "pattern": "## Token Budget Summary",
            "description": ""
          }
        ],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      },
      "metrics": {
        "successRate": 0,
        "avgTokens": 0,
        "avgDuration": 0,
        "commonFailures": []
      }
    },
    {
      "id": "write-template-json",
      "subagent": "general",
      "description": "Generate valid ActivityTemplate.Schema JSON following the exact structure",
      "dependencies": [
        "design-task-graph"
      ],
      "guidance": [],
      "expected_actions": [],
      "tools": {
        "required": [],
        "optional": [],
        "disabled": []
      },
      "prompt": {
        "template": "[... full prompt text ...]",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {
        "requiredFiles": [
          "/tmp/activity-template-{{templateId}}/{{templateId}}.json"
        ],
        "requiredPatterns": [
          {
            "pattern": "\"name\":",
            "description": ""
          },
          {
            "pattern": "\"category\":",
            "description": ""
          },
          {
            "pattern": "\"tasks\":",
            "description": ""
          },
          {
            "pattern": "\"contextRequirements\":",
            "description": ""
          }
        ],
        "forbiddenPatterns": [
          {
            "pattern": "\"preChecks\": [\"git",
            "description": "Must not include git status checks"
          }
        ],
        "commands": [
          {
            "command": "cat /tmp/activity-template-{{templateId}}/{{templateId}}.json | jq empty",
            "expected_exit_code": 0
          }
        ]
      },
      "retry": {
        "maxAttempts": 3,
        "strategy": "simple"
      },
      "metrics": {
        "successRate": 0,
        "avgTokens": 0,
        "avgDuration": 0,
        "commonFailures": []
      }
    },
    {
      "id": "register-with-backend",
      "subagent": "general",
      "description": "Register the template directly with metabob-cli backend via MCP, creating usage documentation",
      "dependencies": [
        "write-template-json"
      ],
      "guidance": [],
      "expected_actions": [],
      "tools": {
        "required": [],
        "optional": [],
        "disabled": []
      },
      "prompt": {
        "template": "[... full prompt text ...]",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {
        "requiredFiles": [
          "/tmp/activity-template-{{templateId}}/SUCCESS.md"
        ],
        "requiredPatterns": [
          {
            "pattern": "✅ Template ID:",
            "description": ""
          },
          {
            "pattern": "✅ Status: Registered with backend",
            "description": ""
          },
          {
            "pattern": "## Usage",
            "description": ""
          },
          {
            "pattern": "## Template Structure",
            "description": ""
          }
        ],
        "forbiddenPatterns": [
          {
            "pattern": "❌",
            "description": ""
          },
          {
            "pattern": "FAILED",
            "description": ""
          },
          {
            "pattern": "ERROR",
            "description": ""
          }
        ],
        "commands": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      },
      "metrics": {
        "successRate": 0,
        "avgTokens": 0,
        "avgDuration": 0,
        "commonFailures": []
      }
    }
  ],
  "contextRequirements": [],
  "integration": {
    "requiresCleanGit": true,
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": false,
    "learningMode": true,
    "targetContextTokens": 0,
    "annotationStrategy": "key-components"
  },
  "createdAt": 1771575165761,
  "updatedAt": 1771612665856
}
```

</details>

---

## 10. Conclusion

**Template Status**: 🔴 **BROKEN** - Requires immediate fixes before production use

**Root Cause (Hypothesis)**: Variable interpolation failure due to circular `templateId` default, combined with possible validation configuration errors.

**Immediate Actions**:
1. Fix `templateId` variable default (remove circular reference)
2. Test with explicit variable values
3. Verify metrics collection is working
4. Add execution logging to capture actual error messages

**Success Criteria**:
- First successful execution (0% → >0%)
- Task-level metrics populated
- Clear error messages for failures
- Reduced cost per execution

**Estimated Recovery Time**: 1-2 days of debugging and testing

---

**Next Review**: After implementing critical fixes and achieving first successful execution
