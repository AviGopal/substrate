# Memory Budget Tool Fix - "Referenceun is not defined"

**Date**: 2026-02-08  
**Issue**: Runtime error "Referenceun is not defined" when calling `memory_budget` tool  
**Status**: ✅ **FIXED**

## Problem

The error occurred because of incomplete/malformed code in memory-related tools:

```
⚙ memory_budget 
Referenceun is not defined
```

## Root Cause

Three files had incomplete object property definitions using just `un` or `un,` which JavaScript tried to evaluate as a variable reference:

### 1. memory-budget.ts (3 instances)

**Line 34**:
```typescript
impulses: { total: 0, un},  // ← Error: trying to reference undefined variable "un"
```

**Line 57**:
```typescript
impulses: { total: 0, un},  // ← Error: same issue
```

**Line 85**:
```typescript
impulses: {
  total: impulses.length,
  un,  // ← Error: incomplete property definition
}
```

### 2. impulse-list.ts (2 instances)

**Line 75**:
```typescript
const stats = {
  total: impulses.length,
  un,  // ← Error: incomplete property definition
  totalBudget,
  ...
}
```

**Line 94**:
```typescript
output += `  Loaded: ${(stats.tokenCount !== undefined && stats.tokenCount > 0)}, Un}\n`
// ← Malformed: "Un}" doesn't make sense
```

## Fixes Applied

### Fix 1: memory-budget.ts

**Three locations fixed** to properly define `loaded` and `unloaded` counts:

```typescript
// BEFORE
impulses: { total: 0, un}

// AFTER
impulses: { total: 0, loaded: 0, unloaded: 0 }
```

```typescript
// BEFORE (line 85)
impulses: {
  total: impulses.length,
  un,
}

// AFTER
impulses: {
  total: impulses.length,
  loaded: loadedCount,
  unloaded: impulses.length - loadedCount,
}
```

### Fix 2: impulse-list.ts

**Two locations fixed**:

```typescript
// BEFORE
const stats = {
  total: impulses.length,
  un,
  totalBudget,
  ...
}

// AFTER
const stats = {
  total: impulses.length,
  loaded: loadedCount,
  unloaded: impulses.length - loadedCount,
  totalBudget,
  ...
}
```

```typescript
// BEFORE
output += `  Loaded: ${(stats.tokenCount !== undefined && stats.tokenCount > 0)}, Un}\n`

// AFTER
output += `  Loaded: ${stats.loaded}, Unloaded: ${stats.unloaded}\n`
```

## Impact

These tools are used by the Memory Agent for context management:

- **`memory_budget`** - Shows token budget allocation and utilization
- **`memory_outline`** - Displays context window layout
- **`impulse_list`** - Lists impulses with load status

The bugs prevented these tools from working, breaking the Memory Agent's ability to manage session context.

## Files Changed

1. `repos/metabob-opencode/packages/opencode/src/tool/memory-budget.ts`
   - Fixed 3 instances of incomplete property definitions
   
2. `repos/metabob-opencode/packages/opencode/src/tool/impulse-list.ts`
   - Fixed 2 instances of incomplete property definitions

## Verification

The bugs were likely introduced during code refactoring or incomplete typing. They would have caused immediate runtime errors when:

1. Memory Agent tries to check context budget
2. Memory Agent tries to list impulses
3. Any session tries to visualize memory state

## Testing

After restart, verify these tools work:

```typescript
// In a session with impulses loaded:
memory_budget()  // Should return budget stats without error
impulse_list()   // Should return impulse list without error
memory_outline() // Should return context layout
```

Expected output structure for `memory_budget`:

```json
{
  "total": 1000,
  "used": 500,
  "available": 500,
  "utilization": 50,
  "impulses": {
    "total": 5,
    "loaded": 3,      // ← Fixed: was "un"
    "unloaded": 2     // ← Fixed: was missing
  },
  "byPriority": { ... }
}
```

## Related Issues

This is separate from the memory leak fixes but affects the same memory management system:

- **Memory leak fixes**: Addressed unbounded data growth (message loading, session tracking)
- **This fix**: Corrected tool implementation bugs preventing memory inspection

## Recommendation

**Restart the opencode process** to load the fixed code. The "Referenceun is not defined" error should no longer occur.

### Quick Restart

```bash
# Kill current process (if needed)
kill <PID>

# Start fresh
cd repos/metabob-opencode
bun dev ../..
```

Process should start cleanly and memory tools should work correctly.

## Status

- ✅ **memory-budget.ts** - Fixed (3 locations)
- ✅ **impulse-list.ts** - Fixed (2 locations)
- ✅ **memory-outline.ts** - Already correct
- ⏳ **Restart needed** - Apply fixes by restarting process

Current stable process (PID 1134047):
- Memory: 247 MB (stable)
- Runtime: 12+ hours
- Status: Stable with all memory fixes
