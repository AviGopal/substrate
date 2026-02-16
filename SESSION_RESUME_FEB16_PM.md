# Session Resume: Feb 16 PM - Template Registration Progress

## Status: MAJOR BREAKTHROUGH ✅

**Problem Solved**: Successfully bypassed the `@openauthjs/openauth/pkce` auth dependency issue that was blocking all template registration commands.

**Solution**: Use `OPENCODE_DISABLE_DEFAULT_PLUGINS=1` environment variable to skip auth plugin loading.

---

## What We Accomplished

### 1. Auth Dependency Bypass (SOLVED)
**Previous Issue**: 
```
Error: Cannot find module '@openauthjs/openauth/pkce' from 
'/home/avi/.cache/opencode/node_modules/opencode-anthropic-auth/index.mjs'
```

**Root Cause**: Bun's ESM module resolver couldn't find the pkce submodule export, even though the files exist.

**Solution Found**:
```bash
OPENCODE_DISABLE_DEFAULT_PLUGINS=1 opencode activity template register all
```

This skips loading `opencode-anthropic-auth` and `opencode-copilot-auth` plugins entirely (line 42-44 in `repos/metabob-opencode/packages/opencode/src/plugin/index.ts`).

### 2. Discovered Template Registration Architecture

**Key Findings**:
1. Registration command now runs without auth errors ✅
2. Templates are successfully loaded from local storage ✅
3. Registration to Metabob backend is failing silently ⚠️

**Registration Results** (with OPENCODE_DISABLE_DEFAULT_PLUGINS=1):
```
📊 Registration Results:
   Total checked: 13
   Registered: 0
   Skipped: 2
   Failed: 11
```

**Why Registration Fails**:
- Backend endpoint exists: `POST /v2/activities/templates`
- TemplateRepository.save() catches and swallows errors (returns false instead of throwing)
- Registration failures are logged as warnings, not errors
- Need to investigate endpoint payload format mismatch

### 3. Verified Template Loading Fix Still Works

**Direct API Test Confirmed**:
```bash
# Template loading works perfectly
TemplateRepository.get("fix-bug-complete", "local") ✅
TemplateRepository.list({ backend: "local" }) ✅
# Returns all 13 templates including our 3 cochange-enabled ones
```

**Binary Version**: `feat/acp-delegation-improvements-202602161252` (Feb 16 04:52)
**Fix Status**: ✅ Confirmed working in binary

---

## Immediate Next Steps

### Option A: Fix Backend Registration (RECOMMENDED)
**Goal**: Get templates registered to Metabob backend so MCP sessions can use them

**Steps**:
1. Enable DEBUG logging in TemplateRepository.save() to see actual error
2. Check payload format OpenCode is sending vs what backend expects
3. Update template format conversion if needed
4. Test registration: `OPENCODE_DISABLE_DEFAULT_PLUGINS=1 opencode activity template register one fix-bug-complete`
5. Verify via MCP: `metabob-cli mcp call search_activities '{"category":"bugfix"}'`

**Expected Time**: 30-60 minutes

### Option B: Test Cochange Integration Locally (ALTERNATIVE)
**Goal**: Prove cochange integration works without needing backend registration

**Steps**:
1. Run the test script we created: `test-cochange-template-direct.ts`
2. This directly loads templates from local storage (bypassing MCP)
3. Verify cochange predictions appear in template content
4. Capture execution trace to prove learning data flows correctly

**Expected Time**: 15-30 minutes

### Option C: Manual Backend Test (DIAGNOSTIC)
**Goal**: Understand what payload format backend expects

**Steps**:
1. Load fix-bug-complete.json from local storage
2. Send to `POST /v2/activities/templates` with curl
3. Check response for validation errors
4. Fix OpenCode's payload format conversion
5. Retry registration

**Expected Time**: 20-40 minutes

---

## Technical Details

### Environment Variable Solution
```typescript
// repos/metabob-opencode/packages/opencode/src/plugin/index.ts:42-44
const plugins = [...(config.plugin ?? [])]
if (!Flag.OPENCODE_DISABLE_DEFAULT_PLUGINS) {
  plugins.push("opencode-copilot-auth@0.0.5")
  plugins.push("opencode-anthropic-auth@0.0.2")  // ← This was failing
}
```

### Registration Flow
```
opencode CLI command
  ↓
TemplateLibrary.registerAllWithMetabob()
  ↓
TemplateLibrary.registerWithMetabob(template)
  ↓
TemplateRepository.save(template, ["metabob"])
  ↓
TemplateLoader.save(template, { backend: "metabob" })
  ↓
POST /v2/activities/templates
  ↓
❌ FAILING HERE (silently)
```

### Backend Endpoint
```bash
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Template Name",
    "description": "...",
    "category": "bugfix",
    "variables": {...},
    "tasks": [...]
  }'
```

### Available Endpoints
- ✅ `GET /v2/activities/templates` - List/search templates
- ✅ `POST /v2/activities/templates` - Create template
- ✅ `GET /v2/activities/templates/{id}` - Get template details
- ❌ `POST /v2/activity/template/register` - Does not exist (404)

---

## Files Modified (This Session)

### Created:
1. **`test-cochange-template-direct.ts`** - Direct template loading test (bypasses MCP)
2. **`SESSION_RESUME_FEB16_PM.md`** - This file

### No Code Changes:
- Template loading fix from previous session still working
- No new code modifications needed for auth bypass (used env variable)

---

## Commands to Run

### Test Registration (with auth bypass):
```bash
cd ~/documents/work/exp-repo/metabob-devbob
OPENCODE_DISABLE_DEFAULT_PLUGINS=1 opencode activity template register all
```

### Check Metabob Backend:
```bash
# Health check
curl http://localhost:8080/health

# List existing templates
curl http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer c2Vzc2lvbnM6YjRmZTY4NjAtNTU0My00M2ZkLTkwYzAtM2I1NzA0YmQ0ZWJhOmJvb3RzdHJhcC1vcmc6Ym9vdHN0cmFwLXVzZXI="
```

### Test Direct Template Loading:
```bash
cd ~/documents/work/exp-repo/metabob-devbob
bun run test-cochange-template-direct.ts
```

---

## Success Criteria (Updated)

- [x] Template loading fix applied and working ✅
- [x] Binary rebuilt with fix ✅
- [x] Templates exist in local storage (13 templates) ✅
- [x] Direct API tests pass ✅
- [x] Auth dependency bypassed ✅
- [ ] **Fix backend registration payload** ← NEXT
- [ ] **Register templates to backend** ← BLOCKED (payload format)
- [ ] **Activity tool execution** ← BLOCKED (needs registration)
- [ ] **Cochange predictions captured** ← BLOCKED (needs execution)

**Progress**: 5/9 complete (56%)

---

## Key Insight: Two Execution Paths

### Path 1: Local Template Execution (WORKING)
```typescript
// Direct API usage (no MCP)
import { TemplateRepository } from './repos/metabob-opencode/packages/opencode/src/session/template-repository.js'
const template = await TemplateRepository.get('fix-bug-complete', 'local') // ✅ WORKS
```

### Path 2: MCP Template Execution (BLOCKED)
```typescript
// Via MCP in session (routed to backend)
activity({ activityId: "fix-bug-complete", ... })
  ↓
MCP Tool Router
  ↓
Metabob Backend Query
  ↓
❌ Template not found (not registered)
```

**To Unblock Path 2**: Fix payload format → Register templates → Test via MCP

---

## Recommendation

**Start with Option A** (Fix Backend Registration):
- Unblocks the full integration
- Enables MCP-based template execution
- Allows distributed learning to work
- Estimated 30-60 min to completion

**Fallback to Option B** if Option A takes > 1 hour:
- Proves cochange integration works
- Provides demo-able result
- Doesn't require backend fix
- Can be completed quickly (15-30 min)

---

## Next Session Starter

```bash
cd ~/documents/work/exp-repo/metabob-devbob

# Option A: Debug backend registration
OPENCODE_DISABLE_DEFAULT_PLUGINS=1 opencode --log-level=DEBUG \
  activity template register one fix-bug-complete

# Check what was sent to backend:
tail -100 /home/avi/.local/share/opencode/log/$(ls -t /home/avi/.local/share/opencode/log/ | head -1) | \
  grep -A 20 "template.*save"

# Option B: Test direct loading
bun run test-cochange-template-direct.ts
```
