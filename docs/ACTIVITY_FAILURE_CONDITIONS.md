# Activity Failure Conditions Documentation

## Overview

The Activity Failure Conditions system provides comprehensive automatic detection of failure scenarios that should prevent activities from being committed. This system works alongside the [Activity Quality Gates](./ACTIVITY_QUALITY_GATES.md) to ensure high code quality standards.

## Key Features

- **Automatic failure detection** with configurable thresholds
- **Activity-specific validation** tailored to different activity types
- **Fail-fast execution** to save development time
- **Comprehensive reporting** with actionable remediation steps
- **Pre-commit integration** to prevent bad commits
- **CI/CD pipeline support** for automated quality gates

## Configuration Files

### `.activity-failure-conditions.json`
Main configuration file defining:
- **Automatic failures**: Critical conditions that must fail the activity
- **Soft failures**: Warnings that allow manual override
- **Activity-specific conditions**: Different rules per activity type
- **Detection configuration**: Execution behavior and timeouts

### `lib/activity-failure-detector.ts`
TypeScript implementation providing:
- `ActivityFailureDetector` class for comprehensive checking
- `checkActivityFailureConditions()` function for standalone use  
- `validateActivityBeforeCommit()` integration function
- Metrics collection and failure reporting

### `scripts/validate-activity.ts`
CLI script for activity validation:
- Command-line interface for manual testing
- CI pipeline integration
- JSON output for automated processing
- Configurable exit codes

### `scripts/pre-commit-activity-validation`
Pre-commit hook for automatic validation:
- Git hook integration
- Activity type auto-detection from commit messages
- Colored output for better developer experience
- Bypass options for emergencies

## Failure Conditions

### 🚨 Automatic Failures (CRITICAL/HIGH)

| Condition | Description | Threshold | Impact |
|-----------|-------------|-----------|---------|
| `requires_user_input` | Activity needs manual intervention | Any manual markers | CRITICAL - Blocks automation |
| `test_coverage_drop` | Test coverage below minimum | < 80% | HIGH - Quality regression |
| `new_critical_issues` | New HIGH/CRITICAL Metabob issues | > 0 issues | CRITICAL - Security/quality risk |
| `dead_code_added` | Unused functions or dead code | > 0 lines | HIGH - Technical debt |
| `test_failures` | Existing tests fail | > 0 failures | CRITICAL - Regression detected |
| `fix_ineffective` | Bug fix doesn't work | Reproducer still fails | CRITICAL - Fix is broken |
| `security_vulnerabilities` | New security issues | > 0 high-severity | CRITICAL - Security risk |
| `breaking_changes_unversioned` | API changes without version bump | > 0 breaking changes | HIGH - Compatibility risk |
| `memory_regression` | Memory usage increased | > 10% increase | HIGH - Performance risk |
| `build_failures` | Code fails to compile | > 0 build errors | CRITICAL - Deployment blocker |
| `linting_failures` | Code style violations | > 0 linting errors | MEDIUM - Style inconsistency |

### ⚠️ Soft Failures (Warnings)

| Condition | Description | Threshold | Action |
|-----------|-------------|-----------|---------|
| `suboptimal_performance` | Performance less than target | < 20% improvement | WARN - Allow override |
| `test_coverage_decline` | Coverage decreased but acceptable | 80% ≤ coverage < previous | WARN - Suggest improvement |
| `minor_dead_code` | Small amounts of unused code | < 10 lines | WARN - Suggest cleanup |
| `documentation_gaps` | Missing API documentation | < 70% doc coverage | WARN - Suggest docs |

## Activity-Specific Rules

### 🔧 Fix Activities
**Purpose**: Bug fixes and small corrections

**Required Checks**:
- ✅ All tests pass
- ✅ Fix is effective (reproducer passes)
- ✅ No critical issues introduced
- ✅ No manual intervention required

**Optional Checks**:
- Test coverage maintenance
- Dead code cleanup

### 🚀 Feature Activities  
**Purpose**: New functionality and enhancements

**Required Checks**:
- ✅ All tests pass
- ✅ Test coverage ≥ 80%
- ✅ No critical issues
- ✅ Security vulnerabilities clean
- ✅ No manual intervention

**Optional Checks**:
- Dead code cleanup
- No breaking changes

### 🐛 Bugfix Activities
**Purpose**: Significant bug resolution

**Required Checks**:
- ✅ All tests pass
- ✅ Fix is effective
- ✅ No critical issues
- ✅ Fully automated
- ✅ No memory regression

**Optional Checks**:
- Test coverage improvement

### 🔄 Refactor Activities
**Purpose**: Code structure improvements

**Required Checks**:
- ✅ All tests pass
- ✅ No critical issues
- ✅ No dead code added
- ✅ No breaking changes

**Optional Checks**:
- Test coverage maintenance
- Memory improvement

### 🔒 Security Activities
**Purpose**: Security fixes and improvements

**Required Checks**:
- ✅ All tests pass
- ✅ No security vulnerabilities
- ✅ No critical issues
- ✅ Test coverage ≥ 80%

**Optional Checks**:
- Code style compliance
- Dead code cleanup

## Usage Examples

### Command Line Validation
```bash
# Validate current activity
npm run validate:activity

# Validate specific activity type
npm run validate:activity --activity-type feature

# JSON output for CI
npm run validate:activity --format json --no-exit

# Use custom config
npm run validate:activity --config ./custom-conditions.json
```

### Programmatic Usage
```typescript
import { checkActivityFailureConditions } from './lib/activity-failure-detector';

const activity = {
  id: 'act_123',
  type: 'feature',
  output: 'Activity completed successfully',
  metrics: {
    testCoverage: 0.85,
    newCriticalIssues: 0,
    testFailures: 0,
    // ... other metrics
  },
  files: ['src/feature.ts', 'tests/feature.test.ts'],
  status: 'completed'
};

const failures = await checkActivityFailureConditions(activity);
if (failures.length > 0) {
  console.error('Activity failed validation:', failures);
}
```

### Pre-commit Hook Integration
```bash
# Install pre-commit hook
ln -s ../../scripts/pre-commit-activity-validation .git/hooks/pre-commit

# Hook automatically runs on git commit
git commit -m "feat: add user authentication"
# → Runs validation automatically
# → Blocks commit if validation fails
```

### CI Pipeline Integration
```yaml
# .github/workflows/quality.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  validate-activity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Validate activity
        run: npm run validate:activity --format json
        
      - name: Upload failure report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: activity-failure-report
          path: reports/activity-failure-*.json
```

## Failure Detection Flow

```
1. Activity Completion
   ↓
2. Collect Metrics
   ├── Test Coverage
   ├── Critical Issues  
   ├── Test Results
   ├── Build Status
   └── Security Scan
   ↓
3. Apply Activity-Specific Rules
   ├── Required checks for activity type
   └── Optional checks for activity type
   ↓
4. Check Conditions (Fail-Fast)
   ├── CRITICAL: Block immediately
   ├── HIGH: Block with remediation
   ├── MEDIUM: Warn but continue
   └── LOW: Log for improvement
   ↓
5. Generate Report
   ├── Failure summary
   ├── Remediation steps
   └── Check commands
   ↓
6. Exit with Status Code
   ├── 0: Success
   ├── 1: Critical failures
   ├── 2: High failures  
   └── 3: Warnings only
```

## Customization

### Adding New Failure Conditions
1. **Add to config**: Define condition in `.activity-failure-conditions.json`
2. **Implement checker**: Add method to `ActivityFailureDetector` class
3. **Update documentation**: Document purpose and remediation
4. **Test thoroughly**: Ensure condition works across activity types

### Adjusting Thresholds
```json
{
  "automatic_failures": [
    {
      "condition": "test_coverage_drop",
      "threshold": "< 85%", // Increased from 80%
      "description": "Higher coverage requirement"
    }
  ]
}
```

### Activity-Specific Overrides
```json
{
  "activity_specific_conditions": {
    "hotfix": {
      "required_checks": [
        "test_failures",
        "fix_ineffective"
      ],
      "optional_checks": []
    }
  }
}
```

### Custom Check Commands
```json
{
  "automatic_failures": [
    {
      "condition": "custom_quality_gate",
      "check_command": "npm run custom:quality:check",
      "remediation": "Fix custom quality issues"
    }
  ]
}
```

## Troubleshooting

### Common Issues

**"Metabob CLI not found"**
```bash
# Install Metabob CLI
npm install -g @metabob/cli

# Or use local installation
npx @metabob/cli --version
```

**"Config file not found"**
```bash
# Verify config exists
ls -la .activity-failure-conditions.json

# Use absolute path if needed
npm run validate:activity --config /full/path/to/config.json
```

**"Tests timing out"**
```bash
# Increase timeout in config
{
  "failure_detection_config": {
    "timeout_seconds": 600
  }
}
```

**"False positives for user input"**
```bash
# Review indicators in config
{
  "indicators": [
    "awaits user response",
    "manual review needed"
    // Remove problematic patterns
  ]
}
```

### Debug Mode
```bash
# Enable verbose output
DEBUG=1 npm run validate:activity

# Check specific condition
npm run validate:activity --activity-type fix --format json | jq '.failures'
```

### Emergency Bypass
```bash
# Bypass pre-commit validation (NOT RECOMMENDED)
git commit --no-verify

# Bypass CI validation
git push --force-with-lease
```

## Integration Points

### Quality Gates Integration
- Failure conditions complement quality gates
- Quality gates define standards, failure conditions enforce them
- Both systems share configuration patterns

### Metabob Integration
- Leverages Metabob CLI for issue detection
- Uses priority issue analysis
- Integrates security vulnerability scanning

### Activity Templates
- Templates can specify custom failure conditions
- Activity-specific thresholds and checks
- Template validation includes failure condition compliance

### Development Workflow
- Pre-commit hooks prevent bad commits
- CI pipelines enforce standards
- Developer feedback loop for continuous improvement

This comprehensive failure detection system ensures that activities maintain high quality standards while providing clear feedback and remediation guidance to developers.