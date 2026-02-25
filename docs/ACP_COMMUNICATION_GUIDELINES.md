# ACP Communication Guidelines for Activity & Impulse Tracking

**Date**: 2026-02-24  
**Status**: 🎯 **DESIGN - READY FOR IMPLEMENTATION**  
**Purpose**: Define custom ACP extensions for activity execution tracking, impulse synchronization, and session coordination

---

## Executive Summary

### The Challenge

**Current State**:
- ACP (Agent Client Protocol) enables basic agent-to-agent delegation
- Standard ACP v1.0 provides: `initialize`, `session/new`, `session/prompt`, `session/messages`
- ✅ Works for simple task delegation
- ❌ Lacks activity execution tracking
- ❌ No impulse synchronization primitives
- ❌ No session state coordination

**What We Need**:
1. **Activity Execution Tracking**: Remote agents report progress, tool usage, validation results
2. **Impulse Synchronization**: Bidirectional content resolution with caching
3. **Session Coordination**: Multi-agent sessions share state across containers
4. **Metrics Integration**: Remote activities contribute to learning loop metrics

### Communication Goals

```
┌─────────────────────────────────────────────────────────────────┐
│ Goal 1: Activity Execution Visibility                           │
│ Host delegates → Remote executes → Host tracks every step       │
│ Enables: Progress monitoring, tool call tracking, early abort   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Goal 2: Impulse Content Resolution                              │
│ Pointer-only sharing → Remote resolves locally → Host fallback  │
│ Enables: 90%+ bandwidth reduction, lazy loading, caching        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Goal 3: Session State Synchronization                           │
│ Multiple containers → Shared session state → Consistent context │
│ Enables: Multi-agent workflows, parallel execution, handoffs    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Goal 4: Learning Loop Integration                               │
│ Remote activities → Metrics to backend → Template improvement   │
│ Enables: Distributed learning, container-specific metrics       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

### Layered Communication Model

```
┌───────────────────────────────────────────────────────────────────┐
│ Layer 4: Application Protocol (Activity-Specific)                │
│ - activity/start, activity/progress, activity/complete           │
│ - impulse/request-content, impulse/sync                          │
│ - session/sync-state, session/handoff                            │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ Layer 3: Custom ACP Extensions (OpenCode-Specific)               │
│ - activity/* namespace - Activity execution tracking             │
│ - impulse/* namespace - Content resolution & caching             │
│ - session/* namespace - State synchronization                    │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ Layer 2: Standard ACP v1.0 (Base Protocol)                       │
│ - initialize, session/new, session/prompt, session/messages      │
│ - Provided by @agentclientprotocol/sdk                           │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ Layer 1: Transport (JSON-RPC over stdio/HTTP)                    │
│ - docker exec -i opencode acp (stdio)                            │
│ - SSH with stdio forwarding                                      │
│ - HTTP/SSE (future: for web clients)                             │
└───────────────────────────────────────────────────────────────────┘
```

---

## Custom ACP Extensions Design

### Extension Namespace: `activity/*`

#### Purpose
Track activity execution lifecycle across distributed agents

#### Methods

##### 1. `activity/start`

**Request**:
```typescript
{
  method: "activity/start",
  params: {
    activityId: string,           // Unique activity execution ID
    templateId: string,            // Template being executed
    hostSessionId: string,         // Calling session (for bidirectional comms)
    remoteSessionId: string,       // Remote ACP session ID
    variables: Record<string, any>, // Activity variables
    taskCount: number,             // Total tasks in activity
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  activityId: string,
  startedAt: number,             // Unix timestamp (ms)
}
```

**Use Case**:
```typescript
// Host delegates activity to remote container
const result = await acp_delegate({
  target: "docker://devbob-backend",
  prompt: "Execute activity: add-rest-endpoint"
})

// Remote agent receives prompt, starts activity, calls:
await connection.request("activity/start", {
  activityId: "act_abc123",
  templateId: "add-rest-endpoint",
  hostSessionId: ctx.sessionID,
  remoteSessionId: remoteSessionId,
  variables: { method: "POST", path: "/api/users" },
  taskCount: 5
})
```

##### 2. `activity/progress`

**Request**:
```typescript
{
  method: "activity/progress",
  params: {
    activityId: string,
    currentTask: number,           // Current task index (1-based)
    taskDescription: string,       // Human-readable task description
    status: "running" | "validation" | "retry",
    toolsUsed: string[],          // Tools called in this task
    metadata?: {
      filesModified?: string[],
      testsRun?: number,
      validationResults?: any,
    }
  }
}
```

**Response**:
```typescript
{
  acknowledged: boolean,
  shouldContinue: boolean,       // False = host requests abort
}
```

**Use Case**:
```typescript
// Remote agent reports progress during execution
for (const task of activity.tasks) {
  await connection.request("activity/progress", {
    activityId: "act_abc123",
    currentTask: taskIndex + 1,
    taskDescription: task.description,
    status: "running",
    toolsUsed: ["read", "edit", "bash"]
  })
  
  // Execute task...
}
```

##### 3. `activity/complete`

**Request**:
```typescript
{
  method: "activity/complete",
  params: {
    activityId: string,
    success: boolean,
    duration: number,              // milliseconds
    tokensUsed: {
      input: number,
      output: number,
      cache: number,
    },
    tasksCompleted: number,
    tasksSkipped: number,
    validation: {
      passed: boolean,
      errors: string[],
    },
    artifacts?: {
      filesCreated: string[],
      filesModified: string[],
      commitHash?: string,
    }
  }
}
```

**Response**:
```typescript
{
  acknowledged: boolean,
  metricsRecorded: boolean,      // True if metrics sent to backend
}
```

---

### Extension Namespace: `impulse/*`

#### Purpose
Bidirectional impulse content resolution with caching

#### Methods

##### 1. `impulse/request-content`

**Request**:
```typescript
{
  method: "impulse/request-content",
  params: {
    hostSessionId: string,         // Session that shared the impulse
    impulseId: string,             // Impulse to resolve
    reason: "local-resolution-failed" | "cache-miss" | "explicit-request"
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  impulseId: string,
  content: string,                // Resolved content
  contentHash: string,            // SHA-256 for caching
  ttl?: number,                   // Cache TTL in seconds (optional)
}
```

**Use Case**:
```typescript
// Phase 3: Bidirectional resolution
// Remote agent tries local resolution first
const impulse = parseImpulseFromPrompt(prompt)
let content: string

try {
  // Step 1: Try local resolution (Phase 2)
  content = await ImpulseResolver.resolveForPrompt(impulse)
} catch (error) {
  // Step 2: Fallback to host fetch (Phase 3)
  const result = await connection.request("impulse/request-content", {
    hostSessionId: hostSessionId, // From prompt context
    impulseId: impulse.id,
    reason: "local-resolution-failed"
  })
  
  content = result.content
  
  // Cache for future use
  await ImpulseCache.set(impulse.id, content, result.contentHash)
}
```

##### 2. `impulse/sync-cache`

**Request**:
```typescript
{
  method: "impulse/sync-cache",
  params: {
    impulseIds: string[],          // Impulses to prefetch
    priority: "high" | "medium" | "low"
  }
}
```

**Response**:
```typescript
{
  synced: string[],                // Successfully cached impulse IDs
  failed: string[],                // Failed to resolve
  totalSize: number,               // Bytes cached
}
```

**Use Case**:
```typescript
// Proactive cache warming before delegation
await connection.request("impulse/sync-cache", {
  impulseIds: ["design-doc", "api-spec", "test-strategy"],
  priority: "high"
})

// Now delegate with confidence that content is cached
await acp_delegate({
  target: "docker://devbob-backend",
  shareImpulses: ["design-doc", "api-spec", "test-strategy"]
})
```

---

### Extension Namespace: `session/*`

#### Purpose
Multi-agent session state synchronization

#### Methods

##### 1. `session/sync-state`

**Request**:
```typescript
{
  method: "session/sync-state",
  params: {
    sessionId: string,
    state: {
      impulses?: Record<string, ActivityTemplate.Impulse.Schema>,
      todos?: Array<{ id: string, content: string, status: string }>,
      context?: Record<string, any>,
    },
    syncDirection: "push" | "pull" | "bidirectional"
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  syncedAt: number,
  conflictResolution?: {
    strategy: "host-wins" | "remote-wins" | "merge",
    conflicts: string[],
  }
}
```

**Use Case**:
```typescript
// Sync session state between containers
await connection.request("session/sync-state", {
  sessionId: "main-session",
  state: {
    todos: currentTodos,
    impulses: sharedImpulses,
  },
  syncDirection: "bidirectional"
})
```

##### 2. `session/handoff`

**Request**:
```typescript
{
  method: "session/handoff",
  params: {
    fromSessionId: string,
    toSessionId: string,
    reason: string,                // Why handoff is happening
    state: {
      impulses: Record<string, ActivityTemplate.Impulse.Schema>,
      todos: any[],
      context: Record<string, any>,
    }
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  newSessionId: string,          // May create new session
  resumeInstructions: string,    // How to continue work
}
```

**Use Case**:
```typescript
// Hand off work from frontend agent to backend agent
await connection.request("session/handoff", {
  fromSessionId: "frontend-session",
  toSessionId: "backend-session",
  reason: "Frontend complete, backend API implementation needed",
  state: {
    impulses: { "api-design": apiDesignImpulse },
    todos: remainingBackendTodos,
    context: { completedFiles: ["src/components/UserForm.tsx"] }
  }
})
```

---

## Implementation Guidelines

### Guideline 1: Activity Execution Tracking

**Requirement**: All remote activity executions MUST report progress

**Implementation**:
```typescript
// In ActivityTool.execute() when running in remote container
async function executeRemoteActivity(activity: Activity) {
  // Detect if running remotely
  const isRemote = process.env.ACP_REMOTE === "true"
  const connection = isRemote ? getACPConnection() : null
  
  if (connection) {
    // Report start
    await connection.request("activity/start", {
      activityId: activity.id,
      templateId: activity.templateId,
      hostSessionId: process.env.ACP_HOST_SESSION_ID,
      remoteSessionId: process.env.ACP_SESSION_ID,
      variables: activity.variables,
      taskCount: activity.tasks.length,
    })
  }
  
  // Execute tasks with progress reporting
  for (const [index, task] of activity.tasks.entries()) {
    if (connection) {
      await connection.request("activity/progress", {
        activityId: activity.id,
        currentTask: index + 1,
        taskDescription: task.description,
        status: "running",
        toolsUsed: [],
      })
    }
    
    // Execute task...
    const result = await executeTask(task)
    
    // Update progress with results
    if (connection) {
      await connection.request("activity/progress", {
        activityId: activity.id,
        currentTask: index + 1,
        taskDescription: task.description,
        status: result.validation.passed ? "completed" : "retry",
        toolsUsed: result.toolsUsed,
        metadata: {
          filesModified: result.filesModified,
          testsRun: result.testsRun,
          validationResults: result.validation,
        }
      })
    }
  }
  
  // Report completion
  if (connection) {
    await connection.request("activity/complete", {
      activityId: activity.id,
      success: allTasksPassed,
      duration: Date.now() - startTime,
      tokensUsed: activity.metrics.tokens,
      tasksCompleted: completedTasks,
      tasksSkipped: skippedTasks,
      validation: finalValidation,
      artifacts: {
        filesCreated: result.filesCreated,
        filesModified: result.filesModified,
        commitHash: result.commitHash,
      }
    })
  }
}
```

**Benefits**:
- ✅ Host can monitor progress in real-time
- ✅ Early abort on validation failures
- ✅ Tool usage tracking for debugging
- ✅ Metrics contribute to learning loop

---

### Guideline 2: Impulse Content Resolution

**Requirement**: Use pointer-only sharing by default, with bidirectional fallback

**Phase 2: Pointer-Only Sharing (Current)**:
```typescript
// Host serializes impulses without content (90% size reduction)
const sharedImpulses = ImpulseSerializer.serializeMany(impulses)

// Inject into prompt
const prompt = buildPromptWithImpulses(userPrompt, sharedImpulses, hostSessionId)
```

**Phase 3: Bidirectional Resolution (Custom Extension)**:
```typescript
// Remote agent resolves impulses
for (const impulse of sharedImpulses) {
  let content: string
  
  try {
    // Step 1: Local resolution (file pointer, activity output, etc.)
    content = await ImpulseResolver.resolveForPrompt(impulse)
  } catch (error) {
    // Step 2: Request from host via ACP
    const result = await connection.request("impulse/request-content", {
      hostSessionId: hostSessionId,
      impulseId: impulse.id,
      reason: "local-resolution-failed"
    })
    
    content = result.content
    
    // Cache for future requests
    await ImpulseCache.set(impulse.id, content, result.contentHash)
  }
  
  // Use resolved content
  contextItems.push({ type: "text", text: content })
}
```

**Host Implementation**:
```typescript
// ACP server handles impulse/request-content
server.on("impulse/request-content", async (params) => {
  const { hostSessionId, impulseId } = params
  
  // Retrieve impulse from host session
  const impulse = await SessionMemory.getImpulse(hostSessionId, impulseId)
  
  if (!impulse) {
    return { success: false, error: "Impulse not found" }
  }
  
  // Resolve content on host
  const content = await ImpulseResolver.resolveForPrompt(impulse)
  const contentHash = crypto.createHash("sha256").update(content).digest("hex")
  
  return {
    success: true,
    impulseId,
    content,
    contentHash,
    ttl: 3600, // Cache for 1 hour
  }
})
```

**Benefits**:
- ✅ 90%+ bandwidth reduction (pointer-only by default)
- ✅ Automatic fallback when local resolution fails
- ✅ Caching prevents redundant requests
- ✅ Works across any transport (docker, ssh, http)

---

### Guideline 3: Session State Synchronization

**Requirement**: Shared sessions across containers maintain consistent state

**Use Case**: Multi-container workflow

```typescript
// Container 1: Frontend agent creates design impulse
await impulse_create({
  id: "ui-design",
  type: "memo",
  content: "UI Design:\n- User profile page\n- Dashboard layout\n- Navigation menu",
  budget: 2000
})

// Sync to backend container
await connection.request("session/sync-state", {
  sessionId: "shared-feature-session",
  state: {
    impulses: { "ui-design": uiDesignImpulse },
    todos: [
      { id: "1", content: "Implement backend API", status: "pending" },
      { id: "2", content: "Create frontend components", status: "completed" }
    ]
  },
  syncDirection: "push"
})

// Container 2: Backend agent pulls state
const state = await connection.request("session/sync-state", {
  sessionId: "shared-feature-session",
  syncDirection: "pull"
})

// Now has access to ui-design impulse
const design = state.impulses["ui-design"]
```

**Conflict Resolution**:
```typescript
// Bidirectional sync with conflict resolution
const result = await connection.request("session/sync-state", {
  sessionId: "shared-session",
  state: localState,
  syncDirection: "bidirectional"
})

if (result.conflictResolution) {
  log.warn("conflicts detected", {
    strategy: result.conflictResolution.strategy,
    conflicts: result.conflictResolution.conflicts
  })
  
  // Apply conflict resolution strategy
  if (result.conflictResolution.strategy === "host-wins") {
    // Host state takes precedence
    applyHostState(result.state)
  } else if (result.conflictResolution.strategy === "merge") {
    // Merge states (CRDTs or last-write-wins)
    mergeStates(localState, result.state)
  }
}
```

---

### Guideline 4: Learning Loop Integration

**Requirement**: Remote activity metrics MUST contribute to template learning

**Implementation Flow**:
```
Remote Container
  ↓ activity/complete (metrics)
Host Agent
  ↓ Store in remoteSession impulse
  ↓ POST /api/v1/learning-loop/executions
Backend API
  ↓ Store in SurrealDB
  ↓ Recalculate improvement_gradient
Thompson Sampling
  ↓ Update boredom activity priorities
```

**Code**:
```typescript
// Host receives activity/complete from remote
server.on("activity/complete", async (params) => {
  const { activityId, success, duration, tokensUsed, validation } = params
  
  // Update remote session impulse
  await updateRemoteSessionStatus(hostSessionId, impulseId, {
    status: success ? "completed" : "failed",
    duration,
    metrics: { tokensUsed, validation }
  })
  
  // Post metrics to backend
  await fetch(`${backendUrl}/api/v1/learning-loop/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activity_id: activityId,
      template_id: params.templateId,
      success,
      duration_ms: duration,
      cost_usd: calculateCost(tokensUsed),
      tokens: tokensUsed,
      validation_passed: validation.passed,
      container: "devbob-backend", // Track which container executed
      timestamp: new Date().toISOString()
    })
  })
})
```

**Benefits**:
- ✅ Container-specific success rates tracked
- ✅ Learning loop accounts for distributed execution
- ✅ Template improvements benefit all containers
- ✅ Boredom system prioritizes templates needing work

---

## Communication Patterns

### Pattern 1: Simple Delegation (Current)

```
Host                          Remote
 │ acp_delegate                 │
 ├──────── prompt ─────────────>│
 │                              │ (executes)
 │<──────── response ───────────┤
```

**Uses**: Standard ACP v1.0 only  
**Tracking**: None  
**Limitations**: No progress visibility, no metrics

---

### Pattern 2: Tracked Delegation (Custom Extensions)

```
Host                          Remote
 │ acp_delegate                 │
 ├──────── prompt ─────────────>│
 │                              │ activity/start
 │<──────────────────────────────┤
 │                              │ (task 1)
 │                              │ activity/progress
 │<──────────────────────────────┤
 │                              │ (task 2)
 │                              │ activity/progress
 │<──────────────────────────────┤
 │                              │ (task 3)
 │                              │ activity/complete
 │<──────────────────────────────┤
 │<──────── response ───────────┤
```

**Uses**: Custom `activity/*` extensions  
**Tracking**: Full visibility  
**Benefits**: Progress monitoring, early abort, metrics

---

### Pattern 3: Multi-Agent Workflow (Session Sync)

```
Host                  Container A           Container B
 │                         │                     │
 │ delegate frontend ─────>│                     │
 │                         │ (executes)          │
 │                         │ session/sync-state  │
 │                         ├────────────────────>│
 │                         │ (shares impulses)   │
 │<─── frontend done ──────┤                     │
 │                         │                     │
 │ delegate backend ───────┼────────────────────>│
 │                         │                     │ (executes with shared context)
 │<─── backend done ───────┼─────────────────────┤
```

**Uses**: Custom `session/*` extensions  
**Benefits**: Shared context, coordinated work, handoffs

---

### Pattern 4: Impulse Resolution with Caching

```
Host                          Remote
 │ acp_delegate                 │
 │ (share: design-doc ptr)      │
 ├──────── prompt ─────────────>│
 │                              │ Try local resolution
 │                              │ (file not found)
 │                              │ impulse/request-content
 │<──────────────────────────────┤
 │ (resolve design-doc)         │
 ├──────── content ────────────>│
 │                              │ (cache content)
 │                              │ (execute with design)
 │<──────── response ───────────┤
```

**Uses**: Custom `impulse/*` extensions  
**Benefits**: Bandwidth reduction, lazy loading, caching

---

## Transport Requirements

### Docker Stdio Transport (Primary)

**Current Implementation**: ✅ Working
```bash
docker exec -i container-name opencode acp --cwd /workspace
```

**Requirements**:
- ✅ JSON-RPC over stdio (newline-delimited)
- ✅ Bidirectional communication
- ✅ Custom method routing
- ⚠️ No authentication (containers are trusted)

**Limitations**:
- Single connection per docker exec
- No connection reuse
- Process spawning overhead (~100ms)

---

### SSH Stdio Transport (Future)

**Planned**: Phase 4b
```bash
ssh user@host opencode acp --cwd /path/to/workspace
```

**Requirements**:
- JSON-RPC over stdio (newline-delimited)
- SSH key authentication
- Custom method routing
- Connection pooling (optional)

---

### HTTP/SSE Transport (Future)

**Planned**: Phase 5
```typescript
const connection = new ClientSideConnection(
  agent,
  httpStream("http://remote-agent:3000/acp")
)
```

**Requirements**:
- JSON-RPC over HTTP POST
- SSE for server-to-client messages
- Authentication (bearer token)
- Connection keep-alive

---

## Implementation Roadmap

### Phase 1: ✅ COMPLETE
- Basic ACP delegation (acp_delegate tool)
- Pointer-only impulse sharing (Phase 2)
- Remote session tracking (remoteSession impulse)

### Phase 2: 🔄 IN PROGRESS
- Bidirectional impulse resolution (impulse/request-content)
- Impulse caching (ImpulseCache)
- Test suite for Phase 3

### Phase 3: 📋 NEXT
- Activity execution tracking (activity/*)
  - Implement activity/start
  - Implement activity/progress
  - Implement activity/complete
- Host ACP server extensions
- Remote agent detection and reporting

### Phase 4: 📅 PLANNED
- Session state synchronization (session/*)
  - Implement session/sync-state
  - Implement session/handoff
- Conflict resolution strategies
- Multi-container workflows

### Phase 5: 🔮 FUTURE
- Learning loop integration
  - Remote metrics to backend
  - Container-specific success rates
  - Distributed template learning
- HTTP/SSE transport
- Web client support

---

## Testing Strategy

### Unit Tests

**Location**: `repos/metabob-opencode/packages/opencode/test/acp/`

**Coverage**:
- ✅ Basic delegation (acp-delegate.test.ts)
- ✅ Impulse serialization (impulse-serializer.test.ts)
- 🔄 Bidirectional resolution (impulse-bidirectional-resolution.test.ts)
- ❌ Activity tracking (activity-tracking.test.ts) - TODO
- ❌ Session sync (session-sync.test.ts) - TODO

### Integration Tests

**Location**: `test-acp-*.ts`

**Scenarios**:
- ✅ Docker stdio delegation (test-acp-delegation-phase4a.ts)
- 🔄 Impulse resolution fallback (test-acp-phase4a-integration.ts)
- ❌ Activity progress tracking - TODO
- ❌ Multi-agent workflow - TODO

### End-to-End Tests

**Location**: `examples/acp-*.md`

**Workflows**:
- ✅ Basic delegation (acp-basic-usage.md)
- ✅ Multi-agent parallel (acp-multi-agent-workflow.md)
- ❌ Activity tracking demo - TODO
- ❌ Session handoff demo - TODO

---

## Best Practices

### DO ✅

1. **Use pointer-only sharing by default**
   ```typescript
   acp_delegate({
     shareImpulses: ["design-doc"],
     sendFullContent: false // Default
   })
   ```

2. **Implement activity tracking in remote containers**
   ```typescript
   if (isRemoteExecution) {
     await reportActivityProgress(...)
   }
   ```

3. **Cache impulse content after resolution**
   ```typescript
   const content = await ImpulseResolver.resolveForPrompt(impulse)
   await ImpulseCache.set(impulse.id, content, hash)
   ```

4. **Report metrics from remote executions**
   ```typescript
   await connection.request("activity/complete", { metrics })
   ```

5. **Use session sync for multi-agent workflows**
   ```typescript
   await connection.request("session/sync-state", { state })
   ```

### DON'T ❌

1. **Don't send full content unless necessary**
   ```typescript
   // ❌ Bad: wastes bandwidth
   acp_delegate({
     shareImpulses: ["large-file"],
     sendFullContent: true
   })
   
   // ✅ Good: pointer-only
   acp_delegate({
     shareImpulses: ["large-file"]
   })
   ```

2. **Don't skip activity tracking**
   ```typescript
   // ❌ Bad: no visibility
   executeActivity(activity)
   
   // ✅ Good: tracked
   executeActivityWithTracking(activity, connection)
   ```

3. **Don't resolve impulses without caching**
   ```typescript
   // ❌ Bad: resolves multiple times
   for (const impulse of impulses) {
     const content = await fetchFromHost(impulse.id)
   }
   
   // ✅ Good: cache-first
   for (const impulse of impulses) {
     let content = await ImpulseCache.get(impulse.id)
     if (!content) {
       content = await fetchFromHost(impulse.id)
       await ImpulseCache.set(impulse.id, content, hash)
     }
   }
   ```

4. **Don't ignore sync conflicts**
   ```typescript
   // ❌ Bad: silent conflict
   await session/sync-state(state)
   
   // ✅ Good: handle conflicts
   const result = await session/sync-state(state)
   if (result.conflictResolution) {
     applyResolutionStrategy(result.conflictResolution)
   }
   ```

---

## Monitoring & Debugging

### Metrics to Track

**Activity Execution**:
- Remote activity duration (ms)
- Success rate by container
- Task-level tool usage
- Validation pass rate

**Impulse Resolution**:
- Cache hit rate (target: >80%)
- Fallback request count
- Resolution latency (target: <100ms local, <500ms remote)

**Session Synchronization**:
- Sync frequency
- Conflict rate (target: <5%)
- State delta size

### Debug Logging

**Enable ACP debug logs**:
```bash
export LOG_LEVEL=debug
export ACP_DEBUG=true
opencode acp
```

**Key log points**:
```typescript
log.debug("acp: activity started", { activityId, taskCount })
log.debug("acp: impulse cache hit", { impulseId })
log.debug("acp: session sync conflict", { conflicts })
```

---

## Security Considerations

### Container Trust Boundary

**Assumption**: Containers within same Docker network are trusted
- No authentication required for docker:// transport
- Host-container communication is trusted
- Container-container communication is trusted

**Risk Mitigation**:
- Use SSH transport for untrusted remotes
- Implement bearer token auth for HTTP transport
- Validate impulse content before execution

### Impulse Content Safety

**Requirement**: Validate impulse content before resolution

```typescript
// Host validates before sending
if (impulse.pointer.type === "file") {
  const filePath = impulse.pointer.path
  if (!isWithinWorkspace(filePath)) {
    throw new Error("File outside workspace")
  }
}

// Remote validates before using
if (!isValidContent(content)) {
  throw new Error("Malicious content detected")
}
```

---

## Migration Guide

### From Standard ACP to Custom Extensions

**Step 1: Update Host (acp-delegate.ts)**
```typescript
// Add activity tracking
if (result.metadata?.activityId) {
  await trackActivityExecution(result.metadata)
}
```

**Step 2: Update Remote (ActivityTool)**
```typescript
// Detect remote execution
const isRemote = !!process.env.ACP_REMOTE
const connection = isRemote ? getACPConnection() : null

// Report progress
if (connection) {
  await connection.request("activity/progress", { ... })
}
```

**Step 3: Update ACP Server (acp.ts)**
```typescript
// Register custom method handlers
server.on("activity/start", handleActivityStart)
server.on("activity/progress", handleActivityProgress)
server.on("activity/complete", handleActivityComplete)
server.on("impulse/request-content", handleImpulseRequest)
```

**Step 4: Test End-to-End**
```bash
# Run integration test
bun test test/acp/activity-tracking.test.ts
```

---

## Conclusion

### Achieving Communication Goals

| Goal | Status | Implementation |
|------|--------|----------------|
| Activity Execution Visibility | 📋 Next | activity/* extensions |
| Impulse Content Resolution | 🔄 In Progress | impulse/* extensions |
| Session State Synchronization | 📅 Planned | session/* extensions |
| Learning Loop Integration | 📅 Planned | Metrics forwarding |

### Next Steps

1. **Implement activity/* extensions** (Phase 3)
   - Add activity/start, activity/progress, activity/complete
   - Update ActivityTool to detect remote execution
   - Update acp-delegate.ts to handle activity updates

2. **Complete impulse resolution** (Phase 2)
   - Test bidirectional fallback
   - Implement caching layer
   - Measure bandwidth savings

3. **Create activity template** (Phase 3)
   - Template: `implement-acp-activity-tracking`
   - Variables: None (fully self-contained)
   - Tasks: Update tools, add handlers, create tests

4. **Validate with boredom system** (Phase 3)
   - Execute boredom activities in remote containers
   - Track metrics across containers
   - Verify learning loop integration

---

**Document Status**: ✅ Ready for Implementation  
**Next Action**: Create `implement-acp-activity-tracking` activity template  
**Owner**: Activity Mode  
**Timeline**: Phase 3 (Next sprint)

