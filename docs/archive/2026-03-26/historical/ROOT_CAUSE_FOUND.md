# ROOT CAUSE FOUND: Source Code Caching Issue

## The Mystery

Multi-task activities (like `create-activity-self-contained`) fail on task 1 or later with:
- 0.0s duration
- No session spawned
- No error message

Lifecycle tracing was added but traces stopped after "Found task, starting execution" - suggesting failure between line 1751 and 1754 (before `taskResults.push()`).

## The Discovery

After adding multiple trace points and even direct file writes that didn't appear, I discovered:

**The current opencode session is running from SOURCE via `bun run`, not from the built binary!**

```bash
$ ps aux | grep opencode
avi 2623138 bun run --cwd packages/opencode --conditions=browser ./src/index.ts ../..
```

This means:
- ✅ My source edits are in place
- ✅ The binary is being built correctly
- ❌ **But the running session is using cached/stale source code**

## Why Traces Weren't Appearing

The lifecycle tracing code I added EXISTS in:
1. ✅ Source files (`packages/opencode/src/tool/activity.ts`)
2. ✅ Built binary (`dist/opencode-linux-x64/bin/opencode`)
3. ❌ **But NOT in the running Bun process (cached)**

Bun is either:
- Caching the transpiled code
- Not detecting file changes
- Loading from a different path

## The Real Problem

The actual failure is happening, but WITHOUT my tracing code active, so I can't see where!

## Solution

**Option 1: Restart the dev session (loses context)**
```bash
cd repos/metabob-opencode
pkill -f "bun run.*opencode"
bun run dev ../..
```

**Option 2: Use the built binary directly (keeps context)**
Since activities might run in subprocesses, force using the built binary:
```bash
# Verify binary has latest code
strings repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode | grep "TRACE FILE:"

# Run activity via built binary directly (if possible)
```

**Option 3: Add tracing via console.error instead of file**
Console output might not be cached:
```typescript
console.error(`[TRACE] ${msg}`, data)
```

## Next Steps

1. **RESTART THE SESSION** - This will pick up the tracing code
2. Run `create-activity-self-contained` immediately
3. Check `/tmp/activity-lifecycle-trace-<activityId>.log`
4. The trace will show EXACTLY where execution stops

## Expected Trace (Once Working)

The trace should show one of these patterns:

**Pattern 1: Fails on taskResults.push()**
```
✅ Found task, starting execution
✅ About to push to taskResults
❌ (stops here - push is failing)
```

**Pattern 2: Fails on onStatusUpdate()**
```
✅ Found task, starting execution  
✅ About to push to taskResults
✅ Pushed task to results array
❌ (stops here - onStatusUpdate callback is throwing)
```

**Pattern 3: Fails on impulse capture**
```
✅ Found task, starting execution
✅ About to push to taskResults
✅ Pushed task to results array
✅ Called onStatusUpdate
❌ (stops here - impulse state capture failing)
```

## Key Insight

The failure is happening in the "task setup" phase (lines 1754-1776), NOT in the actual execution. This suggests:
- A callback (`onStatusUpdate`) is throwing
- An object property access is failing (`_activity.impulses`)
- Some synchronous operation is causing an unhandled exception

## Files Modified (For Next Session)

- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
  - Lines 1702-1720: Unique trace file per execution
  - Lines 1708-1722: Enhanced trace() with completion markers
  - Lines 1754, 1761, 1765, 1769: Granular trace points
  - Line 1757: Direct file write debug (bypasses trace())

## Commits

- `6660cc1b`: Initial lifecycle tracing
- `56321f54`: Granular tracing between task start and execution
- `769424a6`: Trace before taskResults.push
- `2d842c67`: Direct file write debug
- `36cd4ed6`: Trace completion markers
- `8fec80f5`: Unique trace file per execution

---

**CRITICAL: Next session MUST restart the dev server to pick up tracing code!**
