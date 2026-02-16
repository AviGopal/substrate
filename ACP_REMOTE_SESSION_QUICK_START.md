# ACP Remote Session Impulse: Quick Start Guide

**Status**: ✅ Production-ready (Phase 1 complete)  
**Last Updated**: February 16, 2026

---

## Overview

Remote session impulses automatically track the lifecycle of ACP delegation tasks. When you delegate work to a remote agent (e.g., devbob containers), the host agent creates an impulse that tracks:

- **Progress**: Real-time updates during execution
- **Metrics**: Duration, tools used, response length
- **Status**: Processing → Completed/Failed
- **Reference**: Pointer back to the remote session

This enables:
- 📊 **Visibility**: See what remote agents are doing
- 🔍 **Discovery**: Query past delegations
- 🧠 **Learning**: Memory agent can learn from delegation patterns
- 📈 **Analytics**: Track delegation performance over time

---

## Quick Start: Using Remote Session Impulses

### 1. Delegate a Task (Automatic Impulse Creation)

```typescript
import { ACPDelegateTool } from "@/tool/acp-delegate"

// Initialize tool
const toolInfo = await ACPDelegateTool.init()

// Execute delegation (impulse created automatically)
const result = await toolInfo.execute({
  target: "docker://devbob-clean",
  taskDescription: "Implement user authentication",
  prompt: "Add JWT authentication to the API",
  timeout: 300
}, context)
```

**What happens**:
1. Impulse created with ID: `remote-session-{sessionId}`
2. Type: `remoteSession`
3. Status: `processing`
4. Pointer: `{ type: "acp", target, sessionId }`

### 2. Query Remote Sessions

```typescript
import { SessionMemory } from "@/session/session-memory"

// List all remote sessions in current session
const remoteSessions = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession"
})

console.log(`Found ${remoteSessions.length} remote sessions`)

// Get only completed delegations
const completed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "completed"
})

// Get only failed delegations
const failed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "failed"
})

// Get high-priority delegations
const highPriority = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  minPriority: "high"
})
```

### 3. Inspect Impulse Details

```typescript
// Get specific remote session
const impulse = remoteSessions[0]

console.log("Remote Session Details:")
console.log("- Target:", impulse.pointer.target)
console.log("- Status:", impulse.metadata.status)
console.log("- Duration:", impulse.metadata.duration, "ms")
console.log("- Tools Used:", impulse.metadata.toolCalls)
console.log("- Response Length:", impulse.metadata.responseLength)
console.log("- Task:", impulse.metadata.taskDescription)
```

### 4. Monitor Progress (Real-time)

```typescript
// During delegation, impulse is updated automatically
// You can poll for updates:

async function monitorDelegation(sessionID: string, impulseId: string) {
  const impulse = await SessionMemory.getImpulse(sessionID, impulseId)
  
  console.log("Status:", impulse.metadata.status)
  console.log("Latest update:", impulse.metadata.lastUpdate)
  console.log("Duration:", impulse.metadata.duration, "ms")
  console.log("Phase:", impulse.metadata.phase)
}
```

---

## Impulse Structure

### Pointer Schema

```typescript
{
  type: "acp",
  target: string,        // e.g., "docker://devbob-clean"
  sessionId: string      // Remote session ID (ses_...)
}
```

### Metadata Schema

```typescript
{
  target: string,              // Connection target
  taskDescription: string,     // Human-readable task
  containerName: string,       // Resolved container name
  workingDirectory: string,    // Remote working directory
  status: "processing" | "completed" | "failed",
  startTime: number,           // Timestamp (ms)
  lastUpdate: string,          // Latest progress message
  duration: number,            // Total execution time (ms)
  toolCalls: string[],         // Tools used by remote agent
  responseLength: number,      // Response text length
  phase: string,               // Current execution phase
  error?: string               // Error message (if failed)
}
```

### Complete Impulse Example

```typescript
{
  id: "remote-session-ses_39a82b8c9ffe...",
  type: "remoteSession",
  sessionID: "ses_parent_session_id",
  scope: "session",
  pointer: {
    type: "acp",
    target: "docker://devbob-clean",
    sessionId: "ses_39a82b8c9ffe..."
  },
  description: "Remote session for: Implement user authentication",
  budget: 2000,
  priority: "high",
  metadata: {
    target: "docker://devbob-clean",
    taskDescription: "Implement user authentication",
    containerName: "devbob-clean",
    workingDirectory: "/workspace",
    status: "completed",
    startTime: 1771229232024,
    lastUpdate: "Task completed successfully",
    duration: 15432,
    toolCalls: ["write", "bash", "read", "metabob_annotate_component"],
    responseLength: 1245,
    phase: "completed"
  }
}
```

---

## Execution Phases

The `phase` field tracks where the remote agent is in execution:

| Phase | Description |
|-------|-------------|
| `initialization` | Remote session created, connecting |
| `processing` | Agent is processing the task |
| `tool-execution` | Agent is using a tool |
| `completed` | Task finished successfully |
| `error` | Task failed or error occurred |

---

## Querying Patterns

### Common Query Patterns

```typescript
// All remote sessions
const all = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession"
})

// Only active delegations
const active = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "processing"
})

// Failed delegations needing attention
const failed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "failed",
  minPriority: "high"
})

// Recent completions (sort by duration)
const recent = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "completed"
})
recent.sort((a, b) => b.metadata.startTime - a.metadata.startTime)

// Long-running delegations (>60s)
const longRunning = all.filter(imp => 
  imp.metadata.duration > 60000 && 
  imp.metadata.status === "processing"
)

// Most tool-intensive delegations
const toolHeavy = all.filter(imp => 
  imp.metadata.toolCalls.length > 10
)
```

### Analytics Examples

```typescript
// Calculate success rate
const completed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "completed"
})
const failed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "failed"
})
const successRate = completed.length / (completed.length + failed.length)

// Average delegation duration
const avgDuration = completed.reduce((sum, imp) => 
  sum + imp.metadata.duration, 0
) / completed.length

// Most used tools
const toolCounts = {}
completed.forEach(imp => {
  imp.metadata.toolCalls.forEach(tool => {
    toolCounts[tool] = (toolCounts[tool] || 0) + 1
  })
})

// Target usage
const targetCounts = {}
all.forEach(imp => {
  const target = imp.metadata.target
  targetCounts[target] = (targetCounts[target] || 0) + 1
})
```

---

## Filtering Options

### Type Filter

```typescript
{ type: "remoteSession" }  // Only remote sessions
{ type: "file" }            // Only file impulses
{ type: "metabobIssue" }    // Only Metabob issues
```

### Status Filter

```typescript
{ status: "processing" }    // Currently running
{ status: "completed" }     // Successfully finished
{ status: "failed" }        // Failed/errored
```

### Priority Filter

```typescript
{ minPriority: "high" }     // High priority only
{ minPriority: "medium" }   // Medium and high
{ minPriority: "low" }      // All priorities
```

### Loaded Filter

```typescript
{ loaded: true }            // Has content loaded (tokenCount > 0)
{ loaded: false }           // Content not loaded yet
```

### Combining Filters

```typescript
// High-priority failed delegations with content loaded
const criticalFailures = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "failed",
  minPriority: "high",
  loaded: true
})
```

---

## Best Practices

### 1. Monitor Long-Running Delegations

```typescript
setInterval(async () => {
  const active = await SessionMemory.listImpulses(sessionID, {
    type: "remoteSession",
    status: "processing"
  })
  
  const longRunning = active.filter(imp => 
    Date.now() - imp.metadata.startTime > 300000 // 5 minutes
  )
  
  if (longRunning.length > 0) {
    console.warn(`${longRunning.length} delegations running >5min`)
  }
}, 60000) // Check every minute
```

### 2. Analyze Failed Delegations

```typescript
const failed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "failed"
})

failed.forEach(imp => {
  console.error("Failed delegation:")
  console.error("- Task:", imp.metadata.taskDescription)
  console.error("- Target:", imp.metadata.target)
  console.error("- Error:", imp.metadata.error)
  console.error("- Duration:", imp.metadata.duration, "ms")
})
```

### 3. Track Delegation Efficiency

```typescript
const completedToday = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "completed"
})

const oneDayAgo = Date.now() - 86400000
const todaysCompletions = completedToday.filter(imp => 
  imp.metadata.startTime > oneDayAgo
)

console.log("Today's delegation stats:")
console.log("- Total completions:", todaysCompletions.length)
console.log("- Avg duration:", avgDuration(todaysCompletions))
console.log("- Total tools used:", totalTools(todaysCompletions))
```

### 4. Memory Agent Context Selection

```typescript
// Memory agent can use remote session impulses to decide
// whether to delegate similar tasks or execute locally

const pastDelegations = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession"
})

// Check if similar task was delegated before
const similarTask = pastDelegations.find(imp => 
  imp.metadata.taskDescription.includes("authentication")
)

if (similarTask && similarTask.metadata.status === "completed") {
  console.log("Similar task successfully delegated before")
  console.log("Consider delegating again to:", similarTask.metadata.target)
}
```

---

## Common Use Cases

### 1. Retry Failed Delegations

```typescript
const failed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "failed"
})

for (const failedImpulse of failed) {
  console.log("Retrying:", failedImpulse.metadata.taskDescription)
  
  const toolInfo = await ACPDelegateTool.init()
  await toolInfo.execute({
    target: failedImpulse.metadata.target,
    taskDescription: failedImpulse.metadata.taskDescription,
    prompt: "Retry previous failed task...",
    timeout: 300
  }, context)
}
```

### 2. Load Balancing

```typescript
// Find least busy container
const allSessions = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession"
})

const activeSessions = allSessions.filter(imp => 
  imp.metadata.status === "processing"
)

const containerLoads = {}
activeSessions.forEach(imp => {
  const target = imp.metadata.target
  containerLoads[target] = (containerLoads[target] || 0) + 1
})

const leastBusy = Object.entries(containerLoads)
  .sort((a, b) => a[1] - b[1])[0][0]

console.log("Delegate to:", leastBusy)
```

### 3. Debugging Remote Execution

```typescript
const impulse = await SessionMemory.getImpulse(
  sessionID, 
  "remote-session-ses_xyz"
)

console.log("Debugging remote session:")
console.log("- Container:", impulse.metadata.containerName)
console.log("- Working dir:", impulse.metadata.workingDirectory)
console.log("- Phase:", impulse.metadata.phase)
console.log("- Last update:", impulse.metadata.lastUpdate)
console.log("- Tools used:", impulse.metadata.toolCalls)

// If failed, check error
if (impulse.metadata.status === "failed") {
  console.error("Error:", impulse.metadata.error)
}
```

### 4. Performance Reporting

```typescript
const completed = await SessionMemory.listImpulses(sessionID, {
  type: "remoteSession",
  status: "completed"
})

const report = {
  totalDelegations: completed.length,
  avgDuration: completed.reduce((sum, imp) => 
    sum + imp.metadata.duration, 0) / completed.length,
  totalTools: completed.reduce((sum, imp) => 
    sum + imp.metadata.toolCalls.length, 0),
  targetBreakdown: {},
  phaseBreakdown: {}
}

completed.forEach(imp => {
  report.targetBreakdown[imp.metadata.target] = 
    (report.targetBreakdown[imp.metadata.target] || 0) + 1
})

console.log("Delegation Performance Report:", report)
```

---

## Testing

Run the end-to-end test to validate impulse lifecycle:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run test-remote-session-impulse.ts
```

Expected output:
```
✅ ALL TESTS PASSED - Remote Session Impulse Lifecycle Validated

Summary:
  ✓ Remote session impulse created on delegation
  ✓ Impulse updated during execution
  ✓ Impulse updated on completion
  ✓ Filtering by type works correctly
  ✓ Filtering by status works correctly
  ✓ All metadata fields present and valid
```

---

## Troubleshooting

### Impulse Not Created

**Symptom**: No remote session impulse after delegation

**Check**:
1. Verify delegation succeeded (no connection errors)
2. Check session ID is valid
3. Confirm impulse creation code is executed (check logs)

**Debug**:
```typescript
const allImpulses = await SessionMemory.listImpulses(sessionID)
console.log("All impulses:", allImpulses.map(i => i.id))
```

### Impulse Not Updating

**Symptom**: Impulse stuck in "processing" status

**Check**:
1. Verify remote session is still active
2. Check for network issues
3. Look for errors in ACP connection

**Debug**:
```typescript
const impulse = await SessionMemory.getImpulse(sessionID, impulseId)
console.log("Last update:", impulse.metadata.lastUpdate)
console.log("Duration:", impulse.metadata.duration)
console.log("Phase:", impulse.metadata.phase)
```

### Filtering Returns Empty

**Symptom**: Filter returns [] but impulses exist

**Check**:
1. Verify filter criteria match impulse metadata
2. Check spelling of status/type values
3. Confirm impulses are loaded

**Debug**:
```typescript
const all = await SessionMemory.listImpulses(sessionID)
console.log("Total impulses:", all.length)
console.log("Types:", all.map(i => i.type))
console.log("Statuses:", all.map(i => i.metadata?.status))
```

---

## Next: Phase 2 - Pointer-Based Serialization

Phase 1 gives us **visibility** into remote delegation.  
Phase 2 will add **efficiency** through pointer-based serialization.

**Coming in Phase 2**:
- Send pointers instead of full content (10-50x smaller prompts)
- Remote resolves pointers locally (files, metabob issues)
- Faster delegation, lower token costs

**See**: `ACP_IMPULSE_INTEGRATION_PLAN.md` for Phase 2 details

---

## References

- **Completion Report**: `ACP_PHASE1_COMPLETION_REPORT.md`
- **Implementation Plan**: `ACP_IMPULSE_INTEGRATION_PLAN.md`
- **Test Script**: `test-remote-session-impulse.ts`
- **ACP Delegate Tool**: `repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts`

---

**Last Updated**: February 16, 2026  
**Status**: Production-ready ✅  
**Phase**: 1 of 5 complete
