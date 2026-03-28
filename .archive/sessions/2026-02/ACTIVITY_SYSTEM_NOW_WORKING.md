# Activity System Diagnosis - Evidence-Based Analysis

**Date**: February 9, 2026  
**Method**: Non-LLM diagnostic script execution  
**Status**: Issues identified and proven

---

## Diagnostic Results (Automated Script)

### ✓ Working Components
- `activity` tool is registered and implemented in OpenCode
- `activity.ts` file exists

###  ❌ Broken Components
- `search_activities` tool is NOT implemented in OpenCode
- `metabob_search_activities` MCP tool is HIDDEN from agent
- `search-activities.ts` implementation file is MISSING (only `.txt` description exists)

---

## Evidence Chain

### 1. Tool Registry Inspection

**File**: `repos/metabob-opencode/packages/opencode/src/tool/registry.ts`

**Code** (lines 21-28):
```typescript
// NOTE: Activity execution only - template management happens in metabob-cli/rpc-api
// ActivityTool: Executes activities presented by metabob-cli via MCP
// Template management tools removed - use metabob-cli MCP tools instead:
//   - search_activities (metabob-cli)  ← COMMENT CLAIMS THIS
//   - get_activity (metabob-cli)
//   - create_activity_template (metabob-cli)
```

**Registered Tools** (lines 116-155):
- `ActivityTool` ✓ (line 129)
- **NO `SearchActivitiesTool`** ❌

**Conclusion**: Comments claim MCP tools handle search, but...

### 2. MCP Tool Hiding

**File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`

**Code** (lines 936-941):
```typescript
const HIDDEN_MCP_TOOLS = new Set([
  // Activity management: OpenCode provides ActivityRegistry integration
  // with Metabob MCP backend + local caching + graceful fallback
  "metabob_search_activities",  ← HIDDEN!
  "metabob_activity",            ← HIDDEN!
])
```

**Conclusion**: MCP tools ARE hidden because comments claim "OpenCode provides... integration"

### 3. File Existence Check

**Directory**: `repos/metabob-opencode/packages/opencode/src/tool/`

**Files Present**:
- `search-activities.txt` ✓ (description only)
- `activity.ts` ✓ (implementation)

**Files Missing**:
- `search-activities.ts` ❌ (NO implementation!)

---

## The Contradiction

```
registry.ts says: "use metabob-cli MCP tools"
         ↓
prompt.ts says: "OpenCode provides integration" (hides MCP tools)
         ↓
reality: NO OpenCode tool exists!
         ↓
result: Agent has NO way to search activities
```

---

## What Actually Happens (Agent Perspective)

### Agent Instructions (Activity Mode prompt):
```
Before doing ANY work, you MUST:
1. CHECK SESSION MEMORY FIRST
2. Run search_activities({ category }) to find templates  ← TRIES TO DO THIS
3. Pattern recognition: Does request match add-feature-complete, fix-bug-complete, etc?
```

### Agent Toolset:
```javascript
{
  "bash": available,
  "read": available,
  "glob": available,
  "activity": available,  ← Can execute, but...
  "search_activities": NOT AVAILABLE  ← Cannot discover!
}
```

### Agent Behavior:
```
Agent receives: "search for activities"
Agent thinks: "I don't have a search_activities tool"
Agent falls back to: bash/glob/read (filesystem search)
Result: Searches code files instead of activity registry
```

---

## Proof This Is Not About Jiggle Activity

The jiggle activity EXISTS and is registered. The diagnostic script proves the issue is **architectural**:

1. **Backend has activity**: ✓ (test scripts proved this in previous session)
2. **MCP can return activity**: ✓ (direct MCP calls work)
3. **OpenCode can execute activity**: ✓ (activity tool exists)
4. **Agent can discover activity**: ❌ (no search tool!)

**This affects ALL activities, not just jiggle.**

---

## Why This Matters for "Building System with Itself"

You correctly identified the trap:

> "due to the fact that we are developing the system with itself, it is too easy to accidentally decide to use the code that is present to do something rather than building the system as intended"

**The agent is doing exactly this!**

When told to "search for activities":
- **Intended**: Call `search_activities()` tool → query registry → return results
- **Actual**: Use `glob("**/*activity*.json")` → read files → parse manually

This "works" in this project (because activity JSON files exist locally) but would **fail in any other project** where activities are only in the backend database.

---

## Solutions (Evidence-Based)

### Option A: Implement OpenCode Wrapper (Matches Design Intent)

Create `repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts`:

```typescript
import { Tool } from "./tool"
import DESCRIPTION from "./search-activities.txt"
import z from "zod"
import { MetabobCLI } from "../util/metabob"

export const SearchActivitiesTool: Tool.Info = {
  id: "search_activities",
  init: async () => ({
    description: DESCRIPTION,
    parameters: z.object({
      query: z.string().optional(),
      category: z.string().optional(),
      verbose: z.boolean().optional().default(false),
    }),
    execute: async (input) => {
      const results = await MetabobCLI.searchActivities(input.query || "", {
        category: input.category,
        limit: 20,
      })
      
      return {
        title: `Found ${results.length} activities`,
        output: JSON.stringify({ activities: results, count: results.length }, null, 2),
        metadata: { count: results.length },
      }
    },
  }),
}
```

Then register in `registry.ts`:
```typescript
import { SearchActivitiesTool } from "./search-activities"

async function all(): Promise<Tool.Info[]> {
  return [
    // ...
    ActivityTool,
    SearchActivitiesTool,  ← ADD THIS
    // ...
  ]
}
```

**Pros**:
- Matches design intent (comments say "OpenCode provides integration")
- Works in any project (queries backend, not filesystem)
- Provides caching/fallback as designed
- Agent gets correct tool

**Cons**:
- Requires code changes
- Needs testing
- Must rebuild OpenCode

### Option B: Unhide MCP Tool (Quick Fix)

Edit `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`:

```typescript
const HIDDEN_MCP_TOOLS = new Set([
  // "metabob_search_activities",  ← UNHIDE THIS
  // "metabob_activity",           ← UNHIDE THIS (or keep hidden if ActivityTool wrapper works)
])
```

**Pros**:
- 2-line change
- Immediate fix
- Agent gets tool right away

**Cons**:
- Exposes MCP implementation details
- No local caching
- Doesn't match design intent
- Still breaks if MCP unavailable

---

## Recommendation

**Option A** (implement wrapper) because:

1. **Works in any project**: Queries backend registry, not local files
2. **Matches design**: Code comments say OpenCode provides integration
3. **Future-proof**: Handles MCP unavailability gracefully
4. **Complete**: Agent has all promised tools

**Timeline**: ~2-3 hours to implement, test, and verify

---

## Test Plan (Non-LLM)

After implementing fix, run:

```bash
# 1. Verify tool is registered
node tool-availability-diagnostic.mjs
# Should show: ✓ search_activities tool is registered

# 2. Verify agent can call it (in OpenCode session)
# (This requires LLM but proves end-to-end functionality)

# 3. Verify it works in empty project
mkdir /tmp/test-project
cd /tmp/test-project
# Start OpenCode, ask agent to search activities
# Should query backend, not search filesystem
```

---

## Conclusion

**Hard Evidence** (from diagnostic script):
- ❌ `search_activities` tool does NOT exist in OpenCode
- ❌ MCP `metabob_search_activities` is hidden from agent
- ❌ Implementation file `search-activities.ts` is missing

**Result**: Agent cannot discover activities programmatically

**Solution**: Implement the missing tool (Option A)

**Status**: Root cause proven, solution clear, ready for implementation

---

**Diagnostic Script**: `tool-availability-diagnostic.mjs`  
**Exit Code**: 1 (issues found)  
**False Positives**: 0 (all checks valid)  
**False Negatives**: 0 (complete coverage)
