# Validation Harness: activity-first-tui-session-interactions

## Purpose

Validates that TUI sessions correctly route complex tasks through the activity system based on estimated tool call complexity.

## Harness File

**Location**: `tests/validation-harnesses/activity-first-tui-session-interactions-harness.ts`

## Test Strategy

The harness tests the **complexity assessment** and **enforcement gate** logic that determines when TUI sessions should use the activity system:

1. **Mock complexity assessment** - Mirrors the logic in `recommendation-engine.ts`
2. **Calculate estimated tool calls** - Base (2) + files (2 each) + HIGH issues (3 each) + task type modifiers
3. **Apply enforcement threshold** - Enforcement triggers when estimated tools > 8
4. **Validate tool restriction** - When enforced, only activity+core tools should be allowed

## Test Cases

### Case 1: Complex Refactoring Task
- **Input**: Refactor auth system with multiple files and HIGH issues
- **Expected**: Enforcement triggered (20 tools estimated)
- **Validates**: Complex multi-file refactoring routes through activities

### Case 2: Simple Read Operation
- **Input**: Read package.json
- **Expected**: No enforcement (2 tools estimated)
- **Validates**: Trivial operations execute directly

### Case 3: Multiple File Type Fixes
- **Input**: Fix type errors in 3 files
- **Expected**: No enforcement (8 tools estimated, threshold is >8)
- **Validates**: Exactly at threshold does NOT trigger enforcement

### Case 4: Comprehensive Test Coverage
- **Input**: Add test coverage for single class
- **Expected**: No enforcement (7 tools estimated)
- **Validates**: Single-file test tasks below threshold execute directly

### Case 5: Trivial Git Command
- **Input**: Show git status
- **Expected**: No enforcement (2 tools estimated)
- **Validates**: Simple commands execute directly

## Complexity Assessment Logic

```typescript
function assessComplexity(userPrompt, sessionContext) {
  let toolCalls = 2 // Base: read + execute
  
  // Add per file
  toolCalls += files.length * 2 // read + edit
  
  // Add per HIGH severity issue
  toolCalls += highIssues.length * 3 // analyze + fix + verify
  
  // Add for task type
  if (includes("refactor")) toolCalls += 5
  if (includes("test")) toolCalls += 3
  
  return {
    estimatedToolCalls: toolCalls,
    requiresActivity: toolCalls > 8
  }
}
```

## Running the Harness

```bash
# Run all test cases
bun tests/validation-harnesses/activity-first-tui-session-interactions-harness.ts

# Expected output
✅ validation-activity-first-tui-session-interactions-case-1
✅ validation-activity-first-tui-session-interactions-case-2
✅ validation-activity-first-tui-session-interactions-case-3
✅ validation-activity-first-tui-session-interactions-case-4
✅ validation-activity-first-tui-session-interactions-case-5

📊 Results: 5 passed, 0 failed

✅ VALIDATION PASSED
```

## Exit Codes

- `0` - All validations passed
- `1` - One or more validations failed

## Integration Notes

This harness validates the **complexity assessment logic** in isolation. Full end-to-end testing requires:

1. TUI integration with SessionPrompt.prompt()
2. Actual enforcement gate application
3. Tool registry filtering
4. LLM API calls with restricted tools
5. Activity execution pathway

The harness provides **fast, deterministic validation** of the core enforcement logic without requiring full TUI/LLM integration.

## Impulse Metadata

- **Impulse ID**: harness-activity-first-tui-session-interactions
- **Type**: file
- **File Path**: tests/validation-harnesses/activity-first-tui-session-interactions-harness.ts
- **Budget**: 2000 tokens
- **Test Cases**: 5 validation cases
- **Related Impulses**:
  - trace-activity-first-tui-session-interactions (trace analysis)
  - enforcement-activity-first-tui-session-interactions (enforcement summary)
  - validation-activity-first-tui-session-interactions-case-1 through case-5 (test cases)
