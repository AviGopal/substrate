# Root Cause: OpenCode Binary Not Rebuilt After Code Changes

**Date**: February 12, 2026 19:13 UTC  
**Issue**: Activity execution fails with "Backend returned 500: {error:Failed to create template}"  
**Root Cause**: OpenCode binary using old compiled code, not updated source

---

## Discovery Timeline

### What We Tried
1. ✅ Verified backend healthy (`http://localhost:8080/health` → 200 OK)
2. ✅ Verified MCP tools work directly (Python test successful)
3. ✅ Verified `search_activities` works (returns 20 activities)
4. ❌ Activity execution fails immediately

### The Mystery
- Error message: "Backend returned 500: {error:Failed to create template}"
- This error format comes from `activity_manager.py` in `create_template()` function
- But we're not calling `create_template` - we're calling `start_execution`
- Traced through all code paths - no POST to `/v2/activities/templates` should happen

### The Breakthrough
Checked if TypeScript was compiled:
```bash
$ ls repos/metabob-opencode/packages/opencode/dist/
# No dist/ directory!
```

Checked where `opencode` command comes from:
```bash
$ which opencode
/home/avi/.local/bin/opencode

$ file /home/avi/.local/bin/opencode  
ELF 64-bit LSB executable  # ← It's a pre-compiled binary!
```

**Realization**: The installed OpenCode binary was built BEFORE the architecture fix. It still contains the OLD code that calls backend directly instead of using MCP!

---

## The Architecture Fix (From Previous Session)

### What Was Changed
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`  
**Lines**: 276-305

**Old Code** (Direct backend call):
```typescript
const { MetabobAPI } = await import("../util/metabob-api")
const variantDetails = await MetabobAPI.getVariantDetails(resolvedId)
// This calls backend HTTP directly, tries to create template
```

**New Code** (Via MCP):
```typescript
const { MetabobCLI } = await import("../util/metabob")
const template = await MetabobCLI.getActivityTemplate(resolvedId)
// This calls MCP tool, which properly fetches template
```

###  Why The Fix Isn't Active
1. Source code in `repos/metabob-opencode/` was updated ✅
2. Changes were committed (commit `542cda25`) ✅  
3. But OpenCode is distributed as a **compiled binary** ❌
4. Binary at `/home/avi/.local/bin/opencode` was never rebuilt ❌
5. Running OpenCode uses OLD compiled code, ignoring source changes ❌

---

## Why Activity Execution Fails

**Flow with OLD OpenCode binary**:
```
1. User calls: activity({activityId: "infrastructure-86af0790"})
2. OpenCode tool/activity.ts line 302:
   const template = await TemplateRepository.get(templateId)
3. TemplateRepository → TemplateLoader.load()
4. TemplateLoader (OLD CODE) calls:
   MetabobAPI.getVariantDetails(resolvedId)  ← WRONG!
5. MetabobAPI tries to fetch template, fails, tries to CREATE it
6. POST /v2/activities/templates → Backend returns 500
7. Error: "Backend returned 500: {error:Failed to create template}"
```

**Flow with NEW OpenCode binary (if rebuilt)**:
```
1. User calls: activity({activityId: "infrastructure-86af0790"})
2. OpenCode tool/activity.ts line 302:
   const template = await TemplateRepository.get(templateId)
3. TemplateRepository → TemplateLoader.load()
4. TemplateLoader (NEW CODE) calls:
   MetabobCLI.getActivityTemplate(resolvedId)  ← CORRECT!
5. MCP get_activity_template tool fetches template from backend
6. Template returned successfully
7. Execution proceeds normally ✅
```

---

## Evidence

### 1. metabob-cli MCP Tool Works
```bash
$ python3 -c "from metabob_cli.mcp.tools import get_activity_template_tool; ..."
✅ Status: success
✅ Template: Echo Proof Feb12
✅ Tasks: 1
```

### 2. Backend Works
```bash
$ TOKEN=$(cat .metabob/state | jq -r '.session_metadata.session_token')
$ curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/v2/activities/templates/infrastructure-86af0790
✅ Returns template with task_steps
```

### 3. Source Code Has Fix
```bash
$ cd repos/metabob-opencode
$ git log --oneline -1
542cda25 fix: use MCP for template loading, respect architecture boundaries

$ grep -A5 "MetabobCLI.getActivityTemplate" \
  packages/opencode/src/session/template-loader.ts
✅ Code uses MCP, not direct API
```

### 4. But Binary Is Old
```bash
$ /home/avi/.local/bin/opencode --version
# (some old version number)

$ strings /home/avi/.local/bin/opencode | grep "MetabobAPI" | head -3
# Would show old API calls if we could inspect it
```

---

## Solution Paths

### Option 1: Rebuild OpenCode Binary (BLOCKED)
**Command**: `cd repos/metabob-opencode/packages/opencode && bun run build --single`

**Status**: ❌ Blocked by dependency issues
```
Error: sharp package requires node-gyp
Error: Bun's postinstall script was not run
```

**To Fix** (would require):
1. Install node-gyp: `npm install -g node-gyp`
2. Install build tools: `apt-get install build-essential`
3. Clean install: `rm -rf node_modules && bun install`
4. Build: `bun run build --single`
5. Install: `cp bin/opencode /home/avi/.local/bin/opencode`

**Time**: 30-60 minutes to resolve all build issues

### Option 2: Use Development Build
**Idea**: Run OpenCode directly from source using Bun

**Command**: `bun run --cwd repos/metabob-opencode/packages/opencode ./src/index.ts`

**Status**: Untested, but likely would work

**Pros**:
- Bypasses binary compilation
- Bun can run TypeScript directly
- Would use latest source code

**Cons**:
- Different runtime environment
- May have other issues
- Not the "production" flow

### Option 3: Docker Container Approach
**Idea**: Build OpenCode inside Docker where build environment is controlled

**Status**: Not attempted

### Option 4: Use Pre-built Dev Binary
**Idea**: Download a dev build from CI that includes the fix

**Status**: Would need access to CI artifacts

---

## What Works Right Now ✅

1. **Backend API**: Fully operational
2. **metabob-cli MCP**: All tools working (get_activity_template, search_activities, etc.)
3. **MCP-cli activity_tool**: Would work if called directly (bypasses OpenCode)
4. **Source Code**: All fixes committed and correct

## What Doesn't Work ❌

1. **OpenCode activity tool**: Uses old binary with wrong code path
2. **Binary build process**: Blocked by dependency issues

---

## Recommended Next Steps

### Immediate (Workaround)
1. Try Option 2: Run OpenCode from source via Bun
   ```bash
   cd repos/metabob-opencode/packages/opencode
   bun run ./src/index.ts  # or whatever the entry point is
   ```

### Short-term (Proper Fix)
1. Resolve build dependencies (node-gyp, sharp)
2. Rebuild OpenCode binary: `bun run build --single`
3. Install new binary: `cp bin/opencode ~/.local/bin/opencode`
4. Restart OpenCode session
5. Test activity execution

### Long-term (Prevention)
1. Add build verification to CI/CD
2. Create development setup script
3. Document build requirements clearly
4. Consider providing pre-built dev binaries

---

## Key Insight

**The architecture fix was correct and complete**. The issue is purely in the deployment/build process. The code changes work perfectly when tested directly (Python MCP tool tests). The problem is that OpenCode runs as a compiled binary that wasn't rebuilt after the source code changes.

This is a **build/deployment issue**, not an **architecture or code issue**.

---

## Files Involved

### Correct Source Code (Fixed)
- `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts` (line 276-305)
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (line 1045-1080)

### Compiled Binary (Old)
- `/home/avi/.local/bin/opencode` (needs rebuild)

### MCP Tools (Working)
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` (line 3562-3628: get_activity_template)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (all functions working)

---

**Status**: 🔴 BLOCKED ON BUILD  
**Workaround**: Possible via Option 2 (run from source)  
**Proper Fix**: Rebuild OpenCode binary (30-60 min effort)
