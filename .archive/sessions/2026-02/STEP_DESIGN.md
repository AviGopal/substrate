# Step Design: add-unit-tests-v1

**Template ID**: `add-unit-tests-v1`  
**Category**: Testing  
**Status**: Design Phase  
**Last Updated**: 2026-02-16

---

## Overview

This document defines the execution steps for the `add-unit-tests-v1` activity template. Each step is independently testable and includes clear validation criteria.

**Goal**: Add comprehensive unit tests for a single existing function with 85-90% first-attempt success rate.

**Total Steps**: 5  
**Estimated Duration**: 5-10 minutes  
**Failure Recovery**: Built into each step

---

## Step 1: Validate Prerequisites and Analyze Function

### Step ID
`validate-and-analyze`

### Description
Validate that all prerequisites are met (function exists, test framework available) and perform comprehensive analysis of the target function including its signature, dependencies, code paths, and existing test patterns.

### Dependencies
- None (first step)

### Required Tools
- **read**: Read target function source file
- **bash**: Execute validation commands (git check, framework detection, function search)
- **grep**: Search for similar test patterns in codebase
- **metabob_search_codebase_issues**: Search for code quality issues in target function (optional)
- **metabob_list_file_components**: Verify function exists and get exact component name (optional)

### Inputs
- `function_name` (string): Name of function to test
- `file_path` (string): Relative path to file containing function
- `test_framework` (string, optional): Override auto-detection ("jest", "vitest", "mocha", "auto")

### Outputs
- `function_analysis` (object):
  - `exists` (boolean): Function found in file
  - `signature` (string): Full function signature
  - `is_async` (boolean): Whether function is async/returns Promise
  - `parameters` (array): List of parameter names and types
  - `return_type` (string): Return type if detectable
  - `dependencies` (array): External dependencies (imports, DB, API calls)
  - `code_paths` (number): Estimated number of code branches
  - `error_handling` (array): List of error cases (throws, rejects, returns null)
  - `complexity` (string): "simple", "medium", "complex"
  
- `test_framework` (object):
  - `name` (string): "jest", "vitest", "mocha", or "unknown"
  - `version` (string): Framework version
  - `config_path` (string): Path to config file
  - `test_command` (string): Command to run tests (e.g., "npm test")
  - `test_file_pattern` (string): Expected test file naming (e.g., "*.test.ts")
  
- `existing_patterns` (object):
  - `similar_tests` (array): List of similar test files found
  - `mock_strategy` (string): Detected mocking approach ("jest.mock", "vi.mock", "sinon", etc.)
  - `test_structure` (string): Detected structure pattern ("describe/it", "test()", etc.)
  
- `quality_issues` (array): List of HIGH severity issues from Metabob (if available)

- `validation_status` (object):
  - `all_checks_passed` (boolean): Overall validation result
  - `checks` (object):
    - `file_exists` (boolean)
    - `function_found` (boolean)
    - `git_repo_exists` (boolean)
    - `test_framework_detected` (boolean)
    - `test_command_works` (boolean)

### Validation Criteria

#### Success Criteria
1. `validation_status.all_checks_passed === true`
2. `function_analysis.exists === true`
3. `test_framework.name !== "unknown"`
4. `test_framework.test_command` executes without error
5. Function signature successfully extracted

#### Failure Conditions
- **Function Not Found**: `grep` returns no matches → Search broader codebase, suggest similar names
- **Test Framework Missing**: No framework detected → Fail fast with installation instructions
- **Git Not Initialized**: `git rev-parse` fails → Warn user, continue without commit capability
- **Function Ambiguous**: Multiple matches → Present all, request clarification

### Agent Guidance

#### Code Analysis Strategy
1. **Read entire file** containing function (don't just grep)
2. **Identify function boundaries**: Use syntax parsing or line counting
3. **Extract imports**: Look for all `import`/`require` statements
4. **Detect async patterns**: 
   - `async function`
   - `return new Promise`
   - `Promise.resolve/reject`
   - `.then()/.catch()` chains
5. **Count branches**: Look for `if`, `switch`, `try/catch`, `||`, `&&`, ternaries
6. **Identify error handling**:
   - `throw new Error`
   - `Promise.reject`
   - `return null/undefined` on error
   - `try/catch` blocks

#### Framework Detection Priority
1. Check `package.json` dependencies: `"jest"`, `"vitest"`, `"mocha"`
2. Look for config files: `jest.config.js`, `vitest.config.ts`, `.mocharc.json`
3. Check `package.json` test script: `"test": "jest"` → framework is Jest
4. If multiple frameworks found, prefer most recently used (check test files)
5. Default to "unknown" if detection fails (don't guess)

#### Test Pattern Learning
1. **Find similar tests**: Search for test files that test functions in same directory
2. **Analyze structure**: Are tests grouped with `describe`? Flat `test()` calls?
3. **Check mock patterns**: 
   - Jest: `jest.mock('../module')`, `jest.fn()`
   - Vitest: `vi.mock`, `vi.fn()`
   - Manual: `class MockService {}`
4. **Note conventions**: 
   - Test file location (co-located vs `tests/` directory)
   - Import style (relative vs absolute)
   - Assertion style (`expect` vs `assert`)

#### Quality Issue Handling
- If HIGH severity issues found in target function:
  - **Log warning**: "Function has HIGH severity issues: [list]"
  - **Ask user**: "Proceed with testing buggy code? (y/n)"
  - **Document in output**: Include issues in `quality_issues` array
  - **Continue**: Test actual behavior, note issues in test comments

#### Error Recovery
- **Function not found**:
  ```bash
  # Search broader
  rg "$function_name" --type typescript --type javascript
  # Suggest similar names (fuzzy match)
  ```
  
- **Framework detection fails**:
  ```
  ERROR: No test framework detected
  INSTALL: npm install -D jest @types/jest
  CONFIG: npx jest --init
  ```

#### Performance Notes
- File reading: <1 second for files <5000 lines
- Framework detection: ~100-500ms (checking package.json + configs)
- Code quality scan: 1-3 seconds (cached)
- **Total step time**: 2-5 seconds typical

### Example Output Structure

```json
{
  "function_analysis": {
    "exists": true,
    "signature": "async function validateEmail(email: string): Promise<boolean>",
    "is_async": true,
    "parameters": [{"name": "email", "type": "string"}],
    "return_type": "Promise<boolean>",
    "dependencies": ["EmailValidator", "database.query"],
    "code_paths": 5,
    "error_handling": ["throws ValidationError", "rejects on DB error"],
    "complexity": "medium"
  },
  "test_framework": {
    "name": "jest",
    "version": "29.5.0",
    "config_path": "jest.config.js",
    "test_command": "npm test",
    "test_file_pattern": "*.test.ts"
  },
  "existing_patterns": {
    "similar_tests": ["src/utils/validation.test.ts"],
    "mock_strategy": "jest.mock",
    "test_structure": "describe/it"
  },
  "quality_issues": [],
  "validation_status": {
    "all_checks_passed": true,
    "checks": {
      "file_exists": true,
      "function_found": true,
      "git_repo_exists": true,
      "test_framework_detected": true,
      "test_command_works": true
    }
  }
}
```

---

## Step 2: Design Test Scenarios

### Step ID
`design-test-scenarios`

### Description
Create a comprehensive test plan covering success cases, edge cases, and error cases based on the function analysis. Document each test scenario with arrange-act-assert breakdown and mocking strategy.

### Dependencies
- **Step 1** (`validate-and-analyze`): Requires `function_analysis`, `test_framework`, `existing_patterns`

### Required Tools
- None (pure planning step, outputs structured data)

### Inputs
- `function_analysis` (from Step 1)
- `existing_patterns` (from Step 1)
- `coverage_goal` (string, optional): "basic" (5-7 tests), "standard" (8-12 tests, default), "comprehensive" (12-20 tests)

### Outputs
- `test_plan` (object):
  - `success_cases` (array): List of normal operation tests (min 2)
  - `edge_cases` (array): List of boundary/edge condition tests (min 3)
  - `error_cases` (array): List of error handling tests (min 1)
  - `mock_strategy` (object): How to mock each dependency
  - `total_test_count` (number): Total tests planned
  
- Each test scenario includes:
  - `id` (string): Unique test ID (e.g., "success_01")
  - `name` (string): Descriptive test name
  - `category` (string): "success", "edge", "error"
  - `arrange` (object): Setup steps
    - `inputs` (object): Input values for function
    - `mocks` (array): Mocks to configure
    - `setup` (string): Any additional setup code
  - `act` (string): Function call to execute
  - `assert` (object): Expected outcomes
    - `return_value` (any): Expected return value
    - `throws` (string): Expected error (if error case)
    - `side_effects` (array): Expected side effects (DB writes, API calls)

### Validation Criteria

#### Success Criteria
1. `test_plan.total_test_count >= 5`
2. `test_plan.success_cases.length >= 2`
3. `test_plan.edge_cases.length >= 3`
4. `test_plan.error_cases.length >= 1` (if function can error)
5. All test scenarios have complete arrange-act-assert breakdown
6. Mock strategy defined for each external dependency
7. No duplicate test scenarios (validate uniqueness)

#### Failure Conditions
- **Insufficient coverage**: Total tests < 5 → Add more edge cases
- **Missing error tests**: Function throws but no error tests → Add rejection/throw tests
- **Trivial edge cases**: All edges are just "empty string" → Generate more meaningful edges
- **Impossible mocks**: Dependency cannot be mocked → Suggest integration test instead

### Agent Guidance

#### Success Case Design (2-3 tests)
1. **Happy path**: Most common use case with valid inputs
2. **Alternative success**: Different valid input pattern (e.g., optional params provided)
3. **Boundary success**: Valid input at edge of range (e.g., max valid length)

**Example for `validateEmail(email: string)`**:
- Success 1: "Valid email with standard format" → `validateEmail("user@example.com")`
- Success 2: "Valid email with subdomain" → `validateEmail("user@mail.company.com")`
- Success 3: "Valid email with plus addressing" → `validateEmail("user+tag@example.com")`

#### Edge Case Design (3-5 tests)
Focus on **boundaries and special values**:
- Empty inputs: `""`, `[]`, `{}`, `null`, `undefined`
- Boundary values: `0`, `-1`, `MAX_INT`, empty array, single-item array
- Special characters: Unicode, emoji, escape sequences
- Type variations: `"0"` vs `0`, `"true"` vs `true`
- Unusual but valid inputs: Very long strings, large numbers

**Example for `validateEmail(email: string)`**:
- Edge 1: "Empty string" → `validateEmail("")` → should return false
- Edge 2: "Email without domain" → `validateEmail("user@")` → false
- Edge 3: "Email with multiple @" → `validateEmail("user@@example.com")` → false
- Edge 4: "Email with unicode" → `validateEmail("用户@例え.jp")` → true
- Edge 5: "Very long email (>254 chars)" → `validateEmail("a".repeat(300) + "@example.com")` → false

#### Error Case Design (1-3 tests)
Only if function explicitly errors:
- **Throws error**: Function throws exception
- **Rejects promise**: Async function rejects
- **Returns error value**: Returns `null`/`undefined`/`false` on error

**Example for async `validateEmail` that queries DB**:
- Error 1: "Database connection fails" → Mock DB to throw → expect rejection
- Error 2: "Invalid input type" → `validateEmail(null)` → expect TypeError
- Error 3: "Email validation timeout" → Mock slow DB → expect timeout error

#### Mock Strategy Design

For each dependency in `function_analysis.dependencies`:

1. **External API/Service**:
   ```javascript
   mock_strategy: {
     type: "jest.mock",
     module: "./EmailValidator",
     methods: {
       validate: jest.fn().mockResolvedValue(true)
     }
   }
   ```

2. **Database**:
   ```javascript
   mock_strategy: {
     type: "manual",
     approach: "Inject mock connection",
     setup: "const mockDB = { query: jest.fn() }"
   }
   ```

3. **File System**:
   ```javascript
   mock_strategy: {
     type: "jest.mock",
     module: "fs",
     methods: {
       readFileSync: jest.fn().mockReturnValue("data")
     }
   }
   ```

#### Avoid Common Pitfalls
- ❌ **Don't**: Test implementation details (e.g., "should call X 3 times")
- ✅ **Do**: Test observable behavior (e.g., "should return filtered list")

- ❌ **Don't**: Create trivial edge cases (e.g., "test with string 'a'")
- ✅ **Do**: Create meaningful edges (e.g., "test with empty string", "test with max length")

- ❌ **Don't**: Mock everything (over-mocking makes tests brittle)
- ✅ **Do**: Mock only external dependencies (network, DB, filesystem)

#### Test Naming Convention
Follow project convention or use behavior-focused names:
- **Pattern**: "should [expected behavior] when [condition]"
- **Examples**:
  - "should return true when email is valid"
  - "should return false when email has no domain"
  - "should reject when database connection fails"
  - "should handle unicode characters in email"

#### Coverage Goal Interpretation
- **basic** (5-7 tests): Minimal viable coverage
  - 2 success, 3 edge, 1 error (if applicable)
  
- **standard** (8-12 tests, default): Good production coverage
  - 3 success, 5 edge, 2 error
  
- **comprehensive** (12-20 tests): Exhaustive coverage
  - 4 success, 8 edge, 4 error, plus boundary combinations

#### Planning Output Format
Output must be structured JSON for Step 3 to consume:

```json
{
  "test_plan": {
    "success_cases": [
      {
        "id": "success_01",
        "name": "should return true when email is valid",
        "category": "success",
        "arrange": {
          "inputs": {"email": "user@example.com"},
          "mocks": [],
          "setup": ""
        },
        "act": "await validateEmail('user@example.com')",
        "assert": {
          "return_value": true,
          "throws": null,
          "side_effects": []
        }
      }
    ],
    "edge_cases": [...],
    "error_cases": [...],
    "mock_strategy": {
      "EmailValidator": {
        "type": "jest.mock",
        "module": "./EmailValidator",
        "methods": {"validate": "mockResolvedValue(true)"}
      }
    },
    "total_test_count": 10
  }
}
```

### Example Output Structure

```json
{
  "test_plan": {
    "success_cases": [
      {
        "id": "success_01",
        "name": "should return true when email is valid",
        "category": "success",
        "arrange": {
          "inputs": {"email": "user@example.com"},
          "mocks": [],
          "setup": ""
        },
        "act": "await validateEmail('user@example.com')",
        "assert": {
          "return_value": true,
          "throws": null,
          "side_effects": []
        }
      },
      {
        "id": "success_02",
        "name": "should return true for email with subdomain",
        "category": "success",
        "arrange": {
          "inputs": {"email": "user@mail.company.com"},
          "mocks": [],
          "setup": ""
        },
        "act": "await validateEmail('user@mail.company.com')",
        "assert": {
          "return_value": true,
          "throws": null,
          "side_effects": []
        }
      }
    ],
    "edge_cases": [
      {
        "id": "edge_01",
        "name": "should return false when email is empty string",
        "category": "edge",
        "arrange": {
          "inputs": {"email": ""},
          "mocks": [],
          "setup": ""
        },
        "act": "await validateEmail('')",
        "assert": {
          "return_value": false,
          "throws": null,
          "side_effects": []
        }
      },
      {
        "id": "edge_02",
        "name": "should return false when email has no domain",
        "category": "edge",
        "arrange": {
          "inputs": {"email": "user@"},
          "mocks": [],
          "setup": ""
        },
        "act": "await validateEmail('user@')",
        "assert": {
          "return_value": false,
          "throws": null,
          "side_effects": []
        }
      },
      {
        "id": "edge_03",
        "name": "should handle unicode characters correctly",
        "category": "edge",
        "arrange": {
          "inputs": {"email": "用户@例え.jp"},
          "mocks": [],
          "setup": ""
        },
        "act": "await validateEmail('用户@例え.jp')",
        "assert": {
          "return_value": true,
          "throws": null,
          "side_effects": []
        }
      }
    ],
    "error_cases": [
      {
        "id": "error_01",
        "name": "should reject when database connection fails",
        "category": "error",
        "arrange": {
          "inputs": {"email": "user@example.com"},
          "mocks": [
            {
              "target": "database.query",
              "behavior": "mockRejectedValue(new Error('Connection failed'))"
            }
          ],
          "setup": "const mockDB = { query: jest.fn().mockRejectedValue(new Error('Connection failed')) }"
        },
        "act": "await validateEmail('user@example.com')",
        "assert": {
          "return_value": null,
          "throws": "Error: Connection failed",
          "side_effects": []
        }
      }
    ],
    "mock_strategy": {
      "database": {
        "type": "jest.mock",
        "module": "../database",
        "methods": {
          "query": "mockResolvedValue({exists: true})"
        }
      }
    },
    "total_test_count": 6
  }
}
```

---

## Step 3: Implement Tests

### Step ID
`implement-tests`

### Description
Generate the test file with all planned test scenarios implemented using the detected test framework syntax, including proper imports, mocks, setup/teardown, and assertions.

### Dependencies
- **Step 1** (`validate-and-analyze`): Requires `test_framework`, `function_analysis`
- **Step 2** (`design-test-scenarios`): Requires `test_plan`

### Required Tools
- **read**: Read existing test files to match style (optional)
- **write**: Create new test file OR
- **edit**: Augment existing test file if already exists
- **bash**: Check if test file already exists

### Inputs
- `test_plan` (from Step 2)
- `test_framework` (from Step 1)
- `function_analysis` (from Step 1)
- `file_path` (original input): Source file path
- `function_name` (original input): Function name

### Outputs
- `test_file` (object):
  - `path` (string): Full path to test file created/modified
  - `created` (boolean): True if new file, false if augmented existing
  - `line_count` (number): Total lines in test file
  - `test_count` (number): Number of tests implemented
  - `imports` (array): List of imports added
  - `framework_syntax` (string): Framework used ("jest", "vitest", "mocha")

### Validation Criteria

#### Success Criteria
1. Test file exists at `test_file.path`
2. Test file has valid syntax (no parse errors)
3. `test_file.test_count === test_plan.total_test_count`
4. File imports target function correctly
5. All mocks are properly configured
6. No syntax errors (file can be parsed)
7. No `it.skip`, `test.skip`, or `describe.skip` present
8. No `console.log` statements
9. Async tests use `async`/`await` properly if function is async

#### Failure Conditions
- **File write fails**: Permission error → Check directory permissions, suggest fix
- **Import path wrong**: Module not found → Adjust relative path based on test file location
- **Type errors**: TypeScript compilation fails → Add type annotations, use `as unknown as Type`
- **Mock syntax invalid**: Framework doesn't support mock pattern → Use alternative mocking approach

### Agent Guidance

#### Test File Location Strategy

1. **Check for existing test file**:
   ```bash
   # If source is: src/utils/validation.ts
   # Check for:
   test -f src/utils/validation.test.ts || \
   test -f src/utils/validation.spec.ts || \
   test -f tests/utils/validation.test.ts || \
   test -f __tests__/utils/validation.test.ts
   ```

2. **If exists**: Use **edit** tool to augment (don't overwrite existing tests)
3. **If not exists**: Use **write** tool to create new file

4. **Naming convention** (follow project pattern or default):
   - Co-located: `[filename].test.[ext]` or `[filename].spec.[ext]`
   - Separate dir: `tests/[filepath].test.[ext]` or `__tests__/[filepath].test.[ext]`
   - Extension: Match source file (`.ts` → `.test.ts`, `.js` → `.test.js`)

#### Test File Structure Template

**Jest/Vitest Structure**:
```typescript
// Imports
import { functionName } from './path-to-source';
import { dependency } from './dependency';

// Mock declarations (before imports in Jest)
jest.mock('./dependency');

// Test suite
describe('functionName', () => {
  // Setup/teardown
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Success cases
  describe('success cases', () => {
    it('should [behavior] when [condition]', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await functionName(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('should [behavior] when [condition]', () => {
      // ...
    });
  });

  // Error cases
  describe('error cases', () => {
    it('should [behavior] when [condition]', async () => {
      // Arrange
      mockDependency.mockRejectedValue(new Error('test'));
      
      // Act & Assert
      await expect(functionName(input)).rejects.toThrow('test');
    });
  });
});
```

**Mocha Structure**:
```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const { functionName } = require('./path-to-source');

describe('functionName', () => {
  let mockDependency;

  beforeEach(() => {
    mockDependency = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('success cases', () => {
    it('should [behavior] when [condition]', async () => {
      // Arrange
      mockDependency.resolves(true);
      
      // Act
      const result = await functionName('test');
      
      // Assert
      expect(result).to.equal(true);
    });
  });
});
```

#### Import Path Calculation

Given:
- Source file: `src/utils/validation.ts`
- Test file: `src/utils/validation.test.ts` (co-located)

Import: `import { validateEmail } from './validation';`

Given:
- Source file: `src/utils/validation.ts`
- Test file: `tests/utils/validation.test.ts` (separate dir)

Import: `import { validateEmail } from '../../src/utils/validation';`

**Algorithm**:
1. Calculate relative path from test file to source file
2. Remove file extension
3. Ensure starts with `./` or `../`

#### Mock Implementation Patterns

**Jest - Module Mock**:
```typescript
jest.mock('./EmailValidator');
import { EmailValidator } from './EmailValidator';

// In test
(EmailValidator.validate as jest.Mock).mockResolvedValue(true);
```

**Jest - Function Mock**:
```typescript
const mockFn = jest.fn();
mockFn.mockReturnValue('result');
mockFn.mockResolvedValue('async result');
mockFn.mockRejectedValue(new Error('error'));
```

**Vitest - Module Mock**:
```typescript
import { vi } from 'vitest';
vi.mock('./EmailValidator');

// In test
(EmailValidator.validate as any).mockResolvedValue(true);
```

**Manual Mock**:
```typescript
class MockEmailValidator {
  async validate(email: string): Promise<boolean> {
    return true; // Hardcoded or configurable
  }
}
```

#### Async Test Handling

**Async/await pattern** (preferred):
```typescript
it('should return result', async () => {
  const result = await asyncFunction();
  expect(result).toBe('value');
});
```

**Promise chain pattern**:
```typescript
it('should return result', () => {
  return asyncFunction().then(result => {
    expect(result).toBe('value');
  });
});
```

**Error handling**:
```typescript
it('should throw error', async () => {
  await expect(asyncFunction()).rejects.toThrow('Expected error');
});
```

#### Type Safety (TypeScript)

**Mock with types**:
```typescript
import { SomeService } from './service';
const mockService = {
  method: jest.fn()
} as jest.Mocked<SomeService>;
```

**Complex type assertion**:
```typescript
const mockData = {
  id: 1,
  name: 'test'
} as unknown as ComplexType;
```

#### Test Organization

1. **Group by category**: Use nested `describe` blocks
   ```typescript
   describe('functionName', () => {
     describe('success cases', () => { /* ... */ });
     describe('edge cases', () => { /* ... */ });
     describe('error cases', () => { /* ... */ });
   });
   ```

2. **Use beforeEach/afterEach**: Set up common mocks
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
     mockDependency.mockResolvedValue(defaultValue);
   });
   ```

3. **Comment complex setups**: Explain non-obvious mocking
   ```typescript
   // Mock database connection with specific timeout behavior
   mockDB.query.mockImplementation(() => {
     return new Promise(resolve => setTimeout(resolve, 100));
   });
   ```

#### Code Generation Tips

1. **Start with template**: Use framework-specific template
2. **Add imports**: Function + dependencies + test framework
3. **Declare mocks**: Before imports (Jest) or at top (Vitest)
4. **Implement setup**: `beforeEach` for mock configuration
5. **Generate tests**: Iterate through `test_plan`, convert to code
6. **Add comments**: For complex scenarios or non-obvious assertions
7. **Format consistently**: Match existing test style if available

#### Augmenting Existing Test Files

If test file exists:
1. **Read existing file**
2. **Find insertion point**: End of file or within existing `describe` block
3. **Use edit tool**: Add new `describe` block for this function
4. **Preserve existing tests**: Don't modify unrelated tests
5. **Match style**: Follow existing formatting, imports, mocking

**Example edit**:
```typescript
// oldString: Last closing brace of file
});

// newString: Add new test suite before closing
});

describe('validateEmail', () => {
  // New tests here
  it('should return true for valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
});
```

#### Forbidden Patterns (Validation)

After generating file, check for:
- ❌ `it.skip` or `test.skip`: No skipped tests allowed
- ❌ `console.log`: Remove debugging statements
- ❌ `expect(result).toBeDefined()` only: Weak assertion, need specific value
- ❌ Missing `async` on async tests: Will cause timeout
- ❌ Unhanded promises: Must `await` or `return` promises

### Example Output Structure

```json
{
  "test_file": {
    "path": "src/utils/validation.test.ts",
    "created": true,
    "line_count": 187,
    "test_count": 10,
    "imports": [
      "import { validateEmail } from './validation';",
      "import { EmailValidator } from './EmailValidator';",
      "jest.mock('./EmailValidator');"
    ],
    "framework_syntax": "jest"
  }
}
```

---

## Step 4: Execute and Validate Tests

### Step ID
`execute-and-validate`

### Description
Run the test suite to verify all tests pass, analyze test output for failures or errors, and iteratively fix any issues until 100% pass rate is achieved (up to 3 retry attempts).

### Dependencies
- **Step 3** (`implement-tests`): Requires `test_file`

### Required Tools
- **bash**: Execute test command, parse output
- **read**: Read test file if fixes needed
- **edit**: Fix test failures
- **grep**: Search test output for specific errors (optional)

### Inputs
- `test_file` (from Step 3)
- `test_framework` (from Step 1)

### Outputs
- `test_results` (object):
  - `passed` (boolean): All tests passing
  - `total_tests` (number): Total tests executed
  - `passed_tests` (number): Tests that passed
  - `failed_tests` (number): Tests that failed
  - `skipped_tests` (number): Tests skipped (should be 0)
  - `execution_time` (number): Total execution time in ms
  - `failures` (array): List of test failures (if any)
    - `test_name` (string)
    - `error_message` (string)
    - `stack_trace` (string)
  - `retry_count` (number): Number of retry attempts made
  - `coverage_delta` (number): Coverage increase percentage (if available)

### Validation Criteria

#### Success Criteria
1. `test_results.passed === true`
2. `test_results.passed_tests === test_file.test_count`
3. `test_results.failed_tests === 0`
4. `test_results.skipped_tests === 0`
5. `test_results.execution_time < 10000` (tests complete in <10 seconds)
6. `test_results.retry_count <= 3`
7. No unhandled promise rejections or exceptions

#### Failure Conditions
- **Tests fail after 3 retries**: Escalate to user with specific failure details
- **Tests timeout**: Increase timeout or identify infinite loop
- **Test command fails**: Framework error, not test failure → Check configuration
- **Flaky tests detected**: Different results on multiple runs → Investigate state/timing issues

### Agent Guidance

#### Test Execution Strategy

1. **Initial run**:
   ```bash
   npm test -- src/utils/validation.test.ts
   # Or framework-specific:
   npx jest src/utils/validation.test.ts
   npx vitest run src/utils/validation.test.ts
   ```

2. **Parse output**: Detect framework output format
   - Jest: `Tests: X passed, Y failed, Z total`
   - Vitest: `Test Files X passed (Y), Tests X passed (Y)`
   - Mocha: `X passing (Yms)`

3. **Extract failures**: Capture error messages and stack traces

4. **Analyze failures**: Categorize error type
   - Assertion error: Expected vs actual mismatch
   - Type error: TypeScript/type mismatch
   - Import error: Module not found
   - Timeout: Async operation didn't complete
   - Mock error: Mock not configured correctly

#### Failure Analysis & Fixing

**Assertion Error**:
```
Expected: true
Received: false
```
**Diagnosis**: Test expectation wrong or function behavior misunderstood
**Fix**: 
1. Re-read function implementation
2. Adjust test expectation OR
3. Verify mock return values match reality

**Type Error**:
```
TypeError: Cannot read property 'validate' of undefined
```
**Diagnosis**: Mock not configured or import failed
**Fix**:
1. Check mock is declared before test
2. Verify mock method is stubbed
3. Add type assertions if needed

**Import Error**:
```
Cannot find module './validation' from 'validation.test.ts'
```
**Diagnosis**: Incorrect import path
**Fix**:
1. Recalculate relative path
2. Check file extension (`.ts` vs `.js`)
3. Verify source file exists

**Timeout Error**:
```
Timeout - Async callback was not invoked within the 5000ms timeout
```
**Diagnosis**: Promise not resolved or missing `await`
**Fix**:
1. Add `await` to async call
2. Ensure mock resolves (not just returns)
3. Increase timeout: `it('...', async () => {...}, 10000)`

**Mock Configuration Error**:
```
mockResolvedValue is not a function
```
**Diagnosis**: Wrong framework mock syntax
**Fix**:
1. Check framework (Jest vs Vitest)
2. Use correct syntax: `vi.fn()` vs `jest.fn()`
3. Ensure mock is jest.Mock type

#### Iterative Fix Process

1. **Run tests → Get failures**
2. **Analyze first failure**: Focus on one at a time
3. **Read test code**: Understand what's being tested
4. **Read function code**: Understand actual behavior
5. **Identify mismatch**: Expectation vs reality
6. **Apply fix**: Edit test file
7. **Re-run tests**: Verify fix worked
8. **Repeat**: Until all pass or max retries reached

**Max 3 retry attempts** to prevent infinite loops.

#### Flaky Test Detection

Run tests **twice** to check for flakiness:
```bash
npm test -- validation.test.ts && npm test -- validation.test.ts
```

If results differ:
1. **Identify flaky test**: Which test passed/failed inconsistently
2. **Check for**:
   - Shared state between tests
   - Missing `beforeEach`/`afterEach` cleanup
   - Real timers/dates (should use fake timers)
   - Race conditions in async code
   - Random values without seeded randomness
3. **Fix**: Add cleanup, mock timers, ensure isolation

#### Coverage Analysis (If Available)

If coverage tools configured:
```bash
npm test -- --coverage validation.test.ts
```

Parse output:
```
File            | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
validation.ts   |   92.5  |   87.5   |   100   |   92.3
```

- **Target**: >90% line coverage for target function
- **If below**: Identify uncovered lines, add tests
- **If above**: Success!

#### Performance Validation

Unit tests should be **fast**:
- Single test: <100ms typical
- Test suite: <5 seconds ideal, <10 seconds acceptable
- If slower: Investigate slow async operations, unnecessary sleeps

#### Error Escalation

If **3 retries exhausted**:
1. **Document failures**: List all failing tests with errors
2. **Provide context**: Include test code, function code, mocks
3. **Ask user**: "Unable to resolve failures. Should I:
   - A) Skip failing tests (not recommended)
   - B) Report issue and stop
   - C) Continue with partial coverage"
4. **Default**: Stop and report (fail activity)

#### Success Confirmation

When all tests pass:
1. **Run once more**: Ensure not flaky
2. **Check for warnings**: Framework warnings, deprecations
3. **Validate count**: `test_results.passed_tests === test_plan.total_test_count`
4. **Log success**: "✅ All X tests passing"

### Example Output Structure

```json
{
  "test_results": {
    "passed": true,
    "total_tests": 10,
    "passed_tests": 10,
    "failed_tests": 0,
    "skipped_tests": 0,
    "execution_time": 1247,
    "failures": [],
    "retry_count": 1,
    "coverage_delta": 12.5
  }
}
```

**Example with failures**:
```json
{
  "test_results": {
    "passed": false,
    "total_tests": 10,
    "passed_tests": 8,
    "failed_tests": 2,
    "skipped_tests": 0,
    "execution_time": 2341,
    "failures": [
      {
        "test_name": "should return false when email is empty string",
        "error_message": "Expected: false, Received: true",
        "stack_trace": "at validation.test.ts:45:23"
      },
      {
        "test_name": "should reject when database connection fails",
        "error_message": "Timeout - Async callback was not invoked within 5000ms",
        "stack_trace": "at validation.test.ts:89:15"
      }
    ],
    "retry_count": 2,
    "coverage_delta": 0
  }
}
```

---

## Step 5: Commit and Document

### Step ID
`commit-and-document`

### Description
Create a git commit with the test file changes, write a descriptive commit message, and optionally annotate the test file with Metabob documenting the test strategy.

### Dependencies
- **Step 4** (`execute-and-validate`): Requires `test_results.passed === true`

### Required Tools
- **bash**: Execute git commands
- **metabob_annotate_component**: Document test strategy (optional)
- **metabob_mark_problem_complete**: Mark quality issues resolved if tested (optional)

### Inputs
- `test_file` (from Step 3)
- `test_results` (from Step 4)
- `function_name` (original input)
- `file_path` (original input)
- `quality_issues` (from Step 1)

### Outputs
- `commit_result` (object):
  - `success` (boolean): Commit succeeded
  - `commit_hash` (string): Git commit SHA
  - `commit_message` (string): Full commit message
  - `files_committed` (array): List of files in commit
  - `metabob_annotation` (object): Annotation details (if created)
    - `annotated` (boolean)
    - `component_name` (string)
    - `annotation_text` (string)

### Validation Criteria

#### Success Criteria
1. `commit_result.success === true`
2. `commit_result.commit_hash` is valid SHA
3. `commit_result.files_committed` includes test file
4. `commit_result.files_committed` does NOT include source file (implementation unchanged)
5. Working directory clean after commit (`git status` shows no changes)
6. Commit message mentions function name and file

#### Failure Conditions
- **Git not initialized**: No `.git` directory → Fail fast, inform user
- **No changes to commit**: Test file already committed → Skip commit, succeed anyway
- **Pre-commit hook fails**: Linting/format errors → Auto-fix if possible, retry commit
- **Merge conflict**: Uncommitted changes → Stash or request user clean workspace

### Agent Guidance

#### Pre-Commit Validation

Before committing:
1. **Check git status**:
   ```bash
   git status --porcelain
   ```
   Verify only test file is modified/created.

2. **Ensure tests still pass** (paranoid check):
   ```bash
   npm test -- validation.test.ts
   ```

3. **Check for implementation changes**:
   ```bash
   git diff src/utils/validation.ts
   ```
   Should be empty. If not, **ABORT** and warn user.

#### Commit Message Format

**Template**:
```
Add unit tests for [function_name] in [file_path]

- Added [N] test scenarios covering success, edge, and error cases
- Test framework: [jest|vitest|mocha]
- All tests passing ([N]/[N])
- Coverage increased by [X]% (if available)
```

**Example**:
```
Add unit tests for validateEmail in src/utils/validation.ts

- Added 10 test scenarios covering success, edge, and error cases
- Test framework: jest
- All tests passing (10/10)
- Coverage increased by 12.5%
```

**Alternative format** (if project has convention):
Check recent commits for pattern:
```bash
git log --oneline -10
```
Match existing style (e.g., "test: add unit tests for X")

#### Git Commit Execution

1. **Stage test file**:
   ```bash
   git add src/utils/validation.test.ts
   ```

2. **Commit with message**:
   ```bash
   git commit -m "Add unit tests for validateEmail in src/utils/validation.ts

   - Added 10 test scenarios covering success, edge, and error cases
   - Test framework: jest
   - All tests passing (10/10)
   - Coverage increased by 12.5%"
   ```

3. **Verify commit**:
   ```bash
   git log -1 --stat
   ```
   Should show test file added/modified.

4. **Check working directory clean**:
   ```bash
   git status
   ```
   Should show "nothing to commit, working tree clean".

#### Handling Pre-Commit Hooks

If commit fails due to hooks:
1. **Check error message**: Linting? Formatting? Tests?
2. **Auto-fix if possible**:
   ```bash
   npm run lint:fix
   npm run format
   ```
3. **Re-stage and retry**:
   ```bash
   git add src/utils/validation.test.ts
   git commit -m "..."
   ```
4. **If still fails**: Report to user, suggest `--no-verify` (require permission)

#### Metabob Annotation (Optional)

If Metabob tools available, annotate test strategy:

```typescript
metabob_annotate_component({
  file_path: "src/utils/validation.test.ts",
  component_name: "test(validateEmail)",
  component_type: "test-suite",
  reason: `Unit test suite for validateEmail function.

Test Coverage:
- Success cases (3): Valid emails with various formats
- Edge cases (5): Empty string, no domain, unicode, etc.
- Error cases (2): Database failures, invalid input types

Mocking Strategy:
- EmailValidator: Mocked with jest.mock
- Database: Manual mock with jest.fn()

All tests passing (10/10). Coverage: 92.5%`
})
```

**When to annotate**:
- ✅ Complex test setup (mocking strategy non-obvious)
- ✅ Many edge cases (document reasoning)
- ✅ Async complexity (explain timing/promises)
- ❌ Simple tests (annotation adds no value)

#### Marking Quality Issues (Optional)

If target function had HIGH severity issues (from Step 1):
- Tests serve as **behavioral baseline** (document actual behavior)
- Don't mark as "fixed" (we didn't fix implementation)
- But can add note:

```typescript
metabob_mark_problem_complete({
  problem_id: "issue_123",
  file_path: "src/utils/validation.ts",
  resolution_notes: `Added comprehensive unit tests to establish behavioral baseline. Issue still exists but now has regression tests. Tests document actual behavior including edge cases.`
})
```

#### Success Output

Log success message:
```
✅ Activity completed successfully!

Created: src/utils/validation.test.ts
Tests: 10 passed (10/10)
Coverage: +12.5%
Commit: abc1234 "Add unit tests for validateEmail"

Metabob annotation: ✓ Test strategy documented
```

#### Failure Handling

If commit fails after all retries:
1. **Save test file**: Already written to disk (safe)
2. **Report failure**: "Git commit failed after 3 attempts"
3. **Provide manual steps**:
   ```
   MANUAL COMMIT REQUIRED:
   $ git add src/utils/validation.test.ts
   $ git commit -m "Add unit tests for validateEmail"
   ```
4. **Mark activity as partial success**: Tests work, just not committed

### Example Output Structure

```json
{
  "commit_result": {
    "success": true,
    "commit_hash": "abc1234def5678",
    "commit_message": "Add unit tests for validateEmail in src/utils/validation.ts\n\n- Added 10 test scenarios covering success, edge, and error cases\n- Test framework: jest\n- All tests passing (10/10)\n- Coverage increased by 12.5%",
    "files_committed": ["src/utils/validation.test.ts"],
    "metabob_annotation": {
      "annotated": true,
      "component_name": "test(validateEmail)",
      "annotation_text": "Unit test suite for validateEmail function..."
    }
  }
}
```

---

## Step Execution Order

```
1. validate-and-analyze
   ↓
2. design-test-scenarios
   ↓
3. implement-tests
   ↓
4. execute-and-validate
   ↓
5. commit-and-document
```

**No parallel execution**: Each step depends on previous step's output.

**Total estimated time**: 5-10 minutes
- Step 1: 5-10 seconds
- Step 2: 10-30 seconds (planning)
- Step 3: 30-60 seconds (code generation)
- Step 4: 2-5 minutes (testing + potential retries)
- Step 5: 5-10 seconds (commit)

---

## Success Metrics

### Per-Step Success Rates (Estimated)
- Step 1: 95% (fails only on missing prerequisites)
- Step 2: 99% (pure planning, rarely fails)
- Step 3: 90% (syntax/import errors possible)
- Step 4: 80% (test failures common on first try)
- Step 5: 95% (git issues rare)

**Overall success rate**: 85-90% (first attempt), 95%+ (with retries)

### Activity-Level Validation

After Step 5 completes, validate entire activity:
1. ✅ Test file exists and has ≥5 tests
2. ✅ All tests passing (100% pass rate)
3. ✅ No skipped tests
4. ✅ Git commit created
5. ✅ Implementation unchanged
6. ✅ Coverage increased (if measurable)

If all pass: **Activity SUCCESS** ✅  
If any fail: **Activity FAILURE** ❌ (rollback test file?)

---

## Error Recovery Matrix

| Step | Error Type | Recovery Action | Max Retries |
|------|------------|-----------------|-------------|
| 1 | Function not found | Search broader, suggest alternatives | 1 |
| 1 | Framework missing | Fail fast with install instructions | 0 |
| 2 | Insufficient tests | Add more edge cases | 1 |
| 3 | Syntax error | Fix imports/types | 2 |
| 4 | Test failures | Analyze & fix assertions/mocks | 3 |
| 4 | Flaky tests | Add cleanup, mock timers | 2 |
| 5 | Commit fails | Auto-fix lint, retry | 2 |

---

## Variable Mapping

### User-Provided Variables
- `function_name` (string, required)
- `file_path` (string, required)
- `test_framework` (string, optional, default: "auto")
- `coverage_goal` (string, optional, default: "standard")

### Internal Variables (Generated)
- `function_analysis` (Step 1 → Step 2, 3)
- `test_framework` (Step 1 → Step 3, 4)
- `existing_patterns` (Step 1 → Step 3)
- `test_plan` (Step 2 → Step 3, 4)
- `test_file` (Step 3 → Step 4, 5)
- `test_results` (Step 4 → Step 5)
- `quality_issues` (Step 1 → Step 5)
- `commit_result` (Step 5 → Output)

---

## Document Control

**Version**: 1.0  
**Created**: 2026-02-16  
**Status**: Design Phase (Ready for Implementation)  
**Next Step**: Create JSON template schema

**Change Log**:
- 2026-02-16: Initial step design created based on SCOPE_DEFINITION.md

---

## Implementation Notes

### For Template JSON Creation
Each step in this document should map to:
```json
{
  "id": "step-id",
  "description": "...",
  "dependencies": ["previous-step-id"],
  "tools": ["tool1", "tool2"],
  "validation": {
    "success_criteria": [...],
    "failure_conditions": [...]
  },
  "guidance": "..."
}
```

### For Agent Execution
Agent should:
1. Read this document before starting activity
2. Follow guidance sections closely (they're optimized for success)
3. Validate outputs against criteria before proceeding to next step
4. Use error recovery strategies when failures occur
5. Stop after max retries and escalate to user

### For Future Improvements
- Add performance benchmarks after real executions
- Refine success criteria based on failure analysis
- Add more test framework support (Tap, Ava, etc.)
- Improve mock strategy detection
- Add coverage reporting integration
