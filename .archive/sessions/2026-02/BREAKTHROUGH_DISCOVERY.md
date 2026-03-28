# BREAKTHROUGH: getActivityTemplate() Never Called!

**Date**: February 12, 2026 19:47 UTC  
**Discovery**: Critical finding from debug logs

---

## The Smoking Gun

From `activity-debug.log`:

```
[2026-02-12T23:20:48.017Z] TEMPLATE-LOADER: load() called for id="infrastructure-51aee5c8", sessionID="ses_..."
[2026-02-12T23:20:48.310Z] TEMPLATE-LOADER: load() called for id="infrastructure-51aee5c8", sessionID="undefined"
[2026-02-12T23:20:48.314Z] TEMPLATE-LOADER: load() called for id="infrastructure-51aee5c8", sessionID="undefined"
[2026-02-12T23:20:48.315Z] TEMPLATE-LOADER: save() called for template="Proof Greeting Feb12" (infrastructure-51aee5c8)
[2026-02-12T23:20:48.315Z] OPENCODE: Calling MCP tool "create_activity_template" for template="Proof Greeting Feb12"
```

**CRITICAL OBSERVATION**: There is **NO** log entry for:
```
OPENCODE: Calling MCP tool "get_activity_template" for activity_id="infrastructure-51aee5c8"
```

##What This Means

`MetabobCLI.getActivityTemplate()` is **NEVER EXECUTED**!

The code flow is:
1. `load()` is called 3 times
2. Something prevents `getActivityTemplate()` from being called  
3. Execution jumps directly to `save()`
4. `save()` calls `createActivityTemplate()`
5. Backend returns 500

---

## Questions Raised

### Q1: Why is load() called 3 times?
- First call: sessionID is valid
- Second/third calls: sessionID is "undefined"  
- Suggests recursive or retry logic

### Q2: Why isn't getActivityTemplate() called?
Possible reasons:
- Code never reaches line 285 (early return/throw)
- Import fails
- Function is overridden/mocked
- Different code path entirely

### Q3: How does execution jump to save()?
- No code in `load()` calls `save()`
- Stack trace is truncated (only shows async internals)
- Something external must be calling `save()`

---

## Enhanced Logging Added

Added detailed logging in template-loader.ts load() function:
- Before import of MetabobCLI
- After import, before calling getActivityTemplate
- After getActivityTemplate returns

This will show EXACTLY where execution stops.

---

## Next Test

After OpenCode restart, the log will show one of:

### Scenario A: Execution stops before import
```
[...] TEMPLATE-LOADER: load() called for id="..."
(no further logs)
[...] TEMPLATE-LOADER: save() called...
```
→ Means code returns/throws before line 284

### Scenario B: Import succeeds but call fails
```
[...] TEMPLATE-LOADER: load() called for id="..."
[...] TEMPLATE-LOADER: About to import MetabobCLI and call getActivityTemplate...
[...] TEMPLATE-LOADER: MetabobCLI imported, calling getActivityTemplate...
(no "returned" log)
[...] TEMPLATE-LOADER: save() called...
```
→ Means getActivityTemplate throws or hangs

### Scenario C: Call succeeds but returns undefined
```
[...] TEMPLATE-LOADER: load() called for id="..."
[...] TEMPLATE-LOADER: About to import MetabobCLI...
[...] TEMPLATE-LOADER: MetabobCLI imported...
[...] TEMPLATE-LOADER: getActivityTemplate returned, template=null/undefined
[...] TEMPLATE-LOADER: save() called...
```
→ Means MCP tool returns nothing

---

## Hypothesis

**Most Likely**: The `load()` function has multiple code paths, and we're hitting a DIFFERENT path that doesn't use MCP at all. 

Let me check for conditional logic before the MCP call...

Actually, looking at the code structure:
- Step 1: Check cache
- Step 2: Resolve variant_id  
- Step 3: Load from MCP

**What if Step 1 or Step 2 is returning early and triggering save somehow?**

---

**Status**: 🔴 CRITICAL BUG IDENTIFIED - getActivityTemplate() bypassed entirely

**Next**: Restart and capture detailed execution flow
