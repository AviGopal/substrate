# Discovery Integration Migration Guide

**Status**: NOT IMPLEMENTED

The internal dashboard does not currently integrate with discovery-vessel.

---

## Why Discovery Integration?

Discovery integration provides:

1. **Vessel Registration** - Other vessels can discover this dashboard
2. **Health Reporting** - Centralized health monitoring
3. **Service Discovery** - Dynamic endpoint resolution without hardcoded URLs
4. **Capability Advertisement** - Declare what shapes this vessel handles

---

## Shapes This Vessel Would Advertise

| Shape | Description |
|-------|-------------|
| `internal_dashboard_ui` | Internal admin UI for system observability |
| `admin_operations` | Administrative operations (future) |

---

## Implementation Checklist

### 1. Add Dependency

```bash
cd repos/metabob-internal-dashboard
bun add @metabob/vessel-discovery-client@workspace:*
```

### 2. Configure Environment Variables

Add to `.env` or deployment configuration:

```bash
# Discovery Configuration
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel.activity-system.svc.cluster.local:8080
export VESSEL_ENDPOINT=http://metabob-internal-dashboard.activity-system.svc.cluster.local:3001
export VESSEL_SHAPES=internal_dashboard_ui,admin_operations
export VESSEL_ID=internal-dashboard-${HOSTNAME}
export VESSEL_NAME="Internal Dashboard"
export VESSEL_VERSION="0.1.0"

# Optional: Heartbeat Configuration
export DISCOVERY_HEARTBEAT_INTERVAL_MS=120000  # 2 minutes
export DISCOVERY_RETRY_ATTEMPTS=3
export DISCOVERY_BOOTSTRAP_DELAY_MS=0
```

### 3. Update Server Code

**File**: `src/index.ts`

Add discovery client initialization:

```typescript
import { VesselClient } from '@metabob/vessel-discovery-client';

// Load configuration from environment
const discoveryConfig = {
  vesselId: process.env.VESSEL_ID || `internal-dashboard-${process.env.HOSTNAME}`,
  vesselName: process.env.VESSEL_NAME || 'Internal Dashboard',
  endpoint: process.env.VESSEL_ENDPOINT || `http://localhost:${PORT}`,
  shapes: process.env.VESSEL_SHAPES?.split(',') || ['internal_dashboard_ui', 'admin_operations'],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
  heartbeatIntervalMs: parseInt(process.env.DISCOVERY_HEARTBEAT_INTERVAL_MS || '120000'),
  version: process.env.VESSEL_VERSION || '0.1.0',
};

// Create discovery client (singleton)
let discoveryClient: VesselClient | null = null;

// Start discovery if enabled
if (process.env.DISCOVERY_ENABLED === 'true') {
  discoveryClient = new VesselClient(discoveryConfig);
  await discoveryClient.start();
  console.log(`Discovery client started: ${discoveryConfig.vesselId}`);
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Stop discovery client
  if (discoveryClient) {
    await discoveryClient.stop();
    console.log('Discovery client stopped');
  }

  // Close server
  server.close();
  process.exit(0);
});
```

### 4. Update Health Endpoint

**File**: `src/index.ts`

Enhance health endpoint to include discovery status:

```typescript
// Health endpoint
if (url.pathname === '/health') {
  const activityApiHealthy = minibobConnected;

  const discoveryHealth = discoveryClient
    ? {
        status: discoveryClient.isRegistered() ? 'healthy' : 'unhealthy',
        registered: discoveryClient.isRegistered(),
        lastHeartbeat: discoveryClient.getLastHeartbeat(),
        nextHeartbeat: discoveryClient.getNextHeartbeat(),
      }
    : null;

  const health = {
    service: 'metabob-internal-dashboard',
    version: process.env.VESSEL_VERSION || '0.1.0',
    status: activityApiHealthy && (!discoveryClient || discoveryClient.isRegistered())
      ? 'healthy'
      : 'unhealthy',
    uptime: process.uptime(),
    checks: {
      minibob: {
        status: 'healthy',
        connected: true,
      },
      activityApi: {
        status: activityApiHealthy ? 'healthy' : 'unhealthy',
        endpoint: MINIBOB_API_URL,
      },
      ...(discoveryHealth && { discovery: discoveryHealth }),
    },
  };

  return new Response(JSON.stringify(health, null, 2), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### 5. Update Helm Values

**File**: `helm/charts/metabob-internal-dashboard/values.yaml`

Add discovery configuration:

```yaml
discovery:
  enabled: true
  endpoint: "http://discovery-vessel.activity-system.svc.cluster.local:8080"
  heartbeatInterval: 120000
  ttl: 300000

env:
  - name: DISCOVERY_ENABLED
    value: "true"
  - name: DISCOVERY_VESSEL_ENDPOINT
    value: "{{ .Values.discovery.endpoint }}"
  - name: VESSEL_ENDPOINT
    value: "http://metabob-internal-dashboard.activity-system.svc.cluster.local:3001"
  - name: VESSEL_SHAPES
    value: "internal_dashboard_ui,admin_operations"
  - name: VESSEL_ID
    value: "internal-dashboard-{{ .Values.environment }}"
  - name: VESSEL_NAME
    value: "Internal Dashboard"
  - name: VESSEL_VERSION
    value: "{{ .Values.image.tag }}"
  - name: DISCOVERY_HEARTBEAT_INTERVAL_MS
    value: "{{ .Values.discovery.heartbeatInterval }}"
```

### 6. Test Locally

```bash
# Start discovery-vessel (if not running)
cd repos/discovery-vessel
bun run dev

# Start internal dashboard with discovery enabled
cd repos/metabob-internal-dashboard
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://localhost:8080
export VESSEL_ENDPOINT=http://localhost:3001
export VESSEL_SHAPES=internal_dashboard_ui,admin_operations
bun run dev
```

### 7. Verify Registration

```bash
# Check vessel registered
curl http://localhost:8080/vessels/internal-dashboard-$(hostname)

# Expected response:
{
  "vesselId": "internal-dashboard-hostname",
  "vesselName": "Internal Dashboard",
  "endpoint": "http://localhost:3001",
  "shapes": ["internal_dashboard_ui", "admin_operations"],
  "version": "0.1.0",
  "status": "healthy",
  "lastHeartbeat": "2026-04-14T12:00:00.000Z",
  "registeredAt": "2026-04-14T11:00:00.000Z"
}
```

### 8. Deploy to Kubernetes

```bash
# Build and deploy
cd /home/avi/documents/work/exp-repo/metabob-devbob
./scripts/build-vessels.sh metabob-internal-dashboard

# Deploy via helmfile
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync

# Verify deployment
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-internal-dashboard

# Check discovery registration
kubectl exec -n activity-system deployment/discovery-vessel -- \
  curl http://localhost:8080/vessels/internal-dashboard-metabob-internal-dashboard
```

---

## Benefits After Implementation

1. **Dynamic Service Discovery**
   - Other vessels can discover dashboard endpoint dynamically
   - No hardcoded URLs needed

2. **Centralized Health Monitoring**
   - Discovery-vessel tracks dashboard health
   - Automated alerting on unhealthy state

3. **Capability Advertising**
   - Dashboard declares shapes it handles
   - Other vessels can query for vessels supporting specific shapes

4. **Graceful Degradation**
   - If discovery-vessel unavailable, dashboard continues operating
   - Automatic re-registration when discovery comes back online

---

## Rollback Plan

If discovery integration causes issues:

1. **Disable via environment variable**:
   ```bash
   export DISCOVERY_ENABLED=false
   ```

2. **Remove from Helm values**:
   ```yaml
   discovery:
     enabled: false
   ```

3. **Redeploy**:
   ```bash
   helmfile sync
   ```

Dashboard will operate normally without discovery integration.

---

## Related Documentation

- [STANDARD_CONFIGURATION.md](../../docs/STANDARD_CONFIGURATION.md) - Standard vessel configuration
- [DISCOVERY_INTEGRATION.md](../../docs/DISCOVERY_INTEGRATION.md) - Discovery integration guide
- [@metabob/vessel-discovery-client](../deployment/vessels/user-vessel/packages/vessel-discovery-client/README.md) - Client package docs
- [CLAUDE.md](./CLAUDE.md) - Development guidelines
