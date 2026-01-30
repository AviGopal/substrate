# Activity Quality Gates Documentation

## Overview

This document explains the quality gates defined in `.activity-quality-gates.json` that all activities must meet before code can be committed. These gates prevent low-quality code from entering the repository and ensure consistent development standards.

## Quality Gates Explained

### 1. Test Coverage (`test_coverage`)

**Why it matters**: Test coverage ensures code reliability and prevents regression bugs. It provides confidence that changes don't break existing functionality.

**How to measure**:
```bash
npm test -- --coverage --coverageThreshold.global.lines=80
```
- Lines coverage: Percentage of code lines executed by tests
- Functions coverage: Percentage of functions called by tests  
- Branches coverage: Percentage of if/else branches tested
- Statements coverage: Percentage of statements executed

**How to fix violations**:
1. **Identify uncovered code**: Review coverage report HTML output
2. **Write unit tests**: Create tests for uncovered functions
3. **Add integration tests**: Test complex workflows end-to-end
4. **Test edge cases**: Cover error conditions and boundary values

**Example fix**:
```javascript
// Before: Uncovered function
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// After: Add test
test('calculateTotal sums item prices', () => {
  const items = [{ price: 10 }, { price: 20 }];
  expect(calculateTotal(items)).toBe(30);
});
```

**Exceptions**: Documentation files, generated code, and deprecated code marked for removal.

### 2. No Critical Issues (`no_critical_issues`)

**Why it matters**: Critical issues include security vulnerabilities, memory leaks, null pointer exceptions, and logic errors that can cause system failures or data loss.

**How to measure**:
```bash
metabob-cli get-priority-issues --severity CRITICAL,HIGH
```
This scans for:
- Security vulnerabilities (SQL injection, XSS, etc.)
- Memory management issues
- Logic errors and race conditions
- Performance bottlenecks

**How to fix violations**:
1. **Security vulnerabilities**: Sanitize inputs, use parameterized queries
2. **Memory leaks**: Fix resource cleanup, remove circular references
3. **Logic errors**: Correct conditional logic, handle edge cases
4. **Race conditions**: Add proper synchronization, use atomic operations

**Example fix**:
```javascript
// Before: SQL injection vulnerability
const query = `SELECT * FROM users WHERE id = ${userId}`;

// After: Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
const result = db.prepare(query).get(userId);
```

**Exceptions**: None. All critical issues must be resolved.

### 3. No Dead Code (`no_dead_code`)

**Why it matters**: Dead code increases maintenance burden, confuses developers, can hide bugs, and adds unnecessary complexity to the codebase.

**How to measure**:
```bash
metabob-cli search-issues --pattern 'dead.*code|unused.*function|unreachable.*code'
```
Detects:
- Unused imports and variables
- Unreachable code blocks
- Functions that are never called
- Redundant conditional branches

**How to fix violations**:
1. **Remove unused imports**: Clean up import statements
2. **Delete unused functions**: Remove functions with no callers
3. **Simplify conditionals**: Remove unreachable else branches
4. **Refactor complex logic**: Break down overly complex conditions

**Example fix**:
```javascript
// Before: Dead code
import { unusedUtil } from './utils'; // Unused import
function processData(data) {
  if (data.length > 0) {
    return data.map(item => item.value);
  } else {
    return []; // This branch is never reached if validated upstream
  }
}

// After: Clean code
function processData(data) {
  return data.map(item => item.value);
}
```

**Exceptions**: Code marked for future use with documented TODO comments.

### 4. Memory Improvement (`memory_improvement`)

**Why it matters**: Memory optimization efforts must show measurable improvement to justify development time and ensure fixes are effective.

**How to measure**:
```bash
npm run test:memory -- --validate-improvement=20
```
Compares memory usage before and after changes using:
- Peak memory consumption
- Memory growth rate over time
- Garbage collection frequency
- Memory leak detection

**How to fix violations**:
1. **Optimize data structures**: Use more efficient collections
2. **Fix memory leaks**: Ensure proper cleanup of resources
3. **Reduce object creation**: Implement object pooling
4. **Improve algorithms**: Use more memory-efficient approaches

**Example fix**:
```javascript
// Before: Memory inefficient
function processLargeDataset(data) {
  return data.map(item => ({
    ...item,
    processed: true,
    timestamp: new Date()
  }));
}

// After: Memory optimized
function processLargeDataset(data) {
  // Reuse date object instead of creating new ones
  const timestamp = new Date();
  return data.map(item => {
    item.processed = true;
    item.timestamp = timestamp;
    return item;
  });
}
```

**Exceptions**: Non-memory-related commits are exempt. Small refactors may use 10% threshold.

### 5. No Manual Intervention (`no_manual_intervention`)

**Why it matters**: Activities should be fully automated to enable continuous integration, reduce human error, and allow unattended execution.

**How to measure**:
```bash
grep -r 'TODO.*user|MANUAL.*STEP|requires.*manual' src/ docs/
```
Searches for markers indicating:
- Manual steps in documentation
- User input requirements
- Interactive prompts
- Configuration that requires human decisions

**How to fix violations**:
1. **Automate manual steps**: Create scripts for repetitive tasks
2. **Remove user prompts**: Use configuration files instead
3. **Add default values**: Provide sensible defaults for all options
4. **Create setup scripts**: Automate environment configuration

**Example fix**:
```javascript
// Before: Requires manual input
const userChoice = prompt('Enter environment (dev/prod):');
const config = userChoice === 'prod' ? prodConfig : devConfig;

// After: Automated configuration
const environment = process.env.NODE_ENV || 'development';
const config = environment === 'production' ? prodConfig : devConfig;
```

**Exceptions**: One-time setup activities may require user input if documented.

### 6. All Tests Pass (`all_tests_pass`)

**Why it matters**: Failing tests indicate broken functionality, incorrect assumptions, or incomplete implementations. No exceptions for production code.

**How to measure**:
```bash
npm test && npm run test:integration
```
Runs:
- Unit tests for individual functions
- Integration tests for component interactions
- End-to-end tests for user workflows
- Performance tests for critical paths

**How to fix violations**:
1. **Fix logic errors**: Correct implementation bugs
2. **Update test expectations**: Adjust tests for intended changes
3. **Mock external dependencies**: Isolate units under test
4. **Fix timing issues**: Handle asynchronous operations properly

**Example fix**:
```javascript
// Before: Failing test due to async timing
test('fetches user data', () => {
  const result = fetchUserData(123);
  expect(result.name).toBe('John Doe'); // Fails - async not handled
});

// After: Proper async handling
test('fetches user data', async () => {
  const result = await fetchUserData(123);
  expect(result.name).toBe('John Doe'); // Passes
});
```

**Exceptions**: None. Flaky tests should be fixed or disabled with justification.

### 7. No Breaking Changes (`no_breaking_changes`)

**Why it matters**: Breaking changes without proper versioning can break downstream systems, user workflows, and integration points.

**How to measure**:
```bash
npm run check:api-compatibility
```
Detects:
- Removed public APIs
- Changed function signatures
- Modified return types
- Altered configuration schemas

**How to fix violations**:
1. **Deprecate before removal**: Mark old APIs as deprecated
2. **Add alongside existing**: Introduce new APIs without removing old ones
3. **Use feature flags**: Enable gradual rollout
4. **Maintain backwards compatibility**: Support old interfaces

**Example fix**:
```javascript
// Before: Breaking change
function processUser(userData) { // Changed signature
  return { id: userData.userId, name: userData.userName };
}

// After: Backwards compatible
function processUser(userData, options = {}) {
  // Support both old and new formats
  const id = userData.id || userData.userId;
  const name = userData.name || userData.userName;
  return { id, name };
}
```

**Exceptions**: Major version releases may include breaking changes if documented.

### 8. Code Style Compliance (`code_style_compliance`)

**Why it matters**: Consistent code style improves readability, reduces cognitive load, and prevents bikeshedding in code reviews.

**How to measure**:
```bash
npm run lint && npm run format:check
```
Checks:
- Consistent indentation and formatting
- Naming conventions (camelCase, PascalCase)
- Import organization
- Comment formatting

**How to fix violations**:
1. **Run auto-formatters**: Use Prettier for consistent formatting
2. **Fix linting errors**: Address ESLint rule violations
3. **Update naming**: Follow established conventions
4. **Organize imports**: Group and sort import statements

**Example fix**:
```javascript
// Before: Style violations
const user_data={name:"john",age:25}; // snake_case, no spaces
import {b,a,c} from './utils'; // unsorted imports

// After: Compliant style
import { a, b, c } from './utils'; // sorted imports
const userData = { name: 'john', age: 25 }; // camelCase, proper spacing
```

**Exceptions**: Generated code and third-party libraries if clearly marked.

### 9. Security Scan Clean (`security_scan_clean`)

**Why it matters**: Security vulnerabilities can lead to data breaches, system compromises, and regulatory compliance issues.

**How to measure**:
```bash
npm audit --audit-level=high
metabob-cli search-issues --pattern 'security|vulnerability|injection|xss'
```
Scans for:
- Vulnerable dependencies
- Common attack vectors (injection, XSS)
- Insecure configurations
- Exposed sensitive data

**How to fix violations**:
1. **Update dependencies**: Upgrade to patched versions
2. **Fix injection flaws**: Use parameterized queries and input validation
3. **Sanitize outputs**: Prevent XSS with proper encoding
4. **Secure configurations**: Use environment variables for secrets

**Example fix**:
```javascript
// Before: XSS vulnerability
function displayMessage(userInput) {
  document.innerHTML = userInput; // Direct injection
}

// After: Secure output
function displayMessage(userInput) {
  document.textContent = userInput; // Safe text content
  // Or use HTML sanitization library for rich content
}
```

**Exceptions**: Low-severity warnings may be accepted if mitigation is documented.

## Activity-Specific Requirements

### Fix Activities
- **Required**: Tests pass, no critical issues, memory improvement, security clean
- **Nice to have**: Test coverage, no dead code, style compliance

Focuses on not breaking existing functionality while showing improvement.

### Feature Activities  
- **Required**: Tests pass, test coverage, no critical issues, style compliance, security clean
- **Nice to have**: No dead code, no breaking changes

New features need comprehensive testing and security validation.

### Bugfix Activities
- **Required**: Tests pass, no critical issues, memory improvement, no manual intervention
- **Nice to have**: Test coverage, no dead code

Bug fixes must be automated and show measurable improvement.

### Refactor Activities
- **Required**: Tests pass, no critical issues, no dead code, style compliance
- **Nice to have**: Test coverage, memory improvement

Refactoring must maintain functionality while improving code quality.

### Security Activities
- **Required**: Tests pass, no critical issues, security clean, test coverage
- **Nice to have**: Style compliance, no dead code

Security fixes require thorough testing and vulnerability scanning.

## Integration and Enforcement

### Pre-commit Hook
Automatically runs quality gates before each commit:
```bash
#!/bin/sh
node scripts/check-quality-gates.js --activity-type=$(git log -1 --pretty=%B | head -1)
```

### CI Integration
Quality gates run on every pull request and merge:
```yaml
quality-gates:
  runs-on: ubuntu-latest
  steps:
    - name: Check Quality Gates
      run: npm run quality:check
    - name: Generate Report
      run: npm run quality:report
```

### Override Policy
- **Approval required**: Senior developer must approve overrides
- **Documentation required**: Must document why override is necessary
- **Emergency bypass**: Disabled to prevent abuse

## Continuous Improvement

### Metrics Tracking
- Track quality metrics over time
- Alert on degradation trends  
- Dashboard integration for visibility
- Regular review and adjustment of thresholds

### Feedback Loop
- Collect developer feedback on gate effectiveness
- Adjust thresholds based on project needs
- Add new gates as quality requirements evolve
- Remove gates that don't provide value

This system ensures consistent code quality while allowing for project-specific flexibility and continuous improvement of development practices.