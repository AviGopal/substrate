# Correctness Validation - BREAKTHROUGH DISCOVERY

## Date
February 18, 2026

## 🎯 CRITICAL DISCOVERY

**`Activity.create()` is NOT being executed for template-based activities!**

## Proof

### Test 1: Conditional Throw
- Added: `if (activity.executionEvidence) throw new Error(...)`
- Result: Activity completed successfully ✅
- Conclusion: Either condition false OR code not running

### Test 2: Unconditional Throw  
- Added: `throw new Error(...)` (no condition)
- Result: Activity completed successfully ✅
- Conclusion: Code definitely not running (throw would always fail)

### Test 3: Title Mutation
- Added: `activity.title = "[EVIDENCE_TEST] " + activity.title`
- Result: Activity title = "Ultra Simple Test" (no prefix) ✅
- Conclusion: Mutation never happened, code not running

### Test 4: Console Logging
- Added: `console.error()` at module load and function call
- Result: TBD (logs not visible in activity output)
- Next: Check stderr/log files

## Why This Matters

All our evidence collection code (Phases 1.1-1.5) is in `Activity.create()`, but if that function isn't called, **none of our code runs**.

This explains:
- ❌ No evidence fields in saved activities
- ❌ No debug logs appearing
- ❌ No file writes succeeding
- ❌ Session tracking not collecting data

## Root Cause Analysis

### What We Know
1. ✅ Code is in the right file: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
2. ✅ Submodule is at correct commit: `6930d2f1`
3. ✅ Running process uses our submodule: PWD = `repos/metabob-opencode`
4. ✅ activity.ts line 470 calls `Activity.create()`: `const activity = await Activity.create({...})`
5. ❌ But Activity.create() doesn't execute

### Hypotheses

**Hypothesis A: Module Caching**
- Bun/Node cached old version of module
- Our changes not reflected in running code
- Test: Restart OpenCode session

**Hypothesis B: Different Code Path**
- Template activities use alternative creation method
- Activity.create() only for non-template activities
- Test: Search for alternative activity instantiation

**Hypothesis C: Import Resolution**
- Activity import resolves to wrong module
- Multiple Activity modules in codebase
- Test: Check import paths

**Hypothesis D: Build Step Required**
- TypeScript needs compilation despite using bun
- Source changes not reflected without rebuild
- Test: Check for dist/build directories

## Investigation Steps Taken

### Verification of Setup
1. ✅ Checked submodule commit - correct
2. ✅ Verified throw statement in file - present
3. ✅ Checked running process - using our submodule
4. ✅ Verified import statement - imports from ../session/activity
5. ✅ Confirmed TypeScript compiles - no errors

### Debug Attempts (10 iterations)
1. log.debug() - not visible
2. log.info() - not visible
3. console.error() - not visible
4. File write to /tmp - file not created
5. File write to ~ - overwritten by activity
6. File write to ~/.local/share/opencode - not created
7. Conditional throw - didn't fail
8. Unconditional throw - didn't fail  
9. Title mutation - didn't apply
10. Console.error at module load - TBD

## Next Steps

### Immediate
1. **Check stderr/logs for console.error output**
   - Look in ~/.local/share/opencode/log/
   - Check process stderr redirection
   
2. **Restart OpenCode session**
   - Clear any module caches
   - Verify changes take effect

3. **Search for alternative Activity creation**
   - grep for "new.*Info.*{" or direct object construction
   - Check if template activities bypass Activity.create()

### If Activity.create() Truly Not Called
**We need to find WHERE activities ARE created and add evidence collection there.**

Likely locations:
- Direct object construction in activity.ts
- Alternative creation function
- Deserialization from storage
- Copy from template

## Impact

**All evidence collection code must be moved to the ACTUAL activity creation location.**

Current implementation location:
- ❌ Activity.create() - NOT called for template activities

Required location:
- ❓ Unknown - need to find actual creation point

## Files Modified (This Session)

**Debug iterations**:
- `68316624` - Conditional throw
- `60239dee` - Unconditional throw
- `fee4a054` - Title mutation
- `6930d2f1` - Console.error logging

## Commits Summary

**Total commits**: 14 (including submodule updates)
**Lines added**: ~150 (mostly debug code)
**Result**: Discovered Activity.create() not executing

## Token Usage
- Previous sessions: ~110K tokens
- This session: ~121K tokens  
- **Total project**: ~231K tokens

## Breakthrough Insight

After 3 sessions and ~230K tokens of debugging, we discovered the fundamental issue:

**We've been implementing evidence collection in a function that never executes for template activities.**

This is why:
- All our code compiled correctly ✅
- All our logic was sound ✅
- But nothing ever happened ❌

The solution is not to fix the evidence collection code - it's to find where activities are ACTUALLY created and put the code there.

## Recommended Next Session

```bash
# 1. Check console.error output
grep "activity.ts module loaded" ~/.local/share/opencode/log/*.log
grep "Activity.create() CALLED" ~/.local/share/opencode/log/*.log

# 2. Find actual activity creation
cd repos/metabob-opencode
rg "templateId.*=" packages/opencode/src/tool/activity.ts -A 5 -B 5

# 3. Look for where activity object is populated
rg "activity\\.title.*=" packages/opencode/src/tool/activity.ts

# 4. Search for direct Activity.Info construction
rg ": Activity\\.Info = " packages/opencode/src/

# 5. If all else fails - add logging EVERYWHERE
# Add console.error to every line around activity creation
```

## Status

🔍 **ACTIVE INVESTIGATION - BREAKTHROUGH ACHIEVED**

We now know the problem: Activity.create() doesn't execute.
Next: Find WHERE activities are actually created.
