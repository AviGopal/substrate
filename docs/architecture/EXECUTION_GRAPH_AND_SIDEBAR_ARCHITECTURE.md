# Execution Graph & Sidebar Architecture

## Overview

OpenCode tracks the **execution graph** (activity composition) and **instructional state** (impulses, context) through a comprehensive state management system that powers the TUI sidebar.

## Current Architecture

### 1. Data Collection Layer

**SessionState API** (`/session/{sessionID}/state`)
- Polls every 2.5 seconds
- Aggregates data from multiple sources:
  - SessionMemory (impulses, budget)
  - Activities (running, completed)
  - ACP connections (remote agents)
  - MCP servers (tool providers)
  - Memory management stats

**Relationship APIs**:
```
GET /session/{sessionID}/relationships/impulse-activity-map
GET /session/{sessionID}/relationships/activity-acp-map
GET /session/{sessionID}/relationships/integration-graph
GET /session/{sessionID}/relationships/cost-breakdown
```

### 2. State Schema (SessionState namespace)

**Complete state structure:**

```typescript
{
  // Instructional State (what LLM knows)
  impulses: {
    impulses: Impulse[],              // Current impulses
    totalBudget: number,              // Allocated token budget
    usedTokens: number,               // Loaded impulse tokens
    utilization: number,              // Budget % used (0-100)
    loadedCount: number,              // # loaded impulses
    unloadedCount: number             // # unloaded impulses
  },
  
  // Context Window State
  contextWindow: {
    estimatedTokens: number,          // Current context size
    maxTokens: number,                // Model limit
    utilizationPercent: number,       // Context % used
    cacheStats: {
      hits: number,                   // Cache read tokens
      misses: number,                 // Cache write tokens
      hitRate: number                 // Cache efficiency %
    }
  },
  
  // Execution Graph (activity composition)
  activities: {
    activeActivities: [{
      id: string,
      title: string,
      status: "pending" | "executing" | "completed" | "failed",
      progress: {
        current: number,              // Current task index
        total: number,                // Total tasks
        percentage: number            // Progress %
      },
      startedAt: number,
      elapsedMs: number
    }],
    totalActivities: number,          // All activities
    completedActivities: number       // Finished activities
  },
  
  // ACP Agents (remote OpenCode instances)
  acp: {
    connected: boolean,
    agents: [{
      name: string,                   // e.g., "devbob-backend-agent"
      type: string,                   // "docker" or "ssh"
      status: "connected" | "disconnected" | "error",
      sessionID: string               // Remote session ID
    }],
    agentCount: number
  },
  
  // MCP Servers (tool providers)
  mcp: {
    connected: boolean,
    servers: [{
      name: string,                   // e.g., "metabob-mcp"
      status: "connected" | "disconnected" | "error"
    }],
    serverCount: number
  },
  
  // Memory Management
  memoryManagement: {
    heapUsedMB: number,
    heapTotalMB: number,
    cacheTokens: number,
    messageCount: number,
    estimatedSessionMB: number,
    shouldCompact: boolean,
    lastCompactionCheck: number
  },
  
  // Session Metadata
  metadata: {
    agentMode: string,                // "activity", "plan", "review"
    model: {
      provider: string,
      model: string,
      contextWindow: number
    },
    locked: boolean,                  // Executing?
    messageCount: number,
    lastUpdated: number
  }
}
```

### 3. Relationship Tracking

**Activity ↔ Impulse Relations:**
```typescript
ActivityImpulseRelation {
  activityId: string,
  impulseId: string,
  impulseType: string,                // "memo", "file", "component", etc.
  budget: number,                     // Allocated tokens
  actualTokens: number,               // Actually used
  loadCount: number,                  // Times loaded
  totalCost: number,                  // $ spent on this impulse
  firstLoadedAt: number,
  lastLoadedAt: number
}
```

**Activity ↔ ACP Agent Relations:**
```typescript
ActivityACPRelation {
  activityId: string,                 // Parent activity
  agentId: string,                    // ACP connection ID
  agentName: string,                  // "devbob-backend-agent"
  agentType: string,                  // "docker", "ssh"
  target: string,                     // "docker://container" or "ssh://host"
  spawnedAt: number,
  terminatedAt?: number,
  status: "active" | "terminated" | "error",
  sessionID: string,                  // Remote session ID
  cost: number,                       // $ spent on this agent
  tokensUsed: {
    input: number,
    output: number,
    cache: number
  },
  taskIds: string[]                   // Tasks executed by agent
}
```

### 4. TUI Sidebar Visualization

**Sections (all collapsible):**

#### A. **Memory** (Instructional State)
```
▼ Memory                           [Budget: 80%]
  Impulses (15):
    ✓ [file] src/auth.ts              1.2K tokens
    ○ [comp] UserValidator            800 tokens
    ✓ [memo] API Design               500 tokens
  Total Budget: 10K tokens | Used: 8K (80%)
```

#### B. **Activities** (Execution Graph)
```
▼ Activities (2 running)
  ├─ Implement User Auth            [Progress: 60%] $0.23
  │  Task 3/5: Add validation tests
  │  Started: 2m ago
  │
  └─ Create Database Schema         [Progress: 100%] $0.15
     Completed: 1m ago
```

#### C. **Integration Flow** (Execution Graph Visualization)
```
▼ Integration Flow
  ┌─ Session: User Authentication
  │
  ├─┬─ Activity: Implement Auth [devbob:backend]
  │ │
  │ ├─── Uses ──▶ [file] auth.ts (3x)
  │ ├─── Uses ──▶ [comp] UserValidator (2x)
  │ └─── Spawns ─▶ devbob-test-agent ($0.05)
  │
  └─┬─ Activity: Add Tests
    │
    ├─── Uses ──▶ [file] auth.test.ts (1x)
    └─── Uses ──▶ [memo] Test Requirements (1x) from backend

  Stats: 2 activities • 4 impulses • 1 agent
```

#### D. **Cost Breakdown**
```
▼ Cost Breakdown                    [Total: $0.38]
  By Activity:
    Implement Auth:     $0.23 (impulses: $0.18, ACP: $0.05)
    Add Tests:          $0.15 (impulses: $0.15, ACP: $0.00)
  
  By Impulse:
    auth.ts:            $0.12 (3 activities, avg: $0.04)
    UserValidator:      $0.06 (2 activities, avg: $0.03)
    API Design:         $0.05 (1 activity)
```

#### E. **ACP Agents** (Remote Agents)
```
▼ ACP Agents (1 connected)
  ✓ devbob-backend-agent [docker]
    Session: ses_remote_abc123
    Cost: $0.05 | Tokens: 5.2K
    Tasks: validate-schema, run-tests
```

#### F. **MCP Servers** (Tool Providers)
```
▼ MCP Servers (2 connected)
  ✓ metabob-mcp          [connected]
  ✓ playwright-mcp       [connected]
```

### 5. Real-Time Updates

**Event-Driven Architecture:**
```typescript
// SSE events from server
sync.data.session_memory[sessionID]  // Real-time impulse updates
sync.data.activities                 // Activity state changes
sync.data.message[sessionID]         // New messages
sync.data.session_diff[sessionID]    // File changes
sync.data.todo[sessionID]            // Todo updates
```

**Polling (fallback):**
- SessionState API: Every 2.5 seconds
- Integration graph: Every 2.5 seconds
- Cost breakdown: Every 2.5 seconds

### 6. Integration Graph Structure

**Graph Schema:**
```typescript
IntegrationGraph {
  nodes: [{
    id: string,
    type: "session" | "activity" | "impulse" | "acp-agent",
    label: string,
    metadata: {
      // Type-specific metadata
      type?: string,              // For impulses: "file", "memo", etc.
      agentName?: string,         // For activities: ACP agent name
      agentType?: string,         // For activities: "docker", "ssh"
      cost?: number,              // For agents: total cost
      status?: string,            // For activities: execution status
      ...
    }
  }],
  
  edges: [{
    source: string,               // Source node ID
    target: string,               // Target node ID
    type: "uses" | "spawned" | "creates",
    weight: number,               // Usage count or cost
    metadata: {
      sourceAgent?: string,       // For cross-container sharing
      loadCount?: number,         // Times impulse loaded
      cost?: number,              // Edge cost
      ...
    }
  }],
  
  stats: {
    nodesByType: {
      session: number,
      activity: number,
      impulse: number,
      "acp-agent": number
    },
    totalCost: number,
    totalImpulseLoads: number,
    crossContainerShares: number
  }
}
```

## How It Works: Step-by-Step

### Example: Composing Activities

```typescript
// User request: "Implement authentication with tests"

1. Activity 1: Implement Auth
   ├─ Creates impulse: auth.ts (file)
   ├─ Creates impulse: UserValidator (component)
   ├─ Creates impulse: API Design (memo)
   └─ Spawns: devbob-backend-agent (for validation)

2. Activity 2: Add Tests
   ├─ Uses impulse: auth.ts (from Activity 1) ← SHARED!
   ├─ Uses impulse: API Design (from Activity 1) ← SHARED!
   └─ Creates impulse: test-requirements (memo)

3. Sidebar shows:
   ┌─ Session: Authentication
   │
   ├─┬─ Implement Auth [devbob:backend]
   │ │
   │ ├─── Uses ──▶ [file] auth.ts (created here)
   │ ├─── Uses ──▶ [comp] UserValidator (created here)
   │ ├─── Uses ──▶ [memo] API Design (created here)
   │ └─── Spawns ─▶ devbob-backend-agent ($0.05)
   │
   └─┬─ Add Tests
     │
     ├─── Uses ──▶ [file] auth.ts (2x) from backend  ← SHARED
     ├─── Uses ──▶ [memo] API Design (1x) from backend  ← SHARED
     └─── Uses ──▶ [memo] test-requirements (created here)
```

### Tracking Details

**Impulse Lifecycle:**
1. **Created**: `impulse-create` tool → SessionMemory + Activity.impulses
2. **Loaded**: `impulse-load` tool → `loaded: true`, tokens counted
3. **Used in context**: LLM sees it, tokens charged
4. **Unloaded**: `impulse-unload` tool → `loaded: false`, tokens freed
5. **Tracked**: Each load/unload recorded in ActivityImpulseRelation

**Activity Composition:**
1. **Started**: Activity.create() → registers session mapping
2. **Executes tasks**: Each task sees parent session impulses
3. **Spawns agents**: ACP delegate → tracked in ActivityACPRelation
4. **Completes**: Final state persisted with all relations

**Graph Building:**
- Server collects ActivityImpulseRelation records
- Builds nodes (activities, impulses, agents)
- Builds edges (uses, spawned, creates)
- Calculates stats (cost, load counts, sharing)
- Sends to sidebar every 2.5 seconds

## What You See in the Sidebar

### Memory Section
**Shows instructional state:**
- Which impulses exist (created)
- Which are loaded (in context window)
- Token budget utilization
- Warning if over 80% budget

### Activities Section  
**Shows execution graph:**
- Running activities (with progress)
- Completed activities
- Activity relationships (parent/child)
- Cost per activity

### Integration Flow Section
**Shows composition graph:**
- Session → Activities hierarchy
- Activity → Impulse relationships (uses)
- Activity → ACP Agent relationships (spawns)
- Cross-container impulse sharing
- Visual tree with load counts

### Cost Breakdown Section
**Shows financial tracking:**
- Cost by activity (impulses + ACP)
- Cost by impulse (across activities)
- Average cost per activity
- Total session cost
- Budget warning if over 80%

## Implementation Status

### ✅ Fully Implemented
- SessionState API
- Impulse tracking (SessionMemory + Activity.impulses dual-write)
- Activity tracking
- ACP agent tracking
- Integration graph visualization
- Cost breakdown
- Real-time updates (SSE + polling)

### ⚠️ Partially Implemented
- Cross-container impulse sharing detection (schema exists, needs testing)
- Budget warnings (UI exists, needs threshold configuration)
- Memory compaction triggers (logic exists, needs tuning)

### ❌ Not Yet Implemented
- Historical graph (activity composition over time)
- Impulse usage heatmap
- Cost optimization suggestions
- Predictive budget alerts

## How to View This

**In TUI:**
```bash
cd repos/metabob-opencode && bun run dev

# The sidebar shows automatically:
# - Memory (impulses)
# - Activities (running)
# - Integration Flow (collapsed by default - click to expand)
# - Cost Breakdown (collapsed by default - click to expand)
```

**Sections you can toggle:**
- `▼ Memory` → Click to collapse
- `▶ Integration Flow` → Click to expand and see execution graph
- `▶ Cost Breakdown` → Click to expand and see costs
- `▼ Activities` → Shows running activities

## Architecture Benefits

**Separation of Concerns:**
- **SessionMemory**: Fast in-memory reads for TUI
- **Activity.impulses**: Persistent storage for analytics
- **Dual-write**: Both stay in sync automatically

**Unified Visualization:**
- One API (`/session/{id}/state`) provides everything
- One sidebar shows instructional + functional state
- One graph shows activity composition

**Real-Time Tracking:**
- SSE events for instant updates
- Polling fallback for reliability
- 2.5s refresh for relationships

**Cost Transparency:**
- Track cost per activity
- Track cost per impulse
- Track cost per ACP agent
- See where money is spent

## Summary

**Question**: How do we track execution graph and instructional state?

**Answer**: 
1. **SessionState API** collects all data (impulses, activities, agents, cost)
2. **Relationship APIs** build execution graph (activity → impulse, activity → agent)
3. **TUI Sidebar** visualizes everything in real-time:
   - Memory section: Instructional state (impulses, budget)
   - Activities section: Execution progress
   - Integration Flow: Composition graph (visual tree)
   - Cost Breakdown: Financial tracking
4. **Updates**: Real-time via SSE + 2.5s polling for relationships

You can see **everything** about the execution in the sidebar - what's loaded, what's running, how activities compose, and what it costs.

---

*Generated*: 2026-02-20  
*File*: `EXECUTION_GRAPH_AND_SIDEBAR_ARCHITECTURE.md`  
*Complete architectural reference for execution tracking and visualization*
