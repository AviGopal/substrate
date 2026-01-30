# Pre-commit Hooks Documentation

## Overview

The Pre-commit Hooks system provides comprehensive quality gate validation that runs automatically before every commit. This ensures that all code changes meet strict quality standards before they can be committed to the repository.

## Key Features

- **🔒 Automatic validation** on every `git commit`
- **🎯 Activity-specific checks** tailored to different activity types
- **📊 8 comprehensive quality gates** covering all aspects of code quality
- **⚡ Fast execution** with intelligent change detection
- **🔧 Easy installation** with automated setup script
- **🚫 Commit blocking** when quality standards are not met

## Quality Gates Checked

### 1. 📊 Test Coverage Gate
- **Purpose**: Ensure adequate test coverage for new code
- **Threshold**: ≥80% coverage for feature activities
- **Check**: `npm test -- --coverage`
- **Required for**: Feature activities
- **Remediation**: Add unit tests for uncovered functions

### 2. 🚨 Critical Issues Gate  
- **Purpose**: Block commits with security vulnerabilities or critical bugs
- **Threshold**: 0 critical/high severity Metabob issues
- **Check**: `metabob-cli get-priority-issues --severity CRITICAL`
- **Required for**: All activities
- **Remediation**: Fix security issues, memory leaks, logic errors

### 3. 💀 Dead Code Gate
- **Purpose**: Prevent accumulation of unused code
- **Threshold**: 0 lines of dead code for refactors
- **Check**: `metabob-cli search-issues --pattern 'dead.*code'`
- **Required for**: Refactor activities
- **Remediation**: Remove unused functions, imports, unreachable code

### 4. 🚫 Manual Intervention Gate
- **Purpose**: Ensure activities are fully automated  
- **Threshold**: 0 manual intervention markers
- **Check**: `grep 'TODO.*user|FIXME.*manual|requires.*input'`
- **Required for**: Fix/bugfix activities
- **Remediation**: Remove user input requirements, automate manual steps

### 5. ✅ All Tests Pass Gate
- **Purpose**: Ensure no regressions in functionality
- **Threshold**: 100% test pass rate
- **Check**: `npm test`
- **Required for**: All activities
- **Remediation**: Fix failing tests, update test expectations

### 6. 🛡️ Security Vulnerabilities Gate
- **Purpose**: Block security vulnerabilities
- **Threshold**: 0 high-severity vulnerabilities
- **Check**: `npm audit --audit-level=high`  
- **Required for**: Security activities
- **Remediation**: Update vulnerable dependencies, fix security issues

### 7. 🏷️ Component Flags Gate
- **Purpose**: Limit number of problematic components
- **Threshold**: Within configured flag limits
- **Check**: `./bin/check-flag-limits.sh`
- **Required for**: Warning only
- **Remediation**: Resolve flagged components before committing

### 8. 🧪 Stress Tests Gate
- **Purpose**: Validate memory/performance fixes under load
- **Threshold**: All stress tests pass
- **Check**: `./test/stress-test-memory.sh`
- **Required for**: Memory/performance fixes
- **Remediation**: Fix memory leaks, performance bottlenecks

## Activity-Specific Requirements

### 🔧 Fix Activities
**Required Gates**:
- ✅ All tests pass
- 🚨 No critical issues  
- 🚫 No manual intervention
- 🧪 Stress tests (for memory/perf fixes)

**Optional Gates**:
- 📊 Test coverage
- 💀 No dead code

### 🚀 Feature Activities
**Required Gates**:
- ✅ All tests pass
- 📊 Test coverage ≥80%
- 🚨 No critical issues
- 🛡️ No security vulnerabilities

**Optional Gates**:
- 💀 No dead code
- 🏷️ Component flags within limits

### 🐛 Bugfix Activities  
**Required Gates**:
- ✅ All tests pass
- 🚨 No critical issues
- 🚫 No manual intervention
- 🧪 Stress tests

**Optional Gates**:
- 📊 Test coverage

### 🔄 Refactor Activities
**Required Gates**:
- ✅ All tests pass
- 🚨 No critical issues
- 💀 No dead code

**Optional Gates**:
- 📊 Test coverage

### 🔒 Security Activities
**Required Gates**:
- ✅ All tests pass
- 🚨 No critical issues
- 🛡️ No security vulnerabilities
- 📊 Test coverage ≥80%

**Optional Gates**:
- 💀 No dead code

## Installation

### Automatic Installation
```bash
# Install pre-commit hook with all configuration
./bin/install-pre-commit-hook.sh
```

### Manual Installation
```bash
# Make hook executable
chmod +x hooks/pre-commit-activity-check.sh

# Create symlink in git hooks directory
ln -sf ../../hooks/pre-commit-activity-check.sh .git/hooks/pre-commit
```

### Verification
```bash
# Test hook is working
git add some_file.ts
git commit -m "test: verify hook is working"
# Should run quality gate checks
```

## Usage Examples

### Successful Commit (Feature)
```bash
git add src/new-feature.ts tests/new-feature.test.ts
git commit -m "feat: add user authentication system"

# Output:
🔒 Pre-commit Activity Quality Gate Checks
===========================================
📋 Analyzing changes...
🏷️  Detected activity type: feature

🔍 Running Quality Gate Checks...

[1/8] Test Coverage Gate
✅ PASS: test_coverage

[2/8] Critical Issues Gate  
✅ PASS: no_critical_issues

[3/8] Dead Code Gate
✅ PASS: no_dead_code

[4/8] Manual Intervention Gate
✅ PASS: no_manual_intervention

[5/8] All Tests Pass Gate
✅ PASS: all_tests_pass

[6/8] Security Vulnerabilities Gate
✅ PASS: security_scan_clean

[7/8] Component Flags Gate
✅ PASS: component_flags_ok

[8/8] Stress Tests Gate
No memory/performance changes detected, skipping stress tests

📊 Quality Gate Results
=======================
✅ ALL QUALITY GATES PASSED
Passed: 7/7 checks

🚀 Commit allowed - all quality standards met
```

### Blocked Commit (Critical Issues)
```bash
git add src/buggy-component.ts  
git commit -m "fix: attempt to fix authentication bug"

# Output:
🔒 Pre-commit Activity Quality Gate Checks
===========================================
📋 Analyzing changes...
🏷️  Detected activity type: fix

🔍 Running Quality Gate Checks...

[1/8] Test Coverage Gate
✅ PASS: test_coverage

[2/8] Critical Issues Gate
❌ FAIL: no_critical_issues
   Found 2 critical issues. Fix security vulnerabilities and critical bugs before committing.

Critical Issues Found:
- SQL injection vulnerability in login function
- Memory leak in session cleanup

[3/8] Dead Code Gate
✅ PASS: no_dead_code

...

📊 Quality Gate Results
=======================
❌ QUALITY GATES FAILED
Failed: 1/7 checks
Passed: 6/7 checks

🚫 COMMIT BLOCKED

💡 To fix quality gate failures:
   1. Address the failed checks listed above
   2. Run tests: npm test  
   3. Check code quality: metabob-cli get-priority-issues
   4. Fix security vulnerabilities: npm audit fix
```

### Memory Fix with Stress Tests
```bash
git add src/memory-optimized-cache.ts
git commit -m "fix: resolve memory leak in session cache"

# Output:
🔒 Pre-commit Activity Quality Gate Checks
===========================================
📋 Analyzing changes...
🏷️  Detected activity type: fix

🔍 Running Quality Gate Checks...

...

[8/8] Stress Tests Gate
Memory/performance changes detected - running stress tests
✅ PASS: stress_tests_pass

📊 Quality Gate Results
=======================
✅ ALL QUALITY GATES PASSED
Passed: 8/8 checks

🚀 Commit allowed - all quality standards met
```

## Configuration

### Environment Variables
```bash
# Quality gate thresholds
export TEST_COVERAGE_THRESHOLD=80
export MAX_CRITICAL_ISSUES=0
export MAX_DEAD_CODE_LINES=0
export MAX_SECURITY_VULNERABILITIES=0

# Tool paths
export METABOB_CLI_PATH="metabob-cli"
export NPM_PATH="npm"

# Hook behavior
export HOOK_TIMEOUT=300  # 5 minutes
export SKIP_OPTIONAL_GATES=false
export VERBOSE_OUTPUT=false
```

### Hook Configuration Files

The hook reads configuration from these files:
- `.activity-quality-gates.json` - Quality gate definitions
- `.activity-failure-conditions.json` - Failure condition rules
- `bin/check-flag-limits.sh` - Component flagging limits
- `test/stress-test-memory.sh` - Stress testing configuration

### Activity Type Detection

The hook automatically detects activity types from commit messages:

| Commit Message Pattern | Activity Type | Requirements |
|------------------------|---------------|-------------|
| `fix: ...` | fix | Tests pass + no critical issues + stress tests |
| `feat: ...` | feature | Tests pass + coverage + no critical issues |  
| `refactor: ...` | refactor | Tests pass + no dead code + no critical issues |
| `security ...` | security | Tests pass + no vulnerabilities + coverage |
| `perf: ...` | bugfix | Tests pass + stress tests + no critical issues |
| `memory ...` | bugfix | Tests pass + stress tests + no critical issues |

## Troubleshooting

### Common Issues

**Hook not running:**
```bash
# Check hook is installed and executable
ls -la .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Verify symlink is correct
readlink .git/hooks/pre-commit
```

**Tool dependencies missing:**
```bash
# Install Node.js and npm
# Install metabob-cli
npm install -g @metabob/cli

# Verify tools are available
npm --version
node --version
metabob-cli --version
```

**Tests failing:**
```bash
# Run tests manually to debug
npm test
npm test -- --coverage

# Fix failing tests
# Update test expectations if needed
```

**Quality gate configuration missing:**
```bash
# Check configuration files exist
ls -la .activity-quality-gates.json
ls -la .activity-failure-conditions.json

# Restore from templates if missing
cp templates/quality-gates.json .activity-quality-gates.json
```

### Debug Mode
```bash
# Enable verbose output
VERBOSE_OUTPUT=true git commit -m "test commit"

# Run hook manually for debugging
./hooks/pre-commit-activity-check.sh

# Check specific gate manually
npm test -- --coverage
metabob-cli get-priority-issues --severity CRITICAL
```

### Bypass Options

**Temporary bypass (NOT RECOMMENDED):**
```bash
git commit --no-verify -m "emergency fix"
```

**Disable hook temporarily:**
```bash
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled
# Remember to re-enable: mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

**Skip specific gates (for testing):**
```bash
SKIP_COVERAGE_CHECK=true git commit -m "test commit"
SKIP_STRESS_TESTS=true git commit -m "memory fix"
```

## Integration with Development Workflow

### IDE Integration
Most IDEs respect git hooks and will run them automatically:
- **VS Code**: Runs hooks on commit via Git integration
- **JetBrains IDEs**: Executes hooks during commit process
- **Vim/Neovim**: Works with git commit commands

### CI/CD Integration
The pre-commit hook complements CI/CD pipelines:
```yaml
# .github/workflows/quality.yml
name: Quality Gates
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run quality checks
        run: ./hooks/pre-commit-activity-check.sh
```

### Team Collaboration
- **Onboarding**: New team members get quality enforcement automatically
- **Code Reviews**: Reduces manual quality checking in reviews
- **Standards**: Ensures consistent quality standards across team
- **Learning**: Developers learn quality requirements through feedback

## Customization

### Adding Custom Gates
```bash
# Edit hooks/pre-commit-activity-check.sh
# Add new gate check:

echo -e "${CYAN}[9/9] Custom Gate${NC}"
run_quality_gate \
    "custom_check" \
    "Checking custom requirements" \
    "your-custom-command" \
    "Custom check failed - fix the issue" \
    "true"  # required
```

### Modifying Activity Requirements
```bash
# Edit activity-specific requirements in the hook
case "$ACTIVITY_TYPE" in
    "custom-activity")
        REQUIRED_GATES=("all_tests_pass" "custom_check")
        OPTIONAL_GATES=("test_coverage")
        ;;
esac
```

### Creating Activity-Specific Hooks
```bash
# Create hooks/pre-commit-security.sh for security activities
# Install specific hook: ln -sf ../../hooks/pre-commit-security.sh .git/hooks/pre-commit
```

## Metrics and Monitoring

### Hook Performance
- Average execution time: ~30-60 seconds
- Memory usage: ~50MB peak
- CPU usage: Low (mostly I/O bound)

### Quality Metrics
Track these metrics over time:
- Commit success rate
- Most common gate failures  
- Average fix time for blocked commits
- Quality trend analysis

### Reporting
```bash
# Generate quality report
./scripts/generate-quality-report.sh

# Hook execution logs
tail -f /var/log/git-hooks.log

# Quality trend analysis
./scripts/analyze-quality-trends.sh
```

This comprehensive pre-commit hook system ensures that all code changes meet strict quality standards, preventing issues from reaching the main branch while providing clear guidance for fixing any problems that are detected.