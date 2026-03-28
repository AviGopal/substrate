# ACP Delegate + Impulse System Integration Plan

## Executive Summary

This plan enhances `acp_delegate` reliability and deeply integrates it with our impulse/session memory system to enable:

1. **Bidirectional Context Sharing**: Host → Remote and Remote → Host
2. **Remote Session Tracking**: Memory agent tracks delegated sessions as impulses
3. **Pointer Resolution**: Local pointers automatically resolve and populate remote session
4. **Live Status Updates**: Real-time visibility into remote agent progress

## Current State Analysis

### What We Have (acp-delegate.ts)

✅ **Basic delegation working**:
- Docker container discovery
- ACP connection via `docker exec`
- Activity-based timeout (idle detection)
- Explicit impulse sharing (`shareImpulses` parameter)
- Auto-selection via memory agent when no explicit impulses

✅ **Memory agent integration**:
- `SessionMemoryAgent.analyzeIntent()` selects relevant impulses
- Impulses serialized and injected as `<shared_impulses>` in prompt
- Session/activity state can be synced

### What's Missing

❌ **Remote session tracking**:
- No impulse created for delegated session
- Host can't monitor remote progress after delegation
- No historical record of remote agent activity

❌ **Pointer resolution for remote**:
- Current: Full content serialized and sent in prompt
- Needed: Remote should access pointers and resolve locally

❌ **Bidirectional updates**:
- Remote agent status not visible to host during execution
- No progress indication in host session memory
- Can't see what remote agent is working on

❌ **Session persistence**:
- Remote sessions created but not linked to host session
- No way to resume or inspect remote session later

## Enhanced Architecture

### Component Overview

```
┌────────────────────────────────────────────────────────────┐
│ Host Agent (Local OpenCode)                                │
│                                                             │
│  1. User requests delegation                               │
│  2. SessionMemoryAgent selects context                     │
│  3. Create "remote-session" impulse                        │
│  4. Serialize pointers (not full content)                  │
│  5. Send to remote via ACP                                 │
│                                                             │
│  [Impulse: remote-session-abc123]                          │
│   - sessionId: remote-xyz                                  │
│   - status: "processing"                                   │
│   - lastUpdate: "Working on feature X..."                  │
│   - duration: 45s                                          │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   │ ACP Protocol (JSON-RPC)
                   │ + Impulse Pointers
                   ↓
┌────────────────────────────────────────────────────────────┐
│ Remote Agent (Container OpenCode)                          │
│                                                             │
│  1. Receive prompt + pointer manifest                      │
│  2. Resolve pointers locally:                              │
│     - file:// → read local file                            │
│     - metabob:// → query local Metabob                     │
│     - memo:// → use embedded content                       │
│     - host-file:// → request from host                     │
│  3. Load resolved content as impulses                      │
│  4. Execute task with full context                         │
│  5. Stream progress back to host                           │
│                                                             │
│  [Session: remote-xyz]                                     │
│   - Impulses loaded: 5                                     │
│   - Working on: feature implementation                     │
│   - Progress: 60%                                          │
└────────────────────────────────────────────────────────────┘
```

### Key Enhancements

#### 1. Remote Session Impulse

When delegation starts, create an impulse to track the remote session:

```typescript
// In acp-delegate.ts execute()
const remoteSessionImpulse = await SessionMemory.createImpulse({
  id: `remote-session-${remoteSessionId}`,
  type: "remoteSession",
  pointer: {
    type: "acp",
    target: params.target,
    sessionId: remoteSessionId,
  },
  content: "", // Populated by updates
  priority: "high",
  budget: 2000,
  metadata: {
    target: params.target,
    taskDescription: params.taskDescription,
    startTime: Date.now(),
    status: "connecting",
    lastUpdate: null,
    duration: 0,
  }
})
```

**Benefits**:
- Host can see all delegated sessions in memory
- Memory agent can reference remote session history
- Progress visible in session context

#### 2. Pointer-Based Sharing

Instead of serializing full content, send pointer manifests:

```typescript
// OLD (Current):
{
  impulses: [
    { id: "file-123", content: "... 50KB of file content ...", type: "file" }
  ]
}

// NEW (Pointer-based):
{
  pointers: [
    { 
      id: "file-123", 
      type: "file",
      pointer: { type: "file", path: "src/app.ts" },
      budget: 3000
    },
    {
      id: "metabob-456",
      type: "metabobIssue",
      pointer: { type: "metabobIssue", issueId: "issue-789" },
      budget: 2000
    },
    {
      id: "host-file-890",
      type: "hostFile", 
      pointer: { type: "hostFile", path: "/host/specific/file.ts" },
      content: "... content for files not in remote ...",
      budget: 2000
    }
  ]
}
```

**Pointer Resolution Logic** (in remote):

```typescript
async function resolvePointer(pointer: ImpulsePointer): Promise<string> {
  switch (pointer.type) {
    case "file":
      // File in remote filesystem
      return await Bun.file(pointer.path).text()
    
    case "metabobIssue":
      // Query remote Metabob instance
      return await MetabobClient.getIssue(pointer.issueId)
    
    case "memo":
      // Already resolved (embedded content)
      return pointer.content
    
    case "hostFile":
      // File only exists on host - content provided
      return pointer.content
    
    case "acp":
      // Reference to another remote session
      return await ACPClient.getSessionState(pointer.sessionId)
  }
}
```

**Benefits**:
- Smaller prompts (pointers instead of content)
- Remote can access files in its own filesystem
- Remote can query its own Metabob instance
- Host-specific files still shareable

#### 3. Live Progress Updates

Update the remote session impulse as execution progresses:

```typescript
// In sessionUpdate callback
client.sessionUpdate = async (params: SessionNotification) => {
  const update = params.update as any
  lastActivityTime = Date.now()
  
  // Extract meaningful progress
  let progressUpdate: string | null = null
  
  if (update.sessionUpdate === "agent_message_chunk") {
    // Capture latest message
    progressUpdate = update.content?.text || null
  } else if (update.sessionUpdate === "tool_call") {
    progressUpdate = `Using tool: ${update.title}`
  }
  
  // Update impulse in host session
  if (progressUpdate) {
    await SessionMemory.updateImpulse(ctx.sessionID, remoteSessionImpulse.id, {
      content: progressUpdate,
      metadata: {
        ...remoteSessionImpulse.metadata,
        status: "processing",
        lastUpdate: progressUpdate,
        duration: Date.now() - startTime,
      }
    })
  }
  
  // Continue with existing logic...
}
```

**Benefits**:
- Host sees what remote is doing in real-time
- Memory agent can report on delegation progress
- Debugging easier (see where remote got stuck)

#### 4. Pointer Manifest Protocol

Extend ACP protocol to support pointer manifests:

```typescript
// In buildPromptWithImpulses()
function buildPromptWithPointers(
  prompt: string,
  pointers: PointerManifest[]
): string {
  const manifestXml = pointers.map(p => `
<impulse_pointer id="${p.id}" type="${p.type}" budget="${p.budget}">
  ${serializePointer(p.pointer)}
</impulse_pointer>
  `).join('\n')
  
  return `${prompt}

<impulse_manifest>
The calling agent has shared the following context pointers.
Resolve these pointers locally before executing the task:

${manifestXml}

Pointer Resolution:
- file:// → Read from your local filesystem
- metabob:// → Query your Metabob instance
- memo:// → Content embedded below
- hostFile:// → Content provided by host (file doesn't exist in your filesystem)

Use the impulse_resolve tool to load pointer content into your session memory.
</impulse_manifest>

<delegation_guidance>
You are working as a delegated agent. Best practices:
1. **Resolve pointers first**: Use impulse_resolve tool for each pointer
2. Use activity templates for structured work (search_activities first)
3. After completing work, use metabob_annotate_component to document key decisions
4. If you change API contracts, add MESSAGE_FOR: annotations for other agents
5. Be concise in your response - the calling agent will see your output
</delegation_guidance>`
}
```

#### 5. New Tool: impulse_resolve (Remote Agent)

Add a tool to remote agent for resolving pointers:

```typescript
export const ImpulseResolveTool = Tool.define("impulse_resolve", {
  description: `Resolve an impulse pointer and load content into session memory.
  
  Use this when you receive impulse_pointers in the prompt. This tool:
  1. Resolves the pointer based on type (file, metabob, memo, etc.)
  2. Loads the content into your session memory
  3. Makes it available for your task execution
  
  Call this for each pointer in the manifest before starting work.`,
  
  parameters: z.object({
    pointerId: z.string().describe("ID of the pointer to resolve"),
  }),
  
  async execute(params, ctx) {
    // Get pointer from session context (injected by ACP delegate)
    const pointers = ctx.extra?.["impulsePointers"] as PointerManifest[] | undefined
    const pointer = pointers?.find(p => p.id === params.pointerId)
    
    if (!pointer) {
      return {
        title: "Pointer not found",
        output: `No pointer found with ID: ${params.pointerId}`,
        metadata: { success: false }
      }
    }
    
    // Resolve pointer to content
    const content = await resolvePointer(pointer.pointer)
    
    // Create impulse in local session
    await SessionMemory.createImpulse({
      id: pointer.id,
      type: pointer.type,
      pointer: pointer.pointer,
      content,
      priority: "high",
      budget: pointer.budget,
    })
    
    return {
      title: `Resolved: ${pointer.id}`,
      output: `Loaded ${content.length} chars of ${pointer.type} content`,
      metadata: { 
        success: true,
        pointerId: params.pointerId,
        contentLength: content.length,
        type: pointer.type,
      }
    }
  }
})
```

## Implementation Phases

### Phase 1: Remote Session Impulse (Foundation)

**Goal**: Track delegated sessions as impulses in host session

**Files to modify**:
- `src/tool/acp-delegate.ts`
- `src/session/session-memory.ts` (add "remoteSession" type)
- `src/session/activity-template.ts` (extend Impulse.Pointer schema)

**Changes**:
1. Add `remoteSession` type to impulse types
2. Create impulse on delegation start
3. Update impulse on progress events
4. Final update on completion/failure

**Testing**:
```typescript
// Test that remote session impulse is created
const result = await acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Test impulse tracking",
  prompt: "List files in /workspace"
})

// Check impulse was created
const impulses = await SessionMemory.listImpulses(sessionID)
const remoteImpulse = impulses.find(i => i.id.startsWith("remote-session-"))
assert(remoteImpulse !== undefined)
assert(remoteImpulse.metadata.status === "completed")
```

**Deliverable**: Remote sessions tracked in host memory ✓

---

### Phase 2: Pointer Serialization (Efficiency)

**Goal**: Send pointers instead of full content to remote

**Files to modify**:
- `src/tool/acp-delegate.ts` (serializeImpulses → serializePointers)
- `src/session/impulse-resolver.ts` (add pointer resolution logic)

**Changes**:
1. Change `serializeImpulses()` to return pointer manifests
2. Add logic to detect if file exists in remote vs host
3. Embed content only for host-specific files
4. Send pointer manifest in ACP prompt

**Pointer Detection Logic**:
```typescript
function shouldEmbedContent(impulse: Impulse, remoteFs: RemoteFilesystem): boolean {
  if (impulse.pointer.type === "file") {
    // Check if file exists in remote
    return !remoteFs.exists(impulse.pointer.path)
  }
  
  if (impulse.pointer.type === "metabobIssue") {
    // Remote has its own Metabob - no need to embed
    return false
  }
  
  if (impulse.pointer.type === "memo") {
    // Always embed memos (small, host-created)
    return true
  }
  
  return false
}
```

**Testing**:
```typescript
// Test pointer serialization
const pointers = await serializePointersForRemote(impulseIds, sessionID, remoteTarget)

// File exists in both → pointer only
assert(pointers[0].type === "file")
assert(pointers[0].pointer.type === "file")
assert(pointers[0].content === undefined)

// File only on host → embedded
assert(pointers[1].type === "hostFile")
assert(pointers[1].content !== undefined)
```

**Deliverable**: Efficient pointer-based sharing ✓

---

### Phase 3: Remote Pointer Resolution (Remote Agent Enhancement)

**Goal**: Remote agent resolves pointers locally

**Files to modify**:
- `src/tool/impulse-resolve.ts` (new file)
- `src/session/impulse-resolver.ts` (add `resolvePointer()` function)
- `src/session/system.ts` (add impulse_resolve tool to remote agent)

**Changes**:
1. Create `impulse_resolve` tool
2. Inject pointer manifest into remote session context
3. Add system prompt guidance to use tool
4. Implement pointer resolution logic

**System Prompt Addition**:
```typescript
// In remote agent system prompt
if (ctx.extra?.["impulsePointers"]) {
  systemPrompt.push(`
## Available Context Pointers

The delegating agent has shared ${ctx.extra.impulsePointers.length} context pointers.
**You MUST resolve these before starting work** using the impulse_resolve tool.

Pointers to resolve:
${ctx.extra.impulsePointers.map(p => `- ${p.id} (${p.type})`).join('\n')}

Example:
impulse_resolve({ pointerId: "${ctx.extra.impulsePointers[0].id}" })
`)
}
```

**Testing**:
```typescript
// Test pointer resolution in remote
const result = await acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Test pointer resolution",
  prompt: "Resolve all pointers, then list loaded impulses",
  shareImpulses: ["file-abc", "metabob-def"]
})

// Remote should have resolved pointers
assert(result.output.includes("Resolved: file-abc"))
assert(result.output.includes("Resolved: metabob-def"))
```

**Deliverable**: Remote resolves pointers autonomously ✓

---

### Phase 4: Live Progress Updates (Bidirectional Sync)

**Goal**: Host sees remote agent progress in real-time

**Files to modify**:
- `src/tool/acp-delegate.ts` (enhance sessionUpdate callback)
- `src/session/session-memory.ts` (add updateImpulse() function)

**Changes**:
1. Update remote session impulse on every progress event
2. Extract meaningful progress messages
3. Update status, lastUpdate, duration fields
4. Make updates visible in host session context

**Progress Extraction Logic**:
```typescript
function extractProgress(update: SessionUpdate): ProgressInfo | null {
  if (update.sessionUpdate === "agent_message_chunk") {
    // Latest agent message
    return {
      type: "message",
      text: update.content?.text,
      timestamp: Date.now(),
    }
  }
  
  if (update.sessionUpdate === "tool_call") {
    // Tool being used
    return {
      type: "tool",
      text: `Using: ${update.title}`,
      timestamp: Date.now(),
    }
  }
  
  if (update.sessionUpdate === "activity_progress") {
    // Activity completion percentage
    return {
      type: "activity",
      text: `Activity: ${update.taskIndex}/${update.totalTasks} (${update.progress}%)`,
      timestamp: Date.now(),
    }
  }
  
  return null
}
```

**Testing**:
```typescript
// Test live updates
const result = await acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Long-running task",
  prompt: "Execute add-feature-complete activity"
})

// During execution, check impulse updates
const impulse = await SessionMemory.getImpulse(sessionID, `remote-session-${result.metadata.sessionId}`)

assert(impulse.metadata.status === "completed")
assert(impulse.metadata.duration > 0)
assert(impulse.metadata.lastUpdate !== null)
```

**Deliverable**: Real-time progress tracking ✓

---

### Phase 5: Memory Agent Integration (Intelligence Layer)

**Goal**: Memory agent understands and reports on delegations

**Files to modify**:
- `src/session/memory-agent.ts` (add delegation awareness)
- `src/session/session-memory.ts` (add query for remote sessions)

**Changes**:
1. Memory agent recognizes remote session impulses
2. Can report on active delegations
3. Suggests relevant remote sessions for context
4. Learns from delegation patterns

**Memory Agent Enhancement**:
```typescript
// In SessionMemoryAgent.analyzeIntent()

// Check for active delegations
const remoteSessions = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession"
})

const activeRemote = remoteSessions.find(rs => 
  rs.metadata.status === "processing"
)

if (activeRemote) {
  intent.suggestedImpulses.push({
    id: activeRemote.id,
    type: "remoteSession",
    description: `Active delegation: ${activeRemote.metadata.taskDescription}`,
    priority: "high",
    budget: 2000,
    pointer: activeRemote.pointer,
  })
}

// Learn from past delegations
const completedRemote = remoteSessions.filter(rs =>
  rs.metadata.status === "completed" &&
  rs.metadata.taskDescription.toLowerCase().includes(intent.keywords)
)

if (completedRemote.length > 0) {
  // Past delegation is relevant context
  intent.suggestedImpulses.push({
    id: `past-delegation-${completedRemote[0].id}`,
    type: "remoteSession",
    description: `Previous similar work: ${completedRemote[0].metadata.taskDescription}`,
    priority: "medium",
    budget: 1500,
    pointer: completedRemote[0].pointer,
  })
}
```

**Testing**:
```typescript
// Test memory agent delegation awareness
await acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Implement feature X",
  prompt: "Add feature X"
})

// Memory agent should suggest this for related queries
const intent = await SessionMemoryAgent.analyzeIntent({
  sessionID,
  promptText: "What's the status of feature X?"
})

assert(intent.suggestedImpulses.some(i => 
  i.type === "remoteSession" &&
  i.description.includes("feature X")
))
```

**Deliverable**: Intelligent delegation awareness ✓

## Schema Changes

### 1. Impulse Type Extension

```typescript
// In activity-template.ts Impulse.Schema

export const PointerSchema = z.union([
  // ... existing pointer types ...
  
  // NEW: Remote session pointer
  z.object({
    type: z.literal("acp"),
    target: z.string(), // docker://container or ssh://host
    sessionId: z.string(),
  }),
  
  // NEW: Host-specific file (embedded)
  z.object({
    type: z.literal("hostFile"),
    path: z.string(),
    content: z.string(), // Embedded content
  }),
])

export const Schema = z.object({
  // ... existing fields ...
  
  metadata: z.record(z.any()).optional(), // Add metadata field for tracking
})
```

### 2. Pointer Manifest Protocol

```typescript
// New type for pointer manifests
export interface PointerManifest {
  id: string
  type: string
  pointer: ActivityTemplate.Impulse.Pointer
  budget: number
  content?: string // Only if pointer can't be resolved remotely
}

// ACP protocol extension
export interface ACPNewSessionParams {
  cwd: string
  mcpServers: string[]
  impulsePointers?: PointerManifest[] // NEW: Pointer manifest
}
```

### 3. Remote Session Metadata

```typescript
export interface RemoteSessionMetadata {
  target: string // docker://devbob-clean
  taskDescription: string
  startTime: number
  endTime?: number
  status: "connecting" | "processing" | "completed" | "failed"
  lastUpdate: string | null // Latest progress message
  duration: number // Milliseconds
  toolsUsed: string[]
  responseLength: number
}
```

## API Changes

### SessionMemory.updateImpulse()

```typescript
/**
 * Update an existing impulse's content and metadata
 * Used for live progress updates of remote sessions
 */
export async function updateImpulse(
  sessionID: string,
  impulseId: string,
  updates: {
    content?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  const store = await load(sessionID)
  const impulse = store.impulses[impulseId]
  
  if (!impulse) {
    throw new Error(`Impulse not found: ${impulseId}`)
  }
  
  // Update fields
  if (updates.content !== undefined) {
    impulse.content = updates.content
  }
  
  if (updates.metadata !== undefined) {
    impulse.metadata = { ...impulse.metadata, ...updates.metadata }
  }
  
  await save(store)
  
  // Emit update event
  Bus.emit(Event.Updated, {
    sessionID,
    impulses: Object.values(store.impulses),
    stats: { /* ... */ }
  })
}
```

### SessionMemory.listImpulses() Enhancement

```typescript
/**
 * List impulses with optional filtering
 */
export async function listImpulses(
  sessionID: string,
  filter?: {
    type?: string
    status?: string
    minPriority?: "high" | "medium" | "low"
  }
): Promise<ActivityTemplate.Impulse.Schema[]> {
  const store = await load(sessionID)
  let impulses = Object.values(store.impulses)
  
  if (filter?.type) {
    impulses = impulses.filter(i => i.type === filter.type)
  }
  
  if (filter?.status) {
    impulses = impulses.filter(i => i.metadata?.status === filter.status)
  }
  
  if (filter?.minPriority) {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    const minLevel = priorityOrder[filter.minPriority]
    impulses = impulses.filter(i => 
      priorityOrder[i.priority as keyof typeof priorityOrder] >= minLevel
    )
  }
  
  return impulses
}
```

## Benefits Summary

### Reliability Improvements

1. **Better failure visibility**: Track where delegation fails
2. **Progress monitoring**: Know if remote is stuck vs. working
3. **Timeout refinement**: See what remote was doing when timeout occurred
4. **Error context**: Full visibility into remote tool failures

### Efficiency Improvements

1. **Smaller prompts**: Pointers instead of full content (10x-100x reduction)
2. **Remote-local resolution**: Files read from remote filesystem
3. **Parallel Metabob**: Remote queries its own Metabob instance
4. **Reduced network**: Only serialize host-specific content

### Intelligence Improvements

1. **Delegation history**: Memory agent learns from past delegations
2. **Context suggestions**: Relevant remote sessions auto-suggested
3. **Pattern recognition**: Similar tasks routed to same remote
4. **Progress awareness**: Host knows what remote is working on

### User Experience Improvements

1. **Live feedback**: See remote progress in real-time
2. **Transparency**: Know what's being shared and why
3. **Debugging**: Full trace of delegation lifecycle
4. **Session management**: Resume or inspect remote sessions later

## Rollout Strategy

### Phase 1 (Week 1): Foundation
- Implement remote session impulse tracking
- Update host session memory as delegation progresses
- Add basic testing

### Phase 2 (Week 2): Efficiency
- Implement pointer-based serialization
- Add pointer resolution logic
- Test with large contexts

### Phase 3 (Week 3): Remote Enhancement
- Add impulse_resolve tool to remote agent
- Implement pointer resolution in remote
- Test cross-container scenarios

### Phase 4 (Week 4): Intelligence
- Enhance memory agent delegation awareness
- Add delegation pattern learning
- Implement context suggestions

### Phase 5 (Week 5): Polish & Testing
- Comprehensive testing suite
- Performance benchmarking
- Documentation and examples

## Success Metrics

- **Reliability**: 95%+ delegation success rate
- **Efficiency**: 10x reduction in prompt size for file-heavy contexts
- **Latency**: <500ms overhead for pointer resolution
- **Intelligence**: 80%+ accuracy in context suggestion
- **User Satisfaction**: Positive feedback on progress visibility

## Risk Mitigation

### Risk: Pointer resolution failures
**Mitigation**: Fallback to embedded content if resolution fails

### Risk: Performance overhead of live updates
**Mitigation**: Throttle updates to max 1/second, batch when possible

### Risk: Memory agent overhead
**Mitigation**: Strict timeout (3s), graceful degradation if unavailable

### Risk: Remote filesystem differences
**Mitigation**: Detect file existence before sending pointers

### Risk: ACP protocol changes breaking compatibility
**Mitigation**: Version negotiation, backward compatibility layer

## Next Steps

1. **Review this plan** with team
2. **Prioritize phases** based on immediate needs
3. **Start with Phase 1** (foundation) - lowest risk, high value
4. **Iterate based on feedback** from early phases
5. **Document learnings** for future delegation enhancements

---

**Status**: Ready for implementation
**Estimated effort**: 5 weeks (1 phase per week)
**Dependencies**: None (builds on existing systems)
**Priority**: High (improves core delegation reliability)
