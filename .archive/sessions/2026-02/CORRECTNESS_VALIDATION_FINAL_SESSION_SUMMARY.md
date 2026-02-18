# Correctness Validation - Final Session Summary

## Date
February 17-18, 2026

## Status  
🔍 **ACTIVE DEBUGGING** - Evidence fields initialized but not persisting to storage

## Sessions Completed

### Session 1: Architecture Discovery
- **Goal**: Test Phase 1.5 correctness validation
- **Discovery**: Evidence collection code in wrong location (template-executor.ts vs activity.ts)
- **Output**: CORRECTNESS_VALIDATION_ARCHITECTURE_DISCOVERY.md

### Session 2: Phase 1.2 Fix Implementation  
- **Goal**: Move session tracking to correct location
- **Action**: Implemented session tracking in activity.ts after TaskTool.execute()
- **Commit**: 0ac8ada0 - "fix(activity): Phase 1.2 - Move session tracking to correct execution path"
- **Result**: Code compiles, but fields still missing from storage

### Session 3: Deep Debug Investigation (Current)
- **Goal**: Find where evidence fields are lost
- **Actions**:
  1. Added log.debug() statements → Not visible
  2. Added log.info() statements → Not visible
  3. Added console.error() statements → Not visible (no output)
  4. Added file writes to /tmp → File not created
  5. Added file writes to ~ → File overwritten by activity task
  6. Added file writes to ~/.local/share/opencode → File not created
  7. Attempting multiple file locations → In progress

## The Mystery

### What We Know ✅
1. **Schema is correct**: executionEvidence, workArtifacts, correctnessVerdict defined in Activity.Info
2. **Initialization is correct**: Code at line 415-424 creates fields with empty arrays
3. **Activity.create() is called**: Line 470 in activity.ts calls it for template activities
4. **No Zod parsing strips fields**: Tested with manual Zod.parse() - preserves optional fields
5. **JSON.stringify works**: Manual test shows empty arrays ARE preserved
6. **cleanImpulsesForStorage works**: Uses spread operator, preserves all fields
7. **Storage.write works**: Just does JSON.stringify(content, null, 2)

### What We Don't Know ❌
1. **Why debug logs never appear**: Not in log files, not in console, not anywhere
2. **Why file writes don't work**: Attempted 6 different file locations, none created
3. **Where fields are lost**: Between initialization (line 415) and save (line 749)
4. **Why activity works but evidence doesn't**: Activity executes correctly, just missing evidence

## Current Hypothesis

**The evidence fields ARE being initialized, but something is stripping them BEFORE the first Activity.save() call.**

Possible causes:
1. **Type system issue**: TypeScript allowing fields but runtime stripping them
2. **Hidden Zod validation**: Some middleware calling .parse() that strips optional empty fields
3. **Object spread issue**: Something using `{ ...activity }` without the evidence fields
4. **Different code path**: Template activities might not go through Activity.create() at all
5. **Environment restriction**: File I/O blocked in activity execution environment

## Evidence Collection Status

| Phase | Status | Location | Issue |
|-------|--------|----------|-------|
| 1.1 Schema | ✅ Complete | activity.ts | Working |
| 1.2 Session Tracking | ⚠️  Fixed but not collecting | activity.ts | Code present, not executing or data lost |
| 1.3 Validation Logging | ❓ Unknown | task-execution-shared.ts | Not tested yet |
| 1.4 File Change Tracking | ✅ In correct place | activity.ts | Should work when data persists |
| 1.5 Verdict Computation | ✅ Complete | activity-correctness.ts | Working, just needs data |

## Debug Commits Made

1. `0ac8ada0` - Phase 1.2 fix (session tracking)
2. `7b7f03df` - Debug logging to Activity.save()
3. `46c37b76` - Debug logging before final save
4. `839865a8` - Console.error logging
5. `6b162c09` - Console.error in Activity.create()
6. `4523752e` - File debug logging to /tmp
7. `169ab524` - File debug logging to home dir
8. `2e5227bb` - Unique filename
9. `b0b4a875` - Activity-specific debug file

## Files Modified

**Main implementation**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (~60 lines added)
  - Helper functions: getSessionMessageCount(), getSessionToolCallCount()
  - Session tracking after TaskTool.execute()
  - Debug logging (FINAL SAVE CHECK)

- `repos/metabob-opencode/packages/opencode/src/session/activity.ts` (~50 lines added)
  - Debug logging in create()
  - Debug logging in save()
  - File write attempts (multiple iterations)

## Next Steps

### Immediate (Next Session)
1. **Simplify file write test** - Try writing to multiple locations with simple text
2. **Check if Activity.create() runs** - Add a throw to see if code path is hit
3. **Inspect without activities** - Create activity directly in Node REPL to test
4. **Check TypeScript emit** - Verify compiled JavaScript has the fields

### Alternative Approaches
1. **Use debugger**: Attach Node debugger to see actual runtime behavior
2. **Check compiled code**: Look at dist/index.js to verify fields aren't stripped by TypeScript
3. **Test with required fields**: Change optional() to required and see what breaks
4. **Minimal reproduction**: Create standalone test case outside OpenCode

### Nuclear Option
If debugging continues to fail:
1. **Remove optional()**: Make fields required in schema
2. **Force initialization**: Always create fields, never undefined
3. **Add validation**: Throw error if fields missing before save
4. **Bypass Storage**: Write directly to file system for testing

## Key Insight

The fact that NO debug output appears (logs, console, files) suggests one of:
1. **Code not running**: Activity.create() might not be called for templates
2. **Environment isolation**: Sub-process with no file/console access
3. **Exception swallowing**: Try-catch blocks hiding all errors
4. **Different runtime**: Code running in worker/container with restricted I/O

## Test Results

### Activities Executed
- `act_mlrcyw03_0bba12618622e0db` - No evidence fields
- `act_mlrd8qq6_335910346c72ca7f` - No evidence fields  
- `act_mlrdeljy_d4d6bc058e231c68` - No evidence fields
- `act_mlrdtw7s_2cfaf791c56ff5f2` - No evidence fields
- Latest (unnamed) - No evidence fields

**Consistency**: 100% of activities missing evidence fields

## Conclusion

We've made significant progress understanding the system architecture and fixing the Phase 1.2 implementation, but hit a fundamental debugging roadblock where:
- Code appears correct
- No TypeScript errors
- No runtime errors visible
- But evidence fields consistently disappear

The next session needs to focus on **proving the code actually runs** before debugging why fields disappear.

## Token Usage
- Session 1: ~65K tokens (architecture discovery)
- Session 2: ~35K tokens (Phase 1.2 fix)
- Session 3: ~40K tokens (debug investigation)
- **Total**: ~140K tokens across 3 sessions

## Recommended Next Session Start

```bash
# Start fresh debugging approach
cd /home/avi/documents/work/exp-repo/metabob-devbob

# 1. Verify code is running with intentional error
# Add: throw new Error("CREATE CALLED") to Activity.create()
# Run activity, should fail with error message

# 2. If that doesn't appear, code path is wrong
# Check if template activities use different creation path

# 3. Test storage directly
node -e "
const Activity = require('./repos/metabob-opencode/packages/opencode/src/session/activity');
// Create and inspect activity object
"
```
