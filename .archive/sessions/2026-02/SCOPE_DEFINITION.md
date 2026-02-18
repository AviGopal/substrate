# Scope Definition: add-unit-tests-v1

**Template ID**: `add-unit-tests-v1`  
**Category**: Testing  
**Status**: Design Phase  
**Last Updated**: 2026-02-16

---

## 1. IN SCOPE: What This Activity WILL Do

### Primary Goal
Add comprehensive unit tests for a **single existing function** that currently lacks adequate test coverage.

### Specific Actions

#### 1.1 Code Analysis (Task 1)
- ✅ Read the target function's complete source code
- ✅ Parse function signature (parameters, return types, generics)
- ✅ Identify all code paths and conditional branches
- ✅ Map dependencies (imports, external calls, state access)
- ✅ Document error handling mechanisms (throws, rejects, returns null)
- ✅ Search for similar functions and their test patterns using Metabob
- ✅ Check for HIGH severity code quality issues in target function
- ✅ Auto-detect test framework from package.json and config files

#### 1.2 Test Scenario Design (Task 1)
- ✅ Document **success cases**: Valid inputs, normal operation (2-3 scenarios minimum)
- ✅ Document **edge cases**: Boundary values, empty inputs, nulls, max/min values (3-5 scenarios minimum)
- ✅ Document **error cases**: Invalid inputs, exception paths, all throws/rejects
- ✅ Identify mockable dependencies and mocking strategy
- ✅ Create structured test plan with arrange-act-assert breakdown

#### 1.3 Test Implementation (Task 2)
- ✅ Create test file following project naming conventions (e.g., `function.test.ts`, `function.spec.ts`)
- ✅ Implement all scenarios from test plan with proper test framework syntax
- ✅ Set up mocks/stubs for external dependencies
- ✅ Write clear, descriptive test names (behavior-focused)
- ✅ Add comments for complex test setups or assertions
- ✅ Handle async functions with proper await/async test syntax
- ✅ Set appropriate test timeouts for async operations

#### 1.4 Validation & Commit (Task 3)
- ✅ Execute test command and verify all tests pass
- ✅ Check test coverage improvement (if tooling available)
- ✅ Fix any test failures or execution errors
- ✅ Create git commit with descriptive message
- ✅ Optionally annotate test file with Metabob documenting test strategy

### Supported Function Types
- ✅ Pure functions (no side effects)
- ✅ Async functions (Promise-based or async/await)
- ✅ Class methods (instance and static)
- ✅ Functions with external dependencies (DB, API, filesystem)
- ✅ Functions with complex control flow (multiple branches)

### Supported Test Frameworks
- ✅ Jest (auto-detected, default)
- ✅ Vitest (auto-detected)
- ✅ Mocha (auto-detected)
- ✅ User-specified framework via `test_framework` variable

### Measurable Outputs
1. **Test File**: New or augmented test file in correct location
2. **Test Count**: Minimum 5 tests (success + edge + error cases)
3. **Test Pass Rate**: 100% - all tests must pass
4. **Git Commit**: Single commit with clear message referencing function
5. **Documentation**: Test plan document or inline test comments

---

## 2. OUT OF SCOPE: What This Activity Will NOT Do

### Implementation Changes
- ❌ Modify the target function's implementation code
- ❌ Refactor the target function (even if code quality issues exist)
- ❌ Fix bugs in the target function
- ❌ Add type annotations or improve code structure
- ❌ Change function signature or behavior

### Non-Unit Testing
- ❌ Integration tests (testing multiple components together)
- ❌ End-to-end tests (full application workflows)
- ❌ Performance/load tests
- ❌ Visual regression tests
- ❌ Property-based tests (QuickCheck/fast-check style)
- ❌ Mutation testing

### Infrastructure
- ❌ Install or configure test frameworks
- ❌ Set up test runners or CI/CD pipelines
- ❌ Create test utilities or shared fixtures (unless specific to this function)
- ❌ Configure code coverage tools
- ❌ Set up testing databases or mock servers

### Multi-Function Scope
- ❌ Test multiple functions in one execution (use batch workflow separately)
- ❌ Test entire modules or classes (test one method at a time)
- ❌ Implement test suites for features (use `add-feature-complete`)

### Code Quality Fixes
- ❌ Fix HIGH severity issues found by Metabob (report only, don't fix)
- ❌ Improve code based on quality analysis
- ❌ Remove dead code or unused imports
- ❌ Apply linting fixes

### Documentation Beyond Tests
- ❌ Write function documentation (JSDoc, docstrings)
- ❌ Update README files
- ❌ Create testing guides
- ❌ Write architecture documentation

---

## 3. SUCCESS CRITERIA: How to Tell If Activity Succeeded

### Objective Metrics (Must Pass ALL)

#### 3.1 File System
- ✅ Test file exists at expected location
- ✅ Test file follows project naming convention
- ✅ Test file has valid syntax (no parse errors)

#### 3.2 Test Quality
- ✅ **Minimum test count**: At least 5 tests implemented
  - At least 2 success cases
  - At least 3 edge cases
  - At least 1 error case (if function can error)
- ✅ **Test pass rate**: 100% (0 failures, 0 skipped)
- ✅ **No forbidden patterns**:
  - No `it.skip` or `describe.skip`
  - No `console.log` statements
  - No weak assertions (only `toBeDefined`, only `toBeTruthy`)
- ✅ **Proper async handling**: async tests use `async`/`await` or return promises

#### 3.3 Code Coverage (If Available)
- ✅ Function coverage: >90% line coverage for target function
- ✅ Branch coverage: All branches exercised at least once
- ✅ No decrease in overall project coverage

#### 3.4 Test Execution
- ✅ Tests execute without errors (no exceptions during test run)
- ✅ Tests complete within reasonable time (<10 seconds for unit tests)
- ✅ Tests are not flaky (pass consistently on multiple runs)

#### 3.5 Version Control
- ✅ Git commit created successfully
- ✅ Commit message mentions function name and file
- ✅ Commit includes only test file changes (no implementation changes)
- ✅ Working directory clean after commit

#### 3.6 Framework Alignment
- ✅ Tests use project's test framework correctly
- ✅ Mocking strategy matches existing test patterns
- ✅ Test structure (describe blocks, naming) follows project conventions
- ✅ Imports and module resolution work correctly

### Qualitative Success Indicators

#### 3.7 Test Completeness
- ✅ All documented code paths have tests
- ✅ Edge cases are non-trivial (not just "test with empty string")
- ✅ Error cases test actual error conditions, not just "expect to throw"
- ✅ Mocks are realistic and properly configured

#### 3.8 Test Maintainability
- ✅ Test names clearly describe what is being tested
- ✅ Tests follow AAA pattern (Arrange-Act-Assert)
- ✅ Complex setups have explanatory comments
- ✅ No copy-paste code (use beforeEach/helper functions appropriately)

#### 3.9 Test Reliability
- ✅ No hardcoded dates, timestamps, or random values (unless seeded)
- ✅ No dependencies on external systems (all mocked)
- ✅ Tests are isolated (one test doesn't affect another)

### Minimum Acceptable Result
For activity to be considered **successful**, must achieve:
- All 6 objective metrics (3.1-3.6)
- At least 7 of 9 qualitative indicators (3.7-3.9)

### Ideal Result
For activity to be considered **excellent**, must achieve:
- All objective metrics
- All qualitative indicators
- Coverage increase >15%
- Zero retry attempts needed

---

## 4. FAILURE MODES: Common Ways This Could Fail

### 4.1 Input Validation Failures

#### Function Not Found
**Symptoms**: 
- File exists but function name not found in file
- File path is incorrect
- Function is in different file than specified

**Detection**: Task 1 grep/read fails to find function definition

**Recovery**:
- Search codebase with `grep -r "function_name"`
- Suggest similar function names from search results
- Request clarification from user with specific file:line references

**Prevention**: Add preCheck to validate function exists before starting

---

#### Ambiguous Function Reference
**Symptoms**:
- Multiple functions with same name (overloads, different classes)
- Function name is generic (e.g., "render", "init")

**Detection**: Multiple matches in code search

**Recovery**:
- Present all matches with file paths and signatures
- Request user specify exact file and class/namespace
- Default to first match with warning

**Prevention**: Encourage fully qualified names (e.g., "UserService.login")

---

#### Test Framework Missing
**Symptoms**:
- No test dependencies in package.json
- No test scripts in package.json
- No test config files (jest.config, vitest.config)

**Detection**: Task 1 framework detection returns null

**Recovery**:
- Fail fast with clear error message
- Provide installation instructions for popular frameworks
- Suggest: "Install test framework first with: npm install -D jest"

**Prevention**: Add preCheck for test framework existence

---

### 4.2 Test Implementation Failures

#### Dependencies Too Complex to Mock
**Symptoms**:
- Function has 10+ external dependencies
- Circular dependencies between modules
- Dependencies require complex initialization

**Detection**: Task 2 struggles to create working mocks

**Recovery**:
- Implement basic mocks for primary dependencies only
- Test through public interface if possible
- Suggest refactoring function (but don't do it)
- Fall back to integration test suggestion

**Prevention**: Warn user in Task 1 if dependency count >5

---

#### Async/Promise Handling Errors
**Symptoms**:
- Tests timeout waiting for promises
- Unhandled promise rejections
- Race conditions in async tests

**Detection**: Test execution hangs or fails with timeout

**Recovery**:
- Add proper async/await syntax
- Increase test timeout for slow operations
- Add `.resolves`/`.rejects` matchers
- Ensure all promises are awaited or returned

**Prevention**: Better async detection in Task 1, explicit async test template

---

#### Type System Conflicts
**Symptoms**:
- TypeScript errors in test file
- Mock types don't match real types
- Generic type inference failures

**Detection**: Test file compilation fails

**Recovery**:
- Add explicit type annotations to mocks
- Use `as unknown as Type` for complex mocks
- Import types correctly from source file

**Prevention**: Analyze types in Task 1, use TypeScript-aware test templates

---

### 4.3 Test Execution Failures

#### Tests Fail After Creation
**Symptoms**:
- Tests execute but some/all fail
- Assertion errors
- Unexpected return values

**Detection**: Task 3 test run reports failures

**Root Causes**:
- Misunderstood function behavior
- Incorrect mock return values
- Wrong assumptions about edge cases

**Recovery Strategy**:
1. Analyze failure messages carefully
2. Re-read function implementation for misunderstood logic
3. Adjust test expectations or mock values
4. Re-run tests
5. If >3 retries, escalate to user with specific questions

**Prevention**: More thorough code analysis in Task 1

---

#### Flaky Tests
**Symptoms**:
- Tests pass sometimes, fail others
- Different results on multiple runs
- Timing-dependent failures

**Detection**: Run tests 3 times, compare results

**Root Causes**:
- Uninitialized state between tests
- Shared mutable state
- Real timers/dates instead of mocks
- Race conditions

**Recovery**:
- Add proper cleanup in `afterEach`
- Mock Date/timers
- Ensure test isolation
- Use deterministic seeds for random values

**Prevention**: Use isolated test template with proper setup/teardown

---

#### Import/Module Resolution Errors
**Symptoms**:
- Cannot find module errors
- Import paths don't resolve
- Tsconfig paths not working in tests

**Detection**: Test file execution fails immediately

**Recovery**:
- Check test file location matches source file structure
- Adjust import paths (relative vs absolute)
- Check tsconfig.json paths configuration
- Add moduleNameMapper if using Jest

**Prevention**: Analyze import patterns in existing tests (Task 1)

---

### 4.4 Framework/Environment Failures

#### Wrong Test Framework Detected
**Symptoms**:
- Tests use Jest syntax but Vitest is configured
- Matchers don't exist (e.g., `expect.anything()` in Vitest)

**Detection**: Syntax errors or undefined matcher errors

**Recovery**:
- Re-detect framework from config files
- Ask user to specify framework explicitly
- Convert syntax to correct framework

**Prevention**: Multi-file detection (package.json + config files)

---

#### Test Command Fails
**Symptoms**:
- `npm test` exits with error before running tests
- Test runner not found
- Config file errors

**Detection**: Bash command to run tests fails

**Recovery**:
- Try alternative commands (`npm run test`, `npx jest`, `yarn test`)
- Check test script in package.json
- Report specific error to user

**Prevention**: Validate test command works in preCheck

---

### 4.5 Quality/Coverage Failures

#### Coverage Doesn't Increase
**Symptoms**:
- Tests pass but coverage stays same or decreases
- Function appears untested despite test file

**Root Causes**:
- Testing wrong function (name collision)
- Coverage tool not tracking test file
- Function actually in different file

**Detection**: Compare coverage before/after

**Recovery**:
- Verify test file imports correct function
- Check coverage tool configuration
- Run coverage with verbose output

**Prevention**: Verify function import path in Task 1

---

#### Code Quality Issues Block Testing
**Symptoms**:
- Target function has HIGH severity issues
- Function behavior is unclear/buggy
- Inconsistent return values

**Detection**: Metabob scan in Task 1

**Recovery Options**:
1. **Recommended**: Report issues, ask if should proceed
2. **Fallback**: Test actual behavior, document known issues in comments
3. **Abort**: Refuse to test broken code

**Prevention**: Always run quality scan before testing

---

### 4.6 Git/Version Control Failures

#### Commit Fails
**Symptoms**:
- Git commit command returns error
- Pre-commit hooks fail
- Dirty working directory

**Detection**: Bash git commit exits non-zero

**Recovery**:
- Stage test file explicitly
- Fix any linting issues
- Bypass hooks if user approves (`--no-verify`)

**Prevention**: Run git status preCheck

---

### Failure Rate Estimates
Based on pattern analysis and expected usage:

| Failure Mode | Probability | Severity | Recovery Cost |
|--------------|-------------|----------|---------------|
| Function Not Found | 10% | High | Low (fast search) |
| Framework Missing | 5% | High | Zero (fail fast) |
| Dependencies Complex | 15% | Medium | Medium (suggest alternatives) |
| Tests Fail After Creation | 20% | Medium | Medium (iterative fixing) |
| Async Handling Errors | 8% | Low | Low (pattern fix) |
| Flaky Tests | 5% | Medium | Medium (requires investigation) |
| Wrong Framework | 3% | Low | Low (syntax conversion) |

**Overall Expected Success Rate**: 85-90% first attempt, 95%+ with retries

---

## 5. PREREQUISITES: What Must Exist Before Running

### 5.1 Codebase Requirements

#### Target Function
- ✅ Function must exist in the codebase
- ✅ Function must be in an identifiable file (not generated code)
- ✅ Function must have deterministic behavior (testable)
- ✅ File containing function must be readable

#### Test Infrastructure
- ✅ **Required**: Test framework installed (jest, vitest, mocha, etc.)
- ✅ **Required**: Test framework configured (config file exists)
- ✅ **Required**: Working test command in package.json or known test runner
- ✅ **Recommended**: Existing test files to learn patterns from

#### Project Structure
- ✅ Git repository initialized (for commit step)
- ✅ Node.js project with package.json
- ✅ Test directory exists (e.g., `tests/`, `__tests__/`, `src/**/*.test.ts`)

### 5.2 Environment Requirements

#### Tools
- ✅ Node.js installed and accessible
- ✅ Package manager (npm, yarn, pnpm) available
- ✅ Git CLI installed
- ✅ Test framework CLI accessible (npx jest, npm test, etc.)

#### Permissions
- ✅ Write permission to test directory
- ✅ Git commit permission
- ✅ Ability to execute test commands

### 5.3 User Input Requirements

#### Required Variables
- ✅ `function_name` (string): Name of function to test
  - Examples: "calculateTotal", "UserService.login", "validateEmail"
  - Must be exact function name as it appears in code
  
- ✅ `file_path` (string): Relative path to file containing function
  - Examples: "src/utils/math.ts", "lib/services/UserService.js"
  - Must be relative to project root
  - File must exist and be readable

#### Optional Variables
- `test_framework` (string): Override auto-detection
  - Values: "jest", "vitest", "mocha", "auto" (default)
  - Use if auto-detection fails or multiple frameworks exist

- `coverage_goal` (string): Test thoroughness level
  - Values: "basic", "standard" (default), "comprehensive"
  - Affects number of edge cases generated

### 5.4 State Requirements

#### Clean State
- ✅ No uncommitted changes to target function file (prevent conflicts)
- ✅ No existing test file conflicts (will augment if exists)
- ✅ Tests passing before activity starts (baseline)

#### Information Availability
- ✅ Ability to read existing test files (learn patterns)
- ✅ Ability to search codebase (find similar tests)
- ✅ Access to Metabob tools (optional but recommended)

### 5.5 Pre-Checks (Automated)

The activity should automatically verify before starting:

```bash
# 1. File exists
test -f "$file_path"

# 2. Git repo exists
git rev-parse --git-dir

# 3. Test framework detected
npm list jest || npm list vitest || npm list mocha

# 4. Test command works
npm run test -- --version || npx jest --version

# 5. Function findable (basic check)
grep -q "$function_name" "$file_path"
```

### 5.6 What Does NOT Need to Exist

#### Not Required
- ❌ Existing tests for the target function (we're adding them)
- ❌ Documentation for the function (we'll infer behavior)
- ❌ Type definitions (will work with JS or TS)
- ❌ Perfect code quality (will test as-is)
- ❌ Metabob integration (optional enhancement)
- ❌ Code coverage tools configured (nice to have)
- ❌ CI/CD pipeline (tests work locally first)

---

## 6. SIDE EFFECTS: What Changes This Activity Makes

### 6.1 File System Changes

#### New Files Created
- **Test File**: `[function-name].test.[ext]` or `[function-name].spec.[ext]`
  - Location: Mirror source file structure or in dedicated test directory
  - Size: ~200-500 lines (5-10 tests with setup)
  - Format: Matches project test file extension (.ts, .js, .tsx, .jsx)

#### Modified Files
- **Existing Test File** (if test file for module already exists):
  - Augmented with new test suite for target function
  - Existing tests unchanged, new tests appended

#### No Changes To
- ✅ Source function implementation (zero changes)
- ✅ Other source files
- ✅ Configuration files (jest.config, tsconfig, etc.)
- ✅ Package.json dependencies
- ✅ Documentation files

### 6.2 Version Control Changes

#### Git Commits
- **Count**: Exactly 1 commit
- **Commit Message Format**: 
  ```
  Add unit tests for [function_name] in [file_path]
  
  - Added [N] test scenarios covering success, edge, and error cases
  - Test coverage for [function_name] increased to [X]%
  ```
- **Files Staged**: Only the test file
- **Branch**: Current branch (no branch creation)

#### Git State After
- ✅ Working directory clean (all changes committed)
- ✅ No untracked files (test file committed)
- ✅ Current branch HEAD moved forward by 1 commit

### 6.3 Test Suite Changes

#### Test Count
- **Added**: 5-15 new tests (depending on function complexity)
- **Modified**: 0 (existing tests unchanged)
- **Removed**: 0

#### Coverage Changes
- **Function Coverage**: Target function goes from 0% → 90%+
- **Project Coverage**: Overall coverage increases by 0.1-5% (depending on project size)
- **Uncovered Lines**: Focus on target function, may leave some edge cases

#### Test Execution Time
- **Added Time**: 50-500ms per test run (unit tests are fast)
- **Impact**: Minimal impact on CI/CD pipeline duration

### 6.4 Metabob Integration Effects (If Enabled)

#### Annotations Created
- **Component Annotation**: Documents test strategy for target function
  - Component: `[file]::test([function_name])`
  - Annotation Type: "testing-strategy"
  - Content: Test scenarios covered, mocking approach

#### Learning Updates
- **Resolution**: If function had issues, tests serve as behavioral baseline
- **Related Changes**: Test file linked to source file in co-change graph

#### No Impact On
- ✅ Existing Metabob issues (not resolved automatically)
- ✅ Issue priority scores
- ✅ Code quality analysis (read-only)

### 6.5 Development Workflow Changes

#### Developer Experience
- ✅ Tests available for running (`npm test [file]`)
- ✅ Coverage reporting includes new tests
- ✅ Future changes to function will run these tests
- ✅ CI/CD pipeline will execute new tests

#### Code Review Impact
- ✅ Test file appears in pull request diff
- ✅ Reviewers can see test scenarios
- ✅ Coverage report shows improvement

#### Refactoring Safety
- ✅ Function now has regression tests
- ✅ Safe to refactor with test safety net
- ✅ Breaking changes will be caught by tests

### 6.6 No External Side Effects

#### What Does NOT Change
- ❌ Production code behavior (zero runtime impact)
- ❌ Dependencies (no new packages installed)
- ❌ Build output (test files excluded from builds)
- ❌ Deployment process (tests don't deploy)
- ❌ External systems (no API calls, DB writes)
- ❌ User data or state
- ❌ Other team members' work (isolated to test file)

### 6.7 Reversibility

#### Easy to Undo
If activity needs to be reverted:

```bash
# Revert commit
git revert HEAD

# Or hard reset (if commit not pushed)
git reset --hard HEAD~1

# Delete test file
rm [test-file-path]
```

**Data Loss Risk**: None (only test code deleted)

### 6.8 Observable Metrics Changes

#### Before Activity
- Function: X% coverage, 0 tests
- Project: Y% coverage, N tests
- Git: M commits

#### After Activity
- Function: >90% coverage, 5-15 tests
- Project: Y+Δ% coverage (Δ = 0.1-5%), N+5-15 tests
- Git: M+1 commits

---

## 7. Scope Compliance Checklist

Use this checklist during execution to ensure activity stays in scope:

### In-Scope Compliance
- [ ] Target function identified and validated
- [ ] Test scenarios documented before implementation
- [ ] Test file created in correct location
- [ ] All tests pass after implementation
- [ ] Git commit created with clear message
- [ ] No implementation code modified

### Out-of-Scope Violations (Alert if detected)
- [ ] ⚠️ Activity modified function implementation
- [ ] ⚠️ Activity created integration tests
- [ ] ⚠️ Activity installed test framework
- [ ] ⚠️ Activity tested multiple functions
- [ ] ⚠️ Activity refactored existing code

### Success Criteria Met
- [ ] ≥5 tests created
- [ ] 100% test pass rate
- [ ] No skipped tests
- [ ] Coverage increased
- [ ] Commit successful

### Prerequisite Verification
- [ ] Function exists in specified file
- [ ] Test framework detected
- [ ] Test command works
- [ ] Git repository initialized

---

## 8. Measurement & Validation

### Automated Validation (Post-Execution)

```bash
# 1. Test file exists
test -f "[test-file-path]" || echo "FAIL: Test file not created"

# 2. Tests pass
npm test -- "[test-file-path]" || echo "FAIL: Tests not passing"

# 3. Test count
test_count=$(grep -c "^\s*it\|^\s*test" "[test-file-path]")
[ "$test_count" -ge 5 ] || echo "FAIL: Insufficient tests ($test_count < 5)"

# 4. No skipped tests
grep -q "it.skip\|test.skip" "[test-file-path]" && echo "FAIL: Skipped tests found"

# 5. Git commit
git log -1 --oneline | grep -q "[function_name]" || echo "FAIL: Commit missing"

# 6. No implementation changes
git diff HEAD~1 "[file_path]" | grep -q "^+" && echo "FAIL: Implementation modified"
```

### Manual Validation (Code Review)

#### Test Quality Review
- [ ] Test names describe behavior, not implementation
- [ ] Tests follow AAA pattern (Arrange-Act-Assert)
- [ ] Mocks are appropriate and minimal
- [ ] Edge cases are meaningful, not trivial
- [ ] Error cases test actual error conditions

#### Integration Review
- [ ] Tests match project patterns
- [ ] Imports resolve correctly
- [ ] Test structure follows conventions
- [ ] No copy-paste code duplication

---

## 9. Risk Assessment

### Low Risk Factors ✅
- Only adds code, doesn't modify existing code
- Unit tests are isolated, no external dependencies
- Fast rollback (single commit revert)
- High validation confidence (tests must pass)

### Medium Risk Factors ⚠️
- May misunderstand function behavior (test wrong thing)
- Mocks may not reflect real dependency behavior
- Could create flaky tests if not careful with state

### High Risk Factors 🚫
- **None identified** - this is a low-risk activity

### Mitigation Strategies
- **Risk**: Tests pass but test wrong behavior
  - **Mitigation**: Thorough code analysis in Task 1, Metabob quality scan
  
- **Risk**: Flaky tests introduced
  - **Mitigation**: Run tests multiple times in Task 3, enforce isolation

---

## 10. Summary Table

| Dimension | Value |
|-----------|-------|
| **Primary Goal** | Add unit tests for single function |
| **Scope** | One function, unit tests only |
| **Duration** | 5-10 minutes |
| **File Changes** | 1 test file (new or augmented) |
| **Git Commits** | Exactly 1 |
| **Implementation Changes** | Zero |
| **Minimum Tests** | 5 (success + edge + error) |
| **Success Criteria** | All tests pass, coverage increases |
| **Failure Rate** | 10-15% (85-90% success) |
| **Prerequisites** | Function exists, test framework installed |
| **Side Effects** | Test file created, coverage increases, git commit |
| **Risk Level** | Low (non-destructive, reversible) |
| **Reversibility** | High (single commit revert) |

---

## Document Control

**Version**: 1.0  
**Authors**: OpenCode Agent  
**Reviewers**: [Pending]  
**Approval**: [Pending]  
**Next Review**: After first 10 executions

**Change Log**:
- 2026-02-16: Initial scope definition created based on PATTERN_ANALYSIS.md
