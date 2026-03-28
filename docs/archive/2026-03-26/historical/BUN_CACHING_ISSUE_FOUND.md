# Bun Caching Issue: Source Changes Not Being Picked Up

## The Problem

After restarting the session and adding lifecycle tracing, we discovered that **source code changes are NOT being picked up by the running bun process**.

### Evidence

1. **Tracing works initially**: First trace after restart showed traces up to "Entering standard execution path"
2. **New traces don't appear**: Added multiple debug writes before/after this trace - NONE appear
3. **Source file confirmed**: Verified edits exist in `packages/opencode/src/tool/activity.ts` at lines 1970, 1972
4. **Hardcoded paths don't work**: Even using `/tmp/debug-immediate.log` instead of `traceFile` variable - file never created
5. **All trace files identical**: All recent executions show same 1335 bytes, same content, stopping at same line

### What This Means

The bun process (PID 2643989) is running with a **cached/transpiled version** of the code from BEFORE our edits. New edits to the source are not being reloaded.

### Where Execution Stops

```
✅ Checked trailblazing status
✅ Entering standard execution path (no trailblazing)  ← LAST TRACE
❌ [IMMEDIATE] Entered else block  ← NEVER APPEARS (line 1970)
❌ [IMMEDIATE] Trace call completed  ← NEVER APPEARS (line 1972)
```

The trace at line 1971 executes and writes successfully. But lines 1970 and 1972 (direct file writes with hardcoded paths) do NOT execute.

## Hypothesis

**Bun is serving a cached transpiled version from memory/disk that doesn't include our latest edits.**

The process started at 03:10, and we've been making edits since then. Bun's hot reload might not be working correctly, or there's a transpilation cache that isn't being invalidated.

## Solution

**MUST restart the bun dev server:**

```bash
# Kill current bun process
pkill -f "bun run --cwd packages/opencode"

# Restart dev server
cd repos/metabob-opencode
bun run dev ../..
```

This will:
1. Clear any in-memory cached code
2. Re-transpile from latest source
3. Pick up all our debug writes and traces

## Expected After Restart

Once restarted with latest code, the trace should show:

```
✅ Entering standard execution path
✅ [IMMEDIATE] Entered else block for gather-requirements  ← WILL APPEAR
✅ [IMMEDIATE] Trace call completed for gather-requirements  ← WILL APPEAR
```

This will tell us if:
- Line 1970 executes (entered else block)
- Line 1971 (trace call) completes
- Line 1972 executes (after trace)

If line 1970 doesn't appear, execution never enters the else block (impossible - we see the trace from inside it).

If lines 1970 and 1971 appear but not 1972, the trace() call itself is causing a fatal error.

## Current State

**Commits with debug code:**
- `5a6b7315`: Immediate file write when entering else block
- `8bb75b52`: Immediate writes before and after trace call
- `e87db00b`: Hardcoded path for debug writes

**All above commits are in source but NOT being executed by running process.**

## Next Session

**IMMEDIATELY restart bun dev server, then test again!**

The mystery should be solved within seconds of restarting.
