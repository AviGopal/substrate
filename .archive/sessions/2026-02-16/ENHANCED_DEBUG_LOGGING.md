# Enhanced Debug Logging - Added Stack Traces

**Date**: February 12, 2026 19:37 UTC  
**Status**: Enhanced logging ready, restart required

---

## Additional Logging Added

Based on your report of a stack trace error on line 623 of template-loader.ts, I've added more detailed logging:

### template-loader.ts Changes

**Line ~242: In load() function**
```typescript
console.error(`!!! TEMPLATE-LOADER: load() called for id="${id}", sessionID="${sessionID}"`)
```

**Line ~612: In save() function**
```typescript
console.error(`!!! TEMPLATE-LOADER: save() called for template="${template.name}" (${template.id})`)
console.error(`!!! TEMPLATE-LOADER: CALL STACK:`, new Error().stack)
```

---

## What This Will Show

### Expected Normal Flow (if working)
```
!!! TEMPLATE-LOADER: load() called for id="infrastructure-51aee5c8", sessionID="..."
!!! OPENCODE: Calling MCP tool "get_activity_template" for activity_id="infrastructure-51aee5c8" !!!
!!! GET_ACTIVITY_TEMPLATE_TOOL CALLED !!! activity_id=infrastructure-51aee5c8
!!! OPENCODE: MCP tool returned: {"status":"success","template":{...
```

### What's Probably Happening (save being called)
```
!!! TEMPLATE-LOADER: load() called for id="infrastructure-51aee5c8", sessionID="..."
!!! TEMPLATE-LOADER: save() called for template="..." (...)
!!! TEMPLATE-LOADER: CALL STACK: Error
    at save (template-loader.ts:612)
    at ??? (this will reveal what called save!)
    at ???
!!! OPENCODE: Calling MCP tool "create_activity_template" for template="..." !!!
!!! CREATE_ACTIVITY_TEMPLATE_TOOL CALLED !!! name=..., category=...
Error: Backend returned 500: {"error":"Failed to create template"}
```

---

## Key Question

**Why is `save()` being called when we're just trying to load a template?**

The stack trace will show the answer. Possible causes:
1. Template not found in cache → some code tries to create it
2. Template format conversion issue → triggers save
3. Registration logic → tries to save template after loading
4. Variant resolution → creates variant and tries to save

---

## Test After Restart

```javascript
activity({
  activityId: "infrastructure-51aee5c8",
  variables: {name: "Stack Trace Test"},
  reason: "Observing complete call path with stack traces"
})
```

---

## What to Look For in Terminal

1. **Does load() get called?** 
   - YES → Template loading starts correctly
   - NO → Activity tool isn't even trying to load

2. **Does save() get called?**
   - YES → This is the bug! Stack trace will show why
   - NO → Error is elsewhere

3. **What's in the stack trace?**
   - Shows the exact code path: activity.ts → ??? → template-loader.ts:save()

---

## Files Modified

- `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
  - Line ~242: Added load() debug log
  - Line ~612: Added save() debug log with stack trace
  - Line ~623: Existing createActivityTemplate call (where error originates)

---

**Next Step**: Restart OpenCode, run activity test, capture complete stack trace from terminal output.

This will definitively show the root cause.
