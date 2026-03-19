# Validation Test Case 1: Complex Refactoring Task

## Input

**User Prompt**: "Refactor the authentication system in src/auth.ts, add proper error handling, update tests, and ensure all edge cases are covered"

**Session Context**:
- Recent files: `["src/auth.ts", "tests/auth.test.ts"]`
- Priority issues: 2 HIGH severity issues

## Expected Output

**Enforcement Triggered**: `true`  
**Requires Activity**: `true`  
**Estimated Tool Calls**: `20`  
**Allowed Tools Restricted**: `true`

**Reasoning**: Complex refactoring task with multiple files and HIGH priority issues exceeds 8-tool threshold

## Calculation Breakdown

- Base: 2 (read + execute)
- Files: 2 files × 2 tools = 4
- HIGH issues: 2 issues × 3 tools = 6
- Refactor keyword: +5
- Test keyword: +3

**Total**: 2 + 4 + 6 + 5 + 3 = **20 tools** (>8 threshold, enforcement triggered)
