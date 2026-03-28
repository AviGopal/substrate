# Validation Harnesses

This directory contains validation harnesses for testing specification implementations.

## minibob-trailblazing-activity-system

**Harness**: `minibob-trailblazing-activity-system-harness.ts`

**Purpose**: Validates that MiniBob implements the activity-first constraint and autonomous trailblazing system.

### What It Tests

1. **Autonomous Trailblazing Module** exists and exports required functions:
   - `generateNextTask()` - Agent autonomous task generation
   - `reflect()` - Agent reflection (goalAchieved | isStuck | shouldContinue)
   - `TrailblazeSession` - Session recording schema
   - `generateTemplateFromSession()` - Template extraction from traces

2. **MiniBob System Prompt** enforces activity-first constraint:
   - Guides agent to use activities for non-trivial tasks
   - Allows direct tools only for trivial tasks
   - Instructs to search before creating

3. **MiniBob Tools** include activity management:
   - `search_activities` tool definition and handler
   - `create_activity_goal_seeking` tool definition and handler
   - Callback types in `ToolHandlerOptions`

4. **Architectural Components** are in place:
   - Autonomous Task Generator
   - Agent Reflection System
   - Trailblazing Session Recorder
   - Template Generator from Session

### Running the Harness

```bash
# Run all validations
bun tests/validation-harnesses/minibob-trailblazing-activity-system-harness.ts

# Run with specific test case
bun tests/validation-harnesses/minibob-trailblazing-activity-system-harness.ts validation-minibob-trailblazing-activity-system-case-1
```

### Test Cases

1. **Case 1**: Non-trivial task (analyze test coverage)
   - Expected: search_activities → create_activity_goal_seeking
   
2. **Case 2**: Trivial task (read package.json)
   - Expected: direct read tool

3. **Case 3**: Non-trivial task (fix TypeScript errors)
   - Expected: search_activities → create_activity_goal_seeking

4. **Case 4**: Trivial task (git status)
   - Expected: direct bash tool

5. **Case 5**: Non-trivial task (add authentication)
   - Expected: search_activities → create_activity_goal_seeking

### Expected Output

```
✅ VALIDATION PASSED
```

Or with failures:

```
❌ VALIDATION FAILED (N error(s))

❌ Errors:
   - <error description>
   
⚠️  Warnings:
   - <warning description>
```

### Exit Codes

- `0` - All validations passed
- `1` - One or more validations failed

### Integration Notes

This harness validates the **infrastructure** is in place. Full end-to-end testing requires:

1. MiniBob integration with OpenCode/MCP backend
2. Callback implementations for `onSearchActivities` and `onCreateActivity`
3. Autonomous execution loop wired to trailblazing-executor.ts
4. Template registration pipeline connected to SurrealDB

The harness includes mock validation for tool usage patterns until full integration is complete.
