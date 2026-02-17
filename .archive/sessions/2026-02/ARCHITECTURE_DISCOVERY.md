# Architecture Discovery - Why Local Templates Don't Work

**Date**: 2026-02-16 13:17
**Finding**: Critical architecture mismatch identified

## The Problem

OpenCode has **TWO SEPARATE** activity execution systems:

### System 1: Local OpenCode (What we fixed)
- **Tools**: `TemplateRepository.get()`, `TemplateRepository.list()`
- **Storage**: `~/.local/share/opencode/storage/activity-template/*.json`
- **Access**: Direct file system access via Storage API
- **Status**: ✅ **FIX WORKING** - Verified via direct API tests

### System 2: Metabob MCP (What sessions use)
- **Tools**: `metabob_search_activities`, `metabob_activity` (MCP protocol)
- **Storage**: Metabob RPC API backend database
- **Access**: HTTP requests to backend API
- **Status**: ❌ **OUR TEMPLATES NOT REGISTERED** in backend

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   OpenCode Session                           │
│                                                              │
│   User Request: activity({ activityId: "fix-bug-complete" })│
│                            ↓                                 │
│   ┌────────────────────────────────────────────────────┐    │
│   │         Tool Router                                 │    │
│   │  Checks: Which "activity" tool to use?            │    │
│   └──────────────┬─────────────────────────────────────┘    │
│                  │                                           │
│         ┌────────┴────────┐                                  │
│         │                 │                                  │
│    [MCP Available?]  [Local Only?]                           │
│         │                 │                                  │
│        YES               NO                                  │
│         │                 │                                  │
│         ↓                 ↓                                  │
│  ┌─────────────┐   ┌──────────────┐                         │
│  │ Metabob MCP │   │ Local OpenCode│                        │
│  │             │   │  activity tool│                        │
│  └──────┬──────┘   └───────┬──────┘                         │
│         │                  │                                 │
└─────────┼──────────────────┼─────────────────────────────────┘
          │                  │
          ↓                  ↓
┌──────────────────┐  ┌──────────────────┐
│ Metabob Backend  │  │ Local Storage    │
│   (HTTP API)     │  │  (File System)   │
│                  │  │                  │
│ ❌ fix-bug-      │  │ ✅ fix-bug-      │
│    complete      │  │    complete.json │
│    NOT HERE      │  │    EXISTS        │
└──────────────────┘  └──────────────────┘
```

## What Happens in Sessions

When a session is created with MCP tools available:

1. **Session initialization** detects Metabob MCP is configured
2. **Tool registration** prefers MCP tools over local tools
3. **Activity calls** route to `metabob_activity` (MCP) not local `activity` tool
4. **Template search** queries Metabob backend, NOT local storage
5. **Result**: Local templates are INVISIBLE to the session

## Why Our Fix Works (But Not Here)

The fix we applied removes bootstrap restrictions in:
- `TemplateLoader.load()` - Loads ANY template from local storage
- `TemplateLoader.list()` - Returns ALL templates from local storage

**These functions work perfectly** when called directly via:
```typescript
import { TemplateRepository } from "..."
const template = await TemplateRepository.get("fix-bug-complete", "local")
// ✅ SUCCESS - Template loads from ~/.local/share/opencode/storage/
```

**But sessions use MCP tools** which bypass this code entirely:
```typescript
// In session with MCP:
activity({ activityId: "fix-bug-complete", ... })
// Routes to: metabob_activity (MCP tool)
// Queries: Metabob backend API
// Result: ❌ Template not found (not registered in backend)
```

## The Registration Problem

To make local templates available in MCP-enabled sessions, we need to register them:

```bash
opencode activity template register all
```

**But this command fails** with dependency error:
```
Error: Cannot find module '@openauthjs/openauth/pkce'
```

This suggests Metabob backend authentication is broken or misconfigured.

## Solution Options

### Option A: Fix Metabob Backend Connection (BLOCKED)
**Status**: ❌ Blocked by auth dependency error
**What**: Register templates with `opencode activity template register all`
**Issue**: `@openauthjs/openauth/pkce` module missing

### Option B: Disable MCP in Session (POSSIBLE)
**Status**: ⚠️ Requires configuration change
**What**: Start session without MCP tools to force local-only mode
**How**: Modify `opencode.json` to disable MCP
**Downside**: Loses distributed learning capabilities

### Option C: Create Standalone Test (WORKING)
**Status**: ✅ Can implement now
**What**: Create script that directly uses TemplateRepository API
**How**: Import and call the fixed code directly
**Downside**: Not testing real session workflow

### Option D: Fix Auth Dependency (RECOMMENDED)
**Status**: 🔧 Needs investigation
**What**: Install or fix `@openauthjs/openauth` module
**How**: Check package.json, run install, or rebuild dependencies
**Benefit**: Unblocks template registration

## What We've Proven

✅ **Template loading fix WORKS** (verified via direct API tests)
✅ **Local storage has all templates** (13 templates including 3 cochange)
✅ **Binary contains fix** (strings search confirms log message present)
❌ **Sessions can't access local templates** (MCP routing issue)
❌ **Registration blocked** (auth module missing)

## Next Steps

**Immediate** (Option C - Standalone Test):
1. Create test script that imports TemplateRepository directly
2. Execute fix-bug-complete template programmatically
3. Verify cochange predictions work
4. Capture learning data locally

**Medium-term** (Option D - Fix Auth):
1. Investigate `@openauthjs/openauth/pkce` missing module
2. Check if it's a build/install issue
3. Fix dependency and retry registration
4. Test templates in session after registration

**Long-term** (Architecture):
1. Consider making local templates discoverable by MCP
2. Add fallback to local storage when backend unavailable
3. Document MCP vs local architecture for users

## Key Insight

**Our fix is correct and working**. The issue is NOT with the code we modified.

The issue is **architectural**: Sessions with MCP enabled route to Metabob backend, 
and we need to register our templates there. Registration is blocked by a missing 
auth dependency, not by our changes.

**Proof**: Direct API calls work perfectly. Only MCP-routed calls fail.
