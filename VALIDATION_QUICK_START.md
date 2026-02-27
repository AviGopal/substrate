# Vessel Self-Configuration - Validation Quick Start

## How to Validate the Condition

**Question**: "How do we validate that the vessel automatically configures itself?"

**Answer**: Run these 3 validation levels

---

## ⚡ Quick Commands

### Level 1: Static Analysis (30 seconds)
```bash
npx ts-node --esm tests/validation-harnesses/vessel-self-configuration-harness.ts
```
✅ **Current Status**: 10/10 tests passing

### Level 2: Runtime Integration (2-3 minutes)
```bash
./tests/integration/test-vessel-self-config-runtime.sh dev
```
🔄 **Status**: Script ready, needs to be run

### Level 3: Manual E2E (10-15 minutes)
See full guide: `VESSEL_SELF_CONFIG_VALIDATION_GUIDE.md`

---

## What Each Level Validates

| Level | What It Tests | Time | Automation |
|-------|--------------|------|------------|
| **Static** | Code exists, APIs complete | 30s | ✅ Fully automated |
| **Runtime** | Container starts, config created | 2-3min | ✅ Fully automated |
| **Manual E2E** | Full flow, updates, rollback | 10-15min | 📋 Human verification |

---

## Expected Results

### Level 1 Output:
```
✅ Test 1: Entrypoint Script Exists
✅ Test 2: Activity Template Exists
✅ Test 3: ConfigManager API Exists
✅ Test 4: VesselUpdateManager API Exists
✅ Test 5: BootstrapManager Exists
✅ Test 6: Dockerfile Configuration
✅ Test 7: CLI Debug Config Command
✅ Test 8: Activity Template Variables
✅ Test 9: Activity Task Dependencies
✅ Test 10: Component Integration

✅ ALL TESTS PASSED (10/10)
```

### Level 2 Output:
```
✅ Test 1: Container Build
✅ Test 2: Container Startup
✅ Test 3: Environment Detection
✅ Test 4: Backend Connectivity Validation
✅ Test 5: ANTHROPIC_API_KEY Validation
✅ Test 6: Activity Execution
✅ Test 7: ACP Server Startup
✅ Test 8: Config File Created
✅ Test 9: Config Has Backend URL
✅ Test 10: Config Has Token Budget
✅ Test 11: Config Backup Created
✅ Test 12: ConfigManager Tools Available
✅ Test 13: VesselUpdateManager Tools Available

✅ ALL TESTS PASSED (13/13)
```

---

## One-Command Full Validation
```bash
# Run both automated levels
npx ts-node --esm tests/validation-harnesses/vessel-self-configuration-harness.ts && \
./tests/integration/test-vessel-self-config-runtime.sh dev && \
echo "✅ ALL VALIDATION PASSED!"
```

---

## When to Run

- **Level 1**: Every code change (CI/CD)
- **Level 2**: Before every deployment  
- **Level 3**: Before major releases

---

## Files Created

1. `tests/validation-harnesses/vessel-self-configuration-harness.ts` - Static tests
2. `tests/integration/test-vessel-self-config-runtime.sh` - Runtime tests
3. `VESSEL_SELF_CONFIG_VALIDATION_GUIDE.md` - Comprehensive guide
4. `VALIDATION_QUICK_START.md` - This file

---

## Next Step

Run the runtime integration test:
```bash
./tests/integration/test-vessel-self-config-runtime.sh dev
```
