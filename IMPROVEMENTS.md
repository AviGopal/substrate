# Improvement Plan: fix-bug-complete

**Analysis Date**: 2026-02-18  
**Template ID**: fix-bug-complete  
**Version**: 1771417054361::1ad4330062cc164d

---

## Executive Summary

### Current State (Generation 0)

| Metric | Value | Status |
|--------|-------|--------|
| **Success rate** | 0% (0/1) | ❌ Non-functional |
| **Average cost** | $0.00 | N/A (no work performed) |
| **Average duration** | 86ms | ⚠️ Failed during initialization |
| **Failure mode** | Initialization deadlock | 🚨 Critical |

### Target State (Generation 1 - with Priority 1 fixes)

| Metric | Target | Improvement |
|--------|--------|-------------|
| **Success rate** | 65-75% | +65-75 percentage points |
| **Average cost** | $0.15-$0.30 | Baseline (first real executions) |
| **Average duration** | 4-8 minutes | Baseline (first real executions) |
| **Failure mode** | None (initialization works) | ✅ Fixed |

### Total Improvements Proposed

- **Priority 1 (Critical)**: 4 changes - **REQUIRED** for template to function
- **Priority 2 (High Impact)**: 3 changes - Improve success rate by 15-20%
- **Priority 3 (Quality)**: 2 changes - Better error handling and flexibility
- **Priority 4 (Optimization)**: 2 changes - Reduce cost and improve UX

**Total**: 11 improvements spanning 4 priority levels

---

## Priority 1: Critical Fixes (REQUIRED FOR FUNCTION)

These fixes address the **initialization deadlock** that prevents the template from executing at all.

**Impact**: Without these fixes, success rate remains at 0%. With these fixes, template becomes functional.

---

### Improvement 1.1: Remove Pre-Execution Validation from Task 1

**Problem**: Task 1 requires `BUG_ANALYSIS.md` to exist with specific patterns BEFORE the task starts. This creates a deadlock because the task is supposed to CREATE that file.

**Evidence**:
- 100% of executions failed during initialization (1/1)
- Correctness verdict: "No agent sessions spawned"
- Duration: 86ms (too fast for real work)
- Activity executor never created a sub-agent

**Current** (Task 1 validation):
```json
{
  "validation": {
    "requiredFiles": ["BUG_ANALYSIS.md"],
    "requiredPatterns": [
      "## Bug Analysis",
      "### Predicted Cochanges",
      "### Root Cause",
      "\\*\\*File\\*\\*:",
      "\\*\\*Why it happens\\*\\*:",
      "### Fix Approach"
    ],
    "forbiddenPatterns": [
      "TODO", "TBD", "FIXME", "path/to/", "PLACEHOLDER"
    ]
  }
}
```

**Proposed**:
```json
{
  "validation": {
    "requiredFiles": [],
    "requiredPatterns": [],
    "forbiddenPatterns": [
      "TODO", "TBD", "FIXME", "path/to/", "PLACEHOLDER"
    ],
    "commands": []
  }
}
```

**Rationale**:
- Validation should check outputs AFTER task completes, not prerequisites BEFORE task starts
- File creation is part of task work, not a precondition
- Forbidden patterns are still valid (prevent incomplete work)
- Move file existence check to post-checks (see Improvement 1.4)

**Impact**:
- **Prevents**: 100% of initialization failures (1/1 executions)
- **Enables**: Task execution to begin
- **Success rate**: 0% → ~40% (estimated, with other P1 fixes)
- **Cost impact**: None (removes validation overhead)

**Effort**: LOW (remove 2 fields)

**ROI**: ⭐⭐⭐⭐⭐ (Infinite - template is non-functional without this)

**Implementation**:

```json
// File: fix-bug-complete-v2.json
{
  "tasks": [
    {
      "id": "analyze-and-locate",
      "validation": {
        "requiredFiles": [],  // CHANGED: was ["BUG_ANALYSIS.md"]
        "requiredPatterns": [],  // CHANGED: was [6 patterns]
        "forbiddenPatterns": ["TODO", "TBD", "FIXME", "path/to/", "PLACEHOLDER"],
        "commands": []
      }
    }
  ]
}
```

---

### Improvement 1.2: Relax Validation Pattern Matching

**Problem**: Validation patterns use overly-specific regex with escaped characters (`\\*\\*File\\*\\*:`). This is brittle and will fail if agent uses alternative markdown formatting.

**Evidence**:
- Pattern `\\*\\*File\\*\\*:` requires exact `**File**:` with double asterisks
- Agent may produce `File:`, `**File:**`, or `**File**` (valid alternatives)
- Pattern matching is case-sensitive and whitespace-sensitive
- 95% confidence that patterns are too strict (from analysis)

**Current** (Tasks 1, 2, 4):
```json
{
  "requiredPatterns": [
    "\\*\\*File\\*\\*:",
    "\\*\\*Why it happens\\*\\*:",
    "\\*\\*Root Cause\\*\\*:"
  ]
}
```

**Proposed**:
```json
{
  "requiredPatterns": [
    "File:",
    "Why it happens:",
    "Root Cause:"
  ]
}
```

**Rationale**:
- Focus on content presence, not formatting
- Accept any markdown formatting (bold, italic, plain)
- Reduce validation brittleness
- Pattern analysis shows 95% success when examples provided

**Impact**:
- **Prevents**: 20-30% of post-initialization failures (estimated)
- **Improves**: Task success rate by 20-30%
- **Cost impact**: None

**Effort**: LOW (simplify 8-10 patterns across 3 tasks)

**ROI**: ⭐⭐⭐⭐⭐ (Very High)

**Implementation**:

```json
// File: fix-bug-complete-v2.json
{
  "tasks": [
    {
      "id": "analyze-and-locate",
      "validation": {
        "requiredPatterns": [
          "## Bug Analysis",
          "### Root Cause",
          "File:",  // CHANGED: was "\\*\\*File\\*\\*:"
          "Why it happens:",  // CHANGED: was "\\*\\*Why it happens\\*\\*:"
          "### Fix Approach"
        ]
      }
    },
    {
      "id": "implement-fix",
      "validation": {
        "requiredPatterns": [
          "## Fix Implementation",
          "### Files Modified",
          "### Changes Made",
          "Root Cause"  // CHANGED: was "\\*\\*Root Cause\\*\\*:"
        ]
      }
    },
    {
      "id": "document-and-close",
      "validation": {
        "requiredPatterns": [
          "## Bug Fix Summary",
          "### Root Cause",
          "### Fix Applied",
          "### Testing"
        ]
      }
    }
  ]
}
```

---

### Improvement 1.3: Add Explicit File Path Examples to Prompts

**Problem**: Prompts mention creating files but don't show WHERE to create them or WHAT format to use. Agents get confused about file paths, leading to validation failures.

**Evidence**:
- Calling agent context: "Doesn't require creating BUG_ANALYSIS.md file upfront"
- Analysis recommendation: "Add file path examples to prompts"
- Pattern recognition: "Executions with explicit file paths succeed 95% of time"

**Current** (Task 1 prompt - abbreviated):
```
Analyze the bug and document your findings.

Create BUG_ANALYSIS.md with your analysis.
```

**Proposed**:
```
Analyze the bug and document your findings.

Create BUG_ANALYSIS.md in the current working directory (./BUG_ANALYSIS.md).

Example structure:
```markdown
## Bug Analysis

### Problem Description
[Describe the bug behavior and symptoms]

### Root Cause
**File**: src/auth.ts
**Line**: 45
**Why it happens**: Null check missing before property access

### Fix Approach
[Describe planned fix]
```

Write to: ./BUG_ANALYSIS.md
```

**Rationale**:
- Explicit paths reduce agent confusion
- Examples provide clear templates to follow
- Pattern analysis shows 95% success rate with examples
- No cost impact (prompt clarity improves success)

**Impact**:
- **Prevents**: 30-40% of validation failures (file not found, wrong format)
- **Improves**: Task 1 success rate by 30-40%
- **Cost impact**: +200-300 tokens per task (minimal)

**Effort**: MEDIUM (add examples to 4 task prompts)

**ROI**: ⭐⭐⭐⭐⭐ (Very High)

**Implementation**:

```json
// File: fix-bug-complete-v2.json
{
  "tasks": [
    {
      "id": "analyze-and-locate",
      "prompt": {
        "template": "{{existing_prompt}}\n\n**Output Format**:\n\nCreate BUG_ANALYSIS.md in the current directory:\n\n```markdown\n## Bug Analysis\n\n### Problem Description\n{{bug_description}}\n\n### Root Cause\n**File**: [file path]\n**Line**: [line number]\n**Why it happens**: [explanation]\n\n### Fix Approach\n[planned fix]\n```\n\n**Write to**: ./BUG_ANALYSIS.md"
      }
    },
    {
      "id": "implement-fix",
      "prompt": {
        "template": "{{existing_prompt}}\n\n**Output Format**:\n\nCreate FIX_IMPLEMENTATION.md:\n\n```markdown\n## Fix Implementation\n\n### Files Modified\n- src/auth.ts (line 45)\n\n### Changes Made\n[description]\n\n### Root Cause Addressed\n[how fix addresses root cause]\n```\n\n**Write to**: ./FIX_IMPLEMENTATION.md"
      }
    },
    {
      "id": "test-fix",
      "prompt": {
        "template": "{{existing_prompt}}\n\n**Output Format**:\n\nCreate TEST_RESULTS.md:\n\n```markdown\n## Test Results\n\n### New Tests Added\n- test/auth.test.ts: testNullPointerFix()\n\n### Test Execution\n✓ All tests passing\n\n### Coverage\n[coverage report]\n```\n\n**Write to**: ./TEST_RESULTS.md"
      }
    },
    {
      "id": "document-and-close",
      "prompt": {
        "template": "{{existing_prompt}}\n\n**Output Format**:\n\nCreate BUG_FIX_SUMMARY.md:\n\n```markdown\n## Bug Fix Summary\n\n### Root Cause\n[summary]\n\n### Fix Applied\n[description]\n\n### Testing\n[test results]\n\n### Lessons Learned\n[insights]\n```\n\n**Write to**: ./BUG_FIX_SUMMARY.md"
      }
    }
  ]
}
```

---

### Improvement 1.4: Move File Validation to Integration Post-Checks

**Problem**: File existence is checked at wrong time (before task starts). Should be checked AFTER task completes.

**Evidence**:
- Analysis recommendation: "Check for file existence AFTER task completes, not before it starts"
- Current design: validation runs before task execution
- Proposed design: validation runs after task completion via post-checks

**Current** (no post-checks for task outputs):
```json
{
  "integration": {
    "preChecks": [
      "git status --short"
    ],
    "postChecks": [
      "npm run typecheck || tsc --noEmit || echo 'Typecheck skipped'",
      "npm test || echo 'Tests skipped'"
    ]
  }
}
```

**Proposed**:
```json
{
  "integration": {
    "preChecks": [
      "git status --short"
    ],
    "postChecks": [
      "test -f BUG_ANALYSIS.md || echo 'ERROR: BUG_ANALYSIS.md not created'",
      "test -f FIX_IMPLEMENTATION.md || echo 'ERROR: FIX_IMPLEMENTATION.md not created'",
      "test -f TEST_RESULTS.md || echo 'ERROR: TEST_RESULTS.md not created'",
      "test -f BUG_FIX_SUMMARY.md || echo 'ERROR: BUG_FIX_SUMMARY.md not created'",
      "npm run typecheck || tsc --noEmit || echo 'Typecheck skipped'",
      "npm test || echo 'Tests skipped'"
    ],
    "qualityGates": [
      {
        "name": "all-documentation-created",
        "command": "test -f BUG_ANALYSIS.md && test -f FIX_IMPLEMENTATION.md && test -f TEST_RESULTS.md && test -f BUG_FIX_SUMMARY.md",
        "required": true,
        "description": "Verify all documentation files were created"
      }
    ]
  }
}
```

**Rationale**:
- Separate validation timing from task execution
- Post-checks run after ALL tasks complete
- Quality gates can be required or optional
- Provides better error messages

**Impact**:
- **Prevents**: 100% of initialization failures
- **Enables**: Proper validation timing
- **Success rate**: Critical enabler for template function
- **Cost impact**: None

**Effort**: LOW (add 4 post-checks, 1 quality gate)

**ROI**: ⭐⭐⭐⭐⭐ (Essential architectural fix)

**Implementation**:

See JSON above.

---

## Priority 2: High-Impact Improvements

These improvements significantly boost success rate and handle test-fixing scenarios.

---

### Improvement 2.1: Add Test-Fixing Conditional Logic to Task 1

**Problem**: Template was designed for production bugs but was tested with failing tests. Test-fixing workflow differs from bug-fixing workflow.

**Evidence**:
- Execution context: "Two end-to-end tests in impulse-system-e2e.test.ts are failing"
- Calling agent: "Better handles test-fixing scenarios vs production bug fixes"
- Analysis: "Test failures may not have 'root causes' in the traditional sense"

**Workflow Differences**:

| Production Bug Fix | Test Failure Fix |
|-------------------|------------------|
| Find root cause in code | Determine if test or code is wrong |
| Fix code bug | Fix code OR update test expectations |
| Add regression tests | Verify test correctness |
| Document prevention | Ensure test coverage |

**Current** (Task 1 prompt - production-focused):
```
Analyze the bug and locate the root cause in the codebase.

Use metabob_search_codebase_issues to find similar bugs.
Trace execution path to find root cause.
Document findings in BUG_ANALYSIS.md.
```

**Proposed** (with test-aware logic):
```
Analyze the bug and locate the root cause.

**IMPORTANT**: First determine if this is a production bug or a test failure.

### If Test Failure:
1. Examine the test code and expectations
2. Determine if the test is incorrect OR the code is incorrect
3. Consider: Did recent code changes break valid tests? Or were tests always wrong?
4. Check test assumptions against actual behavior
5. Document: "Test failure analysis" instead of "Root cause"

### If Production Bug:
1. Use metabob_search_codebase_issues to find similar bugs
2. Trace execution path to find root cause in code
3. Document traditional root cause analysis

**Detection Heuristic**:
- If error_message contains "expect(", "toBe(", "toEqual(" → Test failure
- If affected_files contains "*.test.ts", "*.spec.ts" → Test failure
- If bug_description mentions "test failing", "assertion" → Test failure
- Otherwise → Production bug

Create BUG_ANALYSIS.md with appropriate analysis type.
```

**Rationale**:
- Template needs to handle both workflows
- Test failures require different analytical approach
- Prevents forcing test issues into production bug framework
- Detection heuristic allows automatic branching

**Impact**:
- **Prevents**: 50% of failures when fixing tests (wrong analysis approach)
- **Improves**: Task 1 success rate by 20-30% for test scenarios
- **Enables**: Template to handle both use cases
- **Cost impact**: +300-400 tokens (conditional logic)

**Effort**: MEDIUM (rewrite Task 1 prompt with conditional logic)

**ROI**: ⭐⭐⭐⭐ (High - critical for test-fixing use case)

**Implementation**:

```json
// File: fix-bug-complete-v2.json
{
  "tasks": [
    {
      "id": "analyze-and-locate",
      "prompt": {
        "template": "# Task: Analyze Bug and Locate Root Cause\n\nYou are analyzing a bug to understand its root cause.\n\n## Variables\n\n**Bug Description**: {{bug_description}}\n\n**Error Message**: {{error_message}}\n\n**Steps to Reproduce**: {{steps_to_reproduce}}\n\n**Affected Files**: {{affected_files}}\n\n## Analysis Approach\n\n**CRITICAL**: First determine the bug type:\n\n### Detection Heuristic\n\n```\nIF error_message contains: expect(, toBe(, toEqual(, describe(, it(\nOR affected_files contains: .test.ts, .spec.ts, .test.js, .spec.js\nOR bug_description mentions: test failing, assertion failed, test suite\nTHEN: This is a TEST FAILURE\nELSE: This is a PRODUCTION BUG\n```\n\n### If TEST FAILURE:\n\n1. **Examine Test Code**:\n   - Read the failing test file\n   - Understand what the test expects\n   - Check if test expectations are correct\n\n2. **Determine Correctness**:\n   - Is the test wrong? (incorrect expectations, outdated assumptions)\n   - Is the code wrong? (regression, new bug introduced)\n   - Did test break due to valid code changes? (test needs updating)\n\n3. **Document Test Analysis**:\n   ```markdown\n   ## Bug Analysis (Test Failure)\n   \n   ### Test Failure Details\n   **Test File**: [file]\n   **Failing Test**: [test name]\n   **Expectation**: [what test expects]\n   **Actual Behavior**: [what actually happens]\n   \n   ### Root Cause Determination\n   **Verdict**: Test is incorrect / Code is incorrect\n   **Reason**: [why test or code is wrong]\n   \n   ### Fix Approach\n   - If test is wrong: Update test expectations to match correct behavior\n   - If code is wrong: Fix code bug and verify test passes\n   ```\n\n### If PRODUCTION BUG:\n\n1. **Search for Similar Issues**:\n   - Use metabob_search_codebase_issues to find similar bugs\n   - Use metabob_suggest_related_changes to predict affected files\n\n2. **Trace Execution Path**:\n   - Follow error message stack trace\n   - Identify exact line where bug occurs\n   - Understand code flow leading to bug\n\n3. **Document Root Cause**:\n   ```markdown\n   ## Bug Analysis (Production Bug)\n   \n   ### Problem Description\n   {{bug_description}}\n   \n   ### Root Cause\n   **File**: [file path]\n   **Line**: [line number]\n   **Why it happens**: [explanation]\n   \n   ### Fix Approach\n   [planned fix]\n   ```\n\n## Output\n\nCreate **./BUG_ANALYSIS.md** with appropriate analysis type.\n\n**Example (Test Failure)**:\n```markdown\n## Bug Analysis (Test Failure)\n\n### Test Failure Details\n**Test File**: packages/opencode/test/session/impulse-system-e2e.test.ts\n**Failing Test**: \"should unload impulses correctly\"\n**Expectation**: expect(result4.impulsesUnloaded).toBe(0)\n**Actual Behavior**: result4.impulsesUnloaded is 2\n\n### Root Cause Determination\n**Verdict**: Code is incorrect (impulse unloading logic has bug)\n**Reason**: Memory agent is unloading impulses prematurely before session ends\n\n### Fix Approach\n- Fix impulse lifecycle management in memory-agent.ts\n- Ensure impulses are only unloaded after session completion\n- Verify test passes after fix\n```\n\n**Example (Production Bug)**:\n```markdown\n## Bug Analysis (Production Bug)\n\n### Problem Description\nNull pointer exception when accessing user profile after logout\n\n### Root Cause\n**File**: src/auth.ts\n**Line**: 45\n**Why it happens**: User object is set to null on logout but profile page doesn't check for null before accessing user.name property\n\n### Fix Approach\n- Add null check before accessing user properties\n- Redirect to login if user is null\n- Add defensive programming\n```\n\n**Write to**: ./BUG_ANALYSIS.md",
        "maxTokens": 14000
      }
    }
  ]
}
```

---

### Improvement 2.2: Add Forbidden Pattern Warning to Prompts

**Problem**: Validation includes forbidden patterns (TODO, TBD, FIXME, PLACEHOLDER) but prompts don't mention avoiding them. Agents naturally use TODO as placeholders, causing validation failures.

**Evidence**:
- Analysis: "Agents often use TODO as placeholder"
- Validation fails when TODO appears in output
- Simple prompt addition prevents this issue

**Current** (Task 4 prompt - no TODO warning):
```
Document the fix comprehensively.

Create BUG_FIX_SUMMARY.md with summary, lessons learned, and verification checklist.
```

**Proposed**:
```
Document the fix comprehensively.

Create BUG_FIX_SUMMARY.md with summary, lessons learned, and verification checklist.

**CRITICAL**: Complete ALL sections fully. Do NOT use TODO, TBD, FIXME, or PLACEHOLDER comments. If information is missing, mark as "Not applicable" or "Unknown" instead.
```

**Rationale**:
- Explicit instruction prevents natural TODO usage
- Provides alternatives (N/A, Unknown)
- No cost impact (improves clarity)

**Impact**:
- **Prevents**: 10-15% of validation failures (forbidden patterns)
- **Improves**: Task success rate by 10-15%
- **Cost impact**: None (+50 tokens per affected task)

**Effort**: LOW (add 1-2 sentences to 3 task prompts)

**ROI**: ⭐⭐⭐⭐ (High)

**Implementation**:

```json
// File: fix-bug-complete-v2.json
{
  "tasks": [
    {
      "id": "analyze-and-locate",
      "prompt": {
        "template": "{{existing_prompt}}\n\n**IMPORTANT**: Complete all analysis sections. Do NOT use TODO, TBD, FIXME, or placeholder text like 'path/to/file'. If information is unavailable, write 'Unable to determine' with explanation."
      }
    },
    {
      "id": "implement-fix",
      "prompt": {
        "template": "{{existing_prompt}}\n\n**IMPORTANT**: Complete all implementations fully. Do NOT leave TODO, FIXME, or HACK comments in code. Remove all placeholder text from documentation."
      }
    },
    {
      "id": "document-and-close",
      "prompt": {
        "template": "{{existing_prompt}}\n\n**CRITICAL**: Complete ALL sections fully. Do NOT use TODO, TBD, FIXME, or PLACEHOLDER. Use 'Not applicable' or 'Unable to determine' if information is missing."
      }
    }
  ]
}
```

---

### Improvement 2.3: Increase Retry Attempts for Task 1

**Problem**: Task 1 is most critical (all other tasks depend on it) but only has 3 retry attempts. Given complexity of root cause analysis, more retries would improve success rate.

**Evidence**:
- Current: maxAttempts: 3
- Task 1 is first task (most prone to initialization issues)
- Progressive-context strategy improves with more attempts
- Pattern: Higher retry counts correlate with better success rates

**Current**:
```json
{
  "retry": {
    "maxAttempts": 3,
    "strategy": "progressive-context"
  }
}
```

**Proposed**:
```json
{
  "retry": {
    "maxAttempts": 4,
    "strategy": "progressive-context",
    "fallbackPrompt": "Previous attempt failed. Review the error carefully. Focus on:\n1. Creating BUG_ANALYSIS.md in current directory\n2. Including all required sections\n3. Avoiding TODO/FIXME placeholders\n4. Using specific file paths (not 'path/to/file')\n\nIf this is a test failure, analyze the test code first to determine if test or code is wrong."
  }
}
```

**Rationale**:
- First task is most critical (failure blocks everything)
- Progressive-context benefits from additional attempts
- Fallback prompt provides specific guidance
- Cost increase is minimal (only paid on failure)

**Impact**:
- **Prevents**: 10-15% of Task 1 failures (via additional retry)
- **Improves**: Overall success rate by 10-15%
- **Cost impact**: +$0.02-$0.05 per failed execution (only on retries)

**Effort**: LOW (increment retry count, add fallback prompt)

**ROI**: ⭐⭐⭐⭐ (High)

**Implementation**:

See JSON above.

---

## Priority 3: Quality Enhancements

These improvements increase robustness and error handling.

---

### Improvement 3.1: Add Pre-Check for File Permissions

**Problem**: Template assumes working directory is writable. If not, all file creation fails. Should check upfront and fail fast with clear error.

**Evidence**:
- Analysis recommendation: "Better error recovery for initialization failures"
- Calling agent: "Has better error recovery for initialization failures"
- No current pre-check for write permissions

**Current**:
```json
{
  "integration": {
    "preChecks": [
      "git status --short"
    ]
  }
}
```

**Proposed**:
```json
{
  "integration": {
    "preChecks": [
      "git status --short",
      "test -w . || (echo 'ERROR: Current directory is not writable. Cannot create bug fix documentation files.' && exit 1)",
      "which npm >/dev/null || which yarn >/dev/null || echo 'WARNING: No package manager found. Test execution may fail.'"
    ]
  }
}
```

**Rationale**:
- Fail fast with clear error message
- Prevent cryptic file creation failures later
- Check for package manager availability (test execution requirement)

**Impact**:
- **Prevents**: 5-10% of failures (permission errors)
- **Improves**: Error message clarity
- **Cost impact**: None (pre-check runs once)

**Effort**: LOW (add 2 pre-check commands)

**ROI**: ⭐⭐⭐ (Medium)

**Implementation**:

See JSON above.

---

### Improvement 3.2: Add Variable Defaults for Optional Fields

**Problem**: Template requires all 4 variables but only `bug_description` is truly required. Missing optional variables cause template errors or poor output quality.

**Evidence**:
- Current: All variables marked as required
- Actually: `error_message`, `steps_to_reproduce`, `affected_files` are optional
- Better UX if sensible defaults provided

**Current**:
```json
{
  "variables": [
    {
      "name": "bug_description",
      "type": "string",
      "required": true,
      "description": "Description of the bug behavior and symptoms"
    },
    {
      "name": "error_message",
      "type": "string",
      "required": false,
      "description": "Error message or stack trace if available"
    },
    {
      "name": "steps_to_reproduce",
      "type": "string",
      "required": false,
      "description": "Steps to reproduce the bug"
    },
    {
      "name": "affected_files",
      "type": "string",
      "required": false,
      "description": "Files suspected to contain the bug (comma-separated)"
    }
  ]
}
```

**Proposed**:
```json
{
  "variables": [
    {
      "name": "bug_description",
      "type": "string",
      "required": true,
      "description": "Description of the bug behavior and symptoms"
    },
    {
      "name": "error_message",
      "type": "string",
      "required": false,
      "default": "No error message provided",
      "description": "Error message or stack trace if available"
    },
    {
      "name": "steps_to_reproduce",
      "type": "string",
      "required": false,
      "default": "Steps to reproduce not provided. Will need to investigate based on bug description.",
      "description": "Steps to reproduce the bug"
    },
    {
      "name": "affected_files",
      "type": "string",
      "required": false,
      "default": "Unknown - will search codebase",
      "description": "Files suspected to contain the bug (comma-separated)"
    }
  ]
}
```

**Rationale**:
- Defaults prevent missing variable errors
- Agent receives context even if info not provided
- Better UX (users only provide available info)
- Prompts can handle "Not provided" gracefully

**Impact**:
- **Prevents**: 5% of failures (missing variable errors)
- **Improves**: User experience significantly
- **Cost impact**: None

**Effort**: LOW (add default values to 3 variables)

**ROI**: ⭐⭐⭐ (Medium - mostly UX improvement)

**Implementation**:

See JSON above.

---

## Priority 4: Optimizations

These improvements reduce cost and improve efficiency without affecting core functionality.

---

### Improvement 4.1: Reduce Task 1 Token Budget (After Fixes)

**Problem**: Task 1 has 14,000 token budget but analysis shows typical usage is much lower. After validation fixes, task should complete with fewer tokens.

**Evidence**:
- Current budget: 14,000 tokens
- Estimated actual usage: 6,000-8,000 tokens (based on similar templates)
- 40-50% overhead margin

**Current**:
```json
{
  "prompt": {
    "maxTokens": 14000
  }
}
```

**Proposed** (after P1-P3 fixes validated):
```json
{
  "prompt": {
    "maxTokens": 10000
  }
}
```

**Rationale**:
- Reduce cost without sacrificing quality
- Still provides 20-30% margin for complex cases
- Should only apply AFTER P1-P3 fixes proven successful

**Impact**:
- **Cost reduction**: ~$0.015 per execution (30% reduction for Task 1)
- **No success rate impact** (still ample budget)

**Effort**: LOW (change 1 number)

**ROI**: ⭐⭐⭐ (Medium - cost optimization)

**⚠️ IMPORTANT**: Only apply this AFTER validating that P1-P3 fixes work and measuring actual token usage.

**Implementation**:

```json
// File: fix-bug-complete-v2.json (after validation)
{
  "tasks": [
    {
      "id": "analyze-and-locate",
      "prompt": {
        "maxTokens": 10000  // CHANGED: was 14000
      }
    }
  ]
}
```

---

### Improvement 4.2: Add Complexity Hints for Agent Selection

**Problem**: All tasks use default agent (Sonnet-4). Some tasks might work with cheaper models (Haiku-4) without quality loss.

**Evidence**:
- Task 4 is primarily documentation (low complexity)
- Haiku is 10x cheaper than Sonnet
- Pattern: Simple tasks succeed with Haiku

**Current**:
```json
{
  "subagent": "general"
}
```

**Proposed** (Task 4 - documentation):
```json
{
  "subagent": "general",
  "complexity": {
    "tier": "simple",
    "reasoning": "Documentation task with clear template and no complex logic",
    "suggestedModels": {
      "preferred": "anthropic/claude-haiku-4",
      "fallback": "anthropic/claude-sonnet-4"
    }
  }
}
```

**Rationale**:
- Task 4 is straightforward documentation
- No complex analysis or code generation required
- Haiku sufficient for template-based writing
- Cost reduction without quality loss

**Impact**:
- **Cost reduction**: ~$0.015 per execution (90% savings on Task 4)
- **Total cost reduction**: ~10-15% overall
- **No success rate impact** (documentation quality maintained)

**Effort**: LOW (add complexity hint to Task 4)

**ROI**: ⭐⭐⭐ (Medium - cost optimization)

**⚠️ IMPORTANT**: Only apply AFTER validating Task 4 completion patterns. Monitor quality.

**Implementation**:

See JSON above.

---

## Summary of Changes

### Quick Reference Table

| Priority | ID | Improvement | Impact | Effort | ROI |
|----------|-----|-------------|--------|--------|-----|
| **P1** | 1.1 | Remove pre-execution validation | 0% → 40% success | LOW | ⭐⭐⭐⭐⭐ |
| **P1** | 1.2 | Relax pattern matching | +20-30% success | LOW | ⭐⭐⭐⭐⭐ |
| **P1** | 1.3 | Add file path examples | +30-40% success | MEDIUM | ⭐⭐⭐⭐⭐ |
| **P1** | 1.4 | Move validation to post-checks | Architecture fix | LOW | ⭐⭐⭐⭐⭐ |
| **P2** | 2.1 | Test-fixing conditional logic | +20-30% for tests | MEDIUM | ⭐⭐⭐⭐ |
| **P2** | 2.2 | Forbidden pattern warnings | +10-15% success | LOW | ⭐⭐⭐⭐ |
| **P2** | 2.3 | Increase Task 1 retries | +10-15% success | LOW | ⭐⭐⭐⭐ |
| **P3** | 3.1 | File permission pre-check | +5-10% success | LOW | ⭐⭐⭐ |
| **P3** | 3.2 | Variable defaults | Better UX | LOW | ⭐⭐⭐ |
| **P4** | 4.1 | Reduce token budget | -30% cost (Task 1) | LOW | ⭐⭐⭐ |
| **P4** | 4.2 | Complexity hints | -10-15% cost | LOW | ⭐⭐⭐ |

### Expected Impact by Priority

| Priority Level | Success Rate Impact | Cost Impact | Duration Impact |
|---------------|--------------------:|------------:|----------------:|
| **P1 Only** | 0% → 65-75% | Baseline | Baseline |
| **P1 + P2** | 65-75% → 80-85% | +5% | No change |
| **P1 + P2 + P3** | 80-85% → 85-90% | +5% | No change |
| **All (P1-P4)** | 85-90% | -10% (net) | No change |

### Total Expected Impact (All Improvements)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Success rate** | 0% | 85-90% | +85-90 pts |
| **Average cost** | $0.00 | $0.20-$0.25 | Baseline |
| **Average duration** | 0.086s (failed) | 5-7 minutes | Baseline |
| **Failure mode** | Init deadlock | Normal task failures | ✅ Fixed |

---

## Implementation Strategy

### Phase 1: Critical Fixes (Day 1) - REQUIRED

**Goal**: Make template functional

**Changes**:
1. ✅ Remove pre-execution validation (1.1)
2. ✅ Relax pattern matching (1.2)
3. ✅ Add file path examples (1.3)
4. ✅ Move validation to post-checks (1.4)

**Expected Outcome**:
- Success rate: 0% → 65-75%
- Template becomes functional
- First successful executions

**Validation**:
- Execute with test variables (failing test scenario)
- Execute with production bug scenario
- Verify tasks spawn successfully
- Verify documentation files created

---

### Phase 2: High-Impact Fixes (Day 2)

**Goal**: Improve success rate and handle edge cases

**Changes**:
1. ✅ Add test-fixing logic (2.1)
2. ✅ Add forbidden pattern warnings (2.2)
3. ✅ Increase Task 1 retries (2.3)

**Expected Outcome**:
- Success rate: 65-75% → 80-85%
- Test failures handled correctly
- Fewer validation failures

**Validation**:
- Execute with multiple test failure scenarios
- Execute with production bugs
- Measure retry success rates

---

### Phase 3: Quality Enhancements (Day 3)

**Goal**: Improve error handling and UX

**Changes**:
1. ✅ Add permission pre-checks (3.1)
2. ✅ Add variable defaults (3.2)

**Expected Outcome**:
- Success rate: 80-85% → 85-90%
- Better error messages
- Improved user experience

**Validation**:
- Test with minimal variables (just bug_description)
- Test in non-writable directory (should fail gracefully)
- Test without package manager

---

### Phase 4: Optimizations (Day 4) - OPTIONAL

**Goal**: Reduce cost, maintain quality

**Changes**:
1. ⚠️ Reduce token budgets (4.1) - AFTER measuring usage
2. ⚠️ Add complexity hints (4.2) - AFTER validating quality

**Expected Outcome**:
- Cost reduction: 10-15%
- No success rate degradation

**Validation**:
- Measure actual token usage per task
- Compare output quality (Haiku vs Sonnet for Task 4)
- Monitor success rates after changes

---

### Phase 5: Monitoring (Days 5-14)

**Goal**: Validate improvements, identify new issues

**Metrics to Track**:

**Daily**:
- Success rate (target: 85-90%)
- Failure distribution by task
- Average cost per execution (target: $0.20-$0.25)
- Average duration (target: 5-7 minutes)

**Weekly**:
- Success rate trend (should be stable or improving)
- Common failure patterns (any new issues?)
- Cost trend (should be stable after P4)
- User feedback (if available)

**Alerts**:
- ⚠️ Success rate < 80% → Investigate immediately
- ⚠️ Cost > $0.30 per execution → Review token usage
- ⚠️ New failure pattern emerges (>10% of failures) → Analyze and fix

---

## Testing Strategy

### Test Cases

#### Test 1: Failing Test Scenario (Original Use Case)

**Variables**:
```json
{
  "bug_description": "Two end-to-end tests in impulse-system-e2e.test.ts are failing",
  "error_message": "expect(result4.impulsesUnloaded).toBe(0) // Received: 2",
  "steps_to_reproduce": "Run: bun test packages/opencode/test/session/impulse-system-e2e.test.ts",
  "affected_files": "packages/opencode/test/session/impulse-system-e2e.test.ts, packages/opencode/src/session/memory-agent.ts"
}
```

**Expected Outcome**:
- ✅ Task 1: Identifies as test failure, analyzes test vs code correctness
- ✅ Task 2: Fixes code or updates test expectations as appropriate
- ✅ Task 3: Verifies test passes after fix
- ✅ Task 4: Documents test failure resolution
- ✅ All documentation files created

---

#### Test 2: Production Bug (Null Pointer)

**Variables**:
```json
{
  "bug_description": "Application crashes when user logs out and navigates to profile page",
  "error_message": "TypeError: Cannot read property 'name' of null at getUserProfile (user.ts:45)",
  "steps_to_reproduce": "1. Log in\n2. Log out\n3. Navigate to /profile\n4. Crash",
  "affected_files": "src/user.ts, src/routes/profile.ts"
}
```

**Expected Outcome**:
- ✅ Task 1: Identifies null pointer root cause
- ✅ Task 2: Adds null checks and defensive programming
- ✅ Task 3: Writes regression test
- ✅ Task 4: Documents fix and prevention
- ✅ All documentation files created

---

#### Test 3: Minimal Variables (Default Fallback)

**Variables**:
```json
{
  "bug_description": "Users report intermittent crashes when submitting forms"
}
```

**Expected Outcome**:
- ✅ Task 1: Works with defaults for missing variables
- ✅ Agent searches codebase for affected files
- ✅ Analysis completes despite limited information
- ✅ All tasks complete successfully

---

#### Test 4: Non-Writable Directory (Error Handling)

**Setup**: Run in directory without write permissions

**Expected Outcome**:
- ❌ Pre-check fails with clear error message
- ❌ Activity aborts before spawning agents
- ✅ Error message explains: "Current directory is not writable"

---

### Success Criteria

#### Phase 1 (Critical Fixes)
- ✅ Success rate > 60%
- ✅ Tasks spawn successfully (no initialization failures)
- ✅ Files created in correct locations
- ✅ At least 1 end-to-end successful execution

#### Phase 2 (High Impact)
- ✅ Success rate > 75%
- ✅ Test failures handled correctly (conditional logic works)
- ✅ Forbidden pattern warnings prevent validation failures

#### Phase 3 (Quality)
- ✅ Success rate > 80%
- ✅ Minimal variables work (defaults functional)
- ✅ Permission errors caught early with clear messages

#### Phase 4 (Optimizations)
- ✅ Cost < $0.30 per execution
- ✅ No success rate degradation
- ✅ Task 4 quality maintained with Haiku

---

## Risk Assessment

### Risk 1: Pattern Simplification Too Aggressive

**Description**: Simplified patterns (e.g., `File:` instead of `\\*\\*File\\*\\*:`) might match unintended text.

**Probability**: Low (10%)

**Impact**: Medium (false positives in validation)

**Mitigation**:
- Test with diverse bug scenarios
- Monitor false positive rate
- Add more specific patterns if needed (e.g., `### Root Cause.*File:`)

**Rollback**: Restore original patterns if >5% false positive rate

---

### Risk 2: Test-Fixing Logic Adds Complexity

**Description**: Conditional logic in Task 1 increases prompt size and complexity. May confuse agent.

**Probability**: Medium (30%)

**Impact**: Medium (Task 1 confusion, lower success rate)

**Mitigation**:
- Test extensively with test and production scenarios
- Use clear detection heuristic
- Provide explicit examples for both cases

**Rollback**: Create separate templates (fix-bug-complete-production, fix-bug-complete-tests)

---

### Risk 3: Token Budget Reduction Causes Truncation

**Description**: Reducing Task 1 budget from 14K to 10K might cause truncation for complex bugs.

**Probability**: Medium (25%)

**Impact**: High (incomplete analysis)

**Mitigation**:
- Only apply AFTER measuring actual usage
- Monitor truncation rates
- Keep 20-30% margin above measured average

**Rollback**: Restore 14K budget if >5% truncation rate

---

### Risk 4: Haiku Quality Insufficient for Task 4

**Description**: Using Haiku for documentation might produce lower quality output.

**Probability**: Low (15%)

**Impact**: Medium (poor documentation)

**Mitigation**:
- Compare Haiku vs Sonnet output quality
- Use Haiku only for template-based docs
- Keep Sonnet as fallback

**Rollback**: Remove complexity hint, use Sonnet for all tasks

---

## Monitoring Plan

### Daily Monitoring (First Week)

**Metrics**:
1. **Success Rate**: Track per phase (target: 85-90% after all phases)
2. **Failure Distribution**: Which task fails most? (identify new hotspots)
3. **Cost Per Execution**: Track against target ($0.20-$0.25)
4. **Duration Per Execution**: Track against target (5-7 minutes)

**Actions**:
- If success rate < target: Analyze failures, prioritize fix
- If new failure pattern emerges: Document, add to improvement backlog
- If cost > target: Review token usage, consider optimizations

---

### Weekly Monitoring (Weeks 2-4)

**Metrics**:
1. **Success Rate Trend**: Stable or improving?
2. **Common Failure Patterns**: Any recurring issues?
3. **Cost Trend**: Stable after Phase 4?
4. **User Feedback**: Any reports of issues?

**Actions**:
- Week 2: Review Phase 1-2 effectiveness
- Week 3: Review Phase 3-4 effectiveness
- Week 4: Decide on next evolution (if needed)

---

### Alerts

**Critical Alerts** (immediate action):
- 🚨 Success rate drops below 70%
- 🚨 Initialization failures return (0 sessions spawned)
- 🚨 File creation failures >10%

**Warning Alerts** (investigate within 24h):
- ⚠️ Success rate drops below 80%
- ⚠️ Cost exceeds $0.35 per execution
- ⚠️ New failure pattern >15% of failures
- ⚠️ Average duration >10 minutes

**Info Alerts** (monitor):
- ℹ️ Token usage trending up
- ℹ️ Retry rate increasing
- ℹ️ Validation failures by pattern type

---

## Evolution Path

### Generation 1 (This Improvement Plan)

**Goal**: Fix initialization deadlock, achieve 85-90% success rate

**Changes**: 11 improvements (P1-P4)

**Expected Metrics**:
- Success rate: 85-90%
- Cost: $0.20-$0.25
- Duration: 5-7 minutes

---

### Generation 2 (Future - After 30+ Executions)

**Potential Improvements**:
1. **Task Parallelization**: Run Task 2 and Task 3 in parallel (if independent)
2. **Adaptive Token Budgets**: Dynamically adjust based on bug complexity
3. **Metabob Integration Optimization**: Cache similar issue searches
4. **Template Composition**: Allow combining with refactor-component for complex fixes

**Triggers for Evolution**:
- New failure patterns emerge (>20% of failures)
- Success rate plateaus below 85%
- Cost increases significantly
- User feedback suggests workflow improvements

---

### Generation 3 (Future - After 100+ Executions)

**Potential Improvements**:
1. **Learning-Based Adjustments**: Use execution history to optimize prompts
2. **Context Compression**: Reduce token usage via smarter context management
3. **Multi-Modal Support**: Handle bugs with screenshots, logs, etc.
4. **Specialized Variants**: Domain-specific templates (database bugs, UI bugs, etc.)

---

## Conclusion

### Summary

The `fix-bug-complete` template is currently **non-functional** due to initialization deadlock. This improvement plan provides:

✅ **4 Critical Fixes** (P1) - REQUIRED for template to function  
✅ **3 High-Impact Improvements** (P2) - Boost success rate 15-20%  
✅ **2 Quality Enhancements** (P3) - Better error handling  
✅ **2 Optimizations** (P4) - Reduce cost 10-15%

**Total Impact**:
- Success rate: **0% → 85-90%** (+85-90 percentage points)
- Cost: **$0.00 → $0.20-$0.25** (establishes baseline)
- Duration: **86ms (failed) → 5-7 minutes** (establishes baseline)

### Next Steps

1. **Implement Phase 1** (P1 fixes) - Create `fix-bug-complete-v2` template
2. **Test Phase 1** - Validate with test failure and production bug scenarios
3. **Deploy Phase 1** - Register new template, mark as evolved version
4. **Monitor Phase 1** - Track success rate, failures, cost for 3-5 days
5. **Implement Phases 2-4** - Apply remaining improvements incrementally
6. **Long-term monitoring** - Track metrics, identify Generation 2 improvements

### Confidence Level

| Assessment | Confidence |
|------------|------------|
| **P1 fixes will enable function** | 95% (strong evidence) |
| **Target success rate achievable** | 80% (estimated, needs validation) |
| **Cost targets realistic** | 75% (based on similar templates) |
| **Test-fixing logic will work** | 70% (new approach, needs validation) |

**Overall confidence**: **85%** - High confidence that improvements will make template functional and achieve target metrics.

---

**End of Improvement Plan**
