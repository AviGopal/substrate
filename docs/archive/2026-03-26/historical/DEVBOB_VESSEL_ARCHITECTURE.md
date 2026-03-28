# DevBob Vessel Architecture: Self-Managing Containers

**Date**: 2026-02-24  
**Status**: 🎯 **DESIGN - READY FOR IMPLEMENTATION**  
**Philosophy**: Treat devbob containers as fundamental units, vessels as plugins

---

## Executive Summary

### The Paradigm Shift

**Previous Approach** (Multi-Instance Coordination):
- Multiple OpenCode processes on same host
- Redis-based coordination for git conflicts
- Complex state synchronization
- ❌ **Problem**: Doesn't match our actual deployment model

**New Approach** (DevBob Vessels):
- **Each devbob container is a self-contained vessel**
- Containers ARE the coordination boundary (not processes)
- Vessels (metabob-opencode, metabob-cli) exist as plugins WITHIN containers
- Self-update, self-configure, self-manage capabilities
- **Simpler**: Work with what we've already built

### Core Insight

> "We don't want to run instances within the same host. It's simpler to use our devbob container that we worked hard to make and make ready for deployment."

**Key Realizations**:
1. ✅ **DevBob containers are already deployment-ready** (Dockerfile.devbob, entrypoint, ACP)
2. ✅ **Vessels as plugins** - All vessels (opencode, cli, etc.) are treated as plugins
3. ✅ **Self-update capability needed** - Containers must update their own vessels
4. ✅ **Config management** - Containers must modify their own opencode.json
5. ✅ **Boredom activities** - Idle time for self-improvement and growth
6. ⚠️ **Secret management** - Critical hurdle: access control without exposure

---

## Current State Analysis

### What Works (Already Built!)

**DevBob Container Infrastructure**:
```yaml
# docker-compose.yaml has 3 profiles:
1. stable: Backend services (Redis, SurrealDB, API server)
2. devbob: Single clean container for testing
3. devbob-dev: Multiple containers, each managing a codebase
```

**Container Capabilities** (Already Implemented):
- ✅ **Multi-stage build** with named targets
  - `metabob-cli-builder`: Builds CLI with venv
  - `opencode-builder`: Builds OpenCode standalone binary
  - `runtime`: Lightweight production image (~200MB)
- ✅ **Entrypoint script** (devbob-entrypoint.sh):
  - Auto-configures metabob-cli MCP server
  - Auto-configures OpenCode with MCP
  - Waits for backend health
  - Starts OpenCode in ACP mode
- ✅ **Container isolation**:
  - Each container has own `/workspace`
  - Own `.metabob/config.json` (isolated from host)
  - Own `.opencode/opencode.json` (isolated from host)
- ✅ **ACP server** (OpenCode Agent Client Protocol):
  - Port 3000 exposed for agent delegation
  - Test harness: `test-acp-delegation-phase4a.ts`
  - Delegation tool: `acp_delegate` (Phase 4a integrated)
- ✅ **Boredom system** (Already Implemented!):
  - `boredom-manager.ts` - Idle detection (5 min threshold)
  - Fetches activities from backend `/api/boredom/activities`
  - Auto-executes highest priority activity
  - Cancels if user returns
- ✅ **Environment handling**:
  - Secrets via env vars (ANTHROPIC_API_KEY, METABOB_API_KEY)
  - Backend connection (METABOB_API_URL)
  - Configurable per-container (docker-compose env vars)

**What's Missing**:
- ⚠️ Self-update mechanism for vessels (opencode, cli binaries)
- ⚠️ Config self-modification (containers can't update their own opencode.json yet)
- ⚠️ Secret management strategy (how to distribute secrets safely)
- ⚠️ Bootstrap process (settling into instance on first start)
- ⚠️ Vessel plugin system (formal mechanism for opencode/cli as plugins)

---

## Architecture Design

### Conceptual Model

```
┌─────────────────────────────────────────────────────────────┐
│ DevBob Container (Vessel)                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Workspace: /workspace                                    │ │
│ │ - Mounted codebase OR empty (for clean testing)         │ │
│ │ - .git/ (isolated git state)                            │ │
│ │ - .metabob/ (container-specific config)                 │ │
│ │ - .opencode/ (container-specific config)                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Vessel Plugins (Self-Updating)                          │ │
│ │ ┌──────────────────┐  ┌──────────────────┐             │ │
│ │ │ OpenCode Binary  │  │ Metabob-CLI venv │             │ │
│ │ │ /usr/local/bin/  │  │ /opt/metabob-cli/│             │ │
│ │ │   opencode       │  │   .venv/         │             │ │
│ │ └──────────────────┘  └──────────────────┘             │ │
│ │ - Version tracking: /workspace/.vessel-versions.json    │ │
│ │ - Update mechanism: Pull latest, rebuild, reload        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Self-Management Capabilities                            │ │
│ │ 1. Update Vessels: Download and install new versions   │ │
│ │ 2. Modify Config: Edit opencode.json as needed         │ │
│ │ 3. Bootstrap: Initialize on first start                │ │
│ │ 4. Boredom Activities: Self-improvement when idle      │ │
│ │ 5. Health Reporting: Status to orchestrator            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ External Connections                                    │ │
│ │ - Backend: api-server-dev:8080 (metabob RPC API)       │ │
│ │ - Redis: redis:6379 (shared state, if needed)          │ │
│ │ - SurrealDB: surreal:8000 (activity metrics)           │ │
│ │ - ACP Port: 3000 (for delegation from other vessels)   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Coordination Model (Container-Native)

**No Redis Coordination Needed!** Containers are naturally isolated:
- Each container has own workspace (volume or mount)
- Each container has own git state (no conflicts possible)
- Each container manages own codebase independently
- Communication via ACP (agent delegation) when needed

**Coordination Patterns**:
```
Pattern 1: Work Distribution (External Orchestrator)
┌──────────────┐
│ Orchestrator │ ← Kubernetes, Dask, or simple script
│ (Prefect?)   │
└──────┬───────┘
       │ Assigns work via:
       │ - Environment variables (TASK=update-cli)
       │ - ACP delegation (acp_delegate)
       │ - Boredom API (backend manages priority)
       ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ devbob-rpc   │ │ devbob-cli   │ │ devbob-clean │
│ (Port 3001)  │ │ (Port 3002)  │ │ (Port 3000)  │
└──────────────┘ └──────────────┘ └──────────────┘

Pattern 2: Agent-to-Agent Delegation (ACP)
devbob-rpc:3001 ──acp_delegate──> devbob-cli:3002
   "Fix bug in CLI"                    │
                                       ↓
                            Executes fix, reports back

Pattern 3: Boredom-Driven Work (Self-Initiated)
devbob-clean idle 5 min
        ↓
Fetches from backend: GET /api/boredom/activities
        ↓
Backend returns: [{template_id: "update-opencode-binary", priority: 10}]
        ↓
Container executes activity autonomously
        ↓
Reports completion: POST /api/boredom/activities/{id}/complete
```

**Key Insight**: Containers don't coordinate with each other directly. They coordinate through:
1. **Backend API** (boredom activities, metrics, state)
2. **ACP delegation** (when one vessel needs another's help)
3. **Shared services** (Redis/SurrealDB for global state, optional)

---

## Self-Management Capabilities

### 1. Vessel Self-Update Mechanism

**Problem**: Containers have static binaries built at image build time. Need dynamic updates.

**Solution**: Runtime update capability within container

**Implementation Design**:
```typescript
// Feature: Vessel Update System
// Location: repos/metabob-opencode/packages/opencode/src/vessel/update.ts

interface VesselVersion {
  vessel: "opencode" | "metabob-cli" | "cpg-inference"
  version: string
  checksum: string
  updated_at: string
  source: "github" | "registry" | "local"
}

interface VesselUpdateManager {
  // Check for available updates
  checkUpdates(): Promise<VesselVersion[]>
  
  // Download and install update
  updateVessel(vessel: string, version: string): Promise<void>
  
  // Reload vessel without restarting container
  reloadVessel(vessel: string): Promise<void>
  
  // Track current versions
  getCurrentVersions(): VesselVersion[]
  
  // Rollback to previous version
  rollback(vessel: string): Promise<void>
}

// Storage: /workspace/.vessel-versions.json
{
  "current": {
    "opencode": { "version": "1.2.3", "checksum": "abc123", ... },
    "metabob-cli": { "version": "0.5.0", "checksum": "def456", ... }
  },
  "history": [
    { "vessel": "opencode", "version": "1.2.2", "installed_at": "...", "reason": "auto-update" }
  ]
}
```

**Update Process**:
1. **Trigger**: Boredom activity `update-vessel-opencode` or explicit command
2. **Check**: Query GitHub releases or registry for latest version
3. **Download**: Fetch binary to `/tmp/opencode-new`
4. **Verify**: Checksum validation
5. **Install**: 
   - Copy to `/usr/local/bin/opencode.new`
   - Test: `./opencode.new --version`
   - Atomic swap: `mv opencode.new opencode`
6. **Reload**: 
   - If server mode: graceful restart (drain connections)
   - If CLI mode: next invocation uses new binary
7. **Record**: Update `/workspace/.vessel-versions.json`

**Rollback Strategy**:
- Keep previous binary at `/usr/local/bin/opencode.prev`
- If new version crashes, automatic rollback
- Manual rollback via: `opencode vessel rollback opencode`

### 2. Config Self-Modification

**Problem**: Containers need to adapt their own config based on context.

**Solution**: Config management API within OpenCode

**Implementation Design**:
```typescript
// Feature: Config Self-Management
// Location: repos/metabob-opencode/packages/opencode/src/config/self-modify.ts

interface ConfigManager {
  // Read current config (already exists via Config.state)
  getCurrentConfig(): Promise<Config.Info>
  
  // Modify config safely (with backup)
  updateConfig(updates: Partial<Config.Info>): Promise<void>
  
  // Add MCP server dynamically
  addMCPServer(name: string, config: McpConfig): Promise<void>
  
  // Update metabob backend URL (e.g., switching environments)
  updateBackendUrl(url: string): Promise<void>
  
  // Enable/disable features
  setFeatureFlag(flag: string, enabled: boolean): Promise<void>
}

// Example usage in activity:
// Activity: configure-for-production
async function configureForProduction() {
  await ConfigManager.updateConfig({
    metabob: {
      base_url: "https://api.metabob.com/prod",
      max_issues: 10,
      min_severity: "HIGH"
    },
    sessionMemory: {
      enabled: true,
      budgets: { total: 50000 }
    }
  })
  
  await ConfigManager.addMCPServer("prod-monitoring", {
    type: "remote",
    url: "https://monitoring.internal/mcp",
    enabled: true
  })
}
```

**Config Modification Process**:
1. **Backup**: Copy current `opencode.json` to `.opencode/opencode.json.backup`
2. **Merge**: Deep merge with updates (using remeda.mergeDeep)
3. **Validate**: Run ConfigValidation.validateAll()
4. **Write**: Atomic write to `opencode.json.tmp` then rename
5. **Reload**: Trigger Config.state.reload() to apply changes
6. **Verify**: Check that config loaded correctly

**Safety Mechanisms**:
- Always backup before modification
- Validation before write (prevents invalid configs)
- Rollback on error (restore from backup)
- Audit trail: `/workspace/.config-changes.log`

### 3. Bootstrap Process (Settling In)

**Problem**: When container starts, it needs to:
- Detect environment (clean vs mounted codebase)
- Configure itself appropriately
- Register with backend
- Determine its role/capabilities

**Solution**: Bootstrap activity runs on first start

**Implementation Design**:
```typescript
// Feature: Container Bootstrap
// Location: repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts

interface BootstrapManager {
  // Run on container first start
  async bootstrap(): Promise<BootstrapResult>
  
  // Detect environment
  detectEnvironment(): Environment
  
  // Register with backend
  registerVessel(): Promise<VesselRegistration>
  
  // Configure based on role
  configureForRole(role: string): Promise<void>
}

interface Environment {
  type: "clean" | "mounted-codebase" | "cloned-repo"
  workspace: string
  git_state: "none" | "clean" | "dirty"
  mounted_repos: string[]
  backend_url: string
  capabilities: string[]  // ["git", "docker", "kubectl", etc.]
}

// Bootstrap Activity (runs on first start)
async function bootstrapVessel() {
  const env = detectEnvironment()
  
  // 1. Register with backend
  const registration = await fetch(BACKEND + "/api/vessels/register", {
    method: "POST",
    body: JSON.stringify({
      container_name: process.env.HOSTNAME,
      environment: env,
      capabilities: detectCapabilities(),
      acp_port: 3000,
      version: {
        opencode: getVersion("opencode"),
        cli: getVersion("metabob-cli")
      }
    })
  })
  
  // 2. Fetch initial config from backend
  const config = await fetch(BACKEND + "/api/vessels/${registration.id}/config")
  await ConfigManager.updateConfig(config)
  
  // 3. Set up boredom activities
  await BoredomManager.startMonitoring(Session.current)
  
  // 4. Perform initial health check
  await healthCheck()
  
  // 5. Mark bootstrap complete
  await fs.writeFile("/workspace/.bootstrapped", JSON.stringify({
    completed_at: new Date().toISOString(),
    vessel_id: registration.id,
    environment: env
  }))
  
  console.log("✅ Vessel bootstrap complete")
}

// On subsequent starts, skip bootstrap:
if (await fs.exists("/workspace/.bootstrapped")) {
  const bootstrap = JSON.parse(await fs.readFile("/workspace/.bootstrapped"))
  console.log("✅ Vessel already bootstrapped:", bootstrap.vessel_id)
} else {
  await bootstrapVessel()
}
```

**Bootstrap Checklist**:
- [x] Detect environment (clean/mounted/cloned)
- [x] Detect capabilities (git, docker, kubectl available?)
- [x] Register with backend (get vessel_id)
- [x] Fetch initial config from backend
- [x] Apply config
- [x] Start boredom monitoring
- [x] Health check all services (Redis, SurrealDB, API)
- [x] Mark complete (`.bootstrapped` file)

### 4. Boredom Activities (Already Implemented!)

**Current Implementation** (`boredom-manager.ts`):
```typescript
// ALREADY EXISTS - Just needs activity templates
namespace BoredomManager {
  // Idle detection: 5 minutes no user activity
  const IDLE_THRESHOLD_MS = 5 * 60 * 1000
  
  // Checks every 30 seconds
  const CHECK_INTERVAL_MS = 30 * 1000
  
  // Fetches from backend:
  GET /api/boredom/activities
  → Returns: [{ template_id, priority, variables, reason }]
  
  // Executes highest priority activity
  await executeActivityInline(...)
  
  // Cancels if user returns
  if (user_activity_detected) {
    abortController.abort()
  }
}
```

**What's Needed**: Activity templates for self-improvement

**Boredom Activity Templates**:
```typescript
// 1. Update OpenCode Binary
{
  template_id: "update-vessel-opencode",
  priority: 8,
  reason: "New OpenCode version available with bug fixes"
}

// 2. Update Metabob CLI
{
  template_id: "update-vessel-cli",
  priority: 7,
  reason: "New CLI version with MCP improvements"
}

// 3. Optimize Config
{
  template_id: "optimize-config-for-workload",
  priority: 6,
  reason: "Adjust token budgets based on recent activity patterns"
}

// 4. Clean Workspace
{
  template_id: "cleanup-workspace",
  priority: 5,
  reason: "Remove old logs, temp files (>7 days old)"
}

// 5. Health Check and Report
{
  template_id: "health-check-report",
  priority: 9,
  reason: "Periodic health status to backend"
}

// 6. Learn from Recent Activities
{
  template_id: "analyze-recent-activities",
  priority: 6,
  reason: "Extract patterns from last 10 activity executions"
}

// 7. Contribute to Shared Knowledge
{
  template_id: "contribute-pattern-to-registry",
  priority: 4,
  reason: "Share learned pattern with other vessels"
}
```

**Boredom-Driven Growth**:
- Vessels improve themselves when idle
- No external orchestrator needed
- Backend prioritizes work (high-value first)
- Continuous evolution of capabilities

---

## Secret Management Strategy

### The Critical Hurdle

**Problem**: How do we distribute secrets to containers without exposure?

**Requirements**:
1. ✅ Each container needs: ANTHROPIC_API_KEY, METABOB_API_KEY
2. ✅ Secrets must not be in Git
3. ✅ Secrets must not be in Docker images
4. ✅ Secrets must not be in logs
5. ✅ Different containers may need different keys (rate limits, billing)
6. ✅ Must support key rotation
7. ✅ Must work in dev (localhost) AND prod (Kubernetes)

### Solution Options

#### Option 1: Environment Variables (Current, Simple)

**How it works**:
```yaml
# docker-compose.yaml
services:
  devbob-rpc-api:
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}  # From host .env
      METABOB_API_KEY: ${METABOB_API_KEY}
```

**Pros**:
- ✅ Simple, works now
- ✅ Standard practice for containers
- ✅ Supported by Kubernetes (secrets)
- ✅ No code changes needed

**Cons**:
- ⚠️ Secrets visible in `docker inspect`
- ⚠️ Secrets in shell history if set manually
- ⚠️ Requires host .env file (bootstrap problem)

**Mitigation**:
- Use `.env` files (not committed)
- Use `docker secret` (Swarm mode)
- Use Kubernetes secrets (prod)
- Restrict `docker inspect` access

**Verdict**: ✅ **Good enough for MVP**, upgrade later

#### Option 2: Vault Integration (Production-Ready)

**How it works**:
```typescript
// Container bootstrap fetches secrets from Vault
import { Vault } from "./vault-client"

async function bootstrap() {
  // Authenticate with Vault using container identity
  const vault = new Vault({
    url: process.env.VAULT_URL,
    role: process.env.VESSEL_ROLE,  // e.g., "devbob-rpc-api"
    auth_method: "kubernetes"  // or "approle", "jwt"
  })
  
  // Fetch secrets
  const secrets = await vault.read("vessels/devbob-rpc-api/secrets")
  
  // Set in process.env (NOT in config file)
  process.env.ANTHROPIC_API_KEY = secrets.anthropic_key
  process.env.METABOB_API_KEY = secrets.metabob_key
  
  // Secrets exist only in memory, never written to disk
}
```

**Pros**:
- ✅ Industry standard (Vault)
- ✅ Centralized secret management
- ✅ Audit trail (who accessed what, when)
- ✅ Key rotation support
- ✅ Dynamic secrets (short-lived)
- ✅ Secrets never touch disk

**Cons**:
- ⚠️ Requires Vault infrastructure (repos/platform has it!)
- ⚠️ More complex bootstrap
- ⚠️ Network dependency (Vault must be reachable)

**Verdict**: ✅ **Best for production**, implement in Phase 2

#### Option 3: Backend-Mediated Access (Hybrid)

**How it works**:
```typescript
// Containers don't hold LLM keys directly
// Backend (api-server) proxies LLM calls

// Container makes request:
const response = await fetch(BACKEND + "/api/llm/chat", {
  method: "POST",
  headers: {
    "X-Vessel-ID": vesselId,
    "X-Vessel-Token": vesselToken  // Container-specific token
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5",
    messages: [...]
  })
})

// Backend:
// 1. Validates vessel token
// 2. Checks rate limits for this vessel
// 3. Proxies to Anthropic using BACKEND's key
// 4. Returns response
```

**Pros**:
- ✅ Containers never hold expensive secrets
- ✅ Fine-grained rate limiting per vessel
- ✅ Cost attribution (which vessel used how much)
- ✅ Can revoke vessel access instantly
- ✅ Single point for key rotation (backend only)

**Cons**:
- ⚠️ Backend is single point of failure
- ⚠️ Latency overhead (extra hop)
- ⚠️ Backend must handle high throughput
- ⚠️ Requires backend API implementation

**Verdict**: ✅ **Best long-term**, perfect for fleet management

### Recommended Approach

**Phase 1 (Now)**: Environment Variables
- Use `.env` files for local dev
- Use Kubernetes secrets for prod
- Simple, works, unblocks progress

**Phase 2 (Next)**: Vault Integration
- Deploy Vault (repos/platform has Helmfile for it)
- Containers fetch secrets on bootstrap
- Enable key rotation

**Phase 3 (Future)**: Backend-Mediated Access
- Backend proxies LLM calls
- Containers use short-lived tokens
- Full cost attribution and control

**Implementation Priority**: Phase 1 NOW, Phase 2 in 1-2 weeks, Phase 3 as we scale

---

## Implementation Roadmap

### Phase 1: Foundation (THIS WEEK)

**Goal**: Enable vessel self-update and config modification

**Tasks**:
1. ✅ **Implement VesselUpdateManager** (repos/metabob-opencode)
   - `src/vessel/update.ts`
   - Check updates from GitHub releases
   - Download, verify, install binaries
   - Track versions in `.vessel-versions.json`

2. ✅ **Implement ConfigManager** (repos/metabob-opencode)
   - `src/config/self-modify.ts`
   - updateConfig() with backup
   - addMCPServer() dynamic
   - Validation and rollback

3. ✅ **Implement BootstrapManager** (repos/metabob-opencode)
   - `src/vessel/bootstrap.ts`
   - Detect environment
   - Register with backend
   - Create `.bootstrapped` marker

4. ✅ **Create Boredom Activity Templates** (metabob-devbob)
   - `update-vessel-opencode`
   - `update-vessel-cli`
   - `health-check-report`
   - `optimize-config-for-workload`
   - `cleanup-workspace`

5. ✅ **Backend API Endpoints** (repos/metabob-rpc-api)
   - `POST /api/vessels/register` - Vessel registration
   - `GET /api/vessels/{id}/config` - Fetch config
   - `GET /api/vessels/{id}/updates` - Check for updates
   - Already exists: `GET /api/boredom/activities`

**Deliverables**:
- Vessels can update themselves
- Vessels can modify their own config
- Vessels bootstrap on first start
- Boredom activities drive self-improvement

**Success Criteria**:
- ✅ Launch devbob-clean, it bootstraps automatically
- ✅ Vessel idle 5 min, auto-updates OpenCode binary
- ✅ Config modified without manual intervention
- ✅ All changes logged and auditable

### Phase 2: Secret Management (NEXT WEEK)

**Goal**: Secure secret distribution via Vault

**Tasks**:
1. ✅ **Deploy Vault** (repos/platform)
   - Use existing Helmfile config
   - Deploy to ops cluster (metabob-ops-k8s)
   - Initialize and unseal

2. ✅ **Implement VaultClient** (repos/metabob-opencode)
   - `src/vessel/vault.ts`
   - Kubernetes auth method
   - Fetch secrets on bootstrap
   - Keep secrets in memory only

3. ✅ **Migrate Secrets to Vault**
   - Store ANTHROPIC_API_KEY in Vault
   - Store METABOB_API_KEY in Vault
   - Create policies per vessel role

4. ✅ **Update Bootstrap Process**
   - Fetch secrets from Vault
   - Set in process.env (not config)
   - Implement lease renewal

**Deliverables**:
- Secrets managed centrally in Vault
- Containers fetch secrets on start
- No secrets in env vars or configs

**Success Criteria**:
- ✅ Container starts without secrets in docker-compose.yaml
- ✅ Secrets fetched from Vault successfully
- ✅ Vault audit log shows access
- ✅ Key rotation works (update Vault, containers refresh)

### Phase 3: Fleet Coordination (FUTURE)

**Goal**: Orchestrate multiple vessels via Dask/Prefect

**Tasks**:
1. ✅ **Deploy Orchestrator** (repos/platform)
   - Dask cluster (already have charts)
   - Prefect server (already have charts)
   - Define workflows

2. ✅ **Implement Fleet Manager**
   - Central coordinator
   - Work distribution
   - Health monitoring
   - Resource allocation

3. ✅ **Backend-Mediated LLM Access**
   - Proxy endpoint in metabob-rpc-api
   - Token-based vessel auth
   - Rate limiting and cost tracking

4. ✅ **Scaling Tests**
   - Launch 10 vessels
   - Distribute work via Prefect
   - Measure coordination overhead
   - Verify no conflicts

**Deliverables**:
- 10+ vessels working in coordination
- Prefect orchestrates activities
- Backend tracks costs per vessel
- Full observability and control

**Success Criteria**:
- ✅ 10 vessels running simultaneously
- ✅ Work distributed fairly
- ✅ Cost attribution accurate
- ✅ System "becoming" velocity measurable

---

## Activity Templates Needed

### 1. Vessel Self-Update Activities

**Template: `update-vessel-opencode`**
```json
{
  "name": "Update OpenCode Vessel Binary",
  "description": "Download, verify, and install latest OpenCode binary in running container",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "check-update",
      "description": "Check GitHub releases for new OpenCode version",
      "subagent": "general",
      "prompt": {
        "template": "Check for OpenCode updates. Current version: {{currentVersion}}. Return latest version and download URL."
      }
    },
    {
      "id": "download-verify",
      "description": "Download binary and verify checksum",
      "dependencies": ["check-update"]
    },
    {
      "id": "install",
      "description": "Install new binary (with rollback capability)",
      "dependencies": ["download-verify"]
    },
    {
      "id": "verify-install",
      "description": "Test new binary works correctly",
      "dependencies": ["install"]
    }
  ],
  "variables": [
    { "name": "currentVersion", "type": "string", "required": true },
    { "name": "targetVersion", "type": "string", "required": false, "default": "latest" }
  ]
}
```

**Template: `update-vessel-cli`**
Similar to above, but for metabob-cli venv.

### 2. Configuration Management Activities

**Template: `configure-vessel-for-environment`**
```json
{
  "name": "Configure Vessel for Environment",
  "description": "Adjust opencode.json based on detected environment (dev/staging/prod)",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "detect-environment",
      "description": "Detect environment from hostname, backend URL, etc."
    },
    {
      "id": "fetch-config-template",
      "description": "Fetch appropriate config from backend"
    },
    {
      "id": "merge-and-apply",
      "description": "Merge with existing config, validate, apply"
    },
    {
      "id": "verify-config",
      "description": "Test that new config works (health check)"
    }
  ]
}
```

**Template: `optimize-config-for-workload`**
Analyze recent activity patterns, adjust token budgets accordingly.

### 3. Bootstrap and Health Activities

**Template: `bootstrap-vessel`**
```json
{
  "name": "Bootstrap Vessel on First Start",
  "description": "Initialize vessel: detect environment, register with backend, configure",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "detect-environment",
      "description": "Detect workspace type, capabilities, mounted repos"
    },
    {
      "id": "register-with-backend",
      "description": "Register vessel, get vessel_id"
    },
    {
      "id": "fetch-initial-config",
      "description": "Download config from backend"
    },
    {
      "id": "apply-config",
      "description": "Write config, validate"
    },
    {
      "id": "health-check",
      "description": "Verify all services reachable"
    },
    {
      "id": "mark-bootstrapped",
      "description": "Create .bootstrapped marker file"
    }
  ]
}
```

**Template: `health-check-report`**
Periodic health status to backend (CPU, memory, disk, service connectivity).

### 4. Cleanup and Maintenance Activities

**Template: `cleanup-workspace`**
- Remove old logs (>7 days)
- Clean temp files
- Prune Docker images (if capability exists)
- Report disk space savings

**Template: `analyze-recent-activities`**
- Load last 10 activity executions from SurrealDB
- Extract patterns (what worked, what failed)
- Update local learning cache
- Contribute patterns to backend registry

---

## Coordination Patterns

### Pattern 1: Independent Vessels (No Coordination)

**Use Case**: Each vessel manages its own codebase

```
devbob-rpc-api (Port 3001)
├── Workspace: repos/metabob-rpc-api
├── Manages: Backend codebase
├── Boredom activities: update-vessel, cleanup, health-check
└── No coordination needed (own git repo)

devbob-cli (Port 3002)
├── Workspace: repos/metabob-cli
├── Manages: CLI codebase
├── Boredom activities: update-vessel, analyze-patterns
└── No coordination needed (own git repo)

devbob-opencode (Port 3003)
├── Workspace: repos/metabob-opencode
├── Manages: OpenCode codebase
├── Boredom activities: self-update (dogfooding!)
└── No coordination needed (own git repo)
```

**No Redis, no locks, no complexity!** Each vessel operates independently.

### Pattern 2: Agent-to-Agent Delegation (ACP)

**Use Case**: One vessel needs another's expertise

```typescript
// devbob-rpc-api discovers bug in CLI
// Delegates fix to devbob-cli (the CLI expert)

await acp_delegate({
  target: "docker://devbob-cli",  // or "ssh://devbob-cli:22/workspace"
  taskDescription: "Fix CLI argument parsing bug",
  prompt: `
    Fix the bug in metabob-cli argument parsing:
    - Issue: --format flag not recognized
    - File: src/metabob_cli/commands/analyze.py
    - Expected: Accept --format json|table
    - Current behavior: Error "unrecognized flag"
    
    Fix the issue, add tests, commit changes.
  `,
  shareImpulses: ["bug-report", "test-output"],  // Context sharing
  timeout: 600
})
```

**Benefits**:
- Vessels delegate to specialists
- Each vessel expert in its domain
- Cross-codebase collaboration
- No shared state conflicts

### Pattern 3: Backend-Orchestrated Work

**Use Case**: Central coordinator distributes work

```typescript
// Backend maintains priority queue of work
// Vessels fetch highest-priority work when idle

// Backend: POST /api/work/enqueue
{
  template_id: "analyze-codebase-for-security",
  priority: 10,
  target_vessel: "any",  // or specific vessel_id
  variables: { codebase: "metabob-rpc-api", focus: "sql-injection" }
}

// Vessel (devbob-clean) idle 5 min:
const work = await fetch(BACKEND + "/api/work/dequeue", {
  headers: { "X-Vessel-ID": vesselId }
})
// Backend returns highest priority work for this vessel
// Vessel executes activity, reports completion
```

**Benefits**:
- Central prioritization (backend knows global state)
- Vessels auto-pick work when idle
- Load balancing (backend assigns to least-busy vessel)
- Fair scheduling

### Pattern 4: Collaborative Analysis

**Use Case**: Multiple vessels analyze different parts of large codebase

```typescript
// Dask/Prefect workflow:
// - Launch 5 devbob-clean containers
// - Each analyzes 1/5 of files
// - Results aggregated in SurrealDB
// - Final report generated

// Prefect flow:
@flow
def analyze_large_codebase():
  files = list_all_files("metabob-rpc-api")
  chunks = partition(files, num_chunks=5)
  
  results = []
  for chunk in chunks:
    result = analyze_chunk.submit(chunk)  # Dask task
    results.append(result)
  
  aggregated = aggregate_results.submit(results)
  report = generate_report.submit(aggregated)
  return report

@task
def analyze_chunk(files: List[str]):
  # Delegates to devbob-clean container
  return acp_delegate({
    target: "docker://devbob-clean",
    taskDescription: f"Analyze {len(files)} files for issues",
    prompt: f"Analyze these files: {files}. Return issues found.",
  })
```

**Benefits**:
- Parallelism (5x faster)
- Leverages existing Dask/Prefect infrastructure
- Scales to 100s of vessels
- Results aggregated automatically

---

## Testing Strategy

### Unit Tests (Per Component)

**VesselUpdateManager**:
- ✅ Check updates from GitHub API
- ✅ Download binary to /tmp
- ✅ Verify checksum
- ✅ Install with rollback
- ✅ Track versions in JSON

**ConfigManager**:
- ✅ Backup before modification
- ✅ Merge configs correctly
- ✅ Validate after merge
- ✅ Rollback on validation failure
- ✅ Audit trail logged

**BootstrapManager**:
- ✅ Detect environment correctly
- ✅ Register with backend (mock)
- ✅ Fetch and apply config
- ✅ Mark bootstrap complete
- ✅ Skip on subsequent starts

### Integration Tests (With Backend)

**Boredom Activity Execution**:
```bash
# Test: Vessel auto-updates when idle
1. Start devbob-clean container
2. Wait 5 min (idle threshold)
3. Backend returns: update-vessel-opencode activity
4. Vessel downloads, installs new binary
5. Verify: opencode --version shows new version
6. Verify: .vessel-versions.json updated
```

**ACP Delegation**:
```bash
# Test: devbob-rpc delegates to devbob-cli
1. Start both containers
2. devbob-rpc runs: acp_delegate("docker://devbob-cli", "Fix bug X")
3. devbob-cli receives task, executes
4. devbob-rpc receives response
5. Verify: Changes committed in devbob-cli workspace
```

**Bootstrap Process**:
```bash
# Test: Fresh container bootstraps correctly
1. docker run devbob:latest (no .bootstrapped file)
2. Container detects environment
3. Container registers with backend (gets vessel_id)
4. Container fetches config from backend
5. Container applies config
6. Container marks bootstrapped
7. Verify: .bootstrapped file exists with vessel_id
8. Restart container
9. Verify: Bootstrap skipped (already completed)
```

### End-to-End Tests (Multi-Vessel)

**Fleet Coordination**:
```bash
# Test: 5 vessels coordinate via backend
1. Launch 5 devbob-clean containers
2. Backend enqueues 10 activities
3. Vessels idle, fetch work
4. Verify: All 10 activities completed
5. Verify: Work distributed fairly (2 per vessel)
6. Verify: No conflicts (each vessel independent workspace)
```

**Secret Management**:
```bash
# Test: Vault integration
1. Deploy Vault (repos/platform)
2. Store secrets in Vault
3. Launch devbob-clean (no env vars)
4. Container fetches secrets from Vault on bootstrap
5. Verify: LLM calls work (using fetched key)
6. Verify: Secrets not in logs or config files
7. Rotate key in Vault
8. Restart container
9. Verify: New key fetched automatically
```

---

## Deployment Guide

### Local Development (docker-compose)

**Quick Start**:
```bash
# 1. Set secrets in .env file
cat > .env <<EOF
ANTHROPIC_API_KEY=sk-ant-...
METABOB_API_KEY=mb_...
METABOB_PROJECT_ID=devbob-test
EOF

# 2. Start backend services
docker-compose --profile stable up -d

# 3. Start single devbob for testing
docker-compose --profile devbob up -d

# 4. Check logs
docker logs -f devbob-clean

# 5. Test ACP delegation
docker exec devbob-clean opencode test acp-delegation
```

**Multi-Vessel Development**:
```bash
# Start backend + all devbob-dev containers
docker-compose --profile stable --profile devbob-dev up -d

# Containers:
# - devbob-rpc-api (Port 3001, workspace: repos/metabob-rpc-api)
# - devbob-cli (Port 3002, workspace: repos/metabob-cli)
# - devbob-opencode (Port 3003, workspace: repos/metabob-opencode)
# - devbob-proto (Port 3004, workspace: repos/metabob-proto)

# Test delegation between vessels:
curl http://localhost:3001/acp/delegate -d '{
  "target": "docker://devbob-cli",
  "task": "Run tests",
  "prompt": "Run: pytest tests/ -v"
}'
```

### Kubernetes Deployment (Production)

**Using repos/platform**:
```bash
cd repos/platform

# 1. Deploy to development cluster
kubectx metabob-development-k8s
cd deployments/development
helmfile sync

# 2. Verify pods running
kubectl get pods -n metabob | grep devbob
# Expected:
# devbob-rpc-api-0    1/1  Running  0  2m
# devbob-cli-0        1/1  Running  0  2m
# devbob-opencode-0   1/1  Running  0  2m

# 3. Check logs
kubectl logs -f devbob-rpc-api-0 -n metabob

# 4. Scale up (more vessels)
kubectl scale statefulset devbob-clean -n metabob --replicas=5

# 5. Monitor with ArgoCD
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Visit: https://localhost:8080
```

**Secret Management (Kubernetes)**:
```bash
# Create secrets from .env file
kubectl create secret generic vessel-secrets -n metabob \
  --from-literal=anthropic-key=$ANTHROPIC_API_KEY \
  --from-literal=metabob-key=$METABOB_API_KEY

# Reference in Helm chart:
# values.yaml:
# env:
#   - name: ANTHROPIC_API_KEY
#     valueFrom:
#       secretKeyRef:
#         name: vessel-secrets
#         key: anthropic-key
```

---

## Monitoring & Observability

### Health Checks

**Container Health**:
```yaml
# docker-compose.yaml (already configured)
healthcheck:
  test: ["CMD", "sh", "-c", "curl -sf http://localhost:3000/config"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

**Vessel Health Endpoint**:
```typescript
// OpenCode exposes: GET /health
{
  status: "healthy" | "degraded" | "unhealthy",
  vessel: {
    id: "devbob-rpc-api-abc123",
    version: { opencode: "1.2.3", cli: "0.5.0" },
    uptime_seconds: 86400,
    bootstrapped: true,
    last_activity: "2026-02-24T12:00:00Z"
  },
  services: {
    backend: { status: "healthy", latency_ms: 45 },
    redis: { status: "healthy", latency_ms: 2 },
    surreal: { status: "healthy", latency_ms: 12 },
    vault: { status: "healthy", latency_ms: 23 }  // if enabled
  },
  workspace: {
    disk_usage_mb: 1024,
    git_state: "clean",
    mounted_repos: ["metabob-rpc-api"]
  },
  current_activity: {
    activity_id: "act_xyz789",
    template: "analyze-security",
    started_at: "2026-02-24T12:05:00Z",
    progress: 0.65
  }
}
```

### Metrics Collection

**Vessel Metrics** (sent to backend periodically):
```typescript
// POST /api/vessels/{id}/metrics every 60 seconds
{
  vessel_id: "devbob-rpc-api-abc123",
  timestamp: "2026-02-24T12:00:00Z",
  metrics: {
    // Resource usage
    cpu_percent: 45.2,
    memory_mb: 512,
    disk_usage_mb: 1024,
    
    // Activity metrics
    activities_completed_1h: 3,
    activities_failed_1h: 0,
    average_activity_duration_s: 180,
    
    // Boredom metrics
    idle_time_1h_s: 1200,  // 20 min idle
    boredom_activities_executed_1h: 2,
    
    // LLM usage
    llm_calls_1h: 45,
    llm_tokens_1h: 125000,
    llm_cost_1h: 0.85,
    
    // Service health
    backend_latency_ms_p50: 45,
    backend_latency_ms_p99: 120,
    backend_errors_1h: 0
  }
}
```

**Dashboard** (Grafana, using repos/platform monitoring):
- Vessel count (active, idle, unhealthy)
- Activity throughput (per vessel, per template)
- Resource usage (CPU, memory, disk) per vessel
- LLM cost per vessel
- Boredom activity frequency
- Version distribution (how many on each OpenCode version)

### Alerting

**Critical Alerts**:
- 🔴 Vessel unhealthy for >5 min
- 🔴 Bootstrap failed on new vessel
- 🔴 Vessel update failed with no rollback
- 🔴 Backend unreachable from any vessel

**Warning Alerts**:
- 🟡 Vessel idle for >1 hour (no work available?)
- 🟡 Activity failure rate >10%
- 🟡 Disk usage >80%
- 🟡 Vault secret fetch failed (fallback to env vars)

---

## Migration Path (Existing Work)

### What to Keep

**From Multi-Instance Coordination Design**:
- ✅ Problem analysis (git conflicts documented)
- ✅ Platform infrastructure understanding (repos/platform)
- ✅ Docker/Kubernetes deployment knowledge
- ✅ Dask/Prefect orchestration patterns
- ✅ Monitoring and observability approach

**From Existing Code**:
- ✅ `boredom-manager.ts` (already implemented!)
- ✅ `Dockerfile.devbob` (multi-stage, optimized)
- ✅ `devbob-entrypoint.sh` (bootstrap script)
- ✅ `docker-compose.yaml` (3 profiles: stable, devbob, devbob-dev)
- ✅ ACP delegation (`acp_delegate` tool, test harness)
- ✅ Backend API (metabob-rpc-api with health endpoints)

### What to Discard

**From Multi-Instance Coordination Design**:
- ❌ Redis-based distributed locks (not needed, containers isolated)
- ❌ Work queue in Redis (use backend API + boredom instead)
- ❌ Instance registry with heartbeats (use Kubernetes liveness probes)
- ❌ State synchronization (no shared state between containers)
- ❌ Optimistic locking (no conflicts possible)

**Reason**: We were solving for multiple processes on one host. We actually have containers (isolated by design).

### What to Build (New)

**Phase 1** (This Week):
1. VesselUpdateManager (self-update capability)
2. ConfigManager (config self-modification)
3. BootstrapManager (first-start initialization)
4. Boredom activity templates (update-vessel, health-check, etc.)
5. Backend API endpoints (vessel registration, config fetch)

**Phase 2** (Next Week):
6. VaultClient (secret management)
7. Vault deployment (repos/platform Helmfile)
8. Secret migration to Vault

**Phase 3** (Future):
9. Fleet orchestration (Dask/Prefect workflows)
10. Backend-mediated LLM access (cost tracking)
11. Scaling tests (10+ vessels)

---

## Success Criteria

### Phase 1 Success (This Week)

**Technical**:
- ✅ VesselUpdateManager tests pass (100% coverage)
- ✅ ConfigManager tests pass (100% coverage)
- ✅ BootstrapManager tests pass (100% coverage)
- ✅ devbob-clean container bootstraps on first start
- ✅ Vessel idle 5 min → auto-updates OpenCode binary
- ✅ Config modified without manual intervention
- ✅ All changes logged in audit trail

**User Experience**:
- ✅ `docker-compose --profile devbob up -d` → vessel ready in <60s
- ✅ Vessel self-configures based on environment
- ✅ Vessel self-updates when new version available
- ✅ Health dashboard shows vessel status

**Documentation**:
- ✅ DEVBOB_VESSEL_ARCHITECTURE.md (this document)
- ✅ VESSEL_SELF_UPDATE_GUIDE.md (how to update vessels)
- ✅ BOREDOM_ACTIVITIES_GUIDE.md (how to create activities)

### Phase 2 Success (Next Week)

**Technical**:
- ✅ Vault deployed and operational (repos/platform)
- ✅ Secrets stored in Vault (ANTHROPIC_API_KEY, METABOB_API_KEY)
- ✅ Vessels fetch secrets on bootstrap (no env vars)
- ✅ Key rotation works (update Vault, vessels refresh)
- ✅ Vault audit log shows all access

**User Experience**:
- ✅ New vessel launched → fetches secrets automatically
- ✅ No secrets in docker-compose.yaml or .env
- ✅ Vault UI shows secret usage per vessel

### Phase 3 Success (Future)

**Technical**:
- ✅ 10+ vessels running simultaneously (Kubernetes)
- ✅ Dask/Prefect orchestrates activities
- ✅ Backend proxies LLM calls (vessels use tokens)
- ✅ Cost attribution per vessel (<5% error)
- ✅ No git conflicts across fleet (0 conflicts)

**User Experience**:
- ✅ Fleet scales up/down automatically (HPA)
- ✅ Work distributed fairly (CV <0.2)
- ✅ Cost dashboard shows spend per vessel
- ✅ System "becoming" velocity measurable (activities/hour improving)

---

## Conclusion

### What We're Building

**A fleet of self-managing, self-improving AI vessels** that:
1. Live in Docker containers (isolated, reproducible)
2. Contain OpenCode + metabob-cli as plugins
3. Bootstrap on first start (detect environment, register, configure)
4. Update themselves when idle (new binaries, config optimization)
5. Collaborate via ACP (agent-to-agent delegation)
6. Coordinate via backend (work distribution, metrics, state)
7. Secure secrets via Vault (no exposed keys)
8. Scale via Kubernetes (10+ vessels, orchestrated by Prefect)

### Why This Approach?

**Simpler than multi-instance coordination**:
- ✅ Containers are naturally isolated (no locks needed)
- ✅ Each vessel manages own codebase (no git conflicts)
- ✅ Communication via ACP (clean interfaces)
- ✅ Work distribution via backend (no Redis complexity)

**Leverages existing infrastructure**:
- ✅ repos/platform (Kubernetes, Dask, Prefect, Vault)
- ✅ Dockerfile.devbob (already optimized)
- ✅ docker-compose.yaml (3 profiles ready)
- ✅ boredom-manager.ts (already implemented!)
- ✅ ACP delegation (test harness exists)

**Enables growth and evolution**:
- ✅ Vessels self-update (continuous improvement)
- ✅ Boredom activities (self-reflection when idle)
- ✅ Learning from execution (activity templates improve)
- ✅ "Becoming" measurable (velocity metrics)

### Next Action

**Create the Phase 1 implementation activity template**:
```bash
# This activity will implement:
# 1. VesselUpdateManager
# 2. ConfigManager
# 3. BootstrapManager
# 4. Boredom activity templates
# 5. Backend API endpoints

opencode activity create \
  --name "Implement Vessel Self-Management Phase 1" \
  --category infrastructure \
  --description "Enable vessels to update themselves, modify configs, and bootstrap"
```

**Ready to proceed?** 🚀

---

## Appendix: File Structure

### New Files to Create (repos/metabob-opencode)

```
packages/opencode/src/
├── vessel/
│   ├── update.ts           # VesselUpdateManager
│   ├── bootstrap.ts        # BootstrapManager
│   ├── vault.ts            # VaultClient (Phase 2)
│   └── health.ts           # Health reporting
├── config/
│   ├── self-modify.ts      # ConfigManager
│   └── backup.ts           # Config backup/rollback (already exists!)
└── session/
    └── boredom-manager.ts  # ALREADY EXISTS ✅
```

### New Files to Create (repos/metabob-rpc-api)

```
server/
├── api/
│   ├── vessels/
│   │   ├── register.py     # POST /api/vessels/register
│   │   ├── config.py       # GET /api/vessels/{id}/config
│   │   ├── updates.py      # GET /api/vessels/{id}/updates
│   │   └── metrics.py      # POST /api/vessels/{id}/metrics
│   └── boredom/
│       └── activities.py   # ALREADY EXISTS ✅
└── models/
    └── vessel.py           # Vessel data model
```

### Activity Templates to Create (.metabob/activities/)

```
.metabob/activities/
├── update-vessel-opencode.json
├── update-vessel-cli.json
├── configure-vessel-for-environment.json
├── optimize-config-for-workload.json
├── bootstrap-vessel.json
├── health-check-report.json
├── cleanup-workspace.json
└── analyze-recent-activities.json
```

---

**END OF DESIGN DOCUMENT**
