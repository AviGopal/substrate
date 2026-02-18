# ACP Phase 3: Bidirectional Resolution - Design Document

**Status**: ✅ **COMPLETE** (Implementation: `cdab20de`)  
**Created**: February 16, 2026  
**Completed**: February 16, 2026  
**Author**: Activity Mode Agent  
**Prerequisites**: Phase 1 (Remote Session Tracking) ✅, Phase 2 (Pointer Serialization) ✅

> **See [ACP_PHASE3_COMPLETE.md](./ACP_PHASE3_COMPLETE.md) for full implementation report**

---

## Executive Summary

Phase 3 enables **bidirectional impulse resolution** - allowing remote agents to request missing impulse content from the host on-demand. This solves the key limitation of Phase 2 where remote agents must have local file access to resolve pointers.

### Key Features
1. **Lazy Loading**: Remote agents request content only when needed
2. **Resolution Caching**: Cache resolved impulses to avoid redundant requests
3. **On-Demand Fetch**: Host provides content via ACP protocol
4. **Activity-to-Activity Sharing**: Enable impulse sharing between remote activities

### Benefits
- Eliminates file sync requirements
- Reduces initial payload (send only pointers)
- Enables true peer-to-peer impulse sharing
- Supports host-only pointers (activityOutput, hostFile)

---

## Current State (Phase 2)

### What Works
```
Host Agent                           Remote Agent
-----------                          -------------
Impulse (10KB file)      -->         Pointer only (175 bytes) ✅
                                     Remote resolves from local filesystem ✅
```

### Limitation
If remote agent doesn't have file access → **Resolution fails** ❌

```
Host Agent                           Remote Agent (No file access)
-----------                          -------------
Impulse (10KB file)      -->         Pointer (175 bytes)
                                     ❌ File not found - can't resolve
```

---

## Phase 3 Architecture

### Overview
```
Host Agent                           Remote Agent
-----------                          -------------
1. Send pointer            -->       Receive pointer
                                     
2. Wait for requests       <--       Request content (if needed)
                                     
3. Send content            -->       Resolve impulse ✅
                                     Cache for future use
```

### Protocol Flow

**Initial Delegation** (Same as Phase 2):
```typescript
// Host sends pointers only
acp_delegate({
  target: "docker://remote",
  prompt: "Task description",
  shareImpulses: ["file-auth", "memo-design"],
  sendFullContent: false // Default - sends pointers only
})
```

**Remote Request** (NEW in Phase 3):
```typescript
// Remote agent needs content
const content = await requestImpulseContent({
  sessionId: "host-session-id",
  impulseId: "file-auth"
})
// Returns: { content: "[10KB file content]", cached: true }
```

**Host Response** (NEW in Phase 3):
```typescript
// Host provides content on-demand
ACP_Protocol.handleContentRequest({
  sessionId: string,
  impulseId: string
}) => {
  content: string,
  metadata: { size, type, timestamp }
}
```

---

## Technical Design

### 1. Content Request Protocol

**New ACP Message Type**:
```typescript
interface ImpulseContentRequest {
  type: "impulse_content_request"
  sessionId: string      // Host session ID
  impulseId: string      // Impulse to resolve
  requestId: string      // Unique request ID (for tracking)
}

interface ImpulseContentResponse {
  type: "impulse_content_response"
  requestId: string
  success: boolean
  content?: string       // Impulse content if available
  error?: string         // Error message if failed
  cached: boolean        // Whether host had to load it
  metadata: {
    size: number
    type: string
    resolvedAt: string
  }
}
```

### 2. Resolution Cache

**Cache Structure**:
```typescript
class ImpulseResolutionCache {
  private cache: Map<string, CachedImpulse> = new Map()
  
  set(impulseId: string, content: string, ttl: number = 3600): void
  get(impulseId: string): string | undefined
  has(impulseId: string): boolean
  clear(): void
  
  // LRU eviction when cache size exceeds limit
  private evictLRU(): void
}

interface CachedImpulse {
  content: string
  metadata: {
    size: number
    type: string
    cachedAt: string
    accessCount: number
    lastAccess: string
  }
  expiresAt: string
}
```

**Cache Strategy**:
- **TTL**: 1 hour default (configurable)
- **Size Limit**: 100MB per session (configurable)
- **Eviction**: LRU when size limit exceeded
- **Stats**: Track hit rate, miss rate, evictions

### 3. Lazy Resolution

**Enhanced ImpulseResolver**:
```typescript
class ImpulseResolver {
  // Existing method (Phase 1 & 2)
  static async resolveForPrompt(
    impulse: Impulse,
    options?: ResolveOptions
  ): Promise<string>
  
  // NEW: Resolve with fallback to remote fetch
  static async resolveWithFetch(
    impulse: Impulse,
    sessionContext: RemoteSessionContext
  ): Promise<string> {
    // 1. Try local resolution (existing logic)
    try {
      return await this.resolveForPrompt(impulse)
    } catch (localError) {
      // 2. Fallback: Request from host
      return await this.fetchFromHost(impulse, sessionContext)
    }
  }
  
  // NEW: Fetch content from host agent
  private static async fetchFromHost(
    impulse: Impulse,
    context: RemoteSessionContext
  ): Promise<string> {
    // Check cache first
    const cached = cache.get(impulse.id)
    if (cached) return cached
    
    // Request from host via ACP
    const response = await acpClient.requestImpulseContent({
      sessionId: context.hostSessionId,
      impulseId: impulse.id
    })
    
    // Cache for future use
    cache.set(impulse.id, response.content)
    
    return response.content
  }
}
```

### 4. Activity-to-Activity Sharing

**Scenario**: Activity A creates output → Activity B needs it
```typescript
// Activity A completes
const outputImpulse = {
  id: "activity-a-output",
  type: "activityOutput",
  pointer: { type: "activityOutput", activityId: "abc123" },
  content: "[Large analysis result]"
}

// Activity B requests it
acp_delegate({
  target: "docker://another-agent",
  prompt: "Use the analysis from Activity A",
  shareImpulses: ["activity-a-output"] // ← Phase 3 resolves automatically
})
```

**How It Works**:
1. Host sends pointer to Activity B's agent
2. Remote agent attempts local resolution → fails (not local)
3. Remote agent requests content from host
4. Host provides activity output
5. Remote agent caches and uses it

---

## Implementation Plan

### Task 1: Extend ACP Protocol (2 days)
**Files**:
- `packages/opencode/src/acp/protocol.ts` (extend message types)
- `packages/opencode/src/acp/client.ts` (add content request method)
- `packages/opencode/src/acp/server.ts` (handle content requests)

**Implementation**:
```typescript
// In acp/protocol.ts
export type ACPMessage = 
  | ACPTaskMessage
  | ACPProgressMessage
  | ACPCompletionMessage
  | ACPImpulseContentRequest  // NEW
  | ACPImpulseContentResponse // NEW

// In acp/client.ts
class ACPClient {
  async requestImpulseContent(
    sessionId: string,
    impulseId: string
  ): Promise<ImpulseContentResponse> {
    const requestId = ulid()
    await this.send({
      type: "impulse_content_request",
      sessionId,
      impulseId,
      requestId
    })
    return await this.waitForResponse(requestId)
  }
}

// In acp/server.ts
class ACPServer {
  private async handleImpulseContentRequest(
    req: ImpulseContentRequest
  ): Promise<void> {
    const session = SessionMemory.getSession(req.sessionId)
    const impulse = session.impulses.get(req.impulseId)
    
    if (!impulse) {
      return this.sendError(req.requestId, "Impulse not found")
    }
    
    // Resolve impulse content
    const content = await ImpulseResolver.resolveForPrompt(impulse)
    
    this.send({
      type: "impulse_content_response",
      requestId: req.requestId,
      success: true,
      content,
      cached: false,
      metadata: {
        size: content.length,
        type: impulse.type,
        resolvedAt: new Date().toISOString()
      }
    })
  }
}
```

### Task 2: Add Resolution Cache (1 day)
**Files**:
- `packages/opencode/src/session/impulse-cache.ts` (NEW)

**Implementation**:
```typescript
export class ImpulseResolutionCache {
  private cache = new Map<string, CachedImpulse>()
  private maxSize = 100 * 1024 * 1024 // 100MB
  private currentSize = 0
  
  set(impulseId: string, content: string, ttl = 3600): void {
    const size = content.length
    
    // Evict if needed
    while (this.currentSize + size > this.maxSize) {
      this.evictLRU()
    }
    
    this.cache.set(impulseId, {
      content,
      metadata: {
        size,
        type: "resolved",
        cachedAt: new Date().toISOString(),
        accessCount: 0,
        lastAccess: new Date().toISOString()
      },
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    })
    
    this.currentSize += size
  }
  
  get(impulseId: string): string | undefined {
    const cached = this.cache.get(impulseId)
    if (!cached) return undefined
    
    // Check expiration
    if (new Date(cached.expiresAt) < new Date()) {
      this.cache.delete(impulseId)
      this.currentSize -= cached.metadata.size
      return undefined
    }
    
    // Update access stats
    cached.metadata.accessCount++
    cached.metadata.lastAccess = new Date().toISOString()
    
    return cached.content
  }
  
  private evictLRU(): void {
    let oldest: [string, CachedImpulse] | undefined
    
    for (const entry of this.cache.entries()) {
      if (!oldest || entry[1].metadata.lastAccess < oldest[1].metadata.lastAccess) {
        oldest = entry
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest[0])
      this.currentSize -= oldest[1].metadata.size
    }
  }
}
```

### Task 3: Enhance ImpulseResolver (1 day)
**Files**:
- `packages/opencode/src/session/impulse-resolver.ts` (extend)

**Changes**:
- Add `resolveWithFetch()` method
- Add fallback logic (try local → try remote)
- Integrate cache
- Add remote session context

### Task 4: Update ACP Delegate (0.5 days)
**Files**:
- `packages/opencode/src/tool/acp-delegate.ts` (minor changes)

**Changes**:
- Pass host session ID to remote
- Enable bidirectional communication channel
- Update `buildPromptWithImpulses()` to mention lazy resolution

### Task 5: Testing (1 day)
**Files**:
- `scripts/test-phase3-bidirectional-resolution.ts` (NEW)
- `scripts/test-phase3-lazy-loading.ts` (NEW)

**Test Scenarios**:
1. **Remote file not available** → Fetch from host ✅
2. **Cache hit** → Use cached content (no host request) ✅
3. **Cache miss** → Fetch from host, cache result ✅
4. **Cache eviction** → LRU works correctly ✅
5. **Activity output sharing** → Remote fetches activity output ✅
6. **Error handling** → Host impulse not found → graceful error ✅

---

## API Changes

### New Configuration Options
```typescript
// In opencode.json or config
{
  "acp": {
    "bidirectionalResolution": true, // Enable Phase 3
    "cache": {
      "enabled": true,
      "maxSize": 104857600, // 100MB
      "ttl": 3600           // 1 hour
    }
  }
}
```

### Tool Schema Update
```typescript
// acp_delegate tool parameters (no changes to public API)
// Bidirectional resolution works automatically when enabled
```

---

## Performance Considerations

### Bandwidth
- **Phase 2**: Send all pointers (175 bytes each)
- **Phase 3**: Send pointers + fetch on-demand (175 bytes + content when needed)
- **Benefit**: Only fetch what's actually used (lazy loading)

### Latency
- **Local resolution**: ~1-5ms (no change)
- **Remote fetch**: ~50-200ms (network round-trip)
- **Cache hit**: ~1ms (fast path)

### Optimization Strategies
1. **Batch requests**: Fetch multiple impulses in one request
2. **Predictive prefetch**: Pre-fetch likely-needed impulses
3. **Compression**: Compress large content during transmission
4. **Background fetch**: Non-blocking parallel requests

---

## Backwards Compatibility

### Phase 2 Behavior (Preserved)
```typescript
// Still works exactly as before
acp_delegate({
  shareImpulses: ["file-auth"],
  sendFullContent: false // Pointer-only (local resolution)
})
```

### Phase 3 Behavior (Opt-in)
```typescript
// Enable in config
{
  "acp": {
    "bidirectionalResolution": true // NEW
  }
}

// Same delegation code, but with lazy resolution fallback
acp_delegate({
  shareImpulses: ["file-auth"],
  sendFullContent: false // Pointer + lazy fetch if needed
})
```

### Migration Path
1. **Phase 2 deployed**: Pointer-only (requires file sync) ✅
2. **Phase 3 deployed**: Pointer + lazy fetch (no file sync needed)
3. **Gradual rollout**: Enable per-project basis
4. **Zero breaking changes**: Phase 2 continues to work

---

## Success Criteria

### Functional
- ✅ Remote agent can request impulse content from host
- ✅ Host responds with content within 200ms
- ✅ Cache reduces redundant requests by 80%+
- ✅ Activity output sharing works end-to-end
- ✅ All Phase 2 tests still pass

### Performance
- ✅ Cache hit rate >70% after warmup
- ✅ Network overhead <10% compared to Phase 2
- ✅ Memory usage <100MB per session

### Quality
- ✅ Zero breaking changes to existing code
- ✅ All error cases handled gracefully
- ✅ Comprehensive test coverage (>90%)

---

## Timeline

| Task | Duration | Dependencies | Status |
|------|----------|--------------|--------|
| Design Document | 0.5 days | Phase 2 complete | ✅ |
| Extend ACP Protocol | 2 days | Design complete | Pending |
| Add Resolution Cache | 1 day | - | Pending |
| Enhance ImpulseResolver | 1 day | Cache complete | Pending |
| Update ACP Delegate | 0.5 days | Protocol + Resolver | Pending |
| Testing & Validation | 1 day | All impl complete | Pending |
| Documentation | 0.5 days | Tests passing | Pending |
| **Total** | **6.5 days** | | **Day 1** |

---

## Risks & Mitigation

### Risk 1: Network Latency
**Impact**: Slow content fetch degrades performance  
**Mitigation**: 
- Aggressive caching (1-hour TTL)
- Batch requests
- Background prefetch for common patterns

### Risk 2: Memory Pressure
**Impact**: Cache grows too large  
**Mitigation**:
- 100MB size limit per session
- LRU eviction
- Configurable TTL

### Risk 3: Protocol Complexity
**Impact**: Bidirectional flow increases debugging difficulty  
**Mitigation**:
- Comprehensive logging
- Request tracking (requestId)
- Clear error messages

---

## Next Steps

### Immediate (Today)
1. ✅ Complete design document
2. Create Phase 3 branch
3. Start Task 1: Extend ACP Protocol

### Week 1
- Complete all implementation tasks (Tasks 1-4)
- Begin testing (Task 5)

### Week 2
- Complete testing and validation
- Write documentation
- Merge to dev branch

---

## References

- **Phase 1**: `ACP_PHASE1_COMPLETION_REPORT.md`
- **Phase 2**: `ACP_PHASE2_COMPLETE.md`
- **Project Status**: `ACP_PROJECT_STATUS.md`
- **Architecture**: `ARCHITECTURE_COMPLETE_DATA_FLOW.md`

---

**Status**: Design Complete ✅  
**Ready for Implementation**: Yes  
**Next Action**: Create Phase 3 branch and begin Task 1
