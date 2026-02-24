# Session Complete: Activity Validation System Fixed

## Executive Summary

**Fixed critical bug**: Activity validation was completely broken - it only logged warnings instead of throwing errors when validation criteria weren't met. This caused activities to appear successful even when required files were missing or didn't contain required content.

## Problem

Activities using the **legacy validation format** (requiredFiles, requiredPatterns, forbiddenPatterns) would complete successfully even when validation criteria failed:

```json
{
  "validation": {
    "requiredFiles": ["/tmp/output.md"],
    "requiredPatterns": ["## Section 1", "## Section 2"],
    "forbiddenPatterns": ["DO NOT INCLUDE"]
  }
}
```

**Broken behavior**:
- File missing? → Warning logged, execution continues
- Pattern missing? → Debug message logged, execution continues
- Forbidden pattern found? → Debug message logged, execution continues

## Root Cause

File: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
Function: `runValidation()` (lines 1345-1378)

```typescript
// OLD CODE (BROKEN):
for (const file of interpolatedFiles) {
  const exists = await Bun.file(file).exists().catch(() => false)
  if (!exists) {
    log.warn("required file not found (may be in git staging)", { file, task: task.id })
    // ❌ NO ERROR THROWN!
  }
}

if (interpolatedPatterns.length > 0) {
  log.debug("required patterns to verify manually", { patterns: interpolatedPatterns, task: task.id })
  // ❌ NO VALIDATION PERFORMED!
}
```

## The Fix

### 1. Required Files Validation
```typescript
const missingFiles: string[] = []
for (const file of interpolatedFiles) {
  const exists = await Bun.file(file).exists().catch(() => false)
  if (!exists) {
    log.error("required file not found", { file, task: task.id })
    missingFiles.push(file)
  }
}

if (missingFiles.length > 0) {
  throw new Error(`Validation failed: Required files not found: ${missingFiles.join(', ')}`)
}
```

### 2. Required Patterns Validation
```typescript
if (interpolatedPatterns.length > 0 && interpolatedFiles.length > 0) {
  const missingPatterns: string[] = []
  
  for (const file of interpolatedFiles) {
    const content = await Bun.file(file).text().catch(() => "")
    
    for (const pattern of interpolatedPatterns) {
      if (!content.includes(pattern)) {
        log.error("required pattern not found", { pattern, file, task: task.id })
        missingPatterns.push(`"${pattern}" in ${file}`)
      }
    }
  }
  
  if (missingPatterns.length > 0) {
    throw new Error(`Validation failed: Required patterns not found: ${missingPatterns.join(', ')}`)
  }
}
```

### 3. Forbidden Patterns Validation
```typescript
if (interpolatedForbidden.length > 0 && interpolatedFiles.length > 0) {
  const foundForbidden: string[] = []
  
  for (const file of interpolatedFiles) {
    const content = await Bun.file(file).text().catch(() => "")
    
    for (const pattern of interpolatedForbidden) {
      if (content.includes(pattern)) {
        log.error("forbidden pattern found", { pattern, file, task: task.id })
        foundForbidden.push(`"${pattern}" in ${file}`)
      }
    }
  }
  
  if (foundForbidden.length > 0) {
    throw new Error(`Validation failed: Forbidden patterns found: ${foundForbidden.join(', ')}`)
  }
}
```

### 4. Pattern Object Handling
Fixed interpolation to handle patterns as both strings and objects:

```typescript
// OLD:
const interpolatedPatterns = validation.requiredPatterns.map((p) => interpolatePrompt(p, mergedVariables))

// NEW:
const interpolatedPatterns = validation.requiredPatterns.map((p) => 
  typeof p === 'string' ? interpolatePrompt(p, mergedVariables) : interpolatePrompt(p.pattern, mergedVariables)
)
```

## Investigation Journey

### Hypothesis 1: ActivityTool.execute() Not Being Called ❌
- Added trace logging to ActivityTool.execute()
- Trace log never appeared
- **Conclusion**: Wrong - code just wasn't reloading

### Hypothesis 2: MCP Tool Overriding OpenCode Tool ❌
- Investigated `metabob_activity` MCP tool
- Found: MCP only provides template **management** tools (search, get, register, post_result)
- No execution tool in MCP
- **Conclusion**: Wrong - MCP doesn't execute activities

### Hypothesis 3: TemplateExecutor Being Used ❌
- Found `TemplateExecutor.execute()` in template-executor.ts
- Checked ActivityTool imports
- **Conclusion**: Wrong - ActivityTool doesn't use TemplateExecutor

### Final Discovery: Found Validation Bug ✅
- Traced execution path: ActivityTool.execute() → executeTemplate() → runValidation()
- Found runValidation() only logs, never throws errors
- **Conclusion**: Correct - validation was completely broken

## Files Modified

### Main Fix
- **repos/metabob-opencode/packages/opencode/src/tool/activity.ts**
  - Lines 1352-1354: Pattern interpolation (handle string vs object)
  - Lines 1356-1419: Validation implementation (throw errors, check patterns)

### Debug Logging (can be removed later)
- **repos/metabob-opencode/packages/opencode/src/tool/activity.ts**
  - Lines 420-428: ActivityTool.execute() trace logging
  
- **repos/metabob-opencode/packages/opencode/src/session/prompt.ts**
  - Lines 922-925: MCP tool filtering trace
  - Lines 1169-1173: MCP tools added trace

## Testing Instructions

### 1. Restart Dev Server
```bash
cd repos/metabob-opencode
pkill -f "bun run dev"
bun run dev ../..
```

### 2. Run Test Script
```bash
./test-validation-fix.sh
```

### 3. Test with Real Activity
```javascript
activity({
  templateId: "create-activity-self-contained",
  variables: { 
    templateId: "test-validation",
    templateName: "Test Validation Fix",
    category: "feature"
  },
  reason: "Verifying validation now throws errors on failure"
})
```

### Expected Results
- ✅ If task creates complete file → validation passes
- ❌ If task creates incomplete file → `Error: Validation failed: Required patterns not found: "## Section" in /tmp/file.md`
- ❌ If task doesn't create file → `Error: Validation failed: Required files not found: /tmp/file.md`

## Impact

### Before Fix
- Multi-task activities could fail silently
- Partial work counted as complete
- No feedback on what was missing
- System appeared to work but was unreliable

### After Fix
- Validation errors are explicit and actionable
- Activities fail fast when requirements not met
- Clear error messages show exactly what's missing
- System is reliable for production use

## Open Questions for Next Session

### Q1: Why don't code changes hot-reload?
**Evidence**:
- Added console.error() and file logging
- Neither appeared when activity executed
- Dev server running with `bun run dev ../..`

**Possible causes**:
- Bun caches modules even in dev mode
- Need explicit `--watch` flag
- Tool execution happens in subprocess
- Build step required

**Resolution needed**: Restart dev server after code changes

### Q2: Should validation be in pre-checks or post-checks?
Current setup uses **legacy validation** (runs after task completes).

**Consideration**: File/pattern validation should probably be **post-checks** since files are created during task execution.

### Q3: Should pattern matching be fuzzy or exact?
Current implementation uses `content.includes(pattern)` which is:
- ✅ Simple and fast
- ✅ Works for exact phrases
- ❌ Can't handle regex patterns
- ❌ Can't handle whitespace variations

## Next Steps

1. ✅ **DONE**: Fix validation to throw errors
2. ⏳ **TODO**: Restart dev server
3. ⏳ **TODO**: Test fix with create-activity-self-contained
4. ⏳ **TODO**: If working, create utility activities:
   - manage-docker-compose
   - rebuild-containers
   - manage-dockerfiles
5. ⏳ **TODO**: Remove debug logging (lines 420-428 in activity.ts, lines 922-925 and 1169-1173 in prompt.ts)

## Key Learnings

1. **Validation requires explicit error throwing** - logging is not enough
2. **Pattern objects need special handling** - can be `string` or `{ pattern, description }`
3. **Code changes don't always hot-reload** - restart dev server when testing tool changes
4. **Trace the execution path before assuming** - MCP tool mystery was a red herring

## Success Criteria

- [ ] Restart dev server successfully
- [ ] create-activity-self-contained completes task 1
- [ ] Validation runs and checks file contents
- [ ] Missing patterns cause clear error messages
- [ ] Activity fails if validation fails
- [ ] Activity succeeds if validation passes

## Files to Review

- `VALIDATION_FIX_SUMMARY.md` - Detailed technical analysis
- `test-validation-fix.sh` - Test script for manual verification
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Main fix

## Git Commit Message (when ready)

```
fix(activity): Make validation actually validate and throw errors

Problem:
- Legacy validation (requiredFiles, requiredPatterns) only logged warnings
- Activities appeared successful even when validation criteria failed
- runValidation() never threw errors for missing files or patterns

Solution:
- Collect missing files and throw error if any missing
- Read file contents and verify required patterns present
- Check forbidden patterns not present
- Handle pattern objects { pattern, description } correctly

Impact:
- Activities now fail fast when validation requirements not met
- Clear error messages show exactly what's missing
- Multi-task activities reliable for production use

Affects: create-activity-self-contained and other templates using
legacy validation format.
```

---

**Session Status**: ✅ **FIX IMPLEMENTED** - Ready for testing after dev server restart
