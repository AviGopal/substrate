# Activity Validation Fix Summary

## Problem Discovered

**Activities complete successfully even when validation criteria aren't met.**

### Root Cause

The `runValidation()` function in `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (lines 1345-1378) only **logs warnings** instead of **throwing errors** when validation fails.

**Broken behavior:**
- Required files missing → Only logs warning, continues execution
- Required patterns missing → Only logs debug message, continues execution  
- Forbidden patterns found → Only logs debug message, continues execution

### Evidence

From `create-activity-self-contained` template testing:
- Task creates `/tmp/activity-template-{{templateId}}/REQUIREMENTS.md` ✅
- File contains all required content ✅
- But validation never runs to verify it ❌
- Activity marked as failed despite successful work ❌

### Code Investigation Path

1. **Suspected ActivityTool.execute() wasn't being called**
   - Added trace logging at line 421
   - Trace log never created → seemed like execute wasn't called

2. **Investigated MCP tool routing**
   - Checked if `metabob_activity` MCP tool was overriding OpenCode's tool
   - Found: MCP server doesn't provide `metabob_activity` execution tool
   - Only provides template **management** tools (search, get, register, post_result)

3. **Discovered TemplateExecutor**
   - Found separate `TemplateExecutor.execute()` in template-executor.ts
   - But ActivityTool doesn't use it

4. **Traced actual execution flow**
   - ActivityTool.execute() (line 419)
   - → executeTemplate() (line 851)  
   - → task execution loop (line 1683)
   - → runValidation() (line 2142)

5. **Found the bug in runValidation()**
   - Lines 1356-1365: File checks only warn, don't error
   - Lines 1370-1377: Pattern checks only log, don't validate

### The Fix

Modified `runValidation()` function (lines 1356-1378) to:

1. **Required files validation:**
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

2. **Required patterns validation:**
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

3. **Forbidden patterns validation:**
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

4. **Fixed pattern interpolation to handle objects:**
```typescript
const interpolatedPatterns = validation.requiredPatterns.map((p) => 
  typeof p === 'string' ? interpolatePrompt(p, mergedVariables) : interpolatePrompt(p.pattern, mergedVariables)
)
const interpolatedForbidden = validation.forbiddenPatterns.map((p) => 
  typeof p === 'string' ? interpolatePrompt(p, mergedVariables) : interpolatePrompt(p.pattern, mergedVariables)
)
```

## Files Modified

- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
  - Lines 1352-1354: Pattern interpolation (handle object vs string)
  - Lines 1356-1378: Validation checks (throw errors instead of warnings)

## Testing Required

1. **Restart dev server** (code changes may not hot-reload):
   ```bash
   # Kill existing dev server
   pkill -f "bun run dev"
   
   # Restart from repos/metabob-opencode
   cd repos/metabob-opencode && bun run dev ../..
   ```

2. **Test with create-activity-self-contained:**
   ```
   activity({
     templateId: "create-activity-self-contained",
     variables: { 
       templateId: "test-validation",
       templateName: "Test Validation",
       category: "feature"
     },
     reason: "Testing validation fix"
   })
   ```

3. **Expected behavior:**
   - If task creates file with all required patterns → validation passes ✅
   - If task creates file missing patterns → validation throws error ❌
   - If task doesn't create file → validation throws error ❌

## Why Code Changes Weren't Picked Up

**Suspected causes:**
1. Bun may cache modules even in dev mode
2. Dev server may need restart for changes to tool execution code
3. Multiple instances of opencode may be running

**Evidence:**
- Trace log at line 421 never created despite ActivityTool.execute() being called
- Changes to prompt.ts (MCP filtering) also never logged
- Dev server running since 01:24 without restart

**Resolution:**
- Restart dev server after code changes
- Or use explicit kill + restart workflow

## Next Steps

1. Apply fix (already done in this session)
2. Restart dev server
3. Test create-activity-self-contained
4. If validation works, test other templates
5. Create utility activities (manage-docker-compose, rebuild-containers, manage-dockerfiles)

## Mystery Solved

**Q: Why doesn't ActivityTool.execute() trace log appear?**

**A: Not definitively solved, but leading theory:**
- Bun dev server caches modules
- Changes to activity.ts require restart
- The system IS calling ActivityTool.execute() (confirmed by code path analysis)
- But it's using the cached/old version of the code

**Supporting evidence:**
- activity tool works correctly (executes activities)
- Code flow analysis confirms ActivityTool → executeTemplate → runValidation path
- No alternate execution path exists (MCP doesn't provide execution tool)
- Therefore: Must be calling ActivityTool.execute(), just with old code

## Open Questions

1. Does Bun dev mode truly hot-reload all changes, or only certain files?
2. Is there a build step we're missing?
3. Should we be using `bun --watch` instead of `bun run dev`?

## Impact

**High priority fix** - Without validation, multi-task activities can:
- Complete with partial work done
- Miss critical requirements  
- Appear successful when they failed
- Create inconsistent state

This fix is **critical for activity system reliability**.
