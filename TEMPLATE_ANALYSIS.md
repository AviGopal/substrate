# Template Analysis: hello-world-minimal

## Executive Summary

**Key Finding**: Despite a reported 100% success rate (20/20 executions completed), the `hello-world-minimal` template has significant quality issues. The correctness verdict system identifies 45% of executions as "incorrect" and 55% as "suspicious" - no executions are truly "correct". This reveals a critical gap between technical completion and actual correctness.

**Success Pattern**: The template achieves 100% completion because it's extremely simple (single task, no dependencies, minimal validation). However, this simplicity also exposes execution framework issues where agents spawn but don't perform work.

**Recommendation**: This template is valuable for testing infrastructure (framework reliability), but should NOT be used as a reference pattern for feature templates. The high completion rate comes from low complexity, not from quality design patterns.

---

## Current Template

**Name**: Hello World Minimal  
**Version**: 1771543769255::2d955ac37bea0d56 (Generation 0)  
**Category**: infrastructure  
**Status**: stable  
**Description**: Minimal test activity with no context requirements - single task that writes a file

**Structure**:
- Tasks: 1
- Total token budget: 8,000
- Context requirements: 0
- Integration checks: Clean git required

**Evolution History**:
- Created: 2026-02-20 (1771543769255)
- Generation: 0 (original, not evolved)
- Evolution reason: MANUAL
- Author: HUMAN
- Notes: "Minimal test activity with no context requirements - single task that writes a file"

**Task Breakdown**:

1. **write-hello**: Write hello world message to file
   - Agent: general
   - Dependencies: none
   - Token budget: 8,000
   - Required tools: none (optional: write)
   - Max attempts: 3
   - Retry strategy: simple

**Variable Requirements**:
- `testId` (string, required): Unique test identifier
- `name` (string, required): Name to include in greeting

**Prompt Template**:
```
Write a hello world message to /tmp/hello-{{testId}}.txt

The message should say: Hello from {{name}}!

Use the write tool to create the file.
```

**Validation**:
- No file validation
- No pattern validation
- No forbidden patterns
- No command validation

**Integration Configuration**:
- Requires clean git: true
- Pre-checks: none
- Post-checks: none
- Quality gates: none

**Metabob Configuration**:
- Enabled: false
- Learning mode: true
- Target context tokens: 5,000
- Annotation strategy: key-components

---

## Execution Metrics (All Time)

### Summary

- **Total executions**: 20
- **Successful**: 20 (100%)
- **Failed**: 0 (0%)
- **Average duration**: 206.7s (~3.4 minutes)
- **Average cost**: $0.126
- **Total cost**: $2.53
- **First execution**: 2026-02-20
- **Latest execution**: 2026-02-23

### Token Usage

**Average per execution**:
- Input tokens: 31,937
- Output tokens: 73
- Cache read: 0
- Cache write: 0
- Total: 32,010 tokens

**Token efficiency**: Very high input-to-output ratio (437:1), suggesting agents spend minimal effort on actual work.

### Cost Analysis

**Distribution**:
- Median cost: $0.094
- Min cost: $0.094
- Max cost: $0.212
- Standard deviation: ~$0.042

**Cost trend**: Most executions cluster around $0.094-$0.095, with a few outliers at $0.21 (likely longer wait times or retries).

### Duration Analysis

**Distribution**:
- Median duration: 90s
- Min duration: 26s
- Max duration: 921s (15.3 minutes)
- 90th percentile: 392s

**Duration trend**: High variance (26s to 921s) suggests execution time is dominated by external factors (network latency, agent queue time) rather than actual work.

---

## Correctness Analysis

### Verdict Distribution

| Verdict | Count | Percentage | Avg Confidence |
|---------|-------|------------|----------------|
| Incorrect | 9 | 45% | 0.12 (very low) |
| Suspicious | 11 | 55% | 0.35 (low) |
| Correct | 0 | 0% | N/A |

**Critical finding**: Zero executions achieved "correct" verdict. All executions either failed to do work or did read-only work.

### Issue Breakdown

#### Incorrect Executions (45%)

**Common issues**:
1. "Validation was not executed" (9/9 = 100%)
2. "Agent spawned but no tools used - no actual work performed" (6/9 = 67%)
3. "No agent sessions spawned - activity may not have done any work" (3/9 = 33%)

**Pattern**: Agents spawn but fail to use tools. This indicates a prompt clarity or framework issue.

#### Suspicious Executions (55%)

**Common issues**:
1. "Tools used but no files changed - activity may have been read-only" (11/11 = 100%)
2. "Validation was not executed" (11/11 = 100%)

**Pattern**: Agents use tools (likely bash or read) but don't create the expected output file.

### Execution Evidence Analysis

**Sample execution evidence** (act_mlu3g2xu):
```json
{
  "sessionsSpawned": [
    {
      "sessionID": "ses_387c2a21effe0A7uVXXaOOPnii",
      "taskId": "write-hello",
      "agentType": "general",
      "messageCount": 3,
      "toolCallCount": 0
    }
  ],
  "toolCalls": [],
  "filesChanged": [],
  "commitsMade": []
}
```

**Key observations**:
- Agent spawns correctly (session created)
- Agent receives messages (messageCount: 3)
- Agent makes ZERO tool calls (toolCallCount: 0)
- No files changed
- No commits made

**Hypothesis**: The prompt is too vague or the agent interprets it as conversational rather than actionable.

---

## Failure Analysis

### Failure Distribution

**Zero technical failures**: All 20 executions completed with status "done".

**However**: 100% of executions have correctness issues:
- 45% incorrect (no work performed)
- 55% suspicious (wrong work performed)

### Root Cause Analysis

#### Issue 1: Prompt Ambiguity

**Evidence**: 67% of "incorrect" executions show agents spawning but not using tools.

**Root cause**: The prompt says "Use the write tool to create the file" but doesn't make it clear this is a REQUIRED action. Agents may interpret this as a suggestion.

**Recommended fix**:
```
YOUR TASK: Create a file at /tmp/hello-{{testId}}.txt

REQUIRED ACTIONS:
1. Use the write tool to create the file
2. Write content: "Hello from {{name}}!"
3. Confirm file was created

VALIDATION: After completing, verify the file exists and contains the correct message.
```

#### Issue 2: Missing Validation

**Evidence**: 100% of executions show "Validation was not executed".

**Root cause**: The template has NO validation rules. The system cannot verify correctness.

**Recommended fix**:
```json
"validation": {
  "requiredFiles": ["/tmp/hello-{{testId}}.txt"],
  "requiredPatterns": [
    {
      "file": "/tmp/hello-{{testId}}.txt",
      "pattern": "Hello from {{name}}!"
    }
  ]
}
```

#### Issue 3: Tools Used But No Files Changed

**Evidence**: 55% of executions show tool usage but no file changes.

**Root cause**: Agents likely use bash/read tools to explore but don't use write tool. Suggests:
1. Agent doesn't understand the task
2. Agent encounters an error and gives up
3. Agent thinks the task is informational

**Recommended fix**: Add explicit validation + better task description.

---

## Performance Benchmarks

### Compared to Similar Templates

**Infrastructure category averages** (from template list):
- Success rate: hello-world-minimal 100% vs category avg ~60%
- Duration: hello-world-minimal 206s vs category median ~120s
- Cost: hello-world-minimal $0.126 vs category median ~$0.15

**Ranking**: 1st out of 13 infrastructure templates by success rate (tied with 9 others at 100%).

**However**: When correctness is considered, hello-world-minimal ranks LAST (0% correct executions).

### Success Factors vs. Other Templates

**Why hello-world-minimal succeeds**:
1. ✅ Single task (no dependencies to fail)
2. ✅ No context requirements (no missing context errors)
3. ✅ No validation (can't fail validation)
4. ✅ Minimal token budget (no truncation)
5. ✅ Simple prompt (low ambiguity)

**Why other templates fail**:
1. ❌ Multi-task dependencies (cascading failures)
2. ❌ Context requirements (missing files/components)
3. ❌ Strict validation (false positives)
4. ❌ Insufficient token budgets (truncation)
5. ❌ Complex prompts (ambiguity)

### Patterns to Extract

**DO apply these patterns**:
1. ✅ Keep tasks simple and focused
2. ✅ Minimize dependencies
3. ✅ Use clear variable names
4. ✅ Provide sufficient token budget

**DO NOT apply these patterns**:
1. ❌ Skip validation (leads to false positives)
2. ❌ Vague prompts (agents don't understand)
3. ❌ No required tools (agents skip work)
4. ❌ No quality gates (can't verify correctness)

---

## Comparison: hello-world-minimal vs. e2e-test Templates

### Template Comparison

**hello-world-minimal**:
- Executions: 20
- Success rate: 100% (technical), 0% (correctness)
- Avg cost: $0.126
- Avg duration: 206s
- Tasks: 1
- Validation: none

**e2e-test-20260219-031655** (example from context):
- Success rate: 33% (mentioned in instructions)
- Likely cause: Multi-task, complex validation, context requirements

### Key Differences

| Aspect | hello-world-minimal | e2e-test templates |
|--------|---------------------|-------------------|
| Complexity | Minimal (1 task) | High (multi-task) |
| Validation | None | Strict |
| Context | None | File/component requirements |
| Success rate | 100% (technical) | 33% |
| Correctness | 0% | Unknown |

### Lessons for Template Design

**From hello-world-minimal**:
1. Simple templates avoid cascading failures
2. Missing validation creates false success signals
3. Prompt clarity matters more than complexity

**From e2e-test comparison**:
1. Validation is necessary but should be realistic
2. Context requirements must be clear and checkable
3. Multi-task templates need careful dependency design

---

## Recommendations

### For Template Evolution

**Priority 1: Add validation** (CRITICAL)
```json
"validation": {
  "requiredFiles": ["/tmp/hello-{{testId}}.txt"],
  "requiredPatterns": [
    {
      "file": "/tmp/hello-{{testId}}.txt",
      "pattern": "Hello from {{name}}!"
    }
  ]
}
```

**Priority 2: Improve prompt clarity**
```
TASK: Create a greeting file

REQUIRED ACTIONS:
1. Use the write tool to create /tmp/hello-{{testId}}.txt
2. Write the message: "Hello from {{name}}!"
3. Verify the file was created successfully

VALIDATION: The file must exist and contain exactly "Hello from {{name}}!"
```

**Priority 3: Add required tools**
```json
"tools": {
  "required": ["write"],
  "optional": [],
  "disabled": ["bash"]
}
```

### For Template Library

**DO use hello-world-minimal for**:
1. Testing activity framework reliability
2. Debugging executor infrastructure
3. Validating agent orchestration
4. Benchmarking baseline performance

**DO NOT use hello-world-minimal for**:
1. Reference pattern for feature templates
2. Teaching prompt design
3. Demonstrating validation best practices
4. Showing multi-task workflows

**Better reference templates**:
- `implement-agent-compliance-enforcement-phases-3-5`: 100% success, handles complex features
- `test-boredom-system-in-docker`: 100% success, proper validation
- `propagate-change-through-flow`: 100% success, refactoring patterns

### For Metric Interpretation

**Key insight**: Success rate ≠ correctness rate.

**New metrics needed**:
1. **Correctness rate**: Percentage of executions with "correct" verdict
2. **Work completion rate**: Percentage with files changed or commits made
3. **Validation execution rate**: Percentage where validation actually ran
4. **Tool usage rate**: Percentage where agents used expected tools

**Updated formula**:
```
True Success Rate = (Technical Success Rate) × (Correctness Rate) × (Validation Rate)

hello-world-minimal:
  = 100% × 0% × 0%
  = 0%

Ideal template:
  = 100% × 100% × 100%
  = 100%
```

---

## Current Template JSON

<details>
<summary>Full template definition</summary>

```json
{
  "id": "hello-world-minimal",
  "version": {
    "timestamp": 1771543769255,
    "parent_hash": "",
    "variant_hash": "2d955ac37bea0d56",
    "full_version": "1771543769255::2d955ac37bea0d56",
    "generation": 0
  },
  "genealogy": {
    "created_at": 1771543769255,
    "parent_id": "",
    "variant_hash": "2d955ac37bea0d56",
    "generation": 0,
    "evolution": {
      "reason": "EVOLUTION_REASON_MANUAL",
      "improvised": false,
      "author": "TEMPLATE_AUTHOR_HUMAN",
      "notes": "Minimal test activity with no context requirements - single task that writes a file"
    },
    "variant_ids": []
  },
  "name": "Hello World Minimal",
  "description": "Minimal test activity with no context requirements - single task that writes a file",
  "category": "infrastructure",
  "status": "stable",
  "candidateIds": [],
  "allocationWeight": 1,
  "executions": 20,
  "successRate": 1,
  "avgDuration": 206542.6,
  "avgCost": 0.1264803375,
  "avgTokens": {
    "input": 31937.050000000003,
    "output": 73.2,
    "cache": 0
  },
  "tasks": [
    {
      "id": "write-hello",
      "subagent": "general",
      "description": "Write hello world message to file",
      "dependencies": [],
      "tools": {
        "required": [],
        "optional": [],
        "disabled": []
      },
      "prompt": {
        "template": "Write a hello world message to /tmp/hello-{{testId}}.txt\n\nThe message should say: Hello from {{name}}!\n\nUse the write tool to create the file.",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": [
          {
            "name": "testId",
            "type": "string",
            "required": true,
            "description": "Unique test identifier"
          },
          {
            "name": "name",
            "type": "string",
            "required": true,
            "description": "Name to include in greeting"
          }
        ]
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
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
    "targetContextTokens": 5000,
    "annotationStrategy": "key-components"
  },
  "createdAt": 1771543769255,
  "updatedAt": 1771803167647
}
```

</details>

---

## Appendix: Sample Execution Records

### Sample 1: Incorrect Execution (Agent spawned, no tools used)

**ID**: act_mlu3g2xu_fcc8f53bb20133f6  
**Status**: done  
**Duration**: 804s  
**Cost**: $0.208  

**Correctness verdict**:
- Verdict: incorrect
- Confidence: 0.14 (very low)
- Issues:
  - Agent spawned but no tools used - no actual work performed
  - Validation was not executed

**Evidence**:
- Sessions spawned: 1
- Message count: 3
- Tool calls: 0
- Files changed: 0
- Commits made: 0

### Sample 2: Suspicious Execution (Tools used, no files changed)

**ID**: act_mlunr5mh_d383b0966ff7a351  
**Status**: done  
**Duration**: 90s  
**Cost**: $0.094  

**Correctness verdict**:
- Verdict: suspicious
- Confidence: 0.35 (low)
- Issues:
  - Tools used but no files changed - activity may have been read-only
  - Validation was not executed

**Evidence**:
- Sessions spawned: 1
- Message count: likely 3-5
- Tool calls: > 0
- Files changed: 0
- Commits made: 0

---

## Conclusion

The `hello-world-minimal` template demonstrates a critical insight: **technical success ≠ actual success**.

While this template achieves 100% completion rate, it has 0% correctness rate. This makes it valuable for infrastructure testing but unsuitable as a reference pattern for feature templates.

**Key takeaways**:
1. Validation is essential for verifying correctness
2. Prompt clarity determines agent behavior
3. Simple templates avoid failures but also avoid doing real work
4. Multi-dimensional metrics (success + correctness + validation) provide true quality signals

**Next steps**:
1. Evolve hello-world-minimal with validation (create v2)
2. Use evolved template to test correctness improvements
3. Apply lessons to underperforming templates (e.g., e2e-test-20260219-031655)
4. Establish "correctness rate" as primary quality metric
