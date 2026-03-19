# WebSocket Real-Time Dashboard Updates - Trace Analysis

**Specification**: WebSocket-Real-Time-Dashboard-Updates  
**Priority**: MEDIUM (Phase 2 of Activity System Data Flow Integration)  
**Estimated Effort**: 4-6 hours  
**Date**: March 19, 2026  
**Status**: ✅ TRACED - 60% Complete (Dashboard ready, server missing)

---

## Executive Summary

**Current State**: Dashboard has full WebSocket client implementation ready, but Activity API has no WebSocket server. Dashboard currently polls REST endpoints.

**Desired State**: Activity API broadcasts execution events via WebSocket, dashboard receives real-time updates without polling.

**Key Insight**: This is a **backend-only** implementation (4-5 hours). Dashboard is already prepared with:
- WebSocket client (repos/activity-dashboard/src/lib/api-client.ts:274)
- React hook with auto-reconnect (repos/activity-dashboard/src/hooks/useWebSocket.ts:24)
- TypeScript types matching spec (repos/activity-dashboard/src/lib/types.ts:252)

---

## Components Analysis

### ✅ COMPLETE - Dashboard WebSocket Client

**Files**:
- repos/activity-dashboard/src/lib/api-client.ts:274-332
- repos/activity-dashboard/src/lib/types.ts:252-280
- repos/activity-dashboard/src/hooks/useWebSocket.ts:1-93

**Current Behavior**:
```typescript
// Client connects to ws://host/ws
connectWebSocket(onMessage: (message: WebSocketMessage) => void)
// Auto-reconnect on disconnect
// Message parsing with error handling
// Authentication via token in first message
```

**Status**: ✅ Fully implemented, tested, ready to use

**Gap**: None - waiting for server implementation

---

### ❌ NOT IMPLEMENTED - Activity API WebSocket Server

**File**: repos/metabob-activity-api/src/index.ts:155  
**Component**: Bun Server Configuration

**Current Behavior**:
```typescript
const server = Bun.serve({
  port,
  fetch: app.fetch,
});
// No WebSocket upgrade handling
```

**Desired Behavior**:
```typescript
const clients = new Set<ServerWebSocket>();

const server = Bun.serve({
  port,
  fetch: app.fetch,
  websocket: {
    open(ws) {
      clients.add(ws);
      console.log('[WebSocket] Client connected');
    },
    message(ws, message) {
      // Handle auth, ping/pong
    },
    close(ws) {
      clients.delete(ws);
      console.log('[WebSocket] Client disconnected');
    },
  },
});
```

**Gap**: Add `websocket` configuration to Bun.serve()  
**Estimate**: 1-2 hours

---

### ⚠️ PARTIAL - Execution Event Broadcasting

**File**: repos/metabob-activity-api/src/routes/activities.ts:599  
**Component**: POST /executions Handler

**Current Behavior**:
```typescript
// Execution recorded in DB
await surrealDB.create('activity_executions', executionData);

// Thompson Sampling metrics updated
await updateMetrics(variantId, success, duration, cost);

// Redis cache invalidated
await redis.del(`template:${variantId}`);

// ❌ NO EVENT EMISSION
```

**Desired Behavior**:
```typescript
// 1. Emit execution_started event
WebSocketBroadcaster.emit({
  type: 'execution_started',
  timestamp: new Date().toISOString(),
  data: { execution_id, variant_id, pod_name }
});

// 2. Record execution in DB
await surrealDB.create('activity_executions', executionData);

// 3. Update Thompson Sampling
await updateMetrics(variantId, success, duration, cost);

// 4. Emit execution_completed event
WebSocketBroadcaster.emit({
  type: 'execution_completed',
  timestamp: new Date().toISOString(),
  data: { execution_id, variant_id, success, duration_ms, cost }
});

// 5. Emit template_metrics_updated event
const updatedMetrics = await getMetrics(variantId);
WebSocketBroadcaster.emit({
  type: 'template_metrics_updated',
  timestamp: new Date().toISOString(),
  data: { variant_id, metrics: updatedMetrics }
});
```

**Gap**: Add WebSocketBroadcaster.emit() calls at 3 trigger points  
**Estimate**: 30 minutes (after broadcaster exists)

---

## Data Flow

### Current State (Polling)
```
MiniBob executes activity
  → POST /v2/activities/executions
  → SurrealDB.create(activity_executions)
  → Thompson Sampling update
  → Redis cache invalidation
  → Return 200 OK

Dashboard (separate flow)
  → setInterval(fetchExecutions, 5000)  // Poll every 5 seconds
  → GET /v2/activities/executions?limit=50
  → Update UI
```

**Problems**:
- 5-second latency minimum
- Unnecessary API calls when no changes
- Server load from polling
- Poor user experience

---

### Desired State (WebSocket)
```
MiniBob executes activity
  → POST /v2/activities/executions
  → WebSocketBroadcaster.emit('execution_started')
  → All connected clients receive event instantly
  → SurrealDB.create(activity_executions)
  → Thompson Sampling update
  → WebSocketBroadcaster.emit('execution_completed')
  → WebSocketBroadcaster.emit('template_metrics_updated')
  → All connected clients update UI reactively
  → Return 200 OK

Dashboard
  → useWebSocket() hook maintains connection
  → onMessage(event) → updateLocalState(event.data)
  → UI updates immediately (0-100ms latency)
```

**Benefits**:
- Real-time updates (<100ms latency)
- Zero polling overhead
- Scales to multiple dashboard clients
- Better user experience

---

## Implementation Plan

### Step 1: Create WebSocket Infrastructure (1-2 hours)

**New Files**:
```
repos/metabob-activity-api/src/websocket/
  ├── broadcaster.ts  # Singleton for emitting events to all clients
  └── types.ts        # WebSocket message types (match dashboard)
```

**broadcaster.ts**:
```typescript
import { ServerWebSocket } from 'bun';

class WebSocketBroadcaster {
  private clients: Set<ServerWebSocket> = new Set();

  addClient(ws: ServerWebSocket) {
    this.clients.add(ws);
  }

  removeClient(ws: ServerWebSocket) {
    this.clients.delete(ws);
  }

  emit(message: WebSocketMessage) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      client.send(payload);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const broadcaster = new WebSocketBroadcaster();
```

---

### Step 2: Integrate WebSocket with Bun Server (1 hour)

**File**: repos/metabob-activity-api/src/index.ts:155

**Changes**:
```typescript
import { broadcaster } from './websocket/broadcaster';

const server = Bun.serve({
  port,
  fetch(req, server) {
    // Handle WebSocket upgrade for /ws endpoint
    if (req.url.endsWith('/ws')) {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    
    // Regular HTTP requests
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      broadcaster.addClient(ws);
      logger.info('[WebSocket] Client connected', { 
        totalClients: broadcaster.getClientCount() 
      });
    },
    message(ws, message) {
      // Handle client messages (auth, ping/pong)
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'authenticate') {
          // Validate token, associate with session
        }
      } catch (error) {
        logger.error('[WebSocket] Invalid message', { error });
      }
    },
    close(ws) {
      broadcaster.removeClient(ws);
      logger.info('[WebSocket] Client disconnected', { 
        totalClients: broadcaster.getClientCount() 
      });
    },
  },
});
```

---

### Step 3: Emit Events from Execution Handler (30 minutes)

**File**: repos/metabob-activity-api/src/routes/activities.ts:599

**Changes**:
```typescript
import { broadcaster } from '../websocket/broadcaster';

// In POST /executions handler:

// 1. Emit execution_started
broadcaster.emit({
  type: 'execution_started',
  timestamp: new Date().toISOString(),
  data: {
    execution_id: executionId,
    variant_id: variantId,
    pod_name: podName,
  },
});

// 2. Record execution (existing code)
const execution = await surrealDB.create('activity_executions', ...);

// 3. Update Thompson Sampling (existing code)
await updateThompsonSamplingMetrics(...);

// 4. Emit execution_completed
broadcaster.emit({
  type: 'execution_completed',
  timestamp: new Date().toISOString(),
  data: {
    execution_id: executionId,
    variant_id: variantId,
    success: execution.success,
    duration_ms: execution.duration_ms,
    cost: execution.cost,
    completed_at: execution.completed_at,
  },
});

// 5. Emit template_metrics_updated
const metrics = await getVariantMetrics(variantId);
broadcaster.emit({
  type: 'template_metrics_updated',
  timestamp: new Date().toISOString(),
  data: {
    variant_id: variantId,
    metrics: {
      success_rate: metrics.success_rate,
      avg_duration_ms: metrics.avg_duration_ms,
      avg_cost_usd: metrics.avg_cost_usd,
      thompson_alpha: metrics.thompson_alpha,
      thompson_beta: metrics.thompson_beta,
    },
  },
});
```

---

### Step 4: Update Dashboard to Use WebSocket (1-2 hours)

**File**: repos/activity-dashboard/src/pages/Dashboard.tsx

**Changes**:
```typescript
import { useWebSocket } from '../hooks/useWebSocket';

function Dashboard() {
  const [executions, setExecutions] = useState([]);
  
  // Connect WebSocket and handle messages
  useWebSocket({
    autoConnect: true,
    onMessage: (message) => {
      switch (message.type) {
        case 'execution_started':
          // Show loading indicator for execution
          setExecutions(prev => [...prev, {
            ...message.data,
            status: 'running'
          }]);
          break;
          
        case 'execution_completed':
          // Update execution with results
          setExecutions(prev => prev.map(exec =>
            exec.execution_id === message.data.execution_id
              ? { ...exec, ...message.data, status: 'completed' }
              : exec
          ));
          break;
          
        case 'template_metrics_updated':
          // Update template metrics in real-time
          updateTemplateMetrics(message.data.variant_id, message.data.metrics);
          break;
      }
    },
  });
  
  // Rest of component...
}
```

---

### Step 5: Test End-to-End (1 hour)

**Test Scenario**:
1. Start Activity API with WebSocket server
2. Open Dashboard in browser (verify WebSocket connection in DevTools)
3. Trigger MiniBob execution
4. Verify dashboard shows "Execution started" immediately
5. Verify dashboard updates with results when execution completes
6. Verify template metrics update in real-time
7. Open second browser tab (verify both receive events)
8. Close one tab (verify other still works)

**Success Criteria**:
- Dashboard updates within 100ms of execution start
- No polling requests in Network tab
- Multiple clients receive same events
- Reconnection works after server restart

---

## Event Types (Matches Dashboard Types)

### execution_started
```typescript
{
  type: 'execution_started',
  timestamp: '2026-03-19T10:30:00.123Z',
  data: {
    execution_id: 'exec_abc123',
    variant_id: 'variant_xyz789',
    pod_name: 'minibob-pod-1'  // optional
  }
}
```

**Trigger Point**: Before DB insert  
**Dashboard Action**: Show loading indicator

---

### execution_completed
```typescript
{
  type: 'execution_completed',
  timestamp: '2026-03-19T10:35:00.456Z',
  data: {
    execution_id: 'exec_abc123',
    variant_id: 'variant_xyz789',
    success: true,
    duration_ms: 45000,
    cost: 0.0234,
    completed_at: '2026-03-19T10:35:00.456Z'
  }
}
```

**Trigger Point**: After Thompson Sampling update  
**Dashboard Action**: Update execution row, show success/failure

---

### template_metrics_updated
```typescript
{
  type: 'template_metrics_updated',
  timestamp: '2026-03-19T10:35:00.500Z',
  data: {
    variant_id: 'variant_xyz789',
    metrics: {
      success_rate: 0.85,
      avg_duration_ms: 42000,
      avg_cost_usd: 0.021,
      thompson_alpha: 18,
      thompson_beta: 4
    }
  }
}
```

**Trigger Point**: After metrics recalculation  
**Dashboard Action**: Update template card, update Thompson score

---

## Technical Details

### Bun WebSocket API
```typescript
Bun.serve({
  fetch: (req, server) => {
    // HTTP requests OR WebSocket upgrade
  },
  websocket: {
    open(ws: ServerWebSocket): void,
    message(ws: ServerWebSocket, message: string | Buffer): void,
    close(ws: ServerWebSocket, code?: number, reason?: string): void,
    drain(ws: ServerWebSocket): void,  // Optional: backpressure handling
  }
})
```

**No library needed** - Bun has native WebSocket support

---

### Authentication Strategy

**Client sends auth token in first message**:
```typescript
// Dashboard (already implemented)
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: this.token
  }));
};
```

**Server validates and associates session**:
```typescript
// Activity API (new)
message(ws, message) {
  const data = JSON.parse(message);
  if (data.type === 'authenticate') {
    const session = await validateToken(data.token);
    ws.data = { sessionId: session.id, orgId: session.orgId };
  }
}
```

**Multi-tenant event filtering**:
```typescript
broadcast(message, sessionId) {
  for (const client of clients) {
    if (client.data.sessionId === sessionId) {
      client.send(JSON.stringify(message));
    }
  }
}
```

---

## Dependencies

### Blocking
- Execution history endpoint (GET /executions) must exist
  - WebSocket events reference execution_id
  - Dashboard needs endpoint to fetch historical data on load

### Non-Blocking
- Dashboard works with polling until WebSocket ready
- WebSocket is enhancement, not core requirement
- Can deploy backend first, dashboard auto-upgrades

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Broadcast overhead with many clients | High CPU usage | Limit clients per session, use connection pool |
| Reconnection storms | Server overload | Exponential backoff, jitter, max retry limit |
| Event ordering issues | Out-of-order updates | Add sequence numbers, client-side reordering |
| Auth bypass | Security vulnerability | Validate token on every connection, not just first message |
| Multi-tenant data leak | Critical security | Filter events by session.orgId before broadcast |

---

## Testing Strategy

### Unit Tests
```typescript
describe('WebSocketBroadcaster', () => {
  it('emits to all connected clients', () => {
    const client1 = mockWebSocket();
    const client2 = mockWebSocket();
    
    broadcaster.addClient(client1);
    broadcaster.addClient(client2);
    
    broadcaster.emit({ type: 'execution_started', ... });
    
    expect(client1.send).toHaveBeenCalled();
    expect(client2.send).toHaveBeenCalled();
  });
});
```

### Integration Tests
```typescript
describe('WebSocket Server', () => {
  it('handles client connection lifecycle', async () => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    
    await waitForConnection(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    
    ws.close();
    await waitForClose(ws);
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
```

### E2E Tests
```bash
# 1. Start services
docker-compose up activity-api minibob dashboard

# 2. Trigger execution
curl -X POST http://localhost:8080/v2/activities/executions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"variant_id": "test-variant"}'

# 3. Verify dashboard received events
# (Check WebSocket messages in browser DevTools)
```

---

## Success Metrics

- ✅ WebSocket connection established on dashboard load
- ✅ execution_started event received <100ms after POST /executions
- ✅ execution_completed event received <100ms after execution finishes
- ✅ template_metrics_updated event received <100ms after metrics update
- ✅ Multiple dashboard clients receive same events
- ✅ Auto-reconnect works after server restart
- ✅ Zero polling requests in Network tab
- ✅ No auth bypass (unauthenticated clients rejected)
- ✅ No multi-tenant data leak (events filtered by session)

---

## Next Steps

1. **Implement Step 1** (broadcaster.ts) - 1 hour
2. **Implement Step 2** (Bun WebSocket config) - 1 hour
3. **Implement Step 3** (event emission) - 30 minutes
4. **Implement Step 4** (dashboard integration) - 1-2 hours
5. **Test E2E** - 1 hour

**Total**: 4.5-5.5 hours

**Priority**: MEDIUM (Phase 2 after execution history endpoint)

**Dependency**: Execute after HIGH priority gaps (impulse storage, execution history endpoint)

