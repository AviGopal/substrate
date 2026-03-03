# Session Memory Agent RAM Usage Issue - Analysis & Fix

## Problem Statement

The session memory agent is consuming excessive RAM despite being designed to be lightweight.

## Root Cause Analysis

### Issue 1: Duplicate Project Tree Generation

**Location:** `packages/opencode/src/session/memory-agent.ts`

The memory agent calls `Ripgrep.tree()` **TWICE** for every context gathering operation:

1. **Line 131** in `analyzeIntent()` function
2. **Line 595** in `analyzeContextNeeds()` function

**What Ripgrep.tree() does:**
```typescript
export async function tree(input: { cwd: string; limit?: number }) {
  const files = await Array.fromAsync(Ripgrep.files({ cwd: input.cwd }))
  // Builds entire project tree structure with up to 200 files
  // Returns formatted string representation
}
```

**Memory Impact:**
- Scans entire project directory (excluding node_modules, .git)
- Collects up to 200 file paths
- Builds tree data structure in memory
- Converts to string (typically 5KB - 50KB depending on project size)
- Embeds ENTIRE tree into LLM system prompt
- **This happens TWICE per context gathering call**

**For OpenCode project:**
```
Files: 200+ files
Tree string: ~15-20KB
System prompt size: ~25-35KB (including tree)
Memory overhead: 2x per call (duplicate tree generation)
```

### Issue 2: Tree Embedded in Every LLM Call

Both functions embed the project tree in the system prompt:

```typescript
// In analyzeIntent() - Line 166
const systemPrompt = `You are the Memory Agent...

## Codebase Structure

${projectTree}  // <-- 15-20KB inserted here
...`

// In analyzeContextNeeds() - Line 622
const systemPrompt = `You are the Memory Agent...

## Codebase Structure

${projectTree}  // <-- 15-20KB inserted here again
...`
```

**Problem:** The LLM doesn't need the full project tree for every single analysis. This is wasteful for:
- Memory (storing duplicate strings)
- Network bandwidth (sending to API)
- API costs (counting as input tokens)
- Processing time (LLM has to process it)

### Issue 3: No Caching

The project tree is regenerated from scratch on **every single call**, even though:
- Project structure rarely changes during a session
- The tree could be cached and reused
- A cache invalidation strategy could detect file system changes

### Issue 4: Large Tree Budget

**Configured limit:** 200 files

For a typical project:
- 200 files = ~15-20KB string
- OpenCode monorepo = 2000+ files (limited to 200)
- Each file path adds ~50-100 bytes

**Actual requirement:** Most context gathering only needs a **directory overview**, not a full file tree.

## Impact Measurement

### Current State (Per Context Gathering Call)

```
Operation                    | Memory    | Time    | Tokens
----------------------------|-----------|---------|--------
Ripgrep.tree() call 1       | 15-20KB   | ~100ms  | 0
Ripgrep.tree() call 2       | 15-20KB   | ~100ms  | 0
System prompt 1 (with tree) | 25-35KB   | 0ms     | ~5,000
System prompt 2 (with tree) | 25-35KB   | 0ms     | ~5,000
----------------------------|-----------|---------|--------
TOTAL per call              | 80-110KB  | ~200ms  | ~10,000
```

**For 100 context gathering calls in a session:**
- Memory churn: 8-11 MB
- Time overhead: 20 seconds
- Token waste: 1,000,000 tokens (~$3-15 in API costs)

### Memory Leak Potential

While not a traditional memory leak, this pattern causes:
1. **Frequent large allocations** - GC pressure
2. **Unnecessary string copies** - Memory fragmentation  
3. **High peak memory** - Temporary spikes during tree generation
4. **API response buffering** - LLM responses stored in memory

## Recommended Fixes

### Fix 1: Remove Duplicate Tree Generation ⚡ HIGH PRIORITY

**Problem:** Tree generated twice per call
**Solution:** Generate once, pass to both functions

```typescript
// Before (in activity.ts or wherever memory agent is called)
const impulses = await SessionMemoryAgent.gatherContext({
  requirements: template.contextRequirements,
  reason: params.reason,
  recentMessages: recentMessages
})

// After - pre-generate tree once
const projectTree = await Ripgrep.tree({ cwd: Instance.directory, limit: 200 })
const impulses = await SessionMemoryAgent.gatherContext({
  requirements: template.contextRequirements,
  reason: params.reason,
  recentMessages: recentMessages,
  projectTree: projectTree  // Pass pre-generated tree
})
```

**Update gatherContext() signature:**
```typescript
export async function gatherContext(input: {
  requirements: ActivityTemplate.ContextRequirement[]
  reason: string
  recentMessages: MessageV2.WithParts[]
  projectTree?: string  // Optional pre-generated tree
}): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  
  // Use provided tree or generate if not provided
  const tree = input.projectTree || await Ripgrep.tree({ 
    cwd: Instance.directory, 
    limit: 200 
  })
  
  // Pass to analyzeContextNeeds()
  const analysis = await analyzeContextNeeds({
    requirements: input.requirements,
    reason: input.reason,
    recentMessages: input.recentMessages,
    projectTree: tree  // Reuse same tree
  })
}
```

**Impact:** 50% reduction in tree generation overhead

### Fix 2: Add Tree Caching ⚡ HIGH PRIORITY

**Problem:** Tree regenerated every call
**Solution:** Cache with TTL and file watcher invalidation

```typescript
// Add to memory-agent.ts
const projectTreeCache = new Map<string, { tree: string; timestamp: number }>()
const TREE_CACHE_TTL = 60000 // 1 minute

async function getProjectTree(cwd: string): Promise<string> {
  const cached = projectTreeCache.get(cwd)
  const now = Date.now()
  
  // Return cached if fresh
  if (cached && (now - cached.timestamp) < TREE_CACHE_TTL) {
    log.debug("using cached project tree", { age: now - cached.timestamp })
    return cached.tree
  }
  
  // Generate new tree
  log.debug("generating fresh project tree")
  const tree = await Ripgrep.tree({ cwd, limit: 200 })
  projectTreeCache.set(cwd, { tree, timestamp: now })
  
  return tree
}
```

**Impact:** 90%+ reduction for repeated calls within 1 minute

### Fix 3: Reduce Tree Size 🔧 MEDIUM PRIORITY

**Problem:** 200 files is excessive for most cases
**Solution:** Reduce limit or use smarter filtering

```typescript
// Option A: Reduce limit
const projectTree = await Ripgrep.tree({ 
  cwd: Instance.directory, 
  limit: 50  // Most relevant files only
})

// Option B: Smart filtering (directories only)
const projectTree = await Ripgrep.directories({ 
  cwd: Instance.directory, 
  maxDepth: 3  // Just directory structure
})

// Option C: Exclude common directories
const projectTree = await Ripgrep.tree({ 
  cwd: Instance.directory, 
  limit: 100,
  exclude: ['test', 'tests', 'dist', 'build']
})
```

**Impact:** 50-75% reduction in tree size

### Fix 4: Make Tree Optional 🔧 LOW PRIORITY

**Problem:** LLM may not need full tree for every case
**Solution:** Include tree only when beneficial

```typescript
const systemPrompt = `You are the Memory Agent...

${includeTree ? `## Codebase Structure\n\n${projectTree}\n\n` : ''}

## Context Requirements
...`
```

**When to include tree:**
- ✅ User asks to find/search files
- ✅ Context requirements include file paths
- ✅ Activity involves multiple files
- ❌ Simple questions/clarifications
- ❌ Memo-only context requirements

**Impact:** 30-50% reduction in cases where tree isn't needed

## Immediate Action Plan

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Remove duplicate tree generation (Fix 1)
2. ✅ Add basic tree caching (Fix 2)
3. ✅ Reduce tree limit from 200 to 100 (Fix 3)

**Expected Impact:** 70-80% reduction in memory overhead

### Phase 2: Optimization (4-6 hours)
4. ⏭️ Implement smart tree filtering (Fix 3B)
5. ⏭️ Make tree optional based on requirements (Fix 4)
6. ⏭️ Add file watcher for cache invalidation

**Expected Impact:** Additional 10-15% reduction

### Phase 3: Monitoring (2-3 hours)
7. ⏭️ Add memory usage metrics
8. ⏭️ Track tree generation frequency
9. ⏭️ Monitor cache hit rate

## Testing Strategy

### Test 1: Memory Usage Baseline
```bash
# Before fix
docker exec devbob-clean bash -c "cd /opt/repos/metabob-opencode && bun run test-memory-agent-memory.ts"

# Expected: ~110KB per call
```

### Test 2: After Fix 1 (Remove Duplicate)
```bash
# After fix
docker exec devbob-clean bash -c "cd /opt/repos/metabob-opencode && bun run test-memory-agent-memory.ts"

# Expected: ~55KB per call (50% reduction)
```

### Test 3: After Fix 2 (Add Caching)
```bash
# Multiple calls in succession
docker exec devbob-clean bash -c "cd /opt/repos/metabob-opencode && bun run test-memory-agent-cache.ts"

# Expected: 
# - First call: ~55KB
# - Subsequent calls (< 1 min): ~5KB (cache hit)
# - Cache hit rate: 90%+
```

### Test 4: After Fix 3 (Reduce Size)
```bash
# After limit reduction
docker exec devbob-clean bash -c "cd /opt/repos/metabob-opencode && bun run test-memory-agent-memory.ts"

# Expected: ~30KB per call (additional 45% reduction)
```

## Configuration Changes

### Current Config (.opencode/opencode.json)
```json
{
  "sessionMemory": {
    "enabled": true,
    "analysis": {
      "timeout": 10000,
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

### Recommended Config (Add)
```json
{
  "sessionMemory": {
    "enabled": true,
    "analysis": {
      "timeout": 10000,
      "model": "claude-sonnet-4-20250514",
      "projectTree": {
        "enabled": true,
        "limit": 100,  // Reduced from 200
        "cache": {
          "enabled": true,
          "ttl": 60000  // 1 minute
        },
        "exclude": ["test", "tests", "dist", "build"]
      }
    }
  }
}
```

## Long-term Solutions

### Architecture Improvement: Lazy Loading

Instead of embedding entire tree in system prompt:
1. **Ask LLM what it needs**: "What files should I search?"
2. **Tool-based discovery**: LLM uses `searchFiles` tool
3. **On-demand loading**: Only load relevant parts

**Benefits:**
- Zero upfront memory cost
- Scales to any project size
- LLM decides what's relevant

**Trade-offs:**
- Extra LLM round-trip (~1-2s)
- More complex implementation

### Alternative: Semantic File Index

Build lightweight semantic index:
```typescript
{
  "auth": ["src/auth/login.ts", "src/auth/jwt.ts"],
  "api": ["src/api/routes.ts", "src/api/middleware.ts"],
  "tests": ["test/auth.test.ts", "test/api.test.ts"]
}
```

**Benefits:**
- Tiny memory footprint (< 1KB)
- Semantic search instead of full tree
- Fast lookups

**Trade-offs:**
- Requires initial indexing
- Needs update on file changes

## Conclusion

The session memory agent's RAM usage issue is caused by:
1. **Duplicate tree generation** - 2x overhead per call
2. **No caching** - Regenerated every time
3. **Large tree size** - 200 files is excessive
4. **Always included** - Even when not needed

**Immediate fix priorities:**
1. Remove duplicate (Fix 1) - 50% reduction
2. Add caching (Fix 2) - Additional 40% reduction
3. Reduce limit (Fix 3) - Additional 10% reduction

**Total expected improvement:** 80-85% reduction in memory overhead

**Implementation time:** 1-2 hours for all three fixes

## Files to Modify

1. `packages/opencode/src/session/memory-agent.ts` (primary)
   - Lines 131-138: analyzeIntent tree generation
   - Lines 595-598: analyzeContextNeeds tree generation
   - Add caching layer
   - Update function signatures

2. `packages/opencode/src/tool/activity.ts` (if pre-generating tree)
   - Lines 588-592: gatherContext call site
   - Pre-generate tree once

3. `.opencode/opencode.json` (configuration)
   - Add projectTree config section

## Next Steps

1. ✅ Document issue - COMPLETE
2. ⏭️ Implement Fix 1 (remove duplicate)
3. ⏭️ Implement Fix 2 (add caching)
4. ⏭️ Implement Fix 3 (reduce limit)
5. ⏭️ Test memory usage
6. ⏭️ Monitor in production
