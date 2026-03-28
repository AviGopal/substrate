# ACP Phase 2: Pointer-Based Impulse Serialization - Implementation Plan

## Status: Ready to Start
**Previous Phase**: Phase 1 Complete ✅ (commits: d9c919ea, 49af07d)  
**Current Phase**: Phase 2 - Pointer-Based Serialization  
**Estimated Duration**: 2-3 days  
**Priority**: High (enables efficient cross-agent communication)

---

## Executive Summary

Phase 2 replaces full impulse content transmission with lightweight pointers, reducing prompt sizes by **10-50x** and enabling efficient cross-agent collaboration at scale.

**Key Benefit**: Instead of sending 10KB of file content, send a 100-byte pointer that the remote agent can resolve locally.

---

## Problem Statement

### Current Behavior (Phase 1)
When sharing impulses with remote agents via `shareImpulses`:

```typescript
acp_delegate({
  target: "docker://devbob-opencode",
  prompt: "Fix the authentication bug",
  shareImpulses: ["file-auth-context", "bug-description"]
})
```

**What gets sent**:
```xml
<shared_impulses>
  <impulse id="file-auth-context">
    <content>
      [10,000 characters of full file content]
    </content>
  </impulse>
  <impulse id="bug-description">
    <content>
      [2,000 characters of bug analysis]
    </content>
  </impulse>
</shared_impulses>
```

**Problems**:
- 12KB prompt overhead
- Slow delegation initialization
- High token costs
- Doesn't scale beyond 5-10 impulses

### Desired Behavior (Phase 2)
**What should be sent**:
```xml
<shared_impulses>
  <impulse id="file-auth-context">
    <pointer type="file" path="src/auth/login.ts" />
  </impulse>
  <impulse id="bug-description">
    <pointer type="metabob" problem_id="prob_xyz123" />
  </impulse>
</shared_impulses>
```

**Benefits**:
- ~200 bytes total (60x reduction)
- Instant delegation initialization
- Remote agent resolves pointers locally
- Scales to 100+ impulses

---

## Architecture

### Component Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│ Host Agent (Delegating Agent)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. SessionMemory.getImpulse(id)                           │
│     → Returns impulse with full content                    │
│                                                             │
│  2. ImpulseSerializer.serializeForRemote(impulse)          │
│     → Strips content, keeps pointer                        │
│     → Returns lightweight impulse                          │
│                                                             │
│  3. ACPDelegateTool.delegate({ shareImpulses })            │
│     → Serializes each impulse                              │
│     → Sends <shared_impulses> with pointers only           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ ACP Protocol
                            │ (Lightweight Pointers)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Remote Agent (Receiving Agent)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Receives <shared_impulses> with pointers               │
│                                                             │
│  2. ImpulseResolver.resolvePointer(pointer)                │
│     → file: Read from local filesystem                     │
│     → metabob: Query local Metabob backend                 │
│     → code: Extract from local codebase                    │
│     → memo: Use pointer.content directly                   │
│                                                             │
│  3. SessionMemory.loadImpulse(resolvedImpulse)             │
│     → Impulse now available with full content              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Add Pointer Serialization (1 day)
**File**: `packages/opencode/src/session/impulse-serializer.ts` (new)

```typescript
export interface SerializedImpulse {
  id: string
  type: string
  pointer: ImpulsePointer
  metadata?: Record<string, unknown>
  // NO content field
}

export class ImpulseSerializer {
  /**
   * Convert impulse to lightweight serialized form (pointer only)
   */
  static serializeForRemote(impulse: Impulse): SerializedImpulse {
    return {
      id: impulse.id,
      type: impulse.type,
      pointer: impulse.pointer,
      metadata: impulse.metadata
      // Content is NOT included
    }
  }

  /**
   * Serialize multiple impulses for remote transmission
   */
  static serializeMany(impulses: Impulse[]): SerializedImpulse[] {
    return impulses.map(imp => this.serializeForRemote(imp))
  }
}
```

**Tests**:
- Verify content is stripped
- Verify pointer is preserved
- Verify metadata is preserved
- Verify serialization is idempotent

---

### Task 2: Add Pointer Resolution (1 day)
**File**: `packages/opencode/src/session/impulse-resolver.ts` (new)

```typescript
export class ImpulseResolver {
  /**
   * Resolve a pointer to full content on the remote agent
   */
  static async resolvePointer(
    pointer: ImpulsePointer,
    context: { 
      projectRoot: string
      metabobClient?: MetabobClient 
    }
  ): Promise<string | null> {
    switch (pointer.type) {
      case "file":
        return this.resolveFile(pointer.path, context.projectRoot)
      
      case "hostFile":
        // Host files not available on remote - return null
        return null
      
      case "metabob":
        if (!context.metabobClient) return null
        return this.resolveMetabob(pointer.problem_id, context.metabobClient)
      
      case "code":
        return this.resolveCode(pointer, context.projectRoot)
      
      case "memo":
        // Memos must include content in pointer
        return pointer.content || null
      
      case "acp":
        // ACP sessions are tracked via metadata, no resolution needed
        return null
      
      default:
        return null
    }
  }

  private static async resolveFile(
    path: string, 
    projectRoot: string
  ): Promise<string | null> {
    const fullPath = resolve(projectRoot, path)
    try {
      return await fs.readFile(fullPath, "utf-8")
    } catch {
      return null // File not found on remote
    }
  }

  private static async resolveMetabob(
    problemId: string,
    client: MetabobClient
  ): Promise<string | null> {
    try {
      const problem = await client.getProblem(problemId)
      return JSON.stringify(problem, null, 2)
    } catch {
      return null
    }
  }

  private static async resolveCode(
    pointer: { path: string; startLine?: number; endLine?: number },
    projectRoot: string
  ): Promise<string | null> {
    const content = await this.resolveFile(pointer.path, projectRoot)
    if (!content) return null

    if (pointer.startLine !== undefined && pointer.endLine !== undefined) {
      const lines = content.split("\n")
      return lines.slice(pointer.startLine - 1, pointer.endLine).join("\n")
    }

    return content
  }
}
```

**Tests**:
- Resolve file pointer to content
- Resolve metabob pointer to problem data
- Resolve code pointer with line ranges
- Handle missing files gracefully
- Handle missing metabob problems gracefully

---

### Task 3: Update ACP Delegation (0.5 days)
**File**: `packages/opencode/src/tool/acp-delegate.ts`

**Changes**:
1. Import `ImpulseSerializer`
2. Serialize impulses before sending
3. Add `sendFullContent` flag for backwards compatibility

```typescript
// BEFORE (Phase 1)
const sharedImpulses = shareImpulses
  .map(id => SessionMemory.getImpulse(sessionID, id))
  .filter(Boolean)

const impulseContext = sharedImpulses
  .map(imp => formatImpulseForPrompt(imp))
  .join("\n\n")

// AFTER (Phase 2)
const sharedImpulses = shareImpulses
  .map(id => SessionMemory.getImpulse(sessionID, id))
  .filter(Boolean)

// Serialize to pointers (default behavior)
const serialized = options.sendFullContent 
  ? sharedImpulses // Backwards compatibility
  : ImpulseSerializer.serializeMany(sharedImpulses)

const impulseContext = serialized
  .map(imp => formatImpulseForPrompt(imp))
  .join("\n\n")
```

**New Parameter**:
```typescript
interface ACPDelegateOptions {
  // ... existing options
  sendFullContent?: boolean // Default: false (use pointers)
}
```

---

### Task 4: Update Remote Agent Context Loading (0.5 days)
**File**: `packages/opencode/src/session/prompt.ts`

**Changes**: Update `parseSharedImpulses()` to detect pointers and resolve them

```typescript
function parseSharedImpulses(
  content: string,
  context: { projectRoot: string; metabobClient?: MetabobClient }
): Impulse[] {
  const impulses: Impulse[] = []
  
  // Parse <impulse> tags from prompt
  const impulseRegex = /<impulse id="([^"]+)" type="([^"]+)">(.*?)<\/impulse>/gs
  
  for (const match of content.matchAll(impulseRegex)) {
    const [, id, type, body] = match
    
    // Check if this is a pointer (no <content> tag)
    const hasContent = body.includes("<content>")
    
    if (hasContent) {
      // Phase 1 behavior: content included
      const contentMatch = body.match(/<content>(.*?)<\/content>/s)
      impulses.push({
        id,
        type,
        pointer: parsePointer(body),
        content: contentMatch?.[1] || ""
      })
    } else {
      // Phase 2 behavior: pointer only, resolve it
      const pointer = parsePointer(body)
      const content = await ImpulseResolver.resolvePointer(pointer, context)
      
      impulses.push({
        id,
        type,
        pointer,
        content: content || "[Content not available on remote agent]"
      })
    }
  }
  
  return impulses
}
```

---

### Task 5: Add Metrics and Monitoring (0.5 days)
**File**: `packages/opencode/src/tool/acp-delegate.ts`

Track prompt size reduction:

```typescript
const beforeSize = JSON.stringify(sharedImpulses).length
const afterSize = JSON.stringify(serialized).length
const reduction = ((beforeSize - afterSize) / beforeSize * 100).toFixed(1)

console.log(`[ACP] Impulse serialization: ${beforeSize}B → ${afterSize}B (${reduction}% reduction)`)
```

**Metrics to track**:
- Prompt size before/after serialization
- Number of pointers sent
- Number of pointers successfully resolved
- Number of pointers that failed to resolve

---

## Testing Strategy

### Unit Tests
**File**: `packages/opencode/test/impulse-serializer.test.ts`

```typescript
describe("ImpulseSerializer", () => {
  it("should strip content from file impulse", () => {
    const impulse = {
      id: "test",
      type: "file",
      pointer: { type: "file", path: "src/test.ts" },
      content: "[10KB of file content]"
    }
    
    const serialized = ImpulseSerializer.serializeForRemote(impulse)
    
    expect(serialized.content).toBeUndefined()
    expect(serialized.pointer).toEqual(impulse.pointer)
  })
  
  it("should preserve memo content in pointer", () => {
    const impulse = {
      id: "memo",
      type: "memo",
      pointer: { type: "memo", content: "Important note" }
    }
    
    const serialized = ImpulseSerializer.serializeForRemote(impulse)
    expect(serialized.pointer.content).toBe("Important note")
  })
})
```

**File**: `packages/opencode/test/impulse-resolver.test.ts`

```typescript
describe("ImpulseResolver", () => {
  it("should resolve file pointer to content", async () => {
    const pointer = { type: "file", path: "test.txt" }
    const context = { projectRoot: "/tmp/test" }
    
    await fs.writeFile("/tmp/test/test.txt", "Hello World")
    
    const content = await ImpulseResolver.resolvePointer(pointer, context)
    expect(content).toBe("Hello World")
  })
  
  it("should handle missing files gracefully", async () => {
    const pointer = { type: "file", path: "missing.txt" }
    const context = { projectRoot: "/tmp/test" }
    
    const content = await ImpulseResolver.resolvePointer(pointer, context)
    expect(content).toBeNull()
  })
})
```

### Integration Tests
**File**: `test-phase2-pointer-serialization.ts`

```typescript
async function testPointerSerialization() {
  console.log("=== Phase 2: Pointer Serialization Test ===\n")
  
  // Create file impulse with large content
  const impulse = await SessionMemory.createImpulse(sessionID, {
    type: "file",
    pointer: { type: "file", path: "large-file.ts" },
    content: "[Simulated 50KB content]".repeat(1000)
  })
  
  // Test 1: Serialize should strip content
  const serialized = ImpulseSerializer.serializeForRemote(impulse)
  const reduction = (1 - serialized.length / impulse.length) * 100
  
  console.log(`✓ Serialization reduced size by ${reduction.toFixed(1)}%`)
  assert(reduction > 95, "Expected >95% reduction")
  
  // Test 2: Delegate with pointer
  const result = await ACPDelegateTool.delegate({
    target: "docker://devbob-clean",
    taskDescription: "Test pointer resolution",
    prompt: "Read the shared file and confirm you can access it",
    shareImpulses: [impulse.id]
    // sendFullContent: false (default)
  })
  
  console.log(`✓ Delegation successful: ${result.sessionId}`)
  assert(result.response.includes("file content"), "Remote agent should resolve pointer")
  
  // Test 3: Verify remote agent resolved pointer
  console.log("✓ Remote agent successfully resolved file pointer")
  
  console.log("\n=== Phase 2 Test Complete ===")
}
```

### End-to-End Test Scenarios

1. **File Impulse**: Share large file, verify remote agent can read it
2. **Metabob Impulse**: Share code problem, verify remote agent can query it
3. **Multiple Impulses**: Share 20 impulses, verify prompt stays small
4. **Missing File**: Share pointer to file that doesn't exist on remote
5. **Backwards Compatibility**: Use `sendFullContent: true`, verify old behavior

---

## Success Criteria

### Functional Requirements
- ✅ Serialization strips content from impulses
- ✅ Pointers are preserved during serialization
- ✅ Remote agents can resolve file pointers
- ✅ Remote agents can resolve metabob pointers
- ✅ Missing pointers fail gracefully (no crashes)
- ✅ `sendFullContent: true` preserves Phase 1 behavior

### Performance Requirements
- ✅ Prompt size reduced by >90% for file impulses
- ✅ Serialization overhead <5ms per impulse
- ✅ Resolution overhead <50ms per impulse
- ✅ Can share 50+ impulses without prompt limits

### Quality Requirements
- ✅ Zero TypeScript errors
- ✅ Zero breaking changes to existing code
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ Documentation updated

---

## Risk Assessment

### Low Risk
- **Serialization Logic**: Simple object transformation
- **File Resolution**: Standard filesystem operations
- **Backwards Compatibility**: Controlled by flag

### Medium Risk
- **Metabob Resolution**: Requires backend API availability
  - **Mitigation**: Graceful fallback if API unavailable
- **Path Resolution**: Host/remote paths may differ
  - **Mitigation**: Relative paths from project root

### High Risk
- **Pointer Staleness**: File content may change between send/resolve
  - **Mitigation**: Document as expected behavior (eventual consistency)
- **Cross-Container Networking**: Docker DNS resolution
  - **Mitigation**: Test in docker-compose environment

---

## Implementation Timeline

### Day 1: Serialization & Resolution (6 hours)
- Morning: Implement `ImpulseSerializer` (2h)
- Afternoon: Implement `ImpulseResolver` (3h)
- Evening: Unit tests (1h)

### Day 2: Integration & Testing (6 hours)
- Morning: Update `acp-delegate.ts` (2h)
- Afternoon: Update `prompt.ts` for resolution (2h)
- Evening: Integration tests (2h)

### Day 3: Validation & Documentation (4 hours)
- Morning: End-to-end testing in docker environment (2h)
- Afternoon: Documentation and examples (2h)

**Total Estimate**: 16 hours over 2-3 days

---

## Documentation Updates

### Files to Update
1. **ACP_REMOTE_SESSION_QUICK_START.md**
   - Add pointer serialization section
   - Add resolution examples
   - Update performance metrics

2. **ACP_PHASE2_COMPLETION_REPORT.md** (new)
   - Implementation summary
   - Test results
   - Performance benchmarks
   - Before/after comparisons

3. **README.md** (opencode)
   - Update ACP delegation examples
   - Add pointer serialization benefits

---

## Next Session Commands

### Start Implementation
```bash
# 1. Create new branch
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
git checkout -b feat/acp-phase2-pointer-serialization

# 2. Create new files
touch packages/opencode/src/session/impulse-serializer.ts
touch packages/opencode/src/session/impulse-resolver.ts
touch packages/opencode/test/impulse-serializer.test.ts
touch packages/opencode/test/impulse-resolver.test.ts

# 3. Run tests during development
bun test impulse-serializer
bun test impulse-resolver

# 4. Run integration test
bun run test-phase2-pointer-serialization.ts
```

### Testing
```bash
# Unit tests
cd repos/metabob-opencode
bun test packages/opencode/test/impulse-serializer.test.ts
bun test packages/opencode/test/impulse-resolver.test.ts

# Integration test
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run test-phase2-pointer-serialization.ts

# E2E test in docker
docker-compose --profile stable --profile devbob up -d
# ... delegate to devbob-clean with shareImpulses
```

---

## Phase 3 Preview

Once Phase 2 is complete, **Phase 3** will add:
- **Bidirectional Resolution**: Remote agents can request pointers from host
- **Lazy Loading**: Resolve pointers on-demand during task execution
- **Pointer Caching**: Cache resolved content to avoid repeated resolution
- **Cross-Agent Pointers**: Share impulses between peer agents (not just host→remote)

**Estimated Timeline**: Phase 3 in 3-4 days after Phase 2 complete

---

## Conclusion

Phase 2 transforms ACP delegation from a content-heavy operation to a lightweight pointer-based protocol, enabling:
- **10-50x smaller prompts**
- **Instant delegation** (no content serialization delay)
- **Scalable sharing** (100+ impulses without hitting limits)
- **Lower token costs** (less prompt data = fewer tokens)

This is the foundation for true multi-agent collaboration at scale.

**Status**: Ready to implement  
**Next Action**: Create feature branch and start Task 1 (ImpulseSerializer)
