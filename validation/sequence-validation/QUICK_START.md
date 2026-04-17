# Quick Start: Activity-Based Sequence Validation

## What This Is

A validation suite that executes **real activities through MiniBob's ActivityExecutor** to validate that the system works as documented in `/docs/architecture/sequences/`.

## Quick Run

```bash
cd validation/sequence-validation

# Run all validation activities
bun run-activity-tests.ts

# Run specific activity
bun run-activity-tests.ts --activity 05-validate-hooks

# Execute single activity directly
bun execute-with-minibob.ts activities/05-validate-hooks.json
```

## What You'll See

### All Activities (5 total)

```
🧪 MiniBob Sequence Validation (Activity-Based)

Backend: https://activity.metabob.com
Mode: Activity Execution (Real Resolvers)

📋 Executing 01-validate-activity-selection...
  Activity: Validate Activity Selection Sequence
  Tasks: 5
  Resolvers: goal_analysis, impulse_state_analysis, activity_recommendation, llm, bash
  🔄 Executing through MiniBob ActivityExecutor...
  ✓ LLM resolver enabled (model: claude-sonnet-4-20250514)

[Activity executes tasks...]

============================================================
📊 Validation Summary
============================================================

Total Activities: 5
  ✅ Executed: 5 (100%)
  ⏱️  Duration: 749ms
```

## Understanding the Output

### ✅ What's Working

1. **MiniBob Integration** - ActivityExecutor loads and executes
2. **Activity Execution** - All activities execute successfully
3. **Resolver Dispatch** - Checks for registered resolvers, falls back to LLM

### ⚠️ Expected Failures

Validation failures indicate **missing resolver implementations**:

```
❌ Expected resolver not exercised: goal_analysis
❌ Expected resolver not exercised: impulse_state_analysis
```

**This is correct validation!** Shows exactly which resolvers need implementation.

## Prerequisites

Create `~/.metabob/config.json`:
```json
{
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

## References

- **Foundation:** `/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **Sequences:** `/docs/architecture/sequences/`
- **Details:** `EXECUTION_REPORT.md`
