# File-Based Debug Logging Ready

**Date**: February 12, 2026 19:42 UTC  
**Status**: Debug logging writes to file - no TUI interference

---

## Problem Solved

Since console.error interferes with the TUI, debug logs now write to:

**`/home/avi/documents/work/exp-repo/metabob-devbob/activity-debug.log`**

---

## Test Procedure

### Step 1: Restart OpenCode
```bash
# Stop current OpenCode
# Restart: cd repos/metabob-opencode && bun run dev ../..
```

### Step 2: Run Activity Test
From this OpenCode session:
```javascript
activity({
  activityId: "infrastructure-51aee5c8",
  variables: {name: "File Debug Test"},
  reason: "Testing with file-based debug logging"
})
```

### Step 3: Read Debug Log
The activity will fail, but the log file will capture everything:
```bash
cat activity-debug.log
```

---

## What the Log Will Show

### Example Output (Normal Flow)
```
[2026-02-12T19:42:00.000Z] TEMPLATE-LOADER: load() called for id="infrastructure-51aee5c8", sessionID="..."
[2026-02-12T19:42:00.100Z] OPENCODE: Calling MCP tool "get_activity_template" for activity_id="infrastructure-51aee5c8"
MCP tool returned: {"status":"success","template":{...
```

### Example Output (Bug - Save Being Called)
```
[2026-02-12T19:42:00.000Z] TEMPLATE-LOADER: load() called for id="infrastructure-51aee5c8", sessionID="..."
[2026-02-12T19:42:00.100Z] TEMPLATE-LOADER: save() called for template="..." (...)
CALL STACK:
Error
    at save (template-loader.ts:617)
    at ??? (← THIS SHOWS WHO CALLED SAVE!)
    at ???
[2026-02-12T19:42:00.200Z] OPENCODE: Calling MCP tool "create_activity_template" for template="..."
CALL STACK:
Error
    at createActivityTemplate (metabob.ts:1105)
    at save (template-loader.ts:631)
    at ??? (← COMPLETE CALL PATH)
```

---

## Files Modified

All debug logs write to `activity-debug.log`:

1. **`repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`**
   - Line ~244: Logs when `load()` is called
   - Line ~617: Logs when `save()` is called + stack trace

2. **`repos/metabob-opencode/packages/opencode/src/util/metabob.ts`**
   - Line ~940: Logs when `getActivityTemplate()` is called
   - Line ~1105: Logs when `createActivityTemplate()` is called + stack trace

---

## Benefits

✅ No TUI interference - logs go to file  
✅ Complete stack traces captured  
✅ Easy to read after execution  
✅ Shows exact call path  

---

## Next Step

1. Restart OpenCode
2. Run activity test
3. Read `activity-debug.log`
4. Stack trace will reveal the root cause

---

**Status**: 🟢 READY TO CAPTURE CLEAN DEBUG OUTPUT
