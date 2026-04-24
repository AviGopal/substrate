# Nested Activity Logging and Ask Tool Validation Improvements

## Summary

Implemented two key improvements to MiniBob:

1. **Nested Activity Logging**: Clear visual distinction for nested activity execution with proper indentation and depth indicators
2. **Ask Tool Validation**: Robust input validation that re-prompts on invalid input and supports case-insensitive option matching

## Changes Made

### 1. Enhanced Output Formatting (src/output.ts)

#### Added Nesting Depth Parameter to Formatting Functions

**`formatActivityStart()`**
- Added optional `nestingDepth` parameter (default: 0)
- Nested activities show `[Nested Activity - Depth N]` prefix
- All lines indented by 2 spaces per nesting level

**`formatTaskProgress()`**
- Added optional `nestingDepth` parameter
- Task progress indented based on nesting depth

**`formatActivityComplete()`**
- Added optional `nestingDepth` parameter
- Completion summary shows `[Nested - Depth N]` prefix
- All lines indented consistently

**`formatToolCall()`**
- Added optional `nestingDepth` parameter
- Tool calls indented to match their activity's depth

#### Example Output

**Top-level activity:**
```
======================================================================
Activity: fix-bug-complete
Reason: User requested
======================================================================

[Task 1/3] Analyze the bug
  [OK] Tool: read({"path": "src/bug.ts"})
  [OK] Tool: bash({"command": "git diff"})
[OK] Analyze the bug (2.3s)

======================================================================
[OK] Activity completed
Duration: 12.5s
Cost: $0.0023
Tokens: 1,234 in / 567 out
======================================================================
```

**Nested activity (depth 1):**
```
  ======================================================================
  [Nested Activity - Depth 1] Activity: read-file-helper
  Reason: Required by parent task
  ======================================================================

  [Task 1/1] Read file contents
    [OK] Tool: read({"path": "src/helper.ts"})
  [OK] Read file contents (0.5s)

  ======================================================================
  [OK] [Nested - Depth 1] Activity completed
  Duration: 1.2s
  Cost: $0.0001
  Tokens: 234 in / 45 out
  ======================================================================
```

### 2. Updated Activity Executor (src/activity.ts)

**Three key changes:**

1. Calculate nesting depth from activity call stack:
   ```typescript
   const nestingDepth = (this.config.activityCallStack || []).length;
   ```

2. Pass nesting depth to `formatActivityStart()`:
   ```typescript
   console.log(
     formatActivityStart(template.id, template.name, reason, nestingDepth)
   );
   ```

3. Pass nesting depth to `formatTaskProgress()` and `formatActivityComplete()`:
   ```typescript
   formatTaskProgress(task.id, task.description, i + 1, sortedTasks.length, nestingDepth)
   formatActivityComplete(status, duration, cost, tokensIn, tokensOut, error, nestingDepth)
   ```

### 3. Enhanced Ask Tool Validation (src/input.ts)

**Improvements:**

1. **Re-prompting on invalid input** - Instead of using default:
   ```typescript
   // Invalid input -> prompt again
   console.log(
     `Invalid input. Please enter a number (1-${options.length}) or press Enter for default.`
   );
   if (rl) {
     rl.question("> ", handleInput);
   }
   ```

2. **Case-insensitive option matching** - Users can type option text:
   ```typescript
   const matchedOption = options.find(
     (opt) => opt.toLowerCase() === trimmed.toLowerCase()
   );
   if (matchedOption) {
     resolve({ response: matchedOption, timedOut: false, aborted: false });
     return;
   }
   ```

3. **Refactored for cleaner logic** - Extracted input handling into `handleInput()` function for reusability

#### Example Ask Tool Interaction

**Before (old behavior):**
```
❓ Which approach should we use?
  1. Fix with minimal changes
  2. Full refactor
  3. Add workaround

Enter number (1-3) or press Enter for default:
> abc
(invalid input, using default)
Selected: Fix with minimal changes
```

**After (new behavior):**
```
❓ Which approach should we use?
  1. Fix with minimal changes
  2. Full refactor
  3. Add workaround

Enter number (1-3) or press Enter for default:
> abc
Invalid input. Please enter a number (1-3) or press Enter for default.
> 2
Selected: Full refactor
```

**Also supports typing option text:**
```
> full refactor
Selected: Full refactor

> FULL REFACTOR
Selected: Full refactor
```

## Benefits

### Nested Activity Logging
1. **Visual clarity** - Immediate understanding of activity hierarchy
2. **Debugging easier** - Can trace execution flow through nested calls
3. **Composition visible** - See which activities invoke others
4. **Performance tracking** - Cost/duration shown at each level

### Ask Tool Validation
1. **Prevents errors** - No more accidental defaults on typos
2. **Better UX** - Users get feedback and can correct mistakes
3. **More flexible** - Type option numbers OR option text
4. **Case-insensitive** - Don't need to match exact capitalization

## Testing

Type checking passes:
```bash
cd repos/minibob && bun run typecheck
# ✓ No type errors
```

## Architecture Alignment

These changes align with MiniBob's core principles:

1. **Transparency** - Nested activity execution is now visible
2. **Traceability** - Complete execution context preserved
3. **Composition** - Activities calling activities is first-class
4. **User experience** - Better validation reduces errors

## Future Enhancements

Possible follow-ups:

1. Add color coding based on nesting depth (optional feature)
2. Show parent activity name in nested activity header
3. Collapse/expand nested output in TUI mode
4. Add maximum nesting depth warnings
5. Track composition patterns for Thompson Sampling

## Related Files

- `src/output.ts` - Output formatting functions
- `src/activity.ts` - Activity execution logic
- `src/input.ts` - User input handling
- `src/types.ts` - Type definitions (ExecutorConfig.maxNestingDepth)
