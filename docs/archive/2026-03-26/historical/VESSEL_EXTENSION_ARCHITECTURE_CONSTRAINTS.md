# Vessel Extension Architecture Constraints

**Date**: 2026-02-27  
**Purpose**: Define architectural constraints for integrating vessels as pre-built extensions  
**Principle**: Vessels are self-contained, composable units with declarative integration

---

## Executive Summary

This document defines constraints to enable vessels (source code repositories) to be integrated as pre-built extensions into development environments like OpenCode. The architecture treats all integrations uniformly, including Metabob itself, with a focus on platform-independent installation, declarative configuration, and lifecycle management.

**Key Distinction**: Two types of activities operate within the same execution model:
1. **Code-Generation Activities**: Output source code, validated via scripts
2. **Operational Activities**: Output non-code artifacts, validated via tool calls (and sometimes scripts)

Both types use the extension's tools and impulses to learn operational sequences.

---

## Core Architectural Constraints

### 1. Vessel Self-Containment Constraint

**Constraint**: All integration code must reside within the vessel (extension) itself

**Rationale**:
- No scattered integration code across host systems
- Vessel updates automatically update integration logic
- Clear ownership and maintenance boundaries
- Enables offline development and testing

**Requirements**:
```
vessel/
├── .extension/                    # Extension manifest directory
│   ├── manifest.json             # Extension metadata and capabilities
│   ├── install-activity.json    # Installation activity template
│   ├── teardown-activity.json   # Cleanup activity template
│   ├── lifecycle-hooks.ts       # Hook registration definitions
│   └── config-schema.json       # Configuration schema for validation
├── tools/                        # Tool implementations
│   ├── tool-1.ts
│   ├── tool-2.ts
│   └── index.ts                 # Tool registry export
├── src/                         # Extension source code
└── package.json                 # Standard npm metadata
```

**Validation**:
```bash
# Check for required extension structure
[ -d "vessel/.extension" ] || exit 1
[ -f "vessel/.extension/manifest.json" ] || exit 1
[ -f "vessel/.extension/install-activity.json" ] || exit 1
[ -f "vessel/.extension/teardown-activity.json" ] || exit 1
```

**Anti-Pattern**: ❌ Host system contains vessel-specific integration code  
**Correct Pattern**: ✅ Vessel contains all integration requirements

---

### 2. Platform-Independent Installation Constraint

**Constraint**: Installation/teardown activities must be platform-independent, ideally LLM-free

**Rationale**:
- Deterministic installation across environments
- No dependency on LLM availability during setup
- Reduced token costs for routine operations
- Faster installation times

**Requirements**:
- Installation activity uses declarative steps (file copy, env var set, service start)
- LLM usage via trailblazing is allowed as **fallback only** on failure
- Activity validation uses tool calls and shell commands (no LLM inference)

**Installation Activity Structure**:
```json
{
  "id": "install-vessel-extension",
  "name": "Install Vessel Extension",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "validate-prerequisites",
      "subagent": "general",
      "prompt": {
        "template": "Validate prerequisites: {{prerequisites}}",
        "variables": [
          { "name": "prerequisites", "type": "array", "required": true }
        ]
      },
      "validation": {
        "commands": [
          "command -v docker || exit 1",
          "command -v kubectl || exit 1"
        ]
      }
    },
    {
      "id": "copy-tools",
      "subagent": "general",
      "prompt": {
        "template": "Copy tool files from {{source}} to {{destination}}"
      },
      "validation": {
        "requiredFiles": ["{{destination}}/tool-1.ts", "{{destination}}/tool-2.ts"]
      }
    },
    {
      "id": "register-lifecycle-hooks",
      "subagent": "general",
      "prompt": {
        "template": "Register lifecycle hooks from {{hookFile}}"
      }
    },
    {
      "id": "start-services",
      "subagent": "general",
      "prompt": {
        "template": "Start services defined in {{serviceManifest}}"
      },
      "validation": {
        "commands": ["curl -sf http://localhost:{{port}}/health"]
      }
    }
  ],
  "trailblazing": {
    "enabled": true,
    "maxRecoveryAttempts": 3,
    "maxCostPerTask": 1.0
  }
}
```

**Validation**:
- Installation activity must complete without LLM in success case
- Trailblazing triggers only on validation failures
- All validation uses tool calls or shell commands

---

### 3. Tool Pool Integration Constraint

**Constraint**: Extension tools integrate into local pool, attachable to activities via impulse recommendations

**Rationale**:
- Tools discovered dynamically (no hardcoded references)
- Impulse system recommends tools based on context
- Activities can require specific tools explicitly
- Loose coupling between extensions and activities

**Tool Registration Flow**:
```typescript
// 1. Extension exports tools via manifest
{
  "tools": [
    {
      "id": "vessel_custom_analyzer",
      "name": "Custom Analyzer",
      "description": "Analyzes custom data structures",
      "entrypoint": "./tools/custom-analyzer.ts",
      "required_by": ["analyze-codebase-activity"]  // Optional hard requirement
    }
  ]
}

// 2. Host loads tools into registry
ToolRegistry.register({
  id: "vessel_custom_analyzer",
  source: "extension:my-vessel",
  handler: await import("my-vessel/tools/custom-analyzer.ts")
})

// 3. Impulse system recommends tools based on context
ImpulseResolver.recommend({
  context: "analyzing custom data structures",
  available_tools: ToolRegistry.list(),
  // Returns: ["vessel_custom_analyzer"] with confidence score
})

// 4. Activities declare required tools (optional)
{
  "tasks": [{
    "required_tools": ["vessel_custom_analyzer"]  // Hard requirement
  }]
}
```

**Validation**:
```bash
# Check tool registration
opencode config get tools | jq '.[] | select(.source == "extension:my-vessel")'

# Verify tool execution
opencode tool call vessel_custom_analyzer --args '{"input": "test"}'
```

**Anti-Pattern**: ❌ Activities hardcode tool names without registration  
**Correct Pattern**: ✅ Tools registered in manifest, recommended by impulses, optionally required by activities

---

### 4. Lifecycle Hook Registration Constraint

**Constraint**: Extensions register hooks to standardized targets via declarative manifest

**Rationale**:
- Predictable hook execution order
- No code changes to host system
- Multiple extensions can hook same targets
- Clear extension capabilities at registration time

**Hook Targets** (based on `TurnLifecycle` system):
```typescript
type HookTarget = 
  // Turn lifecycle (priority < 100 = pre-turn, >= 100 = post-turn)
  | "pre-turn"        // Before LLM turn starts
  | "post-turn"       // After LLM turn completes
  
  // Activity lifecycle
  | "activity.setup"           // Activity initialization
  | "activity.task.before"     // Before task execution
  | "activity.task.after"      // After task completion
  | "activity.complete"        // Activity finalization
  
  // Impulse lifecycle
  | "impulse.loaded"           // Impulse loaded into context
  | "impulse.unloaded"         // Impulse evicted from context
  
  // Session lifecycle
  | "session.start"            // Session initialization
  | "session.complete"         // Session finalization
  
  // Tool lifecycle
  | "tool.execute.before"      // Before tool execution
  | "tool.execute.after"       // After tool completes
  
  // Configuration lifecycle
  | "config.updated"           // Configuration change detected
```

**Hook Registration Manifest**:
```json
{
  "lifecycle_hooks": [
    {
      "target": "pre-turn",
      "priority": 50,
      "handler": "./lifecycle-hooks.ts#preTurnHook",
      "enabled_when": {
        "config": "my_extension.auto_inject",
        "value": true
      }
    },
    {
      "target": "activity.task.before",
      "priority": 10,
      "handler": "./lifecycle-hooks.ts#beforeTask",
      "enabled_when": {
        "activity_category": "feature"
      }
    }
  ]
}
```

**Handler Implementation** (in `lifecycle-hooks.ts`):
```typescript
import { TurnLifecycle } from "@opencode-ai/opencode"

export const preTurnHook: TurnLifecycle.Hook = {
  name: "my-vessel-pre-turn",
  priority: 50,
  
  async enabled(ctx) {
    // Check if hook should run
    const config = await Config.get("my_extension")
    return config.auto_inject === true
  },
  
  async execute(ctx) {
    // Hook implementation
    const start = Date.now()
    
    // Example: Inject custom context
    await SessionMemory.createImpulse({
      id: "my-vessel-context",
      content: await fetchVesselContext(ctx.sessionID)
    })
    
    return {
      success: true,
      modified: true,
      duration: Date.now() - start,
      metadata: { impulseCount: 1 }
    }
  }
}
```

**Host Integration**:
```typescript
// Host automatically registers hooks from extensions
async function loadExtension(manifest: ExtensionManifest) {
  for (const hook of manifest.lifecycle_hooks) {
    const handler = await import(hook.handler)
    TurnLifecycle.registerHook(handler)
  }
}
```

**Validation**:
```bash
# List registered hooks
opencode hooks list | jq '.[] | select(.source == "extension:my-vessel")'

# Test hook execution
opencode hooks test pre-turn --dry-run
```

---

### 5. Self-Configuration Constraint

**Constraint**: Extensions configure via existing self-configuration activities with declarative schemas

**Rationale**:
- Consistent configuration UX across all extensions
- Schema validation prevents misconfigurations
- Configuration changes trigger validation activities
- Documentation auto-generated from schemas

**Configuration Schema** (in `.extension/config-schema.json`):
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "my_vessel": {
      "type": "object",
      "description": "My Vessel Extension Configuration",
      "properties": {
        "auto_inject": {
          "type": "boolean",
          "default": true,
          "description": "Automatically inject vessel context into prompts"
        },
        "api_endpoint": {
          "type": "string",
          "format": "uri",
          "description": "Vessel API endpoint URL"
        },
        "cache_timeout": {
          "type": "number",
          "minimum": 0,
          "default": 300,
          "description": "Cache timeout in seconds"
        }
      },
      "required": ["api_endpoint"]
    }
  }
}
```

**Host Integration**:
```typescript
// Host loads schema and adds to config system
Config.registerExtensionSchema({
  extension: "my-vessel",
  schema: await readJSON(".extension/config-schema.json")
})

// User configures via standard config activities
await Activity.execute({
  templateId: "update-config",
  variables: {
    key: "my_vessel.api_endpoint",
    value: "https://my-vessel.example.com"
  }
})
```

**Configuration Activity** (self-configuration uses existing activities):
```json
{
  "id": "configure-vessel-extension",
  "tasks": [
    {
      "id": "validate-config",
      "validation": {
        "commands": [
          "opencode config validate --schema .extension/config-schema.json"
        ]
      }
    },
    {
      "id": "apply-config",
      "prompt": {
        "template": "Apply configuration: {{config_changes}}"
      }
    }
  ]
}
```

**Validation**:
```bash
# Validate extension config schema
opencode config validate --extension my-vessel

# Show extension config
opencode config get my_vessel
```

---

### 6. Service Inspection Constraint

**Constraint**: Extensions expose service status via standardized inspection interface

**Rationale**:
- Unified monitoring across all extensions
- Automatic health checks and restarts
- Reconnection handling for distributed services
- Debugging and troubleshooting support

**Service Manifest** (in `.extension/services.json`):
```json
{
  "services": [
    {
      "id": "my-vessel-api",
      "name": "My Vessel API Server",
      "type": "web_server",
      "health_check": {
        "type": "http",
        "endpoint": "http://localhost:8080/health",
        "interval": 30,
        "timeout": 5,
        "retries": 3
      },
      "restart_policy": {
        "on_failure": true,
        "max_restarts": 5,
        "backoff": "exponential"
      },
      "process": {
        "command": "npm run start",
        "cwd": "./",
        "env": {
          "PORT": "8080"
        }
      }
    },
    {
      "id": "my-vessel-worker",
      "name": "Background Worker",
      "type": "process",
      "health_check": {
        "type": "file",
        "path": "/tmp/worker.pid",
        "interval": 60
      }
    },
    {
      "id": "my-vessel-ml-pipeline",
      "name": "ML Training Pipeline",
      "type": "ml_workflow",
      "health_check": {
        "type": "custom",
        "command": "python check_pipeline.py",
        "interval": 300
      }
    }
  ]
}
```

**Inspection Tool** (automatically registered by host):
```typescript
// Host registers inspection tool for each extension
ToolRegistry.register({
  id: "inspect_my_vessel_services",
  async execute() {
    const services = await readJSON(".extension/services.json")
    const statuses = await Promise.all(
      services.services.map(s => checkServiceHealth(s))
    )
    
    return {
      extension: "my-vessel",
      services: statuses.map((status, i) => ({
        id: services.services[i].id,
        name: services.services[i].name,
        status: status.healthy ? "healthy" : "unhealthy",
        uptime: status.uptime,
        last_check: status.timestamp,
        error: status.error
      }))
    }
  }
})
```

**Reconnection Handling**:
```typescript
// Extension provides reconnection logic
export async function reconnectService(serviceId: string) {
  const service = services.find(s => s.id === serviceId)
  
  if (service.type === "web_server") {
    // Wait for health check to pass
    for (let i = 0; i < service.health_check.retries; i++) {
      const healthy = await fetch(service.health_check.endpoint)
      if (healthy.ok) return { success: true }
      await sleep(service.restart_policy.backoff === "exponential" 
        ? 1000 * Math.pow(2, i) 
        : 1000)
    }
  }
  
  // Restart if unhealthy
  await restartService(service)
}
```

**Validation**:
```bash
# Inspect all services
opencode inspect services --extension my-vessel

# Check specific service
opencode inspect service my-vessel-api --follow

# Trigger restart
opencode service restart my-vessel-api
```

**Output Format**:
```json
{
  "extension": "my-vessel",
  "services": [
    {
      "id": "my-vessel-api",
      "name": "My Vessel API Server",
      "status": "healthy",
      "uptime": "2h 34m",
      "last_check": "2026-02-27T12:00:00Z",
      "endpoint": "http://localhost:8080"
    },
    {
      "id": "my-vessel-worker",
      "name": "Background Worker",
      "status": "unhealthy",
      "error": "PID file not found",
      "last_check": "2026-02-27T12:00:00Z",
      "restart_attempts": 3
    }
  ]
}
```

---

### 7. Metabob-as-Extension Alignment Constraint

**Constraint**: Metabob itself must be implemented as an extension following these same constraints

**Rationale**:
- Proves extension architecture is sufficient for complex integrations
- No special cases for first-party vs third-party extensions
- Metabob serves as reference implementation
- Extension system validated against real-world complexity

**Metabob Extension Structure**:
```
metabob-cli/                              # Vessel (source code)
├── .extension/
│   ├── manifest.json                    # Extension metadata
│   ├── install-activity.json           # Installation via MCP server setup
│   ├── teardown-activity.json          # Cleanup MCP connections
│   ├── lifecycle-hooks.ts              # Pre-turn context injection, etc.
│   ├── config-schema.json              # Metabob config validation
│   └── services.json                   # MCP server, analysis engine
├── tools/
│   ├── search-codebase-issues.ts       # Metabob MCP tools
│   ├── mark-problem-complete.ts
│   ├── annotate-component.ts
│   └── index.ts                        # Tool exports
├── src/
│   ├── mcp-server/                     # MCP server implementation
│   ├── analysis-engine/                # Code quality engine
│   └── cli/                            # CLI commands
└── package.json
```

**Metabob Installation Activity**:
```json
{
  "id": "install-metabob-extension",
  "tasks": [
    {
      "id": "install-metabob-cli",
      "prompt": { "template": "Install metabob-cli package" },
      "validation": {
        "commands": ["command -v metabob-cli || exit 1"]
      }
    },
    {
      "id": "configure-mcp-server",
      "prompt": { 
        "template": "Configure MCP server in opencode.json: {{mcp_config}}" 
      },
      "validation": {
        "commands": [
          "opencode config get mcp.metabob || exit 1"
        ]
      }
    },
    {
      "id": "register-metabob-tools",
      "prompt": { "template": "Register Metabob tools into tool pool" }
    },
    {
      "id": "start-mcp-server",
      "prompt": { "template": "Start Metabob MCP server" },
      "validation": {
        "commands": ["metabob-cli mcp ping || exit 1"]
      }
    }
  ]
}
```

**Validation**:
- Metabob installation uses same activity system as third-party extensions
- No special-case code in host for Metabob integration
- All Metabob integration code lives in `metabob-cli` vessel

---

### 8. Backend Gateway Constraint (MCP Architecture)

**Constraint**: All backend data access via metabob-cli MCP gateway, configurable via config system

**Rationale**:
- Loose coupling (extensions don't import backend libraries)
- Graceful degradation (offline mode possible)
- Single source of truth (metabob-cli owns backend protocol)
- Configuration consistency (all extensions configured same way)

**Architecture Flow**:
```
Extension Code
    ↓ (tool call)
OpenCode Tool Registry
    ↓ (MCP protocol)
metabob-cli MCP Server
    ↓ (gRPC/REST)
metabob-rpc-api Backend
    ↓ (SQL)
SurrealDB Storage
```

**Configuration Integration**:
```json
{
  "mcp": {
    "metabob": {
      "command": "metabob-cli",
      "args": ["mcp", "start"],
      "env": {
        "METABOB_API_KEY": "${METABOB_API_KEY}",
        "METABOB_RPC_URL": "http://metabob-rpc-api:8080"
      }
    }
  }
}
```

**Extension Usage**:
```typescript
// Extension code NEVER imports SurrealDB or backend libraries
// Instead, uses tools that go through MCP gateway

// ❌ Anti-pattern: Direct backend access
import { SurrealDB } from "surrealdb.js"
const db = new SurrealDB(...)

// ✅ Correct: Tool call via MCP
const result = await ToolRegistry.call("metabob_search_activities", {
  category: "feature"
})
```

**Validation**:
```bash
# Verify no direct backend imports in extensions
rg "import.*surrealdb" extensions/*/

# Verify MCP gateway configuration
opencode config get mcp.metabob

# Test MCP connectivity
opencode tool call test_metabob_mcp
```

---

### 9. Activity Type Distinction Constraint

**Constraint**: Support two activity types with same execution model but different validation

**Rationale**:
- Code-generation activities produce source files (validated via scripts)
- Operational activities produce non-code outputs (validated via tool calls)
- Both use extension tools and learn from impulses
- Distinction is validation mechanism, not execution model

**Activity Type Declaration**:
```json
{
  "id": "my-activity",
  "activity_type": "code_generation",  // or "operational"
  "output_type": {
    "code_generation": {
      "expected_outputs": ["src/feature.ts", "tests/feature.test.ts"],
      "validation": {
        "commands": ["npm run lint", "npm test"]
      }
    },
    "operational": {
      "expected_outputs": ["deployment-status.json", "health-report.json"],
      "validation": {
        "requiredFiles": ["deployment-status.json"],
        "tools": ["verify_deployment_status"]
      }
    }
  }
}
```

**Code-Generation Activity Example**:
```json
{
  "id": "add-rest-endpoint",
  "activity_type": "code_generation",
  "tasks": [
    {
      "id": "generate-code",
      "prompt": { "template": "Generate REST endpoint: {{endpoint_spec}}" },
      "validation": {
        "requiredFiles": ["src/api/{{endpoint}}.ts"],
        "commands": ["npm run lint src/api/{{endpoint}}.ts"]
      }
    },
    {
      "id": "generate-tests",
      "validation": {
        "requiredFiles": ["tests/api/{{endpoint}}.test.ts"],
        "commands": ["npm test tests/api/{{endpoint}}.test.ts"]
      }
    }
  ]
}
```

**Operational Activity Example**:
```json
{
  "id": "deploy-kubernetes-service",
  "activity_type": "operational",
  "tasks": [
    {
      "id": "apply-manifests",
      "prompt": { "template": "Apply Kubernetes manifests: {{manifests}}" },
      "validation": {
        "tools": ["kubectl_get_pods"],
        "commands": ["kubectl get pods -n {{namespace}} | grep Running"]
      }
    },
    {
      "id": "verify-health",
      "validation": {
        "tools": ["check_service_health"],
        "requiredFiles": ["deployment-status.json"]
      }
    }
  ]
}
```

**Execution Model** (identical for both):
```typescript
// Same activity executor for both types
async function executeActivity(activity: ActivityTemplate) {
  for (const task of activity.tasks) {
    // 1. Execute task (LLM or tool-based)
    const result = await executeTask(task)
    
    // 2. Validate output (different validation but same flow)
    if (activity.activity_type === "code_generation") {
      await validateCodeGeneration(task.validation)
    } else {
      await validateOperational(task.validation)
    }
    
    // 3. Learn from impulses (same for both)
    await ImpulseResolver.track(task.impulses_used)
  }
}
```

**Validation**:
```bash
# Validate code-generation activity
opencode activity validate add-rest-endpoint --type code_generation

# Validate operational activity
opencode activity validate deploy-kubernetes-service --type operational

# Both use same execution engine
opencode activity execute <activity-id>
```

---

## Extension Manifest Schema

**Complete Manifest Structure** (`.extension/manifest.json`):
```json
{
  "$schema": "https://opencode.ai/schemas/extension-manifest.json",
  "extension": {
    "id": "my-vessel",
    "name": "My Vessel Extension",
    "version": "1.0.0",
    "description": "Description of what this extension provides",
    "author": "Extension Author",
    "homepage": "https://example.com",
    "repository": "https://github.com/example/my-vessel"
  },
  
  "capabilities": {
    "tools": true,
    "lifecycle_hooks": true,
    "activities": true,
    "services": true,
    "config": true
  },
  
  "installation": {
    "activity": "./install-activity.json",
    "teardown": "./teardown-activity.json",
    "prerequisites": [
      { "type": "command", "name": "docker", "version": ">=20.0.0" },
      { "type": "command", "name": "node", "version": ">=18.0.0" }
    ]
  },
  
  "tools": [
    {
      "id": "my_vessel_tool_1",
      "name": "Tool 1",
      "description": "What this tool does",
      "entrypoint": "./tools/tool-1.ts",
      "category": "analysis",
      "required_by": []  // Optional activity dependencies
    }
  ],
  
  "lifecycle_hooks": [
    {
      "target": "pre-turn",
      "priority": 50,
      "handler": "./lifecycle-hooks.ts#preTurnHook",
      "enabled_when": { "config": "my_vessel.auto_inject", "value": true }
    }
  ],
  
  "activities": [
    {
      "id": "my-vessel-activity",
      "path": "./activities/my-activity.json",
      "category": "feature",
      "auto_register": true
    }
  ],
  
  "services": "./services.json",
  
  "config_schema": "./config-schema.json",
  
  "documentation": {
    "readme": "./README.md",
    "guides": [
      { "title": "Getting Started", "path": "./docs/getting-started.md" },
      { "title": "Configuration", "path": "./docs/configuration.md" }
    ],
    "api_docs": "./docs/api/"
  }
}
```

---

## Constraint Summary Table

| # | Constraint | Requirement | Validation | Auto-Enforceable |
|---|------------|-------------|------------|------------------|
| 1 | Self-Containment | All code in vessel | Directory structure check | ✅ Yes |
| 2 | Platform Independence | Installation activity LLM-free | Activity dry-run | ✅ Yes |
| 3 | Tool Pool Integration | Tools registered via manifest | Tool registry query | ✅ Yes |
| 4 | Lifecycle Hooks | Declarative hook registration | Hook list verification | ✅ Yes |
| 5 | Self-Configuration | Config via schema + activities | Schema validation | ✅ Yes |
| 6 | Service Inspection | Standardized health checks | Service status check | ✅ Yes |
| 7 | Metabob Alignment | Metabob follows constraints | Same validation as others | ✅ Yes |
| 8 | Backend Gateway | All data via MCP | Import analysis | ✅ Yes |
| 9 | Activity Types | Code-gen vs operational | Type declaration check | ✅ Yes |

**Auto-Enforceable**: 9/9 (100%)  
**Validation Required**: 9/9 (100%)

---

## Extension Lifecycle

### Phase 1: Discovery
```bash
# User discovers extension
opencode extension search <query>
opencode extension info my-vessel
```

### Phase 2: Installation
```bash
# Install extension
opencode extension install my-vessel

# Behind the scenes:
# 1. Clone vessel repository (or download package)
# 2. Validate manifest structure
# 3. Check prerequisites
# 4. Execute install-activity.json (platform-independent, LLM-free)
# 5. Register tools in tool pool
# 6. Register lifecycle hooks
# 7. Load config schema
# 8. Start services
```

### Phase 3: Configuration
```bash
# Configure extension
opencode config set my_vessel.api_endpoint "https://example.com"

# Validate configuration
opencode config validate --extension my-vessel
```

### Phase 4: Usage
```bash
# Use extension tools
opencode tool call my_vessel_tool_1

# Execute extension activities
opencode activity execute my-vessel-activity

# Extension hooks run automatically during turns
opencode chat  # pre-turn hooks inject context automatically
```

### Phase 5: Monitoring
```bash
# Inspect services
opencode inspect services --extension my-vessel

# View extension status
opencode extension status my-vessel
```

### Phase 6: Teardown
```bash
# Uninstall extension
opencode extension uninstall my-vessel

# Behind the scenes:
# 1. Execute teardown-activity.json
# 2. Stop services
# 3. Unregister hooks
# 4. Remove tools
# 5. Clean up config
```

---

## Reference Implementation: Metabob Extension

The Metabob extension serves as the **canonical reference** for this architecture:

```
metabob-cli/
├── .extension/
│   ├── manifest.json
│   │   {
│   │     "id": "metabob",
│   │     "capabilities": {
│   │       "tools": true,
│   │       "lifecycle_hooks": true,
│   │       "services": true,
│   │       "config": true
│   │     }
│   │   }
│   ├── install-activity.json
│   │   - Install metabob-cli binary
│   │   - Configure MCP server
│   │   - Register tools
│   │   - Start MCP server
│   ├── teardown-activity.json
│   │   - Stop MCP server
│   │   - Clean up state
│   ├── lifecycle-hooks.ts
│   │   - Pre-turn: Inject code quality context
│   │   - Post-turn: Track resolutions
│   ├── config-schema.json
│   │   - Metabob configuration validation
│   └── services.json
│       - MCP server (health: metabob-cli mcp ping)
│       - Analysis engine
├── tools/
│   ├── search-codebase-issues.ts
│   ├── mark-problem-complete.ts
│   ├── annotate-component.ts
│   └── [15 more MCP tools]
└── src/
    ├── mcp-server/
    ├── analysis-engine/
    └── cli/
```

**Key Validation**: If Metabob cannot be implemented as an extension following these constraints, the constraints are insufficient.

---

## Validation Activity

**Activity Template**: `validate-extension-constraints.json`

```json
{
  "id": "validate-extension-constraints",
  "name": "Validate Extension Constraints",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "check-manifest",
      "validation": {
        "requiredFiles": [".extension/manifest.json"],
        "commands": [
          "jq -e '.extension.id' .extension/manifest.json",
          "jq -e '.installation.activity' .extension/manifest.json"
        ]
      }
    },
    {
      "id": "check-self-containment",
      "validation": {
        "requiredFiles": [
          ".extension/install-activity.json",
          ".extension/teardown-activity.json"
        ]
      }
    },
    {
      "id": "validate-tools",
      "validation": {
        "commands": [
          "jq -r '.tools[].entrypoint' .extension/manifest.json | xargs -I {} test -f {}"
        ]
      }
    },
    {
      "id": "validate-config-schema",
      "validation": {
        "commands": [
          "test -f .extension/config-schema.json",
          "jq -e '.$schema' .extension/config-schema.json"
        ]
      }
    },
    {
      "id": "test-installation",
      "prompt": {
        "template": "Dry-run installation activity (no LLM expected)"
      },
      "validation": {
        "commands": [
          "opencode activity validate .extension/install-activity.json"
        ]
      }
    }
  ]
}
```

---

## Enforcement Strategy

### Phase 1: Extension Validation
```bash
# Before accepting extension into registry
opencode extension validate /path/to/vessel

# Checks:
# - Manifest structure
# - Required files present
# - Tool entrypoints exist
# - Config schema valid
# - Installation activity dry-run succeeds
```

### Phase 2: Installation Enforcement
```bash
# During installation
opencode extension install my-vessel

# Enforces:
# - Prerequisites met
# - Installation activity completes
# - Tools registered successfully
# - Hooks registered
# - Services started and healthy
```

### Phase 3: Runtime Enforcement
```bash
# During operation
# - Tools only callable if registered
# - Hooks only execute if enabled in config
# - Services monitored and restarted on failure
# - Config changes validated against schema
```

### Phase 4: Audit and Compliance
```bash
# Periodic checks
opencode extension audit

# Verifies:
# - All installed extensions meet constraints
# - No direct backend imports (MCP gateway only)
# - Services are healthy
# - Configuration is valid
```

---

## Migration Path

### Step 1: Treat Metabob as Extension (Immediate)
- Extract Metabob integration code into `.extension/` directory in `metabob-cli`
- Create `install-activity.json` for MCP server setup
- Define `lifecycle-hooks.ts` for pre-turn context injection
- Validate Metabob follows all 9 constraints

### Step 2: Define Extension SDK (1-2 weeks)
- Create `@opencode-ai/extension-sdk` package
- Export manifest types, hook types, tool types
- Provide extension validation utilities
- Document extension development guide

### Step 3: Implement Extension Manager (2-4 weeks)
- `opencode extension install/uninstall/list/validate`
- Tool pool integration
- Hook registration system
- Service monitoring

### Step 4: Migrate Existing Integrations (4-6 weeks)
- Convert any existing integrations to extension format
- Validate against constraints
- Update documentation

### Step 5: Open Extension Registry (6-8 weeks)
- Public extension registry
- Community extension submissions
- Automated validation and testing

---

## Success Criteria

**Extension architecture is successful if:**

1. ✅ Metabob is implemented as an extension with zero special cases
2. ✅ Third-party developers can create extensions without host code changes
3. ✅ Installation is platform-independent and deterministic
4. ✅ Extensions compose cleanly (no conflicts between tools/hooks)
5. ✅ Service monitoring and reconnection works automatically
6. ✅ Configuration follows same patterns as core OpenCode config
7. ✅ Both code-generation and operational activities work seamlessly
8. ✅ Backend access only via MCP gateway (no direct imports)
9. ✅ All constraints are automatically enforceable and validatable

---

## Related Documents

- **DEPLOYMENT_CONSTRAINTS.md**: Distributed DevBob deployment constraints
- **DATAFLOW_ARCHITECTURE.md**: MCP gateway and backend dataflow
- **Activity Templates**: Code-generation vs operational activity patterns
- **Plugin System**: Existing plugin architecture (to be unified with extensions)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-27  
**Status**: ✅ Constraints defined, ready for implementation
