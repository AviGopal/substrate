# Bun Cache Issue - Activity Execution Debugging

## Problem Discovered

After restarting OpenCode with `bun run dev`, the enhanced logging (CHECKPOINT C, D, E) is **NOT executing**, even though the code is present in the source files.

## Root Cause

**Bun is using stale cached builds** instead of running the updated source code.

### Evidence

```bash
# Source code modified TODAY
activity.ts modified: 2026-02-15 18:46:12

# Bun cache is 13 DAYS OLD
.bun-build files: 2026-02-02 17:30
```

### What's Happening

1. Code changes committed to activity.ts (CHECKPOINT C, D, E added)
2. User ran `bun run dev` to restart OpenCode
3. Bun loaded from old .bun-build cache (Feb 2)
4. New code not executed
5. Execution still stops at CHECKPOINT B (old code)

## Solution

### Option 1: Clear Bun Cache (RECOMMENDED)

```bash
# Stop the bun run dev process (Ctrl+C)

# Clear bun build cache
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode
rm -f .*.bun-build

# Restart with dev
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun run dev ../..
```

### Option 2: Force Bun to Rebuild

```bash
# Stop the bun run dev process

# Clear bun's cache globally
bun pm cache rm

# Restart dev
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun run dev ../..
```

### Option 3: Use --no-cache Flag

```bash
# Stop current process

# Run with cache disabled
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun run --no-cache --conditions=browser ./packages/opencode/src/index.ts ../..
```

## After Restart

The enhanced logging should then work:

```bash
# Clear logs
rm -f activity-debug.log

# Test again (in OpenCode)
activity({
  activityId: "demo-315bfaf1",
  variables: {},
  reason: "Test after cache clear"
})

# Check for new checkpoints
cat activity-debug.log | grep CHECKPOINT
```

**Expected output**:
```
CHECKPOINT A
CHECKPOINT B
CHECKPOINT C    <-- New! Should appear now
CHECKPOINT D    <-- New! If TaskTool.init() succeeds
```

## What This Reveals

Once cache is cleared and code runs:

- **CHECKPOINT C appears**: Progress! TaskTool.init() is called
- **CHECKPOINT D appears**: TaskTool.init() succeeded, execute() called
- **CHECKPOINT E appears**: Task completed successfully!
- **CHECKPOINT ERROR appears**: Exception with stack trace
- **Still stops at B**: Something very wrong with code update

## Why This Matters

We've been debugging in circles because:
1. Previous session added timeout protection → not loaded (cache)
2. This session added enhanced logging → not loaded (cache)
3. Tests show old behavior → misleading diagnosis

**We need fresh code running to see actual behavior.**

---

**Action Required**: Clear bun cache and restart dev server
**ETA**: 2 minutes to clear cache and restart
**Next**: Test will show real checkpoint data
