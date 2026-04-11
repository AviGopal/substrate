# MiniBob Discovery-Vessel Integration Summary

## Overview

Successfully integrated discovery-vessel registration into MiniBob, enabling dynamic vessel discovery and resolution across the network.

## Changes Made

### 1. Configuration Schema Updates (`src/types.ts`)

Extended `MinibobConfig` with discovery configuration:

```typescript
discovery?: {
  enabled: boolean
  endpoint?: string
  vesselId?: string
  shapes?: string[]
  heartbeatInterval?: number
}
```

### 2. Package Dependencies (`package.json`)

Added dependency:

```json
"@metabob/vessel-discovery-client": "file:../../packages/vessel-discovery-client"
```

### 3. Configuration Resolution (`src/config.ts`)

- Added `resolveDiscovery()` function with priority chain:
  - Environment variables (highest priority)
  - Project config (`.metabob/config.json`)
  - User config (`~/.metabob/config.json`)
  - Defaults
- Default shapes: `["memo", "file", "directoryTree", "gitDiff"]`
- Default heartbeat interval: 120000ms (2 minutes)
- Default vesselId: `minibob-${hostname()}`

**Environment Variables:**
- `MINIBOB_DISCOVERY_ENABLED`
- `MINIBOB_DISCOVERY_ENDPOINT`
- `MINIBOB_VESSEL_ID`
- `MINIBOB_HEARTBEAT_INTERVAL`

### 4. Vessel Discovery Client Enhancement (`src/vessel-discovery.ts`)

Added registration functionality using `VesselClient` from vessel-discovery-client:

**New Methods:**
- `register(config)` - Register vessel with discovery service
- `getRegistrationStatus()` - Get current registration state
- `shutdown()` - Deregister and stop heartbeat

**Registration Flow:**
1. Build full config with defaults
2. Create VesselClient instance
3. Register with discovery service
4. Start heartbeat loop
5. Return success status

### 5. Startup Integration (`index.ts`)

Added registration on startup (before waking activities):

```typescript
if (config.discovery?.enabled) {
  const discoveryClient = initializeVesselDiscovery(config.discovery.endpoint)
  await discoveryClient.register({
    vesselId: config.discovery.vesselId,
    vesselName: "minibob",
    endpoint: `http://${config.host}:${config.port}`,
    shapes: config.discovery.shapes,
    discoveryEndpoint: config.discovery.endpoint,
    heartbeatIntervalMs: config.discovery.heartbeatInterval,
    authToken: config.instance?.apiKey,
    authType: "ApiKey",
  })
}
```

### 6. Status Command Update (`src/repl.ts`)

Enhanced `/status` command to show discovery state:

```
Discovery Vessel:
  Status:       Registered
  Vessel ID:    minibob-hostname
  Shapes:       memo, file, directoryTree, gitDiff
  Last HB:      2026-04-11T16:30:45.123Z
  Failures:     0
```

### 7. Health Endpoint Enhancement (`index.ts`)

Updated `/health` endpoint to include discovery status:

```json
{
  "status": "ok",
  "vessel": "minibob",
  "wsClients": 0,
  "discovery": {
    "registered": true,
    "vesselId": "minibob-hostname",
    "shapes": ["memo", "file", "directoryTree", "gitDiff"],
    "lastHeartbeat": "2026-04-11T16:30:45.123Z",
    "consecutiveFailures": 0
  }
}
```

### 8. Integration Tests (`test/vessel-discovery-integration.test.ts`)

Created comprehensive test suite:

- **Registration tests**: Configuration, status tracking, cache management
- **Resolution tests**: Local impulse types (memo, file, directoryTree)
- **Discovery tests**: Shape inference, vessel selection

**Test Results:** 10 pass, 0 fail

## Acceptance Criteria

✅ Config schema includes discovery settings
✅ Registration works on startup (when enabled)
✅ Resolution queries discovery for unknown shapes
✅ Status command shows discovery state
✅ Tests pass
✅ Type checking passes

## Usage

### Enable Discovery in Project Config

`.metabob/config.json`:

```json
{
  "discovery": {
    "enabled": true,
    "endpoint": "https://activity.metabob.com",
    "vesselId": "minibob-dev-1",
    "shapes": ["memo", "file", "directoryTree", "gitDiff"],
    "heartbeatInterval": 120000
  }
}
```

### Check Discovery Status

```bash
# In REPL mode
minibob
> /status

# Via HTTP
curl http://localhost:8080/health | jq .discovery
```

### Environment Variables

```bash
export MINIBOB_DISCOVERY_ENABLED=true
export MINIBOB_DISCOVERY_ENDPOINT=https://activity.metabob.com
export MINIBOB_VESSEL_ID=minibob-production-1
export MINIBOB_HEARTBEAT_INTERVAL=120000

minibob --daemon
```

## Architecture

### Registration Flow

```
MiniBob Startup
    ↓
Config Loading (discovery settings)
    ↓
VesselDiscoveryClient.register()
    ↓
VesselClient (from vessel-discovery-client)
    ↓
POST /register to discovery service
    ↓
Start Heartbeat Loop (POST /heartbeat every 2 min)
    ↓
MiniBob Running (registered)
```

### Resolution Flow

```
Impulse.load(id)
    ↓
resolvePointer(pointer)
    ↓
Local Type? → Resolve directly (memo, file, etc.)
    ↓ No
Custom Resolver? → Use registered resolver
    ↓ No
Vessel Discovery → Query discovery for capable vessels
    ↓
Resolve via discovered vessel (HTTP POST /mcp/tools/call)
    ↓
Cache resolver for future use
```

## Integration Points

The discovery-vessel integration connects with:

1. **Activity API**: Discovery endpoint for registration/heartbeat
2. **MCP Protocol**: Tool calling interface for resolution
3. **Impulse System**: Dynamic resolver registration
4. **Config System**: Multi-layer priority resolution
5. **Health Monitoring**: Status reporting via `/health`

## Future Enhancements

1. **Graceful Shutdown**: Register shutdown handlers to deregister on exit
2. **Retry Logic**: Exponential backoff for registration failures
3. **Metrics**: Track discovery query performance
4. **Cache Tuning**: Configurable TTL for discovery cache
5. **Load Balancing**: Smart vessel selection based on load/latency

## Related Files

- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/types.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/config.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/vessel-discovery.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/index.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/repl.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/test/vessel-discovery-integration.test.ts`

## References

- Discovery Vessel Specification: `openspec/changes/vessel-integration-standardization/`
- Vessel Discovery Client: `/home/avi/documents/work/exp-repo/metabob-devbob/packages/vessel-discovery-client/`
- Activity API Integration: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/src/services/discovery-client.ts`
