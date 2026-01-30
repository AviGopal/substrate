# Undo/Redo Stack Management Memory Analysis

**Analysis Date**: January 30, 2026  
**Focus**: Undo/redo memory management, state storage, potential memory leaks  
**Finding**: Single-level revert with Git-based snapshots - Limited memory leak risk

## Executive Summary

**✅ GOOD NEWS: Undo/Redo is NOT a Major Memory Leak Source**

Unlike traditional undo/redo implementations that maintain unbounded stacks of deep state copies, OpenCode uses a **single-level revert system** backed by **Git snapshots**. This design inherently prevents the classic undo/redo memory leaks.

However, there are some **moderate memory concerns** around diff storage and session message accumulation.

## Undo/Redo Architecture Analysis

### 1. **Single-Level Revert Design** ✅

**Location**: `/workspace/packages/opencode/src/session/revert.ts`

**Architecture**: 
```typescript
// Session Info schema - only stores ONE revert state
revert: z.object({
  messageID: z.string(),
  partID: z.string().optional(),
  snapshot: z.string().optional(),  // Git hash pointer
  diff: z.string().optional(),      // Text diff
}).optional()
```

**Memory Characteristics**:
- **Single Level**: Only one revert state per session (not a stack)
- **Git-based**: Uses Git tree hashes for state snapshots (small pointers)
- **Bounded**: Maximum one revert per session, replaced on new reverts
- **Cleanup**: Revert state cleared when unreverting or session ends

**✅ No Memory Leak Risk**: Cannot accumulate unbounded undo history

### 2. **Git Snapshot System** ✅ (Mostly)

**Location**: `/workspace/packages/opencode/src/snapshot/index.ts`

**Implementation**:
```typescript
export async function track() {
  // Creates Git tree hash - lightweight pointer
  const hash = await $`git write-tree`.quiet().text()
  return hash.trim()  // Returns ~40-character SHA hash
}

export async function restore(snapshot: string) {
  // Restores from Git tree hash  
  await $`git read-tree ${snapshot} && git checkout-index -a -f`
}
```

**Memory Characteristics**:
- **Git Storage**: Actual file snapshots stored in `.opencode/storage/snapshot/{projectId}`
- **Hash Pointers**: Session only stores 40-character SHA hashes
- **Git Compression**: Git handles deduplication and compression automatically
- **File System Based**: Not in-memory storage

**⚠️ Moderate Concern**: Git repository can grow over time, but not in RAM

### 3. **Diff Storage System** ⚠️

**Location**: `/workspace/packages/opencode/src/snapshot/index.ts:diffFull()`

**Implementation**:
```typescript
export async function diffFull(from: string, to: string): Promise<FileDiff[]> {
  const MAX_FILE_SIZE = 1024 * 1024 // 1MB limit per file
  
  // For each changed file, stores before/after content
  result.push({
    file,
    before,  // Full file content (up to 1MB)
    after,   // Full file content (up to 1MB) 
    additions: parseInt(additions),
    deletions: parseInt(deletions),
  })
}
```

**⚠️ Memory Issues**:
- **Content Duplication**: Stores full before/after content for each file
- **Session Storage**: Diff stored in session data (`session.revert.diff`)
- **1MB Limit**: Per-file, but multiple files can accumulate
- **Text Storage**: Diff stored as string in session metadata

**Potential Impact**: 
- Large refactoring operations could generate multi-MB diff strings
- Diff persists in session until unrevert/cleanup
- Multiple concurrent sessions with large diffs = memory accumulation

## Memory Analysis: Revert vs Other Systems

### **Comparison with Traditional Undo/Redo**:

| Aspect | Traditional Stack | OpenCode Revert | Memory Risk |
|--------|-------------------|-----------------|-------------|
| **History Depth** | Unbounded stack (50-1000+ entries) | Single level | ✅ Low |
| **State Storage** | Deep copies of entire state | Git hash pointers | ✅ Low |
| **Memory Growth** | Linear with operations | Constant (1 per session) | ✅ Low |
| **Cleanup** | Manual stack truncation | Automatic on unrevert | ✅ Low |
| **Content Storage** | In-memory objects | File system (Git) | ✅ Low |

### **OpenCode's Design Advantages**:
1. **No Stack Accumulation**: Can't build up 100s of undo entries
2. **Git-based Storage**: Leverages Git's efficient storage/compression
3. **Pointer References**: Only stores 40-byte hashes in memory  
4. **Automatic Cleanup**: Revert cleared on session operations
5. **Size Limits**: 1MB per-file limit prevents massive diffs

## Identified Memory Concerns (Moderate)

### 1. **Diff Content Storage** ⚠️

**Issue**: `session.revert.diff` can store large text diffs in memory

**Scenario**: 
- Large refactoring session affecting 50+ files
- Each file up to 1MB of before/after content
- Diff could be 10-50MB of text stored in session object
- Multiple sessions = multiple large diffs in memory

**Evidence from Code**:
```typescript
// revert.ts:55 - Diff stored in session metadata
if (revert.snapshot) revert.diff = await Snapshot.diff(revert.snapshot)
return Session.update(input.sessionID, (draft) => {
  draft.revert = revert  // Stores diff in session object
})
```

**Mitigation**: The 1MB per-file limit prevents extreme cases

### 2. **Session Message Accumulation** ⚠️

**Issue**: `Session.messages()` loads all messages without bounds checking

**Scenario**:
- Long-running sessions (metabob creates many messages)
- Each undo operation processes all session messages
- Memory grows linearly with session length

**Evidence from Code**:
```typescript
// revert.ts:25 - Loads ALL messages for processing
const all = await Session.messages({ sessionID: input.sessionID })

// index.ts - No default limit
export const messages = fn(
  z.object({
    sessionID: Identifier.schema("session"),
    limit: z.number().optional(),  // Optional limit
  }),
  async (input) => {
    const result = [] as MessageV2.WithParts[]
    for await (const msg of MessageV2.stream(input.sessionID)) {
      if (input.limit && result.length >= input.limit) break
      result.push(msg)
    }
    return result
  }
)
```

**Potential Impact**: 
- Sessions with 100s of messages (metabob context preparation creates many)
- Each message loaded with full parts content
- Undo operations become expensive and memory-heavy

### 3. **Multiple Concurrent Reverts** ⚠️

**Issue**: Multiple sessions can have concurrent revert states

**Scenario**:
- 5 concurrent sessions (observed in our test)
- Each session has large diff (10-50MB)
- Total: 50-250MB in revert diff storage
- Combined with other memory leaks = compounding effect

## Memory Leak Risk Assessment

### **Risk Level: LOW to MODERATE**

**✅ Not a Primary Leak Source**: 
- Single-level design prevents unbounded stack growth
- Git-based storage keeps snapshots on disk, not in memory
- Automatic cleanup prevents indefinite accumulation

**⚠️ Contributing Factor**: 
- Large diff storage can add 10-50MB per session
- Session message loading without limits
- Combined with impulse cache leaks = memory pressure

**🎯 Correlation with Metabob**: 
- Metabob sessions tend to be longer (many tool calls)
- More messages = larger Session.messages() overhead during undo
- Complex metabob operations = larger diff sizes

## Comparison: Undo vs Impulse Caches

| Memory Source | Risk Level | Max Memory | Growth Pattern |
|---------------|------------|------------|----------------|
| **Impulse Caches** | 🚨 CRITICAL | 5+ GB | Exponential |
| **Metabob Context Prep** | 🚨 CRITICAL | 5+ GB | Per session |
| **Undo/Redo Diffs** | ⚠️ MODERATE | 50-250 MB | Per session |
| **Session Messages** | ⚠️ MODERATE | 10-100 MB | Linear with length |

## Recommendations

### 1. **Low-Priority Fixes** (Undo system is not the main problem)

**Add Diff Size Limits**:
```typescript
// Limit total diff size across all files  
const MAX_TOTAL_DIFF_SIZE = 10 * 1024 * 1024; // 10MB total
let totalDiffSize = 0;

for (const fileDiff of result) {
  totalDiffSize += fileDiff.before.length + fileDiff.after.length;
  if (totalDiffSize > MAX_TOTAL_DIFF_SIZE) {
    // Truncate or skip remaining files
    break;
  }
}
```

**Add Default Message Limits in Revert**:
```typescript
// Limit messages loaded during revert processing
const all = await Session.messages({ 
  sessionID: input.sessionID,
  limit: 100  // Don't process more than 100 messages
})
```

### 2. **Optional Optimizations**

**Lazy Diff Generation**:
- Don't generate diff immediately on revert
- Generate on-demand when diff is actually requested
- Reduces memory if revert is never examined

**Compressed Diff Storage**:
- Compress large diffs before storing in session
- Use gzip compression for text content

### 3. **Focus on Real Problems First** ⭐

**Priority Order**:
1. **Fix impulse cache leaks** (5+ GB issue) 🚨
2. **Fix metabob context preparation** (5+ GB issue) 🚨  
3. **Fix session memory storage bugs** (100s MB issue) ⚠️
4. **Optimize undo/redo diffs** (10s MB issue) ⚠️

## Conclusion

**The undo/redo system is NOT the primary memory leak source** in OpenCode. The single-level revert design with Git snapshots is actually well-architected to prevent classic undo/redo memory leaks.

However, **diff storage and message loading** do contribute to memory pressure, especially in long metabob sessions. These are moderate concerns that should be addressed after fixing the critical impulse caching leaks.

**Key Finding**: OpenCode's revert system is a **contributing factor** (~50-250MB) rather than a **root cause** (~5GB) of the memory leak. The primary culprits remain the unbounded impulse caches and metabob context preparation hooks.

---

**Recommendation**: Focus remediation efforts on impulse caching system first, then address undo/redo optimizations as a secondary priority.