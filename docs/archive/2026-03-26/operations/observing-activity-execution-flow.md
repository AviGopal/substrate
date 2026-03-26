# Observing Activity Execution Flow: DevBob → metabob-cli → RPC API

This guide shows how to execute an activity in the DevBob container and trace the complete request flow through metabob-cli to the RPC API backend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ DevBob Container (k8s pod)                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ opencode acp --hostname 0.0.0.0 --port 8080                 │ │
│ │   ├── Activity execution                                    │ │
│ │   ├── MCP client → metabob-cli MCP server (stdio)          │ │
│ │   └── variant_id tracking                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│          ↓ MCP calls (stdio transport)                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ metabob-cli MCP Server                                      │ │
│ │   ├── metabob_activity (activity execution endpoint)        │ │
│ │   ├── metabob_register_activity_template                    │ │
│ │   └── HTTP client → RPC API                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          ↓ HTTP requests (http://metabob-rpc-api:8080)
┌─────────────────────────────────────────────────────────────────┐
│ RPC API (k8s service: metabob-rpc-api:8080)                     │
│   ├── POST /api/v1/activity_template/register                  │
│   ├── POST /api/v1/activity/execute                            │
│   ├── POST /api/v1/activity/result                             │
│   └── SurrealDB persistence (variant_id tracking)              │
└─────────────────────────────────────────────────────────────────┘
```

## Current Running Instances

### 1. K8s DevBob Pod (Primary)
- **Pod**: `devbob-84466fdfff-dd87l` (namespace: metabob)
- **Container**: Running (4 days uptime)
- **RPC API URL**: `http://metabob-rpc-api:8080` (internal k8s service)
- **Entry Point**: `opencode acp --hostname 0.0.0.0 --port 8080`

### 2. OpenCode Vessel (Secondary - for testing)
- **Container**: `devbob-opencode-vessel`
- **RPC API URL**: `http://host.docker.internal:8080`

## Step-by-Step: Execute Activity and Observe Logs

### Step 1: Open Terminal Windows

You'll need **3 terminal windows**:

**Terminal 1: DevBob Container**
```bash
kubectl exec -it -n metabob devbob-84466fdfff-dd87l -- /bin/bash
```

**Terminal 2: metabob-cli Logs**
```bash
kubectl logs -n metabob -f devbob-84466fdfff-dd87l
```

**Terminal 3: RPC API Logs**
```bash
kubectl logs -n metabob -f deployment/metabob-rpc-api
```

### Step 2: Execute Test Activity

In Terminal 1:

```bash
# Simple test
opencode mcp test metabob_search_activities --args '{"category": "infrastructure"}'
```

### Step 3: Check Logs

Terminal 2 (metabob-cli):
- Look for: "Received MCP tool call: metabob_activity"
- Check: HTTP request to RPC API with variant_id

Terminal 3 (RPC API):
- Look for: "POST /api/v1/activity/execute HTTP/1.1" 200 OK
- Check: SurrealDB insertion with variant_id

## Quick Test Script

Save as `test-activity-flow.sh`:

```bash
#!/bin/bash
echo "Testing Activity Execution Flow"
opencode mcp test metabob_search_activities --args '{"verbose": false}'
echo "Check logs in other terminals"
```

Run with: `bash test-activity-flow.sh`
