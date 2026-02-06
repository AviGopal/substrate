# ACP Server Configuration for exp-repo

## Issue Found

Your original `opencode.json` had an incorrect `remote` configuration:

```json
// ❌ WRONG - This is not valid for the remote schema
"remote": {
  "devbob-rpc-api": {
    "host": "localhost",
    "port": 3001,
    "description": "DevBob agent for metabob-rpc-api codebase"
  }
}
```

**Problem**: The `remote` field in OpenCode is for **SSH-based remote execution**, not ACP servers. It requires fields like `user`, `directory`, `identity` for SSH connections.

## Solution: Use ACP Delegation Tool

For DevBob containers running locally, you don't need configuration in `opencode.json`. Instead, use the `acp_delegate` tool directly:

### Method 1: Docker Container Delegation (Recommended)

If your DevBob agents are running in Docker containers:

```typescript
// Delegate to DevBob container
await acp_delegate({
  target: "docker://devbob-rpc-api",
  taskDescription: "Implement RPC endpoint",
  prompt: "Create a new RPC method for user authentication...",
  shareImpulses: ["designSpec"],
  timeout: 300,
});
```

**Container names**:

- `docker://devbob-rpc-api`
- `docker://devbob-dashboard`
- `docker://devbob-cli`
- `docker://devbob-opencode`

### Method 2: SSH Remote Configuration (If Needed)

If you want to use SSH-based remote execution (not ACP delegation), configure like this:

```json
{
  "remote": {
    "devbob-rpc-api": {
      "host": "localhost",
      "user": "avi",
      "directory": "/home/avi/documents/work/exp-repo/metabob-rpc-api",
      "port": 22,
      "identity": "~/.ssh/id_rsa",
      "auto_sync": false
    },
    "devbob-dashboard": {
      "host": "localhost",
      "user": "avi",
      "directory": "/home/avi/documents/work/exp-repo/metabob-dashboard",
      "port": 22,
      "identity": "~/.ssh/id_rsa",
      "auto_sync": false
    }
  }
}
```

Then use with SSH remote tools:

```typescript
// Execute command on remote
remote_bash({
  remote: "devbob-rpc-api",
  command: "npm test",
  description: "Run tests",
});

// Read remote file
remote_read({
  remote: "devbob-rpc-api",
  filePath: "src/index.ts",
});
```

## Corrected Configuration

Your fixed `opencode.json` (without remote section):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "share": "disabled",

  "metabob": {
    "enabled": true,
    "cli_path": "/home/avi/.local/bin/metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true,
    "headless": false,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "template_auto_registration": {
      "enabled": true,
      "behavior": "best-effort",
      "strategy": "on-create"
    }
  },

  "mcp": {
    "metabob": {
      "type": "local",
      "command": [
        "/home/avi/.local/bin/metabob-cli",
        "mcp",
        "--transport",
        "stdio"
      ],
      "enabled": true,
      "environment": {
        "METABOB_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

## How to Use Your DevBob Agents

### Check Running Containers

```bash
docker ps --filter "name=devbob"
```

Expected output:

```
devbob-rpc-api
devbob-dashboard
devbob-cli
devbob-opencode
```

### Delegate to Specific Agent

```typescript
// RPC API development
await acp_delegate({
  target: "docker://devbob-rpc-api",
  taskDescription: "Add authentication endpoint",
  prompt: "Implement JWT authentication for the RPC API...",
});

// Dashboard development
await acp_delegate({
  target: "docker://devbob-dashboard",
  taskDescription: "Create metrics dashboard",
  prompt: "Build a React component showing code quality metrics...",
});

// CLI development
await acp_delegate({
  target: "docker://devbob-cli",
  taskDescription: "Add CLI command",
  prompt: "Add a new 'analyze' command that scans code...",
});
```

### Multi-Agent Coordination

```typescript
// Create shared design
impulse_create({
  id: "authDesign",
  pointer: {
    type: "memo",
    content: `Authentication Design:
    - JWT tokens
    - Refresh token flow
    - Session management`,
  },
  budget: 3000,
});

// Parallel implementation
const [api, dashboard, cli] = await Promise.all([
  acp_delegate({
    target: "docker://devbob-rpc-api",
    taskDescription: "API auth endpoints",
    prompt:
      "Implement auth endpoints. Annotate with MESSAGE_FOR:dashboard for UI integration.",
    shareImpulses: ["authDesign"],
  }),
  acp_delegate({
    target: "docker://devbob-dashboard",
    taskDescription: "Auth UI",
    prompt:
      "Create login form. Check Metabob for MESSAGE_FOR:dashboard from API agent.",
    shareImpulses: ["authDesign"],
  }),
  acp_delegate({
    target: "docker://devbob-cli",
    taskDescription: "CLI auth",
    prompt: "Add login command for CLI authentication.",
    shareImpulses: ["authDesign"],
  }),
]);
```

## Configuration Schema Reference

### Remote (SSH) Schema

```typescript
{
  host: string;              // Hostname or IP
  user?: string;             // SSH username
  directory: string;         // Remote working directory
  port?: number;             // SSH port (default: 22)
  identity?: string;         // SSH key path
  auto_sync?: boolean;       // Auto git sync (default: true)
  copy_env?: boolean;        // Copy local env vars (default: false)
  environment?: Record<string, string>;  // Remote env vars
}
```

### ACP Delegation (No Config Needed)

ACP delegation uses the `acp_delegate` tool directly - no configuration required:

```typescript
{
  target: string;            // "docker://container-name"
  taskDescription: string;   // Brief task summary
  prompt: string;            // Detailed instructions
  shareImpulses?: string[];  // Impulse IDs to share
  timeout?: number;          // Timeout in seconds (default: 300)
}
```

## Troubleshooting

### Configuration Parse Error

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('.opencode/opencode.json', 'utf-8'))"

# Check against schema
bun run typecheck
```

### ACP Connection Failed

```bash
# Check container is running
docker ps --filter "name=devbob-rpc-api"

# Test ACP directly
docker exec -i devbob-rpc-api opencode acp --cwd /workspace

# Check logs
docker logs devbob-rpc-api
```

### Metabob Not Working

```bash
# Check Metabob CLI path
which metabob-cli
# Should match cli_path in config

# Test Metabob MCP
/home/avi/.local/bin/metabob-cli mcp --transport stdio

# Check base URL is accessible
curl http://localhost:8080/health
```

## Related Documentation

- **Full ACP Guide**: `../../packages/opencode/REMOTE_ACP_CONFIG_GUIDE.md`
- **Setup Checklist**: `../../packages/opencode/REMOTE_SETUP_CHECKLIST.md`
- **Example Workflow**: `../../packages/opencode/examples/acp-multi-agent-workflow.md`
- **Config Schema**: `../../packages/opencode/src/config/config.ts`

## Summary

✅ **Removed invalid `remote` configuration** (wrong schema)  
✅ **Added missing `share` field** (required)  
✅ **Configured Metabob MCP** properly  
✅ **Use `acp_delegate` tool** for DevBob containers (no config needed)  
✅ **Use `remote` config** only for SSH-based execution (if needed)

Your configuration is now valid and ready to use!
