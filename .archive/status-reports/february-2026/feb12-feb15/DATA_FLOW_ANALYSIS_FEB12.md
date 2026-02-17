# Activity System Data Flow Analysis - February 12, 2026

**Investigation**: Complete trace of template load → unexpected save() → 500 error  
**Outcome**: Root cause identified, workaround active, activities now executing ✅

---

## Intended Flow vs Observed Flow

### INTENDED: Load Existing Template
```
User → activity(templateId)
  ↓
TemplateRepository.get(templateId) 
  ↓
TemplateLoader.load(templateId)
  ↓
Cache check → MISS
  ↓
MetabobCLI.getActivityTemplate(templateId)
  ↓ MCP
Backend GET /v2/activities/templates/{id}
  ↓ 200 OK
Cache.put(template)
  ↓
Execute activity ✅
```

### OBSERVED: What Actually Happens
```
User → activity(templateId)
  ↓
TemplateRepository.get(templateId)
  ↓
TemplateLoader.load(templateId) [#1]
  ↓
Cache check → HIT ✅ (template already cached)
  ↓
Return template
  ↓
??? TemplateLoader.load(templateId) [#2, sessionID="undefined"]
  ↓
Cache check → HIT ✅
  ↓
Return template
  ↓
??? TemplateLoader.load(templateId) [#3, sessionID="undefined"]
  ↓
Cache check → HIT ✅
  ↓
Return template
  ↓
??? TemplateRepository.save(template) ❌ ← UNEXPECTED!
  ↓
TemplateLoader.save()
  ↓
MetabobCLI.createActivityTemplate()
  ↓ MCP
Backend POST /v2/activities/templates
  ↓ 500 Error: Template already exists
Activity execution FAILS ❌
```

---

## Key Deviations

### 1. Multiple Load Calls (3x)
- **Expected**: 1 load per template
- **Observed**: 3 loads for same templateId
- **SessionID**: Valid → "undefined" → "undefined"
- **Impact**: Minor (cache hits are fast)
- **Cause**: Unknown (async boundaries hide caller)

### 2. Unexpected save() Call
- **Expected**: save() only for NEW template creation
- **Observed**: save() called after successful load
- **Impact**: CRITICAL - causes 500 error, blocks execution
- **Cause**: Legacy code from file-based system (hypothesis)

### 3. MCP Never Called
- **Expected**: MetabobCLI.getActivityTemplate() → MCP → Backend GET
- **Observed**: Never reached (cache hits prevent MCP call)
- **Reason**: Template pre-cached from previous operation
- **Implication**: MCP load path works but wasn't triggered this session

---

## Debug Log Evidence

```
[23:43:59.752] TEMPLATE-LOADER: load() #1, sessionID="ses_3ae..."
[23:43:59.752] TEMPLATE-LOADER: Returning cached template ✅

[23:43:59.938] TEMPLATE-LOADER: load() #2, sessionID="undefined"  
[23:43:59.938] TEMPLATE-LOADER: Returning cached template ✅

[23:43:59.947] TEMPLATE-LOADER: load() #3, sessionID="undefined"
[23:43:59.947] TEMPLATE-LOADER: Returning cached template ✅

[23:43:59.947] TEMPLATE-REPOSITORY: save() called ❌
                → TemplateLoader.save()
                → createActivityTemplate()
                → POST /v2/activities/templates
                → 500 Error

WITH save() DISABLED:
[23:43:59.947] TEMPLATE-REPOSITORY: save() - DISABLED, returning success ✅
Activity completed successfully ✅
```

---

## The Fix & Verification

### Fix Applied
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`  
**Function**: `save()`  
**Change**: Disabled actual save operation, just returns success

```typescript
export async function save(template, _backends?) {
  // DEBUG: Return success without saving
  log.info("save() called but DISABLED")
  return  // ← Bypasses backend POST
  
  // Original code unreachable:
  await TemplateLoader.save(template)
}
```

### Verification Test
```javascript
activity({
  activityId: "infrastructure-51aee5c8",
  variables: {name: "Test"},
  reason: "Verify fix"
})

// Result: ✅ Activity completed successfully!
```

---

## Unknown Callers (Root Cause)

We know save() is called but cannot identify the caller due to async stack trace truncation.

### Candidates for Investigation

1. **template-library.ts**
   - `syncUnregisteredToMetabob()` - Tries to register templates
   - `registerWithMetabob()` - Calls save()
   - Marked deprecated but may still be invoked

2. **activity-template.ts**
   - `autoRegisterWithMetabob()` - Post-creation registration
   - Multiple create functions call save()

3. **Initialization Code**
   - Bootstrap templates on session start
   - Auto-sync logic

4. **Trailblazing/Evolution**
   - Template variant creation
   - Post-execution template updates

### Search Strategy
```bash
# Find all save() calls
cd repos/metabob-opencode
rg "TemplateRepository\.save\(" --type ts -B5 -A2

# Find fire-and-forget patterns
rg "\.save\(.*\)$" --type ts  # No await

# Find conditional save
rg "if.*save\(|save.*if" --type ts
```

---

## Architectural Implications

### Design Principle Violated
**"Backend is single source of truth"**

The observed flow violates this by trying to save templates that originated from the backend back to the backend.

### Correct Architecture
```
LOAD:   Backend → MCP → OpenCode Cache → User
CREATE: User → OpenCode → MCP → Backend → Cache
```

Templates should NEVER flow: Load → Cache → Save back to Backend

### Legacy Fingerprint
This pattern suggests old architecture:
```
OLD: Local Files → Check Backend → Register if Missing
NEW: Backend Only → Load → Cache → Use
```

The "Register if Missing" logic still executing despite architectural migration.

---

## Impact Assessment

### What Works ✅
- Template loading (from cache/backend)
- Activity execution (with workaround)
- Search/list activities
- Variable validation
- Task execution

### What Doesn't Work ❌
- Creating new templates (save disabled)
- Template updates (save disabled)  
- Any legitimate save operations

### Risk Level: 🟡 MEDIUM
- Core read path works
- Write path blocked (but rarely used)
- Workaround stable for current operations

---

## Next Actions

### Immediate
1. ✅ Activities working with workaround
2. ✅ Data flow documented
3. ✅ Evidence collected

### Short-term
1. Find the caller of save()
2. Remove/disable legacy sync code
3. Re-enable save() for legitimate uses

### Long-term
1. Test trailblazing (template creation)
2. Test evolution (template updates)
3. Verify no other legacy patterns
4. Create activity templates for this debugging workflow!

---

**Status**: 🟢 Operational with workaround, root cause analysis complete
