# Validation Harnesses

This directory contains automated validation harnesses for verifying specification compliance without requiring LLM inference.

## Purpose

Validation harnesses provide:
1. **Regression Detection** - Catch specification violations after code changes
2. **Deployment Validation** - Verify deployments meet architectural requirements
3. **Historical Validation** - Re-run tests without LLM using stored expected values
4. **CI/CD Integration** - Automated pass/fail checks in pipelines

## Available Harnesses

### SurrealDB v3.0.0 Schema Initialization
**File:** `surrealdb-v3-schema-init-harness.sh`  
**Specification:** SurrealDB v3.0.0 Schema Initialization on K8s Deployment  
**Checks:** 11 validation checks  
**Impulse:** harness-surrealdb-v3-schema-init

Validates:
- SurrealDB v3.0.0 deployment with correct flags
- StatefulSet with RocksDB persistence
- Schema initialization with PERMISSIONS FULL
- Database name alignment (SurrealDB ↔ RPC API)
- End-to-end data flow (GAP-9 test)

## Usage

### Run Validation (Human Output)
```bash
./surrealdb-v3-schema-init-harness.sh
```

### Run Validation (JSON Output for CI/CD)
```bash
./surrealdb-v3-schema-init-harness.sh --json
```

### Exit Codes
- `0` - All checks passed
- `1` - One or more checks failed

## Creating New Harnesses

1. **Define Test Cases** - Create impulses with expected inputs/outputs
2. **Write Harness Script** - Implement validation logic (no LLM needed)
3. **Document Harness** - Create impulse with file pointer and usage
4. **Store in Git** - Commit harness script to this directory

### Template Structure
```bash
#!/bin/bash
# Validation Harness: [Specification Name]
# Purpose: [Brief description]
# Usage: ./[harness-name].sh [--json]

set -euo pipefail

# ... validation checks ...

# Output results (human or JSON)
if [[ "$JSON_OUTPUT" == "true" ]]; then
    # JSON format
else
    # Human-readable format
fi
```

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Run Validation Harness
  run: |
    ./tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh --json > results.json
    jq -e '.pass == true' results.json
```

### GitLab CI
```yaml
validate:
  script:
    - ./tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh --json > results.json
    - test "$(jq -r '.pass' results.json)" = "true"
```

## Impulse System Integration

Each harness has associated impulses:

- **Harness Impulse** - File pointer and documentation
  - ID: `harness-[spec-name]`
  - Type: file
  - Purpose: Reference to harness script

- **Test Case Impulses** - Expected inputs/outputs
  - ID: `validation-[spec-name]-case-N`
  - Type: memo
  - Purpose: Historical test data (no LLM needed)

These impulses enable:
- Rerunning tests without LLM inference
- Historical validation against past specifications
- Cross-agent validation sharing

## Best Practices

1. **No LLM Required** - Harnesses should be pure shell/Python scripts
2. **Deterministic** - Same input always produces same output
3. **Fast** - Should complete in < 60 seconds
4. **Isolated** - No side effects, idempotent
5. **Clear Output** - Both human and machine-readable formats
6. **Documented** - Each check has clear expected vs actual values

## Troubleshooting

### Harness Fails After Deployment
1. Check if deployment completed: `kubectl get pods -n metabob`
2. Review harness output for specific failed check
3. Compare actual vs expected values
4. Check impulse for expected behavior

### JSON Output Parsing Errors
```bash
# Validate JSON output
./harness.sh --json | jq '.'

# Pretty print for debugging
./harness.sh --json | jq '.checks'
```

### Permission Errors
```bash
# Make harness executable
chmod +x surrealdb-v3-schema-init-harness.sh
```

## Related Documentation

- Trace Impulses: `impulses/trace-*.md`
- Enforcement Impulses: `impulses/enforcement-*.md`
- Validation Cases: `impulses/validation-*-case-*.md`
- Harness Impulses: `impulses/harness-*.md`
