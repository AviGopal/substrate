# Activity Requirements: implement-agent-compliance-enforcement

## Overview

Complete the Agent Compliance Enforcement system (Phases 3-5) to ensure agents consistently follow best practices for documentation and annotations. Phases 1-2 (automatic annotation capture and markdown file warnings) are already implemented. This activity implements template-level enforcement with `requiredToolCalls`, enhances correctness checks to validate annotation coverage, and adds comprehensive end-to-end testing.

**Context**: The design document at `AGENT_COMPLIANCE_ENFORCEMENT_DESIGN.md` describes a multi-layer enforcement strategy. We need to complete the remaining 3 phases to provide robust guarantees that agents document their work properly.

## Workflow Steps

1. **Extend Template Validation Schema** (Dependencies: none)
   - Add `requiredToolCalls` field to ValidationSchema in activity-template.ts
   - Add `forbiddenPatterns` field for blocking markdown file creation
   - Add `minCalls` parameter to specify minimum tool call count
   - Update TypeScript types and Zod schemas

2. **Implement Task Validation Logic** (Dependencies: Step 1)
   - Create validation function `validateTaskExecution()` in task executor
   - Check if required tools were called during task execution
   - Check for forbidden patterns (e.g., markdown file writes)
   - Return structured ValidationResult with violations array

3. **Add Retry with Guidance** (Dependencies: Step 2)
   - Implement retry loop in task executor with validation
   - Generate guidance messages from validation violations
   - Inject guidance as system message for retry attempts
   - Respect maxAttempts from retry configuration

4. **Enhance Correctness Verdict** (Dependencies: none - parallel with 1-3)
   - Add annotation coverage check to `computeCorrectnessVerdict()`
   - Add markdown file detection check
   - Calculate confidence penalties for missing annotations
   - Add new issue categories: "missing-annotations", "documentation-misplacement"

5. **Create End-to-End Tests** (Dependencies: Steps 1-4)
   - Test template with requiredToolCalls enforcement
   - Test forbidden patterns blocking
   - Test retry with guidance on validation failure
   - Test correctness verdict with annotation checks
   - Test complete flow: validation failure → retry → success

6. **Update Existing Templates** (Dependencies: Steps 1-3)
   - Add requiredToolCalls to key templates (add-feature-complete, fix-bug-complete)
   - Add forbiddenPatterns for markdown files where appropriate
   - Test updated templates with enforcement

7. **Documentation and Validation** (Dependencies: Steps 1-6)
   - Update template authoring guide with new validation fields
   - Create migration guide for existing templates
   - Run validation suite to ensure no regressions
   - Document configuration options in opencode.json

## Input Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| None | - | - | - | This activity operates on the existing codebase and doesn't require runtime variables |

**Note**: This activity is self-contained and modifies the compliance enforcement infrastructure. It doesn't need dynamic inputs.

## Expected Outputs

### Files Created/Modified:
1. **repos/metabob-opencode/packages/opencode/src/session/activity-template.ts**
   - Extended ValidationSchema with requiredToolCalls and forbiddenPatterns

2. **repos/metabob-opencode/packages/opencode/src/session/task-executor.ts** (or relevant file)
   - New `validateTaskExecution()` function
   - Enhanced task execution loop with validation
   - Retry logic with guidance injection

3. **repos/metabob-opencode/packages/opencode/src/session/activity-correctness.ts**
   - Enhanced `computeCorrectnessVerdict()` with annotation checks

4. **repos/metabob-opencode/packages/opencode/test/session/activity-compliance-enforcement.test.ts**
   - Comprehensive E2E tests for all enforcement features

5. **repos/metabob-opencode/packages/opencode/test/session/activity-correctness-annotations.test.ts**
   - Specific tests for annotation coverage in correctness checks

6. **Template files** (e.g., add-feature-complete.json, fix-bug-complete.json)
   - Updated with requiredToolCalls and forbiddenPatterns

7. **Documentation**
   - Updated template authoring guide
   - Migration guide for template authors

### Validation Reports:
- Test results showing all enforcement mechanisms working
- Template validation confirming schema compliance
- E2E test coverage report

### State Changes:
- Template system now enforces tool call requirements
- Correctness checks now validate annotation coverage
- Failed validations trigger automatic retry with guidance

## Validation Criteria

### Per-Step Validation:

#### Step 1: Template Schema Extension
- **Files exist**: activity-template.ts modified
- **Patterns present**: 
  - `requiredToolCalls` field in ValidationSchema
  - `forbiddenPatterns` field in ValidationSchema
  - Zod schema definitions for new fields
- **Commands pass**: `npm run type-check` in opencode package

#### Step 2: Task Validation Logic
- **Files exist**: task executor file modified
- **Patterns present**:
  - `function validateTaskExecution()`
  - `interface ValidationResult`
  - `countToolCalls()` utility function
  - `findToolCallsMatchingPattern()` utility
- **Commands pass**: TypeScript compilation succeeds
- **Unit tests**: Basic validation logic tests pass

#### Step 3: Retry with Guidance
- **Patterns present**:
  - Retry loop in task executor
  - `generateGuidanceFromViolations()` function
  - System message injection for retries
- **Commands pass**: Task execution with retries works
- **Unit tests**: Retry behavior tests pass

#### Step 4: Correctness Enhancement
- **Files exist**: activity-correctness.ts modified
- **Patterns present**:
  - Annotation coverage check in `computeCorrectnessVerdict()`
  - Markdown file detection logic
  - New issue categories in CorrectnessIssue
- **Commands pass**: Correctness tests pass
- **Unit tests**: New correctness checks validated

#### Step 5: E2E Tests
- **Files exist**: 
  - activity-compliance-enforcement.test.ts
  - activity-correctness-annotations.test.ts
- **Patterns present**:
  - Test cases for requiredToolCalls enforcement
  - Test cases for forbidden patterns
  - Test cases for retry with guidance
  - Test cases for annotation coverage checks
- **Commands pass**: `npm test` with all new tests passing
- **Coverage**: All new code paths covered

#### Step 6: Template Updates
- **Files modified**: Key template JSON files updated
- **Patterns present**: requiredToolCalls and forbiddenPatterns in templates
- **Commands pass**: Template validation succeeds
- **Manual test**: Execute updated template and verify enforcement

#### Step 7: Documentation
- **Files exist**: 
  - Updated template authoring guide
  - Migration guide document
- **Patterns present**:
  - requiredToolCalls examples
  - forbiddenPatterns examples
  - Configuration options documented
- **Review**: Documentation is clear and complete

### Final Validation:

#### Critical Success Criteria:
1. **Files exist**:
   - All modified source files compile
   - All new test files present and passing
   - Documentation files created

2. **Patterns present**:
   - Template schema has requiredToolCalls validation
   - Task executor validates tool calls and retries
   - Correctness checks validate annotations
   - E2E tests cover all scenarios

3. **Patterns absent**:
   - No TypeScript compilation errors
   - No test failures
   - No TODO/FIXME comments in production code
   - No console.log debugging statements

4. **Commands pass**:
   ```bash
   cd repos/metabob-opencode/packages/opencode
   npm run type-check
   npm test -- activity-compliance
   npm test -- activity-correctness-annotations
   ```

5. **Integration test**:
   - Create test template with requiredToolCalls
   - Execute template and verify validation enforces requirements
   - Verify retry with guidance on validation failure
   - Verify correctness verdict includes annotation checks

## Error Handling

### Common Failures and Solutions:

1. **Schema validation fails after extending ValidationSchema**
   - **Cause**: Existing templates don't match new schema
   - **Solution**: Make new fields optional with defaults
   - **Retry**: No - fix schema design
   - **Debug**: Check Zod schema definitions for backward compatibility

2. **Task validation breaks existing templates**
   - **Cause**: Validation too strict, fails on legitimate cases
   - **Solution**: Add configuration to enable/disable strict validation
   - **Retry**: No - adjust validation logic
   - **Debug**: Review validation violations from existing templates

3. **Retry loop causes infinite retries**
   - **Cause**: Guidance doesn't help agent pass validation
   - **Solution**: Respect maxAttempts, improve guidance messages
   - **Retry**: No - fix retry termination logic
   - **Debug**: Log retry attempts and validation results

4. **Correctness checks too sensitive**
   - **Cause**: False positives on missing annotations
   - **Solution**: Add heuristics to detect legitimate cases (e.g., read-only tasks)
   - **Retry**: No - refine correctness logic
   - **Debug**: Analyze activities flagged incorrectly

5. **E2E tests flaky or slow**
   - **Cause**: Tests depend on external services or timing
   - **Solution**: Use mocks, increase timeouts where needed
   - **Retry**: Yes - test infrastructure issue
   - **Debug**: Run tests individually to isolate failures

6. **TypeScript compilation errors in template types**
   - **Cause**: Type inference breaks with new schema fields
   - **Solution**: Add explicit type annotations where needed
   - **Retry**: No - fix types
   - **Debug**: Check TypeScript error messages for inference issues

## Agent Assignment

This activity requires coordinated work across multiple files and systems. Recommended agent assignments:

- **Step 1** (Schema Extension): `config` agent
  - Specializes in schema/configuration changes
  - Has experience with Zod schemas and TypeScript types
  
- **Step 2** (Validation Logic): `general` agent
  - Core logic implementation
  - Message parsing and tool call counting
  
- **Step 3** (Retry with Guidance): `general` agent
  - Control flow implementation
  - Session message injection
  
- **Step 4** (Correctness Enhancement): `general` agent
  - Algorithm enhancement
  - Heuristics and confidence scoring
  
- **Step 5** (E2E Tests): `test` agent
  - Specializes in comprehensive test coverage
  - E2E test scenarios and assertions
  
- **Step 6** (Template Updates): `config` agent
  - JSON template modifications
  - Template validation
  
- **Step 7** (Documentation): `docs` agent
  - Technical writing
  - Examples and migration guides

## Implementation Notes

### Design Decisions:

1. **Make new validation fields optional**: Ensures backward compatibility with existing templates. Templates can opt-in to enforcement.

2. **Validation happens post-execution**: Allows agent to complete work first, then validates. Alternative would be real-time validation, but that's more complex.

3. **Retry with guidance vs. fail fast**: We retry to give agents a chance to self-correct. Max 3 attempts prevents infinite loops.

4. **Correctness confidence scoring**: Uses multiplicative penalties (0.1x - 0.9x) rather than additive. This ensures multiple issues compound appropriately.

5. **Annotation coverage heuristic**: Compare files changed vs. annotations created. Simple but effective. Could be enhanced with file type filtering (ignore test files, etc.).

### Testing Strategy:

1. **Unit tests**: Each function tested in isolation
2. **Integration tests**: Validation + retry flow tested together
3. **E2E tests**: Full template execution with enforcement
4. **Regression tests**: Existing templates still work
5. **Manual testing**: Run updated templates in real scenarios

### Configuration Philosophy:

- **Strict mode off by default**: Don't break existing workflows
- **Opt-in enforcement**: Templates explicitly request validation
- **Configurable in opencode.json**: Global settings for validation strictness

### Success Metrics:

- All tests pass (100% of new tests)
- No regressions (100% of existing tests still pass)
- At least 2 templates updated with enforcement
- Documentation complete and reviewed
- End-to-end flow demonstrated working

## References

- **Design Document**: `AGENT_COMPLIANCE_ENFORCEMENT_DESIGN.md`
- **Existing Implementation**: 
  - Phase 1-2: `repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts`
  - Correctness checks: `repos/metabob-opencode/packages/opencode/src/session/activity-correctness.ts`
  - Template schema: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- **Test Examples**:
  - `repos/metabob-opencode/packages/opencode/test/session/activity-agent-validation.test.ts`
  - `repos/metabob-opencode/packages/opencode/test/session/activity-validation-enhanced.test.ts`

## Risk Assessment

### High Risk:
- Breaking existing templates with schema changes
- Validation too strict causing false failures

### Medium Risk:
- Retry logic not converging (too many attempts)
- Correctness heuristics missing legitimate cases

### Low Risk:
- Documentation incomplete
- Test coverage gaps

### Mitigation:
- Make all new fields optional with sensible defaults
- Add configuration flags to disable strict validation
- Extensive testing with existing templates
- Gradual rollout: test in development before production
