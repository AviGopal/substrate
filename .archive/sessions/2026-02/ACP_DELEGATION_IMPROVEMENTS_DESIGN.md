# ACP Delegation Improvements - Design Document

**Status**: Design Phase  
**Created**: February 16, 2026  
**Prerequisites**: Phase 1-3 Complete ✅

---

## Executive Summary

Improve `acp_delegate` reliability and integrate deeply with the impulse system to enable:

1. **Session Creation on Remote**: Create proper sessions on remote machines with impulse tracking
2. **Status Tracking**: Session memory agent allocates impulses for each remote agent with real-time status
3. **Pointer Seeding**: Use session memory agent to populate remote sessions with resolved local pointers
4. **Progress Monitoring**: Track processing duration and last message from remote agent

---

## Current State (Phase 3)

### What Works ✅
- Pointer-based serialization (98.25% size reduction)
- Bidirectional resolution (on-demand content fetch)
- Resolution caching (100MB LRU, 1hr TTL)
- Basic delegation to Docker containers

### What's Missing ❌
- No impulse created for remote sessions (host can't track delegation status)
- No session memory integration (can't query "what remote agents are active?")
- No pointer seeding (remote agent doesn't get pre-resolved context)
- No progress updates during execution
- No persistent tracking of remote agent state

---

## Proposed Architecture

### Phase 4A: Remote Session Impulse Tracking

#### 1. Impulse Creation on Delegation

When `acp_delegate` is called, **automatically create an impulse** to track the remote session:

```typescript
// In acp-delegate.ts execute()
const impulseId = `remote-${remoteSessionId}`

await SessionMemory.addImpulse(ctx.sessionID, {
  id: impulseId,
  type: "remoteSession",  // New type for remote delegations
  scope: "session",
  pointer: {
    type: "acp",
    target: params.target,
    sessionId: remoteSessionId
  },
  description: params.taskDescription,
  budget: 2000,
  priority: "high",
  metadata: {
    // Connection info
    target: params.target,
    containerName: containerName,
    
    // Status tracking
    status: "initializing",  // initializing → processing → completed/failed
    startTime: Date.now(),
    lastUpdate: Date.now(),
    lastMessage: "",
    
    // Progress tracking
    messagesReceived: 0,
    toolCallsExecuted: [],
    processingDuration: 0,
    
    // Result tracking
    responseText: "",
    success: null,  // null until completion
    error: null
  }
})
```

**Benefits**:
- Host can query active remote sessions via `SessionMemory.getImpulsesByType("remoteSession")`
- UI can display delegation progress in real-time
- Failed delegations are preserved for debugging
- Delegation history is queryable

#### 2. Real-Time Status Updates

Update impulse metadata during delegation lifecycle:

```typescript
// Status update helper
async function updateRemoteSessionStatus(
  hostSessionId: string,
  impulseId: string,
  updates: {
    status?: "initializing" | "processing" | "completed" | "failed"
    lastMessage?: string
    messagesReceived?: number
    toolCallsExecuted?: string[]
    responseText?: string
    success?: boolean
    error?: string
  }
) {
  await SessionMemory.updateImpulse(hostSessionId, impulseId, {
    metadata: {
      ...updates,
      lastUpdate: Date.now(),
      processingDuration: Date.now() - startTime
    }
  })
}

// Call at key lifecycle points
await updateRemoteSessionStatus(ctx.sessionID, impulseId, {
  status: "initializing",
  lastMessage: "Creating remote session..."
})

// ... after session created
await updateRemoteSessionStatus(ctx.sessionID, impulseId, {
  status: "processing",
  lastMessage: "Executing prompt on remote agent..."
})

// ... in sessionUpdate callback
if (update.sessionUpdate === "agent_message_chunk") {
  await updateRemoteSessionStatus(ctx.sessionID, impulseId, {
    lastMessage: update.content.text.slice(0, 200),
    messagesReceived: messagesReceived + 1,
    responseText: responseText + update.content.text
  })
}

// ... on completion
await updateRemoteSessionStatus(ctx.sessionID, impulseId, {
  status: result.success ? "completed" : "failed",
  success: result.success,
  responseText: finalResponseText,
  error: result.error
})
```

**Benefits**:
- Real-time progress monitoring
- "Last seen alive" timestamps for timeout detection
- Message streaming visibility
- Historical record of all delegations

#### 3. Session Memory Agent Integration

Add helper functions for querying remote sessions:

```typescript
// In session-memory.ts

export namespace SessionMemory {
  /**
   * Get all active remote sessions
   */
  export async function getActiveRemoteSessions(
    sessionID: string
  ): Promise<ActivityTemplate.Impulse.Schema[]> {
    const store = await load(sessionID)
    
    return Object.values(store.impulses).filter(impulse => 
      impulse.type === "remoteSession" &&
      impulse.metadata?.status === "processing"
    )
  }
  
  /**
   * Get remote session by ID
   */
  export async function getRemoteSession(
    sessionID: string,
    remoteSessionId: string
  ): Promise<ActivityTemplate.Impulse.Schema | null> {
    const impulseId = `remote-${remoteSessionId}`
    return await getImpulse(sessionID, impulseId)
  }
  
  /**
   * Check if remote session is still alive
   */
  export async function isRemoteSessionAlive(
    sessionID: string,
    remoteSessionId: string,
    timeoutMs: number = 60000  // 1 minute default
  ): Promise<boolean> {
    const impulse = await getRemoteSession(sessionID, remoteSessionId)
    if (!impulse) return false
    
    const lastUpdate = impulse.metadata?.lastUpdate as number
    const now = Date.now()
    
    return (now - lastUpdate) < timeoutMs
  }
}
```

**Benefits**:
- Simple API for remote session management
- Timeout detection for stuck delegations
- Foundation for delegation orchestration

---

### Phase 4B: Pointer Seeding

#### 1. Pre-Resolve Pointers on Host

Before delegation, resolve all shared impulse pointers on the host:

```typescript
// In acp-delegate.ts

async function seedRemoteSessionWithContent(
  hostSessionId: string,
  remoteSessionId: string,
  impulseIds: string[]
): Promise<void> {
  const seededContent: Record<string, string> = {}
  
  for (const impulseId of impulseIds) {
    // Get impulse from host session
    const impulse = await SessionMemory.getImpulse(hostSessionId, impulseId)
    if (!impulse) {
      log.warn("impulse not found for seeding", { impulseId })
      continue
    }
    
    // Resolve pointer on host
    const content = await ImpulseResolver.resolveForPrompt(impulse)
    seededContent[impulseId] = content
    
    log.debug("resolved impulse for seeding", {
      impulseId,
      contentLength: content.length
    })
  }
  
  // Store seeded content in remote session memory
  // This creates impulses on the remote side with pre-resolved content
  for (const [impulseId, content] of Object.entries(seededContent)) {
    await remoteSessionMemoryAdd(remoteSessionId, {
      id: impulseId,
      type: "seededContent",
      scope: "session",
      pointer: {
        type: "memo",
        content: content
      },
      description: `Seeded from host session ${hostSessionId}`,
      budget: Math.ceil(content.length / 4),  // ~1 token per 4 chars
      loaded: true,  // Already loaded
      content: content
    })
  }
}
```

#### 2. Remote Session Memory Population

The remote agent should have access to seeded impulses immediately:

```typescript
// Seeding happens BEFORE sending the main prompt
await seedRemoteSessionWithContent(
  ctx.sessionID,
  remoteSessionId,
  params.shareImpulses || []
)

// Now when remote agent accesses impulses, they're already loaded
// No need for bidirectional fetch for initial context
```

**Benefits**:
- Zero latency for initial impulse access (already loaded)
- Reduces network traffic (no repeated bidirectional fetches)
- Guaranteed availability (no risk of host being unavailable)
- Foundation for offline remote agents

#### 3. Hybrid Approach (Best of Both Worlds)

Combine pointer sharing + seeding:

1. **Send pointers** in prompt (small payload)
2. **Seed high-priority impulses** before execution (instant access)
3. **Use bidirectional fetch** for on-demand content (fallback)

```typescript
// Categorize impulses by priority
const { highPriority, lowPriority } = categorizeImpulses(params.shareImpulses)

// Seed high-priority immediately (expected to be accessed)
await seedRemoteSessionWithContent(ctx.sessionID, remoteSessionId, highPriority)

// Include all pointers in prompt (lightweight)
const allPointers = await serializeImpulsesForSharing(
  ctx.sessionID,
  params.shareImpulses,
  false  // pointer-only
)

const finalPrompt = buildPromptWithImpulses(
  params.prompt,
  allPointers,
  ctx.sessionID,
  { seededIds: highPriority }  // Mark which are already seeded
)
```

**Priority Heuristics**:
- File impulses < 50KB → high priority (seed)
- Memo impulses → high priority (seed)
- Large files > 50KB → low priority (fetch on-demand)
- Activity outputs → medium priority (seed if < 100KB)

---

## Implementation Plan

### Phase 4A: Remote Session Tracking (2-3 hours)

**Tasks**:
1. Add `remoteSession` to impulse type union
2. Implement impulse creation in `acp-delegate.ts`
3. Add status update helper function
4. Update impulse at lifecycle points (init, process, complete, fail)
5. Add SessionMemory helper functions for querying
6. Test with end-to-end delegation

**Files to Modify**:
- `packages/opencode/src/session/activity-template.ts` (add type)
- `packages/opencode/src/tool/acp-delegate.ts` (impulse creation + updates)
- `packages/opencode/src/session/session-memory.ts` (query helpers)

**Success Criteria**:
- ✅ Remote session impulse created on delegation
- ✅ Impulse updated during processing
- ✅ Impulse marked complete/failed on finish
- ✅ Can query active remote sessions
- ✅ Can detect timeouts via lastUpdate timestamp

### Phase 4B: Pointer Seeding (3-4 hours)

**Tasks**:
1. Implement `seedRemoteSessionWithContent()` function
2. Add remote session memory population via ACP
3. Categorize impulses by priority (high/low)
4. Seed high-priority before prompt execution
5. Update prompt builder to indicate seeded impulses
6. Test seeding + bidirectional fetch fallback

**Files to Modify**:
- `packages/opencode/src/tool/acp-delegate.ts` (seeding logic)
- `packages/opencode/src/session/impulse-resolver.ts` (priority helpers)

**Success Criteria**:
- ✅ High-priority impulses seeded before execution
- ✅ Remote agent accesses seeded impulses instantly
- ✅ Low-priority impulses use bidirectional fetch
- ✅ Seeding doesn't increase latency significantly (< 500ms)
- ✅ Fallback to fetch works if seeding fails

### Phase 4C: Testing & Validation (1-2 hours)

**Test Scenarios**:
1. Single impulse delegation (file < 10KB)
2. Multiple impulse delegation (mix of sizes)
3. Large file delegation (> 50KB, low priority)
4. Remote session timeout detection
5. Query active remote sessions
6. Historical delegation query
7. Seeding failure + fallback to fetch

**Success Metrics**:
- ✅ 100% impulse creation reliability
- ✅ < 100ms status update latency
- ✅ < 500ms seeding overhead
- ✅ Zero data loss on failure
- ✅ Timeout detection within 60s

---

## API Examples

### Creating a Delegation with Tracking

```typescript
// User-facing API unchanged
await acp_delegate({
  target: "docker://devbob-cli",
  taskDescription: "Analyze dependencies",
  prompt: "Review package.json and suggest optimizations",
  shareImpulses: ["package-json", "lockfile"]
})

// Behind the scenes:
// 1. Creates impulse: remote-{sessionId}
// 2. Seeds "package-json" and "lockfile" (both < 50KB)
// 3. Updates impulse status: initializing → processing → completed
// 4. Remote agent accesses seeded impulses instantly (no fetch)
```

### Querying Active Remote Sessions

```typescript
// Get all active delegations
const activeSessions = await SessionMemory.getActiveRemoteSessions(sessionId)

console.log(`Active remote agents: ${activeSessions.length}`)
for (const session of activeSessions) {
  console.log(`- ${session.description}`)
  console.log(`  Status: ${session.metadata.status}`)
  console.log(`  Duration: ${session.metadata.processingDuration}ms`)
  console.log(`  Last message: ${session.metadata.lastMessage}`)
}
```

### Detecting Timeouts

```typescript
// Check if remote session is still alive
const isAlive = await SessionMemory.isRemoteSessionAlive(
  sessionId,
  remoteSessionId,
  60000  // 1 minute timeout
)

if (!isAlive) {
  console.warn("Remote session appears stuck or crashed")
  // Could trigger automatic retry or cleanup
}
```

---

## Performance Considerations

### Seeding Overhead

**Without Seeding**:
- Send pointers: ~200 bytes
- Remote fetches on-demand: 50-500ms per impulse
- Total latency: 50-500ms × N impulses

**With Seeding**:
- Resolve on host: 1-10ms per impulse
- Send resolved content: 10KB-100KB total
- Store in remote memory: 5-20ms per impulse
- Total overhead: 100-500ms upfront, 0ms during execution

**Trade-off**: Pay 100-500ms upfront to save 50-500ms × N during execution.

**Recommendation**: Seed impulses that are **guaranteed to be accessed** (high confidence).

### Status Update Frequency

**Options**:
1. **Every message chunk** (high frequency, high overhead)
2. **Every N chunks** (balanced)
3. **Time-based throttle** (e.g., max 1 update per 500ms)

**Recommendation**: Time-based throttle with 500ms minimum interval.

---

## Migration Strategy

### Backwards Compatibility

All changes are **additive** (no breaking changes):
- ✅ Existing delegations work without impulse tracking
- ✅ Impulse creation is automatic (opt-out via flag if needed)
- ✅ Seeding is optional (disabled if shareImpulses empty)
- ✅ Bidirectional fetch still works as fallback

### Rollout Plan

1. **Phase 4A** (Remote Session Tracking)
   - Deploy with impulse creation enabled by default
   - Monitor for performance impact (< 10ms expected)
   - Validate query APIs with real usage

2. **Phase 4B** (Pointer Seeding)
   - Deploy with seeding enabled for high-priority only
   - Monitor seeding overhead (< 500ms expected)
   - Tune priority heuristics based on usage

3. **Phase 4C** (Optimization)
   - Add configuration for seeding strategy
   - Implement adaptive seeding (learn from patterns)
   - Add metrics for seeding effectiveness

---

## Open Questions

1. **Seeding Strategy**: Should we seed all impulses or just high-priority?
   - **Recommendation**: High-priority only (< 50KB files + memos)

2. **Status Update Frequency**: How often to update impulse metadata?
   - **Recommendation**: Max 1 update per 500ms (time-based throttle)

3. **Remote Memory Persistence**: Should seeded content persist across remote restarts?
   - **Recommendation**: No (ephemeral, re-seed on reconnect)

4. **Timeout Handling**: What to do when remote session times out?
   - **Recommendation**: Mark impulse as failed, keep for debugging

5. **Multi-Delegation**: How to handle multiple concurrent delegations?
   - **Recommendation**: Each gets its own impulse, query returns all

---

## Success Criteria Summary

### Must Have ✅
- [ ] Remote session impulse created on delegation
- [ ] Status updated at key lifecycle points
- [ ] Can query active remote sessions
- [ ] Seeding works for high-priority impulses
- [ ] Bidirectional fetch fallback works
- [ ] < 500ms seeding overhead
- [ ] < 100ms status update latency
- [ ] Zero breaking changes

### Should Have ⭐
- [ ] Timeout detection via lastUpdate
- [ ] Historical delegation query
- [ ] Configurable seeding strategy
- [ ] Time-based update throttling

### Nice to Have 🎯
- [ ] Adaptive seeding (learn from patterns)
- [ ] Automatic retry on timeout
- [ ] Delegation orchestration (dependent tasks)
- [ ] Real-time progress UI

---

**Next Steps**: Implement Phase 4A (Remote Session Tracking) first, then Phase 4B (Pointer Seeding).
