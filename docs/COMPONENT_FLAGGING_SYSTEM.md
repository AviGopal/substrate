# Component Flagging System Documentation

## Overview

The Component Flagging System provides automatic detection and tracking of problematic components using Metabob annotations and manual flag management. This system helps identify risky, untested, or experimental code before it causes issues in production.

## Key Features

- **🏷️ Automatic flagging** of components based on code analysis
- **🔍 Multiple flag types** for different kinds of issues  
- **⚡ Integration with Metabob** for advanced code quality analysis
- **📊 Flag limit enforcement** to prevent commits with too many issues
- **🎯 Severity-based prioritization** for efficient issue resolution
- **📈 Trend tracking** to monitor code quality over time

## Flag Types

### 🧪 EXPERIMENTAL
- **Purpose**: New, unproven code that hasn't been validated
- **When to use**: New features, algorithms, or approaches
- **Example**: New caching system, experimental API design
- **Resolution**: Performance testing, code review, production validation

### ⚠️ RISKY  
- **Purpose**: High-risk implementations that could cause issues
- **When to use**: Complex logic, external integrations, critical paths
- **Example**: Payment processing, authentication logic
- **Resolution**: Additional testing, code review, monitoring

### 💀 DEAD_CODE
- **Purpose**: Unused or unreachable code that should be removed
- **When to use**: Unused functions, unreachable branches, orphaned files
- **Example**: Legacy functions, commented-out code
- **Resolution**: Remove unused code, verify no dependencies

### 🚫 NO_TESTS
- **Purpose**: Code lacking adequate test coverage
- **When to use**: New functions without tests, uncovered branches
- **Example**: Utility functions, business logic, API endpoints
- **Resolution**: Add unit tests, integration tests, coverage verification

### 🔍 MEMORY_LEAK
- **Purpose**: Potential memory management issues
- **When to use**: Event listeners without cleanup, large objects, circular references
- **Example**: Unclosed connections, retained event handlers
- **Resolution**: Fix memory leaks, add cleanup logic, validate with profiling

### 🛡️ SECURITY_RISK
- **Purpose**: Security vulnerabilities or risky patterns
- **When to use**: SQL injection, XSS, authentication bypass
- **Example**: Unsanitized inputs, hardcoded credentials
- **Resolution**: Fix security issues, security review, penetration testing

### 🐌 PERFORMANCE
- **Purpose**: Performance bottlenecks or inefficient code
- **When to use**: Slow algorithms, expensive operations, resource usage
- **Example**: N+1 queries, large loops, heavy computations
- **Resolution**: Optimize algorithms, add caching, performance testing

### 📰 DEPRECATED
- **Purpose**: Legacy code that should be removed or replaced
- **When to use**: Old APIs, deprecated libraries, outdated patterns
- **Example**: Old authentication system, legacy data formats
- **Resolution**: Replace with new implementation, migration plan

## Severity Levels

### 🚨 CRITICAL
- **Impact**: System failures, security breaches, data loss
- **Response**: Immediate action required, blocks deployment
- **Examples**: Security vulnerabilities, critical bugs

### 🔴 HIGH
- **Impact**: Significant issues, major functionality problems
- **Response**: Address within 1-2 days, may block commits
- **Examples**: Memory leaks, performance issues, missing tests

### 🟡 MEDIUM
- **Impact**: Moderate issues, code quality problems
- **Response**: Address within 1 week, warnings generated
- **Examples**: Code style violations, minor dead code

### 🟢 LOW
- **Impact**: Minor issues, improvement opportunities
- **Response**: Address when convenient, informational
- **Examples**: Documentation gaps, minor optimizations

## Usage Guide

### Command Line Tools

#### Flag Components
```bash
# Flag a component with specific type and message
./bin/flag-components.sh <file> <flag_type> <message> [severity]

# Examples
./bin/flag-components.sh src/auth.js NO_TESTS "Authentication module lacks unit tests" HIGH
./bin/flag-components.sh lib/cache.ts EXPERIMENTAL "New caching system, performance not validated" MEDIUM
./bin/flag-components.sh utils/helper.js DEAD_CODE "Unused utility functions should be removed" LOW
```

#### List Flags
```bash
# Show all active flags
./bin/list-flags.sh

# Show all flags including resolved
./bin/list-flags.sh true

# JSON output for CI integration
./bin/list-flags.sh false json

# Summary statistics
./bin/list-flags.sh false summary
```

#### Resolve Flags
```bash
# Resolve a specific flag
./bin/resolve-flag.sh <file> <flag_type> [resolution_message]

# Examples
./bin/resolve-flag.sh src/auth.js NO_TESTS "Added comprehensive unit tests"
./bin/resolve-flag.sh lib/cache.ts EXPERIMENTAL "Performance validated in production"
```

#### Automatic Scanning
```bash
# Scan codebase and flag issues automatically
./bin/auto-flag-scan.sh

# Dry run - show what would be flagged
./bin/auto-flag-scan.sh true

# Verbose output
./bin/auto-flag-scan.sh false true
```

#### Check Limits
```bash
# Check if flag limits are exceeded
./bin/check-flag-limits.sh

# Strict mode with lower limits
./bin/check-flag-limits.sh true

# Check without blocking commits
./bin/check-flag-limits.sh false false
```

### Programmatic Usage

#### JavaScript/Node.js Integration
```javascript
const fs = require('fs');

// Read flag metadata
const flags = JSON.parse(fs.readFileSync('.metabob/component-flags.json', 'utf8'));

// Filter active flags
const activeFlags = flags.filter(f => !f.resolved);

// Get critical issues
const criticalFlags = activeFlags.filter(f => f.severity === 'CRITICAL');

// Check specific file
const fileFlags = activeFlags.filter(f => f.file === 'src/component.js');
```

#### Pre-commit Hook Integration
```bash
#!/bin/bash
# In .git/hooks/pre-commit

# Check flag limits before allowing commit
if ! ./bin/check-flag-limits.sh; then
    echo "❌ Too many flagged components - fix issues before committing"
    exit 1
fi

# Run auto-scan on changed files
git diff --cached --name-only | while read file; do
    if [[ "$file" =~ \.(ts|js|tsx|jsx)$ ]]; then
        # Custom flagging logic here
        echo "Checked $file"
    fi
done
```

### CI/CD Integration

#### GitHub Actions
```yaml
name: Component Flag Check

on: [push, pull_request]

jobs:
  check-flags:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Auto-scan for new flags
        run: ./bin/auto-flag-scan.sh
        
      - name: Check flag limits
        run: ./bin/check-flag-limits.sh true  # Strict mode for CI
        
      - name: Generate flag report
        if: always()
        run: ./bin/list-flags.sh false json > flag-report.json
        
      - name: Upload flag report
        uses: actions/upload-artifact@v3
        with:
          name: flag-report
          path: flag-report.json
```

#### Activity Template Integration
```json
{
  "id": "feature-with-flagging",
  "name": "Feature Development with Automatic Flagging",
  "tasks": [
    {
      "id": "implement-feature",
      "description": "Implement the new feature",
      "validation": {
        "commands": [
          "./bin/auto-flag-scan.sh",
          "./bin/check-flag-limits.sh"
        ]
      }
    },
    {
      "id": "resolve-flags",
      "description": "Resolve any flagged components",
      "validation": {
        "commands": [
          "test $(./bin/list-flags.sh false json | jq length) -eq 0"
        ]
      }
    }
  ]
}
```

## Automatic Detection Rules

### Files Without Tests
- **Detection**: Looks for `.ts/.js` files without corresponding test files
- **Patterns**: `*.test.ts`, `*.spec.js`, `tests/*.test.ts`, `__tests__/*.js`
- **Threshold**: Files with > 10 lines and containing functions/classes
- **Flag**: `NO_TESTS` with `HIGH` severity

### Experimental Code
- **Detection**: Files containing TODO/FIXME/HACK/XXX comments
- **Threshold**: > 3 experimental markers in a single file
- **Flag**: `EXPERIMENTAL` with `MEDIUM` severity

### Memory Issues
- **Detection**: Event listeners without cleanup, timers without cleanup
- **Patterns**: `addEventListener` without `removeEventListener`
- **Flag**: `MEMORY_LEAK` with `MEDIUM` severity

### Dead Code
- **Detection**: Unused imports, unreachable code, unused functions
- **Integration**: Uses Metabob analysis when available
- **Flag**: `DEAD_CODE` with `MEDIUM` severity

### Security Issues
- **Detection**: Metabob security analysis
- **Patterns**: SQL injection, XSS vulnerabilities, hardcoded secrets
- **Flag**: `SECURITY_RISK` with `CRITICAL` severity

### Deprecated Code
- **Detection**: @deprecated comments, CommonJS in TypeScript files
- **Patterns**: `require()`, `module.exports` in `.ts` files
- **Flag**: `DEPRECATED` with `LOW` severity

## Configuration

### Environment Variables
```bash
# Flag limits (used by check-flag-limits.sh)
export MAX_TOTAL_FLAGS=10
export MAX_CRITICAL_FLAGS=2
export MAX_HIGH_FLAGS=5
export MAX_SECURITY_FLAGS=1
export MAX_MEMORY_LEAK_FLAGS=3

# Metabob integration
export METABOB_CLI_PATH="/usr/local/bin/metabob-cli"
export METABOB_CONFIG_PATH=".metabob/config.json"
```

### Custom Detection Rules
Create custom detection in `auto-flag-scan.sh`:

```bash
# Custom rule for API endpoints without rate limiting
find "$PROJECT_ROOT/src/api" -name "*.ts" | while read -r file; do
    if grep -q "app\.(get|post|put|delete)" "$file" && ! grep -q "rateLimit\|rate-limit" "$file"; then
        flag_if_needed "$file" "SECURITY_RISK" "API endpoint without rate limiting" "HIGH"
    fi
done
```

### Integration with Quality Gates

The flagging system integrates with [Activity Quality Gates](./ACTIVITY_QUALITY_GATES.md):

```json
{
  "quality_gates": {
    "no_flagged_components": {
      "maximum_active_flags": 5,
      "maximum_critical_flags": 0,
      "check_command": "./bin/check-flag-limits.sh",
      "description": "No excessive component flags"
    }
  }
}
```

## File Structure

```
bin/
├── flag-components.sh      # Flag individual components
├── list-flags.sh          # List and view flags
├── resolve-flag.sh        # Resolve flags
├── auto-flag-scan.sh      # Automatic detection
└── check-flag-limits.sh   # Limit enforcement

.metabob/
├── component-flags.json   # Flag metadata
└── component-flags.log    # Activity log

docs/
└── COMPONENT_FLAGGING_SYSTEM.md
```

### Flag Metadata Format
```json
[
  {
    "file": "src/component.ts",
    "type": "EXPERIMENTAL",
    "severity": "HIGH", 
    "message": "New experimental feature",
    "flagged_at": "2026-01-30T10:30:00Z",
    "resolved": false,
    "resolved_at": null,
    "resolution_message": null
  }
]
```

## Best Practices

### When to Flag Components

**✅ DO Flag:**
- New code without tests
- Experimental implementations
- Code with security vulnerabilities
- Performance bottlenecks
- Unused/dead code
- Risky business logic

**❌ DON'T Flag:**
- Minor style issues (use linting instead)
- Stable, well-tested code
- Third-party library code
- Generated code
- Configuration files

### Flag Resolution Workflow

1. **Prioritize by Severity**: Address CRITICAL and HIGH flags first
2. **Group by Type**: Batch similar flags for efficient resolution
3. **Test Thoroughly**: Verify fixes don't introduce new issues
4. **Document Resolution**: Provide clear resolution messages
5. **Monitor Trends**: Track flag creation vs resolution rates

### Team Collaboration

- **Code Reviews**: Check for new flags in pull requests
- **Daily Standups**: Discuss high-priority flags
- **Sprint Planning**: Allocate time for flag resolution
- **Documentation**: Keep flag messages clear and actionable

## Troubleshooting

### Common Issues

**Flags not being created:**
```bash
# Check if scripts are executable
ls -la bin/
chmod +x bin/*.sh

# Check if .metabob directory exists
mkdir -p .metabob
```

**Metabob integration failing:**
```bash
# Check if metabob-cli is installed
metabob-cli --version

# Check configuration
cat .metabob/config.json
```

**False positives in auto-scan:**
```bash
# Run in dry-run mode first
./bin/auto-flag-scan.sh true

# Adjust detection rules in auto-flag-scan.sh
```

**Limits too strict/lenient:**
```bash
# Adjust environment variables
export MAX_TOTAL_FLAGS=15
export MAX_HIGH_FLAGS=8

# Or use strict mode for higher standards
./bin/check-flag-limits.sh true
```

### Debug Commands
```bash
# Check flag metadata
cat .metabob/component-flags.json | jq .

# View recent activity
tail -10 .metabob/component-flags.log

# Test specific flag
./bin/flag-components.sh src/test.js EXPERIMENTAL "Test flag" LOW
./bin/resolve-flag.sh src/test.js EXPERIMENTAL "Test resolution"
```

## Integration Examples

### Example 1: Memory Monitor Flag
```bash
# Flag new memory monitoring code as experimental
./bin/flag-components.sh src/memory/memoryMonitor.ts EXPERIMENTAL \
  'New memory monitoring code. Effectiveness not yet proven. Needs performance testing before production use.'

# After testing and validation
./bin/resolve-flag.sh src/memory/memoryMonitor.ts EXPERIMENTAL \
  'Performance validated in production - monitoring system working correctly'
```

### Example 2: Security Issue
```bash
# Auto-detected security vulnerability
# (flagged automatically by auto-flag-scan.sh)

# View the issue
./bin/list-flags.sh | grep SECURITY_RISK

# Resolve after fixing
./bin/resolve-flag.sh src/auth/login.js SECURITY_RISK \
  'Fixed SQL injection vulnerability by using parameterized queries'
```

### Example 3: Dead Code Cleanup
```bash
# Auto-scan finds dead code
./bin/auto-flag-scan.sh

# Review dead code flags
./bin/list-flags.sh | grep DEAD_CODE

# Resolve by removing unused code
./bin/resolve-flag.sh src/utils/helpers.js DEAD_CODE \
  'Removed unused helper functions and cleaned up imports'
```

## Metrics and Reporting

### Flag Statistics
- **Total Active Flags**: Current number of unresolved flags
- **Resolution Rate**: Flags resolved per week
- **Flag Velocity**: New flags created per week
- **Time to Resolution**: Average time to resolve flags
- **Flag Distribution**: Breakdown by type and severity

### Quality Metrics
- **Code Quality Score**: Based on flag count and severity
- **Risk Assessment**: Number of CRITICAL and HIGH flags
- **Test Coverage Gaps**: NO_TESTS flags per module
- **Technical Debt**: DEAD_CODE and DEPRECATED flags

This comprehensive flagging system ensures proactive identification and resolution of code quality issues, preventing problems before they reach production while maintaining clear visibility into technical debt and risk areas.