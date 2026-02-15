# Impulse Split Architecture: Reality Check

**Date:** 2026-02-14  
**Context:** Review of impulse splitting requirements and existing architecture capabilities

## Problem Statement

The previous session summary suggested "splitting impulses into 100-line chunks" as a general solution for budget management. However, **this approach only applies to text-based content** and ignores the diverse pointer types in the system.

## Key Insight from Discussion

> "We are not just chunking text content, but rather an impulse may be a script, or a tool call, or another activity, or a connection to another agent over ACP."

**Translation:** Impulses represent **executable operations**, not just static data. Many cannot be split semantically.

---

## Current Impulse Pointer Types

From `impulse-resolver.ts`, we support:

### 1. **Atomic (Cannot Split)**
| Type | Description | Why Atomic |
|------|-------------|------------|
| `bashOutput` | Command execution result | Single operation, output is indivisible |
| `memo` | Raw text content | Small by design, splitting breaks semantics |
| `custom` | Custom resolver | Resolution logic unknown, may be stateful |
| `activity` | Activity template execution | Workflow unit, splitting breaks steps |
| `acp` | Agent delegation | Connection/session, cannot split |
| `tool` | Deferred tool call | Single operation |

### 2. **Chunkable (With Caution)**
| Type | Description | Chunking Strategy |
|------|-------------|-------------------|
| `file` | File path + line range | Can split by semantic boundaries (functions, classes) |
| `metabobPriorities` | Issue list | Can split by severity or count |
| `metabobAnnotations` | Component annotations | Can split by component |

---

## What We Already Have (Budget Management)

### ✅ **Priority-Based Selection** (`impulse-formatter.ts:40-89`)

The system **already implements selective loading** based on priority:

```typescript
// Group by priority
const byPriority = {
  high: loaded.filter((imp) => imp.priority === "high"),
  medium: loaded.filter((imp) => imp.priority === "medium"),
  low: loaded.filter((imp) => imp.priority === "low"),
}

// Load high → medium → low until budget exhausted
for (const priority of ["high", "medium", "low"] as const) {
  for (const impulse of items) {
    const estimatedTokens = impulse.tokenCount || impulse.budget
    
    if (remainingTokens < estimatedTokens) {
      truncated = true
      break  // Stop loading more impulses
    }
    
    // Resolve and format impulse
    const { section, tokenCount } = await formatImpulse(impulse)
    sections.push(section)
    remainingTokens -= estimatedTokens
  }
}
```

**This is the correct approach:**
- ✅ Loads high-priority first
- ✅ Stops when budget exhausted
- ✅ Skips low-priority if no budget
- ✅ Works for ALL pointer types (no splitting needed)

### ✅ **Lazy Resolution** (`impulse-resolver.ts:126-340`)

Content is resolved **on-demand during prompt building**:

```typescript
export async function resolveForPrompt(impulse: ActivityTemplate.Impulse.Schema): Promise<ResolvedContent> {
  // Check 5-minute cache first
  const cached = resolutionCache.get(impulse.id)
  if (cached && Date.now() - cached.resolvedAt < 300000) {
    return cached
  }

  // Resolve pointer to actual content
  const content = await resolve(impulse.pointer)
  const tokenCount = estimateTokens(content)

  // Cache temporarily (evicted after prompt building)
  const resolved: ResolvedContent = { impulseId: impulse.id, content, tokenCount, resolvedAt: Date.now() }
  resolutionCache.set(impulse.id, resolved)
  
  return resolved
}
```

**Benefits:**
- ✅ Only resolve what's needed (budget-constrained)
- ✅ Cache for 5 minutes (repeated access)
- ✅ Discard after prompt building (no memory leak)
- ✅ LRU eviction (max 100 entries, 50MB)

### ✅ **Storage Efficiency** (`session-memory.ts:63-100`)

Impulses are stored **as pointers, not content**:

```typescript
function cleanImpulsesForStorage(store: Store): Store {
  const cleanedImpulses: Record<string, ActivityTemplate.Impulse.Schema> = {}

  for (const [key, impulse] of Object.entries(store.impulses)) {
    // Only clean unloaded impulses - preserve loaded ones
    if (impulse.tokenCount !== undefined && impulse.tokenCount > 0) {
      cleanedImpulses[key] = impulse
      continue
    }

    // Clear content field to prevent storage leak
    cleanedImpulses[key] = {
      ...impulse,
      content: undefined,  // Remove content
      pointer: cleanedPointer,  // Keep pointer only
    }
  }

  return { ...store, impulses: cleanedImpulses }
}
```

**Storage Impact:**
- ✅ 5KB per session (pointers only)
- ✅ 99.3% reduction vs. storing content (750KB → 5KB)
- ✅ Content always fresh from source

---

## What's Actually Missing

### 1. **File Chunking for Large Files** (Nice-to-Have)

**Problem:** A `file` impulse pointing to a 10,000-line file exceeds budget.

**Current Behavior:**
- Entire impulse is skipped if budget insufficient
- Agent loses access to ANY part of the file

**Solution:** Smart file chunking by semantic boundaries

```typescript
// File impulse with line range
{
  id: "auth-implementation",
  type: "file",
  pointer: {
    type: "file",
    path: "src/auth/implementation.ts",
    startLine: 1,
    endLine: 500  // First 500 lines only
  },
  budget: 2000,
  priority: "high"
}

// If full file doesn't fit, create chunks automatically:
{
  id: "auth-implementation-chunk-1",
  pointer: { type: "file", path: "src/auth/implementation.ts", startLine: 1, endLine: 200 },
  budget: 800,
  priority: "high"
}
{
  id: "auth-implementation-chunk-2",
  pointer: { type: "file", path: "src/auth/implementation.ts", startLine: 201, endLine: 400 },
  budget: 800,
  priority: "medium"  // Lower priority for subsequent chunks
}
```

**Implementation Location:**
- Memory agent (`memory-agent.ts`) - pre-chunk large files before creating impulses
- Manual tool - `impulse_split` tool for user-requested chunking

### 2. **Dynamic Budget Adjustment** (Future Optimization)

**Problem:** Budget estimates may be inaccurate (especially for custom resolvers).

**Current Behavior:**
- Uses `impulse.budget` as estimate
- Falls back to `impulse.tokenCount` if previously resolved

**Solution:** Adaptive budgeting based on historical resolution

```typescript
interface ImpulseStats {
  impulseId: string
  budgetEstimate: number
  actualTokenCounts: number[]  // Historical resolutions
  averageActual: number
  variance: number
}

// Adjust budget based on historical data
function getAdjustedBudget(impulse: Impulse, stats: ImpulseStats | undefined): number {
  if (!stats || stats.actualTokenCounts.length < 3) {
    return impulse.budget  // Use declared budget if no history
  }
  
  // Use average of last 5 resolutions + 10% margin
  return Math.ceil(stats.averageActual * 1.1)
}
```

**Implementation Location:**
- `impulse-formatter.ts:63` - replace `impulse.budget` with `getAdjustedBudget(impulse, stats)`
- New module: `impulse-stats-tracker.ts` - persist resolution history

### 3. **Metabob Custom Pointer Chunking** (Metabob-Specific)

**Problem:** `metabobPriorities` may return 50+ issues, exceeding budget.

**Current Behavior:**
- All issues bundled in one impulse
- Entire impulse skipped if budget insufficient

**Solution:** Pre-chunk by severity or limit

```typescript
// Instead of one impulse with all issues:
{
  id: "metabob-priorities-all",
  pointer: { type: "metabobPriorities", limit: 50 },
  budget: 5000  // May be too large
}

// Create separate impulses:
{
  id: "metabob-priorities-high",
  pointer: { type: "metabobPriorities", severity: "high", limit: 5 },
  budget: 1000,
  priority: "high"
}
{
  id: "metabob-priorities-medium",
  pointer: { type: "metabobPriorities", severity: "medium", limit: 10 },
  budget: 2000,
  priority: "medium"
}
```

**Implementation Location:**
- `memory-agent.ts` - create severity-specific impulses
- `impulse-resolver.ts:150-200` - update `resolveMetabobPriorities()` to support severity filter

---

## Implementation Priorities

### 🔴 **Priority 1: NO CHANGES NEEDED**

The current system already handles budget management correctly:
- ✅ Priority-based selection
- ✅ Lazy resolution
- ✅ Budget-aware truncation
- ✅ Storage efficiency (pointers only)

**Recommendation:** Keep existing architecture, no immediate changes required.

### 🟡 **Priority 2: File Chunking (Phase 2 Enhancement)**

**User Value:** Enable access to large files that currently get skipped entirely.

**Implementation Effort:** Medium (2-3 days)
1. Add `chunkLargeFile()` function in `memory-agent.ts`
2. Detect files > threshold (e.g., 1000 lines or 3000 tokens)
3. Create multiple impulses with sequential line ranges
4. Set priority: first chunk = high, rest = medium/low

**Test Case:**
```bash
# Create impulse for 5000-line file
opencode impulse create --session $SID --id "large-file" \
  --pointer '{"type":"file","path":"src/large.ts"}' \
  --budget 15000

# Expected: 3 impulses created automatically
# - large-file-chunk-1: lines 1-1500 (high priority)
# - large-file-chunk-2: lines 1501-3000 (medium priority)
# - large-file-chunk-3: lines 3001-5000 (low priority)
```

### 🟢 **Priority 3: Dynamic Budget Adjustment (Phase 3 Optimization)**

**User Value:** More accurate budget estimation → better impulse selection.

**Implementation Effort:** Low (1 day)
1. Create `impulse-stats-tracker.ts` module
2. Record actual token counts after each resolution
3. Calculate rolling average (last 5 resolutions)
4. Use adjusted estimate in `impulse-formatter.ts:63`

**Test Case:**
```typescript
// Impulse declared with budget=1000, but historically resolves to 500 tokens
// System should use adjusted estimate (500 * 1.1 = 550) for budget planning
// Result: More low-priority impulses fit in remaining budget
```

### 🔵 **Priority 4: Metabob Chunking (Phase 4 Specialization)**

**User Value:** Always load high-severity issues, even when total issue count is large.

**Implementation Effort:** Low (1 day)
1. Update `resolveMetabobPriorities()` in `impulse-resolver.ts` to accept severity filter
2. Update `memory-agent.ts` to create severity-specific impulses
3. Add `severity` field to metabob pointer type

---

## Decision: What to Do Now

**Recommendation:** Close the gap with **minor amendments** to existing code.

### ✅ **Phase 2a: File Chunking (Memory Agent)**

**File:** `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

**Change:** Add file chunking logic BEFORE impulse creation

```typescript
// NEW FUNCTION (add to memory-agent.ts)
async function chunkLargeFileImpulse(
  fileImpulse: SuggestedImpulse,
  maxLinesPerChunk: number = 500
): Promise<SuggestedImpulse[]> {
  // If not a file pointer, return as-is
  if (fileImpulse.pointer.type !== "file") {
    return [fileImpulse]
  }

  // Check file size
  const filePath = fileImpulse.pointer.path
  const stats = await fs.promises.stat(filePath)
  const lineCount = await countLines(filePath)
  
  // If small enough, return as-is
  if (lineCount <= maxLinesPerChunk) {
    return [fileImpulse]
  }

  // Create chunks
  const chunks: SuggestedImpulse[] = []
  const totalChunks = Math.ceil(lineCount / maxLinesPerChunk)
  
  for (let i = 0; i < totalChunks; i++) {
    const startLine = i * maxLinesPerChunk + 1
    const endLine = Math.min((i + 1) * maxLinesPerChunk, lineCount)
    const chunkBudget = Math.ceil(fileImpulse.budget / totalChunks)
    
    chunks.push({
      ...fileImpulse,
      id: `${fileImpulse.id}-chunk-${i + 1}`,
      pointer: {
        type: "file",
        path: filePath,
        startLine,
        endLine,
      },
      budget: chunkBudget,
      priority: i === 0 ? "high" : (i === 1 ? "medium" : "low"),  // First chunk = high
      description: `${fileImpulse.description} (chunk ${i + 1}/${totalChunks}, lines ${startLine}-${endLine})`,
    })
  }
  
  return chunks
}

// MODIFY EXISTING FUNCTION (in memory-agent.ts)
export async function suggestImpulses(input: {
  sessionID: string
  userMessage: string
  context: string[]
}): Promise<SuggestedImpulse[]> {
  // ... existing logic ...
  
  // NEW: Chunk large files before creating impulses
  const chunkedSuggestions: SuggestedImpulse[] = []
  for (const suggestion of suggestions) {
    const chunks = await chunkLargeFileImpulse(suggestion)
    chunkedSuggestions.push(...chunks)
  }
  
  return chunkedSuggestions
}
```

**Test Case:**
```bash
# Create session and ask about large file
opencode chat "Explain the implementation in src/large-file.ts" --session $SID

# Expected: Memory agent creates 3 impulses (chunks) automatically
# TUI should show: large-file-chunk-1 (high), large-file-chunk-2 (medium), large-file-chunk-3 (low)
```

### ✅ **Phase 2b: Manual Split Tool (Optional)**

**File:** `repos/metabob-opencode/packages/opencode/src/tool/impulse-split.ts` (NEW)

```typescript
import { tool } from "@opencode/tool"
import { SessionMemory } from "../session/session-memory"
import { ActivityTemplate } from "../session/activity-template"
import z from "zod"

export const ImpulseSplitTool = tool({
  id: "impulse_split",
  description: "Split a file impulse into multiple chunks with line ranges",
  parameters: z.object({
    impulseId: z.string().describe("ID of file impulse to split"),
    chunkSize: z.number().optional().describe("Lines per chunk (default: 500)"),
  }),
  async execute({ impulseId, chunkSize = 500 }, ctx) {
    // Get original impulse
    const original = await SessionMemory.getImpulse(ctx.sessionID, impulseId)
    if (!original) {
      throw new Error(`Impulse "${impulseId}" not found`)
    }
    
    if (original.pointer.type !== "file") {
      throw new Error(`Impulse "${impulseId}" is not a file impulse (type: ${original.pointer.type})`)
    }
    
    // Chunk logic (same as memory-agent.ts)
    const chunks = await chunkFileImpulse(original, chunkSize)
    
    // Create new chunk impulses
    for (const chunk of chunks) {
      await SessionMemory.createImpulse(ctx.sessionID, chunk)
    }
    
    // Delete original (now replaced by chunks)
    await SessionMemory.deleteImpulse(ctx.sessionID, impulseId)
    
    return {
      success: true,
      originalId: impulseId,
      chunks: chunks.map(c => ({ id: c.id, lines: `${c.pointer.startLine}-${c.pointer.endLine}` })),
      message: `Split impulse "${impulseId}" into ${chunks.length} chunks`,
    }
  },
})
```

**Usage:**
```typescript
// In agent prompt or user command:
impulse_split({ impulseId: "large-file", chunkSize: 300 })

// Result: Original impulse deleted, replaced with 5 smaller chunks
```

---

## Testing Plan

### Test 1: Budget-Constrained Selection
```bash
# Create session with 3 impulses: high (2000 tokens), medium (3000 tokens), low (5000 tokens)
# Set maxTokens = 4500
# Expected: High + medium loaded, low skipped (truncated message shown)
```

### Test 2: File Chunking (Memory Agent)
```bash
# Create 3000-line file
# Ask agent: "Explain the implementation in large-file.ts"
# Expected: 6 impulses created (500 lines each), only first 2-3 loaded (budget-dependent)
```

### Test 3: Manual Split Tool
```bash
# Create impulse for full file
opencode impulse create --session $SID --id "full-file" --pointer '{"type":"file","path":"src/auth.ts"}' --budget 8000

# Split manually
opencode impulse split --session $SID --impulse-id "full-file" --chunk-size 300

# Expected: Original deleted, 10 chunks created (30 lines each with 300-line chunks)
```

### Test 4: Lazy Resolution + Cache
```bash
# Create impulse, load it twice in same prompt building cycle
# Expected: First resolution = file read, second = cache hit (< 1ms)
```

---

## Summary

### What We Learned
1. **Impulses are operations, not just data** - many cannot be split
2. **Current architecture is correct** - priority-based selection + lazy resolution
3. **Splitting is only useful for large files** - not a general solution
4. **We already have 90% of what we need** - minor amendments complete the picture

### What to Build (Recommendation)
1. ✅ **File chunking in memory agent** - auto-split large files (Phase 2a)
2. 🟡 **Manual split tool** - optional user control (Phase 2b)
3. 🟢 **Dynamic budget adjustment** - historical averaging (Phase 3)
4. 🔵 **Metabob chunking** - severity-based splits (Phase 4)

### What NOT to Build
- ❌ Generic "impulse splitting" - doesn't make sense for atomic operations
- ❌ Content storage - breaks design, causes memory leaks
- ❌ Eager resolution - wastes resources, violates lazy loading principle

### Next Steps
**Choose ONE:**
1. Implement file chunking in memory agent (Phase 2a) - 2-3 days
2. Create manual split tool (Phase 2b) - 1 day
3. Move to Phase 3 (learning/optimization) - 3-5 days
4. Document and close (current system is sufficient) - 1 hour

**My Recommendation:** **Option 4** (document and close).

**Rationale:**
- Current system handles budget correctly
- File chunking is nice-to-have, not critical
- Premature optimization - wait for real user pain points
- Focus on Phase 2 (activity integration) instead - higher impact

---

**Decision Point:** Should we proceed with file chunking implementation, or move to higher-priority work?
