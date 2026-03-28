# Pattern Analysis: Add Unit Tests for a Function

## Executive Summary

This document analyzes the "add unit tests for a function" interaction pattern and provides a comprehensive design for transforming it into a reusable activity template.

**Pattern Type**: Testing workflow  
**Frequency**: High - fundamental development task  
**Success Rate**: Very High - well-defined process with clear validation  
**Complexity**: Medium - requires code analysis, test design, and execution verification

---

## 1. User Need & Intent Analysis

### Primary User Intent
Users want to **increase test coverage** for existing functions by adding comprehensive unit tests that validate correctness, edge cases, and error handling.

### User Motivation
- **Quality Assurance**: Ensure code works as expected under various conditions
- **Regression Prevention**: Catch future bugs when code changes
- **Documentation**: Tests serve as executable examples of function behavior
- **Refactoring Safety**: Enable confident code improvements with safety net
- **Code Review**: Demonstrate thorough validation for PRs

### When Users Need This
- After implementing new functions without tests (technical debt)
- When test coverage metrics are insufficient
- Before refactoring to establish behavioral baseline
- After bug fixes to prevent regression
- During code review when tests are requested

### Expected Outcomes
- **Immediate**: Comprehensive test suite for target function
- **Short-term**: Passing tests with good coverage
- **Long-term**: Maintainable test code that evolves with implementation

---

## 2. Success Pattern Breakdown

### Core Workflow (5 Key Steps)

#### Step 1: Read and Analyze Function Code
**Purpose**: Understand what the function does, its contract, and dependencies

**Actions**:
- Read the target function's source code
- Identify function signature (parameters, return type)
- Analyze input validation and constraints
- Map out code paths and branches
- Identify dependencies (external calls, imports)
- Note error handling mechanisms

**Success Criteria**:
- Complete understanding of function behavior
- All code paths documented
- Dependencies identified

#### Step 2: Identify Test Scenarios
**Purpose**: Enumerate all cases that need testing

**Actions**:
- **Success Cases**: Normal operation with valid inputs
- **Edge Cases**: Boundary conditions (empty, null, max/min values)
- **Error Cases**: Invalid inputs, exception scenarios
- **Integration Points**: Mocked dependencies, state changes
- Analyze existing test patterns in codebase
- Use Metabob to find similar functions and their test approaches

**Success Criteria**:
- Comprehensive test scenario list covering:
  - Happy path (at least 2-3 scenarios)
  - Edge cases (at least 3-5 scenarios)
  - Error handling (all throws/rejects)
  - Boundary conditions

#### Step 3: Write Test File
**Purpose**: Implement tests following project conventions

**Actions**:
- Find existing test files to understand patterns
- Identify test framework (Jest, Mocha, Vitest, etc.)
- Determine test file location and naming
- Set up test structure (describe blocks, beforeEach)
- Implement test cases with arrange-act-assert pattern
- Create mocks/stubs for dependencies
- Add clear test descriptions

**Success Criteria**:
- Test file follows project conventions
- All scenarios from Step 2 implemented
- Tests are readable and maintainable
- Proper use of assertions and matchers
- Dependencies properly mocked

#### Step 4: Run Tests and Verify
**Purpose**: Ensure tests execute correctly and pass

**Actions**:
- Execute test command
- Verify all tests pass
- Check test coverage (if available)
- Fix any test failures
- Ensure no flaky tests (run multiple times)

**Success Criteria**:
- All tests pass consistently
- No test execution errors
- Coverage meets expectations
- Tests complete in reasonable time

#### Step 5: Document and Commit
**Purpose**: Preserve work with clear explanation

**Actions**:
- Add comments for complex test setups
- Document any test utilities created
- Create commit with clear message
- Reference original function in commit
- Note coverage improvements

**Success Criteria**:
- Clear commit message explaining what was tested
- Code committed successfully
- Tests remain passing after commit

---

## 3. Essential Tools & Context

### Required Tools
1. **`read`**: Read target function code and existing test files
2. **`glob`**: Find test files to understand patterns
3. **`write`** or **`edit`**: Create/modify test files
4. **`bash`**: Run test commands and check coverage

### Optional but Beneficial Tools
5. **`grep`**: Search for existing test patterns
6. **`metabob_search_codebase_issues`**: Find similar functions and test approaches
7. **`metabob_list_file_components`**: Identify all testable components in file
8. **`metabob_annotate_component`**: Document test design decisions

### Context Requirements

#### Essential Context
- **Target Function Code**: Full source of function to test
- **Function Location**: File path and function name
- **Test Framework**: Jest, Mocha, Vitest, etc. (detected from package.json)

#### Valuable Context
- **Existing Test Patterns**: How tests are structured in this project
- **Test Utilities**: Shared mocks, helpers, fixtures
- **Similar Tests**: Tests for similar functions (via Metabob)
- **Code Quality Issues**: Known problems in target function (via Metabob)

#### Optional Context
- **Function Documentation**: JSDoc or inline comments
- **Type Definitions**: TypeScript interfaces/types
- **Related Code**: Callers of the function, usage examples

---

## 4. Edge Cases & Robustness

### Technical Edge Cases

#### 1. Test Framework Ambiguity
**Scenario**: Multiple test frameworks in monorepo or unclear framework
**Handling**: 
- Search package.json for test dependencies
- Check for jest.config, vitest.config, mocha.opts
- Default to Jest (most common)
- Allow user override via template variable

#### 2. Function Location Ambiguity
**Scenario**: User provides vague location ("the login function")
**Handling**:
- Use grep to search for function definition
- Present matches if multiple found
- Request clarification with specific file paths
- Fail gracefully with helpful error

#### 3. Complex Dependencies
**Scenario**: Function has many external dependencies (DB, API calls)
**Handling**:
- Analyze import statements
- Identify mockable dependencies
- Check for existing mock patterns
- Create minimal mocks or suggest integration test

#### 4. Private/Internal Functions
**Scenario**: Function is not exported or is internal helper
**Handling**:
- Test through public interface if possible
- Suggest extracting if worth testing independently
- Document testing strategy decision

#### 5. Asynchronous Functions
**Scenario**: Function uses async/await, promises, callbacks
**Handling**:
- Detect async patterns in code
- Use appropriate async test syntax
- Handle promise rejections
- Set proper test timeouts

### Input Validation Edge Cases

#### 1. Missing Function Name
**Handling**: Request function name with example

#### 2. Function Doesn't Exist
**Handling**: Search codebase, suggest similar functions

#### 3. Function Already Has Tests
**Handling**: 
- Detect existing test file
- Offer to augment or replace
- Default to augment with new scenarios

#### 4. No Test Framework Installed
**Handling**:
- Detect lack of test dependencies
- Fail with installation instructions
- Suggest adding test framework first

### Code Quality Edge Cases

#### 1. Function Has Bugs
**Scenario**: Metabob finds HIGH severity issues in target function
**Handling**:
- Report issues to user
- Suggest fixing bugs first
- If user proceeds, document known issues in test comments
- Test actual behavior, not ideal behavior

#### 2. Function Violates Best Practices
**Scenario**: Function has console.log, any types, etc.
**Handling**:
- Don't copy bad patterns to tests
- Use proper assertions, not console inspection
- Add TODO comments for future refactoring

#### 3. Function Lacks Type Safety
**Scenario**: JavaScript without types or loose TypeScript
**Handling**:
- Infer types from usage
- Test runtime type validation
- Document assumptions about inputs/outputs

---

## 5. Differentiation from Existing Activities

### Comparison with Existing Templates

#### vs. `add-feature-complete`
**Similarities**:
- Both involve testing as a step
- Both require code analysis

**Differences**:
- **Scope**: Feature implements new code + tests; this only adds tests
- **Starting Point**: Feature starts from design; this starts from existing code
- **Complexity**: Feature is multi-task workflow; this is focused single goal
- **Duration**: Feature is 15-30 min; this is 3-5 min
- **Tasks**: Feature has 4 tasks; this needs 3 tasks max

#### vs. `bug-fix`
**Similarities**:
- Both analyze existing code
- Both may add tests

**Differences**:
- **Intent**: Bug fix repairs broken code; this validates working code
- **Test Type**: Bug fix adds regression tests; this adds comprehensive suite
- **Code Changes**: Bug fix modifies implementation; this only adds tests
- **Starting Point**: Bug fix starts from error; this starts from function reference

#### vs. `test-feature` (hypothetical standalone)
**Similarities**:
- Both focus exclusively on testing

**Differences**:
- **Scope**: Feature testing covers multiple components; this covers single function
- **Test Type**: Feature testing may include integration/E2E; this is unit tests only
- **Granularity**: Feature level vs. function level

### Unique Value Proposition

This template is **uniquely focused** on:
1. **Single Function Scope**: Not a feature, not a fix, just thorough unit tests
2. **Retroactive Testing**: Adding tests to existing working code
3. **Test-Driven Learning**: Understanding code through test creation
4. **Coverage Gaps**: Filling specific unit test coverage holes
5. **Minimal Disruption**: Zero implementation changes, pure test addition

### Why This Needs a Separate Template

**Distinct Use Case**: 
- Common request: "Add tests for this specific function"
- Not a bug (code works)
- Not a new feature (code exists)
- Not refactoring (no code changes)

**Optimization Opportunity**:
- Streamlined 3-step workflow vs. 4-5 for broader templates
- Focused prompts with function-specific guidance
- Faster execution (5-10 min vs. 15-30 min)
- Lower token cost (simpler scope)

**Reusability**:
- Can be composed with refactoring activities
- Can be invoked by feature activities to augment tests
- Can be looped for multiple functions
- Suitable for batch testing initiatives

---

## 6. Activity Template Design

### Template Metadata

```json
{
  "name": "Add Unit Tests for Function",
  "description": "Add comprehensive unit tests for an existing function with edge cases and error handling",
  "category": "testing",
  "id": "add-unit-tests-function"
}
```

### Variables

```json
{
  "variables": [
    {
      "name": "function_name",
      "type": "string",
      "required": true,
      "description": "Name of the function to test (e.g., 'calculateTotal', 'UserService.login')"
    },
    {
      "name": "file_path",
      "type": "string",
      "required": true,
      "description": "Path to file containing the function (e.g., 'src/utils/math.ts')"
    },
    {
      "name": "test_framework",
      "type": "string",
      "required": false,
      "description": "Test framework to use (auto-detected if not provided: jest, vitest, mocha)",
      "default": "auto"
    },
    {
      "name": "coverage_goal",
      "type": "string",
      "required": false,
      "description": "Desired coverage level: basic, standard, comprehensive",
      "default": "standard"
    }
  ]
}
```

### Task Structure (3 Tasks)

#### Task 1: Analyze Function and Design Tests
**Duration**: ~2 minutes  
**Agent**: general  
**Purpose**: Understand function and enumerate test scenarios

**Actions**:
1. Read target function code
2. Analyze signature, logic, dependencies
3. Search for similar functions and their tests (Metabob)
4. Check for code quality issues (Metabob)
5. Identify test framework from codebase
6. Enumerate test scenarios (success, edge, error)
7. Create test plan document

**Validation**:
- Function code successfully read
- Test scenarios documented with at least:
  - 2 success cases
  - 3 edge cases
  - All error scenarios

#### Task 2: Implement Unit Tests
**Duration**: ~3 minutes  
**Agent**: test  
**Purpose**: Write test file with all scenarios

**Actions**:
1. Review test plan from Task 1
2. Find existing test patterns
3. Create test file with proper naming
4. Implement all test scenarios
5. Set up mocks for dependencies
6. Add clear descriptions and comments

**Validation**:
- Test file created in correct location
- All scenarios from plan implemented
- No skipped tests (it.skip, describe.skip)
- No console.log in tests
- Proper assertions (not just toBeDefined)
- Test command executes

#### Task 3: Verify and Document
**Duration**: ~1 minute  
**Agent**: general  
**Purpose**: Ensure tests pass and commit work

**Actions**:
1. Run tests and verify pass
2. Check coverage improvement (if available)
3. Add any missing test documentation
4. Create git commit with clear message
5. Optionally annotate test file with Metabob

**Validation**:
- All tests pass
- Git commit created
- No test execution errors

### Context Requirements

```json
{
  "contextRequirements": [
    {
      "key": "target-function",
      "hint": "Read the function code from {{file_path}}",
      "impulseTypes": ["file", "component"],
      "budgetRange": [1000, 2000],
      "required": true
    },
    {
      "key": "test-patterns",
      "hint": "Find existing test files to understand patterns",
      "impulseTypes": ["file"],
      "budgetRange": [1000, 2000],
      "required": true
    },
    {
      "key": "similar-tests",
      "hint": "Use metabob_search_codebase_issues to find similar function tests",
      "impulseTypes": ["metabobIssue", "metabobAnnotation"],
      "budgetRange": [500, 1500],
      "required": false
    }
  ]
}
```

### Integration & Quality Gates

```json
{
  "integration": {
    "preChecks": [
      "git status"
    ],
    "postChecks": [
      "npm test -- {{test_file_path}} || echo 'Test execution failed'"
    ],
    "qualityGates": [
      {
        "name": "tests-pass",
        "command": "npm test -- {{test_file_path}}",
        "required": true
      }
    ]
  }
}
```

### Metabob Integration

```json
{
  "metabob": {
    "enabled": true,
    "learningMode": true,
    "targetContextTokens": 3000,
    "annotationStrategy": "key-components",
    "preActivityChecks": [
      {
        "type": "quality-scan",
        "target": "{{file_path}}",
        "action": "report-high-severity"
      }
    ]
  }
}
```

---

## 7. Success Metrics & Learning

### Execution Metrics
- **Expected Duration**: 5-10 minutes
- **Expected Cost**: $0.05-$0.15 (token usage)
- **Expected Token Usage**: 8,000-15,000 tokens total
- **Success Rate Target**: >85%

### Quality Metrics
- **Test Count**: Minimum 5 tests (success + edge + error cases)
- **Test Pass Rate**: 100% (all tests must pass)
- **Code Quality**: No forbidden patterns (console.log, test.skip)
- **Coverage**: Increase coverage for target function

### Learning Points
1. **Test Scenario Completeness**: Did we miss edge cases?
2. **Mock Strategy**: Were dependencies mocked appropriately?
3. **Test Readability**: Are tests clear and maintainable?
4. **Framework Alignment**: Did we match project patterns?

---

## 8. Composition & Extensibility

### Standalone Use
- Direct invocation: "Add unit tests for calculateTotal in src/utils/math.ts"
- Coverage improvement initiatives
- Code review test additions

### Composes With

#### Prerequisite Activities
- **`refactor`**: Before refactoring, add tests as safety net
- **`bug-fix`**: After fixing bug, add comprehensive tests

#### Complementary Activities
- **`add-integration-tests`**: Follow unit tests with integration tests
- **`increase-coverage`**: Batch apply to multiple functions

#### Extension Activities
- **`add-property-tests`**: Add property-based tests after unit tests
- **`add-mutation-tests`**: Verify test suite quality with mutation testing

### Batch Execution
Can be invoked in loop for multiple functions:
```json
{
  "workflow": "batch-test-functions",
  "functions": [
    {"name": "calculateTotal", "file": "src/utils/math.ts"},
    {"name": "validateEmail", "file": "src/utils/validation.ts"}
  ]
}
```

---

## 9. Failure Modes & Recovery

### Common Failures

#### 1. Function Not Found
**Cause**: Incorrect file path or function name  
**Recovery**: Search codebase with grep, suggest alternatives  
**Prevention**: Validate file exists and contains function in preChecks

#### 2. Test Framework Detection Failed
**Cause**: No test framework installed or ambiguous setup  
**Recovery**: Request user specify framework, fail gracefully  
**Prevention**: Check package.json in preChecks

#### 3. Tests Fail After Creation
**Cause**: Misunderstood function behavior or bad mocks  
**Recovery**: Analyze failures, retry with corrected assumptions  
**Prevention**: Better code analysis in Task 1

#### 4. Circular Dependencies
**Cause**: Function has complex dependency graph  
**Recovery**: Suggest integration test or refactoring  
**Prevention**: Analyze imports early, detect circular patterns

### Retry Strategies
- **Task 1**: Progressive context (add more example tests)
- **Task 2**: Progressive context (add more test patterns, improve mocks)
- **Task 3**: Simple retry (test execution may have transient issues)

---

## 10. Implementation Recommendations

### Development Priority: HIGH

**Rationale**:
- **High Frequency**: Testing is fundamental to quality code
- **Clear ROI**: Directly increases test coverage
- **Low Risk**: No implementation changes, only test additions
- **High Demand**: Common request in code reviews
- **Good Learning Case**: Simple enough to validate template system

### Implementation Phases

#### Phase 1: Minimal Viable Template
- 3 tasks: Analyze, Implement, Verify
- Basic validation (files, patterns, commands)
- Auto-detect test framework
- Standard retry strategies

#### Phase 2: Enhanced Template
- Add Metabob quality scanning
- Improve mock generation
- Add coverage metrics
- Support multiple functions in batch

#### Phase 3: Advanced Features
- Property-based test generation
- Snapshot test support
- Visual regression tests
- Mutation testing integration

### Testing Strategy for Template

1. **Unit Test Template**: Validate JSON schema compliance
2. **Integration Test**: Execute against real functions in test repos
3. **Dogfooding**: Use template to add tests to template system itself
4. **Stress Test**: Execute on variety of function types (sync, async, class methods)

---

## 11. Example Execution Scenarios

### Scenario 1: Simple Pure Function
```typescript
// Target function
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Template Input**:
- `function_name`: "calculateTotal"
- `file_path`: "src/utils/math.ts"

**Expected Output**:
- Tests for empty array
- Tests for single item
- Tests for multiple items
- Tests for negative prices (edge case)
- Tests for very large arrays (performance edge case)

### Scenario 2: Async Function with Dependencies
```typescript
// Target function
async function fetchUser(id: string): Promise<User> {
  const response = await api.get(`/users/${id}`);
  return UserSchema.parse(response.data);
}
```

**Template Input**:
- `function_name`: "fetchUser"
- `file_path`: "src/services/user.ts"

**Expected Output**:
- Mock api.get
- Test successful fetch
- Test 404 error
- Test network error
- Test invalid response schema
- Test retry logic if applicable

### Scenario 3: Class Method
```typescript
// Target function
class UserService {
  async login(email: string, password: string): Promise<Token> {
    const user = await this.db.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }
    return this.generateToken(user);
  }
}
```

**Template Input**:
- `function_name`: "UserService.login"
- `file_path`: "src/services/UserService.ts"

**Expected Output**:
- Mock db.findByEmail
- Mock bcrypt.compare
- Mock generateToken
- Test successful login
- Test user not found
- Test wrong password
- Test email validation

---

## 12. Conclusion

### Template Viability: EXCELLENT

This pattern is an **ideal candidate** for an activity template because:

✅ **Well-Defined Process**: Clear 3-step workflow  
✅ **High Frequency**: Common development task  
✅ **Focused Scope**: Single function, unit tests only  
✅ **Objective Validation**: Tests must pass  
✅ **Low Risk**: No implementation changes  
✅ **High Value**: Directly improves code quality  
✅ **Good Composition**: Works with other templates  
✅ **Clear Failure Modes**: Predictable edge cases  

### Unique Strengths

1. **Precision**: Laser-focused on one function, not sprawling scope
2. **Safety**: Only adds tests, doesn't change implementation
3. **Speed**: Fast execution (5-10 min) vs. feature workflows
4. **Learning**: Helps understand code through test creation
5. **Reusability**: Can be invoked repeatedly for coverage initiatives

### Recommended Next Steps

1. ✅ Create JSON template following this analysis
2. ✅ Validate schema compliance
3. ✅ Register with template repository
4. ✅ Test on 3-5 real functions of varying complexity
5. ✅ Gather metrics and iterate on prompts
6. ✅ Document in user-facing guides
7. ✅ Add to recommended templates for testing workflows

---

## Appendix A: Token Budget Allocation

| Task | Purpose | Tokens | Percentage |
|------|---------|--------|------------|
| Task 1: Analyze | Read function, analyze patterns, design tests | 5,000 | 42% |
| Task 2: Implement | Write test file with all scenarios | 6,000 | 50% |
| Task 3: Verify | Run tests, commit, document | 1,000 | 8% |
| **Total** | | **12,000** | **100%** |

## Appendix B: Validation Checklist

### Task 1 Validation
- [ ] Function code successfully read
- [ ] Test framework identified
- [ ] At least 2 success scenarios documented
- [ ] At least 3 edge cases documented
- [ ] All error scenarios documented
- [ ] Dependencies identified
- [ ] Test file path determined

### Task 2 Validation
- [ ] Test file created in correct location
- [ ] Test file follows naming convention
- [ ] All scenarios implemented
- [ ] No skipped tests (it.skip, describe.skip)
- [ ] No console.log statements
- [ ] Dependencies properly mocked
- [ ] Assertions are meaningful (not just toBeDefined)
- [ ] Test descriptions are clear

### Task 3 Validation
- [ ] Tests execute successfully
- [ ] All tests pass
- [ ] No test execution errors
- [ ] Git commit created
- [ ] Commit message is clear

## Appendix C: Example Commit Messages

**Good Commit Messages**:
- ✅ "Add unit tests for calculateTotal covering edge cases and error handling"
- ✅ "Add comprehensive tests for UserService.login with 8 scenarios"
- ✅ "Add unit tests for validateEmail including malformed and edge cases"

**Bad Commit Messages**:
- ❌ "Add tests"
- ❌ "Update test file"
- ❌ "WIP: testing"

## Appendix D: References

- **Similar Patterns**: Test-driven development, retroactive testing, coverage improvement
- **Related Activities**: add-feature-complete, bug-fix, refactor
- **Test Frameworks**: Jest, Vitest, Mocha, Jasmine, AVA
- **Best Practices**: AAA pattern (Arrange-Act-Assert), test naming conventions, mock strategies
