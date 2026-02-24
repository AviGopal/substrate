# Safe Config Self-Modification Validation Harness

**Specification:** safe-config-self-modification  
**Pattern:** trace-enforce-validate-loop  
**Date:** 2026-02-24

## Overview

This validation harness verifies that the safe config self-modification system is correctly implemented with all 6 critical requirements:

1. **REQ-1: Validate Before Mutation (CRITICAL)** - Sandbox validation in tmpdir
2. **REQ-2: Backup Before Mutation (CRITICAL)** - Timestamped backups with SHA256 checksums
3. **REQ-3: Graceful Reload or Defer (CRITICAL)** - Safety checks and defer mechanism
4. **REQ-4: Rollback on Failure (CRITICAL)** - Automatic rollback with backup preservation
5. **REQ-5: Impact Analysis Before Apply (HIGH)** - Identify affected MCP/agents/tools
6. **REQ-6: State Transformation Tracking (HIGH)** - Audit trail of instructional → functional changes

## Files

- `safe-config-self-modification-harness.ts` - Main validation harness (static checks)
- `safe-config-self-modification-test-cases.json` - Test case definitions with expected outputs
- `run-safe-config-self-modification-validation.ts` - Runner script
- `README-safe-config-self-modification.md` - This file

## Usage

### Run Static Validation

```bash
# From project root
bun run tests/validation-harnesses/run-safe-config-self-modification-validation.ts

# Or directly
cd tests/validation-harnesses
bun run safe-config-self-modification-harness.ts
```

### Expected Output

```
================================================================================
VALIDATION HARNESS: safe-config-self-modification
================================================================================

Overall Result: ✅ PASS
Summary: 7/7 static checks passed

Checks:
  ✅ Sandbox Validation Module
     sandbox-validation.ts correctly implements REQ-1 (Validate Before Mutation)
  ✅ Backup Module
     backup.ts correctly implements REQ-2 (Backup) and REQ-4 (Rollback)
  ✅ Impact Analysis Module
     impact-analysis.ts correctly implements REQ-5 (Impact Analysis)
  ✅ Reload Module
     reload.ts correctly implements REQ-3 (Graceful Reload or Defer)
  ✅ State Tracking Module
     state-tracking.ts correctly implements REQ-6 (State Transformation Tracking)
  ✅ Config.updateSafe()
     Config.updateSafe() correctly integrates all 6 requirements into safe workflow
  ✅ Backward Compatibility
     Config.update() preserved for backward compatibility

================================================================================

✅ All static validations passed!

Next steps:
  1. Run runtime tests with actual config changes
  2. Test validation failure rollback
  3. Test impact analysis accuracy
  4. Test graceful reload vs defer
```

## Static Validation Checks

### 1. Sandbox Validation Module
- ✅ `validateInSandbox()` export exists
- ✅ `cleanupSandbox()` export exists
- ✅ Creates isolated tmpdir with `fs.mkdtemp()`
- ✅ Validates schema
- ✅ Integrates with `ConfigValidation`

### 2. Backup Module
- ✅ `createBackup()` export exists
- ✅ `rollback()` export exists
- ✅ Uses SHA256 checksum verification
- ✅ Creates timestamped backups
- ✅ Verifies rollback integrity

### 3. Impact Analysis Module
- ✅ `analyzeImpact()` export exists
- ✅ Analyzes MCP servers
- ✅ Analyzes agents
- ✅ Analyzes tools
- ✅ Computes blast radius (low/medium/high/critical)

### 4. Reload Module
- ✅ `canReloadSafely()` export exists
- ✅ `reload()` export exists
- ✅ Implements defer mechanism with `.config-updated` marker
- ✅ Checks for active MCP operations
- ✅ Checks for running activities

### 5. State Tracking Module
- ✅ `captureState()` export exists
- ✅ `computeDelta()` export exists
- ✅ `createTransformation()` export exists
- ✅ Captures instructional state (intent)
- ✅ Captures functional state (files, runtime)
- ✅ Computes state delta

### 6. Config.updateSafe()
- ✅ `updateSafe()` export exists in `config.ts`
- ✅ Imports all required modules
- ✅ Has try/catch with rollback on failure
- ✅ Calls `validateInSandbox()`
- ✅ Calls `createBackup()`
- ✅ Calls `analyzeImpact()`
- ✅ Calls `reload()`
- ✅ Calls `captureState()`
- ✅ Calls `rollback()` on failure

### 7. Backward Compatibility
- ✅ Original `Config.update()` still exists
- ✅ Consumers can migrate incrementally to `updateSafe()`

## Test Cases

The harness includes 5 test cases defined in `safe-config-self-modification-test-cases.json`:

1. **Modify metabob setting with validation** - Happy path with successful validation
2. **Invalid change triggers rollback** - Validation failure, no mutation
3. **Add secret to config** - Test secret management
4. **Install plugin** - High impact change with deferred reload
5. **Impact analysis for MCP config change** - Test impact analysis accuracy

Each test case defines:
- `input` - The config change to apply
- `expectedOutput` - Expected behavior (validation, backup, reload, etc.)

## Runtime Testing (TODO)

Static validation checks code structure. For full validation, run runtime tests:

```bash
# Test 1: Modify metabob setting
bun run repos/metabob-opencode/packages/opencode/src/config/config.ts updateSafe \
  --operation modify_key \
  --path metabob.max_issues \
  --oldValue 5 \
  --newValue 10

# Test 2: Invalid change (should rollback)
bun run repos/metabob-opencode/packages/opencode/src/config/config.ts updateSafe \
  --operation modify_key \
  --path metabob.max_issues \
  --oldValue 5 \
  --newValue "INVALID"

# Expected: Validation fails, config unchanged, backup preserved
```

## Integration with trace-enforce-validate-loop

This validation harness is the **validate** step in the loop:

1. **Trace:** `trace-safe-config-self-modification` (completed)
2. **Enforce:** `enforcement-safe-config-self-modification` (completed)
3. **Validate:** This harness (current step)
4. **Iterate:** Fix any failing tests and re-run

## Success Criteria

- ✅ All 7 static checks pass
- ⏳ All 5 runtime test cases pass (TODO)
- ⏳ No config corruption in any test (TODO)
- ⏳ Rollback works on validation failure (TODO)
- ⏳ Rollback works on apply failure (TODO)

## References

- **Specification:** `docs/specifications/SAFE_CONFIG_SELF_MODIFICATION.md`
- **Architecture:** `docs/architecture/SAFE_SELF_DEVELOPMENT_ARCHITECTURE.md`
- **Trace Impulse:** `trace-safe-config-self-modification`
- **Enforcement Impulse:** `enforcement-safe-config-self-modification`
- **Harness Impulse:** `harness-safe-config-self-modification`
