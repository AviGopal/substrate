# Code Quality Issues: WebSocket-Real-Time-Dashboard-Updates

## Overview

This document identifies code quality issues in the WebSocket real-time dashboard updates data flow, discovered through manual code review. Issues are categorized by severity and type.

**Note**: Metabob code quality analysis returned 0 results, indicating the codebase has not been analyzed by the background engine yet. This analysis is based on manual code review during data flow tracing.

---

## Issues Summary

**Total Issues Found**: 12

**By Severity**:
- HIGH: 4 issues (security, data integrity)
- MEDIUM: 5 issues (error handling, testability)
- LOW: 3 issues (code quality, maintainability)

**By Type**:
- Security: 3 issues
- Validation: 2 issues
- Error Handling: 3 issues
- Architecture: 2 issues
- Performance: 1 issue
- Maintainability: 1 issue

---

## HIGH Priority Issues

### Issue 1: WebSocket Authentication Stub (SECURITY)

**Severity**: HIGH  
**Type**: Security - Authentication Bypass  
**Location**: repos/metabob-activity-api/src/index.ts:194

**Code**:
```typescript
// TODO: Validate token against Redis or JWT verification
// For now, just mark as authenticated
ws.data.authenticated = true;
ws.data.sessionId = data.sessionId || 'default';
ws.data.orgId = data.orgId || 'default';
```

**Issue Description**:
WebSocket authentication accepts any token without validation. All clients are marked as authenticated regardless of token validity.

**Impact on Data Flow**:
- **CRITICAL**: All connected clients receive execution broadcasts
- Unauthorized users can see execution data, metrics, and template updates
- Multi-tenancy broken: clients can see other organizations' data
- Violates security boundary between organizations

**Why It's Blocking**:
This is a critical security vulnerability that must be fixed before production deployment. It defeats the entire authentication system.

**Recommended Fix**:
```typescript
// Validate token against Redis session store
const sessionKey = Buffer.from(data.token, 'base64').toString('utf-8');
const redis = RedisClient.getInstance();
const sessionDataRaw = await redis.hget(sessionKey, 'data');

if (!sessionDataRaw) {
  ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
  ws.close();
  return;
}

const sessionData = SessionDataSchema.parse(JSON.parse(sessionDataRaw));
ws.data.authenticated = true;
ws.data.sessionId = sessionData.session_id;
ws.data.orgId = sessionData.org_id || 'default';
```

**Related Files**:
- repos/metabob-activity-api/src/middleware/auth.ts (HTTP auth implementation to mirror)
- repos/metabob-activity-api/src/websocket/broadcaster.ts (uses authenticated flag)

**CVE Risk**: Potential for unauthorized data access (CWE-306: Missing Authentication)

---

### Issue 2: No Runtime Validation on Client WebSocket Messages (VALIDATION)

**Severity**: HIGH  
**Type**: Validation - Type Safety Gap  
**Location**: repos/activity-dashboard/src/lib/api-client.ts:296-301

**Code**:
```typescript
this.ws.onmessage = (event) => {
  try {
    const message: WebSocketMessage = JSON.parse(event.data);
    onMessage(message);
  } catch (error) {
    console.error('[WebSocket] Failed to parse message:', error);
  }
};
```

**Issue Description**:
Client uses TypeScript type assertion without runtime validation. Malicious server or network corruption could send invalid messages.

**Impact on Data Flow**:
- **HIGH**: Type safety only at compile time, not runtime
- Malformed messages could crash client or cause UI errors
- No validation of message structure, field types, or required fields
- UI could receive unexpected data shapes

**Why It's Blocking**:
Production systems need defense-in-depth. TypeScript types don't protect against runtime data corruption or malicious servers.

**Recommended Fix**:
```typescript
import { WebSocketMessageSchema } from './schemas'; // Add Zod schema

this.ws.onmessage = (event) => {
  try {
    const parsed = JSON.parse(event.data);
    const message = WebSocketMessageSchema.parse(parsed); // Zod validation
    onMessage(message);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('[WebSocket] Invalid message schema:', error.errors);
    } else {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }
};
```

**Related Files**:
- repos/metabob-activity-api/src/websocket/types.ts (server-side schemas to mirror)
- repos/activity-dashboard/src/lib/types.ts (client-side types)

---

### Issue 3: Missing Transaction Support (DATA INTEGRITY)

**Severity**: HIGH  
**Type**: Data Integrity - Partial Updates  
**Location**: repos/metabob-activity-api/src/routes/activities.ts:556-687

**Code**:
```typescript
// INSERT execution record
await surrealDB.query(insertExecutionQuery, insertParams);

// UPDATE metrics (separate query)
const updatedMetrics = await surrealDB.query(updateMetricsQuery, updateParams);

// Redis cache invalidation (third operation)
await redis.del(`${CACHE_KEY_PREFIX}${validated.variant_id}`);
```

**Issue Description**:
Execution recording involves 3 separate operations (INSERT, UPDATE, Redis DEL) without transaction protection. If any fails, database is left in inconsistent state.

**Impact on Data Flow**:
- **HIGH**: Partial execution records without metrics update
- Metrics could be updated but execution not saved (if INSERT fails)
- Cache could be stale if invalidation fails
- Thompson Sampling calculations incorrect if metrics update fails

**Failure Scenarios**:
1. INSERT succeeds → UPDATE fails → Execution record exists but metrics not updated
2. INSERT succeeds → UPDATE succeeds → Redis DEL fails → Stale cache served
3. INSERT fails after broadcast → Client sees execution_started event for non-existent execution

**Why It's Blocking**:
Data integrity is critical for the learning loop. Inconsistent metrics corrupt Thompson Sampling.

**Recommended Fix**:
```typescript
// SurrealDB supports transactions (BEGIN...COMMIT)
const result = await surrealDB.query(`
  BEGIN TRANSACTION;
  
  INSERT INTO activity_executions { ... };
  
  UPDATE variant_performance_metrics 
  SET total_executions += 1, ...
  WHERE variant_id = $variant_id;
  
  COMMIT TRANSACTION;
`, params);

// Redis invalidation as best-effort (log error if fails)
try {
  await redis.del(`${CACHE_KEY_PREFIX}${validated.variant_id}`);
} catch (error) {
  logger.error('Cache invalidation failed', { error });
}
```

**Related Files**:
- repos/metabob-activity-api/src/db/surreal.ts (database client)
- repos/metabob-activity-api/src/routes/activities.ts (all execution recording endpoints)

---

### Issue 4: Optimistic Broadcasting Without Rollback (DATA CONSISTENCY)

**Severity**: HIGH  
**Type**: Data Consistency - Optimistic Update Risk  
**Location**: repos/metabob-activity-api/src/routes/activities.ts:541-598

**Code**:
```typescript
// Broadcast execution_started BEFORE database write
broadcaster.emit({
  type: 'execution_started',
  timestamp: new Date().toISOString(),
  data: executionStartedData,
});

// Then attempt database INSERT
const insertResult = await surrealDB.query(insertExecutionQuery, insertParams);
// If this fails, client already notified of execution that doesn't exist
```

**Issue Description**:
execution_started event broadcast before database persistence. If INSERT fails, client shows execution that doesn't exist in database.

**Impact on Data Flow**:
- **MEDIUM-HIGH**: Client UI shows "Running" execution that failed to persist
- No rollback mechanism to notify client of failure
- UI state diverges from database state
- execution_completed event never arrives if INSERT fails

**Why It's Concerning**:
UX suffers when executions appear to hang forever. Debug difficulty when UI and DB disagree.

**Recommended Fix** (Option 1 - Conservative):
```typescript
// Move broadcast AFTER successful INSERT
const insertResult = await surrealDB.query(insertExecutionQuery, insertParams);

if (!insertResult.success) {
  throw new Error('Failed to insert execution record');
}

// Now safe to broadcast
broadcaster.emit({ type: 'execution_started', ... });
```

**Recommended Fix** (Option 2 - Rollback):
```typescript
// Keep optimistic broadcast but add rollback event
broadcaster.emit({ type: 'execution_started', ... });

try {
  await surrealDB.query(insertExecutionQuery, insertParams);
} catch (error) {
  // Broadcast rollback event
  broadcaster.emit({
    type: 'execution_failed',
    data: { execution_id: executionId, reason: 'Database insert failed' }
  });
  throw error;
}
```

**Related Files**:
- repos/metabob-activity-api/src/websocket/broadcaster.ts
- repos/activity-dashboard/src/hooks/useWebSocket.ts (needs to handle rollback events)

---

## MEDIUM Priority Issues

### Issue 5: No Rate Limiting on HTTP Endpoints (SECURITY)

**Severity**: MEDIUM  
**Type**: Security - DoS Vulnerability  
**Location**: repos/metabob-activity-api/src/index.ts (middleware stack)

**Code**:
```typescript
app.use(cors(corsOptions));
app.use(honoLogger());
app.use('*', authMiddleware);
// No rate limiting middleware
```

**Issue Description**:
No rate limiting on HTTP endpoints. Vulnerable to denial-of-service attacks.

**Impact on Data Flow**:
- **MEDIUM**: Attacker can flood POST /v2/activities/executions
- Database overwhelmed with INSERT queries
- WebSocket clients receive broadcast storm
- Legitimate executions delayed or lost

**Why It's Technical Debt**:
Not a data flow bug, but a production deployment blocker. Should be fixed before public deployment.

**Recommended Fix**:
```typescript
import { rateLimiter } from 'hono-rate-limiter';

app.use(rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute per IP
  message: 'Too many requests, please try again later',
}));
```

**Related Files**:
- repos/metabob-activity-api/src/index.ts (middleware stack)
- repos/metabob-activity-api/package.json (add hono-rate-limiter dependency)

---

### Issue 6: No Service Layer - Transaction Script Pattern (ARCHITECTURE)

**Severity**: MEDIUM  
**Type**: Architecture - Testability Issue  
**Location**: repos/metabob-activity-api/src/routes/activities.ts (entire file)

**Code**:
```typescript
app.post('/v2/activities/executions', async (c) => {
  // Validation
  const validated = ExecutionRecordSchema.parse(body);
  
  // Business logic
  const success_delta = validated.success ? 1 : 0;
  
  // Database queries
  await surrealDB.query(insertExecutionQuery, params);
  await surrealDB.query(updateMetricsQuery, params);
  
  // Cache invalidation
  await redis.del(cacheKey);
  
  // WebSocket broadcasts
  broadcaster.emit(executionCompleted);
  
  // Response
  return c.json(response, 201);
});
```

**Issue Description**:
Controller, Service, and Repository layers all in one function. Business logic mixed with HTTP concerns and database queries.

**Impact on Data Flow**:
- **MEDIUM**: Difficult to unit test business logic
- Cannot mock database for testing
- Tight coupling to Hono framework and SurrealDB
- Code duplication across similar endpoints

**Why It's Technical Debt**:
Not a bug, but makes future changes risky. Hard to test, hard to refactor, hard to swap databases.

**Recommended Fix**:
```typescript
// Service Layer
class ActivityService {
  constructor(
    private repository: ActivityRepository,
    private metricsService: MetricsService,
    private broadcaster: WebSocketBroadcaster
  ) {}

  async recordExecution(record: ExecutionRecord): Promise<ExecutionRecordResponse> {
    const executionId = await this.repository.saveExecution(record);
    const metrics = await this.metricsService.updateMetrics(record);
    await this.broadcaster.emitCompletion(record);
    return { success: true, execution_id: executionId, metrics };
  }
}

// Controller
app.post('/v2/activities/executions', async (c) => {
  const validated = ExecutionRecordSchema.parse(await c.req.json());
  const result = await activityService.recordExecution(validated);
  return c.json(result, 201);
});
```

**Related Files**:
- All routes in repos/metabob-activity-api/src/routes/

---

### Issue 7: Missing Error Context in WebSocket Broadcasts (ERROR HANDLING)

**Severity**: MEDIUM  
**Type**: Error Handling - Debugging Difficulty  
**Location**: repos/metabob-activity-api/src/websocket/broadcaster.ts:56-69

**Code**:
```typescript
for (const client of this.clients) {
  try {
    if (client.data?.authenticated) {
      client.send(payload);
      successCount++;
    }
  } catch (error: any) {
    logger.error('[WebSocket] Failed to send message to client', {
      error: error.message,
    });
    failureCount++;
    // No context about which client or message type
  }
}
```

**Issue Description**:
Error logging missing client context (sessionId, orgId) and message metadata (type, execution_id).

**Impact on Data Flow**:
- **MEDIUM**: Hard to debug broadcast failures
- Can't identify which clients are failing
- Can't correlate failures to specific executions
- No metrics on failure patterns

**Why It's Technical Debt**:
Doesn't break functionality, but production debugging is painful without context.

**Recommended Fix**:
```typescript
for (const client of this.clients) {
  try {
    if (client.data?.authenticated) {
      client.send(payload);
      successCount++;
    }
  } catch (error: any) {
    logger.error('[WebSocket] Failed to send message to client', {
      error: error.message,
      sessionId: client.data?.sessionId,
      orgId: client.data?.orgId,
      authenticated: client.data?.authenticated,
      messageType: message.type, // Add message type
      executionId: message.data?.execution_id, // Add execution context
    });
    failureCount++;
  }
}
```

**Related Files**:
- repos/metabob-activity-api/src/websocket/broadcaster.ts

---

### Issue 8: No Reconnection Limit Enforcement (ERROR HANDLING)

**Severity**: MEDIUM  
**Type**: Error Handling - Resource Leak  
**Location**: repos/activity-dashboard/src/hooks/useWebSocket.ts:60-76

**Code**:
```typescript
if (reconnectAttempts < maxReconnectAttempts) {
  reconnectTimeoutRef.current = window.setTimeout(() => {
    setReconnectAttempts((prev) => prev + 1);
    connect();
  }, reconnectInterval);
}
// What happens when maxReconnectAttempts reached? Nothing.
```

**Issue Description**:
After maxReconnectAttempts (10), reconnection stops silently. No user notification, no fallback behavior.

**Impact on Data Flow**:
- **MEDIUM**: User unaware that real-time updates stopped
- Dashboard shows stale data
- No way to manually retry connection
- UI doesn't indicate disconnected state

**Why It's Technical Debt**:
UX issue, not a crash bug. But users need to know when real-time updates are unavailable.

**Recommended Fix**:
```typescript
if (reconnectAttempts < maxReconnectAttempts) {
  reconnectTimeoutRef.current = window.setTimeout(() => {
    setReconnectAttempts((prev) => prev + 1);
    connect();
  }, reconnectInterval);
} else {
  // Max attempts reached
  setError(new Error('Failed to reconnect after maximum attempts'));
  
  // Notify user
  console.error('[WebSocket] Max reconnection attempts reached. Real-time updates unavailable.');
  
  // Optionally: trigger user notification or fallback to polling
}
```

**Related Files**:
- repos/activity-dashboard/src/hooks/useWebSocket.ts
- repos/activity-dashboard/src/App.tsx (display error to user)

---

### Issue 9: Type Duplication Across Repositories (MAINTAINABILITY)

**Severity**: MEDIUM  
**Type**: Maintainability - Schema Drift Risk  
**Location**: 
- repos/metabob-activity-api/src/websocket/types.ts
- repos/activity-dashboard/src/lib/types.ts

**Code**:
```typescript
// Server: metabob-activity-api/src/websocket/types.ts
export interface ExecutionCompletedMessage extends WebSocketMessage {
  type: 'execution_completed';
  timestamp: string;
  data: {
    execution_id: string;
    variant_id: string;
    success: boolean;
    duration_ms: number;
    cost: number;
    completed_at: string;
  };
}

// Client: activity-dashboard/src/lib/types.ts
export interface ExecutionCompletedMessage extends WebSocketMessage {
  type: 'execution_completed';
  timestamp: string;
  data: {
    execution_id: string;
    variant_id: string;
    success: boolean;
    duration_ms: number;
    cost: number;
    completed_at: string;
  };
}
// Identical, but manually duplicated
```

**Issue Description**:
WebSocket message types duplicated across server and client repos. Changes must be synchronized manually.

**Impact on Data Flow**:
- **MEDIUM**: Schema drift if types not synchronized
- Client expects fields server no longer sends
- Server sends fields client doesn't expect
- No automated compatibility checking

**Why It's Technical Debt**:
Not a bug today, but maintenance burden. Risk of breaking changes slipping through.

**Recommended Fix**:
Option 1: Shared package
```typescript
// Create @metabob/activity-types package
// Both repos import from shared package
import { ExecutionCompletedMessage } from '@metabob/activity-types';
```

Option 2: Contract testing
```typescript
// Add Pact or similar contract testing
// Validate API responses match TypeScript types
```

**Related Files**:
- repos/metabob-activity-api/src/websocket/types.ts
- repos/metabob-activity-api/src/models/schemas.ts
- repos/activity-dashboard/src/lib/types.ts

---

## LOW Priority Issues

### Issue 10: Inefficient Broadcast Iteration (PERFORMANCE)

**Severity**: LOW  
**Type**: Performance - O(n) Broadcasting  
**Location**: repos/metabob-activity-api/src/websocket/broadcaster.ts:52-69

**Code**:
```typescript
const payload = JSON.stringify(message);
let successCount = 0;
let failureCount = 0;

for (const client of this.clients) {
  try {
    if (client.data?.authenticated) {
      client.send(payload);
      successCount++;
    }
  } catch (error: any) {
    logger.error('[WebSocket] Failed to send message to client', {
      error: error.message,
    });
    failureCount++;
  }
}
```

**Issue Description**:
Broadcasting is O(n) synchronous iteration. JSON.stringify() done once (good), but send() is blocking.

**Impact on Data Flow**:
- **LOW**: Broadcast latency increases with client count
- 100 clients = ~10ms broadcast time
- 1000 clients = ~100ms broadcast time
- Slow clients block other broadcasts

**Why It's Technical Debt**:
Not a problem at current scale (<100 clients expected), but could become bottleneck at larger scale.

**Recommended Fix**:
```typescript
// Use Promise.all for parallel sending
const payload = JSON.stringify(message);
const sendPromises = [];

for (const client of this.clients) {
  if (client.data?.authenticated) {
    sendPromises.push(
      client.send(payload).catch((error) => {
        logger.error('[WebSocket] Failed to send message to client', { error });
      })
    );
  }
}

await Promise.all(sendPromises);
```

**Related Files**:
- repos/metabob-activity-api/src/websocket/broadcaster.ts

---

### Issue 11: No WebSocket Ping/Pong Heartbeat (ERROR HANDLING)

**Severity**: LOW  
**Type**: Error Handling - Connection Health  
**Location**: repos/metabob-activity-api/src/index.ts (WebSocket handlers)

**Code**:
```typescript
websocket: {
  open(ws) {
    broadcaster.addClient(ws);
  },
  message(ws, message) {
    // Handles 'ping' but doesn't send automatic pings
    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      return;
    }
  },
  close(ws) {
    broadcaster.removeClient(ws);
  }
}
```

**Issue Description**:
Server responds to client pings but doesn't proactively send heartbeats. Dead connections not detected.

**Impact on Data Flow**:
- **LOW**: Zombie connections accumulate in broadcaster
- Client appears connected but isn't receiving messages
- Broadcaster.getClientCount() inflated by dead connections

**Why It's Technical Debt**:
Minor issue, connections eventually timeout. But cleaner to detect and close dead connections proactively.

**Recommended Fix**:
```typescript
// Add heartbeat interval
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

websocket: {
  open(ws) {
    broadcaster.addClient(ws);
    
    // Set heartbeat interval
    ws.data.heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
      } else {
        clearInterval(ws.data.heartbeatInterval);
      }
    }, HEARTBEAT_INTERVAL);
  },
  
  close(ws) {
    if (ws.data.heartbeatInterval) {
      clearInterval(ws.data.heartbeatInterval);
    }
    broadcaster.removeClient(ws);
  }
}
```

**Related Files**:
- repos/metabob-activity-api/src/index.ts
- repos/activity-dashboard/src/hooks/useWebSocket.ts (respond to server pings)

---

### Issue 12: No HTTPS/WSS Enforcement (SECURITY)

**Severity**: LOW (Development) / HIGH (Production)  
**Type**: Security - Man-in-the-Middle Risk  
**Location**: repos/metabob-activity-api/src/index.ts, repos/activity-dashboard/src/lib/api-client.ts

**Code**:
```typescript
// Server: index.ts
Bun.serve({
  port: config.port, // No TLS configuration
  fetch: app.fetch,
  websocket: { ... }
});

// Client: api-client.ts
this.wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
// Assumes HTTP in development
```

**Issue Description**:
No HTTPS/WSS enforcement. Traffic sent in cleartext during development (OK), but deployment process doesn't enforce TLS.

**Impact on Data Flow**:
- **LOW (dev)**: Acceptable for local development
- **HIGH (production)**: Session tokens, execution data, metrics visible to network sniffers
- Man-in-the-middle can read WebSocket messages
- Session token theft risk

**Why It's Technical Debt**:
Not a bug in dev environment, but must be enforced before production deployment.

**Recommended Fix**:
```typescript
// Server: index.ts (production mode)
const tlsOptions = process.env.NODE_ENV === 'production' ? {
  key: fs.readFileSync(process.env.TLS_KEY_PATH!),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH!),
} : undefined;

Bun.serve({
  port: config.port,
  tls: tlsOptions,
  fetch: app.fetch,
  websocket: { ... }
});

// Or use reverse proxy (nginx, Caddy) with TLS termination
```

**Related Files**:
- repos/metabob-activity-api/src/index.ts
- Deployment configuration (Kubernetes, Docker Compose)

---

## Related Files to Review

Based on identified issues, the following files should be reviewed for related concerns:

### Security Review
1. **repos/metabob-activity-api/src/middleware/auth.ts**
   - Reason: HTTP authentication is implemented here; WebSocket should mirror this
   - Action: Use as reference for WebSocket token validation (Issue 1)

2. **repos/metabob-activity-api/src/db/redis.ts**
   - Reason: Session validation requires Redis access
   - Action: Ensure connection pooling handles WebSocket authentication load

### Validation Review
3. **repos/metabob-activity-api/src/models/schemas.ts**
   - Reason: Server-side Zod schemas for validation
   - Action: Ensure all WebSocket message types have schemas

4. **repos/activity-dashboard/src/lib/types.ts**
   - Reason: Client-side type definitions (duplicated from server)
   - Action: Add Zod schemas for runtime validation (Issue 2)

### Data Integrity Review
5. **repos/metabob-activity-api/src/db/surreal.ts**
   - Reason: Database client, transaction support
   - Action: Add transaction methods for multi-query operations (Issue 3)

6. **repos/metabob-activity-api/src/routes/activities.ts**
   - Reason: All execution recording endpoints
   - Action: Refactor to use transactions, add rollback for optimistic broadcasts (Issues 3, 4)

### Error Handling Review
7. **repos/metabob-activity-api/src/utils/logger.ts**
   - Reason: Logging utility, context enrichment
   - Action: Ensure logger supports structured context (Issue 7)

8. **repos/activity-dashboard/src/hooks/useWebSocket.ts**
   - Reason: WebSocket client, reconnection logic
   - Action: Add user notification for max reconnect attempts (Issue 8)

### Architecture Review
9. **repos/metabob-activity-api/src/routes/**
   - Reason: All routes use Transaction Script pattern
   - Action: Introduce service layer for business logic (Issue 6)

10. **repos/metabob-activity-api/src/websocket/broadcaster.ts**
    - Reason: WebSocket broadcasting logic
    - Action: Add client context to error logs, optimize broadcast performance (Issues 7, 10)

---

## Issue Priority Matrix

| Issue | Severity | Type | Blocking? | Effort | Impact |
|-------|----------|------|-----------|--------|--------|
| 1. WebSocket Auth Stub | HIGH | Security | ✅ Yes | Medium | Critical |
| 2. No Client Validation | HIGH | Validation | ⚠️ Recommended | Low | High |
| 3. No Transactions | HIGH | Data Integrity | ⚠️ Recommended | Medium | High |
| 4. Optimistic Broadcast | HIGH | Data Consistency | ⚠️ Maybe | Medium | Medium |
| 5. No Rate Limiting | MEDIUM | Security | ⚠️ Pre-production | Low | Medium |
| 6. No Service Layer | MEDIUM | Architecture | ❌ Debt | High | Low |
| 7. Missing Error Context | MEDIUM | Error Handling | ❌ Debt | Low | Low |
| 8. No Reconnect Limit | MEDIUM | Error Handling | ❌ Debt | Low | Medium |
| 9. Type Duplication | MEDIUM | Maintainability | ❌ Debt | Medium | Low |
| 10. Inefficient Broadcast | LOW | Performance | ❌ Debt | Low | Low |
| 11. No Heartbeat | LOW | Error Handling | ❌ Debt | Low | Low |
| 12. No HTTPS/WSS | LOW/HIGH | Security | ✅ Production | Low | Critical (prod) |

---

## Recommended Action Plan

### Phase 1: Security (Blocking)
1. Fix WebSocket authentication stub (Issue 1) - **CRITICAL**
2. Add runtime validation on client (Issue 2) - **RECOMMENDED**
3. Enforce HTTPS/WSS in production (Issue 12) - **PRODUCTION BLOCKER**

### Phase 2: Data Integrity (Recommended)
4. Add transaction support (Issue 3) - **RECOMMENDED**
5. Handle optimistic broadcast failures (Issue 4) - **NICE TO HAVE**
6. Add rate limiting (Issue 5) - **PRE-PRODUCTION**

### Phase 3: Technical Debt (Post-Launch)
7. Refactor to service layer (Issue 6) - **LONG TERM**
8. Add error context to logs (Issue 7) - **OBSERVABILITY**
9. Fix reconnection limit UX (Issue 8) - **UX IMPROVEMENT**
10. Resolve type duplication (Issue 9) - **MAINTENANCE**
11. Optimize broadcast performance (Issue 10) - **SCALE**
12. Add WebSocket heartbeat (Issue 11) - **CONNECTION HEALTH**

---

## Metabob Integration Notes

**Current State**: Metabob search returned 0 results, indicating:
1. Codebase not yet analyzed by background engine
2. No code quality issues in Metabob database
3. CPG (Code Property Graph) not built for this codebase

**Recommended Next Steps**:
1. Run Metabob analysis on repos/metabob-activity-api
2. Run Metabob analysis on repos/activity-dashboard
3. Re-run searches after analysis completes
4. Use `metabob_mark_problem_complete` after fixing issues
5. Use `metabob_annotate_component` to document design decisions

**Search Queries to Retry**:
- "validation input validation type safety WebSocket execution"
- "error handling exception handling WebSocket authentication"
- "security SQL injection authentication token validation"
- "performance N+1 query inefficient loop broadcast"
- "data integrity transaction rollback consistency"

---

## Documentation Index

- **Entry Points**: ENTRY_POINTS_WebSocket-Real-Time-Dashboard-Updates.md
- **Dependency Chain**: DEPENDENCY_CHAIN_WebSocket-Real-Time-Dashboard-Updates.md
- **Data Transformations**: DATA_TRANSFORMATIONS_WebSocket-Real-Time-Dashboard-Updates.md
- **Architectural Boundaries**: ARCHITECTURAL_BOUNDARIES_WebSocket-Real-Time-Dashboard-Updates.md
- **Code Quality Issues**: CODE_QUALITY_ISSUES_WebSocket-Real-Time-Dashboard-Updates.md (this file)
