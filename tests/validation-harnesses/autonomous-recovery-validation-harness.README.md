# Autonomous Recovery Validation Harness

## Purpose

Validates that the autonomous recovery system (agent-executor pattern) works correctly. The autonomous recovery system enables OpenCode to automatically create missing activity templates when requested.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Autonomous Recovery Flow                                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Activity Tool                                         │
│     ↓ templateId: "fix-sql-injection"                    │
│     ↓ reason: "Fix SQL in auth"                          │
│     ↓ variables: { file: "auth.ts" }                     │
│                                                           │
│  2. Template Selector                                     │
│     ↓ Template not found!                                │
│     ↓ if enableAutonomousRecovery → try-create-retry     │
│                                                           │
│  3. Goal Inference Engine                                 │
│     ↓ Infer goal from context:                           │
│     ↓  - templateId semantic analysis                    │
│     ↓  - reason parsing                                  │
│     ↓  - variables inspection                            │
│     ↓ LLM inference → rule-based fallback                │
│     → InferredGoal: { description, name, category }      │
│                                                           │
│  4. create_activity_goal_seeking                         │
│     ↓ Create template from goal                          │
│     → New template registered                            │
│                                                           │
│  5. Template Selector (retry)                            │
│     ↓ Load newly created template                        │
│     → Template found! Continue execution                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Test Phases

### Phase 1: Baseline (Autonomous Recovery DISABLED)
- **Test**: Request non-existent template `fix-sql-injection-vulnerability`
- **Expected**: Immediate failure with error message
- **Validates**:
  - ✓ No goal inference triggered
  - ✓ No template creation attempted
  - ✓ Clear error message returned

### Phase 2: Enabled (Autonomous Recovery ENABLED)
- **Test**: Request non-existent template `fix-authentication-sql-injection`
- **Context**: Full reason + variables provided
- **Expected**: Automatic template creation and successful execution
- **Validates**:
  - ✓ Goal inference from context
  - ✓ Template creation via goal-seeking
  - ✓ Retry with newly created template
  - ✓ Final success

### Phase 3: Rule-Based Fallback
- **Test**: Request template with minimal context (no reason/variables)
- **Expected**: Rule-based goal inference + successful creation
- **Validates**:
  - ✓ LLM failure fallback works
  - ✓ Rule-based inference from templateId
  - ✓ Template creation with inferred goal
  - ✓ Success even with minimal context

## Running the Harness

```bash
cd tests/validation-harnesses
npm exec tsx autonomous-recovery-validation-harness.ts
```

## What It Does

1. **Saves Original State**: Records current `enableAutonomousRecovery` flag value
2. **For Each Test Case**:
   - Sets flag to required value (true/false)
   - Rebuilds OpenCode distribution
   - Executes test scenario
   - Analyzes output for expected patterns
   - Validates behavior matches expectations
3. **Restores Original State**: Resets flag and rebuilds
4. **Generates Report**: Comprehensive JSON report with all evidence

## Output

```
Autonomous Recovery Validation Harness
================================================================================

Original autonomous recovery flag: false

🔨 Rebuilding OpenCode distribution...
✓ Build complete (161.2s)

================================================================================
Running: Phase 1: Missing template with autonomous recovery DISABLED
================================================================================

Result: ✅ PASS

[... more test cases ...]

================================================================================
VALIDATION SUMMARY
================================================================================

Total tests: 3
Passed: 3
Failed: 0

Overall Result: ✅ PASS

Report saved: test-results/autonomous-recovery-validation/validation-report-1773835789123.json
```

## Key Files

- **Harness**: `autonomous-recovery-validation-harness.ts`
- **Code Under Test**:
  - `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (flag location)
  - `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts` (try-create-retry)
  - `repos/metabob-opencode/packages/opencode/src/session/goal-inference-engine.ts` (goal inference)
- **Results**: `test-results/autonomous-recovery-validation/`

## Success Criteria

For autonomous recovery to be considered working:

1. ✅ **Phase 1 (Disabled)**: Fails fast with clear error, no side effects
2. ✅ **Phase 2 (Enabled)**: Goal inferred → template created → retry succeeded
3. ✅ **Phase 3 (Fallback)**: Rule-based inference works when LLM unavailable

## Evidence Collected

For each test case:
- Flag value (true/false)
- Full command output
- Goal inference triggered (boolean)
- Template created (boolean)
- Retry attempted (boolean)
- Error pattern matched (boolean)
- Validation errors (array)

## Meta-Validation

The harness validates itself:
- ✓ Tested with autonomous recovery disabled
- ✓ Tested with autonomous recovery enabled
- ✓ Tested LLM-based goal inference
- ✓ Tested rule-based fallback
- ✓ Tested infinite recursion prevention
- ✓ Used compiled distribution only (external validation)

## Troubleshooting

### Build Failures
If rebuild fails, check:
- TypeScript compilation errors
- Missing dependencies
- Disk space

### Test Failures
If test cases fail:
1. Check flag was actually changed (read activity.ts)
2. Verify build completed successfully
3. Review output patterns in result JSON
4. Check logs in `test-results/autonomous-recovery-validation/`

### Flag Not Restored
If harness exits unexpectedly:
```bash
# Manually check flag
grep "enableAutonomousRecovery" repos/metabob-opencode/packages/opencode/src/tool/activity.ts

# Manually set to false (safe default)
sed -i 's/enableAutonomousRecovery: true/enableAutonomousRecovery: false/g' repos/metabob-opencode/packages/opencode/src/tool/activity.ts

# Rebuild
cd repos/metabob-opencode/packages/opencode && npm run build
```

## Design Decisions

### Why External Validation?
- Tests observable behavior, not implementation
- Validates compiled distribution (what users run)
- Catches integration issues that unit tests miss

### Why Toggle Flag?
- Validates both enabled and disabled states
- Ensures safe fallback behavior
- Proves feature can be disabled if issues arise

### Why Rebuild Each Time?
- Ensures flag changes are actually compiled
- Validates build system works
- Catches build-time errors

### Why Save Original State?
- Non-destructive testing
- Developer can continue work after validation
- Prevents accidental production changes

## Related Specifications

- **agent-executor-autonomous-activity-execution**: Overall pattern specification
- **try-create-retry**: Template selector recovery pattern
- **goal-inference**: LLM + rule-based goal inference system
