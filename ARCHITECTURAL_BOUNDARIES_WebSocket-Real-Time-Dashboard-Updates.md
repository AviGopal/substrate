# Architectural Boundaries: WebSocket-Real-Time-Dashboard-Updates

## Overview

This document analyzes all architectural boundaries in the WebSocket real-time dashboard updates system, including repository boundaries, service boundaries, layer boundaries, and data store boundaries.

---

## 1. Repository Boundaries

### Boundary 1.1: metabob-activity-api ↔ activity-dashboard

**Type**: Repository Boundary (Cross-Repo Package Dependency)

**Location**: 
- Source: repos/activity-dashboard (React frontend)
- Target: repos/metabob-activity-api (Bun backend)

**Contract**: 
- **HTTP REST API**: JSON over HTTP
- **WebSocket Protocol**: JSON messages over WebSocket
- **Port**: 8080 (HTTP + WebSocket)

**API Contract (REST)**:
```typescript
// POST /v2/activities/executions
Request: ExecutionRecord {
  variant_id: string,
  success: boolean,
  duration_ms: number,
  cost: number,
  tokens: { input: number, output: number, cache: number },
  error_message?: string,
  error_type?: string,
  failed_task_id?: string,
  impulses_used?: string[],
  component_changes?: string[]
}

Response: ExecutionRecordResponse {
  success: boolean,
  execution_id: string,
  metrics?: TemplateMetrics
}
```

**WebSocket Contract**:
```typescript
// Server → Client Messages
type WebSocketMessage =
  | ExecutionStartedMessage
  | ExecutionCompletedMessage
  | TemplateMetricsUpdatedMessage
  | PodStatusChangedMessage

// Client → Server Messages
type ClientMessage =
  | { type: 'authenticate', token: string }
  | { type: 'ping' }
```

**Type Definitions Shared**:
- ❌ **No shared package**: Types duplicated in both repos
- **metabob-activity-api**: src/websocket/types.ts
- **activity-dashboard**: src/lib/types.ts
- **Risk**: Schema drift if types not synchronized

**Coupling**: **Loose**
- Network boundary (HTTP/WebSocket)
- No direct code dependencies
- Contract-based communication
- Versioned API (/v2/)

**Versioning**:
- API Version: v2 (path prefix /v2/activities/*)
- **Breaking Changes**: Require coordination between repos
- **Backward Compatibility**: Not enforced (no API versioning strategy documented)

**Resilience**:
- **Dashboard → API**: 
  - HTTP: Fetch with try-catch, error responses (400, 500)
  - WebSocket: Auto-reconnect with exponential backoff (max 10 attempts, 5s interval)
- **API → Dashboard**: 
  - WebSocket: Per-client error handling, continues broadcast if one client fails

**Error Handling**:
```typescript
// Dashboard: api-client.ts:296-301
this.ws.onmessage = (event) => {
  try {
    const message: WebSocketMessage = JSON.parse(event.data);
    onMessage(message);
  } catch (error) {
    console.error('[WebSocket] Failed to parse message:', error);
    // Continue, don't crash
  }
};

// Dashboard: useWebSocket.ts:60-76
catch (err) {
  const error = err instanceof Error ? err : new Error('WebSocket connection failed');
  setError(error);
  setConnected(false);
  
  // Attempt reconnect
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectTimeoutRef.current = window.setTimeout(() => {
      setReconnectAttempts((prev) => prev + 1);
      connect();
    }, reconnectInterval);
  }
}
```

**Dependency Analysis**:
- **activity-dashboard** depends on **metabob-activity-api** (runtime)
- No build-time dependencies
- No shared libraries
- Independent deployment cycles

**Compatibility Concerns**:
- ⚠️ **Type Drift Risk**: Duplicated TypeScript types can diverge
- ⚠️ **API Breaking Changes**: No contract testing or API versioning enforcement
- ⚠️ **WebSocket Schema**: No runtime validation on client side (Zod missing)

---

### Boundary 1.2: metabob-activity-api ↔ MiniBob/metabob-cli

**Type**: Repository Boundary (HTTP Client)

**Location**:
- Source: MiniBob pods / metabob-cli
- Target: repos/metabob-activity-api

**Contract**: HTTP REST API (same as 1.1)

**Coupling**: **Loose**
- Network boundary
- MiniBob uses HTTP client to POST execution results
- No shared code

**Resilience**:
- **MiniBob → API**: Retry logic (assumed, not visible in Activity API repo)
- **API Response**: 201 Created on success, 400/500 on error

---

## 2. Service Boundaries

### Boundary 2.1: HTTP Service (REST API)

**Type**: Service Boundary (HTTP API)

**Location**: 
- Entry: repos/metabob-activity-api/src/index.ts (Hono server)
- Handlers: repos/metabob-activity-api/src/routes/activities.ts

**Contract**: REST API with JSON payloads

**API Endpoints**:
```
POST /v2/activities/executions
GET  /v2/activities/templates
GET  /v2/activities/templates/:variant_id
POST /v2/activities/templates
GET  /v2/activities/executions
POST /v2/impulses
GET  /v2/impulses
GET  /health
```

**Authentication**: Bearer token (Base64-encoded Redis session key)

**Middleware Stack**:
1. CORS (hono/cors)
2. Logger (hono/logger)
3. Auth Middleware (authMiddleware)
4. Route Handler

**Coupling**: **Medium**
- Standardized HTTP/JSON protocol
- Bearer token authentication (matches Python RPC API)
- Middleware-based architecture

**Resilience**:
- **Request Validation**: Zod schemas validate input
- **Error Responses**: 400 (validation), 401 (auth), 500 (server error)
- **Logging**: All requests logged
- **CORS**: Configured for cross-origin requests

**Error Handling**:
```typescript
// activities.ts:698-707
catch (error: any) {
  logger.error('POST /v2/activities/executions failed', {
    error: error.message,
    stack: error.stack,
  });
  
  return c.json({
    success: false,
    error: 'Internal server error',
    details: error.message,
  }, 500);
}
```

**Rate Limiting**: ❌ Not implemented

**Versioning**: API v2 (path prefix)

---

### Boundary 2.2: WebSocket Service

**Type**: Service Boundary (WebSocket Protocol)

**Location**:
- Server: repos/metabob-activity-api/src/index.ts (Bun WebSocket handlers)
- Broadcaster: repos/metabob-activity-api/src/websocket/broadcaster.ts
- Client: repos/activity-dashboard/src/lib/api-client.ts

**Contract**: WebSocket JSON messages

**Connection Flow**:
1. Client connects to `ws://host:8080/ws`
2. Server accepts connection, sets `authenticated: false`
3. Client sends `{ type: 'authenticate', token: 'xxx' }`
4. Server validates token (TODO: stub implementation)
5. Server sets `authenticated: true`
6. Server broadcasts events to authenticated clients only

**Message Types** (Server → Client):
```typescript
interface ExecutionStartedMessage {
  type: 'execution_started';
  timestamp: string;
  data: {
    execution_id: string;
    variant_id: string;
    pod_name?: string;
  };
}

interface ExecutionCompletedMessage {
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

interface TemplateMetricsUpdatedMessage {
  type: 'template_updated';
  timestamp: string;
  data: {
    variant_id: string;
    metrics: {
      success_rate: number;
      avg_duration_ms: number;
      avg_cost_usd: number;
      thompson_alpha: number;
      thompson_beta: number;
    };
  };
}
```

**Coupling**: **Loose**
- Pub/Sub pattern (broadcaster → many clients)
- Clients don't directly interact
- Broadcast-only (no peer-to-peer)

**Resilience**:
- **Connection Loss**: Client auto-reconnects (exponential backoff)
- **Broadcast Failures**: Per-client error handling, doesn't stop other clients
- **Message Parse Errors**: Client logs and discards, continues receiving

**Error Handling**:
```typescript
// Server: broadcaster.ts:56-69
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

**Security**:
- ⚠️ **Authentication Stub**: Token validation not implemented (index.ts:194)
- ✅ **Filtering**: Only authenticated clients receive broadcasts
- ❌ **Authorization**: No org_id/project_id filtering on WebSocket events

**Backpressure**: 
```typescript
// index.ts:230-237
drain(ws) {
  logger.debug('[WebSocket] Drain event (backpressure)', {
    authenticated: ws.data?.authenticated,
    sessionId: ws.data?.sessionId,
    clientCount: broadcaster.getClientCount(),
  });
}
```

---

## 3. Layer Boundaries

### Boundary 3.1: Controller → Service Layer

**Type**: Layer Boundary (Request Handler → Business Logic)

**Location**:
- Controller: repos/metabob-activity-api/src/routes/activities.ts (Hono route handlers)
- Service: Inline business logic (no separate service layer)

**Contract**: 
- ❌ **No formal service layer**: Business logic embedded in route handlers
- Controller directly calls database queries

**Architecture Pattern**: **Transaction Script**
- Route handler contains full execution flow
- No separation of concerns
- Database queries inline with business logic

**Coupling**: **Tight**
- No abstraction between HTTP layer and database
- Route handlers directly construct SQL queries
- Difficult to unit test business logic independently

**Example** (activities.ts:604-638):
```typescript
// Transaction Script Pattern
// Controller + Service + Repository all in one function
app.post('/v2/activities/executions', async (c) => {
  // 1. Validation (Controller concern)
  const validated = ExecutionRecordSchema.parse(body);
  
  // 2. Business Logic (Service concern)
  const success_delta = validated.success ? 1 : 0;
  const failure_delta = validated.success ? 0 : 1;
  
  // 3. Database Query (Repository concern)
  const updateMetricsQuery = `
    UPDATE variant_performance_metrics 
    SET total_executions += 1, ...
  `;
  await surrealDB.query(updateMetricsQuery, params);
  
  // 4. Response (Controller concern)
  return c.json(response, 201);
});
```

**Resilience**: N/A (no layer boundary)

**Refactoring Opportunity**:
```typescript
// Recommended: Layered Architecture
// Controller
app.post('/v2/activities/executions', async (c) => {
  const validated = ExecutionRecordSchema.parse(await c.req.json());
  const result = await activityService.recordExecution(validated);
  return c.json(result, 201);
});

// Service Layer
class ActivityService {
  async recordExecution(record: ExecutionRecord): Promise<ExecutionRecordResponse> {
    // Business logic here
    const executionId = await this.repository.saveExecution(record);
    await this.metricsService.updateMetrics(record);
    await this.broadcaster.emitCompletion(record);
    return { success: true, execution_id: executionId };
  }
}

// Repository Layer
class ActivityRepository {
  async saveExecution(record: ExecutionRecord): Promise<string> {
    // Database interaction only
  }
}
```

---

### Boundary 3.2: Service → Repository Layer

**Type**: Layer Boundary (Business Logic → Data Access)

**Location**: N/A

**Status**: ❌ **Not Implemented**
- No repository pattern
- Database queries directly in route handlers
- SurrealDB client used directly

**Recommended Contract**:
```typescript
interface ActivityRepository {
  saveExecution(record: ExecutionRecord): Promise<string>;
  updateMetrics(variantId: string, delta: MetricsDelta): Promise<TemplateMetrics>;
  getTemplate(variantId: string): Promise<ActivityTemplate | null>;
  listTemplates(filters: TemplateFilters): Promise<ActivityTemplate[]>;
}
```

**Coupling**: **Tight** (no abstraction)

**Resilience**: N/A (no layer boundary)

---

### Boundary 3.3: Presentation → State Management (Dashboard)

**Type**: Layer Boundary (React Components → State)

**Location**: 
- Components: repos/activity-dashboard/src/components/*.tsx
- State: React hooks (useState, useEffect)

**Contract**: React props and state hooks

**Architecture Pattern**: **React Component-Based**
- Components manage local state
- Props passed down component tree
- No global state management (Redux, Zustand)

**Coupling**: **Medium**
- Components tightly coupled to state structure
- No state management library (local state only)

**State Boundaries**:
```typescript
// App.tsx (root component)
- Session state (token, user)
- Navigation state (active tab)

// SystemOverview.tsx
- Execution list state
- Metrics state

// ActivityLibrary.tsx
- Template list state
- Selected template state
```

**Resilience**:
- React's built-in error boundaries (not explicitly implemented)
- Component-level error handling

**Missing**: 
- ❌ Global state management
- ❌ State persistence (localStorage, sessionStorage)
- ❌ Optimistic updates

---

## 4. Data Store Boundaries

### Boundary 4.1: Application → SurrealDB

**Type**: Data Store Boundary (Database)

**Location**:
- Client: repos/metabob-activity-api/src/db/surreal.ts
- Database: SurrealDB instance (port 8000)

**Contract**: SurrealDB Query Language (SurrealQL)

**Connection Configuration**:
```typescript
{
  url: process.env.SURREALDB_URL || 'http://localhost:8000/rpc',
  namespace: process.env.SURREALDB_NS || 'metabob',
  database: process.env.SURREALDB_DB || 'activity_system',
  username: process.env.SURREALDB_USER || 'root',
  password: process.env.SURREALDB_PASS || 'root'
}
```

**Tables**:
1. `activity_template` - Template definitions
2. `variant_performance_metrics` - Thompson Sampling metrics
3. `activity_executions` - Execution history
4. `impulses` - Impulse data

**Query Examples**:
```sql
-- Insert execution
INSERT INTO activity_executions {
  execution_id: $execution_id,
  variant_id: $variant_id,
  success: $success,
  duration_ms: $duration_ms,
  cost_usd: $cost,
  tokens_input: $tokens_input,
  tokens_output: $tokens_output,
  tokens_cache: $tokens_cache,
  executed_at: time::now(),
  created_at: time::now()
}

-- Update metrics (atomic)
UPDATE variant_performance_metrics 
SET 
  total_executions += 1,
  successful_executions += $success_delta,
  failed_executions += $failure_delta,
  success_rate = successful_executions / total_executions,
  avg_duration_ms = ((avg_duration_ms * (total_executions - 1)) + $duration_ms) / total_executions,
  thompson_alpha = successful_executions + 1,
  thompson_beta = failed_executions + 1
WHERE variant_id = $variant_id
RETURN AFTER;
```

**Coupling**: **Medium**
- SurrealDB-specific query language
- Atomic operators (`+=`) specific to SurrealDB
- Migration to another database requires query rewrite

**Resilience**:
- **Connection Pooling**: Singleton client with reconnect logic
- **Error Handling**: Try-catch around all queries
- **Logging**: All queries logged with duration

**Connection Resilience**:
```typescript
// surreal.ts:14-53
async connect(): Promise<void> {
  if (this.db) {
    return; // Already connected
  }

  if (this.connecting) {
    return this.connecting; // Connection in progress
  }

  this.connecting = (async () => {
    try {
      logger.info('Connecting to SurrealDB', { url: config.surrealdb.url });
      
      this.db = new Surreal();
      await this.db.connect(config.surrealdb.url);
      await this.db.signin({
        username: config.surrealdb.username,
        password: config.surrealdb.password,
      });
      await this.db.use({
        namespace: config.surrealdb.namespace,
        database: config.surrealdb.database,
      });
      
      logger.info('Connected to SurrealDB successfully');
    } catch (error: any) {
      logger.error('Failed to connect to SurrealDB', { error: error.message });
      this.db = null;
      throw error;
    } finally {
      this.connecting = null;
    }
  })();

  return this.connecting;
}
```

**Transaction Support**: ❌ Not used (SurrealDB supports BEGIN/COMMIT, but not used in code)

**Migration Strategy**: ❌ Not documented (no schema versioning)

**Backup/Recovery**: ❌ Not implemented in application (relies on SurrealDB features)

---

### Boundary 4.2: Application → Redis

**Type**: Data Store Boundary (Cache + Session Store)

**Location**:
- Client: repos/metabob-activity-api/src/db/redis.ts
- Database: Redis instance (port 6379)

**Contract**: Redis commands (GET, SET, DEL, HGET, EXPIRE, SREM)

**Connection Configuration**:
```typescript
{
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
}
```

**Use Cases**:
1. **Session Storage**: `sessions.{session_id}` (hash)
2. **Template Cache**: `activity:template:{variant_id}` (string, TTL 1hr)
3. **Template List Cache**: `activity:templates:list` (set, TTL 1hr)

**Cache Operations**:
```typescript
// Read-through cache pattern
const cached = await redis.get(`activity:template:${variant_id}`);
if (cached) {
  return JSON.parse(cached);
}

const template = await surrealDB.query('SELECT * FROM activity_template WHERE variant_id = $id');
await redis.setex(`activity:template:${variant_id}`, 3600, JSON.stringify(template));
return template;

// Cache invalidation
await redis.del(`activity:template:${variant_id}`);
await redis.srem('activity:templates:list', variant_id);
```

**Coupling**: **Medium**
- Redis-specific commands
- ioredis library (npm package)
- Migration requires client library change

**Resilience**:
- **Connection Pooling**: Singleton client
- **Retry Strategy**: Exponential backoff (50ms * attempt, max 2s)
- **Error Handling**: Try-catch around all operations
- **Fallback**: Cache miss triggers database query (cache-aside pattern)

**Error Handling**:
```typescript
// redis.ts (example pattern)
try {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
} catch (error) {
  logger.warn('Redis GET failed, falling back to database', { error });
  // Fall through to database query
}
```

**Session Management**:
```typescript
// Auth middleware: middleware/auth.ts:38-78
const sessionKey = Buffer.from(token, 'base64').toString('utf-8');
const sessionDataRaw = await redis.hget(sessionKey, 'data');

if (!sessionDataRaw) {
  logger.warn(`Session not found for key: ${sessionKey}`);
  c.set('session', null);
  return;
}

const sessionData = SessionDataSchema.parse(JSON.parse(sessionDataRaw));

// Extend session TTL on every access
await redis.expire(sessionKey, sessionTTL);
```

**Eviction Policy**: ❌ Not configured (defaults to Redis noeviction)

**Persistence**: ❌ Not configured (relies on Redis AOF/RDB)

---

### Boundary 4.3: Application → File System (Logs)

**Type**: Data Store Boundary (File I/O)

**Location**:
- Logger: repos/metabob-activity-api/src/utils/logger.ts
- Output: Console (stdout/stderr) + optionally files

**Contract**: Logging interface

**Log Levels**: debug, info, warn, error

**Log Format**: JSON structured logs
```json
{
  "level": "info",
  "timestamp": "2026-03-19T12:34:56.789Z",
  "message": "Execution recorded in activity_executions",
  "context": {
    "executionId": "exec_1710850496789_a1b2c3d4e5",
    "variantId": "add-rest-endpoint"
  }
}
```

**Coupling**: **Loose**
- Abstracted via logger utility
- Swappable logging backend (Winston, Pino, Bunyan)

**Resilience**:
- **Non-blocking**: Logging doesn't block application flow
- **Error Handling**: Logger errors don't crash application

---

## 5. Cross-Cutting Concerns

### Boundary 5.1: Authentication

**Type**: Cross-Cutting Concern (Security)

**Location**:
- Middleware: repos/metabob-activity-api/src/middleware/auth.ts
- WebSocket: repos/metabob-activity-api/src/index.ts (authentication handler)

**Contract**: Bearer token authentication

**HTTP Authentication Flow**:
1. Client sends `Authorization: Bearer {base64_token}`
2. Middleware decodes Base64 → Redis key
3. Fetch session data from Redis: `HGET sessions.{session_id} data`
4. Parse and validate session JSON
5. Extend session TTL
6. Attach session to request context

**WebSocket Authentication Flow**:
1. Client connects (unauthenticated)
2. Client sends `{ type: 'authenticate', token: 'xxx' }`
3. Server validates token (⚠️ stub implementation)
4. Server sets `ws.data.authenticated = true`
5. Server broadcasts events only to authenticated clients

**Security Concerns**:
- ⚠️ **WebSocket Stub**: Token validation not implemented (index.ts:194)
  ```typescript
  // TODO: Validate token against Redis or JWT verification
  ws.data.authenticated = true;  // ⚠️ ACCEPTS ALL TOKENS
  ```
- ✅ **HTTP Auth**: Full implementation with Redis session validation
- ❌ **HTTPS/WSS**: Not enforced (production concern)
- ❌ **Rate Limiting**: Not implemented

**Session Schema**:
```typescript
interface SessionData {
  session_id: string;
  org_id?: string;
  project_id?: string;
  user_id?: string;
  permissions?: string[];
  created_at?: string;
  expires_at?: string;
}
```

**Coupling**: **Medium**
- HTTP: Hono middleware (framework-specific)
- WebSocket: Bun WebSocket API (runtime-specific)
- Redis: Session storage (data store dependency)

**Resilience**:
- **Missing Session**: Continue without auth (optional auth)
- **Invalid Session**: 401 Unauthorized
- **Expired Session**: Session not found in Redis

---

### Boundary 5.2: Logging

**Type**: Cross-Cutting Concern (Observability)

**Location**: repos/metabob-activity-api/src/utils/logger.ts

**Contract**: Logging interface
```typescript
interface Logger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}
```

**Implementation**: Console-based (stdout/stderr)

**Coupling**: **Loose**
- Abstracted via logger utility
- All components import logger, not direct console

**Resilience**: Non-blocking, errors don't crash app

---

### Boundary 5.3: Configuration

**Type**: Cross-Cutting Concern (Environment)

**Location**: repos/metabob-activity-api/src/config.ts

**Contract**: Centralized configuration object

**Configuration Sources**:
1. Environment variables (process.env)
2. Default values (fallback)

**Config Schema**:
```typescript
interface Config {
  port: number;
  surrealdb: {
    url: string;
    namespace: string;
    database: string;
    username: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  cors: {
    origin: string | string[];
  };
}
```

**Coupling**: **Loose**
- All components import config, not direct process.env
- Centralized validation

**Resilience**:
- Default values for all settings
- Validation at startup (app crashes if invalid config)

---

## 6. Summary of Coupling & Resilience

### Coupling Analysis

| Boundary Type | Coupling Level | Reason |
|---------------|----------------|--------|
| Repository (API ↔ Dashboard) | **Loose** | Network boundary, contract-based |
| HTTP Service | **Medium** | Standardized protocol, framework-specific middleware |
| WebSocket Service | **Loose** | Pub/Sub pattern, no peer-to-peer |
| Controller → Service | **Tight** | ❌ No service layer, inline business logic |
| Service → Repository | **Tight** | ❌ No repository pattern, direct DB queries |
| Application → SurrealDB | **Medium** | SurrealDB-specific query language |
| Application → Redis | **Medium** | Redis-specific commands, ioredis library |
| Authentication | **Medium** | Framework/runtime-specific implementations |
| Logging | **Loose** | Abstracted via logger utility |
| Configuration | **Loose** | Centralized config object |

### Resilience Patterns

| Boundary | Pattern | Implementation |
|----------|---------|----------------|
| Repository (Dashboard → API) | **Auto-Reconnect** | Exponential backoff, max 10 attempts |
| HTTP Service | **Input Validation** | Zod schemas, 400 errors |
| HTTP Service | **Error Logging** | All errors logged with context |
| WebSocket Service | **Broadcast Isolation** | Per-client error handling |
| WebSocket Service | **Backpressure** | Bun drain handler |
| SurrealDB | **Connection Retry** | Singleton with reconnect logic |
| Redis | **Cache Fallback** | Cache miss → database query |
| Redis | **Retry Strategy** | Exponential backoff (50ms * attempt) |
| Authentication | **Optional Auth** | Continue without session if missing |

### Missing Resilience Patterns

| Boundary | Missing Pattern | Impact |
|----------|----------------|--------|
| Repository (API ↔ Dashboard) | **Contract Testing** | Schema drift risk |
| Repository (API ↔ Dashboard) | **API Versioning** | Breaking change risk |
| HTTP Service | **Rate Limiting** | DoS vulnerability |
| WebSocket Service | **Token Validation** | Security vulnerability |
| Controller → Service | **Service Layer** | Difficult unit testing |
| Service → Repository | **Repository Pattern** | Tight database coupling |
| SurrealDB | **Transaction Support** | Data inconsistency risk |
| SurrealDB | **Schema Versioning** | Migration issues |
| Redis | **Eviction Policy** | Cache exhaustion risk |
| All Boundaries | **Circuit Breaker** | Cascade failure risk |
| All Boundaries | **Distributed Tracing** | Hard to debug issues |

---

## 7. Architectural Recommendations

### 7.1 Introduce Service Layer

**Current**:
```
HTTP Request → Route Handler (Controller + Service + Repository)
```

**Recommended**:
```
HTTP Request → Controller → Service → Repository → Database
```

**Benefits**:
- Testable business logic
- Reusable across different controllers
- Clear separation of concerns

### 7.2 Implement Repository Pattern

**Current**:
```typescript
// Direct SurrealDB queries in route handlers
await surrealDB.query('UPDATE variant_performance_metrics SET ...');
```

**Recommended**:
```typescript
// Repository abstraction
interface ActivityRepository {
  saveExecution(record: ExecutionRecord): Promise<string>;
  updateMetrics(variantId: string, delta: MetricsDelta): Promise<TemplateMetrics>;
}

// Implementation can be swapped (SurrealDB, PostgreSQL, etc.)
class SurrealDBActivityRepository implements ActivityRepository {
  async saveExecution(record: ExecutionRecord): Promise<string> {
    // SurrealDB-specific implementation
  }
}
```

**Benefits**:
- Database-agnostic business logic
- Easier unit testing (mock repository)
- Swappable data stores

### 7.3 Add Contract Testing

**Current**: No contract validation between API and Dashboard

**Recommended**:
- Generate OpenAPI spec from code
- Use Pact or similar contract testing tool
- Validate API responses match TypeScript types

**Benefits**:
- Catch breaking changes early
- Ensure type consistency across repos
- Automated compatibility checks

### 7.4 Implement WebSocket Token Validation

**Current**: Stub implementation (index.ts:194)
```typescript
// TODO: Validate token against Redis or JWT verification
ws.data.authenticated = true;
```

**Recommended**:
```typescript
// Validate token against Redis session store
const sessionKey = Buffer.from(data.token, 'base64').toString('utf-8');
const sessionDataRaw = await redis.hget(sessionKey, 'data');

if (!sessionDataRaw) {
  ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
  ws.close();
  return;
}

ws.data.authenticated = true;
ws.data.sessionId = sessionData.session_id;
```

**Benefits**:
- Security: Only authenticated clients receive events
- Multi-tenancy: Filter events by org_id

### 7.5 Add Circuit Breaker Pattern

**Current**: No circuit breaker, failures cascade

**Recommended**:
```typescript
import { CircuitBreaker } from 'opossum';

const dbCircuit = new CircuitBreaker(surrealDB.query, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

dbCircuit.fallback(() => {
  logger.warn('Circuit breaker open, using fallback');
  return { error: 'Service temporarily unavailable' };
});
```

**Benefits**:
- Prevent cascade failures
- Fast failure detection
- Automatic recovery

---

## 8. Compatibility Matrix

### API Version Compatibility

| Dashboard Version | API Version | Compatible? | Notes |
|-------------------|-------------|-------------|-------|
| 1.0.0 | v2 | ✅ Yes | Initial release |
| Future | v3 | ❓ Unknown | No versioning strategy |

### Database Schema Compatibility

| Application Version | SurrealDB Schema | Compatible? | Migration Path |
|---------------------|------------------|-------------|----------------|
| 1.0.0 | Initial schema | ✅ Yes | N/A |
| Future | Updated schema | ❓ Unknown | ❌ No migration tooling |

### WebSocket Protocol Compatibility

| Client Version | Server Version | Compatible? | Notes |
|----------------|----------------|-------------|-------|
| 1.0.0 | 1.0.0 | ✅ Yes | Identical message types |
| 1.0.0 | Future | ❓ Unknown | No versioning in messages |

---

## Documentation Index

- **Entry Points**: ENTRY_POINTS_WebSocket-Real-Time-Dashboard-Updates.md
- **Dependency Chain**: DEPENDENCY_CHAIN_WebSocket-Real-Time-Dashboard-Updates.md
- **Data Transformations**: DATA_TRANSFORMATIONS_WebSocket-Real-Time-Dashboard-Updates.md
- **Architectural Boundaries**: ARCHITECTURAL_BOUNDARIES_WebSocket-Real-Time-Dashboard-Updates.md (this file)
