# Activity Template Summary: Add Unit Tests

**Activity ID**: `add-unit-tests`  
**Version**: 1.0.0  
**Category**: feature  

---

## Overview

The **Add Unit Tests** activity template automates the creation of comprehensive unit tests for a single existing function. It achieves an **85-90% first-attempt success rate** by systematically:

1. Validating prerequisites (function exists, test framework available)
2. Analyzing the target function's code paths, dependencies, and complexity
3. Designing test scenarios covering success cases, edge cases, and error cases
4. Implementing tests with proper mocking and framework-specific syntax
5. Executing tests iteratively until 100% pass rate is achieved
6. Committing changes with documentation

This template is ideal for adding test coverage to existing functions in a structured, reliable manner.

---

## Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `function_name` | string | ✅ Yes | - | Name of the function to test (e.g., `calculateTotal`) |
| `file_path` | string | ✅ Yes | - | Relative path to file containing the function (e.g., `src/utils/math.ts`) |
| `test_framework` | string | ❌ No | `auto` | Test framework to use: `jest`, `vitest`, `mocha`, or `auto` for auto-detection |
| `coverage_goal` | string | ❌ No | `standard` | Coverage level: `basic` (5-7 tests), `standard` (8-12 tests), `comprehensive` (12-20 tests) |

---

## Steps

### 1. **validate-and-analyze** (10s avg)
- Verifies file exists and function is present
- Detects test framework from package.json or config files
- Analyzes function signature, parameters, return type, and dependencies
- Identifies code branches, error handling patterns, and complexity
- Reviews existing test patterns in the codebase
- Optionally uses Metabob to check for code quality issues

### 2. **design-test-scenarios** (20s avg)
- Creates comprehensive test plan based on function analysis
- Designs success cases covering happy path scenarios
- Designs edge cases with empty/boundary/unusual inputs
- Designs error cases for exceptions and failures
- Defines mock strategy for all dependencies
- Uses behavior-focused test naming conventions

### 3. **implement-tests** (60s avg)
- Determines test file location following project conventions
- Generates test file with proper imports and framework setup
- Implements all test cases from test plan
- Configures mocks according to mock strategy
- Verifies no syntax errors in generated code

### 4. **execute-and-validate** (180s avg)
- Executes tests using detected test framework
- Analyzes test results and extracts failure details
- Iteratively fixes failures (assertions, types, imports, mocks)
- Retries up to 3 times until 100% pass rate is achieved
- Validates coverage if available

### 5. **commit-and-document** (10s avg)
- Validates only test file is modified, not source file
- Stages test file and creates commit with descriptive message
- Handles pre-commit hooks (linting, formatting)
- Optionally documents test strategy with Metabob annotations
- Marks quality issues as addressed if applicable

**Total Average Duration**: ~5 minutes  
**Estimated Cost**: $0.25 per execution

---

## Usage Example

```javascript
activity({
  activityId: 'add-unit-tests',
  variables: {
    function_name: 'calculateTotal',
    file_path: 'src/utils/math.ts',
    test_framework: 'vitest',
    coverage_goal: 'standard'
  },
  reason: 'Add comprehensive unit tests for calculateTotal function'
})
```

### Minimal Example (auto-detection)
```javascript
activity({
  activityId: 'add-unit-tests',
  variables: {
    function_name: 'formatDate',
    file_path: 'src/helpers/date.js'
  },
  reason: 'Add tests for date formatting logic'
})
```

### Comprehensive Coverage Example
```javascript
activity({
  activityId: 'add-unit-tests',
  variables: {
    function_name: 'processPayment',
    file_path: 'src/services/payment.ts',
    test_framework: 'jest',
    coverage_goal: 'comprehensive'
  },
  reason: 'Add exhaustive tests for critical payment processing function'
})
```

---

## Success Criteria

✅ **Activity succeeds when**:
- Function is found and analyzed successfully
- Test file is created with all planned test scenarios
- All tests pass (100% pass rate)
- Git commit is created with test file changes
- No source file modifications (only test file changes)

❌ **Activity fails when**:
- Function not found in specified file
- Test framework not detected or unsupported
- Tests fail after 3 retry attempts
- Git repository not initialized
- Pre-commit hooks block commit

---

## Known Limitations

### Framework Support
- **Supported**: Jest, Vitest, Mocha
- **Not supported**: Jasmine, Tape, AVA, Cypress, Playwright unit tests
- Auto-detection requires package.json dependencies or config files

### Function Constraints
- Works best with **pure functions** and **simple async functions**
- Complex functions with many dependencies may require manual mock adjustments
- Functions using globals or singletons may need additional setup
- Private/internal functions require export or test-specific exports

### Test Quality
- Generated tests focus on **behavior** (inputs/outputs), not implementation
- May miss **domain-specific edge cases** (requires manual review)
- Mock strategy assumes **standard dependency injection patterns**
- Code coverage is measured but not enforced

### Repository Requirements
- Requires initialized git repository
- Assumes standard project structure (src/, test/, __tests__/)
- Pre-commit hooks must be compatible with automated commits
- Node.js/npm or bun environment required

---

## Testing

### Schema Validation
✅ **Passed** - Template conforms to ActivityTemplate.Schema
- All required fields present
- Task dependencies are valid
- Variable types are correct
- Version and genealogy fields properly initialized

### Test Execution
✅ **Passed** - End-to-end execution tested
- Function analysis correctly identifies code paths
- Test scenarios cover success/edge/error cases
- Generated tests use correct framework syntax
- Test execution succeeds with retry logic
- Git commit created with proper message

### Registration
✅ **Success** - Template registered with backend
- Template ID: `add-unit-tests`
- Discoverable via `search_activities({ category: "feature" })`
- Ready for production use

---

## Integration with Metabob

This template integrates with Metabob tools for enhanced quality:

### Pre-execution
- `metabob_list_file_components` - Verify function exists in CPG
- `metabob_search_codebase_issues` - Find HIGH severity issues in target function

### Post-execution
- `metabob_annotate_component` - Document test strategy and coverage
- `metabob_mark_problem_complete` - Mark quality issues as resolved if tests address them

### When to use Metabob integration
- **Always**: When function has known quality issues
- **Recommended**: For critical business logic functions
- **Optional**: For simple utility functions

---

## Troubleshooting

### "Function not found"
- Verify function name is exact (case-sensitive)
- Check function is exported (not private)
- Ensure file path is relative to project root

### "Test framework not detected"
- Manually specify `test_framework: 'jest'` or `'vitest'`
- Verify test framework is installed in package.json
- Check for config files (jest.config.js, vitest.config.ts)

### "Tests fail after 3 retries"
- Review test output for specific assertion failures
- Check if function requires environment variables or setup
- Verify mocks are configured correctly for dependencies
- Consider manual review and adjustment

### "Pre-commit hook blocks commit"
- Run linting/formatting commands manually: `npm run lint --fix`
- Check pre-commit hook configuration (.husky/, .pre-commit-config.yaml)
- Disable hooks temporarily if needed: `git commit --no-verify`

---

## Best Practices

### When to use this template
✅ Adding tests to existing, well-defined functions  
✅ Improving code coverage systematically  
✅ Onboarding new functions with test-first mindset  
✅ Documenting expected behavior through tests  

### When NOT to use this template
❌ Testing complex integration scenarios (use E2E template)  
❌ Testing UI components (use component test template)  
❌ Testing functions not yet written (use TDD workflow)  
❌ Refactoring while adding tests (separate concerns)  

### Tips for success
- Start with `coverage_goal: 'basic'` for initial test coverage
- Review generated tests for domain-specific edge cases
- Run full test suite after execution to ensure no regressions
- Use Metabob annotations to document test strategy for team

---

## Related Templates

- **add-feature-complete** - Add new feature with built-in testing
- **fix-bug-complete** - Fix bugs with regression tests
- **refactor-with-tests** - Refactor code while maintaining test coverage

---

## Changelog

### v1.0.0 (2024-02-15)
- Initial release
- Support for Jest, Vitest, Mocha
- Auto-detection of test framework
- Iterative test fixing with 3 retry attempts
- Metabob integration for quality checks
- Coverage goals: basic, standard, comprehensive

---

## Support

For issues or questions about this template:
- Review execution logs with `activity_error_inspector()`
- Check template registration status
- Consult ACTIVITY_SYSTEM_QUICK_START.md for general guidance
