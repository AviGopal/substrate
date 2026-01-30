# Activity Commit Validation

## Overview

All activities must pass comprehensive validation checks before commit to ensure they meet quality standards and are fully automated. This validation prevents the exact issues discovered in memory fix commits from recurring.

## Validation Rules

### 1. 🚫 No Manual Intervention

**Rule**: Activities must be fully automated with no user input required.

**❌ NOT ALLOWED:**
- TODO markers mentioning user input (`TODO: user needs to configure`)
- FIXME comments requiring manual steps (`FIXME: requires manual input`)
- User prompts or interactive elements
- Manual configuration requirements
- Steps that require human verification

**✅ REQUIRED:**
- Complete automated implementation
- Configuration via files or environment variables
- Default values for all parameters
- Automated validation and error handling

**If Blocked:**
```bash
# Fix examples:
# Remove: TODO: user needs to configure database URL
# Add: const DB_URL = process.env.DATABASE_URL || 'localhost:5432';

# Remove: FIXME: requires manual input from user  
# Add: Automated configuration detection
```

**Detection Command:**
```bash
grep -r "TODO.*user|FIXME.*manual|user.*input|manual.*step" src/ docs/
```

### 2. ✅ All Tests Pass

**Rule**: 100% test pass rate required - no exceptions.

**❌ NOT ALLOWED:**
- Any failing tests
- Skipped tests without justification
- Flaky tests that sometimes fail
- Tests that require manual setup

**✅ REQUIRED:**
- All unit tests pass
- All integration tests pass  
- All end-to-end tests pass
- Test suite runs successfully

**If Blocked:**
```bash
# Debug failing tests
npm test -- --verbose
npm test -- --detectOpenHandles

# Fix common issues:
# - Async/await timing problems
# - Mock setup issues
# - Test isolation problems
# - Resource cleanup issues
```

**Detection Command:**
```bash
npm test -- --passWithNoTests --bail
```

### 3. 🚨 No New Critical Issues

**Rule**: Code quality must not degrade - zero tolerance for critical issues.

**❌ NOT ALLOWED:**
- HIGH or CRITICAL severity Metabob issues
- Security vulnerabilities
- Memory leaks
- Logic errors or race conditions
- Performance bottlenecks

**✅ REQUIRED:**
- Clean Metabob analysis
- Secure code practices
- Proper error handling
- Resource management

**If Blocked:**
```bash
# View critical issues
metabob-cli get-priority-issues --severity CRITICAL

# Common fixes:
# - Fix SQL injection: Use parameterized queries
# - Fix XSS: Sanitize user inputs
# - Fix memory leaks: Proper cleanup in destructors
# - Fix race conditions: Add proper synchronization
```

**Detection Command:**
```bash
metabob-cli get-priority-issues --severity CRITICAL --count
```

### 4. 💀 No Dead Code

**Rule**: Don't commit unused, unreachable, or obsolete code.

**❌ NOT ALLOWED:**
- Unused functions or methods
- Unreachable code blocks  
- Unused imports or variables
- Commented-out code blocks
- Obsolete implementations

**✅ REQUIRED:**
- All code is actively used
- Clean imports and exports
- Reachable code paths only
- Remove old implementations

**If Blocked:**
```bash
# Find dead code
metabob-cli search-issues --pattern "dead.*code|unused.*function"

# Remove unused code:
# - Delete unused functions
# - Remove unused imports
# - Clean up unreachable code
# - Remove commented code blocks
```

**Detection Command:**
```bash
metabob-cli search-issues --pattern "dead.*code|unused.*function|unreachable.*code"
```

### 5. 🧪 Memory/Performance Fixes Must Pass Stress Tests

**Rule**: Memory and performance changes must be validated under stress conditions.

**Triggers**: Changes to files containing:
- `memory`, `cache`, `undo`, `perf`, `stress`, `leak`
- Commit messages mentioning performance or memory

**❌ NOT ALLOWED:**
- Memory leaks under load
- Performance degradation
- Resource exhaustion
- Crashes under stress
- Unbounded memory growth

**✅ REQUIRED:**
- All stress tests pass
- Memory usage stays within limits
- Performance scales appropriately
- No crashes during extended operation
- Proper resource cleanup

**If Blocked:**
```bash
# Run stress tests manually
./test/stress-test-memory.sh

# Debug memory issues:
# - Check for memory leaks
# - Verify cleanup logic
# - Test under load conditions
# - Profile memory usage
```

**Detection Command:**
```bash
# Automatic detection based on file changes and commit message
# Runs: ./test/stress-test-memory.sh
```

### 6. 🛡️ No Security Vulnerabilities

**Rule**: Zero tolerance for high-severity security vulnerabilities.

**❌ NOT ALLOWED:**
- High-severity npm audit findings
- Known vulnerable dependencies
- Security anti-patterns in code
- Exposed sensitive information

**✅ REQUIRED:**
- Clean security audit
- Updated dependencies
- Secure coding practices
- Proper secrets management

**If Blocked:**
```bash
# Fix security issues
npm audit fix

# Manual fixes for complex issues:
npm audit  # Review detailed report
npm update package-name  # Update specific packages
npm install package-name@latest  # Force latest version
```

**Detection Command:**
```bash
npm audit --audit-level=high
```

### 7. 🏷️ Component Flag Limits

**Rule**: Keep flagged components within acceptable limits.

**❌ NOT ALLOWED:**
- Too many flagged components (>5 active)
- Critical flagged components (>0)
- Unaddressed high-priority flags

**✅ REQUIRED:**
- Minimal number of active flags
- No critical flagged components
- Clear resolution plan for existing flags

**If Blocked:**
```bash
# View current flags
./bin/list-flags.sh

# Resolve flags
./bin/resolve-flag.sh src/component.ts EXPERIMENTAL "Fixed and validated"

# Check limits
./bin/check-flag-limits.sh
```

**Detection Command:**
```bash
./bin/check-flag-limits.sh false false
```

## Validation Process Flow

```
git commit -m "fix: resolve memory leak"
         ↓
🔍 Detect activity commit (source code changes)
         ↓
🚫 Check 1: No manual intervention markers
         ↓
✅ Check 2: All tests pass
         ↓  
🚨 Check 3: No critical issues (Metabob)
         ↓
💀 Check 4: No dead code
         ↓
🧪 Check 5: Stress tests (if memory/perf)
         ↓
🛡️ Check 6: No security vulnerabilities  
         ↓
🏷️ Check 7: Component flag limits
         ↓
📊 Generate validation summary
         ↓
✅ PASS → Allow commit
❌ FAIL → Block commit + remediation guidance
```

## Example Validation Outputs

### ✅ Successful Validation

```
=== ACTIVITY QUALITY VALIDATION ===

🏃 Activity changes detected - running validation checks...

Check 1: No Manual Intervention Required
Checking for TODO/FIXME markers requiring user input...
✅ PASS

Check 2: All Tests Pass  
Running complete test suite...
✅ PASS

Check 3: No New Critical Issues
Checking for critical code quality issues with Metabob...
✅ PASS

Check 4: No Dead Code
Checking for unused functions and dead code...
✅ PASS

Check 5: Memory/Performance Stress Tests
Memory/performance changes detected - running stress tests...
✅ PASS

Check 6: No Security Vulnerabilities
Checking for high-severity security vulnerabilities...
✅ PASS

Check 7: Component Flag Limits
Checking component flag limits...
✅ PASS

==================================
📊 VALIDATION SUMMARY
==================================
✅ ALL VALIDATION CHECKS PASSED
Passed: 7/7 checks

🚀 ACTIVITY READY FOR COMMIT
Your activity meets all quality standards
```

### ❌ Blocked Validation

```
=== ACTIVITY QUALITY VALIDATION ===

🏃 Activity changes detected - running validation checks...

Check 1: No Manual Intervention Required
Checking for TODO/FIXME markers requiring user input...
❌ FAIL: Found user input markers - activities must be fully automated
Details:
  src/auth.ts:45: TODO: user needs to configure API key
  src/cache.ts:123: FIXME: requires manual database setup

🚫 REMEDIATION:
   • Remove all TODO/FIXME markers requiring user input
   • Complete the implementation to be fully automated
   • Replace user prompts with configuration files
   • Add default values for all parameters

Check 2: All Tests Pass
Running complete test suite...
❌ FAIL: Test suite has failing tests
Details:
  FAIL src/auth.test.ts
    × should authenticate user (15ms)
  FAIL src/cache.test.ts  
    × should handle memory cleanup (8ms)

🚫 REMEDIATION:
   • Fix failing unit tests by correcting logic errors
   • Update test expectations for intended changes
   • Mock external dependencies properly
   • Run: npm test -- --verbose for details

...

==================================
📊 VALIDATION SUMMARY  
==================================
❌ VALIDATION FAILED
Failed: 2/7 checks
Passed: 5/7 checks

🚫 COMMIT BLOCKED
Fix the issues above before committing

💡 QUICK FIXES:
   1. Run tests: npm test
   2. Check quality: metabob-cli get-priority-issues
   3. Remove TODO markers: Complete your implementation
   4. Fix security: npm audit fix
   5. Remove dead code: Delete unused functions

🚨 TO BYPASS (NOT RECOMMENDED):
   git commit --no-verify
```

## Installation and Usage

### Install Activity Validation Hook

```bash
# Make executable
chmod +x hooks/pre-commit-validate-activity.sh

# Install as pre-commit hook
ln -sf ../../hooks/pre-commit-validate-activity.sh .git/hooks/pre-commit

# Or use the installer
./bin/install-pre-commit-hook.sh
```

### Test Validation

```bash
# Create test file with issues
echo 'const x = 1; // TODO: user needs to set this' > test.js
git add test.js
git commit -m 'test: validation'
# Should be blocked

# Fix and retry
echo 'const x = process.env.VALUE || 1;' > test.js  
git add test.js
git commit -m 'test: validation'
# Should pass
```

### Integration with Development Workflow

#### VS Code Integration
The hook runs automatically when you commit via:
- VS Code Git panel
- Command palette (Git: Commit)
- Terminal git commands

#### Command Line Usage
```bash
# Normal commit - validation runs automatically
git commit -m "fix: resolve authentication issue"

# Amend commit - validation runs
git commit --amend -m "fix: resolve auth issue with proper tests"

# Bypass validation (emergency only)
git commit --no-verify -m "hotfix: critical security patch"
```

#### CI/CD Integration
```yaml
# .github/workflows/validation.yml
name: Activity Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies  
        run: npm ci
      - name: Run activity validation
        run: ./hooks/pre-commit-validate-activity.sh
```

## Configuration

### Environment Variables
```bash
# Skip specific checks (for testing)
export SKIP_MANUAL_CHECK=true
export SKIP_STRESS_TESTS=true  
export SKIP_SECURITY_CHECK=true

# Adjust thresholds
export MAX_CRITICAL_ISSUES=0
export STRESS_TEST_TIMEOUT=300
export TEST_TIMEOUT=120
```

### Tool Requirements

**Required Tools:**
- `npm` - For running tests and security audits
- `node` - JavaScript runtime
- `git` - Version control operations

**Optional Tools:**
- `metabob-cli` - Advanced code quality analysis
- `./test/stress-test-memory.sh` - Memory/performance validation  
- `./bin/check-flag-limits.sh` - Component flagging system

### Customization

**Adding Custom Checks:**
```bash
# Edit hooks/pre-commit-validate-activity.sh
# Add new validation in the main section:

run_check 8 \
    "Custom Quality Check" \
    "Running custom validation..." \
    "Custom check failed" \
    your-custom-command
```

**Modifying Failure Messages:**
Edit the remediation sections to provide project-specific guidance.

## Troubleshooting

### Common Issues

**Hook not running:**
```bash
ls -la .git/hooks/pre-commit  # Check if installed
chmod +x .git/hooks/pre-commit  # Make executable
```

**Tests failing in hook but passing locally:**
```bash
# Check Node.js version consistency
node --version
npm --version

# Run tests with same conditions as hook
npm test -- --passWithNoTests --bail
```

**Metabob CLI issues:**
```bash
# Install metabob-cli
npm install -g @metabob/cli

# Check configuration
metabob-cli --version
metabob-cli get-priority-issues --help
```

**Performance issues:**
```bash
# Hook taking too long
export TEST_TIMEOUT=60  # Reduce test timeout
export SKIP_STRESS_TESTS=true  # Skip heavy tests temporarily
```

This comprehensive validation ensures that every activity commit meets strict quality standards, preventing the exact issues we discovered in memory leak fixes from occurring in future development.