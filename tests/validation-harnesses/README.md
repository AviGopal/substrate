# Validation Harnesses

This directory contains validation harnesses for testing specification enforcement without requiring LLM interaction.

## Impulse Token Budget Management Harness

**Purpose:** Validates that the impulse token budget management system correctly:
- Enforces the 85% utilization threshold
- Filters low-priority impulses by usageStats (loadCount<2 AND lastAccessed>1hr)
- Recalculates utilization after unloading
- Triggers manage-session-memory activity when utilization remains >85%
- Displays color-coded utilization (Green/Yellow/Red)

### Files

- `impulse-token-budget-management-harness.ts` - Core validation logic
- `impulse-token-budget-management-runner.ts` - Test runner that executes all cases

### Test Cases

#### Case 1: Drop Below Threshold (87% → 67%)
- **Setup:** 15K total budget, 13K used (87%)
- **Impulses:** 3 low-priority (loadCount=1, 2hr old), 5 high-priority (loadCount=5, 5min old)
- **Expected:** Unload 3 low-priority (3000 tokens), drop to 67% (Yellow), no activity

#### Case 2: Remain Above Threshold (95% → 90%)
- **Setup:** 10K total budget, 9.5K used (95%)
- **Impulses:** 1 low-priority (500 tokens), 9 high-priority (9000 tokens)
- **Expected:** Unload 1 low-priority (500 tokens), still at 90% (Red), trigger activity

#### Case 3: High LoadCount Preserved
- **Setup:** 10K total budget, 8.8K used (88%)
- **Impulses:** 1 low-priority with loadCount=5 (preserve), 1 low-priority with loadCount=1 (unload)
- **Expected:** Unload only 1 impulse (1000 tokens), drop to 78% (Yellow)

#### Case 4: Recent Access Preserved
- **Setup:** 10K total budget, 8.8K used (88%)
- **Impulses:** 1 low-priority accessed 30min ago (preserve), 1 low-priority accessed 2hr ago (unload)
- **Expected:** Unload only 1 impulse (1000 tokens), drop to 78% (Yellow)

### Running Tests

```bash
# From project root
cd tests/validation-harnesses

# Run validation harness
bun run impulse-token-budget-management-runner.ts
```

### Integration with Specification

This harness validates the implementation against the specification extracted from:
- `TUI_SESSION_STATE_ENDPOINT.md`
- `EXTRACTED_RULES_ACTIVITY_IMPULSE_LEARNING_SYSTEM.md`

The harness ensures:
- ✅ Continuous budget tracking (totalBudget, usedTokens, utilization)
- ✅ 85% threshold enforcement (not 80%)
- ✅ UsageStats filtering (loadCount<2 AND lastAccessed>1hr)
- ✅ Recalculation after unload
- ✅ Activity trigger when still >85%
- ✅ Color-coded display (Green/Yellow/Red)
