# Validation Harnesses

This directory contains validation harnesses for testing specification enforcement without requiring LLM interaction.

## Overview

Each harness validates that implemented behavior matches specification requirements through:
- **Deterministic Tests**: Same input always produces same output
- **Mocked Dependencies**: No external systems required
- **Historical Test Cases**: Stored as impulses for reproducibility
- **Fast Validation**: Complete in < 1 second
- **Clear Failures**: Detailed error messages for debugging

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

---

## Session Memory TUI Data Flow Harness

**Purpose:** Validates that the complete data pipeline from SessionMemory storage through API endpoint to TUI display correctly transforms and displays session memory state.

**Validates:**
- ✅ Session.impulses() aggregation (impulseCount, totalBudget, usedTokens, utilization)
- ✅ SessionState.getImpulseState() enrichment (loadedCount, unloadedCount)
- ✅ Budget calculation correctness (totalBudget = sum of all budgets)
- ✅ Token usage calculation (usedTokens = sum of loaded impulse tokens)
- ✅ Utilization percentage formula ((usedTokens/totalBudget)*100 with div-by-zero protection)
- ✅ Loaded/unloaded count derivation and invariant (loadedCount + unloadedCount = impulseCount)
- ✅ TUI display formatting (impulses line, budget line, progress bar)
- ✅ Color threshold logic (green <60%, yellow 60-85%, red ≥85%)

### Files

- `session-memory-tui-data-flow-harness.ts` - Complete validation harness with 4 test cases

### Test Cases

#### Case 1: Balanced Load (60% utilization)
- **Setup:** 5 impulses (3 loaded with 100+200+300=600 tokens, 2 unloaded with 150+250=400 tokens)
- **Expected:** totalBudget=1000, usedTokens=600, utilization=60%, loadedCount=3, unloadedCount=2
- **Display:** "📦 Impulses: 5 (3 loaded)", "💾 Budget: 600 / 1000 (60%)", color=warning (yellow)

#### Case 2: Low Utilization (10%)
- **Setup:** 2 impulses (1 loaded with 100 tokens, 1 unloaded with 900 tokens)
- **Expected:** totalBudget=1000, usedTokens=100, utilization=10%, loadedCount=1, unloadedCount=1
- **Display:** "📦 Impulses: 2 (1 loaded)", "💾 Budget: 100 / 1000 (10%)", color=success (green)

#### Case 3: High Utilization (85%)
- **Setup:** 2 impulses (both loaded with 450+400=850 tokens)
- **Expected:** totalBudget=1000, usedTokens=850, utilization=85%, loadedCount=2, unloadedCount=0
- **Display:** "📦 Impulses: 2 (2 loaded)", "💾 Budget: 850 / 1000 (85%)", color=error (red)

#### Case 4: Zero Budget Edge Case
- **Setup:** 0 impulses
- **Expected:** totalBudget=0, usedTokens=0, utilization=0%, loadedCount=0, unloadedCount=0
- **Display:** "📦 Impulses: 0 (0 loaded)", "💾 Budget: 0 / 0 (0%)", color=success (green)

### Running Tests

```bash
# From project root
cd tests/validation-harnesses

# Run validation harness
npx ts-node session-memory-tui-data-flow-harness.ts
```

### Expected Output

```
✅ case-1-balanced-load: PASS
✅ case-2-low-utilization: PASS
✅ case-3-high-utilization: PASS
✅ case-4-zero-budget: PASS

📊 Results: 4 passed, 0 failed
```

### Integration with Specification

This harness validates the implementation against:
- `session-memory-tui-data-flow` specification
- Data flow: SessionMemory.store → Session.impulses() → SessionState.get() → GET /session/:id/state → TUI sidebar
- All transformation stages validated for correctness

The harness ensures accurate TUI display by catching calculation errors in aggregation, percentage computation, and formatting transformations.

---

## Metabob Failure Analysis Integration Harness

**Purpose:** Validates that activity failures trigger automatic Metabob code quality analysis and create structured failure-analysis impulses for the learning loop.

**Validates:**
- ✅ metabob_search_codebase_issues called with failed task description
- ✅ HIGH severity issues filtered correctly (excludes LOW/MEDIUM)
- ✅ Root cause hypothesis generated from issue patterns
- ✅ Failure analysis impulse structure correct (6 required fields)
- ✅ Suggested fixes extracted from Metabob suggestions
- ✅ Blast radius calculated from modified file count
- ✅ Rollback strategy generated based on changes
- ✅ Pattern hash computed for failure deduplication

### Files

- `metabob-failure-analysis-integration-harness.ts` - Core validation logic with 3 test cases

### Test Cases

#### Case 1: SQL Injection Vulnerability (HIGH Severity)
- **Setup:** Activity fails with tool_error, 2 files modified (database.ts, auth.ts)
- **Metabob Issues:** 2 HIGH severity security issues (SQL injection, plaintext password)
- **Expected:** Root cause mentions "security issues", 2 HIGH issues filtered, 2+ suggested fixes

#### Case 2: Validation Failure (HIGH + CRITICAL)
- **Setup:** Activity fails with validation error, 1 file modified (validation.ts)
- **Metabob Issues:** 1 HIGH null-safety, 1 CRITICAL logic error
- **Expected:** Root cause mentions "null-safety issues", 2 HIGH issues, impulse structure complete

#### Case 3: No HIGH Severity Issues
- **Setup:** Activity fails with timeout, 1 file modified (utils.ts)
- **Metabob Issues:** Only LOW and MEDIUM severity issues
- **Expected:** Analysis returns null (no impulse created), correct graceful degradation

### Running Tests

```bash
# From project root
cd tests/validation-harnesses

# Run validation harness (CLI mode)
bun run metabob-failure-analysis-integration-harness.ts

# Run with vitest (test framework)
bun test metabob-failure-analysis-integration-harness.ts
```

### Expected Output

```
=== Metabob Failure Analysis Integration Validation ===

Total: 3 | Passed: 3 | Failed: 0

✅ PASS - validation-metabob-failure-analysis-integration-case-1
  Details:
    - Metabob search called: true
    - HIGH severity filtered: true
    - Root cause generated: true
    - Impulse structure correct: true
    - Suggested fixes present: true

✅ PASS - validation-metabob-failure-analysis-integration-case-2
  Details:
    - Metabob search called: true
    - HIGH severity filtered: true
    - Root cause generated: true
    - Impulse structure correct: true
    - Suggested fixes present: true

✅ PASS - validation-metabob-failure-analysis-integration-case-3
  Details:
    - Metabob search called: true
    - HIGH severity filtered: true
    - Root cause generated: true
    - Impulse structure correct: false (expected - null analysis)
    - Suggested fixes present: false (expected - null analysis)
```

### Integration with Specification

This harness validates the implementation against:
- `HIGH_PRIORITY_SPECIFICATIONS_COMPLETE.md` - Need for root cause analysis
- Metabob MCP tool availability and integration patterns
- Activity failure analysis workflow in `activity-failure-analysis.ts`

The harness ensures the learning loop can understand WHY failures occur and prevent repeated failures from the same root causes.

---
