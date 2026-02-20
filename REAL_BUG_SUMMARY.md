# Real Bug Summary: Context Requirements Still Broken

## What We Discovered

After extensive debugging with live code (`bun run dev`), we found **MULTIPLE bugs** in the contextRequirements handling:

### Bug 1: Missing from CreateOptions Schema ✅ FIXED
**File**: `activity-template.ts` line ~863  
**Problem**: CreateOptions schema (used to parse input JSON) didn't have contextRequirements field  
**Fix**: Added `contextRequirements: z.array(ContextRequirement).optional()`  
**Commit**: `42e611ce`

### Bug 2: Wrong Default Handling ✅ FIXED  
**File**: `activity-template.ts` line ~863  
**Problem**: `.default([])` was making contextRequirements always empty  
**Fix**: Removed `.default([])`, made it just `.optional()`  
**Commit**: `0867ae03`

### Bug 3: Wrong Operator (|| vs ??) ✅ FIXED
**File**: `activity-template.ts` line 935  
**Problem**: Used `||` which treats `[]` as falsy and replaces it  
**Fix**: Changed to `??` (nullish coalescing) which only triggers on null/undefined  
**Commit**: `def6e85d`

### Bug 4: Parameter Not Added to Function ✅ FIXED (Previously)
**File**: `activity-template.ts` line 888  
**Problem**: initializeTemplateSchema didn't accept contextRequirements parameter  
**Fix**: Added `contextRequirements?: CreateOptions["contextRequirements"]` to signature  
**Commit**: `c49d369b` (previous session)

### Bug 5: Not Passed to Initialization ✅ FIXED (Previously)
**File**: `activity-template.ts` line 1043  
**Problem**: create() didn't pass contextRequirements to initializeTemplateSchema  
**Fix**: Added `contextRequirements: parsed.contextRequirements,` to call  
**Commit**: `c49d369b` (previous session)

---

## Current Status: STILL BROKEN

Despite ALL 5 fixes being applied, templates registered NOW still have:
```json
"contextRequirements": []
```

### Evidence
```bash
$ cat ~/.local/share/opencode/storage/activity-template/debug-trace-test.json | jq '.contextRequirements | length'
0

$ cat templates/bootstrap/debug-trace-test.json | jq '.contextRequirements | length'  
1  # Source has it, but registration strips it!
```

---

## Theories for Why It's Still Broken

### Theory 1: Code Not Live-Loaded
- Running with `bun run dev` but changes not taking effect
- TypeScript not being transpiled/reloaded
- Caching somewhere

### Theory 2: Another Code Path
- Maybe register_activity_template tool uses different code path
- Maybe TemplateRepository/TemplateLoader has own logic
- Maybe Metabob MCP backend is stripping it

### Theory 3: Schema Issue
- Zod schema validation failing silently
- Field being parsed but then lost
- Type mismatch causing undefined

### Theory 4: Storage Issue
- Template saved correctly but read back wrong
- JSON serialization issue
- Storage layer stripping the field

---

## Next Steps to Debug

### Option A: Add More Logging
Already attempted with commit `ecc24fcc` but logs didn't appear. Need to:
1. Verify logging is actually running
2. Check if logs go to different location
3. Add console.log instead of log.info

### Option B: Test Manually
```typescript
// In repos/metabob-opencode/packages/opencode
import { ActivityTemplate } from './src/session/activity-template'

const result = await ActivityTemplate.create({
  name: "Manual Test",
  description: "Test",
  category: "infrastructure",
  contextRequirements: [{
    key: "test",
    hint: "test",
    impulseTypes: ["memo"],
    required: true,
    budgetRange: [100, 500]
  }],
  tasks: [...]
})

console.log('contextRequirements:', result.contextRequirements)
```

### Option C: Check Intermediate Steps
1. Parse JSON directly and check result
2. Call ActivityTemplate.create() and check result  
3. Call ActivityTemplate.save() and check what's saved
4. Call ActivityTemplate.load() and check what's loaded
5. Identify exact step where contextRequirements disappears

### Option D: Rebuild/Restart
- Stop `bun run dev`
- Run `bun run build`
- Restart `bun run dev`
- Try registration again

---

## Summary

**Fixes Applied**: 5 separate bugs fixed across 6 commits  
**Current State**: Still broken - contextRequirements = []  
**Likely Cause**: Code changes not being live-loaded OR another code path  
**Blocker**: Can't test templates with contextRequirements until this is resolved

**Impact**:
- debug-failing-feature template can't be tested
- All ~15 OpenCode templates with contextRequirements broken
- Bootstrap workflow blocked
- Context negotiation completely non-functional

**Time Spent**: ~3 hours debugging  
**Solution**: Still unknown - needs deeper investigation or restart/rebuild

---

*Last updated: 2026-02-20*  
*Status: Multiple fixes applied but still broken*  
*Next: Try rebuild/restart or manual testing*
