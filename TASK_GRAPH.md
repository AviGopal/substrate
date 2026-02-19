# Task Graph: implement-agent-compliance-enforcement

## Overview
- **Total tasks**: 6
- **Execution pattern**: parallel-merge (two parallel branches converge)
- **Estimated duration**: 45-60 minutes
- **Estimated cost**: $0.80-1.20 USD

## Execution Strategy

This activity uses a **parallel-merge pattern** to maximize efficiency:

1. **Branch A**: Template schema + validation logic (Steps 1-3)
2. **Branch B**: Correctness enhancements (Step 4) 
3. **Merge**: Comprehensive testing (Step 5)
4. **Finalize**: Template updates + documentation (Step 6)

This allows validation logic and correctness improvements to be developed independently, then integrated in the test phase.

## Task Breakdown

### Task 1: extend-validation-schema
- **Description**: Add requiredToolCalls and forbiddenPatterns fields to ValidationSchema in activity-template.ts with full Zod schema definitions
- **Agent**: config
- **Dependencies**: none
- **Token Budget**: 10000
- **Validation**:
  - Required files: 
    - `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
  - Required patterns:
    - `requiredToolCalls`
    - `forbiddenPatterns`
    - `z.array(z.object({ tool: z.string(), minCalls: z.number() }))`
    - `.optional()` (for backward compatibility)
  - Forbidden patterns:
    - `TODO`
    - `FIXME`
    - `console.log`
  - Commands:
    ```bash
    cd repos/metabob-opencode/packages/opencode
    npm run type-check
    ```
- **Retry Strategy**: simple
- **Notes**: Make all new fields optional with sensible defaults to maintain backward compatibility

---

### Task 2: implement-validation-logic
- **Description**: Create validateTaskExecution() function with tool call counting, pattern matching, and structured ValidationResult return type
- **Agent**: general
- **Dependencies**: extend-validation-schema
- **Token Budget**: 12000
- **Validation**:
  - Required files:
    - Task executor file (likely `repos/metabob-opencode/packages/opencode/src/session/activity.ts` or similar)
  - Required patterns:
    - `function validateTaskExecution(`
    - `interface ValidationResult`
    - `violations: ValidationViolation[]`
    - `countToolCalls(messages: Message[], toolName: string)`
    - `findToolCallsMatchingPattern(messages: Message[], pattern: string)`
  - Forbidden patterns:
    - `TODO`
    - `FIXME`
    - `console.log`
  - Commands:
    ```bash
    cd repos/metabob-opencode/packages/opencode
    npm run type-check
    ```
- **Retry Strategy**: progressive-context
- **Notes**: 
  - Parse session messages to count tool calls
  - Check against requiredToolCalls from template
  - Check for forbidden file write patterns
  - Return structured violations for guidance generation

---

### Task 3: add-retry-with-guidance
- **Description**: Implement retry loop with generateGuidanceFromViolations() to inject helpful system messages on validation failures
- **Agent**: general
- **Dependencies**: implement-validation-logic
- **Token Budget**: 12000
- **Validation**:
  - Required files:
    - Task executor file (same as Task 2)
  - Required patterns:
    - `function generateGuidanceFromViolations(`
    - `for (let attempt = 1; attempt <= maxAttempts; attempt++)`
    - `validationResult = validateTaskExecution(`
    - `if (validationResult.valid) break`
    - System message injection with guidance
  - Forbidden patterns:
    - `while (true)` (infinite loop risk)
    - `TODO`
    - `FIXME`
  - Commands:
    ```bash
    cd repos/metabob-opencode/packages/opencode
    npm run type-check
    ```
- **Retry Strategy**: progressive-context
- **Notes**:
  - Respect maxAttempts from retry config (default 3)
  - Generate clear, actionable guidance from violations
  - Inject guidance as system message for retry
  - Log retry attempts for debugging

---

### Task 4: enhance-correctness-verdict
- **Description**: Add annotation coverage and markdown file detection checks to computeCorrectnessVerdict() with confidence penalty calculations
- **Agent**: general
- **Dependencies**: none (parallel with Tasks 1-3)
- **Token Budget**: 10000
- **Validation**:
  - Required files:
    - `repos/metabob-opencode/packages/opencode/src/session/activity-correctness.ts`
  - Required patterns:
    - Annotation coverage calculation (compare files changed vs annotations created)
    - Markdown file detection in tool calls
    - `category: "missing-annotations"`
    - `category: "documentation-misplacement"`
    - Confidence penalty application (multiplicative: 0.1x - 0.9x)
  - Forbidden patterns:
    - `TODO`
    - `FIXME`
    - `console.log`
  - Commands:
    ```bash
    cd repos/metabob-opencode/packages/opencode
    npm run type-check
    npm test -- activity-correctness.test.ts
    ```
- **Retry Strategy**: simple
- **Notes**:
  - Add heuristics for legitimate cases (read-only tasks don't need annotations)
  - Use multiplicative confidence penalties
  - Add new issue categories to CorrectnessIssue type

---

### Task 5: create-comprehensive-tests
- **Description**: Create E2E test suites for validation enforcement, retry behavior, and correctness annotation checks
- **Agent**: test
- **Dependencies**: add-retry-with-guidance, enhance-correctness-verdict
- **Token Budget**: 14000
- **Validation**:
  - Required files:
    - `repos/metabob-opencode/packages/opencode/test/session/activity-compliance-enforcement.test.ts`
    - `repos/metabob-opencode/packages/opencode/test/session/activity-correctness-annotations.test.ts`
  - Required patterns:
    - Test case: requiredToolCalls enforcement
    - Test case: forbiddenPatterns blocking
    - Test case: retry with guidance on validation failure
    - Test case: annotation coverage in correctness verdict
    - Test case: markdown file detection
    - Test case: complete flow (validation failure → retry → success)
    - Mock templates with validation rules
  - Forbidden patterns:
    - `it.skip`
    - `test.skip`
    - `TODO`
    - `FIXME`
  - Commands:
    ```bash
    cd repos/metabob-opencode/packages/opencode
    npm test -- activity-compliance-enforcement.test.ts
    npm test -- activity-correctness-annotations.test.ts
    ```
- **Retry Strategy**: progressive-context
- **Notes**:
  - Use mocks to avoid external dependencies
  - Test both success and failure paths
  - Verify retry behavior with validation violations
  - Ensure all new code paths covered
  - Add timeouts where appropriate to prevent hangs

---

### Task 6: update-templates-and-docs
- **Description**: Add requiredToolCalls to key templates, create migration guide, and update template authoring documentation
- **Agent**: config
- **Dependencies**: create-comprehensive-tests
- **Token Budget**: 10000
- **Validation**:
  - Required files:
    - At least 2 template files updated (e.g., add-feature-complete.json, fix-bug-complete.json)
    - Template authoring guide updated
    - Migration guide created
  - Required patterns:
    - `"requiredToolCalls"` in template JSON files
    - `"forbiddenPatterns"` in template JSON files
    - Examples in documentation
    - Configuration options documented
  - Forbidden patterns:
    - Invalid JSON syntax
    - `TODO`
    - `FIXME`
  - Commands:
    ```bash
    cd repos/metabob-opencode/packages/opencode
    npm test -- activity-compliance
    npm test -- activity-correctness-annotations
    # Validate templates parse correctly
    node -e "require('./path/to/template.json')"
    ```
- **Retry Strategy**: simple
- **Notes**:
  - Update at least 2 production templates as examples
  - Document opt-in nature of enforcement
  - Provide clear migration path for existing templates
  - Include concrete examples in documentation

---

## Dependency Graph (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Parallel Branches                       │
└─────────────────────────────────────────────────────────────────┘

Branch A: Validation Enforcement          Branch B: Correctness
────────────────────────────────          ─────────────────────

Task 1: extend-validation-schema          Task 4: enhance-correctness-verdict
         │                                         │
         ↓                                         │
Task 2: implement-validation-logic                 │
         │                                         │
         ↓                                         │
Task 3: add-retry-with-guidance                    │
         │                                         │
         └─────────────┬───────────────────────────┘
                       ↓
         Task 5: create-comprehensive-tests
                       ↓
         Task 6: update-templates-and-docs


Execution Flow:
───────────────
1. Tasks 1 and 4 start in parallel (no dependencies)
2. Task 2 starts after Task 1 completes
3. Task 3 starts after Task 2 completes
4. Task 5 starts after Tasks 3 and 4 both complete (merge point)
5. Task 6 starts after Task 5 completes
```

## Token Budget Summary

| Task | Agent | Tokens | Cost (est.) |
|------|-------|--------|-------------|
| Task 1: extend-validation-schema | config | 10,000 | $0.15 |
| Task 2: implement-validation-logic | general | 12,000 | $0.18 |
| Task 3: add-retry-with-guidance | general | 12,000 | $0.18 |
| Task 4: enhance-correctness-verdict | general | 10,000 | $0.15 |
| Task 5: create-comprehensive-tests | test | 14,000 | $0.21 |
| Task 6: update-templates-and-docs | config | 10,000 | $0.15 |
| **Total** | | **68,000** | **$1.02** |

*Cost estimate assumes $0.015 per 1K tokens (Claude 3.5 Sonnet pricing with caching)*

## Agent Distribution

| Agent | Task Count | Total Tokens |
|-------|------------|--------------|
| config | 2 tasks | 20,000 tokens |
| general | 3 tasks | 34,000 tokens |
| test | 1 task | 14,000 tokens |

## Critical Path Analysis

**Critical Path**: Task 1 → Task 2 → Task 3 → Task 5 → Task 6

**Parallel Opportunity**: Task 4 can execute concurrently with Tasks 1-3, saving ~20-25 minutes

**Bottleneck**: Task 5 (comprehensive tests) depends on both branches completing

**Optimization**: The parallel-merge pattern reduces total execution time by ~30-40% compared to linear execution

## Risk Mitigation per Task

### Task 1: Schema Extension
- **Risk**: Breaking existing templates
- **Mitigation**: All new fields optional with defaults
- **Fallback**: Revert to minimal schema extension if issues arise

### Task 2: Validation Logic
- **Risk**: False positives in validation
- **Mitigation**: Add configuration flag to disable strict mode
- **Fallback**: Log violations without blocking execution initially

### Task 3: Retry with Guidance
- **Risk**: Infinite retry loops
- **Mitigation**: Strict maxAttempts enforcement (default 3)
- **Fallback**: Fail fast if guidance doesn't improve results

### Task 4: Correctness Enhancement
- **Risk**: Too many false positives
- **Mitigation**: Add heuristics for read-only tasks
- **Fallback**: Make checks warnings instead of failures initially

### Task 5: E2E Tests
- **Risk**: Flaky tests due to timing
- **Mitigation**: Use mocks, add explicit timeouts
- **Fallback**: Mark flaky tests as known issues, fix separately

### Task 6: Template Updates
- **Risk**: Breaking production templates
- **Mitigation**: Test templates thoroughly before commit
- **Fallback**: Keep original templates as .backup files

## Success Criteria

### Must Have:
- ✅ All 6 tasks complete successfully
- ✅ All tests pass (100% of new tests)
- ✅ No regressions (existing tests still pass)
- ✅ TypeScript compilation succeeds
- ✅ At least 2 templates updated with enforcement

### Should Have:
- ✅ Comprehensive test coverage (>90% of new code)
- ✅ Documentation complete and clear
- ✅ Migration guide for template authors
- ✅ Configuration options documented

### Nice to Have:
- Additional templates updated beyond minimum 2
- Performance benchmarks for validation overhead
- Examples in multiple template categories

## Rollback Plan

If critical issues discovered during implementation:

1. **After Task 1**: Revert schema changes, make fields simpler
2. **After Task 2**: Disable validation by default, make opt-in
3. **After Task 3**: Remove retry logic, fail fast instead
4. **After Task 4**: Revert correctness enhancements
5. **After Task 5**: Skip template updates if tests reveal issues
6. **After Task 6**: Revert template changes, keep only documentation

## Post-Implementation Tasks

Not included in this activity (follow-up work):

1. Monitor real-world template executions for validation issues
2. Tune confidence penalty multipliers based on data
3. Add telemetry for validation success/failure rates
4. Create dashboard for compliance metrics
5. Extend to additional templates beyond initial 2
6. Optimize validation performance if overhead is significant
