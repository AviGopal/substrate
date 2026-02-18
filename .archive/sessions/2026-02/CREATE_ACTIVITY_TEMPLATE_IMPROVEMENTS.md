# create-activity-template Improvements: Implementation Checklist

## Quick Summary

**Current**: 2-task template with basic validation (~65% success rate estimated)  
**Target**: 4-task template with comprehensive validation (80%+ success rate)

**Timeline**: 2 weeks to implement and test

---

## Changes to Implement

### Change 1: Split Task 1 into Guided Subtasks

**Current** (1 large task):
```json
{
  "id": "create-and-register-template",
  "description": "Design activity template, write to file, and register it",
  "prompt": {
    "template": "[16000 token prompt covering everything]"
  }
}
```

**New** (3 focused tasks):
```json
{
  "tasks": [
    {
      "id": "analyze-examples",
      "subagent": "general",
      "description": "Study example templates and extract patterns",
      "dependencies": [],
      "impulseReferences": ["templateExamples"],
      "prompt": {
        "template": "Study the provided template examples from context.\n\nFor each example:\n1. Identify task structure patterns\n2. Note validation strategies used\n3. Observe retry configurations\n4. Extract variable usage patterns\n5. Count tasks (note if 3-5 range)\n\nOutput (structured):\n```\nPatterns Observed:\n- [Pattern 1]\n- [Pattern 2]\n...\n\nBest Practices:\n- [Practice 1]\n- [Practice 2]\n...\n\nAnti-Patterns to Avoid:\n- [Anti-pattern 1]\n- [Anti-pattern 2]\n...\n```\n\nThis analysis guides your template design.",
        "maxTokens": 6000,
        "compressionStrategy": "filter"
      },
      "validation": {
        "requiredPatterns": [
          "Patterns Observed:",
          "Best Practices:",
          "Anti-Patterns"
        ],
        "commands": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    },
    {
      "id": "design-task-graph",
      "subagent": "general",
      "description": "Design task dependency graph following best practices",
      "dependencies": ["analyze-examples"],
      "prompt": {
        "template": "Design the task graph for {{templateName}}.\n\n**Requirements**:\n- 3-7 tasks (prefer 3-5 for simplicity)\n- Clear dependencies (no circular)\n- Appropriate agent assignments\n- Each task atomic and testable\n\n**Output Format**:\n```\nTask Graph for {{templateName}}:\n\ntask-id-1 (agent: appropriate-agent)\n  Purpose: [one sentence]\n  Validation: [what to check]\n  ↓\ntask-id-2 (agent: appropriate-agent)\n  Purpose: [one sentence]\n  Validation: [what to check]\n  ↓\n...\n```\n\n**Agent Selection Guide**:\n- general: Multi-purpose work\n- config: Schema/config changes\n- session: Prompt/message handling\n- tool: Tool implementations\n- test: Test coverage\n\n**Validation Strategy**:\nFor each task, define:\n- Required files that must exist after\n- Required patterns in code\n- Commands to run (typecheck, tests)\n\nKeep validation specific and testable.",
        "maxTokens": 6000,
        "compressionStrategy": "filter",
        "variables": [
          {
            "name": "templateName",
            "type": "string",
            "required": true
          }
        ]
      },
      "validation": {
        "requiredPatterns": [
          "Task Graph",
          "task-",
          "agent:",
          "Purpose:",
          "Validation:",
          "↓"
        ],
        "forbiddenPatterns": [
          "TBD",
          "TODO"
        ],
        "commands": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    },
    {
      "id": "write-template-json",
      "subagent": "general",
      "description": "Convert task graph into ActivityTemplate JSON",
      "dependencies": ["design-task-graph"],
      "impulseReferences": ["templateExamples"],
      "prompt": {
        "template": "Convert your task graph into ActivityTemplate JSON.\n\n**Task Graph** (from previous task):\n[Will be injected from previous task output]\n\n**Implementation**:\n1. Create JSON file: {{templateId}}.json\n2. Follow ActivityTemplate.CreateOptions schema\n3. Use patterns from example templates\n4. Implement validation rules designed in task graph\n5. Set appropriate maxTokens per task (8000-16000 typical)\n6. Include retry config for each task\n\n**Critical Requirements**:\n- Task count: 3-7 (prefer 3-5)\n- All tasks have validation rules\n- All tasks have retry config\n- Dependencies match your graph\n- Agents match your assignments\n\n**Self-Check Before Proceeding**:\n```bash\n# Validate JSON syntax\njq empty {{templateId}}.json\n\n# Check task count\njq '.tasks | length' {{templateId}}.json  # Should be 3-7\n\n# Verify all tasks have validation\njq '.tasks | all(.validation)' {{templateId}}.json  # Should be true\n\n# Check dependency integrity\njq '.tasks | map(.dependencies // []) | flatten | unique | all(. as $dep | any(.tasks[]; .id == $dep))' {{templateId}}.json  # Should be true\n```\n\nIf any check fails, fix before proceeding.",
        "maxTokens": 10000,
        "compressionStrategy": "filter",
        "variables": [
          {
            "name": "templateId",
            "type": "string",
            "required": true
          }
        ]
      },
      "validation": {
        "requiredFiles": ["*.json"],
        "requiredPatterns": [
          "\"name\":",
          "\"category\":",
          "\"tasks\":",
          "\"validation\":",
          "\"retry\":"
        ],
        "forbiddenPatterns": [
          "TODO",
          "\"subagent\": \"\"",
          "\"maxTokens\": 0"
        ],
        "commands": [
          {
            "name": "validate-json-syntax",
            "command": "jq empty *.json",
            "required": true
          },
          {
            "name": "validate-task-count",
            "command": "test $(jq '.tasks | length' *.json) -ge 3 && test $(jq '.tasks | length' *.json) -le 7",
            "required": true
          },
          {
            "name": "validate-all-tasks-have-validation",
            "command": "jq -e '.tasks | all(.validation)' *.json",
            "required": true
          },
          {
            "name": "validate-all-tasks-have-retry",
            "command": "jq -e '.tasks | all(.retry)' *.json",
            "required": true
          },
          {
            "name": "validate-dependency-graph",
            "command": "jq -e '.tasks | map(.dependencies // []) | flatten | unique | all(. as $dep | any(.tasks[]; .id == $dep))' *.json",
            "required": true
          }
        ]
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "progressive-context"
      }
    },
    {
      "id": "register-template",
      "description": "Register with Metabob backend and verify",
      "dependencies": ["write-template-json"],
      // ... existing registration logic (unchanged)
    }
  ]
}
```

---

### Change 2: Enhanced Context Requirements

**Current**:
```json
{
  "contextRequirements": [
    {
      "key": "templateExamples",
      "hint": "Use search_activities tool to find 2-3 existing templates",
      "budgetRange": [3000, 6000]
    }
  ]
}
```

**New**:
```json
{
  "contextRequirements": [
    {
      "key": "highQualityExamples",
      "hint": "Use search_activities({ category: \"{{category}}\", verbose: true }) to find 3 templates with highest success rates (>=80% if available) from the target category. If <3 found, search other categories for general patterns. Focus on templates with 10+ executions for reliable patterns.",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [5000, 8000]
    },
    {
      "key": "failurePatterns",
      "hint": "Use metabob_search_codebase_issues to find annotations about template creation failures or common mistakes. Look for MESSAGE_FOR:all or lessons learned from previous template creation attempts.",
      "impulseTypes": ["metabobAnnotation"],
      "required": false,
      "budgetRange": [2000, 4000]
    }
  ]
}
```

---

### Change 3: Learning Metrics Enhancement

**Add to learning section**:
```json
{
  "learning": {
    "enabled": true,
    "captureStrategy": "detailed",
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
      },
      {
        "taskId": "design-task-graph",
        "metrics": {
          "task_count": "Number of tasks designed (number)",
          "dependency_count": "Number of dependencies defined (number)",
          "agents_used": "Variety of agent types (number)"
        },
        "qualityIndicators": {
          "optimal_task_count": "Task count in 3-5 range (boolean)",
          "clear_structure": "Graph has clear linear or tree structure (boolean)"
        }
      },
      {
        "taskId": "write-template-json",
        "metrics": {
          "validation_rules_count": "Total validation rules defined (number)",
          "retry_strategies_used": "Variety of retry strategies (number)",
          "json_file_size_bytes": "Size of generated JSON (number)"
        },
        "qualityIndicators": {
          "comprehensive_validation": "Avg 2+ validation rules per task (boolean)",
          "proper_retry_config": "All tasks have retry config (boolean)",
          "reasonable_size": "JSON < 50KB (boolean)"
        }
      },
      {
        "taskId": "register-template",
        "metrics": {
          "registration_time_ms": "Time to register (number)",
          "verification_successful": "Verification passed (boolean)"
        }
      }
    ],
    "correlations": {
      "analyze_duration_vs_success": "Does longer analysis correlate with success?",
      "task_count_vs_success": "Optimal task count for success?",
      "validation_count_vs_success": "More validation = higher success?"
    }
  }
}
```

---

## Testing Plan

### Unit Tests

```typescript
// File: test/session/create-activity-template-improved.test.ts

describe("create-activity-template (improved)", () => {
  it("enforces task count limit (3-7 tasks)", async () => {
    // Test with 10 tasks - should fail validation
    const result = await executeWithMockAgent({
      taskCount: 10
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain("task count")
  })
  
  it("requires all tasks to have validation", async () => {
    // Test with task missing validation - should fail
    const result = await executeWithMockAgent({
      tasksWithoutValidation: 1
    })
    expect(result.success).toBe(false)
  })
  
  it("validates dependency graph integrity", async () => {
    // Test with circular dependency - should fail
    const result = await executeWithMockAgent({
      dependencyPattern: "circular"
    })
    expect(result.success).toBe(false)
  })
  
  it("succeeds with well-formed template", async () => {
    const result = await executeWithMockAgent({
      taskCount: 5,
      allTasksHaveValidation: true,
      dependencyPattern: "linear"
    })
    expect(result.success).toBe(true)
  })
})
```

### Integration Tests

```typescript
// Test against real Metabob backend
describe("create-activity-template E2E", () => {
  it("creates and registers valid template", async () => {
    const result = await TemplateExecutor.execute({
      templateId: "create-activity-template",
      variables: {
        templateName: "Test Template E2E",
        templateDescription: "Test template for E2E validation",
        category: "feature",
        purpose: "Testing the improved creation flow",
        templateId: "test-template-e2e"
      },
      reason: "E2E test of improved template creation"
    })
    
    expect(result.success).toBe(true)
    expect(result.tasks.length).toBe(4)  // 3 new subtasks + register
    
    // Verify registration
    const search = await search_activities({ 
      query: "Test Template E2E" 
    })
    expect(search.activities).toContainEqual(
      expect.objectContaining({ id: "test-template-e2e" })
    )
  })
})
```

### Success Rate Tracking

```bash
# Run 20 test executions
for i in {1..20}; do
  opencode activity run create-activity-template \
    --variables '{"templateName":"Test '$i'","category":"feature","purpose":"test"}' \
    --log-metrics
done

# Analyze results
opencode activity analyze-success-rate \
  --template-id create-activity-template \
  --last-n 20

# Expected output:
# Success Rate: 16/20 = 80% ✓
# Avg Duration: 18m (vs 25m baseline) ✓
# Failure Reasons:
#   - Schema validation: 2 (10%)
#   - Registration timeout: 1 (5%)
#   - Agent error: 1 (5%)
```

---

## Specific File Changes

### File 1: templates/built-in/create-activity-template.json

**Lines to change**:

**Line 22-101** (Task 1):
```json
// SPLIT INTO 3 TASKS: analyze-examples, design-task-graph, write-template-json
// (See "Change 1" above for full content)
```

**Line 6-20** (contextRequirements):
```json
// UPDATE: Better example selection
{
  "key": "highQualityExamples",
  "hint": "search_activities with category={{category}}, filter by successRate >= 0.8",
  "budgetRange": [5000, 8000]
}
```

**Line 67-78** (validation):
```json
// ADD: Comprehensive validation commands
{
  "commands": [
    { "name": "validate-json-syntax", "command": "jq empty *.json", "required": true },
    { "name": "validate-task-count", "command": "test $(jq '.tasks | length' *.json) -le 7", "required": true },
    { "name": "validate-all-tasks-complete", "command": "jq -e '.tasks | all(.validation and .retry)' *.json", "required": true },
    { "name": "validate-dependency-graph", "command": "jq -e '.tasks | map(.dependencies // []) | flatten | unique | all(. as $dep | any(.tasks[]; .id == $dep))' *.json", "required": true }
  ]
}
```

**Line 209-248** (learning section):
```json
// ADD: Detailed metrics per subtask
// (See "Change 3" above for full content)
```

---

## Validation Commands Explained

### 1. Task Count Check
```bash
test $(jq '.tasks | length' *.json) -le 7
```
- Reads task array length
- Fails if >7 tasks
- Prevents overly complex templates

### 2. Complete Tasks Check
```bash
jq -e '.tasks | all(.validation and .retry)' *.json
```
- Checks every task has validation AND retry
- Fails if any task missing these fields
- Ensures quality standards

### 3. Dependency Graph Validation
```bash
jq -e '.tasks | map(.dependencies // []) | flatten | unique | all(. as $dep | any(.tasks[]; .id == $dep))' *.json
```
- Extracts all dependencies
- Checks each dependency exists as a task ID
- Fails if invalid dependency references
- Prevents broken execution order

### 4. Agent Assignment Validation
```bash
jq -e '.tasks | all(.subagent and .subagent != "")' *.json
```
- Checks all tasks have non-empty subagent
- Fails if agent assignment missing
- Prevents execution errors

---

## Migration Strategy

### Step 1: Create v4 (Don't Replace v3)

```bash
# Save improved version as v4
cp templates/built-in/create-activity-template.json \
   templates/built-in/create-activity-template.json.v4

# Edit v4 with improvements
# Update version field: "version": 4
```

### Step 2: Test v4 in Parallel

```bash
# Register v4
opencode activity register templates/built-in/create-activity-template.json.v4

# Run 10 tests with v4
for i in {1..10}; do
  opencode activity run create-activity-template \
    --variables '{"templateName":"TestV4-'$i'","category":"feature","purpose":"test"}'
done

# Compare success rates
opencode activity compare-variants \
  --template-id create-activity-template \
  --versions 3,4
```

### Step 3: Thompson Sampling Selection

```bash
# Backend automatically:
# - Tracks v3 and v4 separately
# - Uses Thompson Sampling to select between them
# - Over 20-30 executions, better version gets selected more
# - After 50 executions, clear winner emerges

# Monitor with:
opencode activity variant-performance \
  --template-id create-activity-template
```

### Step 4: Promote Winner

```bash
# After 50+ executions, if v4 has clearly higher success rate:
# - Mark v3 as deprecated
# - Make v4 the default
# - Archive v3 for historical reference

opencode activity deprecate-variant \
  --template-id create-activity-template \
  --version 3

# v4 becomes the primary variant
```

---

## Expected Results

### After 2 Weeks (Testing)

- v4 implemented with 4 tasks + enhanced validation
- 20 test executions completed
- Success rate measured and compared to v3
- Validation catches 90%+ of schema errors

### After 1 Month (Thompson Sampling)

- v3 and v4 both active
- Thompson Sampling selects between them
- Execution data shows which performs better
- Early trend emerging (by execution 30)

### After 3 Months (Winner Emerges)

- Clear winner from 50+ executions per variant
- Winner has 80%+ success rate
- Loser deprecated
- Winner becomes base for future evolution

---

## Rollback Plan

If v4 performs worse than v3:

### Immediate Rollback

```bash
# Mark v4 as deprecated
opencode activity deprecate-variant \
  --template-id create-activity-template \
  --version 4

# v3 becomes primary again
```

### Analysis

```bash
# Understand why v4 failed
opencode activity failure-analysis \
  --template-id create-activity-template \
  --version 4 \
  --compare-to 3

# Common reasons:
# - Validation too strict (false rejections)
# - Additional tasks add latency without value
# - Agent can't follow 4-step process reliably
```

### Iteration

```bash
# Create v5 with adjustments
# - Relax validation slightly
# - Merge some tasks back together
# - Adjust prompts based on failure analysis
```

---

## Key Success Factors

### 1. Data-Driven Decisions

- Don't guess what will work
- Run 20+ executions to get reliable data
- Use Thompson Sampling for objective comparison
- Let metrics drive evolution

### 2. Incremental Changes

- v4 changes 3 things: task split, validation, examples
- If v4 fails, hard to know which change was bad
- Alternative: Create v4a (task split only), v4b (validation only), v4c (examples only)
- Test all three, see which improves success rate

### 3. Validation Balance

- Too strict → false rejections, frustrating agents
- Too loose → invalid templates, runtime failures
- Target: 95% valid templates pass, 95% invalid templates fail

### 4. Fast Feedback Loop

- Weekly analysis of new execution data
- Monthly review of variant performance
- Quarterly major evolution based on learnings

---

## Summary

### Registration Flow
1. Agent designs → 2. Writes JSON → 3. register_activity_template → 4. Backend storage → 5. Verification via search

### Current Success Factors
- Task 2 verifies registration
- Quality gates check JSON syntax
- Learning section documents patterns
- Backend auto-updates metrics

### Improvements to Implement
1. **Split into guided subtasks** (+15% success)
2. **Enhanced validation** (+10% success)
3. **Better examples** (+5% success)
4. **Detailed learning metrics** (enables future optimization)

### Expected Outcome
- **Current**: ~65% success rate
- **After improvements**: 80%+ success rate
- **With evolution**: 90%+ success rate (6 months)

**Timeline**: 2 weeks to implement, 3 months to validate with Thompson Sampling.
