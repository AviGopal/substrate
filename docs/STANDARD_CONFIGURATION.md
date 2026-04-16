# Standard Vessel Configuration Reference

This document defines the standard configuration parameters for all Metabob vessels.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [Discovery Integration](#discovery-integration)
- [Authentication](#authentication)
- [Observability](#observability)
- [Deployment](#deployment)

## Environment Variables

All vessels should support these standard environment variables:

### Core Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PORT` | number | No | `8080` | HTTP server port |
| `HOST` | string | No | `0.0.0.0` | Bind address |
| `NODE_ENV` | string | No | `development` | Environment (development/production) |
| `LOG_LEVEL` | string | No | `info` | Logging level (debug/info/warn/error) |
| `VESSEL_ID` | string | No | `{vessel}-{hostname}` | Unique vessel identifier |
| `VESSEL_NAME` | string | No | `{package.name}` | Human-readable vessel name |
| `VESSEL_VERSION` | string | No | `{package.version}` | Vessel version |

### Discovery Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DISCOVERY_ENABLED` | boolean | No | `false` | Enable discovery integration |
| `DISCOVERY_VESSEL_ENDPOINT` | string | Conditional | - | Discovery service URL (required if enabled) |
| `VESSEL_ENDPOINT` | string | Conditional | `http://{host}:{port}` | This vessel's endpoint (required if discovery enabled) |
| `VESSEL_SHAPES` | string | Conditional | - | Comma-separated shapes (required if discovery enabled) |
| `DISCOVERY_HEARTBEAT_INTERVAL_MS` | number | No | `120000` | Heartbeat interval (2 minutes) |
| `DISCOVERY_RETRY_ATTEMPTS` | number | No | `3` | Max retry attempts |
| `DISCOVERY_BOOTSTRAP_DELAY_MS` | number | No | `0` | Delay before first registration |

**Example**:
```bash
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel.activity-system.svc.cluster.local:8080
export VESSEL_ENDPOINT=http://my-vessel.activity-system.svc.cluster.local:8080
export VESSEL_SHAPES=shape1,shape2,shape3
```

### Database Configuration (SurrealDB)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SURREALDB_URL` | string | Yes | - | SurrealDB connection URL |
| `SURREALDB_NAMESPACE` | string | Yes | - | Database namespace |
| `SURREALDB_DATABASE` | string | Yes | - | Database name |
| `SURREALDB_USERNAME` | string | Yes | - | Auth username |
| `SURREALDB_PASSWORD` | string | Yes | - | Auth password |

**Example**:
```bash
export SURREALDB_URL=http://surrealdb.activity-system.svc.cluster.local:8000/rpc
export SURREALDB_NAMESPACE=activity-system
export SURREALDB_DATABASE=learning_loop
export SURREALDB_USERNAME=root
export SURREALDB_PASSWORD=your-password
```

### Cache Configuration (Redis)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REDIS_URL` | string | No | - | Redis connection string |
| `REDIS_TTL_SECONDS` | number | No | `3600` | Default cache TTL |

**Example**:
```bash
export REDIS_URL=redis://redis.activity-system.svc.cluster.local:6379
export REDIS_TTL_SECONDS=3600
```

### Authentication Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `API_KEY_ENABLED` | boolean | No | `true` | Enable API key auth |
| `JWT_ENABLED` | boolean | No | `true` | Enable JWT auth |
| `IDENTITY_VESSEL_ENDPOINT` | string | Conditional | - | Identity service URL (required if auth enabled) |

**Example**:
```bash
export API_KEY_ENABLED=true
export JWT_ENABLED=true
export IDENTITY_VESSEL_ENDPOINT=http://identity-vessel.activity-system.svc.cluster.local:8080
```

### Observability Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `METRICS_ENABLED` | boolean | No | `true` | Enable metrics collection |
| `TRACING_ENABLED` | boolean | No | `true` | Enable distributed tracing |
| `OTEL_EXPORTER_ENDPOINT` | string | No | - | OpenTelemetry exporter endpoint |

**Example**:
```bash
export METRICS_ENABLED=true
export TRACING_ENABLED=true
export OTEL_EXPORTER_ENDPOINT=http://otel-collector:4318
```

## Configuration Files

### Project Configuration (`.metabob/config.json`)

Per-project configuration stored in project root:

```json
{
  "discovery": {
    "enabled": true,
    "endpoint": "http://discovery-vessel.activity-system.svc.cluster.local:8080",
    "shapes": ["shape1", "shape2"],
    "heartbeatInterval": 120000
  },
  "database": {
    "url": "http://surrealdb:8000/rpc",
    "namespace": "activity-system",
    "database": "learning_loop"
  },
  "observability": {
    "metricsEnabled": true,
    "tracingEnabled": true
  }
}
```

### User Configuration (`~/.metabob/config.json`)

Global user-level configuration:

```json
{
  "metabob": {
    "apiKey": "your-metabob-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

### Configuration Priority

Configuration is loaded in order (highest to lowest priority):

1. **Environment variables** (e.g., `DISCOVERY_ENABLED`)
2. **Project config** (`.metabob/config.json` in project root)
3. **User config** (`~/.metabob/config.json`)
4. **Defaults** (hardcoded in vessel)

## Discovery Integration

### Required Configuration

To enable discovery integration, vessels must configure:

```bash
# Enable discovery
export DISCOVERY_ENABLED=true

# Discovery service endpoint
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel:8080

# This vessel's endpoint (must be reachable by other vessels)
export VESSEL_ENDPOINT=http://my-vessel:8080

# Shapes this vessel can resolve (comma-separated)
export VESSEL_SHAPES=shape1,shape2,shape3

# Optional: Vessel identity
export VESSEL_ID=my-vessel-${HOSTNAME}
export VESSEL_NAME="My Vessel"
export VESSEL_VERSION="1.0.0"
```

### Helm Values Configuration

For Kubernetes deployment, discovery is configured in Helm values:

```yaml
# environments/production.values.yaml
discovery:
  enabled: true
  endpoint: "http://discovery-vessel.activity-system.svc.cluster.local:8080"
  heartbeatInterval: 120000
  ttl: 300000

vessels:
  myVessel:
    image:
      repository: metabobapp/my-vessel
      tag: latest
    shapes:
      - shape1
      - shape2
    discovery:
      enabled: true
    env:
      - name: DISCOVERY_ENABLED
        value: "true"
      - name: DISCOVERY_VESSEL_ENDPOINT
        value: "http://discovery-vessel:8080"
      - name: VESSEL_ENDPOINT
        value: "http://my-vessel:8080"
      - name: VESSEL_SHAPES
        value: "shape1,shape2"
```

### Discovery Client Code

Standard pattern for discovery integration:

```typescript
import { VesselClient } from '@metabob/vessel-discovery-client';

// Load from environment
const config = {
  vesselId: process.env.VESSEL_ID || `${process.env.VESSEL_NAME}-${process.env.HOSTNAME}`,
  vesselName: process.env.VESSEL_NAME,
  endpoint: process.env.VESSEL_ENDPOINT,
  shapes: process.env.VESSEL_SHAPES?.split(',') || [],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
  heartbeatIntervalMs: parseInt(process.env.DISCOVERY_HEARTBEAT_INTERVAL_MS || '120000'),
  version: process.env.VESSEL_VERSION || '0.0.0',
};

// Create client (singleton)
export const discoveryClient = new VesselClient(config);

// Start on server startup
if (process.env.DISCOVERY_ENABLED === 'true') {
  await discoveryClient.start();
}

// Shutdown handler
process.on('SIGTERM', async () => {
  if (process.env.DISCOVERY_ENABLED === 'true') {
    await discoveryClient.stop();
  }
  process.exit(0);
});
```

## Authentication

### API Key Authentication

Vessels that require authentication should accept API keys via:

**Header format**:
```
Authorization: ApiKey <key>
```

**Validation flow**:
```typescript
async function validateApiKey(key: string): Promise<{ org_id: string; user_id: string }> {
  // 1. Try identity-vessel validation (primary)
  try {
    const response = await fetch(`${IDENTITY_VESSEL_ENDPOINT}/validate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // Fall through to database validation
  }

  // 2. Fallback to direct database validation
  const result = await db.query(`SELECT * FROM api_key WHERE key = $key`, { key });
  if (result.length === 0) {
    throw new Error('Invalid API key');
  }
  return result[0];
}
```

### JWT Authentication

Vessels that use JWT tokens should validate via:

```typescript
async function validateJWT(token: string): Promise<JWTPayload> {
  const response = await fetch(`${IDENTITY_VESSEL_ENDPOINT}/validate-jwt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Invalid JWT token');
  }

  return await response.json();
}
```

## Observability

### Health Endpoint

All vessels must implement a `/health` endpoint:

**Response format**:
```json
{
  "service": "my-vessel",
  "version": "1.0.0",
  "status": "healthy",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 10
    },
    "redis": {
      "status": "healthy",
      "latency_ms": 5
    },
    "discovery": {
      "status": "healthy",
      "registered": true,
      "lastHeartbeat": "2026-04-14T12:00:00.000Z",
      "nextHeartbeat": "2026-04-14T12:02:00.000Z"
    }
  }
}
```

**Status codes**:
- `200 OK`: All checks healthy
- `503 Service Unavailable`: One or more checks unhealthy

### Metrics

Standard metrics all vessels should emit:

| Metric | Type | Description |
|--------|------|-------------|
| `http.requests.total` | Counter | Total HTTP requests |
| `http.requests.duration_ms` | Histogram | Request duration |
| `http.requests.errors` | Counter | Failed requests |
| `vessel.registration.success` | Counter | Discovery registrations |
| `vessel.heartbeat.success` | Counter | Discovery heartbeats |
| `vessel.discovery.queries` | Counter | Discovery queries |
| `database.queries.total` | Counter | Database queries |
| `database.queries.duration_ms` | Histogram | Query duration |

### Logging

Standard log levels and format:

```typescript
logger.debug('Detailed debugging information', { context: {...} });
logger.info('Normal operational messages', { context: {...} });
logger.warn('Warning conditions', { context: {...} });
logger.error('Error conditions', { error: {...}, context: {...} });
```

**Log format** (JSON):
```json
{
  "timestamp": "2026-04-14T12:00:00.000Z",
  "level": "info",
  "service": "my-vessel",
  "version": "1.0.0",
  "message": "Server started",
  "context": {
    "port": 8080,
    "discoveryEnabled": true
  }
}
```

## Deployment

### Kubernetes Labels

Standard labels for all vessel deployments:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: my-vessel
    app.kubernetes.io/version: 1.0.0
    app.kubernetes.io/component: vessel
    app.kubernetes.io/part-of: metabob-activity-system
    app.kubernetes.io/managed-by: helm
    environment: production
```

### Resource Limits

Standard resource requests/limits:

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

**Adjust based on vessel type**:
- **Lightweight vessels** (discovery, identity): 128Mi/512Mi
- **Medium vessels** (activity-api, analysis-api): 256Mi/1Gi
- **Heavy vessels** (minibob, terminal): 512Mi/2Gi

### Liveness and Readiness Probes

Standard probe configuration:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Graceful Shutdown

Standard termination grace period:

```yaml
spec:
  terminationGracePeriodSeconds: 30
```

Vessels must handle SIGTERM:

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // 1. Stop accepting new requests
  server.close();

  // 2. Deregister from discovery
  if (discoveryClient) {
    await discoveryClient.stop();
  }

  // 3. Close database connections
  await db.close();

  // 4. Exit
  process.exit(0);
});
```

## Example: Complete Vessel Configuration

```typescript
// src/config.ts
export const config = {
  // Core
  port: parseInt(process.env.PORT || '8080'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Discovery
  discovery: {
    enabled: process.env.DISCOVERY_ENABLED === 'true',
    endpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
    vesselId: process.env.VESSEL_ID || `my-vessel-${process.env.HOSTNAME}`,
    vesselName: process.env.VESSEL_NAME || 'My Vessel',
    vesselVersion: process.env.VESSEL_VERSION || '0.0.0',
    vesselEndpoint: process.env.VESSEL_ENDPOINT || `http://localhost:${process.env.PORT || 8080}`,
    shapes: process.env.VESSEL_SHAPES?.split(',') || [],
    heartbeatInterval: parseInt(process.env.DISCOVERY_HEARTBEAT_INTERVAL_MS || '120000'),
    retryAttempts: parseInt(process.env.DISCOVERY_RETRY_ATTEMPTS || '3'),
    bootstrapDelay: parseInt(process.env.DISCOVERY_BOOTSTRAP_DELAY_MS || '0'),
  },

  // Database
  database: {
    url: process.env.SURREALDB_URL!,
    namespace: process.env.SURREALDB_NAMESPACE!,
    database: process.env.SURREALDB_DATABASE!,
    username: process.env.SURREALDB_USERNAME!,
    password: process.env.SURREALDB_PASSWORD!,
  },

  // Cache
  redis: {
    url: process.env.REDIS_URL,
    ttl: parseInt(process.env.REDIS_TTL_SECONDS || '3600'),
  },

  // Auth
  auth: {
    apiKeyEnabled: process.env.API_KEY_ENABLED !== 'false',
    jwtEnabled: process.env.JWT_ENABLED !== 'false',
    identityEndpoint: process.env.IDENTITY_VESSEL_ENDPOINT,
  },

  // Observability
  observability: {
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
    tracingEnabled: process.env.TRACING_ENABLED !== 'false',
    otelEndpoint: process.env.OTEL_EXPORTER_ENDPOINT,
  },
};
```

## Related Documentation

- [DISCOVERY_INTEGRATION.md](../DISCOVERY_INTEGRATION.md) - Discovery integration guide
- [DEPLOYMENT_WORKFLOW.md](../repos/deployment/DEPLOYMENT_WORKFLOW.md) - Deployment procedures
- [@metabob/vessel-discovery-client README](../repos/deployment/vessels/user-vessel/packages/vessel-discovery-client/README.md) - Client package docs
