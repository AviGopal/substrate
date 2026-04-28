# Specification: User-Vessel Discovery Integration

## Overview

This specification defines how the user-vessel integrates with the discovery-vessel service. User-vessel is an identity and access management vessel that provides multi-tenant RBAC with database-level enforcement, managing organizations, members, API keys, and projects.

---

## ADDED Requirements

### Requirement: Registration with discovery-vessel

User-vessel SHALL register with discovery-vessel on startup.

#### Scenario: Successful registration
- **WHEN** user-vessel starts and `DISCOVERY_VESSEL_URL` is configured
- **THEN** user-vessel sends `POST /register` with:
  - `vesselId`: Unique instance identifier (format: `user-vessel-{instance}`)
  - `vesselName`: "user-vessel"
  - `version`: from package.json
  - `endpoint`: External HTTP endpoint
  - `shapes`: `["user_profile", "org_settings", "api_key_info", "project_list"]`
  - `protocol`: "http"
  - `metadata`: Domain-specific context (see metadata requirement)

#### Scenario: Registration failure is non-fatal
- **WHEN** registration fails
- **THEN** user-vessel logs a warning and continues operation
- **AND** retries on heartbeat interval
- **NOTE** User-vessel MUST remain operational even without discovery registration

---

### Requirement: Metadata is domain-specific and extensible

User-vessel SHALL include domain-specific metadata in registration, but the schema is not prescribed.

#### Scenario: Metadata reflects operational context
- **WHEN** user-vessel registers
- **THEN** registration metadata MAY include any fields meaningful to the deployment
- **EXAMPLE** (auth context): `{ "authMethods": ["email", "apiKey"], "mfaSupported": true }`
- **EXAMPLE** (multi-tenant): `{ "tenantIsolation": "database-level", "rbacEnforcement": "surrealdb-permissions" }`
- **EXAMPLE** (infrastructure): `{ "region": "us-east-1", "replicaSet": "primary" }`

#### Scenario: Security-sensitive metadata exclusion
- **WHEN** user-vessel registers
- **THEN** it SHALL NOT include secrets, keys, or sensitive configuration in metadata
- **EXAMPLE** (DO NOT): `{ "jwtSecret": "...", "dbPassword": "..." }`

---

### Requirement: Heartbeat manager

User-vessel SHALL send periodic heartbeats to maintain its registration.

#### Scenario: Heartbeat at configured interval
- **WHEN** heartbeat interval elapses (default: 120000ms / 2 minutes)
- **THEN** user-vessel sends `POST /heartbeat` with:
  - `vesselId`: The registered vessel ID
  - `metrics`: Optional domain-specific metrics

#### Scenario: Metrics are domain-specific
- **WHEN** user-vessel sends heartbeat metrics
- **THEN** the metrics schema is not prescribed
- **EXAMPLE**: `{ "activeUsers": 150, "apiKeyCount": 342 }` or `{ "authRequests": 5000 }` or no metrics

#### Scenario: Heartbeat failure triggers re-registration
- **WHEN** heartbeat returns 404 Not Found
- **THEN** user-vessel attempts re-registration

---

### Requirement: Graceful shutdown with deregistration

User-vessel SHALL deregister from discovery-vessel when shutting down gracefully.

#### Scenario: SIGTERM triggers deregistration
- **WHEN** user-vessel receives SIGTERM signal
- **THEN** user-vessel sends `DELETE /vessels/{vesselId}` before exiting

#### Scenario: SIGINT triggers deregistration
- **WHEN** user-vessel receives SIGINT signal
- **THEN** same behavior as SIGTERM

#### Scenario: Deregistration timeout
- **WHEN** deregistration request takes longer than 5 seconds
- **THEN** user-vessel proceeds with shutdown (best effort deregistration)

---

### Requirement: Health endpoint includes discovery status

#### Scenario: Health check includes discovery state
- **WHEN** `GET /health` is called
- **THEN** response SHALL include `checks.discovery_vessel` with connectivity status
- **AND** overall status SHALL NOT be affected by discovery connectivity
- **NOTE** User-vessel health is independent of discovery registration

---

### Requirement: Fallback behavior

User-vessel SHALL operate normally even when discovery-vessel is unavailable.

#### Scenario: Operation without discovery
- **WHEN** discovery-vessel is unreachable
- **THEN** user-vessel SHALL continue providing all identity management services
- **AND** log warnings about discovery unavailability

---

## Impulse Shapes

User-vessel resolves four impulse shapes:

### user_profile
User details including email, name, role, and organization membership.

```typescript
{
  type: "user_profile",
  user_id: string  // Format: "users:abc123"
}
```

### org_settings
Organization configuration and billing tier.

```typescript
{
  type: "org_settings",
  org_id: string  // Format: "organizations:xyz789"
}
```

### api_key_info
API key metadata, scopes, and usage limits.

```typescript
{
  type: "api_key_info",
  key_id: string  // Format: "api_keys:key123"
}
```

### project_list
Projects accessible to user or organization.

```typescript
{
  type: "project_list",
  org_id?: string,
  user_id?: string
}
```

---

## Implementation Notes

### Configuration Schema Addition

```typescript
discovery?: {
  endpoint?: string       // Discovery vessel URL
  heartbeatMs?: number    // Override heartbeat interval (default: 120000)
  enabled?: boolean       // Enable/disable discovery (default: true)
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_VESSEL_URL` | (none) | Discovery-vessel endpoint |
| `USER_VESSEL_EXTERNAL_URL` | (none) | User-vessel external URL |

### Critical Files

- `src/discovery-client.ts` - Registration, heartbeat, deregistration logic
- `index.ts` - Integrate discovery into bootstrap, add shutdown handlers
- `src/types.ts` - Update impulse manifest types

### Update Manifest Endpoint

The existing `/manifest` endpoint should be updated to include discovery-compatible metadata:

```typescript
// GET /manifest response
{
  id: "user-vessel",
  name: "User Management Vessel",
  version: "0.1.0",
  shapes: ["user_profile", "org_settings", "api_key_info", "project_list"],
  capabilities: ["user-management", "rbac", "jwt-auth"],
  discoveryRegistered: boolean,  // New field
  lastHeartbeat: string | null   // New field
}
```

---

## Usage with Shared Client

```typescript
import { register, createHealthMiddleware } from "@metabob/vessel-discovery-client"

const client = await register({
  vesselId: `user-vessel-${process.env.INSTANCE_ID}`,
  vesselName: "user-vessel",
  endpoint: process.env.USER_VESSEL_EXTERNAL_URL,
  shapes: ["user_profile", "org_settings", "api_key_info", "project_list"],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_URL,
  // Metadata is domain-specific, not prescribed
  metadata: {
    authMethods: ["email", "apiKey"],
    // whatever is meaningful for your deployment
  }
})

// Health middleware - discovery status doesn't affect overall health
app.get("/health", (c) => {
  const discoveryStatus = client.getHealthStatus()
  return c.json({
    status: "ok",  // Based on core services, not discovery
    checks: {
      discovery_vessel: discoveryStatus,
      database: checkDatabase(),
      // ... other checks
    }
  })
})
```

---

## Relationship with Identity-Vessel

User-vessel and identity-vessel have complementary roles:

| Responsibility | User-Vessel | Identity-Vessel |
|---------------|-------------|-----------------|
| User accounts | ✅ | ❌ |
| API key metadata storage | ✅ | ❌ |
| API key cryptography | ❌ | ✅ |
| JWT validation | ❌ | ✅ |
| Organization management | ✅ | ❌ |
| Project management | ✅ | ❌ |
| Auth resolution impulse | ❌ | ✅ |

Both vessels should be discoverable, but they resolve different impulse shapes for different purposes.
