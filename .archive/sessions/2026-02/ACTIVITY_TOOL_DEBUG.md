# Activity Tool Debug Report - ROOT CAUSE FOUND

**Date**: February 9, 2026  
**Issue**: Agent not using activity tool, even though instructed to  
**Status**: ✅ ROOT CAUSE IDENTIFIED

## Root Cause

### The Problem
Looking at the user's conversation transcript, the agent:
1. ✅ Correctly checks session memory first
2. ✅ Tries to search for activities
3. ❌ **BUT** uses bash/read/glob tools instead of the `activity()` tool
4. ❌ Never actually calls `activity({ activityId: "...", ... })`

### Why This Happens

**The `search_activities` tool is missing!**

**File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`

```typescript
// Lines 580-591 (approx)
const HIDDEN_MCP_TOOLS = new Set([
  "metabob_search_activities",  // ❌ HIDDEN from agent
  "metabob_activity",           // ❌ HIDDEN from agent  
])
```

The MCP tools are hidden because OpenCode is supposed to provide wrappers, BUT:

```bash
$ ls packages/opencode/src/tool/ | grep search
search-activities.txt  ← Description only, NO .ts implementation!
```

**Result**: Agent has NO way to programmatically discover activities!

## Why Agent Uses bash/read/glob

Since the agent doesn't have a `search_activities` tool, when instructed to:
> "search for activities"

It interprets this as:
> "search the filesystem for activity files"

And uses the tools it DOES have:
- `glob` - to find files matching patterns
- `read` - to read file contents  
- `bash` - to run commands

**This is logical behavior given the available tools**, but not what we want!

## Solution Options

### Option 1: Create search-activities Tool (Recommended)

Create `packages/opencode/src/tool/search-activities.ts` that wraps TemplateRepository.list()

**Pros**:
- ✅ Matches design intent
- ✅ Works with existing TemplateRepository
- ✅ Provides local caching + graceful fallback
- ✅ Clear separation: search vs execute

### Option 2: Unhide MCP Tools (Quick Fix)

Remove `"metabob_search_activities"` from HIDDEN_MCP_TOOLS

**Pros**:
- Quick fix (2-line change)
- Agent can immediately use MCP tools

**Cons**:
- Exposes MCP implementation details
- No local caching
- No graceful fallback

### Option 3: Update Activity Tool to Include Search

Extend `activity.ts` to handle both search and execution

**Pros**:
- Single tool for all activity operations

**Cons**:
- Overloaded tool (does multiple things)
- Less clear in prompts

## Recommended Action

**Option 1: Create search-activities tool**

**Implementation Steps**:
1. Create `packages/opencode/src/tool/search-activities.ts`
2. Register tool in tool registry  
3. Test with agent session
4. Verify MCP tools remain hidden (OpenCode wrapper works)

## Current Workaround (For User)

### Direct Execution (If Activity ID Known)
```typescript
activity({
  activityId: "jiggle-documentation",  // Or "refactor-251a3ca8"
  variables: {
    mode: "dryRun",
    scope: "all"
  },
  reason: "Test documentation jiggle activity"
})
```

The agent's current behavior (using bash/glob/read) actually works for discovery, just not ideal.

---

**Status**: ✅ ROOT CAUSE IDENTIFIED  
**Solution**: Implement search-activities.ts tool  
**Timeline**: ~2-3 hours to implement and test  
**Priority**: High (blocks activity system usability)
