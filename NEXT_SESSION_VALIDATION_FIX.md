# Quick Start: Next Session (Validation Fix Testing)

## What Was Fixed This Session

✅ **Activity validation system** - Now actually validates instead of just logging warnings

## Files Modified

1. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
   - Lines 1356-1419: Validation now throws errors for missing files/patterns

2. Debug logging added (can remove later):
   - activity.ts lines 420-428
   - prompt.ts lines 922-925, 1169-1173

## Current Status

- ✅ Fix implemented
- ⏳ Dev server restart needed
- ⏳ Testing needed

## First Steps

### 1. Restart Dev Server (REQUIRED)
```bash
cd repos/metabob-opencode
pkill -f "bun run dev"
bun run dev ../..
```

Wait for: `INFO ... service=template-cache ... cleanup started`

### 2. Quick Test
```javascript
// In OpenCode session:
activity({
  templateId: "hello-world-minimal",
  variables: { testId: "validation-test", name: "ValidationTest" },
  reason: "Verify dev server reloaded with validation fix"
})
```

Should complete successfully and see console.error message in dev server output.

### 3. Test Validation Fix
```javascript
activity({
  templateId: "create-activity-self-contained",
  variables: { 
    templateId: "test-validation",
    templateName: "Test Validation Fix",
    category: "feature"
  },
  reason: "Test validation actually runs and validates content"
})
```

**Expected**: Task 1 should either:
- ✅ Complete successfully (if it creates file with all required patterns)
- ❌ Throw error with specific missing patterns (if content incomplete)

## If Validation Still Doesn't Work

### Check 1: Are changes loaded?
Look for console.error in dev server output:
```
!!!! ACTIVITY_TOOL_EXECUTE CALLED: template-id !!!!
```

If missing → code not reloaded → restart dev server again

### Check 2: Check trace logs
```bash
cat /tmp/activity-trace.log
cat /tmp/mcp-tool-filtering.log
```

If empty → ActivityTool.execute() not being called → investigate further

### Check 3: View validation logs
```bash
tail -100 ~/.local/share/opencode/log/dev.log | grep -i validation
```

Should see:
- "running legacy task validation"
- "required pattern not found" (if validation failing)
- "required file not found" (if file missing)

## Success Criteria

- [ ] Dev server restarted successfully
- [ ] hello-world-minimal completes with console.error visible
- [ ] create-activity-self-contained task 1 runs validation
- [ ] Validation either passes OR throws clear error message
- [ ] Error message shows specific missing pattern/file

## Next Steps After Validation Works

1. Remove debug logging (cleanup)
2. Test other templates using validation
3. Create utility activities:
   - manage-docker-compose
   - rebuild-containers
   - manage-dockerfiles
4. Commit fix with clear message

## Reference Documents

- `SESSION_COMPLETE_VALIDATION_FIX.md` - Full session summary
- `VALIDATION_FIX_SUMMARY.md` - Technical deep dive
- `test-validation-fix.sh` - Manual test script

## Quick Commands

```bash
# Restart dev server
cd repos/metabob-opencode && pkill -f "bun run dev" && bun run dev ../..

# Check dev server is running
ps aux | grep "bun run dev" | grep -v grep

# View recent logs
tail -100 ~/.local/share/opencode/log/dev.log

# Check trace logs
cat /tmp/activity-trace.log
cat /tmp/mcp-tool-filtering.log

# Test validation script
./test-validation-fix.sh
```

## Debugging Tips

1. **Code not reloading?**
   - Kill all bun processes: `pkill -9 bun`
   - Restart dev server from scratch
   
2. **Validation not throwing errors?**
   - Check if runValidation() is being called
   - Check validation object structure in template JSON
   - Verify file paths are correct (interpolated variables)

3. **Can't see console.error?**
   - Check dev server terminal (pts/2)
   - Or check dev.log file
   - Or check system journal: `journalctl -f | grep -i activity`

---

**Remember**: Dev server MUST be restarted for changes to take effect!
