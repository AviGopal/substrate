# Validation Harness: activity-lifecycle-tools-automation

## Overview

This validation harness verifies that the activity template lifecycle automation is correctly implemented. It tests 5 critical aspects of the system without requiring full end-to-end activity execution.

**Specification**: OpenCode must automatically use MCP tools for activity template lifecycle management (create, evolve, debug) and boredom system configuration.

**Status**: ✅ Ready for execution

---

## Test Cases

### Test 1: Template Auto-Registration Config
**Type**: Config Verification  
**Impulse**: `validation-activity-lifecycle-tools-automation-case-1`

**What it tests**:
- Verifies `config.metabob.template_auto_registration` exists
- Checks default values (enabled: true, strategy: "on-create")

**Expected outcome**: Config section exists with correct defaults

**Why it matters**: Auto-registration was already working before this activity, but we verify it's still intact.

---

### Test 2: Lifecycle Automation Config (CRITICAL)
**Type**: Config Verification  
**Impulse**: `validation-activity-lifecycle-tools-automation-case-2`

**What it tests**:
- Verifies `config.metabob.template_lifecycle_automation` exists
- Checks for all required fields:
  - `enabled`
  - `auto_debug_on_failure`
  - `auto_evolve_on_staleness`
  - `failure_threshold_count`
  - `staleness_threshold_days`
  - `max_evolution_frequency_hours`

**Expected outcome**: New config section exists with all 6 fields

**Why it matters**: This is the P1 change we made - config schema for lifecycle automation. If this fails, users can't control lifecycle behavior.

---

### Test 3: Boredom Template Mapping (CRITICAL)
**Type**: Logic Verification  
**Impulse**: `validation-activity-lifecycle-tools-automation-case-3`

**What it tests**:
- Verifies the expected mapping logic:
  - `'improve-template'` → `'evolve-activity-self-contained'`
  - `'debug-failures'` → `'debug-activity-self-contained'`
  - `'optimize-performance'` → `'optimize-activity-self-contained'`

**Expected outcome**: Mapping matches expected values

**Why it matters**: This is the P0 CRITICAL fix. Previously, boredom system executed stale templates directly (broken). Now it maps to meta-templates. If this fails, self-improvement loop is broken.

---

### Test 4: Bootstrap Meta-Templates Exist (CRITICAL)
**Type**: Resource Verification  
**Impulse**: `validation-activity-lifecycle-tools-automation-case-4`

**What it tests**:
- Verifies `evolve-activity-self-contained` template exists in TemplateRepository
- Verifies `debug-activity-self-contained` template exists in TemplateRepository

**Expected outcome**: Both meta-templates are available

**Why it matters**: Without these templates, the lifecycle automation can't function. They're bootstrap templates (embedded in code) but we verify they're loaded.

---

### Test 5: MCP Abstraction Compliance
**Type**: Static Analysis  
**Impulse**: `validation-activity-lifecycle-tools-automation-case-5`

**What it tests**:
- Verifies MCP tools are used (static check):
  - `metabob_register_activity_template`
  - `metabob_fetch_boredom_activities`
  - `activity_error_inspector`
- Verifies no direct HTTP calls (code inspection)

**Expected outcome**: All MCP tools used, no direct HTTP

**Why it matters**: Architectural compliance - all lifecycle operations must use MCP abstraction, not direct HTTP to RPC API.

---

## Execution

### Prerequisites
1. OpenCode initialized with default config
2. TemplateLibrary.initialize() called (loads bootstrap templates)
3. Config includes `template_lifecycle_automation` section

### Run the harness

**Option 1: CLI**
```bash
cd repos/metabob-opencode/packages/opencode
bun tests/validation-harnesses/activity-lifecycle-tools-automation-harness.ts
```

**Option 2: Programmatic**
```typescript
import { runValidation } from './tests/validation-harnesses/activity-lifecycle-tools-automation-harness'

const result = await runValidation()
console.log(result.pass ? "✅ PASS" : "❌ FAIL")
console.log("Passed:", result.summary.passed, "/ Failed:", result.summary.failed)
```

---

## Interpreting Results

### ✅ PASS (Expected)
```
=== Validation Results ===
Total: 5
Passed: 5
Failed: 0

✅ PASS: Template Auto-Registration Config
✅ PASS: Lifecycle Automation Config
✅ PASS: Boredom Template Mapping
✅ PASS: Bootstrap Meta-Templates Exist
✅ PASS: MCP Abstraction Compliance
```

**Meaning**: All lifecycle automation infrastructure is correctly implemented.

---

### ❌ FAIL: Test 2 (Lifecycle Automation Config)
```
❌ FAIL: Lifecycle Automation Config
  Expected: { hasLifecycleAutomation: true, hasAutoDebugField: true, ... }
  Actual: { hasLifecycleAutomation: false, ... }
```

**Meaning**: Config schema not added or incorrect. Check `repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts:171-192`

**Fix**: Verify the `template_lifecycle_automation` config section was added with all 6 fields.

---

### ❌ FAIL: Test 3 (Boredom Template Mapping)
```
❌ FAIL: Boredom Template Mapping
  Expected: { improveTemplate: "evolve-activity-self-contained", ... }
  Actual: { improveTemplate: "wrong-template", ... }
```

**Meaning**: Template mapping is incorrect or not implemented. Check `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:265-269`

**Fix**: Verify the template mapping logic in `executeBoredomActivity()` function.

---

### ❌ FAIL: Test 4 (Bootstrap Meta-Templates)
```
❌ FAIL: Bootstrap Meta-Templates Exist
  Expected: { evolveTemplateExists: true, debugTemplateExists: true }
  Actual: { evolveTemplateExists: false, debugTemplateExists: false }
```

**Meaning**: Meta-templates not loaded or missing.

**Fix**: 
1. Verify `evolve-activity-self-contained.json` and `debug-activity-self-contained.json` exist
2. Verify `TemplateLibrary.initialize()` was called
3. Check template loading in `activity-template.ts`

---

## Validation Strategy

### Approach
**Static and configuration-based validation**

This harness focuses on verifying the infrastructure is in place:
- Config schema exists with correct fields
- Template mapping logic is correct (static check)
- Bootstrap templates are available
- MCP abstraction is maintained (code inspection)

### Why Not End-to-End?
Full end-to-end testing would require:
- Running actual activities (expensive, slow)
- Triggering real failures (requires broken templates)
- Waiting for boredom idle detection (5 minutes)
- Intercepting HTTP calls (complex setup)

Instead, we verify the **infrastructure** is correct. If infrastructure is correct, the system will work when triggered in production.

---

## Limitations

1. **Does not test actual activity execution and failure**
   - Workaround: Manual testing with a failing template
   - Future: Add integration test with mock activity

2. **Does not test boredom system activation**
   - Workaround: Manual testing with 5min idle wait
   - Future: Add mock BoredomManager with reduced idle time

3. **Does not test actual debug-activity triggering**
   - Workaround: Manual testing with repeated failures
   - Future: Add integration test that forces activity failure

4. **Does not intercept HTTP calls**
   - Workaround: Code inspection (verified manually)
   - Future: Add network monitoring in test environment

---

## Future Enhancements

### Enhancement 1: Integration Test for Auto-Debug
```typescript
async function testAutoDebugIntegration() {
  // 1. Create template with intentional failure
  // 2. Execute template 3 times → fails each time
  // 3. Verify debug-activity-self-contained was auto-triggered
  // 4. Verify EXECUTION_ANALYSIS.md created
  // 5. Verify FIX_RECOMMENDATIONS.md created
}
```

### Enhancement 2: Integration Test for Boredom Evolution
```typescript
async function testBoredomEvolutionIntegration() {
  // 1. Create template with low success rate
  // 2. Execute template 5 times to establish metrics
  // 3. Mock metabob_fetch_boredom_activities to return improve-template
  // 4. Trigger boredom check
  // 5. Verify evolve-activity-self-contained was executed
  // 6. Verify new template version created and registered
}
```

### Enhancement 3: Network Monitoring
```typescript
async function testNoDirectHTTPCalls() {
  // 1. Install HTTP interceptor
  // 2. Execute lifecycle operations
  // 3. Verify no calls to RPC API directly
  // 4. Verify all calls go through MCP tools
}
```

---

## Impulses Created

### Test Case Impulses
1. `validation-activity-lifecycle-tools-automation-case-1` (500 tokens)
2. `validation-activity-lifecycle-tools-automation-case-2` (500 tokens)
3. `validation-activity-lifecycle-tools-automation-case-3` (500 tokens)
4. `validation-activity-lifecycle-tools-automation-case-4` (500 tokens)
5. `validation-activity-lifecycle-tools-automation-case-5` (500 tokens)

### Harness Impulse
- `harness-activity-lifecycle-tools-automation` (2000 tokens)
- Type: file
- Points to: `tests/validation-harnesses/activity-lifecycle-tools-automation-harness.ts`

---

## Success Criteria

### All Tests Pass
✅ Config schema for lifecycle automation exists  
✅ Template mapping logic is correct  
✅ Bootstrap meta-templates are available  
✅ MCP abstraction is maintained  
✅ Infrastructure is ready for production use

### Production Readiness
Once this harness passes:
1. Boredom system will correctly improve stale templates
2. Failed activities will be automatically analyzed
3. All lifecycle operations use MCP (not direct HTTP)
4. Users can control lifecycle behavior via config

---

## Related Specifications

- `boredom-activity-detection-mechanism`
- `dynamic-activity-creation-devbob-execution-tracking`
- `template-storage-architecture`
- `metabob-cli-mcp-backend-communication`

---

**Created**: 2026-03-04  
**Status**: ✅ Ready for execution  
**Specification**: activity-lifecycle-tools-automation
