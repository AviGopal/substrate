# Entry Points: WebSocket-Real-Time-Dashboard-Updates

## Summary

The WebSocket real-time dashboard updates feature has **7 primary entry points** across server and client sides. The server-side implementation is **fully functional**, broadcasting events during execution lifecycle. The client-side has all the infrastructure in place but is **not yet activated** in the main App component.

---

## Server-Side Entry Points (Activity API)

### 1. WebSocket Server Initialization
```
Entry Point: repos/metabob-activity-api/src/index.ts:164-237
Function: Bun.serve<WebSocketData>()
Input Type: HTTP Upgrade Request
Trigger: Client connects to ws://host:port/ws
```

**Initialization Flow**:
- Bun.serve() creates HTTP + WebSocket server on port 8080
- `/ws` endpoint triggers WebSocket upgrade
- Connection data initialized: `{ authenticated: false }`

**Event Handlers Registered**:
- `websocket.open` (line 183): Adds client to broadcaster
- `websocket.message` (line 188): Processes authentication and ping/pong
- `websocket.close` (line 226): Removes client from broadcaster
- `websocket.drain` (line 230): Handles backpressure

---

### 2. WebSocket Authentication Handler
```
Entry Point: repos/metabob-activity-api/src/index.ts:188-223
Function: websocket.message handler
Input Type: { type: 'authenticate', token: string, sessionId?: string, orgId?: string }
Trigger: Client sends authentication message after connection
```

**Authentication Flow**:
1. Client connects → `authenticated: false`
2. Client sends `{ type: 'authenticate', token: 'xxx' }`
3. Server validates token (currently stub implementation)
4. Server sets `ws.data.authenticated = true`
5. Server sets `ws.data.sessionId` and `ws.data.orgId`
6. Server responds: `{ type: 'authenticated', timestamp: ISO }`

**Security Note**: Token validation is marked as TODO (line 194)

---

### 3. Execution Started Event
```
Entry Point: repos/metabob-activity-api/src/routes/activities.ts:549-553
Function: broadcaster.emit()
Input Type: ExecutionStartedMessage
Trigger: POST /v2/activities/executions receives execution start
```

**Event Schema**:
```typescript
{
  type: 'execution_started',
  timestamp: '2026-03-19T...',
  data: {
    execution_id: 'uuid',
    variant_id: 'add-rest-endpoint',
    pod_name?: 'minibob-pod-xyz' // Optional, MiniBob only
  }
}
```

**Broadcast Target**: All authenticated WebSocket clients

---

### 4. Execution Completed Event
```
Entry Point: repos/metabob-activity-api/src/routes/activities.ts:658-669
Function: broadcaster.emit()
Input Type: ExecutionCompletedMessage
Trigger: POST /v2/activities/executions completes execution
```

**Event Schema**:
```typescript
{
  type: 'execution_completed',
  timestamp: '2026-03-19T...',
  data: {
    execution_id: 'uuid',
    variant_id: 'add-rest-endpoint',
    success: true,
    duration_ms: 45000,
    cost: 0.0234,
    completed_at: '2026-03-19T...'
  }
}
```

**Timing**: Emitted after Thompson Sampling metrics update

---

### 5. Template Metrics Updated Event
```
Entry Point: repos/metabob-activity-api/src/routes/activities.ts:673-686
Function: broadcaster.emit()
Input Type: TemplateMetricsUpdatedMessage
Trigger: Thompson Sampling parameters recalculated
```

**Event Schema**:
```typescript
{
  type: 'template_updated',
  timestamp: '2026-03-19T...',
  data: {
    variant_id: 'add-rest-endpoint',
    metrics: {
      success_rate: 0.85,
      avg_duration_ms: 42000,
      avg_cost_usd: 0.0215,
      thompson_alpha: 18,
      thompson_beta: 4
    }
  }
}
```

**Learning Integration**: Metrics come from `update_metrics_after_execution()` query

---

## Client-Side Entry Points (Dashboard)

### 6. WebSocket Connection Manager
```
Entry Point: repos/activity-dashboard/src/lib/api-client.ts:274-311
Function: ActivityApiClient.connectWebSocket()
Input Type: (message: WebSocketMessage) => void
Trigger: Dashboard component calls useWebSocket hook
```

**Connection Flow**:
1. Converts base URL: `http://host:8080` → `ws://host:8080/ws`
2. Creates WebSocket instance
3. **onopen**: Sends authentication message if token available
4. **onmessage**: Parses JSON, invokes callback
5. **onerror**: Logs error
6. **onclose**: Logs disconnection

**Authentication**: Automatically sends token on connection (line 287-292)

---

### 7. React WebSocket Hook
```
Entry Point: repos/activity-dashboard/src/hooks/useWebSocket.ts:24-115
Function: useWebSocket()
Input Type: UseWebSocketOptions
Trigger: React component mounts with useWebSocket()
```

**Hook Options**:
```typescript
{
  enabled?: boolean,              // Default: true
  onMessage?: (msg) => void,      // Message handler
  reconnectInterval?: number,     // Default: 5000ms
  maxReconnectAttempts?: number   // Default: 10
}
```

**Features**:
- Auto-connect on mount
- Auto-reconnect with exponential backoff
- Connection state management (`connected`, `error`, `reconnectAttempts`)
- Clean disconnect on unmount

**Current Status**: ⚠️ **Hook exists but is NOT used in App.tsx**

---

## Data Flow Architecture

### Server → Client Event Pipeline

```
MiniBob/CLI Execution
    ↓
POST /v2/activities/executions
    ↓
[Entry Point 3] broadcaster.emit(execution_started)
    ↓
Save to SurrealDB (activity_executions table)
    ↓
update_metrics_after_execution() query
    ↓
[Entry Point 4] broadcaster.emit(execution_completed)
    ↓
[Entry Point 5] broadcaster.emit(template_updated)
    ↓
WebSocket broadcast to all authenticated clients
    ↓
[Entry Point 7] useWebSocket hook receives event
    ↓
[Entry Point 6] onMessage callback invoked
    ↓
Dashboard UI updates (React state change)
```

### Message Broadcasting Logic

**File**: repos/metabob-activity-api/src/websocket/broadcaster.ts

**Methods**:
- `emit(message)` - Broadcast to all authenticated clients
- `emitToSession(message, sessionId)` - Broadcast to session-specific clients
- `emitToOrg(message, orgId)` - Broadcast to org-specific clients

**Authentication Filter**: Only clients with `ws.data.authenticated === true` receive messages

---

## Message Type Definitions

**File**: repos/metabob-activity-api/src/websocket/types.ts

```typescript
type WebSocketMessage =
  | ExecutionStartedMessage      // execution_started
  | ExecutionCompletedMessage    // execution_completed
  | TemplateMetricsUpdatedMessage // template_updated
  | PodStatusChangedMessage      // pod_status_changed (future)
```

**Schema Compatibility**: Server and Dashboard share identical message types

---

## Integration Status

### ✅ Fully Implemented (Server-Side)

| Component | Status | Evidence |
|-----------|--------|----------|
| WebSocket Server | ✅ Running | index.ts:164-237 |
| Event Broadcasting | ✅ Active | broadcaster.ts:51-133 |
| Execution Events | ✅ Emitting | activities.ts:549, 658, 673 |
| Authentication | ⚠️ Stub | index.ts:194 (TODO: validation) |

### ⚠️ Partially Implemented (Client-Side)

| Component | Status | Evidence |
|-----------|--------|----------|
| WebSocket Client | ✅ Implemented | api-client.ts:274-311 |
| useWebSocket Hook | ✅ Implemented | useWebSocket.ts:24-115 |
| **Dashboard Integration** | ❌ **Not Connected** | App.tsx does not call useWebSocket |

---

## Validation & Testing

### Validation Harness
**File**: tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts

**Test Coverage**:
1. ✅ WebSocket connection lifecycle
2. ✅ Authentication flow (connect → authenticate → authenticated)
3. ✅ Execution event sequence (started → completed → updated)
4. ✅ Multi-client broadcasting (all clients receive same events)
5. ✅ Event schema validation (types match specification)

**Run Command**:
```bash
bun tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts
```

---

## Gap Analysis

### Missing Integration: Dashboard ↔ WebSocket

**Current State**:
- App.tsx renders `<SystemOverview />`, `<ActivityLibrary />`, `<LearningSystem />`
- None of these components call `useWebSocket()`

**Required Changes**:
1. Add WebSocket connection in App.tsx or SystemOverview.tsx
2. Pass `onMessage` callback to update component state
3. Handle `execution_started`, `execution_completed`, `template_updated` events
4. Update UI in real-time (no polling needed)

**Example Integration**:
```typescript
// In SystemOverview.tsx
const { connected, error } = useWebSocket({
  enabled: true,
  onMessage: (msg) => {
    if (msg.type === 'execution_completed') {
      // Update execution list state
      setExecutions(prev => [...prev, msg.data]);
    }
    if (msg.type === 'template_updated') {
      // Update template metrics
      updateTemplateMetrics(msg.data.variant_id, msg.data.metrics);
    }
  }
});
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Activity API                            │
│                                                                 │
│  [Entry 1] WebSocket Server (index.ts:164)                     │
│      ↓                                                          │
│  [Entry 2] Authentication Handler (index.ts:188)               │
│      ↓                                                          │
│  broadcaster.addClient()                                        │
│      ↓                                                          │
│  POST /v2/activities/executions                                 │
│      ↓                                                          │
│  [Entry 3] broadcaster.emit(execution_started)                 │
│      ↓                                                          │
│  [Entry 4] broadcaster.emit(execution_completed)               │
│      ↓                                                          │
│  [Entry 5] broadcaster.emit(template_updated)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket Events
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Activity Dashboard                         │
│                                                                 │
│  [Entry 6] api.connectWebSocket() (api-client.ts:274)          │
│      ↓                                                          │
│  [Entry 7] useWebSocket() hook (useWebSocket.ts:24)            │
│      ↓                                                          │
│  ❌ NOT CONNECTED: App.tsx does not use hook                   │
│                                                                 │
│  TODO: Integrate in SystemOverview or App component            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps (To Complete Integration)

1. **Connect Dashboard**:
   - Add `useWebSocket()` call in App.tsx or SystemOverview.tsx
   - Implement `onMessage` handler to update UI state

2. **Implement Token Validation**:
   - Replace stub authentication (index.ts:194)
   - Validate against Redis session store

3. **Deploy & Test**:
   - Deploy Activity API with WebSocket enabled
   - Enable Dashboard WebSocket client
   - Verify real-time updates in production

---

## References

- **Server Implementation**: repos/metabob-activity-api/src/
  - index.ts (WebSocket server)
  - websocket/broadcaster.ts (Broadcasting logic)
  - websocket/types.ts (Message schemas)
  - routes/activities.ts (Event emission)

- **Client Implementation**: repos/activity-dashboard/src/
  - hooks/useWebSocket.ts (React hook)
  - lib/api-client.ts (WebSocket client)
  - App.tsx (Main component, needs integration)

- **Validation**: tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts

- **Specifications**:
  - RIPPLE_SUMMARY_WebSocket-Real-Time-Dashboard-Updates.json
  - CONFLICT_ANALYSIS_WebSocket-Real-Time-Dashboard-Updates.json
