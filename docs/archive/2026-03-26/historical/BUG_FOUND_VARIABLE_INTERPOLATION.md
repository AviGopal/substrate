# BUG FOUND: Variable Interpolation with Self-Referencing Defaults

## Root Cause Discovered! 🎉

After adding lifecycle tracing and restarting the bun dev server, we found the exact failure:

```
🔴 LIFECYCLE: CAUGHT EXCEPTION in task execution
Error: "Missing variables in template: {{templateDescription}}, {{templateId}}, {{templateId}}. 
       Provided variables: templateName, templateDescription, category, purpose, templateId"
```

## The Bug

The `create-activity-self-contained` template has variables with **self-referencing defaults**:

```json
{
  "name": "purpose",
  "default": "{{templateDescription}}"  ← References another variable
},
{
  "name": "templateId",
  "default": "{{templateId}}"  ← SELF-REFERENCE!
}
```

### What Happens

1. User provides: `{templateName: "Test", templateDescription: "Desc", category: "infra"}`
2. `mergeDefaultVariables()` adds defaults: `{purpose: "{{templateDescription}}", templateId: "{{templateId}}"}`
3. `interpolatePrompt()` replaces `{{templateId}}` with `"{{templateId}}"` (the literal string!)
4. After interpolation, `{{templateId}}` still appears in the template
5. Error: "Missing variables: {{templateId}}"

The self-reference `{{templateId}}` with default `"{{templateId}}"` creates a circular reference that can never be resolved!

## The Fix (In Progress)

Modified `mergeDefaultVariables()` in `activity-template.ts` to:

1. **Detect self-references**: Check if default matches `{{varName}}` where varName is the variable itself
2. **Auto-generate templateId**: Convert `templateName` to kebab-case when templateId self-references
3. **Interpolate cross-references**: Handle defaults like `{{templateDescription}}` that reference other variables

### Code Changes

- Commit `fc9f2b30`: Initial fix to interpolate variable references in defaults
- Commit `0e8fe37b`: Added self-reference detection and auto-generation
- Commits `00158a00`, `63e1ad2f`: Added debug logging to verify execution

## Current Status

**Fix implemented but not working yet** - Debug logging added to understand why.

Possible issues:
1. Bun caching again (unlikely - we just restarted)
2. Logic error in the fix
3. Code not being executed for some reason

## Debug Output Needed

Next test should show console.error messages:
- `[DEBUG mergeDefaultVariables] Starting interpolation loop`
- `[DEBUG] Checking var: templateId, default: {{templateId}}`
- `[DEBUG] templateId has variable references in default`
- `[DEBUG] Self-reference detected for templateId`

If these don't appear, the second loop isn't executing.

## Expected Behavior After Fix

1. User provides: `{templateName: "Add REST Endpoint", ...}`
2. Merge detects `templateId` has self-reference default
3. Auto-generate: `templateId = "add-rest-endpoint"` (kebab-case)
4. Merge detects `purpose` has cross-reference default `{{templateDescription}}`
5. Interpolate: `purpose = "Description value"` 
6. All variables resolved, no more `{{...}}` patterns in template
7. Activity executes successfully!

## Files Modified

- `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
  - Lines 1523-1556: New interpolation loop for default values

## Next Steps

1. Run activity with debug logging
2. Check console output to see if new code executes
3. Fix any logic errors discovered
4. Verify activity succeeds!

---

**We're VERY close! The bug is identified and fix is implemented, just needs debugging.**
